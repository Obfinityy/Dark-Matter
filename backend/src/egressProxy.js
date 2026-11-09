// Dark Matter — P2 per-hunt filtering egress proxy (31 Oct 2026).
//
// The network-layer answer to shared-IP / hostname isolation: IP+port
// allowlisting cannot distinguish two hostnames on the same CDN IP, so all
// hunt HTTP(S) traffic is forced through this proxy (iptables drops direct
// 80/443). The proxy validates the request HOSTNAME — HTTP request-target +
// Host header, HTTPS CONNECT hostname (= TLS SNI equivalent) — against the
// SAME immutable P1 scope, reusing scopeGuard.validateDestinations so there
// is exactly one validation logic.
//
// - Denied requests: 403 (HTTP) / 502 (CONNECT) + a logged violation.
// - The proxy never follows redirects; the client re-requests each hop
//   through the proxy, so every redirect hop is validated independently.
// - No external dependencies (node stdlib only). Startable/stoppable
//   programmatically for tests.

import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { validateDestinations } from './scopeGuard.js';
import { isPrivateIP } from './scopeParser.js';

// How long an orphaned proxied connection is left before the server side
// is destroyed (the client socket is already gone by then).
const ORPHAN_SERVER_SWEEP_MS = 120000;

/**
 * Pick a dial address for a validated hostname/IP under the hunt scope.
 * Pure (unit-testable): `addresses` are lookup() results [{address, family}].
 * - Public IPs dial as-is (IPv4 preferred).
 * - A private IP dials ONLY if it is an explicitly listed lab IP
 *   (scope.labIps) — lab traffic is private by opt-in design.
 * - Anything else (private-only resolution, unlisted private literal)
 *   is blocked: this is the dial-time half of the DNS-rebinding guard
 *   (#397; the ipset half landed in #339).
 * @returns {{ip:string}|{blocked:string}}
 */
export function pickDialAddress(host, scope, addresses) {
  const h = String(host || '').toLowerCase();
  const labIps = (scope && scope.labIps) || [];
  if (isIP(h)) {
    if (!isPrivateIP(h)) return { ip: h };
    if (labIps.includes(h)) return { ip: h };
    return { blocked: 'private IP literal is not a listed lab IP' };
  }
  const addrs = addresses || [];
  const pub = addrs.filter((a) => a && a.address && !isPrivateIP(a.address));
  const v4 = pub.find((a) => a.family === 4);
  if (v4) return { ip: v4.address };
  if (pub.length) return { ip: pub[0].address };
  const lab = addrs.find((a) => a && labIps.includes(a.address));
  if (lab) return { ip: lab.address };
  return { blocked: 'hostname resolves only to private IPs' };
}

/** Resolve a validated destination to a dialable IP (default dial only). */
async function guardedDialTarget(host, scope) {
  const h = String(host || '').toLowerCase();
  if (isIP(h)) return pickDialAddress(h, scope, []);
  let addrs;
  try {
    addrs = await lookup(h, { all: true });
  } catch {
    return { blocked: 'DNS resolution failed' };
  }
  return pickDialAddress(h, scope, addrs);
}

/**
 * Validate one proxied destination against the hunt scope.
 * @returns {{ok:true}|{ok:false, reason}}
 */
export function proxyAllows(scope, { host, port, sni }) {
  const d = { host, port, protocol: 'tcp' };
  if (sni) d.sni = sni;
  const v = validateDestinations([d], scope);
  return v.ok ? { ok: true } : { ok: false, reason: v.reason };
}

function splitHostPort(authority, defaultPort) {
  const idx = String(authority || '').lastIndexOf(':');
  if (idx > 0 && /^\d+$/.test(String(authority).slice(idx + 1))) {
    return { host: String(authority).slice(0, idx).toLowerCase(), port: Number(authority.slice(idx + 1)) };
  }
  return { host: String(authority || '').toLowerCase(), port: defaultPort };
}

/**
 * Start the filtering proxy.
 * @param {Object} opts
 * @param {string} opts.huntId
 * @param {Object} opts.scope - P1 immutable scope
 * @param {number} opts.port - 0 for ephemeral (tests)
 * @param {string} [opts.bindIp='127.0.0.1']
 * @param {Function} [opts.onViolation] - called with each denial
 * @param {Function} [opts.dial] - test seam: (host, port) => net.Socket.
 *   Defaults to a direct TCP connect; tests inject a dial that maps fake
 *   hostnames onto a local test server without touching DNS.
 * @returns {Promise<{server, port, violations, stop, updateScope}>}
 */
