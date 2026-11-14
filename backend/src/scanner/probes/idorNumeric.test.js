// BOLA numeric / sequential-ID probe tests (coverage rows
// #10/#338 [IDOR / BOLA — numeric IDs, CWE-639 | OWASP
// API01:2023; rides the 'idor' phase alongside idorUuid.js,
// which owns the UUID / predictable-token half, row #339).
//
// The probe runs the SAME three-way differential as idorUuid
// (no-token GET must be refused, owner-token GET is the control,
// other-user-token GET confirms ONLY on the same object) with
// two numeric-specific tightenings:
//   (1) the "same object" check requires the id as a STRUCTURED
//       id field ("id":123, "id":"123", data-id="123", /123/ in
//       a link, id=123) — a bare "123" in prose (a price, a count,
//       a date) proves nothing, so it must NOT confirm;
//   (2) year-like (1900-2100) and timestamp-like (>10 digit)
//       segments are not object ids and are never mined.
// Plus a sequential-neighbour leg: id±1 of the first two mined
// URLs under the same differential (a neighbour confirms only
// when the owner control grants it too and the other-user body
// carries the neighbour id as an id field).
// The fake fetch below simulates a Juice-shaped lab: POST
// /rest/user/login returns a token, POST /api/Users registers
// the throwaway other-user account, GETs on the object URLs are
// the differential. Modes: 'vulnerable', 'secure', 'filtered',
// 'public', 'owner-login-fail', 'register-fail', 'low-login-fail',
// 'owner-control-fail', 'no-id-in-body', 'second-url',
// 'neighbour-vulnerable' (mined URLs refuse, neighbour id+1
// confirms), 'neighbour-public' (neighbour answers 200
// anonymously, so it is public, not BOLA).

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIdSegment } from './idor.js';
import {
  probeIdorNumeric,
  findNumericObjectUrls,
  numericIdFromUrl,
  neighbourUrls,
  isNumericObjectIdSegment,
  numericIdInBody,
  assessIdorNumericFlow,
  __idorNumericMeta,
} from './idorNumeric.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const OBJ_USER1 = 'http://172.17.0.1:3000/api/Users/1';
const OBJ_USER2 = 'http://172.17.0.1:3000/api/Users/2';
const OBJ_BASKET1 = 'http://172.17.0.1:3000/rest/basket/1';
const OBJ_BASKET2 = 'http://172.17.0.1:3000/rest/basket/2';
const OBJ_PRODUCT = 'http://172.17.0.1:3000/rest/products/123';
const YEAR_URL = 'http://172.17.0.1:3000/archive/2026';
const TS_URL = 'http://172.17.0.1:3000/events/1763088000000';
const UUID_URL = 'http://172.17.0.1:3000/api/Users/550e8400-e29b-41d4-a716-446655440000';
const SLUG_URL = 'http://172.17.0.1:3000/about/getting-started';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const USER1_BODY =
  '{"status":"success","data":{"id":1,"email":"victim@juice-sh.op","role":"customer","name":"Victim User"}}';
const USER2_BODY =
  '{"status":"success","data":{"id":2,"email":"other@juice-sh.op","role":"customer","name":"Other User"}}';
const BASKET1_BODY =
  '{"status":"success","data":{"id":1,"coupon":null,"UserId":1,"products":[{"id":1,"name":"Apple Juice"}],"totalPrice":12.5}}';
const BASKET2_BODY =
  '{"status":"success","data":{"id":2,"coupon":null,"UserId":2,"products":[{"id":2,"name":"Orange Juice"}],"totalPrice":9.5}}';
const PRODUCT_BODY =
  '{"status":"success","data":{"id":123,"name":"Apple Juice","price":1.99,"description":"The best juice."}}';
const FILTERED_BODY = '{"status":"success","data":[]}';
// Long body, 123 present ONLY as a bare number (totals / prose) —
// never as an id field, never as a /123/ link. Must NOT confirm.
const NO_ID_BODY =
  '{"status":"success","data":[{"total":123,"note":"123 items shipped"},' +
  '{"total":123,"note":"123 items shipped"},{"total":123,"note":"123 items shipped"}]}';

