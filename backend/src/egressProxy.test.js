// Dark Matter — P2 egressProxy tests (31 Oct 2026).
// Starts the real filtering proxy + local backend servers (virtual hosts
// on 127.0.0.1 via a dial seam — no DNS, no root, no docker).
// Covers T16 (shared-IP), T17 (forged Host via direct IP), T18 (CONNECT).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { startEgressProxy, proxyAllows } from './egressProxy.js';

let backend; // virtual-host HTTP server on 127.0.0.1
let BACKEND_PORT;
let proxy;
let PROXY_PORT;
const violations = [];

function scopeFor(ports) {
  return {
    version: 1,
    target: 'http://allowed.test/',
    hosts: ['allowed.test'],
    outHosts: [],
    ips: [],
    labIps: [],
    ports,
    labTargets: [],
    createdAt: '2026-10-31T00:00:00.000Z',
  };
}

before(async () => {
  // Backend: virtual hosts — 'allowed.test' → 200, anything else → 404.
  // '/redir' → 302 to an out-of-scope host (T5 redirect half).
  backend = http.createServer((req, res) => {
    const h = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (req.url === '/redir') {
      res.writeHead(302, { Location: `http://evil.test:${BACKEND_PORT}/` });
      res.end();
      return;
    }
    if (h === 'allowed.test') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ALLOWED-VHOST');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('unknown vhost');
    }
  });
  await new Promise((r) => backend.listen(0, '127.0.0.1', r));
  BACKEND_PORT = backend.address().port;

  const scope = scopeFor([{ port: BACKEND_PORT, proto: 'tcp' }]);
  // dial seam: every validated hostname is served by the local backend —
  // validation still runs on the HOSTNAME (shared-IP semantics preserved).
  const dial = () => net.connect(BACKEND_PORT, '127.0.0.1');
  proxy = await startEgressProxy({
    huntId: 'h_proxytest',
    scope,
    port: 0,
    onViolation: (v) => violations.push(v),
    dial,
  });
  PROXY_PORT = proxy.port;
});

after(async () => {
  await proxy.stop();
  await new Promise((r) => backend.close(r));
});

/** GET an absolute URI through the proxy with an explicit Host header. */
function proxyGet(absoluteUrl, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PROXY_PORT,
        method: 'GET',
        path: absoluteUrl,
        headers: { Host: hostHeader },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('proxyGet timeout')));
    req.end();
  });
}

