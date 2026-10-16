// Dark Matter backend — LLM client for real AI chat (not hardcoded).
//
// The mid-hunt chat must THINK, not recite canned responses. This module
// provides a real LLM backend. The provider is chosen by LLM_PROVIDER:
//
//   LLM_PROVIDER=bedrock (default) — AWS Bedrock (credentials from env).
//   LLM_PROVIDER=ollama            — self-hosted Ollama on the same box,
//                                    e.g. dolphin-mistral:7b (uncensored).
//                                    $0 marginal token cost; the box itself
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
// NOTE: SageMaker SDK is imported LAZILY (dynamic import) only when
// LLM_PROVIDER=sagemaker, because the installed SDK version may not export
// the async APIs as named ESM exports. A static import here crashes the
// entire backend on startup if the exports don't exist.
import { recordCost } from './costTracker.js';

const PROVIDER = String(process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

const DEFAULT_MODEL = process.env.BEDROCK_MODEL || 'meta.llama3-1-70b-instruct-v1:0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';

const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin-mistral:7b';

// SageMaker async inference — for 32B+ models. Endpoint scales to zero;
// each invocation is pay-per-use (~$4-5 per 3-hour hunt on 32B).
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT_NAME || '';
const SAGEMAKER_REGION = process.env.SAGEMAKER_REGION || process.env.AWS_REGION || 'us-east-1';

// ---- Privacy gateway --------------------------------------------------------
// Strip secrets, tokens, and PII before anything reaches the model.
// Technique: Dark-Moon (technique only, no code copied).

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI-style keys
  /ghp_[a-zA-Z0-9]{20,}/g,                   // GitHub tokens
  /xox[baprs]-[a-zA-Z0-9-]+/g,               // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                       // AWS access keys
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,        // Bearer tokens
  /password\s*[:=]\s*\S+/gi,                 // password assignments
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
];

export function sanitizeForModel(text) {
  let out = String(text || '');
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

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
  return getBedrockConfig() !== null;
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
  try {
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
  } catch { /* cost tracking must never break chat */ }
  const blocks = (out.output && out.output.message && out.output.message.content) || [];
  return blocks.map((b) => b.text || '').join('').trim() || null;
}

async function chatWithOllama(messages, system, ctx) {
  // Privacy gateway: strip secrets/PII before the model — same as Bedrock.
  const clean = (t) => sanitizeForModel(String(t || ''));
  const ollamaMessages = [];
  if (system) ollamaMessages.push({ role: 'system', content: clean(system).slice(0, 8000) });
  for (const m of messages || []) {
    ollamaMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m.text).slice(0, 8000),
    });
  }
  let res;
  try {
    // Defensive: never hang forever if the model stalls — fail cleanly so
    // callers fall back to deterministic replies instead of hanging the
    // request (and the reverse proxy in front of us).
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
        // Tuned for 2vCPU EC2: smaller context + fewer tokens = faster.
        // num_ctx caps KV cache to avoid OOM; num_predict keeps plans short.
        options: {
          num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT || '600', 10),
          num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
          temperature: 0.7,
        },
      }),
      // 2vCPU is slow: 150s per attempt, with one retry below.
      signal: AbortSignal.timeout(parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10)),
    });
  } catch (err) {
    console.error(`[llm] Ollama attempt 1 failed at ${OLLAMA_URL}: ${err.message}`);
    // One retry — transient stalls are common on 2vCPU.
    try {
      res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          stream: false,
          options: {
            num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT || '600', 10),
            num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10)),
      });
    } catch (err2) {
      console.error(`[llm] Ollama unreachable at ${OLLAMA_URL} after retry: ${err2.message}`);
      return null;
    }
  }
  if (!res.ok) {
    console.error(`[llm] Ollama HTTP ${res.status} for model ${OLLAMA_MODEL}`);
    return null;
  }
  const data = await res.json();
  const text = (data.message && data.message.content ? String(data.message.content) : '').trim();
  // Self-hosted = $0 marginal cost; still ledger the burn event for the UI.
  try {
    recordCost({
      userId: ctx && ctx.userId,
      huntId: ctx && ctx.huntId,
      kind: 'ollama',
      model: OLLAMA_MODEL,
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
      amountUsd: 0,
      note: 'self-hosted',
    });
  } catch { /* cost tracking must never break chat */ }
  return text || null;
}

/**
 * Chat with the real AI.
 * @param {Array<{role:'user'|'assistant', text:string}>} messages
 * @param {string} system — system prompt (hunt context goes here)
 * @param {{userId?: string, huntId?: string}} ctx — for cost tracking
 * @returns {Promise<string|null>} reply text, or null if no AI is configured.
 */
/**
 * OpenRouter — OpenAI-compatible API for fast GPU inference.
 * Uses free-tier uncensored models by default ($0). Set OPENROUTER_MODEL
 * to override. API key from OPENROUTER_API_KEY env.
 */
async function chatWithOpenRouter(messages, system, ctx) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[llm] OpenRouter API key not configured (OPENROUTER_API_KEY)');
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
    if (!res.ok) {
      console.error(`[llm] OpenRouter HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    return (text || '').trim() || null;
  } catch (err) {
    console.error('[llm] OpenRouter error:', err.message);
    return null;
  }
}

export async function chatWithAI(messages, system, ctx) {
  if (PROVIDER === 'ollama') return chatWithOllama(messages, system, ctx);
  if (PROVIDER === 'sagemaker') return chatWithSageMaker(messages, system, ctx);
  if (PROVIDER === 'openrouter') return chatWithOpenRouter(messages, system, ctx);
  return chatWithBedrock(messages, system, ctx);
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
    console.error('[llm] SageMaker endpoint not configured (SAGEMAKER_ENDPOINT_NAME)');
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
    console.error('[llm] SageMaker SDK load failed:', err.message);
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
    try {
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
    } catch { /* cost tracking must never break chat */ }

    return text;
  } catch (err) {
    console.error(`[llm] SageMaker failed: ${err.message}`);
    return null;
  }
}
