/**
 * Guest shell bridge — child process spawned under node-pty by terminal.js.
 *
 * The pty gives the xterm.js client proper terminal semantics (window size,
 * line discipline). This bridge shuttles bytes between the pty stdio and the
 * Infinity guest agent's interactive shell endpoints inside the Kali VM:
 *
 *   stdin data            → POST /shell/<id>/input   { data: base64 }
 *   GET /shell/<id>/poll  → stdout (base64-decoded)
 *
 * Env: INFINITY_GUEST_URL, INFINITY_GUEST_TOKEN, INFINITY_BRIDGE_ID_FILE.
 * The runner learns the shellId by reading the id file.
 *
 * Pure Node.js, no dependencies (must run under any node on the host).
 */
const GUEST_URL = process.env.INFINITY_GUEST_URL;
const TOKEN = process.env.INFINITY_GUEST_TOKEN;
const ID_FILE = process.env.INFINITY_BRIDGE_ID_FILE;

if (!GUEST_URL || !TOKEN) {
  console.error('infinity guest bridge: INFINITY_GUEST_URL and INFINITY_GUEST_TOKEN are required');
  process.exit(2);
}

const { writeFile } = await import('node:fs/promises');

let headers = { Authorization: `Bearer ${TOKEN}` };

async function api(method, path, body) {
  const res = await fetch(`${GUEST_URL}${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`guest ${method} ${path} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { shellId } = await api('POST', '/shell/start', {
    cols: Number(process.env.INFINITY_BRIDGE_COLS || 80),
    rows: Number(process.env.INFINITY_BRIDGE_ROWS || 24),
  });
  if (!shellId) throw new Error('guest did not return a shellId');
  if (ID_FILE) await writeFile(ID_FILE, String(shellId), 'utf8');

  let dead = false;

  process.stdin.on('data', async (chunk) => {
    if (dead) return;
    try {
      await api('POST', `/shell/${encodeURIComponent(shellId)}/input`, {
        data: chunk.toString('base64'),
      });
    } catch {
      // poll loop will notice the dead shell and exit
    }
  });
  process.stdin.on('end', () => {
    dead = true;
    api('POST', `/shell/${encodeURIComponent(shellId)}/kill`).catch(() => {});
    setTimeout(() => process.exit(0), 300);
  });

  const b64ToStdout = (b64) => {
    if (b64) process.stdout.write(Buffer.from(b64, 'base64'));
  };

  // Drain loop: pull guest output into the pty.
  for (;;) {
    await new Promise((r) => setTimeout(r, 60));
    let res;
    try {
      res = await api('GET', `/shell/${encodeURIComponent(shellId)}/poll`);
    } catch {
      break; // guest unreachable — exit, the runner reports it
    }
    b64ToStdout(res.output);
    if (!res.alive) break;
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`infinity guest bridge failed: ${err.message}`);
  process.exit(1);
});
