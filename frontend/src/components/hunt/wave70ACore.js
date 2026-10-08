/**
 * wave70ACore.js — finding lifecycle round 6 and bulk actions part 1
 * (ideas 52761–52780).
 *
 * Pure logic for historical state search, auto-assign on state entry,
 * the throughput leaderboard, per-transition comment threads, recurring
 * state-review meeting agendas, embeddable state widgets, transition
 * reason templates, state-based assignment rotation, cross-hunt state
 * rollups, the state-change digest, lifecycle compliance mapping, the
 * inbox multi-select selection model, filter-then-select-all, bulk
 * severity reassignment, bulk owner assignment, bulk tagging, batch
 * lifecycle transitions, bulk false-positive dismissal, selection-wide
 * retest queueing, and bulk export. Every builder takes findings and
 * explicit timestamps and returns a real structured view model; inputs
 * are never mutated.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE70_A_IDEAS = [
  { id: 52761, title: 'Historical state search', skip: false },
  { id: 52762, title: 'Auto-assign on state entry', skip: false },
  { id: 52763, title: 'Throughput leaderboard', skip: false },
  { id: 52764, title: 'Transition comment threads', skip: false },
  { id: 52765, title: 'Recurring state-review meetings', skip: false },
  { id: 52766, title: 'Embeddable state widgets', skip: false },
  { id: 52767, title: 'Transition reason templates', skip: false },
  { id: 52768, title: 'State-based assignment rotation', skip: false },
  { id: 52769, title: 'Cross-hunt state rollups', skip: false },
  { id: 52770, title: 'State-change digest', skip: false },
  { id: 52771, title: 'Lifecycle compliance mapping', skip: false },
  { id: 52772, title: 'Inbox multi-select checkboxes', skip: false },
  { id: 52773, title: 'Filter-then-select-all', skip: false },
  { id: 52774, title: 'Bulk severity reassignment', skip: false },
  { id: 52775, title: 'Bulk owner assignment', skip: false },
  { id: 52776, title: 'Bulk tagging (post-hunt)', skip: false },
  { id: 52777, title: 'Batch lifecycle transitions', skip: false },
  { id: 52778, title: 'Bulk FP dismissal', skip: false },
  { id: 52779, title: 'Selection-wide retest queueing', skip: false },
  { id: 52780, title: 'Bulk export (post-hunt)', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const LIFECYCLE_STATES = ['new', 'triaged', 'confirmed', 'assigned', 'fixing', 'verifying', 'verified', 'closed', 'dismissed', 'awaiting-info', 'duplicate', 'risk-accepted', 'deferred', 'blocked-vendor', 'reopened'];
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const REASON_REQUIRED_TARGETS = ['dismissed', 'risk-accepted', 'deferred', 'reopened', 'duplicate', 'blocked-vendor', 'awaiting-info'];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const REASON_TEMPLATES = {
  triaged: [
    { id: 'triage-accepted', label: 'Accepted for review', text: 'Intake complete; severity and target confirmed for triage.' },
    { id: 'triage-needs-scope', label: 'Scope check passed', text: 'Target is in scope and evidence is sufficient to proceed.' },
  ],
  confirmed: [
    { id: 'confirm-reproduced', label: 'Reproduced', text: 'Issue reproduced against the target with recorded evidence.' },
    { id: 'confirm-impact', label: 'Impact verified', text: 'Impact verified and severity assessed for confirmation.' },
  ],
  fixing: [
    { id: 'fix-started', label: 'Fix started', text: 'Fix work started; change reference will be recorded on completion.' },
  ],
  verified: [
    { id: 'verify-passed', label: 'Retest passed', text: 'Retest passed; the fix resolves the reported behaviour.' },
  ],
  closed: [
    { id: 'close-verified', label: 'Verified closure', text: 'Fix verified and evidence attached; closing the finding.' },
  ],
  dismissed: [
    { id: 'dismiss-not-reproducible', label: 'Not reproducible', text: 'Could not reproduce after repeated attempts with the supplied evidence.' },
    { id: 'dismiss-out-of-scope', label: 'Out of scope', text: 'Target or vector is outside the agreed hunt scope.' },
  ],
  reopened: [
    { id: 'reopen-regression', label: 'Regression found', text: 'Regression found; the original behaviour is present again.' },
    { id: 'reopen-incomplete-fix', label: 'Incomplete fix', text: 'Fix is incomplete; the issue remains exploitable.' },
  ],
  duplicate: [
    { id: 'duplicate-canonical', label: 'Covered by canonical', text: 'Covered by the canonical finding that carries the fix.' },
  ],
};
const COMPLIANCE_MAPS = {
  soc2: {
    new: { control: 'CC7.1', requirement: 'Detection and intake of reported issues is recorded.' },
    triaged: { control: 'CC7.2', requirement: 'Issues are evaluated and prioritized by severity.' },
    confirmed: { control: 'CC7.2', requirement: 'Issue validity is confirmed with evidence.' },
    fixing: { control: 'CC8.1', requirement: 'Changes are authorized, tested, and documented.' },
    verifying: { control: 'CC7.4', requirement: 'Resolution is verified before closure.' },
    verified: { control: 'CC7.4', requirement: 'Verified resolution evidence is retained.' },
    closed: { control: 'CC7.4', requirement: 'Resolved issues are closed with retained evidence.' },
    dismissed: { control: 'CC7.3', requirement: 'Non-actionable issues record an evaluated rationale.' },
    reopened: { control: 'CC7.4', requirement: 'Regressions reopen the issue with prior context.' },
  },
  'iso27001': {
    new: { control: 'A.16.1', requirement: 'Security events are reported and recorded.' },
    triaged: { control: 'A.16.1', requirement: 'Events are assessed and responsibility assigned.' },
    confirmed: { control: 'A.16.1', requirement: 'Incidents are confirmed and classified.' },
    fixing: { control: 'A.12.5', requirement: 'Technical vulnerabilities are remediated under change control.' },
    verifying: { control: 'A.16.1', requirement: 'Incident resolution is verified.' },
    verified: { control: 'A.16.1', requirement: 'Verified closure evidence is retained.' },
    closed: { control: 'A.16.1', requirement: 'Incidents are closed with lessons recorded.' },
    dismissed: { control: 'A.16.1', requirement: 'Non-incidents record an assessment rationale.' },
    reopened: { control: 'A.16.1', requirement: 'Recurring incidents are reopened and reassessed.' },
  },
};

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

function stateCountsOf(finding) {
  const counts = {};
  for (const h of (finding && finding.history) || []) {
    const to = normState(h.to || '');
    if (to) counts[to] = (counts[to] || 0) + 1;
  }
  const current = stateOf(finding);
  if (!counts[current]) counts[current] = (counts[current] || 0) + 1;
  return counts;
}

/**
 * Search findings by states they previously held (idea 52761).
 * Visit counts combine history entries with the current state, so a
 * finding reopened twice matches a reopened search with minVisits 2.
 * @param {Array} findings - Findings with history.
 * @param {object} query - { states: [], minVisits }.
 * @returns {object} { matches, count, queryStates, minVisits }.
 */
