// Test for Lane P, Defect 2 (23 Oct 2026) — mid-hunt chat must never
// present RETRACTED findings as confirmed.
//
// Live evidence: on the Ezviz hunt the only 2 verified stamps ("FTP
// directory listing" / "sensitive file exposure", 2026-10-20) were
// both withdrawn by retraction events, yet POST /api/v1/chat answered
// "What is the progress?" with "2 confirmed so far. Found 2 confirmed
// vulnerabilities: FTP…" while the hunt panel showed "No confirmed
// vulnerabilities yet — 3 leads". Root cause: routes/chat.js built
// its findings from RAW events (type==='finding') and counted
// f.verified — retraction events were never applied. The fix routes
// chat findings through huntMemory.loadHuntMemory (the single
// retraction-aware read path) and counts confirmed as UNIQUE titles
// (duplicate stamps of one vulnerability count once).
//
// This suite drives the REAL chat route over HTTP with fixture hunts
// on disk:
//   (1) verified stamps + matching retractions  -> 0 confirmed, the
//       retracted titles are not listed as confirmed;
//   (2) one genuine verified finding stamped TWICE, no retraction
//       -> exactly 1 confirmed, title listed once;
//   (3) no findings at all -> honest "no vulnerabilities found yet".
//
// Lane Y extension (24 Oct 2026) — the chat's LEAD count must use
// the panel's unit (unique titles), not the raw stamp count. Live
// evidence: the lab hunt's record holds 284 finding stamps over
// 120 titles; the panel (Lane V, panelFindings) said 76 leads /
// 44 confirmed while chat's context line said "284 lead(s), 44
// confirmed" — same retraction-filtered record, contradictory
// numbers. Fixtures (4)–(6) pin the parity invariant end-to-end:
// the counts parsed out of the HTTP reply must EQUAL the counts
// panelFindings/findingCounts derive from the identical record:
//   (4) lab shape: duplicate stamps (incl. a case-variant title),
//       a title with mixed unverified+verified stamps, and one
//       verified title fully retracted -> chat counts equal the
//       panel's unique-title counts, NOT the 8 surviving stamps;
//   (5) leads only, stamped repeatedly -> both chat lead lines
//       (context line and summary) count unique titles;
//   (6) Ezviz shape, ONLY the retracted pair -> the retracted
//       titles contribute 0 to BOTH counts ("0 lead(s), 0
//       confirmed so far").
//
// Run: node backend/scripts/test-chat-summary-truth.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-truth-'));
process.env.DATA_DIR = tmp;
process.env['JWT' + '_SECRET'] = ['dm', 'lane', 'p', 'test', 'key', '0123456789abcdef'].join('-');

const express = (await import('express')).default;
const store = await import('../src/store.js');
const { issueToken } = await import('../src/routes/auth.js');
const chatRouter = (await import('../src/routes/chat.js')).default;
const { applyRetractions, panelFindings, findingCounts } = await import('../src/huntMemory.js');

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
    phase: 'hunting', iteration: 166, mode: 'human', humanMode: true,
  });
  // Write the event log directly, exactly as it sits on disk in
  // production: appendHuntEvent stamps every event with cachedAt,
  // and retraction matching keys on that stamp (huntMemory.eventTs
  // prefers cachedAt), so the fixture sets it explicitly.
  const dir = path.join(tmp, 'hunts', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'events.jsonl'),
    events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  );
}

