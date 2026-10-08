/**
 * lifecycleRound4Core.js — Infinity AI · Dark-Matter · Wave 61 (ideas 52401–52411)
 * Pure JS (no React / DOM / network). Deterministic post-hunt finding-lifecycle
 * round 4: agent-suggested transitions with one-click approval, state diagram
 * visualization payloads, bulk state import from CSV, state migration tooling,
 * archived-finding state preservation, state search across history, state-based
 * assignment rules, throughput leaderboards, transition comments, scheduled
 * state reviews, and embeddable state dashboard widgets. Time is injected via
 * `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE61_LC4_IDEAS = [
  { id: 52401, title: 'Agent-suggested transitions', desc: 'The agent proposes state moves with reasoning; humans approve in one click.', skip: false },
  { id: 52402, title: 'State diagram visualization', desc: 'Render your configured lifecycle as an interactive diagram for training and audits.', skip: false },
  { id: 52403, title: 'Bulk state import', desc: 'Import state assignments from CSV for migrations from legacy trackers.', skip: false },
  { id: 52404, title: 'State migration tool', desc: 'Remap states when reconfiguring the lifecycle, with preview of affected findings.', skip: false },
  { id: 52405, title: 'Archived-finding states', desc: 'Preserve final states on archived findings for accurate historical reporting.', skip: false },
  { id: 52406, title: 'State search', desc: 'Find findings by current or past states ("was ever Risk Accepted").', skip: false },
  { id: 52407, title: 'State-based assignment rules', desc: 'Auto-assign findings when they enter states (e.g., entering Fixing assigns the asset owner).', skip: false },
  { id: 52408, title: 'Lifecycle throughput leaderboard', desc: 'Team stats on findings moved to terminal states per week, opt-in and anonymized options.', skip: false },
  { id: 52409, title: 'State transition comments', desc: 'Inline discussion on the transition itself, separate from general finding comments.', skip: false },
  { id: 52410, title: 'Scheduled state reviews', desc: 'Recurring calendar of findings in non-terminal states for leads to review.', skip: false },
  { id: 52411, title: 'State-based dashboard widgets', desc: 'Embeddable state counts and aging charts for status pages.', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `lc461_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* 52401 — Agent-suggested transitions: the agent proposes a state move with
 * reasoning; a human approves it in one click. */
const SUGGESTION_RULES = [
  { from: 'New', to: 'Triaged', test: (f) => f.autoTriaged === true, reason: 'Auto-triage classified this finding with high confidence.' },
  { from: 'InProgress', to: 'InRetest', test: (f) => Array.isArray(f.evidence) && f.evidence.some((e) => e.kind === 'fix'), reason: 'A fix artifact was attached, so the finding is ready for retest.' },
  { from: 'InRetest', to: 'Verified', test: (f) => f.retest && f.retest.passed === true, reason: 'The verification retest passed, confirming the fix.' },
  { from: 'InRetest', to: 'Reopened', test: (f) => f.retest && f.retest.passed === false, reason: 'The verification retest failed, so the finding must reopen.' },
  { from: 'NeedsInfo', to: 'Triaged', test: (f) => f.infoProvided === true, reason: 'The requested information was provided.' },
];

export function suggestTransitions(finding, now = Date.now()) {
  if (!finding || typeof finding.state !== 'string') return { ok: false, reason: 'finding with a state is required' };
  const suggestions = SUGGESTION_RULES
    .filter((r) => r.from === finding.state && r.test(finding))
    .map((r) => ({ id: tokenFor('suggest', `${finding.id}:${r.to}`, now), findingId: finding.id, from: finding.state, to: r.to, reason: r.reason, suggestedAt: now, status: 'pending' }));
  return { ok: true, findingId: finding.id, suggestions };
}

export function approveTransition(suggestion, approver, now = Date.now()) {
  if (!suggestion || !suggestion.id || !approver) return { ok: false, reason: 'suggestion and approver are required' };
  return {
    ok: true,
    transition: { ...suggestion, status: 'approved', approvedBy: approver, approvedAt: now },
    applied: { findingId: suggestion.findingId, from: suggestion.from, to: suggestion.to, actor: approver, reason: `agent suggestion accepted: ${suggestion.reason}`, at: now },
  };
}

/* 52402 — State diagram visualization: nodes/edges payload for an interactive
 * lifecycle diagram (training, audits). */
