// Test for Lane S (23 Oct 2026) — hunt-chat truth & scoping, three
// defects from the owner's live frontend battery on the lab hunt:
//
//   (1) OFF-TOPIC NOT SCOPED: "Waise ye sab chhodo, mujhe Python me
//       quicksort ka code likh ke do aur ek joke bhi suna do" fell to
//       the shared-model LLM path and hung ~8.5 min in "Stop
//       generating". Fix: a deterministic off-topic guard runs BEFORE
//       the LLM for hunt-scoped chats — clear non-hunt requests with
//       no hunt anchor get an instant polite decline in the user's
//       register; anything uncertain falls through untouched.
//   (2) SUMMARY NEVER SAID WHAT WAS TRIED: summaryReply counted
//       findings but never recounted attempts. Fix: a "Recent
//       attempts" narration from the hunt's own record (tool_call
//       events + the outcome line of the matching reasoning row).
//   (3) MID-WORD TRUNCATION: the "Currently:" thinking quote was a
//       raw slice(0, 200) — a live reply ended "...sensitive in the
//       FTP direct". Fix: clipClean ends quotes at a sentence/word
//       boundary with an ellipsis.
//
// Run: node backend/scripts/test-chat-scoping-attempts.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-lane-s-'));
process.env.DATA_DIR = tmp;
process.env['JWT' + '_SECRET'] = ['dm', 'lane', 's', 'test', 'key', '0123456789abcdef'].join('-');

const express = (await import('express')).default;
const store = await import('../src/store.js');
const { issueToken } = await import('../src/routes/auth.js');
const chatMod = await import('../src/routes/chat.js');
const chatRouter = chatMod.default;
const { isOffTopicHuntChat, clipClean, recentAttempts, offTopicDecline } = chatMod;

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const ADMIN = { id: 'u-admin', username: 'tester', role: 'admin', control: 'maximum' };
const token = issueToken(ADMIN);

