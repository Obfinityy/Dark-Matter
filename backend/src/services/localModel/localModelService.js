import { spawnSync } from 'node:child_process';
import { MODEL_LIBRARY, getLibraryEntry, getDefaultEntry } from './modelLibrary.js';
import { validateCustomTag } from '../../models/customModelModel.js';

/**
 * LocalModelService — Ollama orchestration for the local uncensored model
 * library (issue #3, the "Run Locally" flow).
 *
 * Responsibilities:
 *   • detect Ollama (binary installed? API running? version?)
 *   • list installed models + disk usage
 *   • pull a library model with streaming progress (one pull at a time)
 *   • remove an installed model
 *   • activate a model as the agent's brain (via the onActivate hook, which
 *     swaps the AutonomousBrain's provider and persists the selection)
 *   • install guidance for first-time users
 *
 * Security: pull/activate accept ONLY library model ids (allowlist) — the
 * model name never comes from raw user input into the Ollama API.
 */
export class LocalModelService {
  constructor({ config, brainProviderModel, customModelModel = null, onActivate = null, logger = console } = {}) {
    const host = (config?.ollama?.host || process.env.OLLAMA_HOST || '127.0.0.1').trim();
    const port = Number(config?.ollama?.port || process.env.OLLAMA_PORT || 11434);
    this.apiBase = (config?.ollama?.apiBaseUrl || `http://${host}:${port}/api`).replace(/\/$/, '');
    this.config = config;
    this.brainProviderModel = brainProviderModel;
    this.customModelModel = customModelModel;
    this.onActivate = onActivate;
    this.logger = logger;
    this.pullState = null; // { modelId, ollamaTag, status, startedAt, digests: Map, error }
    this.listeners = new Set();
  }

  // ── Detection ──────────────────────────────────────────────────────────

  /** Is the `ollama` binary installed on this machine? */
  detectBinary() {
    try {
      const result = spawnSync('ollama', ['--version'], { timeout: 5000, encoding: 'utf-8' });
      if (result.status === 0) {
        return { installed: true, version: String(result.stdout || '').trim().split('\n')[0] || null };
      }
      return { installed: false, version: null };
    } catch {
      return { installed: false, version: null };
    }
  }

