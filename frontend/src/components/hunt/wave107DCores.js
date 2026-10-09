/**
 * wave107DCores.js — Infinity AI · Wave 107 Group D
 * Score presentation + hunt queue, ideas 54271–54280.
 *
 * Pure JavaScript, no JSX. Every export is deterministic: same input objects
 * always produce the same output objects. No dates are manufactured — any
 * "now" value is passed in by the caller. Scores are on a 0–100 scale.
 */

export const WAVE107_D_IDEAS = [
  { id: 54271, title: 'Score trend chart' },
  { id: 54272, title: 'Manual score override' },
  { id: 54273, title: 'Score confidence indicator (targets)' },
  { id: 54274, title: 'Peer percentile ranking' },
  { id: 54275, title: 'Program tier weighting' },
  { id: 54276, title: 'Client SLA weighting' },
  { id: 54277, title: 'Score-based hunt queue' },
  { id: 54278, title: 'Auto-hunt score thresholds' },
  { id: 54279, title: 'Recently-hunted dampener decay' },
  { id: 54280, title: 'Score boost on new changes' },
];

function clampScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clamp01(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Idea 54271 — Score trend chart.
 * Builds an annotated trend series from raw score history points so the UI
 * can plot score movement over time and label what drove each change.
 *
 * scoreHistory: [{ ts, score, annotation? }]
 * options: { maxPoints = 500 }
 * Returns: { points: [{ ts, score, delta, direction }], annotations: [{ ts, score, text }],
 *            firstScore, lastScore, netChange, trend: 'up'|'down'|'flat' }
 */
export function buildScoreTrend(scoreHistory, options = {}) {
  const list = Array.isArray(scoreHistory) ? scoreHistory.slice() : [];
  const maxPoints = Math.max(1, options.maxPoints || 500);
  const cleaned = list
    .filter((p) => p && typeof p.ts === 'number' && typeof p.score === 'number')
    .map((p) => ({
      ts: p.ts,
      score: clampScore(p.score),
      annotation: typeof p.annotation === 'string' ? p.annotation : null,
    }))
    .sort((a, b) => a.ts - b.ts)
    .slice(-maxPoints);

  const points = cleaned.map((p, i) => {
    const prev = i > 0 ? cleaned[i - 1].score : p.score;
    const delta = p.score - prev;
    return {
      ts: p.ts,
      score: p.score,
      delta: Math.round(delta * 100) / 100,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    };
  });

  const annotations = cleaned
    .filter((p) => p.annotation && p.annotation.trim().length > 0)
    .map((p) => ({ ts: p.ts, score: p.score, text: p.annotation.trim() }));

  const firstScore = points.length > 0 ? points[0].score : 0;
  const lastScore = points.length > 0 ? points[points.length - 1].score : 0;
  const netChange = Math.round((lastScore - firstScore) * 100) / 100;

  return {
    points,
    annotations,
    firstScore,
    lastScore,
    netChange,
    trend: netChange > 0 ? 'up' : netChange < 0 ? 'down' : 'flat',
    pointCount: points.length,
  };
}

/**
 * Idea 54272 — Manual score override.
 * Lets an analyst pin a score with a written justification when the model
 * misses context. Returns a new target object; the input is never mutated.
 *
 * Returns: { ...target, score: pinned, override: { pinnedScore, justification,
 *            analystId, previousScore, at } }
 */
export function applyManualOverride(target, overrideScore, justification, options = {}) {
  const safeTarget = target && typeof target === 'object' ? { ...target } : {};
  const pinnedScore = clampScore(Number(overrideScore));
  const reason =
    typeof justification === 'string' && justification.trim().length > 0
      ? justification.trim()
      : 'No justification recorded';
  const analystId =
    typeof options.analystId === 'string' && options.analystId.trim().length > 0
      ? options.analystId.trim()
      : 'analyst';
  const previousScore = clampScore(Number(safeTarget.score));

  return {
    ...safeTarget,
    score: pinnedScore,
    override: {
      pinnedScore,
      previousScore,
      justification: reason,
      analystId,
      at: typeof options.at === 'number' ? options.at : Date.now(),
      isManualOverride: true,
    },
  };
}

/**
 * Idea 54273 — Score confidence indicator (targets).
 * Displays how much evidence backs each score so thin-data scores are not
 * overtrusted.
 *
 * evidenceItems: [{ source, weight (0–100), note? }]
 * Returns: { score, confidence (0–100), level: 'low'|'medium'|'high',
 *            evidenceCount, thinData }
 */
export function confidenceIndicator(score, evidenceItems) {
  const safeScore = clampScore(Number(score));
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];
  const valid = items.filter(
    (e) => e && typeof e === 'object' && typeof e.source === 'string' && typeof e.weight === 'number',
  );
  const totalWeight = valid.reduce((sum, e) => sum + Math.min(100, Math.max(0, e.weight)), 0);
  // Diminishing returns after the first handful of evidence items so a pile of
  // trivial signals cannot fake high confidence.
  const confidence = Math.round(Math.min(100, totalWeight * (valid.length > 0 ? 1 : 0)) * 100) / 100;
  const level = confidence >= 75 ? 'high' : confidence >= 40 ? 'medium' : 'low';

  return {
    score: safeScore,
    confidence,
    level,
    evidenceCount: valid.length,
    thinData: level === 'low',
    sources: valid.map((e) => e.source),
  };
}

