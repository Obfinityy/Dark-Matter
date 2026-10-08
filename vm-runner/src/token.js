/**
 * Session token utilities for the Infinity AI VM Runner.
 *
 * Every VM session gets a 32-byte random token (base64url). The token is
 * issued once at POST /vm/start, held in frontend memory only, and required
 * as `Authorization: Bearer <token>` on every mutating runner endpoint.
 * The same token is seeded into the guest agent so the runner can prove
 * possession before talking to it.
 */
import { randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

export const TOKEN_BYTES = 32;

/** Generate a fresh session token: 32 random bytes, base64url-encoded. */
export function generateToken(bytes = TOKEN_BYTES) {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new Error('token length must be an integer >= 16 bytes');
  }
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time token comparison (never use === for secrets). */
export function verifyToken(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (provided.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateNonce() {
  return randomBytes(16).toString('hex');
}

/**
 * Proof-of-possession HMAC. The runner asks the guest agent for a proof
 * BEFORE ever sending the token, so a stale port takeover cannot harvest it.
 * Both sides compute HMAC-SHA256(token, 'infinity-guest-proof:' + nonce).
 */
export function computeProof(token, nonce) {
  if (typeof token !== 'string' || typeof nonce !== 'string' || nonce.length === 0) {
    throw new Error('computeProof requires a token and a non-empty nonce');
  }
  return createHmac('sha256', token).update(`infinity-guest-proof:${nonce}`).digest('hex');
}

/** Verify a proof string returned by the guest agent. */
export function verifyProof(token, nonce, proof) {
  if (typeof proof !== 'string') return false;
  return verifyToken(computeProof(token, nonce), proof);
}
