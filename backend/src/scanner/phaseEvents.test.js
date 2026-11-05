// Dark Matter scanner — phase-visibility tests (5 Nov 2026).
//
// REGRESSION: step() emitted ZERO phase events for any of the 63 phases;
// exceptions were swallowed into errors[] (returned, never persisted) and
// the nuclei step kept only .findings from runNuclei's {ok, timedOut,
// findings, stderr} — a finished 63-phase deep scan left 13 event lines,
// zero per-phase record, zero timing, zero error trace.
//
// The fix: step() records every executed step into runScan's `phases`
// array (and streams it via opts.onPhase); the nuclei record additionally
// carries ok/timedOut/stderrTail. No network, no docker in these tests —
// fetch is stubbed and nuclei runs through the opts.nucleiRunner seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runScan } from './index.js';

const PAGE_HTML = `<html><head><title>t</title></head><body>
<a href="/a">a</a>
<form action="/s" method="get"><input name="q"></form>
</body></html>`;

const realFetch = globalThis.fetch;

function stubFetch() {
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers({ server: 'nginx/1.24' }),
    text: async () => PAGE_HTML,
  });
}

function stubFetchThrowing(message = 'mock network down') {
  globalThis.fetch = async () => {
    throw new Error(message);
  };
}

function teardown() {
  globalThis.fetch = realFetch;
}

function assertPhaseShape(p) {
  assert.equal(typeof p.name, 'string');
  assert.ok(p.name.length > 0);
  assert.ok(!Number.isNaN(Date.parse(p.startedAt)), 'startedAt is ISO');
  assert.ok(!Number.isNaN(Date.parse(p.finishedAt)), 'finishedAt is ISO');
  assert.ok(Date.parse(p.finishedAt) >= Date.parse(p.startedAt));
  assert.equal(typeof p.durationMs, 'number');
  assert.ok(p.durationMs >= 0);
  assert.equal(typeof p.ok, 'boolean');
  assert.ok(p.error === null || typeof p.error === 'string');
  assert.equal(typeof p.findingsCount, 'number');
  assert.ok(p.findingsCount >= 0);
}

