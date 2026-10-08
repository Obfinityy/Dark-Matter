/**
 * billingController — Infinity AI Premium checkout via Razorpay.
 *
 * Security: the frontend NEVER decides the price. Tier → INR paise mapping
 * lives here, server-side. The Razorpay secret never leaves the backend.
 */
import {
  createOrder as razorpayCreateOrder,
  verifySignature as razorpayVerifySignature,
  fetchPayment as razorpayFetchPayment,
  publicKeyId as razorpayPublicKeyId,
  isConfigured as razorpayIsConfigured,
} from '../services/razorpayService.js';
import { creditStore as defaultCreditStore } from '../services/creditStore.js';

/** Authoritative tier prices (INR paise). Frontend amounts are ignored. */
const TIER_PRICES = {
  low: 169900, // ₹1,699
  medium: 419900, // ₹4,199
  high: 839900, // ₹8,399
  ultramax: 2499900, // ₹24,999
  infinity: 4199900, // ₹41,999
};

/** Top-up bounds: any whole-rupee amount from ₹10 to ₹1,00,000. */
export const TOPUP_MIN_INR = 10;
export const TOPUP_MAX_INR = 100000;

function validTopupAmount(amountInr) {
  return (
    typeof amountInr === 'number' &&
    Number.isInteger(amountInr) &&
    amountInr >= TOPUP_MIN_INR &&
    amountInr <= TOPUP_MAX_INR
  );
}

export function createBillingController({ userModel, creditStore, razorpay } = {}) {
  // Injectables (used by unit tests): fall back to the real Razorpay service
  // and the default local credit store.
  const store = creditStore || defaultCreditStore;
  const rz = razorpay || {
    createOrder: razorpayCreateOrder,
    verifySignature: razorpayVerifySignature,
    fetchPayment: razorpayFetchPayment,
    publicKeyId: razorpayPublicKeyId,
    isConfigured: razorpayIsConfigured,
  };

  const balanceOf = (req) => {
    const userId = req.user?.id || req.user?._id || 'anonymous';
    return store.getBalanceInr(String(userId));
  };

  return {
    /** GET /billing/status — is billing live? + public key for checkout.js */
    status(req, res) {
      res.json({
        configured: rz.isConfigured(),
        keyId: rz.publicKeyId(),
        tiers: Object.keys(TIER_PRICES),
        creditBalanceInr: balanceOf(req),
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
        const order = await rz.createOrder({ amountPaise, tierId, userId: String(userId) });
        res.json({ order, keyId: rz.publicKeyId() });
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
        if (!rz.verifySignature({ orderId, paymentId, signature })) {
          return res.status(400).json({ ok: false, error: 'Signature mismatch' });
        }
        const payment = await rz.fetchPayment(paymentId);
        if (payment?.status !== 'captured' && payment?.status !== 'authorized') {
          return res.status(400).json({ ok: false, error: `Payment not captured (${payment?.status})` });
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

    /** GET /billing/balance — the caller's Infinity Credits balance (INR). */
    balance(req, res) {
      res.json({ creditBalanceInr: balanceOf(req) });
    },

    /**
     * POST /billing/topup/order { amountInr } → { orderId, amount, currency, keyId }
     * Creates a Razorpay order for an arbitrary whole-rupee top-up.
     * The price comes from the server-side validation, never the frontend.
     */
    async createTopupOrder(req, res) {
      try {
        const { amountInr } = req.body || {};
        if (!validTopupAmount(amountInr)) {
          return res.status(400).json({
            error: `Invalid amount — top up between ₹${TOPUP_MIN_INR} and ₹${TOPUP_MAX_INR.toLocaleString('en-IN')} (whole rupees)`,
          });
        }
        const userId = req.user?.id || req.user?._id || 'anonymous';
        const order = await rz.createOrder({
          amountPaise: amountInr * 100,
          tierId: 'topup',
          userId: String(userId),
        });
        res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: rz.publicKeyId() });
      } catch (err) {
        res.status(502).json({ error: err.message || 'Top-up order creation failed' });
      }
    },

    /**
     * POST /billing/topup/verify { orderId, paymentId, signature }
     * Verifies the HMAC signature, double-checks the payment with Razorpay,
     * then credits the exact captured amount to the user's wallet.
     */
    async verifyTopup(req, res) {
      try {
        const { orderId, paymentId, signature } = req.body || {};
        if (!rz.verifySignature({ orderId, paymentId, signature })) {
          return res.status(400).json({ ok: false, error: 'Signature mismatch' });
        }
        const payment = await rz.fetchPayment(paymentId);
        if (payment?.status !== 'captured' && payment?.status !== 'authorized') {
          return res.status(400).json({ ok: false, error: `Payment not captured (${payment?.status})` });
        }
        // The signature binds orderId↔paymentId; the order was created
        // server-side with the exact amount, and Razorpay only charges what
        // the order specifies. Double-check the payment belongs to our order.
        if (payment.order_id && payment.order_id !== orderId) {
          return res.status(400).json({ ok: false, error: 'Payment is for a different order' });
        }
        const creditedPaise = Number(payment.amount) || 0;
        if (creditedPaise <= 0) {
          return res.status(400).json({ ok: false, error: 'Payment has no captured amount' });
        }
        const userId = req.user?.id || req.user?._id || 'anonymous';
        const creditedInr = creditedPaise / 100;
        let creditBalanceInr = null;
        try {
          creditBalanceInr = store.addCreditsInr(String(userId), creditedInr);
        } catch (err) {
          // Payment verified — never fail the response on a persistence hiccup.
          console.warn('[billing] credit store persist failed:', err?.message);
        }
        res.json({ ok: true, orderId, paymentId, creditedInr, creditBalanceInr });
      } catch (err) {
        res.status(502).json({ ok: false, error: err.message || 'Verification failed' });
      }
    },
  };
}
