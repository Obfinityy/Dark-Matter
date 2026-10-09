/**
 * wave76BCores.js — Infinity AI · Dark-Matter · Wave 76B
 * Hunt learning and decision analysis, ideas 53021–53040.
 * Pure logic for coverage correlation, valuable probe, quiet-phase
 * audit, assumption busters, signal density, escalation paths,
 * manual overrides, exploitability conversion, triage accuracy,
 * tool selection, credential quality, scope utilization, environment
 * parity, negative space, best and worst decisions, parameter
 * audit, session sweet spot, parallelism gain, and retry policy.
 * Every helper takes explicit inputs, never mutates them, and
 * returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE76_B_IDEAS = [
  { id: 53021, title: 'Coverage-to-Finding Correlation', skip: false },
  { id: 53022, title: 'Most Valuable Single Probe', skip: false },
  { id: 53023, title: 'Quiet-Phase Audit', skip: false },
  { id: 53024, title: 'Assumption Buster Log', skip: false },
  { id: 53025, title: 'Signal Density Map', skip: false },
  { id: 53026, title: 'Escalation Path Effectiveness', skip: false },
  { id: 53027, title: 'Manual-Override Impact', skip: false },
  { id: 53028, title: 'Exploitability Conversion Rate', skip: false },
  { id: 53029, title: 'Triage Accuracy Review', skip: false },
  { id: 53030, title: 'Tool Selection Scorecard', skip: false },
  { id: 53031, title: 'Credential Quality Effect', skip: false },
  { id: 53032, title: 'Scope Utilization Review', skip: false },
  { id: 53033, title: 'Environment Parity Check', skip: false },
  { id: 53034, title: 'Negative Space Report', skip: false },
  { id: 53035, title: 'Best-Decision Timeline', skip: false },
  { id: 53036, title: 'Worst-Decision Postmortem', skip: false },
  { id: 53037, title: 'Parameter Choice Audit', skip: false },
  { id: 53038, title: 'Session Length Sweet Spot', skip: false },
  { id: 53039, title: 'Parallelism Gain Analysis', skip: false },
  { id: 53040, title: 'Retry Policy Effectiveness', skip: false },
];

function slug(text) {
  return String(text || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'item';
}

/** Correlate coverage levels to finding counts (idea 53021). */
export function correlateCoverageToFindings(areas = [], options = {}) {
  const rows = (areas || []).map(a => ({ areaId: a.id || a.areaId || null, name: a.name || 'Area', coveragePct: Number(a.coveragePct || 0), findings: Number(a.findings || 0) })).sort((a, b) => b.coveragePct - a.coveragePct);
  const n = rows.length;
  let correlation = 0;
  if (n >= 2) {
    const mx = rows.reduce((s, r) => s + r.coveragePct, 0) / n;
    const my = rows.reduce((s, r) => s + r.findings, 0) / n;
    const cov = rows.reduce((s, r) => s + (r.coveragePct - mx) * (r.findings - my), 0);
    const vx = rows.reduce((s, r) => s + (r.coveragePct - mx) ** 2, 0);
    const vy = rows.reduce((s, r) => s + (r.findings - my) ** 2, 0);
    correlation = vx && vy ? Math.round((cov / Math.sqrt(vx * vy)) * 100) / 100 : 0;
  }
  return { rows, count: n, correlation, summary: `Infinity AI coverage-to-finding correlation is ${correlation} across ${n} area(s).` };
}

/** Find the single most valuable probe (idea 53022). */
export function findMostValuableSingleProbe(probes = [], findings = [], options = {}) {
  const scores = (probes || []).map(p => {
    const pid = p.id || p.probeId;
    const mine = (findings || []).filter(f => f.probeId === pid || f.probe === pid);
    const score = mine.reduce((s, f) => s + Number(f.score || 5), 0);
    return { probeId: pid || null, name: p.name || 'Probe', hits: mine.length, score };
  }).sort((a, b) => b.score - a.score || b.hits - a.hits);
  return { scores, count: scores.length, best: scores[0] || null, summary: `Infinity AI most valuable probe is ${scores[0] ? scores[0].probeId : 'none'} (score ${scores[0] ? scores[0].score : 0}).` };
}

