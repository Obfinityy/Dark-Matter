// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  execInHuntContainerWithRespawn,
  dockerAvailable,
} from '../huntRunner.js';
import { HuntOrchestrator } from '../orchestrator.js';
import { isErrorPageFinding } from '../huntMemory.js';
import { aiAvailable } from '../llm.js';
import { callBrain } from '../brainProvider.js';
import { checkBudget } from '../budgetCap.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import { humanIteration, defaultDeliverChatAnswer } from '../humanLoop.js';
import { getBalanceCents, deductCreditsUsd } from '../billing/credits.js';
import { hasActiveAccessById } from '../access.js';
import {
  generateLogicTests,
  evidenceGate,
  verifyPipeline,
  executionFailed,
  httpErrorStatus,
  evidenceReproduced,
  assessContentRelevance,
  evidenceSignalIds,
  supportingSignalLines,
  extractLinkedAssetUrls,
  beamSearchChains,
  analyzeFindings,
  mineJsEndpoints,
  rankEndpoints,
  blModulesFor,
  classifyTarget,
  scoreWeirdness,
  isWorthInvestigating,
  recordHuntExperience,
  getPlaybook,
  encodePayload,
  ENCODERS,
  fingerprintWaf,
  classifyFinding,
  sweepSiblings,
  buildSweepProbe,
  backfillVerifiedClasses,
} from '../hunt-intel/index.js';
import { extractSignal, extractTestsFromThinking, finding, fnv1aHex, inferAppPurpose, isPaused, isStopped, repairShellQuoting, sanitizeForAI, stripTerminalArtifacts, think, waitWhilePaused } from './text.js';
import { DRIVER_LOCK_BEAT_MS, activeLoops, getOrchestrator, isDriverActive, orchestrators, releaseDriverLock, touchDriverLock, tryAcquireDriverLock } from './driver.js';
import { executeWithEvasion } from './exec.js';
import { getTargetBaselines, reconPhase } from './recon.js';
import { assessResult } from './verification.js';
import { agentIteration } from './iteration.js';

// Gentle gap between iterations so the target is not hammered.
const PACING_DELAY_MS = 2000;


// Credit price per hunt iteration (USD), by hunt mode. The hunt auto-pauses
// with state 'out_of_credits' when the wallet can't cover the next iteration;
// topping up + Resume continues it. Admins (owner) are exempt, and so is a
// user inside a paid access window (UPI activation: Rs 10,000 = 1 day —
// the day is already paid for, so iterations are free until it lapses).
const ITERATION_PRICE_USD = {
  normal: 0.1,
  medium: 0.15,
  high: 0.25,
  ultra_high: 0.4,
  max: 0.6,
  infinity: 1.0,
};

/** Price of one hunt iteration, in integer USD cents. */
export function iterationPriceCents(mode) {
  return Math.round((ITERATION_PRICE_USD[mode] || ITERATION_PRICE_USD.normal) * 100);
}

function isAdminUser(userId) {
  try {
    if (!userId) return false;
    const users = readUsers();
    const u = Object.values(users).find((x) => x && x.id === userId);
    return u && u.role === 'admin';
  } catch {
    return false;
  }
}

/** Deduct one iteration's price. Returns true if the hunt may proceed. */
function chargeIteration(huntId, userId, mode, iteration) {
  if (isAdminUser(userId)) return true; // owner testing is free
  if (hasActiveAccessById(userId)) return true; // paid access day: no per-iteration charge
  const priceCents = Math.round((ITERATION_PRICE_USD[mode] || ITERATION_PRICE_USD.normal) * 100);
  if (getBalanceCents(userId) < priceCents) {
    writeHuntMetaCheckpoint(huntId, { state: 'out_of_credits', paused: true });
    think(huntId, 'Out of credits — hunt paused. Top up your balance and press Resume to continue.');
    appendHuntEvent(huntId, { type: 'status', state: 'out_of_credits', iteration });
    return false;
  }
  // FIX (#327): the deduction result used to be discarded, so a hunt
  // whose balance was drained by a concurrent hunt between the
  // pre-check and the deduction still proceeded (spending past zero).
  // deductCreditsUsd re-checks the balance synchronously at deduct
  // time, so honoring its result closes the race within one process;
  // the caller already breaks the loop on false (see below).
  if (!deductCreditsUsd(userId, priceCents, { huntId, iteration, mode })) {
    writeHuntMetaCheckpoint(huntId, { state: 'out_of_credits', paused: true });
    think(huntId, 'Out of credits — hunt paused. Top up your balance and press Resume to continue.');
    appendHuntEvent(huntId, { type: 'status', state: 'out_of_credits', iteration });
    return false;
  }
  return true;
}

