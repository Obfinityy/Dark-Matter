// Dark Matter — CONTINUOUS HUMAN-BRAIN LOOP (26 Oct 2026, owner order:
// infinity-level agent: the brain works the way a human brain works —
// continuously, not in turns).
//
// The driver: observe → brain decides ONE action → execute → observe
// again → repeat. One cycle IS one humanIteration(turns: 1): the same
// prompt, the same dispatch, the same gates — the driver only schedules
// WHEN the brain is asked, never WHAT it decides (standing owner order,
// 20 Oct 2026). No predefined sequence, no fixed order of operations.
//
// Why a cycle is a 1-turn session instead of a factored turn body:
// the turn body is the hunt's most delicate code (gates, ledger,
// checkpoints); factoring it out would fork the dispatch. A 1-turn
// session reuses it wholesale — including the per-cycle turn-start
// snapshot (fresh eyes every cycle: desktop / browser / terminal as
// the brain left them), the per-turn memory refresh (plan, output
// ledger, relevant memories), and the per-turn checkpoint. The session
// setup is seconds; the brain call is minutes on the 8B, seconds on
// Meta — the loop's cadence IS the brain's cadence, honestly.
//
// Billing parity: one driver invocation runs LOOP_CYCLES_PER_RUN
// cycles (default 6) — one charge per 6 cycles, exactly one charge
// per 6-turn session today. The outer loop re-invokes the driver each
// iteration, so its checkpoint, charge, pause and circuit breaker all
// work unchanged. The loop never stacks brain calls: cycles are
// awaited strictly in sequence, one brain call at a time. The brain
// call goes through callBrain (via the deps.chat the outer loop
// passes in), so a silent Meta falls back to the 8B inside the very
// same cycle, exactly as a turn does — the fallback is never bypassed.
//
// Failure honesty: a no-reply cycle backs off and retries; only
// LOOP_MAX_FAILED_CYCLES consecutive failures end the run with
// { aiOk: false, failStreak } — and the streak is plumbed to the
// outer circuit breaker, so a dead brain still pauses the hunt after
// 5 failed calls, exactly as the turn loop does (not 25).
//
// The loop is startable/stoppable per hunt: meta.loop.enabled
// (default true) + the in-memory registry below. Stopping finishes
// the current cycle and returns — the outer loop then falls back to
// turn sessions. The turn loop is never deleted: it IS the fallback
// driver whenever the loop is disabled.

import { humanIteration } from './humanLoop.js';
import { readHuntMeta, writeHuntMetaCheckpoint, appendHuntEvent } from './store.js';

/** Cycles per driver invocation — billing parity: 1 charge per 6 cycles, as 1 charge per 6-turn session today. */
export const LOOP_CYCLES_PER_RUN_DEFAULT = 6;
/** Pause between cycles — fast-brain pacing; on the 8B the brain call itself dominates. */
export const LOOP_INTER_CYCLE_MS_DEFAULT = 2000;
/** Pause after a no-reply cycle before the next attempt. */
export const LOOP_NOREPLY_BACKOFF_MS_DEFAULT = 30000;
/** Consecutive failed cycles before the driver gives up the run. */
export const LOOP_MAX_FAILED_CYCLES_DEFAULT = 5;

/** In-memory registry of running drivers: huntId -> { startedAt, cyclesRun, stopRequested }. */
const activeLoops = new Map();

/** Empty loop state, as persisted in meta.json under `loop`. */
export function emptyLoopState() {
  return { enabled: true, cycles: 0, lastCycleAt: '' };
}

/**
 * The loop's persisted state for one hunt, normalised.
 * `enabled` defaults to true — the loop is the driver unless the
 * owner (or a stop call) turned it off for this hunt.
 */
export function loopStateFor(huntId, meta, { registry } = {}) {
  const stored = (meta && typeof meta === 'object' && meta.loop && typeof meta.loop === 'object') ? meta.loop : {};
  const reg = (registry || activeLoops).get(huntId);
  return {
    enabled: stored.enabled !== false,
    cycles: Math.max(0, Number(stored.cycles) || 0),
    lastCycleAt: String(stored.lastCycleAt || ''),
    running: Boolean(reg),
    stopRequested: Boolean(reg && reg.stopRequested),
  };
}

/** True when the loop driver should run for this hunt (default true; false only when explicitly disabled). */
export function loopEnabledFor(huntId, meta, opts = {}) {
  return loopStateFor(huntId, meta, opts).enabled;
}

/** True while a driver run is active for this hunt (in-memory registry). */
export function isLoopRunning(huntId, { registry } = {}) {
  return (registry || activeLoops).has(huntId);
}

function recordLoopEvent(huntId, evt, { record } = {}) {
  const rec = record || appendHuntEvent;
  try {
    rec(huntId, { type: 'status', ...evt, at: new Date().toISOString() });
  } catch {
    /* loop events are best-effort — the driver itself already ran */
  }
}

