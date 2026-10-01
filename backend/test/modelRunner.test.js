/**
 * modelRunner.test.js — no-Ollama local GGUF runner ("Download → Run → localhost").
 *
 * Hermetic: no network, no real model, no engine binary. Network-touching
 * paths (actual GGUF/engine downloads, spawning llama-server) are validated
 * by hand, not here. These tests cover:
 *  - library entries: valid HF refs, requirements present, default set
 *  - sanitizeHfPart: traversal / garbage rejected, valid refs accepted
 *  - device ranking: blocked / risky / tight / ready verdicts
 *  - engine asset naming per OS/arch/GPU
 *  - runner service: downloaded detection, validation errors, custom-model
 *    validation, stop-when-idle, download cancel-when-idle
 *  - LocalLlamaProvider: honest "not running" health + errors
 *  - factory: 'local' provider builds with a runner
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  MODEL_LIBRARY, getLibraryEntry, getDefaultEntry, hfDownloadUrl, sanitizeHfPart
} from '../src/services/modelRunner/modelLibrary.js';
import { rankModelForDevice } from '../src/services/modelRunner/deviceInfo.js';
import { assetNameFor } from '../src/services/modelRunner/engineManager.js';
import { ModelRunnerService } from '../src/services/modelRunner/modelRunnerService.js';
import { LocalLlamaProvider } from '../src/agent/providers/localLlamaProvider.js';
import { createBrainProvider } from '../src/agent/providers/brainProviderFactory.js';

// ── Library ──────────────────────────────────────────────────────────

test('library: every entry has a valid Hugging Face reference + requirements', () => {
  assert.ok(MODEL_LIBRARY.length >= 2, 'expected a curated library');
  for (const model of MODEL_LIBRARY) {
    assert.match(model.hfRepo, /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]+$/);
    assert.match(model.hfFile, /\.gguf$/i);
    assert.ok(model.requirements && Number(model.requirements.ramGB) > 0);
    assert.equal(typeof model.requirements.gpuRequired, 'boolean');
    assert.ok(model.sizeGB > 0);
  }
});

test('library: default entry exists and getLibraryEntry is null-safe', () => {
  assert.ok(getDefaultEntry()?.id);
  assert.equal(getLibraryEntry('nope'), null);
  assert.equal(getLibraryEntry(null), null);
  assert.equal(getLibraryEntry(42), null);
});

test('sanitizeHfPart: rejects traversal and garbage, accepts valid refs', () => {
  assert.throws(() => sanitizeHfPart('../evil', 'repo'), /path traversal/);
  assert.throws(() => sanitizeHfPart('/abs/path', 'file'), /path traversal/);
  assert.throws(() => sanitizeHfPart('', 'repo'), /empty/);
  assert.throws(() => sanitizeHfPart('not a repo!', 'repo'), /not a valid/);
  assert.equal(sanitizeHfPart('dphn/Dolphin3.0-Llama3.1-8B-GGUF', 'repo'), 'dphn/Dolphin3.0-Llama3.1-8B-GGUF');
  assert.equal(sanitizeHfPart('model-Q4_K_M.gguf', 'file'), 'model-Q4_K_M.gguf');
  assert.equal(
    hfDownloadUrl('dphn/Dolphin3.0-Llama3.1-8B-GGUF', 'Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf'),
    'https://huggingface.co/dphn/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf'
  );
});

// ── Device ranking ───────────────────────────────────────────────────

const model8b = MODEL_LIBRARY[0]; // Dolphin 8B: ramGB 8, vramGB 0
const model27b = MODEL_LIBRARY.find((m) => m.id === 'qwen3-27b-abliterated');

function device(overrides = {}) {
  return {
    os: 'linux', arch: 'x64', totalRamGB: 16, freeRamGB: 12,
    gpus: [], primaryGpu: null, hasNvidia: false,
    ...overrides
  };
}

test('ranking: 8B model is ready on a 16GB CPU-only machine', () => {
  const { verdict, reasons } = rankModelForDevice(model8b, device());
  assert.equal(verdict, 'ready');
  assert.ok(reasons.length > 0);
});

test('ranking: 8B model is risky on a 7GB machine (user asked for this warning)', () => {
  const { verdict, reasons } = rankModelForDevice(model8b, device({ totalRamGB: 7 }));
  assert.equal(verdict, 'risky');
  assert.match(reasons[0], /risky/i);
});

test('ranking: 27B model is blocked on an 8GB machine (weights cannot fit)', () => {
  const { verdict } = rankModelForDevice(model27b, device({ totalRamGB: 8 }));
  assert.equal(verdict, 'blocked');
});

test('ranking: gpuRequired model is blocked without a GPU', () => {
  const gpuOnly = { ...model8b, requirements: { ramGB: 8, vramGB: 12, gpuRequired: true } };
  const { verdict, reasons } = rankModelForDevice(gpuOnly, device({ totalRamGB: 32 }));
  assert.equal(verdict, 'blocked');
  assert.match(reasons[0], /GPU/i);
});

test('ranking: tight when the model wants >60% of RAM', () => {
  const { verdict } = rankModelForDevice(model8b, device({ totalRamGB: 12 }));
  assert.equal(verdict, 'tight'); // 8/12 = 0.67
});

// ── Engine asset naming ──────────────────────────────────────────────

test('assetNameFor: picks the right llama.cpp release asset', () => {
  assert.equal(assetNameFor('b11320', { hasNvidia: true }), 'llama-b11320-bin-ubuntu-cuda-12.8-x64.tar.gz');
  assert.equal(assetNameFor('b11320', { hasNvidia: false }), 'llama-b11320-bin-ubuntu-x64.tar.gz');
});

// ── Runner service (temp data dir, no network) ───────────────────────

function tempRunner() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-runner-test-'));
  const runner = new ModelRunnerService({ dataDir, logger: { info() {} } });
  return { runner, dataDir };
}

test('runner: isDownloaded is false on a fresh dir, true with a full-size file', () => {
  const { runner, dataDir } = tempRunner();
  const model = getLibraryEntry('dolphin-llama31-8b');
  assert.equal(runner.isDownloaded(model), false);
  const filePath = runner.modelFilePath(model);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Write a sparse file of the expected size (no real 5GB written).
  const fd = fs.openSync(filePath, 'w');
  fs.ftruncateSync(fd, Math.ceil(model.sizeGB * 1024 ** 3));
  fs.closeSync(fd);
  assert.equal(runner.isDownloaded(model), true);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: startDownload rejects unknown models without touching the network', async () => {
  const { runner, dataDir } = tempRunner();
  await assert.rejects(() => runner.startDownload('nope'), /Unknown model/);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: startDownload short-circuits when already downloaded', async () => {
  const { runner, dataDir } = tempRunner();
  const model = getLibraryEntry('dolphin-llama31-8b');
  const filePath = runner.modelFilePath(model);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fd = fs.openSync(filePath, 'w');
  fs.ftruncateSync(fd, Math.ceil(model.sizeGB * 1024 ** 3));
  fs.closeSync(fd);
  const result = await runner.startDownload(model.id);
  assert.equal(result.alreadyDownloaded, true);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: run refuses when the model is not downloaded', async () => {
  const { runner, dataDir } = tempRunner();
  await assert.rejects(() => runner.run('dolphin-llama31-8b'), /not downloaded/);
  await assert.rejects(() => runner.run('nope'), /Unknown model/);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: stop and cancelDownload are safe no-ops when idle', async () => {
  const { runner, dataDir } = tempRunner();
  assert.deepEqual(await runner.stop(), { stopped: false });
  assert.deepEqual(runner.cancelDownload(), { cancelled: false });
  assert.equal(runner.endpoint(), null);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: deleteModel rejects unknown models', async () => {
  const { runner, dataDir } = tempRunner();
  await assert.rejects(() => runner.deleteModel('nope'), /Unknown model/);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: addCustomModel validates before any network', async () => {
  const { runner, dataDir } = tempRunner();
  await assert.rejects(
    () => runner.addCustomModel({ repo: 'a/b', file: 'model.bin', name: 'x' }),
    /Only \.gguf/
  );
  await assert.rejects(
    () => runner.addCustomModel({ repo: '../evil', file: 'm.gguf' }),
    /path traversal/
  );
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runner: status() shape is complete without network', async () => {
  const { runner, dataDir } = tempRunner();
  // Stub device detection to avoid spawning subprocesses in tests.
  runner.getDevice = async () => device();
  const status = await runner.status();
  assert.ok(status.device);
  assert.equal(status.engineReady, false);
  assert.equal(status.running, null);
  assert.ok(Array.isArray(status.models) && status.models.length >= 2);
  assert.ok(status.models.every((m) => m.compatibility && m.compatibility.verdict));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// ── Provider ─────────────────────────────────────────────────────────

test('LocalLlamaProvider: honest health + errors when nothing is running', async () => {
  const { runner, dataDir } = tempRunner();
  const provider = new LocalLlamaProvider({ runner });
  const health = await provider.healthCheck();
  assert.equal(health.reachable, false);
  assert.match(health.reason, /No local model is running/);
  await assert.rejects(() => provider.generate([{ role: 'user', content: 'hi' }]), /No local model is running/);
  assert.throws(() => new LocalLlamaProvider({}), /requires a ModelRunnerService/);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('factory: "local" provider builds with a runner', () => {
  const { runner, dataDir } = tempRunner();
  const provider = createBrainProvider('local', {}, { runner });
  assert.ok(provider instanceof LocalLlamaProvider);
  assert.equal(provider.enabled, true);
  fs.rmSync(dataDir, { recursive: true, force: true });
});
