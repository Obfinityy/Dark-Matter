// Be a Brain — backend unit tests (28 Oct 2026).
//
// Covers the service layer in src/brainMode.js with the REAL store
// (DATA_DIR pointed at a temp dir) and stubbed engines/containers:
//   (a) brain-mode set/get — 'parent' pauses the AI loop, 'ai' resumes
//   (b) action index listing — hash + label + status per entry
//   (c) output-by-hash — known hash returns the stored output, unknown 404s
//   (d) live process state — current task + done/pending
//   (e) submit-an-action — executes via the stubbed container exec,
//       records with a hash, output fetchable by that hash; a deliberate
//       repeat re-executes (no dedup block on the parent)
//   (f) submit-an-action rejected while brainMode is 'ai'
// Plus: scope refusal, claim completeness gate, and the pipeline
// verifier applying to a parent claim (stubbed assessResult).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE store/config is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'be-a-brain-'));
process.env.DATA_DIR = tmpRoot;

const {
  getBrainMode,
  setBrainMode,
  pauseHuntLoop,
  resumeHuntLoop,
  listBrainActions,
  outputByHash,
  deriveProcessState,
  executeBrainAction,
} = await import('../brainMode.js');
const {
  appendHuntEvent,
  readHuntEvents,
  readHuntMeta,
  writeHuntMeta,
} = await import('../store.js');
const { recordReasoning, getAllReasoning } = await import('../reasoningMemory.js');
const { contentHash } = await import('../actionIndex.js');

const TARGET = 'http://172.17.0.1:3100/';
const SCOPE = { domain: '172.17.0.1', inScope: ['172.17.0.1'], outOfScopeHosts: [], outOfScope: [] };

function makeHunt(id, extra = {}) {
  writeHuntMeta(id, {
    huntId: id,
    target: TARGET,
    parsedScope: SCOPE,
    userId: 'owner-1',
    state: 'running',
    paused: false,
    iteration: 247,
    ...extra,
  });
  return id;
}

function seedActions(huntId) {
  appendHuntEvent(huntId, { type: 'tool_call', tool: 'shell', detail: "curl -s 'http://172.17.0.1:3100/'", via: 'human-mode' });
  recordReasoning(huntId, { action: "shell: curl -s 'http://172.17.0.1:3100/'", why: 'check the target', result: 'DVWA login page, 200 OK', learned: '' });
  appendHuntEvent(huntId, { type: 'tool_call', tool: 'browser_open', detail: TARGET, via: 'human-mode' });
  recordReasoning(huntId, { action: `browser_open: ${TARGET}`, why: 'open target', result: 'login page shown', learned: '' });
  appendHuntEvent(huntId, { type: 'tool_call', tool: 'shell', detail: "curl -s 'http://172.17.0.1:3100/nope'", via: 'human-mode' });
  recordReasoning(huntId, { action: "shell: curl -s 'http://172.17.0.1:3100/nope'", why: 'probe', result: 'failed: 404 Not Found', learned: '' });
}

// (a) brain-mode set/get -----------------------------------------------------
test('(a) setting parent pauses the AI loop; setting ai resumes it', async () => {
  const huntId = makeHunt('h_mode_1');
  const calls = [];
  const pauseEngine = async (id) => { calls.push(['pause', id]); return { paused: true }; };
  const resumeEngine = async (id) => { calls.push(['resume', id]); return { resumed: true }; };

  const toParent = await setBrainMode(huntId, 'parent', { pauseEngine });
  assert.equal(toParent.ok, true);
  assert.equal(toParent.brainMode, 'parent');
  assert.equal(toParent.state, 'paused');
  assert.deepEqual(calls, [['pause', huntId]]);
  const metaParent = readHuntMeta(huntId);
  assert.equal(getBrainMode(metaParent), 'parent');
  assert.equal(metaParent.paused, true);

  // Setting the same mode again is a no-op (no second pause call).
  const again = await setBrainMode(huntId, 'parent', { pauseEngine });
  assert.equal(again.unchanged, true);
  assert.equal(calls.length, 1);

  const toAi = await setBrainMode(huntId, 'ai', { resumeEngine, resumeInterruptedHunt: async () => { calls.push(['resumeLoop', huntId]); } });
  assert.equal(toAi.ok, true);
  assert.equal(toAi.brainMode, 'ai');
  assert.equal(calls[1][0], 'resume');
  const metaAi = readHuntMeta(huntId);
  assert.equal(getBrainMode(metaAi), 'ai');

  assert.deepEqual(await setBrainMode(huntId, 'bogus', {}), { ok: false, error: 'invalid_mode', message: "mode must be 'parent' or 'ai'" });
  assert.equal((await setBrainMode('h_nope', 'parent', {})).error, 'hunt_not_found');
});

