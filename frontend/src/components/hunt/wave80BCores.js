/**
 * wave80BCores.js — Infinity AI · Dark-Matter · Wave 80B
 * Time-to-first-finding deep analytics, ideas 53181–53200.
 * Pure logic for zero-finding analysis, TTF correlation, first-
 * finding profiles, and TTF breakdowns by time, scope, experience,
 * start temperature, payload, mode, depth, vertical, season, and
 * target maturity. Every helper takes explicit inputs, never
 * mutates them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE80_B_IDEAS = [
  { id: 53181, title: 'Zero-Finding Hunt TTF Analysis', skip: false },
  { id: 53182, title: 'TTF vs Total Findings Correlation', skip: false },
  { id: 53183, title: 'First-Finding Type Profiles', skip: false },
  { id: 53184, title: 'TTF by Time of Day', skip: false },
  { id: 53185, title: 'TTF by Scope Size', skip: false },
  { id: 53186, title: 'TTF by Researcher Experience', skip: false },
  { id: 53187, title: 'TTF Warm-Start Effect', skip: false },
  { id: 53188, title: 'TTF Cold-Start Penalty', skip: false },
  { id: 53189, title: 'Inter-Finding Time Distributions', skip: false },
  { id: 53190, title: 'TTF by Payload Family', skip: false },
  { id: 53191, title: 'TTF Regression Detection', skip: false },
  { id: 53192, title: 'TTF Budget Planner', skip: false },
  { id: 53193, title: 'TTF Outlier Autopsies', skip: false },
  { id: 53194, title: 'TTF by Hunt Mode', skip: false },
  { id: 53195, title: 'TTF Confidence Intervals per Strategy', skip: false },
  { id: 53196, title: 'TTF vs False-Positive Tradeoff', skip: false },
  { id: 53197, title: 'First-Finding Depth Analysis', skip: false },
  { id: 53198, title: 'TTF by Industry Vertical', skip: false },
  { id: 53199, title: 'TTF Seasonality', skip: false },
  { id: 53200, title: 'TTF by Target Maturity', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function findingsOf(h) { return Number(h.validatedFindings ?? h.findings ?? h.findingsCount ?? 0); }
function ttfOf(h) {
  const raw = h.ttfMinutes ?? h.timeToFirstFindingMinutes ?? h.medianTTF ?? h.ttf ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? round2(sorted[mid]) : round2((sorted[mid - 1] + sorted[mid]) / 2);
}
function mean(values) {
  return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round2(sorted[idx]);
}
function pearson(pairs) {
  if (pairs.length < 2) return 0;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    num += (x - meanX) * (y - meanY);
    denX += (x - meanX) ** 2;
    denY += (y - meanY) ** 2;
  }
  const den = Math.sqrt(denX * denY);
  return den ? round2(num / den) : 0;
}
function medianTTFByGroup(hunts, keyFn) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = keyFn(h);
    if (!key) continue;
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || { key, hunts: 0, values: [], findings: 0 };
    g.hunts += 1;
    g.values.push(ttf);
    g.findings += findingsOf(h);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ key: g.key, hunts: g.hunts, sampleSize: g.values.length, medianTTF: median(g.values), meanTTF: mean(g.values), findings: g.findings, findingsPerHunt: g.hunts ? round2(g.findings / g.hunts) : 0 })).sort((a, b) => a.medianTTF - b.medianTTF || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
}
function hourOf(h) {
  if (h.hour !== undefined) return Number(h.hour);
  if (h.startHour !== undefined) return Number(h.startHour);
  if (h.startedAt) {
    const d = new Date(h.startedAt);
    if (!Number.isNaN(d.getTime())) return d.getUTCHours();
  }
  return null;
}
function seasonOf(h) {
  if (h.season) return String(h.season);
  let month = null;
  if (h.month !== undefined) month = Number(h.month);
  else if (h.startedAt) {
    const d = new Date(h.startedAt);
    if (!Number.isNaN(d.getTime())) month = d.getUTCMonth() + 1;
  }
  if (month === null || !Number.isFinite(month)) return null;
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'fall';
}

/** Analyze hunts that ended with no validated finding (idea 53181). */
export function analyzeZeroFindingHuntTTF(hunts = [], options = {}) {
  const zero = (hunts || []).filter(h => findingsOf(h) === 0);
  const successful = (hunts || []).filter(h => findingsOf(h) > 0);
  const zeroDurations = zero.map(h => Number(h.totalMinutes ?? h.durationMinutes ?? h.totalDuration ?? 0)).filter(v => Number.isFinite(v));
  const successDurations = successful.map(h => Number(h.totalMinutes ?? h.durationMinutes ?? h.totalDuration ?? 0)).filter(v => Number.isFinite(v));
  const successTTFs = successful.map(ttfOf).filter(v => v !== null);
  const wastedMinutes = round2(zeroDurations.reduce((s, v) => s + v, 0));
  return { zeroHunts: zero.length, successfulHunts: successful.length, totalHunts: (hunts || []).length, zeroRate: rate(zero.length, (hunts || []).length), avgZeroMinutes: mean(zeroDurations), avgSuccessMinutes: mean(successDurations), medianSuccessTTF: median(successTTFs), wastedMinutes, summary: `Infinity AI analyzed ${zero.length} zero-finding hunt(s); wasted ${wastedMinutes} minute(s).` };
}

