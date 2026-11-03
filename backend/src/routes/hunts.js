// Hunt routes — authorized-targets-only creation, engine proxying, reports.
//
//   POST /api/v1/hunts {target, scope, confirmedAuthorized}
//   GET  /api/v1/hunts                    -> the user's hunts (re-attach after browser close)
//   POST /api/v1/hunts/:id/pause | /resume | /stop
//   POST /api/v1/hunts/:id/budget {budgetUsd} — per-hunt spend cap (auto-pause)
//   POST /api/v1/hunts {fresh:true} — brand-new hunt for a hunted target
//   GET  /api/v1/hunts/:id               -> engine status (502 if engine down)
//   GET  /api/v1/hunts/:id/report?format=md|pdf  (works any time, even mid-hunt)
//   GET  /api/v1/hunts/:id/desktop.jpg   -> latest frame of the hunt machine's GUI (Live Machine)
//   GET  /api/v1/hunts/:id/analysis?goal=rce    -> infinity analysis (chains, confirmation)
//
// Authorization policy: a hunt is created ONLY when BOTH hold:
//   1. body.confirmedAuthorized === true  (frontend sends this after the user
//      confirms they own / are permitted to test the target), AND
//   2. the caller is admin (owner — may hunt any typed target) OR `target`
//      matches ALLOWED_TARGETS (env, comma-separated; applies to member
//      accounts). Matching: the target URL's hostname equals an entry or is
//      a subdomain of it, or the target string starts with an entry.
// Otherwise: HTTP 403 and the attempt is logged.

import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { config } from '../config.js';
import {
  EngineUnreachableError,
  EngineError,
  createEngineHunt,
  getEngineHunt,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../engine.js';
import {
  appendHuntEvent,
  readHuntEvents,
  writeHuntMeta,
  writeHuntMetaCheckpoint,
  readHuntMeta,
  listHuntMetas,
} from '../store.js';
import { requireAuth, issueTerminalTicket, issueControlTicket } from './auth.js';
import {
  takeControl,
  releaseControl,
  getControl,
  startControlDesktop,
  stopControlDesktop,
} from '../machineControl.js';
import { analyzeFindings, chainsMarkdown, generateLogicTests, getPlaybook, reflectHunt, recordHuntExperience, resolveHuntMode, HUNT_MODES, MODE_ORDER, TIERS } from '../hunt-intel/index.js';
import { getHuntCost, getUserCosts } from '../costTracker.js';
import { recordRecall, completeProcess, readMemoryFile, readProcessFile, readOutputFile } from '../brainFiles.js';
import { parseBudgetUsd } from '../budgetCap.js';
import { loadHuntMemory, panelFindings, findingDetail, applyRetractions, isErrorPageFinding, normTitle } from '../huntMemory.js';
import { understandTarget } from '../targetIntel.js';
import { runAutonomousHunt, iterationPriceCents } from '../huntAgent.js';
import { getBalanceCents } from '../billing/credits.js';
import { hasActiveAccessById } from '../access.js';
import { teardownHuntContainer, huntDesktopScreenshot } from '../huntRunner.js';
import { listBrainModels, getBrainState, setBrainModel, metaAvailable } from '../brainProvider.js';
import { getBrainMode, setBrainMode, listBrainActions, outputByHash, deriveProcessState, executeBrainAction } from '../brainMode.js';
import { validateBrainReply, brainReplyToAction } from '../brainReply.js';
import { recallByHash, recallById, formatFullRecord } from '../actionIndex.js';
import { getAllReasoning } from '../reasoningMemory.js';
import { listDetailRequests, submitDetailRequest, cancelDetailRequest, getDetailRequest } from '../userDetails.js';

/** Reject unless the hunt belongs to the authenticated user.
 *  Hunts without a userId are orphaned (pre-isolation) — admin only. */
function requireHuntOwner(req, res) {
  const meta = readHuntMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: 'hunt_not_found' });
    return null;
  }
  if (!meta.userId) {
    // FIX #128: Legacy hunts without userId — require admin, not any user.
    // Previously allowed any authenticated user (IDOR risk).
    if (req.user.role !== 'admin') {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return null;
    }
    return meta;
  }
  if (meta.userId !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return meta;
}

const router = Router();

function hostOf(target) {
  try {
    const u = new URL(target);
    return u.hostname.toLowerCase();
  } catch {
    return String(target || '').toLowerCase();
  }
}

