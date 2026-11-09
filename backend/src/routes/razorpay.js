// Razorpay auto-payment routes — issue #491 (owner order 9 Nov 2026).
//
//   POST /api/v1/payments/razorpay/create-order -> {ok, orderId, keyId, amountPaise, currency} (login, OR username+password for pending users)
//   POST /api/v1/payments/razorpay/webhook      -> Razorpay webhook (NO auth header — the HMAC signature IS the auth)
//   GET  /api/v1/payments/razorpay/order/:orderId -> {ok, status, paid, accessUntil} (polling fallback; the order id is unguessable)
//
// MOUNTING (server.js): this router is mounted BEFORE the global
// express.json() middleware, because the webhook route must read the RAW
// request body to verify the HMAC signature — express.json() would consume
// it. Each route parses its own body: express.raw() for /webhook,
// express.json() for /create-order. GET /order/:orderId needs no body.
//
// TEST MODE ONLY: no live keys, no real money. All Razorpay config comes
// from RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.
// The manual UPI flow (routes/payments.js) is untouched — it stays as the
// fallback until the gateway flow is proven live.

import { Router } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import { optionalAuth, resolveClaimUser } from './payments.js';
import { createIpRateLimiter } from './auth.js';
import {
  RAZORPAY_AMOUNT_PAISE,
  RAZORPAY_CURRENCY,
  razorpayConfig,
  isRazorpayConfigured,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  verifyWebhookSignature,
  RazorpayError,
} from '../razorpayClient.js';
import {
  createOrderRecord,
  findOrderByRazorpayId,
  activateOrderPayment,
  markOrderFailed,
} from '../razorpayOrders.js';

const router = Router();

function isBlocked(user) {
  return user.blockedUntil === null || (user.blockedUntil && new Date(user.blockedUntil) > new Date());
}

// Create-order burns one Razorpay API call per attempt, so it is
// rate-limited per IP — same budget as the manual claim endpoint.
const limitCreateOrder = createIpRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

// The frontend polls this after checkout success (every 2s, up to ~60s),
// so the budget is generous per IP but still bounded.
const limitOrderStatus = createIpRateLimiter({ limit: 60, windowMs: 5 * 60 * 1000 });

