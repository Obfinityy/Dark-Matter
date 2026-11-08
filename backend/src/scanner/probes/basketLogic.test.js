// Tests for the basket-logic probe
// (coverage rows #82 / #370, variants #374 / #80 / #83; phase 88).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake Juice
// Shop: login returns a token + basket id, GET /rest/basket/:id
// returns the basket ledger, PUT /api/BasketItems/:id sets a
// quantity, POST /api/BasketItems adds, POST /rest/basket/:id/checkout
// checks out. Behaviour flags flip the fake between a vulnerable
// shop and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeBasketLogic,
  parseBasket,
  parseProductList,
  basketGetRoute,
  basketItemRoutes,
  basketCheckoutRoute,
  productListRoute,
  replaceLastSegment,
  fillBasketId,
  fillCheckoutBasketId,
  extractBasketId,
  findOrderTotal,
  assessBasketManipulation,
  assessCheckoutTamper,
} from './basketLogic.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34',
  'http://lab.local/api/BasketItems',
  'http://lab.local/api/BasketItems/dmprobe3_ef56',
  'http://lab.local/rest/basket/dmprobe1_ab12/checkout',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Products',
  'http://other.local/rest/basket/9',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

const JUICE_BASKET = {
  status: 'success',
  data: {
    id: 7,
    coupon: null,
    Products: [
      {
        id: 1,
        name: 'Apple Juice (1000ml)',
        price: 1.99,
        totalPrice: 1.99,
        BasketItem: { id: 11, quantity: 1, BasketId: 7, ProductId: 1 },
      },
    ],
    totalPrice: 1.99,
  },
};

