// WebSocket / stream error guards.
//
// 25 Oct 2026, 20:35 IST — the backend died on an unhandled 'error'
// event: "Error: write EPIPE, Emitted 'error' event on Socket
// instance" (server.js:375, the Take Control WS handler), exit 1.
// The handler wrote RFB bytes to the tunnel child's stdin inside
// try/catch, but a child-process stdio Socket fails ASYNCHRONOUSLY:
// `tunnel.stdin` had no 'error' listener, so the EPIPE from the dead
// python forwarder became an unhandled 'error' event and crashed the
// Node process. systemd restarted it and the hunt auto-resumed — but
// one dead socket must never be able to kill the backend again.
//
// The rules these helpers encode:
// - Every stream/socket that can emit 'error' gets a listener, even
//   when the error is only logged or swallowed. Node treats an
//   'error' event with no listener as a fatal throw.
// - `ws.send` is always called with a callback (after a readyState
//   check): without a callback a send on a closing socket can throw
//   synchronously, and an async send failure otherwise surfaces as
//   an 'error' event on the socket.
import { WebSocket } from 'ws';

/**
 * Attach a one-shot 'error' listener to a stream, socket, or
 * WebSocket. Fires at most once; the callback itself is wrapped so
 * the guard can never throw. Returns true when a listener was
 * attached, false for null / non-emitters (safe to call on a
 * maybe-missing stdio stream).
 */
export function guardStreamError(stream, onError) {
  if (!stream || typeof stream.once !== 'function') return false;
  stream.once('error', (err) => {
    try {
      if (typeof onError === 'function') onError(err);
    } catch { /* the guard must never throw */ }
  });
  return true;
}

/**
 * Send on a WebSocket without ever throwing. Returns true when the
 * send was attempted (socket open at check time), false when the
 * socket was not open. Async send failures go to the optional
 * callback instead of surfacing as 'error' events on the socket.
 */
export function safeSend(ws, data, onError) {
  if (!ws || typeof ws.send !== 'function') return false;
  try {
    if (ws.readyState !== WebSocket.OPEN) return false;
  } catch { return false; }
  try {
    ws.send(data, (err) => {
      if (err) {
        try {
          if (typeof onError === 'function') onError(err);
        } catch { /* never throw from the send callback */ }
      }
    });
  } catch { return false; }
  return true;
}