function objectBody(url) {
  if (url === OBJ_USER1) return USER1_BODY;
  if (url === OBJ_USER2) return USER2_BODY;
  if (url === OBJ_BASKET1) return BASKET1_BODY;
  if (url === OBJ_BASKET2) return BASKET2_BODY;
  if (url === OBJ_PRODUCT) return PRODUCT_BODY;
  return '{"status":"success","data":{}}';
}

function objectId(url) {
  if (url === OBJ_USER1 || url === OBJ_BASKET1) return '1';
  if (url === OBJ_USER2 || url === OBJ_BASKET2) return '2';
  if (url === OBJ_PRODUCT) return '123';
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
        parsed.email.indexOf('dm-idornum-low-') === 0 &&
        parsed.password === 'dm-idornum-low-pass-01'
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
    // Object URLs (mined + neighbours).
    const OBJECT_URLS = [OBJ_USER1, OBJ_USER2, OBJ_BASKET1, OBJ_BASKET2, OBJ_PRODUCT];
    if (method === 'GET' && OBJECT_URLS.includes(url)) {
      const body = objectBody(url);
      const minedHere = url === OBJ_USER1 || url === OBJ_BASKET1;
      const vulnerableHere =
        mode === 'vulnerable' ||
        (mode === 'second-url' && url === OBJ_BASKET1) ||
        (mode === 'neighbour-vulnerable' && !minedHere);
      const publicHere = mode === 'public' || (mode === 'neighbour-public' && !minedHere);
      if (token === '') {
        if (publicHere) return fakeResponse(200, body);
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
  const findings = await probeIdorNumeric(PAGE_URL, {
    ...labOpts,
    routes,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

const FULL_ROUTES = [LOGIN_URL, USERS_URL, OBJ_USER1, OBJ_BASKET1];

// ---- pure helpers: the numeric classifier -------------------------------------

test('N-1: classifyIdSegment still calls digit runs numeric; the miner excludes years and timestamps', () => {
  assert.equal(classifyIdSegment('12345'), 'numeric');
  assert.equal(classifyIdSegment('123'), 'numeric');
  assert.equal(classifyIdSegment('2026'), 'numeric');
  // The miner takes 1-2 digit ids too (Juice basket 1, user 1) —
  // classifyIdSegment's 3+ bar is the v1 surface rule, not the
  // differential's: short ids are safe here because the confirm
  // needs the id as a structured field, not a bare substring.
  assert.equal(isNumericObjectIdSegment('1'), true);
  assert.equal(isNumericObjectIdSegment('42'), true);
  assert.equal(isNumericObjectIdSegment('12345'), true);
  assert.equal(isNumericObjectIdSegment('123'), true);
  assert.equal(isNumericObjectIdSegment('2026'), false);
  assert.equal(isNumericObjectIdSegment('1999'), false);
  assert.equal(isNumericObjectIdSegment('2100'), false);
  assert.equal(isNumericObjectIdSegment('2101'), true);
  assert.equal(isNumericObjectIdSegment('1763088000000'), false);
  assert.equal(isNumericObjectIdSegment('550e8400-e29b-41d4-a716-446655440000'), false);
  assert.equal(isNumericObjectIdSegment('getting-started'), false);
  assert.equal(isNumericObjectIdSegment('ab'), false);
});

test('N-2: findNumericObjectUrls mines numeric URLs, skips uuid/year/timestamp/slug/cross-origin, dedupes, caps at 5', () => {
  const routes = [
    OBJ_USER1,
    OBJ_BASKET1,
    OBJ_PRODUCT,
    UUID_URL,
    YEAR_URL,
    TS_URL,
    SLUG_URL,
    'http://other.example.com/api/Users/1',
    OBJ_USER1,
    OBJ_USER1 + '?x=1',
    'http://172.17.0.1:3000/api/Users/3',
    'http://172.17.0.1:3000/api/Users/4',
    'http://172.17.0.1:3000/api/Users/5',
    'http://172.17.0.1:3000/api/Users/6',
  ];
  assert.deepEqual(findNumericObjectUrls(routes, 'http://172.17.0.1:3000'), [
    OBJ_USER1,
    OBJ_BASKET1,
    OBJ_PRODUCT,
    'http://172.17.0.1:3000/api/Users/3',
    'http://172.17.0.1:3000/api/Users/4',
  ]);
});

test('N-3: numericIdFromUrl returns the first numeric object-id segment', () => {
  assert.equal(numericIdFromUrl(OBJ_USER1), '1');
  assert.equal(numericIdFromUrl(OBJ_PRODUCT), '123');
  assert.equal(numericIdFromUrl(YEAR_URL), '');
  assert.equal(numericIdFromUrl(UUID_URL), '');
  assert.equal(numericIdFromUrl(SLUG_URL), '');
});

test('N-4: neighbourUrls steps id±1 on the same path, never below 1', () => {
  assert.deepEqual(neighbourUrls(OBJ_USER1, '1'), [OBJ_USER2]);
  assert.deepEqual(neighbourUrls(OBJ_USER2, '2'), [OBJ_USER1, 'http://172.17.0.1:3000/api/Users/3']);
  assert.deepEqual(neighbourUrls(OBJ_PRODUCT, '123'), [
    'http://172.17.0.1:3000/rest/products/122',
    'http://172.17.0.1:3000/rest/products/124',
  ]);
  assert.deepEqual(neighbourUrls(SLUG_URL, ''), []);
  assert.deepEqual(neighbourUrls(OBJ_USER1, 'abc'), []);
});

// ---- pure helpers: the structured-id-field check -------------------------------

test('N-5: numericIdInBody — id field / attribute / link count, bare numbers do not', () => {
  assert.equal(numericIdInBody(USER1_BODY, '1'), true);
  assert.equal(numericIdInBody('{"id":"123","name":"x"}', '123'), true);
  assert.equal(numericIdInBody('{"UserId":123,"name":"x"}', '123'), true);
  assert.equal(numericIdInBody('<div data-id="123">x</div>', '123'), true);
  assert.equal(numericIdInBody('<a href="/api/Users/123">x</a>', '123'), true);
  assert.equal(numericIdInBody('{"id":"0123"}', '123'), true);
  assert.equal(numericIdInBody(PRODUCT_BODY, '123'), true);
  // Bare numbers: a price, a count, a date — not the object.
  assert.equal(numericIdInBody('{"total":123,"note":"123 items shipped"}', '123'), false);
  assert.equal(numericIdInBody('{"price":1.99,"stock":123}', '123'), false);
  assert.equal(numericIdInBody(NO_ID_BODY, '123'), false);
  // Boundary: /1234/ and "id":1234 are a different object (id 1234).
  assert.equal(numericIdInBody('{"id":1234}', '123'), false);
  assert.equal(numericIdInBody('<a href="/api/Users/1234">x</a>', '123'), false);
  assert.equal(numericIdInBody('', '123'), false);
  assert.equal(numericIdInBody(USER1_BODY, ''), false);
});

test('N-6: assessIdorNumericFlow — confirmed only on granted control + granted other user with the id field', () => {
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 200, '1', USER1_BODY).verdict, 'confirmed');
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 100, '1', USER1_BODY).verdict, 'confirmed');
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 99, '1', USER1_BODY).verdict, 'rejected');
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 200, '123', NO_ID_BODY).verdict, 'rejected');
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 31, '1', FILTERED_BODY).verdict, 'rejected');
  assert.equal(assessIdorNumericFlow('granted', 'refused', 200, 0, '1', '').verdict, 'rejected');
  assert.equal(assessIdorNumericFlow('refused', 'granted', 200, 200, '1', USER1_BODY).verdict, 'uncalibrated');
  assert.equal(assessIdorNumericFlow('granted', 'other', 200, 0, '1', '').verdict, 'uncalibrated');
  // Same body, different id: the id field must match THIS object.
  assert.equal(assessIdorNumericFlow('granted', 'granted', 200, 200, '2', USER1_BODY).verdict, 'rejected');
});

