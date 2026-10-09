/**
 * wave93BCores.js — Infinity AI · Wave 93B
 * Prompt operations and lifecycle, ideas 53701–53720: prompt update rollout
 * gates, prompt performance dashboards, prompt contribution credits, prompt
 * library search, prompt deprecation notices, prompt experiment sandboxes,
 * prompt cross-model portability, prompt edge-case handling, prompt
 * readability scores, prompt comment standards, prompt review boards,
 * prompt incident postmortems, prompt performance alerts, prompt genetic
 * evolution, prompt ensemble strategies, prompt compression techniques,
 * prompt context priming, prompt output format tuning, prompt
 * self-correction loops, and prompt time-awareness.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE93_B_IDEAS = [
  { id: 53701, title: 'Prompt Update Rollout Gates', skip: false },
  { id: 53702, title: 'Prompt Performance Dashboards', skip: false },
  { id: 53703, title: 'Prompt Contribution Credits', skip: false },
  { id: 53704, title: 'Prompt Library Search', skip: false },
  { id: 53705, title: 'Prompt Deprecation Notices', skip: false },
  { id: 53706, title: 'Prompt Experiment Sandboxes', skip: false },
  { id: 53707, title: 'Prompt Cross-Model Portability', skip: false },
  { id: 53708, title: 'Prompt Edge-Case Handling', skip: false },
  { id: 53709, title: 'Prompt Readability Scores', skip: false },
  { id: 53710, title: 'Prompt Comment Standards', skip: false },
  { id: 53711, title: 'Prompt Review Boards', skip: false },
  { id: 53712, title: 'Prompt Incident Postmortems', skip: false },
  { id: 53713, title: 'Prompt Performance Alerts', skip: false },
  { id: 53714, title: 'Prompt Genetic Evolution', skip: false },
  { id: 53715, title: 'Prompt Ensemble Strategies', skip: false },
  { id: 53716, title: 'Prompt Compression Techniques', skip: false },
  { id: 53717, title: 'Prompt Context Priming', skip: false },
  { id: 53718, title: 'Prompt Output Format Tuning', skip: false },
  { id: 53719, title: 'Prompt Self-Correction Loops', skip: false },
  { id: 53720, title: 'Prompt Time-Awareness', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.promptId||it.id||it.name||fb);}

/** Idea 53701 — Prompt Update Rollout Gates. Input records: {promptId, stage, metric, threshold}. Gate passes when metric meets threshold. Requires staged rollouts with hunt-metric monitoring for prompt changes. */
export function gatePromptUpdateRollouts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const stage = String(r.stage || 'stage');
    const metric = round2(num(r.metric, 0));
    const threshold = round2(num(r.threshold, 0));
    return { key: `${promptId}|${stage}`, promptId, stage, metric, threshold, passed: metric >= threshold };
  }).sort((a, b) => b.metric - a.metric || String(a.key).localeCompare(String(b.key)));
  const passedCount = rows.filter(r => r.passed).length;
  return { rows, count: rows.length, passedCount, gateCount: rows.length, top: rows[0] || null, summary: `Infinity AI gated prompt rollouts across ${rows.length} stage(s); ${passedCount} passed.` };
}
/** Idea 53702 — Prompt Performance Dashboards. Input records: {promptId, runs, wins, falsePositives, avgTtfMinutes}. Win rate and FP rate per template; healthy at win rate >= 0.5 and FP rate < 0.3. Dashboards showing each prompt template's win rate, TTF, and FP rate. */
export function dashboardPromptPerformance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const runs = num(r.runs, 0);
    const wins = num(r.wins, 0);
    const falsePositives = num(r.falsePositives ?? r.fp, 0);
    const winRate = rate(wins, runs);
    const fpRate = rate(falsePositives, runs);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs, wins, falsePositives, winRate, fpRate, avgTtfMinutes: round2(num(r.avgTtfMinutes ?? r.ttfMinutes, 0)), healthy: winRate >= 0.5 && fpRate < 0.3 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const healthyCount = rows.filter(r => r.healthy).length;
  return { rows, count: rows.length, healthyCount, top: rows[0] || null, summary: `Infinity AI built prompt performance dashboards for ${rows.length} prompt(s); ${healthyCount} are healthy.` };
}
/** Idea 53703 — Prompt Contribution Credits. Input records: {promptId, contributor, improvement}. Credits per contributor; total improvement ranked. Credits researchers whose prompt suggestions improved hunt outcomes. */
export function creditPromptContributions(records = []) {
  const grouped = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const contributor = String(r.contributor || 'contributor');
    const g = grouped.get(contributor) || { key: contributor, contributor, credits: 0, totalImprovement: 0 };
    g.credits += 1;
    g.totalImprovement = round2(g.totalImprovement + num(r.improvement, 0));
    grouped.set(contributor, g);
  }
  const rows = [...grouped.values()].map(g => ({ ...g, avgImprovement: g.credits ? round2(g.totalImprovement / g.credits) : 0 })).sort((a, b) => b.totalImprovement - a.totalImprovement || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, contributorCount: rows.length, creditCount: rows.reduce((s, r) => s + r.credits, 0), top: rows[0] || null, summary: `Infinity AI credited prompt contributions across ${rows.length} contributor(s).` };
}
/** Idea 53704 — Prompt Library Search. Input records: {promptId, title, tags, winRate}. Searchable by title and tags; ranked by win rate. Searchable library of all prompt templates with performance metadata. */
export function searchPromptLibrary(records = [], query = '') {
  const q = String(query || '').toLowerCase();
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const title = String(r.title || 'prompt');
    const tags = Array.isArray(r.tags) ? r.tags.map(t => String(t)) : [];
    const winRate = round2(num(r.winRate, 0));
    const searchable = `${promptId} ${title} ${tags.join(' ')}`.toLowerCase();
    return { key: promptId, promptId, title, tags, winRate, matches: !q || searchable.includes(q) };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const matchCount = rows.filter(r => r.matches).length;
  return { rows, count: rows.length, matchCount, query: q, top: rows[0] || null, summary: `Infinity AI searched the prompt library across ${rows.length} template(s); ${matchCount} matched.` };
}
/** Idea 53705 — Prompt Deprecation Notices. Input records: {promptId, winRate, threshold, noticeSent}. Deprecated when win rate is below threshold. Notifies users before retiring underperforming prompts. */
export function noticePromptDeprecations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const winRate = round2(num(r.winRate, 0));
    const threshold = round2(num(r.threshold, 0.3));
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), winRate, threshold, deprecated: winRate < threshold, noticeSent: Boolean(r.noticeSent) };
  }).sort((a, b) => a.winRate - b.winRate || String(a.key).localeCompare(String(b.key)));
  const deprecatedCount = rows.filter(r => r.deprecated).length;
  return { rows, count: rows.length, deprecatedCount, top: rows[0] || null, summary: `Infinity AI flagged prompt deprecations for ${rows.length} prompt(s); ${deprecatedCount} are deprecated.` };
}
/** Idea 53706 — Prompt Experiment Sandboxes. Input records: {promptId, variant, sandboxRuns, wins}. Sandbox win rate; validated at >= 0.6. Safe environments to test prompt variants on historical hunt data. */
export function sandboxPromptExperiments(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const variant = String(r.variant || 'variant');
    const winRate = rate(num(r.wins, 0), num(r.sandboxRuns ?? r.runs, 0));
    return { key: `${promptId}|${variant}`, promptId, variant, sandboxRuns: num(r.sandboxRuns ?? r.runs, 0), wins: num(r.wins, 0), winRate, validated: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const validatedCount = rows.filter(r => r.validated).length;
  return { rows, count: rows.length, validatedCount, top: rows[0] || null, summary: `Infinity AI sandboxed prompt experiments across ${rows.length} variant(s); ${validatedCount} validated.` };
}
/** Idea 53707 — Prompt Cross-Model Portability. Input records: {promptId, sourceModel, targetModel, sourceScore, targetScore}. Portability is target over source score; portable at >= 0.8. Measures how well a winning prompt transfers across model families. */
export function measurePromptPortability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const sourceModel = String(r.sourceModel || 'source');
    const targetModel = String(r.targetModel || 'target');
    const sourceScore = round2(num(r.sourceScore, 0));
    const targetScore = round2(num(r.targetScore, 0));
    const portability = sourceScore ? round2(targetScore / sourceScore) : 0;
    return { key: `${promptId}|${sourceModel}|${targetModel}`, promptId, sourceModel, targetModel, sourceScore, targetScore, portability, portable: portability >= 0.8 };
  }).sort((a, b) => b.portability - a.portability || String(a.key).localeCompare(String(b.key)));
  const portableCount = rows.filter(r => r.portable).length;
  return { rows, count: rows.length, portableCount, top: rows[0] || null, summary: `Infinity AI measured prompt portability across ${rows.length} transfer(s); ${portableCount} are portable.` };
}
/** Idea 53708 — Prompt Edge-Case Handling. Input records: {promptId, edgeCases, handled}. Coverage is handled over edge cases; robust at >= 0.8. Improves prompts using edge cases discovered in unusual hunts. */
export function handlePromptEdgeCases(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const edgeCases = num(r.edgeCases, 0);
    const handled = num(r.handled, 0);
    const coverageRate = rate(handled, edgeCases);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), edgeCases, handled, coverageRate, robust: coverageRate >= 0.8 };
  }).sort((a, b) => b.coverageRate - a.coverageRate || String(a.key).localeCompare(String(b.key)));
  const robustCount = rows.filter(r => r.robust).length;
  return { rows, count: rows.length, robustCount, top: rows[0] || null, summary: `Infinity AI checked edge-case handling for ${rows.length} prompt(s); ${robustCount} are robust.` };
}
/** Idea 53709 — Prompt Readability Scores. Input records: {promptId, words, sentences}. Average sentence length drives readability (shorter is more readable); readable when average length <= 20. Scores prompts for human readability to ease maintenance. */
export function scorePromptReadability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const words = num(r.words, 0);
    const sentences = num(r.sentences, 0);
    const avgSentenceLength = sentences ? round2(words / sentences) : 0;
    const readability = avgSentenceLength ? round2(clamp01(20 / Math.max(avgSentenceLength, 1))) : 0;
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), words, sentences, avgSentenceLength, readability, readable: avgSentenceLength > 0 && avgSentenceLength <= 20 };
  }).sort((a, b) => b.readability - a.readability || String(a.key).localeCompare(String(b.key)));
  const readableCount = rows.filter(r => r.readable).length;
  return { rows, count: rows.length, readableCount, averageReadability: mean(rows.map(r => r.readability)), top: rows[0] || null, summary: `Infinity AI scored prompt readability for ${rows.length} prompt(s); ${readableCount} are readable.` };
}
/** Idea 53710 — Prompt Comment Standards. Input records: {promptId, instructions, documented}. Coverage is documented over instructions; compliant at >= 0.8. Requires prompts to document why each instruction exists with linked hunt evidence. */
export function enforcePromptCommentStandards(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const instructions = num(r.instructions, 0);
    const documented = num(r.documented ?? r.comments, 0);
    const coverage = rate(documented, instructions);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), instructions, documented, coverage, compliant: coverage >= 0.8 };
  }).sort((a, b) => b.coverage - a.coverage || String(a.key).localeCompare(String(b.key)));
  const compliantCount = rows.filter(r => r.compliant).length;
  return { rows, count: rows.length, compliantCount, top: rows[0] || null, summary: `Infinity AI enforced prompt comment standards for ${rows.length} prompt(s); ${compliantCount} are compliant.` };
}
/** Idea 53711 — Prompt Review Boards. Input records: {promptId, changeId, reviewers, approvals}. Approval rate; approved at >= 0.6. Peer review process for significant prompt changes. */
export function boardPromptReviews(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const changeId = String(r.changeId || r.change || 'change');
    const approvalRate = rate(num(r.approvals, 0), num(r.reviewers, 0));
    return { key: `${promptId}|${changeId}`, promptId, changeId, reviewers: num(r.reviewers, 0), approvals: num(r.approvals, 0), approvalRate, approved: approvalRate >= 0.6 };
  }).sort((a, b) => b.approvalRate - a.approvalRate || String(a.key).localeCompare(String(b.key)));
  const approvedCount = rows.filter(r => r.approved).length;
  return { rows, count: rows.length, approvedCount, top: rows[0] || null, summary: `Infinity AI ran prompt review boards across ${rows.length} change(s); ${approvedCount} approved.` };
}
/** Idea 53712 — Prompt Incident Postmortems. Input records: {promptId, incidents, wastedHours}. Severity weighs wasted hours per incident; severe at >= 5 hours each. Investigates hunts where prompt flaws caused wasted effort or missed findings. */
export function postmortemPromptIncidents(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const incidents = num(r.incidents, 0);
    const wastedHours = round2(num(r.wastedHours, 0));
    const hoursPerIncident = incidents ? round2(wastedHours / incidents) : 0;
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), incidents, wastedHours, hoursPerIncident, severe: hoursPerIncident >= 5 };
  }).sort((a, b) => b.hoursPerIncident - a.hoursPerIncident || String(a.key).localeCompare(String(b.key)));
  const severeCount = rows.filter(r => r.severe).length;
  const totalWastedHours = round2(rows.reduce((s, r) => s + r.wastedHours, 0));
  return { rows, count: rows.length, severeCount, totalWastedHours, top: rows[0] || null, summary: `Infinity AI ran prompt incident postmortems for ${rows.length} prompt(s); ${severeCount} are severe.` };
}
/** Idea 53713 — Prompt Performance Alerts. Input records: {promptId, currentRate, baselineRate}. Degradation is baseline minus current; alerting at drop >= 0.2. Alerts when a prompt's metrics degrade beyond thresholds. */
export function alertPromptPerformance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const currentRate = round2(num(r.currentRate, 0));
    const baselineRate = round2(num(r.baselineRate, 0));
    const degradation = round2(baselineRate - currentRate);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), currentRate, baselineRate, degradation, alerting: degradation >= 0.2 };
  }).sort((a, b) => b.degradation - a.degradation || String(a.key).localeCompare(String(b.key)));
  const alertingCount = rows.filter(r => r.alerting).length;
  return { rows, count: rows.length, alertingCount, alertCount: rows.length, top: rows[0] || null, summary: `Infinity AI checked prompt performance alerts for ${rows.length} prompt(s); ${alertingCount} are alerting.` };
}
/** Idea 53714 — Prompt Genetic Evolution. Input records: {promptId, generation, fitness, parentFitness}. Fitness gain over parent; evolved when gain > 0. Evolves prompts via mutation and selection guided by hunt outcomes. */
export function evolvePromptsGenetically(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const fitness = round2(num(r.fitness, 0));
    const parentFitness = round2(num(r.parentFitness, 0));
    const fitnessGain = round2(fitness - parentFitness);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), generation: num(r.generation, 0), fitness, parentFitness, fitnessGain, evolved: fitnessGain > 0 };
  }).sort((a, b) => b.fitnessGain - a.fitnessGain || String(a.key).localeCompare(String(b.key)));
  const evolvedCount = rows.filter(r => r.evolved).length;
  return { rows, count: rows.length, evolvedCount, top: rows[0] || null, summary: `Infinity AI evolved prompts genetically across ${rows.length} prompt(s); ${evolvedCount} improved.` };
}
/** Idea 53715 — Prompt Ensemble Strategies. Input records: {promptId, ensembleSize, runs, wins}. Ensemble win rate; effective at >= 0.6. Tests ensembles of prompts voting on next actions. */
export function strategizePromptEnsembles(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), ensembleSize: num(r.ensembleSize, 0), runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, effective: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  return { rows, count: rows.length, effectiveCount, top: rows[0] || null, summary: `Infinity AI scored prompt ensemble strategies for ${rows.length} prompt(s); ${effectiveCount} are effective.` };
}
/** Idea 53716 — Prompt Compression Techniques. Input records: {promptId, originalTokens, compressedTokens, scoreBefore, scoreAfter}. Compression ratio and score retention; lossless at retention >= 0.9. Compresses verbose winning prompts without losing performance. */
export function compressPrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const originalTokens = num(r.originalTokens, 0);
    const compressedTokens = num(r.compressedTokens, 0);
    const compressionRatio = originalTokens ? round2(1 - compressedTokens / originalTokens) : 0;
    const scoreBefore = round2(num(r.scoreBefore, 0));
    const scoreAfter = round2(num(r.scoreAfter, 0));
    const retention = scoreBefore ? round2(scoreAfter / scoreBefore) : 0;
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), originalTokens, compressedTokens, compressionRatio, scoreBefore, scoreAfter, retention, lossless: retention >= 0.9 };
  }).sort((a, b) => b.compressionRatio - a.compressionRatio || String(a.key).localeCompare(String(b.key)));
  const losslessCount = rows.filter(r => r.lossless).length;
  return { rows, count: rows.length, losslessCount, top: rows[0] || null, summary: `Infinity AI compressed prompts across ${rows.length} prompt(s); ${losslessCount} kept performance.` };
}
/** Idea 53717 — Prompt Context Priming. Input records: {promptId, primed, runs, wins}. Primed win rate; primed effectively at >= 0.6. Optimizes the background context fed to models before hunts begin. */
export function primePromptContext(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), primed: Boolean(r.primed), runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, effective: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const effectiveCount = rows.filter(r => r.effective).length;
  return { rows, count: rows.length, effectiveCount, top: rows[0] || null, summary: `Infinity AI primed prompt context for ${rows.length} prompt(s); ${effectiveCount} primed effectively.` };
}
/** Idea 53718 — Prompt Output Format Tuning. Input records: {promptId, format, attempts, parsed}. Parse rate; reliable at >= 0.9. Tunes structured output formats based on parsing reliability in hunts. */
export function tunePromptOutputFormats(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const format = String(r.format || 'format');
    const parseRate = rate(num(r.parsed, 0), num(r.attempts, 0));
    return { key: `${promptId}|${format}`, promptId, format, attempts: num(r.attempts, 0), parsed: num(r.parsed, 0), parseRate, reliable: parseRate >= 0.9 };
  }).sort((a, b) => b.parseRate - a.parseRate || String(a.key).localeCompare(String(b.key)));
  const reliableCount = rows.filter(r => r.reliable).length;
  return { rows, count: rows.length, reliableCount, top: rows[0] || null, summary: `Infinity AI tuned prompt output formats across ${rows.length} format(s); ${reliableCount} are reliable.` };
}
/** Idea 53719 — Prompt Self-Correction Loops. Input records: {promptId, runs, corrections, winsAfterCorrection}. Correction rate and recovery rate; recovering at >= 0.5. Adds self-review instructions proven to catch agent mistakes in hunts. */
export function loopPromptSelfCorrection(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const runs = num(r.runs, 0);
    const corrections = num(r.corrections, 0);
    const winsAfterCorrection = num(r.winsAfterCorrection ?? r.wins, 0);
    const correctionRate = rate(corrections, runs);
    const recoveryRate = rate(winsAfterCorrection, corrections);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs, corrections, winsAfterCorrection, correctionRate, recoveryRate, recovering: recoveryRate >= 0.5 };
  }).sort((a, b) => b.recoveryRate - a.recoveryRate || String(a.key).localeCompare(String(b.key)));
  const recoveringCount = rows.filter(r => r.recovering).length;
  return { rows, count: rows.length, recoveringCount, top: rows[0] || null, summary: `Infinity AI scored self-correction loops for ${rows.length} prompt(s); ${recoveringCount} recover.` };
}
/** Idea 53720 — Prompt Time-Awareness. Input records: {promptId, phase, budgetMinutes, usedMinutes}. Time efficiency keeps usage within budget; efficient when used stays at or below budget. Improves prompts' handling of time-boxed hunt phases. */
export function managePromptTimeAwareness(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const phase = String(r.phase || 'phase');
    const budgetMinutes = num(r.budgetMinutes ?? r.budget, 0);
    const usedMinutes = num(r.usedMinutes ?? r.used, 0);
    const utilization = budgetMinutes ? round2(usedMinutes / budgetMinutes) : 0;
    return { key: `${promptId}|${phase}`, promptId, phase, budgetMinutes, usedMinutes, utilization, efficient: budgetMinutes > 0 && usedMinutes <= budgetMinutes };
  }).sort((a, b) => a.utilization - b.utilization || String(a.key).localeCompare(String(b.key)));
  const efficientCount = rows.filter(r => r.efficient).length;
  return { rows, count: rows.length, efficientCount, top: rows[0] || null, summary: `Infinity AI managed prompt time-awareness across ${rows.length} phase(s); ${efficientCount} stayed in budget.` };
}
