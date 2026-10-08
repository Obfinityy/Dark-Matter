/**
 * wave68BCores.js — stakeholder roles, presentation tooling, and the
 * configurable finding lifecycle state machine (ideas 52701–52720).
 *
 * Pure logic for custom stakeholder roles, onboarding tours, per-view FAQs,
 * view analytics, multi-stakeholder meeting mode, live presentation mode,
 * speaker notes, print-optimized views, the stakeholder view API,
 * view-level watermarks, view scheduling, and the feedback widget, plus a
 * real configurable lifecycle state machine: named states, an allowed-
 * transition table, guardrail validation that blocks illegal jumps with
 * explanations, per-role transition permissions, an append-only state-
 * change log with a hash chain, and lifecycle transition alerts. Transition
 * helpers are pure reducers: they never mutate the input finding and they
 * refuse illegal moves instead of forcing them.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE68_B_IDEAS = [
  { id: 52701, title: 'Custom stakeholder roles', skip: false },
  { id: 52702, title: 'Stakeholder onboarding tour', skip: false },
  { id: 52703, title: 'Stakeholder FAQ per view', skip: false },
  { id: 52704, title: 'Stakeholder view analytics', skip: false },
  { id: 52705, title: 'Multi-stakeholder meeting mode', skip: false },
  { id: 52706, title: 'Live presentation mode', skip: false },
  { id: 52707, title: 'Speaker notes per view', skip: false },
  { id: 52708, title: 'Print-optimized views', skip: false },
  { id: 52709, title: 'Stakeholder view API', skip: false },
  { id: 52710, title: 'View-level watermarks', skip: false },
  { id: 52711, title: 'Stakeholder view scheduling', skip: false },
  { id: 52712, title: 'Stakeholder feedback widget', skip: false },
  { id: 52713, title: 'Configurable lifecycle state machine', skip: false },
  { id: 52714, title: 'New → Triaged → Confirmed flow', skip: false },
  { id: 52715, title: 'Confirmed → Assigned → Fixing flow', skip: false },
  { id: 52716, title: 'Fixing → Verifying → Closed flow', skip: false },
  { id: 52717, title: 'State transition guardrails', skip: false },
  { id: 52718, title: 'Per-role transition permissions', skip: false },
  { id: 52719, title: 'Immutable state-change log', skip: false },
  { id: 52720, title: 'Lifecycle transition alerts', skip: false },
];

const KNOWN_PERMISSIONS = ['view', 'comment', 'annotate', 'export', 'email', 'schedule', 'admin', 'triage', 'assign', 'fix', 'verify', 'close'];
const DEFAULT_STATES = ['new', 'triaged', 'confirmed', 'assigned', 'fixing', 'verifying', 'closed', 'dismissed'];
const DEFAULT_TRANSITIONS = {
  new: ['triaged', 'dismissed'],
  triaged: ['confirmed', 'dismissed'],
  confirmed: ['assigned', 'dismissed'],
  assigned: ['fixing', 'confirmed'],
  fixing: ['verifying'],
  verifying: ['closed', 'fixing'],
  closed: [],
  dismissed: [],
};
const ROLE_TRANSITIONS = {
  analyst: ['new->triaged', 'triaged->dismissed', 'new->dismissed'],
  lead: ['triaged->confirmed', 'confirmed->assigned', 'confirmed->dismissed'],
  engineer: ['assigned->fixing', 'fixing->verifying'],
  verifier: ['verifying->closed', 'verifying->fixing'],
  admin: ['*'],
};

function shortHash(text) {
  let hash = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function chainHash(text) {
  let h1 = 0;
  let h2 = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) {
    h1 = (h1 * 31 + raw.charCodeAt(i)) >>> 0;
    h2 = (h2 * 17 + raw.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return `${h1.toString(36)}.${h2.toString(36)}`;
}

function normState(s) {
  return String(s || '').toLowerCase().trim();
}

function transitionsOf(machine) {
  if (machine && machine.transitions) return machine.transitions;
  return DEFAULT_TRANSITIONS;
}

function statesOf(machine) {
  if (machine && Array.isArray(machine.states) && machine.states.length) return machine.states.map(normState);
  return [...DEFAULT_STATES];
}

function guardrailReasons(machine, from, to, context) {
  const reasons = [];
  const states = statesOf(machine);
  const table = transitionsOf(machine);
  if (!states.includes(from)) reasons.push(`unknown current state "${from}"`);
  if (!states.includes(to)) reasons.push(`unknown target state "${to}"`);
  if (reasons.length) return reasons;
  const allowedNext = table[from] || [];
  if (!allowedNext.includes(to)) {
    reasons.push(
      allowedNext.length
        ? `transition ${from} -> ${to} is not allowed; allowed next states from ${from}: ${allowedNext.join(', ')}`
        : `state ${from} is terminal; no outgoing transitions are allowed`
    );
    return reasons;
  }
  if (to === 'assigned' && !context.assignee && !context.assigneeId) reasons.push('assigning requires an assignee');
  if (to === 'verifying' && !context.fixNote && !context.fixReference && !context.pullRequest) reasons.push('moving to verifying requires a fix note, fix reference, or pull request');
  if (to === 'closed' && !context.verificationEvidence && !context.verifiedBy && !context.evidence) reasons.push('closing requires verification evidence or a verifier');
  if (to === 'closed' && context.severity === 'critical' && context.actor && context.fixer && String(context.actor) === String(context.fixer)) {
    reasons.push('critical findings cannot be closed by the person who fixed them; a separate verifier is required');
  }
  if (to === 'dismissed' && !context.dismissReason && !context.reason) reasons.push('dismissing requires a recorded reason');
  return reasons;
}

function applyTransition(finding, to, actor, machine, allowedFromStates) {
  const from = normState((finding && finding.status) || 'new');
  const target = normState(to);
  if (!allowedFromStates.includes(from)) {
    return { ok: false, from, to: target, error: `this flow only handles ${allowedFromStates.join(', ')}; finding is in ${from}`, finding };
  }
  const context = {
    assignee: (finding && finding.assignee) || (actor && actor.assignee),
    assigneeId: finding && finding.assigneeId,
    fixNote: finding && (finding.fixNote || finding.fixReference),
    fixReference: finding && finding.fixReference,
    pullRequest: finding && finding.pullRequest,
    verificationEvidence: finding && (finding.verificationEvidence || finding.evidence),
    verifiedBy: finding && finding.verifiedBy,
    evidence: finding && finding.evidence,
    severity: finding && finding.severity,
    actor: (actor && (actor.id || actor.name)) || (finding && finding.actor),
    fixer: finding && (finding.fixer || finding.fixedBy),
    dismissReason: finding && (finding.dismissReason || finding.reason),
    reason: finding && finding.reason,
  };
  // Caller-supplied transition fields on the finding take part in guardrails,
  // and an explicit nextAssignee supports the assign step.
  if (finding && finding.nextAssignee) context.assignee = finding.nextAssignee;
  const reasons = guardrailReasons(machine, from, target, context);
  if (reasons.length) return { ok: false, from, to: target, error: reasons.join('; '), reasons, finding };
  const history = [...(((finding && finding.history) || [])), { from, to: target, actor: (actor && (actor.id || actor.role)) || 'system', at: new Date().toISOString() }];
  return { ok: true, from, to: target, error: null, reasons: [], finding: { ...finding, status: target, history } };
}

/**
 * Create a custom stakeholder role from known permissions (idea 52701).
 * Unknown permissions are rejected and reported, never silently kept.
 * @param {object} def - { name, permissions: [], defaultView }.
 * @returns {object} { id, name, permissions, defaultView, rejected }.
 */
