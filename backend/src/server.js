// Dark Matter backend — fresh rebuild (13 Oct 2026).
// Express orchestrator bridging the frontend to the PentAGI hunt engine.

import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import {
  EngineUnreachableError,
  getEngineEvents,
  getEngineHunt,
} from './engine.js';
import { recordEngineEvent, getCachedEvents } from './routes/hunts.js';
import huntsRouter from './routes/hunts.js';
import authRouter from './routes/auth.js';
import { ensureAdmin } from './routes/auth.js';
import adminRouter from './routes/admin.js';
import chatRouter from './routes/chat.js';
import chatsRouter from './routes/chats.js';
import pluginsRouter from './routes/plugins.js';
import modelsRouter from './routes/models.js';
import voiceRouter from './routes/voice.js';
import billingRouter from './routes/billing.js';
import { backfillAllHunts, episodeLedgerEnabled, runEmbeddingBackfill, backfillRuledOutFromEpisodes } from './episodeStore.js';
import { maybeConsolidateAll } from './consolidation.js';
import { evaluatePromotions } from './playbook.js';

const app = express();
app.disable('x-powered-by');

// ---- CORS ------------------------------------------------------------------
// The frontend is hosted on different origins (Vercel, Cloudflare Pages,
// local dev). Without these headers browsers block every API call.
// Allowed origins come from CORS_ORIGINS (comma-separated) or the defaults.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ||
  'https://hack.thebhavesh.online,https://dark-matter-frontend.vercel.app,https://dark-matter-frontend.pages.dev,http://localhost:5173,http://localhost:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow exact matches plus any *.pages.dev deployment URL (each deploy gets a unique hash URL)
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.dark-matter-frontend\.pages\.dev$/.test(origin)
  );
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

// ---- API -------------------------------------------------------------------

app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/v1/hunts', huntsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
ensureAdmin();
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/chats', chatsRouter);
app.use('/api/v1/plugins', pluginsRouter);
app.use('/api/v1/models', modelsRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/api/v1/billing', billingRouter);

// 404 for unknown API routes (JSON, not HTML).
app.use('/api/', (req, res) => {
  res.status(404).json({ ok: false, error: 'not_found', message: `Unknown API route ${req.method} ${req.path}` });
});

const server = http.createServer(app);

// ---- WebSocket: WS /api/v1/hunts/:id/stream --------------------------------
// Emits events {type: "thinking"|"tool_call"|"finding"|"status"|"done", ...}.
//
// Bridge choice: the PentAGI engine has no documented WebSocket/SSE feed, so
// the backend POLLS its REST endpoint GET /api/v1/hunts/:id/events?since=<seq>
// every 1s per connected client, forwards new events, and caches them locally
// (powers mid-hunt reports + chat context). If the engine is unreachable, the
// client gets a single {type:"status", state:"engine_unreachable"} event and
// the socket closes with code 1011. Cached events are replayed on connect so
// a fresh subscriber sees history.

const wss = new WebSocketServer({ noServer: true });
const STREAM_POLL_MS = parseInt(process.env.STREAM_POLL_MS || '1000', 10);

server.on('upgrade', (req, socket, head) => {
  const streamMatch = /^\/api\/v1\/hunts\/([^/]+)\/stream$/.exec(req.url.split('?')[0] || '');
  if (streamMatch) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, decodeURIComponent(streamMatch[1]));
    });
    return;
  }
  const termMatch = /^\/api\/v1\/hunts\/([^/]+)\/terminal$/.exec(req.url.split('?')[0] || '');
  if (termMatch) {
    // Terminal WS: validate ticket from query param
    const url = new URL(req.url, 'http://localhost');
    const ticket = url.searchParams.get('ticket');
    if (!ticket) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wssTerm.handleUpgrade(req, socket, head, (ws) => {
      wssTerm.emit('connection', ws, req, decodeURIComponent(termMatch[1]), ticket);
    });
    return;
  }
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
  return;
});

// ---- WebSocket: WS /api/v1/hunts/:id/terminal?ticket=... --------------------
// Proxies to the hunt container's ttyd (read-only terminal streaming for PiP).
// Ticket is a 60s JWT bound to (userId, huntId). Client->server frames are
// dropped (defence in depth — ttyd is already read-only without --writable).
const wssTerm = new WebSocketServer({ noServer: true });
const TERM_VIEWERS = new Map(); // huntId -> Set<ws>
const MAX_TERM_VIEWERS = 2;

