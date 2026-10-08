/**
 * infinityRunner.js — downloads + manages the "Infinity AI Runner" engine.
 *
 * The Runner is a single self-contained executable based on koboldcpp
 * (https://github.com/LostRuins/koboldcpp, AGPL-3.0 — see THIRD_PARTY_NOTICES.md):
 * one file per OS, zero install, no Node.js, no compiler, no scripts. It runs
 * GGUF models on the user's own computer and serves them on localhost through
 * an OpenAI-compatible API (/v1/chat/completions, /v1/models).
 *
 * In the product UI it is ALWAYS called "Infinity AI Runner" — never koboldcpp.
 *
 * Download policy (owner's choice): the binary downloads ONLY when the user
 * clicks Run on a model — never automatically on page open. runForSlot()/run()
 * call ensureRunner() first, so the first Run transparently fetches the engine
 * (progress streams over the existing SSE channel) and then starts the model.
 *
 * Asset naming (verified against koboldcpp releases, v1.122.1):
 *   win32/x64 + NVIDIA → koboldcpp.exe                 (636 MB, CUDA)
 *   win32/x64          → koboldcpp-nocuda.exe          (117 MB, CPU+Vulkan)
 *   darwin/arm64       → koboldcpp-mac-arm64           (67 MB, Metal)
 *   linux/x64 + NVIDIA → koboldcpp-linux-x64           (642 MB, CUDA)
 *   linux/x64          → koboldcpp-linux-x64-nocuda     (137 MB)
 * Platforms without an official binary (Intel macOS, ARM Linux/Windows)
 * report a clear UNSUPPORTED_PLATFORM error instead of a broken download.
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { downloadFile } from './downloadUtil.js';

const RELEASES_API = 'https://api.github.com/repos/LostRuins/koboldcpp/releases';
const DOWNLOAD_BASE = 'https://github.com/LostRuins/koboldcpp/releases/download';
/** Last verified release tag — used when the GitHub API is unreachable. */
export const PINNED_RELEASE_TAG = 'v1.122.1';
/** Brand name shown everywhere in the product UI. */
export const RUNNER_DISPLAY_NAME = 'Infinity AI Runner';

/**
 * Pick the koboldcpp release asset for this machine.
 * @param {string} _tag  release tag like 'v1.122.1' (asset names are tag-independent)
 * @param {{hasNvidia:boolean}} device  from detectDevice()
 * @returns {string|null} asset filename, or null when the platform has no official binary
 */
export function assetNameFor(_tag, device = {}) {
  const platform = os.platform();
  const arch = os.arch();
  const cuda = device.hasNvidia === true;

  if (platform === 'win32') {
    if (arch === 'arm64') return 'koboldcpp-nocuda.exe'; // no ARM64 build; x64 runs emulated
    return cuda ? 'koboldcpp.exe' : 'koboldcpp-nocuda.exe';
  }
  if (platform === 'darwin') {
    // Official binary is Apple-Silicon only; Intel Macs must build from source.
    return arch === 'arm64' ? 'koboldcpp-mac-arm64' : null;
  }
  // linux and friends
  if (arch === 'arm64') return null; // no official ARM Linux binary
  return cuda ? 'koboldcpp-linux-x64' : 'koboldcpp-linux-x64-nocuda';
}

