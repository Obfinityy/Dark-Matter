/**
 * Wave 108B — Risk scoring suite (ideas 54291-54300).
 *
 * Pure JS core logic for target risk scoring in Dark Matter / Hunt AI:
 * exploitability vs impact as two dimensions, crown-jewel pinning,
 * compliance scope boosts, score documentation, CSV export, smart groups,
 * weekly mover notifications, leaderboards, score-vs-findings calibration
 * and patch-cadence weighting.
 *
 * No JSX, no side effects — every export is deterministic and testable with
 * plain objects. Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE108_B_IDEAS = [
  { id: 54291, title: 'Exploitability index', summary: 'Separates "likely to have bugs" from "bugs likely to matter" as a second scoring dimension.' },
  { id: 54292, title: 'Crown-jewel tagging boost', summary: 'Lets users mark business-critical targets that always sort to the top.' },
  { id: 54293, title: 'Compliance scope boost', summary: 'Raises priority for targets in active audit or certification scope.' },
  { id: 54294, title: 'Score documentation links', summary: "Links each factor to docs explaining how it's measured and improved." },
  { id: 54295, title: 'Score export', summary: 'Includes scores and breakdowns in CSV/PDF exports for client reporting.' },
  { id: 54296, title: 'Score-based smart groups', summary: 'Auto-groups targets into Critical/High/Medium/Low bands that stay current.' },
  { id: 54297, title: 'Score notifications', summary: 'Subscribes stakeholders to weekly top-movers summaries.' },
  { id: 54298, title: 'Risk score leaderboard', summary: 'Ranks all targets with movement arrows for prioritization reviews.' },
  { id: 54299, title: 'Score vs findings correlation', summary: 'Charts whether high-scored targets actually yield findings to calibrate the model.' },
  { id: 54300, title: 'Patch cadence factor', summary: 'Rewards targets that ship fixes quickly and penalizes long-unpatched stacks.' },
];

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const clamp100 = (v) => Math.min(100, Math.max(0, Number(v) || 0));
const round2 = (v) => Math.round(v * 100) / 100;

export function normalizeSignalSet(signals, defaults) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const raw = signals && signals[key] !== undefined ? signals[key] : defaults[key];
    out[key] = clamp01(raw);
  }
  return out;
}

function weightedSum(values, weights) {
  let total = 0;
  let weightTotal = 0;
  for (const key of Object.keys(weights)) {
    total += (values[key] || 0) * weights[key];
    weightTotal += weights[key];
  }
  return weightTotal === 0 ? 0 : total / weightTotal;
}

/* ------------------------------------------------------------------ */
/* 54291 — Exploitability index                                        */
/* ------------------------------------------------------------------ */

export const LIKELIHOOD_SIGNALS = {
  attackSurface: 0.25,
  exposure: 0.25,
  vulnHistory: 0.2,
  techRisk: 0.15,
  exploitAvailability: 0.15,
};

export const IMPACT_SIGNALS = {
  dataSensitivity: 0.25,
  revenueImpact: 0.25,
  userCount: 0.2,
  complianceWeight: 0.15,
  crownJewelWeight: 0.15,
};

/**
 * Scores exploitability as two independent dimensions:
 * likelihood ("likely to have bugs") and impact ("bugs likely to matter").
 * @param {object} likelihoodSignals 0..1 signals, see LIKELIHOOD_SIGNALS keys
 * @param {object} impactSignals 0..1 signals, see IMPACT_SIGNALS keys
 * @returns {{likelihood:number, impact:number, index:number, quadrant:string}}
 */