/**
 * Canonical identity of a hunt target, for duplicate detection. Two targets
 * are "the same hunt" when they differ only in scheme, a leading "www.",
 * a default port, letter case, or trailing slashes — e.g.
 * "https://thebhavesh.online", "http://www.thebhavesh.online/" and
 * "thebhavesh.online" all map to "thebhavesh.online".
 */
export function normalizeTargetKey(target) {
  const raw = String(target || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const port = u.port && !['80', '443'].includes(u.port) ? `:${u.port}` : '';
    const pathPart = u.pathname.replace(/\/+$/, '');
    return `${host}${port}${pathPart}`;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }
}

// When several hunts exist for one target (legacy duplicates), the one worth
// reopening is the live one; otherwise the paused one that can resume; a
// terminal hunt still wins over creating yet another duplicate. Ties break
// toward the most progress (iteration), then the most recently created.
const HUNT_STATE_RANK = {
  running: 0,
  starting: 1,
  created: 1,
  paused: 2,
  out_of_credits: 2,
  stopped: 3,
  finished: 4,
  failed: 5,
};

export function pickExistingHunt(metas, userId, target, brainMode) {
  const key = normalizeTargetKey(target);
  if (!key || !userId) return null;
  // MODE-SCOPED DEDUP (3 Nov 2026): the dedup key is (user, target,
  // brainMode). An existing AI hunt for a target must not block a new
  // automation (scanner) hunt for the same target, and vice versa —
  // otherwise the "With AI / With Automation" choice in the New Hunt
  // dialog can never start a fresh hunt for an already-hunted target.
  // Hunts created before brainMode was recorded count as 'ai'.
  // brainMode omitted → legacy target-only match.
  const want = brainMode == null ? null : brainMode === 'scanner' ? 'scanner' : 'ai';
  const modeOf = (h) => (h && h.brainMode === 'scanner' ? 'scanner' : 'ai');
  const matches = (metas || []).filter(
    (h) =>
      h && h.userId && h.userId === userId &&
      normalizeTargetKey(h.target) === key &&
      (want === null || modeOf(h) === want)
  );
  if (!matches.length) return null;
  const rank = (h) =>
    HUNT_STATE_RANK[String(h.state || h.status || '').toLowerCase()] ?? 6;
  matches.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (Number(b.iteration) || 0) - (Number(a.iteration) || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  return matches[0];
}

export function isTargetAllowed(target) {
  const list = config.allowedTargets;
  if (!list.length) return false;
  const t = String(target || '').trim().toLowerCase();
  if (!t) return false;
  const host = hostOf(t);
  return list.some((entry) => {
    const e = entry.toLowerCase().replace(/\/+$/, ''); // ignore trailing slashes
    if (!e) return false;
    // FIX (#338): the old full-string prefix match (`t.startsWith(e)`)
    // let `example.com.evil.com` and `https://example.com@evil.com`
    // pass an `example.com` entry. A prefix only counts on a URL
    // boundary — exact entry, or entry followed by `/`.
    if (t === e || t.startsWith(e + '/')) return true; // full-URL/path prefix match
    if (host === e) return true; // exact host match
    if (host.endsWith('.' + e)) return true; // subdomain match
    return false;
  });
}

// Hunt creation requires login (requireAuth) AND the existing authorized-
// target checks below. Everything else (chat, plugins, reports, health,
// browsing) stays public.
router.post('/', requireAuth, async (req, res) => {
  const { target, scope, confirmedAuthorized, mode, forceNew, fresh, brainMode } = req.body || {};
  // brainMode: 'ai' (default) or 'scanner' (rule-based automation, no AI).
  // The AI option stays — the frontend asks "With AI or With Automation?".
  const reqBrainMode = brainMode === 'scanner' ? 'scanner' : 'ai';
  console.log(`[hunts] CREATE attempt by ${req.user.username} (${req.user.id}): target=${target}, mode=${mode}, brainMode=${reqBrainMode}, confirmed=${confirmedAuthorized}`);
  if (typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'missing_target',
      message: 'Provide {target} — a URL or host you are authorized to test.',
    });
  }
  if (confirmedAuthorized !== true) {
    console.warn(`[hunts] REJECTED create: confirmedAuthorized missing for target "${target}"`);
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
    const { validateTargetAsync } = await import('../scopeParser.js');
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
        console.warn(`[hunts] REJECTED create: SSRF blocked for target "${target}": ${ssrfCheck.reason}`);
        return res.status(403).json({
          ok: false,
          error: 'ssrf_blocked',
          message: ssrfCheck.reason,
        });
      }
    } else {
      console.log(`[hunts] Lab target authorized, SSRF check skipped: "${target}"`);
    }
  } catch (err) {
    console.error('[hunts] SSRF check failed:', err.message);
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
    console.log(`[hunts] Checking credits for ${req.user.username}...`);
    const priceCents = iterationPriceCents(huntMode.id);
    const balanceCents = getBalanceCents(req.user.id);
    console.log(`[hunts] Balance: $${balanceCents / 100}, required: $${priceCents/100}`);
    if (balanceCents < priceCents) {
      return res.status(402).json({
        ok: false,
        error: 'out_of_credits',
        message: 'You are out of hunt credits. Top up your balance to start hunting.',
        priceUsd: priceCents / 100,
      });
    }
  }
  console.log(`[hunts] Credits OK, checking dedupe...`);
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
            const { resumeInterruptedHunt } = await import('../huntAgent.js');
            resumeInterruptedHunt(existingId).catch((err) => {
              appendHuntEvent(existingId, { type: 'status', state: 'failed', error: err.message || String(err) });
            });
            state = 'running';
            resumed = true;
          } catch (err) {
            console.warn(`[hunts] dedupe resume failed for ${existingId}: ${err.message}`);
          }
        }
        console.log(`[hunts] REUSE existing hunt ${existingId} for target "${target}" (user ${req.user.username}, state=${state}, resumed=${resumed})`);
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
      console.warn('[hunts] dedupe check failed:', err.message);
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
    const { listHuntMetas, enqueueHunt, huntQueueFull } = await import('../store.js');
    const metas = listHuntMetas();
    if (huntQueueFull(metas)) {
      const active = metas.find((h) => h.state === 'running');
      const { queueId, position, total } = enqueueHunt({
        userId: req.user.id,
        username: req.user.username,
        target: target.trim(),
        scope: scope || null,
        mode: huntMode.id,
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
    console.error('[hunts] queue check failed:', err.message);
    /* fall through to direct creation on queue failure */
  }
  try {
    let huntId;
    console.log(`[hunts] Creating engine hunt for target "${target}"...`);
    try {
      ({ huntId } = await createEngineHunt(target, scope));
      console.log(`[hunts] Engine hunt created: ${huntId}`);
    } catch (err) {
      if (!(err instanceof EngineUnreachableError)) throw err;
      // No PentAGI engine on this box — the host agent loop (runAutonomousHunt)
      // is the real hunter, so mint a local hunt id and run fully host-side.
      const { randomBytes } = await import('node:crypto');
      huntId = 'h_' + randomBytes(6).toString('hex');
      console.warn(`[hunts] engine unreachable — hunt ${huntId} runs host-side only`);
    }
    // Parse scope: agent auto-understands what's in/out of scope, program rules,
    // custom User-Agent, etc. This is how it hunts like a human who read the brief.
    const { parseScope } = await import('../scopeParser.js');
    const parsedScope = parseScope(target, scope);
    console.log(`[hunts] Scope parsed for ${huntId}: UA=${parsedScope.rules.customUserAgent || 'default'}, noHeavyScan=${parsedScope.rules.noHeavyScan}`);
    // P1 SCOPE ENFORCEMENT (31 Oct 2026, AUD-H1): immutable per-hunt scope
    // for the app-layer guard (scopeGuard.js) and P2's network-layer egress
    // control. FAIL-CLOSED (#339): a build failure used to store
    // scopeGuard: null and the hunt proceeded — the network layer then
    // took the legacy unisolated path (no scope = no egress rules) and
    // the app layer's execution-time rebuild would fail the same way.
    // A hunt that cannot build its scope is not created at all.
    let scopeGuard;
    try {
      const { buildScope } = await import('../scopeGuard.js');
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
      // The frontend asks "With AI or With Automation?" at hunt creation.
      brainMode: reqBrainMode,
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
        const { startHumanLoop } = await import('../humanLoopDriver.js');
        startHumanLoop(huntId);
      } catch (err) {
        console.warn(`[hunts] could not enable human loop for ${huntId}: ${err.message}`);
      }
    }
    // AI understands the target first (async, non-blocking): tech stack,
    // endpoints, forms — becomes hunt context for the engine + chat.
    understandTarget(huntId, target).catch(() => {});
    if (reqBrainMode === 'scanner') {
      // RULE-BASED AUTOMATION (3 Nov 2026): no AI loop — run the predefined
      // scanner battery (fingerprint → probes → verifier) and record
      // findings as hunt events. $0 AI spend, results in seconds/minutes.
      const { runScannerHunt } = await import('../scannerHunt.js');
      runScannerHunt(huntId, target, { scope, userId: req.user.id }).catch((err) => {
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
    res.status(201).json({ ok: true, huntId, brainMode: reqBrainMode, ...(fresh === true ? { fresh: true } : {}) });
  } catch (err) {
    engineErrorResponse(res, err);
  }
});

// List the authenticated user's hunts (newest first). This is what powers
// "close the browser, come back days later": hunts live on the engine +
// backend, not in the browser, so the user re-attaches to them here.
router.get('/', requireAuth, async (req, res) => {
  // Strict per-user isolation: only my hunts. Orphaned hunts (no userId,
  // pre-isolation) are visible to admin only.
  const isAdmin = req.user.role === 'admin';
  const mine = listHuntMetas().filter(
    (m) => (m.userId && m.userId === req.user.id) || (!m.userId && isAdmin)
  );
  // Enrich with live engine status where reachable; fall back to cached meta.
  const hunts = await Promise.all(
    mine.map(async (m) => {
      // The agent loop writes lifecycle into meta.state (running/paused/
      // stopped/finished/failed); m.status is the legacy key. Prefer state.
      let status = m.state || m.status || 'unknown';
      try {
        const live = await getEngineHunt(m.huntId);
        if (live && live.status) status = live.status;
      } catch {
        // engine down — cached status still shows
      }
      return {
        huntId: m.huntId,
        target: m.target,
        scope: m.scope || null,
        // MODE FIX (27 Oct 2026): the list used to omit mode, so the
        // frontend could never inherit a hunt's real mode — "Start
        // from scratch" on a human-mode hunt always fell back to
        // 'normal'. Hunts created before mode was recorded report
        // 'normal', the historical default.
        mode: m.mode || 'normal',
        // BRAIN MODE (3 Nov 2026): the list used to omit brainMode, so the
        // frontend's dedup pre-check could not tell an AI hunt from an
        // automation hunt for the same target. Hunts created before
        // brainMode was recorded report 'ai', the historical default.
        brainMode: m.brainMode === 'scanner' ? 'scanner' : 'ai',
        createdAt: m.createdAt || null,
        status,
      };
    })
  );
  res.json({ ok: true, hunts });
});

// ---- Hunt queue: check position, cancel own queued hunt ----
router.get('/queue', requireAuth, async (req, res) => {
  const { readQueue, getQueuePosition } = await import('../store.js');
  const queue = readQueue().filter((e) => e.status === 'queued')
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
  const mine = getQueuePosition(req.user.id);
  res.json({
    ok: true,
    queue: queue.map((e, i) => {
      const isMine = e.userId === req.user.id;
      // FIX (#335): queued targets belong to their owners. Other
      // users (non-admins) see position/owner/priority only — never
      // another user's target.
      return {
        queueId: e.queueId,
        position: i + 1,
        ...(isMine || req.user.role === 'admin' ? { target: e.target } : {}),
        username: e.username,
        priority: e.priority,
        createdAt: e.createdAt,
        isMine,
      };
    }),
    myPosition: mine ? mine.position : null,
  });
});

router.delete('/queue/:queueId', requireAuth, async (req, res) => {
  const { removeFromQueue } = await import('../store.js');
  const ok = removeFromQueue(req.params.queueId, req.user.id, req.user.role === 'admin');
  if (!ok) return res.status(404).json({ ok: false, error: 'not_found_or_not_yours' });
  res.json({ ok: true, message: 'Removed from queue.' });
});

// ---- Live terminal (PiP): ticket for WebSocket access ----
// GET /api/v1/hunts/:id/terminal/ticket -> { ok, ticket }
// Ticket is a short-lived JWT bound to (userId, huntId). Used for WS auth.
router.get('/:id/terminal/ticket', requireAuth, async (req, res) => {
  const huntId = req.params.id;
  try {
    const { readHuntMeta } = await import('../store.js');
    const meta = readHuntMeta(huntId);
    if (!meta) return res.status(404).json({ ok: false, error: 'hunt_not_found' });
    
    // Ownership check: user owns the hunt or is admin
    const isOwner = meta.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'not_your_hunt' });
    }
    
    // Hunt must be active (running or paused)
    if (!['running', 'paused'].includes(meta.state)) {
      return res.status(400).json({ ok: false, error: 'hunt_not_active' });
    }
    
    // Issue ticket (short-lived signed token, same HS256 secret as login
    // tokens — see issueTerminalTicket in auth.js).
    const ticket = issueTerminalTicket(req.user.id || req.user.sub, req.user.username, huntId);
    
    res.json({ ok: true, ticket });
  } catch (err) {
    console.error('[terminal] ticket error:', err.message);
    res.status(500).json({ ok: false, error: 'ticket_failed' });
  }
});

