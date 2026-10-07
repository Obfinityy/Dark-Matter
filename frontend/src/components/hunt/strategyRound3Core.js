/**
 * strategyRound3Core.js — wave 35, part 1 (ideas 51361–51396): strategy
 * round 3 — pure logic.
 *
 * Live effectiveness scoring, one-click mid-hunt rollback with state intact,
 * strategy annotations, chat/voice strategy commands, color-coded strategy
 * timelines, strategy-tagged reporting, presets marketplace, strategy
 * simulator, focus-area weighting, exclusions, timeboxing, teammate voting,
 * strategy diffs, retest presets, cross-hunt strategy learning, quiet-hours
 * downgrades, cost estimation, approval flows, strategy chaining, performance
 * alerts, personalization, fit explainability, snapshots, migration,
 * fairness, pause points, notification digests, rollback windows, tags,
 * strategy↔finding correlation, report export, mobile picking, guardrail
 * presets, retrospectives, and a mid-hunt recommendation engine.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: time always arrives as an explicit `now`
 * argument (ms epoch), never Date.now(); no Math.random.
 */

export const WAVE35A_START = 51361;
export const WAVE35A_END = 51396;

/** Registry of the 36 strategy-round-3 ideas — completeness is testable. */
export const WAVE35A_IDEAS = [
  [51361, 'strategy effectiveness score', 'Findings-per-hour under each strategy, tracked live'],
  [51362, 'strategy rollback (mid-hunt)', 'One click returns to the previous strategy with hunt state intact'],
  [51363, 'strategy annotations', 'Note why you chose a strategy, for the final report'],
  [51364, 'strategy chat commands', '"Switch to depth mode" works from chat, voice, or buttons'],
  [51365, 'strategy timeline', 'Hunt timeline color-coded by active strategy per segment'],
  [51366, 'strategy-based reporting', 'The final report notes which strategy found each finding'],
  [51367, 'strategy presets marketplace', 'Community-shared strategies you can preview and install'],
  [51368, 'strategy simulator', 'Test strategies against historical hunt data before going live'],
  [51369, 'strategy focus areas', 'Pick 2–3 focus areas; the optimizer weights them'],
  [51370, 'strategy exclusions', 'Rule out techniques or areas under the new strategy explicitly'],
  [51371, 'strategy timeboxing', '"Try depth mode for 45 minutes, then report back"'],
  [51372, 'strategy voting', 'Teammates vote on proposed strategy changes in shared hunts'],
  [51373, 'strategy diff view', 'Exactly what changes in phases, modules, and priorities'],
  [51374, 'strategy presets for retests', '"Retest mode" optimized for verifying fixes'],
  [51375, 'strategy learning', 'The agent remembers which strategies worked on similar targets'],
  [51376, 'strategy quiet hours', 'Aggressive strategies auto-downgrade during business hours'],
  [51377, 'strategy cost estimator', 'Projected requests, time, and spend under the new strategy'],
  [51378, 'strategy approval flow', 'Major strategy changes routed through approval like sensitive actions'],
  [51379, 'strategy chaining', 'Queue "breadth now, depth later, retest at the end" as a sequence'],
  [51380, 'strategy performance alerts', 'Warned when the current strategy underperforms its forecast'],
  [51381, 'strategy personalization', 'Strategies adapt to your historical preferences automatically'],
  [51382, 'strategy explainability', '"Why is depth mode better here?" answered with evidence'],
  [51383, 'strategy snapshots', 'Capture the strategy state alongside report snapshots'],
  [51384, 'strategy migration', 'Apply a working strategy from one hunt to another live hunt'],
  [51385, 'strategy fairness', 'All in-scope assets get minimum coverage under any strategy'],
  [51386, 'strategy pause points', 'Strategy changes only apply at safe phase boundaries if you prefer'],
  [51387, 'strategy notifications digest', 'Batch strategy updates instead of interrupting you'],
  [51388, 'strategy rollback window', 'A grace period after each change to undo with one click'],
  [51389, 'strategy tags', 'Label strategy segments for filtering in analytics later'],
  [51390, 'strategy vs findings correlation', 'Which strategy produced each finding, visualized'],
  [51391, 'strategy export to report', 'The strategy journey included as a report appendix automatically'],
  [51392, 'strategy voice control', 'Switch strategies hands-free with voice commands'],
  [51393, 'strategy mobile control', 'Change strategy from the phone with a simplified picker'],
  [51394, 'strategy guardrail presets', '"Never go aggressive on prod" rules enforced automatically'],
  [51395, 'strategy retrospectives', 'Post-hunt review of strategy decisions and their outcomes'],
  [51396, 'strategy recommendation engine (mid-hunt)', 'ML-driven suggestions based on thousands of past hunts'],
];

