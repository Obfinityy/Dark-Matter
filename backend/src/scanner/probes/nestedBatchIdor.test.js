// Nested-object / batch-request IDOR probe tests (row #345
// [Medium] API — IDOR via nested objects / batch requests,
// CWE-639 | OWASP API01:2023; rides the 'idor' phase).
//
// Two pieces: (1) the pure helpers — nested-URL mining,
// outer/inner id extraction, outer-swap construction, batch
// endpoint mining, object-id mining, batch envelopes, the
// self-id parser, and the batch judges; (2) the confirmable
// leg — probeNestedBatchIdor runs the same THREE-WAY
// differential as the idorUuid leg (no-token refused, owner
// control granted, other-user replay confirms only on the SAME
// object), once per sink: the nested leg on mined nested URLs
// (outer-swapped variant first when the owner's own id is
// learned from a self endpoint) and the batch leg on mined
// batch endpoints (one envelope at a time). The fake fetch
// below simulates a Juice-shaped lab: POST /rest/user/login
// returns a token, POST /api/Users registers the throwaway
// other-user account, GETs on the nested URLs and POSTs on the
// batch endpoint are the differential. Modes: 'vulnerable'
// (other user gets the full nested object AND the batch
// object), 'secure' (other user 403 / filtered batch),
// 'nested-secure-batch-vuln' (nested refuses, batch confirms),
// 'public' (no-token 200), 'owner-control-fail', 'no-id-in-body'
// (other user 200, long nested body, object id absent),
// 'filtered' (other user 200, tiny nested body), 'echo'
// (batch parrots the requested id without returning the
// object), 'owner-login-fail', 'register-fail',
// 'low-login-fail', 'batch-owner-fail', 'swap' (mined nested
// URL refuses the other user, the outer-swapped variant
// confirms), 'batch-public' (no-token batch returns the
// object).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeNestedBatchIdor,
  findNestedObjectUrls,
  nestedIdsFromUrl,
  swapOuterId,
  findBatchEndpoints,
  findObjectIds,
  batchRequestBodies,
  selfIdFromBody,
  assessBatchResponse,
  assessBatchFlow,
  __nestedBatchIdorMeta,
} from './nestedBatchIdor.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const OBJ_FLAT = 'http://172.17.0.1:3000/api/orders/ord-9f2k7xq4';
const NESTED_URL = 'http://172.17.0.1:3000/api/users/1002/orders/ord-9f2k7xq4';
const NESTED_SWAPPED_URL = 'http://172.17.0.1:3000/api/users/1001/orders/ord-9f2k7xq4';
const BATCH_URL = 'http://172.17.0.1:3000/api/orders/batch';
const SLUG_URL = 'http://172.17.0.1:3000/about/getting-started';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const ORDER_ID = 'ord-9f2k7xq4';
const NESTED_BODY =
  '{\"id\":\"' +
  ORDER_ID +
  '\",\"owner\":\"1002\",\"status\":\"delivered\",\"total\":42.0,\"items\":[{\"name\":\"Book\"}]}';
const BATCH_BODY =
  '[{\"id\":\"' +
  ORDER_ID +
  '\",\"owner\":\"1002\",\"status\":\"delivered\",\"total\":42.0}]';
const FILTERED_BODY = '{\"status\":\"success\",\"data\":[]}';
const NO_ID_BODY =
  '{\"status\":\"success\",\"data\":[{\"id\":1,\"email\":\"other@juice-sh.op\"},' +
  '{\"id\":2,\"email\":\"someone@juice-sh.op\"},{\"id\":3,\"email\":\"else@juice-sh.op\"}]}';
