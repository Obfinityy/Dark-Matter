/**
 * wave70BCores.js — bulk actions part 2 (ideas 52781–52800).
 *
 * Pure logic for bulk share links, safeguarded bulk delete, bulk
 * archival, bulk commenting, bounty drafts, ticket linking, due-date
 * setting, priority overrides, watcher subscriptions, notification
 * mute, moving findings between hunts, duplicate merging and unmerge,
 * verify-fixed, mass reopen, print and ID-copy payloads, the bulk
 * actions API surface, bulk-action undo, and the approval gate for
 * destructive bulk work. Every helper takes explicit timestamps,
 * never mutates its inputs, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE70_B_IDEAS = [
  { id: 52781, title: 'Bulk share-link creation', skip: false },
  { id: 52782, title: 'Bulk delete with safeguards (post-hunt)', skip: false },
  { id: 52783, title: 'Bulk finding archival', skip: false },
  { id: 52784, title: 'Bulk commenting', skip: false },
  { id: 52785, title: 'Bulk bounty-draft creation', skip: false },
  { id: 52786, title: 'Bulk ticket linking', skip: false },
  { id: 52787, title: 'Bulk due-date setting', skip: false },
  { id: 52788, title: 'Bulk priority override (post-hunt)', skip: false },
  { id: 52789, title: 'Bulk watcher subscription', skip: false },
  { id: 52790, title: 'Bulk notification mute', skip: false },
  { id: 52791, title: 'Bulk move between hunts', skip: false },
  { id: 52792, title: 'Bulk duplicate merging', skip: false },
  { id: 52793, title: 'Bulk unmerge', skip: false },
  { id: 52794, title: 'Bulk verify-fixed', skip: false },
  { id: 52795, title: 'Mass finding reopen', skip: false },
  { id: 52796, title: 'Bulk print', skip: false },
  { id: 52797, title: 'Bulk ID copy', skip: false },
  { id: 52798, title: 'Bulk actions API', skip: false },
  { id: 52799, title: 'Bulk-action undo', skip: false },
  { id: 52800, title: 'Bulk-action approval gate', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const DESTRUCTIVE_ACTIONS = ['delete', 'dismiss-false-positive', 'merge-duplicates', 'priority-override', 'move-hunt', 'archive'];
const DUE_DEFAULT_DAYS = { critical: 3, high: 7, medium: 14, low: 30, info: 45 };
const BULK_OPERATIONS = ['severity', 'assign-owner', 'tag', 'transition', 'dismiss-false-positive', 'retest-queue', 'export', 'share-link', 'delete', 'archive', 'comment', 'ticket-link', 'due-date', 'priority-override', 'watch', 'mute', 'move-hunt', 'merge-duplicates', 'verify-fixed', 'reopen'];

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}

function stateOf(f) {
  return String((f && (f.status || f.state)) || 'new').toLowerCase().trim();
}

function normState(s) {
  return String(s || '').toLowerCase().trim();
}

function shortHash(text) {
  let hash = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}

function withHistory(finding, from, to, actor, at, reason) {
  const entry = { from, to, actor: actor || 'system', at: at || null, reason: reason || '' };
  return { ...finding, status: to, state: to, stateEnteredAt: at || finding.stateEnteredAt || null, history: [...((finding && finding.history) || []), entry] };
}

/**
 * Create one share link covering exactly the selection (idea 52781).
 * The link token is derived from the sorted finding ids so the same
 * selection always produces the same link for the same creator.
 * @param {Array} findings - Findings to share.
 * @param {object} [options] - { createdBy, baseUrl, expiresAt }.
 * @returns {object} { url, token, findingIds, count, expiresAt }.
 */
export function createBulkShareLink(findings = [], options = {}) {
  const findingIds = (findings || []).map(f => f.id);
  const token = `shr_${shortHash([...findingIds].sort().join(',') + ':' + String(options.createdBy || ''))}`;
  const base = String(options.baseUrl || 'https://dark-matter.example/share').replace(/\/$/, '');
  return { url: `${base}/${token}`, token, findingIds, count: findingIds.length, expiresAt: options.expiresAt || null };
}