/**
 * Strategy shape: { name, focus, allocation: { <phaseId>: weight },
 *   aggression: 'calm' | 'balanced' | 'aggressive' }
 */
export const PHASE_IDS = ['recon', 'surface-map', 'tech-fingerprint', 'auth-deep', 'business-logic', 'exploit-chain'];

/** Color per strategy focus for the color-coded timeline (idea 51365). */
export const STRATEGY_COLORS = {
  balanced: '#fbbf24',
  breadth: '#38bdf8',
  depth: '#a78bfa',
  retest: '#34d399',
  aggressive: '#f87171',
  custom: '#94a3b8',
};

export function strategyColor(focus) {
  return STRATEGY_COLORS[focus] || STRATEGY_COLORS.custom;
}

// --- 51361 effectiveness score -----------------------------------------------

/**
 * event: { strategy, at, findingId }. Record a strategy-scoped finding event.
 */
export function recordStrategyEvent(events, strategyName, findingId, now) {
  return [...events, { strategy: strategyName, at: now, findingId }];
}

/** Findings-per-hour for one strategy inside a trailing window. */
export function findingsPerHour(events, strategyName, windowMs, now) {
  const cutoff = now - windowMs;
  const hits = events.filter((e) => e.strategy === strategyName && e.at >= cutoff);
  const hours = Math.max(windowMs / 3_600_000, 1 / 60);
  return hits.length / hours;
}

/** Live per-strategy effectiveness table, best first. */
export function liveEffectivenessScores(events, now, windowMs = 3_600_000) {
  const names = [...new Set(events.map((e) => e.strategy))];
  return names
    .map((strategy) => ({
      strategy,
      findingsPerHour: findingsPerHour(events, strategy, windowMs, now),
      findings: events.filter((e) => e.strategy === strategy && e.at >= now - windowMs).length,
    }))
    .sort((a, b) => b.findingsPerHour - a.findingsPerHour);
}

// --- 51362 one-click rollback (mid-hunt), state intact ------------------------

/**
 * Stack entry: { strategy, stateSnapshot, at, label }. Distinct from wave-34
 * versioning: the hunt-state snapshot rides along so rollback restores
 * strategy *and* where the hunt was.
 */
export function pushStrategyState(stack, strategy, stateSnapshot, now, label = '') {
  return [...stack, { strategy, stateSnapshot, at: now, label }];
}

export function rollbackOneClick(stack) {
  if (stack.length < 2) return { entry: null, rest: stack };
  const rest = stack.slice(0, -1);
  return { entry: rest[rest.length - 1], rest };
}

// --- 51363 annotations ---------------------------------------------------------

export function annotateStrategy(annotations, strategyName, text, now) {
  return [...annotations, { strategy: strategyName, text, at: now }];
}

export function annotationsFor(annotations, strategyName) {
  return annotations.filter((a) => a.strategy === strategyName);
}

// --- 51364 chat commands -------------------------------------------------------

/**
 * Parse free-text chat commands into strategy actions.
 * "switch to depth mode" → { action: 'switch', target: 'depth' }
 * "try breadth for 30 minutes" → { action: 'timebox', target: 'breadth', minutes: 30 }
 */
export function parseStrategyChatCommand(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  const target = /depth/.test(t) ? 'depth'
    : /breadth/.test(t) ? 'breadth'
    : /retest/.test(t) ? 'retest'
    : /balanced/.test(t) ? 'balanced'
    : /aggressive/.test(t) ? 'aggressive'
    : null;
  const minutesMatch = t.match(/for\s+(\d+)\s*(min|minutes?)/) || t.match(/timebox[^0-9]*(\d+)/);
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : null;
  if (/rollback|previous strategy|go back/.test(t)) return { action: 'rollback' };
  if (/hold|pause strategy|freeze/.test(t)) return { action: 'hold' };
  if (minutes && target) return { action: 'timebox', target, minutes };
  if (/switch|change|use|go (to )?/.test(t) && target) return { action: 'switch', target };
  return null;
}

