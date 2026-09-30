/**
 * DARKMATTER — InfiniteChat Computer Task test suite.
 *
 * Everything runs against the REAL stack: real models (MemoryDatabase), the
 * real ComputerTaskModel / ComputerTaskWorker / ComputerTaskManager, the real
 * action schema / application resolver / policy blocklist, the real
 * classification router and the real task state machine. Only two things are
 * substituted, exactly like the autonomous-agent suite:
 *
 *   1. The local phone model — scripted, so tests are deterministic. Same
 *      contract as PhoneLocalProvider, injected through the same LocalAIQueue.
 *   2. The Python computer bridge — a scripted bridge speaking the SAME NDJSON
 *      protocol, so the adapter's discovery/validation/protocol/state code
 *      paths are all real.
 *
 * REAL Windows execution is tested separately, manually (see the session
 * report) — a scripted test never claims to be a real Windows test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MemoryDatabase } from '../src/models/database.js';
import { EventService } from '../src/services/eventService.js';
import { ComputerState } from '../src/computer/computerState.js';
import { ComputerEvents } from '../src/computer/computerEvents.js';
import { OpenInterfaceAdapter } from '../src/computer/openInterfaceAdapter.js';
import {
  validateComputerAction,
  COMPUTER_ACTIONS
} from '../src/computer/actionSchema.js';
import {
  resolveApplication,
  isApplicationBlocked
} from '../src/computer/applicationResolver.js';
import {
  validateComputerTaskDecision,
  COMPUTER_TASK_SCHEMA_PROMPT
} from '../src/agent/computerTaskDecisionSchema.js';
import { ComputerTaskBrain } from '../src/agent/computerTaskBrain.js';
import { ComputerTaskModel } from '../src/models/computerTaskModel.js';
import { InfiniteChatModel } from '../src/models/infiniteChatModel.js';
import { ComputerTaskWorker } from '../src/jobs/computerTaskWorker.js';
import {
  ComputerTaskManager,
  classifyComputerInstruction
} from '../src/services/computerTaskManager.js';

const BRIDGE_PATH = fileURLToPath(new URL('../computer/openInterfaceBridge.py', import.meta.url));
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmatter-computertask-'));

process.env.TASK_WORKER_IDLE_MS = process.env.TASK_WORKER_IDLE_MS || '5';
process.env.TASK_AI_RETRY_MS = process.env.TASK_AI_RETRY_MS || '40';
process.env.TASK_COMPUTER_RETRY_MS = process.env.TASK_COMPUTER_RETRY_MS || '40';
// The shared LocalAIQueue is a module singleton whose retry cadence is fixed at
// construction — keep the suite fast without changing production defaults.
process.env.PHONE_AI_QUEUE_MAX_RETRIES = process.env.PHONE_AI_QUEUE_MAX_RETRIES || '1';
process.env.PHONE_AI_QUEUE_RETRY_MS = process.env.PHONE_AI_QUEUE_RETRY_MS || '20';

// ══════════════════════════════════════════════════════════════════════════
// Test doubles
// ══════════════════════════════════════════════════════════════════════════

/** Scripted local phone model. Same contract as PhoneLocalProvider. */
class FakeTaskPhoneModel {
  constructor() {
    this.enabled = true;
    this.model = 'gemma-2-2b-it-abliterated-Q4_K_M';
    this.online = true;
    this.busy = false;
    this.calls = [];
    this.responses = [];   // queued JSON decisions
  }

  async healthCheck() {
    if (!this.online) return { provider: 'PhoneLocalProvider', reachable: false, reason: 'ECONNREFUSED' };
    if (this.busy) return { provider: 'PhoneLocalProvider', reachable: true, reason: 'HTTP 429 busy', model: this.model };
    return { provider: 'PhoneLocalProvider', reachable: true, model: this.model, latencyMs: 12 };
  }

  async resolveModel() {
    return this.model;
  }

  async generateStructured(messages) {
    this.calls.push({ kind: 'structured', messages });
    if (this.busy) {
      throw new Error('Phone AI Structured 429: {"error":{"message":"Another generation is already in progress. Retry shortly.","code":"busy"}}');
    }
    if (this.responses.length === 0) throw new Error('FakeTaskPhoneModel: no scripted decision left');
    const next = this.responses.shift();
    return typeof next === 'function' ? next(messages) : next;
  }

