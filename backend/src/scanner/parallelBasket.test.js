// Tests for the parallel-execution basket interference (10 Nov 2026).
//
// LIVE REGRESSION: the parallel Juice re-proof (hunt h_e8cde467e17b,
// 122nd deploy) finished 29/0 against 30/0 sequential (proofs
// #38/#39). The only missing title was "Business logic — negative
// quantity reduces the basket total (HIGH)". Phase evidence: the
// basket-logic phase ran ok but recorded mutations 0 / findingsCount
// 0 (sequential: mutations 2 / findingsCount 1) and OVERLAPPED
// workflow-skip, whose control checkout CONSUMES the shared canary
// basket by design. Both probes log in as the same labCreds account,
// so they share one basket — workflow-skip's checkout emptied it
// while basket-logic was mid-mutation, and basket-logic's edge PUTs
// 404'd on the vanished item.
//
// The fake below models Juice faithfully where it matters: checkout
// EMPTIES the basket, a PUT to a missing item 404s, a POST add with
// a non-positive or huge quantity is rejected (the parallel run's
// mutations stayed 0 despite the add fallback, so the real shop
// rejects negative adds), and a PUT with a huge quantity is
// rejected. The `interleave` mode adds two gates that pin the exact
// production interleaving — the checkout waits until basket-logic's
// +1 control has been READ BACK, and basket-logic's -1 edge PUT
// waits until the checkout has landed — so PB-1 reproduces the
// production failure deterministically instead of relying on racy
// timing. No network, no lab: the probes talk to the shop only
// through the opts.fetchFn seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runPhaseTasks } from './parallel.js';
import { probeBasketLogic } from './probes/basketLogic.js';
import { probeWorkflowSkip } from './probes/workflowSkip.js';
import { probeBusinessFlowAccess } from './probes/businessFlowAccess.js';
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A gate that never hangs the test: resolves when released, or after
// ms when the release never comes (the test then fails on its
// assertions, not on a hang).
function makeGate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return {
    promise,
    release,
    wait: (ms) => Promise.race([promise, sleep(ms).then(() => 'timeout')]),
  };
}