wssTerm.on('connection', async (ws, req, huntId, ticket) => {
  let ttydWs = null;
  try {
    // Validate ticket
    const jwt = await import('jsonwebtoken').catch(() => null);
    if (!jwt) throw new Error('jwt not available');
    const secret = process.env.JWT_SECRET || 'darkmatter-terminal-secret';
    const payload = jwt.default.verify(ticket, secret);
    if (payload.type !== 'terminal' || payload.huntId !== huntId) {
      throw new Error('invalid ticket');
    }
    
    // Check hunt is still active
    const { readHuntMeta } = await import('./store.js');
    const meta = readHuntMeta(huntId);
    if (!meta || !['running', 'paused'].includes(meta.state)) {
      throw new Error('hunt not active');
    }
    
    // Cap viewers
    const viewers = TERM_VIEWERS.get(huntId) || new Set();
    if (viewers.size >= MAX_TERM_VIEWERS) {
      ws.close(1013, 'too many viewers');
      return;
    }
    viewers.add(ws);
    TERM_VIEWERS.set(huntId, viewers);
    
    // Connect to ttyd (loopback only)
    const TTYD_PORT = process.env.HUNT_TTYD_PORT || '17681';
    const WebSocket = (await import('ws')).default;
    ttydWs = new WebSocket(`ws://127.0.0.1:${TTYD_PORT}/ws`);
    
    ttydWs.on('open', () => {
      // ttyd connected — start proxying
    });
    
    ttydWs.on('message', (data) => {
      // ttyd -> client (terminal output)
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
    
    ttydWs.on('close', () => {
      if (ws.readyState === ws.OPEN) ws.close(1000, 'terminal closed');
    });
    
    ttydWs.on('error', () => {
      if (ws.readyState === ws.OPEN) ws.close(1011, 'terminal unreachable');
    });
    
    ws.on('message', () => {
      // Drop client->server (read-only). Defence in depth.
    });
    
    ws.on('close', () => {
      viewers.delete(ws);
      if (viewers.size === 0) TERM_VIEWERS.delete(huntId);
      if (ttydWs) ttydWs.close();
    });
    
    // Idle timeout: 10 minutes
    const idleTimer = setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.close(1000, 'idle timeout');
    }, 10 * 60 * 1000);
    ws.on('close', () => clearTimeout(idleTimer));
    
  } catch (err) {
    if (ws.readyState === ws.OPEN) ws.close(1008, 'auth failed');
    if (ttydWs) ttydWs.close();
  }
});

