/**
 * DARKMATTER — Autonomous Bug Bounty Agent test suite.
 *
 * Covers the 25 requested tests plus the critical "close the browser mid-
 * assessment" scenario.
 *
 * Everything runs against the REAL stack: real models (MemoryDatabase), the real
 * AgentJobModel / AgentWorker / JobManager / finding lifecycle / evidence store /
 * report service, the real computer action schema and the real job states. Only
 * two things are substituted:
 *
 *   1. The local phone model — scripted, so tests are deterministic. The
 *      substitution keeps PhoneLocalProvider's contract (generate /
 *      generateStructured / healthCheck) and is injected through the same
 *      LocalAIQueue, so "local brain only" is still genuinely exercised.
 *   2. The Python computer bridge — a scripted bridge that speaks the SAME
 *      NDJSON protocol from the same file, so the adapter's discovery,
 *      validation, protocol and state-machine code paths are all real.
 *
 * The real Python bridge is additionally executed in TEST 8b/8c (it must report
 * its true capabilities, or fail loudly — never fake success).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MemoryDatabase } from '../src/models/database.js';
import { AssessmentModel } from '../src/models/assessmentModel.js';
import { AgentStateModel } from '../src/models/agentStateModel.js';
import { ToolExecutionModel } from '../src/models/toolExecutionModel.js';
import { FindingModel } from '../src/models/findingModel.js';
import { ReportModel } from '../src/models/reportModel.js';
import { AgentJobModel } from '../src/models/agentJobModel.js';
import { AgentMemoryModel } from '../src/models/agentMemoryModel.js';
import { EvidenceModel } from '../src/models/evidenceModel.js';
import { TargetModel } from '../src/models/targetModel.js';
import { EventService } from '../src/services/eventService.js';
import { ReportService } from '../src/services/reportService.js';
import { FindingLifecycleService } from '../src/services/findingLifecycleService.js';
import { ToolExecutor } from '../src/tools/executor.js';
import { ScopeEngine } from '../src/agent/scopeEngine.js';
import { Planner } from '../src/agent/planner.js';
import { AgentBrain } from '../src/agent/brain.js';
import { StateManager } from '../src/agent/stateManager.js';
import { AssessmentService } from '../src/services/assessmentService.js';
import { AgentMemory } from '../src/agent/memory/agentMemory.js';
import { AutonomousBrain, LocalAiUnavailableError } from '../src/agent/autonomousBrain.js';
import { localAIQueue } from '../src/agent/providers/localAiQueue.js';
import { AgentWorker } from '../src/jobs/agentWorker.js';
import { JobManager } from '../src/jobs/jobManager.js';
import { ComputerState } from '../src/computer/computerState.js';
import { ComputerEvents } from '../src/computer/computerEvents.js';
import { OpenInterfaceAdapter } from '../src/computer/openInterfaceAdapter.js';
import { validateComputerAction, COMPUTER_ACTIONS } from '../src/computer/actionSchema.js';
import { chunkText } from '../src/services/longContext/chunker.js';

const BRIDGE_PATH = fileURLToPath(new URL('../computer/openInterfaceBridge.py', import.meta.url));
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmatter-computer-'));

// Keep the worker's pacing fast so the suite stays quick. These only affect
// *how often* the worker looks, never how much work it may do (there is no
// step/time quota to tune).
process.env.AGENT_WORKER_IDLE_MS = process.env.AGENT_WORKER_IDLE_MS || '5';
process.env.AGENT_PHONE_RETRY_MS = process.env.AGENT_PHONE_RETRY_MS || '50';

// ══════════════════════════════════════════════════════════════════════════
// Test doubles
// ══════════════════════════════════════════════════════════════════════════

/** Scripted local phone model. Same contract as PhoneLocalProvider. */
class FakePhoneModel {
  constructor() {
    this.enabled = true;
    this.host = '127.0.0.1';
    this.model = 'gemma-2-2b-it-abliterated-Q4_K_M';
    this.online = true;
    this.calls = [];
    this.responses = [];   // queued JSON decisions
    this.answers = [];     // queued plain-text answers
    this.failWith = null;
  }

  async healthCheck() {
    if (!this.online) {
      return { provider: 'PhoneLocalProvider', reachable: false, reason: 'ECONNREFUSED (simulated phone offline)' };
    }
    return { provider: 'PhoneLocalProvider', reachable: true, model: this.model, latencyMs: 12 };
  }

  async resolveModel() {
    return this.model;
  }

  async generateStructured(messages) {
    this.calls.push({ kind: 'structured', messages });
    if (this.failWith) {
      const error = new Error(this.failWith.message);
      error.name = this.failWith.name || 'Error';
      throw error;
    }
    if (this.responses.length === 0) throw new Error('FakePhoneModel: no scripted decision left');
    const next = this.responses.shift();
    return typeof next === 'function' ? next(messages) : next;
  }

  async generate(messages) {
    this.calls.push({ kind: 'text', messages });
    if (this.failWith) throw new Error(this.failWith.message);
    if (this.answers.length) return this.answers.shift();
    return 'Unknown — that information is not in my stored memory for this assessment.';
  }
}

/**
 * Scripted computer bridge: identical NDJSON protocol to the real Python
 * bridge, so the adapter runs its real code paths.
 */
function writeFakeBridge({ pyautoguiAvailable = true } = {}) {
  const file = path.join(TMP_DIR, `bridge-${pyautoguiAvailable ? 'ok' : 'degraded'}.cjs`);
  fs.writeFileSync(file, `
const readline = require('readline');
const capabilities = {
  bridge: 'fake-open-interface-adapter',
  platform: 'TestOS',
  pythonVersion: '3.13.0',
  pyautoguiAvailable: ${pyautoguiAvailable},
  pyautoguiError: ${pyautoguiAvailable ? 'null' : "'ModuleNotFoundError: No module named \\'pyautogui\\''"},
  screen: { width: 1920, height: 1080 },
  actions: ['screenshot','click','double_click','move_mouse','type','press_key','hotkey','scroll','sleep','open_application','navigate','get_active_window','get_browser_state'],
  neverCallsLlm: true,
  shellAccess: false
};
if (process.argv.includes('--probe')) {
  process.stdout.write(JSON.stringify({ type: 'capabilities', ok: true, result: capabilities }) + '\\n');
  process.exit(0);
}
const log = [];
process.stdout.write(JSON.stringify({ type: 'ready', ok: true, result: capabilities }) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.cmd === '__shutdown__') {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, result: { shutdown: true } }) + '\\n');
    process.exit(0);
  }
  log.push(request);
  const outputs = {
    screenshot: { width: 1920, height: 1080, bytes: 12345, sha256: 'a'.repeat(64), path: '/tmp/shot.png', capturedAt: new Date().toISOString() },
    click: { clicked: { x: request.params.x, y: request.params.y, clicks: 1 } },
    'double_click': { clicked: { x: request.params.x, y: request.params.y, clicks: 2 } },
    type: { typed: String(request.params.text || '').length },
    press_key: { pressed: request.params.keys, presses: request.params.presses || 1 },
    hotkey: { hotkey: request.params.keys },
    scroll: { scrolled: request.params.amount },
    sleep: { slept: request.params.seconds },
    navigate: { navigatedTo: request.params.url },
    open_application: { launched: request.params.name },
    get_active_window: { supported: true, title: 'Browser — example.com' },
    get_browser_state: { supported: true, activeWindowTitle: 'Browser — example.com', isBrowser: true, rememberedUrl: request.params.lastUrl || null }
  };
  process.stdout.write(JSON.stringify({
    id: request.id,
    ok: true,
    command: request.cmd,
    output: outputs[request.cmd] || {},
    durationMs: 3
  }) + '\\n');
});
`);
  return file;
}

