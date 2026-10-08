/**
 * vmRunnerClient.js — HTTP client for the local Infinity AI VM runner
 * (default http://127.0.0.1:4100). The poller and the runner always live
 * on the SAME machine; this client never leaves loopback.
 */
export function createVmRunnerClient({ vmRunnerUrl, fetchImpl = fetch }) {
  const base = String(vmRunnerUrl || 'http://127.0.0.1:4100').replace(/\/+$/, '');
  let sessionToken = null;
  let sessionId = null;

  async function request(method, path, body, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`vm-runner ${method} ${path} → ${res.status}: ${json?.error || json?.message || ''}`);
      err.status = res.status;
      err.code = json?.code;
      throw err;
    }
    return json;
  }

  return {
    get sessionId() {
      return sessionId;
    },

    /** Start (or re-attach to) a VM session. Returns { sessionId }. */
    async start({ target, cpus = 2, memoryMiB = 2048 } = {}) {
      const out = await request('POST', '/vm/start', {
        sessionId: `hunt-${Date.now().toString(36)}`,
        cpus,
        memoryMiB,
        target,
      }, { auth: false });
      sessionId = out.sessionId;
      sessionToken = out.sessionToken;
      return out;
    },

    /** Attach to an existing session (after poller restart). */
    attach(existingSessionId, existingToken) {
      sessionId = existingSessionId;
      sessionToken = existingToken;
    },

    async status() {
      return request('GET', '/vm/status');
    },

    /** Run a shell command in the guest (scope-gated by the runner). */
    async exec(command, { cwd, timeoutMs = 120_000 } = {}) {
      return request('POST', '/vm/exec', { command, cwd, timeoutMs });
    },

    /** Long-running command: start, then poll. */
    async execStart(command, { cwd } = {}) {
      return request('POST', '/vm/exec/start', { command, cwd });
    },

    async execPoll(execId) {
      return request('GET', `/vm/exec/${encodeURIComponent(execId)}/poll`);
    },

    async execKill(execId) {
      return request('POST', `/vm/exec/${encodeURIComponent(execId)}/kill`);
    },

    /** Screenshot (JPEG base64) — kept in memory only, never persisted. */
    async screenshot(width) {
      return request('POST', '/vm/screenshot', width ? { width } : {});
    },

    /** GUI input: { type: 'click'|'type'|'key'|'scroll', x, y, ... } (0–1000 space). */
    async input(action) {
      return request('POST', '/vm/input', action);
    },

    /** Snapshot save/load for pause/resume. */
    async snapshotSave(name = 'hunt') {
      return request('POST', '/vm/snapshot', { name });
    },

    async snapshotLoad(name = 'hunt') {
      return request('POST', '/vm/snapshot/load', { name });
    },

    async stop() {
      return request('POST', '/vm/stop');
    },
  };
}
