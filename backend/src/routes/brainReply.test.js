// Brain JSON — backend unit tests (28 Oct 2026, brain-json lane).
//
//   (a) schema validation — validateBrainReply over the documented
//       contract (backend/src/brainReply.schema.json): valid replies,
//       missing task/goal/progress, bad action type, missing per-type
//       fields, recall with neither/both hash/id (top-level and in
//       the action), claim-package gaps.
//   (b) JSON route — POST /:id/brain-action-json through the REAL
//       hunts router (express + real store in a temp DATA_DIR, fake
//       container shim): valid JSON executes via the stubbed
//       dispatch and returns hash+output; invalid JSON is 400 naming
//       the bad field; the same guards apply (scope refusal,
//       claim bounce); 409 while the AI is the brain; a top-level
//       recall is fetched first and returned as `recalled`.
//   (c) process tracking — in-progress shows running with
//       task/goal/progress; a refused step shows failed with its
//       error; a finished step shows done; a hunt with no step shows
//       pending; the process view never embeds full output.
//   (d) titles — the action index carries a meaningful title +
//       number, hash, tool, label, date/time and variant (a UNION
//       probe is titled "SQL Injection UNION dump", not "shell").
//   (e) output-by-hash — a real action hash returns the FULL stored
//       record, including a recall of a past action.
//
// No Meta calls, $0 spend, no live hunt touched: the container, GUI
// and verifier are stubbed through configureBrainActionDeps, and the
// engine is unreachable (ENGINE_URL points at nothing listening),
// so pause/resume exercise the host-side fallback.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE store/config is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-json-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'test-secret-1234567890-abcdefghij9876543210'; // >=32 chars, >=10 unique: required by auth.js since #401
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail

const { validateBrainReply, brainReplyToAction, loadBrainReplySchema } = await import('../brainReply.js');
const {
  setBrainMode,
  listBrainActions,
  outputByHash,
  deriveProcessState,
  executeBrainAction,
  configureBrainActionDeps,
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

async function makeParentHunt(id, extra = {}) {
  makeHunt(id, { brainMode: 'parent', state: 'paused', paused: true, ...extra });
  // The meta already says parent; setBrainMode is a no-op then, so
  // force the pause path through the service call instead: start
  // from ai and switch with a stubbed engine.
  writeHuntMeta(id, {
    ...readHuntMeta(id), brainMode: 'ai', state: 'running', paused: false,
  });
  const res = await setBrainMode(id, 'parent', { pauseEngine: async () => ({ paused: true }) });
  assert.equal(res.ok, true);
  return id;
}

const shellReply = (over = {}) => ({
  task: 'Dump DVWA users via UNION injection',
  goal: 'Prove SQL injection on DVWA',
  progress: 'Login done; single-quote probe returned a SQL error',
  action: { type: 'shell', command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1%27%20UNION%20SELECT%20user,password%20FROM%20users--%20&Submit=Submit'" },
  ...over,
});

const hasField = (res, field) => res.errors.some((e) => e.field === field);

// (a) schema validation ------------------------------------------------------
test('(a) a valid shell reply passes, and the schema file\'s own examples pass', () => {
  assert.deepEqual(validateBrainReply(shellReply()), { ok: true });
  const schema = loadBrainReplySchema();
  assert.equal(schema.title, 'BrainReply — one brain turn, as JSON');
  assert.ok(Array.isArray(schema.examples) && schema.examples.length >= 2, 'schema carries example replies');
  for (const ex of schema.examples) {
    const v = validateBrainReply(ex);
    assert.equal(v.ok, true, `schema example must validate: ${JSON.stringify(v.errors || [])}`);
  }
  // A valid claim reply passes too (full claim package).
  const claim = shellReply({
    task: 'File the reflected XSS finding',
    action: {
      type: 'claim_finding', title: 'Reflected XSS in search', severity: 'high',
      command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test'",
      evidence: 'Hello <script>alert(1)</script> — marker reflected, HTTP 200',
      counterevidence: 'same request without the script tag shows no marker',
      confidence: 'high',
    },
  });
  assert.deepEqual(validateBrainReply(claim), { ok: true });
  // click needs a selector (text accepted in its place); type needs text.
  assert.deepEqual(validateBrainReply(shellReply({ action: { type: 'click', selector: 'Login' } })), { ok: true });
  assert.deepEqual(validateBrainReply(shellReply({ action: { type: 'type', selector: 'username', text: 'admin', submit: true } })), { ok: true });
  assert.deepEqual(validateBrainReply(shellReply({ recall: { hash: 'abcdef0123456789' } })), { ok: true });
  assert.deepEqual(validateBrainReply(shellReply({ recall: { id: '#3' } })), { ok: true });
});

test('(a) missing task / goal / progress names the missing field', () => {
  const noTask = shellReply(); delete noTask.task;
  let v = validateBrainReply(noTask);
  assert.equal(v.ok, false);
  assert.ok(hasField(v, 'task'), JSON.stringify(v.errors));
  const noGoal = shellReply(); delete noGoal.goal;
  assert.ok(hasField(validateBrainReply(noGoal), 'goal'));
  const noProgress = shellReply(); delete noProgress.progress;
  assert.ok(hasField(validateBrainReply(noProgress), 'progress'));
  const blankTask = shellReply({ task: '   ' });
  assert.ok(hasField(validateBrainReply(blankTask), 'task'), 'a blank task is missing');
  assert.ok(hasField(validateBrainReply(null), 'reply'));
  assert.ok(hasField(validateBrainReply('do a thing'), 'reply'));
  assert.ok(hasField(validateBrainReply({ ...shellReply(), action: null }), 'action'));
});

test('(a) a bad action type names action.type', () => {
  const v = validateBrainReply(shellReply({ action: { type: 'nmap_scan', command: 'x' } }));
  assert.equal(v.ok, false);
  assert.ok(hasField(v, 'action.type'));
  const v2 = validateBrainReply(shellReply({ action: {} }));
  assert.ok(hasField(v2, 'action.type'));
});

test('(a) a missing per-type field names that field', () => {
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'shell' } })), 'action.command'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'browser_open' } })), 'action.url'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'click' } })), 'action.selector'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'type', selector: 'q' } })), 'action.text'));
  // GUI-TYPE-TARGET (28 Oct 2026): a type names its field — without a
  // selector the brain types blind, which is exactly how the DVWA login
  // failed while every action reported success.
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'type', text: 'admin' } })), 'action.selector'));
  // OS CONTROL (28 Oct 2026): the parent brain's desktop/tool actions
  // carry their own required fields — a click without a window, a
  // terminal without a command, a tool launch without a tool name.
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'desktop_click' } })), 'action.window'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'desktop_terminal' } })), 'action.command'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'launch_tool' } })), 'action.tool'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'desktop_click_at', x: 1 } })), 'action.y'));
  assert.deepEqual(validateBrainReply(shellReply({ action: { type: 'see_screen' } })), { ok: true });
  assert.deepEqual(validateBrainReply(shellReply({ action: { type: 'desktop_click', window: 'Burp Suite' } })), { ok: true });
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'claim_finding', title: 'XSS?', severity: 'high', command: 'curl x', evidence: 'long enough evidence here', confidence: 'high' } })), 'action.counterevidence'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'claim_finding', title: 'XSS?', severity: 'nuclear', command: 'curl x', evidence: 'long enough evidence here', counterevidence: 'control shows nothing', confidence: 'high' } })), 'action.severity'));
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'claim_finding', title: 'XSS?', severity: 'high', command: 'curl x', evidence: 'long enough evidence here', counterevidence: 'control shows nothing' } })), 'action.confidence'));
});

test('(a) recall with neither hash nor id, and with both, is rejected', () => {
  // In the action.
  assert.ok(hasField(validateBrainReply(shellReply({ action: { type: 'recall' } })), 'action.hash'));
  const both = validateBrainReply(shellReply({ action: { type: 'recall', hash: 'abc', id: 1 } }));
  assert.equal(both.ok, false);
  assert.ok(hasField(both, 'action.recall'));
  // Top-level.
  assert.ok(hasField(validateBrainReply(shellReply({ recall: {} })), 'recall'));
  const bothTop = validateBrainReply(shellReply({ recall: { hash: 'abc', id: 1 } }));
  assert.equal(bothTop.ok, false);
  assert.ok(hasField(bothTop, 'recall'));
  const badId = validateBrainReply(shellReply({ recall: { id: 'banana' } }));
  assert.ok(hasField(badId, 'recall.id'));
});