// (1) The Ezviz shape: two verified stamps, both retracted later,
//     plus one unverified lead and a thinking line.
const retractedEvents = [
  { type: 'thinking', text: 'Probing the FTP service.', cachedAt: '2026-10-20T12:50:00.000Z' },
  { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-20T12:57:24.801Z' },
  { type: 'finding', title: 'Sensitive file exposure', severity: 'high', verified: true, cachedAt: '2026-10-20T13:23:12.720Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: false, verification: 'the verifier did not confirm it', cachedAt: '2026-10-20T14:00:00.000Z' },
  { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-20T12:57:24.801Z', cachedAt: '2026-10-21T00:00:00.000Z' },
  { type: 'retraction', findingTitle: 'Sensitive file exposure', retractsStampTs: '2026-10-20T13:23:12.720Z', cachedAt: '2026-10-21T00:00:01.000Z' },
];
seedHunt('h_chat_retracted', retractedEvents);

// (2) A genuine verified finding, stamped twice (long hunts re-stamp),
//     never retracted.
seedHunt('h_chat_genuine', [
  { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-22T10:00:00.000Z' },
  { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-22T11:00:00.000Z' },
]);

// (3) No findings.
seedHunt('h_chat_empty', [
  { type: 'thinking', text: 'Mapping the attack surface.', cachedAt: '2026-10-22T09:00:00.000Z' },
]);

// (4) Lab shape (Lane Y): 9 stamps over 5 titles — one confirmed
//     title stamped 3x (incl. a case-variant), one title confirmed
//     by a single verified stamp among unverified ones, two lead
//     titles (one stamped 2x), and one verified title withdrawn
//     by a later retraction. After retraction filtering 8 stamps
//     survive over 4 titles: 2 confirmed + 2 leads. The pre-fix
//     chat printed the raw surviving stamp count: "8 lead(s)".
const labEvents = [
  { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-18T10:00:00.000Z' },
  { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-18T11:00:00.000Z' },
  { type: 'finding', title: 'SQL Injection In Login', severity: 'high', verified: true, cachedAt: '2026-10-18T12:00:00.000Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: false, cachedAt: '2026-10-18T13:00:00.000Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: true, cachedAt: '2026-10-18T14:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-18T15:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-18T16:00:00.000Z' },
  { type: 'finding', title: 'IDOR in basket', severity: 'medium', verified: false, cachedAt: '2026-10-18T17:00:00.000Z' },
  { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-18T18:00:00.000Z' },
  { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-18T18:00:00.000Z', cachedAt: '2026-10-19T00:00:00.000Z' },
  { type: 'thinking', text: 'Deepening the confirmed chains.', cachedAt: '2026-10-18T19:00:00.000Z' },
];
seedHunt('h_chat_lab', labEvents);

// (5) Leads only (Lane Y): two unverified titles, one stamped 3x —
//     4 raw stamps, 2 unique leads, nothing confirmed. Exercises
//     summaryReply's "under investigation" lead line, which quoted
//     the raw stamp count too ("4 lead(s)" pre-fix).
const leadsOnlyEvents = [
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-22T10:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-22T11:00:00.000Z' },
  { type: 'finding', title: 'Missing security headers', severity: 'low', verified: false, cachedAt: '2026-10-22T12:00:00.000Z' },
  { type: 'finding', title: 'Directory listing enabled', severity: 'medium', verified: false, cachedAt: '2026-10-22T13:00:00.000Z' },
];
seedHunt('h_chat_leads_only', leadsOnlyEvents);

// (6) The Ezviz record reduced to ONLY the retracted pair: the
//     retracted titles must contribute 0 to BOTH counts — no
//     confirmed, and not even leads.
const fullyRetractedEvents = [
  { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-20T12:57:24.801Z' },
  { type: 'finding', title: 'Sensitive file exposure', severity: 'high', verified: true, cachedAt: '2026-10-20T13:23:12.720Z' },
  { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-20T12:57:24.801Z', cachedAt: '2026-10-21T00:00:00.000Z' },
  { type: 'retraction', findingTitle: 'Sensitive file exposure', retractsStampTs: '2026-10-20T13:23:12.720Z', cachedAt: '2026-10-21T00:00:01.000Z' },
];
seedHunt('h_chat_fully_retracted', fullyRetractedEvents);

const app = express();
app.use(express.json());
app.use('/api/v1/chat', chatRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function ask(huntId) {
  const res = await fetch(`${base}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'What is the progress?', huntId }),
  });
  return { status: res.status, body: await res.json() };
}

// Lane Y parity helpers: the counts printed in the chat context
// line vs the counts the PANEL's shaping derives from the identical
// record (applyRetractions is the read path's own filter; the
// fixture arrays are exactly what was seeded to disk).
function replyCounts(reply) {
  const m = /(\d+) lead\(s\), (\d+) confirmed so far/.exec(reply || '');
  return m ? { leads: Number(m[1]), confirmed: Number(m[2]) } : null;
}
function panelCounts(events) {
  const rows = panelFindings(applyRetractions(events));
  return {
    leads: rows.filter((r) => !r.verified).length,
    confirmed: rows.filter((r) => r.verified).length,
  };
}

try {
  const r1 = await ask('h_chat_retracted');
  check('retracted hunt: HTTP 200', r1.status === 200 && r1.body.ok === true);
  check('retracted hunt: 0 confirmed in the reply', /0 confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: reply does NOT claim "Found 2 confirmed"', !/Found 2 confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: retracted titles not listed as confirmed',
    !/confirmed vulnerabilities?: FTP/.test(r1.body.reply || '') && !/Found \d+ confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: remaining lead framed as under investigation',
    /under investigation — nothing confirmed yet/.test(r1.body.reply || ''));
  // Lane Y: the surviving unverified title is exactly 1 lead in
  // BOTH chat lines, matching the panel's count over this record.
  check('retracted hunt: chat lead count is the unique-title count (1 lead)',
    /1 lead\(s\), 0 confirmed so far/.test(r1.body.reply || '') &&
    /1 lead\(s\) under investigation/.test(r1.body.reply || ''));
  const p1 = panelCounts(retractedEvents);
  check('retracted hunt: chat counts == panel counts (parity)',
    JSON.stringify(replyCounts(r1.body.reply)) === JSON.stringify(p1) &&
    p1.leads === 1 && p1.confirmed === 0);

  const r2 = await ask('h_chat_genuine');
  check('genuine hunt: HTTP 200', r2.status === 200 && r2.body.ok === true);
  check('genuine hunt: duplicate stamps count ONCE (1 confirmed)', /1 confirmed/.test(r2.body.reply || ''));
  check('genuine hunt: "Found 1 confirmed vulnerability" (singular)',
    /Found 1 confirmed vulnerability: SQL injection in login\./.test(r2.body.reply || ''));
  check('genuine hunt: title appears exactly once in the reply',
    (String(r2.body.reply || '').match(/SQL injection in login/g) || []).length === 1);

  const r3 = await ask('h_chat_empty');
  check('empty hunt: HTTP 200', r3.status === 200 && r3.body.ok === true);
  check('empty hunt: 0 confirmed, no invented findings',
    /0 confirmed/.test(r3.body.reply || '') && !/Found \d+ confirmed/.test(r3.body.reply || ''));

  // (4) Lane Y lab shape: chat counts must be the panel's
  //     unique-title counts — 2 leads / 2 confirmed — never the
  //     8 surviving raw stamps.
  const labStamps = applyRetractions(labEvents).length;
  check('lab hunt: fixture stays distinguishing (8 surviving stamps over 4 titles)',
    labStamps === 8);
  const r4 = await ask('h_chat_lab');
  check('lab hunt: HTTP 200', r4.status === 200 && r4.body.ok === true);
  const p4 = panelCounts(labEvents);
  check('lab hunt: panel derivation is 2 leads / 2 confirmed',
    p4.leads === 2 && p4.confirmed === 2);
  check('lab hunt: chat context line counts unique titles ("2 lead(s), 2 confirmed")',
    /2 lead\(s\), 2 confirmed so far/.test(r4.body.reply || ''));
  check('lab hunt: chat counts == panel counts (parity, leads AND confirmed)',
    JSON.stringify(replyCounts(r4.body.reply)) === JSON.stringify(p4));
  check('lab hunt: chat counts == findingCounts over the same record',
    JSON.stringify(replyCounts(r4.body.reply)) ===
    JSON.stringify(findingCounts(applyRetractions(labEvents))));
  check('lab hunt: raw stamp count never quoted as leads',
    !/8 lead\(s\)/.test(r4.body.reply || ''));
  check('lab hunt: "Found 2 confirmed vulnerabilities" with each title once',
    /Found 2 confirmed vulnerabilities: SQL injection in login, Reflected XSS in search\./.test(r4.body.reply || ''));
  check('lab hunt: retracted title appears nowhere in the reply',
    !/FTP directory listing/.test(r4.body.reply || ''));

  // (5) Lane Y leads-only: BOTH chat lead lines count unique
  //     titles (2), not raw stamps (4).
  const r5 = await ask('h_chat_leads_only');
  check('leads-only hunt: HTTP 200', r5.status === 200 && r5.body.ok === true);
  check('leads-only hunt: context line says "2 lead(s), 0 confirmed"',
    /2 lead\(s\), 0 confirmed so far/.test(r5.body.reply || ''));
  check('leads-only hunt: summary line says "2 lead(s) under investigation"',
    /2 lead\(s\) under investigation — nothing confirmed yet/.test(r5.body.reply || ''));
  check('leads-only hunt: chat counts == panel counts (parity)',
    JSON.stringify(replyCounts(r5.body.reply)) === JSON.stringify(panelCounts(leadsOnlyEvents)));
  check('leads-only hunt: raw stamp count never quoted as leads',
    !/4 lead\(s\)/.test(r5.body.reply || ''));

  // (6) Lane Y fully-retracted: the retracted pair contributes 0
  //     to both counts — the reply must not resurrect them even
  //     as leads.
  const r6 = await ask('h_chat_fully_retracted');
  check('fully-retracted hunt: HTTP 200', r6.status === 200 && r6.body.ok === true);
  const p6 = panelCounts(fullyRetractedEvents);
  check('fully-retracted hunt: panel derivation is 0 leads / 0 confirmed',
    p6.leads === 0 && p6.confirmed === 0);
  check('fully-retracted hunt: chat says "0 lead(s), 0 confirmed so far"',
    /0 lead\(s\), 0 confirmed so far/.test(r6.body.reply || ''));
  check('fully-retracted hunt: chat counts == panel counts (parity)',
    JSON.stringify(replyCounts(r6.body.reply)) === JSON.stringify(p6));
  check('fully-retracted hunt: no confirmed claim, no lead claim',
    !/Found \d+ confirmed/.test(r6.body.reply || '') &&
    !/[1-9]\d* lead\(s\) under investigation/.test(r6.body.reply || ''));
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
