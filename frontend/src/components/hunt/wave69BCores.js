/**
 * wave69BCores.js — finding lifecycle states part 2 (ideas 52741–52760).
 *
 * Pure logic for breach escalation chains, transition approval queues,
 * historical state export, lifecycle funnel analytics, severity-aware
 * state rules, terminal-state definitions, AI next-state suggestions,
 * pre-transition checklists, action gating by state, mobile transition
 * approvals, lifecycle documentation, time-to-close prediction,
 * priority boosts for stalled findings, ticketing and platform-status
 * sync, agent-proposed transitions, the lifecycle diagram renderer,
 * CSV state import, the state-remap migration tool, and preserved
 * states on archive. Every helper takes explicit timestamps, never
 * mutates its inputs, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE69_B_IDEAS = [
  { id: 52741, title: 'Breach escalation chains', skip: false },
  { id: 52742, title: 'Transition approval queues', skip: false },
  { id: 52743, title: 'Historical state export', skip: false },
  { id: 52744, title: 'Lifecycle funnel analytics', skip: false },
  { id: 52745, title: 'Severity-aware state rules', skip: false },
  { id: 52746, title: 'Terminal-state definitions', skip: false },
  { id: 52747, title: 'AI next-state suggestions', skip: false },
  { id: 52748, title: 'Pre-transition checklists', skip: false },
  { id: 52749, title: 'Action gating by state', skip: false },
  { id: 52750, title: 'Mobile transition approvals', skip: false },
  { id: 52751, title: 'Lifecycle documentation generator', skip: false },
  { id: 52752, title: 'Time-to-close prediction', skip: false },
  { id: 52753, title: 'Priority boost for stalled', skip: false },
  { id: 52754, title: 'Ticketing two-way sync', skip: false },
  { id: 52755, title: 'Platform-status sync', skip: false },
  { id: 52756, title: 'Agent-proposed transitions', skip: false },
  { id: 52757, title: 'Lifecycle diagram renderer', skip: false },
  { id: 52758, title: 'CSV state import', skip: false },
  { id: 52759, title: 'State-remap migration tool', skip: false },
  { id: 52760, title: 'Preserved states on archive', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const LIFECYCLE_STATES = ['new', 'triaged', 'confirmed', 'assigned', 'fixing', 'verifying', 'verified', 'closed', 'dismissed', 'awaiting-info', 'duplicate', 'risk-accepted', 'deferred', 'blocked-vendor', 'reopened'];
const FUNNEL_STAGES = ['new', 'triaged', 'confirmed', 'assigned', 'fixing', 'verifying', 'verified', 'closed'];
const NEXT_STATES = {
  new: ['triaged', 'dismissed', 'awaiting-info', 'duplicate'],
  triaged: ['confirmed', 'dismissed', 'awaiting-info', 'duplicate'],
  confirmed: ['assigned', 'dismissed', 'risk-accepted', 'deferred'],
  assigned: ['fixing', 'awaiting-info', 'blocked-vendor', 'deferred'],
  fixing: ['verifying', 'blocked-vendor', 'awaiting-info', 'deferred'],
  verifying: ['verified', 'reopened'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  dismissed: ['reopened'],
  'awaiting-info': ['triaged', 'confirmed', 'assigned', 'fixing'],
  duplicate: ['reopened'],
  'risk-accepted': ['fixing', 'closed'],
  deferred: ['assigned', 'fixing', 'dismissed'],
  'blocked-vendor': ['fixing', 'verifying', 'deferred'],
  reopened: ['triaged', 'confirmed', 'fixing'],
};
const TERMINAL_DEFINITIONS = {
  closed: { terminal: true, description: 'Fix verified and administratively finished; reopening preserves full context.' },
  dismissed: { terminal: true, description: 'Reviewed and accepted as not actionable with a recorded reason.' },
  duplicate: { terminal: true, description: 'Covered by a canonical finding that carries the fix and verification.' },
};
const ACTION_GATES = {
  new: ['triage', 'dismiss', 'park', 'link-duplicate', 'comment'],
  triaged: ['confirm', 'dismiss', 'park', 'link-duplicate', 'comment'],
  confirmed: ['assign', 'dismiss', 'accept-risk', 'defer', 'comment'],
  assigned: ['start-fix', 'park', 'block-vendor', 'defer', 'comment'],
  fixing: ['submit-verify', 'block-vendor', 'park', 'defer', 'comment'],
  verifying: ['verify', 'reopen', 'comment'],
  verified: ['close', 'reopen', 'comment'],
  closed: ['reopen', 'export', 'comment'],
  dismissed: ['reopen', 'export', 'comment'],
  'awaiting-info': ['resume', 'dismiss', 'comment'],
  duplicate: ['reopen', 'export', 'comment'],
  'risk-accepted': ['start-fix', 'close', 'comment'],
  deferred: ['resume', 'dismiss', 'comment'],
  'blocked-vendor': ['resume', 'defer', 'comment'],
  reopened: ['triage', 'confirm', 'start-fix', 'comment'],
};
const TICKET_TO_STATE = { open: 'triaged', 'in-progress': 'fixing', resolved: 'verifying', closed: 'closed' };
const STATE_TO_TICKET = { new: 'open', triaged: 'open', confirmed: 'open', assigned: 'in-progress', fixing: 'in-progress', verifying: 'resolved', verified: 'resolved', closed: 'closed', reopened: 'open' };

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

function isTerminal(state) {
  return ['closed', 'dismissed', 'duplicate'].includes(normState(state));
}

/**
 * Build the breach escalation chain for an SLA breach (idea 52741).
 * Escalation thresholds tighten with severity; the current level is
 * derived from how long the breach has been open at evaluation time.
 * @param {object} breach - { findingId, severity, breachedHours, owner }.
 * @param {object} [config] - { roles: [] } override.
 * @returns {object} { findingId, chain, currentLevel, shouldEscalate }.
 */
