// CONTINUOUS HUMAN-BRAIN LOOP driver tests (26 Oct 2026, owner order:
// infinity-level agent — the brain works the way a human brain works,
// continuously, not in turns).
//
//   LOOP-1  N cycles run back-to-back in ONE driver run, no turn
//           boundary — each cycle's observation feeds the next
//           cycle's screen (via the persisted leftOff hand-off).
//   LOOP-2  one brain call at a time — never concurrent, even with
//           a slow brain.
//   LOOP-3  a silent Meta trips the automatic fallback to the 8B
//           (model_switch event) and the loop continues.
//   LOOP-4  Take Control pauses the loop's GUI actions (control_pause,
//           no GUI exec) while non-GUI work keeps running.
//   LOOP-5  a repeated action is answered from the output ledger,
//           not re-run (0 exec calls on the repeat).
//   LOOP-6  the loop stops cleanly per hunt — owner stop (6a), hunt
//           paused mid-run (6b), and a stop issued DURING a cycle
//           sticks in meta (6c).
//   LOOP-7  a silent brain (both paths) backs off and retries; 5
//           consecutive failures end the run with the streak.
//   LOOP-8  the loop flag (default on, per-hunt off) and the
//           duplicate-start refusal (never stacked).
//   LOOP-9  per-cycle loop state lands in meta.loop (cycles count,
//           lastCycleAt) and run start/stop are recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoopDriver (via humanLoop/store)
// is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-loop-'));
process.env.DATA_DIR = tmpRoot;
// LOOP-3 only: a fake key so setBrainModel accepts a Meta brain.
// No real Meta call is ever made (metaFn is mocked in the test).
process.env.META_API_KEY = 'test-key-not-real';

const {
  runHumanLoop,
  stopHumanLoop,
  loopEnabledFor,
  isLoopRunning,
} = await import('./humanLoopDriver.js');
const { callBrain, setBrainModel } = await import('./brainProvider.js');

const TARGET = 'https://scanme.nmap.org';
const SNAP = { url: TARGET, title: 'scanme', text: 'scanme', elements: [] };

const shellReply = (cmd, thinking = 'doing it') => `${thinking}\n${JSON.stringify({ action: 'shell', command: cmd })}`;

// A stubbed hunt: in-memory meta shared across the run's cycles,
// stubbed brain + container + recorders. `onSleep` fires on every
// driver sleep (inter-cycle / backoff) — LOOP-6 stops the loop there.
function stubRun(huntId, replies, opts = {}) {
  let meta = opts.meta || {};
  const recorded = [];
  const screens = [];
  const sleeps = [];
  const execCalls = [];
  const guiCalls = [];
  let n = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  const controlled = opts.controlled || false;
  const registry = new Map();
  const chatImpl = opts.chatImpl || (async (messages) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    try {
      if (opts.chatDelayMs) await new Promise((r) => setTimeout(r, opts.chatDelayMs));
      screens.push(messages[0].text);
      return replies[n++];
    } finally {
      concurrent--;
    }
  });
  const chat = opts.chatOverride
    ? async (...a) => { screens.push(a[0][0].text); return opts.chatOverride(...a); }
    : chatImpl;
  const api = {
    recorded, screens, sleeps, execCalls, guiCalls, registry,
    meta: () => meta,
    setMeta: (m) => { meta = m; },
    get maxConcurrent() { return maxConcurrent; },
    run: (runOpts = {}) => runHumanLoop(huntId, TARGET, {
      deps: {
        chat,
        gui: {
          open: async () => { guiCalls.push('open'); return { observation: 'opened', snapshot: SNAP }; },
          snapshot: async () => { guiCalls.push('snapshot'); return { observation: `Page: ${TARGET}`, snapshot: SNAP }; },
          click: async () => { guiCalls.push('click'); return { ok: true, observation: 'clicked', snapshot: SNAP }; },
          type: async () => { guiCalls.push('type'); return { ok: true, observation: 'Typed.', snapshot: SNAP }; },
          screenshot: async () => { guiCalls.push('screenshot'); return { observation: 'shot', snapshot: SNAP }; },
        },
        execRaw: async (h, cmd) => { execCalls.push(['raw', String(cmd)]); return { stdout: '', stderr: '' }; },
        exec: async (h, t, cmd) => {
          // Shell dispatch calls exec(huntId, target, command).
          execCalls.push(['exec', String(cmd)]);
          const m = /^echo (\S+)/.exec(String(cmd || '').trim());
          return { stdout: m ? `${m[1]}\n` : '', stderr: '', code: 0 };
        },
        search: async () => 'no results',
        writeFile: async () => ({ ok: true }),
        spill: () => '',
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => meta,
        writeMeta: (h, patch) => { meta = { ...meta, ...patch }; },
        readEvents: () => recorded,
        buildBriefing: async () => '',
        machineControlled: () => controlled,
        desktopScreenshot: async () => ({ ok: true, name: 'desktop-x.jpg' }),
        startDesktop: async () => {},
        assess: null,
      },
      readMeta: () => meta,
      writeMeta: (h, patch) => { meta = { ...meta, ...patch }; },
      record: (h, e) => { recorded.push(e); },
      sleep: async (ms) => { sleeps.push(ms); if (opts.onSleep) await opts.onSleep(ms, api); },
      now: () => Date.now(),
      registry,
      maxCycles: opts.maxCycles ?? 3,
      interCycleMs: opts.interCycleMs ?? 0,
      noReplyBackoffMs: opts.noReplyBackoffMs ?? 0,
      ...runOpts,
    }),
  };
  return api;
}