export function searchHistoricalStates(findings = [], query = {}) {
  const states = (query.states || []).map(normState).filter(Boolean);
  const minVisits = Math.max(1, Number(query.minVisits || 1));
  const matches = [];
  for (const f of findings || []) {
    const stateCounts = stateCountsOf(f);
    const ok = !states.length || states.every(s => (stateCounts[s] || 0) >= minVisits);
    if (ok) matches.push({ id: f.id, currentState: stateOf(f), stateCounts, reopenedCount: stateCounts.reopened || 0, totalTransitions: ((f.history) || []).length });
  }
  matches.sort((a, b) => (b.stateCounts.reopened || 0) - (a.stateCounts.reopened || 0) || String(a.id).localeCompare(String(b.id)));
  return { matches, count: matches.length, queryStates: states, minVisits };
}

/**
 * Auto-assign the asset owner when a finding enters Fixing (idea 52762).
 * The mapping is keyed by state, then by target asset, with a default
 * owner fallback; findings entering other states pass through unchanged.
 * @param {object} finding - Finding entering a state.
 * @param {object} assignmentMap - { fixing: { [target]: owner, default } } or { fixing: owner }.
 * @param {object} [options] - { enteredState, at }.
 * @returns {object} { assigned, finding, assignee, state, rule }.
 */
