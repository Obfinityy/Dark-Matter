/**
 * retestRound4Core.js — Infinity AI · Dark-Matter · Wave 55
 * Pure logic (no React, no DOM, no network) backing the retest round-4 suite:
 * idea-bank ideas 52161–52181. Every exported function is pure and
 * deterministic; time is injected via `now` parameters (defaults to
 * Date.now()). Seeded ID counters are used instead of randomness.
 */

export const WAVE55_R4_IDEAS = [
  { id: 52161, title: 'Retest sign-off' },
  { id: 52162, title: 'Retest comments and attachments' },
  { id: 52163, title: 'CI-integrated retest' },
  { id: 52164, title: 'Retest API' },
  { id: 52165, title: 'Retest from PDF report (deep links)' },
  { id: 52166, title: 'Retest on bounty-status change' },
  { id: 52167, title: 'Retest reminders' },
  { id: 52168, title: 'Retest analytics' },
  { id: 52169, title: 'Chained-finding retest' },
  { id: 52170, title: 'Retest with proxy capture' },
  { id: 52171, title: 'Retest evidence diff highlighting' },
  { id: 52172, title: 'Bulk retest by severity' },
  { id: 52173, title: 'Bulk retest by asset' },
  { id: 52174, title: 'Retest request export (CSV)' },
  { id: 52175, title: 'Retest duplicate detection' },
  { id: 52176, title: 'Retest auto-trigger on WAF change' },
  { id: 52177, title: 'Retest notification preferences' },
  { id: 52178, title: 'Retest queue reordering' },
  { id: 52179, title: 'Retest scoped to fix commit' },
  { id: 52180, title: 'Retest evidence retention policy' },
  { id: 52181, title: 'Retest verdict confidence' },
];

export const SIGNOFF_STATES = ['pending', 'approved', 'rejected', 'needs-review'];
export const RETEST_VERDICTS = ['fixed', 'still-vulnerable', 'inconclusive', 'not-reproducible'];
export const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

let rr4Seq = 0;
function nextId(prefix = 'rr4') {
  rr4Seq += 1;
  return `${prefix}-${String(rr4Seq).padStart(4, '0')}`;
}
export function __resetRr4Seq() { rr4Seq = 0; }

// 52161 — Retest sign-off: formal human approval of the retest verdict before
// the finding can close. State machine: pending -> approved | rejected | needs-review.
export function signOffRetest(verdict, action, actor = 'reviewer', now = Date.now()) {
  if (!verdict || !verdict.findingId) return { ok: false, reason: 'a retest verdict is required' };
  if (!SIGNOFF_STATES.includes(action)) return { ok: false, reason: `unknown sign-off action: ${action}` };
  if (action === 'approved' && verdict.verdict !== 'fixed') {
    return { ok: false, reason: 'only a "fixed" verdict can be signed off' };
  }
  return {
    ok: true,
    signOff: {
      id: nextId('signoff'),
      findingId: verdict.findingId,
      retestId: verdict.retestId || null,
      verdict: verdict.verdict,
      state: action,
      actor,
      decidedAt: now,
      closesFinding: action === 'approved',
    },
  };
}

// 52162 — Retest comments and attachments: threaded discussion and manual
// verification notes/screenshots anchored to a retest request.
export function addRetestComment(request, body, author = 'infinity-ai', now = Date.now()) {
  if (!request || !request.id) return { ok: false, reason: 'a retest request is required' };
  if (!body || !body.trim()) return { ok: false, reason: 'comment body cannot be empty' };
  return {
    ok: true,
    comment: { id: nextId('comment'), requestId: request.id, author, body: body.trim(), createdAt: now },
  };
}
export function addRetestAttachment(request, attachment, now = Date.now()) {
  if (!request || !request.id) return { ok: false, reason: 'a retest request is required' };
  if (!attachment || !attachment.name) return { ok: false, reason: 'attachment needs a name' };
  return {
    ok: true,
    attachment: {
      id: nextId('attach'),
      requestId: request.id,
      name: attachment.name,
      kind: attachment.kind || 'note',
      mime: attachment.mime || 'text/plain',
      sizeBytes: attachment.sizeBytes || 0,
      addedBy: attachment.addedBy || 'infinity-ai',
      addedAt: now,
    },
  };
}