// --- 51365 strategy timeline ----------------------------------------------------

export function segmentStrategyTimeline(segments) {
  return segments.map((s) => ({
    ...s,
    color: strategyColor(s.focus || 'custom'),
    durationMin: Math.max(0, Math.round((s.to - s.from) / 60_000)),
  }));
}

// --- 51366 strategy-based reporting ----------------------------------------------

/** attribution: { [findingId]: strategyName }. */
export function attributeFinding(attribution, findingId, strategyName) {
  return { ...attribution, [findingId]: strategyName };
}

export function strategyReportLines(findings, attribution) {
  return findings.map((f) => {
    const s = attribution[f.id];
    return s
      ? `${f.id} (${f.severity || 'unknown'}) — found under "${s}" strategy`
      : `${f.id} (${f.severity || 'unknown'}) — strategy not recorded`;
  });
}

// --- 51367 presets marketplace ----------------------------------------------------

export const MARKETPLACE_PRESETS = [
  { id: 'api-first-blitz', name: 'API-first blitz', author: 'huntfox', downloads: 1240, rating: 4.6, tags: ['api', 'saas'], focus: 'depth', allocation: { recon: 10, 'surface-map': 15, 'tech-fingerprint': 20, 'auth-deep': 15, 'business-logic': 30, 'exploit-chain': 10 }, description: 'Deep on API surface and business logic for SaaS targets.' },
  { id: 'auth-hammer', name: 'Auth hammer', author: 'nullbyte', downloads: 860, rating: 4.8, tags: ['auth'], focus: 'depth', allocation: { recon: 10, 'surface-map': 10, 'tech-fingerprint': 10, 'auth-deep': 45, 'business-logic': 15, 'exploit-chain': 10 }, description: 'All weight on auth: sessions, JWTs, IDOR, privilege paths.' },
  { id: 'wide-net', name: 'Wide net', author: 'reconowl', downloads: 2100, rating: 4.4, tags: ['recon'], focus: 'breadth', allocation: { recon: 30, 'surface-map': 30, 'tech-fingerprint': 20, 'auth-deep': 5, 'business-logic': 10, 'exploit-chain': 5 }, description: 'Maximum coverage for new targets before going deep.' },
  { id: 'retest-sweep', name: 'Retest sweep', author: 'verifylabs', downloads: 540, rating: 4.7, tags: ['retest'], focus: 'retest', allocation: { recon: 5, 'surface-map': 10, 'tech-fingerprint': 5, 'auth-deep': 20, 'business-logic': 40, 'exploit-chain': 20 }, description: 'Verifies fixes and hunts regressions, no new recon.' },
];

export function previewMarketplacePreset(id) {
  return MARKETPLACE_PRESETS.find((p) => p.id === id) || null;
}

export function installMarketplacePreset(installedIds, id) {
  if (!previewMarketplacePreset(id)) return { ok: false, installed: installedIds, reason: 'unknown preset' };
  if (installedIds.includes(id)) return { ok: false, installed: installedIds, reason: 'already installed' };
  return { ok: true, installed: [...installedIds, id], reason: '' };
}

// --- 51368 simulator --------------------------------------------------------------

/**
 * history: [{ strategyFocus, findings, hours, scopeAssets }].
 * Projects what a proposed strategy would yield based on past hunts with the
 * same focus; falls back to the global average.
 */
export function simulateStrategy(history, proposedFocus, estHours) {
  const same = history.filter((h) => h.strategyFocus === proposedFocus && h.hours > 0);
  const pool = same.length > 0 ? same : history.filter((h) => h.hours > 0);
  if (pool.length === 0) return { projectedFindings: 0, basis: 'no history', confidence: 'low' };
  const fph = pool.reduce((s, h) => s + h.findings / h.hours, 0) / pool.length;
  return {
    projectedFindings: Math.round(fph * estHours * 10) / 10,
    findingsPerHour: Math.round(fph * 100) / 100,
    basis: same.length > 0 ? `${same.length} similar hunt(s)` : 'global average',
    confidence: same.length >= 3 ? 'high' : same.length >= 1 ? 'medium' : 'low',
  };
}

