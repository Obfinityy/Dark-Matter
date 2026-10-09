/**
 * wave89ACore.js — Infinity AI · Wave 89A
 * Failure forensics and payload rot, ideas 53521–53540: payload rot
 * schedules, failure attribution to stack changes, cannibalized
 * payload detection, order-dependent failure analysis, failure rate
 * baselines, environmental failure tags, payload precision decay
 * curves, failure pattern alerts, retired payload graveyards,
 * failure-driven defense mapping, payload fragility scores, failure
 * replay sandboxes, cross-target failure correlation,
 * failure-to-success conversion tracking, human failure review
 * queues, failure explanation generation, payload failure heatmaps,
 * defense evasion learning loops, failure data sharing (opt-in),
 * and payload age-vs-failure curves.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE89_A_IDEAS = [
  { id: 53521, title: 'Payload Rot Schedules', skip: false },
  { id: 53522, title: 'Failure Attribution to Stack Changes', skip: false },
  { id: 53523, title: 'Cannibalized Payload Detection', skip: false },
  { id: 53524, title: 'Order-Dependent Failure Analysis', skip: false },
  { id: 53525, title: 'Failure Rate Baselines', skip: false },
  { id: 53526, title: 'Environmental Failure Tags', skip: false },
  { id: 53527, title: 'Payload Precision Decay Curves', skip: false },
  { id: 53528, title: 'Failure Pattern Alerts', skip: false },
  { id: 53529, title: 'Retired Payload Graveyards', skip: false },
  { id: 53530, title: 'Failure-Driven Defense Mapping', skip: false },
  { id: 53531, title: 'Payload Fragility Scores', skip: false },
  { id: 53532, title: 'Failure Replay Sandboxes', skip: false },
  { id: 53533, title: 'Cross-Target Failure Correlation', skip: false },
  { id: 53534, title: 'Failure-to-Success Conversion Tracking', skip: false },
  { id: 53535, title: 'Human Failure Review Queues', skip: false },
  { id: 53536, title: 'Failure Explanation Generation', skip: false },
  { id: 53537, title: 'Payload Failure Heatmaps', skip: false },
  { id: 53538, title: 'Defense Evasion Learning Loops', skip: false },
  { id: 53539, title: 'Failure Data Sharing (Opt-In)', skip: false },
  { id: 53540, title: 'Payload Age-vs-Failure Curves', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function keyOf(it,fb='item'){return String(it.key||it.id||it.payloadId||it.payload||it.family||it.name||it.title||fb);}

/** Idea 53521 — Payload Rot Schedules. Input failures: {payloadId|key, family, ageDays}. Retest is due when ageDays reaches the threshold (default 90 days). */
export function schedulePayloadRot(failures = [], options = {}) {
  const thresholdDays = num(options.thresholdDays, 90);
  const rows = (failures || []).map(f => {
    const ageDays = num(f.ageDays ?? f.age, 0);
    const dueRetest = ageDays >= thresholdDays;
    return { key: keyOf(f, 'payload'), family: String(f.family || 'general'), ageDays, dueRetest, priority: clamp01(ageDays / 180) };
  }).sort((a, b) => Number(b.dueRetest) - Number(a.dueRetest) || b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  const dueCount = rows.filter(r => r.dueRetest).length;
  return { rows, count: rows.length, dueCount, currentCount: rows.length - dueCount, thresholdDays, top: rows[0] || null, summary: `Infinity AI scheduled payload rot retests for ${dueCount} payload(s) at or past ${thresholdDays} days old.` };
}
/** Idea 53522 — Failure Attribution to Stack Changes. Input failures: {payloadId|key, family, stack, waf}; changes: {stack, waf, label}. A failure is attributed when its stack or WAF matches a recorded change. */
export function attributeFailuresToStack(failures = [], changes = []) {
  const changeList = Array.isArray(changes) ? changes : [];
  const rows = (failures || []).map(f => {
    const stack = String(f.stack || f.stackVersion || '');
    const waf = String(f.waf || f.wafVersion || '');
    const match = changeList.find(c => (stack && String(c.stack || c.stackVersion || '') === stack) || (waf && String(c.waf || c.wafVersion || '') === waf));
    return { key: keyOf(f, 'payload'), family: String(f.family || 'general'), stack, waf, attributed: Boolean(match), attributedTo: match ? String(match.label || match.stack || match.waf || 'stack-change') : 'unattributed' };
  }).sort((a, b) => Number(b.attributed) - Number(a.attributed) || String(a.key).localeCompare(String(b.key)));
  const attributedCount = rows.filter(r => r.attributed).length;
  return { rows, count: rows.length, attributedCount, unattributedCount: rows.length - attributedCount, attributionRate: rate(attributedCount, rows.length), top: rows[0] || null, summary: `Infinity AI attributed ${attributedCount} failure(s) to recent stack or WAF changes.` };
}
/** Idea 53523 — Cannibalized Payload Detection. Input attempts in execution order: {payload, target, outcome, armedDefense}. A payload failure is cannibalized when an earlier different payload on the same target armed defenses. */
export function detectCannibalizedPayloads(attempts = []) {
  const byPayload = new Map();
  const list = attempts || [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const payload = keyOf(a, 'payload');
    const g = byPayload.get(payload) || { key: payload, attempts: 0, failures: 0, cannibalizedFailures: 0 };
    g.attempts += 1;
    const failed = String(a.outcome || '') === 'failure' || a.failed === true;
    if (failed) {
      g.failures += 1;
      const armedEarlier = list.slice(0, i).some(p => String(p.target || '') === String(a.target || '') && keyOf(p, 'payload') !== payload && (p.armedDefense === true || String(p.outcome || '') === 'armed'));
      if (armedEarlier) g.cannibalizedFailures += 1;
    }
    byPayload.set(payload, g);
  }
  const rows = [...byPayload.values()].map(g => ({ ...g, cannibalized: g.cannibalizedFailures > 0, cannibalRate: rate(g.cannibalizedFailures, g.failures) }))
    .sort((a, b) => b.cannibalizedFailures - a.cannibalizedFailures || String(a.key).localeCompare(String(b.key)));
  const cannibalizedCount = rows.filter(r => r.cannibalized).length;
  return { rows, count: rows.length, cannibalizedCount, cleanCount: rows.length - cannibalizedCount, top: rows[0] || null, summary: `Infinity AI detected ${cannibalizedCount} payload(s) cannibalized by defenses armed by earlier payloads.` };
}
/** Idea 53524 — Order-Dependent Failure Analysis. Input runs: {position, outcome|failed}. Groups failure rates by sequence position to expose position sensitivity. */
export function analyzeOrderDependence(runs = []) {
  const byPosition = new Map();
  for (const r of runs || []) {
    const position = num(r.position ?? r.index, 0);
    const g = byPosition.get(position) || { position, runs: 0, failures: 0 };
    g.runs += 1;
    if (String(r.outcome || '') === 'failure' || r.failed === true) g.failures += 1;
    byPosition.set(position, g);
  }
  const rows = [...byPosition.values()].map(g => ({ key: `pos-${g.position}`, position: g.position, runs: g.runs, failures: g.failures, failureRate: rate(g.failures, g.runs) }))
    .sort((a, b) => a.position - b.position);
  const rates = rows.map(r => r.failureRate);
  const spread = rates.length ? round2(Math.max(...rates) - Math.min(...rates)) : 0;
  const top = rows.length ? [...rows].sort((a, b) => b.failureRate - a.failureRate || a.position - b.position)[0] : null;
  return { rows, count: rows.length, spread, orderSensitive: spread >= 0.3, top, summary: `Infinity AI found a ${spread} failure-rate spread across sequence positions${spread >= 0.3 ? ', indicating order dependence' : ''}.` };
}
/** Idea 53525 — Failure Rate Baselines. Input families: {family|key, failures, attempts, expectedRate}. Flags families whose observed rate deviates from the expected baseline. */
export function baselineFailureRates(families = [], options = {}) {
  const tolerance = num(options.tolerance, 0.2);
  const prepared = (families || []).map(f => {
    const attempts = num(f.attempts, 0);
    const failures = num(f.failures, 0);
    return { f, attempts, failures, observed: rate(failures, attempts) };
  });
  const overall = rate(prepared.reduce((s, p) => s + p.failures, 0), prepared.reduce((s, p) => s + p.attempts, 0));
  const rows = prepared.map(p => {
    const expected = p.f.expectedRate !== undefined ? clamp01(p.f.expectedRate) : overall;
    const deviation = round2(Math.abs(p.observed - expected));
    return { key: keyOf(p.f, 'family'), family: String(p.f.family || keyOf(p.f, 'family')), attempts: p.attempts, failures: p.failures, rate: p.observed, expectedRate: expected, deviation, anomaly: deviation > tolerance };
  }).sort((a, b) => b.rate - a.rate || String(a.key).localeCompare(String(b.key)));
  const anomalyCount = rows.filter(r => r.anomaly).length;
  return { rows, count: rows.length, overallRate: overall, anomalyCount, top: rows[0] || null, summary: `Infinity AI baselined failure rates at ${overall} overall and flagged ${anomalyCount} anomalous family(ies).` };
}
/** Idea 53526 — Environmental Failure Tags. Input failures: {payloadId|key, reason, statusCode, latencyMs}. Tags rate-limit and timeout signals as environmental and the rest as defense-driven. */
export function tagEnvironmentalFailures(failures = [], options = {}) {
  const latencyThresholdMs = num(options.latencyThresholdMs, 8000);
  const rows = (failures || []).map(f => {
    const reason = String(f.reason || '').toLowerCase();
    const statusCode = num(f.statusCode, 0);
    const latencyMs = num(f.latencyMs, 0);
    const environmental = reason.includes('rate') || reason.includes('timeout') || reason.includes('throttl') || statusCode === 429 || statusCode === 503 || statusCode === 504 || latencyMs >= latencyThresholdMs;
    return { key: keyOf(f, 'payload'), reason: String(f.reason || 'unknown'), statusCode, latencyMs, tag: environmental ? 'environmental' : 'defense' };
  }).sort((a, b) => String(a.tag).localeCompare(String(b.tag)) || String(a.key).localeCompare(String(b.key)));
  const environmentalCount = rows.filter(r => r.tag === 'environmental').length;
  return { rows, count: rows.length, environmentalCount, defenseCount: rows.length - environmentalCount, environmentalRate: rate(environmentalCount, rows.length), top: rows[0] || null, summary: `Infinity AI tagged ${environmentalCount} failure(s) as environmental and ${rows.length - environmentalCount} as defense-driven.` };
}
/** Idea 53527 — Payload Precision Decay Curves. Input payloads: {payloadId|key, ageDays, successes, attempts} or a direct precision value. Averages precision per age bucket. */
export function precisionDecayCurves(payloads = []) {
  const buckets = [
    { key: '0-30', min: 0, max: 30 },
    { key: '31-90', min: 31, max: 90 },
    { key: '91-180', min: 91, max: 180 },
    { key: '181+', min: 181, max: Number.POSITIVE_INFINITY },
  ];
  const grouped = buckets.map(b => ({ ...b, precisions: [], count: 0 }));
  for (const p of payloads || []) {
    const ageDays = num(p.ageDays ?? p.age, 0);
    const precision = p.precision !== undefined ? clamp01(p.precision) : rate(num(p.successes, 0), num(p.attempts, 0));
    const bucket = grouped.find(b => ageDays >= b.min && ageDays <= b.max) || grouped[grouped.length - 1];
    bucket.precisions.push(precision);
    bucket.count += 1;
  }
  const rows = grouped.map(b => ({ key: b.key, bucket: b.key, count: b.count, avgPrecision: mean(b.precisions) }));
  const top = rows.length ? [...rows].sort((a, b) => b.avgPrecision - a.avgPrecision || String(a.key).localeCompare(String(b.key)))[0] : null;
  const decay = rows.length > 1 ? round2(rows[0].avgPrecision - rows[rows.length - 1].avgPrecision) : 0;
  return { rows, count: rows.length, payloadCount: (payloads || []).length, decay, top, summary: `Infinity AI charted payload precision decay of ${decay} from the freshest to the oldest age bucket.` };
}
/** Idea 53528 — Failure Pattern Alerts. Input families: {family|key, currentRate, baselineRate}. Alerts when the current rate surges above baseline by the configured delta. */
export function alertFailurePatterns(families = [], options = {}) {
  const surgeDelta = num(options.surgeDelta, 0.2);
  const rows = (families || []).map(f => {
    const currentRate = clamp01(f.currentRate ?? f.rate ?? 0);
    const baselineRate = clamp01(f.baselineRate ?? f.baseline ?? 0);
    const surge = round2(currentRate - baselineRate);
    return { key: keyOf(f, 'family'), family: String(f.family || keyOf(f, 'family')), currentRate, baselineRate, surge, alert: surge >= surgeDelta && currentRate >= 0.5 };
  }).sort((a, b) => b.surge - a.surge || String(a.key).localeCompare(String(b.key)));
  const alertCount = rows.filter(r => r.alert).length;
  return { rows, count: rows.length, alertCount, top: rows[0] || null, summary: `Infinity AI raised failure pattern alerts for ${alertCount} family(ies) with fleet-wide surges.` };
}
/** Idea 53529 — Retired Payload Graveyards. Input payloads: {payloadId|key, retired|status, failures, attempts, successes}. Surfaces retired payloads with their failure history. */
export function retiredPayloadGraveyards(payloads = []) {
  const rows = (payloads || []).map(p => {
    const retired = p.retired === true || String(p.status || '') === 'retired';
    const attempts = num(p.attempts, 0);
    const failures = num(p.failures, 0);
    return { key: keyOf(p, 'payload'), family: String(p.family || 'general'), retired, failures, attempts, failureRate: rate(failures, attempts), lastUsedDaysAgo: num(p.lastUsedDaysAgo, 0) };
  }).sort((a, b) => Number(b.retired) - Number(a.retired) || b.failures - a.failures || String(a.key).localeCompare(String(b.key)));
  const retiredRows = rows.filter(r => r.retired);
  return { rows, count: rows.length, graveyardCount: retiredRows.length, activeCount: rows.length - retiredRows.length, averageRetiredFailureRate: mean(retiredRows.map(r => r.failureRate)), top: rows[0] || null, summary: `Infinity AI catalogued ${retiredRows.length} retired payload(s) in the payload graveyard.` };
}
/** Idea 53530 — Failure-Driven Defense Mapping. Input failures: {defense, family}. Builds defense-by-family block count rows. */
export function mapDefensesFromFailures(failures = []) {
  const grouped = new Map();
  for (const f of failures || []) {
    const defense = String(f.defense || 'unknown-defense');
    const family = String(f.family || f.payloadFamily || 'general');
    const key = `${defense}|${family}`;
    const g = grouped.get(key) || { key, defense, family, blocks: 0 };
    g.blocks += num(f.count, 1);
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].sort((a, b) => b.blocks - a.blocks || String(a.key).localeCompare(String(b.key)));
  const defenses = new Set(rows.map(r => r.defense));
  return { rows, count: rows.length, defenseCount: defenses.size, totalBlocks: rows.reduce((s, r) => s + r.blocks, 0), top: rows[0] || null, summary: `Infinity AI mapped ${rows.reduce((s, r) => s + r.blocks, 0)} defense block(s) across ${defenses.size} defense(s) from failure data.` };
}
/** Idea 53531 — Payload Fragility Scores. Input payloads: {payloadId|key, mutationFailures, mutationAttempts} or a direct sensitivity value. Scores brittleness from mutation sensitivity. */
export function scorePayloadFragility(payloads = [], options = {}) {
  const brittleAt = num(options.brittleAt, 0.7);
  const rows = (payloads || []).map(p => {
    const fragility = p.sensitivity !== undefined ? clamp01(p.sensitivity) : rate(num(p.mutationFailures, 0), num(p.mutationAttempts, 0));
    return { key: keyOf(p, 'payload'), family: String(p.family || 'general'), fragility, brittle: fragility >= brittleAt };
  }).sort((a, b) => b.fragility - a.fragility || String(a.key).localeCompare(String(b.key)));
  const brittleCount = rows.filter(r => r.brittle).length;
  return { rows, count: rows.length, brittleCount, averageFragility: mean(rows.map(r => r.fragility)), top: rows[0] || null, summary: `Infinity AI scored ${brittleCount} payload(s) as brittle from mutation sensitivity.` };
}
/** Idea 53532 — Failure Replay Sandboxes. Input failures: {payloadId|key, recordedBlocked, replayBlocked} or recorded and replay status codes. Compares replay verdicts against recorded responses. */
export function failureReplaySandbox(failures = []) {
  const rows = (failures || []).map(f => {
    const recordedBlocked = f.recordedBlocked !== undefined ? f.recordedBlocked === true : [401, 403, 406, 429].includes(num(f.recordedStatus, 0));
    const replayBlocked = f.replayBlocked !== undefined ? f.replayBlocked === true : [401, 403, 406, 429].includes(num(f.replayStatus, 0));
    const verdict = recordedBlocked && replayBlocked ? 'reproduced' : recordedBlocked && !replayBlocked ? 'escaped' : !recordedBlocked && replayBlocked ? 'newly-blocked' : 'consistent-pass';
    return { key: keyOf(f, 'payload'), recordedBlocked, replayBlocked, verdict };
  }).sort((a, b) => String(a.verdict).localeCompare(String(b.verdict)) || String(a.key).localeCompare(String(b.key)));
  const reproducedCount = rows.filter(r => r.verdict === 'reproduced').length;
  const escapedCount = rows.filter(r => r.verdict === 'escaped').length;
  return { rows, count: rows.length, reproducedCount, escapedCount, top: rows[0] || null, summary: `Infinity AI replayed failures in the sandbox: ${reproducedCount} reproduced and ${escapedCount} escaped their recorded defenses.` };
}
/** Idea 53533 — Cross-Target Failure Correlation. Input failures: {technique|family, target, outcome}. Detects techniques failing across many distinct targets. */
export function correlateFailuresAcrossTargets(failures = [], options = {}) {
  const deadAtTargets = num(options.deadAtTargets, 3);
  const grouped = new Map();
  for (const f of failures || []) {
    const technique = String(f.technique || f.family || keyOf(f, 'technique'));
    const g = grouped.get(technique) || { key: technique, technique, targets: new Set(), attempts: 0, failures: 0 };
    g.targets.add(String(f.target || 'target'));
    g.attempts += 1;
    if (String(f.outcome || '') === 'failure' || f.failed === true || f.outcome === undefined) g.failures += 1;
    grouped.set(technique, g);
  }
  const rows = [...grouped.values()].map(g => ({ key: g.key, technique: g.technique, targets: g.targets.size, attempts: g.attempts, failures: g.failures, failureRate: rate(g.failures, g.attempts), deadTechnique: g.targets.size >= deadAtTargets && g.failures === g.attempts }))
    .sort((a, b) => b.targets - a.targets || String(a.key).localeCompare(String(b.key)));
  const deadCount = rows.filter(r => r.deadTechnique).length;
  return { rows, count: rows.length, deadCount, top: rows[0] || null, summary: `Infinity AI correlated failures across targets and found ${deadCount} dead technique(s).` };
}
/** Idea 53534 — Failure-to-Success Conversion Tracking. Input events: {payloadId|key, mutatedFromFailure, outcome}. Measures how often mutated failures convert to successes per payload. */
export function trackFailureConversions(events = []) {
  const grouped = new Map();
  for (const e of events || []) {
    const payload = keyOf(e, 'payload');
    const g = grouped.get(payload) || { key: payload, mutatedAttempts: 0, conversions: 0 };
    const mutated = e.mutatedFromFailure === true || e.mutated === true;
    if (mutated) {
      g.mutatedAttempts += 1;
      if (String(e.outcome || '') === 'success' || e.convertedToSuccess === true || e.success === true) g.conversions += 1;
    }
    grouped.set(payload, g);
  }
  const rows = [...grouped.values()].map(g => ({ ...g, conversionRate: rate(g.conversions, g.mutatedAttempts) }))
    .sort((a, b) => b.conversionRate - a.conversionRate || String(a.key).localeCompare(String(b.key)));
  const totalAttempts = rows.reduce((s, r) => s + r.mutatedAttempts, 0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
  return { rows, count: rows.length, totalAttempts, totalConversions, overallConversionRate: rate(totalConversions, totalAttempts), top: rows[0] || null, summary: `Infinity AI tracked a ${rate(totalConversions, totalAttempts)} failure-to-success conversion rate across mutated payloads.` };
}
/** Idea 53535 — Human Failure Review Queues. Input failures: {payloadId|key, noveltyScore, seenCount, reason}. Prioritizes novel, rarely seen failures for human review. */
export function queueHumanFailureReviews(failures = [], options = {}) {
  const noveltyAt = num(options.noveltyAt, 0.7);
  const rows = (failures || []).map(f => {
    const novelty = clamp01(f.noveltyScore ?? f.novelty ?? 0);
    const seenCount = num(f.seenCount, 0);
    const priority = round2(novelty * (1 / (1 + seenCount)));
    return { key: keyOf(f, 'payload'), reason: String(f.reason || 'unknown'), novelty, seenCount, priority, needsReview: novelty >= noveltyAt };
  }).sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  const reviewCount = rows.filter(r => r.needsReview).length;
  return { rows, count: rows.length, reviewCount, top: rows[0] || null, summary: `Infinity AI queued ${reviewCount} novel failure(s) for human review.` };
}
/** Idea 53536 — Failure Explanation Generation. Input failures: {payloadId|key, reason, defense, statusCode}. Generates plain-language explanation strings per failure. */
export function generateFailureExplanations(failures = []) {
  const rows = (failures || []).map(f => {
    const payload = keyOf(f, 'payload');
    const reason = String(f.reason || 'blocked');
    const defense = String(f.defense || 'the target defense');
    const statusCode = num(f.statusCode, 0);
    const statusPart = statusCode ? ` (HTTP ${statusCode})` : '';
    return { key: payload, payload, reason, defense, statusCode, explanation: `Infinity AI: payload ${payload} failed because ${defense} responded with ${reason}${statusPart}.` };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, explainedCount: rows.length, top: rows[0] || null, summary: `Infinity AI generated plain-language explanations for ${rows.length} failure(s).` };
}
/** Idea 53537 — Payload Failure Heatmaps. Input failures: {reason, family}. Builds reason-by-family heat rows with relative intensity. */
export function payloadFailureHeatmap(failures = []) {
  const grouped = new Map();
  for (const f of failures || []) {
    const reason = String(f.reason || 'unknown');
    const family = String(f.family || f.payloadFamily || 'general');
    const key = `${reason}|${family}`;
    const g = grouped.get(key) || { key, reason, family, count: 0 };
    g.count += num(f.count, 1);
    grouped.set(key, g);
  }
  const raw = [...grouped.values()];
  const max = raw.reduce((m, r) => Math.max(m, r.count), 0);
  const rows = raw.map(r => ({ ...r, intensity: max ? round2(r.count / max) : 0 }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, maxCount: max, totalFailures: rows.reduce((s, r) => s + r.count, 0), top: rows[0] || null, summary: `Infinity AI built a failure heatmap with ${rows.length} reason-by-family cell(s).` };
}
/** Idea 53538 — Defense Evasion Learning Loops. Input failures: {defense, evasionTechnique|technique, bypassed|outcome}. Surfaces evasion techniques that bypassed a defense as learning candidates. */
export function evasionLearningLoop(failures = []) {
  const grouped = new Map();
  for (const f of failures || []) {
    const defense = String(f.defense || 'unknown-defense');
    const technique = String(f.evasionTechnique || f.technique || 'direct');
    const key = `${defense}|${technique}`;
    const g = grouped.get(key) || { key, defense, technique, attempts: 0, bypasses: 0 };
    g.attempts += 1;
    if (f.bypassed === true || String(f.outcome || '') === 'success' || String(f.outcome || '') === 'bypass') g.bypasses += 1;
    grouped.set(key, g);
  }
  const rows = [...grouped.values()].map(g => ({ ...g, bypassRate: rate(g.bypasses, g.attempts), candidate: g.bypasses > 0 }))
    .sort((a, b) => b.bypassRate - a.bypassRate || String(a.key).localeCompare(String(b.key)));
  const candidateCount = rows.filter(r => r.candidate).length;
  return { rows, count: rows.length, candidateCount, top: rows[0] || null, summary: `Infinity AI found ${candidateCount} evasion technique candidate(s) from failure forensics.` };
}
/** Idea 53539 — Failure Data Sharing (Opt-In). Input failures with identifiers plus options: {optIn}. When opted in, returns anonymized rows with target and payload identifiers stripped. */
export function shareFailureData(failures = [], options = {}) {
  const optIn = options.optIn === true;
  if (!optIn) {
    return { rows: [], count: 0, sharedCount: 0, optIn: false, top: null, summary: `Infinity AI shared no failure data because opt-in consent was not granted.` };
  }
  const rows = (failures || []).map(f => ({
    key: `${String(f.family || 'general')}|${String(f.reason || 'unknown')}`,
    family: String(f.family || 'general'),
    reason: String(f.reason || 'unknown'),
    defense: String(f.defense || 'unknown-defense'),
    ageBucket: num(f.ageDays, 0) >= 90 ? '90+' : num(f.ageDays, 0) >= 31 ? '31-90' : '0-30',
  })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, sharedCount: rows.length, optIn: true, top: rows[0] || null, summary: `Infinity AI prepared ${rows.length} anonymized failure record(s) for opt-in sharing.` };
}
/** Idea 53540 — Payload Age-vs-Failure Curves. Input payloads: {payloadId|key, ageDays, failures, attempts}. Buckets failure rate by age and estimates a retirement age. */
export function payloadAgeFailureCurves(payloads = [], options = {}) {
  const retireAtRate = num(options.retireAtRate, 0.8);
  const buckets = [
    { key: '0-30', min: 0, max: 30 },
    { key: '31-90', min: 31, max: 90 },
    { key: '91-180', min: 91, max: 180 },
    { key: '181+', min: 181, max: Number.POSITIVE_INFINITY },
  ];
  const grouped = buckets.map(b => ({ ...b, payloads: 0, failures: 0, attempts: 0 }));
  for (const p of payloads || []) {
    const ageDays = num(p.ageDays ?? p.age, 0);
    const bucket = grouped.find(b => ageDays >= b.min && ageDays <= b.max) || grouped[grouped.length - 1];
    bucket.payloads += 1;
    bucket.failures += num(p.failures, 0);
    bucket.attempts += num(p.attempts, 0);
  }
  const rows = grouped.map(b => ({ key: b.key, bucket: b.key, payloads: b.payloads, failures: b.failures, attempts: b.attempts, failureRate: rate(b.failures, b.attempts), recommendRetire: rate(b.failures, b.attempts) >= retireAtRate && b.attempts > 0 }));
  const firstRetire = rows.find(r => r.recommendRetire);
  const retirementEstimateDays = firstRetire ? (firstRetire.bucket === '181+' ? 181 : num(firstRetire.bucket.split('-')[0], 0)) : null;
  const top = rows.length ? [...rows].sort((a, b) => b.failureRate - a.failureRate || String(a.key).localeCompare(String(b.key)))[0] : null;
  return { rows, count: rows.length, payloadCount: (payloads || []).length, retirementEstimateDays, top, summary: `Infinity AI charted payload age-versus-failure curves${retirementEstimateDays !== null ? ` with retirement estimated near ${retirementEstimateDays} days` : ' with no retirement threshold reached'}.` };
}
