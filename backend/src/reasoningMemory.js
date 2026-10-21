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
 * Parse raw reasoning.jsonl text into row objects, TOLERANTLY (Lane H,
 * 21 Oct 2026 — live root cause: on hunt h_07c2709955d3 one torn line —
 * two JSON objects concatenated on a single line — made the old
 * all-or-nothing `.map(JSON.parse)` throw, its catch returned [], and the
 * brain's briefing read "ACTIONS YOU HAVE TAKEN (0 total)" despite 541
 * valid rows on disk). Mirrors the per-line pattern of store.js
 * readHuntEvents: every line is parsed independently; blank and
 * unparseable lines are skipped, never fatal. File order is preserved.
 *
 * Torn-line recovery (conservative, deterministic): if a line fails
 * JSON.parse, we attempt ONE recovery — the exact shape seen live, two or
 * more complete objects concatenated with no separator ("}{" boundary; a
 * "}\n{" split is already handled by the line split itself). The line is
 * split on "}{", braces are restored, and the pieces are accepted ONLY if
 * every piece parses as a plain object; any doubt (a piece fails, a piece
 * is not an object) discards the WHOLE line — partial recovery is never
 * emitted, so a "}{" inside a string value can at worst lose that one
 * line, never invent rows. If recovery is unsafe the line is skipped like
 * any other torn line.
 */
export function parseReasoningText(text) {
  const rows = [];
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) rows.push(parsed);
      continue;
    } catch { /* fall through to torn-line recovery */ }
    const recovered = recoverConcatenatedObjects(line);
    if (recovered) rows.push(...recovered);
  }
  return rows;
}

function recoverConcatenatedObjects(line) {
  if (!line.startsWith('{') || !line.endsWith('}')) return null;
  const parts = line.split('}{');
  if (parts.length < 2) return null;
  const objs = [];
  for (let i = 0; i < parts.length; i++) {
    const piece = (i > 0 ? '{' : '') + parts[i] + (i < parts.length - 1 ? '}' : '');
    try {
      const parsed = JSON.parse(piece);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      objs.push(parsed);
    } catch {
      return null;
    }
  }
  return objs;
}

/**
 * Get recent reasoning chains for the AI to learn from.
 * Returns the last `limit` VALID rows — torn lines are skipped first, so
 * they can no longer hide the rows around them.
 */