// 52163 — CI-integrated retest: trigger retests from CI and gate merges on
// "no reopened findings". The gate passes when no finding is still vulnerable
// or reopened after its retest.
export function evaluateCIGate(retestResults, options = {}) {
  const results = Array.isArray(retestResults) ? retestResults : [];
  const blockers = results.filter(
    (r) => r.verdict === 'still-vulnerable' || r.reopened === true || r.verdict === 'inconclusive' && options.strict === true
  );
  return {
    pass: blockers.length === 0,
    evaluated: results.length,
    blockers: blockers.map((b) => ({ findingId: b.findingId, retestId: b.retestId, verdict: b.verdict })),
    gateName: options.gateName || 'infinity-ai-no-reopened-findings',
  };
}

// 52164 — Retest API: programmatic request / status / cancel operations for
// embedding retests in custom workflows.
export const RETEST_API_OPS = ['request', 'status', 'cancel'];
export function handleRetestApiCall(op, payload = {}, now = Date.now()) {
  if (!RETEST_API_OPS.includes(op)) return { ok: false, error: `unsupported op: ${op}` };
  if (op === 'request') {
    if (!payload.findingId) return { ok: false, error: 'findingId is required' };
    return {
      ok: true,
      data: {
        id: nextId('rt'),
        findingId: payload.findingId,
        status: 'queued',
        priority: payload.priority || 'normal',
        requestedAt: now,
        requestedBy: payload.requestedBy || 'api',
      },
    };
  }
  if (op === 'status') {
    if (!payload.id) return { ok: false, error: 'id is required' };
    return { ok: true, data: { id: payload.id, status: payload.status || 'queued', updatedAt: now } };
  }
  if (!payload.id) return { ok: false, error: 'id is required' };
  return { ok: true, data: { id: payload.id, status: 'cancelled', cancelledAt: now, reason: payload.reason || 'api' } };
}

// 52165 — Retest from PDF report: deep links in exported PDFs that open the
// finding and offer one-click retest.
export function buildFindingDeepLink(findingId, options = {}) {
  if (!findingId) return { ok: false, reason: 'findingId is required' };
  const base = options.baseUrl || 'https://app.infinity.ai/hunt/findings';
  const url = `${base}/${encodeURIComponent(findingId)}?action=retest&source=pdf-report`;
  return { ok: true, url, findingId, label: `Retest ${findingId}` };
}

// 52166 — Retest on bounty-status change: when a platform marks a submission
// "needs retest", auto-create the retest request.
export const NEEDS_RETEST_STATUSES = ['needs-retest', 'fix-rejected', 'reopened'];
export function onBountyStatusChange(submission, now = Date.now()) {
  if (!submission || !submission.findingId) return { ok: false, reason: 'submission with findingId is required' };
  if (!NEEDS_RETEST_STATUSES.includes(submission.status)) {
    return { ok: false, reason: `status "${submission.status}" does not trigger a retest` };
  }
  return {
    ok: true,
    request: {
      id: nextId('rt'),
      findingId: submission.findingId,
      trigger: 'bounty-status-change',
      previousStatus: submission.previousStatus || null,
      status: 'queued',
      priority: 'urgent',
      requestedAt: now,
    },
  };
}

// 52167 — Retest reminders: nudge assignees when a requested retest sits
// unexecuted past its scheduled window.
export function dueReminders(queue, now = Date.now()) {
  const items = Array.isArray(queue) ? queue : [];
  return items
    .filter((r) => (r.status === 'queued' || r.status === 'scheduled') && r.windowEnd && r.windowEnd < now)
    .map((r) => ({
      requestId: r.id,
      findingId: r.findingId,
      assignee: r.assignee || null,
      overdueByMs: now - r.windowEnd,
      message: `Retest ${r.id} is past its scheduled window`,
    }));
}

