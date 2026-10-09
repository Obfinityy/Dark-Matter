/**
 * wave82BCores.js — Infinity AI · Wave 82B
 * Coverage intelligence suite, ideas 53261–53280: state-machine
 * coverage, regression alerts, microservice maps, sampling
 * verification, time-boxed targets, root-cause tags, gap closure,
 * tenant fairness, legacy endpoints, content types, confidence,
 * blind-spot mining, bounty multipliers, narrative summaries,
 * coverage-versus-findings scatter, pre-hunt planning, gap aging,
 * coverage API, visualization playground, and coverage-driven
 * scheduling. Every helper takes explicit inputs, never mutates
 * them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE82_B_IDEAS = [
  { id: 53261, title: 'State-Machine Coverage', skip: false },
  { id: 53262, title: 'Coverage Regression Alerts', skip: false },
  { id: 53263, title: 'Microservice Coverage Map', skip: false },
  { id: 53264, title: 'Coverage Sampling Verification', skip: false },
  { id: 53265, title: 'Time-Boxed Coverage Targets', skip: false },
  { id: 53266, title: 'Coverage Gap Root-Cause Tags', skip: false },
  { id: 53267, title: 'Gap Closure Verification', skip: false },
  { id: 53268, title: 'Coverage Fairness Across Tenants', skip: false },
  { id: 53269, title: 'Legacy Endpoint Coverage', skip: false },
  { id: 53270, title: 'Coverage by Content Type (learning)', skip: false },
  { id: 53271, title: 'Coverage Confidence Scores', skip: false },
  { id: 53272, title: 'Blind-Spot Pattern Mining (learning)', skip: false },
  { id: 53273, title: 'Coverage Gap Bounty Multipliers', skip: false },
  { id: 53274, title: 'Coverage Narrative Summaries', skip: false },
  { id: 53275, title: 'Coverage vs Findings Scatter', skip: false },
  { id: 53276, title: 'Pre-Hunt Coverage Planning', skip: false },
  { id: 53277, title: 'Coverage Gap Aging Report', skip: false },
  { id: 53278, title: 'Coverage API for Researchers', skip: false },
  { id: 53279, title: 'Coverage Visualization Playground', skip: false },
  { id: 53280, title: 'Coverage-Driven Hunt Scheduling', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp01(value) { return Math.min(1, Math.max(0, num(value, 0))); }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function mean(values) { return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0; }
function coverageOf(item) {
  const raw = item.coverage ?? item.coveragePct ?? item.testDepth ?? item.depth ?? null;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value > 1 ? clamp01(value / 100) : clamp01(value);
}
function keyOf(item, fallback = 'area') {
  return String(item.key || item.area || item.name || item.endpoint || item.path || item.service || item.tenant || item.id || fallback);
}
function findingsOf(item) { return num(item.validatedFindings ?? item.findings ?? item.findingsCount, 0); }
function pearson(pairs) {
  if (pairs.length < 2) return 0;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let numerator = 0; let denX = 0; let denY = 0;
  for (const [x, y] of pairs) {
    numerator += (x - meanX) * (y - meanY);
    denX += (x - meanX) ** 2;
    denY += (y - meanY) ** 2;
  }
  const denominator = Math.sqrt(denX * denY);
  return denominator ? round2(numerator / denominator) : 0;
}
function groupAverage(records, keyFn, valueFn) {
  const groups = new Map();
  for (const record of records || []) {
    const key = keyFn(record);
    if (!key) continue;
    const value = valueFn(record);
    if (value === null || value === undefined || !Number.isFinite(Number(value))) continue;
    const group = groups.get(key) || { key, count: 0, values: [], requests: 0, findings: 0 };
    group.count += 1;
    group.values.push(Number(value));
    group.requests += num(record.requests ?? record.hits, 0);
    group.findings += findingsOf(record);
    groups.set(key, group);
  }
  return [...groups.values()].map(g => ({ key: g.key, count: g.count, areas: g.count, avgCoverage: mean(g.values), coverage: mean(g.values), requests: g.requests, findings: g.findings }));
}

/** Show which state transitions in multi-step workflows were tested (idea 53261). */
export function auditStateMachineCoverage(workflows = [], options = {}) {
  const rows = (workflows || []).map(workflow => {
    const transitions = Array.isArray(workflow.transitions) ? workflow.transitions : [];
    const total = num(workflow.totalTransitions ?? workflow.transitionCount, transitions.length);
    const tested = num(workflow.testedTransitions ?? workflow.testedCount, Array.isArray(workflow.testedTransitionsList) ? workflow.testedTransitionsList.length : 0);
    const untested = Math.max(0, total - tested);
    return { key: keyOf(workflow, 'workflow'), workflow: keyOf(workflow, 'workflow'), total, tested, untested, coverage: total ? rate(tested, total) : 0, complete: total > 0 && untested === 0 };
  }).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, incompleteCount: rows.filter(r => !r.complete).length, weakest: rows[0] || null, summary: `Infinity AI audited state-machine coverage for ${rows.length} workflow(s); ${rows.filter(r => !r.complete).length} are incomplete.` };
}

