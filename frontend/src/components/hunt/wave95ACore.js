/**
 * wave95ACore.js — Infinity AI · Wave 95A
 * Recommendation engine depth (part 2), ideas 53761–53780: researcher
 * onboarding recommendations, recommendation A/B testing, strategy portfolio
 * recommendations, recommendation audit trails, emergency strategy fallbacks,
 * recommendation personalization controls, strategy recommendation widgets,
 * recommendation effectiveness reports, cross-industry recommendation
 * transfer, recommendation data minimization, strategy recommendation
 * versioning, researcher trust scores, recommendation simulation mode,
 * strategy recommendation ethics, recommendation feedback incentives,
 * strategy recommendation SLAs, recommendation model cards, recommendation
 * sunset reviews, strategy recommendation mobile access, and recommendation
 * integration with scheduling.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE95_A_IDEAS = [
  { id: 53761, title: 'Researcher Onboarding Recommendations', skip: false },
  { id: 53762, title: 'Recommendation A/B Testing', skip: false },
  { id: 53763, title: 'Strategy Portfolio Recommendations', skip: false },
  { id: 53764, title: 'Recommendation Audit Trails', skip: false },
  { id: 53765, title: 'Emergency Strategy Fallbacks', skip: false },
  { id: 53766, title: 'Recommendation Personalization Controls', skip: false },
  { id: 53767, title: 'Strategy Recommendation Widgets', skip: false },
  { id: 53768, title: 'Recommendation Effectiveness Reports', skip: false },
  { id: 53769, title: 'Cross-Industry Recommendation Transfer', skip: false },
  { id: 53770, title: 'Recommendation Data Minimization', skip: false },
  { id: 53771, title: 'Strategy Recommendation Versioning', skip: false },
  { id: 53772, title: 'Researcher Trust Scores', skip: false },
  { id: 53773, title: 'Recommendation Simulation Mode', skip: false },
  { id: 53774, title: 'Strategy Recommendation Ethics', skip: false },
  { id: 53775, title: 'Recommendation Feedback Incentives', skip: false },
  { id: 53776, title: 'Strategy Recommendation SLAs', skip: false },
  { id: 53777, title: 'Recommendation Model Cards', skip: false },
  { id: 53778, title: 'Recommendation Sunset Reviews', skip: false },
  { id: 53779, title: 'Strategy Recommendation Mobile Access', skip: false },
  { id: 53780, title: 'Recommendation Integration with Scheduling', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.researcher||it.strategy||it.id||it.name||fb);}

/** Idea 53761 — Researcher Onboarding Recommendations. Input records: {researcher, experienceLevel, completedHunts}. Onboarding score blends stated experience with proven hunts; path is guided below 0.34, assisted below 0.67, autonomous above. Recommends a starting path for new researchers. */
export function buildResearcherOnboardingPlan(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experience = round2(clamp01(r.experienceLevel ?? r.experience));
    const hunts = num(r.completedHunts ?? r.hunts, 0);
    const onboardingScore = round2(0.5 * experience + 0.5 * Math.min(1, hunts / 10));
    const path = onboardingScore < 0.34 ? 'guided-onboarding' : onboardingScore < 0.67 ? 'assisted-hunts' : 'autonomous-hunts';
    return { key: keyOf(r, 'researcher'), researcher: String(r.researcher || 'researcher'), experience, hunts, onboardingScore, path };
  }).sort((a, b) => b.onboardingScore - a.onboardingScore || String(a.key).localeCompare(String(b.key)));
  const guidedCount = rows.filter(r => r.path === 'guided-onboarding').length;
  const assistedCount = rows.filter(r => r.path === 'assisted-hunts').length;
  const autonomousCount = rows.filter(r => r.path === 'autonomous-hunts').length;
  return { rows, count: rows.length, guidedCount, assistedCount, autonomousCount, top: rows[0] || null, summary: `Infinity AI planned onboarding for ${rows.length} researcher(s); ${guidedCount} guided, ${assistedCount} assisted, ${autonomousCount} autonomous.` };
}
/** Idea 53762 — Recommendation A/B Testing. Input records: {variant, control, impressions, accepted}. Conversion per variant, lift against control; a winner needs lift and at least 100 impressions. A/B tests recommendation variants before rollout. */
export function testRecommendationABVariants(records = []) {
  const list = Array.isArray(records) ? records : [];
  const control = list.find(r => r.control === true) || list[0] || {};
  const controlRate = rate(num(control.accepted, 0), num(control.impressions, 0));
  const rows = list.map(r => {
    const variant = String(r.variant || 'variant');
    const impressions = num(r.impressions, 0);
    const conversionRate = rate(num(r.accepted, 0), impressions);
    const isControl = r === control;
    const lift = isControl ? 0 : round2(conversionRate - controlRate);
    const significant = impressions >= 100;
    return { key: variant, variant, impressions, accepted: num(r.accepted, 0), conversionRate, controlRate, lift, isControl, significant, winner: !isControl && lift > 0 && significant };
  }).sort((a, b) => b.conversionRate - a.conversionRate || String(a.key).localeCompare(String(b.key)));
  const winnerCount = rows.filter(r => r.winner).length;
  return { rows, count: rows.length, controlRate, winnerCount, top: rows[0] || null, summary: `Infinity AI A/B tested ${rows.length} recommendation variant(s); ${winnerCount} beat the control.` };
}
/** Idea 53763 — Strategy Portfolio Recommendations. Input records: {strategy, expectedReturn, risk, correlationGroup}. Greedy selection by return adjusted for risk, one strategy per correlation group, cumulative risk capped by maxRisk. Recommends a diversified portfolio of strategies instead of a single pick. */
export function selectStrategyPortfolio(records = [], maxRisk = 1) {
  const cap = num(maxRisk, 1);
  const scored = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const expectedReturn = round2(num(r.expectedReturn ?? r.return, 0));
    const risk = round2(clamp01(r.risk));
    return { key: strategy, strategy, expectedReturn, risk, correlationGroup: String(r.correlationGroup || r.group || strategy), score: round2(expectedReturn - 0.5 * risk), selected: false };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const usedGroups = new Set();
  let totalRisk = 0;
  for (const row of scored) {
    if (usedGroups.has(row.correlationGroup)) continue;
    if (totalRisk + row.risk > cap) continue;
    row.selected = true;
    usedGroups.add(row.correlationGroup);
    totalRisk = round2(totalRisk + row.risk);
  }
  const selected = scored.filter(r => r.selected);
  const totalExpectedReturn = round2(selected.reduce((s, r) => s + r.expectedReturn, 0));
  return { rows: scored, count: scored.length, selectedCount: selected.length, totalExpectedReturn, totalRisk, top: selected[0] || null, summary: `Infinity AI selected ${selected.length} of ${scored.length} strategies for the portfolio at total risk ${totalRisk}.` };
}
/** Idea 53764 — Recommendation Audit Trails. Input events: {recommendationId, action, actor, timestamp}. Events grouped per recommendation in time order; a trail is complete when it opens with an issuance and closes with a decision. Keeps a full audit trail of every recommendation. */
export function traceRecommendationAuditTrail(events = []) {
  const list = Array.isArray(events) ? events : [];
  const groups = new Map();
  for (const e of list) {
    const recommendationId = String(e.recommendationId || e.id || 'recommendation');
    if (!groups.has(recommendationId)) groups.set(recommendationId, []);
    groups.get(recommendationId).push({ action: String(e.action || ''), actor: String(e.actor || ''), timestamp: num(e.timestamp, 0) });
  }
  const trails = [...groups.entries()].map(([recommendationId, steps]) => {
    const ordered = [...steps].sort((a, b) => a.timestamp - b.timestamp);
    const actions = ordered.map(s => s.action);
    const complete = actions[0] === 'issued' && actions.some(a => a === 'accepted' || a === 'rejected' || a === 'overridden');
    return { key: recommendationId, recommendationId, stepCount: ordered.length, steps: ordered, complete };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const completeCount = trails.filter(t => t.complete).length;
  return { trails, count: trails.length, eventCount: list.length, completeCount, top: trails[0] || null, summary: `Infinity AI traced audit trails for ${trails.length} recommendation(s); ${completeCount} are complete.` };
}
/** Idea 53765 — Emergency Strategy Fallbacks. Input records: {strategy, failureRate, fallback, fallbackSuccessRate}. Exposure is failure rate discounted by fallback success; uncovered when failure rate reaches 0.4 without a fallback. Defines fallback strategies for emergencies mid-hunt. */
export function planEmergencyStrategyFallbacks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const failureRate = round2(clamp01(r.failureRate));
    const fallback = String(r.fallback || '');
    const fallbackSuccessRate = round2(clamp01(r.fallbackSuccessRate));
    const hasFallback = fallback.length > 0;
    const exposure = hasFallback ? round2(failureRate * (1 - fallbackSuccessRate)) : failureRate;
    return { key: strategy, strategy, failureRate, fallback, fallbackSuccessRate, hasFallback, exposure, uncovered: failureRate >= 0.4 && !hasFallback };
  }).sort((a, b) => b.exposure - a.exposure || String(a.key).localeCompare(String(b.key)));
  const uncoveredCount = rows.filter(r => r.uncovered).length;
  const coveredCount = rows.filter(r => r.hasFallback).length;
  return { rows, count: rows.length, coveredCount, uncoveredCount, top: rows[0] || null, summary: `Infinity AI planned emergency fallbacks for ${rows.length} strategy record(s); ${uncoveredCount} are uncovered.` };
}
/** Idea 53766 — Recommendation Personalization Controls. Input records: {researcher, personalization, globalScore, personalScore, optedOut}. Effective score blends personal and global scores by the researcher's personalization level; opt-out forces global only. Gives researchers control over how personal their recommendations get. */
export function applyRecommendationPersonalization(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const personalization = r.optedOut === true ? 0 : round2(clamp01(r.personalization));
    const globalScore = round2(clamp01(r.globalScore));
    const personalScore = round2(clamp01(r.personalScore));
    const effectiveScore = round2(personalization * personalScore + (1 - personalization) * globalScore);
    return { key: researcher, researcher, personalization, globalScore, personalScore, effectiveScore, personalized: personalization >= 0.5 };
  }).sort((a, b) => b.effectiveScore - a.effectiveScore || String(a.key).localeCompare(String(b.key)));
  const personalizedCount = rows.filter(r => r.personalized).length;
  return { rows, count: rows.length, personalizedCount, averagePersonalization: mean(rows.map(r => r.personalization)), top: rows[0] || null, summary: `Infinity AI applied personalization controls for ${rows.length} researcher(s); ${personalizedCount} receive personalized recommendations.` };
}
/** Idea 53767 — Strategy Recommendation Widgets. Input records: {widgetId, candidates: [{strategy, score}]}. Each widget surfaces up to three candidates scoring at least 0.5, best first. Embeddable widgets that render live recommendations in hunt views. */
export function buildStrategyRecommendationWidget(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const widgetId = String(r.widgetId || r.widget || 'widget');
    const candidates = (Array.isArray(r.candidates) ? r.candidates : []).map(c => ({ strategy: String(c.strategy || 'strategy'), score: round2(clamp01(c.score)) }));
    const picks = candidates.filter(c => c.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.strategy);
    return { key: widgetId, widgetId, candidateCount: candidates.length, picks, pickCount: picks.length, topPick: picks[0] || '', ready: picks.length > 0 };
  }).sort((a, b) => b.pickCount - a.pickCount || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI built recommendation widgets for ${rows.length} surface(s); ${readyCount} have live picks.` };
}
/** Idea 53768 — Recommendation Effectiveness Reports. Input records: {strategy, recommended, followed, wins}. Effectiveness multiplies adoption rate by the win rate of followed recommendations; effective at 0.4 or better. Periodic reports on whether recommendations actually work. */
export function reportRecommendationEffectiveness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const recommended = num(r.recommended, 0);
    const followed = num(r.followed, 0);
    const wins = num(r.wins, 0);
    const adoptionRate = rate(followed, recommended);
    const winRate = rate(wins, followed);
    const effectiveness = round2(adoptionRate * winRate);
    return { key: strategy, strategy, recommended, followed, wins, adoptionRate, winRate, effectiveness, effective: effectiveness >= 0.4 };
  }).sort((a, b) => b.effectiveness - a.effectiveness || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  return { rows, count: rows.length, effectiveCount, averageEffectiveness: mean(rows.map(r => r.effectiveness)), top: rows[0] || null, summary: `Infinity AI reported recommendation effectiveness for ${rows.length} strategy record(s); ${effectiveCount} are effective.` };
}
/** Idea 53769 — Cross-Industry Recommendation Transfer. Input records: {sourceIndustry, targetIndustry, strategy, similarity, successRate}. Transfer score multiplies industry similarity by source success; transferable at 0.6 or better. Transfers proven strategies across industries. */
export function transferRecommendationsCrossIndustry(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const sourceIndustry = String(r.sourceIndustry || r.source || 'source');
    const targetIndustry = String(r.targetIndustry || r.target || 'target');
    const strategy = String(r.strategy || 'strategy');
    const similarity = round2(clamp01(r.similarity));
    const successRate = round2(clamp01(r.successRate ?? r.sourceWinRate));
    const transferScore = round2(similarity * successRate);
    return { key: `${sourceIndustry}->${targetIndustry}|${strategy}`, sourceIndustry, targetIndustry, strategy, similarity, successRate, transferScore, transferable: transferScore >= 0.6 };
  }).sort((a, b) => b.transferScore - a.transferScore || String(a.key).localeCompare(String(b.key)));
  const transferableCount = rows.filter(r => r.transferable).length;
  return { rows, count: rows.length, transferableCount, top: rows[0] || null, summary: `Infinity AI evaluated cross-industry transfers for ${rows.length} record(s); ${transferableCount} are transferable.` };
}
/** Idea 53770 — Recommendation Data Minimization. Input records: {datasetId, collectedFields, requiredFields}. Excess fields are collected but never required by the engine; compliant when nothing excess is retained. Keeps recommendation inputs to the minimum data needed. */
export function minimizeRecommendationData(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const datasetId = String(r.datasetId || r.dataset || 'dataset');
    const collected = (Array.isArray(r.collectedFields) ? r.collectedFields : []).map(f => String(f));
    const required = new Set((Array.isArray(r.requiredFields) ? r.requiredFields : []).map(f => String(f)));
    const excessFields = collected.filter(f => !required.has(f));
    return { key: datasetId, datasetId, collectedCount: collected.length, requiredCount: required.size, excessFields, excessCount: excessFields.length, compliant: excessFields.length === 0 };
  }).sort((a, b) => a.excessCount - b.excessCount || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  const totalExcess = rows.reduce((s, r) => s + r.excessCount, 0);
  return { rows, count: rows.length, compliantCount, totalExcess, top: rows[0] || null, summary: `Infinity AI minimized recommendation data across ${rows.length} dataset(s); ${compliantCount} are compliant.` };
}
/** Idea 53771 — Strategy Recommendation Versioning. Input records: {strategy, version}. Versions parsed into numeric parts; the highest per strategy is latest, older ones are outdated. Versions recommendation logic so changes are traceable. */
export function resolveStrategyRecommendationVersions(records = []) {
  const parse = v => String(v || '0.0.0').split('.').map(p => num(p, 0));
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  const list = Array.isArray(records) ? records : [];
  const latestByStrategy = new Map();
  for (const r of list) {
    const strategy = String(r.strategy || 'strategy');
    const parts = parse(r.version);
    const current = latestByStrategy.get(strategy);
    if (!current || cmp(parts, current) > 0) latestByStrategy.set(strategy, parts);
  }
  const rows = list.map(r => {
    const strategy = String(r.strategy || 'strategy');
    const version = String(r.version || '0.0.0');
    const parts = parse(version);
    const isLatest = cmp(parts, latestByStrategy.get(strategy) || parts) === 0;
    return { key: `${strategy}@${version}`, strategy, version, parts, isLatest };
  }).sort((a, b) => String(a.strategy).localeCompare(String(b.strategy)) || cmp(b.parts, a.parts) || String(a.key).localeCompare(String(b.key)));
  const latestCount = rows.filter(r => r.isLatest).length;
  return { rows, count: rows.length, latestCount, outdatedCount: rows.length - latestCount, top: rows[0] || null, summary: `Infinity AI versioned strategy recommendations across ${rows.length} record(s); ${rows.length - latestCount} are outdated.` };
}
/** Idea 53772 — Researcher Trust Scores. Input records: {researcher, hunts, verifiedFindings, falsePositives}. Trust blends finding precision (70%) with experience (30%); trusted at 0.7 or better. Scores researchers so recommendations can weight proven judgment. */
export function scoreResearcherTrust(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const hunts = num(r.hunts, 0);
    const verifiedFindings = num(r.verifiedFindings ?? r.verified, 0);
    const falsePositives = num(r.falsePositives, 0);
    const precision = rate(verifiedFindings, verifiedFindings + falsePositives);
    const experience = round2(Math.min(1, hunts / 50));
    const trustScore = round2(0.7 * precision + 0.3 * experience);
    return { key: researcher, researcher, hunts, verifiedFindings, falsePositives, precision, experience, trustScore, trusted: trustScore >= 0.7 };
  }).sort((a, b) => b.trustScore - a.trustScore || String(a.key).localeCompare(String(b.key)));
  const trustedCount = rows.filter(r => r.trusted).length;
  return { rows, count: rows.length, trustedCount, averageTrust: mean(rows.map(r => r.trustScore)), top: rows[0] || null, summary: `Infinity AI scored researcher trust for ${rows.length} researcher(s); ${trustedCount} are trusted.` };
}
/** Idea 53773 — Recommendation Simulation Mode. Input records: {strategy, simulatedRuns, simulatedWins, sideEffects}. Simulated win rate with zero recorded side effects marks a strategy production ready. Runs recommendations in simulation before they touch live hunts. */
export function simulateRecommendationOutcomes(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const simulatedRuns = num(r.simulatedRuns ?? r.runs, 0);
    const simulatedWins = num(r.simulatedWins ?? r.wins, 0);
    const sideEffects = num(r.sideEffects, 0);
    const winRate = rate(simulatedWins, simulatedRuns);
    return { key: strategy, strategy, simulatedRuns, simulatedWins, sideEffects, winRate, simulated: true, productionReady: winRate >= 0.6 && sideEffects === 0 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.productionReady).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI simulated recommendation outcomes for ${rows.length} strategy record(s); ${readyCount} are production ready.` };
}
/** Idea 53774 — Strategy Recommendation Ethics. Input records: {strategy, scopeChecks, violations, requiresAuth, authObtained}. Ethical when violation rate stays below 0.05 and authorization-gated strategies hold authorization. Reviews recommendations against scope and ethics rules. */
export function reviewStrategyRecommendationEthics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const violationRate = rate(num(r.violations, 0), num(r.scopeChecks ?? r.checks, 0));
    const requiresAuth = Boolean(r.requiresAuth);
    const authObtained = Boolean(r.authObtained);
    const ethical = violationRate < 0.05 && (!requiresAuth || authObtained);
    return { key: strategy, strategy, violationRate, requiresAuth, authObtained, ethical, blocked: !ethical };
  }).sort((a, b) => Number(b.ethical) - Number(a.ethical) || a.violationRate - b.violationRate || String(a.key).localeCompare(String(b.key)));
  const ethicalCount = rows.filter(r => r.ethical).length;
  return { rows, count: rows.length, ethicalCount, blockedCount: rows.length - ethicalCount, top: rows[0] || null, summary: `Infinity AI reviewed recommendation ethics for ${rows.length} strategy record(s); ${rows.length - ethicalCount} are blocked.` };
}
/** Idea 53775 — Recommendation Feedback Incentives. Input records: {researcher, recommendations, feedbackGiven, pointsEarned}. Coverage is feedback given over recommendations received; engaged at 0.5 or better. Rewards researchers who rate recommendations so the engine keeps learning. */
export function tallyRecommendationFeedbackIncentives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const recommendations = num(r.recommendations, 0);
    const feedbackGiven = num(r.feedbackGiven ?? r.feedback, 0);
    const coverage = rate(feedbackGiven, recommendations);
    return { key: researcher, researcher, recommendations, feedbackGiven, pointsEarned: num(r.pointsEarned ?? r.points, 0), coverage, engaged: coverage >= 0.5 };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const engagedCount = rows.filter(r => r.engaged).length;
  const totalPoints = rows.reduce((s, r) => s + r.pointsEarned, 0);
  return { rows, count: rows.length, engagedCount, totalPoints, top: rows[0] || null, summary: `Infinity AI tallied feedback incentives for ${rows.length} researcher(s); ${engagedCount} are engaged.` };
}
/** Idea 53776 — Strategy Recommendation SLAs. Input records: {strategy, latencyMs, budgetMs, uptimePct, targetUptimePct}. Compliant when latency stays within budget and uptime meets target; headroom is spare budget in milliseconds. Holds the recommendation service to latency and uptime commitments. */
export function evaluateStrategyRecommendationSLAs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const latencyMs = num(r.latencyMs ?? r.latency, 0);
    const budgetMs = num(r.budgetMs ?? r.budget, 0);
    const uptimePct = num(r.uptimePct ?? r.uptime, 0);
    const targetUptimePct = num(r.targetUptimePct ?? r.uptimeTarget, 99.9);
    const latencyOk = budgetMs > 0 && latencyMs <= budgetMs;
    const uptimeOk = uptimePct >= targetUptimePct;
    return { key: strategy, strategy, latencyMs, budgetMs, uptimePct, targetUptimePct, headroom: round2(budgetMs - latencyMs), latencyOk, uptimeOk, compliant: latencyOk && uptimeOk };
  }).sort((a, b) => Number(b.compliant) - Number(a.compliant) || a.latencyMs - b.latencyMs || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI evaluated recommendation SLAs for ${rows.length} strategy record(s); ${compliantCount} are compliant.` };
}
/** Idea 53777 — Recommendation Model Cards. Input records: {model, version, trainingHunts, accuracy, limitations, owner}. Card score is the share of five required disclosures present; complete at 0.8 or better. Documents each recommendation model for audit and review. */
export function buildRecommendationModelCards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const model = String(r.model || 'model');
    const version = String(r.version || '');
    const trainingHunts = num(r.trainingHunts, 0);
    const accuracy = round2(clamp01(r.accuracy));
    const limitations = Array.isArray(r.limitations) ? r.limitations.map(s => String(s)) : [];
    const owner = String(r.owner || '');
    const disclosures = [version.length > 0, trainingHunts > 0, accuracy > 0, limitations.length > 0, owner.length > 0];
    const cardScore = round2(disclosures.filter(Boolean).length / disclosures.length);
    return { key: model, model, version, trainingHunts, accuracy, limitationCount: limitations.length, owner, cardScore, complete: cardScore >= 0.8 };
  }).sort((a, b) => b.cardScore - a.cardScore || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, top: rows[0] || null, summary: `Infinity AI built model cards for ${rows.length} recommendation model(s); ${completeCount} are complete.` };
}
/** Idea 53778 — Recommendation Sunset Reviews. Input records: {strategy, lastWinDaysAgo, monthlyUsage}. Usage trend is latest minus earliest month; a sunset candidate has no win in 90 days and falling usage. Reviews aging recommendations for retirement. */
export function reviewRecommendationSunsets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const usage = (Array.isArray(r.monthlyUsage) ? r.monthlyUsage : []).map(v => num(v, 0));
    const usageTrend = usage.length >= 2 ? round2(usage[usage.length - 1] - usage[0]) : 0;
    const lastWinDaysAgo = num(r.lastWinDaysAgo, 0);
    return { key: strategy, strategy, lastWinDaysAgo, usageTrend, recentUsage: usage.length ? usage[usage.length - 1] : 0, sunsetCandidate: lastWinDaysAgo >= 90 && usageTrend < 0 };
  }).sort((a, b) => b.lastWinDaysAgo - a.lastWinDaysAgo || String(a.key).localeCompare(String(b.key)));
  const candidateCount = rows.filter(r => r.sunsetCandidate).length;
  return { rows, count: rows.length, candidateCount, top: rows[0] || null, summary: `Infinity AI ran sunset reviews for ${rows.length} strategy record(s); ${candidateCount} are sunset candidates.` };
}
/** Idea 53779 — Strategy Recommendation Mobile Access. Input records: {strategy, actions: [{name, mobileSupported}]}. Mobile coverage is supported actions over all actions; mobile ready at 0.8 or better. Audits whether recommendations stay usable from mobile clients. */
export function auditStrategyRecommendationMobileAccess(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const actions = Array.isArray(r.actions) ? r.actions : [];
    const mobileSupportedCount = actions.filter(a => a && a.mobileSupported === true).length;
    const mobileCoverage = rate(mobileSupportedCount, actions.length);
    return { key: strategy, strategy, actionCount: actions.length, mobileSupportedCount, mobileCoverage, mobileReady: mobileCoverage >= 0.8 };
  }).sort((a, b) => b.mobileCoverage - a.mobileCoverage || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.mobileReady).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI audited mobile access for ${rows.length} strategy record(s); ${readyCount} are mobile ready.` };
}
/** Idea 53780 — Recommendation Integration with Scheduling. Input records: {strategy, estimatedHours, windows: [{day, hours}]}. A recommendation is scheduled when booked windows cover its estimate. Integrates recommendations with hunt scheduling windows. */
export function integrateRecommendationsWithScheduling(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const strategy = String(r.strategy || 'strategy');
    const estimatedHours = round2(num(r.estimatedHours ?? r.hours, 0));
    const windows = Array.isArray(r.windows) ? r.windows : [];
    const totalWindowHours = round2(windows.reduce((s, w) => s + num(w && w.hours, 0), 0));
    return { key: strategy, strategy, estimatedHours, windowCount: windows.length, totalWindowHours, firstWindowDay: windows.length ? String(windows[0].day || '') : '', fitsSchedule: estimatedHours > 0 && totalWindowHours >= estimatedHours };
  }).sort((a, b) => Number(b.fitsSchedule) - Number(a.fitsSchedule) || b.totalWindowHours - a.totalWindowHours || String(a.key).localeCompare(String(b.key)));
  const scheduledCount = rows.filter(r => r.fitsSchedule).length;
  return { rows, count: rows.length, scheduledCount, top: rows[0] || null, summary: `Infinity AI integrated recommendations with scheduling for ${rows.length} strategy record(s); ${scheduledCount} are scheduled.` };
}
