// ============================================================================
// Hunt live-stream client.
//
// Documented interface
// --------------------
//   const stream = new HuntStreamClient(huntId, handlers);
//   stream.connect();      // opens WS /api/v1/hunts/:id/stream
//   stream.disconnect();   // closes the socket
//
// handlers:
//   onEvent(type, payload) — 'thinking' | 'tool_call' | 'finding' | 'status' | 'done'
//       thinking  → { text }                 — agent's current reasoning line
//       tool_call → { tool, args?, output? } — a tool invocation; output may arrive
//                                              as follow-up tool_call events with the
//                                              same tool name and an `output` field
//       finding   → { title, severity, detail? } — a vulnerability finding
//       status    → { status, step?, phase? }    — 'running' | 'paused' | 'done' | 'stopped'
//       done      → { summary? }             — hunt finished
//   onError(err)  — transport failure (socket error / non-JSON frame)
//   onClose(reason) — socket closed for good: 'done' (hunt finished) or
//       'exhausted' (reconnect attempts ran out). Not called for a
//       disconnect() by the UI.
//   onReconnecting(attempt, delayMs) — transient drop: the client is
//       retrying (up to 5 attempts, backoff 2s/4s/8s/10s/10s, mirroring
//       useHuntTerminal.js). The UI should show "reconnecting", not
//       force the user to reload the whole page (FIX #443).
//
// When the backend WS is not reachable, connect() reports the failure via
// onError so the UI can show an honest "live stream unavailable" state and a
// Retry button — it never invents hunt data.
//
// DEMO MODE (UI development only): createSimulatedStream(huntId, handlers)
// emits a scripted sequence of events with the same handler interface. It is
// disabled unless VITE_DEMO_MODE=true, and every demo event is tagged
// payload.demo = true so the UI can label it clearly.
// ============================================================================
import { huntStreamWsUrl, getStreamTicket } from './api';

const DEMO_MODE = (() => {
  try {
    return import.meta.env && import.meta.env.VITE_DEMO_MODE === 'true';
  } catch {
    return false;
  }
})();

export class HuntStreamClient {
  constructor(huntId, handlers = {}) {
    this.huntId = huntId;
    this.handlers = handlers;
    this.socket = null;
    this.closedByUs = false;
    this.retryCount = 0;
    this.reconnectTimer = null;
    this.sawDone = false;
  }

  async connect() {
    this.disconnect();
    this.closedByUs = false;
    this.sawDone = false;
    // FIX (#450): fetch a fresh 60s stream ticket for EVERY connect
    // (including auto-reconnects, which may fire after a previous
    // ticket expired) — the long-lived login JWT must never appear
    // in the WS URL. A failed ticket fetch surfaces via onError, and
    // the card's Retry button re-runs this whole connect (fresh
    // ticket included).
    const ticketRes = await getStreamTicket(this.huntId).catch(() => null);
    if (this.closedByUs) return; // disconnected while the ticket was in flight
    if (!ticketRes || !ticketRes.ok || !ticketRes.data || !ticketRes.data.ticket) {
      this.handlers.onError && this.handlers.onError(new Error((ticketRes && ticketRes.error) || 'Could not get a stream ticket'));
      return;
    }
    const url = huntStreamWsUrl(this.huntId, ticketRes.data.ticket);
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.handlers.onError && this.handlers.onError(err);
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.retryCount = 0;
    };

    socket.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        this.handlers.onError && this.handlers.onError(new Error('Malformed stream frame'));
        return;
      }
      const type = msg && (msg.type || msg.event);
      if (!type) return;
      if (type === 'done') this.sawDone = true;
      this.handlers.onEvent && this.handlers.onEvent(type, msg);
    };

    socket.onerror = () => {
      if (!this.closedByUs) {
        this.handlers.onError && this.handlers.onError(new Error('Could not connect to the hunt stream'));
      }
    };

    socket.onclose = () => {
      if (this.closedByUs) return;
      // A close after a 'done' event is the hunt finishing, not a drop.
      if (this.sawDone) {
        this.handlers.onClose && this.handlers.onClose('done');
        return;
      }
      if (this.retryCount < 5) {
        this.retryCount += 1;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        this.handlers.onReconnecting && this.handlers.onReconnecting(this.retryCount, delay);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
        return;
      }
      this.handlers.onClose && this.handlers.onClose('exhausted');
    };
  }

  // Manual retry (e.g. the card's Retry button): fresh attempt counter.
  reconnect() {
    this.retryCount = 0;
    this.connect();
  }

  disconnect() {
    this.closedByUs = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch { /* already closed */ }
      this.socket = null;
    }
  }
}

// --- Demo simulator -----------------------------------------------------------
// Same handler interface as the real client. DEMO ONLY — never used in
// production builds. Enable with VITE_DEMO_MODE=true for UI development.
export function createSimulatedStream(huntId, handlers = {}) {
  if (!DEMO_MODE) {
    throw new Error('Simulated stream is only available with VITE_DEMO_MODE=true');
  }
  const script = [
    [600, 'status', { status: 'running', phase: 'Reconnaissance', demo: true }],
    [1400, 'thinking', { text: 'Enumerating subdomains for the target…', demo: true }],
    [2200, 'tool_call', { tool: 'subfinder', args: '-d target.example -silent', demo: true }],
    [3200, 'tool_call', { tool: 'subfinder', output: 'api.target.example\napp.target.example', demo: true }],
    [4000, 'thinking', { text: 'Fingerprinting the web stack on discovered hosts…', demo: true }],
    [4800, 'finding', { title: 'Missing security header: Content-Security-Policy', severity: 'low', detail: 'Demo finding — replace with live data.', demo: true }],
    [5600, 'tool_call', { tool: 'httpx', args: '-l hosts.txt -title -status-code', demo: true }],
    [6600, 'finding', { title: 'Reflected input without output encoding', severity: 'medium', detail: 'Demo finding — replace with live data.', demo: true }],
    [7400, 'status', { status: 'paused', phase: 'Reconnaissance', demo: true }],
  ];
  let timers = [];
  let stopped = false;
  return {
    connect() {
      stopped = false;
      timers = script.map(([delay, type, payload]) =>
        setTimeout(() => {
          if (!stopped && handlers.onEvent) handlers.onEvent(type, payload);
        }, delay),
      );
    },
    disconnect() {
      stopped = true;
      timers.forEach(clearTimeout);
      timers = [];
      handlers.onClose && handlers.onClose();
    },
  };
}

export const isDemoMode = () => DEMO_MODE;
