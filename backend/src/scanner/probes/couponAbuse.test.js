// Tests for the coupon-abuse probe
// (coverage rows #78 [Medium] Coupon / Discount / Referral Abuse
// and #371 [Medium] Logic — Coupon / voucher reuse abuse,
// CWE-840 | OWASP A04:2021; phase 98, 'coupon-abuse').
//
// The probe runs a control + two legs against a stateful fake
// Juice Shop: login returns a token + basket id, GET /rest/basket/:id
// returns the basket ledger, GET /api/Coupons lists the shop's own
// coupon codes, PUT /rest/basket/:id/coupon/:code applies one.
// Behaviour flags flip the fake between a vulnerable shop and a
// safe one: reuseAllowed (the same code discounts a fresh basket
// again), stackingAllowed (a second code adds its discount on top
// of the first instead of replacing it), invalidCode, controlBroken,
// emptyBasket, loginWithoutBid, singleCode.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCouponAbuse,
  findCouponApplyRoutes,
  findCouponListRoutes,
  fillCouponRoute,
  parseCouponList,
  assessCouponControl,
  assessCouponReuse,
  assessCouponStacked,
  expectedDrop,
  __couponMeta,
} from './couponAbuse.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34',
  'http://lab.local/rest/basket/dmprobe1_ab12/coupon/dmprobe2_cd34',
  'http://lab.local/api/BasketItems',
  'http://lab.local/api/BasketItems/dmprobe3_ef56',
  'http://lab.local/rest/basket/dmprobe1_ab12/checkout',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Products',
  'http://lab.local/api/Coupons',
  'http://other.local/rest/basket/9/coupon/xyz',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behaviour flags: reuseAllowed, stackingAllowed, invalidCode,
