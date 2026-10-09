/**
 * wave81ACore.js — Infinity AI · Dark-Matter · Wave 81A
 * Time-to-first-finding follow-up analytics, ideas 53201–53220:
 * re-hunt intervals, recon tool choice, stall recovery, gamification,
 * pricing, prompt templates, variance health, chained findings,
 * network conditions, cohorts, floor, category, early signals,
 * coverage at first finding, zero-day-like finds, model tiers,
 * human-vs-agent splits, report cards, anomaly explanations, and
 * scope triage. Every helper takes explicit inputs, never mutates
 * them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE81_A_IDEAS = [
  { id: 53201, title: 'TTF After Re-Hunt Intervals', skip: false },
  { id: 53202, title: 'TTF by Recon Tool Choice', skip: false },
  { id: 53203, title: 'TTF Stall Recovery Playbook', skip: false },
  { id: 53204, title: 'TTF Gamification', skip: false },
  { id: 53205, title: 'TTF-Adjusted Pricing Insights', skip: false },
  { id: 53206, title: 'TTF by Prompt Template', skip: false },
  { id: 53207, title: 'TTF Variance as Health Metric', skip: false },
  { id: 53208, title: 'TTF for Chained Findings', skip: false },
  { id: 53209, title: 'TTF by Network Conditions', skip: false },
  { id: 53210, title: 'TTF Cohort Analysis', skip: false },
  { id: 53211, title: 'TTF Floor Analysis', skip: false },
  { id: 53212, title: 'TTF by Finding Category', skip: false },
  { id: 53213, title: 'TTF Early-Signal Detection', skip: false },
  { id: 53214, title: 'TTF vs Coverage at First Finding', skip: false },
  { id: 53215, title: 'TTF for Zero-Day-like Finds', skip: false },
  { id: 53216, title: 'TTF by Model Size Tier', skip: false },
  { id: 53217, title: 'TTF Human-vs-Agent Splits', skip: false },
  { id: 53218, title: 'TTF Report Card per Target', skip: false },
  { id: 53219, title: 'TTF Anomaly Explanations', skip: false },
  { id: 53220, title: 'TTF-Driven Scope Triage', skip: false },
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
function variance(values) {
  if (!values.length) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return round2(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
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
function cohortOf(h) {
  if (h.cohort) return String(h.cohort);
  const raw = h.startedAt || h.at || h.date || null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

/** Measure how TTF shifts when a target is re-hunted over time (idea 53201). */
export function analyzeTTFAfterReHuntIntervals(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => {
    const raw = h.reHuntIntervalDays ?? h.intervalDays ?? h.daysSinceLastHunt ?? null;
    if (raw === null || raw === undefined) return h.interval || null;
    const days = Number(raw);
    if (!Number.isFinite(days)) return null;
    if (days <= 30) return '30d';
    if (days <= 90) return '90d';
    return '180d';
  });
  const baseline = rows.find(r => r.key === '30d') || rows[0] || null;
  const latest = rows.find(r => r.key === '180d') || rows[rows.length - 1] || null;
  return { rows, count: rows.length, fastest: rows[0] || null, baseline, latest, delta: baseline && latest ? round2(latest.medianTTF - baseline.medianTTF) : 0, summary: `Infinity AI compared TTF across ${rows.length} re-hunt interval(s).` };
}

/** Evaluate which recon tools correlate with faster first findings (idea 53202). */
export function analyzeTTFByReconTool(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.reconTool || h.tool || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, best: rows[0] || null, summary: `Infinity AI compared TTF across ${rows.length} recon tool(s).` };
}

