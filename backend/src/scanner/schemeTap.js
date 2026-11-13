// Dark Matter rule-based scanner — raw-TCP scheme tap for non-HTTP SSRF.
// A minimal $0 listener the scanner starts for the duration of a
// lab-gated scan. A vulnerable target's fetcher speaks a non-HTTP
// scheme (gopher/dict/ftp) to an internal address the scanner
// controls; the scheme bytes land here and prove the fetch (coverage
// row #310). No external service, no public collaborator, no cost.
//
// Topology: same as oobCollaborator.js — the scanner backend runs ON
// the EC2 host; the authorised lab containers live on the docker
// bridge and reach the host at the bridge gateway (172.17.0.1). The
// tap binds 0.0.0.0 on an ephemeral port and the scheme URLs carry
// the gateway IP, so a lab container's fetcher can reach it. The tap
// is lab-gated — a non-lab target never receives a tap URL.
//
// Why raw TCP, not the HTTP collaborator: a gopher/dict/ftp client
// does not speak HTTP, so Node's HTTP parser rejects its bytes with
// a parse error and no 'request' event ever fires. The tap therefore
// listens on a raw socket, greets every connection (a "220" line —
// it elicits the FTP USER command and is ignored by gopher/dict
// clients), and records whatever bytes arrive.
//
// Safety: the tap only records bytes and answers with a static
// greeting. It never serves files, never executes anything, and only
// ever starts for lab-gated scans. Tokens are per-run random, so a
// stray connection cannot be mistaken for another probe's
// confirmation. Connections are closed promptly after the first
// bytes (or after 2 s with no bytes) so a waiting fetcher's read
// completes instead of hanging on an open socket.
//
// Attribution: a token is confirmed when it appears as a substring
// of the bytes the tap received. A bare connection that sends no
// bytes cannot be attributed to any token — it is counted in
// `connections` but records no hit, and can never confirm a leg.
import net from 'node:net';

const DEFAULT_CALLBACK_HOST = '172.17.0.1'; // docker bridge gateway on the EC2 host
const GREETING = '220 dm-scheme-tap ready\r\n';
// A connection that sends nothing gets closed after this long so the
// fetcher's read completes; a connection that sent bytes is closed
// shortly after the first chunk.
const IDLE_CLOSE_MS = 2000;
const AFTER_DATA_CLOSE_MS = 200;
// Keep only this much received text: tokens are short, and the tap
// must not grow without bound on a chatty client.
const MAX_BYTES_KEPT = 1024 * 1024;

export function createSchemeTap({
  listenHost = '0.0.0.0',
  listenPort = 0,
  callbackHost = DEFAULT_CALLBACK_HOST,
} = {}) {
  const hits = [];
  const waiters = new Map(); // token -> Set<finish>
  let server = null;
  let boundPort = null;
  let stopped = false;
  let connections = 0;
  // Every chunk received, with its arrival time. Tokens are matched
  // against these chunks — a token that arrived before anyone waited
  // for it must still resolve (the probe sends first, then waits).
  const received = [];
  let allBytes = '';

  // The first chunk containing `token`, as a hit record, or null.
  // Records it in `hits` (deduped by token) so hits.length counts
  // distinct tokens, not connections.
  function findHit(token) {
    if (!token) return null;
    const existing = hits.find((h) => h.token === token);
    if (existing) return existing;
    const chunk = received.find((c) => c.bytes.includes(token));
    if (!chunk) return null;
    const hit = { token, bytes: chunk.bytes, at: chunk.at };
    hits.push(hit);
    return hit;
  }

  function scanForTokens() {
    if (waiters.size === 0) return;
    for (const token of [...waiters.keys()]) {
      const hit = findHit(token);
      if (!hit) continue;
      const set = waiters.get(token);
      if (!set) continue;
      waiters.delete(token);
      for (const finish of set) finish(hit);
    }
  }

  function baseUrl() {
    if (!boundPort) return null;
    return `http://${callbackHost}:${boundPort}`;
  }

  function hostPort() {
    if (!boundPort) return null;
    return `${callbackHost}:${boundPort}`;
  }

  async function start() {
    if (server) return baseUrl();
    server = net.createServer((sock) => {
      connections += 1;
      let closed = false;
      const closeSoon = (ms) => {
        setTimeout(() => {
          if (closed) return;
          closed = true;
          try { sock.end(); } catch { /* ignore */ }
        }, ms).unref?.();
      };
      // Greet immediately: an FTP client waits for 220 before USER;
      // gopher/dict clients send first and ignore the line.
      try { sock.write(GREETING); } catch { /* ignore */ }
      closeSoon(IDLE_CLOSE_MS);
      sock.on('data', (chunk) => {
        const text = chunk.toString('latin1');
        received.push({ at: new Date().toISOString(), bytes: text });
        allBytes = (allBytes + text).slice(-MAX_BYTES_KEPT);
        // Keep the chunk log bounded (tokens are short; a waiter
        // arrives within seconds, never after a thousand chunks).
        if (received.length > 1000) received.shift();
        scanForTokens();
        closeSoon(AFTER_DATA_CLOSE_MS);
      });
      sock.on('error', () => { /* ignore */ });
      sock.on('close', () => { closed = true; });
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

  function hasHit(token) {
    return findHit(token);
  }

  // Resolves with the hit record when bytes containing the token
  // arrive, or null on timeout / after stop(). Resolves immediately
  // if the token already arrived.
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

  return {
    start,
    stop,
    baseUrl,
    hostPort,
    waitFor,
    hasHit,
    hits,
    get connections() {
      return connections;
    },
  };
}
