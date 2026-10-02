/**
 * brainFallbackChain.test.js — the brain fallback chain:
 *   local (selected) → next downloaded local model → Kaggle/Colab remote →
 *   phone API.
 *
 * Uses stub providers (no network, no GPU): proves failover ORDER,
 * lazy activation of the "next downloaded model" link, exhaustion errors,
 * and that the last Gradio URL survives provider switches.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBrainChain, ResilientBrainProvider } from '../src/agent/providers/resilientBrainProvider.js';
import { createModelRunnerController } from '../src/controllers/modelRunnerController.js';
import { BrainProviderModel } from '../src/models/brainProviderModel.js';
import { MemoryDatabase } from '../src/models/database.js';

// ── Stubs ──────────────────────────────────────────────────────────────────
const okProvider = (name, text = `ok:${name}`) => ({
  name,
  generate: async () => text,
  generateStructured: async () => ({ ok: true }),
  stream: async function* () { yield text; },
  healthCheck: async () => ({ reachable: true }),
  resolveModel: () => name
});

const deadProvider = (name, reason = 'crashed') => ({
  name,
  generate: async () => { throw new Error(`${name} ${reason}`); },
  generateStructured: async () => { throw new Error(`${name} ${reason}`); },
  stream: async function* () { throw new Error(`${name} ${reason}`); },
  healthCheck: async () => { throw new Error(`${name} ${reason}`); },
  resolveModel: () => name
});

// ── buildBrainChain ordering ───────────────────────────────────────────────
test('chain for local selection: local → next downloaded → gradio → phone', () => {
  const chain = buildBrainChain({
    selection: {
      provider: 'local',
      modelId: 'qwen3-8b-abliterated',
      lastGradioUrl: 'https://abc123.gradio.live'
    },
    appConfig: {},
    runner: { run: async () => ({}) }, // never called here — describe only
    downloaded: [
      { id: 'qwen3-8b-abliterated', downloaded: true, sizeGB: 5.2 },
      { id: 'deepseek-r1-8b-abliterated', downloaded: true, sizeGB: 5.5 },
      { id: 'llama33-70b-ablated', downloaded: true, sizeGB: 43 },
      { id: 'not-downloaded', downloaded: false, sizeGB: 1 }
    ]
  });
  const names = chain.map((l) => l.name);
  assert.deepEqual(names, [
    'local:qwen3-8b-abliterated',
    'local:deepseek-r1-8b-abliterated', // smallest other first — fastest to load
    'local:llama33-70b-ablated',
    'gradio:remote',
    'phone:api'
  ]);
});

test('chain for gradio selection: gradio → phone (no duplicates)', () => {
  const chain = buildBrainChain({
    selection: { provider: 'gradio', endpointUrl: 'https://xyz.gradio.live' },
    appConfig: {}
  });
  assert.deepEqual(chain.map((l) => l.name), ['gradio:remote', 'phone:api']);
});

test('chain for phone selection is just the phone', () => {
  const chain = buildBrainChain({ selection: { provider: 'phone' }, appConfig: {} });
  assert.deepEqual(chain.map((l) => l.name), ['phone:api']);
});

test('local with no other downloads and no remote: local → phone', () => {
  const chain = buildBrainChain({
    selection: { provider: 'local', modelId: 'qwen3-8b-abliterated' },
    appConfig: {},
    runner: {},
    downloaded: [{ id: 'qwen3-8b-abliterated', downloaded: true, sizeGB: 5.2 }]
  });
  assert.deepEqual(chain.map((l) => l.name), ['local:qwen3-8b-abliterated', 'phone:api']);
});

// ── ResilientBrainProvider failover ────────────────────────────────────────
test('generate fails over through the chain to the first healthy brain', async () => {
  const p = new ResilientBrainProvider([
    { name: 'local:qwen3-8b-abliterated', provider: deadProvider('local') },
    { name: 'local:deepseek-r1-8b-abliterated', provider: deadProvider('local2', 'OOM') },
    { name: 'gradio:remote', provider: okProvider('gradio', 'remote-answer') },
    { name: 'phone:api', provider: okProvider('phone') }
  ]);
  const answer = await p.generate([{ role: 'user', content: 'hi' }]);
  assert.equal(answer, 'remote-answer');
  assert.equal(p.activeName, 'gradio:remote');
  assert.equal(p.failoverLog.length, 2);
  assert.equal(p.failoverLog[0].from, 'local:qwen3-8b-abliterated');
  assert.equal(p.failoverLog[1].from, 'local:deepseek-r1-8b-abliterated');
  assert.match(p.failoverLog[0].reason, /crashed/);
});

test('"next downloaded model" link is lazy — runner.run only fires on failover', async () => {
  let ranModel = null;
  const runner = { run: async (id) => { ranModel = id; return { ok: true }; } };
  const p = new ResilientBrainProvider([
    { name: 'local:primary', provider: okProvider('primary', 'primary-answer') },
    {
      name: 'local:backup',
      activate: async () => { await runner.run('backup-id'); return okProvider('backup', 'backup-answer'); }
    },
    { name: 'phone:api', provider: okProvider('phone') }
  ]);
  // Primary healthy → backup model is never started.
  assert.equal(await p.generate([]), 'primary-answer');
  assert.equal(ranModel, null);

  // Now the primary dies → the backup model is RUN, then answers.
  p.chain[0].provider = deadProvider('primary');
  p.activeProvider = null;
  assert.equal(await p.generate([]), 'backup-answer');
  assert.equal(ranModel, 'backup-id');
  assert.equal(p.activeName, 'local:backup');
});

test('generateStructured and stream fail over too', async () => {
  const mk = () => new ResilientBrainProvider([
    { name: 'a', provider: deadProvider('a') },
    { name: 'b', provider: okProvider('b', 'B!') }
  ]);
  const s = await mk().generateStructured([], {});
  assert.deepEqual(s, { ok: true });
  const chunks = [];
  for await (const c of await mk().stream([])) chunks.push(c);
  assert.deepEqual(chunks, ['B!']);
});

test('exhausted chain throws a clear error naming what was tried', async () => {
  const p = new ResilientBrainProvider([
    { name: 'local:x', provider: deadProvider('local:x', 'segfault') },
    { name: 'phone:api', provider: deadProvider('phone', 'no key') }
  ]);
  await assert.rejects(() => p.generate([]), /All brain fallbacks exhausted \(local:x → phone:api\)/);
  assert.equal(p.failoverLog.length, 2);
});

test('healthCheck never throws and reports the degraded chain', async () => {
  const p = new ResilientBrainProvider([
    { name: 'local:x', provider: deadProvider('local:x', 'segfault') },
    { name: 'phone:api', provider: okProvider('phone') }
  ]);
  await p.generate([]); // triggers one failover
  const h = await p.healthCheck();
  assert.equal(h.provider, 'ResilientBrainProvider');
  assert.equal(h.active, 'phone:api');
  assert.equal(h.degraded, true);
  assert.equal(h.links[0].failed, true);
  assert.equal(h.links[0].reachable, false);
  assert.equal(h.links[1].active, true);
});

test('constructor rejects an empty chain', () => {
  assert.throws(() => new ResilientBrainProvider([]), /non-empty chain/);
});

// ── lastGradioUrl persistence ──────────────────────────────────────────────
test('last Gradio URL survives switching brain to local and back', async () => {
  const db = new MemoryDatabase();
  const model = new BrainProviderModel(db);
  const user = 'user_fallback_chain';

  await model.setSelection(user, { provider: 'gradio', endpointUrl: 'https://abc123.gradio.live' });
  let sel = await model.getSelection(user);
  assert.equal(sel.provider, 'gradio');
  assert.equal(sel.lastGradioUrl, 'https://abc123.gradio.live');

  // User switches to a local model — the remote URL must be remembered.
  await model.setSelection(user, { provider: 'local', modelId: 'qwen3-8b-abliterated' });
  sel = await model.getSelection(user);
  assert.equal(sel.provider, 'local');
  assert.equal(sel.modelId, 'qwen3-8b-abliterated');
  assert.equal(sel.endpointUrl, null);
  assert.equal(sel.lastGradioUrl, 'https://abc123.gradio.live');

  // And the chain builder picks it up as the remote fallback.
  const chain = buildBrainChain({ selection: sel, appConfig: {}, runner: { run: async () => ({}) } });
  assert.ok(chain.map((l) => l.name).includes('gradio:remote'));
});

test('GET /model-runner/brain-chain describes the caller chain (no side effects)', async () => {
  const db = new MemoryDatabase();
  const brainProviderModel = new BrainProviderModel(db);
  const user = 'user_chain_endpoint';
  await brainProviderModel.setSelection(user, { provider: 'gradio', endpointUrl: 'https://abc123.gradio.live' });
  await brainProviderModel.setSelection(user, { provider: 'local', modelId: 'qwen3-8b-abliterated' });

  const modelRunnerService = {
    async library() {
      return [
        { id: 'qwen3-8b-abliterated', downloaded: true, sizeGB: 5.2 },
        { id: 'deepseek-r1-8b-abliterated', downloaded: true, sizeGB: 5.5 }
      ];
    }
  };
  const ctrl = createModelRunnerController({ modelRunnerService, brainProviderModel });
  const req = { user: { id: user } };
  let payload = null;
  const res = { json: (p) => { payload = p; } };
  await ctrl.brainChain(req, res, (e) => { throw e; });
  assert.equal(payload.provider, 'local');
  assert.equal(payload.remoteGpu, 'https://abc123.gradio.live');
  assert.deepEqual(payload.chain, [
    'local:qwen3-8b-abliterated',
    'local:deepseek-r1-8b-abliterated',
    'gradio:remote',
    'phone:api'
  ]);
});
