/**
 * wave81BCores.js — Infinity AI · Dark-Matter · Wave 81B
 * Time-to-first-finding operations plus coverage gap analytics,
 * ideas 53221–53240: authentication methods, incident response,
 * learning curves, benchmark exports, data freshness, celebration
 * triggers, postmortems, satisfaction, coverage gap reports,
 * endpoint heatmaps, parameter matrices, method audits, auth-state
 * splits, feature treemaps, file-type checks, subdomain ledgers,
 * platform compares, versioned APIs, gap severity, and gap-to-
 * finding probability. Every helper takes explicit inputs, never
 * mutates them, and returns structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE81_B_IDEAS = [
  { id: 53221, title: 'TTF by Authentication Method', skip: false },
  { id: 53222, title: 'TTF During Incident Response', skip: false },
  { id: 53223, title: 'TTF Learning Curve per Researcher', skip: false },
  { id: 53224, title: 'TTF Benchmark Export API', skip: false },
  { id: 53225, title: 'TTF by Data Freshness', skip: false },
  { id: 53226, title: 'TTF Celebration Triggers', skip: false },
  { id: 53227, title: 'TTF Postmortem Templates', skip: false },
  { id: 53228, title: 'TTF vs Hunt Satisfaction', skip: false },
  { id: 53229, title: 'Automated Coverage Gap Reports', skip: false },
  { id: 53230, title: 'Endpoint Coverage Heatmaps', skip: false },
  { id: 53231, title: 'Parameter Coverage Matrix', skip: false },
  { id: 53232, title: 'HTTP Method Coverage Audit', skip: false },
  { id: 53233, title: 'Authentication-State Coverage Split', skip: false },
  { id: 53234, title: 'Feature-Area Coverage Treemap', skip: false },
  { id: 53235, title: 'File-Type Coverage Check', skip: false },
  { id: 53236, title: 'Subdomain Coverage Ledger', skip: false },
  { id: 53237, title: 'Mobile-vs-Web Coverage Compare', skip: false },
  { id: 53238, title: 'Versioned-API Coverage', skip: false },
  { id: 53239, title: 'Coverage Gap Severity Weighting', skip: false },
  { id: 53240, title: 'Gap-to-Finding Probability Estimates', skip: false },
];

function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }
function rate(part, whole) { return whole ? round2(part / whole) : 0; }
function findingsOf(h) { return Number(h.validatedFindings ?? h.findings ?? h.findingsCount ?? 0); }
function ttfOf(h) {
  const raw = h.ttfMinutes ?? h.timeToFirstFindingMinutes ?? h.medianTTF ?? h.ttf ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? round2(sorted[mid]) : round2((sorted[mid - 1] + sorted[mid]) / 2);
}
function mean(values) {
  return values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : 0;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round2(sorted[idx]);
}
function pearson(pairs) {
  if (pairs.length < 2) return 0;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let num = 0; let denX = 0; let denY = 0;
  for (const [x, y] of pairs) {
    num += (x - meanX) * (y - meanY);
    denX += (x - meanX) ** 2;
    denY += (y - meanY) ** 2;
  }
  const den = Math.sqrt(denX * denY);
  return den ? round2(num / den) : 0;
}
function medianTTFByGroup(hunts, keyFn) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = keyFn(h);
    if (!key) continue;
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || { key, hunts: 0, values: [], findings: 0 };
    g.hunts += 1;
    g.values.push(ttf);
    g.findings += findingsOf(h);
    groups.set(key, g);
  }
  return [...groups.values()].map(g => ({ key: g.key, hunts: g.hunts, sampleSize: g.values.length, medianTTF: median(g.values), meanTTF: mean(g.values), findings: g.findings, findingsPerHunt: g.hunts ? round2(g.findings / g.hunts) : 0 })).sort((a, b) => a.medianTTF - b.medianTTF || b.hunts - a.hunts || String(a.key).localeCompare(String(b.key)));
}
function coverageOf(item) {
  const raw = item.coverage ?? item.coveragePct ?? item.depth ?? null;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Compare time to first finding by authentication method (idea 53221). */
