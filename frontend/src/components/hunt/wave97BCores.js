/**
 * wave97BCores.js — Infinity AI · Wave 97B
 * Experiment analysis, validity, and lifecycle, ideas 53861–53880:
 * heterogeneous treatment effects, experiment monitoring alerts,
 * experiment documentation standards, experiment peer review, longitudinal
 * experiment tracking, experiment contamination checks, experiment sample
 * representativeness, experiment fatigue management, experiment incentive
 * alignment, experiment communication templates, experiment data quality
 * gates, Bayesian experiment analysis, experiment segment analysis,
 * experiment external validity, the experiment registry, experiment
 * reproducibility packages, experiment kill criteria, experiment winner
 * adoption tracking, the experiment calendar, and experiment
 * retrospective templates.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE97_B_IDEAS = [
  { id: 53861, title: 'Heterogeneous Treatment Effects', skip: false },
  { id: 53862, title: 'Experiment Monitoring Alerts', skip: false },
  { id: 53863, title: 'Experiment Documentation Standards', skip: false },
  { id: 53864, title: 'Experiment Peer Review', skip: false },
  { id: 53865, title: 'Longitudinal Experiment Tracking', skip: false },
  { id: 53866, title: 'Experiment Contamination Checks', skip: false },
  { id: 53867, title: 'Experiment Sample Representativeness', skip: false },
  { id: 53868, title: 'Experiment Fatigue Management', skip: false },
  { id: 53869, title: 'Experiment Incentive Alignment', skip: false },
  { id: 53870, title: 'Experiment Communication Templates', skip: false },
  { id: 53871, title: 'Experiment Data Quality Gates', skip: false },
  { id: 53872, title: 'Bayesian Experiment Analysis', skip: false },
  { id: 53873, title: 'Experiment Segment Analysis', skip: false },
  { id: 53874, title: 'Experiment External Validity', skip: false },
  { id: 53875, title: 'Experiment Registry (learning)', skip: false },
  { id: 53876, title: 'Experiment Reproducibility Packages', skip: false },
  { id: 53877, title: 'Experiment Kill Criteria', skip: false },
  { id: 53878, title: 'Experiment Winner Adoption Tracking', skip: false },
  { id: 53879, title: 'Experiment Calendar', skip: false },
  { id: 53880, title: 'Experiment Retrospective Templates', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.entryId||it.id||it.name||fb);}
function normalCdf(z){const t=1/(1+0.2316419*Math.abs(z));const d=0.3989423*Math.exp(-(z*z)/2);const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}

/** Idea 53861 — Heterogeneous Treatment Effects. Input records: {cohort, variantEffect, baselineEffect, sampleSize}. Lift is variant minus baseline per cohort; cohorts under 30 hunts are flagged low-sample and excluded from the most-responsive pick. Analyzes whether strategy variants work better for certain researcher cohorts. */
export function analyzeTreatmentEffects(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const cohort = String(r.cohort || 'cohort');
    const variantEffect = round2(num(r.variantEffect, 0));
    const baselineEffect = round2(num(r.baselineEffect, 0));
    const sampleSize = num(r.sampleSize ?? r.samples, 0);
    return { key: cohort, cohort, variantEffect, baselineEffect, sampleSize, lift: round2(variantEffect - baselineEffect), reliable: sampleSize >= 30 };
  }).sort((a, b) => b.lift - a.lift || String(a.key).localeCompare(String(b.key)));
  const reliable = rows.filter(r => r.reliable);
  const mostResponsive = reliable[0] || null;
  const lifts = rows.map(r => r.lift);
  const heterogeneity = rows.length ? round2(Math.max(...lifts) - Math.min(...lifts)) : 0;
  return { rows, count: rows.length, reliableCount: reliable.length, mostResponsive, heterogeneity, top: mostResponsive, summary: `Infinity AI compared treatment effects across ${rows.length} cohort(s); spread is ${heterogeneity}.` };
}
/** Idea 53862 — Experiment Monitoring Alerts. Input records: {experimentId, variant, recentWinRate, baselineWinRate, variantSamples}. A variant collapsed when its recent rate falls to half its baseline or lower with at least twenty hunts behind it. Alerts experiment owners to anomalies like sudden variant collapse. */
export function detectExperimentMonitoringAlerts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const variant = String(r.variant || 'variant');
    const recentWinRate = round2(clamp01(r.recentWinRate));
    const baselineWinRate = round2(clamp01(r.baselineWinRate));
    const variantSamples = num(r.variantSamples ?? r.samples, 0);
    const dropRatio = baselineWinRate > 0 ? round2(recentWinRate / baselineWinRate) : 1;
    const collapsed = variantSamples >= 20 && dropRatio <= 0.5;
    return { key: `${experimentId}|${variant}`, experimentId, variant, recentWinRate, baselineWinRate, variantSamples, dropRatio, collapsed, alert: collapsed, severity: collapsed ? (dropRatio <= 0.25 ? 'critical' : 'high') : 'none' };
  }).sort((a, b) => Number(b.alert) - Number(a.alert) || a.dropRatio - b.dropRatio || String(a.key).localeCompare(String(b.key)));
  const alertCount = rows.filter(r => r.alert).length;
  return { rows, count: rows.length, alertCount, alertIds: rows.filter(r => r.alert).map(r => r.experimentId), top: rows[0] || null, summary: `Infinity AI monitored ${rows.length} variant(s); ${alertCount} collapsed against baseline.` };
}
/** Idea 53863 — Experiment Documentation Standards. Input records: {experimentId, hypothesis, primaryMetric, analysisPlan, startDay, endDay, registeredDay, launchDay}. Five checks: hypothesis, metric, plan, a sane timeline, and registration before launch. Requires pre-registration of hypotheses, metrics, and analysis plans. */
export function validateExperimentDocumentation(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const checks = {
      hypothesis: String(r.hypothesis || '').trim().length > 0,
      primaryMetric: String(r.primaryMetric || r.metric || '').trim().length > 0,
      analysisPlan: String(r.analysisPlan || '').trim().length > 0,
      timeline: num(r.endDay, 0) > num(r.startDay, 0),
      preRegistered: num(r.registeredDay, 0) <= num(r.launchDay, 0),
    };
    const checksPassed = Object.values(checks).filter(Boolean).length;
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    return { key: experimentId, experimentId, checks, checksPassed, missing, preRegistered: checks.preRegistered, compliant: checksPassed === 5 };
  }).sort((a, b) => b.checksPassed - a.checksPassed || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI validated documentation for ${rows.length} experiment(s); ${compliantCount} meet the standard.` };
}
/** Idea 53864 — Experiment Peer Review. Input records: {experimentId, approvals, rejections, blockers}. Designs are approved with two or more approvals and no blockers; any blocker forces changes. Peer-reviews experiment designs before launch. */
export function reviewExperimentPeerDesigns(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const approvals = num(r.approvals, 0);
    const rejections = num(r.rejections, 0);
    const blockers = num(r.blockers, 0);
    const status = blockers > 0 || rejections > approvals ? 'changes-requested' : approvals >= 2 ? 'approved' : 'pending';
    return { key: experimentId, experimentId, approvals, rejections, blockers, status, approved: status === 'approved' };
  }).sort((a, b) => ({ approved: 0, pending: 1, 'changes-requested': 2 }[a.status] - { approved: 0, pending: 1, 'changes-requested': 2 }[b.status]) || String(a.key).localeCompare(String(b.key)));
  const approvedCount = rows.filter(r => r.approved).length;
  return { rows, count: rows.length, approvedCount, pendingCount: rows.filter(r => r.status === 'pending').length, top: rows[0] || null, summary: `Infinity AI peer-reviewed ${rows.length} experiment design(s); ${approvedCount} are approved.` };
}
/** Idea 53865 — Longitudinal Experiment Tracking. Input records: {experimentId, month, effect}. Retention is the latest monthly effect over the first; winners fade below half retention or on a sign flip. Tracks whether winning variants stay winners over months. */
export function trackLongitudinalExperiments(records = []) {
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    if (!groups.has(experimentId)) groups.set(experimentId, []);
    groups.get(experimentId).push({ month: num(r.month, 0), effect: round2(num(r.effect, 0)) });
  }
  const rows = [...groups.entries()].map(([experimentId, months]) => {
    const sorted = [...months].sort((a, b) => a.month - b.month);
    const firstEffect = sorted.length ? sorted[0].effect : 0;
    const latestEffect = sorted.length ? sorted[sorted.length - 1].effect : 0;
    const retention = firstEffect !== 0 ? round2(latestEffect / firstEffect) : (latestEffect === 0 ? 1 : 0);
    const signFlip = (firstEffect > 0 && latestEffect < 0) || (firstEffect < 0 && latestEffect > 0);
    const status = sorted.length < 2 ? 'insufficient-data' : (signFlip || retention < 0.5) ? 'faded' : 'persistent';
    return { key: experimentId, experimentId, observations: sorted.length, firstEffect, latestEffect, retention, status, persistent: status === 'persistent' };
  }).sort((a, b) => Number(b.persistent) - Number(a.persistent) || String(a.key).localeCompare(String(b.key)));
  const persistentCount = rows.filter(r => r.persistent).length;
  const fadedCount = rows.filter(r => r.status === 'faded').length;
  return { rows, count: rows.length, persistentCount, fadedCount, top: rows[0] || null, summary: `Infinity AI tracked ${rows.length} experiment(s) over time; ${persistentCount} stayed winners.` };
}
/** Idea 53866 — Experiment Contamination Checks. Input records: {huntId, experimentId, assignedVariant, exposedVariant}. A hunt is contaminated when exposure differs from assignment; groups over five percent contamination are flagged. Checks that control-group hunts were not accidentally exposed to the variant. */
export function checkExperimentContamination(records = [], threshold = 0.05) {
  const limit = num(threshold, 0.05);
  const list = Array.isArray(records) ? records : [];
  const contaminatedHunts = list.filter(r => String(r.exposedVariant || '') !== String(r.assignedVariant || '')).length;
  const groups = new Map();
  for (const r of list) {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    if (!groups.has(experimentId)) groups.set(experimentId, { total: 0, contaminated: 0 });
    const g = groups.get(experimentId);
    g.total += 1;
    if (String(r.exposedVariant || '') !== String(r.assignedVariant || '')) g.contaminated += 1;
  }
  const rows = [...groups.entries()].map(([experimentId, g]) => {
    const contaminationRate = rate(g.contaminated, g.total);
    return { key: experimentId, experimentId, total: g.total, contaminated: g.contaminated, contaminationRate, flagged: contaminationRate > limit };
  }).sort((a, b) => b.contaminationRate - a.contaminationRate || String(a.key).localeCompare(String(b.key)));
  const flaggedCount = rows.filter(r => r.flagged).length;
  return { rows, count: rows.length, huntCount: list.length, contaminatedCount: contaminatedHunts, overallRate: rate(contaminatedHunts, list.length), flaggedCount, top: rows[0] || null, summary: `Infinity AI checked ${list.length} hunt(s) for contamination; ${flaggedCount} experiment(s) exceed the threshold.` };
}
/** Idea 53867 — Experiment Sample Representativeness. Input records: {segment, populationShare, sampleShare}. Deviation is the absolute share gap; segments within ten points represent the population. Verifies experiment targets represent the broader target population. */
export function checkSampleRepresentativeness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const segment = String(r.segment || 'segment');
    const populationShare = round2(clamp01(r.populationShare));
    const sampleShare = round2(clamp01(r.sampleShare));
    const deviation = round2(Math.abs(sampleShare - populationShare));
    return { key: segment, segment, populationShare, sampleShare, deviation, representative: deviation <= 0.1 };
  }).sort((a, b) => b.deviation - a.deviation || String(a.key).localeCompare(String(b.key)));
  const representativeCount = rows.filter(r => r.representative).length;
  const meanDeviation = mean(rows.map(r => r.deviation));
  return { rows, count: rows.length, representativeCount, meanDeviation, representativenessScore: round2(1 - meanDeviation), top: rows[0] || null, summary: `Infinity AI checked representativeness for ${rows.length} segment(s); score is ${round2(1 - meanDeviation)}.` };
}
/** Idea 53868 — Experiment Fatigue Management. Input records: {researcher, concurrentExperiments, limit}. Utilization is concurrent load over the personal limit; researchers above it are overloaded. Limits how many concurrent experiments a researcher participates in. */
export function manageExperimentFatigue(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const concurrentExperiments = num(r.concurrentExperiments ?? r.concurrent, 0);
    const limit = Math.max(1, num(r.limit, 1));
    return { key: researcher, researcher, concurrentExperiments, limit, utilization: round2(concurrentExperiments / limit), overLimit: concurrentExperiments > limit, headroom: Math.max(0, limit - concurrentExperiments) };
  }).sort((a, b) => b.utilization - a.utilization || String(a.key).localeCompare(String(b.key)));
  const overLimitCount = rows.filter(r => r.overLimit).length;
  const totalLoad = rows.reduce((s, r) => s + r.concurrentExperiments, 0);
  return { rows, count: rows.length, overLimitCount, totalLoad, averageLoad: mean(rows.map(r => r.concurrentExperiments)), top: rows[0] || null, summary: `Infinity AI tracked experiment load for ${rows.length} researcher(s); ${overLimitCount} are over their limit.` };
}
/** Idea 53869 — Experiment Incentive Alignment. Input records: {researcher, controlHunts, variantHunts, controlReward, variantReward}. Researchers running at least forty percent control hunts are misaligned when control rewards fall below eighty percent of variant rewards. Ensures researchers are not penalized for running control-group variants. */
export function alignExperimentIncentives(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const researcher = String(r.researcher || 'researcher');
    const controlHunts = num(r.controlHunts, 0);
    const variantHunts = num(r.variantHunts, 0);
    const controlReward = round2(num(r.controlReward, 0));
    const variantReward = round2(num(r.variantReward, 0));
    const totalHunts = controlHunts + variantHunts;
    const controlShare = rate(controlHunts, totalHunts);
    const rewardRatio = variantReward > 0 ? round2(controlReward / variantReward) : 1;
    const misaligned = controlShare >= 0.4 && rewardRatio < 0.8;
    return { key: researcher, researcher, controlHunts, variantHunts, controlShare, controlReward, variantReward, rewardRatio, misaligned, aligned: !misaligned };
  }).sort((a, b) => Number(b.misaligned) - Number(a.misaligned) || a.rewardRatio - b.rewardRatio || String(a.key).localeCompare(String(b.key)));
  const misalignedCount = rows.filter(r => r.misaligned).length;
  return { rows, count: rows.length, misalignedCount, alignedCount: rows.length - misalignedCount, top: rows[0] || null, summary: `Infinity AI checked incentive alignment for ${rows.length} researcher(s); ${misalignedCount} are penalized for control work.` };
}
/** Idea 53870 — Experiment Communication Templates. Input records: {experimentId, owner, outcome}; the template name selects the announcement shape. Four templates cover announcements, results, guardrail pauses, and wrap-ups. Templates for announcing experiments and results to the team. */
export function renderExperimentCommunication(records = [], template = 'announcement') {
  const templates = {
    announcement: r => `Infinity AI announcement: ${r.owner} launched experiment ${r.experimentId}.`,
    results: r => `Infinity AI results: experiment ${r.experimentId} finished with outcome ${r.outcome}, reported by ${r.owner}.`,
    'guardrail-pause': r => `Infinity AI guardrail pause: experiment ${r.experimentId} was paused by ${r.owner} pending review.`,
    'wrap-up': r => `Infinity AI wrap-up: experiment ${r.experimentId} closed with outcome ${r.outcome}; owner ${r.owner} published the retrospective.`,
  };
  const chosen = templates[template] ? template : 'announcement';
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const item = { experimentId: String(r.experimentId || r.experiment || 'experiment'), owner: String(r.owner || 'owner'), outcome: String(r.outcome || 'pending') };
    return { key: item.experimentId, ...item, template: chosen, message: templates[chosen](item) };
  });
  return { rows, count: rows.length, template: chosen, templatesAvailable: Object.keys(templates).length, top: rows[0] || null, summary: `Infinity AI rendered ${rows.length} experiment message(s) with the ${chosen} template.` };
}
/** Idea 53871 — Experiment Data Quality Gates. Input records: {experimentId, totalRows, nullRate, duplicateRate, missingAssignmentRate}. The gate blocks analysis when nulls, duplicates, or missing assignments exceed strict limits. Validates experiment data quality before analysis. */
export function gateExperimentDataQuality(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const nullRate = round2(clamp01(r.nullRate));
    const duplicateRate = round2(clamp01(r.duplicateRate));
    const missingAssignmentRate = round2(clamp01(r.missingAssignmentRate ?? r.missingRate));
    const failures = [];
    if (nullRate > 0.02) failures.push('nulls');
    if (duplicateRate > 0.01) failures.push('duplicates');
    if (missingAssignmentRate > 0.01) failures.push('missing-assignments');
    return { key: experimentId, experimentId, totalRows: num(r.totalRows ?? r.rows, 0), nullRate, duplicateRate, missingAssignmentRate, qualityScore: round2(Math.max(0, 1 - (nullRate + duplicateRate + missingAssignmentRate))), failures, passed: failures.length === 0 };
  }).sort((a, b) => Number(b.passed) - Number(a.passed) || a.qualityScore - b.qualityScore || String(a.key).localeCompare(String(b.key)));
  const passedCount = rows.filter(r => r.passed).length;
  const blockedIds = rows.filter(r => !r.passed).map(r => r.experimentId);
  return { rows, count: rows.length, passedCount, blockedCount: rows.length - passedCount, blockedIds, top: rows[rows.length - 1] || null, summary: `Infinity AI gated data quality for ${rows.length} experiment(s); ${rows.length - passedCount} are blocked from analysis.` };
}
/** Idea 53872 — Bayesian Experiment Analysis. Input records: {variant, wins, losses}. A Beta(1,1) prior gives each variant a posterior mean and interval, and pairwise normal approximations estimate the probability each variant is best. Uses Bayesian methods to quantify probability each variant is best. */
export function analyzeBayesianExperiment(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const variant = String(r.variant || 'variant');
    const wins = num(r.wins, 0);
    const losses = num(r.losses, 0);
    const trials = wins + losses;
    const posteriorMean = (wins + 1) / (trials + 2);
    const variance = (posteriorMean * (1 - posteriorMean)) / (trials + 3);
    return { key: variant, variant, wins, losses, trials, posteriorMean: round2(posteriorMean), variance, credibleLower: round2(posteriorMean - 1.96 * Math.sqrt(variance)), credibleUpper: round2(posteriorMean + 1.96 * Math.sqrt(variance)) };
  });
  for (const row of rows) {
    let prob = 1;
    for (const other of rows) {
      if (other.key === row.key) continue;
      const sd = Math.sqrt(row.variance + other.variance);
      prob *= sd > 0 ? normalCdf((row.posteriorMean - other.posteriorMean) / sd) : 0.5;
    }
    row.probBest = round2(prob);
  }
  rows.sort((a, b) => b.probBest - a.probBest || String(a.key).localeCompare(String(b.key)));
  const recommended = rows[0] || null;
  return { rows, count: rows.length, recommended, top: recommended, summary: `Infinity AI ran Bayesian analysis on ${rows.length} variant(s); ${recommended ? recommended.variant : 'none'} is most likely best.` };
}
/** Idea 53873 — Experiment Segment Analysis. Input records: {segment, dimension, variantEffect, hunts}. Effects are ranked inside each dimension to find where a variant wins and where it does not. Breaks results down by target class, researcher tenure, and stack. */
export function analyzeExperimentSegments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const segment = String(r.segment || 'segment');
    const dimension = String(r.dimension || 'dimension');
    return { key: `${dimension}|${segment}`, segment, dimension, variantEffect: round2(num(r.variantEffect ?? r.effect, 0)), hunts: num(r.hunts, 0) };
  }).sort((a, b) => b.variantEffect - a.variantEffect || String(a.key).localeCompare(String(b.key)));
  const byDimension = new Map();
  for (const row of rows) if (!byDimension.has(row.dimension)) byDimension.set(row.dimension, row);
  const dimensionWinners = [...byDimension.entries()].map(([dimension, row]) => ({ dimension, segment: row.segment, variantEffect: row.variantEffect })).sort((a, b) => String(a.dimension).localeCompare(String(b.dimension)));
  return { rows, count: rows.length, dimensionCount: byDimension.size, dimensionWinners, strongest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI analyzed ${rows.length} segment(s) across ${byDimension.size} dimension(s).` };
}
/** Idea 53874 — Experiment External Validity. Input records: {experimentId, labRealismScore, conditionMatchScore, targetRepresentativeness}. Validity weights realism most; experiments at 0.7 or above are expected to generalize to real hunts. Assesses whether lab-like experiment conditions match real hunts. */
export function assessExternalValidity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const labRealismScore = round2(clamp01(r.labRealismScore ?? r.realism));
    const conditionMatchScore = round2(clamp01(r.conditionMatchScore ?? r.match));
    const targetRepresentativeness = round2(clamp01(r.targetRepresentativeness ?? r.representativeness));
    const validity = round2(0.5 * labRealismScore + 0.25 * conditionMatchScore + 0.25 * targetRepresentativeness);
    return { key: experimentId, experimentId, labRealismScore, conditionMatchScore, targetRepresentativeness, validity, generalizes: validity >= 0.7, fieldConfirmation: validity < 0.7 };
  }).sort((a, b) => b.validity - a.validity || String(a.key).localeCompare(String(b.key)));
  const generalizesCount = rows.filter(r => r.generalizes).length;
  return { rows, count: rows.length, generalizesCount, top: rows[0] || null, summary: `Infinity AI assessed external validity for ${rows.length} experiment(s); ${generalizesCount} should generalize to real hunts.` };
}
/** Idea 53875 — Experiment Registry (learning). Input records: {experimentId, status, team, startDay}. The registry rolls experiments up by lifecycle status and surfaces what is currently running. Public internal registry of all planned, running, and completed experiments. */
export function buildExperimentRegistry(records = []) {
  const order = { running: 0, planned: 1, completed: 2, killed: 3 };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const status = String(r.status || 'planned').toLowerCase();
    return { key: experimentId, experimentId, status: order[status] !== undefined ? status : 'planned', team: String(r.team || 'team'), startDay: num(r.startDay, 0), active: status === 'running' };
  }).sort((a, b) => (order[a.status] - order[b.status]) || a.startDay - b.startDay || String(a.key).localeCompare(String(b.key)));
  const countsByStatus = {};
  for (const row of rows) countsByStatus[row.status] = (countsByStatus[row.status] || 0) + 1;
  const runningIds = rows.filter(r => r.active).map(r => r.experimentId);
  return { rows, count: rows.length, countsByStatus, activeCount: runningIds.length, runningIds, top: rows[0] || null, summary: `Infinity AI registered ${rows.length} experiment(s); ${runningIds.length} are running now.` };
}
/** Idea 53876 — Experiment Reproducibility Packages. Input records: {experimentId, configHash, seedDocumented, dataSnapshot, codeVersion}. A package is reproducible when config, seed, snapshot, and code version are all captured. Packages experiment configs so others can reproduce results. */
export function packageExperimentReproducibility(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const parts = {
      config: String(r.configHash || '').length > 0,
      seed: Boolean(r.seedDocumented),
      'data snapshot': String(r.dataSnapshot || '').length > 0,
      'code version': String(r.codeVersion || '').length > 0,
    };
    const present = Object.values(parts).filter(Boolean).length;
    const gaps = Object.entries(parts).filter(([, ok]) => !ok).map(([name]) => name);
    return { key: experimentId, experimentId, parts, completeness: round2(present / 4), gaps, reproducible: present === 4 };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  const reproducibleCount = rows.filter(r => r.reproducible).length;
  return { rows, count: rows.length, reproducibleCount, top: rows[0] || null, summary: `Infinity AI packaged ${rows.length} experiment(s); ${reproducibleCount} are fully reproducible.` };
}
/** Idea 53877 — Experiment Kill Criteria. Input records: {experimentId, day, hunts, currentEffect, minEffect, maxDays, budgetUsedPct}. Pre-defined stop conditions fire on overrun schedules, exhausted budgets, or futility after a hundred hunts. Pre-defines conditions for stopping experiments early. */
export function evaluateExperimentKillCriteria(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const day = num(r.day, 0);
    const hunts = num(r.hunts, 0);
    const currentEffect = round2(num(r.currentEffect ?? r.effect, 0));
    const minEffect = Math.abs(num(r.minEffect, 0));
    const maxDays = num(r.maxDays, 0);
    const budgetUsedPct = round2(clamp01(r.budgetUsedPct ?? r.budget));
    const reasons = [];
    if (maxDays > 0 && day > maxDays) reasons.push('exceeded-max-days');
    if (budgetUsedPct >= 1) reasons.push('budget-exhausted');
    if (hunts >= 100 && Math.abs(currentEffect) < minEffect) reasons.push('futility');
    return { key: experimentId, experimentId, day, hunts, currentEffect, minEffect, maxDays, budgetUsedPct, reasons, killRecommended: reasons.length > 0, status: reasons.length ? 'kill' : 'continue' };
  }).sort((a, b) => Number(b.killRecommended) - Number(a.killRecommended) || b.reasons.length - a.reasons.length || String(a.key).localeCompare(String(b.key)));
  const killCount = rows.filter(r => r.killRecommended).length;
  const killIds = rows.filter(r => r.killRecommended).map(r => r.experimentId);
  return { rows, count: rows.length, killCount, killIds, top: rows[0] || null, summary: `Infinity AI evaluated kill criteria for ${rows.length} experiment(s); ${killCount} should stop now.` };
}
/** Idea 53878 — Experiment Winner Adoption Tracking. Input records: {variant, adoptedTeams, totalTeams, daysSinceWin, postAdoptionEffect}. Adoption stalls when fewer than half the teams adopt within sixty days of the win. Tracks how quickly winning variants get adopted and their post-adoption performance. */
export function trackWinnerAdoption(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const variant = String(r.variant || 'variant');
    const adoptedTeams = num(r.adoptedTeams, 0);
    const totalTeams = num(r.totalTeams, 0);
    const daysSinceWin = num(r.daysSinceWin ?? r.days, 0);
    const adoptionRate = rate(adoptedTeams, totalTeams);
    const status = adoptionRate >= 0.8 ? 'adopted' : (daysSinceWin > 60 && adoptionRate < 0.5) ? 'stalled' : 'in-progress';
    return { key: variant, variant, adoptedTeams, totalTeams, daysSinceWin, adoptionRate, postAdoptionEffect: round2(num(r.postAdoptionEffect, 0)), status, stalled: status === 'stalled' };
  }).sort((a, b) => b.adoptionRate - a.adoptionRate || String(a.key).localeCompare(String(b.key)));
  const adoptedCount = rows.filter(r => r.status === 'adopted').length;
  const stalledCount = rows.filter(r => r.stalled).length;
  return { rows, count: rows.length, adoptedCount, stalledCount, top: rows[0] || null, summary: `Infinity AI tracked adoption for ${rows.length} winning variant(s); ${stalledCount} have stalled.` };
}
/** Idea 53879 — Experiment Calendar. Input records: {experimentId, team, startDay, endDay, targetPool}. Experiments sharing a target pool on overlapping days conflict; busy days are the union of all scheduled days. Shared calendar showing experiment schedules to avoid overlap. */
export function buildExperimentCalendar(records = []) {
  const list = (Array.isArray(records) ? records : []).map(r => ({
    experimentId: String(r.experimentId || r.experiment || 'experiment'),
    team: String(r.team || 'team'),
    targetPool: String(r.targetPool || r.pool || 'pool'),
    startDay: num(r.startDay, 0),
    endDay: num(r.endDay, 0),
  }));
  const busy = new Set();
  for (const item of list) for (let d = item.startDay; d <= item.endDay; d++) busy.add(d);
  const rows = list.map(item => {
    const conflictsWith = list.filter(other => other.experimentId !== item.experimentId && other.targetPool === item.targetPool && item.startDay <= other.endDay && other.startDay <= item.endDay).map(o => o.experimentId).sort();
    return { key: item.experimentId, ...item, conflictsWith, conflicted: conflictsWith.length > 0 };
  }).sort((a, b) => Number(b.conflicted) - Number(a.conflicted) || a.startDay - b.startDay || String(a.key).localeCompare(String(b.key)));
  const conflictedCount = rows.filter(r => r.conflicted).length;
  return { rows, count: rows.length, conflictedCount, busyDays: busy.size, top: rows[0] || null, summary: `Infinity AI scheduled ${rows.length} experiment(s) over ${busy.size} busy day(s); ${conflictedCount} overlap a shared pool.` };
}
/** Idea 53880 — Experiment Retrospective Templates. Input records: {experimentId, outcome, sectionsFilled, followUps}. The template has five fixed sections; retrospectives filling at least four, with follow-ups captured, are thorough. Structured retrospectives for completed experiments. */
export function applyRetrospectiveTemplates(records = []) {
  const templateSections = ['what-worked', 'what-failed', 'surprises', 'decisions', 'follow-ups'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const experimentId = String(r.experimentId || r.experiment || 'experiment');
    const sectionsFilled = Math.min(templateSections.length, num(r.sectionsFilled ?? r.sections, 0));
    const completeness = round2(sectionsFilled / templateSections.length);
    const actionItems = num(r.followUps ?? r.followUpCount, 0);
    return { key: experimentId, experimentId, outcome: String(r.outcome || 'unknown'), sectionsFilled, totalSections: templateSections.length, completeness, actionItems, thorough: completeness >= 0.8 && actionItems > 0 };
  }).sort((a, b) => b.completeness - a.completeness || String(a.key).localeCompare(String(b.key)));
  const thoroughCount = rows.filter(r => r.thorough).length;
  const totalActionItems = rows.reduce((s, r) => s + r.actionItems, 0);
  return { rows, count: rows.length, templateSections, thoroughCount, totalActionItems, top: rows[0] || null, summary: `Infinity AI applied retrospective templates to ${rows.length} experiment(s); ${thoroughCount} are thorough.` };
}
