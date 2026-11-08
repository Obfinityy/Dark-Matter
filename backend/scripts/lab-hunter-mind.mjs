// HUNTER-MIND lab (26 Oct 2026, owner order: "test it yourself").
//
// A LIVE test of the lane — not a unit test: the REAL brain
// (Ollama dm-hunter on the EC2 host, http://localhost:11434) drives a
// REAL scratch hunt container against scanme.nmap.org (nmap's official
// scan target), on a scratch DATA_DIR, under a scratch hunt id. The
// live Infomaniak hunt and the live backend are never touched — but
// the lab brain calls QUEUE behind the live hunt's turns on the single
// 8B slot, so a lab session costs the live hunt a few minutes of
// brain time (bounded: --turns × ~1–3 min each). Check the live hunt
// iteration before and after and report it honestly.
//
//   Session 3 (human-brain, 26 Oct 2026): the three HUMAN-BRAIN
//     requirements, one session:
//     (a) GUI-VISIBLE TERMINAL — the loop's desktop_terminal action
//         is driven with a stubbed brain reply but REAL container
//         exec/screenshot/desktop-start: xfce4-terminal must open
//         visibly, the command must be typed + Return, the output
//         must come back via the tee log, and a desktop screenshot
//         artifact must exist. (The free brain turns may also choose
//         desktop_terminal — bonus, not required.)
//     (b) PER-HUNT ISOLATION — a global learning recorded for
//         target A (endpoint + payload) must NOT appear in target
//         B's briefing, and MUST appear in target A's briefing.
//     (c) NO PREDEFINED SEQUENCE — a BLANK hunt on a second target
//         (https://example.com, fresh hunt id) runs 2 real brain
//         turns; its first move is compared with scanme session 1's
//         first move (nmap) and the primed scanme session 2 first
//         move (write install_ssh.sh). Different first moves by
//         target/memory = the proof; identical first moves are
//         reported honestly as a miss.
//
//   node scripts/lab-hunter-mind.mjs --session 3 [--turns 2]
//   # --target/--hunt select the session-3 second target/hunt;
//   # defaults: https://example.com / h_lab_humanbrain_b.
//
//   The TZ check runs first: a scratch container is spawned through
//   the new spawn path and `date` inside it must show IST (+0530).
//
// Usage (on EC2, from a copy of this branch's backend — see the
// runbook in the lane report; node_modules symlinked from
// /opt/Dark-Matter/backend/node_modules):
//
//   export OLLAMA_MODEL=dm-hunter        # as in /opt/Dark-Matter/backend/.env
//   export LLM_PROVIDER=ollama           # REQUIRED: llm.js defaults to
//                                        # bedrock — without this the brain
//                                        # call returns null in seconds
//   export OLLAMA_NUM_CTX=16384 OLLAMA_TIMEOUT_MS=3600000 OLLAMA_NUM_PREDICT=300
//                                        # same as the live backend .env
//   export DATA_DIR=/tmp/hunter-mind-lab-data
//   node scripts/lab-hunter-mind.mjs --session 1 [--turns 3]
//   node scripts/lab-hunter-mind.mjs --session 2 [--turns 3]
//   # --keep leaves the lab container running for inspection;
//   # otherwise it is removed at the end (it holds a 4g reservation
//   # on an 8GB box — never leave it running).
//
//   The brain slot is single: while the live Infomaniak hunt is
//   mid-turn, a lab brain call QUEUES behind it (Ollama holds the
//   request, it does not fail it) — and the server itself dies to
//   OOM every ~11 min while the live hunt runs (NUM_CTX 16384 in
//   the live backend .env: the live hunt's huge prompts grow the KV
//   cache to ~6.7GB and the kernel kills llama-server; dmesg-proven
//   26 Oct 11:26/11:39/11:50Z). A session attempt can die mid-way
//   (socket hang up / no_reply) — the script RETRIES the whole
//   session (up to 8 attempts, 30s apart) until all TURNS ran, and
//   each attempt CONTINUES from the saved plan/outputs instead of
//   restarting. Each lab turn holds the slot only ~1–5 min (small
//   prompt); the live hunt's queued call simply waits.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SESSION = Number(arg('--session', '1'));
const TURNS = Number(arg('--turns', '3'));
const TARGET = arg('--target', 'https://scanme.nmap.org');
const HUNT_ID = arg('--hunt', 'h_lab_huntermind');
const KEEP = args.includes('--keep');
// Session 3's second target/hunt (the blank-hunt comparison).
const TARGET_B = arg('--target2', 'https://example.com');
const HUNT_B = arg('--hunt2', 'h_lab_humanbrain_b');

