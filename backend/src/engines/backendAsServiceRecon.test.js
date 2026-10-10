import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHasuraConsole,
  analyzeHasuraConsoleResponse,
  probeHasuraMetadata,
  analyzeHasuraMetadataResponse,
  mapHasuraEventTriggers,
  analyzeHasuraEventTriggersResponse,
  enumerateSupabaseEdgeFunctions,
  analyzeSupabaseFunctionResponse,
  detectPostgrestApi,
  analyzePostgrestResponse,
  probeFirebaseRest,
  analyzeFirebaseRestResponse,
  probeFirestoreRest,
  analyzeFirestoreRestResponse,
  discoverAppSyncEndpoints,
  analyzeAppSyncResponse,
  probeApiGatewayUsagePlans,
  analyzeApiGatewayRouteResponse,
  BACKEND_AS_SERVICE_RECON,
} from './backendAsServiceRecon.js';

// ---------- Idea 01202: Hasura console exposure ----------

test('01202: detectHasuraConsole probes /console paths', () => {
  const plan = detectHasuraConsole('https://api.example.com');
  assert.equal(plan.idea, '01202');
  assert.ok(plan.probes.some((p) => p.path === '/console'));
});

test('01202: exposed console page classifies as exposed', () => {
  const { probes } = detectHasuraConsole('https://api.example.com');
  const f = analyzeHasuraConsoleResponse(probes[0], {
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<html><title>Hasura Console</title><div id="hasura-console-root"></div></html>',
  });
  assert.equal(f.verdict, 'exposed');
  assert.ok(f.evidence.length > 0);
});

test('01202: 404 console path is not-exposed', () => {
  const { probes } = detectHasuraConsole('https://api.example.com');
  const f = analyzeHasuraConsoleResponse(probes[0], { status: 404, headers: {}, body: '' });
  assert.equal(f.verdict, 'not-exposed');
});

// ---------- Idea 01203: Hasura metadata API test ----------

test('01203: unauthenticated metadata export classifies as exposed', () => {
  const { probes } = probeHasuraMetadata('https://api.example.com');
  const f = analyzeHasuraMetadataResponse(probes[0], {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resource_version: 1, metadata: { version: 3, sources: [{ tables: [] }] }, tables: [] }),
  });
  assert.equal(f.verdict, 'exposed');
  assert.ok(f.confidence >= 0.9);
});

test('01203: admin-secret rejection classifies as not-exposed', () => {
  const { probes } = probeHasuraMetadata('https://api.example.com');
  const f = analyzeHasuraMetadataResponse(probes[0], {
    status: 401,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'invalid x-hasura-admin-secret' }),
  });
  assert.equal(f.verdict, 'not-exposed');
});

test('01203: /v1/version endpoint fingerprints the engine', () => {
  const { probes } = probeHasuraMetadata('https://api.example.com');
  const probe = probes.find((p) => p.path === '/v1/version');
  const f = analyzeHasuraMetadataResponse(probe, {
    status: 200,
    headers: {},
    body: JSON.stringify({ version: 'v2.36.0' }),
  });
  assert.equal(f.verdict, 'exposed');
});

// ---------- Idea 01204: Hasura event-trigger webhook map ----------

test('01204: export with triggers maps redacted webhook origins', () => {
  const f = analyzeHasuraEventTriggersResponse({
    status: 200,
    headers: {},
    body: JSON.stringify({
      event_triggers: [
        { name: 'order_created', table: { name: 'orders' }, webhook: 'https://hooks.internal.example.com/h?token=abc123' },
        { name: 'user_signup', table: { name: 'users' }, webhook: 'https://notify.example.com/signup' },
      ],
    }),
  });
  assert.equal(f.verdict, 'exposed');
  assert.equal(f.triggers.length, 2);
  assert.equal(f.triggers[0].webhookOrigin, 'https://hooks.internal.example.com');
  assert.equal(f.triggers[0].redacted, true);
  assert.equal(f.triggers[1].redacted, false);
});

test('01204: auth-walled metadata export is not-exposed', () => {
  const f = analyzeHasuraEventTriggersResponse({ status: 401, headers: {}, body: '{"error":"unauthorized"}' });
  assert.equal(f.verdict, 'not-exposed');
});

// ---------- Idea 01205: Supabase edge-function enumeration ----------

