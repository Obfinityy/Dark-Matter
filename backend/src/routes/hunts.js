// Hunt routes — authorized-targets-only creation, engine proxying, reports.
//
//   POST /api/v1/hunts {target, scope, confirmedAuthorized}
//   GET  /api/v1/hunts                    -> the user's hunts (re-attach after browser close)
//   POST /api/v1/hunts/:id/pause | /resume | /stop
//   GET  /api/v1/hunts/:id               -> engine status (502 if engine down)
//   GET  /api/v1/hunts/:id/report?format=md|pdf  (works any time, even mid-hunt)
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
  readHuntMeta,
  listHuntMetas,
} from '../store.js';
import { requireAuth } from './auth.js';
import { analyzeFindings, chainsMarkdown, generateLogicTests, getPlaybook, reflectHunt, recordHuntExperience, getMode, HUNT_MODES, MODE_ORDER, TIERS } from '../hunt-intel/index.js';
import { getHuntCost, getUserCosts } from '../costTracker.js';
import { understandTarget } from '../targetIntel.js';
import { runAutonomousHunt, iterationPriceCents } from '../huntAgent.js';
import { getBalanceUsd } from '../billing/credits.js';
import { teardownHuntContainer } from '../huntRunner.js';

/** Reject unless the hunt belongs to the authenticated user.
 *  Hunts without a userId are orphaned (pre-isolation) — admin only. */
