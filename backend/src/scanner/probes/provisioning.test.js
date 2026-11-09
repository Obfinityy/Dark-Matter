// Provisioning probe tests (rows #171 [Medium] Insecure Account
// Provisioning / Deprovisioning and #172 [Medium] Role Definition
// Flaws, WSTG-IDNT; phase 111, 'provisioning').
//
// The probe registers a throwaway account and checks the default
// role three ways: (A) the role marker in the registration
// response, (B) the role claim in the issued JWT, (C) an
// admin-route replay with the fresh token (bfla differential).
// The fake fetch below simulates a Juice-shaped lab: POST
// /api/Users registers, POST /rest/user/login logs in, GET
// /api/Users and GET /rest/admin/application-version are the admin
// routes. Modes:
// 'secure' (role customer everywhere, fresh token 403 on admin
// routes), 'privileged-role' (registration returns role admin),
// 'privileged-isadmin' (registration returns isAdmin true),
// 'privileged-token' (fresh login issues a JWT with role admin),
// 'fresh-admin-route' (fresh token granted the admin body),
// 'public' (no-token 200), 'register-fail', 'fresh-login-fail',
// 'admin-login-fail', 'admin-control-fail' (admin GET 401).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeProvisioning,
  findRoleMarkers,
  assessRegistrationResponse,
  assessProvisionedToken,
  __provisioningMeta,
} from './provisioning.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const APP_VERSION_URL = 'http://172.17.0.1:3000/rest/admin/application-version';
const PRODUCTS_URL = 'http://172.17.0.1:3000/api/Products';
const ROUTES = [LOGIN_URL, USERS_URL, APP_VERSION_URL, PRODUCTS_URL];
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
  apiRoutes: ROUTES,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const ADMIN_BODY =
  '{"status":"success","data":[' +
  '{"id":1,"email":"admin@juice-sh.op","role":"admin"},' +
  '{"id":2,"email":"jim@juice-sh.op","role":"customer"},' +
  '{"id":3,"email":"bender@juice-sh.op","role":"customer"}]}';