/**
 * Delete a selection only with typed confirmation (idea 52782).
 * The caller must type the exact confirmation phrase; every deletion
 * writes an audit entry naming the actor and the finding.
 * @param {Array} findings - Findings to delete.
 * @param {object} [options] - { confirmation, actor, at }.
 * @returns {object} { ok, requiredConfirmation, deletedIds, auditEntries, error }.
 */
export function bulkDeleteWithSafeguards(findings = [], options = {}) {
  const count = (findings || []).length;
  const requiredConfirmation = `DELETE ${count}`;
  if (String(options.confirmation || '') !== requiredConfirmation) {
    return { ok: false, requiredConfirmation, deletedIds: [], auditEntries: [], error: `type "${requiredConfirmation}" to confirm deletion` };
  }
  const deletedIds = (findings || []).map(f => f.id);
  const auditEntries = (findings || []).map(f => ({
    action: 'bulk-delete',
    findingId: f.id,
    title: f.title || null,
    actor: options.actor || 'system',
    at: options.at || null,
    source: 'Infinity AI',
  }));
  return { ok: true, requiredConfirmation, deletedIds, auditEntries, error: null };
}

/**
 * Archive a selection with shared archive settings (idea 52783).
 * Archived copies preserve the lifecycle state they held and record
 * the shared reason and retention applied to the whole batch.
 * @param {Array} findings - Findings to archive.
 * @param {object} [options] - { archivedBy, at, settings: { reason, retentionDays } }.
 * @returns {object} { archived, count, byState, settings }.
 */
export function bulkArchiveSelection(findings = [], options = {}) {
  const settings = { reason: (options.settings && options.settings.reason) || 'post-hunt archive', retentionDays: Number((options.settings && options.settings.retentionDays) || 365) };
  const archived = (findings || []).map(f => ({ ...f, archived: true, archivedAt: options.at || null, archivedBy: options.archivedBy || 'system', preservedState: stateOf(f), archiveSettings: { ...settings } }));
  const byState = {};
  for (const f of archived) byState[f.preservedState] = (byState[f.preservedState] || 0) + 1;
  return { archived, count: archived.length, byState, settings };
}

/**
 * Post the same comment to many findings (idea 52784).
 * Each finding receives its own comment record in its own thread so
 * later replies stay attached to the right finding.
 * @param {Array} findings - Findings to comment on.
 * @param {string} commentText - Comment body.
 * @param {object} [options] - { author, at }.
 * @returns {object} { ok, updated, commentedIds, count, error }.
 */
export function bulkPostComment(findings = [], commentText = '', options = {}) {
  const text = String(commentText || '').trim();
  if (!text) return { ok: false, updated: [], commentedIds: [], count: 0, error: 'bulk comment requires text' };
  const updated = (findings || []).map(f => {
    const comment = { id: `c_${shortHash(`${f.id}:${text}:${options.at || ''}`)}`, author: options.author || 'system', text, at: options.at || null, source: 'Infinity AI' };
    return { ...f, comments: [...((f.comments) || []), comment] };
  });
  return { ok: true, updated, commentedIds: updated.map(f => f.id), count: updated.length, error: null };
}

/**
 * Create platform submission drafts for a selection (idea 52785).
 * Each draft carries the finding title, severity, target, and
 * evidence summary in the platform's expected draft shape.
 * @param {Array} findings - Findings to draft.
 * @param {object} [options] - { platform, submitter }.
 * @returns {object} { drafts, count, platform }.
 */
export function createBountyDrafts(findings = [], options = {}) {
  const platform = String(options.platform || 'bug-platform').toLowerCase();
  const drafts = (findings || []).map(f => ({
    draftId: `dr_${shortHash(`${platform}:${f.id}:${f.title || ''}`)}`,
    findingId: f.id,
    platform,
    title: `[${sevKey(f)}] ${f.title || 'untitled finding'}`,
    body: [`Target: ${f.target || 'unknown'}`, `Severity: ${sevKey(f)}`, `Evidence: ${((f.evidence) || []).join('; ') || 'see Infinity AI finding record'}`].join('\n'),
    status: 'draft',
    submitter: options.submitter || null,
  }));
  return { drafts, count: drafts.length, platform };
}