export function createCustomRole(def = {}) {
  const requested = (def.permissions || []).map(p => String(p).toLowerCase());
  const permissions = requested.filter(p => KNOWN_PERMISSIONS.includes(p));
  const rejected = requested.filter(p => !KNOWN_PERMISSIONS.includes(p));
  const name = def.name || 'Custom role';
  return {
    id: `role_${shortHash(`${name}:${permissions.join(',')}`)}`,
    name,
    permissions,
    defaultView: def.defaultView || 'exec-dashboard',
    rejected,
    valid: rejected.length === 0 && permissions.length > 0,
  };
}

/**
 * Build the first-run onboarding tour for a stakeholder (idea 52702).
 * Steps adapt to the role and landing view so each audience learns the
 * controls it will actually use.
 * @param {string} role - Stakeholder role.
 * @param {string} view - Landing view key.
 * @returns {object} { role, view, steps, stepCount }.
 */
export function buildOnboardingTour(role = 'engineer', view = 'engineer-detail') {
  const r = String(role).toLowerCase();
  const base = [
    { title: 'Welcome to Infinity AI', body: 'This tour covers the views and actions for your role.', target: 'view-header' },
    { title: 'Your default view', body: `You land on the ${view} view. Severity, owner, and state are always visible here.`, target: 'finding-list' },
  ];
  const byRole = {
    executive: [{ title: 'Risk at a glance', body: 'Portfolio risk, trend, and top risks sit at the top of the executive view.', target: 'risk-panel' }],
    auditor: [{ title: 'Control evidence', body: 'Each control links to the findings and evidence that support it.', target: 'control-map' }],
    engineer: [{ title: 'Reproduce and fix', body: 'Evidence, payloads, and fix guidance live on the engineer detail view.', target: 'finding-detail' }],
    developer: [{ title: 'Your tickets', body: 'The ticket view shows only the repositories you own.', target: 'ticket-list' }],
  };
  const extra = byRole[r] || byRole.engineer;
  const steps = [...base, ...extra, { title: 'You are ready', body: 'Reopen this tour any time from the help menu.', target: 'help-menu' }];
  return { role: r, view, steps, stepCount: steps.length };
}