export function buildEscalationChain(breach = {}, config = {}) {
  const severity = String(breach.severity || 'medium').toLowerCase();
  const tables = {
    critical: [0, 2, 8, 24],
    high: [0, 8, 24, 72],
    medium: [0, 24, 72, 168],
    low: [0, 72, 168, 336],
    info: [0, 168, 336, 720],
  };
  const thresholds = tables[severity] || tables.medium;
  const roles = (config.roles && config.roles.length ? config.roles : ['owner', 'team-lead', 'engineering-manager', 'security-director']);
  const breachedHours = Math.max(0, Number(breach.breachedHours || 0));
  const chain = roles.map((role, i) => ({ level: i + 1, role, afterHours: thresholds[Math.min(i, thresholds.length - 1)], notified: breachedHours >= (thresholds[Math.min(i, thresholds.length - 1)] || 0) }));
  let currentLevel = 1;
  for (let i = 0; i < thresholds.length; i++) if (breachedHours >= thresholds[i]) currentLevel = i + 1;
  return { findingId: breach.findingId || null, severity, chain, currentLevel, shouldEscalate: currentLevel >= 2 };
}

/**
 * Build the transition approval queue for one approver (idea 52742).
 * Pending requests are ordered by severity then request time, and each
 * entry states whether this approver may decide it.
 * @param {Array} requests - [{ id, findingId, from, to, requestedBy, severity, requestedAt, requiredRole, status }].
 * @param {string} approverRole - Role reviewing the queue.
 * @returns {object} { queue, count, approvableIds }.
 */
export function buildApprovalQueue(requests = [], approverRole = 'lead') {
  const role = String(approverRole || 'lead').toLowerCase();
  const queue = (requests || [])
    .filter(r => !r.status || String(r.status).toLowerCase() === 'pending')
    .map(r => {
      const requiredRole = String(r.requiredRole || 'lead').toLowerCase();
      return { ...r, requiredRole, canApprove: role === 'admin' || role === requiredRole };
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.requestedAt || '').localeCompare(String(b.requestedAt || '')));
  return { queue, count: queue.length, approvableIds: queue.filter(q => q.canApprove).map(q => q.id) };
}

