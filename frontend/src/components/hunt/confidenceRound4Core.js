// confidenceRound4Core.js — Infinity AI · wave 44 (ideas 51721–51730)
// Pure logic for the confidence governance round-4 suite: override audit trails,
// retrospectives, retesting, digests, legends, duplicates, presentations,
// approval gates, SIEM export, and the confidence maturity model.
// No DOM, no network, no side effects: pure transforms over plain descriptors.
//
// Finding shape (input convention, extends wave-43 confidenceCore):
//   {
//     id: 'F-0201', title: 'SSRF in /fetch', severity: 'critical'|'high'|'medium'|'low'|'info',
//     confidence: 0..100, techniques: ['scanner','manual-review'],
//     overrideLog: [{ at, by, from, to, note }]
//   }

export const CONF44_START = 51721;
export const CONF44_END = 51730;

export const CONF44_IDEAS = [
  [51721, 'Override audit trail', 'Manual overrides logged with who and why.'],
  [51722, 'Confidence in retrospectives', 'Post-hunt review of scoring accuracy.'],
  [51723, 'Confidence-driven retesting', 'Borderline findings retested before the hunt ends.'],
  [51724, 'Confidence notifications digest', 'Score changes batched instead of spammed.'],
  [51725, 'Confidence legend', 'A persistent guide explaining what each score band means.'],
  [51726, 'Confidence for duplicates', 'Merged findings show combined confidence transparently.'],
  [51727, 'Confidence in presentations', 'Presentation mode includes scores tastefully.'],
  [
    51728,
    'Confidence-based approvals',
    'Low-confidence destructive validations need extra approval.',
  ],
  [51729, 'Confidence export to SIEM', 'Scores flow into your security tooling.'],
  [51730, 'Confidence maturity model', 'Track how scoring accuracy improves across hunts.'],
];

function clamp(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// 51721 — immutable override-log append: who set the manual score and why
export function appendOverrideLog(finding, { from, to, by = 'analyst', note, at = 'now' } = {}) {
  if (!note || !String(note).trim()) {
    throw new Error('51721: a confidence override requires a reason note');
  }
  const entry = { at, by, from: clamp(from), to: clamp(to), note: String(note) };
  return {
    ...finding,
    confidence: clamp(to),
    overridden: true,
    overrideLog: [...(finding.overrideLog || []), entry],
  };
}

// 51722 — post-hunt review: average predicted confidence vs actual hit rate per hunt
// records: [{ huntId, avgPredicted: 0..100, actualHitRate: 0..100 }]
export function retrospectiveAccuracy(records) {
  const hunts = records.map(r => {
    const predicted = clamp(r.avgPredicted);
    const actual = clamp(r.actualHitRate);
    const delta = predicted - actual;
    return { huntId: r.huntId, predicted, actual, delta, accuracy: 100 - Math.abs(delta) };
  });
  const avgDelta = hunts.length
    ? Math.round(hunts.reduce((s, h) => s + h.delta, 0) / hunts.length)
    : null;
  const avgAccuracy = hunts.length
    ? Math.round(hunts.reduce((s, h) => s + h.accuracy, 0) / hunts.length)
    : null;
  const trend = hunts.length >= 2 ? hunts[hunts.length - 1].accuracy - hunts[0].accuracy : null;
  const bias =
    avgDelta == null
      ? 'unknown'
      : avgDelta > 5
        ? 'overconfident'
        : avgDelta < -5
          ? 'underconfident'
          : 'balanced';
  return { hunts, avgDelta, avgAccuracy, trend, bias };
}

// 51723 — borderline findings (floor ≤ score < ceiling) queued for retest, shakiest first
export function retestQueue(findings, { floor = 50, ceiling = 75 } = {}) {
  return findings
    .filter(f => {
      const c = clamp(f.confidence);
      return c >= floor && c < ceiling;
    })
    .sort((a, b) => clamp(a.confidence) - clamp(b.confidence))
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      confidence: clamp(f.confidence),
      urgency: clamp(f.confidence) <= floor + 5 ? 'high' : 'normal',
    }));
}

// 51724 — batch many small score changes into one digest line instead of spamming
// changes: [{ findingId, title, from, to, at }]
export function confidenceDigest(changes, { minDelta = 5 } = {}) {
  const notable = changes.filter(c => Math.abs(clamp(c.to) - clamp(c.from)) >= minDelta);
  const raised = notable.filter(c => clamp(c.to) > clamp(c.from));
  const lowered = notable.filter(c => clamp(c.to) < clamp(c.from));
  const topMovers = [...notable]
    .sort((a, b) => Math.abs(clamp(b.to) - clamp(b.from)) - Math.abs(clamp(a.to) - clamp(a.from)))
    .slice(0, 5)
    .map(c => ({
      findingId: c.findingId,
      title: c.title,
      from: clamp(c.from),
      to: clamp(c.to),
      delta: clamp(c.to) - clamp(c.from),
    }));
  return {
    total: changes.length,
    notable: notable.length,
    raised: raised.length,
    lowered: lowered.length,
    topMovers,
    summary: `${notable.length} notable score change${notable.length === 1 ? '' : 's'} (${raised.length} up, ${lowered.length} down) out of ${changes.length} tracked.`,
  };
}

