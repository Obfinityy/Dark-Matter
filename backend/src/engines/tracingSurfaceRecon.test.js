/**
 * tracingSurfaceRecon.test.js — tests for tracingSurfaceRecon.js (ideas 01221–01225).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  isInternalToken,
  buildProxyChainProbe,
  parseViaHeader,
  parseXForwardedFor,
  parseForwardedHeader,
  analyzeProxyChainResponse,
  buildRequestIdProbe,
  analyzeRequestIdTrace,
  buildTraceparentProbe,
  analyzeTraceparentReflection,
  buildB3Probe,
  analyzeB3Propagation,
  tracingEndpointCandidates,
  analyzeTracingEndpoint,
  tracingSurfaceSummary,
} from './tracingSurfaceRecon.js';

test('1221: parses Via/XFF chains and flags internal tiers', () => {
  assert.equal(parseViaHeader('1.1 edge, 1.0 10.0.4.12:8080').length, 2);
  assert.deepEqual(parseXForwardedFor('203.0.113.7, 10.0.4.12'), ['203.0.113.7', '10.0.4.12']);
  assert.equal(parseForwardedHeader('for=192.0.2.1;proto=https').length, 1);
  assert.equal(isInternalToken('10.0.4.12'), true);
  assert.equal(isInternalToken('203.0.113.7'), false);
  const r = analyzeProxyChainResponse({
    status: 200,
    headers: { via: '1.1 edge-proxy, 1.0 10.0.4.12:8080', 'x-forwarded-for': '203.0.113.7, 10.0.4.12' },
    body: 'ok',
  });
  assert.equal(r.verdict, 'exposed');
  assert.ok(r.internalHops.some((h) => h.includes('10.0.4.12')));
  assert.equal(buildProxyChainProbe().record.includes('via'), true);
  const none = analyzeProxyChainResponse({ status: 200, headers: { server: 'nginx' }, body: 'ok' });
  assert.equal(none.verdict, 'none');
});

test('1222: follows canary request ID across services', () => {
  const plan = buildRequestIdProbe('canary-xyz');
  assert.equal(plan.requestHeaders['X-Request-ID'], 'canary-xyz');
  const r = analyzeRequestIdTrace({
    canary: 'canary-xyz',
    records: [
      { endpoint: '/api/a', headers: { 'x-request-id': 'canary-xyz' } },
      { endpoint: '/api/b', headers: { 'x-request-id': 'srv-9f81' } },
    ],
  });
  assert.equal(r.verdict, 'partial');
  assert.ok(r.canaryPropagatedTo.includes('/api/a'));
  assert.equal(r.serviceMintedIds.length, 1);
});

test('1223: detects traceparent reflection', () => {
  const probe = buildTraceparentProbe();
  assert.match(probe.requestHeaders.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  const tid = probe.requestHeaders.traceparent.split('-')[1];
  const r = analyzeTraceparentReflection({
    requestHeaders: probe.requestHeaders,
    status: 200,
    headers: { traceparent: probe.requestHeaders.traceparent },
    body: 'trace ' + tid,
  });
  assert.equal(r.verdict, 'reflected');
  const absent = analyzeTraceparentReflection({
    requestHeaders: probe.requestHeaders,
    status: 200,
    headers: { server: 'nginx' },
    body: 'ok',
  });
  assert.equal(absent.verdict, 'absent');
});

test('1224: detects B3 propagation and format conversion', () => {
  const probe = buildB3Probe();
  assert.ok(probe.requestHeaders['X-B3-TraceId'] && probe.requestHeaders.b3);
  const propagated = analyzeB3Propagation({
    requestHeaders: probe.requestHeaders,
    status: 200,
    headers: { 'x-b3-traceid': probe.requestHeaders['X-B3-TraceId'] },
    body: '',
  });
  assert.equal(propagated.verdict, 'propagated');
  const converted = analyzeB3Propagation({
    requestHeaders: probe.requestHeaders,
    status: 200,
    headers: { traceparent: '00-abc' },
    body: '',
  });
  assert.equal(converted.verdict, 'converted');
});

test('1225: detects exposed tracing endpoints', () => {
  assert.ok(tracingEndpointCandidates().includes('/jaeger'));
  const exposed = analyzeTracingEndpoint({
    path: '/jaeger',
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<title>Jaeger UI</title>jaeger search',
  });
  assert.equal(exposed.verdict, 'exposed');
  assert.equal(exposed.platform, 'jaeger');
  const gated = analyzeTracingEndpoint({ path: '/traces', status: 403, headers: {}, body: '' });
  assert.equal(gated.verdict, 'auth-gated');
  const absent = analyzeTracingEndpoint({ path: '/nope', status: 404, headers: {}, body: 'x' });
  assert.equal(absent.verdict, 'absent');
  assert.equal(typeof tracingSurfaceSummary({ findings: ['a'] }), 'string');
});
