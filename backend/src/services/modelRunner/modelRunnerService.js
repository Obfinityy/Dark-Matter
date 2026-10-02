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
    // (legacy single-model slot — kept for backward compatibility)
    this.running = null;
    // Per-brain-slot servers: { vision: {...}, grounding: {...}, hacker: {...} }
    // Each brain slot runs on its OWN localhost port simultaneously.
    this.slotServers = {};
    this.runListeners = new Set();
  }

  /**
   * Run a downloaded model for a specific brain slot on its own localhost port.
   * Each slot (vision | grounding | hacker) gets its own llama-server process
   * and port, so all three brains can run simultaneously.
   * @param {string} slot — 'vision' | 'grounding' | 'hacker'
   * @param {string} modelId
   * @param {object} [options] — { quant, contextSize }
   */
  async runForSlot(slot, modelId, options = {}) {
    if (!['vision', 'grounding', 'hacker'].includes(slot)) {
      const error = new Error(`Unknown brain slot "${slot}"`);
      error.code = 'UNKNOWN_SLOT';
      throw error;
    }
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    const quant = this.preferredQuant(model, options.quant);
    if (!quant) {
      const error = new Error(`"${model.name}" is not downloaded yet — download it first`);
      error.code = 'NOT_DOWNLOADED';
      throw error;
    }
    // If this slot already runs this model, return it.
    const existing = this.slotServers[slot];
    if (existing && existing.modelId === modelId) {
      // Verify it's still alive
      try {
        const res = await fetch(`${existing.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) return { alreadyRunning: true, slot, ...existing };
      } catch { /* dead — restart below */ }
    }
    // Stop any existing server for this slot first.
    if (existing) await this.stopSlot(slot);

    const device = await this.getDevice();
    const { path: binaryPath } = await this.engine.ensureEngine(device);
    const port = await findFreePort();
    const ggufPath = this.modelFilePath(model, quant);

    const maxCtx = Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 32768;
    const contextSize = Math.min(
      Math.max(Math.floor(options.contextSize || 8192), 1024),
      maxCtx
    );

    const args = [
      '-m', ggufPath,
      '--port', String(port),
      '--host', '127.0.0.1',
      '-c', String(contextSize),
      '-ngl', '99'
    ];
    this.logger.info?.(`[model-runner] starting ${model.name} for slot "${slot}" on 127.0.0.1:${port}`);

    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;
    const serverInfo = {
      slot, modelId: model.id, name: model.name, quant, pid: child.pid, port, baseUrl,
      contextSize, startedAt: new Date().toISOString()
    };
    this.slotServers[slot] = serverInfo;
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
      delete this.slotServers[slot];
      this.emitRun();
      try { child.kill(); } catch { /* ignore */ }
      const error = new Error(reason);
      error.code = 'RUN_FAILED';
      throw error;
    }

    this.logger.info?.(`[model-runner] ${model.name} (slot ${slot}) healthy at ${baseUrl}`);
    return { started: true, slot, ...serverInfo };
  }

  /** Stop the server running for a specific brain slot. */
  async stopSlot(slot) {
    const server = this.slotServers[slot];
    if (!server) return { stopped: false, slot };
    const { modelId, pid } = server;
    delete this.slotServers[slot];
    this.emitRun();
    try {
      if (pid) process.kill(pid, 'SIGTERM');
    } catch { /* already gone */ }
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      if (pid) process.kill(pid, 'SIGKILL');
    } catch { /* gone */ }
    this.logger.info?.(`[model-runner] stopped slot "${slot}" model ${modelId}`);
    return { stopped: true, slot, modelId };
  }

  /** Get the running server info for a slot (null when not running). */
  getSlotServer(slot) {
    return this.slotServers[slot] || null;
  }

  /** All running slot servers: { vision: {...}|null, grounding: {...}|null, hacker: {...}|null } */
  describeSlotServers() {
    const out = {};
    for (const slot of ['vision', 'grounding', 'hacker']) {
      out[slot] = this.slotServers[slot] ? { ...this.slotServers[slot] } : null;
    }
    return out;
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

  modelFilePath(model, quant = 'Q4_K_M') {
    const safeId = String(model.id).replace(/[^a-zA-Z0-9._-]/g, '_');
    // Q4_K_M keeps the legacy path (existing downloads keep working);
    // other quants get a suffix so several can coexist per model.
    const suffix = quant && quant !== 'Q4_K_M' ? `-${quant}` : '';
    return path.join(modelsDir(this.dataDir), safeId, `${safeId}${suffix}.gguf`);
  }

  /**
   * Validate a quantization choice for a model.
   * @returns { quant, file, sizeGB } — the concrete file to download.
   */
  resolveQuant(model, quant) {
    const q = quant || 'Q4_K_M';
    const entry = model.quants?.[q]
      || (q === 'Q4_K_M' ? { file: model.hfFile || model.file || `${model.id || 'model'}.gguf`, sizeGB: model.sizeGB } : null);
    if (!entry?.file) {
      const available = model.quants ? Object.keys(model.quants).join(', ') : 'Q4_K_M';
      const error = new Error(`Quantization "${q}" is not available for "${model.name}" (available: ${available})`);
      error.code = 'UNKNOWN_QUANT';
      throw error;
    }
    return { quant: q, file: entry.file, sizeGB: entry.sizeGB ?? model.sizeGB };
  }

  /** Expected on-disk byte size for a model+quant (custom models carry sizeBytes). */
  expectedBytes(model, quant = 'Q4_K_M') {
    if (model.sizeBytes) return model.sizeBytes;
    const { sizeGB } = this.resolveQuant(model, quant);
    return sizeGB ? sizeGB * 1024 ** 3 : 0;
  }

  /** Is the GGUF fully on disk? (size sanity check when known) */
  isDownloaded(model, quant = 'Q4_K_M') {
    try {
      const stat = fs.statSync(this.modelFilePath(model, quant));
      if (stat.size <= 0) return false;
      // Prefer the exact byte size captured at registration (custom models);
      // the rounded sizeGB can over-estimate (e.g. 0.4576GB → 0.5GB) and a
      // fully-downloaded file would then wrongly read as incomplete.
      const expected = this.expectedBytes(model, quant);
      if (expected > 0 && stat.size < expected * 0.99) return false;
      return true;
    } catch {
      return false;
    }
  }

  downloadedBytes(model, quant = 'Q4_K_M') {
    try {
      return fs.statSync(this.modelFilePath(model, quant)).size;
    } catch {
      return 0;
    }
  }

  /** Quants of this model that are fully on disk. */
  downloadedQuants(model) {
    const available = model.quants ? Object.keys(model.quants) : ['Q4_K_M'];
    return available.filter((q) => this.isDownloaded(model, q));
  }

  /** Quant to run: explicit choice wins, else Q4_K_M, else any downloaded quant. */
  preferredQuant(model, quant) {
    if (quant) {
      if (!this.isDownloaded(model, quant)) {
        const error = new Error(`"${model.name}" ${quant} is not downloaded yet — download it first`);
        error.code = 'NOT_DOWNLOADED';
        throw error;
      }
      return this.resolveQuant(model, quant).quant;
    }
    const dq = this.downloadedQuants(model);
    return dq.includes('Q4_K_M') ? 'Q4_K_M' : dq[0] || null;
  }

  async library() {
    const device = await this.getDevice();
    return this.allModels().map((model) => ({
      ...model,
      downloaded: this.isDownloaded(model),
      downloadedQuants: this.downloadedQuants(model),
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
      // Per-slot servers: each brain slot on its own localhost port.
      slotServers: this.describeSlotServers(),
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
   * Resolve the download URL for a model (+quant).
   * Extracted as a method (instead of inlining hfDownloadUrl) so tests can
   * point it at a local fixture server without touching production code paths.
   */
  resolveDownloadUrl(model, quant) {
    const { file } = this.resolveQuant(model, quant);
    const repo = sanitizeHfPart(model.hfRepo || model.repo, 'repo');
    return hfDownloadUrl(repo, sanitizeHfPart(file, 'file'));
  }

  /**
   * Start downloading a model's GGUF. Returns immediately; progress flows
   * through onDownloadProgress / describeDownload. Only one at a time.
   * @param {string} modelId
   * @param {object} [options] — { quant } e.g. 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'
   */
  async startDownload(modelId, { quant } = {}) {
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    const { quant: q, sizeGB } = this.resolveQuant(model, quant);
    if (this.isDownloaded(model, q)) return { alreadyDownloaded: true, modelId, quant: q };
    if (this.downloadState?.status === 'downloading') {
      const error = new Error('Another download is already in progress');
      error.code = 'DOWNLOAD_BUSY';
      throw error;
    }

    const url = this.resolveDownloadUrl(model, q);
    const destPath = this.modelFilePath(model, q);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const controller = new AbortController();
    this.downloadAbort = controller;
    this.downloadState = {
      status: 'downloading', modelId: model.id, quant: q, sizeGB, name: model.name, url,
      receivedBytes: this.downloadedBytes(model, q), totalBytes: null, error: null
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
        this.downloadState = { status: 'done', modelId: model.id, quant: q, sizeGB, name: model.name, url, receivedBytes: bytes, totalBytes: bytes, error: null };
        this.downloadAbort = null;
        this.emitDownload();
      },
      (error) => {
        const cancelled = controller.signal.aborted;
        this.downloadState = {
          status: cancelled ? 'cancelled' : 'error',
          modelId: model.id, quant: q, sizeGB, name: model.name, url,
          receivedBytes: this.downloadedBytes(model, q), totalBytes: null,
          error: cancelled ? 'Cancelled by user' : error.message
        };
        this.downloadAbort = null;
        this.emitDownload();
      }
    );

    return { started: true, modelId: model.id, quant: q, sizeGB };
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
    // Quant choice: explicit wins; otherwise Q4_K_M; otherwise any downloaded
    // quant. Throws NOT_DOWNLOADED when nothing usable is on disk.
    const quant = this.preferredQuant(model, options.quant);
    if (!quant) {
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
    const ggufPath = this.modelFilePath(model, quant);

    // Context window: user's choice clamped to the model's supported maximum
    // (and a sane floor). Bigger context = more KV-cache RAM — the UI shows
    // the model's max so the user can decide.
    const maxCtx = Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 32768;
    const contextSize = Math.min(
      Math.max(Math.floor(options.contextSize || 8192), 1024),
      maxCtx
    );

    const args = [
      '-m', ggufPath,
      '--port', String(port),
      '--host', '127.0.0.1',
      '-c', String(contextSize),
      '-ngl', '99' // offload as many layers to GPU as possible; ignored on CPU builds
    ];
    this.logger.info?.(`[model-runner] starting ${model.name} on 127.0.0.1:${port} (context ${contextSize})`);

    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;
    this.running = {
      modelId: model.id, name: model.name, quant, pid: child.pid, port, baseUrl,
      contextSize,
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

  /** Path of the JSON file recording which model is the ACTIVE localhost brain. */
  activeBrainPath() {
    return path.join(this.dataDir, 'model-runner', 'active-brain.json');
  }

  /**
   * Make a downloaded model the ACTIVE localhost brain for a user.
   * Persists in two places so a restart can never lose it:
   *   1. brainProviderModel (DB / in-memory fallback) — per-user selection
   *      the brain factory reads when building the inference provider.
   *   2. active-brain.json on disk — machine-level record of which model
   *      file backs the running llama-server.
   *
   * This is the exact method the POST /models/:id/run controller calls after
   * the model is healthy, so the unit test exercises the real activation path.
   */
  async activateBrainForUser({ userId, modelId, brainProviderModel, onBrainSwitched = null }) {
    const model = this.findModel(modelId);
    if (!model) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    const record = {
      modelId: model.id,
      name: model.name,
      endpoint: this.endpoint(),
      activatedAt: new Date().toISOString(),
      userId: userId || null
    };
    try {
      const file = this.activeBrainPath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(record, null, 2));
    } catch (error) {
      this.logger?.warn?.(`[model-runner] could not persist active brain: ${error.message}`);
    }
    let selection = null;
    if (brainProviderModel && userId) {
      selection = await brainProviderModel.setSelection(userId, { provider: 'local', modelId: model.id });
    }
    try { await onBrainSwitched?.(userId); } catch { /* best effort */ }
    return { active: true, record, selection };
  }

  /** Read back the persisted active-brain record (null when never set). */
  readActiveBrain() {
    try {
      return JSON.parse(fs.readFileSync(this.activeBrainPath(), 'utf8'));
    } catch {
      return null;
    }
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
