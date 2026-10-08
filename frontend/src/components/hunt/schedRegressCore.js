/**
 * schedRegressCore.js — Infinity AI · Dark-Matter · Wave 62 (ideas 52441–52460)
 * Pure JS (no React / DOM / network). Deterministic scheduled-regression
 * management: hunt ownership, permissions, auto-send reports, SLA tracking,
 * history timelines, analytics, bulk schedule creation, schedule-from-triage,
 * schedule-from-remediation-board, blackout windows, timezone-aware display,
 * concurrency limits, budget caps, dry runs, run logs, failure alerts, retry
 * policies, templates, event triggers, and FP spot-checks. Time is injected
 * via `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE62_SR_IDEAS = [
  { id: 52441, title: 'Scheduled hunt ownership', desc: 'Assign an owner to each recurring schedule for accountability.', skip: false },
  { id: 52442, title: 'Scheduled hunt permissions', desc: 'Control who can create, edit, or pause recurring hunts per workspace.', skip: false },
  { id: 52443, title: 'Regression report auto-send', desc: 'Email the diff report to stakeholders automatically after each regression.', skip: false },
  { id: 52444, title: 'Regression SLA tracking', desc: 'Track time from fix-deploy to verified-fixed across regressions.', skip: false },
  { id: 52445, title: 'Regression history timeline', desc: 'Per-target timeline of every regression run with verdicts.', skip: false },
  { id: 52446, title: 'Regression analytics', desc: 'Fix success rates, mean time to verify, and regression-caught reintroductions per team.', skip: false },
  { id: 52447, title: 'Bulk schedule creation', desc: 'Apply the same regression schedule to many targets at once.', skip: false },
  { id: 52448, title: 'Schedule-from-triage', desc: 'Right-click a triaged finding to schedule its regression verification.', skip: false },
  { id: 52449, title: 'Schedule-from-remediation-board', desc: 'Drag a "fixing" card to a calendar date to schedule its verification.', skip: false },
  { id: 52450, title: 'Blackout windows', desc: 'Define no-hunt periods (peak sales, holidays) that scheduled hunts respect.', skip: false },
  { id: 52451, title: 'Timezone-aware scheduling (post-hunt)', desc: "Schedules display and fire in the target's local timezone with DST handling.", skip: false },
  { id: 52452, title: 'Concurrency limits', desc: 'Cap simultaneous scheduled hunts to protect shared targets and budgets.', skip: false },
  { id: 52453, title: 'Budget caps for scheduled hunts', desc: 'Monthly compute caps with warnings and auto-pause on exceed.', skip: false },
  { id: 52454, title: 'Scheduled-hunt dry run', desc: 'Preview scope, engines, and estimated requests before the first scheduled run.', skip: false },
  { id: 52455, title: 'Scheduled-hunt run logs', desc: 'Full logs per scheduled execution for debugging missed or failed runs.', skip: false },
  { id: 52456, title: 'Schedule failure alerts (post-hunt)', desc: 'Immediate alert if a scheduled hunt fails to start or errors out.', skip: false },
  { id: 52457, title: 'Retry policy for scheduled hunts', desc: 'Configurable retries with backoff for transient failures.', skip: false },
  { id: 52458, title: 'Schedule templates (post-hunt)', desc: 'Reusable schedule blueprints (cadence, depth, notifications) applied to new targets.', skip: false },
  { id: 52459, title: 'Event-triggered schedules', desc: 'Fire regressions on events like certificate renewal or DNS changes.', skip: false },
  { id: 52460, title: 'FP spot-check regression', desc: 'Periodically re-validate a sample of FP-dismissed patterns to catch rule drift.', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `sr62_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/* 52441 — Scheduled hunt ownership: assign an owner to a recurring schedule,
 * recording an ownership history for accountability. */
