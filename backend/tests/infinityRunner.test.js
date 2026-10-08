/**
 * infinityRunner.test.js — unit tests for the Infinity AI Runner (koboldcpp-based engine).
 *
 * Covers: per-OS/GPU asset selection, download URL building, spawn-arg
 * building, and the download-state shape the UI's progress bar reads.
 * No network, no real downloads, no spawned processes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
  InfinityRunner,
  assetNameFor,
  downloadUrlFor,
  buildSpawnArgs,
  PINNED_RELEASE_TAG,
  RUNNER_DISPLAY_NAME
} from '../src/services/modelRunner/infinityRunner.js';

const realPlatform = os.platform;
const realArch = os.arch;

function mockPlatform(platform, arch) {
  Object.defineProperty(os, 'platform', { value: () => platform, configurable: true });
  Object.defineProperty(os, 'arch', { value: () => arch, configurable: true });
}

function restorePlatform() {
  Object.defineProperty(os, 'platform', { value: realPlatform, configurable: true });
  Object.defineProperty(os, 'arch', { value: realArch, configurable: true });
}

test('brand name is Infinity AI Runner (never koboldcpp in UI strings)', () => {
  assert.equal(RUNNER_DISPLAY_NAME, 'Infinity AI Runner');
  assert.ok(!RUNNER_DISPLAY_NAME.toLowerCase().includes('kobold'));
});

test('pinned release tag is a koboldcpp v-tag', () => {
  assert.match(PINNED_RELEASE_TAG, /^v\d+\.\d+/);
});

test('assetNameFor: windows x64 + NVIDIA -> cuda exe', () => {
  mockPlatform('win32', 'x64');
  try {
    assert.equal(assetNameFor('v1.122.1', { hasNvidia: true }), 'koboldcpp.exe');
  } finally { restorePlatform(); }
});

test('assetNameFor: windows x64 without GPU -> nocuda exe', () => {
  mockPlatform('win32', 'x64');
  try {
    assert.equal(assetNameFor('v1.122.1', { hasNvidia: false }), 'koboldcpp-nocuda.exe');
  } finally { restorePlatform(); }
});

test('assetNameFor: macOS arm64 -> mac-arm64 binary', () => {
  mockPlatform('darwin', 'arm64');
  try {
    assert.equal(assetNameFor('v1.122.1', {}), 'koboldcpp-mac-arm64');
  } finally { restorePlatform(); }
});

test('assetNameFor: macOS x64 (Intel) -> null (no official binary)', () => {
  mockPlatform('darwin', 'x64');
  try {
    assert.equal(assetNameFor('v1.122.1', {}), null);
  } finally { restorePlatform(); }
});

test('assetNameFor: linux x64 + NVIDIA -> cuda binary', () => {
  mockPlatform('linux', 'x64');
  try {
    assert.equal(assetNameFor('v1.122.1', { hasNvidia: true }), 'koboldcpp-linux-x64');
  } finally { restorePlatform(); }
});

test('assetNameFor: linux x64 without GPU -> nocuda binary', () => {
  mockPlatform('linux', 'x64');
  try {
    assert.equal(assetNameFor('v1.122.1', { hasNvidia: false }), 'koboldcpp-linux-x64-nocuda');
  } finally { restorePlatform(); }
});

test('assetNameFor: linux arm64 -> null (no official binary)', () => {
  mockPlatform('linux', 'arm64');
  try {
    assert.equal(assetNameFor('v1.122.1', {}), null);
  } finally { restorePlatform(); }
});

test('downloadUrlFor builds the GitHub release URL', () => {
  const url = downloadUrlFor('v1.122.1', 'koboldcpp-nocuda.exe');
  assert.equal(url, 'https://github.com/LostRuins/koboldcpp/releases/download/v1.122.1/koboldcpp-nocuda.exe');
});

test('buildSpawnArgs uses koboldcpp flags (not llama-server flags)', () => {
  const args = buildSpawnArgs({
    binaryPath: '/x/koboldcpp.exe',
    modelPath: '/m/model.gguf',
    port: 5123,
    contextSize: 8192,
    gpuLayers: 99
  });
  assert.deepEqual(args, [
    '/x/koboldcpp.exe',
    '--model', '/m/model.gguf',
    '--port', '5123',
    '--host', '127.0.0.1',
    '--contextsize', '8192',
    '--gpulayers', '99',
    '--quiet'
  ]);
  // Must not contain llama-server style flags
  assert.ok(!args.includes('-m'));
  assert.ok(!args.includes('-ngl'));
  assert.ok(!args.includes('-c'));
});

test('InfinityRunner: not ready when nothing downloaded; idle download state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  try {
    const runner = new InfinityRunner({ dataDir: dir, logger: { info() {} } });
    assert.equal(runner.isReady(), false);
    assert.equal(runner.binaryPath(), null);
    assert.deepEqual(runner.describeDownload(), { status: 'idle', progress: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('InfinityRunner: detects a downloaded binary and reports ready', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  try {
    const runnerDir = path.join(dir, 'model-runner', 'infinity-runner');
    fs.mkdirSync(runnerDir, { recursive: true });
    const name = os.platform() === 'win32' ? 'koboldcpp-nocuda.exe' : 'koboldcpp-linux-x64-nocuda';
    fs.writeFileSync(path.join(runnerDir, name), 'fake-binary');
    const runner = new InfinityRunner({ dataDir: dir, logger: { info() {} } });
    assert.equal(runner.isReady(), true);
    assert.ok(runner.binaryPath().endsWith(name));
    assert.deepEqual(runner.startEngineDownload({}), { ready: true, cached: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('InfinityRunner: startEngineDownload reports started (not auto-downloaded)', () => {
  // Owner's policy: download ONLY on explicit user action (Run click / Download
  // button) — startEngineDownload kicks it off in the background and returns
  // immediately; it must never block.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  const runner = new InfinityRunner({ dataDir: dir, logger: { info() {} } });
  let calls = 0;
  runner.ensureEngine = async () => { calls += 1; return { ready: false, started: true }; };
  try {
    const r1 = runner.startEngineDownload({});
    assert.equal(r1.started, true);
    assert.equal(calls, 1);
    // Second call while "downloading" must not start another download.
    runner.downloadState = { status: 'downloading' };
    const r2 = runner.startEngineDownload({});
    assert.equal(r2.inProgress, true);
    assert.equal(calls, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('InfinityRunner: emits progress events to listeners', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  try {
    const runner = new InfinityRunner({ dataDir: dir, logger: { info() {} } });
    const seen = [];
    const unsub = runner.onProgress((s) => seen.push(s));
    runner.downloadState = { status: 'downloading', receivedBytes: 50, totalBytes: 100 };
    runner.emit();
    unsub();
    runner.downloadState = { status: 'downloading', receivedBytes: 60, totalBytes: 100 };
    runner.emit(); // no listener — must not throw
    assert.equal(seen.length, 1);
    assert.equal(seen[0].progress, 0.5);
    assert.equal(seen[0].status, 'downloading');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
