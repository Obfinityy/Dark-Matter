/**
 * vmRunnerApi.js — client for the Infinity AI VM Runner
 * (the user's local service, http://127.0.0.1:4100, per vmEndpoint.js).
 *
 * API contract (design doc §2):
 *   GET  /health            { ok, version, qemu: {found, accel} }
 *   GET  /doctor            { qemuPath, accel, whpxEnabled, kaliImage, diskFreeBytes, problems: [] }
 *   POST /vm/start          { sessionId, cpus, memoryMiB, diskBytes? } → { pid, guestPort, vncPort, state, sessionToken }
 *   GET  /vm/status?sessionId=  → { state, pid, uptimeS, detail? }
 *   POST /vm/stop           { sessionId, poweroff } → { ok }
 *   POST /vm/exec           { sessionId, command, cwd?, timeoutMs } → { exit_code, stdout, stderr, timed_out }
 *   POST /vm/exec/start     same as exec → { execId }
 *   GET  /vm/exec/:execId/poll → { done, exit_code?, outputDelta, stdout, stderr }
 *   POST /vm/exec/:execId/kill → { ok }
 *   POST /vm/screenshot     { sessionId, width } → image/jpeg bytes
 *   POST /vm/input          { sessionId, action } → { ok }
 *   WS   /vm/vnc?sessionId=&token=      RFB-over-WebSocket proxy (noVNC)
 *   WS   /vm/terminal?sessionId=&token= xterm.js frames {t:"in"|"out"|"resize", data|cols,rows}
 *
 * SECURITY: the per-session bearer token is held ONLY in module memory
 * (tokenBySession Map) — never localStorage, never logged, never in URLs
 * except the WS query string the runner requires.
 */

import { getVmEndpoint } from './vmEndpoint.js';

/** Session token store — module memory only. Cleared on stop / page unload. */
const tokenBySession = new Map();

/** Friendly, actionable error for runner failures. */
export class VmRunnerError extends Error {
  constructor(code, message, { doctor = null, hint = '' } = {}) {
    super(message);
    this.name = 'VmRunnerError';
    this.code = code;     // not_running | bad_token | guest_unreachable | qemu_missing | image_missing | unreachable
    this.doctor = doctor; // /doctor report when available
    this.hint = hint;
  }
}

function endpoint() {
  return getVmEndpoint();
}

function authHeaders(sessionId) {
  const token = sessionId ? tokenBySession.get(sessionId) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * On a connect failure, query /doctor to explain WHY, then surface the
 * friendly "start the runner" message. `doctor` may be null if even
 * /doctor is unreachable (runner not started at all).
 */
async function doctorOnFailure(cause) {
  let doctor = null;
  try {
    const res = await fetch(`${endpoint().baseUrl}/doctor`, { method: 'GET' });
    if (res.ok) doctor = await res.json();
  } catch { /* runner down — expected path */ }
  const problems = Array.isArray(doctor?.problems) ? doctor.problems : [];
  const detail = problems.length ? ` ${problems[0]}` : '';
  return new VmRunnerError('unreachable',
    `Could not reach the Infinity VM Runner on your PC.${detail}`,
    {
      doctor,
      hint: 'Start Infinity VM Runner on your PC, then try again.'
    });
}

async function request(method, path, { sessionId, body, timeoutMs = 15000 } = {}) {
  const url = `${endpoint().baseUrl}${path}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeaders(sessionId) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch { data = null; }
    }
    if (!res.ok || (data && data.ok === false)) {
      const code = data?.code || `http_${res.status}`;
      throw new VmRunnerError(code, data?.message || `Runner request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (err instanceof VmRunnerError) throw err;
    // Network-level failure (runner not started / wrong URL): ask /doctor why.
    throw await doctorOnFailure(err);
  } finally {
    clearTimeout(timer);
  }
}

/* ── health / doctor ─────────────────────────────────────────────── */

export async function vmHealth() {
  try {
    return await request('GET', '/health', { timeoutMs: 5000 });
  } catch (err) {
    if (err instanceof VmRunnerError) throw err;
    throw await doctorOnFailure(err);
  }
}

