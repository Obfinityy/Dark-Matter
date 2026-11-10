// Split out of hunts.js by the P3 professionalization lane (split-only, no behaviour change).
// Route registrations moved verbatim; hunts.js calls registerCreateRoutes(router) in the same order.

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
import { analyzeFindings, chainsMarkdown, generateLogicTests, getPlaybook, reflectHunt, recordHuntExperience, resolveHuntMode, HUNT_MODES, MODE_ORDER, TIERS } from '../../hunt-intel/index.js';
import { understandTarget } from '../../targetIntel.js';
import { runAutonomousHunt, iterationPriceCents } from '../../huntAgent.js';
import { getBalanceCents } from '../../billing/credits.js';
import { hasActiveAccessById } from '../../access.js';
import { resolveLabCreds } from '../../labCreds.js';
import { engineErrorResponse, mapListHunt, normalizeHuntCreate, pickExistingHunt, requireHuntOwner } from './helpers.js';
import { createLogger } from '../../logger.js';

const log = createLogger('hunts');


export function registerCreateRoutes(router) {
  // Hunt creation requires login (requireAuth) AND the existing authorized-
  // target checks below. Everything else (chat, plugins, reports, health,
  // browsing) stays public.

  router.post('/', requireAuth, async (req, res) => {
    const { target, scope, confirmedAuthorized, mode, forceNew, fresh, labCreds } = req.body || {};
    // brainMode: 'ai' (default) or 'scanner' (rule-based automation, no AI).
    // scanDepth: 'quick' | 'standard' (default) | 'deep' — autonomous hunter
    // only; validated, anything else falls back to 'standard'.
    // scanScope: 'page' (default — pasted page only) | 'site' (/* —
    // recursive same-origin crawl); validated by normalizeHuntCreate.
    // (5 Nov 2026: normalized by normalizeHuntCreate so the rule is
    // unit-tested in one place — see hunts.create.test.js.)
    const { brainMode: reqBrainMode, scanDepth: reqScanDepth, scanScope: reqScanScope } = normalizeHuntCreate(req.body);
    // The AI option stays — the frontend asks "Infinity AI or Infinity Autonomous?".
    log.info(`[hunts] CREATE attempt by ${req.user.username} (${req.user.id}): target=${target}, mode=${mode}, brainMode=${reqBrainMode}, scanDepth=${reqScanDepth}, scanScope=${reqScanScope}, confirmed=${confirmedAuthorized}`);
    if (typeof target !== 'string' || !target.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'missing_target',
        message: 'Provide {target} — a URL or host you are authorized to test.',
      });
    }
    if (confirmedAuthorized !== true) {
      log.warn(`[hunts] REJECTED create: confirmedAuthorized missing for target "${target}"`);
      return res.status(403).json({
        ok: false,
        error: 'authorization_not_confirmed',
        message:
          'Hunt creation requires explicit authorization: send {confirmedAuthorized: true} ' +
          'to confirm you own or are permitted to test this target.',
      });
    }
    // FIX #154: SSRF protection — block private/internal IPs.
    // LAB EXCEPTION: targets listed in LAB_TARGETS (env, comma-separated) are
    // explicitly-authorized local lab targets (e.g. Juice Shop benchmark) and
    // skip the SSRF block. This is opt-in per deployment, not a bypass.
    try {
      const { validateTargetAsync } = await import('../../scopeParser.js');
      const labTargets = (process.env.LAB_TARGETS || '').split(',').map((s) => s.trim()).filter(Boolean);
      const canonicalHost = (value) => {
        try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^\\[|\\]$/g, ''); }
        catch { return ''; }
      };
      const targetHost = canonicalHost(target);
      const isLabTarget = !!targetHost && labTargets.some((lab) => canonicalHost(lab) === targetHost);
      if (!isLabTarget) {
        const ssrfCheck = await validateTargetAsync(target);
        if (!ssrfCheck.valid) {
          log.warn(`[hunts] REJECTED create: SSRF blocked for target "${target}": ${ssrfCheck.reason}`);
          return res.status(403).json({
            ok: false,
            error: 'ssrf_blocked',
            message: ssrfCheck.reason,
          });
        }
      } else {
        log.info(`[hunts] Lab target authorized, SSRF check skipped: "${target}"`);
      }
    } catch (err) {
      log.error('[hunts] SSRF check failed:', err.message);
      // Fail closed on SSRF check error
      return res.status(500).json({
        ok: false,
        error: 'validation_error',
        message: 'Target validation failed. Please try again.',
      });
    }
    // Allowlist REMOVED (15 Oct 2026, owner order): all accounts are manually
    // created by the owner (invite-only, trusted users). The explicit
    // authorization checkbox (confirmedAuthorized) is sufficient — no
    // ALLOWED_TARGETS restriction.
    // Control-level enforcement BEFORE creating anything: minimal users get Normal/Medium only.
    // HUMAN MODE (27 Oct 2026, mode fix): 'human' is a first-class mode,
    // not one of the six intensity modes — resolveHuntMode preserves it
    // (getMode would silently map it to 'normal', so a human-mode hunt
    // could never be created through the API).
    const huntMode = resolveHuntMode(mode);
    const isHumanMode = huntMode.id === 'human';
    const control = req.user.control || 'minimal';
    if (control === 'minimal' && !['normal', 'medium'].includes(huntMode.id)) {
      return res.status(403).json({
        ok: false,
        error: 'control_restricted',
        message: `Mode "${huntMode.id}" requires maximum control. Your admin set your level to minimal.`,
      });
    }
    // Credits gate: non-admin users need balance for at least one iteration.
    // Admins (owner) hunt free, and so does a user inside a paid access
    // window (UPI activation: Rs 10,000 = 1 day, already paid for).
    if (req.user.role !== 'admin' && !hasActiveAccessById(req.user.id)) {
      log.info(`[hunts] Checking credits for ${req.user.username}...`);
      const priceCents = iterationPriceCents(huntMode.id);
      const balanceCents = getBalanceCents(req.user.id);
      log.info(`[hunts] Balance: $${balanceCents / 100}, required: $${priceCents/100}`);
      if (balanceCents < priceCents) {
        return res.status(402).json({
          ok: false,
          error: 'out_of_credits',
          message: 'You are out of hunt credits. Top up your balance to start hunting.',
          priceUsd: priceCents / 100,
        });
      }
    }
    log.info(`[hunts] Credits OK, checking dedupe...`);
    // DEDUPE (owner rule): if this user already hunted this target, redirect to
    // that hunt instead of creating a duplicate — and if it is paused, resume
    // it from its checkpoint. Matching is (user, canonical target, brainMode):
    // an AI hunt and an automation hunt for the same target are different
    // hunts (3 Nov 2026). Target matching is canonical (normalizeTargetKey),
    // so scheme / "www." / trailing-slash variants of a target cannot slip
    // past.
    // { forceNew: true } (the UI's explicit Re-run action) is the only bypass.
    // { fresh: true } (the "Start from scratch" button, 27 Oct 2026) is the
    // same bypass for the budget lane: a brand-new hunt for the same target
    // with a new huntId and fresh memory — the old hunt stays untouched.
    if (forceNew !== true && fresh !== true) {
      try {
        const existing = pickExistingHunt(listHuntMetas(), req.user.id, target, reqBrainMode);
        if (existing) {
          const existingId = existing.huntId || existing.id;
          let state = String(existing.state || existing.status || 'unknown').toLowerCase();
          let resumed = false;
          if (state === 'paused') {
            // Actually resume it — the old code only SAID "Resuming…" while
            // returning a still-paused hunt. Host-side resume mirrors
            // POST /:id/resume: flip the meta flags, then continue the loop
            // from the checkpoint (meta.iteration + 1, findings rebuilt).
            try {
              const m0 = readHuntMeta(existingId) || existing;
              writeHuntMeta(existingId, { ...m0, huntId: existingId, paused: false, stopped: false, state: 'running' });
              appendHuntEvent(existingId, { type: 'status', state: 'resumed', reason: 'dedup_redirect', at: new Date().toISOString() });
              const { resumeInterruptedHunt } = await import('../../huntAgent.js');
              resumeInterruptedHunt(existingId).catch((err) => {
                appendHuntEvent(existingId, { type: 'status', state: 'failed', error: err.message || String(err) });
              });
              state = 'running';
              resumed = true;
            } catch (err) {
              log.warn(`[hunts] dedupe resume failed for ${existingId}: ${err.message}`);
            }
          }
          log.info(`[hunts] REUSE existing hunt ${existingId} for target "${target}" (user ${req.user.username}, state=${state}, resumed=${resumed})`);
          return res.json({
            ok: true,
            reused: true,
            resumed,
            huntId: existingId,
            target: existing.target,
            state,
            message: resumed
              ? 'Resumed your existing hunt for this target from its checkpoint.'
              : 'You already have a hunt for this target — opening it instead of creating a duplicate.',
          });
        }
      } catch (err) {
        log.warn('[hunts] dedupe check failed:', err.message);
      }
    }
    // CONCURRENCY CAP with QUEUE: up to MAX_CONCURRENT_HUNTS hunts (env,
    // default 3 — huntConcurrencyCap in store.js) may run at once; only
    // when the cap is reached does a new request queue instead of starting
    // directly. User gets their queue position. Admin can prioritize from
    // the admin portal.
    // This replaces the original ONE-HUNT-AT-A-TIME rule (24 Oct 2026):
    // several hunts already ran concurrently in practice (boot-resume
    // restarts every 'running' hunt — the lab benchmark hunt and the
    // real-target Ezviz hunt run side by side for days), and since hunts
    // are unlimited by design, a one-at-a-time queue never drained — a new
    // lab hunt (DVWA) queued forever behind the running Ezviz hunt.
    // PAUSED hunts do NOT block creation (20 Oct 2026): a paused hunt is
    // dormant by the owner's explicit order and stays paused until the
    // owner resumes it — counting it as "active" here made every new
    // target queue forever behind hunts nobody intended to run (the
    // paused thebhavesh.online and benchmark hunts blocked the owner's
    // first real-target hunt, Ezviz, from ever starting).
    try {
      const { listHuntMetas, enqueueHunt, huntQueueFull } = await import('../../store.js');
      const metas = listHuntMetas();
      if (huntQueueFull(metas)) {
        const active = metas.find((h) => h.state === 'running');
        // QUEUE LANE (5 Nov 2026, queue-drain fix): the entry must carry
        // brainMode + scanDepth, or a drained scanner re-run restarts in
        // the wrong lane. Before this fix only {userId, username, target,
        // scope, mode} were stored.
        const { queueId, position, total } = enqueueHunt({
          userId: req.user.id,
          username: req.user.username,
          target: target.trim(),
          scope: scope || null,
          mode: huntMode.id,
          brainMode: reqBrainMode,
          scanDepth: reqScanDepth,
          scanScope: reqScanScope,
        });
        // FIX (#335): the running hunt's id/target used to leak to any
        // user whose hunt queued behind it. Only the owner (or an admin)
        // sees them; other queuers just learn their place in line.
        const activeIsMine = active && (active.userId === req.user.id || req.user.role === 'admin');
        return res.status(202).json({
          ok: true,
          queued: true,
          queueId,
          position,
          totalInQueue: total,
          message: `Hunt queued. You are #${position} in line. The hunt will start automatically when a running hunt finishes.`,
          ...(activeIsMine ? { activeHuntId: active.huntId, activeTarget: active.target } : {}),
        });
      }
    } catch (err) {
      log.error('[hunts] queue check failed:', err.message);
      /* fall through to direct creation on queue failure */
    }
    try {
      let huntId;
      log.info(`[hunts] Creating engine hunt for target "${target}"...`);
      try {
        ({ huntId } = await createEngineHunt(target, scope));
        log.info(`[hunts] Engine hunt created: ${huntId}`);
      } catch (err) {
        if (!(err instanceof EngineUnreachableError)) throw err;
        // No PentAGI engine on this box — the host agent loop (runAutonomousHunt)
        // is the real hunter, so mint a local hunt id and run fully host-side.
        const { randomBytes } = await import('node:crypto');
        huntId = 'h_' + randomBytes(6).toString('hex');
        log.warn(`[hunts] engine unreachable — hunt ${huntId} runs host-side only`);
      }
      // Parse scope: agent auto-understands what's in/out of scope, program rules,
      // custom User-Agent, etc. This is how it hunts like a human who read the brief.
      const { parseScope } = await import('../../scopeParser.js');
      const parsedScope = parseScope(target, scope);
      log.info(`[hunts] Scope parsed for ${huntId}: UA=${parsedScope.rules.customUserAgent || 'default'}, noHeavyScan=${parsedScope.rules.noHeavyScan}`);
      // P1 SCOPE ENFORCEMENT (31 Oct 2026, AUD-H1): immutable per-hunt scope
      // for the app-layer guard (scopeGuard.js) and P2's network-layer egress
      // control. FAIL-CLOSED (#339): a build failure used to store
      // scopeGuard: null and the hunt proceeded — the network layer then
      // took the legacy unisolated path (no scope = no egress rules) and
      // the app layer's execution-time rebuild would fail the same way.
      // A hunt that cannot build its scope is not created at all.
      let scopeGuard;
      try {
        const { buildScope } = await import('../../scopeGuard.js');
        scopeGuard = buildScope({ target, scope, labTargets: process.env.LAB_TARGETS || '' });
      } catch (err) {
        // Best-effort: don't orphan an engine-side hunt we just created.
        try { await stopEngineHunt(huntId); } catch { /* engine unreachable: host-side id, nothing to clean */ }
        return res.status(500).json({
          ok: false,
          error: 'scope_build_failed',
          message: `Hunt not created: scope guard could not be built (${err.message}). Fix the scope configuration and retry.`,
        });
      }
      writeHuntMeta(huntId, {
        huntId,
        target,
        scope: scope || null,
        parsedScope,
        scopeGuard,
        mode: huntMode.id,
        // Brain mode: 'ai' (default) or 'scanner' (rule-based automation).
        // The frontend asks "Infinity AI or Infinity Autonomous?" at hunt
        // creation. scanDepth ('quick' | 'standard' | 'deep') applies to the
        // autonomous hunter only.
        brainMode: reqBrainMode,
        scanDepth: reqScanDepth,
        // SCAN SCOPE (9 Nov 2026, /* owner order): stored on the meta
        // so the panel, the report and Re-run can see whether this
        // hunt crawled one page or the whole site.
        scanScope: reqScanScope,
        // HUMAN MODE: flag both keys the human path checks
        // (huntAgent.js: meta.humanMode === true || mode/meta.mode ===
        // 'human'), matching drive-human.mjs + the lab scripts.
        ...(isHumanMode ? { humanMode: true } : {}),
        userId: req.user.id,
        createdAt: new Date().toISOString(),
        authorized: true,
      });
      appendHuntEvent(huntId, { type: 'status', state: 'created', target, mode: huntMode.id });
      // HUMAN LOOP (27 Oct 2026, mode fix): a human-mode hunt runs the
      // continuous loop driver — enable its loop state at creation so
      // the driver starts with an explicit record (mirrors what resumed
      // human hunts carry). Best-effort: a loop-state failure must never
      // break hunt creation; the driver also defaults to enabled.
      if (isHumanMode) {
        try {
          const { startHumanLoop } = await import('../../humanLoopDriver.js');
          startHumanLoop(huntId);
        } catch (err) {
          log.warn(`[hunts] could not enable human loop for ${huntId}: ${err.message}`);
        }
      }
      // AI understands the target first (async, non-blocking): tech stack,
      // endpoints, forms — becomes hunt context for the engine + chat.
      understandTarget(huntId, target).catch(() => {});
      if (reqBrainMode === 'scanner') {
        // RULE-BASED AUTOMATION (3 Nov 2026): no AI loop — run the predefined
        // scanner battery (fingerprint → probes → verifier) and record
        // findings as hunt events. $0 AI spend, results in seconds/minutes.
        const { runScannerHunt } = await import('../../scannerHunt.js');
        // LAB-CANARY CREDS (#474): forwarded ONLY for an admin hunting a
        // lab target — resolveLabCreds drops everything else silently
        // (non-admin, non-lab target, or malformed creds -> no creds).
        const gatedLabCreds = resolveLabCreds({
          role: req.user.role,
          target,
          labCreds,
          labTargets: process.env.LAB_TARGETS || '',
        });
        runScannerHunt(huntId, target, {
          scope, userId: req.user.id, scanDepth: reqScanDepth, scanScope: reqScanScope,
          ...(gatedLabCreds ? { labCreds: gatedLabCreds } : {}),
        }).catch((err) => {
          appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
        });
      } else {
        // Launch the autonomous hunt agent (non-blocking): spawns the isolated
        // container, runs recon → Bedrock agent loop → verify → chain → teardown.
        // The user can close the browser; the hunt continues on the backend.
        runAutonomousHunt(huntId, target, huntMode.id, req.user.id).catch((err) => {
          appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
        });
      }
      res.status(201).json({ ok: true, huntId, brainMode: reqBrainMode, scanDepth: reqScanDepth, scanScope: reqScanScope, ...(fresh === true ? { fresh: true } : {}) });
    } catch (err) {
      engineErrorResponse(res, err);
    }
  });
}
