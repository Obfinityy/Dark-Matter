/**
 * billingTopup.test.js — Infinity Credits top-up flow.
 *
 * Covers: creditStore (paise-safe arithmetic, persistence), the new
 * POST /billing/topup/order validation, POST /billing/topup/verify crediting,
 * GET /billing/balance + status balance, and the pre-existing tier endpoints
 * (regression: they must keep working unchanged).
 *
 * Razorpay network calls are mocked — no live checkout happens here.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCreditStore } from '../src/services/creditStore.js';
import {
  createBillingController,
  TOPUP_MIN_INR,
  TOPUP_MAX_INR,
} from '../src/controllers/billingController.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
}

function mockStore() {
  const balances = new Map();
  return {
    getBalanceInr(id) {
      return (balances.get(String(id)) || 0) / 100;
    },
    addCreditsInr(id, amountInr) {
      const paise = Math.round(amountInr * 100);
      const key = String(id);
      balances.set(key, (balances.get(key) || 0) + paise);
      return this.getBalanceInr(key);
    },
  };
}

function mockRazorpay(overrides = {}) {
  return {
    isConfigured: () => true,
    publicKeyId: () => 'rzp_test_key',
    createOrder: async ({ amountPaise }) => ({
      id: 'order_test1',
      amount: amountPaise,
      currency: 'INR',
    }),
    verifySignature: () => true,
    fetchPayment: async (id) => ({
      id,
      status: 'captured',
      amount: 50000,
      order_id: 'order_test1',
    }),
    ...overrides,
  };
}

function makeController({ razorpay, store } = {}) {
  return createBillingController({
    userModel: null,
    creditStore: store || mockStore(),
    razorpay: razorpay || mockRazorpay(),
  });
}

describe('creditStore', () => {
  test('starts at zero and tracks balances in paise', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'credits-')), 'credits.json');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('u1'), 0);
    assert.equal(store.addCreditsInr('u1', 500), 500);
    assert.equal(store.getBalanceInr('u1'), 500);
    assert.equal(store.addCreditsInr('u1', 250.5), 750.5);
    assert.equal(store.getBalanceInr('u2'), 0);
  });

  test('persists balances across instances', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'credits-')), 'credits.json');
    const a = createCreditStore({ filePath: file });
    a.addCreditsInr('user-9', 1234);
    assert.ok(fs.existsSync(file), 'credits file is written');
    const b = createCreditStore({ filePath: file });
    assert.equal(b.getBalanceInr('user-9'), 1234);
  });

  test('corrupt file starts empty instead of crashing', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'credits-')), 'credits.json');
    fs.writeFileSync(file, 'not json {{{');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('anyone'), 0);
  });

  test('rejects invalid credit amounts', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'credits-')), 'credits.json');
    const store = createCreditStore({ filePath: file });
    for (const bad of [0, -5, NaN, Infinity, '100', null]) {
      assert.throws(() => store.addCreditsInr('u1', bad), /Invalid credit amount/);
    }
  });
});

describe('POST /billing/topup/order', () => {
  const invalidAmounts = [
    undefined,
    null,
    '500', // must be a number, not a string
    9,
    0,
    -50,
    9.99,
    500.5, // whole rupees only
    NaN,
    Infinity,
    true,
    TOPUP_MAX_INR + 1,
  ];

  for (const amountInr of invalidAmounts) {
    test(`rejects invalid amountInr=${JSON.stringify(amountInr)}`, async () => {
      const c = makeController();
      const res = mockRes();
      await c.createTopupOrder({ body: { amountInr }, user: { id: 'u1' } }, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /Invalid amount/);
    });
  }

  test('accepts the bounds: min ₹10, default ₹500, max ₹1,00,000', async () => {
    for (const amountInr of [TOPUP_MIN_INR, 500, TOPUP_MAX_INR]) {
      const c = makeController();
      const res = mockRes();
      await c.createTopupOrder({ body: { amountInr }, user: { id: 'u1' } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.orderId, 'order_test1');
      assert.equal(res.body.amount, amountInr * 100);
      assert.equal(res.body.currency, 'INR');
      assert.equal(res.body.keyId, 'rzp_test_key');
      assert.ok(!('keySecret' in res.body), 'no secret leaks to frontend');
    }
  });

  test('order is created at the server-validated amount, tier=type topup', async () => {
    let seen = null;
    const rz = mockRazorpay({
      createOrder: async (opts) => {
        seen = opts;
        return { id: 'order_x', amount: opts.amountPaise, currency: 'INR' };
      },
    });
    const c = makeController({ razorpay: rz });
    const res = mockRes();
    await c.createTopupOrder({ body: { amountInr: 250 }, user: { id: 'user-7' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, { amountPaise: 25000, tierId: 'topup', userId: 'user-7' });
  });
});

describe('POST /billing/topup/verify', () => {
  const goodBody = () => ({
    orderId: 'order_test1',
    paymentId: 'pay_test1',
    signature: 'valid-signature',
  });

  test('rejects signature mismatch', async () => {
    const c = makeController({ razorpay: mockRazorpay({ verifySignature: () => false }) });
    const res = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
  });

  test('rejects uncaptured payments', async () => {
    const c = makeController({
      razorpay: mockRazorpay({
        fetchPayment: async (id) => ({ id, status: 'failed', amount: 50000, order_id: 'order_test1' }),
      }),
    });
    const res = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /not captured/);
  });

  test('rejects payment for a different order', async () => {
    const c = makeController({
      razorpay: mockRazorpay({
        fetchPayment: async (id) => ({ id, status: 'captured', amount: 50000, order_id: 'order_other' }),
      }),
    });
    const res = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 400);
  });

  test('credits the captured amount to the user wallet', async () => {
    const store = mockStore();
    const c = makeController({ store });
    const res = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.creditedInr, 500);
    assert.equal(res.body.creditBalanceInr, 500);
    assert.equal(store.getBalanceInr('u1'), 500);

    // A second top-up accumulates.
    const res2 = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res2);
    assert.equal(res2.body.creditBalanceInr, 1000);
  });

  test('accepts authorized (not yet captured) payments', async () => {
    const c = makeController({
      razorpay: mockRazorpay({
        fetchPayment: async (id) => ({ id, status: 'authorized', amount: 1000, order_id: 'order_test1' }),
      }),
    });
    const res = mockRes();
    await c.verifyTopup({ body: goodBody(), user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.creditedInr, 10);
  });
});

describe('balance + status', () => {
  test('GET /billing/balance returns creditBalanceInr', async () => {
    const store = mockStore();
    store.addCreditsInr('u1', 750);
    const c = makeController({ store });
    const res = mockRes();
    await c.balance({ user: { id: 'u1' } }, res);
    assert.deepEqual(res.body, { creditBalanceInr: 750 });
  });

  test('GET /billing/status includes creditBalanceInr', async () => {
    const store = mockStore();
    store.addCreditsInr('u1', 42);
    const c = makeController({ store });
    const res = mockRes();
    await c.status({ user: { id: 'u1' } }, res);
    assert.equal(res.body.configured, true);
    assert.equal(res.body.keyId, 'rzp_test_key');
    assert.equal(res.body.creditBalanceInr, 42);
    assert.ok(Array.isArray(res.body.tiers));
  });
});

describe('existing tier endpoints (regression)', () => {
  test('tier order still works', async () => {
    const c = makeController();
    const res = mockRes();
    await c.createOrder({ body: { tierId: 'low' }, user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.order);
    assert.equal(res.body.keyId, 'rzp_test_key');
  });

  test('unknown tier still rejected', async () => {
    const c = makeController();
    const res = mockRes();
    await c.createOrder({ body: { tierId: 'nope' }, user: { id: 'u1' } }, res);
    assert.equal(res.statusCode, 400);
  });

  test('tier verify still works', async () => {
    const c = makeController({
      // Mock payment must match the server-side price for the 'low' tier (₹1,699).
      razorpay: mockRazorpay({
        fetchPayment: async (id) => ({ id, status: 'captured', amount: 169900, order_id: 'order_test1' }),
      }),
    });
    const res = mockRes();
    await c.verify(
      { body: { orderId: 'order_test1', paymentId: 'pay_test1', signature: 'sig', tierId: 'low' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
  });
});
