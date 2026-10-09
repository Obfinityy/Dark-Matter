/**
 * wave82ACore.js — Infinity AI · Wave 82A
 * Coverage deep-dive analytics, ideas 53241–53260: crawl frontier,
 * forms, JavaScript routes, WebSocket channels, scheduled jobs,
 * admin panels, third-party integrations, upload paths, exports,
 * search depth, pagination, error paths, re-hunt diffs, dark-area
 * queues, coverage debt, minimum gates, weighted estimates,
 * spider traps, auth walls, and role coverage. Every helper takes
 * explicit inputs, never mutates them, and returns structured
 * view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE82_A_IDEAS = [
  { id: 53241, title: 'Crawl Frontier Analysis', skip: false },
  { id: 53242, title: 'Form Coverage Inventory', skip: false },
  { id: 53243, title: 'JavaScript Route Coverage', skip: false },
  { id: 53244, title: 'WebSocket Channel Coverage', skip: false },
  { id: 53245, title: 'Scheduled-Job Surface Review', skip: false },
  { id: 53246, title: 'Admin Panel Coverage Audit', skip: false },
  { id: 53247, title: 'Third-Party Integration Coverage (learning)', skip: false },
  { id: 53248, title: 'File Upload Path Coverage', skip: false },
  { id: 53249, title: 'Export/Report Feature Coverage', skip: false },
  { id: 53250, title: 'Search Feature Depth Audit', skip: false },
  { id: 53251, title: 'Pagination and Sorting Coverage', skip: false },
  { id: 53252, title: 'Error-Path Coverage', skip: false },
  { id: 53253, title: 'Coverage Diff Across Re-Hunts', skip: false },
  { id: 53254, title: 'Dark-Area Prioritization Queue', skip: false },
  { id: 53255, title: 'Coverage Debt Tracking', skip: false },
  { id: 53256, title: 'Minimum Coverage Gates', skip: false },
  { id: 53257, title: 'Coverage-Weighted Finding Estimates', skip: false },
  { id: 53258, title: 'Spider-Trap Avoidance Log', skip: false },
  { id: 53259, title: 'Auth-Wall Penetration Report', skip: false },
  { id: 53260, title: 'Coverage by User Role', skip: false },
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
  return String(item.key || item.area || item.name || item.endpoint || item.path || item.route || item.url || item.id || fallback);
}
function findingsOf(item) { return num(item.validatedFindings ?? item.findings ?? item.findingsCount, 0); }
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

/** Show where the crawler stopped and why (idea 53241). */
export function analyzeCrawlFrontier(entries = [], options = {}) {
  const groups = new Map();
  for (const entry of entries || []) {
    const reason = String(entry.stopReason || entry.reason || (entry.stopped === false ? 'completed' : 'unknown'));
    const group = groups.get(reason) || { key: reason, count: 0, depths: [], requests: 0 };
    group.count += 1;
    group.depths.push(num(entry.depth ?? entry.crawlDepth, 0));
    group.requests += num(entry.requests, 0);
    groups.set(reason, group);
  }
  const rows = [...groups.values()].map(g => ({ key: g.key, count: g.count, share: rate(g.count, (entries || []).length), avgDepth: mean(g.depths), requests: g.requests }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  const stoppedCount = (entries || []).filter(e => String(e.stopReason || e.reason || (e.stopped === false ? 'completed' : 'unknown')) !== 'completed').length;
  return { rows, count: (entries || []).length, stoppedCount, stoppedRate: rate(stoppedCount, (entries || []).length), dominant: rows[0] || null, top: rows[0] || null, summary: `Infinity AI analyzed ${stoppedCount} stopped crawl frontier entr(ies); dominant stop reason ${rows[0]?.key || 'none'}.` };
}

/** List discovered forms with untested input combinations (idea 53242). */
export function inventoryFormCoverage(forms = [], options = {}) {
  const rows = (forms || []).map(form => {
    const total = num(form.totalCombinations ?? form.combinations ?? form.totalCombos, 0);
    const tested = num(form.testedCombinations ?? form.testedCombos ?? form.submissions, 0);
    const untested = Math.max(0, total - tested);
    return { key: keyOf(form, 'form'), form: keyOf(form, 'form'), total, tested, untested, coverage: total ? rate(tested, total) : (tested > 0 ? 1 : 0), complete: untested === 0 && total > 0 };
  }).sort((a, b) => b.untested - a.untested || String(a.key).localeCompare(String(b.key)));
  const totalCombos = rows.reduce((s, r) => s + r.total, 0);
  const testedCombos = rows.reduce((s, r) => s + r.tested, 0);
  return { rows, count: rows.length, totalCombos, testedCombos, untestedCombos: rows.reduce((s, r) => s + r.untested, 0), coverageRate: rate(testedCombos, totalCombos), worst: rows[0] || null, top: rows[0] || null, summary: `Infinity AI inventoried ${rows.length} form(s); ${rows.reduce((s, r) => s + r.untested, 0)} input combination(s) remain untested.` };
}

/** Extract client-side routes and check which were exercised (idea 53243). */
export function auditJSRouteCoverage(routes = [], options = {}) {
  const rows = (routes || []).map(route => {
    const exercised = route.exercised === true || route.tested === true || num(route.requests ?? route.hits, 0) > 0;
    return { key: keyOf(route, 'route'), route: keyOf(route, 'route'), exercised, requests: num(route.requests ?? route.hits, 0), findings: findingsOf(route), source: route.source || route.bundle || null };
  }).sort((a, b) => Number(a.exercised) - Number(b.exercised) || String(a.key).localeCompare(String(b.key)));
  const dark = rows.filter(r => !r.exercised);
  return { rows, count: rows.length, exercisedCount: rows.length - dark.length, darkCount: dark.length, dark, coverageRate: rate(rows.length - dark.length, rows.length), summary: `Infinity AI exercised ${rows.length - dark.length} of ${rows.length} JavaScript route(s).` };
}

/** Inventory WebSocket channels and their test depth (idea 53244). */
export function inventoryWebSocketCoverage(channels = [], options = {}) {
  const rows = (channels || []).map(channel => {
    const messages = num(channel.messagesTested ?? channel.messages ?? channel.testedMessages, 0);
    const total = num(channel.totalMessages ?? channel.messageTypes ?? channel.totalMessageTypes, 0);
    const coverage = coverageOf(channel) ?? (total ? rate(messages, total) : (messages > 0 ? 1 : 0));
    return { key: keyOf(channel, 'channel'), channel: keyOf(channel, 'channel'), messagesTested: messages, totalMessages: total, coverage, subscriptions: num(channel.subscriptions, 0), untested: coverage === 0 || messages === 0 };
  }).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const untested = rows.filter(r => r.untested);
  return { rows, count: rows.length, testedCount: rows.length - untested.length, untestedCount: untested.length, untested, avgCoverage: mean(rows.map(r => r.coverage)), weakest: rows[0] || null, summary: `Infinity AI inventoried ${rows.length} WebSocket channel(s); ${untested.length} remain untested.` };
}

/** Flag scheduled functionality interactive hunting never triggers (idea 53245). */
export function reviewScheduledJobSurface(jobs = [], options = {}) {
  const rows = (jobs || []).map(job => {
    const triggered = job.triggered === true || num(job.runs ?? job.triggerCount, 0) > 0 || Boolean(job.lastTriggeredAt);
    return { key: keyOf(job, 'job'), job: keyOf(job, 'job'), triggered, runs: num(job.runs ?? job.triggerCount, 0), schedule: job.schedule || job.cron || null, flagged: !triggered };
  }).sort((a, b) => Number(a.triggered) - Number(b.triggered) || String(a.key).localeCompare(String(b.key)));
  const flagged = rows.filter(r => r.flagged);
  return { rows, count: rows.length, triggeredCount: rows.length - flagged.length, flaggedCount: flagged.length, flagged, coverageRate: rate(rows.length - flagged.length, rows.length), summary: `Infinity AI reviewed ${rows.length} scheduled-job surface(s); ${flagged.length} were never triggered.` };
}

/** Verify discovered admin interfaces received proportionate testing (idea 53246). */
export function auditAdminPanelCoverage(panels = [], options = {}) {
  const expected = num(options.expectedCoverage ?? options.minimumCoverage, 0.5);
  const rows = (panels || []).map(panel => {
    const coverage = coverageOf(panel) ?? (num(panel.requests, 0) > 0 ? 0.5 : 0);
    return { key: keyOf(panel, 'panel'), panel: keyOf(panel, 'panel'), coverage, requests: num(panel.requests, 0), criticality: num(panel.criticality, 3), underTested: coverage < expected };
  }).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const underTested = rows.filter(r => r.underTested);
  return { rows, count: rows.length, expectedCoverage: expected, avgCoverage: mean(rows.map(r => r.coverage)), underTestedCount: underTested.length, underTested, weakest: rows[0] || null, summary: `Infinity AI audited ${rows.length} admin panel(s); ${underTested.length} fall below ${expected} coverage.` };
}

/** List third-party integrations and their test depth (idea 53247). */
export function auditThirdPartyIntegrationCoverage(integrations = [], options = {}) {
  const threshold = num(options.threshold, 0.5);
  const rows = (integrations || []).map(item => {
    const coverage = coverageOf(item) ?? 0;
    return { key: keyOf(item, 'integration'), integration: keyOf(item, 'integration'), provider: item.provider || item.name || keyOf(item, 'integration'), type: item.type || item.category || 'integration', coverage, criticality: num(item.criticality, 3), gap: coverage < threshold };
  }).sort((a, b) => a.coverage - b.coverage || b.criticality - a.criticality || String(a.key).localeCompare(String(b.key)));
  const gaps = rows.filter(r => r.gap);
  return { rows, count: rows.length, threshold, avgCoverage: mean(rows.map(r => r.coverage)), gapCount: gaps.length, gaps, weakest: rows[0] || null, summary: `Infinity AI checked ${rows.length} third-party integration(s); ${gaps.length} are below ${threshold} test depth.` };
}

/** Map upload vectors and whether harmful-content handling was tested (idea 53248). */
export function mapFileUploadPathCoverage(uploads = [], options = {}) {
  const rows = (uploads || []).map(upload => {
    const maliciousTested = upload.maliciousTested === true || upload.harmfulContentTested === true || num(upload.maliciousTests ?? upload.harmfulTests, 0) > 0;
    const coverage = coverageOf(upload) ?? (num(upload.requests ?? upload.uploads, 0) > 0 ? 0.5 : 0);
    return { key: keyOf(upload, 'upload'), path: keyOf(upload, 'upload'), uploads: num(upload.uploads ?? upload.requests, 0), coverage, maliciousTested, untestedMalicious: !maliciousTested };
  }).sort((a, b) => Number(a.maliciousTested) - Number(b.maliciousTested) || a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const untestedMalicious = rows.filter(r => r.untestedMalicious);
  return { rows, count: rows.length, testedMaliciousCount: rows.length - untestedMalicious.length, untestedMaliciousCount: untestedMalicious.length, untestedMalicious, summary: `Infinity AI mapped ${rows.length} file upload path(s); ${untestedMalicious.length} lack harmful-content testing.` };
}

/** Check data-export features for untested format and filter parameters (idea 53249). */
export function auditExportFeatureCoverage(features = [], options = {}) {
  const rows = (features || []).map(feature => {
    const formats = Array.isArray(feature.formats) ? feature.formats.map(String) : [];
    const testedFormats = Array.isArray(feature.testedFormats ?? feature.formatsTested) ? (feature.testedFormats ?? feature.formatsTested).map(String) : [];
    const missingFormats = formats.filter(f => !testedFormats.includes(f));
    const coverage = coverageOf(feature) ?? (formats.length ? rate(testedFormats.length, formats.length) : (num(feature.requests, 0) > 0 ? 1 : 0));
    return { key: keyOf(feature, 'export'), feature: keyOf(feature, 'export'), formats, testedFormats, missingFormats, coverage, filtersTested: feature.filtersTested === true || num(feature.filtersTestedCount, 0) > 0, gap: missingFormats.length > 0 || coverage < 1 };
  }).sort((a, b) => a.coverage - b.coverage || b.missingFormats.length - a.missingFormats.length || String(a.key).localeCompare(String(b.key)));
  const gaps = rows.filter(r => r.gap);
  return { rows, count: rows.length, gapCount: gaps.length, gaps, weakest: rows[0] || null, summary: `Infinity AI audited ${rows.length} export/report feature(s); ${gaps.length} have format or filter gaps.` };
}

/** Measure whether search endpoints went beyond basic keyword tests (idea 53250). */
export function auditSearchFeatureDepth(endpoints = [], options = {}) {
  const rows = (endpoints || []).map(endpoint => {
    const stages = {
      basic: endpoint.basicTested === true || endpoint.keywordTested === true || num(endpoint.keywordTests, 0) > 0,
      operators: endpoint.operatorTested === true || endpoint.operatorsTested === true || num(endpoint.operatorTests, 0) > 0,
      filters: endpoint.filterTested === true || endpoint.filtersTested === true || num(endpoint.filterTests, 0) > 0,
    };
    const testedStages = Object.values(stages).filter(Boolean).length;
    return { key: keyOf(endpoint, 'search'), endpoint: keyOf(endpoint, 'search'), stages, testedStages, depth: round2(testedStages / 3), shallow: testedStages < 3 };
  }).sort((a, b) => a.depth - b.depth || String(a.key).localeCompare(String(b.key)));
  const shallow = rows.filter(r => r.shallow);
  return { rows, count: rows.length, shallowCount: shallow.length, shallow, deepest: rows[rows.length - 1] || null, weakest: rows[0] || null, summary: `Infinity AI measured search depth on ${rows.length} endpoint(s); ${shallow.length} have not completed operator and filter testing.` };
}

/** Flag list endpoints where pagination, sorting, and filtering went untested (idea 53251). */
export function auditPaginationSortingCoverage(endpoints = [], options = {}) {
  const checks = ['pagination', 'sorting', 'filtering'];
  const rows = (endpoints || []).map(endpoint => {
    const testedParams = Array.isArray(endpoint.testedParams) ? endpoint.testedParams.map(x => String(x).toLowerCase()) : [];
    const state = {
      pagination: endpoint.paginationTested === true || testedParams.includes('pagination') || testedParams.includes('page'),
      sorting: endpoint.sortingTested === true || testedParams.includes('sorting') || testedParams.includes('sort'),
      filtering: endpoint.filteringTested === true || testedParams.includes('filtering') || testedParams.includes('filter'),
    };
    const missing = checks.filter(c => !state[c]);
    return { key: keyOf(endpoint, 'endpoint'), endpoint: keyOf(endpoint, 'endpoint'), state, testedCount: checks.length - missing.length, missing, complete: missing.length === 0 };
  }).sort((a, b) => a.testedCount - b.testedCount || String(a.key).localeCompare(String(b.key)));
  const incomplete = rows.filter(r => !r.complete);
  return { rows, count: rows.length, incompleteCount: incomplete.length, incomplete, summary: `Infinity AI checked pagination and sorting coverage on ${rows.length} list endpoint(s); ${incomplete.length} are incomplete.` };
}

/** Inventory error responses and deliberate error-path probing (idea 53252). */
export function inventoryErrorPathCoverage(records = [], options = {}) {
  const rows = (records || []).map(record => {
    const probed = record.probed === true || record.deliberatelyProbed === true || record.errorPathTested === true || num(record.probes, 0) > 0;
    return { key: String(record.key || record.status || record.statusCode || record.path || 'error'), status: num(record.status ?? record.statusCode, 0), path: record.path || record.endpoint || null, seen: num(record.seen ?? record.count, 1), probed, unprobed: !probed };
  }).sort((a, b) => Number(a.probed) - Number(b.probed) || a.status - b.status || String(a.key).localeCompare(String(b.key)));
  const unprobed = rows.filter(r => r.unprobed);
  return { rows, count: rows.length, probedCount: rows.length - unprobed.length, unprobedCount: unprobed.length, unprobed, summary: `Infinity AI inventoried ${rows.length} error path(s); ${unprobed.length} were seen but not deliberately probed.` };
}

/** Compare coverage between hunts on the same target (idea 53253). */
export function diffCoverageAcrossReHunts(before = [], after = [], options = {}) {
  const beforeMap = new Map((before || []).map(item => [keyOf(item), coverageOf(item) ?? 0]));
  const afterMap = new Map((after || []).map(item => [keyOf(item), coverageOf(item) ?? 0]));
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];
  const rows = keys.map(key => {
    const beforeCoverage = beforeMap.get(key) ?? 0;
    const afterCoverage = afterMap.get(key) ?? 0;
    const delta = round2(afterCoverage - beforeCoverage);
    const status = beforeCoverage === 0 && afterCoverage > 0 ? 'newly-covered' : afterCoverage === 0 ? 'still-dark' : delta < 0 ? 'regressed' : delta > 0 ? 'improved' : 'stable';
    return { key, before: beforeCoverage, after: afterCoverage, delta, status };
  }).sort((a, b) => a.delta - b.delta || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, newlyCovered: rows.filter(r => r.status === 'newly-covered'), newlyCoveredCount: rows.filter(r => r.status === 'newly-covered').length, stillDark: rows.filter(r => r.status === 'still-dark'), stillDarkCount: rows.filter(r => r.status === 'still-dark').length, regressedCount: rows.filter(r => r.status === 'regressed').length, summary: `Infinity AI diffed coverage across ${rows.length} area(s); ${rows.filter(r => r.status === 'newly-covered').length} newly covered and ${rows.filter(r => r.status === 'still-dark').length} still dark.` };
}

/** Turn top coverage gaps into a prioritized queue (idea 53254). */
export function buildDarkAreaPrioritizationQueue(gaps = [], options = {}) {
  const rows = (gaps || []).map(gap => {
    const coverage = coverageOf(gap) ?? 0;
    const criticality = num(gap.criticality ?? gap.businessCriticality, 3);
    const ageDays = num(gap.ageDays ?? gap.daysUntested, 0);
    const score = round2((1 - coverage) * criticality * 10 + ageDays / 10);
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage, criticality, ageDays, score, priority: score >= 40 ? 'urgent' : score >= 25 ? 'high' : score >= 10 ? 'medium' : 'low' };
  }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key)));
  return { rows, queue: rows, count: rows.length, top: rows[0] || null, urgentCount: rows.filter(r => r.priority === 'urgent').length, summary: `Infinity AI queued ${rows.length} dark area(s); top priority is ${rows[0]?.key || 'none'}.` };
}

