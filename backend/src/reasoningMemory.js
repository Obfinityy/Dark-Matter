// Dark Matter — Reasoning Memory.
// Saves WHY decisions were made, not just WHAT was found.
//
// A human hacker remembers:
//   "I tried SQLi on the login form BECAUSE the error message looked like
//    a database error, and it FAILED because the input was sanitized, so
//    I moved to testing the search parameter instead."
//
// This module stores reasoning chains so the AI can learn from its own
// thought process across iterations and hunts.

import fs from 'fs';
import path from 'path';
import { dataDir } from './store.js';

function reasoningFile(huntId) {
  return path.join(dataDir(), 'hunts', huntId, 'reasoning.jsonl');
}

/**
 * Record a reasoning step: what was tried, why, what happened, what was learned.
 */
export function recordReasoning(huntId, entry) {
  const record = {
    at: new Date().toISOString(),
    hypothesis: entry.hypothesis || '',
    action: entry.action || '',
    why: entry.why || '',
    result: entry.result || '',
    learned: entry.learned || '',
    followUp: entry.followUp || '',
  };
  try {
    fs.appendFileSync(reasoningFile(huntId), JSON.stringify(record) + '\n');
  } catch { /* best-effort */ }
}

/**
 * Get recent reasoning chains for the AI to learn from.
 */
export function getReasoningHistory(huntId, limit = 10) {
  try {
    const content = fs.readFileSync(reasoningFile(huntId), 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/**
 * Format reasoning history for the AI prompt.
 */
export function formatReasoningForPrompt(huntId) {
  const history = getReasoningHistory(huntId, 5);
  if (history.length === 0) return '';

  return `\n--- YOUR REASONING HISTORY (learn from your past thinking) ---\n` +
    history.map((r, i) =>
      `${i + 1}. Tried: ${r.action}\n   Why: ${r.why}\n   Result: ${r.result}\n   Learned: ${r.learned}` +
      (r.followUp ? `\n   Follow-up: ${r.followUp}` : '')
    ).join('\n');
}
