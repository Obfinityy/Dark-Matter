/**
 * resilientBrainProvider.js — brain fallback chain.
 *
 * When the user's chosen brain fails (local llama-server crashes, the
 * Kaggle/Colab tab closes, the API key dies), hunts should NOT die with it.
 * The ResilientBrainProvider wraps an ordered chain of provider links and
 * fails over automatically:
 *
 *   1. user's selected brain (local model / Kaggle remote / Ollama / phone API)
 *   2. next downloaded local model (smallest first — fastest to load)
 *   3. last connected Kaggle/Colab remote GPU (survives provider switches)
 *   4. phone API (always available — the final safety net)
 *
 * Failover is triggered by a failed generate/generateStructured/stream call.
 * The provider that failed is skipped for the rest of this instance's life;
 * `chainStatus()` reports which link is active and what failed, so the UI
 * can show it and the user can intervene (re-run the local model, reconnect
 * the remote, …).
 *
 * A link is `{ name, provider?, activate? }` — providers can be supplied
 * eagerly, or lazily via `activate()` (needed for "next downloaded model",
 * which has to be RUN before it can think).
 */

import { createBrainProvider } from './brainProviderFactory.js';

/**
 * Build the fallback chain for a user's brain selection.
 *
 * @param {object} args
 * @param {object} args.selection  brainProviderModel.getSelection(userId)
 * @param {object} args.appConfig  app config (phone API keys, …)
 * @param {object} [args.runner]   modelRunnerService — enables the
 *                                 "next downloaded local model" links
 * @param {Array}  [args.downloaded] pre-fetched modelRunnerService.library()
 *                                 entries (avoids a second call)
 * @returns {Array<{name, provider?, activate?}>}
 */
export function buildBrainChain({
  selection = {},
  appConfig = {},
  runner = null,
  downloaded = null,
}) {
  const chain = [];
  const provider = selection.provider || 'phone';

  const makeProvider = (prov, opts) => createBrainProvider(prov, appConfig, opts);

  // ── Link 1: the user's selected brain ──────────────────────────────────
  if (provider === 'local' && selection.modelId) {
    chain.push({
      name: `local:${selection.modelId}`,
      provider: makeProvider('local', { model: selection.modelId, runner }),
    });
  } else if (provider === 'gradio' && selection.endpointUrl) {
    chain.push({
      name: 'gradio:remote',
      provider: makeProvider('gradio', { baseUrl: selection.endpointUrl }),
    });
  } else if (provider === 'ollama') {
    chain.push({
      name: `ollama:${selection.ollamaTag || selection.modelId || 'default'}`,
      provider: makeProvider('ollama', {
        model: selection.ollamaTag || selection.modelId || null,
        baseUrl: selection.endpointUrl || null,
      }),
    });
  }
  // 'phone' is always the last link, so it is never duplicated up here.

  // ── Link 2: next downloaded local model (smallest first) ───────────────
  // Only when the user chose local: their other downloaded models are the
  // cheapest fallback (no network, no API cost). Lazy: running a model can
  // take minutes, so it only happens if the primary actually fails.
  if (provider === 'local' && runner && Array.isArray(downloaded)) {
    const others = downloaded
      .filter(m => m?.downloaded && m.id && m.id !== selection.modelId)
      .sort((a, b) => (a.sizeGB || Infinity) - (b.sizeGB || Infinity));
    for (const m of others) {
      chain.push({
        name: `local:${m.id}`,
        activate: async () => {
          await runner.run(m.id);
          return makeProvider('local', { model: m.id, runner });
        },
      });
    }
  }

  // ── Link 3: last connected Kaggle/Colab remote GPU ─────────────────────
  // The URL survives provider switches (brainProviderModel.lastGradioUrl),
  // so a dead local model can fall back to the remote GPU automatically.
  const remoteUrl =
    selection.provider === 'gradio' ? selection.endpointUrl : selection.lastGradioUrl;
  if (remoteUrl && provider !== 'gradio') {
    chain.push({
      name: 'gradio:remote',
      provider: makeProvider('gradio', { baseUrl: remoteUrl }),
    });
  }

  // ── Link 4: phone API — the final safety net, always present ───────────
  chain.push({ name: 'phone:api', provider: makeProvider('phone', {}) });

  // Deduplicate by name (selection could equal a fallback).
  const seen = new Set();
  return chain.filter(link => (seen.has(link.name) ? false : (seen.add(link.name), true)));
}

/**
 * Provider wrapper implementing automatic failover across a chain.
 * Implements the standard brain-provider contract:
 * { enabled, healthCheck(), generate(), generateStructured(), stream(), resolveModel() }
 */
export class ResilientBrainProvider {
  constructor(chain = []) {
    if (!Array.isArray(chain) || chain.length === 0) {
      throw new Error('ResilientBrainProvider requires a non-empty chain');
    }
    this.chain = chain;
    this.activeIndex = 0;
    this.activeProvider = null;
    this.failed = []; // names of links that failed, in order
    this.failoverLog = []; // { from, to, reason, at }
    this.enabled = true;
  }

