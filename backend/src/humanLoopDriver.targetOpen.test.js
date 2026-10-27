// TARGET-OPEN ON RESUME tests (27 Oct 2026, SEE-AND-CONTROL):
// the loop driver opens the target URL in the container browser
// once, before the first cycle of a resume/start, so the brain's
// first screen is the real target instead of about:blank.
//
//   OPEN-1  a successful open records one driver browser_open
//           tool_call and returns opened:true with the attempt count.
//   OPEN-2  transient failures are retried (bounded) until success.
//   OPEN-3  a degraded (headless look-only) success does NOT count
//           as opened — the visible browser is still blank.
//   OPEN-4  permanent failure gives up after maxAttempts, never
//           throws, and records no tool_call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoopDriver (via humanLoop/store)
// is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-target-open-'));
process.env.DATA_DIR = tmpRoot;

const { openTargetOnResume } = await import('./humanLoopDriver.js');

const TARGET = 'http://172.17.0.1:3100/';

function harness(guiOpenImpl, opts = {}) {
  const recorded = [];
  const thoughts = [];
  const sleeps = [];
  return {
    recorded,
    thoughts,
    sleeps,
    run: () => openTargetOnResume('h_target_open_test', TARGET, {
      guiOpen: guiOpenImpl,
      record: (h, e) => { recorded.push(e); },
      think: (h, t) => { thoughts.push(t); },
      sleep: async (ms) => { sleeps.push(ms); },
      maxAttempts: opts.maxAttempts ?? 6,
      retryMs: opts.retryMs ?? 10,
    }),
  };
}

test('OPEN-1 a successful open records one driver browser_open and returns opened:true', async () => {
  const h = harness(async () => ({ ok: true, observation: `Opened ${TARGET} in your desktop browser.` }));
  const res = await h.run();
  assert.equal(res.opened, true);
  assert.equal(res.attempts, 1);
  assert.equal(h.sleeps.length, 0);
  const calls = h.recorded.filter((e) => e.type === 'tool_call');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool, 'browser_open');
  assert.equal(calls[0].detail, TARGET);
  assert.equal(calls[0].via, 'driver-target-open');
  assert.equal(h.thoughts.length, 1);
  assert.match(h.thoughts[0], /Opened the target in the browser/);
});

test('OPEN-2 transient failures are retried until success', async () => {
  let n = 0;
  const h = harness(async () => {
    n++;
    if (n < 3) return { ok: false, observation: 'browser_open failed: CDP websocket failed' };
    return { ok: true, observation: `Opened ${TARGET} in your desktop browser.` };
  });
  const res = await h.run();
  assert.equal(res.opened, true);
  assert.equal(res.attempts, 3);
  assert.equal(h.sleeps.length, 2);
  assert.equal(h.recorded.filter((e) => e.type === 'tool_call').length, 1);
});

test('OPEN-3 a degraded (headless look-only) success does NOT count as opened', async () => {
  const h = harness(async () => ({ ok: true, degraded: true, observation: `Opened ${TARGET} (headless preview …)` }), { maxAttempts: 3 });
  const res = await h.run();
  assert.equal(res.opened, false);
  assert.equal(res.attempts, 3);
  assert.equal(h.sleeps.length, 2);
  assert.equal(h.recorded.filter((e) => e.type === 'tool_call').length, 0);
  assert.equal(h.thoughts.length, 1);
  assert.match(h.thoughts[0], /Could not open the target/);
});

test('OPEN-4 permanent failure gives up after maxAttempts, never throws, records no tool_call', async () => {
  const h = harness(async () => { throw new Error('CDP timeout'); }, { maxAttempts: 4 });
  const res = await h.run();
  assert.equal(res.opened, false);
  assert.equal(res.attempts, 4);
  assert.equal(h.sleeps.length, 3);
  assert.equal(h.recorded.filter((e) => e.type === 'tool_call').length, 0);
  assert.equal(h.thoughts.length, 1);
  assert.match(h.thoughts[0], /Could not open the target/);
});