// --- 51369 focus areas --------------------------------------------------------------

export const FOCUS_AREAS = ['auth', 'api', 'business-logic', 'input-handling', 'infra'];

const FOCUS_PHASE_MAP = {
  auth: ['auth-deep'],
  api: ['surface-map', 'business-logic'],
  'business-logic': ['business-logic', 'exploit-chain'],
  'input-handling': ['tech-fingerprint', 'business-logic'],
  infra: ['recon', 'surface-map'],
};

export function applyFocusAreas(strategy, focusAreas) {
  const picked = focusAreas.filter((a) => FOCUS_AREAS.includes(a)).slice(0, 3);
  if (picked.length === 0) return strategy;
  const boost = {};
  for (const area of picked) {
    for (const phase of FOCUS_PHASE_MAP[area]) boost[phase] = (boost[phase] || 0) + 25;
  }
  const allocation = {};
  for (const [phase, weight] of Object.entries(strategy.allocation || {})) {
    allocation[phase] = weight + (boost[phase] || 0);
  }
  const total = Object.values(allocation).reduce((s, v) => s + v, 0) || 1;
  const normalized = {};
  for (const [k, v] of Object.entries(allocation)) normalized[k] = Math.round((v / total) * 100);
  const drift = 100 - Object.values(normalized).reduce((s, v) => s + v, 0);
  const first = Object.keys(normalized)[0];
  if (first && drift !== 0) normalized[first] += drift;
  return { ...strategy, allocation: normalized, focusAreas: picked };
}

// --- 51370 exclusions ------------------------------------------------------------------

export function excludeFromStrategy(strategy, exclusions) {
  const current = Array.isArray(strategy.exclusions) ? strategy.exclusions : [];
  const merged = [...new Set([...current, ...exclusions])];
  const remainingPhases = PHASE_IDS.filter((p) => !merged.includes(p));
  return {
    strategy: { ...strategy, exclusions: merged },
    phasesRemaining: remainingPhases,
    warning: remainingPhases.length < 2 ? 'exclusions would leave fewer than 2 phases' : '',
  };
}

// --- 51371 timeboxing --------------------------------------------------------------------

export function startTimebox(strategyName, minutes, now) {
  return { strategyName, minutes, startedAt: now, endsAt: now + minutes * 60_000, status: 'active' };
}

export function timeboxRemainingMs(timebox, now) {
  return Math.max(0, timebox.endsAt - now);
}

export function timeboxExpired(timebox, now) {
  return now >= timebox.endsAt;
}

// --- 51372 voting -------------------------------------------------------------------------

export function startStrategyVote(proposal, voters, now) {
  return { id: `vote-${now}`, proposal, voters: [...voters], votes: {}, status: 'open', startedAt: now };
}

export function castStrategyVote(vote, voter, choice) {
  if (vote.status !== 'open' || !vote.voters.includes(voter)) return vote;
  if (choice !== 'approve' && choice !== 'reject') return vote;
  return { ...vote, votes: { ...vote.votes, [voter]: choice } };
}

export function strategyVoteTally(vote) {
  const approve = Object.values(vote.votes).filter((v) => v === 'approve').length;
  const reject = Object.values(vote.votes).filter((v) => v === 'reject').length;
  const quorum = Math.ceil(vote.voters.length / 2);
  if (approve + reject < quorum) return { approve, reject, result: 'open' };
  return { approve, reject, result: approve > reject ? 'approved' : 'rejected' };
}

// --- 51373 diff view ------------------------------------------------------------------------

export function diffStrategy(current, proposed) {
  const phasesAdded = Object.keys(proposed.allocation || {}).filter((p) => !(p in (current.allocation || {})));
  const phasesRemoved = Object.keys(current.allocation || {}).filter((p) => !(p in (proposed.allocation || {})));
  const weightChanges = [];
  for (const p of Object.keys(current.allocation || {})) {
    const from = current.allocation[p];
    const to = (proposed.allocation || {})[p];
    if (to !== undefined && to !== from) weightChanges.push({ phase: p, from, to, delta: to - from });
  }
  const rank = (alloc) => Object.entries(alloc || {}).sort((a, b) => b[1] - a[1]).map(([p]) => p);
  const priorityChanges = rank(proposed.allocation).join(',') !== rank(current.allocation).join(',')
    ? { from: rank(current.allocation).slice(0, 3), to: rank(proposed.allocation).slice(0, 3) }
    : null;
  return { phasesAdded, phasesRemoved, weightChanges, priorityChanges };
}

