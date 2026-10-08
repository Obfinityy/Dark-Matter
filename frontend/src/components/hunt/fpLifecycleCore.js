/**
 * fpLifecycleCore.js — Infinity AI · Dark-Matter · Wave 53
 * Pure logic (no React, no DOM, no network) backing the false-positive
 * lifecycle round 3: idea-bank ideas 52081–52100. Every exported function is
 * pure and deterministic; time is injected via `now` parameters (defaults to
 * Date.now()).
 */

export const WAVE53_FP_LIFECYCLE_IDEAS = [
  { id: 52081, title: 'FP exclusion footnotes in reports' },
  { id: 52082, title: 'FP dispute workflow' },
  { id: 52083, title: 'FP SLA tracking' },
  { id: 52084, title: 'FP trend charts over hunts' },
  { id: 52085, title: 'Per-finding FP probability badge' },
  { id: 52086, title: 'FP reason search' },
  { id: 52087, title: 'Cross-hunt FP pattern detection' },
  { id: 52088, title: 'User-defined auto-FP rules' },
  { id: 52089, title: 'Per-target FP allowlist' },
  { id: 52090, title: 'FP rule versioning' },
  { id: 52091, title: 'FP rule sandbox testing' },
  { id: 52092, title: 'Shared team FP rules' },
  { id: 52093, title: 'FP false-negative guard' },
  { id: 52094, title: 'FP confidence threshold setting' },
  { id: 52095, title: 'FP auto-expiry' },
  { id: 52096, title: 'FP tags' },
  { id: 52097, title: 'FP digest email' },
  { id: 52098, title: 'FP reopen on target change' },
  { id: 52099, title: 'FP inheritance to future hunts' },
  { id: 52100, title: 'FP heatmap by endpoint' },
];

// 52081 — FP exclusion footnotes in reports: dismissed FPs listed in an
// appendix with reasons so exported reports keep a complete record.
export function buildFpAppendix(fpDecisions) {
  const rows = (fpDecisions || []).map((d, i) => ({
    footnote: i + 1,
    findingId: d.findingId,
    title: d.title || d.findingId,
    reasonId: d.reasonId || 'unspecified',
    reasonLabel: d.reasonLabel || String(d.reasonId || 'unspecified'),
    markedBy: d.markedBy || 'unknown',
    markedAt: d.markedAt != null ? Number(d.markedAt) : null,
    text: `[${i + 1}] Excluded as false positive — ${d.reasonLabel || d.reasonId || 'unspecified'} (marked by ${d.markedBy || 'unknown'})`,
  }));
  return {
    count: rows.length,
    rows,
    heading: `Appendix B — Excluded false positives (${rows.length})`,
  };
}

// 52082 — FP dispute workflow: challenge a dismissal, reopening it into a
// "disputed" state for re-review; disputes resolve to upheld or overturned.
export function openDispute(marking, byUser, challenge, now = Date.now()) {
  const m = marking || {};
  if (String(m.status || '') === 'disputed') return { ...m, ok: false, reason: 'already disputed' };
  if (!m.findingId) return { ...m, ok: false, reason: 'marking has no findingId' };
  return {
    ...m,
    ok: true,
    status: 'disputed',
    dispute: {
      challengedBy: String(byUser || 'unknown'),
      challenge: String(challenge || ''),
      openedAt: Number(now),
      resolution: null,
    },
  };
}
export function resolveDispute(disputedMarking, verdict, resolvedBy, now = Date.now()) {
  const m = disputedMarking || {};
  if (String(m.status || '') !== 'disputed')
    return { ...m, ok: false, reason: 'not in disputed state' };
  const okVerdict = ['upheld', 'overturned'].includes(String(verdict));
  if (!okVerdict)
    return { ...m, ok: false, reason: `verdict must be upheld|overturned, got "${verdict}"` };
  const base = { ...m };
  delete base.ok;
  return {
    ...base,
    ok: true,
    status: String(verdict) === 'upheld' ? 'false-positive' : 'open',
    dispute: {
      ...(m.dispute || {}),
      resolution: String(verdict),
      resolvedBy: String(resolvedBy || 'unknown'),
      resolvedAt: Number(now),
    },
  };
}

