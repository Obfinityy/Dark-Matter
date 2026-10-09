/**
 * Wave 107A — Change lifecycle management (ideas 54241-54250).
 *
 * Pure JS core logic for change-detection lifecycle in Dark Matter / Hunt AI.
 * No JSX, no side effects — every export is deterministic and testable with
 * plain objects. Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE107_A_IDEAS = [
  { id: 54241, title: 'Baseline snapshot management', summary: 'Named, labeled baselines with comparison instead of only last-run.' },
  { id: 54242, title: 'Scheduled re-baselining', summary: 'Auto-accepts current state as baseline after N quiet days.' },
  { id: 54243, title: 'Ignore list for noisy changes', summary: 'Mutes specific change patterns (e.g. rotating CSRF tokens) with reason codes.' },
  { id: 54244, title: 'Change approval workflow (targets)', summary: 'Routes high-severity changes to an owner for acknowledge-or-investigate triage.' },
  { id: 54245, title: 'Change-triggered hunts (targets)', summary: 'Auto-queues a focused hunt when high-interest changes like new endpoints appear.' },
  { id: 54246, title: 'Change annotations', summary: 'Lets analysts note "planned deploy" on changes to build institutional memory.' },
  { id: 54247, title: 'Change comparison screenshots', summary: 'Shows before/after screenshots side by side for visual page changes.' },
  { id: 54248, title: 'Change webhooks and API', summary: 'Pushes structured change events to external SOAR or ticketing systems.' },
  { id: 54249, title: 'Change retention policy', summary: 'Configures how long raw change evidence is kept per client or program.' },
  { id: 54250, title: 'Bulk change review', summary: 'Triages dozens of changes across targets with multi-select acknowledge and snooze.' },
];

/* ------------------------------------------------------------------ */
/* 54241 — Baseline snapshot management                                 */
/* ------------------------------------------------------------------ */

/**
 * Creates a named baseline snapshot for a target.
 * @param {{targetId:string, label:string, state:object, now?:string}} args
 */
export function createBaseline({ targetId, label, state, now = new Date().toISOString() }) {
  if (!targetId || typeof targetId !== 'string') throw new Error('targetId is required');
  if (!label || typeof label !== 'string') throw new Error('label is required');
  return {
    id: `baseline:${targetId}:${label}`,
    targetId,
    label,
    state: state || {},
    createdAt: now,
    kind: 'named-baseline',
  };
}

/**
 * Compares current state against a named baseline, returning changed keys.
 */
export function compareToBaseline(baseline, currentState) {
  const before = (baseline && baseline.state) || {};
  const after = currentState || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push({ key, before: before[key], after: after[key] });
    }
  }
  return { baselineId: baseline ? baseline.id : null, changed, changedCount: changed.length };
}

/* ------------------------------------------------------------------ */
/* 54242 — Scheduled re-baselining                                      */
/* ------------------------------------------------------------------ */

/**
 * Decides whether the baseline should auto-rebaseline given quiet days.
 * @param {{baseline:object, quietDays:number, thresholdDays:number, now?:string}} args
 * @returns {{shouldRebaseline:boolean, quietDays:number, thresholdDays:number, nextEligibleAt:string|null}}
 */
export function scheduleRebaseline({ baseline, quietDays, thresholdDays = 7, now = new Date().toISOString() }) {
  const days = Math.max(0, Number(quietDays) || 0);
  const threshold = Math.max(1, Number(thresholdDays) || 1);
  const shouldRebaseline = days >= threshold;
  let nextEligibleAt = null;
  if (!shouldRebaseline) {
    const base = baseline && baseline.createdAt ? new Date(baseline.createdAt) : new Date(now);
    nextEligibleAt = new Date(base.getTime() + threshold * 86400000).toISOString();
  }
  return { shouldRebaseline, quietDays: days, thresholdDays: threshold, nextEligibleAt };
}

/* ------------------------------------------------------------------ */
/* 54243 — Ignore list for noisy changes                                */
/* ------------------------------------------------------------------ */