/**
 * Link a selection to external tickets in one mapping (idea 52786).
 * A string mapping links every finding to one ticket; an object maps
 * each finding id to its own ticket key.
 * @param {Array} findings - Findings to link.
 * @param {string|object} mapping - Ticket key or id-to-key map.
 * @param {object} [options] - { provider, baseUrl }.
 * @returns {object} { updated, linkedIds, skippedIds, count, provider }.
 */
export function linkFindingsToTickets(findings = [], mapping = {}, options = {}) {
  const provider = String(options.provider || 'jira').toLowerCase();
  const base = String(options.baseUrl || 'https://tracker.example.com/browse').replace(/\/$/, '');
  const linkedIds = [];
  const skippedIds = [];
  const updated = (findings || []).map(f => {
    const ticketId = typeof mapping === 'string' ? mapping : (mapping && mapping[f.id]) || null;
    if (!ticketId) { skippedIds.push(f.id); return { ...f }; }
    linkedIds.push(f.id);
    return { ...f, ticketProvider: provider, ticketId: String(ticketId), ticketUrl: `${base}/${ticketId}` };
  });
  return { updated, linkedIds, skippedIds, count: linkedIds.length, provider };
}

/**
 * Set or shift due dates across a selection (idea 52787).
 * An explicit date applies to all; otherwise severity defaults set
 * the date from the supplied instant, shifted when requested.
 * @param {Array} findings - Findings to schedule.
 * @param {object} [options] - { dueAt, shiftDays, nowIso, actor }.
 * @returns {object} { updated, changedIds, count }.
 */
export function bulkSetDueDates(findings = [], options = {}) {
  const nowMs = parseMs(options.nowIso);
  const shiftDays = Number(options.shiftDays || 0);
  const changedIds = [];
  const updated = (findings || []).map(f => {
    let dueAt = null;
    if (options.dueAt) dueAt = options.dueAt;
    else if (f.dueAt && shiftDays) {
      const cur = parseMs(f.dueAt);
      dueAt = cur !== null ? new Date(cur + shiftDays * 86400000).toISOString() : f.dueAt;
    } else if (nowMs !== null) {
      const days = (DUE_DEFAULT_DAYS[sevKey(f)] || 14) + shiftDays;
      dueAt = new Date(nowMs + days * 86400000).toISOString();
    }
    if (!dueAt) return { ...f };
    changedIds.push(f.id);
    return { ...f, dueAt, dueSetBy: options.actor || 'system' };
  });
  return { updated, changedIds, count: changedIds.length };
}

/**
 * Override priority flags for sprint planning (idea 52788).
 * The override is stored separately from severity so sprint order
 * can change without rewriting the risk assessment.
 * @param {Array} findings - Findings to flag.
 * @param {object} [options] - { priority, reason, actor, at }.
 * @returns {object} { updated, flaggedIds, count, priority }.
 */
export function bulkSetPriorityOverride(findings = [], options = {}) {
  const priority = String(options.priority || 'sprint-next').toLowerCase();
  const updated = (findings || []).map(f => ({ ...f, priorityOverride: priority, priorityFlag: true, priorityReason: options.reason || '', prioritySetBy: options.actor || 'system', prioritySetAt: options.at || null }));
  return { updated, flaggedIds: updated.map(f => f.id), count: updated.length, priority };
}

/**
 * Subscribe watchers to every selected finding (idea 52789).
 * Watcher lists are unioned and deduplicated per finding so repeated
 * subscriptions never create duplicate entries.
 * @param {Array} findings - Findings to watch.
 * @param {Array} watchers - Watcher ids to add.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { updated, count, watchersAdded }.
 */
export function bulkAddWatchers(findings = [], watchers = [], options = {}) {
  const added = [...new Set((watchers || []).map(w => String(w)).filter(Boolean))];
  const updated = (findings || []).map(f => ({ ...f, watchers: [...new Set([...((f.watchers) || []), ...added])] }));
  return { updated, count: updated.length, watchersAdded: added };
}