// Hunt modes + premium tiers (public — the frontend renders the picker).
router.get('/modes', (req, res) => {
  res.json({
    ok: true,
    modes: MODE_ORDER.map((id) => HUNT_MODES[id]),
    tiers: TIERS,
  });
});

// Money burnt — total across all hunts + per-hunt breakdown.
router.get('/costs', requireAuth, (req, res) => {
  res.json({ ok: true, data: getUserCosts(req.user.id) });
});

// Playbook: strategy lessons learned from past hunts, for a target profile.
// Call BEFORE planning a hunt — the planner replays the winners first.
router.get('/playbook', requireAuth, (req, res) => {  const profile = {
    appType: req.query.appType || undefined,
    stack: req.query.stack || undefined,
    hasApi: req.query.hasApi === 'true' ? true : req.query.hasApi === 'false' ? false : undefined,
    hasAuth: req.query.hasAuth === 'true' ? true : req.query.hasAuth === 'false' ? false : undefined,
  };
  res.json({ ok: true, lessons: getPlaybook(profile) });
});

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
          writeHuntMeta(huntId, { ...m0, paused: true, state: 'paused' });
          appendHuntEvent(huntId, { type: 'status', state: 'paused', at: new Date().toISOString() });
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
          const { resumeInterruptedHunt } = await import('../huntAgent.js');
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
    const { appendHuntEvent, readHuntMeta, writeHuntMeta } = await import('../store.js');
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

