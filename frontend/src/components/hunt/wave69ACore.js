/**
 * wave69ACore.js — finding lifecycle states part 1 (ideas 52721–52740).
 *
 * Pure logic for bulk transitions, the state SLA engine, the Kanban
 * lifecycle board, state timelines, required transition reasons, the
 * transition undo window, the parking, duplicate, risk-acceptance,
 * deferred, and blocked-on-vendor states, verified-versus-closed
 * separation, reopened-with-context, retest-driven auto-transitions,
 * transition webhooks, the lifecycle REST API, smart state views,
 * state-triggered emails, state-filtered exports, and state aging
 * analytics. Every builder takes findings and explicit timestamps and
 * returns a real structured view model; inputs are never mutated.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE69_A_IDEAS = [
  { id: 52721, title: 'Bulk transitions with preview', skip: false },
  { id: 52722, title: 'State SLA engine', skip: false },
  { id: 52723, title: 'Kanban lifecycle board', skip: false },
  { id: 52724, title: 'Finding state timeline', skip: false },
  { id: 52725, title: 'Required transition reasons', skip: false },
  { id: 52726, title: 'Transition undo window', skip: false },
  { id: 52727, title: '"Awaiting info" parking state', skip: false },
  { id: 52728, title: 'Duplicate-linking state', skip: false },
  { id: 52729, title: 'Risk-acceptance with expiry', skip: false },
  { id: 52730, title: 'Deferred-to-date state', skip: false },
  { id: 52731, title: 'Blocked-on-vendor state', skip: false },
  { id: 52732, title: 'Verified vs closed separation', skip: false },
  { id: 52733, title: 'Reopened-with-context state', skip: false },
  { id: 52734, title: 'Retest-driven auto-transitions', skip: false },
  { id: 52735, title: 'Transition webhooks', skip: false },
  { id: 52736, title: 'Lifecycle REST API', skip: false },
  { id: 52737, title: 'Smart state views', skip: false },
  { id: 52738, title: 'State-triggered emails', skip: false },
  { id: 52739, title: 'State-filtered exports', skip: false },
  { id: 52740, title: 'State aging analytics', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITY_WEIGHT = { critical: 25, high: 10, medium: 4, low: 1, info: 0.5 };
const LIFECYCLE_STATES = ['new', 'triaged', 'confirmed', 'assigned', 'fixing', 'verifying', 'verified', 'closed', 'dismissed', 'awaiting-info', 'duplicate', 'risk-accepted', 'deferred', 'blocked-vendor', 'reopened'];
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const REASON_REQUIRED_TARGETS = ['dismissed', 'risk-accepted', 'deferred', 'reopened', 'duplicate', 'blocked-vendor', 'awaiting-info'];

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

function ageHoursOf(f, nowMs) {
  const entered = parseMs((f && (f.stateEnteredAt || f.createdAt)) || '');
  if (entered === null || nowMs === null) return 0;
  return Math.max(0, Math.round(((nowMs - entered) / 3600000) * 10) / 10);
}

function withHistory(finding, from, to, actor, at, reason) {
  const entry = { from, to, actor: actor || 'system', at: at || null, reason: reason || '' };
  return { ...finding, status: to, state: to, stateEnteredAt: at || finding.stateEnteredAt || null, history: [...((finding && finding.history) || []), entry] };
}

/**
 * Preview a bulk transition before applying it (idea 52721).
 * Each finding is checked against the lifecycle table and terminal-state
 * rules so reviewers see exactly which items can move and why the rest
 * cannot, without changing any finding.
 * @param {Array} findings - Findings to move.
 * @param {string} toState - Desired target state.
 * @param {object} [actor] - { id, role }.
 * @returns {object} { toState, total, okCount, blockedCount, preview, summary }.
 */
