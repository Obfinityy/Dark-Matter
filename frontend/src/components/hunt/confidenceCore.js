// confidenceCore.js — Infinity AI · wave 43 (ideas 51681–51700)
// Pure logic for the finding-confidence display & triage suite (mid-hunt).
// No DOM, no network, no side effects: every function is a pure transform over
// plain finding descriptors so it can run in the browser, in tests, or on a server.
//
// Finding shape (input convention):
//   {
//     id: 'F-0001', title: 'SQLi in /search', severity: 'critical'|'high'|'medium'|'low'|'info',
//     confidence: 0..100, techniques: ['sqlmap','manual-review'],          // distinct techniques that fired
//     evidence: [{ type: 'screenshot'|'response'|'replay'|'log'|'traffic', note: '...' }],
//     history: [{ score, at, trigger }],   // confidence audit trail, oldest first
//     disputed: false
//   }

export const WAVE43_CONF_START = 51681;
export const WAVE43_CONF_END = 51700;

export const WAVE43_CONF_IDEAS = [
  [
    51681,
    'Low-confidence flagging',
    'Findings below the analyst threshold are flagged for skepticism.',
  ],
  [51682, 'Confidence-based sorting', 'Sort the findings feed by confidence as well as severity.'],
  [
    51683,
    'Confidence filters (mid-hunt)',
    'Show only findings above a confidence the analyst sets.',
  ],
  [51684, 'Confidence history graph', 'How a finding’s confidence evolved over time.'],
  [51685, 'Agent uncertainty notes', 'The agent writes what it is unsure about in plain words.'],
  [
    51686,
    'Cross-validation badges',
    'Marked when multiple techniques independently confirm a finding.',
  ],
  [51687, 'Manual-verification prompts', 'The agent suggests human checks for shaky findings.'],
  [51688, 'Confidence vs severity matrix', 'A grid view plotting findings on both axes.'],
  [
    51689,
    'Confidence-weighted prioritization',
    'Triage order blends severity with confidence automatically.',
  ],
  [51690, 'Confidence decay', 'Scores fade if supporting evidence is later contradicted.'],
  [51691, 'Confidence boost events', 'Visible markers when new evidence raises a score.'],
  [51692, 'Peer-agreement indicator', 'How often similar findings proved true in past hunts.'],
  [
    51693,
    'Confidence calibration view',
    'Compare the agent’s past confidence scores against actual outcomes.',
  ],
  [
    51694,
    'Threshold alerts (mid-hunt)',
    'Notified when a finding crosses your confidence threshold.',
  ],
  [51695, 'Confidence in notifications', 'Alerts include the score so you can judge urgency.'],
  [51696, 'Confidence in snapshots', 'Draft reports show scores so readers know what’s solid.'],
  [51697, 'Confidence color coding', 'Consistent colors from red (shaky) to green (certain).'],
  [51698, 'Confidence tooltips', 'Hover any score for a one-line plain explanation.'],
  [51699, 'Confidence audit log', 'Every score change recorded with its trigger.'],
  [51700, 'Confidence-based auto-triage', 'High-confidence findings auto-escalate per your rules.'],
];

const SEV_WEIGHT = { critical: 1.0, high: 0.8, medium: 0.55, low: 0.35, info: 0.2 };
const SEV_ROWS = ['critical', 'high', 'medium', 'low', 'info'];