export function exploitabilityIndex(likelihoodSignals, impactSignals) {
  const defaults = (w) => Object.fromEntries(Object.keys(w).map((k) => [k, 0]));
  const likelihood = weightedSum(normalizeSignalSet(likelihoodSignals, defaults(LIKELIHOOD_SIGNALS)), LIKELIHOOD_SIGNALS) * 100;
  const impact = weightedSum(normalizeSignalSet(impactSignals, defaults(IMPACT_SIGNALS)), IMPACT_SIGNALS) * 100;
  // Geometric mean keeps the index honest: a target must score on BOTH
  // dimensions to rank high; a one-sided spike cannot dominate.
  const index = round2(Math.sqrt(clamp100(likelihood) * clamp100(impact)));
  const quadrant =
    likelihood >= 50 && impact >= 50 ? 'high-likelihood-high-impact'
    : likelihood >= 50 ? 'high-likelihood-low-impact'
    : impact >= 50 ? 'low-likelihood-high-impact'
    : 'low-likelihood-low-impact';
  return { likelihood: round2(likelihood), impact: round2(impact), index, quadrant };
}

/* ------------------------------------------------------------------ */
/* 54292 — Crown-jewel tagging boost                                   */
/* ------------------------------------------------------------------ */

/**
 * Marks a target as a crown jewel (business-critical). Pure: returns a copy.
 */
export function tagCrownJewel(target, { reason = 'business-critical', taggedBy = 'analyst' } = {}) {
  if (!target || !target.id) throw new Error('target with id is required');
  const tags = new Set(target.tags || []);
  tags.add('crown-jewel');
  return {
    ...target,
    tags: [...tags],
    crownJewel: true,
    crownJewelReason: reason,
    crownJewelTaggedBy: taggedBy,
    crownJewelTaggedAt: new Date().toISOString(),
  };
}

export function untagCrownJewel(target) {
  if (!target || !target.id) throw new Error('target with id is required');
  return {
    ...target,
    tags: (target.tags || []).filter((t) => t !== 'crown-jewel'),
    crownJewel: false,
    crownJewelReason: null,
    crownJewelTaggedBy: null,
    crownJewelTaggedAt: null,
  };
}

export function isCrownJewel(target) {
  return Boolean(target && (target.crownJewel === true || (target.tags || []).includes('crown-jewel')));
}

export const CROWN_JEWEL_SCORE_BOOST = 10;

/**
 * Sorts targets so crown jewels are always pinned at the top (by effective
 * score among themselves), then everyone else by effective score.
 */
export function sortWithCrownJewels(list, scoreOf = (t) => Number(t.score) || 0) {
  const rows = (list || []).map((t) => ({ target: t, score: scoreOf(t), jewel: isCrownJewel(t) }));
  rows.sort((a, b) => {
    if (a.jewel !== b.jewel) return a.jewel ? -1 : 1;
    return b.score - a.score;
  });
  return rows.map((r) => r.target);
}

/* ------------------------------------------------------------------ */
/* 54293 — Compliance scope boost                                      */
/* ------------------------------------------------------------------ */

export const COMPLIANCE_SCORE_BOOST = 8;

/**
 * Raises priority for targets inside an active audit/certification scope.
 * @param {object} target target with id/name/frameworks/tags
 * @param {{framework:string, inScope:(string[]), note?:string}} auditScope
 * @returns {{inScope:boolean, boost:number, boostedScore:number, reason:string}}
 */
export function applyComplianceBoost(target, auditScope) {
  const targetScore = clamp100(Number(target && target.score) || 0);
  const scope = auditScope || {};
  const ids = new Set((scope.inScope || []).map(String));
  const targetFrameworks = new Set(((target && target.frameworks) || []).map(String));
  const inScope =
    ids.has(String(target && target.id)) ||
    ids.has(String(target && target.name)) ||
    (scope.framework && targetFrameworks.has(String(scope.framework)));
  const boost = inScope ? COMPLIANCE_SCORE_BOOST : 0;
  return {
    inScope,
    boost,
    boostedScore: clamp100(targetScore + boost),
    reason: inScope
      ? `In active ${scope.framework || 'audit'} scope — priority raised by ${COMPLIANCE_SCORE_BOOST}.`
      : 'Not in active audit scope — no compliance boost applied.',
    framework: scope.framework || null,
    auditNote: scope.note || null,
  };
}

/* ------------------------------------------------------------------ */
/* 54294 — Score documentation links                                   */
/* ------------------------------------------------------------------ */

