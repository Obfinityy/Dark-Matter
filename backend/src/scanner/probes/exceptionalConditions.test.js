// Tests for the exceptional-conditions probe
// (coverage row #482 [Medium] Mishandling of Exceptional
// Conditions, CWE-703 / CWE-636 | OWASP A10:2025; phase 103,
// 'exceptional-conditions').
//
// The probe runs a control + two legs against a stateful fake
// Juice Shop: login returns a token + basket id, GET /rest/basket/:id
// returns the basket ledger, POST /api/BasketItems adds an item,
// PUT /api/BasketItems/:id sets its quantity. Behaviour flags flip
// the fake between a fail-open shop and a safe one:
// acceptVariantValues (which exceptional quantities the ADD
// endpoint applies), acceptUpdateVariants (the UPDATE endpoint
// applies them), silentDrop (a variant answers 2xx but changes
// nothing), crashVariants (a variant answers 500 with a stack
// trace), controlBroken, emptyBasket, loginWithoutBid.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeExceptionalConditions,
  EXCEPTIONAL_QUANTITIES,
  assessExceptionalControl,
  assessExceptionalVariant,
  assessExceptionalInconsistency,
  __exceptionalMeta,
} from './exceptionalConditions.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/basket/dmprobe1_ab12',
  'http://lab.local/api/BasketItems',
  'http://lab.local/api/BasketItems/dmprobe3_ef56',
  'http://lab.local/rest/basket/dmprobe1_ab12/checkout',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Products',
  'http://other.local/api/BasketItems',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behaviour flags: acceptVariantValues (array of exceptional values
// the ADD endpoint applies — [] means every variant is rejected
// with 400), acceptUpdateVariants, silentDrop, crashVariants,
// controlBroken (control add answers 2xx but the basket never
// moves), emptyBasket (seed path), loginWithoutBid (whoami fallback).
function makeFakeJuice(behavior = {}) {
  const accepted = new Set(behavior.acceptVariantValues || []);
  const state = {
    items: behavior.emptyBasket
      ? []
      : [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    calls: [],
  };
  const itemTotal = (i) => {
    const q = Number(i.quantity);
    return Number.isFinite(q) ? q * i.unitPrice : null;
  };
  const total = () =>
    state.items.reduce((a, i) => {
      const t = itemTotal(i);
      return a + (t == null ? 0 : t);
    }, 0);
  const basketBody = () => ({
    status: 'success',
    data: {
      id: 7,
      Products: state.items.map((i) => ({
        id: i.productId,
        name: `Product ${i.productId}`,
        price: i.unitPrice,
        totalPrice: itemTotal(i),
        BasketItem: { id: Number(i.basketItemId), quantity: i.quantity, BasketId: 7, ProductId: i.productId },
      })),
      totalPrice: total(),
    },
  });
  const isVariant = (qty) =>
    EXCEPTIONAL_QUANTITIES.some((v) => Object.is(v.value, qty) || v.value === qty);
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
      const qty = body ? body.quantity : undefined;
      if (pid == null) return json(400, { status: 'error' });
      if (qty === 1) {
        if (behavior.controlBroken) return json(201, { status: 'success', data: { id: 99 } });
        const existing = state.items.find((i) => String(i.productId) === String(pid));
        if (existing) {
          existing.quantity = Number(existing.quantity) + 1;
        } else {
          state.items.push({
            basketItemId: String(state.nextItemId++),
            productId: pid,
            quantity: 1,
            unitPrice: 1.99,
          });
        }
        return json(201, { status: 'success', data: { id: state.nextItemId - 1 } });
      }
      if (!isVariant(qty)) return json(400, { status: 'error' });
      if (behavior.crashVariants) {
        return json(500, {
          status: 'error',
          message: 'TypeError: Cannot read properties of undefined (reading \'toFixed\')\n    at /app/src/controllers/basket.js:42:17',
        });
      }
      if (behavior.silentDrop) return json(201, { status: 'success', data: { id: 98 } });
      if (!accepted.has(qty)) return json(400, { status: 'error', message: 'quantity must be a positive integer' });
      state.items.push({
        basketItemId: String(state.nextItemId++),
        productId: pid,
        quantity: qty,
        unitPrice: 1.99,
      });
      return json(201, { status: 'success', data: { id: state.nextItemId - 1 } });
    }
    if (method === 'PUT' && /^\/api\/BasketItems\/\d+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop();
      const item = state.items.find((i) => String(i.basketItemId) === String(id));
      if (!item) return json(404, { status: 'error' });
      const qty = body ? body.quantity : undefined;
      if (qty === 0) {
        state.items = state.items.filter((i) => String(i.basketItemId) !== String(id));
        return json(200, { status: 'success', data: { id: Number(id) } });
      }
      if (isVariant(qty)) {
        if (!behavior.acceptUpdateVariants) {
          return json(400, { status: 'error', message: 'quantity must be a positive integer' });
        }
        item.quantity = qty;
        return json(200, { status: 'success', data: { id: Number(id) } });
      }
      if (typeof qty !== 'number' || !Number.isFinite(qty)) return json(400, { status: 'error' });
      item.quantity = qty;
      return json(200, { status: 'success', data: { id: Number(id) } });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- the variant list + the oracles -----------------------------------------

describe('EXCEPTIONAL_QUANTITIES / assessExceptionalControl / assessExceptionalVariant / assessExceptionalInconsistency', () => {
  it('EC-1: four type-confusion variants — a string, a fraction, null, a beyond-safe-integer', () => {
    assert.equal(EXCEPTIONAL_QUANTITIES.length, 4);
    assert.equal(EXCEPTIONAL_QUANTITIES[0].value, 'abc');
    assert.equal(EXCEPTIONAL_QUANTITIES[1].value, 1.5);
    assert.equal(EXCEPTIONAL_QUANTITIES[2].value, null);
    assert.equal(EXCEPTIONAL_QUANTITIES[3].value, 9007199254740993);
    for (const v of EXCEPTIONAL_QUANTITIES) {
      assert.equal(typeof v.label, 'string');
      assert.ok(v.label.length > 0);
    }
  });
  it('EC-2: control confirmed when the basket moves, rejected when it does not, unconfirmed when unreadable', () => {
    assert.equal(assessExceptionalControl({ items: 0, total: 0 }, { items: 1, total: 1.99 }).verdict, 'confirmed');
    assert.equal(assessExceptionalControl({ items: 1, total: 1.99 }, { items: 1, total: 3.98 }).verdict, 'confirmed');
    assert.equal(assessExceptionalControl({ items: 1, total: 1.99 }, { items: 1, total: 1.99 }).verdict, 'rejected');
    assert.equal(assessExceptionalControl(null, { items: 1, total: 1.99 }).verdict, 'unconfirmed');
  });
  it('EC-3: variant confirmed only on 2xx + state change; silent drop and 4xx reject; 5xx and no control stay unconfirmed', () => {
    assert.equal(assessExceptionalVariant('confirmed', 201, true).verdict, 'confirmed');
    assert.equal(assessExceptionalVariant('confirmed', 200, true).verdict, 'confirmed');
    assert.equal(assessExceptionalVariant('confirmed', 201, false).verdict, 'rejected');
    assert.equal(assessExceptionalVariant('confirmed', 400, false).verdict, 'rejected');
    assert.equal(assessExceptionalVariant('confirmed', 422, false).verdict, 'rejected');
    assert.equal(assessExceptionalVariant('confirmed', 500, true).verdict, 'unconfirmed');
    assert.equal(assessExceptionalVariant('confirmed', 500, false).verdict, 'unconfirmed');
    assert.equal(assessExceptionalVariant('rejected', 201, true).verdict, 'unconfirmed');
    assert.equal(assessExceptionalVariant('unconfirmed', 201, true).verdict, 'unconfirmed');
  });
  it('EC-4: inconsistency confirmed only when add rejects and update accepts with a state change', () => {
    assert.equal(assessExceptionalInconsistency(400, 200, true).verdict, 'confirmed');
    assert.equal(assessExceptionalInconsistency(422, 200, true).verdict, 'confirmed');
    assert.equal(assessExceptionalInconsistency(400, 400, false).verdict, 'rejected');
    assert.equal(assessExceptionalInconsistency(400, 200, false).verdict, 'rejected');
    assert.equal(assessExceptionalInconsistency(200, 200, true).verdict, 'unconfirmed');
    assert.equal(assessExceptionalInconsistency(400, 500, false).verdict, 'unconfirmed');
    assert.equal(assessExceptionalInconsistency(null, 200, true).verdict, 'unconfirmed');
  });
  it('EC-5: phase 103 registration metadata', () => {
    assert.deepEqual(__exceptionalMeta, { phases: ['exceptional-conditions'], depth: ['standard', 'deep'] });
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeExceptionalConditions — fail-open shop', () => {
  it('EC-6: a malformed string quantity accepted by the add endpoint fires the fail-open finding exactly once', async () => {
    const { state, fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc', 1.5, null, 9007199254740993] });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /malformed quantity accepted into the basket workflow/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(findings[0].parameter, 'quantity');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.basketRoutes, 1);
    assert.equal(diag.failOpenKind, 'accepted');
    assert.ok(diag.attempts >= 1, 'at least the confirming variant must run');
    // The basket id in every basket call is the canary's own (7) —
    // never a mined filler id, never another user's basket.
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket GET must use id 7');
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('EC-7: when only the fractional quantity is accepted, the probe tries the string first and confirms on 1.5', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: [1.5] });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /malformed quantity accepted into the basket workflow/);
    assert.match(findings[0].evidence.request, /1\.5 \(fractional quantity\)/);
    assert.equal(diag.failOpenKind, 'accepted');
    assert.equal(diag.attempts, 2, 'the rejected string variant plus the accepted fractional one');
  });
  it('EC-8: add rejects every variant but update accepts one — the inconsistency finding fires', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: [], acceptUpdateVariants: true });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /handled inconsistently across basket endpoints/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(diag.failOpenKind, 'inconsistent');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.variantsTried, 4, 'all four variants must be tried on the add endpoint first');
    assert.equal(diag.attempts, 5, 'four variant adds plus the sibling update');
  });
  it('EC-9: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'] });
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('EC-10: an empty basket is seeded by the control add, then the fail-open finding fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'], emptyBasket: true });
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /malformed quantity accepted into the basket workflow/);
    assert.ok(state.calls.some((c) => c === 'GET /api/Products'), 'seed path must fetch the product list');
  });
  it('EC-11: login without a basket id falls back to the whoami user id', async () => {
    const { state, fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'], loginWithoutBid: true });
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.ok(state.calls.some((c) => c === 'GET /rest/user/whoami'), 'whoami fallback must run');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket id must come from whoami');
  });
});

