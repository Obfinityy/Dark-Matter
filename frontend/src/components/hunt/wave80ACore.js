/**
 * wave80ACore.js — Infinity AI · Dark-Matter · Wave 80A
 * Strategy remix, briefing, significance, attribution, risk,
 * cold-start, telemetry, replay, coaching, hall of fame, sunset,
 * win-rate alerts, and time-to-first-finding analytics, ideas
 * 53161–53180. Every helper takes explicit inputs, returns a
 * structured view model, and never mutates arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE80_A_IDEAS = [
  { id: 53161, title: 'Strategy Remix Suggestions', skip: false },
  { id: 53162, title: 'Strategy Briefing Cards', skip: false },
  { id: 53163, title: 'Strategy A/B Significance Dashboard', skip: false },
  { id: 53164, title: 'Strategy Win Attribution Notes', skip: false },
  { id: 53165, title: 'Strategy Risk-Adjusted Rankings', skip: false },
  { id: 53166, title: 'Strategy Cold-Start Guide', skip: false },
  { id: 53167, title: 'Strategy Telemetry Schema', skip: false },
  { id: 53168, title: 'Strategy Replay Diffs', skip: false },
  { id: 53169, title: 'Strategy Coaching Prompts', skip: false },
  { id: 53170, title: 'Strategy Hall of Fame', skip: false },
  { id: 53171, title: 'Strategy Sunset Retrospectives', skip: false },
  { id: 53172, title: 'Strategy Win-Rate Alerts', skip: false },
  { id: 53173, title: 'Median Time-to-First-Finding Benchmarks', skip: false },
  { id: 53174, title: 'TTF Percentile Bands', skip: false },
  { id: 53175, title: 'TTF by Authentication State', skip: false },
  { id: 53176, title: 'TTF by Finding Severity', skip: false },
  { id: 53177, title: 'TTF Decomposition', skip: false },
  { id: 53178, title: 'TTF Prediction at Hunt Start', skip: false },
  { id: 53179, title: 'TTF Slip Alerts', skip: false },
  { id: 53180, title: 'TTF Improvement Leaderboard', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function findingsOf(h) { return Number(h.validatedFindings ?? h.findings ?? h.findingsCount ?? 0); }
function isWin(h) { return h.success === true || findingsOf(h) > 0; }
function ttfOf(h) {
  const raw = h.ttfMinutes ?? h.timeToFirstFindingMinutes ?? h.medianTTF ?? h.ttf ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function validTTFs(hunts) {
  return (hunts || []).map(ttfOf).filter(v => v !== null);
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
function groupHunts(hunts, keyFn) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = keyFn(h);
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, wins: 0, findings: 0, requests: 0, ttfValues: [] };
    g.hunts += 1;
    if (isWin(h)) g.wins += 1;
    g.findings += findingsOf(h);
    g.requests += Number(h.requests || 0);
    const ttf = ttfOf(h);
    if (ttf !== null) g.ttfValues.push(ttf);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, winRate: rate(g.wins, g.hunts), findingsPerHunt: g.hunts ? round2(g.findings / g.hunts) : 0, medianTTF: median(g.ttfValues), meanTTF: mean(g.ttfValues) }));
}
function sortByWin(rows) { return rows.sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key))); }
function normalizeStats(stats) {
  return (stats || []).map(s => {
    const hunts = Number(s.hunts ?? s.attempts ?? s.trials ?? 0);
    const wins = Number(s.wins ?? s.successes ?? 0);
    const winRate = s.winRate !== undefined ? Number(s.winRate) : rate(wins, hunts);
    return { key: s.strategy || s.key || s.name || 'strategy', hunts, wins, winRate: round2(winRate), findingTypes: Array.isArray(s.findingTypes) ? [...s.findingTypes] : [] };
  });
}

/** Pair proven strategies into hybrid remix candidates (idea 53161). */
export function suggestStrategyRemixes(stats = [], options = {}) {
  const ranked = normalizeStats(stats).sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  const rows = [];
  for (let i = 0; i + 1 < ranked.length; i += 1) {
    const a = ranked[i];
    const b = ranked[i + 1];
    const types = [...new Set([...a.findingTypes, ...b.findingTypes])].sort();
    rows.push({ key: `${a.key}+${b.key}`, parents: [a.key, b.key], winRate: round2((a.winRate + b.winRate) / 2), diversity: types.length, findingTypes: types });
  }
  rows.sort((a, b) => b.winRate - a.winRate || b.diversity - a.diversity || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, best: rows[0] || null, top: rows[0] || null, summary: `Infinity AI suggested ${rows.length} strategy remix(es) from ${ranked.length} proven strateg(ies).` };
}

