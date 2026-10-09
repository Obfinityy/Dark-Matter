/**
 * wave78BCores.js — Infinity AI · Dark-Matter · Wave 78B
 * Stack operations and strategy analytics, ideas 53101–53120.
 * Pure logic for regional hosting variance, reverse proxy behavior
 * ledger, stack-specific evasion ratings, origin-vs-edge response
 * diffs, framework default config baselines, stack-aware payload
 * shortlists, payload-stack mismatch warnings, stack rarity research
 * prompts, quarterly stack effectiveness report, stack fingerprint
 * correction loop, cross-stack transfer scores, stack-specific
 * confirmation playbooks, payload family retirement votes, new stack
 * onboarding checklist, stack drift detection, effectiveness
 * confidence intervals, strategy leaderboard by findings, opening
 * move win rates, strategy-vs-severity matrix, and comeback strategy
 * tracking. Every helper takes explicit inputs, never mutates them,
 * and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE78_B_IDEAS = [
  { id: 53101, title: 'Regional Hosting Variance', skip: false },
  { id: 53102, title: 'Reverse Proxy Behavior Ledger', skip: false },
  { id: 53103, title: 'Stack-Specific Evasion Ratings', skip: false },
  { id: 53104, title: 'Origin-vs-Edge Response Diffs', skip: false },
  { id: 53105, title: 'Framework Default Config Baselines', skip: false },
  { id: 53106, title: 'Stack-Aware Payload Shortlists', skip: false },
  { id: 53107, title: 'Payload-Stack Mismatch Warnings', skip: false },
  { id: 53108, title: 'Stack Rarity Research Prompts', skip: false },
  { id: 53109, title: 'Quarterly Stack Effectiveness Report', skip: false },
  { id: 53110, title: 'Stack Fingerprint Correction Loop', skip: false },
  { id: 53111, title: 'Cross-Stack Transfer Scores', skip: false },
  { id: 53112, title: 'Stack-Specific Confirmation Playbooks', skip: false },
  { id: 53113, title: 'Payload Family Retirement Votes', skip: false },
  { id: 53114, title: 'New Stack Onboarding Checklist', skip: false },
  { id: 53115, title: 'Stack Drift Detection', skip: false },
  { id: 53116, title: 'Effectiveness Confidence Intervals', skip: false },
  { id: 53117, title: 'Strategy Leaderboard by Findings', skip: false },
  { id: 53118, title: 'Opening Move Win Rates', skip: false },
  { id: 53119, title: 'Strategy-vs-Severity Matrix', skip: false },
  { id: 53120, title: 'Comeback Strategy Tracking', skip: false },
];

function rate(part, whole) { return whole ? Math.round((part / whole) * 100) / 100 : 0; }
function groupRates(attempts, keyFn) {
  const groups = new Map();
  for (const a of attempts || []) {
    const key = keyFn(a);
    if (!key) continue;
    const g = groups.get(key) || { key, attempts: 0, successes: 0 };
    g.attempts += 1;
    if (a.success === true) g.successes += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ ...g, hitRate: rate(g.successes, g.attempts) })).sort((a, b) => b.hitRate - a.hitRate || b.attempts - a.attempts || String(a.key).localeCompare(String(b.key)));
}

/** Compare payload outcomes for the same stack across regions (idea 53101). */
export function compareRegionalHostingVariance(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.region && a.stack ? `${a.stack} @ ${a.region}` : null);
  const byRegion = groupRates(attempts, a => a.region || null);
  const rates = rows.map(r => r.hitRate);
  const spread = rates.length ? Math.round((Math.max(...rates) - Math.min(...rates)) * 100) / 100 : 0;
  return { rows, count: rows.length, byRegion, spread, best: rows[0] || null, summary: `Infinity AI regional hosting spread is ${spread} across ${rows.length} stack-region group(s).` };
}

