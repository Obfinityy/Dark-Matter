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

// HYPOTHESIS LEDGER (19 Oct 2026, solver #127 — XBOW playbook: failure-pivot
// rule + variant-analysis pass, user-ordered 18:32 IST).
//
// ROOT CAUSE (live evidence, h_bench_d69e5746, 109 reasoning rows):
//   - "Login endpoint may be vulnerable to SQL injection" → VERIFIED 33x.
//     The model re-proposes the SAME solved bug every few iterations instead
//     of moving on; each re-verification burns a full 10–15 min iteration
//     and mints a duplicate finding.
//   - Three more hypotheses failed 18–20x EACH with zero verifications
//     ("JWT from SQLi may grant admin privileges", "Authenticated endpoints
//     may lack object-level authorization", "Login may use NoSQL backend
//     vulnerable to operator injection") — 58 dead rows, the model never pivots.
// The last-5-rows soft history ("learn from your past thinking") demonstrably
// does not stop this: the model reads "VERIFIED" as encouragement to repeat
// and treats each dead retry as a fresh idea. The ledger is a HARD ban list
// computed over ALL rows: verified hypotheses are closed for same-instance
// re-testing (variant sweeps of the class on OTHER endpoints are the only
// allowed continuation — the XBOW variant-analysis pass), and hypotheses
// that failed FAIL_DEATH_TOLL times with no verification are retired with a
// forced-pivot row logged to reasoning.jsonl (the XBOW failure-pivot rule).
// Prompt-level steering only — no validator, gate, or execution path changes.
export const FAIL_DEATH_TOLL = 5;

function normHypothesis(h) {
  return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function readAllReasoning(huntId) {
  try {
    const content = fs.readFileSync(reasoningFile(huntId), 'utf8');
    return content.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/**
 * Compute the hypothesis ledger: which hypotheses are VERIFIED (closed for
 * same-instance re-testing) and which are DEAD (failed FAIL_DEATH_TOLL+ times
 * with zero verifications — forced pivot). Retirement bookkeeping rows
 * (action 'hypothesis-retirement') are excluded so the ledger can't feed
 * back into itself.
 */
export function getHypothesisLedger(huntId) {
  const rows = readAllReasoning(huntId);
  const byHyp = new Map();
  for (const r of rows) {
    if (r.action === 'hypothesis-retirement') continue;
    const key = normHypothesis(r.hypothesis);
    if (!key) continue;
    if (!byHyp.has(key)) {
      byHyp.set(key, { text: String(r.hypothesis).slice(0, 140), verified: 0, failed: 0, titles: [] });
    }
    const e = byHyp.get(key);
    const res = String(r.result || '');
    if (res.startsWith('VERIFIED')) {
      e.verified++;
      const t = res.replace(/^VERIFIED:\s*/, '').slice(0, 90);
      if (t && !e.titles.includes(t)) e.titles.push(t);
    } else if (/no assessment|not verified/i.test(res)) {
      e.failed++;
    }
  }
  const verified = [];
  const dead = [];
  for (const e of byHyp.values()) {
    if (e.verified > 0) verified.push(e);
    else if (e.failed >= FAIL_DEATH_TOLL) dead.push(e);
  }
  // Most-burned first — the model should see its worst loops at the top.
  verified.sort((a, b) => b.verified - a.verified);
  dead.sort((a, b) => b.failed - a.failed);
  return { verified, dead };
}

/**
 * Format the ledger as a binding prompt section. Also logs a forced-pivot
 * row to reasoning.jsonl for each newly-retired hypothesis (once each —
 * the RETIRED marker in the result makes it idempotent).
 */
export function formatLedgerForPrompt(huntId) {
  const { verified, dead } = getHypothesisLedger(huntId);
  if (!verified.length && !dead.length) return '';

  // Failure-pivot rule: log the forced hypothesis change. Idempotent — a
  // hypothesis already carrying a RETIRED marker is never logged twice.
  try {
    const content = fs.readFileSync(reasoningFile(huntId), 'utf8');
    for (const d of dead) {
      if (!content.includes(`RETIRED: ${d.text}`)) {
        recordReasoning(huntId, {
          hypothesis: d.text,
          action: 'hypothesis-retirement',
          why: `Failed ${d.failed}x with zero verifications — the premise is exhausted, not the payload.`,
          result: `RETIRED: ${d.text} — forced pivot to a new hypothesis`,
          learned: 'Do not re-test this premise. A dead premise retried is a burned iteration.',
          followUp: 'Propose a genuinely NEW hypothesis, or variant-sweep a VERIFIED class on untested endpoints.',
        });
      }
    }
  } catch { /* ledger logging is best-effort, never break the hunt */ }

  let s = '\n--- HYPOTHESIS LEDGER (binding — your notebook of closed leads) ---\n' +
    'These hypotheses are CLOSED. Re-proposing them wastes the hunt — an elite hunter never re-tests a closed lead.\n';
  if (verified.length) {
    s += 'VERIFIED — the bug is real and recorded. Do NOT re-test the same instance. ' +
      'To pursue this CLASS further, sweep OTHER endpoints/parameters for the same weakness ' +
      '(variant analysis across the app), never the same target twice:\n';
    for (const v of verified.slice(0, 6)) {
      s += `  - "${v.text}" → ${v.titles.join('; ') || 'verified'} (verified ${v.verified}x)\n`;
    }
  }
  if (dead.length) {
    s += `DEAD — failed ${FAIL_DEATH_TOLL}+ times with nothing to show. The PREMISE is wrong, not the payload. ` +
      'Do NOT retry these premises; pivot to a genuinely NEW hypothesis:\n';
    for (const d of dead.slice(0, 8)) {
      s += `  - "${d.text}" (failed ${d.failed}x)\n`;
    }
  }
  return s;
}
