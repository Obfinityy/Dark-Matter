/**
 * graphFederationGrpcRecon.test.js — node:test coverage for the GraphQL
 * federation + gRPC discovery recon engine (ideas 01021–01030).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import graphFederationGrpcReconDefault from './graphFederationGrpcRecon.js';
import {
  cyclicFragmentQueries,
  depthLadderQueries,
  inferDepthLimit,
  costProbeQueries,
  inferCostAnalysis,
  federationServiceQuery,
  entitiesAbuseDescriptors,
  extractSubgraphUrls,
  extractKeyFields,
  fingerprintGateway,
  grpcReflectionDescriptor,
  protoHuntPaths,
  federationGrpcFinding,
  GRAPH_FEDERATION_GRPC_RECON,
} from './graphFederationGrpcRecon.js';

// Idea 01021 — fragment cycle test
test('01021: cyclicFragmentQueries builds three cyclic probe variants', () => {
  const probes = cyclicFragmentQueries('ProbeFrag');
  assert.equal(probes.length, 3);
  assert.deepEqual(probes.map(p => p.label), ['self-spread', 'mutual-recursion', 'deep-cycle']);
  // Direct cycle: the fragment spreads itself inside a sub-selection.
  assert.match(probes[0].query, /fragment ProbeFrag on Node/);
  assert.match(probes[0].query, /child \{\s*\.\.\.ProbeFrag\s*\}/);
  // Mutual recursion: two fragments reference each other.
  assert.match(probes[1].query, /fragment ProbeFragA on Node/);
  assert.match(probes[1].query, /fragment ProbeFragB on Node/);
  assert.match(probes[1].query, /\.\.\.ProbeFragB/);
  assert.match(probes[1].query, /\.\.\.ProbeFragA/);
  // Deep cycle: self-spread two selections down.
  assert.match(probes[2].query, /grandchild \{\s*\.\.\.ProbeFrag\s*\}/);
});

test('01021: cyclicFragmentQueries sanitizes unsafe fragment names', () => {
  const probes = cyclicFragmentQueries('bad-name; DROP');
  assert.match(probes[0].query, /fragment badname/);
  assert.doesNotMatch(probes[0].query, /;/);
  const fallback = cyclicFragmentQueries('123');
  assert.match(fallback[0].query, /fragment _123/);
});

// Idea 01022 — depth-limit measurement
test('01022: depthLadderQueries builds an incrementally nested ladder', () => {
  const ladder = depthLadderQueries(['user', 'friends'], 4);
  assert.equal(ladder.length, 4);
  assert.deepEqual(ladder.map(l => l.depth), [1, 2, 3, 4]);
  assert.match(ladder[0].query, /query DepthLadder_1/);
  assert.match(ladder[0].query, /user \{/);
  // Depth 3 cycles user -> friends -> user.
  assert.match(ladder[2].query, /user \{\s*friends \{\s*user \{/);
});

test('01022: depthLadderQueries validates input and caps depth', () => {
  assert.throws(() => depthLadderQueries([]), /at least one valid field name/);
  assert.throws(() => depthLadderQueries(['!!!']), /at least one valid field name/);
  const capped = depthLadderQueries(['a'], 500);
  assert.equal(capped.length, 50);
});

test('01022: inferDepthLimit finds the cutoff at the first rejection', () => {
  const result = inferDepthLimit([
    { depth: 1, ok: true },
    { depth: 2, ok: true },
    { depth: 3, ok: true },
    { depth: 4, ok: false, errors: [{ message: 'max depth exceeded' }] },
    { depth: 5, ok: false },
  ]);
  assert.equal(result.depthLimit, 3);
  assert.equal(result.rejectedAt, 4);
  assert.equal(result.method, 'first-rejection');
});

test('01022: inferDepthLimit reports no limit when every rung succeeds', () => {
  const result = inferDepthLimit([
    { depth: 1, ok: true },
    { depth: 2, ok: true },
  ]);
  assert.equal(result.depthLimit, null);
  assert.equal(result.rejectedAt, null);
  assert.match(result.notes.join(' '), /No depth limit observed/);
});

// Idea 01023 — cost-analysis probing
test('01023: costProbeQueries builds nested fan-out with a computed multiplier', () => {
  const { queries, maxMultiplier } = costProbeQueries([
    { name: 'users', first: 100, select: ['id'] },
    { name: 'posts', first: 50, select: ['id'] },
    { name: 'comments', first: 50, select: ['id'] },
  ]);
  assert.equal(queries.length, 2);
  const nested = queries.find(q => q.kind === 'nested-fanout');
  assert.equal(nested.estimatedMultiplier, 100 * 50 * 50);
  assert.match(nested.query, /users\(first: 100\)/);
  assert.match(nested.query, /posts\(first: 50\)/);
  assert.match(nested.query, /comments\(first: 50\)/);
  const wide = queries.find(q => q.kind === 'wide-siblings');
  assert.ok(wide.query.includes('alias0: users(first: 100)'));
  assert.ok(maxMultiplier >= nested.estimatedMultiplier);
});

test('01023: inferCostAnalysis detects cost metadata and cost rejections', () => {
  const withExtension = inferCostAnalysis(
    { status: 200, durationMs: 40 },
    { status: 200, durationMs: 60, body: { data: {}, extensions: { cost: 250000 } } },
  );
  assert.equal(withExtension.costComputed, true);
  assert.ok(withExtension.signals.some(s => s.startsWith('cost-extension-present')));

  const rejected = inferCostAnalysis(
    { status: 200, durationMs: 40 },
    { status: 200, body: { errors: [{ message: 'Query too complex: estimated cost 9000 exceeds maximum 5000' }] } },
  );
  assert.equal(rejected.costComputed, true);
  assert.ok(rejected.signals.some(s => s.startsWith('cost-rejection')));

  const clean = inferCostAnalysis(
    { status: 200, durationMs: 40 },
    { status: 200, durationMs: 55, body: { data: { users: [] } } },
  );
  assert.equal(clean.costComputed, false);
  assert.match(clean.summary, /may execute expensive queries blindly/);
});

// Idea 01024 — federation _service probe
test('01024: federationServiceQuery returns the _service { sdl } probe', () => {
  const q = federationServiceQuery();
  assert.equal(q, 'query FederationServiceProbe {\n  _service {\n    sdl\n  }\n}');
});

// Idea 01025 — _entities abuse descriptors
test('01025: entitiesAbuseDescriptors builds _entities representations from key fields', () => {
  const descriptors = entitiesAbuseDescriptors('Product', ['upc'], { batch: true });
  assert.equal(descriptors.length, 2);
  const [single, batch] = descriptors;
  assert.deepEqual(single.representation, { __typename: 'Product', upc: '"<UPC>"' });
  assert.match(single.query, /_entities\(representations: \[\{ __typename: "Product", upc: "<UPC>" \}\]\)/);
  assert.match(single.query, /\.\.\. on Product/);
  assert.ok(Array.isArray(batch.representation));
  assert.equal(batch.representation.length, 2);
  assert.throws(() => entitiesAbuseDescriptors('Product', []), /at least one key field/);
});

// Idea 01026 — subgraph direct-access discovery
test('01026: extractSubgraphUrls parses join__graph directives', () => {
  const sdl = `
    enum join__Graph {
      PRODUCTS @join__graph(name: "products", url: "https://products.internal.example.com/graphql")
      USERS @join__graph(name: "users", url: "https://users.internal.example.com/graphql")
    }
  `;
  const endpoints = extractSubgraphUrls(sdl);
  assert.equal(endpoints.length, 2);
  assert.deepEqual(endpoints[0], {
    subgraph: 'products',
    url: 'https://products.internal.example.com/graphql',
    source: 'join__graph directive',
  });
  assert.equal(endpoints[1].subgraph, 'users');
});

test('01026: extractSubgraphUrls deduplicates and handles empty SDL', () => {
  assert.deepEqual(extractSubgraphUrls(''), []);
  const sdl = 'PRODUCTS @join__graph(name: "a", url: "https://x.example/a")\n' +
    'PRODUCTS @join__graph(name: "a", url: "https://x.example/a")';
  assert.equal(extractSubgraphUrls(sdl).length, 1);
});

// Idea 01027 — federation key-field extraction
test('01027: extractKeyFields parses @key directives including composite keys', () => {
  const sdl = `
    type Product @key(fields: "upc") {
      upc: String!
      name: String
    }
    extend type User @key(fields: "id organization { id }") {
      id: ID!
    }
    type Order @key(fields: "{ customer { id } orderNumber }") {
      orderNumber: String!
    }
  `;
  const keys = extractKeyFields(sdl);
  assert.equal(keys.length, 3);
  assert.equal(keys[0].type, 'Product');
  assert.deepEqual(keys[0].fields, ['upc']);
  assert.equal(keys[1].type, 'User');
  assert.deepEqual(keys[1].fields, ['id', 'organization.id']);
  assert.equal(keys[2].type, 'Order');
  assert.deepEqual(keys[2].fields, ['customer.id', 'orderNumber']);
});

// Idea 01028 — stitching vs federation fingerprint
test('01028: fingerprintGateway identifies Apollo federation from _service SDL', () => {
  const fp = fingerprintGateway(
    { data: { _service: { sdl: 'directive @join__graph(name: String!, url: String!) repeatable on ENUM_VALUE' } } },
    { 'x-powered-by': 'apollo-server' },
    { data: { __typename: 'Query' } },
    {},
  );
  assert.equal(fp.verdict, 'federation');
  assert.equal(fp.confidence, 'high');
  assert.ok(fp.federationScore > fp.stitchingScore);
  assert.ok(fp.indicators.length > 0);
});

test('01028: fingerprintGateway identifies stitching when _service is rejected', () => {
  const fp = fingerprintGateway(
    { errors: [{ message: 'Cannot query field "_service" on type "Query".' }] },
    { 'x-generator': 'graphql-tools-stitch' },
    { data: { __typename: 'Query' } },
    {},
  );
  assert.equal(fp.verdict, 'stitching');
  assert.ok(fp.stitchingScore > fp.federationScore);
});

test('01028: fingerprintGateway is inconclusive without evidence', () => {
  const fp = fingerprintGateway({ data: null }, {}, { data: null }, {});
  assert.equal(fp.verdict, 'inconclusive');
  assert.equal(fp.confidence, 'low');
});

// Idea 01029 — gRPC server reflection probing
test('01029: grpcReflectionDescriptor describes the ServerReflection call', () => {
  const d = grpcReflectionDescriptor();
  assert.equal(d.service, 'grpc.reflection.v1alpha.ServerReflection');
  assert.equal(d.fullMethod, '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo');
  assert.equal(d.streamType, 'bidirectional-streaming');
  const labels = d.probeRequests.map(r => r.label);
  assert.deepEqual(labels, ['list-services', 'file-by-filename', 'file-containing-symbol', 'all-extension-numbers']);
  assert.deepEqual(d.probeRequests[0].message, { list_services: '' });
  assert.ok(d.disabledSignals.some(s => /UNIMPLEMENTED/.test(s)));
});

// Idea 01030 — reflection-disabled proto hunt
test('01030: protoHuntPaths enumerates .proto and descriptor-set candidates', () => {
  const urls = protoHuntPaths('https://api.example.com/');
  assert.ok(urls.length >= 20);
  assert.ok(urls.includes('https://api.example.com/protos/service.proto'));
  assert.ok(urls.includes('https://api.example.com/descriptor.pb'));
  assert.ok(urls.includes('https://api.example.com/descriptor_set.pb'));
  assert.ok(urls.includes('https://api.example.com/service.protoset'));
  assert.ok(urls.every(u => u.startsWith('https://api.example.com/')));
  assert.throws(() => protoHuntPaths(''), /baseUrl is required/);
});

// Consolidated finding
test('federationGrpcFinding assembles a report finding', () => {
  const finding = federationGrpcFinding({
    gateway: { verdict: 'federation', confidence: 'high' },
    subgraphs: [{ subgraph: 'products', url: 'https://p.example/graphql' }],
    keyFields: [{ type: 'Product', fields: ['upc'] }],
    grpc: { reflectionEnabled: true, servicesFound: 4 },
  });
  assert.match(finding.title, /GraphQL federation \/ gRPC surface/);
  assert.equal(finding.severity, 'Medium');
  assert.equal(finding.confidence, 'high');
  assert.match(finding.evidence, /1 subgraph URL\(s\) extracted/);
  assert.ok(finding.recommendations.length > 0);
});

test('federationGrpcFinding stays Info with no surface mapped', () => {
  const finding = federationGrpcFinding({});
  assert.equal(finding.severity, 'Info');
  assert.match(finding.title, /no federation or gRPC surface mapped/);
});

// Registry
test('registry exposes every function and a default export', () => {
  const names = [
    'cyclicFragmentQueries', 'depthLadderQueries', 'inferDepthLimit',
    'costProbeQueries', 'inferCostAnalysis', 'federationServiceQuery',
    'entitiesAbuseDescriptors', 'extractSubgraphUrls', 'extractKeyFields',
    'fingerprintGateway', 'grpcReflectionDescriptor', 'protoHuntPaths',
    'federationGrpcFinding',
  ];
  for (const name of names) {
    assert.equal(typeof GRAPH_FEDERATION_GRPC_RECON[name], 'function', name);
  }
  assert.equal(graphFederationGrpcReconDefault, GRAPH_FEDERATION_GRPC_RECON);
});