/** Measure how first-finding speed relates to total yield (idea 53182). */
export function correlateTTFWithTotalFindings(hunts = [], options = {}) {
  const pairs = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    pairs.push([ttf, findingsOf(h)]);
  }
  const correlation = pearson(pairs);
  const direction = correlation > 0.1 ? 'positive' : correlation < -0.1 ? 'negative' : 'flat';
  return { correlation, direction, count: pairs.length, sampleSize: pairs.length, meanTTF: mean(pairs.map(p => p[0])), meanFindings: mean(pairs.map(p => p[1])), summary: `Infinity AI found a ${direction} TTF-to-findings correlation of ${correlation} across ${pairs.length} hunt(s).` };
}

/** Profile which finding type tends to surface first (idea 53183). */
export function profileFirstFindingTypes(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.firstFindingType || h.findingType || h.type || null;
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, values: [] };
    g.hunts += 1;
    const ttf = ttfOf(h);
    if (ttf !== null) g.values.push(ttf);
    groups.set(key, g);
  }
  const total = [...groups.values()].reduce((s, g) => s + g.hunts, 0);
  const rows = [...groups.values()].map(g => ({ key: g.key, hunts: g.hunts, share: total ? rate(g.hunts, total) : 0, medianTTF: median(g.values), meanTTF: mean(g.values) })).sort((a, b) => b.hunts - a.hunts || a.medianTTF - b.medianTTF || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, typeCount: rows.length, totalHunts: total, dominant: rows[0] || null, top: rows[0] || null, summary: `Infinity AI profiled ${rows.length} first-finding type(s) across ${total} hunt(s).` };
}

/** Compare time to first finding by hour of day (idea 53184). */
export function analyzeTTFByTimeOfDay(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => {
    const hour = hourOf(h);
    if (hour === null || !Number.isFinite(hour)) return null;
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  });
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} time-of-day bucket(s).` };
}

/** Compare time to first finding by target scope size (idea 53185). */
export function analyzeTTFByScopeSize(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => {
    const raw = h.scopeSize ?? h.endpoints ?? h.endpointCount ?? null;
    if (raw === null || raw === undefined) return null;
    const size = Number(raw);
    if (!Number.isFinite(size)) return null;
    if (size <= 10) return 'small';
    if (size <= 50) return 'medium';
    return 'large';
  });
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} scope-size bucket(s).` };
}