export function analyzeTTFByAuthMethod(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => h.authMethod || h.authenticationMethod || null);
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, best: rows[0] || null, summary: `Infinity AI compared TTF across ${rows.length} authentication method(s).` };
}

/** Benchmark hunts run under incident pressure versus routine hunts (idea 53222). */
export function analyzeTTFDuringIncidentResponse(hunts = [], options = {}) {
  const incident = [];
  const routine = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    if (h.incident === true || h.duringIncident === true || h.context === 'incident') incident.push(ttf);
    else routine.push(ttf);
  }
  const incidentMedian = median(incident);
  const routineMedian = median(routine);
  return { incidentMedian, routineMedian, incidentCount: incident.length, routineCount: routine.length, count: incident.length + routine.length, delta: round2(incidentMedian - routineMedian), summary: `Infinity AI measured incident-response TTF at ${incidentMedian} minute(s) versus ${routineMedian} routine.` };
}

/** Plot each researcher TTF trend over their first hunts (idea 53223). */
export function buildTTFLearningCurve(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.researcher || h.researcherId || null;
    if (!key) continue;
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push({ index: Number(h.huntIndex ?? h.sequence ?? g.length + 1), ttf });
    groups.set(key, g);
  }
  const cards = [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.index - b.index);
    const first = sorted.length ? sorted[0].ttf : 0;
    const last = sorted.length ? sorted[sorted.length - 1].ttf : 0;
    const values = sorted.map(x => x.ttf);
    const improvement = round2(first - last);
    const improvementPct = first ? rate(improvement, first) : 0;
    return { key, researcher: key, hunts: sorted.length, sampleSize: sorted.length, firstTTF: first, latestTTF: last, medianTTF: median(values), improvement, improvementPct, points: sorted };
  }).sort((a, b) => b.improvement - a.improvement || String(a.key).localeCompare(String(b.key)));
  return { rows: cards, cards, count: cards.length, fastestLearner: cards[0] || null, best: cards[0] || null, top: cards[0] || null, summary: `Infinity AI built learning curves for ${cards.length} researcher(s).` };
}

/** Expose TTF benchmarks as a consumable export payload (idea 53224). */
export function buildTTFBenchmarkExport(hunts = [], options = {}) {
  const format = options.format || 'json';
  const endpoint = options.endpoint || '/api/v1/benchmarks/ttf';
  const values = (hunts || []).map(ttfOf).filter(v => v !== null);
  const benchmarks = medianTTFByGroup(hunts, h => h.strategy || null).map(g => ({ strategy: g.key, medianTTF: g.medianTTF, p90: percentile((hunts || []).filter(h => (h.strategy || null) === g.key).map(ttfOf).filter(v => v !== null), 90), hunts: g.hunts }));
  const payload = { generatedBy: 'Infinity AI', format, endpoint, sampleSize: values.length, median: median(values), p90: percentile(values, 90), benchmarks };
  return { payload, benchmarks, rows: benchmarks, count: benchmarks.length, sampleSize: values.length, format, endpoint, median: payload.median, p90: payload.p90, summary: `Infinity AI exported TTF benchmarks for ${benchmarks.length} strateg(ies) via ${endpoint}.` };
}

/** Check whether fresh targets yield faster first findings (idea 53225). */
export function analyzeTTFByDataFreshness(hunts = [], options = {}) {
  const rows = medianTTFByGroup(hunts, h => {
    if (h.freshness) return String(h.freshness);
    const age = Number(h.dataAgeDays ?? h.snapshotAgeDays ?? NaN);
    if (!Number.isFinite(age)) return null;
    if (age <= 7) return 'fresh';
    if (age <= 30) return 'recent';
    return 'stale';
  });
  return { rows, count: rows.length, fastest: rows[0] || null, slowest: rows[rows.length - 1] || null, summary: `Infinity AI compared TTF across ${rows.length} data-freshness bucket(s).` };
}