describe('runScan phase records', () => {
  it('returns a phases array with one record per executed step', async () => {
    stubFetch();
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers'],
        },
        { timeoutMs: 5000 }
      );
      assert.ok(Array.isArray(result.phases));
      assert.equal(result.phases.length, 4);
      assert.deepEqual(
        result.phases.map((p) => p.name),
        ['fingerprint', 'crawl', 'page-analyze', 'headers']
      );
      for (const p of result.phases) {
        assertPhaseShape(p);
        assert.equal(p.ok, true);
        assert.equal(p.error, null);
      }
      // headers phase runs probeHeaders on a header-less stub page, so it
      // finds missing-header findings; fingerprint/crawl/page-analyze
      // return objects, not finding arrays.
      const headers = result.phases.find((p) => p.name === 'headers');
      assert.ok(headers.findingsCount >= 1);
      assert.equal(result.phases.find((p) => p.name === 'fingerprint').findingsCount, 0);
      // errors[] is kept for backward compatibility (empty on success).
      assert.deepEqual(result.errors, []);
    } finally {
      teardown();
    }
  });

  it('records ok:false + the error message for a throwing phase (nothing vanishes)', async () => {
    stubFetchThrowing('mock network down');
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers'],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(result.phases.length, 4);
      const fp = result.phases.find((p) => p.name === 'fingerprint');
      assert.equal(fp.ok, false);
      assert.match(fp.error, /mock network down/);
      const crawl = result.phases.find((p) => p.name === 'crawl');
      assert.equal(crawl.ok, false);
      assert.match(crawl.error, /mock network down/);
      // page-analyze swallows its fetch failure internally and returns
      // null — it records ok:true with 0 findings, not a phantom error.
      const pa = result.phases.find((p) => p.name === 'page-analyze');
      assert.equal(pa.ok, true);
      assert.equal(pa.error, null);
      assert.equal(pa.findingsCount, 0);
      // headers with no fingerprint returns [] — ok:true, 0 findings.
      const headers = result.phases.find((p) => p.name === 'headers');
      assert.equal(headers.ok, true);
      assert.equal(headers.findingsCount, 0);
      // errors[] still carries the messages (backward compat).
      assert.ok(result.errors.some((e) => e.startsWith('fingerprint: mock network down')));
      assert.ok(result.errors.some((e) => e.startsWith('crawl: mock network down')));
    } finally {
      teardown();
    }
  });

  it('nuclei phase record carries ok/timedOut/stderrTail on a timed-out run', async () => {
    stubFetch();
    try {
      const fakeNuclei = async () => ({
        ok: false,
        timedOut: true,
        findings: [],
        stderr: 'x'.repeat(1200),
      });
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['nuclei'],
        },
        { timeoutMs: 5000, nucleiRunner: fakeNuclei }
      );
      assert.equal(result.phases.length, 1);
      const nuc = result.phases[0];
      assertPhaseShape(nuc);
      assert.equal(nuc.name, 'nuclei');
      // The tool's own ok is the meaningful ok for this phase.
      assert.equal(nuc.ok, false);
      assert.equal(nuc.timedOut, true);
      assert.equal(nuc.stderrTail, 'x'.repeat(500));
      assert.equal(nuc.findingsCount, 0);
      // A tool failure that does not throw leaves error null — the
      // failure is visible via ok/timedOut/stderrTail, not a phantom error.
      assert.equal(nuc.error, null);
    } finally {
      teardown();
    }
  });

  it('nuclei phase record carries ok:true + empty stderrTail on success, findings flow through', async () => {
    stubFetch();
    try {
      const finding = {
        class: 'nuclei',
        id: 'dvwa-default-login',
        title: 'DVWA Default Login',
        severity: 'critical',
        url: 'http://example.com/',
        evidence: {
          request: 'nuclei dvwa-default-login vs http://example.com/',
          response: 'matched at http://example.com/',
          impact_demo: 'default credentials work',
          signalCorrelated: true,
        },
      };
      const fakeNuclei = async () => ({
        ok: true,
        timedOut: false,
        findings: [finding],
        stderr: '',
      });
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['nuclei'],
        },
        { timeoutMs: 5000, nucleiRunner: fakeNuclei }
      );
      const nuc = result.phases[0];
      assert.equal(nuc.ok, true);
      assert.equal(nuc.timedOut, false);
      assert.equal(nuc.stderrTail, '');
      assert.equal(nuc.findingsCount, 1);
      // Findings still flow into the scan results exactly as before.
      const all = [...(result.findings || []), ...(result.unconfirmed || [])];
      assert.equal(all.length, 1);
      assert.equal(all[0].id, 'dvwa-default-login');
    } finally {
      teardown();
    }
  });

  it('opts.onPhase is invoked once per executed step, with the same records', async () => {
    stubFetch();
    try {
      const seen = [];
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers'],
        },
        { timeoutMs: 5000, onPhase: (p) => seen.push(p) }
      );
      assert.equal(seen.length, result.phases.length);
      assert.deepEqual(
        seen.map((p) => p.name),
        result.phases.map((p) => p.name)
      );
      for (let i = 0; i < seen.length; i++) assert.equal(seen[i], result.phases[i]);
    } finally {
      teardown();
    }
  });

  it('a throwing onPhase listener can NEVER break the scan', async () => {
    stubFetch();
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers'],
        },
        {
          timeoutMs: 5000,
          onPhase: () => {
            throw new Error('listener exploded');
          },
        }
      );
      assert.equal(result.phases.length, 4);
      assert.ok(result.phases.every((p) => p.ok));
      assert.ok((result.findings || []).length >= 1);
    } finally {
      teardown();
    }
  });
});