test('(a) host-side fallback pauses/resumes when there is no engine', async () => {
  const huntId = makeHunt('h_mode_host');
  const down = async () => { const { EngineUnreachableError } = await import('../engine.js'); throw new EngineUnreachableError('no engine'); };
  const paused = await pauseHuntLoop(huntId, { pauseEngine: down });
  assert.equal(paused.ok, true);
  assert.equal(paused.via, 'host');
  assert.equal(readHuntMeta(huntId).state, 'paused');
  const resumed = await resumeHuntLoop(huntId, { resumeEngine: down, resumeInterruptedHunt: async () => {} });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.via, 'host');
  assert.equal(readHuntMeta(huntId).state, 'running');
});

test('(a) handing back to AI on a terminal hunt is refused, mode unchanged', async () => {
  // The hunt must be IN parent mode first — otherwise 'ai' is already
  // the mode and the switch is a no-op that never touches the loop.
  const huntId = makeHunt('h_mode_terminal', { brainMode: 'parent', state: 'stopped', stopped: true, paused: false });
  const down = async () => { const { EngineUnreachableError } = await import('../engine.js'); throw new EngineUnreachableError('no engine'); };
  const res = await setBrainMode(huntId, 'ai', { resumeEngine: down });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'hunt_terminal');
  assert.equal(getBrainMode(readHuntMeta(huntId)), 'parent'); // mode never flipped back
  assert.equal(readHuntMeta(huntId).state, 'stopped');
});

// (b) action index listing ---------------------------------------------------
test('(b) action index entries carry hash + label + status', () => {
  const huntId = makeHunt('h_index_1');
  seedActions(huntId);
  const actions = listBrainActions(readHuntEvents(huntId), [], { huntRunning: false });
  // reasoning rows were written via recordReasoning; list with them too
  assert.equal(actions.length, 3);
  for (const a of actions) {
    assert.ok(a.hash && a.hash.length >= 8, 'hash present');
    assert.ok(a.label.includes(a.tool), 'label names the tool');
    assert.ok(['done', 'failed', 'running'].includes(a.status), 'status is one of the three');
  }
  assert.equal(actions[0].status, 'done');
  assert.equal(actions[0].tool, 'shell');
  // The third action's note says it failed -> 'failed'.
  const withNotes = listBrainActions(readHuntEvents(huntId), getAllReasoning(huntId), { huntRunning: false });
  assert.equal(withNotes[2].status, 'failed');
  // 'running': most recent entry, AI loop running, last event is its tool_call.
  const running = listBrainActions(readHuntEvents(huntId), [], { huntRunning: true });
  assert.equal(running[2].status, 'running');
  assert.equal(running[0].status, 'done');
});

// (c) output by hash ----------------------------------------------------------
test('(c) output-by-hash returns the stored output; unknown hash 404s', async () => {
  const huntId = makeHunt('h_hash_1');
  seedActions(huntId);
  const { getAllReasoning } = await import('../reasoningMemory.js');
  const rows = getAllReasoning(huntId);
  const events = readHuntEvents(huntId);
  const knownHash = contentHash('shell', "curl -s 'http://172.17.0.1:3100/'");
  const hit = outputByHash(events, rows, knownHash);
  assert.equal(hit.ok, true);
  assert.equal(hit.hash, knownHash);
  assert.match(hit.output, /DVWA login page/);
  assert.equal(hit.entry.tool, 'shell');
  const miss = outputByHash(events, rows, 'deadbeefdeadbeef');
  assert.equal(miss.ok, false);
  assert.equal(miss.error, 'unknown_hash');
  assert.equal(outputByHash(events, rows, '').error, 'unknown_hash');
});

