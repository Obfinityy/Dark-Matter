import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackModel, findBrainModel, DEFAULT_BRAIN_MODEL } from './brainProvider.js';

test('default brain model is darkmatter-v1 (8B)', () => {
  assert.equal(DEFAULT_BRAIN_MODEL, 'darkmatter-v1');
  const m = findBrainModel('darkmatter-v1');
  assert.ok(m);
  assert.equal(m.model, 'dm-hunter');
});

test('1.5B fallback model exists with capabilities', () => {
  const m = findBrainModel('darkmatter-1.5b');
  assert.ok(m, 'darkmatter-1.5b should exist');
  assert.equal(m.model, 'deepseek-r1:1.5b');
  assert.ok(m.capabilities);
  assert.equal(m.capabilities.reliability, 'high');
});

test('getFallbackModel returns 1.5B on OOM', () => {
  const fb = getFallbackModel('darkmatter-v1', 'oom');
  assert.ok(fb);
  assert.equal(fb.id, 'darkmatter-1.5b');
  assert.equal(fb.fallbackReason, 'oom');
  assert.equal(fb.fallbackFrom, 'darkmatter-v1');
});

test('getFallbackModel returns 1.5B on timeout', () => {
  const fb = getFallbackModel('darkmatter-v1', 'timeout');
  assert.ok(fb);
  assert.equal(fb.id, 'darkmatter-1.5b');
});

test('getFallbackModel returns 1.5B on no_reply', () => {
  const fb = getFallbackModel('darkmatter-v1', 'no_reply');
  assert.ok(fb);
  assert.equal(fb.id, 'darkmatter-1.5b');
});

test('getFallbackModel returns null for unknown reason', () => {
  const fb = getFallbackModel('darkmatter-v1', 'unknown');
  assert.equal(fb, null);
});

test('getFallbackModel returns null if already on fallback', () => {
  const fb = getFallbackModel('darkmatter-1.5b', 'oom');
  assert.equal(fb, null, 'No fallback from fallback to prevent loops');
});
