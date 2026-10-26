// HUNTER-MIND lab (26 Oct 2026, owner order: "tu khud test kar de").
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
//   Session 1 (3 turns): the brain writes its OWN plan, runs nmap +
//     subdomain enumeration, saves the outputs.
//   Session 2 (3 turns, same hunt id): the plan + outputs are in the
//     record — the brain must RECALL the saved outputs instead of
//     re-running them.
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

if (!process.env.DATA_DIR) {
  console.error('DATA_DIR is required — point it at a scratch dir (e.g. /tmp/hunter-mind-lab-data). Refusing to run against the live data dir.');
  process.exit(2);
}
if (process.env.LLM_PROVIDER !== 'ollama') {
  console.error('LLM_PROVIDER must be ollama for this lab (llm.js defaults to bedrock, which returns null here). Export LLM_PROVIDER=ollama and re-run.');
  process.exit(2);
}

const { humanIteration } = await import('../src/humanLoop.js');
const { spawnHuntContainer, dockerAvailable } = await import('../src/huntRunner.js');
const { parseScope } = await import('../src/scopeParser.js');
const { loadHuntPlan } = await import('../src/huntPlan.js');
const { loadOutputs, outputCount } = await import('../src/outputMemory.js');
const { readHuntEvents } = await import('../src/store.js');
const { getAllReasoning } = await import('../src/reasoningMemory.js');

const log = (...a) => console.log(`[lab s${SESSION}]`, ...a);

async function docker(args) {
  const { stdout } = await execFileAsync('docker', args, { timeout: 30000 });
  return stdout.trim();
}

async function ensureContainer() {
  const name = `dm-hunt-${HUNT_ID.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
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
const MAX_ATTEMPTS = 8;
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