/** Build per-strategy briefing cards for hunt leads (idea 53162). */
export function buildStrategyBriefingCards(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.strategy || null)).map(g => ({ ...g, headline: `${g.key}: win rate ${g.winRate} across ${g.hunts} hunt(s), ${g.findingsPerHunt} finding(s) per hunt.` }));
  return { rows, cards: rows, count: rows.length, top: rows[0] || null, best: rows[0] || null, summary: `Infinity AI built briefing cards for ${rows.length} strateg(ies).` };
}

/** Test whether a strategy variant difference is significant (idea 53163). */
export function evaluateStrategyABSignificance(records = [], options = {}) {
  const groups = new Map();
  for (const r of records || []) {
    const key = r.variant || r.arm || r.group || null;
    if (!key) continue;
    const g = groups.get(key) || { key, trials: 0, wins: 0 };
    if (r.trials !== undefined || r.attempts !== undefined) {
      g.trials += Number(r.trials ?? r.attempts ?? 0);
      g.wins += Number(r.wins ?? r.successes ?? 0);
    } else {
      g.trials += 1;
      if (isWin(r)) g.wins += 1;
    }
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, winRate: rate(g.wins, g.trials) })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const control = rows[0] || null;
  const treatment = rows[1] || null;
  let zScore = 0;
  let significant = false;
  if (control && treatment && control.trials > 0 && treatment.trials > 0) {
    const pooled = (control.wins + treatment.wins) / (control.trials + treatment.trials);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / control.trials + 1 / treatment.trials));
    zScore = se ? round2((treatment.winRate - control.winRate) / se) : 0;
    significant = Math.abs(zScore) >= 1.96;
  }
  const delta = control && treatment ? round2(treatment.winRate - control.winRate) : 0;
  return { rows, count: rows.length, control, treatment, delta, zScore, significant, summary: `Infinity AI evaluated A/B significance across ${rows.length} variant(s); z-score ${zScore}, significant: ${significant}.` };
}

/** Attribute fleet wins back to contributing strategies (idea 53164). */
export function writeStrategyWinAttributionNotes(hunts = [], options = {}) {
  const grouped = groupHunts(hunts, h => h.strategy || null);
  const totalWins = grouped.reduce((s, g) => s + g.wins, 0);
  const rows = grouped.map(g => ({ ...g, share: totalWins ? rate(g.wins, totalWins) : 0, note: `${g.key} contributed ${g.wins} of ${totalWins} win(s).` })).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalWins, topContributor: rows[0] || null, best: rows[0] || null, summary: `Infinity AI attributed ${totalWins} win(s) across ${rows.length} strateg(ies).` };
}

/** Rank strategies by return adjusted for outcome volatility (idea 53165). */
export function rankStrategiesRiskAdjusted(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.strategy || null;
    if (!key) continue;
    const g = groups.get(key) || { key, outcomes: [], findings: 0 };
    g.outcomes.push(isWin(h) ? 1 : 0);
    g.findings += findingsOf(h);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => {
    const avg = g.outcomes.reduce((s, v) => s + v, 0) / g.outcomes.length;
    const variance = g.outcomes.reduce((s, v) => s + (v - avg) ** 2, 0) / g.outcomes.length;
    const stdDev = round2(Math.sqrt(variance));
    const score = round2(avg - 0.5 * stdDev);
    return { key: g.key, hunts: g.outcomes.length, wins: g.outcomes.reduce((s, v) => s + v, 0), findings: g.findings, winRate: round2(avg), variance: round2(variance), stdDev, score, riskAdjustedScore: score };
  }).sort((a, b) => b.score - a.score || b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, best: rows[0] || null, top: rows[0] || null, summary: `Infinity AI ranked ${rows.length} strateg(ies) on a risk-adjusted basis.` };
}

/** Guide new strategies from cold start to proven status (idea 53166). */
export function buildStrategyColdStartGuide(stats = [], options = {}) {
  const warmHunts = Number(options.warmHunts || 15);
  const rows = normalizeStats(stats).map(r => {
    const phase = r.hunts < 5 ? 'cold' : r.hunts < warmHunts ? 'warming' : 'proven';
    const nextStep = phase === 'cold' ? 'Run 5 supervised hunts' : phase === 'warming' ? 'Validate across 2 target classes' : 'Scale with monitoring';
    return { ...r, phase, nextStep };
  }).sort((a, b) => a.hunts - b.hunts || String(a.key).localeCompare(String(b.key)));
  const cold = rows.filter(r => r.phase === 'cold');
  const warming = rows.filter(r => r.phase === 'warming');
  const proven = rows.filter(r => r.phase === 'proven');
  return { rows, count: rows.length, coldCount: cold.length, warmingCount: warming.length, provenCount: proven.length, coldest: rows[0] || null, summary: `Infinity AI guided ${rows.length} strateg(ies): ${cold.length} cold, ${warming.length} warming, ${proven.length} proven.` };
}

