/**
 * wave71ACore.js — bulk actions round 2 (ideas 52801–52820).
 *
 * Pure logic for bulk-action dry-run previews, post-hunt progress
 * tracking, failure handling with retry plans, the bulk-action audit
 * log, reusable bulk-action macros, scheduled bulk actions, bulk
 * permission checks, query-based and search-driven selection, diff
 * driven selection, saved selections, bulk custom-field editing,
 * finding linking and unlinking, evidence ZIP manifests, bulk
 * redaction, team assignment, escalation, info requests, and bulk
 * remediation notes. Every helper takes explicit inputs, returns a
 * structured view model, and never mutates its arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE71_A_IDEAS = [
  { id: 52801, title: 'Bulk-action dry-run preview', skip: false },
  { id: 52802, title: 'Bulk-action progress bar (post-hunt)', skip: false },
  { id: 52803, title: 'Bulk-action failure handling', skip: false },
  { id: 52804, title: 'Bulk-action audit log', skip: false },
  { id: 52805, title: 'Bulk-action macros', skip: false },
  { id: 52806, title: 'Scheduled bulk actions (post-hunt)', skip: false },
  { id: 52807, title: 'Bulk-action permissions', skip: false },
  { id: 52808, title: 'Query-based bulk select', skip: false },
  { id: 52809, title: 'Saved bulk selections', skip: false },
  { id: 52810, title: 'Bulk actions from search', skip: false },
  { id: 52811, title: 'Bulk actions from diff view', skip: false },
  { id: 52812, title: 'Bulk custom-field editing', skip: false },
  { id: 52813, title: 'Bulk finding linking', skip: false },
  { id: 52814, title: 'Bulk unlink', skip: false },
  { id: 52815, title: 'Bulk evidence ZIP', skip: false },
  { id: 52816, title: 'Bulk redaction', skip: false },
  { id: 52817, title: 'Bulk team assignment', skip: false },
  { id: 52818, title: 'Bulk escalation', skip: false },
  { id: 52819, title: 'Bulk info requests', skip: false },
  { id: 52820, title: 'Bulk remediation notes', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_LADDER = ['info', 'low', 'medium', 'high', 'critical'];
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const RETRYABLE_KINDS = ['transient', 'conflict', 'rate-limit'];
const DESTRUCTIVE_ACTIONS = ['delete', 'close', 'dismiss', 'merge', 'unlink'];
const ROLE_PERMISSIONS = {
  viewer: [],
  analyst: ['tag', 'assign-owner', 'assign-team', 'comment', 'transition', 'redact', 'link', 'export', 'schedule', 'macro'],
  lead: ['tag', 'assign-owner', 'assign-team', 'comment', 'transition', 'redact', 'link', 'export', 'schedule', 'macro', 'close', 'dismiss', 'escalate', 'delete', 'merge', 'unlink'],
  admin: ['tag', 'assign-owner', 'assign-team', 'comment', 'transition', 'redact', 'link', 'export', 'schedule', 'macro', 'close', 'dismiss', 'escalate', 'delete', 'merge', 'unlink'],
};
const MACRO_LIBRARY = {
  'triage-pack': {
    label: 'Triage pack',
    steps: [
      { type: 'add-tags', tags: ['triaged-review'] },
      { type: 'set-field', field: 'triageReviewed', value: true },
    ],
  },
  'close-verified-pack': {
    label: 'Close verified pack',
    steps: [
      { type: 'add-tags', tags: ['verified-pack'] },
      { type: 'transition', toState: 'closed', reason: 'verified closure applied by macro' },
    ],
  },
  'escalation-pack': {
    label: 'Escalation pack',
    steps: [
      { type: 'add-tags', tags: ['escalated'] },
      { type: 'set-field', field: 'priorityOverride', value: 'expedite' },
    ],
  },
};
const DEFAULT_REDACTION_RULES = [
  { name: 'email', kind: 'email', replacement: '[redacted-email]' },
  { name: 'ipv4', kind: 'ipv4', replacement: '[redacted-ip]' },
  { name: 'bearer-token', kind: 'bearer', replacement: '[redacted-token]' },
  { name: 'api-key', kind: 'api-key', replacement: '[redacted-key]' },
];

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

function normTags(list) {
  return [...new Set((list || []).map(t => String(t).toLowerCase().trim()).filter(Boolean))];
}

function withHistory(finding, from, to, actor, at, reason) {
  const entry = { from, to, actor: actor || 'system', at: at || null, reason: reason || '' };
  return { ...finding, status: to, state: to, stateEnteredAt: at || finding.stateEnteredAt || null, history: [...((finding && finding.history) || []), entry] };
}

function slugify(text) {
  return String(text || 'evidence').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'evidence';
}

/**
 * Preview a bulk action without changing anything (idea 52801).
 * The dry run walks the selection exactly as the real action would,
 * reporting per-finding field changes, blocked findings with reasons,
 * and untouched findings, while the inputs stay byte-identical.
 * @param {Array} findings - Findings the action would touch.
 * @param {object} action - { type, toState, toSeverity, owner, addTags }.
 * @param {object} [options] - { actor }.
 * @returns {object} { dryRun, action, total, wouldChange, blocked, unchangedIds, summary }.
 */
