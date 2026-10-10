import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARSER_DIFFERENTIAL_RECON,
  PARSER_PROBE_SENTINEL,
  buildDuplicateKeyProbe,
  classifyDuplicateKeyBehavior,
  buildContentTypeDifferentialProbes,
  classifyContentTypeDifferential,
  buildMultipartBoundaryMutations,
  analyzeMultipartMutationResponse,
  buildProtobufProbe,
  buildMessagePackProbe,
  buildYamlProbe,
  buildXmlProbe,
  classifySerializerAcceptance,
  buildGraphqlMultipartProbe,
  analyzeGraphqlMultipartResponse,
  buildOptionsProbe,
  parseAllowHeader,
  diffAllowHeadersAcrossRoutes,
  parserDifferentialReconFinding,
} from './parserDifferentialRecon.js';

test('registry object exposes every exported function and default export', async () => {
  assert.ok(PARSER_DIFFERENTIAL_RECON.buildDuplicateKeyProbe);
  assert.ok(PARSER_DIFFERENTIAL_RECON.diffAllowHeadersAcrossRoutes);
  assert.equal(Object.keys(PARSER_DIFFERENTIAL_RECON).length, 18);
  const mod = await import('./parserDifferentialRecon.js');
  assert.equal(mod.default, PARSER_DIFFERENTIAL_RECON);
});

// Idea 01101 — duplicate JSON key handling
test('Idea 01101: duplicate-key probe carries both sentinels in one JSON body', () => {
  const probe = buildDuplicateKeyProbe('a', 'alpha', 'beta', '/api/items');
  assert.equal(probe.method, 'POST');
  assert.equal(probe.contentType, 'application/json');
  assert.equal(probe.idea, '01101');
  assert.ok(probe.body.includes('"a":"alpha"') && probe.body.includes('"a":"beta"'));
  // Valid JSON shape (duplicate keys are legal JSON text, parse may warn/keep-last)
  assert.doesNotThrow(() => JSON.parse(probe.body));
});

test('Idea 01101: classifier infers first-wins from a response echoing the first sentinel', () => {
  const verdict = classifyDuplicateKeyBehavior('{"handled":"alpha"}', 'alpha', 'beta');
  assert.equal(verdict.verdict, 'first-wins');
  assert.match(verdict.evidence, /first-wins/);
});

test('Idea 01101: classifier infers last-wins from a response echoing the second sentinel', () => {
  const verdict = classifyDuplicateKeyBehavior('value used: beta', 'alpha', 'beta');
  assert.equal(verdict.verdict, 'last-wins');
});

test('Idea 01101: classifier is inconclusive when neither sentinel is echoed', () => {
  const verdict = classifyDuplicateKeyBehavior('{"ok":true}', 'alpha', 'beta');
  assert.equal(verdict.verdict, 'inconclusive');
});

// Idea 01102 — JSON vs form-encoded differential
test('Idea 01102: paired probes mirror the same data in JSON and form bodies', () => {
  const data = { name: 'probe', tag: 'x' };
  const { jsonProbe, formProbe } = buildContentTypeDifferentialProbes(data, '/api/submit');
  assert.equal(jsonProbe.contentType, 'application/json');
  assert.equal(formProbe.contentType, 'application/x-www-form-urlencoded');
  assert.deepEqual(JSON.parse(jsonProbe.body), data);
  assert.ok(formProbe.body.includes('name=probe') && formProbe.body.includes('tag=x'));
});

test('Idea 01102: differential classifier flags status divergence between twins', () => {
  const result = classifyContentTypeDifferential(
    { status: 200, body: '{"ok":true}' },
    { status: 422, body: '{"error":"invalid"}' },
  );
  assert.equal(result.divergent, true);
  assert.equal(result.statusDelta, true);
  assert.ok(result.findings.some(f => f.type === 'content-type-status-divergence'));
});