export const FACTOR_DOCS = {
  'base-score': {
    label: 'Base risk score',
    url: '/docs/scoring/factors#base-score',
    blurb: 'How the 0-100 base risk score is measured and what raises it.',
  },
  exploitability: {
    label: 'Exploitability index',
    url: '/docs/scoring/factors#exploitability',
    blurb: 'Likelihood vs impact as two dimensions — how each signal is measured and improved.',
  },
  'crown-jewel': {
    label: 'Crown-jewel tagging',
    url: '/docs/scoring/factors#crown-jewel',
    blurb: 'Marking business-critical targets and how the +10 pinning boost works.',
  },
  compliance: {
    label: 'Compliance scope boost',
    url: '/docs/scoring/factors#compliance',
    blurb: 'Active audit and certification scopes and the +8 priority raise.',
  },
  'patch-cadence': {
    label: 'Patch cadence factor',
    url: '/docs/scoring/factors#patch-cadence',
    blurb: 'How deploy frequency and patch lag are measured; rewards fast shipping, penalizes stale stacks.',
  },
  'smart-groups': {
    label: 'Smart groups',
    url: '/docs/scoring/factors#smart-groups',
    blurb: 'Critical / High / Medium / Low band boundaries and how groups stay current.',
  },
};

export const FACTOR_KEYS = Object.keys(FACTOR_DOCS);

/**
 * Returns the docs URL/label for a scoring factor.
 * @throws when the factor key is unknown
 */
export function factorDocLink(factorKey) {
  const doc = FACTOR_DOCS[factorKey];
  if (!doc) throw new Error(`unknown scoring factor: ${factorKey}. Known: ${FACTOR_KEYS.join(', ')}`);
  return { key: factorKey, ...doc };
}

/* ------------------------------------------------------------------ */
/* Effective score + breakdown (used by export, groups, leaderboard)    */
/* ------------------------------------------------------------------ */

export const SMART_BANDS = [
  { name: 'critical', min: 85, label: 'Critical' },
  { name: 'high', min: 65, label: 'High' },
  { name: 'medium', min: 40, label: 'Medium' },
  { name: 'low', min: 0, label: 'Low' },
];

export function assignSmartBand(score) {
  const s = clamp100(Number(score) || 0);
  return SMART_BANDS.find((b) => s >= b.min).name;
}

/**
 * Computes the effective score: base + crown-jewel boost + compliance boost
 * + patch-cadence swing (-5..+5), clamped to 0..100. Returns a factor
 * breakdown so every line item can link to its docs (54294).
 */
export function scoreBreakdown(target, { auditScope = null } = {}) {
  const base = clamp100(Number(target && target.score) || 0);
  const likelihood = normalizeSignalSet(target && target.likelihoodSignals, { attackSurface: 0, exposure: 0, vulnHistory: 0, techRisk: 0, exploitAvailability: 0 });
  const impact = normalizeSignalSet(target && target.impactSignals, { dataSensitivity: 0, revenueImpact: 0, userCount: 0, complianceWeight: 0, crownJewelWeight: 0 });
  const exploitability = exploitabilityIndex(likelihood, impact);

  const jewel = isCrownJewel(target);
  const compliance = applyComplianceBoost(target, auditScope);
  const cadence = patchCadenceScore(target && target.deployHistory);
  const cadenceSwing = round2((cadence - 0.5) * 10); // -5 .. +5

  const factors = [
    { key: 'base-score', label: 'Base risk score', value: base, doc: factorDocLink('base-score').url },
    { key: 'exploitability', label: 'Exploitability index', value: exploitability.index, doc: factorDocLink('exploitability').url },
    { key: 'crown-jewel', label: 'Crown-jewel boost', value: jewel ? CROWN_JEWEL_SCORE_BOOST : 0, doc: factorDocLink('crown-jewel').url },
    { key: 'compliance', label: 'Compliance boost', value: compliance.boost, doc: factorDocLink('compliance').url },
    { key: 'patch-cadence', label: 'Patch cadence swing', value: cadenceSwing, doc: factorDocLink('patch-cadence').url },
  ];

  const total = clamp100(base + (jewel ? CROWN_JEWEL_SCORE_BOOST : 0) + compliance.boost + cadenceSwing);
  return {
    targetId: target ? target.id : null,
    targetName: target ? target.name : null,
    base,
    exploitability,
    crownJewel: jewel,
    complianceBoost: compliance.boost,
    complianceInScope: compliance.inScope,
    patchCadence: cadence,
    patchCadenceSwing: cadenceSwing,
    factors,
    total: round2(total),
    band: assignSmartBand(total),
  };
}

