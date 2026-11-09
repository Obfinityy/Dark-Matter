// Dark Matter — Razorpay client (owner order 9 Nov 2026, issue #491).
//
// TEST MODE ONLY. All config comes from env vars; nothing is hardcoded:
//   RAZORPAY_KEY_ID         public key id (rzp_test_...) — returned to the frontend
//   RAZORPAY_KEY_SECRET     key secret — server-side only, NEVER sent to a client
//   RAZORPAY_WEBHOOK_SECRET webhook secret — HMAC verification only
//
// No Razorpay SDK dependency: plain fetch() calls to api.razorpay.com/v1
// with HTTP Basic auth. The amount is fixed: Rs 10,000 = 1,000,000 paise,
// the same price as the manual UPI flow (UPI_AMOUNT_INR in upiPay.js).

import crypto from 'node:crypto';
import { UPI_AMOUNT_INR, UPI_CURRENCY } from './upiPay.js';

export const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
export const RAZORPAY_AMOUNT_PAISE = UPI_AMOUNT_INR * 100; // 1,000,000
export const RAZORPAY_CURRENCY = UPI_CURRENCY; // 'INR'
export const RAZORPAY_ACCESS_DAYS = 1;

export function razorpayConfig() {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  };
}

export function isRazorpayConfigured() {
  const c = razorpayConfig();
  return Boolean(c.keyId && c.keySecret);
}

export function isTestKeyId(keyId) {
  return String(keyId || '').startsWith('rzp_test_');
}

export class RazorpayError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function authHeader(cfg) {
  return `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`;
}

function requireApiConfig() {
  const cfg = razorpayConfig();
  if (!cfg.keyId || !cfg.keySecret) {
    throw new RazorpayError(
      'razorpay_not_configured',
      'Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys) in the backend environment.'
    );
  }
  return cfg;
}

async function rzpFetch(cfg, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: authHeader(cfg),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new RazorpayError('razorpay_unreachable', `Could not reach Razorpay: ${err.message || 'network error'}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && data.error && (data.error.description || data.error.code)) ||
      `Razorpay request failed (${res.status})`;
    throw new RazorpayError('razorpay_api_error', msg, res.status);
  }
  return data;
}

/**
 * Create a Razorpay order for one day of access. `notes` carries the
 * paying user's id/username so the webhook can map the payment to the
 * account even if the frontend never calls back. Returns the raw order
 * object ({id, amount, currency, status, receipt, ...}).
 * Throws RazorpayError('razorpay_not_configured') when env vars are missing.
 */
export async function createRazorpayOrder({ userId, username, receipt }) {
  const cfg = requireApiConfig();
  return rzpFetch(cfg, '/orders', {
    method: 'POST',
    body: {
      amount: RAZORPAY_AMOUNT_PAISE,
      currency: RAZORPAY_CURRENCY,
      receipt: receipt || `dm-${Date.now()}`,
      notes: {
        userId: String(userId),
        username: String(username),
        product: 'dark-matter-1-day-access',
      },
    },
  });
}

/** Fetch a Razorpay order by id. */
export async function fetchRazorpayOrder(orderId) {
  const cfg = requireApiConfig();
  return rzpFetch(cfg, `/orders/${encodeURIComponent(orderId)}`);
}

/** List payments captured against a Razorpay order. */
export async function fetchRazorpayOrderPayments(orderId) {
  const cfg = requireApiConfig();
  const data = await rzpFetch(cfg, `/orders/${encodeURIComponent(orderId)}/payments`);
  return Array.isArray(data && data.items) ? data.items : [];
}

/**
 * Verify a Razorpay webhook signature (Razorpay Webhooks docs):
 * signature = HMAC-SHA256(webhookSecret, rawBody) as lowercase hex.
 * `rawBody` must be the exact request bytes (Buffer or string) — never a
 * re-serialised object. Timing-safe compare; false on any mismatch,
 * missing signature, or missing secret (fail closed).
 */
export function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  try {
    const secret = String(webhookSecret || '');
    const sig = String(signature || '');
    if (!secret || !sig) return false;
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(sig, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
