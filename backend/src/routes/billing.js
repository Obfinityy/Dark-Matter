// Billing routes — top-up credits via Razorpay.
//
//   GET  /api/v1/billing/status          -> {ok, balanceUsd, configured}
//   POST /api/v1/billing/order  {amountUsd} -> {ok, order:{id,amount,currency}, keyId}
//   POST /api/v1/billing/verify {orderId,paymentId,signature} -> {ok, balanceUsd}
//
// All routes require login. The Razorpay SECRET never leaves this file.

import { Router } from 'express';
import { requireAuth } from './auth.js';
import {
  razorpayConfigured,
  createOrder,
  fetchPayment,
  verifySignature,
  publicKeyId,
} from '../billing/razorpay.js';
import { getBalanceUsd, addCreditsUsd, recentTxns } from '../billing/credits.js';

const router = Router();

router.get('/status', requireAuth, (req, res) => {
  res.json({
    ok: true,
    balanceUsd: getBalanceUsd(req.user.id),
    configured: razorpayConfigured(),
    txns: recentTxns(req.user.id, 10),
  });
});

router.post('/order', requireAuth, async (req, res) => {
  try {
    if (!razorpayConfigured()) {
      return res.status(503).json({ ok: false, error: 'not_configured', message: 'Payments are not configured yet.' });
    }
    const amountUsd = Number(req.body && req.body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 500) {
      return res.status(400).json({ ok: false, error: 'bad_amount', message: 'Top-up must be between $1 and $500.' });
    }
    const cents = Math.round(amountUsd * 100);
    const receipt = `dm_${req.user.id.slice(0, 12)}_${Date.now()}`;
    const order = await createOrder(cents, receipt);
    res.json({
      ok: true,
      order: { id: order.id, amount: order.amount, currency: order.currency || 'USD' },
      keyId: publicKeyId(),
    });
  } catch (err) {
    console.error('[billing] order failed:', err.message);
    res.status(502).json({ ok: false, error: 'order_failed', message: err.message || 'Could not create payment order.' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body || {};
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ ok: false, error: 'missing_fields', message: 'orderId, paymentId and signature are required.' });
    }
    if (!verifySignature(orderId, paymentId, signature)) {
      console.warn(`[billing] signature mismatch for user ${req.user.id}, order ${orderId}`);
      return res.status(400).json({ ok: false, error: 'bad_signature', message: 'Payment verification failed.' });
    }
    // Confirm the payment was actually captured (not just authorized/failed).
    const payment = await fetchPayment(paymentId);
    if (!payment || payment.status !== 'captured') {
      return res.status(400).json({
        ok: false,
        error: 'not_captured',
        message: `Payment is ${payment ? payment.status : 'unknown'} — credits added only for captured payments.`,
      });
    }
    // Idempotency: never credit the same payment twice (retry-safe).
    const already = recentTxns(req.user.id, 200).some((t) => t.paymentId === paymentId);
    if (already) {
      return res.json({ ok: true, balanceUsd: getBalanceUsd(req.user.id), duplicate: true });
    }
    const creditedUsd = addCreditsUsd(req.user.id, payment.amount || 0, {
      orderId,
      paymentId,
      currency: payment.currency || 'USD',
    });
    console.log(`[billing] credited $${(payment.amount / 100).toFixed(2)} to user ${req.user.id} (payment ${paymentId})`);
    res.json({ ok: true, balanceUsd: creditedUsd });
  } catch (err) {
    console.error('[billing] verify failed:', err.message);
    res.status(502).json({ ok: false, error: 'verify_failed', message: err.message || 'Could not verify payment.' });
  }
});

export default router;