  async generate() {
    this.calls.push({ kind: 'text' });
    throw new Error('FakeTaskPhoneModel: text generation not used by computer tasks');
  }
}

/**
 * Scripted computer bridge: identical NDJSON protocol to the real Python
 * bridge, so the adapter runs its real code paths. Tracks every command so
 * tests can assert what ACTUALLY reached the bridge.
 */
function writeFakeBridge({ pyautoguiAvailable = true } = {}) {
  const file = path.join(TMP_DIR, `ctask-bridge-${pyautoguiAvailable ? 'ok' : 'degraded'}.cjs`);
  fs.writeFileSync(file, `
const readline = require('readline');
const fs = require('fs');
const LOG = ${JSON.stringify(path.join(TMP_DIR, pyautoguiAvailable ? 'commands-ok.jsonl' : 'commands-degraded.jsonl'))};
const capabilities = {
  bridge: 'fake-open-interface-adapter',
  platform: 'TestOS',
  pythonVersion: '3.13.0',
  pyautoguiAvailable: ${pyautoguiAvailable},
  pyautoguiError: null,
  screen: { width: 1920, height: 1080 },
  actions: ['screenshot','click','double_click','move_mouse','type','press_key','hotkey','scroll','sleep','open_application','navigate','get_active_window','get_browser_state'],
  neverCallsLlm: true,
  shellAccess: false
};
if (process.argv.includes('--probe')) {
  process.stdout.write(JSON.stringify({ type: 'capabilities', ok: true, result: capabilities }) + '\\n');
  process.exit(0);
}
function log(entry) { try { fs.appendFileSync(LOG, JSON.stringify(entry) + '\\n'); } catch (e) {} }
const WINDOW_TITLES = {
  open_application: 'Untitled - Notepad',
  get_active_window: 'Untitled - Notepad'
};
process.stdout.write(JSON.stringify({ type: 'ready', ok: true, result: capabilities }) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.cmd === '__shutdown__') {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: { shutdown: true } }) + '\\n');
    process.exit(0);
  }
  log({ cmd: request.cmd, params: request.params });
  const respond = (output) => {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, command: request.cmd, output, durationMs: 1 }) + '\\n');
  };
  switch (request.cmd) {
    case 'screenshot':
      respond({ width: 1920, height: 1080, bytes: 1234, sha256: 'deadbeef1234567890', path: '/tmp/shot.png' });
      break;
    case 'get_active_window':
      respond({ supported: true, title: WINDOW_TITLES[request.cmd] || 'Untitled - Notepad' });
      break;
    case 'open_application':
      WINDOW_TITLES.get_active_window = 'Untitled - Notepad (launched)';
      respond({ launched: request.params.name });
      break;
    case 'type':
      respond({ typed: (request.params.text || '').length });
      break;
    case 'press_key':
      respond({ pressed: request.params.keys, presses: request.params.presses || 1 });
      break;
    case 'hotkey':
      respond({ hotkey: request.params.keys });
      break;
    case 'click':
      respond({ clicked: { x: request.params.x, y: request.params.y } });
      break;
    case 'navigate':
      respond({ navigatedTo: request.params.url });
      break;
    default:
      respond({ done: true });
  }
});
`);
  return file;
}

/** Build the real worker/manager stack with scripted model + bridge. */
function buildStack({
  database = new MemoryDatabase(),
  bridgeFile = writeFakeBridge({ pyautoguiAvailable: true })
} = {}) {
  const taskModel = new ComputerTaskModel(database);
  const chatModel = new InfiniteChatModel(database);
  const eventService = new EventService(database);
  const computerState = new ComputerState();
  const computerEvents = new ComputerEvents({ eventService, state: computerState });
  const computer = new OpenInterfaceAdapter({
    config: {
      enabled: true,
      // Scripted bridge: Node runs the .cjs file through the SAME adapter
      // discovery/protocol code paths the real Python bridge uses.
      pythonBin: process.execPath,
      bridgePath: bridgeFile,
      spawnArgs: [],
      verifyArgs: ['-e', "console.log('python-ok ' + process.version)"],
      actionTimeoutMs: 5000,
      probeTimeoutMs: 5000,
      requireApproval: false
    },
    state: computerState,
    events: computerEvents
  });

  const phoneModel = new FakeTaskPhoneModel();
  // Pass-through queue: same enqueue(task, id) contract as the shared
  // LocalAIQueue singleton, but without its production 429-retry cadence —
  // busy errors must reach the brain IMMEDIATELY so waiting_ai is exercised.
  const directQueue = {
    stats: () => ({ pending: 0, active: 0, maxConcurrency: 1, policy: 'test-direct' }),
    enqueue: (task) => task()
  };
  const brain = new ComputerTaskBrain({ provider: phoneModel, queue: directQueue });

  const worker = new ComputerTaskWorker({
    taskModel,
    chatModel,
    brain,
    computer,
    computerState,
    computerEvents,
    eventService
  });
  const manager = new ComputerTaskManager({ taskModel, worker, eventService, config: { recoverOnBoot: true } });

  return {
    database, taskModel, chatModel, eventService,
    computerState, computerEvents, computer, phoneModel, brain, worker, manager
  };
}

