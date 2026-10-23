// Test for Lane T (23 Oct 2026) — a FAILED executed action must be
// carried into the next turns as an explicit follow-through open
// thread, so its feedback can no longer be silently walked past.
//
// Live evidence (lab hunt h_bench_d69e5746, human mode):
//   Turn 8 (16:48:14Z): browser_click "ftp/acquisitions.md" failed —
//     "Click failed: no clickable element matches
//     "ftp/acquisitions.md". Take a browser_snapshot and use an
//     exact label from it."
//   Turn 9 (17:13:18Z, SAME session): the hunter never mentioned
//     the click or its feedback — it re-opened the /ftp page with
//     reasoning copied from an older framing ("the FTP directory
//     listing failed due to the lack of the FTP client…").
// The failure was in the record all along (journal + reasoning
// row); nothing carried it forward as an obligation. Lane P solved
// the sibling problem for dedup-BLOCKED attempts (explicit
// "Do NOT retry" threads in the hand-off); failed EXECUTED actions
// had no equivalent. failedActionThreadLines rebuilds one
// deterministically from the hunt's records on every turn.
//
// Run: node backend/scripts/test-failed-action-followthrough.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-t-'));
process.env.DATA_DIR = tmp;

const { humanIteration, failedActionThreadLines } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// Record shapes mirror production exactly: events carry cachedAt,
// reasoning rows are recordReasoning's {at, hypothesis, action,
// why, result, learned, followUp}.
const ev = (tool, detail, cachedAt) => ({ type: 'tool_call', tool, detail, via: 'human-mode', cachedAt });
const row = (action, result, at) => ({ at, hypothesis: '', action, why: 'fixture', result, learned: '', followUp: '' });

const FTP_URL = 'http://172.17.0.1:3000/ftp';
const CLICK_ERR = 'Click failed: no clickable element matches "ftp/acquisitions.md". Take a browser_snapshot and use an exact label from it.';
const openFtpEv = ev('browser_open', FTP_URL, '2026-10-23T16:20:00.068Z');
const openFtpRow = row(`browser_open: ${FTP_URL}`, `Opened ${FTP_URL} in your desktop browser.\nPage: listing directory /ftp — files: acquisitions.md, incident-support.kdbx`, '2026-10-23T16:20:25.233Z');
const clickEv = ev('browser_click', 'ftp/acquisitions.md', '2026-10-23T16:47:43.784Z');
const clickRow = row('browser_click: ftp/acquisitions.md', CLICK_ERR, '2026-10-23T16:48:14.121Z');

// --- (1) the exact turn-8 → turn-9 sequence --------------------------------
{
  const lines = failedActionThreadLines({ events: [openFtpEv, clickEv], reasoningRows: [openFtpRow, clickRow] });
  const text = lines.join('\n');
  check('turn-9 screen carries the follow-through thread', lines.length === 3 && text.includes('OPEN THREAD — YOUR LAST ACTION FAILED'));
  check('thread quotes the failed action (tool + detail)', text.includes('browser_click') && text.includes('ftp/acquisitions.md'));
  check('thread quotes the real error + tool feedback', text.includes('no clickable element matches') && text.includes('Take a browser_snapshot and use an exact label'));
}

// --- (2) clearing: snapshot, then snapshot + exact-label click -------------
{
  const snapEv = ev('browser_snapshot', '', '2026-10-23T17:00:00.000Z');
  check('a browser_snapshot after the failed click clears the thread (same family)',
    failedActionThreadLines({ events: [openFtpEv, clickEv, snapEv], reasoningRows: [openFtpRow, clickRow] }).length === 0);
  const goodClickEv = ev('browser_click', 'acquisitions.md', '2026-10-23T17:05:00.000Z');
  const goodClickRow = row('browser_click: acquisitions.md', 'Clicked the "acquisitions.md" link.', '2026-10-23T17:05:01.000Z');
  check('snapshot + exact-label click also leaves no thread',
    failedActionThreadLines({ events: [openFtpEv, clickEv, snapEv, goodClickEv], reasoningRows: [openFtpRow, clickRow, goodClickRow] }).length === 0);
}

// --- (3) expiry: 3 unaddressed later actions drop it, 2 do not -------------
{
  const later = [
    ev('shell', 'ls -la', '2026-10-23T17:20:00.000Z'),
    ev('search', 'owasp juice shop changelog', '2026-10-23T17:25:00.000Z'),
    ev('write_file', 'notes.txt', '2026-10-23T17:30:00.000Z'),
  ];
  check('thread survives 2 unaddressed later actions',
    failedActionThreadLines({ events: [openFtpEv, clickEv, ...later.slice(0, 2)], reasoningRows: [openFtpRow, clickRow] }).length === 3);
  check('thread expires after 3 unaddressed later actions',
    failedActionThreadLines({ events: [openFtpEv, clickEv, ...later], reasoningRows: [openFtpRow, clickRow] }).length === 0);
}

// --- (4) failed shell (the real turn-5 shape: exit 127) ---------------------
{
  const shEv = ev('shell', 'ftp 172.17.0.1 3000', '2026-10-23T15:37:43.704Z');
  const shRow = row('shell: ftp 172.17.0.1 3000', 'sh: 1: ftp: not found\n[exit code 127]', '2026-10-23T15:37:43.907Z');
  const lines = failedActionThreadLines({ events: [shEv], reasoningRows: [shRow] });
  const text = lines.join('\n');
  check('failed shell produces the equivalent thread', lines.length === 3 && text.includes('FAILED: shell') && text.includes('ftp 172.17.0.1 3000'));
  check('shell thread quotes the error and the exit code', text.includes('ftp: not found') && text.includes('exit code 127'));
  // The real turn-7 move addressed it by stem: browser_open of /ftp.
  check('a later browser_open of the same stem (/ftp) clears the shell thread',
    failedActionThreadLines({ events: [shEv, openFtpEv], reasoningRows: [shRow, openFtpRow] }).length === 0);
}