// --- Chaining + cadence ----------------------------------------------------

test('LOOP-1: N cycles back-to-back in one run, each observation feeding the next screen', async () => {
  const s = stubRun('h_loop_1', [
    shellReply('echo alpha-one', 'first move'),
    shellReply('echo beta-two', 'second move'),
    shellReply('echo gamma-three', 'third move'),
  ]);
  const res = await s.run();
  assert.equal(res.cyclesRun, 3, 'three cycles in one driver run');
  assert.equal(res.aiOk, true);
  assert.equal(res.stopped, false);
  assert.equal(s.screens.length, 3, 'one brain call per cycle, no extra calls');
  assert.ok(s.screens[1].includes('alpha-one'), 'cycle 2 decides against cycle 1’s output (leftOff hand-off)');
  assert.ok(s.screens[2].includes('beta-two'), 'cycle 3 decides against cycle 2’s output');
  assert.notEqual(s.screens[0], s.screens[1], 'each screen is rebuilt from the fresh record — no frozen prompt');
  assert.equal(s.execCalls.filter(([k]) => k === 'exec').length, 3, 'each cycle executed its action');
});

test('LOOP-2: one brain call at a time, never concurrent', async () => {
  const s = stubRun('h_loop_2', [
    shellReply('echo one'),
    shellReply('echo two'),
    shellReply('echo three'),
    shellReply('echo four'),
  ], { chatDelayMs: 10, maxCycles: 4 });
  const res = await s.run();
  assert.equal(res.cyclesRun, 4);
  assert.equal(s.maxConcurrent, 1, 'the driver awaits each brain call before the next — no stacking');
});

test('LOOP-1b: the driver stops after maxCycles and paces between cycles', async () => {
  const s = stubRun('h_loop_1b', [
    shellReply('echo a'),
    shellReply('echo b'),
    shellReply('echo c'),
    shellReply('echo d'),
  ], { maxCycles: 3, interCycleMs: 2000 });
  const res = await s.run();
  assert.equal(res.cyclesRun, 3, 'maxCycles bounds the run');
  assert.deepEqual(s.sleeps, [2000, 2000], 'one inter-cycle pause between cycles, none after the last');
});

// --- Fallback + gates ------------------------------------------------------

test('LOOP-3: a silent Meta trips the automatic fallback to the 8B and the loop continues', async () => {
  const huntId = 'h_loop_3';
  let metaCalls = 0;
  let chatCalls = 0;
  const s = stubRun(huntId, [], {
    maxCycles: 2,
    chatOverride: (messages, system, ctx) => callBrain(messages, system, ctx, {
      huntId,
      readMeta: () => s.meta(),
      writeMeta: (h, p) => s.setMeta({ ...s.meta(), ...p }),
      record: (h, e) => s.recorded.push(e),
      metaFn: async () => { metaCalls++; return { ok: false, reason: 'timeout' }; },
      chatFn: async () => {
        chatCalls++;
        return `thinking via the 8B fallback\n${JSON.stringify({ action: 'shell', command: `echo fallback-${chatCalls}` })}`;
      },
    }),
  });
  // Select Meta as the brain, in the stubbed meta.
  const sel = setBrainModel(huntId, 'muse-spark-1.3', {
    readMeta: () => s.meta(),
    writeMeta: (h, p) => s.setMeta({ ...s.meta(), ...p }),
    record: (h, e) => s.recorded.push(e),
  });
  assert.equal(sel.ok, true, 'Meta brain selectable with the test key configured');
  const res = await s.run();
  assert.equal(res.aiOk, true, 'the run succeeds — the fallback answers every cycle');
  assert.equal(res.cyclesRun, 2, 'the loop continues past the silent Meta');
  assert.equal(metaCalls, 2, 'Meta was attempted each cycle');
  assert.equal(chatCalls, 2, 'the 8B answered each cycle');
  const switches = s.recorded.filter((e) => e.type === 'model_switch' && e.reason === 'timeout');
  assert.equal(switches.length, 1, 'one fallback model_switch event — the transition, not one per cycle');
  assert.equal(switches[0].to, 'darkmatter-v1');
  const execs = s.execCalls.filter(([k]) => k === 'exec').map(([, c]) => c);
  assert.deepEqual(execs, ['echo fallback-1', 'echo fallback-2'], 'the 8B’s actions executed');
});