// 52083 — FP SLA tracking: time from finding creation to FP decision against
// per-severity targets.
export const FP_SLA_TARGETS_MS = {
  critical: 4 * 3600e3,
  high: 24 * 3600e3,
  medium: 72 * 3600e3,
  low: 168 * 3600e3,
  info: 336 * 3600e3,
};
export function fpSlaElapsed(foundAt, decidedAt, severity, targetsMs = FP_SLA_TARGETS_MS) {
  const sev = String(severity || 'medium').toLowerCase();
  const target = Number((targetsMs || {})[sev] != null ? targetsMs[sev] : targetsMs.medium);
  const elapsed = Number(decidedAt) - Number(foundAt);
  const met = elapsed <= target;
  return {
    severity: sev,
    elapsedMs: elapsed,
    targetMs: target,
    met,
    overrunMs: met ? 0 : elapsed - target,
  };
}
export function fpSlaSummary(markings, targetsMs = FP_SLA_TARGETS_MS) {
  const rows = (markings || [])
    .filter(m => m.foundAt != null && m.decidedAt != null)
    .map(m => fpSlaElapsed(m.foundAt, m.decidedAt, m.severity, targetsMs));
  const met = rows.filter(r => r.met).length;
  return {
    total: rows.length,
    met,
    violated: rows.length - met,
    metRate: rows.length ? Math.round((met / rows.length) * 1000) / 1000 : 0,
    rows,
  };
}

// 52084 — FP trend charts over hunts: hunt-over-hunt FP rates.
export function fpTrendOverHunts(hunts) {
  return (hunts || []).map(h => {
    const total = Number(h.totalFindings || 0);
    const fps = Number(h.falsePositives || 0);
    const rate = total > 0 ? Math.round((fps / total) * 1000) / 1000 : 0;
    return { huntId: h.huntId, total, falsePositives: fps, fpRate: rate };
  });
}
export function fpTrendDirection(series) {
  const s = fpTrendOverHunts(series || []);
  if (s.length < 2) return { direction: 'flat', first: null, last: null, delta: 0 };
  const first = s[0].fpRate;
  const last = s[s.length - 1].fpRate;
  const delta = Math.round((last - first) * 1000) / 1000;
  return {
    direction: delta < -0.005 ? 'improving' : delta > 0.005 ? 'worsening' : 'flat',
    first,
    last,
    delta,
  };
}

// 52085 — Per-finding FP probability badge: "72% likely FP" from historical
// dismissal patterns for the same signature.
export function fpProbabilityForSignature(signature, history) {
  const sig = String(signature || '');
  const related = (history || []).filter(h => String(h.signature || '') === sig);
  const dismissed = related.filter(h => h.isFalsePositive === true).length;
  if (!related.length)
    return { signature: sig, probability: 0.5, sample: 0, label: '50% likely FP' };
  const p = Math.round((dismissed / related.length) * 100) / 100;
  return {
    signature: sig,
    probability: p,
    sample: related.length,
    label: `${Math.round(p * 100)}% likely FP`,
  };
}

// 52086 — FP reason search: full-text search across justifications for precedent.
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2);
}
export function searchFpReasons(justifications, query) {
  const q = tokenize(query);
  if (!q.length) return [];
  return (justifications || [])
    .map(j => {
      const hay = tokenize([j.justification, j.reasonLabel, j.reasonId, j.findingTitle].join(' '));
      const haySet = new Set(hay);
      const hits = q.filter(t => haySet.has(t)).length;
      return { ...j, hits, score: hits / q.length };
    })
    .filter(j => j.hits > 0)
    .sort((a, b) => b.score - a.score || b.hits - a.hits);
}

// 52087 — Cross-hunt FP pattern detection: surface recurring FP signatures
// across hunts and propose a standing rule.
export function detectCrossHuntFpPatterns(fpRecords, minHunts = 3) {
  const bySig = {};
  for (const r of fpRecords || []) {
    const sig = String(r.signature || r.vulnClass || 'unknown');
    if (!bySig[sig]) bySig[sig] = { signature: sig, hunts: new Set(), count: 0, reasonIds: {} };
    bySig[sig].hunts.add(String(r.huntId || 'unknown'));
    bySig[sig].count += 1;
    const rid = String(r.reasonId || 'unspecified');
    bySig[sig].reasonIds[rid] = (bySig[sig].reasonIds[rid] || 0) + 1;
  }
  return Object.values(bySig)
    .map(p => {
      const topReason = Object.entries(p.reasonIds).sort((a, b) => b[1] - a[1])[0];
      return {
        signature: p.signature,
        huntCount: p.hunts.size,
        hunts: [...p.hunts].sort(),
        occurrences: p.count,
        topReasonId: topReason ? topReason[0] : 'unspecified',
        proposesStandingRule: p.hunts.size >= minHunts,
        proposedRuleName: `auto-fp: ${p.signature}`,
      };
    })
    .filter(p => p.proposesStandingRule)
    .sort((a, b) => b.huntCount - a.huntCount || b.occurrences - a.occurrences);
}