export function previewBulkTransition(findings = [], toState = '', actor = {}) {
  const target = normState(toState);
  const known = LIFECYCLE_STATES.includes(target);
  const preview = (findings || []).map(f => {
    const from = stateOf(f);
    let ok = true;
    let reason = 'ready';
    if (!known) { ok = false; reason = `unknown target state "${target}"`; }
    else if (from === target) { ok = false; reason = `already in ${target}`; }
    else if (TERMINAL_STATES.includes(from) && target !== 'reopened') { ok = false; reason = `state ${from} is terminal; only reopened is allowed`; }
    return { id: f.id, from, to: target, ok, reason };
  });
  const okCount = preview.filter(p => p.ok).length;
  return {
    toState: target,
    actor: (actor && (actor.id || actor.role)) || 'system',
    total: preview.length,
    okCount,
    blockedCount: preview.length - okCount,
    preview,
    summary: `Infinity AI preview: ${okCount}/${preview.length} ready to move to ${target || 'unknown'}.`,
  };
}

/**
 * Evaluate per-state SLA clocks for findings (idea 52722).
 * Age is measured from stateEnteredAt (falling back to createdAt) against
 * each finding's slaHours budget at the supplied instant.
 * @param {Array} findings - Findings with stateEnteredAt and slaHours.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @returns {object} { items, breachedIds, atRiskIds, breachedCount, total }.
 */
export function evaluateStateSla(findings = [], nowIso = '') {
  const nowMs = parseMs(nowIso);
  const items = (findings || []).map(f => {
    const ageHours = ageHoursOf(f, nowMs);
    const slaHours = Math.max(1, Number(f.slaHours || 72));
    const remainingHours = Math.round((slaHours - ageHours) * 10) / 10;
    const breached = ageHours > slaHours;
    const atRisk = !breached && remainingHours <= slaHours * 0.25;
    return { id: f.id, state: stateOf(f), severity: sevKey(f), ageHours, slaHours, remainingHours, breached, atRisk };
  }).sort((a, b) => Number(b.breached) - Number(a.breached) || a.remainingHours - b.remainingHours);
  return {
    items,
    breachedIds: items.filter(i => i.breached).map(i => i.id),
    atRiskIds: items.filter(i => i.atRisk).map(i => i.id),
    breachedCount: items.filter(i => i.breached).length,
    total: items.length,
  };
}

/**
 * Build the Kanban lifecycle board (idea 52723).
 * Findings are grouped into one column per lifecycle state, ordered by
 * severity inside each column, with per-column critical counts.
 * @param {Array} findings - Findings to place on the board.
 * @returns {object} { columns, countsByState, total, columnCount }.
 */
export function buildLifecycleBoard(findings = []) {
  const columns = LIFECYCLE_STATES.map(state => {
    const rows = (findings || []).filter(f => stateOf(f) === state)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0));
    return {
      state,
      findings: rows.map(f => f.id),
      count: rows.length,
      criticals: rows.filter(f => sevKey(f) === 'critical').length,
    };
  });
  const countsByState = {};
  for (const c of columns) countsByState[c.state] = c.count;
  return { columns, countsByState, total: (findings || []).length, columnCount: columns.length };
}

/**
 * Build the state timeline for one finding (idea 52724).
 * History entries are ordered by timestamp and enriched with the dwell
 * time spent in each state before the next transition.
 * @param {object} finding - Finding with history entries.
 * @returns {object} { findingId, currentState, events, eventCount, statesVisited }.
 */
