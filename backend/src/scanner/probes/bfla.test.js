// BFLA probe tests (row #340 [High] BFLA — Admin endpoints
// callable by low-privilege users, CWE-862 | OWASP API05:2023;
// phase 97, 'bfla').
//
// The probe runs a three-way differential on each mined admin
// route: no-token GET must be refused (a 200 there is public, not
// BFLA), admin-token GET is the control (must grant), and the
// low-privilege-token GET confirms ONLY when granted with a body
// at least half the control body's length (a filtered or empty
// answer is the server enforcing something). The fake fetch below
// simulates a Juice-shaped lab: POST /rest/user/login returns a
// token, POST /api/Users registers the throwaway low-privilege
// account, GET /api/Users and GET /rest/admin/application-version
// are the admin routes. Modes:
// 'vulnerable' (low-priv gets the full admin body),
// 'secure' (low-priv 403), 'filtered' (low-priv 200, tiny body),
// 'public' (no-token 200), 'admin-login-fail', 'register-fail',
// 'low-login-fail', 'admin-control-fail' (admin GET 401).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeBfla,
  findAdminRoutes,
  findRegisterRoutes,
  assessAdminResponse,
  assessBflaFlow,
  extractBearerToken,
  __bflaMeta,
} from './bfla.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const APP_VERSION_URL = 'http://172.17.0.1:3000/rest/admin/application-version';
const PRODUCTS_URL = 'http://172.17.0.1:3000/api/Products';
const SEARCH_URL = 'http://172.17.0.1:3000/rest/products/search';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const ADMIN_BODY =
  '{"status":"success","data":[' +
  '{"id":1,"email":"admin@juice-sh.op","role":"admin"},' +
  '{"id":2,"email":"jim@juice-sh.op","role":"customer"},' +
  '{"id":3,"email":"bender@juice-sh.op","role":"customer"}]}';
const FILTERED_BODY = '{"status":"success","data":[]}';
const VERSION_BODY = '{"version":"9.1.0","application":{"name":"Juice Shop"}}';

function fakeResponse(status, body) {
  return {
    status,
    text: async () => body,
    headers: { get: () => null },
  };
}