// 52168 — Retest analytics: fix-verification rates, retest turnaround, and
// "still vulnerable" rates per team and asset.
export function retestAnalytics(results) {
  const rows = Array.isArray(results) ? results : [];
  const total = rows.length;
  const fixed = rows.filter((r) => r.verdict === 'fixed').length;
  const stillVuln = rows.filter((r) => r.verdict === 'still-vulnerable').length;
  const durations = rows
    .filter((r) => typeof r.completedAt === 'number' && typeof r.startedAt === 'number' && r.completedAt >= r.startedAt)
    .map((r) => r.completedAt - r.startedAt);
  const byTeam = {};
  const byAsset = {};
  for (const r of rows) {
    const t = r.team || 'unassigned';
    const a = r.asset || r.target || 'unknown';
    byTeam[t] = byTeam[t] || { total: 0, fixed: 0, stillVulnerable: 0 };
    byAsset[a] = byAsset[a] || { total: 0, fixed: 0, stillVulnerable: 0 };
    byTeam[t].total += 1;
    byAsset[a].total += 1;
    if (r.verdict === 'fixed') { byTeam[t].fixed += 1; byAsset[a].fixed += 1; }
    if (r.verdict === 'still-vulnerable') { byTeam[t].stillVulnerable += 1; byAsset[a].stillVulnerable += 1; }
  }
  const rate = (n, d) => (d === 0 ? 0 : n / d);
  const withRates = (bucket) => Object.fromEntries(
    Object.entries(bucket).map(([k, v]) => [
      k,
      {
        ...v,
        fixVerificationRate: rate(v.fixed, v.total),
        stillVulnerableRate: rate(v.stillVulnerable, v.total),
      },
    ])
  );
  return {
    total,
    fixVerificationRate: rate(fixed, total),
    stillVulnerableRate: rate(stillVuln, total),
    avgTurnaroundMs: durations.length === 0 ? 0 : durations.reduce((s, d) => s + d, 0) / durations.length,
    byTeam: withRates(byTeam),
    byAsset: withRates(byAsset),
  };
}

// 52169 — Chained-finding retest: retest every finding in an exploit chain
// together to verify the whole chain is broken.
export function queueChainRetest(chain, options = {}, now = Date.now()) {
  if (!chain || !Array.isArray(chain.findingIds) || chain.findingIds.length === 0) {
    return { ok: false, reason: 'a chain with findingIds is required' };
  }
  return {
    ok: true,
    batch: {
      id: nextId('chain'),
      chainId: chain.id || null,
      kind: 'chained-retest',
      status: 'queued',
      priority: options.priority || 'urgent',
      requestedAt: now,
      requests: chain.findingIds.map((fid) => ({
        id: nextId('rt'),
        findingId: fid,
        status: 'queued',
        priority: options.priority || 'urgent',
      })),
    },
  };
}

// 52170 — Retest with proxy capture: route retest traffic through a logging
// proxy and attach the capture to the finding.
export function buildProxyCaptureConfig(targetUrl, options = {}) {
  if (!targetUrl) return { ok: false, reason: 'targetUrl is required' };
  return {
    ok: true,
    capture: {
      id: nextId('cap'),
      targetUrl,
      proxy: options.proxy || 'http://127.0.0.1:8080',
      recordBodies: options.recordBodies !== false,
      maxBytes: options.maxBytes || 5 * 1024 * 1024,
      attachToFinding: true,
    },
  };
}

// 52171 — Retest evidence diff highlighting: highlight exactly what changed in
// responses between the original and the retest evidence. Token-level diff
// over whitespace-separated tokens using a simple LCS walk.
export function diffEvidenceTokens(before, after) {
  const a = String(before || '').split(/\s+/).filter(Boolean);
  const b = String(after || '').split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { ops.push({ type: 'same', token: a[i] }); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'removed', token: a[i] }); i += 1; }
    else { ops.push({ type: 'added', token: b[j] }); j += 1; }
  }
  while (i < m) { ops.push({ type: 'removed', token: a[i] }); i += 1; }
  while (j < n) { ops.push({ type: 'added', token: b[j] }); j += 1; }
  const changed = ops.filter((o) => o.type !== 'same').length;
  return { ops, changed, total: ops.length, unchanged: ops.length - changed };
}