test('LOOP-4: Take Control pauses the loop’s GUI actions, non-GUI work continues', async () => {
  const s = stubRun('h_loop_4', [
    'I will click Sign in.\n{"action":"desktop_click","text":"Sign in"}',
    shellReply('echo after-control', 'working without the desktop'),
  ], { controlled: true, maxCycles: 2 });
  const res = await s.run();
  assert.equal(res.cyclesRun, 2, 'the loop continues past the paused GUI turn');
  assert.equal(res.aiOk, true);
  assert.deepEqual(s.guiCalls, ['snapshot', 'snapshot'], 'only the read-only turn-start snapshots ran — the click never executed');
  assert.equal(s.recorded.filter((e) => e.type === 'control_pause').length, 1);
  assert.ok(s.recorded.some((e) => e.type === 'control_pause' && e.tool === 'desktop_click'));
  const execs = s.execCalls.filter(([k]) => k === 'exec').map(([, c]) => c);
  assert.deepEqual(execs, ['echo after-control'], 'the shell turn still ran while controlled');
});

test('LOOP-5: a repeated action is answered from the output ledger, not re-run', async () => {
  const s = stubRun('h_loop_5', [
    shellReply('echo recall-me', 'first run'),
    shellReply('echo recall-me', 'same command again'),
  ], { maxCycles: 2 });
  const res = await s.run();
  assert.equal(res.cyclesRun, 2);
  assert.equal(res.aiOk, true);
  const execs = s.execCalls.filter(([k]) => k === 'exec');
  assert.equal(execs.length, 1, 'the command executed once — the repeat was recalled');
  assert.ok(s.recorded.some((e) => e.type === 'output_recall'), 'an output_recall event marks the answered repeat');
  const second = res.log[1];
  assert.ok(String(second && second.observation).includes('recall-me'), 'the repeat’s observation carries the saved output');
});

// --- Stop + failure ---------------------------------------------------------

test('LOOP-6a: the loop stops cleanly on the owner’s stop, mid-run', async () => {
  let stopped = false;
  const s = stubRun('h_loop_6a', [
    shellReply('echo one'),
    shellReply('echo two'),
    shellReply('echo three'),
  ], {
    maxCycles: 5,
    interCycleMs: 100,
    onSleep: async () => {
      if (!stopped) {
        stopped = true;
        stopHumanLoop('h_loop_6a', { registry: s.registry, readMeta: () => s.meta(), writeMeta: (h, p) => s.setMeta({ ...s.meta(), ...p }), record: (h, e) => s.recorded.push(e) });
      }
    },
  });
  const res = await s.run();
  assert.equal(res.cyclesRun, 1, 'the current cycle finished, then the loop stopped — no further cycles');
  assert.equal(res.stopped, true);
  assert.equal(res.aiOk, true, 'a clean stop is not a failure');
  assert.equal(isLoopRunning('h_loop_6a', { registry: s.registry }), false, 'the registry is cleared on exit');
  assert.equal(s.meta().loop.enabled, false, 'the stop persists in meta');
  assert.ok(s.recorded.some((e) => e.type === 'status' && e.state === 'loop_stopped'), 'the stop is recorded');
});

test('LOOP-6b: the loop stops cleanly when the hunt is paused mid-run', async () => {
  let paused = false;
  const s = stubRun('h_loop_6b', [
    shellReply('echo one'),
    shellReply('echo two'),
  ], {
    maxCycles: 5,
    interCycleMs: 100,
    onSleep: async () => {
      if (!paused) { paused = true; s.setMeta({ ...s.meta(), paused: true, state: 'paused' }); }
    },
  });
  const res = await s.run();
  assert.equal(res.cyclesRun, 1);
  assert.equal(res.stopped, true);
  assert.equal(res.aiOk, true);
});