export function previewBulkActionDryRun(findings = [], action = {}, options = {}) {
  const type = String((action && action.type) || '').toLowerCase();
  const wouldChange = [];
  const blocked = [];
  const unchangedIds = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (type === 'transition') {
      const target = normState(action.toState || '');
      if (!target) { blocked.push({ id: f.id, reason: 'transition preview needs a target state' }); continue; }
      if (state === target) { unchangedIds.push(f.id); continue; }
      if (TERMINAL_STATES.includes(state) && target !== 'reopened') { blocked.push({ id: f.id, reason: `state ${state} is terminal; only reopened is allowed` }); continue; }
      wouldChange.push({ id: f.id, changes: { status: { from: state, to: target } } });
    } else if (type === 'severity') {
      const target = String(action.toSeverity || '').toLowerCase();
      if (!SEVERITIES.includes(target)) { blocked.push({ id: f.id, reason: `unknown severity "${target}"` }); continue; }
      if (sevKey(f) === target) { unchangedIds.push(f.id); continue; }
      wouldChange.push({ id: f.id, changes: { severity: { from: sevKey(f), to: target } } });
    } else if (type === 'assign-owner') {
      if (!action.owner) { blocked.push({ id: f.id, reason: 'assign-owner preview needs an owner' }); continue; }
      if (String(f.owner || '') === String(action.owner)) { unchangedIds.push(f.id); continue; }
      wouldChange.push({ id: f.id, changes: { owner: { from: f.owner || null, to: String(action.owner) } } });
    } else if (type === 'tag') {
      const add = normTags(action.addTags || action.tags);
      if (!add.length) { blocked.push({ id: f.id, reason: 'tag preview needs at least one tag' }); continue; }
      const fresh = add.filter(t => !normTags(f.tags).includes(t));
      if (!fresh.length) { unchangedIds.push(f.id); continue; }
      wouldChange.push({ id: f.id, changes: { tags: { from: normTags(f.tags), to: [...normTags(f.tags), ...fresh] } } });
    } else {
      blocked.push({ id: f.id, reason: `unsupported bulk action "${type || 'none'}"` });
    }
  }
  return {
    dryRun: true,
    action: type || 'none',
    actor: options.actor || 'system',
    total: (findings || []).length,
    wouldChange,
    blocked,
    unchangedIds,
    summary: `Infinity AI dry run: ${wouldChange.length} of ${(findings || []).length} findings would change under ${type || 'no action'}.`,
  };
}

/**
 * Build the post-hunt bulk-action progress model (idea 52802).
 * Completed, failed, and skipped items advance the bar together; the
 * estimate projects the remaining time from the observed rate.
 * @param {object} job - { label, total, completed, failed, skipped, startedAt, updatedAt }.
 * @param {string} [nowIso] - Current instant for stall detection.
 * @returns {object} { label, total, done, percent, remaining, etaSeconds, status }.
 */
export function buildBulkActionProgress(job = {}, nowIso = '') {
  const total = Math.max(0, Number(job.total || 0));
  const completed = Math.max(0, Number(job.completed || 0));
  const failed = Math.max(0, Number(job.failed || 0));
  const skipped = Math.max(0, Number(job.skipped || 0));
  const done = Math.min(total, completed + failed + skipped);
  const percent = total ? Math.round((done / total) * 1000) / 10 : 0;
  const remaining = Math.max(0, total - done);
  const startedMs = parseMs(job.startedAt);
  const updatedMs = parseMs(job.updatedAt || nowIso);
  let etaSeconds = null;
  if (startedMs !== null && updatedMs !== null && done > 0 && remaining > 0) {
    const elapsedSeconds = Math.max(0, (updatedMs - startedMs) / 1000);
    etaSeconds = Math.round((elapsedSeconds / done) * remaining);
  }
  let status = 'not-started';
  if (total > 0 && done >= total) status = failed > 0 ? 'completed-with-failures' : 'completed';
  else if (done > 0) status = 'running';
  else if (total > 0) status = 'queued';
  return {
    label: job.label || 'bulk action',
    total,
    done,
    completed,
    failed,
    skipped,
    percent,
    barWidthPercent: percent,
    remaining,
    etaSeconds,
    status,
    source: 'Infinity AI',
  };
}

/**
 * Turn bulk-action results into a failure-handling plan (idea 52803).
 * Transient and conflict failures are queued for retry with doubling
 * delays; validation and permission failures are held for a human
 * decision with the original error preserved.
 * @param {Array} results - [{ id, ok, error, errorKind }].
 * @param {object} [options] - { maxAttempts, baseDelaySeconds }.
 * @returns {object} { succeededIds, failures, retryPlan, permanent, summary }.
 */
