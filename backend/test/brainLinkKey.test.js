/**
 * brainLinkKey.test.js — BRAIN_LINKS_KEY resolution fallback chain.
 *
 * The encryption key must be STABLE across restarts, otherwise saved links
 * become undecryptable ("not saving to my account"). Priority:
 *   1. BRAIN_LINKS_KEY env (hex/base64)
 *   2. HKDF-derived from JWT_SECRET (stable, zero-config)
 *   3. Ephemeral random (loud warning; links die on restart)
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const STORE_PATH = '../src/services/brainLinkStore.js';

const OLD_ENV = { ...process.env };

function clearSecrets() {
  delete process.env.BRAIN_LINKS_KEY;
  delete process.env.JWT_SECRET;
}

beforeEach(() => {
  clearSecrets();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe('brain-link key resolution', () => {
  test('ephemeral when no secrets are set', async () => {
    const m = await import(`${STORE_PATH}?t=${Date.now()}-a`);
    const a = m.createBrainLinkStore();
    const b = m.createBrainLinkStore();
    assert.equal(a.isEphemeralKey, true);
    // Ephemeral keys must differ per instance (old behavior) — but more
    // importantly, two instances must NOT share undecryptable state.
    assert.notEqual(a.keySource, undefined);
    assert.equal(a.keySource, 'ephemeral');
    assert.equal(b.keySource, 'ephemeral');
  });

  test('JWT_SECRET fallback is stable across instances', async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-123';
    const m = await import(`${STORE_PATH}?t=${Date.now()}-b`);
    const a = m.createBrainLinkStore();
    const b = m.createBrainLinkStore();
    assert.equal(a.isEphemeralKey, false);
    assert.equal(a.keySource, 'jwt-secret');
    assert.equal(b.keySource, 'jwt-secret');
    // Same input → same key: a link saved by one instance must be
    // readable by another (simulates a server restart).
    a.saveLinks('u1', { vision: { url: 'https://abc123.gradio.live' } });
    const readBack = b.getLinks('u1');
    // b has its own in-memory data, so re-read via a fresh file-backed pair
    // sharing the same file to prove cross-instance decryption works.
    const file = '/tmp/brainlink-key-test.json';
    const s1 = m.createBrainLinkStore({ filePath: file });
    const s2 = m.createBrainLinkStore({ filePath: file });
    s1.saveLinks('u2', { hacker: { url: 'https://xyz999.gradio.live', name: 'h' } });
    s2.reload();
    const got = s2.getLinks('u2');
    assert.equal(got.hacker?.url, 'https://xyz999.gradio.live');
    assert.equal(got.hacker?.name, 'h');
  });

  test('BRAIN_LINKS_KEY wins over JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-123';
    process.env.BRAIN_LINKS_KEY = 'a'.repeat(64); // 32-byte hex
    const m = await import(`${STORE_PATH}?t=${Date.now()}-c`);
    const s = m.createBrainLinkStore();
    assert.equal(s.isEphemeralKey, false);
    assert.equal(s.keySource, 'env');
    s.saveLinks('u3', { vision: { url: 'https://env-wins.gradio.live' } });
    assert.equal(s.getLinks('u3').vision?.url, 'https://env-wins.gradio.live');
  });

  test('malformed BRAIN_LINKS_KEY falls back to JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-123';
    process.env.BRAIN_LINKS_KEY = 'not-a-valid-key';
    const m = await import(`${STORE_PATH}?t=${Date.now()}-d`);
    const s = m.createBrainLinkStore();
    assert.equal(s.isEphemeralKey, false);
    assert.equal(s.keySource, 'jwt-secret');
  });

  test('saveLinks roundtrip encrypts and decrypts', async () => {
    process.env.JWT_SECRET = 'another-stable-secret-for-roundtrip-1';
    const m = await import(`${STORE_PATH}?t=${Date.now()}-e`);
    const s = m.createBrainLinkStore();
    const saved = s.saveLinks('u4', {
      vision: { url: 'https://v.gradio.live', name: 'V' },
      hacker: { url: 'https://h.gradio.live' },
    });
    assert.equal(saved.vision.url, 'https://v.gradio.live');
    assert.equal(saved.vision.name, 'V');
    assert.equal(saved.hacker.url, 'https://h.gradio.live');
    assert.equal(saved.grounding, undefined);
  });
});
