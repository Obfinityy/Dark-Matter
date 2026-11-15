// Scanner hunt Link → Report mode (15 Nov 2026, owner order).
//
// runScannerHunt with opts.runMode === 'link-to-report' must:
//   - force the scanner lane and run the full ordered 159-phase
//     battery even at scanDepth 'quick' (the quick subset must never
//     narrow an ordered run);
//   - record runMode + owaspStages (version + table) in hunt meta;
//   - emit exactly one stage_started + one stage_finished event per
//     stage (12 stages), and carry the per-stage rollup in the
//     scanner_finished summary.
// A plain (non-ordered) run emits no stage events and records no
// runMode. Contained: DATA_DIR points at a fresh temp dir, fetch is
// stubbed, nuclei is stubbed via the opts.nucleiRunner test seam —
// no network, no docker, $0.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAGE_HTML = `<html><head><title>t</title></head><body>
<a href="/a">a</a>
<form action="/s" method="get"><input name="q"></form>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-link-report-'));
process.env.DATA_DIR = tmp;
const realFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  status: 200,
  headers: new Headers({ server: 'nginx/1.24' }),
  text: async () => PAGE_HTML,
});

const { runScannerHunt, buildScannerFindingRecords } = await import('./scannerHunt.js');
const { readHuntEvents, readHuntMeta } = await import('./store.js');

const STAGE_CODES = ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'Additional'];
const noNuclei = { nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) };
const noSideEffects = {
  teardownContainer: async () => false,
  drainQueue: async () => {},
};

test('link-to-report run records meta, stage events and stage rollup', async () => {
  const huntId = 'h_link_report';
  const res = await runScannerHunt(huntId, 'http://example.com/', {
    scanDepth: 'quick',
    scope: 'example.com',
    runMode: 'link-to-report',
    ...noNuclei,
    ...noSideEffects,
  });
  assert.equal(res.ok, true);

  const meta = readHuntMeta(huntId);
  assert.equal(meta.runMode, 'link-to-report');
  assert.equal(meta.brainMode, 'scanner');
  assert.equal(meta.owaspStages.version, '20261115-v1');
  assert.equal(meta.owaspStages.stages.length, 12);
  assert.equal(meta.owaspStages.stages.flatMap((s) => s.phases).length, 159);

  const events = readHuntEvents(huntId);
  const started = events.filter((e) => e.type === 'stage_started');
  const finished = events.filter((e) => e.type === 'stage_finished');
  assert.equal(started.length, 12, 'one stage_started per stage');
  assert.equal(finished.length, 12, 'one stage_finished per stage');
  assert.deepEqual(finished.map((e) => e.stage), STAGE_CODES, 'finished events in stage order');
  for (const f of finished) {
    assert.equal(typeof f.phasesTotal, 'number');
    assert.equal(f.phasesRun + f.phasesNotRun, f.phasesTotal);
  }
  // The full battery ran despite scanDepth 'quick': every one of
  // the 159 phases left at least one phase record.
  const phaseNames = new Set(events.filter((e) => e.type === 'phase').map((e) => e.name));
  assert.equal(phaseNames.size, 159);

  const done = events.find((e) => e.type === 'status' && e.state === 'scanner_finished');
  assert.ok(done && done.summary);
  assert.equal(done.summary.stages.length, 12);
  assert.equal(done.summary.owaspStagesVersion, '20261115-v1');
  assert.equal(
    done.summary.stages.reduce((n, s) => n + s.phasesTotal, 0),
    159
  );
});

test('plain scanner run emits no stage events and records no runMode', async () => {
  const huntId = 'h_plain_scan';
  const res = await runScannerHunt(huntId, 'http://example.com/', {
    scanDepth: 'quick',
    scope: 'example.com',
    ...noNuclei,
    ...noSideEffects,
  });
  assert.equal(res.ok, true);
  const meta = readHuntMeta(huntId);
  assert.equal(meta.runMode, undefined);
  assert.equal(meta.owaspStages, undefined);
  const events = readHuntEvents(huntId);
  assert.equal(events.filter((e) => e.type === 'stage_started').length, 0);
  assert.equal(events.filter((e) => e.type === 'stage_finished').length, 0);
});

// PHASE CARRY-THROUGH (15 Nov 2026, Lane A2): the .phase drop.
//
// runScan tags each finding with its producing phase (scanner/index.js
// tagPhase) when owaspStages is enabled, and the report attributes
// findings to OWASP stages ONLY via scanner_finding.finding.phase
// (report.js buildOwaspReportSections). buildScannerFindingRecords
// used to build both events WITHOUT .phase, so every finding fell
// through to the unattributed bucket and the stage sections rendered
// empty even on a 28-finding lab run. Both events must carry the
// phase through; a phaseless finding carries null — never an invented
// phase.
test('buildScannerFindingRecords carries .phase through to both events', () => {
  const tagged = {
    class: 'xss',
    title: 'reflected xss in search parameter',
    severity: 'medium',
    url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test',
    param: 'name',
    evidence: { request: 'GET /xss_r/?name=<script>', response: 'HTTP/1.1 200 OK' },
    confirmation: 'confirmed',
    phase: 'xss',
  };
  const [raw, surface] = buildScannerFindingRecords(tagged);
  assert.equal(raw.type, 'scanner_finding');
  assert.equal(raw.finding.phase, 'xss', 'report attribution key survives on the raw record');
  assert.equal(surface.type, 'finding');
  assert.equal(surface.phase, 'xss', 'product-surface event carries the phase too');
  // The rest of the record is untouched by the carry-through.
  assert.equal(raw.finding.title, tagged.title);
  assert.equal(surface.verified, true);
});

test('buildScannerFindingRecords never invents a phase: phaseless stays null', () => {
  const untagged = {
    class: 'xss',
    title: 'reflected xss in search parameter',
    severity: 'medium',
    url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test',
    param: 'name',
    evidence: null,
    confirmation: 'confirmed',
  };
  const [raw, surface] = buildScannerFindingRecords(untagged);
  assert.equal(raw.finding.phase, null);
  assert.equal(surface.phase, null);
  // A null/undefined input is not a crash either.
  const [raw2, surface2] = buildScannerFindingRecords(null);
  assert.equal(raw2.finding.phase, null);
  assert.equal(surface2.phase, null);
});