export function clampScore(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// 51681 — flag findings at/below the analyst's skepticism threshold
export function flagLowConfidence(findings, threshold = 60) {
  const t = clampScore(threshold);
  return findings.map(f => ({
    ...f,
    belowThreshold: clampScore(f.confidence) <= t,
    flag: clampScore(f.confidence) <= t ? 'low-confidence' : 'none',
  }));
}

// 51682 — sort by confidence (optionally severity as tiebreak)
export function sortByConfidence(findings, { dir = 'desc', tiebreakSeverity = true } = {}) {
  const arr = [...findings];
  const m = dir === 'asc' ? 1 : -1;
  arr.sort((a, b) => {
    const d = (clampScore(a.confidence) - clampScore(b.confidence)) * m;
    if (d !== 0 || !tiebreakSeverity) return d;
    return (SEV_WEIGHT[b.severity] ?? 0) - (SEV_WEIGHT[a.severity] ?? 0);
  });
  return arr;
}

// 51683 — keep only findings at/above a confidence floor
export function filterByConfidence(findings, min) {
  const m = clampScore(min);
  return findings.filter(f => clampScore(f.confidence) >= m);
}

// 51684 — normalized history series (oldest → latest), always ends at current score
export function confidenceHistory(finding) {
  const trail = Array.isArray(finding.history) ? finding.history : [];
  const pts = trail.map(h => ({ at: h.at, score: clampScore(h.score), trigger: h.trigger || '' }));
  const current = clampScore(finding.confidence);
  if (pts.length === 0 || pts[pts.length - 1].score !== current) {
    pts.push({ at: 'now', score: current, trigger: 'current' });
  }
  return pts;
}

// 51685 — plain-words uncertainty note from the finding's shape
export function uncertaintyNote(finding) {
  const reasons = [];
  const techs = new Set(finding.techniques || []).size;
  const evCount = (finding.evidence || []).length;
  if (clampScore(finding.confidence) < 60)
    reasons.push(`score is ${clampScore(finding.confidence)}, below the 60 review line`);
  if (techs <= 1) reasons.push(`confirmed by only ${techs} technique`);
  if (evCount === 0) reasons.push('no evidence captured yet');
  if (evCount === 1) reasons.push('backed by a single piece of evidence');
  if (finding.disputed) reasons.push('an analyst disputed the current score');
  if (reasons.length === 0)
    return 'Nothing flagged: multiple techniques and evidence support this score.';
  return `Unsure because: ${reasons.join('; ')}.`;
}

// 51686 — badge when ≥2 distinct techniques independently confirm
export function crossValidationBadge(finding) {
  const techs = [...new Set(finding.techniques || [])];
  return {
    crossValidated: techs.length >= 2,
    techniques: techs,
    label: techs.length >= 2 ? `Cross-validated · ${techs.length} techniques` : 'Single-source',
  };
}

// 51687 — suggest concrete human checks for shaky findings
export function manualVerificationPrompt(finding) {
  const checks = [];
  const types = new Set((finding.evidence || []).map(e => e.type));
  if (clampScore(finding.confidence) >= 80) return { needed: false, checks: [] };
  if (!types.has('replay'))
    checks.push('Replay the request manually and confirm the anomalous behavior repeats.');
  if (!types.has('response'))
    checks.push('Capture the raw response and check the indicator is not an error page artifact.');
  if ((finding.techniques || []).length <= 1)
    checks.push('Confirm with a second technique or tool before escalating.');
  if (!types.has('screenshot'))
    checks.push('Take a screenshot so the report shows the finding, not just text.');
  checks.push('Sanity-check scope: confirm the target asset is in the agreed hunt scope.');
  return { needed: true, checks };
}

// 51688 — grid position on the severity × confidence matrix
export function matrixPosition(finding) {
  const row = SEV_ROWS.indexOf(finding.severity);
  const c = clampScore(finding.confidence);
  const col = c >= 80 ? 0 : c >= 60 ? 1 : c >= 40 ? 2 : 3; // certain → shaky
  return {
    row: row === -1 ? 4 : row,
    col,
    rowLabel: SEV_ROWS[row === -1 ? 4 : row],
    colLabel: ['Certain (80+)', 'Likely (60–79)', 'Unproven (40–59)', 'Shaky (<40)'][col],
  };
}

// 51689 — single triage number blending severity and confidence
export function prioritizationScore(finding) {
  const sev = SEV_WEIGHT[finding.severity] ?? 0;
  return Math.round(sev * 70 + (clampScore(finding.confidence) / 100) * 30);
}

// 51690 — fade a score when supporting evidence is contradicted
export function applyDecay(finding, { contradictedEvidence = 0, reason = '' } = {}) {
  const loss = Math.min(50, contradictedEvidence * 12);
  const next = clampScore(finding.confidence - loss);
  return {
    ...finding,
    confidence: next,
    history: [
      ...(finding.history || []),
      { at: 'now', score: next, trigger: `decay −${loss}: ${reason || 'evidence contradicted'}` },
    ],
  };
}

// 51691 — markers where new evidence raised the score
export function boostEvents(finding) {
  const pts = confidenceHistory(finding);
  const events = [];
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i].score > pts[i - 1].score) {
      events.push({
        at: pts[i].at,
        from: pts[i - 1].score,
        to: pts[i].score,
        trigger: pts[i].trigger,
      });
    }
  }
  return events;
}

// 51692 — peer agreement: share of similar past findings that proved true
export function peerAgreement(finding, peerStats) {
  // peerStats: { [techniqueOrClass]: { truePositives, total } }
  const key = (finding.techniques || [])[0] || finding.severity || 'all';
  const s = (peerStats && peerStats[key]) || { truePositives: 0, total: 0 };
  if (!s.total) return { rate: null, label: 'No peer data yet' };
  const rate = Math.round((s.truePositives / s.total) * 100);
  return {
    rate,
    label: `${rate}% of similar findings proved true (${s.truePositives}/${s.total})`,
  };
}