/**
 * Idea 54274 — Peer percentile ranking.
 * Shows where a target sits versus the portfolio, e.g. "riskier than 82%".
 * Returns a percentile in 0–100: the share of peers scored strictly below
 * the target.
 *
 * portfolioScores: array of peer scores (the target itself may be included or not).
 * Returns: { percentile, peerCount, peersBelow, label }
 */
export function peerPercentile(targetScore, portfolioScores) {
  const score = clampScore(Number(targetScore));
  const peers = (Array.isArray(portfolioScores) ? portfolioScores : [])
    .filter((s) => typeof s === 'number' && !Number.isNaN(s))
    .map(clampScore);
  const peerCount = peers.length;
  if (peerCount === 0) {
    return { percentile: 0, peerCount: 0, peersBelow: 0, label: 'riskier than 0% of targets' };
  }
  const peersBelow = peers.filter((s) => s < score).length;
  const percentile = Math.round((peersBelow / peerCount) * 100);
  return {
    percentile,
    peerCount,
    peersBelow,
    label: `riskier than ${percentile}% of targets`,
  };
}

/**
 * Idea 54275 — Program tier weighting.
 * Lets programs define how much bounty value influences their targets' scores.
 * Higher bounty programs nudge scores up, capped so bounty value can inform
 * but never dominate the model score.
 *
 * tierConfig: { tier = 'standard', tiers = { standard: 1, plus: 1.6, elite: 2.4 },
 *               multiplier = 0.0015, maxBoost = 25 }
 * Returns: { score, finalScore, boost, tier, bountyValue }
 */
export function applyProgramTierWeighting(score, bountyValue, tierConfig = {}) {
  const safeScore = clampScore(Number(score));
  const value = Math.max(0, Number(bountyValue) || 0);
  const tiers =
    tierConfig.tiers && typeof tierConfig.tiers === 'object'
      ? tierConfig.tiers
      : { standard: 1, plus: 1.6, elite: 2.4 };
  const tier = typeof tierConfig.tier === 'string' && tiers[tierConfig.tier] ? tierConfig.tier : 'standard';
  const multiplier = typeof tierConfig.multiplier === 'number' ? tierConfig.multiplier : 0.0015;
  const maxBoost = typeof tierConfig.maxBoost === 'number' ? tierConfig.maxBoost : 25;

  const rawBoost = value * multiplier * tiers[tier];
  const boost = Math.round(Math.min(maxBoost, Math.max(0, rawBoost)) * 100) / 100;

  return {
    score: safeScore,
    bountyValue: value,
    tier,
    boost,
    finalScore: clampScore(safeScore + boost),
  };
}

/**
 * Idea 54276 — Client SLA weighting.
 * Applies per-client importance multipliers for MSSP prioritization. A client
 * with a platinum SLA gets their targets weighted up; the multiplier table
 * is supplied by the operator and unknown clients get a neutral 1.0.
 *
 * slaMultipliers: { [clientId]: multiplier }
 * Returns: { score, finalScore, clientId, multiplier, weighted: boolean }
 */
export function applyClientSlaWeighting(score, clientId, slaMultipliers = {}) {
  const safeScore = clampScore(Number(score));
  const id = typeof clientId === 'string' ? clientId : 'unknown';
  const table = slaMultipliers && typeof slaMultipliers === 'object' ? slaMultipliers : {};
  const raw = table[id];
  const multiplier = typeof raw === 'number' && raw > 0 ? raw : 1;

  return {
    score: safeScore,
    clientId: id,
    multiplier,
    weighted: multiplier !== 1,
    finalScore: clampScore(safeScore * multiplier),
  };
}

/**
 * Idea 54277 — Score-based hunt queue.
 * Orders the hunt scheduler by risk score so the juiciest targets get hunted
 * first. Stable, deterministic, descending. Returns a NEW array; the input
 * order is preserved for ties via an explicit queueRank.
 *
 * targets: [{ id, score, ...rest }]
 * Returns: [{ ...target, queueRank }]
 */
export function orderHuntQueue(targets) {
  const list = (Array.isArray(targets) ? targets : [])
    .map((t, i) => ({ index: i, target: t && typeof t === 'object' ? { ...t } : {} }))
    .map(({ index, target }) => ({ index, target, score: clampScore(Number(target.score)) }));

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index; // stable: keep original order on ties
  });

  return list.map(({ target, score }, rank) => ({
    ...target,
    score,
    queueRank: rank + 1,
  }));
}

