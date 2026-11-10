// Dark Matter backend — LLM client for real AI chat (not hardcoded).
//
// The mid-hunt chat must THINK, not recite canned responses. This module
// provides a real LLM backend. The provider is chosen by LLM_PROVIDER:
//
//   LLM_PROVIDER=bedrock (default) — AWS Bedrock (credentials from env).
//   LLM_PROVIDER=ollama            — locally hosted Ollama on the same host,
//                                    e.g. dolphin-mistral:7b (uncensored).
//                                    $0 marginal token cost; the host itself
//                                    is the only cost.
//   LLM_PROVIDER=sagemaker         — AWS SageMaker async inference endpoint.
//                                    For larger models (32B+) that don't fit
//                                    on the EC2 box. Pay-per-use, scales to
//                                    zero. Set SAGEMAKER_ENDPOINT_NAME.
//   LLM_PROVIDER=openrouter          — OpenRouter API (OpenAI-compatible).
//                                    Fast GPU inference, $0 on free-tier
//                                    models. Set OPENROUTER_API_KEY and
//                                    optionally OPENROUTER_MODEL.
//
// When the configured provider is unavailable, chatWithAI returns null and
// the caller falls back to deterministic steering (pause/resume/stop) plus
// an honest notice.
//
// Steering commands (pause/resume/stop) STAY rule-based in chat.js —
// deterministic control must never depend on an LLM's mood.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import fs from 'node:fs';
// NOTE: SageMaker SDK is imported LAZILY (dynamic import) only when
// LLM_PROVIDER=sagemaker, because the installed SDK version may not export
// the async APIs as named ESM exports. A static import here crashes the
// entire backend on startup if the exports don't exist.
import { recordCost, recordCostSafe } from './costTracker.js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { chatWithOllama, getInferenceHeartbeatPath } from './llm/ollama.js';
import { sanitizeForModel } from './llm/sanitize.js';
export { OLLAMA_ADVISORY_TIMEOUT_MS_DEFAULT, OLLAMA_READY_POLL_MS_DEFAULT, OLLAMA_READY_WAIT_MS_DEFAULT, getInferenceHeartbeatPath, isOllamaConnectionError, ollamaMessageCharCap, waitForOllamaReady, writeInferenceHeartbeat } from './llm/ollama.js';
export { sanitizeForModel } from './llm/sanitize.js';

const log = createLogger('llm');

const PROVIDER = String(process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

const DEFAULT_MODEL = process.env.BEDROCK_MODEL || 'meta.llama3-1-70b-instruct-v1:0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';


// SageMaker async inference — for 32B+ models. Endpoint scales to zero;
// each invocation is pay-per-use (~$4-5 per 3-hour hunt on 32B).
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT_NAME || '';
const SAGEMAKER_REGION = process.env.SAGEMAKER_REGION || process.env.AWS_REGION || 'us-east-1';

// Kaggle Gradio poll: how long to wait between result polls.
const KAGGLE_POLL_MS = 2000;

function getBedrockConfig() {
  // AWS is connected BY DEFAULT via environment variables (owner's account).
  // No per-user plugin setup needed — invite-only, owner controls the keys.
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    region: DEFAULT_REGION,
    credentials: { accessKeyId, secretAccessKey },
    model: DEFAULT_MODEL,
  };
}

/** True when the configured AI backend is available for chat. */
export function aiAvailable() {
  if (PROVIDER === 'ollama') return true; // endpoint is probed on first real call
  if (PROVIDER === 'openrouter') return !!process.env.OPENROUTER_API_KEY;
  if (PROVIDER === 'kaggle') return !!process.env.KAGGLE_GRADIO_URL;
  return getBedrockConfig() !== null;
}

// CHAT-ANSWERS (26 Oct 2026): is an inference running RIGHT NOW?
// chatWithOllama writes a heartbeat file carrying a deadline while a
// generation runs and deletes it when done (the same file the
// ollama-watchdog reads, so the watchdog never kills a healthy busy
// server). A fresh heartbeat means the one shared 8B is occupied —
// a chat question sent now would queue 10–25 min behind the running
// hunt turn and die at the deadline. Callers answer from the live
// record instead. Best-effort and side-effect-free: a missing,
// unreadable, or stale file means "not busy". The AI_HEARTBEAT_PATH
// env var is read at call time (not module load) so tests can point it at a temp file.
export function isInferenceActive() {
  try {
    const p = getInferenceHeartbeatPath();
    const hb = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof hb.deadline === 'number' && hb.deadline > Date.now();
  } catch {
    return false;
  }
}

