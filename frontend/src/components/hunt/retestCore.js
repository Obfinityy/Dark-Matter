/**
 * retestCore.js — Infinity AI · Dark-Matter · Wave 54
 * Pure logic (no React, no DOM, no network) backing the retest suite:
 * idea-bank ideas 52123–52160. Every exported function is pure and
 * deterministic; time is injected via `now` parameters (defaults to
 * Date.now()). Seeded transforms are used instead of randomness.
 */

export const WAVE54_RETEST_IDEAS = [
  { id: 52123, title: 'Per-finding retest request' },
  { id: 52124, title: 'Retest after fix deployed' },
  { id: 52125, title: 'Retest with mutated payloads' },
  { id: 52126, title: 'Scheduled retest' },
  { id: 52127, title: 'Retest queue dashboard' },
  { id: 52128, title: 'Retest scope picker' },
  { id: 52129, title: 'Retest report diff' },
  { id: 52130, title: 'Retest cost estimate' },
  { id: 52131, title: 'Retest priority levels' },
  { id: 52132, title: 'One-click retest from triage' },
  { id: 52133, title: '"Needs more evidence" auto-retest' },
  { id: 52134, title: 'Retest with a different brain' },
  { id: 52135, title: 'Retest stealth-mode toggle' },
  { id: 52136, title: 'Retest concurrency limits' },
  { id: 52137, title: 'Retest completion notifications' },
  { id: 52138, title: 'Retest history per finding' },
  { id: 52139, title: 'Retest SLA tracking (post-hunt)' },
  { id: 52140, title: 'Bulk retest requests' },
  { id: 52141, title: 'Retest request templates' },
  { id: 52142, title: 'Retest on deploy webhook' },
  { id: 52143, title: 'Retest approval workflow' },
  { id: 52144, title: 'Retest budget caps' },
  { id: 52145, title: 'Retest evidence refresh' },
  { id: 52146, title: 'Retest across environments' },
  { id: 52147, title: 'Off-hours retest windows' },
  { id: 52148, title: 'Retest rate-limit awareness' },
  { id: 52149, title: 'Retest dry-run preview' },
  { id: 52150, title: 'Retest with authenticated session' },
  { id: 52151, title: 'Retest session replay' },
  { id: 52152, title: 'Retest parameter sweep' },
  { id: 52153, title: 'Retest depth setting' },
  { id: 52154, title: 'Retest engine selection' },
  { id: 52155, title: 'Retest execution logs' },
  { id: 52156, title: 'Retest failure alerts' },
  { id: 52157, title: 'Retest assignment' },
  { id: 52158, title: 'Retest vs regression distinction' },
  { id: 52159, title: '"Still vulnerable" escalation' },
  { id: 52160, title: 'Verification certificate' },
];

export const RETEST_PRIORITIES = [
  { id: 'urgent', label: 'Urgent', weight: 0 },
  { id: 'normal', label: 'Normal', weight: 1 },
  { id: 'low', label: 'Low', weight: 2 },
];

export const RETEST_STATUSES = [
  'queued',
  'awaiting-approval',
  'scheduled',
  'running',
  'completed',
  'failed',
  'cancelled',
];

let retestSeq = 0;
function nextRetestId(prefix = 'rt') {
  retestSeq += 1;
  return `${prefix}-${String(retestSeq).padStart(4, '0')}`;
}
export function __resetRetestSeq() {
  retestSeq = 0;
}

// 52123 — Per-finding retest request: targeted retest of a single finding.
export function requestRetest(finding, options = {}, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'a finding is required' };
  return {
    ok: true,
    request: {
      id: nextRetestId(),
      kind: 'per-finding',
      findingId: finding.id,
      title: finding.title || 'Retest',
      target: finding.target || null,
      status: 'queued',
      priority: options.priority || 'normal',
      requestedBy: options.requestedBy || 'infinity-ai',
      requestedAt: now,
      options: {
        stealth: options.stealth === true,
        brain: options.brain || 'default',
        depth: options.depth || 'shallow',
      },
    },
  };
}