// 52088 — User-defined auto-FP rules: condition DSL matched against findings.
// Rule shape: { id, name, conditions: [{field, op, value}], action: 'dismiss' }
export function makeAutoFpRule(id, name, conditions) {
  const conds = (conditions || []).map(c => ({
    field: String(c.field || ''),
    op: ['contains', 'equals', 'matches'].includes(c.op) ? c.op : 'contains',
    value: String(c.value || ''),
  }));
  return { id: String(id), name: String(name), conditions: conds, version: 1, enabled: true };
}
function getField(finding, field) {
  return String((finding || {})[field] != null ? finding[field] : '');
}
export function matchAutoFpRule(rule, finding) {
  const conds = (rule || {}).conditions || [];
  if (!conds.length) return { matched: false, matchedConditions: 0 };
  const matched = conds.filter(c => {
    const v = getField(finding, c.field);
    if (c.op === 'equals') return v === c.value;
    if (c.op === 'matches') {
      try {
        return new RegExp(c.value, 'i').test(v);
      } catch {
        return false;
      }
    }
    return v.toLowerCase().includes(c.value.toLowerCase());
  });
  return {
    matched: matched.length === conds.length,
    matchedConditions: matched.length,
    totalConditions: conds.length,
  };
}

// 52089 — Per-target FP allowlist: known-benign behaviors per target that
// never surface as findings again.
export function addTargetAllowlistEntry(
  allowlist,
  target,
  signature,
  reason,
  addedBy,
  now = Date.now()
) {
  const list = Array.isArray(allowlist) ? [...allowlist] : [];
  const entry = {
    target: String(target),
    signature: String(signature),
    reason: String(reason || ''),
    addedBy: String(addedBy || 'unknown'),
    addedAt: Number(now),
  };
  if (list.some(e => e.target === entry.target && e.signature === entry.signature)) {
    return { allowlist: list, added: false, reason: 'entry already allowlisted' };
  }
  return { allowlist: [...list, entry], added: true, entry };
}
export function checkTargetAllowlist(allowlist, target, signature) {
  return (allowlist || []).some(
    e => String(e.target) === String(target) && String(e.signature) === String(signature)
  );
}

// 52090 — FP rule versioning: history with diffs and rollback.
function diffConditions(oldConds, newConds) {
  const o = JSON.stringify(oldConds || []);
  const n = JSON.stringify(newConds || []);
  return o === n ? [] : [{ field: 'conditions', before: JSON.parse(o), after: JSON.parse(n) }];
}
export function versionAutoFpRule(rule, changes, changedBy, now = Date.now()) {
  const r = rule || {};
  const before = JSON.parse(
    JSON.stringify({ conditions: r.conditions, enabled: r.enabled, name: r.name })
  );
  const next = {
    ...r,
    conditions: changes.conditions != null ? changes.conditions : r.conditions,
    enabled: changes.enabled != null ? changes.enabled : r.enabled,
    name: changes.name != null ? changes.name : r.name,
    version: Number(r.version || 1) + 1,
  };
  const after = JSON.parse(
    JSON.stringify({ conditions: next.conditions, enabled: next.enabled, name: next.name })
  );
  const diff = diffConditions(before.conditions, after.conditions);
  if (before.enabled !== after.enabled)
    diff.push({ field: 'enabled', before: before.enabled, after: after.enabled });
  if (before.name !== after.name)
    diff.push({ field: 'name', before: before.name, after: after.name });
  const historyEntry = {
    version: next.version,
    changedBy: String(changedBy || 'unknown'),
    changedAt: Number(now),
    diff,
    snapshot: before,
  };
  return { ...next, history: [...(r.history || []), historyEntry] };
}
export function rollbackAutoFpRule(rule, toVersion) {
  const r = rule || {};
  const entry = (r.history || []).find(h => Number(h.version) === Number(toVersion));
  if (!entry) return { ...r, ok: false, reason: `no version ${toVersion} in history` };
  return {
    ...r,
    conditions: entry.snapshot.conditions,
    enabled: entry.snapshot.enabled,
    name: entry.snapshot.name,
    ok: true,
    rolledBackTo: Number(toVersion),
  };
}