/** Flag hunts that beat the tenth-percentile TTF for their class (idea 53226). */
export function detectTTFCelebrationTriggers(hunts = [], options = {}) {
  const groups = new Map();
  for (const h of hunts || []) {
    const key = h.targetClass || h.strategy || 'overall';
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    const g = groups.get(key) || [];
    g.push({ hunt: h, ttf });
    groups.set(key, g);
  }
  const triggers = [];
  for (const [key, list] of groups.entries()) {
    const values = list.map(x => x.ttf);
    const p10 = percentile(values, 10);
    for (const item of list) {
      if (values.length >= 2 && item.ttf <= p10) {
        triggers.push({ key, targetClass: key, target: item.hunt.target || null, ttfMinutes: item.ttf, percentileLine: p10, message: `Infinity AI celebration: hunt beat the 10th-percentile TTF (${p10} minute(s)) for ${key}.` });
      }
    }
  }
  triggers.sort((a, b) => a.ttfMinutes - b.ttfMinutes || String(a.key).localeCompare(String(b.key)));
  return { rows: triggers, triggers, count: (hunts || []).length, triggerCount: triggers.length, summary: `Infinity AI raised ${triggers.length} TTF celebration trigger(s).` };
}

/** Provide structured postmortem templates for missed TTF targets (idea 53227). */
export function buildTTFPostmortemTemplates(hunts = [], options = {}) {
  const target = Number(options.targetMinutes ?? options.ttfTarget ?? 30);
  const templates = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    if (ttf === null) continue;
    if (ttf < target * 2) continue;
    templates.push({ key: h.target || h.strategy || 'hunt', target: h.target || null, strategy: h.strategy || null, ttfMinutes: ttf, targetMinutes: target, missRatio: round2(ttf / target), sections: ['timeline', 'signals-missed', 'stall-points', 'playbook-updates', 'owner-actions'], prompt: `Infinity AI postmortem: TTF ${ttf} minute(s) missed the ${target} minute target by ${round2(ttf / target)}x.` });
  }
  templates.sort((a, b) => b.missRatio - a.missRatio);
  return { rows: templates, templates, count: templates.length, templateCount: templates.length, targetMinutes: target, worst: templates[0] || null, summary: `Infinity AI generated TTF postmortem templates for ${templates.length} hunt(s).` };
}

/** Correlate researcher satisfaction with first-finding speed (idea 53228). */
export function correlateTTFWithSatisfaction(hunts = [], options = {}) {
  const pairs = [];
  for (const h of hunts || []) {
    const ttf = ttfOf(h);
    const satisfaction = Number(h.satisfaction ?? h.satisfactionScore ?? h.huntSatisfaction ?? NaN);
    if (ttf === null || !Number.isFinite(satisfaction)) continue;
    pairs.push([ttf, satisfaction]);
  }
  const correlation = pearson(pairs);
  const direction = correlation > 0.1 ? 'positive' : correlation < -0.1 ? 'negative' : 'flat';
  return { correlation, direction, count: pairs.length, sampleSize: pairs.length, meanTTF: mean(pairs.map(p => p[0])), meanSatisfaction: mean(pairs.map(p => p[1])), summary: `Infinity AI found a ${direction} TTF-to-satisfaction correlation of ${correlation} across ${pairs.length} hunt(s).` };
}

/** List in-scope areas that received little or no testing (idea 53229). */
export function generateCoverageGapReports(reports = [], options = {}) {
  const threshold = Number(options.threshold ?? options.lowCoverageBelow ?? 0.25);
  const rows = [];
  for (const r of reports || []) {
    const areas = r.areas || r.coverageAreas || null;
    if (Array.isArray(areas)) {
      for (const a of areas) {
        const coverage = coverageOf(a);
        const name = a.area || a.name || a.key || null;
        if (!name || coverage === null) continue;
        rows.push({ key: `${r.target || r.key || 'target'}:${name}`, target: r.target || r.key || null, area: name, coverage, gap: round2(1 - coverage), requests: Number(a.requests ?? 0) });
      }
    } else {
      const coverage = coverageOf(r);
      const name = r.area || r.name || r.key || null;
      if (!name || coverage === null) continue;
      rows.push({ key: name, target: r.target || null, area: name, coverage, gap: round2(1 - coverage), requests: Number(r.requests ?? 0) });
    }
  }
  const gaps = rows.filter(r => r.coverage < threshold).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  return { rows, cards: rows, gaps, count: rows.length, gapCount: gaps.length, threshold, worstGap: gaps[0] || null, top: gaps[0] || null, summary: `Infinity AI reported ${gaps.length} coverage gap(s) below ${threshold} coverage.` };
}

