// Re-run inheritance tests (5 Nov 2026, Re-run brainMode fix).
//
// Regression: Re-run on an Autonomous (scanner) hunt created an AI hunt
// because the restored hunt card carried no brainMode/scanDepth/mode and
// handleRerunHunt fell back to `hunt.brainMode || 'ai'`. These pure
// helpers are the fix's testable seam: the card value wins, otherwise
// the source hunt's real lane/depth is resolved from the backend, and
// the historical default applies only when nothing is fetchable.
// Run with plain node --test (no frontend runner exists in this repo).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHuntMode,
  resolveHuntBrainMode,
  resolveHuntScanDepth,
  resolveHuntScanScope,
  huntCardFromListEntry,
} from './huntMode.js';

const scannerCard = { huntId: 'h_scan', target: 'http://172.17.0.1:3100', brainMode: 'scanner', scanDepth: 'deep', scanScope: 'site', mode: 'infinity' };
const aiCard = { huntId: 'h_ai', target: 'http://172.17.0.1:3100', brainMode: 'ai', scanDepth: 'quick', scanScope: 'page', mode: 'infinity' };
// A card minted before the fix (App.jsx syncHunts restore): no lane/depth.
const legacyCard = { huntId: 'h_old', target: 'http://172.17.0.1:3100', status: 'stopped' };

const neverCalled = async () => { throw new Error('fetcher must not be called when the card carries the value'); };

// --- resolveHuntBrainMode --------------------------------------------------

test('card scanner wins without a fetch (the 5 Nov regression case)', async () => {
  assert.equal(await resolveHuntBrainMode(scannerCard, neverCalled), 'scanner');
});

test('card ai wins without a fetch', async () => {
  assert.equal(await resolveHuntBrainMode(aiCard, neverCalled), 'ai');
});

test('legacy card resolves the lane from GET /:id/brain-mode', async () => {
  const fetchBrainMode = async (id) => {
    assert.equal(id, 'h_old');
    return { ok: true, data: { brainMode: 'scanner', state: 'stopped' } };
  };
  assert.equal(await resolveHuntBrainMode(legacyCard, fetchBrainMode), 'scanner');
});

test('legacy card with an ai hunt behind it resolves to ai', async () => {
  const fetchBrainMode = async () => ({ ok: true, data: { brainMode: 'ai', state: 'finished' } });
  assert.equal(await resolveHuntBrainMode(legacyCard, fetchBrainMode), 'ai');
});

test('unfetchable lane falls back to ai (the backend default)', async () => {
  const failing = async () => { throw new Error('backend down'); };
  assert.equal(await resolveHuntBrainMode(legacyCard, failing), 'ai');
  assert.equal(await resolveHuntBrainMode({ huntId: 'h_x' }, failing), 'ai');
  assert.equal(await resolveHuntBrainMode(null, failing), 'ai');
});

test('junk lane from the backend falls back to ai', async () => {
  const junk = async () => ({ ok: true, data: { brainMode: 'Scanner' } });
  assert.equal(await resolveHuntBrainMode(legacyCard, junk), 'ai');
});

// --- resolveHuntScanDepth --------------------------------------------------

test('card depth wins without a fetch', async () => {
  assert.equal(await resolveHuntScanDepth(scannerCard, neverCalled), 'deep');
  assert.equal(await resolveHuntScanDepth(aiCard, neverCalled), 'quick');
});

test('legacy card resolves depth from GET /:id meta', async () => {
  const fetchHunt = async (id) => {
    assert.equal(id, 'h_old');
    return { ok: true, data: { hunt: { huntId: 'h_old', scanDepth: 'quick' } } };
  };
  assert.equal(await resolveHuntScanDepth(legacyCard, fetchHunt), 'quick');
});

test('unfetchable or junk depth falls back to standard', async () => {
  const failing = async () => { throw new Error('backend down'); };
  assert.equal(await resolveHuntScanDepth(legacyCard, failing), 'standard');
  const junk = async () => ({ ok: true, data: { hunt: { scanDepth: 'turbo' } } });
  assert.equal(await resolveHuntScanDepth(legacyCard, junk), 'standard');
  assert.equal(await resolveHuntScanDepth(null, failing), 'standard');
});

// --- resolveHuntScanScope (9 Nov 2026, /* owner order) -------------------
// A Re-run of a whole-site hunt must crawl the whole site again, never
// silently fall back to one page. Same resolution order as depth:
// card value -> GET /:id meta -> historical default 'page'.

test('card scope wins without a fetch', async () => {
  assert.equal(await resolveHuntScanScope(scannerCard, neverCalled), 'site');
  assert.equal(await resolveHuntScanScope(aiCard, neverCalled), 'page');
});

test('legacy card resolves scope from GET /:id meta', async () => {
  const fetchHunt = async (id) => {
    assert.equal(id, 'h_old');
    return { ok: true, data: { hunt: { huntId: 'h_old', scanScope: 'site' } } };
  };
  assert.equal(await resolveHuntScanScope(legacyCard, fetchHunt), 'site');
});

test('unfetchable or junk scope falls back to page', async () => {
  const failing = async () => { throw new Error('backend down'); };
  assert.equal(await resolveHuntScanScope(legacyCard, failing), 'page');
  const junk = async () => ({ ok: true, data: { hunt: { scanScope: 'all' } } });
  assert.equal(await resolveHuntScanScope(legacyCard, junk), 'page');
  assert.equal(await resolveHuntScanScope(null, failing), 'page');
});

// --- huntCardFromListEntry ---------------------------------------------------

test('restored card carries everything Re-run inherits', () => {
  const card = huntCardFromListEntry({
    huntId: 'h_071a785a82a4',
    target: 'http://172.17.0.1:3100',
    scope: 'lab',
    mode: 'infinity',
    brainMode: 'scanner',
    scanDepth: 'deep',
    scanScope: 'site',
    createdAt: '2026-11-03T14:00:00.000Z',
    status: 'stopped',
  });
  assert.deepEqual(card, {
    huntId: 'h_071a785a82a4',
    target: 'http://172.17.0.1:3100',
    scope: 'lab',
    status: 'stopped',
    createdAt: '2026-11-03T14:00:00.000Z',
    mode: 'infinity',
    brainMode: 'scanner',
    scanDepth: 'deep',
    scanScope: 'site',
  });
});

test('legacy list entry reports the historical defaults', () => {
  const card = huntCardFromListEntry({ huntId: 'h_old', target: 'http://example.com/' });
  assert.equal(card.mode, 'normal');
  assert.equal(card.brainMode, 'ai');
  assert.equal(card.scanDepth, 'standard');
  assert.equal(card.scanScope, 'page');
  assert.equal(card.scope, '');
  assert.equal(card.status, 'unknown');
});

test('null list entry does not throw', () => {
  const card = huntCardFromListEntry(null);
  assert.equal(card.brainMode, 'ai');
  assert.equal(card.scanDepth, 'standard');
  assert.equal(card.scanScope, 'page');
  assert.equal(card.mode, 'normal');
});

// --- resolveHuntMode (unchanged behaviour, pinned) --------------------------

test('resolveHuntMode: card mode wins; missing resolves from detail', async () => {
  assert.equal(await resolveHuntMode({ mode: 'infinity' }, neverCalled), 'infinity');
  const fetchHunt = async () => ({ ok: true, data: { hunt: { mode: 'high' } } });
  assert.equal(await resolveHuntMode({ huntId: 'h_x' }, fetchHunt), 'high');
  const failing = async () => { throw new Error('down'); };
  assert.equal(await resolveHuntMode({ huntId: 'h_x' }, failing), 'infinity');
});