/** Poll until a condition holds or the deadline passes. */
async function waitFor(check, { timeoutMs = 8000, intervalMs = 15 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function waitForStatus(manager, taskId, statuses, timeoutMs = 8000) {
  return waitFor(async () => {
    const task = await manager.taskModel.get(taskId);
    return task && statuses.includes(task.status) ? task : null;
  }, { timeoutMs });
}

/** createTask wrapper returning { taskId } for concise tests. */
async function createTestTask(manager, args) {
  const task = await manager.createTask(args);
  return { taskId: task.id, task };
}

// ══════════════════════════════════════════════════════════════════════════
// UNIT — application resolution
// ══════════════════════════════════════════════════════════════════════════

test('UNIT app-resolution: every NL phrasing of Word/Notepad/Calculator resolves', () => {
  const cases = [
    ['Open MS Word and write', 'Microsoft Word', 'winword'],
    ['launch Microsoft Word', 'Microsoft Word', 'winword'],
    ['open word', 'Microsoft Word', 'winword'],
    ['start Word', 'Microsoft Word', 'winword'],
    ['notepad', 'Notepad', 'notepad'],
    ['Open Notepad and type hello', 'Notepad', 'notepad'],
    ['Windows Notepad please', 'Notepad', 'notepad'],
    ['Open Calculator and calculate 25 * 25', 'Calculator', 'calculator:'],
    ['calc', 'Calculator', 'calculator:'],
    ['open chrome', 'Google Chrome', 'chrome'],
    ['open the file explorer', 'File Explorer', 'explorer']
  ];
  for (const [text, canonical, launch] of cases) {
    const resolved = resolveApplication(text);
    assert.ok(resolved, `expected "${text}" to resolve`);
    assert.equal(resolved.canonical, canonical, `"${text}" canonical`);
    assert.equal(resolved.launch, launch, `"${text}" launch token`);
  }
});

test('UNIT app-resolution: non-apps do NOT resolve (keyboard ≠ word, notebook ≠ notepad)', () => {
  for (const text of ['write an essay about keyboards', 'read my notebook', 'hello there friend']) {
    assert.equal(resolveApplication(text), null, `"${text}" must not resolve`);
  }
});

test('UNIT policy: dangerous applications are blocked, productivity apps are not', () => {
  const blocked = ['registry editor', 'regedit', 'task manager', 'powershell', 'cmd.exe', 'terminal', 'keepass', 'credential manager', 'event viewer', 'wireshark'];
  for (const name of blocked) {
    const result = isApplicationBlocked(name);
    assert.equal(result.blocked, true, `"${name}" must be blocked`);
    assert.ok(result.reason);
  }
  for (const name of ['winword', 'notepad', 'calculator:', 'chrome', 'Microsoft Word', 'mspaint']) {
    assert.equal(isApplicationBlocked(name).blocked, false, `"${name}" must be allowed`);
  }
  // "Command Prompt" mention blocked, even though it is not in the alias table.
  assert.equal(isApplicationBlocked('command prompt').blocked, true);
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — decision schema
// ══════════════════════════════════════════════════════════════════════════

test('UNIT schema: valid decision shapes pass and normalize', () => {
  const action = validateComputerTaskDecision({
    type: 'action',
    action: { type: 'open_application', params: { name: 'MS Word' } },
    reason: 'user wants Word',
    userMessage: 'Opening Microsoft Word…',
    confidence: 0.9
  });
  assert.equal(action.valid, true, action.errors?.join('; '));
  assert.equal(action.decision.action.type, 'open_application');

  const complete = validateComputerTaskDecision({
    type: 'complete',
    reason: 'done',
    verificationEvidence: 'Active window: "Document1 - Word" with typed content',
    userMessage: 'Leave application written.'
  });
  assert.equal(complete.valid, true, complete.errors?.join('; '));

  const askUser = validateComputerTaskDecision({
    type: 'ask_user', reason: 'blocked', question: 'Which folder should I save it in?'
  });
  assert.equal(askUser.valid, true, askUser.errors?.join('; '));
});

test('UNIT schema: invalid decisions are rejected BEFORE execution', () => {
  // complete without evidence — fake success is impossible
  assert.equal(validateComputerTaskDecision({ type: 'complete', reason: 'done', userMessage: 'done' }).valid, false);
  // unknown action
  assert.equal(validateComputerTaskDecision({ type: 'action', action: { type: 'run_shell', params: {} }, reason: 'x' }).valid, false);
  // whitelisted action, invalid params (press_key with a made-up key)
  assert.equal(validateComputerTaskDecision({ type: 'action', action: { type: 'press_key', params: { keys: ['meta_shift_f9'] } }, reason: 'x' }).valid, false);
  // action without an action object
  assert.equal(validateComputerTaskDecision({ type: 'action', reason: 'x' }).valid, false);
  // ask_user without a question
  assert.equal(validateComputerTaskDecision({ type: 'ask_user', reason: 'x' }).valid, false);
  // wait out of bounds
  assert.equal(validateComputerTaskDecision({ type: 'wait', reason: 'x', seconds: 90 }).valid, false);
  // unknown type
  assert.equal(validateComputerTaskDecision({ type: 'delete_everything', reason: 'x' }).valid, false);
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — instruction router
// ══════════════════════════════════════════════════════════════════════════

test('UNIT router: desktop commands route to computer tasks, prose does not', () => {
  const priorTask = { id: 'ctask_1', status: 'completed' };

  const routes = [
    ['Open MS Word and write an application for two days leave', true],
    ['Open Notepad and type Hello from DARKMATTER', true],
    ['Open Calculator and calculate 25 * 25', true],
    ['close word', true],
    ['calculate 25*25', true],
    ['25 * 25', true]
  ];
  for (const [text, expected] of routes) {
    assert.equal(classifyComputerInstruction(text, null).isComputerTask, expected, `"${text}"`);
  }

  // Prose/questions stay normal chat.
  for (const text of ['what is the capital of France', 'write a python function to sort a list', 'how does word processing work?']) {
    assert.equal(classifyComputerInstruction(text, null).isComputerTask, false, `"${text}" must stay chat`);
  }

  // Follow-ups chain only when a task exists.
  assert.equal(classifyComputerInstruction('Make it more formal', priorTask).isComputerTask, true);
  assert.equal(classifyComputerInstruction('Make it more formal', priorTask).isFollowUp, true);
  assert.equal(classifyComputerInstruction('Save it as leave.docx', priorTask).isFollowUp, true);
  assert.equal(classifyComputerInstruction('Add today\'s date', priorTask).isFollowUp, true);
  assert.equal(classifyComputerInstruction('Close Word', priorTask).isComputerTask, true); // new verb, still a task
  assert.equal(classifyComputerInstruction('Make it more formal', null).isComputerTask, false); // nothing to refine
});

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATION — the real loop with a scripted bridge + scripted brain
// ══════════════════════════════════════════════════════════════════════════

test('INTEGRATION task-lifecycle: scripted Notepad flow executes real bridge commands and completes', async () => {
  const stack = buildStack();
  const commandsLog = path.join(TMP_DIR, 'commands-ok.jsonl');
  try { fs.unlinkSync(commandsLog); } catch { /* first run */ }

  // Script the brain exactly like the real flow: open → (observation) → type →
  // (observation) → an explicit observe → complete. The extra observe mirrors
  // what the real brain does before claiming success (#11).
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'open_application', params: { name: 'notepad' } }, reason: 'open Notepad', userMessage: 'Opening Notepad…' },
    { type: 'action', action: { type: 'type', params: { text: 'Hello from DARKMATTER' } }, reason: 'type the requested text', userMessage: 'Typing text…' },
    { type: 'observe', method: 'active_window', reason: 'verify the text landed', userMessage: 'Verifying document…' },
    {
      type: 'complete',
      reason: 'observation shows Notepad active and text typed',
      verificationEvidence: 'Typed 21 character(s) while active window "Untitled - Notepad (launched)"',
      userMessage: 'Typed "Hello from DARKMATTER" into Notepad.'
    }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-1', instruction: 'Open Notepad and type Hello from DARKMATTER' });

  const completed = await waitForStatus(stack.manager, taskId, ['completed']);
  assert.ok(completed, 'task must complete');

  // REAL bridge traffic (scripted bridge, but the actions left the adapter).
  const commands = fs.readFileSync(commandsLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const cmds = commands.map((c) => c.cmd);
  assert.ok(cmds.includes('open_application'), `bridge saw open_application: ${cmds.join(',')}`);
  assert.equal(commands.find((c) => c.cmd === 'open_application').params.name, 'notepad');
  assert.ok(cmds.includes('type'), 'bridge saw type');
  assert.equal(commands.find((c) => c.cmd === 'type').params.text, 'Hello from DARKMATTER');
  assert.ok(cmds.includes('get_active_window'), 'observation after action happened');
  // The fake-success guard: at least two explicit observations before completion.
  const observationCount = cmds.filter((c) => c.cmd === 'get_active_window').length;
  assert.ok(observationCount >= 3, `observation ran after every action (${observationCount})`);

  // Persisted state is complete + honest.
  const task = await stack.taskModel.get(taskId);
  assert.equal(task.status, 'completed');
  assert.equal(task.verificationStatus, 'verified');
  assert.equal(task.generatedContent, 'Hello from DARKMATTER');
  assert.ok(task.completedActions.length >= 2);
  assert.equal(task.currentApplication, 'Notepad');
  assert.ok(task.finalMessage.includes('Hello from DARKMATTER'));

  // The user instruction was persisted with the task link, and the completion
  // was mirrored into the InfiniteChat conversation.
  const chatModel = new InfiniteChatModel(stack.database);
  await chatModel.appendMessages('u1', 'conv-1', [{ role: 'user', content: 'Open Notepad and type Hello from DARKMATTER', computerTaskId: taskId }]);
  const chat = await chatModel.get('u1', 'conv-1');
  const mirrored = chat.messages.filter((m) => m.role === 'assistant');
  assert.ok(mirrored.length >= 1, 'completion mirrored to chat');
  assert.ok(
    chat.messages.some((m) => m.role === 'user' && m.computerTaskId === taskId),
    'user instruction present in conversation with task link'
  );

  // Events for the SSE stream exist.
  const events = await stack.eventService.list(taskId);
  const types = events.map((e) => e.type);
  for (const expected of ['task.created', 'task.started', 'task.action_started', 'task.observation', 'task.completed']) {
    assert.ok(types.includes(expected), `event ${expected} published (got: ${types.join(',')})`);
  }
});

test('INTEGRATION policy: the brain CANNOT open a blocked application even if it tries', async () => {
  const stack = buildStack();
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'open_application', params: { name: 'registry editor' } }, reason: 'user asked', userMessage: 'Opening…' },
    {
      type: 'complete',
      reason: 'blocked and refused',
      verificationEvidence: 'Action rejected by policy',
      userMessage: 'I cannot open the registry editor — that application is blocked by policy.'
    }
  );

  const { taskId } = await createTestTask(stack.manager, {
    userId: 'u1', conversationId: 'conv-2', instruction: 'Open registry editor'
  });

  const completed = await waitForStatus(stack.manager, taskId, ['completed']);
  assert.ok(completed, 'task should end after the refusal');

  const task = await stack.taskModel.get(taskId);
  assert.ok(task.errors.some((e) => /Policy violation/.test(e.message)), 'policy violation recorded');
  // The bridge NEVER saw the command:
  const log = path.join(TMP_DIR, 'commands-ok.jsonl');
  const commands = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  assert.ok(!commands.some((c) => c.params?.name && /registry/i.test(c.params.name)), 'registry editor must never reach the bridge');
});

test('INTEGRATION schema-gate: a malformed-brain action is rejected and never executed', async () => {
  const stack = buildStack();
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'press_key', params: { keys: ['not_a_real_key'] } }, reason: 'oops', userMessage: 'Pressing…' },
    { type: 'observe', method: 'active_window', reason: 'see current state after the rejection', userMessage: 'Observing…' },
    { type: 'action', action: { type: 'type', params: { text: 'recovered' } }, reason: 'switch to typing', userMessage: 'Typing…' },
    { type: 'complete', reason: 'ok', verificationEvidence: 'Typed 9 characters while "Untitled - Notepad (launched)" active', userMessage: 'Done.' }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-3', instruction: 'Open Notepad and type recovered' });

  const completed = await waitForStatus(stack.manager, taskId, ['completed']);
  assert.ok(completed, 'task recovers after a schema rejection');

  const task = await stack.taskModel.get(taskId);
  assert.ok(
    task.errors.some((e) => /unsupported key|press_key received/i.test(e.message)),
    'schema rejection recorded'
  );
  const log = fs.readFileSync(path.join(TMP_DIR, 'commands-ok.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(!log.some((c) => c.cmd === 'press_key' && JSON.stringify(c.params.keys).includes('not_a_real_key')), 'invalid key never reached the bridge');
  assert.ok(log.some((c) => c.cmd === 'type' && c.params.text === 'recovered'), 'the follow-up action DID run');
});

test('INTEGRATION self-correction: a bridge-level failure is observed, completion is refused, and the brain adapts', async () => {
  // Degraded bridge: pyautogui missing → input actions fail at the adapter.
  const stack = buildStack({ bridgeFile: writeFakeBridge({ pyautoguiAvailable: false }) });
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'type', params: { text: 'will fail' } }, reason: 'try typing', userMessage: 'Typing…' },
    // The brain TRIES to claim success right after the failure — must be refused.
    { type: 'complete', reason: 'fake success attempt', verificationEvidence: 'it failed but whatever', userMessage: 'All done!' },
    // Then it recovers with a real alternative: observe the desktop.
    { type: 'observe', method: 'active_window', reason: 'see what is on screen', userMessage: 'Observing…' },
    {
      type: 'complete',
      reason: 'honest failure reported after observation',
      verificationEvidence: 'Active window: "Untitled - Notepad"',
      userMessage: 'Typing failed: input simulation is unavailable on this machine.'
    }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-4', instruction: 'type into notepad' });

  const completed = await waitForStatus(stack.manager, taskId, ['completed']);
  assert.ok(completed, 'task ends with an honest outcome');

  const task = await stack.taskModel.get(taskId);
  assert.ok(
    task.errors.some((e) => /unavailable/i.test(e.message)),
    'the failure was recorded honestly, not faked as success'
  );
  assert.ok(
    task.errors.some((e) => /Completion refused/.test(e.message)),
    'the fake-success attempt was explicitly refused'
  );
  assert.ok(!task.finalMessage?.includes('All done!'), 'the fake completion message was never persisted');
});

