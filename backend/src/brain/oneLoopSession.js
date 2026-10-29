// Dark Matter — RULE #42 (30 Oct 2026): BRAIN_PROVIDER wiring.
//
// When BRAIN_PROVIDER=oneloop, humanIteration delegates the whole session
// to this module: the deterministic one-loop brain (backend/brain-py/)
// drives every turn instead of the LLM think step. Env-gated — unset (or
// anything else) keeps the current LLM path byte-identical.
//
// Contract with the outer loop (huntAgent.js / humanLoopDriver.js): the
// same session shape humanIteration's turn loop returns:
//   { aiOk, failKind?, turnsRun, actionsRun, newFindings, log }
// so checkpointing, the AI circuit breaker and billing parity all work
// unchanged. Fail-closed: a brainTurn that returns ok:false ends the
// session with aiOk:false — the hunt never advances on a half-turn.
//
// Memory: the loop's 3-file memory lives at
//   <dataDir>/hunts/<huntId>/oneloop
// and persists across sessions — the brain never restarts fresh.
//
// Findings: the loop files claims LOCAL-ONLY into the memdir
// (claims.json, Rule #32 state machine). Newly FILED claims surface here
// as LEADS (verified:false) — the 100% TRUTH RULE holds: only the
// pipeline verifier may mark a finding verified. The backend claim
// bridge (filing these through assessResult) is a later rule.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brainTurn } from './oneLoopBrain.js';
import { config } from '../config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// backend/src/brain/ -> backend/
export const BRAIN_TURN_SCRIPT = path.resolve(HERE, '..', '..', 'brain-py', 'brain-turn.py');
/** The standing goal string the one-loop understands (Rule #31). */
export const ONELOOP_HUNT_GOAL = 'probe-hunt';

/** Per-hunt persistent memory dir for the one-loop brain. */
export function oneLoopMemdir(dataDir, huntId) {
  return path.join(String(dataDir || config.dataDir), 'hunts', String(huntId), 'oneloop');
}

/**
 * Read the loop's claims.json (hash-keyed, Rule #37) and return the
 * FILED claims as [{ hash, title, severity, module, evidence_hash,
 * filed_turn }]. Anything unreadable -> [] (fail-open on reads: the
 * session keeps running; a missing claims file is not a brain failure).
 */
export function filedClaims(memdir) {
  try {
    const raw = fs.readFileSync(path.join(String(memdir), 'claims.json'), 'utf8');
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return [];
    const out = [];
    for (const [hash, c] of Object.entries(j)) {
      if (!c || typeof c !== 'object') continue;
      if (c.state !== 'filed') continue;
      out.push({
        hash: String(hash),
        title: String(c.title || 'one-loop claim'),
        severity: String(c.severity || 'unknown'),
        module: String(c.module || 'unknown'),
        evidence_hash: c.evidence_hash ? String(c.evidence_hash) : null,
        filed_turn: Number.isInteger(c.filed_turn) ? c.filed_turn : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Drive one session of the one-loop brain.
 *
 * @param {object} args
 *   huntId, target — the hunt and its explicit target base URL
 *   opts — the humanIteration opts ({ turns, findings })
 *   deps — test seam: { brainTurnFn, dataDir }
 * @returns {Promise<object>} the session shape
 */
export async function runOneLoopSession({ huntId, target, opts = {}, deps = {} }) {
  const brainTurnFn = deps.brainTurnFn || brainTurn;
  const dataDir = deps.dataDir || config.dataDir;
  const turns = Math.max(1, Number(opts.turns) || 6);
  const memdir = oneLoopMemdir(dataDir, huntId);
  const log = [];
  const newFindings = [];

  const failClosed = (failKind, turnsRun) => ({
    aiOk: false, failKind, turnsRun, actionsRun: turnsRun, newFindings, log,
  });

  if (!target || !String(target).trim()) {
    return failClosed('oneloop:empty_target', 0);
  }
  if (!fs.existsSync(BRAIN_TURN_SCRIPT)) {
    return failClosed('oneloop:script_missing', 0);
  }

  let seenFiled = new Set(filedClaims(memdir).map((c) => c.hash));
  let turnsRun = 0;

  for (let t = 0; t < turns; t++) {
    let s;
    try {
      s = await brainTurnFn({
        script: BRAIN_TURN_SCRIPT,
        memdir,
        goal: ONELOOP_HUNT_GOAL,
        targetBase: String(target).trim(),
      });
    } catch (e) {
      s = { ok: false, error: 'ONELOOP_SESSION_THROW: ' + ((e && e.message) || e) };
    }
    turnsRun++;
    log.push({
      turn: turnsRun,
      ok: Boolean(s && s.ok),
      action_type: s ? s.action_type : null,
      verdict: s ? s.verdict : null,
      completed: Boolean(s && s.completed),
      wall_s: s ? s.wall_s : null,
      llm_calls: 0,
      meta_spend_usd: 0,
      summary: s || null,
    });
    if (!s || s.ok !== true) {
      // Fail-closed: never advance the hunt on a half-turn. The outer
      // loop's circuit breaker (5 consecutive failures) still applies.
      const err = String((s && s.error) || 'unknown').slice(0, 160);
      return failClosed('oneloop:' + err, turnsRun);
    }
    // Newly FILED claims -> leads (verified:false; the 100% TRUTH RULE:
    // only the pipeline verifier may mark a finding verified).
    for (const c of filedClaims(memdir)) {
      if (seenFiled.has(c.hash)) continue;
      seenFiled.add(c.hash);
      const lead = {
        title: c.title,
        severity: c.severity,
        module: c.module,
        verified: false,
        source: 'oneloop-lead',
        huntId: String(huntId),
        evidence_hash: c.evidence_hash,
        filed_turn: c.filed_turn,
        note: 'One-loop brain lead — reproducible probe verdict, NOT pipeline-verified. Shows as a lead under investigation, never Confirmed.',
      };
      newFindings.push(lead);
      if (Array.isArray(opts.findings)) opts.findings.push(lead);
    }
    if (s.completed) break;
  }

  return { aiOk: true, turnsRun, actionsRun: turnsRun, newFindings, log };
}