/** Derive the telemetry schema observed in hunt records (idea 53167). */
export function defineStrategyTelemetrySchema(samples = [], options = {}) {
  const total = (samples || []).length;
  const counts = new Map();
  for (const s of samples || []) {
    for (const field of Object.keys(s || {})) counts.set(field, (counts.get(field) || 0) + 1);
  }
  const fields = [...counts.entries()].map(([field, present]) => ({ field, present, coverage: total ? rate(present, total) : 0, required: total ? (present / total) >= 0.5 : false })).sort((a, b) => String(a.field).localeCompare(String(b.field)));
  const requiredFields = fields.filter(f => f.required).map(f => f.field);
  const optionalFields = fields.filter(f => !f.required).map(f => f.field);
  return { fields, rows: fields, count: fields.length, fieldCount: fields.length, requiredFields, optionalFields, summary: `Infinity AI derived a telemetry schema with ${fields.length} field(s), ${requiredFields.length} required.` };
}

/** Diff consecutive replay outcomes for each strategy (idea 53168). */
export function diffStrategyReplays(replays = [], options = {}) {
  const groups = new Map();
  for (const r of replays || []) {
    const key = r.strategy || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const rows = [];
  for (const [key, list] of groups.entries()) {
    const sorted = [...list].sort((a, b) => String(a.at || a.date || '').localeCompare(String(b.at || b.date || '')));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      rows.push({ key, strategy: key, at: curr.at || curr.date || null, previousWinRate: round2(prev.winRate ?? prev.hitRate ?? 0), winRate: round2(curr.winRate ?? curr.hitRate ?? 0), deltaWinRate: round2(Number(curr.winRate ?? curr.hitRate ?? 0) - Number(prev.winRate ?? prev.hitRate ?? 0)), previousFindings: findingsOf(prev), findings: findingsOf(curr), deltaFindings: findingsOf(curr) - findingsOf(prev) });
    }
  }
  const sortedRows = [...rows].sort((a, b) => Math.abs(b.deltaWinRate) - Math.abs(a.deltaWinRate) || String(a.key).localeCompare(String(b.key)));
  return { rows, diffs: rows, count: rows.length, largestShift: sortedRows[0] || null, summary: `Infinity AI diffed strategy replays into ${rows.length} change(s).` };
}

/** Generate coaching prompts aimed at the weakest strategies (idea 53169). */
export function generateStrategyCoachingPrompts(hunts = [], options = {}) {
  const grouped = groupHunts(hunts, h => h.strategy || null);
  const rows = grouped.map(g => {
    const focus = g.winRate < 0.4 ? 'Improve recon coverage' : g.winRate < 0.7 ? 'Sustain and diversify' : 'Share playbook';
    return { ...g, focus, prompt: `Infinity AI coaching for ${g.key}: ${focus.toLowerCase()} — review ${g.hunts} hunt(s) at win rate ${g.winRate}.` };
  }).sort((a, b) => a.winRate - b.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  return { rows, prompts: rows, count: rows.length, weakest: rows[0] || null, strongest: rows[rows.length - 1] || null, summary: `Infinity AI generated coaching prompts for ${rows.length} strateg(ies).` };
}

/** Induct sustained top performers into the hall of fame (idea 53170). */
export function buildStrategyHallOfFame(stats = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.6);
  const minHunts = Number(options.minHunts || 10);
  const rows = normalizeStats(stats).filter(r => r.winRate >= threshold && r.hunts >= minHunts).sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  return { rows, entries: rows, count: rows.length, champion: rows[0] || null, best: rows[0] || null, threshold, minHunts, summary: `Infinity AI inducted ${rows.length} strateg(ies) into the hall of fame.` };
}

/** Write retrospectives for strategies heading to sunset (idea 53171). */
export function writeStrategySunsetRetrospectives(stats = [], options = {}) {
  const baseline = Number(options.baseline ?? 0.2);
  const minHunts = Number(options.minHunts || 10);
  const rows = normalizeStats(stats).map(r => {
    const sunset = r.winRate < baseline && r.hunts >= minHunts;
    return { ...r, sunset, status: sunset ? 'sunset' : 'active', lesson: sunset ? `Retire ${r.key}: win rate ${r.winRate} below baseline ${baseline} across ${r.hunts} hunt(s).` : `Retain ${r.key} under continued monitoring.` };
  }).sort((a, b) => a.winRate - b.winRate || String(a.key).localeCompare(String(b.key)));
  const retrospectives = rows.filter(r => r.sunset);
  return { rows, retrospectives, count: rows.length, sunsetCount: retrospectives.length, retireCount: retrospectives.length, summary: `Infinity AI wrote sunset retrospectives for ${retrospectives.length} of ${rows.length} strateg(ies).` };
}

