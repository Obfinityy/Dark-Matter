/**
 * apiPathIntel.test.js — node:test coverage for the API path intel
 * engine (ideas 01091–01100). All tests are offline: fixtures are
 * operator-supplied strings/objects fed into pure analysis functions;
 * no network calls are made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommonCrawlQueries,
  parseCommonCrawlRows,
  buildCodeSearchDorks,
  extractPrivateEndpoints,
  extractBuildIds,
  correlateBuildApiVersions,
  grepBundleApiVersions,
  fingerprintErrorFramework,
  extractValidationSchema,
  buildFieldOracleProbes,
  fieldOracleDiff,
  mapValidationStages,
  buildNestedDepthProbes,
  detectNestingCutoff,
  buildArrayLengthProbes,
  estimateArrayCeiling,
  apiPathIntelFinding,
} from './apiPathIntel.js';

// --- Idea 01091 ------------------------------------------------------------
test('Idea 01091 — buildCommonCrawlQueries builds one URL per index', () => {
  const urls = buildCommonCrawlQueries('api.example.com');
  assert.ok(urls.length >= 3, `expected >=3 query urls, got ${urls.length}`);
  assert.ok(urls.every(u => u.startsWith('https://index.commoncrawl.org/')));
  assert.ok(urls.every(u => u.includes('api.example.com')));
  assert.equal(buildCommonCrawlQueries('').length, 0);
});

test('Idea 01091 — parseCommonCrawlRows harvests unique API paths, filters noise', () => {
  const rows = [
    { url: 'https://api.example.com/api/v1/users', mime: 'application/json', timestamp: '20260101000000', digest: 'aaa' },
    { url: 'https://api.example.com/api/v1/users?page=2', mime: 'application/json', timestamp: '20260201000000', digest: 'bbb' },
    { url: 'https://api.example.com/static/app.js', mime: 'application/javascript', timestamp: '20260101000000', digest: 'ccc' },
    { url: 'https://api.example.com/logo.png', mime: 'image/png', timestamp: '20260101000000', digest: 'ddd' },
    { url: 'https://api.example.com/graphql', mime: 'application/json', timestamp: '20260115000000', digest: 'eee' },
    { url: 'https://api.example.com/about', mime: 'text/html', timestamp: '20260101000000', digest: 'fff' },
    '{"url":"https://api.example.com/api/v1/orders","mime":"application/json","timestamp":"20260301000000","digest":"ggg"}',
    'not json at all',
  ];
  const { paths, totalRows, matchedRows, skippedRows } = parseCommonCrawlRows(rows);
  assert.equal(totalRows, 8);
  assert.ok(matchedRows >= 4, `expected >=4 matched, got ${matchedRows}`);
  assert.ok(skippedRows >= 3, `expected >=3 skipped, got ${skippedRows}`);
  const found = paths.map(p => p.path);
  assert.ok(found.includes('/api/v1/users'), `users path missing: ${found}`);
  assert.ok(found.includes('/api/v1/orders'), `orders path missing: ${found}`);
  assert.ok(found.includes('/graphql'), `graphql path missing: ${found}`);
  assert.ok(!found.some(p => p.endsWith('.js') || p.endsWith('.png')), 'static assets leaked into paths');
  const users = paths.find(p => p.path === '/api/v1/users');
  assert.equal(users.count, 2);
  assert.equal(users.lastSeen, '20260201000000');
  assert.equal(users.firstSeen, '20260101000000');
});

// --- Idea 01092 ------------------------------------------------------------
test('Idea 01092 — buildCodeSearchDorks covers postman, env and baseURL angles', () => {
  const dorks = buildCodeSearchDorks({ domain: 'example.com', apiBases: ['https://api.example.com/v2'] });
  assert.ok(dorks.length >= 6, `expected >=6 dorks, got ${dorks.length}`);
  assert.ok(dorks.some(d => d.includes('filename:postman_collection')));
  assert.ok(dorks.some(d => d.includes('extension:env')));
  assert.ok(dorks.some(d => d.includes('https://api.example.com/v2')));
});

test('Idea 01092 — extractPrivateEndpoints mines Postman dumps and URL literals', () => {
  const collection = JSON.stringify({
    info: { _postman_id: 'abc', name: 'internal' },
    item: [
      { name: 'admin users', request: { method: 'GET', url: { raw: 'https://api.example.com/api/internal/admin/users' } } },
      { name: 'nested', item: [{ name: 'secret', request: 'https://api.example.com/v2/secret/config' }] },
    ],
  });
  const code = `${collection}\nconst svc = axios.create({ baseURL: "https://api.example.com/api/v3" });\nconst img = "/static/logo.png";\nconst tpl = "{{base_url}}/api/mobile/sync";`;
  const { endpoints, postmanCollections } = extractPrivateEndpoints(code, { domainHint: 'example.com' });
  assert.equal(postmanCollections, 1);
  const vals = endpoints.map(e => e.endpoint);
  assert.ok(vals.includes('https://api.example.com/api/internal/admin/users'), `postman endpoint missing: ${vals}`);
  assert.ok(vals.includes('https://api.example.com/v2/secret/config'), `nested endpoint missing: ${vals}`);
  assert.ok(vals.includes('https://api.example.com/api/v3'), `baseURL missing: ${vals}`);
  assert.ok(endpoints.some(e => e.source === 'env-template'), 'templated URL not extracted');
  assert.ok(!vals.some(v => v.includes('logo.png')), 'static literal leaked in');
});

// --- Idea 01093 ------------------------------------------------------------
test('Idea 01093 — extractBuildIds finds Next.js, meta and chunkhash markers', () => {
  const html = `<html><head><meta name="build-id" content="bld-9f8e7d"><meta name="api-version" content="v2"></head>` +
    `<body><script>window.__BUILD_ID__="abc12345";</script><script src="/_next/static/Kx7Yq2_wRt9aBcDe/app.js"></script>` +
    `<script>self.webpackChunk=[,"a94b2c6d8e0f1a3b5c7d"];</script></body></html>`;
  const { buildIds } = extractBuildIds(html);
  const kinds = buildIds.map(b => b.kind);
  assert.ok(kinds.includes('data-build-id') || kinds.includes('meta-build-id'), `meta build id missing: ${kinds}`);
  assert.ok(kinds.includes('js-build-id-global'), `global build id missing: ${kinds}`);
  assert.ok(kinds.includes('nextjs-static-prefix'), `next static prefix missing: ${kinds}`);
  assert.ok(buildIds.some(b => b.kind === 'api-version-meta' && b.value === 'v2'), 'api-version meta missing');
});

test('Idea 01093 — correlateBuildApiVersions flags mid-deploy version drift', () => {
  const { mapping, findings } = correlateBuildApiVersions([
    { buildId: 'b1', apiVersion: 'v2', observedAt: '2026-01-01' },
    { buildId: 'b1', apiVersion: 'v3', observedAt: '2026-01-02' },
    { buildId: 'b2', apiVersion: 'v2', observedAt: '2026-01-02' },
    { buildId: 'b3', apiVersion: null },
  ]);
  assert.equal(mapping.length, 3);
  const b1 = mapping.find(m => m.buildId === 'b1');
  assert.deepEqual(b1.apiVersions, ['v2', 'v3']);
  assert.equal(b1.stable, false);
  assert.ok(findings.some(f => f.type === 'build-api-version-drift' && f.buildId === 'b1'), 'drift finding missing');
  assert.ok(findings.some(f => f.type === 'concurrent-version-skew'), 'skew finding missing');
});

// --- Idea 01094 ------------------------------------------------------------
test('Idea 01094 — grepBundleApiVersions groups /vN literals and API_BASE constants', () => {
  const bundle = `const A="/api/v2/users";fetch("/v3/orders");const B='/api/v2/items';` +
    `const API_BASE_URL="https://api.example.com/api/v2";const apiVersion="v3";` +
    `const baseURL="https://staging.example.com/v1";`;
  const { versions, baseConstants } = grepBundleApiVersions(bundle);
  const v2 = versions.find(v => v.version === '/v2');
  const v3 = versions.find(v => v.version === '/v3');
  assert.ok(v2 && v2.hits >= 2, `v2 grouping wrong: ${JSON.stringify(versions)}`);
  assert.ok(v3 && v3.hits >= 2, `v3 grouping wrong: ${JSON.stringify(versions)}`);
  assert.ok(baseConstants.some(c => c.name === 'API_BASE_URL' && c.impliedVersion === '/v2'), `base const missing: ${JSON.stringify(baseConstants)}`);
  assert.ok(baseConstants.some(c => c.name === 'baseURL' && c.impliedVersion === '/v1'), 'staging baseURL missing');
});

// --- Idea 01095 ------------------------------------------------------------
test('Idea 01095 — fingerprintErrorFramework classifies Django, FastAPI, Spring, Rails, Express', () => {
  const cases = [
    ['{"detail":"Not authenticated."}', 'Django REST Framework'],
    ['{"detail":[{"loc":["body","age"],"msg":"value is not a valid integer","type":"type_error.integer"}]}', 'FastAPI'],
    ['{"timestamp":"2026-01-01T00:00:00","status":400,"error":"Bad Request","message":"Validation failed","path":"/api/x"}', 'Spring Boot'],
    ['<h1>ActionController::RoutingError</h1><p>No route matches [GET] "/x"</p>', 'Ruby on Rails'],
    ['Cannot GET /nope', 'Express'],
  ];
  for (const [body, expected] of cases) {
    const r = fingerprintErrorFramework(body);
    assert.equal(r.framework, expected, `misclassified body: ${body.slice(0, 40)}`);
    assert.equal(r.confidence, 'high');
    assert.ok(r.matchedSignatures.length >= 1);
  }
  const unknown = fingerprintErrorFramework('{"ok":true}');
  assert.equal(unknown.framework, null);
  assert.equal(unknown.confidence, 'none');
});

// --- Idea 01096 ------------------------------------------------------------
test('Idea 01096 — extractValidationSchema enumerates fields, types and constraints', () => {
  const drf = '{"email":["Enter a valid email address."],"age":["Ensure this value is at least 18."],"name":["This field is required."]}';
  const r1 = extractValidationSchema(drf);
  assert.equal(r1.shape, 'drf');
  assert.equal(r1.fields.length, 3);
  const email = r1.fields.find(f => f.name === 'email');
  assert.ok(email.constraints.includes('format:email'), `email constraints: ${email.constraints}`);
  const age = r1.fields.find(f => f.name === 'age');
  assert.ok(age.constraints.includes('min:18'), `age constraints: ${age.constraints}`);
  const name = r1.fields.find(f => f.name === 'name');
  assert.equal(name.required, true);

  const fastapi = '{"detail":[{"loc":["body","page"],"msg":"ensure this value is greater than 0","type":"value_error.number.not_gt"}]}';
  const r2 = extractValidationSchema(fastapi);
  assert.equal(r2.shape, 'fastapi');
  assert.equal(r2.fields[0].name, 'page');
  assert.ok(r2.fields[0].messages[0].length > 0);

  const spring = '{"errors":[{"field":"username","message":"must match \\"^[a-z]+$\\""}]}';
  const r3 = extractValidationSchema(spring);
  assert.equal(r3.shape, 'spring');
  assert.ok(r3.fields[0].constraints.includes('pattern'), `spring constraints: ${r3.fields[0].constraints}`);

  const bad = extractValidationSchema('<html>not json</html>');
  assert.equal(bad.unparsed, true);
  assert.equal(bad.fields.length, 0);
});

// --- Idea 01097 ------------------------------------------------------------
test('Idea 01097 — buildFieldOracleProbes emits one probe per candidate field', () => {
  const probes = buildFieldOracleProbes('/api/v1/users', ['email', 'role', 'is_admin']);
  assert.equal(probes.length, 3);
  assert.ok(probes.every(p => p.method === 'POST' && p.contentType === 'application/json'));
  assert.ok(probes[0].body.role !== undefined || probes[1].body.role !== undefined);
  assert.ok(probes.every(p => p.detect.includes('400')));
});

test('Idea 01097 — fieldOracleDiff confirms, rejects and flags ambiguous fields', () => {
  const baseline = { status: 400, body: '{"zzz_nope_1":["Unknown field."]}' };
  const { confirmed, rejected, ambiguous } = fieldOracleDiff(baseline, [
    { field: 'email', status: 400, body: '{"email":["Enter a valid email address."]}' },
    { field: 'zzz_fake', status: 400, body: '{"zzz_fake":["Unknown field."]}' },
    { field: 'mystery', status: 500, body: '<html>server exploded</html>' },
  ]);
  assert.deepEqual(confirmed, ['email']);
  assert.deepEqual(rejected, ['zzz_fake']);
  assert.equal(ambiguous.length, 1);
  assert.equal(ambiguous[0].field, 'mystery');
});

// --- Idea 01098 ------------------------------------------------------------
test('Idea 01098 — mapValidationStages maps 400/422/5xx onto pipeline stages', () => {
  const { stages, findings } = mapValidationStages([
    { inputLabel: 'malformed-json', status: 400, body: 'Unexpected token' },
    { inputLabel: 'unknown-field', status: 400, body: '{"x":["Unknown field."]}' },
    { inputLabel: 'bad-email', status: 422, body: '{"detail":[{"loc":["body","email"],"msg":"invalid","type":"value_error"}]}' },
    { inputLabel: 'huge-payload', status: 413, body: '' },
    { inputLabel: 'deeply-nested', status: 500, body: 'RecursionError' },
  ]);
  const names = stages.map(s => s.stage);
  assert.ok(names.includes('syntax'), `syntax missing: ${names}`);
  assert.ok(names.includes('semantic'), `semantic missing: ${names}`);
  assert.ok(names.includes('limits'), `limits missing: ${names}`);
  assert.ok(names.includes('crash'), `crash missing: ${names}`);
  const syntax = stages.find(s => s.stage === 'syntax');
  assert.deepEqual(syntax.statuses, [400]);
  assert.equal(syntax.inputs.length, 2);
  assert.ok(findings.some(f => f.type === 'two-stage-validation'), 'two-stage finding missing');
  assert.ok(findings.some(f => f.type === 'validation-pipeline-crash'), 'crash finding missing');
});

// --- Idea 01099 ------------------------------------------------------------
test('Idea 01099 — buildNestedDepthProbes builds increasing-depth payloads', () => {
  const probes = buildNestedDepthProbes('/api/v1/submit', { depths: [2, 4] });
  assert.equal(probes.length, 2);
  const depthOf = body => {
    let d = 0;
    let cur = body.nested;
    while (cur && typeof cur === 'object') {
      d += 1;
      cur = cur.level;
    }
    return d;
  };
  assert.equal(depthOf(probes[0].body), 2);
  assert.equal(depthOf(probes[1].body), 4);
});

test('Idea 01099 — detectNestingCutoff finds the parser rejection depth', () => {
  const r = detectNestingCutoff([
    { depth: 4, status: 200, body: '{"ok":true}' },
    { depth: 8, status: 200, body: '{"ok":true}' },
    { depth: 16, status: 400, body: '{"error":"maximum recursion depth exceeded"}' },
    { depth: 32, status: 500, body: 'RecursionError' },
  ]);
  assert.equal(r.cutoffDepth, 16);
  assert.equal(r.lastAcceptedDepth, 8);
  assert.equal(r.parserError, true);
  const none = detectNestingCutoff([{ depth: 4, status: 200, body: '{}' }]);
  assert.equal(none.cutoffDepth, null);
});

// --- Idea 01100 ------------------------------------------------------------
test('Idea 01100 — buildArrayLengthProbes grows arrays geometrically', () => {
  const probes = buildArrayLengthProbes('/api/v1/batch', { sizes: [10, 100] });
  assert.equal(probes.length, 2);
  assert.equal(probes[0].body.items.length, 10);
  assert.equal(probes[1].body.items.length, 100);
  assert.ok(probes.every(p => p.contentType === 'application/json'));
});

test('Idea 01100 — estimateArrayCeiling bounds the ceiling and reads stated limits', () => {
  const r = estimateArrayCeiling([
    { size: 10, status: 200, body: '{}' },
    { size: 100, status: 200, body: '{}' },
    { size: 500, status: 400, body: '{"error":"items: maximum 250 items allowed"}' },
  ]);
  assert.equal(r.acceptedMax, 100);
  assert.equal(r.rejectedMin, 500);
  assert.equal(r.statedLimit, 250);
  assert.ok(r.ceilingRange.includes('250'), `range: ${r.ceilingRange}`);

  const r2 = estimateArrayCeiling([
    { size: 10, status: 200, body: '{}' },
    { size: 100, status: 422, body: '{"detail":"too many"}' },
  ]);
  assert.equal(r2.acceptedMax, 10);
  assert.equal(r2.rejectedMin, 100);
  assert.equal(r2.statedLimit, null);
  assert.equal(r2.ceilingRange, '11–100');
});

// --- Finding builder -------------------------------------------------------
test('apiPathIntelFinding builds a uniform Info-severity finding', () => {
  const f = apiPathIntelFinding({ title: 'harvested 12 paths', evidence: 'cc rows', targets: ['/api/v1/users'], confidence: 'high' });
  assert.equal(f.title, 'API path intel — harvested 12 paths');
  assert.equal(f.severity, 'Info');
  assert.equal(f.confidence, 'high');
  assert.deepEqual(f.targets, ['/api/v1/users']);
  assert.ok(f.recommendation.length > 20);
});
