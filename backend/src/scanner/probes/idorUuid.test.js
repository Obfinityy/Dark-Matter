// BOLA UUID / predictable-token ID probe tests (row #339 [Medium]
// BOLA — UUID / predictable token IDs, CWE-639 | OWASP API01:2023;
// rides the 'idor' phase).
//
// Two pieces: (1) the surface extension — probeIdorSurface flags
// UUID-shaped and predictable-token IDs as the same INFO review
// surface as numeric IDs (a wider regex alone does NOT confirm
// anything); (2) the confirmable leg — probeIdorUuid runs a
// THREE-WAY differential on each mined object URL: no-token GET
// must be refused (a 200 there is public, not BOLA), owner-token
// GET is the control (must grant with the object body), and the
// other-user-token GET confirms ONLY when granted with the SAME
// object (2xx + no refusal text + body >= 50 bytes and >= half
// the control body's length AND the requested object id present
// in the body — a long body without the id is a different object,
// not the same one). The fake fetch below simulates a Juice-shaped
// lab: POST /rest/user/login returns a token, POST /api/Users
// registers the throwaway other-user account, GETs on the object
// URLs are the differential. Modes: 'vulnerable' (other user gets
// the full object body), 'secure' (other user 403), 'filtered'
// (other user 200, tiny body), 'public' (no-token 200),
// 'owner-login-fail', 'register-fail', 'low-login-fail',
// 'owner-control-fail' (owner GET 401), 'no-id-in-body' (other
// user 200, long body, object id absent), 'second-url' (first
// object URL refuses the other user, second confirms).

import test from 'node:test';
import assert from 'node:assert/strict';
import { probeIdorSurface, classifyIdSegment } from './idor.js';
import {
  probeIdorUuid,
  findObjectUrls,
  assessObjectResponse,
  assessIdorUuidFlow,
  __idorUuidMeta,
} from './idorUuid.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const OBJ_UUID = 'http://172.17.0.1:3000/api/Users/550e8400-e29b-41d4-a716-446655440000';
const OBJ_HEX = 'http://172.17.0.1:3000/rest/basket/8f3a2c1d9e4b5a6c';
const OBJ_TOKEN = 'http://172.17.0.1:3000/api/Orders/ord-9f2k7xq4';
const OBJ_NUMERIC = 'http://172.17.0.1:3000/user/12345/profile';
const SLUG_URL = 'http://172.17.0.1:3000/about/getting-started';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const UUID_ID = '550e8400-e29b-41d4-a716-446655440000';
const HEX_ID = '8f3a2c1d9e4b5a6c';
const OBJ_BODY_UUID =
  '{"id":"' +
  UUID_ID +
  '","email":"victim@juice-sh.op","role":"customer","name":"Victim User"}';
const OBJ_BODY_HEX =
  '{"id":"' + HEX_ID + '","products":[{"id":1,"name":"Apple Juice"}],"totalPrice":12.5}';
const OBJ_BODY_TOKEN =
  '{"id":"ord-9f2k7xq4","status":"delivered","total":42.0,"items":[{"name":"Book"}]}';
const FILTERED_BODY = '{"status":"success","data":[]}';
const NO_ID_BODY =
  '{"status":"success","data":[{"id":1,"email":"other@juice-sh.op"},' +
  '{"id":2,"email":"someone@juice-sh.op"},{"id":3,"email":"else@juice-sh.op"}]}';

function objectBody(url) {
  if (url === OBJ_UUID) return OBJ_BODY_UUID;
  if (url === OBJ_HEX) return OBJ_BODY_HEX;
  if (url === OBJ_TOKEN) return OBJ_BODY_TOKEN;
  return '{"status":"success","data":{}}';
}

