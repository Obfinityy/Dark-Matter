// API token auth probe tests (row #342 [High] API — Broken
// authentication (token in URL / weak tokens), CWE-287 | OWASP
// API02:2023; phase 103, 'api-token-auth').
//
// The probe runs two legs with their own controls: S1 mines API
// routes whose query string carries a token-like parameter name
// and runs a three-way differential (no-token GET must be refused,
// header-token GET is the control, query-token GET confirms only
// when granted with a substantive body); S2 logs in twice and
// judges the issued tokens (opaque only — JWTs are jwt.js
// territory). The fake fetch below simulates a Juice-shaped lab:
// POST /rest/user/login returns a token, GET /api/Profile is the
// token-param route. Modes:
// 'vulnerable-url' (query token accepted), 'secure-url' (query
// token 403), 'filtered' (query 200, tiny body), 'public'
// (no-token 200), 'control-fail' (header token 401),
// 'static-token' (both logins issue the same opaque token),
// 'numeric-token' (short numeric tokens), 'short-token',
// 'derived-token' (token equals the username), 'jwt-token',
// 'rotating-token' (two different strong opaque tokens),
// 'login-fail', 'no-login-route'.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  probeApiTokenAuth,
  findTokenUrlRoutes,
  assessTokenRouteResponse,
  assessTokenInUrlFlow,
  classifyToken,
  predictableDerivations,
  assessWeakToken,
  __apiTokenAuthMeta,
} from './apiTokenAuth.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const PROFILE_URL = 'http://172.17.0.1:3000/api/Profile?token=dmprobe_filler';
const PROFILE_PATH = 'http://172.17.0.1:3000/api/Profile';
const PRODUCTS_URL = 'http://172.17.0.1:3000/api/Products';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
};

// The protected profile body — built by concatenation so no
// single literal in this file is a secret-shaped string.
const PROFILE_BODY =
  '{"status":"success","data":{' +
  '"id":1,"email":"lab-user@example.com","role":"customer"}}';
const FILTERED_BODY = '{"status":"success","data":[]}';

// Build a JWT-shaped token from its parts (no JWT literal in
// this file — the header/payload are encoded here, in-test).
function b64url(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const JWT_A =
  b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: 'lab-user', iat: 1700000000 }) + '.' + b64url('fake-sig-a');
const JWT_B =
  b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: 'lab-user', iat: 1700000060 }) + '.' + b64url('fake-sig-b');

function fakeResponse(status, body) {
  return {
    status,
    text: async () => body,
    headers: { get: () => null },
  };
}

function makeFakeFetch(mode) {
  const calls = [];
  let logins = 0;
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    calls.push({ method, url: String(url), headers: init.headers || {}, body: init.body || null });
    const u = new URL(String(url));
    const auth = String((init.headers && init.headers.Authorization) || '');
    const token = auth.replace(/^Bearer\s+/i, '');
    let parsed = {};
    try {
      parsed = JSON.parse(init.body || '{}');
    } catch {
      parsed = {};
    }
    // Login: the lab creds return a mode-shaped token; anything
    // else -> 401. The second login's token differs per mode so
    // the weak-token leg sees two independent issuances.
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (mode === 'login-fail') {
        return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
      }
      if (parsed.email === 'lab-user' && parsed.password === 'lab-pass') {
        logins += 1;
        if (mode === 'static-token') return fakeResponse(200, '{"authentication":{"token":"static-opaque-token-01","bid":1}}');
        if (mode === 'numeric-token') {
          return fakeResponse(200, `{"authentication":{"token":"${logins === 1 ? '123456' : '123457'}","bid":1}}`);
        }
        if (mode === 'short-token') {
          return fakeResponse(200, `{"authentication":{"token":"${logins === 1 ? 'abc' : 'def'}","bid":1}}`);
        }
        if (mode === 'derived-token') {
          return fakeResponse(200, `{"authentication":{"token":"${logins === 1 ? 'lab-user' : 'other-opaque-token-02'}","bid":1}}`);
        }
        if (mode === 'jwt-token') {
          return fakeResponse(200, `{"authentication":{"token":"${logins === 1 ? JWT_A : JWT_B}","bid":1}}`);
        }
        return fakeResponse(200, `{"authentication":{"token":"${logins === 1 ? 'hdr-token-a' : 'hdr-token-b'}","bid":1}}`);
      }
      return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
    }
    // The token-param route: no-token / header-token / query-token.
    if (method === 'GET' && u.pathname === '/api/Profile') {
      const queryToken = u.searchParams.get('token');
      if (mode === 'public' && token === '' && !queryToken) return fakeResponse(200, PROFILE_BODY);
      if (token === '' && !queryToken) {
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (token === 'hdr-token-a') {
        if (mode === 'control-fail') {
          return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
        }
        return fakeResponse(200, PROFILE_BODY);
      }
      if (queryToken === 'hdr-token-a') {
        if (mode === 'vulnerable-url') return fakeResponse(200, PROFILE_BODY);
        if (mode === 'filtered') return fakeResponse(200, FILTERED_BODY);
        return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
      }
      return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
    }
    return fakeResponse(404, '{"status":404,"message":"Not found"}');
  };
  return { fetchFn, calls };
}

