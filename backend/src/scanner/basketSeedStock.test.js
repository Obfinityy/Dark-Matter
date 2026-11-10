// Tests for the basket seed/control stock failure (10 Nov 2026).
//
// LIVE REGRESSION: proof #40 (hunt h_5774b0204eb7, 124th deploy)
// finished 28/0 against 30/0 sequential (proof #39). The two missing
// titles were both HIGH basket titles — "Business logic — negative
// quantity reduces the basket total" and "Unrestricted access to
// sensitive business flow — another user's basket readable" — even
// though the 124th-deploy fix had PROVABLY serialised the six
// basket phases (zero overlap). The failure was not the overlap.
//
// ROOT CAUSE (live-proven on EC2 the same day): Juice Shop v17.3.0
// tracks stock per product, and every checkout decrements it. The
// cheapest product (id 9, 0.01) sits at stock -1 after months of
// hunts, and every basket probe seeded the cheapest product first
// with no fallback: the seed POST 400s ("We are out of stock!"), the
// probe bailed in ~46ms, and the phase record could not say which
// stage bailed. Basket-logic's control has the same hole in the
// other direction — a leftover out-of-stock item in the canary
// basket fails the +1 control PUT with the same 400, and the probe
// bailed instead of clearing the basket and re-seeding.
//
// The fake below models Juice v17.3.0 faithfully where it matters:
// a per-product stock table the probes never see (the real shop
// exposes stock only on /api/Quantitys, which no probe calls);
// quantityCheck on POST add and on PUT quantity-increase (400
// "We are out of stock!" when stock < requested quantity, skipped
// for a falsy quantity); PascalCase body keys only (a camelCase body
// 500s — the probes' old spelling retry could never succeed on
// Juice); PUT quantity 0 removes the item; checkout empties the
// basket AND decrements stock by the ordered quantity; a negative
// quantity is accepted on PUT (the vulnerable shop); the victim
// basket reads for any token (no cross-user authorisation check).
// No network, no lab: the probes talk to the shop only through the
// opts.fetchFn seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeBasketLogic } from './probes/basketLogic.js';
import { probeBusinessFlowAccess } from './probes/businessFlowAccess.js';
import { probeWorkflowSkip } from './probes/workflowSkip.js';
import { verifyFindings } from './verifier.js';

