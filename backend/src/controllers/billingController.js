/**
 * billingController — Infinity AI Premium checkout via Razorpay.
 *
 * Security: the frontend NEVER decides the price. Tier → INR paise mapping
 * lives here, server-side. The Razorpay secret never leaves the backend.
 */
import {
  createOrder,
  verifySignature,
  fetchPayment,
  publicKeyId,
  isConfigured,
} from '../services/razorpayService.js';

/** Authoritative tier prices (INR paise). Frontend amounts are ignored. */
const TIER_PRICES = {
  low: 169900, // ₹1,699
  medium: 419900, // ₹4,199
  high: 839900, // ₹8,399
  ultramax: 2499900, // ₹24,999
  infinity: 4199900, // ₹41,999
};

export function createBillingController({ userModel } = {}) {
  return {
    /** GET /billing/status — is billing live? + public key for checkout.js */
    status(req, res) {
      res.json({
        configured: isConfigured(),
        keyId: publicKeyId(),
        tiers: Object.keys(TIER_PRICES),
      });
    },

    /** GET /billing/subscription — the caller's server-side plan (if any). */
    async subscription(req, res) {
      try {
        const userId = req.user?.id || req.user?._id;
        if (!userId || !userModel?.getSubscription) return res.json({ subscription: null });
        const subscription = await userModel.getSubscription(String(userId));
        res.json({ subscription });
      } catch (err) {
        res.status(502).json({ subscription: null, error: err?.message });
      }
    },

    /** POST /billing/order { tierId } → { order, keyId } */
    async createOrder(req, res) {
      try {
        const tierId = String(req.body?.tierId || '').toLowerCase();
        const amountPaise = TIER_PRICES[tierId];
        if (!amountPaise) return res.status(400).json({ error: 'Unknown tier' });
        const userId = req.user?.id || req.user?._id || 'anonymous';
        const order = await createOrder({ amountPaise, tierId, userId: String(userId) });
        res.json({ order, keyId: publicKeyId() });
      } catch (err) {
        res.status(502).json({ error: err.message || 'Order creation failed' });
      }
    },

    /**
     * POST /billing/verify { orderId, paymentId, signature, tierId }
     * Verifies HMAC signature, then double-checks payment status with Razorpay.
     */
    async verify(req, res) {
      try {
        const { orderId, paymentId, signature, tierId } = req.body || {};
        if (!verifySignature({ orderId, paymentId, signature })) {
          return res.status(400).json({ ok: false, error: 'Signature mismatch' });
        }
        const payment = await fetchPayment(paymentId);
        if (payment?.status !== 'captured' && payment?.status !== 'authorized') {
          return res
            .status(400)
            .json({ ok: false, error: `Payment not captured (${payment?.status})` });
        }
        // Amount sanity: what Razorpay captured must match our tier price.
        const expected = TIER_PRICES[String(tierId || '').toLowerCase()];
        if (expected && Number(payment.amount) !== expected) {
          return res.status(400).json({ ok: false, error: 'Amount mismatch' });
        }
        // Persist the verified subscription server-side so the plan survives
        // localStorage clears and device switches.
        const userId = req.user?.id || req.user?._id;
        let subscription = null;
        if (userId && userModel?.setSubscription) {
          try {
            subscription = await userModel.setSubscription(String(userId), {
              tierId: String(tierId || '').toLowerCase(),
              paymentId,
              orderId,
            });
          } catch (err) {
            // Payment verified — never fail the response on a persistence hiccup.
            console.warn('[billing] subscription persist failed:', err?.message);
          }
        }
        res.json({ ok: true, tierId, paymentId, subscription });
      } catch (err) {
        res.status(502).json({ ok: false, error: err.message || 'Verification failed' });
      }
    },
  };
}
