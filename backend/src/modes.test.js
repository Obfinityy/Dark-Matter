// MODE FIX lane (27 Oct 2026) — 'human' is a first-class hunt mode.
//
//   getMode('human') maps to 'normal' (it is not one of the six
//   intensity modes) — that silent mapping is what made "Start from
//   scratch" on a human-mode hunt create a normal-mode hunt: the
//   frontend fell back to 'normal' AND the backend would have mapped
//   'human' to 'normal' anyway. resolveHuntMode() preserves 'human';
//   everything else resolves through getMode() exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';

import { getMode, resolveHuntMode, HUNT_MODES } from './hunt-intel/modes.js';

test("resolveHuntMode preserves 'human' instead of mapping it to normal", () => {
  assert.equal(resolveHuntMode('human').id, 'human');
});

test('resolveHuntMode resolves the six intensity modes through getMode', () => {
  for (const id of ['normal', 'medium', 'high', 'ultra', 'max', 'infinity']) {
    assert.equal(resolveHuntMode(id).id, id);
  }
});

test('resolveHuntMode falls back to normal for unknown / missing modes', () => {
  for (const bad of ['bogus', '', null, undefined, 42]) {
    assert.equal(resolveHuntMode(bad).id, 'normal');
  }
});

test("getMode('human') still maps to normal — documents why resolveHuntMode exists", () => {
  assert.equal(getMode('human').id, 'normal');
  assert.equal(HUNT_MODES.human, undefined);
});