if (!process.env.DATA_DIR) {
  console.error('DATA_DIR is required — point it at a scratch dir (e.g. /tmp/hunter-mind-lab-data). Refusing to run against the live data dir.');
  process.exit(2);
}
if (process.env.LLM_PROVIDER !== 'ollama') {
  console.error('LLM_PROVIDER must be ollama for this lab (llm.js defaults to bedrock, which returns null here). Export LLM_PROVIDER=ollama and re-run.');
  process.exit(2);
}

const { humanIteration, buildMemoryBriefing } = await import('../src/humanLoop.js');
const { spawnHuntContainer, dockerAvailable, startHuntDesktop } = await import('../src/huntRunner.js');
const { parseScope } = await import('../src/scopeParser.js');
const { loadHuntPlan } = await import('../src/huntPlan.js');
const { loadOutputs, outputCount } = await import('../src/outputMemory.js');
const { readHuntEvents } = await import('../src/store.js');
const { getAllReasoning } = await import('../src/reasoningMemory.js');
const { recordGlobalLearning } = await import('../src/globalMemory.js');

const log = (...a) => console.log(`[lab s${SESSION}]`, ...a);

async function docker(args) {
  const { stdout } = await execFileAsync('docker', args, { timeout: 30000 });
  return stdout.trim();
}

