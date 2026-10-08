/**
 * Client for the Infinity guest agent (guest/guestd.py) running inside the
 * Kali VM. The runner reaches it through QEMU's hostfwd on 127.0.0.1:<guestPort>
 * → guest 127.0.0.1:1024.
 *
 * Auth: every request carries `Authorization: Bearer <sessionToken>`. Before
 * the token is ever sent to a port, the runner performs the proof-of-possession
 * handshake (GET /proof?nonce=) so a stale port takeover cannot harvest it.
 */
import { generateNonce, computeProof, verifyProof } from './token.js';

export class GuestError extends Error {
  constructor(message, code = 'guest_error') {
    super(message);
    this.name = 'GuestError';
    this.code = code;
  }
}

export class GuestClient {
  constructor({ host = '127.0.0.1', port, token, timeoutMs = 30000 }) {
    if (!port) throw new Error('GuestClient requires a port');
    this.baseUrl = `http://${host}:${port}`;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, { body, query, responseType = 'json' } = {}) {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new GuestError('guest agent rejected the session token', 'bad_token');
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new GuestError(`guest agent ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      if (responseType === 'buffer') return Buffer.from(await res.arrayBuffer());
      if (responseType === 'text') return res.text();
      return res.json();
    } catch (err) {
      if (err instanceof GuestError) throw err;
      if (err.name === 'AbortError') {
        throw new GuestError(`guest agent ${method} ${path} timed out after ${this.timeoutMs}ms`, 'guest_timeout');
      }
      throw new GuestError(`guest agent unreachable at ${this.baseUrl}: ${err.message}`, 'guest_unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Proof-of-possession handshake: ask the guest to prove it holds the token
   * without sending the token itself. Returns true when the proof verifies.
   */
  async proofHandshake() {
    const nonce = generateNonce();
    const res = await this.request('GET', '/proof', { query: { nonce } });
    return verifyProof(this.token, nonce, res?.proof);
  }

  health() {
    return this.request('GET', '/health');
  }

  /** Sync exec: { command, cwd?, timeoutMs? } → { exit_code, stdout, stderr, timed_out } */
  exec({ command, cwd, timeoutMs = 120000 }) {
    return this.request('POST', '/exec', { body: { command, cwd, timeoutMs } });
  }

  /** Async exec: → { execId } */
  execStart({ command, cwd, timeoutMs = 3600000 }) {
    return this.request('POST', '/exec/start', { body: { command, cwd, timeoutMs } });
  }

  /** Poll async exec: → { done, exit_code?, stdout, stderr } (cumulative output) */
  execPoll(execId) {
    return this.request('GET', `/exec/${encodeURIComponent(execId)}/poll`);
  }

  execKill(execId) {
    return this.request('POST', `/exec/${encodeURIComponent(execId)}/kill`);
  }

  /** Desktop screenshot → JPEG Buffer. */
  screenshot({ width = 1280 } = {}) {
    return this.request('GET', '/screenshot', { query: { width: String(width) }, responseType: 'buffer' });
  }

  /** Guest display geometry → { width, height } (for normalized→pixel mapping). */
  display() {
    return this.request('GET', '/display');
  }

  /** Input action: { type: click|move|type|key|scroll, x?, y?, button?, text?, key?, dy? } (pixels). */
  input(action) {
    return this.request('POST', '/input', { body: action });
  }

  // ---- Interactive shells (backing the /vm/terminal WebSocket) ----

  shellStart({ cols = 80, rows = 24 } = {}) {
    return this.request('POST', '/shell/start', { body: { cols, rows } });
  }

  /** → { output: base64, alive } */
  shellPoll(shellId) {
    return this.request('GET', `/shell/${encodeURIComponent(shellId)}/poll`);
  }

  shellInput(shellId, dataBase64) {
    return this.request('POST', `/shell/${encodeURIComponent(shellId)}/input`, {
      body: { data: dataBase64 },
    });
  }

  shellResize(shellId, cols, rows) {
    return this.request('POST', `/shell/${encodeURIComponent(shellId)}/resize`, { body: { cols, rows } });
  }

  shellKill(shellId) {
    return this.request('POST', `/shell/${encodeURIComponent(shellId)}/kill`);
  }

  /** Ask the guest OS to power itself off (QEMU exits with it). */
  poweroff() {
    return this.request('POST', '/poweroff');
  }
}