/**
 * Run the full autonomous hunt. Called async after hunt creation.
 * Never throws — all failures become hunt events.
 */
export async function runAutonomousHunt(huntId, target, mode = 'normal', userId = null, opts = {}) {
  // FIX (19 Oct 2026, solver #6): Loop-driver mutex — one hunt, one driver.
  // If a loop is already running for this hunt, refuse to start a second.
  if (activeLoops.has(huntId)) {
    think(huntId, 'Loop driver already active for this hunt — refusing duplicate (mutex).');
    return;
  }
  // FIX (19 Oct 2026, elite-gap): cross-process lock — activeLoops is
  // per-process and the watchdog spawns separate node processes.
  const lock = tryAcquireDriverLock(huntId);
  if (!lock.ok) {
    think(huntId, `Loop driver already active for this hunt — refusing duplicate (cross-process lock: ${lock.reason}).`);
    return;
  }
  activeLoops.add(huntId);
  const lockBeat = setInterval(() => touchDriverLock(huntId), DRIVER_LOCK_BEAT_MS);
  try {
    await runAutonomousHuntInner(huntId, target, mode, userId, opts);
  } finally {
    clearInterval(lockBeat);
    activeLoops.delete(huntId);
    releaseDriverLock(huntId);
  }
}

async function runAutonomousHuntInner(huntId, target, mode = 'normal', userId = null, opts = {}) {
  const startIteration = Math.max(1, opts.startIteration || 1);
  const isResume = Boolean(opts.isResume);
  // UNLIMITED HUNTING (owner directive): no iteration cap, no rate limit.
  // The hunt runs until the user stops it or the wallet runs out of money.
  // Money is the ONLY limit.
  // On resume, rebuild findings from the persisted event log so the agent
  // doesn't lose what it already found before the interruption.
  const findings = Array.isArray(opts.findings) ? opts.findings : [];

  try {
    if (isResume) {
      think(huntId, `Checkpoint resume — continuing from iteration ${startIteration} with ${findings.length} finding(s) already recorded. Hunting unlimited until you stop me or credits run out.`);
    } else {
      think(huntId, `Autonomous hunt starting — mode ${mode}. No iteration limit: I hunt until you stop me or the wallet runs out.`);
    }

    // FIX (21 Oct 2026, lane B): a driver must never drive a hunt the
    // owner is holding. A legitimate start/resume clears the hold flags
    // BEFORE launching the loop, so a held meta here means this driver
    // was started erroneously (stale watchdog, double launch). Hold —
    // do not even spawn the container — until the owner resumes, and
    // stop cleanly if the hunt was stopped meanwhile.
    if (isStopped(huntId)) {
      think(huntId, 'Hunt is stopped — loop driver not starting.');
      return;
    }
    if (isPaused(huntId)) {
      await waitWhilePaused(huntId);
      if (isStopped(huntId)) {
        think(huntId, 'Hunt stopped by user.');
        return;
      }
    }

    if (!(await dockerAvailable())) {
      think(huntId, 'Docker unavailable — running intel-only analysis (no container).');
      appendHuntEvent(huntId, { type: 'status', state: 'degraded', reason: 'no_docker' });
      return;
    }

    // Spawn is done by the route; ensure container exists
    const { container } = await spawnHuntContainer(huntId, target, { mode });
    // MERGE — the checkpoint writer merges over the meta as it exists at
    // write time (preserving userId/target/mode/createdAt) and never
    // stomps an owner-set pause/stop. Mark the hunt running so the status
    // is honest everywhere (list, reports, UI).
    writeHuntMetaCheckpoint(huntId, { container, state: 'running' });
    appendHuntEvent(huntId, { type: 'status', state: 'container_spawned', container });

    // TARGET-OPEN ON RESUME (27 Oct 2026, SEE-AND-CONTROL): the loop
    // driver opens the target in the container browser before the
    // first cycle, so the brain's first screen is the real target
    // instead of about:blank. Driver scaffolding only — the brain
    // still chooses everything it does with the target. The
    // container is freshly spawned on every resume/start, so one
    // open per driver run can never yank a mid-run navigation.
    // Human mode only; best-effort — a failed open never blocks
    // the hunt (the brain can open the target itself).
    try {
      const metaNow = readHuntMeta(huntId) || {};
      const isHuman = metaNow.humanMode === true || mode === 'human' || metaNow.mode === 'human';
      if (isHuman) {
        const { openTargetOnResume } = await import('../humanLoopDriver.js');
        await openTargetOnResume(huntId, target, { think: (h, t) => think(h, t) });
      }
    } catch (err) {
      think(huntId, `Target auto-open skipped (${String((err && err.message) || err).slice(0, 160)}) — the brain can open the target with browser_open.`);
    }

    // ORCHESTRATOR: the head of the hunt team. It plans, spawns specialist
    // workers, reviews their work, and writes the final report.
    const head = new HuntOrchestrator(huntId, target, mode);
    orchestrators.set(huntId, head);
    // RESTORE HEAD FINDINGS (27 Oct 2026, 404-verified audit): a fresh
    // HuntOrchestrator starts with findings: [] and saveState() below
    // overwrote meta.orchestrator.findings with [] on every resume —
    // the live hunt's 2 findings vanished to 0. Seed from the
    // resume-rebuilt findings (verified only, error-page stamps
    // excluded, one row per title) so the head never clobbers
    // persisted findings.
    try {
      const seen = new Set();
      head.findings = (findings || []).filter((f) => {
        if (!f || !f.verified || isErrorPageFinding(f)) return false;
        const key = String(f.title || '').toLowerCase().replace(/^poc confirmed:\s*/, '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch { /* seeding is best-effort */ }
    think(huntId, `Head online: I am the lead hacker. Target: ${target}. Assembling my team.`);

    // FINDINGS RESTORE (zero-genuine lane): a fresh orchestrator starts
    // with findings: [] — restore the persisted list (plus verified
    // finding events, which the store carries even if meta was
    // clobbered) so saveState()'s union has something to merge.
    try {
      const persisted = ((readHuntMeta(huntId) || {}).orchestrator || {}).findings || [];
      const verifiedEvents = readHuntEvents(huntId).filter((e) => e.type === 'finding' && e.verified);
      const seenKeys = new Set();
      for (const f of [...persisted, ...verifiedEvents]) {
        const k = `${f.title || ''}|${f.url || ''}`;
        if (k && !seenKeys.has(k)) { seenKeys.add(k); head.findings.push(f); }
      }
      if (head.findings.length) think(huntId, `Restored ${head.findings.length} persisted finding(s) into the head.`);
    } catch { /* findings restore is best-effort */ }

    // Phase 1: recon — head spawns a recon specialist worker.
    // FIX (19 Oct 2026, solver #3): recon was never persisted to meta.json —
    // every backend restart/resume re-ran the full recon (nmap + browser +
    // bundle mining, minutes wasted), and a failed resume-time recon left the
    // hunt with zero endpoints so the model hallucinated targets. Persist
    // recon to meta; on resume, reuse it instead of re-scanning.
    const reconWorker = head.spawnWorker('recon', `Map ${target}: open ports, services, tech stack, subdomains, endpoints.`);
    let recon = null;
    if (isResume) {
      const savedRecon = (readHuntMeta(huntId) || {}).recon;
      if (savedRecon && Array.isArray(savedRecon.endpoints) && savedRecon.endpoints.length > 0) {
        recon = savedRecon;
        think(huntId, `Reusing persisted recon: ${recon.endpoints.length} endpoints, tech [${(((recon.detection || {}).techs) || []).join(', ') || 'unknown'}] — no re-scan needed.`);
      }
    }
    if (!recon) {
      recon = await reconPhase(huntId, target);
      try {
        writeHuntMetaCheckpoint(huntId, { recon });
      } catch { /* recon persist is best-effort */ }
    }
    head.review(reconWorker, { ok: true, output: JSON.stringify(recon).slice(0, 500) }, () => recon && recon.profile);

    // PER-TARGET MEMORY: read what past hunts learned about this target, and
    // save what this hunt discovers. This is the brain's long-term memory —
    // every hunt starts smarter because of every hunt before it.
    let pastIntel = null;
    try {
      pastIntel = readTargetIntel(target);
      if (pastIntel && pastIntel.huntCount > 0) {
        think(huntId, `I remember this target from ${pastIntel.huntCount} past hunt(s). Last: ${pastIntel.lastHuntAt || 'unknown'}. Using past learnings.`);
        // Merge past endpoints into recon so the planner sees them
        const known = (pastIntel.endpoints || []).map((e) => (typeof e === 'string' ? e : e.url || e.path || '')).filter(Boolean);
        const seen = new Set(recon.endpoints);
        for (const ep of known.slice(0, 20)) if (!seen.has(ep)) { recon.endpoints.push(ep); seen.add(ep); }
        if (pastIntel.technologies && pastIntel.technologies.length) {
          recon.pastTechnologies = pastIntel.technologies.slice(0, 10);
        }
      }
      // Save this hunt's fresh recon into shared memory
      writeTargetIntel(target, {
        endpoints: (recon.endpoints || []).slice(0, 30),
        technologies: ((recon.detection && recon.detection.techs) || []).slice(0, 10),
      });
    } catch (err) {
      console.error('[hunt] target intel read/write failed:', err.message);
    }
    recon.pastIntel = pastIntel;
    head.saveState();

    // Learning: what worked on similar targets before?
    let playbook = [];
    try {
      playbook = getPlaybook({ profile: recon.profile });
      if (playbook.length) {
        think(huntId, `Playbook: ${playbook.length} lessons from past hunts on ${recon.profile} targets.`);
      }
    } catch { /* no history yet */ }

    // Business-logic intel: a human hunter thinks "where's the money, where's the trust?"
    // The app model (built in agentIteration) already captures this. Here we just
    // note the business-logic surface for the record — no mechanical checklist.
    try {
      const logic = generateLogicTests(recon.endpoints);
      if (logic.blModules.length) {
        think(huntId, `Business-logic surface: ${logic.blModules.length} areas worth thinking about (not a checklist — follow your instincts).`);
      }
    } catch { /* intel is best-effort */ }

    // Phase 2+: agent loop — UNLIMITED. Stops only when:
    //   1. the user stops it (isStopped),
    //   2. the wallet runs out (chargeIteration returns false → out_of_credits),
    //   3. AI backend or Docker becomes unavailable.
    // There is no iteration cap and no rate limit.
    const hasAI = aiAvailable();
    if (!hasAI) {
      think(huntId, 'No AI backend configured — hunt completed with recon results only.');
    }
    // Consecutive AI failures — circuit breaker trips at 5.
    // We track WHAT failed (not just that it failed) so the pause reason is honest:
    // 'no_reply' = brain gave nothing back, 'error' = the call threw,
    // 'bad_output' = brain replied but produced no usable plan.
    let aiFailStreak = 0;
    let aiFailKinds = [];

    for (let i = startIteration; ; i++) {
      // CHECKPOINT — persist progress every iteration so a killed backend
      // can resume this hunt from here instead of from zero. The per-hunt
      // memory folder (data/hunts/<id>/) is the source of truth.
      // FIX (21 Oct 2026, lane B): this write used to force
      // state:'running' over the persisted meta, so a pause the owner set
      // during the previous (in-flight) iteration flipped back to
      // 'running' here — and after a backend restart the reconciler then
      // cleared the pause flags and relaunched the hunt. The checkpoint
      // writer preserves an owner-set paused/stopped hold; progress
      // fields (iteration, checkpointAt) are still recorded.
      try {
        writeHuntMetaCheckpoint(huntId, {
          iteration: i, phase: 'hunting', state: 'running',
          checkpointAt: new Date().toISOString(),
        });
      } catch { /* checkpoint is best-effort */ }

      if (isStopped(huntId)) {
        think(huntId, 'Hunt stopped by user.');
        break;
      }
      // Operator pause holds the loop here (resume just clears the flag).
      await waitWhilePaused(huntId);
      if (isStopped(huntId)) {
        think(huntId, 'Hunt stopped by user.');
        break;
      }
      // Stop conditions are explicit and user-visible: the operator stops the
      // hunt, or the wallet runs out (out_of_credits pause). No iteration
      // cap, no rate limit, no silent internal caps.
      if (!hasAI) break;
      if (!(await dockerAvailable())) break;

      // Credits gate: each iteration costs a little; pause when the wallet is empty.
      if (!chargeIteration(huntId, userId, mode, i)) break;

      // BUDGET CAP (27 Oct 2026, owner order): pause when the hunt's
      // recorded spend reaches the user's per-hunt budget — never
      // stop, never restart from scratch. Resume continues from the
      // checkpoint (meta.iteration + 1, findings rebuilt).
      if (!checkBudget(huntId, { thinkFn: (h, t) => think(h, t) })) break;

      // CIRCUIT BREAKER: if the AI brain fails repeatedly (Ollama too slow
      // on 2vCPU, model down, etc.), pause the hunt with a clear message
      // instead of spinning forever doing nothing.
      let iterResult = null;
      try {
        // HUMAN MODE (20 Oct 2026, owner order): a hunt flagged human
        // mode runs ONE free perceive->think->act->observe loop
        // (humanLoop.js) instead of the staged pipeline — the hunter
        // sees its machine, thinks for itself, and picks each action.
        // No deterministic probes or diversity injections run there.
        // The pipeline below remains untouched for every other hunt.
        const metaBranch = readHuntMeta(huntId) || {};
        if (metaBranch.humanMode === true || mode === 'human' || metaBranch.mode === 'human') {
          // CONTINUOUS HUMAN-BRAIN LOOP (26 Oct 2026, owner order):
          // the loop driver runs observe→decide→act→observe cycles
          // back-to-back (humanLoopDriver.js) — the new driver for
          // human-mode hunts. The turn loop below stays as the
          // fallback driver whenever the loop is disabled, and the
          // driver itself falls back to it if its import fails.
          const loopDeps = { assess: assessResult, exec: executeWithEvasion, chat: (messages, system, ctx) => callBrain(messages, system, ctx, { huntId }) };
          let usedLoop = false;
          try {
            const { runHumanLoop, loopEnabledFor } = await import('../humanLoopDriver.js');
            if (loopEnabledFor(huntId, metaBranch)) {
              iterResult = await runHumanLoop(huntId, target, { deps: loopDeps, findings, startIteration: i });
              usedLoop = true;
            }
          } catch (err) {
            // The loop driver must never take the hunt down with it.
            think(huntId, `Continuous loop unavailable (${(err && err.message) || err}) — falling back to turn sessions.`);
          }
          if (!usedLoop) {
            iterResult = await humanIteration(huntId, target, {
              turns: 6,
              findings,
              iteration: i,
              // MODEL-SWITCHER (26 Oct 2026): the loop's brain call
              // goes through callBrain — the selected model answers,
              // and a silent Meta falls back to the 8B automatically.
              // The wrapper has the same (messages, system, ctx)
              // signature as chatWithAI, so the loop is unchanged.
              deps: loopDeps,
            });
          }
        } else {
          iterResult = await agentIteration(huntId, target, recon, findings, i, playbook);
        }
      } catch (err) {
        // DIAG (18 Oct 2026): log the stack's first frames so a recurring
        // ReferenceError (e.g. "reply is not defined") reveals its exact
        // file:line instead of failing silently 8+ iterations in a row.
        const stackHint = err && err.stack ? String(err.stack).split('\n').slice(1, 4).join(' <- ').slice(0, 400) : 'no-stack';
        think(huntId, `Iteration ${i} failed safely: ${err.message || err} :: ${stackHint}`);
      }
      if (iterResult === null || (iterResult && iterResult.aiOk === false)) {
        // CONTINUOUS LOOP (26 Oct 2026): the driver returns its
        // consecutive failed-cycle streak — a dead brain still
        // pauses the hunt after 5 failed calls, exactly as the turn
        // loop does (a run of 5 failed cycles counts 5, not 1).
        // Turn-loop results carry no failStreak and count 1, as before.
        aiFailStreak += (iterResult && Number(iterResult.failStreak)) || 1;
        aiFailKinds.push((iterResult && iterResult.failKind) || 'unknown');
        // Circuit breaker trips at 5 consecutive failures (was 3). The 8B model
        // on 2vCPU is flaky — occasional malformed JSON or slow replies are
        // normal, not a brain outage. 5 still stops a truly dead brain quickly.
        if (aiFailStreak >= 5) {
          // Honest pause reason: report WHAT failed, not a blanket "unreachable".
          // 'ai_no_reply' = brain gave nothing back (timeout/wedge),
          // 'ai_error' = the brain call threw, 'ai_bad_output' = brain replied
          // but produced no usable plan (a model-quality issue, not downtime).
          const kinds = aiFailKinds.slice(-3);
          const topKind = kinds
            .slice()
            .sort((a, b) => kinds.filter((k) => k === b).length - kinds.filter((k) => k === a).length)[0] || 'unknown';
          const pauseReason = `ai_${topKind}`;
          const kindLabels = {
            no_reply: 'AI brain gave no reply',
            error: 'AI brain call threw an error',
            bad_output: 'AI brain replied but produced no usable plan',
            unknown: 'AI brain failed',
          };
          const label = kindLabels[topKind] || kindLabels.unknown;
          think(huntId, `${label} ${aiFailStreak}x in a row — pausing hunt. Resume when it's responsive.`);
          appendHuntEvent(huntId, { type: 'status', state: 'paused', reason: pauseReason, at: new Date().toISOString() });
          try {
            writeHuntMetaCheckpoint(huntId, { state: 'paused', paused: true, pausedReason: pauseReason });
          } catch { /* best-effort */ }
          // Return early — do NOT fall through to "finished". This hunt is
          // paused, not done. Resume will pick up from the checkpoint.
          try {
            await teardownHuntContainer(huntId);
            appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
          } catch { /* ignore */ }
          return;
        }
      } else {
        aiFailStreak = 0;
        aiFailKinds = [];
      }

      // Gentle pacing — don't hammer the target
      await new Promise((r) => setTimeout(r, PACING_DELAY_MS));
    }

    // Final analysis over all findings
    try {
      const analysis = analyzeFindings(findings);
      appendHuntEvent(huntId, { type: 'status', state: 'analysis', summary: analysis });
    } catch { /* ignore */ }

    // Learning: record what worked so future hunts get smarter
    try {
      recordHuntExperience({
        huntId,
        target,
        profile: { type: recon.profile },
        techniques: findings.map((f) => ({ name: f.class || 'unknown', triedAt: new Date().toISOString() })),
        findings,
      });
      think(huntId, 'Hunt experience recorded — future hunts learn from this one.');
    } catch { /* ignore */ }

    think(huntId, `Hunt finished: ${findings.length} findings (${findings.filter((f) => f.verified).length} verified).`);
    appendHuntEvent(huntId, { type: 'status', state: 'finished', findings: findings.length });
    try {
      // Checkpoint writer: if the owner stopped the hunt during the
      // final in-flight iteration, 'stopped' is preserved, not 'finished'.
      writeHuntMetaCheckpoint(huntId, { state: 'finished' });
    } catch { /* meta is best-effort here */ }

    // QUEUE (5 Nov 2026, queue-drain fix): a finished hunt frees its
    // concurrency slot — drainQueue (huntCreator.js, shared with the
    // scanner lane) starts the next queued hunt, if any, in the lane
    // stored on the entry. Best-effort: a drain failure must never
    // break the finished record. (This hunt's meta was checkpointed
    // 'finished' just above, so it no longer counts as running here.)
    try {
      const { drainQueue } = await import('../huntCreator.js');
      await drainQueue();
    } catch (err) {
      console.error('[hunt] queue auto-start check failed:', err.message);
    }
  } catch (err) {
    appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
    try {
      writeHuntMetaCheckpoint(huntId, { state: 'failed' });
    } catch { /* meta is best-effort here */ }
    // QUEUE (5 Nov 2026): a failed hunt frees its slot too — drain,
    // same as on finish. Best-effort.
    try {
      const { drainQueue } = await import('../huntCreator.js');
      await drainQueue();
    } catch { /* best-effort */ }
  } finally {
    // Always clean up the container
    try {
      await teardownHuntContainer(huntId);
      appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
    } catch { /* ignore */ }
  }
}

/**
 * Resume a hunt that was interrupted (backend killed/restarted mid-run).
 * Reads the checkpoint from the hunt's memory folder (meta.json) and the
 * findings from the persisted event log, then continues the agent loop from
 * the next iteration — never from zero.
 *
 * Returns true if a resume was launched, false if there was nothing to resume
 * (hunt already stopped/finished/paused, or no checkpoint).
 */
export async function resumeInterruptedHunt(huntId) {
  const meta = readHuntMeta(huntId);
  if (!meta || meta.state !== 'running') return false;
  // FIX (3 Nov 2026): scanner hunts are driven by runScannerHunt
  // (host-side, no AI loop, no hunt container). The 60s reconciler must
  // NEVER launch the AI loop for them — it spawned stray containers on
  // scanner hunts and killed an external-target scan at egress finalize
  // (fail-closed), whose failure then hid behind "finished, 0 findings".
  if (meta.brainMode === 'scanner') return false;
  // FIX (solver #458): a hunt whose driver is already active is NOT
  // interrupted. The periodic reconciler in server.js calls this for every
  // 'running' meta every 60 s; without this guard each call appended a
  // spurious 'resumed_from_checkpoint' event, launched runAutonomousHunt
  // only for the mutex to refuse it with a think line, and still returned
  // true — so the scan logged a "resumed from checkpoint" success every
  // minute for a hunt that was never interrupted. Returning false here
  // keeps the scan silent for live hunts; a genuinely interrupted hunt
  // (no active loop, dead lock pid, or stale heartbeat) still resumes
  // exactly as before.
  if (isDriverActive(huntId)) return false;
  // Clear stale pause indicators — a resume is an explicit un-pause.
  // If pausedReason is left set, isPaused() returns true (defensive fix)
  // and the loop gets stuck in waitWhilePaused() instead of hunting.
  if (meta.pausedReason || meta.paused) {
    writeHuntMeta(huntId, { ...meta, paused: false, pausedReason: null });
  }
  const { target, mode, userId } = meta;
  if (!target) return false;

  // Rebuild findings from the persisted event log (strip the event wrapper).
  const findings = [];
  try {
    for (const e of readHuntEvents(huntId)) {
      if (e && e.type === 'finding') {
        const { type, cachedAt, ...f } = e;
        findings.push(f);
      }
    }
  } catch { /* findings are best-effort */ }

  const lastIteration = Number(meta.iteration) || 0;
  appendHuntEvent(huntId, {
    type: 'status',
    state: 'resumed_from_checkpoint',
    fromIteration: lastIteration + 1,
    findingsRecovered: findings.length,
    at: new Date().toISOString(),
  });
  // Fire and forget — the loop drives itself from here.
  runAutonomousHunt(huntId, target, mode || 'normal', userId || null, {
    isResume: true,
    startIteration: lastIteration + 1,
    findings,
  }).catch((err) => {
    appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
    try {
      writeHuntMetaCheckpoint(huntId, { state: 'failed' });
    } catch { /* ignore */ }
  });
  return true;
}