/**
 * Mute notifications for a selection (idea 52790).
 * Muted findings record who muted them and until when, so digests
 * and alerts skip them for the mute window only.
 * @param {Array} findings - Findings to mute.
 * @param {object} [options] - { mutedBy, at, muteUntil, reason }.
 * @returns {object} { updated, mutedIds, count, muteUntil }.
 */
export function bulkMuteNotifications(findings = [], options = {}) {
  const updated = (findings || []).map(f => ({ ...f, notificationsMuted: true, mutedBy: options.mutedBy || 'system', mutedAt: options.at || null, muteUntil: options.muteUntil || null, muteReason: options.reason || '' }));
  return { updated, mutedIds: updated.map(f => f.id), count: updated.length, muteUntil: options.muteUntil || null };
}

/**
 * Move findings from one hunt to another (idea 52791).
 * Moved findings record their origin hunt and the move in history so
 * programme reporting can still trace where work started.
 * @param {Array} findings - Findings to move.
 * @param {string} targetHuntId - Destination hunt.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { ok, updated, movedIds, count, error }.
 */
export function bulkMoveToHunt(findings = [], targetHuntId = '', options = {}) {
  if (!targetHuntId) return { ok: false, updated: [], movedIds: [], count: 0, error: 'a target hunt id is required' };
  const updated = (findings || []).map(f => {
    const fromHunt = f.huntId || null;
    const history = [...((f.history) || []), { from: fromHunt, to: targetHuntId, actor: options.actor || 'system', at: options.at || null, reason: 'moved between hunts' }];
    return { ...f, huntId: targetHuntId, movedFromHunt: fromHunt, history };
  });
  return { ok: true, updated, movedIds: updated.map(f => f.id), count: updated.length, error: null };
}

/**
 * Merge duplicates into a canonical finding (idea 52792).
 * Evidence and tags are unioned onto the canonical record while each
 * duplicate points back at it in the duplicate state.
 * @param {Array} findings - Canonical plus duplicates.
 * @param {string} canonicalId - Canonical finding id.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { ok, canonical, duplicates, mergedIds, evidence, error }.
 */
export function mergeIntoCanonical(findings = [], canonicalId = '', options = {}) {
  const list = findings || [];
  const source = list.find(f => String(f.id) === String(canonicalId));
  if (!source) return { ok: false, canonical: null, duplicates: [], mergedIds: [], evidence: [], error: 'canonical finding is not in the selection' };
  const evidence = [...new Set(list.flatMap(f => (f.evidence) || []))];
  const tags = [...new Set(list.flatMap(f => (f.tags) || []))];
  const mergedIds = list.filter(f => String(f.id) !== String(canonicalId)).map(f => f.id);
  const canonical = { ...source, evidence, tags, mergedIds, mergedAt: options.at || null, mergedBy: options.actor || 'system' };
  const duplicates = list.filter(f => String(f.id) !== String(canonicalId)).map(f => {
    const moved = withHistory(f, stateOf(f), 'duplicate', options.actor, options.at, `merged into ${canonicalId}`);
    return { ...moved, canonicalId };
  });
  return { ok: true, canonical, duplicates, mergedIds, evidence, error: null };
}

/**
 * Split a merged finding back into its originals (idea 52793).
 * Each original is restored from its preserved snapshot with its
 * history intact plus an unmerge entry.
 * @param {object} merged - Canonical finding with mergedFrom snapshots.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { ok, restored, count, canonicalId, error }.
 */
export function unmergeMergedFinding(merged = {}, options = {}) {
  const snapshots = (merged && merged.mergedFrom) || [];
  if (!snapshots.length) return { ok: false, restored: [], count: 0, canonicalId: (merged && merged.id) || null, error: 'no merged snapshots to restore' };
  const restored = snapshots.map(s => {
    const base = { ...s };
    delete base.mergedIds;
    const history = [...((base.history) || []), { from: 'duplicate', to: stateOf(base), actor: options.actor || 'system', at: options.at || null, reason: `unmerged from ${merged.id}` }];
    return { ...base, history, unmergedAt: options.at || null };
  });
  return { ok: true, restored, count: restored.length, canonicalId: merged.id || null, error: null };
}

