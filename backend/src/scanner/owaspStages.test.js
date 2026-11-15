// OWASP stage table tests (15 Nov 2026, Link → Report flow).
//
// The stage table is the product's run order (REC → A01..A10 →
// Additional), so the invariants are pinned hard: every one of the
// 159 DEFAULT_PHASES entries in exactly one stage, stages in the
// design §3.1 order, total 159 — plus the two Lane A corrections to
// design §4 v1 (dom-cookie-manipulation added to A03, document-domain
// moved A08 → A01) and the Go-sheet → OWASP 2021 bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PHASES } from './index.js';
import {
  OWASP_STAGES,
  GO_SHEET_TO_OWASP,
  STAGE_TABLE_VERSION,
  MCP_BLOCKED_REASON,
  orderedPhases,
  stageOfPhase,
  stageByCode,
  buildStageRecords,
} from './owaspStages.js';

test('stages are in the design §3.1 run order', () => {
  assert.deepEqual(
    OWASP_STAGES.map((s) => s.code),
    ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'Additional']
  );
});

test('every DEFAULT_PHASES entry is in exactly one stage; total 159', () => {
  assert.equal(DEFAULT_PHASES.length, 159);
  const all = OWASP_STAGES.flatMap((s) => s.phases);
  assert.equal(all.length, 159);
  assert.equal(new Set(all).size, 159, 'no phase in two stages');
  assert.deepEqual([...all].sort(), [...DEFAULT_PHASES].sort());
});

test('per-stage counts match the verified table', () => {
  const counts = Object.fromEntries(OWASP_STAGES.map((s) => [s.code, s.phases.length]));
  assert.deepEqual(counts, {
    REC: 11, A01: 14, A02: 11, A03: 55, A04: 10, A05: 13,
    A06: 2, A07: 17, A08: 5, A09: 1, A10: 7, Additional: 13,
  });
});

test('orderedPhases() is the flat stage-order list, 159 long', () => {
  const flat = orderedPhases();
  assert.equal(flat.length, 159);
  assert.deepEqual(flat, OWASP_STAGES.flatMap((s) => s.phases));
  // REC leads, Additional trails.
  assert.equal(flat[0], 'fingerprint');
  assert.equal(flat[flat.length - 1], 'mcp-tool-poisoning');
});

test('stageOfPhase / stageByCode spot checks (incl. the two Lane A corrections)', () => {
  // Design §4 v1 omission, fixed by Lane A: dom-cookie-manipulation
  // was in no stage list; it is a DOM-injection phase (A03).
  assert.equal(stageOfPhase('dom-cookie-manipulation'), 'A03');
  // Design §4 v1 move, by Lane A: probe header cites CWE-668 |
  // OWASP A01:2021 for document-domain (origin merging is an
  // access-control boundary failure, not A08 integrity).
  assert.equal(stageOfPhase('document-domain'), 'A01');
  assert.equal(stageOfPhase('mcp-tool-poisoning'), 'Additional');
  assert.equal(stageOfPhase('sensitive-data-in-logs'), 'A09');
  assert.equal(stageOfPhase('nuclei'), 'A06');
  assert.equal(stageOfPhase('webrtc-leak'), 'A02');
  assert.equal(stageOfPhase('egress-laundering'), 'A10');
  assert.equal(stageOfPhase('no-such-phase'), null);
  assert.equal(stageByCode('A03').title, 'Injection');
  assert.equal(stageByCode('A10').title, 'Server-Side Request Forgery');
  assert.equal(stageByCode('nonsense'), null);
});

test('Go-sheet → OWASP 2021 bridge follows design §2', () => {
  assert.deepEqual(GO_SHEET_TO_OWASP, {
    REC: 'REC',
    A01: 'A01',
    A02: 'A05',
    A03: 'A06',
    A04: 'A02',
    A05: 'A03',
    A06: 'A04',
    A07: 'A07',
    A08: 'A08',
    A09: 'A09',
    A10: 'Additional',
    A11: 'A10',
    A12: 'A01',
    A13: 'A03',
    A14: 'A03',
    A15: 'A08',
    A16: 'A01',
  });
});

test('stage table version is pinned', () => {
  assert.equal(STAGE_TABLE_VERSION, '20261115-v1');
  assert.match(MCP_BLOCKED_REASON, /MCP endpoint decision pending/);
});

test('buildStageRecords aggregates per phase name and counts findings', () => {
  const phases = [
    { name: 'fingerprint', ok: true, findingsCount: 0 },
    { name: 'headers', ok: true, findingsCount: 2 },
    { name: 'headers', ok: false, error: 'boom', findingsCount: 0 },
    { name: 'xss', ok: true, skipped: true, skipReason: 'no param targets', findingsCount: 0 },
  ];
  const findings = [
    { phase: 'headers', confirmation: 'confirmed', title: 'a' },
    { phase: 'headers', confirmation: 'unconfirmed', title: 'b' },
    { phase: 'xss', confirmation: 'confirmed', title: 'c' },
  ];
  const recs = buildStageRecords(phases, findings);
  assert.equal(recs.length, 12);
  const rec = recs.find((r) => r.code === 'REC');
  assert.equal(rec.phasesRun, 1);
  assert.equal(rec.phasesNotRun, 10);
  assert.equal(rec.records.total, 1);
  const a05 = recs.find((r) => r.code === 'A05');
  assert.equal(a05.phasesRun, 1);
  assert.equal(a05.phasesFailed, 1, 'any failed record fails the phase');
  assert.equal(a05.records.total, 2);
  assert.equal(a05.records.failed, 1);
  assert.equal(a05.findingsCount, 2);
  assert.equal(a05.confirmed, 1);
  assert.equal(a05.unconfirmed, 1);
  const a03 = recs.find((r) => r.code === 'A03');
  assert.equal(a03.phasesSkipped, 1);
  assert.equal(a03.records.skipped, 1);
  assert.equal(a03.confirmed, 1);
  const a09 = recs.find((r) => r.code === 'A09');
  assert.equal(a09.phasesRun, 0);
  assert.equal(a09.phasesNotRun, 1);
});

test('buildStageRecords with no records reports every phase not-run', () => {
  const recs = buildStageRecords([], []);
  assert.equal(recs.reduce((n, r) => n + r.phasesNotRun, 0), 159);
  assert.ok(recs.every((r) => r.confirmed === 0 && r.unconfirmed === 0));
});
