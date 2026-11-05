// Scanner queue-drain tests (5 Nov 2026, queue-drain fix).
//
// runScannerHunt must drain the queue when the scan reaches a terminal
// state — on finish AND on failure — because the scanner lane is the
// one that actually runs (the AI loop is paused) and scannerHunt.js
// previously had zero queue references, so a queued Re-run sat forever.
//
// The drain is injected through the opts.drainQueue test seam (same
// pattern as runScan's opts.nucleiRunner); production callers never
// pass it, and the real drainQueue is covered by huntCreator.test.js.
//
// Contained: DATA_DIR points at a fresh temp dir (set before any
// project module is imported, so config.js picks it up). No network,
// no docker, no real nuclei — global fetch is stubbed.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-scandrain-test-'));
process.env.DATA_DIR = tmp;

const { runScannerHunt } = await import('./scannerHunt.js');
const { readHuntMeta } = await import('./store.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A 200 HTML response with no links, forms or parameters — every phase
// that needs a target input is skipped, the rest run and pass.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Map([['content-type', 'text/html']]),
  text: async () => '<html><body>hello</body></html>',
});

test('runScannerHunt drains the queue when the scan finishes', async () => {
  let drainCalls = 0;
  const drainQueue = async () => {
    drainCalls += 1;
  };
  const res = await runScannerHunt('h_drain_finish', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue,
  });
  assert.equal(res.ok, true);
  assert.equal(drainCalls, 1);
  assert.equal(readHuntMeta('h_drain_finish').state, 'finished');
});

test('runScannerHunt drains the queue when the scan fails', async () => {
  let drainCalls = 0;
  const drainQueue = async () => {
    drainCalls += 1;
  };
  // An empty target makes runScan throw ('scanner: empty target') before
  // any phase runs — the failure path.
  const res = await runScannerHunt('h_drain_fail', '', {
    scanDepth: 'quick',
    drainQueue,
  });
  assert.equal(res.ok, false);
  assert.equal(drainCalls, 1);
  assert.equal(readHuntMeta('h_drain_fail').state, 'failed');
});