export function planBulkFailureHandling(results = [], options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
  const baseDelay = Math.max(1, Number(options.baseDelaySeconds || 30));
  const succeededIds = [];
  const failures = [];
  for (const r of results || []) {
    if (r && r.ok) { succeededIds.push(r.id); continue; }
    failures.push({ id: (r && r.id) || null, error: (r && r.error) || 'unknown failure', errorKind: String((r && r.errorKind) || 'transient').toLowerCase() });
  }
  const retryPlan = [];
  const permanent = [];
  for (const f of failures) {
    if (RETRYABLE_KINDS.includes(f.errorKind)) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        retryPlan.push({ id: f.id, attempt, delaySeconds: Math.min(baseDelay * 2 ** (attempt - 1), 900), errorKind: f.errorKind });
      }
    } else {
      permanent.push({ id: f.id, error: f.error, errorKind: f.errorKind, action: 'hold-for-review' });
    }
  }
  return {
    succeededIds,
    failures,
    retryPlan,
    permanent,
    retryableIds: [...new Set(retryPlan.map(r => r.id))],
    summary: `Infinity AI failure plan: ${succeededIds.length} succeeded, ${retryPlan.length} retries scheduled, ${permanent.length} held for review.`,
  };
}

/**
 * Build the immutable bulk-action audit log (idea 52804).
 * Operations are sequenced in time order with a deterministic entry
 * id and a checksum over the whole log, so later edits are visible.
 * @param {Array} operations - [{ action, actor, at, findingIds, details }].
 * @param {object} [options] - { generatedAt }.
 * @returns {object} { entries, totalActions, totalFindings, actors, checksum }.
 */
export function buildBulkActionAuditLog(operations = [], options = {}) {
  const sorted = [...(operations || [])].sort((a, b) => String((a && a.at) || '').localeCompare(String((b && b.at) || '')) || String((a && a.action) || '').localeCompare(String((b && b.action) || '')));
  const entries = sorted.map((op, i) => {
    const findingIds = [...((op && op.findingIds) || [])].sort();
    return {
      seq: i + 1,
      entryId: `aud_${shortHash(`${op.action || ''}:${op.actor || ''}:${op.at || ''}:${findingIds.join(',')}`)}`,
      action: String(op.action || 'unknown'),
      actor: op.actor || 'system',
      at: op.at || null,
      findingIds,
      findingCount: findingIds.length,
      details: op.details || '',
      source: 'Infinity AI',
    };
  });
  const uniqueFindings = [...new Set(entries.flatMap(e => e.findingIds))];
  return {
    entries,
    totalActions: entries.length,
    totalFindings: uniqueFindings.length,
    actors: [...new Set(entries.map(e => e.actor))],
    checksum: shortHash(JSON.stringify(entries.map(e => [e.entryId, e.action, e.at]))),
    generatedAt: options.generatedAt || null,
  };
}

function applyMacroStep(finding, step, options) {
  if (!step || typeof step !== 'object') return { ...finding };
  if (step.type === 'add-tags') {
    return { ...finding, tags: [...new Set([...normTags(finding.tags), ...normTags(step.tags)])] };
  }
  if (step.type === 'assign-owner' || step.type === 'assign') {
    return step.owner ? { ...finding, owner: String(step.owner) } : { ...finding };
  }
  if (step.type === 'set-field' && step.field) {
    return { ...finding, [String(step.field)]: step.value };
  }
  if (step.type === 'transition') {
    const target = normState(step.toState || '');
    if (!target || stateOf(finding) === target) return { ...finding };
    if (TERMINAL_STATES.includes(stateOf(finding)) && target !== 'reopened') return { ...finding };
    return withHistory(finding, stateOf(finding), target, options.actor, options.at, step.reason || 'macro transition');
  }
  return { ...finding };
}

/**
 * Apply a reusable bulk-action macro to a selection (idea 52805).
 * A macro is an ordered list of steps (tag, assign, set-field,
 * transition) applied in sequence to every finding; named macros
 * ship in the library and ad-hoc step lists are supported too.
 * @param {Array} findings - Findings to transform.
 * @param {string|object} macro - Macro id or { id, steps }.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { macroId, label, updated, stepLog, count }.
 */
export function applyBulkActionMacro(findings = [], macro = '', options = {}) {
  const isNamed = typeof macro === 'string';
  const macroId = isNamed ? macro : String((macro && macro.id) || 'custom');
  const definition = isNamed ? MACRO_LIBRARY[macro] : macro;
  const steps = (definition && definition.steps) || [];
  const label = (definition && definition.label) || macroId;
  let updated = (findings || []).map(f => ({ ...f }));
  const stepLog = [];
  for (const step of steps) {
    let affected = 0;
    updated = updated.map(f => {
      const next = applyMacroStep(f, step, options);
      if (JSON.stringify(next) !== JSON.stringify(f)) affected += 1;
      return next;
    });
    stepLog.push({ type: step.type || 'unknown', affected });
  }
  return { macroId, label, updated, stepLog, stepCount: steps.length, count: updated.length, known: Boolean(definition) };
}

