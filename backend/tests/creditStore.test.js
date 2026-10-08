/**
 * creditStore.test.js — Infinity Credits wallet, store-level edge cases.
 *
 * billingTopup.test.js covers the happy path (paise arithmetic, persistence
 * across instances, one corrupt-file case, invalid amounts). This file covers
 * the store's defensive edges: malformed-but-valid-JSON files, partial entry
 * corruption, reload() cross-process pickup, atomic-write guarantees, missing
 * directory creation, paise rounding, and user-id normalization.
 *
 * No network, no Razorpay — file-backed store in os.tmpdir() only.
 * Run: node --test backend/tests/creditStore.test.js (from the repo root)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCreditStore, creditStore } from '../src/services/creditStore.js';

function tmpFile(...parts) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'creditstore-')), ...parts);
}

function seed(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj));
}

describe('loading edge cases', () => {
  test('loads a well-formed seeded file', () => {
    const file = tmpFile('credits.json');
    seed(file, { balances: { u1: 5000, u2: 250 } });
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('u1'), 50);
    assert.equal(store.getBalanceInr('u2'), 2.5);
  });

  test('drops corrupt entries but keeps valid ones', () => {
    const file = tmpFile('credits.json');
    seed(file, {
      balances: {
        good: 1000,
        negative: -50,
        fractional: 10.5,
        stringy: '100',
        nullish: null,
        boolish: true,
      },
    });
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('good'), 10);
    for (const bad of ['negative', 'fractional', 'stringy', 'nullish', 'boolish']) {
      assert.equal(store.getBalanceInr(bad), 0, `${bad} should be ignored`);
    }
  });

  test('wrong JSON shapes start empty', () => {
    for (const raw of ['[]', '{}', '"just a string"', '42', 'true']) {
      const file = tmpFile('credits.json');
      seed(file, raw);
      const store = createCreditStore({ filePath: file });
      assert.equal(store.getBalanceInr('anyone'), 0, `raw=${raw}`);
    }
  });

  test('empty file starts empty instead of crashing', () => {
    const file = tmpFile('credits.json');
    seed(file, '');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('anyone'), 0);
  });

  test('missing file starts empty (first run)', () => {
    const file = tmpFile('never-written.json');
    assert.ok(!fs.existsSync(file));
    const store = createCreditStore({ filePath: file });
    assert.equal(store.getBalanceInr('u1'), 0);
  });
});

describe('persistence guarantees', () => {
  test('write is atomic: no temp files left behind, file is valid JSON', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    store.addCreditsInr('u1', 123.45);
    const leftovers = fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, [], 'atomic write must not leave .tmp files');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(parsed, { balances: { u1: 12345 } });
  });

  test('creates missing parent directories on first write', () => {
    const file = tmpFile('deep', 'nested', 'credits.json');
    assert.ok(!fs.existsSync(path.dirname(file)));
    const store = createCreditStore({ filePath: file });
    store.addCreditsInr('u1', 10);
    assert.ok(fs.existsSync(file));
    assert.equal(store.getBalanceInr('u1'), 10);
  });

  test('reload() picks up edits made by another process', () => {
    const file = tmpFile('credits.json');
    const a = createCreditStore({ filePath: file });
    a.addCreditsInr('u1', 100);
    // Simulate an external edit (second backend instance / manual fix).
    seed(file, { balances: { u1: 99999, u2: 50 } });
    assert.equal(a.getBalanceInr('u2'), 0, 'stale snapshot before reload');
    a.reload();
    assert.equal(a.getBalanceInr('u1'), 999.99);
    assert.equal(a.getBalanceInr('u2'), 0.5);
  });

  test('sequential writes accumulate in paise without float drift', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    store.addCreditsInr('u1', 0.1);
    store.addCreditsInr('u1', 0.2);
    assert.equal(store.getBalanceInr('u1'), 0.3);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(parsed.balances.u1, 30);
  });
});

describe('amount and identity handling', () => {
  test('fractional INR rounds to the nearest paise', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.addCreditsInr('u1', 99.999), 100);
    assert.equal(store.getBalanceInr('u1'), 100);
    assert.equal(store.addCreditsInr('u2', 10.004), 10);
    assert.equal(store.addCreditsInr('u3', 0.01), 0.01);
  });

  test('missing user ids normalize to "anonymous"', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.addCreditsInr(undefined, 50), 50);
    assert.equal(store.getBalanceInr(), 50);
    assert.equal(store.getBalanceInr(null), 50);
    assert.equal(store.getBalanceInr('anonymous'), 50);
  });

  test('user ids are stringified', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    store.addCreditsInr(12345, 7);
    assert.equal(store.getBalanceInr('12345'), 7);
  });

  test('large top-ups stay exact', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    assert.equal(store.addCreditsInr('whale', 1_000_000), 1_000_000);
  });

  test('balances are isolated per user', () => {
    const file = tmpFile('credits.json');
    const store = createCreditStore({ filePath: file });
    store.addCreditsInr('alice', 100);
    store.addCreditsInr('bob', 200);
    assert.equal(store.getBalanceInr('alice'), 100);
    assert.equal(store.getBalanceInr('bob'), 200);
    assert.equal(store.getBalanceInr('carol'), 0);
  });
});

describe('module singleton', () => {
  test('creditStore exposes the store API', () => {
    for (const m of ['getBalanceInr', 'addCreditsInr', 'reload']) {
      assert.equal(typeof creditStore[m], 'function', `missing ${m}`);
    }
  });
});
