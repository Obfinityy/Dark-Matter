// Scanner phase-visibility wiring test (5 Nov 2026).
//
// runScannerHunt must stream one type:'phase' event per executed step into
// the hunt's events.jsonl (via runScan's opts.onPhase) and carry a phase
// rollup (total/ok/failed/timedOut) in the scanner_finished summary.
//
// Contained: DATA_DIR points at a fresh temp dir (set before scannerHunt.js
// is imported, so config.js picks it up), fetch is stubbed, scanDepth is
// 'quick' (excludes the nuclei phase — no docker). No network, no docker,
// nothing touches the real hunt data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_HTML = `<html><head><title>t</title></head><body>
<a href="/a">a</a>
<form action="/s" method="get"><input name="q"></form>
</body></html>`;

const QUICK_PHASES = [
  'fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss', 'cmdi',
  'traversal', 'redirect', 'csrf', 'post-forms', 'cors', 'cookies',
];

test('runScannerHunt streams phase events and rolls them up in scanner_finished', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-phase-test-'));
  process.env.DATA_DIR = tmp;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers({ server: 'nginx/1.24' }),
    text: async () => PAGE_HTML,
  });
  try {
    // Dynamic import AFTER DATA_DIR is set — config.js reads it at load.
    const { runScannerHunt } = await import('./scannerHunt.js');
    const { readHuntEvents } = await import('./store.js');

    const huntId = 'h_phase_test';
    const res = await runScannerHunt(huntId, 'http://example.com/', {
      scanDepth: 'quick',
      scope: 'example.com',
    });
    assert.equal(res.ok, true);

    const events = readHuntEvents(huntId);
    const phases = events.filter((e) => e.type === 'phase');
    // One record per executed step invocation. Per-URL phases run once per
    // URL with params, and the stub page's GET form is re-discovered on
    // every fetched scan target (each with a unique random filler value),
    // so param phases repeat — the count is >= the quick list, and every
    // quick phase name appears at least once.
    assert.ok(phases.length >= QUICK_PHASES.length);
    for (const name of QUICK_PHASES) {
      assert.ok(
        phases.some((p) => p.name === name),
        `phase ${name} recorded`
      );
    }
    for (const p of phases) {
      assert.equal(typeof p.startedAt, 'string');
      assert.equal(typeof p.finishedAt, 'string');
      assert.equal(typeof p.durationMs, 'number');
      assert.ok(p.durationMs >= 0);
      assert.equal(typeof p.ok, 'boolean');
      assert.ok(p.error === null || typeof p.error === 'string');
      assert.equal(typeof p.findingsCount, 'number');
    }

    const finished = events.find(
      (e) => e.type === 'status' && e.state === 'scanner_finished'
    );
    assert.ok(finished, 'scanner_finished event recorded');
    assert.ok(finished.summary, 'finished summary present');
    const rollup = finished.summary.phases;
    assert.ok(rollup, 'phase rollup present in finished summary');
    assert.equal(rollup.total, phases.length);
    assert.equal(rollup.ok + rollup.failed, rollup.total);
    assert.equal(rollup.timedOut, 0);
    assert.equal(rollup.failed, phases.filter((p) => !p.ok).length);
  } finally {
    globalThis.fetch = realFetch;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
