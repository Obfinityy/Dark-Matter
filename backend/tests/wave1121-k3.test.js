import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAVERSAL_TOKENS,
  buildTraversalSequenceProbes,
  classifyTraversalDesync,
  INTERNAL_TRUST_HEADERS,
  internalTrustHeaderDictionary,
  buildInternalTrustProbes,
  analyzeInternalTrustResponses,
  DEBUG_HEADER_DICTIONARY,
  debugHeaderDictionary,
  buildDebugVerboseProbes,
  detectDebugVerboseSignals,
  internalHostnameCandidates,
  buildHostHeaderProbes,
  analyzeHostHeaderRouting,
  FORWARDED_HOST_HEADERS,
  forwardedHostSpoofValues,
  buildForwardedHostProbes,
  analyzeForwardedHostRouting,
  ALTERNATE_API_PORTS,
  alternatePortSweepPlan,
  buildAlternatePortProbes,
  classifyPortSweepResults,
  GRPC_DEFAULT_PORT,
  buildGrpcPortProbes,
  parseGrpcReflectionIndicators,
  buildThresholdMappingPlan,
  recordThresholdFromBurst,
  parseRateLimitHeaders,
  modelQuotaWindow,
  collectRateLimitHeaders,
  buildMethodChangeBypassVariants,
  analyzeMethodChangeBypass,
  headerPortRateReconFinding,
  HEADER_PORT_RATE_RECON,
} from '../src/engines/headerPortRateRecon.js';

// ---------- Registry: 10/10 idea coverage ----------

test('registry maps ideas 01141-01150 to technique functions (10/10)', () => {
  const keys = Object.keys(HEADER_PORT_RATE_RECON).sort();
  assert.deepEqual(keys, ['01141','01142','01143','01144','01145','01146','01147','01148','01149','01150']);
  for (const k of keys) assert.equal(typeof HEADER_PORT_RATE_RECON[k], 'function', k);
});

// ---------- Idea 01141: path-traversal in route matching ----------

test('01141: buildTraversalSequenceProbes emits baseline + encoded traversal probes', () => {
  const probes = buildTraversalSequenceProbes('/api', '/admin', { depths: [1, 2] });
  assert.ok(probes.length >= 1 + TRAVERSAL_TOKENS.length * 2);
  assert.equal(probes[0].label, 'traversal:baseline-direct');
  assert.equal(probes[0].path, '/admin');
  const encoded = probes.filter(p => p.path.includes('..%2fadmin') || p.path.includes('..%2Fadmin'));
  assert.ok(encoded.length > 0, 'expected percent-encoded traversal probes');
  assert.ok(probes.every(p => p.method === 'GET' && typeof p.detect === 'string' && p.detect.length > 0));
});

test('01141: classifyTraversalDesync flags desync vs baseline', () => {
  const recs = [
    { label: 'traversal:baseline-direct', status: 403 },
    { label: 'traversal:depth1:..%2f', status: 200, bodySignal: 'admin dashboard' },
    { label: 'traversal:depth1:..%2F', status: 403, bodySignal: null },
  ];
  const out = classifyTraversalDesync(recs);
  assert.equal(out.desynced.length, 1);
  assert.equal(out.desynced[0].label, 'traversal:depth1:..%2f');
  assert.equal(out.clean.length, 1);
  assert.equal(out.findings[0].type, 'traversal-route-desync');
});

// ---------- Idea 01142: X-Internal-Request header trust test ----------

test('01142: internalTrustHeaderDictionary contains X-Internal-Request', () => {
  const dict = internalTrustHeaderDictionary();
  assert.ok(dict['X-Internal-Request']);
  assert.equal(dict['X-Internal-Request'].value, 'true');
  assert.ok(Object.keys(INTERNAL_TRUST_HEADERS).length >= 10);
});

test('01142: buildInternalTrustProbes emits baseline + one probe per header', () => {
  const probes = buildInternalTrustProbes('/admin');
  assert.equal(probes[0].label, 'internal-trust:baseline');
  assert.equal(probes.length, 1 + Object.keys(INTERNAL_TRUST_HEADERS).length);
  const x = probes.find(p => p.label === 'internal-trust:X-Internal-Request');
  assert.ok(x && x.headers['X-Internal-Request'] === 'true');
});

