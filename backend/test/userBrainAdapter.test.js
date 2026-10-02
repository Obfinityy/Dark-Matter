/**
 * userBrainAdapter.test.js — proves Infinity AI thinks with the user's ACTIVE
 * brain (Models → Run / Kaggle connect), not hard-wired phone.
 *
 *  1. phone-default user (or no userId) → delegates to the PhoneModelAdapter
 *     untouched (zero behavior change on the default path)
 *  2. local-selected user → generate() goes to the running llama-server
 *     through the ResilientBrainProvider chain
 *  3. completeJson extracts the first JSON object (same contract as phone)
 *  4. a selection change rebuilds the chain (no stale brain)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { UserBrainAdapter } from '../src/services/userBrainAdapter.js';

function stubBrainProviderModel(selection) {
  let current = selection;
  return {
    getSelection: async () => ({ ...current }),
    _set: (s) => { current = s; }
  };
}

function stubDefaultModel() {
  const calls = [];
  return {
    calls,
    enabled: true,
    complete: async (messages, options) => {
      calls.push({ messages, options });
      return { text: 'phone-reply', finishReason: 'stop', raw: { via: 'phone' } };
    }
  };
}

function stubRunner() {
  return {
    endpoint: () => 'http://127.0.0.1:9',
    ensureRunningState: async () => {},
    library: async () => []
  };
}

/** Swap global fetch for the duration of fn; restore afterwards. */
async function withFetch(handler, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

const cannedChat = (content) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }] })
});

test('phone-default user delegates to defaultModel untouched', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'phone' });
  const defaultModel = stubDefaultModel();
  const adapter = new UserBrainAdapter({ brainProviderModel, defaultModel });
  const res = await adapter.complete([{ role: 'user', content: 'hi' }], { userId: 'u1', maxTokens: 100 });
  assert.deepEqual(res, { text: 'phone-reply', finishReason: 'stop', raw: { via: 'phone' } });
  assert.equal(defaultModel.calls.length, 1);
  assert.equal(defaultModel.calls[0].options.userId, 'u1');
});

test('no userId falls back to the phone default', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'local', modelId: 'm1' });
  const defaultModel = stubDefaultModel();
  const adapter = new UserBrainAdapter({ brainProviderModel, defaultModel });
  await adapter.complete([{ role: 'user', content: 'hi' }], {});
  assert.equal(defaultModel.calls.length, 1, 'background calls stay on phone');
});

test('local-selected user generates through the running model chain', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'local', modelId: 'dolphin-llama31-8b' });
  const defaultModel = stubDefaultModel();
  const adapter = new UserBrainAdapter({
    brainProviderModel,
    modelRunnerService: stubRunner(),
    defaultModel
  });
  let fetchedUrl = null;
  await withFetch(async (url) => { fetchedUrl = url; return cannedChat('<think>reasoning</think>hello from local')(); }, async () => {
    const res = await adapter.complete([{ role: 'user', content: 'hi' }], { userId: 'u9' });
    assert.equal(res.text, 'hello from local', 'thinking tags stripped');
    assert.ok(String(res.raw.brain).startsWith('local:'), `chain link used: ${res.raw.brain}`);
  });
  assert.ok(fetchedUrl.startsWith('http://127.0.0.1:9/chat/completions'), `hit llama-server: ${fetchedUrl}`);
  assert.equal(defaultModel.calls.length, 0, 'phone path not touched');
});

test('completeJson extracts the first JSON object from brain text', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'local', modelId: 'm1' });
  const adapter = new UserBrainAdapter({
    brainProviderModel,
    modelRunnerService: stubRunner(),
    defaultModel: stubDefaultModel()
  });
  await withFetch(cannedChat('Sure. {"steps": 3} done'), async () => {
    const out = await adapter.completeJson([{ role: 'user', content: 'plan' }], { userId: 'u9' });
    assert.deepEqual(out, { steps: 3 });
  });
});

test('selection change rebuilds the chain (no stale brain)', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'phone' });
  const defaultModel = stubDefaultModel();
  const adapter = new UserBrainAdapter({
    brainProviderModel,
    modelRunnerService: stubRunner(),
    defaultModel
  });
  await adapter.complete([{ role: 'user', content: 'hi' }], { userId: 'u1' });
  assert.equal(defaultModel.calls.length, 1);
  // User presses Run on a local model…
  brainProviderModel._set({ provider: 'local', modelId: 'm1' });
  await withFetch(cannedChat('local now'), async () => {
    const res = await adapter.complete([{ role: 'user', content: 'hi' }], { userId: 'u1' });
    assert.equal(res.text, 'local now');
  });
  assert.equal(defaultModel.calls.length, 1, 'phone not called again after switch');
});

test('isEnabledFor: local-brain user passes the gate even when phone disabled', async () => {
  const brainProviderModel = stubBrainProviderModel({ provider: 'local', modelId: 'm1' });
  const defaultModel = stubDefaultModel();
  defaultModel.enabled = false; // phone provider disabled in this env
  const adapter = new UserBrainAdapter({
    brainProviderModel,
    modelRunnerService: stubRunner(),
    defaultModel
  });
  assert.equal(await adapter.isEnabledFor('u1'), true, 'local selection is servable');
  brainProviderModel._set({ provider: 'phone' });
  assert.equal(await adapter.isEnabledFor('u1'), false, 'phone-only user still blocked');
  defaultModel.enabled = true;
  assert.equal(await adapter.isEnabledFor('u1'), true, 'phone enabled → all users pass');
});
