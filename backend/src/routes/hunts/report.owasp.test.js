// Link → Report report sections (15 Nov 2026, design §3.3).
//
// buildReportMarkdown with meta.owaspStages renders one section per
// stage in stage order (REC, A01..A10, Additional) with per-stage
// findings + honest not-run lists (GAP / AI-blocked / MCP-blocked),
// plus Coverage honesty. Without meta.owaspStages it renders exactly
// as before — no OWASP sections at all. Pure function test: no
// network, no store, no auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportMarkdown } from '../hunts.js';
import { OWASP_STAGES } from '../../scanner/owaspStages.js';
import { buildScannerFindingRecords } from '../../scannerHunt.js';

const OWASP_META = {
  huntId: 'h_owasp_report',
  target: 'http://172.17.0.1:3100',
  createdAt: '2026-11-15T12:00:00.000Z',
  brainMode: 'scanner',
  runMode: 'link-to-report',
  owaspStages: { version: '20261115-v1', stages: OWASP_STAGES },
};

const LEGACY_META = {
  huntId: 'h_legacy_report',
  target: 'http://172.17.0.1:3100',
  createdAt: '2026-11-15T12:00:00.000Z',
  brainMode: 'scanner',
};

function owaspEvents() {
  return [
    { type: 'status', state: 'created', at: '2026-11-15T12:00:00.000Z' },
    { type: 'phase', name: 'fingerprint', ok: true, findingsCount: 0 },
    { type: 'phase', name: 'headers', ok: true, findingsCount: 0 },
    { type: 'phase', name: 'xss', ok: true, findingsCount: 1 },
    { type: 'phase', name: 'missing-auth', ok: true, findingsCount: 1 },
    { type: 'phase', name: 'mcp-tool-poisoning', ok: true, skipped: true, skipReason: 'MCP endpoint decision pending (owner)', findingsCount: 0 },
    {
      type: 'scanner_finding',
      finding: {
        class: 'xss', title: 'reflected xss in search parameter', severity: 'medium',
        url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test', param: 'name',
        evidence: { request: 'GET /vulnerabilities/xss_r/?name=<script>', response: 'HTTP/1.1 200 OK', impact_demo: 'script reflected' },
        confirmation: 'confirmed', phase: 'xss',
      },
    },
    {
      type: 'finding', title: 'reflected xss in search parameter', class: 'xss',
      severity: 'medium', verified: true, verification: 'Confirmed by the rule-based differential verifier',
      detail: 'Observed at http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test',
      url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test',
      evidence: { request: 'GET /vulnerabilities/xss_r/?name=<script>', response: 'HTTP/1.1 200 OK', impact_demo: 'script reflected' },
    },
    {
      type: 'scanner_finding',
      finding: {
        class: 'missing-auth', title: 'admin endpoint without auth', severity: 'high',
        url: 'http://172.17.0.1:3100/admin', param: null, evidence: null,
        confirmation: 'unconfirmed', phase: 'missing-auth',
      },
    },
    {
      type: 'finding', title: 'admin endpoint without auth', class: 'missing-auth',
      severity: 'high', verified: false,
      detail: 'Observed at http://172.17.0.1:3100/admin',
      url: 'http://172.17.0.1:3100/admin', evidence: null,
    },
    // No scanner_finding stamp at all: must surface as unattributed,
    // never silently dropped, never guessed into a stage.
    {
      type: 'finding', title: 'orphan lead from an older run', severity: 'low',
      verified: false, detail: 'no phase tag on any stamp',
      url: 'http://172.17.0.1:3100/', evidence: null,
    },
  ];
}

const sectionOf = (md, code) => {
  const start = md.indexOf(`## ${code} —`);
  if (start === -1) return null;
  const next = md.indexOf('\n## ', start + 1);
  return next === -1 ? md.slice(start) : md.slice(start, next);
};