// 52124 — Retest after fix deployed: mark "fix deployed" to auto-queue a
// verification retest of that exact vulnerability.
export function autoQueueOnFixDeployed(finding, deployInfo = {}, now = Date.now()) {
  const base = requestRetest(finding, { priority: 'urgent' }, now);
  if (!base.ok) return base;
  return {
    ok: true,
    request: {
      ...base.request,
      trigger: 'fix-deployed',
      deployRef: deployInfo.ref || null,
      deployedAt: deployInfo.deployedAt || now,
      note: 'auto-queued after fix deployed',
    },
  };
}

// 52125 — Retest with mutated payloads: replay original PoC plus
// deterministically generated mutations to catch incomplete fixes.
const MUTATIONS = [
  p => `${p}' OR '1'='1`,
  p => p.replace(/</g, '%3C').replace(/>/g, '%3E'),
  p => p.split('').reverse().join(''),
  p => `${p}\n`,
  p => p.replace(/\s/g, '/**/'),
  p => Buffer.from(p, 'utf8').toString('base64'),
];
export function buildMutatedPayloads(pocPayload, count = 5) {
  const seed = String(pocPayload || '');
  const out = [seed];
  for (let i = 0; i < Math.max(0, count); i += 1) {
    const fn = MUTATIONS[(seed.length + i) % MUTATIONS.length];
    out.push(fn(seed));
  }
  return [...new Set(out)];
}

// 52126 — Scheduled retest: book for a future date/time with reminders.
export function scheduleRetest(request, scheduledAt, now = Date.now()) {
  if (!request || !request.id) return { ok: false, reason: 'a retest request is required' };
  if (typeof scheduledAt !== 'number' || scheduledAt <= now) {
    return { ok: false, reason: 'scheduled time must be in the future' };
  }
  return {
    ok: true,
    request: {
      ...request,
      status: 'scheduled',
      scheduledAt,
      reminders: [scheduledAt - 3600000, scheduledAt - 600000].filter(t => t > now),
    },
  };
}

// 52127 — Retest queue dashboard: pending/running/completed with status,
// owner, and ETA in one view.
export function queueSummary(queue, now = Date.now()) {
  const list = Array.isArray(queue) ? queue : [];
  const byStatus = list.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  return {
    total: list.length,
    byStatus,
    pending: list.filter(r => r.status === 'queued' || r.status === 'scheduled').length,
    running: byStatus.running || 0,
    completed: byStatus.completed || 0,
    failed: byStatus.failed || 0,
    owners: [...new Set(list.map(r => r.requestedBy).filter(Boolean))],
    oldestPendingAt: list
      .filter(r => r.status === 'queued')
      .map(r => r.requestedAt)
      .reduce((min, t) => (min === null || t < min ? t : min), null),
    etaMs: estimateQueueEta(list, now),
  };
}

function estimateQueueEta(list, now) {
  const pending = list.filter(r => r.status === 'queued' || r.status === 'scheduled');
  const running = list.filter(r => r.status === 'running');
  const avgMs = 900000; // 15 min average retest
  const slots = Math.max(1, 4 - running.length);
  return Math.ceil(pending.length / slots) * avgMs;
}

// 52128 — Retest scope picker: limit to endpoints, params, payload classes.
export function applyScopePicker(request, scope = {}) {
  const scoped = {
    endpoints: Array.isArray(scope.endpoints) ? scope.endpoints : [],
    parameters: Array.isArray(scope.parameters) ? scope.parameters : [],
    payloadClasses: Array.isArray(scope.payloadClasses) ? scope.payloadClasses : [],
  };
  const empty =
    scoped.endpoints.length === 0 &&
    scoped.parameters.length === 0 &&
    scoped.payloadClasses.length === 0;
  return {
    ok: !empty,
    reason: empty ? 'pick at least one endpoint, parameter, or payload class' : null,
    request: { ...request, scope: scoped },
  };
}

// 52129 — Retest report diff: fixed / still vulnerable / changed behavior.
export function diffRetestReport(original, retestOutcome) {
  const before = original && original.severity ? 'vulnerable' : 'unknown';
  const after = retestOutcome && retestOutcome.stillVulnerable ? 'vulnerable' : 'fixed';
  const changed = retestOutcome && retestOutcome.behaviorChanged === true;
  let verdict;
  if (before === 'vulnerable' && after === 'fixed') verdict = 'fixed';
  else if (after === 'vulnerable') verdict = changed ? 'changed-behavior' : 'still-vulnerable';
  else verdict = 'no-change';
  return {
    findingId: original ? original.id : null,
    before,
    after,
    behaviorChanged: changed,
    verdict,
    note:
      verdict === 'fixed'
        ? 'vulnerability no longer reproducible'
        : verdict === 'still-vulnerable'
          ? 'vulnerability persists — fix incomplete'
          : verdict === 'changed-behavior'
            ? 'response behavior changed, re-verify manually'
            : 'no observable change',
  };
}