/** Visualize endpoint hit volume and payload diversity (idea 53230). */
export function buildEndpointCoverageHeatmaps(endpoints = [], options = {}) {
  const rows = (endpoints || []).map(e => {
    const hits = Number(e.hits ?? e.requests ?? e.requestCount ?? 0);
    const diversity = Number(e.payloadDiversity ?? e.uniquePayloads ?? e.payloads ?? 0);
    const heat = hits >= 50 ? 'hot' : hits >= 10 ? 'warm' : hits > 0 ? 'cool' : 'cold';
    return { key: e.endpoint || e.path || e.key || 'endpoint', endpoint: e.endpoint || e.path || e.key || 'endpoint', hits, payloadDiversity: diversity, findings: Number(e.findings ?? 0), heat };
  }).sort((a, b) => b.hits - a.hits || b.payloadDiversity - a.payloadDiversity || String(a.key).localeCompare(String(b.key)));
  const cold = rows.filter(r => r.heat === 'cold');
  return { rows, count: rows.length, hottest: rows[0] || null, top: rows[0] || null, coldCount: cold.length, cold, summary: `Infinity AI heatmapped ${rows.length} endpoint(s); ${cold.length} received no traffic.` };
}

/** Show which parameters were exercised versus left untouched (idea 53231). */
export function buildParameterCoverageMatrix(params = [], options = {}) {
  const rows = (params || []).map(p => {
    const exercised = p.fuzzed === true || p.tested === true || Number(p.tests ?? p.attempts ?? 0) > 0;
    return { key: p.parameter || p.param || p.name || p.key || 'param', parameter: p.parameter || p.param || p.name || p.key || 'param', endpoint: p.endpoint || p.path || null, tested: exercised, fuzzed: exercised, tests: Number(p.tests ?? p.attempts ?? (exercised ? 1 : 0)), findings: Number(p.findings ?? 0) };
  }).sort((a, b) => Number(a.tested) - Number(b.tested) || String(a.key).localeCompare(String(b.key)));
  const untouched = rows.filter(r => !r.tested);
  return { rows, matrix: rows, count: rows.length, testedCount: rows.length - untouched.length, untouchedCount: untouched.length, untouched, coverageRate: rate(rows.length - untouched.length, rows.length), summary: `Infinity AI mapped parameter coverage: ${untouched.length} of ${rows.length} parameter(s) untouched.` };
}

/** Flag endpoints tested with only one HTTP method (idea 53232). */
export function auditHTTPMethodCoverage(endpoints = [], options = {}) {
  const rows = (endpoints || []).map(e => {
    const supported = Array.isArray(e.methods) ? e.methods.map(m => String(m).toUpperCase()) : Array.isArray(e.supportedMethods) ? e.supportedMethods.map(m => String(m).toUpperCase()) : [];
    const tested = Array.isArray(e.testedMethods) ? e.testedMethods.map(m => String(m).toUpperCase()) : Array.isArray(e.methodsTested) ? e.methodsTested.map(m => String(m).toUpperCase()) : [];
    const missing = supported.filter(m => !tested.includes(m));
    return { key: e.endpoint || e.path || e.key || 'endpoint', endpoint: e.endpoint || e.path || e.key || 'endpoint', supported, tested, missing, gap: missing.length > 0 };
  }).sort((a, b) => b.missing.length - a.missing.length || String(a.key).localeCompare(String(b.key)));
  const flagged = rows.filter(r => r.gap);
  return { rows, count: rows.length, flagged, flaggedCount: flagged.length, worst: rows[0] || null, summary: `Infinity AI flagged ${flagged.length} endpoint(s) with untested HTTP methods.` };
}