/** Compare time to first finding by researcher experience (idea 53186). */
export function analyzeTTFByExperience(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.researcherExperience || h.experienceLevel || h.experience || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} experience level(s).` };
}

/** Measure the speed benefit of a warm start (idea 53187). */
export function measureTTFWarmStartEffect(hunts = [], options = {}) {
  const warmValues = [];
  const coldValues = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    if (h.warmStart === true || h.warmStarted === true || h.startType === 'warm') warmValues.push(ttf);
    else coldValues.push(ttf);
  }
  const warmMedian = median(warmValues);
  const coldMedian = median(coldValues);
  const benefit = round2(coldMedian - warmMedian);
  return { warmMedian, coldMedian, warmCount: warmValues.length, coldCount: coldValues.length, benefit, benefitPct: coldMedian ? rate(benefit, coldMedian) : 0, summary: `Infinity AI measured a warm-start TTF benefit of ${benefit} minute(s).` };
}

/** Measure the penalty paid on a first-ever hunt (idea 53188). */
export function measureTTFColdStartPenalty(hunts = [], options = {}) {
  const firstValues = [];
  const repeatValues = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const isFirst = h.isFirstHunt === true || h.firstHunt === true || h.coldStart === true || Number(h.huntIndex ?? h.priorHunts ?? -1) === 0 || h.priorHunts === 0;
    if (isFirst) firstValues.push(ttf);
    else repeatValues.push(ttf);
  }
  const firstMedian = median(firstValues);
  const repeatMedian = median(repeatValues);
  const penalty = round2(firstMedian - repeatMedian);
  return { firstMedian, repeatMedian, firstCount: firstValues.length, repeatCount: repeatValues.length, penalty, penaltyPct: repeatMedian ? round2(penalty / repeatMedian) : 0, summary: `Infinity AI measured a cold-start TTF penalty of ${penalty} minute(s).` };
}

/** Describe gaps between consecutive findings (idea 53189). */
export function analyzeInterFindingTimeDistributions(hunts = [], options = {}) {
  const gaps = [];
  const byStrategy = new Map();
  for (const h of hunts || []) {
    const strategy = h.strategy || 'overall';
    const local = [];
    const raw = h.interFindingMinutes ?? h.gaps ?? h.intervals ?? null;
    if (Array.isArray(raw)) for (const v of raw) { const n = Number(v); if (Number.isFinite(n)) local.push(n); }
    if (!local.length && Array.isArray(h.findingTimes) && h.findingTimes.length > 1) {
      const sorted = [...h.findingTimes].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) local.push(sorted[i] - sorted[i - 1]);
    }
    if (Number.isFinite(Number(h.interFindingMinutes)) && !Array.isArray(raw)) local.push(Number(h.interFindingMinutes));
    for (const v of local) {
      gaps.push(v);
      const g = byStrategy.get(strategy) || [];
      g.push(v);
      byStrategy.set(strategy, g);
    }
  }
  const rows = [...byStrategy.entries()].map(([key, values]) => ({ key, gaps: values.length, medianGap: median(values), meanGap: mean(values), p90Gap: percentile(values, 90) })).sort((a, b) => a.medianGap - b.medianGap || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, gapCount: gaps.length, median: median(gaps), mean: mean(gaps), p90: percentile(gaps, 90), min: gaps.length ? Math.min(...gaps) : 0, max: gaps.length ? Math.max(...gaps) : 0, fastest: rows[0] || null, summary: `Infinity AI analyzed ${gaps.length} inter-finding gap(s); median ${median(gaps)} minute(s).` };
}

/** Compare time to first finding by payload family (idea 53190). */
export function analyzeTTFByPayloadFamily(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.payloadFamily || h.family || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} payload famil(ies).` };
}

/** Flag strategies whose first-finding speed is regressing (idea 53191). */
export function detectTTFRegression(snapshots = [], options = {}) {
  const threshold = Number(options.thresholdMinutes ?? options.threshold ?? 15);
  const groups = new Map();
  for (const s of snapshots || []) {
    const key = s.strategy || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(a.at || a.date || '').localeCompare(String(b.at || b.date || '')));
    const values = sorted.map(ttfOf).filter(v => v !== null);
    const firstTTF = values.length ? values[0] : 0;
    const latestTTF = values.length ? values[values.length - 1] : 0;
    const delta = round2(latestTTF - firstTTF);
    return { key, points: sorted.length, firstTTF, latestTTF, delta, regression: delta >= threshold };
  }).sort((a, b) => b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  const regressions = rows.filter(r => r.regression);
  return { rows, regressions, alerts: regressions, count: rows.length, regressionCount: regressions.length, thresholdMinutes: threshold, summary: `Infinity AI flagged TTF regressions in ${regressions.length} of ${rows.length} strateg(ies).` };
}

/** Plan a time budget that covers most hunts (idea 53192). */
export function planTTFBudget(history = [], options = {}) {
  const values = (history || []).map(ttfOf).filter(v => v !== null);
  const med = median(values);
  const p75 = percentile(values, 75);
  const p90 = percentile(values, 90);
  const buffer = Number(options.bufferPct ?? options.buffer ?? 0);
  const recommendedMinutes = round2(p75 * (1 + buffer));
  return { recommendedMinutes, median: med, p75, p90, count: values.length, sampleSize: values.length, summary: `Infinity AI planned a TTF budget of ${recommendedMinutes} minute(s) from ${values.length} hunt(s).` };
}

/** Examine hunts with unusually slow first findings (idea 53193). */
export function autopsyTTFOutliers(hunts = [], options = {}) {
  const entries = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    entries.push({ strategy: h.strategy || 'overall', targetClass: h.targetClass || null, ttfMinutes: ttf, findings: findingsOf(h) });
  }
  const values = entries.map(e => e.ttfMinutes);
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  const iqr = round2(q3 - q1);
  const threshold = round2(q3 + 1.5 * iqr);
  const outliers = entries.filter(e => e.ttfMinutes > threshold).map(e => ({ ...e, excess: round2(e.ttfMinutes - threshold) })).sort((a, b) => b.ttfMinutes - a.ttfMinutes);
  return { outliers, outlierCount: outliers.length, count: entries.length, sampleSize: entries.length, median: median(values), q1, q3, iqr, threshold, summary: `Infinity AI autopsied ${outliers.length} TTF outlier(s) above ${threshold} minute(s).` };
}

