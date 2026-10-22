// Test for the human-mode COVERAGE LEDGER + SESSION RECONCILIATION
// (Lane L, 22 Oct 2026 — Lane K's Strix P1 + P4, re-implemented).
//
// Lane J's leads are recomputed from the raw record every turn:
// they carry no accounting and no memory across sessions. A class
// the brain researched in session 1 and never probed simply
// re-derives next session; nothing records that a surface × class
// was ever deliberately closed, and nothing accumulates the debt.
// This suite proves the durable half:
//   (a) ledger units — uniqueness per (surface, class) returns the
//       existing row instead of duplicating; closure as ruled_out /
//       not_applicable without evidence naming the control is
//       rejected, with a named control accepted; updates go through
//       the update path only;
//   (b) tolerant reads — a corrupt coverage.json degrades to empty
//       and never breaks a session;
//   (c) reconciliation units — the session-end diff turns
//       researched-but-unaccounted classes into open items + gap
//       rows, leaves probed and ledger-accounted classes alone, and
//       cumulative research debt accumulates across sessions;
//   (d) screen level — open_gap rows render in the COVERAGE LEDGER
//       region and take precedence over the Lane J lead for the
//       same key (no double-listing), while unrowed classes keep
//       their computed leads;
//   (e) the record_coverage action end-to-end through
//       humanIteration, including the duplicate bounce and the
//       closure-evidence bounce;
//   (f) session end through humanIteration — reconciliation writes
//       the gap row + debt to coverage.json, and a second session
//       researching the same class grows the debt without
//       duplicating the row.
//
// Run: node backend/scripts/test-human-coverage-ledger.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-l-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  mergeLeadsWithCoverage,
  reconcileSessionResearch,
  unprobedLeadLines,
} = await import('../src/humanLoop.js');
const {
  emptyCoverage,
  parseCoverage,
  loadCoverage,
  recordCoverage,
  updateCoverage,
  applyRecord,
  applyUpdate,
  mergeResearchDebt,
  normaliseCoverageClass,
  coverageFilePath,
} = await import('../src/coverageLedger.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'https://t.test';
const tc = (tool, detail) => ({ type: 'tool_call', tool, detail, via: 'human-mode' });

// ---------------------------------------------------------------------------
// (a) ledger units
// ---------------------------------------------------------------------------
{
  let data = emptyCoverage();
  const r1 = applyRecord(data, { surface: 'https://t.test/login', class: 'SQL injection', outcome: 'open_gap', evidence: '' });
  check('ledger: first record creates the row', r1.result.status === 'created' && r1.data.rows.length === 1);
  check('ledger: class name normalises to the canonical topic id', r1.data.rows[0].class === 'sqli');
  data = r1.data;
  const r2 = applyRecord(data, { surface: 'https://t.test/login/', class: 'sqli', outcome: 'probed_clean', evidence: 'tested' });
  check('ledger: second record for the same key does NOT duplicate — existing row returned',
    r2.result.status === 'duplicate' && r2.data.rows.length === 1 && r2.result.row.outcome === 'open_gap');
  const r3 = applyRecord(data, { surface: 'https://t.test/login', class: 'xss', outcome: 'ruled_out', evidence: '' });
  check('ledger: ruled_out without evidence naming the control is rejected',
    r3.result.status === 'rejected' && /NAMING THE CONTROL/.test(r3.result.error) && r3.data.rows.length === 1);
  const r4 = applyRecord(data, { surface: 'https://t.test/login', class: 'xss', outcome: 'not_applicable', evidence: '  ' });
  check('ledger: not_applicable with blank evidence is rejected', r4.result.status === 'rejected');
  const r5 = applyRecord(data, { surface: 'https://t.test/login', class: 'xss', outcome: 'ruled_out', evidence: 'Output is encoded by the framework templating layer on every render path' });
  check('ledger: ruled_out with a named control is accepted', r5.result.status === 'created' && r5.data.rows.length === 2);
  data = r5.data;
  const u1 = applyUpdate(data, { surface: 'https://t.test/other', class: 'sqli', outcome: 'probed_clean' });
  check('ledger: update of a missing key is rejected (record first)', u1.result.status === 'rejected');
  const u2 = applyUpdate(data, { surface: 'https://t.test/login', class: 'sqli', outcome: 'ruled_out', evidence: '' });
  check('ledger: update to ruled_out still demands closure evidence', u2.result.status === 'rejected');
  const u3 = applyUpdate(data, { surface: 'https://t.test/login', class: 'sqli', outcome: 'probed_clean', evidence: 'differential pair ran clean' });
  check('ledger: update changes the existing row in place',
    u3.result.status === 'updated' && u3.data.rows.length === 2 && u3.data.rows.find((r) => r.class === 'sqli').outcome === 'probed_clean');
  const bad = applyRecord(data, { surface: 'https://t.test/login', class: 'ssrf', outcome: 'banana' });
  check('ledger: an outcome outside the enum is rejected', bad.result.status === 'rejected');
  check('ledger: class aliases land on canonical ids',
    normaliseCoverageClass('SQL injection') === 'sqli' && normaliseCoverageClass('command injection') === 'cmdi' &&
    normaliseCoverageClass('file upload') === 'fileupload' && normaliseCoverageClass('IDOR') === 'idor');
}

// ---------------------------------------------------------------------------
// (b) tolerant reads + file round-trip
// ---------------------------------------------------------------------------
{
  check('tolerant: corrupt JSON degrades to the empty ledger',
    parseCoverage('{not json').rows.length === 0 && parseCoverage('[]').rows.length === 0 &&
    parseCoverage('{"rows":"junk"}').rows.length === 0);
  const hunt = 'h_lane_l_corrupt';
  fs.mkdirSync(path.dirname(coverageFilePath(hunt)), { recursive: true });
  fs.writeFileSync(coverageFilePath(hunt), 'CORRUPT{{{');
  check('tolerant: a corrupt coverage.json on disk loads as empty', loadCoverage(hunt).rows.length === 0);
  const rec = recordCoverage(hunt, { surface: TARGET, class: 'sqli', outcome: 'open_gap', evidence: 'seeded' });
  check('tolerant: recording after corruption writes a fresh ledger', rec.status === 'created' && loadCoverage(hunt).rows.length === 1);
  const upd = updateCoverage(hunt, { surface: TARGET, class: 'SQL injection', outcome: 'probed_clean', evidence: 'ran clean' });
  check('round-trip: hunt-level update persists', upd.status === 'updated' && loadCoverage(hunt).rows[0].outcome === 'probed_clean');
}

// ---------------------------------------------------------------------------
// (c) reconciliation units
// ---------------------------------------------------------------------------
{
  const sessionEvents = [
    ...Array.from({ length: 3 }, () => tc('search', 'sql injection login bypass techniques')),
    ...Array.from({ length: 2 }, () => tc('search', 'file upload vulnerability exploitation')),
    tc('shell', "curl -s 'https://t.test/x?a=test; id'"),
  ];
  const cov = {
    ...emptyCoverage(),
    rows: [{ surface: TARGET, class: 'fileupload', outcome: 'open_gap', evidence: 'opened earlier', updatedAt: '' }],
    researchDebt: { sqli: { researched: 100, probed: false, sessionsResearched: 9, lastResearchedAt: '' } },
  };
  const rec = reconcileSessionResearch({ sessionEvents, sessionRows: [], coverageData: cov, target: TARGET });
  check('reconcile: researched-only class becomes an open item', rec.openItems.some((l) => l.includes('SQL injection')));
  check('reconcile: open item carries the session count and the cumulative count',
    rec.openItems.some((l) => l.includes('×3 this session') && l.includes('×103 across all sessions')));
  check('reconcile: probed class (command injection) produces no open item',
    !rec.openItems.some((l) => l.includes('command injection')));
  check('reconcile: ledger-accounted class (file upload) produces no open item',
    !rec.openItems.some((l) => l.includes('file upload')));
  check('reconcile: exactly one gap row input, for the unaccounted class, at the target surface',
    rec.gapInputs.length === 1 && rec.gapInputs[0].class === 'sqli' && rec.gapInputs[0].outcome === 'open_gap' &&
    rec.gapInputs[0].surface === TARGET && /bookkeeping/.test(rec.gapInputs[0].evidence));
  check('reconcile: debt stats cover the researched classes (a probed-but-never-researched class accrues no debt)',
    rec.debtStats.length === 2 && rec.debtStats.find((s) => s.id === 'sqli').probed === false &&
    rec.debtStats.find((s) => s.id === 'fileupload').probed === false);

  let d = emptyCoverage();
  d = mergeResearchDebt(d, [{ id: 'sqli', n: 3, probed: false }], '2026-10-22T00:00:00.000Z');
  d = mergeResearchDebt(d, [{ id: 'sqli', n: 2, probed: false }], '2026-10-22T01:00:00.000Z');
  check('debt: cumulative researched accumulates across two sessions',
    d.researchDebt.sqli.researched === 5 && d.researchDebt.sqli.sessionsResearched === 2 && d.researchDebt.sqli.probed === false);
  d = mergeResearchDebt(d, [{ id: 'xss', n: 1, probed: false }], '2026-10-22T02:00:00.000Z', new Set(['sqli']));
  check('debt: a hunt-wide probe settles the debt permanently', d.researchDebt.sqli.probed === true);
}

// ---------------------------------------------------------------------------
// (d) screen merge — ledger precedence over Lane J leads
// ---------------------------------------------------------------------------
{
  const events = [
    ...Array.from({ length: 5 }, () => tc('search', 'sql injection login bypass techniques')),
    ...Array.from({ length: 4 }, () => tc('search', 'command injection patterns and techniques')),
    tc('browser_type', "sql' --"),
    ...Array.from({ length: 3 }, () => tc('browser_open', 'https://t.test/login')),
    tc('shell', `curl -s -d 'username=test&password=<redacted>' -X POST https://t.test/rest/user/login`),
  ];
  const leads = unprobedLeadLines({ events, reasoningRows: [], target: TARGET });
  check('merge setup: Lane J produces an SQLi lead grounded on the API login',
    leads.some((l) => l.includes('SQL injection') && l.includes('https://t.test/rest/user/login')));
  const rows = [{ surface: 'https://t.test/rest/user/login', class: 'sqli', outcome: 'open_gap', evidence: 'Ledger-tracked since last session.', updatedAt: '' }];
  const debt = { sqli: { researched: 104, probed: false, sessionsResearched: 11, lastResearchedAt: '' } };
  const merged = mergeLeadsWithCoverage({ leads, rows, debt, target: TARGET });
  check('merge: the ledger open_gap line renders for the row',
    merged.coverage.some((l) => l.includes('OPEN GAP') && l.includes('https://t.test/rest/user/login') && l.includes('SQL injection')));
  check('merge: the gap line carries the cumulative research debt',
    merged.coverage.some((l) => l.includes('researched ×104 across sessions')));
  check('merge: the Lane J lead for the same key is NOT double-listed',
    !merged.leads.some((l) => l.includes('SQL injection')));
  check('merge: classes with no row keep their computed leads',
    merged.leads.some((l) => l.includes('command injection')));
  const debtOnly = mergeLeadsWithCoverage({ leads: [], rows: [], debt, target: TARGET });
  check('merge: unaccounted debt renders as a RESEARCH DEBT line',
    debtOnly.coverage.some((l) => l.includes('RESEARCH DEBT') && l.includes('SQL injection') && l.includes('×104')));
  const settled = mergeLeadsWithCoverage({ leads: [], rows: [], debt: { sqli: { researched: 104, probed: true, sessionsResearched: 11 } }, target: TARGET });
  check('merge: settled debt renders nothing', settled.coverage.length === 0);
}

// ---------------------------------------------------------------------------
// fake deps for the humanIteration-level checks
// ---------------------------------------------------------------------------
function fakeDeps({ events = [], script = [] } = {}) {
  const screens = [];
  const state = { meta: {}, events: [...events], recorded: [] };
  const queue = [...script];
  return {
    screens,
    state,
    deps: {
      chat: async (msgs) => {
        screens.push(msgs[0].text);
        return queue.length ? queue.shift() : 'Thinking.\n{"action":"note","text":"ok"}';
      },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => [],
      writeFile: async () => ({ name: 'x', chars: 0 }),
      spill: () => '',
      record: (h, e) => { state.recorded.push(e); if (e && e.type === 'tool_call') state.events.push(e); },
      readMeta: () => state.meta,
      writeMeta: (h, m) => { state.meta = m; },
      readEvents: () => [...state.events],
      recordNote: () => {},
      assess: null,
      sleep: async () => {},
      buildBriefing: async () => 'BRIEFING-BODY',
    },
  };
}

// ---------------------------------------------------------------------------
// (e) record_coverage through humanIteration + screen rendering
// ---------------------------------------------------------------------------
{
  const hunt = 'h_lane_l_action';
  recordCoverage(hunt, { surface: 'https://t.test/rest/user/login', class: 'sqli', outcome: 'open_gap', evidence: 'Ledger-tracked since last session.' });
  const events = [
    ...Array.from({ length: 5 }, () => tc('search', 'sql injection login bypass techniques')),
    tc('browser_type', "sql' --"),
    tc('shell', `curl -s -d 'username=test&password=<redacted>' -X POST https://t.test/rest/user/login`),
  ];
  const s = fakeDeps({
    events,
    script: [
      'Accounting.\n{"action":"record_coverage","surface":"https://t.test/login","class":"xss","outcome":"ruled_out","evidence":""}',
      'Accounting.\n{"action":"record_coverage","surface":"https://t.test/login","class":"xss","outcome":"ruled_out","evidence":"Framework output encoding on every render path"}',
      'Accounting.\n{"action":"record_coverage","surface":"https://t.test/login","class":"XSS (cross-site scripting)","outcome":"probed_clean","evidence":"changed my mind"}',
      'Accounting.\n{"action":"record_coverage","surface":"https://t.test/login","class":"xss","outcome":"probed_clean","evidence":"reflected probe ran clean","update":true}',
    ],
  });
  const res = await humanIteration(hunt, TARGET, { turns: 4, deps: s.deps });
  const screen1 = s.screens[0] || '';
  check('screen: COVERAGE LEDGER region renders the seeded open gap',
    screen1.includes('COVERAGE LEDGER — OPEN GAPS & RESEARCH DEBT') && screen1.includes('OPEN GAP') && screen1.includes('SQL injection'));
  check('screen: the seeded row suppresses the Lane J SQLi lead (no double-listing)',
    !screen1.includes('one glancing attempt'));
  check('screen: coverage region sits before the memory briefing (outside its cap)',
    screen1.indexOf('COVERAGE LEDGER') >= 0 && screen1.indexOf('COVERAGE LEDGER') < screen1.indexOf('=== WHAT YOU KNOW'));
  const obs = res.log.map((l) => l.observation);
  check('action: closure without a named control bounces with the rule stated',
    /NOT recorded/.test(obs[0] || '') && /NAMING THE CONTROL/.test(obs[0] || ''));
  check('action: closure with a named control is recorded', /Coverage recorded/.test(obs[1] || ''));
  check('action: a second record for the same key bounces as a duplicate',
    /Already on your coverage ledger/.test(obs[2] || '') && /accounted for exactly once/.test(obs[2] || ''));
  check('action: the update path changes the row', /Coverage updated/.test(obs[3] || ''));
  const onDisk = loadCoverage(hunt);
  check('action: ledger on disk holds exactly the seeded row + the updated row',
    onDisk.rows.length === 2 && onDisk.rows.find((r) => r.class === 'xss').outcome === 'probed_clean');
}

// ---------------------------------------------------------------------------
// (f) session-end reconciliation through humanIteration
// ---------------------------------------------------------------------------
{
  const hunt = 'h_lane_l_reconcile';
  const script = [
    'Researching.\n{"action":"search","query":"sql injection login bypass techniques"}',
    'Researching.\n{"action":"search","query":"sql injection union select tutorial"}',
    'Noted.\n{"action":"note","text":"ok"}',
  ];
  const s1 = fakeDeps({ script });
  await humanIteration(hunt, TARGET, { turns: 3, deps: s1.deps });
  const after1 = loadCoverage(hunt);
  check('session end: researched-only class opened a gap row at the target surface',
    after1.rows.length === 1 && after1.rows[0].class === 'sqli' && after1.rows[0].outcome === 'open_gap' && after1.rows[0].surface === 'https://t.test/');
  check('session end: the gap row evidence names it as reconciliation bookkeeping', /bookkeeping/.test(after1.rows[0].evidence));
  check('session end: research debt recorded for the session',
    after1.researchDebt.sqli && after1.researchDebt.sqli.researched === 2 && after1.researchDebt.sqli.probed === false);

  // Second session: same research again — debt grows, row stays one.
  const s2 = fakeDeps({ events: s1.state.events, script });
  await humanIteration(hunt, TARGET, { turns: 3, deps: s2.deps });
  const after2 = loadCoverage(hunt);
  check('session end ×2: the gap row is NOT duplicated', after2.rows.length === 1);
  check('session end ×2: cumulative debt grew across sessions',
    after2.researchDebt.sqli.researched === 4 && after2.researchDebt.sqli.sessionsResearched === 2);

  // A corrupt ledger must never break a session.
  fs.writeFileSync(coverageFilePath(hunt), 'GARBAGE{{{');
  const s3 = fakeDeps({ events: s2.state.events, script: ['Thinking.\n{"action":"note","text":"ok"}'] });
  const res3 = await humanIteration(hunt, TARGET, { turns: 1, deps: s3.deps });
  check('tolerant: a corrupt coverage.json mid-hunt does not break the session', res3.aiOk === true);
  check('tolerant: screen renders without a coverage section when the ledger is empty',
    !(s3.screens[0] || '').includes('COVERAGE LEDGER'));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
