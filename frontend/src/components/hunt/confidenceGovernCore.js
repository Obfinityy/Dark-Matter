// confidenceGovernCore.js — Infinity AI · wave 43 (ideas 51701–51720)
// Pure logic for the confidence governance & depth suite: disputes, benchmarks,
// export/API, agreement, floors, badges, evidence requests, sharing controls,
// trend alerts, reporting order, explanations, calibration training, mobile,
// snapshot diffs, SLAs, grouping, and analyst overrides.
// Companionship: pairs with confidenceCore.js (display & triage, 51681–51700).

import {
  clampScore,
  confidenceColor,
  confidenceTooltip,
  sortByConfidence,
  confidenceHistory,
} from './confidenceCore.js';

export const WAVE43_GOV_START = 51701;
export const WAVE43_GOV_END = 51720;

export const WAVE43_GOV_IDEAS = [
  [51701, 'Confidence dispute', 'Challenge a score and the agent re-evaluates with your input.'],
  [
    51702,
    'Confidence benchmarks',
    'Compare a finding’s score against typical scores for its class.',
  ],
  [51703, 'Confidence export', 'Scores included in every finding export format.'],
  [51704, 'Confidence API', 'Programmatic access to live confidence data.'],
  [
    51705,
    'Confidence in chat answers',
    'The agent states its confidence when discussing findings.',
  ],
  [
    51706,
    'Multi-model agreement',
    'When brains disagree, both confidence scores shown side by side.',
  ],
  [51707, 'Confidence floor setting', 'Findings below the floor stay in a “needs work” tray.'],
  [
    51708,
    'Confidence milestone badges',
    '“Validated” and “confirmed” badges earned as scores rise.',
  ],
  [
    51709,
    'Confidence-driven evidence requests',
    'Low scores trigger the agent to gather more proof automatically.',
  ],
  [
    51710,
    'Confidence by evidence type',
    'See which evidence kinds (screenshot, response, replay) back the score.',
  ],
  [
    51711,
    'Confidence sharing controls',
    'Choose whether clients see raw scores or simplified labels.',
  ],
  [51712, 'Confidence trend alerts', 'Warned when a finding’s confidence drops sharply.'],
  [
    51713,
    'Confidence-weighted reporting',
    'Report sections ordered by a blend of severity and confidence.',
  ],
  [51714, 'Confidence explanations', '“Why is this only 62?” answered with specifics.'],
  [
    51715,
    'Confidence calibration training',
    'The agent improves scoring from your triage feedback.',
  ],
  [51716, 'Confidence in mobile view', 'Scores and trends fully visible on phones.'],
  [51717, 'Confidence snapshot diffs', 'See which scores changed between report snapshots.'],
  [51718, 'Confidence-based SLAs', 'Triage deadlines scale with confidence level.'],
  [51719, 'Confidence grouping', 'Findings clustered into certain, likely, and unproven buckets.'],
  [51720, 'Confidence override', 'Analysts can set a manual score with a required note.'],
];

// 51701 — analyst disputes a score; the agent re-evaluates as a weighted blend
export function disputeScore(finding, { analystScore, analystNote }) {
  if (!analystNote || !String(analystNote).trim()) {
    throw new Error('dispute requires an analyst note explaining the disagreement');
  }
  const current = clampScore(finding.confidence);
  const analyst = clampScore(analystScore);
  // Re-evaluation: agent keeps 60% of its score, analyst input carries 40%.
  const next = clampScore(Math.round(current * 0.6 + analyst * 0.4));
  return {
    ...finding,
    confidence: next,
    disputed: true,
    history: [
      ...(finding.history || []),
      {
        at: 'now',
        score: next,
        trigger: `dispute: analyst said ${analyst} (${String(analystNote).trim()}) → re-evaluated ${current} → ${next}`,
      },
    ],
  };
}

// 51702 — benchmark a score against typical scores for its class
export function confidenceBenchmarks(finding, classStats) {
  // classStats: { [findingClass]: { p25, median, p75, n } }
  const cls = finding.findingClass || finding.techniques?.[0] || 'general';
  const s = classStats?.[cls];
  const score = clampScore(finding.confidence);
  if (!s) return { class: cls, percentile: null, note: 'No benchmark data for this class yet.' };
  const pct =
    score <= s.p25
      ? 'bottom quartile'
      : score <= s.median
        ? 'below median'
        : score <= s.p75
          ? 'above median'
          : 'top quartile';
  return {
    class: cls,
    percentile: pct,
    median: s.median,
    n: s.n,
    note: `${score} is ${pct} for ${cls} (median ${s.median}, n=${s.n}).`,
  };
}

