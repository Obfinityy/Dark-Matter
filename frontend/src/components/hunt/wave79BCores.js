/**
 * wave79BCores.js — Infinity AI · Dark-Matter · Wave 79B
 * Strategy governance and learning analytics, ideas 53141–53160.
 * Pure logic for adversarial mindset prompts, checklist-driven
 * strategies, risk-ranked targeting, session-based strategy
 * rotation, strategy performance by tenure, multi-agent strategy
 * tournaments, strategy explainability scores, fallback strategy
 * effectiveness, strategy learning velocity, context-length
 * strategy effects, tool-orchestration strategies, human-in-the-
 * loop checkpoints, strategy fatigue detection, seasonal strategy
 * trends, strategy portfolio balancing, win-rate confidence
 * grading, strategy counterfactual estimates, strategy genealogy
 * tracking, strategy adoption curves, and strategy kill criteria.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE79_B_IDEAS = [
  { id: 53141, title: 'Adversarial Mindset Prompts', skip: false },
  { id: 53142, title: 'Checklist-Driven Strategies', skip: false },
  { id: 53143, title: 'Risk-Ranked Targeting', skip: false },
  { id: 53144, title: 'Session-Based Strategy Rotation', skip: false },
  { id: 53145, title: 'Strategy Performance by Tenure', skip: false },
  { id: 53146, title: 'Multi-Agent Strategy Tournaments', skip: false },
  { id: 53147, title: 'Strategy Explainability Scores', skip: false },
  { id: 53148, title: 'Fallback Strategy Effectiveness', skip: false },
  { id: 53149, title: 'Strategy Learning Velocity', skip: false },
  { id: 53150, title: 'Context-Length Strategy Effects', skip: false },
  { id: 53151, title: 'Tool-Orchestration Strategies', skip: false },
  { id: 53152, title: 'Human-in-the-Loop Checkpoints (learning)', skip: false },
  { id: 53153, title: 'Strategy Fatigue Detection', skip: false },
  { id: 53154, title: 'Seasonal Strategy Trends', skip: false },
  { id: 53155, title: 'Strategy Portfolio Balancing', skip: false },
  { id: 53156, title: 'Win-Rate Confidence Grading', skip: false },
  { id: 53157, title: 'Strategy Counterfactual Simulator', skip: false },
  { id: 53158, title: 'Strategy Genealogy Tracking', skip: false },
  { id: 53159, title: 'Strategy Adoption Curves', skip: false },
  { id: 53160, title: 'Strategy Kill Criteria', skip: false },
];

function rate(part, whole) { return whole ? Math.round((part / whole) * 100) / 100 : 0; }
function findingsOf(h) { return Number(h.validatedFindings ?? h.findings ?? 0); }
function isWin(h) { return h.success === true || findingsOf(h) > 0; }
function groupHunts(hunts, keyFn) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = keyFn(h);
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, wins: 0, findings: 0 };
    g.hunts += 1;
    if (isWin(h)) g.wins += 1;
    g.findings += findingsOf(h);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, winRate: rate(g.wins, g.hunts), findingsPerHunt: g.hunts ? Math.round((g.findings / g.hunts) * 100) / 100 : 0 })).sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
}

/** Test attacker-framed prompts vs neutral analyst framings (idea 53141). */
export function testAdversarialMindsetPrompts(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.promptFraming || h.framing || null);
  const adversarial = rows.find(r => /adversar|attacker/i.test(r.key)) || null;
  const neutral = rows.find(r => /neutral|analyst/i.test(r.key)) || null;
  return { rows, count: rows.length, adversarial, neutral, delta: adversarial && neutral ? Math.round((adversarial.winRate - neutral.winRate) * 100) / 100 : 0, summary: `Infinity AI tested adversarial vs neutral framings across ${rows.length} group(s).` };
}

/** Evaluate rigid checklist execution vs adaptive exploration (idea 53142). */
export function evaluateChecklistDrivenStrategies(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.executionStyle || h.style || null).map(g => {
    const scoped = (hunts || []).filter(h => (h.executionStyle || h.style) === g.key);
    const coverage = scoped.reduce((s, h) => s + Number(h.coverage ?? h.coverageScore ?? 0), 0);
    return { ...g, avgCoverage: scoped.length ? Math.round((coverage / scoped.length) * 100) / 100 : 0 };
  }).sort((a, b) => b.winRate - a.winRate);
  const checklist = rows.find(r => /checklist/i.test(r.key)) || null;
  const adaptive = rows.find(r => /adaptive|explor/i.test(r.key)) || null;
  return { rows, count: rows.length, checklist, adaptive, summary: `Infinity AI evaluated checklist vs adaptive across ${rows.length} style(s).` };
}