export function buildStateTimeline(finding = {}) {
  const history = [...((finding && finding.history) || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const events = history.map((h, i) => {
    const start = parseMs(h.at);
    const next = history[i + 1] ? parseMs(history[i + 1].at) : null;
    const durationHours = start !== null && next !== null ? Math.round(((next - start) / 3600000) * 10) / 10 : null;
    return { from: normState(h.from || ''), to: normState(h.to || ''), actor: h.actor || 'system', at: h.at || null, reason: h.reason || '', durationHours };
  });
  const visited = [];
  for (const e of events) if (e.to && !visited.includes(e.to)) visited.push(e.to);
  return { findingId: finding.id || null, currentState: stateOf(finding), events, eventCount: events.length, statesVisited: visited };
}

/**
 * Validate that a transition carries a required reason (idea 52725).
 * Parking, dismissal, deferral, risk acceptance, duplication, vendor
 * blocking, and reopening all demand a recorded reason of real content.
 * @param {string} from - Current state.
 * @param {string} to - Desired state.
 * @param {string} reason - Supplied reason text.
 * @param {object} [policy] - { requiredTargets: [] } override.
 * @returns {object} { allowed, required, from, to, reason, message }.
 */
export function validateTransitionReason(from = '', to = '', reason = '', policy = {}) {
  const f = normState(from);
  const t = normState(to);
  const requiredTargets = (policy.requiredTargets || REASON_REQUIRED_TARGETS).map(normState);
  const required = requiredTargets.includes(t);
  const text = String(reason || '').trim();
  const hasReason = text.length >= 3;
  const allowed = !required || hasReason;
  return {
    allowed,
    required,
    from: f,
    to: t,
    reason: text,
    message: allowed
      ? (required ? `Reason recorded for ${f} -> ${t}.` : `No reason required for ${f} -> ${t}.`)
      : `Transition ${f} -> ${t} requires a reason of at least 3 characters.`,
  };
}

/**
 * Evaluate whether a transition can still be undone (idea 52726).
 * The undo window is measured from the history entry timestamp at the
 * supplied instant; no wall clock is read inside this module.
 * @param {object} entry - History entry with at.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @param {number} [windowMinutes] - Undo window length.
 * @returns {object} { undoable, elapsedMinutes, remainingMinutes, expiresAt, windowMinutes }.
 */
export function evaluateUndoWindow(entry = {}, nowIso = '', windowMinutes = 30) {
  const win = Math.max(0, Number(windowMinutes || 30));
  const atMs = parseMs(entry.at);
  const nowMs = parseMs(nowIso);
  if (atMs === null || nowMs === null) {
    return { undoable: false, elapsedMinutes: 0, remainingMinutes: 0, expiresAt: null, windowMinutes: win };
  }
  const elapsedMinutes = Math.round(((nowMs - atMs) / 60000) * 10) / 10;
  const remainingMinutes = Math.max(0, Math.round((win - elapsedMinutes) * 10) / 10);
  return {
    undoable: elapsedMinutes >= 0 && elapsedMinutes <= win,
    elapsedMinutes,
    remainingMinutes,
    expiresAt: new Date(atMs + win * 60000).toISOString(),
    windowMinutes: win,
  };
}

/**
 * Park a finding in the awaiting-info state (idea 52727).
 * The previous state is preserved in history so the finding can resume
 * exactly where it stopped once the requested information arrives.
 * @param {object} finding - Finding to park.
 * @param {object} options - { actor, at, infoRequested }.
 * @returns {object} { ok, finding, previousState, infoRequested, error }.
 */
export function parkFindingForInfo(finding = {}, options = {}) {
  const from = stateOf(finding);
  if (TERMINAL_STATES.includes(from)) {
    return { ok: false, finding, previousState: from, infoRequested: options.infoRequested || '', error: `cannot park a finding in terminal state ${from}` };
  }
  const infoRequested = String(options.infoRequested || '').trim();
  const parked = withHistory(finding, from, 'awaiting-info', options.actor, options.at, infoRequested || 'awaiting information');
  return { ok: true, finding: { ...parked, infoRequested }, previousState: from, infoRequested, error: null };
}

/**
 * Link a finding as a duplicate of a canonical finding (idea 52728).
 * The duplicate keeps its own evidence and history while pointing at
 * the canonical record that carries the fix.
 * @param {object} finding - Duplicate candidate.
 * @param {object} canonical - Canonical finding (or { id }).
 * @param {object} [options] - { actor, at, canonicalId }.
 * @returns {object} { ok, finding, canonicalId, error }.
 */
export function linkDuplicateFinding(finding = {}, canonical = {}, options = {}) {
  const canonicalId = options.canonicalId || canonical.id || null;
  if (!canonicalId) return { ok: false, finding, canonicalId: null, error: 'a canonical finding id is required' };
  if (finding.id && String(finding.id) === String(canonicalId)) return { ok: false, finding, canonicalId, error: 'a finding cannot be a duplicate of itself' };
  const from = stateOf(finding);
  const linked = withHistory(finding, from, 'duplicate', options.actor, options.at, `duplicate of ${canonicalId}`);
  return { ok: true, finding: { ...linked, canonicalId }, canonicalId, error: null };
}

/**
 * Accept risk for a finding until an expiry instant (idea 52729).
 * Acceptance without an expiry, or one already past at evaluation
 * time, is refused so accepted risk can never silently become permanent.
 * @param {object} finding - Finding to accept.
 * @param {object} options - { acceptedBy, expiresAt, nowIso, actor, at, reason }.
 * @returns {object} { ok, expired, finding, expiresAt, acceptedBy, error }.
 */
export function acceptRiskWithExpiry(finding = {}, options = {}) {
  const expiresAt = options.expiresAt || null;
  if (!expiresAt || parseMs(expiresAt) === null) {
    return { ok: false, expired: false, finding, expiresAt, acceptedBy: options.acceptedBy || null, error: 'risk acceptance requires a valid expiry' };
  }
  const nowMs = parseMs(options.nowIso);
  const expired = nowMs !== null && parseMs(expiresAt) <= nowMs;
  if (expired) {
    return { ok: false, expired: true, finding, expiresAt, acceptedBy: options.acceptedBy || null, error: 'risk acceptance expiry has already passed' };
  }
  const from = stateOf(finding);
  const accepted = withHistory(finding, from, 'risk-accepted', options.actor || options.acceptedBy, options.at || options.nowIso, options.reason || 'risk accepted');
  return { ok: true, expired: false, finding: { ...accepted, riskAcceptedBy: options.acceptedBy || null, riskExpiresAt: expiresAt }, expiresAt, acceptedBy: options.acceptedBy || null, error: null };
}

/**
 * Defer a finding to a future date (idea 52730).
 * Deferred work carries an explicit review date; once that date is
 * reached at evaluation time the finding is flagged due for review.
 * @param {object} finding - Finding to defer.
 * @param {object} options - { deferredUntil, nowIso, actor, at, reason }.
 * @returns {object} { ok, finding, deferredUntil, dueForReview, error }.
 */
export function deferFindingToDate(finding = {}, options = {}) {
  const deferredUntil = options.deferredUntil || null;
  if (!deferredUntil || parseMs(deferredUntil) === null) {
    return { ok: false, finding, deferredUntil, dueForReview: false, error: 'deferral requires a valid review date' };
  }
  const nowMs = parseMs(options.nowIso);
  const dueForReview = nowMs !== null && parseMs(deferredUntil) <= nowMs;
  const from = stateOf(finding);
  const deferred = withHistory(finding, from, 'deferred', options.actor, options.at || options.nowIso, options.reason || 'deferred');
  return { ok: true, finding: { ...deferred, deferredUntil }, deferredUntil, dueForReview, error: null };
}

/**
 * Block a finding on a vendor ticket (idea 52731).
 * Blocking requires the external vendor ticket reference so the wait
 * is traceable outside Infinity AI.
 * @param {object} finding - Finding to block.
 * @param {object} options - { vendorTicket, vendor, actor, at }.
 * @returns {object} { ok, finding, vendorTicket, error }.
 */
export function blockFindingOnVendor(finding = {}, options = {}) {
  const vendorTicket = String(options.vendorTicket || finding.vendorTicket || '').trim();
  if (!vendorTicket) return { ok: false, finding, vendorTicket: '', error: 'blocking on a vendor requires a vendor ticket reference' };
  const from = stateOf(finding);
  const blocked = withHistory(finding, from, 'blocked-vendor', options.actor, options.at, `blocked on vendor ticket ${vendorTicket}`);
  return { ok: true, finding: { ...blocked, vendorTicket, vendor: options.vendor || finding.vendor || null }, vendorTicket, error: null };
}

/**
 * Separate verified findings from closed findings (idea 52732).
 * Verification proves the fix works; closure is the administrative
 * finish. This view keeps the two apart and flags closures that never
 * passed through verification.
 * @param {Array} findings - Findings to separate.
 * @returns {object} { verifiedNotClosed, closedWithoutVerification, verifiedCount, closedCount, needsClosureCount }.
 */
export function evaluateVerifiedVsClosed(findings = []) {
  const verifiedNotClosed = [];
  const closedWithoutVerification = [];
  let verifiedCount = 0;
  let closedCount = 0;
  for (const f of findings || []) {
    const state = stateOf(f);
    const historyStates = ((f && f.history) || []).map(h => normState(h.to || ''));
    const passedVerification = state === 'verified' || Boolean(f.verifiedBy) || historyStates.includes('verified');
    if (state === 'verified') { verifiedCount += 1; verifiedNotClosed.push(f.id); }
    if (state === 'closed') {
      closedCount += 1;
      if (!passedVerification) closedWithoutVerification.push(f.id);
    }
  }
  return { verifiedNotClosed, closedWithoutVerification, verifiedCount, closedCount, needsClosureCount: verifiedNotClosed.length };
}

/**
 * Reopen a finding with its prior context preserved (idea 52733).
 * The fix note, verification evidence, and full history travel with
 * the reopened finding so the next fix attempt starts informed.
 * @param {object} finding - Finding to reopen.
 * @param {object} options - { actor, at, reason }.
 * @returns {object} { ok, finding, previousState, preservedContext, error }.
 */
export function reopenFindingWithContext(finding = {}, options = {}) {
  const from = stateOf(finding);
  if (!['closed', 'verified', 'dismissed'].includes(from)) {
    return { ok: false, finding, previousState: from, preservedContext: null, error: `only closed, verified, or dismissed findings can be reopened; finding is ${from}` };
  }
  const preservedContext = {
    previousState: from,
    fixNote: finding.fixNote || null,
    verificationEvidence: finding.verificationEvidence || null,
    verifiedBy: finding.verifiedBy || null,
    closedBy: finding.closedBy || null,
    historyLength: ((finding.history) || []).length,
  };
  const reopened = withHistory(finding, from, 'reopened', options.actor, options.at, options.reason || 'reopened with context');
  return { ok: true, finding: { ...reopened, reopenContext: preservedContext }, previousState: from, preservedContext, error: null };
}

/**
 * Apply a retest outcome as an automatic transition (idea 52734).
 * A passed retest moves Verifying to Verified; a failed retest
 * reopens the finding with the retest evidence attached.
 * @param {object} finding - Finding under retest.
 * @param {object} retest - { outcome, at, actor, evidence }.
 * @returns {object} { ok, changed, from, to, finding }.
 */
export function applyRetestResult(finding = {}, retest = {}) {
  const from = stateOf(finding);
  const outcome = String(retest.outcome || '').toLowerCase();
  if (from !== 'verifying' || !['passed', 'failed'].includes(outcome)) {
    return { ok: false, changed: false, from, to: from, finding };
  }
  const to = outcome === 'passed' ? 'verified' : 'reopened';
  const evidence = [...((finding.evidence) || [])];
  if (retest.evidence) evidence.push(retest.evidence);
  const moved = withHistory(finding, from, to, retest.actor, retest.at, `retest ${outcome}`);
  const next = { ...moved, evidence };
  if (outcome === 'passed') { next.verifiedBy = retest.actor || finding.verifiedBy || null; next.verificationEvidence = retest.evidence || finding.verificationEvidence || null; }
  return { ok: true, changed: true, from, to, finding: next };
}

/**
 * Build transition webhook payloads (idea 52735).
 * Each lifecycle transition becomes a signed-reference payload for the
 * configured endpoint, filtered to the subscribed target states.
 * @param {Array} transitions - [{ findingId, from, to, actor, at }].
 * @param {object} config - { url, states: [] }.
 * @returns {object} { webhooks, count, endpoint }.
 */
export function buildTransitionWebhooks(transitions = [], config = {}) {
  const endpoint = config.url || null;
  const wanted = (config.states || []).map(normState);
  const webhooks = (transitions || [])
    .filter(t => !wanted.length || wanted.includes(normState(t.to)))
    .map(t => {
      const body = { findingId: t.findingId || null, from: normState(t.from || ''), to: normState(t.to || ''), actor: t.actor || 'system', at: t.at || null };
      return {
        id: `wh_${shortHash(`${body.findingId}:${body.from}->${body.to}:${body.at}`)}`,
        event: `finding.${body.to}`,
        endpoint,
        source: 'Infinity AI',
        payload: body,
      };
    });
  return { webhooks, count: webhooks.length, endpoint };
}

/**
 * Serve findings through the lifecycle REST API shape (idea 52736).
 * Applies state and severity filters, severity sorting, and pagination
 * so API clients can page the whole lifecycle deterministically.
 * @param {Array} findings - Findings behind the API.
 * @param {object} query - { state, severity, page, pageSize, sort }.
 * @returns {object} { total, page, pageSize, pages, items }.
 */
export function buildLifecycleApiResponse(findings = [], query = {}) {
  let items = [...(findings || [])];
  if (query.state) items = items.filter(f => stateOf(f) === normState(query.state));
  if (query.severity) items = items.filter(f => sevKey(f) === String(query.severity).toLowerCase());
  if (query.sort === 'severity') items.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0));
  if (query.sort === 'risk') items.sort((a, b) => (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0));
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
  const page = Math.max(1, Number(query.page || 1));
  const total = items.length;
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize)
    .map(f => ({ id: f.id, title: f.title || null, severity: sevKey(f), state: stateOf(f) }));
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), items: pageItems };
}

