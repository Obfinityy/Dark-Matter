/**
 * modelRunnerService.js — the no-Ollama local model runner.
 *
 * Owns the whole "Download → Run → localhost" flow:
 *   • library()        — curated GGUF models + device-compatibility ranking
 *   • device()         — detected hardware snapshot
 *   • download(model)  — stream a GGUF from Hugging Face with progress
 *   • run(model)       — ensure engine, spawn llama-server on 127.0.0.1,
 *                        wait for /health, expose the OpenAI-compatible base URL
 *   • stop()           — kill the server, free RAM/VRAM
 *   • status()         — everything the Models UI needs in one call
 *
 * Layout under <dataDir>/model-runner/:
 *   engine/            — extracted llama-server binary (one-time download)
 *   models/<id>/      — <id>.gguf per library model, custom/<n>.gguf for customs
 *
 * Only ONE model runs at a time (one brain per machine). The running
 * endpoint is consumed by LocalLlamaProvider — the Hunt + Infinity AI brain.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { MODEL_LIBRARY, getLibraryEntry, hfDownloadUrl, sanitizeHfPart } from './modelLibrary.js';
import { detectDevice, rankModelForDevice } from './deviceInfo.js';
import { EngineManager } from './engineManager.js';
import { downloadFile } from './downloadUtil.js';

/** Same convention as FileMemory: ~/.darkmatter unless overridden. */
function defaultDataDir() {
  return process.env.DARKMATTER_DATA_DIR || path.join(os.homedir(), '.darkmatter');
}

function runnerRoot(dataDir) {
  return path.join(dataDir, 'model-runner');
}

function modelsDir(dataDir) {
  return path.join(runnerRoot(dataDir), 'models');
}