export function effectiveScore(target, opts) {
  return scoreBreakdown(target, opts).total;
}

/* ------------------------------------------------------------------ */
/* 54295 — Score export                                                */
/* ------------------------------------------------------------------ */

const CSV_COLUMNS = [
  'target_id',
  'target_name',
  'base_score',
  'effective_score',
  'band',
  'likelihood',
  'impact',
  'exploitability_index',
  'quadrant',
  'crown_jewel',
  'compliance_boost',
  'patch_cadence_score',
  'findings_count',
];

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Exports scores and full breakdowns as a CSV string for client reporting.
 */
export function exportScoresCsv(targets, { auditScope = null } = {}) {
  const rows = [CSV_COLUMNS.join(',')];
  for (const target of targets || []) {
    const b = scoreBreakdown(target, { auditScope });
    rows.push(
      [
        b.targetId,
        b.targetName,
        b.base,
        b.total,
        b.band,
        b.exploitability.likelihood,
        b.exploitability.impact,
        b.exploitability.index,
        b.exploitability.quadrant,
        b.crownJewel ? 'yes' : 'no',
        b.complianceBoost,
        b.patchCadence,
        (target && target.findings ? target.findings.length : 0),
      ].map(csvEscape).join(',')
    );
  }
  return rows.join('\n');
}

/**
 * Exports the same breakdowns as a printable text report body (PDF source).
 */
