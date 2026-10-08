/**
 * Interactive terminal for the Infinity AI VM Runner (backs WS /vm/terminal).
 *
 * node-pty spawns the guest shell bridge (guestShellBridge.js), which gives
 * the xterm.js client a real pty (window size, line discipline) while the
 * actual shell runs inside the Kali VM via the guest agent.
 *
 * node-pty is an optional dependency: on machines where its native build is
 * unavailable, terminal sessions fail fast with a clear error while every
 * other endpoint keeps working.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { readFile, unlink } from 'node:fs/promises';

const require = createRequire(import.meta.url);
let pty = null;
try {
  pty = require('node-pty');
} catch {
  pty = null; // optional native module — degrade gracefully
}

export function isTerminalAvailable() {
  return pty !== null;
}

const BRIDGE_PATH = fileURLToPath(new URL('./guestShellBridge.js', import.meta.url));

async function waitForFile(file, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await readFile(file, 'utf8');
    } catch {
      if (Date.now() > deadline) throw new Error('timed out waiting for the guest shell to start');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/**
 * Open an interactive shell in the session's VM.
 * @returns {{ shellId, write, resize, kill, onData }}
 */
export async function createTerminalBridge({ guestClient, cols = 80, rows = 24 }) {
  if (!pty) {
    throw new Error(
      'terminal_unavailable: node-pty is not installed on this machine. ' +
        'Run `npm install` inside vm-runner to enable the live terminal.',
    );
  }
  const { shellId } = await guestClient.shellStart({ cols, rows });
  const idFile = path.join(os.tmpdir(), `infinity-term-${process.pid}-${Date.now()}.id`);

  const term = pty.spawn(process.execPath, [BRIDGE_PATH], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.tmpdir(),
    env: {
      ...process.env,
      INFINITY_GUEST_URL: guestClient.baseUrl,
      INFINITY_GUEST_TOKEN: guestClient.token,
      INFINITY_BRIDGE_ID_FILE: idFile,
      INFINITY_BRIDGE_COLS: String(cols),
      INFINITY_BRIDGE_ROWS: String(rows),
    },
  });

  // Confirm the bridge actually connected to the guest shell.
  try {
    const reported = (await waitForFile(idFile)).trim();
    if (reported !== String(shellId)) {
      throw new Error(`bridge reported unexpected shell id`);
    }
  } catch (err) {
    try {
      term.kill();
    } catch {
      // ignore
    }
    try {
      await guestClient.shellKill(shellId);
    } catch {
      // ignore
    }
    throw err;
  } finally {
    unlink(idFile).catch(() => {});
  }

  let killed = false;
  return {
    shellId,
    write(data) {
      if (!killed) term.write(String(data));
    },
    async resize(newCols, newRows) {
      if (killed) return;
      try {
        term.resize(newCols, newRows);
      } catch {
        // ignore
      }
      try {
        await guestClient.shellResize(shellId, newCols, newRows);
      } catch {
        // guest may already be gone
      }
    },
    async kill() {
      if (killed) return;
      killed = true;
      try {
        term.kill();
      } catch {
        // ignore
      }
      try {
        await guestClient.shellKill(shellId);
      } catch {
        // ignore
      }
    },
    onData(cb) {
      term.onData(cb);
    },
    onExit(cb) {
      term.onExit(cb);
    },
  };
}
