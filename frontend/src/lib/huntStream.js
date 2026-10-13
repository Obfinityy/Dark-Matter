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
//   onClose()     — socket closed cleanly
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
import { huntStreamWsUrl } from './api';

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
  }

  connect() {
    this.disconnect();
    this.closedByUs = false;
    const url = huntStreamWsUrl(this.huntId);
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.handlers.onError && this.handlers.onError(err);
      return;
    }
    this.socket = socket;

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
      this.handlers.onEvent && this.handlers.onEvent(type, msg);
    };

    socket.onerror = () => {
      if (!this.closedByUs) {
        this.handlers.onError && this.handlers.onError(new Error('Could not connect to the hunt stream'));
      }
    };

    socket.onclose = () => {
      if (!this.closedByUs) {
        this.handlers.onClose && this.handlers.onClose();
      }
    };
  }

  disconnect() {
    this.closedByUs = true;
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
