/**
 * localLlamaProvider.js — the brain when a model is RUNNING via model-runner.
 *
 * Talks to the backend-spawned llama-server's OpenAI-compatible API
 * (/v1/chat/completions, /v1/models) on 127.0.0.1. No Ollama, no cloud.
 * The endpoint is dynamic (free port per run), so the provider resolves it
 * from the ModelRunnerService on every call — never a stale URL.
 *
 * Implements the AutonomousBrain provider contract:
 *   { enabled, healthCheck(), generate(messages, options),
 *     generateStructured(messages, schema, options), stream(messages, options),
 *     resolveModel() }
 */

import { stripThinkingTags } from './phoneLocalProvider.js';

export class LocalLlamaProvider {
  /**
   * @param {object} options
   * @param {import('../../services/modelRunner/modelRunnerService.js').ModelRunnerService} options.runner
   * @param {string} [options.slot] — brain slot ('vision'|'grounding'|'hacker'); when set,
   *   the provider talks to THAT slot's server on its own port instead of the
   *   legacy single `running` server.
   * @param {number} [options.timeout] default per-request timeout ms
   */
  constructor({ runner, slot = null, timeout = 180000 } = {}) {
    if (!runner) throw new Error('LocalLlamaProvider requires a ModelRunnerService');
    this.runner = runner;
    this.slot = slot;
    this.timeout = timeout;
    this.enabled = true;
  }

  baseUrl() {
    // Slot-aware: prefer the slot's own server; fall back to legacy single server.
    if (this.slot) {
      const server = this.runner.getSlotServer?.(this.slot);
      if (server?.baseUrl) return server.baseUrl;
    }
    return this.runner.endpoint(); // null when nothing is running
  }

  async resolveModel() {
    if (this.slot) {
      const server = this.runner.getSlotServer?.(this.slot);
      if (server?.modelId) return server.modelId;
    }
    return this.runner.running?.modelId || 'local-llama';
  }

  async healthCheck() {
    const start = Date.now();
    // Adopt a server orphaned by a backend restart before judging health.
    try { await this.runner.ensureRunningState?.(); } catch { /* best effort */ }
    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      return { provider: 'LocalLlamaProvider', enabled: true, reachable: false, modelInstalled: false, reason: 'No local model is running', latencyMs: Date.now() - start };
    }
    try {
      const response = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        return { provider: 'LocalLlamaProvider', enabled: true, reachable: false, modelInstalled: false, reason: `HTTP ${response.status}`, latencyMs };
      }
      let modelInstalled = false;
      try {
        const body = await response.json();
        modelInstalled = Array.isArray(body?.data) && body.data.length > 0;
      } catch { /* advisory */ }
      return { provider: 'LocalLlamaProvider', enabled: true, reachable: true, model: await this.resolveModel(), modelInstalled, latencyMs };
    } catch (error) {
      return { provider: 'LocalLlamaProvider', enabled: true, reachable: false, modelInstalled: false, reason: error.message, latencyMs: Date.now() - start };
    }
  }

  async generate(messages, options = {}) {
    try { await this.runner.ensureRunningState?.(); } catch { /* best effort */ }
    const baseUrl = this.baseUrl();
    if (!baseUrl) throw new Error('No local model is running — press Run on a downloaded model first');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeout || this.timeout),
      body: JSON.stringify({
        messages: Array.isArray(messages) ? messages : [],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4000,
        stream: false
      })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Local model ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty local model response');
    return stripThinkingTags(text);
  }

  async generateStructured(messages, schema, options = {}) {
    const text = await this.generate(
      [
        ...(Array.isArray(messages) ? messages : []),
        {
          role: 'system',
          content: `You must respond with valid JSON matching this schema: ${JSON.stringify(schema)}. Output ONLY the JSON object, no other text.`
        }
      ],
      { ...options, temperature: options.temperature ?? 0.1 }
    );
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Local model did not return JSON');
    return JSON.parse(match[0]);
  }

  /** Streaming completions — raw SSE body, same shape as other providers. */
  async stream(messages, options = {}) {
    const baseUrl = this.baseUrl();
    if (!baseUrl) throw new Error('No local model is running — press Run on a downloaded model first');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeout || this.timeout),
      body: JSON.stringify({
        messages: Array.isArray(messages) ? messages : [],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4000,
        stream: true
      })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Local model stream ${response.status}: ${errText.slice(0, 200)}`);
    }
    return response.body;
  }
}
