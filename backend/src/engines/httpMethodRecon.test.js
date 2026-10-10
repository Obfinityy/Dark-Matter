import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMethodNotAllowedProbes,
  classifyRouteExistence,
  mapAuthFailureDifferential,
  buildTimingRouteProbes,
  classifyRoutesByTiming,
  buildHeadProbes,
  parseHeadHeaderLeaks,
  buildTraceProbe,
  parseTraceEcho,
  buildCustomMethodProbes,
  analyzeCustomMethodResponses,
  buildCaseSensitivityProbePairs,
  classifyCaseFallthrough,
  buildMethodOverrideProbes,
  classifyOverrideDivergence,
  buildAcceptNegotiationProbes,
  detectDebugSignals,
  buildVendorMimeProbes,
  classifyVersionRepresentation,
  httpMethodReconFinding,
  HTTP_METHOD_RECON,
} from './httpMethodRecon.js';

// Idea 01111
test('01111 buildMethodNotAllowedProbes builds one probe per path', () => {
  const probes = buildMethodNotAllowedProbes(['/api/users', '/api/admin']);
  assert.equal(probes.length, 2);
  assert.equal(probes[0].method, 'DELETE');
  assert.ok(probes[0].detect.includes('405'));
  assert.ok(probes[0].label.includes('/api/users'));
  assert.deepEqual(buildMethodNotAllowedProbes(['', '  ']), []);
});

test('01111 classifyRouteExistence marks 405 paths real, 404-only ghosts', () => {
  const records = [
    { path: '/api/users', method: 'DELETE', status: 405 },
    { path: '/api/users', method: 'GET', status: 200 },
    { path: '/api/nope', method: 'DELETE', status: 404 },
    { path: '/api/nope', method: 'GET', status: 404 },
    { path: '/api/maybe', method: 'GET', status: 500 },
  ];
  const res = classifyRouteExistence(records);
  assert.deepEqual(res.real, ['/api/users']);
  assert.deepEqual(res.ghost, ['/api/nope']);
  assert.equal(res.inconclusive.length, 1);
  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].type, 'route-existence-oracle');
  assert.equal(res.findings[0].confidence, 'high');
});

// Idea 01112
test('01112 mapAuthFailureDifferential splits auth-aware, auth-blind, inconsistent', () => {
  const records = [
    { path: '/api/profile', status: 401, authed: false },
    { path: '/api/profile', status: 200, authed: true },
    { path: '/api/health', status: 200, authed: false },
    { path: '/api/orders', status: 200, authed: false },
    { path: '/api/orders', status: 403, authed: false },
  ];
  const res = mapAuthFailureDifferential(records);
  assert.deepEqual(res.authAware, ['/api/profile']);
  assert.deepEqual(res.authBlind, ['/api/health']);
  assert.deepEqual(res.inconsistent, ['/api/orders']);
  assert.ok(res.findings.some(f => f.type === 'auth-differential-inconsistent'));
  assert.ok(res.findings.some(f => f.type === 'auth-differential-blind'));
});

test('01112 mapAuthFailureDifferential tolerates empty input', () => {
  const res = mapAuthFailureDifferential([]);
  assert.deepEqual(res.authAware, []);
  assert.deepEqual(res.findings, []);
});

// Idea 01113
test('01113 buildTimingRouteProbes emits candidate + control probes', () => {
  const { probes, controlPaths } = buildTimingRouteProbes(['/api/users']);
  assert.ok(probes.length >= 3);
  assert.ok(controlPaths.length >= 2);
  assert.ok(probes.some(p => p.label.startsWith('timing-route:/api/users')));
  assert.ok(probes.some(p => p.label.startsWith('timing-control:')));
});

test('01113 classifyRoutesByTiming flags slow routes as likely real', () => {
  const samples = [
    { path: '/ghost1', status: 404, durationMs: 40 },
    { path: '/ghost1', status: 404, durationMs: 42 },
    { path: '/ghost2', status: 404, durationMs: 38 },
    { path: '/api/users', status: 200, durationMs: 320 },
    { path: '/api/users', status: 200, durationMs: 340 },
    { path: '/api/fast', status: 200, durationMs: 41 },
  ];
  const res = classifyRoutesByTiming(samples);
  assert.ok(res.baselineMedianMs !== null);
  assert.deepEqual(res.likelyReal, ['/api/users']);
  assert.deepEqual(res.likelyGhost.sort(), ['/api/fast', '/ghost1', '/ghost2']);
  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].type, 'timing-route-oracle');
  const users = res.routeMedians.find(r => r.path === '/api/users');
  assert.ok(users.medianMs >= 300);
});

// Idea 01114
test('01114 buildHeadProbes + parseHeadHeaderLeaks surface header leaks', () => {
  const probes = buildHeadProbes(['/api/users']);
  assert.equal(probes.length, 1);
  assert.equal(probes[0].method, 'HEAD');
  const res = parseHeadHeaderLeaks(
    { 'Content-Length': '512', Allow: 'GET, POST', 'X-Debug': 'on', Server: 'nginx' },
    '/api/users',
  );
  assert.equal(res.contentLength, '512');
  assert.deepEqual(res.allowedMethods, ['GET', 'POST']);
  assert.ok('x-debug' in res.diagnosticHeaders);
  assert.ok(res.findings.some(f => f.type === 'head-allow-enumeration'));
  assert.ok(res.findings.some(f => f.type === 'head-header-leak'));
});

