/**
 * wave94BCores.js — Infinity AI · Wave 94B
 * Strategy recommendation engine depth, ideas 53741–53760: recommendation
 * diversity controls, strategy recommendation API, historical precedent
 * citations, counter-recommendation explanations, recommendation performance
 * tracking, seasonal recommendation adjustments, stack-specific strategy
 * maps, industry-tuned recommendations, scope-size strategy scaling,
 * auth-availability conditioning, recommendation freshness, multi-objective
 * recommendations, recommendation override logging, strategy recommendation
 * leaderboards, explainable recommendation models, recommendation bias
 * monitoring, new strategy cold-start boost, recommendation latency budgets,
 * cross-target transfer recommendations, and recommendation confidence
 * calibration.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE94_B_IDEAS = [
  { id: 53741, title: 'Recommendation Diversity Controls', skip: false },
  { id: 53742, title: 'Strategy Recommendation API', skip: false },
  { id: 53743, title: 'Historical Precedent Citations', skip: false },
  { id: 53744, title: 'Counter-Recommendation Explanations', skip: false },
  { id: 53745, title: 'Recommendation Performance Tracking', skip: false },
  { id: 53746, title: 'Seasonal Recommendation Adjustments', skip: false },
  { id: 53747, title: 'Stack-Specific Strategy Maps', skip: false },
  { id: 53748, title: 'Industry-Tuned Recommendations', skip: false },
  { id: 53749, title: 'Scope-Size Strategy Scaling', skip: false },
  { id: 53750, title: 'Auth-Availability Conditioning', skip: false },
  { id: 53751, title: 'Recommendation Freshness', skip: false },
  { id: 53752, title: 'Multi-Objective Recommendations', skip: false },
  { id: 53753, title: 'Recommendation Override Logging', skip: false },
  { id: 53754, title: 'Strategy Recommendation Leaderboards', skip: false },
  { id: 53755, title: 'Explainable Recommendation Models', skip: false },
  { id: 53756, title: 'Recommendation Bias Monitoring', skip: false },
  { id: 53757, title: 'New Strategy Cold-Start Boost', skip: false },
  { id: 53758, title: 'Recommendation Latency Budgets', skip: false },
  { id: 53759, title: 'Cross-Target Transfer Recommendations', skip: false },
  { id: 53760, title: 'Recommendation Confidence Calibration', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.strategyId||it.id||it.name||fb);}

/** Idea 53741 — Recommendation Diversity Controls. Input records: {strategy, assignments, researchers}. Concentration is assignments over researchers; diverse when concentration stays below 2. Prevents the engine from recommending the same strategy to everyone. */
export function controlRecommendationDiversity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const assignments = num(r.assignments, 0);
    const researchers = num(r.researchers, 0);
    const concentration = researchers ? round2(assignments / researchers) : 0;
    return { key: strategy, strategy, assignments, researchers, concentration, diverse: concentration < 2 };
  }).sort((a, b) => a.concentration - b.concentration || String(a.key).localeCompare(String(b.key)));
  const diverseCount = rows.filter(r => r.diverse).length;
  return { rows, count: rows.length, diverseCount, top: rows[0] || null, summary: `Infinity AI controlled recommendation diversity for ${rows.length} strategy record(s); ${diverseCount} are diverse.` };
}
/** Idea 53742 — Strategy Recommendation API. Input records: {endpoint, calls, successes}. API success rate; healthy at >= 0.95. Exposes recommendations to external orchestration tools via API. */
export function exposeStrategyRecommendationApi(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const endpoint = String(r.endpoint || 'endpoint');
    const successRate = rate(num(r.successes ?? r.successfulCalls, 0), num(r.calls, 0));
    return { key: endpoint, endpoint, calls: num(r.calls, 0), successes: num(r.successes ?? r.successfulCalls, 0), successRate, healthy: successRate >= 0.95 };
  }).sort((a, b) => b.successRate - a.successRate || String(a.key).localeCompare(String(b.key)));
  const healthyCount = rows.filter(r => r.healthy).length;
  return { rows, count: rows.length, healthyCount, top: rows[0] || null, summary: `Infinity AI exposed the recommendation API across ${rows.length} endpoint(s); ${healthyCount} are healthy.` };
}
/** Idea 53743 — Historical Precedent Citations. Input records: {strategy, precedents, hunts}. Citation coverage is cited precedents over hunts; cited at >= 0.5. Cites the specific past hunts behind each recommendation. */
export function citeHistoricalPrecedents(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const hunts = num(r.hunts, 0);
    const precedents = num(r.precedents ?? r.citations, 0);
    const citationRate = rate(precedents, hunts);
    return { key: strategy, strategy, hunts, precedents, citationRate, cited: citationRate >= 0.5 };
  }).sort((a, b) => b.citationRate - a.citationRate || String(a.key).localeCompare(String(b.key)));
  const citedCount = rows.filter(r => r.cited).length;
  return { rows, count: rows.length, citedCount, top: rows[0] || null, summary: `Infinity AI cited historical precedents for ${rows.length} strategy record(s); ${citedCount} are cited.` };
}
/** Idea 53744 — Counter-Recommendation Explanations. Input records: {strategy, reason}. Explained when a plain-language reason is present. Explains which strategies were not recommended and why. */
export function explainCounterRecommendations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const reason = String(r.reason || r.explanation || '');
    return { key: strategy, strategy, reason, explained: reason.length > 0 };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const explainedCount = rows.filter(r => r.explained).length;
  return { rows, count: rows.length, explainedCount, top: rows[0] || null, summary: `Infinity AI explained counter-recommendations for ${rows.length} strategy record(s); ${explainedCount} are explained.` };
}
/** Idea 53745 — Recommendation Performance Tracking. Input records: {strategy, recommendedWins, recommendedRuns, baselineWins, baselineRuns}. Lift over baseline; outperforming at lift > 0. Tracks whether recommended strategies actually outperformed alternatives. */
export function trackRecommendationPerformance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const recommendedRate = rate(num(r.recommendedWins, 0), num(r.recommendedRuns, 0));
    const baselineRate = rate(num(r.baselineWins, 0), num(r.baselineRuns, 0));
    const lift = round2(recommendedRate - baselineRate);
    return { key: strategy, strategy, recommendedRate, baselineRate, lift, outperforming: lift > 0 };
  }).sort((a, b) => b.lift - a.lift || String(a.key).localeCompare(String(b.key)));
  const outperformingCount = rows.filter(r => r.outperforming).length;
  return { rows, count: rows.length, outperformingCount, top: rows[0] || null, summary: `Infinity AI tracked recommendation performance for ${rows.length} strategy record(s); ${outperformingCount} outperform.` };
}
/** Idea 53746 — Seasonal Recommendation Adjustments. Input records: {strategy, season, baseScore, seasonalDelta}. Adjusted score applies the seasonal delta; adjusted when a nonzero delta exists. Adjusts recommendations for known seasonal effects like holiday freezes. */
export function adjustSeasonalRecommendations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const season = String(r.season || 'season');
    const baseScore = round2(num(r.baseScore ?? r.score, 0));
    const seasonalDelta = round2(num(r.seasonalDelta ?? r.delta, 0));
    const adjustedScore = round2(baseScore + seasonalDelta);
    return { key: `${strategy}|${season}`, strategy, season, baseScore, seasonalDelta, adjustedScore, adjusted: seasonalDelta !== 0 };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore || String(a.key).localeCompare(String(b.key)));
  const adjustedCount = rows.filter(r => r.adjusted).length;
  return { rows, count: rows.length, adjustedCount, top: rows[0] || null, summary: `Infinity AI adjusted seasonal recommendations for ${rows.length} record(s); ${adjustedCount} are adjusted.` };
}
/** Idea 53747 — Stack-Specific Strategy Maps. Input records: {stack, strategy, wins, runs}. Per-stack win rate; mapped at >= 0.6. Maintains strategy effectiveness maps per technology stack for the engine. */
export function mapStackSpecificStrategies(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const stack = String(r.stack || 'stack');
    const strategy = String(r.strategy || 'strategy');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${stack}|${strategy}`, stack, strategy, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, mapped: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const mappedCount = rows.filter(r => r.mapped).length;
  return { rows, count: rows.length, mappedCount, top: rows[0] || null, summary: `Infinity AI mapped stack-specific strategies across ${rows.length} record(s); ${mappedCount} are mapped.` };
}
/** Idea 53748 — Industry-Tuned Recommendations. Input records: {industry, strategy, wins, runs}. Industry win rate; tuned at >= 0.6. Weights recommendations by industry-specific strategy performance. */
export function tuneIndustryRecommendations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const industry = String(r.industry || 'industry');
    const strategy = String(r.strategy || 'strategy');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${industry}|${strategy}`, industry, strategy, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, tuned: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const tunedCount = rows.filter(r => r.tuned).length;
  return { rows, count: rows.length, tunedCount, top: rows[0] || null, summary: `Infinity AI tuned industry recommendations across ${rows.length} record(s); ${tunedCount} are tuned.` };
}
/** Idea 53749 — Scope-Size Strategy Scaling. Input records: {strategy, scopeSize, intensity}. Intensity per scope unit; scaled when intensity rises with scope. Scales recommended strategy intensity with scope size. */
export function scaleScopeSizeStrategy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const scopeSize = num(r.scopeSize ?? r.scope, 0);
    const intensity = round2(num(r.intensity, 0));
    const intensityPerScope = scopeSize ? round2(intensity / scopeSize) : 0;
    return { key: strategy, strategy, scopeSize, intensity, intensityPerScope, scaled: intensity > 0 && scopeSize > 0 };
  }).sort((a, b) => b.intensity - a.intensity || String(a.key).localeCompare(String(b.key)));
  const scaledCount = rows.filter(r => r.scaled).length;
  return { rows, count: rows.length, scaledCount, top: rows[0] || null, summary: `Infinity AI scaled scope-size strategies for ${rows.length} strategy record(s); ${scaledCount} are scaled.` };
}
/** Idea 53750 — Auth-Availability Conditioning. Input records: {strategy, authAvailable, runs, wins}. Win rate conditioned on credential availability; conditioned when the flag is recorded. Conditions recommendations on whether credentials are available. */
export function conditionOnAuthAvailability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const authAvailable = Boolean(r.authAvailable);
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${strategy}|${authAvailable ? 'auth' : 'noauth'}`, strategy, authAvailable, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, conditioned: true };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const authCount = rows.filter(r => r.authAvailable).length;
  return { rows, count: rows.length, authCount, conditionedCount: rows.length, top: rows[0] || null, summary: `Infinity AI conditioned recommendations on auth availability for ${rows.length} record(s); ${authCount} have credentials.` };
}
/** Idea 53751 — Recommendation Freshness. Input records: {strategy, daysSinceValidation, wins, runs}. Freshness decays with age; fresh within 90 days. Prioritizes strategies validated by recent hunts over historically good but stale ones. */
export function prioritizeRecommendationFreshness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const daysSinceValidation = num(r.daysSinceValidation ?? r.ageDays, 0);
    const freshness = round2(clamp01(1 - daysSinceValidation / 365));
    return { key: strategy, strategy, daysSinceValidation, freshness, fresh: daysSinceValidation <= 90, winRate: rate(num(r.wins, 0), num(r.runs, 0)) };
  }).sort((a, b) => b.freshness - a.freshness || String(a.key).localeCompare(String(b.key)));
  const freshCount = rows.filter(r => r.fresh).length;
  return { rows, count: rows.length, freshCount, top: rows[0] || null, summary: `Infinity AI prioritized recommendation freshness for ${rows.length} strategy record(s); ${freshCount} are fresh.` };
}
/** Idea 53752 — Multi-Objective Recommendations. Input records: {strategy, findings, speed, stealth, coverage}. Balanced score averages the four objectives; balanced at >= 0.6. Balances findings, speed, stealth, and coverage per researcher priorities. */
export function balanceMultiObjectiveRecommendations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const findings = round2(clamp01(r.findings));
    const speed = round2(clamp01(r.speed));
    const stealth = round2(clamp01(r.stealth));
    const coverage = round2(clamp01(r.coverage));
    const balancedScore = mean([findings, speed, stealth, coverage]);
    return { key: strategy, strategy, findings, speed, stealth, coverage, balancedScore, balanced: balancedScore >= 0.6 };
  }).sort((a, b) => b.balancedScore - a.balancedScore || String(a.key).localeCompare(String(b.key)));
  const balancedCount = rows.filter(r => r.balanced).length;
  return { rows, count: rows.length, balancedCount, top: rows[0] || null, summary: `Infinity AI balanced multi-objective recommendations for ${rows.length} strategy record(s); ${balancedCount} are balanced.` };
}
/** Idea 53753 — Recommendation Override Logging. Input records: {researcher, overridden, overrideWins}. Override win rate; winning overrides at >= 0.5. Logs when researchers override recommendations and whether overrides won. */
export function logRecommendationOverrides(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const overridden = num(r.overridden ?? r.overrides, 0);
    const overrideWins = num(r.overrideWins ?? r.wins, 0);
    const winRate = rate(overrideWins, overridden);
    return { key: researcher, researcher, overridden, overrideWins, winRate, winning: winRate >= 0.5 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const winningCount = rows.filter(r => r.winning).length;
  const totalOverrides = rows.reduce((s, r) => s + r.overridden, 0);
  return { rows, count: rows.length, winningCount, totalOverrides, top: rows[0] || null, summary: `Infinity AI logged recommendation overrides for ${rows.length} researcher(s); ${winningCount} win with overrides.` };
}
/** Idea 53754 — Strategy Recommendation Leaderboards. Input records: {cohort, recommendations, wins}. Leaderboard ranks cohorts by recommendation win rate. Ranks recommendation quality by researcher cohort. */
export function rankStrategyRecommendationLeaderboards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const cohort = String(r.cohort || 'cohort');
    const winRate = rate(num(r.wins, 0), num(r.recommendations ?? r.runs, 0));
    return { key: cohort, cohort, recommendations: num(r.recommendations ?? r.runs, 0), wins: num(r.wins, 0), winRate, leading: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const leadingCount = rows.filter(r => r.leading).length;
  return { rows, count: rows.length, leadingCount, top: rows[0] || null, summary: `Infinity AI ranked recommendation leaderboards across ${rows.length} cohort(s); ${leadingCount} lead.` };
}
/** Idea 53755 — Explainable Recommendation Models. Input records: {strategy, features, topFeature}. Interpretability share keeps named drivers visible; explainable when at least one top feature is recorded. Uses interpretable models so recommendations can be audited. */
export function explainRecommendationModels(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const features = Array.isArray(r.features) ? r.features.map(f => String(f)) : [];
    const topFeature = String(r.topFeature || features[0] || '');
    return { key: strategy, strategy, featureCount: features.length, features, topFeature, explainable: topFeature.length > 0 };
  }).sort((a, b) => b.featureCount - a.featureCount || String(a.key).localeCompare(String(b.key)));
  const explainableCount = rows.filter(r => r.explainable).length;
  return { rows, count: rows.length, explainableCount, top: rows[0] || null, summary: `Infinity AI kept recommendation models explainable for ${rows.length} strategy record(s); ${explainableCount} are explainable.` };
}
/** Idea 53756 — Recommendation Bias Monitoring. Input records: {strategy, share}. Dominance share per strategy; biased when one strategy takes half or more of all recommendations. Monitors the engine for bias toward particular strategies or target types. */
export function monitorRecommendationBias(records = []) {
  const total = (Array.isArray(records) ? records : []).reduce((s, r) => s + num(r.assignments ?? r.count, 0), 0);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const assignments = num(r.assignments ?? r.count, 0);
    const share = total ? round2(assignments / total) : 0;
    return { key: strategy, strategy, assignments, share, biased: share >= 0.5 };
  }).sort((a, b) => b.share - a.share || String(a.key).localeCompare(String(b.key)));
  const biasedCount = rows.filter(r => r.biased).length;
  return { rows, count: rows.length, biasedCount, total, top: rows[0] || null, summary: `Infinity AI monitored recommendation bias across ${rows.length} strategy record(s); ${biasedCount} dominate.` };
}
/** Idea 53757 — New Strategy Cold-Start Boost. Input records: {strategy, hunts, explorationBudget}. Boost share is exploration budget over hunts; boosted when a new strategy still receives exploration allocation. Gives new strategies exploration budget in recommendations to gather data. */
export function boostNewStrategyColdStart(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const hunts = num(r.hunts, 0);
    const explorationBudget = num(r.explorationBudget ?? r.budget, 0);
    const isNew = hunts < 10;
    return { key: strategy, strategy, hunts, explorationBudget, isNew, boosted: isNew && explorationBudget > 0 };
  }).sort((a, b) => a.hunts - b.hunts || String(a.key).localeCompare(String(b.key)));
  const boostedCount = rows.filter(r => r.boosted).length;
  return { rows, count: rows.length, boostedCount, newCount: rows.filter(r => r.isNew).length, top: rows[0] || null, summary: `Infinity AI boosted new strategies for ${rows.length} strategy record(s); ${boostedCount} receive exploration budget.` };
}
/** Idea 53758 — Recommendation Latency Budgets. Input records: {strategy, latencyMs, budgetMs}. Within budget when latency stays at or below budget; fast at <= 200ms. Ensures recommendations return fast enough for real-time hunt planning. */
export function budgetRecommendationLatency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const latencyMs = num(r.latencyMs ?? r.latency, 0);
    const budgetMs = num(r.budgetMs ?? r.budget, 200);
    return { key: strategy, strategy, latencyMs, budgetMs, withinBudget: latencyMs <= budgetMs, fast: latencyMs > 0 && latencyMs <= 200 };
  }).sort((a, b) => a.latencyMs - b.latencyMs || String(a.key).localeCompare(String(b.key)));
  const withinBudgetCount = rows.filter(r => r.withinBudget).length;
  return { rows, count: rows.length, withinBudgetCount, fastCount: rows.filter(r => r.fast).length, top: rows[0] || null, summary: `Infinity AI checked recommendation latency budgets for ${rows.length} strategy record(s); ${withinBudgetCount} are within budget.` };
}
/** Idea 53759 — Cross-Target Transfer Recommendations. Input records: {sourceTarget, targetId, strategy, similarity}. Transfer score follows similarity; transferable at >= 0.7. Recommends strategies that worked on similar targets elsewhere. */
export function recommendCrossTargetTransfers(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const similarity = round2(clamp01(r.similarity ?? r.score));
    return { key: `${String(r.sourceTarget || 'source')}|${String(r.targetId || r.target || 'target')}|${strategy}`, strategy, sourceTarget: String(r.sourceTarget || 'source'), targetId: String(r.targetId || r.target || 'target'), similarity, transferable: similarity >= 0.7 };
  }).sort((a, b) => b.similarity - a.similarity || String(a.key).localeCompare(String(b.key)));
  const transferableCount = rows.filter(r => r.transferable).length;
  return { rows, count: rows.length, transferableCount, top: rows[0] || null, summary: `Infinity AI recommended cross-target transfers for ${rows.length} record(s); ${transferableCount} are transferable.` };
}
/** Idea 53760 — Recommendation Confidence Calibration. Input records: {strategy, predictedConfidence, actualRate}. Calibration error is absolute gap; calibrated when error stays below 0.1. Calibrates confidence scores against actual recommendation success rates. */
export function calibrateRecommendationConfidence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const predictedConfidence = round2(clamp01(r.predictedConfidence ?? r.predicted));
    const actualRate = round2(clamp01(r.actualRate ?? r.actual));
    const calibrationError = round2(Math.abs(predictedConfidence - actualRate));
    return { key: strategy, strategy, predictedConfidence, actualRate, calibrationError, calibrated: calibrationError < 0.1 };
  }).sort((a, b) => a.calibrationError - b.calibrationError || String(a.key).localeCompare(String(b.key)));
  const calibratedCount = rows.filter(r => r.calibrated).length;
  return { rows, count: rows.length, calibratedCount, averageError: mean(rows.map(r => r.calibrationError)), top: rows[0] || null, summary: `Infinity AI calibrated recommendation confidence for ${rows.length} strategy record(s); ${calibratedCount} are calibrated.` };
}