export async function startEgressProxy({ huntId, scope, port, bindIp = '127.0.0.1', onViolation, dial } = {}) {
  if (!scope || scope.version !== 1) throw new Error('startEgressProxy: invalid scope (fail-closed)');
  // Guarded resolution (#397) applies ONLY to the default dial path.
  // An injected `dial` (tests, custom dialers) owns its own resolution
  // and keeps the exact old behavior.
  const guarded = typeof dial !== 'function';
  const dialFn = guarded ? (host, p) => net.connect(p, host) : dial;
  let liveScope = scope;
  const violations = [];
  const deny = (entry) => {
    const full = { ts: new Date().toISOString(), huntId, action: 'deny', ...entry };
    violations.push(full);
    if (onViolation) {
      try {
        onViolation(full);
      } catch { /* logging must never break the proxy */ }
    }
    return full;
  };

  const server = http.createServer();

  // Plain HTTP through a forward proxy: absolute-URI request line.
  server.on('request', async (clientReq, clientRes) => {
    let target;
    try {
      target = new URL(clientReq.url);
    } catch {
      deny({ reason: 'malformed-target', via: 'http' });
      clientRes.writeHead(400);
      clientRes.end('bad request');
      return;
    }
    if (target.protocol !== 'http:') {
      deny({ reason: `non-http scheme ${target.protocol}`, via: 'http' });
      clientRes.writeHead(403);
      clientRes.end('forbidden by hunt scope');
      return;
    }
    const host = target.hostname.toLowerCase();
    const reqPort = target.port ? Number(target.port) : 80;
    // Forged Host header detection: the header must name the request target.
    const hostHeader = String(clientReq.headers.host || '').split(':')[0].toLowerCase().trim();
    if (hostHeader && hostHeader !== host) {
      const v = deny({ host: hostHeader, port: reqPort, reason: 'Host header does not match request target', via: 'http' });
      clientRes.writeHead(403);
      clientRes.end(`forbidden by hunt scope: ${v.reason}`);
      return;
    }
    const v = proxyAllows(liveScope, { host, port: reqPort });
    if (!v.ok) {
      deny({ host, port: reqPort, reason: v.reason, via: 'http' });
      clientRes.writeHead(403);
      clientRes.end(`forbidden by hunt scope: ${v.reason}`);
      return;
    }
    const fwdHeaders = { ...clientReq.headers, host: target.host };
    delete fwdHeaders['proxy-connection'];
    delete fwdHeaders['proxy-authorization'];
    // FIX (#397): resolve BEFORE dialing on the default path, so a
    // rebound record cannot smuggle a private IP past the hostname
    // check. The Host header still names the original hostname.
    let dialHost = target.hostname;
    if (guarded) {
      const g = await guardedDialTarget(host, liveScope);
      if (g.blocked) {
        const v = deny({ host, port: reqPort, reason: `dial blocked: ${g.blocked}`, via: 'http' });
        clientRes.writeHead(403);
        clientRes.end(`forbidden by hunt scope: ${v.reason}`);
        return;
      }
      dialHost = g.ip;
    }
    const proxyReq = http.request(
      {
        host: dialHost,
        port: reqPort,
        method: clientReq.method,
        path: target.pathname + target.search,
        headers: fwdHeaders,
        createConnection: (copts) => dialFn(copts.host, copts.port),
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
      }
    );
    proxyReq.on('error', () => {
      clientRes.writeHead(502);
      clientRes.end('bad gateway');
    });
    proxyReq.on('timeout', () => proxyReq.destroy());
    proxyReq.setTimeout(30000);
    clientReq.pipe(proxyReq);
  });

  // HTTPS: CONNECT host:port — the hostname here IS the SNI equivalent.
  server.on('connect', async (req, clientSocket, head) => {
    const { host, port } = splitHostPort(req.url, 443);
    const v = proxyAllows(liveScope, { host, port, sni: host });
    if (!v.ok) {
      deny({ host, port, reason: v.reason, via: 'connect' });
      clientSocket.write('HTTP/1.1 502 Forbidden by hunt scope\r\n\r\n');
      clientSocket.destroy();
      return;
    }
    // FIX (#397): same dial-time guard as the HTTP path.
    let dialHost = host;
    if (guarded) {
      const g = await guardedDialTarget(host, liveScope);
      if (g.blocked) {
        deny({ host, port, reason: `dial blocked: ${g.blocked}`, via: 'connect' });
        clientSocket.write('HTTP/1.1 502 Forbidden by hunt scope\r\n\r\n');
        clientSocket.destroy();
        return;
      }
      dialHost = g.ip;
    }
    const srv = dialFn(dialHost, port);
    srv.once('connect', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) srv.write(head);
      srv.pipe(clientSocket);
      clientSocket.pipe(srv);
    });
    const fail = () => {
      try {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      } catch { /* already gone */ }
      clientSocket.destroy();
      srv.destroy();
    };
    srv.on('error', fail);
    clientSocket.on('error', () => srv.destroy());
    setTimeout(() => {
      if (!srv.destroyed && clientSocket.destroyed) srv.destroy();
    }, ORPHAN_SERVER_SWEEP_MS).unref?.();
  });

  server.on('clientError', (err, socket) => {
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch { /* ignore */ }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, bindIp, resolve);
  });
  const actualPort = server.address().port;
  return {
    server,
    port: actualPort,
    violations,
    updateScope(ns) {
      if (!ns || ns.version !== 1) throw new Error('updateScope: invalid scope (fail-closed)');
      liveScope = ns;
    },
    stop() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
