/**
 * watchdog.test.js — offline unit tests for the brain-slot watchdog.
 *
 * Uses fake child processes (EventEmitters). No spawning, no network.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';

function makeService() {
  return new ModelRunnerService({ dataDir: '/tmp/wd-test', logger: { info() {}, warn() {} } });
}

function fakeChild() {
  const c = new EventEmitter();
  c.pid = 99999;
  c.kill = () => {};
  return c;
}

describe('brain watchdog', () => {
  test('restarts a crashed brain automatically', async () => {
    const svc = makeService();
    const child = fakeChild();
    svc.slotServers.vision = { modelId: 'm1', stopping: false };
    let runs = 0;
    svc.runForSlot = async () => { runs++; return { started: true }; };
    svc._watchSlotChild('vision', child, { modelId: 'm1', quant: 'Q4_K_M', contextSize: 8192 });
    child.emit('exit', 1, null);
    await new Promise((r) => setTimeout(r, 9000)); // backoff 2s + margin
    assert.equal(runs, 1, 'runForSlot should be called once to restart the crashed brain');
  });

  test('does NOT restart after an intentional stop', async () => {
    const svc = makeService();
    const child = fakeChild();
    svc.slotServers.vision = { modelId: 'm1', stopping: false };
    let runs = 0;
    svc.runForSlot = async () => { runs++; return { started: true }; };
    svc._watchSlotChild('vision', child, { modelId: 'm1' });
    // Simulate stopSlot: mark stopping + clear child entry, then child exits.
    svc.slotServers.vision.stopping = true;
    delete svc.slotServers.vision;
    delete svc.slotChildren.vision;
    child.emit('exit', 0, 'SIGTERM');
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(runs, 0, 'intentional stop must not trigger a restart');
  });

  test('ignores exit of a reassigned (stale) child', async () => {
    const svc = makeService();
    const oldChild = fakeChild();
    const newChild = fakeChild();
    svc.slotServers.vision = { modelId: 'm2', stopping: false };
    let runs = 0;
    svc.runForSlot = async () => { runs++; return { started: true }; };
    svc._watchSlotChild('vision', oldChild, { modelId: 'm1' });
    // Slot reassigned: new child watched.
    svc._watchSlotChild('vision', newChild, { modelId: 'm2' });
    oldChild.emit('exit', 1, null); // stale child dies late
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(runs, 0, 'stale child exit must not restart the current brain');
  });

  test('gives up after 3 crashes and records the failure', async () => {
    const svc = makeService();
    svc.slotServers.hacker = { modelId: 'm1', stopping: false };
    svc.runForSlot = async () => { throw new Error('still broken'); };
    for (let i = 0; i < 4; i++) {
      const child = fakeChild();
      svc._watchSlotChild('hacker', child, { modelId: 'm1' });
      child.emit('exit', 1, null);
      await new Promise((r) => setTimeout(r, 9000));
      // restore server entry for the next crash cycle (restart failed to recreate it)
      if (svc.slotServers.hacker) continue;
      if (i < 3) svc.slotServers.hacker = { modelId: 'm1', stopping: false };
    }
    assert.ok(svc.slotSetupError.hacker, 'failure must be recorded for the UI');
    assert.match(svc.slotSetupError.hacker.message, /crashed repeatedly/);
    assert.equal(svc.describeSlotSetup().hacker, 'error');
  });
});