// (d) live process state -------------------------------------------------------
test('(d) process state reflects the current task + done/pending', async () => {
  const huntId = makeHunt('h_proc_1', {
    currentTask: { task: 'Probe reflected XSS in the search box', goal: 'Confirm reflected XSS on DVWA', progress: 'marker sent, checking reflection', status: 'in_progress' },
  });
  seedActions(huntId);
  const { getAllReasoning } = await import('../reasoningMemory.js');
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: getAllReasoning(huntId) });
  assert.equal(state.ok, true);
  assert.equal(state.running, true);
  assert.equal(state.task, 'Probe reflected XSS in the search box');
  assert.equal(state.goal, 'Confirm reflected XSS on DVWA');
  assert.match(state.progress, /marker sent/);
  assert.equal(state.taskStatus, 'in_progress');
  assert.equal(state.brainMode, 'ai');
  assert.equal(state.state, 'running');
  assert.equal(state.iteration, 247);
  assert.ok(state.done.length >= 2, 'done labels present');
  assert.ok(state.done[0].includes('shell'), 'done labels are action labels');
  assert.deepEqual(state.pending, []);
  assert.equal(state.loop.enabled, true);
});

test('(d) process state falls back to the newest task_complete event', () => {
  const huntId = makeHunt('h_proc_2');
  appendHuntEvent(huntId, { type: 'task_complete', task: 'Dump users via UNION', goal: 'Prove SQLi', progress: '5 users dumped', summary: 'UNION dump worked', via: 'human-mode' });
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.task, 'Dump users via UNION');
  assert.equal(state.taskStatus, 'complete');
  assert.equal(state.summary, 'UNION dump worked');
});

// (e) submit an action ---------------------------------------------------------
test('(e) shell action executes via the container exec, records with a hash, output fetchable', async () => {
  const huntId = makeHunt('h_act_1', { brainMode: 'parent', state: 'paused', paused: true });
  const execCalls = [];
  const exec = async (h, t, cmd) => { execCalls.push(cmd); return { stdout: 'uid=0(root) gid=0(root)', stderr: '', code: 0 }; };
  const res = await executeBrainAction(huntId, { action: 'shell', command: 'id' }, { exec });
  assert.equal(res.ok, true);
  assert.match(res.output, /uid=0/);
  assert.ok(res.hash, 'hash returned');
  assert.equal(res.entry.tool, 'shell');
  assert.equal(execCalls.length, 1);
  // The action is in the index now, and its output is fetchable by hash.
  const { getAllReasoning } = await import('../reasoningMemory.js');
  const byHash = outputByHash(readHuntEvents(huntId), getAllReasoning(huntId), res.hash);
  assert.equal(byHash.ok, true);
  assert.match(byHash.output, /uid=0/);
  // The tool_call event carries the parent marker.
  const toolCalls = readHuntEvents(huntId).filter((e) => e.type === 'tool_call');
  assert.equal(toolCalls.at(-1).via, 'be-a-brain');
  assert.equal(toolCalls.at(-1).by, 'parent');
});

test('(e) a deliberate repeat re-executes — no dedup block on the parent', async () => {
  const huntId = makeHunt('h_act_repeat', { brainMode: 'parent', state: 'paused', paused: true });
  let n = 0;
  const exec = async () => { n++; return { stdout: `run ${n}`, stderr: '', code: 0 }; };
  const first = await executeBrainAction(huntId, { action: 'shell', command: 'id' }, { exec });
  const second = await executeBrainAction(huntId, { action: 'shell', command: 'id' }, { exec });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true, 'the parent\'s own deliberate repeat is executed, not dedup-blocked');
  assert.match(second.output, /run 2/);
  assert.equal(first.hash, second.hash, 'same action, same content-hash — recallable as one action');
});

test('(e) browser actions go through the GUI shim; recall returns the full record', async () => {
  const huntId = makeHunt('h_act_gui', { brainMode: 'parent', state: 'paused', paused: true });
  seedActions(huntId);
  const gui = {
    open: async (h, url) => ({ ok: true, observation: `Opened ${url} — DVWA login page` }),
    click: async (h, text) => ({ ok: true, observation: `Clicked "${text}"` }),
    type: async (h, text, submit) => ({ ok: true, observation: `Typed "${text}"${submit ? ' + submitted' : ''}` }),
  };
  const opened = await executeBrainAction(huntId, { action: 'browser_open', url: TARGET }, { gui });
  assert.equal(opened.ok, true);
  assert.match(opened.output, /DVWA login/);
  const clicked = await executeBrainAction(huntId, { action: 'browser_click', text: 'Login' }, { gui });
  assert.match(clicked.output, /Clicked "Login"/);
  const recalled = await executeBrainAction(huntId, { action: 'recall', id: 1 }, {});
  assert.equal(recalled.ok, true);
  assert.match(recalled.output, /DVWA login page/);
  assert.equal(recalled.entry.tool, 'shell');
});