/** Treat untested areas as accumulating debt with interest (idea 53255). */
export function trackCoverageDebt(gaps = [], options = {}) {
  const dailyInterest = num(options.dailyInterest ?? options.interestRate, 0.01);
  const rows = (gaps || []).map(gap => {
    const coverage = coverageOf(gap) ?? 0;
    const size = num(gap.size ?? gap.endpoints, 1);
    const ageDays = num(gap.ageDays ?? gap.daysUntested, 0);
    const debt = round2((1 - coverage) * size * (1 + ageDays * dailyInterest));
    return { key: keyOf(gap, 'gap'), area: keyOf(gap, 'gap'), coverage, size, ageDays, debt, escalated: ageDays >= 30 && coverage < 0.5 };
  }).sort((a, b) => b.debt - a.debt || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalDebt: round2(rows.reduce((s, r) => s + r.debt, 0)), escalatedCount: rows.filter(r => r.escalated).length, top: rows[0] || null, summary: `Infinity AI tracked coverage debt at ${round2(rows.reduce((s, r) => s + r.debt, 0))} across ${rows.length} gap(s).` };
}

/** Define per-target-class minimum coverage thresholds (idea 53256). */
export function evaluateMinimumCoverageGates(records = [], options = {}) {
  const thresholds = options.thresholds || { web: 0.7, api: 0.8, default: 0.6 };
  const rows = groupAverage(records, r => String(r.targetClass || r.class || r.type || 'default'), r => coverageOf(r))
    .map(row => {
      const threshold = num(thresholds[row.key] ?? thresholds.default, 0.6);
      return { ...row, threshold, pass: row.avgCoverage >= threshold, gap: round2(Math.max(0, threshold - row.avgCoverage)) };
    }).sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const failing = rows.filter(r => !r.pass);
  return { rows, count: rows.length, failing, failingCount: failing.length, passingCount: rows.length - failing.length, summary: `Infinity AI evaluated minimum coverage gates for ${rows.length} target class(es); ${failing.length} fail.` };
}

