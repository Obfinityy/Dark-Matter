// Scanner hunt container-cleanup tests (6 Nov 2026).
//
// REGRESSION: a scanner hunt's isolated container (dm-hunt-<huntId>)
// lingered forever after the scan ended — five orphans from finished
// lab hunts were still on EC2. runScannerHunt must now destroy the
// container on BOTH terminal paths (finish AND failure), after
// findings + meta are recorded, so a destroy failure can never lose
// findings or fail the hunt.
//
// The teardown is injected through the opts.teardownContainer test
// seam (same pattern as opts.drainQueue); production callers never
// pass it, and the real teardownHuntContainer (docker rm -f,
// idempotent) is the AI lane's long-standing teardown.
//
// Contained: DATA_DIR points at a fresh temp dir (set before any
// project module is imported, so config.js picks it up). No network,
// no docker, no real nuclei — global fetch is stubbed.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-scancleanup-test-'));
process.env.DATA_DIR = tmp;

const { runScannerHunt } = await import('../scannerHunt.js');
const { readHuntMeta, readHuntEvents } = await import('../store.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A 200 HTML response with no links, forms or parameters — every phase
// that needs a target input is skipped, the rest run and pass.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Map([['content-type', 'text/html']]),
  text: async () => '<html><body>hello</body></html>',
});

function hasContainerDestroyedEvent(huntId) {
  return readHuntEvents(huntId).some(
    (e) => e && e.type === 'status' && e.state === 'container_destroyed'
  );
}

test('runScannerHunt destroys the container when the scan finishes', async () => {
  const teardownCalls = [];
  const teardownContainer = async (huntId) => {
    teardownCalls.push(huntId);
    return true;
  };
  let drainCalls = 0;
  const res = await runScannerHunt('h_cleanup_finish', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(teardownCalls, ['h_cleanup_finish']);
  assert.equal(readHuntMeta('h_cleanup_finish').state, 'finished');
  assert.equal(hasContainerDestroyedEvent('h_cleanup_finish'), true);
  assert.equal(drainCalls, 1);
});

test('runScannerHunt destroys the container when the scan fails', async () => {
  const teardownCalls = [];
  const teardownContainer = async (huntId) => {
    teardownCalls.push(huntId);
    return true;
  };
  let drainCalls = 0;
  // An empty target makes runScan throw ('scanner: empty target') before
  // any phase runs — the failure path.
  const res = await runScannerHunt('h_cleanup_fail', '', {
    scanDepth: 'quick',
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer,
  });
  assert.equal(res.ok, false);
  assert.deepEqual(teardownCalls, ['h_cleanup_fail']);
  assert.equal(readHuntMeta('h_cleanup_fail').state, 'failed');
  assert.equal(hasContainerDestroyedEvent('h_cleanup_fail'), true);
  assert.equal(drainCalls, 1);
});

test('a teardown failure never fails the hunt or blocks the queue drain', async () => {
  const teardownContainer = async () => {
    throw new Error('docker daemon unreachable');
  };
  let drainCalls = 0;
  const res = await runScannerHunt('h_cleanup_teardown_err', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer,
  });
  assert.equal(res.ok, true);
  assert.equal(readHuntMeta('h_cleanup_teardown_err').state, 'finished');
  assert.equal(hasContainerDestroyedEvent('h_cleanup_teardown_err'), false);
  assert.equal(drainCalls, 1);
});

test('an already-gone container (teardown returns false) is a clean no-op', async () => {
  const teardownCalls = [];
  const teardownContainer = async (huntId) => {
    teardownCalls.push(huntId);
    return false;
  };
  const res = await runScannerHunt('h_cleanup_gone', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue: async () => {},
    teardownContainer,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(teardownCalls, ['h_cleanup_gone']);
  assert.equal(readHuntMeta('h_cleanup_gone').state, 'finished');
  assert.equal(hasContainerDestroyedEvent('h_cleanup_gone'), false);
});

// SITE CRAWL (9 Nov 2026, /* owner order): a whole-site hunt records
// its scope, the routes it scanned and the per-route finding rollup
// in the scanner_finished summary, and the scope on the meta summary
// — so the panel and the report can answer "which route had what".
// The stub page has no links, so the walk visits 1 page; the quick
// battery still finds the 5 missing-header findings on it, and the
// rollup lists all 5 titles under the root route.
const STUB_PAGE_TITLES = [
  'Missing Strict-Transport-Security header',
  'Missing Content-Security-Policy header',
  'Missing X-Frame-Options header (clickjacking)',
  'Missing X-Content-Type-Options header',
  'Missing Referrer-Policy header',
];
test('site scope: finished summary carries scanScope + routesScanned + findingsByRoute', async () => {
  const res = await runScannerHunt('h_site_scope', 'http://example.com/', {
    scanDepth: 'quick',
    scanScope: 'site',
    drainQueue: async () => {},
    teardownContainer: async () => true,
  });
  assert.equal(res.ok, true);
  assert.equal(readHuntMeta('h_site_scope').state, 'finished');
  assert.equal(readHuntMeta('h_site_scope').scannerSummary.scanScope, 'site');
  const events = readHuntEvents('h_site_scope');
  const finished = events.find((e) => e && e.type === 'status' && e.state === 'scanner_finished');
  assert.ok(finished, 'scanner_finished event recorded');
  assert.equal(finished.summary.scanScope, 'site');
  assert.equal(finished.summary.routesScanned, 1);
  assert.deepEqual(finished.summary.findingsByRoute, { 'http://example.com/': STUB_PAGE_TITLES });
  const started = events.find((e) => e && e.type === 'status' && e.state === 'scanner_started');
  assert.equal(started.scanScope, 'site');
});

test('page scope (default): finished summary carries scanScope page + 1 route', async () => {
  const res = await runScannerHunt('h_page_scope', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue: async () => {},
    teardownContainer: async () => true,
  });
  assert.equal(res.ok, true);
  assert.equal(readHuntMeta('h_page_scope').scannerSummary.scanScope, 'page');
  const events = readHuntEvents('h_page_scope');
  const finished = events.find((e) => e && e.type === 'status' && e.state === 'scanner_finished');
  assert.ok(finished, 'scanner_finished event recorded');
  assert.equal(finished.summary.scanScope, 'page');
  assert.equal(finished.summary.routesScanned, 1);
  assert.deepEqual(finished.summary.findingsByRoute, { 'http://example.com/': STUB_PAGE_TITLES });
});
