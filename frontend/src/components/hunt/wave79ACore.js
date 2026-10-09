/**
 * wave79ACore.js — Infinity AI · Dark-Matter · Wave 79A
 * Strategy analytics round 2, ideas 53121–53140.
 * Pure logic for strategy cost curves, hybrid strategy effectiveness,
 * strategy consistency scores, target-class strategy fit, strategy
 * decay over time, underdog strategy spotlights, strategy switching
 * triggers, first-principles vs playbook comparison, aggressive-vs-
 * stealth win rates, authenticated-first win rates, API-first vs
 * UI-first outcomes, recon-heavy vs recon-light, manual-seed strategy
 * boost, time-boxed sprint strategies, depth-first traversal wins,
 * breadth-first traversal wins, chained-finding strategies,
 * regression-hunt strategies, differential testing strategies, and
 * crowd-informed strategies. Every helper takes explicit inputs,
 * returns a structured view model, and never mutates arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE79_A_IDEAS = [
  { id: 53121, title: 'Strategy Cost Curves', skip: false },
  { id: 53122, title: 'Hybrid Strategy Effectiveness', skip: false },
  { id: 53123, title: 'Strategy Consistency Scores', skip: false },
  { id: 53124, title: 'Target-Class Strategy Fit', skip: false },
  { id: 53125, title: 'Strategy Decay Over Time', skip: false },
  { id: 53126, title: 'Underdog Strategy Spotlights', skip: false },
  { id: 53127, title: 'Strategy Switching Triggers', skip: false },
  { id: 53128, title: 'First-Principles vs Playbook Comparison', skip: false },
  { id: 53129, title: 'Aggressive-vs-Stealth Win Rates', skip: false },
  { id: 53130, title: 'Authenticated-First Win Rates', skip: false },
  { id: 53131, title: 'API-First vs UI-First Outcomes', skip: false },
  { id: 53132, title: 'Recon-Heavy vs Recon-Light', skip: false },
  { id: 53133, title: 'Manual-Seed Strategy Boost', skip: false },
  { id: 53134, title: 'Time-Boxed Sprint Strategies', skip: false },
  { id: 53135, title: 'Depth-First Traversal Wins', skip: false },
  { id: 53136, title: 'Breadth-First Traversal Wins', skip: false },
  { id: 53137, title: 'Chained-Finding Strategies', skip: false },
  { id: 53138, title: 'Regression-Hunt Strategies', skip: false },
  { id: 53139, title: 'Differential Testing Strategies', skip: false },
  { id: 53140, title: 'Crowd-Informed Strategies', skip: false },
];

function rate(part, whole) { return whole ? Math.round((part / whole) * 100) / 100 : 0; }
function findingsOf(h) { return Number(h.validatedFindings ?? h.findings ?? 0); }
function isWin(h) { return h.success === true || findingsOf(h) > 0; }
function groupHunts(hunts, keyFn) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = keyFn(h);
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, wins: 0, findings: 0, requests: 0, cost: 0 };
    g.hunts += 1;
    if (isWin(h)) g.wins += 1;
    g.findings += findingsOf(h);
    g.requests += Number(h.requests || 0);
    g.cost += Number(h.computeCost ?? h.cost ?? 0);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, winRate: rate(g.wins, g.hunts), findingsPerHunt: g.hunts ? Math.round((g.findings / g.hunts) * 100) / 100 : 0 }));
}
function sortByWin(rows) { return rows.sort((a, b) => b.winRate - a.winRate || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key))); }

/** Plot request and compute cost per strategy against findings (idea 53121). */
export function plotStrategyCostCurves(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.strategy || null).map(g => ({ ...g, costPerFinding: g.findings ? Math.round((g.cost / g.findings) * 100) / 100 : 0, requestsPerFinding: g.findings ? Math.round((g.requests / g.findings) * 100) / 100 : 0 })).sort((a, b) => a.costPerFinding - b.costPerFinding || String(a.key).localeCompare(String(b.key)));
  const barren = rows.filter(r => r.findings === 0 && r.cost > 0);
  return { rows, count: rows.length, cheapest: rows.find(r => r.findings > 0) || null, barren, barrenCount: barren.length, summary: `Infinity AI plotted cost curves for ${rows.length} strateg(ies); ${barren.length} expensive-but-barren.` };
}