// --- 51374 retest presets ---------------------------------------------------------------------

export function retestModePreset() {
  return {
    name: 'Retest mode',
    focus: 'retest',
    aggression: 'balanced',
    allocation: { recon: 5, 'surface-map': 10, 'tech-fingerprint': 5, 'auth-deep': 20, 'business-logic': 40, 'exploit-chain': 20 },
    rules: ['verify-fixes-first', 'regression-sweep', 'no-new-recon', 'fixed-findings-only-scope'],
  };
}

// --- 51375 learning -----------------------------------------------------------------------------

export function learnStrategies(pastHunts, targetType) {
  const similar = pastHunts.filter((h) => h.targetType === targetType && h.hours > 0);
  const byStrategy = {};
  for (const h of similar) {
    if (!byStrategy[h.strategy]) byStrategy[h.strategy] = { findings: 0, hours: 0, hunts: 0 };
    byStrategy[h.strategy].findings += h.findings;
    byStrategy[h.strategy].hours += h.hours;
    byStrategy[h.strategy].hunts += 1;
  }
  return Object.entries(byStrategy)
    .map(([strategy, s]) => ({
      strategy,
      hunts: s.hunts,
      findingsPerHour: Math.round((s.findings / s.hours) * 100) / 100,
    }))
    .sort((a, b) => b.findingsPerHour - a.findingsPerHour);
}

// --- 51376 quiet hours -----------------------------------------------------------------------------

export const BUSINESS_HOURS = { start: 9, end: 18 };

export function isBusinessHour(now) {
  const h = new Date(now).getHours();
  return h >= BUSINESS_HOURS.start && h < BUSINESS_HOURS.end;
}

export function quietHoursDowngrade(strategy, now) {
  if (strategy.aggression !== 'aggressive' || !isBusinessHour(now)) {
    return { downgraded: false, strategy, reason: '' };
  }
  const downgraded = { ...strategy, aggression: 'balanced', name: `${strategy.name} (quiet-hours)` };
  return { downgraded: true, strategy: downgraded, reason: 'aggressive strategy auto-downgraded during business hours' };
}

// --- 51377 cost estimator -----------------------------------------------------------------------------

const PHASE_RATES = {
  recon: { requestsPerHour: 900, spendPerHour: 0.4 },
  'surface-map': { requestsPerHour: 1400, spendPerHour: 0.6 },
  'tech-fingerprint': { requestsPerHour: 500, spendPerHour: 0.3 },
  'auth-deep': { requestsPerHour: 300, spendPerHour: 1.2 },
  'business-logic': { requestsPerHour: 250, spendPerHour: 1.5 },
  'exploit-chain': { requestsPerHour: 120, spendPerHour: 2.0 },
};

export function estimateStrategyCost(strategy, estHours) {
  const allocation = strategy.allocation || {};
  let requests = 0;
  let spend = 0;
  for (const [phase, weight] of Object.entries(allocation)) {
    const rate = PHASE_RATES[phase] || { requestsPerHour: 200, spendPerHour: 0.5 };
    requests += rate.requestsPerHour * estHours * (weight / 100);
    spend += rate.spendPerHour * estHours * (weight / 100);
  }
  return {
    requests: Math.round(requests),
    estHours,
    estSpend: Math.round(spend * 100) / 100,
  };
}

// --- 51378 approval flow --------------------------------------------------------------------------------

export function requestStrategyApproval(change, requestedBy, now) {
  return { id: `sra-${now}`, change, requestedBy, status: 'pending', at: now, decidedAt: null, decidedBy: null };
}

export function decideStrategyApproval(request, approved, decidedBy, now) {
  if (request.status !== 'pending') return request;
  return { ...request, status: approved ? 'approved' : 'denied', decidedBy, decidedAt: now };
}