test('(a) brainReplyToAction maps click/type onto the existing dispatch shape', () => {
  const { action, task } = brainReplyToAction(shellReply({ action: { type: 'click', selector: 'Login' } }));
  assert.equal(action.action, 'browser_click');
  assert.equal(action.text, 'Login');
  assert.equal(task.task, 'Dump DVWA users via UNION injection');
  const typed = brainReplyToAction(shellReply({ action: { type: 'type', selector: 'q', text: 'admin', submit: true } }));
  assert.equal(typed.action.action, 'browser_type');
  assert.equal(typed.action.text, 'admin');
  assert.equal(typed.action.submit, true);
  assert.equal(typed.action.selector, 'q', 'the field target travels to the dispatch');
  const osClicked = brainReplyToAction(shellReply({ action: { type: 'desktop_click', window: 'Burp Suite' } }));
  assert.equal(osClicked.action.action, 'desktop_click');
  assert.equal(osClicked.action.window, 'Burp Suite');
  const seen = brainReplyToAction(shellReply({ action: { type: 'see_screen' } }));
  assert.equal(seen.action.action, 'see_screen');
  const claimed = brainReplyToAction(shellReply({
    action: { type: 'claim_finding', title: 'Reflected XSS in search', severity: 'high', command: 'curl x', evidence: 'ev', counterevidence: 'ce', confidence: 'high' },
  }));
  assert.equal(claimed.action.action, 'claim_finding');
  assert.equal(claimed.action.severity, 'high');
});

// (b) JSON route --------------------------------------------------------------
// One express app + one stubbed dispatch for the whole section, like
// lab-be-a-brain.mjs: the route tests share the shim, each hunt is new.
const execCalls = [];
const assessCalls = [];
configureBrainActionDeps({
  exec: async (huntId, target, command) => {
    execCalls.push(command);
    if (command.includes('UNION')) {
      return { stdout: 'MARKER-OUTPUT admin:5f4dcc3b5aa765d61d8327deb882cf99\nuser:p0wned-hash-here', stderr: '', code: 0 };
    }
    return { stdout: `shim output for: ${command}`, stderr: '', code: 0 };
  },
  gui: {
    open: async (h, url) => ({ ok: true, observation: `Opened ${url} — DVWA login page` }),
    click: async (h, text) => ({ ok: true, observation: `Clicked "${text}"` }),
    type: async (h, text, submit) => ({ ok: true, observation: `Typed "${text}"` }),
  },
  assess: async (huntId, target, plan, result) => {
    assessCalls.push(plan);
    return { verified: true, title: plan.test, severity: 'high', verification: 'confirmed (all 4 steps passed)' };
  },
});

