/**
 * brainLinkMongoStore.test.js — Mongo-backed per-account Kaggle brain links.
 *
 * Uses MemoryDatabase (same collection interface as MongoDatabase) so no
 * live Mongo is needed. Covers: Mongo roundtrip, encryption at rest, per-user
 * isolation, validation, delete semantics, runtime fallback to the JSON file
 * when Mongo is down, and one-time file→Mongo migration.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brainlinks-mongo-'));
process.env.BRAIN_LINKS_KEY = crypto.randomBytes(32).toString('hex');

const { createBrainLinkStore, createMongoBrainLinkStore, VALID_BRAIN_SLOTS } = await import(
  '../src/services/brainLinkStore.js'
);
const { MemoryDatabase } = await import('../src/models/database.js');

function freshMongo(fileName = `m-${crypto.randomBytes(4).toString('hex')}.json`) {
  const database = new MemoryDatabase();
  const store = createMongoBrainLinkStore({
    database,
    filePath: path.join(tmpRoot, fileName),
  });
  return { database, store };
}

describe('mongoBrainLinkStore', () => {
  test('saves and reads back links for a user via Mongo', async () => {
    const { store } = freshMongo();
    const saved = await store.saveLinks('user1', {
      vision: { url: 'https://abc.gradio.live', name: 'vision-qwen' },
      hacker: { url: 'https://xyz.gradio.live' },
    });
    assert.equal(saved.vision.url, 'https://abc.gradio.live');
    assert.equal(saved.vision.name, 'vision-qwen');
    assert.equal(saved.hacker.url, 'https://xyz.gradio.live');
    assert.equal(saved.grounding, undefined);

    const reread = await store.getLinks('user1');
    assert.equal(reread.vision.url, 'https://abc.gradio.live');
  });

  test('URLs are encrypted at rest — no plaintext in the Mongo doc', async () => {
    const { database, store } = freshMongo();
    await store.saveLinks('user1', { vision: { url: 'https://secret123.gradio.live' } });
    const doc = await database.collection('brain_links').findOne({ userId: 'user1' });
    assert.ok(doc, 'a document must exist in Mongo');
    assert.ok(doc.slots.vision.urlEnc, 'ciphertext must be stored');
    assert.ok(!doc.slots.vision.url, 'no plaintext url field');
    const raw = JSON.stringify(doc);
    assert.ok(!raw.includes('secret123'), 'plaintext URL must not appear in the doc');
    assert.ok(!raw.includes('gradio.live'), 'domain must not appear in plaintext');
  });

  test('users are isolated from each other', async () => {
    const { store } = freshMongo();
    await store.saveLinks('alice', { vision: { url: 'https://alice.gradio.live' } });
    await store.saveLinks('bob', { hacker: { url: 'https://bob.gradio.live' } });
    assert.equal((await store.getLinks('alice')).vision.url, 'https://alice.gradio.live');
    assert.equal((await store.getLinks('alice')).hacker, undefined);
    assert.equal((await store.getLinks('bob')).hacker.url, 'https://bob.gradio.live');
  });

  test('rejects invalid URLs and unknown slots', async () => {
    const { store } = freshMongo();
    await assert.rejects(
      () => store.saveLinks('u', { vision: { url: 'not-a-url' } }),
      /Invalid URL/
    );
    const saved = await store.saveLinks('u', {
      vision: { url: 'https://ok.gradio.live' },
      bogus: { url: 'https://evil.example.com' },
    });
    assert.equal(saved.bogus, undefined);
    assert.ok(saved.vision);
  });

  test('null entry deletes a slot; deleteSlot removes it', async () => {
    const { store } = freshMongo();
    await store.saveLinks('u', {
      vision: { url: 'https://a.gradio.live' },
      hacker: { url: 'https://b.gradio.live' },
    });
    await store.saveLinks('u', { vision: null });
    assert.equal((await store.getLinks('u')).vision, undefined);
    assert.ok((await store.getLinks('u')).hacker);
    assert.equal(await store.deleteSlot('u', 'hacker'), true);
    assert.equal(await store.deleteSlot('u', 'hacker'), false);
    await assert.rejects(() => store.deleteSlot('u', 'nope'), /Unknown brain slot/);
  });

  test('falls back to the JSON file when Mongo is unavailable', async () => {
    const filePath = path.join(tmpRoot, 'fallback.json');
    const brokenDb = {
      collection() {
        throw new Error('connection refused');
      },
    };
    const store = createMongoBrainLinkStore({ database: brokenDb, filePath });
    const saved = await store.saveLinks('u', { vision: { url: 'https://f.gradio.live' } });
    assert.equal(saved.vision.url, 'https://f.gradio.live');
    // It must have landed in the file fallback (encrypted).
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(parsed.u.vision.urlEnc, 'file fallback must hold the encrypted slot');
    const reread = await store.getLinks('u');
    assert.equal(reread.vision.url, 'https://f.gradio.live');
    assert.equal(await store.deleteSlot('u', 'vision'), true);
  });

  test('migrates file data into Mongo on first read (once)', async () => {
    const filePath = path.join(tmpRoot, 'migrate.json');
    // Seed the legacy file store directly.
    createBrainLinkStore({ filePath }).saveLinks('migu', {
      grounding: { url: 'https://migrate-me.gradio.live', name: 'atlas' },
    });
    const database = new MemoryDatabase();
    const store = createMongoBrainLinkStore({ database, filePath });

    // Mongo is empty for this user before the first read.
    assert.equal(await database.collection('brain_links').findOne({ userId: 'migu' }), null);

    const links = await store.getLinks('migu');
    assert.equal(links.grounding.url, 'https://migrate-me.gradio.live');
    assert.equal(links.grounding.name, 'atlas');

    // The doc must now exist in Mongo.
    const doc = await database.collection('brain_links').findOne({ userId: 'migu' });
    assert.ok(doc && doc.slots.grounding.urlEnc, 'migration must write the doc to Mongo');
    assert.ok(!JSON.stringify(doc).includes('migrate-me.gradio.live'), 'still encrypted');
  });

  test('VALID_BRAIN_SLOTS has the three expected slots', () => {
    assert.deepEqual([...VALID_BRAIN_SLOTS].sort(), ['grounding', 'hacker', 'vision']);
  });
});