/**
 * Export the historical state-change log (idea 52743).
 * Produces real serialized history in JSON, CSV, or Markdown with a
 * checksum so audits can verify the export was not altered.
 * @param {Array} logEntries - [{ seq, findingId, from, to, actor, at }].
 * @param {string} [format] - json, csv, or markdown.
 * @returns {object} { format, filename, content, rows, checksum }.
 */
export function exportHistoricalStates(logEntries = [], format = 'json') {
  const fmt = ['json', 'csv', 'markdown'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const rows = [...(logEntries || [])].sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
  let content = '';
  if (fmt === 'json') content = JSON.stringify({ exportedBy: 'Infinity AI', rows }, null, 2);
  else if (fmt === 'csv') content = ['seq,findingId,from,to,actor,at', ...rows.map(r => [r.seq, r.findingId, r.from, r.to, r.actor, r.at].join(','))].join('\n');
  else content = ['# Historical state export', '', ...rows.map(r => `- #${r.seq} ${r.findingId}: ${r.from} -> ${r.to} by ${r.actor} at ${r.at}`)].join('\n');
  return {
    format: fmt,
    filename: `historical-states-export.${fmt === 'markdown' ? 'md' : fmt}`,
    content,
    rows: rows.length,
    checksum: shortHash(content),
  };
}

/**
 * Compute lifecycle funnel analytics (idea 52744).
 * A finding counts as reaching a stage when its current stage is at
 * or past it in the funnel, or its history records the stage.
 * @param {Array} findings - Findings with state and history.
 * @returns {object} { stages, total, closedCount, biggestDropStage }.
 */
export function computeLifecycleFunnel(findings = []) {
  const reached = FUNNEL_STAGES.map(() => 0);
  for (const f of findings || []) {
    const currentIdx = FUNNEL_STAGES.indexOf(stateOf(f));
    const historyStages = new Set(((f.history) || []).map(h => normState(h.to || '')));
    FUNNEL_STAGES.forEach((stage, i) => {
      if ((currentIdx >= i && currentIdx !== -1) || historyStages.has(stage)) reached[i] += 1;
    });
  }
  const stages = FUNNEL_STAGES.map((stage, i) => ({
    stage,
    reached: reached[i],
    conversionPct: i === 0 ? 100 : (reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) : 0),
  }));
  let biggestDropStage = null;
  let biggestDrop = -1;
  for (let i = 1; i < stages.length; i++) {
    const drop = stages[i - 1].reached - stages[i].reached;
    if (drop > biggestDrop) { biggestDrop = drop; biggestDropStage = stages[i].stage; }
  }
  return { stages, total: (findings || []).length, closedCount: reached[FUNNEL_STAGES.length - 1], biggestDropStage };
}

/**
 * Evaluate severity-aware state rules (idea 52745).
 * Critical findings need recorded approval to be dismissed or risk
 * accepted, and cannot be closed by their own fixer; low and info
 * findings may be dismissed with a reason alone.
 * @param {object} finding - Finding with severity and fixer fields.
 * @param {string} toState - Desired state.
 * @param {object} [context] - { approvedBy, actor, verifiedBy }.
 * @returns {object} { allowed, reasons, severity, from, to, rulesApplied }.
 */
