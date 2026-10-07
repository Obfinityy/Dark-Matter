/**
 * idorHarness.test.js — Two-Account IDOR Harness verification.
 *
 * No real network: every test injects a mock httpClient that returns canned
 * responses based on URL + auth header. The harness must distinguish:
 *   1. Real IDOR  → attack (A with B's ID) returns B's data            → VULNERABLE
 *   2. Hard block → 403/401/redirect                                    → not_vulnerable
 *   3. Soft block → 200 error page without B's data                     → not_vulnerable (no FP)
 *   4. ID ignored → 200 echoing A's own record                          → not_vulnerable (no FP)
 *   5. Public resource → identical baseline/control                      → not_vulnerable (no FP)
 *   6. Broken control/baseline                                          → inconclusive (no FP)
 * Plus: numeric IDs, UUIDs, query params, path params, header-based IDs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdorProbes,
  analyzeIdor,
  testIdor,
  parseIdLocation,
  bodyToString,
} from '../src/engines/idorHarness.js';

const accountA = {
  id: '1001',
  email: 'alice@example.com',
  headers: { Authorization: 'Bearer TOKEN_A' },
};
const accountB = {
  id: '1002',
  email: 'bob@example.com',
  headers: { Authorization: 'Bearer TOKEN_B' },
};

const A_PROFILE = JSON.stringify({ id: '1001', email: 'alice@example.com', name: 'Alice', role: 'user' });
const B_PROFILE = JSON.stringify({ id: '1002', email: 'bob@example.com', name: 'Bob', role: 'user' });
const DENIED_JSON = JSON.stringify({ error: 'Forbidden', message: 'Access denied: not your resource' });
const LOGIN_HTML = '<html><body>Please log in to continue</body></html>';

/**
 * Mock httpClient. `routes` maps "METHOD url :: authHeader" → response.
 * Anything unmapped returns 500 so missing routes fail loudly, not silently.
 */
function mockClient(routes) {
  return async ({ url, method, headers, body }) => {
    const key = `${String(method).toUpperCase()} ${url} :: ${headers?.Authorization || headers?.authorization || ''}`;
    if (Object.hasOwn(routes, key)) return routes[key];
    throw new Error(`mock httpClient: no route for ${key}`);
  };
}

const R = (status, body, headers = {}) => ({ status, headers, body });