export function stateDiagramPayload(states, edges) {
  if (!Array.isArray(states) || !Array.isArray(edges)) return { ok: false, reason: 'states and edges arrays are required' };
  const nodeIds = new Set(states.map((s) => s.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  return {
    ok: true,
    nodes: states.map((s) => ({ id: s.id, label: s.label || s.id, terminal: !!s.terminal, x: null, y: null })),
    edges: validEdges.map((e) => ({ from: e.from, to: e.to, label: e.label || '', guarded: !!e.guard })),
    stats: { nodeCount: states.length, edgeCount: validEdges.length, droppedEdges: edges.length - validEdges.length },
  };
}

/* 52403 — Bulk state import: parse CSV rows of `findingId,state,reason`,
 * validate each row, and produce an apply-ready plan. */
const VALID_IMPORT_STATES = ['New', 'Triaged', 'InProgress', 'InRetest', 'Verified', 'Closed', 'Reopened', 'WontFix', 'RiskAccepted'];

export function parseStateImport(csvText, findings = [], now = Date.now()) {
  if (typeof csvText !== 'string' || !csvText.trim()) return { ok: false, reason: 'CSV text is required' };
  const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const known = new Set(findings.map((f) => f.id));
  const rows = [];
  const errors = [];
  lines.forEach((line, i) => {
    const parts = line.split(',').map((p) => p.trim());
    const [findingId = '', state = '', reason = ''] = parts;
    if (!findingId) { errors.push({ line: i + 1, error: 'missing finding id' }); return; }
    if (known.size > 0 && !known.has(findingId)) { errors.push({ line: i + 1, error: `unknown finding ${findingId}` }); return; }
    if (!VALID_IMPORT_STATES.includes(state)) { errors.push({ line: i + 1, error: `invalid state "${state}"` }); return; }
    rows.push({ findingId, to: state, reason: reason || 'bulk state import', importedAt: now });
  });
  return { ok: errors.length === 0, rows, errors, stats: { total: lines.length, valid: rows.length, invalid: errors.length } };
}

/* 52404 — State migration tool: remap states across a lifecycle reconfiguration
 * with a preview of affected findings before apply. */
export function previewStateRemap(findings, remap, now = Date.now()) {
  if (!Array.isArray(findings) || !remap || typeof remap !== 'object') return { ok: false, reason: 'findings and a remap object are required' };
  const affected = [];
  const unaffected = [];
  for (const f of findings) {
    if (Object.prototype.hasOwnProperty.call(remap, f.state)) affected.push({ findingId: f.id, from: f.state, to: remap[f.state] });
    else unaffected.push({ findingId: f.id, state: f.state });
  }
  return {
    ok: true,
    previewId: tokenFor('remap', JSON.stringify(remap), now),
    remap: { ...remap },
    affected, unaffected,
    stats: { affected: affected.length, unaffected: unaffected.length, total: findings.length },
    createdAt: now,
  };
}

/* 52405 — Archived-finding states: seal the final state onto the archived
 * record so historical reporting stays accurate. */
export function archiveFindingWithState(finding, archivedBy, now = Date.now()) {
  if (!finding || !finding.id || !finding.state) return { ok: false, reason: 'finding with id and state is required' };
  return {
    ok: true,
    archived: {
      ...finding,
      archived: true,
      finalState: finding.state,
      archivedBy: archivedBy || 'system',
      archivedAt: now,
      stateLocked: true,
    },
    reportHint: `Archived in final state "${finding.state}".`,
  };
}

/* 52406 — State search: find findings by current state, or scan history for
 * findings that were ever in a past state ("was ever Risk Accepted"). */
export function searchFindingsByState(findings, state, now = Date.now()) {
  if (!Array.isArray(findings) || !state) return { ok: false, reason: 'findings and a state are required' };
  const current = findings.filter((f) => f.state === state).map((f) => f.id);
  const ever = findings.filter((f) => f.state === state || (Array.isArray(f.history) && f.history.some((h) => h.to === state || h.state === state))).map((f) => f.id);
  return { ok: true, state, searchedAt: now, current, ever, counts: { current: current.length, ever: ever.length } };
}

/* 52407 — State-based assignment rules: auto-assign when a finding enters a
 * configured state (e.g. entering Fixing assigns the asset owner). */
export function evaluateAssignmentRules(rules, finding, event, now = Date.now()) {
  if (!Array.isArray(rules) || !finding || !event || event.type !== 'enterState') return { ok: false, reason: 'rules, finding, and an enterState event are required' };
  const hits = rules
    .filter((r) => r.onState === event.to)
    .map((r) => ({ ruleId: r.id, assignee: r.assignee === 'assetOwner' ? (finding.assetOwner || 'unassigned') : r.assignee, role: r.role || null, appliedAt: now }));
  return { ok: true, findingId: finding.id, enteredState: event.to, assignments: hits, autoAssigned: hits.length > 0 };
}

/* 52408 — Lifecycle throughput leaderboard: per-team/member counts of findings
 * moved to terminal states in the last 7 days. Opt-in with anonymized option. */
const TERMINAL_STATES = ['Verified', 'Closed', 'WontFix', 'RiskAccepted'];

export function throughputLeaderboard(transitions, now = Date.now(), opts = {}) {
  if (!Array.isArray(transitions)) return { ok: false, reason: 'transitions array is required' };
  const weekAgo = now - 7 * 24 * 3600000;
  const counts = new Map();
  for (const t of transitions) {
    if (!t || !TERMINAL_STATES.includes(t.to) || (t.at || 0) < weekAgo) continue;
    if (opts.optIn === true && !t.actorOptedIn) continue;
    const key = opts.anonymize ? `member-${Math.abs([...(t.actor || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0) % 1000)}` : (t.actor || 'unknown');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const board = [...counts.entries()].map(([actor, closed]) => ({ actor, closed })).sort((a, b) => b.closed - a.closed);
  return { ok: true, window: 'last-7-days', entries: board, anonymized: !!opts.anonymize, optInFiltered: opts.optIn === true, generatedAt: now };
}

/* 52409 — State transition comments: a discussion thread attached to the
 * transition itself, separate from general finding comments. */
export function addTransitionComment(threads, transitionId, comment, now = Date.now()) {
  if (!transitionId || !comment || !comment.author || !comment.body) return { ok: false, reason: 'transitionId and an author/body comment are required' };
  const thread = (threads && threads[transitionId]) ? [...threads[transitionId]] : [];
  thread.push({ id: tokenFor('tc', `${transitionId}:${thread.length}`, now), transitionId, author: comment.author, body: comment.body, at: now });
  return { ok: true, threads: { ...(threads || {}), [transitionId]: thread }, transitionId, commentCount: thread.length };
}

/* 52410 — Scheduled state reviews: a recurring review schedule of findings
 * stuck in non-terminal states, for leads. */
const REVIEWABLE_STATES = ['New', 'Triaged', 'NeedsInfo', 'InProgress', 'Blocked', 'Deferred', 'InRetest', 'Reopened'];

export function scheduleStateReviews(findings, now = Date.now(), config = {}) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array is required' };
  const stuckThreshold = config.stuckThresholdMs || 7 * 24 * 3600000;
  const cadence = config.cadence || 'weekly';
  const stuck = findings.filter((f) => REVIEWABLE_STATES.includes(f.state) && (now - (f.stateEnteredAt || 0)) >= stuckThreshold);
  const reviews = stuck.map((f) => ({
    findingId: f.id, state: f.state, stuckDays: Math.floor((now - f.stateEnteredAt) / (24 * 3600000)),
    reviewer: config.lead || 'team-lead', nextReviewAt: now + (cadence === 'daily' ? 24 * 3600000 : 7 * 24 * 3600000),
  }));
  return { ok: true, cadence, stuckThresholdMs: stuckThreshold, reviews, stats: { reviewed: reviews.length }, generatedAt: now };
}

/* 52411 — State-based dashboard widgets: embeddable state-count/aging widget
 * payloads for status pages. */
export function stateWidgetPayload(findings, now = Date.now()) {
  if (!Array.isArray(findings)) return { ok: false, reason: 'findings array is required' };
  const counts = {};
  let totalAgingMs = 0;
  for (const f of findings) {
    counts[f.state] = (counts[f.state] || 0) + 1;
    totalAgingMs += Math.max(0, now - (f.stateEnteredAt || now));
  }
  return {
    ok: true,
    widget: 'infinity-ai-finding-states',
    brand: 'Infinity AI',
    generatedAt: now,
    total: findings.length,
    counts,
    avgAgingDays: findings.length ? +(totalAgingMs / findings.length / (24 * 3600000)).toFixed(1) : 0,
    terminal: TERMINAL_STATES.filter((s) => counts[s]).reduce((a, s) => a + counts[s], 0),
  };
}