/** Ledger how each reverse proxy transforms or blocks payload shapes (idea 53102). */
export function buildReverseProxyBehaviorLedger(attempts = [], options = {}) {
  const groups = new Map();
  for (const a of attempts || []) {
    const key = a.proxy || a.reverseProxy || null;
    if (!key) continue;
    const outcome = a.blocked === true ? 'blocked' : a.transformed === true ? 'transformed' : a.success === true ? 'passed' : 'observed';
    const g = groups.get(key) || { key, attempts: 0, successes: 0, blocked: 0, transformed: 0, passed: 0 };
    g.attempts += 1;
    if (a.success === true) g.successes += 1;
    if (outcome === 'blocked') g.blocked += 1;
    if (outcome === 'transformed') g.transformed += 1;
    if (outcome === 'passed') g.passed += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, hitRate: rate(g.successes, g.attempts), blockRate: rate(g.blocked, g.attempts), transformRate: rate(g.transformed, g.attempts) })).sort((a, b) => b.blockRate - a.blockRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, strictest: rows[0] || null, summary: `Infinity AI ledgered reverse proxy behavior for ${rows.length} proxy type(s).` };
}

/** Rate evasion techniques per WAF-plus-stack combination (idea 53103). */
export function rateStackSpecificEvasion(attempts = [], options = {}) {
  const scoped = (attempts || []).filter(a => a.evasion || a.evasionTechnique);
  const rows = groupRates(scoped, a => `${a.evasion || a.evasionTechnique} via ${a.waf || 'no-waf'} + ${a.stack || 'stack'}`);
  return { rows, count: rows.length, evasionAttempts: scoped.length, best: rows[0] || null, summary: `Infinity AI rated ${scoped.length} evasion attempt(s) across ${rows.length} WAF-plus-stack group(s).` };
}

/** Log cases where edge and origin responses differed (idea 53104). */
export function diffOriginVsEdgeResponses(pairs = [], options = {}) {
  const rows = (pairs || []).map(p => {
    const originSuccess = p.originSuccess === true;
    const edgeSuccess = p.edgeSuccess === true;
    const statusDiff = Number(p.originStatus || 0) !== Number(p.edgeStatus || 0);
    return { payloadId: p.payloadId || p.id || null, family: p.family || 'payload', originStatus: Number(p.originStatus || 0), edgeStatus: Number(p.edgeStatus || 0), originSuccess, edgeSuccess, differed: statusDiff || originSuccess !== edgeSuccess };
  });
  const diffs = rows.filter(r => r.differed);
  return { rows, count: rows.length, diffs, diffCount: diffs.length, diffRate: rate(diffs.length, rows.length), summary: `Infinity AI found ${diffs.length} origin-vs-edge response diff(s) across ${rows.length} payload(s).` };
}

/** Record default-config baselines and hardened deviations (idea 53105). */
export function baselineFrameworkDefaultConfig(frameworks = [], options = {}) {
  const rows = (frameworks || []).map(f => {
    const defaults = f.defaults || {};
    const hardenedKeys = Object.keys(defaults).filter(k => f.hardened && f.hardened[k] !== undefined && f.hardened[k] !== defaults[k]);
    const deviationCount = hardenedKeys.length;
    return { framework: f.framework || 'framework', version: f.version || null, defaultCount: Object.keys(defaults).length, deviationCount, hardened: deviationCount > 0, deviations: hardenedKeys };
  }).sort((a, b) => b.deviationCount - a.deviationCount || String(a.framework).localeCompare(String(b.framework)));
  return { rows, count: rows.length, hardenedCount: rows.filter(r => r.hardened).length, mostHardened: rows[0] || null, summary: `Infinity AI baselined default config for ${rows.length} framework group(s); ${rows.filter(r => r.hardened).length} hardened.` };
}

/** Generate the top payload shortlist for a fingerprinted stack (idea 53106). */
export function generateStackAwarePayloadShortlist(attempts = [], options = {}) {
  const stack = options.stack || null;
  const limit = Number(options.limit || 20);
  const scoped = stack ? (attempts || []).filter(a => (a.stack || a.detectedStack) === stack) : (attempts || []);
  const rows = groupRates(scoped, a => a.payload || a.family || null).slice(0, limit).map((r, i) => ({ rank: i + 1, payload: r.key, attempts: r.attempts, successes: r.successes, hitRate: r.hitRate }));
  return { stack, rows, count: rows.length, top: rows[0] || null, summary: `Infinity AI generated a ${rows.length}-payload shortlist for ${stack || 'the detected stack'}.` };
}