/** Estimate how many findings untested areas likely contain (idea 53257). */
export function estimateCoverageWeightedFindings(areas = [], options = {}) {
  const defaultRate = num(options.rate ?? options.findingRate, 0.4);
  const rows = (areas || []).map(area => {
    const coverage = coverageOf(area) ?? 0;
    const size = num(area.size ?? area.endpoints, 1);
    const findingRate = num(area.findingRate ?? area.rate, defaultRate);
    const estimate = round2((1 - coverage) * size * findingRate);
    return { key: keyOf(area, 'area'), area: keyOf(area, 'area'), coverage, size, findingRate, estimate };
  }).sort((a, b) => b.estimate - a.estimate || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalEstimate: round2(rows.reduce((s, r) => s + r.estimate, 0)), top: rows[0] || null, summary: `Infinity AI estimated ${round2(rows.reduce((s, r) => s + r.estimate, 0))} likely finding(s) in untested areas.` };
}

/** Record where crawlers got stuck in traps (idea 53258). */
export function buildSpiderTrapAvoidanceLog(entries = [], options = {}) {
  const groups = new Map();
  for (const entry of entries || []) {
    const key = String(entry.trapType || entry.type || entry.reason || keyOf(entry, 'trap'));
    const group = groups.get(key) || { key, encounters: 0, wastedMinutes: 0, urls: [] };
    group.encounters += num(entry.encounters ?? entry.count, 1);
    group.wastedMinutes += num(entry.timeWastedMinutes ?? entry.wastedMinutes ?? entry.minutesWasted, 0);
    if (entry.url || entry.path) group.urls.push(String(entry.url || entry.path));
    groups.set(key, group);
  }
  const rows = [...groups.values()].map(g => ({ ...g, wastedMinutes: round2(g.wastedMinutes), skipRule: `skip:${g.key}` }))
    .sort((a, b) => b.wastedMinutes - a.wastedMinutes || b.encounters - a.encounters || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalWastedMinutes: round2(rows.reduce((s, r) => s + r.wastedMinutes, 0)), top: rows[0] || null, worst: rows[0] || null, summary: `Infinity AI logged ${rows.length} spider-trap type(s) wasting ${round2(rows.reduce((s, r) => s + r.wastedMinutes, 0))} minute(s).` };
}