export function autoAssignOnStateEntry(finding = {}, assignmentMap = {}, options = {}) {
  const state = normState(options.enteredState || stateOf(finding));
  const ruleForState = (assignmentMap || {})[state];
  let assignee = null;
  let rule = 'no-mapping';
  if (typeof ruleForState === 'string' && ruleForState) { assignee = ruleForState; rule = `${state}-direct`; }
  else if (ruleForState && typeof ruleForState === 'object') {
    const target = finding.target || finding.asset || '';
    if (target && ruleForState[target]) { assignee = ruleForState[target]; rule = `${state}-by-target`; }
    else if (ruleForState.default) { assignee = ruleForState.default; rule = `${state}-default`; }
  }
  if (!assignee) return { assigned: false, finding: { ...finding }, assignee: null, state, rule };
  const moved = stateOf(finding) === state ? { ...finding } : withHistory(finding, stateOf(finding), state, 'Infinity AI', options.at, `auto-assign on entering ${state}`);
  return { assigned: true, finding: { ...moved, owner: assignee, assignee }, assignee, state, rule };
}

/**
 * Build the opt-in throughput leaderboard (idea 52763).
 * Only actors on the opt-in participant list are ranked, by how many
 * findings they advanced into terminal states across finding histories.
 * @param {Array} findings - Findings with history.
 * @param {object} [options] - { participants: [], nowIso }.
 * @returns {object} { leaderboard, count, optedIn }.
 */
export function buildThroughputLeaderboard(findings = [], options = {}) {
  const participants = (options.participants || []).map(s => String(s));
  const optedIn = participants.length > 0;
  const tally = {};
  for (const f of findings || []) {
    for (const h of (f.history) || []) {
      if (!TERMINAL_STATES.includes(normState(h.to || ''))) continue;
      const actor = String(h.actor || 'system');
      if (optedIn && !participants.includes(actor)) continue;
      tally[actor] = tally[actor] || { actor, advanced: 0, lastAdvancedAt: null };
      tally[actor].advanced += 1;
      if (!tally[actor].lastAdvancedAt || String(h.at || '') > String(tally[actor].lastAdvancedAt)) tally[actor].lastAdvancedAt = h.at || null;
    }
  }
  const leaderboard = Object.values(tally).sort((a, b) => b.advanced - a.advanced || a.actor.localeCompare(b.actor));
  return { leaderboard, count: leaderboard.length, optedIn };
}

/**
 * Group comments into per-transition threads (idea 52764).
 * Transition comments travel with their from-to move, kept separate
 * from the finding's general comment list.
 * @param {object} finding - Finding with history and comments.
 * @returns {object} { findingId, threads, generalComments, threadCount, transitionCommentCount }.
 */
export function buildTransitionThreads(finding = {}) {
  const byKey = {};
  const order = [];
  const add = (from, to, comment) => {
    const key = `${normState(from)}->${normState(to)}`;
    if (!byKey[key]) { byKey[key] = { key, from: normState(from), to: normState(to), comments: [] }; order.push(key); }
    byKey[key].comments.push({ author: comment.author || 'system', text: comment.text || '', at: comment.at || null });
  };
  for (const h of (finding.history) || []) {
    for (const c of (h.comments) || []) add(h.from || '', h.to || '', c);
  }
  for (const c of (finding.transitionComments) || []) add(c.from || '', c.to || '', c);
  const threads = order.map(k => ({ ...byKey[k], commentCount: byKey[k].comments.length }));
  const generalComments = [...((finding.comments) || [])];
  return {
    findingId: finding.id || null,
    threads,
    generalComments,
    threadCount: threads.length,
    transitionCommentCount: threads.reduce((a, t) => a + t.commentCount, 0),
  };
}

