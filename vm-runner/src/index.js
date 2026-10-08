/**
 * Infinity AI VM Runner — local service entry point.
 *
 * A standalone Node.js service that runs on the USER's own machine (their
 * Windows box). It is NOT part of the cloud backend: it manages a
 * hardware-accelerated QEMU/Kali sandbox VM per session and exposes the
 * VM control API on 127.0.0.1:4100 only.
 *
 * Security posture:
 *  - Binds 127.0.0.1 exclusively. No host shared folders; the VM uses NAT
 *    networking only, so it can never touch the user's real desktop.
 *  - Every /vm/* endpoint (except POST /vm/start, which issues the token)
 *    requires `Authorization: Bearer <sessionToken>`.
 *  - Shell commands and typed input are gated against the session's declared
 *    target scope (targetGate.js).
 *  - No API keys anywhere.
 */
import express from 'express';
import { statfsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import path from 'node:path';

import { findQemuBinary, detectAccel, detectWhpx } from './qemu.js';
import { VmManager, resolveVmHome, validateSessionId } from './vmManager.js';
import { ExecSessionManager } from './execSessions.js';
import { checkCommandScope } from './targetGate.js';
import { verifyToken } from './token.js';
import { createTerminalBridge, isTerminalAvailable } from './terminal.js';
import { attachVncProxy } from './vnc.js';

const PKG = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

export const VERSION = PKG.version;
export const PORT = Number.parseInt(process.env.INFINITY_VM_RUNNER_PORT || '4100', 10);
export const BIND_HOST = '127.0.0.1';

export { resolveVmHome };

export async function loadKaliDescriptor() {
  try {
    const raw = await readFile(new URL('../images/kali.json', import.meta.url), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function goldenImagePath(vmHome, kali) {
  return path.join(vmHome, 'images', kali?.innerImage || 'kali.qcow2');
}

/** { present, bytes, path, version } for the extracted golden image. */
export async function getKaliImageInfo(vmHome = resolveVmHome()) {
  const kali = await loadKaliDescriptor();
  const imagePath = goldenImagePath(vmHome, kali);
  try {
    const st = await stat(imagePath);
    return { present: true, bytes: st.size, path: imagePath, version: kali?.version || null };
  } catch {
    return { present: false, bytes: 0, path: imagePath, version: kali?.version || null };
  }
}

export function diskFreeBytes(dir) {
  // Walk up to the nearest existing ancestor so a not-yet-created vmHome
  // still reports the volume's free space.
  let probe = dir;
  for (let i = 0; i < 8; i += 1) {
    try {
      const s = statfsSync(probe);
      return Number(s.bavail) * Number(s.bsize);
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  return null;
}

/**
 * Environment diagnostics: QEMU presence, accelerator, WHPX state, golden
 * image, free disk. `problems` is a list of human-readable blockers.
 */
export async function buildDoctorReport() {
  const vmHome = resolveVmHome();
  const problems = [];
  const platform = os.platform();

  const [qemuPath, accel, whpx, kaliImage] = await Promise.all([
    findQemuBinary(platform),
    detectAccel(platform),
    detectWhpx(platform),
    getKaliImageInfo(vmHome),
  ]);

  if (!qemuPath) {
    problems.push(
      'QEMU not found. Install QEMU (Windows: the official installer from qemu.org; ' +
        'Linux: your distro qemu-system-x86 package) and restart the runner.',
    );
  }
  if (!accel) {
    problems.push(
      platform === 'win32'
        ? 'No hardware accelerator available. Enable "Windows Hypervisor Platform" in Windows Features ' +
          '(requires administrator rights and a reboot), then restart the runner.'
        : 'No hardware accelerator available. On Linux this means /dev/kvm is missing — ' +
          'enable virtualization (VT-x/AMD-V) in BIOS/UEFI.',
    );
  }
  if (!kaliImage.present) {
    problems.push(
      `Kali golden image missing at ${kaliImage.path}. Download it from the official Kali site, ` +
        'verify the SHA256 (see vm-runner/images/kali.json), extract the .qcow2 there, then retry.',
    );
  }
  try {
    assertVmHomeUsable(vmHome);
  } catch (err) {
    problems.push(err.message);
  }

  return {
    platform,
    vmHome,
    qemuPath: qemuPath || null,
    accel: accel || null,
    whpxEnabled: whpx.enabled,
    whpxDetail: whpx.detail,
    kaliImage: { present: kaliImage.present, bytes: kaliImage.bytes, version: kaliImage.version },
    diskFreeBytes: diskFreeBytes(vmHome),
    problems,
  };
}

function assertVmHomeUsable(vmHome) {
  // QEMU on Windows cannot open non-ASCII or comma-containing paths.
  if (/[^\x00-\x7F]/.test(vmHome)) {
    throw new Error(
      `VM home "${vmHome}" contains non-ASCII characters, which QEMU on Windows cannot open. ` +
        'Set INFINITY_VM_RUNNER_HOME to an ASCII-only directory.',
    );
  }
  if (vmHome.includes(',')) {
    throw new Error(
      `VM home "${vmHome}" contains a comma, which QEMU on Windows cannot open. ` +
        'Set INFINITY_VM_RUNNER_HOME to a comma-free directory.',
    );
  }
}

/** CORS locked to local frontend origins (dev server / packaged app). */
function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / non-browser clients
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function extractBearer(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Find the session whose token matches (constant-time compare). */
export async function findSessionByToken(vmHome, token) {
  if (!token) return null;
  const sessionsDir = path.join(vmHome, 'sessions');
  let entries;
  try {
    entries = await readdir(sessionsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await readFile(path.join(sessionsDir, entry.name, 'session.json'), 'utf8');
      const record = JSON.parse(raw);
      if (record?.sessionToken && verifyToken(token, record.sessionToken)) return record;
    } catch {
      // skip unreadable session dirs
    }
  }
  return null;
}

function sendError(res, httpStatus, code, message) {
  return res.status(httpStatus).json({ ok: false, code, message });
}

/** Attach the session (resolved from the bearer token) to the request. */
function requireSession(vmHome) {
  return async (req, res, next) => {
    const token = extractBearer(req);
    const session = await findSessionByToken(vmHome, token);
    if (!session) {
      return sendError(res, 401, 'bad_token', 'Missing or invalid session token');
    }
    // When the caller names a session (or execId), it must belong to this token.
    const named = req.body?.sessionId || req.query.sessionId;
    if (named && named !== session.sessionId) {
      return sendError(res, 403, 'bad_token', 'Session token does not match the requested session');
    }
    req.session = session;
    next();
  };
}

// ---------------------------------------------------------------------------
// Input action validation (brain action protocol, §4 of the design doc)
// ---------------------------------------------------------------------------

const CLICK_BUTTONS = new Set(['left', 'right', 'middle']);

function validateAction(action) {
  if (!action || typeof action !== 'object') throw new Error('action must be an object');
  const { type } = action;
  switch (type) {
    case 'click': {
      const { x, y, button = 'left' } = action;
      if (!inRange(x) || !inRange(y)) throw new Error('click requires x,y in 0..1000');
      if (!CLICK_BUTTONS.has(button)) throw new Error('click button must be left|right|middle');
      return { type, x, y, button };
    }
    case 'move': {
      const { x, y } = action;
      if (!inRange(x) || !inRange(y)) throw new Error('move requires x,y in 0..1000');
      return { type, x, y };
    }
    case 'type': {
      const { text } = action;
      if (typeof text !== 'string' || text.length === 0) throw new Error('type requires non-empty text');
      if (text.length > 4000) throw new Error('type text is limited to 4000 chars');
      return { type, text };
    }
    case 'key': {
      const { key } = action;
      if (typeof key !== 'string' || key.length === 0 || key.length > 64) {
        throw new Error('key must be a non-empty string up to 64 chars');
      }
      return { type, key };
    }
    case 'scroll': {
      const { dy } = action;
      if (typeof dy !== 'number' || !Number.isFinite(dy)) throw new Error('scroll requires numeric dy');
      return { type, dy };
    }
    default:
      throw new Error(`unknown action type: ${type}`);
  }
}

function inRange(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Wire the VM control API onto an express app.
 * @param {import('express').Express} app
 * @param {{ manager: VmManager, execSessions: ExecSessionManager, vmHome: string }} services
 */
export function attachVmRoutes(app, { manager, execSessions, vmHome }) {
  const auth = requireSession(vmHome);
  // sessionId -> Set<bridge> for cleanup on stop
  const terminalBridges = new Map();
  const trackBridge = (sessionId, bridge) => {
    if (!terminalBridges.has(sessionId)) terminalBridges.set(sessionId, new Set());
    terminalBridges.get(sessionId).add(bridge);
  };
  const untrackBridge = (sessionId, bridge) => terminalBridges.get(sessionId)?.delete(bridge);

  app.post('/vm/start', async (req, res) => {
    try {
      const { sessionId, cpus = 2, memoryMiB = 2048, diskBytes, target } = req.body || {};
      const out = await manager.start({ sessionId, cpus, memoryMiB, diskBytes, target });
      res.json(out);
    } catch (err) {
      if (/sessionId must be/.test(err.message)) return sendError(res, 400, 'bad_request', err.message);
      if (err.code === 'qemu_missing') return sendError(res, 503, 'qemu_missing', err.message);
      if (err.code === 'no_accel') return sendError(res, 503, 'no_accel', err.message);
      return sendError(res, 500, 'start_failed', err.message);
    }
  });

  app.get('/vm/status', auth, async (req, res) => {
    res.json(await manager.status(req.session.sessionId));
  });

  app.post('/vm/stop', auth, async (req, res) => {
    const { sessionId } = req.session;
    for (const bridge of terminalBridges.get(sessionId) || []) {
      try {
        await bridge.kill();
      } catch {
        // ignore
      }
    }
    terminalBridges.delete(sessionId);
    execSessions.forgetSession(sessionId);
    res.json(await manager.stop(sessionId));
  });

  app.post('/vm/exec', auth, async (req, res) => {
    try {
      const { command, cwd, timeoutMs = 120000 } = req.body || {};
      if (!command || typeof command !== 'string') {
        return sendError(res, 400, 'bad_request', 'command is required');
      }
      const gate = checkCommandScope({ command, target: req.session.target });
      if (!gate.allowed) return sendError(res, 403, 'out_of_scope', gate.reason);
      const client = manager.guestClientFor(req.session);
      res.json(await client.exec({ command, cwd, timeoutMs }));
    } catch (err) {
      if (err.code === 'guest_unreachable' || err.code === 'guest_timeout') {
        return sendError(res, 502, 'guest_unreachable', err.message);
      }
      return sendError(res, 500, 'exec_failed', err.message);
    }
  });

  app.post('/vm/exec/start', auth, async (req, res) => {
    try {
      const { command, cwd, timeoutMs } = req.body || {};
      if (!command || typeof command !== 'string') {
        return sendError(res, 400, 'bad_request', 'command is required');
      }
      const gate = checkCommandScope({ command, target: req.session.target });
      if (!gate.allowed) return sendError(res, 403, 'out_of_scope', gate.reason);
      res.json(await execSessions.start(req.session.sessionId, { command, cwd, timeoutMs }));
    } catch (err) {
      if (err.code === 'guest_unreachable' || err.code === 'guest_timeout') {
        return sendError(res, 502, 'guest_unreachable', err.message);
      }
      return sendError(res, 500, 'exec_failed', err.message);
    }
  });

  app.get('/vm/exec/:execId/poll', auth, async (req, res) => {
    try {
      res.json(await execSessions.poll(req.session.sessionId, req.params.execId));
    } catch (err) {
      if (err.code === 'not_found') return sendError(res, 404, 'not_found', err.message);
      if (err.code === 'guest_unreachable' || err.code === 'guest_timeout') {
        return sendError(res, 502, 'guest_unreachable', err.message);
      }
      return sendError(res, 500, 'poll_failed', err.message);
    }
  });

  app.post('/vm/exec/:execId/kill', auth, async (req, res) => {
    try {
      res.json(await execSessions.kill(req.session.sessionId, req.params.execId));
    } catch (err) {
      if (err.code === 'not_found') return sendError(res, 404, 'not_found', err.message);
      return sendError(res, 500, 'kill_failed', err.message);
    }
  });

  app.post('/vm/screenshot', auth, async (req, res) => {
    try {
      const width = Math.max(320, Math.min(2560, Number(req.body?.width) || 1280));
      const client = manager.guestClientFor(req.session);
      const jpeg = await client.screenshot({ width });
      res.type('image/jpeg').send(jpeg);
    } catch (err) {
      if (err.code === 'guest_unreachable' || err.code === 'guest_timeout') {
        return sendError(res, 502, 'guest_unreachable', err.message);
      }
      return sendError(res, 500, 'screenshot_failed', err.message);
    }
  });

  app.post('/vm/input', auth, async (req, res) => {
    try {
      const action = validateAction(req.body?.action);
      if (action.type === 'type') {
        const gate = checkCommandScope({ command: action.text, target: req.session.target });
        if (!gate.allowed) return sendError(res, 403, 'out_of_scope', gate.reason);
      }
      const client = manager.guestClientFor(req.session);
      // Brain actions use 0-1000 normalized space; the guest needs pixels.
      const guestAction = { ...action };
      if (action.x !== undefined) {
        const { width, height } = await client.display();
        guestAction.x = Math.round((action.x / 1000) * width);
        guestAction.y = Math.round((action.y / 1000) * height);
      }
      res.json(await client.input(guestAction));
    } catch (err) {
      if (/requires|must be|unknown action|limited to/.test(err.message)) {
        return sendError(res, 400, 'bad_request', err.message);
      }
      if (err.code === 'guest_unreachable' || err.code === 'guest_timeout') {
        return sendError(res, 502, 'guest_unreachable', err.message);
      }
      return sendError(res, 500, 'input_failed', err.message);
    }
  });

  return { terminalBridges, trackBridge, untrackBridge };
}

// ---------------------------------------------------------------------------
// App + server
// ---------------------------------------------------------------------------

export function createApp(services) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return sendError(res, 403, 'forbidden_origin', 'Origin not allowed');
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      return res.sendStatus(204);
    }
    next();
  });

  app.get('/health', async (req, res) => {
    const [qemuPath, accel] = await Promise.all([findQemuBinary(), detectAccel()]);
    res.json({ ok: true, version: VERSION, qemu: { found: Boolean(qemuPath), accel: accel || null } });
  });

  app.get('/doctor', async (req, res) => {
    res.json(await buildDoctorReport());
  });

  if (services) {
    const registry = attachVmRoutes(app, services);
    app.locals.vm = registry;
  }

  return app;
}

export async function initServices() {
  const vmHome = resolveVmHome();
  const [qemuPath, accel] = await Promise.all([findQemuBinary(), detectAccel()]);
  const manager = new VmManager({
    vmHome,
    qemuPath,
    accel,
    getGoldenImagePath: async () => (await getKaliImageInfo(vmHome)).path,
  });
  const execSessions = new ExecSessionManager({
    getGuestClient: async (sessionId) => {
      const record = await manager.getSession(sessionId);
      if (!record) throw new Error(`no such session: ${sessionId}`);
      return manager.guestClientFor(record);
    },
  });
  return { manager, execSessions, vmHome };
}

async function verifyWsAuth(vmHome, sessionId, token) {
  try {
    validateSessionId(sessionId);
  } catch {
    return null;
  }
  const sessionsDir = path.join(vmHome, 'sessions', sessionId);
  try {
    const record = JSON.parse(await readFile(path.join(sessionsDir, 'session.json'), 'utf8'));
    if (record?.sessionToken && verifyToken(token, record.sessionToken)) return record;
  } catch {
    // fall through
  }
  return null;
}

function handleTerminalWs(ws, { manager, session, trackBridge, untrackBridge }) {
  let bridge = null;
  const send = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  (async () => {
    try {
      if (!isTerminalAvailable()) {
        send({
          t: 'error',
          message: 'terminal_unavailable: node-pty is not installed — run `npm install` inside vm-runner',
        });
        ws.close();
        return;
      }
      const client = manager.guestClientFor(session);
      bridge = await createTerminalBridge({ guestClient: client, cols: 80, rows: 24 });
      trackBridge(session.sessionId, bridge);
      bridge.onData((data) => send({ t: 'out', data }));
      bridge.onExit(() => {
        untrackBridge(session.sessionId, bridge);
        ws.close();
      });
    } catch (err) {
      send({ t: 'error', message: err.message });
      ws.close();
    }
  })();

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!bridge) return;
    try {
      if (msg.t === 'in' && typeof msg.data === 'string') bridge.write(msg.data);
      else if (msg.t === 'resize') {
        const cols = Math.max(20, Math.min(500, Number(msg.cols) || 80));
        const rows = Math.max(5, Math.min(200, Number(msg.rows) || 24));
        await bridge.resize(cols, rows);
      }
    } catch {
      // ignore malformed frames
    }
  });
  ws.on('close', async () => {
    if (bridge) {
      untrackBridge(session.sessionId, bridge);
      try {
        await bridge.kill();
      } catch {
        // ignore
      }
    }
  });
}

export function startServer(port = PORT, host = BIND_HOST, services) {
  const app = createApp(services);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on('error', reject);

    if (services) {
      const { manager, vmHome } = services;
      const { trackBridge, untrackBridge } = app.locals.vm;
      const wss = new WebSocketServer({ noServer: true });
      server.on('upgrade', (req, socket, head) => {
        let url;
        try {
          url = new URL(req.url, 'http://127.0.0.1');
        } catch {
          socket.destroy();
          return;
        }
        const sessionId = url.searchParams.get('sessionId') || '';
        const token = url.searchParams.get('token') || '';
        verifyWsAuth(vmHome, sessionId, token)
          .then((session) => {
            if (!session) {
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }
            if (url.pathname === '/vm/vnc') {
              wss.handleUpgrade(req, socket, head, async (ws) => {
                try {
                  await attachVncProxy(ws, { host: '127.0.0.1', port: session.vncPort });
                } catch {
                  ws.close();
                }
              });
            } else if (url.pathname === '/vm/terminal') {
              wss.handleUpgrade(req, socket, head, (ws) => {
                handleTerminalWs(ws, { manager, session, trackBridge, untrackBridge });
              });
            } else {
              socket.destroy();
            }
          })
          .catch(() => socket.destroy());
      });
    }
  });
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  const services = await initServices();
  const server = await startServer(PORT, BIND_HOST, services);
  console.log(`Infinity AI VM Runner v${VERSION} listening on ${BIND_HOST}:${PORT}`);
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