export function evaluateSeverityStateRules(finding = {}, toState = '', context = {}) {
  const severity = sevKey(finding);
  const from = stateOf(finding);
  const to = normState(toState);
  const reasons = [];
  const rulesApplied = [];
  if ((to === 'dismissed' || to === 'risk-accepted') && severityRank(severity) >= 3) {
    rulesApplied.push('high-severity-exit-needs-approval');
    if (!context.approvedBy && !finding.riskApproval) reasons.push(`${severity} findings need recorded approval to move to ${to}`);
  }
  if (to === 'closed' && severity === 'critical') {
    rulesApplied.push('critical-close-needs-separate-verifier');
    const actor = context.actor || context.verifiedBy || finding.verifiedBy;
    const fixer = finding.fixer || finding.fixedBy;
    if (actor && fixer && String(actor) === String(fixer)) reasons.push('critical findings cannot be closed by the person who fixed them');
  }
  if (to === 'closed' && !context.verifiedBy && !finding.verifiedBy && !finding.verificationEvidence) {
    rulesApplied.push('close-needs-verification');
    reasons.push('closing requires verification evidence or a verifier');
  }
  return { allowed: reasons.length === 0, reasons, severity, from, to, rulesApplied };
}

/**
 * Return the terminal-state definitions (idea 52746).
 * Terminal states end the lifecycle; every other lifecycle state is
 * active and carries its allowed next states for reference.
 * @param {Array} [customStates] - Optional state list override.
 * @returns {object} { terminalStates, activeStates, definitions, totalStates }.
 */
export function getTerminalStateDefinitions(customStates = null) {
  const states = (customStates && customStates.length ? customStates.map(normState) : [...LIFECYCLE_STATES]);
  const definitions = states.map(state => ({
    state,
    terminal: Boolean((TERMINAL_DEFINITIONS[state] || {}).terminal),
    description: (TERMINAL_DEFINITIONS[state] || {}).description || `Active lifecycle state with next states: ${(NEXT_STATES[state] || []).join(', ') || 'none'}.`,
  }));
  return {
    terminalStates: definitions.filter(d => d.terminal).map(d => d.state),
    activeStates: definitions.filter(d => !d.terminal).map(d => d.state),
    definitions,
    totalStates: definitions.length,
  };
}

/**
 * Suggest the next lifecycle states for a finding (idea 52747).
 * Suggestions follow the transition table and are scored by severity
 * urgency and available fix or verification signals.
 * @param {object} finding - Finding with state, severity, fixNote.
 * @returns {object} { findingId, currentState, suggestions, recommended }.
 */
export function suggestNextStates(finding = {}) {
  const current = stateOf(finding);
  const candidates = NEXT_STATES[current] || [];
  const suggestions = candidates.map(to => {
    let score = 50;
    const reasons = [];
    if (to === 'verifying' && finding.fixNote) { score += 30; reasons.push('a fix note is recorded'); }
    if (to === 'verified' && finding.verificationEvidence) { score += 30; reasons.push('verification evidence is present'); }
    if (to === 'closed' && finding.verifiedBy) { score += 25; reasons.push('a verifier is recorded'); }
    if (severityRank(finding.severity) >= 3 && ['triaged', 'confirmed', 'fixing'].includes(to)) { score += 10; reasons.push('elevated severity favours progress'); }
    if (to === 'dismissed' || to === 'duplicate') { score -= 20; reasons.push('exit states need a recorded reason'); }
    return { state: to, score, reason: reasons.join('; ') || `standard next state from ${current}`, source: 'Infinity AI' };
  }).sort((a, b) => b.score - a.score || a.state.localeCompare(b.state));
  return { findingId: finding.id || null, currentState: current, suggestions, recommended: suggestions.length ? suggestions[0].state : null };
}

/**
 * Build the pre-transition checklist for a move (idea 52748).
 * Each target state lists the concrete evidence or fields a reviewer
 * checks before the transition is allowed through.
 * @param {object} finding - Finding about to move.
 * @param {string} toState - Desired state.
 * @returns {object} { to, items, completed, total, ready, completionPct }.
 */