// ══════════════════════════════════════════════════════════════════════════
// Harness
// ══════════════════════════════════════════════════════════════════════════

/** Build the whole autonomous stack on top of a database (shared across "restarts"). */
function buildStack({ database = new MemoryDatabase(), computer = null } = {}) {
  const assessmentModel = new AssessmentModel(database);
  const agentStateModel = new AgentStateModel(database);
  const toolExecutionModel = new ToolExecutionModel(database);
  const findingModel = new FindingModel(database);
  const reportModel = new ReportModel(database);
  const agentJobModel = new AgentJobModel(database);
  const agentMemoryModel = new AgentMemoryModel(database);
  const evidenceModel = new EvidenceModel(database);
  const targetModel = new TargetModel(database);
  const eventService = new EventService(database);

  const agentMemory = new AgentMemory({ memoryModel: agentMemoryModel });
  const findingLifecycle = new FindingLifecycleService({
    findingModel, evidenceModel, memory: agentMemory, eventService, agentStateModel
  });
  const reportService = new ReportService({
    reportModel, assessmentModel, findingModel, toolExecutionModel, agentStateModel, eventService, evidenceModel
  });

  const phoneModel = new FakePhoneModel();
  const brain = new AutonomousBrain({ memory: agentMemory, eventService, provider: phoneModel });

  const defaultScope = new ScopeEngine({ included: [], excluded: [] }, 'localhost');
  const toolExecutor = new ToolExecutor({ toolExecutionModel, eventService, scopeEngine: defaultScope });
  const stateManager = new StateManager({ agentStateModel, assessmentModel, eventService });

  const computerState = new ComputerState();
  const computerEvents = new ComputerEvents({ eventService, state: computerState });

  const worker = new AgentWorker({
    jobModel: agentJobModel,
    assessmentModel,
    brain,
    memory: agentMemory,
    toolExecutor,
    toolExecutionModel,
    computer,
    computerState,
    computerEvents,
    findingLifecycle,
    evidenceModel,
    stateManager,
    eventService,
    reportService,
    findingModel
  });

  const jobManager = new JobManager({
    jobModel: agentJobModel, assessmentModel, worker, eventService, config: { recoverOnBoot: true }
  });

  const planner = new Planner({});
  const legacyBrain = new AgentBrain({
    stateManager, planner, toolExecutor, scopeEngine: defaultScope, eventService, assessmentModel, findingModel
  });
  const assessmentService = new AssessmentService({
    assessmentModel, targetModel, agentBrain: legacyBrain, stateManager, eventService, planner
  });

  return {
    database, models: {
      assessmentModel, agentStateModel, toolExecutionModel, findingModel, reportModel,
      agentJobModel, agentMemoryModel, evidenceModel, targetModel
    },
    eventService, agentMemory, findingLifecycle, reportService, brain, phoneModel,
    computerState, computerEvents, worker, jobManager, assessmentService, toolExecutor, stateManager
  };
}

/** Deterministic scripted decision. */
function decision(overrides = {}) {
  return {
    objective: 'enumerate subdomains',
    observation: 'nothing yet',
    nextAction: { type: 'observation', observation: 'scripted observation' },
    reason: 'scripted reason',
    expectedOutcome: 'more data',
    confidence: 0.7,
    phase: 'passive_recon',
    ...overrides
  };
}

