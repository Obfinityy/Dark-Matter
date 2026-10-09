/**
 * wave77ACore.js — Infinity AI · Dark-Matter · Wave 77A
 * Hunt-learning analytics round 2, ideas 53041–53060.
 * Pure logic for baseline deviation, discovery funnel, inter-finding
 * lag, hypothesis hit rate, confirmation cost, cross-target pattern
 * match, report readiness, missed-obvious audit, technique novelty,
 * context-switch cost, evidence chain completeness, stealth
 * efficiency, resource burn rate, intel utilization, threshold
 * tuning log, dead-end recovery, confirmation bias, finding
 * freshness, hunt signature fingerprint, and what-worked digest.
 * Every helper takes explicit inputs, returns a structured view
 * model, and never mutates arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE77_A_IDEAS = [
  { id: 53041, title: 'Baseline Deviation Alert', skip: false },
  { id: 53042, title: 'Discovery Funnel Visualization', skip: false },
  { id: 53043, title: 'Inter-Finding Lag Analysis', skip: false },
  { id: 53044, title: 'Hypothesis Hit Rate', skip: false },
  { id: 53045, title: 'Confirmation Cost Tracking', skip: false },
  { id: 53046, title: 'Cross-Target Pattern Match', skip: false },
  { id: 53047, title: 'Report-Readiness Score', skip: false },
  { id: 53048, title: 'Missed-Obvious Audit', skip: false },
  { id: 53049, title: 'Technique Novelty Bonus', skip: false },
  { id: 53050, title: 'Context-Switch Cost', skip: false },
  { id: 53051, title: 'Evidence Chain Completeness', skip: false },
  { id: 53052, title: 'Stealth Efficiency Rating', skip: false },
  { id: 53053, title: 'Resource Burn Rate', skip: false },
  { id: 53054, title: 'Pre-Hunt Intel Utilization', skip: false },
  { id: 53055, title: 'Adaptive Threshold Tuning Log', skip: false },
  { id: 53056, title: 'Dead-End Recovery Time', skip: false },
  { id: 53057, title: 'Confirmation Bias Check', skip: false },
  { id: 53058, title: 'Finding Freshness Score', skip: false },
  { id: 53059, title: 'Hunt Signature Fingerprint', skip: false },
  { id: 53060, title: 'What-Worked Digest Email', skip: false },
];

function pct(part, whole) { return whole ? Math.round((part / whole) * 1000) / 10 : 0; }
function rate(part, whole) { return whole ? Math.round((part / whole) * 100) / 100 : 0; }

/** Compare a hunt outcome against its target-class baseline (idea 53041). */
export function alertBaselineDeviation(hunt = {}, baseline = {}, options = {}) {
  const thresholdPct = Number(options.thresholdPct || 50);
  const metrics = ['findings', 'verified', 'requests'];
  const rows = metrics.map(m => {
    const actual = Number(hunt[m] || 0);
    const avg = Number(baseline[m] || 0);
    const deviationPct = avg ? Math.round(((actual - avg) / avg) * 100) : (actual > 0 ? 100 : 0);
    const flagged = Math.abs(deviationPct) >= thresholdPct;
    return { metric: m, actual, baselineAvg: avg, deviationPct, flagged, direction: deviationPct > 0 ? 'over' : deviationPct < 0 ? 'under' : 'flat' };
  });
  const flagged = rows.filter(r => r.flagged);
  return { huntId: hunt.huntId || hunt.id || null, targetClass: hunt.targetClass || baseline.targetClass || null, rows, flaggedCount: flagged.length, worst: flagged.slice().sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))[0] || null, summary: `Infinity AI flagged ${flagged.length} baseline deviation(s) for ${hunt.huntId || 'the hunt'} at a ${thresholdPct}% threshold.` };
}

