// Machine control — "Take Control of This Machine" (owner takeover).
//
// The owner takes over the hunt container's Kali desktop himself from the
// frontend: full mouse + keyboard on the real X display, any tool
// (Metasploit, a terminal, anything), while the agent's own GUI actions
// pause so the two drivers never fight over the same screen. The hunt
// itself is NOT paused or stopped — only the agent's GUI/browser actions
// are skipped while the lock is held (see the control gate in
// humanLoop.js); shell, search, recall and planning turns keep running.
//
// How the interactive channel works (no new network exposure):
//   1. The desktop stack already runs x11vnc -viewonly on 5900
//      (loopback-only). Taking control starts a SECOND x11vnc on 5901,
//      bound to the container loopback, WITHOUT -viewonly — same X
//      display :99, so the owner sees and drives exactly what the
//      agent sees. No password: authentication happens at the backend
//      (JWT ticket + hunt ownership), exactly like the view-only
//      server, which is also -nopw loopback-only.
//   2. The backend never opens a TCP port to the container. The WS
//      handler spawns `docker exec -i <container> python3 -c <fwd>`,
//      a tiny stdio<->TCP forwarder that connects to 127.0.0.1:5901
//      from INSIDE the container. The backend pipes the browser's
//      WebSocket frames (raw RFB bytes, via the noVNC client) straight
//      through that stdio pipe. No listener is ever bound on the
//      container's bridge interface, and the interactive VNC exists
//      only while a takeover is active — it is killed on release.
//   3. Releasing (Done / Cancel / WS close / expiry) kills the 5901
//      server, closes the tunnel, frees the lock, and the agent's GUI
//      actions resume on its next turn.
//
// The lock is in-memory (a backend restart frees every lock, and the
// restart also recreates every hunt container, so no stale VNC can
// survive it). A lock expires after CONTROL_TTL_MS so a crashed
// browser tab cannot hold a machine forever; the WS close path
// releases immediately in the normal case.
import { spawn } from 'node:child_process';

export const CONTROL_VNC_PORT = 5901;
export const CONTROL_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const CONTROL_VNC_PID_FILE = '/tmp/dm-control-vnc.pid';
export const CONTROL_VNC_LOG = '/tmp/dm-control-vnc.log';

// ---------------------------------------------------------------------------
// Control lock (per hunt, single holder).
// ---------------------------------------------------------------------------

// huntId -> { userId, username, takenAt }
const controlLocks = new Map();

function lockNow(now) {
  return typeof now === 'number' ? now : Date.now();
}

function purgeExpired(now) {
  const t = lockNow(now);
  for (const [huntId, lock] of controlLocks) {
    if (t - lock.takenAt > CONTROL_TTL_MS) controlLocks.delete(huntId);
  }
}

/**
 * Take the control lock for a hunt.
 * FIX (#346): taking interactive control of the hunt machine is the
 * most powerful action in the product (live GUI/keyboard inside the
 * container) — it now requires the 'maximum' control level, same
 * family as the high-mode hunt gate. Admins bypass (they own the box).
 * The existing-lock check stays first so a held lock still reports
 * its holder instead of leaking the caller's level decision.
 * @returns {{ok: true, lock} | {ok: false, error: 'already_controlled', holder: string} | {ok: false, error: 'control_restricted'}}
 */
export function takeControl(huntId, user, now) {
  purgeExpired(now);
  const existing = controlLocks.get(huntId);
  if (existing) {
    return { ok: false, error: 'already_controlled', holder: existing.username };
  }
  const isAdmin = user && user.role === 'admin';
  const control = (user && user.control) || 'minimal';
  if (!isAdmin && control !== 'maximum') {
    return { ok: false, error: 'control_restricted' };
  }
  const lock = {
    userId: String(user.id || user.sub || ''),
    username: String(user.username || user.id || 'owner'),
    role: String(user.role || 'user'),
    takenAt: lockNow(now),
  };
  controlLocks.set(huntId, lock);
  return { ok: true, lock };
}

/**
 * Release the control lock. Only the holder may release, except an
 * admin may force-release someone else's lock (the owner is admin).
 * @returns {{ok: true} | {ok: false, error: 'not_controlled' | 'not_holder'}}
 */
export function releaseControl(huntId, user, now) {
  purgeExpired(now);
  const existing = controlLocks.get(huntId);
  if (!existing) return { ok: false, error: 'not_controlled' };
  const userId = String((user && (user.id || user.sub)) || '');
  const isHolder = userId !== '' && userId === existing.userId;
  const isAdmin = user && user.role === 'admin';
  if (!isHolder && !isAdmin) return { ok: false, error: 'not_holder' };
  controlLocks.delete(huntId);
  return { ok: true };
}

/** The current lock for a hunt, or null (expired locks read as free). */
export function getControl(huntId, now) {
  purgeExpired(now);
  return controlLocks.get(huntId) || null;
}

/** True while a (non-expired) lock is held for the hunt. */
export function isMachineControlled(huntId, now) {
  return getControl(huntId, now) !== null;
}

/** Test hook: forget every lock. */
export function resetControlLocks() {
  controlLocks.clear();
}

// ---------------------------------------------------------------------------
// Interactive VNC inside the hunt container (loopback-only, port 5901).
// ---------------------------------------------------------------------------