// ---- Report: works ANY time, even mid-hunt --------------------------------
// Assembled from the locally cached event stream (see WS bridge + engine
// polls). Markdown is always available; PDF is rendered with pdfkit (bundled
// dependency). If pdfkit were ever missing, we fall back to markdown with a
// clear note instead of failing.

router.get('/:id/report', requireAuth, async (req, res) => {
  const huntId = req.params.id;
  const meta0 = requireHuntOwner(req, res);
  if (!meta0) return;
  const format = String(req.query.format || 'md').toLowerCase();
  const events = readHuntEvents(huntId);
  const meta = readHuntMeta(huntId);
  if (!meta && events.length === 0) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_hunt',
      message: `No cached data for hunt "${huntId}". Reports are generated from the local event cache.`,
    });
  }
  const md = buildReportMarkdown({ huntId, meta, events });
  if (format === 'pdf') {
    try {
      const pdf = await renderPdf(md, meta, huntId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="hunt-${huntId}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      console.warn(`[hunts] pdf render failed for ${huntId}: ${err.message}; falling back to markdown`);
      res.setHeader('X-Report-Note', 'pdf-render-failed; markdown returned instead');
      return res.type('text/markdown').send(md);
    }
  }
  res.type('text/markdown').send(md);
});

// ---- Live Machine: latest frame of the hunt machine's GUI desktop --------
// The owner watches the agent's desktop as a picture that refreshes every
// few seconds (the frontend polls this route ~every 3s). Strictly a
// VIEW: nothing on this route can drive the machine — the desktop's VNC
// server is view-only inside the container, and hunt control stays on
// the pause/resume/stop routes. The first poll starts the desktop stack
// inside the container on demand; until the image/stack provides one,
// this returns 404 desktop_not_available and the frontend shows its
// "machine view starts when the hunter uses its desktop" placeholder.
// Auth: JWT (requireAuth) + hunt ownership (requireHuntOwner — the hunt's
// user, or admin). Frames are never cached (no-store).
router.get('/:id/desktop.jpg', requireAuth, async (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  try {
    const shot = await huntDesktopScreenshot(req.params.id);
    if (!shot.ok) {
      return res.status(404).json({ ok: false, error: shot.error || 'desktop_not_available' });
    }
    res.setHeader('Content-Type', shot.contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.send(shot.buffer);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'desktop_capture_failed' });
  }
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
  const user = { id: req.user.id || req.user.sub, username: req.user.username, role: req.user.role };
  const taken = takeControl(req.params.id, user);
  if (!taken.ok) {
    console.warn(`[control] take DENIED hunt=${req.params.id} user=${user.username} error=already_controlled holder=${taken.holder}`);
    return res.status(409).json({ ok: false, error: 'already_controlled', holder: taken.holder });
  }
  const started = await startControlDesktop(req.params.id);
  if (!started.ok) {
    // Honest failure: the lock is freed again so a retry is possible,
    // and the frontend shows the real reason instead of a fake control.
    console.warn(`[control] take FAILED hunt=${req.params.id} user=${user.username} error=${started.error} (lock freed)`);
    releaseControl(req.params.id, user);
    return res.status(503).json({ ok: false, error: 'control_unavailable', detail: started.error });
  }
  console.log(`[control] take OK hunt=${req.params.id} user=${user.username} vncAlreadyRunning=${Boolean(started.alreadyRunning)}`);
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
    console.warn(`[control] release DENIED hunt=${req.params.id} user=${user.username} error=${rel.error}`);
    const status = rel.error === 'not_controlled' ? 409 : 403;
    return res.status(status).json({ ok: false, error: rel.error });
  }
  console.log(`[control] release OK hunt=${req.params.id} user=${user.username}`);
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
    console.warn(`[control] ticket DENIED hunt=${req.params.id} user=${req.user.username} lockHeld=${Boolean(lock)}`);
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