export function getReasoningHistory(huntId, limit = 10) {
  try {
    const content = fs.readFileSync(reasoningFile(huntId), 'utf8');
    return parseReasoningText(content).slice(-limit);
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

export function normalizeHypothesis(h) {
  return String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function readAllReasoning(huntId) {
  try {
    const content = fs.readFileSync(reasoningFile(huntId), 'utf8');
    return parseReasoningText(content);
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
    const key = normalizeHypothesis(r.hypothesis);
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
 * Verified-instance pairs (19 Oct 2026, elite-gap cycle): the set of
 * normalized (hypothesis || test) pairs this hunt has ALREADY verified.
 * assessResult sets rec.title to plan.test (huntAgent.js:1558), and
 * recordReasoning stores the plan's test string in r.action — so a
 * model-authored re-test of the same instance produces a pair-match that
 * is exact after normalization. Used by the execution-level filter in
 * agentIteration to stop same-instance re-verification at the plans level
 * (the prompt ban does not bind the 8B: the verified login bug re-proved
 * itself 3x in the 14 min after the e5ef526 ledger deployed). detId-tagged
 * probes are exempted at the call site; chain-pursuit plans carry different
 * test strings, so neither is affected.
 */
export function getVerifiedPairs(huntId) {
  const pairs = new Set();
  for (const r of readAllReasoning(huntId)) {
    if (r.action === 'hypothesis-retirement') continue;
    if (!String(r.result || '').startsWith('VERIFIED')) continue;
    const key = normalizeHypothesis(r.hypothesis) + '||' + normalizeHypothesis(r.action);
    if (key !== '||') pairs.add(key);
  }
  return pairs;
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

// ---------------------------------------------------------------------------
// FULL-HISTORY LEDGER + RECALL (20 Oct 2026, solver #443 — owner order:
// "make him like a human — he knows everything he did before").
//
// Until now the planning prompt carried only the last 5 reasoning rows in
// full prose plus the hypothesis ledger's ban list. The complete record sat
// on disk but never reached his thinking. These builders fix that:
//   - buildFullHistoryLedger: the COMPLETE ledger of the hunt — every
//     finding (never dropped), captured artifacts, dead ends, and ONE line
//     per executed action. Compression is per-line brevity; only when the
//     action lines outgrow the budget are the OLDEST summarised into
//     counts-by-outcome (findings and verified results are never summarised
//     away).
//   - searchRecall: the human part — he does not hold every raw line in
//     working memory, he RETRIEVES detail on demand. RECALL:<query> searches
//     this hunt's events + reasoning and the global-memory store.
// Both are pure functions over plain arrays so they can be driver-tested
// without a live hunt (backend/scripts/test-full-history.mjs).

/** All reasoning rows for a hunt (unbounded — the full notebook). */
export function getAllReasoning(huntId) {
  return readAllReasoning(huntId);
}

function reasoningOutcome(r) {
  const res = String((r && r.result) || '');
  if (res.startsWith('VERIFIED')) return 'VERIFIED';
  if (/^RETIRED/.test(res)) return 'PIVOT';
  if (/no assessment|not verified/i.test(res)) return 'FAILED';
  return 'DONE';
}

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/**
 * Build the full-history prompt section.
 * @param {{reasoningRows: object[], findings: object[], chainContext: ?object, budgetChars: number}} input
 *   findings: finding events ({title, severity, verified, verification}).
 *   budgetChars governs the ACTIONS list only — findings, artifacts and
 *   dead ends always render in full (the caller's hard prompt cap remains
 *   the outer bound).
 * @returns {{text: string, stats: {actions:number, shown:number, summarised:number, findings:number, verified:number, deadEnds:number}}}
 */
export function buildFullHistoryLedger({ reasoningRows = [], findings = [], chainContext = null, budgetChars = 12000 } = {}) {
  const rows = (reasoningRows || []).filter((r) => r && r.action !== 'hypothesis-retirement');
  const verifiedFindings = (findings || []).filter((f) => f && f.verified);
  const otherFindings = (findings || []).filter((f) => f && !f.verified);

  // Dead ends: same rule as the hypothesis ledger (failed >= toll, never verified).
  const byHyp = new Map();
  for (const r of rows) {
    const key = normalizeHypothesis(r.hypothesis);
    if (!key) continue;
    if (!byHyp.has(key)) byHyp.set(key, { text: clip(r.hypothesis, 100), verified: 0, failed: 0 });
    const e = byHyp.get(key);
    const o = reasoningOutcome(r);
    if (o === 'VERIFIED') e.verified++;
    else if (o === 'FAILED') e.failed++;
  }
  const dead = [...byHyp.values()].filter((e) => e.verified === 0 && e.failed >= FAIL_DEATH_TOLL);
  dead.sort((a, b) => b.failed - a.failed);

  const fixed = [];
  fixed.push('\n--- FULL HISTORY — EVERYTHING YOU HAVE DONE THIS HUNT (your complete notebook) ---');
  fixed.push(`FINDINGS SO FAR (${findings.length} recorded, ${verifiedFindings.length} verified):`);
  if (!findings.length) fixed.push('  (none yet)');
  // Exact-duplicate finding records (the same instance re-proven many
  // times) collapse into ONE line with a ×N count — lossless: no distinct
  // finding is ever dropped, and the full instance list stays on disk and
  // reachable via RECALL. Without this, 100+ identical re-proof lines
  // crowd out the rest of the notebook.
  const dedupeFindings = (list) => {
    const seen = new Map();
    for (const f of list) {
      const key = `${clip(f.title, 90)}|${f.severity || 'medium'}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [...seen.entries()].map(([key, n]) => {
      const [title, sev] = key.split('|');
      return { title, sev, n };
    });
  };
  for (const d of dedupeFindings(verifiedFindings)) fixed.push(`  - [VERIFIED] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  for (const d of dedupeFindings(otherFindings)) fixed.push(`  - [unverified] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  if (chainContext && chainContext.artifacts && Object.keys(chainContext.artifacts).length) {
    const arts = Object.entries(chainContext.artifacts).map(([k, v]) => `${k}=${clip(v, 48)}`).join('; ');
    fixed.push(`CAPTURED ARTIFACTS: ${arts}${chainContext.chainPath ? ` | chain in progress: ${chainContext.chainPath.join(' → ')}` : ''} (from: ${clip(chainContext.fromFinding, 60)})`);
  }
  if (dead.length) {
    fixed.push(`DEAD ENDS (premises exhausted — do not retry): ${dead.map((d) => `"${d.text}" ×${d.failed}`).join('; ')}`);
  }

  // Action lines: one per executed action, chronological. Fill the budget
  // with the NEWEST lines; summarise the oldest overflow by outcome.
  const actionLines = rows.map((r, i) => {
    const o = reasoningOutcome(r);
    return { i, line: `  ${i + 1}. [${o}] ${clip(r.action, 70)} — ${clip(r.result, 85)}` };
  });
  const fixedLen = fixed.join('\n').length;
  let avail = Math.max(0, budgetChars - fixedLen);
  const shown = [];
  for (let k = actionLines.length - 1; k >= 0; k--) {
    const cost = actionLines[k].line.length + 1;
    if (cost > avail && shown.length > 0) break;
    if (cost > avail && shown.length === 0) { shown.unshift(actionLines[k]); avail = 0; break; }
    shown.unshift(actionLines[k]);
    avail -= cost;
  }
  const summarised = actionLines.length - shown.length;
  const parts = [...fixed];
  parts.push(`ACTIONS YOU HAVE TAKEN (${rows.length} total${summarised ? `, oldest ${summarised} summarised below` : ''}):`);
  if (summarised > 0) {
    const counts = { VERIFIED: 0, FAILED: 0, DONE: 0, PIVOT: 0 };
    for (const a of actionLines.slice(0, summarised)) counts[reasoningOutcome(rows[a.i])]++;
    parts.push(`  … ${summarised} earliest actions summarised: ${counts.VERIFIED} verified, ${counts.FAILED} failed, ${counts.DONE} done, ${counts.PIVOT} pivots. (Full detail on disk — RECALL it if you need it.)`);
  }
  for (const s of shown) parts.push(s.line);

  return {
    text: parts.join('\n'),
    stats: {
      actions: rows.length,
      shown: shown.length,
      summarised,
      findings: findings.length,
      verified: verifiedFindings.length,
      deadEnds: dead.length,
    },
  };
}

/**
 * RECALL search: keyword/technique/endpoint match over the hunt's own
 * records and the global-memory store.
 * @returns {{text: string, hits: number, shown: number}}
 */
export function searchRecall({ events = [], reasoningRows = [], globalMemories = [], query = '', limit = 8 } = {}) {
  const terms = [...new Set(String(query || '').toLowerCase().split(/[^a-z0-9_./-]+/).filter((t) => t.length >= 3))];
  if (!terms.length) return { text: `No searchable terms in recall query "${clip(query, 80)}".`, hits: 0, shown: 0 };
  const score = (hay) => {
    const h = String(hay || '').toLowerCase();
    let s = 0;
    for (const t of terms) if (h.includes(t)) s++;
    return s;
  };
  const hits = [];
  for (const e of events || []) {
    if (!e) continue;
    const ev = e.evidence || {};
    const hay = [e.type, e.title, e.class, e.verification, ev.request, ev.response, ev.poc_command, ev.poc_output, ev.impact_demo].join(' ');
    const s = score(hay);
    if (s > 0) hits.push({ s, line: `[hunt event · ${e.type}] ${clip(e.title || e.text || '', 90)}${e.verified ? ' [VERIFIED]' : ''} — ${clip(ev.response || ev.poc_output || e.verification || '', 200)}` });
  }
  for (const r of reasoningRows || []) {
    if (!r) continue;
    const hay = [r.hypothesis, r.action, r.why, r.result, r.learned].join(' ');
    const s = score(hay);
    if (s > 0) hits.push({ s, line: `[reasoning] ${clip(r.action, 80)} — result: ${clip(r.result, 130)}${r.learned ? ` — learned: ${clip(r.learned, 90)}` : ''}` });
  }
  for (const m of globalMemories || []) {
    if (!m) continue;
    const hay = [m.type, m.technique, m.appType, m.context, m.note, m.payload].join(' ');
    const s = score(hay);
    if (s > 0) hits.push({ s, line: `[global memory · ${m.type}/${m.technique}] ${clip(m.context || m.note, 150)} (${m.successes || 0}/${m.attempts || 0} succeeded)` });
  }
  hits.sort((a, b) => b.s - a.s);
  const top = hits.slice(0, limit);
  if (!top.length) return { text: `No past records match "${clip(query, 80)}".`, hits: 0, shown: 0 };
  return {
    text: `Recalled ${top.length} of ${hits.length} matching record(s) for "${clip(query, 80)}":\n` + top.map((h) => `- ${h.line}`).join('\n'),
    hits: hits.length,
    shown: top.length,
  };
}