// 51703 — export findings with scores embedded, in real formats
export function exportWithConfidence(findings, format = 'json') {
  const rows = sortByConfidence(findings).map(f => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    confidence: clampScore(f.confidence),
    techniques: [...new Set(f.techniques || [])],
    evidenceTypes: [...new Set((f.evidence || []).map(e => e.type))],
  }));
  if (format === 'json')
    return JSON.stringify({ exportedAt: new Date().toISOString(), findings: rows }, null, 2);
  if (format === 'csv') {
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ['id,title,severity,confidence,techniques,evidence_types'];
    for (const r of rows)
      lines.push(
        [
          r.id,
          esc(r.title),
          r.severity,
          r.confidence,
          esc(r.techniques.join('|')),
          esc(r.evidenceTypes.join('|')),
        ].join(',')
      );
    return lines.join('\n');
  }
  if (format === 'markdown') {
    const head = '| ID | Title | Severity | Confidence |\n|---|---|---|---|\n';
    return `# Finding confidence export\n\n${head}${rows.map(r => `| ${r.id} | ${r.title} | ${r.severity} | ${r.confidence} |`).join('\n')}\n`;
  }
  throw new Error(`unsupported export format: ${format}`);
}

// 51704 — programmatic access: route descriptors + whitelisted public DTO
export const CONFIDENCE_API_ROUTES = [
  {
    method: 'GET',
    path: '/api/v1/confidence/:findingId',
    desc: 'Live confidence score + history for one finding',
  },
  {
    method: 'GET',
    path: '/api/v1/confidence',
    desc: 'List scores with severity/confidence filters (?min=, ?severity=)',
  },
  {
    method: 'POST',
    path: '/api/v1/confidence/:findingId/dispute',
    desc: 'File a score dispute (analyst note required)',
  },
  {
    method: 'POST',
    path: '/api/v1/confidence/:findingId/override',
    desc: 'Analyst override (score + required note)',
  },
  {
    method: 'GET',
    path: '/api/v1/confidence/calibration',
    desc: 'Predicted-vs-actual calibration buckets',
  },
];

export function confidencePublicDTO(finding) {
  // Whitelist: internals (raw prompts, brain weights) never leave the server.
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    confidence: clampScore(finding.confidence),
    color: confidenceColor(finding.confidence),
    techniques: [...new Set(finding.techniques || [])],
    crossValidated: new Set(finding.techniques || []).size >= 2,
    updatedAt: finding.history?.length ? finding.history[finding.history.length - 1].at : null,
  };
}

// 51705 — chat answers carry the score inline
export function chatAnswerWithConfidence(answer, score) {
  const s = clampScore(score);
  return {
    text: answer,
    confidence: s,
    spoken: `${answer} (I’m ${s}% confident in this.)`,
    badge: confidenceTooltip(s),
  };
}

// 51706 — two brains, two scores, shown side by side with the gap
export function multiModelAgreement(a, b) {
  const sa = clampScore(a.confidence);
  const sb = clampScore(b.confidence);
  const gap = Math.abs(sa - sb);
  return {
    left: { model: a.model || 'brain-a', score: sa },
    right: { model: b.model || 'brain-b', score: sb },
    gap,
    agreement: gap <= 10 ? 'agree' : gap <= 25 ? 'partial' : 'disagree',
    note:
      gap <= 10
        ? 'Both brains agree — score is trustworthy.'
        : `Brains differ by ${gap} points — treat ${Math.min(sa, sb)} as the conservative read.`,
  };
}

// 51707 — floor setting: everything below stays in the needs-work tray
export function needsWorkTray(findings, floor = 60) {
  const f = clampScore(floor);
  return {
    floor: f,
    ready: findings.filter(x => clampScore(x.confidence) >= f),
    needsWork: findings.filter(x => clampScore(x.confidence) < f),
  };
}