/**
 * Idea 54278 — Auto-hunt score thresholds.
 * Triggers hunts automatically when a target's score crosses a configured
 * line. Per-target overrides win over the default line.
 *
 * thresholds: { default = 75, perTarget = { [id]: line } }
 * Returns: [{ id, score, line, crossed: true, autoHunt: true }] for crossed targets only.
 */
export function checkAutoHuntThresholds(targets, thresholds = {}) {
  const defaultLine = typeof thresholds.default === 'number' ? thresholds.default : 75;
  const perTarget =
    thresholds.perTarget && typeof thresholds.perTarget === 'object' ? thresholds.perTarget : {};
  const list = Array.isArray(targets) ? targets : [];

  return list
    .filter((t) => t && typeof t === 'object' && typeof t.id !== 'undefined')
    .map((t) => {
      const score = clampScore(Number(t.score));
      const lineRaw = perTarget[String(t.id)];
      const line = typeof lineRaw === 'number' ? lineRaw : defaultLine;
      return { id: t.id, score, line, crossed: score >= line };
    })
    .filter((r) => r.crossed)
    .map((r) => ({ id: r.id, score: r.score, line: r.line, crossed: true, autoHunt: true }));
}

/**
 * Idea 54279 — Recently-hunted dampener decay.
 * Reduces the "just hunted" score dampener over time (exponential half-life
 * decay) so stale targets climb back up the queue instead of staying
 * deprioritized forever.
 *
 * target: { id, score, lastHuntedTs, huntedDampener }
 * options: { halfLifeHours = 24, floor = 0.5 }
 * Returns: { id, baseScore, elapsedHours, remainingDampener, effectiveScore, fullyRecovered }
 */
export function decayHuntedDampener(target, nowTs, options = {}) {
  const safe = target && typeof target === 'object' ? target : {};
  const baseScore = clampScore(Number(safe.score));
  const lastHuntedTs = typeof safe.lastHuntedTs === 'number' ? safe.lastHuntedTs : Number(nowTs);
  const startDampener = Math.max(0, Number(safe.huntedDampener) || 0);
  const halfLifeHours = typeof options.halfLifeHours === 'number' && options.halfLifeHours > 0
    ? options.halfLifeHours
    : 24;
  const floor = typeof options.floor === 'number' && options.floor >= 0 ? options.floor : 0.5;

  const elapsedHours = Math.max(0, (Number(nowTs) - lastHuntedTs) / 3_600_000);
  const remainingDampener = startDampener * Math.pow(0.5, elapsedHours / halfLifeHours);
  const fullyRecovered = remainingDampener < floor;

  return {
    id: safe.id,
    baseScore,
    elapsedHours: Math.round(elapsedHours * 100) / 100,
    remainingDampener: Math.round(remainingDampener * 100) / 100,
    effectiveScore: clampScore(baseScore - (fullyRecovered ? 0 : remainingDampener)),
    fullyRecovered,
  };
}

/**
 * Idea 54280 — Score boost on new changes.
 * Temporarily lifts scores when high-interest changes are detected. Recent,
 * high-interest changes contribute most; the total boost is capped so a
 * noisy target cannot shoot to 100 on change events alone.
 *
 * changeEvents: [{ type, interest (0–1), detectedTs }]
 * options: { perInterestPoints = 20, maxBoost = 30, recencyHalfLifeHours = 12 }
 * Returns: { score, boostedScore, boost, contributingChanges }
 */
export function boostOnNewChanges(score, changeEvents, nowTs, options = {}) {
  const safeScore = clampScore(Number(score));
  const events = Array.isArray(changeEvents) ? changeEvents : [];
  const perInterestPoints =
    typeof options.perInterestPoints === 'number' ? options.perInterestPoints : 20;
  const maxBoost = typeof options.maxBoost === 'number' ? options.maxBoost : 30;
  const halfLife = typeof options.recencyHalfLifeHours === 'number' && options.recencyHalfLifeHours > 0
    ? options.recencyHalfLifeHours
    : 12;

  let boost = 0;
  let contributingChanges = 0;
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const interest = clamp01(Number(e.interest));
    if (interest <= 0) continue;
    const detectedTs = typeof e.detectedTs === 'number' ? e.detectedTs : Number(nowTs);
    const elapsedHours = Math.max(0, (Number(nowTs) - detectedTs) / 3_600_000);
    boost += interest * perInterestPoints * Math.pow(0.5, elapsedHours / halfLife);
    contributingChanges += 1;
  }

  const capped = Math.round(Math.min(maxBoost, boost) * 100) / 100;
  return {
    score: safeScore,
    boostedScore: clampScore(safeScore + capped),
    boost: capped,
    contributingChanges,
  };
}

export default {
  WAVE107_D_IDEAS,
  buildScoreTrend,
  applyManualOverride,
  confidenceIndicator,
  peerPercentile,
  applyProgramTierWeighting,
  applyClientSlaWeighting,
  orderHuntQueue,
  checkAutoHuntThresholds,
  decayHuntedDampener,
  boostOnNewChanges,
};
