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
//
// When the configured provider is unavailable, chatWithAI returns null and
// the caller falls back to deterministic steering (pause/resume/stop) plus
// an honest notice.
//
// Steering commands (pause/resume/stop) STAY rule-based in chat.js —
// deterministic control must never depend on an LLM's mood.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { recordCost } from './costTracker.js';

const PROVIDER = String(process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

const DEFAULT_MODEL = process.env.BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';

const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin-mistral:7b';

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
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
        options: { num_predict: 1500, temperature: 0.7 },
      }),
    });
  } catch (err) {
    console.error(`[llm] Ollama unreachable at ${OLLAMA_URL}: ${err.message}`);
    return null;
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
export async function chatWithAI(messages, system, ctx) {
  if (PROVIDER === 'ollama') return chatWithOllama(messages, system, ctx);
  return chatWithBedrock(messages, system, ctx);
}