// --- (5) successes produce no thread — even scary-sounding ones -------------
{
  const okShellEv = ev('shell', 'ls -la; grep -c error app.log', '2026-10-23T10:00:00.000Z');
  const okShellRow = row('shell: ls -la; grep -c error app.log', 'total 8\n-rw-r--r-- 1 root root 120 app.log\n3 matches for "error" — command completed\n[exit code 0]', '2026-10-23T10:00:01.000Z');
  check('successful shell with error-flavoured output produces no thread',
    failedActionThreadLines({ events: [okShellEv], reasoningRows: [okShellRow] }).length === 0);
  const okOpenRow = row(`browser_open: ${FTP_URL}`, `Opened ${FTP_URL} in your desktop browser.\nPage: 404 Not Found — error page`, '2026-10-23T10:01:01.000Z');
  check('successful browser_open of an error page produces no thread',
    failedActionThreadLines({ events: [openFtpEv], reasoningRows: [okOpenRow] }).length === 0);
}

// --- (6) no duplication with Lane P's dedup "Do NOT retry" threads ----------
{
  const REGISTER = 'https://open.ys7.com/api/register';
  const regEv = ev('browser_open', REGISTER, '2026-10-23T09:00:00.000Z');
  const regRow = row(`browser_open: ${REGISTER}`, `Opened ${REGISTER} in your desktop browser.`, '2026-10-23T09:00:01.000Z');
  const blockEv = { type: 'dedup_block', tool: 'browser_open', detail: REGISTER, count: 3, via: 'human-mode', cachedAt: '2026-10-23T09:30:00.000Z' };
  const blockRow = row(`dedup_block: browser_open ${REGISTER}`, 'repeat blocked — already run ×3', '2026-10-23T09:30:00.500Z');
  const lines = failedActionThreadLines({ events: [regEv, blockEv], reasoningRows: [regRow, blockRow] });
  check('a dedup-blocked attempt produces NO follow-through thread', lines.length === 0);
  check('no "Do NOT retry" text is duplicated by this mechanism', !lines.join('\n').includes('Do NOT retry'));
}

// --- (7) the latest failure wins --------------------------------------------
{
  const shEv = ev('shell', 'ftp 172.17.0.1 3000', '2026-10-23T15:37:43.704Z');
  const shRow = row('shell: ftp 172.17.0.1 3000', 'sh: 1: ftp: not found\n[exit code 127]', '2026-10-23T15:37:43.907Z');
  const lines = failedActionThreadLines({ events: [shEv, openFtpEv, clickEv], reasoningRows: [shRow, openFtpRow, clickRow] });
  const text = lines.join('\n');
  check('with two failures the thread is about the LATEST one only',
    lines.length === 3 && text.includes('browser_click') && !text.includes('exit code 127'));
}

// --- (8) screen level: the thread rides the next turn's screen, then clears -
{
  const HUNT = 'h_follow_test';
  const TARGET = 'http://172.17.0.1:3000';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'hunts', HUNT, 'reasoning.jsonl'),
    [openFtpRow, clickRow].map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  const state = {
    screens: [],
    events: [openFtpEv, clickEv],
    meta: {
      huntId: HUNT,
      target: TARGET,
      mode: 'human',
      humanMode: true,
      humanLoop: { sessions: 2, turnsTotal: 8, lastTurnAt: '2026-10-23T16:48:14.127Z', leftOff: null },
    },
  };
  const queue = [
    'The click failed — let me look at the page properly first.\n{"action":"browser_snapshot"}',
    'Noted.\n{"action":"note","text":"ftp listing: click needs the exact label"}',
  ];
  const deps = {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async () => ({ stdout: '', stderr: '', code: 0 }),
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async () => [],
    writeFile: async (h, name, content) => ({ name, chars: content.length }),
    spill: () => 'spilled.log',
    record: (h, e) => state.events.push(e),
    readMeta: () => state.meta,
    writeMeta: (h, m) => { state.meta = JSON.parse(JSON.stringify(m)); },
    readEvents: () => state.events,
    // recordNote intentionally NOT injected: the production default
    // appends to the hunt's real reasoning.jsonl under DATA_DIR.
    assess: null,
    gui: {
      open: async (h, url) => ({ ok: true, observation: `Opened ${url} in your desktop browser.` }),
      snapshot: async () => ({ ok: true, observation: 'Page snapshot: links [acquisitions.md] [legal.md]' }),
      click: async () => ({ ok: true, observation: 'clicked' }),
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ ok: true, observation: 'shot' }),
    },
    sleep: async () => {},
    now: () => Date.now(),
    buildBriefing: async () => 'BRIEFING-MARKER',
  };
  const res = await humanIteration(HUNT, TARGET, { turns: 2, deps });
  check('screen-level session ran 2 turns', res.turnsRun === 2);
  const s1 = state.screens[0] || '';
  check('turn 1 screen carries the follow-through thread quoting the real click error',
    s1.includes('OPEN THREAD — YOUR LAST ACTION FAILED') && s1.includes('ftp/acquisitions.md') && s1.includes('exact label'));
  check('thread sits in the never-trimmed region (before the capped briefing)',
    s1.indexOf('OPEN THREAD — YOUR LAST ACTION FAILED') >= 0 && s1.indexOf('OPEN THREAD — YOUR LAST ACTION FAILED') < s1.indexOf('WHAT YOU KNOW'));
  const s2 = state.screens[1] || '';
  check('after the snapshot executes, the next screen no longer carries the thread',
    !s2.includes('OPEN THREAD — YOUR LAST ACTION FAILED'));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