/** Audit quiet phases that produced nothing (idea 53023). */
export function auditQuietPhase(phases = [], options = {}) {
  const threshold = Number(options.minMinutes || 15);
  const quiet = (phases || []).filter(p => Number(p.findings || 0) === 0 && Number(p.minutes || 0) >= threshold).map(p => ({ phaseId: p.id || p.phaseId || null, name: p.name || 'Phase', minutes: Number(p.minutes || 0), findings: 0 }));
  const totalQuietMinutes = quiet.reduce((s, q) => s + q.minutes, 0);
  return { quiet, count: quiet.length, totalQuietMinutes, summary: `Infinity AI found ${quiet.length} quiet phase(s) totaling ${totalQuietMinutes} minute(s).` };
}

/** Log assumptions that turned out wrong (idea 53024). */
export function logAssumptionBusters(events = [], assumptions = [], options = {}) {
  const busted = (assumptions || []).filter(a => a.holds === false || a.status === 'busted').map(a => ({ assumptionId: a.id || a.assumptionId || null, text: String(a.text || a.assumption || '').slice(0, 140), evidence: a.evidence || null }));
  const integrated = (events || []).filter(e => e.type === 'assumption-buster').length;
  return { busted, count: busted.length, eventCount: integrated, summary: `Infinity AI logged ${busted.length} busted assumption(s) (${integrated} linked event(s)).` };
}

/** Map signal density across hunt segments (idea 53025). */
export function buildSignalDensityMap(segments = [], options = {}) {
  const tiles = (segments || []).map(s => ({ segmentId: s.id || s.segmentId || null, label: s.label || 'segment', signals: Number(s.signals || 0), probes: Math.max(1, Number(s.probes || 1)) })).map(s => ({ ...s, density: Math.round((s.signals / s.probes) * 100) / 100 })).sort((a, b) => b.density - a.density);
  return { tiles, count: tiles.length, hottest: tiles[0] || null, summary: `Infinity AI signal density peaks at ${tiles[0] ? tiles[0].segmentId : 'none'} (density ${tiles[0] ? tiles[0].density : 0}).` };
}

/** Evaluate how well escalation paths worked (idea 53026). */
export function evaluateEscalationPathEffectiveness(escalations = [], options = {}) {
  const rows = (escalations || []).map(e => ({ pathId: e.id || e.pathId || null, from: e.from || null, to: e.to || null, findings: Number(e.findings || 0), minutes: Number(e.minutes || 0), success: Boolean(e.success) }));
  const successCount = rows.filter(r => r.success).length;
  const rate = rows.length ? Math.round((successCount / rows.length) * 100) / 100 : 0;
  return { rows, count: rows.length, successCount, successRate: rate, summary: `Infinity AI escalation success rate is ${rate} (${successCount}/${rows.length}).` };
}

/** Measure the impact of manual overrides (idea 53027). */
export function measureManualOverrideImpact(overrides = [], findings = [], options = {}) {
  const rows = (overrides || []).map(o => ({ overrideId: o.id || o.overrideId || null, action: String(o.action || 'override').slice(0, 80), findings: Number(o.findings || 0), savedMinutes: Number(o.savedMinutes || 0) }));
  const totalFindings = rows.reduce((s, r) => s + r.findings, 0);
  const totalSaved = rows.reduce((s, r) => s + r.savedMinutes, 0);
  const linkedFindings = (findings || []).filter(f => f.afterOverride === true).length;
  return { overrides: rows, count: rows.length, totalFindings, totalSavedMinutes: totalSaved, linkedFindings, summary: `Infinity AI manual overrides added ${totalFindings} finding(s) and saved ${totalSaved} minute(s).` };
}

/** Compute how many findings become exploitable (idea 53028). */
export function computeExploitabilityConversionRate(findings = [], options = {}) {
  const total = (findings || []).length;
  const exploitable = (findings || []).filter(f => f.exploitable === true || f.status === 'exploitable' || f.exploitability === 'confirmed').length;
  const rate = total ? Math.round((exploitable / total) * 100) / 100 : 0;
  return { total, exploitable, rate, summary: `Infinity AI exploitability conversion is ${rate} (${exploitable}/${total} finding(s)).` };
}

/** Review triage accuracy after final verdicts (idea 53029). */
export function reviewTriageAccuracy(decisions = [], options = {}) {
  const rows = decisions || [];
  const correct = rows.filter(d => d.correct === true || (d.predicted && d.predicted === d.actual)).length;
  const accuracy = rows.length ? Math.round((correct / rows.length) * 100) / 100 : 0;
  const fp = rows.filter(d => d.predicted === 'real' && d.actual === 'false-positive').length;
  const fn = rows.filter(d => d.predicted === 'false-positive' && d.actual === 'real').length;
  return { total: rows.length, correct, accuracy, falsePositiveCalls: fp, falseNegativeCalls: fn, summary: `Infinity AI triage accuracy is ${accuracy} across ${rows.length} decision(s) (fp ${fp}, fn ${fn}).` };
}