function makeFakeFetch(mode) {
  const calls = [];
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
    // Login: admin creds -> admin token; the throwaway low-privilege
    // account -> low token; anything else -> 401.
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (mode === 'admin-login-fail' && parsed.email === 'lab-user') {
        return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
      }
      if (parsed.email === 'lab-user' && parsed.password === 'lab-pass') {
        return fakeResponse(200, '{"authentication":{"token":"adm-token","bid":1}}');
      }
      if (
        typeof parsed.email === 'string' &&
        parsed.email.indexOf('dm-bfla-low-') === 0 &&
        parsed.password === 'dm-bfla-low-pass-01'
      ) {
        if (mode === 'low-login-fail') {
          return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
        }
        return fakeResponse(200, '{"authentication":{"token":"low-token","bid":99}}');
      }
      return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
    }
    // Registration: the throwaway account.
    if (method === 'POST' && u.pathname === '/api/Users') {
      if (mode === 'register-fail') {
        return fakeResponse(400, '{"status":400,"message":"Email must be unique"}');
      }
      return fakeResponse(201, '{"status":"success","data":{"id":99}}');
    }
    // Admin routes.
    if (method === 'GET' && (u.pathname === '/api/Users' || u.pathname === '/rest/admin/application-version')) {
      const body = u.pathname === '/api/Users' ? ADMIN_BODY : VERSION_BODY;
      const vulnerableHere =
        mode === 'vulnerable' || (mode === 'second-route' && u.pathname === '/rest/admin/application-version');
      if (token === '') {
        if (mode === 'public') return fakeResponse(200, body);
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (token === 'adm-token') {
        if (mode === 'admin-control-fail') {
          return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
        }
        return fakeResponse(200, body);
      }
      if (token === 'low-token') {
        if (vulnerableHere) return fakeResponse(200, body);
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
  const findings = await probeBfla(PAGE_URL, {
    ...labOpts,
    apiRoutes: routes,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

const FULL_ROUTES = [LOGIN_URL, USERS_URL, APP_VERSION_URL, PRODUCTS_URL, SEARCH_URL];

// ---- pure helpers ------------------------------------------------------------

test('BFLA-1: findAdminRoutes picks admin routes + /api/Users, skips public routes, dedupes, caps at 5', () => {
  const routes = [
    USERS_URL,
    APP_VERSION_URL,
    PRODUCTS_URL,
    SEARCH_URL,
    'http://172.17.0.1:3000/admin/users',
    'http://172.17.0.1:3000/api/admin',
    'http://172.17.0.1:3000/api/Users?x=1',
    'http://172.17.0.1:3000/api/Users',
    'http://other.example.com/rest/admin/application-version',
    'http://172.17.0.1:3000/rest/admin/a',
    'http://172.17.0.1:3000/rest/admin/b',
    'http://172.17.0.1:3000/rest/admin/c',
  ];
  assert.deepEqual(findAdminRoutes(routes, 'http://172.17.0.1:3000'), [
    USERS_URL,
    APP_VERSION_URL,
    'http://172.17.0.1:3000/admin/users',
    'http://172.17.0.1:3000/api/admin',
    'http://172.17.0.1:3000/rest/admin/a',
  ]);
});

test('BFLA-2: findAdminRoutes needs a WHOLE admin segment — /admin-panel and /api/user-management are not candidates', () => {
  assert.deepEqual(
    findAdminRoutes(
      [
        'http://172.17.0.1:3000/admin-panel',
        'http://172.17.0.1:3000/api/user-management',
        'http://172.17.0.1:3000/admin/users',
        'http://172.17.0.1:3000/api/management/settings',
      ],
      'http://172.17.0.1:3000'
    ),
    ['http://172.17.0.1:3000/admin/users', 'http://172.17.0.1:3000/api/management/settings']
  );
});

test('BFLA-3: findRegisterRoutes picks /api/Users first, then generic register paths, caps at 2', () => {
  assert.deepEqual(
    findRegisterRoutes(
      [USERS_URL, 'http://172.17.0.1:3000/register', 'http://172.17.0.1:3000/auth/signup', PRODUCTS_URL],
      'http://172.17.0.1:3000'
    ),
    [USERS_URL, 'http://172.17.0.1:3000/register']
  );
  assert.deepEqual(findRegisterRoutes([PRODUCTS_URL, SEARCH_URL], 'http://172.17.0.1:3000'), []);
});

test('BFLA-4: assessAdminResponse — granted / refused / other', () => {
  assert.equal(assessAdminResponse(200, ADMIN_BODY).kind, 'granted');
  assert.equal(assessAdminResponse(401, '{"status":401}').kind, 'refused');
  assert.equal(assessAdminResponse(403, '{"status":403}').kind, 'refused');
  assert.equal(assessAdminResponse(404, '{"status":404}').kind, 'refused');
  assert.equal(assessAdminResponse(200, '{"error":"Unauthorized"}').kind, 'refused');
  assert.equal(assessAdminResponse(200, '{"message":"Access denied"}').kind, 'refused');
  assert.equal(assessAdminResponse(200, '').kind, 'other');
  assert.equal(assessAdminResponse(200, '<html><body>Juice Shop</body></html>').kind, 'other');
  assert.equal(assessAdminResponse(200, '[{"id":1}]').kind, 'granted');
  assert.equal(assessAdminResponse(500, '{"status":500}').kind, 'other');
  assert.equal(assessAdminResponse(302, '').kind, 'other');
});

test('BFLA-5: assessBflaFlow — confirmed only on granted control + granted low-priv with a comparable body', () => {
  assert.equal(assessBflaFlow('granted', 'granted', 400, 400).verdict, 'confirmed');
  assert.equal(assessBflaFlow('granted', 'granted', 400, 200).verdict, 'confirmed');
  assert.equal(assessBflaFlow('granted', 'granted', 400, 199).verdict, 'rejected');
  assert.equal(assessBflaFlow('granted', 'granted', 55, 55).verdict, 'confirmed');
  assert.equal(assessBflaFlow('granted', 'granted', 55, 31).verdict, 'rejected');
  assert.equal(assessBflaFlow('granted', 'refused', 400, 0).verdict, 'rejected');
  assert.equal(assessBflaFlow('refused', 'granted', 400, 400).verdict, 'uncalibrated');
  assert.equal(assessBflaFlow('granted', 'other', 400, 0).verdict, 'uncalibrated');
});

test('BFLA-6: extractBearerToken finds the nested Juice token, a top-level token, and the Authorization header', () => {
  assert.equal(
    extractBearerToken({ text: '{"authentication":{"token":"adm-token","bid":1}}', headers: { get: () => null } }),
    'adm-token'
  );
  assert.equal(
    extractBearerToken({ text: '{"access_token":"top-token"}', headers: { get: () => null } }),
    'top-token'
  );
  assert.equal(
    extractBearerToken({ text: 'not json', headers: { get: (n) => (n === 'authorization' ? 'Bearer hdr-token' : null) } }),
    'hdr-token'
  );
  assert.equal(extractBearerToken({ text: '{}', headers: { get: () => null } }), null);
  assert.equal(extractBearerToken(null), null);
});

// ---- gates -------------------------------------------------------------------

test('BFLA-7: gates — no labCreds / no allowWrite / non-lab host / quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable');
  const base = { ...labOpts, apiRoutes: FULL_ROUTES, fetchFn };
  assert.deepEqual(await probeBfla(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeBfla(PAGE_URL, { ...base, labCreds: {} }), []);
  assert.deepEqual(await probeBfla(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(await probeBfla(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }), []);
  assert.deepEqual(await probeBfla(PAGE_URL, { ...base, depth: 'quick' }), []);
});

test('BFLA-8: no admin routes mined returns [] with adminRoutes 0', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, PRODUCTS_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.adminRoutes, 0);
});

test('BFLA-9: no registration route mined returns []', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, APP_VERSION_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.adminRoutes, 1);
});

test('BFLA-10: no login route mined returns []', async () => {
  const { findings } = await runProbe('vulnerable', [USERS_URL, APP_VERSION_URL]);
  assert.deepEqual(findings, []);
});

test('BFLA-11: admin login fails returns [] with controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('admin-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('BFLA-12: registration fails returns [] with registerOk false', async () => {
  const { findings, diagnostics } = await runProbe('register-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, false);
});

test('BFLA-13: low-privilege login fails returns []', async () => {
  const { findings, diagnostics } = await runProbe('low-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, undefined);
});

// ---- the differential ---------------------------------------------------------

test('BFLA-14: secure lab — every admin route refuses the low-privilege token, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('secure', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.adminRoutes, 2);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('BFLA-15: vulnerable lab — low-privilege token gets the full admin body, ONE finding, protocol confirms it', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', FULL_ROUTES);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'bfla_bypass');
  assert.equal(f.severity, 'high');
  assert.equal(f.url, USERS_URL);
  assert.equal(f.parameter, 'Authorization');
  assert.match(f.title, /BFLA/);
  assert.equal(f.evidence.bypassWorks, true);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'low-priv-admin-route');
  assert.equal(diagnostics.attempts, 1);
});