router.post('/create-order', limitCreateOrder, express.json(), optionalAuth, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'razorpay_not_configured',
        message: 'Razorpay is not configured on this backend yet (test keys). The manual UPI payment still works.',
      });
    }
    const user = resolveClaimUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'auth_required', message: 'Log in, or provide your signup username and password.' });
    }
    if (user.error) {
      const status = user.error === 'missing_credentials' ? 400 : 401;
      return res.status(status).json({
        ok: false,
        error: user.error,
        message: user.error === 'missing_credentials' ? 'Provide {username} and {password}.' : 'Incorrect username or password.',
      });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ ok: false, error: 'admin_no_order', message: 'Admin accounts hunt free and cannot buy access.' });
    }
    if (isBlocked(user)) {
      return res.status(403).json({ ok: false, error: 'account_blocked', message: 'This account is blocked. Contact the administrator.' });
    }
    const receipt = `dm-${crypto.randomUUID()}`;
    const order = await createRazorpayOrder({ userId: user.id, username: user.username, receipt });
    createOrderRecord({
      userId: user.id,
      username: user.username,
      orderId: order.id,
      amountPaise: RAZORPAY_AMOUNT_PAISE,
      currency: RAZORPAY_CURRENCY,
      receipt,
    });
    res.status(201).json({
      ok: true,
      orderId: order.id,
      keyId: razorpayConfig().keyId,
      amountPaise: RAZORPAY_AMOUNT_PAISE,
      currency: RAZORPAY_CURRENCY,
    });
  } catch (err) {
    if (err instanceof RazorpayError) {
      const status = err.code === 'razorpay_not_configured' ? 503 : 502;
      return res.status(status).json({ ok: false, error: err.code, message: err.message });
    }
    console.error('[razorpay] create-order failed:', err.message);
    res.status(502).json({ ok: false, error: 'create_order_failed', message: err.message || 'Could not create the payment order.' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = razorpayConfig().webhookSecret;
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body; // Buffer (express.raw) — the exact bytes Razorpay signed
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.warn('[razorpay] webhook rejected: bad signature');
    return res.status(401).json({ ok: false, error: 'bad_signature' });
  }
  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }
  const type = event && event.event;
  try {
    if (type === 'payment.captured') {
      const pay = event.payload && event.payload.payment && event.payload.payment.entity;
      if (!pay || !pay.order_id || !pay.id) return res.json({ ok: true, ignored: 'malformed_payment' });
      // Our orders are always exactly Rs 10,000 — a captured payment for a
      // different amount is never ours to activate (acknowledge so Razorpay
      // stops retrying; the money itself is a manual follow-up).
      if (pay.amount !== RAZORPAY_AMOUNT_PAISE || pay.currency !== RAZORPAY_CURRENCY) {
        console.warn(`[razorpay] webhook ignored: payment ${pay.id} amount ${pay.amount} ${pay.currency} != expected ${RAZORPAY_AMOUNT_PAISE} ${RAZORPAY_CURRENCY}`);
        return res.json({ ok: true, ignored: 'wrong_amount' });
      }
      const result = activateOrderPayment(pay.order_id, pay.id);
      console.log(`[razorpay] ACTIVATED order ${pay.order_id} payment ${pay.id} alreadyHandled=${result.alreadyHandled} accessUntil=${result.accessUntil}`);
      return res.json({ ok: true, activated: !result.alreadyHandled, alreadyHandled: result.alreadyHandled, accessUntil: result.accessUntil });
    }
    if (type === 'payment.failed') {
      const pay = event.payload && event.payload.payment && event.payload.payment.entity;
      if (pay && pay.order_id) markOrderFailed(pay.order_id);
      return res.json({ ok: true, ignored: 'payment_failed' });
    }
    return res.json({ ok: true, ignored: 'unhandled_event' });
  } catch (err) {
    if (err.message === 'order_not_found') {
      // A captured payment for an order this backend never created (e.g. a
      // stale/test order): acknowledge, activate nothing.
      console.warn('[razorpay] webhook: captured payment for unknown order — ignored');
      return res.json({ ok: true, ignored: 'unknown_order' });
    }
    if (err.message === 'user_not_found') {
      console.error('[razorpay] webhook: captured payment but user record is gone — manual follow-up needed');
      return res.json({ ok: true, ignored: 'user_gone' });
    }
    if (err.message === 'order_already_paid_by_another_payment') {
      console.error('[razorpay] webhook: order already paid by a different payment — manual follow-up needed');
      return res.json({ ok: true, ignored: 'already_paid_other' });
    }
    console.error('[razorpay] webhook failed:', err.message);
    return res.status(502).json({ ok: false, error: 'webhook_failed', message: err.message });
  }
});

router.get('/order/:orderId', limitOrderStatus, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '');
    const record = findOrderByRazorpayId(orderId);
    if (!record) return res.status(404).json({ ok: false, error: 'not_found', message: 'Order not found.' });
    if (record.status === 'paid') {
      return res.json({ ok: true, orderId: record.orderId, status: 'paid', paid: true, accessUntil: record.accessUntil });
    }
    if (!isRazorpayConfigured()) {
      return res.json({ ok: true, orderId: record.orderId, status: record.status, paid: false, accessUntil: null });
    }
    // Self-healing: ask Razorpay whether the order is paid, and activate
    // if it is (e.g. the webhook was missed or delayed).
    const rzpOrder = await fetchRazorpayOrder(orderId);
    if (rzpOrder && rzpOrder.status === 'paid') {
      const payments = await fetchRazorpayOrderPayments(orderId);
      const captured = payments.find((p) => p && p.status === 'captured');
      if (captured) {
        const result = activateOrderPayment(orderId, captured.id);
        return res.json({ ok: true, orderId: record.orderId, status: 'paid', paid: true, accessUntil: result.accessUntil, alreadyHandled: result.alreadyHandled });
      }
    }
    return res.json({ ok: true, orderId: record.orderId, status: (rzpOrder && rzpOrder.status) || record.status, paid: false, accessUntil: null });
  } catch (err) {
    if (err instanceof RazorpayError) {
      return res.status(502).json({ ok: false, error: err.code, message: err.message });
    }
    console.error('[razorpay] order-status failed:', err.message);
    res.status(502).json({ ok: false, error: 'order_status_failed', message: err.message || 'Could not check the order status.' });
  }
});

export default router;
