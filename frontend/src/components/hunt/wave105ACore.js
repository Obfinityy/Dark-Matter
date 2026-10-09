/**
 * wave105ACore.js — Infinity AI · Wave 105A
 * Target health-check signals, ideas 54161–54180: response-time tracking,
 * homepage content-hash and keyword checks, maintenance and WAF detection,
 * redirect-loop and rate-limit signals, 5xx spike alerts, login/API and
 * synthetic checks, WebSocket/GraphQL/rendered-page checks, multi-region and
 * IPv6 reachability, protocol negotiation, OCSP/HSTS posture, and port health.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE105_A_IDEAS = [
  { id: 54161, title: 'Response time tracking', skip: false },
  { id: 54162, title: 'Homepage content-hash checks', skip: false },
  { id: 54163, title: 'Keyword presence checks', skip: false },
  { id: 54164, title: 'Maintenance page detection', skip: false },
  { id: 54165, title: 'Redirect loop detection', skip: false },
  { id: 54166, title: 'WAF block detection', skip: false },
  { id: 54167, title: 'Rate-limit signal detection', skip: false },
  { id: 54168, title: '5xx spike alerts', skip: false },
  { id: 54169, title: 'Login page availability checks', skip: false },
  { id: 54170, title: 'API endpoint checks', skip: false },
  { id: 54171, title: 'Synthetic transaction checks', skip: false },
  { id: 54172, title: 'WebSocket health checks', skip: false },
  { id: 54173, title: 'GraphQL health queries', skip: false },
  { id: 54174, title: 'JS-rendered page checks', skip: false },
  { id: 54175, title: 'Multi-region checks', skip: false },
  { id: 54176, title: 'IPv6 reachability checks', skip: false },
  { id: 54177, title: 'HTTP/2 and HTTP/3 checks', skip: false },
  { id: 54178, title: 'OCSP stapling checks', skip: false },
  { id: 54179, title: 'HSTS header checks', skip: false },
  { id: 54180, title: 'Port health checks', skip: false },
];

function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function rate(p, w) { return w ? round2(p / w) : 0; }
function percentile(sorted, p) { if (!sorted.length) return 0; return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]; }
function ok2xx(code) { const c = num(code, 0); return c >= 200 && c < 300; }

/** Idea 54161 — Response time tracking. Input records: {target, samplesMs}. Percentiles use the nearest-rank method over a sorted copy. */
export function trackResponseTimes(records = [], scenario = {}) {
  const threshold = num(scenario.thresholdMs, 1500);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const samples = (Array.isArray(r.samplesMs) ? r.samplesMs : []).map(v => Math.max(0, num(v, 0))).sort((a, b) => a - b);
    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    return { key: target, target, sampleCount: samples.length, fastestMs: samples[0] || 0, p50Ms: p50, p95Ms: p95, slowestMs: samples[samples.length - 1] || 0, averageMs: samples.length ? round2(samples.reduce((s, v) => s + v, 0) / samples.length) : 0, status: samples.length && p95 > threshold ? 'response-degraded' : 'response-healthy' };
  }).sort((a, b) => b.p95Ms - a.p95Ms || String(a.target).localeCompare(String(b.target)));
  const degradedCount = rows.filter(r => r.status === 'response-degraded').length;
  return { rows, count: rows.length, degradedCount, top: rows[0] || null, summary: `Infinity AI tracked response times for ${rows.length} target(s); ${degradedCount} degraded.` };
}
/** Idea 54162 — Homepage content-hash checks. Input records: {target, previousHash, currentHash, changeRatio, noiseThreshold}. Changes beyond noise hint at defacement or deploys. */
export function checkHomepageHash(records = [], scenario = {}) {
  const fallback = num(scenario.noiseThreshold, 0.05);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const threshold = Math.max(0, num(r.noiseThreshold, fallback));
    const ratio = Math.max(0, num(r.changeRatio, String(r.previousHash || '') !== String(r.currentHash || '') ? 1 : 0));
    const changed = ratio > threshold;
    return { key: target, target, changeRatio: ratio, noiseThreshold: threshold, changed, status: changed ? 'hash-changed' : 'hash-stable' };
  }).sort((a, b) => b.changeRatio - a.changeRatio);
  const alertCount = rows.filter(r => r.changed).length;
  return { rows, count: rows.length, alertCount, top: rows[0] || null, summary: `Infinity AI flagged ${alertCount} of ${rows.length} homepage hash change(s) beyond noise.` };
}
/** Idea 54163 — Keyword presence checks. Input records: {target, expectedKeywords, pageText}. Missing keywords expose placeholder or parked pages. */
export function checkKeywordPresence(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const expected = (Array.isArray(r.expectedKeywords) ? r.expectedKeywords : []).map(k => String(k)).filter(Boolean);
    const text = String(r.pageText || '').toLowerCase();
    const found = expected.filter(k => text.includes(k.toLowerCase()));
    const missing = expected.filter(k => !text.includes(k.toLowerCase()));
    return { key: target, target, expectedCount: expected.length, foundCount: found.length, found, missing, coverage: rate(found.length, expected.length), status: expected.length && !missing.length ? 'keywords-present' : found.length ? 'keywords-partial' : 'keywords-missing' };
  }).sort((a, b) => a.coverage - b.coverage || String(a.target).localeCompare(String(b.target)));
  const presentCount = rows.filter(r => r.status === 'keywords-present').length;
  return { rows, count: rows.length, presentCount, top: rows[0] || null, summary: `Infinity AI confirmed expected keywords on ${presentCount} of ${rows.length} page(s).` };
}
/** Idea 54164 — Maintenance page detection. Input records: {target, statusCode, bodyText}. Known maintenance patterns read as "maintenance", never "down". */
export function detectMaintenancePage(records = []) {
  const phrases = ['scheduled maintenance', 'down for maintenance', 'maintenance mode', 'temporarily unavailable', 'be right back', 'under maintenance'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const code = num(r.statusCode, 0);
    const text = String(r.bodyText || '').toLowerCase();
    const matchedPhrase = phrases.find(p => text.includes(p)) || null;
    const maintenance = Boolean(matchedPhrase);
    return { key: target, target, statusCode: code, matchedPhrase, maintenance, status: maintenance ? 'maintenance' : code >= 500 ? 'down' : 'up' };
  }).sort((a, b) => Number(b.maintenance) - Number(a.maintenance) || String(a.target).localeCompare(String(b.target)));
  const maintenanceCount = rows.filter(r => r.maintenance).length;
  return { rows, count: rows.length, maintenanceCount, top: rows[0] || null, summary: `Infinity AI labelled ${maintenanceCount} of ${rows.length} target(s) as in maintenance.` };
}
/** Idea 54165 — Redirect loop detection. Input records: {target, redirects}. Cycles or over-long chains fail before browsers give up. */
export function detectRedirectLoops(records = [], scenario = {}) {
  const maxRedirects = Math.max(1, num(scenario.maxRedirects, 10));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const chain = (Array.isArray(r.redirects) ? r.redirects : []).map(u => String(u));
    const loop = chain.some((u, i) => chain.indexOf(u) !== i);
    const tooLong = chain.length > maxRedirects;
    return { key: target, target, chainLength: chain.length, loop, tooLong, status: loop ? 'redirect-loop' : tooLong ? 'redirect-chain-long' : 'redirect-ok' };
  }).sort((a, b) => Number(b.loop) - Number(a.loop) || b.chainLength - a.chainLength);
  const loopCount = rows.filter(r => r.loop).length;
  return { rows, count: rows.length, loopCount, maxRedirects, top: rows[0] || null, summary: `Infinity AI found redirect loops on ${loopCount} of ${rows.length} target(s).` };
}
/** Idea 54166 — WAF block detection. Input records: {target, statusCode, bodyText, challengeHeader}. Challenge pages are separated from genuine outages. */
export function detectWafBlock(records = []) {
  const phrases = ['attention required', 'just a moment', 'checking your browser', 'captcha', 'verify you are human'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const code = num(r.statusCode, 0);
    const text = String(r.bodyText || '').toLowerCase();
    const phraseHit = phrases.some(p => text.includes(p));
    const waf = phraseHit || (code === 403 && Boolean(r.challengeHeader));
    return { key: target, target, statusCode: code, phraseHit, waf, status: waf ? 'waf-block' : code >= 400 ? 'http-error' : 'reachable' };
  }).sort((a, b) => Number(b.waf) - Number(a.waf) || String(a.target).localeCompare(String(b.target)));
  const wafCount = rows.filter(r => r.waf).length;
  return { rows, count: rows.length, wafCount, top: rows[0] || null, summary: `Infinity AI separated WAF blocks from outages on ${wafCount} of ${rows.length} target(s).` };
}
/** Idea 54167 — Rate-limit signal detection. Input records: {target, statusCodes}. A 429 means back off, not downtime. */
export function detectRateLimitSignals(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const codes = (Array.isArray(r.statusCodes) ? r.statusCodes : []).map(c => num(c, 0));
    const limited = codes.filter(c => c === 429).length;
    return { key: target, target, checks: codes.length, limitedCount: limited, limitedRate: rate(limited, codes.length), backoffSeconds: Math.min(300, limited * 30), status: limited ? 'rate-limited-backoff' : 'rate-clean' };
  }).sort((a, b) => b.limitedCount - a.limitedCount || String(a.target).localeCompare(String(b.target)));
  const limitedTargets = rows.filter(r => r.limitedCount > 0).length;
  return { rows, count: rows.length, limitedTargets, top: rows[0] || null, summary: `Infinity AI backs off on ${limitedTargets} of ${rows.length} rate-limited target(s).` };
}
/** Idea 54168 — 5xx spike alerts. Input records: {target, totalRequests, serverErrors}. Error rates crossing the threshold open incidents. */
export function detectErrorSpikes(records = [], scenario = {}) {
  const threshold = Math.max(0, num(scenario.threshold, 0.05));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const total = Math.max(0, num(r.totalRequests, 0));
    const errors = Math.min(total, Math.max(0, num(r.serverErrors, 0)));
    const errorRate = rate(errors, total);
    return { key: target, target, totalRequests: total, serverErrors: errors, errorRate, status: total > 0 && errorRate > threshold ? 'error-spike' : 'error-normal' };
  }).sort((a, b) => b.errorRate - a.errorRate);
  const spikeCount = rows.filter(r => r.status === 'error-spike').length;
  return { rows, count: rows.length, spikeCount, threshold, top: rows[0] || null, summary: `Infinity AI raised 5xx spike alerts for ${spikeCount} of ${rows.length} target(s).` };
}
/** Idea 54169 — Login page availability checks. Input records: {target, loginUrl, statusCode, hasLoginForm}. Auth entry points must respond and render a form. */
export function checkLoginPageAvailability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const code = num(r.statusCode, 0);
    const reachable = code >= 200 && code < 400;
    const hasLoginForm = Boolean(r.hasLoginForm);
    return { key: target, target, loginUrl: String(r.loginUrl || ''), statusCode: code, reachable, hasLoginForm, status: reachable && hasLoginForm ? 'login-available' : reachable ? 'login-form-missing' : 'login-unreachable' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.target).localeCompare(String(b.target)));
  const availableCount = rows.filter(r => r.status === 'login-available').length;
  return { rows, count: rows.length, availableCount, top: rows[0] || null, summary: `Infinity AI verified login entry points on ${availableCount} of ${rows.length} target(s).` };
}
/** Idea 54170 — API endpoint checks. Input records: {target, routes: [{path, statusCode, schemaValid}]}. Critical routes must answer with valid schemas. */
export function checkApiEndpoints(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const routes = (Array.isArray(r.routes) ? r.routes : []).map(rt => {
      const healthy = ok2xx(rt.statusCode) && rt.schemaValid !== false;
      return { path: String(rt.path || '/'), statusCode: num(rt.statusCode, 0), schemaValid: rt.schemaValid !== false, healthy };
    });
    const failing = routes.filter(rt => !rt.healthy);
    return { key: target, target, routeCount: routes.length, failingCount: failing.length, failingPaths: failing.map(rt => rt.path), status: routes.length && !failing.length ? 'api-healthy' : 'api-degraded' };
  }).sort((a, b) => b.failingCount - a.failingCount || String(a.target).localeCompare(String(b.target)));
  const healthyCount = rows.filter(r => r.status === 'api-healthy').length;
  const totalRoutes = rows.reduce((s, r) => s + r.routeCount, 0);
  return { rows, count: rows.length, healthyCount, totalRoutes, top: rows[0] || null, summary: `Infinity AI polled ${totalRoutes} API route(s) across ${rows.length} target(s); ${healthyCount} fully healthy.` };
}
/** Idea 54171 — Synthetic transaction checks. Input records: {target, flow, steps: [{name, ok, durationMs}]}. Scripted journeys verify real user flows end to end. */
export function runSyntheticTransactions(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const steps = (Array.isArray(r.steps) ? r.steps : []).map(s => ({ name: String(s.name || 'step'), ok: Boolean(s.ok), durationMs: Math.max(0, num(s.durationMs, 0)) }));
    const failed = steps.find(s => !s.ok) || null;
    return { key: target, target, flow: String(r.flow || 'flow'), stepCount: steps.length, completedSteps: steps.filter(s => s.ok).length, failedStep: failed ? failed.name : null, durationMs: steps.reduce((s, x) => s + x.durationMs, 0), status: steps.length && !failed ? 'transaction-passed' : 'transaction-failed' };
  }).sort((a, b) => Number(a.status === 'transaction-passed') - Number(b.status === 'transaction-passed') || b.durationMs - a.durationMs);
  const passedCount = rows.filter(r => r.status === 'transaction-passed').length;
  return { rows, count: rows.length, passedCount, top: rows[0] || null, summary: `Infinity AI passed ${passedCount} of ${rows.length} synthetic transaction(s).` };
}
/** Idea 54172 — WebSocket health checks. Input records: {target, endpoint, connects, handshakeMs, receivesFrames}. Endpoints must accept connections and deliver frames. */
export function checkWebSocketHealth(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const connects = Boolean(r.connects);
    const receivesFrames = Boolean(r.receivesFrames);
    return { key: target, target, endpoint: String(r.endpoint || ''), connects, receivesFrames, handshakeMs: Math.max(0, num(r.handshakeMs, 0)), status: connects && receivesFrames ? 'websocket-healthy' : connects ? 'websocket-silent' : 'websocket-unreachable' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || a.handshakeMs - b.handshakeMs);
  const healthyCount = rows.filter(r => r.status === 'websocket-healthy').length;
  return { rows, count: rows.length, healthyCount, top: rows[0] || null, summary: `Infinity AI confirmed live WebSocket endpoints on ${healthyCount} of ${rows.length} target(s).` };
}
/** Idea 54173 — GraphQL health queries. Input records: {target, endpoint, statusCode, dataPresent, introspectionExposed}. A lightweight safe query verifies availability without opening introspection. */
export function checkGraphqlHealth(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const healthy = ok2xx(r.statusCode) && Boolean(r.dataPresent);
    const introspectionExposed = Boolean(r.introspectionExposed);
    return { key: target, target, endpoint: String(r.endpoint || ''), statusCode: num(r.statusCode, 0), dataPresent: Boolean(r.dataPresent), introspectionExposed, note: introspectionExposed ? 'graphql-introspection-open' : 'graphql-introspection-closed', status: healthy ? 'graphql-healthy' : 'graphql-failing' };
  }).sort((a, b) => Number(b.status === 'graphql-healthy') - Number(a.status === 'graphql-healthy') || String(a.target).localeCompare(String(b.target)));
  const healthyCount = rows.filter(r => r.status === 'graphql-healthy').length;
  const exposedCount = rows.filter(r => r.introspectionExposed).length;
  return { rows, count: rows.length, healthyCount, exposedCount, top: rows[0] || null, summary: `Infinity AI verified GraphQL availability on ${healthyCount} of ${rows.length} endpoint(s).` };
}
/** Idea 54174 — JS-rendered page checks. Input records: {target, rawHasContent, renderedHasContent, renderErrors}. Headless rendering catches failures invisible to raw HTTP. */
export function checkJsRenderedPages(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const rawHasContent = Boolean(r.rawHasContent);
    const renderedHasContent = Boolean(r.renderedHasContent);
    return { key: target, target, rawHasContent, renderedHasContent, renderErrors: Math.max(0, num(r.renderErrors, 0)), needsRender: !rawHasContent && renderedHasContent, status: !renderedHasContent ? 'render-failed' : rawHasContent ? 'render-consistent' : 'render-required' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.target).localeCompare(String(b.target)));
  const failedCount = rows.filter(r => r.status === 'render-failed').length;
  const renderNeededCount = rows.filter(r => r.needsRender).length;
  return { rows, count: rows.length, failedCount, renderNeededCount, top: rows[0] || null, summary: `Infinity AI rendered ${rows.length} page(s); ${failedCount} failed and ${renderNeededCount} needed JavaScript.` };
}
/** Idea 54175 — Multi-region checks. Input records: {target, regions: [{region, status}]}. Geo-specific outages only appear when probing from several regions. */
export function checkMultiRegion(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const regions = (Array.isArray(r.regions) ? r.regions : []).map(x => ({ region: String(x.region || 'region'), status: String(x.status || 'down') }));
    const downRegions = regions.filter(x => x.status !== 'up').map(x => x.region);
    return { key: target, target, regionCount: regions.length, upRegions: regions.length - downRegions.length, downRegions, status: regions.length && !downRegions.length ? 'regions-healthy' : regions.length && downRegions.length === regions.length ? 'regions-down' : 'regions-partial' };
  }).sort((a, b) => b.downRegions.length - a.downRegions.length || String(a.target).localeCompare(String(b.target)));
  const healthyCount = rows.filter(r => r.status === 'regions-healthy').length;
  return { rows, count: rows.length, healthyCount, top: rows[0] || null, summary: `Infinity AI probed ${rows.length} target(s) across regions; ${healthyCount} healthy everywhere.` };
}
/** Idea 54176 — IPv6 reachability checks. Input records: {target, hasAaaa, ipv6Connects, ipv4Connects}. AAAA records and IPv6 connectivity verified separately from IPv4. */
export function checkIpv6Reachability(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const hasAaaa = Boolean(r.hasAaaa);
    const ipv6Connects = Boolean(r.ipv6Connects);
    return { key: target, target, hasAaaa, ipv6Connects, ipv4Connects: Boolean(r.ipv4Connects), status: !hasAaaa ? 'ipv6-no-aaaa' : ipv6Connects ? 'ipv6-reachable' : 'ipv6-broken' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.target).localeCompare(String(b.target)));
  const reachableCount = rows.filter(r => r.status === 'ipv6-reachable').length;
  return { rows, count: rows.length, reachableCount, top: rows[0] || null, summary: `Infinity AI verified IPv6 reachability on ${reachableCount} of ${rows.length} target(s).` };
}
/** Idea 54177 — HTTP/2 and HTTP/3 checks. Input records: {target, advertised, negotiated}. Advertised protocol versions must actually negotiate. */
export function checkHttpProtocols(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const advertised = (Array.isArray(r.advertised) ? r.advertised : []).map(p => String(p).toLowerCase());
    const negotiated = String(r.negotiated || '').toLowerCase();
    const negotiatedOk = Boolean(negotiated) && advertised.includes(negotiated);
    const missing = advertised.filter(p => p !== negotiated);
    return { key: target, target, advertised, negotiated, negotiatedOk, missing, status: negotiatedOk ? (missing.length ? 'protocol-partial' : 'protocol-full') : 'protocol-mismatch' };
  }).sort((a, b) => Number(b.negotiatedOk) - Number(a.negotiatedOk) || String(a.target).localeCompare(String(b.target)));
  const okCount = rows.filter(r => r.negotiatedOk).length;
  return { rows, count: rows.length, okCount, top: rows[0] || null, summary: `Infinity AI confirmed advertised protocols negotiate on ${okCount} of ${rows.length} target(s).` };
}
/** Idea 54178 — OCSP stapling checks. Input records: {target, expected, stapled, certValid}. Revocation-status delivery validated where expected. */
export function checkOcspStapling(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const expected = Boolean(r.expected);
    const stapled = Boolean(r.stapled) && Boolean(r.certValid);
    return { key: target, target, expected, stapled, certValid: Boolean(r.certValid), status: !expected ? 'ocsp-not-expected' : stapled ? 'ocsp-stapled' : 'ocsp-missing' };
  }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.target).localeCompare(String(b.target)));
  const stapledCount = rows.filter(r => r.status === 'ocsp-stapled').length;
  const missingCount = rows.filter(r => r.status === 'ocsp-missing').length;
  return { rows, count: rows.length, stapledCount, missingCount, top: rows[0] || null, summary: `Infinity AI validated OCSP stapling on ${stapledCount} target(s); ${missingCount} missing it.` };
}
/** Idea 54179 — HSTS header checks. Input records: {target, hstsPresent, maxAgeDays, includeSubDomains}. Presence and max-age catch security posture regressions. */
export function checkHstsHeaders(records = [], scenario = {}) {
  const strongDays = Math.max(1, num(scenario.strongDays, 180));
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const present = Boolean(r.hstsPresent);
    const maxAgeDays = Math.max(0, num(r.maxAgeDays, 0));
    const strong = present && maxAgeDays >= strongDays;
    return { key: target, target, present, maxAgeDays, includeSubDomains: Boolean(r.includeSubDomains), strong, status: !present ? 'hsts-missing' : strong ? 'hsts-strong' : 'hsts-weak' };
  }).sort((a, b) => b.maxAgeDays - a.maxAgeDays);
  const strongCount = rows.filter(r => r.strong).length;
  const missingCount = rows.filter(r => !r.present).length;
  return { rows, count: rows.length, strongCount, missingCount, top: rows[0] || null, summary: `Infinity AI found strong HSTS on ${strongCount} of ${rows.length} target(s).` };
}
/** Idea 54180 — Port health checks. Input records: {target, expectedPorts, openPorts}. Expected TCP ports must stay open for network and IoT targets. */
export function checkPortHealth(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const expected = (Array.isArray(r.expectedPorts) ? r.expectedPorts : []).map(p => num(p, 0)).filter(p => p > 0);
    const open = (Array.isArray(r.openPorts) ? r.openPorts : []).map(p => num(p, 0)).filter(p => p > 0);
    const closedPorts = expected.filter(p => !open.includes(p));
    return { key: target, target, expectedCount: expected.length, openCount: expected.length - closedPorts.length, closedPorts, status: expected.length && !closedPorts.length ? 'ports-open' : 'ports-closed' };
  }).sort((a, b) => b.closedPorts.length - a.closedPorts.length || String(a.target).localeCompare(String(b.target)));
  const openCount = rows.filter(r => r.status === 'ports-open').length;
  return { rows, count: rows.length, openCount, top: rows[0] || null, summary: `Infinity AI verified expected ports open on ${openCount} of ${rows.length} target(s).` };
}