/** Alert when a re-hunt covers less than the previous hunt (idea 53262). */
export function detectCoverageRegressionAlerts(hunts = [], options = {}) {
  const dropThreshold = num(options.dropThreshold ?? options.threshold, 0.1);
  const groups = new Map();
  for (const hunt of hunts || []) {
    const key = String(hunt.target || hunt.key || hunt.host || '');
    if (!key) continue;
    const coverage = coverageOf(hunt);
    if (coverage === null) continue;
    const group = groups.get(key) || [];
    group.push({ key, target: key, coverage, at: String(hunt.at || hunt.startedAt || hunt.date || '') });
    groups.set(key, group);
  }
  const alerts = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 1; i < sorted.length; i += 1) {
      const delta = round2(sorted[i].coverage - sorted[i - 1].coverage);
      if (delta <= -dropThreshold) alerts.push({ key: sorted[i].key, target: sorted[i].target, before: sorted[i - 1].coverage, after: sorted[i].coverage, delta, at: sorted[i].at });
    }
  }
  alerts.sort((a, b) => a.delta - b.delta || String(a.key).localeCompare(String(b.key)));
  return { rows: alerts, alerts, count: (hunts || []).length, alertCount: alerts.length, dropThreshold, worst: alerts[0] || null, summary: `Infinity AI raised ${alerts.length} coverage regression alert(s) at a ${dropThreshold} drop threshold.` };
}

/** Map discovered microservices and their individual test depths (idea 53263). */
export function mapMicroserviceCoverage(services = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const rows = (services || []).map(service => {
    const coverage = coverageOf(service) ?? 0;
    return { key: keyOf(service, 'service'), service: keyOf(service, 'service'), coverage, endpoints: num(service.endpoints ?? service.endpointCount, 0), requests: num(service.requests, 0), findings: findingsOf(service), gap: coverage < threshold };
  }).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const gaps = rows.filter(r => r.gap);
  return { rows, count: rows.length, threshold, avgCoverage: mean(rows.map(r => r.coverage)), gapCount: gaps.length, gaps, weakest: rows[0] || null, summary: `Infinity AI mapped ${rows.length} microservice(s) at average coverage ${mean(rows.map(r => r.coverage))}.` };
}

/** Spot-check claimed coverage with independent sampling (idea 53264). */
export function verifyCoverageBySampling(records = [], options = {}) {
  const tolerance = num(options.tolerance, 0.1);
  const rows = (records || []).map(record => {
    const claimed = coverageOf(record) ?? num(record.claimedCoverage, 0);
    const sampledRaw = record.sampledCoverage ?? record.sampleCoverage ?? record.independentCoverage ?? null;
    const sampled = sampledRaw === null || sampledRaw === undefined ? claimed : clamp01(Number(sampledRaw) > 1 ? Number(sampledRaw) / 100 : Number(sampledRaw));
    const diff = round2(sampled - claimed);
    return { key: keyOf(record, 'area'), area: keyOf(record, 'area'), claimed, sampled, diff, honest: Math.abs(diff) <= tolerance, overclaimed: diff < -tolerance };
  }).sort((a, b) => a.diff - b.diff || String(a.key).localeCompare(String(b.key)));
  const overclaimed = rows.filter(r => r.overclaimed);
  return { rows, count: rows.length, tolerance, overclaimed, overclaimedCount: overclaimed.length, honestCount: rows.filter(r => r.honest).length, worst: rows[0] || null, summary: `Infinity AI sampled ${rows.length} coverage claim(s); ${overclaimed.length} appear overclaimed.` };
}