// 52091 — FP rule sandbox testing: preview what a rule would have dismissed
// against historical hunts before enabling.
export function sandboxTestRule(rule, historicalFindings) {
  const findings = historicalFindings || [];
  const matches = findings.filter(f => matchAutoFpRule(rule, f).matched);
  const bySeverity = {};
  for (const m of matches) {
    const sev = String(m.severity || 'unknown').toLowerCase();
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }
  return {
    ruleId: (rule || {}).id,
    scanned: findings.length,
    wouldDismiss: matches.length,
    wouldKeep: findings.length - matches.length,
    bySeverity,
    sample: matches
      .slice(0, 5)
      .map(m => ({ findingId: m.findingId, title: m.title, severity: m.severity })),
  };
}

// 52092 — Shared team FP rules: publish to a team library with ownership and
// review dates.
export function publishTeamRule(rule, owner, teamId, now = Date.now()) {
  const r = rule || {};
  if (!r.id || !r.name) return { ok: false, reason: 'rule needs id and name' };
  return {
    ok: true,
    libraryEntry: {
      ruleId: r.id,
      name: r.name,
      version: r.version || 1,
      teamId: String(teamId || 'default'),
      owner: String(owner || 'unknown'),
      publishedAt: Number(now),
      reviewDueAt: Number(now) + 90 * 86400e3,
      status: 'published',
    },
  };
}
export function teamRuleReviewStatus(libraryEntry, now = Date.now()) {
  const e = libraryEntry || {};
  const due = Number(e.reviewDueAt || 0);
  return {
    reviewDueAt: due,
    overdue: Number(now) > due,
    daysLeft: Math.floor((due - Number(now)) / 86400e3),
  };
}

// 52093 — FP false-negative guard: deterministic pseudo-random sample of
// auto-dismissed FPs for human spot-check.
function hashSample(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}
export function guardSampleDismissals(autoDismissed, ratePercent = 5) {
  return (autoDismissed || []).filter(
    d => hashSample(String(d.findingId || '')) < Number(ratePercent)
  );
}
export function guardSampleSummary(autoDismissed, ratePercent = 5) {
  const sample = guardSampleDismissals(autoDismissed, ratePercent);
  return {
    total: (autoDismissed || []).length,
    ratePercent: Number(ratePercent),
    sampled: sample.length,
    sample,
  };
}

// 52094 — FP confidence threshold setting: per-severity auto-dismiss
// thresholds; Criticals are never auto-dismissed.
export const FP_AUTO_DISMISS_THRESHOLDS = {
  critical: 1.01,
  high: 0.9,
  medium: 0.8,
  low: 0.7,
  info: 0.6,
};
export function canAutoDismiss(severity, fpProbability, thresholds = FP_AUTO_DISMISS_THRESHOLDS) {
  const sev = String(severity || 'medium').toLowerCase();
  if (sev === 'critical') return { allowed: false, reason: 'criticals are never auto-dismissed' };
  const t = (thresholds || {})[sev] != null ? Number(thresholds[sev]) : 0.8;
  const allowed = Number(fpProbability) >= t;
  return {
    allowed,
    threshold: t,
    probability: Number(fpProbability),
    reason: allowed ? 'probability above threshold' : 'probability below threshold',
  };
}

// 52095 — FP auto-expiry: time-boxed dismissals that resurface for re-review.
export function scheduleFpExpiry(marking, daysValid, now = Date.now()) {
  const m = marking || {};
  if (!m.findingId) return { ...m, ok: false, reason: 'marking has no findingId' };
  return {
    ...m,
    ok: true,
    expiresAt: Number(now) + Number(daysValid) * 86400e3,
    validityDays: Number(daysValid),
    resurfaceState: 'pending-re-review',
  };
}
export function fpExpiryStatus(marking, now = Date.now()) {
  const m = marking || {};
  if (m.expiresAt == null) return { expired: false, hasExpiry: false };
  return {
    hasExpiry: true,
    expired: Number(now) >= Number(m.expiresAt),
    expiresAt: Number(m.expiresAt),
  };
}