function objectId(url) {
  if (url === OBJ_UUID) return UUID_ID;
  if (url === OBJ_HEX) return HEX_ID;
  if (url === OBJ_TOKEN) return 'ord-9f2k7xq4';
  return '';
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
    // Login: lab creds -> owner token; the throwaway other-user
    // account -> other token; anything else -> 401.
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (mode === 'owner-login-fail' && parsed.email === 'lab-user') {
        return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
      }
      if (parsed.email === 'lab-user' && parsed.password === 'lab-pass') {
        return fakeResponse(200, '{"authentication":{"token":"own-token","bid":1}}');
      }
      if (
        typeof parsed.email === 'string' &&
        parsed.email.indexOf('dm-idoruuid-low-') === 0 &&
        parsed.password === 'dm-idoruuid-low-pass-01'
      ) {
        if (mode === 'low-login-fail') {
          return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
        }
        return fakeResponse(200, '{"authentication":{"token":"low-token","bid":99}}');
      }
      return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
    }
    // Registration: the throwaway other-user account.
    if (method === 'POST' && u.pathname === '/api/Users') {
      if (mode === 'register-fail') {
        return fakeResponse(400, '{"status":400,"message":"Email must be unique"}');
      }
      return fakeResponse(201, '{"status":"success","data":{"id":99}}');
    }
    // Object URLs.
    if (method === 'GET' && (url === OBJ_UUID || url === OBJ_HEX || url === OBJ_TOKEN)) {
      const body = objectBody(url);
      const vulnerableHere =
        mode === 'vulnerable' || (mode === 'second-url' && url === OBJ_HEX);
      if (token === '') {
        if (mode === 'public') return fakeResponse(200, body);
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (token === 'own-token') {
        if (mode === 'owner-control-fail') {
          return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
        }
        return fakeResponse(200, body);
      }
      if (token === 'low-token') {
        if (vulnerableHere) return fakeResponse(200, body);
        if (mode === 'filtered') return fakeResponse(200, FILTERED_BODY);
        if (mode === 'no-id-in-body') return fakeResponse(200, NO_ID_BODY);
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
  const findings = await probeIdorUuid(PAGE_URL, {
    ...labOpts,
    routes,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

const FULL_ROUTES = [LOGIN_URL, USERS_URL, OBJ_UUID, OBJ_HEX, OBJ_TOKEN];

// ---- pure helpers: the id classifier -----------------------------------------

test('IU-1: classifyIdSegment — uuid / predictable-token / numeric / null', () => {
  assert.equal(classifyIdSegment('550e8400-e29b-41d4-a716-446655440000'), 'uuid');
  assert.equal(classifyIdSegment('8f3a2c1d9e4b5a6c'), 'predictable-token');
  assert.equal(classifyIdSegment('507f1f77bcf86cd799439011'), 'predictable-token');
  assert.equal(classifyIdSegment('9f2k7xq4'), 'predictable-token');
  assert.equal(classifyIdSegment('ord-9f2k7xq4'), 'predictable-token');
  assert.equal(classifyIdSegment('12345'), 'numeric');
  assert.equal(classifyIdSegment('getting-started'), null);
  assert.equal(classifyIdSegment('dashboard'), null);
  assert.equal(classifyIdSegment('profile'), null);
  assert.equal(classifyIdSegment('ab'), null);
});

// ---- the surface extension ----------------------------------------------------

test('IU-2: probeIdorSurface flags UUID-shaped IDs as the same INFO review surface', () => {
  const findings = probeIdorSurface(OBJ_UUID);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'idor');
  assert.equal(findings[0].severity, 'info');
  assert.match(findings[0].id, /idor-surface-/);
  assert.match(findings[0].title, /UUID/);
});

test('IU-3: probeIdorSurface flags predictable-token IDs, stays quiet on slugs, numeric unchanged', () => {
  assert.equal(probeIdorSurface(OBJ_HEX).length, 1);
  assert.equal(probeIdorSurface(OBJ_TOKEN).length, 1);
  assert.equal(probeIdorSurface(SLUG_URL).length, 0);
  assert.equal(probeIdorSurface('https://example.com/about').length, 0);
  // Numeric behaviour is byte-preserved: same class, same id shape.
  const numeric = probeIdorSurface(OBJ_NUMERIC);
  assert.equal(numeric.length, 1);
  assert.equal(numeric[0].class, 'idor');
  assert.equal(numeric[0].id, 'idor-surface-12345');
  // A UUID surface is still unconfirmed by design — the surface
  // alone never confirms; only the two-session differential does.
  const surface = probeIdorSurface(OBJ_UUID);
  assert.equal(assessConfirmation(surface[0]).verdict, 'unconfirmed');
});

// ---- pure helpers: mining + judges --------------------------------------------

test('IU-4: findObjectUrls mines uuid + hex + token URLs, skips numeric/slug/cross-origin, dedupes, caps at 5', () => {
  const routes = [
    OBJ_UUID,
    OBJ_HEX,
    OBJ_TOKEN,
    OBJ_NUMERIC,
    SLUG_URL,
    'http://other.example.com/api/Users/550e8400-e29b-41d4-a716-446655440000',
    OBJ_UUID,
    OBJ_UUID + '?x=1',
    'http://172.17.0.1:3000/api/Users/11111111-2222-3333-4444-555555555555',
    'http://172.17.0.1:3000/api/Users/66666666-7777-8888-9999-000000000000',
    'http://172.17.0.1:3000/api/Users/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  ];
  assert.deepEqual(findObjectUrls(routes, 'http://172.17.0.1:3000'), [
    OBJ_UUID,
    OBJ_HEX,
    OBJ_TOKEN,
    'http://172.17.0.1:3000/api/Users/11111111-2222-3333-4444-555555555555',
    'http://172.17.0.1:3000/api/Users/66666666-7777-8888-9999-000000000000',
  ]);
});

test('IU-5: assessObjectResponse — granted / refused / other (object reads need not be JSON)', () => {
  assert.equal(assessObjectResponse(200, OBJ_BODY_UUID).kind, 'granted');
  assert.equal(assessObjectResponse(200, '<html><body>profile</body></html>').kind, 'granted');
  assert.equal(assessObjectResponse(401, '{"status":401}').kind, 'refused');
  assert.equal(assessObjectResponse(403, '{"status":403}').kind, 'refused');
  assert.equal(assessObjectResponse(404, '{"status":404}').kind, 'refused');
  assert.equal(assessObjectResponse(200, '{"error":"Unauthorized"}').kind, 'refused');
  assert.equal(assessObjectResponse(200, '{"message":"Access denied"}').kind, 'refused');
  assert.equal(assessObjectResponse(200, '').kind, 'other');
  assert.equal(assessObjectResponse(500, '{"status":500}').kind, 'other');
  assert.equal(assessObjectResponse(302, '').kind, 'other');
});

test('IU-6: assessIdorUuidFlow — confirmed only on granted control + granted other user with the same object', () => {
  assert.equal(assessIdorUuidFlow('granted', 'granted', 200, 200, UUID_ID, OBJ_BODY_UUID).verdict, 'confirmed');
  assert.equal(assessIdorUuidFlow('granted', 'granted', 200, 100, UUID_ID, OBJ_BODY_UUID).verdict, 'confirmed');
  assert.equal(assessIdorUuidFlow('granted', 'granted', 200, 99, UUID_ID, OBJ_BODY_UUID).verdict, 'rejected');
  assert.equal(assessIdorUuidFlow('granted', 'granted', 200, 200, UUID_ID, NO_ID_BODY).verdict, 'rejected');
  assert.equal(assessIdorUuidFlow('granted', 'granted', 200, 31, UUID_ID, FILTERED_BODY).verdict, 'rejected');
  assert.equal(assessIdorUuidFlow('granted', 'refused', 200, 0, UUID_ID, '').verdict, 'rejected');
  assert.equal(assessIdorUuidFlow('refused', 'granted', 200, 200, UUID_ID, OBJ_BODY_UUID).verdict, 'uncalibrated');
  assert.equal(assessIdorUuidFlow('granted', 'other', 200, 0, UUID_ID, '').verdict, 'uncalibrated');
});

// ---- gates -------------------------------------------------------------------

test('IU-7: gates — no labCreds / no allowWrite / non-lab host / quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable');
  const base = { ...labOpts, routes: FULL_ROUTES, fetchFn };
  assert.deepEqual(await probeIdorUuid(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeIdorUuid(PAGE_URL, { ...base, labCreds: {} }), []);
  assert.deepEqual(await probeIdorUuid(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(await probeIdorUuid(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }), []);
  assert.deepEqual(await probeIdorUuid(PAGE_URL, { ...base, depth: 'quick' }), []);
});

test('IU-8: no object URLs mined returns [] with objectUrls 0', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, USERS_URL, OBJ_NUMERIC]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 0);
});

test('IU-9: no registration route mined returns []', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, OBJ_UUID]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 1);
});