/** Document authenticated areas seen but never effectively tested (idea 53259). */
export function buildAuthWallPenetrationReport(areas = [], options = {}) {
  const threshold = num(options.effectiveCoverage ?? options.threshold, 0.2);
  const rows = (areas || []).map(area => {
    const coverage = coverageOf(area) ?? 0;
    const visible = area.visible !== false && area.seen !== false;
    return { key: keyOf(area, 'area'), area: keyOf(area, 'area'), coverage, visible, authenticated: area.authenticated !== false, effective: visible && coverage >= threshold, unpenetrated: visible && coverage < threshold };
  }).sort((a, b) => a.coverage - b.coverage || String(a.key).localeCompare(String(b.key)));
  const unpenetrated = rows.filter(r => r.unpenetrated);
  return { rows, count: rows.length, threshold, unpenetrated, unpenetratedCount: unpenetrated.length, effectiveCount: rows.filter(r => r.effective).length, summary: `Infinity AI found ${unpenetrated.length} authenticated area(s) visible but not effectively tested.` };
}

/** Show testing depth per role to expose privilege blind spots (idea 53260). */
export function splitCoverageByUserRole(records = [], options = {}) {
  const rows = groupAverage(records, r => String(r.role || r.userRole || ''), r => coverageOf(r))
    .sort((a, b) => a.avgCoverage - b.avgCoverage || String(a.key).localeCompare(String(b.key)));
  const weakest = rows[0] || null;
  const strongest = rows[rows.length - 1] || null;
  return { rows, count: rows.length, weakest, strongest, spread: weakest && strongest ? round2(strongest.avgCoverage - weakest.avgCoverage) : 0, summary: `Infinity AI split coverage across ${rows.length} user role(s); weakest role is ${weakest?.key || 'none'}.` };
}