test('01142: analyzeInternalTrustResponses detects trust bypass', () => {
  const recs = [
    { label: 'internal-trust:baseline', status: 403 },
    { label: 'internal-trust:X-Internal-Request', status: 200 },
    { label: 'internal-trust:X-Internal', status: 403 },
  ];
  const out = analyzeInternalTrustResponses(recs);
  assert.equal(out.bypassed.length, 1);
  assert.equal(out.bypassed[0].header, 'X-Internal-Request');
  assert.equal(out.findings[0].type, 'internal-trust-header-bypass');
});

// ---------- Idea 01143: debug-header verbose mode test ----------

test('01143: debugHeaderDictionary has headers and params incl. X-Debug and ?debug=1', () => {
  const dict = debugHeaderDictionary();
  assert.ok(dict.headers['X-Debug']);
  assert.ok(dict.headers['X-Verbose']);
  assert.ok(dict.params.debug);
  assert.ok(Object.keys(DEBUG_HEADER_DICTIONARY.headers).length >= 5);
});

test('01143: buildDebugVerboseProbes covers headers + params + baseline', () => {
  const probes = buildDebugVerboseProbes('/api/users');
  const nHeaders = Object.keys(DEBUG_HEADER_DICTIONARY.headers).length;
  const nParams = Object.keys(DEBUG_HEADER_DICTIONARY.params).length;
  assert.equal(probes.length, 1 + nHeaders + nParams);
  assert.ok(probes.some(p => p.label === 'debug-verbose:header:X-Debug'));
  const paramProbe = probes.find(p => p.label === 'debug-verbose:param:debug');
  assert.ok(paramProbe.path.includes('debug=1'));
});

test('01143: detectDebugVerboseSignals spots stack traces and query logs', () => {
  const out = detectDebugVerboseSignals({
    label: 'debug-verbose:header:X-Debug',
    status: 500,
    body: 'Traceback (most recent call last):\n  File "app.py"\nSELECT * FROM users WHERE id=1\nDB_PASSWORD=hunter2',
  });
  assert.ok(out.verbose);
  assert.ok(out.categories.includes('stack-trace'));
  assert.ok(out.categories.includes('query-log'));
  assert.ok(out.categories.includes('config-dump'));
  assert.equal(out.findings[0].type, 'debug-verbose-mode-enabled');
  const clean = detectDebugVerboseSignals({ body: '{"ok":true}' });
  assert.equal(clean.verbose, false);
});

// ---------- Idea 01144: internal endpoint via Host header ----------

test('01144: internalHostnameCandidates includes loopback forms and internal.* prefixes', () => {
  const c = internalHostnameCandidates('example.com');
  assert.ok(c.includes('localhost'));
  assert.ok(c.includes('127.0.0.1'));
  assert.ok(c.includes('internal.example.com'));
  assert.ok(c.includes('intranet.example.com'));
  assert.ok(c.includes('example.com'));
  assert.equal(new Set(c).size, c.length, 'no duplicates');
});

test('01144: buildHostHeaderProbes + analyzeHostHeaderRouting detect vhost divergence', () => {
  const hosts = internalHostnameCandidates('example.com');
  const probes = buildHostHeaderProbes('/', hosts, { realHost: 'example.com' });
  assert.equal(probes[0].label, 'host-header:baseline');
  assert.ok(probes.some(p => p.headers.Host === 'internal.example.com'));
  const recs = [
    { label: 'host-header:baseline', status: 200, bodySignal: 'public site' },
    { label: 'host-header:internal.example.com', status: 200, bodySignal: 'intranet portal' },
    { label: 'host-header:localhost', status: 400, bodySignal: 'public site' },
  ];
  const out = analyzeHostHeaderRouting(recs);
  assert.equal(out.exposed.length, 2); // signal divergence + status divergence
  assert.ok(out.exposed.some(e => e.host === 'internal.example.com'));
  assert.equal(out.findings[0].type, 'host-header-internal-vhost');
});

// ---------- Idea 01145: X-Forwarded-Host routing test ----------

test('01145: forwardedHostSpoofValues includes internal, external, delimiter tricks', () => {
  const v = forwardedHostSpoofValues('internal.example.com', 'attacker.example');
  assert.ok(v.includes('internal.example.com'));
  assert.ok(v.includes('attacker.example'));
  assert.ok(v.some(x => x.includes('@') || x.includes('#')));
  assert.ok(FORWARDED_HOST_HEADERS.includes('X-Forwarded-Host'));
});