  /** Activate the current link (runs lazy `activate()` once, caches). */
  async _ensureActive() {
    if (this.activeProvider) return this.activeProvider;
    const link = this.chain[this.activeIndex];
    if (!link) {
      throw new Error('Brain chain exhausted — no more fallbacks');
    }
    if (link.provider) {
      this.activeProvider = link.provider;
    } else if (typeof link.activate === 'function') {
      this.activeProvider = await link.activate();
      link.provider = this.activeProvider; // cache — don't run the model twice
    } else {
      throw new Error(`Brain chain link "${link.name}" has no provider`);
    }
    return this.activeProvider;
  }

  get activeName() {
    return this.chain[this.activeIndex]?.name || null;
  }

  /** Move to the next link; returns false when the chain is exhausted. */
  _advance(reason) {
    const from = this.activeName;
    this.failed.push(from);
    this.activeIndex += 1;
    this.activeProvider = null;
    const to = this.activeName;
    this.failoverLog.push({
      from,
      to: to || null,
      reason: String(reason || 'error'),
      at: new Date().toISOString(),
    });
    return this.activeIndex < this.chain.length;
  }

  /**
   * Run `fn` against the active provider, failing over on error.
   * Each link gets exactly one attempt per call.
   */
  async _withFailover(fn, opName) {
    let lastError = null;
    // Reset to the primary link for each new operation. The provider is
    // cached per user and stateful — without this, a previous operation
    // that exhausted the chain leaves activeIndex out of bounds, and the
    // next call crashes with "Cannot read properties of undefined".
    this.activeIndex = 0;
    this.activeProvider = null;
    // Ensure the primary is activated (lazy links may throw here too).
    while (true) {
      let provider;
      try {
        provider = await this._ensureActive();
      } catch (err) {
        lastError = err;
        if (!this._advance(`activate failed: ${err?.message}`)) break;
        continue;
      }
      try {
        return await fn(provider);
      } catch (err) {
        lastError = err;
        if (!this._advance(`${opName} failed: ${err?.message}`)) break;
      }
    }
    const tried = this.failoverLog.map(f => f.from).join(' → ');
    throw new Error(
      `All brain fallbacks exhausted (${tried}). Last error: ${lastError?.message || lastError}`
    );
  }

  async generate(messages, opts) {
    return this._withFailover(p => p.generate(messages, opts), 'generate');
  }

  async generateStructured(messages, schema, opts) {
    return this._withFailover(
      p => p.generateStructured(messages, schema, opts),
      'generateStructured'
    );
  }

  /**
   * Streaming with failover. Providers return either a promise of a stream
   * or an async-iterable directly; errors at call time AND mid-iteration
   * both trigger failover to the next link (the stream restarts there).
   */
  async *stream(messages, opts) {
    let lastError = null;
    while (true) {
      let provider;
      try {
        provider = await this._ensureActive();
      } catch (err) {
        lastError = err;
        if (!this._advance(`activate failed: ${err?.message}`)) break;
        continue;
      }
      try {
        const started = provider.stream(messages, opts);
        const iterable = started && typeof started.then === 'function' ? await started : started;
        yield* iterable;
        return;
      } catch (err) {
        lastError = err;
        if (!this._advance(`stream failed: ${err?.message}`)) break;
      }
    }
    const tried = this.failoverLog.map(f => f.from).join(' → ');
    throw new Error(
      `All brain fallbacks exhausted (${tried}). Last error: ${lastError?.message || lastError}`
    );
  }

  resolveModel() {
    try {
      return this.activeProvider?.resolveModel?.() || this.activeName;
    } catch {
      return this.activeName;
    }
  }

  /**
   * Chain health: which link is active, per-link reachability, failover log.
   * Never throws — a status endpoint must not die because a brain is down.
   */
  async healthCheck() {
    const links = [];
    for (let i = 0; i < this.chain.length; i++) {
      const link = this.chain[i];
      let reachable = null;
      let reason = null;
      if (link.provider?.healthCheck) {
        try {
          const h = await link.provider.healthCheck();
          reachable = h?.reachable !== false && h?.ok !== false;
        } catch (err) {
          reachable = false;
          reason = err?.message || String(err);
        }
      }
      links.push({
        name: link.name,
        active: i === this.activeIndex,
        failed: this.failed.includes(link.name),
        reachable,
        ...(reason ? { reason } : {}),
      });
    }
    // Top-level reachable: the ACTIVE link answers. Callers like
    // ComputerTaskBrain.health() check `health.reachable` — without this
    // field they see `undefined` and wrongly report BRAIN UNAVAILABLE.
    const activeLink = links[this.activeIndex];
    const reachable = activeLink ? activeLink.reachable !== false : false;
    const reason = activeLink?.reason || null;
    return {
      provider: 'ResilientBrainProvider',
      active: this.activeName,
      reachable,
      ...(reason ? { reason } : {}),
      degraded: this.failoverLog.length > 0,
      links,
      failoverLog: this.failoverLog,
    };
  }

  /** Serializable snapshot for the Models UI (no activation, no side effects). */
  describe() {
    return {
      active: this.activeName,
      degraded: this.failoverLog.length > 0,
      chain: this.chain.map((l, i) => ({
        name: l.name,
        active: i === this.activeIndex,
        failed: this.failed.includes(l.name),
      })),
      failoverLog: this.failoverLog,
    };
  }
}