// 52172 — Bulk retest by severity: queue retests for every open finding at or
// above a chosen severity in one action.
export function bulkQueueBySeverity(findings, minSeverity = 'high', options = {}, now = Date.now()) {
  const rank = SEVERITY_RANK[minSeverity];
  if (rank === undefined) return { ok: false, reason: `unknown severity: ${minSeverity}` };
  const rows = (Array.isArray(findings) ? findings : []).filter(
    (f) => f.status === 'open' && (SEVERITY_RANK[f.severity] ?? 99) <= rank
  );
  return {
    ok: true,
    batch: {
      id: nextId('bulk'),
      kind: 'bulk-by-severity',
      minSeverity,
      requestedAt: now,
      count: rows.length,
      requests: rows.map((f) => ({
        id: nextId('rt'),
        findingId: f.id,
        status: 'queued',
        priority: options.priority || 'normal',
        severity: f.severity,
      })),
    },
  };
}

// 52173 — Bulk retest by asset: queue retests for all open findings on the
// selected assets after an infra change.
export function bulkQueueByAsset(findings, assets, options = {}, now = Date.now()) {
  if (!Array.isArray(assets) || assets.length === 0) return { ok: false, reason: 'at least one asset is required' };
  const set = new Set(assets);
  const rows = (Array.isArray(findings) ? findings : []).filter(
    (f) => f.status === 'open' && (set.has(f.asset) || set.has(f.target))
  );
  return {
    ok: true,
    batch: {
      id: nextId('bulk'),
      kind: 'bulk-by-asset',
      assets: [...assets],
      requestedAt: now,
      count: rows.length,
      requests: rows.map((f) => ({
        id: nextId('rt'),
        findingId: f.id,
        status: 'queued',
        priority: options.priority || 'normal',
        asset: f.asset || f.target,
      })),
    },
  };
}

// 52174 — Retest request export: export the retest queue (what, why, when,
// status) as CSV for status meetings.
function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function queueToCsv(queue) {
  const rows = Array.isArray(queue) ? queue : [];
  const header = ['request_id', 'finding_id', 'status', 'priority', 'trigger', 'requested_at'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.id, r.findingId, r.status, r.priority || '', r.trigger || '',
      r.requestedAt ? new Date(r.requestedAt).toISOString() : '',
    ].map(csvCell).join(','));
  }
  return { csv: lines.join('\n'), rows: rows.length };
}

// 52175 — Retest duplicate detection: warn when a retest request duplicates
// one already queued or recently completed for the same finding. The signature
// covers finding + trigger + scope so materially different requests pass.
export function retestSignature(request) {
  if (!request || !request.findingId) return null;
  return [
    request.findingId,
    request.trigger || 'manual',
    request.brain || 'default',
    request.depth || 'shallow',
    request.fixCommit || '',
  ].join('|');
}
export function findDuplicate(request, existing, options = {}) {
  const sig = retestSignature(request);
  if (!sig) return { ok: false, reason: 'request has no signature' };
  const recentMs = options.recentMs || 30 * 24 * 60 * 60 * 1000;
  const now = options.now || Date.now();
  const match = (Array.isArray(existing) ? existing : []).find((e) => {
    if (e.id === request.id) return false;
    if (retestSignature(e) !== sig) return false;
    if (e.status === 'queued' || e.status === 'running' || e.status === 'scheduled') return true;
    return typeof e.completedAt === 'number' && now - e.completedAt <= recentMs;
  });
  return { ok: true, duplicate: Boolean(match), matchedId: match ? match.id : null };
}

// 52176 — Retest auto-trigger on WAF change: when monitoring detects a WAF
// rule change on the target, auto-queue retests for previously WAF-blocked
// findings.
export function wafChangeTrigger(event, findings, now = Date.now()) {
  if (!event || !event.target) return { ok: false, reason: 'a WAF change event with a target is required' };
  const rows = (Array.isArray(findings) ? findings : []).filter(
    (f) => f.status === 'open' && (f.asset === event.target || f.target === event.target) && f.wafBlocked === true
  );
  return {
    ok: true,
    batch: {
      id: nextId('waf'),
      kind: 'waf-change',
      target: event.target,
      changeId: event.changeId || null,
      requestedAt: now,
      count: rows.length,
      requests: rows.map((f) => ({
        id: nextId('rt'),
        findingId: f.id,
        status: 'queued',
        priority: 'urgent',
        trigger: 'waf-change',
      })),
    },
  };
}