/** Measure outcomes when two strategies blend mid-hunt vs one (idea 53122). */
export function measureHybridStrategyEffectiveness(hunts = [], options = {}) {
  const hybrid = (hunts || []).filter(h => h.hybrid === true || h.blended === true || (Array.isArray(h.strategies) && h.strategies.length > 1));
  const single = (hunts || []).filter(h => !(h.hybrid === true || h.blended === true || (Array.isArray(h.strategies) && h.strategies.length > 1)));
  const hybridRate = rate(hybrid.filter(isWin).length, hybrid.length);
  const singleRate = rate(single.filter(isWin).length, single.length);
  return { hybridHunts: hybrid.length, singleHunts: single.length, hybridRate, singleRate, delta: Math.round((hybridRate - singleRate) * 100) / 100, summary: `Infinity AI measured hybrid win rate ${hybridRate} vs single-strategy ${singleRate}.` };
}

/** Score strategies by outcome variance (idea 53123). */
export function scoreStrategyConsistency(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.strategy || null;
    if (!key) continue;
    const g = groups.get(key) || { key, outcomes: [] };
    g.outcomes.push(isWin(h) ? 1 : 0);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => {
    const mean = g.outcomes.reduce((s, v) => s + v, 0) / g.outcomes.length;
    const variance = g.outcomes.reduce((s, v) => s + (v - mean) ** 2, 0) / g.outcomes.length;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
    return { key: g.key, hunts: g.outcomes.length, winRate: Math.round(mean * 100) / 100, variance: Math.round(variance * 100) / 100, stdDev, consistency: Math.round((1 - stdDev) * 100) / 100 };
  }).sort((a, b) => b.consistency - a.consistency || b.winRate - a.winRate);
  return { rows, count: rows.length, mostConsistent: rows[0] || null, summary: `Infinity AI scored consistency for ${rows.length} strateg(ies).` };
}

/** Map each strategy win rate per target class (idea 53124). */
export function mapTargetClassStrategyFit(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.strategy && h.targetClass ? `${h.strategy} @ ${h.targetClass}` : null));
  const classes = [...new Set((hunts || []).map(h => h.targetClass).filter(Boolean))].sort();
  const bestByClass = classes.map(targetClass => {
    const scoped = rows.filter(r => r.key.endsWith(`@ ${targetClass}`));
    return { targetClass, best: scoped[0] || null };
  });
  return { rows, count: rows.length, classes, classCount: classes.length, bestByClass, summary: `Infinity AI mapped strategy fit across ${classes.length} target class(es).` };
}

/** Track whether a once-dominant strategy win rate is declining (idea 53125). */
export function trackStrategyDecayOverTime(snapshots = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.2);
  const groups = new Map();
  for (const s of snapshots || []) {
    const key = s.strategy || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    const firstRate = Number(sorted[0].winRate ?? sorted[0].hitRate ?? 0);
    const lastRate = Number(sorted[sorted.length - 1].winRate ?? sorted[sorted.length - 1].hitRate ?? 0);
    const delta = Math.round((lastRate - firstRate) * 100) / 100;
    return { key, points: sorted.length, firstRate, lastRate, delta, decaying: delta <= -threshold };
  }).sort((a, b) => a.delta - b.delta);
  const decaying = rows.filter(r => r.decaying);
  return { rows, count: rows.length, decaying, decayingCount: decaying.length, summary: `Infinity AI found ${decaying.length} decaying strateg(ies).` };
}

/** Surface low-usage strategies with high win rates (idea 53126). */
export function spotlightUnderdogStrategies(hunts = [], options = {}) {
  const maxHunts = Number(options.maxHunts || 5);
  const minWinRate = Number(options.minWinRate ?? 0.5);
  const rows = sortByWin(groupHunts(hunts, h => h.strategy || null));
  const underdogs = rows.filter(r => r.hunts <= maxHunts && r.winRate >= minWinRate);
  return { rows, count: rows.length, underdogs, underdogCount: underdogs.length, best: underdogs[0] || null, summary: `Infinity AI spotlighted ${underdogs.length} underdog strateg(ies).` };
}