// ---- Agent activity log: whatever the agent did, when --------------------------------
// Cached event stream (thinking, tool calls, findings, status). Works even
// when the engine is unreachable — this is the "what is the agent doing"
// view.
router.get('/:id/events', requireAuth, (req, res) => {  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const events = readHuntEvents(req.params.id);
  // Lane V: the hunt panel's findings come from the SAME reconciled
  // source as mid-hunt chat — loadHuntMemory (retraction-filtered),
  // shaped by panelFindings to one row per unique title. The panel
  // used to rebuild its counts from raw streamed finding events
  // (dropping `verified`, ignoring retractions, counting duplicate
  // stamps) and flatly contradicted chat: "0 confirmed — 284 leads"
  // on a hunt whose record holds 44 confirmed titles.
  let findings = [];
  try { findings = panelFindings(loadHuntMemory(req.params.id).findings); } catch { findings = []; }
  res.json({ ok: true, huntId: req.params.id, events: events.slice(-limit), findings });
});

// ---- Finding detail: the full record behind one panel row --------
// GET /:id/findings/:title — one finding title's complete record
// (verified stamp's evidence as stored, timestamps, stamp count).
// The panel rows (GET /:id/events -> panelFindings) drop the raw
// evidence, so the detail view cannot be served from them, and the
// action index only covers tool_call/task_complete events, so the
// output-by-hash route cannot serve it either. Read-only: the same
// retraction-filtered loadHuntMemory record the events route uses,
// grouped by the same normalised title. :title is URL-encoded by
// the caller (encodeURIComponent); Express decodes %2F back to '/'
// before matching the param, so titles containing '/' still match.
// Owner-only, like the events route. 404 unknown_finding when no
// stamp of that title survives on this hunt.
router.get('/:id/findings/:title', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  let detail = null;
  try { detail = findingDetail(loadHuntMemory(req.params.id).findings, req.params.title); } catch { detail = null; }
  if (!detail) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_finding',
      message: `No finding titled "${req.params.title}" on this hunt.`,
    });
  }
  res.json({ ok: true, huntId: req.params.id, finding: detail });
});