/** Measure business-critical-first vs attack-surface-first (idea 53143). */
export function measureRiskRankedTargeting(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.targeting || h.targetPriority || null);
  const business = rows.find(r => /business|critical/i.test(r.key)) || null;
  const surface = rows.find(r => /surface|technical/i.test(r.key)) || null;
  return { rows, count: rows.length, businessFirst: business, surfaceFirst: surface, delta: business && surface ? Math.round((business.winRate - surface.winRate) * 100) / 100 : 0, summary: `Infinity AI measured risk-ranked targeting across ${rows.length} group(s).` };
}

/** Track rotating strategies per session vs committing (idea 53144). */
export function trackSessionBasedStrategyRotation(hunts = [], options = {}) {
  const rotating = (hunts || []).filter(h => h.rotation === 'session' || h.rotatesPerSession === true);
  const committed = (hunts || []).filter(h => !(h.rotation === 'session' || h.rotatesPerSession === true));
  const rotationRate = rate(rotating.filter(isWin).length, rotating.length);
  const committedRate = rate(committed.filter(isWin).length, committed.length);
  return { rotatingHunts: rotating.length, committedHunts: committed.length, rotationRate, committedRate, delta: Math.round((rotationRate - committedRate) * 100) / 100, summary: `Infinity AI tracked session rotation delta of ${Math.round((rotationRate - committedRate) * 100) / 100}.` };
}

/** Compare strategies by model-version tenure (idea 53145). */
export function compareStrategyPerformanceByTenure(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.modelVersion || h.tenure || null);
  return { rows, count: rows.length, best: rows[0] || null, current: rows.find(r => /current|latest/i.test(r.key)) || rows[0] || null, summary: `Infinity AI compared strategy performance across ${rows.length} tenure group(s).` };
}

/** Pit strategies on identical cloned targets (idea 53146). */
export function runMultiAgentStrategyTournaments(matches = [], options = {}) {
  const groups = new Map();
  for (const m of matches || []) {
    for (const side of ['winner', 'strategy']) {
      const key = m[side] || null;
      if (!key) continue;
    }
    const winner = m.winner || null;
    const a = m.strategyA || null;
    const b = m.strategyB || null;
    for (const key of [a, b].filter(Boolean)) {
      const g = groups.get(key) || { key, matches: 0, wins: 0, findings: 0 };
      g.matches += 1;
      if (winner === key) g.wins += 1;
      g.findings += Number(m[`${key === a ? 'a' : 'b'}Findings`] ?? 0);
      groups.set(key, g);
    }
    if (winner && !groups.has(winner)) groups.set(winner, { key: winner, matches: 0, wins: 1, findings: 0 });
  }
  const rows = [...groups.values()].map(g => ({ ...g, winRate: rate(g.wins, g.matches) })).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, champion: rows[0] || null, summary: `Infinity AI ran strategy tournaments across ${rows.length} strateg(ies).` };
}