// 52096 — FP tags for sliced analytics.
export const FP_TAG_TAXONOMY = [
  'waf-blocked',
  'test-data',
  'third-party',
  'expected-behavior',
  'duplicate',
  'out-of-scope',
];
export function tagFpDismissal(marking, tags) {
  const m = marking || {};
  const valid = (tags || []).map(t => String(t)).filter(t => FP_TAG_TAXONOMY.includes(t));
  const invalid = (tags || []).map(t => String(t)).filter(t => !FP_TAG_TAXONOMY.includes(t));
  return {
    ...m,
    ok: true,
    tags: [...new Set([...(m.tags || []), ...valid])],
    rejected: [...new Set(invalid)],
  };
}

// 52097 — FP digest email payload: weekly summary for security leads.
export function buildFpDigestPayload(fpDecisions, weekStart, now = Date.now()) {
  const start = Number(weekStart != null ? weekStart : Number(now) - 7 * 86400e3);
  const end = start + 7 * 86400e3;
  const inWeek = (fpDecisions || []).filter(
    d => Number(d.markedAt || 0) >= start && Number(d.markedAt || 0) < end
  );
  const byReason = {};
  const byMarker = {};
  for (const d of inWeek) {
    const r = String(d.reasonId || 'unspecified');
    const mBy = String(d.markedBy || 'unknown');
    byReason[r] = (byReason[r] || 0) + 1;
    byMarker[mBy] = (byMarker[mBy] || 0) + 1;
  }
  return {
    subject: `Infinity AI · FP digest — ${inWeek.length} dismissals this week`,
    weekStart: start,
    weekEnd: end,
    total: inWeek.length,
    byReason,
    byMarker,
    rows: inWeek.map(d => ({
      findingId: d.findingId,
      title: d.title,
      reasonId: d.reasonId,
      markedBy: d.markedBy,
      markedAt: d.markedAt,
    })),
  };
}

// 52098 — FP reopen on target change: flag expired/related dismissals for
// re-validation when the target changes.
export function flagFpForRevalidation(fpRecords, targetChange) {
  const change = targetChange || {};
  const target = String(change.target || '');
  return (fpRecords || [])
    .filter(r => String(r.target || '') === target)
    .map(r => {
      const related =
        String(change.scope || '') === 'config'
          ? String(r.reasonId || '') === 'expected-behavior'
          : true;
      const expired = r.expiresAt != null && Number(change.at || Date.now()) >= Number(r.expiresAt);
      return {
        findingId: r.findingId,
        signature: r.signature,
        flagged: related || expired,
        reason: expired ? 'dismissal expired' : related ? 'target changed' : 'no change relevance',
      };
    });
}

// 52099 — FP inheritance to future hunts: confirmed FP patterns apply to the
// next hunt on the same target.
export function inheritFpPatterns(previousHuntFps, newHunt) {
  const hunt = newHunt || {};
  const target = String(hunt.target || '');
  const patterns = {};
  for (const fp of previousHuntFps || []) {
    if (String(fp.target || '') !== target || fp.status === 'overturned') continue;
    const sig = String(fp.signature || '');
    if (!patterns[sig])
      patterns[sig] = {
        signature: sig,
        reasonId: fp.reasonId,
        reasonLabel: fp.reasonLabel,
        inheritedFrom: fp.huntId,
        count: 0,
      };
    patterns[sig].count += 1;
  }
  return {
    huntId: hunt.huntId,
    target,
    inherited: Object.values(patterns),
    inheritedCount: Object.keys(patterns).length,
  };
}

// 52100 — FP heatmap by endpoint: which endpoints generate the most FPs.
export function fpHeatmapByEndpoint(fpRecords) {
  const counts = {};
  for (const r of fpRecords || []) {
    const ep = String(r.endpoint || 'unknown');
    counts[ep] = (counts[ep] || 0) + 1;
  }
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts)
    .map(([endpoint, count]) => ({
      endpoint,
      count,
      intensity: Math.round((count / max) * 100) / 100,
      bucket: count / max >= 0.75 ? 'hot' : count / max >= 0.4 ? 'warm' : 'cool',
    }))
    .sort((a, b) => b.count - a.count);
}