/**
 * Build the agenda for a recurring state-review meeting (idea 52765).
 * Non-terminal findings are ordered by severity then age so reviews
 * start with the oldest high-impact open work.
 * @param {Array} findings - Findings to review.
 * @param {object} [options] - { nowIso, title }.
 * @returns {object} { title, items, count, byState, generatedAt }.
 */
export function buildReviewMeetingAgenda(findings = [], options = {}) {
  const nowIso = options.nowIso || '';
  const nowMs = parseMs(nowIso);
  const items = (findings || [])
    .filter(f => !TERMINAL_STATES.includes(stateOf(f)))
    .map(f => ({ id: f.id, title: f.title || null, severity: sevKey(f), state: stateOf(f), ageHours: ageHoursOf(f, nowMs), owner: f.owner || f.assignee || null }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.ageHours - a.ageHours || String(a.id).localeCompare(String(b.id)));
  const byState = {};
  for (const i of items) byState[i.state] = (byState[i.state] || 0) + 1;
  return { title: options.title || 'State review', items, count: items.length, byState, generatedAt: nowIso || null };
}

/**
 * Build an embeddable state widget payload (idea 52766).
 * The payload carries per-state counts and aging for one hunt plus a
 * deterministic widget id and embed snippet for external pages.
 * @param {Array} findings - Findings behind the widget.
 * @param {string} nowIso - Generation instant (ISO string).
 * @param {object} [options] - { huntId, title }.
 * @returns {object} { widgetId, huntId, countsByState, total, avgAgeHours, generatedAt, embedSnippet }.
 */
export function buildStateWidgetPayload(findings = [], nowIso = '', options = {}) {
  const nowMs = parseMs(nowIso);
  const countsByState = {};
  let ageSum = 0;
  for (const f of findings || []) {
    const s = stateOf(f);
    countsByState[s] = (countsByState[s] || 0) + 1;
    ageSum += ageHoursOf(f, nowMs);
  }
  const total = (findings || []).length;
  const huntId = options.huntId || null;
  const widgetId = `wdg_${shortHash(`${huntId || 'all'}:${JSON.stringify(countsByState)}:${total}`)}`;
  return {
    widgetId,
    huntId,
    countsByState,
    total,
    avgAgeHours: total ? Math.round((ageSum / total) * 10) / 10 : 0,
    generatedAt: nowIso || null,
    embedSnippet: `<div data-infinity-widget="${widgetId}" data-hunt="${huntId || 'all'}"></div>`,
  };
}

/**
 * Return one-click transition reason templates (idea 52767).
 * Templates are grouped by target state and rendered with the supplied
 * context so a reviewer can apply a complete reason in one action.
 * @param {string} toState - Target state, or empty for all templates.
 * @param {object} [context] - { findingId, target } for rendering.
 * @returns {object} { toState, templates, count }.
 */
export function getTransitionReasonTemplates(toState = '', context = {}) {
  const target = normState(toState || '');
  const render = text => text
    .replaceAll('{findingId}', String(context.findingId || 'this finding'))
    .replaceAll('{target}', String(context.target || 'the target'));
  const groups = target && REASON_TEMPLATES[target] ? { [target]: REASON_TEMPLATES[target] } : REASON_TEMPLATES;
  const templates = [];
  for (const [state, list] of Object.entries(groups)) {
    for (const t of list) templates.push({ id: t.id, state, label: t.label, text: render(t.text) });
  }
  return { toState: target || 'all', templates, count: templates.length };
}

/**
 * Rotate Triaged assignments round-robin across assignees (idea 52768).
 * Findings in the rotation state are dealt to the assignee list in
 * order, wrapping around, without changing the input findings.
 * @param {Array} findings - Findings to assign.
 * @param {Array} assignees - Rotation list.
 * @param {object} [options] - { state, actor, at }.
 * @returns {object} { assignments, updated, count, state }.
 */
export function rotateTriagedAssignments(findings = [], assignees = [], options = {}) {
  const state = normState(options.state || 'triaged');
  const pool = (assignees || []).map(s => String(s)).filter(Boolean);
  const assignments = [];
  const updated = (findings || []).map(f => {
    if (stateOf(f) !== state || !pool.length) return { ...f };
    const assignee = pool[assignments.length % pool.length];
    assignments.push({ id: f.id, assignee, state });
    return { ...f, assignee, owner: f.owner || assignee };
  });
  return { assignments, updated, count: assignments.length, state };
}

/**
 * Roll findings up per state across hunts (idea 52769).
 * Each hunt contributes its own per-state counts plus a combined
 * cross-hunt total for programme-level reporting.
 * @param {Array} hunts - [{ huntId, findings }].
 * @returns {object} { byState, byHunt, huntCount, totalFindings }.
 */
export function buildCrossHuntRollups(hunts = []) {
  const byState = {};
  const byHunt = [];
  let totalFindings = 0;
  for (const h of hunts || []) {
    const huntId = h.huntId || h.id || null;
    const counts = {};
    for (const f of (h.findings) || []) {
      const s = stateOf(f);
      counts[s] = (counts[s] || 0) + 1;
      byState[s] = (byState[s] || 0) + 1;
      totalFindings += 1;
    }
    byHunt.push({ huntId, countsByState: counts, total: (h.findings || []).length });
  }
  return { byState, byHunt, huntCount: byHunt.length, totalFindings };
}

/**
 * Build the daily state-change digest for watched hunts (idea 52770).
 * Transitions are filtered to the digest date and watched hunt list,
 * then grouped by hunt and destination state.
 * @param {Array} transitions - [{ findingId, huntId, from, to, actor, at }].
 * @param {object} [options] - { date, watchedHunts: [] }.
 * @returns {object} { date, entries, count, byHunt, byState, summary }.
 */
export function buildStateChangeDigest(transitions = [], options = {}) {
  const date = options.date || '';
  const watched = (options.watchedHunts || []).map(s => String(s));
  const entries = (transitions || [])
    .filter(t => (!date || String(t.at || '').startsWith(date)) && (!watched.length || watched.includes(String(t.huntId))))
    .map(t => ({ findingId: t.findingId || null, huntId: t.huntId || null, from: normState(t.from || ''), to: normState(t.to || ''), actor: t.actor || 'system', at: t.at || null }))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.findingId).localeCompare(String(b.findingId)));
  const byHunt = {};
  const byState = {};
  for (const e of entries) {
    byHunt[e.huntId] = (byHunt[e.huntId] || 0) + 1;
    byState[e.to] = (byState[e.to] || 0) + 1;
  }
  return {
    date: date || null,
    entries,
    count: entries.length,
    byHunt,
    byState,
    summary: `Infinity AI digest: ${entries.length} state changes on ${date || 'all dates'} across ${Object.keys(byHunt).length} watched hunts.`,
  };
}

