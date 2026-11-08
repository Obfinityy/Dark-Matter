// Tests for the workflow / step-skipping probe
// (coverage row #87 [High] Workflow / Step-Skipping Bypass,
// WSTG-BUSL; phase 89).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake Juice
// Shop: login returns a token + basket id, GET /rest/basket/:id
// returns the basket ledger, POST /api/BasketItems adds,
// POST /rest/basket/:id/checkout checks out (and consumes the
// basket). Behaviour flags flip the fake between a vulnerable
// shop and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWorkflowSkip,
  findOrderArtefact,
  assessCheckoutOrder,
  assessEmptyCheckout,
} from './workflowSkip.js';
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

// ---- stateful fake Juice ----------------------------------------------------
// behavior flags: rejectEmptyCheckout (safe shop), replayOrder
// (second checkout returns the SAME order id), controlBroken
// (control checkout returns no order artefact), controlKeepsItems
// (control checkout leaves the items in the basket), emptyBasket
// (seed path), loginWithoutBid (whoami fallback path).
function makeFakeJuice(behavior = {}) {
  const state = {
    items: behavior.emptyBasket
      ? []
      : [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    nextOrderId: 99,
    checkoutCount: 0,
    calls: [],
  };
  const total = () => state.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
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
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      state.checkoutCount += 1;
      if (behavior.controlBroken && state.checkoutCount === 1) {
        return json(200, { status: 'success', data: {} });
      }
      if (state.items.length === 0) {
        if (behavior.rejectEmptyCheckout) {
          return json(400, { status: 'error', message: 'basket is empty' });
        }
        if (behavior.replayOrder) {
          return json(200, { status: 'success', data: { orderId: 99, totalPrice: 0 } });
        }
        return json(200, { status: 'success', data: { orderId: state.nextOrderId++, totalPrice: 0 } });
      }
      const charged = total();
      if (!behavior.controlKeepsItems) state.items = [];
      return json(200, { status: 'success', data: { orderId: state.nextOrderId++, totalPrice: charged } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure artefact parsing --------------------------------------------------

describe('findOrderArtefact', () => {
  it('WF-1: orderId field is an artefact', () => {
    const a = findOrderArtefact({ status: 'success', data: { orderId: 99, totalPrice: 1.99 } });
    assert.equal(a.orderId, '99');
    assert.equal(a.total, 1.99);
    assert.equal(a.kind, 'order-id');
  });
  it('WF-2: success + data.id is an artefact', () => {
    const a = findOrderArtefact({ status: 'success', data: { id: 42, totalPrice: 1.99 } });
    assert.equal(a.orderId, '42');
    assert.equal(a.kind, 'order-id');
  });
  it('WF-3: success + order total with no id is an artefact', () => {
    const a = findOrderArtefact({ status: 'success', data: { totalPrice: 0 } });
    assert.equal(a.orderId, null);
    assert.equal(a.total, 0);
    assert.equal(a.kind, 'order-total');
  });
  it('WF-4: error bodies, bare success-only bodies and null are not artefacts; a bare orderId is', () => {
    assert.equal(findOrderArtefact({ status: 'error', message: 'basket is empty' }), null);
    assert.equal(findOrderArtefact({ status: 'success' }), null);
    assert.equal(findOrderArtefact(null), null);
    assert.equal(findOrderArtefact('text'), null);
    assert.equal(findOrderArtefact({ data: { orderId: 99 } }).orderId, '99');
  });
});

// ---- the assessors ----------------------------------------------------------

describe('assessCheckoutOrder', () => {
  it('WF-5: non-2xx is not an order', () => {
    assert.equal(assessCheckoutOrder(400, { status: 'error' }).found, false);
    assert.equal(assessCheckoutOrder(null, { status: 'success', data: { orderId: 1 } }).found, false);
  });
  it('WF-6: 2xx without an artefact is not an order', () => {
    assert.equal(assessCheckoutOrder(200, { status: 'success', data: {} }).found, false);
    assert.equal(assessCheckoutOrder(200, { status: 'success', data: { orderId: 7 } }).found, true);
  });
});

describe('assessEmptyCheckout', () => {
  it('WF-7: a refused empty checkout is rejected, never a finding', () => {
    assert.equal(assessEmptyCheckout({ orderId: '99' }, 400, { status: 'error' }).verdict, 'rejected');
    assert.equal(assessEmptyCheckout({ orderId: '99' }, 403, { status: 'error' }).verdict, 'rejected');
  });
  it('WF-8: the same order id back is an idempotent replay, never a finding', () => {
    const v = assessEmptyCheckout(
      { orderId: '99', total: 1.99, kind: 'order-id' },
      200,
      { status: 'success', data: { orderId: 99, totalPrice: 0 } }
    );
    assert.equal(v.verdict, 'replayed');
  });
  it('WF-9: a distinct order artefact confirms — even when the control had no id', () => {
    const distinct = assessEmptyCheckout(
      { orderId: '99', total: 1.99, kind: 'order-id' },
      200,
      { status: 'success', data: { orderId: 100, totalPrice: 0 } }
    );
    assert.equal(distinct.verdict, 'confirmed');
    const noControlId = assessEmptyCheckout(
      { orderId: null, total: 1.99, kind: 'order-total' },
      200,
      { status: 'success', data: { orderId: 100, totalPrice: 0 } }
    );
    assert.equal(noControlId.verdict, 'confirmed');
  });
  it('WF-10: a 200 with no artefact is rejected', () => {
    assert.equal(
      assessEmptyCheckout({ orderId: '99' }, 200, { status: 'success', data: {} }).verdict,
      'rejected'
    );
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeWorkflowSkip — vulnerable shop', () => {
  it('WF-11: empty-basket checkout fires exactly one [High] business_logic finding', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /checkout accepted for an empty basket/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(diag.workflowRoutes, 1);
    assert.equal(diag.basketId, true);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.mutations, 1);
    // Control + test: the checkout step ran exactly twice.
    assert.equal(state.calls.filter((c) => c === 'POST /rest/basket/7/checkout').length, 2);
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('WF-12: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeWorkflowSkip — safe shop', () => {
  it('WF-13: a shop that refuses empty-basket checkout yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ rejectEmptyCheckout: true });
    const diag = {};
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.mutations, 1);
  });
  it('WF-14: an idempotent replay (same order id) yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ replayOrder: true });
    const diag = {};
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
  });
  it('WF-15: a control checkout with no order artefact yields zero findings (oracle uncalibrated)', async () => {
    const { fetchFn } = makeFakeJuice({ controlBroken: true });
    const diag = {};
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
  it('WF-19: a control checkout that leaves items in the basket cannot run the test', async () => {
    const { fetchFn } = makeFakeJuice({ controlKeepsItems: true });
    const diag = {};
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.mutations, undefined);
  });
});

describe('probeWorkflowSkip — seeding and login', () => {
  it('WF-16: an empty basket is seeded with the cheapest product, then the skip fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ emptyBasket: true });
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /checkout accepted for an empty basket/);
    assert.ok(state.calls.some((c) => c === 'GET /api/Products'), 'seed path must fetch the product list');
  });
  it('WF-17: login without a basket id falls back to the whoami user id', async () => {
    const { state, fetchFn } = makeFakeJuice({ loginWithoutBid: true });
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.ok(state.calls.some((c) => c === 'GET /rest/user/whoami'), 'whoami fallback must run');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket id must come from whoami');
  });
  it('WF-20b: an empty basket with no collection route to seed from yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ emptyBasket: true });
    const routes = ROUTES.filter((r) => !r.includes('/api/BasketItems'));
    const findings = await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes });
    assert.deepEqual(findings, []);
  });
});

describe('probeWorkflowSkip — missing surface and gates', () => {
  it('WF-18: no checkout route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !r.includes('/checkout'));
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes }), []);
  });
  it('WF-22: no basket GET route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const routes = ROUTES.filter((r) => !/\/rest\/basket\/dmprobe/.test(r));
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes }), []);
  });
  it('WF-20a: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice();
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
  it('WF-21: basket id is never a filler — every basket call carries the canary id', async () => {
    const { state, fetchFn } = makeFakeJuice();
    await probeWorkflowSkip('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const basketCalls = state.calls.filter((c) => c.includes('/rest/basket/'));
    assert.ok(basketCalls.length > 0, 'basket must be called');
    assert.ok(basketCalls.every((c) => /\/rest\/basket\/7(\/|$)/.test(c)), `all basket calls must use id 7; got: ${basketCalls.join(', ')}`);
  });
});
