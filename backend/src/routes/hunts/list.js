// Split out of hunts.js by the P3 professionalization lane (split-only, no behaviour change).
// Route registrations moved verbatim; hunts.js calls registerListRoutes(router) in the same order.

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
import { getHuntCost, getUserCosts } from '../../costTracker.js';
import { engineErrorResponse, mapListHunt, normalizeHuntCreate, pickExistingHunt, requireHuntOwner } from './helpers.js';
import { createLogger } from '../../logger.js';

const log = createLogger('hunts');


export function registerListRoutes(router) {
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
          ...mapListHunt(m),
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
          // QUEUE LANE (5 Nov 2026): the lane a drained entry will start
          // in — visible so a queued re-run's lane is never a surprise.
          // Legacy entries (enqueued before the lane was persisted) report
          // null here and drain as scanner (see huntCreator.js).
          brainMode: e.brainMode || null,
          scanDepth: e.scanDepth || null,
          // SCAN SCOPE (9 Nov 2026): the scope a drained entry will
          // crawl in — visible so a queued re-run's scope is never a
          // surprise. Legacy entries report null and drain as 'page'.
          scanScope: e.scanScope || null,
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
      log.error('[terminal] ticket error:', err.message);
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
}