/** Learn signals that preceded successful strategy switches (idea 53127). */
export function learnStrategySwitchingTriggers(switches = [], options = {}) {
  const rows = sortByWin(groupHunts(switches, s => s.trigger || s.signal || null).map(g => ({ ...g })));
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI learned switching triggers from ${rows.length} signal type(s).` };
}

/** Compare from-scratch reasoning hunts vs playbook hunts (idea 53128). */
export function compareFirstPrinciplesVsPlaybook(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.mode || h.approach || null));
  const firstPrinciples = rows.find(r => /first/i.test(r.key)) || null;
  const playbook = rows.find(r => /playbook/i.test(r.key)) || null;
  return { rows, count: rows.length, firstPrinciples, playbook, delta: firstPrinciples && playbook ? Math.round((firstPrinciples.winRate - playbook.winRate) * 100) / 100 : 0, summary: `Infinity AI compared first-principles vs playbook across ${rows.length} mode(s).` };
}

/** Contrast high-volume vs low-and-slow strategies (idea 53129). */
export function compareAggressiveVsStealthWinRates(hunts = [], options = {}) {
  const groups = groupHunts(hunts, h => h.posture || h.pace || null);
  const rows = groups.map(g => {
    const scoped = (hunts || []).filter(h => (h.posture || h.pace) === g.key);
    const detected = scoped.filter(h => h.detected === true).length;
    return { ...g, detectionRate: rate(detected, scoped.length) };
  }).sort((a, b) => b.winRate - a.winRate);
  const aggressive = rows.find(r => /aggress/i.test(r.key)) || null;
  const stealth = rows.find(r => /stealth|slow/i.test(r.key)) || null;
  return { rows, count: rows.length, aggressive, stealth, summary: `Infinity AI contrasted aggressive vs stealth across ${rows.length} posture(s).` };
}

/** Measure starting authenticated vs unauthenticated (idea 53130). */
export function measureAuthenticatedFirstWinRates(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.startMode || h.firstMode || null));
  const auth = rows.find(r => /auth/i.test(r.key) && !/unauth/i.test(r.key)) || null;
  const unauth = rows.find(r => /unauth/i.test(r.key)) || null;
  return { rows, count: rows.length, authenticatedFirst: auth, unauthenticatedFirst: unauth, delta: auth && unauth ? Math.round((auth.winRate - unauth.winRate) * 100) / 100 : 0, summary: `Infinity AI measured authenticated-first win rates across ${rows.length} start mode(s).` };
}

/** Compare API-prioritized vs UI-prioritized hunt yields (idea 53131). */
export function compareApiFirstVsUiFirstOutcomes(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.prioritySurface || h.firstSurface || null));
  const api = rows.find(r => /api/i.test(r.key)) || null;
  const ui = rows.find(r => /ui|interface/i.test(r.key)) || null;
  return { rows, count: rows.length, apiFirst: api, uiFirst: ui, delta: api && ui ? Math.round((api.findingsPerHunt - ui.findingsPerHunt) * 100) / 100 : 0, summary: `Infinity AI compared API-first vs UI-first across ${rows.length} surface(s).` };
}

/** Evaluate whether extended recon pays for itself (idea 53132). */
export function compareReconHeavyVsReconLight(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.reconLevel || null).map(g => {
    const scoped = (hunts || []).filter(h => h.reconLevel === g.key);
    const validated = scoped.reduce((s, h) => s + findingsOf(h), 0);
    const raw = scoped.reduce((s, h) => s + Number(h.rawFindings ?? h.findings ?? findingsOf(h)), 0);
    return { ...g, quality: raw ? Math.round((validated / raw) * 100) / 100 : 0 };
  }).sort((a, b) => b.quality - a.quality || b.winRate - a.winRate);
  const heavy = rows.find(r => /heavy/i.test(r.key)) || null;
  const light = rows.find(r => /light/i.test(r.key)) || null;
  return { rows, count: rows.length, heavy, light, summary: `Infinity AI compared recon-heavy vs recon-light across ${rows.length} level(s).` };
}

/** Quantify win-rate lift from a human seed hint (idea 53133). */
export function measureManualSeedBoost(hunts = [], options = {}) {
  const seeded = (hunts || []).filter(h => h.seeded === true || h.manualSeed === true);
  const autonomous = (hunts || []).filter(h => !(h.seeded === true || h.manualSeed === true));
  const seededRate = rate(seeded.filter(isWin).length, seeded.length);
  const autonomousRate = rate(autonomous.filter(isWin).length, autonomous.length);
  return { seededHunts: seeded.length, autonomousHunts: autonomous.length, seededRate, autonomousRate, lift: Math.round((seededRate - autonomousRate) * 100) / 100, summary: `Infinity AI measured manual-seed lift of ${Math.round((seededRate - autonomousRate) * 100) / 100}.` };
}

/** Compare 30-minute sprints vs continuous flow (idea 53134). */
export function compareTimeBoxedSprintStrategies(hunts = [], options = {}) {
  const rows = sortByWin(groupHunts(hunts, h => h.flowStyle || (h.timeBoxed === true || h.sprint === true ? 'sprint' : h.timeBoxed === false || h.sprint === false ? 'continuous' : null)));
  const sprint = rows.find(r => /sprint/i.test(r.key)) || null;
  const continuous = rows.find(r => /continuous|flow/i.test(r.key)) || null;
  return { rows, count: rows.length, sprint, continuous, delta: sprint && continuous ? Math.round((sprint.winRate - continuous.winRate) * 100) / 100 : 0, summary: `Infinity AI compared sprint vs continuous across ${rows.length} flow style(s).` };
}

function traversalComparison(hunts, wanted) {
  const scoped = (hunts || []).filter(h => h.traversal === wanted);
  const others = (hunts || []).filter(h => h.traversal && h.traversal !== wanted);
  const traversalRate = rate(scoped.filter(isWin).length, scoped.length);
  const otherRate = rate(others.filter(isWin).length, others.length);
  const rows = sortByWin(groupHunts(scoped, h => h.strategy || null));
  return { rows, traversalHunts: scoped.length, otherHunts: others.length, traversalRate, otherRate, delta: Math.round((traversalRate - otherRate) * 100) / 100 };
}

/** Track win rates for exhausting one feature first (idea 53135). */
export function trackDepthFirstTraversalWins(hunts = [], options = {}) {
  const v = traversalComparison(hunts, 'depth-first');
  return { ...v, summary: `Infinity AI tracked depth-first wins across ${v.traversalHunts} hunt(s), delta ${v.delta}.` };
}

/** Track win rates for skimming all features first (idea 53136). */
export function trackBreadthFirstTraversalWins(hunts = [], options = {}) {
  const v = traversalComparison(hunts, 'breadth-first');
  return { ...v, summary: `Infinity AI tracked breadth-first wins across ${v.traversalHunts} hunt(s), delta ${v.delta}.` };
}

/** Measure strategies that chain low-severity issues upward (idea 53137). */
export function measureChainedFindingStrategies(hunts = [], options = {}) {
  const rows = groupHunts(hunts, h => h.strategy || null).map(g => {
    const scoped = (hunts || []).filter(h => h.strategy === g.key);
    const chained = scoped.filter(h => h.chained === true || Number(h.chainCount || 0) > 0);
    return { ...g, chainedHunts: chained.length, chainRate: rate(chained.length, scoped.length), chainedFindings: chained.reduce((s, h) => s + findingsOf(h), 0) };
  }).sort((a, b) => b.chainRate - a.chainRate || b.winRate - a.winRate);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI measured chained-finding strategies across ${rows.length} strateg(ies).` };
}