/** Raw CONNECT through the proxy; resolves with the response head. */
function proxyConnect(authority) {
  return new Promise((resolve, reject) => {
    const s = net.connect(PROXY_PORT, '127.0.0.1', () => {
      s.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    let data = '';
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error('proxyConnect timeout'));
    }, 5000);
    s.on('data', (c) => {
      data += c.toString();
      if (data.includes('\r\n\r\n')) {
        clearTimeout(timer);
        resolve({ head: data, socket: s });
      }
    });
    s.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

test('proxyAllows: unit validation against the scope', () => {
  const scope = scopeFor([{ port: BACKEND_PORT, proto: 'tcp' }]);
  assert.equal(proxyAllows(scope, { host: 'allowed.test', port: BACKEND_PORT }).ok, true);
  assert.equal(proxyAllows(scope, { host: 'sub.allowed.test', port: BACKEND_PORT }).ok, true);
  const denied = proxyAllows(scope, { host: 'evil.test', port: BACKEND_PORT });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /not in the hunt scope/);
  const wrongPort = proxyAllows(scope, { host: 'allowed.test', port: 9999 });
  assert.equal(wrongPort.ok, false);
  assert.match(wrongPort.reason, /not authorized/);
  const meta = proxyAllows(scope, { host: '169.254.169.254', port: 80 });
  assert.equal(meta.ok, false);
  assert.match(meta.reason, /metadata/);
  assert.equal(proxyAllows(null, { host: 'allowed.test', port: BACKEND_PORT }).ok, false);
  assert.equal(
    proxyAllows(scope, { host: 'allowed.test', port: BACKEND_PORT, sni: 'evil.test' }).ok,
    false,
    'SNI/hostname mismatch blocked'
  );
});

test('in-scope hostname through the proxy → 200 from the vhost', async () => {
  const r = await proxyGet(`http://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(r.status, 200);
  assert.equal(r.body, 'ALLOWED-VHOST');
});

test('out-of-scope hostname → 403 + violation logged', async () => {
  const n = violations.length;
  const r = await proxyGet(`http://evil.test:${BACKEND_PORT}/`, `evil.test:${BACKEND_PORT}`);
  assert.equal(r.status, 403);
  assert.match(r.body, /forbidden by hunt scope/);
  assert.equal(violations.length, n + 1);
  const v = violations[violations.length - 1];
  assert.equal(v.host, 'evil.test');
  assert.equal(v.action, 'deny');
  assert.equal(v.via, 'http');
});

test('T16 shared-IP: same server IP, only the in-scope hostname answers 200', async () => {
  // Both hostnames dial to the SAME 127.0.0.1 backend (shared-IP/CDN case).
  const ok = await proxyGet(`http://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(ok.status, 200, 'in-scope hostname reachable');
  const bad = await proxyGet(`http://other.test:${BACKEND_PORT}/`, `other.test:${BACKEND_PORT}`);
  assert.equal(bad.status, 403, 'out-of-scope hostname on the same IP blocked');
  const v = violations[violations.length - 1];
  assert.equal(v.host, 'other.test');
  assert.match(v.reason, /not in the hunt scope/);
});

test('T17 forged Host via direct IP → 403 (header/target mismatch)', async () => {
  const n = violations.length;
  // Absolute URI targets the IP literally, Host header claims the in-scope name.
  const r = await proxyGet(`http://127.0.0.1:${BACKEND_PORT}/`, 'allowed.test');
  assert.equal(r.status, 403);
  assert.equal(violations.length, n + 1);
  assert.match(violations[violations.length - 1].reason, /Host header does not match/);
  // Reverse forgery: in-scope URI, out-of-scope Host header.
  const r2 = await proxyGet(`http://allowed.test:${BACKEND_PORT}/`, 'evil.test');
  assert.equal(r2.status, 403);
  assert.match(violations[violations.length - 1].reason, /Host header does not match/);
});

test('T18 CONNECT out-of-scope:443 → 502 denied + logged (SNI-equivalent)', async () => {
  const n = violations.length;
  const { head, socket } = await proxyConnect('evil.test:443');
  assert.match(head, /^HTTP\/1\.1 502/, `expected 502, got: ${head.split('\r\n')[0]}`);
  socket.destroy();
  assert.equal(violations.length, n + 1);
  const v = violations[violations.length - 1];
  assert.equal(v.host, 'evil.test');
  assert.equal(v.via, 'connect');
});

test('T18 CONNECT in-scope host → 200 tunnel established', async () => {
  const { head, socket } = await proxyConnect(`allowed.test:${BACKEND_PORT}`);
  assert.match(head, /^HTTP\/1\.1 200/, `expected 200, got: ${head.split('\r\n')[0]}`);
  socket.destroy();
});

test('wrong port on in-scope hostname → 403', async () => {
  const r = await proxyGet('http://allowed.test:9999/', 'allowed.test:9999');
  assert.equal(r.status, 403);
  assert.match(violations[violations.length - 1].reason, /not authorized/);
});

test('wrong protocol (scope authorizes UDP only) → CONNECT denied', async () => {
  const udpScope = scopeFor([{ port: BACKEND_PORT, proto: 'udp' }]);
  const p2 = await startEgressProxy({
    huntId: 'h_udp',
    scope: udpScope,
    port: 0,
    dial: () => net.connect(BACKEND_PORT, '127.0.0.1'),
  });
  try {
    const s = await new Promise((resolve, reject) => {
      const sock = net.connect(p2.port, '127.0.0.1', () => {
        sock.write(`CONNECT allowed.test:${BACKEND_PORT} HTTP/1.1\r\nHost: allowed.test\r\n\r\n`);
      });
      let data = '';
      sock.on('data', (c) => {
        data += c.toString();
        if (data.includes('\r\n\r\n')) resolve({ head: data, sock });
      });
      sock.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    assert.match(s.head, /^HTTP\/1\.1 502/, 'tcp CONNECT denied when only udp authorized');
    s.sock.destroy();
  } finally {
    await p2.stop();
  }
});

test('non-http scheme via proxy → 403', async () => {
  const r = await proxyGet(`ftp://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(r.status, 403);
});

test('malformed request target → 400', async () => {
  const r = await proxyGet('/just-a-path', 'allowed.test');
  assert.equal(r.status, 400);
});

test('T5 redirect half: proxy never follows redirects; each hop validated', async () => {
  // The in-scope vhost answers 302 → out-of-scope. The proxy must return
  // the 302 untouched (never follow), and the follow-up hop must be denied.
  const r = await proxyGet(`http://allowed.test:${BACKEND_PORT}/redir`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(r.status, 302);
  assert.match(r.headers.location, /^http:\/\/evil\.test/, 'redirect location preserved, not followed');
  const hop2 = await proxyGet(r.headers.location, `evil.test:${BACKEND_PORT}`);
  assert.equal(hop2.status, 403, 'out-of-scope redirect target blocked on re-request');
});

test('updateScope swaps the allowlist live', async () => {
  const before = await proxyGet(`http://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(before.status, 200);
  proxy.updateScope({ ...scopeFor([{ port: BACKEND_PORT, proto: 'tcp' }]), hosts: ['other.test'] });
  const after = await proxyGet(`http://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(after.status, 403, 'previously-allowed hostname denied after scope update');
  assert.throws(() => proxy.updateScope({ version: 2 }), /invalid scope/);
});

test('startEgressProxy fails closed on invalid scope', async () => {
  await assert.rejects(startEgressProxy({ huntId: 'x', scope: null, port: 0 }), /invalid scope/);
  await assert.rejects(
    startEgressProxy({ huntId: 'x', scope: { version: 2 }, port: 0 }),
    /invalid scope/
  );
});