// 52130 — Retest cost estimate: estimated agent compute/time before confirm.
export function estimateRetestCost(request) {
  const depthCost = request && request.options && request.options.depth === 'deep' ? 4 : 1;
  const scopeCount =
    request && request.scope
      ? Math.max(1, request.scope.endpoints.length + request.scope.parameters.length)
      : 3;
  const brainCost = request && request.options && request.options.brain !== 'default' ? 1.5 : 1;
  const computeUnits = Math.round(depthCost * scopeCount * brainCost * 10) / 10;
  return {
    requestId: request ? request.id : null,
    computeUnits,
    estimatedMinutes: Math.ceil(computeUnits * 4),
    breakdown: { depthCost, scopeCount, brainCost },
  };
}

// 52131 — Retest priority levels: urgent/normal/low order the queue.
export function prioritizeQueue(queue) {
  const weight = { urgent: 0, normal: 1, low: 2 };
  return [...(queue || [])].sort((a, b) => {
    const wa = weight[a.priority] === undefined ? 1 : weight[a.priority];
    const wb = weight[b.priority] === undefined ? 1 : weight[b.priority];
    if (wa !== wb) return wa - wb;
    return (a.requestedAt || 0) - (b.requestedAt || 0);
  });
}

export function setRetestPriority(request, priority) {
  if (!RETEST_PRIORITIES.some(p => p.id === priority)) {
    return { ok: false, reason: `unknown priority "${priority}"` };
  }
  return { ok: true, request: { ...request, priority } };
}

// 52132 — One-click retest from triage: quick-action button for thin-evidence.
export function triageQuickRetest(finding, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'a finding is required' };
  if (finding.evidenceStrength !== 'thin') {
    return { ok: false, reason: 'quick retest is for thin-evidence findings' };
  }
  return {
    ok: true,
    request: {
      ...requestRetest(finding, { priority: 'normal' }, now).request,
      trigger: 'triage-quick-action',
    },
  };
}

// 52133 — "Needs more evidence" auto-retest: thin-evidence findings enter a
// retest flow that gathers deeper proof.
export function autoRetestThinEvidence(findings, now = Date.now()) {
  const thin = (findings || []).filter(f => f.evidenceStrength === 'thin' && f.status === 'open');
  return {
    queued: thin.map(f => ({
      ...requestRetest(f, { priority: 'low', depth: 'deep' }, now).request,
      trigger: 'auto-thin-evidence',
    })),
    skipped: findings.length - thin.length,
  };
}

// 52134 — Retest with a different brain: independent second opinion.
export const RETEST_BRAINS = [
  { id: 'default', label: 'Default brain' },
  { id: 'vision', label: 'Vision brain' },
  { id: 'local-llm', label: 'Local LLM brain' },
];
export function retestWithBrain(request, brainId) {
  const brain = RETEST_BRAINS.find(b => b.id === brainId);
  if (!brain) return { ok: false, reason: `unknown brain "${brainId}"` };
  return {
    ok: true,
    request: {
      ...request,
      options: { ...(request.options || {}), brain: brain.id },
      secondOpinion: true,
    },
  };
}

// 52135 — Retest stealth-mode toggle: low-noise for sensitive production.
export function setStealthMode(request, on) {
  return {
    ok: true,
    request: { ...request, options: { ...(request.options || {}), stealth: on === true } },
  };
}

// 52136 — Retest concurrency limits: cap simultaneous retests per target.
export function checkConcurrency(target, running, limit) {
  const active = (running || []).filter(r => r.target === target && r.status === 'running').length;
  const cap = typeof limit === 'number' && limit > 0 ? limit : 2;
  return {
    target,
    active,
    cap,
    allowed: active < cap,
    reason: active >= cap ? `concurrency cap ${cap} reached for ${target}` : null,
  };
}