// ---- stateful fake Juice ----------------------------------------------------
// behavior flags: rejectNegative (safe shop), wrapHuge (32-bit wrap),
// honorTamperedPrice (checkout honours the tampered total),
// controlBroken (+1 does not move the total), emptyBasket (seed path),
// loginWithoutBid (whoami fallback path).
function makeFakeJuice(behavior = {}) {
  const state = {
    items: behavior.emptyBasket
      ? []
      : [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    calls: [],
    checkedOutTotal: null,
  };
  const total = () => {
    if (behavior.wrapHuge && state.items.some((i) => i.quantity >= 9007199254740991)) return -42.5;
    return state.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  };
  const basketBody = () => ({
    status: 'success',
    data: {
      id: 7,
      coupon: null,
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
    if (method === 'POST' && u.pathname === '/api/BasketItems') {
      if (behavior.rejectNegative && body && body.quantity < 0) return json(400, { status: 'error', message: 'quantity must be positive' });
      const pid = body ? body.ProductId ?? body.productId : null;
      const qty = body ? Number(body.quantity) : NaN;
      if (pid == null || !Number.isFinite(qty)) return json(400, { status: 'error' });
      if (behavior.controlBroken) return json(201, { status: 'success', data: { id: 0 } });
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
      if (behavior.rejectNegative && qty < 0) return json(400, { status: 'error', message: 'quantity must be positive' });
      if (!behavior.controlBroken) item.quantity = qty;
      return json(200, { status: 'success', data: { id: Number(id) } });
    }
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      const charged =
        behavior.honorTamperedPrice && body && typeof body.totalPrice === 'number'
          ? body.totalPrice
          : total();
      state.checkedOutTotal = charged;
      return json(200, { status: 'success', data: { orderId: 99, totalPrice: charged } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure parsing -----------------------------------------------------------

describe('parseBasket', () => {
  it('BL-1: Juice-shaped body parses total + items with the BasketItem join', () => {
    const p = parseBasket(JUICE_BASKET);
    assert.equal(p.ok, true);
    assert.equal(p.total, 1.99);
    assert.equal(p.items.length, 1);
    assert.equal(p.items[0].basketItemId, '11');
    assert.equal(p.items[0].productId, 1);
    assert.equal(p.items[0].quantity, 1);
    assert.equal(p.items[0].unitPrice, 1.99);
    assert.equal(p.items[0].totalPrice, 1.99);
  });
  it('BL-2: empty basket parses as total 0 with zero items', () => {
    const p = parseBasket({ status: 'success', data: { id: 7, Products: [], totalPrice: 0 } });
    assert.equal(p.ok, true);
    assert.equal(p.total, 0);
    assert.deepEqual(p.items, []);
  });
  it('BL-3: a non-basket body is not a basket', () => {
    assert.equal(parseBasket({ status: 'error', message: 'nope' }).ok, false);
    assert.equal(parseBasket(null).ok, false);
    assert.equal(parseBasket('text').ok, false);
  });
});

describe('parseProductList', () => {
  it('BL-4: cheapest first, invalid prices skipped', () => {
    const out = parseProductList({
      data: [
        { id: 2, price: 3.5 },
        { id: 1, price: 1.99 },
        { id: 3 },
        { id: 4, price: 'free' },
      ],
    });
    assert.deepEqual(out.map((p) => p.id), [1, 2]);
  });
});

// ---- route discovery --------------------------------------------------------

describe('route discovery', () => {
  it('BL-5a: basket GET route found, cross-origin excluded', () => {
    assert.equal(basketGetRoute(ROUTES, ORIGIN), 'http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34');
    assert.equal(basketGetRoute(['http://other.local/rest/basket/9'], ORIGIN), null);
  });
  it('BL-5b: item routes split into collection (POST) and item template (PUT)', () => {
    const { collection, itemTemplate } = basketItemRoutes(ROUTES, ORIGIN);
    assert.equal(collection, 'http://lab.local/api/BasketItems');
    assert.equal(itemTemplate, 'http://lab.local/api/BasketItems/dmprobe3_ef56');
  });
  it('BL-5c: checkout + product-list routes found', () => {
    assert.equal(basketCheckoutRoute(ROUTES, ORIGIN), 'http://lab.local/rest/basket/dmprobe1_ab12/checkout');
    assert.equal(productListRoute(ROUTES, ORIGIN), 'http://lab.local/api/Products');
  });
  it('BL-6: id fillers replace the right segment and strip the query', () => {
    assert.equal(
      fillBasketId('http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34', 7),
      'http://lab.local/rest/basket/7'
    );
    assert.equal(
      replaceLastSegment('http://lab.local/api/BasketItems/dmprobe3_ef56', 11),
      'http://lab.local/api/BasketItems/11'
    );
    assert.equal(
      fillCheckoutBasketId('http://lab.local/rest/basket/dmprobe1_ab12/checkout', 7),
      'http://lab.local/rest/basket/7/checkout'
    );
    assert.equal(fillCheckoutBasketId('http://lab.local/rest/basket/checkout', 7), null);
  });
  it('BL-7: basket id comes from a nested bid, never from a filler', () => {
    assert.equal(extractBasketId({ authentication: { token: 't', bid: 7 } }), '7');
    assert.equal(extractBasketId({ data: { basketId: '42' } }), '42');
    assert.equal(extractBasketId({ status: 'success' }), null);
  });
});

// ---- the oracle -------------------------------------------------------------

describe('assessBasketManipulation', () => {
  const base = { total: 3.98, items: [{ basketItemId: '11', quantity: 2, unitPrice: 1.99, totalPrice: 3.98 }] };
  it('BL-8: set -1 confirmed when the item persists negative and the total drops', () => {
    const v = assessBasketManipulation(base, { total: -1.99, items: [{ basketItemId: '11', quantity: -1 }] }, { kind: 'set', quantity: -1, unitPrice: 1.99, itemId: '11' });
    assert.equal(v.verdict, 'confirmed');
  });
  it('BL-9: set -1 rejected when the server removes the item', () => {
    const v = assessBasketManipulation(base, { total: 0, items: [] }, { kind: 'set', quantity: -1, unitPrice: 1.99, itemId: '11' });
    assert.equal(v.verdict, 'rejected');
  });
  it('BL-10: set -1 rejected when the total does not move (clamped)', () => {
    const v = assessBasketManipulation(base, { total: 3.98, items: [{ basketItemId: '11', quantity: 0 }] }, { kind: 'set', quantity: -1, unitPrice: 1.99, itemId: '11' });
    assert.equal(v.verdict, 'rejected');
  });
  it('BL-11: add -1 confirmed when the total drops, rejected when it does not', () => {
    const conf = assessBasketManipulation(base, { total: 1.99, items: [] }, { kind: 'add', quantity: -1, unitPrice: 1.99, itemId: '11' });
    assert.equal(conf.verdict, 'confirmed');
    const rej = assessBasketManipulation(base, { total: 3.98, items: [] }, { kind: 'add', quantity: -1, unitPrice: 1.99, itemId: '11' });
    assert.equal(rej.verdict, 'rejected');
  });
  it('BL-12: set 0 rejected as a removal, confirmed only on a negative total', () => {
    const rej = assessBasketManipulation(base, { total: 0, items: [] }, { kind: 'set', quantity: 0, unitPrice: 1.99, itemId: '11' });
    assert.equal(rej.verdict, 'rejected');
    const conf = assessBasketManipulation(base, { total: -1.99, items: [] }, { kind: 'set', quantity: 0, unitPrice: 1.99, itemId: '11' });
    assert.equal(conf.verdict, 'confirmed');
  });
  it('BL-13: huge quantity confirmed on wrap, rejected on a huge total', () => {
    const conf = assessBasketManipulation(base, { total: -42.5, items: [] }, { kind: 'set', quantity: 9007199254740991, unitPrice: 1.99, itemId: '11' });
    assert.equal(conf.verdict, 'confirmed');
    const rej = assessBasketManipulation(base, { total: 1.79e16, items: [] }, { kind: 'set', quantity: 9007199254740991, unitPrice: 1.99, itemId: '11' });
    assert.equal(rej.verdict, 'rejected');
  });
  it('BL-14: unreadable totals are unconfirmed, never a finding', () => {
    assert.equal(assessBasketManipulation(base, { total: null, items: [] }, { kind: 'set', quantity: -1, unitPrice: 1.99, itemId: '11' }).verdict, 'unconfirmed');
    assert.equal(assessBasketManipulation(base, { total: 1, items: [] }, { kind: 'set', quantity: 5, unitPrice: 1.99, itemId: '11' }).verdict, 'unconfirmed');
  });
});

describe('assessCheckoutTamper', () => {
  it('BL-15: confirmed only when the order total IS the tampered amount', () => {
    assert.equal(assessCheckoutTamper({ data: { orderId: 99, totalPrice: 0.01 } }, 0.01).verdict, 'confirmed');
    assert.equal(assessCheckoutTamper({ data: { orderId: 99, totalPrice: 1.99 } }, 0.01).verdict, 'rejected');
    assert.equal(assessCheckoutTamper({ data: { orderId: 99 } }, 0.01).verdict, 'unconfirmed');
  });
  it('BL-16: order total found nested, depth-capped', () => {
    assert.equal(findOrderTotal({ data: { order: { totalPrice: 0.01 } } }), 0.01);
    assert.equal(findOrderTotal({ status: 'success' }), null);
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeBasketLogic — vulnerable shop', () => {
  it('BL-17: negative quantity fires exactly once; 0 / huge / checkout do not', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /negative quantity/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.mutations, 3);
    assert.equal(diag.basketId, true);
    // The basket id in every basket call is the canary's own (7) —
    // never a mined filler id, never another user's basket.
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket GET must use id 7');
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('BL-25: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeBasketLogic — safe shop', () => {
  it('BL-18: a shop that rejects negative quantities yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ rejectNegative: true });
    const diag = {};
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
  });
  it('BL-19: a broken +1 control yields zero findings (oracle uncalibrated)', async () => {
    const { fetchFn } = makeFakeJuice({ controlBroken: true });
    const diag = {};
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
});

describe('probeBasketLogic — seeding, overflow, checkout, add-only', () => {
  it('BL-20: an empty basket is seeded with the cheapest product, then the edges run', async () => {
    const { state, fetchFn } = makeFakeJuice({ emptyBasket: true });
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /negative quantity/);
    // Restore left the seeded item at quantity 0 (removed).
    assert.ok(state.calls.some((c) => c === 'GET /api/Products'), 'seed path must fetch the product list');
  });
  it('BL-21: a wrapping huge quantity fires the overflow finding', async () => {
    const { fetchFn } = makeFakeJuice({ wrapHuge: true });
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const titles = findings.map((f) => f.title);
    assert.ok(titles.some((t) => /oversized quantity/.test(t)), `overflow must fire; got: ${titles.join(' | ')}`);
    assert.ok(titles.some((t) => /negative quantity/.test(t)), 'negative quantity must still fire');
  });
  it('BL-22: a checkout that honours the tampered price fires the price finding', async () => {
    const { fetchFn } = makeFakeJuice({ honorTamperedPrice: true });
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const titles = findings.map((f) => f.title);
    assert.ok(titles.some((t) => /tampered price accepted at checkout/.test(t)), `checkout tamper must fire; got: ${titles.join(' | ')}`);
  });
  it('BL-23: add-only shop (no PUT route) fires via POST add', async () => {
    const { fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !r.includes('/api/BasketItems/dmprobe'));
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /negative quantity/);
    assert.match(findings[0].evidence.request, /POST add quantity -1/);
  });
  it('BL-26: login without a basket id falls back to the whoami user id', async () => {
    const { state, fetchFn } = makeFakeJuice({ loginWithoutBid: true });
    const findings = await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.ok(state.calls.some((c) => c === 'GET /rest/user/whoami'), 'whoami fallback must run');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket id must come from whoami');
  });
});

describe('probeBasketLogic — gates', () => {
  it('BL-24a: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice();
    assert.deepEqual(await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
    assert.deepEqual(
      await probeBasketLogic('http://lab.local/', {
        ...BASE_OPTS,
        fetchFn,
        apiRoutes: ROUTES.filter((r) => !/BasketItems/.test(r)),
      }),
      []
    );
  });
  it('BL-27: basket id is never a filler — every basket call carries the canary id', async () => {
    const { state, fetchFn } = makeFakeJuice();
    await probeBasketLogic('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const basketCalls = state.calls.filter((c) => c.includes('/rest/basket/'));
    assert.ok(basketCalls.length > 0, 'basket must be called');
    assert.ok(basketCalls.every((c) => /\/rest\/basket\/7(\/|$)/.test(c)), `all basket calls must use id 7; got: ${basketCalls.join(', ')}`);
  });
});