/**
 * Build a smart state view (idea 52737).
 * Named views combine state, SLA, and severity signals: overdue work,
 * items awaiting verification, stalled items, and items ready to close.
 * @param {Array} findings - Findings to view.
 * @param {string} viewName - overdue-sla, awaiting-verification, stalled, ready-to-close, needs-attention.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @returns {object} { view, findingIds, count }.
 */
export function buildSmartStateView(findings = [], viewName = 'needs-attention', nowIso = '') {
  const view = String(viewName || 'needs-attention').toLowerCase();
  const nowMs = parseMs(nowIso);
  const sla = evaluateStateSla(findings, nowIso);
  const breached = new Set(sla.breachedIds);
  let rows = [...(findings || [])];
  if (view === 'overdue-sla') rows = rows.filter(f => breached.has(f.id));
  else if (view === 'awaiting-verification') rows = rows.filter(f => stateOf(f) === 'verifying');
  else if (view === 'stalled') rows = rows.filter(f => !TERMINAL_STATES.includes(stateOf(f)) && ageHoursOf(f, nowMs) > 48);
  else if (view === 'ready-to-close') rows = rows.filter(f => stateOf(f) === 'verified');
  else rows = rows.filter(f => breached.has(f.id) || ['verifying', 'reopened'].includes(stateOf(f)));
  rows.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0));
  return { view, findingIds: rows.map(f => f.id), count: rows.length };
}