async function ensureContainer(huntId = HUNT_ID, target = TARGET) {
  const name = `dm-hunt-${String(huntId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
  try {
    const state = await docker(['inspect', '-f', '{{.State.Status}}', name]);
    if (state === 'running') { log(`container ${name} already running — reusing`); return name; }
    log(`container ${name} exists but is ${state} — removing and respawning`);
    await docker(['rm', '-f', name]);
  } catch { /* no container yet */ }
  log(`spawning scratch container for ${huntId} (target ${target})…`);
  const spawned = await spawnHuntContainer(huntId, target, { mode: 'human' });
  log(`container up: ${spawned.container} (ttyd ${spawned.ttydPort})`);
  return spawned.container;
}

async function checkContainerClock(name) {
  // TZ check: `date` inside the container must show IST (+0530),
  // not UTC. The host clock is UTC; the DISPLAY must be IST.
  const out = await docker(['exec', name, 'date']);
  const ist = /\+0530/.test(out) || /IST/.test(out);
  log(`container date: ${out} — ${ist ? 'IST ✓' : 'NOT IST ✗ (timing fix did not take effect)'}`);
  return ist;
}

function report() {
  const plan = loadHuntPlan(HUNT_ID);
  const outputs = loadOutputs(HUNT_ID);
  const events = readHuntEvents(HUNT_ID) || [];
  const rows = getAllReasoning(HUNT_ID) || [];
  log('— REPORT —');
  log(`plan: ${plan.steps.length} step(s)${plan.steps.length ? '' : ' (NO PLAN — the brain never wrote one)'}`);
  for (const s of plan.steps) log(`  [${s.status === 'done' ? 'x' : s.status === 'skipped' ? '-' : ' '}] ${s.id} ${s.text}${s.evidence ? ` — ${s.evidence}` : ''}`);
  log(`outputs saved: ${outputCount(outputs)}`);
  for (const e of Object.values(outputs.entries || {})) log(`  ${e.signature} — runs ${e.runs}${e.forced ? ' (forced)' : ''} at ${e.at}`);
  const toolCalls = events.filter((e) => e.type === 'tool_call');
  const recalls = events.filter((e) => e.type === 'output_recall');
  log(`tool_call events this session: ${toolCalls.length} — ${toolCalls.map((e) => `${e.tool}:${String(e.detail || '').slice(0, 60)}`).join(' | ') || '(none)'}`);
  log(`output_recall events: ${recalls.length} — ${recalls.map((e) => `${e.tool}:${String(e.detail || '').slice(0, 60)}`).join(' | ') || '(none)'}`);
  const thinkings = rows.slice(-TURNS).map((r) => r.thinking).filter(Boolean);
  log(`narration (the brain's own thinking, last ${thinkings.length} turn(s)):`);
  for (const t of thinkings) log(`  “${String(t).slice(0, 300)}”`);
  return { plan, outputs, toolCalls, recalls };
}

const t0 = Date.now();
log(`target=${TARGET} hunt=${HUNT_ID} turns=${TURNS} data=${process.env.DATA_DIR}`);

if (!(await dockerAvailable())) {
  console.error('Docker is not available on this box — cannot run the lab.');
  process.exit(1);
}
const container = await ensureContainer();
const clockOk = await checkContainerClock(container);
const MAX_ATTEMPTS = 8;

if (SESSION === 3) {
  // ---- HUMAN-BRAIN session: terminal + isolation + no-sequence ----
  // (0) Desktop up on the lab container (the terminal check needs :99).
  log('starting the desktop on the lab container…');
  const desk = await startHuntDesktop(HUNT_ID).catch((e) => ({ ok: false, error: String(e.message || e) }));
  log(`desktop start: ${JSON.stringify(desk)}`);
  const winCheck = await docker(['exec', container, 'env', 'DISPLAY=:99', 'xdotool', 'search', '--onlyvisible', '--name', '.*']).catch(() => '');
  log(`desktop windows reachable: ${String(winCheck).trim().split('\n').filter(Boolean).length} id(s)`);

  // (a) GUI-VISIBLE TERMINAL: the REAL loop dispatch (real container
  // exec, real screenshot, real desktop-start) with only the brain's
  // reply stubbed — the composition is what is under test.
  const termCmd = 'echo DT-PROOF && nmap --version | head -1';
  const execRawReal = async (h, cmd, timeout) => {
    try {
      const { stdout, stderr } = await execFileAsync('docker', ['exec', container, 'bash', '-c', String(cmd)], { timeout: timeout || 15000 });
      return { stdout: String(stdout || ''), stderr: String(stderr || ''), code: 0 };
    } catch (e) {
      return { stdout: String((e && e.stdout) || ''), stderr: String((e && e.stderr) || (e && e.message) || e), code: 1 };
    }
  };
  const termRes = await humanIteration(HUNT_ID, TARGET, {
    turns: 1,
    parsedScope: parseScope(TARGET),
    deps: {
      chat: async () => `terminal check — visible run, owner watches live.\n${JSON.stringify({ action: 'desktop_terminal', command: termCmd })}`,
      execRaw: execRawReal,
    },
  });
  log(`terminal turn: turnsRun=${termRes.turnsRun} actionsRun=${termRes.actionsRun} aiOk=${termRes.aiOk}`);
  const termSaved = (loadOutputs(HUNT_ID).entries || {})[`shell|${termCmd}`];
  const termOut = termSaved ? String(termSaved.output || '') : '';
  const termOk = termOut.includes('DT-PROOF') && termOut.includes('Exit code 0');
  const shotName = (/desktop-[0-9]+\.jpg/.exec(termOut) || [])[0] || '';
  const shotExists = shotName
    ? fs.existsSync(path.join(process.env.DATA_DIR, 'hunts', HUNT_ID, 'artifacts', shotName))
    : false;
  const termWin = await docker(['exec', container, 'env', 'DISPLAY=:99', 'xdotool', 'search', '--onlyvisible', '--class', 'xfce4-terminal']).catch(() => '');
  log(`(a) TERMINAL: output-back=${termOk} screenshot=${shotName || '(none)'} artifact-on-disk=${shotExists} terminal-window-open=${String(termWin).trim().length > 0}`);
  if (!termOk) log('(a) TERMINAL MISS: the typed command output did not come back — see the ledger/observation above.');

  // (b) PER-HUNT ISOLATION: record an A-target learning with endpoint
  // detail, then read B's and A's briefings.
  recordGlobalLearning({
    type: 'technique', technique: 'sqli', target: TARGET,
    appType: 'web', techStack: [], success: true,
    payload: "admin' OR 1=1--",
    context: 'POST /rest/user/login (scanme)',
    note: 'SQLi bypass worked on the scanme login.',
  });
  const briefB = buildMemoryBriefing(HUNT_B, TARGET_B, {});
  const briefA = buildMemoryBriefing(HUNT_ID, TARGET, {});
  const leakMarkers = ['scanme', '/rest/user/login', 'OR 1=1'];
  const leakB = leakMarkers.filter((m) => briefB.includes(m));
  const shownA = briefA.includes('/rest/user/login');
  log(`(b) ISOLATION: B-briefing leaks=${leakB.length ? leakB.join(',') : 'none'} | A-briefing shows A-detail=${shownA}`);
  if (leakB.length) log('(b) ISOLATION MISS: target A detail leaked into target B briefing.');
  if (!shownA) log('(b) ISOLATION MISS: target A detail did not show on target A briefing.');

  // (c) NO PREDEFINED SEQUENCE: a BLANK hunt on the second target,
  // 2 real brain turns, first move compared with scanme's.
  const containerB = await ensureContainer(HUNT_B, TARGET_B);
  const clockBOk = await checkContainerClock(containerB);
  log(`starting blank hunt on ${TARGET_B} (${TURNS} turns, real brain via Ollama)…`);
  let resultB = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    resultB = await humanIteration(HUNT_B, TARGET_B, {
      turns: TURNS,
      parsedScope: parseScope(TARGET_B),
      assess: null,
    });
    log(`target-B attempt ${attempt}: turnsRun=${resultB.turnsRun}/${TURNS} actionsRun=${resultB.actionsRun} aiOk=${resultB.aiOk} failKind=${resultB.failKind || '-'}`);
    if (resultB.turnsRun >= TURNS || attempt === MAX_ATTEMPTS) break;
    log(`only ${resultB.turnsRun}/${TURNS} turns ran (brain slot lost / server OOM) — waiting 30s, then continuing…`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  const firstMove = (hid) => {
    const evs = (readHuntEvents(hid) || []).filter((e) => e.type === 'tool_call');
    const f = evs[0];
    return f ? `${f.tool}:${String(f.detail || '').slice(0, 80)}` : '(none)';
  };
  const moveA = firstMove(HUNT_ID);
  const moveB = firstMove(HUNT_B);
  log(`(c) NO-SEQUENCE: first move scanme(blank)=${moveA} | first move example.com(blank)=${moveB}`);
  log('(c) MEMORY AXIS (banked): scanme session 1 first move was shell nmap; primed scanme session 2 first move was write_file install_ssh.sh — same target, different memory, different first move.');
  if (moveA === moveB) log('(c) NO-SEQUENCE MISS: identical first moves on two different blank targets — report honestly; a shared first recon step is not by itself proof of a canned order, but the bar asked for difference.');

  if (!KEEP) {
    try { await docker(['rm', '-f', container]); log(`lab container ${container} removed`); } catch (e) { log(`container removal failed: ${e.message}`); }
    try { await docker(['rm', '-f', containerB]); log(`lab container ${containerB} removed`); } catch (e) { log(`container B removal failed: ${e.message}`); }
  }
  log(`verdict s3: clock IST=${clockOk}/${clockBOk} | terminal output-back=${termOk} shot-on-disk=${shotExists} | isolation leak-B=${leakB.length} shown-A=${shownA} | first-moves differ=${moveA !== moveB}`);
  process.exit(0);
}

log(`starting session ${SESSION} (${TURNS} turns, real brain via Ollama)…`);
// Retry the whole session until all TURNS ran (or attempts run
// out): the single brain slot is shared with the live hunt AND the
// server dies to OOM every ~11 min (NUM_CTX 16384 — the live hunt's
// huge prompts grow the KV cache to ~6.7GB and the kernel kills
// llama). A session attempt can die mid-way (socket hang up /
// no_reply); the plan + outputs persist in the hunt record, so the
// next attempt CONTINUES from them instead of restarting. The wait
// between attempts is short (30s) — the live loop re-queues fast
// after an OOM death, and the lab must re-queue fast too or it
// never wins the slot.
let result = null;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  result = await humanIteration(HUNT_ID, TARGET, {
    turns: TURNS,
    parsedScope: parseScope(TARGET),
    assess: null, // no claims in the lab; the verifier is not part of this test
  });
  log(`attempt ${attempt}: turnsRun=${result.turnsRun}/${TURNS} actionsRun=${result.actionsRun} aiOk=${result.aiOk} failKind=${result.failKind || '-'}`);
  if (result.turnsRun >= TURNS || attempt === MAX_ATTEMPTS) break;
  log(`only ${result.turnsRun}/${TURNS} turns ran (brain slot lost / server OOM) — waiting 30s, then continuing from the saved plan/outputs…`);
  await new Promise((r) => setTimeout(r, 30000));
}
log(`session done: turnsRun=${result.turnsRun} actionsRun=${result.actionsRun} aiOk=${result.aiOk} failKind=${result.failKind || '-'} in ${Math.round((Date.now() - t0) / 1000)}s`);
const rep = report();

if (!KEEP) {
  try { await docker(['rm', '-f', container]); log(`lab container ${container} removed`); } catch (e) { log(`container removal failed (leave it — it holds 4g): ${e.message}`); }
}

log(`verdict: clock IST=${clockOk} | plan steps=${rep.plan.steps.length} | outputs=${outputCount(rep.outputs)} | recalls=${rep.recalls.length} | tool_calls=${rep.toolCalls.length}`);
if (SESSION === 1 && rep.plan.steps.length === 0) log('SESSION 1 MISS: the brain wrote no plan — a finding, not a pass.');
if (SESSION === 2 && rep.recalls.length === 0) log('SESSION 2 MISS: no recall fired — the brain re-ran work instead of remembering it. Check whether it re-chose the same actions (tool_calls above) or genuinely new ones.');