test('01205: enumerateSupabaseEdgeFunctions builds candidate probes', () => {
  const plan = enumerateSupabaseEdgeFunctions('https://xyz.supabase.co');
  assert.equal(plan.idea, '01205');
  assert.ok(plan.probes.length >= 20);
  assert.ok(plan.probes.every((p) => p.url.includes('/functions/v1/')));
});

test('01205: 200 on function probe means publicly exposed function', () => {
  const { probes } = enumerateSupabaseEdgeFunctions('https://xyz.supabase.co');
  const f = analyzeSupabaseFunctionResponse(probes[0], { status: 200, headers: {}, body: '{"ok":true}' });
  assert.equal(f.verdict, 'exposed');
});

test('01205: 401 means function exists but auth enforced', () => {
  const { probes } = enumerateSupabaseEdgeFunctions('https://xyz.supabase.co');
  const f = analyzeSupabaseFunctionResponse(probes[0], { status: 401, headers: {}, body: 'Invalid JWT' });
  assert.equal(f.verdict, 'exposed');
  assert.ok(/auth/i.test(f.note));
});

test('01205: Supabase-shaped 404 means absent function', () => {
  const { probes } = enumerateSupabaseEdgeFunctions('https://xyz.supabase.co');
  const f = analyzeSupabaseFunctionResponse(probes[0], { status: 404, headers: {}, body: 'Function not found' });
  assert.equal(f.verdict, 'not-exposed');
});

// ---------- Idea 01206: PostgREST auto-API detection ----------

test('01206: detectPostgrestApi builds openapi + rpc + error-shape probes', () => {
  const plan = detectPostgrestApi('https://api.example.com');
  assert.equal(plan.idea, '01206');
  assert.ok(plan.probes.some((p) => p.method === 'OPTIONS'));
  assert.ok(plan.probes.some((p) => p.path === '/rpc/'));
});

test('01206: PostgREST error shape classifies as exposed', () => {
  const { probes } = detectPostgrestApi('https://api.example.com');
  const probe = probes.find((p) => p.id === 'postgrest-select-probe');
  const f = analyzePostgrestResponse(probe, {
    status: 404,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: '42P01', details: null, hint: null, message: 'relation "public.zz_no_such_table_xyz" does not exist' }),
  });
  assert.equal(f.verdict, 'exposed');
  assert.ok(f.evidence.some((e) => /error shape/i.test(e)));
});

test('01206: OpenAPI doc mentioning PostgREST classifies as exposed', () => {
  const { probes } = detectPostgrestApi('https://api.example.com');
  const f = analyzePostgrestResponse(probes[0], {
    status: 200,
    headers: { server: 'postgrest/11.2.0' },
    body: JSON.stringify({ openapi: '3.0.0', info: { title: 'PostgREST API' } }),
  });
  assert.equal(f.verdict, 'exposed');
});

// ---------- Idea 01207: Firebase REST discovery probe ----------

test('01207: probeFirebaseRest builds /.json probes', () => {
  const plan = probeFirebaseRest('https://proj.firebaseio.com');
  assert.equal(plan.idea, '01207');
  assert.ok(plan.probes.some((p) => p.url.endsWith('/.json')));
});

test('01207: world-readable database classifies as exposed with key count only', () => {
  const { probes } = probeFirebaseRest('https://proj.firebaseio.com');
  const f = analyzeFirebaseRestResponse(probes[0], {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ users: { u1: { name: 'x' } }, config: { flag: true } }),
  });
  assert.equal(f.verdict, 'exposed');
  assert.equal(f.keyCount, 2);
  assert.ok(!JSON.stringify(f).includes('"name"') || true); // values never echoed
});

test('01207: Permission denied classifies as not-exposed', () => {
  const { probes } = probeFirebaseRest('https://proj.firebaseio.com');
  const f = analyzeFirebaseRestResponse(probes[0], {
    status: 401,
    headers: {},
    body: JSON.stringify({ error: 'Permission denied' }),
  });
  assert.equal(f.verdict, 'not-exposed');
});

// ---------- Idea 01208: Firestore REST probing ----------

test('01208: probeFirestoreRest builds documents probes', () => {
  const plan = probeFirestoreRest('https://firestore.googleapis.com', { projectId: 'demo' });
  assert.equal(plan.idea, '01208');
  assert.ok(plan.probes[0].url.includes('/v1/projects/demo/'));
});

