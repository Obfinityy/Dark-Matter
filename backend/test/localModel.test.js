/**
 * DARKMATTER — local uncensored model library test suite (issue #3).
 *
 * Covers the "Run Locally" flow:
 *   • the curated uncensored library (all entries uncensored, small → large,
 *     exactly one default, hardware requirements present)
 *   • LocalModelService: Ollama detection, installed/ready status, disk
 *     usage, pull progress aggregation, allowlist enforcement, remove,
 *     activate/deactivate (brain switching via the onActivate hook)
 *   • BrainProviderModel: the persisted model-picker selection survives
 *     as a round-tripped document
 *   • OllamaProvider: same interface as PhoneLocalProvider; Qwen3 <think>
 *     tags are stripped; structured output parses
 *   • brainProviderFactory: 'phone' → PhoneLocalProvider, 'ollama' →
 *     OllamaProvider
 *
 * The only substitutes: MemoryDatabase instead of Mongo, and a stubbed
 * global fetch standing in for the Ollama daemon.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryDatabase } from '../src/models/database.js';
import { MODEL_LIBRARY, DEFAULT_MODEL_ID, getLibraryEntry, validateLibrary } from '../src/services/localModel/modelLibrary.js';
import { LocalModelService } from '../src/services/localModel/localModelService.js';
import { BrainProviderModel } from '../src/models/brainProviderModel.js';
import { OllamaProvider } from '../src/agent/providers/ollamaProvider.js';
import { PhoneLocalProvider } from '../src/agent/providers/phoneLocalProvider.js';
import { createBrainProvider, BRAIN_PROVIDERS } from '../src/agent/providers/brainProviderFactory.js';

// ── Library invariants ──────────────────────────────────────────────────

test('library: all entries are uncensored, small → large, one default', () => {
  const { valid, errors } = validateLibrary();
  assert.deepEqual(errors, [], `library invalid: ${errors.join('; ')}`);
  assert.ok(valid);
  assert.equal(MODEL_LIBRARY.length, 4);
  assert.ok(MODEL_LIBRARY.every((entry) => entry.uncensored === true), 'every entry must be uncensored');
  assert.equal(DEFAULT_MODEL_ID, 'qwen3-abliterated-30b');
  assert.equal(getLibraryEntry(DEFAULT_MODEL_ID).default, true);
});

test('library: every entry carries name, size, VRAM/disk needs, tier, description', () => {
  for (const entry of MODEL_LIBRARY) {
    assert.ok(entry.id, 'id');
    assert.ok(entry.ollamaTag, 'ollamaTag');
    assert.ok(entry.name, 'name');
    assert.ok(entry.tier, 'tier');
    assert.ok(typeof entry.downloadGB === 'number' && entry.downloadGB > 0, 'downloadGB');
    assert.ok(typeof entry.vramGB === 'number' && entry.vramGB > 0, 'vramGB');
    assert.ok(entry.description && entry.description.length > 20, 'one-line description');
  }
});

// ── Service with a stubbed Ollama daemon ─────────────────────────────────

const TAGS = {
  models: [
    { name: 'dolphin-llama3:8b', size: 4_700_000_000, digest: 'sha256:aaa', modified_at: '2026-01-01T00:00:00Z' }
  ]
};

function stubFetch({ versionOk = true, tags = TAGS, pullLines = [], deleteOk = true } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith('/api/version')) {
      return versionOk
        ? new Response(JSON.stringify({ version: '0.9.0' }), { status: 200 })
        : new Response('nope', { status: 500 });
    }
    if (target.endsWith('/api/tags')) {
      return new Response(JSON.stringify(tags), { status: 200 });
    }
    if (target.endsWith('/api/pull')) {
      const stream = new ReadableStream({
        start(controller) {
          for (const line of pullLines) controller.enqueue(new TextEncoder().encode(`${line}\n`));
          controller.close();
        }
      });
      return new Response(stream, { status: 200 });
    }
    if (target.endsWith('/api/delete')) {
      return new Response('{}', { status: deleteOk ? 200 : 404 });
    }
    throw new Error(`unexpected fetch: ${target}`);
  };
  return () => { globalThis.fetch = original; };
}

function makeService({ onActivate = null } = {}) {
  const database = new MemoryDatabase();
  const brainProviderModel = new BrainProviderModel(database);
  const service = new LocalModelService({
    config: { ollama: { host: '127.0.0.1', port: 11434 } },
    brainProviderModel,
    onActivate
  });
  return { service, brainProviderModel };
}

test('service.getStatus: annotates the library with installed/ready + disk usage + active brain', async () => {
  const restore = stubFetch();
  try {
    const { service } = makeService();
    const status = await service.getStatus();
    assert.equal(status.ollama.apiRunning, true);
    assert.equal(status.models.length, 4);
    const small = status.models.find((m) => m.id === 'dolphin-llama3-8b');
    assert.equal(small.installed, true);
    assert.equal(small.ready, true);
    assert.equal(small.sizeBytes, 4_700_000_000);
    const big = status.models.find((m) => m.id === 'dolphin-llama3-70b');
    assert.equal(big.installed, false);
    assert.equal(status.diskUsageBytes, 4_700_000_000);
    assert.equal(status.active.provider, 'phone');
    assert.equal(status.pull, null);
  } finally {
    restore();
  }
});

test('service.startPull: rejects unknown models and a stopped Ollama daemon', async () => {
  const restore = stubFetch({ versionOk: false });
  try {
    const { service } = makeService();
    await assert.rejects(() => service.startPull('gpt-5'), /Unknown model/);
    await assert.rejects(() => service.startPull('dolphin-llama3-8b'), /not running/);
  } finally {
    restore();
  }
});

test('service: pull progress aggregates per-digest bytes into a percent', async () => {
  const restore = stubFetch();
  try {
    const { service } = makeService();
    // Fake an in-flight pull and feed it NDJSON progress lines directly.
    service.pullState = {
      modelId: 'qwen3-abliterated-30b',
      ollamaTag: 'huihui_ai/qwen3-abliterated:30b',
      status: 'pulling',
      startedAt: new Date().toISOString(),
      digests: new Map(),
      error: null
    };
    service.applyPullLine({ status: 'downloading', digest: 'sha256:1', total: 100, completed: 50 });
    service.applyPullLine({ status: 'downloading', digest: 'sha256:2', total: 300, completed: 150 });
    let described = service.describePull();
    assert.equal(described.percent, 50);
    assert.equal(described.totalBytes, 400);
    assert.equal(described.completedBytes, 200);
    service.applyPullLine({ status: 'success' });
    described = service.describePull();
    assert.equal(described.status, 'success');
    assert.equal(described.percent, 100);
  } finally {
    restore();
  }
});

test('service.activate: requires the model to be installed, then switches the brain', async () => {
  const restore = stubFetch();
  try {
    const activations = [];
    const { service, brainProviderModel } = makeService({
      onActivate: async (userId, selection) => activations.push({ userId, ...selection })
    });
    const USER = 'user_activate_1';
    // Not downloaded → refuses honestly.
    await assert.rejects(() => service.activate(USER, 'dolphin-llama3-70b'), /not downloaded yet/);
    // Downloaded → persists the per-user selection AND notifies (the worker
    // rebuilds that user's brain from the new selection).
    const result = await service.activate(USER, 'dolphin-llama3-8b');
    assert.equal(result.active.provider, 'ollama');
    assert.equal(result.active.modelId, 'dolphin-llama3-8b');
    assert.deepEqual(activations, [{
      userId: USER,
      provider: 'ollama',
      modelId: 'dolphin-llama3-8b',
      ollamaTag: 'dolphin-llama3:8b'
    }]);
    const persisted = await brainProviderModel.getSelection(USER);
    assert.equal(persisted.provider, 'ollama');
    assert.equal(persisted.modelId, 'dolphin-llama3-8b');
    // A different user is unaffected — per-user isolation.
    const other = await brainProviderModel.getSelection('user_other');
    assert.equal(other.provider, 'phone');
    // Deactivate → back to the phone brain.
    const back = await service.deactivate(USER);
    assert.equal(back.active.provider, 'phone');
    assert.equal(activations.at(-1).provider, 'phone');
    assert.equal(activations.at(-1).userId, USER);
  } finally {
    restore();
  }
});

test('service.removeModel: deletes via Ollama and falls back from an active brain', async () => {
  const restore = stubFetch();
  try {
    const activations = [];
    const { service } = makeService({ onActivate: async (userId, selection) => activations.push({ userId, ...selection }) });
    const USER = 'user_remove_1';
    await service.activate(USER, 'dolphin-llama3-8b');
    const removed = await service.removeModel(USER, 'dolphin-llama3-8b');
    assert.deepEqual(removed, { removed: 'dolphin-llama3-8b' });
    // The removed model was the active brain → fell back to the phone.
    assert.equal(activations.at(-1).provider, 'phone');
    assert.equal(activations.at(-1).userId, USER);
    await assert.rejects(() => service.removeModel(USER, 'not-a-model'), /Unknown model/);
  } finally {
    restore();
  }
});

test('service: only one pull at a time', async () => {
  const restore = stubFetch();
  try {
    const { service } = makeService();
    service.pullState = { modelId: 'x', ollamaTag: 'x', status: 'pulling', startedAt: '', digests: new Map(), error: null };
    await assert.rejects(() => service.startPull('dolphin-llama3-8b'), /Already pulling/);
  } finally {
    restore();
  }
});

// ── BrainProviderModel ───────────────────────────────────────────────────

test('BrainProviderModel: selection persists and round-trips', async () => {
  const database = new MemoryDatabase();
  const model = new BrainProviderModel(database);
  const USER = 'user_bp_1';
  assert.deepEqual(await model.getSelection(USER), { provider: 'phone', modelId: null, ollamaTag: null, endpointUrl: null, lastGradioUrl: null, updatedAt: null });
  await model.setSelection(USER, { provider: 'ollama', modelId: 'qwen3-abliterated-30b', ollamaTag: 'huihui_ai/qwen3-abliterated:30b' });
  const selection = await model.getSelection(USER);
  assert.equal(selection.provider, 'ollama');
  assert.equal(selection.modelId, 'qwen3-abliterated-30b');
  assert.ok(selection.updatedAt);
  // Per-user isolation: another user still sees the default.
  assert.deepEqual(await model.getSelection('user_bp_2'), { provider: 'phone', modelId: null, ollamaTag: null, endpointUrl: null, lastGradioUrl: null, updatedAt: null });
  await assert.rejects(() => model.setSelection(USER, { provider: 'openai' }), /Unknown brain provider/);
});

// ── OllamaProvider ───────────────────────────────────────────────────────

test('OllamaProvider: implements the brain interface and strips Qwen3 thinking tags', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'huihui_ai/qwen3-abliterated:30b' }] }), { status: 200 });
    }
    if (target.endsWith('/v1/chat/completions')) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '<think>planning the attack</think>\n{"objective": "scan", "nextAction": {"type": "wait"}}' } }]
      }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${target}`);
  };
  try {
    const provider = new OllamaProvider({ ollama: { host: '127.0.0.1', port: 11434, model: 'huihui_ai/qwen3-abliterated:30b' } });
    assert.equal(provider.enabled, true);
    for (const method of ['healthCheck', 'generate', 'generateStructured', 'stream', 'resolveModel']) {
      assert.equal(typeof provider[method], 'function', method);
    }
    const health = await provider.healthCheck();
    assert.equal(health.reachable, true);
    assert.equal(health.modelInstalled, true);
    const text = await provider.generate([{ role: 'user', content: 'hi' }]);
    assert.ok(!text.includes('<think>'), 'thinking tags must be stripped');
    const structured = await provider.generateStructured([{ role: 'user', content: 'hi' }]);
    assert.equal(structured.objective, 'scan');
  } finally {
    globalThis.fetch = original;
  }
});

test('OllamaProvider.healthCheck: reports honestly when the daemon is down', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED'); };
  try {
    const provider = new OllamaProvider({ ollama: {} });
    const health = await provider.healthCheck();
    assert.equal(health.reachable, false);
    assert.ok(health.reason);
  } finally {
    globalThis.fetch = original;
  }
});

// ── Factory ──────────────────────────────────────────────────────────────

test('createBrainProvider: phone → PhoneLocalProvider, ollama → OllamaProvider', () => {
  assert.deepEqual([...BRAIN_PROVIDERS], ['phone', 'ollama', 'local', 'gradio']);
  const phone = createBrainProvider('phone', {});
  assert.ok(phone instanceof PhoneLocalProvider);
  const ollama = createBrainProvider('ollama', { ollama: { model: 'dolphin-llama3:8b' } }, { model: 'dolphin-llama3:8b' });
  assert.ok(ollama instanceof OllamaProvider);
  assert.equal(ollama.model, 'dolphin-llama3:8b');
});
