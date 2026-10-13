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
import pluginsRouter from './routes/plugins.js';
import modelsRouter from './routes/models.js';
import voiceRouter from './routes/voice.js';

const app = express();
app.disable('x-powered-by');

// ---- CORS ------------------------------------------------------------------
// The frontend is hosted on different origins (Vercel, Cloudflare Pages,
// local dev). Without these headers browsers block every API call.
// Allowed origins come from CORS_ORIGINS (comma-separated) or the defaults.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ||
  'https://hack.thebhavesh.online,https://dark-matter-frontend.vercel.app,http://localhost:5173,http://localhost:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
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
app.use('/api/v1/plugins', pluginsRouter);
app.use('/api/v1/models', modelsRouter);
app.use('/api/v1/voice', voiceRouter);

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
  const m = /^\/api\/v1\/hunts\/([^/]+)\/stream$/.exec(req.url.split('?')[0] || '');
  if (!m) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, decodeURIComponent(m[1]));
  });
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
});