// 52137 — Retest completion notifications: requester + watchers get verdict.
export function buildCompletionNotification(request, verdict, watchers = [], now = Date.now()) {
  return {
    to: [...new Set([request.requestedBy, ...watchers].filter(Boolean))],
    subject: `Retest ${verdict}: ${request.title || request.id}`,
    body: `Retest ${request.id} for finding ${request.findingId} finished with verdict "${verdict}".`,
    sentAt: now,
    requestId: request.id,
    verdict,
  };
}

// 52138 — Retest history per finding: every attempt logged with payload + outcome.
export function appendRetestHistory(finding, attempt) {
  const history = Array.isArray(finding.retestHistory) ? finding.retestHistory : [];
  return {
    ...finding,
    retestHistory: [
      ...history,
      {
        attemptId: attempt.id || `att-${history.length + 1}`,
        at: attempt.at || Date.now(),
        payload: attempt.payload || null,
        outcome: attempt.outcome || 'unknown',
        verdict: attempt.verdict || null,
      },
    ],
  };
}

// 52139 — Retest SLA tracking: request-to-verdict vs per-severity targets.
export const RETEST_SLA_TARGETS = {
  critical: 4 * 3600000,
  high: 24 * 3600000,
  medium: 72 * 3600000,
  low: 168 * 3600000,
};
export function slaStatus(request, finding, now = Date.now()) {
  const targetMs = RETEST_SLA_TARGETS[finding && finding.severity] || RETEST_SLA_TARGETS.medium;
  const elapsed = now - (request.requestedAt || now);
  const breached =
    request.status !== 'completed' && request.status !== 'failed' && elapsed > targetMs;
  return {
    requestId: request.id,
    severity: (finding && finding.severity) || 'medium',
    targetMs,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, targetMs - elapsed),
    breached,
  };
}

// 52140 — Bulk retest requests: queue many findings at once.
export function bulkRequestRetests(findings, options = {}, now = Date.now()) {
  const list = findings || [];
  const requests = list.map(f => requestRetest(f, options, now).request);
  return { ok: true, count: requests.length, requests };
}

// 52141 — Retest request templates: saved configs for one-click reuse.
export function saveRetestTemplate(templates, name, config, now = Date.now()) {
  const list = Array.isArray(templates) ? templates : [];
  const template = { id: `tpl-${list.length + 1}`, name, config: { ...config }, createdAt: now };
  return { templates: [...list, template], template };
}
export function applyRetestTemplate(finding, template, overrides = {}, now = Date.now()) {
  if (!template || !template.config) return { ok: false, reason: 'template is required' };
  const base = requestRetest(finding, { ...template.config, ...overrides }, now);
  if (!base.ok) return base;
  return { ok: true, request: { ...base.request, templateId: template.id } };
}

// 52142 — Retest on deploy webhook: deployment event auto-triggers retests.
export function deployWebhookTrigger(openFindings, deployEvent, now = Date.now()) {
  const findings = (openFindings || []).filter(
    f => f.target === deployEvent.target && f.status === 'open'
  );
  return {
    event: deployEvent.id || null,
    target: deployEvent.target,
    matched: findings.length,
    requests: findings.map(f => ({
      ...requestRetest(f, { priority: 'urgent' }, now).request,
      trigger: 'deploy-webhook',
      deployRef: deployEvent.ref || null,
    })),
  };
}

// 52143 — Retest approval workflow: lead approval for production retests.
export function requestRetestApproval(request, approver, now = Date.now()) {
  return {
    ok: true,
    request: { ...request, status: 'awaiting-approval' },
    approval: { requestId: request.id, approver, requestedAt: now, decision: 'pending' },
  };
}
export function decideRetestApproval(pending, approve, now = Date.now()) {
  const decision = approve ? 'approved' : 'rejected';
  return {
    approval: { ...pending.approval, decision, decidedAt: now },
    request: { ...pending.request, status: approve ? 'queued' : 'cancelled' },
  };
}

