/**
 * wave94ACore.js — Infinity AI · Wave 94A
 * Prompt governance and strategy recommendations (part A), ideas 53721–53740:
 * prompt uncertainty expression, prompt collaboration instructions, prompt
 * ethical guardrails, prompt performance attribution, prompt lifecycle
 * management, prompt knowledge cutoff notes, prompt multilingual variants,
 * prompt accessibility reviews, annual prompt effectiveness review,
 * target-profile strategy matching, confidence-scored recommendations,
 * recommendation explanation cards, strategy recommendation feedback,
 * cold-start strategy defaults, dynamic mid-hunt re-recommendation,
 * researcher-style adaptation, strategy sequencing plans, risk-tolerance
 * settings, time-budget-aware recommendations, and team strategy coordination.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE94_A_IDEAS = [
  { id: 53721, title: 'Prompt Uncertainty Expression', skip: false },
  { id: 53722, title: 'Prompt Collaboration Instructions', skip: false },
  { id: 53723, title: 'Prompt Ethical Guardrails', skip: false },
  { id: 53724, title: 'Prompt Performance Attribution', skip: false },
  { id: 53725, title: 'Prompt Lifecycle Management', skip: false },
  { id: 53726, title: 'Prompt Knowledge Cutoff Notes', skip: false },
  { id: 53727, title: 'Prompt Multilingual Variants', skip: false },
  { id: 53728, title: 'Prompt Accessibility Reviews', skip: false },
  { id: 53729, title: 'Annual Prompt Effectiveness Review', skip: false },
  { id: 53730, title: 'Target-Profile Strategy Matching', skip: false },
  { id: 53731, title: 'Confidence-Scored Recommendations', skip: false },
  { id: 53732, title: 'Recommendation Explanation Cards', skip: false },
  { id: 53733, title: 'Strategy Recommendation Feedback', skip: false },
  { id: 53734, title: 'Cold-Start Strategy Defaults (learning)', skip: false },
  { id: 53735, title: 'Dynamic Mid-Hunt Re-Recommendation', skip: false },
  { id: 53736, title: 'Researcher-Style Adaptation', skip: false },
  { id: 53737, title: 'Strategy Sequencing Plans', skip: false },
  { id: 53738, title: 'Risk-Tolerance Settings', skip: false },
  { id: 53739, title: 'Time-Budget-Aware Recommendations', skip: false },
  { id: 53740, title: 'Team Strategy Coordination', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.promptId||it.strategyId||it.id||it.name||fb);}

/** Idea 53721 — Prompt Uncertainty Expression. Input records: {promptId, uncertainCases, expressed}. Expression rate is expressed over uncertain cases; expressive at >= 0.8. Trains prompts to make the agent express uncertainty instead of bluffing. */
export function expressPromptUncertainty(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const uncertainCases = num(r.uncertainCases ?? r.cases, 0);
    const expressed = num(r.expressed, 0);
    const expressionRate = rate(expressed, uncertainCases);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), uncertainCases, expressed, expressionRate, expressive: expressionRate >= 0.8 };
  }).sort((a, b) => b.expressionRate - a.expressionRate || String(a.key).localeCompare(String(b.key)));
  const expressiveCount = rows.filter(r => r.expressive).length;
  return { rows, count: rows.length, expressiveCount, top: rows[0] || null, summary: `Infinity AI trained uncertainty expression for ${rows.length} prompt(s); ${expressiveCount} express uncertainty reliably.` };
}
/** Idea 53722 — Prompt Collaboration Instructions. Input records: {promptId, hunts, collaborativeHunts, wins}. Collaboration rate and win rate; collaborative at rate >= 0.5. Optimizes prompts for human-agent collaborative hunts. */
export function instructPromptCollaboration(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const hunts = num(r.hunts, 0);
    const collaborativeHunts = num(r.collaborativeHunts ?? r.collaborative, 0);
    const collaborationRate = rate(collaborativeHunts, hunts);
    const winRate = rate(num(r.wins, 0), hunts);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), hunts, collaborativeHunts, collaborationRate, winRate, collaborative: collaborationRate >= 0.5 };
  }).sort((a, b) => b.collaborationRate - a.collaborationRate || String(a.key).localeCompare(String(b.key)));
  const collaborativeCount = rows.filter(r => r.collaborative).length;
  return { rows, count: rows.length, collaborativeCount, top: rows[0] || null, summary: `Infinity AI tuned collaboration instructions for ${rows.length} prompt(s); ${collaborativeCount} are collaborative.` };
}
/** Idea 53723 — Prompt Ethical Guardrails. Input records: {promptId, checks, violations}. Violation rate; guarded when rate < 0.05. Embeds scope and ethics reminders tuned to actually reduce violations. */
export function guardPromptEthics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const checks = num(r.checks, 0);
    const violations = num(r.violations, 0);
    const violationRate = rate(violations, checks);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), checks, violations, violationRate, guarded: violationRate < 0.05 };
  }).sort((a, b) => a.violationRate - b.violationRate || String(a.key).localeCompare(String(b.key)));
  const guardedCount = rows.filter(r => r.guarded).length;
  return { rows, count: rows.length, guardedCount, top: rows[0] || null, summary: `Infinity AI checked ethical guardrails for ${rows.length} prompt(s); ${guardedCount} are guarded.` };
}
/** Idea 53724 — Prompt Performance Attribution. Input records: {promptId, changeId, uplift, hunts}. Uplift per change; strong attribution at uplift >= 0.1. Attributes outcome improvements to specific prompt changes, not just versions. */
export function attributePromptPerformance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const changeId = String(r.changeId || r.change || 'change');
    const uplift = round2(num(r.uplift, 0));
    return { key: `${promptId}|${changeId}`, promptId, changeId, uplift, hunts: num(r.hunts, 0), strong: uplift >= 0.1 };
  }).sort((a, b) => b.uplift - a.uplift || String(a.key).localeCompare(String(b.key)));
  const strongCount = rows.filter(r => r.strong).length;
  return { rows, count: rows.length, strongCount, top: rows[0] || null, summary: `Infinity AI attributed prompt performance across ${rows.length} change(s); ${strongCount} show strong uplift.` };
}
/** Idea 53725 — Prompt Lifecycle Management. Input records: {promptId, stage, daysInStage}. Lifecycle stage distribution; production-ready when stage is production. Defines the full lifecycle from draft to production to retirement for prompts. */
export function managePromptLifecycle(records = []) {
  const stageOrder = { draft: 0, review: 1, staging: 2, production: 3, retirement: 4 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const stage = String(r.stage || 'draft').toLowerCase();
    const order = stageOrder[stage] !== undefined ? stageOrder[stage] : 0;
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), stage, order, daysInStage: num(r.daysInStage, 0), productionReady: stage === 'production' };
  }).sort((a, b) => b.order - a.order || String(a.key).localeCompare(String(b.key)));
  const productionCount = rows.filter(r => r.productionReady).length;
  const stageCounts = {};
  for (const row of rows) stageCounts[row.stage] = (stageCounts[row.stage] || 0) + 1;
  return { rows, count: rows.length, productionCount, stageCounts, top: rows[0] || null, summary: `Infinity AI managed prompt lifecycle for ${rows.length} prompt(s); ${productionCount} are in production.` };
}
/** Idea 53726 — Prompt Knowledge Cutoff Notes. Input records: {promptId, assumptions, documented}. Documentation coverage; documented at >= 0.8. Documents what each prompt assumes the model knows to avoid stale assumptions. */
export function notePromptKnowledgeCutoff(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const assumptions = num(r.assumptions, 0);
    const documented = num(r.documented ?? r.noted, 0);
    const coverage = rate(documented, assumptions);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), assumptions, documented, coverage, documentedEnough: coverage >= 0.8 };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const documentedCount = rows.filter(r => r.documentedEnough).length;
  return { rows, count: rows.length, documentedCount, top: rows[0] || null, summary: `Infinity AI noted knowledge cutoffs for ${rows.length} prompt(s); ${documentedCount} are documented.` };
}
/** Idea 53727 — Prompt Multilingual Variants. Input records: {promptId, language, validated, variants}. Validation rate per language; validated when fully covered. Maintains validated prompt translations for global researcher teams. */
export function managePromptMultilingualVariants(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const language = String(r.language || 'en');
    const variants = num(r.variants, 0);
    const validated = num(r.validated, 0);
    const validationRate = rate(validated, variants);
    return { key: `${promptId}|${language}`, promptId, language, variants, validated, validationRate, ready: validationRate >= 0.8 };
  }).sort((a, b) => b.validationRate - a.validationRate || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI managed multilingual variants across ${rows.length} record(s); ${readyCount} are ready.` };
}
/** Idea 53728 — Prompt Accessibility Reviews. Input records: {promptId, reviewers, understood}. Understanding rate; accessible at >= 0.8. Ensures prompts are understandable by researchers who did not write them. */
export function reviewPromptAccessibility(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const reviewers = num(r.reviewers, 0);
    const understood = num(r.understood, 0);
    const understandingRate = rate(understood, reviewers);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), reviewers, understood, understandingRate, accessible: understandingRate >= 0.8 };
  }).sort((a, b) => b.understandingRate - a.understandingRate || String(a.key).localeCompare(String(b.key)));
  const accessibleCount = rows.filter(r => r.accessible).length;
  return { rows, count: rows.length, accessibleCount, top: rows[0] || null, summary: `Infinity AI reviewed prompt accessibility for ${rows.length} prompt(s); ${accessibleCount} are accessible.` };
}
/** Idea 53729 — Annual Prompt Effectiveness Review. Input records: {promptId, runs, wins}. Yearly win rate; effective at >= 0.6. Yearly review of the entire prompt library against hunt outcomes. */
export function reviewAnnualPromptEffectiveness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, effective: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  const averageWinRate = mean(rows.map(r => r.winRate));
  return { rows, count: rows.length, effectiveCount, averageWinRate, top: rows[0] || null, summary: `Infinity AI ran the annual effectiveness review for ${rows.length} prompt(s); ${effectiveCount} are effective.` };
}
/** Idea 53730 — Target-Profile Strategy Matching. Input records: {targetId, strategy, matchScore}. Best match per target; matched at score >= 0.7. Recommends a starting strategy from target fingerprint, industry, and scope size. */
export function matchTargetProfileStrategy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetId = String(r.targetId || r.target || 'target');
    const strategy = String(r.strategy || 'strategy');
    const matchScore = round2(clamp01(r.matchScore ?? r.score));
    return { key: `${targetId}|${strategy}`, targetId, strategy, industry: String(r.industry || ''), matchScore, matched: matchScore >= 0.7 };
  }).sort((a, b) => b.matchScore - a.matchScore || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, top: rows[0] || null, summary: `Infinity AI matched target profiles across ${rows.length} recommendation(s); ${matchedCount} are strong matches.` };
}
/** Idea 53731 — Confidence-Scored Recommendations. Input records: {strategy, supportingHunts, wins}. Confidence scales with supporting hunt count; confident at >= 20 hunts. Attaches confidence to each strategy recommendation based on supporting hunt count. */
export function scoreRecommendationConfidence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const supportingHunts = num(r.supportingHunts ?? r.hunts, 0);
    const confidence = round2(clamp01(supportingHunts / 50));
    const winRate = rate(num(r.wins, 0), supportingHunts);
    return { key: strategy, strategy, supportingHunts, wins: num(r.wins, 0), confidence, winRate, confident: supportingHunts >= 20 };
  }).sort((a, b) => b.confidence - a.confidence || String(a.key).localeCompare(String(b.key)));
  const confidentCount = rows.filter(r => r.confident).length;
  return { rows, count: rows.length, confidentCount, top: rows[0] || null, summary: `Infinity AI scored confidence for ${rows.length} recommendation(s); ${confidentCount} are confident.` };
}
/** Idea 53732 — Recommendation Explanation Cards. Input records: {strategy, reasons, explanation}. Explanation coverage; explained when an explanation string is present. Explains in plain language why a strategy was recommended for this target. */
export function explainRecommendationCards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const reasons = Array.isArray(r.reasons) ? r.reasons.map(s => String(s)) : [];
    const explanation = String(r.explanation || reasons.join('; '));
    return { key: strategy, strategy, reasonCount: reasons.length, explanation, explained: explanation.length > 0 };
  }).sort((a, b) => b.reasonCount - a.reasonCount || String(a.key).localeCompare(String(b.key)));
  const explainedCount = rows.filter(r => r.explained).length;
  return { rows, count: rows.length, explainedCount, top: rows[0] || null, summary: `Infinity AI built explanation cards for ${rows.length} recommendation(s); ${explainedCount} are explained.` };
}
/** Idea 53733 — Strategy Recommendation Feedback. Input records: {strategy, ratings, positiveRatings}. Feedback score is positive share; well rated at >= 0.7. Lets researchers rate recommendations to improve the engine. */
export function collectStrategyRecommendationFeedback(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const ratings = num(r.ratings, 0);
    const positiveRatings = num(r.positiveRatings ?? r.positive, 0);
    const feedbackScore = rate(positiveRatings, ratings);
    return { key: strategy, strategy, ratings, positiveRatings, feedbackScore, wellRated: feedbackScore >= 0.7 };
  }).sort((a, b) => b.feedbackScore - a.feedbackScore || String(a.key).localeCompare(String(b.key)));
  const wellRatedCount = rows.filter(r => r.wellRated).length;
  return { rows, count: rows.length, wellRatedCount, top: rows[0] || null, summary: `Infinity AI collected recommendation feedback for ${rows.length} strategy record(s); ${wellRatedCount} are well rated.` };
}
/** Idea 53734 — Cold-Start Strategy Defaults (learning). Input records: {targetClass, defaultStrategy, hunts}. Default coverage per class; ready when a default exists. Provides sensible default strategies for target classes with no history. */
export function provideColdStartStrategyDefaults(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetClass = String(r.targetClass || r.className || 'class');
    const defaultStrategy = String(r.defaultStrategy || r.strategy || '');
    const hunts = num(r.hunts, 0);
    return { key: targetClass, targetClass, defaultStrategy, hunts, ready: defaultStrategy.length > 0, coldStart: hunts === 0 };
  }).sort((a, b) => a.hunts - b.hunts || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  const coldStartCount = rows.filter(r => r.coldStart).length;
  return { rows, count: rows.length, readyCount, coldStartCount, top: rows[0] || null, summary: `Infinity AI set cold-start defaults for ${rows.length} target class(es); ${readyCount} are ready.` };
}
/** Idea 53735 — Dynamic Mid-Hunt Re-Recommendation. Input records: {huntId, expectedWins, actualWins}. Divergence drives re-recommendation; triggered when actual falls below half of expected. Re-recommends strategy when hunt telemetry diverges from expectations. */
export function rerecommendMidHuntStrategy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.hunt || 'hunt');
    const expectedWins = num(r.expectedWins ?? r.expected, 0);
    const actualWins = num(r.actualWins ?? r.actual, 0);
    const divergence = expectedWins ? round2((expectedWins - actualWins) / expectedWins) : 0;
    return { key: huntId, huntId, expectedWins, actualWins, divergence, triggered: divergence >= 0.5 };
  }).sort((a, b) => b.divergence - a.divergence || String(a.key).localeCompare(String(b.key)));
  const triggeredCount = rows.filter(r => r.triggered).length;
  return { rows, count: rows.length, triggeredCount, top: rows[0] || null, summary: `Infinity AI checked mid-hunt re-recommendation for ${rows.length} hunt(s); ${triggeredCount} triggered.` };
}
/** Idea 53736 — Researcher-Style Adaptation. Input records: {researcher, strategy, runs, wins}. Per-researcher win rate; adapted when top strategy wins >= 0.6. Adapts recommendations to the individual researcher strengths and past successes. */
export function adaptToResearcherStyle(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const strategy = String(r.strategy || 'strategy');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${researcher}|${strategy}`, researcher, strategy, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, adapted: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const adaptedCount = rows.filter(r => r.adapted).length;
  return { rows, count: rows.length, adaptedCount, top: rows[0] || null, summary: `Infinity AI adapted recommendations to researcher style across ${rows.length} record(s); ${adaptedCount} are adapted.` };
}
/** Idea 53737 — Strategy Sequencing Plans. Input records: {planId, steps, triggers}. Plans ranked by step count; sequenced when at least two ordered steps exist. Recommends not just one strategy but an ordered sequence with switch triggers. */
export function planStrategySequencing(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const planId = String(r.planId || r.plan || 'plan');
    const steps = Array.isArray(r.steps) ? r.steps.map(s => String(s)) : [];
    const triggers = Array.isArray(r.triggers) ? r.triggers.map(s => String(s)) : [];
    return { key: planId, planId, stepCount: steps.length, steps, triggerCount: triggers.length, sequenced: steps.length >= 2 };
  }).sort((a, b) => b.stepCount - a.stepCount || String(a.key).localeCompare(String(b.key)));
  const sequencedCount = rows.filter(r => r.sequenced).length;
  return { rows, count: rows.length, sequencedCount, top: rows[0] || null, summary: `Infinity AI built strategy sequencing plans for ${rows.length} plan(s); ${sequencedCount} are sequenced.` };
}
/** Idea 53738 — Risk-Tolerance Settings. Input records: {researcher, tolerance, strategyRisk}. Alignment keeps strategy risk at or below tolerance; aligned when within tolerance. Lets researchers set risk tolerance that shapes strategy recommendations. */
export function applyRiskToleranceSettings(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const tolerance = round2(clamp01(r.tolerance));
    const strategyRisk = round2(clamp01(r.strategyRisk ?? r.risk));
    return { key: researcher, researcher, tolerance, strategyRisk, aligned: strategyRisk <= tolerance };
  }).sort((a, b) => b.tolerance - a.tolerance || String(a.key).localeCompare(String(b.key)));
  const alignedCount = rows.filter(r => r.aligned).length;
  return { rows, count: rows.length, alignedCount, averageTolerance: mean(rows.map(r => r.tolerance)), top: rows[0] || null, summary: `Infinity AI applied risk-tolerance settings for ${rows.length} researcher(s); ${alignedCount} are aligned.` };
}
/** Idea 53739 — Time-Budget-Aware Recommendations. Input records: {strategy, estimatedHours, budgetHours}. Fits budget when estimate is inside the available hours; efficient at low hour cost. Tailors strategy suggestions to the hours available for the hunt. */
export function recommendWithTimeBudget(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const estimatedHours = round2(num(r.estimatedHours ?? r.hours, 0));
    const budgetHours = round2(num(r.budgetHours ?? r.budget, 0));
    const fitsBudget = budgetHours > 0 && estimatedHours <= budgetHours;
    return { key: strategy, strategy, estimatedHours, budgetHours, fitsBudget, utilization: budgetHours ? round2(estimatedHours / budgetHours) : 0 };
  }).sort((a, b) => a.utilization - b.utilization || String(a.key).localeCompare(String(b.key)));
  const fitsCount = rows.filter(r => r.fitsBudget).length;
  return { rows, count: rows.length, fitsCount, top: rows[0] || null, summary: `Infinity AI tailored time-budget recommendations for ${rows.length} strategy record(s); ${fitsCount} fit the budget.` };
}
/** Idea 53740 — Team Strategy Coordination. Input records: {teamId, strategies}. Diversity is distinct strategy count over team size; coordinated when assignments differ per researcher. Recommends complementary strategies when multiple researchers hunt related targets. */
export function coordinateTeamStrategy(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const teamId = String(r.teamId || r.team || 'team');
    const strategies = Array.isArray(r.strategies) ? r.strategies.map(s => String(s)) : [];
    const distinct = new Set(strategies).size;
    const diversity = strategies.length ? round2(distinct / strategies.length) : 0;
    return { key: teamId, teamId, assignmentCount: strategies.length, distinctCount: distinct, diversity, coordinated: distinct >= 2 };
  }).sort((a, b) => b.diversity - a.diversity || String(a.key).localeCompare(String(b.key)));
  const coordinatedCount = rows.filter(r => r.coordinated).length;
  return { rows, count: rows.length, coordinatedCount, top: rows[0] || null, summary: `Infinity AI coordinated team strategies for ${rows.length} team(s); ${coordinatedCount} are coordinated.` };
}