// Idea 01115
test('01115 buildTraceProbe + parseTraceEcho detect enabled TRACE', () => {
  const probe = buildTraceProbe('/api/echo', { marker: 'mkr123' });
  assert.equal(probe.method, 'TRACE');
  assert.equal(probe.headers['X-Trace-Marker'], 'mkr123');
  assert.ok(probe.detect.includes('mkr123'));
  const enabled = parseTraceEcho({
    status: 200,
    headers: { 'Content-Type': 'message/http' },
    body: 'TRACE /api/echo HTTP/1.1\nX-Trace-Marker: mkr123',
    marker: 'mkr123',
  });
  assert.equal(enabled.traceEnabled, true);
  assert.equal(enabled.echoConfirmed, true);
  assert.equal(enabled.findings[0].type, 'trace-method-enabled');
  const disabled = parseTraceEcho({ status: 405, body: '', marker: 'mkr123' });
  assert.equal(disabled.traceEnabled, false);
  assert.equal(disabled.findings[0].type, 'trace-method-disabled');
});

// Idea 01116
test('01116 buildCustomMethodProbes + analyzeCustomMethodResponses catch accepted verbs', () => {
  const probes = buildCustomMethodProbes(['/api/admin'], { verbs: ['PURGE', 'DEBUG'] });
  assert.equal(probes.length, 2);
  assert.ok(probes.every(p => p.path === '/api/admin'));
  const res = analyzeCustomMethodResponses([
    { path: '/api/admin', method: 'PURGE', status: 200 },
    { path: '/api/admin', method: 'DEBUG', status: 501 },
  ]);
  assert.equal(res.accepted.length, 1);
  assert.equal(res.accepted[0].method, 'PURGE');
  assert.deepEqual(res.rejected, ['DEBUG']);
  assert.equal(res.findings[0].type, 'custom-method-accepted');
});

// Idea 01117
test('01117 buildCaseSensitivityProbePairs + classifyCaseFallthrough detect fallthrough', () => {
  const pairs = buildCaseSensitivityProbePairs(['/api/admin'], { methods: ['GET'] });
  assert.equal(pairs.length, 2);
  assert.ok(pairs.some(p => p.method === 'get'));
  const res = classifyCaseFallthrough([
    { path: '/api/admin', method: 'GET', status: 403 },
    { path: '/api/admin', method: 'get', status: 200 },
    { path: '/api/open', method: 'GET', status: 200 },
    { path: '/api/open', method: 'get', status: 200 },
  ]);
  assert.equal(res.fallthroughs.length, 1);
  assert.equal(res.fallthroughs[0].path, '/api/admin');
  assert.equal(res.fallthroughs[0].method, 'get');
  assert.equal(res.findings[0].type, 'method-case-fallthrough');
});

// Idea 01118
test('01118 buildMethodOverrideProbes + classifyOverrideDivergence detect honored override', () => {
  const probes = buildMethodOverrideProbes(['/api/users']);
  assert.ok(probes.some(p => p.label.includes('baseline-get')));
  assert.ok(probes.some(p => p.label.includes('X-HTTP-Method-Override')));
  assert.ok(probes.some(p => p.label.includes('_method')));
  const res = classifyOverrideDivergence([
    { label: 'method-override:/api/users:baseline-get', path: '/api/users', status: 200, bodySignal: 'list' },
    { label: 'method-override:/api/users:header:X-HTTP-Method-Override', path: '/api/users', status: 201, bodySignal: 'created' },
    { label: 'method-override:/api/users:query:_method', path: '/api/users', status: 200, bodySignal: 'list' },
  ]);
  assert.equal(res.honored.length, 1);
  assert.equal(res.honored[0].variant, 'header:X-HTTP-Method-Override');
  assert.equal(res.findings[0].type, 'method-override-honored');
});

// Idea 01119
test('01119 buildAcceptNegotiationProbes + detectDebugSignals catch stack traces', () => {
  const probes = buildAcceptNegotiationProbes(['/api/users']);
  assert.ok(probes.length >= 5);
  assert.ok(probes.some(p => p.headers.Accept === 'text/html'));
  const leak = detectDebugSignals({
    path: '/api/users',
    accept: 'text/html',
    status: 500,
    contentType: 'text/html',
    body: '<html><pre>NullPointerException at com.api.UserController',
  });
  assert.equal(leak.debugLeak, true);
  assert.ok(leak.matchedPatterns.length > 0);
  assert.equal(leak.findings[0].type, 'negotiation-debug-leak');
  const clean = detectDebugSignals({ body: '{"ok":true}' });
  assert.equal(clean.debugLeak, false);
  assert.deepEqual(clean.findings, []);
});

// Idea 01120
test('01120 buildVendorMimeProbes + classifyVersionRepresentation surface versioned MIME', () => {
  const probes = buildVendorMimeProbes(['/api/users'], { versions: [2], suffixes: ['json'] });
  assert.equal(probes.length, 1);
  assert.equal(probes[0].headers.Accept, 'application/vnd.api.v2+json');
  const res = classifyVersionRepresentation([
    { path: '/api/users', mime: 'application/vnd.api.v2+json', status: 200 },
    { path: '/api/users', mime: 'application/vnd.api.v9+json', status: 406 },
  ]);
  assert.equal(res.supported.length, 1);
  assert.equal(res.unsupported.length, 1);
  assert.equal(res.findings[0].type, 'vendor-mime-version-exposed');
});

// Registry + finding builder
test('registry exposes all capabilities and builds findings', () => {
  const keys = Object.keys(HTTP_METHOD_RECON);
  assert.ok(keys.length >= 19);
  assert.ok(typeof HTTP_METHOD_RECON.buildTraceProbe === 'function');
  const f = httpMethodReconFinding({ title: 'smoke', evidence: 'e', targets: ['/x'] });
  assert.ok(f.title.startsWith('HTTP method recon —'));
  assert.equal(f.severity, 'Info');
});