/** Alert when a strategy win rate falls sharply (idea 53172). */
export function detectStrategyWinRateAlerts(snapshots = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.2);
  const groups = new Map();
  for (const s of snapshots || []) {
    const key = s.strategy || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(a.at || a.date || '').localeCompare(String(b.at || b.date || '')));
    const firstRate = round2(sorted[0].winRate ?? sorted[0].hitRate ?? 0);
    const lastRate = round2(sorted[sorted.length - 1].winRate ?? sorted[sorted.length - 1].hitRate ?? 0);
    const delta = round2(lastRate - firstRate);
    return { key, points: sorted.length, firstRate, lastRate, delta, alert: delta <= -threshold };
  }).sort((a, b) => a.delta - b.delta || String(a.key).localeCompare(String(b.key)));
  const alerts = rows.filter(r => r.alert);
  return { rows, alerts, count: rows.length, alertCount: alerts.length, threshold, summary: `Infinity AI raised win-rate alerts for ${alerts.length} of ${rows.length} strateg(ies).` };
}

/** Benchmark median time to first finding overall and per strategy (idea 53173). */
export function benchmarkMedianTTF(hunts = [], options = {}) {
  const values = validTTFs(hunts);
  const rows = groupHunts(hunts, h => h.strategy || null).filter(g => g.ttfValues.length > 0).map(g => ({ key: g.key, hunts: g.hunts, sampleSize: g.ttfValues.length, medianTTF: g.medianTTF, meanTTF: g.meanTTF })).sort((a, b) => a.medianTTF - b.medianTTF || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, sampleSize: values.length, median: median(values), mean: mean(values), p25: percentile(values, 25), p75: percentile(values, 75), min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0, fastest: rows[0] || null, summary: `Infinity AI benchmarked median time to first finding at ${median(values)} minute(s) across ${values.length} hunt(s).` };
}

/** Build percentile bands for time to first finding (idea 53174). */
export function buildTTFPercentileBands(hunts = [], options = {}) {
  const values = validTTFs(hunts);
  const bands = [10, 25, 50, 75, 90, 95].map(p => ({ band: `p${p}`, percentile: p, minutes: percentile(values, p) }));
  return { rows: bands, bands, count: values.length, sampleSize: values.length, median: percentile(values, 50), p90: percentile(values, 90), summary: `Infinity AI built TTF percentile bands from ${values.length} hunt(s); median ${percentile(values, 50)} minute(s).` };
}

/** Compare time to first finding by authentication state (idea 53175). */
export function compareTTFByAuthState(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.authState || h.authenticationState || null).filter(g => g.ttfValues.length > 0).map(g => ({ key: g.key, hunts: g.hunts, sampleSize: g.ttfValues.length, medianTTF: g.medianTTF, meanTTF: g.meanTTF })).sort((a, b) => a.medianTTF - b.medianTTF || String(a.key).localeCompare(String(b.key)));
  const fastest = rows[0] || null;
  const slowest = rows[rows.length - 1] || null;
  return { rows, count: rows.length, fastest, slowest, delta: fastest && slowest ? round2(slowest.medianTTF - fastest.medianTTF) : 0, summary: `Infinity AI compared TTF across ${rows.length} authentication state(s).` };
}

/** Compare time to first finding by first-finding severity (idea 53176). */
export function compareTTFByFindingSeverity(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.firstFindingSeverity || h.severity || h.findingSeverity || null).filter(g => g.ttfValues.length > 0).map(g => ({ key: g.key, hunts: g.hunts, sampleSize: g.ttfValues.length, medianTTF: g.medianTTF, meanTTF: g.meanTTF })).sort((a, b) => a.medianTTF - b.medianTTF || String(a.key).localeCompare(String(b.key)));
  const fastest = rows[0] || null;
  const slowest = rows[rows.length - 1] || null;
  return { rows, count: rows.length, fastest, slowest, delta: fastest && slowest ? round2(slowest.medianTTF - fastest.medianTTF) : 0, summary: `Infinity AI compared TTF across ${rows.length} severity level(s).` };
}

