// Test for Lane P, Defect 1b (23 Oct 2026) — human-mode progress
// must be visible WHILE the hunt runs, and a dedup-blocked action
// must not be handed off as the next session's pending step.
//
// Live evidence:
//   (i)  The Ezviz hunt resumed at round 166 and the website showed
//        no progress for ~12 minutes while the backend WAS working:
//        meta.humanLoop.turnsTotal only moved at session end, so a
//        whole 6-turn session was invisible in the hunt's totals.
//        Fix: a guarded progress checkpoint after EVERY turn writes
//        the absolute turns total; the session-end checkpoint takes
//        max(prev, base + turnsRun) so nothing double-counts.
//   (ii) The session wasted turns re-trying browser_open
//        https://open.ys7.com/api/register, which the already-done
//        gate blocked — and the same blocked action was already
//        sitting in leftOff from the previous session, stored as a
//        "last action", so the next session read it as its pending
//        thread and retried it. Fix: blocked attempts are excluded
//        from leftOff.lastActions and are handed off instead as an
//        explicit "Do NOT retry" open thread.
//
// Run: node backend/scripts/test-human-turn-progress.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-turn-progress-'));
process.env.DATA_DIR = tmp;

const { humanIteration } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'https://open.ys7.com';
const REGISTER = 'https://open.ys7.com/api/register';

const state = {
  screens: [],
  events: [],
  guiOpens: [],
  metaWrites: [],
  meta: {
    huntId: 'h_progress_test',
    target: TARGET,
    mode: 'human',
    humanMode: true,
    humanLoop: { sessions: 3, turnsTotal: 40, lastTurnAt: '2026-10-22T18:27:00.000Z', leftOff: null },
  },
};
const queue = [
  // Turn 1: retry the already-done register page — the gate blocks it.
  `Let me check the register endpoint again.\n{"action":"browser_open","url":"${REGISTER}"}`,
  // Turn 2: a genuinely new action — executes.
  'Opening the login page instead.\n{"action":"browser_open","url":"https://open.ys7.com/login"}',
  // Turn 3: a note to self.
  'Wrapping up.\n{"action":"note","text":"register is a dead end, login is next"}',
];
const pastEvents = [
  { type: 'tool_call', tool: 'browser_open', detail: REGISTER },
  { type: 'tool_call', tool: 'browser_open', detail: REGISTER },
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
  record: (h, ev) => state.events.push(ev),
  readMeta: () => state.meta,
  writeMeta: (h, m) => { state.metaWrites.push(JSON.parse(JSON.stringify(m))); state.meta = m; },
  readEvents: () => pastEvents,
  recordNote: () => {},
  assess: null,
  gui: {
    open: async (h, url) => {
      state.guiOpens.push(url);
      return { ok: true, observation: `Opened ${url} in your desktop browser.` };
    },
    snapshot: async () => ({ ok: true, observation: 'snapshot' }),
    click: async () => ({ ok: true, observation: 'clicked' }),
    type: async () => ({ ok: true, observation: 'typed' }),
    screenshot: async () => ({ ok: true, observation: 'shot' }),
  },
  sleep: async () => {},
  now: () => Date.now(),
  buildBriefing: async () => 'BRIEFING-MARKER',
};

const res = await humanIteration('h_progress_test', TARGET, { turns: 3, deps });

// --- (i) per-turn progress -------------------------------------------------
check('session ran 3 turns', res.turnsRun === 3);
check('gate blocked the register retry (no GUI open for it)',
  !state.guiOpens.includes(REGISTER) && state.events.some((e) => e.type === 'dedup_block'));
check('login open executed', state.guiOpens.includes('https://open.ys7.com/login'));
check('a progress checkpoint landed DURING the session (turnsTotal 41 before session end)',
  state.metaWrites.slice(0, -1).some((m) => m.humanLoop && m.humanLoop.turnsTotal === 41));
check('progress checkpoints advanced monotonically (41, 42, 43 all seen)',
  [41, 42, 43].every((n) => state.metaWrites.some((m) => m.humanLoop && m.humanLoop.turnsTotal === n)));
check('final totals: turnsTotal 43 (no double count), sessions 4',
  state.meta.humanLoop.turnsTotal === 43 && state.meta.humanLoop.sessions === 4);

// --- (ii) leftOff hand-off ---------------------------------------------------
const lo = state.meta.humanLoop.leftOff;
check('leftOff written', Boolean(lo));
check('leftOff.lastActions excludes the BLOCKED register attempt',
  Array.isArray(lo.lastActions) && !lo.lastActions.some((a) => String(a.detail || '').includes('/api/register')));
check('leftOff.lastActions keeps the executed login open',
  Array.isArray(lo.lastActions) && lo.lastActions.some((a) => String(a.detail || '').includes('/login')));
check('leftOff.openThreads carries an explicit Do NOT retry for the blocked action',
  Array.isArray(lo.openThreads) && lo.openThreads.some((t) => t.includes('Do NOT retry') && t.includes('/api/register')));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
