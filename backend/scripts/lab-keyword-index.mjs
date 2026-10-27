// Lab for the KEYWORD-INDEX lane (27 Oct 2026, owner order).
//
// Boots the REAL backend (child process, tmp DATA_DIR, admin user
// from env bootstrap) and proves, end to end with a STUBBED brain
// only — no live api.meta.ai call, no credit burn, no real 8B turn:
//
//   1. Two hunts in the same store stay separate: hunt A
//      (example.com) and hunt B (example.org). B's events never
//      appear in A's index, and recall on A can never return B.
//   2. The loop-driven hunt (stubbed brain, REAL store): the
//      task block beside the action is recorded as currentTask and
//      renders on the next screen ("ABHI YE CHAL RAHA HAI"); a
//      complete block saves a task_complete event + lastCompletedTask
//      and clears currentTask; recall #1 returns the full stored
//      record of action #1; the third identical browser_open is
//      blocked by the already-done gate, and the block observation
//      names #1 + the content-hash.
//   3. The Action Index stays bounded: 100 actions render within
//      ~2,000 chars, newest 12 in full, older grouped per area.
//
// Run: node backend/scripts/lab-keyword-index.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-keyword-index-'));
process.env.DATA_DIR = tmp;
const PORT = 4624;
const HUNT_A = 'h_lab_index_a';
const HUNT_B = 'h_lab_index_b';
const TARGET_A = 'https://example.com';
const TARGET_B = 'https://example.org';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const { humanIteration } = await import('../src/humanLoop.js');
const { parseScope } = await import('../src/scopeParser.js');
const { buildActionIndex, indexLines, recallById, firstRunNumber } = await import('../src/actionIndex.js');
const { writeHuntMeta, readHuntMeta, readHuntEvents, appendHuntEvent } = await import('../src/store.js');
const { recordReasoning, getAllReasoning } = await import('../src/reasoningMemory.js');