// ═══════════════════════════════════════════════════════════════════
// parseIdLocation
// ═══════════════════════════════════════════════════════════════════
describe('parseIdLocation', () => {
  it('defaults to path', () => {
    assert.deepEqual(parseIdLocation(), { in: 'path', name: null });
    assert.deepEqual(parseIdLocation('path'), { in: 'path', name: null });
  });
  it('parses query: and header: shorthands', () => {
    assert.deepEqual(parseIdLocation('query:user_id'), { in: 'query', name: 'user_id' });
    assert.deepEqual(parseIdLocation('header:X-User-Id'), { in: 'header', name: 'X-User-Id' });
  });
  it('accepts object form', () => {
    assert.deepEqual(parseIdLocation({ in: 'query', name: 'id' }), { in: 'query', name: 'id' });
  });
  it('rejects garbage', () => {
    assert.throws(() => parseIdLocation('cookie:session'), /unrecognized idParam/);
    assert.throws(() => parseIdLocation({ in: 'query' }), /name is required/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildIdorProbes
// ═══════════════════════════════════════════════════════════════════
describe('buildIdorProbes', () => {
  it('builds baseline/attack/control with swapped path ID', () => {
    const { probes } = buildIdorProbes({
      url: 'https://target.test/api/users/1001/profile',
      accountA, accountB,
    });
    assert.equal(probes.length, 3);
    const [base, attack, control] = probes;
    assert.equal(base.label, 'baseline');
    assert.ok(base.url.includes('/users/1001/'), 'baseline keeps A id');
    assert.equal(base.headers.Authorization, 'Bearer TOKEN_A');
    assert.equal(attack.label, 'attack');
    assert.ok(attack.url.includes('/users/1002/'), 'attack swaps to B id');
    assert.equal(attack.headers.Authorization, 'Bearer TOKEN_A', 'attack still authed as A');
    assert.equal(attack.expectBlocked, true);
    assert.equal(control.label, 'control');
    assert.ok(control.url.includes('/users/1002/profile'), "control targets B's resource");
    assert.equal(control.headers.Authorization, 'Bearer TOKEN_B');
  });

  it('swaps query params', () => {
    const { probes } = buildIdorProbes({
      url: 'https://target.test/api/profile?user_id=1001',
      accountA, accountB, idParam: 'query:user_id',
    });
    const attack = probes.find((p) => p.label === 'attack');
    assert.ok(new URL(attack.url).searchParams.get('user_id') === '1002');
  });

  it('swaps header-based IDs', () => {
    const { probes } = buildIdorProbes({
      url: 'https://target.test/api/me',
      accountA, accountB, idParam: 'header:X-User-Id',
    });
    const attack = probes.find((p) => p.label === 'attack');
    assert.equal(attack.headers['X-User-Id'], '1002');
    assert.equal(attack.url, 'https://target.test/api/me');
  });

  it('supports UUID identifiers', () => {
    const a = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', headers: { Authorization: 'Bearer UA' } };
    const b = { id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890', headers: { Authorization: 'Bearer UB' } };
    const { probes } = buildIdorProbes({
      url: `https://target.test/api/docs/${a.id}`,
      accountA: a, accountB: b,
    });
    const attack = probes.find((p) => p.label === 'attack');
    assert.ok(attack.url.includes(b.id));
  });

  it('applies {{ID}} body templates for write-IDOR', () => {
    const { probes } = buildIdorProbes({
      url: 'https://target.test/api/users/email',
      method: 'PUT',
      accountA, accountB,
      idParam: { in: 'body' },
      bodyTemplate: '{"userId":"{{ID}}","email":"evil@x.test"}',
    });
    const attack = probes.find((p) => p.label === 'attack');
    assert.ok(String(attack.body).includes('"userId":"1002"'));
    const base = probes.find((p) => p.label === 'baseline');
    assert.ok(String(base.body).includes('"userId":"1001"'));
  });

  it('validates inputs', () => {
    assert.throws(() => buildIdorProbes({ url: '', accountA, accountB }), /url is required/);
    assert.throws(
      () => buildIdorProbes({ url: 'https://x.test/u/1', accountA, accountB: { headers: { Authorization: 'Bearer X' } } }),
      /accountB\.id/
    );
    assert.throws(
      () => buildIdorProbes({ url: 'https://x.test/u/9999', accountA, accountB }),
      /no path segment equals accountA.id/
    );
    assert.throws(
      () => buildIdorProbes({ url: 'https://x.test/u/1001', accountA, accountB: { ...accountB, id: '1001' } }),
      /must differ/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// analyzeIdor — verdict logic
// ═══════════════════════════════════════════════════════════════════
describe('analyzeIdor', () => {
  const ctx = { accountA, accountB };
  const ok = (body) => R(200, body);

  it('flags real IDOR: attack returns B\'s data', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok(B_PROFILE), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'vulnerable');
    assert.equal(r.vulnerable, true);
    assert.equal(r.confidence, 'high');
    assert.match(r.evidence, /CWE-639/);
  });

  it('flags IDOR when attack body mirrors control body', () => {
    // Markers stripped from bodies, but attack == control != baseline
    const bAnon = JSON.stringify({ display: 'victim-data-xyz', secret: 'ssn-000' });
    const aAnon = JSON.stringify({ display: 'attacker-data-abc', secret: 'none' });
    const r = analyzeIdor(ok(aAnon), ok(bAnon), ok(bAnon), { accountA: { id: '1001', headers: {} }, accountB: { id: '1002', headers: {} } });
    assert.equal(r.verdict, 'vulnerable');
    assert.equal(r.confidence, 'medium');
  });

  it('clean on 403 block', () => {
    const r = analyzeIdor(ok(A_PROFILE), R(403, DENIED_JSON), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
    assert.equal(r.vulnerable, false);
    assert.match(r.evidence, /403/);
  });

  it('clean on 401 block', () => {
    const r = analyzeIdor(ok(A_PROFILE), R(401, 'Unauthorized'), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
  });

  it('clean on redirect to login', () => {
    const r = analyzeIdor(
      ok(A_PROFILE),
      R(302, '', { location: 'https://target.test/login?next=/api/users/1002' }),
      ok(B_PROFILE), ctx
    );
    assert.equal(r.verdict, 'not_vulnerable');
    assert.match(r.evidence, /login/i);
  });

  it('clean on 404 (object hidden from attacker)', () => {
    const r = analyzeIdor(ok(A_PROFILE), R(404, 'Not found'), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
  });

  it('no false positive: 200 error page without B data', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok(DENIED_JSON), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
    assert.match(r.evidence, /error\/denied page/i);
  });

  it('no false positive: 200 HTML login wall', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok(LOGIN_HTML), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
  });

  it('no false positive: ID ignored, own record echoed', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok(A_PROFILE), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
    assert.match(r.evidence, /ignored/i);
  });

  it('no false positive: public resource (baseline == control)', () => {
    const pub = JSON.stringify({ id: '1001', public: true });
    const r = analyzeIdor(ok(pub), ok(pub), ok(pub), ctx);
    assert.equal(r.verdict, 'not_vulnerable');
    assert.match(r.evidence, /not user-scoped/i);
  });

  it('inconclusive when control fails', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok(B_PROFILE), R(500, 'boom'), ctx);
    assert.equal(r.verdict, 'inconclusive');
  });

  it('inconclusive when baseline fails', () => {
    const r = analyzeIdor(R(401, 'bad token'), ok(B_PROFILE), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'inconclusive');
  });

  it('inconclusive on ambiguous 200 body', () => {
    const r = analyzeIdor(ok(A_PROFILE), ok('{"weird":"unrelated-shape"}'), ok(B_PROFILE), ctx);
    assert.equal(r.verdict, 'inconclusive');
  });

  it('bodyToString handles objects, buffers, null', () => {
    assert.equal(bodyToString({ a: 1 }), '{"a":1}');
    assert.equal(bodyToString(Buffer.from('hi')), 'hi');
    assert.equal(bodyToString(null), '');
  });
});

// ═══════════════════════════════════════════════════════════════════
// testIdor — end-to-end with mocked httpClient
// ═══════════════════════════════════════════════════════════════════
describe('testIdor (mocked httpClient, no network)', () => {
  const URL = 'https://target.test/api/users/1001';

  it('detects IDOR end-to-end', async () => {
    const client = mockClient({
      [`GET ${URL} :: Bearer TOKEN_A`]: R(200, A_PROFILE),
      [`GET https://target.test/api/users/1002 :: Bearer TOKEN_A`]: R(200, B_PROFILE),
      [`GET https://target.test/api/users/1002 :: Bearer TOKEN_B`]: R(200, B_PROFILE),
    });
    const r = await testIdor({ url: URL, accountA, accountB }, client);
    assert.equal(r.verdict, 'vulnerable');
    assert.equal(r.idLocation, 'path');
    assert.equal(r.probes.length, 3);
  });

  it('returns clean when properly blocked', async () => {
    const client = mockClient({
      [`GET ${URL} :: Bearer TOKEN_A`]: R(200, A_PROFILE),
      [`GET https://target.test/api/users/1002 :: Bearer TOKEN_A`]: R(403, DENIED_JSON),
      [`GET https://target.test/api/users/1002 :: Bearer TOKEN_B`]: R(200, B_PROFILE),
    });
    const r = await testIdor({ url: URL, accountA, accountB }, client);
    assert.equal(r.verdict, 'not_vulnerable');
    assert.equal(r.vulnerable, false);
  });

  it('works with query-param IDs', async () => {
    const base = 'https://target.test/api/profile?user_id=1001';
    const atk = 'https://target.test/api/profile?user_id=1002';
    const client = mockClient({
      [`GET ${base} :: Bearer TOKEN_A`]: R(200, A_PROFILE),
      [`GET ${atk} :: Bearer TOKEN_A`]: R(200, B_PROFILE),
      [`GET ${atk} :: Bearer TOKEN_B`]: R(200, B_PROFILE),
    });
    const r = await testIdor({ url: base, accountA, accountB, idParam: 'query:user_id' }, client);
    assert.equal(r.verdict, 'vulnerable');
    assert.equal(r.idLocation, 'query');
  });

  it('supports write-IDOR via PUT with body template', async () => {
    const u = 'https://target.test/api/users/email';
    // Route on body content: the server applies whichever userId the body carries.
    const bodyAware = async ({ headers, body }) => {
      const b = bodyToString(body);
      if (b.includes('"userId":"1002"')) {
        return R(200, JSON.stringify({ ok: true, userId: '1002', email: 'bob@example.com' }));
      }
      return R(200, JSON.stringify({ ok: true, userId: '1001', email: 'alice@example.com' }));
    };
    const r = await testIdor(
      {
        url: u, method: 'PUT', accountA, accountB,
        idParam: { in: 'body' },
        bodyTemplate: '{"userId":"{{ID}}","email":"attacker@evil.test"}',
      },
      bodyAware
    );
    assert.equal(r.verdict, 'vulnerable');
    assert.equal(r.idLocation, 'body');
  });

  it('requires an injected httpClient', async () => {
    await assert.rejects(testIdor({ url: URL, accountA, accountB }), /httpClient is required/);
  });
});
