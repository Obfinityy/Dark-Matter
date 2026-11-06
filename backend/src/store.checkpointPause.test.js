// Checkpoint-pause invariant tests (6 Nov 2026, ai_no_reply fix).
//
// The circuit-breaker pause in huntAgent.js wrote
// {state:'paused', pausedReason} WITHOUT paused:true, leaving hunts
// state=paused but paused!==true (h_6e909d3c1965, h_bench_6eec511f,
// h_parent_test_20261102). Two layers now guard it:
//   1. the call site sends paused:true (like every other pause path);
//   2. writeHuntMetaCheckpoint normalises state:'paused' to
//      paused:true, so no loop-side writer can repeat the omission.
// Asserted here (temp DATA_DIR, no network, no docker):
//   - a flag-less pause patch still lands paused:true (layer 2);
//   - the fixed call-site patch lands paused:true (layer 1 contract);
//   - the owner-hold preservation still wins over loop patches;
//   - a legacy broken meta (state paused, flag missing) is repaired
//     by the next checkpoint write;
//   - ordinary progress writes are unaffected.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-checkpoint-pause-'));
process.env.DATA_DIR = tmp;

const { writeHuntMeta, readHuntMeta, writeHuntMetaCheckpoint } = await import('./store.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function seed(huntId, meta) {
  writeHuntMeta(huntId, { huntId, createdAt: new Date().toISOString(), ...meta });
}

test('flag-less pause patch still lands paused:true', () => {
  seed('h_flagless', { state: 'running', iteration: 296 });
  writeHuntMetaCheckpoint('h_flagless', { state: 'paused', pausedReason: 'ai_no_reply' });
  const meta = readHuntMeta('h_flagless');
  assert.equal(meta.state, 'paused');
  assert.equal(meta.paused, true);
  assert.equal(meta.pausedReason, 'ai_no_reply');
  assert.equal(meta.iteration, 296);
});

test('fixed call-site patch lands paused:true', () => {
  seed('h_callsite', { state: 'running', iteration: 50 });
  writeHuntMetaCheckpoint('h_callsite', { state: 'paused', paused: true, pausedReason: 'ai_no_reply' });
  const meta = readHuntMeta('h_callsite');
  assert.equal(meta.state, 'paused');
  assert.equal(meta.paused, true);
  assert.equal(meta.pausedReason, 'ai_no_reply');
});

test('owner hold still wins over a loop patch', () => {
  seed('h_hold', { state: 'paused', paused: true, pausedReason: 'user' });
  writeHuntMetaCheckpoint('h_hold', { state: 'running', iteration: 300 });
  const meta = readHuntMeta('h_hold');
  assert.equal(meta.state, 'paused');
  assert.equal(meta.paused, true);
  assert.equal(meta.pausedReason, 'user');
  assert.equal(meta.iteration, 300);
});

test('legacy broken meta (state paused, flag missing) is repaired', () => {
  seed('h_legacy', { state: 'paused', pausedReason: 'ai_no_reply', iteration: 124 });
  writeHuntMetaCheckpoint('h_legacy', { iteration: 125 });
  const meta = readHuntMeta('h_legacy');
  assert.equal(meta.state, 'paused');
  assert.equal(meta.paused, true);
  assert.equal(meta.pausedReason, 'ai_no_reply');
  assert.equal(meta.iteration, 125);
});

test('ordinary progress writes are unaffected', () => {
  seed('h_progress', { state: 'running', iteration: 7 });
  writeHuntMetaCheckpoint('h_progress', { iteration: 8 });
  const meta = readHuntMeta('h_progress');
  assert.equal(meta.state, 'running');
  assert.equal(meta.paused, undefined);
  assert.equal(meta.iteration, 8);
});