// ---- boot the real backend (child) with an admin user ---------------------
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync('lab-admin-pass-123', salt, 64).toString('hex');
const child = spawn(process.execPath, [path.join(here, '..', 'src', 'server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: tmp,
    LAB_TARGETS: 'example.com,example.org',
    ADMIN_USERNAME: 'labadmin',
    ADMIN_PASSWORD_SALT: salt.toString('hex'),
    ADMIN_PASSWORD_HASH: hash,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let childLog = '';
child.stdout.on('data', (d) => { childLog += d; });
child.stderr.on('data', (d) => { childLog += d; });

const base = `http://127.0.0.1:${PORT}`;
async function waitHealthy() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
async function api(method, p, token, body) {
  const r = await fetch(`${base}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch { /* non-JSON */ }
  return { status: r.status, data };
}

const SNAP = { url: TARGET_A, title: 'example', text: 'example.com', elements: [] };

let token = null;
let adminId = null;
try {
  check('backend boots + health OK', await waitHealthy());
  const login = await api('POST', '/api/v1/auth/login', null, { username: 'labadmin', password: 'lab-admin-pass-123' });
  check('admin login works', login.status === 200 && !!login.data.token);
  token = login.data.token;
  adminId = login.data.user && login.data.user.id;

  // ---- the two lab hunts: same store, different targets ------------------
  // state 'running' (not paused): humanIteration holds position on
  // a paused/stopped meta, so a paused seed would run zero turns.
  writeHuntMeta(HUNT_A, { huntId: HUNT_A, target: TARGET_A, userId: adminId, state: 'running', iteration: 1, mode: 'human', humanMode: true });
  writeHuntMeta(HUNT_B, { huntId: HUNT_B, target: TARGET_B, userId: adminId, state: 'running', iteration: 1, mode: 'human', humanMode: true });
  // GET /:id proxies to the hunt engine (502 when it is down, as in
  // a lab) — the cost route reads the same store and answers 200.
  const costA = await api('GET', `/api/v1/hunts/${HUNT_A}/cost`, token);
  check('GET cost returns the seeded hunt (backend sees the store)', costA.status === 200 && costA.data.totalUsd === 0);

  // Seed hunt B (y-domain) with its own actions — the isolation foil.
  appendHuntEvent(HUNT_B, { type: 'tool_call', tool: 'search', detail: 'example.org admin panel', via: 'human-mode' });
  appendHuntEvent(HUNT_B, { type: 'tool_call', tool: 'browser_open', detail: 'https://example.org/admin', via: 'human-mode' });
  appendHuntEvent(HUNT_B, { type: 'tool_call', tool: 'shell', detail: 'nmap -sV example.org', via: 'human-mode' });
  recordReasoning(HUNT_B, { action: 'search: example.org admin panel', why: 'lab', result: 'admin panel found', learned: '' });
  recordReasoning(HUNT_B, { action: 'browser_open: https://example.org/admin', why: 'lab', result: 'admin page opened', learned: '' });

  // ---- the loop-driven hunt A: stubbed brain, REAL store -----------------
  const screens = [];
  let n = 0;
  const replies = [
    // Turn 1: open the login page + task block (in progress).
    `Opening the login page to probe it.\n${JSON.stringify({ action: 'browser_open', url: 'https://example.com/login', task: { task: 'Probe the login form for SQLi', goal: 'Find whether the login query is injectable', progress: 'login page open, first probe pending', status: 'in_progress' } })}`,
    // Turn 2: same page again + task block (complete).
    `The page is open; the form is mapped.\n${JSON.stringify({ action: 'browser_open', url: 'https://example.com/login', task: { task: 'Probe the login form for SQLi', goal: 'Find whether the login query is injectable', progress: 'form mapped: email + password', status: 'complete', summary: 'login page opens, form has email + password' } })}`,
    // Turn 3: recall action #1 by id.
    `I need the exact first action again.\n${JSON.stringify({ action: 'recall', id: 1 })}`,
    // Turn 4: the same page a third time — the gate must block it.
    `Opening the login page once more.\n${JSON.stringify({ action: 'browser_open', url: 'https://example.com/login' })}`,
    // Turn 5: a note, so turn 4's block observation lands on a screen.
    `Checking what the block said.\n${JSON.stringify({ action: 'note', text: 'the gate blocked the third open' })}`,
  ];
  const res = await humanIteration(HUNT_A, TARGET_A, {
    turns: replies.length,
    parsedScope: parseScope(TARGET_A),
    deps: {
      chat: async (messages) => { screens.push(messages[0].text); return replies[n++]; },
      gui: {
        open: async () => ({ observation: 'opened', snapshot: SNAP }),
        snapshot: async () => ({ observation: `Page: ${TARGET_A}`, snapshot: SNAP }),
        click: async () => ({ ok: true, observation: 'clicked', snapshot: SNAP }),
        type: async () => ({ ok: true, observation: 'Typed.', snapshot: SNAP }),
        screenshot: async () => ({ observation: 'shot', snapshot: SNAP }),
      },
      execRaw: async () => ({ stdout: '', stderr: '' }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => 'no results',
      buildBriefing: async () => '',
      machineControlled: () => false,
      desktopScreenshot: async () => ({ ok: true, name: 'lab.jpg' }),
      startDesktop: async () => {},
      assess: null,
    },
  });
  check('loop ran all 5 stubbed turns', res.turnsRun === 5 && screens.length === 5);

  // ---- task block: recorded, rendered, completed, saved ------------------
  check('turn 2 screen shows the running task', screens[1].includes('ABHI YE CHAL RAHA HAI') && screens[1].includes('Probe the login form for SQLi'));
  check('turn 2 screen carries the Action Index with #1', screens[1].includes('ACTION INDEX') && screens[1].includes('#1 browser_open'));
  check('turn 3 screen shows the completed task', screens[2].includes('LAST COMPLETED TASK') && screens[2].includes('login page opens, form has email + password'));
  const metaA = readHuntMeta(HUNT_A);
  check('meta currentTask is cleared after completion', (metaA.humanLoop && metaA.humanLoop.currentTask) === null);
  check('meta lastCompletedTask keeps the task', metaA.humanLoop && metaA.humanLoop.lastCompletedTask && metaA.humanLoop.lastCompletedTask.task === 'Probe the login form for SQLi');
  const eventsA = readHuntEvents(HUNT_A);
  check('task_complete event saved to disk on completion', eventsA.some((e) => e.type === 'task_complete' && e.task === 'Probe the login form for SQLi' && e.summary === 'login page opens, form has email + password'));

  // ---- recall by id: the full stored record of action #1 -----------------
  check('turn 4 screen carries the recalled full record of #1', screens[3].includes('#1 browser_open — https://example.com/login'));
  const rec1 = recallById(eventsA, getAllReasoning(HUNT_A), 1);
  check('recallById(1) returns hunt A action #1', rec1.entry && rec1.entry.tool === 'browser_open' && rec1.event.detail === 'https://example.com/login');

  // ---- dedup gate: the third identical open is blocked, #N + hash named -
  check('dedup_block event recorded for the third open', eventsA.some((e) => e.type === 'dedup_block' && e.tool === 'browser_open' && e.count === 2));
  check('turn 5 screen carries the block with #1 + hash', screens[4].includes('BLOCKED — ALREADY DONE') && screens[4].includes('#1') && screens[4].includes('hash '));
  check('first run of the repeat is #1', firstRunNumber(eventsA, 'browser_open', 'https://example.com/login') === 1);

  // ---- index: the loop's own actions are numbered, bounded --------------
  const idxA = buildActionIndex(eventsA, getAllReasoning(HUNT_A));
  check('index holds the loop actions in order', idxA.length >= 4 && idxA[0].n === 1 && idxA[0].tool === 'browser_open');
  check('index labels are specific (variant + outcome)', idxA[0].label === 'browser_open | example.com/login | — | done');

  // ---- ISOLATION: hunt B never leaks into hunt A, or vice versa ---------
  const eventsB = readHuntEvents(HUNT_B);
  check('hunt B events hold only B actions', eventsB.length === 3 && eventsB.every((e) => !String(e.detail || '').includes('example.com')));
  check('hunt A events hold only A actions', eventsA.every((e) => !String(e.detail || '').includes('example.org')));
  const idxB = buildActionIndex(eventsB, getAllReasoning(HUNT_B));
  check('hunt B index contains no example.com detail', idxB.every((e) => !String(e.detail).includes('example.com')));
  const recB1 = recallById(eventsB, getAllReasoning(HUNT_B), 1);
  check('recall on B returns B data only', recB1.entry && recB1.event.detail === 'example.org admin panel');
  check('recall out of range names the count, never other-hunt data', recallById(eventsA, getAllReasoning(HUNT_A), 99).error !== undefined);
  check("B's URL never ran in A", firstRunNumber(eventsA, 'browser_open', 'https://example.org/admin') === null);

  // ---- BOUNDED: 100 actions render within ~2,000 chars ------------------
  for (let i = 0; i < 100; i++) {
    appendHuntEvent(HUNT_B, { type: 'tool_call', tool: i % 2 ? 'search' : 'browser_open', detail: i % 2 ? `probe topic ${i}` : `https://example.org/page${i}`, via: 'human-mode' });
  }
  const bigIdx = buildActionIndex(readHuntEvents(HUNT_B), getAllReasoning(HUNT_B));
  const bigLines = indexLines(bigIdx);
  check('100-action index stays within budget', bigLines.join('\n').length <= 2000);
  check('100-action index renders the newest 12 in full', bigLines.filter((l) => /^#\d+ /.test(l)).length === 12);
} catch (err) {
  console.log('FAIL  lab threw:', err && err.message);
  console.log(String((err && err.stack) || '').split('\n').slice(0, 8).join('\n'));
  failures++;
} finally {
  try {
    child.kill('SIGTERM');
  } catch { /* already gone */ }
}

if (!child.killed) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    child.kill('SIGKILL');
  } catch { /* already gone */ }
}
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
if (failures !== 0) console.log('--- backend log (tail) ---\n' + childLog.slice(-2000));
process.exit(failures === 0 ? 0 : 1);