/** Latest release tag from the GitHub API, or the pinned fallback. */
export async function resolveReleaseTag() {
  try {
    const response = await fetch(`${RELEASES_API}?per_page=3`, {
      headers: { 'user-agent': 'dark-matter-infinity-runner', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const releases = await response.json();
    const tag = releases?.[0]?.tag_name;
    if (typeof tag === 'string' && /^v\d+\.\d+/.test(tag)) return tag;
    throw new Error('No release tag in GitHub response');
  } catch {
    return PINNED_RELEASE_TAG;
  }
}

export function downloadUrlFor(tag, asset) {
  return `${DOWNLOAD_BASE}/${tag}/${asset}`;
}

function runnerDir(dataDir) {
  return path.join(dataDir, 'model-runner', 'infinity-runner');
}

function binaryNameForAsset(asset) {
  return asset; // koboldcpp ships as a single executable — the asset IS the binary
}

/**
 * CLI args to launch the Runner headless with a model.
 * koboldcpp flags (see `koboldcpp --help`): --model, --port, --host,
 * --contextsize, --gpulayers, --quiet, --mmproj.
 * @param {string} [mmprojPath] — vision projector for multimodal models
 *   (Qwen2.5-VL / OS-Atlas / UI-TARS). Omit for text-only models. WITHOUT it
 *   a vision model loads text-only and screenshots are invisible to it.
 */
export function buildSpawnArgs({ binaryPath, modelPath, port, contextSize = 8192, gpuLayers = 0, mmprojPath = null }) {
  const args = [
    binaryPath,
    '--model', modelPath,
    '--port', String(port),
    '--host', '127.0.0.1',
    '--contextsize', String(contextSize),
    '--gpulayers', String(gpuLayers),
    '--quiet'
  ];
  if (mmprojPath) args.push('--mmproj', mmprojPath);
  return args;
}

/** Poll the Runner's OpenAI-compatible API until it answers, or time out. */
export async function waitForRunnerReady(baseUrl, timeoutMs = 240000) {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return true;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

export class InfinityRunner {
  constructor({ dataDir, logger = console } = {}) {
    // Same convention as FileMemory: ~/.darkmatter unless overridden.
    this.dataDir = dataDir || process.env.DARKMATTER_DATA_DIR || path.join(os.homedir(), '.darkmatter');
    this.logger = logger;
    this.downloadState = null; // { status, tag, asset, receivedBytes, totalBytes, error }
    this.listeners = new Set();
  }

  onProgress(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      try { listener(this.describeDownload()); } catch { /* ignore */ }
    }
  }

  describeDownload() {
    if (!this.downloadState) return { status: 'idle', progress: 0 };
    const { receivedBytes = 0, totalBytes = null } = this.downloadState;
    const progress = totalBytes && totalBytes > 0
      ? Math.min(1, receivedBytes / totalBytes)
      : 0;
    return { ...this.downloadState, progress };
  }

  /** Absolute path of the Runner binary, or null when not installed. */
  binaryPath() {
    const dir = runnerDir(this.dataDir);
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return null;
    }
    const want = os.platform() === 'win32' ? /\.exe$/i : /^(koboldcpp-.*|koboldcpp)$/;
    for (const entry of entries) {
      if (want.test(entry)) {
        const full = path.join(dir, entry);
        try {
          if (fs.statSync(full).isFile()) return full;
        } catch { /* ignore */ }
      }
    }
    return null;
  }

  isReady() {
    return this.binaryPath() !== null;
  }

  /**
   * Kick off the Runner download in the background; resolves immediately.
   * Progress (and the final done/error state) is emitted to onProgress
   * listeners — the UI follows it over the SSE stream.
   */
  startEngineDownload(device = {}) {
    if (this.isReady()) return { ready: true, cached: true };
    if (this.downloadState?.status === 'downloading') return { ready: false, inProgress: true };
    this.ensureEngine(device).catch(() => {});
    return { ready: false, started: true };
  }

  /**
   * Download the Runner binary for this machine. Safe to call when already
   * ready (no-op). Only one download at a time. This is what Run calls, so
   * the engine downloads ONLY when the user clicks Run — never on page open.
   */
  async ensureEngine(device = {}) {
    if (this.isReady()) return { ready: true, path: this.binaryPath(), cached: true };
    if (this.downloadState?.status === 'downloading') {
      return { ready: false, inProgress: true };
    }

    const tag = await resolveReleaseTag();
    const asset = assetNameFor(tag, device);
    if (!asset) {
      const error = new Error(
        `${RUNNER_DISPLAY_NAME} has no official binary for ${os.platform()}/${os.arch()} — ` +
        'see https://github.com/LostRuins/koboldcpp for build-from-source instructions.'
      );
      error.code = 'UNSUPPORTED_PLATFORM';
      throw error;
    }
    const url = downloadUrlFor(tag, asset);
    const dir = runnerDir(this.dataDir);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, binaryNameForAsset(asset));

    this.downloadState = { status: 'downloading', tag, asset, receivedBytes: 0, totalBytes: null, error: null };
    this.emit();
    try {
      await downloadFile(url, destPath, {
        headers: { 'user-agent': 'dark-matter-infinity-runner' },
        onProgress: (receivedBytes, totalBytes) => {
          this.downloadState.receivedBytes = receivedBytes;
          this.downloadState.totalBytes = totalBytes;
          this.emit();
        }
      });
      if (os.platform() !== 'win32') {
        try { fs.chmodSync(destPath, 0o755); } catch { /* best effort */ }
      }
      const binary = this.binaryPath();
      if (!binary) throw new Error(`${RUNNER_DISPLAY_NAME} binary not found after download`);
      this.downloadState = { status: 'done', tag, asset, receivedBytes: this.downloadState.receivedBytes, totalBytes: this.downloadState.totalBytes, error: null };
      this.emit();
      this.logger.info?.(`[infinity-runner] ${RUNNER_DISPLAY_NAME} ready at ${binary}`);
      return { ready: true, path: binary, cached: false };
    } catch (error) {
      try { fs.unlinkSync(destPath); } catch { /* ignore partial file */ }
      this.downloadState = { status: 'error', tag, asset, receivedBytes: this.downloadState?.receivedBytes || 0, totalBytes: null, error: error.message };
      this.emit();
      throw error;
    }
  }

  /**
   * Spawn the Runner with a model on 127.0.0.1:port. Resolves with the child
   * process once /v1/models answers. Rejects when the binary exits early or
   * never becomes healthy.
   */
  async spawnWithModel({ modelPath, port, contextSize = 8192, gpuLayers = 0, modelName = 'model', mmprojPath = null }) {
    const binary = this.binaryPath();
    if (!binary) {
      const error = new Error(`${RUNNER_DISPLAY_NAME} is not downloaded yet`);
      error.code = 'RUNNER_MISSING';
      throw error;
    }
    const args = buildSpawnArgs({ binaryPath: binary, modelPath, port, contextSize, gpuLayers, mmprojPath });
    // buildSpawnArgs returns [binary, ...flags]; spawn needs them split.
    const child = spawn(args[0], args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;

    let stderrTail = '';
    child.stderr.on('data', (d) => { stderrTail = `${stderrTail}${d}`.slice(-2000); });
    const earlyExit = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    const exited = await Promise.race([
      earlyExit.then((code) => ({ exited: true, code })),
      waitForRunnerReady(baseUrl).then((healthy) => ({ exited: false, healthy }))
    ]);

    if (exited.exited || exited.healthy === false) {
      const reason = exited.exited
        ? `${RUNNER_DISPLAY_NAME} exited immediately (code ${exited.code}): ${stderrTail.slice(-300)}`
        : `${RUNNER_DISPLAY_NAME} did not become healthy in time`;
      try { child.kill(); } catch { /* ignore */ }
      const error = new Error(reason);
      error.code = 'RUN_FAILED';
      throw error;
    }
    this.logger.info?.(`[infinity-runner] ${modelName} healthy at ${baseUrl}`);
    return { child, baseUrl };
  }
}