export async function vmDoctor() {
  try {
    return await request('GET', '/doctor', { timeoutMs: 10000 });
  } catch (err) {
    if (err instanceof VmRunnerError) throw err;
    throw await doctorOnFailure(err);
  }
}

/* ── VM lifecycle ────────────────────────────────────────────────── */

export async function startVm(sessionId, { cpus = 2, memoryMiB = 2048, diskBytes } = {}) {
  const data = await request('POST', '/vm/start', {
    body: { sessionId, cpus, memoryMiB, ...(diskBytes ? { diskBytes } : {}) },
    timeoutMs: 60000
  });
  if (data?.sessionToken) tokenBySession.set(sessionId, data.sessionToken);
  return data;
}

export async function vmStatus(sessionId) {
  return request('GET', `/vm/status?sessionId=${encodeURIComponent(sessionId)}`, {
    sessionId,
    timeoutMs: 8000
  });
}

export async function stopVm(sessionId, { poweroff = true } = {}) {
  try {
    return await request('POST', '/vm/stop', { sessionId, body: { sessionId, poweroff }, timeoutMs: 30000 });
  } finally {
    tokenBySession.delete(sessionId);
  }
}

/** True when this session has a live bearer token in memory. */
export function hasVmToken(sessionId) {
  return tokenBySession.has(sessionId);
}

/* ── exec ────────────────────────────────────────────────────────── */

export async function vmExec(sessionId, command, { cwd, timeoutMs = 120000 } = {}) {
  return request('POST', '/vm/exec', {
    sessionId,
    body: { sessionId, command, ...(cwd ? { cwd } : {}), timeoutMs },
    timeoutMs: timeoutMs + 10000
  });
}

export async function vmExecStart(sessionId, command, { cwd, timeoutMs = 120000 } = {}) {
  return request('POST', '/vm/exec/start', {
    sessionId,
    body: { sessionId, command, ...(cwd ? { cwd } : {}), timeoutMs }
  });
}

export async function vmExecPoll(sessionId, execId) {
  return request('GET', `/vm/exec/${encodeURIComponent(execId)}/poll`, { sessionId, timeoutMs: 10000 });
}

export async function vmExecKill(sessionId, execId) {
  return request('POST', `/vm/exec/${encodeURIComponent(execId)}/kill`, { sessionId });
}

/* ── screenshot / input ──────────────────────────────────────────── */

export async function vmScreenshot(sessionId, { width = 1280 } = {}) {
  const url = `${endpoint().baseUrl}/vm/screenshot`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeaders(sessionId) },
      body: JSON.stringify({ sessionId, width })
    });
    if (!res.ok) throw new VmRunnerError(`http_${res.status}`, 'Screenshot request failed');
    return await res.blob(); // image/jpeg
  } catch (err) {
    if (err instanceof VmRunnerError) throw err;
    throw await doctorOnFailure(err);
  } finally {
    clearTimeout(timer);
  }
}

export async function vmInput(sessionId, action) {
  return request('POST', '/vm/input', { sessionId, body: { sessionId, action }, timeoutMs: 10000 });
}

/* ── websocket URLs (noVNC / xterm.js) ───────────────────────────── */

function wsUrl(path, sessionId) {
  const token = tokenBySession.get(sessionId);
  const params = new URLSearchParams({ sessionId });
  if (token) params.set('token', token);
  return `${endpoint().wsUrl}${path}?${params.toString()}`;
}

/** WebSocket URL for the noVNC RFB proxy (/vm/vnc). */
export function vncSocketUrl(sessionId) {
  return wsUrl('/vm/vnc', sessionId);
}

/** WebSocket URL for the terminal bridge (/vm/terminal). */
export function terminalSocketUrl(sessionId) {
  return wsUrl('/vm/terminal', sessionId);
}

/** Snapshot of the current endpoint (for status display). */
export function runnerEndpointInfo() {
  return endpoint();
}
