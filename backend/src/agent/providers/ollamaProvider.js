/**
 * ollamaProvider.js — the local uncensored brain on the user's own machine.
 *
 * Talks to Ollama's OpenAI-compatible API (/v1/chat/completions, /v1/models).
 * Unlike the phone path, Ollama natively supports the `system` role, so
 * messages pass through untouched. No API key, no cloud, no throttling:
 * it is the user's own hardware.
 *
 * Implements the AutonomousBrain provider contract:
 *   { enabled, healthCheck(), generate(messages, options),
 *     generateStructured(messages, schema, options), stream(messages, options),
 *     resolveModel() }
 */

import { stripThinkingTags } from './phoneLocalProvider.js';

function normalizeConfig(input = {}) {
  // Accept { ollama: { host, port, model } } (service config shape),
  // { host, port, model }, or { baseUrl, model }.
  const nested = input.ollama && typeof input.ollama === 'object' ? input.ollama : {};
  const host = nested.host || input.host || '127.0.0.1';
  const port = Number(nested.port || input.port || 11434);
  const model = nested.model || input.model || 'huihui_ai/qwen3-abliterated:30b';
  const baseUrl = String(input.baseUrl || `http://${host}:${port}/v1`).replace(/\/$/, '');
  return {
    baseUrl: baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`,
    model
  };
}

export class OllamaProvider {
  constructor(config = {}) {
    const { baseUrl, model } = normalizeConfig(config);
    this.baseUrl = baseUrl;
    this.model = model;
    this.enabled = true;
  }

  /** The model this brain reasons with (mirrors PhoneLocalProvider). */
  async resolveModel() {
    return this.model;
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        return { provider: 'OllamaProvider', enabled: true, reachable: false, modelInstalled: false, reason: `HTTP ${response.status}`, latencyMs };
      }
      let actualModel = this.model;
      let modelInstalled = false;
      try {
        const body = await response.json();
        const names = (body?.data || []).map((m) => m.id);
        modelInstalled = names.includes(this.model);
        if (!modelInstalled && names.length > 0) actualModel = names[0];
      } catch { /* model list is advisory */ }
      return { provider: 'OllamaProvider', enabled: true, reachable: true, model: actualModel, modelInstalled, latencyMs };
    } catch (error) {
      return { provider: 'OllamaProvider', enabled: true, reachable: false, modelInstalled: false, reason: error.message, latencyMs: Date.now() - start };
    }
  }

  async generate(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeout || 120000),
      body: JSON.stringify({
        model: this.model,
        messages: Array.isArray(messages) ? messages : [],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4000,
        stream: false
      })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty Ollama response');
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
    if (!match) throw new Error('Ollama did not return JSON');
    return JSON.parse(match[0]);
  }

  /**
   * Streaming completions — returns the raw SSE response body (same shape as
   * PhoneLocalProvider.stream) so callers can pipe tokens to the UI live.
   */
  async stream(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeout || 120000),
      body: JSON.stringify({
        model: this.model,
        messages: Array.isArray(messages) ? messages : [],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4000,
        stream: true
      })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama Stream ${response.status}: ${errText.slice(0, 200)}`);
    }
    return response.body;
  }
}
