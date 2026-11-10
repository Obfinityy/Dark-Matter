// Business-flow-access probe tests (row #86 [High] Unrestricted
// Access to Sensitive Business Flows, CWE-840 | OWASP API6:2023;
// phase 111, 'business-flow-access').
//
// The probe runs a three-way differential on the mined basket GET
// route: no-token GET must be refused (a 200 there is public, not
// this row), victim-token GET is the control (must grant with the
// seeded marker item visible), and the canary-token GET of the SAME
// victim basket confirms ONLY when granted with the victim's basket
// id and the marker present — while the canary's own basket reads
// empty. The fake fetch below simulates a Juice-shaped lab: POST
// /rest/user/login returns a token + bid, POST /api/Users registers
// the throwaway canary account, GET /rest/basket/:id is the basket
// route, GET /rest/products/search lists products, POST
// /api/BasketItems seeds the victim basket. Modes:
// 'vulnerable' (canary reads the victim basket whole),
// 'seeded-empty' (victim basket starts empty, seed path runs),
// 'secure' (canary 403), 'own-basket' (server returns the caller's
// own basket for any id), 'filtered' (canary 200, marker absent),
// 'public' (no-token 200), 'victim-login-fail', 'register-fail',
// 'canary-login-fail', 'victim-control-fail' (victim control GET
// 401), 'canary-nonempty' (canary's own basket holds an item),
// 'no-products' (empty product list + empty victim basket).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeBusinessFlowAccess,
  basketOwnerId,
  basketHasProduct,
  assessBasketRead,
  assessCrossUserFlow,
  __bfaMeta,
} from './businessFlowAccess.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const LOGIN_URL = 'http://172.17.0.1:3000/rest/user/login';
const USERS_URL = 'http://172.17.0.1:3000/api/Users';
const BASKET_ROUTE = 'http://172.17.0.1:3000/rest/basket/7';
const ITEMS_URL = 'http://172.17.0.1:3000/api/BasketItems';
const PRODUCTS_URL = 'http://172.17.0.1:3000/rest/products/search';
const ROUTES = [LOGIN_URL, USERS_URL, BASKET_ROUTE, ITEMS_URL, PRODUCTS_URL];
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
  allowWrite: true,
  apiRoutes: ROUTES,
};

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const VICTIM_BASKET_BODY =
  '{"status":"success","data":{"id":14,"coupon":null,"UserId":263,' +
  '"Products":[{"id":1,"name":"Apple Juice (1000ml)","price":1.99,' +
  '"BasketItem":{"ProductId":1,"BasketId":14,"id":52,"quantity":1}}]}}';
const CANARY_OWN_EMPTY_BODY =
  '{"status":"success","data":{"id":15,"coupon":null,"UserId":264,"Products":[]}}';
const CANARY_OWN_NONEMPTY_BODY =
  '{"status":"success","data":{"id":15,"coupon":null,"UserId":264,' +
  '"Products":[{"id":2,"name":"Orange Juice","price":2.99,' +
  '"BasketItem":{"ProductId":2,"BasketId":15,"id":53,"quantity":1}}]}}';
const EMPTY_BASKET_BODY = '{"status":"success","data":{"id":14,"Products":[]}}';
const PRODUCTS_BODY =
  '{"status":"success","data":[' +
  '{"id":1,"name":"Apple Juice (1000ml)","price":1.99},' +
  '{"id":2,"name":"Orange Juice","price":2.99}]}';
const EMPTY_PRODUCTS_BODY = '{"status":"success","data":[]}';

function fakeResponse(status, body) {
  return {
    status,
    text: async () => body,
    headers: { get: () => null },
  };
}