async function runProbe(mode, routes, extraOpts = {}) {
  const { fetchFn, calls } = makeFakeFetch(mode);
  const diagnostics = {};
  const findings = await probeApiTokenAuth(PAGE_URL, {
    ...labOpts,
    apiRoutes: routes,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

const FULL_ROUTES = [LOGIN_URL, PROFILE_URL, PRODUCTS_URL];

// ---- pure helpers ------------------------------------------------------------

test('ATA-1: findTokenUrlRoutes picks token-param routes, strips the query, dedupes, caps at 3', () => {
  const routes = [
    PROFILE_URL,
    'http://172.17.0.1:3000/api/Keys?api_key=dmprobe_x',
    'http://172.17.0.1:3000/api/Data?access_token=dmprobe_y&limit=10',
    'http://172.17.0.1:3000/api/Profile?token=dmprobe_z',
    'http://172.17.0.1:3000/api/Products',
    'http://172.17.0.1:3000/api/Search?q=dmprobe_q',
    'http://other.example.com/api/Profile?token=dmprobe_w',
    'http://172.17.0.1:3000/api/Extra?token=dmprobe_e',
  ];
  assert.deepEqual(findTokenUrlRoutes(routes, 'http://172.17.0.1:3000'), [
    { url: PROFILE_PATH, param: 'token' },
    { url: 'http://172.17.0.1:3000/api/Keys', param: 'api_key' },
    { url: 'http://172.17.0.1:3000/api/Data', param: 'access_token' },
  ]);
});

test('ATA-2: findTokenUrlRoutes ignores session ids and bare auth flags — those are other rows', () => {
  assert.deepEqual(
    findTokenUrlRoutes(
      [
        'http://172.17.0.1:3000/page?PHPSESSID=dmprobe_s',
        'http://172.17.0.1:3000/page?sid=dmprobe_s',
        'http://172.17.0.1:3000/page?auth=true',
        'http://172.17.0.1:3000/api/Keys?apiKey=dmprobe_k',
      ],
      'http://172.17.0.1:3000'
    ),
    [{ url: 'http://172.17.0.1:3000/api/Keys', param: 'apiKey' }]
  );
  assert.deepEqual(findTokenUrlRoutes([PRODUCTS_URL], 'http://172.17.0.1:3000'), []);
});

test('ATA-3: assessTokenRouteResponse — granted / refused / other', () => {
  assert.equal(assessTokenRouteResponse(200, PROFILE_BODY).kind, 'granted');
  assert.equal(assessTokenRouteResponse(200, '[{"id":1}]').kind, 'granted');
  assert.equal(assessTokenRouteResponse(401, '{"status":401}').kind, 'refused');
  assert.equal(assessTokenRouteResponse(403, '{"status":403}').kind, 'refused');
  assert.equal(assessTokenRouteResponse(404, '{"status":404}').kind, 'refused');
  assert.equal(assessTokenRouteResponse(200, '{"error":"Unauthorized"}').kind, 'refused');
  assert.equal(assessTokenRouteResponse(200, '{"message":"Invalid token"}').kind, 'refused');
  assert.equal(assessTokenRouteResponse(200, '').kind, 'other');
  assert.equal(assessTokenRouteResponse(200, '<html><body>Juice Shop</body></html>').kind, 'other');
  assert.equal(assessTokenRouteResponse(500, '{"status":500}').kind, 'other');
  assert.equal(assessTokenRouteResponse(302, '').kind, 'other');
});

test('ATA-4: assessTokenInUrlFlow — confirmed only on granted control + granted query replay with a comparable body', () => {
  assert.equal(assessTokenInUrlFlow('granted', 'granted', 400, 400).verdict, 'confirmed');
  assert.equal(assessTokenInUrlFlow('granted', 'granted', 400, 200).verdict, 'confirmed');
  assert.equal(assessTokenInUrlFlow('granted', 'granted', 400, 199).verdict, 'rejected');
  assert.equal(assessTokenInUrlFlow('granted', 'granted', 60, 60).verdict, 'confirmed');
  assert.equal(assessTokenInUrlFlow('granted', 'granted', 60, 49).verdict, 'rejected');
  assert.equal(assessTokenInUrlFlow('granted', 'refused', 400, 0).verdict, 'rejected');
  assert.equal(assessTokenInUrlFlow('refused', 'granted', 400, 400).verdict, 'uncalibrated');
  assert.equal(assessTokenInUrlFlow('granted', 'other', 400, 0).verdict, 'uncalibrated');
});

test('ATA-5: classifyToken tells JWTs from opaque tokens', () => {
  assert.equal(classifyToken(JWT_A), 'jwt');
  assert.equal(classifyToken(JWT_B), 'jwt');
  assert.equal(classifyToken('hdr-token-a'), 'opaque');
  assert.equal(classifyToken('static-opaque-token-01'), 'opaque');
  assert.equal(classifyToken(''), 'opaque');
  assert.equal(classifyToken(null), 'opaque');
  assert.equal(classifyToken('not.a.jwt.at.all'), 'opaque');
});

test('ATA-6: predictableDerivations covers the username and its trivial encodings', () => {
  const derivations = predictableDerivations('lab-user');
  assert.ok(derivations.includes('lab-user'));
  assert.ok(derivations.includes(Buffer.from('lab-user', 'utf8').toString('base64')));
  assert.ok(derivations.includes(Buffer.from('lab-user', 'utf8').toString('hex')));
  assert.ok(derivations.includes(createHash('md5').update('lab-user', 'utf8').digest('hex')));
  assert.equal(new Set(derivations).size, derivations.length);
  assert.deepEqual(predictableDerivations(''), []);
});

test('ATA-7: assessWeakToken — static / numeric / short / derived confirm, rotating strong rejects, JWT is not-applicable', () => {
  assert.deepEqual(
    assessWeakToken('static-opaque-token-01', 'static-opaque-token-01', 'lab-user').verdict,
    'confirmed'
  );
  assert.equal(
    assessWeakToken('static-opaque-token-01', 'static-opaque-token-01', 'lab-user').kind,
    'static-token'
  );
  assert.equal(assessWeakToken('123456', '123457', 'lab-user').verdict, 'confirmed');
  assert.equal(assessWeakToken('123456', '123457', 'lab-user').kind, 'weak-token');
  assert.equal(assessWeakToken('abc', 'def', 'lab-user').verdict, 'confirmed');
  assert.equal(assessWeakToken('lab-user', 'other-opaque-token-02', 'lab-user').verdict, 'confirmed');
  assert.equal(assessWeakToken('lab-user', 'other-opaque-token-02', 'lab-user').kind, 'weak-token');
  assert.equal(assessWeakToken('hdr-token-a', 'hdr-token-b', 'lab-user').verdict, 'rejected');
  assert.equal(assessWeakToken(JWT_A, JWT_B, 'lab-user').verdict, 'not-applicable');
  assert.equal(assessWeakToken('hdr-token-a', 'hdr-token-a', 'lab-user').verdict, 'confirmed');
  assert.equal(assessWeakToken(null, 'hdr-token-b', 'lab-user').verdict, 'uncalibrated');
  assert.equal(assessWeakToken('123456789', '123456780', 'lab-user').verdict, 'rejected');
});

// ---- gates -------------------------------------------------------------------

test('ATA-8: gates — no labCreds / no allowWrite / non-lab host / quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable-url');
  const base = { ...labOpts, apiRoutes: FULL_ROUTES, fetchFn };
  assert.deepEqual(await probeApiTokenAuth(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeApiTokenAuth(PAGE_URL, { ...base, labCreds: {} }), []);
  assert.deepEqual(await probeApiTokenAuth(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(await probeApiTokenAuth(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }), []);
  assert.deepEqual(await probeApiTokenAuth(PAGE_URL, { ...base, depth: 'quick' }), []);
});

test('ATA-9: no login route mined returns [] with tokenUrlRoutes recorded', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable-url', [PROFILE_URL, PRODUCTS_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.tokenUrlRoutes, 1);
  assert.equal(diagnostics.controlOk, undefined);
});

test('ATA-10: login fails returns [] with controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.tokenUrlRoutes, 1);
  assert.equal(diagnostics.controlOk, undefined);
});

// ---- S1: token in URL ---------------------------------------------------------

test('ATA-11: vulnerable lab — query token gets the full protected body, ONE finding, protocol confirms it', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable-url', FULL_ROUTES);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'api_broken_auth');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, PROFILE_PATH);
  assert.equal(f.parameter, 'token');
  assert.match(f.title, /token in URL/);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.ok(!JSON.stringify(f).includes('hdr-token-a'), 'the lab token value must never appear in evidence');
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'token-in-url');
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.controlOk, true);
});

