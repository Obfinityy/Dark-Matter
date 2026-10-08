/**
 * downloadAndRun.test.js — offline unit tests for the one-click brain setup.
 *
 * Covers validation, dedupe, already-running short-circuit, and the default
 * slot model map. No network, no downloads, no process spawning.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SLOT_MODELS, getDefaultModelForSlot } from '../src/services/modelRunner/modelLibrary.js';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';

describe('DEFAULT_SLOT_MODELS', () => {
  test('one default per brain slot, all uncensored 7-8B class', () => {
    assert.deepEqual(Object.keys(DEFAULT_SLOT_MODELS).sort(), ['grounding', 'hacker', 'vision']);
    assert.equal(DEFAULT_SLOT_MODELS.vision, 'qwen25-vl-7b-abliterated');
    assert.equal(DEFAULT_SLOT_MODELS.grounding, 'os-atlas-7b');
    assert.equal(DEFAULT_SLOT_MODELS.hacker, 'qwen3-8b-abliterated');
  });

  test('getDefaultModelForSlot resolves to real library entries', () => {
    for (const slot of ['vision', 'grounding', 'hacker']) {
      const m = getDefaultModelForSlot(slot);
      assert.ok(m, `no library entry for slot ${slot}`);
      assert.equal(m.brainSlot, slot);
    }
    assert.equal(getDefaultModelForSlot('nope'), null);
  });
});

describe('downloadAndRunForSlot validation', () => {
  test('rejects unknown slot and unknown model synchronously', () => {
    const svc = new ModelRunnerService({ dataDir: '/tmp/dar-test', logger: { info() {}, warn() {} } });
    assert.throws(() => svc.downloadAndRunForSlot('nope', 'x'), /Unknown brain slot/);
    assert.throws(() => svc.downloadAndRunForSlot('vision', 'no-such-model'), /Unknown model/);
  });

  test('short-circuits when the exact model already runs on the slot', () => {
    const svc = new ModelRunnerService({ dataDir: '/tmp/dar-test', logger: { info() {}, warn() {} } });
    svc.slotServers = { vision: { modelId: 'qwen25-vl-7b-abliterated' } };
    const res = svc.downloadAndRunForSlot('vision', 'qwen25-vl-7b-abliterated');
    assert.equal(res.alreadyRunning, true);
    assert.ok(!svc.slotSetup?.vision, 'must not start a setup task when already running');
  });

  test('dedupes concurrent setup calls for the same slot', async () => {
    const svc = new ModelRunnerService({ dataDir: '/tmp/dar-test', logger: { info() {}, warn() {} } });
    // Stub the heavy parts: pretend the model is downloaded and run succeeds.
    svc.preferredQuant = () => 'Q4_K_M';
    let runs = 0;
    svc.runForSlot = async () => { runs++; return { started: true }; };
    const a = svc.downloadAndRunForSlot('hacker', 'qwen3-8b-abliterated');
    const b = svc.downloadAndRunForSlot('hacker', 'qwen3-8b-abliterated');
    assert.equal(a.accepted, true);
    assert.equal(b.alreadySettingUp, true);
    await svc.slotSetup.hacker;
    assert.equal(runs, 1, 'runForSlot must execute exactly once');
    assert.ok(!svc.slotSetup.hacker, 'setup task cleaned up after completion');
  });

  test('records setup errors instead of crashing', async () => {
    const svc = new ModelRunnerService({ dataDir: '/tmp/dar-test', logger: { info() {}, warn() {} } });
    svc.preferredQuant = () => 'Q4_K_M';
    svc.runForSlot = async () => { throw new Error('boom'); };
    svc.downloadAndRunForSlot('grounding', 'os-atlas-7b');
    await svc.slotSetup.grounding.catch(() => {});
    // wait a tick for the finally block
    await new Promise((r) => setTimeout(r, 50));
    assert.match(svc.slotSetupError.grounding.message, /boom/);
    assert.equal(svc.describeSlotSetup().grounding, 'error');
    svc.clearSlotSetupError('grounding');
    assert.equal(svc.describeSlotSetup().grounding, 'idle');
  });
});