/** Rate how well the agent articulates strategy choices (idea 53147). */
export function scoreStrategyExplainability(records = [], options = {}) {
  const rows = groupHunts(records, r => r.strategy || null).map(g => {
    const scoped = (records || []).filter(r => r.strategy === g.key);
    const total = scoped.reduce((s, r) => s + Number(r.explainabilityScore ?? r.score ?? 0), 0);
    return { ...g, avgScore: scoped.length ? Math.round((total / scoped.length) * 100) / 100 : 0 };
  }).sort((a, b) => b.avgScore - a.avgScore);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI scored explainability for ${rows.length} strateg(ies).` };
}

/** Measure backup strategies when the primary stalls (idea 53148). */
export function measureFallbackStrategyEffectiveness(hunts = [], options = {}) {
  const fallback = (hunts || []).filter(h => h.isFallback === true || h.fallback === true);
  const rows = groupHunts(fallback, h => h.strategy || h.fallbackStrategy || null);
  const recovered = fallback.filter(h => isWin(h)).length;
  return { rows, count: rows.length, fallbackHunts: fallback.length, recovered, recoveryRate: rate(recovered, fallback.length), best: rows[0] || null, summary: `Infinity AI measured fallback recovery rate ${rate(recovered, fallback.length)} across ${fallback.length} hunt(s).` };
}

/** Track how quickly a new strategy win rate stabilizes (idea 53149). */
export function trackStrategyLearningVelocity(snapshots = [], options = {}) {
  const groups = new Map();
  for (const s of snapshots || []) {
    const key = s.strategy || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => Number(a.trial || a.hunts || 0) - Number(b.trial || b.hunts || 0));
    const firstRate = Number(sorted[0].winRate ?? sorted[0].hitRate ?? 0);
    const lastRate = Number(sorted[sorted.length - 1].winRate ?? sorted[sorted.length - 1].hitRate ?? 0);
    return { key, trials: sorted.length, firstRate, lastRate, velocity: Math.round((lastRate - firstRate) * 100) / 100, stabilized: Math.abs(lastRate - firstRate) < 0.1 && sorted.length >= 3 };
  }).sort((a, b) => b.velocity - a.velocity);
  return { rows, count: rows.length, fastest: rows[0] || null, summary: `Infinity AI tracked learning velocity for ${rows.length} strateg(ies).` };
}

/** Evaluate aggressive context summarization vs full history (idea 53150). */
export function evaluateContextLengthStrategyEffects(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.contextStyle || h.contextMode || null);
  const summarized = rows.find(r => /summar/i.test(r.key)) || null;
  const full = rows.find(r => /full/i.test(r.key)) || null;
  return { rows, count: rows.length, summarized, fullHistory: full, delta: summarized && full ? Math.round((summarized.winRate - full.winRate) * 100) / 100 : 0, summary: `Infinity AI evaluated context-length effects across ${rows.length} style(s).` };
}

/** Compare many-tool chaining vs few-tool depth (idea 53151). */
export function compareToolOrchestrationStrategies(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.toolStyle || h.orchestration || null).map(g => {
    const scoped = (hunts || []).filter(h => (h.toolStyle || h.orchestration) === g.key);
    const tools = scoped.reduce((s, h) => s + Number(h.toolCount || h.toolsUsed || 0), 0);
    return { ...g, avgTools: scoped.length ? Math.round((tools / scoped.length) * 100) / 100 : 0 };
  }).sort((a, b) => b.winRate - a.winRate);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI compared tool-orchestration strategies across ${rows.length} style(s).` };
}

/** Measure human review checkpoints at fixed intervals (idea 53152). */
export function measureHumanInLoopCheckpoints(hunts = [], options = {}) {
  const withCheckpoints = (hunts || []).filter(h => h.humanCheckpoints === true || Number(h.checkpoints || 0) > 0);
  const without = (hunts || []).filter(h => !(h.humanCheckpoints === true || Number(h.checkpoints || 0) > 0));
  const withRate = rate(withCheckpoints.filter(isWin).length, withCheckpoints.length);
  const withoutRate = rate(without.filter(isWin).length, without.length);
  return { withHunts: withCheckpoints.length, withoutHunts: without.length, withRate, withoutRate, lift: Math.round((withRate - withoutRate) * 100) / 100, summary: `Infinity AI measured human-checkpoint lift of ${Math.round((withRate - withoutRate) * 100) / 100}.` };
}

/** Flag reuse of one strategy across too many hunts (idea 53153). */
export function detectStrategyFatigue(hunts = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.6);
  const total = (hunts || []).length;
  const rows = groupHunts(hunts, h => h.strategy || null).map(g => ({ ...g, share: total ? Math.round((g.hunts / total) * 100) / 100 : 0, fatigued: total ? (g.hunts / total) >= threshold : false })).sort((a, b) => b.share - a.share);
  const fatigued = rows.filter(r => r.fatigued);
  return { rows, count: rows.length, fatigued, fatiguedCount: fatigued.length, summary: `Infinity AI flagged ${fatigued.length} fatigued strateg(ies).` };
}

/** Analyze holiday freeze vs active development performance (idea 53154). */
export function analyzeSeasonalStrategyTrends(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.strategy && h.season ? `${h.strategy} @ ${h.season}` : null);
  const seasons = [...new Set((hunts || []).map(h => h.season).filter(Boolean))].sort();
  return { rows, count: rows.length, seasons, seasonCount: seasons.length, best: rows[0] || null, summary: `Infinity AI analyzed seasonal trends across ${seasons.length} season(s).` };
}

/** Recommend a diversified mix across concurrent hunts (idea 53155). */
export function recommendStrategyPortfolioBalancing(stats = [], options = {}) {
  const rowsIn = (stats || []).map(s => ({ key: s.strategy || s.key || 'strategy', winRate: Number(s.winRate ?? (s.wins && s.hunts ? s.wins / s.hunts : 0)), hunts: Number(s.hunts || 0), findingTypes: Array.isArray(s.findingTypes) ? s.findingTypes : [] }));
  const totalRate = rowsIn.reduce((s, r) => s + Math.max(0, r.winRate), 0);
  const rows = rowsIn.map(r => ({ ...r, allocation: totalRate ? Math.round((Math.max(0, r.winRate) / totalRate) * 100) / 100 : 0 })).sort((a, b) => b.allocation - a.allocation);
  const types = [...new Set(rowsIn.flatMap(r => r.findingTypes))];
  return { rows, count: rows.length, findingTypes: types, diversityCount: types.length, top: rows[0] || null, summary: `Infinity AI recommended a ${rows.length}-strategy portfolio covering ${types.length} finding type(s).` };
}