test('IU-10: no login route mined returns []', async () => {
  const { findings } = await runProbe('vulnerable', [USERS_URL, OBJ_UUID]);
  assert.deepEqual(findings, []);
});

test('IU-11: owner login fails returns [] with controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('IU-12: registration fails returns [] with registerOk false', async () => {
  const { findings, diagnostics } = await runProbe('register-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, false);
});

test('IU-13: other-user login fails returns []', async () => {
  const { findings, diagnostics } = await runProbe('low-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, undefined);
});

// ---- the differential ---------------------------------------------------------

test('IU-14: secure lab — every object URL refuses the other user, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('secure', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 3);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 3);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('IU-15: vulnerable lab — other user gets the full object body, ONE finding, protocol confirms it', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', FULL_ROUTES);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'idor_uuid');
  assert.equal(f.severity, 'medium');
  assert.equal(f.url, OBJ_UUID);
  assert.equal(f.parameter, UUID_ID);
  assert.match(f.title, /BOLA/);
  assert.equal(f.evidence.crossUserRead, true);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'cross-user-uuid-read');
  assert.equal(diagnostics.attempts, 1);
});

test('IU-16: public object — a 200 with no token means public, not BOLA, so the URL is skipped', async () => {
  const { findings, diagnostics } = await runProbe('public', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('IU-17: filtered other-user answer — 200 with a tiny body is the server enforcing something, not a bypass', async () => {
  const { findings, diagnostics } = await runProbe('filtered', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 3);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('IU-18: owner control fails on the URL — the URL is skipped, no finding, controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-control-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('IU-19: other-user body without the object id — a long body for a different object is not the same object', async () => {
  const { findings, diagnostics } = await runProbe('no-id-in-body', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 3);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('IU-20: second URL confirms after the first refuses — the probe iterates, max 1 finding', async () => {
  const { findings, diagnostics } = await runProbe('second-url', FULL_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].url, OBJ_HEX);
  assert.equal(diagnostics.attempts, 2);
});

test('IU-21: POST budget — the full vulnerable flow spends exactly 3 POSTs (owner login + registration + other-user login)', async () => {
  const { calls } = await runProbe('vulnerable', FULL_ROUTES);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 3);
  assert.ok(posts.length <= 10, 'POST budget is 10');
  assert.ok(calls.every((c) => c.url.indexOf('http://172.17.0.1:3000/') === 0), 'all calls stay same-origin');
});

test('IU-meta: rides the idor phase — registration metadata', () => {
  assert.deepEqual(__idorUuidMeta, { phases: ['idor'], depth: ['standard', 'deep'] });
});