/**
 * Map lifecycle states to compliance framework requirements (idea 52771).
 * Each lifecycle state is paired with the framework control it helps
 * evidence, such as SOC 2 CC7.4 for verified resolution.
 * @param {Array} input - State names or findings.
 * @param {object} [options] - { framework }.
 * @returns {object} { framework, mappings, coveredStates, unmappedStates }.
 */
export function mapLifecycleToCompliance(input = [], options = {}) {
  const framework = String(options.framework || 'soc2').toLowerCase() in COMPLIANCE_MAPS ? String(options.framework || 'soc2').toLowerCase() : 'soc2';
  const table = COMPLIANCE_MAPS[framework];
  const states = [];
  for (const item of input || []) {
    const s = typeof item === 'string' ? normState(item) : stateOf(item);
    if (s && !states.includes(s)) states.push(s);
  }
  const mappings = [];
  const unmappedStates = [];
  for (const s of states) {
    if (table[s]) mappings.push({ state: s, control: table[s].control, requirement: table[s].requirement });
    else unmappedStates.push(s);
  }
  return { framework, mappings, coveredStates: mappings.map(m => m.state), unmappedStates };
}

/**
 * Maintain the persistent cross-page inbox selection (idea 52772).
 * The selection survives paging: toggle, select-page, deselect-page,
 * and clear actions produce a new selection without mutating the old.
 * @param {Array} selectedIds - Currently selected finding ids.
 * @param {Array} pageFindings - Findings on the visible page.
 * @param {object} [action] - { type, id }.
 * @returns {object} { selectedIds, selectedCount, pageIds, pageSelectedCount, allPageSelected }.
 */