/**
 * Schedule a bulk action for a future run (idea 52806).
 * The schedule descriptor records the action, the exact finding set,
 * and the run instant; due-ness is computed against the supplied
 * current instant so the runner can pick the schedule up later.
 * @param {object} action - Bulk action descriptor.
 * @param {Array} findings - Findings covered by the schedule.
 * @param {object} [options] - { runAt, nowIso, actor }.
 * @returns {object} { ok, schedule, error }.
 */
export function scheduleBulkAction(action = {}, findings = [], options = {}) {
  const runMs = parseMs(options.runAt);
  if (runMs === null) return { ok: false, schedule: null, error: 'scheduled bulk action needs a valid runAt instant' };
  const nowMs = parseMs(options.nowIso);
  const findingIds = (findings || []).map(f => f.id);
  const dueInMinutes = nowMs === null ? null : Math.round(((runMs - nowMs) / 60000) * 10) / 10;
  const schedule = {
    scheduleId: `sch_${shortHash(`${JSON.stringify(action)}:${findingIds.join(',')}:${options.runAt}`)}`,
    action: { ...action },
    findingIds,
    findingCount: findingIds.length,
    runAt: options.runAt,
    createdAt: options.nowIso || null,
    actor: options.actor || 'system',
    status: dueInMinutes !== null && dueInMinutes <= 0 ? 'due' : 'scheduled',
    dueInMinutes,
    source: 'Infinity AI',
  };
  return { ok: true, schedule, error: null };
}

/**
 * Check whether an actor may run a bulk action (idea 52807).
 * Role permissions gate every action, destructive actions and very
 * large batches additionally require a lead or admin, and every
 * denial names the exact reason.
 * @param {object} actor - { id, role }.
 * @param {string} action - Bulk action name.
 * @param {Array} findings - Findings in the batch.
 * @param {object} [options] - { largeBatchThreshold }.
 * @returns {object} { allowed, role, action, destructive, requiresLead, deniedReasons, checkedCount }.
 */
export function evaluateBulkActionPermissions(actor = {}, action = '', findings = [], options = {}) {
  const role = String((actor && actor.role) || 'viewer').toLowerCase();
  const name = String(action || '').toLowerCase();
  const permitted = ROLE_PERMISSIONS[role] || [];
  const destructive = DESTRUCTIVE_ACTIONS.includes(name);
  const threshold = Number(options.largeBatchThreshold || 50);
  const checkedCount = (findings || []).length;
  const deniedReasons = [];
  if (!permitted.includes(name)) deniedReasons.push(`role ${role} may not run bulk action "${name}"`);
  const requiresLead = destructive || checkedCount > threshold;
  if (requiresLead && !['lead', 'admin'].includes(role)) deniedReasons.push(destructive ? `destructive action ${name} requires a lead or admin` : `batch of ${checkedCount} exceeds ${threshold} and requires a lead or admin`);
  return {
    allowed: deniedReasons.length === 0,
    actorId: (actor && actor.id) || null,
    role,
    action: name,
    destructive,
    requiresLead,
    deniedReasons,
    checkedCount,
  };
}