/**
 * Draft a state-triggered email for one transition (idea 52738).
 * The email names the transition, severity, and owner, and points back
 * to Infinity AI for detail instead of carrying payloads.
 * @param {object} transition - { findingId, title, from, to, actor, severity, owner }.
 * @param {string} recipient - Destination address.
 * @returns {object} { to, subject, body, findingId, triggerState }.
 */
export function buildStateTriggeredEmail(transition = {}, recipient = '') {
  const to = normState(transition.to || '');
  const subject = `[Infinity AI] Finding ${transition.findingId || 'unknown'} moved ${normState(transition.from || '')} -> ${to}`;
  const body = [
    `Finding ${transition.findingId || 'unknown'} (${transition.title || 'untitled'}) changed state.`,
    `Transition: ${normState(transition.from || '')} -> ${to} by ${transition.actor || 'system'}.`,
    `Severity: ${String(transition.severity || 'info').toLowerCase()}. Owner: ${transition.owner || 'unassigned'}.`,
    `Open Infinity AI · Dark-Matter for evidence and next steps.`,
  ].join('\n');
  return { to: recipient || transition.owner || '', subject, body, findingId: transition.findingId || null, triggerState: to };
}

/**
 * Export findings filtered by lifecycle state (idea 52739).
 * Produces real serialized content in JSON, CSV, or Markdown with a
 * checksum, limited to the requested state (or all states).
 * @param {Array} findings - Findings to export.
 * @param {string} stateFilter - State to keep, or all.
 * @param {string} [format] - json, csv, or markdown.
 * @returns {object} { format, filename, content, rows, checksum }.
 */