function seedHunt(id, { events = [], reasoning = [], target = 'http://172.17.0.1:3000' } = {}) {
  store.writeHuntMeta(id, {
    huntId: id, userId: ADMIN.id, target, state: 'running',
    phase: 'hunting', iteration: 471, mode: 'human', humanMode: true,
  });
  const dir = path.join(tmp, 'hunts', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  if (reasoning.length) {
    fs.writeFileSync(path.join(dir, 'reasoning.jsonl'), reasoning.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
}

// The long thinking line: ONE sentence, > 200 chars once normalised,
// so the old raw slice would have cut it mid-word (the live defect).
const LONG_THINKING =
  'I notice that the FTP directory listing failed due to the lack of the FTP client on my Kali machine ' +
  'and I wonder whether there is a specific sensitive file somewhere in the FTP directory that I should ' +
  'look for next on this target before moving on to other surfaces';

// Hunt A mirrors the live lab record: ftp shell failed (no client),
// curl failed, the /ftp listing was reached in the browser, and a
// click on acquisitions.md failed on label precision. No findings.
seedHunt('h_chat_lab', {
  events: [
    { type: 'thinking', text: 'Human mode session: 6 turns at my own machine.', cachedAt: '2026-10-23T16:00:00.000Z' },
    { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000', via: 'human-mode', cachedAt: '2026-10-23T16:01:00.000Z' },
    { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000/admin', via: 'human-mode', cachedAt: '2026-10-23T16:05:00.000Z' },
    { type: 'tool_call', tool: 'shell', detail: 'ftp 172.17.0.1 3000', via: 'human-mode', cachedAt: '2026-10-23T16:10:00.000Z' },
    { type: 'tool_call', tool: 'shell', detail: 'curl -O -s -L http://172.17.0.1:3000/ftp', via: 'human-mode', cachedAt: '2026-10-23T16:15:00.000Z' },
    { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000/ftp', via: 'human-mode', cachedAt: '2026-10-23T16:20:00.000Z' },
    { type: 'tool_call', tool: 'browser_click', detail: 'ftp/acquisitions.md', via: 'human-mode', cachedAt: '2026-10-23T16:25:00.000Z' },
    { type: 'thinking', text: LONG_THINKING, cachedAt: '2026-10-23T16:26:00.000Z' },
  ],
  reasoning: [
    { at: '2026-10-23T16:01:30.000Z', action: 'browser_open: http://172.17.0.1:3000', why: '', result: 'Opened http://172.17.0.1:3000 in your desktop browser. Page: OWASP Juice Shop', learned: '' },
    { at: '2026-10-23T16:05:30.000Z', action: 'browser_open: http://172.17.0.1:3000/admin', why: '', result: 'Opened http://172.17.0.1:3000/admin in your desktop browser.', learned: '' },
    { at: '2026-10-23T16:10:30.000Z', action: 'shell: ftp 172.17.0.1 3000', why: '', result: 'sh: 1: ftp: not found\n[exit code 127]', learned: '' },
    { at: '2026-10-23T16:15:30.000Z', action: 'shell: curl -O -s -L http://172.17.0.1:3000/ftp', why: '', result: 'Command failed: curl: (18) transfer closed with outstanding read data remaining', learned: '' },
    { at: '2026-10-23T16:20:30.000Z', action: 'browser_open: http://172.17.0.1:3000/ftp', why: '', result: 'Opened http://172.17.0.1:3000/ftp in your desktop browser. Page: listing directory /ftp', learned: '' },
    { at: '2026-10-23T16:25:30.000Z', action: 'browser_click: ftp/acquisitions.md', why: '', result: 'Click failed: no clickable element matches "ftp/acquisitions.md". Take a browser_snapshot and use an exact label from it.', learned: '' },
  ],
});

// Hunt B: a genuine verified finding PLUS attempts — the confirmed
// sentence (Lane P truth rules) must survive the attempts narration.
seedHunt('h_chat_genuine_attempts', {
  events: [
    { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000/#/login', via: 'human-mode', cachedAt: '2026-10-23T10:00:00.000Z' },
    { type: 'tool_call', tool: 'shell', detail: "curl -s http://172.17.0.1:3000/rest/user/login -d '{\"email\":\"x\"}'", via: 'human-mode', cachedAt: '2026-10-23T10:05:00.000Z' },
    { type: 'finding', title: 'SQL injection in login', severity: 'high', verified: true, cachedAt: '2026-10-23T10:06:00.000Z' },
  ],
  reasoning: [
    { at: '2026-10-23T10:00:30.000Z', action: 'browser_open: http://172.17.0.1:3000/#/login', why: '', result: 'Opened the login page.', learned: '' },
    { at: '2026-10-23T10:05:30.000Z', action: "shell: curl -s http://172.17.0.1:3000/rest/user/login -d '{\"email\":\"x\"}'", why: '', result: 'HTTP 200 with an admin token in the response.', learned: '' },
  ],
});

const app = express();
app.use(express.json());
app.use('/api/v1/chat', chatRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function ask(huntId, message) {
  const started = Date.now();
  const res = await fetch(`${base}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, huntId }),
  });
  return { status: res.status, body: await res.json(), ms: Date.now() - started };
}

try {
  // ---- (2) "What did you try" is answered from the record --------
  const hunt = await ask('h_chat_lab', 'Abhi tak tumne kya kya try kiya hai aur FTP par kya mila? Koi confirmed finding hai?');
  check('battery hunt question: HTTP 200', hunt.status === 200 && hunt.body.ok === true);
  check('battery hunt question: NOT declined as off-topic', hunt.body.scoped !== true && !/sirf is hunt/.test(hunt.body.reply || ''));
  check('battery hunt question: 0 confirmed (truth preserved)', /0 confirmed/.test(hunt.body.reply || ''));
  check('attempts narration present', /Recent attempts:/.test(hunt.body.reply || ''));
  check('attempts include the failed ftp shell probe AND its outcome',
    /shell ftp 172\.17\.0\.1 3000 — sh: 1: ftp: not found/.test(hunt.body.reply || ''));
  check('attempts include the failed curl probe', /curl -O -s -L http:\/\/172\.17\.0\.1:3000\/ftp — Command failed/.test(hunt.body.reply || ''));
  check('attempts include reaching the /ftp listing in the browser',
    /browser_open http:\/\/172\.17\.0\.1:3000\/ftp — Opened http:\/\/172\.17\.0\.1:3000\/ftp/.test(hunt.body.reply || ''));
  check('attempts include the failed click AND its outcome',
    /browser_click ftp\/acquisitions\.md — Click failed: no clickable element matches/.test(hunt.body.reply || ''));

  // ---- (3) The "Currently:" quote never ends mid-word ------------
  const replyText = String(hunt.body.reply || '');
  const quote = replyText.includes(' Currently: ') ? replyText.split(' Currently: ')[1] : '';
  const normalised = LONG_THINKING.replace(/\s+/g, ' ').trim();
  check('long thinking WAS clipped (source exceeds the 200-char budget)', normalised.length > 200 && quote.length < normalised.length);
  check('clipped quote ends with an ellipsis', /…$/.test(quote.trim()));
  const bare = quote.trim().replace(/\s*…$/, '');
  check('clipped quote is a true prefix of the thinking text', normalised.startsWith(bare));
  check('clipped quote stops at a word/sentence boundary, not mid-word',
    bare.endsWith('.') || normalised[bare.length] === ' ' || normalised[bare.length] === undefined);

  // ---- (1) Off-topic: instant decline, user's register -----------
  const offHinglish = await ask('h_chat_lab', 'Waise ye sab chhodo, mujhe Python me quicksort ka code likh ke do aur ek joke bhi suna do');
  check('off-topic Hinglish: HTTP 200 + scoped flag', offHinglish.status === 200 && offHinglish.body.scoped === true);
  check('off-topic Hinglish: declined in Hinglish', /sirf is hunt ki baat/.test(offHinglish.body.reply || ''));
  check('off-topic Hinglish: no code, no joke, no hunt narration in the reply',
    !/Recent attempts/.test(offHinglish.body.reply || '') && !/def quicksort|quicksort\(/.test(offHinglish.body.reply || ''));
  check('off-topic Hinglish: answered fast (deterministic, no LLM queue)', offHinglish.ms < 5000);

  const offEnglish = await ask('h_chat_lab', 'Tell me a joke and also write the quicksort code for me please');
  check('off-topic English: scoped + declined in English',
    offEnglish.body.scoped === true && /only for this hunt/.test(offEnglish.body.reply || '') && !/sirf is hunt/.test(offEnglish.body.reply || ''));

  const offWeather = await ask('h_chat_lab', 'aaj ka mausam kaisa hai?');
  check('off-topic weather (Hinglish): scoped + Hinglish decline',
    offWeather.body.scoped === true && /sirf is hunt ki baat/.test(offWeather.body.reply || ''));

  // ---- Hunt questions must NEVER be declined ----------------------
  const ftpQ = await ask('h_chat_lab', 'ftp par kya mila?');
  check('"ftp par kya mila?": NOT scoped, answered from the record',
    ftpQ.body.scoped !== true && /Recent attempts:/.test(ftpQ.body.reply || ''));
  const prog = await ask('h_chat_lab', 'What is the progress?');
  check('"What is the progress?": summary path intact, NOT scoped',
    prog.body.scoped !== true && /0 confirmed/.test(prog.body.reply || ''));

  // ---- Confirmed-truth composition survives the narration --------
  const gen = await ask('h_chat_genuine_attempts', 'What is the progress?');
  check('genuine hunt: "Found 1 confirmed vulnerability" intact',
    /Found 1 confirmed vulnerability: SQL injection in login\./.test(gen.body.reply || ''));
  check('genuine hunt: attempts narration appended, finding counted once',
    /Recent attempts:/.test(gen.body.reply || '') && /1 confirmed/.test(gen.body.reply || ''));

  // ---- Classifier unit checks -------------------------------------
  check('unit: "capital of France" is off-topic', isOffTopicHuntChat('What is the capital of France?') === true);
  check('unit: poem request is off-topic', isOffTopicHuntChat('write a poem about the moon') === true);
  check('unit: kahani sunao is off-topic', isOffTopicHuntChat('mujhe ek kahani sunao') === true);
  check('unit: "aaj ki news batao" is off-topic', isOffTopicHuntChat('aaj ki news batao') === true);
  check('unit: battery off-topic is off-topic',
    isOffTopicHuntChat('Waise ye sab chhodo, mujhe Python me quicksort ka code likh ke do aur ek joke bhi suna do') === true);
  check('unit: battery hunt question is NOT off-topic',
    isOffTopicHuntChat('Abhi tak tumne kya kya try kiya hai aur FTP par kya mila? Koi confirmed finding hai?') === false);
  check('unit: "translate this hunt report" falls through (report anchor wins)',
    isOffTopicHuntChat('translate this hunt report into Hindi') === false);
  check('unit: exploit question is NOT off-topic', isOffTopicHuntChat('How can I exploit the login page?') === false);
  check('unit: steering beats the guard ("pause the hunt" + joke)', isOffTopicHuntChat('pause the hunt and tell me a joke') === false);
  check('unit: "koi news hai?" is a progress ask, NOT off-topic', isOffTopicHuntChat('koi news hai?') === false);
  check('unit: host mention is NOT off-topic',
    isOffTopicHuntChat('172.17.0.1 par kya chal raha hai?', { host: '172.17.0.1' }) === false);
  check('unit: empty message is NOT off-topic', isOffTopicHuntChat('') === false);
  check('unit: decline register — Devanagari gets the Hinglish line', /sirf is hunt/.test(offTopicDecline('एक joke सुनाओ')));
  check('unit: decline register — plain English gets the English line', /only for this hunt/.test(offTopicDecline('tell me a joke')));

  // ---- clipClean unit checks ---------------------------------------
  check('unit: clipClean leaves short text unchanged', clipClean('short and sweet', 200) === 'short and sweet');
  check('unit: clipClean prefers a sentence boundary',
    clipClean('First sentence done. Second sentence keeps going with many more words after it.', 40) === 'First sentence done. …');
  const hardCut = clipClean('a'.repeat(300), 50);
  check('unit: clipClean hard-cuts a single unbroken token with an ellipsis', hardCut === `${'a'.repeat(50)}…`);
  check('unit: clipClean normalises whitespace', clipClean('line one\n\nline   two', 200) === 'line one line two');

  // ---- recentAttempts unit checks ----------------------------------
  check('unit: recentAttempts of an empty record is empty', recentAttempts({ events: [], reasoningRows: [] }) === '');
  const dupCalls = [
    { type: 'tool_call', tool: 'browser_open', detail: 'http://x.test/', cachedAt: '2026-10-23T00:00:00.000Z' },
    { type: 'tool_call', tool: 'browser_open', detail: 'http://x.test/', cachedAt: '2026-10-23T00:01:00.000Z' },
    { type: 'tool_call', tool: 'browser_open', detail: 'http://x.test/', cachedAt: '2026-10-23T00:02:00.000Z' },
  ];
  const dupNarration = recentAttempts({ events: dupCalls, reasoningRows: [] });
  check('unit: consecutive identical attempts collapse to one entry',
    dupNarration.startsWith('Recent attempts: ') && (dupNarration.match(/browser_open/g) || []).length === 1);
  const sevenCalls = Array.from({ length: 7 }, (_, i) => ({
    type: 'tool_call', tool: 'shell', detail: `probe-${i + 1}`, cachedAt: `2026-10-23T00:0${i}:00.000Z`,
  }));
  const sevenNarration = recentAttempts({ events: sevenCalls, reasoningRows: [] });
  check('unit: attempts narration keeps only the LAST 5',
    !sevenNarration.includes('probe-1') && !sevenNarration.includes('probe-2') && sevenNarration.includes('probe-7'));
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