// 51693 — calibration: predicted-confidence buckets vs actual outcomes
export function calibrationView(records) {
  // records: [{ predicted: 0..100, outcome: true|false }]
  const buckets = [
    { label: '0–39', lo: 0, hi: 39, n: 0, hits: 0 },
    { label: '40–59', lo: 40, hi: 59, n: 0, hits: 0 },
    { label: '60–79', lo: 60, hi: 79, n: 0, hits: 0 },
    { label: '80–100', lo: 80, hi: 100, n: 0, hits: 0 },
  ];
  for (const r of records) {
    const b = buckets.find(x => r.predicted >= x.lo && r.predicted <= x.hi);
    if (!b) continue;
    b.n += 1;
    if (r.outcome) b.hits += 1;
  }
  return buckets.map(b => ({
    ...b,
    actualRate: b.n ? Math.round((b.hits / b.n) * 100) : null,
    expectedRate: Math.round((b.lo + b.hi) / 2),
  }));
}

// 51694 — did the finding just cross the analyst's threshold?
export function thresholdAlert(finding, threshold) {
  const t = clampScore(threshold);
  const trail = Array.isArray(finding.history) ? finding.history : [];
  const prev = trail.length
    ? clampScore(trail[trail.length - 1].score)
    : clampScore(finding.confidence);
  const now = clampScore(finding.confidence);
  const crossedUp = prev < t && now >= t;
  const crossedDown = prev >= t && now < t;
  return {
    crossed: crossedUp || crossedDown,
    direction: crossedUp ? 'up' : crossedDown ? 'down' : 'none',
    threshold: t,
  };
}

// 51695 — notification payload always carries the score
export function notificationPayload(finding, channel = 'in-app') {
  return {
    channel,
    findingId: finding.id,
    title: finding.title,
    severity: finding.severity,
    confidence: clampScore(finding.confidence),
    color: confidenceColor(finding.confidence),
    text: `[${finding.severity}] ${finding.title} — confidence ${clampScore(finding.confidence)}/100`,
  };
}

// 51696 — a snapshot/report section listing scores with plain meaning
export function snapshotConfidenceSection(findings) {
  return {
    heading: 'Finding confidence',
    rows: sortByConfidence(findings).map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      confidence: clampScore(f.confidence),
      meaning: confidenceTooltip(f.confidence),
    })),
    solid: findings.filter(f => clampScore(f.confidence) >= 80).length,
    needsWork: findings.filter(f => clampScore(f.confidence) < 60).length,
  };
}

// 51697 — deterministic red (shaky) → amber → green (certain) ramp
export function confidenceColor(score) {
  const s = clampScore(score);
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#a3e635';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

// 51698 — one-line plain explanation for any score
export function confidenceTooltip(score) {
  const s = clampScore(score);
  if (s >= 90) return `${s}/100 — confirmed by strong evidence, safe to act on.`;
  if (s >= 80) return `${s}/100 — solid; minor corroboration would still help.`;
  if (s >= 60) return `${s}/100 — likely real, but verify before escalating.`;
  if (s >= 40) return `${s}/100 — unproven; treat as a lead, not a finding.`;
  return `${s}/100 — shaky; needs more evidence before anyone acts.`;
}

// 51699 — immutable audit-log append for every score change
export function appendAuditLog(finding, { from, to, trigger }) {
  return {
    ...finding,
    confidence: clampScore(to),
    history: [
      ...(finding.history || []),
      {
        at: new Date().toISOString(),
        score: clampScore(to),
        trigger: `${clampScore(from)} → ${clampScore(to)}: ${trigger}`,
      },
    ],
  };
}

// 51700 — rule-driven auto-triage on confidence bands
export function autoTriage(finding, rules = {}) {
  const { escalateAt = 80, watchAt = 60, escalateSeverities = ['critical', 'high'] } = rules;
  const s = clampScore(finding.confidence);
  if (s >= escalateAt && escalateSeverities.includes(finding.severity)) {
    return {
      action: 'escalate',
      reason: `confidence ${s} ≥ ${escalateAt} and severity ${finding.severity}`,
    };
  }
  if (s >= watchAt)
    return { action: 'watch', reason: `confidence ${s} ≥ ${watchAt}, needs human review` };
  return {
    action: 'hold',
    reason: `confidence ${s} below ${watchAt} — stays in the needs-work tray`,
  };
}