export function buildTransitionChecklist(finding = {}, toState = '') {
  const to = normState(toState);
  const items = [];
  const add = (key, label, done) => items.push({ key, label, done: Boolean(done) });
  add('title-present', 'Finding has a title', Boolean(finding.title));
  add('severity-set', 'Severity is assigned', Boolean(finding.severity));
  if (to === 'assigned') add('assignee', 'An assignee is selected', Boolean(finding.assignee || finding.nextAssignee));
  if (to === 'verifying') add('fix-note', 'A fix note or reference is recorded', Boolean(finding.fixNote || finding.fixReference));
  if (to === 'verified') add('verification-evidence', 'Verification evidence is attached', Boolean(finding.verificationEvidence || (finding.evidence || []).length));
  if (to === 'closed') {
    add('verified', 'Finding is verified by a named verifier', Boolean(finding.verifiedBy));
    add('verification-evidence', 'Verification evidence is attached', Boolean(finding.verificationEvidence || (finding.evidence || []).length));
  }
  if (to === 'dismissed' || to === 'reopened' || to === 'duplicate') add('reason', 'A transition reason is recorded', Boolean(finding.reason || finding.dismissReason));
  if (to === 'blocked-vendor') add('vendor-ticket', 'A vendor ticket reference is recorded', Boolean(finding.vendorTicket));
  const completed = items.filter(i => i.done).length;
  return {
    to,
    items,
    completed,
    total: items.length,
    ready: completed === items.length,
    completionPct: items.length ? Math.round((completed / items.length) * 100) : 100,
  };
}

/**
 * Gate an action by lifecycle state (idea 52749).
 * Only the actions meaningful in the current state are allowed, so a
 * closed finding cannot silently re-enter fix work without reopening.
 * @param {string} state - Current lifecycle state.
 * @param {string} action - Requested action.
 * @returns {object} { allowed, state, action, allowedActions }.
 */
export function gateActionByState(state = '', action = '') {
  const s = normState(state);
  const a = String(action || '').toLowerCase().trim();
  const allowedActions = [...(ACTION_GATES[s] || ['comment'])];
  return { allowed: allowedActions.includes(a), state: s, action: a, allowedActions };
}

/**
 * Build a mobile approval payload for a transition request (idea 52750).
 * The payload carries approve and reject actions plus a deep link back
 * into Infinity AI, prioritized by finding severity.
 * @param {object} request - { id, findingId, from, to, severity, requestedBy }.
 * @param {object} device - { platform }.
 * @returns {object} { requestId, platform, title, body, actions, deepLink, priority, sendable }.
 */
export function buildMobileApprovalPayload(request = {}, device = {}) {
  const platform = String(device.platform || '').toLowerCase();
  const severity = String(request.severity || 'medium').toLowerCase();
  return {
    requestId: request.id || null,
    platform: platform || 'unknown',
    title: `Approve ${normState(request.from || '')} -> ${normState(request.to || '')}`,
    body: `Infinity AI requests approval for finding ${request.findingId || 'unknown'} (${severity}) requested by ${request.requestedBy || 'system'}.`,
    actions: ['approve', 'reject'],
    deepLink: `infinityai://approvals/${request.id || 'pending'}`,
    priority: severityRank(severity) >= 3 ? 'high' : 'normal',
    sendable: platform === 'ios' || platform === 'android',
  };
}

/**
 * Generate lifecycle documentation from a state machine (idea 52751).
 * Produces Markdown covering every state, its outgoing transitions,
 * and the terminal-state rules for team handbooks.
 * @param {object} machine - { states: [], transitions: {} }.
 * @returns {object} { title, markdown, stateCount, transitionCount }.
 */
export function generateLifecycleDocumentation(machine = {}) {
  const states = (machine.states && machine.states.length ? machine.states.map(normState) : [...LIFECYCLE_STATES]);
  const transitions = machine.transitions || NEXT_STATES;
  let transitionCount = 0;
  const lines = ['# Infinity AI finding lifecycle', '', 'Every finding moves through named states. Terminal states end the lifecycle.', ''];
  for (const state of states) {
    const next = (transitions[state] || []).map(normState);
    transitionCount += next.length;
    lines.push(`## ${state}`);
    lines.push(next.length ? `Next states: ${next.join(', ')}.` : 'Terminal state: no outgoing transitions.');
    lines.push('');
  }
  return { title: 'Infinity AI finding lifecycle', markdown: lines.join('\n'), stateCount: states.length, transitionCount };
}