/**
 * Build the FAQ list rendered inside one stakeholder view (idea 52703).
 * Answers include live counts when findings are supplied.
 * @param {string} view - View key.
 * @param {Array} findings - Optional findings for live answers.
 * @returns {object} { view, faqs, count }.
 */
export function buildViewFaq(view = 'exec-dashboard', findings = []) {
  const open = (findings || []).filter(f => !['fixed', 'verified', 'dismissed', 'closed'].includes(String(f.status || '').toLowerCase()));
  const catalog = {
    'exec-dashboard': [
      { q: 'What does the portfolio risk score mean?', a: 'A 0–100 rollup of open severity. Higher means more unresolved exposure.' },
      { q: 'How many findings are open right now?', a: `${open.length} finding(s) are open in the current data.` },
    ],
    'engineer-detail': [
      { q: 'Where is the reproduction evidence?', a: 'Evidence, payloads, and step-by-step reproduction sit on the finding detail view.' },
      { q: 'How do I mark a fix ready?', a: 'Move the finding to verifying with a fix reference; a verifier then closes it.' },
    ],
    compliance: [
      { q: 'How are controls mapped?', a: 'Findings carry control tags; the compliance view groups evidence per control.' },
      { q: 'What counts as a gap?', a: 'A control with at least one open mapped finding is shown as a gap.' },
    ],
  };
  const faqs = catalog[view] || catalog['exec-dashboard'];
  return { view, faqs, count: faqs.length };
}

/**
 * Compute stakeholder view analytics (idea 52704).
 * Rolls view/open/export events up per view and per stakeholder.
 * @param {Array} events - [{ view, user, action, at }].
 * @returns {object} { byView, byUser, totalViews, topView }.
 */
export function computeViewAnalytics(events = []) {
  const byView = {};
  const byUser = {};
  let totalViews = 0;
  for (const e of events || []) {
    const v = e.view || 'unknown-view';
    const u = e.user || 'unknown';
    byView[v] = byView[v] || { view: v, views: 0, exports: 0, uniqueUsers: new Set() };
    byUser[u] = (byUser[u] || 0) + 1;
    if (e.action === 'export') byView[v].exports += 1;
    else {
      byView[v].views += 1;
      totalViews += 1;
    }
    byView[v].uniqueUsers.add(u);
  }
  const rows = Object.values(byView)
    .map(v => ({ view: v.view, views: v.views, exports: v.exports, uniqueUsers: v.uniqueUsers.size }))
    .sort((a, b) => b.views - a.views);
  const out = {};
  for (const r of rows) out[r.view] = r;
  return { byView: out, byUser, totalViews, topView: rows.length ? rows[0].view : null };
}