export const IGNORE_REASONS = ['rotating-token', 'timestamp', 'session-data', 'ad-carousel', 'analytics', 'custom'];

export function addIgnoreRule(rules, { pattern, reason = 'custom', targetId = null }) {
  if (!pattern || typeof pattern !== 'string') throw new Error('pattern is required');
  if (!IGNORE_REASONS.includes(reason)) throw new Error(`unknown reason: ${reason}`);
  const rule = {
    id: `ignore:${rules.length + 1}`,
    pattern: new RegExp(pattern),
    source: pattern,
    reason,
    targetId,
    createdAt: new Date().toISOString(),
  };
  return [...rules, rule];
}

export function isChangeIgnored(rules, change) {
  const value = `${change.key || ''}:${JSON.stringify(change.after)}`;
  return rules.some((rule) => rule.pattern.test(value));
}

/* ------------------------------------------------------------------ */
/* 54244 — Change approval workflow (targets)                           */
/* ------------------------------------------------------------------ */

export const APPROVAL_SEVERITIES = ['critical', 'high', 'medium', 'low'];

/**
 * Routes a change to an owner when severity warrants approval.
 * @returns {{routed:boolean, owner:string|null, action:string, ticket:object|null}}
 */
export function routeForApproval(change, ownerMap) {
  const severity = change.severity || 'low';
  const needsApproval = severity === 'critical' || severity === 'high';
  if (!needsApproval) {
    return { routed: false, owner: null, action: 'auto-acknowledge', ticket: null };
  }
  const owner = (ownerMap && ownerMap[change.targetId]) || 'default-owner';
  return {
    routed: true,
    owner,
    action: 'awaiting-review',
    ticket: {
      changeId: change.id,
      severity,
      owner,
      status: 'pending',
      options: ['acknowledge', 'investigate'],
      createdAt: new Date().toISOString(),
    },
  };
}

export function triageTicket(ticket, decision) {
  if (!['acknowledge', 'investigate'].includes(decision)) throw new Error('invalid decision');
  return { ...ticket, status: decision === 'acknowledge' ? 'acknowledged' : 'investigating' };
}

/* ------------------------------------------------------------------ */
/* 54245 — Change-triggered hunts (targets)                             */
/* ------------------------------------------------------------------ */

export const HIGH_INTEREST_KEYS = ['new-endpoint', 'new-route', 'new-parameter', 'new-subdomain', 'tech-change', 'new-form'];

/**
 * Queues a focused hunt when a change is high-interest. Deterministic.
 */