export function assignScheduleOwner(schedule, owner, now = Date.now()) {
  if (!schedule || !schedule.id) return { ok: false, reason: 'schedule with an id is required' };
  if (typeof owner !== 'string' || !owner.trim()) return { ok: false, reason: 'owner username is required' };
  const history = Array.isArray(schedule.ownerHistory) ? [...schedule.ownerHistory] : [];
  if (schedule.owner && schedule.owner !== owner) {
    history.push({ previous: schedule.owner, at: now, note: 'ownership reassigned' });
  }
  return {
    ok: true,
    schedule: { ...schedule, owner: owner.trim(), assignedAt: now, ownerHistory: history },
    auditId: tokenFor('own', schedule.id, now),
  };
}

/* 52442 — Scheduled hunt permissions: role-based checks for create/edit/pause
 * actions inside a workspace. Role ladder: admin > owner > editor > viewer. */
const ROLE_RANK = { viewer: 0, editor: 1, owner: 2, admin: 3 };
const ACTION_MIN_ROLE = { create: 'editor', edit: 'owner', pause: 'owner', delete: 'admin' };

export function checkSchedulePermission(workspace, user, action) {
  if (!workspace || !user || !user.id) return { ok: false, reason: 'workspace and user are required' };
  const need = ACTION_MIN_ROLE[action];
  if (!need) return { ok: false, reason: `unknown action "${action}"` };
  const role = (user.roles && user.roles[workspace.id]) || 'viewer';
  const allowed = (ROLE_RANK[role] || 0) >= ROLE_RANK[need];
  return {
    ok: true,
    allowed,
    action,
    role,
    requiredRole: need,
    reason: allowed ? `${role} may ${action}` : `${role} cannot ${action} (requires ${need})`,
  };
}

/* 52443 — Regression report auto-send: build the stakeholder email payload for
 * a finished regression run. */
export function buildAutoSendReport(regressionRun, stakeholders = [], now = Date.now()) {
  if (!regressionRun || !regressionRun.id) return { ok: false, reason: 'regression run is required' };
  if (!Array.isArray(stakeholders) || stakeholders.length === 0) {
    return { ok: false, reason: 'at least one stakeholder recipient is required' };
  }
  const verdict = regressionRun.verdict || 'completed';
  const stats = regressionRun.stats || {};
  return {
    ok: true,
    recipients: stakeholders,
    subject: `[Infinity AI] Regression ${regressionRun.id}: ${verdict}`,
    body: [
      `Target: ${regressionRun.target || 'unknown'}`,
      `Verdict: ${verdict}`,
      `New: ${stats.newFindings || 0}, Fixed: ${stats.fixed || 0}, Persistent: ${stats.persistent || 0}`,
      `Run at: ${new Date(now).toISOString()}`,
    ].join('\n'),
    sentAt: now,
    messageId: tokenFor('send', regressionRun.id, now),
  };
}

/* 52444 — Regression SLA tracking: measure fix-deploy → verified-fixed time
 * against a configured SLA. */
export function trackRegressionSla(regressionRun, deployAt, slaMs, now = Date.now()) {
  if (!regressionRun || !regressionRun.id) return { ok: false, reason: 'regression run is required' };
  if (typeof deployAt !== 'number' || typeof slaMs !== 'number' || slaMs <= 0) {
    return { ok: false, reason: 'deployAt timestamp and positive slaMs are required' };
  }
  const verifiedAt = regressionRun.verifiedAt || null;
  const elapsedMs = (verifiedAt || now) - deployAt;
  const breached = elapsedMs > slaMs;
  return {
    ok: true,
    runId: regressionRun.id,
    elapsedMs,
    slaMs,
    breached,
    verified: verifiedAt !== null,
    status: breached ? 'breached' : 'within-sla',
    remainingMs: breached ? 0 : slaMs - elapsedMs,
  };
}

/* 52445 — Regression history timeline: per-target timeline of every
 * regression run with verdicts, newest first. */
export function buildHistoryTimeline(runs, targetId) {
  if (!Array.isArray(runs)) return { ok: false, reason: 'runs array is required' };
  if (!targetId) return { ok: false, reason: 'targetId is required' };
  const entries = runs
    .filter((r) => r.target === targetId)
    .map((r) => ({ runId: r.id, at: r.startedAt, verdict: r.verdict || 'unknown', stats: r.stats || {} }))
    .sort((a, b) => b.at - a.at);
  return { ok: true, targetId, count: entries.length, timeline: entries };
}