/** Build the probed-to-validated discovery funnel (idea 53042). */
export function buildDiscoveryFunnel(phases = [], options = {}) {
  const rows = (phases || []).map(p => ({ phase: p.phase || p.name || 'phase', probed: Number(p.probed || 0), anomalies: Number(p.anomalies || 0), validated: Number(p.validated || 0) })).map(r => ({ ...r, anomalyRate: rate(r.anomalies, r.probed), validationRate: rate(r.validated, r.anomalies) }));
  const totals = rows.reduce((t, r) => ({ probed: t.probed + r.probed, anomalies: t.anomalies + r.anomalies, validated: t.validated + r.validated }), { probed: 0, anomalies: 0, validated: 0 });
  return { rows, count: rows.length, totals, overallValidationRate: rate(totals.validated, totals.probed), summary: `Infinity AI funnel: ${totals.probed} probed, ${totals.anomalies} anomalies, ${totals.validated} validated across ${rows.length} phase(s).` };
}

/** Measure gaps between consecutive findings (idea 53043). */
export function analyzeInterFindingLag(findings = [], options = {}) {
  const stuckMinutes = Number(options.stuckMinutes || 20);
  const times = (findings || []).map(f => Date.parse(f.at || f.foundAt || '')).filter(Number.isFinite).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(Math.round((times[i] - times[i - 1]) / 60000));
  const maxGapMinutes = gaps.length ? Math.max(...gaps) : 0;
  const avgGapMinutes = gaps.length ? Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10 : 0;
  const stuckCount = gaps.filter(g => g >= stuckMinutes).length;
  return { gapsMinutes: gaps, gapCount: gaps.length, maxGapMinutes, avgGapMinutes, stuckCount, stuck: stuckCount > 0, summary: `Infinity AI measured ${gaps.length} inter-finding gap(s); longest ${maxGapMinutes} minute(s), ${stuckCount} stuck window(s).` };
}

/** Score how often mid-hunt hypotheses were confirmed (idea 53044). */
export function scoreHypothesisHitRate(hypotheses = [], options = {}) {
  const rows = (hypotheses || []).map(h => ({ hypothesisId: h.id || h.hypothesisId || null, text: h.text || 'Hypothesis', status: h.confirmed === true ? 'confirmed' : h.refuted === true ? 'refuted' : 'open' }));
  const decided = rows.filter(r => r.status !== 'open');
  const confirmed = rows.filter(r => r.status === 'confirmed').length;
  return { rows, count: rows.length, decidedCount: decided.length, confirmedCount: confirmed, hitRate: rate(confirmed, decided.length), summary: `Infinity AI hypothesis hit rate is ${rate(confirmed, decided.length)} (${confirmed}/${decided.length} decided).` };
}

/** Track requests spent confirming each finding (idea 53045). */
export function trackConfirmationCost(findings = [], options = {}) {
  const expensiveThreshold = Number(options.expensiveRequests || 25);
  const rows = (findings || []).map(f => ({ findingId: f.id || f.findingId || null, title: f.title || 'Finding', requests: Number(f.confirmRequests || f.requests || 0), confirmed: f.confirmed !== false })).map(r => ({ ...r, expensive: r.requests >= expensiveThreshold })).sort((a, b) => b.requests - a.requests);
  const totalRequests = rows.reduce((s, r) => s + r.requests, 0);
  return { rows, count: rows.length, totalRequests, avgRequests: rows.length ? Math.round((totalRequests / rows.length) * 10) / 10 : 0, expensiveCount: rows.filter(r => r.expensive).length, costliest: rows[0] || null, summary: `Infinity AI spent ${totalRequests} confirmation request(s) across ${rows.length} finding(s).` };
}

/** Match findings against patterns from earlier hunts (idea 53046). */
export function matchCrossTargetPatterns(findings = [], history = [], options = {}) {
  const known = new Map((history || []).map(h => [String(h.signature || h.pattern || ''), h]));
  const rows = (findings || []).map(f => {
    const sig = String(f.signature || f.pattern || '');
    const hit = sig ? known.get(sig) : undefined;
    return { findingId: f.id || f.findingId || null, signature: sig || null, matched: Boolean(hit), priorHuntId: hit ? (hit.huntId || hit.id || null) : null, priorTarget: hit ? (hit.target || null) : null };
  });
  const matched = rows.filter(r => r.matched);
  return { rows, count: rows.length, matchedCount: matched.length, matchRate: rate(matched.length, rows.length), summary: `Infinity AI matched ${matched.length} of ${rows.length} finding(s) to cross-target patterns.` };
}

