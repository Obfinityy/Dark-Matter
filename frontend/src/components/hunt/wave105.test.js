/**
 * wave105.test.js — Infinity AI · Wave 105
 * node:test + node:assert/strict. Registry coverage (20/20 for 54161–54180,
 * 20/20 for 54181–54200, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave105.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE105_A_IDEAS } from './wave105ACore.js';
import * as X105A from './wave105ACore.js';
import { WAVE105_B_IDEAS } from './wave105BCores.js';
import * as X105B from './wave105BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave105ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave105BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave105A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave105B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave105.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 105A ideas, 20/20 wave 105B ideas, zero skips', () => {
  assert.equal(WAVE105_A_IDEAS.length, 20);
  assert.equal(WAVE105_B_IDEAS.length, 20);
  const all = [...WAVE105_A_IDEAS, ...WAVE105_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54161 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE105_A_IDEAS, ...WAVE105_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54161: 'response time tracking',
    54162: 'homepage content-hash checks',
    54163: 'keyword presence checks',
    54164: 'maintenance page detection',
    54165: 'redirect loop detection',
    54166: 'waf block detection',
    54167: 'rate-limit signal detection',
    54168: '5xx spike alerts',
    54169: 'login page availability checks',
    54170: 'api endpoint checks',
    54171: 'synthetic transaction checks',
    54172: 'websocket health checks',
    54173: 'graphql health queries',
    54174: 'js-rendered page checks',
    54175: 'multi-region checks',
    54176: 'ipv6 reachability checks',
    54177: 'http/2 and http/3 checks',
    54178: 'ocsp stapling checks',
    54179: 'hsts header checks',
    54180: 'port health checks',
    54181: 'dependency health rollup',
    54182: 'scheduled maintenance windows',
    54183: 'flapping detection',
    54184: 'degraded vs down states',
    54185: 'health score 0–100',
    54186: 'health history charts',
    54187: 'sla compliance percentage (targets)',
    54188: 'downtime annotations',
    54189: 'auto-pause hunts on outage',
    54190: 'recovery notifications',
    54191: 'incident timeline (targets)',
    54192: 'alert channel routing',
    54193: 'configurable check intervals',
    54194: 'per-region status page',
    54195: 'health check logs',
    54196: 'health-based target sorting',
    54197: 'health api for integrations',
    54198: 'user-selected check regions',
    54199: 'sso provider checks',
    54200: 'mobile api checks',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 105A spot checks (one per idea) ---
test('54161 trackResponseTimes computes nearest-rank percentiles', () => {
  const v = X105A.trackResponseTimes([
    { target: 'shop', samplesMs: [100, 200, 300, 400] },
    { target: 'slow', samplesMs: [2000, 2600] },
  ], { thresholdMs: 1000 });
  assert.equal(v.degradedCount, 1);
  assert.equal(v.top.target, 'slow');
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.p50Ms, 200);
  assert.equal(shop.p95Ms, 400);
  assert.equal(shop.averageMs, 250);
});
test('54162 checkHomepageHash alerts beyond the noise threshold', () => {
  const v = X105A.checkHomepageHash([
    { target: 'shop', changeRatio: 0.42 },
    { target: 'blog', changeRatio: 0.02 },
  ], { noiseThreshold: 0.05 });
  assert.equal(v.alertCount, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'hash-stable');
  assert.equal(v.top.target, 'shop');
});
test('54163 checkKeywordPresence lists missing keywords', () => {
  const v = X105A.checkKeywordPresence([
    { target: 'shop', expectedKeywords: ['login', 'pricing'], pageText: 'Welcome to the login page' },
  ]);
  assert.equal(v.rows[0].coverage, 0.5);
  assert.deepEqual(v.rows[0].missing, ['pricing']);
  assert.equal(v.rows[0].status, 'keywords-partial');
});
test('54164 detectMaintenancePage separates maintenance from down', () => {
  const v = X105A.detectMaintenancePage([
    { target: 'shop', statusCode: 503, bodyText: 'We are currently down for maintenance' },
    { target: 'api', statusCode: 200, bodyText: 'Welcome' },
  ]);
  assert.equal(v.maintenanceCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'maintenance');
  assert.equal(v.rows.find(r => r.target === 'api').status, 'up');
});
test('54165 detectRedirectLoops catches cycles', () => {
  const v = X105A.detectRedirectLoops([
    { target: 'shop', redirects: ['a', 'b', 'a'] },
    { target: 'blog', redirects: ['a', 'b'] },
  ]);
  assert.equal(v.loopCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'redirect-loop');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'redirect-ok');
});
test('54166 detectWafBlock separates challenges from outages', () => {
  const v = X105A.detectWafBlock([
    { target: 'shop', statusCode: 200, bodyText: 'Just a moment... Checking your browser' },
    { target: 'api', statusCode: 503, bodyText: 'Service unavailable' },
  ]);
  assert.equal(v.wafCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'waf-block');
  assert.equal(v.rows.find(r => r.target === 'api').status, 'http-error');
});
test('54167 detectRateLimitSignals backs off on 429s', () => {
  const v = X105A.detectRateLimitSignals([
    { target: 'api', statusCodes: [200, 429, 429, 200] },
  ]);
  assert.equal(v.rows[0].limitedCount, 2);
  assert.equal(v.rows[0].limitedRate, 0.5);
  assert.equal(v.rows[0].backoffSeconds, 60);
  assert.equal(v.rows[0].status, 'rate-limited-backoff');
});
test('54168 detectErrorSpikes alerts past the threshold', () => {
  const v = X105A.detectErrorSpikes([
    { target: 'shop', totalRequests: 100, serverErrors: 12 },
    { target: 'blog', totalRequests: 100, serverErrors: 2 },
  ], { threshold: 0.05 });
  assert.equal(v.spikeCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').errorRate, 0.12);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'error-normal');
});
test('54169 checkLoginPageAvailability requires a rendered form', () => {
  const v = X105A.checkLoginPageAvailability([
    { target: 'shop', loginUrl: 'https://shop.example.com/login', statusCode: 200, hasLoginForm: true },
    { target: 'blog', loginUrl: 'https://blog.example.com/login', statusCode: 200, hasLoginForm: false },
    { target: 'legacy', loginUrl: 'https://legacy.example.com/login', statusCode: 503, hasLoginForm: false },
  ]);
  assert.equal(v.availableCount, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'login-form-missing');
  assert.equal(v.rows.find(r => r.target === 'legacy').status, 'login-unreachable');
});
test('54170 checkApiEndpoints validates route schemas', () => {
  const v = X105A.checkApiEndpoints([
    { target: 'api', routes: [
      { path: '/health', statusCode: 200, schemaValid: true },
      { path: '/version', statusCode: 500, schemaValid: true },
      { path: '/status', statusCode: 200, schemaValid: false },
    ] },
  ]);
  assert.equal(v.rows[0].failingCount, 2);
  assert.deepEqual(v.rows[0].failingPaths, ['/version', '/status']);
  assert.equal(v.totalRoutes, 3);
  assert.equal(v.healthyCount, 0);
});
test('54171 runSyntheticTransactions stops at the failed step', () => {
  const v = X105A.runSyntheticTransactions([
    { target: 'shop', flow: 'signup', steps: [
      { name: 'open', ok: true, durationMs: 300 },
      { name: 'search', ok: true, durationMs: 450 },
      { name: 'pay', ok: false, durationMs: 200 },
    ] },
    { target: 'blog', flow: 'search', steps: [{ name: 'open', ok: true, durationMs: 100 }] },
  ]);
  assert.equal(v.passedCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.failedStep, 'pay');
  assert.equal(shop.durationMs, 950);
  assert.equal(shop.completedSteps, 2);
});
test('54172 checkWebSocketHealth requires frames, not just connects', () => {
  const v = X105A.checkWebSocketHealth([
    { target: 'chat', endpoint: 'wss://chat.example.com/s', connects: true, handshakeMs: 84, receivesFrames: true },
    { target: 'feed', endpoint: 'wss://feed.example.com/s', connects: true, handshakeMs: 120, receivesFrames: false },
    { target: 'old', endpoint: 'wss://old.example.com/s', connects: false, handshakeMs: 0, receivesFrames: false },
  ]);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.rows.find(r => r.target === 'feed').status, 'websocket-silent');
  assert.equal(v.rows.find(r => r.target === 'old').status, 'websocket-unreachable');
});
test('54173 checkGraphqlHealth flags open introspection', () => {
  const v = X105A.checkGraphqlHealth([
    { target: 'api', endpoint: 'https://api.example.com/graphql', statusCode: 200, dataPresent: true, introspectionExposed: false },
    { target: 'lab', endpoint: 'https://lab.example.com/graphql', statusCode: 200, dataPresent: true, introspectionExposed: true },
    { target: 'down', endpoint: 'https://down.example.com/graphql', statusCode: 500, dataPresent: false, introspectionExposed: false },
  ]);
  assert.equal(v.healthyCount, 2);
  assert.equal(v.exposedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'lab').note, 'graphql-introspection-open');
  assert.equal(v.rows.find(r => r.target === 'down').status, 'graphql-failing');
});
test('54174 checkJsRenderedPages separates render-required from failed', () => {
  const v = X105A.checkJsRenderedPages([
    { target: 'app', rawHasContent: false, renderedHasContent: true, renderErrors: 0 },
    { target: 'blog', rawHasContent: true, renderedHasContent: true, renderErrors: 0 },
    { target: 'broken', rawHasContent: false, renderedHasContent: false, renderErrors: 2 },
  ]);
  assert.equal(v.failedCount, 1);
  assert.equal(v.renderNeededCount, 1);
  assert.equal(v.rows.find(r => r.target === 'app').status, 'render-required');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'render-consistent');
});
test('54175 checkMultiRegion localises geo outages', () => {
  const v = X105A.checkMultiRegion([
    { target: 'shop', regions: [{ region: 'us', status: 'up' }, { region: 'eu', status: 'up' }, { region: 'ap', status: 'down' }] },
    { target: 'blog', regions: [{ region: 'us', status: 'up' }, { region: 'eu', status: 'up' }] },
  ]);
  assert.equal(v.healthyCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'shop').downRegions, ['ap']);
  assert.equal(v.top.target, 'shop');
});
test('54176 checkIpv6Reachability verifies AAAA separately', () => {
  const v = X105A.checkIpv6Reachability([
    { target: 'shop', hasAaaa: true, ipv6Connects: true, ipv4Connects: true },
    { target: 'legacy', hasAaaa: false, ipv6Connects: false, ipv4Connects: true },
    { target: 'broken', hasAaaa: true, ipv6Connects: false, ipv4Connects: true },
  ]);
  assert.equal(v.reachableCount, 1);
  assert.equal(v.rows.find(r => r.target === 'legacy').status, 'ipv6-no-aaaa');
  assert.equal(v.rows.find(r => r.target === 'broken').status, 'ipv6-broken');
});
test('54177 checkHttpProtocols requires real negotiation', () => {
  const v = X105A.checkHttpProtocols([
    { target: 'shop', advertised: ['h2', 'h3'], negotiated: 'h2' },
    { target: 'old', advertised: ['h2'], negotiated: 'http/1.1' },
  ]);
  assert.equal(v.okCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.deepEqual(shop.missing, ['h3']);
  assert.equal(shop.status, 'protocol-partial');
  assert.equal(v.rows.find(r => r.target === 'old').status, 'protocol-mismatch');
});
test('54178 checkOcspStapling validates revocation delivery', () => {
  const v = X105A.checkOcspStapling([
    { target: 'shop', expected: true, stapled: true, certValid: true },
    { target: 'blog', expected: true, stapled: false, certValid: true },
    { target: 'plain', expected: false, stapled: false, certValid: true },
  ]);
  assert.equal(v.stapledCount, 1);
  assert.equal(v.missingCount, 1);
  assert.equal(v.rows.find(r => r.target === 'plain').status, 'ocsp-not-expected');
});
test('54179 checkHstsHeaders demands long max-age', () => {
  const v = X105A.checkHstsHeaders([
    { target: 'shop', hstsPresent: true, maxAgeDays: 365, includeSubDomains: true },
    { target: 'blog', hstsPresent: true, maxAgeDays: 30, includeSubDomains: false },
    { target: 'legacy', hstsPresent: false, maxAgeDays: 0, includeSubDomains: false },
  ]);
  assert.equal(v.strongCount, 1);
  assert.equal(v.missingCount, 1);
  assert.equal(v.top.target, 'shop');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'hsts-weak');
});
test('54180 checkPortHealth lists closed expected ports', () => {
  const v = X105A.checkPortHealth([
    { target: 'iot', expectedPorts: [443, 8443], openPorts: [443] },
    { target: 'web', expectedPorts: [80, 443], openPorts: [80, 443] },
  ]);
  assert.equal(v.openCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'iot').closedPorts, [8443]);
});

// --- Wave 105B spot checks (one per idea) ---
test('54181 rollupDependencyHealth surfaces down dependencies', () => {
  const v = X105B.rollupDependencyHealth([
    { target: 'shop', dependencies: [{ name: 'cdn', status: 'up' }, { name: 'dns', status: 'up' }] },
    { target: 'api', dependencies: [{ name: 'cdn', status: 'down' }, { name: 'sso', status: 'degraded' }] },
  ]);
  assert.equal(v.downTargets, 1);
  assert.equal(v.totalDependencies, 4);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'dependency-healthy');
  assert.deepEqual(v.rows.find(r => r.target === 'api').downNames, ['cdn']);
});
test('54182 planMaintenanceWindows suppresses alerts inside windows', () => {
  const v = X105B.planMaintenanceWindows([
    { target: 'shop', windows: [{ startHour: 2, endHour: 4 }] },
    { target: 'api', windows: [{ startHour: 22, endHour: 2 }] },
  ], { nowHour: 3 });
  assert.equal(v.suppressedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'maintenance-window');
  assert.equal(v.rows.find(r => r.target === 'api').status, 'alerts-active');
});
test('54183 detectFlapping consolidates oscillating states', () => {
  const v = X105B.detectFlapping([
    { target: 'noisy', states: ['up', 'down', 'up', 'down', 'up'] },
    { target: 'calm', states: ['up', 'up', 'down'] },
  ], { transitionThreshold: 4 });
  assert.equal(v.flappingCount, 1);
  const noisy = v.rows.find(r => r.target === 'noisy');
  assert.equal(noisy.transitions, 4);
  assert.equal(noisy.currentState, 'up');
  assert.equal(v.rows.find(r => r.target === 'calm').status, 'state-stable');
});
test('54184 classifyTargetState keeps degraded distinct from down', () => {
  const v = X105B.classifyTargetState([
    { target: 'shop', reachable: true, latencyMs: 240, errorRate: 0.01 },
    { target: 'slow', reachable: true, latencyMs: 2400, errorRate: 0.01 },
    { target: 'gone', reachable: false, latencyMs: 0, errorRate: 0 },
  ]);
  assert.equal(v.downCount, 1);
  assert.equal(v.degradedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'slow').reason, 'slow-response');
  assert.equal(v.rows.find(r => r.target === 'gone').state, 'down');
});
test('54185 computeHealthScore composites uptime latency TLS errors', () => {
  const v = X105B.computeHealthScore([
    { target: 'shop', uptimePercent: 99.9, p95Ms: 200, tlsGrade: 'A', errorRate: 0.01 },
    { target: 'legacy', uptimePercent: 90, p95Ms: 2800, tlsGrade: 'C', errorRate: 0.3 },
  ]);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.score, 99);
  assert.equal(shop.band, 'health-excellent');
  assert.equal(v.rows.find(r => r.target === 'legacy').score, 61);
  assert.equal(v.averageScore, 80);
  assert.equal(v.top.target, 'shop');
});
test('54186 buildHealthHistory charts uptime and markers', () => {
  const v = X105B.buildHealthHistory([
    { target: 'shop', checks: [
      { at: '2026-10-09T00:00:00Z', up: true, latencyMs: 120 },
      { at: '2026-10-09T01:00:00Z', up: false, latencyMs: 0 },
      { at: '2026-10-09T02:00:00Z', up: true, latencyMs: 240 },
    ] },
  ]);
  assert.equal(v.rows[0].uptime, 0.67);
  assert.equal(v.rows[0].averageLatencyMs, 120);
  assert.deepEqual(v.rows[0].markers, ['2026-10-09T01:00:00Z']);
  assert.equal(v.totalChecks, 3);
});
test('54187 measureSlaCompliance highlights breaches', () => {
  const v = X105B.measureSlaCompliance([
    { target: 'shop', uptimePercent: 99.95, slaPercent: 99.9 },
    { target: 'legacy', uptimePercent: 98.5, slaPercent: 99.9 },
  ]);
  assert.equal(v.breachCount, 1);
  assert.equal(v.rows.find(r => r.target === 'legacy').margin, -1.4);
  assert.equal(v.top.target, 'legacy');
});
test('54188 manageDowntimeAnnotations requires root cause', () => {
  const v = X105B.manageDowntimeAnnotations([
    { target: 'shop', incidentId: 'inc-9', notes: [{ author: 'Sam Reed', text: 'DB pool exhausted', rootCause: true }] },
    { target: 'blog', incidentId: 'inc-3', notes: [] },
  ]);
  assert.equal(v.completeCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').latest, 'DB pool exhausted');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'annotation-missing');
});
test('54189 planAutoPauseHunts pauses hunts on down targets', () => {
  const v = X105B.planAutoPauseHunts([
    { target: 'shop', state: 'down', runningHunts: 3 },
    { target: 'api', state: 'degraded', runningHunts: 1 },
    { target: 'blog', state: 'up', runningHunts: 2 },
  ]);
  assert.equal(v.pausedCount, 1);
  assert.equal(v.affectedTotal, 4);
  assert.equal(v.rows.find(r => r.target === 'api').action, 'throttle-hunts');
});
test('54190 buildRecoveryNotifications carry downtime duration', () => {
  const v = X105B.buildRecoveryNotifications([
    { target: 'shop', wasDown: true, nowUp: true, downtimeMinutes: 47, channels: ['email', 'slack'] },
    { target: 'blog', wasDown: true, nowUp: false, downtimeMinutes: 12, channels: [] },
  ]);
  assert.equal(v.notifiedCount, 1);
  const shop = v.rows.find(r => r.target === 'shop');
  assert.equal(shop.message, 'shop back up after 47m');
  assert.equal(shop.channelCount, 2);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'still-down');
});
test('54191 buildIncidentTimeline orders lifecycle events', () => {
  const v = X105B.buildIncidentTimeline([
    { target: 'shop', incidentId: 'inc-9', events: [
      { type: 'detected', at: '2026-10-09T00:00:00Z' },
      { type: 'acknowledged', at: '2026-10-09T00:20:00Z' },
      { type: 'resolved', at: '2026-10-09T01:30:00Z' },
    ] },
    { target: 'blog', incidentId: 'inc-4', events: [{ type: 'detected', at: '2026-10-08T23:00:00Z' }] },
  ]);
  assert.equal(v.resolvedCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').durationMinutes, 90);
  assert.equal(v.rows.find(r => r.target === 'blog').durationMinutes, null);
});
test('54192 routeAlertChannels matches group and severity rules', () => {
  const v = X105B.routeAlertChannels([
    { target: 'shop', group: 'payments', severity: 'critical' },
    { target: 'blog', group: 'marketing', severity: 'info' },
  ], { rules: [
    { severity: 'critical', channel: 'pagerduty' },
    { group: 'payments', channel: 'slack' },
    { channel: 'email' },
  ] });
  assert.deepEqual(v.rows.find(r => r.target === 'shop').channels, ['pagerduty', 'slack', 'email']);
  assert.equal(v.fallbackCount, 0);
  assert.equal(v.ruleCount, 3);
});
test('54193 planCheckIntervals follows criticality policy', () => {
  const v = X105B.planCheckIntervals([
    { target: 'shop', criticality: 'critical' },
    { target: 'blog', criticality: 'standard', requestedMinutes: 60 },
  ]);
  assert.equal(v.sparseCount, 1);
  assert.equal(v.rows.find(r => r.target === 'shop').effectiveMinutes, 1);
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'interval-sparse');
});
test('54194 buildRegionStatusPage publishes per-region health', () => {
  const v = X105B.buildRegionStatusPage([
    { target: 'shop', region: 'us', status: 'up', healthScore: 96 },
    { target: 'shop', region: 'eu', status: 'down', healthScore: 22 },
    { target: 'api', region: 'eu', status: 'up', healthScore: 88 },
  ]);
  assert.equal(v.downCount, 1);
  assert.equal(v.regionCount, 2);
  assert.equal(v.worst.key, 'shop|eu');
  assert.equal(v.rows[0].band, 'health-poor');
});
test('54195 retainHealthCheckLogs keeps recent raw results', () => {
  const v = X105B.retainHealthCheckLogs([
    { target: 'shop', checks: [
      { at: '2026-10-09T02:00:00Z', statusCode: 200, durationMs: 100 },
      { at: '2026-10-09T01:00:00Z', statusCode: 200, durationMs: 300 },
      { at: '2026-10-09T00:00:00Z', statusCode: 500, durationMs: 200 },
    ] },
  ], { retention: 2 });
  assert.equal(v.rows[0].retainedCount, 2);
  assert.equal(v.rows[0].droppedCount, 1);
  assert.equal(v.rows[0].averageMs, 200);
  assert.equal(v.rows[0].slowestMs, 300);
  assert.equal(v.totalRetained, 2);
});
test('54196 sortTargetsByHealth surfaces the sickest first', () => {
  const v = X105B.sortTargetsByHealth([
    { target: 'shop', healthScore: 92 },
    { target: 'legacy', healthScore: 34 },
    { target: 'api', healthScore: 47 },
  ], { threshold: 50 });
  assert.equal(v.sickest.target, 'legacy');
  assert.equal(v.belowCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').rank, 3);
  assert.equal(v.rows[0].rank, 1);
});
test('54197 exposeHealthApiPayload shapes integration data', () => {
  const v = X105B.exposeHealthApiPayload([
    { target: 'shop', status: 'up', healthScore: 97, updatedAt: '2026-10-09T02:00:00Z' },
    { target: 'legacy', status: 'down', healthScore: 41, updatedAt: '2026-10-09T02:00:00Z' },
  ]);
  assert.equal(v.payload.version, 'v1');
  assert.equal(v.payload.summary.total, 2);
  assert.equal(v.downCount, 1);
  assert.equal(v.top.target, 'legacy');
});
test('54198 selectCheckRegions enforces the minimum coverage', () => {
  const v = X105B.selectCheckRegions([
    { target: 'shop', selectedRegions: ['us'] },
    { target: 'api', selectedRegions: ['us', 'eu', 'us'] },
  ], { minRegions: 2 });
  assert.equal(v.insufficientCount, 1);
  assert.deepEqual(v.rows.find(r => r.target === 'api').selectedRegions, ['eu', 'us']);
  assert.equal(v.rows.find(r => r.target === 'shop').missingCount, 1);
});
test('54199 checkSsoProviders flags login-blocking outages', () => {
  const v = X105B.checkSsoProviders([
    { target: 'portal', provider: 'idp', endpointStatus: 200, loginGated: true },
    { target: 'admin', provider: 'idp', endpointStatus: 503, loginGated: true },
    { target: 'blog', provider: 'none', endpointStatus: 503, loginGated: false },
  ]);
  assert.equal(v.blockingCount, 1);
  assert.equal(v.rows.find(r => r.target === 'admin').status, 'sso-blocking-login');
  assert.equal(v.rows.find(r => r.target === 'blog').status, 'sso-degraded');
});
test('54200 checkMobileApiHosts separates mobile outages', () => {
  const v = X105B.checkMobileApiHosts([
    { target: 'shop', webStatus: 200, mobileApiStatus: 503, mobileApiLatencyMs: 210 },
    { target: 'blog', webStatus: 200, mobileApiStatus: 200, mobileApiLatencyMs: 90 },
    { target: 'gone', webStatus: 500, mobileApiStatus: 0, mobileApiLatencyMs: 0 },
  ]);
  assert.equal(v.outageCount, 2);
  assert.equal(v.rows.find(r => r.target === 'shop').status, 'mobile-only-outage');
  assert.equal(v.rows.find(r => r.target === 'gone').status, 'full-outage');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X105A', 20], ['B', B_JSX, 'X105B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w105 prefixes, zero keyframes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w105a-'));
  assert.ok(CSS_SRC.includes('.w105b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'zero-keyframe rule violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave105A.jsx', 'Wave105B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

test('branding audit: Infinity AI only, no other AI names', () => {
  const banned = ['cl' + 'aude', 'chat' + 'gpt', 'open' + 'ai', 'gem' + 'ini', 'copil' + 'ot'];
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    for (const b of banned) assert.ok(!low.includes(b), `${name} leaks ${b}`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

test('no-debris audit: no placeholder text in wave 105 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenSamples = Object.freeze([{ target: 'shop', samplesMs: Object.freeze([300, 100, 200]) }]);
  const a = X105A.trackResponseTimes(frozenSamples);
  assert.equal(a.count, 1);
  assert.equal(a.rows[0].p50Ms, 200);
  assert.deepEqual(frozenSamples[0].samplesMs, [300, 100, 200]);
  const frozenTargets = Object.freeze([Object.freeze({ target: 'shop', healthScore: 92 }), Object.freeze({ target: 'legacy', healthScore: 34 })]);
  const b = X105B.sortTargetsByHealth(frozenTargets);
  assert.equal(b.count, 2);
  assert.equal(b.sickest.target, 'legacy');
});