const VNC_START_CMD =
  `if [ -f ${CONTROL_VNC_PID_FILE} ] && kill -0 "$(cat ${CONTROL_VNC_PID_FILE})" 2>/dev/null; then echo running; ` +
  `else nohup x11vnc -display :99 -localhost -forever -shared -nopw -rfbport ${CONTROL_VNC_PORT} ` +
  `>${CONTROL_VNC_LOG} 2>&1 & echo $! > ${CONTROL_VNC_PID_FILE}; sleep 1; ` +
  `if kill -0 "$(cat ${CONTROL_VNC_PID_FILE})" 2>/dev/null; then echo started; else echo failed; fi; fi`;

// Bracket trick ([x] in the pattern) so pkill never matches the very
// `sh -c` that carries the command line — the same self-match hazard
// as pkill -f on the host (AGENTS.md).
const VNC_STOP_CMD =
  `if [ -f ${CONTROL_VNC_PID_FILE} ]; then kill "$(cat ${CONTROL_VNC_PID_FILE})" 2>/dev/null; rm -f ${CONTROL_VNC_PID_FILE}; fi; ` +
  `pkill -f 'x11vn[c] -display :99.*rfbport ${CONTROL_VNC_PORT}' 2>/dev/null; echo stopped`;

/**
 * Start the interactive control VNC inside the hunt container.
 * Ensures the desktop stack first (the same on-demand starter the
 * screenshot poller uses). Idempotent: an already-running control VNC
 * is a no-op. NEVER throws.
 * @returns {{ok: true, alreadyRunning?: boolean} | {ok: false, error: string}}
 */
export async function startControlDesktop(huntId, deps = {}) {
  const exec = deps.exec || (await import('./huntRunner.js')).execInHuntContainer;
  const startDesktop = deps.startDesktop || (await import('./huntRunner.js')).startHuntDesktop;
  try {
    const desktop = await startDesktop(huntId);
    if (!desktop.ok) return { ok: false, error: desktop.error || 'desktop_unavailable' };
    const res = await exec(huntId, VNC_START_CMD, 20000, { bypassTmux: true });
    if (res && res.containerMissing) return { ok: false, error: 'container_not_running' };
    const out = String((res && res.stdout) || '');
    if (out.includes('running')) return { ok: true, alreadyRunning: true };
    if (out.includes('started')) return { ok: true };
    return { ok: false, error: 'control_vnc_failed' };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/**
 * Stop the interactive control VNC inside the hunt container.
 * Best-effort and NEVER throws — a missing container or a dead VNC
 * is already the desired end state.
 */
export async function stopControlDesktop(huntId, deps = {}) {
  const exec = deps.exec || (await import('./huntRunner.js')).execInHuntContainer;
  try {
    await exec(huntId, VNC_STOP_CMD, 15000, { bypassTmux: true });
  } catch { /* already stopped is fine */ }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// RFB tunnel: backend WS <-> container-loopback VNC, via docker exec stdio.
// ---------------------------------------------------------------------------

// Tiny stdio<->TCP forwarder, run as `python3 -c` INSIDE the container.
// It connects to the loopback VNC from inside the container's own
// network namespace, so the backend never opens a TCP connection to
// the container and no listener is ever bound on the bridge. stdin is
// the RFB stream from the browser, stdout is the RFB stream back.
// A failed connect exits non-zero immediately (the WS handler turns
// that into a 1011 close).
//
// LANE AN (25 Oct 2026, live-proven): stdin MUST be read with os.read,
// never `sys.stdin.buffer.read(n)`. BufferedReader.read(n) waits for
// EXACTLY n bytes or EOF — so the browser's 12-byte RFB version reply
// sat in the forwarder forever while the 5901 VNC waited for the
// client's protocol version and dropped the connection
// ("rfbProcessClientProtocolVersion: client gone"), leaving a blank
// desktop for ~30s. os.read returns as soon as ANY data is available.
// The socket direction already behaves that way (s.recv returns on
// first data), so it is unchanged.
export const CONTROL_FORWARDER_CODE = [
  'import os, socket, sys, threading',
  `s = socket.create_connection(('127.0.0.1', ${CONTROL_VNC_PORT}), timeout=10)`,
  'def to_sock():',
  '    try:',
  '        while True:',
  '            b = os.read(0, 65536)',
  '            if not b: break',
  '            s.sendall(b)',
  '    except Exception:',
  '        pass',
  '    finally:',
  '        try: s.shutdown(socket.SHUT_WR)',
  '        except Exception: pass',
  'threading.Thread(target=to_sock, daemon=True).start()',
  'try:',
  '    while True:',
  '        b = s.recv(65536)',
  '        if not b: break',
  '        sys.stdout.buffer.write(b)',
  '        sys.stdout.buffer.flush()',
  'except Exception:',
  '    pass',
].join('\n');

/**
 * Spawn the RFB tunnel for a hunt's control VNC.
 * @returns the child process (stdin/stdout/stderr pipes) — the caller
 *   pipes its WebSocket to proc.stdin/stdout and kills proc on close.
 *   Throws only when the spawn itself fails (docker missing, etc.).
 */
export function spawnControlTunnel(huntId, deps = {}) {
  const spawnFn = deps.spawn || spawn;
  const nameFn = deps.containerName || null;
  const container = nameFn
    ? nameFn(huntId)
    : `dm-hunt-${String(huntId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
  return spawnFn('docker', ['exec', '-i', container, 'python3', '-c', CONTROL_FORWARDER_CODE], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
