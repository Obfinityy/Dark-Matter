/**
 * RFB-over-WebSocket proxy for the Infinity AI VM Runner (backs WS /vm/vnc).
 *
 * QEMU serves the VM's virtual display as a VNC server bound to 127.0.0.1.
 * The noVNC client in the browser speaks RFB over the WebSocket; this proxy
 * shuttles raw bytes between the WebSocket and the VNC TCP socket in both
 * directions. Session-token authentication happens before the upgrade is
 * accepted, so unauthenticated clients never reach the RFB handshake.
 */
import net from 'node:net';

/**
 * Pipe a WebSocket (binary frames) to a VNC TCP server.
 * @param {import('ws').WebSocket} ws - already-authenticated client socket
 * @param {{ host: string, port: number }} target - QEMU -vnc endpoint
 * @returns {Promise<{ close: () => void }>}
 */
export function attachVncProxy(ws, { host = '127.0.0.1', port }) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, host);
    let settled = false;

    const cleanup = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      try {
        sock.destroy();
      } catch {
        // ignore
      }
    };

    sock.on('connect', () => {
      if (settled) return;
      settled = true;
      ws.on('message', (data) => {
        if (sock.writable) sock.write(data);
      });
      sock.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) ws.send(chunk, { binary: true });
      });
      const onEnd = () => cleanup();
      sock.on('error', onEnd);
      sock.on('close', onEnd);
      ws.on('close', onEnd);
      ws.on('error', onEnd);
      resolve({ close: cleanup });
    });

    sock.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`cannot reach the VM display at ${host}:${port}: ${err.message}`));
      }
    });

    // If the client vanishes before connect, do not leak the socket.
    ws.on('close', () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('client disconnected before VNC connect'));
      }
    });
  });
}