const express = (await import('express')).default;
const huntsRouter = (await import('./hunts.js')).default;
const { issueToken } = await import('./auth.js');
const OWNER = { id: 'owner-1', username: 'owner', role: 'admin' };
const app = express();
app.use(express.json());
app.use('/api/v1/hunts', huntsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
const token = issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function call(method, huntId, suffix, body) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/hunts/${huntId}${suffix}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

test('(b) valid JSON executes via the stubbed dispatch and returns hash+output', async () => {
  const huntId = await makeParentHunt('h_json_1');
  const before = execCalls.length;
  const r = await call('POST', huntId, '/brain-action-json', { reply: shellReply() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.ok(r.json.hash && r.json.hash.length >= 8, 'hash returned');
  assert.match(r.json.output, /MARKER-OUTPUT/);
  assert.equal(r.json.entry.tool, 'shell');
  assert.equal(execCalls.length, before + 1, 'the stubbed dispatch ran the command');
  // The action is in the index with that hash, and its full output
  // is fetchable by the hash.
  const actions = await call('GET', huntId, '/actions');
  assert.ok(actions.json.actions.some((a) => a.hash === r.json.hash && a.tool === 'shell'));
  const out = await call('GET', huntId, `/output/${r.json.hash}`);
  assert.equal(out.status, 200);
  assert.match(out.json.output, /MARKER-OUTPUT/);
});

test('(b) the JSON reply\'s step completes in the process view', async () => {
  const huntId = await makeParentHunt('h_json_proc');
  const r = await call('POST', huntId, '/brain-action-json', { reply: shellReply() });
  assert.equal(r.status, 200);
  const p = await call('GET', huntId, '/process');
  assert.equal(p.json.task, 'Dump DVWA users via UNION injection');
  assert.equal(p.json.goal, 'Prove SQL injection on DVWA');
  assert.match(p.json.progress, /single-quote probe/);
  assert.equal(p.json.taskStatus, 'complete');
  assert.equal(p.json.processStatus, 'done');
  // The process view carries titles/labels only — never the output.
  assert.ok(!p.text.includes('MARKER-OUTPUT'), 'full output must not leak into the process view');
  assert.ok(!p.text.includes('5f4dcc3b5aa765d61d8327deb882cf99'), 'no dumped hash in the process view');
});

test('(b) invalid JSON is rejected 400 naming the bad field; nothing executes', async () => {
  const huntId = await makeParentHunt('h_json_bad');
  const before = execCalls.length;
  const r = await call('POST', huntId, '/brain-action-json', { reply: shellReply({ action: { type: 'shell' } }) });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'invalid_reply');
  assert.ok(r.json.errors.some((e) => e.field === 'action.command'), JSON.stringify(r.json.errors));
  assert.equal(execCalls.length, before, 'an invalid reply executes nothing');
  const r2 = await call('POST', huntId, '/brain-action-json', { reply: { action: { type: 'shell', command: 'id' } } });
  assert.equal(r2.status, 400);
  assert.ok(r2.json.errors.some((e) => e.field === 'task'));
});

test('(b) the same guards apply: scope refusal and claim bounce via JSON', async () => {
  const huntId = await makeParentHunt('h_json_guards');
  const before = execCalls.length;
  const scoped = await call('POST', huntId, '/brain-action-json', {
    reply: shellReply({ action: { type: 'shell', command: "curl -s 'https://evil.example/admin'" } }),
  });
  assert.equal(scoped.status, 403);
  assert.equal(scoped.json.error, 'out_of_scope');
  assert.equal(execCalls.length, before, 'an out-of-scope command never runs');
  const bounced = await call('POST', huntId, '/brain-action-json', {
    reply: shellReply({
      task: 'File the XSS finding',
      // Schema-valid (every claim field present) but gate-failing:
      // evidence < 30 chars, command < 8 chars, counterevidence <
      // 10 chars — the completeness gate must still bounce it, and
      // the verifier must never run for it.
      action: {
        type: 'claim_finding', title: 'Reflected XSS in search', severity: 'high',
        command: 'curl x', evidence: 'too short', counterevidence: 'control',
        confidence: 'high',
      },
    }),
  });
  assert.equal(bounced.status, 422);
  assert.equal(bounced.json.error, 'claim_incomplete');
  assert.ok(bounced.json.missing.includes('evidence'));
  assert.ok(bounced.json.missing.includes('command'));
});

test('(b) a complete claim via JSON goes to the verifier and verifies', async () => {
  const huntId = await makeParentHunt('h_json_claim');
  const before = assessCalls.length;
  const r = await call('POST', huntId, '/brain-action-json', {
    reply: shellReply({
      task: 'File the reflected XSS finding',
      goal: 'Get the first verified finding on DVWA',
      progress: 'Marker reflected raw in the page body on a 200 response',
      action: {
        type: 'claim_finding', title: 'Reflected XSS in search', severity: 'high',
        command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test'",
        evidence: 'Hello <script>alert(1)</script> — marker QXZ7719 reflected in the page body, HTTP 200, long enough to count',
        counterevidence: 'same request without the script tag shows no marker',
        confidence: 'high',
      },
    }),
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.equal(r.json.verified, true);
  assert.equal(assessCalls.length, before + 1, 'the pipeline verifier ran for the JSON claim');
});

test('(b) the JSON route refuses with 409 while the AI is the brain', async () => {
  const huntId = makeHunt('h_json_ai', { brainMode: 'ai', state: 'running', paused: false });
  const before = execCalls.length;
  const r = await call('POST', huntId, '/brain-action-json', { reply: shellReply() });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'brain_mode_ai');
  assert.equal(execCalls.length, before, 'nothing executes while the AI is the brain');
});

test('(b) a top-level recall is fetched first and returned as recalled', async () => {
  const huntId = await makeParentHunt('h_json_recall');
  appendHuntEvent(huntId, { type: 'tool_call', tool: 'shell', detail: "curl -s 'http://172.17.0.1:3100/'", via: 'human-mode' });
  recordReasoning(huntId, { action: "shell: curl -s 'http://172.17.0.1:3100/'", why: 'check the target', result: 'DVWA login page, 200 OK', learned: '' });
  const r = await call('POST', huntId, '/brain-action-json', { reply: shellReply({ recall: { id: 1 } }) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.recalled, 'the fetched record is returned');
  assert.match(r.json.recalled.output, /DVWA login page/);
  assert.equal(r.json.recalled.id, 1);
  // The recalled record is the FULL record, and the action still ran.
  assert.match(r.json.output, /MARKER-OUTPUT/);
  // An unknown recall hash is 404 and the action never runs.
  const before = execCalls.length;
  const miss = await call('POST', huntId, '/brain-action-json', { reply: shellReply({ recall: { hash: 'deadbeefdeadbeef' } }) });
  assert.equal(miss.status, 404);
  assert.equal(miss.json.error, 'unknown_hash');
  assert.equal(execCalls.length, before, 'a failed recall executes nothing');
});

// (c) process tracking ---------------------------------------------------------
test('(c) in-progress shows running with task/goal/progress (form composer path)', async () => {
  const huntId = makeHunt('h_proc_run', { brainMode: 'parent', state: 'paused', paused: true });
  const exec = async () => ({ stdout: 'ok', stderr: '', code: 0 });
  const res = await executeBrainAction(huntId, {
    action: 'shell', command: 'id',
    task: { task: 'Check whoami in the container', goal: 'Confirm shell access', progress: 'first command', status: 'in_progress' },
  }, { exec });
  assert.equal(res.ok, true);
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.task, 'Check whoami in the container');
  assert.equal(state.goal, 'Confirm shell access');
  assert.equal(state.progress, 'first command');
  assert.equal(state.taskStatus, 'in_progress');
  assert.equal(state.processStatus, 'running');
});

test('(c) a refused step shows failed with its error', async () => {
  const huntId = makeHunt('h_proc_fail', { brainMode: 'parent', state: 'paused', paused: true });
  let execCalled = false;
  const exec = async () => { execCalled = true; return { stdout: 'x', stderr: '', code: 0 }; };
  const res = await executeBrainAction(huntId, {
    action: 'shell', command: "curl -s 'https://evil.example/admin'",
    task: { task: 'Fetch the admin page', goal: 'Check the admin surface', progress: 'starting', status: 'in_progress' },
  }, { exec });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'out_of_scope');
  assert.equal(execCalled, false);
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.taskStatus, 'failed');
  assert.equal(state.processStatus, 'failed');
  assert.equal(state.error, 'out_of_scope');
  assert.equal(state.task, 'Fetch the admin page');
  // The failure is on the record as a task_failed event.
  assert.ok(readHuntEvents(huntId).some((e) => e.type === 'task_failed' && e.error === 'out_of_scope'));
});

test('(c) a finished one-action step shows done; a hunt with no step shows pending', async () => {
  const huntId = makeHunt('h_proc_done', { brainMode: 'parent', state: 'paused', paused: true });
  const exec = async () => ({ stdout: 'uid=0(root)', stderr: '', code: 0 });
  const res = await executeBrainAction(huntId, { action: 'shell', command: 'id' }, { exec });
  assert.equal(res.ok, true);
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.taskStatus, 'complete');
  assert.equal(state.processStatus, 'done');
  assert.equal(state.task, 'shell: id');

  const fresh = makeHunt('h_proc_empty');
  const empty = deriveProcessState(fresh, { meta: readHuntMeta(fresh), events: [], reasoningRows: [] });
  assert.equal(empty.task, null);
  assert.equal(empty.taskStatus, null);
  assert.equal(empty.processStatus, 'pending');
});