/** Warn when planned payloads have near-zero history on the stack (idea 53107). */
export function warnPayloadStackMismatch(plans = [], history = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.05);
  const historyRows = groupRates(history, a => `${a.payload || a.family || ''} @ ${a.stack || a.detectedStack || ''}`);
  const byKey = new Map(historyRows.map(r => [r.key, r]));
  const rows = (plans || []).map(p => {
    const payload = p.payload || p.family || 'payload';
    const stack = p.stack || p.detectedStack || 'stack';
    const hit = byKey.get(`${payload} @ ${stack}`);
    const historicalRate = hit ? hit.hitRate : 0;
    const attempts = hit ? hit.attempts : 0;
    return { payload, stack, historicalRate, attempts, mismatch: attempts === 0 || historicalRate <= threshold };
  });
  const warnings = rows.filter(r => r.mismatch);
  return { rows, count: rows.length, warnings, warningCount: warnings.length, summary: `Infinity AI raised ${warnings.length} payload-stack mismatch warning(s).` };
}

/** Prompt manual research for stacks with thin history (idea 53108). */
export function promptStackRarityResearch(stacks = [], options = {}) {
  const minDataPoints = Number(options.minDataPoints || 10);
  const rows = (stacks || []).map(s => ({ stack: s.stack || s.name || 'stack', dataPoints: Number(s.dataPoints || s.attempts || 0) })).map(r => ({ ...r, rare: r.dataPoints < minDataPoints, prompt: r.dataPoints < minDataPoints ? `Infinity AI: manually investigate ${r.stack}; only ${r.dataPoints} historical data point(s).` : null })).sort((a, b) => a.dataPoints - b.dataPoints);
  const prompts = rows.filter(r => r.rare);
  return { rows, count: rows.length, prompts, promptCount: prompts.length, rarest: rows[0] || null, summary: `Infinity AI prompted research for ${prompts.length} rare stack(s).` };
}

/** Publish a quarterly rollup of payload family effectiveness by stack (idea 53109). */
export function buildQuarterlyStackEffectivenessReport(attempts = [], options = {}) {
  const rows = groupRates(attempts, a => a.quarter && a.stack && (a.family || a.payload) ? `${a.quarter} ${a.stack} ${a.family || a.payload}` : null);
  const quarters = [...new Set((attempts || []).map(a => a.quarter).filter(Boolean))].sort();
  const first = quarters[0] || null;
  const last = quarters[quarters.length - 1] || null;
  const byKey = new Map(rows.map(r => [r.key, r]));
  const trends = [];
  if (first && last && first !== last) {
    const keys = new Set(rows.map(r => r.key.replace(/^\S+ /, '')));
    for (const rest of keys) {
      const f = byKey.get(`${first} ${rest}`);
      const l = byKey.get(`${last} ${rest}`);
      if (f && l) trends.push({ group: rest, fromRate: f.hitRate, toRate: l.hitRate, delta: Math.round((l.hitRate - f.hitRate) * 100) / 100 });
    }
    trends.sort((a, b) => b.delta - a.delta);
  }
  return { rows, count: rows.length, quarters, trends, biggestGain: trends[0] || null, biggestLoss: trends[trends.length - 1] || null, summary: `Infinity AI built a quarterly stack effectiveness report across ${quarters.length} quarter(s).` };
}

/** Re-attribute hunt lessons after a fingerprint correction (idea 53110). */
export function runStackFingerprintCorrectionLoop(corrections = [], options = {}) {
  const rows = (corrections || []).map(c => ({ huntId: c.huntId || c.id || null, fromStack: c.fromStack || c.wrongStack || null, toStack: c.toStack || c.correctStack || null, lessons: Number(c.lessons || c.reattributed || 0), applied: c.applied !== false }));
  const applied = rows.filter(r => r.applied);
  return { rows, count: rows.length, appliedCount: applied.length, reattributedLessons: applied.reduce((s, r) => s + r.lessons, 0), summary: `Infinity AI re-attributed ${applied.reduce((s, r) => s + r.lessons, 0)} lesson(s) across ${applied.length} fingerprint correction(s).` };
}

/** Measure how well payloads transfer between similar stacks (idea 53111). */
export function scoreCrossStackTransfer(attempts = [], options = {}) {
  const scoped = (attempts || []).filter(a => (a.payload || a.family) && a.sourceStack && a.targetStack);
  const rows = groupRates(scoped, a => `${a.payload || a.family} ${a.sourceStack} -> ${a.targetStack}`);
  return { rows, count: rows.length, transferAttempts: scoped.length, best: rows[0] || null, summary: `Infinity AI scored cross-stack transfer across ${rows.length} payload route(s).` };
}