/** Rank the recovery moves that most often unstick a stalled hunt (idea 53203). */
export function buildTTFStallRecoveryPlaybook(records = [], options = {}) {
  const groups = new Map();
  for (const r of records || []) {
    const key = r.move || r.recoveryMove || r.action || null;
    if (!key) continue;
    const g = groups.get(key) || { key, attempts: 0, recovered: 0, minutes: [] };
    g.attempts += 1;
    if (r.recovered === true || r.success === true || r.unstuck === true) g.recovered += 1;
    const m = Number(r.recoveryMinutes ?? r.minutesToRecover ?? NaN);
    if (Number.isFinite(m)) g.minutes.push(m);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, attempts: g.attempts, recovered: g.recovered, recoveryRate: rate(g.recovered, g.attempts), medianRecoveryMinutes: median(g.minutes) })).sort((a, b) => b.recoveryRate - a.recoveryRate || a.medianRecoveryMinutes - b.medianRecoveryMinutes || String(a.key).localeCompare(String(b.key)));
  return { rows, plays: rows, count: rows.length, top: rows[0] || null, best: rows[0] || null, summary: `Infinity AI ranked ${rows.length} stall recovery move(s).` };
}

/** Build live TTF progress context for researchers in flight (idea 53204). */
export function buildTTFGamification(hunts = [], options = {}) {
  const history = (hunts || []).map(ttfOf).filter(v => v !== null);
  const current = Number(options.currentMinutes ?? options.elapsedMinutes ?? 0);
  const p50 = percentile(history, 50);
  const p90 = percentile(history, 90);
  let percentileRank = 0;
  if (history.length && current > 0) percentileRank = rate(history.filter(v => v >= current).length, history.length);
  const ring = p90 ? Math.min(1, round2(current / p90)) : 0;
  let status = 'on-track';
  if (p50 && current > p90) status = 'behind';
  else if (p50 && current > p50) status = 'pressing';
  const badges = [];
  if (current > 0 && p50 && current <= p50) badges.push('ahead-of-median');
  if (percentileRank >= 0.9) badges.push('top-decile-pace');
  return { count: history.length, sampleSize: history.length, currentMinutes: current, median: p50, p90, ring, progress: ring, percentileRank, status, badges, cards: [{ key: 'progress-ring', ring, status }], summary: `Infinity AI gamified TTF at ${current} minute(s); pace status ${status}.` };
}

/** Translate TTF into cost-per-finding pricing guidance (idea 53205). */
export function estimateTTFAdjustedPricing(hunts = [], options = {}) {
  const hourlyRate = Number(options.hourlyRate ?? options.ratePerHour ?? 50);
  const rows = medianTTFByGroup(hunts, h => h.strategy || h.targetClass || null).map(g => {
    const hours = g.medianTTF / 60;
    const costPerHunt = round2(hours * hourlyRate);
    const costPerFinding = g.findingsPerHunt ? round2(costPerHunt / g.findingsPerHunt) : costPerHunt;
    return { ...g, costPerHunt, costPerFinding };
  }).sort((a, b) => a.costPerFinding - b.costPerFinding || String(a.key).localeCompare(String(b.key)));
  const overallValues = (hunts || []).map(ttfOf).filter(v => v !== null);
  const medianTTF = median(overallValues);
  const costPerHunt = round2((medianTTF / 60) * hourlyRate);
  return { rows, count: rows.length, cheapest: rows[0] || null, best: rows[0] || null, medianTTF, hourlyRate, costPerHunt, summary: `Infinity AI priced hunts at ${costPerHunt} per median hunt using TTF.` };
}

/** Compare time to first finding across prompt templates (idea 53206). */
export function compareTTFByPromptTemplate(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.promptTemplate || h.template || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, best: rows[0] || null, summary: `Infinity AI compared TTF across ${rows.length} prompt template(s).` };
}

