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
import { validateDestinations } from './scopeGuard.js';

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
  const dialFn = typeof dial === 'function' ? dial : (host, p) => net.connect(p, host);
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
  server.on('request', (clientReq, clientRes) => {
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
    const proxyReq = http.request(
      {
        host: target.hostname,
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
  server.on('connect', (req, clientSocket, head) => {
    const { host, port } = splitHostPort(req.url, 443);
    const v = proxyAllows(liveScope, { host, port, sni: host });
    if (!v.ok) {
      deny({ host, port, reason: v.reason, via: 'connect' });
      clientSocket.write('HTTP/1.1 502 Forbidden by hunt scope\r\n\r\n');
      clientSocket.destroy();
      return;
    }
    const srv = dialFn(host, port);
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
    }, 120000).unref?.();
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
