/**
 * gradioProvider.js — brain provider for a REMOTE GPU model served via
 * Gradio ChatInterface (e.g. Qwen3-8B running on Kaggle/Colab with a
 * public share link like https://xxxx.gradio.live).
 *
 * Why this exists: the user's phone/PC may be too slow for an 8B model
 * (400+ seconds per reply on 2 CPUs). A Kaggle T4 answers in ~2 seconds.
 * The user pastes the Gradio share URL in the Models page, presses
 * Connect, and the agent's brain runs on that remote GPU.
 *
 * Implements the AutonomousBrain provider contract:
 *   { enabled, healthCheck(), generate(messages, options),
 *     generateStructured(messages, schema, options) }
 *
 * The Gradio ChatInterface HTTP API:
 *   POST {base}/gradio_api/api/chat  { data: [message, history] }
 *   → { data: [reply, null], ... }
 */
import { stripThinkingTags, parseLenientJson } from './phoneLocalProvider.js';

const DEFAULT_TIMEOUT_MS = 300000; // 5 min — GPU inference + queue wait

function normalizeBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Gradio URL is required');
  let url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid Gradio URL');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Gradio URL must use http or https');
  if (!parsed.hostname) throw new Error('Gradio URL must include a host');
  return `${parsed.protocol}//${parsed.host}`;
}

function messagesToPrompt(messages = []) {
  const parts = [];
  for (const m of messages || []) {
    const role = m?.role || 'user';
    const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
    if (role === 'system') parts.push(`[System Instructions]\n${content}`);
    else if (role === 'assistant') parts.push(`Assistant: ${content}`);
    else parts.push(`User: ${content}`);
  }
  return parts.join('\n\n');
}

export class GradioProvider {
  constructor({ baseUrl, model = 'qwen3-8b', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.model = model || 'qwen3-8b';
    this.timeoutMs = timeoutMs;
    this.enabled = true;
  }

  get providerName() { return 'GradioProvider'; }

  async healthCheck() {
    const start = Date.now();
    try {
      // The /config endpoint is light and always present on Gradio apps.
      const res = await fetch(`${this.baseUrl}/config`, {
        signal: AbortSignal.timeout(15000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return { provider: 'GradioProvider', enabled: true, reachable: false, latencyMs, reason: `HTTP ${res.status}` };
      }
      let mode = '';
      try {
        const cfg = await res.json();
        mode = cfg?.mode || '';
      } catch { /* ignore */ }
      return {
        provider: 'GradioProvider',
        enabled: true,
        reachable: true,
        latencyMs,
        model: this.model,
        baseUrl: this.baseUrl,
        mode: mode || 'unknown',
      };
    } catch (err) {
      return {
        provider: 'GradioProvider',
        enabled: true,
        reachable: false,
        latencyMs: Date.now() - start,
        reason: err?.message || String(err),
      };
    }
  }

  /**
   * Send a message to the Gradio chat endpoint with retries.
   * Gradio share links occasionally drop a connection; retry 3 times.
   */
  async chatOnce(prompt, { timeoutMs, maxTokens } = {}) {
    const url = `${this.baseUrl}/gradio_api/api/chat`;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', connection: 'close' },
          signal: AbortSignal.timeout(timeoutMs || this.timeoutMs),
          body: JSON.stringify({ data: [prompt, []] }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Gradio HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        const reply = data?.data?.[0];
        if (typeof reply !== 'string' || !reply.trim()) {
          throw new Error('Empty reply from remote model');
        }
        return reply;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error(`Remote model failed after 3 attempts: ${lastErr?.message || lastErr}`);
  }

  async generate(messages, options = {}) {
    const prompt = messagesToPrompt(messages);
    // Hint the token budget so long reasoning doesn't starve the answer.
    const maxTokens = options.maxTokens ?? 2000;
    const budgetHint = maxTokens < 800
      ? '\n\n[Keep your answer concise.]'
      : '';
    const reply = await this.chatOnce(prompt + budgetHint, {
      timeoutMs: options.timeout || this.timeoutMs,
      maxTokens,
    });
    return stripThinkingTags(reply);
  }

  async generateStructured(messages, schema, options = {}) {
    const schemaText = typeof schema === 'string' ? schema : JSON.stringify(schema);
    const prompt =
      messagesToPrompt(messages) +
      `\n\n[System Instructions]\nRespond with ONLY valid JSON matching this schema, no prose:\n${schemaText}`;
    const reply = await this.chatOnce(prompt, {
      timeoutMs: options.timeout || this.timeoutMs,
    });
    const cleaned = stripThinkingTags(reply);
    return parseLenientJson(cleaned);
  }
}

export { normalizeBaseUrl as normalizeGradioUrl };