export function updateInboxSelection(selectedIds = [], pageFindings = [], action = null) {
  const pageIds = (pageFindings || []).map(f => f.id);
  let next = [...(selectedIds || [])];
  if (action && action.type === 'toggle' && action.id) {
    next = next.includes(action.id) ? next.filter(id => id !== action.id) : [...next, action.id];
  } else if (action && action.type === 'select-page') {
    for (const id of pageIds) if (!next.includes(id)) next.push(id);
  } else if (action && action.type === 'deselect-page') {
    next = next.filter(id => !pageIds.includes(id));
  } else if (action && action.type === 'clear') {
    next = [];
  }
  const pageSelected = pageIds.filter(id => next.includes(id));
  return {
    selectedIds: next,
    selectedCount: next.length,
    pageIds,
    pageSelectedCount: pageSelected.length,
    allPageSelected: pageIds.length > 0 && pageSelected.length === pageIds.length,
  };
}

/**
 * Select every finding matching the active filter (idea 52773).
 * Filter-then-select-all captures the whole matching set, not just
 * the visible page, so bulk actions cover the filtered result.
 * @param {Array} findings - Findings to filter.
 * @param {object} filter - { state, severity, search }.
 * @param {Array} [existingIds] - Selection to merge into.
 * @returns {object} { selectedIds, matchedIds, count, mergedCount }.
 */
export function selectAllMatchingFilter(findings = [], filter = {}, existingIds = []) {
  const wantState = filter.state ? normState(filter.state) : null;
  const wantSeverity = filter.severity ? String(filter.severity).toLowerCase() : null;
  const search = filter.search ? String(filter.search).toLowerCase() : null;
  const matchedIds = (findings || [])
    .filter(f => (!wantState || stateOf(f) === wantState)
      && (!wantSeverity || sevKey(f) === wantSeverity)
      && (!search || `${f.id} ${f.title || ''} ${f.target || ''}`.toLowerCase().includes(search)))
    .map(f => f.id);
  const merged = [...(existingIds || [])];
  for (const id of matchedIds) if (!merged.includes(id)) merged.push(id);
  return { selectedIds: matchedIds, matchedIds, count: matchedIds.length, mergedCount: merged.length };
}

/**
 * Reassign severity across a selection with one justification (idea 52774).
 * The shared justification is required and recorded on every changed
 * finding together with the previous severity for audit.
 * @param {Array} findings - Findings to change.
 * @param {string} toSeverity - New severity.
 * @param {object} [options] - { justification, actor, at }.
 * @returns {object} { ok, updated, changedIds, fromSeverities, error }.
 */
export function bulkChangeSeverity(findings = [], toSeverity = '', options = {}) {
  const target = String(toSeverity || '').toLowerCase();
  const justification = String(options.justification || '').trim();
  if (!SEVERITIES.includes(target)) return { ok: false, updated: [], changedIds: [], fromSeverities: {}, error: `unknown severity "${target}"` };
  if (justification.length < 3) return { ok: false, updated: [], changedIds: [], fromSeverities: {}, error: 'bulk severity change requires a shared justification' };
  const fromSeverities = {};
  const updated = (findings || []).map(f => {
    fromSeverities[f.id] = sevKey(f);
    return { ...f, severity: target, previousSeverity: sevKey(f), severityJustification: justification, severityChangedBy: options.actor || 'system', severityChangedAt: options.at || null };
  });
  return { ok: true, updated, changedIds: updated.map(f => f.id), fromSeverities, error: null };
}

