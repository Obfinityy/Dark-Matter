// Dark Matter — Razorpay service (test + live).
//
// No new dependencies: node:https for the Orders API, node:crypto for the
// HMAC-SHA256 payment verification. The KEY SECRET never leaves the backend.
//
// Env:
//   RAZORPAY_KEY_ID      rzp_test_... / rzp_live_...
//   RAZORPAY_KEY_SECRET  (backend .env only — never committed, never sent out)

import https from 'node:https';
import crypto from 'node:crypto';

const KEY_ID = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const KEY_SECRET = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();

export function razorpayConfigured() {
  return Boolean(KEY_ID() && KEY_SECRET());
}

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path: apiPath,
        method,
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${KEY_ID()}:${KEY_SECRET()}`).toString('base64'),
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 20000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            /* non-JSON */
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
          const msg = (data && data.error && data.error.description) || `Razorpay HTTP ${res.statusCode}`;
          reject(new Error(msg));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Razorpay request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Create a Razorpay order for a top-up.
 * @param {number} amountCents - e.g. 300 for $3.00
 * @param {string} receipt - our internal reference
 * @returns {Promise<{id, amount, currency, status}>}
 */
export async function createOrder(amountCents, receipt) {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured on the backend.');
  const cents = Math.round(amountCents);
  if (!Number.isFinite(cents) || cents < 100 || cents > 50000) {
    throw new Error('Top-up must be between $1 and $500.');
  }
  return apiRequest('POST', '/v1/orders', {
    amount: cents,
    currency: 'USD',
    receipt: String(receipt).slice(0, 40),
    notes: { product: 'dark-matter-credits' },
  });
}

/** Fetch a payment to confirm it was captured. */
export async function fetchPayment(paymentId) {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured on the backend.');
  return apiRequest('GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Verify the checkout signature. Standard Razorpay verification:
 *   HMAC_SHA256(order_id + '|' + payment_id, key_secret) === razorpay_signature
 */
export function verifySignature(orderId, paymentId, signature) {
  const secret = KEY_SECRET();
  if (!secret || !orderId || !paymentId || !signature) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Public key id is safe to expose to the frontend for checkout.js. */
export function publicKeyId() {
  return KEY_ID();
}