// 51708 — milestone badges earned as scores rise
export function milestoneBadges(finding) {
  const s = clampScore(finding.confidence);
  const badges = [];
  if (s >= 60) badges.push({ id: 'likely', label: 'Likely', earnedAt: 'score ≥ 60' });
  if (s >= 80) badges.push({ id: 'validated', label: 'Validated', earnedAt: 'score ≥ 80' });
  if (s >= 95) badges.push({ id: 'confirmed', label: 'Confirmed', earnedAt: 'score ≥ 95' });
  return {
    badges,
    next:
      s >= 95
        ? null
        : {
            label: s >= 80 ? 'Confirmed' : s >= 60 ? 'Validated' : 'Likely',
            needs: (s >= 80 ? 95 : s >= 60 ? 80 : 60) - s,
          },
  };
}

// 51709 — low scores auto-generate evidence requests
export function evidenceRequests(finding) {
  const s = clampScore(finding.confidence);
  const types = new Set((finding.evidence || []).map(e => e.type));
  if (s >= 75) return { needed: false, requests: [] };
  const requests = [];
  if (!types.has('replay'))
    requests.push({
      kind: 'replay',
      detail: 'Re-run the exploit steps and capture each response.',
    });
  if (!types.has('screenshot'))
    requests.push({ kind: 'screenshot', detail: 'Capture the vulnerable state visually.' });
  if (!types.has('response'))
    requests.push({
      kind: 'response',
      detail: 'Save the raw HTTP response proving the indicator.',
    });
  if (new Set(finding.techniques || []).size < 2)
    requests.push({
      kind: 'second-technique',
      detail: 'Confirm with an independent technique or tool.',
    });
  return { needed: requests.length > 0, requests };
}