/** Evaluate re-testing previously hunted targets (idea 53138). */
export function evaluateRegressionHuntStrategies(hunts = [], options = {}) {
  const scoped = (hunts || []).filter(h => h.huntType === 'regression' || h.regression === true);
  const rows = sortByWin(groupHunts(scoped, h => h.strategy || null));
  const newIssueRate = rate(scoped.filter(h => findingsOf(h) > 0).length, scoped.length);
  return { rows, count: rows.length, regressionHunts: scoped.length, newIssueRate, best: rows[0] || null, summary: `Infinity AI evaluated regression hunts across ${scoped.length} hunt(s), new-issue rate ${newIssueRate}.` };
}

/** Compare staging-vs-production differential strategies (idea 53139). */
export function compareDifferentialTestingStrategies(hunts = [], options = {}) {
  const scoped = (hunts || []).filter(h => h.differential === true || h.huntType === 'differential');
  const rows = sortByWin(groupHunts(scoped, h => h.strategy || null));
  const diffFindings = scoped.reduce((s, h) => s + Number(h.diffFindings ?? findingsOf(h)), 0);
  return { rows, count: rows.length, differentialHunts: scoped.length, diffFindings, best: rows[0] || null, summary: `Infinity AI compared differential strategies across ${scoped.length} hunt(s), ${diffFindings} diff finding(s).` };
}

/** Measure seeding hunts with public disclosure patterns (idea 53140). */
export function measureCrowdInformedStrategies(hunts = [], options = {}) {
  const informed = (hunts || []).filter(h => h.crowdInformed === true || h.crowdSeeded === true);
  const plain = (hunts || []).filter(h => !(h.crowdInformed === true || h.crowdSeeded === true));
  const informedRate = rate(informed.filter(isWin).length, informed.length);
  const plainRate = rate(plain.filter(isWin).length, plain.length);
  const patterns = informed.reduce((s, h) => s + Number(h.disclosurePatterns || h.patterns || 0), 0);
  return { informedHunts: informed.length, plainHunts: plain.length, informedRate, plainRate, lift: Math.round((informedRate - plainRate) * 100) / 100, patterns, summary: `Infinity AI measured crowd-informed lift of ${Math.round((informedRate - plainRate) * 100) / 100} using ${patterns} pattern(s).` };
}
