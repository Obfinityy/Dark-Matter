import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateToken,
  verifyToken,
  generateNonce,
  computeProof,
  verifyProof,
} from '../src/token.js';

describe('token', () => {
  it('generateToken returns 32 random bytes as base64url', () => {
    const t = generateToken();
    assert.match(t, /^[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(t, 'base64url').length, 32);
  });

  it('generateToken produces unique values', () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateToken()));
    assert.equal(seen.size, 100);
  });

  it('generateToken rejects short lengths', () => {
    assert.throws(() => generateToken(8), /must be an integer >= 16/);
  });

  it('verifyToken accepts the exact token and rejects others', () => {
    const t = generateToken();
    assert.equal(verifyToken(t, t), true);
    assert.equal(verifyToken(generateToken(), t), false);
    assert.equal(verifyToken('', t), false);
    assert.equal(verifyToken(t, ''), false);
    assert.equal(verifyToken(null, t), false);
    assert.equal(verifyToken(t, t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A')), false);
  });

  it('computeProof is deterministic and verifies', () => {
    const token = generateToken();
    const nonce = generateNonce();
    const p1 = computeProof(token, nonce);
    const p2 = computeProof(token, nonce);
    assert.equal(p1, p2);
    assert.match(p1, /^[0-9a-f]{64}$/);
    assert.equal(verifyProof(token, nonce, p1), true);
    assert.equal(verifyProof(token, nonce, '0'.repeat(64)), false);
    assert.equal(verifyProof(token, generateNonce(), p1), false);
    assert.equal(verifyProof(generateToken(), nonce, p1), false);
  });

  it('computeProof rejects empty nonce', () => {
    assert.throws(() => computeProof(generateToken(), ''), /non-empty nonce/);
  });
});