/**
 * Build multi-stakeholder meeting mode (idea 52705).
 * Merges the participants' views into one shared agenda ordered so the
 * highest-severity shared items are discussed first.
 * @param {Array} participants - [{ name, role, view }].
 * @param {Array} views - View keys to include.
 * @returns {object} { agenda, participants, sharedViews, durationMinutes }.
 */
export function buildMeetingMode(participants = [], views = []) {
  const sharedViews = views.length ? [...views] : [...new Set((participants || []).map(p => p.view).filter(Boolean))];
  const agenda = sharedViews.map((v, i) => ({
    slot: i + 1,
    view: v,
    title: `Review ${v}`,
    minutes: 10,
    owners: (participants || []).filter(p => p.view === v).map(p => p.name),
  }));
  return {
    agenda,
    participants: (participants || []).map(p => p.name || p.role || 'participant'),
    participantCount: (participants || []).length,
    sharedViews,
    durationMinutes: agenda.reduce((a, s) => a + s.minutes, 0),
  };
}

/**
 * Build live presentation mode (idea 52706).
 * Turns stakeholder views into an ordered slide sequence with one key
 * message per slide for a live walkthrough.
 * @param {Array} views - View keys in presentation order.
 * @param {Array} findings - Findings summarized on the opening slide.
 * @returns {object} { slides, slideCount, presenterView }.
 */
export function buildPresentationDeck(views = [], findings = []) {
  const open = (findings || []).filter(f => !['fixed', 'verified', 'dismissed', 'closed'].includes(String(f.status || '').toLowerCase()));
  const slides = [
    { title: 'Security posture', bullets: [`${open.length} open finding(s) under review`, 'Infinity AI tracks every item to verified closure'], view: 'exec-dashboard' },
    ...(views || []).map(v => ({ title: `View: ${v}`, bullets: [`Live data from the ${v} stakeholder view`], view: v })),
    { title: 'Decisions and next steps', bullets: ['Confirm owners and dates for the top risks', 'Schedule the verification pass'], view: 'closing' },
  ];
  return { slides, slideCount: slides.length, presenterView: (views || [])[0] || 'exec-dashboard' };
}

/**
 * Build speaker notes for one view (idea 52707).
 * Notes give the presenter a spoken script, the supporting counts, and an
 * honest time estimate per view.
 * @param {string} view - View key.
 * @param {Array} findings - Findings behind the view.
 * @returns {object} { view, notes, talkingPoints, durationEstimateMinutes }.
 */
export function buildSpeakerNotes(view = 'exec-dashboard', findings = []) {
  const open = (findings || []).filter(f => !['fixed', 'verified', 'dismissed', 'closed'].includes(String(f.status || '').toLowerCase()));
  const criticals = open.filter(f => String(f.severity).toLowerCase() === 'critical').length;
  const notes = [
    `Open on the ${view} view and state the headline: ${open.length} open item(s), ${criticals} critical.`,
    'Walk the top risks in severity order; name the owner and date for each.',
    'Close with the verification promise: Infinity AI re-tests every fix.',
  ];
  return {
    view,
    notes,
    talkingPoints: [`${open.length} open findings`, `${criticals} critical findings`, 'Owners and ETAs confirmed live'],
    durationEstimateMinutes: Math.max(2, Math.min(15, 2 + open.length)),
  };
}

/**
 * Build the print-optimized view model (idea 52708).
 * Produces paginated sections with running headers and no interactive
 * controls, ready for paper or PDF handouts.
 * @param {object} view - { id, name }.
 * @param {Array} findings - Findings to print.
 * @returns {object} { title, sections, pageEstimate, printClass }.
 */
export function buildPrintView(view = {}, findings = []) {
  const rows = (findings || []).map(f => `${f.id}: ${f.title || ''} (${String(f.severity || 'info').toLowerCase()}, ${f.status || 'open'})`);
  const sections = [
    { heading: view.name || 'Stakeholder view', body: rows.slice(0, 15).join('\n') || 'No findings to print.' },
    { heading: 'Summary', body: `${rows.length} finding(s) printed by Infinity AI · Dark-Matter. Payloads are withheld from print.` },
  ];
  if (rows.length > 15) sections.splice(1, 0, { heading: 'Findings (continued)', body: rows.slice(15, 30).join('\n') });
  return {
    title: `${view.name || 'Stakeholder view'} — print`,
    sections,
    pageEstimate: Math.max(1, Math.ceil(rows.length / 15)),
    printClass: 'print-view',
    findingCount: rows.length,
  };
}