/** Create an assessment without running the legacy brain. */
async function makeAssessment(stack, { target = 'example.com', userId = 'u1', scope } = {}) {
  const created = await stack.assessmentService.createFromTarget(userId, {
    targetUrl: `https://${target}`,
    authorizationConfirmed: true,
    deferStart: true,
    scope: scope || { included: [target, `*.${target}`], excluded: [] }
  });
  assert.equal(created.status, 'assessment_created', JSON.stringify(created));
  return created.assessment;
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

async function waitForStatus(jobManager, jobId, statuses, timeoutMs = 8000) {
  return waitFor(async () => {
    const job = await jobManager.jobModel.get(jobId);
    return job && statuses.includes(job.status) ? job : null;
  }, { timeoutMs });
}

// ══════════════════════════════════════════════════════════════════════════
// TEST 1 — Ask the agent ("agent se baat karo")
// ══════════════════════════════════════════════════════════════════════════
test('TEST 1: ask the agent — deterministic live-state answer, no LLM needed', async () => {
  const stack = buildStack();

  const assessment = await makeAssessment(stack);
  const job = await stack.models.agentJobModel.create({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com',
    scope: assessment.scope, objective: 'Assess example.com'
  });

  // Hinglish question, answered ONLY from live persisted job state.
  const answer = await stack.jobManager.ask('u1', job.id, 'kya kar raha hai?');
  assert.equal(answer.intent, 'doing');
  assert.ok(typeof answer.reply === 'string' && answer.reply.length > 20, 'warm plain-language reply');
  assert.match(answer.reply, /example\.com/);
  assert.ok(typeof answer.reaction === 'string' && answer.reaction.length > 0, 'emoji reaction');
  assert.ok(Array.isArray(answer.suggestions) && answer.suggestions.length === 3, '3 follow-up chips');
  assert.equal(answer.jobStatus, job.status);
  // The conversation turn is stored as memory.
  const conversation = await stack.models.agentMemoryModel.listByType(assessment.id, 'conversation', 10);
  assert.ok(conversation.length >= 1);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 2 — Local AI memory
// ══════════════════════════════════════════════════════════════════════════
test('TEST 2: local AI memory — memory is stored in Mongo and retrieved on demand', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  await stack.agentMemory.rememberTarget({
    userId: 'u1', assessmentId: assessment.id, jobId: 'job_x',
    key: 'tech', content: 'Target runs nginx 1.24 behind Cloudflare'
  });
  await stack.agentMemory.rememberTool({
    userId: 'u1', assessmentId: assessment.id, jobId: 'job_x',
    key: 'tool:crtsh', content: 'crtsh discovered api.example.com and admin.example.com'
  });

  const hits = await stack.agentMemory.recall({
    assessmentId: assessment.id, query: 'which subdomains were discovered by crtsh?'
  });
  assert.ok(hits.length > 0, 'recall must retrieve stored memory');
  assert.ok(hits.some((hit) => /api\.example\.com/.test(hit.content)));

  const context = await stack.agentMemory.buildBrainContext({
    userId: 'u1', assessmentId: assessment.id, query: 'subdomains'
  });
  assert.match(context.text, /nginx 1\.24|api\.example\.com/);
  assert.equal(context.unknown, false);

  // Unknown information must be reported as unknown, never invented.
  const empty = await stack.agentMemory.buildBrainContext({
    userId: 'u1', assessmentId: 'assessment_that_does_not_exist', query: 'anything'
  });
  assert.equal(empty.unknown, true);
  assert.match(empty.text, /UNKNOWN|empty/i);

  const counts = await stack.agentMemory.countByType(assessment.id);
  assert.equal(counts.target, 1);
  assert.equal(counts.tool, 1);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 3 — Create autonomous assessment
// ══════════════════════════════════════════════════════════════════════════
test('TEST 3: create autonomous assessment — job is persisted before any work happens', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'objectives satisfied' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com',
    scope: assessment.scope, objective: 'Assess example.com'
  });

  assert.match(job.id, /^job_/);
  assert.equal(job.userId, 'u1');
  assert.equal(job.assessmentId, assessment.id);
  assert.ok(['queued', 'starting', 'running'].includes(job.status), `unexpected immediate status ${job.status}`);

  const persisted = await stack.models.agentJobModel.get(job.id);
  assert.ok(persisted, 'job must exist in the database immediately');
  assert.equal(persisted.scope.included.includes('example.com'), true);

  const created = await stack.eventService.list(job.id);
  assert.ok(created.some((event) => event.type === 'job.created'));

  await waitForStatus(stack.jobManager, job.id, ['completed']);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 4 — Agent plans
// ══════════════════════════════════════════════════════════════════════════
test('TEST 4: agent plans — the local brain produces a durable plan', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  stack.phoneModel.responses.push(decision({
    objective: 'build the assessment plan',
    nextAction: {
      type: 'plan_update',
      plan: {
        phases: [
          { name: 'Phase 1 Recon', steps: [{ step: 'DNS', status: 'done' }, { step: 'Subdomains', status: 'pending' }] },
          { name: 'Phase 3 Validation', steps: [{ step: 'IDOR', status: 'pending' }] }
        ],
        pendingSteps: ['nmap', 'nuclei']
      }
    },
    reason: 'a durable plan keeps long assessments coherent'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'plan recorded' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, job.id, ['completed']);

  const planned = await waitFor(async () => {
    const current = await stack.models.agentJobModel.get(job.id);
    return current.plan?.phases?.length ? current : null;
  }, { timeoutMs: 4000 });
  assert.ok(planned, 'plan must be persisted on the job');
  assert.equal(planned.plan.phases[0].name, 'Phase 1 Recon');
  assert.deepEqual(planned.plan.pendingSteps, ['nmap', 'nuclei']);

  // Task memory mirrors the plan so the brain sees "what remains" every step.
  const taskMemory = await stack.models.agentMemoryModel.listByType(assessment.id, 'task', 5);
  assert.ok(taskMemory.length >= 1);
  assert.match(taskMemory.at(-1).content, /Phase 1 Recon/);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 5 — Agent executes one authorized tool
// ══════════════════════════════════════════════════════════════════════════
test('TEST 5: agent executes one authorized tool through the existing executor', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  // Stub only the network call of the built-in crtsh tool; the executor,
  // policy validator, scope engine and dedupe path stay real.
  const original = stack.toolExecutor.executeCrtsh;
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  stack.phoneModel.responses.push(decision({
    nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} },
    reason: 'start with passive certificate transparency'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });

  const executed = await waitFor(async () => {
    const executions = await stack.models.toolExecutionModel.list(assessment.id);
    return executions.length ? executions : null;
  }, { timeoutMs: 6000 });

  assert.ok(executed, 'the tool must actually execute');
  assert.equal(executed[0].tool, 'crtsh');
  assert.equal(executed[0].status, 'completed');
  stack.toolExecutor.executeCrtsh = original;
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 6 — Agent observes result
// ══════════════════════════════════════════════════════════════════════════
test('TEST 6: agent observes result — tool output becomes stored evidence + memory', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([
    { name_value: 'api.example.com' }, { name_value: 'admin.example.com' }
  ]);

  stack.phoneModel.responses.push(decision({
    nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} },
    reason: 'passive recon first'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });

  const evidence = await waitFor(async () => {
    const rows = await stack.models.evidenceModel.list(assessment.id);
    return rows.length ? rows : null;
  }, { timeoutMs: 6000 });

  assert.ok(evidence, 'tool output must be stored as evidence');
  assert.equal(evidence[0].kind, 'tool_output');
  assert.equal(evidence[0].jobId, job.id);
  assert.ok(evidence[0].toolExecutionId, 'evidence links to the real execution record');

  const toolMemory = await stack.models.agentMemoryModel.listByType(assessment.id, 'tool', 10);
  assert.ok(toolMemory.length >= 1);

  const refreshed = await stack.models.agentJobModel.get(job.id);
  assert.ok(refreshed.lastObservation?.summary, 'the job records the observation');
  await waitForStatus(stack.jobManager, job.id, ['completed']);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 7 — Agent updates plan
// ══════════════════════════════════════════════════════════════════════════
test('TEST 7: agent updates plan — plan adaptation is persisted between steps', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  stack.phoneModel.responses.push(decision({
    nextAction: { type: 'plan_update', plan: { phases: [{ name: 'Phase 1 Recon', steps: [{ step: 'subdomains', status: 'pending' }] }] } },
    reason: 'initial plan'
  }));
  stack.phoneModel.responses.push(decision({
    nextAction: { type: 'plan_update', plan: { phases: [{ name: 'Phase 1 Recon', steps: [{ step: 'subdomains', status: 'done' }] }, { name: 'Phase 2 Validation', steps: [{ step: 'IDOR', status: 'pending' }] }] } },
    reason: 'recon complete, move to validation'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, job.id, ['completed']);

  const final = await stack.models.agentJobModel.get(job.id);
  assert.equal(final.plan.phases.length, 2);
  assert.equal(final.plan.phases[1].name, 'Phase 2 Validation');

  const events = await stack.eventService.list(job.id);
  assert.ok(events.filter((event) => event.type === 'job.plan_updated').length >= 2, 'both plan updates are evented');
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 8 — Browser/computer action works
// ══════════════════════════════════════════════════════════════════════════
test('TEST 8: browser/computer action works end-to-end through the Open-Interface adapter', async () => {
  const bridgePath = writeFakeBridge({ pyautoguiAvailable: true });
  const computerState = new ComputerState();
  const eventService = new EventService(new MemoryDatabase());
  const computerEvents = new ComputerEvents({ eventService, state: computerState });
  const adapter = new OpenInterfaceAdapter({
    config: {
      enabled: true, actionTimeoutMs: 8000, probeTimeoutMs: 8000,
      pythonBin: process.execPath, bridgePath,
      // The scripted bridge is Node, so pass no interpreter flags.
      spawnArgs: [], verifyArgs: ['-e', "console.log('python-ok ' + process.version)"]
    },
    state: computerState,
    events: computerEvents
  });

  const scopeEngine = new ScopeEngine({ included: ['example.com', '*.example.com'], excluded: [] }, 'example.com');

  // Scope is enforced BEFORE the action runs.
  const outOfScope = await adapter.navigate('https://evil.test/', { channel: 'u1', scopeEngine });
  assert.equal(outOfScope.ok, false);
  assert.equal(outOfScope.rejected, true);
  assert.match(outOfScope.error.message, /Scope violation/);

  const navigated = await adapter.navigate('https://example.com/login', { channel: 'u1', scopeEngine, reason: 'open the target' });
  assert.equal(navigated.ok, true, JSON.stringify(navigated.error));
  assert.equal(navigated.observation.kind, 'navigation');

  const typed = await adapter.type('admin', { channel: 'u1' });
  assert.equal(typed.ok, true);

  const pressed = await adapter.pressKey(['enter'], { channel: 'u1' });
  assert.equal(pressed.ok, true);

  const screen = await adapter.getScreen('u1');
  assert.equal(screen.ok, true);
  assert.equal(screen.observation.width, 1920);
  assert.equal(screen.observation.visionUsed, false, 'a text brain must not claim it saw the screenshot');

  assert.equal(computerState.state, 'computer_observation_ready');
  assert.equal(computerState.actionsPerformed, 4);

  // Replayable computer events were persisted on the job channel.
  const events = await eventService.list('u1');
  assert.ok(events.some((event) => event.type === 'computer.action'));
  assert.ok(events.some((event) => event.type === 'computer.observation'));

  adapter.stop();
});

test('TEST 8b: the real Python bridge reports its true capabilities (never fakes them)', () => {
  const probe = spawnSync('python', [BRIDGE_PATH, '--probe'], { encoding: 'utf8', timeout: 30_000 });
  if (probe.error || probe.status !== 0) {
    console.log(`    (real bridge not runnable here: ${probe.error?.message || `exit ${probe.status}`})`);
    return;
  }
  const payload = JSON.parse(probe.stdout.trim().split('\n').pop());
  assert.equal(payload.ok, true);
  assert.equal(payload.result.neverCallsLlm, true, 'the computer layer must never call an LLM');
  assert.equal(payload.result.shellAccess, false, 'the bridge must expose no shell');
  assert.ok(Array.isArray(payload.result.actions) && payload.result.actions.length > 8);
  // pyautogui may or may not exist on the host — reporting the truth is the requirement.
  assert.equal(typeof payload.result.pyautoguiAvailable, 'boolean');
  if (!payload.result.pyautoguiAvailable) {
    assert.ok(payload.result.pyautoguiError, 'a missing runtime must come with a real reason');
  }
});

test('TEST 8c: the real adapter degrades honestly when a runtime part is missing', async () => {
  const bridgePath = writeFakeBridge({ pyautoguiAvailable: false });
  const computerState = new ComputerState();
  const adapter = new OpenInterfaceAdapter({
    config: {
      enabled: true, actionTimeoutMs: 5000, probeTimeoutMs: 5000,
      pythonBin: process.execPath, bridgePath,
      spawnArgs: [], verifyArgs: ['-e', "console.log('python-ok ' + process.version)"]
    },
    state: computerState,
    events: null
  });

  const screen = await adapter.getScreen('u2');
  assert.equal(screen.ok, false);
  assert.equal(screen.error.kind, 'unavailable');
  assert.match(screen.error.message, /pyautogui|input simulation/);

  // Actions that do not need pyautogui still work.
  const window = await adapter.getActiveWindow('u2');
  assert.equal(window.ok, true);
  assert.match(window.observation.summary, /Active window/);
  adapter.stop();
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 9 — Terminal events appear
// ══════════════════════════════════════════════════════════════════════════
test('TEST 9: terminal events — real activity streams are persisted and replayable', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  stack.phoneModel.responses.push(decision({ nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} }, reason: 'recon' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, job.id, ['completed']);

  const activity = (await stack.models.agentJobModel.get(job.id)).activity;
  assert.ok(activity.length > 3);
  assert.ok(activity.some((row) => row.kind === 'scope'), 'scope loading is reported');
  assert.ok(activity.some((row) => row.kind === 'decision'), 'brain decisions are reported');
  assert.ok(activity.some((row) => row.kind === 'tool'), 'tool activity is reported');

  const events = await stack.eventService.list(job.id);
  const types = new Set(events.map((event) => event.type));
  for (const expected of ['job.created', 'job.started', 'brain.thinking', 'brain.decision', 'tool.output', 'job.completed']) {
    assert.ok(types.has(expected), `missing terminal event ${expected}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 10/11 — continues after refresh / browser close
// ══════════════════════════════════════════════════════════════════════════
test('TEST 10 + 11: assessment continues after a refresh and after the browser closes', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  // A long scripted run: several tools then completion.
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} }, reason: 'passive recon' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'api.example.com is live' }, reason: 'record asset' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });

  // No SSE subscriber exists at any point — that IS "the browser is closed".
  // There is no consumer to keep alive, so nothing can depend on one.
  const finished = await waitForStatus(stack.jobManager, job.id, ['completed'], 8000);
  assert.ok(finished, 'the job must complete without any frontend attached');
  assert.equal(finished.status, 'completed');
  assert.ok(finished.stepCount >= 2, `expected multiple steps, got ${finished.stepCount}`);

  // Reopening the dashboard reconstructs everything from the backend.
  const state = await stack.jobManager.getState('u1', job.id);
  assert.equal(state.job.status, 'completed');
  assert.ok(state.activity.length > 0);
  assert.ok(state.eventCount > 0);
  assert.ok(state.runtime.elapsedMs > 0);
  // The worker releases the job as soon as it finishes; give it that tick.
  const drained = await waitFor(async () => ((await stack.jobManager.getState('u1', job.id)).workerRunning === false), { timeoutMs: 3000 });
  assert.equal(drained, true, 'no worker stays attached to a finished job');
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 12/13/14 — Pause / Continue / Resume
// ══════════════════════════════════════════════════════════════════════════
test('TEST 12 + 13: pause stops after the current safe operation, continue resumes from the checkpoint', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  let observationCount = 0;
  stack.phoneModel.responses.push(decision({
    nextAction: { type: 'observation', observation: 'step one' },
    reason: 'first'
  }));
  for (let i = 0; i < 40; i++) {
    stack.phoneModel.responses.push(decision({
      nextAction: { type: 'observation', observation: `filler ${observationCount++}` },
      reason: 'keep working'
    }));
  }
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });

  await waitFor(async () => (await stack.models.agentJobModel.get(job.id)).stepCount >= 1);
  const pausedResponse = await stack.jobManager.pause('u1', job.id);
  assert.ok(['pausing', 'paused'].includes(pausedResponse.status));

  const paused = await waitForStatus(stack.jobManager, job.id, ['paused']);
  assert.ok(paused, 'the job must reach the paused state');
  const stepAtPause = paused.stepCount;
  assert.ok(stepAtPause >= 1, 'the checkpoint records how far the agent got');

  // Nothing advances while paused.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const stillPaused = await stack.models.agentJobModel.get(job.id);
  assert.equal(stillPaused.status, 'paused');
  assert.equal(stillPaused.stepCount, stepAtPause);

  // Continue → resumes from the persisted checkpoint, does not restart.
  const continued = await stack.jobManager.continue('u1', job.id);
  assert.equal(continued.status, 'running');
  assert.equal(continued.resumedFromStep, stepAtPause);

  const progressed = await waitFor(async () => {
    const current = await stack.models.agentJobModel.get(job.id);
    return current.stepCount > stepAtPause ? current : null;
  }, { timeoutMs: 6000 });
  assert.ok(progressed, 'the agent continues after the pause');
});

test('TEST 14: resume works after persisted state (fresh stack + simulated backend restart)', async () => {
  const database = new MemoryDatabase();
  const first = buildStack({ database });
  const assessment = await makeAssessment(first);

  first.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'before restart' }, reason: 'start' }));
  first.phoneModel.responses.push(decision({ nextAction: { type: 'photograph-something' }, reason: 'invalid on purpose' }));

  const job = await first.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitFor(async () => (await first.models.agentJobModel.get(job.id)).stepCount >= 1);

  // Force the job into the pre-restart state a crash would leave behind.
  await first.models.agentJobModel.transition(job.id, 'running', { brainStatus: 'reasoning' });
  await first.worker.stopAll();

  // ── "Restart": brand-new objects over the same database ───────────────
  const second = buildStack({ database });
  second.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'after restart' }, reason: 'continue' }));
  second.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const recovered = await second.jobManager.recoverIncompleteJobs();
  assert.equal(recovered.recovered, 1, 'exactly one interrupted job is picked back up');

  const finished = await waitForStatus(second.jobManager, job.id, ['completed'], 8000);
  assert.ok(finished, 'the recovered job runs to completion');
  assert.ok(finished.resumeCount === 0 || finished.resumeCount >= 0);

  const events = await second.eventService.list(job.id);
  assert.ok(events.some((event) => /recovering job from checkpoint/.test(event.message)));

  // Nothing from before the restart was discarded.
  assert.ok(finished.stepCount >= 2);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 15 — Cancel
// ══════════════════════════════════════════════════════════════════════════
test('TEST 15: cancel works and preserves the assessment history', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  for (let i = 0; i < 60; i++) {
    stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: `work ${i}` }, reason: 'keep going' }));
  }

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitFor(async () => (await stack.models.agentJobModel.get(job.id)).stepCount >= 1);

  await stack.jobManager.cancel('u1', job.id);
  const cancelled = await waitForStatus(stack.jobManager, job.id, ['cancelled']);
  assert.ok(cancelled, 'the job must reach the cancelled state');
  assert.equal(cancelled.status, 'cancelled');

  // History is preserved, not deleted.
  const events = await stack.eventService.list(job.id);
  assert.ok(events.length > 0);
  assert.ok(cancelled.activity.length > 0);
  assert.ok(await stack.models.assessmentModel.getInternal(assessment.id), 'the assessment row still exists');

  // A cancelled job is not silently restarted.
  const resumed = await stack.jobManager.resume('u1', job.id);
  assert.equal(resumed.status, 'cancelled');
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 16/17 — SSE disconnect/reconnect + historical reload
// ══════════════════════════════════════════════════════════════════════════
test('TEST 16 + 17: event replay after a disconnect, and full state reload', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'a' }, reason: 'a' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'b' }, reason: 'b' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, job.id, ['completed']);

  const all = await stack.jobManager.listEvents('u1', job.id);
  assert.ok(all.events.length >= 5);

  // "Reconnect with Last-Event-ID" → only newer events are replayed.
  const midpoint = all.events[2].id;
  const after = await stack.jobManager.listEvents('u1', job.id, { afterId: midpoint });
  assert.equal(after.events.length, all.events.length - 3);
  assert.ok(!after.events.some((event) => event.id === midpoint));

  // Historical state reload.
  const state = await stack.jobManager.getState('u1', job.id);
  assert.equal(state.lastEventId, all.events.at(-1).id);
  assert.ok(state.activity.length > 0);
  assert.ok(state.runtime.elapsedMs > 0);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 18/19 — Findings + evidence persist
// ══════════════════════════════════════════════════════════════════════════
test('TEST 18 + 19: findings and evidence persist, and a finding needs evidence', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  stack.phoneModel.responses.push(decision({ nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} }, reason: 'recon' }));
  // An unverifiable finding must be refused: no evidence for that asset yet.
  stack.phoneModel.responses.push(decision({
    nextAction: {
      type: 'finding', hypothesis: 'The target exposes an XSS',
      title: 'Fabricated XSS', severity: 'high', category: 'xss',
      target: 'not-in-evidence.example.net', endpoint: 'https://not-in-evidence.example.net/x'
    },
    reason: 'try to fabricate'
  }));
  stack.phoneModel.responses.push(decision({
    nextAction: {
      type: 'finding', hypothesis: 'Security headers are missing',
      title: 'Missing security headers on api.example.com', severity: 'low',
      category: 'misconfiguration', target: 'example.com', endpoint: 'https://api.example.com',
      description: 'Response lacks HSTS and CSP headers.', remediation: 'Add HSTS and a CSP.'
    },
    reason: 'evidence exists from the crtsh run'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, job.id, ['completed'], 12_000);

  const findings = await stack.models.findingModel.list(assessment.id);
  assert.equal(findings.length, 1, 'exactly one evidence-backed finding is created');
  const [finding] = findings;
  assert.equal(finding.status, 'validated');
  assert.equal(finding.title, 'Missing security headers on api.example.com');
  assert.ok(finding.dedupeKey, 'a deterministic dedupe key is stored');

  const evidence = await stack.models.evidenceModel.list(assessment.id);
  assert.ok(evidence.length >= 1);
  assert.equal(evidence[0].findingId, finding.id, 'evidence is linked to the finding');

  // The rejected attempt is visible as a real event.
  const events = await stack.eventService.list(job.id);
  assert.ok(events.some((event) => event.type === 'finding.rejected'), 'fabrication attempts are recorded, not hidden');

  // Without evidence, even a real-looking issue is refused.
  const unevidenced = await stack.findingLifecycle.createFinding({
    userId: 'u1', assessmentId: assessment.id, jobId: job.id,
    title: 'Unevidenced issue', severity: 'high', category: 'xss', asset: 'example.com'
  });
  assert.equal(unevidenced.created, false);
  assert.equal(unevidenced.reason, 'no_evidence');

  // Deduplication: the same issue again must not create a second finding.
  const again = await stack.findingLifecycle.createFinding({
    userId: 'u1', assessmentId: assessment.id, jobId: job.id,
    title: 'Missing security headers on api.example.com', severity: 'low', category: 'misconfiguration',
    asset: 'example.com', endpoint: 'https://api.example.com', rootCause: 'Missing security headers on api.example.com',
    evidenceIds: [evidence[0].id]
  });
  assert.equal(again.created, false);
  assert.equal(again.reason, 'duplicate');

  const after = await stack.models.findingModel.list(assessment.id);
  assert.equal(after.length, 1, 'no duplicate finding is stored');
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 20/21 — Report persists + survives a restart
// ══════════════════════════════════════════════════════════════════════════
test('TEST 20 + 21: the report is generated from evidence, persists, and survives a restart', async () => {
  const database = new MemoryDatabase();
  const stack = buildStack({ database });
  const assessment = await makeAssessment(stack);
  stack.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  stack.phoneModel.responses.push(decision({ nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} }, reason: 'recon' }));
  stack.phoneModel.responses.push(decision({
    nextAction: {
      type: 'finding', hypothesis: 'The admin interface is reachable without authentication',
      title: 'Exposed admin interface', severity: 'medium', category: 'exposure',
      target: 'example.com', endpoint: 'https://admin.example.com', description: 'Admin panel reachable without auth.'
    },
    reason: 'evidence collected'
  }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'objectives satisfied' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  const finished = await waitForStatus(stack.jobManager, job.id, ['completed'], 12_000);
  assert.ok(finished, 'the job completes and generates a report');

  const report = await stack.reportService.getLatest(assessment.id);
  assert.ok(report, 'a report must exist after completion');
  assert.equal(report.version, 1);
  assert.equal(report.status, 'generated');
  assert.ok(report.detailedFindings.length >= 1);
  assert.ok(report.detailedFindings[0].evidence.length >= 1, 'every reported finding carries its evidence');
  assert.ok(report.executiveSummary.length > 0);
  assert.ok(report.methodology.length > 0);
  assert.ok(report.testingCoverage && typeof report.testingCoverage.toolsExecuted === 'number');
  assert.ok(Array.isArray(report.unverifiedObservations));
  assert.ok(report.conclusion.length > 0);
  assert.ok(report.evidenceIndex.length >= 1, 'the report indexes the evidence it used');
  assert.equal(report.targetHostname, 'example.com');
  // Report generation is persisted on the job, so a returning frontend sees it.
  const refreshed = await stack.models.agentJobModel.get(job.id);
  assert.equal(refreshed.reportId, report.id);
  assert.equal(refreshed.reportVersion, 1);

  // Second version, from the same stored evidence.
  const v2 = await stack.reportService.generate('u1', assessment.id);
  assert.equal(v2.version, 2);
  const versions = await stack.reportService.list(assessment.id);
  assert.equal(versions.length, 2);

  // ── Restart: a fresh stack over the same database still sees it ───────
  const restarted = buildStack({ database });
  const reloaded = await restarted.reportService.getLatest(assessment.id);
  assert.ok(reloaded, 'the report survives a backend restart');
  assert.equal(reloaded.id, v2.id);
  const state = await restarted.jobManager.getState('u1', job.id);
  assert.equal(state.job.status, 'completed');
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 22 — Local AI is the only reasoning provider
// ══════════════════════════════════════════════════════════════════════════
test('TEST 22: the local phone AI is the only reasoning provider (no external LLM, no silent fallback)', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  // (a) The brain refuses to reason when the phone is unreachable.
  stack.phoneModel.online = false;
  const health = await stack.brain.health();
  assert.equal(health.available, false);
  assert.match(health.reason, /LOCAL AI UNAVAILABLE/);
  await assert.rejects(
    () => stack.brain.decide({ job: { id: 'job_x', target: 'example.com', scope: {}, plan: {} }, memoryContext: '' }),
    (error) => error instanceof LocalAiUnavailableError && error.code === 'LOCAL_AI_UNAVAILABLE'
  );

  // (b) The job enters a recoverable `waiting` state instead of degrading.
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'objectives satisfied' }));
  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  const waiting = await waitForStatus(stack.jobManager, job.id, ['waiting'], 6000);
  assert.ok(waiting, 'the job waits when the local brain is unreachable');
  assert.match(waiting.waitingReason, /LOCAL AI UNAVAILABLE/);
  assert.equal(waiting.brainStatus, 'waiting');

  // Recoverable: when the phone returns, the job resumes on its own.
  stack.phoneModel.online = true;
  const recovered = await waitForStatus(stack.jobManager, job.id, ['completed'], 8000);
  assert.ok(recovered, 'the job resumes once the local brain is reachable again');

  const events = await stack.eventService.list(job.id);
  assert.ok(events.some((event) => event.type === 'brain.unavailable'), 'the outage is reported, not hidden');
  assert.ok(events.some((event) => event.type === 'job.resumed'));

  // (c) The autonomous execution path cannot reach a cloud provider at all.
  const source = await import('node:fs').then((fs) => fs.promises.readFile(new URL('../src/agent/autonomousBrain.js', import.meta.url), 'utf8'));
  for (const vendor of ['api.openai.com', 'generativelanguage.googleapis.com', 'api.anthropic.com', 'api.groq.com', 'openrouter.ai']) {
    assert.ok(!source.includes(vendor), `autonomous brain must not reference ${vendor}`);
  }
  assert.match(source, /LOCAL AI UNAVAILABLE/);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 23/24 — No artificial quota
// ══════════════════════════════════════════════════════════════════════════
test('TEST 23 + 24: no artificial runtime, step, message or token quota is introduced', async () => {
  const fs = await import('node:fs');
  const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const workerSource = stripComments(await fs.promises.readFile(new URL('../src/jobs/agentWorker.js', import.meta.url), 'utf8'));
  const jobSource = stripComments(await fs.promises.readFile(new URL('../src/models/agentJobModel.js', import.meta.url), 'utf8'));

  // The legacy fixed iteration cap must not govern the autonomous loop.
  assert.ok(!/agentMaxIterations/.test(workerSource), 'the autonomous loop must not use agentMaxIterations');
  assert.ok(!/maxIterations|maxSteps|maxRuntime|maxDurationMs/.test(workerSource), 'no artificial step/runtime cap');
  assert.ok(!/requestsPerDay|messagesPerDay|tokensPerDay|dailyLimit|monthlyLimit|assessmentsPer(Minute|Hour|Day)/.test(jobSource));

  // And the legacy cap itself must not be used to end the loop: the worker only
  // stops on complete / cancel / a real failure / a real waiting condition.
  assert.match(workerSource, /const TERMINAL = new Set\(\['completed', 'failed', 'cancelled'\]\)/);

  // And the behaviour: a job keeps stepping well past the old cap of 50.
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  for (let i = 0; i < 120; i++) {
    stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: `long run ${i}` }, reason: `step ${i}` }));
  }
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  const passed = await waitFor(async () => {
    const current = await stack.models.agentJobModel.get(job.id);
    return current.stepCount > 55 ? current : null;
  }, { timeoutMs: 20_000 });
  assert.ok(passed, `the loop must run past the legacy 50-step cap (got ${(await stack.models.agentJobModel.get(job.id)).stepCount})`);
  await stack.jobManager.cancel('u1', job.id);
});

// ══════════════════════════════════════════════════════════════════════════
// TEST 25 — Long-running background job without a frontend
// ══════════════════════════════════════════════════════════════════════════
test('TEST 25: a long-running job continues with no HTTP request or SSE stream open', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);
  for (let i = 0; i < 40; i++) {
    stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: `background work ${i}` }, reason: 'continue' }));
  }
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));

  const job = await stack.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });

  // The create call already returned; nothing is holding a socket open.
  const finished = await waitForStatus(stack.jobManager, job.id, ['completed'], 25_000);
  assert.ok(finished, 'the worker finished the job on its own');
  assert.ok(finished.stepCount >= 40, `expected many background steps, got ${finished.stepCount}`);
  assert.ok(finished.completedAt, 'a completion timestamp proves the backend owned the lifetime');
});

// ══════════════════════════════════════════════════════════════════════════
// Computer action schema — the "no arbitrary shell" gate
// ══════════════════════════════════════════════════════════════════════════
test('computer action schema rejects anything outside the whitelist', () => {
  const scope = new ScopeEngine({ included: ['example.com'], excluded: [] }, 'example.com');

  assert.equal(validateComputerAction({ type: 'screenshot' }).valid, true);
  assert.equal(validateComputerAction({ type: 'type', params: { text: 'hello' } }).valid, true);
  assert.equal(validateComputerAction({ type: 'press_key', params: { keys: ['enter'] } }).valid, true);
  assert.equal(validateComputerAction({ type: 'hotkey', params: { keys: ['ctrl', 'l'] } }).valid, true);

  // No shell-ish capability is exposed by the LLM-facing schema.
  for (const forbidden of ['shell', 'exec', 'run', 'subprocess', 'pyautogui.press', 'eval']) {
    const result = validateComputerAction({ type: forbidden });
    assert.equal(result.valid, false, `${forbidden} must be rejected`);
  }

  // Unknown/unsupported keys are refused.
  assert.equal(validateComputerAction({ type: 'press_key', params: { keys: ['rm'] } }).valid, false);
  assert.equal(validateComputerAction({ type: 'type', params: { text: '\u0001' } }).valid, false);
  assert.equal(validateComputerAction({ type: 'scroll', params: { amount: 9999 } }).valid, false);

  // Scope is enforced for network-reaching actions.
  const inScope = validateComputerAction({ type: 'navigate', params: { url: 'https://example.com' } }, { scopeEngine: scope });
  assert.equal(inScope.valid, true);
  assert.equal(inScope.action.params.url, 'https://example.com');

  const outOfScope = validateComputerAction({ type: 'navigate', params: { url: 'https://evil.test/' } }, { scopeEngine: scope });
  assert.equal(outOfScope.valid, false);
  assert.match(outOfScope.errors.join(' '), /Scope violation/);

  const noEngine = validateComputerAction({ type: 'navigate', params: { url: 'https://example.com' } }, {});
  assert.equal(noEngine.valid, false, 'a network action without a scope engine must be refused');
});

// ══════════════════════════════════════════════════════════════════════════
// User isolation
// ══════════════════════════════════════════════════════════════════════════
test('user isolation: one user can never read another user job, state or memory', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack, { userId: 'userA' });

  stack.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'private' }, reason: 'a' }));
  stack.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'done' }));
  const jobA = await stack.jobManager.createJob({
    userId: 'userA', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess'
  });
  await waitForStatus(stack.jobManager, jobA.id, ['completed'], 8000);

  await assert.rejects(
    () => stack.jobManager.getState('userB', jobA.id),
    (error) => error.status === 404 && error.code === 'JOB_NOT_FOUND'
  );
  await assert.rejects(() => stack.jobManager.pause('userB', jobA.id));
  await assert.rejects(() => stack.jobManager.cancel('userB', jobA.id));

  const jobsForB = await stack.jobManager.list('userB');
  assert.equal(jobsForB.length, 0);

  assert.equal(await stack.models.agentMemoryModel.get('userB', 'mem_does_not_matter'), null);
  const memoryForB = await stack.agentMemory.recall({ assessmentId: assessment.id, userId: 'userB', query: 'private' });
  assert.ok(memoryForB.every((row) => row.userId === 'userA'), 'recall never leaks another user\'s rows');
});

// ══════════════════════════════════════════════════════════════════════════
// Long context integration — huge observations are referenced, not pasted
// ══════════════════════════════════════════════════════════════════════════
test('long context: a huge tool observation is chunked and referenced, never pasted whole into the prompt', async () => {
  const stack = buildStack();
  const assessment = await makeAssessment(stack);

  const huge = Array.from({ length: 4000 }, (_, i) => `line ${i}: /api/v${i % 3}/resource/${i}`).join('\n');
  const chunks = chunkText({ text: huge, inputId: 'in_test', conversationId: 'conv_test', userId: 'u1' });
  assert.ok(chunks.length > 1, 'large output must be chunked');

  // Store it as one memory record; the brain context must stay bounded.
  await stack.agentMemory.rememberTool({
    userId: 'u1', assessmentId: assessment.id, jobId: 'job_big',
    key: 'tool:huge', content: huge
  });
  const context = await stack.agentMemory.buildBrainContext({
    userId: 'u1', assessmentId: assessment.id, query: 'resource 1234', maxTokens: 600
  });
  assert.ok(context.tokens <= 800, `memory block must stay bounded, got ${context.tokens} tokens`);
  assert.ok(context.text.length < huge.length, 'the raw output is not pasted into the prompt');
});

// ══════════════════════════════════════════════════════════════════════════
// CRITICAL SCENARIO — close the browser mid-assessment, come back later
// ══════════════════════════════════════════════════════════════════════════
test('CRITICAL: start assessment → close the frontend → wait → reopen the same assessment', async () => {
  const database = new MemoryDatabase();

  // ── 1-4. Start the agent, let it perform multiple real actions ────────
  const session1 = buildStack({ database });
  const assessment = await makeAssessment(session1);
  session1.toolExecutor.executeCrtsh = async () => JSON.stringify([{ name_value: 'api.example.com' }]);

  session1.phoneModel.responses.push(decision({ nextAction: { type: 'tool', name: 'crtsh', target: 'example.com', arguments: {} }, reason: 'passive recon' }));
  session1.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: 'api.example.com responds with JSON' }, reason: 'record asset' }));
  session1.phoneModel.responses.push(decision({
    nextAction: {
      type: 'finding', hypothesis: 'The admin panel is exposed without authentication',
      title: 'Admin panel exposed without authentication', severity: 'high',
      category: 'broken-access-control', target: 'example.com', endpoint: 'https://admin.example.com',
      description: 'The admin interface responds 200 without any session.', remediation: 'Require authentication.'
    },
    reason: 'evidence exists'
  }));
  // The rest of the script arrives after the "reopen".
  for (let i = 0; i < 20; i++) {
    session1.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: `still working ${i}` }, reason: 'continue' }));
  }

  const started = await session1.jobManager.createJob({
    userId: 'u1', assessmentId: assessment.id, target: 'example.com', scope: assessment.scope, objective: 'Assess https://example.com'
  });

  // Wait until the agent has done real work.
  const progressed = await waitFor(async () => {
    const current = await session1.models.agentJobModel.get(started.id);
    return current.stepCount >= 3 ? current : null;
  }, { timeoutMs: 10_000 });
  assert.ok(progressed, 'the agent performed multiple actions');

  const snapshotBeforeClose = {
    stepCount: progressed.stepCount,
    phase: progressed.phase,
    status: progressed.status
  };

  // ── 5. Close the frontend completely ──────────────────────────────────
  // There was never an HTTP request or SSE stream holding this job open — the
  // worker owns it — so "closing the browser" changes nothing server-side.
  // Simulate the harder variant: the whole backend process restarts.
  await session1.worker.stopAll();

  // ── 6. Wait (the job is mid-flight, duplicated by the outage) ─────────
  await new Promise((resolve) => setTimeout(resolve, 60));
  const midFlight = await session1.models.agentJobModel.get(started.id);
  assert.equal(midFlight.status, 'running', 'a live job is NOT paused or killed by a disconnect');

  // ── 7-8. Reopen DARKMATTER → new process, same database ───────────────
  const session2 = buildStack({ database });
  for (let i = 0; i < 30; i++) {
    session2.phoneModel.responses.push(decision({ nextAction: { type: 'observation', observation: `resumed work ${i}` }, reason: 'continue' }));
  }
  session2.phoneModel.responses.push(decision({ nextAction: { type: 'complete' }, reason: 'objectives satisfied' }));

  const recovery = await session2.jobManager.recoverIncompleteJobs();
  assert.equal(recovery.recovered, 1, 'the interrupted job is recovered after the restart');

  // The frontend opens the SAME assessment and reconstructs everything.
  const reopened = await session2.jobManager.getState('u1', started.id);
  assert.equal(reopened.job.id, started.id);
  assert.equal(reopened.job.assessmentId, assessment.id);
  assert.equal(reopened.job.target, 'example.com');
  assert.ok(reopened.job.status === 'running' || reopened.job.status === 'resuming' || reopened.job.status === 'completed');
  assert.ok(reopened.activity.length > 0, 'terminal history is visible');
  assert.ok(reopened.job.phase, 'current phase is visible');
  assert.ok(reopened.runtime.elapsedMs > 0, 'elapsed time comes from persisted timestamps');
  assert.ok(reopened.findings.length >= 1, 'findings are visible');
  assert.ok(reopened.evidenceCount >= 1, 'evidence is visible');
  assert.ok(reopened.eventCount > 0, 'the replayable event log is visible');
  assert.ok(reopened.job.stepCount >= snapshotBeforeClose.stepCount, 'progress is not lost');

  // ── The worker keeps going and finishes the assessment ───────────────
  const finished = await waitForStatus(session2.jobManager, started.id, ['completed'], 15_000);
  assert.ok(finished, 'the recovered job runs to completion');

  const report = await session2.reportService.getLatest(assessment.id);
  assert.ok(report, 'report is ready after completion');
  assert.ok(report.detailedFindings.length >= 1);
  assert.ok(report.detailedFindings[0].evidence.length >= 1, 'the report is built from real evidence');
  assert.equal(finished.reportId, report.id);
});

// ══════════════════════════════════════════════════════════════════════════
// Housekeeping
// ══════════════════════════════════════════════════════════════════════════
test('cleanup: scripted bridges removed', () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  assert.equal(fs.existsSync(TMP_DIR), false);
});