/** Break time to first finding into hunt phases (idea 53177). */
export function decomposeTTF(hunts = [], options = {}) {
  const phases = ['recon', 'probing', 'confirmation'];
  const totals = { recon: 0, probing: 0, confirmation: 0 };
  let used = 0;
  for (const h of hunts || []) {
    const pt = h.phaseTimes || {};
    const values = { recon: Number(pt.recon ?? h.reconMinutes ?? 0), probing: Number(pt.probing ?? h.probingMinutes ?? 0), confirmation: Number(pt.confirmation ?? h.confirmationMinutes ?? 0) };
    if (values.recon + values.probing + values.confirmation <= 0) continue;
    used += 1;
    totals.recon += values.recon;
    totals.probing += values.probing;
    totals.confirmation += values.confirmation;
  }
  const rows = phases.map(phase => ({ phase, totalMinutes: round2(totals[phase]), avgMinutes: used ? round2(totals[phase] / used) : 0 })).map(r => ({ ...r }));
  const totalAvg = rows.reduce((s, r) => s + r.avgMinutes, 0);
  const withShare = rows.map(r => ({ ...r, share: totalAvg ? rate(r.avgMinutes, totalAvg) : 0 })).sort((a, b) => b.avgMinutes - a.avgMinutes || String(a.phase).localeCompare(String(b.phase)));
  return { rows: withShare, phases: withShare, count: used, totalAvgMinutes: round2(totalAvg), dominant: withShare[0] || null, summary: `Infinity AI decomposed TTF across ${used} hunt(s); dominant phase ${withShare[0] ? withShare[0].phase : 'none'}.` };
}

/** Predict time to first finding before a hunt starts (idea 53178). */
export function predictTTFAtHuntStart(features = {}, history = [], options = {}) {
  const all = validTTFs(history);
  let subset = [];
  let basis = 'overall';
  if (features.strategy) {
    subset = validTTFs((history || []).filter(h => h.strategy === features.strategy));
    if (subset.length) basis = 'strategy';
    else subset = [];
  }
  if (!subset.length && features.authState) {
    subset = validTTFs((history || []).filter(h => (h.authState || h.authenticationState) === features.authState));
    if (subset.length) basis = 'authState';
  }
  if (!subset.length) { subset = all; basis = all.length ? 'overall' : 'none'; }
  const predictedMinutes = median(subset);
  const confidence = subset.length >= 10 ? 'high' : subset.length >= 3 ? 'medium' : subset.length ? 'low' : 'none';
  return { predictedMinutes, median: predictedMinutes, basis, sampleSize: subset.length, confidence, summary: `Infinity AI predicted TTF of ${predictedMinutes} minute(s) from ${subset.length} similar hunt(s) (${basis}).` };
}

/** Alert when time to first finding slips upward (idea 53179). */
export function detectTTFSlipAlerts(records = [], options = {}) {
  const threshold = Number(options.thresholdMinutes ?? options.threshold ?? 15);
  const groups = new Map();
  for (const r of records || []) {
    const key = r.strategy || 'overall';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const alerts = [];
  const rows = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(a.at || a.date || '').localeCompare(String(b.at || b.date || '')));
    const values = sorted.map(ttfOf).filter(v => v !== null);
    const firstTTF = values.length ? values[0] : 0;
    const lastTTF = values.length ? values[values.length - 1] : 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = ttfOf(sorted[i - 1]);
      const curr = ttfOf(sorted[i]);
      if (prev === null || curr === null) continue;
      const slip = round2(curr - prev);
      if (slip >= threshold) alerts.push({ key, strategy: key, at: sorted[i].at || sorted[i].date || null, previousTTF: prev, currentTTF: curr, slipMinutes: slip, delta: slip });
    }
    return { key, points: sorted.length, firstTTF, lastTTF, delta: round2(lastTTF - firstTTF) };
  }).sort((a, b) => b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  return { rows, alerts, count: rows.length, alertCount: alerts.length, thresholdMinutes: threshold, summary: `Infinity AI raised TTF slip alerts for ${alerts.length} jump(s) across ${rows.length} strateg(ies).` };
}

/** Rank strategies by time-to-first-finding improvement (idea 53180). */
export function buildTTFImprovementLeaderboard(snapshots = [], options = {}) {
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
    const lastTTF = values.length ? values[values.length - 1] : 0;
    const improvement = round2(firstTTF - lastTTF);
    return { key, points: sorted.length, firstTTF, lastTTF, improvement, improvementPct: firstTTF ? rate(improvement, firstTTF) : 0 };
  }).sort((a, b) => b.improvement - a.improvement || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, mostImproved: rows[0] || null, best: rows[0] || null, summary: `Infinity AI ranked TTF improvement across ${rows.length} strateg(ies).` };
}