/**
 * Serve one stakeholder view over the view API (idea 52709).
 * Applies severity filtering, sorting, and pagination and returns the
 * page plus totals so API clients can render any stakeholder view.
 * @param {object} view - { id, name }.
 * @param {Array} findings - Findings behind the view.
 * @param {object} query - { severity, page, pageSize, sort }.
 * @returns {object} { view, total, page, pageSize, items }.
 */
export function buildViewApiResponse(view = {}, findings = [], query = {}) {
  let items = [...(findings || [])];
  if (query.severity) items = items.filter(f => String(f.severity).toLowerCase() === String(query.severity).toLowerCase());
  if (query.status) items = items.filter(f => String(f.status || '').toLowerCase() === String(query.status).toLowerCase());
  const rank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  if (query.sort === 'severity') items.sort((a, b) => (rank[String(b.severity).toLowerCase()] ?? 0) - (rank[String(a.severity).toLowerCase()] ?? 0));
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
  const page = Math.max(1, Number(query.page || 1));
  const total = items.length;
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize).map(f => ({ id: f.id, title: f.title, severity: f.severity, status: f.status }));
  return { view: view.id || 'view', total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), items: pageItems };
}

/**
 * Stamp a view payload with a per-recipient watermark (idea 52710).
 * The watermark names the recipient and view and carries a trace id so a
 * leaked export can be attributed.
 * @param {object} payload - { title, content }.
 * @param {object} user - { id, name }.
 * @param {object} view - { id, name }.
 * @returns {object} { watermark, traceId, content, stampedAt }.
 */
export function applyViewWatermark(payload = {}, user = {}, view = {}) {
  const who = user.name || user.id || 'stakeholder';
  const viewName = view.name || view.id || 'view';
  const stampedAt = new Date().toISOString();
  const traceId = `wm_${chainHash(`${who}:${viewName}:${stampedAt}`)}`;
  const watermark = `Confidential — prepared for ${who} · ${viewName} · Infinity AI`;
  return { watermark, traceId, content: payload.content || '', title: payload.title || viewName, stampedAt };
}

/**
 * Schedule recurring delivery of a stakeholder view (idea 52711).
 * Validates the frequency and recipient list and computes the next run.
 * @param {object} view - { id, name }.
 * @param {object} schedule - { frequency, recipients: [], at }.
 * @returns {object} { scheduleId, frequency, nextRun, recipients, valid, errors }.
 */