test('01145: buildForwardedHostProbes expands header x spoof matrix', () => {
  const spoofs = forwardedHostSpoofValues('internal.example.com', 'attacker.example');
  const probes = buildForwardedHostProbes('/reset', spoofs);
  assert.equal(probes[0].label, 'forwarded-host:baseline');
  assert.equal(probes.length, 1 + spoofs.length * FORWARDED_HOST_HEADERS.length);
  const fwd = probes.find(p => p.label.startsWith('forwarded-host:Forwarded:'));
  assert.ok(fwd.headers['Forwarded'].includes('host='));
});

test('01145: analyzeForwardedHostRouting flags reflected spoof host', () => {
  const recs = [
    { label: 'forwarded-host:baseline', status: 200, location: null, bodySignal: null },
    { label: 'forwarded-host:X-Forwarded-Host:attacker_example', status: 302, location: 'https://attacker.example/reset-done', bodySignal: null },
    { label: 'forwarded-host:X-Host:internal_example_com', status: 200, location: null, bodySignal: null },
  ];
  const out = analyzeForwardedHostRouting(recs);
  assert.equal(out.honored.length, 1);
  assert.equal(out.honored[0].header, 'X-Forwarded-Host');
  assert.equal(out.findings[0].type, 'forwarded-host-honored');
  assert.equal(out.findings[0].confidence, 'high');
});

// ---------- Idea 01146: alternative-port API sweep ----------

test('01146: alternatePortSweepPlan covers 3000/5000/8000/8080/8443 with schemes', () => {
  const plan = alternatePortSweepPlan('target.example', {});
  const ports = plan.targets.map(t => t.port);
  for (const p of ALTERNATE_API_PORTS) assert.ok(ports.includes(p), `missing port ${p}`);
  assert.equal(plan.host, 'target.example');
  const p8443 = plan.targets.find(t => t.port === 8443);
  assert.deepEqual(p8443.schemes, ['https', 'http']);
});

test('01146: buildAlternatePortProbes + classifyPortSweepResults find open services', () => {
  const plan = alternatePortSweepPlan('target.example', { ports: [3000, 8080], paths: ['/api'] });
  const probes = buildAlternatePortProbes(plan);
  assert.ok(probes.length >= 4); // 2 ports x 2 schemes x 1 path
  assert.ok(probes.every(p => p.target && p.target.url.startsWith('http')));
  const recs = [
    { label: 'alt-port:3000:http:/api', port: 3000, scheme: 'http', reachable: true, status: 200, banner: 'Express' },
    { label: 'alt-port:8080:http:/api', port: 8080, scheme: 'http', reachable: false, status: null, banner: null },
  ];
  const out = classifyPortSweepResults(recs);
  assert.equal(out.open.length, 1);
  assert.equal(out.open[0].port, 3000);
  assert.deepEqual(out.closed, [8080]);
  assert.equal(out.findings[0].type, 'alternate-port-service-exposed');
});

// ---------- Idea 01147: gRPC default-port probe ----------

test('01147: buildGrpcPortProbes targets 50051 with reflection services', () => {
  const probes = buildGrpcPortProbes('target.example');
  assert.equal(GRPC_DEFAULT_PORT, 50051);
  assert.ok(probes[0].target.port === 50051);
  assert.ok(probes.some(p => p.label.includes('grpc.reflection.v1.ServerReflection')));
  assert.ok(probes.some(p => p.label.includes('grpc.reflection.v1alpha.ServerReflection')));
  const refl = probes.find(p => p.label.startsWith('grpc:reflection:'));
  assert.equal(refl.headers['Content-Type'], 'application/grpc');
});

test('01147: parseGrpcReflectionIndicators detects grpc + reflection', () => {
  const out = parseGrpcReflectionIndicators({
    label: 'grpc:reflection:grpc.reflection.v1.ServerReflection',
    headers: { 'content-type': 'application/grpc', 'grpc-status': '0' },
    alpn: 'h2',
    grpcStatus: 0,
  });
  assert.ok(out.grpcDetected);
  assert.equal(out.reflectionEnabled, true);
  assert.equal(out.findings.filter(f => f.type === 'grpc-reflection-enabled').length, 1);
  const none = parseGrpcReflectionIndicators({ headers: { 'content-type': 'text/html' } });
  assert.equal(none.grpcDetected, false);
});

// ---------- Idea 01148: rate-limit threshold mapping ----------

test('01148: buildThresholdMappingPlan builds ordered bursts per endpoint', () => {
  const plan = buildThresholdMappingPlan(['/api/login', '/api/search'], { burstSize: 10 });
  assert.deepEqual(plan.endpoints, ['/api/login', '/api/search']);
  assert.equal(plan.probes.length, 20);
  assert.equal(plan.probes[0].label, 'ratelimit-burst:/api/login#1');
  assert.equal(plan.probes[9].label, 'ratelimit-burst:/api/login#10');
});