// controlBroken (apply answers 2xx but the total never moves),
// emptyBasket (seed path), loginWithoutBid (whoami fallback),
// singleCode (the coupon list carries one code only).
function makeFakeJuice(behavior = {}) {
  const validCodes = behavior.singleCode
    ? [{ code: 'SAVE10', discount: 10 }]
    : [
        { code: 'SAVE10', discount: 10 },
        { code: 'SAVE20', discount: 20 },
      ];
  const state = {
    items: behavior.emptyBasket
      ? []
      : [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    coupon: null,
    discount: 0,
    usedCodes: new Set(),
    calls: [],
  };
  const subtotal = () => state.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const total = () => subtotal() * (1 - state.discount / 100);
  const resetBasketCoupon = () => {
    state.coupon = null;
    state.discount = 0;
  };
  const basketBody = () => ({
    status: 'success',
    data: {
      id: 7,
      coupon: state.coupon,
      Products: state.items.map((i) => ({
        id: i.productId,
        name: `Product ${i.productId}`,
        price: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice,
        BasketItem: { id: Number(i.basketItemId), quantity: i.quantity, BasketId: 7, ProductId: i.productId },
      })),
      totalPrice: total(),
    },
  });
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      const auth = behavior.loginWithoutBid
        ? { token: 'tok-1', umail: 'canary@lab.local' }
        : { token: 'tok-1', bid: 7, umail: 'canary@lab.local' };
      return json(200, { status: 'success', authentication: auth });
    }
    if (method === 'GET' && u.pathname === '/rest/user/whoami') {
      return json(200, { status: 'success', data: { user: { id: 7, email: 'canary@lab.local' } } });
    }
    if (method === 'GET' && /^\/rest\/basket\/\d+$/.test(u.pathname)) {
      return json(200, basketBody());
    }
    if (method === 'GET' && u.pathname === '/api/Products') {
      return json(200, {
        status: 'success',
        data: [
          { id: 1, name: 'Apple Juice (1000ml)', price: 1.99 },
          { id: 2, name: 'Orange Juice (1000ml)', price: 3.5 },
        ],
      });
    }
    if (method === 'GET' && u.pathname === '/api/Coupons') {
      return json(200, {
        status: 'success',
        data: validCodes.map((c) => ({ ...c, validUntil: '2099-01-01' })),
      });
    }
    if (method === 'POST' && u.pathname === '/api/BasketItems') {
      const pid = body ? body.ProductId ?? body.productId : null;
      const qty = body ? Number(body.quantity) : NaN;
      if (pid == null || !Number.isFinite(qty)) return json(400, { status: 'error' });
      const existing = state.items.find((i) => String(i.productId) === String(pid));
      if (existing) {
        existing.quantity += qty;
      } else {
        state.items.push({
          basketItemId: String(state.nextItemId++),
          productId: pid,
          quantity: qty,
          unitPrice: 1.99,
        });
      }
      return json(201, { status: 'success', data: { id: state.nextItemId - 1 } });
    }
    if (method === 'PUT' && /^\/api\/BasketItems\/\d+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop();
      const item = state.items.find((i) => String(i.basketItemId) === String(id));
      if (!item) return json(404, { status: 'error' });
      const qty = body ? Number(body.quantity) : NaN;
      if (!Number.isFinite(qty)) return json(400, { status: 'error' });
      item.quantity = qty;
      if (qty === 0) {
        state.items = state.items.filter((i) => String(i.basketItemId) !== String(id));
      }
      if (!state.items.length) resetBasketCoupon();
      return json(200, { status: 'success', data: { id: Number(id) } });
    }
    if (method === 'PUT' && /^\/rest\/basket\/\d+\/coupon\/[^/]+$/.test(u.pathname)) {
      const code = decodeURIComponent(u.pathname.split('/').pop());
      const known = validCodes.find((c) => c.code === code);
      if (!known || behavior.invalidCode) {
        return json(400, { status: 'error', message: 'invalid coupon' });
      }
      if (state.usedCodes.has(code) && !behavior.reuseAllowed) {
        return json(400, { status: 'error', message: 'coupon already used' });
      }
      if (behavior.controlBroken) {
        return json(200, { status: 'success', data: { coupon: code } });
      }
      if (behavior.stackingAllowed && state.coupon && state.coupon !== code) {
        state.discount += known.discount;
      } else {
        state.coupon = code;
        state.discount = known.discount;
      }
      state.usedCodes.add(code);
      return json(200, { status: 'success', data: { coupon: code } });
    }
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      state.items = [];
      resetBasketCoupon();
      return json(200, { status: 'success', data: { orderId: 99, totalPrice: total() } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- route discovery --------------------------------------------------------

describe('route discovery', () => {
  it('CP-1: coupon apply route found, list route + cross-origin excluded', () => {
    assert.deepEqual(findCouponApplyRoutes(ROUTES, ORIGIN), [
      'http://lab.local/rest/basket/dmprobe1_ab12/coupon/dmprobe2_cd34',
    ]);
    assert.deepEqual(findCouponApplyRoutes(['http://other.local/rest/basket/9/coupon/xyz'], ORIGIN), []);
    assert.deepEqual(findCouponApplyRoutes(['http://lab.local/api/Coupons'], ORIGIN), []);
  });
  it('CP-2: coupon list route found, apply routes excluded', () => {
    assert.deepEqual(findCouponListRoutes(ROUTES, ORIGIN), ['http://lab.local/api/Coupons']);
    assert.deepEqual(
      findCouponListRoutes(['http://lab.local/rest/basket/dmprobe1_ab12/coupon/dmprobe2_cd34'], ORIGIN),
      []
    );
  });
  it('CP-3: id + code fillers replace the right segments; body form when the route ends at the marker', () => {
    assert.deepEqual(
      fillCouponRoute('http://lab.local/rest/basket/dmprobe1_ab12/coupon/dmprobe2_cd34', 7, 'SAVE10'),
      { url: 'http://lab.local/rest/basket/7/coupon/SAVE10', codeInBody: false }
    );
    assert.deepEqual(fillCouponRoute('http://lab.local/rest/basket/7/coupon', 7, 'SAVE10'), {
      url: 'http://lab.local/rest/basket/7/coupon',
      codeInBody: true,
    });
    assert.deepEqual(fillCouponRoute('http://lab.local/api/Coupons/apply', 7, 'SAVE10'), {
      url: 'http://lab.local/api/Coupons/apply',
      codeInBody: true,
    });
    assert.equal(fillCouponRoute('http://lab.local/api/Products', 7, 'SAVE10'), null);
  });
});

// ---- coupon-list parsing ----------------------------------------------------

describe('parseCouponList', () => {
  it('CP-4: data array + top-level array parse, codes deduped, code-less entries skipped', () => {
    assert.deepEqual(parseCouponList({ data: [{ code: 'SAVE10', discount: 10 }, { code: 'SAVE20', discount: 20 }] }), [
      { code: 'SAVE10', discount: 10 },
      { code: 'SAVE20', discount: 20 },
    ]);
    assert.deepEqual(parseCouponList([{ code: 'A', discount: 5 }, { code: 'A', discount: 5 }, { discount: 5 }]), [
      { code: 'A', discount: 5 },
    ]);
    assert.deepEqual(parseCouponList({ data: [{ code: 'B' }] }), [{ code: 'B', discount: null }]);
    assert.deepEqual(parseCouponList({ status: 'error' }), []);
    assert.deepEqual(parseCouponList(null), []);
  });
});

// ---- the oracles ------------------------------------------------------------

describe('assessCouponControl / assessCouponReuse / assessCouponStacked', () => {
  it('CP-5: control confirmed on a drop, rejected on no drop, unconfirmed on unreadable totals', () => {
    const conf = assessCouponControl(1.99, 1.79);
    assert.equal(conf.verdict, 'confirmed');
    assert.ok(Math.abs(conf.drop - 0.2) < 0.011);
    assert.equal(assessCouponControl(1.99, 1.99).verdict, 'rejected');
    assert.equal(assessCouponControl(1.99, null).verdict, 'unconfirmed');
  });
  it('CP-6: reuse confirmed on the same drop again, rejected on a small or missing drop', () => {
    assert.equal(assessCouponReuse(0.2, 1.99, 1.99, 1.79).verdict, 'confirmed');
    // A fresh basket half the size: the drop scales with it.
    assert.equal(assessCouponReuse(0.4, 3.98, 1.99, 1.79).verdict, 'confirmed');
    assert.equal(assessCouponReuse(0.2, 1.99, 1.99, 1.99).verdict, 'rejected');
    assert.equal(assessCouponReuse(0.2, 1.99, 1.99, 1.95).verdict, 'rejected');
    assert.equal(assessCouponReuse(0.2, 1.99, 1.99, null).verdict, 'unconfirmed');
  });
  it('CP-7: stacking confirmed below the floor, rejected when the second coupon merely replaces the first', () => {
    // Floor: 1.99 - max(0.20, 0.40) = 1.59. Stacked total 1.39 is below it.
    assert.equal(assessCouponStacked(1.99, 1.59, 1.39).verdict, 'confirmed');
    // Replacement lands exactly on the floor — never a finding.
    assert.equal(assessCouponStacked(1.99, 1.59, 1.59).verdict, 'rejected');
    assert.equal(assessCouponStacked(1.99, 1.59, null).verdict, 'unconfirmed');
  });
  it('CP-8: expectedDrop reads (0,100] as a percentage, larger values as a fixed amount', () => {
    assert.ok(Math.abs(expectedDrop(10, 1.99) - 0.199) < 0.001);
    assert.equal(expectedDrop(150, 1.99), 1.99);
    assert.equal(expectedDrop(null, 1.99), null);
    assert.equal(expectedDrop(10, 0), null);
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeCouponAbuse — vulnerable shop', () => {
  it('CP-9: a reusable coupon fires the reuse finding exactly once', async () => {
    const { state, fetchFn } = makeFakeJuice({ reuseAllowed: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /accepted again on a fresh basket/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.couponRoutes, 1);
    assert.equal(diag.couponCodes, 2);
    assert.equal(diag.bypassKind, 'reuse');
    assert.ok(diag.attempts >= 2, 'control + reuse applies must both run');
    // The basket id in every basket call is the canary's own (7) —
    // never a mined filler id, never another user's basket.
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket GET must use id 7');
    assert.ok(state.calls.some((c) => c === 'PUT /rest/basket/7/coupon/SAVE10'), 'apply must use id 7 + the listed code');
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('CP-10: a stacking shop fires the stacked finding (reuse refused first)', async () => {
    const { fetchFn } = makeFakeJuice({ stackingAllowed: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /stacked for a double discount/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(diag.bypassKind, 'stacked');
    assert.equal(diag.controlOk, true);
  });
  it('CP-15: an empty basket is seeded with the cheapest product, then reuse fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ reuseAllowed: true, emptyBasket: true });
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /accepted again on a fresh basket/);
    assert.ok(state.calls.some((c) => c === 'GET /api/Products'), 'seed path must fetch the product list');
  });
  it('CP-17: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice({ reuseAllowed: true });
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('CP-18: without an item route the basket is emptied by checkout, then reuse fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ reuseAllowed: true });
    const routes = ROUTES.filter((r) => !r.includes('/api/BasketItems/dmprobe'));
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /accepted again on a fresh basket/);
    assert.ok(state.calls.some((c) => c === 'POST /rest/basket/7/checkout'), 'emptying must fall back to checkout');
  });
});

describe('probeCouponAbuse — safe shop', () => {
  it('CP-11: single-use + replace-only coupons yield zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.reuseTested, true);
    assert.equal(diag.stackedTested, true);
  });
  it('CP-12: an invalid listed code yields zero findings (oracle uncalibrated)', async () => {
    const { fetchFn } = makeFakeJuice({ invalidCode: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
    assert.equal(diag.couponCodes, 2);
  });
  it('CP-13: no coupon route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ reuseAllowed: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
      apiRoutes: ROUTES.filter((r) => !r.includes('/coupon/')),
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.couponRoutes, 0);
  });
  it('CP-14: no coupon list anywhere yields zero findings (no code to calibrate with)', async () => {
    const { fetchFn } = makeFakeJuice({ reuseAllowed: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
      apiRoutes: ROUTES.filter((r) => !r.includes('/api/Coupons')),
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.couponCodes, 0);
  });
  it('CP-19: a single listed code skips the stacking leg', async () => {
    const { fetchFn } = makeFakeJuice({ singleCode: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.stackedTested, false);
  });
  it('CP-20: a broken control (apply answers 2xx, total never moves) yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ controlBroken: true });
    const diag = {};
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
});

describe('probeCouponAbuse — gates', () => {
  it('CP-16: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice({ reuseAllowed: true });
    assert.deepEqual(await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
  it('CP-21: login without a basket id falls back to the whoami user id', async () => {
    const { state, fetchFn } = makeFakeJuice({ reuseAllowed: true, loginWithoutBid: true });
    const findings = await probeCouponAbuse('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.ok(state.calls.some((c) => c === 'GET /rest/user/whoami'), 'whoami fallback must run');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket id must come from whoami');
  });
});

describe('coupon-abuse meta', () => {
  it('CP-22: phase 99 registration metadata', () => {
    assert.deepEqual(__couponMeta, { phases: ['coupon-abuse'], depth: ['standard', 'deep'] });
  });
});
