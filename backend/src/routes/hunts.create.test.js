// Create-path normalization + list mapping tests (5 Nov 2026, Re-run fix).
//
// Regression: Re-run on an Autonomous (scanner) hunt created an AI hunt.
// The backend honours the brainMode it is sent (normalizeHuntCreate) and
// the list now carries scanDepth (mapListHunt) so a restored hunt card
// can inherit the source hunt's mode + depth. The drop was in the
// frontend's restored card (App.jsx syncHunt mint) — see
// frontend/src/lib/huntMode.test.js — but these rules are pinned here
// so a future backend change cannot silently re-break the contract:
//
//   POST { brainMode: 'scanner', forceNew: true } -> scanner hunt
//   POST {} (no brainMode)                        -> ai hunt (default)
//   GET / list item                               -> carries mode,
//     brainMode AND scanDepth for every hunt.

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHuntCreate, mapListHunt, pickExistingHunt } from './hunts.js';

// --- normalizeHuntCreate -------------------------------------------------

test('scanner stays scanner', () => {
  assert.deepEqual(normalizeHuntCreate({ brainMode: 'scanner', scanDepth: 'deep' }), {
    brainMode: 'scanner',
    scanDepth: 'deep',
  });
});

test('ai stays ai', () => {
  assert.deepEqual(normalizeHuntCreate({ brainMode: 'ai', scanDepth: 'quick' }), {
    brainMode: 'ai',
    scanDepth: 'quick',
  });
});

test('omitted brainMode defaults to ai (Re-run must send it explicitly)', () => {
  assert.deepEqual(normalizeHuntCreate({}), { brainMode: 'ai', scanDepth: 'standard' });
  assert.deepEqual(normalizeHuntCreate(undefined), { brainMode: 'ai', scanDepth: 'standard' });
  assert.deepEqual(normalizeHuntCreate(null), { brainMode: 'ai', scanDepth: 'standard' });
});

test('junk brainMode falls back to ai, never throws', () => {
  for (const junk of ['Scanner', 'SCANNER', 'auto', '', 0, true]) {
    assert.equal(normalizeHuntCreate({ brainMode: junk }).brainMode, 'ai');
  }
});

test('scanDepth: quick/deep pass through, anything else is standard', () => {
  assert.equal(normalizeHuntCreate({ scanDepth: 'quick' }).scanDepth, 'quick');
  assert.equal(normalizeHuntCreate({ scanDepth: 'deep' }).scanDepth, 'deep');
  for (const junk of ['standard', 'turbo', '', null, undefined, 0]) {
    assert.equal(normalizeHuntCreate({ scanDepth: junk }).scanDepth, 'standard');
  }
});

// --- mapListHunt -----------------------------------------------------------

const fullMeta = {
  huntId: 'h_071a785a82a4',
  target: 'http://172.17.0.1:3100',
  scope: 'lab',
  mode: 'infinity',
  brainMode: 'scanner',
  scanDepth: 'deep',
  createdAt: '2026-11-03T14:00:00.000Z',
  state: 'stopped',
};

test('list item carries mode + brainMode + scanDepth', () => {
  const item = mapListHunt(fullMeta);
  assert.equal(item.huntId, 'h_071a785a82a4');
  assert.equal(item.target, 'http://172.17.0.1:3100');
  assert.equal(item.scope, 'lab');
  assert.equal(item.mode, 'infinity');
  assert.equal(item.brainMode, 'scanner');
  assert.equal(item.scanDepth, 'deep');
  assert.equal(item.createdAt, '2026-11-03T14:00:00.000Z');
  assert.equal('status' in item, false, 'status is added live by the handler, not the mapper');
});

test('legacy meta (nothing recorded) reports the historical defaults', () => {
  const item = mapListHunt({ huntId: 'h_old', target: 'http://example.com/' });
  assert.equal(item.mode, 'normal');
  assert.equal(item.brainMode, 'ai');
  assert.equal(item.scanDepth, 'standard');
  assert.equal(item.scope, null);
  assert.equal(item.createdAt, null);
});

test('junk scanDepth on a meta normalizes to standard', () => {
  assert.equal(mapListHunt({ ...fullMeta, scanDepth: 'turbo' }).scanDepth, 'standard');
  assert.equal(mapListHunt({ ...fullMeta, scanDepth: null }).scanDepth, 'standard');
});

test('null meta does not throw', () => {
  const item = mapListHunt(null);
  assert.equal(item.brainMode, 'ai');
  assert.equal(item.scanDepth, 'standard');
  assert.equal(item.mode, 'normal');
});

// --- dedup + forceNew contract (documents the handler branch) -------------
// The handler skips pickExistingHunt entirely when forceNew/fresh is true
// (routes/hunts.js create). That branch is only reachable over HTTP, so
// pin the underlying rule here: a scanner Re-run must match the SCANNER
// hunt (not the AI one) for the same target.

test('dedup is mode-scoped: scanner Re-run matches the scanner hunt', () => {
  const metas = [
    { huntId: 'h_ai', userId: 'u1', target: 'http://172.17.0.1:3100', state: 'stopped', brainMode: 'ai' },
    { huntId: 'h_scan', userId: 'u1', target: 'http://172.17.0.1:3100', state: 'stopped', brainMode: 'scanner' },
  ];
  const got = pickExistingHunt(metas, 'u1', 'http://172.17.0.1:3100', 'scanner');
  assert.equal(got && got.huntId, 'h_scan');
});
