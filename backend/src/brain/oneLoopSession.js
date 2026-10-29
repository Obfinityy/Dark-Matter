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
import { execFileSync } from 'node:child_process';
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

/** RULE #44 — audit file: every dry-run turn is recorded here, JSONL. */
export const ONELOOP_AUDIT_FILE = 'audit.jsonl';

/**
 * RULE #47 — escalation-aware turn budget, fail-closed fallback.
 *
 * The exact budget lives with the loop (brain-apiloop-v1.py
 * --budget-json): 2 turns per planned module (probe + claim) plus one
 * turn per escalation rung, since every rung fires at most once
 * (A-to-Z memory, Rule #30). Rule #46 proved the old flat default could
 * strand a CONFIRMED probe's claim outside the budget.
 *
 * Never throws: any failure (missing script, bad JSON, timeout) falls
 * back to the documented constant 2*11 + 6 = 28 with fallback:true,
 * which the session logs WITH REASON instead of silently mis-budgeting.
 */
export const ONELOOP_BUDGET_FALLBACK = 28;
export function recommendedOneLoopTurns({ apiloopScript, pythonBin } = {}) {
  const script = apiloopScript || ONELOOP_APILOOP_SCRIPT;
  const py = pythonBin || 'python3';
  try {
    const raw = execFileSync(py, [script, '--budget-json'],
      { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
    const j = JSON.parse(String(raw || '').trim());
    const rec = j && j.recommended_turns;
    if (Number.isInteger(rec) && rec > 0 && rec <= 10000) {
      return {
        recommended_turns: rec,
        base_turns: j.base_turns,
        max_escalation_turns: j.max_escalation_turns,
        planned_modules: j.planned_modules,
        fallback: false,
      };
    }
    return { recommended_turns: ONELOOP_BUDGET_FALLBACK, fallback: true,
             reason: 'budget-json parsed but recommended_turns invalid' };
  } catch (e) {
    return { recommended_turns: ONELOOP_BUDGET_FALLBACK, fallback: true,
             reason: 'budget query failed: ' + ((e && e.message) || e).toString().slice(0, 120) };
  }
}

/**
 * RULE #44 — append one audit record. Fail-open: an audit write must never
 * break the session (the audit is observation, not control).
 */
export function appendAudit(memdir, record) {
  try {
    fs.mkdirSync(String(memdir), { recursive: true });
    fs.appendFileSync(
      path.join(String(memdir), ONELOOP_AUDIT_FILE),
      JSON.stringify({ ts: new Date().toISOString(), dryRun: true, ...record }) + '\n',
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
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
 *   opts — the humanIteration opts ({ turns, findings, dryRun })
 *     turns: explicit per-call turn slice (humanLoop passes its slice —
 *     the persistent memdir resumes across calls, so escalations never
 *     strand a claim there). When ABSENT, the Rule #47 escalation-aware
 *     budget is used (2*modules + escalation headroom from the loop's
 *     own --budget-json) instead of the old flat default of 6.
 *     dryRun (Rule #44): audit mode — the brain drives the same turns but
 *     the backend commits nothing: the claim bridge is never called, no
 *     findings/leads are pushed (opts.findings untouched), and every turn
 *     is written to <memdir>/audit.jsonl. The brain's own memory files
 *     (claims.json etc.) still persist — a later live flip inherits the
 *     audited state instead of re-claiming.
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
  const dryRun = opts.dryRun === true; // RULE #44 — audit mode
  // RULE #47 — escalation-aware turn budget. An explicit opts.turns is
  // honored exactly (humanLoop's per-slice wiring is byte-identical);
  // an absent/zero/NaN turns falls back to the loop's own recommended
  // budget (2*modules + escalation headroom), never the old flat 6 —
  // the flat default is what stranded the 11th claim in Rule #46.
  const explicitTurns = Number(opts.turns);
  const budget = (Number.isFinite(explicitTurns) && explicitTurns > 0)
    ? { turns: Math.max(1, Math.floor(explicitTurns)), explicit: true }
    : (() => {
        const b = recommendedOneLoopTurns();
        return { turns: b.recommended_turns, explicit: false, ...b };
      })();
  const turns = budget.turns;
  const memdir = oneLoopMemdir(dataDir, huntId);
  const log = [];
  const newFindings = [];
  // The budget decision is logged WITH REASON at turn 0 so any audit can
  // see exactly why this session ran N turns (and whether it was the
  // recommended budget or the fail-closed fallback).
  log.push({ turn: 0, oneloop_budget: { turns, ...budget } });

  const failClosed = (failKind, turnsRun) => ({
    aiOk: false, failKind, turnsRun, actionsRun: turnsRun, newFindings, log,
    budget: { turns, explicit: budget.explicit,
              fallback: budget.fallback === true },
    ...(dryRun ? { dryRun: true } : {}),
  });

  if (!target || !String(target).trim()) {
    return failClosed('oneloop:empty_target', 0);
  }
  if (!fs.existsSync(BRAIN_TURN_SCRIPT)) {
    return failClosed('oneloop:script_missing', 0);
  }

  // RULE #44 — the audit starts before turn 1: anyone reading the hunt log
  // or the audit file sees immediately that this session committed nothing.
  if (dryRun) {
    const note = 'BRAIN_PROVIDER=oneloop-dryrun — audit only: the brain drives ' +
      'the same turns, but the claim bridge is disabled and no findings/leads ' +
      'are committed to the hunt. Claims stay FILED in loop memory.';
    log.push({ turn: 0, dryrun: note });
    appendAudit(memdir, { turn: 0, note });
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
    //
    // RULE #44 — in dry-run the brain still FILES claims into its own
    // memory (that is what we audit), but the bridge is never called and
    // nothing is surfaced anywhere: no findings, no leads, opts.findings
    // untouched. Each filed claim is logged WITH REASON and written to
    // the audit file so the flip can be reviewed claim-by-claim.
    const fresh = [];
    for (const c of filedClaims(memdir)) {
      if (seenFiled.has(c.hash)) continue;
      seenFiled.add(c.hash);
      fresh.push(c);
    }
    if (dryRun) {
      appendAudit(memdir, {
        turn: turnsRun,
        action_type: s ? s.action_type : null,
        verdict: s ? s.verdict : null,
        completed: Boolean(s && s.completed),
        wall_s: s ? s.wall_s : null,
        new_claims: fresh.map((c) => String(c.hash).slice(0, 12)),
      });
    }
    if (fresh.length > 0) {
      if (dryRun) {
        for (const c of fresh) {
          log.push({
            turn: turnsRun,
            claim: String(c.hash).slice(0, 12),
            dryrun: 'bridge SKIPPED (audit mode) — claim stays FILED in loop memory, NOT surfaced as a finding or lead',
          });
        }
      } else {
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
    }
    if (s.completed) break;
  }

  return { aiOk: true, turnsRun, actionsRun: turnsRun, newFindings, log,
           budget: { turns, explicit: budget.explicit,
                     fallback: budget.fallback === true,
                     recommended_turns: budget.recommended_turns },
           ...(dryRun ? { dryRun: true } : {}) };
}