test('LOOP-6c: a stop issued DURING a cycle sticks — the loop does not restart on the next run', async () => {
  // Review fix, 26 Oct 2026: the per-cycle save used to force
  // enabled:true, overwriting a mid-cycle stop — the run stopped,
  // but meta.loop.enabled came back true and the next outer
  // iteration restarted the loop. The save no longer forces
  // enabled, so the stop must survive the cycle's own save.
  let stopped = false;
  const reply = shellReply('echo one');
  const s = stubRun('h_loop_6c', [reply], {
    maxCycles: 3,
    chatImpl: async (messages) => {
      s.screens.push(messages[0].text);
      if (!stopped) {
        stopped = true;
        stopHumanLoop('h_loop_6c', { registry: s.registry, readMeta: () => s.meta(), writeMeta: (h, p) => s.setMeta({ ...s.meta(), ...p }), record: (h, e) => s.recorded.push(e) });
      }
      return reply;
    },
  });
  const res = await s.run();
  assert.equal(res.cyclesRun, 1, 'the current cycle finished, then the loop stopped — no further cycles');
  assert.equal(res.stopped, true);
  assert.equal(res.aiOk, true, 'a clean stop is not a failure');
  assert.equal(s.meta().loop.enabled, false, 'the mid-cycle stop sticks in meta — the next run must not restart the loop');
  assert.equal(loopEnabledFor('h_loop_6c', s.meta()), false);
  assert.equal(isLoopRunning('h_loop_6c', { registry: s.registry }), false, 'the registry is cleared on exit');
});

test('LOOP-7: a silent brain backs off and retries; 5 consecutive failures end the run with the streak', async () => {
  const s = stubRun('h_loop_7', [null, null, null, null, null, null], {
    maxCycles: 6,
    interCycleMs: 0,
    noReplyBackoffMs: 5000,
  });
  const res = await s.run();
  assert.equal(res.aiOk, false, 'a dead brain fails the run');
  assert.equal(res.failKind, 'no_reply');
  assert.equal(res.failStreak, 5, 'the streak is returned so the outer breaker trips after 5 failed calls');
  assert.equal(res.cyclesRun, 5, 'the run ends at the 5th failure — no 6th cycle');
  assert.equal(s.screens.length, 5, 'the brain was asked exactly 5 times');
  assert.deepEqual(s.sleeps, [5000, 5000, 5000, 5000], 'backoff between failed cycles, none after the last');
});

// --- Flag + registry ---------------------------------------------------------

test('LOOP-8: the loop flag defaults on, turns off per hunt; a duplicate start is refused, never stacked', async () => {
  assert.equal(loopEnabledFor('h_loop_8', {}), true, 'default on');
  assert.equal(loopEnabledFor('h_loop_8', { loop: { enabled: false } }), false, 'off when the hunt disabled it');
  assert.equal(loopEnabledFor('h_loop_8', { loop: { enabled: true } }), true);

  let release;
  const gate = new Promise((r) => { release = r; });
  const gatedReply = shellReply('echo gated');
  const s = stubRun('h_loop_8', [gatedReply], {
    maxCycles: 1,
    chatImpl: async (messages) => { s.screens.push(messages[0].text); await gate; return gatedReply; },
  });
  // Drive the first run into its brain call, then try a second start.
  const p1 = s.run();
  await new Promise((r) => setImmediate(r));
  assert.equal(isLoopRunning('h_loop_8', { registry: s.registry }), true);
  const dup = await runHumanLoop('h_loop_8', TARGET, { deps: {}, registry: s.registry, readMeta: () => s.meta(), record: (h, e) => s.recorded.push(e) });
  assert.equal(dup.duplicate, true, 'the second start is refused');
  assert.equal(dup.aiOk, true, 'a refused duplicate never trips the circuit breaker');
  assert.equal(dup.cyclesRun, 0);
  release();
  const res = await p1;
  assert.equal(res.cyclesRun, 1, 'the first run still completed its cycle');
  assert.equal(isLoopRunning('h_loop_8', { registry: s.registry }), false);
});

// --- State -------------------------------------------------------------------

test('LOOP-9: per-cycle loop state lands in meta.loop and run start/stop are recorded', async () => {
  const s = stubRun('h_loop_9', [
    shellReply('echo one'),
    shellReply('echo two'),
    shellReply('echo three'),
  ], { maxCycles: 3 });
  const res = await s.run();
  assert.equal(res.cyclesRun, 3);
  assert.equal(s.meta().loop.cycles, 3, 'cycles accumulate in meta.loop');
  assert.ok(s.meta().loop.lastCycleAt, 'lastCycleAt is set');
  assert.ok(s.recorded.some((e) => e.type === 'status' && e.state === 'loop_started'), 'loop_started recorded');
  assert.ok(s.recorded.some((e) => e.type === 'status' && e.state === 'loop_stopped' && e.reason === 'run_complete'), 'loop_stopped recorded on clean completion');
});
