// HUMAN-LOOP lab (26 Oct 2026, owner order: "test it yourself").
//
// A LIVE test of the continuous loop lane — not a unit test: the REAL
// driver (runHumanLoop) drives a REAL scratch hunt container against
// scanme.nmap.org (nmap's official scan target), on a scratch DATA_DIR,
// under a scratch hunt id. The live Infomaniak hunt and the live backend
// are never touched — but the lab's real-8B brain calls (check (c))
// QUEUE behind the live hunt's turns on the single 8B slot, so they cost
// the live hunt a few minutes of brain time (bounded: 2 cycles). Check
// the live hunt iteration before and after and report it honestly.
//
//   (a) CONTINUOUS CYCLES — the driver runs 4 cycles back-to-back in
//       ONE runHumanLoop call with a stubbed fast brain; each cycle's
//       screen must contain the previous cycle's output (the
//       observation feeds the next decision, no turn boundary).
//       Cycle wall times are measured (the fast-brain cadence).
//   (b) SENSE-ACT-OBSERVE on the REAL desktop — a driver cycle with a
//       stubbed desktop_terminal reply (echo HL-PROOF) on the real
//       container: terminal opens visibly, command typed + Return,
//       output back via the tee log, desktop screenshot artifact on
//       disk, terminal window open. Then a desktop_snapshot cycle.
//   (c) FALLBACK — the REAL callBrain with the brain selected to a
//       Meta model, metaFn mocked to fail, chatFn the REAL 8B
//       (chatWithAI → Ollama): the cycle must complete via the 8B, a
//       model_switch event must be recorded, and the loop must
//       continue to a second cycle. Cycle times are measured (the
//       slow 8B cadence, honestly).
//   (d) TAKE CONTROL — the REAL control lock is taken for the lab
//       hunt; a driver cycle with a stubbed desktop_click reply must
//       record control_pause and execute NO GUI action; the lock is
//       released and a shell cycle runs.
//   (e) LEDGER RECALL — cycle 4 of (a) repeats cycle 1's command:
//       answered from the output ledger (output_recall), 0 exec.
//   (f) STOP CLEANLY — the driver is stopped after cycle 1 via the
//       sleep hook; it returns stopped=true after 1 cycle, the
//       registry is clear, meta.loop.enabled=false.
//
// Usage (on EC2, from a copy of this branch's backend — node_modules
// symlinked from /opt/Dark-Matter/backend/node_modules):
//
//   export LLM_PROVIDER=ollama OLLAMA_MODEL=dm-hunter
//   export OLLAMA_NUM_CTX=16384 OLLAMA_TIMEOUT_MS=3600000 OLLAMA_NUM_PREDICT=300
//   export DATA_DIR=/tmp/human-loop-lab-data
//   node scripts/lab-human-loop.mjs [--keep]
//
//   --keep leaves the lab container running for inspection; otherwise
//   it is removed at the end (it holds a 4g reservation on an 8GB box
//   — never leave it running).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const HUNT_ID = 'h_lab_humanloop';
const TARGET = 'https://scanme.nmap.org';

if (!process.env.DATA_DIR) {
  console.error('DATA_DIR is required — point it at a scratch dir (e.g. /tmp/human-loop-lab-data). Refusing to run against the live data dir.');
  process.exit(2);
}
if (process.env.LLM_PROVIDER !== 'ollama') {
  console.error('LLM_PROVIDER must be ollama for this lab (llm.js defaults to bedrock, which returns null here). Export LLM_PROVIDER=ollama and re-run.');
  process.exit(2);
}

const { runHumanLoop, stopHumanLoop, isLoopRunning } = await import('../src/humanLoopDriver.js');
const { spawnHuntContainer, dockerAvailable, startHuntDesktop } = await import('../src/huntRunner.js');
const { parseScope } = await import('../src/scopeParser.js');
const { takeControl, releaseControl } = await import('../src/machineControl.js');
const { callBrain, setBrainModel } = await import('../src/brainProvider.js');
const { chatWithAI } = await import('../src/llm.js');
const { loadOutputs, outputCount } = await import('../src/outputMemory.js');
const { readHuntEvents } = await import('../src/store.js');

const log = (...a) => console.log('[lab human-loop]', ...a);

async function docker(dargs) {
  const { stdout } = await execFileAsync('docker', dargs, { timeout: 30000 });
  return stdout.trim();
}