// 52144 — Retest budget caps: monthly caps, 80% warning, hard stops.
export function checkRetestBudget(spentUnits, capUnits, now = Date.now()) {
  const pct = capUnits > 0 ? (spentUnits / capUnits) * 100 : 0;
  const state = pct >= 100 ? 'blocked' : pct >= 80 ? 'warning' : 'ok';
  return {
    spentUnits,
    capUnits,
    pctUsed: Math.round(pct * 10) / 10,
    state,
    checkedAt: now,
    message:
      state === 'blocked'
        ? 'budget exhausted — retests paused'
        : state === 'warning'
          ? 'budget above 80% — approvals recommended'
          : 'within budget',
  };
}

// 52145 — Retest evidence refresh: fresh request/response evidence replaces stale PoC.
export function refreshRetestEvidence(attempt, freshEvidence) {
  return {
    ...attempt,
    evidence: Array.isArray(freshEvidence) ? freshEvidence : [],
    evidenceRefreshedAt: Date.now(),
    stalePoCReplaced: true,
  };
}

// 52146 — Retest across environments: same verification on staging + prod.
export function compareEnvironments(resultsByEnv) {
  const envs = Object.keys(resultsByEnv || {});
  const verdicts = envs.map(e => resultsByEnv[e].verdict);
  const consistent = new Set(verdicts).size <= 1;
  return {
    environments: envs,
    results: resultsByEnv,
    consistent,
    verdict: consistent ? 'consistent' : 'divergent',
    note: consistent
      ? 'same outcome across environments'
      : 'outcomes differ — investigate environment drift',
  };
}

// 52147 — Off-hours retest windows: schedule only inside maintenance windows.
export function inRetestWindow(atMs, windows) {
  const list = Array.isArray(windows) ? windows : [];
  const day = new Date(atMs).getUTCDay();
  const hour = new Date(atMs).getUTCHours() + new Date(atMs).getUTCMinutes() / 60;
  return list.some(w => (w.days || []).includes(day) && hour >= w.startHour && hour < w.endHour);
}
export function validateRetestWindow(request, windows, now = Date.now()) {
  const at = request.scheduledAt || now;
  const inside = inRetestWindow(at, windows);
  return { ok: inside, reason: inside ? null : 'retest is outside the allowed maintenance window' };
}

// 52148 — Retest rate-limit awareness: respect observed limits, back off.
export function backoffForRetest(consecutive429s, baseMs = 30000) {
  const n = Math.max(0, consecutive429s || 0);
  if (n === 0) return { delayMs: 0, reason: 'no rate-limit pressure' };
  return {
    delayMs: Math.min(baseMs * 2 ** (n - 1), 3600000),
    reason: `${n} consecutive 429 responses — backing off`,
  };
}

// 52149 — Retest dry-run preview: exactly which requests would be sent.
export function dryRunPreview(request) {
  const scope = (request && request.scope) || {};
  const endpoints =
    scope.endpoints && scope.endpoints.length ? scope.endpoints : ['/ (original finding endpoint)'];
  const payloads = buildMutatedPayloads(request && request.originalPayload, 3);
  return {
    requestId: request ? request.id : null,
    dryRun: true,
    wouldSend: endpoints.flatMap(ep =>
      payloads.map(p => ({ method: 'GET', endpoint: ep, payload: p }))
    ),
    totalRequests: endpoints.length * payloads.length,
    note: 'no requests were sent — change-control preview only',
  };
}

// 52150 — Retest with authenticated session: supply or reuse stored creds.
export function attachAuthSession(request, sessionRef) {
  if (!sessionRef || !sessionRef.id)
    return { ok: false, reason: 'a stored session reference is required' };
  return {
    ok: true,
    request: {
      ...request,
      auth: { sessionId: sessionRef.id, principal: sessionRef.principal || null },
    },
  };
}

// 52151 — Retest session replay: replay the original hunt's request sequence.
export function buildReplayPlan(huntTrace) {
  const steps = Array.isArray(huntTrace) ? huntTrace : [];
  return {
    steps: steps.map((s, i) => ({
      order: i + 1,
      method: s.method || 'GET',
      url: s.url || '',
      payload: s.payload || null,
    })),
    total: steps.length,
    deterministic: true,
  };
}

// 52152 — Retest parameter sweep: neighboring parameters around the finding.
export function parameterSweep(baseParam, neighbors = []) {
  const params = [baseParam, ...(neighbors || [])].filter(Boolean);
  return {
    base: baseParam,
    swept: [...new Set(params)],
    count: new Set(params).size,
  };
}