/** Store the cheapest confirmation sequence per finding type and stack (idea 53112). */
export function buildStackSpecificConfirmationPlaybooks(confirmations = [], options = {}) {
  const groups = new Map();
  for (const c of confirmations || []) {
    const key = c.findingType && c.stack ? `${c.findingType} @ ${c.stack}` : null;
    if (!key) continue;
    const g = groups.get(key) || { key, findingType: c.findingType, stack: c.stack, runs: 0, totalRequests: 0, sequences: new Set() };
    g.runs += 1;
    g.totalRequests += Number(c.requests || c.confirmRequests || 0);
    if (c.sequence) g.sequences.add(c.sequence);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, findingType: g.findingType, stack: g.stack, runs: g.runs, avgRequests: g.runs ? Math.round((g.totalRequests / g.runs) * 10) / 10 : 0, sequences: [...g.sequences] })).sort((a, b) => a.avgRequests - b.avgRequests || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, cheapest: rows[0] || null, summary: `Infinity AI built confirmation playbooks for ${rows.length} finding-type and stack pair(s).` };
}

/** Aggregate retirement recommendations for weak payload families (idea 53113). */
export function votePayloadFamilyRetirement(families = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.05);
  const rows = (families || []).map(f => {
    const attempts = Number(f.attempts || 0);
    const successes = Number(f.successes || 0);
    const hitRate = f.hitRate !== undefined ? Number(f.hitRate) : rate(successes, attempts);
    return { family: f.family || f.payload || 'family', attempts, successes, hitRate, retire: hitRate < threshold };
  }).sort((a, b) => a.hitRate - b.hitRate);
  const retire = rows.filter(r => r.retire);
  return { rows, count: rows.length, retire, retireCount: retire.length, summary: `Infinity AI recommended retiring ${retire.length} payload famil(ies) below ${threshold} effectiveness.` };
}

/** Generate a baseline checklist when a novel stack appears (idea 53114). */
export function buildNewStackOnboardingChecklist(stack = {}, options = {}) {
  const families = options.families || stack.families || ['injection', 'auth', 'access-control', 'file handling', 'api abuse'];
  const name = stack.stack || stack.name || 'novel stack';
  const checklist = families.map((family, i) => ({ step: i + 1, family, action: `Baseline ${family} payloads against ${name} in a controlled probe run`, done: false }));
  return { stack: name, checklist, stepCount: checklist.length, summary: `Infinity AI generated a ${checklist.length}-step onboarding checklist for ${name}.` };
}

/** Alert when a stable stack starts responding differently (idea 53115). */
export function detectStackDrift(snapshots = [], options = {}) {
  const threshold = Number(options.threshold ?? 0.3);
  const sorted = [...(snapshots || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const rows = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].hitRate ?? sorted[i - 1].rate ?? 0);
    const cur = Number(sorted[i].hitRate ?? sorted[i].rate ?? 0);
    const delta = Math.round((cur - prev) * 100) / 100;
    rows.push({ stack: sorted[i].stack || sorted[i - 1].stack || 'stack', at: sorted[i].at || null, fromRate: prev, toRate: cur, delta, drift: Math.abs(delta) >= threshold });
  }
  const drifts = rows.filter(r => r.drift);
  return { rows, count: rows.length, drifts, driftCount: drifts.length, summary: `Infinity AI detected ${drifts.length} stack drift event(s).` };
}

/** Attach confidence intervals to stack-payload scores (idea 53116). */
export function attachEffectivenessConfidenceIntervals(groups = [], options = {}) {
  const rows = (groups || []).map(g => {
    const attempts = Number(g.attempts || 0);
    const successes = Number(g.successes || 0);
    const hitRate = attempts ? successes / attempts : 0;
    const margin = attempts ? Math.round((1.96 * Math.sqrt((hitRate * (1 - hitRate)) / attempts)) * 100) / 100 : 0;
    return { key: g.key || `${g.payload || g.family || 'payload'} @ ${g.stack || 'stack'}`, attempts, successes, hitRate: Math.round(hitRate * 100) / 100, margin, low: Math.max(0, Math.round((hitRate - margin) * 100) / 100), high: Math.min(1, Math.round((hitRate + margin) * 100) / 100), confidence: attempts >= 30 ? 'data-backed' : 'thin' };
  }).sort((a, b) => b.hitRate - a.hitRate);
  return { rows, count: rows.length, dataBackedCount: rows.filter(r => r.confidence === 'data-backed').length, thinCount: rows.filter(r => r.confidence === 'thin').length, summary: `Infinity AI attached confidence intervals to ${rows.length} stack-payload score(s).` };
}