test('Idea 01102: identical twins are not divergent', () => {
  const result = classifyContentTypeDifferential(
    { status: 200, body: '{"ok":true}' },
    { status: 200, body: '{"ok":true}' },
  );
  assert.equal(result.divergent, false);
  assert.equal(result.findings.length, 0);
});

// Idea 01103 — multipart boundary quirks
test('Idea 01103: mutation set includes five boundary/part-header variations', () => {
  const probes = buildMultipartBoundaryMutations('/upload');
  assert.equal(probes.length, 5);
  assert.ok(probes.every(p => p.contentType.startsWith('multipart/form-data; boundary=')));
  assert.ok(probes.some(p => p.expectedSignal.includes('overlong-boundary')));
  assert.ok(probes.some(p => p.expectedSignal.includes('duplicate-part-name')));
  assert.ok(probes.every(p => p.idea === '01103'));
});

test('Idea 01103: mutated boundary is actually referenced inside the body', () => {
  const probes = buildMultipartBoundaryMutations('/upload');
  const overlong = probes.find(p => p.expectedSignal.includes('overlong-boundary'));
  assert.ok(overlong.body.includes('--infinity-ai-boundary-0123456789-abcdef'));
});

test('Idea 01103: 2xx with sentinel echo means the mutation was accepted', () => {
  const outcome = analyzeMultipartMutationResponse(
    { status: 200, body: `processed ${PARSER_PROBE_SENTINEL}` },
    'uppercase-part-headers',
  );
  assert.equal(outcome.outcome, 'accepted');
});

test('Idea 01103: 2xx without sentinel echo means parts were dropped silently', () => {
  const outcome = analyzeMultipartMutationResponse({ status: 200, body: '{"ok":true}' });
  assert.equal(outcome.outcome, 'parsed-partially');
});

test('Idea 01103: 400 rejection is reported as rejected', () => {
  const outcome = analyzeMultipartMutationResponse({ status: 400, body: 'bad boundary' });
  assert.equal(outcome.outcome, 'rejected');
});

// Idea 01104 — protobuf probe
test('Idea 01104: protobuf probe targets a JSON route with x-protobuf content type', () => {
  const probe = buildProtobufProbe('/api/items');
  assert.equal(probe.contentType, 'application/x-protobuf');
  assert.equal(probe.idea, '01104');
  assert.ok(probe.body.includes(PARSER_PROBE_SENTINEL));
});

// Idea 01105 — msgpack probe
test('Idea 01105: msgpack probe carries the marker body with the right content type', () => {
  const probe = buildMessagePackProbe('/api/items');
  assert.equal(probe.contentType, 'application/msgpack');
  assert.equal(probe.idea, '01105');
});

// Idea 01106 — yaml probe
test('Idea 01106: yaml probe carries a benign YAML mapping', () => {
  const probe = buildYamlProbe('/api/items');
  assert.equal(probe.contentType, 'application/yaml');
  assert.equal(probe.idea, '01106');
  assert.ok(probe.body.startsWith('probe: '));
});

// Idea 01107 — xml probe
test('Idea 01107: xml probe carries a benign XML document', () => {
  const probe = buildXmlProbe('/api/items');
  assert.equal(probe.contentType, 'application/xml');
  assert.equal(probe.idea, '01107');
  assert.ok(probe.body.includes('<probe>'));
});

// Serializer classifier shared by ideas 01104–01107
test('Ideas 01104-01107: 2xx on alternate serializer is silently-accepted', () => {
  const result = classifySerializerAcceptance({ status: 200, body: '{}' }, 'application/x-protobuf');
  assert.equal(result.outcome, 'silently-accepted');
  assert.match(result.evidence, /x-protobuf/);
});

test('Ideas 01104-01107: 415 is an explicit rejection', () => {
  const result = classifySerializerAcceptance({ status: 415, body: '' }, 'application/yaml');
  assert.equal(result.outcome, 'rejected');
});

