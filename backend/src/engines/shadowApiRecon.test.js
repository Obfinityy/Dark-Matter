/**
 * shadowApiRecon.test.js — node:test assertions for shadowApiRecon.js.
 * Ideas 01071–01080, at least one test per idea.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPrivacyFields,
  diffResponseSchemas,
  betaPathCandidates,
  scoreBetaValidationHypothesis,
  parseSunsetHeaders,
  deprecatedEndpointProbes,
  buildSunsetCatalog,
  experimentalFeatureProbes,
  diffResponseHeaders,
  canaryRoutingProbes,
  extractBundleUrls,
  normalizeEndpointPath,
  diffAgainstDocumentedSpec,
  mineSourceMapEndpoints,
  mineDeclarationEndpoints,
  shadowApiReconFinding,
  SHADOW_API_RECON,
} from './shadowApiRecon.js';

// ---- Idea 01071: old-version field-exposure diff ----
test('classifyPrivacyFields separates sensitive names from routine ones', () => {
  const { privacySensitive, routine } = classifyPrivacyFields(['email', 'ssn', 'username', 'authToken', 'createdAt']);
  assert.deepEqual(privacySensitive.sort(), ['authToken', 'email', 'ssn']);
  assert.deepEqual(routine.sort(), ['createdAt', 'username']);
});

test('diffResponseSchemas reports removed privacy fields with findings', () => {
  const oldFields = ['id', 'username', 'email', 'ssn', 'role'];
  const newFields = ['id', 'username', 'role', 'avatarUrl'];
  const r = diffResponseSchemas(oldFields, newFields, { oldLabel: 'v1', newLabel: 'v2' });
  assert.deepEqual(r.removedFields, ['email', 'ssn']);
  assert.deepEqual(r.addedFields, ['avatarUrl']);
  assert.deepEqual(r.privacySensitiveRemoved.sort(), ['email', 'ssn']);
  assert.ok(r.findings.every(f => f.type === 'privacy-field-exposed-in-old-version' && f.confidence === 'high'));
  assert.ok(r.findings.some(f => f.field === 'ssn'));
});

test('diffResponseSchemas with identical schemas yields no findings', () => {
  const r = diffResponseSchemas(['a', 'b'], ['b', 'a']);
  assert.deepEqual(r.removedFields, []);
  assert.deepEqual(r.findings, []);
});

// ---- Idea 01072: beta weak-validation hypothesis ----
test('betaPathCandidates builds marker-prefixed and mid-path variants', () => {
  const c = betaPathCandidates(['/api/users', '/api/orders']);
  assert.ok(c.includes('/beta/api/users'));
  assert.ok(c.includes('/api/beta/users'));
  assert.ok(c.includes('/preview/api/orders'));
  assert.equal(new Set(c).size, c.length);
});

test('scoreBetaValidationHypothesis scores beta paths high and stable low', () => {
  const beta = scoreBetaValidationHypothesis({ path: '/api/beta/users', stablePath: '/api/users', documentedParams: null });
  assert.equal(beta.level, 'high');
  assert.ok(beta.score >= 70);
  assert.ok(beta.rationale.includes('beta marker'));
  const stable = scoreBetaValidationHypothesis({ path: '/api/users', documentedParams: 3 });
  assert.equal(stable.level, 'low');
});

// ---- Idea 01073: deprecated-but-live endpoint hunt ----
test('parseSunsetHeaders parses Sunset + Deprecation into a record', () => {
  const r = parseSunsetHeaders(
    { 'Deprecation': 'true', 'Sunset': 'Sat, 01 Jan 2033 00:00:00 GMT' },
    '/api/v1/users'
  );
  assert.ok(r);
  assert.equal(r.path, '/api/v1/users');
  assert.equal(r.deprecation, 'true');
  assert.ok(r.sunsetDate.startsWith('2033-01-01'));
  assert.equal(r.stillRetestable, true);
});

test('parseSunsetHeaders returns null without sunset headers and flags past sunsets as dead', () => {
  assert.equal(parseSunsetHeaders({ 'Content-Type': 'application/json' }), null);
  const r = parseSunsetHeaders({ Sunset: 'Sat, 01 Jan 2000 00:00:00 GMT' }, '/api/old');
  assert.equal(r.stillRetestable, false);
});

test('deprecatedEndpointProbes marks past-sunset paths as expected-dead', () => {
  const probes = deprecatedEndpointProbes([
    { path: '/api/old', sunsetDate: '2000-01-01T00:00:00.000Z' },
    { path: '/api/legacy', sunsetDate: '2999-01-01T00:00:00.000Z' },
  ]);
  assert.equal(probes.length, 2);
  assert.equal(probes[0].expectedDead, true);
  assert.equal(probes[1].expectedDead, false);
  assert.ok(probes.every(p => p.label.startsWith('deprecated-but-live:')));
});

// ---- Idea 01074: sunset-header catalog building ----
test('buildSunsetCatalog dedupes by path and sorts a timeline', () => {
  const catalog = buildSunsetCatalog([
    { path: '/a', deprecation: 'true', sunset: 'x', sunsetDate: '2025-06-01T00:00:00.000Z', stillRetestable: false },
    { path: '/b', deprecation: 'true', sunset: 'y', sunsetDate: '2024-01-01T00:00:00.000Z', stillRetestable: false },
    { path: '/a', deprecation: 'true', sunset: 'z', sunsetDate: '2026-06-01T00:00:00.000Z', stillRetestable: true },
    { path: '/c', deprecation: 'true', sunset: null, sunsetDate: null, stillRetestable: true },
  ]);
  assert.equal(catalog.entries.length, 3);
  assert.equal(catalog.entries[0].path, '/b'); // earliest first
  assert.equal(catalog.entries.find(e => e.path === '/a').sunsetDate, '2025-06-01T00:00:00.000Z'); // kept earliest
  assert.equal(catalog.earliestSunset, '2024-01-01T00:00:00.000Z');
  assert.equal(catalog.latestSunset, '2025-06-01T00:00:00.000Z');
  assert.equal(catalog.retestableCount, 1);
  assert.equal(catalog.deadCount, 2);
});

// ---- Idea 01075: experimental-header feature unlock ----
test('experimentalFeatureProbes builds header probes per path', () => {
  const probes = experimentalFeatureProbes(['/api/users']);
  assert.ok(probes.length > 0);
  assert.ok(probes.some(p => p.headers['X-Experimental-Features'] === 'true'));
  assert.ok(probes.some(p => p.headers['X-Labs-Enabled']));
  assert.ok(probes.every(p => p.path === '/api/users' && p.detect.length > 0));
});

// ---- Idea 01076: dark-launch detection via headers ----
test('diffResponseHeaders flags new cookies and diagnostic headers', () => {
  const withFlags = {
    'Content-Type': 'application/json',
    'Set-Cookie': 'session=abc; Path=/, dark_variant=b; Path=/',
    'X-Build': 'canary-42',
  };
  const withoutFlags = {
    'Content-Type': 'application/json',
    'Set-Cookie': 'session=abc; Path=/',
  };
  const r = diffResponseHeaders(withFlags, withoutFlags);
  assert.deepEqual(r.addedHeaders, ['x-build']);
  assert.deepEqual(r.changedHeaders, ['set-cookie']);
  assert.deepEqual(r.newCookies, ['dark_variant']);
  assert.deepEqual(r.diagnosticHeaders, ['x-build']);
  assert.ok(r.findings.some(f => f.type === 'dark-launch-cookie-leak' && f.confidence === 'high'));
  assert.ok(r.findings.some(f => f.type === 'dark-launch-diagnostic-header'));
});

test('diffResponseHeaders is case-insensitive on header names', () => {
  const r = diffResponseHeaders({ 'X-Build': '2' }, { 'x-build': '1' });
  assert.deepEqual(r.changedHeaders, ['x-build']);
});

// ---- Idea 01077: canary routing header test ----
test('canaryRoutingProbes covers header and cookie steering', () => {
  const probes = canaryRoutingProbes(['/api/users']);
  assert.ok(probes.some(p => p.headers['X-Canary'] === '1'));
  assert.ok(probes.some(p => p.cookies.canary === '1'));
  assert.ok(probes.some(p => p.cookies['x-canary'] === '1'));
  assert.ok(probes.every(p => p.label.startsWith('canary-route:/api/users')));
});

// ---- Idea 01078: shadow API detection via JS cross-reference ----
test('extractBundleUrls pulls fetch/XHR/path literals from bundle text', () => {
  const bundle = `
    fetch("/api/users");
    axios.post('/api/admin/promote', data);
    const x = new XMLHttpRequest(); x.open("GET", "/api/internal/stats?x=1");
    const s = "/static/app.js";
    const u = "https://api.example.com/v2/secret";
  `;
  const urls = extractBundleUrls(bundle);
  assert.ok(urls.includes('/api/users'));
  assert.ok(urls.includes('/api/admin/promote'));
  assert.ok(urls.includes('/api/internal/stats?x=1'));
  assert.ok(urls.includes('https://api.example.com/v2/secret'));
  assert.ok(!urls.includes('/static/app.js')); // static asset filtered
});

test('normalizeEndpointPath strips query strings and path params', () => {
  assert.equal(normalizeEndpointPath('/api/users/123?x=1'), '/api/users/123');
  assert.equal(normalizeEndpointPath('/api/users/:id'), '/api/users/{}');
  assert.equal(normalizeEndpointPath('/api/users/{id}'), '/api/users/{}');
});

test('diffAgainstDocumentedSpec flags undocumented endpoints', () => {
  const r = diffAgainstDocumentedSpec(['/api/users', '/api/internal/stats'], ['/api/users']);
  assert.deepEqual(r.shadowEndpoints, ['/api/internal/stats']);
  assert.deepEqual(r.documentedHit, ['/api/users']);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].type, 'shadow-api-endpoint');
  assert.equal(r.findings[0].confidence, 'medium');
});

// ---- Idea 01079: orphan endpoint harvest from source maps ----
test('mineSourceMapEndpoints harvests API strings from a source map', () => {
  const map = JSON.stringify({
    version: 3,
    sources: ['webpack://app/src/api.ts'],
    names: ['fetch'],
    sourcesContent: ['fetch("/api/graphql");\nfetch("/img/logo.png");'],
  });
  const r = mineSourceMapEndpoints(map);
  assert.deepEqual(r.apiStrings, ['/api/graphql']);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].type, 'sourcemap-orphan-endpoint');
});

test('mineSourceMapEndpoints reports a parse error for bad JSON', () => {
  const r = mineSourceMapEndpoints('not json {{{');
  assert.equal(r.findings[0].type, 'sourcemap-parse-error');
});

// ---- Idea 01080: TypeScript declaration endpoint mining ----
test('mineDeclarationEndpoints extracts method and path literals from .d.ts', () => {
  const dts = `
    export declare class UserClient {
      getUser(id: string): Promise<User>;
      updateProfile(body: Profile): Promise<void>;
    }
    export declare function adminPromote(userId: string): Promise<void>;
    export type Route = '/api/users' | '/api/admin/promote';
  `;
  const r = mineDeclarationEndpoints(dts);
  const names = r.methods.map(m => m.name);
  assert.ok(names.includes('getUser'));
  assert.ok(names.includes('adminPromote'));
  assert.ok(r.paths.includes('/api/users'));
  assert.ok(r.paths.includes('/api/admin/promote'));
  assert.ok(r.findings.some(f => f.type === 'sdk-declaration-endpoint' && f.confidence === 'high'));
});

// ---- house style: uniform finding + registry ----
test('shadowApiReconFinding builds a uniform report finding', () => {
  const f = shadowApiReconFinding({ title: 'retired route alive', evidence: 'e', targets: ['/a'], confidence: 'high' });
  assert.equal(f.title, 'Shadow API recon — retired route alive');
  assert.equal(f.severity, 'Info');
  assert.equal(f.confidence, 'high');
  assert.ok(f.recommendation.includes('410'));
});

test('SHADOW_API_RECON registry exposes every idea helper', () => {
  for (const name of [
    'classifyPrivacyFields', 'diffResponseSchemas', 'betaPathCandidates',
    'scoreBetaValidationHypothesis', 'parseSunsetHeaders', 'deprecatedEndpointProbes',
    'buildSunsetCatalog', 'experimentalFeatureProbes', 'diffResponseHeaders',
    'canaryRoutingProbes', 'extractBundleUrls', 'normalizeEndpointPath',
    'diffAgainstDocumentedSpec', 'mineSourceMapEndpoints', 'mineDeclarationEndpoints',
    'shadowApiReconFinding',
  ]) {
    assert.equal(typeof SHADOW_API_RECON[name], 'function', name);
  }
});
