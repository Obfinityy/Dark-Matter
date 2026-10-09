/**
 * wave89BCores.js — Infinity AI · Wave 89B
 * Failure forensics operations, ideas 53541–53560: failure cascade
 * detection, benign-failure filtering, failure root-cause confidence,
 * payload failure benchmarks, failure-driven target profiling, adaptive
 * failure budgets, failure lesson auto-drafting, payload failure
 * timelines, failure mode shift detection, cross-defense failure
 * comparison, failure-informed payload design, payload failure insurance
 * metrics, failure review rituals, failure data retention tiers, payload
 * failure prediction, failure-aware scheduling, failure pattern search,
 * failure-driven WAF identification, payload failure cost-benefit, and
 * failure autopsy leaderboards.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE89_B_IDEAS = [
  { id: 53541, title: 'Failure Cascade Detection', skip: false },
  { id: 53542, title: 'Benign-Failure Filtering', skip: false },
  { id: 53543, title: 'Failure Root-Cause Confidence', skip: false },
  { id: 53544, title: 'Payload Failure Benchmarks', skip: false },
  { id: 53545, title: 'Failure-Driven Target Profiling', skip: false },
  { id: 53546, title: 'Adaptive Failure Budgets', skip: false },
  { id: 53547, title: 'Failure Lesson Auto-Drafting', skip: false },
  { id: 53548, title: 'Payload Failure Timelines', skip: false },
  { id: 53549, title: 'Failure Mode Shift Detection', skip: false },
  { id: 53550, title: 'Cross-Defense Failure Comparison', skip: false },
  { id: 53551, title: 'Failure-Informed Payload Design', skip: false },
  { id: 53552, title: 'Payload Failure Insurance Metrics', skip: false },
  { id: 53553, title: 'Failure Review Rituals', skip: false },
  { id: 53554, title: 'Failure Data Retention Tiers', skip: false },
  { id: 53555, title: 'Payload Failure Prediction', skip: false },
  { id: 53556, title: 'Failure-Aware Scheduling', skip: false },
  { id: 53557, title: 'Failure Pattern Search', skip: false },
  { id: 53558, title: 'Failure-Driven WAF Identification', skip: false },
  { id: 53559, title: 'Payload Failure Cost-Benefit', skip: false },
  { id: 53560, title: 'Failure Autopsy Leaderboards', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.id||it.articleId||it.payloadId||it.title||it.name||fb);}

/** Idea 53541 — Failure Cascade Detection. */
export function detectFailureCascades(events = []) {
  const list = Array.isArray(events) ? events : [];
  const groups = new Map();
  for (const e of list) {
    const groupKey = String(e.changeId || `${String(e.target || 'target')}|${String(e.defense || 'defense')}`);
    const g = groups.get(groupKey) || { key: groupKey, defense: String(e.defense || 'unknown'), target: String(e.target || 'target'), families: new Set(), failures: 0 };
    g.families.add(String(e.family || e.payloadFamily || 'generic'));
    g.failures += 1;
    groups.set(groupKey, g);
  }
  const totalFamilies = new Set(list.map(e => String(e.family || e.payloadFamily || 'generic'))).size;
  const rows = [...groups.values()].map(g => {
    const families = [...g.families].sort();
    return { key: g.key, defense: g.defense, target: g.target, families, familyCount: families.length, failures: g.failures, cascade: families.length >= 2, spreadRate: rate(families.length, totalFamilies) };
  }).sort((a, b) => b.familyCount - a.familyCount || b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, cascadeCount: rows.filter(r => r.cascade).length, totalFamilies, top: rows[0] || null, summary: `Infinity AI detected ${rows.filter(r => r.cascade).length} failure cascade(s) where one defense change spread across payload families.` };
}
/** Idea 53542 — Benign-Failure Filtering. */
export function filterBenignFailures(failures = []) {
  const benignTerms = ['setup', 'malformed', 'bad target', 'invalid', 'missing', 'typo', 'misconfigured'];
  const rows = (Array.isArray(failures) ? failures : []).map(f => {
    const reasonText = String(f.reason || f.failureClass || f.cause || '').toLowerCase();
    const benign = f.benign === true || f.setupError === true || String(f.failureClass || '').toLowerCase() === 'benign' || benignTerms.some(t => reasonText.includes(t));
    return { key: keyOf(f, 'failure'), payload: String(f.payload || f.payloadId || ''), reason: String(f.reason || f.failureClass || ''), verdict: benign ? 'benign' : 'defense', benign };
  }).sort((a, b) => Number(b.benign) - Number(a.benign) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, benignCount: rows.filter(r => r.benign).length, defenseCount: rows.filter(r => !r.benign).length, benignRate: rate(rows.filter(r => r.benign).length, rows.length), top: rows[0] || null, summary: `Infinity AI separated ${rows.filter(r => r.benign).length} benign setup failure(s) from ${rows.filter(r => !r.benign).length} real defense failure(s).` };
}
/** Idea 53543 — Failure Root-Cause Confidence. */
export function scoreRootCauseConfidence(failures = []) {
  const rows = (Array.isArray(failures) ? failures : []).map(f => {
    const evidence = num(f.evidenceCount ?? f.evidence, 0);
    const consistent = num(f.consistentSignals, 0);
    const totalSignals = num(f.totalSignals, 0);
    const consistency = totalSignals ? clamp01(consistent / totalSignals) : clamp01(f.consistency ?? 0.5);
    const confidence = clamp01(round2(0.3 + 0.15 * Math.min(evidence, 3) + 0.25 * consistency));
    const grade = confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    return { key: keyOf(f, 'failure'), classification: String(f.classification || f.failureClass || 'unknown'), evidenceCount: evidence, consistency: round2(consistency), confidence, grade };
  }).sort((a, b) => b.confidence - a.confidence || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, highCount: rows.filter(r => r.grade === 'high').length, averageConfidence: mean(rows.map(r => r.confidence)), top: rows[0] || null, summary: `Infinity AI scored root-cause confidence for ${rows.length} failure classification(s) (average ${mean(rows.map(r => r.confidence))}).` };
}
/** Idea 53544 — Payload Failure Benchmarks. */
export function benchmarkPayloadFailures(families = []) {
  const base = (Array.isArray(families) ? families : []).map(f => {
    const attempts = num(f.attempts, 0);
    const fails = num(f.failures ?? f.failed, 0);
    return { key: String(f.family || f.key || f.name || 'family'), family: String(f.family || f.name || 'family'), attempts, failures: fails, failureRate: rate(fails, attempts), blocked: num(f.blocked, 0), patched: num(f.patched, 0) };
  });
  const avg = mean(base.map(r => r.failureRate));
  const rows = base.map(r => ({ ...r, deltaFromMean: round2(r.failureRate - avg), benchmark: r.failureRate > avg ? 'above-average-failure' : r.failureRate < avg ? 'below-average-failure' : 'at-average' }))
    .sort((a, b) => b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, meanFailureRate: avg, top: rows[0] || null, summary: `Infinity AI benchmarked payload failure profiles across ${rows.length} family record(s) against a mean failure rate of ${avg}.` };
}
/** Idea 53545 — Failure-Driven Target Profiling. */
export function profileTargetFromFailures(failures = []) {
  const groups = new Map();
  for (const f of Array.isArray(failures) ? failures : []) {
    const target = String(f.target || 'target');
    const g = groups.get(target) || { key: target, target, failures: 0, blocked: 0, signatures: new Set(), declaredWaf: false };
    g.failures += 1;
    if (num(f.status, 0) === 403 || f.blocked === true) g.blocked += 1;
    if (f.signature) g.signatures.add(String(f.signature));
    if (f.declaredWaf === true || f.declaredDefense) g.declaredWaf = true;
    groups.set(target, g);
  }
  const rows = [...groups.values()].map(g => {
    const blockedRate = rate(g.blocked, g.failures);
    const shadowWaf = blockedRate >= 0.5 && !g.declaredWaf;
    const inferred = [];
    if (shadowWaf) inferred.push('shadow-waf');
    if (g.signatures.size >= 3) inferred.push('layered-filtering');
    if (blockedRate >= 0.8) inferred.push('strict-rate-limiting');
    return { key: g.key, target: g.target, failures: g.failures, blockedRate, declaredWaf: g.declaredWaf, shadowWaf, inferredDefenses: inferred, signatureCount: g.signatures.size };
  }).sort((a, b) => b.blockedRate - a.blockedRate || b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, shadowWafCount: rows.filter(r => r.shadowWaf).length, top: rows[0] || null, summary: `Infinity AI inferred undisclosed defenses on ${rows.filter(r => r.shadowWaf).length} target(s) from failure patterns alone.` };
}
/** Idea 53546 — Adaptive Failure Budgets. */
export function adaptiveFailureBudgets(families = [], options = {}) {
  const totalBudget = num(options.totalBudget, 100);
  const base = (Array.isArray(families) ? families : []).map(f => {
    const failureRate = clamp01(f.failureRate ?? rate(num(f.failures, 0), num(f.attempts, 0)));
    const value = num(f.value ?? f.priority, 1);
    const weight = round2(value * (1 - failureRate * 0.5));
    return { key: String(f.family || f.key || f.name || 'family'), family: String(f.family || f.name || 'family'), failureRate, value, weight };
  });
  const totalWeight = base.reduce((s, r) => s + r.weight, 0);
  const rows = base.map(r => {
    const share = totalWeight ? round2(r.weight / totalWeight) : 0;
    return { ...r, budgetShare: share, budget: round2(totalBudget * share) };
  }).sort((a, b) => b.budget - a.budget || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalBudget, totalAllocated: round2(rows.reduce((s, r) => s + r.budget, 0)), top: rows[0] || null, summary: `Infinity AI allocated an adaptive failure budget of ${totalBudget} across ${rows.length} payload family record(s).` };
}
/** Idea 53547 — Failure Lesson Auto-Drafting. */
export function draftFailureLessons(failures = []) {
  const groups = new Map();
  for (const f of Array.isArray(failures) ? failures : []) {
    const klass = String(f.failureClass || f.defense || f.stoppedBy || 'unknown');
    const g = groups.get(klass) || { key: klass, failureClass: klass, failures: 0, payloads: new Set() };
    g.failures += 1;
    g.payloads.add(String(f.payload || f.payloadId || keyOf(f, 'payload')));
    groups.set(klass, g);
  }
  const actions = { waf: 'Encode and split blocked tokens before retry.', blocked: 'Rotate delivery vector and reduce request burst.', patched: 'Target sibling endpoints instead of repeating the patched route.', filtered: 'Apply case and encoding mutations to filtered tokens.', default: 'Review the failure signature before retesting.' };
  const rows = [...groups.values()].map(g => {
    const lower = g.failureClass.toLowerCase();
    const action = actions[lower] || (lower.includes('waf') || lower.includes('block') ? actions.waf : actions.default);
    return { key: g.key, failureClass: g.failureClass, failures: g.failures, payloadCount: g.payloads.size, title: `Lesson: ${g.failureClass} failures`, draft: `When ${g.failureClass} stopped ${g.failures} payload(s), the pattern repeated across ${g.payloads.size} payload(s).`, action, status: 'draft' };
  }).sort((a, b) => b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, lessonCount: rows.length, totalFailures: rows.reduce((s, r) => s + r.failures, 0), top: rows[0] || null, summary: `Infinity AI auto-drafted ${rows.length} lessons-learned entry record(s) from repeated failure patterns.` };
}
/** Idea 53548 — Payload Failure Timelines. */
export function payloadFailureTimelines(failures = []) {
  const groups = new Map();
  for (const f of Array.isArray(failures) ? failures : []) {
    const pid = String(f.payloadId || f.payload || keyOf(f, 'payload'));
    const g = groups.get(pid) || { key: pid, payload: pid, events: [] };
    g.events.push({ at: num(f.timestamp ?? f.at, 0), status: num(f.status, 0), defense: String(f.defense || ''), blocked: f.blocked === true || num(f.status, 0) === 403 });
    groups.set(pid, g);
  }
  const rows = [...groups.values()].map(g => {
    const timeline = [...g.events].sort((a, b) => a.at - b.at);
    let adaptationAt = null;
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].blocked && !timeline[i - 1].blocked) { adaptationAt = timeline[i].at; break; }
      if (timeline[i].defense && timeline[i - 1].defense && timeline[i].defense !== timeline[i - 1].defense) { adaptationAt = timeline[i].at; break; }
    }
    return { key: g.key, payload: g.payload, events: timeline.length, timeline, firstAt: timeline.length ? timeline[0].at : 0, lastAt: timeline.length ? timeline[timeline.length - 1].at : 0, adaptationAt, adapted: adaptationAt !== null };
  }).sort((a, b) => b.events - a.events || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, adaptedCount: rows.filter(r => r.adapted).length, top: rows[0] || null, summary: `Infinity AI built per-payload failure timelines for ${rows.length} payload(s) and marked defense-adaptation moments.` };
}
/** Idea 53549 — Failure Mode Shift Detection. */
export function detectFailureModeShifts(failures = []) {
  const list = [...(Array.isArray(failures) ? failures : [])].sort((a, b) => num(a.timestamp ?? a.at, 0) - num(b.timestamp ?? b.at, 0));
  const mid = Math.floor(list.length / 2);
  const early = list.slice(0, mid);
  const late = list.slice(mid);
  const countMode = arr => {
    const m = new Map();
    for (const f of arr) { const mode = String(f.mode || f.failureClass || f.failureMode || 'unknown'); m.set(mode, (m.get(mode) || 0) + 1); }
    return m;
  };
  const earlyCounts = countMode(early);
  const lateCounts = countMode(late);
  const modes = new Set([...earlyCounts.keys(), ...lateCounts.keys()]);
  const rows = [...modes].map(mode => ({ key: mode, mode, early: earlyCounts.get(mode) || 0, late: lateCounts.get(mode) || 0, delta: (lateCounts.get(mode) || 0) - (earlyCounts.get(mode) || 0) }))
    .sort((a, b) => b.late - a.late || b.delta - a.delta || String(a.key).localeCompare(String(b.key)));
  const dominantOf = counts => { let best = null; let bestN = -1; for (const [k, v] of counts) { if (v > bestN || (v === bestN && String(k) < String(best))) { best = k; bestN = v; } } return best; };
  const dominantEarly = dominantOf(earlyCounts);
  const dominantLate = dominantOf(lateCounts);
  const shifted = dominantEarly !== null && dominantLate !== null && dominantEarly !== dominantLate;
  return { rows, count: rows.length, totalFailures: list.length, dominantEarly, dominantLate, shifted, top: rows[0] || null, summary: `Infinity AI ${shifted ? `detected a failure mode shift from ${dominantEarly} to ${dominantLate}` : 'found a stable dominant failure mode'} across ${list.length} failure(s).` };
}
/** Idea 53550 — Cross-Defense Failure Comparison. */
export function compareFailuresAcrossDefenses(failures = []) {
  const list = Array.isArray(failures) ? failures : [];
  const groups = new Map();
  for (const f of list) {
    const payload = String(f.payload || f.payloadId || 'payload');
    const defense = String(f.defense || f.targetDefense || 'unknown-defense');
    const gk = `${payload}|${defense}`;
    const g = groups.get(gk) || { key: gk, payload, defense, attempts: 0, failures: 0 };
    if (f.attempts !== undefined || f.failures !== undefined) { g.attempts += num(f.attempts, 0); g.failures += num(f.failures ?? f.failed, 0); }
    else { g.attempts += 1; if (f.failed === true || num(f.status, 0) >= 400) g.failures += 1; }
    groups.set(gk, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, failureRate: rate(g.failures, g.attempts), successRate: round2(1 - rate(g.failures, g.attempts)) }))
    .sort((a, b) => a.failureRate - b.failureRate || String(a.key).localeCompare(String(b.key)));
  const payloadCount = new Set(rows.map(r => r.payload)).size;
  return { rows, count: rows.length, payloadCount, weakest: rows[0] || null, top: rows[0] || null, summary: `Infinity AI compared the same payloads across defenses and flagged the weakest link (${rows[0] ? rows[0].defense : 'none'}).` };
}
/** Idea 53551 — Failure-Informed Payload Design. */
export function designFromFailures(failures = []) {
  const playbook = { waf: ['Split blocked tokens across parameters', 'Switch to an alternate content type'], blocked: ['Split blocked tokens across parameters', 'Switch to an alternate content type'], patched: ['Target the sibling endpoint family', 'Vary the vulnerable parameter'], filtered: ['Apply double encoding to filtered tokens', 'Insert comment separators in keywords'], 'rate-limit': ['Pace requests under the observed threshold', 'Distribute across sessions'], default: ['Encode the payload body', 'Vary the delivery parameter'] };
  const groups = new Map();
  for (const f of Array.isArray(failures) ? failures : []) {
    const defense = String(f.defense || f.stoppedBy || 'default').toLowerCase();
    const g = groups.get(defense) || { key: defense, defense, failures: 0 };
    g.failures += 1;
    groups.set(defense, g);
  }
  const rows = [...groups.values()].map(g => {
    const recs = playbook[g.defense] || (g.defense.includes('waf') || g.defense.includes('block') ? playbook.waf : playbook.default);
    return { key: g.key, defense: g.defense, failures: g.failures, recommendations: [...recs], topRecommendation: recs[0], priority: g.failures };
  }).sort((a, b) => b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, recommendationCount: rows.reduce((s, r) => s + r.recommendations.length, 0), top: rows[0] || null, summary: `Infinity AI turned ${rows.reduce((s, r) => s + r.failures, 0)} failure(s) into next-generation payload design recommendations.` };
}
/** Idea 53552 — Payload Failure Insurance Metrics. */
export function payloadFailureInsurance(families = []) {
  const rows = (Array.isArray(families) ? families : []).map(f => {
    const failureRate = clamp01(f.failureRate ?? rate(num(f.failures, 0), num(f.attempts, 0)));
    let variants = 1;
    if (failureRate >= 0.9) variants = 5; else if (failureRate >= 0.75) variants = 4; else if (failureRate >= 0.5) variants = 3; else if (failureRate >= 0.25) variants = 2;
    if (String(f.criticality || '').toLowerCase() === 'high') variants += 1;
    const survivalChance = round2(1 - Math.pow(failureRate, variants));
    return { key: String(f.family || f.key || f.name || 'family'), family: String(f.family || f.name || 'family'), failureRate, criticality: String(f.criticality || 'normal'), variantsNeeded: variants, survivalChance };
  }).sort((a, b) => b.variantsNeeded - a.variantsNeeded || b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalVariants: rows.reduce((s, r) => s + r.variantsNeeded, 0), averageVariants: mean(rows.map(r => r.variantsNeeded)), top: rows[0] || null, summary: `Infinity AI calculated redundancy insurance for ${rows.length} payload family record(s) so at least one variant survives.` };
}
/** Idea 53553 — Failure Review Rituals. */
export function failureReviewRituals(failures = [], options = {}) {
  const pickCount = num(options.pickCount, 5);
  const freq = new Map();
  for (const f of Array.isArray(failures) ? failures : []) { const c = String(f.failureClass || f.mode || 'unknown'); freq.set(c, (freq.get(c) || 0) + 1); }
  const total = (Array.isArray(failures) ? failures : []).length;
  const scored = (Array.isArray(failures) ? failures : []).map(f => {
    const klass = String(f.failureClass || f.mode || 'unknown');
    const rarity = total ? round2(1 - (freq.get(klass) || 0) / total) : 0;
    const novelty = f.novelty !== undefined ? clamp01(f.novelty) : rarity;
    const signal = clamp01(f.signalScore ?? f.signal ?? 0.5);
    const score = round2(0.6 * novelty + 0.4 * signal);
    return { key: keyOf(f, 'failure'), failureClass: klass, novelty: round2(novelty), signal, score };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  const rows = scored.map((r, i) => ({ ...r, selected: i < pickCount, rank: i + 1 }));
  return { rows, count: rows.length, selectedCount: rows.filter(r => r.selected).length, pickCount, top: rows[0] || null, summary: `Infinity AI picked the ${rows.filter(r => r.selected).length} most instructive failure(s) for the weekly review ritual.` };
}
/** Idea 53554 — Failure Data Retention Tiers. */
export function failureRetentionTiers(failures = []) {
  const tierFor = n => n >= 0.8 ? { tier: 'long-term', retentionDays: 365 } : n >= 0.5 ? { tier: 'medium', retentionDays: 180 } : n >= 0.2 ? { tier: 'short', retentionDays: 90 } : { tier: 'ephemeral', retentionDays: 30 };
  const rows = (Array.isArray(failures) ? failures : []).map(f => {
    const novelty = clamp01(f.novelty ?? f.noveltyScore ?? 0);
    const t = tierFor(novelty);
    return { key: keyOf(f, 'failure'), novelty, tier: t.tier, retentionDays: t.retentionDays };
  }).sort((a, b) => b.novelty - a.novelty || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, longTermCount: rows.filter(r => r.tier === 'long-term').length, tierCounts: { 'long-term': rows.filter(r => r.tier === 'long-term').length, medium: rows.filter(r => r.tier === 'medium').length, short: rows.filter(r => r.tier === 'short').length, ephemeral: rows.filter(r => r.tier === 'ephemeral').length }, top: rows[0] || null, summary: `Infinity AI assigned retention tiers to ${rows.length} failure record(s), keeping novel failures the longest.` };
}
/** Idea 53555 — Payload Failure Prediction. */
export function predictPayloadFailure(payloads = [], targets = []) {
  const targetList = Array.isArray(targets) ? targets : [];
  const defaultDefense = targetList.length ? clamp01(targetList[0].defenseStrength ?? 0.5) : 0.5;
  const rows = (Array.isArray(payloads) ? payloads : []).map(p => {
    const hist = clamp01(p.historicalFailureRate ?? p.failureRate ?? 0.5);
    let defense = defaultDefense;
    if (p.targetDefenseStrength !== undefined) defense = clamp01(p.targetDefenseStrength);
    else if (p.target) { const match = targetList.find(t => String(t.target || t.key || '') === String(p.target)); if (match) defense = clamp01(match.defenseStrength ?? 0.5); }
    const complexity = clamp01(p.complexity ?? 0.5);
    const probability = clamp01(round2(0.5 * hist + 0.3 * defense + 0.2 * complexity));
    return { key: keyOf(p, 'payload'), payload: String(p.payload || p.payloadId || keyOf(p, 'payload')), target: String(p.target || (targetList[0] ? String(targetList[0].target || targetList[0].key || '') : '')), historicalFailureRate: hist, defenseStrength: defense, failureProbability: probability, risk: probability >= 0.7 ? 'high' : probability >= 0.4 ? 'medium' : 'low' };
  }).sort((a, b) => b.failureProbability - a.failureProbability || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, highRiskCount: rows.filter(r => r.risk === 'high').length, averageProbability: mean(rows.map(r => r.failureProbability)), top: rows[0] || null, summary: `Infinity AI predicted pre-send failure probability for ${rows.length} payload(s) against target defense profiles.` };
}
/** Idea 53556 — Failure-Aware Scheduling. */
export function scheduleFailureAware(payloads = [], options = {}) {
  const slots = (Array.isArray(options.slots) && options.slots.length ? options.slots : [{ slot: 'early-window', budgetHealth: 0.9 }, { slot: 'mid-window', budgetHealth: 0.6 }, { slot: 'late-window', budgetHealth: 0.3 }])
    .map(s => ({ slot: String(s.slot || 'window'), budgetHealth: clamp01(s.budgetHealth ?? 0.5) }))
    .sort((a, b) => b.budgetHealth - a.budgetHealth || String(a.slot).localeCompare(String(b.slot)));
  const sorted = [...(Array.isArray(payloads) ? payloads : [])].sort((a, b) => clamp01(b.riskScore ?? b.risk ?? 0) - clamp01(a.riskScore ?? a.risk ?? 0) || String(keyOf(a, 'payload')).localeCompare(String(keyOf(b, 'payload'))));
  const rows = sorted.map((p, i) => {
    const slot = slots.length ? slots[i % slots.length] : { slot: 'unassigned', budgetHealth: 0 };
    return { key: keyOf(p, 'payload'), payload: String(p.payload || p.payloadId || keyOf(p, 'payload')), riskScore: clamp01(p.riskScore ?? p.risk ?? 0), assignedSlot: slot.slot, slotHealth: slot.budgetHealth, order: i + 1 };
  }).sort((a, b) => a.order - b.order);
  return { rows, count: rows.length, slotsUsed: new Set(rows.map(r => r.assignedSlot)).size, slots, top: rows[0] || null, summary: `Infinity AI scheduled ${rows.length} payload(s) so the riskiest run when the rate-limit budget is healthiest.` };
}
/** Idea 53557 — Failure Pattern Search. */
export function searchFailurePatterns(failures = [], query = '') {
  const q = String(query || '').toLowerCase().trim();
  const list = Array.isArray(failures) ? failures : [];
  const rows = list.map(f => {
    const signature = String(f.signature || f.responseSignature || '');
    const haystack = `${signature} ${String(f.status || '')} ${String(f.bodySnippet || f.body || '')} ${String(f.payload || '')}`.toLowerCase();
    const matched = !q || haystack.includes(q);
    const exactSignature = q !== '' && signature.toLowerCase() === q;
    return { key: keyOf(f, 'failure'), signature, status: num(f.status, 0), matched, exactSignature };
  }).filter(r => r.matched).sort((a, b) => Number(b.exactSignature) - Number(a.exactSignature) || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, matchCount: rows.length, query: q, distinctSignatures: new Set(rows.map(r => r.signature)).size, top: rows[0] || null, summary: `Infinity AI searched failure records by response signature and matched ${rows.length} record(s).` };
}
/** Idea 53558 — Failure-Driven WAF Identification. */
export function identifyWafFromFailures(failures = []) {
  const detect = f => {
    const text = `${String(f.serverHeader || '')} ${String(f.signature || '')} ${String(f.bodySnippet || f.body || '')} ${String(f.headers || '')}`.toLowerCase();
    if (text.includes('cloudflare') || text.includes('cf-ray') || text.includes('__cf')) return 'Cloudflare';
    if (text.includes('akamai')) return 'Akamai';
    if (text.includes('awselb') || text.includes('aws-waf') || text.includes('x-amzn')) return 'AWS WAF';
    if (text.includes('modsecurity') || text.includes('mod_security')) return 'ModSecurity';
    if (text.includes('imperva') || text.includes('incapsula')) return 'Imperva';
    if (text.includes('sucuri')) return 'Sucuri';
    return String(f.wafGuess || 'unknown-waf');
  };
  const groups = new Map();
  for (const f of Array.isArray(failures) ? failures : []) {
    const waf = detect(f);
    const g = groups.get(waf) || { key: waf, waf, failures: 0, signatures: new Set(), confidenceSum: 0 };
    g.failures += 1;
    if (f.signature) g.signatures.add(String(f.signature));
    g.confidenceSum += waf === 'unknown-waf' ? 0.3 : 0.85;
    groups.set(waf, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, waf: g.waf, failures: g.failures, signatures: [...g.signatures].sort(), signatureCount: g.signatures.size, confidence: g.failures ? round2(g.confidenceSum / g.failures) : 0 }))
    .sort((a, b) => b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, wafCount: rows.length, identifiedCount: rows.filter(r => r.waf !== 'unknown-waf').reduce((s, r) => s + r.failures, 0), top: rows[0] || null, summary: `Infinity AI identified the WAF from failure response patterns across ${rows.reduce((s, r) => s + r.failures, 0)} failure(s).` };
}
/** Idea 53559 — Payload Failure Cost-Benefit. */
export function failureCostBenefit(failures = [], options = {}) {
  const defaultCost = num(options.costPerRequest, 1);
  const rows = (Array.isArray(failures) ? failures : []).map(f => {
    const requests = num(f.requests ?? f.attempts, 1);
    const cost = round2(requests * num(f.costPerRequest, defaultCost));
    const intel = round2(num(f.intelValue ?? f.intel, 0));
    const ratio = cost ? round2(intel / cost) : intel;
    return { key: keyOf(f, 'failure'), requests, cost, intelValue: intel, ratio, netValue: round2(intel - cost), worthIt: intel >= cost };
  }).sort((a, b) => b.ratio - a.ratio || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalCost: round2(rows.reduce((s, r) => s + r.cost, 0)), totalIntel: round2(rows.reduce((s, r) => s + r.intelValue, 0)), worthwhileCount: rows.filter(r => r.worthIt).length, top: rows[0] || null, summary: `Infinity AI weighed intel value against request cost for ${rows.length} failure(s) to judge which failures were worth buying.` };
}
/** Idea 53560 — Failure Autopsy Leaderboards. */
export function failureAutopsyLeaderboard(reviews = []) {
  const groups = new Map();
  for (const r of Array.isArray(reviews) ? reviews : []) {
    const name = String(r.researcher || r.author || 'anonymous');
    const g = groups.get(name) || { key: name, researcher: name, autopsies: 0, insights: 0, qualitySum: 0 };
    g.autopsies += 1;
    g.insights += num(r.insights ?? r.insightCount, 0);
    g.qualitySum += clamp01(r.qualityScore ?? r.quality ?? 0.5);
    groups.set(name, g);
  }
  const base = [...groups.values()].map(g => ({ key: g.key, researcher: g.researcher, autopsies: g.autopsies, insights: g.insights, averageQuality: g.autopsies ? round2(g.qualitySum / g.autopsies) : 0, score: round2(g.insights * 2 + (g.autopsies ? round2(g.qualitySum / g.autopsies) : 0) * 5) }));
  base.sort((a, b) => b.score - a.score || b.insights - a.insights || String(a.key).localeCompare(String(b.key)));
  const rows = base.map((r, i) => ({ ...r, rank: i + 1 }));
  return { rows, count: rows.length, researcherCount: rows.length, totalInsights: rows.reduce((s, r) => s + r.insights, 0), top: rows[0] || null, summary: `Infinity AI ranked ${rows.length} researcher(s) by insight extracted per failure autopsy.` };
}