export function queueHuntOnChange(change, target) {
  const key = change.key || change.type || '';
  const isHighInterest =
    HIGH_INTEREST_KEYS.some((k) => key.toLowerCase().includes(k)) ||
    change.severity === 'critical' ||
    change.severity === 'high';
  if (!isHighInterest) return null;
  return {
    huntId: `hunt:${change.targetId || (target && target.id) || 'unknown'}:${change.id}`,
    targetId: change.targetId || (target && target.id) || 'unknown',
    triggerChangeId: change.id,
    focus: key,
    priority: change.severity === 'critical' ? 'p0' : 'p1',
    status: 'queued',
    queuedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* 54246 — Change annotations                                           */
/* ------------------------------------------------------------------ */

export function addAnnotation(annotations, { changeId, author, note }) {
  if (!changeId || !author || !note) throw new Error('changeId, author and note are required');
  const entry = {
    id: `annotation:${changeId}:${annotations.length + 1}`,
    changeId,
    author,
    note,
    createdAt: new Date().toISOString(),
  };
  return [...annotations, entry];
}

export function getAnnotations(annotations, changeId) {
  return annotations.filter((a) => a.changeId === changeId);
}

/* ------------------------------------------------------------------ */
/* 54247 — Change comparison screenshots                                */
/* ------------------------------------------------------------------ */

/**
 * Builds a before/after screenshot pair descriptor for side-by-side view.
 */
export function compareScreenshots({ changeId, beforeUrl, afterUrl, beforeLabel = 'Before', afterLabel = 'After' }) {
  if (!changeId || !beforeUrl || !afterUrl) throw new Error('changeId, beforeUrl and afterUrl are required');
  return {
    changeId,
    layout: 'side-by-side',
    before: { url: beforeUrl, label: beforeLabel },
    after: { url: afterUrl, label: afterLabel },
    capturedAt: new Date().toISOString(),
  };
}

export function screenshotDiffSummary(pair) {
  const hasBefore = Boolean(pair && pair.before && pair.before.url);
  const hasAfter = Boolean(pair && pair.after && pair.after.url);
  return {
    changeId: pair ? pair.changeId : null,
    complete: hasBefore && hasAfter,
    missing: [!hasBefore && 'before', !hasAfter && 'after'].filter(Boolean),
  };
}

/* ------------------------------------------------------------------ */
/* 54248 — Change webhooks and API                                      */
/* ------------------------------------------------------------------ */

export function buildWebhookPayload(change, target) {
  return {
    event: 'change.detected',
    version: 'v1',
    provider: 'Infinity AI',
    timestamp: new Date().toISOString(),
    change: {
      id: change.id,
      targetId: change.targetId || (target && target.id) || null,
      key: change.key || null,
      severity: change.severity || 'low',
      before: change.before === undefined ? null : change.before,
      after: change.after === undefined ? null : change.after,
    },
    target: target ? { id: target.id, name: target.name || null } : null,
  };
}

export function parseWebhookDelivery(responseStatus) {
  const ok = responseStatus >= 200 && responseStatus < 300;
  return { delivered: ok, status: responseStatus, nextRetry: ok ? null : 'backoff' };
}

/* ------------------------------------------------------------------ */
/* 54249 — Change retention policy                                      */
/* ------------------------------------------------------------------ */

export const RETENTION_UNITS = ['days', 'weeks', 'months'];

/**
 * Builds a retention policy and computes expiry for evidence records.
 */
export function applyRetentionPolicy({ clientId = null, program = null, amount, unit = 'days' }) {
  if (!RETENTION_UNITS.includes(unit)) throw new Error(`unknown unit: ${unit}`);
  const n = Math.max(1, Number(amount) || 1);
  const days = unit === 'days' ? n : unit === 'weeks' ? n * 7 : n * 30;
  return {
    id: `retention:${clientId || 'global'}:${program || 'default'}`,
    clientId,
    program,
    amount: n,
    unit,
    days,
  };
}

export function evidenceExpiry(capturedAt, policy) {
  const captured = new Date(capturedAt);
  return new Date(captured.getTime() + (policy.days || 30) * 86400000).toISOString();
}

export function isEvidenceExpired(capturedAt, policy, now = new Date()) {
  return new Date(evidenceExpiry(capturedAt, policy)) <= new Date(now);
}

/* ------------------------------------------------------------------ */
/* 54250 — Bulk change review                                           */
/* ------------------------------------------------------------------ */

/**
 * Bulk triage: acknowledge or snooze a set of changes by id.
 * Returns { results, counts } — deterministic.
 */
export function bulkReview(changes, selectedIds, action, options = {}) {
  if (!['acknowledge', 'snooze'].includes(action)) throw new Error('invalid action');
  const selected = new Set(selectedIds || []);
  const results = [];
  const counts = { acknowledged: 0, snoozed: 0, skipped: 0 };
  for (const change of changes) {
    if (!selected.has(change.id)) {
      counts.skipped += 1;
      continue;
    }
    if (action === 'acknowledge') {
      counts.acknowledged += 1;
      results.push({ ...change, status: 'acknowledged', acknowledgedAt: new Date().toISOString() });
    } else {
      counts.snoozed += 1;
      results.push({
        ...change,
        status: 'snoozed',
        snoozedUntil: options.snoozedUntil || null,
      });
    }
  }
  return { results, counts };
}