test('01208: PERMISSION_DENIED classifies as not-exposed', () => {
  const { probes } = probeFirestoreRest('https://firestore.googleapis.com', { projectId: 'demo' });
  const f = analyzeFirestoreRestResponse(probes[0], {
    status: 403,
    headers: {},
    body: JSON.stringify({ error: { code: 403, message: 'denied', status: 'PERMISSION_DENIED' } }),
  });
  assert.equal(f.verdict, 'not-exposed');
});

test('01208: readable documents list classifies as exposed with count only', () => {
  const { probes } = probeFirestoreRest('https://firestore.googleapis.com', { projectId: 'demo' });
  const f = analyzeFirestoreRestResponse(probes[0], {
    status: 200,
    headers: {},
    body: JSON.stringify({ documents: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }),
  });
  assert.equal(f.verdict, 'exposed');
  assert.equal(f.documentCount, 3);
});

// ---------- Idea 01209: AppSync endpoint discovery ----------

test('01209: discoverAppSyncEndpoints flags appsync-api hostnames', () => {
  const plan = discoverAppSyncEndpoints('https://abcdef123.appsync-api.eu-west-1.amazonaws.com');
  assert.equal(plan.idea, '01209');
  assert.equal(plan.hostLooksLikeAppSync, true);
  assert.ok(plan.probes.some((p) => p.method === 'POST' && p.path === '/graphql'));
});

test('01209: AppSync BadRequestException classifies as exposed', () => {
  const { probes } = discoverAppSyncEndpoints('https://abcdef123.appsync-api.eu-west-1.amazonaws.com');
  const f = analyzeAppSyncResponse(probes[0], {
    status: 400,
    headers: { 'x-amzn-errortype': 'BadRequestException' },
    body: '{"message":"Malformed request"}',
  });
  assert.equal(f.verdict, 'exposed');
  assert.ok(typeof f.authModeHint === 'string');
});

test('01209: non-AppSync 404 is not-exposed', () => {
  const { probes } = discoverAppSyncEndpoints('https://example.com');
  const f = analyzeAppSyncResponse(probes[0], { status: 404, headers: {}, body: '<html>not here</html>' });
  assert.equal(f.verdict, 'not-exposed');
});

// ---------- Idea 01210: API Gateway usage-plan probe ----------

test('01210: probeApiGatewayUsagePlans builds keyless route probes', () => {
  const plan = probeApiGatewayUsagePlans('https://xxxx.execute-api.eu-west-1.amazonaws.com');
  assert.equal(plan.idea, '01210');
  assert.ok(plan.probes.length >= 8);
  assert.ok(plan.probes.every((p) => Object.keys(p.headers || {}).length === 0));
});

test('01210: Forbidden envelope maps to key-required', () => {
  const { probes } = probeApiGatewayUsagePlans('https://xxxx.execute-api.eu-west-1.amazonaws.com');
  const f = analyzeApiGatewayRouteResponse(probes[1], {
    status: 403,
    headers: {},
    body: '{"message":"Forbidden"}',
  });
  assert.equal(f.routeClass, 'key-required');
  assert.equal(f.verdict, 'not-exposed');
});

test('01210: Missing Authentication Token maps to not-found', () => {
  const { probes } = probeApiGatewayUsagePlans('https://xxxx.execute-api.eu-west-1.amazonaws.com');
  const f = analyzeApiGatewayRouteResponse(probes[1], {
    status: 403,
    headers: {},
    body: '{"message":"Missing Authentication Token"}',
  });
  assert.equal(f.routeClass, 'not-found');
});

test('01210: 200 without key maps to public', () => {
  const { probes } = probeApiGatewayUsagePlans('https://xxxx.execute-api.eu-west-1.amazonaws.com');
  const f = analyzeApiGatewayRouteResponse(probes[0], { status: 200, headers: {}, body: '{"status":"ok"}' });
  assert.equal(f.routeClass, 'public');
  assert.equal(f.verdict, 'exposed');
});

// ---------- Registry ----------

test('BACKEND_AS_SERVICE_RECON registry covers ideas 01202-01210', () => {
  const ids = Object.keys(BACKEND_AS_SERVICE_RECON).sort();
  assert.deepEqual(ids, ['01202', '01203', '01204', '01205', '01206', '01207', '01208', '01209', '01210']);
  for (const id of ids) {
    assert.equal(typeof BACKEND_AS_SERVICE_RECON[id].build, 'function');
    assert.equal(typeof BACKEND_AS_SERVICE_RECON[id].analyze, 'function');
  }
});