/** Score tool selection for a hunt (idea 53030). */
export function scoreToolSelection(tools = [], hunt = {}, options = {}) {
  const rows = (tools || []).map(t => ({ toolId: t.id || t.toolId || null, name: t.name || 'Tool', used: Boolean(t.used), findings: Number(t.findings || 0), minutes: Number(t.minutes || 0) })).map(t => ({ ...t, yieldPerMinute: t.minutes ? Math.round((t.findings / t.minutes) * 100) / 100 : 0 })).sort((a, b) => b.yieldPerMinute - a.yieldPerMinute);
  return { huntId: hunt.huntId || hunt.id || null, rows, count: rows.length, best: rows[0] || null, summary: `Infinity AI tool scorecard for ${hunt.huntId || 'the hunt'}: best is ${rows[0] ? rows[0].toolId : 'none'} (yield ${rows[0] ? rows[0].yieldPerMinute : 0}/min).` };
}

/** Evaluate how credential quality changed results (idea 53031). */
export function evaluateCredentialQualityEffect(attempts = [], options = {}) {
  const scored = (attempts || []).map(a => ({ attemptId: a.id || a.attemptId || null, quality: String(a.quality || 'low').toLowerCase(), findings: Number(a.findings || 0), success: Boolean(a.success) }));
  const high = scored.filter(s => s.quality === 'high');
  const low = scored.filter(s => s.quality !== 'high');
  const avg = arr => arr.length ? Math.round(((arr.reduce((s, x) => s + x.findings, 0) / arr.length) * 10) / 10) : 0;
  const highAvg = avg(high);
  const lowAvg = avg(low);
  const delta = Math.round((highAvg - lowAvg) * 10) / 10;
  return { highAvg, lowAvg, delta, highCount: high.length, lowCount: low.length, summary: `Infinity AI credential quality effect: high ${highAvg} vs low ${lowAvg} (delta ${delta}).` };
}

/** Review how much of the scope was actually used (idea 53032). */
export function reviewScopeUtilization(scope = {}, hunt = {}, options = {}) {
  const include = [...(scope.include || hunt.scope?.include || [])].map(String);
  const visited = [...(hunt.visitedHosts || hunt.coveredHosts || [])].map(String);
  const unused = include.filter(h => !visited.includes(h));
  const used = include.filter(h => visited.includes(h));
  const rate = include.length ? Math.round((used.length / include.length) * 100) / 100 : 0;
  return { includeCount: include.length, visitedCount: visited.length, usedCount: used.length, unused, utilizationRate: rate, summary: `Infinity AI scope utilization is ${rate} (${used.length}/${include.length} host(s) touched).` };
}

/** Check source and target environments match (idea 53033). */
export function checkEnvironmentParity(source = {}, target = {}, options = {}) {
  const keys = ['runtime', 'version', 'region', 'authMode'];
  const diffs = keys.filter(k => String(source[k] || '') !== String(target[k] || '')).map(k => ({ key: k, source: source[k] || null, target: target[k] || null }));
  return { diffs, diffCount: diffs.length, parity: diffs.length === 0, summary: diffs.length ? `Infinity AI environment parity: ${diffs.length} difference(s) (${diffs.map(d => d.key).join(', ')}).` : 'Infinity AI environments are in parity.' };
}

/** Report areas never touched (idea 53034). */
export function buildNegativeSpaceReport(coverage = [], options = {}) {
  const untouched = (coverage || []).filter(c => Number(c.coveragePct || 0) === 0 || c.visited === false).map(c => ({ areaId: c.id || c.areaId || null, name: c.name || 'Area', coveragePct: Number(c.coveragePct || 0) }));
  const touchedCount = (coverage || []).length - untouched.length;
  return { untouched, untouchedCount: untouched.length, touchedCount, total: (coverage || []).length, summary: `Infinity AI negative space: ${untouched.length} untouched area(s) out of ${(coverage || []).length}.` };
}