/** Treat rising TTF variance as a hunt-quality health signal (idea 53207). */
export function assessTTFVarianceHealth(records = [], options = {}) {
  const threshold = Number(options.varianceThreshold ?? options.threshold ?? 100);
  const groups = new Map();
  for (const r of records || []) {
    const key = r.strategy || 'overall';
    const ttf = ttfOf(r);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push(ttf);
    groups.set(key, g);
  }
  const rows = [...groups.entries()].map(([key, values]) => {
    const v = variance(values);
    return { key, hunts: values.length, sampleSize: values.length, variance: v, stdDev: round2(Math.sqrt(v)), medianTTF: median(values), healthy: v <= threshold };
  }).sort((a, b) => b.variance - a.variance || String(a.key).localeCompare(String(b.key)));
  const unhealthy = rows.filter(r => !r.healthy);
  return { rows, count: rows.length, unhealthy, alertCount: unhealthy.length, threshold, worst: rows[0] || null, summary: `Infinity AI flagged TTF variance risk in ${unhealthy.length} of ${rows.length} group(s).` };
}

/** Track time to first chained finding separately (idea 53208). */
export function analyzeTTFForChainedFindings(hunts = [], options = {}) {
  const chained = [];
  const standalone = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    if (h.chained === true || h.isChained === true || h.findingKind === 'chained') chained.push(ttf);
    else standalone.push(ttf);
  }
  const chainedMedian = median(chained);
  const standaloneMedian = median(standalone);
  return { chainedMedian, standaloneMedian, chainedCount: chained.length, standaloneCount: standalone.length, count: chained.length + standalone.length, delta: round2(chainedMedian - standaloneMedian), summary: `Infinity AI measured chained-finding TTF at ${chainedMedian} minute(s) versus ${standaloneMedian} standalone.` };
}

/** Control for latency and rate-limit effects on TTF (idea 53209). */
export function analyzeTTFByNetworkConditions(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => {
    if (h.networkCondition) return String(h.networkCondition);
    const latency = Number(h.latencyMs ?? h.avgLatencyMs ?? NaN);
    if (!Number.isFinite(latency)) return null;
    if (latency < 100) return 'fast';
    if (latency < 300) return 'normal';
    return 'throttled';
  });
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} network condition(s).` };
}

/** Group hunts by month to see fleet-wide TTF trends (idea 53210). */
export function analyzeTTFCohorts(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => cohortOf(h));
  const sorted = [...rows].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;
  return { rows: sorted, cohorts: sorted, count: sorted.length, first, last, latest: last, trend: first && last ? round2(last.medianTTF - first.medianTTF) : 0, summary: `Infinity AI analyzed TTF across ${sorted.length} monthly cohort(s).` };
}

/** Estimate the theoretical minimum TTF per target class (idea 53211). */
export function analyzeTTFFloor(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.targetClass || h.targetType || 'overall';
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push(ttf);
    groups.set(key, g);
  }
  const rows = [...groups.entries()].map(([key, values]) => ({ key, hunts: values.length, sampleSize: values.length, floor: values.length ? Math.min(...values) : 0, p10: percentile(values, 10), medianTTF: median(values) })).sort((a, b) => a.floor - b.floor || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, lowest: rows[0] || null, best: rows[0] || null, summary: `Infinity AI estimated TTF floors for ${rows.length} target class(es).` };
}

/** Benchmark time to first finding by finding category (idea 53212). */
export function analyzeTTFByFindingCategory(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.findingCategory || h.category || h.firstFindingCategory || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} finding categor(ies).` };
}

/** Identify the earliest telemetry signals before first findings (idea 53213). */
export function detectTTFEarlySignals(events = [], options = {}) {
  const groups = new Map();
  for (const e of events || []) {
    const hunts = Array.isArray(e.signals) ? e.signals.map(s => ({ signal: s, lead: e })) : null;
    const list = hunts || [e];
    for (const item of list) {
      const key = item.signal || item.signalType || item.type || null;
      if (!key) continue;
      const g = groups.get(key) || { key, occurrences: 0, withFinding: 0, leadValues: [] };
      g.occurrences += 1;
      const source = item.lead || item;
      if (source.precededFinding === true || source.hadFinding === true || findingsOf(source) > 0 || source) g.withFinding += 1;
      const lead = Number(source.leadMinutes ?? source.minutesBeforeFinding ?? NaN);
      if (Number.isFinite(lead)) g.leadValues.push(lead);
      groups.set(key, g);
    }
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, occurrences: g.occurrences, withFinding: g.withFinding, precision: rate(g.withFinding, g.occurrences), medianLeadMinutes: median(g.leadValues) })).sort((a, b) => b.precision - a.precision || b.occurrences - a.occurrences || String(a.key).localeCompare(String(b.key)));
  return { rows, signals: rows, count: rows.length, strongest: rows[0] || null, best: rows[0] || null, summary: `Infinity AI detected ${rows.length} early TTF signal type(s).` };
}

