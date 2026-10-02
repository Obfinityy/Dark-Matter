/**
 * userBrainAdapter.js — Infinity AI's per-user brain.
 *
 * Problem it solves: the Models page promises "Run — it becomes the ACTIVE
 * brain for Hunt and Infinity AI", but Infinity AI (chat / plan / build)
 * was hard-wired to the phone-hosted model (PhoneModelAdapter). Hunts were
 * already wired through the ResilientBrainProvider chain; this adapter gives
 * Infinity the same treatment.
 *
 * Design:
 *  - Implements the exact Infinity model contract:
 *      { enabled, complete(messages, options) → { text, finishReason, raw },
 *        completeJson(messages, options) → parsed JSON,
 *        streamComplete(messages, options) → { text } }
 *    so it drops into LongContextEngine / LongGenerationEngine / planInstruction
 *    wherever a PhoneModelAdapter was used.
 *  - The caller passes `options.userId`. The adapter reads that user's brain
 *    selection (brainProviderModel) and builds the SAME fallback chain hunts
 *    use (local → next downloaded model → remembered Kaggle/Colab GPU →
 *    phone). Chains are cached per user and rebuilt automatically when the
 *    selection changes (cache key = selection JSON).
 *  - Phone-default users (or calls without a userId, e.g. background
 *    summarization) delegate to the injected PhoneModelAdapter untouched —
 *    zero behavior change on the default path: same retries, same context-
 *    overflow handling, same queue.
 *  - Non-phone brains get their own small concurrency queue (max 2), mirroring
 *    agentWorker — the phone hardware queue is never blocked by a local GPU.
 */

import { buildBrainChain, ResilientBrainProvider } from '../agent/providers/resilientBrainProvider.js';
import { LocalAIQueue } from '../agent/providers/localAiQueue.js';
import { stripThinkingTags } from '../agent/providers/phoneLocalProvider.js';

function isPhoneDefault(selection) {
  const provider = selection?.provider || 'phone';
  return provider === 'phone';
}

export class UserBrainAdapter {
  /**
   * @param {object} args
   * @param {object} [args.brainProviderModel] per-user brain selections
   * @param {object} [args.modelRunnerService] local model runner (local chain links)
   * @param {object} [args.appConfig]          phone/API config for chain links
   * @param {object} [args.defaultModel]       PhoneModelAdapter — serves the phone-default path
   */
  constructor({ brainProviderModel = null, modelRunnerService = null, appConfig = {}, defaultModel = null } = {}) {
    this.brainProviderModel = brainProviderModel;
    this.modelRunnerService = modelRunnerService;
    this.appConfig = appConfig;
    this.defaultModel = defaultModel;
    this.nonPhoneQueue = new LocalAIQueue({ maxConcurrency: 2 });
    this.chainCache = new Map(); // userId|anon -> { key, provider }
  }

  get enabled() {
    // The phone fallback is always servable; the default path keeps the
    // original "Local AI is disabled" semantics via defaultModel.enabled.
    if (this.defaultModel && typeof this.defaultModel.enabled !== 'undefined') {
      return this.defaultModel.enabled;
    }
    return true;
  }

  /**
   * Async gate for callers that need per-user accuracy: a user with a
   * non-phone brain selection (Models → Run, Kaggle/Colab connect) has a
   * servable brain even when the phone provider is disabled.
   */
  async isEnabledFor(userId) {
    if (this.enabled) return true;
    const selection = await this._selectionFor(userId);
    return selection.provider !== 'phone';
  }

  /** Drop a cached chain (e.g. right after the user presses Run/Stop). */
  invalidateUser(userId) {
    this.chainCache.delete(userId || 'anon');
  }

  async _selectionFor(userId) {
    if (!this.brainProviderModel || !userId) return { provider: 'phone' };
    try {
      return (await this.brainProviderModel.getSelection(userId)) || { provider: 'phone' };
    } catch {
      return { provider: 'phone' };
    }
  }

  /** The ResilientBrainProvider for this user's selection (cached, auto-rebuilt on change). */
  async _providerFor(userId) {
    const selection = await this._selectionFor(userId);
    const cacheId = userId || 'anon';
    const key = JSON.stringify({
      provider: selection.provider,
      modelId: selection.modelId || null,
      endpointUrl: selection.endpointUrl || null,
      lastGradioUrl: selection.lastGradioUrl || null
    });
    const cached = this.chainCache.get(cacheId);
    if (cached && cached.key === key) return cached.provider;

    let downloaded = null;
    if (selection.provider === 'local' && this.modelRunnerService?.library) {
      try {
        downloaded = await this.modelRunnerService.library();
      } catch { /* chain still builds — phone fallback survives */ }
    }
    const chain = buildBrainChain({
      selection,
      appConfig: this.appConfig,
      runner: this.modelRunnerService,
      downloaded
    });
    const provider = new ResilientBrainProvider(chain);
    this.chainCache.set(cacheId, { key, provider });
    return provider;
  }

  /**
   * Chat completion against the user's active brain.
   * @returns {Promise<{ text: string, finishReason: string|null, raw: object }>}
   */
  async complete(messages, options = {}) {
    const selection = await this._selectionFor(options.userId);
    if (isPhoneDefault(selection)) {
      // Default path: the original phone pipeline, byte-for-byte behavior.
      return this.defaultModel.complete(messages, options);
    }
    const provider = await this._providerFor(options.userId);
    const text = await this.nonPhoneQueue.enqueue(() =>
      provider.generate(messages, {
        maxTokens: options.maxTokens ?? 768,
        timeout: options.timeoutMs,
        temperature: options.temperature
      })
    );
    return {
      text: stripThinkingTags(String(text || '')),
      finishReason: 'stop',
      raw: { brain: provider.activeName }
    };
  }

  /**
   * JSON completion — mirrors PhoneModelAdapter.completeJson: generate text,
   * extract the first JSON object. Throws JSON_PARSE_FAILED like the original.
   */
  async completeJson(messages, options = {}) {
    const { text } = await this.complete(messages, options);
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) {
      const err = new Error('Model did not return JSON');
      err.code = 'JSON_PARSE_FAILED';
      err.rawText = String(text || '').slice(0, 400);
      throw err;
    }
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      const err = new Error('Model returned malformed JSON');
      err.code = 'JSON_PARSE_FAILED';
      err.rawText = String(text || '').slice(0, 400);
      throw err;
    }
  }

  /**
   * Streaming completion. Providers expose heterogeneous stream shapes, so
   * this delivers the reply as a single honest chunk through the same
   * onToken/onState callbacks the controller already handles.
   */
  async streamComplete(messages, options = {}) {
    const { onToken = () => {}, onState = () => {} } = options;
    onState({ step: 'Resolving brain', detail: 'Using your active Models brain…' });
    try {
      const { text } = await this.complete(messages, options);
      onState({ step: 'Receiving response', detail: 'Reply ready.' });
      onToken(text, text);
      return { text };
    } catch (err) {
      onState({ step: 'Brain failed', detail: err?.message || String(err) });
      throw err;
    }
  }
}
