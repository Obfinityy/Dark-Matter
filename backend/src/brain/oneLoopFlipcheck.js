// Dark Matter — RULE #52 (30 Oct 2026): BACKEND FLIP-CHECKLIST ROUTE.
//
// Rule #51 proved the flip checklist as parent-side Python
// (hidden_files/brain-flipcheck-v1.py). This module is the backend-native
// twin: pure, read-only, fail-closed evaluation of a one-loop session's
// memdir against the SAME 8-item checklist, so the owner can read the flip
// evidence in the admin portal (Rule #45 surface) instead of a local script.
//
// Wired in routes/admin.js as (admin-only):
//   GET /api/v1/admin/hunts/:id/oneloop/flip-checklist  -> READY/NOT-READY
//
// Checklist (each PASS/FAIL + evidence string):
//   S1 all_claims_accepted        every claim state == 'accepted' (real pipeline)
//   S2 no_filed_leftovers         no claim stuck in 'filed' (non-terminal)
//   S3 validations_terminal       every validation verdict terminal, count == claims
//   S4 no_half_turns              every turn line ok, count matches state.json turn
//   S5 zero_llm_zero_cost         llm_calls == 0 and spend_usd == 0.0 (fail-closed)
//   S6 evidence_hash_every_claim  Rule #37: every claim carries evidence_hash
//   S7 rule20_invariants          outputs saved by hash + titles/process present
//   S8 verifier_advisory_bounded  Rule #50: bound marker present in backend code
//
// Overall READY iff all 8 PASS. Missing/unreadable memdir -> fail-closed
// NOT-READY. Rehearsal evidence comes from <memdir>/rehearsal.json when a
// rehearsal driver records one there; absent -> S3 FAILS fail-closed (same
// posture as Rule #51). This module never writes, never mutates, never
// re-files, never flips anything. The flip decision stays with the owner.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oneLoopMemdir } from './oneLoopSession.js';
import { safeHuntId } from './oneLoopAudit.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Rule #50 marker: the bounded advisory wait lives in backend/src/llm.js. */
export const DEFAULT_ADVISORY_MARKER_FILE = path.resolve(HERE, '..', 'llm.js');
export const DEFAULT_ADVISORY_MARKER_STRING = 'OLLAMA_ADVISORY_TIMEOUT_MS';

/** Rehearsal evidence file inside a hunt's one-loop memdir (optional). */
export const REHEARSAL_FILE = 'rehearsal.json';

const TERMINAL_VERDICTS = new Set([
  'verified', 'accepted', 'rejected', 'gate-rejected', 'not-interesting',
]);

export const DECISION_NOTE =
  'Flip decision stays with the owner. This checklist is evidence only — no auto-flip.';

function item(name, passed, evidence) {
  return { name, result: passed ? 'PASS' : 'FAIL', evidence: String(evidence) };
}

function failClosed(reason) {
  return {
    ok: false,
    fail_closed: true,
    reason: String(reason),
    overall: 'NOT-READY',
    passed: 0,
    total: 0,
    items: [],
    decision_note: DECISION_NOTE,
  };
}

function readJsonFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ok: true, value: j };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}

/**
 * Run the 8-item flip checklist against a one-loop session memdir.
 * Pure read-only. opts: { rehearsal?: object|null,
 *   advisoryMarkerFile?: string, advisoryMarkerString?: string }.
 */