export function exportScoresReport(targets, { auditScope = null, provider = 'Infinity AI' } = {}) {
  const lines = [
    `Dark Matter — target risk score report`,
    `Generated by ${provider} · ${new Date().toISOString()}`,
    '='.repeat(64),
  ];
  for (const target of targets || []) {
    const b = scoreBreakdown(target, { auditScope });
    lines.push('');
    lines.push(`${b.targetName || b.targetId} [${b.band.toUpperCase()}] — effective ${b.total} (base ${b.base})`);
    for (const f of b.factors) {
      lines.push(`  ${f.label}: ${f.value} — ${f.doc}`);
    }
    lines.push(`  Findings on record: ${(target && target.findings ? target.findings.length : 0)}`);
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 54296 — Score-based smart groups                                    */
/* ------------------------------------------------------------------ */

/**
 * Auto-groups targets into Critical / High / Medium / Low bands, always
 * recomputed from current effective scores so groups stay current after
 * any rescore. Deterministic: bands sorted critical-first, targets sorted
 * by effective score inside each band.
 */
export function buildSmartGroups(targets, { auditScope = null } = {}) {
  const groups = { critical: [], high: [], medium: [], low: [] };
  for (const target of targets || []) {
    const b = scoreBreakdown(target, { auditScope });
    groups[b.band].push({ ...target, effectiveScore: b.total, band: b.band });
  }
  for (const name of Object.keys(groups)) {
    groups[name].sort((a, b) => b.effectiveScore - a.effectiveScore);
  }
  return {
    critical: groups.critical,
    high: groups.high,
    medium: groups.medium,
    low: groups.low,
    counts: {
      critical: groups.critical.length,
      high: groups.high.length,
      medium: groups.medium.length,
      low: groups.low.length,
    },
    computedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* 54297 — Score notifications                                         */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Subscribes a stakeholder to weekly top-movers summaries.
 */
export function subscribeTopMovers(email, { topN = 5, band = null, frequency = 'weekly' } = {}) {
  if (!EMAIL_RE.test(String(email || ''))) throw new Error('valid email is required');
  const n = Math.min(20, Math.max(1, Number(topN) || 5));
  return {
    id: `sub:top-movers:${Date.now()}`,
    email,
    frequency,
    topN: n,
    bandFilter: band,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function unsubscribeTopMovers(subscription) {
  return { ...subscription, active: false, unsubscribedAt: new Date().toISOString() };
}

/**
 * Builds a weekly top-movers digest: targets with the biggest absolute
 * score movement vs last week, plus a one-line summary for the email body.
 * @param {Array} targets current targets (with .score)
 * @param {object} prevWeek map of target id -> score last week
 * @param {{topN?:number}} opts
 */
export function buildWeeklyMoversDigest(targets, prevWeek, { topN = 5 } = {}) {
  const prev = prevWeek || {};
  const movers = [];
  for (const target of targets || []) {
    const prevScore = prev[target.id];
    if (prevScore === undefined || prevScore === null) continue;
    const current = clamp100(Number(target.score) || 0);
    const delta = round2(current - Number(prevScore));
    if (delta === 0) continue;
    movers.push({
      targetId: target.id,
      targetName: target.name || target.id,
      prevScore: Number(prevScore),
      currentScore: current,
      delta,
      direction: delta > 0 ? 'up' : 'down',
      crownJewel: isCrownJewel(target),
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = movers.slice(0, Math.max(1, Number(topN) || 5));
  const up = top.filter((m) => m.direction === 'up').length;
  const down = top.length - up;
  const summary =
    top.length === 0
      ? 'No score movement this week — all tracked targets are stable.'
      : `Weekly top movers: ${top.length} target${top.length === 1 ? '' : 's'} moved — ${up} up, ${down} down. ` +
        `Biggest mover: ${top[0].targetName} (${top[0].delta > 0 ? '+' : ''}${top[0].delta}).`;
  return { movers: top, totalMovers: movers.length, summary, generatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* 54298 — Risk score leaderboard                                      */
/* ------------------------------------------------------------------ */

export const MOVEMENT_ARROWS = { up: '▲', down: '▼', same: '→', new: '✦' };

/**
 * Ranks all targets by effective score with movement arrows vs previous
 * scores, for prioritization reviews.
 * @param {Array} targets current targets
 * @param {object} prevScores map of target id -> previous EFFECTIVE score (the
 * score the leaderboard showed last review; arrows are computed on effective scores)
 */
export function buildLeaderboard(targets, prevScores, { auditScope = null } = {}) {
  const prev = prevScores || {};
  const rows = (targets || []).map((t) => {
    const current = effectiveScore(t, { auditScope });
    const hasPrev = prev[t.id] !== undefined && prev[t.id] !== null;
    const prevScore = hasPrev ? Number(prev[t.id]) : null;
    const delta = hasPrev ? round2(current - prevScore) : null;
    const movement = !hasPrev ? 'new' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    return {
      id: t.id,
      name: t.name || t.id,
      score: current,
      prevScore,
      delta,
      movement,
      arrow: MOVEMENT_ARROWS[movement],
      crownJewel: isCrownJewel(t),
      band: assignSmartBand(current),
    };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/* ------------------------------------------------------------------ */
/* 54299 — Score vs findings correlation                               */
/* ------------------------------------------------------------------ */

/**
 * Checks whether high-scored targets actually yield findings, to calibrate
 * the scoring model. Buckets targets by effective score band and computes
 * hit rates; the calibration score is a Pearson correlation between score
 * and finding count, normalized to 0..1 (0.5 = no correlation).
 */
export function correlationStats(scoredTargetsWithFindings, { auditScope = null } = {}) {
  const list = (scoredTargetsWithFindings || []).map((t) => ({
    id: t.id,
    score: effectiveScore(t, { auditScope }),
    findingCount: t.findings ? t.findings.length : 0,
  }));
  const buckets = {};
  for (const band of SMART_BANDS) buckets[band.name] = { band: band.name, label: band.label, targets: 0, withFindings: 0, findingCount: 0, hitRate: 0, avgFindings: 0 };
  for (const t of list) {
    const band = assignSmartBand(t.score);
    const b = buckets[band];
    b.targets += 1;
    b.findingCount += t.findingCount;
    if (t.findingCount > 0) b.withFindings += 1;
  }
  for (const band of SMART_BANDS) {
    const b = buckets[band.name];
    b.hitRate = b.targets === 0 ? 0 : round2(b.withFindings / b.targets);
    b.avgFindings = b.targets === 0 ? 0 : round2(b.findingCount / b.targets);
  }

  // Pearson correlation between score and finding count.
  let calibrationScore = 0.5;
  if (list.length >= 3) {
    const n = list.length;
    const meanS = list.reduce((a, t) => a + t.score, 0) / n;
    const meanF = list.reduce((a, t) => a + t.findingCount, 0) / n;
    let num = 0; let denS = 0; let denF = 0;
    for (const t of list) {
      num += (t.score - meanS) * (t.findingCount - meanF);
      denS += (t.score - meanS) ** 2;
      denF += (t.findingCount - meanF) ** 2;
    }
    const r = denS === 0 || denF === 0 ? 0 : num / Math.sqrt(denS * denF);
    calibrationScore = round2(clamp01((r + 1) / 2));
  }
  const ordered = ['critical', 'high', 'medium', 'low'].map((name) => buckets[name]);
  const interpretation =
    calibrationScore >= 0.75 ? 'Strong calibration — high-scored targets reliably yield findings.'
    : calibrationScore >= 0.6 ? 'Moderate calibration — scores generally track findings; review outliers.'
    : 'Weak calibration — scores do not track findings; retune the model.';
  return { buckets: ordered, calibrationScore, interpretation, targetCount: list.length };
}

/* ------------------------------------------------------------------ */
/* 54300 — Patch cadence factor                                        */
/* ------------------------------------------------------------------ */

/**
 * Patch cadence factor in 0..1: rewards fast, recent shipping and penalizes
 * long-unpatched (stale) stacks. deployHistory is an array of
 * { deployedAt: ISO string } entries, newest last or unordered.
 *
 * 60% weight: median deploy interval (≤7 days ≈ 1, ≥90 days ≈ 0).
 * 40% weight: recency of the last deploy (≤7 days ≈ 1, ≥120 days ≈ 0).
 */
export function patchCadenceScore(deployHistory, { now = new Date() } = {}) {
  const dates = (deployHistory || [])
    .map((d) => new Date(d.deployedAt || d.date || d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  const nowMs = new Date(now).getTime();
  if (dates.length === 0) return 0;

  const daysSinceLast = Math.max(0, (nowMs - dates[dates.length - 1].getTime()) / 86400000);
  const recency = clamp01(1 - daysSinceLast / 120);

  let intervalScore;
  if (dates.length === 1) {
    // A single deploy says nothing about cadence: score it like a 90-day
    // (quarterly-ish) interval so one-off targets don't rank with shippers.
    intervalScore = 0;
  } else {
    const gaps = [];
    for (let i = 1; i < dates.length; i += 1) {
      gaps.push((dates[i] - dates[i - 1]) / 86400000);
    }
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    intervalScore = clamp01(1 - median / 90);
  }
  return round2(0.6 * intervalScore + 0.4 * recency);
}

/**
 * One-line explanation of why a target earned its cadence factor.
 */
export function patchCadenceVerdict(deployHistory, { now = new Date() } = {}) {
  const score = patchCadenceScore(deployHistory, { now });
  const verdict =
    score >= 0.75 ? 'Fast cadence — ships fixes quickly, actively maintained.'
    : score >= 0.45 ? 'Moderate cadence — patching happens but lags at times.'
    : 'Stale stack — long gaps between deploys; long-unpatched risk.';
  return { score, verdict };
}