async function ensureContainer() {
  const name = `dm-hunt-${HUNT_ID}`;
  try {
    const state = await docker(['inspect', '-f', '{{.State.Status}}', name]);
    if (state === 'running') { log(`container ${name} already running — reusing`); return name; }
    log(`container ${name} exists but is ${state} — removing and respawning`);
    await docker(['rm', '-f', name]);
  } catch { /* no container yet */ }
  log(`spawning scratch container for ${HUNT_ID} (target ${TARGET})…`);
  const spawned = await spawnHuntContainer(HUNT_ID, TARGET, { mode: 'human' });
  log(`container up: ${spawned.container} (ttyd ${spawned.ttydPort})`);
  return spawned.container;
}

// Real container exec, through docker exec (the same channel the
// production execRaw uses). The brain replies are stubbed; the
// container, desktop and screenshots are real.
function execRawReal(container) {
  return async (h, cmd, timeout) => {
    try {
      const { stdout, stderr } = await execFileAsync('docker', ['exec', container, 'bash', '-c', String(cmd)], { timeout: timeout || 15000 });
      return { stdout: String(stdout || ''), stderr: String(stderr || ''), code: 0 };
    } catch (e) {
      return { stdout: String((e && e.stdout) || ''), stderr: String((e && e.stderr) || (e && e.message) || e), code: 1 };
    }
  };
}

// A scripted fast brain: returns the replies in order and records
// every screen it was given + when, so the lab can prove each
// cycle's observation fed the next decision — and time each cycle.
function scriptedBrain(replies) {
  const screens = [];
  const at = [];
  let n = 0;
  return {
    screens,
    at,
    chat: async (messages) => {
      screens.push(messages[0].text);
      at.push(Date.now());
      return replies[n++];
    },
  };
}

const shellReply = (cmd, thinking = 'looping') => `${thinking}\n${JSON.stringify({ action: 'shell', command: cmd })}`;

const t0 = Date.now();
log(`target=${TARGET} hunt=${HUNT_ID} data=${process.env.DATA_DIR}`);

if (!(await dockerAvailable())) {
  console.error('Docker is not available on this box — cannot run the lab.');
  process.exit(1);
}
const container = await ensureContainer();
const clockOut = await docker(['exec', container, 'date']);
const clockOk = /\+0530/.test(clockOut) || /IST/.test(clockOut);
log(`container date: ${clockOut} — ${clockOk ? 'IST ✓' : 'NOT IST ✗'}`);
log('starting the desktop on the lab container…');
const desk = await startHuntDesktop(HUNT_ID).catch((e) => ({ ok: false, error: String(e.message || e) }));
log(`desktop start: ${JSON.stringify(desk)}`);

const execRaw = execRawReal(container);
const scope = parseScope(TARGET);

// ---- (a)+(e) CONTINUOUS CYCLES + LEDGER RECALL ---------------------------
// 4 cycles, one driver run, stubbed fast brain. Cycle 4 repeats
// cycle 1's command — the ledger must answer it, not re-run it.
const brainA = scriptedBrain([
  shellReply('echo loop-one', 'cycle one — first probe'),
  shellReply('echo loop-two', 'cycle two — acting on cycle one'),
  shellReply('echo loop-three', 'cycle three — acting on cycle two'),
  shellReply('echo loop-one', 'cycle four — the same command again'),
]);
const runA0 = Date.now();
const resA = await runHumanLoop(HUNT_ID, TARGET, {
  deps: { chat: brainA.chat, execRaw, assess: null },
  parsedScope: scope,
  maxCycles: 4,
  interCycleMs: 1000,
});
const runAMs = Date.now() - runA0;
const cycleTimesA = brainA.at.slice(1).map((t, i) => t - brainA.at[i]);
const chainOk = brainA.screens[1].includes('loop-one') && brainA.screens[2].includes('loop-two') && brainA.screens[3].includes('loop-three');
const eventsA = readHuntEvents(HUNT_ID) || [];
const recallsA = eventsA.filter((e) => e.type === 'output_recall');
log(`(a) CONTINUOUS: cyclesRun=${resA.cyclesRun}/4 aiOk=${resA.aiOk} runMs=${runAMs} cycleGapsMs=[${cycleTimesA.join(',')}] screens=${brainA.screens.length} chainOk=${chainOk}`);
log(`(e) LEDGER: output_recall events=${recallsA.length} (cycle 4 repeat answered from the record, not re-run)`);
if (!chainOk) log('(a) MISS: a later screen did not carry the previous cycle’s output.');
if (recallsA.length !== 1) log(`(e) MISS: expected exactly 1 output_recall, got ${recallsA.length}.`);