export function pendingStrategyApprovals(requests) {
  return requests.filter((r) => r.status === 'pending');
}

// --- 51379 chaining ----------------------------------------------------------------------------------------

export function chainStrategies(names) {
  return { queue: [...names], current: 0, status: names.length > 0 ? 'running' : 'empty' };
}

export function advanceStrategyChain(chain) {
  if (chain.status !== 'running') return { next: null, chain, done: true };
  const next = chain.queue[chain.current] ?? null;
  const current = chain.current + 1;
  const done = current >= chain.queue.length;
  return { next, chain: { ...chain, current, status: done ? 'done' : 'running' }, done };
}

// --- 51380 performance alerts ---------------------------------------------------------------------------------

export function checkStrategyPerformance(forecastFph, actualFph, thresholdRatio = 0.6) {
  if (forecastFph <= 0) return null;
  if (actualFph >= forecastFph * thresholdRatio) return null;
  return {
    alert: true,
    message: `Strategy underperforming: ${actualFph.toFixed(2)} findings/hr vs ${forecastFph.toFixed(2)} forecast`,
    shortfallPct: Math.round((1 - actualFph / forecastFph) * 100),
  };
}

// --- 51381 personalization ---------------------------------------------------------------------------------------

export function personalizeStrategy(base, prefs) {
  const allocation = { ...(base.allocation || {}) };
  for (const phase of prefs.preferredPhases || []) {
    if (phase in allocation) allocation[phase] += 10;
  }
  for (const phase of prefs.avoidPhases || []) {
    if (phase in allocation) allocation[phase] = Math.max(0, allocation[phase] - 15);
  }
  if (typeof prefs.defaultDepth === 'number') {
    const depthPhases = ['auth-deep', 'business-logic', 'exploit-chain'];
    const breadthPhases = ['recon', 'surface-map', 'tech-fingerprint'];
    const shift = (prefs.defaultDepth - 50) / 50; // -1..1
    for (const p of depthPhases) if (p in allocation) allocation[p] = Math.max(0, allocation[p] + shift * 8);
    for (const p of breadthPhases) if (p in allocation) allocation[p] = Math.max(0, allocation[p] - shift * 8);
  }
  const total = Object.values(allocation).reduce((s, v) => s + v, 0) || 1;
  const normalized = {};
  for (const [k, v] of Object.entries(allocation)) normalized[k] = Math.max(0, Math.round((v / total) * 100));
  return { ...base, allocation: normalized, personalized: true };
}

// --- 51382 explainability (why this strategy?) --------------------------------------------------------------------

export function explainStrategyFit(strategy, evidence) {
  const lines = evidence.map((e) => `• ${e.fact} (${e.supports})`);
  return {
    headline: `"${strategy.name}" fits here because:`,
    evidence: lines,
    summary: lines.length > 0
      ? `Based on ${evidence.length} live signals, "${strategy.name}" is the best fit right now.`
      : `No live signals yet — "${strategy.name}" is the default choice.`,
  };
}

// --- 51383 snapshots -------------------------------------------------------------------------------------------------

export function snapshotStrategy(strategy, reportId, now) {
  return {
    strategyName: strategy.name,
    focus: strategy.focus,
    allocation: { ...(strategy.allocation || {}) },
    reportId,
    at: now,
  };
}

// --- 51384 migration ----------------------------------------------------------------------------------------------------

export function migrateStrategy(strategy, fromHunt, toHunt) {
  if (!toHunt || !Array.isArray(toHunt.assets) || toHunt.assets.length === 0) {
    return { ok: false, reason: 'target hunt has no in-scope assets' };
  }
  if (fromHunt.status === 'archived') {
    return { ok: false, reason: 'source strategy comes from an archived hunt' };
  }
  return {
    ok: true,
    record: {
      strategy: strategy.name,
      fromHunt: fromHunt.id,
      toHunt: toHunt.id,
      assets: toHunt.assets.length,
      appliedPhases: Object.keys(strategy.allocation || {}),
    },
    reason: '',
  };
}

// --- 51385 fairness ---------------------------------------------------------------------------------------------------------