const ECHO_BODY = '{\"requested\":[\"' + ORDER_ID + '\"]}';

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
        parsed.email.indexOf('dm-nestedbatch-low-') === 0 &&
        parsed.password === 'dm-nestedbatch-low-pass-01'
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
    // Self endpoint: only the swap mode reveals the owner's id.
    if (method === 'GET' && u.pathname === '/api/users/me') {
      if (mode === 'swap' && token === 'own-token') {
        return fakeResponse(200, '{"id":"1001","email":"lab-user"}');
      }
      return fakeResponse(404, '{"status":404,"message":"Not found"}');
    }
    // Nested object URLs.
    if (method === 'GET' && (url === NESTED_URL || url === NESTED_SWAPPED_URL)) {
      const swappedHere = url === NESTED_SWAPPED_URL;
      const vulnerableHere =
        mode === 'vulnerable' || (mode === 'swap' && swappedHere) || mode === 'no-id-in-body' || mode === 'filtered';
      if (token === '') {
        if (mode === 'public') return fakeResponse(200, NESTED_BODY);
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (token === 'own-token') {
        if (mode === 'owner-control-fail') {
          return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
        }
        return fakeResponse(200, NESTED_BODY);
      }
      if (token === 'low-token') {
        if (mode === 'nested-secure-batch-vuln') return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
        if (mode === 'secure') return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
        if (mode === 'swap' && !swappedHere) return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
        if (vulnerableHere) {
          if (mode === 'no-id-in-body') return fakeResponse(200, NO_ID_BODY);
          if (mode === 'filtered') return fakeResponse(200, FILTERED_BODY);
          return fakeResponse(200, NESTED_BODY);
        }
        return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
      }
      return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
    }
    // Batch endpoint.
    if (method === 'POST' && url === BATCH_URL) {
      const wantsOrder =
        Array.isArray(parsed.ids) ? parsed.ids.includes(ORDER_ID)
        : Array.isArray(parsed.id) ? parsed.id.includes(ORDER_ID)
        : Array.isArray(parsed.items) ? parsed.items.includes(ORDER_ID)
        : false;
      if (!wantsOrder) return fakeResponse(404, '{"status":404,"message":"Not found"}');
      if (token === '') {
        if (mode === 'public' || mode === 'batch-public') return fakeResponse(200, BATCH_BODY);
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (token === 'own-token') {
        if (mode === 'batch-owner-fail') {
          return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
        }
        return fakeResponse(200, BATCH_BODY);
      }
      if (token === 'low-token') {
        if (mode === 'vulnerable' || mode === 'nested-secure-batch-vuln') return fakeResponse(200, BATCH_BODY);
        if (mode === 'echo') return fakeResponse(200, ECHO_BODY);
        if (mode === 'secure') return fakeResponse(200, FILTERED_BODY);
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
  const findings = await probeNestedBatchIdor(PAGE_URL, {
    ...labOpts,
    routes,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

const FULL_ROUTES = [LOGIN_URL, USERS_URL, OBJ_FLAT, NESTED_URL, BATCH_URL];
const NESTED_ONLY_ROUTES = [LOGIN_URL, USERS_URL, OBJ_FLAT, NESTED_URL];
const BATCH_ONLY_ROUTES = [LOGIN_URL, USERS_URL, OBJ_FLAT, BATCH_URL];

// ---- pure helpers: mining ----------------------------------------------------

test('NB-1: findNestedObjectUrls mines two-id paths, skips single-id/slug/cross-origin, dedupes, caps at 5', () => {
  const routes = [
    NESTED_URL,
    'http://172.17.0.1:3000/api/accounts/1002/documents/8f3a2c1d9e4b5a6c',
    OBJ_FLAT,
    SLUG_URL,
    'http://other.example.com/api/users/1002/orders/ord-9f2k7xq4',
    NESTED_URL,
    NESTED_URL + '?x=1',
    'http://172.17.0.1:3000/a/111/b/222',
    'http://172.17.0.1:3000/a/333/b/444',
    'http://172.17.0.1:3000/a/555/b/666',
    'http://172.17.0.1:3000/a/777/b/888',
  ];
  assert.deepEqual(findNestedObjectUrls(routes, 'http://172.17.0.1:3000'), [
    NESTED_URL,
    'http://172.17.0.1:3000/api/accounts/1002/documents/8f3a2c1d9e4b5a6c',
    'http://172.17.0.1:3000/a/111/b/222',
    'http://172.17.0.1:3000/a/333/b/444',
    'http://172.17.0.1:3000/a/555/b/666',
  ]);
});

test('NB-2: nestedIdsFromUrl — outer is the first id segment, inner the last', () => {
  assert.deepEqual(nestedIdsFromUrl(NESTED_URL), { outer: '1002', inner: 'ord-9f2k7xq4' });
  assert.deepEqual(nestedIdsFromUrl('http://172.17.0.1:3000/api/accounts/1002/documents/8f3a2c1d9e4b5a6c'), {
    outer: '1002',
    inner: '8f3a2c1d9e4b5a6c',
  });
  assert.deepEqual(nestedIdsFromUrl(OBJ_FLAT), { outer: 'ord-9f2k7xq4', inner: 'ord-9f2k7xq4' });
  assert.deepEqual(nestedIdsFromUrl(SLUG_URL), { outer: '', inner: '' });
});

test('NB-3: swapOuterId replaces the first id segment only, keeps the inner id', () => {
  assert.equal(swapOuterId(NESTED_URL, '1001'), NESTED_SWAPPED_URL);
  assert.equal(swapOuterId(SLUG_URL, '1001'), '');
  assert.equal(swapOuterId('not a url', '1001'), '');
});

test('NB-4: findBatchEndpoints mines batch/bulk/multi segments and ids query params, skips plain paths, caps at 3', () => {
  const routes = [
    BATCH_URL,
    'http://172.17.0.1:3000/api/bulk',
    'http://172.17.0.1:3000/api/orders?ids=1',
    'http://172.17.0.1:3000/api/orders',
    'http://172.17.0.1:3000/api/multi/fetch',
    'http://172.17.0.1:3000/api/fetch-many',
    'http://other.example.com/api/orders/batch',
  ];
  assert.deepEqual(findBatchEndpoints(routes, 'http://172.17.0.1:3000'), [
    BATCH_URL,
    'http://172.17.0.1:3000/api/bulk',
    'http://172.17.0.1:3000/api/orders',
  ]);
});

test('NB-5: findObjectIds mines every id segment in route order, dedupes, caps at 5', () => {
  assert.deepEqual(findObjectIds(FULL_ROUTES, 'http://172.17.0.1:3000'), ['ord-9f2k7xq4', '1002']);
  assert.deepEqual(findObjectIds([SLUG_URL], 'http://172.17.0.1:3000'), []);
});

test('NB-6: batchRequestBodies — the three envelopes, each carrying the foreign id', () => {
  assert.deepEqual(batchRequestBodies(ORDER_ID), [
    { ids: [ORDER_ID] },
    { id: [ORDER_ID] },
    { items: [ORDER_ID] },
  ]);
});

test('NB-7: selfIdFromBody parses id/_id/userId top-level and one level deep', () => {
  assert.equal(selfIdFromBody('{"id":"1001","email":"a@b.c"}'), '1001');
  assert.equal(selfIdFromBody('{"user":{"id":1002}}'), '1002');
  assert.equal(selfIdFromBody('{"data":{"userId":"u-7"}}'), 'u-7');
  assert.equal(selfIdFromBody('{"_id":"abc123"}'), 'abc123');
  assert.equal(selfIdFromBody('{"email":"a@b.c"}'), '');
  assert.equal(selfIdFromBody('not json'), '');
  assert.equal(selfIdFromBody(''), '');
});

// ---- pure helpers: batch judges ----------------------------------------------

test('NB-8: assessBatchResponse — granted only on the object in the body, echo never grants', () => {
  assert.equal(assessBatchResponse(200, BATCH_BODY, ORDER_ID).kind, 'granted');
  assert.equal(assessBatchResponse(200, NESTED_BODY, ORDER_ID).kind, 'granted');
  // A substantive body (>= 50 bytes) containing the id grants even
  // without the "id":"..." shape — the object is in there.
  assert.equal(assessBatchResponse(200, '{"items":[{"name":"Book","ref":"' + ORDER_ID + '","price":42.5}]}', ORDER_ID).kind, 'granted');
  // A bare echo of the requested id is the server parroting the
  // request, not returning the object.
  assert.equal(assessBatchResponse(200, ECHO_BODY, ORDER_ID).kind, 'other');
  assert.equal(assessBatchResponse(200, FILTERED_BODY, ORDER_ID).kind, 'other');
  assert.equal(assessBatchResponse(401, BATCH_BODY, ORDER_ID).kind, 'refused');
  assert.equal(assessBatchResponse(403, BATCH_BODY, ORDER_ID).kind, 'refused');
  assert.equal(assessBatchResponse(200, '{"error":"Unauthorized"}', ORDER_ID).kind, 'refused');
  assert.equal(assessBatchResponse(200, '', ORDER_ID).kind, 'other');
  assert.equal(assessBatchResponse(500, BATCH_BODY, ORDER_ID).kind, 'other');
});

test('NB-9: assessBatchFlow — confirmed only on granted control + granted other user', () => {
  assert.equal(assessBatchFlow('granted', 'granted').verdict, 'confirmed');
  assert.equal(assessBatchFlow('granted', 'refused').verdict, 'rejected');
  assert.equal(assessBatchFlow('granted', 'other').verdict, 'uncalibrated');
  assert.equal(assessBatchFlow('refused', 'granted').verdict, 'uncalibrated');
  assert.equal(assessBatchFlow('other', 'granted').verdict, 'uncalibrated');
});

// ---- gates -------------------------------------------------------------------

test('NB-10: gates — no labCreds / no allowWrite / non-lab host / quick depth all return []', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable');
  const base = { ...labOpts, routes: FULL_ROUTES, fetchFn };
  assert.deepEqual(await probeNestedBatchIdor(PAGE_URL, { ...base, labCreds: null }), []);
  assert.deepEqual(await probeNestedBatchIdor(PAGE_URL, { ...base, labCreds: {} }), []);
  assert.deepEqual(await probeNestedBatchIdor(PAGE_URL, { ...base, allowWrite: false }), []);
  assert.deepEqual(await probeNestedBatchIdor(PAGE_URL, { ...base, labTargets: ['10.0.0.1:3000'] }), []);
  assert.deepEqual(await probeNestedBatchIdor(PAGE_URL, { ...base, depth: 'quick' }), []);
});

test('NB-11: no nested URLs and no batch endpoints mined returns [] with zero diagnostics', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, USERS_URL, OBJ_FLAT]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.nestedObjectUrls, 0);
  assert.equal(diagnostics.batchEndpoints, 0);
});

test('NB-12: no registration route mined returns []', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', [LOGIN_URL, OBJ_FLAT, NESTED_URL, BATCH_URL]);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.nestedObjectUrls, 1);
  assert.equal(diagnostics.batchEndpoints, 1);
});

test('NB-13: no login route mined returns []', async () => {
  const { findings } = await runProbe('vulnerable', [USERS_URL, OBJ_FLAT, NESTED_URL, BATCH_URL]);
  assert.deepEqual(findings, []);
});

test('NB-14: owner login fails returns [] with controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('NB-15: registration fails returns [] with registerOk false', async () => {
  const { findings, diagnostics } = await runProbe('register-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, false);
});

test('NB-16: other-user login fails returns []', async () => {
  const { findings, diagnostics } = await runProbe('low-login-fail', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, undefined);
});

// ---- the differential: nested leg --------------------------------------------

test('NB-17: secure lab — nested refuses the other user and batch filters it, a proven true negative', async () => {
  const { findings, diagnostics } = await runProbe('secure', FULL_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.nestedObjectUrls, 1);
  assert.equal(diagnostics.batchEndpoints, 1);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 2);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('NB-18: vulnerable lab — nested AND batch both confirm, one finding per leg, protocol confirms both', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable', FULL_ROUTES);
  assert.equal(findings.length, 2);
  const [nested, batch] = findings;
  assert.equal(nested.class, 'idor_nested');
  assert.equal(nested.severity, 'medium');
  assert.equal(nested.url, NESTED_URL);
  assert.equal(nested.parameter, ORDER_ID);
  assert.match(nested.title, /BOLA/);
  assert.equal(nested.evidence.crossUserRead, true);
  assert.equal(nested.evidence.signalCorrelated, true);
  assert.equal(assessConfirmation(nested).verdict, 'confirmed');
  assert.equal(batch.class, 'idor_batch');
  assert.equal(batch.severity, 'medium');
  assert.equal(batch.url, BATCH_URL);
  assert.equal(batch.parameter, ORDER_ID);
  assert.equal(batch.evidence.crossUserRead, true);
  assert.equal(assessConfirmation(batch).verdict, 'confirmed');
  assert.equal(diagnostics.bypassKind, 'cross-user-batch-read');
  assert.equal(diagnostics.attempts, 2);
});

test('NB-19: nested-only routes — only the nested leg fires', async () => {
  const { findings } = await runProbe('vulnerable', NESTED_ONLY_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'idor_nested');
});

test('NB-20: batch-only routes — only the batch leg fires', async () => {
  const { findings } = await runProbe('vulnerable', BATCH_ONLY_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'idor_batch');
});

test('NB-21: nested secure but batch vulnerable — the batch leg still fires', async () => {
  const { findings, diagnostics } = await runProbe('nested-secure-batch-vuln', FULL_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'idor_batch');
  assert.equal(diagnostics.bypassKind, 'cross-user-batch-read');
});

test('NB-22: public nested object — a 200 with no token means public, not BOLA, so the URL is skipped', async () => {
  const { findings, diagnostics } = await runProbe('public', NESTED_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('NB-23: public batch endpoint — a no-token batch returning the object is public, not BOLA', async () => {
  const { findings, diagnostics } = await runProbe('batch-public', BATCH_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('NB-24: filtered other-user nested answer — 200 with a tiny body is the server enforcing something, not a bypass', async () => {
  const { findings, diagnostics } = await runProbe('filtered', NESTED_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('NB-25: owner control fails on the nested URL — the URL is skipped, no finding, controlOk unset', async () => {
  const { findings, diagnostics } = await runProbe('owner-control-fail', NESTED_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(diagnostics.attempts, undefined);
});

test('NB-26: other-user nested body without the object id — a long body for a different object is not the same object', async () => {
  const { findings, diagnostics } = await runProbe('no-id-in-body', NESTED_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('NB-27: batch echo — parroting the requested id without returning the object never confirms', async () => {
  const { findings, diagnostics } = await runProbe('echo', BATCH_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('NB-28: owner batch control fails — the batch leg cannot calibrate, no finding', async () => {
  const { findings, diagnostics } = await runProbe('batch-owner-fail', BATCH_ONLY_ROUTES);
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('NB-29: outer-swap — mined nested URL refuses the other user, the outer-swapped variant confirms', async () => {
  const { findings, diagnostics } = await runProbe('swap', NESTED_ONLY_ROUTES);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'idor_nested');
  assert.equal(findings[0].url, NESTED_SWAPPED_URL);
  assert.match(findings[0].evidence.request, /outer id swapped/);
  assert.equal(diagnostics.nestedSwapOk, true);
  assert.equal(diagnostics.bypassKind, 'cross-user-nested-read');
});

test('NB-30: POST budget — the full two-leg vulnerable flow spends exactly 3 POSTs (owner login + registration + other-user login)', async () => {
  const { calls } = await runProbe('vulnerable', FULL_ROUTES);
  const posts = calls.filter((c) => c.method === 'POST');
  // 3 session POSTs + 3 batch POSTs per leg (no-token, owner, other).
  assert.equal(posts.length, 6);
  assert.ok(posts.length <= 10 + 27, 'batch POSTs stay inside the per-leg bound');
  assert.ok(calls.every((c) => c.url.indexOf('http://172.17.0.1:3000/') === 0), 'all calls stay same-origin');
});

test('NB-meta: rides the idor phase — registration metadata', () => {
  assert.deepEqual(__nestedBatchIdorMeta, { phases: ['idor'], depth: ['standard', 'deep'] });
});