/* 52446 — Regression analytics: fix success rate, mean time to verify, and
 * regression-caught reintroductions across runs. */
export function regressionAnalytics(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return { ok: false, reason: 'non-empty runs array is required' };
  const totals = { verified: 0, fixes: 0, mtvSum: 0, mtvCount: 0, reintroduced: 0 };
  for (const r of runs) {
    const s = r.stats || {};
    totals.verified += s.fixed || 0;
    totals.fixes += (s.fixed || 0) + (s.persistent || 0);
    if (typeof s.meanTimeToVerifyMs === 'number') { totals.mtvSum += s.meanTimeToVerifyMs; totals.mtvCount += 1; }
    totals.reintroduced += s.reintroduced || 0;
  }
  return {
    ok: true,
    runs: runs.length,
    fixSuccessRate: totals.fixes === 0 ? 0 : totals.verified / totals.fixes,
    meanTimeToVerifyMs: totals.mtvCount === 0 ? null : Math.round(totals.mtvSum / totals.mtvCount),
    reintroductions: totals.reintroduced,
  };
}

/* 52447 — Bulk schedule creation: apply one schedule template to many targets. */
export function bulkCreateSchedules(targets, template, now = Date.now()) {
  if (!Array.isArray(targets) || targets.length === 0) return { ok: false, reason: 'targets array is required' };
  if (!template || !template.cadence) return { ok: false, reason: 'template with a cadence is required' };
  const created = targets.map((t, i) => ({
    id: tokenFor('bulk', `${template.name || 'sched'}:${t.id || i}`, now + i),
    targetId: t.id,
    targetName: t.name || t.id,
    cadence: template.cadence,
    depth: template.depth || 'quick',
    owner: template.owner || null,
    createdAt: now,
    status: 'scheduled',
  }));
  return { ok: true, count: created.length, schedules: created };
}

/* 52448 — Schedule-from-triage: schedule a regression verification straight
 * from a triaged finding. */
export function scheduleFromTriage(finding, rule = {}, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding is required' };
  if (finding.state !== 'Triaged' && finding.triageDecision !== 'fix') {
    return { ok: false, reason: 'finding must be triaged as fix before scheduling verification' };
  }
  const delayMs = typeof rule.delayMs === 'number' ? rule.delayMs : 7 * 24 * 3600000;
  return {
    ok: true,
    schedule: {
      id: tokenFor('triage', finding.id, now),
      findingId: finding.id,
      kind: 'verification',
      runAt: now + delayMs,
      reason: `regression verification for triaged finding ${finding.id}`,
      createdAt: now,
      status: 'scheduled',
    },
  };
}

/* 52449 — Schedule-from-remediation-board: dropping a "fixing" card onto a
 * calendar date schedules its verification. */
export function scheduleFromBoard(card, dropDate, now = Date.now()) {
  if (!card || !card.findingId) return { ok: false, reason: 'board card with findingId is required' };
  if (typeof dropDate !== 'number' || dropDate <= now) return { ok: false, reason: 'drop date must be in the future' };
  return {
    ok: true,
    schedule: {
      id: tokenFor('board', card.findingId, now),
      findingId: card.findingId,
      kind: 'verification',
      runAt: dropDate,
      reason: `board drop by ${card.movedBy || 'unknown'} onto ${new Date(dropDate).toISOString()}`,
      createdAt: now,
      status: 'scheduled',
    },
  };
}

/* 52450 — Blackout windows: scheduled hunts must not run inside no-hunt
 * periods (peak sales, holidays). */
export function isInBlackoutWindow(at, windows) {
  if (typeof at !== 'number') return { ok: false, reason: 'timestamp is required' };
  if (!Array.isArray(windows)) return { ok: false, reason: 'windows array is required' };
  const hit = windows.find((w) => at >= w.start && at <= w.end);
  return {
    ok: true,
    inBlackout: !!hit,
    window: hit ? { name: hit.name, start: hit.start, end: hit.end } : null,
    hint: hit ? `scheduled hunts pause during "${hit.name}"` : 'clear to run',
  };
}

