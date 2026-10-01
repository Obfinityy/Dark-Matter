/**
 * DARKMATTER — Autonomous computer-control test suite (issue #1).
 *
 * Covers the new issue #1 machinery on top of the existing computer layer:
 *   • the extended lifecycle state machine (observing / action_failed /
 *     observation_failed / disconnected / permission_required / ready)
 *   • expected-vs-actual outcome comparison (observe → decide → act → observe)
 *   • failure-recovery strategy advice
 *   • the per-action persistence ledger (ComputerActionModel)
 *   • the adapter's automatic post-action re-observe pass
 *   • setup diagnostics + explicitly-authorized safe repair
 *
 * Everything runs against the REAL new code. The only substitutes are the
 * same two the other suites use: a scripted bridge speaking the real NDJSON
 * protocol, and MemoryDatabase instead of Mongo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MemoryDatabase } from '../src/models/database.js';
import { EventService } from '../src/services/eventService.js';
import { ComputerState, COMPUTER_STATES } from '../src/computer/computerState.js';
import { ComputerEvents } from '../src/computer/computerEvents.js';
import { OpenInterfaceAdapter } from '../src/computer/openInterfaceAdapter.js';
import { checkOutcome } from '../src/computer/outcomeCheck.js';
import { suggestRecovery } from '../src/computer/recoveryAdvisor.js';
import { diagnoseComputerSetup, repairComputerSetup } from '../src/computer/setupGuide.js';
import { ComputerActionModel } from '../src/models/computerActionModel.js';

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmatter-computercontrol-'));

// ══════════════════════════════════════════════════════════════════════════
// Scripted bridge (same NDJSON protocol as the real Python bridge)
// ══════════════════════════════════════════════════════════════════════════

function writeFakeBridge({ failCommands = [] } = {}) {
  const file = path.join(TMP_DIR, `issue1-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);
  const LOG = path.join(TMP_DIR, `issue1-commands-${Date.now()}.jsonl`);
  fs.writeFileSync(file, `
const readline = require('readline');
const fs = require('fs');
const FAIL = new Set(${JSON.stringify(failCommands)});
const capabilities = {
  bridge: 'fake-open-interface-adapter',
  platform: 'TestOS',
  pythonVersion: '3.13.0',
  pyautoguiAvailable: true,
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
process.stdout.write(JSON.stringify({ type: 'ready', ok: true, result: capabilities }) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.cmd === '__shutdown__') { process.exit(0); }
  fs.appendFileSync(${JSON.stringify(LOG)}, JSON.stringify({ cmd: request.cmd, params: request.params }) + '\\n');
  if (FAIL.has(request.cmd)) {
    process.stdout.write(JSON.stringify({ id: request.id, ok: false, error: { kind: 'error', message: 'scripted bridge failure for ' + request.cmd } }) + '\\n');
    return;
  }
  const respond = (output) => {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, command: request.cmd, output, durationMs: 1 }) + '\\n');
  };
  switch (request.cmd) {
    case 'click': respond({ clicked: { x: request.params.x, y: request.params.y } }); break;
    case 'get_active_window': respond({ supported: true, title: 'Test Browser - Bug Bounty Target' }); break;
    case 'navigate': respond({ navigatedTo: request.params.url }); break;
    default: respond({ done: true });
  }
});
`);
  return file;
}

function buildAdapter({ bridgeFile = writeFakeBridge(), extraConfig = {} } = {}) {
  const database = new MemoryDatabase();
  const eventService = new EventService(database);
  const state = new ComputerState();
  const events = new ComputerEvents({ eventService, state });
  const adapter = new OpenInterfaceAdapter({
    config: {
      enabled: true,
      pythonBin: process.execPath,
      bridgePath: bridgeFile,
      spawnArgs: [],
      verifyArgs: ['-e', "console.log('python-ok ' + process.version)"],
      actionTimeoutMs: 5000,
      probeTimeoutMs: 5000,
      observeSettleMs: 5,
      requireApproval: false,
      ...extraConfig
    },
    state,
    events,
    logger: { warn() {}, info() {}, error() {} }
  });
  return { database, eventService, state, events, adapter };
}

// ══════════════════════════════════════════════════════════════════════════
// UNIT — state machine
// ══════════════════════════════════════════════════════════════════════════

test('UNIT state-machine: full observe→decide→act→observe lifecycle is explicit', () => {
  const state = new ComputerState();
  const seen = [];
  state.subscribe((event) => seen.push(event));

  assert.equal(state.state, COMPUTER_STATES.UNAVAILABLE);
  state.setCapabilities({ platform: 'TestOS', pyautoguiAvailable: true }, { available: true });
  assert.equal(state.state, COMPUTER_STATES.CONNECTED);

  // The daemon announces readiness → READY (new state).
  state.markReady({ platform: 'TestOS' });
  assert.equal(state.state, COMPUTER_STATES.READY);

  // Action starts → re-observe pass → observation ready.
  state.markActionStarted({ type: 'click' });
  assert.equal(state.state, COMPUTER_STATES.ACTION_RUNNING);
  state.markObserving({ after: 'click' });
  assert.equal(state.state, COMPUTER_STATES.OBSERVING);
  state.markObservationReady({ kind: 'active_window', summary: 'Active window: Test' });
  assert.equal(state.state, COMPUTER_STATES.OBSERVATION_READY);

  // Every transition was explicit (no unexpected edges).
  assert.ok(seen.length > 0);
  assert.ok(seen.every((event) => event.explicit === true),
    `unexpected transition(s): ${JSON.stringify(seen.filter((e) => !e.explicit))}`);
  assert.ok(state.isAvailable());
});

test('UNIT state-machine: single action failure → action_failed, not unavailable', () => {
  const state = new ComputerState();
  state.setCapabilities({ platform: 'TestOS' }, { available: true });
  state.markActionStarted({ type: 'click' });
  state.markActionFinished({ type: 'click' }, { ok: false, error: 'boom' });
  assert.equal(state.state, COMPUTER_STATES.ACTION_FAILED);
  assert.ok(state.isAvailable(), 'a failed action must not take the runtime down');
  assert.equal(state.consecutiveFailures, 1);
});

test('UNIT state-machine: three consecutive failures → unavailable', () => {
  const state = new ComputerState();
  state.setCapabilities({ platform: 'TestOS' }, { available: true });
  for (let i = 0; i < 3; i++) {
    state.markActionStarted({ type: 'click' });
    state.markActionFinished({ type: 'click' }, { ok: false, error: 'boom' });
  }
  assert.equal(state.state, COMPUTER_STATES.UNAVAILABLE);
  assert.ok(!state.isAvailable());
  assert.match(state.unavailableReason, /consecutive failures/);
});

test('UNIT state-machine: disconnect and permission states are distinct', () => {
  const state = new ComputerState();
  state.setCapabilities({ platform: 'TestOS' }, { available: true });
  state.markDisconnected('bridge exited');
  assert.equal(state.state, COMPUTER_STATES.DISCONNECTED);
  assert.ok(!state.isAvailable());
  assert.equal(state.unavailableReason, 'bridge exited');

  state.setCapabilities({ platform: 'TestOS' }, { available: true });
  state.markPermissionRequired({ type: 'click' });
  assert.equal(state.state, COMPUTER_STATES.PERMISSION_REQUIRED);
  assert.ok(state.isAvailable(), 'awaiting approval is not an outage');
});

test('UNIT state-machine: observation failure is its own state', () => {
  const state = new ComputerState();
  state.setCapabilities({ platform: 'TestOS' }, { available: true });
  state.markObserving({});
  state.markObservationFailed('no screen data');
  assert.equal(state.state, COMPUTER_STATES.OBSERVATION_FAILED);
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — outcome check (expected vs actual)
// ══════════════════════════════════════════════════════════════════════════

test('UNIT outcome-check: matching observation → matched', () => {
  const verdict = checkOutcome({
    expectedOutcome: 'the login page appears',
    observation: { summary: 'Navigated to https://target/login — login page loaded' }
  });
  assert.equal(verdict.matched, true);
});

test('UNIT outcome-check: contradictory observation → mismatched', () => {
  const verdict = checkOutcome({
    expectedOutcome: 'the dashboard loads',
    observation: { summary: 'Active window: Error — page not found' }
  });
  assert.equal(verdict.matched, false);
  assert.match(verdict.reason, /reports a failure/i);
});

test('UNIT outcome-check: unrelated observation → mismatched', () => {
  const verdict = checkOutcome({
    expectedOutcome: 'the dashboard loads',
    observation: { summary: 'Active window: Calculator' }
  });
  assert.equal(verdict.matched, false);
  assert.match(verdict.reason, /none of the expected keywords/i);
});

test('UNIT outcome-check: failure signal against a positive expectation → mismatched', () => {
  const verdict = checkOutcome({
    expectedOutcome: 'the file downloads successfully',
    observation: { summary: "Computer action failed: timed out after 60000ms" }
  });
  assert.equal(verdict.matched, false);
});

test('UNIT outcome-check: no expected outcome → unknown, never fabricated', () => {
  const verdict = checkOutcome({
    expectedOutcome: null,
    observation: { summary: 'Active window: Test' }
  });
  assert.equal(verdict.matched, null);
});

test('UNIT outcome-check: follow-up observation participates in the verdict', () => {
  const verdict = checkOutcome({
    expectedOutcome: 'browser window opens',
    observation: { summary: 'Launched application: chrome' },
    followUpObservation: { summary: 'Active window: Chrome browser window is open' }
  });
  assert.equal(verdict.matched, true);
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — recovery advisor
// ══════════════════════════════════════════════════════════════════════════

test('UNIT recovery: click failure suggests scroll+observe+retry', () => {
  const advice = suggestRecovery({
    action: { type: 'click' },
    error: { kind: 'error', message: 'element not visible' }
  });
  const strategies = advice.map((entry) => entry.strategy);
  assert.ok(strategies.includes('scroll_and_observe'), `got: ${strategies.join(',')}`);
  assert.ok(strategies.includes('observe_and_replan'));
});

test('UNIT recovery: runtime gone → reconnect and fall back to tools', () => {
  const advice = suggestRecovery({
    action: { type: 'click' },
    error: { kind: 'unavailable', message: 'bridge not running' }
  });
  const strategies = advice.map((entry) => entry.strategy);
  assert.deepEqual(strategies, ['reconnect_and_wait', 'fall_back_to_tools']);
});

test('UNIT recovery: rejected action → choose a different action, never retry', () => {
  const advice = suggestRecovery({
    action: { type: 'click' },
    error: { kind: 'rejected', message: 'coordinates outside screen' }
  });
  assert.equal(advice[0].strategy, 'choose_different_action');
  assert.match(advice[0].detail, /never retry the exact rejected attempt/i);
});

test('UNIT recovery: wrong page → navigate back is suggested', () => {
  const advice = suggestRecovery({
    action: { type: 'navigate', params: { url: 'https://wrong/' } },
    error: { kind: 'error', message: 'unexpected page' }
  });
  const strategies = advice.map((entry) => entry.strategy);
  assert.ok(strategies.includes('navigate_back'));
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — ComputerActionModel persistence ledger
// ══════════════════════════════════════════════════════════════════════════

test('UNIT ledger: record → finish → link next decision → list by job', async () => {
  const database = new MemoryDatabase();
  const model = new ComputerActionModel(database);

  const entry = await model.record({
    jobId: 'job_1',
    assessmentId: 'assess_1',
    userId: 'user_1',
    action: 'click',
    params: { x: 100, y: 200 },
    expectedOutcome: 'the login button activates',
    decision: { objective: 'reach the login form', reason: 'button visible', expectedOutcome: 'the login button activates' }
  });
  assert.equal(entry.status, 'started');
  assert.equal(entry.action, 'click');
  assert.equal(entry.finishedAt, null);

  await model.markFinished(entry.id, {
    ok: true,
    observation: { summary: 'Active window: Login' },
    outcomeCheck: { matched: true, reason: 'observation supports the expectation' },
    durationMs: 42
  });

  await model.linkNextDecision(entry.id, {
    objective: 'submit credentials',
    reason: 'login form is visible',
    nextAction: { type: 'computer_action' },
    status: 'decided'
  });

  const fetched = await model.get(entry.id);
  assert.equal(fetched.status, 'completed');
  assert.equal(fetched.ok, true);
  assert.equal(fetched.outcomeCheck.matched, true);
  assert.equal(fetched.nextDecision.objective, 'submit credentials');
  assert.equal(fetched.nextDecision.nextActionType, 'computer_action');

  const byJob = await model.listByJob('job_1');
  assert.equal(byJob.length, 1);
  const byAssessment = await model.listByAssessment('assess_1');
  assert.equal(byAssessment.length, 1);
});

test('UNIT ledger: failures persist with error and recovery advice', async () => {
  const database = new MemoryDatabase();
  const model = new ComputerActionModel(database);
  const entry = await model.record({
    jobId: 'job_2', assessmentId: 'assess_2', userId: 'user_1',
    action: 'click', params: { x: 1, y: 1 }
  });
  const advice = suggestRecovery({ action: { type: 'click' }, error: { kind: 'error', message: 'boom' } });
  await model.markFinished(entry.id, {
    ok: false,
    error: { kind: 'error', message: 'boom' },
    recoveryAdvice: advice
  });
  const fetched = await model.get(entry.id);
  assert.equal(fetched.status, 'failed');
  assert.ok(fetched.recoveryAdvice.length > 0);
});

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATION — adapter: automatic post-action re-observe
// ══════════════════════════════════════════════════════════════════════════

test('INTEGRATION adapter: click → automatic re-observe captures the new screen', async () => {
  const { state, adapter } = buildAdapter();
  try {
    const result = await adapter.execute(
      { type: 'click', params: { x: 100, y: 200 }, reason: 'click the login button' },
      { channel: 'test' }
    );
    assert.equal(result.ok, true);

    const followUp = await adapter.observeAfterAction(result.action, { channel: 'test' });
    assert.ok(followUp, 'expected a follow-up observation');
    assert.equal(followUp.kind, 'active_window');
    assert.match(followUp.summary, /Test Browser - Bug Bounty Target/);
    assert.equal(state.state, COMPUTER_STATES.OBSERVATION_READY);
  } finally {
    adapter.stop();
  }
});

test('INTEGRATION adapter: no re-observe for non-meaningful actions', async () => {
  const { adapter } = buildAdapter();
  try {
    const followUp = await adapter.observeAfterAction({ type: 'sleep', params: { seconds: 1 } }, { channel: 'test' });
    assert.equal(followUp, null);
  } finally {
    adapter.stop();
  }
});

test('INTEGRATION adapter: action failure lands in action_failed (runtime alive)', async () => {
  const { state, adapter } = buildAdapter({ bridgeFile: writeFakeBridge({ failCommands: ['click'] }) });
  try {
    const result = await adapter.execute(
      { type: 'click', params: { x: 10, y: 10 }, reason: 'scripted failure' },
      { channel: 'test' }
    );
    assert.equal(result.ok, false);
    assert.equal(state.state, COMPUTER_STATES.ACTION_FAILED);
    assert.ok(state.isAvailable());
  } finally {
    adapter.stop();
  }
});

test('INTEGRATION adapter: daemon readiness moves state to ready', async () => {
  const { state, adapter } = buildAdapter();
  try {
    const ok = await adapter.ensureStarted();
    assert.equal(ok, true);
    assert.equal(state.state, COMPUTER_STATES.READY);
  } finally {
    adapter.stop();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT — setup diagnostics + authorized repair
// ══════════════════════════════════════════════════════════════════════════

test('UNIT setup: missing bridge is reported honestly with fix steps', () => {
  const fakeAdapter = {
    bridgePath: path.join(TMP_DIR, 'does-not-exist.py'),
    discoverPython() { return { bin: process.execPath, version: 'v20', tried: [] }; },
    localVenvPython() { return null; },
    probe() { return { available: false, reason: 'bridge not found', capabilities: null }; }
  };
  const report = diagnoseComputerSetup(fakeAdapter);
  assert.equal(report.ok, false);
  const bridgeCheck = report.checks.find((check) => check.name === 'bridge_file');
  assert.equal(bridgeCheck.ok, false);
  assert.ok(bridgeCheck.fix.steps.length > 0, 'a failing check must carry fix steps');
  assert.match(report.summary, /incomplete/);
});

test('UNIT setup: repair without authorization only returns instructions', () => {
  const fakeAdapter = { bridgePath: path.join(TMP_DIR, 'bridge.py') };
  const result = repairComputerSetup(fakeAdapter, { repair: 'install_pyautogui', userAuthorized: false });
  assert.equal(result.repaired, false);
  assert.equal(result.requiresAuthorization, true);
  assert.ok(result.instructions.length > 0);
});

test('UNIT setup: unknown repair is refused, never executed', () => {
  const fakeAdapter = { bridgePath: path.join(TMP_DIR, 'bridge.py') };
  const result = repairComputerSetup(fakeAdapter, { repair: 'rm -rf /', userAuthorized: true });
  assert.equal(result.repaired, false);
  assert.match(result.detail, /unknown repair/);
});
