/**
 * modelRunnerService.js — the no-Ollama local model runner.
 *
 * Owns the whole "Download → Run → localhost" flow:
 *   • library()        — curated GGUF models + device-compatibility ranking
 *   • device()         — detected hardware snapshot
 *   • download(model)  — stream a GGUF from Hugging Face with progress
 *   • run(model)       — ensure Runner, spawn Infinity AI Runner on 127.0.0.1,
 *                        wait for /health, expose the OpenAI-compatible base URL
 *   • stop()           — kill the server, free RAM/VRAM
 *   • status()         — everything the Models UI needs in one call
 *
 * Layout under <dataDir>/model-runner/:
 *   infinity-runner/   — Infinity AI Runner binary (one-time download, on Run click)
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
import { InfinityRunner, RUNNER_DISPLAY_NAME, buildSpawnArgs } from './infinityRunner.js';
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

/** Find a free 127.0.0.1 port for the Infinity AI Runner. */
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

/**
 * Wait until the Runner's OpenAI-compatible API answers on /v1/models.
 * (koboldcpp has no /health endpoint — that was llama-server.)
 */
async function waitForHealth(baseUrl, timeoutMs = 240000) {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) return false;
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

export class ModelRunnerService {
  constructor({ dataDir, logger = console } = {}) {
    this.dataDir = dataDir || defaultDataDir();
    this.logger = logger;
    // The inference engine is the Infinity AI Runner (koboldcpp-based single
    // executable). It downloads ONLY when the user clicks Run — never on page
    // open (owner's choice). runForSlot()/run() ensure it before spawning.
    this.engine = new InfinityRunner({ dataDir: this.dataDir, logger });
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
    // Watchdog: live child processes per slot + restart backoff state.
    // A brain that dies on its own is restarted automatically so a hunt
    // resumes without the user touching anything.
    this.slotChildren = {};
    this.slotRestarts = {};
    this.runListeners = new Set();
  }

