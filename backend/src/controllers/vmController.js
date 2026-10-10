/**
 * vmController — Backend proxy for the local VM Runner.
 *
 * The VM Runner is a separate Node service on the USER'S machine
 * (http://127.0.0.1:4100) that hosts the Kali Linux sandbox VM.
 * These endpoints let the frontend control the VM through the backend's
 * single URL, instead of talking to :4100 directly.
 *
 * Security: all routes require auth. The backend only proxies to loopback —
 * it never exposes the VM runner to the network itself.
 */

const VM_RUNNER_BASE = process.env.VM_RUNNER_URL || 'http://127.0.0.1:4100';

// Security: the backend proxies computer-control commands to the VM runner.
// It must ONLY ever talk to loopback — a non-loopback VM_RUNNER_URL would
// turn a cloud deployment into a remote VM-control relay. Fail fast at
// startup rather than proxying anywhere unexpected.
{
  let hostname;
  try {
    hostname = new URL(VM_RUNNER_BASE).hostname.toLowerCase();
  } catch {
    throw new Error(
      `[vm] Invalid VM_RUNNER_URL "${VM_RUNNER_BASE}" — must be a valid URL with a loopback host`
    );
  }
  const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `[vm] Refusing to start: VM_RUNNER_URL host "${hostname}" is not loopback. ` +
        'The VM runner must run on this machine (127.0.0.1, localhost, or ::1) — ' +
        'the backend never proxies computer-control commands to a remote host.'
    );
  }
}

async function proxyToRunner(path, { method = 'GET', body = null, token = null, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${VM_RUNNER_BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('VM runner timeout — is the Infinity VM Runner running on this machine?');
    }
    throw new Error(`VM runner unreachable at ${VM_RUNNER_BASE}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function createVmController() {
  return {
    /** GET /vm/health — is the local VM runner alive? */
    async health(req, res) {
      try {
        const r = await proxyToRunner('/health', { timeoutMs: 5000 });
        res.json({ runnerUp: r.ok, runner: r.data });
      } catch (err) {
        res.json({ runnerUp: false, error: err.message });
      }
    },

    /** GET /vm/doctor — full diagnostics from the runner. */
    async doctor(req, res) {
      try {
        const r = await proxyToRunner('/doctor', { timeoutMs: 10000 });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** POST /vm/start — boot the Kali VM. Returns session token. */
    async start(req, res) {
      try {
        const r = await proxyToRunner('/vm/start', {
          method: 'POST',
          body: req.body || {},
          timeoutMs: 120000,
        });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** GET /vm/status — VM state. Query: ?sessionId=... Header: Authorization Bearer <vmToken> */
    async status(req, res) {
      try {
        const vmToken = (req.headers['x-vm-token'] || '').replace(/^Bearer\s+/i, '');
        const qs = req.query.sessionId ? `?sessionId=${encodeURIComponent(req.query.sessionId)}` : '';
        const r = await proxyToRunner(`/vm/status${qs}`, { token: vmToken || null });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** POST /vm/stop — shut down the VM. */
    async stop(req, res) {
      try {
        const vmToken = (req.headers['x-vm-token'] || '').replace(/^Bearer\s+/i, '');
        const r = await proxyToRunner('/vm/stop', {
          method: 'POST',
          body: req.body || {},
          token: vmToken || null,
          timeoutMs: 60000,
        });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** POST /vm/screenshot — grab the current VM screen (base64 PNG). */
    async screenshot(req, res) {
      try {
        const vmToken = (req.headers['x-vm-token'] || '').replace(/^Bearer\s+/i, '');
        const r = await proxyToRunner('/vm/screenshot', {
          method: 'POST',
          body: req.body || {},
          token: vmToken || null,
          timeoutMs: 15000,
        });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** POST /vm/exec — run a shell command inside the VM. */
    async exec(req, res) {
      try {
        const vmToken = (req.headers['x-vm-token'] || '').replace(/^Bearer\s+/i, '');
        const r = await proxyToRunner('/vm/exec', {
          method: 'POST',
          body: req.body || {},
          token: vmToken || null,
          timeoutMs: 120000,
        });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },

    /** POST /vm/input — send mouse/keyboard input to the VM. */
    async input(req, res) {
      try {
        const vmToken = (req.headers['x-vm-token'] || '').replace(/^Bearer\s+/i, '');
        const r = await proxyToRunner('/vm/input', {
          method: 'POST',
          body: req.body || {},
          token: vmToken || null,
          timeoutMs: 15000,
        });
        res.status(r.status).json(r.data);
      } catch (err) {
        res.status(503).json({ ok: false, error: err.message });
      }
    },
  };
}