function makeFakeFetch(mode) {
  const calls = [];
  let seeded = false;
  let victimGets = 0;
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
    // Login: victim creds -> victim token + bid 14; the throwaway
    // canary account -> canary token + bid 15; anything else -> 401.
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (mode === 'victim-login-fail' && parsed.email === 'lab-user') {
        return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
      }
      if (parsed.email === 'lab-user' && parsed.password === 'lab-pass') {
        return fakeResponse(200, '{"authentication":{"token":"victim-token","bid":14}}');
      }
      if (
        typeof parsed.email === 'string' &&
        parsed.email.indexOf('dm-bflow-low-') === 0 &&
        parsed.password === 'dm-bflow-low-pass-01'
      ) {
        if (mode === 'canary-login-fail') {
          return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
        }
        return fakeResponse(200, '{"authentication":{"token":"canary-token","bid":15}}');
      }
      return fakeResponse(401, '{"status":401,"message":"Invalid email or password."}');
    }
    // Registration: the throwaway canary account.
    if (method === 'POST' && u.pathname === '/api/Users') {
      if (mode === 'register-fail') {
        return fakeResponse(400, '{"status":400,"message":"Email must be unique"}');
      }
      return fakeResponse(201, '{"status":"success","data":{"id":99}}');
    }
    // Product list (seed path only).
    if (method === 'GET' && u.pathname === '/rest/products/search') {
      if (mode === 'no-products') return fakeResponse(200, EMPTY_PRODUCTS_BODY);
      return fakeResponse(200, PRODUCTS_BODY);
    }
    // Seed the victim basket (one unit of the cheapest product).
    if (method === 'POST' && u.pathname === '/api/BasketItems') {
      seeded = true;
      return fakeResponse(201, '{"status":"success","data":{"id":52}}');
    }
    // Basket reads. The victim basket is /rest/basket/14, the
    // canary's own is /rest/basket/15.
    if (method === 'GET' && u.pathname.startsWith('/rest/basket/')) {
      const bid = u.pathname.split('/').pop();
      if (bid === '14') {
        if (token === '') {
          if (mode === 'public') return fakeResponse(200, VICTIM_BASKET_BODY);
          return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
        }
        if (token === 'victim-token') {
          victimGets += 1;
          if (mode === 'victim-control-fail' && victimGets >= 2) {
            return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
          }
          if (mode === 'seeded-empty' && !seeded) return fakeResponse(200, EMPTY_BASKET_BODY);
          if (mode === 'no-products') return fakeResponse(200, EMPTY_BASKET_BODY);
          return fakeResponse(200, VICTIM_BASKET_BODY);
        }
        if (token === 'canary-token') {
          if (mode === 'secure') {
            return fakeResponse(403, '{"status":403,"message":"Forbidden"}');
          }
          if (mode === 'own-basket') return fakeResponse(200, CANARY_OWN_EMPTY_BODY);
          if (mode === 'filtered') {
            return fakeResponse(200, '{"status":"success","data":{"id":14,"Products":[]}}');
          }
          return fakeResponse(200, VICTIM_BASKET_BODY);
        }
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      if (bid === '15') {
        if (token === 'canary-token') {
          if (mode === 'canary-nonempty') return fakeResponse(200, CANARY_OWN_NONEMPTY_BODY);
          return fakeResponse(200, CANARY_OWN_EMPTY_BODY);
        }
        return fakeResponse(401, '{"status":401,"message":"Unauthorized"}');
      }
      return fakeResponse(404, '{"status":404,"message":"Basket not found"}');
    }
    return fakeResponse(404, '{"status":404,"message":"Not found"}');
  };
  return { fetchFn, calls };
}

async function runProbe(mode, extraOpts = {}) {
  const { fetchFn, calls } = makeFakeFetch(mode);
  const diagnostics = {};
  const findings = await probeBusinessFlowAccess(PAGE_URL, {
    ...labOpts,
    fetchFn,
    diagnostics,
    ...extraOpts,
  });
  return { findings, diagnostics, calls };
}

// ---- pure helpers --------------------------------------------------------

test('BFA-1: basketOwnerId reads data.id as a string (number, string, missing)', () => {
  assert.equal(basketOwnerId({ data: { id: 14 } }), '14');
  assert.equal(basketOwnerId({ data: { id: '15' } }), '15');
  assert.equal(basketOwnerId({ id: 7 }), '7');
  assert.equal(basketOwnerId({ data: { Products: [] } }), null);
  assert.equal(basketOwnerId(null), null);
  assert.equal(basketOwnerId({ data: { id: 'abc' } }), null);
});

