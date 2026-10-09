import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  healthCheckDescriptor,
  healthCheckSweepDescriptors,
  classifyHealthResponse,
  grpcWebProbeDescriptors,
  detectGrpcWebSupport,
  transcodingCandidatePaths,
  analyzeTranscodingResponses,
  parseStatusDetails,
  analyzeMetadataLeakage,
  deadlineProbeDescriptors,
  assessDeadlineBehavior,
  sizeProbeLadder,
  classifySizeProbeResult,
  fieldNumberGuessDescriptors,
  analyzeFieldTolerance,
  analyzeStatusMapping,
  keepaliveProbeDescriptor,
  summarizeKeepaliveBehavior,
  grpcAnalysisFinding,
  HEALTH_SERVICE_PATH,
  KNOWN_SERVICE_NAMES,
  GRPC_TO_HTTP_STATUS,
  LEAKY_METADATA_PATTERNS,
} from './grpcAnalysis.js';

// Idea 01031 — health-check protocol probe
test('1031: healthCheckDescriptor builds the Health/Check descriptor', () => {
  const d = healthCheckDescriptor('billing.v1.Billing');
  assert.equal(d.path, `/${HEALTH_SERVICE_PATH}/Check`);
  assert.equal(d.method, 'POST');
  assert.deepEqual(d.requestBody, { service: 'billing.v1.Billing' });
  assert.equal(d.serviceName, 'billing.v1.Billing');
});

test('1031: healthCheckSweepDescriptors covers known service names', () => {
  const sweep = healthCheckSweepDescriptors(['acme.v1.Orders']);
  const names = sweep.map(d => d.serviceName);
  for (const known of KNOWN_SERVICE_NAMES) assert.ok(names.includes(known));
  assert.ok(names.includes('acme.v1.Orders'));
});

test('1031: classifyHealthResponse confirms a serving service', () => {
  const r = classifyHealthResponse({ grpcStatus: 'OK', servingStatus: 'SERVING' });
  assert.equal(r.confirmed, true);
  assert.equal(r.verdict, 'service-present');
  const rejected = classifyHealthResponse({ grpcStatus: 'UNIMPLEMENTED' });
  assert.equal(rejected.confirmed, false);
  assert.equal(rejected.verdict, 'health-not-implemented');
});

// Idea 01032 — gRPC-web support detection
test('1032: grpcWebProbeDescriptors emits content-type variants', () => {
  const probes = grpcWebProbeDescriptors('/acme.v1.Orders/Get');
  assert.ok(probes.length >= 3);
  assert.ok(probes.some(p => p.contentType === 'application/grpc-web'));
  assert.ok(probes.every(p => p.method === 'POST' && p.url === '/acme.v1.Orders/Get'));
});

test('1032: detectGrpcWebSupport detects grpc-web headers', () => {
  const r = detectGrpcWebSupport({ 'content-type': 'application/grpc-web+proto', 'grpc-status': '0' });
  assert.equal(r.supported, true);
  assert.ok(r.evidence.length >= 2);
  const miss = detectGrpcWebSupport({ 'content-type': 'application/json' });
  assert.equal(miss.supported, false);
});

// Idea 01033 — gRPC transcoding discovery
test('1033: transcodingCandidatePaths maps service/method to REST paths', () => {
  const paths = transcodingCandidatePaths('/billing.v1.InvoiceService/CreateInvoice');
  assert.ok(paths.includes('/v1/invoice:CreateInvoice'));
  assert.ok(paths.includes('/v1/invoice/create_invoice'));
  assert.ok(paths.includes('/billing.v1.InvoiceService/CreateInvoice'));
});

test('1033: analyzeTranscodingResponses flags 2xx REST-style answers', () => {
  const r = analyzeTranscodingResponses([
    { path: '/v1/invoice:create_invoice', httpStatus: 200 },
    { path: '/v1/invoice/delete', httpStatus: 404 },
  ]);
  assert.equal(r.suspicious.length, 1);
  assert.equal(r.suspicious[0].path, '/v1/invoice:create_invoice');
});

// Idea 01034 — error-detail leakage analysis
test('1034: parseStatusDetails extracts field violations and debug info', () => {
  const payload = JSON.stringify({
    code: 3,
    message: 'invalid',
    details: [
      { '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'email', description: 'must be a valid email' }] },
      { '@type': 'type.googleapis.com/google.rpc.DebugInfo', stackEntries: ['a()', 'b()'], detail: 'boom' },
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'ACME_QUOTA', domain: 'acme.internal', metadata: { tier: 'gold' } },
    ],
  });
  const r = parseStatusDetails(payload);
  assert.equal(r.detailCount, 3);
  assert.ok(r.leaks.some(l => l.kind === 'field-constraint' && l.field === 'email'));
  assert.ok(r.leaks.some(l => l.kind === 'stack-trace'));
  assert.ok(r.leaks.some(l => l.kind === 'internal-reason' && l.detail === 'ACME_QUOTA'));
  assert.ok(r.leaks.some(l => l.kind === 'internal-domain' && l.detail === 'acme.internal'));
});

// Idea 01035 — metadata leakage check
test('1035: analyzeMetadataLeakage flags internal hosts and versions', () => {
  const r = analyzeMetadataLeakage(
    { 'x-service-version': '2.4.1', 'x-backend-host': 'grpc-01.corp.internal' },
    { 'grpc-status': '0' },
  );
  assert.ok(r.findings.some(f => f.source === 'header' && f.name === 'x-service-version'));
  assert.ok(r.internalHosts.includes('grpc-01.corp.internal'));
  const clean = analyzeMetadataLeakage({ 'content-type': 'application/grpc' }, {});
  assert.equal(clean.findings.length, 0);
});