export function runFlipcheck(memdir, opts = {}) {
  const md = String(memdir || '');
  let st;
  try {
    st = fs.statSync(md);
  } catch {
    return failClosed('memdir missing or not a directory: ' + md);
  }
  if (!st.isDirectory()) return failClosed('memdir missing or not a directory: ' + md);

  const claimsR = readJsonFile(path.join(md, 'claims.json'));
  if (!claimsR.ok) return failClosed('claims.json unreadable: ' + claimsR.error);
  const claims = claimsR.value;
  if (!claims || typeof claims !== 'object' || Object.keys(claims).length === 0) {
    return failClosed('claims.json empty or wrong shape');
  }

  const states = Object.values(claims).map((c) =>
    (c && typeof c === 'object' ? String(c.state || '<none>') : '<none>'));
  const n = states.length;
  const items = [];

  // S1: all claims pipeline-accepted.
  const nAccepted = states.filter((s) => s === 'accepted').length;
  items.push(item('all_claims_accepted', nAccepted === n,
    `${nAccepted}/${n} claims state=accepted`));

  // S2: no filed leftovers (filed is non-terminal).
  const nFiled = states.filter((s) => s === 'filed').length;
  items.push(item('no_filed_leftovers', nFiled === 0,
    `${nFiled} claims still in 'filed' (non-terminal)`));

  // S3: validations terminal — from rehearsal evidence, fail-closed without it.
  const rehearsal = opts.rehearsal === undefined ? null : opts.rehearsal;
  if (rehearsal && typeof rehearsal === 'object') {
    const vals = Array.isArray(rehearsal.validations) ? rehearsal.validations : [];
    const allTerminal = vals.every((v) =>
      v && TERMINAL_VERDICTS.has(String(v.verdict || '').toLowerCase()));
    items.push(item('validations_terminal', vals.length === n && allTerminal,
      `${vals.length} validations for ${n} claims; terminal=${allTerminal}`));
  } else {
    items.push(item('validations_terminal', false,
      'no rehearsal evidence provided (fail-closed)'));
  }

  // S4: no half-turns — turns.log lines all ok, count == state.json turn.
  let turnCount = null;
  let badTurns = 0;
  try {
    const lines = String(fs.readFileSync(path.join(md, 'turns.log'), 'utf8'))
      .split('\n').filter((l) => l.trim());
    for (const line of lines) {
      let p;
      try { p = JSON.parse(line); } catch { badTurns++; continue; }
      if (p === null || typeof p !== 'object' || p.ok === false ||
          'error' in p || JSON.stringify(p).includes('traceback')) badTurns++;
    }
    const stateR = readJsonFile(path.join(md, 'state.json'));
    if (stateR.ok && stateR.value && typeof stateR.value === 'object' &&
        Number.isInteger(stateR.value.turn)) turnCount = stateR.value.turn;
    const countOk = turnCount === null || lines.length === turnCount;
    items.push(item('no_half_turns', badTurns === 0 && countOk,
      `${lines.length} turn lines, ${badTurns} bad; state.turn=${turnCount}`));
  } catch (err) {
    items.push(item('no_half_turns', false,
      `turns.log/state.json unreadable: ${(err && err.message) || err} (fail-closed)`));
  }

  // S5: zero LLM, zero cost — fail-closed on missing evidence.
  let ok5 = false;
  let ev5;
  try {
    const stateR = readJsonFile(path.join(md, 'state.json'));
    if (!stateR.ok) throw new Error('state.json unreadable: ' + stateR.error);
    const s = stateR.value || {};
    const llm = Object.prototype.hasOwnProperty.call(s, 'llm_calls') ? s.llm_calls : 'MISSING';
    const spend = Object.prototype.hasOwnProperty.call(s, 'spend_usd') ? s.spend_usd : 'MISSING';
    ok5 = llm === 0 && spend === 0.0;
    ev5 = `llm_calls=${llm} spend_usd=${spend}`;
  } catch (err) {
    ev5 = `no spend evidence: ${(err && err.message) || err} (fail-closed)`;
  }
  items.push(item('zero_llm_zero_cost', ok5, ev5));

  // S6: Rule #37 — evidence_hash on every claim.
  const noHash = Object.entries(claims)
    .filter(([, c]) => !(c && typeof c === 'object' && c.evidence_hash))
    .length;
  items.push(item('evidence_hash_every_claim', noHash === 0,
    `${n - noHash}/${n} claims carry evidence_hash`));

  // S7: Rule #20 invariants — outputs by hash + titles + process present.
  let hashOutputs = 0;
  try {
    const outdir = path.join(md, 'output');
    if (fs.statSync(outdir).isDirectory()) {
      hashOutputs = fs.readdirSync(outdir)
        .filter((f) => /^[0-9a-f]{64}(\..*)?$/.test(f)).length;
    }
  } catch { /* absent -> 0 */ }
  const titlesOk = fs.existsSync(path.join(md, 'titles.json'));
  const procOk = fs.existsSync(path.join(md, 'process.json'));
  items.push(item('rule20_invariants', hashOutputs > 0 && titlesOk && procOk,
    `hash-named outputs=${hashOutputs} titles.json=${titlesOk} process.json=${procOk}`));

  // S8: Rule #50 — advisory bound marker present in backend code.
  const markerFile = String(opts.advisoryMarkerFile || DEFAULT_ADVISORY_MARKER_FILE);
  const markerString = String(opts.advisoryMarkerString || DEFAULT_ADVISORY_MARKER_STRING);
  let ok8 = false;
  let ev8;
  try {
    const body = fs.readFileSync(markerFile, 'utf8');
    ok8 = body.includes(markerString);
    ev8 = `marker '${markerString}' ${ok8 ? 'PRESENT' : 'ABSENT'} in ${markerFile}`;
  } catch (err) {
    ev8 = `marker file unreadable: ${(err && err.message) || err} (fail-closed)`;
  }
  items.push(item('verifier_advisory_bounded', ok8, ev8));

  const passed = items.filter((i) => i.result === 'PASS').length;
  const ready = passed === items.length;
  return {
    ok: true,
    fail_closed: false,
    overall: ready ? 'READY' : 'NOT-READY',
    passed,
    total: items.length,
    items,
    decision_note: DECISION_NOTE,
  };
}

/**
 * Route helper: flip checklist for a hunt id (traversal-safe, read-only).
 * Reads <dataDir>/hunts/<huntId>/oneloop + its optional rehearsal.json.
 */
export function flipcheckSummary(dataDir, huntId) {
  const hid = safeHuntId(huntId);
  if (!hid) {
    const r = failClosed('bad_hunt_id');
    r.huntId = String(huntId);
    return r;
  }
  const memdir = oneLoopMemdir(dataDir, hid);
  let rehearsal = null;
  const rh = readJsonFile(path.join(memdir, REHEARSAL_FILE));
  if (rh.ok && rh.value && typeof rh.value === 'object') rehearsal = rh.value;
  const r = runFlipcheck(memdir, { rehearsal });
  r.huntId = hid;
  r.memdir = memdir;
  r.rehearsal_present = rehearsal !== null;
  return r;
}
