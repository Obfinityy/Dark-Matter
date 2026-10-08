/**
 * lifecycleGovernCore.js — Infinity AI · Dark-Matter · Wave 60 (ideas 52361–52380)
 * Pure JS (no React / DOM / network). Deterministic finding-lifecycle state
 * governance: legal transition graph, per-role permissions, immutable
 * append-only audit log, notifications, bulk transitions, SLA timers,
 * kanban dashboard payloads, per-finding timelines, mandatory reasons,
 * grace-window undo, parking/duplicate/won't-fix/risk-accepted/deferred/
 * blocked states, the Verified-vs-Closed distinction, reopening with a link
 * to the original closure, retest-driven auto-transitions, and webhook
 * payloads. Time is injected via `now` params (default Date.now()) so every
 * function is reproducible.
 */

export const WAVE60_GOVERN_IDEAS = [
  { id: 52361, title: 'State transition rules', desc: 'Define which transitions are legal (e.g., Verified cannot go back to New) to keep lifecycles clean.', skip: false },
  { id: 52362, title: 'Per-role state permissions', desc: 'Control who can move findings into sensitive states like Closed or Risk Accepted.', skip: false },
  { id: 52363, title: 'State-change audit log', desc: 'Immutable record of every state change with actor, timestamp, and reason.', skip: false },
  { id: 52364, title: 'State-change notifications (post-hunt)', desc: 'Notify watchers and assignees instantly when a finding they follow changes state.', skip: false },
  { id: 52365, title: 'Bulk state transitions', desc: 'Move many findings to a new state at once with a shared reason and confirmation preview.', skip: false },
  { id: 52366, title: 'State SLA timers', desc: 'Per-state time targets (e.g., Triaged within 48h) with breach alerts.', skip: false },
  { id: 52367, title: 'Lifecycle dashboard', desc: 'Counts and aging per state, per team, per severity, in one kanban-style view.', skip: false },
  { id: 52368, title: 'State timeline per finding', desc: 'Visual timeline of a finding\u2019s journey from discovery to closure.', skip: false },
  { id: 52369, title: 'Mandatory state-change reasons', desc: 'Require a reason note for key transitions (closing, risk-accepting) to preserve context.', skip: false },
  { id: 52370, title: 'State undo', desc: 'Revert an accidental state change within a grace window, fully restoring prior metadata.', skip: false },
  { id: 52371, title: '"Needs info" state', desc: 'Park findings awaiting more data (from agent, reporter, or vendor) without losing them.', skip: false },
  { id: 52372, title: '"Duplicate" state with link', desc: 'Mark duplicates while linking to the canonical finding, merging evidence automatically.', skip: false },
  { id: 52373, title: '"Won\'t fix" state with reason', desc: 'Close with documented rationale (e.g., "legacy system, sunset in Q1") and approver.', skip: false },
  { id: 52374, title: '"Risk accepted" state', desc: 'Formal risk-acceptance with owner, expiry date, and compensating controls noted.', skip: false },
  { id: 52375, title: '"Deferred" state with date', desc: 'Postpone to a specific future date; the finding auto-reopens for review then.', skip: false },
  { id: 52376, title: '"Blocked" state with reason', desc: 'Flag findings blocked on external dependencies (vendor patch, third party) with the blocker noted.', skip: false },
  { id: 52377, title: '"Verified" vs "Closed" distinction', desc: 'Separate technical verification (fix works) from administrative closure (paperwork done).', skip: false },
  { id: 52378, title: '"Reopened" state', desc: 'Distinct state for regressions with a link to the original closure for root-cause analysis.', skip: false },
  { id: 52379, title: 'Auto-transitions on retest', desc: 'A passing verification retest auto-moves the finding to Verified; a failing one reopens it.', skip: false },
  { id: 52380, title: 'State-transition webhooks', desc: 'Fire webhooks on state changes to sync external systems (ticketing, chatops).', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `lg60_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* The canonical finding-lifecycle state set. */
export const LIFECYCLE_STATES = [
  'New', 'Triaged', 'NeedsInfo', 'InProgress', 'Blocked', 'Deferred',
  'InRetest', 'Verified', 'Duplicate', 'WontFix', 'RiskAccepted',
  'Closed', 'Reopened', 'Archived',
];

/* 52361 — State transition rules: legal-transition graph + canTransition. */
export const TRANSITION_GRAPH = {
  New: ['Triaged', 'Duplicate'],
  Triaged: ['NeedsInfo', 'InProgress', 'Deferred', 'Duplicate', 'WontFix', 'RiskAccepted', 'Blocked'],
  NeedsInfo: ['Triaged', 'InProgress', 'WontFix'],
  InProgress: ['NeedsInfo', 'InRetest', 'Blocked', 'WontFix', 'RiskAccepted'],
  Blocked: ['InProgress', 'Triaged', 'WontFix'],
  Deferred: ['Triaged'],
  InRetest: ['Verified', 'Reopened'],
  Verified: ['Closed', 'Reopened'],
  Duplicate: [],
  WontFix: ['Reopened'],
  RiskAccepted: ['Reopened', 'Closed'],
  Closed: ['Reopened', 'Archived'],
  Reopened: ['Triaged', 'InProgress'],
  Archived: [],
};

export function canTransition(from, to) {
  if (!LIFECYCLE_STATES.includes(from) || !LIFECYCLE_STATES.includes(to)) {
    return { ok: false, legal: false, reason: `unknown state: ${from} or ${to}` };
  }
  if (from === to) return { ok: false, legal: false, reason: 'no-op: already in that state' };
  const legal = (TRANSITION_GRAPH[from] || []).includes(to);
  return legal
    ? { ok: true, legal: true, from, to }
    : { ok: false, legal: false, from, to, reason: `${from} \u2192 ${to} is illegal (Verified \u2192 New style regressions are blocked)` };
}

export function transitionRulesGraph() {
  return { ok: true, states: [...LIFECYCLE_STATES], graph: JSON.parse(JSON.stringify(TRANSITION_GRAPH)) };
}

export function legalTargets(from) {
  return { ok: true, from, targets: [...(TRANSITION_GRAPH[from] || [])] };
}

/* 52362 — Per-role state permissions for sensitive states. */
const ROLE_RANK = { hunter: 1, agent: 2, triager: 3, lead: 4, approver: 4, manager: 5, admin: 6 };
const MIN_ROLE_FOR_TARGET = {
  Closed: 'lead', WontFix: 'lead', RiskAccepted: 'manager', Archived: 'manager',
  Verified: 'triager', InRetest: 'triager',
};

export function canRoleTransition(role, from, to) {
  const gate = canTransition(from, to);
  if (!gate.ok) return { ok: false, role, ...gate };
  if (!ROLE_RANK[role]) return { ok: false, role, from, to, reason: `unknown role: ${role}` };
  const minRole = MIN_ROLE_FOR_TARGET[to];
  if (minRole && ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, role, from, to, reason: `${role} may not move findings to ${to}; requires ${minRole}+` };
  }
  return { ok: true, role, from, to };
}

export function roleStatePermissions() {
  return { ok: true, roles: Object.keys(ROLE_RANK), minRoleForTarget: { ...MIN_ROLE_FOR_TARGET } };
}

/* 52363 — Immutable append-only state-change audit log (entries frozen). */
export function appendStateAudit(log = [], entry = {}, now = Date.now()) {
  const rows = Array.isArray(log) ? log : [];
  const { actor, from, to, reason } = entry;
  if (!actor || !from || !to || !reason || String(reason).trim() === '') {
    return { ok: false, reason: 'audit entry requires actor, from, to, and a non-empty reason' };
  }
  const record = Object.freeze({
    id: tokenFor('audit', `${rows.length}:${actor}:${from}:${to}`, now),
    findingId: entry.findingId || null,
    actor,
    from,
    to,
    reason: String(reason),
    at: typeof entry.at === 'number' ? entry.at : now,
    priorMeta: entry.priorMeta ? Object.freeze({ ...entry.priorMeta }) : null,
  });
  return { ok: true, log: [...rows, record], entry: record };
}

export function readAuditLog(log = []) {
  return { ok: true, entries: Array.isArray(log) ? [...log] : [] };
}

/* 52364 — State-change notification builder for watchers and assignees. */
export function notifyStateChange({ findingId, from, to, by, reason, watchers = [], channels = ['inapp', 'email'], now = Date.now() } = {}) {
  if (!findingId || !from || !to) return { ok: false, reason: 'findingId, from, and to are required' };
  const audience = Array.isArray(watchers) ? watchers : [];
  const notifications = audience.map((w, i) => ({
    id: tokenFor('notify', `${findingId}:${i}`, now + i),
    findingId,
    to: typeof w === 'string' ? w : w.id || w.email || `watcher-${i}`,
    channel: channels,
    subject: `Finding ${findingId}: ${from} \u2192 ${to}`,
    body: `${by || 'Infinity AI'} moved finding ${findingId} from ${from} to ${to}. Reason: ${reason || 'not provided'}.`,
    from,
    to,
    by: by || 'Infinity AI',
    reason: reason || null,
    at: now,
  }));
  return { ok: true, findingId, from, to, count: notifications.length, notifications };
}

/* 52365 — Bulk state transitions with shared reason + confirmation preview. */
export function bulkTransitionPreview(findings = [], to, now = Date.now()) {
  const rows = Array.isArray(findings) ? findings : [];
  const items = rows.map((f) => {
    const gate = canTransition(f.state, to);
    return { id: f.id, from: f.state, to, ok: gate.ok, reason: gate.ok ? null : gate.reason };
  });
  return {
    ok: true,
    preview: true,
    to,
    legal: items.filter((i) => i.ok),
    illegal: items.filter((i) => !i.ok),
    counts: { legal: items.filter((i) => i.ok).length, illegal: items.filter((i) => !i.ok).length, total: items.length },
  };
}

export function bulkTransition(findings = [], to, { reason, actor = 'Infinity AI', now = Date.now(), previewOnly = false } = {}) {
  const rows = Array.isArray(findings) ? findings : [];
  if (previewOnly || !reason || String(reason).trim() === '') {
    return { ...bulkTransitionPreview(rows, to, now), applied: false, needsReason: !reason };
  }
  const results = [];
  let log = [];
  for (const f of rows) {
    const gate = canTransition(f.state, to);
    if (!gate.ok) {
      results.push({ id: f.id, from: f.state, to, ok: false, reason: gate.reason });
      continue;
    }
    const appended = appendStateAudit(log, { findingId: f.id, actor, from: f.state, to, reason, at: now });
    log = appended.log;
    results.push({ id: f.id, from: f.state, to, ok: true, auditId: appended.entry.id });
  }
  return {
    ok: true,
    applied: true,
    to,
    reason: String(reason),
    actor,
    results,
    auditLog: log,
    counts: { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, total: results.length },
  };
}

/* 52366 — Per-state SLA timers + breach check. */
const HOUR = 3600000;
export const STATE_SLA_MS = {
  New: 24 * HOUR,
  Triaged: 48 * HOUR,
  NeedsInfo: 72 * HOUR,
  InProgress: 7 * 24 * HOUR,
  InRetest: 48 * HOUR,
  Verified: 72 * HOUR,
  Reopened: 24 * HOUR,
  Blocked: null,
  Deferred: null,
  Duplicate: null,
  WontFix: null,
  RiskAccepted: null,
  Closed: null,
  Archived: null,
};

export function slaConfig() {
  return { ok: true, slaMs: { ...STATE_SLA_MS } };
}

export function slaBreachCheck(state, enteredAt, now = Date.now()) {
  const target = STATE_SLA_MS[state];
  if (!(state in STATE_SLA_MS)) return { ok: false, reason: `unknown state: ${state}` };
  if (target === null) return { ok: true, state, hasSla: false };
  const elapsed = now - enteredAt;
  return {
    ok: true,
    state,
    hasSla: true,
    targetMs: target,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, target - elapsed),
    breached: elapsed > target,
    breachByMs: Math.max(0, elapsed - target),
  };
}

/* 52367 — Lifecycle dashboard: kanban payload with counts + aging per state. */
export function lifecycleDashboard(findings = [], now = Date.now()) {
  const rows = Array.isArray(findings) ? findings : [];
  const columns = LIFECYCLE_STATES.map((state) => {
    const inState = rows.filter((f) => f.state === state);
    const ages = inState
      .map((f) => (typeof f.stateEnteredAt === 'number' ? now - f.stateEnteredAt : null))
      .filter((a) => a !== null);
    const totalAge = ages.reduce((a, b) => a + b, 0);
    const bySeverity = {};
    for (const f of inState) {
      const sev = (f.severity || 'unknown').toLowerCase();
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    return {
      state,
      count: inState.length,
      findings: inState.map((f) => f.id),
      totalAgeMs: totalAge,
      avgAgeMs: ages.length ? totalAge / ages.length : null,
      oldestMs: ages.length ? Math.max(...ages) : null,
      bySeverity,
    };
  });
  return { ok: true, total: rows.length, columns, generatedAt: now };
}

/* 52368 — Per-finding state timeline built from the audit log. */
export function buildStateTimeline(log = [], findingId) {
  const rows = (Array.isArray(log) ? log : [])
    .filter((e) => !findingId || e.findingId === findingId)
    .slice()
    .sort((a, b) => a.at - b.at);
  const timeline = rows.map((e, i) => ({
    ...e,
    durationInPriorStateMs: i === 0 ? null : e.at - rows[i - 1].at,
  }));
  const totalMs = rows.length >= 2 ? rows[rows.length - 1].at - rows[0].at : null;
  return { ok: true, findingId: findingId || null, steps: timeline.length, timeline, totalMs };
}

/* 52369 — Mandatory state-change reasons for key transitions. */
const REASON_REQUIRED_TARGETS = new Set(['Closed', 'WontFix', 'RiskAccepted', 'Duplicate', 'Reopened', 'Archived']);

export function requireChangeReason(from, to, reason) {
  if (!REASON_REQUIRED_TARGETS.has(to)) return { ok: true, required: false, from, to };
  if (!reason || String(reason).trim() === '') {
    return { ok: false, required: true, from, to, missing: true, reason: `a reason note is mandatory for ${from} \u2192 ${to}` };
  }
  return { ok: true, required: true, from, to, reason: String(reason) };
}

export function reasonRequiredTargets() {
  return { ok: true, targets: [...REASON_REQUIRED_TARGETS] };
}

/* 52370 — Grace-window undo: revert an accidental state change. */
export const DEFAULT_UNDO_GRACE_MS = 15 * 60 * 1000;

export function undoTransition(auditEntry, graceWindowMs = DEFAULT_UNDO_GRACE_MS, now = Date.now()) {
  if (!auditEntry || typeof auditEntry !== 'object' || !auditEntry.from || !auditEntry.to) {
    return { ok: false, reason: 'a valid audit entry is required' };
  }
  const age = now - auditEntry.at;
  if (age < 0) return { ok: false, reason: 'audit entry is in the future' };
  if (age > graceWindowMs) {
    return { ok: false, reason: `grace window expired (${age}ms > ${graceWindowMs}ms)` };
  }
  return {
    ok: true,
    undone: true,
    restore: {
      to: auditEntry.from,
      priorMeta: auditEntry.priorMeta ? { ...auditEntry.priorMeta } : null,
      originalTransitionId: auditEntry.id,
      undoneAt: now,
      undoneByWindowMs: graceWindowMs - age,
    },
  };
}

/* 52371 — "Needs info" parking state factory. */
export function parkNeedsInfo(finding, { question, requestedFrom, now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (!question || String(question).trim() === '') return { ok: false, reason: 'a question describing the missing info is required' };
  const gate = canTransition(finding.state, 'NeedsInfo');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'NeedsInfo',
    park: {
      question: String(question),
      requestedFrom: requestedFrom || null,
      parkedAt: now,
      priorState: finding.state,
    },
  };
}

/* 52372 — "Duplicate" state with canonical link + evidence merge. */
export function markDuplicate(finding, canonical, { mergeEvidence = true, reason, now = Date.now() } = {}) {
  if (!finding || !finding.id || !canonical || !canonical.id) {
    return { ok: false, reason: 'both the duplicate finding and the canonical finding need ids' };
  }
  if (finding.id === canonical.id) return { ok: false, reason: 'a finding cannot duplicate itself' };
  const gate = canTransition(finding.state, 'Duplicate');
  if (!gate.ok) return { ok: false, ...gate };
  const own = Array.isArray(finding.evidence) ? finding.evidence : [];
  const canon = Array.isArray(canonical.evidence) ? canonical.evidence : [];
  const merged = mergeEvidence ? [...canon, ...own.filter((e) => !canon.includes(e))] : canon;
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'Duplicate',
    duplicateOf: canonical.id,
    mergedEvidence: merged,
    evidenceMergedCount: merged.length,
    reason: reason || `duplicate of ${canonical.id}`,
    at: now,
  };
}

/* 52373 — "Won't fix" state with documented rationale + approver. */
export function wontFix(finding, { rationale, approver, now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (!rationale || String(rationale).trim() === '') return { ok: false, reason: 'a documented rationale is required' };
  if (!approver) return { ok: false, reason: 'an approver is required to close as won\u2019t fix' };
  const gate = canTransition(finding.state, 'WontFix');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'WontFix',
    rationale: String(rationale),
    approver,
    decidedAt: now,
  };
}

/* 52374 — "Risk accepted" state: owner, expiry, compensating controls. */
export function riskAccepted(finding, { owner, expiryAt, compensatingControls = [], now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (!owner) return { ok: false, reason: 'a risk owner is required' };
  if (typeof expiryAt !== 'number' || expiryAt <= now) {
    return { ok: false, reason: 'expiryAt must be a future timestamp' };
  }
  const gate = canTransition(finding.state, 'RiskAccepted');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'RiskAccepted',
    owner,
    expiryAt,
    compensatingControls: Array.isArray(compensatingControls) ? compensatingControls : [],
    acceptedAt: now,
  };
}

export function riskAcceptanceExpired(acceptance, now = Date.now()) {
  if (!acceptance || typeof acceptance.expiryAt !== 'number') return { ok: false, reason: 'acceptance record required' };
  return { ok: true, expired: now >= acceptance.expiryAt, expiryAt: acceptance.expiryAt, checkedAt: now };
}

/* 52375 — "Deferred" state with auto-reopen date. */
export function deferFinding(finding, { reopenAt, note, now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (typeof reopenAt !== 'number' || reopenAt <= now) {
    return { ok: false, reason: 'reopenAt must be a future timestamp' };
  }
  const gate = canTransition(finding.state, 'Deferred');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'Deferred',
    reopenAt,
    note: note || null,
    deferredAt: now,
  };
}

export function checkDeferredDue(deferral, now = Date.now()) {
  if (!deferral || typeof deferral.reopenAt !== 'number') return { ok: false, reason: 'deferral record required' };
  return { ok: true, due: now >= deferral.reopenAt, reopenAt: deferral.reopenAt, checkedAt: now };
}

/* 52376 — "Blocked" state with dependency note. */
export function blockFinding(finding, { dependency, note, now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (!dependency || String(dependency).trim() === '') {
    return { ok: false, reason: 'the external dependency must be named' };
  }
  const gate = canTransition(finding.state, 'Blocked');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'Blocked',
    dependency: String(dependency),
    note: note || null,
    blockedAt: now,
  };
}

/* 52377 — Enforce the Verified (technical) vs Closed (administrative) distinction. */
export function verifiedVsClosedCheck(finding, closure = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  const retestEvidence = (finding.evidence || []).some((e) =>
    typeof e === 'object' && (e.kind === 'retest' || e.kind === 'retest-pass'));
  const retestRecord = finding.retest && finding.retest.passed === true;
  const verificationReady = Boolean(retestEvidence || retestRecord);
  const paperworkReady = Boolean(
    closure.summary && String(closure.summary).trim() !== '' && closure.closedBy
  );
  return {
    ok: true,
    findingId: finding.id,
    verified: {
      claimable: verificationReady,
      missing: verificationReady ? [] : ['retest record or passing retest evidence'],
    },
    closed: {
      claimable: verificationReady && paperworkReady,
      requires: ['technical verification first', 'closure summary', 'closed-by owner'],
      missing: [
        ...(verificationReady ? [] : ['technical verification (finding must be Verified first)']),
        ...(paperworkReady ? [] : ['closure summary and closed-by owner']),
      ],
    },
  };
}

/* 52378 — "Reopened" state with link to the original closure. */
export function reopenFinding(finding, { reason, by, originalClosure, now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (!reason || String(reason).trim() === '') return { ok: false, reason: 'a reopen reason is required' };
  if (!originalClosure || !originalClosure.id) return { ok: false, reason: 'a link to the original closure is required' };
  const gate = canTransition(finding.state, 'Reopened');
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to: 'Reopened',
    reason: String(reason),
    by: by || 'Infinity AI',
    originalClosureId: originalClosure.id,
    originallyClosedAt: originalClosure.closedAt || null,
    reopenedAt: now,
  };
}

/* 52379 — Auto-transitions on retest: pass \u2192 Verified, fail \u2192 Reopened. */
export function autoTransitionOnRetest(finding, { passed, retestId, by = 'Infinity AI', now = Date.now() } = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with an id is required' };
  if (typeof passed !== 'boolean') return { ok: false, reason: 'retest outcome (passed boolean) is required' };
  if (finding.state !== 'InRetest') {
    return { ok: false, reason: `auto-transition only applies from InRetest, not ${finding.state}` };
  }
  const to = passed ? 'Verified' : 'Reopened';
  const gate = canTransition(finding.state, to);
  if (!gate.ok) return { ok: false, ...gate };
  return {
    ok: true,
    findingId: finding.id,
    from: finding.state,
    to,
    retestId: retestId || null,
    by,
    reason: passed ? 'retest passed \u2014 fix confirmed' : 'retest failed \u2014 regression reopened',
    at: now,
    automatic: true,
  };
}

/* 52380 — State-transition webhook payload builder for external systems. */
export function transitionWebhookPayload(transition, targets = [], now = Date.now()) {
  if (!transition || !transition.findingId || !transition.from || !transition.to) {
    return { ok: false, reason: 'a transition with findingId, from, and to is required' };
  }
  const list = Array.isArray(targets) ? targets : [];
  const event = {
    event: 'finding.state_changed',
    findingId: transition.findingId,
    from: transition.from,
    to: transition.to,
    actor: transition.actor || transition.by || 'Infinity AI',
    reason: transition.reason || null,
    at: typeof transition.at === 'number' ? transition.at : now,
    source: 'Infinity AI · Dark-Matter',
  };
  const deliveries = list.map((t, i) => ({
    id: tokenFor('hook', `${event.findingId}:${i}`, now + i),
    target: t.name || t.url || `target-${i}`,
    url: t.url || null,
    event,
    deliverAt: now,
  }));
  return { ok: true, event, targets: list.length, deliveries };
}