// ---- gates -------------------------------------------------------------------

test('N-7: gates — no labCreds / no allowWrite / non-lab host / quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable');
  const base = { ...labOpts, routes: FULL_ROUTES, fetchFn };
  assert.deepEqual(await probeIdorNumeric(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeIdorNumeric(PAGE_URL, { ...base, labCreds: {} }), []);
  assert.deepEqual(await probeIdorNumeric(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(await probeIdorNumeric(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }), []);
  assert.deepEqual(await probeIdorNumeric(PAGE_URL, { ...base, depth: 'quick' }), []);
});

test('N-8: no object URLs mined returns [] with objectUrls 0', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, USERS_URL, UUID_URL, YEAR_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 0);
});

test('N-9: no registration route mined returns []', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, OBJ_USER1]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 1);
});

test('N-10: no login route mined returns []', async () => {
  const { findings } = await runProbe('vulnerable', [USERS_URL, OBJ_USER1]);
  assert.deepEqual(findings, []);
});

test('N-11: owner login fails returns [] with controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('N-12: registration fails returns [] with registerOk false', async () => {
  const { findings, diagnostics } = await runProbe('register-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, false);
});

test('N-13: other-user login fails returns []', async () => {
  const { findings, diagnostics } = await runProbe('low-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, undefined);
});

// ---- the differential ---------------------------------------------------------

test('N-14: secure lab — every mined URL and neighbour refuses the other user, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('secure', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.objectUrls, 2);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 4);
  assert.equal(diagnostics.neighbourAttempts, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('N-15: vulnerable lab — other user gets the full object body, ONE finding, protocol confirms it', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', FULL_ROUTES);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'idor_numeric');
  assert.equal(f.severity, 'medium');
  assert.equal(f.url, OBJ_USER1);
  assert.equal(f.parameter, '1');
  assert.match(f.title, /BOLA/);
  assert.equal(f.evidence.crossUserRead, true);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'cross-user-numeric-read');
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.neighbourAttempts, undefined);
});