/** Record how much of the target was covered at first finding (idea 53214). */
export function analyzeTTFVsCoverageAtFirstFinding(hunts = [], options = {}) {
  const entries = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    const coverage = Number(h.coverageAtFirstFinding ?? h.coverageAtFinding ?? h.coveragePct ?? NaN);
    if (ttf === null || !Number.isFinite(coverage)) continue;
    entries.push({ ttf, coverage });
  }
  let correlation = 0;
  if (entries.length >= 2) {
    const meanX = entries.reduce((s, e) => s + e.ttf, 0) / entries.length;
    const meanY = entries.reduce((s, e) => s + e.coverage, 0) / entries.length;
    let num = 0; let denX = 0; let denY = 0;
    for (const e of entries) { num += (e.ttf - meanX) * (e.coverage - meanY); denX += (e.ttf - meanX) ** 2; denY += (e.coverage - meanY) ** 2; }
    correlation = denX && denY ? round2(num / Math.sqrt(denX * denY)) : 0;
  }
  const rows = [
    { key: 'low', hunts: entries.filter(e => e.coverage < 0.33).length },
    { key: 'medium', hunts: entries.filter(e => e.coverage >= 0.33 && e.coverage < 0.66).length },
    { key: 'high', hunts: entries.filter(e => e.coverage >= 0.66).length },
  ];
  return { rows, count: entries.length, sampleSize: entries.length, correlation, medianTTF: median(entries.map(e => e.ttf)), medianCoverage: median(entries.map(e => e.coverage)), meanCoverage: mean(entries.map(e => e.coverage)), summary: `Infinity AI correlated TTF with coverage at first finding across ${entries.length} hunt(s).` };
}

/** Track genuinely novel findings separately from known patterns (idea 53215). */
export function analyzeTTFForZeroDayLikeFinds(hunts = [], options = {}) {
  const novel = [];
  const known = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    if (h.novel === true || h.zeroDayLike === true || h.findingNovelty === 'novel') novel.push(ttf);
    else known.push(ttf);
  }
  const novelMedian = median(novel);
  const knownMedian = median(known);
  return { novelMedian, knownMedian, novelCount: novel.length, knownCount: known.length, count: novel.length + known.length, delta: round2(novelMedian - knownMedian), summary: `Infinity AI measured novel-finding TTF at ${novelMedian} minute(s) versus ${knownMedian} for known patterns.` };
}

/** Compare time to first finding across model size tiers (idea 53216). */
export function analyzeTTFByModelTier(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.modelTier || h.modelSizeTier || h.modelSize || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, best: rows[0] || null, summary: `Infinity AI compared TTF across ${rows.length} model tier(s).` };
}

/** Attribute collaborative-hunt TTF to human versus agent actions (idea 53217). */
export function splitTTFHumanVsAgent(hunts = [], options = {}) {
  let humanMinutes = 0;
  let agentMinutes = 0;
  let totalTTF = 0;
  let counted = 0;
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    counted += 1;
    totalTTF += ttf;
    humanMinutes += Number(h.humanMinutes ?? h.humanTTFMinutes ?? 0);
    agentMinutes += Number(h.agentMinutes ?? h.agentTTFMinutes ?? 0);
  }
  if (!humanMinutes && !agentMinutes && counted) { agentMinutes = totalTTF; }
  const splitTotal = humanMinutes + agentMinutes;
  return { humanMinutes: round2(humanMinutes), agentMinutes: round2(agentMinutes), totalMinutes: round2(splitTotal || totalTTF), count: counted, hunts: counted, humanShare: splitTotal ? rate(humanMinutes, splitTotal) : 0, agentShare: splitTotal ? rate(agentMinutes, splitTotal) : 0, summary: `Infinity AI split TTF across ${counted} collaborative hunt(s); agent drove ${splitTotal ? rate(agentMinutes, splitTotal) : 0} of pre-finding time.` };
}

