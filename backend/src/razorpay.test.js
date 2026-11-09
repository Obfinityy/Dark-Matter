// Razorpay auto-payment — unit tests (node --test).
// DATA_DIR is pointed at a temp dir BEFORE importing the modules, because
// config.js reads it at module-eval time. No network is touched: the
// Razorpay API calls are never made here (no keys set), and the webhook
// signature tests use a locally computed HMAC.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-razorpay-test-'));
process.env.DATA_DIR = tmp;
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;

const {
  RAZORPAY_AMOUNT_PAISE,
  RAZORPAY_CURRENCY,
  isRazorpayConfigured,
  createRazorpayOrder,
  fetchRazorpayOrder,
  verifyWebhookSignature,
  RazorpayError,
} = await import('./razorpayClient.js');
const {
  createOrderRecord,
  findOrderByRazorpayId,
  activateOrderPayment,
  markOrderFailed,
} = await import('./razorpayOrders.js');
const { writeUsers, readUsers } = await import('./store.js');

const DAY = 24 * 3600 * 1000;
const SECRET = 'whsec_test_secret_123';

function seedUsers() {
  writeUsers({
    alice: { id: 'user-1', username: 'alice', salt: 'aa', passHash: 'bb', role: 'user', control: 'minimal', approved: false },
    bob: { id: 'user-2', username: 'bob', salt: 'aa', passHash: 'bb', role: 'user', control: 'minimal', approved: false },
  });
}

function sign(body, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('hex');
}

test('amount is exactly Rs 10,000 in paise, INR', () => {
  assert.equal(RAZORPAY_AMOUNT_PAISE, 1000000);
  assert.equal(RAZORPAY_CURRENCY, 'INR');
});

test('without env vars the client reports unconfigured and never calls the network', async () => {
  assert.equal(isRazorpayConfigured(), false);
  await assert.rejects(
    () => createRazorpayOrder({ userId: 'user-1', username: 'alice', receipt: 'dm-x' }),
    (e) => e instanceof RazorpayError && e.code === 'razorpay_not_configured'
  );
  await assert.rejects(
    () => fetchRazorpayOrder('order_test123'),
    (e) => e instanceof RazorpayError && e.code === 'razorpay_not_configured'
  );
});

test('webhook signature: correct HMAC passes, everything else fails closed', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } } });
  const good = sign(body);
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), good, SECRET), true);
  assert.equal(verifyWebhookSignature(body, good, SECRET), true); // string body also works
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), good, 'wrong-secret'), false);
  assert.equal(verifyWebhookSignature(Buffer.from(body + ' ', 'utf8'), good, SECRET), false); // tampered body
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), sign(body, 'other-secret'), SECRET), false);
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), '', SECRET), false); // missing signature
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), null, SECRET), false);
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), good, ''), false); // missing secret
  assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), good.toUpperCase(), SECRET), false); // case matters
});

test('order record: create + find, unknown order returns null', () => {
  const rec = createOrderRecord({ userId: 'user-1', username: 'alice', orderId: 'order_razor1', amountPaise: 1000000, currency: 'INR', receipt: 'dm-r1' });
  assert.equal(rec.status, 'created');
  assert.equal(rec.orderId, 'order_razor1');
  assert.equal(rec.userId, 'user-1');
  assert.equal(findOrderByRazorpayId('order_razor1').id, rec.id);
  assert.equal(findOrderByRazorpayId('order_nope'), null);
});

test('activateOrderPayment: grants 1 day via the same grantAccess path, then is idempotent', () => {
  seedUsers();
  const before = Date.now();
  const first = activateOrderPayment('order_razor1', 'pay_abc123');
  const after = Date.now();
  assert.equal(first.alreadyHandled, false);
  const untilMs = new Date(first.accessUntil).getTime();
  assert.ok(untilMs >= before + DAY && untilMs <= after + DAY);
  const user = readUsers().alice;
  assert.equal(user.approved, true);
  assert.equal(user.accessUntil, first.accessUntil);
  assert.ok(user.approvedAt);
  // Same payment id again: no second activation, access NOT extended.
  const second = activateOrderPayment('order_razor1', 'pay_abc123');
  assert.equal(second.alreadyHandled, true);
  assert.equal(second.accessUntil, first.accessUntil);
  assert.equal(readUsers().alice.accessUntil, first.accessUntil);
  // A different payment id on an already-paid order throws.
  assert.throws(() => activateOrderPayment('order_razor1', 'pay_other999'), /order_already_paid_by_another_payment/);
});

test('activateOrderPayment: unknown order and missing user throw', () => {
  assert.throws(() => activateOrderPayment('order_nope', 'pay_x'), /order_not_found/);
  createOrderRecord({ userId: 'ghost-1', username: 'ghost', orderId: 'order_ghost', amountPaise: 1000000, currency: 'INR', receipt: 'dm-g' });
  assert.throws(() => activateOrderPayment('order_ghost', 'pay_ghost'), /user_not_found/);
});

test('markOrderFailed: failed on a created order, never un-pays a paid order', () => {
  createOrderRecord({ userId: 'user-2', username: 'bob', orderId: 'order_fail1', amountPaise: 1000000, currency: 'INR', receipt: 'dm-f1' });
  const failed = markOrderFailed('order_fail1');
  assert.equal(failed.status, 'failed');
  assert.equal(markOrderFailed('order_nope'), null);
  const stillPaid = markOrderFailed('order_razor1');
  assert.equal(stillPaid.status, 'paid');
  assert.equal(stillPaid.paymentId, 'pay_abc123');
});