// ---- Download full hunt memory: meta + all events + findings as JSON.
// The admin can download any hunt's complete memory from the admin panel.
router.get('/:id/memory', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const huntId = req.params.id;
  const events = readHuntEvents(huntId);
  const memory = {
    huntId,
    exportedAt: new Date().toISOString(),
    meta,
    events,
    eventCount: events.length,
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="hunt-${huntId}-memory.json"`);
  res.send(JSON.stringify(memory, null, 2));
});

// ---- Money burnt on this hunt (Bedrock tokens + EC2) + its budget.
router.get('/:id/cost', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  res.json({
    ok: true,
    ...getHuntCost(req.params.id),
    budgetUsd: typeof meta.budgetUsd === 'number' ? meta.budgetUsd : null,
    pausedReason: meta.pausedReason || null,
  });
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

// ---- Infinity analysis: chains, confirmation, exploitability, variant probes.
// Pure logic over cached findings — no engine call needed. Powers the
// "what did you chain / what's next" view any time, even mid-hunt.
router.get('/:id/analysis', requireAuth, async (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const goal = String(req.query.goal || 'rce');
  const events = readHuntEvents(req.params.id);
  const findings = events.filter((e) => e.type === 'finding');
  res.json({ ok: true, huntId: req.params.id, analysis: analyzeFindings(findings, goal) });
});

// ---- Business-logic tests: original black-box generator --------------------
// Classifies the target's app type from observed paths and returns
// invariant rules + abuse-case test sequences for the hunt's next phase.
router.get('/:id/logic-tests', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const events = readHuntEvents(req.params.id);
  const paths = [];
  for (const e of events) {
    const url = e.url || (e.input && e.input.url) || '';
    try {
      const u = new URL(String(url));
      paths.push(u.pathname);
    } catch { /* not a URL */ }
  }
  if (meta.target) {
    try { paths.push(new URL(meta.target).pathname); } catch { /* ignore */ }
  }
  res.json({ ok: true, huntId: req.params.id, ...generateLogicTests(paths) });
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

// ---- Shared helpers (used by the WS stream bridge too) --------------------

export function recordEngineEvent(huntId, event) {
  appendHuntEvent(huntId, event);
}

export function getCachedEvents(huntId) {
  return readHuntEvents(huntId);
}

export function buildReportMarkdown({ huntId, meta, events }) {
  const target = (meta && meta.target) || 'unknown target';
  const createdAt = (meta && meta.createdAt) || 'unknown';
  // LIVE REPORT (27 Oct 2026, feat/live-report-fix): the report
  // used to render RAW finding events — every stamp a finding,
  // including the 5 "verified" 404-page stamps and their
  // "PoC confirmed:" duplicates, with no confirmed/lead
  // distinction. It now renders the same reconciled rows the hunt
  // panel shows (panelFindings over retraction-filtered events):
  // one row per unique title, error-page stamps demoted to leads,
  // so the report can never contradict the panel or the chat.
  const rawFindings = applyRetractions(events);
  const rows = panelFindings(rawFindings);
  const confirmedRows = rows.filter((r) => r.verified);
  const leadRows = rows.filter((r) => !r.verified);
  // Evidence/description/URL come from the underlying stamp: a
  // genuine verified stamp for confirmed rows; any stamp's URL for
  // leads (leads render no evidence block and no verification
  // string — their evidence is what misled the verifier).
  const genuineByTitle = new Map();
  const anyByTitle = new Map();
  for (const f of rawFindings) {
    const key = normTitle(f.title || f.type || '');
    if (!key) continue;
    if (!anyByTitle.has(key)) anyByTitle.set(key, f);
    if (f.verified && !isErrorPageFinding(f) && !genuineByTitle.has(key)) genuineByTitle.set(key, f);
  }
  const toolCalls = events.filter((e) => e.type === 'tool_call');
  const thinking = events.filter((e) => e.type === 'thinking');
  const statuses = events.filter((e) => e.type === 'status');
  const lastStatus = statuses.length ? statuses[statuses.length - 1] : null;

  const lines = [];
  lines.push(`# Hunt Report — ${huntId}`);
  lines.push('');
  lines.push(`- **Target:** ${target}`);
  lines.push(`- **Created:** ${createdAt}`);
  lines.push(`- **Latest status:** ${lastStatus ? (lastStatus.state || JSON.stringify(lastStatus)) : 'n/a'}`);
  lines.push(`- **Events cached:** ${events.length} (${thinking.length} thinking, ${toolCalls.length} tool calls, ${rows.length} unique findings: ${confirmedRows.length} confirmed, ${leadRows.length} under investigation)`);
  lines.push(`- **Generated:** ${new Date().toISOString()} (report may reflect a mid-hunt snapshot)`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (!rows.length) {
    lines.push('_No findings recorded yet._');
  } else {
    // Infinity analysis: chains, confirmation, exploitability, variant probes.
    // Chains build on GENUINE confirmed findings only — a 404 stamp
    // must never seed an exploit chain.
    try {
      // The Infinity-analysis counts line must agree with the
      // reconciled rows above: analyzeFindings runs on the
      // GENUINE-only subset (chains must never seed from a 404
      // stamp), but its summary then reads "0 raw → 0 unique" on
      // a hunt with 6 reconciled leads — contradicting the
      // report's own "6 unique findings" headline (live, 27 Oct
      // 23:51 IST verification). Override the counts with the
      // reconciled numbers; likely-exploitable stays the genuine
      // analysis's own count (leads are unconfirmed, so they can
      // never be likely exploitable).
      const analysis = analyzeFindings(rawFindings.filter((f) => f.verified && !isErrorPageFinding(f)));
      analysis.summary = {
        ...analysis.summary,
        raw: rawFindings.length,
        unique: rows.length,
        confirmed: confirmedRows.length,
      };
      lines.push(chainsMarkdown(analysis));
    } catch {
      // intel layer is best-effort; raw findings still render below
    }
    lines.push('### Confirmed vulnerabilities');
    lines.push('');
    if (!confirmedRows.length) {
      lines.push('_No confirmed vulnerabilities yet._');
    } else {
      for (const r of confirmedRows) {
        const sev = String(r.severity || 'info');
        const stamp = genuineByTitle.get(normTitle(r.title)) || {};
        lines.push(`#### [${sev.toUpperCase()}] ${r.title}`);
        if (r.verification) lines.push('', `**Verification:** ${r.verification}`);
        if (r.detail) lines.push('', String(r.detail));
        if (stamp.description) lines.push('', String(stamp.description));
        if (stamp.evidence) lines.push('', '**Evidence:**', '', '```', String(typeof stamp.evidence === 'string' ? stamp.evidence : JSON.stringify(stamp.evidence)).slice(0, 2000), '```');
        const url = stamp.url || r.url;
        if (url) lines.push('', `**URL:** ${url}`);
        lines.push('');
      }
    }
    lines.push('### Leads under investigation');
    lines.push('');
    if (!leadRows.length) {
      lines.push('_No leads under investigation._');
    } else {
      for (const r of leadRows) {
        const sev = String(r.severity || 'info');
        const stamp = anyByTitle.get(normTitle(r.title)) || {};
        const url = stamp.url || r.url;
        lines.push(`- **[${sev.toUpperCase()}] ${r.title}** — under investigation (not confirmed).${url ? ` ${url}` : ''}`);
        if (r.detail) lines.push(`  ${String(r.detail)}`);
      }
      lines.push('');
    }
  }
  lines.push('## Tool activity');
  lines.push('');
  if (!toolCalls.length) {
    lines.push('_No tool calls recorded yet._');
  } else {
    for (const t of toolCalls.slice(0, 200)) {
      const name = t.tool || t.name || 'tool';
      lines.push(`- \`${name}\` ${t.input ? '— ' + String(t.input).slice(0, 160) : ''}`);
    }
    if (toolCalls.length > 200) lines.push(`- …and ${toolCalls.length - 200} more`);
  }
  lines.push('');
  lines.push('## Status timeline');
  lines.push('');
  for (const s of statuses) {
    lines.push(`- ${s.cachedAt || s.at || ''} — ${s.state || JSON.stringify(s)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderPdf(md, meta, huntId) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).text(`Hunt Report — ${huntId}`, { underline: true });
  doc.moveDown();
  doc.fontSize(10).fillColor('#555');
  doc.text(`Target: ${(meta && meta.target) || 'unknown'}`);
  doc.text(`Generated: ${new Date().toISOString()} (may be a mid-hunt snapshot)`);
  doc.moveDown();
  doc.fillColor('#000');

  // Simple markdown-ish rendering: headings, bullets, code blocks.
  let inCode = false;
  for (const rawLine of md.split('\n')) {
    const line = rawLine;
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      doc.font('Courier').fontSize(8).text(line);
      doc.font('Helvetica').fontSize(10);
      continue;
    }
    if (line.startsWith('# ')) doc.fontSize(16).text(line.slice(2));
    else if (line.startsWith('## ')) { doc.moveDown(0.5); doc.fontSize(13).text(line.slice(3)); }
    else if (line.startsWith('### ')) { doc.moveDown(0.25); doc.fontSize(11).text(line.slice(4)); }
    else if (line.startsWith('- ') || line.startsWith('* ')) doc.fontSize(10).text('• ' + line.slice(2));
    else if (line.trim() === '') doc.moveDown(0.5);
    else doc.fontSize(10).text(line.replace(/\*\*/g, ''));
  }
  doc.end();
  return done;
}

function engineErrorResponse(res, err) {
  if (err instanceof EngineUnreachableError) {
    return res.status(502).json({
      ok: false,
      error: 'engine_unreachable',
      message: err.message,
    });
  }
  if (err instanceof EngineError) {
    return res.status(err.status >= 500 ? 502 : err.status).json({
      ok: false,
      error: 'engine_error',
      message: err.message,
    });
  }
  return res.status(500).json({ ok: false, error: 'internal_error', message: String(err.message || err) });
}

export default router;