function tokenizeQuery(query) {
  const tokens = [];
  const raw = String(query || '');
  let current = '';
  let inQuotes = false;
  for (const ch of raw) {
    if (ch === '"') { inQuotes = !inQuotes; current += ch; continue; }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseQueryTerms(query) {
  const terms = [];
  for (const token of tokenizeQuery(query)) {
    const colon = token.indexOf(':');
    if (colon > 0) {
      const key = token.slice(0, colon).toLowerCase().replace(/^"|"$/g, '');
      const value = token.slice(colon + 1).replace(/^"|"$/g, '');
      terms.push({ key, values: value.split(',').map(v => v.toLowerCase().trim()).filter(Boolean) });
    } else {
      terms.push({ key: 'text', values: [token.replace(/^"|"$/g, '').toLowerCase()] });
    }
  }
  return terms;
}

function findingMatchesTerm(f, term) {
  if (term.key === 'severity') return term.values.includes(sevKey(f));
  if (term.key === 'state' || term.key === 'status') return term.values.includes(stateOf(f));
  if (term.key === 'target') return term.values.some(v => String(f.target || '').toLowerCase().includes(v));
  if (term.key === 'tag') return term.values.some(v => normTags(f.tags).includes(v));
  if (term.key === 'owner') return term.values.includes(String(f.owner || '').toLowerCase());
  if (term.key === 'assignee') return term.values.includes(String(f.assignee || '').toLowerCase());
  if (term.key === 'hunt') return term.values.includes(String(f.huntId || '').toLowerCase());
  const haystack = `${f.id} ${f.title || ''} ${f.target || ''} ${normTags(f.tags).join(' ')}`.toLowerCase();
  return term.values.every(v => haystack.includes(v));
}

/**
 * Select findings with a fielded query string (idea 52808).
 * Terms such as severity:critical,high state:verifying and free text
 * combine with AND semantics; comma values inside one field are OR,
 * and quoted phrases stay together as a single text term.
 * @param {Array} findings - Findings to search.
 * @param {string} query - Query string.
 * @returns {object} { matches, matchedIds, count, parsedTerms, query }.
 */
export function selectFindingsByQuery(findings = [], query = '') {
  const parsedTerms = parseQueryTerms(query);
  const matches = (findings || []).filter(f => parsedTerms.every(term => findingMatchesTerm(f, term))).map(f => ({ ...f }));
  return { matches, matchedIds: matches.map(f => f.id), count: matches.length, parsedTerms, query: String(query || '') };
}

/**
 * Save, rename, remove, and list named bulk selections (idea 52809).
 * The selection store is treated as immutable: every action returns
 * a new store array with cloned entries, ready to persist as-is.
 * @param {Array} selections - Current saved selections.
 * @param {object} action - { type, name, ids, newName, actor, at }.
 * @returns {object} { selections, active, count }.
 */
export function manageSavedSelections(selections = [], action = {}) {
  const type = String((action && action.type) || 'list').toLowerCase();
  const base = (selections || []).map(s => ({ ...s, ids: [...((s && s.ids) || [])] }));
  let active = null;
  let next = base;
  if (type === 'save' && action.name) {
    const entry = {
      name: String(action.name),
      ids: [...new Set((action.ids || []).map(String))],
      savedBy: action.actor || 'system',
      savedAt: action.at || null,
      source: 'Infinity AI',
    };
    next = [...base.filter(s => s.name !== entry.name), entry];
    active = { ...entry, ids: [...entry.ids] };
  } else if (type === 'remove' && action.name) {
    next = base.filter(s => s.name !== String(action.name));
  } else if (type === 'rename' && action.name && action.newName) {
    next = base.map(s => (s.name === String(action.name) ? { ...s, name: String(action.newName) } : s));
    active = next.find(s => s.name === String(action.newName)) || null;
  } else if (type === 'load' && action.name) {
    active = base.find(s => s.name === String(action.name)) || null;
  }
  return { selections: next, active, count: next.length };
}

/**
 * Run a bulk action straight from a search result set (idea 52810).
 * Free-text search words must all match the title, target, id, or
 * tags; the matched findings then receive the requested tag or
 * owner action while everything else passes through untouched.
 * @param {Array} findings - Findings to search.
 * @param {string} search - Free-text search.
 * @param {object} action - { type, owner, addTags }.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { matchedIds, count, updated, action }.
 */
export function applyBulkActionFromSearch(findings = [], search = '', action = {}, options = {}) {
  const words = String(search || '').toLowerCase().split(/\s+/).filter(Boolean);
  const isMatch = f => {
    const haystack = `${f.id} ${f.title || ''} ${f.target || ''} ${normTags(f.tags).join(' ')}`.toLowerCase();
    return words.every(w => haystack.includes(w));
  };
  const type = String((action && action.type) || 'tag').toLowerCase();
  const matchedIds = [];
  const updated = (findings || []).map(f => {
    if (!isMatch(f)) return { ...f };
    matchedIds.push(f.id);
    if (type === 'assign-owner' && action.owner) return { ...f, owner: String(action.owner), assignedBy: options.actor || 'system', assignedAt: options.at || null };
    const add = normTags(action.addTags || action.tags || ['from-search']);
    return { ...f, tags: [...new Set([...normTags(f.tags), ...add])], tagsUpdatedBy: options.actor || 'system', tagsUpdatedAt: options.at || null };
  });
  return { matchedIds, count: matchedIds.length, updated, action: type, search: String(search || '') };
}

/**
 * Select exactly the findings that changed between two snapshots
 * (idea 52811). Added, removed, and field-changed findings are
 * reported separately so a diff review can act on real changes only.
 * @param {Array} beforeFindings - Earlier snapshot.
 * @param {Array} afterFindings - Later snapshot.
 * @returns {object} { addedIds, removedIds, changed, changedIds, unchangedIds }.
 */
export function selectChangedFromDiff(beforeFindings = [], afterFindings = []) {
  const beforeById = new Map((beforeFindings || []).map(f => [String(f.id), f]));
  const afterById = new Map((afterFindings || []).map(f => [String(f.id), f]));
  const addedIds = [];
  const removedIds = [];
  const changed = [];
  const unchangedIds = [];
  for (const [id, after] of afterById) {
    const before = beforeById.get(id);
    if (!before) { addedIds.push(after.id); continue; }
    const fields = {};
    if (stateOf(before) !== stateOf(after)) fields.status = { from: stateOf(before), to: stateOf(after) };
    if (sevKey(before) !== sevKey(after)) fields.severity = { from: sevKey(before), to: sevKey(after) };
    if (String(before.owner || '') !== String(after.owner || '')) fields.owner = { from: before.owner || null, to: after.owner || null };
    if (String(before.title || '') !== String(after.title || '')) fields.title = { from: before.title || null, to: after.title || null };
    if (Object.keys(fields).length) changed.push({ id: after.id, fields });
    else unchangedIds.push(after.id);
  }
  for (const [id, before] of beforeById) {
    if (!afterById.has(id)) removedIds.push(before.id);
  }
  return {
    addedIds,
    removedIds,
    changed,
    changedIds: changed.map(c => c.id),
    unchangedIds,
    summary: `Infinity AI diff: ${addedIds.length} added, ${removedIds.length} removed, ${changed.length} changed, ${unchangedIds.length} unchanged.`,
  };
}

const CUSTOM_FIELD_NAME = /^[a-z][a-z0-9_]*$/i;

/**
 * Edit custom fields across a selection (idea 52812).
 * Shared edits apply to every finding, per-finding overrides win over
 * the shared value, and field names are validated so typos surface
 * as errors instead of silently writing junk fields.
 * @param {Array} findings - Findings to edit.
 * @param {object} edits - { field: value, byId: { id: { field: value } } }.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { updated, changedIds, fieldsApplied, errors }.
 */
export function bulkEditCustomFields(findings = [], edits = {}, options = {}) {
  const byId = (edits && edits.byId) || {};
  const shared = {};
  for (const [k, v] of Object.entries(edits || {})) {
    if (k !== 'byId') shared[k] = v;
  }
  const errors = [];
  const fieldsApplied = new Set();
  const changedIds = [];
  const updated = (findings || []).map(f => {
    const merged = { ...shared, ...((byId && byId[f.id]) || {}) };
    const customFields = { ...((f && f.customFields) || {}) };
    let touched = false;
    for (const [field, value] of Object.entries(merged)) {
      if (!CUSTOM_FIELD_NAME.test(field)) { errors.push({ id: f.id, field, reason: 'invalid custom field name' }); continue; }
      if (JSON.stringify(customFields[field]) !== JSON.stringify(value)) touched = true;
      customFields[field] = value;
      fieldsApplied.add(field);
    }
    if (touched) changedIds.push(f.id);
    return { ...f, customFields, customFieldsUpdatedBy: options.actor || 'system', customFieldsUpdatedAt: options.at || null };
  });
  return { updated, changedIds, fieldsApplied: [...fieldsApplied].sort(), errors };
}

/**
 * Link findings to a target under one relation (idea 52813).
 * Each finding records the link once; when the target is itself in
 * the selection, the reverse link is written too so navigation works
 * from both sides.
 * @param {Array} findings - Findings receiving links.
 * @param {object} linkSpec - { relation, targetId }.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { updated, linkedIds, linkCount, relation }.
 */
export function bulkLinkFindings(findings = [], linkSpec = {}, options = {}) {
  const relation = String((linkSpec && linkSpec.relation) || 'related').toLowerCase();
  const targetId = (linkSpec && linkSpec.targetId) || null;
  const linkedIds = [];
  let linkCount = 0;
  const updated = (findings || []).map(f => {
    if (!targetId || String(f.id) === String(targetId)) return { ...f, links: [...((f.links) || [])] };
    const links = [...((f.links) || [])];
    if (!links.some(l => l.relation === relation && String(l.targetId) === String(targetId))) {
      links.push({ relation, targetId: String(targetId), linkedBy: options.actor || 'system', at: options.at || null });
      linkCount += 1;
    }
    linkedIds.push(f.id);
    return { ...f, links };
  });
  const withReverse = updated.map(f => {
    if (String(f.id) !== String(targetId)) return f;
    const links = [...((f.links) || [])];
    for (const other of updated) {
      if (String(other.id) === String(targetId)) continue;
      if (!links.some(l => l.relation === relation && String(l.targetId) === String(other.id))) {
        links.push({ relation, targetId: String(other.id), linkedBy: options.actor || 'system', at: options.at || null });
        linkCount += 1;
      }
    }
    return { ...f, links };
  });
  return { updated: withReverse, linkedIds, linkCount, relation };
}

/**
 * Remove links across a selection (idea 52814).
 * Links are filtered by relation, by target, or both; with neither
 * filter every link is removed. Findings keep all other data intact.
 * @param {Array} findings - Findings to unlink.
 * @param {object} [options] - { relation, targetId }.
 * @returns {object} { updated, affectedIds, unlinkedCount }.
 */
export function bulkUnlinkFindings(findings = [], options = {}) {
  const relation = options.relation ? String(options.relation).toLowerCase() : null;
  const targetId = options.targetId ? String(options.targetId) : null;
  let unlinkedCount = 0;
  const affectedIds = [];
  const updated = (findings || []).map(f => {
    const before = (f.links) || [];
    const links = before.filter(l => {
      const dropRelation = !relation || String(l.relation || '').toLowerCase() === relation;
      const dropTarget = !targetId || String(l.targetId) === targetId;
      return !(dropRelation && dropTarget);
    });
    const removed = before.length - links.length;
    if (removed > 0) { unlinkedCount += removed; affectedIds.push(f.id); }
    return { ...f, links };
  });
  return { updated, affectedIds, unlinkedCount };
}

/**
 * Describe the evidence ZIP archive for a selection (idea 52815).
 * The manifest lists every archive entry with its path, byte size,
 * and checksum, plus archive totals, so the bundle can be verified
 * before anything is downloaded or shared.
 * @param {Array} findings - Findings with evidence.
 * @param {object} [options] - { archiveName, generatedAt }.
 * @returns {object} { archiveName, entries, fileCount, totalBytes, findingsCovered, manifestChecksum }.
 */
export function buildEvidenceZipManifest(findings = [], options = {}) {
  const entries = [];
  for (const f of findings || []) {
    ((f.evidence) || []).forEach((ev, i) => {
      const isObject = ev && typeof ev === 'object';
      const name = isObject ? String(ev.name || `evidence-${i + 1}`) : slugify(ev);
      const content = isObject ? String(ev.content || ev.name || '') : String(ev);
      const sizeBytes = isObject && Number(ev.sizeBytes) ? Number(ev.sizeBytes) : content.length;
      const path = `evidence/${f.id}/${String(i + 1).padStart(2, '0')}-${slugify(name)}.txt`;
      entries.push({ path, findingId: f.id, sizeBytes, checksum: shortHash(`${path}:${content}:${sizeBytes}`) });
    });
  }
  const totalBytes = entries.reduce((a, e) => a + e.sizeBytes, 0);
  return {
    archiveName: options.archiveName || 'evidence-bundle.zip',
    entries,
    fileCount: entries.length,
    totalBytes,
    findingsCovered: (findings || []).length,
    manifestChecksum: shortHash(JSON.stringify(entries.map(e => [e.path, e.checksum]))),
    generatedBy: 'Infinity AI',
    generatedAt: options.generatedAt || null,
  };
}

function redactText(text, rules) {
  let out = String(text || '');
  const counts = {};
  for (const rule of rules) {
    let pattern = null;
    if (rule.kind === 'email') pattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    else if (rule.kind === 'ipv4') pattern = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
    else if (rule.kind === 'bearer') pattern = /\bBearer\s+[A-Za-z0-9._-]{8,}/g;
    else if (rule.kind === 'api-key') pattern = /\b(?:sk|ghp|key|token)[-_][A-Za-z0-9]{8,}\b/g;
    else if (rule.kind === 'literal' && rule.find) {
      const hits = out.split(String(rule.find)).length - 1;
      if (hits) { counts[rule.name] = (counts[rule.name] || 0) + hits; out = out.split(String(rule.find)).join(rule.replacement || '[redacted]'); }
      continue;
    }
    if (!pattern) continue;
    const hits = (out.match(pattern) || []).length;
    if (hits) { counts[rule.name] = (counts[rule.name] || 0) + hits; out = out.replace(pattern, rule.replacement || '[redacted]'); }
  }
  return { text: out, counts };
}

/**
 * Apply redaction rules across a selection (idea 52816).
 * Emails, addresses, bearer tokens, and API keys are replaced in
 * titles, evidence, and notes; literal rules cover case-specific
 * strings, and every replacement is counted per rule.
 * @param {Array} findings - Findings to redact.
 * @param {Array} [rules] - Redaction rules; defaults cover common leaks.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { updated, totalRedactions, byRule, affectedIds }.
 */
export function applyBulkRedaction(findings = [], rules = [], options = {}) {
  const active = (rules && rules.length) ? rules : DEFAULT_REDACTION_RULES;
  const byRule = {};
  let totalRedactions = 0;
  const affectedIds = [];
  const updated = (findings || []).map(f => {
    const merge = counts => { for (const [k, v] of Object.entries(counts)) { byRule[k] = (byRule[k] || 0) + v; totalRedactions += v; } };
    const title = redactText(f.title || '', active);
    merge(title.counts);
    const evidence = ((f.evidence) || []).map(ev => {
      if (typeof ev === 'string') { const r = redactText(ev, active); merge(r.counts); return r.text; }
      if (ev && typeof ev === 'object' && ev.content) { const r = redactText(ev.content, active); merge(r.counts); return { ...ev, content: r.text }; }
      return ev;
    });
    const notes = redactText(f.notes || f.description || '', active);
    merge(notes.counts);
    const changed = title.text !== String(f.title || '') || JSON.stringify(evidence) !== JSON.stringify(f.evidence || []) || notes.text !== String(f.notes || f.description || '');
    if (changed) affectedIds.push(f.id);
    return { ...f, title: title.text, evidence, notes: notes.text, redactedBy: options.actor || 'system', redactedAt: options.at || null };
  });
  return { updated, totalRedactions, byRule, affectedIds };
}

/**
 * Assign a selection to teams, sharing work evenly (idea 52817).
 * A team name applies to all, a team list is dealt round-robin, and
 * a severity map routes critical work to the right team; when team
 * rosters are supplied a member is dealt inside each team too.
 * @param {Array} findings - Findings to assign.
 * @param {string|Array|object} teamSpec - Team, team list, or severity map.
 * @param {object} [options] - { actor, at, rosters: { team: [members] } }.
 * @returns {object} { updated, assignments, count, byTeam }.
 */
export function bulkAssignTeams(findings = [], teamSpec = null, options = {}) {
  const rosters = (options && options.rosters) || {};
  const memberCursor = {};
  const assignments = [];
  const byTeam = {};
  const updated = (findings || []).map((f, i) => {
    let team = null;
    if (typeof teamSpec === 'string' && teamSpec) team = teamSpec;
    else if (Array.isArray(teamSpec) && teamSpec.length) team = String(teamSpec[i % teamSpec.length]);
    else if (teamSpec && typeof teamSpec === 'object') team = teamSpec[sevKey(f)] || teamSpec[f.id] || teamSpec.default || null;
    if (!team) return { ...f };
    const roster = (rosters[team] || []).map(String).filter(Boolean);
    let member = f.assignee || null;
    if (roster.length) {
      memberCursor[team] = memberCursor[team] || 0;
      member = roster[memberCursor[team] % roster.length];
      memberCursor[team] += 1;
    }
    assignments.push({ id: f.id, team, member });
    byTeam[team] = (byTeam[team] || 0) + 1;
    return { ...f, team, assignee: member, teamAssignedBy: options.actor || 'system', teamAssignedAt: options.at || null };
  });
  return { updated, assignments, count: assignments.length, byTeam };
}

/**
 * Escalate a selection with severity bumps (idea 52818).
 * Each finding gains an escalation level and, unless already
 * critical, a one-step severity bump; terminal findings are blocked
 * and the escalation target follows the new severity.
 * @param {Array} findings - Findings to escalate.
 * @param {object} [options] - { reason, actor, at }.
 * @returns {object} { ok, escalated, escalatedIds, blocked, error }.
 */
export function bulkEscalateFindings(findings = [], options = {}) {
  const reason = String(options.reason || '').trim();
  if (reason.length < 3) return { ok: false, escalated: [], escalatedIds: [], blocked: [], error: 'bulk escalation requires a documented reason' };
  const escalateTo = { critical: 'security-lead', high: 'team-lead', medium: 'triage-lead', low: 'triage-lead', info: 'triage-lead' };
  const escalated = [];
  const blocked = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (TERMINAL_STATES.includes(state)) { blocked.push({ id: f.id, reason: `state ${state} is terminal and cannot be escalated` }); continue; }
    const current = sevKey(f);
    const idx = SEVERITY_LADDER.indexOf(current);
    const bumped = current === 'critical' ? current : SEVERITY_LADDER[Math.min(idx + 1, SEVERITY_LADDER.length - 1)];
    const moved = withHistory(f, state, state, options.actor, options.at, `escalated: ${reason}`);
    escalated.push({
      ...moved,
      severity: bumped,
      previousSeverity: current,
      escalationLevel: Number(f.escalationLevel || 0) + 1,
      escalatedTo: escalateTo[bumped],
      escalationReason: reason,
    });
  }
  return { ok: blocked.length === 0, escalated, escalatedIds: escalated.map(f => f.id), blocked, error: null };
}

/**
 * Open information requests across a selection (idea 52819).
 * Every finding receives its own request with the shared question
 * set and due instant, and the finding is flagged as awaiting info
 * without losing its lifecycle position.
 * @param {Array} findings - Findings needing more information.
 * @param {object} [options] - { questions, requestedBy, at, dueAt }.
 * @returns {object} { ok, requests, updated, count, error }.
 */
export function bulkRequestInfo(findings = [], options = {}) {
  const questions = (options.questions || []).map(q => String(q)).filter(Boolean);
  if (!questions.length) return { ok: false, requests: [], updated: [], count: 0, error: 'bulk info request needs at least one question' };
  const requests = [];
  const updated = (findings || []).map(f => {
    const request = {
      requestId: `info_${shortHash(`${f.id}:${questions.join('|')}:${options.at || ''}`)}`,
      findingId: f.id,
      questions: [...questions],
      status: 'open',
      requestedBy: options.requestedBy || 'system',
      requestedAt: options.at || null,
      dueAt: options.dueAt || null,
      source: 'Infinity AI',
    };
    requests.push(request);
    return { ...f, infoRequest: request, awaitingInfo: true };
  });
  return { ok: true, requests, updated, count: requests.length, error: null };
}

/**
 * Append remediation notes across a selection (idea 52820).
 * One shared note, per-severity notes, or per-finding notes are
 * appended without duplicating an identical existing note, so the
 * remediation trail stays readable.
 * @param {Array} findings - Findings receiving notes.
 * @param {string|object} notes - Shared note, severity map, or id map.
 * @param {object} [options] - { actor, at }.
 * @returns {object} { updated, notedIds, count }.
 */
export function bulkAddRemediationNotes(findings = [], notes = '', options = {}) {
  const notedIds = [];
  const updated = (findings || []).map(f => {
    let note = '';
    if (typeof notes === 'string') note = notes;
    else if (notes && typeof notes === 'object') note = notes[f.id] || notes[sevKey(f)] || notes.default || '';
    note = String(note || '').trim();
    const existing = [...((f.remediationNotes) || [])];
    if (!note || existing.some(n => String(n && n.text || n) === note)) return { ...f, remediationNotes: existing };
    notedIds.push(f.id);
    return { ...f, remediationNotes: [...existing, { text: note, author: options.actor || 'system', at: options.at || null }] };
  });
  return { updated, notedIds, count: notedIds.length };
}
