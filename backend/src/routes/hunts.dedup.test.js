// Mode-scoped hunt dedup tests (3 Nov 2026).
//
// pickExistingHunt matches (userId, canonical target, brainMode): an AI
// hunt and an automation (scanner) hunt for the same target are different
// hunts, so choosing "With Automation" for an already-hunted target starts
// a fresh scan instead of reopening the old AI hunt.

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickExistingHunt } from './hunts.js';

const U = 'user-1';
const T = 'http://172.17.0.1:3100';
const meta = (over = {}) => ({
  huntId: 'h_x',
  userId: U,
  target: T,
  state: 'finished',
  brainMode: 'ai',
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

test('same target + same mode dedupes (ai)', () => {
  const got = pickExistingHunt([meta({ huntId: 'h_ai' })], U, T, 'ai');
  assert.equal(got && got.huntId, 'h_ai');
});

test('same target + same mode dedupes (scanner)', () => {
  const got = pickExistingHunt([meta({ huntId: 'h_scan', brainMode: 'scanner' })], U, T, 'scanner');
  assert.equal(got && got.huntId, 'h_scan');
});

test('an ai hunt does not block a new scanner hunt for the same target', () => {
  assert.equal(pickExistingHunt([meta({ huntId: 'h_ai', brainMode: 'ai' })], U, T, 'scanner'), null);
});

test('a scanner hunt does not block a new ai hunt for the same target', () => {
  assert.equal(pickExistingHunt([meta({ huntId: 'h_scan', brainMode: 'scanner' })], U, T, 'ai'), null);
});

test('hunts without a recorded brainMode count as ai', () => {
  const old = meta({ huntId: 'h_old' });
  delete old.brainMode;
  const gotAi = pickExistingHunt([old], U, T, 'ai');
  assert.equal(gotAi && gotAi.huntId, 'h_old');
  assert.equal(pickExistingHunt([old], U, T, 'scanner'), null);
});

test('different user never dedupes', () => {
  assert.equal(pickExistingHunt([meta({ huntId: 'h_ai' })], 'user-2', T, 'ai'), null);
});

test('different target never dedupes', () => {
  assert.equal(pickExistingHunt([meta({ huntId: 'h_ai' })], U, 'http://example.com/', 'ai'), null);
});

test('target variants still canonicalize (scheme / www / trailing slash)', () => {
  const got = pickExistingHunt(
    [meta({ huntId: 'h_ai', target: 'https://www.172.17.0.1:3100/' })],
    U,
    'http://172.17.0.1:3100',
    'ai'
  );
  assert.equal(got && got.huntId, 'h_ai');
});

test('prefers running over finished within the same mode', () => {
  const finished = meta({ huntId: 'h_old', state: 'finished' });
  const running = meta({ huntId: 'h_run', state: 'running' });
  const got = pickExistingHunt([finished, running], U, T, 'ai');
  assert.equal(got && got.huntId, 'h_run');
});

test('omitted brainMode keeps the legacy target-only match', () => {
  const got = pickExistingHunt([meta({ huntId: 'h_scan', brainMode: 'scanner' })], U, T);
  assert.equal(got && got.huntId, 'h_scan');
});