/** Score how report-ready each finding already is (idea 53047). */
export function scoreReportReadiness(findings = [], options = {}) {
  const rows = (findings || []).map(f => {
    const checks = [Boolean(f.request), Boolean(f.response), Boolean(f.impact), Boolean(f.reproSteps || f.steps)];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { findingId: f.id || f.findingId || null, title: f.title || 'Finding', score, ready: score >= 100, missing: ['request', 'response', 'impact', 'repro steps'].filter((_, i) => !checks[i]) };
  }).sort((a, b) => a.score - b.score);
  const readyCount = rows.filter(r => r.ready).length;
  return { rows, count: rows.length, readyCount, avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0, leastReady: rows[0] || null, summary: `Infinity AI report-readiness: ${readyCount}/${rows.length} finding(s) fully ready.` };
}

/** Audit high-signal areas the hunt barely touched (idea 53048). */
export function auditMissedObvious(areas = [], options = {}) {
  const maxCoverage = Number(options.maxCoveragePct || 25);
  const rows = (areas || []).map(a => ({ areaId: a.id || a.areaId || null, name: a.name || 'Area', coveragePct: Number(a.coveragePct || 0), expertLikelihood: Number(a.expertLikelihood || a.likelihood || 0) })).filter(a => a.coveragePct <= maxCoverage).sort((a, b) => b.expertLikelihood - a.expertLikelihood || a.coveragePct - b.coveragePct);
  return { rows, count: rows.length, topMiss: rows[0] || null, summary: `Infinity AI flagged ${rows.length} missed-obvious area(s) at or below ${maxCoverage}% coverage.` };
}

/** Credit novel or adapted techniques over replays (idea 53049). */
export function scoreTechniqueNovelty(techniques = [], options = {}) {
  const rows = (techniques || []).map(t => ({ techniqueId: t.id || t.techniqueId || null, name: t.name || 'Technique', mode: t.novel === true ? 'novel' : t.adapted === true ? 'adapted' : 'replayed', findings: Number(t.findings || 0) })).map(r => ({ ...r, bonus: r.mode === 'novel' ? 10 : r.mode === 'adapted' ? 5 : 0 }));
  const totalBonus = rows.reduce((s, r) => s + r.bonus, 0);
  return { rows, count: rows.length, novelCount: rows.filter(r => r.mode === 'novel').length, adaptedCount: rows.filter(r => r.mode === 'adapted').length, totalBonus, summary: `Infinity AI awarded ${totalBonus} technique novelty bonus point(s) across ${rows.length} technique(s).` };
}

/** Measure the cost of switching between target areas (idea 53050). */
export function measureContextSwitchCost(events = [], options = {}) {
  const sorted = [...(events || [])].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  let switches = 0;
  const blocks = [];
  let current = null;
  for (const e of sorted) {
    const area = e.area || 'unknown';
    if (!current || current.area !== area) { if (current) blocks.push(current); current = { area, events: 0, findings: 0 }; switches += current.events === 0 && blocks.length ? 1 : 0; }
    current.events += 1;
    if (e.type === 'finding') current.findings += 1;
  }
  if (current) blocks.push(current);
  const totalFindings = blocks.reduce((s, b) => s + b.findings, 0);
  return { blocks, blockCount: blocks.length, switchCount: Math.max(0, blocks.length - 1), totalFindings, findingsPerBlock: blocks.length ? Math.round((totalFindings / blocks.length) * 100) / 100 : 0, summary: `Infinity AI counted ${Math.max(0, blocks.length - 1)} context switch(es) across ${blocks.length} focus block(s).` };
}

/** Verify each finding has a complete evidence chain (idea 53051). */
export function checkEvidenceChainCompleteness(findings = [], options = {}) {
  const rows = (findings || []).map(f => {
    const chain = { request: Boolean(f.request), response: Boolean(f.response), impact: Boolean(f.impact) };
    const complete = chain.request && chain.response && chain.impact;
    return { findingId: f.id || f.findingId || null, title: f.title || 'Finding', chain, complete, missingLinks: Object.keys(chain).filter(k => !chain[k]) };
  });
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, completenessRate: rate(completeCount, rows.length), incomplete: rows.filter(r => !r.complete), summary: `Infinity AI verified complete evidence chains for ${completeCount}/${rows.length} finding(s).` };
}