const VERSION_BODY = '{"version":"9.1.0","application":{"name":"Juice Shop"}}';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function jwtWithRole(role, nested = true) {
  const payload = nested
    ? { data: { id: 99, email: 'dm-prov-low-x@example.com', role } }
    : { sub: '99', role };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`;
}

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
    // Login: admin creds -> opaque admin token; the throwaway
    // account -> JWT (role per mode) or opaque low token.
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (mode === 'admin-login-fail' && parsed.email === 'lab-user') {
        return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
      }
      if (parsed.email === 'lab-user' && parsed.password === 'lab-pass') {
        return fakeResponse(200, '{"authentication":{"token":"adm-token","bid":1}}');
      }
      if (
        typeof parsed.email === 'string' &&
        parsed.email.indexOf('dm-prov-low-') === 0 &&
        parsed.password === 'dm-prov-low-pass-01'
      ) {
        if (mode === 'fresh-login-fail') {
          return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
        }
        if (mode === 'privileged-token') {
          return fakeResponse(200, `{"authentication":{"token":"${jwtWithRole('admin')}","bid":99}}`);
        }
        if (mode === 'fresh-admin-route') {
          return fakeResponse(200, '{"authentication":{"token":"low-token","bid":99}}');
        }
        return fakeResponse(200, `{"authentication":{"token":"${jwtWithRole('customer')}","bid":99}}`);
      }
      return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
    }
    // Registration: the throwaway account.
    if (method === 'POST' && u.pathname === '/api/Users') {
      if (mode === 'register-fail') {
        return fakeResponse(400, '{"status":400,"message":"Email must be unique"}');
      }
      if (mode === 'privileged-role') {
        return fakeResponse(201, '{"status":"success","data":{"id":99,"email":"x@example.com","role":"admin"}}');
      }
      if (mode === 'privileged-isadmin') {
        return fakeResponse(
          201,
          '{"status":"success","data":{"id":99,"email":"x@example.com","role":"customer","isAdmin":true}}'
        );
      }
      return fakeResponse(201, '{"status":"success","data":{"id":99,"email":"x@example.com","role":"customer"}}');
    }
    // Admin routes.
    if (method === 'GET' && (u.pathname === '/api/Users' || u.pathname === '/rest/admin/application-version')) {
      const body = u.pathname === '/api/Users' ? ADMIN_BODY : VERSION_BODY;
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
        if (mode === 'fresh-admin-route') return fakeResponse(200, body);
        return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
      }
      // Any JWT-shaped fresh token: refused on admin routes.
      return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
    }
    return fakeResponse(404, '{"status":404,"message":"Not found"}');
  };
  return { fetchFn, calls };
}

// ---- pure helpers -----------------------------------------------------------

test('PROV-1: findRoleMarkers finds a nested privileged role', () => {
  const found = findRoleMarkers({ status: 'success', data: { id: 99, role: 'admin' } });
  assert.equal(found.privileged, true);
  assert.equal(found.role, 'admin');
});

test('PROV-2: findRoleMarkers reports an unprivileged role without privilege', () => {
  const found = findRoleMarkers({ status: 'success', data: { id: 99, role: 'customer' } });
  assert.equal(found.privileged, false);
  assert.equal(found.role, 'customer');
});

test('PROV-3: findRoleMarkers treats isAdmin true as privileged', () => {
  const found = findRoleMarkers({ data: { role: 'customer', isAdmin: true } });
  assert.equal(found.privileged, true);
  assert.equal(found.role, 'customer');
});

test('PROV-4: findRoleMarkers treats a privileged entry in a privileges array as privileged', () => {
  const found = findRoleMarkers({ data: { privileges: ['read', 'admin'] } });
  assert.equal(found.privileged, true);
});

test('PROV-5: findRoleMarkers does NOT treat near-miss role values as privileged', () => {
  assert.equal(findRoleMarkers({ data: { role: 'admin2' } }).privileged, false);
  assert.equal(findRoleMarkers({ data: { role: 'administrator2' } }).privileged, false);
  assert.equal(findRoleMarkers({ data: { role: 'Admin' } }).privileged, true);
  assert.equal(findRoleMarkers({ data: { userRole: 'admin' } }).privileged, true);
  assert.equal(findRoleMarkers({ data: { role: 'user' } }).privileged, false);
});

test('PROV-6: assessRegistrationResponse judges a privileged registration', () => {
  const j = assessRegistrationResponse(201, '{"status":"success","data":{"id":99,"role":"admin"}}');
  assert.equal(j.kind, 'privileged');
  assert.equal(j.role, 'admin');
});

test('PROV-7: assessRegistrationResponse judges an unprivileged registration and records the role', () => {
  const j = assessRegistrationResponse(201, '{"status":"success","data":{"id":99,"role":"customer"}}');
  assert.equal(j.kind, 'ok');
  assert.equal(j.role, 'customer');
});

test('PROV-8: assessRegistrationResponse is other on non-2xx and unparseable bodies', () => {
  assert.equal(assessRegistrationResponse(400, '{"status":400}').kind, 'other');
  assert.equal(assessRegistrationResponse(201, 'not json').kind, 'other');
  assert.equal(assessRegistrationResponse(201, '{"status":"success"}').kind, 'ok');
  assert.equal(assessRegistrationResponse(201, '{"status":"success"}').role, null);
});

test('PROV-9: assessProvisionedToken judges a privileged JWT claim (nested and top-level)', () => {
  assert.equal(assessProvisionedToken(jwtWithRole('admin')).kind, 'privileged');
  assert.equal(assessProvisionedToken(jwtWithRole('admin', false)).kind, 'privileged');
  assert.equal(assessProvisionedToken(jwtWithRole('admin')).role, 'admin');
});

test('PROV-10: assessProvisionedToken judges an unprivileged JWT and an opaque token', () => {
  const j = assessProvisionedToken(jwtWithRole('customer'));
  assert.equal(j.kind, 'ok');
  assert.equal(j.role, 'customer');
  assert.equal(assessProvisionedToken('opaque-token-xyz').kind, 'other');
  assert.equal(assessProvisionedToken(null).kind, 'other');
});

// ---- the probe --------------------------------------------------------------

test('PROV-11: secure Juice shape — role customer everywhere, fresh token refused: no finding (true negative)', async () => {
  const { fetchFn } = makeFakeFetch('secure');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.deepEqual(findings, []);
  assert.equal(diag.registerRoutes, 1);
  assert.equal(diag.registerOk, true);
  assert.equal(diag.roleClaim, 'customer');
  assert.equal(diag.adminRoutes, 2);
  assert.equal(diag.controlOk, true);
  assert.equal(diag.attempts, 2);
  assert.equal(diag.bypassKind, undefined);
});

test('PROV-12: registration returns a privileged role — 1 finding, bypassKind privileged-role, confirmed', async () => {
  const { fetchFn } = makeFakeFetch('privileged-role');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'insecure_provisioning');
  assert.equal(findings[0].severity, 'medium');
  assert.match(findings[0].title, /privileged role/);
  assert.equal(diag.bypassKind, 'privileged-role');
  assert.equal(diag.roleClaim, 'admin');
  assert.equal(assessConfirmation(findings[0], {}).verdict, 'confirmed');
});

test('PROV-13: registration returns isAdmin true — 1 finding, bypassKind privileged-role', async () => {
  const { fetchFn } = makeFakeFetch('privileged-isadmin');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'insecure_provisioning');
  assert.equal(diag.bypassKind, 'privileged-role');
});

test('PROV-14: fresh login issues a JWT with a privileged role claim — 1 finding, bypassKind privileged-token-claim', async () => {
  const { fetchFn } = makeFakeFetch('privileged-token');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'insecure_provisioning');
  assert.match(findings[0].title, /token carrying a privileged role/);
  assert.equal(diag.bypassKind, 'privileged-token-claim');
  assert.equal(diag.roleClaim, 'admin');
  assert.equal(assessConfirmation(findings[0], {}).verdict, 'confirmed');
});

test('PROV-15: fresh token is granted an admin route — 1 finding, bypassKind fresh-token-admin-route', async () => {
  const { fetchFn } = makeFakeFetch('fresh-admin-route');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'insecure_provisioning');
  assert.match(findings[0].title, /admin-only function/);
  assert.equal(diag.bypassKind, 'fresh-token-admin-route');
  assert.equal(diag.controlOk, true);
  assert.equal(diag.attempts, 1);
  assert.equal(assessConfirmation(findings[0], {}).verdict, 'confirmed');
});

test('PROV-16: public admin route (no-token 200) is skipped, never a finding', async () => {
  const { fetchFn } = makeFakeFetch('public');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
  assert.deepEqual(findings, []);
  assert.equal(diag.attempts, undefined);
});

test('PROV-17: registration failure, fresh-login failure, admin-login failure, control failure — all uncalibrated, no finding', async () => {
  for (const mode of ['register-fail', 'fresh-login-fail', 'admin-login-fail', 'admin-control-fail']) {
    const { fetchFn } = makeFakeFetch(mode);
    const diag = {};
    const findings = await probeProvisioning(PAGE_URL, { ...labOpts, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, [], `${mode} must not produce a finding`);
  }
});

test('PROV-18: no registration surface (DVWA shape) — honest empty, registerRoutes 0', async () => {
  const { fetchFn } = makeFakeFetch('secure');
  const diag = {};
  const findings = await probeProvisioning(PAGE_URL, {
    ...labOpts,
    fetchFn,
    diagnostics: diag,
    apiRoutes: [LOGIN_URL, PRODUCTS_URL],
  });
  assert.deepEqual(findings, []);
  assert.equal(diag.registerRoutes, 0);
});

test('PROV-19: gates — no labCreds, allowWrite false, non-lab host, quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('privileged-role');
  const base = { ...labOpts, fetchFn };
  assert.deepEqual(await probeProvisioning(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeProvisioning(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(
    await probeProvisioning(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }),
    []
  );
  assert.deepEqual(await probeProvisioning(PAGE_URL, { ...base, depth: 'quick' }), []);
  assert.deepEqual(await probeProvisioning('not a url', base), []);
});

test('PROV-20: probe metadata names the provisioning phase', () => {
  assert.deepEqual(__provisioningMeta, { phases: ['provisioning'], depth: ['standard', 'deep'] });
});