async function chatWithBedrock(messages, system, ctx) {
  const cfg = getBedrockConfig();
  if (!cfg) return null;
  const client = new BedrockRuntimeClient({
    region: cfg.region,
    credentials: cfg.credentials,
  });
  // Privacy gateway (Dark-Moon technique): strip secrets/PII before the model.
  const clean = (t) => sanitizeForModel(String(t || ''));
  const cmd = new ConverseCommand({
    modelId: cfg.model,
    system: system ? [{ text: clean(system) }] : undefined,
    messages: (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: clean(m.text).slice(0, 8000) }],
    })),
    inferenceConfig: { maxTokens: 1500, temperature: 0.7 },
  });
  const out = await client.send(cmd);
  // Burn tracking: every token has a price.
  recordCostSafe(() => {
    const usage = out.usage || {};
    if (usage.inputTokens || usage.outputTokens) {
      recordCost({
        userId: ctx && ctx.userId,
        huntId: ctx && ctx.huntId,
        kind: 'bedrock',
        model: cfg.model,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
      });
    }
  });
  const blocks = (out.output && out.output.message && out.output.message.content) || [];
  return blocks.map((b) => b.text || '').join('').trim() || null;
}

/**
 * OpenRouter — OpenAI-compatible API for fast GPU inference.
 * Uses free-tier uncensored models by default ($0). Set OPENROUTER_MODEL
 * to override. API key from OPENROUTER_API_KEY env.
 */
async function chatWithOpenRouter(messages, system, ctx) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log.error('[llm] OpenRouter API key not configured (OPENROUTER_API_KEY)');
    return null;
  }
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  const clean = (t) => sanitizeForModel(String(t || ''));
  const orMessages = [];
  if (system) orMessages.push({ role: 'system', content: clean(system).slice(0, 8000) });
  for (const m of messages || []) {
    orMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m.text).slice(0, 8000),
    });
  }
  try {
    log.info('[llm] OpenRouter calling model:', model);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hack.thebhavesh.online',
        'X-Title': 'Dark Matter Hunt AI',
      },
      body: JSON.stringify({
        model,
        messages: orMessages,
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (res.status === 429) {
      // Rate limited — wait and retry once
      const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
      log.info(`[llm] OpenRouter rate limited, waiting ${retryAfter}s...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      // Retry once
      const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://hack.thebhavesh.online',
          'X-Title': 'Dark Matter Hunt AI',
        },
        body: JSON.stringify({
          model,
          messages: orMessages,
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!retryRes.ok) {
        log.error(`[llm] OpenRouter retry HTTP ${retryRes.status}`);
        return null;
      }
      const retryData = await retryRes.json();
      const retryText = retryData.choices && retryData.choices[0] && retryData.choices[0].message
        ? retryData.choices[0].message.content : null;
      return (retryText || '').trim() || null;
    }
    if (!res.ok) {
      log.error(`[llm] OpenRouter HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    return (text || '').trim() || null;
  } catch (err) {
    log.error('[llm] OpenRouter error:', err.message);
    return null;
  }
}

export async function chatWithAI(messages, system, ctx, opts = {}) {
  // Per-hunt provider override (1 Nov 2026): allows a hunt to use a specific
  // API provider without changing the global LLM_PROVIDER env var.
  // Used by brainProvider.callBrain for OpenRouter-selected hunts.
  const provider = (opts.providerOverride || PROVIDER).toLowerCase();
  if (provider === 'ollama') return chatWithOllama(messages, system, ctx, opts);
  if (provider === 'sagemaker') return chatWithSageMaker(messages, system, ctx);
  if (provider === 'openrouter') return chatWithOpenRouter(messages, system, ctx);
  if (provider === 'kaggle') return chatWithKaggle(messages, system, ctx);
  return chatWithBedrock(messages, system, ctx);
}

/**
 * Kaggle GPU — Gradio interface to uncensored Dolphin model on free Kaggle GPU.
 * Set KAGGLE_GRADIO_URL to the public Gradio share URL (e.g. https://xxx.gradio.live).
 * No rate limits, no censorship, $0.
 */
async function chatWithKaggle(messages, system, ctx) {
  const baseUrl = (process.env.KAGGLE_GRADIO_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    log.error('[llm] Kaggle Gradio URL not configured (KAGGLE_GRADIO_URL)');
    return null;
  }
  const clean = (t) => sanitizeForModel(String(t || ''));
  const gradioMessages = (messages || []).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: clean(m.text).slice(0, 8000),
  }));
  try {
    const res = await fetch(`${baseUrl}/gradio_api/call/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [gradioMessages, clean(system || '').slice(0, 8000)] }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      log.error(`[llm] Kaggle submit HTTP ${res.status}`);
      return null;
    }
    const { event_id } = await res.json();
    // Poll the event stream for the result (Gradio 4/5 SSE format)
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, KAGGLE_POLL_MS));
      const r2 = await fetch(`${baseUrl}/gradio_api/call/chat/${event_id}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!r2.ok) continue;
      const text = await r2.text();
      // Look for: event: complete\ndata: ["..."]
      const m = text.match(/data:\s*(\[.*\])/s);
      if (m) {
        try {
          const arr = JSON.parse(m[1]);
          if (arr && arr[0]) return String(arr[0]).slice(0, 8000).trim() || null;
        } catch { /* keep polling */ }
      }
      if (/event:\s*complete/.test(text) && !m) return null;
    }
    log.error('[llm] Kaggle poll timed out');
    return null;
  } catch (err) {
    log.error('[llm] Kaggle error:', err.message);
    return null;
  }
}

