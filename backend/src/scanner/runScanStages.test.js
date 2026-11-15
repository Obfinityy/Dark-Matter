// runScan OWASP stage records (15 Nov 2026, Link → Report flow).
//
// When opts.owaspStages is set, runScan emits stageRecords alongside
// phaseRecords and tags every finding with its producing phase name.
// When it is absent (default), the result carries neither — no
// behaviour change for existing callers. No network, no docker:
// fetch is stubbed, nuclei is stubbed via opts.nucleiRunner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runScan } from './index.js';
import { STAGE_TABLE_VERSION } from './owaspStages.js';

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

test('runScan with owaspStages emits stageRecords + phase-tagged findings', async (t) => {
  stubFetch();
  t.after(() => { globalThis.fetch = realFetch; });
  const result = await runScan(
    {
      target: 'http://example.com/',
      scope: 'example.com',
      confirmedAuthorized: true,
      phases: ['fingerprint', 'crawl', 'page-analyze', 'headers', 'xss'],
    },
    {
      timeoutMs: 5000,
      nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }),
      owaspStages: true,
    }
  );
  assert.equal(result.owaspStagesVersion, STAGE_TABLE_VERSION);
  assert.ok(Array.isArray(result.stageRecords));
  assert.equal(result.stageRecords.length, 12, 'one record per stage, in order');
  assert.deepEqual(
    result.stageRecords.map((r) => r.code),
    ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'Additional']
  );
  assert.equal(
    result.stageRecords.reduce((n, r) => n + r.phasesTotal, 0),
    159
  );
  // Only the requested phases ran; the rest are honestly not-run.
  const rec = result.stageRecords.find((r) => r.code === 'REC');
  assert.ok(rec.phasesRun >= 3, 'fingerprint/crawl/page-analyze ran');
  assert.equal(rec.phasesRun + rec.phasesNotRun, 11);
  const a09 = result.stageRecords.find((r) => r.code === 'A09');
  assert.equal(a09.phasesRun, 0);
  assert.equal(a09.phasesNotRun, 1);
  // Every finding the run produced carries its phase, and the
  // per-stage confirmed counts agree with the tagged findings.
  for (const f of [...result.findings, ...result.unconfirmed]) {
    assert.ok(typeof f.phase === 'string' && f.phase.length > 0, `finding ${f.title} must be phase-tagged`);
  }
  const confirmedByStage = result.stageRecords.reduce((n, r) => n + r.confirmed, 0);
  assert.equal(confirmedByStage, result.findings.length);
  const unconfirmedByStage = result.stageRecords.reduce((n, r) => n + r.unconfirmed, 0);
  assert.equal(unconfirmedByStage, result.unconfirmed.length);
});

test('runScan without owaspStages emits no stageRecords and tags nothing', async (t) => {
  stubFetch();
  t.after(() => { globalThis.fetch = realFetch; });
  const result = await runScan(
    {
      target: 'http://example.com/',
      scope: 'example.com',
      confirmedAuthorized: true,
      phases: ['fingerprint', 'crawl', 'page-analyze', 'headers'],
    },
    {
      timeoutMs: 5000,
      nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }),
    }
  );
  assert.equal(result.stageRecords, undefined);
  assert.equal(result.owaspStagesVersion, undefined);
  for (const f of [...result.findings, ...result.unconfirmed]) {
    assert.equal(f.phase, undefined, 'no tagging when stages are off');
  }
});