export function exportFindingsByState(findings = [], stateFilter = 'all', format = 'json') {
  const fmt = ['json', 'csv', 'markdown'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const filter = normState(stateFilter || 'all');
  const rows = (findings || [])
    .filter(f => filter === 'all' || stateOf(f) === filter)
    .map(f => ({ id: f.id, title: f.title || null, severity: sevKey(f), state: stateOf(f), target: f.target || null }));
  let content = '';
  if (fmt === 'json') content = JSON.stringify({ exportedBy: 'Infinity AI', state: filter, rows }, null, 2);
  else if (fmt === 'csv') content = ['id,title,severity,state', ...rows.map(r => [r.id, `"${String(r.title || '').replace(/"/g, '""')}"`, r.severity, r.state].join(','))].join('\n');
  else content = [`# Lifecycle export (${filter})`, '', ...rows.map(r => `- ${r.id}: ${r.title || ''} (${r.severity}, ${r.state})`)].join('\n');
  return {
    format: fmt,
    filename: `lifecycle-${filter}-export.${fmt === 'markdown' ? 'md' : fmt}`,
    content,
    rows: rows.length,
    checksum: shortHash(content),
  };
}

/**
 * Compute state aging analytics (idea 52740).
 * Ages are measured from stateEnteredAt at the supplied instant and
 * rolled up per state with averages, maxima, and the oldest finding.
 * @param {Array} findings - Findings with stateEnteredAt.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @returns {object} { byState, total, oldestFindingId }.
 */
export function computeStateAging(findings = [], nowIso = '') {
  const nowMs = parseMs(nowIso);
  const per = {};
  let oldestId = null;
  let oldestAge = -1;
  for (const f of findings || []) {
    const state = stateOf(f);
    const age = ageHoursOf(f, nowMs);
    per[state] = per[state] || { state, ages: [], count: 0, oldestId: null, maxAgeHours: 0 };
    per[state].ages.push(age);
    per[state].count += 1;
    if (age > per[state].maxAgeHours) { per[state].maxAgeHours = age; per[state].oldestId = f.id; }
    if (age > oldestAge) { oldestAge = age; oldestId = f.id; }
  }
  const byState = {};
  for (const [state, d] of Object.entries(per)) {
    byState[state] = {
      state,
      count: d.count,
      avgAgeHours: Math.round((d.ages.reduce((a, b) => a + b, 0) / d.count) * 10) / 10,
      maxAgeHours: d.maxAgeHours,
      oldestId: d.oldestId,
    };
  }
  return { byState, total: (findings || []).length, oldestFindingId: oldestId };
}