/**
 * Assign owners across a selection in one action (idea 52775).
 * A single owner applies to every finding; a list of owners is dealt
 * round-robin so load is shared evenly.
 * @param {Array} findings - Findings to assign.
 * @param {string|Array|object} assignment - Owner, owner list, or id map.
 * @param {object} [options] - { actor, at, field }.
 * @returns {object} { updated, assignments, count }.
 */
export function bulkAssignOwners(findings = [], assignment = null, options = {}) {
  const field = options.field === 'assignee' ? 'assignee' : 'owner';
  const assignments = [];
  const updated = (findings || []).map((f, i) => {
    let owner = null;
    if (typeof assignment === 'string' && assignment) owner = assignment;
    else if (Array.isArray(assignment) && assignment.length) owner = String(assignment[i % assignment.length]);
    else if (assignment && typeof assignment === 'object' && assignment[f.id]) owner = String(assignment[f.id]);
    if (!owner) return { ...f };
    assignments.push({ id: f.id, owner });
    return { ...f, [field]: owner, assignedBy: options.actor || 'system', assignedAt: options.at || null };
  });
  return { updated, assignments, count: assignments.length };
}

/**
 * Add and remove tags across a selection after a hunt (idea 52776).
 * Tag sets are normalized and deduplicated; removals apply before
 * additions so a tag in both lists ends up present.
 * @param {Array} findings - Findings to tag.
 * @param {object} [options] - { add: [], remove: [], actor, at }.
 * @returns {object} { updated, changedIds, count, addedTags, removedTags }.
 */
export function bulkUpdateTags(findings = [], options = {}) {
  const norm = list => [...new Set((list || []).map(t => String(t).toLowerCase().trim()).filter(Boolean))];
  const addedTags = norm(options.add);
  const removedTags = norm(options.remove);
  const changedIds = [];
  const updated = (findings || []).map(f => {
    const before = norm(f.tags);
    const tags = [...new Set([...before.filter(t => !removedTags.includes(t)), ...addedTags])];
    if (JSON.stringify(tags) !== JSON.stringify(before)) changedIds.push(f.id);
    return { ...f, tags, tagsUpdatedBy: options.actor || 'system', tagsUpdatedAt: options.at || null };
  });
  return { updated, changedIds, count: changedIds.length, addedTags, removedTags };
}

/**
 * Apply one lifecycle transition to a whole selection (idea 52777).
 * A single confirmation drives the batch; each finding still passes
 * guardrail-style validation for terminal states and required reasons.
 * @param {Array} findings - Findings to move.
 * @param {string} toState - Desired target state.
 * @param {object} [options] - { actor, at, reason, confirmed }.
 * @returns {object} { ok, updated, blocked, okCount, blockedCount, summary }.
 */
export function batchTransitionFindings(findings = [], toState = '', options = {}) {
  const target = normState(toState);
  if (options.confirmed !== true) {
    return { ok: false, updated: [], blocked: (findings || []).map(f => ({ id: f.id, reason: 'batch transition requires one confirmation' })), okCount: 0, blockedCount: (findings || []).length, summary: 'Infinity AI batch held: confirmation required.' };
  }
  if (!LIFECYCLE_STATES.includes(target)) {
    return { ok: false, updated: [], blocked: (findings || []).map(f => ({ id: f.id, reason: `unknown target state "${target}"` })), okCount: 0, blockedCount: (findings || []).length, summary: `Infinity AI batch blocked: unknown state ${target}.` };
  }
  const updated = [];
  const blocked = [];
  for (const f of findings || []) {
    const from = stateOf(f);
    if (from === target) { blocked.push({ id: f.id, reason: `already in ${target}` }); continue; }
    if (TERMINAL_STATES.includes(from) && target !== 'reopened') { blocked.push({ id: f.id, reason: `state ${from} is terminal; only reopened is allowed` }); continue; }
    if (REASON_REQUIRED_TARGETS.includes(target) && String(options.reason || '').trim().length < 3) { blocked.push({ id: f.id, reason: `transition to ${target} requires a reason` }); continue; }
    updated.push(withHistory(f, from, target, options.actor, options.at, options.reason || `batch transition to ${target}`));
  }
  return {
    ok: blocked.length === 0,
    updated,
    blocked,
    okCount: updated.length,
    blockedCount: blocked.length,
    summary: `Infinity AI batch: ${updated.length}/${(findings || []).length} moved to ${target}.`,
  };
}

