/**
 * apiBehaviorHeaderRecon.test.js — real assertions for ideas 1301-1310.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1301_COVERAGE,
  ideaFunctions,
  detectPassthroughHeaders,
  computeLatencyProfile,
  rankCostSurface,
  inferConcurrencyPolicy,
  analyzeKeepAlive,
  parseClientHintSignals,
  analyzeGeoBehavior,
  assessClientIpTrust,
  assessForwardedIpFeatures,
  measureKeyRevocationTimeline,
} from '../src/engines/apiBehaviorHeaderRecon.js';

// ------------------------------------------------------------ registry ----

test('registry covers ideas 1301-1310', () => {
  assert.deepEqual(WAVE1301_COVERAGE, [1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310]);
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1301], 'detectPassthroughHeaders');
  assert.equal(map[1310], 'measureKeyRevocationTimeline');
});

// ---------------------------------------------------------------- 1301 ----

test('1301: passthrough backend headers with internal IP leak are flagged', () => {
  const r = detectPassthroughHeaders({
    gatewayHeaders: { 'content-type': 'application/json', 'x-request-id': 'abc' },
    originHeaders: {
      'content-type': 'application/json',
      'x-backend-server': 'web-01',
      'x-internal-ip': '10.0.4.12',
      'x-powered-by': 'Express 4.17.1',
    },
  });
  const leaked = r.passthrough.filter((p) => p.leaked).map((p) => p.name);
  assert.ok(leaked.includes('x-backend-server'));
  assert.ok(leaked.includes('x-internal-ip'));
  assert.ok(leaked.includes('x-powered-by'));
  assert.equal(r.leakedCount, 3);
  assert.equal(r.internalIpCount, 1);
  assert.equal(r.versionCount, 1);
  const ipEntry = r.passthrough.find((p) => p.name === 'x-internal-ip');
  assert.ok(ipEntry.flags.includes('internal-ip-leak'));
});

test('1301: header rewritten by gateway is not counted as passthrough', () => {
  const r = detectPassthroughHeaders({
    gatewayHeaders: { server: 'gateway/2.1' },
    originHeaders: { server: 'nginx/1.25.0' },
  });
  assert.equal(r.passthrough.length, 0);
  assert.equal(r.leakedCount, 0);
});

test('1301: empty inputs produce empty results', () => {
  const r = detectPassthroughHeaders();
  assert.equal(r.passthrough.length, 0);
  assert.equal(r.leakedCount, 0);
  assert.equal(r.internalIpCount, 0);
  assert.equal(r.versionCount, 0);
});

// ---------------------------------------------------------------- 1302 ----

test('1302: p50/p99 computed per endpoint from samples', () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({ endpoint: '/api/search', latencyMs: i + 1 }));
  const r = computeLatencyProfile(samples);
  assert.equal(r['/api/search'].count, 100);
  assert.equal(r['/api/search'].p50, 50);
  assert.equal(r['/api/search'].p99, 99);
  assert.equal(r['/api/search'].min, 1);
  assert.equal(r['/api/search'].max, 100);
});

test('1302: endpoints profiled independently', () => {
  const r = computeLatencyProfile([
    { endpoint: '/fast', latencyMs: 10 },
    { endpoint: '/fast', latencyMs: 20 },
    { endpoint: '/slow', latencyMs: 5000 },
  ]);
  assert.equal(r['/fast'].p50, 10);
  assert.equal(r['/slow'].p99, 5000);
  assert.equal(Object.keys(r).length, 2);
});

test('1302: malformed samples are ignored', () => {
  const r = computeLatencyProfile([
    { endpoint: '/x', latencyMs: 100 },
    { endpoint: '/x', latencyMs: -5 },
    { endpoint: '/x', latencyMs: 'oops' },
    { latencyMs: 100 },
    null,
  ]);
  assert.equal(r['/x'].count, 1);
});

// ---------------------------------------------------------------- 1303 ----

test('1303: endpoints ranked by cost, slowest authenticated first', () => {
  const r = rankCostSurface([
    { endpoint: '/api/health', p99: 12, authenticated: false },
    { endpoint: '/api/report', p99: 4500, authenticated: true },
    { endpoint: '/api/export', p99: 9000, authenticated: false },
  ]);
  assert.equal(r[0].endpoint, '/api/export');
  assert.equal(r[1].endpoint, '/api/report');
  assert.equal(r[2].endpoint, '/api/health');
  assert.ok(r[0].tier === 'HIGH' || r[0].tier === 'CRITICAL');
  assert.equal(r[2].tier, 'LOW');
});

test('1303: auth boost raises score of authenticated endpoint', () => {
  const [authed, anon] = rankCostSurface([
    { endpoint: '/a', p99: 1000, authenticated: true },
    { endpoint: '/b', p99: 1000, authenticated: false },
  ]).sort((x, y) => (x.endpoint === '/a' ? -1 : 1));
  assert.ok(authed.costScore > anon.costScore);
});

test('1303: empty profiles return empty ranking', () => {
  assert.deepEqual(rankCostSurface([]), []);
});

// ---------------------------------------------------------------- 1304 ----

test('1304: throttling at parallelism level infers limit one below', () => {
  const r = inferConcurrencyPolicy([
    { endpoint: '/api/hunt', parallelism: 5, accepted: 5, throttled: 0, retried: 0 },
    { endpoint: '/api/hunt', parallelism: 10, accepted: 10, throttled: 0, retried: 0 },
    { endpoint: '/api/hunt', parallelism: 20, accepted: 14, throttled: 6, retried: 6 },
  ]);
  assert.equal(r['/api/hunt'].estimatedLimit, 19);
  assert.equal(r['/api/hunt'].policy, 'throttle-at-limit');
  assert.ok(r['/api/hunt'].evidence.length >= 2);
});

test('1304: no throttling observed reports no-throttle-observed', () => {
  const r = inferConcurrencyPolicy([
    { endpoint: '/api/ping', parallelism: 50, accepted: 50, throttled: 0, retried: 0 },
  ]);
  assert.equal(r['/api/ping'].estimatedLimit, null);
  assert.equal(r['/api/ping'].policy, 'no-throttle-observed');
});

// ---------------------------------------------------------------- 1305 ----

test('1305: keep-alive header parsed into timeout and max', () => {
  const r = analyzeKeepAlive([
    { endpoint: '/api/hunt', headers: { connection: 'keep-alive', 'keep-alive': 'timeout=5, max=100' } },
  ]);
  const e = r['/api/hunt'];
  assert.equal(e.keepAliveSupported, true);
  assert.equal(e.timeoutSec, 5);
  assert.equal(e.maxRequests, 100);
  assert.equal(e.connectionBehavior, 'keep-alive');
});

test('1305: server that closes connections is flagged', () => {
  const r = analyzeKeepAlive([
    { endpoint: '/api/hunt', headers: { connection: 'close' } },
  ]);
  const e = r['/api/hunt'];
  assert.equal(e.keepAliveSupported, false);
  assert.equal(e.connectionBehavior, 'close-per-request');
});

test('1305: short timeout produces aggressive-teardown note', () => {
  const r = analyzeKeepAlive([
    { endpoint: '/e', headers: { connection: 'keep-alive', 'keep-alive': 'timeout=2, max=8' } },
  ]);
  assert.ok(r['/e'].notes.some((n) => n.includes('aggressive')));
  assert.ok(r['/e'].notes.some((n) => n.includes('Low max-requests')));
});

// ---------------------------------------------------------------- 1306 ----

test('1306: Accept-CH + Vary client hints detected as fingerprinting', () => {
  const r = parseClientHintSignals({
    'accept-ch': 'Sec-CH-UA-Full-Version, Sec-CH-UA-Model, Sec-CH-UA-Platform',
    vary: 'Sec-CH-UA, Sec-CH-UA-Mobile, Accept-Encoding',
  });
  assert.equal(r.deviceFingerprinting, true);
  assert.ok(r.signals.includes('accept-ch'));
  assert.ok(r.signals.some((s) => s.startsWith('vary:')));
  assert.equal(r.riskLevel, 'HIGH');
});

test('1306: no hint headers means no fingerprinting', () => {
  const r = parseClientHintSignals({ 'content-type': 'application/json' });
  assert.equal(r.deviceFingerprinting, false);
  assert.equal(r.riskLevel, 'LOW');
  assert.equal(r.signals.length, 0);
});

// ---------------------------------------------------------------- 1307 ----

test('1307: region-gated features mapped across geo header values', () => {
  const r = analyzeGeoBehavior([
    { geoHeaderValue: 'US', blocked: false, currency: 'USD', language: 'en', features: ['checkout', 'beta-chat'], status: 200 },
    { geoHeaderValue: 'DE', blocked: false, currency: 'EUR', language: 'de', features: ['checkout'], status: 200 },
    { geoHeaderValue: 'CN', blocked: true, features: ['checkout'], status: 403 },
  ]);
  assert.equal(r.gated, true);
  assert.ok(r.gatedFeatures.includes('beta-chat'));
  assert.ok(!r.gatedFeatures.includes('checkout'));
  assert.ok(r.notes.some((n) => n.includes('CN')));
  assert.equal(r.regionMap['US'].currency, 'USD');
});

test('1307: uniform features across regions are not gated', () => {
  const r = analyzeGeoBehavior([
    { geoHeaderValue: 'US', features: ['search'] },
    { geoHeaderValue: 'IN', features: ['search'] },
  ]);
  assert.equal(r.gatedFeatures.length, 0);
  assert.equal(r.gated, false);
});

// ---------------------------------------------------------------- 1308 ----

test('1308: honored spoofed True-Client-IP is UNSAFE with bypass flags', () => {
  const r = assessClientIpTrust([
    { headerName: 'True-Client-IP', spoofedValue: '203.0.113.9', observedClientIp: '203.0.113.9', rateLimited: false, geoCountry: 'US', expectedCountry: 'IN' },
  ]);
  assert.ok(r.trustedHeaders.includes('true-client-ip'));
  assert.ok(r.bypassFlags.some((f) => f.flag === 'rate-control-bypass'));
  assert.ok(r.bypassFlags.some((f) => f.flag === 'geo-bypass'));
  assert.ok(r.verdict.startsWith('UNSAFE'));
});

test('1308: ignored spoofed header is SAFE', () => {
  const r = assessClientIpTrust([
    { headerName: 'X-Real-IP', spoofedValue: '198.51.100.4', observedClientIp: '192.0.2.1', rateLimited: true },
  ]);
  assert.equal(r.trustedHeaders.length, 0);
  assert.ok(r.verdict.startsWith('SAFE'));
});

test('1308: unknown headers are not assessed', () => {
  const r = assessClientIpTrust([
    { headerName: 'X-Custom-IP', spoofedValue: '1.2.3.4', observedClientIp: '1.2.3.4' },
  ]);
  assert.equal(r.trustedHeaders.length, 0);
  assert.ok(r.verdict.startsWith('SAFE'));
});

// ---------------------------------------------------------------- 1309 ----

test('1309: features varying with XFF are flagged sensitive', () => {
  const r = assessForwardedIpFeatures([
    { xff: '203.0.113.9', country: 'US', language: 'en', fraudScore: 12, price: 100 },
    { xff: '198.51.100.77', country: 'RU', language: 'ru', fraudScore: 88, price: 100 },
  ]);
  assert.ok(r.sensitiveFeatures.includes('country'));
  assert.ok(r.sensitiveFeatures.includes('fraudScore'));
  assert.ok(!r.sensitiveFeatures.includes('price'));
  assert.ok(r.notes.some((n) => n.includes('Fraud signal')));
});

test('1309: static features are not sensitive', () => {
  const r = assessForwardedIpFeatures([
    { xff: '203.0.113.9', country: 'US' },
    { xff: '198.51.100.77', country: 'US' },
  ]);
  assert.equal(r.sensitiveFeatures.length, 0);
});

// ---------------------------------------------------------------- 1310 ----

test('1310: propagation delay measured from revocation probes', () => {
  const r = measureKeyRevocationTimeline([
    { secondsAfterRevocation: 0, accepted: true },
    { secondsAfterRevocation: 30, accepted: true },
    { secondsAfterRevocation: 60, accepted: true },
    { secondsAfterRevocation: 300, accepted: false },
  ]);
  assert.equal(r.usableWindowSec, 60);
  assert.equal(r.propagationDelaySec, 300);
  assert.equal(r.verdict, 'STALE');
  assert.equal(r.probesUsed, 4);
});

test('1310: fast rejection under 5s is FAST', () => {
  const r = measureKeyRevocationTimeline([
    { secondsAfterRevocation: 1, accepted: false },
    { secondsAfterRevocation: 3, accepted: false },
  ]);
  assert.equal(r.verdict, 'FAST');
  assert.equal(r.propagationDelaySec, 1);
});

test('1310: key never rejected is STALE with usable window', () => {
  const r = measureKeyRevocationTimeline([
    { secondsAfterRevocation: 0, accepted: true },
    { secondsAfterRevocation: 3600, accepted: true },
  ]);
  assert.equal(r.verdict, 'STALE');
  assert.equal(r.usableWindowSec, 3600);
  assert.equal(r.propagationDelaySec, null);
});

test('1310: no probe data is UNKNOWN', () => {
  const r = measureKeyRevocationTimeline([]);
  assert.equal(r.verdict, 'UNKNOWN');
  assert.equal(r.probesUsed, 0);
});

test('1310: malformed probes are ignored', () => {
  const r = measureKeyRevocationTimeline([
    { secondsAfterRevocation: 10, accepted: true },
    { secondsAfterRevocation: 'oops', accepted: false },
    null,
  ]);
  assert.equal(r.probesUsed, 1);
  assert.equal(r.verdict, 'STALE');
});
