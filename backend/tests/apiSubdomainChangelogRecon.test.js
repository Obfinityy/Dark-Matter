/**
 * apiSubdomainChangelogRecon.test.js — tests for idea-bank ideas 1281-1290.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1281_COVERAGE,
  ideaFunctions,
  redactPii,
  normalizeDomain,
  subdomainCandidates,
  parseChangelogEndpoints,
  splitChangelogBlocks,
  buildStatusCodeOracle,
  assessRapidResetHandling,
  scoreSmugglingGuard,
  diffOptionsResponses,
  extractDocLinks,
  harvestOpenApiExamples,
  enumerateServerUrls,
  classifyEnvironment,
  discoverCallbacks,
  apiSubdomainChangelogReconFinding,
} from '../src/engines/apiSubdomainChangelogRecon.js';

// ---------------------------------------------------------------- registry
test('coverage registry lists ideas 1281-1290', () => {
  assert.deepEqual(WAVE1281_COVERAGE, [1281, 1282, 1283, 1284, 1285, 1286, 1287, 1288, 1289, 1290]);
});

test('ideaFunctions maps every idea number to its function', () => {
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1281], 'subdomainCandidates');
  assert.equal(map[1282], 'parseChangelogEndpoints');
  assert.equal(map[1283], 'buildStatusCodeOracle');
  assert.equal(map[1284], 'assessRapidResetHandling');
  assert.equal(map[1285], 'scoreSmugglingGuard');
  assert.equal(map[1286], 'diffOptionsResponses');
  assert.equal(map[1287], 'extractDocLinks');
  assert.equal(map[1288], 'harvestOpenApiExamples');
  assert.equal(map[1289], 'enumerateServerUrls');
  assert.equal(map[1290], 'discoverCallbacks');
});

// ---------------------------------------------------------------- redactPii
test('redactPii redacts email addresses', () => {
  assert.equal(redactPii('contact dev@example.com today'), 'contact [REDACTED:email] today');
});

test('redactPii redacts long tokens', () => {
  const out = redactPii('key EXAMPLE_TOKEN_4eC39HqLyjWDarjtT1zdp7dc');
  assert.ok(!out.includes('EXAMPLE_TOKEN_4eC39HqLyjWDarjtT1zdp7dc'));
  assert.ok(out.includes('[REDACTED:token]'));
});

test('redactPii leaves benign values untouched', () => {
  assert.equal(redactPii('us-east-1'), 'us-east-1');
  assert.equal(redactPii('v2'), 'v2');
});

test('normalizeDomain strips scheme, path and port', () => {
  assert.equal(normalizeDomain('https://Admin-Example.COM:8443/docs'), 'admin-example.com');
  assert.equal(normalizeDomain('not a domain!!'), '');
});

// ---------------------------------------------------------------- 1281 ----
test('1281: builds admin/internal-first candidate hostnames', () => {
  const r = subdomainCandidates('example.com');
  assert.equal(r.domain, 'example.com');
  const hosts = r.candidates.map((c) => c.host);
  assert.ok(hosts.includes('admin-api.example.com'));
  assert.ok(hosts.includes('internal-api.example.com'));
  assert.equal(r.candidates[0].labelClass, 'admin-api');
});

test('1281: returns empty candidates for invalid domain', () => {
  const r = subdomainCandidates('???');
  assert.equal(r.domain, '');
  assert.deepEqual(r.candidates, []);
});

// ---------------------------------------------------------------- 1282 ----
const CHANGELOG = `
## 2.4.0
- Added \`GET /v2/billing/invoices\` for invoice listing.
- New internal endpoint '/v2/admin/feature-flags' for ops tooling.

## 2.3.0
- Deprecated \`DELETE /v1/users/{id}\`.
`;

test('1282: extracts versioned endpoint mentions', () => {
  const r = parseChangelogEndpoints(CHANGELOG);
  assert.equal(r.idea, '01282');
  assert.equal(r.versions.length, 2);
  const v240 = r.versions.find((v) => v.version === '2.4.0');
  assert.ok(v240.endpoints.some((e) => e.method === 'GET' && e.path === '/v2/billing/invoices'));
  assert.ok(v240.endpoints.some((e) => e.path === '/v2/admin/feature-flags' && e.source === 'word-mention'));
});

test('1282: splits unversioned text into one block', () => {
  assert.deepEqual(splitChangelogBlocks('just notes'), [{ version: 'unversioned', text: 'just notes' }]);
  assert.deepEqual(splitChangelogBlocks(''), []);
});

// ---------------------------------------------------------------- 1283 ----
test('1283: flags resources whose status codes vary by state', () => {
  const r = buildStatusCodeOracle([
    { resource: '/orders/9', state: 'pending', status: 200 },
    { resource: '/orders/9', state: 'cancelled', status: 404 },
    { resource: '/health', state: 'ok', status: 200 },
    { resource: '/health', state: 'ok', status: 200 },
  ]);
  assert.ok(r.leaks.includes('/orders/9'));
  assert.ok(!r.leaks.includes('/health'));
  assert.equal(r.oracle['/orders/9'].code, 404);
  assert.equal(r.oracle['/orders/9'].leaksState, true);
});

test('1283: skips malformed samples', () => {
  const r = buildStatusCodeOracle([null, { resource: '/x', state: 's' }]);
  assert.deepEqual(r.leaks, []);
});

// ---------------------------------------------------------------- 1284 ----
test('1284: probe plan is rate-bounded and diagnostic only', () => {
  const r = assessRapidResetHandling();
  assert.equal(r.idea, '01284');
  assert.ok(r.probePlan.every((p) => p.maxStreams <= 2));
  assert.equal(r.risk, 'unknown');
});

test('1284: scores low risk when accounting holds', () => {
  const r = assessRapidResetHandling({ observedResets: 40, accountingHolds: true, frontendServer: 'envoy' });
  assert.equal(r.risk, 'low');
  assert.ok(r.assessment.includes('envoy'));
});

test('1284: scores high risk when accounting drops resets', () => {
  const r = assessRapidResetHandling({ observedResets: 40, accountingHolds: false, frontendServer: 'envoy' });
  assert.equal(r.risk, 'high');
  assert.ok(r.assessment.includes('escalate'));
});

// ---------------------------------------------------------------- 1285 ----
test('1285: guard-holds when every response is normalised', () => {
  const r = scoreSmugglingGuard({
    responses: [
      { requestId: 'r1', normalised: true, backendStatus: 400 },
      { requestId: 'r2', normalised: true, backendStatus: 400 },
    ],
  });
  assert.equal(r.verdict, 'guard-holds');
  assert.equal(r.score, 100);
});

test('1285: partial guard when some ambiguous framing reaches backends', () => {
  const r = scoreSmugglingGuard({
    responses: [
      { requestId: 'r1', normalised: true, backendStatus: 400 },
      { requestId: 'r2', normalised: false, backendStatus: 200 },
    ],
  });
  assert.equal(r.verdict, 'partial-guard');
  assert.equal(r.score, 50);
  assert.ok(r.details.some((d) => d.includes('unnormalised')));
});

test('1285: guard-fails when most ambiguous framing passes through', () => {
  const r = scoreSmugglingGuard({
    responses: [
      { requestId: 'r1', normalised: false, backendStatus: 200 },
      { requestId: 'r2', normalised: false, backendStatus: 200 },
      { requestId: 'r3', normalised: true, backendStatus: 400 },
    ],
  });
  assert.equal(r.verdict, 'guard-fails');
  assert.equal(r.score, 33);
});

test('1285: insufficient-data with no observations', () => {
  assert.equal(scoreSmugglingGuard({}).verdict, 'insufficient-data');
});

// ---------------------------------------------------------------- 1286 ----
test('1286: high-confidence pair on large OPTIONS body delta', () => {
  const r = diffOptionsResponses([
    { route: '/api/users', status: 200, bodyLength: 512 },
    { route: '/api/orders', status: 200, bodyLength: 96 },
  ]);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].delta, 416);
  assert.equal(r.pairs[0].confidence, 'high');
});

test('1286: sorts pairs by delta descending and grades small deltas', () => {
  const r = diffOptionsResponses([
    { route: '/a', status: 200, bodyLength: 100 },
    { route: '/b', status: 200, bodyLength: 102 },
    { route: '/c', status: 200, bodyLength: 140 },
  ]);
  assert.ok(r.pairs[0].delta >= r.pairs[1].delta);
  const tiny = r.pairs.find((p) => p.delta === 2);
  assert.equal(tiny.confidence, 'low');
});

// ---------------------------------------------------------------- 1287 ----
const DOCS_HTML = `
<a href="https://staging-api.example.com/v2">staging</a>
<a href="https://api.example.com/internal/metrics">internal</a>
<a href="https://api.example.com/docs/deprecated/v1">old</a>
<a href="https://api.example.com/v2/users">users</a>
`;

test('1287: classifies doc links by environment class', () => {
  const r = extractDocLinks(DOCS_HTML);
  assert.equal(r.idea, '01287');
  assert.equal(r.links.length, 4);
  assert.ok(r.byClass.staging.includes('https://staging-api.example.com/v2'));
  assert.ok(r.byClass.internal.includes('https://api.example.com/internal/metrics'));
  assert.ok(r.byClass.deprecated.includes('https://api.example.com/docs/deprecated/v1'));
  assert.ok(r.byClass.public.includes('https://api.example.com/v2/users'));
});

test('1287: skips anchors and mailto links', () => {
  const r = extractDocLinks('<a href="#top">x</a><a href="mailto:a@b.c">y</a><a href="/real">z</a>');
  assert.equal(r.links.length, 1);
  assert.equal(r.links[0].url, '/real');
});

// ---------------------------------------------------------------- 1288 ----
const SPEC = {
  openapi: '3.0.0',
  paths: {
    '/users': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  user_id: { type: 'string', example: 'usr_9f31ac' },
                  email: { type: 'string', example: 'qa+smoke@example.com' },
                  api_key: { type: 'string', example: 'EXAMPLE_TOKEN_4eC39HqLyjWDarjtT1zdp7dc' },
                },
              },
            },
          },
        },
      },
    },
  },
};

test('1288: harvests and redacts examples by sensitivity class', () => {
  const r = harvestOpenApiExamples(SPEC);
  assert.equal(r.idea, '01288');
  assert.ok(r.counts.ids >= 1);
  assert.ok(r.counts.tokens >= 1);
  assert.ok(r.counts.piiFormats >= 1);
  const all = [...r.ids, ...r.tokens, ...r.piiFormats].join(' ');
  assert.ok(!all.includes('qa+smoke@example.com'));
  assert.ok(!all.includes('EXAMPLE_TOKEN_4eC39HqLyjWDarjtT1zdp7dc'));
  assert.ok(all.includes('[REDACTED:email]') || all.includes('[REDACTED:token]'));
  assert.ok(r.warning.includes('REDACTED'));
});

test('1288: handles empty spec', () => {
  const r = harvestOpenApiExamples({});
  assert.deepEqual(r.counts, { ids: 0, tokens: 0, piiFormats: 0 });
});

// ---------------------------------------------------------------- 1289 ----
const SPEC_SERVERS = {
  openapi: '3.0.0',
  servers: [
    { url: 'https://api.example.com/v2' },
    { url: 'https://staging-api.example.com/v2' },
    { url: 'https://dev-api.example.com/v2', variables: { region: { default: 'us' } } },
    { url: 'https://api.example.com/v2' },
  ],
};

test('1289: enumerates unique server URLs with environments', () => {
  const r = enumerateServerUrls(SPEC_SERVERS);
  assert.equal(r.idea, '01289');
  assert.equal(r.servers.length, 3);
  const envs = Object.fromEntries(r.servers.map((s) => [s.url, s.environment]));
  assert.equal(envs['https://api.example.com/v2'], 'production');
  assert.equal(envs['https://staging-api.example.com/v2'], 'staging');
  assert.equal(envs['https://dev-api.example.com/v2'], 'development');
});

test('1289: classifyEnvironment covers edge cases', () => {
  assert.equal(classifyEnvironment('https://qa-api.example.com'), 'staging');
  assert.equal(classifyEnvironment('http://localhost:8080'), 'testing');
  assert.equal(classifyEnvironment('https://api.internal.example.net'), 'internal');
});

// ---------------------------------------------------------------- 1290 ----
const SPEC_CALLBACKS = {
  openapi: '3.0.0',
  paths: {
    '/subscriptions': {
      post: {
        callbacks: {
          '{$request.body#/callbackUrl}': {
            post: { summary: 'Notify subscriber' },
          },
        },
      },
    },
  },
};

test('1290: discovers callback contracts with owning operation', () => {
  const r = discoverCallbacks(SPEC_CALLBACKS);
  assert.equal(r.idea, '01290');
  assert.equal(r.callbacks.length, 1);
  assert.equal(r.callbacks[0].operation, 'POST /subscriptions');
  assert.equal(r.callbacks[0].method, 'POST');
  assert.equal(r.callbacks[0].expression, '{$request.body#/callbackUrl}');
});

test('1290: returns empty list when no callbacks exist', () => {
  assert.deepEqual(discoverCallbacks({ openapi: '3.0.0', paths: {} }).callbacks, []);
});

// ---------------------------------------------------------------- finding
test('finding envelope wraps results with engine metadata', () => {
  const f = apiSubdomainChangelogReconFinding('01281', { ok: true });
  assert.equal(f.engine, 'apiSubdomainChangelogRecon');
  assert.equal(f.idea, '01281');
  assert.ok(Date.parse(f.at) > 0);
});