describe('probeExceptionalConditions — safe shop', () => {
  it('EC-12: every variant rejected on both endpoints yields zero findings (proven true negative)', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: [], acceptUpdateVariants: false });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.variantsTried, 4);
    assert.equal(diag.failOpenKind, undefined);
  });
  it('EC-13: a variant answered 2xx with no state change is a silent drop, never a finding', async () => {
    const { fetchFn } = makeFakeJuice({ silentDrop: true });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.variantsTried, 4);
  });
  it('EC-14: a variant crashing with 500 + stack trace is recorded, never confirmed (error-disclosure territory)', async () => {
    const { fetchFn } = makeFakeJuice({ crashVariants: true });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.crashResponses, 4);
    assert.equal(diag.variantsTried, 4);
  });
  it('EC-15: no basket item route yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'] });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
      apiRoutes: ROUTES.filter((r) => !r.includes('/api/BasketItems')),
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.basketRoutes, 0);
  });
  it('EC-16: a broken control (add answers 2xx, basket never moves) yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ controlBroken: true });
    const diag = {};
    const findings = await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
  it('EC-17: no product list yields zero findings (nothing to calibrate the control with)', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'] });
    const findings = await probeExceptionalConditions('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ROUTES.filter((r) => !r.includes('/api/Products')),
    });
    assert.deepEqual(findings, []);
  });
});

describe('probeExceptionalConditions — gates', () => {
  it('EC-18: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice({ acceptVariantValues: ['abc'] });
    assert.deepEqual(await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeExceptionalConditions('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
});
