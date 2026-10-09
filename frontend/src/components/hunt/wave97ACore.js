/**
 * wave97ACore.js — Infinity AI · Wave 97A
 * Experiment assignment and rigor, ideas 53841–53860: randomized hunt
 * assignment, experiment power calculators, variant performance dashboards,
 * experiment guardrails, multi-armed bandit allocation, experiment
 * stratification, sequential testing methods, experiment replication
 * requirements, negative result publishing, experiment idea backlogs,
 * cross-team experiment coordination, experiment ethics reviews, experiment
 * blinding, experiment duration guidelines, interaction effect detection,
 * experiment rollback plans, winning variant rollout playbooks, experiment
 * cost tracking, experiment result repositories, and experiment
 * prioritization scoring.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE97_A_IDEAS = [
  { id: 53841, title: 'Randomized Hunt Assignment', skip: false },
  { id: 53842, title: 'Experiment Power Calculators', skip: false },
  { id: 53843, title: 'Variant Performance Dashboards', skip: false },
  { id: 53844, title: 'Experiment Guardrails (learning)', skip: false },
  { id: 53845, title: 'Multi-Armed Bandit Allocation (learning)', skip: false },
  { id: 53846, title: 'Experiment Stratification', skip: false },
  { id: 53847, title: 'Sequential Testing Methods', skip: false },
  { id: 53848, title: 'Experiment Replication Requirements', skip: false },
  { id: 53849, title: 'Negative Result Publishing', skip: false },
  { id: 53850, title: 'Experiment Idea Backlogs', skip: false },
  { id: 53851, title: 'Cross-Team Experiment Coordination', skip: false },
  { id: 53852, title: 'Experiment Ethics Reviews', skip: false },
  { id: 53853, title: 'Experiment Blinding', skip: false },
  { id: 53854, title: 'Experiment Duration Guidelines', skip: false },
  { id: 53855, title: 'Interaction Effect Detection', skip: false },
  { id: 53856, title: 'Experiment Rollback Plans', skip: false },
  { id: 53857, title: 'Winning Variant Rollout Playbooks', skip: false },
  { id: 53858, title: 'Experiment Cost Tracking', skip: false },
  { id: 53859, title: 'Experiment Result Repositories', skip: false },
  { id: 53860, title: 'Experiment Prioritization Scoring', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.entryId||it.id||it.name||fb);}

/** Idea 53841 — Randomized Hunt Assignment. Input records: {huntId, seed}. A stable string hash of hunt-and-seed picks the variant, so the same hunt always lands in the same variant and comparisons stay unbiased. Randomly assigns hunts to strategy variants for unbiased comparisons. */
export function assignRandomizedHunts(records = [], variants = ['control', 'variant']) {
  const list = Array.isArray(variants) && variants.length ? variants.map(String) : ['control', 'variant'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const huntId = String(r.huntId || r.id || 'hunt');
    const seed = String(r.seed ?? 'infinity-ai');
    let hash = 0;
    const text = `${huntId}|${seed}`;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 1000003;
    const variantIndex = hash % list.length;
    return { key: huntId, huntId, seed, hash, variantIndex, variant: list[variantIndex] };
  });
  const counts = new Map();
  for (const row of rows) counts.set(row.variant, (counts.get(row.variant) || 0) + 1);
  const perVariant = list.map(v => ({ variant: v, count: counts.get(v) || 0 })).sort((a, b) => b.count - a.count || String(a.variant).localeCompare(String(b.variant)));
  const maxCount = perVariant.length ? perVariant[0].count : 0;
  const minCount = perVariant.length ? perVariant[perVariant.length - 1].count : 0;
  return { rows, count: rows.length, perVariant, imbalance: rows.length ? round2((maxCount - minCount) / rows.length) : 0, top: perVariant[0] || null, summary: `Infinity AI assigned ${rows.length} hunt(s) across ${list.length} variant(s) for unbiased comparison.` };
}
/** Idea 53842 — Experiment Power Calculators. Input records: {experimentId, baselineRate, minDetectableEffect, significanceLevel, desiredPower, availablePerArm}. Required hunts per arm use the two-proportion normal approximation with fixed z quantiles. Calculates required hunt counts for statistically meaningful A/B results. */
export function calculateExperimentPower(records = []) {
  const zAlpha = { '0.1': 1.645, '0.05': 1.96, '0.01': 2.576 };
  const zBeta = { '0.7': 0.524, '0.8': 0.842, '0.9': 1.282 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const baselineRate = round2(clamp01(r.baselineRate ?? r.baseline));
    const mde = round2(Math.abs(num(r.minDetectableEffect ?? r.effect, 0)));
    const significanceLevel = num(r.significanceLevel, 0.05);
    const desiredPower = num(r.desiredPower ?? r.power, 0.8);
    const zA = zAlpha[String(significanceLevel)] || 1.96;
    const zB = zBeta[String(desiredPower)] || 0.842;
    const p2 = Math.min(0.99, baselineRate + mde);
    const variance = baselineRate * (1 - baselineRate) + p2 * (1 - p2);
    const requiredPerArm = mde > 0 ? Math.ceil((((zA + zB) ** 2) * variance) / (mde ** 2)) : 0;
    const availablePerArm = num(r.availablePerArm ?? r.available, 0);
    return { key: experimentId, experimentId, baselineRate, minDetectableEffect: mde, targetRate: round2(p2), requiredPerArm, requiredTotal: requiredPerArm * 2, availablePerArm, powered: availablePerArm >= requiredPerArm, powerGap: Math.max(0, requiredPerArm - availablePerArm) };
  }).sort((a, b) => b.requiredPerArm - a.requiredPerArm || String(a.key).localeCompare(String(b.key)));
  const poweredCount = rows.filter(r => r.powered).length;
  return { rows, count: rows.length, poweredCount, underpoweredCount: rows.length - poweredCount, top: rows[0] || null, summary: `Infinity AI calculated power for ${rows.length} experiment(s); ${poweredCount} have enough hunts per arm.` };
}
/** Idea 53843 — Variant Performance Dashboards. Input records: {variant, hunts, wins, cost}. Win rate is wins over hunts and cost per win divides spend by wins; the leader is the highest win rate with at least one hunt. Compares strategy variants live during experiments. */
export function buildVariantPerformanceDashboards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const variant = String(r.variant || 'variant');
    const hunts = num(r.hunts, 0);
    const wins = num(r.wins, 0);
    const cost = num(r.cost, 0);
    return { key: variant, variant, hunts, wins, cost, winRate: rate(wins, hunts), costPerWin: wins ? round2(cost / wins) : 0, lossRate: rate(Math.max(0, hunts - wins), hunts) };
  }).sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  const totalHunts = rows.reduce((s, r) => s + r.hunts, 0);
  const totalWins = rows.reduce((s, r) => s + r.wins, 0);
  const leader = rows.find(r => r.hunts > 0) || null;
  rows.forEach((row, i) => { row.rank = i + 1; row.isLeader = leader ? row.key === leader.key : false; });
  return { rows, count: rows.length, totalHunts, totalWins, overallWinRate: rate(totalWins, totalHunts), leader, top: rows[0] || null, summary: `Infinity AI compared ${rows.length} variant(s) over ${totalHunts} hunt(s).` };
}
/** Idea 53844 — Experiment Guardrails (learning). Input records: {experimentId, variant, relativeDrop, guardrailThreshold}. A variant is paused when its drop reaches the threshold, warned at half the threshold, and safe otherwise. Auto-pauses experiments when a variant performs dangerously worse. */
export function evaluateExperimentGuardrails(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const variant = String(r.variant || 'variant');
    const relativeDrop = round2(num(r.relativeDrop ?? r.drop, 0));
    const threshold = Math.abs(num(r.guardrailThreshold ?? r.threshold, 0.2));
    const status = relativeDrop <= -threshold ? 'paused' : relativeDrop <= -(threshold / 2) ? 'warning' : 'safe';
    return { key: `${experimentId}|${variant}`, experimentId, variant, relativeDrop, threshold, status, paused: status === 'paused', headroom: round2(threshold + relativeDrop) };
  }).sort((a, b) => ({ paused: 0, warning: 1, safe: 2 }[a.status] - { paused: 0, warning: 1, safe: 2 }[b.status]) || a.relativeDrop - b.relativeDrop || String(a.key).localeCompare(String(b.key)));
  const pausedCount = rows.filter(r => r.paused).length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  return { rows, count: rows.length, pausedCount, warningCount, breachedCount: pausedCount, top: rows[0] || null, summary: `Infinity AI guardrails paused ${pausedCount} variant(s) and warned on ${warningCount}.` };
}
/** Idea 53845 — Multi-Armed Bandit Allocation (learning). Input records: {variant, hunts, wins}; epsilon is the exploration share split evenly across variants while the rest exploits the current best win rate. Shifts traffic toward winning variants mid-experiment to reduce opportunity cost. */
export function allocateBanditTraffic(records = [], epsilon = 0.1) {
  const eps = clamp01(epsilon);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const variant = String(r.variant || 'variant');
    const hunts = num(r.hunts, 0);
    const wins = num(r.wins, 0);
    return { key: variant, variant, hunts, wins, winRate: rate(wins, hunts) };
  }).sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
  const n = rows.length;
  const bestKey = n ? rows[0].key : null;
  for (const row of rows) {
    const exploreShare = n ? eps / n : 0;
    row.allocatedShare = round2(row.key === bestKey ? (1 - eps) + exploreShare : exploreShare);
    row.isBest = row.key === bestKey;
  }
  return { rows, count: n, epsilon: eps, best: rows[0] || null, top: rows[0] || null, summary: `Infinity AI allocated bandit traffic across ${n} variant(s) with exploration ${eps}.` };
}
/** Idea 53846 — Experiment Stratification. Input records: {huntId, targetClass, variant}. Each target class forms a stratum; a stratum is balanced when its control share stays between 40 and 60 percent. Stratifies experiments by target class so results generalize properly. */
export function stratifyExperiment(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const targetClass = String(r.targetClass || r.target || 'target');
    if (!groups.has(targetClass)) groups.set(targetClass, []);
    groups.get(targetClass).push(r);
  }
  const rows = [...groups.entries()].map(([targetClass, items]) => {
    const perVariant = new Map();
    for (const it of items) perVariant.set(String(it.variant || 'variant'), (perVariant.get(String(it.variant || 'variant')) || 0) + 1);
    const variants = [...perVariant.entries()].map(([variant, count]) => ({ variant, count })).sort((a, b) => b.count - a.count || String(a.variant).localeCompare(String(b.variant)));
    const controlShare = rate(perVariant.get('control') || 0, items.length);
    return { key: targetClass, targetClass, total: items.length, variants, controlShare, balanced: controlShare >= 0.4 && controlShare <= 0.6 };
  }).sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
  const balancedCount = rows.filter(r => r.balanced).length;
  return { rows, count: rows.length, stratumCount: rows.length, balancedCount, top: rows[0] || null, summary: `Infinity AI stratified hunts into ${rows.length} target class(es); ${balancedCount} are balanced.` };
}
/** Idea 53847 — Sequential Testing Methods. Input records: {day, controlHunts, controlWins, variantHunts, variantWins, boundary}. A two-proportion z-score per look is compared with the stopping boundary so clear winners conclude early. Uses sequential analysis to conclude experiments early when winners are clear. */
export function runSequentialTest(records = [], boundary = 1.96) {
  const bound = Math.abs(num(boundary, 1.96));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const controlHunts = num(r.controlHunts, 0);
    const variantHunts = num(r.variantHunts, 0);
    const pC = controlHunts ? num(r.controlWins, 0) / controlHunts : 0;
    const pV = variantHunts ? num(r.variantWins, 0) / variantHunts : 0;
    const se = Math.sqrt((pC * (1 - pC)) / Math.max(1, controlHunts) + (pV * (1 - pV)) / Math.max(1, variantHunts));
    const z = se > 0 ? (pV - pC) / se : 0;
    return { key: `day-${num(r.day, 0)}`, day: num(r.day, 0), controlRate: round2(pC), variantRate: round2(pV), effect: round2(pV - pC), zScore: round2(z), canConclude: Math.abs(z) >= bound };
  }).sort((a, b) => a.day - b.day);
  const conclusion = rows.find(r => r.canConclude) || null;
  return { rows, count: rows.length, boundary: bound, concludedDay: conclusion ? conclusion.day : null, winner: conclusion ? (conclusion.zScore > 0 ? 'variant' : 'control') : null, status: conclusion ? 'concluded' : 'running', top: conclusion, summary: `Infinity AI ran sequential looks over ${rows.length} day(s); status is ${conclusion ? 'concluded' : 'running'}.` };
}
/** Idea 53848 — Experiment Replication Requirements. Input records: {experimentId, originalEffect, replicationEffect, replicationHunts, requiredHunts}. Replication passes when the fresh effect keeps the original sign, holds at least half its size, and meets the hunt requirement. Requires winning strategies to replicate on fresh targets before adoption. */
export function checkExperimentReplication(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const originalEffect = round2(num(r.originalEffect, 0));
    const replicationEffect = round2(num(r.replicationEffect, 0));
    const replicationHunts = num(r.replicationHunts, 0);
    const requiredHunts = num(r.requiredHunts, 0);
    const sameSign = Math.sign(replicationEffect) === Math.sign(originalEffect) && originalEffect !== 0;
    const retained = Math.abs(replicationEffect) >= Math.abs(originalEffect) * 0.5;
    const enoughHunts = replicationHunts >= requiredHunts;
    const replicated = sameSign && retained && enoughHunts;
    return { key: experimentId, experimentId, originalEffect, replicationEffect, replicationHunts, requiredHunts, retainedShare: originalEffect ? round2(replicationEffect / originalEffect) : 0, sameSign, enoughHunts, replicated, status: replicated ? 'replicated' : 'not-replicated' };
  }).sort((a, b) => Number(b.replicated) - Number(a.replicated) || String(a.key).localeCompare(String(b.key)));
  const replicatedCount = rows.filter(r => r.replicated).length;
  return { rows, count: rows.length, replicatedCount, pendingCount: rows.length - replicatedCount, top: rows[0] || null, summary: `Infinity AI checked replication for ${rows.length} experiment(s); ${replicatedCount} replicated on fresh targets.` };
}
/** Idea 53849 — Negative Result Publishing. Input records: {experimentId, effectSize, writeupReady, published}. Negative and null results with a finished writeup are ready to publish so teams never repeat failed experiments. Publishes failed experiments so teams do not repeat them. */
export function publishNegativeResults(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const effectSize = round2(num(r.effectSize ?? r.effect, 0));
    const resultType = effectSize < 0 ? 'negative' : effectSize > 0 ? 'positive' : 'null';
    const writeupReady = Boolean(r.writeupReady);
    const published = Boolean(r.published);
    const publishable = !published && writeupReady && resultType !== 'positive';
    return { key: experimentId, experimentId, effectSize, resultType, writeupReady, published, publishable, action: published ? 'published' : publishable ? 'ready-to-publish' : 'needs-writeup' };
  }).sort((a, b) => Number(b.publishable) - Number(a.publishable) || String(a.key).localeCompare(String(b.key)));
  const publishableCount = rows.filter(r => r.publishable).length;
  return { rows, count: rows.length, publishableCount, publishedCount: rows.filter(r => r.published).length, publishableIds: rows.filter(r => r.publishable).map(r => r.experimentId), top: rows[0] || null, summary: `Infinity AI queued ${publishableCount} negative or null result(s) for publication.` };
}
/** Idea 53850 — Experiment Idea Backlogs. Input records: {ideaId, impact, effort, confidence}. Priority blends expected impact and confidence against effort, and ranks hypotheses awaiting testing. Maintains a backlog of strategy hypotheses awaiting testing. */
export function manageExperimentBacklog(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const ideaId = String(r.ideaId || r.idea || 'idea');
    const impact = num(r.impact, 0);
    const effort = num(r.effort, 0);
    const confidence = round2(clamp01(r.confidence));
    const score = effort > 0 ? round2((impact * confidence) / effort) : 0;
    return { key: ideaId, ideaId, title: String(r.title || ''), impact, effort, confidence, score, testNext: score >= 2 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const testNextCount = rows.filter(r => r.testNext).length;
  return { rows, count: rows.length, testNextCount, top: rows[0] || null, summary: `Infinity AI ranked ${rows.length} experiment idea(s); ${testNextCount} are ready to test next.` };
}
/** Idea 53851 — Cross-Team Experiment Coordination. Input records: {experimentId, team, targetPool, startDay, endDay}. Two experiments from different teams conflict when they share a target pool on overlapping days. Coordinates experiments across teams to avoid interference. */
export function coordinateCrossTeamExperiments(records = []) {
  const list = (Array.isArray(records) ? records : []).map(r => ({
    experimentId: String(r.experimentId || r.experiment || 'experiment'),
    team: String(r.team || 'team'),
    targetPool: String(r.targetPool || r.pool || 'pool'),
    startDay: num(r.startDay, 0),
    endDay: num(r.endDay, 0),
  }));
  const rows = list.map(item => {
    const conflictsWith = list.filter(other => other.experimentId !== item.experimentId && other.team !== item.team && other.targetPool === item.targetPool && item.startDay <= other.endDay && other.startDay <= item.endDay).map(o => o.experimentId).sort();
    return { key: item.experimentId, ...item, conflictsWith, conflicted: conflictsWith.length > 0 };
  }).sort((a, b) => Number(b.conflicted) - Number(a.conflicted) || String(a.key).localeCompare(String(b.key)));
  const conflictedCount = rows.filter(r => r.conflicted).length;
  return { rows, count: rows.length, conflictedCount, conflictPairs: round2(conflictedCount / 2), top: rows[0] || null, summary: `Infinity AI coordinated ${rows.length} cross-team experiment(s); ${conflictedCount} interfere with another team.` };
}
/** Idea 53852 — Experiment Ethics Reviews. Input records: {experimentId, targetRisk, researcherRisk, consentObtained, documented}. High target risk without consent, or any undocumented experiment, is an ethics violation. Reviews experiments for risks to targets and researchers before launch. */
export function reviewExperimentEthics(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const targetRisk = round2(clamp01(r.targetRisk));
    const researcherRisk = round2(clamp01(r.researcherRisk));
    const consentObtained = Boolean(r.consentObtained ?? r.consent);
    const documented = Boolean(r.documented);
    const violation = (targetRisk >= 0.7 && !consentObtained) || !documented;
    return { key: experimentId, experimentId, targetRisk, researcherRisk, riskScore: round2(0.6 * targetRisk + 0.4 * researcherRisk), consentObtained, documented, violation, compliant: !violation };
  }).sort((a, b) => Number(b.violation) - Number(a.violation) || b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const violationCount = rows.filter(r => r.violation).length;
  return { rows, count: rows.length, violationCount, compliantCount: rows.length - violationCount, top: rows[0] || null, summary: `Infinity AI reviewed ethics for ${rows.length} experiment(s); ${violationCount} violation(s) found.` };
}
/** Idea 53853 — Experiment Blinding. Input records: {experimentId, feasible, blinded, assessedBy}. A feasible experiment left unblinded is a bias risk; blinding rate counts blinded over feasible. Blinds researchers to which variant they are running when feasible to reduce bias. */
export function evaluateExperimentBlinding(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const feasible = Boolean(r.feasible);
    const blinded = Boolean(r.blinded);
    return { key: experimentId, experimentId, feasible, blinded, assessedBy: String(r.assessedBy || ''), biasRisk: feasible && !blinded, status: blinded ? 'blinded' : feasible ? 'unblinded-feasible' : 'not-feasible' };
  }).sort((a, b) => Number(b.biasRisk) - Number(a.biasRisk) || String(a.key).localeCompare(String(b.key)));
  const feasibleCount = rows.filter(r => r.feasible).length;
  const blindedCount = rows.filter(r => r.blinded).length;
  const biasRiskCount = rows.filter(r => r.biasRisk).length;
  return { rows, count: rows.length, feasibleCount, blindedCount, biasRiskCount, blindingRate: rate(blindedCount, feasibleCount), top: rows[0] || null, summary: `Infinity AI checked blinding on ${rows.length} experiment(s); ${biasRiskCount} feasible experiment(s) run unblinded.` };
}
/** Idea 53854 — Experiment Duration Guidelines. Input records: {experimentId, plannedDays, minDays, maxDays}. Plans shorter than the minimum invite peeking and plans beyond the maximum go stale. Sets minimum and maximum experiment durations to avoid peeking and staleness. */
export function checkExperimentDurations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const plannedDays = num(r.plannedDays ?? r.days, 0);
    const minDays = num(r.minDays, 0);
    const maxDays = num(r.maxDays, 0);
    const status = plannedDays < minDays ? 'too-short' : plannedDays > maxDays ? 'too-long' : 'compliant';
    return { key: experimentId, experimentId, plannedDays, minDays, maxDays, status, compliant: status === 'compliant', slackDays: status === 'compliant' ? Math.min(plannedDays - minDays, maxDays - plannedDays) : 0 };
  }).sort((a, b) => Number(a.compliant) - Number(b.compliant) || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, violationCount: rows.length - compliantCount, top: rows[0] || null, summary: `Infinity AI checked durations for ${rows.length} experiment(s); ${compliantCount} sit inside the guidelines.` };
}
/** Idea 53855 — Interaction Effect Detection. Input records: {pairId, changeA, changeB, effectA, effectB, combinedEffect}. The interaction is the combined effect minus the additive expectation; swings past five points are real interactions. Detects when two strategy changes interact rather than acting independently. */
export function detectInteractionEffects(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pairId = String(r.pairId || r.pair || 'pair');
    const effectA = round2(num(r.effectA, 0));
    const effectB = round2(num(r.effectB, 0));
    const combinedEffect = round2(num(r.combinedEffect ?? r.combined, 0));
    const expectedAdditive = round2(effectA + effectB);
    const interactionEffect = round2(combinedEffect - expectedAdditive);
    const significant = Math.abs(interactionEffect) >= 0.05;
    return { key: pairId, pairId, changeA: String(r.changeA || ''), changeB: String(r.changeB || ''), effectA, effectB, combinedEffect, expectedAdditive, interactionEffect, significant, kind: !significant ? 'independent' : interactionEffect > 0 ? 'synergy' : 'antagonism' };
  }).sort((a, b) => Math.abs(b.interactionEffect) - Math.abs(a.interactionEffect) || String(a.key).localeCompare(String(b.key)));
  const interactionCount = rows.filter(r => r.significant).length;
  return { rows, count: rows.length, interactionCount, top: rows[0] || null, summary: `Infinity AI tested ${rows.length} change pair(s); ${interactionCount} show real interaction effects.` };
}
/** Idea 53856 — Experiment Rollback Plans. Input records: {experimentId, steps, owner, tested}. A plan is launch-ready with at least three steps, a named owner, and a rehearsed rollback. Requires rollback plans before any experiment launches. */
export function checkRollbackPlans(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const steps = num(r.steps ?? r.rollbackSteps, 0);
    const owner = String(r.owner || '');
    const tested = Boolean(r.tested);
    const blockers = [];
    if (steps < 3) blockers.push('too-few-steps');
    if (!owner) blockers.push('no-owner');
    if (!tested) blockers.push('untested');
    return { key: experimentId, experimentId, steps, owner, tested, blockers, ready: blockers.length === 0 };
  }).sort((a, b) => Number(b.ready) - Number(a.ready) || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, blockedCount: rows.length - readyCount, top: rows[0] || null, summary: `Infinity AI verified rollback plans for ${rows.length} experiment(s); ${readyCount} are launch-ready.` };
}
/** Idea 53857 — Winning Variant Rollout Playbooks. Input records: {variant, effect, stagesCompleted, totalStages}. Rollout progress is completed over total stages and a non-positive effect blocks the rollout entirely. Standardizes how winning strategies roll out fleet-wide. */
export function planWinnerRollout(records = []) {
  const stageNames = ['canary', 'limited-cohort', 'half-fleet', 'fleet-wide'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const variant = String(r.variant || 'variant');
    const effect = round2(num(r.effect, 0));
    const stagesCompleted = num(r.stagesCompleted, 0);
    const totalStages = Math.max(1, num(r.totalStages, stageNames.length));
    const progress = rate(stagesCompleted, totalStages);
    const blocked = effect <= 0;
    const complete = !blocked && stagesCompleted >= totalStages;
    return { key: variant, variant, effect, stagesCompleted, totalStages, progress, blocked, complete, nextStage: blocked ? 'blocked' : complete ? 'done' : stageNames[Math.min(stagesCompleted, stageNames.length - 1)], status: blocked ? 'blocked' : complete ? 'complete' : 'rolling-out' };
  }).sort((a, b) => b.progress - a.progress || String(a.key).localeCompare(String(b.key)));
  const rollingCount = rows.filter(r => r.status === 'rolling-out').length;
  return { rows, count: rows.length, rollingCount, blockedCount: rows.filter(r => r.blocked).length, completeCount: rows.filter(r => r.complete).length, top: rows[0] || null, summary: `Infinity AI tracked rollouts for ${rows.length} winning variant(s); ${rollingCount} are mid-rollout.` };
}
/** Idea 53858 — Experiment Cost Tracking. Input records: {experimentId, huntsRun, huntCost, opportunityPerHunt, winnerValue}. Total cost blends direct hunt spend with the opportunity cost of not exploiting known winners. Tracks the opportunity cost of running experiments versus exploiting known winners. */
export function trackExperimentCosts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const huntsRun = num(r.huntsRun, 0);
    const directCost = round2(huntsRun * num(r.huntCost, 0));
    const opportunityCost = round2(huntsRun * num(r.opportunityPerHunt ?? r.opportunityCost, 0));
    const totalCost = round2(directCost + opportunityCost);
    const winnerValue = round2(num(r.winnerValue ?? r.value, 0));
    const netValue = round2(winnerValue - totalCost);
    return { key: experimentId, experimentId, huntsRun, directCost, opportunityCost, totalCost, winnerValue, netValue, worthIt: netValue > 0 };
  }).sort((a, b) => b.netValue - a.netValue || String(a.key).localeCompare(String(b.key)));
  const totalCost = round2(rows.reduce((s, r) => s + r.totalCost, 0));
  const worthItCount = rows.filter(r => r.worthIt).length;
  return { rows, count: rows.length, totalCost, worthItCount, top: rows[0] || null, summary: `Infinity AI tracked experiment costs of ${totalCost} across ${rows.length} experiment(s); ${worthItCount} paid for themselves.` };
}
/** Idea 53859 — Experiment Result Repositories. Input: query plus records {experimentId, title, summary, outcome, tags}. Title matches weigh three, tag matches two, summary matches one, building a searchable archive of past experiments. Searchable archive of all past experiments and their outcomes. */
export function searchExperimentResults(records = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const title = String(r.title || '');
    const summaryText = String(r.summary || '');
    const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
    let score = 0;
    if (q) {
      if (title.toLowerCase().includes(q)) score += 3;
      if (tags.some(t => t.toLowerCase().includes(q))) score += 2;
      if (summaryText.toLowerCase().includes(q)) score += 1;
    }
    return { key: experimentId, experimentId, title, outcome: String(r.outcome || 'unknown'), tags, score, matched: score > 0 };
  }).filter(r => r.matched).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const outcomeCounts = {};
  for (const row of rows) outcomeCounts[row.outcome] = (outcomeCounts[row.outcome] || 0) + 1;
  return { rows, count: rows.length, query: q, outcomeCounts, top: rows[0] || null, summary: `Infinity AI searched the experiment repository for "${q}" and found ${rows.length} result(s).` };
}
/** Idea 53860 — Experiment Prioritization Scoring. Input records: {ideaId, expectedValue, confidence, cost, strategicFit}. Score multiplies value, confidence, and fit, then divides by cost to rank the backlog by expected return. Scores experiment ideas by expected value to prioritize the backlog. */
export function scoreExperimentPriorities(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const ideaId = String(r.ideaId || r.idea || 'idea');
    const expectedValue = num(r.expectedValue ?? r.value, 0);
    const confidence = round2(clamp01(r.confidence));
    const cost = num(r.cost, 0);
    const strategicFit = round2(clamp01(r.strategicFit ?? r.fit));
    const score = cost > 0 ? round2((expectedValue * confidence * strategicFit) / cost) : 0;
    return { key: ideaId, ideaId, expectedValue, confidence, cost, strategicFit, score, qualified: score >= 2 };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  rows.forEach((row, i) => { row.rank = i + 1; });
  const qualifiedCount = rows.filter(r => r.qualified).length;
  return { rows, count: rows.length, qualifiedCount, averageScore: mean(rows.map(r => r.score)), top: rows[0] || null, summary: `Infinity AI scored ${rows.length} experiment idea(s); ${qualifiedCount} clear the priority bar.` };
}