/** Find a free 127.0.0.1 port for llama-server. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 180000) {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return true;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export class ModelRunnerService {
  constructor({ dataDir, logger = console } = {}) {
    this.dataDir = dataDir || defaultDataDir();
    this.logger = logger;
    this.engine = new EngineManager({ dataDir: this.dataDir, logger });
    this.deviceCache = null;
    this.deviceCacheAt = 0;

    // Download state: { kind:'model', modelId, name, url, receivedBytes, totalBytes, status, error }
    this.downloadState = null;
    this.downloadAbort = null;
    this.downloadListeners = new Set();

    // Custom models added by the user: [{ id, name, repo, file, sizeGB, requirements }]
    // Persisted to disk so they survive backend restarts (issue: in-memory only).
    this.customModels = [];
    this.customSeq = 0;
    this._loadCustomModels();

    // Running server: { modelId, name, pid, port, baseUrl, startedAt } | null
    this.running = null;
    this.runListeners = new Set();
  }

  /** Path of the JSON file that persists user-added custom models. */
  customModelsPath() {
    return path.join(this.dataDir, 'model-runner', 'custom-models.json');
  }

  _loadCustomModels() {
    try {
      const raw = fs.readFileSync(this.customModelsPath(), 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.customModels = parsed.filter((m) => m && typeof m.id === 'string');
        // Keep the sequence ahead of any persisted custom-N id.
        for (const m of this.customModels) {
          const n = Number(String(m.id).replace('custom-', ''));
          if (Number.isFinite(n) && n > this.customSeq) this.customSeq = n;
        }
      }
    } catch {
      // No file yet or unreadable — start empty.
    }
  }

  _saveCustomModels() {
    try {
      const file = this.customModelsPath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(this.customModels, null, 2));
    } catch (error) {
      this.logger?.warn?.(`[model-runner] could not persist custom models: ${error.message}`);
    }
  }

  // ── Device ─────────────────────────────────────────────────────────

  async getDevice() {
    if (this.deviceCache && Date.now() - this.deviceCacheAt < 60_000) return this.deviceCache;
    const device = await detectDevice();
    this.deviceCache = device;
    this.deviceCacheAt = Date.now();
    return device;
  }

  // ── Library + status ───────────────────────────────────────────────

  allModels() {
    return [...MODEL_LIBRARY, ...this.customModels];
  }

  findModel(modelId) {
    return this.allModels().find((m) => m.id === modelId) || null;
  }

  modelFilePath(model) {
    const safeId = String(model.id).replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(modelsDir(this.dataDir), safeId, `${safeId}.gguf`);
  }

  /** Is the GGUF fully on disk? (size sanity check when known) */
  isDownloaded(model) {
    try {
      const stat = fs.statSync(this.modelFilePath(model));
      if (stat.size <= 0) return false;
      // Prefer the exact byte size captured at registration (custom models);
      // the rounded sizeGB can over-estimate (e.g. 0.4576GB → 0.5GB) and a
      // fully-downloaded file would then wrongly read as incomplete.
      const expected = model.sizeBytes || (model.sizeGB ? model.sizeGB * 1024 ** 3 : 0);
      if (expected > 0 && stat.size < expected * 0.99) return false;
      return true;
    } catch {
      return false;
    }
  }

  downloadedBytes(model) {
    try {
      return fs.statSync(this.modelFilePath(model)).size;
    } catch {
      return 0;
    }
  }

  async library() {
    const device = await this.getDevice();
    return this.allModels().map((model) => ({
      ...model,
      downloaded: this.isDownloaded(model),
      downloadedBytes: this.downloadedBytes(model),
      running: this.running?.modelId === model.id,
      compatibility: rankModelForDevice(model, device)
    }));
  }

  async status() {
    const device = await this.getDevice();
    // Adopt a server orphaned by a backend restart so the UI stays truthful.
    await this._reattachIfOrphaned();
    return {
      device,
      engineReady: this.engine.isReady(),
      engineDownload: this.engine.describeDownload(),
      download: this.downloadState ? { ...this.downloadState } : { status: 'idle' },
      running: this.running ? { ...this.running } : null,
      models: (await this.library()).map((m) => ({
        id: m.id, name: m.name, params: m.params, tier: m.tier, sizeGB: m.sizeGB,
        downloaded: m.downloaded, running: m.running, compatibility: m.compatibility
      }))
    };
  }

  // ── Download ───────────────────────────────────────────────────────

  onDownloadProgress(listener) {
    this.downloadListeners.add(listener);
    return () => this.downloadListeners.delete(listener);
  }

  emitDownload() {
    const snapshot = this.downloadState ? { ...this.downloadState } : { status: 'idle' };
    for (const listener of this.downloadListeners) {
      try { listener(snapshot); } catch { /* ignore */ }
    }
  }

  describeDownload() {
    return this.downloadState ? { ...this.downloadState } : { status: 'idle' };
  }

  /**
   * Start downloading a model's GGUF. Returns immediately; progress flows
   * through onDownloadProgress / describeDownload. Only one at a time.
   */
  async startDownload(modelId) {
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    if (this.isDownloaded(model)) return { alreadyDownloaded: true, modelId };
    if (this.downloadState?.status === 'downloading') {
      const error = new Error('Another download is already in progress');
      error.code = 'DOWNLOAD_BUSY';
      throw error;
    }

    const repo = sanitizeHfPart(model.hfRepo || model.repo, 'repo');
    const file = sanitizeHfPart(model.hfFile || model.file, 'file');
    const url = hfDownloadUrl(repo, file);
    const destPath = this.modelFilePath(model);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const controller = new AbortController();
    this.downloadAbort = controller;
    this.downloadState = {
      status: 'downloading', modelId: model.id, name: model.name, url,
      receivedBytes: this.downloadedBytes(model), totalBytes: null, error: null
    };
    this.emitDownload();

    // Fire-and-forget: the UI polls describeDownload / SSE.
    downloadFile(url, destPath, {
      signal: controller.signal,
      onProgress: (receivedBytes, totalBytes) => {
        if (!this.downloadState || this.downloadState.modelId !== model.id) return;
        this.downloadState.receivedBytes = receivedBytes;
        this.downloadState.totalBytes = totalBytes;
        this.emitDownload();
      }
    }).then(
      ({ bytes }) => {
        this.downloadState = { status: 'done', modelId: model.id, name: model.name, url, receivedBytes: bytes, totalBytes: bytes, error: null };
        this.downloadAbort = null;
        this.emitDownload();
      },
      (error) => {
        const cancelled = controller.signal.aborted;
        this.downloadState = {
          status: cancelled ? 'cancelled' : 'error',
          modelId: model.id, name: model.name, url,
          receivedBytes: this.downloadedBytes(model), totalBytes: null,
          error: cancelled ? 'Cancelled by user' : error.message
        };
        this.downloadAbort = null;
        this.emitDownload();
      }
    );

    return { started: true, modelId: model.id };
  }

  cancelDownload() {
    if (this.downloadAbort) {
      this.downloadAbort.abort();
      return { cancelled: true };
    }
    return { cancelled: false };
  }

  /** Delete a downloaded GGUF to free disk (stops it first if running). */
  async deleteModel(modelId) {
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    if (this.running?.modelId === modelId) await this.stop();
    if (this.downloadState?.modelId === modelId && this.downloadState.status === 'downloading') {
      this.cancelDownload();
    }
    try {
      fs.rmSync(path.dirname(this.modelFilePath(model)), { recursive: true, force: true });
    } catch { /* ignore */ }
    // For user-added custom models, deleting also removes the library entry
    // (otherwise a dead entry would linger in the UI).
    if (model.custom) {
      this.customModels = this.customModels.filter((m) => m.id !== model.id);
      this._saveCustomModels();
    }
    return { deleted: true, modelId };
  }

  /**
   * Add a user-specified model: any public Hugging Face GGUF.
   * Validates the reference with a HEAD request before accepting it.
   */
  async addCustomModel({ repo, file, name, ramGB }) {
    const cleanRepo = sanitizeHfPart(repo, 'repo');
    const cleanFile = sanitizeHfPart(file, 'file');
    if (!/\.gguf$/i.test(cleanFile)) {
      const error = new Error('Only .gguf model files are supported');
      error.code = 'INVALID_MODEL_REF';
      throw error;
    }
    // Optional user-supplied RAM requirement (GB); falls back to a safe 8GB
    // when omitted so the compatibility ranking stays conservative.
    const ramNeed = Number(ramGB);
    const ramGBValue = Number.isFinite(ramNeed) && ramNeed > 0 ? Math.min(Math.round(ramNeed * 10) / 10, 512) : 8;
    const url = hfDownloadUrl(cleanRepo, cleanFile);
    let sizeGB = null;
    let sizeBytes = null;
    try {
      const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      if (!head.ok) throw new Error(`Hugging Face returned HTTP ${head.status}`);
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length > 0) {
        sizeBytes = length;
        sizeGB = Math.round((length / 1024 ** 3) * 10) / 10;
      }
    } catch (error) {
      const err = new Error(`Could not reach that model file: ${error.message}`);
      err.code = 'MODEL_UNREACHABLE';
      throw err;
    }

    this.customSeq += 1;
    const model = {
      id: `custom-${this.customSeq}`,
      name: (typeof name === 'string' && name.trim().slice(0, 80)) || `${cleanRepo.split('/')[1] || cleanRepo}`,
      params: 'custom',
      quant: /Q4_K_M/i.test(cleanFile) ? 'Q4_K_M' : 'GGUF',
      tier: 'custom',
      tierLabel: 'Custom',
      repo: cleanRepo,
      file: cleanFile,
      sizeGB,
      sizeBytes,
      contextWindow: null,
      uncensored: null, // unknown — user's own choice
      custom: true,
      requirements: { ramGB: ramGBValue, vramGB: 0, gpuRequired: false },
      description: `User-added model from Hugging Face: ${cleanRepo}`
    };
    this.customModels.push(model);
    this._saveCustomModels();
    return { added: true, model };
  }

  // ── Run / Stop ─────────────────────────────────────────────────────

  onRunChange(listener) {
    this.runListeners.add(listener);
    return () => this.runListeners.delete(listener);
  }

  emitRun() {
    const snapshot = this.running ? { ...this.running } : null;
    for (const listener of this.runListeners) {
      try { listener(snapshot); } catch { /* ignore */ }
    }
  }

  /** The OpenAI-compatible base URL of the running model (null when stopped). */
  endpoint() {
    return this.running ? `${this.running.baseUrl}/v1` : null;
  }

  /** Sync variant used on read paths: adopt an orphaned server if present. */
  async ensureRunningState() {
    await this._reattachIfOrphaned();
    return this.running;
  }

  /** Path of the JSON file tracking the currently-running model server. */
  runStatePath() {
    return path.join(this.dataDir, 'model-runner', 'running.json');
  }

  _writeRunState() {
    try {
      const file = this.runStatePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (this.running) fs.writeFileSync(file, JSON.stringify(this.running));
      else try { fs.unlinkSync(file); } catch { /* already gone */ }
    } catch (error) {
      this.logger?.warn?.(`[model-runner] could not persist run state: ${error.message}`);
    }
  }

  /** Is this pid alive? */
  _pidAlive(pid) {
    if (!pid) return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  /**
   * Re-attach to a llama-server that survived a backend restart (orphan).
   * Called lazily: if the run-state file references a live pid whose /health
   * responds, adopt it instead of spawning a second copy. Returns true when
   * adopted.
   */
  async _reattachIfOrphaned() {
    if (this.running) return true;
    let saved = null;
    try { saved = JSON.parse(fs.readFileSync(this.runStatePath(), 'utf8')); } catch { return false; }
    if (!saved?.port || !saved?.baseUrl) return false;
    if (!this._pidAlive(saved.pid)) { this._writeRunState(); return false; }
    try {
      const response = await fetch(`${saved.baseUrl}/health`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return false;
    } catch { return false; }
    this.running = saved;
    this.emitRun();
    this.logger.info?.(`[model-runner] re-attached to surviving model server ${saved.name} at ${saved.baseUrl}`);
    return true;
  }

  /**
   * Run a downloaded model on localhost. Ensures the engine binary first
   * (one-time download), spawns llama-server, waits for /health.
   */
  async run(modelId, options = {}) {
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    if (!this.isDownloaded(model)) {
      const error = new Error(`"${model.name}" is not downloaded yet — download it first`);
      error.code = 'NOT_DOWNLOADED';
      throw error;
    }
    // Adopt a server orphaned by a backend restart instead of double-spawning.
    await this._reattachIfOrphaned();
    if (this.running) {
      if (this.running.modelId === modelId) return { alreadyRunning: true, ...this.running };
      await this.stop();
    }

    const device = await this.getDevice();
    const { path: binaryPath } = await this.engine.ensureEngine(device);
    const port = await findFreePort();
    const ggufPath = this.modelFilePath(model);

    const args = [
      '-m', ggufPath,
      '--port', String(port),
      '--host', '127.0.0.1',
      '-c', String(options.contextSize || 8192),
      '-ngl', '99' // offload as many layers to GPU as possible; ignored on CPU builds
    ];
    this.logger.info?.(`[model-runner] starting ${model.name} on 127.0.0.1:${port}`);

    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;
    this.running = {
      modelId: model.id, name: model.name, pid: child.pid, port, baseUrl,
      startedAt: new Date().toISOString()
    };
    this.emitRun();

    let stderrTail = '';
    child.stderr.on('data', (d) => { stderrTail = `${stderrTail}${d}`.slice(-2000); });
    const earlyExit = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    const exited = await Promise.race([
      earlyExit.then((code) => ({ exited: true, code })),
      waitForHealth(baseUrl).then((healthy) => ({ exited: false, healthy }))
    ]);

    if (exited.exited || exited.healthy === false) {
      const reason = exited.exited
        ? `llama-server exited immediately (code ${exited.code}): ${stderrTail.slice(-300)}`
        : 'llama-server did not become healthy in time';
      this.running = null;
      this._writeRunState();
      this.emitRun();
      try { child.kill(); } catch { /* ignore */ }
      const error = new Error(reason);
      error.code = 'RUN_FAILED';
      throw error;
    }

    this.logger.info?.(`[model-runner] ${model.name} healthy at ${baseUrl}`);
    this._writeRunState();
    return { started: true, ...this.running };
  }

  /** Stop the running model and free RAM/VRAM. */
  async stop() {
    // Re-attach first so Stop also kills a server orphaned by a restart.
    await this._reattachIfOrphaned();
    if (!this.running) {
      this._writeRunState();
      return { stopped: false };
    }
    const { modelId, pid } = this.running;
    this.running = null;
    this._writeRunState();
    this.emitRun();
    try {
      if (pid) process.kill(pid, 'SIGTERM');
    } catch { /* already gone */ }
    // Give it a moment, then force-kill if needed.
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      if (pid) process.kill(pid, 'SIGKILL');
    } catch { /* gone */ }
    this.logger.info?.(`[model-runner] stopped model ${modelId}`);
    return { stopped: true, modelId };
  }
}