test('legacy hunt (no owaspStages) renders exactly as before — no OWASP sections', () => {
  const md = buildReportMarkdown({ huntId: 'h_legacy_report', meta: LEGACY_META, events: owaspEvents() });
  assert.ok(!md.includes('OWASP Top 10 2021'), 'no OWASP header');
  assert.ok(!md.includes('Coverage honesty'), 'no honesty section');
  assert.ok(!md.includes('Checks not run'), 'no not-run lists');
  assert.ok(!md.includes('Run mode:'), 'no run-mode header line');
  assert.ok(md.includes('## Findings'), 'existing sections intact');
  assert.ok(md.includes('## Tool activity'), 'existing sections intact');
});

test('link-to-report hunt renders stage sections in order with findings grouped', () => {
  const md = buildReportMarkdown({ huntId: 'h_owasp_report', meta: OWASP_META, events: owaspEvents() });
  assert.ok(md.includes('- **Run mode:** Link → Report'), 'run-mode header line');
  assert.ok(md.includes('- **Stage table:** v20261115-v1'), 'stage-table version header line');
  const order = ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'Additional'];
  let prev = -1;
  for (const code of order) {
    const idx = md.indexOf(`## ${code} —`);
    assert.ok(idx > prev, `section ${code} present and after the previous stage`);
    prev = idx;
  }
  const a03 = sectionOf(md, 'A03');
  assert.ok(a03.includes('reflected xss in search parameter'), 'xss finding grouped under A03');
  assert.ok(!a03.includes('admin endpoint without auth'), 'A01 lead must not leak into A03');
  const a01 = sectionOf(md, 'A01');
  assert.ok(a01.includes('admin endpoint without auth'), 'missing-auth lead grouped under A01');
  assert.ok(a01.includes('Checks not run'), 'not-run list per stage');
  assert.ok(a03.includes('Checks not run'), 'not-run list per stage');
});

test('not-run lists name the missing leg; MCP + AI blocks are explicit', () => {
  const md = buildReportMarkdown({ huntId: 'h_owasp_report', meta: OWASP_META, events: owaspEvents() });
  const additional = sectionOf(md, 'Additional');
  assert.ok(additional.includes('mcp-tool-poisoning'), 'MCP phase named');
  assert.ok(additional.includes('MCP endpoint decision pending (owner)'), 'MCP blocked reason verbatim');
  // The 14 kind-'ai' Self checks are A06-sheet (→ OWASP A04) x13
  // and A09-sheet (→ A09) x1.
  const a04 = sectionOf(md, 'A04');
  assert.ok(a04.includes('AI-blocked'), 'A04 carries AI-blocked checks');
  assert.ok(a04.includes('no AI executor (zero-Meta-spend order)'), 'AI blocked reason verbatim');
  const a09 = sectionOf(md, 'A09');
  assert.ok(a09.includes('Thin by construction'), 'A09 thinness is stated, not padded');
  assert.ok(a09.includes('Sensitive Data in Logs and Error Messages'), 'the single A09 check is AI-blocked, not passed');
});

test('coverage honesty counts phases + checks and lists unattributed findings', () => {
  const md = buildReportMarkdown({ huntId: 'h_owasp_report', meta: OWASP_META, events: owaspEvents() });
  assert.ok(md.includes('## Coverage honesty'), 'honesty section present');
  assert.ok(md.includes('No invented passes'), 'no invented passes');
  assert.ok(md.includes('orphan lead from an older run'), 'unattributed finding is listed, not dropped');
  assert.ok(md.includes('Findings without a stage'), 'unattributed bucket labelled');
  assert.ok(md.includes('Self checklist (202 checks)'), 'checklist totals rendered');
});