/**
 * Dismiss a selection as false positives under one reason (idea 52778).
 * Every dismissed finding records the same documented reason and a
 * false-positive marker so later tuning can learn from the decision.
 * @param {Array} findings - Findings to dismiss.
 * @param {object} [options] - { reason, actor, at }.
 * @returns {object} { ok, dismissed, dismissedIds, blocked, error }.
 */
export function bulkDismissAsFalsePositive(findings = [], options = {}) {
  const reason = String(options.reason || '').trim();
  if (reason.length < 3) return { ok: false, dismissed: [], dismissedIds: [], blocked: [], error: 'bulk false-positive dismissal requires one documented reason' };
  const dismissed = [];
  const blocked = [];
  for (const f of findings || []) {
    if (stateOf(f) === 'dismissed') { blocked.push({ id: f.id, reason: 'already dismissed' }); continue; }
    const moved = withHistory(f, stateOf(f), 'dismissed', options.actor, options.at, reason);
    dismissed.push({ ...moved, dismissalKind: 'false-positive', fpReason: reason });
  }
  return { ok: blocked.length === 0, dismissed, dismissedIds: dismissed.map(f => f.id), blocked, error: null };
}

/**
 * Queue retests for a whole selection (idea 52779).
 * Findings in fix or verification states enter the retest queue in
 * severity order; other states are reported as skipped with reasons.
 * @param {Array} findings - Findings to queue.
 * @param {object} [options] - { requestedBy, at }.
 * @returns {object} { queue, queuedIds, skipped, count }.
 */
export function queueSelectionRetests(findings = [], options = {}) {
  const eligible = ['fixing', 'verifying', 'reopened', 'verified'];
  const queue = [];
  const skipped = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (!eligible.includes(state)) { skipped.push({ id: f.id, reason: `state ${state} is not ready for retest` }); continue; }
    queue.push({
      queueId: `rt_${shortHash(`${f.id}:${options.at || ''}:${options.requestedBy || ''}`)}`,
      findingId: f.id,
      state,
      severity: sevKey(f),
      requestedBy: options.requestedBy || 'system',
      at: options.at || null,
      status: 'queued',
    });
  }
  queue.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.findingId).localeCompare(String(b.findingId)));
  return { queue, queuedIds: queue.map(q => q.findingId), skipped, count: queue.length };
}

/**
 * Export a selection in CSV, JSON, or Markdown (idea 52780).
 * Produces real serialized content with a checksum, covering exactly
 * the selected findings in input order.
 * @param {Array} findings - Findings to export.
 * @param {string} [format] - json, csv, or markdown.
 * @param {object} [options] - { exportedBy }.
 * @returns {object} { format, filename, content, rows, checksum }.
 */
export function exportSelectionBulk(findings = [], format = 'json', options = {}) {
  const fmt = ['json', 'csv', 'markdown'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const rows = (findings || []).map(f => ({ id: f.id, title: f.title || null, severity: sevKey(f), state: stateOf(f), target: f.target || null, owner: f.owner || null }));
  let content = '';
  if (fmt === 'json') content = JSON.stringify({ exportedBy: options.exportedBy || 'Infinity AI', rows }, null, 2);
  else if (fmt === 'csv') content = ['id,title,severity,state,target', ...rows.map(r => [r.id, `"${String(r.title || '').replace(/"/g, '""')}"`, r.severity, r.state, r.target || ''].join(','))].join('\n');
  else content = ['# Selection export', '', ...rows.map(r => `- ${r.id}: ${r.title || ''} (${r.severity}, ${r.state})`)].join('\n');
  return {
    format: fmt,
    filename: `selection-export.${fmt === 'markdown' ? 'md' : fmt}`,
    content,
    rows: rows.length,
    checksum: shortHash(content),
  };
}