test('N-16: public object — a 200 with no token means public, not BOLA, so the URL is skipped', async () => {
  const { findings, diagnostics } = await runProbe('public', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('N-17: filtered other-user answer — 200 with a tiny body is the server enforcing something, not a bypass', async () => {
  const { findings, diagnostics } = await runProbe('filtered', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 4);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('N-18: owner control fails on the URL — the URL is skipped, no finding, controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-control-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('N-19: other-user body without the id field — a long body of bare numbers is not the same object', async () => {
  const { findings, diagnostics } = await runProbe('no-id-in-body', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 4);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('N-20: second URL confirms after the first refuses — the probe iterates, max 1 finding', async () => {
  const { findings, diagnostics } = await runProbe('second-url', FULL_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].url, OBJ_BASKET1);
  assert.equal(diagnostics.attempts, 2);
});

test('N-21: sequential neighbour confirms — mined URLs refuse, id+1 grants the other user the same object', async () => {
  const { findings, diagnostics } = await runProbe('neighbour-vulnerable', FULL_ROUTES);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'idor_numeric');
  assert.equal(f.url, OBJ_USER2);
  assert.equal(f.parameter, '2');
  assert.match(f.id, /idor-numeric-seq-2/);
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'cross-user-numeric-sequential-read');
  assert.equal(diagnostics.attempts, 3);
  assert.equal(diagnostics.neighbourAttempts, 1);
});

test('N-22: public neighbour — a 200 with no token on id+1 means public, not BOLA, so it is skipped', async () => {
  const { findings, diagnostics } = await runProbe('neighbour-public', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 2);
  assert.equal(diagnostics.neighbourAttempts, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('N-23: POST budget — the full vulnerable flow spends exactly 3 POSTs (owner login + registration + other-user login)', async () => {
  const { calls } = await runProbe('vulnerable', FULL_ROUTES);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 3);
  assert.ok(posts.length <= 10, 'POST budget is 10');
  assert.ok(calls.every((c) => c.url.indexOf('http://172.17.0.1:3000/') === 0), 'all calls stay same-origin');
});

test('N-meta: rides the idor phase — registration metadata', () => {
  assert.deepEqual(__idorNumericMeta, { phases: ['idor'], depth: ['standard', 'deep'] });
});
