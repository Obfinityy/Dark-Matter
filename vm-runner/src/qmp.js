/**
 * qmp.js — minimal QEMU Machine Protocol (QMP) client over TCP loopback.
 *
 * Used for VM snapshots: `savevm` / `loadvm` via the human monitor.
 * QEMU is launched with `-qmp tcp:127.0.0.1:<qmpPort>,server=on,wait=off`
 * (TCP loopback — unix sockets are unreliable in QEMU-on-Windows; the
 * port is never exposed off-host).
 *
 * Protocol: connect → read greeting → qmp_capabilities → command → read
 * response. Each command gets a fresh connection (simple, race-free).
 */
import net from 'node:net';

const SOCKET_TIMEOUT_MS = 30000;

/** Run one QMP transaction: connect, negotiate, execute, return the response. */
export function qmpCommand(qmpPort, execute, args = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: '127.0.0.1', port: qmpPort });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('qmp_timeout'));
    }, SOCKET_TIMEOUT_MS);
    timer.unref?.();

    let buffer = '';
    let stage = 'greeting'; // greeting → capabilities → command → done

    const send = (obj) => sock.write(JSON.stringify(obj) + '\n');

    const fail = (err) => {
      clearTimeout(timer);
      sock.destroy();
      reject(err);
    };

    sock.on('connect', () => {
      // Wait for the greeting; QEMU sends it immediately.
    });

    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      // QMP sends one JSON object per line.
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (stage === 'greeting' && msg.QMP) {
          stage = 'capabilities';
          send({ execute: 'qmp_capabilities' });
        } else if (stage === 'capabilities' && msg.return !== undefined) {
          stage = 'command';
          const cmd = { execute };
          if (args && Object.keys(args).length) cmd.arguments = args;
          send(cmd);
        } else if (stage === 'command') {
          clearTimeout(timer);
          sock.end();
          if (msg.error) {
            reject(new Error(`qmp_error: ${msg.error.desc || msg.error.class || 'unknown'}`));
          } else {
            resolve(msg.return);
          }
          return;
        }
        // Async events (timestamp/event) are ignored.
      }
    });

    sock.on('error', fail);
    sock.on('timeout', () => fail(new Error('qmp_timeout')));
  });
}

/** Save a named VM snapshot (RAM + device state) via the human monitor. */
export function qmpSaveVm(qmpPort, name) {
  const safe = String(name || 'hunt').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'hunt';
  return qmpCommand(qmpPort, 'human-monitor-command', {
    'command-line': `savevm ${safe}`,
  }).then(() => safe);
}

/** Restore a named VM snapshot. */
export function qmpLoadVm(qmpPort, name) {
  const safe = String(name || 'hunt').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'hunt';
  return qmpCommand(qmpPort, 'human-monitor-command', {
    'command-line': `loadvm ${safe}`,
  }).then(() => safe);
}

/** Delete a named VM snapshot. */
export function qmpDeleteVm(qmpPort, name) {
  const safe = String(name || 'hunt').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'hunt';
  return qmpCommand(qmpPort, 'human-monitor-command', {
    'command-line': `delvm ${safe}`,
  }).then(() => safe);
}