test('Ideas 01104-01107: 400 validation rejection is ambiguous, not a closed parser', () => {
  const result = classifySerializerAcceptance({ status: 400, body: 'bad request' }, 'application/msgpack');
  assert.equal(result.outcome, 'ambiguous');
});

// Idea 01108 — GraphQL multipart upload
test('Idea 01108: graphql multipart probe follows the spec with operations+map+file parts', () => {
  const probe = buildGraphqlMultipartProbe('/graphql', 'uploadFile');
  assert.equal(probe.method, 'POST');
  assert.ok(probe.contentType.startsWith('multipart/form-data; boundary='));
  assert.ok(probe.body.includes('name="operations"'));
  assert.ok(probe.body.includes('name="map"'));
  assert.ok(probe.body.includes('filename="probe.txt"'));
  assert.ok(probe.body.includes('uploadFile'));
  assert.equal(probe.idea, '01108');
});

test('Idea 01108: processed upload response is detected', () => {
  const outcome = analyzeGraphqlMultipartResponse({ status: 200, body: '{"data":{"uploadFile":{"ok":true}}}' });
  assert.equal(outcome.outcome, 'upload-processed');
});

test('Idea 01108: 400 on the upload probe is a spec rejection', () => {
  const outcome = analyzeGraphqlMultipartResponse({ status: 400, body: 'unsupported' });
  assert.equal(outcome.outcome, 'spec-rejected');
});

// Idea 01109 — OPTIONS enumeration
test('Idea 01109: OPTIONS probe builder emits a bodyless OPTIONS descriptor', () => {
  const probe = buildOptionsProbe('/api/items');
  assert.equal(probe.method, 'OPTIONS');
  assert.equal(probe.path, '/api/items');
  assert.equal(probe.idea, '01109');
});

test('Idea 01109: Allow header parses into a normalized, deduplicated method set', () => {
  const { methods } = parseAllowHeader('get, POST, get, HEAD');
  assert.deepEqual(methods, ['GET', 'HEAD', 'POST']);
});

test('Idea 01109: empty Allow value yields an empty set', () => {
  assert.deepEqual(parseAllowHeader('').methods, []);
});

// Idea 01110 — Allow-header gap analysis
test('Idea 01110: gap diff flags a route missing a sibling-advertised method', () => {
  const { perRoute, union, gaps, findings } = diffAllowHeadersAcrossRoutes({
    '/api/items': 'GET, POST',
    '/api/items/1': 'GET',
  });
  assert.deepEqual(union, ['GET', 'POST']);
  assert.deepEqual(perRoute['/api/items'], ['GET', 'POST']);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].route, '/api/items/1');
  assert.deepEqual(gaps[0].missing, ['POST']);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'allow-header-gap-method');
});

test('Idea 01110: consistent sibling Allow sets produce no gaps', () => {
  const { gaps, findings } = diffAllowHeadersAcrossRoutes({
    '/a': 'GET, POST',
    '/b': 'POST, GET',
  });
  assert.equal(gaps.length, 0);
  assert.equal(findings.length, 0);
});

test('Idea 01110: a route with no Allow header is flagged as missing-header', () => {
  const { gaps } = diffAllowHeadersAcrossRoutes({
    '/api/items': 'GET, POST',
    '/api/legacy': '',
  });
  assert.ok(gaps.some(g => g.route === '/api/legacy' && g.type === 'no-allow-header'));
});

// Finding builder
test('finding builder produces a uniform report record', () => {
  const finding = parserDifferentialReconFinding({
    title: 'last-wins duplicate keys',
    evidence: 'evidence text',
    targets: ['/api/items'],
  });
  assert.match(finding.title, /Parser differential recon/);
  assert.equal(finding.severity, 'Info');
  assert.deepEqual(finding.targets, ['/api/items']);
  assert.ok(finding.recommendation.includes('415'));
});