/** Rank hunt strategies by validated findings per hour (idea 53117). */
export function buildStrategyLeaderboardByFindings(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.strategy || null;
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, findings: 0, hours: 0 };
    g.hunts += 1;
    g.findings += Number(h.validatedFindings ?? h.findings ?? 0);
    g.hours += Number(h.hours || h.durationHours || 0);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, findingsPerHour: g.hours ? Math.round((g.findings / g.hours) * 100) / 100 : 0 })).sort((a, b) => b.findingsPerHour - a.findingsPerHour || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, leader: rows[0] || null, summary: `Infinity AI ranked ${rows.length} hunt strateg(ies) by validated findings per hour.` };
}

/** Track which opening moves find first, fastest (idea 53118). */
export function trackOpeningMoveWinRates(hunts = [], options = {}) {
  const windowMinutes = Number(options.windowMinutes || 60);
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.openingStrategy || h.strategy || null;
    if (!key) continue;
    const g = groups.get(key) || { key, hunts: 0, wins: 0, totalFirstFindingMinutes: 0, timed: 0 };
    const mins = Number(h.firstFindingMinutes ?? h.minutesToFirstFinding ?? NaN);
    g.hunts += 1;
    if (Number.isFinite(mins)) { g.totalFirstFindingMinutes += mins; g.timed += 1; if (mins <= windowMinutes) g.wins += 1; }
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, hunts: g.hunts, wins: g.wins, winRate: rate(g.wins, g.hunts), avgFirstFindingMinutes: g.timed ? Math.round(g.totalFirstFindingMinutes / g.timed) : 0 })).sort((a, b) => b.winRate - a.winRate || a.avgFirstFindingMinutes - b.avgFirstFindingMinutes);
  return { rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI tracked opening move win rates across ${rows.length} strateg(ies).` };
}

/** Show which strategies yield critical versus informational findings (idea 53119). */
export function buildStrategyVsSeverityMatrix(findings = [], options = {}) {
  const groups = new Map();
  for (const f of findings || []) {
    const key = f.strategy || null;
    if (!key) continue;
    const g = groups.get(key) || { key, total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const sev = String(f.severity || 'info').toLowerCase();
    g.total += 1;
    if (sev.startsWith('crit')) g.critical += 1;
    else if (sev.startsWith('high')) g.high += 1;
    else if (sev.startsWith('med')) g.medium += 1;
    else if (sev.startsWith('low')) g.low += 1;
    else g.info += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, criticalRate: rate(g.critical, g.total) })).sort((a, b) => b.criticalRate - a.criticalRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, bestCritical: rows[0] || null, summary: `Infinity AI built a strategy-vs-severity matrix for ${rows.length} strateg(ies).` };
}

/** Record which strategies recover after a slow first hour (idea 53120). */
export function trackComebackStrategy(hunts = [], options = {}) {
  const slow = (hunts || []).filter(h => Number(h.firstHourFindings ?? h.hourOneFindings ?? -1) === 0);
  const groups = new Map();
  for (const h of slow) {
    const key = h.strategy || h.comebackStrategy || null;
    if (!key) continue;
    const recoveredFindings = Number(h.recoveredFindings ?? h.laterFindings ?? h.findings ?? 0);
    const g = groups.get(key) || { key, slowStarts: 0, recovered: 0, recoveredFindings: 0 };
    g.slowStarts += 1;
    g.recoveredFindings += recoveredFindings;
    if (recoveredFindings > 0) g.recovered += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, recoveryRate: rate(g.recovered, g.slowStarts) })).sort((a, b) => b.recoveryRate - a.recoveryRate || b.recoveredFindings - a.recoveredFindings);
  return { rows, count: rows.length, slowStartCount: slow.length, best: rows[0] || null, summary: `Infinity AI tracked comeback strategies across ${slow.length} slow-start hunt(s).` };
}