// ---- (b) SENSE-ACT-OBSERVE on the REAL desktop ---------------------------
const termCmd = 'echo HL-PROOF && nmap --version | head -1';
const brainB = scriptedBrain([
  `desktop check — visible run, owner watches live.\n${JSON.stringify({ action: 'desktop_terminal', command: termCmd })}`,
  `looking at the desktop now.\n${JSON.stringify({ action: 'desktop_snapshot' })}`,
]);
const resB = await runHumanLoop(HUNT_ID, TARGET, {
  deps: { chat: brainB.chat, execRaw, assess: null },
  parsedScope: scope,
  maxCycles: 2,
  interCycleMs: 1000,
});
const termSaved = (loadOutputs(HUNT_ID).entries || {})[`shell|${termCmd}`];
const termOut = termSaved ? String(termSaved.output || '') : '';
const termOk = termOut.includes('HL-PROOF') && termOut.includes('Exit code 0');
const shotName = (/desktop-[0-9]+\.jpg/.exec(termOut) || [])[0] || '';
const shotExists = shotName
  ? fs.existsSync(path.join(process.env.DATA_DIR, 'hunts', HUNT_ID, 'artifacts', shotName))
  : false;
const termWin = await docker(['exec', container, 'env', 'DISPLAY=:99', 'xdotool', 'search', '--onlyvisible', '--class', 'xfce4-terminal']).catch(() => '');
log(`(b) DESKTOP: cyclesRun=${resB.cyclesRun}/2 aiOk=${resB.aiOk} output-back=${termOk} screenshot=${shotName || '(none)'} artifact-on-disk=${shotExists} terminal-window-open=${String(termWin).trim().length > 0}`);
if (!termOk) log('(b) MISS: the typed command output did not come back.');

// ---- (c) FALLBACK — real callBrain, Meta mocked silent, real 8B ----------
// A fake key so setBrainModel accepts Meta; the mocked metaFn means
// no real Meta call is ever made and no credits burn. The 8B answer
// comes from the REAL Ollama on this box (chatWithAI) — slow, queued
// behind the live hunt, timed honestly.
process.env.META_API_KEY = 'lab-fake-key-not-real';
const selC = setBrainModel(HUNT_ID, 'muse-spark-1.3', {});
log(`(c) brain selected: ${JSON.stringify(selC.ok ? selC.brain.selected : selC.error)}`);
const brainCAt = [];
const chatC = async (messages, system, ctx) => {
  brainCAt.push(Date.now());
  return callBrain(messages, system, ctx, {
    huntId: HUNT_ID,
    metaFn: async () => ({ ok: false, reason: 'timeout' }),
    chatFn: (m, s, c) => chatWithAI(m, s, c),
  });
};
const runC0 = Date.now();
const resC = await runHumanLoop(HUNT_ID, TARGET, {
  deps: { chat: chatC, execRaw, assess: null },
  parsedScope: scope,
  maxCycles: 2,
  interCycleMs: 1000,
});
const runCMs = Date.now() - runC0;
const cycleTimesC = brainCAt.slice(1).map((t, i) => t - brainCAt[i]);
const eventsC = readHuntEvents(HUNT_ID) || [];
const switchesC = eventsC.filter((e) => e.type === 'model_switch' && e.reason === 'timeout');
log(`(c) FALLBACK: cyclesRun=${resC.cyclesRun}/2 aiOk=${resC.aiOk} runMs=${runCMs} cycleGapsMs=[${cycleTimesC.join(',')}] model_switch(timeout)=${switchesC.length}`);
if (resC.cyclesRun !== 2 || switchesC.length !== 1) log('(c) MISS: the loop did not continue through the fallback, or the switch was not recorded once.');
// The brain stays in fallback after the lab — leave the lab hunt's
// brain state as the fallback left it (a scratch hunt, never live).