// Stateful fake Juice. `interleave` enables the production-overlap
// gates (see the file header). Behaviour is the vulnerable shop:
// negative quantities accepted on PUT, empty-basket checkout
// creates a fresh order, a canary token reads the victim basket.
function makeFakeJuice({ interleave = false } = {}) {
  const state = {
    items: [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    nextOrderId: 99,
    calls: [],
    controlMutated: false,
  };
  const controlDone = makeGate();
  const checkoutSeen = makeGate();
  const total = () => state.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
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
      totalPrice: items.reduce((a, i) => a + i.quantity * i.unitPrice, 0),
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
    const callLabel =
      method === 'PUT' && /^\/api\/BasketItems\/\d+$/.test(u.pathname)
        ? `${method} ${u.pathname} qty=${body ? body.quantity : '?'}`
        : `${method} ${u.pathname}`;
    state.calls.push(callLabel);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });

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
      if (interleave && state.controlMutated) controlDone.release();
      if (id === '7') return json(200, basketBody(7, state.items));
      if (id === '8') return json(200, basketBody(8, []));
      return json(404, { status: 'error' });
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
      if (!token) return json(401, { status: 'error' });
      const pid = body ? body.ProductId ?? body.productId : null;
      if (pid == null || !Number.isFinite(qty)) return json(400, { status: 'error' });
      // The real shop rejects non-positive and huge quantities on
      // ADD (the parallel run's mutations stayed 0 despite the add
      // fallback, so the add path never rescued the lost PUT).
      if (qty <= 0 || qty >= HUGE_QTY) return json(400, { status: 'error', message: 'quantity must be positive' });
      if (interleave && qty === 1 && state.items.some((i) => String(i.productId) === String(pid))) {
        state.controlMutated = true;
      }
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
      if (!token) return json(401, { status: 'error' });
      const id = u.pathname.split('/').pop();
      let item = state.items.find((i) => String(i.basketItemId) === String(id));
      if (!item) return json(404, { status: 'error' });
      if (!Number.isFinite(qty)) return json(400, { status: 'error' });
      if (interleave && qty === 2) state.controlMutated = true;
      if (interleave && qty === -1) {
        // The production interleaving: the -1 edge runs only after
        // the checkout has landed — then the item is gone.
        await checkoutSeen.wait(2000);
        item = state.items.find((i) => String(i.basketItemId) === String(id));
        if (!item) return json(404, { status: 'error' });
      }
      if (qty >= HUGE_QTY) return json(400, { status: 'error', message: 'quantity too large' });
      item.quantity = qty;
      return json(200, { status: 'success', data: { id: Number(id) } });
    }
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      if (!token) return json(401, { status: 'error' });
      if (interleave) {
        // The production interleaving: the checkout waits until the
        // +1 control has been read back, then consumes the basket
        // while basket-logic is still in its edge mutations.
        await controlDone.wait(2000);
        checkoutSeen.release();
      }
      if (state.items.length === 0) {
        return json(200, { status: 'success', data: { orderId: state.nextOrderId++, totalPrice: 0 } });
      }
      const charged = total();
      state.items = [];
      return json(200, { status: 'success', data: { orderId: state.nextOrderId++, totalPrice: charged } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

describe('parallel basket interference — live regression 10 Nov 2026', () => {
  it('PB-1 REPRO: basket-logic + workflow-skip concurrent WITHOUT exclusivity loses the negative-quantity finding', async () => {
    const { state, fetchFn } = makeFakeJuice({ interleave: true });
    const blDiag = {};
    const wsDiag = {};
    const tasks = [
      {
        name: 'basket-logic',
        run: () => probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: blDiag }),
      },
      {
        name: 'workflow-skip',
        run: () => probeWorkflowSkip(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: wsDiag }),
      },
    ];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2 });
    assert.ok(outcomes.every((o) => o.ok), 'neither probe may throw — the loss is silent, not an error');
    const blFindings = outcomes[0].value;
    const wsFindings = outcomes[1].value;
    assert.deepEqual(blFindings, [], 'basket-logic must find nothing when the checkout lands mid-mutation');
    assert.equal(blDiag.controlOk, true, 'the +1 control passed before the checkout landed (production phase record)');
    assert.equal(blDiag.mutations, 0, 'every edge mutation failed at the HTTP level (production phase record)');
    assert.equal(wsFindings.length, 1, 'workflow-skip still fires — it is the interferer, not the victim');
    assert.match(wsFindings[0].title, /checkout accepted for an empty basket/);
    // The call log proves the interleaving: control PUT, then the
    // checkout, then the -1 edge PUT against the consumed basket.
    const idx = (label) => state.calls.findIndex((c) => c === label);
    const controlIdx = idx('PUT /api/BasketItems/11 qty=2');
    const checkoutIdx = idx('POST /rest/basket/7/checkout');
    const edgeIdx = idx('PUT /api/BasketItems/11 qty=-1');
    assert.ok(controlIdx >= 0 && checkoutIdx >= 0 && edgeIdx >= 0, `call log must show all three steps; got: ${state.calls.join(' | ')}`);
    assert.ok(controlIdx < checkoutIdx && checkoutIdx < edgeIdx, 'checkout must land between the control and the -1 edge');
  });

  it('PB-2 FIX: the same pair WITH the lab-basket exclusive key keeps both findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const blDiag = {};
    const wsDiag = {};
    const tasks = [
      {
        name: 'basket-logic',
        exclusive: 'lab-basket',
        run: () => probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: blDiag }),
      },
      {
        name: 'workflow-skip',
        exclusive: 'lab-basket',
        run: () => probeWorkflowSkip(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: wsDiag }),
      },
    ];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2 });
    assert.ok(outcomes.every((o) => o.ok));
    const blFindings = outcomes[0].value;
    const wsFindings = outcomes[1].value;
    assert.equal(blFindings.length, 1, `basket-logic must fire once; got: ${blFindings.map((f) => f.title).join(' | ')}`);
    assert.match(blFindings[0].title, /negative quantity/);
    assert.equal(blDiag.mutations, 2, 'sequential-equivalent: -1 and 0 set, HUGE rejected (production sequential: mutations 2)');
    const { confirmed } = verifyFindings(blFindings);
    assert.equal(confirmed.length, 1, 'the fired finding verifies as confirmed through the real pipeline');
    assert.equal(wsFindings.length, 1);
    assert.match(wsFindings[0].title, /checkout accepted for an empty basket/);
  });

  it('PB-3 FIX: basket-logic + business-flow-access WITH the exclusive key keeps both findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const blDiag = {};
    const bfaDiag = {};
    const tasks = [
      {
        name: 'basket-logic',
        exclusive: 'lab-basket',
        run: () => probeBasketLogic(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: blDiag }),
      },
      {
        name: 'business-flow-access',
        exclusive: 'lab-basket',
        run: () => probeBusinessFlowAccess(TARGET_URL, { ...BASE_OPTS, fetchFn, diagnostics: bfaDiag }),
      },
    ];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2 });
    assert.ok(outcomes.every((o) => o.ok));
    const blFindings = outcomes[0].value;
    const bfaFindings = outcomes[1].value;
    assert.equal(blFindings.length, 1, `basket-logic must fire once; got: ${blFindings.map((f) => f.title).join(' | ')}`);
    assert.match(blFindings[0].title, /negative quantity/);
    assert.equal(bfaFindings.length, 1, `business-flow-access must fire once; got: ${bfaFindings.map((f) => f.title).join(' | ')}`);
    assert.match(bfaFindings[0].title, /another user's basket readable/);
    assert.equal(bfaDiag.bypassKind, 'cross-user-basket-read');
  });
});
