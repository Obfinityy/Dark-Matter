import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  measureClockSkew,
  catalogErrorCodes,
  mapErrorFormats,
  mapNonStandardCodes,
  assessHealthDisclosure,
  classifyMetricsExposure,
  assessDebugExposure,
  mapFlagEvaluation,
  mapBucketing,
  detectKillSwitches,
  WAVE1181_COVERAGE,
  ideaFunctions,
} from '../src/engines/errorTimeOpsRecon.js';

// ---------- Idea 1181: Clock-skew measurement ----------

test('1181: measureClockSkew reports skew and flags token-window breach', () => {
  const r = measureClockSkew('2026-10-10T12:10:00Z', '2026-10-10T12:00:00Z');
  assert.equal(r.skewMs, 600000);
  assert.equal(r.serverAhead, true);
  assert.equal(r.exceedsTokenWindow, true);
  assert.ok(r.impact.includes('replay window'), r.impact);
});

test('1181: small skew stays within token window', () => {
  const r = measureClockSkew('2026-10-10T12:00:30Z', '2026-10-10T12:00:00Z');
  assert.equal(r.skewMs, 30000);
  assert.equal(r.exceedsTokenWindow, false);
  assert.ok(r.impact.includes('no token-window impact'), r.impact);
});

test('1181: unparseable timestamps are handled', () => {
  const r = measureClockSkew('not-a-date', '2026-10-10T12:00:00Z');
  assert.ok(Number.isNaN(r.skewMs));
  assert.ok(r.impact.includes('unparseable'), r.impact);
});

// ---------- Idea 1182: Custom error-code catalog ----------

test('1182: catalogErrorCodes groups codes across endpoints with failure notes', () => {
  const r = catalogErrorCodes([
    { endpoint: '/api/login', status: 401, body: 'invalid token supplied', extractedCode: 'AUTH_001' },
    { endpoint: '/api/refresh', status: 401, body: 'session expired', extractedCode: 'AUTH_001' },
    { endpoint: '/api/items', status: 400, body: 'missing required param', extractedCode: 'VAL_010' },
    { endpoint: '/api/nope', status: 404, body: 'nope' },
  ]);
  assert.equal(r.codeCount, 2);
  assert.equal(r.endpointsWithCodes, 3);
  assert.deepEqual(r.codes['AUTH_001'].endpoints.sort(), ['/api/login', '/api/refresh']);
  assert.ok(r.codes['AUTH_001'].failureModes.some((f) => f.includes('auth/session')), r.codes['AUTH_001'].failureModes);
  assert.ok(r.codes['VAL_010'].failureModes.some((f) => f.includes('input-validation')), r.codes['VAL_010'].failureModes);
});

test('1182: empty input yields empty catalog', () => {
  const r = catalogErrorCodes([]);
  assert.equal(r.codeCount, 0);
  assert.equal(r.endpointsWithCodes, 0);
});

// ---------- Idea 1183: Error-code to service mapping ----------

test('1183: mapErrorFormats clusters endpoints by error envelope', () => {
  const r = mapErrorFormats([
    { endpoint: '/api/a', errorFormat: 'rfc7807' },
    { endpoint: '/api/b', errorFormat: 'RFC7807' },
    { endpoint: '/legacy/c', errorFormat: 'plain-text' },
  ]);
  assert.equal(r.clusterCount, 2);
  assert.equal(r.boundaryCandidates, 1);
  const rfc = r.clusters.find((c) => c.format === 'rfc7807');
  assert.deepEqual(rfc.endpoints.sort(), ['/api/a', '/api/b']);
  assert.ok(rfc.boundaryHint.includes('microservice'), rfc.boundaryHint);
});

// ---------- Idea 1184: Non-standard status-code mapping ----------

test('1184: mapNonStandardCodes documents known codes and flags unknown ones', () => {
  const r = mapNonStandardCodes([
    { endpoint: '/a', status: 419 },
    { endpoint: '/b', status: 509 },
    { endpoint: '/c', status: 200 },
    { endpoint: '/d', status: 404 },
    { endpoint: '/e', status: 599 },
    { endpoint: '/f', status: 460 },
  ]);
  const codes = Object.fromEntries(r.codes.map((c) => [c.status, c]));
  assert.ok(codes[419].documented);
  assert.ok(codes[419].stateNote.includes('Laravel') || codes[419].stateNote.includes('CSRF'), codes[419].stateNote);
  assert.ok(codes[599].documented);
  assert.ok(!codes[460].documented);
  assert.ok(codes[460].stateNote.includes('state machine'), codes[460].stateNote);
  assert.equal(r.documentedCount, 3);
  assert.equal(r.undocumentedCount, 1);
  assert.ok(!codes[200] && !codes[404], 'standard codes excluded');
});

// ---------- Idea 1185: Health-check info disclosure ----------

test('1185: assessHealthDisclosure flags versions, deps and instance identity', () => {
  const r = assessHealthDisclosure({
    path: '/health',
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', version: '2.4.1', redis: 'up', hostname: 'api-01', uptime: 123 }),
  });
  assert.equal(r.verbose, true);
  assert.ok(r.findings.includes('version string'), r.findings);
  assert.ok(r.findings.includes('dependency state detail'), r.findings);
  assert.ok(r.findings.includes('instance/hostname identity'), r.findings);
  assert.equal(r.severity, 'medium');
});

