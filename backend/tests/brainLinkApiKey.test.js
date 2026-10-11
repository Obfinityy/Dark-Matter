/**
 * brainLinkApiKey.test.js — per-slot brain API keys (e.g. AWS-hosted brain
 * endpoints): accepted on save, encrypted at rest, decrypted on read, capped
 * at 500 chars, and never present in plaintext on disk.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brainlinks-apikey-'));
process.env.BRAIN_LINKS_KEY = crypto.randomBytes(32).toString('hex');

const { createBrainLinkStore, MAX_API_KEY_LENGTH } = await import(
  '../src/services/brainLinkStore.js'
);

function freshStore(name) {
  return createBrainLinkStore({ filePath: path.join(tmpRoot, `${name}.json`) });
}

describe('brainLinkStore apiKey', () => {
  test('apiKey round-trips through save/getLinks', () => {
    const store = freshStore('roundtrip');
    const saved = store.saveLinks('user1', {
      hacker: { url: 'https://hacker.example.com', apiKey: 'sk-test-key-123' },
    });
    assert.equal(saved.hacker.apiKey, 'sk-test-key-123');
    const again = store.getLinks('user1');
    assert.equal(again.hacker.apiKey, 'sk-test-key-123');
  });

  test('apiKey is encrypted at rest — no plaintext in the file', () => {
    const fp = path.join(tmpRoot, 'enc.json');
    const store = createBrainLinkStore({ filePath: fp });
    store.saveLinks('user1', {
      vision: { url: 'https://v.example.com', apiKey: 'super-secret-aws-key' },
    });
    const raw = fs.readFileSync(fp, 'utf8');
    assert.ok(!raw.includes('super-secret-aws-key'), 'raw key must not appear in the file');
    assert.ok(raw.includes('apiKeyEnc'), 'ciphertext field must be stored');
  });

  test('apiKey omitted from output when never set', () => {
    const store = freshStore('unset');
    const saved = store.saveLinks('user1', { hacker: { url: 'https://h.example.com' } });
    assert.ok(!('apiKey' in saved.hacker), 'apiKey must be absent when unset');
  });

  test('saving without apiKey clears a previously set key', () => {
    const store = freshStore('clear');
    store.saveLinks('user1', { hacker: { url: 'https://h.example.com', apiKey: 'k1' } });
    const saved = store.saveLinks('user1', { hacker: { url: 'https://h.example.com' } });
    assert.ok(!('apiKey' in saved.hacker), 'key must be cleared when omitted');
  });

  test('apiKey longer than the cap is rejected', () => {
    const store = freshStore('cap');
    assert.throws(
      () => store.saveLinks('user1', { hacker: { url: 'https://h.example.com', apiKey: 'x'.repeat(MAX_API_KEY_LENGTH + 1) } }),
      /exceeds 500/
    );
  });

  test('apiKey survives a store reload from disk', () => {
    const fp = path.join(tmpRoot, 'reload.json');
    createBrainLinkStore({ filePath: fp }).saveLinks('user1', {
      grounding: { url: 'https://g.example.com', apiKey: 'persist-me' },
    });
    const reloaded = createBrainLinkStore({ filePath: fp }).getLinks('user1');
    assert.equal(reloaded.grounding.apiKey, 'persist-me');
  });
});