test('ATA-12: secure lab — query token refused, a proven true negative (S2 also rejects: rotating strong tokens)', async () => {
  const { findings, diagnostics } = await runProbe('secure-url', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.tokenUrlRoutes, 1);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.tokensCompared, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('ATA-13: public route — a 200 with no token means public, not broken auth, so the route is skipped', async () => {
  const { findings, diagnostics } = await runProbe('public', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('ATA-14: filtered query-token answer — 200 with a tiny body is the server enforcing something, not an acceptance', async () => {
  const { findings, diagnostics } = await runProbe('filtered', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('ATA-15: header-token control fails on the route — the route is skipped, no finding, controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('control-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

// ---- S2: weak token -----------------------------------------------------------

test('ATA-16: static token — both logins issue the same opaque token, ONE Medium finding', async () => {
  const { findings, diagnostics } = await runProbe('static-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'api_broken_auth');
  assert.equal(f.severity, 'medium');
  assert.match(f.title, /does not rotate/);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.ok(!JSON.stringify(f).includes('static-opaque-token-01'), 'the lab token value must never appear in evidence');
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'static-token');
  assert.equal(diagnostics.tokensCompared, 2);
  assert.equal(diagnostics.tokenKind, 'opaque');
});

test('ATA-17: numeric token — short numeric tokens confirm as High weak-token', async () => {
  const { findings, diagnostics } = await runProbe('numeric-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'high');
  assert.match(findings[0].title, /weak/);
  assert.equal(diagnostics.bypassKind, 'weak-token');
});

test('ATA-18: short token — sub-8-character tokens confirm as High weak-token', async () => {
  const { findings, diagnostics } = await runProbe('short-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'high');
  assert.equal(diagnostics.bypassKind, 'weak-token');
});

test('ATA-19: derived token — a token equal to the username confirms as High weak-token', async () => {
  const { findings, diagnostics } = await runProbe('derived-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'high');
  assert.equal(diagnostics.bypassKind, 'weak-token');
});

test('ATA-20: JWT lab — JWTs are jwt.js territory, S2 stays silent, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('jwt-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.tokenKind, 'jwt');
  assert.equal(diagnostics.tokensCompared, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('ATA-21: rotating strong opaque tokens — S2 rejects, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('rotating-token', [LOGIN_URL, PRODUCTS_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.tokenKind, 'opaque');
  assert.equal(diagnostics.tokensCompared, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('ATA-22: POST budget — the secure flow spends exactly 2 POSTs (two logins), all calls stay same-origin', async () => {
  const { calls } = await runProbe('secure-url', FULL_ROUTES);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 2);
  assert.ok(posts.length <= 8, 'POST budget is 8');
  assert.ok(calls.every((c) => c.url.indexOf('http://172.17.0.1:3000/') === 0), 'all calls stay same-origin');
});

test('ATA-meta: phase 103 registration metadata', () => {
  assert.deepEqual(__apiTokenAuthMeta, { phases: ['api-token-auth'], depth: ['standard', 'deep'] });
});