/** Set coverage targets proportional to hunt duration (idea 53265). */
export function buildTimeBoxedCoverageTargets(records = [], options = {}) {
  const durationMinutes = num(options.durationMinutes ?? options.huntMinutes, 120);
  const coveragePerHour = num(options.coveragePerHour ?? options.ratePerHour, 0.1);
  const rows = (records || []).map(record => {
    const current = coverageOf(record) ?? 0;
    const target = clamp01(current + (durationMinutes / 60) * coveragePerHour);
    return { key: keyOf(record, 'area'), area: keyOf(record, 'area'), current, durationMinutes, target, additional: round2(target - current), feasible: target <= 1 };
  }).sort((a, b) => b.additional - a.additional || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, durationMinutes, coveragePerHour, totalAdditional: round2(rows.reduce((s, r) => s + r.additional, 0)), top: rows[0] || null, summary: `Infinity AI set time-boxed coverage targets for ${rows.length} area(s) over ${durationMinutes} minute(s).` };
}

/** Tag each gap with why it happened (idea 53266). */
export function tagCoverageGapRootCauses(gaps = [], options = {}) {
  const rows = (gaps || []).map(gap => {
    let tag = gap.rootCause || gap.cause || null;
    if (!tag) {
      if (gap.authMissing === true || (gap.authRequired === true && gap.hasAuth === false)) tag = 'auth-missing';
      else if (gap.jsWall === true || gap.javascriptWall === true || gap.renderBlocked === true || gap.jsHeavy === true) tag = 'js-wall';
      else if (gap.timeRanOut === true || gap.timeboxExceeded === true) tag = 'time-ran-out';
      else if (gap.deprioritized === true || gap.priority === 'low') tag = 'deprioritized';
      else tag = 'unknown';
    }
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage: coverageOf(gap) ?? 0, tag: String(tag), tags: [String(tag)] };
  }).sort((a, b) => String(a.tag).localeCompare(String(b.tag)) || String(a.key).localeCompare(String(b.key)));
  const counts = {};
  for (const row of rows) counts[row.tag] = (counts[row.tag] || 0) + 1;
  return { rows, count: rows.length, counts, summary: `Infinity AI tagged ${rows.length} coverage gap(s) by root cause.` };
}