function saveLoopState(huntId, patch, { writeMeta, readMeta } = {}) {
  const read = readMeta || readHuntMeta;
  const write = writeMeta || writeHuntMetaCheckpoint;
  try {
    const meta = (read(huntId) || {});
    const prev = (meta.loop && typeof meta.loop === 'object') ? meta.loop : {};
    write(huntId, { loop: { ...emptyLoopState(), ...prev, ...patch } });
  } catch {
    /* loop state is best-effort */
  }
}

/**
 * Turn the loop on for a hunt (the outer loop picks it up on its
 * next iteration). Returns the stored state.
 */
export function startHumanLoop(huntId, { readMeta, writeMeta, record, registry } = {}) {
  const reg = registry || activeLoops;
  const entry = reg.get(huntId);
  if (entry) entry.stopRequested = false;
  saveLoopState(huntId, { enabled: true }, { readMeta, writeMeta });
  return loopStateFor(huntId, (readMeta || readHuntMeta)(huntId) || {}, { registry: reg });
}

/**
 * Turn the loop off for a hunt. A running driver finishes its
 * current cycle and returns; the outer loop then falls back to turn
 * sessions. When no driver is running, the stop itself is recorded
 * (a running driver records its own stop on exit).
 */
export function stopHumanLoop(huntId, { reason = 'stopped', readMeta, writeMeta, record, registry } = {}) {
  const reg = registry || activeLoops;
  const entry = reg.get(huntId);
  if (entry) entry.stopRequested = true;
  saveLoopState(huntId, { enabled: false }, { readMeta, writeMeta });
  if (!entry) {
    recordLoopEvent(huntId, { state: 'loop_stopped', reason }, { record });
  }
  return loopStateFor(huntId, (readMeta || readHuntMeta)(huntId) || {}, { registry: reg });
}

/**
 * THE continuous loop driver.
 *
 * Runs up to maxCycles cycles back-to-back for one hunt. One cycle
 * is one humanIteration(turns: 1) with the caller's deps forwarded
 * unchanged — the same prompt, the same dispatch, the same gates,
 * the same event types (thinking, tool_call, dedup_block,
 * model_switch, findings) the 10-min reports and the hunt feed
 * already read, so monitoring keeps working unchanged.
 *
 * Returns the session-shaped result the outer loop already handles
 * ({ aiOk, failKind, turnsRun, actionsRun, newFindings, log }) plus
 * { cyclesRun, failStreak, stopped, duplicate }:
 *   - stopped: the loop was disabled / the hunt paused or stopped
 *     mid-run (a clean exit, not a failure).
 *   - duplicate: a driver run was already active for this hunt —
 *     the second start is refused (aiOk stays true so the outer
 *     circuit breaker never trips on a refused duplicate).
 *   - failStreak: consecutive failed cycles in this run — the outer
 *     circuit breaker adds it, so a dead brain pauses the hunt
 *     after 5 failed calls, exactly as the turn loop does.
 *
 * Deps: `deps` is the humanIteration deps object (assess, exec,
 * chat = the callBrain wrapper in production). readMeta/writeMeta/
 * record/sleep/now default to the real store/timers and are
 * injectable for tests; when present on `deps` they are reused, so
 * a test stubs once and both layers use the stubs.
 */
