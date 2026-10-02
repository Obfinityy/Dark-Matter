/**
 * engineManager.js — downloads + manages the llama.cpp `llama-server` binary.
 *
 * No Ollama, no npm native builds, no compiler needed on the user's machine:
 * the backend fetches the official prebuilt llama.cpp release archive for the
 * current OS/arch/GPU from GitHub and extracts `llama-server` into the data
 * dir. One-time download (~60-120MB), then fully offline.
 *
 * Asset naming (verified against ggml-org/llama.cpp releases, e.g. b11320):
 *   win32/x64 + NVIDIA → llama-b{TAG}-bin-win-cuda-12.4-x64.zip
 *   win32/x64          → llama-b{TAG}-bin-win-cpu-x64.zip
 *   win32/arm64        → llama-b{TAG}-bin-win-cpu-arm64.zip
 *   darwin/arm64       → llama-b{TAG}-bin-macos-arm64.tar.gz   (Metal built-in)
 *   darwin/x64         → llama-b{TAG}-bin-macos-x64.tar.gz
 *   linux/x64 + NVIDIA → llama-b{TAG}-bin-ubuntu-cuda-12.8-x64.tar.gz
 *   linux/x64          → llama-b{TAG}-bin-ubuntu-x64.tar.gz
 *   linux/arm64        → llama-b{TAG}-bin-ubuntu-arm64.tar.gz
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { downloadFile } from './downloadUtil.js';

const RELEASES_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases';
/** Last verified build tag — used when the GitHub API is unreachable. */
export const PINNED_BUILD_TAG = 'b11320';

/**
 * Pick the release asset name for this machine.
 * @param {string} tag  build tag like 'b11320'
 * @param {{hasNvidia:boolean}} device  from detectDevice()
 */
export function assetNameFor(tag, device = {}) {
  const platform = os.platform();
  const arch = os.arch();
  const cuda = device.hasNvidia === true;

  if (platform === 'win32') {
    if (arch === 'arm64') return `llama-${tag}-bin-win-cpu-arm64.zip`;
    return cuda ? `llama-${tag}-bin-win-cuda-12.4-x64.zip` : `llama-${tag}-bin-win-cpu-x64.zip`;
  }
  if (platform === 'darwin') {
    return arch === 'arm64' ? `llama-${tag}-bin-macos-arm64.tar.gz` : `llama-${tag}-bin-macos-x64.tar.gz`;
  }
  // linux and friends
  if (arch === 'arm64') return `llama-${tag}-bin-ubuntu-arm64.tar.gz`;
  return cuda ? `llama-${tag}-bin-ubuntu-cuda-12.8-x64.tar.gz` : `llama-${tag}-bin-ubuntu-x64.tar.gz`;
}

/** Latest build tag from the GitHub API, or the pinned fallback. */
export async function resolveBuildTag() {
  try {
    const response = await fetch(`${RELEASES_API}?per_page=3`, {
      headers: { 'user-agent': 'dark-matter-model-runner', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const releases = await response.json();
    const tag = releases?.[0]?.tag_name;
    if (typeof tag === 'string' && /^b\d+$/.test(tag)) return tag;
    throw new Error('No build tag in GitHub response');
  } catch {
    return PINNED_BUILD_TAG;
  }
}

function engineDir(dataDir) {
  return path.join(dataDir, 'model-runner', 'engine');
}

function binaryName() {
  return os.platform() === 'win32' ? 'llama-server.exe' : 'llama-server';
}

/** Recursively find llama-server(.exe) under dir (archives nest sometimes). */
function findBinary(dir) {
  const want = binaryName();
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === want) return full;
    }
  }
  return null;
}

/**
 * Extract an archive with the OS `tar` (libarchive handles .zip and .tar.gz
 * on Windows 10+, macOS and Linux — no npm dependency needed).
 */
function extractArchive(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    // --no-same-owner: release tarballs store numeric uids (e.g. 1001) that a
    // normal user cannot chown to — without this flag extraction fails with
    // "Cannot change ownership ... Operation not permitted" on Linux/macOS.
    const tar = spawn('tar', ['--no-same-owner', '-xf', archivePath, '-C', destDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    tar.stderr.on('data', (d) => { stderr += d; });
    tar.on('error', (error) => reject(new Error(`tar not available: ${error.message}`)));
    tar.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar extract failed (code ${code}): ${stderr.slice(0, 300)}`));
    });
  });
}

export class EngineManager {
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
    // The UI's progress bar reads `progress` (0–1). receivedBytes/totalBytes
    // alone left it stuck at 0% forever.
    const progress = totalBytes && totalBytes > 0
      ? Math.min(1, receivedBytes / totalBytes)
      : 0;
    return { ...this.downloadState, progress };
  }

  /** Absolute path of the engine binary, or null when not installed. */
  binaryPath() {
    return findBinary(engineDir(this.dataDir));
  }

  isReady() {
    return this.binaryPath() !== null;
  }

  /**
   * Kick off the engine download in the background; resolves immediately.
   * Progress (and the final done/error state) is emitted to onProgress
   * listeners — the UI follows it over the SSE stream. Used by the HTTP
   * endpoint so a slow download never blocks the request.
   */
  startEngineDownload(device = {}) {
    if (this.isReady()) return { ready: true, cached: true };
    if (this.downloadState?.status === 'downloading') return { ready: false, inProgress: true };
    // Fire and forget: ensureEngine records success/failure in downloadState.
    this.ensureEngine(device).catch(() => {});
    return { ready: false, started: true };
  }

  /**
   * Download + extract the engine. Emits progress via onProgress listeners.
   * Safe to call when already ready (no-op). Only one download at a time.
   */
  async ensureEngine(device = {}) {
    if (this.isReady()) return { ready: true, path: this.binaryPath(), cached: true };
    if (this.downloadState?.status === 'downloading') {
      return { ready: false, inProgress: true };
    }

    const tag = await resolveBuildTag();
    const asset = assetNameFor(tag, device);
    const url = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/${asset}`;
    const dir = engineDir(this.dataDir);
    fs.mkdirSync(dir, { recursive: true });
    const archivePath = path.join(dir, asset);

    this.downloadState = { status: 'downloading', tag, asset, receivedBytes: 0, totalBytes: null, error: null };
    this.emit();
    try {
      await downloadFile(url, archivePath, {
        headers: { 'user-agent': 'dark-matter-model-runner' },
        onProgress: (receivedBytes, totalBytes) => {
          this.downloadState.receivedBytes = receivedBytes;
          this.downloadState.totalBytes = totalBytes;
          this.emit();
        }
      });
      await extractArchive(archivePath, dir);
      const binary = this.binaryPath();
      if (!binary) throw new Error('llama-server binary not found after extracting the engine archive');
      if (os.platform() !== 'win32') {
        try { fs.chmodSync(binary, 0o755); } catch { /* best effort */ }
      }
      try { fs.unlinkSync(archivePath); } catch { /* keep disk clean, ignore */ }
      this.downloadState = { status: 'done', tag, asset, receivedBytes: this.downloadState.receivedBytes, totalBytes: this.downloadState.totalBytes, error: null };
      this.emit();
      return { ready: true, path: binary, cached: false };
    } catch (error) {
      this.downloadState = { status: 'error', tag, asset, receivedBytes: this.downloadState?.receivedBytes || 0, totalBytes: null, error: error.message };
      this.emit();
      throw error;
    }
  }
}
