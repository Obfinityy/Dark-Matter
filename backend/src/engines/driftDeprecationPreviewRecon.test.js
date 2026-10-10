/**
 * driftDeprecationPreviewRecon.test.js — node:test coverage for the
 * schema-drift, deprecated-field, and preview-API recon engines
 * (ideas 01211–01220). All tests are offline: operator-supplied
 * snapshots/strings fed into pure analysis functions; no network calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffFieldMaps,
  detectResponseSchemaDrift,
  trackGraphqlSchemaDrift,
  detectRestSchemaDrift,
  detectBreakingChanges,
} from './schemaDriftRecon.js';
import {
  sweepDeprecatedSchemaMembers,
  testDeprecatedFieldResolvability,
  compareDeprecatedFieldExposure,
} from './deprecatedFieldRecon.js';
import {
  generateLabHosts,
  probeLabsBetaApis,
  huntFeaturePreviewEndpoints,
  fingerprintResponseHeaders,
} from './previewApiRecon.js';

// --- Idea 01211 ------------------------------------------------------------
test('Idea 01211 — detectResponseSchemaDrift flags added fields and endpoints', () => {
  const before = {
    '/users': { id: 'integer', name: 'string' },
    '/orders': { id: 'integer' },
  };
  const after = {
    '/users': { id: 'integer', name: 'string', ssn: 'string', emailVerifiedAt: 'string' },
    '/billing': { invoiceId: 'integer' },
  };
  const report = detectResponseSchemaDrift({ before, after });
  assert.equal(report.confidence, 'high');
  assert.deepEqual(report.addedEndpoints, ['/billing']);
  assert.deepEqual(report.removedEndpoints, ['/orders']);
  const users = report.endpointDrift.find(d => d.path === '/users');
  assert.ok(users);
  assert.equal(users.added.length, 2);
  assert.ok(users.added.some(f => f.name === 'ssn'));
  assert.equal(users.removed.length, 0);
  assert.equal(report.summary.addedFields, 2);
});

test('Idea 01211 — identical snapshots yield low confidence, zero drift', () => {
  const snap = { '/a': { x: 'string' } };
  const report = detectResponseSchemaDrift({ before: snap, after: snap });
  assert.equal(report.confidence, 'low');
  assert.equal(report.endpointDrift.length, 0);
});

test('Idea 01211 — diffFieldMaps detects type changes', () => {
  const d = diffFieldMaps({ id: 'integer' }, { id: 'string', extra: 'bool' });
  assert.equal(d.changed.length, 1);
  assert.deepEqual(d.changed[0], { name: 'id', from: 'integer', to: 'string' });
  assert.equal(d.added.length, 1);
});

// --- Idea 01212 ------------------------------------------------------------
test('Idea 01212 — trackGraphqlSchemaDrift diffs types, fields, args, deprecations', () => {
  const before = {
    types: {
      Query: { kind: 'OBJECT', fields: { user: { type: 'User', args: { id: 'ID' } }, users: { type: '[User]', args: {} } } },
      User: { kind: 'OBJECT', fields: { id: { type: 'ID' }, email: { type: 'String' } } },
    },
  };
  const after = {
    types: {
      Query: { kind: 'OBJECT', fields: {
        user: { type: 'User', args: { id: 'ID', includeDeleted: 'Boolean' } },
        adminPanel: { type: 'AdminPanel', args: {} },
      } },
      User: { kind: 'OBJECT', fields: { id: { type: 'ID' }, email: { type: 'String', deprecated: true, deprecationReason: 'Use contactEmail' } } },
      AdminPanel: { kind: 'OBJECT', fields: { token: { type: 'String' } } },
    },
  };
  const report = trackGraphqlSchemaDrift({ before, after });
  assert.equal(report.confidence, 'high');
  assert.deepEqual(report.addedTypes, ['AdminPanel']);
  assert.deepEqual(report.removedTypes, []);
  const query = report.typeDrift.find(t => t.type === 'Query');
  assert.ok(query.addedFields.some(f => f.field === 'adminPanel'));
  assert.ok(query.removedFields.some(f => f.field === 'users'));
  assert.equal(query.argChanges.length, 1);
  assert.equal(query.argChanges[0].added[0].name, 'includeDeleted');
  const user = report.typeDrift.find(t => t.type === 'User');
  assert.equal(user.newlyDeprecated.length, 1);
  assert.equal(user.newlyDeprecated[0].field, 'email');
});

// --- Idea 01213 ------------------------------------------------------------
test('Idea 01213 — detectRestSchemaDrift flags new methods and paths', () => {
  const before = { '/users': ['GET', 'HEAD'], '/admin': ['GET'] };
  const after = { '/users': ['GET', 'HEAD', 'POST', 'DELETE'], '/metrics': ['GET'] };
  const report = detectRestSchemaDrift({ before, after });
  assert.equal(report.confidence, 'high');
  assert.deepEqual(report.addedPaths.map(p => p.path), ['/metrics']);
  assert.deepEqual(report.removedPaths.map(p => p.path), ['/admin']);
  const users = report.methodDrift.find(d => d.path === '/users');
  assert.deepEqual(users.addedMethods, ['DELETE', 'POST']);
});

// --- Idea 01214 ------------------------------------------------------------
test('Idea 01214 — detectBreakingChanges flags removals in client usage', () => {
  const before = { '/users': { id: 'int', name: 'string', nickname: 'string' } };
  const after = { '/users': { id: 'int', displayName: 'string' } };
  const clientUsage = { '/users': ['id', 'name'] };
  const report = detectBreakingChanges({ before, after, clientUsage });
  assert.equal(report.confidence, 'high');
  assert.equal(report.breakingRemovals.length, 1);
  assert.equal(report.breakingRemovals[0].field, 'name');
  assert.equal(report.breakingRemovals[0].breaking, true);
  assert.ok(report.nonBreakingRemovals.some(f => f.field === 'nickname'));
  // nickname -> displayName should be guessed as a rename (similarity >= 0.6?)
  // At minimum the structure must be sane.
  assert.ok(Array.isArray(report.possibleRenames));
});

test('Idea 01214 — obvious rename is detected', () => {
  const before = { '/a': { userName: 'string' } };
  const after = { '/a': { username: 'string' } };
  const report = detectBreakingChanges({ before, after, clientUsage: { '/a': ['userName'] } });
  assert.ok(report.possibleRenames.some(r => r.from === 'userName' && r.to === 'username'));
});

// --- Idea 01215 ------------------------------------------------------------
test('Idea 01215 — testDeprecatedFieldResolvability confirms still-live fields', () => {
  const report = testDeprecatedFieldResolvability({
    deprecated: ['Query.oldToken', 'User.legacySsn'],
    resolved: [
      { path: 'Query.oldToken', returnedData: true, sample: 'tok_abc' },
      { path: 'User.legacySsn', returnedData: false },
    ],
  });
  assert.equal(report.confidence, 'high');
  assert.ok(report.findings.find(f => f.path === 'Query.oldToken').stillResolves);
  assert.ok(!report.findings.find(f => f.path === 'User.legacySsn').stillResolves);
});

// --- Idea 01216 ------------------------------------------------------------
test('Idea 01216 — compareDeprecatedFieldExposure flags unredacted deprecated output', () => {
  const report = compareDeprecatedFieldExposure({
    pairs: [
      { deprecated: { field: 'oldEmail', value: 'jane@example.com' }, replacement: { field: 'email', value: '***@***' } },
      { deprecated: { field: 'oldNick', value: 'jay' }, replacement: { field: 'nick', value: 'jay' } },
    ],
  });
  const f = report.findings[0];
  assert.equal(f.verdict, 'exposes-unredacted');
  assert.equal(f.confidence, 'high');
  assert.equal(report.findings[1].verdict, 'equivalent');
});

test('Idea 01216 — extra keys in deprecated output are flagged', () => {
  const report = compareDeprecatedFieldExposure({
    pairs: [
      { deprecated: { field: 'oldProfile', value: { name: 'j', internalId: '7' } }, replacement: { field: 'profile', value: { name: 'j' } } },
    ],
  });
  assert.equal(report.findings[0].verdict, 'exposes-extra-keys');
  assert.deepEqual(report.findings[0].extraKeys, ['internalId']);
});

// --- Idea 01217 ------------------------------------------------------------
test('Idea 01217 — sweepDeprecatedSchemaMembers enumerates live deprecated members', () => {
  const schema = {
    types: {
      Query: {
        kind: 'OBJECT',
        fields: {
          user: { type: 'User', args: { legacyId: { type: 'ID', deprecated: true, deprecationReason: 'Use id' } } },
          oldSearch: { type: 'String', deprecated: true, deprecationReason: 'Removed soon' },
        },
      },
      OldStatus: { kind: 'ENUM', enumValues: [{ name: 'ACTIVE' }, { name: 'RETIRED', deprecated: true }] },
      DeadType: { kind: 'OBJECT', deprecated: true, fields: {} },
    },
  };
  const report = sweepDeprecatedSchemaMembers({ schema });
  assert.equal(report.confidence, 'high');
  assert.equal(report.members.length, 4);
  const kinds = new Set(report.members.map(m => m.kind));
  assert.ok(kinds.has('field') && kinds.has('argument') && kinds.has('enum value') && kinds.has('type'));
  assert.ok(report.members.every(m => m.stillLive));
});

// --- Idea 01218 ------------------------------------------------------------
test('Idea 01218 — probeLabsBetaApis scores live API-like hosts high', () => {
  const hosts = generateLabHosts('example.com');
  assert.ok(hosts.includes('labs.example.com'));
  assert.ok(hosts.includes('beta.example.com'));
  assert.equal(generateLabHosts('notadomain').length, 0);

  const report = probeLabsBetaApis({
    baseDomain: 'example.com',
    probes: [
      { host: 'labs.example.com', status: 200, server: 'Express', contentType: 'application/json', apiLike: true },
      { host: 'beta.example.com', status: 403, server: 'nginx' },
      { host: 'canary.example.com', status: 0 },
    ],
  });
  assert.equal(report.confidence, 'high');
  const labs = report.candidates.find(c => c.host === 'labs.example.com');
  assert.equal(labs.confidence, 'high');
  assert.ok(labs.reachable);
  const beta = report.candidates.find(c => c.host === 'beta.example.com');
  assert.equal(beta.confidence, 'medium');
  const canary = report.candidates.find(c => c.host === 'canary.example.com');
  assert.ok(!canary.reachable);
});

// --- Idea 01219 ------------------------------------------------------------
test('Idea 01219 — huntFeaturePreviewEndpoints finds live preview paths', () => {
  const report = huntFeaturePreviewEndpoints({
    routes: [
      { path: '/api/v1/preview/reports', status: 200 },
      { path: '/api/v1/users', status: 200 },
      { path: '/beta/admin', status: 401 },
      { path: '/api/v1/next', status: 404 },
    ],
  });
  assert.equal(report.confidence, 'high');
  assert.equal(report.candidates.length, 3);
  assert.equal(report.candidates[0].path, '/api/v1/preview/reports');
  assert.equal(report.candidates[0].confidence, 'high');
  assert.ok(report.candidates[0].matchedSegments.includes('preview'));
  assert.ok(report.candidates.some(c => c.path === '/beta/admin' && c.confidence === 'medium'));
});

// --- Idea 01220 ------------------------------------------------------------
test('Idea 01220 — fingerprintResponseHeaders identifies framework + version', () => {
  const report = fingerprintResponseHeaders({
    url: 'https://api.example.com/',
    headers: {
      Server: 'nginx/1.24.0',
      'X-Powered-By': 'Express',
      Via: '1.1 vegur',
      'X-Request-Id': 'abc123',
    },
  });
  assert.equal(report.confidence, 'high');
  assert.ok(report.framework.includes('Express'));
  assert.equal(report.version, '1.24.0');
  assert.ok(report.versionDisclosure);
  const server = report.findings.find(f => f.header === 'server');
  assert.equal(server.framework, 'Nginx');
  assert.equal(server.version, '1.24.0');
});

test('Idea 01220 — hardened headers yield low confidence', () => {
  const report = fingerprintResponseHeaders({ headers: { 'x-request-id': 'abc' } });
  assert.equal(report.confidence, 'low');
  assert.ok(!report.versionDisclosure);
});