wss.on('connection', async (ws, req, huntId) => {
  let alive = true;
  let lastSeq = 0;

  const send = (event) => {
    if (alive && ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
  };

  // 1) Replay locally cached events so the client has history immediately.
  for (const cached of getCachedEvents(huntId)) {
    if (typeof cached.seq === 'number' && cached.seq > lastSeq) lastSeq = cached.seq;
    send(stripCacheFields(cached));
  }

  // 2) Current status snapshot from the engine.
  try {
    const status = await getEngineHunt(huntId);
    send({ type: 'status', huntId, snapshot: status });
  } catch (err) {
    if (err instanceof EngineUnreachableError) {
      send({ type: 'status', huntId, state: 'engine_unreachable', message: err.message });
      ws.close(1011, 'engine unreachable');
      alive = false;
      return;
    }
  }

  // 3) Poll for new events until the hunt is done or the client disconnects.
  const timer = setInterval(async () => {
    if (!alive) return;
    try {
      const events = await getEngineEvents(huntId, lastSeq);
      for (const ev of events) {
        if (typeof ev.seq === 'number') lastSeq = Math.max(lastSeq, ev.seq);
        recordEngineEvent(huntId, ev);
        send(ev);
        if (ev.type === 'done') {
          clearInterval(timer);
          ws.close(1000, 'hunt done');
          alive = false;
          return;
        }
      }
    } catch (err) {
      if (err instanceof EngineUnreachableError) {
        send({ type: 'status', huntId, state: 'engine_unreachable', message: err.message });
        clearInterval(timer);
        ws.close(1011, 'engine unreachable');
        alive = false;
      }
      // Other engine errors (e.g. 404 for unknown hunt): report and keep polling
      // for a bit, then give up — the engine may still be starting the hunt.
    }
  }, STREAM_POLL_MS);
  timer.unref?.();

  ws.on('close', () => {
    alive = false;
    clearInterval(timer);
  });
  ws.on('error', () => {
    alive = false;
    clearInterval(timer);
  });
});

function stripCacheFields(ev) {
  const { cachedAt, ...rest } = ev;
  return rest;
}

// ---- Boot -------------------------------------------------------------------

server.listen(config.port, () => {
  console.log(`[backend] listening on :${config.port}`);
  console.log(`[backend] engine -> ${config.engineUrl}`);
  console.log(`[backend] voice  -> ${config.voiceUrl}`);
  console.log(
    `[backend] allowlist -> ${config.allowedTargets.length ? config.allowedTargets.join(', ') : '(empty — hunt creation is disabled until ALLOWED_TARGETS is set)'}`
  );

  // CHECKPOINT RESUME — hunts that were mid-flight when the process died
  // (state 'running' in their memory folder) pick up from their last
  // checkpoint instead of being lost. Explicitly paused/stopped/finished
  // hunts are left alone.
  //
  // Periodic reconciliation (not just boot-time): external tools such as the
  // benchmark-watchdog mark hunts 'running' in meta.json while the backend is
  // already up. Without a periodic scan the backend never notices, leaving a
  // "zombie running" state (meta says running, no loop driver active).
  // Safe to re-scan: resumeInterruptedHunt -> runAutonomousHunt is idempotent
  // via the activeLoops mutex (huntAgent.js), so re-scanning won't double-start loops.
  async function scanAndResumeRunningHunts(tag) {
    try {
      const { listHuntMetas } = await import('./store.js');
      const { resumeInterruptedHunt } = await import('./huntAgent.js');
      let resumed = 0;
      for (const meta of listHuntMetas()) {
        if (meta && meta.state === 'running' && meta.huntId) {
          const ok = await resumeInterruptedHunt(meta.huntId).catch((err) => {
            console.error(`[resume:${tag}] ${meta.huntId} failed:`, err.message || err);
            return false;
          });
          if (ok) {
            resumed++;
            console.log(`[resume:${tag}] ${meta.huntId} resumed from checkpoint`);
          }
        }
      }
      if (resumed) console.log(`[resume:${tag}] ${resumed} interrupted hunt(s) resumed`);
    } catch (err) {
      console.error(`[resume:${tag}] scan failed:`, err.message || err);
    }
  }
  setTimeout(() => scanAndResumeRunningHunts('boot'), 8000);
  setInterval(() => scanAndResumeRunningHunts('periodic'), 60000);

  // EPISODE LEDGER (Job 6 stage 1) — boot backfill mirrors every hunt's
  // events.jsonl into the SQLite episode ledger; a periodic flush keeps it
  // current alongside the append-time hook in store.js. Fully additive and
  // isolated: the JSONL logs remain the source of truth, and any ledger
  // failure is logged, never fatal.
  function flushEpisodeLedgers(tag) {
    try {
      if (!episodeLedgerEnabled()) {
        console.log('[episodes] ledger disabled (node:sqlite unavailable on this runtime)');
        return;
      }
      const r = backfillAllHunts();
      if (r.inserted) {
        console.log(`[episodes:${tag}] mirrored ${r.inserted} new episode(s); ${r.total} total across ${r.hunts} hunt(s)`);
      }
      // Job 6 stage 4: seed the dead-end registry from historical
      // validator-rejected findings (boot only; idempotent).
      if (tag === 'boot') {
        const ro = backfillRuledOutFromEpisodes();
        if (ro.recorded) console.log(`[episodes:boot] dead-end registry seeded with ${ro.recorded} historical validator lesson(s)`);
      }
    } catch (err) {
      console.error(`[episodes:${tag}] flush failed:`, err.message || err);
    }
  }
  setTimeout(() => flushEpisodeLedgers('boot'), 5000);
  setInterval(() => flushEpisodeLedgers('periodic'), 60000);

  // EPISODE EMBEDDINGS (Job 6 stage 2) — background backfill of the vector
  // index used by hybrid retrieval. Bounded to 64 episodes/min so it never
  // competes with the hunt brain; logs only when the index completes.
  async function backfillEpisodeEmbeddings(tag) {
    try {
      if (!episodeLedgerEnabled()) return;
      const r = await runEmbeddingBackfill({ maxEpisodes: 64 });
      if (r.embedded > 0 && r.remaining === 0) {
        console.log(`[episodes:${tag}] embedding index complete`);
      }
    } catch (err) {
      console.error(`[episodes:${tag}] embedding backfill failed:`, err.message || err);
    }
  }
  setTimeout(() => backfillEpisodeEmbeddings('boot'), 20000);
  setInterval(() => backfillEpisodeEmbeddings('periodic'), 60000);

  // CONSOLIDATION (Job 6 stage 3) — the "sleep" job: between phases it
  // writes each active target's dossier (DOSSIER.md) from validator-
  // stamped records and logs a first-class consolidation episode. At
  // most one hunt per tick; stopped/finished hunts are never touched.
  function consolidateOnce(tag) {
    try {
      const r = maybeConsolidateAll();
      if (r.done) {
        console.log(`[consolidation:${tag}] ${r.huntId}: episodes ${r.covered[0]}–${r.covered[1]} -> DOSSIER.md`);
      }
      // Job 6 stage 5: the playbook promotion gate — a proposal becomes
      // a live rule only on validator-confirmed evidence.
      const pr = evaluatePromotions();
      if (pr.promoted) {
        console.log(`[playbook:${tag}] promoted ${pr.promoted} proposal(s) on validator-confirmed evidence`);
      }
    } catch (err) {
      console.error(`[consolidation:${tag}] failed:`, err.message || err);
    }
  }
  setTimeout(() => consolidateOnce('boot'), 35000);
  setInterval(() => consolidateOnce('periodic'), 60000);
});