/**
 * Mark a selection as verified-fixed (idea 52794).
 * Findings in fix or verification states move to Verified with the
 * verifier and evidence recorded; other states are blocked.
 * @param {Array} findings - Findings to verify.
 * @param {object} [options] - { verifiedBy, at, evidence }.
 * @returns {object} { verified, verifiedIds, blocked, count }.
 */
export function bulkVerifyFixed(findings = [], options = {}) {
  const eligible = ['fixing', 'verifying', 'reopened'];
  const verified = [];
  const blocked = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (!eligible.includes(state)) { blocked.push({ id: f.id, reason: `state ${state} cannot be verified directly` }); continue; }
    const moved = withHistory(f, state, 'verified', options.verifiedBy, options.at, 'bulk verify-fixed');
    verified.push({ ...moved, verifiedBy: options.verifiedBy || 'system', verificationEvidence: options.evidence || f.verificationEvidence || null });
  }
  return { verified, verifiedIds: verified.map(f => f.id), blocked, count: verified.length };
}

/**
 * Reopen a selection under one shared reason (idea 52795).
 * Only closed, verified, or dismissed findings can reopen; the shared
 * reason is recorded on every reopened finding.
 * @param {Array} findings - Findings to reopen.
 * @param {object} [options] - { reason, actor, at }.
 * @returns {object} { ok, reopened, reopenedIds, blocked, error }.
 */
export function bulkReopenFindings(findings = [], options = {}) {
  const reason = String(options.reason || '').trim();
  if (reason.length < 3) return { ok: false, reopened: [], reopenedIds: [], blocked: [], error: 'mass reopen requires a shared reason' };
  const reopenable = ['closed', 'verified', 'dismissed'];
  const reopened = [];
  const blocked = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (!reopenable.includes(state)) { blocked.push({ id: f.id, reason: `state ${state} cannot be reopened` }); continue; }
    reopened.push(withHistory(f, state, 'reopened', options.actor, options.at, reason));
  }
  return { ok: blocked.length === 0, reopened, reopenedIds: reopened.map(f => f.id), blocked, error: null };
}

/**
 * Build a print-friendly batch payload for a selection (idea 52796).
 * Findings become ordered print sections with a combined plain-text
 * rendering that needs no styling to read on paper.
 * @param {Array} findings - Findings to print.
 * @param {object} [options] - { title, generatedAt }.
 * @returns {object} { title, sections, count, text, checksum }.
 */
export function buildBulkPrintPayload(findings = [], options = {}) {
  const sorted = [...(findings || [])].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.id).localeCompare(String(b.id)));
  const sections = sorted.map((f, i) => ({
    index: i + 1,
    findingId: f.id,
    heading: `${f.title || 'untitled finding'} (${sevKey(f)})`,
    state: stateOf(f),
    target: f.target || null,
    evidence: [...((f.evidence) || [])],
  }));
  const text = [`Infinity AI print batch: ${options.title || 'selected findings'}`, '', ...sections.map(s => `${s.index}. ${s.heading} — ${s.state} — ${s.target || ''}`)].join('\n');
  return { title: options.title || 'selected findings', sections, count: sections.length, text, checksum: shortHash(text) };
}

/**
 * Build the ID and URL copy payload for a selection (idea 52797).
 * Produces a plain-text block of ids, urls, or id-url pairs ready to
 * paste into tickets, chats, and reports.
 * @param {Array} findings - Findings to copy.
 * @param {object} [options] - { format, baseUrl }.
 * @returns {object} { text, ids, urls, count, format }.
 */