test('BFA-2: basketHasProduct matches the marker by id across number/string shapes', () => {
  const body = JSON.parse(VICTIM_BASKET_BODY);
  assert.equal(basketHasProduct(body, 1), true);
  assert.equal(basketHasProduct(body, '1'), true);
  assert.equal(basketHasProduct(body, 2), false);
  assert.equal(basketHasProduct(JSON.parse(CANARY_OWN_EMPTY_BODY), 1), false);
  assert.equal(basketHasProduct(null, 1), false);
});

test('BFA-3: assessBasketRead grants only on a 2xx basket body', () => {
  assert.equal(assessBasketRead(200, VICTIM_BASKET_BODY).kind, 'granted');
  assert.equal(assessBasketRead(200, JSON.parse(VICTIM_BASKET_BODY)).kind, 'granted');
  assert.equal(assessBasketRead(401, '{"status":401}').kind, 'refused');
  assert.equal(assessBasketRead(403, '{"status":403}').kind, 'refused');
  assert.equal(assessBasketRead(404, '{"status":404}').kind, 'refused');
  assert.equal(assessBasketRead(200, '{"status":401,"message":"Unauthorized"}').kind, 'refused');
  assert.equal(assessBasketRead(200, '<html><body></body></html>').kind, 'other');
  assert.equal(assessBasketRead(200, '{"status":"success","data":{}}').kind, 'other');
  assert.equal(assessBasketRead(500, '{}').kind, 'other');
});

function confirmedArgs(overrides = {}) {
  return {
    controlKind: 'granted',
    controlHasSeed: true,
    crossKind: 'granted',
    crossOwnerId: '14',
    victimBid: '14',
    canaryBid: '15',
    crossHasSeed: true,
    canaryOwnEmpty: true,
    ...overrides,
  };
}

test('BFA-4: assessCrossUserFlow confirms the victim basket read by the canary', () => {
  const v = assessCrossUserFlow(confirmedArgs());
  assert.equal(v.verdict, 'confirmed');
});

test('BFA-5: assessCrossUserFlow rejects a refused canary replay', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ crossKind: 'refused' })).verdict, 'rejected');
});

test('BFA-6: assessCrossUserFlow rejects when the server returns the caller\'s own basket', () => {
  const v = assessCrossUserFlow(confirmedArgs({ crossOwnerId: '15' }));
  assert.equal(v.verdict, 'rejected');
  assert.match(v.reason, /own basket/);
});

test('BFA-7: assessCrossUserFlow rejects when the server returns a different basket id', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ crossOwnerId: '99' })).verdict, 'rejected');
});

test('BFA-8: assessCrossUserFlow rejects when the marker is filtered from the cross read', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ crossHasSeed: false })).verdict, 'rejected');
});

test('BFA-9: assessCrossUserFlow is uncalibrated without a granting victim control', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ controlKind: 'refused' })).verdict, 'uncalibrated');
  assert.equal(assessCrossUserFlow(confirmedArgs({ controlKind: 'other' })).verdict, 'uncalibrated');
});

test('BFA-10: assessCrossUserFlow is uncalibrated when the control shows no marker', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ controlHasSeed: false })).verdict, 'uncalibrated');
});

test('BFA-11: assessCrossUserFlow is uncalibrated when the canary\'s own basket is not empty', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ canaryOwnEmpty: false })).verdict, 'uncalibrated');
});

test('BFA-12: assessCrossUserFlow is uncalibrated on an inconclusive cross replay', () => {
  assert.equal(assessCrossUserFlow(confirmedArgs({ crossKind: 'other' })).verdict, 'uncalibrated');
});

test('BFA-13: assessCrossUserFlow confirms without an owner id when the marker proves the read', () => {
  // Some shops do not echo the basket id in the GET body — the
  // marker + the empty-canary-basket precondition still attribute
  // the read to the victim.
  assert.equal(assessCrossUserFlow(confirmedArgs({ crossOwnerId: null })).verdict, 'confirmed');
});