/** Confirm in the next hunt that flagged gaps actually got tested (idea 53267). */
export function verifyGapClosure(previousGaps = [], currentRecords = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const currentMap = new Map((currentRecords || []).map(record => [keyOf(record), record]));
  const rows = (previousGaps || []).map(gap => {
    const key = keyOf(gap, 'gap');
    const current = currentMap.get(key);
    const currentCoverage = current ? (coverageOf(current) ?? 0) : 0;
    const tested = current ? (current.tested === true || num(current.requests, 0) > 0 || currentCoverage >= threshold) : false;
    return { key, area: key, previousCoverage: coverageOf(gap) ?? 0, currentCoverage, tested, closed: tested && currentCoverage >= threshold, status: tested && currentCoverage >= threshold ? 'closed' : 'still-open' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.key).localeCompare(String(b.key)));
  const closed = rows.filter(r => r.closed);
  const stillOpen = rows.filter(r => !r.closed);
  return { rows, count: rows.length, closed, closedCount: closed.length, stillOpen, stillOpenCount: stillOpen.length, threshold, summary: `Infinity AI verified ${closed.length} of ${rows.length} flagged gap(s) are now closed.` };
}

/** Check testing spread across tenants, not just the default one (idea 53268). */
export function assessCoverageFairnessAcrossTenants(records = [], options = {}) {
  const rows = groupAverage(records, r => String(r.tenant || r.tenantId || ''), r => coverageOf(r))
    .sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const weakest = rows[0] || null;
  const strongest = rows[rows.length - 1] || null;
  const spread = weakest && strongest ? round2(strongest.avgCoverage - weakest.avgCoverage) : 0;
  return { rows, count: rows.length, weakest, strongest, spread, fair: spread <= num(options.fairSpread ?? options.threshold, 0.2), summary: `Infinity AI checked coverage fairness across ${rows.length} tenant(s); spread is ${spread}.` };
}

/** Inventory deprecated-but-live endpoints hunts tend to skip (idea 53269). */
export function inventoryLegacyEndpointCoverage(endpoints = [], options = {}) {
  const rows = (endpoints || []).map(endpoint => {
    const legacy = endpoint.deprecated === true || endpoint.legacy === true || endpoint.isLegacy === true;
    const coverage = coverageOf(endpoint) ?? (num(endpoint.requests ?? endpoint.hits, 0) > 0 ? 0.5 : 0);
    const tested = endpoint.tested === true || num(endpoint.requests ?? endpoint.hits, 0) > 0 || coverage > 0;
    return { key: keyOf(endpoint, 'endpoint'), endpoint: keyOf(endpoint, 'endpoint'), legacy, deprecated: legacy, coverage, requests: num(endpoint.requests ?? endpoint.hits, 0), tested, missed: legacy && !tested };
  }).sort((a, b) => Number(b.legacy) - Number(a.legacy) || Number(a.tested) - Number(b.tested) || String(a.key).localeCompare(String(b.key)));
  const legacyRows = rows.filter(r => r.legacy);
  const missed = rows.filter(r => r.missed);
  return { rows, count: rows.length, legacyCount: legacyRows.length, legacy: legacyRows, missed, missedCount: missed.length, summary: `Infinity AI inventoried ${legacyRows.length} legacy endpoint(s); ${missed.length} were missed.` };
}

/** Break coverage by JSON, XML, multipart, and GraphQL (idea 53270). */
export function splitCoverageByContentType(records = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const rows = groupAverage(records, r => String(r.contentType || r.type || ''), r => coverageOf(r))
    .sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const blindSpots = rows.filter(r => r.avgCoverage < threshold);
  return { rows, count: rows.length, threshold, blindSpots, blindSpotCount: blindSpots.length, weakest: rows[0] || null, strongest: rows[rows.length - 1] || null, summary: `Infinity AI split coverage across ${rows.length} content type(s); ${blindSpots.length} are blind spots.` };
}

/** Attach confidence to coverage claims by discovery reliability (idea 53271). */
export function scoreCoverageConfidence(records = [], options = {}) {
  const reliability = { manual: 0.95, 'traffic-capture': 0.85, traffic: 0.85, crawler: 0.8, 'js-bundle': 0.7, bundle: 0.7, sitemap: 0.65, guessed: 0.4, inferred: 0.45 };
  const rows = (records || []).map(record => {
    const method = String(record.discoveryMethod || record.method || 'crawler').toLowerCase();
    let confidence = num(reliability[method], 0.5);
    const sampleSize = record.sampleSize === undefined ? null : num(record.sampleSize, 0);
    if (sampleSize !== null && sampleSize < 3) confidence = round2(confidence * 0.7);
    else confidence = round2(confidence);
    return { key: keyOf(record, 'area'), area: keyOf(record, 'area'), coverage: coverageOf(record) ?? 0, method, confidence, band: confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low' };
  }).sort((a, b) => a.confidence - b.confidence || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, lowConfidenceCount: rows.filter(r => r.band === 'low').length, weakest: rows[0] || null, strongest: rows[rows.length - 1] || null, summary: `Infinity AI scored coverage confidence for ${rows.length} claim(s); ${rows.filter(r => r.band === 'low').length} are low confidence.` };
}

/** Mine historical data for systematically under-tested area types (idea 53272). */
export function mineBlindSpotPatterns(records = [], options = {}) {
  const threshold = num(options.threshold, 0.4);
  const rows = groupAverage(records, r => String(r.areaType || r.type || r.category || ''), r => coverageOf(r))
    .map(row => ({ ...row, systematic: row.count >= 2 && row.avgCoverage < threshold }))
    .sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const patterns = rows.filter(r => r.systematic);
  return { rows, count: rows.length, threshold, patterns, patternCount: patterns.length, weakest: rows[0] || null, summary: `Infinity AI mined ${patterns.length} systematic blind-spot pattern(s) across ${rows.length} area type(s).` };
}

/** Suggest higher internal rewards for long-uncovered areas (idea 53273). */
export function suggestCoverageGapBountyMultipliers(gaps = [], options = {}) {
  const baseBounty = num(options.baseBounty ?? options.base, 100);
  const rows = (gaps || []).map(gap => {
    const coverage = coverageOf(gap) ?? 0;
    const ageDays = num(gap.ageDays ?? gap.daysUntested, 0);
    const criticality = num(gap.criticality ?? gap.businessCriticality, 3);
    const multiplier = Math.min(3, round2(1 + (1 - coverage) + Math.min(ageDays, 180) / 180 + criticality * 0.1));
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage, ageDays, criticality, multiplier, suggestedBounty: round2(baseBounty * multiplier) };
  }).sort((a, b) => b.multiplier - a.multiplier || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, baseBounty, top: rows[0] || null, summary: `Infinity AI suggested bounty multipliers for ${rows.length} coverage gap(s); highest is ${rows[0]?.multiplier || 0}x.` };
}

/** Generate a plain-language paragraph of what was and was not tested (idea 53274). */
export function buildCoverageNarrativeSummary(records = [], options = {}) {
  const rows = (records || []).map(record => ({ key: keyOf(record, 'area'), area: keyOf(record, 'area'), coverage: coverageOf(record) ?? 0 }));
  const testedCount = rows.filter(r => r.coverage > 0).length;
  const darkCount = rows.filter(r => r.coverage === 0).length;
  const sorted = [...rows].sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const weakest = sorted[0] || null;
  const strongest = sorted[sorted.length - 1] || null;
  const avgCoverage = mean(rows.map(r => r.coverage));
  const paragraph = `Infinity AI tested ${testedCount} of ${rows.length} area(s) at average coverage ${avgCoverage}; ${darkCount} area(s) stayed dark, the weakest was ${weakest?.key || 'none'} and the strongest was ${strongest?.key || 'none'}.`;
  return { rows, count: rows.length, paragraph, summary: paragraph, narrative: paragraph, avgCoverage, testedCount, darkCount, weakest, strongest };
}

/** Plot coverage against findings across hunts (idea 53275). */
export function buildCoverageVsFindingsScatter(hunts = [], options = {}) {
  const points = (hunts || []).map(hunt => ({ key: String(hunt.target || hunt.key || hunt.host || 'hunt'), target: String(hunt.target || hunt.key || hunt.host || 'hunt'), coverage: coverageOf(hunt) ?? 0, findings: findingsOf(hunt) }))
    .sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const correlation = pearson(points.map(p => [p.coverage, p.findings]));
  const strongest = [...points].sort((a, b) => b.findings - a.findings || String(a.key).localeCompare(String(b.key)))[0] || null;
  return { rows: points, points, count: points.length, correlation, strongest, top: strongest, summary: `Infinity AI plotted coverage versus findings for ${points.length} hunt(s); correlation is ${correlation}.` };
}

/** Use past gap reports to pre-plan the next hunt (idea 53276). */
export function buildPreHuntCoveragePlan(gaps = [], options = {}) {
  const minutesPerArea = num(options.minutesPerArea ?? options.minutes, 30);
  const plan = (gaps || []).map(gap => {
    const coverage = coverageOf(gap) ?? 0;
    const criticality = num(gap.criticality ?? gap.businessCriticality, 3);
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage, criticality, score: round2((1 - coverage) * criticality * 10), minutes: minutesPerArea };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)))
    .map((row, index) => ({ ...row, order: index + 1, etaMinutes: round2((index + 1) * minutesPerArea) }));
  return { rows: plan, plan, count: plan.length, minutesPerArea, totalMinutes: round2(plan.length * minutesPerArea), first: plan[0] || null, top: plan[0] || null, summary: `Infinity AI pre-planned ${plan.length} coverage area(s) for the next hunt in ${round2(plan.length * minutesPerArea)} minute(s).` };
}

