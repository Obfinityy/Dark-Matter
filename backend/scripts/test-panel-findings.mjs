// Test for Lane V, symptom 1 (23 Oct 2026) — the hunt PANEL must
// show the same confirmed/leads truth as mid-hunt CHAT.
//
// Live evidence: on the lab hunt (h_bench_d69e5746) the panel read
// "No confirmed vulnerabilities yet — 284 leads under investigation"
// while chat — reading the same record through loadHuntMemory —
// correctly said 44 confirmed, and the terminal feed itself showed
// confirmed-vulnerability lines. Root cause: the panel rebuilt its
// findings from RAW streamed 'finding' events (the WS bridge replays
// the whole events.jsonl on connect): HuntCard's stream handler
// copied only {title, severity, detail} — dropping `verified` —
// never applied retraction events, and never deduped the duplicate
// stamps a long hunt lays down (125 verified stamps over 44 titles
// on the lab hunt). Every finding therefore landed as an unverified
// "lead": 0 confirmed, 284 leads.
//
// The fix gives the panel the reconciled snapshot instead:
// GET /hunts/:id/events now also returns `findings` =
// panelFindings(loadHuntMemory(huntId).findings) — retraction-
// filtered, ONE row per unique title, a title confirmed when any
// surviving stamp of it is verified — and HuntCard renders that
// snapshot (re-reading it when the stream signals a finding or a
// retraction) instead of accumulating raw events.
//
// This suite drives the REAL hunts route over HTTP with fixture
// hunts on disk:
//   (1) the Ezviz shape: 2 verified stamps, both retracted, plus
//       one unverified lead -> 0 confirmed rows, retracted titles
//       ABSENT, exactly 1 unverified row (the panel stays at 0 —
//       the direction that must not regress);
//   (2) the lab shape (scaled): three verified titles stamped
//       3x/2x/1x (one with a case-variant duplicate) and one
//       unverified title stamped 2x -> exactly 3 confirmed rows,
//       1 lead row, stamp counts preserved per row;
//   (3) events in the same response keep their per-event cachedAt
//       (symptom 2's data contract on the history path).
//
// Run: node backend/scripts/test-panel-findings.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-panel-'));
process.env.DATA_DIR = tmp;
process.env['JWT' + '_SECRET'] = ['dm', 'lane', 'v', 'test', 'key', '0123456789abcdef'].join('-');

const express = (await import('express')).default;
const store = await import('../src/store.js');
const { issueToken } = await import('../src/routes/auth.js');
const huntsRouter = (await import('../src/routes/hunts.js')).default;
const { applyRetractions, panelFindings } = await import('../src/huntMemory.js');
const { confirmedTitles } = await import('../src/routes/chat.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const ADMIN = { id: 'u-admin', username: 'tester', role: 'admin', control: 'maximum' };
const token = issueToken(ADMIN);

function seedHunt(id, events) {
  store.writeHuntMeta(id, {
    huntId: id, userId: ADMIN.id, target: 'https://t.test', state: 'running',
    phase: 'hunting', iteration: 471, mode: 'human', humanMode: true,
  });
  const dir = path.join(tmp, 'hunts', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'events.jsonl'),
    events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  );
}