test('01148: recordThresholdFromBurst finds the first 429 index', () => {
  const recs = [];
  for (let i = 1; i <= 12; i++) recs.push({ label: `ratelimit-burst:/api/login#${i}`, status: i <= 5 ? 200 : 429 });
  for (let i = 1; i <= 5; i++) recs.push({ label: `ratelimit-burst:/api/search#${i}`, status: 200 });
  const out = recordThresholdFromBurst(recs);
  const login = out.thresholds.find(t => t.endpoint === '/api/login');
  const search = out.thresholds.find(t => t.endpoint === '/api/search');
  assert.equal(login.first429Index, 6);
  assert.equal(login.cutoff, 5);
  assert.equal(login.totalRequests, 12);
  assert.equal(search.first429Index, null);
  assert.ok(out.findings.some(f => f.type === 'ratelimit-threshold-mapped'));
  assert.ok(out.findings.some(f => f.type === 'ratelimit-threshold-not-reached'));
});

// ---------- Idea 01149: rate-limit header parsing ----------

test('01149: parseRateLimitHeaders parses X-RateLimit-* and Retry-After', () => {
  const now = 1_700_000_000_000;
  const parsed = parseRateLimitHeaders({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': '60',
    'Retry-After': '30',
  }, { nowMs: now });
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.remaining, 0);
  assert.equal(parsed.resetEpochMs, now + 60_000);
  assert.equal(parsed.retryAfterSeconds, 30);
  assert.equal(parsed.windowSeconds, 60);
  assert.ok(parsed.sources.includes('retry-after'));
});

test('01149: parseRateLimitHeaders handles IETF draft RateLimit header', () => {
  const parsed = parseRateLimitHeaders({ 'RateLimit': 'limit=200, remaining=150, reset=10' });
  assert.equal(parsed.limit, 200);
  assert.equal(parsed.remaining, 150);
  assert.equal(parsed.windowSeconds, 10);
});

test('01149: modelQuotaWindow + collectRateLimitHeaders aggregate quota model', () => {
  const recs = [
    { label: 'burst:/a#1', headers: { 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '10', 'X-RateLimit-Reset': '120' } },
    { label: 'burst:/a#2', headers: { 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '120' } },
  ];
  const out = collectRateLimitHeaders(recs, { nowMs: 1_700_000_000_000 });
  assert.equal(out.byEndpoint.length, 2);
  assert.equal(out.model.quota, 60);
  assert.equal(out.model.minWindowSeconds, 120);
  assert.equal(out.model.depleted, true);
  assert.equal(out.model.findings[0].type, 'ratelimit-quota-disclosed');
});

// ---------- Idea 01150: rate-limit bypass via method change ----------

test('01150: buildMethodChangeBypassVariants retries limited POST as other methods', () => {
  const variants = buildMethodChangeBypassVariants('/api/submit', 'POST');
  assert.equal(variants[0].label, 'method-bypass:/api/submit:POST:baseline');
  assert.ok(variants.some(v => v.method === 'GET'));
  assert.ok(variants.some(v => v.method === 'PUT'));
  assert.ok(!variants.some(v => v.method === 'POST' && !v.label.endsWith(':baseline') && !v.label.includes('post')));
  assert.ok(variants.some(v => v.label.includes('->post')), 'case-flipped twin included');
});

test('01150: analyzeMethodChangeBypass detects method-keyed limiter', () => {
  const recs = [
    { label: 'method-bypass:/api/submit:POST:baseline', status: 429 },
    { label: 'method-bypass:/api/submit:POST->GET', status: 200 },
    { label: 'method-bypass:/api/submit:POST->PUT', status: 429 },
  ];
  const out = analyzeMethodChangeBypass(recs);
  assert.equal(out.bypassed.length, 1);
  assert.equal(out.bypassed[0].method, 'GET');
  assert.equal(out.findings[0].type, 'ratelimit-method-bypass');
  assert.deepEqual(out.stillLimited, ['method-bypass:/api/submit:POST->PUT']);
});

// ---------- Finding builder ----------

test('headerPortRateReconFinding builds a uniform finding', () => {
  const f = headerPortRateReconFinding({ title: 'test', evidence: 'e', targets: ['t'] });
  assert.ok(f.title.includes('Header/port/rate-limit recon'));
  assert.equal(f.severity, 'Info');
  assert.ok(f.recommendation.length > 50);
});
