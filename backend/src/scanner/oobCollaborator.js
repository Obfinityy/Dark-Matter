// Dark Matter rule-based scanner — in-process out-of-band (OOB) collaborator.
// A minimal $0 HTTP listener the scanner starts for the duration of a
// lab-gated scan. A vulnerable target's parser fetches a canary URL embedded
// in a probe payload; the fetch lands here and proves blind out-of-band
// resolution (SAML-XXE OOB today; the module is probe-agnostic).
// No external service, no public collaborator, no Meta API, no cost.
//
// Topology: the scanner backend runs ON the EC2 host; the authorised lab
// containers live on the docker bridge and reach the host at the bridge
// gateway (172.17.0.1). The listener binds 0.0.0.0 on an ephemeral port and
// the canary URL carries the gateway IP, so a lab container's XML parser
// can reach it. The OOB variant is lab-gated (opts.labTargets) — a non-lab
// target never receives a callback URL.
//
// Safety: the listener only records hits and answers every request with the
// same static DTD fragment. It never serves files, never executes anything,
// and only ever starts for lab-gated scans. Tokens are per-run random, so a
// stray hit cannot be mistaken for another probe's confirmation.
import http from 'node:http';

const DEFAULT_CALLBACK_HOST = '172.17.0.1'; // docker bridge gateway on the EC2 host
const DTD_FRAGMENT = '<!ENTITY dm-oob-hit "1">';

export function createOobCollaborator({
  listenHost = '0.0.0.0',
  listenPort = 0,
  callbackHost = DEFAULT_CALLBACK_HOST,
} = {}) {
  const hits = [];
  const waiters = new Map(); // token -> Set<finish>
  let server = null;
  let boundPort = null;
  let stopped = false;

  function recordHit(req) {
    const u = new URL(req.url || '/', 'http://oob.invalid');
    const token = u.pathname.replace(/^\/+/, '').split('/')[0] || '';
    const hit = {
      token,
      path: u.pathname,
      method: req.method || 'GET',
      // The fetching client's User-Agent: a browser UA on a hit proves
      // the fetch came from a viewer render (egress laundering), not
      // from an agent-issued request. Additive only — existing
      // consumers read token/path/method/at and are unaffected.
      userAgent: (req.headers && req.headers['user-agent']) || '',
      at: new Date().toISOString(),
    };
    hits.push(hit);
    const set = waiters.get(token);
    if (set) {
      waiters.delete(token);
      for (const finish of set) finish(hit);
    }
    return hit;
  }

  function baseUrl() {
    if (!boundPort) return null;
    return `http://${callbackHost}:${boundPort}`;
  }

  async function start() {
    if (server) return baseUrl();
    server = http.createServer((req, res) => {
      // Recording must never break the response — the hit is the signal,
      // the 200 + DTD fragment is just a well-formed answer for a parser
      // fetching an external parameter entity.
      try { recordHit(req); } catch { /* ignore */ }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`${DTD_FRAGMENT}\n`);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(listenPort, listenHost, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    boundPort = server.address().port;
    return baseUrl();
  }

  function urlFor(token) {
    const base = baseUrl();
    if (!base) return null;
    return `${base}/${String(token).replace(/^\/+/, '')}`;
  }

  function hasHit(token) {
    return hits.find((h) => h.token === token) || null;
  }

  // Resolves with the hit record when a request for the token arrives,
  // or null on timeout / after stop(). Resolves immediately if the hit
  // already arrived before waiting (the target may fetch synchronously
  // while our POST is still in flight).
  function waitFor(token, timeoutMs = 8000) {
    const existing = hasHit(token);
    if (existing) return Promise.resolve(existing);
    if (stopped) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => finish(null), timeoutMs);
      function finish(hit) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const set = waiters.get(token);
        if (set) {
          set.delete(finish);
          if (set.size === 0) waiters.delete(token);
        }
        resolve(hit);
      }
      if (!waiters.has(token)) waiters.set(token, new Set());
      waiters.get(token).add(finish);
    });
  }

  async function stop() {
    stopped = true;
    for (const [, set] of waiters) for (const finish of set) finish(null);
    waiters.clear();
    if (!server) return;
    const s = server;
    server = null;
    await new Promise((resolve) => s.close(resolve));
  }

  return { start, stop, baseUrl, urlFor, waitFor, hasHit, hits };
}