// 51725 — persistent band guide: what each score range means
export function scoreLegend() {
  return [
    {
      label: 'Confirmed',
      lo: 90,
      hi: 100,
      color: '#22c55e',
      meaning: 'Strong evidence; safe to act on immediately.',
    },
    {
      label: 'Solid',
      lo: 80,
      hi: 89,
      color: '#4ade80',
      meaning: 'Reliable; minor corroboration still welcome.',
    },
    {
      label: 'Likely',
      lo: 60,
      hi: 79,
      color: '#a3e635',
      meaning: 'Probably real; verify before escalating.',
    },
    {
      label: 'Unproven',
      lo: 40,
      hi: 59,
      color: '#f59e0b',
      meaning: 'A lead, not a finding; more evidence needed.',
    },
    {
      label: 'Shaky',
      lo: 0,
      hi: 39,
      color: '#ef4444',
      meaning: 'Weak basis; do not act without further proof.',
    },
  ];
}

// 51726 — merged duplicates show combined confidence transparently
// Combines assuming independent evidence: 1 − ∏(1 − confidence), with the parts listed
export function mergedFindingConfidence(primary, duplicates) {
  const parts = [primary, ...(duplicates || [])].map(f => ({
    id: f.id,
    title: f.title,
    confidence: clamp(f.confidence),
  }));
  const combined = Math.round((1 - parts.reduce((p, x) => p * (1 - x.confidence / 100), 1)) * 100);
  return {
    parts,
    combined,
    note: `Combined from ${parts.length} merged finding${parts.length === 1 ? '' : 's'} assuming independent evidence: 1 − ∏(1 − confidence).`,
  };
}

// 51727 — presentation-ready rows: scores included tastefully as band labels
export function presentationScores(findings) {
  const bands = scoreLegend();
  return [...findings]
    .sort((a, b) => clamp(b.confidence) - clamp(a.confidence))
    .map(f => {
      const c = clamp(f.confidence);
      const band = bands.find(x => c >= x.lo && c <= x.hi);
      return {
        id: f.id,
        title: f.title,
        severity: f.severity,
        band: band.label,
        color: band.color,
        display: `${c} — ${band.label}`,
      };
    });
}

// 51728 — destructive validations at low confidence need a second approver
// validation: { kind: 'exploit'|'destructive-test'|'account-action'|..., target }
export function approvalGate(
  validation,
  finding,
  { destructiveKinds = ['exploit', 'destructive-test', 'account-action'], gateAt = 70 } = {}
) {
  const c = clamp(finding.confidence);
  const destructive = destructiveKinds.includes(validation.kind);
  if (destructive && c < gateAt) {
    return {
      approved: false,
      requires: 'second-approver',
      reason: `${validation.kind} at confidence ${c} (< ${gateAt}) needs a second approver.`,
    };
  }
  return {
    approved: true,
    requires: null,
    reason: destructive
      ? `${validation.kind} at confidence ${c} clears the ${gateAt} gate.`
      : `${validation.kind} is not destructive — no gate applies.`,
  };
}

// 51729 — SIEM-friendly payload: scores as first-class event fields
export function siemExportPayload(
  findings,
  { vendor = 'InfinityAI', source = 'dark-matter' } = {}
) {
  return {
    vendor,
    source,
    exported: 'finding-confidence',
    events: findings.map(f => ({
      event_type: 'finding-confidence',
      finding_id: f.id,
      title: f.title,
      severity: f.severity,
      confidence: clamp(f.confidence),
      cross_validated: new Set(f.techniques || []).size >= 2,
    })),
  };
}

// 51730 — maturity model: scoring accuracy tracked across hunts, level 1–5
// hunts: [{ huntId, accuracy: 0..100 }]
export function maturityScore(hunts) {
  const avgAccuracy = hunts.length
    ? Math.round(hunts.reduce((s, h) => s + clamp(h.accuracy), 0) / hunts.length)
    : null;
  const level =
    avgAccuracy == null
      ? 0
      : avgAccuracy >= 90
        ? 5
        : avgAccuracy >= 80
          ? 4
          : avgAccuracy >= 70
            ? 3
            : avgAccuracy >= 55
              ? 2
              : 1;
  const labels = ['Not measured', 'Ad-hoc', 'Developing', 'Defined', 'Managed', 'Optimized'];
  const trend =
    hunts.length >= 2 ? clamp(hunts[hunts.length - 1].accuracy) - clamp(hunts[0].accuracy) : null;
  return { level, label: labels[level], avgAccuracy, hunts: hunts.length, trend };
}