test('1185: minimal health body is not verbose', () => {
  const r = assessHealthDisclosure({ path: '/healthz', body: '{"status":"ok"}' });
  assert.equal(r.verbose, false);
  assert.equal(r.severity, 'none');
});

test('1185: credential-looking strings escalate severity', () => {
  const r = assessHealthDisclosure({ path: '/health', body: '{"db_password":"hunter2"}' });
  assert.equal(r.severity, 'high');
});

// ---------- Idea 1186: Metrics endpoint discovery ----------

test('1186: classifyMetricsExposure parses Prometheus series and instance leaks', () => {
  const body = [
    '# HELP http_requests_total Total requests',
    '# TYPE http_requests_total counter',
    'http_requests_total{method="get",instance="api-01:9090"} 1027',
    'go_goroutines 42',
  ].join('\n');
  const r = classifyMetricsExposure({ path: '/metrics', body });
  assert.equal(r.kind, 'prometheus');
  assert.equal(r.prometheusSeries, 2);
  assert.equal(r.instanceLeak, true);
  assert.ok(r.leakedLabels.some((l) => l.startsWith('instance=')), r.leakedLabels);
  assert.ok(r.note.includes('topology'), r.note);
});

test('1186: non-metrics bodies are classified as not-metrics', () => {
  const r = classifyMetricsExposure({ path: '/metrics', body: '<html>not found</html>' });
  assert.equal(r.kind, 'not-metrics');
  assert.equal(r.instanceLeak, false);
});

// ---------- Idea 1187: Debug endpoint sweep ----------

test('1187: assessDebugExposure detects pprof as high risk', () => {
  const r = assessDebugExposure({
    path: '/debug/pprof/',
    body: 'goroutine profile: total 12',
  });
  assert.equal(r.exposed, true);
  assert.ok(r.signals.includes('pprof'), r.signals);
  assert.equal(r.risk, 'high');
});

test('1187: clean endpoint reports no exposure', () => {
  const r = assessDebugExposure({ path: '/api/users', body: '{"users":[]}' });
  assert.equal(r.exposed, false);
  assert.equal(r.risk, 'none');
});

// ---------- Idea 1188: Feature-flag evaluation probe ----------

test('1188: mapFlagEvaluation reveals targeting rules per context', () => {
  const r = mapFlagEvaluation([
    { context: 'anonymous', flagsReturned: { newCheckout: false, darkMode: true } },
    { context: 'premium-user', flagsReturned: { newCheckout: true, darkMode: true } },
  ]);
  assert.equal(r.flagCount, 2);
  assert.equal(r.targetedCount, 1);
  assert.equal(r.flags.newCheckout.targeted, true);
  assert.ok(r.flags.newCheckout.disclosure.includes('server-side'), r.flags.newCheckout.disclosure);
  assert.equal(r.flags.darkMode.targeted, false);
});

// ---------- Idea 1189: A/B bucketing endpoint map ----------

test('1189: mapBucketing extracts experiment names, variants and traffic split', () => {
  const r = mapBucketing([
    {
      endpoint: '/api/assign',
      responseBody: '{"experiment_name":"checkout-redesign","variant":"control","control":50%, "treatment":50%}',
    },
    {
      endpoint: '/api/assign',
      responseBody: '{"experiment_name":"checkout-redesign","variant":"treatment","control":50%, "treatment":50%}',
    },
  ]);
  assert.equal(r.experimentCount, 1);
  const exp = r.experiments[0];
  assert.equal(exp.name, 'checkout-redesign');
  assert.deepEqual(exp.variants.sort(), ['control', 'treatment']);
  assert.equal(exp.trafficSplit.control, 50);
  assert.ok(exp.disclosure.includes('server-side'), exp.disclosure);
});

// ---------- Idea 1190: Kill-switch endpoint detection ----------

test('1190: detectKillSwitches ranks unauthenticated mutating routes highest', () => {
  const r = detectKillSwitches([
    { path: '/admin/kill-switch', method: 'POST', auth: 'none' },
    { path: '/api/maintenance-mode', method: 'GET', auth: 'none' },
    { path: '/api/users', method: 'GET', auth: 'required' },
    { path: '/internal/emergency-stop', method: 'DELETE', auth: 'required' },
  ]);
  assert.equal(r.candidates.length, 3);
  assert.equal(r.candidates[0].path, '/admin/kill-switch');
  assert.equal(r.candidates[0].risk, 'high');
  assert.ok(r.candidates[0].reason.includes('UNAUTHENTICATED'), r.candidates[0].reason);
  assert.equal(r.highRiskCount, 1);
});

test('1190: routes without kill-switch markers are ignored', () => {
  const r = detectKillSwitches([{ path: '/api/health', method: 'GET', auth: 'none' }]);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.highRiskCount, 0);
});

// ---------- Coverage registry ----------

test('coverage: WAVE1181_COVERAGE lists ideas 1181-1190', () => {
  assert.deepEqual(WAVE1181_COVERAGE, [1181, 1182, 1183, 1184, 1185, 1186, 1187, 1188, 1189, 1190]);
});

test('coverage: ideaFunctions maps every idea to an exported function', async () => {
  const mod = await import('../src/engines/errorTimeOpsRecon.js');
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  for (const [idea, fnName] of Object.entries(map)) {
    assert.equal(typeof mod[fnName], 'function', `idea ${idea} -> ${fnName}`);
    assert.ok(WAVE1181_COVERAGE.includes(Number(idea)), `idea ${idea} in coverage`);
  }
});
