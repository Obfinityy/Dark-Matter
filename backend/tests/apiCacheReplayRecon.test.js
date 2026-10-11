/**
 * apiCacheReplayRecon.test.js — tests for idea-bank ideas 1241-1250.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1241_COVERAGE,
  ideaFunctions,
  discoverIdempotencySupport,
  assessIdempotencyReplayBinding,
  assessIdempotencyKeyScoping,
  mapETagCaching,
  discoverCacheKeyParams,
  classifyCacheStatus,
  differentialCachedVsFresh,
  testConditionalRequestHandling,
  testRangeRequestOnApi,
  mapOpenApiDiscriminators,
  assessPolymorphicTypeConfusion,
} from '../src/engines/apiCacheReplayRecon.js';

// ---------------------------------------------------------------- registry
test('coverage registry lists ideas 1241-1250', () => {
  assert.deepEqual(WAVE1241_COVERAGE, [1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248, 1249, 1250]);
});

test('ideaFunctions maps every idea number to its function', () => {
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1241], 'discoverIdempotencySupport');
  assert.equal(map[1250], 'assessPolymorphicTypeConfusion');
});

// ---------------------------------------------------------------- 1241 ----
test('1241: detects idempotency support via header echo', () => {
  const r = discoverIdempotencySupport({
    pairs: [
      { sentKey: 'k1', responseStatus: 201, responseHeader: { 'Idempotency-Key': 'k1' }, processingDurationMs: 400 },
      { sentKey: 'k1', responseStatus: 200, duplicate: true, responseHeader: { 'Idempotency-Key': 'k1' }, processingDurationMs: 40 },
    ],
  });
  assert.equal(r.supported, true);
  assert.ok(r.evidence.length >= 2);
  assert.equal(r.confidence, 'high');
});

test('1241: detects duplicate short-circuit from timing', () => {
  const r = discoverIdempotencySupport({
    pairs: [
      { sentKey: 'k2', responseStatus: 201, processingDurationMs: 500 },
      { sentKey: 'k2', responseStatus: 200, duplicate: true, processingDurationMs: 10 },
    ],
  });
  assert.equal(r.supported, true);
  assert.ok(r.evidence.some((e) => /short-circuited/.test(e)));
});

test('1241: reports no support when nothing indicates it', () => {
  const r = discoverIdempotencySupport({
    pairs: [{ sentKey: 'k3', responseStatus: 201, processingDurationMs: 100 }],
  });
  assert.equal(r.supported, false);
  assert.ok(r.findings.some((f) => /No evidence/.test(f)));
});

test('1241: empty observations stay low confidence', () => {
  const r = discoverIdempotencySupport({});
  assert.equal(r.supported, false);
  assert.equal(r.confidence, 'low');
});

// ---------------------------------------------------------------- 1242 ----
test('1242: strict binding on 422 rejection', () => {
  const r = assessIdempotencyReplayBinding({
    originalBody: '{"amount":10}',
    replayBody: '{"amount":999}',
    replayStatus: 422,
    replayResponseBody: 'idempotency key mismatch',
  });
  assert.equal(r.binding, 'STRICT');
  assert.equal(r.finding, null);
});

test('1242: weak binding when body-swapped replay succeeds', () => {
  const r = assessIdempotencyReplayBinding({
    originalBody: '{"amount":10}',
    replayBody: '{"amount":999}',
    replayStatus: 200,
    replayResponseBody: '{"ok":true}',
  });
  assert.equal(r.binding, 'WEAK');
  assert.ok(/NOT bound/.test(r.finding));
});

test('1242: unknown when bodies are identical', () => {
  const r = assessIdempotencyReplayBinding({
    originalBody: '{"a":1}',
    replayBody: '{"a":1}',
    replayStatus: 200,
  });
  assert.equal(r.binding, 'UNKNOWN');
});

// ---------------------------------------------------------------- 1243 ----
test('1243: unscoped keys detected via cross-account replay', () => {
  const r = assessIdempotencyKeyScoping({
    crossAccountReplays: [
      { accountAKey: 'abcdef1234567890', replayedByAccountB: true, replayStatus: 200, accountBSeesAccountAData: true },
    ],
  });
  assert.equal(r.scoping, 'UNSCOPED');
  assert.ok(/NOT scoped/.test(r.finding));
});

test('1243: scoped keys when replay is rejected', () => {
  const r = assessIdempotencyKeyScoping({
    crossAccountReplays: [
      { accountAKey: 'abcdef1234567890', replayedByAccountB: false, replayStatus: 403 },
    ],
  });
  assert.equal(r.scoping, 'SCOPED');
  assert.equal(r.finding, null);
});

test('1243: unknown with no observations', () => {
  const r = assessIdempotencyKeyScoping({});
  assert.equal(r.scoping, 'UNKNOWN');
  assert.equal(r.verdicts.length, 1);
});

// ---------------------------------------------------------------- 1244 ----
test('1244: maps working ETag revalidation', () => {
  const r = mapETagCaching({
    endpoints: [
      { endpoint: '/api/profile', authenticated: true, etag: '"abc"', ifNoneMatchSent: true, responseStatus: 304, cacheControl: 'private' },
    ],
  });
  assert.equal(r.endpoints[0].cacheable, true);
  assert.equal(r.endpoints[0].stalePrivilegeRisk, false);
  assert.ok(r.endpoints[0].notes.some((n) => /304/.test(n)));
});

test('1244: flags stale privileged cache serving', () => {
  const r = mapETagCaching({
    endpoints: [
      { endpoint: '/api/admin', authenticated: true, etag: '"x"', ifNoneMatchSent: true, responseStatus: 304, authenticatedContentServedFromCache: true, cacheControl: 'public' },
    ],
  });
  assert.equal(r.endpoints[0].stalePrivilegeRisk, true);
  assert.ok(r.findings.some((f) => /served cached privileged content/.test(f)));
});

test('1244: handles missing ETag gracefully', () => {
  const r = mapETagCaching({ endpoints: [{ endpoint: '/api/nope' }] });
  assert.equal(r.endpoints[0].cacheable, false);
  assert.ok(r.endpoints[0].notes.some((n) => /No ETag/.test(n)));
});

// ---------------------------------------------------------------- 1245 ----
test('1245: separates keyed from unkeyed params', () => {
  const r = discoverCacheKeyParams({
    probes: [
      { param: 'lang', flippedCacheStatus: true },
      { param: 'debug', flippedCacheStatus: false },
      { param: 'cb', flippedCacheStatus: false },
    ],
  });
  assert.deepEqual(r.keyed, ['lang']);
  assert.deepEqual(r.unkeyed, ['debug', 'cb']);
  assert.ok(/cache-deception/.test(r.verdict));
});

test('1245: all-keyed verdict when nothing unkeyed', () => {
  const r = discoverCacheKeyParams({ probes: [{ param: 'v', flippedCacheStatus: true }] });
  assert.deepEqual(r.unkeyed, []);
  assert.ok(/no cache-deception surface/.test(r.verdict));
});

test('classifyCacheStatus reads common CDN headers', () => {
  assert.equal(classifyCacheStatus({ 'CF-Cache-Status': 'HIT' }), 'HIT');
  assert.equal(classifyCacheStatus({ 'x-cache': 'MISS' }), 'MISS');
  assert.equal(classifyCacheStatus({}), 'UNKNOWN');
});

// ---------------------------------------------------------------- 1246 ----
test('1246: detects cross-user cached data leak', () => {
  const r = differentialCachedVsFresh({
    cached: { forUser: 'alice', body: { email: 'bob@example.com', name: 'Bob', public: 'x' } },
    fresh: { forUser: 'alice-requester', body: { email: 'alice@example.com', name: 'Alice', public: 'x' } },
  });
  assert.equal(r.leak, true);
  assert.ok(r.leakedFields.includes('email'));
  assert.ok(/LEAK/.test(r.verdict));
});

test('1246: clean when cached body is not personalized', () => {
  const r = differentialCachedVsFresh({
    cached: { forUser: 'alice', body: { version: '1.2.3', status: 'ok' } },
    fresh: { forUser: 'bob', body: { version: '1.2.3', status: 'ok' } },
  });
  assert.equal(r.leak, false);
  assert.ok(/CLEAN/.test(r.verdict));
});

test('1246: impossible without both bodies', () => {
  const r = differentialCachedVsFresh({ cached: { body: { a: 1 } } });
  assert.equal(r.leak, false);
  assert.ok(/impossible/.test(r.verdict));
});

// ---------------------------------------------------------------- 1247 ----
test('1247: high risk on 304 with body and skipped auth', () => {
  const r = testConditionalRequestHandling({
    probes: [
      { sentValue: 'Wed, 21 Oct 2015 07:28:00 GMT', responseStatus: 304, bodyServedWith304: true, authorizationChecked: false },
    ],
  });
  assert.equal(r.risk, 'HIGH');
  assert.ok(r.findings.some((f) => /without re-running authorization/.test(f)));
});

test('1247: flags impossible dates returning 304', () => {
  const r = testConditionalRequestHandling({
    probes: [{ sentValue: 'Sun, 06 Nov 9999 08:49:37 GMT', responseStatus: 304 }],
  });
  assert.ok(r.risk === 'MEDIUM' || r.risk === 'HIGH');
  assert.ok(r.findings.some((f) => /Impossible date/.test(f)));
});

test('1247: low risk on correct behavior', () => {
  const r = testConditionalRequestHandling({
    probes: [{ sentValue: 'Wed, 21 Oct 2015 07:28:00 GMT', responseStatus: 200, authorizationChecked: true }],
  });
  assert.equal(r.risk, 'LOW');
});

// ---------------------------------------------------------------- 1248 ----
test('1248: 206 on JSON API is a medium surface', () => {
  const r = testRangeRequestOnApi({
    probes: [{ sentRange: 'bytes=0-10', responseStatus: 206, contentRange: 'bytes 0-10/500', bodyLength: 11, fullLength: 500 }],
  });
  assert.equal(r.rangeSupported, true);
  assert.equal(r.risk, 'MEDIUM');
});

test('1248: filter bypass escalates to high', () => {
  const r = testRangeRequestOnApi({
    probes: [{ sentRange: 'bytes=100-200', responseStatus: 206, filterBypassed: true }],
  });
  assert.equal(r.risk, 'HIGH');
  assert.ok(r.findings.some((f) => /filter bypass/i.test(f)));
});

test('1248: ignored Range reports no surface', () => {
  const r = testRangeRequestOnApi({
    probes: [{ sentRange: 'bytes=0-10', responseStatus: 200, bodyLength: 500, fullLength: 500 }],
  });
  assert.equal(r.rangeSupported, false);
  assert.ok(/not honored/.test(r.verdict));
});

// ---------------------------------------------------------------- 1249 ----
test('1249: maps discriminator with branches', () => {
  const doc = {
    openapi: '3.0.0',
    paths: { '/pets': { get: { responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } } } } },
    components: {
      schemas: {
        Pet: { discriminator: { propertyName: 'petType' }, oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }] },
        Cat: { type: 'object' },
        Dog: { type: 'object' },
      },
    },
  };
  const r = mapOpenApiDiscriminators(doc);
  assert.equal(r.schemas.length, 1);
  assert.equal(r.schemas[0].discriminatorProperty, 'petType');
  assert.deepEqual(r.schemas[0].branches, ['Cat', 'Dog']);
});

test('1249: flags hidden subtypes unreferenced by paths', () => {
  const doc = {
    openapi: '3.0.0',
    paths: {},
    components: {
      schemas: {
        Config: { oneOf: [{ $ref: '#/components/schemas/UserConfig' }, { $ref: '#/components/schemas/AdminConfig' }] },
        UserConfig: { type: 'object' },
        AdminConfig: { type: 'object' },
      },
    },
  };
  const r = mapOpenApiDiscriminators(doc);
  assert.deepEqual(r.schemas[0].hiddenSubtypeHints.sort(), ['AdminConfig', 'UserConfig']);
  assert.ok(r.findings.some((f) => /Hidden subtypes/.test(f)));
});

test('1249: flat schemas produce no mappings', () => {
  const r = mapOpenApiDiscriminators({ openapi: '3.0.0', components: { schemas: { Plain: { type: 'object' } } } });
  assert.equal(r.schemas.length, 0);
  assert.ok(r.findings.some((f) => /flat/.test(f)));
});

// ---------------------------------------------------------------- 1250 ----
test('1250: privileged routing is high risk', () => {
  const r = assessPolymorphicTypeConfusion({
    probes: [
      { field: 'config', expectedSubtype: 'UserConfig', sentSubtype: 'AdminConfig', responseStatus: 200, routedToPrivilegedHandler: true },
    ],
  });
  assert.equal(r.confusion, true);
  assert.equal(r.risk, 'HIGH');
  assert.ok(r.findings.some((f) => /privileged handler/.test(f)));
});

test('1250: rejected wrong subtype shows no confusion', () => {
  const r = assessPolymorphicTypeConfusion({
    probes: [
      { field: 'config', expectedSubtype: 'UserConfig', sentSubtype: 'AdminConfig', responseStatus: 422, errorMessage: 'discriminator mismatch' },
    ],
  });
  assert.equal(r.confusion, false);
  assert.ok(/discloses polymorphic internals/.test(r.findings.join(' ')));
});

test('1250: unknown with no probes', () => {
  const r = assessPolymorphicTypeConfusion({});
  assert.equal(r.risk, 'UNKNOWN');
});