/**
 * Predict time to close for a finding (idea 52752).
 * The estimate subtracts the finding's age from the historical average
 * for its severity and projects the closing instant deterministically.
 * @param {object} finding - Finding with severity and createdAt.
 * @param {object} averages - { critical, high, medium, low, info } in hours.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @returns {object} { findingId, avgHours, ageHours, remainingHours, predictedCloseAt }.
 */
export function predictTimeToClose(finding = {}, averages = {}, nowIso = '') {
  const defaults = { critical: 96, high: 72, medium: 48, low: 24, info: 12 };
  const severity = sevKey(finding);
  const avgHours = Number((averages || {})[severity] ?? defaults[severity] ?? 48);
  const created = parseMs(finding.createdAt);
  const nowMs = parseMs(nowIso);
  const ageHours = created !== null && nowMs !== null ? Math.max(0, Math.round(((nowMs - created) / 3600000) * 10) / 10) : 0;
  const done = isTerminal(stateOf(finding)) || stateOf(finding) === 'verified';
  const remainingHours = done ? 0 : Math.max(0, Math.round((avgHours - ageHours) * 10) / 10);
  return {
    findingId: finding.id || null,
    avgHours,
    ageHours,
    remainingHours,
    predictedCloseAt: nowMs !== null ? new Date(nowMs + remainingHours * 3600000).toISOString() : null,
  };
}

/**
 * Boost priorities for stalled findings (idea 52753).
 * Findings idle past the stall threshold gain risk weight so queues
 * surface forgotten work; terminal findings are never boosted.
 * @param {Array} findings - Findings with stateEnteredAt and riskScore.
 * @param {string} nowIso - Evaluation instant (ISO string).
 * @param {object} [config] - { thresholdHours }.
 * @returns {object} { items, boostedIds, boostedCount, total }.
 */
export function boostStalledPriorities(findings = [], nowIso = '', config = {}) {
  const threshold = Math.max(1, Number(config.thresholdHours || 72));
  const nowMs = parseMs(nowIso);
  const items = (findings || []).map(f => {
    const entered = parseMs(f.stateEnteredAt || f.createdAt || '');
    const stalledHours = entered !== null && nowMs !== null ? Math.max(0, Math.round(((nowMs - entered) / 3600000) * 10) / 10) : 0;
    const stalled = !isTerminal(stateOf(f)) && stalledHours > threshold;
    const originalRiskScore = Number(f.riskScore || 0);
    const boostedRiskScore = stalled ? Math.min(100, Math.round((originalRiskScore + (severityRank(f.severity) >= 3 ? 15 : 10)) * 10) / 10) : originalRiskScore;
    return { id: f.id, state: stateOf(f), stalledHours, boosted: stalled, originalRiskScore, boostedRiskScore };
  }).sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.boostedRiskScore - a.boostedRiskScore);
  return { items, boostedIds: items.filter(i => i.boosted).map(i => i.id), boostedCount: items.filter(i => i.boosted).length, total: items.length };
}

/**
 * Reconcile a finding with its external ticket (idea 52754).
 * Ticket and lifecycle states map both ways; when they disagree the
 * side updated most recently wins and the conflict is reported.
 * @param {object} finding - Finding with state and stateEnteredAt.
 * @param {object} ticket - { externalId, status, updatedAt }.
 * @returns {object} { syncedState, conflict, direction, findingState, ticketState, externalId }.
 */