export function ensureFairCoverage(allocation, assets, minPercent = 10) {
  if (!assets || assets.length === 0) return { allocation, adjusted: false };
  const out = {};
  let taken = 0;
  const min = Math.min(minPercent, Math.floor(100 / assets.length));
  for (const asset of assets) {
    const current = allocation[asset] || 0;
    out[asset] = Math.max(current, min);
    taken += out[asset];
  }
  if (taken > 100) {
    const scale = 100 / taken;
    for (const asset of assets) out[asset] = Math.floor(out[asset] * scale);
    out[assets[0]] += 100 - Object.values(out).reduce((s, v) => s + v, 0);
  }
  const adjusted = JSON.stringify(out) !== JSON.stringify(allocation);
  return { allocation: out, adjusted };
}

// --- 51386 pause points --------------------------------------------------------------------------------------------------------

export const APPLY_ANYTIME_PHASES = ['recon', 'surface-map'];

export function strategyChangeTiming(currentPhase) {
  return APPLY_ANYTIME_PHASES.includes(currentPhase) ? 'apply-now' : 'wait-for-boundary';
}

// --- 51387 notifications digest --------------------------------------------------------------------------------------------------

export function digestStrategyUpdates(updates, now) {
  const windowMs = 15 * 60_000;
  const recent = updates.filter((u) => now - u.at <= windowMs);
  return {
    count: recent.length,
    window: '15m',
    items: recent,
    summary: recent.length === 0
      ? 'No strategy updates in the last 15 minutes.'
      : `${recent.length} strategy update(s) in the last 15 minutes: ${recent.map((u) => u.kind).join(', ')}`,
  };
}

// --- 51388 rollback window -------------------------------------------------------------------------------------------------------

export const ROLLBACK_WINDOW_MS = 15 * 60_000;

export function rollbackWindowOpen(change, now, windowMs = ROLLBACK_WINDOW_MS) {
  return now - change.at <= windowMs;
}

export function undoStrategyChange(change, now) {
  if (!rollbackWindowOpen(change, now)) return { ok: false, reason: 'rollback window expired' };
  return { ok: true, restored: change.previous, reason: '' };
}

// --- 51389 tags --------------------------------------------------------------------------------------------------------------------

export function tagStrategySegment(tags, segmentId, tag) {
  const current = tags[segmentId] || [];
  if (current.includes(tag)) return tags;
  return { ...tags, [segmentId]: [...current, tag] };
}

export function strategySegmentsByTag(tags, tag) {
  return Object.entries(tags)
    .filter(([, list]) => list.includes(tag))
    .map(([segmentId]) => segmentId);
}

// --- 51390 correlation -----------------------------------------------------------------------------------------------------------------

export function correlateStrategyFindings(findings, attribution) {
  const byStrategy = {};
  for (const f of findings) {
    const s = attribution[f.id] || 'unrecorded';
    if (!byStrategy[s]) byStrategy[s] = [];
    byStrategy[s].push(f.id);
  }
  const counts = Object.entries(byStrategy).map(([strategy, ids]) => ({ strategy, count: ids.length }));
  counts.sort((a, b) => b.count - a.count);
  return { byStrategy, counts, top: counts[0] || null };
}

// --- 51391 export to report --------------------------------------------------------------------------------------------------------------

export function exportStrategyJourney(segments, annotations) {
  const lines = ['# Strategy journey', ''];
  for (const s of segments) {
    lines.push(`## ${s.strategy} (${s.durationMin ?? '?'} min)`);
    const notes = (annotations || []).filter((a) => a.strategy === s.strategy);
    for (const n of notes) lines.push(`- ${n.text}`);
    lines.push('');
  }
  return lines.join('\n');
}

// --- 51392 voice control --------------------------------------------------------------------------------------------------------------------

export const VOICE_STRATEGY_PHRASES = [
  'switch to depth mode',
  'switch to breadth mode',
  'go aggressive',
  'calm down',
  'start retest mode',
  'roll back the strategy',
  'use api first',
];

export function parseVoiceStrategyCommand(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (/roll\s?back|previous/.test(t)) return { action: 'rollback', target: null };
  if (/depth/.test(t)) return { action: 'switch', target: 'depth' };
  if (/breadth/.test(t)) return { action: 'switch', target: 'breadth' };
  if (/retest/.test(t)) return { action: 'switch', target: 'retest' };
  if (/aggressive/.test(t)) return { action: 'switch', target: 'aggressive' };
  if (/calm/.test(t)) return { action: 'switch', target: 'calm' };
  if (/api.first/.test(t)) return { action: 'preset', target: 'api-first-blitz' };
  return null;
}