/**
 * SageMaker async inference — for 32B+ models that don't fit on EC2.
 * Uses async inference (scales to zero, pay-per-use).
 * 
 * Flow:
 * 1. InvokeEndpointAsync → returns output S3 location
 * 2. Poll GetAsyncInferenceResult until complete
 * 3. Parse response
 */
async function chatWithSageMaker(messages, system, ctx) {
  if (!SAGEMAKER_ENDPOINT) {
    log.error('[llm] SageMaker endpoint not configured (SAGEMAKER_ENDPOINT_NAME)');
    return null;
  }

  // Lazy-load SageMaker SDK (may not export async APIs in all versions)
  let SageMakerRuntimeClient, InvokeEndpointCommand;
  try {
    const pkg = await import('@aws-sdk/client-sagemaker-runtime');
    // Handle both ESM named exports and CJS default export
    const mod = pkg.default || pkg;
    SageMakerRuntimeClient = mod.SageMakerRuntimeClient || pkg.SageMakerRuntimeClient;
    InvokeEndpointCommand = mod.InvokeEndpointCommand || pkg.InvokeEndpointCommand;
    if (!SageMakerRuntimeClient || !InvokeEndpointCommand) {
      throw new Error('SageMaker SDK exports not found');
    }
  } catch (err) {
    log.error('[llm] SageMaker SDK load failed:', err.message);
    return null;
  }

  const clean = (t) => sanitizeForModel(String(t || ''));
  
  // Build prompt in ChatML format for Qwen models
  let prompt = '';
  if (system) prompt += `<|im_start|>system\n${clean(system).slice(0, 8000)}<|im_end|>\n`;
  for (const m of messages || []) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    prompt += `<|im_start|>${role}\n${clean(m.text).slice(0, 8000)}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';

  const client = new SageMakerRuntimeClient({
    region: SAGEMAKER_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  try {
    const payload = JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      },
    });

    // Use InvokeEndpoint (sync) — simpler and works with standard endpoints
    const syncCmd = new InvokeEndpointCommand({
      EndpointName: SAGEMAKER_ENDPOINT,
      ContentType: 'application/json',
      Body: Buffer.from(payload),
    });

    const response = await client.send(syncCmd);
    const responseBody = await response.Body.transformToString();
    const data = JSON.parse(responseBody);
    
    // HuggingFace TGI format: [{generated_text: "..."}] or {generated_text: "..."}
    let text = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text;
    } else if (data.generated_text) {
      text = data.generated_text;
    } else if (typeof data === 'string') {
      text = data;
    }

    text = text.trim();
    if (!text) return null;

    // Record cost (SageMaker 32B ~$0.50/hour pro-rated per request)
    recordCostSafe(() => {
      recordCost({
        userId: ctx && ctx.userId,
        huntId: ctx && ctx.huntId,
        kind: 'sagemaker',
        model: SAGEMAKER_ENDPOINT,
        inputTokens: 0, // Async doesn't return token counts reliably
        outputTokens: 0,
        amountUsd: 0.01, // Estimated per-request cost
        note: 'sagemaker-async',
      });
    });

    return text;
  } catch (err) {
    log.error(`[llm] SageMaker failed: ${err.message}`);
    return null;
  }
}