export async function runHumanLoop(huntId, target, opts = {}) {
  const registry = opts.registry || activeLoops;
  const deps = opts.deps || {};
  const readMeta = opts.readMeta || deps.readMeta || readHuntMeta;
  const writeMeta = opts.writeMeta || deps.writeMeta || writeHuntMetaCheckpoint;
  const record = opts.record || deps.record || appendHuntEvent;
  const sleep = opts.sleep || deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now || deps.now || (() => Date.now());
  const maxCycles = Math.max(1, Number(opts.maxCycles ?? LOOP_CYCLES_PER_RUN_DEFAULT) || LOOP_CYCLES_PER_RUN_DEFAULT);
  const interCycleMs = Math.max(0, Number(opts.interCycleMs ?? LOOP_INTER_CYCLE_MS_DEFAULT) || 0);
  const noReplyBackoffMs = Math.max(0, Number(opts.noReplyBackoffMs ?? LOOP_NOREPLY_BACKOFF_MS_DEFAULT) || 0);
  const maxFailedCycles = Math.max(1, Number(opts.maxFailedCycles ?? LOOP_MAX_FAILED_CYCLES_DEFAULT) || LOOP_MAX_FAILED_CYCLES_DEFAULT);
  const startIteration = Math.max(1, Number(opts.startIteration || 1) || 1);
  const findings = Array.isArray(opts.findings) ? opts.findings : [];

  const empty = { aiOk: true, failKind: null, turnsRun: 0, actionsRun: 0, newFindings: [], log: [], cyclesRun: 0, failStreak: 0, stopped: false, duplicate: false };

  // One driver at a time per hunt — a second start is refused, never
  // stacked (stacked drivers would fire concurrent brain calls).
  if (registry.has(huntId)) {
    return { ...empty, duplicate: true };
  }
  const entry = { startedAt: now(), cyclesRun: 0, stopRequested: false };
  registry.set(huntId, entry);

  let cyclesRun = 0;
  let actionsRun = 0;
  let failStreak = 0;
  let stopped = false;
  let stopReason = 'run_complete';
  let failKind = null;
  const allFindings = [];
  const allLog = [];
  let baseCycles = 0;
  try {
    try { baseCycles = loopStateFor(huntId, readMeta(huntId) || {}, { registry }).cycles; } catch { baseCycles = 0; }
  } catch { baseCycles = 0; }
  recordLoopEvent(huntId, { state: 'loop_started', cycles: baseCycles }, { record });

  try {
    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      // Stop checks, every cycle: the owner disabled the loop, the
      // hunt was paused/stopped, or stopHumanLoop was called.
      let meta = {};
      try { meta = readMeta(huntId) || {}; } catch { meta = {}; }
      if (entry.stopRequested || !loopEnabledFor(huntId, meta, { registry })) {
        stopped = true;
        stopReason = entry.stopRequested ? 'stopped' : 'disabled';
        break;
      }
      if (meta.paused === true || meta.stopped === true || meta.state === 'paused' || meta.state === 'stopped') {
        stopped = true;
        stopReason = meta.stopped === true || meta.state === 'stopped' ? 'hunt_stopped' : 'hunt_paused';
        break;
      }

      // ONE cycle: observe (fresh snapshot inside the session) →
      // brain decides ONE action → execute → observe again. The
      // next cycle's screen is built from the record this cycle
      // just wrote — the observation feeds the next decision, with
      // no turn boundary between them.
      let res = null;
      try {
        res = await humanIteration(huntId, target, {
          turns: 1,
          findings,
          iteration: startIteration + cyclesRun,
          ...(opts.parsedScope ? { parsedScope: opts.parsedScope } : {}),
          deps,
        });
      } catch (err) {
        res = { aiOk: false, failKind: 'error', turnsRun: 0, actionsRun: 0, newFindings: [], log: [] };
        try { record(huntId, { type: 'thinking', text: `Continuous loop cycle ${cycle} failed safely: ${String((err && err.message) || err).slice(0, 200)}`, via: 'human-loop' }); } catch { /* best-effort */ }
      }
      cyclesRun++;
      entry.cyclesRun = cyclesRun;
      if (res && Array.isArray(res.newFindings)) allFindings.push(...res.newFindings);
      if (res && Array.isArray(res.log)) allLog.push(...res.log);
      actionsRun += (res && Number(res.actionsRun)) || 0;

      // Per-cycle checkpoint: the loop's own totals ride meta.loop,
      // beside the turn totals humanIteration already wrote. The
      // outer `iteration` is NOT written here — the outer loop owns
      // it and advances it once per driver run, so it can never go
      // backwards between runs.
      saveLoopState(huntId, { enabled: true, cycles: baseCycles + cyclesRun, lastCycleAt: new Date().toISOString() }, { readMeta, writeMeta });

      if (res && res.aiOk) {
        failStreak = 0;
        failKind = null;
      } else {
        failStreak++;
        failKind = (res && res.failKind) || 'unknown';
        if (failStreak >= maxFailedCycles) {
          // A dead brain ends the run — the streak is returned so
          // the outer circuit breaker trips after 5 failed calls,
          // exactly as the turn loop does.
          break;
        }
        // A silent brain backs off and retries inside the run —
        // the loop continues while the brain recovers.
        if (cycle < maxCycles && noReplyBackoffMs > 0) await sleep(noReplyBackoffMs);
        continue;
      }

      // Pacing between cycles — skipped after the last cycle. On
      // the 8B the brain call dominates and this is negligible;
      // on a fast brain it keeps the loop from hammering the
      // target and the machine.
      if (cycle < maxCycles && interCycleMs > 0) await sleep(interCycleMs);
    }
  } finally {
    registry.delete(huntId);
  }

  const aiOk = failStreak < maxFailedCycles;
  // Every run end is visible in the record — clean completion,
  // owner stop, hunt hold, or breaker trip — so the 10-min reports
  // can tell a finished run from a run that never started.
  recordLoopEvent(huntId, { state: 'loop_stopped', reason: !aiOk ? `failed_cycles:${failKind || 'unknown'}` : stopReason, cycles: baseCycles + cyclesRun }, { record });
  return {
    aiOk,
    failKind: aiOk ? null : failKind,
    turnsRun: cyclesRun,
    actionsRun,
    newFindings: allFindings,
    log: allLog,
    cyclesRun,
    failStreak,
    stopped,
    duplicate: false,
  };
}