// 52177 — Retest notification preferences: per-user control over which retest
// events (queued, started, completed, failed) trigger notifications.
export const RETEST_EVENT_KINDS = ['queued', 'started', 'completed', 'failed'];
export function evaluateNotificationPrefs(prefs, event) {
  if (!event || !event.kind) return { notify: false, reason: 'event kind is required' };
  const allow = prefs && typeof prefs[event.kind] === 'boolean' ? prefs[event.kind] : true;
  return {
    notify: allow,
    kind: event.kind,
    channels: allow ? (prefs && Array.isArray(prefs.channels) ? prefs.channels : ['in-app']) : [],
  };
}

// 52178 — Retest queue reordering: priority reprioritization of pending
// retests by leads (move up/down/to-top).
export function reorderQueue(queue, requestId, direction = 'up') {
  const rows = Array.isArray(queue) ? [...queue] : [];
  const idx = rows.findIndex((r) => r.id === requestId);
  if (idx === -1) return { ok: false, reason: `request ${requestId} not in queue` };
  const movable = rows.filter((r) => r.status === 'queued' || r.status === 'scheduled');
  const current = movable.findIndex((r) => r.id === requestId);
  if (current === -1) return { ok: false, reason: 'only pending requests can be reordered' };
  if (direction === 'to-top') {
    movable.splice(0, 0, movable.splice(current, 1)[0]);
  } else if (direction === 'up' && current > 0) {
    [movable[current - 1], movable[current]] = [movable[current], movable[current - 1]];
  } else if (direction === 'down' && current < movable.length - 1) {
    [movable[current + 1], movable[current]] = [movable[current], movable[current + 1]];
  } else if (direction === 'to-bottom') {
    movable.push(movable.splice(current, 1)[0]);
  } else {
    return { ok: false, reason: `unknown or no-op direction: ${direction}` };
  }
  let cursor = 0;
  for (const r of movable) r.order = cursor += 1;
  return { ok: true, queue: rows };
}

// 52179 — Retest scoped to fix commit: tie a retest to a specific code commit
// so verification is pinned to exactly what was deployed.
export function scopeRetestToCommit(request, commit) {
  if (!request || !request.id) return { ok: false, reason: 'a retest request is required' };
  if (!commit || !commit.sha) return { ok: false, reason: 'a commit sha is required' };
  return {
    ok: true,
    request: {
      ...request,
      fixCommit: commit.sha,
      commitMessage: commit.message || '',
      deployedAt: commit.deployedAt || null,
    },
  };
}

// 52180 — Retest evidence retention policy: configure how long retest
// evidence is kept, with automatic cleanup of old captures.
export function retentionExpiry(capturedAt, policy = {}, now = Date.now()) {
  if (typeof capturedAt !== 'number') return { ok: false, reason: 'capturedAt timestamp is required' };
  const days = policy.days || 90;
  const expiresAt = capturedAt + days * 24 * 60 * 60 * 1000;
  return { ok: true, expiresAt, days, expired: now >= expiresAt };
}
export function retentionCleanupPlan(items, policy = {}, now = Date.now()) {
  const rows = Array.isArray(items) ? items : [];
  const due = [];
  const kept = [];
  for (const item of rows) {
    const e = retentionExpiry(item.capturedAt, policy, now);
    if (e.ok && e.expired) due.push(item.id);
    else kept.push(item.id);
  }
  return { dueForDeletion: due, kept, policyDays: policy.days || 90 };
}

// 52181 — Retest verdict confidence: each retest verdict carries a confidence
// level; inconclusive results are flagged for manual review. Confidence is
// scored from evidence signals (probe count, evidence strength, agreement
// between probes) on a 0–100 scale.
export function scoreVerdictConfidence(verdict, signals = {}) {
  if (!verdict || !RETEST_VERDICTS.includes(verdict.verdict)) {
    return { ok: false, reason: 'a valid retest verdict is required' };
  }
  const probes = Math.max(1, signals.probes || 1);
  const agreement = typeof signals.agreement === 'number' ? Math.min(1, Math.max(0, signals.agreement)) : 0.5;
  const strength = { weak: 0.2, moderate: 0.5, strong: 0.8 }[signals.evidenceStrength] || 0.5;
  const score = Math.round(100 * (0.35 * Math.min(1, probes / 5) + 0.4 * agreement + 0.25 * strength));
  const level = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';
  return {
    ok: true,
    verdict: verdict.verdict,
    score,
    level,
    needsManualReview: verdict.verdict === 'inconclusive' || level === 'low',
  };
}