/** Compare time to first finding by hunt mode (idea 53194). */
export function compareTTFByHuntMode(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.huntMode || h.mode || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} hunt mode(s).` };
}

/** Build confidence intervals for median-speed estimates (idea 53195). */
export function buildTTFConfidenceIntervals(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.strategy || null;
    if (!key) continue;
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push(ttf);
    groups.set(key, g);
  }
  const rows = [...groups.entries()].map(([key, values]) => {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const margin = values.length ? 1.96 * stdDev / Math.sqrt(values.length) : 0;
    const lower = round2(avg - margin);
    const upper = round2(avg + margin);
    return { key, hunts: values.length, sampleSize: values.length, meanTTF: round2(avg), medianTTF: median(values), stdDev: round2(stdDev), margin: round2(margin), lower, upper, width: round2(upper - lower) };
  }).sort((a, b) => a.width - b.width || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, tightest: rows[0] || null, widest: rows[rows.length - 1] || null, summary: `Infinity AI built TTF confidence intervals for ${rows.length} strateg(ies).` };
}

/** Examine speed against false-positive cost (idea 53196). */
export function analyzeTTFVsFalsePositiveTradeoff(hunts = [], options = {}) {
  const entries = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    entries.push({ ttf, fp: Number(h.falsePositives ?? h.falsePositiveCount ?? h.fpCount ?? 0) });
  }
  const medianTTF = median(entries.map(e => e.ttf));
  const fast = entries.filter(e => e.ttf <= medianTTF);
  const slow = entries.filter(e => e.ttf > medianTTF);
  const fastAvgFP = mean(fast.map(e => e.fp));
  const slowAvgFP = mean(slow.map(e => e.fp));
  const correlation = pearson(entries.map(e => [e.ttf, e.fp]));
  return { medianTTF, fastCount: fast.length, slowCount: slow.length, fastAvgFP, slowAvgFP, fastFpRate: fastAvgFP, slowFpRate: slowAvgFP, delta: round2(slowAvgFP - fastAvgFP), correlation, count: entries.length, summary: `Infinity AI compared TTF against false positives; fast hunts averaged ${fastAvgFP} false positive(s).` };
}

/** Analyze how deep the first finding tends to sit (idea 53197). */
export function analyzeFirstFindingDepth(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const raw = h.depth ?? h.firstFindingDepth ?? h.clickDepth ?? h.clicks ?? null;
    if (raw === null || raw === undefined) continue;
    const depth = Number(raw);
    if (!Number.isFinite(depth)) continue;
    const bucket = depth <= 3 ? 'shallow' : depth <= 8 ? 'medium' : 'deep';
    const g = groups.get(bucket) || { key: bucket, hunts: 0, depths: [], values: [] };
    g.hunts += 1;
    g.depths.push(depth);
    const ttf = ttfOf(h);
    if (ttf !== null) g.values.push(ttf);
    groups.set(bucket, g);
  }
  const order = { shallow: 0, medium: 1, deep: 2 };
  const rows = [...groups.values()].map(g => ({ key: g.key, hunts: g.hunts, avgDepth: mean(g.depths), medianTTF: median(g.values), meanTTF: mean(g.values) })).sort((a, b) => (order[a.key] - order[b.key]));
  const bySpeed = [...rows].sort((a, b) => a.medianTTF - b.medianTTF);
  return { rows, count: rows.length, fastest: bySpeed[0] || null, shallow: rows.find(r => r.key === 'shallow') || null, deep: rows.find(r => r.key === 'deep') || null, summary: `Infinity AI analyzed first-finding depth across ${rows.length} bucket(s).` };
}

/** Compare time to first finding by industry vertical (idea 53198). */
export function analyzeTTFByVertical(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.vertical || h.industryVertical || h.industry || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} industry vertical(s).` };
}

/** Compare time to first finding across seasons (idea 53199). */
export function analyzeTTFSeasonality(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => seasonOf(h));
  const seasons = rows.map(r => r.key);
  return { rows, count: rows.length, seasons, seasonCount: seasons.length, fastest: rows[0] || null, bestSeason: rows[0] || null, summary: `Infinity AI compared TTF seasonality across ${rows.length} season(s).` };
}

/** Compare time to first finding by target maturity (idea 53200). */
export function analyzeTTFByTargetMaturity(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.maturity || h.targetMaturity || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} target maturity level(s).` };
}