/** Show how long each known gap has remained untested (idea 53277). */
export function buildCoverageGapAgingReport(gaps = [], options = {}) {
  const rows = (gaps || []).map(gap => {
    const ageDays = num(gap.ageDays ?? gap.daysUntested ?? gap.age, 0);
    const bucket = ageDays >= 90 ? 'ancient' : ageDays >= 30 ? 'stale' : ageDays >= 7 ? 'aging' : 'fresh';
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage: coverageOf(gap) ?? 0, ageDays, bucket };
  }).sort((a, b) => b.ageDays - a.ageDays || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, oldest: rows[0] || null, staleCount: rows.filter(r => r.ageDays >= 30).length, ancientCount: rows.filter(r => r.bucket === 'ancient').length, summary: `Infinity AI aged ${rows.length} coverage gap(s); oldest is ${rows[0]?.key || 'none'} at ${rows[0]?.ageDays || 0} day(s).` };
}

/** Expose coverage data via an API-shaped payload for researchers (idea 53278). */
export function buildCoverageAPIForResearchers(records = [], options = {}) {
  const endpoint = options.endpoint || '/api/v1/coverage';
  const areas = (records || []).map(record => ({ key: keyOf(record, 'area'), area: keyOf(record, 'area'), coverage: coverageOf(record) ?? 0, dark: (coverageOf(record) ?? 0) === 0, requests: num(record.requests, 0), findings: findingsOf(record) }));
  const darkAreas = areas.filter(a => a.dark);
  const payload = { generatedBy: 'Infinity AI', endpoint, totalAreas: areas.length, darkAreas: darkAreas.length, areas };
  return { payload, rows: areas, areas, count: areas.length, endpoint, query: `GET ${endpoint}?coverage=dark`, darkAreas, darkCount: darkAreas.length, summary: `Infinity AI exposed ${areas.length} coverage area(s) at ${endpoint}; ${darkAreas.length} are dark.` };
}