export function syncTicketState(finding = {}, ticket = {}) {
  const findingState = stateOf(finding);
  const ticketStatus = String(ticket.status || '').toLowerCase();
  const mapped = TICKET_TO_STATE[ticketStatus] || null;
  const expectedTicket = STATE_TO_TICKET[findingState] || null;
  if (!mapped) {
    return { syncedState: findingState, conflict: false, direction: 'in-sync', findingState, ticketState: ticketStatus, externalId: ticket.externalId || null };
  }
  if (mapped === findingState || expectedTicket === ticketStatus) {
    return { syncedState: findingState, conflict: false, direction: 'in-sync', findingState, ticketState: ticketStatus, externalId: ticket.externalId || null };
  }
  const ticketMs = parseMs(ticket.updatedAt);
  const findingMs = parseMs(finding.stateEnteredAt || finding.createdAt || '');
  const ticketWins = ticketMs !== null && (findingMs === null || ticketMs > findingMs);
  return {
    syncedState: ticketWins ? mapped : findingState,
    conflict: true,
    direction: ticketWins ? 'ticket-wins' : 'finding-wins',
    findingState,
    ticketState: ticketStatus,
    externalId: ticket.externalId || null,
  };
}

/**
 * Sync a finding with platform status (idea 52755).
 * A platform outage suggests blocking vendor-dependent work; recovery
 * suggests resuming a vendor-blocked finding for fix work.
 * @param {object} finding - Finding with state and target.
 * @param {object} platform - { status, component }.
 * @returns {object} { platformStatus, suggestedState, inSync, action }.
 */
export function syncPlatformStatus(finding = {}, platform = {}) {
  const status = String(platform.status || 'operational').toLowerCase();
  const current = stateOf(finding);
  if (status === 'outage' && current !== 'blocked-vendor' && !isTerminal(current)) {
    return { platformStatus: status, suggestedState: 'blocked-vendor', inSync: false, action: 'block-on-vendor' };
  }
  if (status === 'operational' && current === 'blocked-vendor') {
    return { platformStatus: status, suggestedState: 'fixing', inSync: false, action: 'resume-fix' };
  }
  if (status === 'degraded') {
    return { platformStatus: status, suggestedState: current, inSync: true, action: 'monitor' };
  }
  return { platformStatus: status, suggestedState: current, inSync: true, action: 'none' };
}

/**
 * Propose transitions an agent can apply automatically (idea 52756).
 * Proposals follow recorded signals only: fix notes, verification
 * evidence, and verifier identity, each with a confidence score.
 * @param {Array} findings - Findings to inspect.
 * @param {object} [context] - Reserved for queue preferences.
 * @returns {object} { proposals, count }.
 */
export function proposeAgentTransitions(findings = [], context = {}) {
  const proposals = [];
  for (const f of findings || []) {
    const state = stateOf(f);
    if (state === 'fixing' && (f.fixNote || f.fixReference)) {
      proposals.push({ findingId: f.id, from: state, to: 'verifying', reason: 'fix note recorded', confidence: 90, source: 'Infinity AI' });
    } else if (state === 'verifying' && f.verificationEvidence) {
      proposals.push({ findingId: f.id, from: state, to: 'verified', reason: 'verification evidence present', confidence: 85, source: 'Infinity AI' });
    } else if (state === 'verified' && f.verifiedBy) {
      proposals.push({ findingId: f.id, from: state, to: 'closed', reason: 'verifier recorded', confidence: 80, source: 'Infinity AI' });
    } else if (state === 'new') {
      proposals.push({ findingId: f.id, from: state, to: 'triaged', reason: 'intake complete', confidence: 60, source: 'Infinity AI' });
    }
  }
  return { proposals, count: proposals.length };
}

/**
 * Render the lifecycle diagram as Mermaid text (idea 52757).
 * States and transitions become a deterministic flowchart that docs
 * and design tools can render without a graphics dependency.
 * @param {Array} states - Lifecycle states.
 * @param {object} transitions - { from: [to] }.
 * @returns {object} { diagram, format, stateCount, transitionCount }.
 */