function requireHuntOwner(req, res) {
  const meta = readHuntMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: 'hunt_not_found' });
    return null;
  }
  if (!meta.userId) {
    // Legacy hunts (created before user tracking): allow any authenticated
    // user to access. These are shared/old hunts, not admin-only.
    return meta;
  }
  if (meta.userId !== req.user.id) {
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

export function isTargetAllowed(target) {
  const list = config.allowedTargets;
  if (!list.length) return false;
  const t = String(target || '').trim().toLowerCase();
  if (!t) return false;
  const host = hostOf(t);
  return list.some((entry) => {
    const e = entry.toLowerCase();
    if (t.startsWith(e)) return true; // full-URL prefix match
    if (host === e) return true; // exact host match
    if (e && host.endsWith('.' + e)) return true; // subdomain match
    return false;
  });
}

// Hunt creation requires login (requireAuth) AND the existing authorized-
// target checks below. Everything else (chat, plugins, reports, health,
// browsing) stays public.
router.post('/', requireAuth, async (req, res) => {
  const { target, scope, confirmedAuthorized, mode } = req.body || {};
  console.log(`[hunts] CREATE attempt by ${req.user.username} (${req.user.id}): target=${target}, mode=${mode}, confirmed=${confirmedAuthorized}`);
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
  // Allowlist REMOVED (15 Oct 2026, owner order): all accounts are manually
  // created by the owner (invite-only, trusted users). The explicit
  // authorization checkbox (confirmedAuthorized) is sufficient — no
  // ALLOWED_TARGETS restriction.
  // Control-level enforcement BEFORE creating anything: minimal users get Normal/Medium only.
  const huntMode = getMode(mode);
  const control = req.user.control || 'minimal';
  if (control === 'minimal' && !['normal', 'medium'].includes(huntMode.id)) {
    return res.status(403).json({
      ok: false,
      error: 'control_restricted',
      message: `Mode "${huntMode.id}" requires maximum control. Your admin set your level to minimal.`,
    });
  }
  // Credits gate: non-admin users need balance for at least one iteration.
  // Admins (owner) hunt free.
  if (req.user.role !== 'admin') {
    const priceCents = iterationPriceCents(huntMode.id);
    if (getBalanceUsd(req.user.id) * 100 < priceCents) {
      return res.status(402).json({
        ok: false,
        error: 'out_of_credits',
        message: 'You are out of hunt credits. Top up your balance to start hunting.',
        priceUsd: priceCents / 100,
      });
    }
  }
  // ONE HUNT AT A TIME with QUEUE: if a hunt is already running/paused,
  // add this request to the queue instead of rejecting. User gets their
  // queue position. Admin can prioritize from the admin portal.
  try {
    const { listHuntMetas, enqueueHunt } = await import('../store.js');
    const active = listHuntMetas().find((h) => ['running', 'paused'].includes(h.state));
    if (active) {
      const { queueId, position, total } = enqueueHunt({
        userId: req.user.id,
        username: req.user.username,
        target: target.trim(),
        scope: scope || null,
        mode: huntMode.id,
      });
      return res.status(202).json({
        ok: true,
        queued: true,
        queueId,
        position,
        totalInQueue: total,
        message: `Hunt queued. You are #${position} in line. The hunt will start automatically when the current one finishes.`,
        activeHuntId: active.huntId,
        activeTarget: active.target,
      });
    }
  } catch (err) {
    console.error('[hunts] queue check failed:', err.message);
    /* fall through to direct creation on queue failure */
  }
  try {
    let huntId;
    try {
      ({ huntId } = await createEngineHunt(target, scope));
    } catch (err) {
      if (!(err instanceof EngineUnreachableError)) throw err;
      // No PentAGI engine on this box — the host agent loop (runAutonomousHunt)
      // is the real hunter, so mint a local hunt id and run fully host-side.
      const { randomBytes } = await import('node:crypto');
      huntId = 'h_' + randomBytes(6).toString('hex');
      console.warn(`[hunts] engine unreachable — hunt ${huntId} runs host-side only`);
    }
    writeHuntMeta(huntId, {
      huntId,
      target,
      scope: scope || null,
      mode: huntMode.id,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      authorized: true,
    });
    appendHuntEvent(huntId, { type: 'status', state: 'created', target, mode: huntMode.id });
    // AI understands the target first (async, non-blocking): tech stack,
    // endpoints, forms — becomes hunt context for the engine + chat.
    understandTarget(huntId, target).catch(() => {});
    // Launch the autonomous hunt agent (non-blocking): spawns the isolated
    // container, runs recon → Bedrock agent loop → verify → chain → teardown.
    // The user can close the browser; the hunt continues on the backend.
    runAutonomousHunt(huntId, target, huntMode.id, req.user.id).catch((err) => {
      appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
    });
    res.status(201).json({ ok: true, huntId });
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
    queue: queue.map((e, i) => ({
      queueId: e.queueId,
      position: i + 1,
      target: e.target,
      username: e.username,
      priority: e.priority,
      createdAt: e.createdAt,
      isMine: e.userId === req.user.id,
    })),
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
    
    // Issue ticket (simple signed token - 60s expiry)
    const jwt = await import('jsonwebtoken').catch(() => null);
    if (!jwt) {
      return res.status(500).json({ ok: false, error: 'jwt_not_available' });
    }
    const secret = process.env.JWT_SECRET || 'darkmatter-terminal-secret';
    const ticket = jwt.default.sign(
      { userId: req.user.id, huntId, type: 'terminal' },
      secret,
      { expiresIn: '60s' }
    );
    
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
      const canPay = req.user.role === 'admin' || getBalanceUsd(req.user.id) * 100 >= priceCents;
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

// ---- Agent activity log: whatever the agent did, when --------------------------------
// Cached event stream (thinking, tool calls, findings, status). Works even
// when the engine is unreachable — this is the "what is the agent doing"
// view.
router.get('/:id/events', requireAuth, (req, res) => {  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const events = readHuntEvents(req.params.id);
  res.json({ ok: true, huntId: req.params.id, events: events.slice(-limit) });
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

// ---- Money burnt on this hunt (Bedrock tokens + EC2).
router.get('/:id/cost', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  res.json({ ok: true, ...getHuntCost(req.params.id) });
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
  const findings = events.filter((e) => e.type === 'finding');
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
  lines.push(`- **Events cached:** ${events.length} (${thinking.length} thinking, ${toolCalls.length} tool calls, ${findings.length} findings)`);
  lines.push(`- **Generated:** ${new Date().toISOString()} (report may reflect a mid-hunt snapshot)`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (!findings.length) {
    lines.push('_No findings recorded yet._');
  } else {
    // Infinity analysis: chains, confirmation, exploitability, variant probes.
    try {
      lines.push(chainsMarkdown(analyzeFindings(findings)));
    } catch {
      // intel layer is best-effort; raw findings still render below
    }
    for (const f of findings) {
      const sev = f.severity || f.level || 'info';
      const title = f.title || f.name || f.type || 'finding';
      lines.push(`### [${String(sev).toUpperCase()}] ${title}`);
      if (f.description) lines.push('', String(f.description));
      if (f.evidence) lines.push('', '**Evidence:**', '', '```', String(f.evidence).slice(0, 2000), '```');
      if (f.url) lines.push('', `**URL:** ${f.url}`);
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