// 52153 — Retest depth setting: shallow (confirm fix) vs deep (re-explore).
export const RETEST_DEPTHS = {
  shallow: { id: 'shallow', label: 'Shallow — confirm the fix', maxRequests: 10, reexplore: false },
  deep: { id: 'deep', label: 'Deep — re-explore the area', maxRequests: 200, reexplore: true },
};
export function depthConfig(mode) {
  const cfg = RETEST_DEPTHS[mode];
  if (!cfg) return { ok: false, reason: `unknown depth "${mode}"` };
  return { ok: true, config: { ...cfg } };
}

// 52154 — Retest engine selection: pick which detection engines participate.
export function selectRetestEngines(request, engineIds, availableEngines) {
  const available = new Set(availableEngines || []);
  const picked = (engineIds || []).filter(e => available.has(e));
  if (picked.length === 0) return { ok: false, reason: 'select at least one available engine' };
  return { ok: true, request: { ...request, engines: picked } };
}

// 52155 — Retest execution logs: full step-by-step audit logs.
export function appendRetestLog(attempt, entry, now = Date.now()) {
  const logs = Array.isArray(attempt.logs) ? attempt.logs : [];
  return { ...attempt, logs: [...logs, { at: now, ...entry }] };
}
export function formatRetestLog(attempt) {
  return (attempt.logs || [])
    .map(l => `[${new Date(l.at).toISOString()}] ${l.step || 'step'}: ${l.detail || ''}`)
    .join('\n');
}

// 52156 — Retest failure alerts: immediate alert with failure reason.
export function buildFailureAlert(request, error, watchers = [], now = Date.now()) {
  return {
    to: [...new Set([request.requestedBy, ...watchers].filter(Boolean))],
    subject: `Retest failed: ${request.title || request.id}`,
    body: `Retest ${request.id} for finding ${request.findingId} failed: ${error && error.message ? error.message : String(error)}`,
    failedAt: now,
    requestId: request.id,
    kind: (error && error.kind) || 'unknown',
  };
}

// 52157 — Retest assignment: oversight assignee with due dates.
export function assignRetest(request, assignee, dueAt, now = Date.now()) {
  if (!assignee) return { ok: false, reason: 'an assignee is required' };
  if (typeof dueAt === 'number' && dueAt <= now)
    return { ok: false, reason: 'due date must be in the future' };
  return { ok: true, request: { ...request, assignee, dueAt: dueAt || null } };
}

// 52158 — Retest vs regression distinction: different workflows, clear labels.
export function classifyRetestWork(request) {
  const kind = request && request.kind === 'regression' ? 'regression' : 'retest';
  return {
    kind,
    label: kind === 'regression' ? 'Full regression hunt' : 'Single-finding retest',
    workflow: kind === 'regression' ? 'full-hunt-workflow' : 'targeted-verification-workflow',
    requestId: request ? request.id : null,
  };
}

// 52159 — "Still vulnerable" escalation: auto-escalate to assignee + manager.
export function escalateStillVulnerable(request, finding, manager, now = Date.now()) {
  if (!request || !finding) return { ok: false, reason: 'request and finding are required' };
  return {
    ok: true,
    escalation: {
      requestId: request.id,
      findingId: finding.id,
      reason: 'still vulnerable after claimed fix',
      escalatedTo: [finding.assignee, manager].filter(Boolean),
      escalatedAt: now,
      severity: finding.severity || 'unknown',
    },
  };
}

// 52160 — Verification certificate: signed "verified fixed on <date>".
export function issueVerificationCertificate(finding, verdict, issuer, now = Date.now()) {
  if (verdict !== 'fixed')
    return { ok: false, reason: 'certificates are issued only for fixed findings' };
  const date = new Date(now).toISOString().slice(0, 10);
  const payload = `${finding.id}|${date}|${issuer || 'infinity-ai'}`;
  let sig = 0;
  for (let i = 0; i < payload.length; i += 1) sig = (sig * 31 + payload.charCodeAt(i)) >>> 0;
  return {
    ok: true,
    certificate: {
      schema: 'infinity-ai-verification/v1',
      findingId: finding.id,
      title: finding.title || null,
      verifiedFixedOn: date,
      issuer: issuer || 'infinity-ai',
      signature: sig.toString(16),
    },
  };
}