export function buildIdCopyPayload(findings = [], options = {}) {
  const format = ['ids', 'urls', 'pairs'].includes(String(options.format || '').toLowerCase()) ? String(options.format).toLowerCase() : 'ids';
  const base = String(options.baseUrl || 'https://dark-matter.example.com/findings').replace(/\/$/, '');
  const ids = (findings || []).map(f => f.id);
  const urls = ids.map(id => `${base}/${id}`);
  let text = '';
  if (format === 'urls') text = urls.join('\n');
  else if (format === 'pairs') text = ids.map((id, i) => `${id} ${urls[i]}`).join('\n');
  else text = ids.join('\n');
  return { text, ids, urls, count: ids.length, format };
}

/**
 * Describe the scriptable bulk-actions API surface (idea 52798).
 * The descriptor lists every bulk operation endpoint plus the job
 * tracking model scripts use to follow long-running batches.
 * @param {object} [options] - { basePath }.
 * @returns {object} { apiVersion, basePath, endpoints, jobStatuses, count }.
 */
export function describeBulkActionsApi(options = {}) {
  const basePath = String(options.basePath || '/api/v1/bulk-actions');
  const endpoints = BULK_OPERATIONS.map(op => ({
    operation: op,
    method: 'POST',
    path: `${basePath}/${op}`,
    jobPath: `${basePath}/jobs/{jobId}`,
    source: 'Infinity AI',
  }));
  return {
    apiVersion: 'v1',
    basePath,
    endpoints,
    jobStatuses: ['queued', 'running', 'completed', 'failed', 'undone'],
    count: endpoints.length,
  };
}

/**
 * Evaluate undoing a bulk operation inside its grace window (idea 52799).
 * Prior values recorded at operation time are restored when the undo
 * is requested before the window expires.
 * @param {object} operation - { action, performedAt, changes: [] }.
 * @param {object} [options] - { nowIso, graceMinutes }.
 * @returns {object} { undoable, restored, expiresAt, elapsedMinutes, graceMinutes }.
 */
export function undoBulkOperation(operation = {}, options = {}) {
  const graceMinutes = Math.max(0, Number(options.graceMinutes || 60));
  const performedMs = parseMs(operation.performedAt);
  const nowMs = parseMs(options.nowIso);
  if (performedMs === null || nowMs === null) return { undoable: false, restored: [], expiresAt: null, elapsedMinutes: 0, graceMinutes };
  const elapsedMinutes = Math.round(((nowMs - performedMs) / 60000) * 10) / 10;
  const undoable = elapsedMinutes >= 0 && elapsedMinutes <= graceMinutes;
  const restored = undoable ? (operation.changes || []).map(c => ({ findingId: c.findingId || null, field: c.field || null, restoredValue: c.before })) : [];
  return {
    undoable,
    restored,
    expiresAt: new Date(performedMs + graceMinutes * 60000).toISOString(),
    elapsedMinutes,
    graceMinutes,
  };
}

/**
 * Gate destructive bulk actions behind lead approval (idea 52800).
 * Destructive operations, large batches, and batches containing
 * critical findings require a recorded lead or admin approval.
 * @param {string} action - Bulk action name.
 * @param {object} [context] - { actorRole, count, maxSeverity, approvedBy, approverRole }.
 * @returns {object} { action, destructive, requiresApproval, allowed, reason }.
 */
export function evaluateBulkApprovalGate(action = '', context = {}) {
  const name = String(action || '').toLowerCase();
  const destructive = DESTRUCTIVE_ACTIONS.includes(name);
  const count = Number(context.count || 0);
  const reasons = [];
  if (destructive) reasons.push(`action ${name} is destructive`);
  if (count > 25) reasons.push(`batch size ${count} exceeds 25`);
  if (severityRank(context.maxSeverity) >= 4) reasons.push('batch contains critical findings');
  const requiresApproval = reasons.length > 0;
  const approverOk = Boolean(context.approvedBy) && ['lead', 'admin'].includes(String(context.approverRole || '').toLowerCase());
  const allowed = !requiresApproval || approverOk;
  return {
    action: name,
    destructive,
    requiresApproval,
    allowed,
    reason: allowed
      ? (requiresApproval ? 'approved for gated bulk action' : 'no approval gate applies')
      : `approval required: ${reasons.join('; ')}`,
  };
}