// ---- (d) TAKE CONTROL — the REAL lock ------------------------------------
const took = takeControl(HUNT_ID, { id: 'lab-owner', username: 'lab-owner', role: 'admin' });
log(`(d) control lock taken: ${JSON.stringify(took.ok)}`);
const brainD = scriptedBrain([
  'I will click Sign in.\n{"action":"desktop_click","text":"Sign in"}',
  shellReply('echo after-control', 'working without the desktop'),
]);
const guiCallsD = [];
const execRawD = async (h, cmd, timeout) => {
  guiCallsD.push(String(cmd || ''));
  return execRaw(h, cmd, timeout);
};
const resD = await runHumanLoop(HUNT_ID, TARGET, {
  deps: { chat: brainD.chat, execRaw: execRawD, assess: null },
  parsedScope: scope,
  maxCycles: 2,
  interCycleMs: 1000,
});
const eventsD = readHuntEvents(HUNT_ID) || [];
const pausesD = eventsD.filter((e) => e.type === 'control_pause');
const clickRan = guiCallsD.some((c) => c.includes('xdotool') && /click|windowactivate/.test(c) && !c.includes('search'));
const released = releaseControl(HUNT_ID, { id: 'lab-owner', username: 'lab-owner', role: 'admin' });
log(`(d) CONTROL: cyclesRun=${resD.cyclesRun}/2 aiOk=${resD.aiOk} control_pause=${pausesD.length} gui-click-executed=${clickRan} lock-released=${released.ok}`);
if (pausesD.length !== 1 || clickRan) log('(d) MISS: the GUI action was not paused cleanly.');

// ---- (f) STOP CLEANLY ------------------------------------------------------
const registryF = new Map();
let stoppedF = false;
const brainF = scriptedBrain([
  shellReply('echo stop-one'),
  shellReply('echo stop-two'),
  shellReply('echo stop-three'),
]);
const resF = await runHumanLoop(HUNT_ID, TARGET, {
  deps: { chat: brainF.chat, execRaw, assess: null },
  parsedScope: scope,
  maxCycles: 5,
  interCycleMs: 100,
  registry: registryF,
  sleep: async (ms) => {
    if (!stoppedF) {
      stoppedF = true;
      stopHumanLoop(HUNT_ID, { registry: registryF });
    }
  },
});
log(`(f) STOP: cyclesRun=${resF.cyclesRun} stopped=${resF.stopped} aiOk=${resF.aiOk} registry-clear=${!isLoopRunning(HUNT_ID, { registry: registryF })}`);
if (resF.cyclesRun !== 1 || !resF.stopped) log('(f) MISS: the loop did not stop cleanly after cycle 1.');

// ---- REPORT -----------------------------------------------------------------
const outputs = loadOutputs(HUNT_ID);
const events = readHuntEvents(HUNT_ID) || [];
const loops = events.filter((e) => e.type === 'status' && String(e.state || '').startsWith('loop_'));
log('— REPORT —');
log(`outputs saved: ${outputCount(outputs)}`);
log(`loop status events: ${loops.map((e) => e.state).join(', ')}`);
log(`tool_call events: ${events.filter((e) => e.type === 'tool_call').length} — ${events.filter((e) => e.type === 'tool_call').map((e) => `${e.tool}:${String(e.detail || '').slice(0, 50)}`).join(' | ')}`);
log(`total lab time: ${Math.round((Date.now() - t0) / 1000)}s`);

if (!KEEP) {
  try { await docker(['rm', '-f', container]); log(`lab container ${container} removed`); } catch (e) { log(`container removal failed (leave it — it holds 4g): ${e.message}`); }
}

const verdict = {
  a_cycles: resA.cyclesRun === 4 && chainOk,
  b_desktop: termOk && shotExists && String(termWin).trim().length > 0,
  c_fallback: resC.cyclesRun === 2 && switchesC.length === 1,
  d_control: pausesD.length === 1 && !clickRan,
  e_recall: recallsA.length === 1,
  f_stop: resF.cyclesRun === 1 && resF.stopped,
};
log(`verdict: clock IST=${clockOk} | (a) continuous=${verdict.a_cycles} fast-cycle-gaps-ms=[${cycleTimesA.join(',')}] | (b) desktop=${verdict.b_desktop} | (c) fallback=${verdict.c_fallback} slow-cycle-gaps-ms=[${cycleTimesC.join(',')}] runMs=${runCMs} | (d) control=${verdict.d_control} | (e) recall=${verdict.e_recall} | (f) stop=${verdict.f_stop}`);
const failed = Object.entries(verdict).filter(([, v]) => !v).map(([k]) => k);
if (failed.length) { log(`MISSES: ${failed.join(', ')} — see above, reported honestly.`); process.exit(1); }
log('ALL LAB CHECKS PASSED');