test('INTEGRATION waiting_ai: busy phone parks the task and auto-resumes (no cloud fallback)', async () => {
  const stack = buildStack();
  stack.phoneModel.busy = true;
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'open_application', params: { name: 'notepad' } }, reason: 'open', userMessage: 'Opening Notepad…' },
    { type: 'complete', reason: 'ok', verificationEvidence: 'Notepad window active', userMessage: 'Notepad is open.' }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-5', instruction: 'Open Notepad' });

  const waiting = await waitForStatus(stack.manager, taskId, ['waiting_ai']);
  assert.ok(waiting, 'task parks in waiting_ai while the phone is busy');
  assert.match(waiting.waitingReason, /LOCAL AI BUSY/i);
  assert.equal(waiting.brainStatus, 'waiting');

  // The phone frees up.
  stack.phoneModel.busy = false;
  const completed = await waitForStatus(stack.manager, taskId, ['completed'], 10000);
  assert.ok(completed, 'task auto-resumes when the local AI frees up');
  const task = await stack.taskModel.get(taskId);
  assert.equal(task.status, 'completed');
  // The queue was used — no second provider exists anywhere in this path.
  assert.equal(stack.brain.provider.constructor.name, 'FakeTaskPhoneModel');
});

test('INTEGRATION ask_user: brain parks for a human answer and resumes with it', async () => {
  const stack = buildStack();
  stack.phoneModel.responses.push(
    { type: 'ask_user', reason: 'need the folder', question: 'Where should I save the file?' },
    (messages) => {
      // The second decide() must see the user's answer in its prompt.
      const userMsg = messages.map((m) => m.content).join('\n');
      return {
        type: 'complete',
        reason: 'user answered',
        verificationEvidence: 'Active window "Untitled - Notepad (launched)"',
        userMessage: userMsg.includes('C:\\Documents') ? 'Saved per your answer.' : 'Answer not received!'
      };
    }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-6', instruction: 'Save my file' });

  const parked = await waitForStatus(stack.manager, taskId, ['ask_user']);
  assert.ok(parked, 'task parks in ask_user');
  assert.ok(parked.answer.includes('Where should I save the file?'));

  // Events carried the question.
  const events = await stack.eventService.list(taskId);
  assert.ok(events.some((e) => e.type === 'task.ask_user'));

  await stack.manager.answer('u1', taskId, 'C:\\Documents');
  const completed = await waitForStatus(stack.manager, taskId, ['completed']);
  assert.ok(completed, 'task resumes after the answer');
  const task = await stack.taskModel.get(taskId);
  assert.ok(task.finalMessage.includes('Saved per your answer.'), 'the brain actually RECEIVED the answer');
});

test('INTEGRATION cancel: Stop Task halts between actions and persists CANCELLED', async () => {
  const stack = buildStack();
  // A long scripted queue: the task will not run out of steps before we cancel.
  for (let i = 0; i < 40; i++) {
    stack.phoneModel.responses.push({
      type: 'action',
      action: { type: 'press_key', params: { keys: ['space'] } },
      reason: `step ${i}`,
      userMessage: `Step ${i}`
    });
  }

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-7', instruction: 'keep pressing space' });
  await waitFor(() => {
    const t = stack.worker.isRunning(taskId);
    return t;
  });

  const result = await stack.manager.cancel('u1', taskId);
  assert.equal(result.status, 'cancelling');

  const cancelled = await waitForStatus(stack.manager, taskId, ['cancelled']);
  assert.ok(cancelled, 'task reaches cancelled');
  const task = await stack.taskModel.get(taskId);
  assert.equal(task.status, 'cancelled');
  assert.ok(task.completedAt || task.cancelledAt);
  // The loop actually stopped:
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(stack.worker.isRunning(taskId), false, 'worker exited the loop');
});

test('INTEGRATION no-progress: a spinning identical loop fails honestly instead of running forever', async () => {
  const stack = buildStack();
  // The brain repeats the exact same action; the observation never changes.
  for (let i = 0; i < 10; i++) {
    stack.phoneModel.responses.push({
      type: 'action',
      action: { type: 'press_key', params: { keys: ['f24'] } },
      reason: 'try again',
      userMessage: 'Pressing…'
    });
  }
  process.env.TASK_NO_PROGRESS_REPEAT_LIMIT = '4';
  try {
    const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-8', instruction: 'do a thing' });
    const failed = await waitForStatus(stack.manager, taskId, ['failed']);
    assert.ok(failed, 'no-progress guard fires');
    assert.ok(
      failed.errors.some((e) => /no progress/.test(e.message)),
      'real reason recorded: ' + JSON.stringify(failed.errors)
    );
  } finally {
    process.env.TASK_NO_PROGRESS_REPEAT_LIMIT = '6';
  }
});

test('INTEGRATION follow-up: prior task content reaches the brain for "make it more formal"', async () => {
  const stack = buildStack();

  // Task 1: write the leave application.
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'open_application', params: { name: 'MS Word' } }, reason: 'open word', userMessage: 'Opening Microsoft Word…' },
    { type: 'action', action: { type: 'type', params: { text: 'To,\nThe Manager\n...regarding leave for two days...' } }, reason: 'write the application', userMessage: 'Writing the application…' },
    { type: 'complete', reason: 'application written', verificationEvidence: 'Active window "Document1 - Word (launched)"; typed 52 chars', userMessage: 'Leave application written in Word.' }
  );
  const first = await stack.manager.createTask({
    userId: 'u1', conversationId: 'conv-9', instruction: 'Open MS Word and write a leave application for two days'
  });
  await waitForStatus(stack.manager, first.id, ['completed']);

  // Task 2: follow-up — the scripted brain ECHOES what it saw of the prior task.
  const captured = [];
  stack.phoneModel.responses.push((messages) => {
    captured.push(messages.map((m) => m.content).join('\n'));
    return {
      type: 'complete',
      reason: 'formalized',
      verificationEvidence: 'Typed 12 chars; window still "Document1 - Word (launched)"',
      userMessage: 'Made it more formal.'
    };
  });

  const followUp = await stack.manager.createTask({
    userId: 'u1', conversationId: 'conv-9', instruction: 'Make it more formal'
  });
  assert.equal(followUp.previousTaskId, first.id, 'follow-up is chained to the prior task');

  await waitForStatus(stack.manager, followUp.id, ['completed']);
  const prompt = captured[0] || '';
  assert.ok(prompt.includes('CURRENT TASK CONTEXT'), 'brain receives prior-task context');
  assert.ok(prompt.includes('leave application for two days'), 'brain sees the prior instruction');
  assert.ok(prompt.includes('regarding leave for two days'), 'brain sees the verbatim generated content');
  assert.ok(prompt.includes('Microsoft Word'), 'brain sees the application in use');

  const followUpTask = await stack.taskModel.get(followUp.id);
  assert.equal(followUpTask.status, 'completed');
});

