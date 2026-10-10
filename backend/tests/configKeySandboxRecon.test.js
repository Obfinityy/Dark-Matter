/**
 * configKeySandboxRecon.test.js — deterministic unit tests for configKeySandboxRecon.js
 * (idea-bank ideas 1191–1200). All fixtures are inline; no network, no secrets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessMaintenanceBypass,
  assessConfigExposure,
  scanBundleForKeys,
  evaluateDemoKeys,
  diffSandboxProd,
  assessSandboxLeakage,
  assessDemoTenantScope,
  evaluateDemoCredentials,
  mineSpecVersions,
  assessDocsPathBypass,
  ideaFunctions,
  WAVE1191_COVERAGE,
} from '../src/engines/configKeySandboxRecon.js';

// --- 1191 --------------------------------------------------------------------

test('1191: assessMaintenanceBypass flags header + IP-allowlist signals', () => {
  const r = assessMaintenanceBypass({
    headers: { 'x-bypass-maintenance': '1', 'x-maintenance-mode': 'true' },
    ipRulesObserved: [
      { ip: '1.2.3.4', outcome: 'denied' },
      { ip: '10.0.0.1', outcome: 'allowed' },
    ],
    bypassResponse: { status: 200, servedLiveContent: true },
  });
  assert.ok(r.spoofableSignals.length >= 3);
  assert.equal(r.risk, 'High');
  assert.ok(r.notes.some((n) => /maintenance mode banner/i.test(n)));
});

test('1191: assessMaintenanceBypass low risk when no signals', () => {
  const r = assessMaintenanceBypass({ headers: {}, ipRulesObserved: [], bypassResponse: {} });
  assert.deepEqual(r.spoofableSignals, []);
  assert.equal(r.risk, 'Low');
});

test('1191: assessMaintenanceBypass tolerates missing input', () => {
  const r = assessMaintenanceBypass();
  assert.equal(r.risk, 'Low');
  assert.ok(Array.isArray(r.spoofableSignals));
});

// --- 1192 --------------------------------------------------------------------

test('1192: assessConfigExposure classifies secrets, hosts, toggles without echoing values', () => {
  const body = {
    apiUrl: 'https://api.internal.example.com',
    feature_dark_mode: true,
    stripe_secret: 'sk_live_' + 'A'.repeat(28), // synthetic fixture, built at runtime
    debug: true,
  };
  const r = assessConfigExposure({ path: '/config.json', body });
  assert.equal(r.risk, 'High');
  assert.ok(r.exposure.includes('secret-like values'));
  assert.ok(r.exposure.includes('feature toggles / flags'));
  assert.ok(!JSON.stringify(r).includes('SUPERSECRETVALLUE'));
  assert.ok(r.redactedSummary.some((s) => /\[redacted/.test(s)));
});

test('1192: assessConfigExposure handles raw string body', () => {
  const r = assessConfigExposure({ path: '/env', body: '{"region":"us-east-1"}' });
  assert.equal(r.risk, 'None');
  assert.deepEqual(r.exposure, []);
});

test('1192: assessConfigExposure handles invalid JSON string', () => {
  const r = assessConfigExposure({ path: '/config', body: 'not-json{{{' });
  assert.ok(Array.isArray(r.exposure));
});

// --- 1193 --------------------------------------------------------------------

test('1193: scanBundleForKeys reports type + position, never full key', () => {
  // Synthetic fixtures built at runtime — no literal secret-shaped strings in this file.
  const stripeKey = 'sk_live_' + 'AB'.repeat(14);
  const googleKey = 'AIza' + 'A'.repeat(35);
  const bundle = `const cfg = { stripe: "${stripeKey}" };
    var ga = "${googleKey}";`;
  const hits = scanBundleForKeys(bundle);
  const types = hits.map((h) => h.type);
  assert.ok(types.includes('Stripe Live Secret'));
  assert.ok(types.includes('Google API Key'));
  for (const h of hits) {
    assert.equal(typeof h.position, 'number');
    assert.ok(h.fingerprint.includes('[redacted'));
    assert.ok(!h.context.includes(stripeKey));
    assert.ok(!h.context.includes(googleKey));
    assert.ok(h.context.includes('[KEY-REDACTED]'));
  }
});

test('1193: scanBundleForKeys finds nothing in clean bundle', () => {
  assert.deepEqual(scanBundleForKeys('const a = 1; export default a;'), []);
});

test('1193: scanBundleForKeys matches AWS key format', () => {
  const hits = scanBundleForKeys('x = "AKIAIOSFODNN7EXAMPLE"');
  assert.ok(hits.some((h) => h.type === 'AWS Access Key'));
});

// --- 1194 --------------------------------------------------------------------

test('1194: evaluateDemoKeys High verdict when demo key works on prod', () => {
  const r = evaluateDemoKeys({ docsKeys: ['demo-key-basic', 'demo-key-pro'], worksOnProd: true, quota: 1000 });
  assert.match(r.verdict, /exposed/);
  assert.equal(r.risk, 'High');
});

test('1194: evaluateDemoKeys clean verdict when no prod use', () => {
  const r = evaluateDemoKeys({ docsKeys: ['demo-key-basic'], worksOnProd: false, quota: 0 });
  assert.equal(r.risk, 'Low');
  assert.match(r.verdict, /clean/);
});

test('1194: evaluateDemoKeys partial verdict for quota-only signal', () => {
  const r = evaluateDemoKeys({ docsKeys: ['demo-key'], worksOnProd: false, quota: 500 });
  assert.equal(r.risk, 'Medium');
});

// --- 1195 --------------------------------------------------------------------

test('1195: diffSandboxProd finds prod-only endpoints and shape diffs', () => {
  const r = diffSandboxProd({
    sandbox: {
      endpoints: ['/v1/users', '/v1/orders'],
      shapes: { '/v1/users': { id: 'string', name: 'string' } },
    },
    prod: {
      endpoints: ['/v1/users', '/v1/orders', '/v1/admin/reports'],
      shapes: { '/v1/users': { id: 'string', name: 'string', email: 'string' } },
    },
  });
  assert.deepEqual(r.undocumentedInProd, ['/v1/admin/reports']);
  assert.equal(r.shapeDiffs.length, 1);
  assert.ok(r.shapeDiffs[0].diff.some((d) => /prod-only field: email/.test(d)));
  assert.match(r.summary, /drift/);
});

test('1195: diffSandboxProd parity summary when identical', () => {
  const same = { endpoints: ['/a'], shapes: { '/a': { x: 1 } } };
  const r = diffSandboxProd({ sandbox: same, prod: same });
  assert.deepEqual(r.undocumentedInProd, []);
  assert.deepEqual(r.shapeDiffs, []);
  assert.match(r.summary, /parity/);
});

// --- 1196 --------------------------------------------------------------------

test('1196: assessSandboxLeakage flags PII-shaped data, redacts examples', () => {
  const body = { user: 'jane.doe@example.com', phone: '+1-415-555-0132', dob: '1990-04-22' };
  const r = assessSandboxLeakage(body);
  assert.ok(r.piiShapes.includes('email addresses'));
  assert.ok(r.piiShapes.includes('phone numbers'));
  assert.ok(r.piiShapes.includes('dob-shaped values'));
  assert.equal(r.risk, 'High');
  assert.ok(!JSON.stringify(r).includes('jane.doe@example.com'));
  assert.ok(r.redactedEvidence.every((e) => /\[redacted/.test(e)));
});

test('1196: assessSandboxLeakage low risk on clean body', () => {
  const r = assessSandboxLeakage({ mock: true, id: 42 });
  assert.deepEqual(r.piiShapes, []);
  assert.equal(r.risk, 'Low');
});

// --- 1197 --------------------------------------------------------------------

test('1197: assessDemoTenantScope flags cross-tenant references', () => {
  const r = assessDemoTenantScope({
    demoData: { tenantId: 'demo-1', recordIds: ['rec_a', 'rec_b'] },
    prodOverlapSignals: {
      sharedResourceRefs: ['bucket/shared-assets'],
      crossTenantRefs: ['rec_prod_99'],
    },
  });
  assert.ok(r.sharedDatastoreRisk.some((f) => /shared resource/i.test(f)));
  assert.ok(r.sharedDatastoreRisk.some((f) => /cross-tenant/i.test(f)));
  assert.equal(r.risk, 'High');
});

test('1197: assessDemoTenantScope low risk with no overlap', () => {
  const r = assessDemoTenantScope({ demoData: { tenantId: 'demo-1', recordIds: [] }, prodOverlapSignals: {} });
  assert.deepEqual(r.sharedDatastoreRisk, []);
  assert.equal(r.risk, 'Low');
});

// --- 1198 --------------------------------------------------------------------

test('1198: evaluateDemoCredentials flags elevated demo scope', () => {
  const r = evaluateDemoCredentials({
    documentedCreds: [{ label: 'demo-user', role: 'viewer' }],
    observedScope: ['read:profile', 'admin:settings', 'billing:view'],
  });
  assert.ok(r.elevatedScope.some((s) => /admin:settings/.test(s)));
  assert.ok(r.elevatedScope.some((s) => /billing:view/.test(s)));
  assert.equal(r.risk, 'High');
});

test('1198: evaluateDemoCredentials medium risk for plain observed scope', () => {
  const r = evaluateDemoCredentials({
    documentedCreds: [{ label: 'demo-user', role: 'viewer' }],
    observedScope: ['read:profile'],
  });
  assert.deepEqual(r.elevatedScope, []);
  assert.equal(r.risk, 'Medium');
});

test('1198: evaluateDemoCredentials low risk with no observations', () => {
  const r = evaluateDemoCredentials({ documentedCreds: [], observedScope: [] });
  assert.equal(r.risk, 'Low');
});

// --- 1199 --------------------------------------------------------------------

test('1199: mineSpecVersions flags retired-but-reachable specs', () => {
  const r = mineSpecVersions([
    { version: 'v1', url: 'https://api.example.com/docs/v1', reachable: true },
    { version: 'v2', url: 'https://api.example.com/docs/v2', reachable: false },
  ]);
  assert.deepEqual(r.retiredButReachable, [
    { version: 'v1', url: 'https://api.example.com/docs/v1' },
  ]);
  assert.equal(r.risk, 'Medium');
  assert.match(r.summary, /v1/);
});

test('1199: mineSpecVersions clean on empty input', () => {
  const r = mineSpecVersions([]);
  assert.deepEqual(r.retiredButReachable, []);
  assert.equal(r.risk, 'Low');
});

// --- 1200 --------------------------------------------------------------------

test('1200: assessDocsPathBypass detects bypass of linked-URL auth', () => {
  const r = assessDocsPathBypass({
    linkedUrl: { url: 'https://app.example.com/docs', requiresAuth: true },
    directPaths: [
      { path: '/docs/index.html', status: 200, requiresAuth: false },
      { path: '/api/docs', status: 403, requiresAuth: true },
    ],
  });
  assert.equal(r.bypassed, true);
  assert.deepEqual(r.openPaths, ['/docs/index.html']);
  assert.equal(r.risk, 'Medium');
});

test('1200: assessDocsPathBypass no bypass when linked URL is public', () => {
  const r = assessDocsPathBypass({
    linkedUrl: { url: 'https://app.example.com/docs', requiresAuth: false },
    directPaths: [{ path: '/docs', status: 200, requiresAuth: false }],
  });
  assert.equal(r.bypassed, false);
  assert.equal(r.risk, 'Low');
});

// --- coverage map -------------------------------------------------------------

test('ideaFunctions covers all 10 ideas and WAVE1191_COVERAGE matches', () => {
  const map = ideaFunctions();
  assert.deepEqual(Object.keys(map).map(Number), [1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1199, 1200]);
  assert.deepEqual(WAVE1191_COVERAGE, [1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1199, 1200]);
  for (const fn of Object.values(map)) {
    assert.equal(typeof fn, 'string');
  }
});