// --- 51393 mobile control ---------------------------------------------------------------------------------------------------------------------

export function mobileStrategyPicker(strategies) {
  return strategies.map((s) => ({
    name: s.name,
    oneLine: `${s.focus} · ${Object.keys(s.allocation || {}).length} phases`,
    tapAction: `apply:${s.name}`,
  }));
}

// --- 51394 guardrail presets -------------------------------------------------------------------------------------------------------------------

export const GUARDRAIL_PRESETS = {
  'never-aggressive-on-prod': {
    label: 'Never go aggressive on prod',
    rules: ['forbid aggression=aggressive when hunt.env === "prod"'],
  },
  'budget-capped': {
    label: 'Stay inside the cost budget',
    rules: ['estSpend must be ≤ hunt.budget'],
  },
  'no-scope-expansion': {
    label: 'No scope expansion',
    rules: ['strategy must not add assets outside hunt.scope'],
  },
};

export function enforceGuardrailPreset(strategy, presetId, hunt) {
  const preset = GUARDRAIL_PRESETS[presetId];
  if (!preset) return { ok: false, violations: ['unknown guardrail preset'] };
  const violations = [];
  if (presetId === 'never-aggressive-on-prod' && hunt.env === 'prod' && strategy.aggression === 'aggressive') {
    violations.push('aggressive strategy blocked on prod');
  }
  if (presetId === 'budget-capped' && typeof hunt.budget === 'number') {
    const cost = estimateStrategyCost(strategy, hunt.estHours || 4);
    if (cost.estSpend > hunt.budget) violations.push(`projected spend ${cost.estSpend} exceeds budget ${hunt.budget}`);
  }
  if (presetId === 'no-scope-expansion' && Array.isArray(strategy.extraAssets) && strategy.extraAssets.length > 0) {
    violations.push('strategy adds assets outside scope');
  }
  return { ok: violations.length === 0, violations };
}

// --- 51395 retrospectives ----------------------------------------------------------------------------------------------------------------------------

export function buildRetrospective(decisions, outcomes) {
  const lessons = decisions.map((d) => {
    const o = outcomes.find((x) => x.strategy === d.strategy);
    if (!o) return `"${d.strategy}" — outcome unknown; keep tracking.`;
    const hit = o.findingsPerHour >= (d.forecastFph || 0);
    return `"${d.strategy}" ${hit ? 'beat' : 'missed'} its forecast (${o.findingsPerHour.toFixed(2)} vs ${String(d.forecastFph ?? '?')} findings/hr) — ${hit ? 'use again on similar targets.' : 'reconsider next time.'}`;
  });
  const scored = outcomes.filter((o) => o.findingsPerHour > 0).length;
  return {
    decisions,
    outcomes,
    lessons,
    grade: outcomes.length === 0 ? 'n/a' : scored / outcomes.length >= 0.75 ? 'strong' : scored / outcomes.length >= 0.4 ? 'mixed' : 'weak',
  };
}

// --- 51396 recommendation engine --------------------------------------------------------------------------------------------------------------------------

export function recommendStrategies(pastHunts, liveState) {
  const scored = pastHunts
    .filter((h) => h.hours > 0)
    .map((h) => {
      const fph = h.findings / h.hours;
      const typeMatch = h.targetType === liveState.targetType ? 0.3 : 0;
      const recent = Math.max(0, 0.1 - (liveState.now - h.endedAt) / (30 * 24 * 3_600_000) * 0.1);
      return { strategy: h.strategy, score: Math.round((0.6 * fph + typeMatch + recent) * 100) / 100, findingsPerHour: Math.round(fph * 100) / 100, basis: `${h.targetType} target` };
    })
    .sort((a, b) => b.score - a.score);
  const top = [];
  for (const s of scored) {
    if (!top.some((t) => t.strategy === s.strategy)) top.push(s);
    if (top.length === 3) break;
  }
  return top.map((t) => ({ ...t, reason: `scored ${t.score} from ${t.basis} (${t.findingsPerHour} findings/hr)` }));
}