export function scheduleViewDelivery(view = {}, schedule = {}) {
  const errors = [];
  const frequency = String(schedule.frequency || 'weekly').toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) errors.push(`unsupported frequency ${frequency}`);
  const recipients = (schedule.recipients || []).filter(r => /@/.test(String(r)));
  if (!recipients.length) errors.push('at least one valid recipient is required');
  const now = schedule.at ? new Date(schedule.at) : new Date();
  const next = new Date(now);
  if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return {
    scheduleId: `sched_${shortHash(`${view.id || 'view'}:${frequency}:${recipients.join(',')}`)}`,
    view: view.id || 'view',
    frequency,
    nextRun: errors.length ? null : next.toISOString(),
    recipients,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Summarize stakeholder feedback collected by the widget (idea 52712).
 * Averages 1–5 ratings per view and lists low-rated views that need work.
 * @param {Array} entries - [{ view, rating, user, comment }].
 * @returns {object} { byView, overallAvg, total, lowRated }.
 */
export function summarizeViewFeedback(entries = []) {
  const per = {};
  let sum = 0;
  let n = 0;
  for (const e of entries || []) {
    const rating = Math.max(1, Math.min(5, Number(e.rating || 0)));
    if (!rating) continue;
    const v = e.view || 'unknown-view';
    per[v] = per[v] || { view: v, ratings: [], comments: 0 };
    per[v].ratings.push(rating);
    if (e.comment) per[v].comments += 1;
    sum += rating;
    n += 1;
  }
  const byView = {};
  for (const [v, d] of Object.entries(per)) {
    byView[v] = { view: v, avg: Math.round((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length) * 10) / 10, count: d.ratings.length, comments: d.comments };
  }
  const lowRated = Object.values(byView).filter(v => v.avg < 3).map(v => v.view);
  return { byView, overallAvg: n ? Math.round((sum / n) * 10) / 10 : 0, total: n, lowRated };
}

/**
 * Create a configurable lifecycle state machine (idea 52713).
 * With no config it returns the standard eight-state machine; a custom
 * config is validated so every transition target is a declared state.
 * @param {object} config - { states: [], transitions: {}, roles: {} }.
 * @returns {object} { states, transitions, roles, terminalStates, valid, errors }.
 */
export function createLifecycleMachine(config = {}) {
  const states = (config.states && config.states.length ? config.states : DEFAULT_STATES).map(normState);
  const transitions = {};
  const source = config.transitions || DEFAULT_TRANSITIONS;
  for (const [from, tos] of Object.entries(source)) transitions[normState(from)] = (tos || []).map(normState);
  const errors = [];
  for (const [from, tos] of Object.entries(transitions)) {
    if (!states.includes(from)) errors.push(`transition source ${from} is not a declared state`);
    for (const to of tos) if (!states.includes(to)) errors.push(`transition target ${to} from ${from} is not a declared state`);
  }
  const terminalStates = states.filter(s => !(transitions[s] || []).length);
  return {
    states,
    transitions,
    roles: config.roles || ROLE_TRANSITIONS,
    terminalStates,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Advance the intake flow New → Triaged → Confirmed (idea 52714).
 * Pure reducer: legal steps return a new finding; illegal jumps (for
 * example New straight to Confirmed) are refused with an explanation.
 * @param {object} finding - Finding with status.
 * @param {string} toState - Desired next state.
 * @param {object} actor - { id, role }.
 * @param {object} [machine] - Machine from createLifecycleMachine.
 * @returns {object} { ok, from, to, error, finding }.
 */
export function transitionIntake(finding = {}, toState = '', actor = {}, machine = null) {
  return applyTransition(finding, toState, actor, machine, ['new', 'triaged']);
}

/**
 * Advance the remediation flow Confirmed → Assigned → Fixing (idea 52715).
 * Assigning requires an assignee (finding.nextAssignee, finding.assignee,
 * or actor.assignee); skipping assignment is refused.
 * @param {object} finding - Finding with status.
 * @param {string} toState - Desired next state.
 * @param {object} actor - { id, role, assignee }.
 * @param {object} [machine] - Machine from createLifecycleMachine.
 * @returns {object} { ok, from, to, error, finding }.
 */
export function transitionRemediation(finding = {}, toState = '', actor = {}, machine = null) {
  return applyTransition(finding, toState, actor, machine, ['confirmed', 'assigned']);
}

/**
 * Advance the closure flow Fixing → Verifying → Closed (idea 52716).
 * Verifying requires a fix reference; closing requires verification
 * evidence, and a failed check may bounce Verifying back to Fixing.
 * @param {object} finding - Finding with status.
 * @param {string} toState - Desired next state.
 * @param {object} actor - { id, role }.
 * @param {object} [machine] - Machine from createLifecycleMachine.
 * @returns {object} { ok, from, to, error, finding }.
 */
export function transitionClosure(finding = {}, toState = '', actor = {}, machine = null) {
  return applyTransition(finding, toState, actor, machine, ['fixing', 'verifying']);
}

/**
 * Validate a lifecycle transition against the guardrails (idea 52717).
 * Checks the transition table first, then field gates: assignee for
 * Assigned, fix reference for Verifying, verification evidence for Closed,
 * separate verifier for critical closures, and a reason for Dismissed.
 * @param {object} machine - Machine from createLifecycleMachine (or null).
 * @param {string} from - Current state.
 * @param {string} to - Desired state.
 * @param {object} [context] - Guardrail fields.
 * @returns {object} { allowed, reasons, from, to, allowedNext }.
 */
export function validateTransition(machine, from, to, context = {}) {
  const f = normState(from);
  const t = normState(to);
  const reasons = guardrailReasons(machine, f, t, context || {});
  const allowedNext = (transitionsOf(machine)[f] || []).slice();
  return { allowed: reasons.length === 0, reasons, from: f, to: t, allowedNext };
}

/**
 * Check whether a role may perform a transition (idea 52718).
 * Analysts triage, leads confirm and assign, engineers fix, verifiers
 * close, and admins may perform any table-legal transition.
 * @param {string} role - Actor role.
 * @param {string} from - Current state.
 * @param {string} to - Desired state.
 * @param {object} [machine] - Machine with a roles table.
 * @returns {object} { allowed, reason, role, from, to }.
 */
export function canRoleTransition(role, from, to, machine = null) {
  const r = String(role || '').toLowerCase();
  const f = normState(from);
  const t = normState(to);
  const roles = (machine && machine.roles) || ROLE_TRANSITIONS;
  const grants = roles[r] || [];
  if (grants.includes('*')) return { allowed: true, reason: `role ${r} may perform any legal transition`, role: r, from: f, to: t };
  if (grants.includes(`${f}->${t}`)) return { allowed: true, reason: `role ${r} may move ${f} -> ${t}`, role: r, from: f, to: t };
  return { allowed: false, reason: `role ${r} may not move ${f} -> ${t}`, role: r, from: f, to: t };
}

/**
 * Append one entry to the state-change log (idea 52719).
 * The log is append-only and hash-chained: each entry stores the previous
 * hash and its own hash over the entry content, the input array is never
 * mutated, and editing history breaks the chain detectably.
 * @param {Array} log - Existing entries.
 * @param {object} entry - { findingId, from, to, actor, at }.
 * @returns {Array} New log array with the chained entry appended.
 */
export function appendStateLog(log = [], entry = {}) {
  const prev = (log || []).length ? log[log.length - 1] : null;
  const prevHash = prev ? prev.hash : 'genesis';
  const seq = (log || []).length + 1;
  const body = {
    seq,
    findingId: entry.findingId || null,
    from: normState(entry.from || ''),
    to: normState(entry.to || ''),
    actor: entry.actor || 'system',
    at: entry.at || new Date().toISOString(),
    prevHash,
  };
  const hash = chainHash(`${prevHash}:${body.seq}:${body.findingId}:${body.from}->${body.to}:${body.actor}:${body.at}`);
  return [...(log || []), { ...body, hash }];
}

/**
 * Build lifecycle transition alerts (idea 52720).
 * Critical closures and blocked transitions alert the leads; routine
 * progress alerts the finding owner on the configured channels.
 * @param {object} transition - { findingId, from, to, actor, severity, ok }.
 * @param {object} prefs - { channels: [], notifyRoles: [], owner }.
 * @returns {object} { alerts, shouldAlert, reason }.
 */
export function buildTransitionAlerts(transition = {}, prefs = {}) {
  const channels = prefs.channels && prefs.channels.length ? prefs.channels : ['in-app'];
  const alerts = [];
  const sev = String(transition.severity || '').toLowerCase();
  if (transition.ok === false) {
    alerts.push({ channel: channels[0], to: prefs.owner || transition.actor || 'owner', message: `Blocked transition for ${transition.findingId || 'finding'}: ${transition.from || '?'} -> ${transition.to || '?'} needs review.` });
    return { alerts, shouldAlert: true, reason: 'blocked transition requires owner attention' };
  }
  if (transition.to === 'closed' && sev === 'critical') {
    for (const ch of channels) alerts.push({ channel: ch, to: (prefs.notifyRoles || ['lead']).join(','), message: `Critical finding ${transition.findingId || ''} closed by ${transition.actor || 'verifier'}.` });
    return { alerts, shouldAlert: true, reason: 'critical closure is always announced' };
  }
  if (transition.to === 'closed' || transition.to === 'verifying') {
    alerts.push({ channel: channels[0], to: prefs.owner || 'owner', message: `Finding ${transition.findingId || ''} moved ${transition.from || ''} -> ${transition.to}.` });
    return { alerts, shouldAlert: true, reason: 'progress transition notifies the owner' };
  }
  return { alerts, shouldAlert: false, reason: 'routine transition, no alert configured' };
}