const ORIGIN = 'http://lab.local';
const TARGET_URL = 'http://lab.local/';
const HUGE_QTY = 9007199254740991; // 2^53 - 1
const ROUTES = [
  'http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34',
  'http://lab.local/api/BasketItems',
  'http://lab.local/api/BasketItems/dmprobe3_ef56',
  'http://lab.local/rest/basket/dmprobe1_ab12/checkout',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Products',
  'http://lab.local/api/Users',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// Stock-aware fake Juice. `stocks` maps product id -> QuantityModel
// quantity (negative means drained below zero, as the live lab
// shows for product 9). `initialBasket7` pre-loads the labCreds
// basket (bid 7) — a leftover item from an earlier phase.
function makeStockFake({ stocks = { 9: -1, 1: 33, 2: 65 }, initialBasket7 = [] } = {}) {
  const stock = { ...stocks };
  const baskets = {
    7: initialBasket7.map((i) => ({ ...i })),
    8: [],
  };
  const products = [
    { id: 9, name: 'OWASP SSL Advanced Forensic Tool (O-Saft)', price: 0.01 },
    { id: 1, name: 'Apple Juice (1000ml)', price: 1.99 },
    { id: 2, name: 'Orange Juice (1000ml)', price: 2.99 },
  ];
  const priceOf = (pid) => {
    const p = products.find((x) => String(x.id) === String(pid));
    return p ? p.price : 1.99;
  };
  let nextItemId = 12;
  let nextOrderId = 99;
  const calls = [];
  const totalOf = (items) => items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const basketBody = (id, items) => ({
    status: 'success',
    data: {
      id,
      coupon: null,
      Products: items.map((i) => ({
        id: i.productId,
        name: `Product ${i.productId}`,
        price: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice,
        BasketItem: { id: Number(i.basketItemId), quantity: i.quantity, BasketId: id, ProductId: i.productId },
      })),
      totalPrice: totalOf(items),
    },
  });
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    const auth = String((init.headers && init.headers.Authorization) || '');
    const token = auth.replace(/^Bearer\s+/i, '');
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    const qty = body ? Number(body.quantity) : NaN;
    calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    const outOfStock = () => json(400, { error: 'We are out of stock! Sorry for the inconvenience.' });

    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (body && body.email === 'canary@lab.local' && body.password === 'canary-pass') {
        return json(200, { status: 'success', authentication: { token: 'tok-1', bid: 7, umail: 'canary@lab.local' } });
      }
      if (
        body &&
        typeof body.email === 'string' &&
        body.email.indexOf('dm-bflow-low-') === 0 &&
        body.password === 'dm-bflow-low-pass-01'
      ) {
        return json(200, { status: 'success', authentication: { token: 'tok-canary', bid: 8 } });
      }
      return json(401, { status: 'error', message: 'Invalid email or password.' });
    }
    if (method === 'POST' && u.pathname === '/api/Users') {
      return json(201, { status: 'success', data: { id: 99 } });
    }
    if (method === 'GET' && u.pathname === '/rest/user/whoami') {
      if (token === 'tok-1') return json(200, { status: 'success', data: { user: { id: 7, email: 'canary@lab.local' } } });
      if (token === 'tok-canary') return json(200, { status: 'success', data: { user: { id: 8 } } });
      return json(401, { status: 'error' });
    }
    if (method === 'GET' && /^\/rest\/basket\/\d+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop();
      if (!token) return json(401, { status: 'error', message: 'Unauthorized' });
      // The vulnerable shop: any token reads any basket.
      return json(200, basketBody(Number(id), baskets[id] || []));
    }
    if (method === 'GET' && u.pathname === '/api/Products') {
      return json(200, { status: 'success', data: products });
    }
    if (method === 'POST' && u.pathname === '/api/BasketItems') {
      if (!token) return json(401, { status: 'error' });
      // Juice parses the raw body for PascalCase keys only — a
      // camelCase body 500s (the probes' old spelling retry).
      if (!body || body.ProductId == null || body.BasketId == null) {
        return json(500, { status: 'error', message: 'Something went wrong' });
      }
      const pid = body.ProductId;
      const bid = body.BasketId;
      if (!Number.isFinite(qty)) return json(400, { status: 'error' });
      if (qty <= 0 || qty >= HUGE_QTY) return json(400, { status: 'error', message: 'quantity must be positive' });
      // quantityCheck: refused when stock < requested quantity.
      if ((stock[pid] ?? 0) < qty) return outOfStock();
      const items = baskets[bid] || (baskets[bid] = []);
      const existing = items.find((i) => String(i.productId) === String(pid));
      if (existing) {
        existing.quantity += qty;
      } else {
        items.push({
          basketItemId: String(nextItemId++),
          productId: pid,
          quantity: qty,
          unitPrice: priceOf(pid),
        });
      }
      return json(201, { status: 'success', data: { id: nextItemId - 1 } });
    }
    if (method === 'PUT' && /^\/api\/BasketItems\/\d+$/.test(u.pathname)) {
      if (!token) return json(401, { status: 'error' });
      const id = u.pathname.split('/').pop();
      let owner = null;
      let item = null;
      for (const items of Object.values(baskets)) {
        const found = items.find((i) => String(i.basketItemId) === String(id));
        if (found) {
          owner = items;
          item = found;
          break;
        }
      }
      if (!item) return json(404, { status: 'error' });
      if (!Number.isFinite(qty)) return json(400, { status: 'error' });
      // A falsy quantity skips the stock check AND removes the
      // item — this is how the shop clears a basket line.
      if (!qty) {
        owner.splice(owner.indexOf(item), 1);
        return json(200, { status: 'success', data: { id: Number(id) } });
      }
      if (qty >= HUGE_QTY) return json(400, { status: 'error', message: 'quantity too large' });
      // Negative quantities are accepted (the vulnerable shop);
      // a positive increase is refused when stock < new quantity.
      if (qty > 0 && qty > item.quantity && (stock[item.productId] ?? 0) < qty) return outOfStock();
      item.quantity = qty;
      return json(200, { status: 'success', data: { id: Number(id) } });
    }
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      if (!token) return json(401, { status: 'error' });
      // '/rest/basket/<id>/checkout' — the id is segment 3, not
      // the last segment (that is 'checkout').
      const id = u.pathname.split('/')[3];
      const items = baskets[id] || [];
      const charged = totalOf(items);
      // Order completion decrements stock by the ordered quantity —
      // this is what drains the cheapest product over many hunts.
      for (const i of items) stock[i.productId] = (stock[i.productId] ?? 0) - i.quantity;
      baskets[id] = [];
      return json(200, { status: 'success', data: { orderId: nextOrderId++, totalPrice: charged } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state: { stock, baskets, calls }, fetchFn };
}

describe('basket seed/control stock failure — live regression, proof #40 10 Nov 2026', () => {
  it('BC-1 REPRO+FIX: basket-logic seeds past the out-of-stock cheapest product and fires', async () => {
    const { fetchFn } = makeStockFake();
    const diag = {};
    const findings = await probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `basket-logic must fire once; got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /negative quantity/);
    assert.equal(diag.controlOk, true, 'the +1 control must pass on the seeded product');
    assert.equal(diag.seedAttempts, 2, 'product 9 refused (400 out-of-stock), product 1 added');
    assert.equal(diag.seedProductId, 1, 'the seed fell through to the first addable product');
    assert.equal(diag.mutations, 2, 'sequential-equivalent: -1 and 0 set, HUGE rejected');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1, 'the fired finding verifies as confirmed through the real pipeline');
  });

  it('BC-2 REPRO+FIX: business-flow-access seeds past the out-of-stock cheapest product and fires', async () => {
    const { fetchFn } = makeStockFake();
    const diag = {};
    const findings = await probeBusinessFlowAccess(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `business-flow-access must fire once; got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /another user's basket readable/);
    assert.equal(diag.registerOk, true, 'the canary registration itself works — the seed was the failure');
    assert.equal(diag.victimSeeded, true, 'the victim basket was empty and had to be seeded');
    assert.equal(diag.seedProductId, 1, 'the victim seed fell through to the first addable product');
    assert.equal(diag.bypassKind, 'cross-user-basket-read');
  });

  it('BC-3 REPRO+FIX: basket-logic with a leftover out-of-stock item resets the canary and fires', async () => {
    const { fetchFn } = makeStockFake({
      initialBasket7: [{ basketItemId: '11', productId: 9, quantity: 1, unitPrice: 0.01 }],
    });
    const diag = {};
    const findings = await probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `basket-logic must fire once; got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /negative quantity/);
    assert.equal(diag.controlOk, true, 'the control must pass after the reset-and-reseed');
    assert.equal(diag.controlReset, true, 'the first control failed on the leftover item and triggered a reset');
    assert.equal(diag.seedProductId, 1, 'the re-seed fell through to the first addable product');
  });

  it('BC-4 FIX: every product out of stock bails honestly with the stage named', async () => {
    const { fetchFn } = makeStockFake({ stocks: { 9: -1, 1: 0, 2: 0 } });
    const diag = {};
    const findings = await probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, [], 'no product can seed — the probe must return [], never a guess');
    assert.equal(diag.bailStage, 'seed', 'the phase record must name the seed as the failing stage');
    assert.equal(diag.seedAttempts, 3, 'all three products were tried');
  });

  it('BC-5 FIX: workflow-skip seeds past the out-of-stock cheapest product and fires', async () => {
    const { fetchFn } = makeStockFake();
    const diag = {};
    const findings = await probeWorkflowSkip(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `workflow-skip must fire once; got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /checkout accepted for an empty basket/);
    assert.equal(diag.seedProductId, 1, 'the seed fell through to the first addable product');
  });
});