/* 52451 — Timezone-aware scheduling (post-hunt): display and fire schedules in
 * the target's local timezone with DST-safe offset handling. */
export function formatInTargetTimezone(utcMs, offsetMinutes, label) {
  if (typeof utcMs !== 'number' || typeof offsetMinutes !== 'number') {
    return { ok: false, reason: 'utcMs and offsetMinutes are required' };
  }
  const local = new Date(utcMs + offsetMinutes * 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return {
    ok: true,
    utc: new Date(utcMs).toISOString(),
    local: local.toISOString().replace('Z', ''),
    offset: `UTC${off}`,
    label: label || 'target local time',
    dstNote: 'offset captured per schedule; re-resolve offset at fire time for DST transitions',
  };
}

/* 52452 — Concurrency limits: cap simultaneous scheduled hunts. */
export function checkConcurrency(running, limit) {
  if (!Array.isArray(running)) return { ok: false, reason: 'running hunts array is required' };
  if (typeof limit !== 'number' || limit < 0) return { ok: false, reason: 'limit must be a non-negative number' };
  const active = running.filter((h) => h.status === 'running').length;
  return {
    ok: true,
    active,
    limit,
    allowed: active < limit,
    queued: Math.max(0, active - limit),
    hint: active < limit ? 'slot available' : 'at concurrency cap; new hunts queue',
  };
}

/* 52453 — Budget caps for scheduled hunts: monthly compute caps with warnings
 * and auto-pause on exceed. */
export function checkBudget(spentCents, capCents, warnAt = 0.8) {
  if (typeof spentCents !== 'number' || typeof capCents !== 'number' || capCents <= 0) {
    return { ok: false, reason: 'spentCents and positive capCents are required' };
  }
  const pct = spentCents / capCents;
  return {
    ok: true,
    spentCents,
    capCents,
    pctUsed: pct,
    warn: pct >= warnAt && pct < 1,
    autoPause: pct >= 1,
    status: pct >= 1 ? 'paused-over-budget' : pct >= warnAt ? 'warning' : 'healthy',
  };
}

/* 52454 — Scheduled-hunt dry run: preview scope, engines and estimated
 * requests before the first scheduled run. */
export function dryRunSchedule(schedule) {
  if (!schedule || !schedule.scope) return { ok: false, reason: 'schedule with scope is required' };
  const endpoints = Array.isArray(schedule.scope.endpoints) ? schedule.scope.endpoints.length : 0;
  const engines = Array.isArray(schedule.engines) ? schedule.engines : [];
  const payloadsPerEngine = typeof schedule.payloadsPerEngine === 'number' ? schedule.payloadsPerEngine : 50;
  const estRequests = endpoints * engines.length * payloadsPerEngine;
  return {
    ok: true,
    scheduleId: schedule.id,
    dryRun: true,
    scope: { endpoints, target: schedule.scope.target || 'unknown' },
    engines,
    estRequests,
    estDurationMs: estRequests * (schedule.msPerRequest || 120),
    note: 'dry run — nothing was executed',
  };
}

/* 52455 — Scheduled-hunt run logs: append and query execution logs for
 * debugging missed or failed runs. */
export function appendRunLog(logs, entry, now = Date.now()) {
  if (!Array.isArray(logs)) return { ok: false, reason: 'logs array is required' };
  if (!entry || !entry.message) return { ok: false, reason: 'log entry with a message is required' };
  const row = {
    id: tokenFor('log', entry.runId || 'run', now),
    runId: entry.runId || null,
    level: entry.level || 'info',
    message: entry.message,
    at: now,
  };
  return { ok: true, entry: row, logs: [...logs, row] };
}

export function filterRunLogs(logs, query = {}) {
  if (!Array.isArray(logs)) return { ok: false, reason: 'logs array is required' };
  const rows = logs.filter((l) => {
    if (query.level && l.level !== query.level) return false;
    if (query.runId && l.runId !== query.runId) return false;
    if (query.contains && !l.message.includes(query.contains)) return false;
    return true;
  });
  return { ok: true, count: rows.length, rows };
}

/* 52456 — Schedule failure alerts (post-hunt): immediate alert when a
 * scheduled hunt fails to start or errors out. */
export function buildFailureAlert(run, failure, now = Date.now()) {
  if (!run || !run.id) return { ok: false, reason: 'run is required' };
  if (!failure || !failure.kind) return { ok: false, reason: 'failure detail with kind is required' };
  const severity = failure.kind === 'did-not-start' ? 'critical' : 'high';
  return {
    ok: true,
    alert: {
      id: tokenFor('alert', run.id, now),
      runId: run.id,
      severity,
      title: `Scheduled hunt ${failure.kind === 'did-not-start' ? 'failed to start' : 'errored out'}: ${run.id}`,
      body: failure.detail || 'no detail provided',
      at: now,
      channels: ['in-app', 'email'],
    },
  };
}

/* 52457 — Retry policy for scheduled hunts: configurable retries with
 * exponential backoff for transient failures. */
export function nextRetryAttempt(failures, policy = {}, now = Date.now()) {
  const attempts = Array.isArray(failures) ? failures.length : 0;
  const max = typeof policy.maxAttempts === 'number' ? policy.maxAttempts : 3;
  if (attempts >= max) return { ok: true, retry: false, reason: 'max attempts reached' };
  const baseMs = typeof policy.baseMs === 'number' ? policy.baseMs : 60000;
  const delayMs = baseMs * 2 ** attempts;
  return {
    ok: true,
    retry: true,
    attempt: attempts + 1,
    maxAttempts: max,
    delayMs,
    nextAt: now + delayMs,
  };
}

/* 52458 — Schedule templates (post-hunt): apply a reusable blueprint to a new
 * target. */
export function applyScheduleTemplate(template, target, now = Date.now()) {
  if (!template || !template.cadence) return { ok: false, reason: 'template with a cadence is required' };
  if (!target || !target.id) return { ok: false, reason: 'target with an id is required' };
  return {
    ok: true,
    schedule: {
      id: tokenFor('tmpl', `${template.name || 't'}:${target.id}`, now),
      targetId: target.id,
      targetName: target.name || target.id,
      cadence: template.cadence,
      depth: template.depth || 'quick',
      engines: template.engines || [],
      notify: template.notify || [],
      fromTemplate: template.name || 'unnamed',
      createdAt: now,
      status: 'scheduled',
    },
  };
}

/* 52459 — Event-triggered schedules: fire regressions on certificate renewal,
 * DNS changes, and other infra events. */
const TRIGGER_KINDS = ['certificate-renewal', 'dns-change', 'deploy', 'config-change'];

export function matchEventTrigger(event, triggers) {
  if (!event || !event.kind) return { ok: false, reason: 'event with kind is required' };
  if (!Array.isArray(triggers)) return { ok: false, reason: 'triggers array is required' };
  if (!TRIGGER_KINDS.includes(event.kind)) return { ok: false, reason: `unsupported event kind "${event.kind}"` };
  const matched = triggers.filter(
    (t) => t.onEvent === event.kind && (!t.targetId || t.targetId === event.targetId),
  );
  return { ok: true, eventKind: event.kind, matched: matched.map((t) => t.id), count: matched.length };
}

/* 52460 — FP spot-check regression: periodically re-validate a sample of
 * FP-dismissed patterns to catch rule drift. Deterministic sampling via a
 * seeded hash so the same input always yields the same sample. */
export function fpSpotCheckSample(fpPatterns, sampleSize, seed = 'sr62') {
  if (!Array.isArray(fpPatterns) || fpPatterns.length === 0) return { ok: false, reason: 'fpPatterns array is required' };
  if (typeof sampleSize !== 'number' || sampleSize <= 0) return { ok: false, reason: 'positive sampleSize is required' };
  const scored = fpPatterns.map((p) => {
    let h = 0;
    const raw = `${seed}:${p.id}`;
    for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
    return { pattern: p, score: h >>> 0 };
  });
  scored.sort((a, b) => a.score - b.score);
  const sample = scored.slice(0, Math.min(sampleSize, scored.length)).map((s) => s.pattern);
  return { ok: true, total: fpPatterns.length, sampled: sample.length, sample };
}
