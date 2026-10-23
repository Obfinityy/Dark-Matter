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
seedHunt('h_chat_retracted', [
  { type: 'thinking', text: 'Probing the FTP service.', cachedAt: '2026-10-20T12:50:00.000Z' },
  { type: 'finding', title: 'FTP directory listing', severity: 'high', verified: true, cachedAt: '2026-10-20T12:57:24.801Z' },
  { type: 'finding', title: 'Sensitive file exposure', severity: 'high', verified: true, cachedAt: '2026-10-20T13:23:12.720Z' },
  { type: 'finding', title: 'Reflected XSS in search', severity: 'medium', verified: false, verification: 'the verifier did not confirm it', cachedAt: '2026-10-20T14:00:00.000Z' },
  { type: 'retraction', findingTitle: 'FTP directory listing', retractsStampTs: '2026-10-20T12:57:24.801Z', cachedAt: '2026-10-21T00:00:00.000Z' },
  { type: 'retraction', findingTitle: 'Sensitive file exposure', retractsStampTs: '2026-10-20T13:23:12.720Z', cachedAt: '2026-10-21T00:00:01.000Z' },
]);

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

try {
  const r1 = await ask('h_chat_retracted');
  check('retracted hunt: HTTP 200', r1.status === 200 && r1.body.ok === true);
  check('retracted hunt: 0 confirmed in the reply', /0 confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: reply does NOT claim "Found 2 confirmed"', !/Found 2 confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: retracted titles not listed as confirmed',
    !/confirmed vulnerabilities?: FTP/.test(r1.body.reply || '') && !/Found \d+ confirmed/.test(r1.body.reply || ''));
  check('retracted hunt: remaining lead framed as under investigation',
    /under investigation — nothing confirmed yet/.test(r1.body.reply || ''));

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
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