export function renderLifecycleDiagram(states = [], transitions = {}) {
  const list = (states && states.length ? states.map(normState) : [...LIFECYCLE_STATES]);
  const table = transitions && Object.keys(transitions).length ? transitions : NEXT_STATES;
  const lines = ['flowchart LR'];
  let transitionCount = 0;
  for (const from of list) {
    for (const to of (table[from] || []).map(normState)) {
      lines.push(`  ${from} --> ${to}`);
      transitionCount += 1;
    }
  }
  return { diagram: lines.join('\n'), format: 'mermaid', stateCount: list.length, transitionCount };
}

/**
 * Import finding states from CSV text (idea 52758).
 * Each row names a finding id and a target state; unknown states and
 * malformed rows are reported per line instead of imported.
 * @param {string} csvText - CSV with id,state header.
 * @returns {object} { rows, imported, errors, total, validCount }.
 */
export function importStatesFromCsv(csvText = '') {
  const lines = String(csvText || '').split(/\r?\n/).filter(l => l.trim().length);
  const rows = [];
  const errors = [];
  if (!lines.length) return { rows, imported: [], errors: [{ line: 1, message: 'empty CSV input' }], total: 0, validCount: 0 };
  const header = lines[0].split(',').map(c => c.trim().toLowerCase());
  const idIdx = Math.max(0, header.findIndex(h => ['id', 'findingid', 'finding_id'].includes(h)));
  const stateIdx = Math.max(1, header.findIndex(h => ['state', 'status', 'to'].includes(h)));
  lines.slice(1).forEach((line, i) => {
    const cells = line.split(',').map(c => c.trim());
    const id = cells[idIdx] || '';
    const state = normState(cells[stateIdx] || '');
    const lineNo = i + 2;
    if (!id) { errors.push({ line: lineNo, message: 'missing finding id' }); return; }
    if (!LIFECYCLE_STATES.includes(state)) { errors.push({ line: lineNo, message: `unknown state "${state}"` }); rows.push({ id, state, valid: false }); return; }
    rows.push({ id, state, valid: true });
  });
  const imported = rows.filter(r => r.valid);
  return { rows, imported, errors, total: rows.length, validCount: imported.length };
}

/**
 * Remap finding states during a lifecycle migration (idea 52759).
 * Findings in mapped states move to the new vocabulary; targets
 * outside the lifecycle are rejected and reported per finding.
 * @param {Array} findings - Findings to migrate.
 * @param {object} mapping - { oldState: newState }.
 * @returns {object} { findings, remappedIds, remappedCount, errors, unchangedCount }.
 */
export function remapFindingStates(findings = [], mapping = {}) {
  const table = {};
  for (const [from, to] of Object.entries(mapping || {})) table[normState(from)] = normState(to);
  const errors = [];
  const remappedIds = [];
  const next = (findings || []).map(f => {
    const current = stateOf(f);
    if (!Object.prototype.hasOwnProperty.call(table, current)) return { ...f };
    const target = table[current];
    if (!LIFECYCLE_STATES.includes(target)) {
      errors.push({ id: f.id, message: `target state "${target}" is not a lifecycle state` });
      return { ...f };
    }
    remappedIds.push(f.id);
    return { ...f, status: target, state: target };
  });
  return {
    findings: next,
    remappedIds,
    remappedCount: remappedIds.length,
    errors,
    unchangedCount: next.length - remappedIds.length,
  };
}

/**
 * Archive findings with their states preserved (idea 52760).
 * Archived copies keep the exact lifecycle state they held so audits
 * and restores never lose where work stopped.
 * @param {Array} findings - Findings to archive.
 * @param {string} archivedAt - Archive instant (ISO string).
 * @returns {object} { archived, count, byState, archivedAt }.
 */
export function archiveWithPreservedStates(findings = [], archivedAt = '') {
  const archived = (findings || []).map(f => ({ ...f, archived: true, archivedAt: archivedAt || null, preservedState: stateOf(f) }));
  const byState = {};
  for (const f of archived) byState[f.preservedState] = (byState[f.preservedState] || 0) + 1;
  return { archived, count: archived.length, byState, archivedAt: archivedAt || null };
}