  /**
   * Run a downloaded model for a specific brain slot on its own localhost port.
   * Each slot (vision | grounding | hacker) gets its own Infinity AI Runner process
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
    // Multimodal brains MUST have their vision projector on disk or the
    // runner loads them text-only (screenshots invisible). Refuse to start
    // rather than silently running a blind "vision" brain.
    if (model.hfMmproj && !this.isMmprojDownloaded(model)) {
      const error = new Error(
        `"${model.name}" vision projector is not downloaded yet — download it first`
      );
      error.code = 'NOT_DOWNLOADED';
      throw error;
    }
    // If this slot already runs this model, return it.
    const existing = this.slotServers[slot];
    if (existing && existing.modelId === modelId) {
      // Verify it's still alive
      try {
        const res = await fetch(`${existing.baseUrl}/v1/models`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return { alreadyRunning: true, slot, ...existing };
      } catch {
        /* dead — restart below */
      }
    }
    // Stop any existing server for this slot first.
    if (existing) await this.stopSlot(slot);

    const device = await this.getDevice();
    // Download-on-Run: the Infinity AI Runner downloads here on first Run click.
    const { path: binaryPath } = await this.engine.ensureEngine(device);
    const port = await findFreePort();
    const ggufPath = this.modelFilePath(model, quant);

    const maxCtx = Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 32768;
    const contextSize = Math.min(Math.max(Math.floor(options.contextSize || 8192), 1024), maxCtx);

    // koboldcpp flags (not llama-server): --model, --port, --host,
    // --contextsize, --gpulayers, --quiet, --mmproj.
    const gpuLayers = device?.hasNvidia ? 99 : 0;
    const mmprojPath = model.hfMmproj ? this.mmprojFilePath(model) : null;
    const spawnArgv = buildSpawnArgs({
      binaryPath,
      modelPath: ggufPath,
      port,
      contextSize,
      gpuLayers,
      mmprojPath,
    });
    this.logger.info?.(
      `[model-runner] starting ${model.name} for slot "${slot}" on 127.0.0.1:${port} via ${RUNNER_DISPLAY_NAME}`
    );

    const child = spawn(spawnArgv[0], spawnArgv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;
    const serverInfo = {
      slot,
      modelId: model.id,
      name: model.name,
      quant,
      pid: child.pid,
      port,
      baseUrl,
      contextSize,
      startedAt: new Date().toISOString(),
    };
    this.slotServers[slot] = serverInfo;
    this.emitRun();

    let stderrTail = '';
    child.stderr.on('data', d => {
      stderrTail = `${stderrTail}${d}`.slice(-2000);
    });
    const earlyExit = new Promise(resolve => child.on('exit', code => resolve(code)));
    const exited = await Promise.race([
      earlyExit.then(code => ({ exited: true, code })),
      waitForHealth(baseUrl).then(healthy => ({ exited: false, healthy })),
    ]);

    if (exited.exited || exited.healthy === false) {
      const reason = exited.exited
        ? `${RUNNER_DISPLAY_NAME} exited immediately (code ${exited.code}): ${stderrTail.slice(-300)}`
        : `${RUNNER_DISPLAY_NAME} did not become healthy in time`;
      delete this.slotServers[slot];
      this.emitRun();
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      const error = new Error(reason);
      error.code = 'RUN_FAILED';
      throw error;
    }

    this.logger.info?.(`[model-runner] ${model.name} (slot ${slot}) healthy at ${baseUrl}`);
    // Watchdog: restart this brain automatically if it dies on its own.
    this._watchSlotChild(slot, child, { modelId, quant, contextSize });
    return { started: true, slot, ...serverInfo };
  }

  /** Stop the server running for a specific brain slot. */
  async stopSlot(slot) {
    const server = this.slotServers[slot];
    if (!server) return { stopped: false, slot };
    const { modelId, pid } = server;
    // Intentional stop — the watchdog must NOT restart it.
    server.stopping = true;
    delete this.slotServers[slot];
    delete this.slotChildren[slot];
    delete this.slotRestarts[slot];
    this.emitRun();
    try {
      if (pid) process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
      if (pid) process.kill(pid, 'SIGKILL');
    } catch {
      /* gone */
    }
    this.logger.info?.(`[model-runner] stopped slot "${slot}" model ${modelId}`);
    return { stopped: true, slot, modelId };
  }

  /**
   * Watchdog for a brain-slot child process. When the process dies WITHOUT an
   * intentional stop, the brain is restarted automatically (up to 3 attempts
   * with backoff) so a running hunt resumes on its own. Gives up after 3
   * crashes and records the failure for the UI.
   */
  _watchSlotChild(slot, child, runOpts) {
    this.slotChildren[slot] = child;
    child.on('exit', (code, signal) => {
      // Not the current child for this slot (stopped or reassigned) — ignore.
      if (this.slotChildren[slot] !== child) return;
      delete this.slotChildren[slot];
      const server = this.slotServers[slot];
      // Intentional stop, or slot already reassigned — not a crash.
      if (!server || server.stopping) return;
      this.logger.warn?.(
        `[model-runner] brain "${slot}" died unexpectedly (code ${code}, signal ${signal}) — restarting`
      );
      const attempts = (this.slotRestarts[slot] || 0) + 1;
      this.slotRestarts[slot] = attempts;
      if (attempts > 3) {
        this.logger.warn?.(`[model-runner] brain "${slot}" crashed 3 times — giving up`);
        delete this.slotServers[slot];
        delete this.slotRestarts[slot];
        this.slotSetupError = this.slotSetupError || {};
        this.slotSetupError[slot] = {
          message: `The ${slot} brain crashed repeatedly and was stopped. Press Download & Run to try again.`,
          at: new Date().toISOString(),
        };
        this.emitRun();
        return;
      }
      const delayMs = Math.min(2000 * attempts, 8000);
      setTimeout(async () => {
        // Slot may have been stopped/reassigned while we waited.
        if (!this.slotServers[slot] || this.slotServers[slot].stopping) return;
        try {
          await this.runForSlot(slot, runOpts.modelId, {
            quant: runOpts.quant,
            contextSize: runOpts.contextSize,
          });
          delete this.slotRestarts[slot];
          this.logger.info?.(
            `[model-runner] brain "${slot}" restarted after crash (attempt ${attempts})`
          );
        } catch (error) {
          this.logger.warn?.(`[model-runner] brain "${slot}" restart failed: ${error.message}`);
        }
      }, delayMs);
    });
  }

  /** Get the running server info for a slot (null when not running). */
  getSlotServer(slot) {
    return this.slotServers[slot] || null;
  }

  /**
   * One-click brain setup: download the model if needed, then run it for the
   * slot. Fire-and-forget — progress flows through the existing download SSE
   * events; the slot server appears via the run events when ready.
   * Concurrent calls for the same slot dedupe to one setup task.
   * @returns {object} { accepted: true, slot, modelId, alreadyRunning? }
   */
  downloadAndRunForSlot(slot, modelId, options = {}) {
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
    // Already running this exact model? Nothing to do.
    const existing = this.slotServers[slot];
    if (existing && existing.modelId === modelId)
      return { accepted: true, slot, modelId, alreadyRunning: true };
    // Setup already in flight for this slot? Dedupe.
    if (this.slotSetup?.[slot]) return { accepted: true, slot, modelId, alreadySettingUp: true };

    if (!this.slotSetup) this.slotSetup = {};
    const quant = options.quant || 'Q4_K_M';
    this.slotSetup[slot] = (async () => {
      try {
        // Phase 1: model download (skipped when fully on disk — GGUF AND
        // vision projector for multimodal brains).
        if (!this.isModelReady(model, quant)) {
          await this.startDownload(modelId, { quant });
          await this._awaitDownloadDone(modelId, quant);
        }
        // Phase 2: run it for the slot (also downloads the Runner binary).
        await this.runForSlot(slot, modelId, options);
        this.logger.info?.(
          `[model-runner] one-click setup complete for slot "${slot}" (${modelId})`
        );
      } catch (error) {
        this.logger.warn?.(
          `[model-runner] one-click setup failed for slot "${slot}": ${error.message}`
        );
        this.slotSetupError = this.slotSetupError || {};
        this.slotSetupError[slot] = { message: error.message, at: new Date().toISOString() };
        this.emitRun();
      } finally {
        delete this.slotSetup[slot];
        this.emitRun();
      }
    })();
    // Don't let an unhandled rejection crash the process; errors are caught above.
    this.slotSetup[slot].catch(() => {});
    this.emitRun();
    return { accepted: true, slot, modelId };
  }

  /** Slot setup status for the UI: { vision: 'idle'|'setting-up'|'running'|'error', ... }. */
  describeSlotSetup() {
    const out = {};
    for (const slot of ['vision', 'grounding', 'hacker']) {
      if (this.slotSetup?.[slot]) out[slot] = 'setting-up';
      else if (this.slotServers[slot]) out[slot] = 'running';
      else if (this.slotSetupError?.[slot]) out[slot] = 'error';
      else out[slot] = 'idle';
    }
    return out;
  }

  /** Clear a recorded slot-setup error (e.g. when the user retries). */
  clearSlotSetupError(slot) {
    if (this.slotSetupError) delete this.slotSetupError[slot];
  }

  /** Wait until the model download reaches a terminal state. */
  async _awaitDownloadDone(modelId, quant) {
    for (;;) {
      const s = this.downloadState;
      if (!s || s.modelId !== modelId) {
        // Download state moved on — check the file directly.
        if (this.preferredQuant(this.findModel(modelId), quant)) return;
        throw new Error('Download was interrupted before completing.');
      }
      if (s.status === 'done') return;
      if (s.status === 'error') throw new Error(s.error || 'Model download failed.');
      if (s.status === 'cancelled') throw new Error('Model download was cancelled.');
      await new Promise(r => setTimeout(r, 1000));
    }
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
        this.customModels = parsed.filter(m => m && typeof m.id === 'string');
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
    return this.allModels().find(m => m.id === modelId) || null;
  }

  modelFilePath(model, quant = 'Q4_K_M') {
    const safeId = String(model.id).replace(/[^a-zA-Z0-9._-]/g, '_');
    // Q4_K_M keeps the legacy path (existing downloads keep working);
    // other quants get a suffix so several can coexist per model.
    const suffix = quant && quant !== 'Q4_K_M' ? `-${quant}` : '';
    return path.join(modelsDir(this.dataDir), safeId, `${safeId}${suffix}.gguf`);
  }

  // ── Vision projector (.mmproj) ───────────────────────────────────────
  // Multimodal brains (Qwen2.5-VL, OS-Atlas, UI-TARS) ship their vision
  // encoder as a separate projector file. The runner MUST receive it via
  // --mmproj, otherwise the brain loads text-only and screenshots are
  // invisible to it. Text-only models (e.g. the hacker brain) have no
  // hfMmproj and skip all of this.

  /** On-disk path of the model's vision projector (null when the model has none). */
  mmprojFilePath(model) {
    if (!model?.hfMmproj) return null;
    const safeId = String(model.id).replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(modelsDir(this.dataDir), safeId, `${safeId}.mmproj.gguf`);
  }

  /** Download URL for the model's vision projector (null when none). Extracted
   * as a method so tests can point it at a local fixture server. */
  mmprojDownloadUrl(model) {
    if (!model?.hfMmproj) return null;
    const repo = sanitizeHfPart(model.hfRepo || model.repo, 'repo');
    return hfDownloadUrl(repo, sanitizeHfPart(model.hfMmproj, 'mmproj'));
  }

  /** Is the vision projector on disk? (true when the model needs none) */
  isMmprojDownloaded(model) {
    if (!model?.hfMmproj) return true;
    try {
      const stat = fs.statSync(this.mmprojFilePath(model));
      return stat.size > 0;
    } catch {
      return false;
    }
  }

  /** Fully ready for one-click run: GGUF present AND projector present (when needed). */
  isModelReady(model, quant = 'Q4_K_M') {
    return this.preferredQuant(model, quant) != null && this.isMmprojDownloaded(model);
  }

  /**
   * Validate a quantization choice for a model.
   * @returns { quant, file, sizeGB } — the concrete file to download.
   */
  resolveQuant(model, quant) {
    const q = quant || 'Q4_K_M';
    const entry =
      model.quants?.[q] ||
      (q === 'Q4_K_M'
        ? {
            file: model.hfFile || model.file || `${model.id || 'model'}.gguf`,
            sizeGB: model.sizeGB,
          }
        : null);
    if (!entry?.file) {
      const available = model.quants ? Object.keys(model.quants).join(', ') : 'Q4_K_M';
      const error = new Error(
        `Quantization "${q}" is not available for "${model.name}" (available: ${available})`
      );
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
    return available.filter(q => this.isDownloaded(model, q));
  }

  /** Quant to run: explicit choice wins, else Q4_K_M, else any downloaded quant. */
  preferredQuant(model, quant) {
    if (quant) {
      if (!this.isDownloaded(model, quant)) {
        const error = new Error(
          `"${model.name}" ${quant} is not downloaded yet — download it first`
        );
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
    return this.allModels().map(model => ({
      ...model,
      // "downloaded" means fully runnable: GGUF on disk AND the vision
      // projector for multimodal brains (a vision brain without its .mmproj
      // would run blind, so it must not show as ready).
      downloaded: this.isModelReady(model),
      downloadedQuants: this.downloadedQuants(model),
      downloadedBytes: this.downloadedBytes(model),
      running: this.running?.modelId === model.id,
      compatibility: rankModelForDevice(model, device),
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
      models: (await this.library()).map(m => ({
        id: m.id,
        name: m.name,
        params: m.params,
        tier: m.tier,
        sizeGB: m.sizeGB,
        downloaded: m.downloaded,
        running: m.running,
        compatibility: m.compatibility,
      })),
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
      try {
        listener(snapshot);
      } catch {
        /* ignore */
      }
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
   * Download the model's vision projector (.mmproj) for multimodal brains.
   * Awaited inline (not fire-and-forget): the file is small (~0.3–1 GB) and
   * must be on disk before the GGUF transfer starts. Progress flows through
   * the same download SSE events the UI already polls.
   * @throws on failure (downloadState is left in the error state).
   */
  async _downloadVisionProjector(model) {
    const url = this.mmprojDownloadUrl(model);
    const destPath = this.mmprojFilePath(model);
    if (!url || !destPath) return;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const controller = new AbortController();
    this.downloadState = {
      status: 'downloading',
      modelId: model.id,
      quant: 'mmproj',
      sizeGB: null,
      name: `${model.name} (vision projector)`,
      url,
      receivedBytes: 0,
      totalBytes: null,
      error: null,
    };
    this.emitDownload();
    try {
      const { bytes } = await downloadFile(url, destPath, {
        signal: controller.signal,
        onProgress: (receivedBytes, totalBytes) => {
          this.downloadState = {
            status: 'downloading',
            modelId: model.id,
            quant: 'mmproj',
            sizeGB: null,
            name: `${model.name} (vision projector)`,
            url,
            receivedBytes,
            totalBytes,
            error: null,
          };
          this.emitDownload();
        },
      });
      this.downloadState = {
        status: 'done',
        modelId: model.id,
        quant: 'mmproj',
        sizeGB: null,
        name: `${model.name} (vision projector)`,
        url,
        receivedBytes: bytes,
        totalBytes: bytes,
        error: null,
      };
      this.emitDownload();
    } catch (error) {
      const cancelled = controller.signal.aborted;
      this.downloadState = {
        status: cancelled ? 'cancelled' : 'error',
        modelId: model.id,
        quant: 'mmproj',
        sizeGB: null,
        name: `${model.name} (vision projector)`,
        url,
        receivedBytes: 0,
        totalBytes: null,
        error: cancelled
          ? 'Cancelled by user'
          : `Vision projector download failed: ${error.message}`,
      };
      this.emitDownload();
      throw error;
    }
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
    // Multimodal brains need their vision projector (.mmproj) BEFORE the run —
    // download it first (small file) so a failure surfaces before the
    // multi-GB GGUF transfer starts.
    if (model.hfMmproj && !this.isMmprojDownloaded(model)) {
      await this._downloadVisionProjector(model);
    }
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
      status: 'downloading',
      modelId: model.id,
      quant: q,
      sizeGB,
      name: model.name,
      url,
      receivedBytes: this.downloadedBytes(model, q),
      totalBytes: null,
      error: null,
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
      },
    }).then(
      ({ bytes }) => {
        this.downloadState = {
          status: 'done',
          modelId: model.id,
          quant: q,
          sizeGB,
          name: model.name,
          url,
          receivedBytes: bytes,
          totalBytes: bytes,
          error: null,
        };
        this.downloadAbort = null;
        this.emitDownload();
      },
      error => {
        const cancelled = controller.signal.aborted;
        this.downloadState = {
          status: cancelled ? 'cancelled' : 'error',
          modelId: model.id,
          quant: q,
          sizeGB,
          name: model.name,
          url,
          receivedBytes: this.downloadedBytes(model, q),
          totalBytes: null,
          error: cancelled ? 'Cancelled by user' : error.message,
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

  /**
   * Pause a download — aborts the transfer but KEEPS the partial file so a
   * later download resumes from where it left off (HTTP Range).
   * Returns the paused state for the UI (modelId, receivedBytes).
   */
  pauseDownload() {
    const state = this.downloadState;
    if (this.downloadAbort) {
      this.downloadAbort.abort();
    }
    if (state && state.status === 'downloading') {
      state.status = 'paused';
      return {
        paused: true,
        modelId: state.modelId,
        receivedBytes: state.receivedBytes || 0,
        totalBytes: state.totalBytes || null,
      };
    }
    return { paused: false };
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
    } catch {
      /* ignore */
    }
    // For user-added custom models, deleting also removes the library entry
    // (otherwise a dead entry would linger in the UI).
    if (model.custom) {
      this.customModels = this.customModels.filter(m => m.id !== model.id);
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
    const ramGBValue =
      Number.isFinite(ramNeed) && ramNeed > 0 ? Math.min(Math.round(ramNeed * 10) / 10, 512) : 8;
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
      name:
        (typeof name === 'string' && name.trim().slice(0, 80)) ||
        `${cleanRepo.split('/')[1] || cleanRepo}`,
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
      description: `User-added model from Hugging Face: ${cleanRepo}`,
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
      try {
        listener(snapshot);
      } catch {
        /* ignore */
      }
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
      else
        try {
          fs.unlinkSync(file);
        } catch {
          /* already gone */
        }
    } catch (error) {
      this.logger?.warn?.(`[model-runner] could not persist run state: ${error.message}`);
    }
  }

  /** Is this pid alive? */
  _pidAlive(pid) {
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-attach to an Infinity AI Runner that survived a backend restart (orphan).
   * Called lazily: if the run-state file references a live pid whose /v1/models
   * responds, adopt it instead of spawning a second copy. Returns true when
   * adopted.
   */
  async _reattachIfOrphaned() {
    if (this.running) return true;
    let saved = null;
    try {
      saved = JSON.parse(fs.readFileSync(this.runStatePath(), 'utf8'));
    } catch {
      return false;
    }
    if (!saved?.port || !saved?.baseUrl) return false;
    if (!this._pidAlive(saved.pid)) {
      this._writeRunState();
      return false;
    }
    try {
      const response = await fetch(`${saved.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    this.running = saved;
    this.emitRun();
    this.logger.info?.(
      `[model-runner] re-attached to surviving model server ${saved.name} at ${saved.baseUrl}`
    );
    return true;
  }

  /**
   * Run a downloaded model on localhost. Ensures the engine binary first
   * (one-time download on Run click), spawns the Infinity AI Runner, waits for /v1/models.
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
    // Multimodal brains MUST have their vision projector on disk or the
    // runner loads them text-only (screenshots invisible). Refuse to start
    // rather than silently running a blind "vision" brain.
    if (model.hfMmproj && !this.isMmprojDownloaded(model)) {
      const error = new Error(
        `"${model.name}" vision projector is not downloaded yet — download it first`
      );
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
    // Download-on-Run: the Infinity AI Runner downloads here on first Run click.
    const { path: binaryPath } = await this.engine.ensureEngine(device);
    const port = await findFreePort();
    const ggufPath = this.modelFilePath(model, quant);

    // Context window: user's choice clamped to the model's supported maximum
    // (and a sane floor). Bigger context = more KV-cache RAM — the UI shows
    // the model's max so the user can decide.
    const maxCtx = Number(model.contextWindow) > 0 ? Number(model.contextWindow) : 32768;
    const contextSize = Math.min(Math.max(Math.floor(options.contextSize || 8192), 1024), maxCtx);

    // koboldcpp flags (not llama-server): --model, --port, --host,
    // --contextsize, --gpulayers, --quiet, --mmproj.
    const gpuLayers = device?.hasNvidia ? 99 : 0;
    const mmprojPath = model.hfMmproj ? this.mmprojFilePath(model) : null;
    const spawnArgv = buildSpawnArgs({
      binaryPath,
      modelPath: ggufPath,
      port,
      contextSize,
      gpuLayers,
      mmprojPath,
    });
    this.logger.info?.(
      `[model-runner] starting ${model.name} on 127.0.0.1:${port} (context ${contextSize}) via ${RUNNER_DISPLAY_NAME}`
    );

    const child = spawn(spawnArgv[0], spawnArgv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    const baseUrl = `http://127.0.0.1:${port}`;
    this.running = {
      modelId: model.id,
      name: model.name,
      quant,
      pid: child.pid,
      port,
      baseUrl,
      contextSize,
      startedAt: new Date().toISOString(),
    };
    this.emitRun();

    let stderrTail = '';
    child.stderr.on('data', d => {
      stderrTail = `${stderrTail}${d}`.slice(-2000);
    });
    const earlyExit = new Promise(resolve => child.on('exit', code => resolve(code)));
    const exited = await Promise.race([
      earlyExit.then(code => ({ exited: true, code })),
      waitForHealth(baseUrl).then(healthy => ({ exited: false, healthy })),
    ]);

    if (exited.exited || exited.healthy === false) {
      const reason = exited.exited
        ? `${RUNNER_DISPLAY_NAME} exited immediately (code ${exited.code}): ${stderrTail.slice(-300)}`
        : `${RUNNER_DISPLAY_NAME} did not become healthy in time`;
      this.running = null;
      this._writeRunState();
      this.emitRun();
      try {
        child.kill();
      } catch {
        /* ignore */
      }
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
   *      file backs the running Infinity AI Runner.
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
      userId: userId || null,
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
      selection = await brainProviderModel.setSelection(userId, {
        provider: 'local',
        modelId: model.id,
      });
    }
    try {
      await onBrainSwitched?.(userId);
    } catch {
      /* best effort */
    }
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
    } catch {
      /* already gone */
    }
    // Give it a moment, then force-kill if needed.
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
      if (pid) process.kill(pid, 'SIGKILL');
    } catch {
      /* gone */
    }
    this.logger.info?.(`[model-runner] stopped model ${modelId}`);
    return { stopped: true, modelId };
  }
}