// ---- network: the full differential --------------------------------------

test('BFA-14: vulnerable lab — canary reads the victim basket, one High finding', async () => {
  const { findings, diagnostics } = await runProbe('vulnerable');
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'business_logic');
  assert.equal(f.severity, 'high');
  assert.match(f.title, /another user's basket readable/);
  assert.equal(f.url, 'http://172.17.0.1:3000/rest/basket/14');
  assert.equal(f.parameter, 'BasketId');
  assert.equal(assessConfirmation(f).verdict, 'confirmed');
  assert.equal(diagnostics.basketRoutes, 1);
  assert.equal(diagnostics.registerOk, true);
  assert.equal(diagnostics.victimSeeded, false);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, 'cross-user-basket-read');
});

test('BFA-15: seeded-empty lab — the probe seeds the victim basket and still confirms', async () => {
  const { findings, diagnostics, calls } = await runProbe('seeded-empty');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'business_logic');
  assert.equal(diagnostics.victimSeeded, true);
  assert.equal(diagnostics.bypassKind, 'cross-user-basket-read');
  assert.ok(calls.some((c) => c.method === 'POST' && c.url === ITEMS_URL));
});

test('BFA-16: secure lab — canary refused, no finding', async () => {
  const { findings, diagnostics } = await runProbe('secure');
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 1);
  assert.equal(diagnostics.bypassKind, undefined);
});

test('BFA-17: own-basket lab — server ignores the path id, no finding', async () => {
  const { findings } = await runProbe('own-basket');
  assert.deepEqual(findings, []);
});

test('BFA-18: filtered lab — cross read carries no marker, no finding', async () => {
  const { findings } = await runProbe('filtered');
  assert.deepEqual(findings, []);
});

test('BFA-19: public lab — anonymous read granted, not this row, no finding', async () => {
  const { findings, diagnostics } = await runProbe('public');
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.anonymousGranted, true);
});

test('BFA-20: victim login fails — uncalibrated, no finding', async () => {
  const { findings } = await runProbe('victim-login-fail');
  assert.deepEqual(findings, []);
});

test('BFA-21: canary registration fails — uncalibrated, no finding', async () => {
  const { findings } = await runProbe('register-fail');
  assert.deepEqual(findings, []);
});

test('BFA-22: canary login fails — uncalibrated, no finding', async () => {
  const { findings } = await runProbe('canary-login-fail');
  assert.deepEqual(findings, []);
});

test('BFA-23: victim control GET fails — uncalibrated, no finding', async () => {
  const { findings, diagnostics } = await runProbe('victim-control-fail');
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, false);
});

test('BFA-24: canary\'s own basket is not empty — uncalibrated, no finding', async () => {
  const { findings } = await runProbe('canary-nonempty');
  assert.deepEqual(findings, []);
});

test('BFA-25: no basket route mined — honest no-op', async () => {
  const { findings } = await runProbe('vulnerable', { apiRoutes: [LOGIN_URL, USERS_URL] });
  assert.deepEqual(findings, []);
});

test('BFA-26: no labCreds — honest no-op', async () => {
  const { fetchFn } = makeFakeFetch('vulnerable');
  const findings = await probeBusinessFlowAccess(PAGE_URL, {
    labTargets: ['172.17.0.1:3000'],
    allowWrite: true,
    apiRoutes: ROUTES,
    fetchFn,
  });
  assert.deepEqual(findings, []);
});

test('BFA-27: quick depth skips the probe', async () => {
  const { findings } = await runProbe('vulnerable', { depth: 'quick' });
  assert.deepEqual(findings, []);
});

test('BFA-28: empty product list + empty victim basket — uncalibrated, no finding', async () => {
  const { findings } = await runProbe('no-products');
  assert.deepEqual(findings, []);
});

test('BFA-29: meta pins the phase name and depths', () => {
  assert.deepEqual(__bfaMeta.phases, ['business-flow-access']);
  assert.deepEqual(__bfaMeta.depth, ['standard', 'deep']);
});
