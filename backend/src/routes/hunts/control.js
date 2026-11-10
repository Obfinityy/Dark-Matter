// Split out of hunts.js by the P3 professionalization lane (split-only, no behaviour change).
// Route registrations moved verbatim; hunts.js calls registerControlRoutes(router) in the same order.

import {
  EngineUnreachableError,
  EngineError,
  createEngineHunt,
  getEngineHunt,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../../engine.js';
import {
  appendHuntEvent,
  readHuntBehaviour,
  readHuntEvents,
  writeHuntMeta,
  writeHuntMetaCheckpoint,
  readHuntMeta,
  listHuntMetas,
} from '../../store.js';
import { requireAuth, issueTerminalTicket, issueControlTicket } from '../auth.js';
import {
  takeControl,
  releaseControl,
  getControl,
  startControlDesktop,
  stopControlDesktop,
} from '../../machineControl.js';
import { analyzeFindings, chainsMarkdown, generateLogicTests, getPlaybook, reflectHunt, recordHuntExperience, resolveHuntMode, HUNT_MODES, MODE_ORDER, TIERS } from '../../hunt-intel/index.js';
import { getHuntCost, getUserCosts } from '../../costTracker.js';
import { recordRecall, completeProcess, readMemoryFile, readProcessFile, readOutputFile } from '../../brainFiles.js';
import { parseBudgetUsd } from '../../budgetCap.js';
import { runAutonomousHunt, iterationPriceCents } from '../../huntAgent.js';
import { getBalanceCents } from '../../billing/credits.js';
import { hasActiveAccessById } from '../../access.js';
import { teardownHuntContainer, huntDesktopScreenshot } from '../../huntRunner.js';
import { listBrainModels, getBrainState, setBrainModel, metaAvailable } from '../../brainProvider.js';
import { getBrainMode, setBrainMode, listBrainActions, outputByHash, deriveProcessState, executeBrainAction } from '../../brainMode.js';
import { validateBrainReply, brainReplyToAction } from '../../brainReply.js';
import { recallByHash, recallById, formatFullRecord } from '../../actionIndex.js';
import { getAllReasoning } from '../../reasoningMemory.js';
import { listDetailRequests, submitDetailRequest, cancelDetailRequest, getDetailRequest } from '../../userDetails.js';
import { engineErrorResponse, mapListHunt, normalizeHuntCreate, pickExistingHunt, requireHuntOwner } from './helpers.js';
import { createLogger } from '../../logger.js';

const log = createLogger('hunts');


export function registerControlRoutes(router) {
  router.get('/:id', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    try {
      const data = await getEngineHunt(req.params.id);
      res.json({ ok: true, hunt: data });
    } catch (err) {
      if (err instanceof EngineUnreachableError) {
        // Host-side hunt: serve the cached meta + live event tail.
        return res.json({ ok: true, hunt: { ...meta, hostSide: true } });
      }
      engineErrorResponse(res, err);
    }
  });

  // DELETE /api/v1/hunts/:id — Remove hunt container (31 Oct 2026, Phase 3)
  // Removes the Docker container for a hunt. PRESERVES the hunt data directory
  // (/opt/Dark-Matter/backend/data/hunts/<id>/) — never delete hunt data.
  // Used for resource cleanup of paused/completed hunts.

  router.delete('/:id', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    try {
      const removed = await teardownHuntContainer(huntId);
      // Note: hunt data directory is intentionally preserved.
      // The owner order (31 Oct 14:31 IST) says: NEVER delete hunt data dirs.
      res.json({
        ok: true,
        huntId,
        containerRemoved: removed,
        dataPreserved: true,
        message: removed
          ? 'Container removed; hunt data preserved.'
          : 'Container was not running; hunt data preserved.',
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to remove container',
        detail: err.message,
      });
    }
  });

  for (const [route, fn, verb] of [
    ['pause', pauseEngineHunt, 'paused'],
    ['resume', resumeEngineHunt, 'resumed'],
    ['stop', stopEngineHunt, 'stopped'],
  ]) {
    router.post(`/:id/${route}`, requireAuth, async (req, res) => {
      const huntId = req.params.id;
      const meta = requireHuntOwner(req, res);
      if (!meta) return;
      // Wallet resume: a hunt paused for out_of_credits restarts its agent loop
      // directly (the loop already tore down its container when it paused).
      if (route === 'resume' && meta.state === 'out_of_credits') {
        const priceCents = iterationPriceCents(meta.mode || 'normal');
        const canPay = req.user.role === 'admin' || hasActiveAccessById(req.user.id) || getBalanceCents(req.user.id) >= priceCents;
        if (!canPay) {
          return res.status(402).json({
            ok: false,
            error: 'out_of_credits',
            message: 'Top up your balance to resume this hunt.',
          });
        }
        writeHuntMeta(huntId, { ...meta, state: 'running', paused: false, stopped: false });
        appendHuntEvent(huntId, { type: 'status', state: 'resumed', reason: 'topped_up', at: new Date().toISOString() });
        runAutonomousHunt(huntId, meta.target, meta.mode || 'normal', req.user.id).catch((err) => {
          appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
        });
        return res.json({ ok: true, action: 'resume', huntId });
      }
      try {
        let data;
        try {
          data = await fn(huntId);
        } catch (err) {
          // No engine on this box: EngineUnreachableError (fetch failed) OR
          // EngineError 409 ("no checkpoint") — resumeEngineHunt swallows the
          // unreachable error via .catch(() => null) and then throws 409
          // because the engine never tracked this host-side hunt. Both mean:
          // drive the hunt via meta flags, which the agent loop honors.
          const noEngine =
            err instanceof EngineUnreachableError || err instanceof EngineError;
          if (!noEngine) throw err;
          const m0 = readHuntMeta(huntId) || {};
          if (route === 'pause') {
            writeHuntMeta(huntId, { ...m0, paused: true, state: 'paused', pausedReason: 'user_paused' });
            appendHuntEvent(huntId, { type: 'status', state: 'paused', reason: 'user_paused', at: new Date().toISOString() });
            return res.json({ ok: true, action: 'pause', huntId, hostSide: true });
          }
          if (route === 'resume') {
            if (['stopped', 'finished', 'failed'].includes(m0.state)) {
              return res.status(409).json({ ok: false, error: 'hunt_terminal', message: `Hunt is ${m0.state}; cannot resume.` });
            }
            writeHuntMeta(huntId, { ...m0, paused: false, stopped: false, state: 'running' });
            appendHuntEvent(huntId, { type: 'status', state: 'resumed', at: new Date().toISOString() });
            // Actually restart the agent loop — the paused loop tore down its
            // container, so flipping flags alone leaves a "running" hunt that
            // does nothing. Resume from checkpoint via resumeInterruptedHunt,
            // which continues from meta.iteration + 1 and rebuilds findings
            // from the event log. (Calling runAutonomousHunt with only
            // {isResume:true} would silently reset the iteration counter to 1.)
            const { resumeInterruptedHunt } = await import('../../huntAgent.js');
            resumeInterruptedHunt(huntId).catch((err) => {
              appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
            });
            return res.json({ ok: true, action: 'resume', huntId, hostSide: true });
          }
          // stop: mark stopped (agent loop checks this) and destroy container.
          writeHuntMeta(huntId, { ...m0, stopped: true, paused: false, state: 'stopped' });
          appendHuntEvent(huntId, { type: 'status', state: 'stopped', at: new Date().toISOString() });
          teardownHuntContainer(huntId).then((torn) => {
            if (torn) appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
          }).catch(() => {});
          return res.json({ ok: true, action: 'stop', huntId, hostSide: true });
        }
        // resume-via-recreate returns a NEW hunt id (a stopped flow can never be
        // resumed in place) — report the new id so the client follows it.
        const effectiveId =
          data && typeof data.huntId === 'string' && data.huntId !== huntId ? data.huntId : huntId;
        appendHuntEvent(huntId, {
          type: 'status',
          state: verb,
          at: new Date().toISOString(),
          ...(effectiveId !== huntId ? { newHuntId: effectiveId } : {}),
        });
        // On terminal stop, mark stopped (agent loop checks this) and destroy
        // the hunt's isolated container.
        if (route === 'stop') {
          try {
            const m = readHuntMeta(huntId) || {};
            writeHuntMeta(huntId, { ...m, stopped: true, state: 'stopped' });
          } catch { /* ignore */ }
          teardownHuntContainer(huntId).then((torn) => {
            if (torn) appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
          }).catch(() => {});
        }
        if (effectiveId !== huntId) {
          appendHuntEvent(effectiveId, {
            type: 'status',
            state: 'created',
            resumedFrom: huntId,
            at: new Date().toISOString(),
          });
        }
        res.json({ ok: true, action: route, huntId: effectiveId, engine: data ?? null });
      } catch (err) {
        engineErrorResponse(res, err);
      }
    });
  }

  // ---- Steer: talk to the brain mid-hunt --------------------------------------
  // POST /api/v1/hunts/:id/steer { message } — inject a user instruction.
  // The agent picks it up at the start of its next iteration and the message
  // is stored in the hunt's event log so it syncs across devices.

  router.post('/:id/steer', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const message = String((req.body && req.body.message) || '').trim().slice(0, 2000);
    if (!message) return res.status(400).json({ ok: false, error: 'message required' });
    const huntId = req.params.id;
    try {
      const { appendHuntEvent, readHuntMeta, writeHuntMeta } = await import('../../store.js');
      appendHuntEvent(huntId, { type: 'steer', from: req.user.username || req.user.id, message, at: new Date().toISOString() });
      const m = readHuntMeta(huntId) || {};
      const queue = Array.isArray(m.steerQueue) ? m.steerQueue : [];
      queue.push({ message, from: req.user.username || req.user.id, at: new Date().toISOString() });
      writeHuntMeta(huntId, { ...m, huntId, steerQueue: queue.slice(-10) });
      res.json({ ok: true, queued: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---- Dynamic details requests (27 Oct 2026, owner order) ------------------
  // The agent asks the owner for details it needs (a login, an OTP, any
  // field) instead of creating its own account. The frontend shows one
  // "Enter details to go forward" card below the chat for a pending request.
  // SECURITY: responses carry the PUBLIC form only — values NEVER leave the
  // server-side vault (user-details.json). The recorded events carry the
  // request title + field KEYS only, never values.

  router.get('/:id/detail-requests', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    res.json({ ok: true, huntId: req.params.id, requests: listDetailRequests(req.params.id) });
  });

  router.post('/:id/detail-requests/:requestId/submit', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const rec = getDetailRequest(req.params.requestId);
    if (!rec || rec.huntId !== huntId) return res.status(404).json({ ok: false, error: 'request_not_found' });
    const values = (req.body && req.body.values) || {};
    const result = submitDetailRequest(req.params.requestId, values);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    // Event carries title + field keys ONLY — never values.
    appendHuntEvent(huntId, {
      type: 'details_filled',
      requestId: rec.id,
      title: rec.title,
      fields: (rec.fields || []).map((f) => f.key),
      at: new Date().toISOString(),
    });
    res.json({ ok: true, request: result.request });
  });

  router.post('/:id/detail-requests/:requestId/cancel', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const rec = getDetailRequest(req.params.requestId);
    if (!rec || rec.huntId !== huntId) return res.status(404).json({ ok: false, error: 'request_not_found' });
    const result = cancelDetailRequest(req.params.requestId);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    appendHuntEvent(huntId, {
      type: 'details_cancelled',
      requestId: rec.id,
      title: rec.title,
      at: new Date().toISOString(),
    });
    res.json({ ok: true, request: result.request });
  });

  // ---- Take Control of This Machine: owner drives the hunt desktop -----
  // The owner takes over the hunt container's Kali desktop himself
  // (full mouse + keyboard via the noVNC channel), while the agent's
  // GUI/browser actions pause for the duration so the two drivers never
  // fight over the same screen. The hunt itself is NOT paused or
  // stopped. Done / Cancel / WS close / expiry all release the lock and
  // the agent's GUI actions resume on its next turn.
  //
  //   POST /api/v1/hunts/:id/control/take    -> take the lock + start the
  //        interactive VNC (409 already_controlled, 503 control_unavailable)
  //   POST /api/v1/hunts/:id/control/release -> release the lock + stop the
  //        interactive VNC (409 not_controlled, 403 not_holder)
  //   GET  /api/v1/hunts/:id/control         -> current lock state
  //   GET  /api/v1/hunts/:id/control/ticket  -> 60s WS ticket, only while
  //        the caller holds the lock
  // Auth: JWT (requireAuth) + hunt ownership (requireHuntOwner).

  router.post('/:id/control/take', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    if (!['running', 'paused'].includes(meta.state)) {
      return res.status(400).json({ ok: false, error: 'hunt_not_active' });
    }
    const user = { id: req.user.id || req.user.sub, username: req.user.username, role: req.user.role, control: req.user.control };
    const taken = takeControl(req.params.id, user);
    if (!taken.ok) {
      if (taken.error === 'control_restricted') {
        log.warn(`[control] take DENIED hunt=${req.params.id} user=${user.username} error=control_restricted`);
        return res.status(403).json({ ok: false, error: 'control_restricted', message: 'Taking control of a machine requires maximum control. Your admin set your level to minimal.' });
      }
      log.warn(`[control] take DENIED hunt=${req.params.id} user=${user.username} error=already_controlled holder=${taken.holder}`);
      return res.status(409).json({ ok: false, error: 'already_controlled', holder: taken.holder });
    }
    const started = await startControlDesktop(req.params.id);
    if (!started.ok) {
      // Honest failure: the lock is freed again so a retry is possible,
      // and the frontend shows the real reason instead of a fake control.
      log.warn(`[control] take FAILED hunt=${req.params.id} user=${user.username} error=${started.error} (lock freed)`);
      releaseControl(req.params.id, user);
      return res.status(503).json({ ok: false, error: 'control_unavailable', detail: started.error });
    }
    log.info(`[control] take OK hunt=${req.params.id} user=${user.username} vncAlreadyRunning=${Boolean(started.alreadyRunning)}`);
    // WRONG-PAGE GUARD (fix 6): Take Control sessions are hunt events
    // now, not just journal lines — the loop's history and the
    // monitors can see them. Best-effort: a failed write must never
    // fail a take that already succeeded.
    try { appendHuntEvent(req.params.id, { type: 'control_take', username: user.username, at: new Date().toISOString() }); } catch { /* best-effort */ }
    return res.json({
      ok: true,
      controlled: true,
      holder: taken.lock.username,
      takenAt: taken.lock.takenAt,
    });
  });

  router.post('/:id/control/release', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const user = { id: req.user.id || req.user.sub, username: req.user.username, role: req.user.role };
    const rel = releaseControl(req.params.id, user);
    if (!rel.ok) {
      log.warn(`[control] release DENIED hunt=${req.params.id} user=${user.username} error=${rel.error}`);
      const status = rel.error === 'not_controlled' ? 409 : 403;
      return res.status(status).json({ ok: false, error: rel.error });
    }
    log.info(`[control] release OK hunt=${req.params.id} user=${user.username}`);
    // WRONG-PAGE GUARD (fix 6): see the take handler above. Only the
    // route records the event — the WS-close release in server.js
    // must NOT, or every normal Done would double-record (Done calls
    // this route, then the WS closes).
    try { appendHuntEvent(req.params.id, { type: 'control_release', username: user.username, at: new Date().toISOString() }); } catch { /* best-effort */ }
    // Best-effort: the interactive VNC dies with the release even if
    // the container is already gone.
    await stopControlDesktop(req.params.id);
    return res.json({ ok: true, controlled: false });
  });

  router.get('/:id/control', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const lock = getControl(req.params.id);
    if (!lock) return res.json({ ok: true, controlled: false });
    return res.json({
      ok: true,
      controlled: true,
      holder: lock.username,
      takenAt: lock.takenAt,
    });
  });

  router.get('/:id/control/ticket', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    if (!['running', 'paused'].includes(meta.state)) {
      return res.status(400).json({ ok: false, error: 'hunt_not_active' });
    }
    const lock = getControl(req.params.id);
    const userId = String(req.user.id || req.user.sub || '');
    if (!lock || (lock.userId !== userId && req.user.role !== 'admin')) {
      // LANE AN (25 Oct 2026): this denial is the signature of the
      // take/ticket race — the frontend used to fetch the ticket while
      // the take POST was still in flight, so the lock was not held yet
      // and the first attempt failed with "Could not open the control
      // channel". Log it so a recurrence is visible in the journal.
      log.warn(`[control] ticket DENIED hunt=${req.params.id} user=${req.user.username} lockHeld=${Boolean(lock)}`);
      return res.status(403).json({ ok: false, error: 'not_controlling' });
    }
    const ticket = issueControlTicket(req.user.id || req.user.sub, req.user.username, req.params.id);
    return res.json({ ok: true, ticket });
  });

  // ---- Brain switcher (MODEL-SWITCHER, 26 Oct 2026) ----------------------
  // The hunt's brain, selectable per hunt at runtime, mid-hunt:
  // Dark Matter V1 (local 8B, default) or a Meta text model. Switching
  // is seamless by construction — the loop rebuilds its prompt from
  // live state + history + memory on every turn, so the new brain
  // picks up with everything the old one knew; memory never changes.
  // A switch to a Meta model is refused while no META_API_KEY is
  // configured. The automatic fallback (Meta silent -> 8B) lives in
  // brainProvider.callBrain and records `model_switch` events here
  // in the same event stream the activity feed reads.

  router.get('/:id/brain', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const state = getBrainState(req.params.id);
    return res.json({ ok: true, brain: { ...state, models: listBrainModels(), metaAvailable: metaAvailable() } });
  });

  router.post('/:id/brain', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const model = String((req.body && req.body.model) || '').trim();
    const result = setBrainModel(req.params.id, model, { manual: true });
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error,
        message: result.error === 'meta_unavailable'
          ? 'That Meta model is not available right now — the Meta API key is not configured on the backend (or the card verification is still pending). The hunt stays on Dark Matter V1.'
          : result.error === 'openrouter_unavailable'
            ? 'That OpenRouter model is not available right now — the OpenRouter API key is not configured on the backend. The hunt stays on Dark Matter V1.'
            : 'Unknown brain model.',
      });
    }
    return res.json({ ok: true, brain: result.brain });
  });

  // ---- Be a Brain (28 Oct 2026, owner order) ------------------------------
  // The owner IS the brain: POST /:id/brain-mode {mode:'parent'} pauses
  // the AI loop (via the existing pause machinery) and the parent
  // submits the next action himself; {mode:'ai'} hands the brain back
  // and resumes the AI loop from the checkpoint (existing resume
  // machinery). While the parent is the brain the hunt stays paused,
  // so the AI loop can never interleave with the parent's actions.
  //   GET  /:id/brain-mode        -> { ok, brainMode, state }
  //   GET  /:id/actions           -> the hunt's action index (hash + label + status)
  //   GET  /:id/output/:hash      -> the stored output for that action hash
  //   GET  /:id/process           -> live process state (task/goal/progress, done/pending)
  //   POST /:id/brain-action {action} -> execute one parent action
  // All owner-only (requireAuth + requireHuntOwner), like the brain route.

  router.get('/:id/brain-mode', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    res.json({ ok: true, brainMode: getBrainMode(meta), state: meta.state || null });
  });

  router.post('/:id/brain-mode', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const result = await setBrainMode(req.params.id, (req.body && req.body.mode) || '');
    if (!result.ok) {
      const status = result.error === 'hunt_not_found' ? 404 : result.error === 'hunt_terminal' ? 409 : 400;
      return res.status(status).json({ ok: false, error: result.error, ...(result.message ? { message: result.message } : {}), ...(result.state ? { state: result.state } : {}) });
    }
    res.json({ ok: true, brainMode: result.brainMode, state: result.state });
  });

  router.get('/:id/actions', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const events = readHuntEvents(huntId);
    const reasoningRows = getAllReasoning(huntId);
    const huntRunning = meta.state === 'running' && meta.paused !== true;
    res.json({ ok: true, huntId, brainMode: getBrainMode(meta), actions: listBrainActions(events, reasoningRows, { huntRunning }) });
  });

  router.get('/:id/output/:hash', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const result = outputByHash(readHuntEvents(huntId), getAllReasoning(huntId), req.params.hash);
    if (!result.ok) return res.status(404).json({ ok: false, error: 'unknown_hash', message: result.message });
    res.json(result);
  });

  // ---- Brain files: the three files the brain is told every turn ----
  // GET /:id/brain-files -> { memory: {entries}, process: {...}, outputs: <count> }
  // The OUTPUT file's VALUES are never listed here — one result at a time,
  // by hash, through GET /:id/output/:hash. Owner-only, like /process.

  router.get('/:id/brain-files', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const memory = readMemoryFile(huntId);
    const process = readProcessFile(huntId);
    const outputs = readOutputFile(huntId);
    res.json({ ok: true, huntId, memory, process, outputs: Object.keys(outputs.byHash || {}).length });
  });

  router.get('/:id/process', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    res.json(deriveProcessState(huntId, {
      meta,
      events: readHuntEvents(huntId),
      reasoningRows: getAllReasoning(huntId),
    }));
  });

  router.post('/:id/brain-action', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    if (getBrainMode(meta) !== 'parent') {
      return res.status(409).json({
        ok: false,
        error: 'brain_mode_ai',
        message: 'The AI is the brain right now — switch to parent mode (POST /:id/brain-mode {mode:"parent"}) before submitting an action.',
      });
    }
    const result = await executeBrainAction(huntId, (req.body && req.body.action) || req.body || {});
    if (!result.ok) {
      const status = result.error === 'out_of_scope' ? 403 : result.error === 'claim_incomplete' ? 422 : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  });

  // ---- Be a Brain, as JSON (brain-json lane, 28 Oct 2026) ------------------
  // POST /:id/brain-action-json {reply} — the SAME parent action as
  // POST /:id/brain-action, but as one structured JSON reply:
  //   {reply: {task, goal, progress, recall?, action: {type, ...}}}
  // (contract: backend/src/brainReply.schema.json, enforced by
  // backend/src/brainReply.js — the reply carries titles/hashes only,
  // never full memory.) The flow, in order:
  //   1. validate the reply's shape (400 invalid_reply, naming the
  //      bad field, when it fails — nothing executes);
  //   2. if `recall` is present, fetch that past action FIRST (its
  //      full stored record is returned as `recalled`; an unknown
  //      hash/id is 404 unknown_hash and nothing executes);
  //   3. dispatch the action through the EXISTING executeBrainAction
  //      — the same guards as the form composer (scope, claim
  //      completeness gate, pipeline verifier, 404 error-page
  //      protection), nothing bypassed or weakened;
  //   4. a JSON reply IS one finished step: once its action completes,
  //      the reply's task/goal/progress is recorded as task_complete
  //      (and the persisted block flips to complete), so the live
  //      process view shows the step done. A refused step is already
  //      recorded failed by executeBrainAction itself.
  // The response is the brain-action shape {ok, hash, output, entry}
  // (+ verified/finding for claims, + recalled when recall was used).
  // 409 brain_mode_ai while the AI is the brain, like brain-action.

  router.post('/:id/brain-action-json', requireAuth, async (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    if (getBrainMode(meta) !== 'parent') {
      return res.status(409).json({
        ok: false,
        error: 'brain_mode_ai',
        message: 'The AI is the brain right now — switch to parent mode (POST /:id/brain-mode {mode:"parent"}) before submitting an action.',
      });
    }
    const reply = (req.body && req.body.reply) || null;
    const validation = validateBrainReply(reply);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: 'invalid_reply', errors: validation.errors });
    }
    let recalled = null;
    if (reply.recall) {
      // RECALL WITH A REASON (28 Oct 2026, owner order): the brain says
      // WHY it needs the data — recorded in the process file (data
      // requested, data given, why) whether the recall hits or misses.
      const reason = typeof reply.recall.reason === 'string' ? reply.recall.reason : '';
      const rec = reply.recall.hash
        ? recallByHash(readHuntEvents(huntId), getAllReasoning(huntId), reply.recall.hash)
        : recallById(readHuntEvents(huntId), getAllReasoning(huntId), reply.recall.id);
      if (!rec || rec.error) {
        try { recordRecall(huntId, { hash: reply.recall.hash || '', id: reply.recall.id ?? null, reason, found: false }); } catch { /* best-effort */ }
        return res.status(404).json({ ok: false, error: 'unknown_hash', message: String((rec && rec.error) || 'nothing recalled') });
      }
      recalled = { hash: rec.entry.hash, id: rec.entry.n, output: formatFullRecord(rec) };
      try { recordRecall(huntId, { hash: rec.entry.hash, id: rec.entry.n, reason, found: true, title: rec.entry.label || rec.entry.title || '' }); } catch { /* best-effort */ }
    }
    const dispatched = brainReplyToAction(reply);
    const result = await executeBrainAction(huntId, dispatched.action);
    if (!result.ok) {
      const status = result.error === 'out_of_scope' ? 403 : result.error === 'claim_incomplete' ? 422 : 400;
      return res.status(status).json({ ...result, ...(recalled ? { recalled } : {}) });
    }
    // The reply's step is done: record it complete, with the same
    // task/goal/progress the reply carried, so GET /:id/process shows
    // this step as done (not still running, and not forgotten).
    try {
      appendHuntEvent(huntId, {
        type: 'task_complete', task: reply.task, goal: reply.goal, progress: reply.progress,
        summary: (result.entry && result.entry.label) || dispatched.action.action || '', via: 'brain-json',
      });
      writeHuntMetaCheckpoint(huntId, {
        currentTask: { task: reply.task, goal: reply.goal, progress: reply.progress, status: 'complete', updatedAt: new Date().toISOString() },
      });
      // BRAIN FILES: the JSON reply's step is done — its process closes
      // (in_process false) and its title + hash land in the memory file.
      try { completeProcess(huntId, { title: reply.task, hash: result.hash }); } catch { /* best-effort */ }
    } catch { /* process recording is best-effort */ }
    res.json({ ...result, ...(recalled ? { recalled } : {}) });
  });

  // ---- Per-hunt spend budget (27 Oct 2026, owner order) --------------------
  // POST /:id/budget {budgetUsd} — set the spend cap for this hunt;
  // null/0 clears it. At the cap the hunt auto-PAUSES (checkpoint,
  // resume from here) — it never stops and never restarts from scratch.
  // FIX (#337): raising/clearing the budget used to erase pausedReason
  // while the hunt stayed paused — the UI lost WHY it paused, and the
  // pause record vanished before any resume. The reason now survives
  // until a real resume clears it (resumeHuntResilient: "a resume is
  // an explicit un-pause"). Raising the budget does NOT resume the
  // hunt: resume stays an explicit POST /:id/resume, which runs the
  // engine/wallet checks an auto-resume here would bypass.

  router.post('/:id/budget', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const huntId = req.params.id;
    const parsed = parseBudgetUsd((req.body || {}).budgetUsd);
    if (!parsed.ok) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_budget',
        message: 'budgetUsd must be a number between 0 and 10000, or null to clear it.',
      });
    }
    const budgetUsd = parsed.budgetUsd;
    const spentUsd = getHuntCost(huntId).totalUsd || 0;
    const next = { ...meta, huntId, budgetUsd };
    writeHuntMeta(huntId, next);
    appendHuntEvent(huntId, { type: 'status', state: 'budget_set', budgetUsd, spentUsd, at: new Date().toISOString() });
    res.json({ ok: true, huntId, budgetUsd, spentUsd });
  });

  // ---- Learning loop: record + reflect + playbook ----------------------------
  // POST /:id/reflect — distill this hunt's lessons into the playbook.
  // GET /playbook — lessons for a target profile (before planning a hunt).

  router.post('/:id/reflect', requireAuth, (req, res) => {
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    const events = readHuntEvents(req.params.id);
    const findings = events.filter((e) => e.type === 'finding');
    const techniques = [...new Set(events.filter((e) => e.type === 'tool_call').map((e) => e.tool || e.name || 'unknown'))]
      .map((name) => ({ name }));
    recordHuntExperience({
      huntId: req.params.id,
      target: meta.target,
      profile: { appType: req.body && req.body.appType, stack: req.body && req.body.stack },
      techniques,
      findings,
    });
    const lessons = reflectHunt(req.params.id);
    res.json({ ok: true, huntId: req.params.id, lessons: lessons || [] });
  });
}