/** Report coverage separately per authentication state (idea 53233). */
export function splitCoverageByAuthState(records = [], options = {}) {
  const groups = new Map();
  for (const r of records || []) {
    const key = r.authState || r.authenticationState || r.state || null;
    if (!key) continue;
    const coverage = coverageOf(r);
    const g = groups.get(key) || { key, areas: 0, coverageSum: 0, requests: 0, tested: 0 };
    g.areas += 1;
    if (coverage !== null) g.coverageSum += coverage;
    if (Number(r.requests ?? 0) > 0 || coverage !== null && coverage > 0) g.tested += 1;
    g.requests += Number(r.requests ?? 0);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, areas: g.areas, testedAreas: g.tested, avgCoverage: g.areas ? round2(g.coverageSum / g.areas) : 0, requests: g.requests, coverageRate: rate(g.tested, g.areas) })).sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, weakest: rows[0] || null, strongest: rows[rows.length - 1] || null, summary: `Infinity AI split coverage across ${rows.length} authentication state(s).` };
}

/** Break the target into feature areas with testing depth (idea 53234). */
export function buildFeatureAreaCoverageTreemap(features = [], options = {}) {
  const cells = (features || []).map(f => {
    const size = Number(f.endpoints ?? f.size ?? f.weight ?? 1);
    const coverage = coverageOf(f) ?? 0;
    return { key: f.area || f.feature || f.name || f.key || 'area', area: f.area || f.feature || f.name || f.key || 'area', size, coverage, depth: round2(size * coverage), requests: Number(f.requests ?? 0), findings: Number(f.findings ?? 0) };
  }).sort((a, b) => b.size - a.size || a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const totalSize = cells.reduce((s, c) => s + c.size, 0);
  const weighted = totalSize ? round2(cells.reduce((s, c) => s + c.size * c.coverage, 0) / totalSize) : 0;
  return { rows: cells, cells, count: cells.length, largest: cells[0] || null, top: cells[0] || null, weightedCoverage: weighted, summary: `Infinity AI treemapped ${cells.length} feature area(s) at weighted coverage ${weighted}.` };
}

/** Identify untested file types in scope (idea 53235). */
export function checkFileTypeCoverage(files = [], options = {}) {
  const rows = (files || []).map(f => {
    const tested = f.tested === true || Number(f.uploads ?? f.tests ?? f.requests ?? 0) > 0;
    return { key: f.fileType || f.type || f.extension || f.key || 'file', fileType: f.fileType || f.type || f.extension || f.key || 'file', tested, requests: Number(f.requests ?? f.tests ?? f.uploads ?? 0), findings: Number(f.findings ?? 0) };
  }).sort((a, b) => Number(a.tested) - Number(b.tested) || String(a.key).localeCompare(String(b.key)));
  const untested = rows.filter(r => !r.tested);
  return { rows, count: rows.length, untested, untestedCount: untested.length, testedCount: rows.length - untested.length, summary: `Infinity AI found ${untested.length} untested file type(s) in scope.` };
}

/** List in-scope subdomains with request counts (idea 53236). */
export function buildSubdomainCoverageLedger(subdomains = [], options = {}) {
  const rows = (subdomains || []).map(s => {
    const requests = Number(s.requests ?? s.requestCount ?? s.hits ?? 0);
    return { key: s.subdomain || s.host || s.key || 'host', subdomain: s.subdomain || s.host || s.key || 'host', requests, findings: Number(s.findings ?? 0), tested: requests > 0, inScope: s.inScope !== false };
  }).sort((a, b) => a.requests - b.requests || String(a.key).localeCompare(String(b.key)));
  const missed = rows.filter(r => r.inScope && !r.tested);
  return { rows, count: rows.length, missed, missedCount: missed.length, testedCount: rows.filter(r => r.tested).length, summary: `Infinity AI ledgered ${rows.length} subdomain(s); ${missed.length} in-scope host(s) missed.` };
}

/** Compare coverage depth across mobile and web platforms (idea 53237). */
export function compareMobileVsWebCoverage(records = [], options = {}) {
  const groups = new Map();
  for (const r of records || []) {
    const key = r.platform || null;
    if (!key) continue;
    const coverage = coverageOf(r);
    const g = groups.get(key) || { key, areas: 0, coverageSum: 0, requests: 0, findings: 0 };
    g.areas += 1;
    if (coverage !== null) g.coverageSum += coverage;
    g.requests += Number(r.requests ?? 0);
    g.findings += findingsOf(r);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, areas: g.areas, avgCoverage: g.areas ? round2(g.coverageSum / g.areas) : 0, requests: g.requests, findings: g.findings })).sort((a, b) => b.avgCoverage - a.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
  const mobile = byKey.mobile || null;
  const web = byKey.web || null;
  return { rows, count: rows.length, mobile, web, leader: rows[0] || null, top: rows[0] || null, delta: mobile && web ? round2(web.avgCoverage - mobile.avgCoverage) : 0, summary: `Infinity AI compared coverage across ${rows.length} platform(s).` };
}