// 51710 — which evidence kinds back the score
export function evidenceTypeBreakdown(finding) {
  const counts = {};
  for (const e of finding.evidence || []) counts[e.type] = (counts[e.type] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .map(([type, n]) => ({ type, count: n, share: total ? Math.round((n / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

// 51711 — client-facing sharing: raw numbers or simplified labels
export function sharingControl(score, mode = 'labels') {
  const s = clampScore(score);
  if (mode === 'raw') return { mode, shown: `${s}/100` };
  const label = s >= 80 ? 'Confirmed' : s >= 60 ? 'Likely' : s >= 40 ? 'Unproven' : 'Preliminary';
  return { mode, shown: label, note: 'Raw score withheld from client view.' };
}

// 51712 — warn on sharp confidence drops
export function trendAlerts(finding, { dropPoints = 15 } = {}) {
  const pts = confidenceHistory(finding);
  const alerts = [];
  for (let i = 1; i < pts.length; i += 1) {
    const d = pts[i - 1].score - pts[i].score;
    if (d >= dropPoints) {
      alerts.push({
        at: pts[i].at,
        drop: d,
        from: pts[i - 1].score,
        to: pts[i].score,
        trigger: pts[i].trigger,
        message: `Confidence fell ${d} points — re-check this finding.`,
      });
    }
  }
  return alerts;
}

// 51713 — report sections ordered by severity×confidence blend
export function weightedReportingOrder(findings) {
  const w = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return [...findings]
    .map(f => ({ ...f, reportWeight: (w[f.severity] ?? 0) * 25 + clampScore(f.confidence) * 0.75 }))
    .sort((a, b) => b.reportWeight - a.reportWeight);
}

// 51714 — "why is this only 62?" — specifics, not vibes
export function explainConfidence(finding) {
  const s = clampScore(finding.confidence);
  const techs = [...new Set(finding.techniques || [])];
  const ev = finding.evidence || [];
  const points = [];
  points.push(`Score is ${s}/100.`);
  points.push(
    techs.length >= 2
      ? `Raised by ${techs.length} independent techniques (${techs.join(', ')}).`
      : `Limited by a single technique (${techs[0] || 'none recorded'}).`
  );
  points.push(
    ev.length === 0
      ? 'No evidence captured yet — the biggest drag on the score.'
      : `${ev.length} evidence item${ev.length > 1 ? 's' : ''}: ${[...new Set(ev.map(e => e.type))].join(', ')}.`
  );
  const drops = (finding.history || []).filter((h, i, a) => i > 0 && h.score < a[i - 1].score);
  if (drops.length) points.push(`Score fell before (${drops.map(d => d.trigger).join('; ')}).`);
  if (finding.disputed) points.push('An analyst disputed the score, which tempered it.');
  points.push(
    s >= 80
      ? 'To push higher: add a replay or a second technique.'
      : 'To push higher: capture the missing evidence kinds above.'
  );
  return { score: s, points, summary: points.join(' ') };
}

// 51715 — the agent learns scoring weights from triage feedback
export function calibrationTraining(feedback) {
  // feedback: [{ finding, analystSaidTrue: boolean }]
  const adj = { techniqueBonus: 0, evidenceBonus: 0, decayPenalty: 0, notes: [] };
  let over = 0;
  let under = 0;
  for (const f of feedback) {
    const s = clampScore(f.finding.confidence);
    if (s >= 70 && !f.analystSaidTrue) over += 1; // agent overconfident
    if (s < 60 && f.analystSaidTrue) under += 1; // agent underconfident
  }
  if (over > under) {
    adj.decayPenalty = over - under;
    adj.notes.push(
      `Agent was overconfident on ${over} findings — increasing decay penalty by ${adj.decayPenalty}.`
    );
  } else if (under > over) {
    adj.evidenceBonus = under - over;
    adj.notes.push(
      `Agent undervalued ${under} true findings — raising the evidence bonus by ${adj.evidenceBonus}.`
    );
  } else {
    adj.notes.push('Calibration is balanced — no weight changes.');
  }
  return adj;
}

// 51716 — compact mobile payload: score, trend, meaning
export function mobileConfidenceCard(finding) {
  const pts = confidenceHistory(finding);
  const first = pts[0]?.score ?? clampScore(finding.confidence);
  const last = pts[pts.length - 1].score;
  return {
    id: finding.id,
    title: finding.title,
    confidence: last,
    color: confidenceColor(last),
    trend: last > first ? 'up' : last < first ? 'down' : 'flat',
    meaning: confidenceTooltip(last),
    tapTarget: 'opens full confidence detail',
  };
}

// 51717 — which scores changed between two snapshots
export function snapshotConfidenceDiffs(snapA, snapB) {
  const a = new Map((snapA.findings || []).map(f => [f.id, clampScore(f.confidence)]));
  const diffs = [];
  for (const f of snapB.findings || []) {
    const before = a.get(f.id);
    const now = clampScore(f.confidence);
    if (before === undefined) diffs.push({ id: f.id, change: 'added', from: null, to: now });
    else if (before !== now)
      diffs.push({
        id: f.id,
        change: now > before ? 'rose' : 'fell',
        from: before,
        to: now,
        delta: now - before,
      });
  }
  for (const f of snapA.findings || []) {
    if (!(snapB.findings || []).some(x => x.id === f.id))
      diffs.push({ id: f.id, change: 'removed', from: clampScore(f.confidence), to: null });
  }
  return diffs;
}

// 51718 — triage SLA scales with confidence: shaky findings get more time
export function slaForConfidence(score) {
  const s = clampScore(score);
  const hours = s >= 90 ? 4 : s >= 80 ? 8 : s >= 60 ? 24 : s >= 40 ? 72 : 168;
  return {
    score: s,
    hours,
    label: `Triage within ${hours}h`,
    rationale:
      s >= 80
        ? 'High-confidence findings need fast human eyes.'
        : 'Lower confidence allows a longer evidence-gathering window.',
  };
}

// 51719 — cluster findings into certain / likely / unproven buckets
export function groupFindings(findings) {
  const groups = { certain: [], likely: [], unproven: [] };
  for (const f of findings) {
    const s = clampScore(f.confidence);
    if (s >= 80) groups.certain.push(f);
    else if (s >= 60) groups.likely.push(f);
    else groups.unproven.push(f);
  }
  return groups;
}

// 51720 — analyst override: manual score, note is mandatory and audited
export function overrideScore(finding, score, note) {
  if (!note || !String(note).trim()) {
    throw new Error('override requires a note — manual scores must be justified');
  }
  const next = clampScore(score);
  return {
    ...finding,
    confidence: next,
    overridden: true,
    history: [
      ...(finding.history || []),
      {
        at: new Date().toISOString(),
        score: next,
        trigger: `analyst override → ${next}: ${String(note).trim()}`,
      },
    ],
  };
}