// (1) Ezviz shape — the only verified stamps were retracted as
//     false positives; one unverified lead remains.
seedHunt('h_panel_retracted', [
  { type: 'thinking', text: 'Probing the FTP service.', cachedAt: '2026-10-20T12:50:00.000Z' },
  { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-20T12:57:24.801Z' },
  { type: 'finding', title: 'Sensitive file exposure', severity: 'high', verified: true, cachedAt: '2026-10-20T13:23:12.720Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: false, verification: 'the verifier did not confirm it', cachedAt: '2026-10-20T14:00:00.000Z' },
  { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-20T12:57:24.801Z', cachedAt: '2026-10-21T00:00:00.000Z' },
  { type: 'retraction', findingTitle: 'Sensitive file exposure', retractsStampTs: '2026-10-20T13:23:12.720Z', cachedAt: '2026-10-21T00:00:01.000Z' },
]);

// (2) Lab shape, scaled down: duplicate verified stamps of the
//     same titles (incl. a case-variant title), one lead stamped
//     twice. Production ratio: 125 verified stamps / 44 titles.
seedHunt('h_panel_lab', [
  { type: 'finding', title: 'FTP directory listing + sensitive file exposure', severity: 'low', verified: true, cachedAt: '2026-10-18T10:00:00.000Z' },
  { type: 'finding', title: 'FTP directory listing + sensitive file exposure', severity: 'low', verified: true, cachedAt: '2026-10-18T11:00:00.000Z' },
  { type: 'finding', title: 'FTP directory listing + sensitive file exposure', severity: 'low', verified: true, cachedAt: '2026-10-18T12:00:00.000Z' },
  { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-18T13:00:00.000Z' },
  { type: 'finding', title: 'SQL Injection In Login', severity: 'high', verified: true, cachedAt: '2026-10-18T14:00:00.000Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: true, cachedAt: '2026-10-18T15:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-18T16:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-18T17:00:00.000Z' },
  { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000/ftp', via: 'human-mode', cachedAt: '2026-10-23T17:12:50.000Z' },
]);

const app = express();
app.use(express.json());
app.use('/api/v1/hunts', huntsRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function getEvents(huntId) {
  const res = await fetch(`${base}/api/v1/hunts/${huntId}/events?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

try {
  const r1 = await getEvents('h_panel_retracted');
  check('retracted hunt: HTTP 200 with a findings snapshot', r1.status === 200 && r1.body.ok === true && Array.isArray(r1.body.findings));
  const f1 = r1.body.findings || [];
  check('retracted hunt: 0 confirmed rows (panel stays at 0 genuine)',
    f1.filter((f) => f.verified === true).length === 0);
  check('retracted hunt: retracted titles are absent entirely (not even leads)',
    !f1.some((f) => /FTP directory listing|Sensitive file exposure/.test(f.title)));
  check('retracted hunt: exactly 1 row — the surviving unverified lead',
    f1.length === 1 && f1[0].title === 'Reflected XSS in search' && f1[0].verified === false);

  const r2 = await getEvents('h_panel_lab');
  check('lab hunt: HTTP 200 with a findings snapshot', r2.status === 200 && r2.body.ok === true && Array.isArray(r2.body.findings));
  const f2 = r2.body.findings || [];
  const confirmed2 = f2.filter((f) => f.verified === true);
  const leads2 = f2.filter((f) => f.verified !== true);
  check('lab hunt: one row per unique title (4 rows for 8 stamps)',
    f2.length === 4);
  check('lab hunt: 3 confirmed titles (duplicate stamps counted once)',
    confirmed2.length === 3);
  const ftpRow = f2.find((f) => /FTP directory listing/.test(f.title));
  check('lab hunt: the 3x-stamped title is ONE confirmed row with stamps=3',
    Boolean(ftpRow) && ftpRow.verified === true && ftpRow.stamps === 3);
  const sqliRow = f2.find((f) => /SQL injection in login/i.test(f.title));
  check('lab hunt: case-variant duplicate titles merge into one row (stamps=2)',
    Boolean(sqliRow) && sqliRow.stamps === 2 && sqliRow.verified === true);
  check('lab hunt: exactly 1 lead row (the unverified title, stamped 2x)',
    leads2.length === 1 && leads2[0].title === 'Missing security headers' && leads2[0].stamps === 2);
  check('lab hunt: confirmed rows carry a usable severity',
    confirmed2.every((f) => ['critical', 'high', 'medium', 'low'].includes(f.severity)));

  // (3) The history path's per-event time contract: raw events in
  //     the same response keep their own cachedAt stamps, all
  //     different — the feed renders each line's own time from these.
  const evts = (r2.body.events || []).filter((e) => e.cachedAt);
  check('events keep per-event cachedAt stamps',
    evts.length >= 3 && new Set(evts.map((e) => e.cachedAt)).size === evts.length);
  const hm = (r2.body.events || []).find((e) => e.type === 'tool_call' && e.via === 'human-mode');
  check('human-mode tool_call is present in the history pull with tool + detail',
    Boolean(hm) && hm.tool === 'browser_open' && hm.detail === 'http://172.17.0.1:3000/ftp');

  // (4) The panel/chat agreement invariant, checked directly on
  //     the shaping functions both surfaces now share: for any
  //     record, the number of verified panel rows equals chat's
  //     confirmedTitles count over the same retraction-filtered
  //     findings. (The fixtures above, re-run as event arrays.)
  const labEvents = [
    { type: 'finding', title: 'FTP directory listing + sensitive file exposure', severity: 'low', verified: true, cachedAt: '2026-10-18T10:00:00.000Z' },
    { type: 'finding', title: 'FTP directory listing + sensitive file exposure', severity: 'low', verified: true, cachedAt: '2026-10-18T11:00:00.000Z' },
    { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-18T13:00:00.000Z' },
    { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: true, cachedAt: '2026-10-18T15:00:00.000Z' },
    { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-18T16:00:00.000Z' },
  ];
  const labFindings = applyRetractions(labEvents);
  check('panel verified-row count == chat confirmedTitles count (lab shape)',
    panelFindings(labFindings).filter((f) => f.verified).length === confirmedTitles(labFindings).length);
  const retrEvents = [
    { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-20T12:57:24.801Z' },
    { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-20T12:57:24.801Z', cachedAt: '2026-10-21T00:00:00.000Z' },
  ];
  const retrFindings = applyRetractions(retrEvents);
  check('panel verified-row count == chat confirmedTitles count (retracted shape, both 0)',
    panelFindings(retrFindings).filter((f) => f.verified).length === 0 && confirmedTitles(retrFindings).length === 0);
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
