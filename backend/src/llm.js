// Dark Matter backend — LLM client for real AI chat (not hardcoded).
//
// The mid-hunt chat must THINK, not recite canned responses. This module
// provides a real LLM backend:
//
//   Priority 1: AWS Bedrock (credentials from Plugins → stored encrypted).
//   Priority 2: none yet — returns null and the caller falls back to
//               deterministic steering (pause/resume/stop) + honest notice.
//
// Steering commands (pause/resume/stop) STAY rule-based in chat.js —
// deterministic control must never depend on an LLM's mood.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { recordCost } from './costTracker.js';

const DEFAULT_MODEL = process.env.BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';

function getAwsConfig() {
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

/** True when a real AI backend is available for chat. */
export function aiAvailable() {
  return getAwsConfig() !== null;
}

/**
 * Chat with the real AI.
 * @param {Array<{role:'user'|'assistant', text:string}>} messages
 * @param {string} system — system prompt (hunt context goes here)
 * @param {{userId?: string, huntId?: string}} ctx — for cost tracking
 * @returns {Promise<string|null>} reply text, or null if no AI is configured.
 */
export async function chatWithAI(messages, system, ctx) {
  const cfg = getAwsConfig();
  if (!cfg) return null;
  const client = new BedrockRuntimeClient({
    region: cfg.region,
    credentials: cfg.credentials,
  });
  const cmd = new ConverseCommand({
    modelId: cfg.model,
    system: system ? [{ text: system }] : undefined,
    messages: (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: String(m.text || '').slice(0, 8000) }],
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