test('(e) a parent task block updates the live process state', async () => {
  const huntId = makeHunt('h_act_task', { brainMode: 'parent', state: 'paused', paused: true });
  const exec = async () => ({ stdout: 'ok', stderr: '', code: 0 });
  const res = await executeBrainAction(huntId, {
    action: 'shell', command: 'id',
    task: { task: 'Check whoami in the container', goal: 'Confirm shell access', progress: 'first command', status: 'in_progress' },
  }, { exec });
  assert.equal(res.ok, true);
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.task, 'Check whoami in the container');
  assert.equal(state.taskStatus, 'in_progress');
});

// (f) rejected while AI is the brain --------------------------------------------
test('(f) submitting an action while brainMode is ai is rejected', async () => {
  const huntId = makeHunt('h_act_ai', { brainMode: 'ai', state: 'running', paused: false });
  let execCalled = false;
  const exec = async () => { execCalled = true; return { stdout: 'x', stderr: '', code: 0 }; };
  const res = await executeBrainAction(huntId, { action: 'shell', command: 'id' }, { exec });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'brain_mode_ai');
  assert.equal(execCalled, false, 'nothing executed while the AI is the brain');
});

// Gates ------------------------------------------------------------------------
test('scope: an out-of-scope URL in a parent command is refused, nothing runs', async () => {
  const huntId = makeHunt('h_scope_1', { brainMode: 'parent', state: 'paused', paused: true });
  let execCalled = false;
  const exec = async () => { execCalled = true; return { stdout: 'x', stderr: '', code: 0 }; };
  const res = await executeBrainAction(huntId, { action: 'shell', command: "curl -s 'https://evil.example/admin'" }, { exec });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'out_of_scope');
  assert.equal(execCalled, false);
  const open = await executeBrainAction(huntId, { action: 'browser_open', url: 'https://evil.example/' }, { gui: { open: async () => ({ ok: true, observation: 'opened' }) } });
  assert.equal(open.ok, false);
  assert.equal(open.error, 'out_of_scope');
});

test('claim gate: an incomplete parent claim is bounced unrecorded; a complete one goes to the verifier', async () => {
  const huntId = makeHunt('h_claim_1', { brainMode: 'parent', state: 'paused', paused: true });
  const incomplete = await executeBrainAction(huntId, {
    action: 'claim_finding', title: 'Reflected XSS in search', class: 'xss',
  }, { assess: async () => { throw new Error('verifier must not run for an incomplete claim'); } });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.error, 'claim_incomplete');
  assert.ok(incomplete.missing.includes('evidence'));
  assert.ok(incomplete.missing.includes('command'));
  // Bounced claims are NOT tool_call events.
  assert.equal(readHuntEvents(huntId).filter((e) => e.type === 'tool_call').length, 0);
  assert.equal(readHuntEvents(huntId).filter((e) => e.type === 'claim_bounce').length, 1);

  const evidence = 'Hello <script>alert(1)</script> — marker QXZ7719 reflected in the page body, HTTP 200';
  const assessCalls = [];
  const assess = async (h, t, plan, result) => {
    assessCalls.push(plan);
    return { verified: true, title: plan.test, severity: 'high', verification: 'confirmed (all 4 steps passed)' };
  };
  const complete = await executeBrainAction(huntId, {
    action: 'claim_finding', title: 'Reflected XSS in search', class: 'xss',
    evidence, command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=<script>alert(1)</script>'",
    counterevidence: 'same request without the script tag shows no marker',
    confidence: 'high',
  }, { assess });
  assert.equal(complete.ok, true);
  assert.equal(complete.verified, true);
  assert.equal(assessCalls.length, 1, 'the pipeline verifier ran for the parent claim');
  assert.match(complete.output, /VERIFIED/);
});

test('claim gate: a verifier rejection is reported, not presented as a finding', async () => {
  const huntId = makeHunt('h_claim_2', { brainMode: 'parent', state: 'paused', paused: true });
  const assess = async () => ({ verified: false, title: 'XSS?', severity: 'medium', verification: 'evidence not reproduced on re-run' });
  const res = await executeBrainAction(huntId, {
    action: 'claim_finding', title: 'Reflected XSS in search', class: 'xss',
    evidence: 'a long enough evidence string that claims the marker reflected on a 200 page here',
    command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test'",
    counterevidence: 'control request without the payload shows no marker',
    confidence: 'high',
  }, { assess });
  assert.equal(res.ok, true);
  assert.equal(res.verified, false);
  assert.match(res.output, /NOT verified/);
});