// PHASE DROP REGRESSION (15 Nov 2026, Lane A2) — end-to-end producer
// → report. Synthetic regeneration: the events below are built with
// the REAL buildScannerFindingRecords from finding objects exactly as
// runScan emits them (phase-tagged when owaspStages is enabled), the
// way the Juice 28/2 lab run produced them — except the old producer
// dropped .phase, so the report's stage sections came out empty.
// A phase-tagged finding must land in its stage section; a phaseless
// finding must still appear in ## Findings AND in the unattributed
// list, never vanish; a finding whose phase maps to no stage
// (unknown phase name) is unattributed too, never guessed.
test('synthetic regeneration: phase-tagged findings land in their stage; phaseless never vanish', () => {
  const taggedXss = {
    class: 'xss', title: 'reflected xss in search parameter', severity: 'medium',
    url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test', param: 'name',
    evidence: { request: 'GET /vulnerabilities/xss_r/?name=<script>', response: 'HTTP/1.1 200 OK', impact_demo: 'script reflected' },
    confirmation: 'confirmed', phase: 'xss',
  };
  const taggedAuth = {
    class: 'missing-auth', title: 'admin endpoint without auth', severity: 'high',
    url: 'http://172.17.0.1:3100/admin', param: null, evidence: null,
    confirmation: 'unconfirmed', phase: 'missing-auth',
  };
  const phaseless = {
    class: 'headers', title: 'missing security header x-frame-options', severity: 'low',
    url: 'http://172.17.0.1:3100/', param: null, evidence: null,
    confirmation: 'unconfirmed',
    // no .phase — the pre-fix producer shape
  };
  const unknownPhase = {
    class: 'xss', title: 'dom xss via unknown phase', severity: 'medium',
    url: 'http://172.17.0.1:3100/', param: null, evidence: null,
    confirmation: 'unconfirmed', phase: 'not-a-real-phase',
  };
  const events = [
    { type: 'status', state: 'created', at: '2026-11-15T12:00:00.000Z' },
    { type: 'phase', name: 'xss', ok: true, findingsCount: 1 },
    { type: 'phase', name: 'missing-auth', ok: true, findingsCount: 1 },
    { type: 'phase', name: 'headers', ok: true, findingsCount: 1 },
    ...buildScannerFindingRecords(taggedXss),
    ...buildScannerFindingRecords(taggedAuth),
    ...buildScannerFindingRecords(phaseless),
    ...buildScannerFindingRecords(unknownPhase),
  ];
  const md = buildReportMarkdown({ huntId: 'h_owasp_report', meta: OWASP_META, events });

  // Phase-tagged findings land in the right stage sections.
  const a03 = sectionOf(md, 'A03');
  assert.ok(a03.includes('reflected xss in search parameter'), 'xss (phase xss) renders under A03');
  assert.ok(!a03.includes('admin endpoint without auth'), 'A01 lead must not leak into A03');
  const a01 = sectionOf(md, 'A01');
  assert.ok(a01.includes('admin endpoint without auth'), 'missing-auth (phase missing-auth) renders under A01');

  // Phaseless + unknown-phase findings appear in ## Findings (never vanish)…
  const findingsSection = md.slice(md.indexOf('## Findings'), md.indexOf('## OWASP Top 10 2021'));
  assert.ok(findingsSection.includes('missing security header x-frame-options'), 'phaseless finding in ## Findings');
  assert.ok(findingsSection.includes('dom xss via unknown phase'), 'unknown-phase finding in ## Findings');
  // …and are listed as unattributed in Coverage honesty…
  const unattributedLine = md.split('\n').find((l) => l.includes('Findings without a stage'));
  assert.ok(unattributedLine, 'unattributed bucket rendered');
  assert.ok(unattributedLine.includes('missing security header x-frame-options'), 'phaseless finding listed as unattributed');
  assert.ok(unattributedLine.includes('dom xss via unknown phase'), 'unknown-phase finding listed as unattributed');
  // …while tagged findings are NOT in the unattributed bucket…
  assert.ok(!unattributedLine.includes('reflected xss in search parameter'), 'tagged finding not unattributed');
  assert.ok(!unattributedLine.includes('admin endpoint without auth'), 'tagged lead not unattributed');
  // …and never leak into a stage section they do not belong to.
  for (const code of ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'Additional']) {
    const section = sectionOf(md, code);
    assert.ok(!section.includes('missing security header x-frame-options'), `phaseless finding not guessed into ${code}`);
    assert.ok(!section.includes('dom xss via unknown phase'), `unknown-phase finding not guessed into ${code}`);
  }
});
