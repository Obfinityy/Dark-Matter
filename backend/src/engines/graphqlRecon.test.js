/**
 * graphqlRecon.test.js — node:test assertions for graphqlRecon.js.
 * Ideas 01011–01020, at least one test per idea.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  misspellField,
  suggestionBypassQueries,
  parseSuggestionResponse,
  inferSchemaFromErrors,
  typenameSweepQuery,
  getMethodProbeQuery,
  playgroundCandidatePaths,
  sha256QueryHash,
  apqHashGuessQueries,
  versionAbuseVariants,
  batchingProbeDescriptor,
  aliasOverloadQuery,
  directiveFuzzQueries,
  graphqlReconFinding,
  GRAPHQL_RECON,
} from './graphqlRecon.js';

// ---- Idea 01011: suggestion bypass ----
test('misspellField produces deterministic variants without the original', () => {
  const v = misspellField('username', { maxVariants: 6 });
  assert.equal(v.length, 6);
  assert.ok(!v.includes('username'));
  assert.equal(new Set(v).size, v.length);
  assert.deepEqual(misspellField('', {}), []);
});

test('suggestionBypassQueries builds probes per guessed field', () => {
  const probes = suggestionBypassQueries(['user', 'profile'], { variantsPerField: 2 });
  assert.equal(probes.length, 4);
  assert.ok(probes.every(p => p.query.startsWith('query {') && p.label.startsWith('suggestion-bypass:')));
  assert.equal(probes[0].field, 'user');
});

test('parseSuggestionResponse extracts didYouMean field names', () => {
  const body = '{"errors":[{"message":"Cannot query field \\"usr\\" on type \\"Query\\". Did you mean \\"user\\"?"},"extensions":{}}';
  const r = parseSuggestionResponse(body);
  assert.equal(r.errorPresent, true);
  assert.ok(r.suggestedFields.includes('user'), JSON.stringify(r.suggestedFields));
  assert.ok(r.rawPhrases.length > 0);
});

test('parseSuggestionResponse handles didYouMean list form', () => {
  const body = '{"errors":[{"message":"Did you mean \\"name\\" or \\"email\\"?"}]}';
  const r = parseSuggestionResponse(body);
  assert.ok(r.suggestedFields.includes('name'));
  assert.ok(r.suggestedFields.includes('email'));
});

// ---- Idea 01012: error-based schema inference ----
test('inferSchemaFromErrors harvests fields from validation errors', () => {
  const res = inferSchemaFromErrors([
    '{"errors":[{"message":"Cannot query field \\"admin\\" on type \\"User\\". Did you mean \\"name\\"?"}]}',
    '{"errors":[{"message":"Unknown argument \\"limit\\" on field \\"Query.users\\"."}]}',
    '{"errors":[{"message":"Expected type \\"Role\\", found X."}]}',
    '{"errors":[{"message":"Abstract type \\"Node\\" must resolve to an Object type at runtime"}]}',
  ]);
  assert.ok(res.types.User.fields.includes('admin'));
  assert.ok(res.types.Query.fields.includes('users'));
  assert.ok(res.arguments.users.includes('limit'));
  assert.ok(res.enums.includes('Role'));
  assert.equal(res.types.Node.kind, 'abstract');
  assert.ok(res.coverage > 0);
});

test('inferSchemaFromErrors returns empty hypothesis on no errors', () => {
  const res = inferSchemaFromErrors([]);
  assert.deepEqual(res.types, {});
  assert.equal(res.coverage, 0);
});

// ---- Idea 01013: __typename sweep ----
test('typenameSweepQuery builds one probe per abstract type', () => {
  const probes = typenameSweepQuery(['Node', 'SearchResult']);
  assert.equal(probes.length, 2);
  assert.ok(probes[0].query.includes('__typename'));
  assert.ok(probes[0].query.includes('... on Node'));
  assert.equal(probes[0].abstractType, 'Node');
});

// ---- Idea 01014: GET-method variant ----
test('getMethodProbeQuery converts POST descriptor to GET params', () => {
  const probe = getMethodProbeQuery({
    query: 'query { user(id: 1) { name } }',
    operationName: 'GetUser',
    variables: { id: 1 },
    extensions: { persistedQuery: { version: 1 } },
  });
  assert.equal(probe.method, 'GET');
  assert.ok(probe.queryString.includes('query='));
  assert.ok(probe.queryString.includes('operationName='));
  assert.ok(decodeURIComponent(probe.queryString).includes('GetUser'));
  assert.equal(probe.cacheable, true);
});

// ---- Idea 01015: playground paths ----
test('playgroundCandidatePaths returns known IDE paths', () => {
  const paths = playgroundCandidatePaths();
  assert.ok(paths.includes('/graphiql'));
  assert.ok(paths.includes('/playground'));
  assert.ok(paths.includes('/voyager'));
  assert.ok(paths.length >= 5);
});

// ---- Idea 01016: APQ hash guessing ----
test('sha256QueryHash matches node crypto output', async () => {
  const { createHash } = await import('node:crypto');
  const q = 'query { viewer { login } }';
  assert.equal(sha256QueryHash(q), createHash('sha256').update(q, 'utf8').digest('hex'));
});

test('apqHashGuessQueries builds hash-only and register payloads', () => {
  const probes = apqHashGuessQueries(['query { users { id } }']);
  assert.equal(probes.length, 1);
  assert.equal(probes[0].sha256Hash, sha256QueryHash('query { users { id } }'));
  assert.ok(!('query' in probes[0].hashOnlyPayload));
  assert.equal(probes[0].registerPayload.query, 'query { users { id } }');
  assert.equal(probes[0].hashOnlyPayload.extensions.persistedQuery.version, 1);
  assert.deepEqual(apqHashGuessQueries(['  ', '']), []);
});

// ---- Idea 01017: version abuse ----
test('versionAbuseVariants flips version while preserving hash', () => {
  const base = apqHashGuessQueries(['query { users { id } }'])[0].hashOnlyPayload;
  const variants = versionAbuseVariants(base, [0, 2, '1']);
  assert.equal(variants.length, 3);
  const hashes = new Set(variants.map(v => v.payload.extensions.persistedQuery.sha256Hash));
  assert.equal(hashes.size, 1);
  assert.equal(variants[0].payload.extensions.persistedQuery.version, 0);
  assert.ok(variants.every(v => v.label.startsWith('apq-version-abuse:')));
});

// ---- Idea 01018: batching probe ----
test('batchingProbeDescriptor builds an array body with detection rule', () => {
  const d = batchingProbeDescriptor(['query { a }', 'query { b }']);
  assert.equal(d.operationCount, 2);
  assert.ok(Array.isArray(d.requestBody));
  assert.equal(d.requestBody[1].query, 'query { b }');
  assert.equal(d.expectedArrayResponse, true);
  assert.ok(typeof d.detect === 'string' && d.detect.length > 0);
});

// ---- Idea 01019: alias overloading ----
test('aliasOverloadQuery stacks N aliased copies', () => {
  const q = aliasOverloadQuery('name', 5);
  assert.equal(q.aliasCount, 5);
  assert.ok(q.query.includes('a0: name'));
  assert.ok(q.query.includes('a4: name'));
  assert.equal((q.query.match(/a\d: /g) || []).length, 5);
});

test('aliasOverloadQuery clamps out-of-range counts', () => {
  assert.equal(aliasOverloadQuery('id', 0).aliasCount, 1);
  assert.equal(aliasOverloadQuery('id', 9999).aliasCount, 200);
});

// ---- Idea 01020: directive fuzzing ----
test('directiveFuzzQueries covers @include and @skip with non-boolean args', () => {
  const variants = directiveFuzzQueries('email');
  assert.equal(variants.length, 18); // 2 directives x 9 fuzz values
  assert.ok(variants.some(v => v.directive === 'include' && v.argument === 'if: "true"'));
  assert.ok(variants.some(v => v.directive === 'skip' && v.argument === 'if: null'));
  assert.ok(variants.every(v => v.query.includes('email @')));
  assert.ok(!variants.some(v => v.argument === 'if: true' || v.argument === 'if: false'));
});

// ---- Finding builder + registry ----
test('graphqlReconFinding builds a report-ready finding object', () => {
  const f = graphqlReconFinding({ title: 'playground exposed', kind: 'playground-scan', targets: ['/playground'], confidence: 'high' });
  assert.ok(f.title.startsWith('GraphQL recon —'));
  assert.equal(f.severity, 'Info');
  assert.deepEqual(f.targets, ['/playground']);
  assert.ok(f.recommendation.length > 0);
});

test('GRAPHQL_RECON registry exposes all engine functions', () => {
  assert.ok(typeof GRAPHQL_RECON === 'object');
  const names = [
    'misspellField', 'suggestionBypassQueries', 'parseSuggestionResponse', 'inferSchemaFromErrors',
    'typenameSweepQuery', 'getMethodProbeQuery', 'playgroundCandidatePaths', 'sha256QueryHash',
    'apqHashGuessQueries', 'versionAbuseVariants', 'batchingProbeDescriptor', 'aliasOverloadQuery',
    'directiveFuzzQueries', 'graphqlReconFinding',
  ];
  for (const n of names) assert.equal(typeof GRAPHQL_RECON[n], 'function', n);
});
