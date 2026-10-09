/**
 * wave93ACore.js — Infinity AI · Wave 93A
 * Prompt intelligence round 2, ideas 53681–53700: prompt drift detection,
 * context-window prompt optimization, prompt length vs performance curves,
 * few-shot example curation, negative example mining, prompt instruction
 * clarity scores, role-framing experiments, chain-of-thought prompt tuning,
 * prompt hallucination guards, tool-use prompt optimization, multi-turn prompt
 * strategies, prompt personalization per model, prompt token efficiency,
 * prompt safety calibration, prompt localization effects, prompt temperature
 * tuning, prompt fallback chains, prompt injection resistance, prompt
 * consistency checks, and prompt bias audits.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE93_A_IDEAS = [
  { id: 53681, title: 'Prompt Drift Detection', skip: false },
  { id: 53682, title: 'Context-Window Prompt Optimization', skip: false },
  { id: 53683, title: 'Prompt Length vs Performance Curves', skip: false },
  { id: 53684, title: 'Few-Shot Example Curation', skip: false },
  { id: 53685, title: 'Negative Example Mining', skip: false },
  { id: 53686, title: 'Prompt Instruction Clarity Scores', skip: false },
  { id: 53687, title: 'Role-Framing Experiments', skip: false },
  { id: 53688, title: 'Chain-of-Thought Prompt Tuning', skip: false },
  { id: 53689, title: 'Prompt Hallucination Guards', skip: false },
  { id: 53690, title: 'Tool-Use Prompt Optimization', skip: false },
  { id: 53691, title: 'Multi-Turn Prompt Strategies', skip: false },
  { id: 53692, title: 'Prompt Personalization per Model', skip: false },
  { id: 53693, title: 'Prompt Token Efficiency', skip: false },
  { id: 53694, title: 'Prompt Safety Calibration', skip: false },
  { id: 53695, title: 'Prompt Localization Effects', skip: false },
  { id: 53696, title: 'Prompt Temperature Tuning', skip: false },
  { id: 53697, title: 'Prompt Fallback Chains', skip: false },
  { id: 53698, title: 'Prompt Injection Resistance', skip: false },
  { id: 53699, title: 'Prompt Consistency Checks', skip: false },
  { id: 53700, title: 'Prompt Bias Audits', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:round2((s[m-1]+s[m])/2);}
function keyOf(it,fb='item'){return String(it.key||it.promptId||it.id||it.name||fb);}

/** Idea 53681 — Prompt Drift Detection. Input records: {promptId, currentScore, baselineScore}. Drift is baseline minus current score; drifted at drop >= 0.2. Detects when a prompt's effectiveness decays as models update. */
export function detectPromptDrift(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const currentScore = round2(num(r.currentScore, 0));
    const baselineScore = round2(num(r.baselineScore, 0));
    const drift = round2(baselineScore - currentScore);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), currentScore, baselineScore, drift, drifted: drift >= 0.2 };
  }).sort((a, b) => b.drift - a.drift || String(a.key).localeCompare(String(b.key)));
  const driftedCount = rows.filter(r => r.drifted).length;
  return { rows, count: rows.length, driftedCount, top: rows[0] || null, summary: `Infinity AI checked prompt drift for ${rows.length} prompt(s); ${driftedCount} drifted.` };
}
/** Idea 53682 — Context-Window Prompt Optimization. Input records: {promptId, contextWindow, candidates, selected}. Optimization rate is selected over candidates per window; optimized at >= 0.6. Tunes prompts for different context window sizes based on hunt data. */
export function optimizeContextWindowPrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const contextWindow = num(r.contextWindow ?? r.window, 0);
    const candidates = num(r.candidates, 0);
    const selected = num(r.selected ?? r.optimized, 0);
    const optimizationRate = rate(selected, candidates);
    return { key: `${promptId}|${contextWindow}`, promptId, contextWindow, candidates, selected, optimizationRate, optimized: optimizationRate >= 0.6 };
  }).sort((a, b) => b.optimizationRate - a.optimizationRate || String(a.key).localeCompare(String(b.key)));
  const optimizedCount = rows.filter(r => r.optimized).length;
  return { rows, count: rows.length, optimizedCount, top: rows[0] || null, summary: `Infinity AI optimized context-window prompts across ${rows.length} record(s); ${optimizedCount} are optimized.` };
}
/** Idea 53683 — Prompt Length vs Performance Curves. Input records: {promptId, lengthChars, runs, wins}. Success rate per length bucket (short < 500, medium < 1500, long otherwise); measures how prompt verbosity correlates with hunt outcomes. */
export function curvePromptLengthPerformance(records = []) {
  const buckets = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const lengthChars = num(r.lengthChars ?? r.length, 0);
    const bucket = lengthChars < 500 ? 'short' : lengthChars < 1500 ? 'medium' : 'long';
    const g = buckets.get(bucket) || { key: bucket, bucket, prompts: 0, runs: 0, wins: 0 };
    g.prompts += 1;
    g.runs += num(r.runs, 0);
    g.wins += num(r.wins, 0);
    buckets.set(bucket, g);
  }
  const rows = [...buckets.values()].map(g => ({ ...g, successRate: rate(g.wins, g.runs) })).sort((a, b) => b.successRate - a.successRate || String(a.key).localeCompare(String(b.key)));
  const bestBucket = rows[0] || null;
  return { rows, count: rows.length, bestBucket, top: bestBucket, summary: `Infinity AI measured prompt length performance across ${rows.length} length bucket(s); best is ${bestBucket ? bestBucket.bucket : 'none'}.` };
}
/** Idea 53684 — Few-Shot Example Curation. Input records: {promptId, exampleId, runs, wins, baselineWins}. Lift is win-rate gain over baseline; curated at lift >= 0.1. Curates the hunt-derived examples that most improve prompt performance. */
export function curateFewShotExamples(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const exampleId = String(r.exampleId || r.example || 'example');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    const baselineRate = rate(num(r.baselineWins, 0), num(r.runs, 0));
    const lift = round2(winRate - baselineRate);
    return { key: `${promptId}|${exampleId}`, promptId, exampleId, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, baselineRate, lift, curated: lift >= 0.1 };
  }).sort((a, b) => b.lift - a.lift || String(a.key).localeCompare(String(b.key)));
  const curatedCount = rows.filter(r => r.curated).length;
  return { rows, count: rows.length, curatedCount, top: rows[0] || null, summary: `Infinity AI curated few-shot examples across ${rows.length} record(s); ${curatedCount} are curated.` };
}
/** Idea 53685 — Negative Example Mining. Input records: {promptId, exampleId, failuresAvoided, totalFailures}. Avoidance rate; mined at >= 0.5. Extracts examples of what not to do from failed hunts for prompt inclusion. */
export function mineNegativeExamples(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const exampleId = String(r.exampleId || r.example || 'example');
    const failuresAvoided = num(r.failuresAvoided ?? r.avoided, 0);
    const totalFailures = num(r.totalFailures ?? r.failures, 0);
    const avoidanceRate = rate(failuresAvoided, totalFailures);
    return { key: `${promptId}|${exampleId}`, promptId, exampleId, failuresAvoided, totalFailures, avoidanceRate, mined: avoidanceRate >= 0.5 };
  }).sort((a, b) => b.avoidanceRate - a.avoidanceRate || String(a.key).localeCompare(String(b.key)));
  const minedCount = rows.filter(r => r.mined).length;
  return { rows, count: rows.length, minedCount, top: rows[0] || null, summary: `Infinity AI mined negative examples across ${rows.length} record(s); ${minedCount} are mined.` };
}
/** Idea 53686 — Prompt Instruction Clarity Scores. Input records: {promptId, runs, consistentInterpretations}. Clarity is consistent interpretations over runs; clear at >= 0.8. Scores prompts by how consistently models interpret them across runs. */
export function scorePromptInstructionClarity(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const runs = num(r.runs, 0);
    const consistentInterpretations = num(r.consistentInterpretations ?? r.consistent, 0);
    const clarity = rate(consistentInterpretations, runs);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs, consistentInterpretations, clarity, clear: clarity >= 0.8 };
  }).sort((a, b) => b.clarity - a.clarity || String(a.key).localeCompare(String(b.key)));
  const clearCount = rows.filter(r => r.clear).length;
  return { rows, count: rows.length, clearCount, averageClarity: mean(rows.map(r => r.clarity)), top: rows[0] || null, summary: `Infinity AI scored instruction clarity for ${rows.length} prompt(s); ${clearCount} are clear.` };
}
/** Idea 53687 — Role-Framing Experiments. Input records: {promptId, role, runs, wins}. Win rate per role framing; leading at >= 0.6. Tests attacker versus defender versus auditor role framings using hunt outcome data. */
export function experimentRoleFraming(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const role = String(r.role || 'role');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${promptId}|${role}`, promptId, role, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, leading: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const leadingCount = rows.filter(r => r.leading).length;
  return { rows, count: rows.length, leadingCount, top: rows[0] || null, summary: `Infinity AI ran role-framing experiments across ${rows.length} record(s); ${leadingCount} lead.` };
}
/** Idea 53688 — Chain-of-Thought Prompt Tuning. Input records: {promptId, traces, winningTraces}. Trace win rate; tuned at >= 0.6. Tunes reasoning instructions based on which reasoning traces preceded findings. */
export function tuneChainOfThoughtPrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const traces = num(r.traces, 0);
    const winningTraces = num(r.winningTraces ?? r.winning, 0);
    const traceWinRate = rate(winningTraces, traces);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), traces, winningTraces, traceWinRate, tuned: traceWinRate >= 0.6 };
  }).sort((a, b) => b.traceWinRate - a.traceWinRate || String(a.key).localeCompare(String(b.key)));
  const tunedCount = rows.filter(r => r.tuned).length;
  return { rows, count: rows.length, tunedCount, top: rows[0] || null, summary: `Infinity AI tuned chain-of-thought prompts for ${rows.length} prompt(s); ${tunedCount} are tuned.` };
}
/** Idea 53689 — Prompt Hallucination Guards. Input records: {promptId, runs, hallucinations}. Hallucination rate; guarded at rate < 0.1. Strengthens prompts with guards derived from observed hallucination patterns in hunts. */
export function guardPromptHallucinations(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const runs = num(r.runs, 0);
    const hallucinations = num(r.hallucinations, 0);
    const hallucinationRate = rate(hallucinations, runs);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs, hallucinations, hallucinationRate, guarded: hallucinationRate < 0.1 };
  }).sort((a, b) => a.hallucinationRate - b.hallucinationRate || String(a.key).localeCompare(String(b.key)));
  const guardedCount = rows.filter(r => r.guarded).length;
  return { rows, count: rows.length, guardedCount, top: rows[0] || null, summary: `Infinity AI guarded hallucination handling for ${rows.length} prompt(s); ${guardedCount} are guarded.` };
}
/** Idea 53690 — Tool-Use Prompt Optimization. Input records: {promptId, toolCalls, successfulCalls}. Success rate; optimized at >= 0.8. Refines how prompts instruct tool usage based on tool-call success rates. */
export function optimizeToolUsePrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const toolCalls = num(r.toolCalls ?? r.calls, 0);
    const successfulCalls = num(r.successfulCalls ?? r.successes, 0);
    const successRate = rate(successfulCalls, toolCalls);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), toolCalls, successfulCalls, successRate, optimized: successRate >= 0.8 };
  }).sort((a, b) => b.successRate - a.successRate || String(a.key).localeCompare(String(b.key)));
  const optimizedCount = rows.filter(r => r.optimized).length;
  return { rows, count: rows.length, optimizedCount, top: rows[0] || null, summary: `Infinity AI optimized tool-use prompts for ${rows.length} prompt(s); ${optimizedCount} are optimized.` };
}
/** Idea 53691 — Multi-Turn Prompt Strategies. Input records: {promptId, avgTurns, runs, wins}. Win rate; strong at >= 0.6. Optimizes prompts for long hunt conversations versus single-shot tasks. */
export function strategizeMultiTurnPrompts(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), avgTurns: round2(num(r.avgTurns ?? r.turns, 0)), runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, strong: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const strongCount = rows.filter(r => r.strong).length;
  return { rows, count: rows.length, strongCount, averageTurns: mean(rows.map(r => r.avgTurns)), top: rows[0] || null, summary: `Infinity AI scored multi-turn strategies for ${rows.length} prompt(s); ${strongCount} are strong.` };
}
/** Idea 53692 — Prompt Personalization per Model. Input records: {promptId, model, runs, wins}. Win rate per model variant; winning at >= 0.6. Maintains model-specific prompt variants since the same prompt performs differently per model. */
export function personalizePromptsPerModel(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const model = String(r.model || 'model');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${promptId}|${model}`, promptId, model, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, winning: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const winningCount = rows.filter(r => r.winning).length;
  return { rows, count: rows.length, winningCount, top: rows[0] || null, summary: `Infinity AI tracked prompt personalization across ${rows.length} model variant(s); ${winningCount} are winning.` };
}
/** Idea 53693 — Prompt Token Efficiency. Input records: {promptId, tokens, wins}. Efficiency is wins per 1000 tokens; efficient at >= 5. Balances prompt performance against token cost using hunt ROI data. */
export function measurePromptTokenEfficiency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const tokens = num(r.tokens, 0);
    const wins = num(r.wins, 0);
    const efficiency = tokens ? round2((wins / tokens) * 1000) : 0;
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), tokens, wins, efficiency, efficient: efficiency >= 5 };
  }).sort((a, b) => b.efficiency - a.efficiency || String(a.key).localeCompare(String(b.key)));
  const efficientCount = rows.filter(r => r.efficient).length;
  return { rows, count: rows.length, efficientCount, top: rows[0] || null, summary: `Infinity AI measured token efficiency for ${rows.length} prompt(s); ${efficientCount} are efficient.` };
}
/** Idea 53694 — Prompt Safety Calibration. Input records: {promptId, legitimateActions, blockedLegitimate}. Over-block rate; calibrated at < 0.1. Calibrates safety instructions so they don't block legitimate testing actions. */
export function calibratePromptSafety(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const legitimateActions = num(r.legitimateActions ?? r.actions, 0);
    const blockedLegitimate = num(r.blockedLegitimate ?? r.blocked, 0);
    const overBlockRate = rate(blockedLegitimate, legitimateActions);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), legitimateActions, blockedLegitimate, overBlockRate, calibrated: overBlockRate < 0.1 };
  }).sort((a, b) => a.overBlockRate - b.overBlockRate || String(a.key).localeCompare(String(b.key)));
  const calibratedCount = rows.filter(r => r.calibrated).length;
  return { rows, count: rows.length, calibratedCount, top: rows[0] || null, summary: `Infinity AI calibrated prompt safety for ${rows.length} prompt(s); ${calibratedCount} are calibrated.` };
}
/** Idea 53695 — Prompt Localization Effects. Input records: {promptId, language, runs, wins}. Win rate per language; outperforming at >= 0.6. Tests whether prompts in the researcher's language outperform English prompts. */
export function measurePromptLocalizationEffects(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const language = String(r.language || 'en');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${promptId}|${language}`, promptId, language, runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, outperforming: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const outperformingCount = rows.filter(r => r.outperforming).length;
  return { rows, count: rows.length, outperformingCount, top: rows[0] || null, summary: `Infinity AI measured localization effects across ${rows.length} record(s); ${outperformingCount} outperform.` };
}
/** Idea 53696 — Prompt Temperature Tuning. Input records: {promptId, phase, temperature, runs, wins}. Win rate per phase and temperature; tuned at >= 0.6. Tunes sampling temperature per hunt phase based on outcome data. */
export function tunePromptTemperature(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const phase = String(r.phase || 'phase');
    const winRate = rate(num(r.wins, 0), num(r.runs, 0));
    return { key: `${promptId}|${phase}`, promptId, phase, temperature: round2(num(r.temperature, 0)), runs: num(r.runs, 0), wins: num(r.wins, 0), winRate, tuned: winRate >= 0.6 };
  }).sort((a, b) => b.winRate - a.winRate || String(a.key).localeCompare(String(b.key)));
  const tunedCount = rows.filter(r => r.tuned).length;
  return { rows, count: rows.length, tunedCount, top: rows[0] || null, summary: `Infinity AI tuned prompt temperature across ${rows.length} phase record(s); ${tunedCount} are tuned.` };
}
/** Idea 53697 — Prompt Fallback Chains. Input records: {promptId, degenerateRuns, fallbackWins}. Fallback success is fallback wins over degenerate runs; resilient at >= 0.5. Defines fallback prompts when the primary prompt produces degenerate output. */
export function chainPromptFallbacks(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const degenerateRuns = num(r.degenerateRuns ?? r.degenerate, 0);
    const fallbackWins = num(r.fallbackWins ?? r.wins, 0);
    const fallbackSuccessRate = rate(fallbackWins, degenerateRuns);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), degenerateRuns, fallbackWins, fallbackSuccessRate, resilient: fallbackSuccessRate >= 0.5 };
  }).sort((a, b) => b.fallbackSuccessRate - a.fallbackSuccessRate || String(a.key).localeCompare(String(b.key)));
  const resilientCount = rows.filter(r => r.resilient).length;
  return { rows, count: rows.length, resilientCount, top: rows[0] || null, summary: `Infinity AI built fallback chains for ${rows.length} prompt(s); ${resilientCount} are resilient.` };
}
/** Idea 53698 — Prompt Injection Resistance. Input records: {promptId, attacks, blocked}. Resistance is blocked over attacks; resistant at >= 0.8. Hardens hunt prompts against prompt injection observed in target responses. */
export function resistPromptInjection(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const attacks = num(r.attacks, 0);
    const blocked = num(r.blocked, 0);
    const resistanceRate = rate(blocked, attacks);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), attacks, blocked, resistanceRate, resistant: resistanceRate >= 0.8 };
  }).sort((a, b) => b.resistanceRate - a.resistanceRate || String(a.key).localeCompare(String(b.key)));
  const resistantCount = rows.filter(r => r.resistant).length;
  return { rows, count: rows.length, resistantCount, top: rows[0] || null, summary: `Infinity AI measured injection resistance for ${rows.length} prompt(s); ${resistantCount} are resistant.` };
}
/** Idea 53699 — Prompt Consistency Checks. Input records: {promptId, runs, consistentRuns}. Consistency rate; consistent at >= 0.8. Verifies prompts produce consistent strategies across identical scenarios. */
export function checkPromptConsistency(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const runs = num(r.runs, 0);
    const consistentRuns = num(r.consistentRuns ?? r.consistent, 0);
    const consistencyRate = rate(consistentRuns, runs);
    return { key: keyOf(r, 'prompt'), promptId: String(r.promptId || 'prompt'), runs, consistentRuns, consistencyRate, consistent: consistencyRate >= 0.8 };
  }).sort((a, b) => b.consistencyRate - a.consistencyRate || String(a.key).localeCompare(String(b.key)));
  const consistentCount = rows.filter(r => r.consistent).length;
  return { rows, count: rows.length, consistentCount, averageConsistency: mean(rows.map(r => r.consistencyRate)), top: rows[0] || null, summary: `Infinity AI checked prompt consistency for ${rows.length} prompt(s); ${consistentCount} are consistent.` };
}
/** Idea 53700 — Prompt Bias Audits. Input records: {promptId, focusClass, hunts, totalHunts}. Focus share per class; biased at share >= 0.5. Audits prompts for biases such as over-focusing on certain vulnerability classes. */
export function auditPromptBias(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const promptId = String(r.promptId || 'prompt');
    const focusClass = String(r.focusClass || r.vulnClass || 'class');
    const hunts = num(r.hunts, 0);
    const totalHunts = num(r.totalHunts ?? r.total, 0);
    const focusShare = rate(hunts, totalHunts);
    return { key: `${promptId}|${focusClass}`, promptId, focusClass, hunts, totalHunts, focusShare, biased: focusShare >= 0.5 };
  }).sort((a, b) => b.focusShare - a.focusShare || String(a.key).localeCompare(String(b.key)));
  const biasedCount = rows.filter(r => r.biased).length;
  return { rows, count: rows.length, biasedCount, top: rows[0] || null, summary: `Infinity AI audited prompt bias across ${rows.length} class record(s); ${biasedCount} are biased.` };
}