/** Flag older API versions that received no traffic (idea 53238). */
export function auditVersionedAPICoverage(endpoints = [], options = {}) {
  const groups = new Map();
  for (const e of endpoints || []) {
    const version = e.version || e.apiVersion || null;
    if (!version) continue;
    const g = groups.get(version) || { key: version, endpoints: 0, requests: 0, testedEndpoints: 0 };
    g.endpoints += 1;
    const requests = Number(e.requests ?? e.hits ?? 0);
    g.requests += requests;
    if (requests > 0) g.testedEndpoints += 1;
    groups.set(version, g);
  }
  const rows = [...groups.values()].map(g => ({ ...g, coverageRate: rate(g.testedEndpoints, g.endpoints), neglected: g.requests === 0 })).sort((a, b) => a.requests - b.requests || String(a.key).localeCompare(String(b.key)));
  const neglected = rows.filter(r => r.neglected);
  return { rows, count: rows.length, neglected, neglectedCount: neglected.length, worst: rows[0] || null, summary: `Infinity AI flagged ${neglected.length} neglected API version(s).` };
}

/** Rank gaps by business criticality of the untested area (idea 53239). */
export function weightCoverageGapSeverity(gaps = [], options = {}) {
  const rows = (gaps || []).map(g => {
    const coverage = coverageOf(g) ?? 0;
    const criticality = Number(g.criticality ?? g.businessCriticality ?? 3);
    const size = Number(g.size ?? g.endpoints ?? 1);
    const severityScore = round2((1 - coverage) * criticality * size);
    const severity = severityScore >= 20 ? 'critical' : severityScore >= 10 ? 'high' : severityScore >= 4 ? 'medium' : 'low';
    return { key: g.area || g.key || g.name || 'gap', area: g.area || g.key || g.name || 'gap', coverage, criticality, size, severityScore, severity };
  }).sort((a, b) => b.severityScore - a.severityScore || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, mostSevere: rows[0] || null, top: rows[0] || null, best: rows[0] || null, summary: `Infinity AI weighted ${rows.length} coverage gap(s) by business severity.` };
}

/** Estimate the likelihood each gap hides a finding (idea 53240). */
export function estimateGapToFindingProbability(gaps = [], options = {}) {
  const baseline = Number(options.baselineRate ?? options.baseRate ?? 0.12);
  const rows = (gaps || []).map(g => {
    const history = Number(g.historicalFindings ?? g.pastFindings ?? NaN);
    const pastGaps = Number(g.historicalGaps ?? g.pastGaps ?? NaN);
    const historicalRate = Number.isFinite(history) && Number.isFinite(pastGaps) && pastGaps > 0 ? round2(history / pastGaps) : null;
    const coverage = coverageOf(g) ?? 0;
    const criticality = Number(g.criticality ?? g.businessCriticality ?? 3);
    const raw = (historicalRate !== null ? historicalRate : baseline) * (1 - coverage) * (0.7 + criticality * 0.1);
    const probability = Math.min(0.95, Math.max(0, round2(raw)));
    const band = probability >= 0.5 ? 'likely' : probability >= 0.25 ? 'possible' : 'unlikely';
    return { key: g.area || g.key || g.name || 'gap', area: g.area || g.key || g.name || 'gap', coverage, criticality, historicalRate, probability, band };
  }).sort((a, b) => b.probability - a.probability || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, mostLikely: rows[0] || null, top: rows[0] || null, best: rows[0] || null, baselineRate: baseline, summary: `Infinity AI estimated finding probability for ${rows.length} coverage gap(s).` };
}