test('BFLA-16: public route — a 200 with no token means public, not BFLA, so the route is skipped', async () => {
  const { findings, diagnostics } = await runProbe('public', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('BFLA-17: filtered low-privilege answer — 200 with a tiny body is the server enforcing something, not a bypass', async () => {
  const { findings, diagnostics } = await runProbe('filtered', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('BFLA-18: admin control fails on the route — the route is skipped, no finding, controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('admin-control-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('BFLA-19: second route confirms after the first refuses — the probe iterates, max 1 finding', async () => {
  const { findings, diagnostics } = await runProbe('second-route', FULL_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].url, APP_VERSION_URL);
  assert.equal(diagnostics.attempts, 2);
});

test('BFLA-20: POST budget — the full vulnerable flow spends exactly 3 POSTs (admin login + registration + low-priv login)', async () => {
  const { calls } = await runProbe('vulnerable', FULL_ROUTES);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 3);
  assert.ok(posts.length <= 10, 'POST budget is 10');
  assert.ok(calls.every((c) => c.url.indexOf('http://172.17.0.1:3000/') === 0), 'all calls stay same-origin');
});

test('BFLA-meta: phase 97 registration metadata', () => {
  assert.deepEqual(__bflaMeta, { phases: ['bfla'], depth: ['standard', 'deep'] });
});