/** Rate stealth efficiency against findings gained (idea 53052). */
export function rateStealthEfficiency(hunt = {}, findings = [], options = {}) {
  const detectionRisk = Math.min(100, Math.max(0, Number(hunt.detectionRisk || 0)));
  const count = (findings || []).length;
  const efficiency = detectionRisk ? Math.round((count / detectionRisk) * 100) / 100 : count;
  const verdict = detectionRisk <= 30 && count >= 3 ? 'efficient' : detectionRisk >= 70 ? 'costly' : 'balanced';
  return { huntId: hunt.huntId || hunt.id || null, findingCount: count, detectionRisk, efficiency, verdict, summary: `Infinity AI stealth efficiency is ${efficiency} finding(s) per risk point (${verdict}).` };
}

/** Track compute and requests spent per finding (idea 53053). */
export function computeResourceBurnRate(hunts = [], options = {}) {
  const rows = (hunts || []).map(h => {
    const findings = Number(h.findings || 0);
    const requests = Number(h.requests || 0);
    const computeMinutes = Number(h.computeMinutes || 0);
    return { huntId: h.huntId || h.id || null, targetClass: h.targetClass || 'general', findings, requests, computeMinutes, requestsPerFinding: findings ? Math.round((requests / findings) * 10) / 10 : 0, minutesPerFinding: findings ? Math.round((computeMinutes / findings) * 10) / 10 : 0 };
  }).sort((a, b) => a.requestsPerFinding - b.requestsPerFinding);
  return { rows, count: rows.length, mostEfficient: rows.filter(r => r.findings > 0)[0] || null, summary: `Infinity AI compared resource burn across ${rows.length} hunt(s).` };
}

/** Measure whether pre-hunt intel changed the plan (idea 53054). */
export function measureIntelUtilization(intelItems = [], planSteps = [], options = {}) {
  const usedIds = new Set((planSteps || []).flatMap(s => s.intelIds || (s.intelId ? [s.intelId] : [])));
  const rows = (intelItems || []).map(i => ({ intelId: i.id || i.intelId || null, kind: i.kind || 'note', used: usedIds.has(i.id || i.intelId), paidOff: i.paidOff === true }));
  const used = rows.filter(r => r.used);
  return { rows, count: rows.length, usedCount: used.length, utilizationRate: rate(used.length, rows.length), payoffCount: used.filter(r => r.paidOff).length, summary: `Infinity AI used ${used.length} of ${rows.length} pre-hunt intel item(s) in the plan.` };
}

/** Log mid-hunt threshold tuning and its precision effect (idea 53055). */
export function logAdaptiveThresholdTuning(adjustments = [], options = {}) {
  const rows = (adjustments || []).map(a => ({ at: a.at || null, detector: a.detector || 'detector', from: Number(a.from || 0), to: Number(a.to || 0), precisionBefore: Number(a.precisionBefore || 0), precisionAfter: Number(a.precisionAfter || 0) })).map(r => ({ ...r, delta: Math.round((r.to - r.from) * 100) / 100, precisionDelta: Math.round((r.precisionAfter - r.precisionBefore) * 100) / 100 })).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const improved = rows.filter(r => r.precisionDelta > 0);
  return { rows, count: rows.length, improvedCount: improved.length, best: rows.slice().sort((a, b) => b.precisionDelta - a.precisionDelta)[0] || null, summary: `Infinity AI logged ${rows.length} threshold adjustment(s); ${improved.length} improved precision.` };
}

/** Measure how fast dead ends were abandoned (idea 53056). */
export function measureDeadEndRecoveryTime(deadEnds = [], options = {}) {
  const rows = (deadEnds || []).map(d => ({ lineId: d.id || d.lineId || null, name: d.name || 'Line', minutesSpent: Number(d.minutesSpent || d.minutes || 0), abandoned: d.abandoned !== false }));
  const times = rows.map(r => r.minutesSpent);
  const avgMinutes = times.length ? Math.round((times.reduce((s, t) => s + t, 0) / times.length) * 10) / 10 : 0;
  return { rows, count: rows.length, avgMinutes, slowest: rows.slice().sort((a, b) => b.minutesSpent - a.minutesSpent)[0] || null, summary: `Infinity AI abandoned ${rows.length} dead end(s) after ${avgMinutes} minute(s) on average.` };
}