test('(c) a completed task block reports complete, not in_progress', async () => {
  const huntId = makeHunt('h_proc_complete', { brainMode: 'parent', state: 'paused', paused: true });
  const exec = async () => ({ stdout: 'ok', stderr: '', code: 0 });
  const res = await executeBrainAction(huntId, {
    action: 'shell', command: 'id',
    task: { task: 'Check whoami', goal: 'Confirm shell access', progress: 'done', summary: 'root in the container', status: 'complete' },
  }, { exec });
  assert.equal(res.ok, true);
  const state = deriveProcessState(huntId, { meta: readHuntMeta(huntId), events: readHuntEvents(huntId), reasoningRows: [] });
  assert.equal(state.taskStatus, 'complete');
  assert.equal(state.processStatus, 'done');
  assert.equal(state.summary, 'root in the container');
});

// (d) titles --------------------------------------------------------------------
test('(d) action titles are informative: a UNION probe is not a bare tool name', async () => {
  const huntId = makeHunt('h_title_1', { brainMode: 'parent', state: 'paused', paused: true });
  const exec = async () => ({ stdout: 'admin:hash', stderr: '', code: 0 });
  const res = await executeBrainAction(huntId, {
    action: 'shell',
    command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1%27%20UNION%20SELECT%20user,password%20FROM%20users--%20'",
  }, { exec });
  assert.equal(res.ok, true);
  const actions = listBrainActions(readHuntEvents(huntId), getAllReasoning(huntId), { huntRunning: false });
  const union = actions.find((a) => a.hash === res.hash);
  assert.ok(union, 'the UNION action is in the index');
  assert.equal(union.title, 'SQL Injection UNION dump');
  assert.equal(union.label, 'shell | 172.17.0.1:3100/vulnerabilities/sqli/ | UNION SELECT dump | done');
  assert.equal(union.tool, 'shell');
  assert.equal(typeof union.n, 'number');
  assert.ok(union.hash && union.hash.length >= 8);
  assert.ok(union.variant, 'variant carried');
  assert.ok(union.at, 'date/time carried');
  // A plain fetch is titled by its target, a claim by its title.
  const opened = await executeBrainAction(huntId, { action: 'browser_open', url: TARGET }, {
    gui: { open: async () => ({ ok: true, observation: 'Opened' }) },
  });
  const again = listBrainActions(readHuntEvents(huntId), getAllReasoning(huntId), { huntRunning: false });
  const openEntry = again.find((a) => a.hash === opened.hash);
  assert.equal(openEntry.title, 'Open 172.17.0.1:3100');
  assert.ok(openEntry.label.startsWith('browser_open | 172.17.0.1:3100 |'), openEntry.label);
});

// (e) output-by-hash -------------------------------------------------------------
test('(e) output-by-hash returns the FULL record, including a recall of a past action', async () => {
  const huntId = makeHunt('h_out_1', { brainMode: 'parent', state: 'paused', paused: true });
  appendHuntEvent(huntId, { type: 'tool_call', tool: 'shell', detail: "curl -s 'http://172.17.0.1:3100/'", via: 'human-mode' });
  recordReasoning(huntId, { action: "shell: curl -s 'http://172.17.0.1:3100/'", why: 'check the target', result: 'DVWA login page, 200 OK', learned: '' });
  const knownHash = contentHash('shell', "curl -s 'http://172.17.0.1:3100/'");
  const hit = outputByHash(readHuntEvents(huntId), getAllReasoning(huntId), knownHash);
  assert.equal(hit.ok, true);
  assert.match(hit.output, /DVWA login page/);
  // A recall action returns the recalled past action's full record.
  const recalled = await executeBrainAction(huntId, { action: 'recall', id: 1 }, {});
  assert.equal(recalled.ok, true);
  assert.match(recalled.output, /DVWA login page/);
  assert.equal(recalled.entry.tool, 'shell');
  assert.equal(recalled.recalledHash, knownHash);
});
