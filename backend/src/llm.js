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
import { decryptSecret } from './crypto.js';
import { readPluginKeys } from './store.js';

const DEFAULT_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const DEFAULT_REGION = 'us-east-1';

function getAwsConfig() {
  try {
    const stored = readPluginKeys();
    const rec = stored && stored.aws;
    if (!rec || !rec.encrypted) return null;
    const raw = decryptSecret(rec.encrypted);
    const creds = JSON.parse(raw);
    const region =
      (rec.meta && rec.meta.extra && rec.meta.extra.region) || DEFAULT_REGION;
    if (!creds.accessKeyId || !creds.secretAccessKey) return null;
    return {
      region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
      model: (rec.meta && rec.meta.model) || DEFAULT_MODEL,
    };
  } catch {
    return null;
  }
}

/** True when a real AI backend is available for chat. */
export function aiAvailable() {
  return getAwsConfig() !== null;
}

/**
 * Chat with the real AI.
 * @param {Array<{role:'user'|'assistant', text:string}>} messages
 * @param {string} system — system prompt (hunt context goes here)
 * @returns {Promise<string|null>} reply text, or null if no AI is configured.
 */
export async function chatWithAI(messages, system) {
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
  const blocks = (out.output && out.output.message && out.output.message.content) || [];
  return blocks.map((b) => b.text || '').join('').trim() || null;
}
