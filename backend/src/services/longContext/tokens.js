/**
 * Token estimation utilities.
 *
 * The phone-hosted Gemma exposes no tokenizer over HTTP, so every token count
 * in the long-context engine is an *estimate*. Estimates are deliberately
 * conservative (they err on the side of "this text is bigger than you think")
 * so the ContextBudgetManager never overfills the real model window.
 *
 * English prose averages ~4 chars/token; code and JSON are denser (~3.1).
 * We take the pessimistic blend and add a safety margin.
 */

const CHARS_PER_TOKEN_PLAIN = 4;
const CHARS_PER_TOKEN_DENSE = 3.1;
const DENSE_THRESHOLD = 0.35; // ratio of dense chars above which we treat text as code-like

function looksDense(text) {
  if (!text) return false;
  const sample = text.length > 4000 ? text.slice(0, 4000) : text;
  let dense = 0;
  for (const ch of sample) {
    if (ch === ' ' || ch === '\n' || ch === '\t') continue;
    if (/[A-Za-z]/.test(ch)) continue;
    dense += 1;
  }
  return dense / sample.length >= DENSE_THRESHOLD;
}

/**
 * Estimate the token count of a piece of text.
 * @param {string} text
 * @returns {number} conservative token estimate (>= 1 for non-empty text)
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const chars = text.length;
  const perToken = looksDense(text) ? CHARS_PER_TOKEN_DENSE : CHARS_PER_TOKEN_PLAIN;
  // 8% safety margin on top of the pessimistic chars-per-token ratio.
  return Math.max(1, Math.ceil((chars / perToken) * 1.08));
}

/**
 * Estimate tokens for a chat message (content plus role/format overhead).
 * @param {{ role: string, content: string }} message
 */
export function estimateMessageTokens(message) {
  if (!message) return 0;
  // ~4 tokens of chat-template overhead per message (role markers etc).
  return estimateTokens(message.content) + 4;
}

/**
 * Estimate tokens for a list of messages.
 * @param {Array<{ role: string, content: string }>} messages
 */
export function estimateMessagesTokens(messages = []) {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

/** Default model context window (tokens). Overridable via env. */
export function modelContextCapacity() {
  const raw = parseInt(process.env.PHONE_AI_CONTEXT_TOKENS || '4096', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 4096;
}

/** Tokens reserved for the model's *output* on a normal chat turn. */
export function reservedOutputTokens() {
  const raw = parseInt(process.env.LONG_CONTEXT_OUTPUT_RESERVE || '768', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 768;
}

/**
 * Hard character ceiling applied defensively to any retrieved block before it
 * enters a prompt. Retrieved content is additionally budgeted in tokens by the
 * ContextBudgetManager — this is only a last-resort guard against a corrupted
 * chunk record inflating a prompt.
 */
export function clampBlock(text, maxChars) {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
