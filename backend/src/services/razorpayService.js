/**
 * razorpayService — Infinity AI billing via Razorpay (test mode).
 *
 * No npm dependency: talks to Razorpay's REST API over HTTPS with Basic auth.
 * The key SECRET never leaves this service — the frontend only ever sees
 * the public key_id and a server-created order_id.
 *
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (backend/.env, gitignored).
 */
import https from 'node:https';
import crypto from 'node:crypto';

const API_HOST = 'api.razorpay.com';
const API_VERSION = 'v1';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

function apiRequest(method, path, body = null) {
  const { keyId, keySecret } = credentials();
  const payload = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  // NOTE: Node 24+ honors HTTPS_PROXY/https_proxy automatically
  // (NODE_USE_ENV_PROXY=1), so sandboxed/corporate egress proxies just work.
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: `/${API_VERSION}${path}`,
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            return reject(new Error(`Razorpay: invalid JSON response (${res.statusCode})`));
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const msg = parsed?.error?.description || `Razorpay API error ${res.statusCode}`;
          reject(new Error(msg));
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Razorpay: request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

/** Public key id — safe to expose to the frontend for checkout.js. */
export function publicKeyId() {
  return credentials().keyId || null;
}

export function isConfigured() {
  return credentials().configured;
}

/**
 * Create a Razorpay order for a Premium tier.
 * @param {{ amountPaise:number, tierId:string, userId:string }} opts
 */
export async function createOrder({ amountPaise, tierId, userId }) {
  if (!isConfigured()) throw new Error('Razorpay is not configured');
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('Invalid amount');
  }
  return apiRequest('POST', '/orders', {
    amount: amountPaise,
    currency: 'INR',
    receipt: `inf_${String(userId).slice(0, 20)}_${Date.now()}`,
    notes: { tier: tierId, product: 'infinity-ai-premium' },
  });
}

/**
 * Verify the Razorpay payment signature (HMAC-SHA256).
 * Must be called server-side after checkout.js returns.
 */
export function verifySignature({ orderId, paymentId, signature }) {
  const { keySecret } = credentials();
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Fetch a payment's authoritative status from Razorpay. */
export async function fetchPayment(paymentId) {
  if (!isConfigured()) throw new Error('Razorpay is not configured');
  return apiRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
}