/** Grade every win rate with a data-volume confidence label (idea 53156). */
export function gradeWinRateConfidence(stats = [], options = {}) {
  const rows = (stats || []).map(s => {
    const hunts = Number(s.hunts ?? s.attempts ?? 0);
    const wins = Number(s.wins ?? s.successes ?? 0);
    const winRate = s.winRate !== undefined ? Number(s.winRate) : rate(wins, hunts);
    const grade = hunts >= 30 ? 'robust' : hunts >= 10 ? 'solid' : 'thin';
    return { key: s.strategy || s.key || 'strategy', hunts, wins, winRate, grade };
  }).sort((a, b) => b.winRate - a.winRate);
  return { rows, count: rows.length, robustCount: rows.filter(r => r.grade === 'robust').length, solidCount: rows.filter(r => r.grade === 'solid').length, thinCount: rows.filter(r => r.grade === 'thin').length, summary: `Infinity AI graded win-rate confidence for ${rows.length} strateg(ies).` };
}

/** Estimate what a different strategy would likely have found (idea 53157). */
export function estimateStrategyCounterfactual(hunt = {}, alternatives = [], options = {}) {
  const actualFindings = findingsOf(hunt);
  const actualRate = Number(hunt.findingsPerHour ?? hunt.rate ?? 0);
  const rows = (alternatives || []).map(a => {
    const expectedRate = Number(a.findingsPerHour ?? a.expectedRate ?? a.winRate ?? 0);
    return { strategy: a.strategy || a.key || 'strategy', expectedRate, expectedFindings: Math.round(expectedRate * Number(hunt.hours || 1)), deltaVsActual: Math.round((expectedRate * Number(hunt.hours || 1) - actualFindings) * 100) / 100 };
  }).sort((a, b) => b.expectedFindings - a.expectedFindings);
  return { actualFindings, actualRate, rows, count: rows.length, bestAlternative: rows[0] || null, summary: `Infinity AI estimated counterfactual outcomes for ${rows.length} alternative strateg(ies).` };
}

/** Trace strategy evolution and winning lineage branches (idea 53158). */
export function trackStrategyGenealogy(lineages = [], options = {}) {
  const rows = groupHunts(lineages, l => l.lineage || l.branch || l.parentStrategy || null);
  const mutations = (lineages || []).reduce((s, l) => s + Number(l.mutations || (l.mutated === true ? 1 : 0)), 0);
  return { rows, count: rows.length, mutations, bestLineage: rows[0] || null, summary: `Infinity AI traced ${rows.length} strategy lineage branch(es) with ${mutations} mutation(s).` };
}

/** Track fleet adoption speed for a newly proven strategy (idea 53159). */
export function trackStrategyAdoptionCurves(records = [], options = {}) {
  const sorted = [...(records || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const rows = sorted.map(r => ({ strategy: r.strategy || 'strategy', at: r.at || null, adoptionShare: Number(r.adoptionShare ?? r.share ?? 0), missedFindings: Number(r.missedFindings ?? r.lagCost ?? 0) }));
  const latest = rows[rows.length - 1] || null;
  const lagCost = rows.reduce((s, r) => s + r.missedFindings, 0);
  return { rows, count: rows.length, latest, lagCost, summary: `Infinity AI tracked adoption across ${rows.length} point(s); lag cost ${lagCost} finding(s).` };
}

/** Define automatic retirement thresholds for weak strategies (idea 53160). */
export function defineStrategyKillCriteria(stats = [], options = {}) {
  const minHunts = Number(options.minHunts || 20);
  const baseline = Number(options.baseline ?? 0.2);
  const rows = (stats || []).map(s => {
    const hunts = Number(s.hunts ?? s.attempts ?? 0);
    const wins = Number(s.wins ?? s.successes ?? 0);
    const winRate = s.winRate !== undefined ? Number(s.winRate) : rate(wins, hunts);
    return { key: s.strategy || s.key || 'strategy', hunts, wins, winRate, retire: hunts >= minHunts && winRate < baseline };
  }).sort((a, b) => a.winRate - b.winRate);
  const retire = rows.filter(r => r.retire);
  return { rows, count: rows.length, retire, retireCount: retire.length, baseline, minHunts, summary: `Infinity AI flagged ${retire.length} strateg(ies) for retirement below baseline ${baseline}.` };
}
