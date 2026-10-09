/**
 * realtimeVersionRecon.test.js — node:test assertions for realtimeVersionRecon.js.
 * Ideas 01061–01070, at least one test per idea.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  graphqlWsHandshakeProbes,
  analyzeSubscriptionHandshakeResponse,
  sseEndpointProbePaths,
  sseProbeDescriptors,
  analyzeSseResponseHeaders,
  enumerateSseEventTypes,
  lastEventIdReplayProbes,
  analyzeLastEventIdReplay,
  longPollEndpointCandidates,
  longPollRequestSpec,
  analyzeLongPollResponse,
  versionPathCandidates,
  versionPathProbes,
  analyzeVersionPathResults,
  versionHeaderNegotiationVariants,
  versionQueryParamVariants,
  versionSubdomainCandidates,
  analyzeVersionSubdomainResults,
  describeVersionSurface,
  diffVersionSecurityRegressions,
  realtimeVersionReconFinding,
  REALTIME_VERSION_RECON,
} from './realtimeVersionRecon.js';

// ---- Idea 01061: GraphQL subscription handshake test ----
test('graphqlWsHandshakeProbes builds both protocol variants with varied auth payloads', () => {
  const probes = graphqlWsHandshakeProbes();
  assert.ok(probes.length >= 20);
  assert.ok(probes.some(p => p.protocol === 'graphql-ws' && p.messageType === 'connection_init'));
  assert.ok(probes.some(p => p.protocol === 'subscriptions-transport-ws' && p.messageType === 'GQL_CONNECTION_INIT'));
  const labels = probes.map(p => p.label);
  assert.ok(labels.includes('graphql-ws-handshake:empty-payload'));
  assert.ok(labels.includes('graphql-ws-handshake:auth-token-key'));
  assert.ok(probes.every(p => typeof p.note === 'string' && p.note.length > 0));
});

test('graphqlWsHandshakeProbes honors includeLegacy:false', () => {
  const probes = graphqlWsHandshakeProbes({ includeLegacy: false });
  assert.ok(probes.length > 0);
  assert.ok(probes.every(p => p.protocol === 'graphql-ws'));
});

test('analyzeSubscriptionHandshakeResponse flags weak-payload ack as high confidence', () => {
  const findings = analyzeSubscriptionHandshakeResponse(
    JSON.stringify({ type: 'connection_ack' }),
    'graphql-ws-handshake:empty-payload'
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'subscription-handshake-auth-difference');
  assert.equal(findings[0].confidence, 'high');
  assert.ok(findings[0].evidence.length > 0);
});

test('analyzeSubscriptionHandshakeResponse reports rejection plus error-text leak', () => {
  const findings = analyzeSubscriptionHandshakeResponse(
    JSON.stringify({ type: 'connection_error', payload: { message: 'Unauthorized: invalid jwt token' } }),
    'graphql-ws-handshake:bearer-payload'
  );
  assert.ok(findings.some(f => f.type === 'subscription-handshake-rejected'));
  assert.ok(findings.some(f => f.type === 'subscription-error-text-leak'));
  assert.deepEqual(analyzeSubscriptionHandshakeResponse(''), []);
});

// ---- Idea 01062: SSE endpoint discovery ----
test('sseEndpointProbePaths returns canonical candidates', () => {
  const paths = sseEndpointProbePaths();
  assert.ok(paths.includes('/events'));
  assert.ok(paths.includes('/stream'));
  assert.ok(paths.every(p => p.startsWith('/')));
});

test('sseProbeDescriptors builds GET descriptors with event-stream accept', () => {
  const probes = sseProbeDescriptors(['/events', '/stream']);
  assert.equal(probes.length, 2);
  assert.ok(probes.every(p => p.method === 'GET' && p.headers.Accept === 'text/event-stream'));
  assert.equal(probes[0].path, '/events');
});

test('analyzeSseResponseHeaders confirms event-stream and flags wildcard CORS', () => {
  const findings = analyzeSseResponseHeaders(
    { 'Content-Type': 'text/event-stream; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    '',
    '/events'
  );
  assert.ok(findings.some(f => f.type === 'sse-endpoint-confirmed' && f.confidence === 'high'));
  assert.ok(findings.some(f => f.type === 'sse-cors-wildcard'));
});

test('analyzeSseResponseHeaders flags probable frames without event-stream content type', () => {
  const findings = analyzeSseResponseHeaders({ 'Content-Type': 'application/json' }, 'event: tick\ndata: 1\n\n', '/x');
  assert.ok(findings.some(f => f.type === 'sse-probable-frames'));
  assert.deepEqual(analyzeSseResponseHeaders({ 'Content-Type': 'application/json' }, 'plain text', '/x'), []);
});

// ---- Idea 01063: SSE event-type enumeration ----
test('enumerateSseEventTypes catalogs event names and flags sensitive workflows', () => {
  const stream = [
    'event: payment.completed\ndata: {"id":1}\n',
    'event: payment.completed\ndata: {"id":2}\n',
    'event: moderation.flagged\ndata: {"id":9}\n',
    'data: heartbeat\n',
  ].join('\n');
  const { eventTypes, totalFrames, findings } = enumerateSseEventTypes(stream, '/events');
  assert.equal(totalFrames, 4);
  assert.deepEqual(eventTypes[0], { name: 'payment.completed', count: 2 });
  assert.ok(findings.some(f => f.type === 'sse-sensitive-event-type' && f.evidence.includes('payment.completed')));
  assert.ok(findings.some(f => f.type === 'sse-sensitive-event-type' && f.evidence.includes('moderation.flagged')));
});

test('enumerateSseEventTypes handles empty stream', () => {
  const result = enumerateSseEventTypes('');
  assert.deepEqual(result.eventTypes, []);
  assert.equal(result.totalFrames, 0);
  assert.deepEqual(result.findings, []);
});

// ---- Idea 01064: SSE Last-Event-ID replay test ----
test('lastEventIdReplayProbes builds cross product of ids and paths', () => {
  const probes = lastEventIdReplayProbes(['ev-1', 'ev-2'], ['/events']);
  assert.equal(probes.length, 2);
  assert.ok(probes.every(p => ['ev-1', 'ev-2'].includes(p.headers['Last-Event-ID'])));
  assert.equal(probes[0].method, 'GET');
});

test('analyzeLastEventIdReplay flags re-emitted historical frames', () => {
  const replayed = 'id: 7\nevent: order.shipped\ndata: {"order":42,"user_id":991}\n\n';
  const fresh = 'event: tick\ndata: alive\n\n';
  const findings = analyzeLastEventIdReplay(replayed, fresh, '7');
  assert.ok(findings.some(f => f.type === 'sse-last-event-id-replay' && f.confidence === 'high'));
  assert.ok(findings.some(f => f.type === 'sse-possible-cross-user-replay'));
});

test('analyzeLastEventIdReplay is quiet when replay matches fresh stream', () => {
  const same = 'event: tick\ndata: alive\n\n';
  assert.deepEqual(analyzeLastEventIdReplay(same, same, '3'), []);
  assert.deepEqual(analyzeLastEventIdReplay('', '', '3'), []);
});

// ---- Idea 01065: long-polling endpoint discovery ----
test('longPollEndpointCandidates returns hanging-GET path list', () => {
  const paths = longPollEndpointCandidates();
  assert.ok(paths.includes('/poll'));
  assert.ok(paths.includes('/updates'));
});

test('longPollRequestSpec builds a hanging-GET spec with detection criteria', () => {
  const spec = longPollRequestSpec('/poll');
  assert.equal(spec.method, 'GET');
  assert.equal(spec.path, '/poll');
  assert.ok(spec.hangThresholdMs > 0);
  assert.ok(spec.detect.includes(String(spec.hangThresholdMs)));
});

test('analyzeLongPollResponse flags hanging GET and delivered payload', () => {
  const findings = analyzeLongPollResponse(
    { durationMs: 30000, headers: { 'Content-Type': 'application/json' }, body: '{"updates":[]}', path: '/poll' },
    { hangThresholdMs: 8000 }
  );
  assert.ok(findings.some(f => f.type === 'longpoll-hanging-get'));
  assert.ok(findings.some(f => f.type === 'longpoll-delivered-update'));
});

test('analyzeLongPollResponse reports fast responses as non-long-poll', () => {
  const findings = analyzeLongPollResponse({ durationMs: 120, path: '/poll' });
  assert.ok(findings.some(f => f.type === 'longpoll-no-hang' && f.confidence === 'low'));
});

// ---- Idea 01066: API version path enumeration ----
test('versionPathCandidates lists version prefixes', () => {
  const prefixes = versionPathCandidates();
  for (const p of ['/v1', '/v2', '/v3', '/beta', '/internal', '/canary']) assert.ok(prefixes.includes(p));
});

test('versionPathProbes maps a base path into versioned variants', () => {
  const probes = versionPathProbes('/users');
  assert.ok(probes.length > 0);
  assert.ok(probes.some(p => p.path === '/v1/users'));
  assert.ok(probes.some(p => p.path === '/v2/users'));
  assert.ok(probes.every(p => p.method === 'GET'));
});

test('analyzeVersionPathResults flags live versioned paths and behavior diffs', () => {
  const { liveVersions, findings } = analyzeVersionPathResults({
    '/api/users': { status: 200, body: '{"v":2}' },
    '/v1/api/users': { status: 200, body: '{"v":1,"extra":true}' },
    '/v2/api/users': { status: 404, body: 'not found' },
  }, '/api/users');
  assert.deepEqual(liveVersions, ['/api/users', '/v1/api/users']);
  assert.ok(findings.some(f => f.type === 'versioned-path-live' && f.title.includes('/v1/api/users')));
  assert.ok(findings.some(f => f.type === 'versioned-path-behavior-diff'));
});

// ---- Idea 01067: API version header negotiation ----
test('versionHeaderNegotiationVariants covers Accept-version, X-API-Version and vendor MIME', () => {
  const variants = versionHeaderNegotiationVariants(2, { vendor: 'acme' });
  assert.equal(variants.length, 7);
  const headers = variants.flatMap(v => Object.keys(v.headers));
  assert.ok(headers.includes('Accept-Version'));
  assert.ok(headers.includes('X-API-Version'));
  const mime = variants.find(v => v.label.includes('vendor-mime:2'));
  assert.ok(mime.headers.Accept.includes('vnd.acme.v2'));
  assert.deepEqual(versionHeaderNegotiationVariants(''), []);
});

// ---- Idea 01068: API version query-param test ----
test('versionQueryParamVariants builds param/value matrix', () => {
  const variants = versionQueryParamVariants('2');
  assert.ok(variants.length > 0);
  assert.ok(variants.some(v => v.query.version === '2'));
  assert.ok(variants.some(v => v.query.apiVersion === '2'));
  assert.ok(variants.some(v => v.query.v === 'v2'));
  assert.ok(variants.every(v => typeof v.note === 'string' && v.note.length > 0));
});

// ---- Idea 01069: API version subdomain sweep ----
test('versionSubdomainCandidates generates versioned hosts', () => {
  const hosts = versionSubdomainCandidates('example.com').map(c => c.host);
  assert.ok(hosts.includes('v2.api.example.com'));
  assert.ok(hosts.includes('api-v2.example.com'));
  assert.ok(hosts.includes('beta-api.example.com'));
  assert.ok(!hosts.includes('example.com'));
  assert.deepEqual(versionSubdomainCandidates(''), []);
  assert.deepEqual(versionSubdomainCandidates('notahost'), []);
});

test('analyzeVersionSubdomainResults flags resolving versioned hosts', () => {
  const { liveHosts, findings } = analyzeVersionSubdomainResults({
    'v2.api.example.com': { resolves: true, status: 200, server: 'nginx' },
    'beta.api.example.com': { resolves: false },
  });
  assert.deepEqual(liveHosts, ['v2.api.example.com']);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'version-subdomain-live');
  assert.equal(findings[0].confidence, 'high');
});

// ---- Idea 01070: old-version security regression diff ----
test('describeVersionSurface normalizes operator-supplied descriptors', () => {
  const s = describeVersionSurface({
    version: '1',
    paths: ['/users', '/users', '/orders'],
    authChecks: [{ path: '/users', checks: ['JWT', 'Ownership'] }],
  });
  assert.equal(s.version, '1');
  assert.deepEqual(s.paths, ['/users', '/orders']);
  assert.ok(s.checksByPath.get('/users').has('jwt'));
  assert.ok(s.checksByPath.get('/users').has('ownership'));
});

test('diffVersionSecurityRegressions flags checks missing from the old version', () => {
  const oldSurface = {
    version: '1',
    authChecks: [{ path: '/users', checks: ['jwt'] }],
  };
  const newSurface = {
    version: '2',
    authChecks: [{ path: '/users', checks: ['jwt', 'ownership', 'rate-limit'] }],
  };
  const findings = diffVersionSecurityRegressions(oldSurface, newSurface);
  const regression = findings.find(f => f.type === 'version-security-regression');
  assert.ok(regression);
  assert.equal(regression.confidence, 'high');
  assert.ok(regression.evidence.includes('ownership'));
  assert.ok(regression.evidence.includes('rate-limit'));
});

test('diffVersionSecurityRegressions is quiet when versions match', () => {
  const surface = { version: '1', authChecks: [{ path: '/users', checks: ['jwt'] }] };
  assert.deepEqual(diffVersionSecurityRegressions(surface, surface), []);
});

// ---- Uniform finding wrapper + registry ----
test('realtimeVersionReconFinding builds a uniform finding', () => {
  const f = realtimeVersionReconFinding({ title: 'x', confidence: 'high' });
  assert.equal(f.severity, 'Info');
  assert.equal(f.confidence, 'high');
  assert.ok(f.title.startsWith('Realtime/version recon —'));
});

test('REALTIME_VERSION_RECON registry exposes every function', () => {
  const names = [
    'graphqlWsHandshakeProbes', 'analyzeSubscriptionHandshakeResponse',
    'sseEndpointProbePaths', 'sseProbeDescriptors', 'analyzeSseResponseHeaders',
    'enumerateSseEventTypes', 'lastEventIdReplayProbes', 'analyzeLastEventIdReplay',
    'longPollEndpointCandidates', 'longPollRequestSpec', 'analyzeLongPollResponse',
    'versionPathCandidates', 'versionPathProbes', 'analyzeVersionPathResults',
    'versionHeaderNegotiationVariants', 'versionQueryParamVariants',
    'versionSubdomainCandidates', 'analyzeVersionSubdomainResults',
    'describeVersionSurface', 'diffVersionSecurityRegressions',
    'realtimeVersionReconFinding',
  ];
  for (const name of names) assert.equal(typeof REALTIME_VERSION_RECON[name], 'function', name);
});
