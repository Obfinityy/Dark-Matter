/**
 * brainLinkStore.test.js — per-account Kaggle brain links, encrypted at rest.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brainlinks-'));
const keyHex = crypto.randomBytes(32).toString('hex');
process.env.BRAIN_LINKS_KEY = keyHex;

const { createBrainLinkStore, VALID_BRAIN_SLOTS } = await import(
  '../src/services/brainLinkStore.js'
);

function freshStore(name) {
  return createBrainLinkStore({ filePath: path.join(tmpRoot, `${name}.json`) });
}

describe('brainLinkStore', () => {
  test('saves and reads back links for a user', () => {
    const store = freshStore('a');
    const saved = store.saveLinks('user1', {
      vision: { url: 'https://abc.gradio.live', name: 'vision-qwen' },
      hacker: { url: 'https://xyz.gradio.live' },
    });
    assert.equal(saved.vision.url, 'https://abc.gradio.live');
    assert.equal(saved.vision.name, 'vision-qwen');
    assert.equal(saved.hacker.url, 'https://xyz.gradio.live');
    assert.equal(saved.grounding, undefined);
  });

  test('URLs are encrypted at rest — no plaintext in the file', () => {
    const fp = path.join(tmpRoot, 'enc.json');
    const store = createBrainLinkStore({ filePath: fp });
    store.saveLinks('user1', { vision: { url: 'https://secret123.gradio.live' } });
    const raw = fs.readFileSync(fp, 'utf8');
    assert.ok(!raw.includes('secret123'), 'plaintext URL must not appear in the file');
    assert.ok(!raw.includes('gradio.live'), 'domain must not appear in plaintext');
  });

  test('users are isolated from each other', () => {
    const store = freshStore('iso');
    store.saveLinks('alice', { vision: { url: 'https://alice.gradio.live' } });
    store.saveLinks('bob', { hacker: { url: 'https://bob.gradio.live' } });
    assert.equal(store.getLinks('alice').vision.url, 'https://alice.gradio.live');
    assert.equal(store.getLinks('alice').hacker, undefined);
    assert.equal(store.getLinks('bob').hacker.url, 'https://bob.gradio.live');
  });

  test('rejects invalid URLs and unknown slots', () => {
    const store = freshStore('valid');
    assert.throws(() => store.saveLinks('u', { vision: { url: 'not-a-url' } }), /Invalid URL/);
    // Unknown slots are silently ignored.
    const saved = store.saveLinks('u', {
      vision: { url: 'https://ok.gradio.live' },
      bogus: { url: 'https://evil.example.com' },
    });
    assert.equal(saved.bogus, undefined);
    assert.ok(saved.vision);
  });

  test('null entry deletes a slot; deleteSlot removes it', () => {
    const store = freshStore('del');
    store.saveLinks('u', {
      vision: { url: 'https://a.gradio.live' },
      hacker: { url: 'https://b.gradio.live' },
    });
    store.saveLinks('u', { vision: null });
    assert.equal(store.getLinks('u').vision, undefined);
    assert.ok(store.getLinks('u').hacker);
    assert.equal(store.deleteSlot('u', 'hacker'), true);
    assert.equal(store.deleteSlot('u', 'hacker'), false);
    assert.throws(() => store.deleteSlot('u', 'nope'), /Unknown brain slot/);
  });

  test('persists across store instances (same key)', () => {
    const fp = path.join(tmpRoot, 'persist.json');
    createBrainLinkStore({ filePath: fp }).saveLinks('u', {
      grounding: { url: 'https://g.gradio.live', name: 'atlas' },
    });
    const reread = createBrainLinkStore({ filePath: fp }).getLinks('u');
    assert.equal(reread.grounding.url, 'https://g.gradio.live');
    assert.equal(reread.grounding.name, 'atlas');
  });

  test('corrupt ciphertext decrypts to nothing (never throws URLs)', () => {
    const fp = path.join(tmpRoot, 'corrupt.json');
    const store = createBrainLinkStore({ filePath: fp });
    store.saveLinks('u', { vision: { url: 'https://v.gradio.live' } });
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    raw.u.vision.urlEnc = 'dead:beef:00';
    fs.writeFileSync(fp, JSON.stringify(raw));
    store.reload();
    assert.equal(store.getLinks('u').vision, undefined);
  });

  test('VALID_BRAIN_SLOTS has the three expected slots', () => {
    assert.deepEqual([...VALID_BRAIN_SLOTS].sort(), ['grounding', 'hacker', 'vision']);
  });
});

afterEach(() => {
  // keep tmp dir for debugging; harmless
});