test('INTEGRATION recovery: backend restart picks non-terminal tasks back up', async () => {
  const stack = buildStack();
  stack.phoneModel.busy = true; // park the task in waiting_ai
  stack.phoneModel.responses.push(
    { type: 'complete', reason: 'ok', verificationEvidence: 'window seen', userMessage: 'Recovered.' }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-10', instruction: 'Open Notepad' });
  const parked = await waitForStatus(stack.manager, taskId, ['waiting_ai']);
  assert.ok(parked, 'precondition: task parked in waiting_ai');

  // Simulate the restart path: the worker's loop is stopped (as after a process
  // exit), then boot recovery must re-dispatch the non-terminal task.
  stack.worker.stopped = true;
  stack.worker.running.delete(taskId);
  await stack.taskModel.update(taskId, { status: 'waiting_ai', waitingReason: 'LOCAL AI BUSY (simulated restart)' });

  stack.worker.stopped = false;
  const recovery = await stack.manager.recoverIncompleteTasks();
  assert.ok(recovery.recovered >= 1, 'the waiting task is recovered');

  stack.phoneModel.busy = false;
  const completed = await waitForStatus(stack.manager, taskId, ['completed'], 12000);
  assert.ok(completed, 'recovered task finishes after the phone frees');
});

test('INTEGRATION computer-runtime-down: computer unavailable parks the task in waiting_computer', async () => {
  const stack = buildStack({ bridgeFile: path.join(TMP_DIR, 'does-not-exist.cjs') });
  stack.phoneModel.responses.push(
    { type: 'action', action: { type: 'open_application', params: { name: 'notepad' } }, reason: 'open', userMessage: 'Opening…' },
    { type: 'complete', reason: 'ok', verificationEvidence: 'window', userMessage: 'Done.' }
  );

  const { taskId } = await createTestTask(stack.manager, { userId: 'u1', conversationId: 'conv-11', instruction: 'Open Notepad' });

  const waiting = await waitForStatus(stack.manager, taskId, ['waiting_computer']);
  assert.ok(waiting, 'computer outage parks the task (retries, no fake failure)');
  assert.match(waiting.waitingReason, /computer bridge not found/i);

  // The phone answers but the computer is still down → stays waiting, never completes.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const stillWaiting = await stack.taskModel.get(taskId);
  assert.ok(
    ['waiting_computer', 'continue', 'executing', 'understanding', 'resuming'].includes(stillWaiting.status),
    `honest waiting state, got: ${stillWaiting.status}`
  );

  await stack.manager.cancel('u1', taskId);
  await waitForStatus(stack.manager, taskId, ['cancelled']);
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — the REAL bridge (not scripted) must report true capabilities
// ══════════════════════════════════════════════════════════════════════════

test('REAL BRIDGE: python bridge probe reports true capabilities (never faked)', () => {
  if (!fs.existsSync(BRIDGE_PATH)) {
    assert.fail(`Real bridge missing at ${BRIDGE_PATH}`);
  }
  const venvPython = path.join(path.dirname(BRIDGE_PATH), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');
  const bin = fs.existsSync(venvPython) ? venvPython : 'python';
  const result = spawnSync(bin, [BRIDGE_PATH, '--probe'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  assert.equal(result.status, 0, `probe failed: ${result.stderr}`);
  const line = String(result.stdout || '').trim().split('\n').filter(Boolean).pop();
  const payload = JSON.parse(line);
  assert.equal(payload.ok, true);
  assert.equal(payload.result.neverCallsLlm, true);
  assert.equal(payload.result.shellAccess, false);
  assert.ok(Array.isArray(payload.result.actions) && payload.result.actions.includes('screenshot'));
});
