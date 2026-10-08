/**
 * fpImpactCore.js — Infinity AI · Dark-Matter · Wave 54
 * Pure logic (no React, no DOM, no network) backing the false-positive
 * impact tooling: idea-bank ideas 52121–52122. Every exported function is
 * pure and deterministic; time is injected via `now` parameters.
 */

export const WAVE54_FP_IDEAS = [
  { id: 52121, title: 'FP rules impact simulator' },
  { id: 52122, title: 'FP decision export with evidence' },
];

// 52121 — FP rules impact simulator: preview how a proposed FP rule would
// affect open findings before it goes live. A rule matcher is a small
// criteria object; a finding matches when every listed criterion matches.
export function matchesFpRule(finding, matcher) {
  if (!finding || !matcher) return false;
  return Object.keys(matcher).every(key => {
    const want = matcher[key];
    const got = finding[key];
    if (Array.isArray(want)) return want.includes(got);
    if (want instanceof RegExp) return want.test(String(got || ''));
    return got === want;
  });
}

export function simulateFpRuleImpact(rule, openFindings, now = Date.now()) {
  const findings = Array.isArray(openFindings) ? openFindings : [];
  const affected = findings.filter(f => matchesFpRule(f, rule.matcher));
  const bySeverity = affected.reduce((acc, f) => {
    acc[f.severity || 'unknown'] = (acc[f.severity || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const byClass = affected.reduce((acc, f) => {
    acc[f.vulnClass || 'unknown'] = (acc[f.vulnClass || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    simulatedAt: now,
    openCount: findings.length,
    affectedCount: affected.length,
    affectedPct:
      findings.length === 0 ? 0 : Math.round((affected.length / findings.length) * 1000) / 10,
    bySeverity,
    byClass,
    affectedFindings: affected.map(f => ({
      findingId: f.id,
      title: f.title,
      severity: f.severity,
      vulnClass: f.vulnClass,
      target: f.target,
    })),
    warning:
      affected.length > 0 && affected.some(f => f.severity === 'critical')
        ? 'rule would dismiss critical findings — review required'
        : null,
  };
}

// 52122 — FP decision export with evidence: export dismissed FPs bundled
// with their justification evidence for external review.
export function bundleFpDecision(marking, now = Date.now()) {
  if (!marking || !marking.findingId) {
    return { ok: false, reason: 'marking must reference a finding' };
  }
  const evidence = Array.isArray(marking.evidence) ? marking.evidence : [];
  if (evidence.length === 0) {
    return { ok: false, reason: 'export requires at least one evidence item' };
  }
  return {
    ok: true,
    bundle: {
      schema: 'infinity-ai-fp-decision/v1',
      exportedAt: now,
      decision: {
        findingId: marking.findingId,
        title: marking.title || null,
        markedBy: marking.markedBy || null,
        markedAt: marking.markedAt || null,
        reasonId: marking.reasonId || null,
        justification: marking.justification || null,
      },
      evidence: evidence.map((e, i) => ({
        index: i,
        kind: e.kind || 'snippet',
        label: e.label || `evidence-${i + 1}`,
        body: e.body || null,
        capturedAt: e.capturedAt || null,
      })),
      evidenceCount: evidence.length,
    },
  };
}

export function exportFpBundle(markings, now = Date.now()) {
  const list = Array.isArray(markings) ? markings : [];
  const bundles = list.map(m => bundleFpDecision(m, now));
  const ready = bundles.filter(b => b.ok).map(b => b.bundle);
  const rejected = bundles.filter(b => !b.ok).length;
  return {
    exportedAt: now,
    total: list.length,
    exported: ready.length,
    rejected,
    bundles: ready,
    summary:
      ready.length === 0
        ? 'no exportable FP decisions'
        : `${ready.length} of ${list.length} FP decisions exported with evidence`,
  };
}
