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
// (claims.json, Rule #32 state machine). RULE #43 — the backend claim
// bridge (oneLoopClaimBridge.js) files newly FILED claims through the
// real claim pipeline (claimGateCheck + assessResult): pipeline-verified
// claims surface as real findings (the pipeline's own record, like the AI
// path); pipeline-rejected claims become dead ends WITH REASON in loop
// memory and surface nowhere; claims the bridge skips stay FILED and
// surface as LEADS (verified:false) exactly like Rule #42. The 100% TRUTH
// RULE holds: only the pipeline verifier may mark a finding verified.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brainTurn } from './oneLoopBrain.js';
import { bridgeClaims } from './oneLoopClaimBridge.js';
import { config } from '../config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// backend/src/brain/ -> backend/
export const BRAIN_TURN_SCRIPT = path.resolve(HERE, '..', '..', 'brain-py', 'brain-turn.py');
/** Probe bundle the bridge stages into the hunt container (Rule #43). */
export const ONELOOP_PROBE_DIR = path.resolve(HERE, '..', '..', 'brain-py', 'brain-probes');
/** Loop entry whose --scan-validation folds pipeline verdicts back (Rule #43). */
export const ONELOOP_APILOOP_SCRIPT = path.resolve(HERE, '..', '..', 'brain-py', 'brain-apiloop-v1.py');
/** The standing goal string the one-loop understands (Rule #31). */
export const ONELOOP_HUNT_GOAL = 'probe-hunt';

/** Per-hunt persistent memory dir for the one-loop brain. */
export function oneLoopMemdir(dataDir, huntId) {
  return path.join(String(dataDir || config.dataDir), 'hunts', String(huntId), 'oneloop');
}

/**
 * Read the loop's claims.json (hash-keyed, Rule #37) and return the
 * FILED claims as [{ hash, title, severity, module, evidence_hash,
 * filed_turn, class, command, evidence, counterevidence, confidence }].
 * Anything unreadable -> [] (fail-open on reads: the session keeps
 * running; a missing claims file is not a brain failure).
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
        // Rule #43: the verifier-facing proof package, persisted by
        // record_filed. Absent on older records -> the bridge skips
        // the claim fail-closed (stays FILED, surfaces as a lead).
        class: c.class ? String(c.class) : null,
        command: c.command ? String(c.command) : null,
        evidence: c.evidence ? String(c.evidence) : null,
        counterevidence: c.counterevidence ? String(c.counterevidence) : null,
        confidence: c.confidence ? String(c.confidence) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * RULE #43 — file newly FILED loop claims through the real claim
 * pipeline via bridgeClaims. With no verifier wired (no claimGateCheckFn
 * / assessFn in deps) the bridge reports disabled and every claim stays a
 * lead (Rule #42 behavior, byte-identical). Never throws: a bridge
 * failure is fail-closed, claims stay FILED.
 */
async function bridgeNewClaims({ huntId, target, memdir, dataDir, claims, deps }) {
  const bridgeDeps = {
    claimGateCheckFn: deps.claimGateCheckFn || null,
    assessFn: deps.assessFn || null,
    copyToContainerFn: deps.copyToContainerFn || null,
    probeDir: deps.probeDir || ONELOOP_PROBE_DIR,
    pythonBin: deps.pythonBin || 'python3',
    apiloopScript: deps.apiloopScript || ONELOOP_APILOOP_SCRIPT,
    eventsPath: path.join(String(dataDir), 'hunts', String(huntId), 'events.jsonl'),
  };
  try {
    return await bridgeClaims({ huntId, target, memdir, claims, deps: bridgeDeps });
  } catch (e) {
    return {
      bridged: 0, byHash: {}, scan: null, disabled: false,
      log: ['bridge threw (fail-closed, claims stay FILED): ' + ((e && e.message) || e)],
    };
  }
}

/**
 * Drive one session of the one-loop brain.
 *
 * @param {object} args
 *   huntId, target — the hunt and its explicit target base URL
 *   opts — the humanIteration opts ({ turns, findings })
 *   deps — test seam: { brainTurnFn, dataDir,
 *     claimGateCheckFn, assessFn, copyToContainerFn, // Rule #43 bridge
 *     probeDir, pythonBin, apiloopScript }
 *   Without the Rule #43 deps the bridge is disabled and claims surface
 *   as leads (Rule #42 behavior, byte-identical).
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
    // Newly FILED claims -> the backend claim bridge (Rule #43).
    // Pipeline-verified -> the pipeline's own finding record (same object
    // the AI claim path pushes). Pipeline-rejected -> dead end WITH REASON
    // in loop memory, surfaced nowhere. Still FILED (bridge skipped or
    // disabled) -> lead (verified:false), exactly like Rule #42.
    // The 100% TRUTH RULE: only the pipeline verifier marks verified.
    const fresh = [];
    for (const c of filedClaims(memdir)) {
      if (seenFiled.has(c.hash)) continue;
      seenFiled.add(c.hash);
      fresh.push(c);
    }
    if (fresh.length > 0) {
      const bridge = await bridgeNewClaims({ huntId, target, memdir, dataDir, claims: fresh, deps });
      for (const entry of bridge.log) log.push({ turn: turnsRun, bridge: entry });
      for (const c of fresh) {
        const b = bridge.byHash[c.hash] || {};
        if (b.bridged && b.terminal === 'accepted' && b.rec) {
          newFindings.push(b.rec);
          if (Array.isArray(opts.findings)) opts.findings.push(b.rec);
        } else if (b.bridged && b.terminal === 'rejected') {
          log.push({
            turn: turnsRun,
            claim: String(c.hash).slice(0, 12),
            bridge: 'rejected',
            note: 'pipeline verifier rejected — dead end WITH REASON in loop memory; NOT surfaced as a finding (100% TRUTH RULE)',
          });
        } else {
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
      }
    }
    if (s.completed) break;
  }

  return { aiOk: true, turnsRun, actionsRun: turnsRun, newFindings, log };
}