/** Build the timeline of best decisions (idea 53035). */
export function buildBestDecisionTimeline(decisions = [], options = {}) {
  const ranked = [...(decisions || [])].filter(d => Number(d.impact || 0) > 0).map(d => ({ decisionId: d.id || d.decisionId || null, at: d.at || null, text: String(d.text || d.label || '').slice(0, 120), impact: Number(d.impact || 0) })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const top = [...ranked].sort((a, b) => b.impact - a.impact)[0] || null;
  return { decisions: ranked, count: ranked.length, top, summary: `Infinity AI best-decision timeline holds ${ranked.length} decision(s); top impact ${top ? top.impact : 0}.` };
}

/** Build a postmortem for the worst decision (idea 53036). */
export function buildWorstDecisionPostmortem(decisions = [], options = {}) {
  const ranked = [...(decisions || [])].map(d => ({ decisionId: d.id || d.decisionId || null, at: d.at || null, text: String(d.text || d.label || '').slice(0, 120), impact: Number(d.impact || 0), lesson: String(d.lesson || 'Revisit assumptions before committing.').slice(0, 140) })).sort((a, b) => a.impact - b.impact);
  const worst = ranked[0] || null;
  return { worst, count: ranked.length, summary: worst ? `Infinity AI worst decision postmortem: ${worst.decisionId} (impact ${worst.impact}) — ${worst.lesson}` : 'Infinity AI: no decisions to postmortem.' };
}

/** Audit the parameter choices in probes (idea 53037). */
export function auditParameterChoices(probes = [], options = {}) {
  const rows = (probes || []).map(p => ({ probeId: p.id || p.probeId || null, params: [...(p.params || [])].map(String), findings: Number(p.findings || 0) })).map(p => ({ ...p, paramCount: p.params.length, density: p.params.length ? Math.round((p.findings / p.params.length) * 100) / 100 : 0 }));
  const risky = rows.filter(r => r.paramCount > 8);
  return { rows, count: rows.length, riskyCount: risky.length, summary: `Infinity AI audited ${rows.length} probe(s); ${risky.length} use excessive parameters.` };
}

/** Find the session length where yield peaks (idea 53038). */
export function findSessionLengthSweetSpot(sessions = [], options = {}) {
  const buckets = {};
  for (const s of sessions || []) {
    const bucket = Math.floor(Number(s.minutes || 0) / 30) * 30;
    const key = `${bucket}-${bucket + 29}`;
    if (!buckets[key]) buckets[key] = { bucket: key, lower: bucket, sessions: 0, findings: 0 };
    buckets[key].sessions += 1;
    buckets[key].findings += Number(s.findings || (s.findingsList || []).length || 0);
  }
  const rows = Object.values(buckets).map(b => ({ ...b, yieldPerSession: b.sessions ? Math.round((b.findings / b.sessions) * 10) / 10 : 0 })).sort((a, b) => b.yieldPerSession - a.yieldPerSession);
  return { rows, count: rows.length, sweetSpot: rows[0] || null, summary: `Infinity AI session sweet spot is ${rows[0] ? rows[0].bucket : 'none'} (${rows[0] ? rows[0].yieldPerSession : 0} finding(s) per session).` };
}

/** Analyze gains from running work in parallel (idea 53039). */
export function analyzeParallelismGain(phases = [], options = {}) {
  const serial = (phases || []).filter(p => !p.parallel).reduce((s, p) => s + Number(p.minutes || 0), 0);
  const parallel = (phases || []).filter(p => p.parallel).reduce((s, p) => s + Number(p.minutes || 0), 0);
  const wallClock = Math.max(serial, parallel);
  const sequentialTotal = serial + parallel;
  const gainPct = sequentialTotal ? Math.round((1 - wallClock / sequentialTotal) * 100) : 0;
  return { serialMinutes: serial, parallelMinutes: parallel, wallClockMinutes: wallClock, sequentialTotalMinutes: sequentialTotal, gainPct, summary: `Infinity AI parallelism gain is ${gainPct}% (wall ${wallClock}m vs sequential ${sequentialTotal}m).` };
}

/** Evaluate whether retries helped (idea 53040). */
export function evaluateRetryPolicyEffectiveness(attempts = [], options = {}) {
  const retried = (attempts || []).filter(a => Number(a.retries || 0) > 0);
  const recovered = retried.filter(a => a.success === true || a.recovered === true);
  const rate = retried.length ? Math.round((recovered.length / retried.length) * 100) / 100 : 0;
  const extraMinutes = retried.reduce((s, a) => s + Number(a.extraMinutes || 0), 0);
  return { retriedCount: retried.length, recoveredCount: recovered.length, recoveryRate: rate, extraMinutes, summary: `Infinity AI retry recovery rate is ${rate} (${recovered.length}/${retried.length}, +${extraMinutes}m).` };
}
