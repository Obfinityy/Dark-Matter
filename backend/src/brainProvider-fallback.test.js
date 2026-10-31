import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackModel, findBrainModel, DEFAULT_BRAIN_MODEL } from './brainProvider.js';

// OWNER ORDER 1 Nov 2026: Local models (8B/1.5B) removed from BRAIN_MODELS.
// Testing uses parent-as-brain. Meta API reserved for final testing.
// These tests verify the fallback is correctly disabled.

test('DEFAULT_BRAIN_MODEL is defined', () => {
  assert.ok(DEFAULT_BRAIN_MODEL);
  assert.equal(typeof DEFAULT_BRAIN_MODEL, 'string');
});

test('darkmatter-v1 (8B) is removed', () => {
  const m = findBrainModel('darkmatter-v1');
  assert.equal(m, null, '8B model should not be in BRAIN_MODELS');
});

test('darkmatter-1.5b is removed', () => {
  const m = findBrainModel('darkmatter-1.5b');
  assert.equal(m, null, '1.5B model should not be in BRAIN_MODELS');
});

test('getFallbackModel returns null (no local fallback)', () => {
  assert.equal(getFallbackModel('darkmatter-v1', 'oom'), null);
  assert.equal(getFallbackModel('darkmatter-v1', 'timeout'), null);
  assert.equal(getFallbackModel('darkmatter-v1', 'no_reply'), null);
  assert.equal(getFallbackModel('muse-spark-1.3', 'oom'), null);
});

test('getFallbackModel returns null for unknown reason', () => {
  assert.equal(getFallbackModel('darkmatter-v1', 'unknown'), null);
});

test('getFallbackModel returns null for unknown model', () => {
  assert.equal(getFallbackModel('nonexistent', 'oom'), null);
});