/** Give repeat targets a TTF report card over time (idea 53218). */
export function buildTTFReportCardPerTarget(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.target || h.targetKey || h.host || null;
    if (!key) continue;
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push({ at: h.at || h.startedAt || h.date || '', ttf });
    groups.set(key, g);
  }
  const cards = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const values = sorted.map(x => x.ttf);
    const firstTTF = values.length ? values[0] : 0;
    const latestTTF = values.length ? values[values.length - 1] : 0;
    const delta = round2(latestTTF - firstTTF);
    const grade = delta <= -10 ? 'improving' : delta >= 10 ? 'hardening' : 'stable';
    return { key, target: key, hunts: values.length, sampleSize: values.length, medianTTF: median(values), firstTTF, latestTTF, delta, grade };
  }).sort((a, b) => a.delta - b.delta || String(a.key).localeCompare(String(b.key)));
  return { rows: cards, cards, count: cards.length, mostImproved: cards[0] || null, top: cards[0] || null, summary: `Infinity AI issued TTF report cards for ${cards.length} target(s).` };
}

/** Explain hunts whose TTF deviates sharply from baseline (idea 53219). */
export function explainTTFAnomalies(hunts = [], options = {}) {
  const thresholdPct = Number(options.thresholdPct ?? options.threshold ?? 2);
  const values = (hunts || []).map(ttfOf).filter(v => v !== null);
  const baseline = median(values);
  const rows = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null || !baseline) continue;
    const ratio = round2(ttf / baseline);
    if (ratio < thresholdPct && ratio > (1 / thresholdPct || 0)) continue;
    const direction = ratio >= thresholdPct ? 'slow' : 'fast';
    const reason = h.reason || h.anomalyReason || (direction === 'slow' ? 'TTF far above baseline; review recon and stall points.' : 'TTF far below baseline; capture the fast path as a playbook.');
    rows.push({ key: h.target || h.strategy || 'hunt', target: h.target || null, strategy: h.strategy || null, ttfMinutes: ttf, baseline, ratio, direction, explanation: `Infinity AI: ${reason}` });
  }
  rows.sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
  return { rows, anomalies: rows, count: values.length, anomalyCount: rows.length, baseline, thresholdPct, worst: rows[0] || null, summary: `Infinity AI explained ${rows.length} TTF anomal(ies) against a ${baseline} minute baseline.` };
}

/** Recommend which in-scope assets to hunt first by predicted TTF (idea 53220). */
export function triageScopeByPredictedTTF(targets = [], options = {}) {
  const history = options.history || [];
  const historyMedian = median((history || []).map(ttfOf).filter(v => v !== null));
  const rows = (targets || []).map(t => {
    const predicted = Number(t.predictedTTF ?? t.predictedTTFMinutes ?? t.estimatedTTF ?? NaN);
    const value = Number.isFinite(predicted) ? predicted : historyMedian;
    const criticality = Number(t.criticality ?? t.businessCriticality ?? 3);
    const score = round2(value - criticality * 2);
    return { key: t.asset || t.target || t.key || 'asset', asset: t.asset || t.target || t.key || 'asset', predictedTTF: round2(value), criticality, score, recommendation: score <= 30 ? 'hunt-first' : score <= 60 ? 'queue' : 'defer' };
  }).sort((a, b) => a.score - b.score || a.predictedTTF - b.predictedTTF || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, first: rows[0] || null, top: rows[0] || null, best: rows[0] || null, historyMedian, summary: `Infinity AI triaged ${rows.length} in-scope asset(s) by predicted TTF.` };
}