// Idea 01036 — deadline abuse test
test('1036: deadlineProbeDescriptors covers zero and absurd deadlines', () => {
  const probes = deadlineProbeDescriptors();
  assert.ok(probes.some(p => p.deadline === '0s'));
  assert.ok(probes.some(p => p.deadline === '100y'));
  assert.ok(probes.every(p => typeof p.intent === 'string' && p.intent.length > 0));
  assert.ok(probes.some(p => p.grpcTimeoutHeader === '-1s'));
});

test('1036: assessDeadlineBehavior rates a hung deadline high', () => {
  const r = assessDeadlineBehavior({ deadline: '1ns', outcome: 'hung', elapsedMs: 30000 });
  assert.equal(r.risk, 'high');
  const ok = assessDeadlineBehavior({ deadline: '1ns', outcome: 'deadline-exceeded' });
  assert.equal(ok.risk, 'low');
});

// Idea 01037 — max-message-size probing
test('1037: sizeProbeLadder is increasing and bounded', () => {
  const ladder = sizeProbeLadder(1024, 1024 * 1024, 5);
  assert.equal(ladder.length, 5);
  assert.equal(ladder[0], 1024);
  assert.equal(ladder[4], 1024 * 1024);
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i] > ladder[i - 1]);
});

test('1037: classifySizeProbeResult spots the limit rung', () => {
  assert.equal(classifySizeProbeResult({ bytes: 1024, grpcStatus: 'OK' }).verdict, 'accepted');
  assert.equal(classifySizeProbeResult({ bytes: 1 << 24, grpcStatus: 'RESOURCE_EXHAUSTED' }).verdict, 'rejected');
  assert.equal(classifySizeProbeResult({ bytes: 8 }).verdict, 'inconclusive');
});

// Idea 01038 — proto field-number guessing
test('1038: fieldNumberGuessDescriptors skips reserved ranges', () => {
  const probes = fieldNumberGuessDescriptors('acme.v1.Order', [99, 19001, 1000]);
  const nums = probes.map(p => p.fieldNumber);
  assert.ok(nums.includes(99));
  assert.ok(nums.includes(1000));
  assert.ok(!nums.includes(19001), 'reserved range 19000-19999 must be skipped');
  assert.equal(probes[0].messageType, 'acme.v1.Order');
});

test('1038: analyzeFieldTolerance distinguishes strict vs lenient parsers', () => {
  const strict = analyzeFieldTolerance([{ fieldNumber: 99, outcome: 'rejected' }, { fieldNumber: 100, outcome: 'error' }]);
  assert.equal(strict.tolerance, 'strict');
  const lenient = analyzeFieldTolerance([{ fieldNumber: 99, outcome: 'ignored' }, { fieldNumber: 100, outcome: 'accepted' }]);
  assert.equal(lenient.tolerance, 'lenient');
  const mixed = analyzeFieldTolerance([{ fieldNumber: 99, outcome: 'ignored' }, { fieldNumber: 100, outcome: 'rejected' }]);
  assert.equal(mixed.tolerance, 'mixed');
});

// Idea 01039 — status-to-HTTP mapping analysis
test('1039: analyzeStatusMapping flags inconsistent mappings', () => {
  const r = analyzeStatusMapping([
    { transport: 'grpc', status: 5 },
    { transport: 'rest', status: 500 }, // NOT_FOUND should map to 404
  ]);
  assert.equal(r.consistent, false);
  assert.equal(r.mismatches.length, 1);
  assert.equal(r.mismatches[0].expectedHttp, GRPC_TO_HTTP_STATUS[5]);
  const ok = analyzeStatusMapping([
    { transport: 'grpc', status: 5 },
    { transport: 'rest', status: 404 },
  ]);
  assert.equal(ok.consistent, true);
});

// Idea 01040 — keepalive behavior probe
test('1040: keepaliveProbeDescriptor has three observation phases', () => {
  const d = keepaliveProbeDescriptor('/acme.v1.Orders/Subscribe');
  assert.equal(d.phases.length, 3);
  assert.ok(d.phases.every(p => typeof p.observe === 'string' && p.idleSeconds > 0));
  assert.equal(d.target, '/acme.v1.Orders/Subscribe');
});

test('1040: summarizeKeepaliveBehavior assesses long idle holds', () => {
  const r = summarizeKeepaliveBehavior({ phase: 'sparse-ping', serverClosed: false, goawayReceived: false, maxIdleSeconds: 900 });
  assert.equal(r.risk, 'medium');
  const enforced = summarizeKeepaliveBehavior({ phase: 'aggressive-ping', serverClosed: true, goawayReceived: true });
  assert.equal(enforced.risk, 'low');
});

// Finding builder + registry sanity
test('grpcAnalysisFinding builds a finding with leak-weighted severity', () => {
  const f = grpcAnalysisFinding({ title: 'gRPC surface analysis', evidence: ['health ok'], leaks: 2, confirmedServices: ['billing.v1.Billing'] });
  assert.equal(f.severity, 'Medium');
  assert.equal(f.leakCount, 2);
  assert.deepEqual(f.confirmedServices, ['billing.v1.Billing']);
});

test('registry exports are present and sane', () => {
  assert.ok(HEALTH_SERVICE_PATH.length > 0);
  assert.ok(KNOWN_SERVICE_NAMES.length > 0);
  assert.ok(LEAKY_METADATA_PATTERNS.length > 0);
  assert.equal(GRPC_TO_HTTP_STATUS[3], 400);
});