/** Let researchers explore coverage maps and annotate blind spots (idea 53279). */
export function buildCoverageVisualizationPlayground(records = [], options = {}) {
  const suppliedAnnotations = Array.isArray(options.annotations) ? options.annotations : [];
  const cells = (records || []).map((record, index) => {
    const coverage = coverageOf(record) ?? 0;
    return { key: keyOf(record, 'area'), area: keyOf(record, 'area'), coverage, x: index, band: coverage === 0 ? 'dark' : coverage < 0.75 ? 'partial' : 'covered' };
  });
  const weakest = [...cells].sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)))[0] || null;
  const annotations = suppliedAnnotations.length ? suppliedAnnotations : (weakest ? [{ key: weakest.key, area: weakest.area, note: `Infinity AI suspected blind spot: ${weakest.key} has coverage ${weakest.coverage}.` }] : []);
  return { rows: cells, cells, count: cells.length, annotations, annotationCount: annotations.length, weakest, legend: ['dark', 'partial', 'covered'], summary: `Infinity AI prepared ${cells.length} coverage cell(s) for interactive exploration.` };
}

/** Schedule follow-up hunts when coverage falls below threshold (idea 53280). */
export function scheduleCoverageDrivenFollowUps(records = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const minimumCriticality = num(options.minimumCriticality ?? options.criticality, 3);
  const rows = (records || []).map(record => {
    const coverage = coverageOf(record) ?? 0;
    const criticality = num(record.criticality ?? record.businessCriticality, 3);
    const due = coverage < threshold && criticality >= minimumCriticality;
    const days = coverage === 0 ? 1 : coverage < 0.25 ? 3 : 7;
    return { key: keyOf(record, 'area'), area: keyOf(record, 'area'), coverage, criticality, due, scheduled: due, days: due ? days : null, scheduleInDays: due ? days : null, reason: due ? `Infinity AI: coverage ${coverage} is below ${threshold} on a critical area.` : 'Coverage or criticality does not require a follow-up.' };
  }).sort((a, b) => Number(b.due) - Number(a.due) || a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const schedule = rows.filter(r => r.due);
  return { rows, schedule, count: rows.length, scheduledCount: schedule.length, threshold, next: schedule[0] || null, top: schedule[0] || null, summary: `Infinity AI scheduled ${schedule.length} coverage-driven follow-up hunt(s) below ${threshold} coverage.` };
}
