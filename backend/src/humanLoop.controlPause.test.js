// Take Control of This Machine — agent GUI pause gate tests.
//
// While the owner holds the control lock, the agent's GUI/browser
// actions are skipped (never executed), a countable control_pause
// event is recorded, and the brain is told to spend the turn on
// non-GUI work. Non-GUI actions (search, shell) keep running — the
// hunt itself is never paused by a takeover.
//
// WRONG-PAGE GUARD (25 Oct 2026, fix 5): the loop takes ONE
// read-only turn-start snapshot when the session opens — before the
// first turn, even while controlled (it types/clicks nothing, so it
// cannot fight the owner's input). The VISIBLE-DESKTOP-FIRST
// heartbeat (27 Oct 2026) adds ONE more read-only snapshot per
// turn — the same kind of read, also while controlled. The guiCalls
// assertions below therefore expect one turn-start snapshot plus
// one heartbeat snapshot per turn; the brain's own GUI actions
// must still never run while controlled.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DATA_DIR isolation (fixture-pollution fix, 6 Nov 2026): humanIteration
// writes hunt meta into config.dataDir and records episodes into
// episodes.db, and config resolves dataDir at import time — so the
// temp dir must be set BEFORE the dynamic import of humanLoop.js
// below. Without this, the h_test_ctrl dir + episodes.db land in the
// REAL backend/data tree on every suite run.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-ctrl-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');

function stubSession(replies, { controlled = false } = {}) {
  const recorded = [];
  const guiCalls = [];
  let n = 0;
  return {
    recorded,
    guiCalls,
    run: () => humanIteration('h_test_ctrl', 'https://ksuite.infomaniak.com', {
      turns: replies.length,
      deps: {
        chat: async () => replies[n++],
        gui: {
          open: async () => { guiCalls.push('open'); return { observation: 'opened' }; },
          snapshot: async () => { guiCalls.push('snapshot'); return { observation: 'snap' }; },
          click: async () => { guiCalls.push('click'); return { observation: 'clicked' }; },
          type: async () => { guiCalls.push('type'); return { observation: 'Typed.' }; },
          screenshot: async () => { guiCalls.push('screenshot'); return { observation: 'shot' }; },
        },
        execRaw: async () => ({ stdout: '', stderr: '' }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => [],
        buildBriefing: async () => '',
        machineControlled: () => controlled,
        assess: null,
      },
    }),
  };
}

test('CP-1 (wire-up): browser_click is skipped while the owner controls the machine', async () => {
  const s = stubSession(
    ['I will click Sign in.\n{"action":"browser_click","text":"Sign in"}'],
    { controlled: true },
  );
  const res = await s.run();
  assert.deepEqual(s.guiCalls, ['snapshot', 'snapshot'], 'only read-only snapshots may run while controlled — the turn-start snapshot plus the per-turn heartbeat; the click must not');
  const paused = res.log.find((e) => String(e.observation || '').includes('PAUSED'));
  assert.ok(paused, 'a turn observation must carry the PAUSED verdict');
  assert.match(paused.observation, /OWNER IS CONTROLLING THE MACHINE/);
  assert.match(paused.observation, /Do NOT retry a GUI action/);
  assert.ok(s.recorded.some((e) => e.type === 'control_pause'), 'a control_pause event must be recorded');
  assert.ok(!s.recorded.some((e) => e.type === 'dedup_block'), 'no dedup_block for the control-paused turn');
});

test('CP-2: browser_open and screenshot are skipped too while controlled', async () => {
  const s = stubSession(
    [
      'I will open the dashboard.\n{"action":"browser_open","url":"https://ksuite.infomaniak.com/dashboard"}',
      'I will take a screenshot.\n{"action":"screenshot"}',
    ],
    { controlled: true },
  );
  const res = await s.run();
  assert.deepEqual(s.guiCalls, ['snapshot', 'snapshot', 'snapshot'], 'only read-only snapshots may run while controlled — the turn-start snapshot plus one heartbeat per turn');
  assert.equal(s.recorded.filter((e) => e.type === 'control_pause').length, 2);
  assert.ok(res.log.every((e) => String(e.observation || '').includes('PAUSED')));
});

test('CP-3: the same click RUNS when nobody controls the machine', async () => {
  // A snapshot turn first: the auth gate blocks a click on a page
  // never seen, so the click under test needs a real observation.
  const s = stubSession(
    [
      'I will look at the page.\n{"action":"browser_snapshot"}',
      'I will click Sign in.\n{"action":"browser_click","text":"Sign in"}',
    ],
    { controlled: false },
  );
  await s.run();
  assert.deepEqual(s.guiCalls, ['snapshot', 'snapshot', 'snapshot', 'snapshot', 'click'], 'turn-start snapshot + heartbeat, then the brain\'s own snapshot turn + heartbeat, then the click');
  assert.ok(!s.recorded.some((e) => e.type === 'control_pause'));
});

test('CP-4: non-GUI work (search) still runs while controlled', async () => {
  const s = stubSession(
    ['I will search for the login flow.\n{"action":"search","query":"infomaniak login flow"}'],
    { controlled: true },
  );
  const res = await s.run();
  assert.deepEqual(s.guiCalls, ['snapshot', 'snapshot'], 'only read-only snapshots may run while controlled — the turn-start snapshot plus the per-turn heartbeat');
  assert.ok(!s.recorded.some((e) => e.type === 'control_pause'), 'search is not a GUI action');
  const row = res.log.find((e) => e.action === 'search');
  assert.ok(row, 'the search turn must execute and log');
});

// Regression guard (fixture-pollution fix, 6 Nov 2026): if the
// DATA_DIR isolation above ever regresses, the CP wire-up tests
// write h_test_ctrl meta + episodes.db into the REAL backend/data
// tree. This test fails loudly instead of silently re-polluting it.
test('CP-ISO: no fixture writes land in the real backend/data tree', async () => {
  const { config } = await import('./config.js');
  assert.equal(config.dataDir, tmpRoot, 'DATA_DIR isolation must be active in this process');
  const realData = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  assert.equal(fs.existsSync(path.join(realData, 'hunts', 'h_test_ctrl')), false, 'real backend/data must not contain h_test_ctrl');
  assert.ok(fs.existsSync(path.join(tmpRoot, 'hunts', 'h_test_ctrl', 'meta.json')), 'wire-up writes for h_test_ctrl must land in the temp dir, not vanish');
  assert.equal(fs.existsSync(path.join(realData, 'episodes.db')), false, 'real backend/data must not contain episodes.db');
});
