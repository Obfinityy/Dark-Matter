/**
 * wave98ACore.js — Infinity AI · Wave 98A
 * Experiment governance and knowledge, ideas 53881–53894: experiment
 * tooling, experiment review boards, experiment metric hierarchies,
 * experiment novelty effects, experiment cross-validation, experiment
 * publication standards, experiment knowledge sharing, experiment
 * automation, experiment portfolio reviews, experiment risk tiers,
 * experiment success attribution, experiment data retention, experiment
 * champion roles, and the annual experiment impact report.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE98_A_IDEAS = [
  { id: 53881, title: 'Experiment Tooling', skip: false },
  { id: 53882, title: 'Experiment Review Boards', skip: false },
  { id: 53883, title: 'Experiment Metric Hierarchies', skip: false },
  { id: 53884, title: 'Experiment Novelty Effects', skip: false },
  { id: 53885, title: 'Experiment Cross-Validation', skip: false },
  { id: 53886, title: 'Experiment Publication Standards', skip: false },
  { id: 53887, title: 'Experiment Knowledge Sharing', skip: false },
  { id: 53888, title: 'Experiment Automation', skip: false },
  { id: 53889, title: 'Experiment Portfolio Reviews', skip: false },
  { id: 53890, title: 'Experiment Risk Tiers', skip: false },
  { id: 53891, title: 'Experiment Success Attribution', skip: false },
  { id: 53892, title: 'Experiment Data Retention', skip: false },
  { id: 53893, title: 'Experiment Champion Roles', skip: false },
  { id: 53894, title: 'Annual Experiment Impact Report', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}

/** Idea 53881 — Experiment Tooling. Input records: {experimentId, setupSteps, requiredSteps, selfServiceEligible, needsSupport}. Readiness is required steps covered over required total; self-service launches need full coverage without support tickets. Self-service tooling for researchers to launch simple A/B tests. */
export function buildExperimentTooling(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const setupSteps = num(r.setupSteps, 0);
    const requiredSteps = Math.max(1, num(r.requiredSteps, 1));
    const readiness = rate(Math.min(setupSteps, requiredSteps), requiredSteps);
    const selfServiceEligible = Boolean(r.selfServiceEligible ?? r.eligible);
    const needsSupport = Boolean(r.needsSupport);
    const launchable = readiness >= 1 && selfServiceEligible && !needsSupport;
    return { key: experimentId, experimentId, setupSteps, requiredSteps, readiness, selfServiceEligible, needsSupport, launchable, status: launchable ? 'self-service-ready' : readiness >= 0.7 ? 'nearly-ready' : 'needs-setup' };
  }).sort((a, b) => b.readiness - a.readiness || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.launchable).length;
  return { rows, count: rows.length, readyCount, supportedCount: rows.filter(r => r.needsSupport).length, averageReadiness: mean(rows.map(r => r.readiness)), top: rows[0] || null, summary: `Infinity AI checked tooling for ${rows.length} experiment(s); ${readyCount} are self-service ready.` };
}
/** Idea 53882 — Experiment Review Boards. Input records: {experimentId, riskScore, cost, approvals, requiredApprovals}. Board review triggers on high risk or high cost; approval needs the required approvals with no unresolved risk flag. Board that approves high-risk or high-cost experiments. */
export function routeExperimentReviewBoards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const riskScore = round2(clamp01(r.riskScore ?? r.risk));
    const cost = num(r.cost, 0);
    const needsBoard = riskScore >= 0.7 || cost >= 10000;
    const approvals = num(r.approvals, 0);
    const requiredApprovals = Math.max(1, num(r.requiredApprovals, 2));
    const approved = !needsBoard || approvals >= requiredApprovals;
    return { key: experimentId, experimentId, riskScore, cost, needsBoard, approvals, requiredApprovals, approved, status: !needsBoard ? 'no-board-needed' : approved ? 'board-approved' : 'awaiting-board' };
  }).sort((a, b) => Number(b.needsBoard) - Number(a.needsBoard) || b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const boardCount = rows.filter(r => r.needsBoard).length;
  return { rows, count: rows.length, boardCount, approvedCount: rows.filter(r => r.approved).length, awaitingCount: rows.filter(r => r.status === 'awaiting-board').length, top: rows[0] || null, summary: `Infinity AI routed ${boardCount} of ${rows.length} experiment(s) to the review board.` };
}
/** Idea 53883 — Experiment Metric Hierarchies. Input records: {experimentId, primaryMetric, secondaryCount, guardrailCount}. A complete hierarchy has one primary metric, at least one secondary, and at least one guardrail. Defines primary, secondary, and guardrail metrics for every experiment. */
export function defineMetricHierarchies(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const primaryMetric = String(r.primaryMetric || r.primary || '').trim();
    const secondaryCount = num(r.secondaryCount ?? r.secondaries, 0);
    const guardrailCount = num(r.guardrailCount ?? r.guardrails, 0);
    const checks = { primary: primaryMetric.length > 0, secondaries: secondaryCount >= 1, guardrails: guardrailCount >= 1 };
    const checksPassed = Object.values(checks).filter(Boolean).length;
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    return { key: experimentId, experimentId, primaryMetric, secondaryCount, guardrailCount, checks, checksPassed, missing, complete: checksPassed === 3 };
  }).sort((a, b) => b.checksPassed - a.checksPassed || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, incompleteCount: rows.length - completeCount, top: rows[0] || null, summary: `Infinity AI defined metric hierarchies for ${rows.length} experiment(s); ${completeCount} are complete.` };
}
/** Idea 53884 — Experiment Novelty Effects. Input records: {experimentId, earlyEffect, lateEffect}. Novelty fade is the late effect falling below seventy percent of the early effect while the early effect was positive. Measures whether variant performance fades after the novelty wears off. */
export function measureNoveltyEffects(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const earlyEffect = round2(num(r.earlyEffect, 0));
    const lateEffect = round2(num(r.lateEffect, 0));
    const retention = earlyEffect !== 0 ? round2(lateEffect / earlyEffect) : (lateEffect === 0 ? 1 : 0);
    const faded = earlyEffect > 0 && retention < 0.7;
    return { key: experimentId, experimentId, earlyEffect, lateEffect, retention, faded, status: faded ? 'novelty-faded' : earlyEffect > 0 ? 'durable' : 'no-early-effect' };
  }).sort((a, b) => a.retention - b.retention || String(a.key).localeCompare(String(b.key)));
  const fadedCount = rows.filter(r => r.faded).length;
  return { rows, count: rows.length, fadedCount, durableCount: rows.filter(r => r.status === 'durable').length, top: rows[0] || null, summary: `Infinity AI measured novelty effects in ${rows.length} experiment(s); ${fadedCount} faded after novelty wore off.` };
}
/** Idea 53885 — Experiment Cross-Validation. Input records: {experimentId, trainingEffect, holdoutEffect, holdoutHunts, minHoldoutHunts}. A winner validates when the holdout keeps the training sign, retains at least half the effect, and clears the holdout size bar. Validates experiment winners on holdout target sets. */
export function crossValidateExperiments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const trainingEffect = round2(num(r.trainingEffect, 0));
    const holdoutEffect = round2(num(r.holdoutEffect, 0));
    const holdoutHunts = num(r.holdoutHunts, 0);
    const minHoldoutHunts = num(r.minHoldoutHunts, 50);
    const sameSign = Math.sign(holdoutEffect) === Math.sign(trainingEffect) && trainingEffect !== 0;
    const retained = Math.abs(holdoutEffect) >= Math.abs(trainingEffect) * 0.5;
    const enoughData = holdoutHunts >= minHoldoutHunts;
    const validated = sameSign && retained && enoughData;
    return { key: experimentId, experimentId, trainingEffect, holdoutEffect, holdoutHunts, minHoldoutHunts, retainedShare: trainingEffect ? round2(holdoutEffect / trainingEffect) : 0, sameSign, enoughData, validated, status: validated ? 'validated' : 'not-validated' };
  }).sort((a, b) => Number(b.validated) - Number(a.validated) || String(a.key).localeCompare(String(b.key)));
  const validatedCount = rows.filter(r => r.validated).length;
  return { rows, count: rows.length, validatedCount, pendingCount: rows.length - validatedCount, top: rows[0] || null, summary: `Infinity AI cross-validated ${rows.length} experiment winner(s); ${validatedCount} held up on holdout targets.` };
}
/** Idea 53886 — Experiment Publication Standards. Input records: {experimentId, wordCount, minWords, sections, requiredSections, citations}. Publication-ready writeups clear the word floor, cover every required section, and cite sources. Standards for writing up experiments for internal publication. */
export function checkPublicationStandards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const wordCount = num(r.wordCount, 0);
    const minWords = num(r.minWords, 500);
    const sections = num(r.sections, 0);
    const requiredSections = Math.max(1, num(r.requiredSections, 4));
    const citations = num(r.citations, 0);
    const gaps = [];
    if (wordCount < minWords) gaps.push('too-short');
    if (sections < requiredSections) gaps.push('missing-sections');
    if (citations < 1) gaps.push('no-citations');
    return { key: experimentId, experimentId, wordCount, minWords, sections, requiredSections, citations, gaps, publishReady: gaps.length === 0, completeness: round2(Math.min(1, wordCount / Math.max(1, minWords)) * 0.5 + Math.min(1, sections / requiredSections) * 0.5) };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.publishReady).length;
  return { rows, count: rows.length, readyCount, blockedCount: rows.length - readyCount, top: rows[0] || null, summary: `Infinity AI checked publication standards for ${rows.length} writeup(s); ${readyCount} are publication-ready.` };
}
/** Idea 53887 — Experiment Knowledge Sharing. Input records: {experimentId, channels, audienceSize, views}. Reach weighs views against the intended audience across the channels a learning was shared on. Shares experiment learnings in team forums and digests. */
export function shareExperimentKnowledge(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const channels = Array.isArray(r.channels) ? r.channels.map(String) : [];
    const audienceSize = num(r.audienceSize ?? r.audience, 0);
    const views = num(r.views, 0);
    const reachRate = rate(views, audienceSize);
    return { key: experimentId, experimentId, channels, channelCount: channels.length, audienceSize, views, reachRate, widelyShared: channels.length >= 2 && reachRate >= 0.5, status: channels.length === 0 ? 'unshared' : reachRate >= 0.5 ? 'well-shared' : 'shared' };
  }).sort((a, b) => b.reachRate - a.reachRate || b.channelCount - a.channelCount || String(a.key).localeCompare(String(b.key)));
  const sharedCount = rows.filter(r => r.channelCount > 0).length;
  return { rows, count: rows.length, sharedCount, unsharedCount: rows.length - sharedCount, widelySharedCount: rows.filter(r => r.widelyShared).length, totalViews: rows.reduce((s, r) => s + r.views, 0), top: rows[0] || null, summary: `Infinity AI shared learnings from ${sharedCount} of ${rows.length} experiment(s) with the team.` };
}
/** Idea 53888 — Experiment Automation. Input records: {experimentId, stepsTotal, stepsAutomated, manualMinutesSaved}. Automation rate is automated over total steps; savings convert saved minutes into saved hours. Automates routine experiment setup, monitoring, and analysis. */
export function automateExperiments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const stepsTotal = Math.max(1, num(r.stepsTotal ?? r.totalSteps, 1));
    const stepsAutomated = Math.min(stepsTotal, num(r.stepsAutomated, 0));
    const savedMinutes = num(r.manualMinutesSaved ?? r.minutesSaved, 0);
    return { key: experimentId, experimentId, stepsTotal, stepsAutomated, automationRate: rate(stepsAutomated, stepsTotal), savedMinutes, savedHours: round2(savedMinutes / 60), fullyAutomated: stepsAutomated >= stepsTotal };
  }).sort((a, b) => b.automationRate - a.automationRate || String(a.key).localeCompare(String(b.key)));
  const totalSaved = round2(rows.reduce((s, r) => s + r.savedMinutes, 0));
  return { rows, count: rows.length, fullyAutomatedCount: rows.filter(r => r.fullyAutomated).length, totalSavedMinutes: totalSaved, totalSavedHours: round2(totalSaved / 60), averageRate: mean(rows.map(r => r.automationRate)), top: rows[0] || null, summary: `Infinity AI automated experiment routines across ${rows.length} experiment(s), saving ${round2(totalSaved / 60)} hour(s).` };
}
/** Idea 53889 — Experiment Portfolio Reviews. Input records: {experimentId, impact, cost, quarter}. Portfolio return divides total impact by total cost; each experiment is a net contributor when its impact exceeds its cost. Quarterly reviews of the experiment portfolio's cumulative impact. */
export function reviewExperimentPortfolio(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const impact = round2(num(r.impact, 0));
    const cost = round2(num(r.cost, 0));
    return { key: experimentId, experimentId, impact, cost, quarter: String(r.quarter || 'Q?'), net: round2(impact - cost), returnRatio: cost > 0 ? round2(impact / cost) : 0, contributor: impact > cost };
  }).sort((a, b) => b.net - a.net || String(a.key).localeCompare(String(b.key)));
  const totalImpact = round2(rows.reduce((s, r) => s + r.impact, 0));
  const totalCost = round2(rows.reduce((s, r) => s + r.cost, 0));
  const quarters = [...new Set(rows.map(r => r.quarter))].sort();
  return { rows, count: rows.length, totalImpact, totalCost, portfolioReturn: totalCost > 0 ? round2(totalImpact / totalCost) : 0, contributorCount: rows.filter(r => r.contributor).length, quarters, top: rows[0] || null, summary: `Infinity AI reviewed a portfolio of ${rows.length} experiment(s) returning ${totalCost > 0 ? round2(totalImpact / totalCost) : 0}x on cost.` };
}
/** Idea 53890 — Experiment Risk Tiers. Input records: {experimentId, targetRisk, dataRisk, scale}. Risk blends target and data risk scaled by reach; tiers run low, standard, elevated, and critical with proportional oversight. Tiers experiments by risk with proportional oversight. */
export function tierExperimentRisk(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const targetRisk = round2(clamp01(r.targetRisk));
    const dataRisk = round2(clamp01(r.dataRisk));
    const scale = round2(clamp01(r.scale));
    const riskScore = round2(0.45 * targetRisk + 0.35 * dataRisk + 0.2 * scale);
    const tier = riskScore >= 0.75 ? 'critical' : riskScore >= 0.5 ? 'elevated' : riskScore >= 0.25 ? 'standard' : 'low';
    const oversight = { low: 'self-serve', standard: 'peer-check', elevated: 'board-review', critical: 'board-plus-owner' }[tier];
    return { key: experimentId, experimentId, targetRisk, dataRisk, scale, riskScore, tier, oversight };
  }).sort((a, b) => b.riskScore - a.riskScore || String(a.key).localeCompare(String(b.key)));
  const tierCounts = {};
  for (const row of rows) tierCounts[row.tier] = (tierCounts[row.tier] || 0) + 1;
  return { rows, count: rows.length, tierCounts, criticalCount: tierCounts.critical || 0, top: rows[0] || null, summary: `Infinity AI tiered risk for ${rows.length} experiment(s); ${tierCounts.critical || 0} are critical.` };
}
/** Idea 53891 — Experiment Success Attribution. Input records: {experimentId, fleetImprovement, contributionShare, adopted}. Attributed impact is the fleet improvement times the contribution share, counted only for adopted winners. Attributes fleet-wide improvements to the experiments that caused them. */
export function attributeExperimentSuccess(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const fleetImprovement = round2(num(r.fleetImprovement, 0));
    const contributionShare = round2(clamp01(r.contributionShare ?? r.share));
    const adopted = Boolean(r.adopted);
    const attributedImpact = adopted ? round2(fleetImprovement * contributionShare) : 0;
    return { key: experimentId, experimentId, fleetImprovement, contributionShare, adopted, attributedImpact, credible: adopted && contributionShare >= 0.2 };
  }).sort((a, b) => b.attributedImpact - a.attributedImpact || String(a.key).localeCompare(String(b.key)));
  const totalAttributed = round2(rows.reduce((s, r) => s + r.attributedImpact, 0));
  const attributedShares = round2(rows.reduce((s, r) => s + (r.adopted ? r.contributionShare : 0), 0));
  return { rows, count: rows.length, totalAttributed, attributedShares, unattributedShare: round2(Math.max(0, 1 - attributedShares)), credibleCount: rows.filter(r => r.credible).length, top: rows[0] || null, summary: `Infinity AI attributed ${totalAttributed} of fleet improvement across ${rows.length} experiment(s).` };
}
/** Idea 53892 — Experiment Data Retention. Input records: {experimentId, dataType, ageDays, retentionDays}. Data is expired once its age passes the retention window; archival keeps expired data cheap instead of deleting insight. Defines how long experiment data is kept for re-analysis. */
export function planExperimentDataRetention(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const ageDays = num(r.ageDays, 0);
    const retentionDays = Math.max(1, num(r.retentionDays, 1));
    const expired = ageDays > retentionDays;
    return { key: experimentId, experimentId, dataType: String(r.dataType || 'results'), ageDays, retentionDays, daysLeft: Math.max(0, retentionDays - ageDays), ageRatio: round2(ageDays / retentionDays), expired, action: expired ? 'archive' : 'retain' };
  }).sort((a, b) => b.ageRatio - a.ageRatio || String(a.key).localeCompare(String(b.key)));
  const expiredCount = rows.filter(r => r.expired).length;
  return { rows, count: rows.length, expiredCount, retainedCount: rows.length - expiredCount, top: rows[0] || null, summary: `Infinity AI planned retention for ${rows.length} experiment data set(s); ${expiredCount} are due for archival.` };
}
/** Idea 53893 — Experiment Champion Roles. Input records: {experimentId, champion, backup, huntsLed}. Coverage needs a named champion and a backup; champion load counts experiments per person. Assigns champions responsible for each experiment's success. */
export function assignExperimentChampions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const champion = String(r.champion || '').trim();
    const backup = String(r.backup || '').trim();
    const huntsLed = num(r.huntsLed, 0);
    const covered = champion.length > 0 && backup.length > 0;
    return { key: experimentId, experimentId, champion, backup, huntsLed, covered, status: !champion ? 'no-champion' : !backup ? 'no-backup' : 'covered' };
  }).sort((a, b) => Number(b.covered) - Number(a.covered) || b.huntsLed - a.huntsLed || String(a.key).localeCompare(String(b.key)));
  const load = new Map();
  for (const row of rows) if (row.champion) load.set(row.champion, (load.get(row.champion) || 0) + 1);
  const championLoads = [...load.entries()].map(([champion, experiments]) => ({ champion, experiments })).sort((a, b) => b.experiments - a.experiments || String(a.champion).localeCompare(String(b.champion)));
  const coveredCount = rows.filter(r => r.covered).length;
  return { rows, count: rows.length, coveredCount, uncoveredCount: rows.length - coveredCount, championLoads, busiestChampion: championLoads[0] || null, top: rows[0] || null, summary: `Infinity AI assigned champions for ${rows.length} experiment(s); ${coveredCount} have a champion and a backup.` };
}
/** Idea 53894 — Annual Experiment Impact Report. Input records: {experimentId, year, effect, adopted, findingsValue}. The annual report sums adopted winners, their effects, and the value they produced for the year. Yearly report on what A/B testing taught the organization. */
export function buildAnnualImpactReport(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const year = num(r.year, 0);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(r);
  }
  const rows = [...groups.entries()].map(([year, items]) => {
    const adoptedItems = items.filter(i => Boolean(i.adopted));
    const totalValue = round2(adoptedItems.reduce((s, i) => s + num(i.findingsValue ?? i.value, 0), 0));
    const totalEffect = round2(adoptedItems.reduce((s, i) => s + num(i.effect, 0), 0));
    return { key: `year-${year}`, year, experiments: items.length, adoptedCount: adoptedItems.length, adoptionRate: rate(adoptedItems.length, items.length), totalEffect, averageEffect: mean(adoptedItems.map(i => num(i.effect, 0))), totalValue, lessonsLearned: items.length };
  }).sort((a, b) => a.year - b.year);
  const latest = rows[rows.length - 1] || null;
  const totalExperiments = rows.reduce((s, r) => s + r.experiments, 0);
  return { rows, count: rows.length, yearCount: rows.length, totalExperiments, latestYear: latest, top: latest, summary: `Infinity AI compiled the annual experiment impact report over ${rows.length} year(s) and ${totalExperiments} experiment(s).` };
}