  /** Is the Ollama API reachable? */
  async detectApi() {
    try {
      const response = await fetch(`${this.apiBase}/version`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return { running: false, version: null };
      const body = await response.json().catch(() => null);
      return { running: true, version: body?.version || null };
    } catch {
      return { running: false, version: null };
    }
  }

  async listInstalled() {
    try {
      const response = await fetch(`${this.apiBase}/tags`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return [];
      const body = await response.json().catch(() => null);
      return (body?.models || []).map((m) => ({
        name: m.name,
        size: m.size || 0,
        digest: m.digest || null,
        modifiedAt: m.modified_at || null
      }));
    } catch {
      return [];
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────

  /**
   * Full library status for the plugins UI: the catalog annotated with
   * installed/ready flags, disk usage, Ollama detection, the active brain,
   * and any in-flight pull.
   */
  async getStatus(userId = null) {
    const [binary, api, installed, selection] = await Promise.all([
      Promise.resolve(this.detectBinary()),
      this.detectApi(),
      this.listInstalled(),
      this.brainProviderModel ? this.brainProviderModel.getSelection(userId) : { provider: 'phone', modelId: null }
    ]);

    const installedByTag = new Map(installed.map((m) => [m.name, m]));
    const models = MODEL_LIBRARY.map((entry) => {
      const found = installedByTag.get(entry.ollamaTag);
      return {
        ...entry,
        installed: Boolean(found),
        ready: Boolean(found),
        sizeBytes: found ? found.size : null
      };
    });

    // Custom models the user added themselves (any Ollama tag / HF reference).
    let customModels = [];
    if (this.customModelModel) {
      const custom = await this.customModelModel.list();
      customModels = custom.map((record) => {
        const found = installedByTag.get(record.tag);
        return {
          id: `custom:${record.id}`,
          customId: record.id,
          tag: record.tag,
          ollamaTag: record.tag,
          name: record.label,
          kind: record.kind,
          custom: true,
          installed: Boolean(found),
          ready: Boolean(found),
          sizeBytes: found ? found.size : null,
          pulling: this.pullState?.status === 'pulling' && this.pullState?.ollamaTag === record.tag,
          addedAt: record.addedAt
        };
      });
    }

    return {
      ollama: {
        binaryInstalled: binary.installed,
        binaryVersion: binary.version,
        apiRunning: api.running,
        apiVersion: api.version
      },
      models,
      customModels,
      diskUsageBytes: installed.reduce((sum, m) => sum + (m.size || 0), 0),
      installedCount: models.filter((m) => m.installed).length + customModels.filter((m) => m.installed).length,
      active: {
        provider: selection.provider,
        modelId: selection.modelId,
        ollamaTag: selection.ollamaTag,
        label: selection.provider === 'ollama'
          ? (getLibraryEntry(selection.modelId)?.name || (await this.resolveCustomLabel(selection.modelId)) || selection.ollamaTag || 'local model')
          : 'Phone (local Gemma)'
      },
      pull: this.pullState ? this.describePull() : null
    };
  }

  async resolveCustomLabel(modelId) {
    if (!modelId || !String(modelId).startsWith('custom:') || !this.customModelModel) return null;
    const record = await this.customModelModel.get(String(modelId).slice('custom:'.length));
    return record?.label || record?.tag || null;
  }

  installGuide() {
    return {
      message: 'Ollama runs the agent’s brain on your own machine. One-time download, then fully offline — private, no API cost.',
      steps: [
        {
          os: 'linux',
          title: 'Linux',
          commands: ['curl -fsSL https://ollama.com/install.sh | sh', 'ollama serve'],
          note: 'The service usually starts automatically after install.'
        },
        {
          os: 'macos',
          title: 'macOS',
          commands: ['brew install ollama', 'ollama serve'],
          note: 'Or download the app from https://ollama.com/download'
        },
        {
          os: 'windows',
          title: 'Windows',
          commands: [],
          note: 'Download the installer from https://ollama.com/download and run it.'
        }
      ],
      verify: 'ollama --version',
      downloadUrl: 'https://ollama.com/download'
    };
  }

  // ── Pull (download) ────────────────────────────────────────────────────

  describePull() {
    if (!this.pullState) return null;
    const { modelId, ollamaTag, status, startedAt, digests, error } = this.pullState;
    let total = 0;
    let completed = 0;
    for (const digest of digests.values()) {
      total += digest.total || 0;
      completed += Math.min(digest.completed || 0, digest.total || 0);
    }
    return {
      modelId,
      ollamaTag,
      status,
      startedAt,
      totalBytes: total,
      completedBytes: completed,
      // A finished pull is 100% even when the daemon never sent full byte
      // accounting (e.g. cached layers report no totals).
      percent: status === 'success' ? 100 : (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0),
      error: error || null
    };
  }

  onPullProgress(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitPull() {
    const snapshot = this.describePull();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        this.logger.warn?.('[local-model] pull listener failed:', error.message);
      }
    }
  }

  /**
   * Start pulling a library model. Only one pull at a time; modelId must be
   * in the curated library (allowlist).
   */
  async startPull(modelId) {
    const entry = getLibraryEntry(modelId);
    if (!entry) {
      const error = new Error(`Unknown model "${modelId}" — only library models can be pulled`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    return this.beginPull({ modelId: entry.id, ollamaTag: entry.ollamaTag, name: entry.name });
  }

  /**
   * Add ANY model of the user's choice: an Ollama tag or a HuggingFace
   * reference. The tag is strictly validated, then pulled like a library
   * model and registered as a custom entry.
   */
  async addCustomModel(tag, { addedBy = null } = {}) {
    if (!this.customModelModel) {
      const error = new Error('Custom models are not configured on this deployment');
      error.code = 'NOT_CONFIGURED';
      throw error;
    }
    const check = validateCustomTag(tag);
    if (!check.valid) {
      const error = new Error(check.error);
      error.code = 'INVALID_TAG';
      throw error;
    }
    const record = await this.customModelModel.add({ tag: check.tag, addedBy });
    const pull = await this.beginPull({
      modelId: `custom:${record.id}`,
      ollamaTag: record.tag,
      name: record.label
    });
    return { customModel: record, pull };
  }

  /** Shared gate: one pull at a time, Ollama must be running. */
  async beginPull({ modelId, ollamaTag, name }) {
    if (this.pullState && this.pullState.status === 'pulling') {
      const error = new Error(`Already pulling ${this.pullState.modelId}`);
      error.code = 'PULL_IN_PROGRESS';
      throw error;
    }
    const api = await this.detectApi();
    if (!api.running) {
      const error = new Error('Ollama is not running — install it and start `ollama serve` first');
      error.code = 'OLLAMA_NOT_RUNNING';
      throw error;
    }

    this.pullState = {
      modelId,
      ollamaTag,
      status: 'pulling',
      startedAt: new Date().toISOString(),
      digests: new Map(),
      error: null
    };
    this.emitPull();

    // Run the long download in the background; progress flows via listeners.
    this.runPull({ modelId, ollamaTag, name }).catch((error) => {
      this.logger.error?.('[local-model] pull failed:', error.message);
    });
    return this.describePull();
  }

  async runPull(entry) {
    try {
      const response = await fetch(`${this.apiBase}/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: entry.ollamaTag, stream: true })
      });
      if (!response.ok || !response.body) {
        throw new Error(`Ollama pull rejected the model (HTTP ${response.status})`);
      }
      await this.consumePullStream(response.body, entry);
      this.pullState.status = 'success';
      this.emitPull();
    } catch (error) {
      if (this.pullState) {
        this.pullState.status = 'error';
        this.pullState.error = error.message;
        this.emitPull();
      }
      throw error;
    } finally {
      // Keep the terminal state visible for the UI, then clear.
      const terminal = this.pullState;
      setTimeout(() => {
        if (this.pullState === terminal) {
          this.pullState = null;
          this.emitPull();
        }
      }, 30_000).unref?.();
    }
  }

  /** Parse Ollama's NDJSON pull stream into aggregate progress. */
  async consumePullStream(body, entry) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          this.applyPullLine(JSON.parse(line));
        } catch {
          // A malformed progress line is not a failed download.
        }
      }
    }
    if (!this.pullState || this.pullState.status !== 'success') {
      // The stream ended without an explicit success line — verify via /api/tags.
      const installed = await this.listInstalled();
      const found = installed.some((m) => m.name === entry.ollamaTag);
      if (!found) {
        throw new Error('Pull stream ended before the model was ready');
      }
      this.pullState.status = 'success';
    }
    this.emitPull();
  }

  applyPullLine(line) {
    if (!this.pullState || !line || typeof line !== 'object') return;
    if (line.status === 'success') {
      this.pullState.status = 'success';
    } else if (line.digest) {
      const seen = this.pullState.digests.get(line.digest) || { total: 0, completed: 0 };
      seen.total = Number(line.total) || seen.total;
      seen.completed = Number(line.completed) || seen.completed;
      this.pullState.digests.set(line.digest, seen);
    } else if (line.error) {
      throw new Error(String(line.error).slice(0, 300));
    }
    this.emitPull();
  }

  cancelPull() {
    if (!this.pullState || this.pullState.status !== 'pulling') return false;
    // Ollama has no cancel endpoint for pulls; we stop tracking and let the
    // download finish in the background (it becomes a cached model).
    this.pullState.status = 'cancelled';
    this.emitPull();
    const terminal = this.pullState;
    setTimeout(() => {
      if (this.pullState === terminal) {
        this.pullState = null;
        this.emitPull();
      }
    }, 5000).unref?.();
    return true;
  }

  // ── Remove ─────────────────────────────────────────────────────────────

  async removeModel(userId, modelId) {
    const entry = getLibraryEntry(modelId);
    if (!entry) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    await this.deleteFromOllama(entry.ollamaTag);
    // If the removed model was the active brain, fall back to the phone.
    const selection = this.brainProviderModel ? await this.brainProviderModel.getSelection(userId) : null;
    if (selection?.provider === 'ollama' && selection?.modelId === modelId) {
      await this.deactivate(userId);
    }
    return { removed: modelId };
  }

  /** Remove a user-added custom model: delete from Ollama + deregister. */
  async removeCustomModel(userId, customId) {
    if (!this.customModelModel) {
      const error = new Error('Custom models are not configured on this deployment');
      error.code = 'NOT_CONFIGURED';
      throw error;
    }
    const record = await this.customModelModel.get(customId);
    if (!record) {
      const error = new Error(`Unknown custom model "${customId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    await this.deleteFromOllama(record.tag);
    await this.customModelModel.remove(customId);
    const selection = this.brainProviderModel ? await this.brainProviderModel.getSelection(userId) : null;
    if (selection?.provider === 'ollama' && selection?.modelId === `custom:${customId}`) {
      await this.deactivate(userId);
    }
    return { removed: `custom:${customId}`, tag: record.tag };
  }

  async deleteFromOllama(ollamaTag) {
    const api = await this.detectApi();
    if (!api.running) {
      const error = new Error('Ollama is not running');
      error.code = 'OLLAMA_NOT_RUNNING';
      throw error;
    }
    const response = await fetch(`${this.apiBase}/delete`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: ollamaTag })
    });
    if (!response.ok) {
      const error = new Error(`Ollama could not remove the model (HTTP ${response.status})`);
      error.code = 'REMOVE_FAILED';
      throw error;
    }
  }

  // ── Activation (the brain switch) ──────────────────────────────────────

  /**
   * Switch the agent's brain to an installed library OR custom model.
   * Persists, and takes effect for the next reasoning step (running jobs keep
   * going — only the inference backend changes).
   */
  async activate(userId, modelId) {
    let resolved = null; // { modelId, ollamaTag, name }
    const libraryEntry = getLibraryEntry(modelId);
    if (libraryEntry) {
      resolved = { modelId: libraryEntry.id, ollamaTag: libraryEntry.ollamaTag, name: libraryEntry.name };
    } else if (String(modelId).startsWith('custom:') && this.customModelModel) {
      const record = await this.customModelModel.get(String(modelId).slice('custom:'.length));
      if (record) {
        resolved = { modelId: `custom:${record.id}`, ollamaTag: record.tag, name: record.label };
      }
    }
    if (!resolved) {
      const error = new Error(`Unknown model "${modelId}"`);
      error.code = 'UNKNOWN_MODEL';
      throw error;
    }
    const installed = await this.listInstalled();
    if (!installed.some((m) => m.name === resolved.ollamaTag)) {
      const error = new Error(`"${resolved.name}" is not downloaded yet — pull it first`);
      error.code = 'MODEL_NOT_INSTALLED';
      throw error;
    }
    const selection = await this.brainProviderModel.setSelection(userId, {
      provider: 'ollama',
      modelId: resolved.modelId,
      ollamaTag: resolved.ollamaTag
    });
    if (this.onActivate) {
      await this.onActivate(userId, { provider: 'ollama', modelId: resolved.modelId, ollamaTag: resolved.ollamaTag });
    }
    return { active: selection, model: resolved };
  }

  /** Switch the brain back to the phone-hosted model. */
  async deactivate(userId) {
    const selection = await this.brainProviderModel.setSelection(userId, { provider: 'phone' });
    if (this.onActivate) {
      await this.onActivate(userId, { provider: 'phone', modelId: null, ollamaTag: null });
    }
    return { active: selection };
  }

  getDefaultEntry() {
    return getDefaultEntry();
  }
}