/** Check whether favorite theories crowded out other signals (idea 53057). */
export function checkConfirmationBias(hypotheses = [], signals = [], options = {}) {
  const totalTests = (hypotheses || []).reduce((s, h) => s + Number(h.tests || 0), 0);
  const rows = (hypotheses || []).map(h => ({ hypothesisId: h.id || h.hypothesisId || null, text: h.text || 'Hypothesis', tests: Number(h.tests || 0), sharePct: pct(Number(h.tests || 0), totalTests) })).sort((a, b) => b.tests - a.tests);
  const contradictory = (signals || []).filter(s => s.contradicts === true);
  const ignored = contradictory.filter(s => s.addressed !== true);
  const topShare = rows.length ? rows[0].sharePct : 0;
  return { rows, count: rows.length, topSharePct: topShare, biased: topShare >= 60, contradictoryCount: contradictory.length, ignoredCount: ignored.length, summary: `Infinity AI confirmation-bias check: top theory took ${topShare}% of tests, ${ignored.length} contradictory signal(s) ignored.` };
}

/** Score findings as genuinely new versus known variants (idea 53058). */
export function scoreFindingFreshness(findings = [], knownIssues = [], options = {}) {
  const knownSigs = new Set((knownIssues || []).map(k => String(k.signature || k.id || '')));
  const rows = (findings || []).map(f => {
    const sig = String(f.signature || f.id || '');
    const variant = knownSigs.has(sig);
    return { findingId: f.id || f.findingId || null, title: f.title || 'Finding', signature: sig || null, fresh: !variant, classification: variant ? 'variant' : 'new' };
  });
  const fresh = rows.filter(r => r.fresh);
  return { rows, count: rows.length, freshCount: fresh.length, freshnessRate: rate(fresh.length, rows.length), summary: `Infinity AI classified ${fresh.length} of ${rows.length} finding(s) as genuinely new.` };
}

/** Fingerprint a hunt strategy mix for reuse (idea 53059). */
export function fingerprintHuntSignature(hunt = {}, techniques = [], options = {}) {
  const mix = {};
  for (const t of techniques || []) { const k = t.family || t.name || 'general'; mix[k] = (mix[k] || 0) + Number(t.uses || 1); }
  const total = Object.values(mix).reduce((s, v) => s + v, 0);
  const vector = Object.keys(mix).sort().map(k => ({ family: k, sharePct: pct(mix[k], total) }));
  let h = 0; const seed = `${hunt.huntId || hunt.id || 'hunt'}|${vector.map(v => `${v.family}:${v.sharePct}`).join(',')}`;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const fingerprint = `sig-${h.toString(16).padStart(8, '0')}`;
  return { huntId: hunt.huntId || hunt.id || null, fingerprint, vector, dominantFamily: vector.slice().sort((a, b) => b.sharePct - a.sharePct)[0] || null, summary: `Infinity AI hunt signature ${fingerprint} spans ${vector.length} technique family(ies).` };
}

/** Compose the one-page what-worked digest (idea 53060). */
export function composeWhatWorkedDigest(hunt = {}, techniques = [], options = {}) {
  const ranked = (techniques || []).map(t => ({ name: t.name || 'Technique', findings: Number(t.findings || 0), minutes: Number(t.minutes || 0) })).sort((a, b) => b.findings - a.findings).slice(0, 3);
  const lines = ranked.map((t, i) => `${i + 1}. ${t.name} - ${t.findings} finding(s) in ${t.minutes} minute(s)`);
  const subject = `Infinity AI: what worked in ${hunt.huntId || 'your hunt'}`;
  return { huntId: hunt.huntId || hunt.id || null, recipient: options.recipient || hunt.owner || null, subject, topTechniques: ranked, lines, lineCount: lines.length, summary: `Infinity AI composed a ${lines.length}-line what-worked digest for ${hunt.huntId || 'the hunt'}.` };
}
