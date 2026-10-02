/**
 * Worker n6b (Wave-2) verification suite — ADVANCED vulnerability classes.
 *
 * Proof strategy (coordinator bar): every probe makes REAL HTTP requests
 * against our own deliberately-vulnerable node:http fixture on 127.0.0.1:4761
 * (never external targets). Each finding asserted here was OBSERVED in a
 * real response — forged token accepted, template evaluated, callback hit,
 * 101 upgrade, parallel over-limit success, high-entropy secret in bundle.
 * Honest negatives are asserted too: no finding where nothing is exploitable.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startAdvFixture } from './support/advVulnFixture.js';
import {
  jwtProbe, sstiProbe, xxeProbe, graphqlProbe, websocketProbe,
  raceProbe, secretsProbe, ADV_PROBES
} from '../src/tools/builtin/advProbes.js';
import { ToolRegistry } from '../src/tools/registry.js';

const PROBE_NAMES = ['jwt_attack_probe', 'ssti_probe', 'xxe_probe', 'graphql_probe', 'websocket_probe', 'race_condition_probe', 'secrets_in_js_probe'];

let fix;
let BASE;

before(async () => {
  fix = await startAdvFixture();
  BASE = fix.baseUrl;
});

after(async () => {
  await fix.stop();
});

const byType = (findings, type) => findings.filter((f) => f.type === type);

// ═══════════════════════════════════════════════════════════════════
// Registration — probes are real tools in the registry + executor map
// ═══════════════════════════════════════════════════════════════════
describe('n6b registration', () => {
  it('all 7 probe names are registered tools', () => {
    for (const n of PROBE_NAMES) {
      const t = ToolRegistry.get(n);
      assert.ok(t, `${n} registered`);
      assert.equal(t.category, 'vulnerability_detection');
      assert.equal(t.requiresAuthorization, true);
      assert.equal(t.requiresKali, false);
    }
  });
  it('ADV_PROBES dispatch keys match the registered names', () => {
    assert.deepEqual(Object.keys(ADV_PROBES).sort(), [...PROBE_NAMES].sort());
  });
});

// ═══════════════════════════════════════════════════════════════════
// 1. JWT attacks (priority 1)
// ═══════════════════════════════════════════════════════════════════
describe('n6b jwt_attack_probe', () => {
  it("detects alg:none acceptance (critical)", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/api/login' });
    const f = byType(r.findings, 'jwt-none-alg');
    assert.equal(f.length, 1, `expected 1 none-alg finding, got ${JSON.stringify(r.checks)}`);
    assert.equal(f[0].severity, 'critical');
    assert.ok(f[0].evidence.responseSnippet.includes('fixture-user'));
  });

  it("cracks the weak HMAC secret and forges an admin token (critical)", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/api/login' });
    const f = byType(r.findings, 'jwt-weak-secret');
    assert.equal(f.length, 1);
    assert.equal(f[0].evidence.secret, 'secret');
    assert.equal(f[0].severity, 'critical');
  });

  it("detects kid path traversal via server error evidence (high)", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/api/login' });
    const f = byType(r.findings, 'jwt-kid-traversal');
    assert.equal(f.length, 1);
    assert.ok(/ENOENT|no such file/i.test(f[0].evidence.responseSnippet), 'error proves path resolution');
    assert.ok(f[0].evidence.responseSnippet.includes('passwd'));
  });

  it("proves jku key-confusion: server fetches attacker JWKS AND accepts the forged token", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/api/login' });
    const fetch = byType(r.findings, 'jwt-jku-key-fetch');
    const trust = byType(r.findings, 'jwt-jku-trusted');
    assert.equal(fetch.length, 1, 'server-side JWKS fetch observed');
    assert.ok(fetch[0].evidence.callbackHit, 'callback hit recorded');
    assert.equal(fetch[0].severity, 'high');
    assert.equal(trust.length, 1, 'attacker-signed token accepted');
    assert.equal(trust[0].severity, 'critical');
  });

  it("HONEST NEGATIVE: no findings when no endpoint gates on the token", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/api/login', protectedPaths: ['/api/balance'] });
    assert.equal(r.findings.length, 0, `expected zero findings, got ${JSON.stringify(r.findings)}`);
    assert.ok(r.note && /No endpoint/.test(r.note));
  });

  it("HONEST NEGATIVE: reports cleanly when no token is obtainable", async () => {
    const r = await jwtProbe({ baseUrl: BASE, loginPath: '/no-such-login' });
    assert.equal(r.findings.length, 0);
    assert.ok(/No JWT obtainable/.test(r.note));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. SSTI (priority 2)
// ═══════════════════════════════════════════════════════════════════
describe('n6b ssti_probe', () => {
  it("detects evaluated Jinja2/Twig expression (high)", async () => {
    const r = await sstiProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'ssti');
    assert.ok(f.length >= 1, `expected ≥1 ssti finding, checks: ${JSON.stringify(r.checks.slice(0, 4))}`);
    assert.equal(f[0].severity, 'high');
    assert.match(f[0].evidence.request, /\{\{\d+\*\d+\}\}/);
    // response contains the COMPUTED value, not the raw payload
    assert.ok(!f[0].evidence.responseSnippet.includes('{{'));
  });

  it("HONEST NEGATIVE: reflection without evaluation is not SSTI", async () => {
    // / (homepage) reflects nothing as a template — no evaluated payloads there
    const r = await sstiProbe({ baseUrl: BASE, endpoints: ['/missing-page'] });
    const reflectedOnly = r.checks.filter((c) => c.target && c.target.includes('/missing-page'));
    assert.ok(reflectedOnly.every((c) => c.evaluated === false), 'nothing evaluated on a 404 page');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. XXE
// ═══════════════════════════════════════════════════════════════════
describe('n6b xxe_probe', () => {
  it("proves external-entity resolution via callback hit (high)", async () => {
    const r = await xxeProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'xxe-external-entity');
    assert.equal(f.length, 1, `expected 1 xxe finding: ${JSON.stringify(r.checks)}`);
    assert.equal(f[0].severity, 'high');
    assert.ok(f[0].evidence.callbackHit, 'our listener was hit by the target');
  });

  it("detects file:///etc/passwd disclosure (critical)", async () => {
    const r = await xxeProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'xxe-file-disclosure');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'critical');
    assert.ok(f[0].evidence.responseSnippet.includes('root:x:0:0'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. GraphQL (priority 3)
// ═══════════════════════════════════════════════════════════════════
describe('n6b graphql_probe', () => {
  it("detects the endpoint and enabled introspection (medium)", async () => {
    const r = await graphqlProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'graphql-introspection');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'medium');
    assert.ok(f[0].evidence.responseSnippet.includes('__schema'));
  });

  it("detects field-suggestion schema leak (low)", async () => {
    const r = await graphqlProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'graphql-field-suggestion');
    assert.equal(f.length, 1);
    assert.match(f[0].evidence.suggestion, /Did you mean/);
  });

  it("detects query batching (medium)", async () => {
    const r = await graphqlProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'graphql-batching');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'medium');
  });

  it("detects GET-based queries (low)", async () => {
    const r = await graphqlProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'graphql-get-queries');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'low');
  });

  it("HONEST NEGATIVE: no GraphQL findings against a server with no GraphQL", async () => {
    // NOTE: the probe also checks its built-in default paths, so the negative
    // needs a target with no GraphQL anywhere — a dead 404 server.
    const dead = http.createServer((req, res) => { res.writeHead(404); res.end('nope'); });
    await new Promise((r) => dead.listen(0, '127.0.0.1', r));
    try {
      const r = await graphqlProbe({ baseUrl: `http://127.0.0.1:${dead.address().port}` });
      assert.equal(r.findings.length, 0, `expected zero findings: ${JSON.stringify(r.findings)}`);
      assert.ok(r.checks.every((c) => c.graphql === false));
    } finally {
      await new Promise((r) => dead.close(r));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. WebSocket security
// ═══════════════════════════════════════════════════════════════════
describe('n6b websocket_probe', () => {
  it("detects missing Origin validation on upgrade (medium)", async () => {
    const r = await websocketProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'websocket-no-origin-check');
    assert.equal(f.length, 1, `expected no-origin finding: ${JSON.stringify(r.checks)}`);
    assert.equal(f[0].severity, 'medium');
  });

  it("detects cross-site Origin acceptance — CSWSH (high)", async () => {
    const r = await websocketProbe({ baseUrl: BASE });
    const f = byType(r.findings, 'websocket-cswsh');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'high');
    assert.match(f[0].evidence.request, /evil-attacker\.example/);
  });

  it("detects unauthenticated upgrade when authToken is supplied", async () => {
    const r = await websocketProbe({ baseUrl: BASE, authToken: 'dummy-token' });
    const f = byType(r.findings, 'websocket-no-auth');
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, 'high');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Race conditions
// ═══════════════════════════════════════════════════════════════════
describe('n6b race_condition_probe', () => {
  it("detects single-use coupon applied N times in parallel (high)", async () => {
    const r = await raceProbe({
      baseUrl: BASE, endpoint: '/api/coupon/apply', parallel: 6, expectation: { maxSuccess: 1 }
    });
    const f = byType(r.findings, 'race-condition');
    assert.equal(f.length, 1, `expected race finding: ${JSON.stringify(r.checks)}`);
    assert.equal(f[0].severity, 'high');
    assert.equal(f[0].evidence.successCount, 6);
    assert.equal(f[0].evidence.expectedMax, 1);
  });

  it("detects overdraft via parallel transfers using a state check", async () => {
    fix.reset();
    const r = await raceProbe({
      baseUrl: BASE, endpoint: '/api/transfer', body: { amount: 100 }, parallel: 10,
      expectation: { maxSuccess: 5, maxTotalDelta: 500 },
      stateCheck: { path: '/api/balance', field: 'balance' }
    });
    const f = byType(r.findings, 'race-condition');
    assert.equal(f.length, 1);
    assert.equal(f[0].evidence.stateBefore, 500);
    // note: the probe's single baseline request also transfers 100 → 500-100-1000
    assert.equal(f[0].evidence.stateAfter, -600);
    assert.equal(f[0].evidence.stateDelta, -1100);
  });

  it("HONEST NEGATIVE: no finding when successes stay within the stated limit", async () => {
    const r = await raceProbe({
      baseUrl: BASE, endpoint: '/api/coupon/apply', parallel: 4, expectation: { maxSuccess: 10 }
    });
    assert.equal(r.findings.length, 0, `expected zero findings: ${JSON.stringify(r.findings)}`);
    const verdicts = r.checks.map((c) => c.verdict).filter(Boolean);
    assert.ok(verdicts.some((v) => /no race/.test(v)), `honest negative recorded: ${JSON.stringify(verdicts)}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Secrets in JS (priority 4)
// ═══════════════════════════════════════════════════════════════════
describe('n6b secrets_in_js_probe', () => {
  it("finds hardcoded Stripe + AWS + generic API keys in the bundle", async () => {
    const r = await secretsProbe({ baseUrl: BASE });
    const names = r.findings.map((f) => f.evidence.pattern).sort();
    assert.ok(names.includes('stripe-live-key'), `stripe key found, got: ${names}`);
    assert.ok(names.includes('aws-access-key'), `aws key found, got: ${names}`);
    assert.ok(names.includes('generic-secret'), `generic apiKey found, got: ${names}`);
    assert.ok(r.findings.every((f) => f.severity === 'high' && f.type === 'exposed-secret'));
    for (const f of r.findings) {
      assert.match(f.evidence.redactedValue, /\[REDACTED\]/, 'evidence is redacted');
    }
  });

  it("does NOT flag the placeholder secret (no false positive)", async () => {
    const r = await secretsProbe({ baseUrl: BASE });
    const raw = JSON.stringify(r.findings);
    assert.ok(!raw.includes('test-key-123'), 'placeholder must not be reported');
  });

  it("never exfiltrates a full secret in any evidence field", async () => {
    const r = await secretsProbe({ baseUrl: BASE });
    const raw = JSON.stringify(r.findings);
    // synthetic key, assembled so no secret literal lives in source
    const stripeKey = ["sk_live", "51H7xYqK9mN2pQ4rT6vW8xZ0aB1c"].join("_");
    assert.ok(!raw.includes(stripeKey), 'full stripe key must not appear');
    assert.ok(!raw.includes('9f8e7d6c5b4a39281706f5e4d3c2b1a'), 'full generic key must not appear');
  });
});
