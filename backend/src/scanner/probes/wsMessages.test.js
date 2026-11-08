// Tests for the WebSocket message probe (#39).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { probeWsMessages } from './wsMessages.js';

describe('wsMessages probe', () => {
  it('returns [] when no WS endpoints are live', async () => {
    const findings = await probeWsMessages('http://127.0.0.1:1/', {
      timeoutMs: 3000,
      depth: 'quick',
    });
    assert.deepEqual(findings, [], 'no WS surface => no findings');
  });

  it('handles unreachable host without throwing', async () => {
    const findings = await probeWsMessages('http://127.0.0.1:1/page', { timeoutMs: 2000 });
    assert.ok(Array.isArray(findings));
  });

  it('#270 fires when an HTTPS page references a cleartext ws:// URL', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><head></head><body><script>const sock = new WebSocket("ws://realtime.test.local/socket");</script></body></html>',
    });
    try {
      // depth quick: passive only (no active handshake), d1Inventory handshakes
      // to wss://127.0.0.1:1/* fail fast (connection refused).
      const findings = await probeWsMessages('https://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      const f = findings.find((x) => x.class === 'ws_unencrypted_channel');
      assert.ok(f, 'ws_unencrypted_channel should fire');
      assert.equal(f.severity, 'medium');
      assert.ok(f.parameter.includes('ws://realtime.test.local/socket'));
      assert.ok(f.evidence.signalCorrelated);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#270 stays silent on plain HTTP pages and pages without ws:// refs', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () => '<html><body>no websocket here</body></html>',
    });
    try {
      const httpFindings = await probeWsMessages('http://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      assert.ok(!httpFindings.some((x) => x.class === 'ws_unencrypted_channel'), 'http page must not fire');
      const httpsFindings = await probeWsMessages('https://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      assert.ok(!httpsFindings.some((x) => x.class === 'ws_unencrypted_channel'), 'page without ws:// refs must not fire');
    } finally {
      global.fetch = origFetch;
    }
  });
});

// ---- T3: unauthenticated topic subscription --------------------------------
// Mock WS server: 101 on /ws, sends `onConnect` frames immediately after
// upgrade and `onSubscribe` frames when it first hears a client frame.
function wsAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function encodeServerFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function startMockWs({ onConnect = [], onSubscribe = [] }) {
  const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const sockets = new Set();
  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('end', () => socket.end());
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/ws') { socket.destroy(); return; }
    const accept = wsAccept(req.headers['sec-websocket-key'] || '');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    for (const f of onConnect) socket.write(encodeServerFrame(f));
    let subscribed = false;
    socket.on('data', () => {
      if (subscribed) return;
      subscribed = true;
      setTimeout(() => { for (const f of onSubscribe) socket.write(encodeServerFrame(f)); }, 100);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      closeAll: () => new Promise((r) => {
        // Let the close handshake settle (probe sockets end cleanly via
        // the 'end' handler above) — destroying them here would RST the
        // probe's still-closing client sockets (ECONNRESET).
        setTimeout(() => server.close(r), 150);
      }),
    }));
  });
}

describe('wsMessages T3 topic subscription', () => {
  it('stays silent on a plain welcome frame (old keyword FP)', async () => {
    const { server, port, closeAll } = await startMockWs({
      onConnect: ['{"message":"Welcome! Your account was created successfully. Check your order history."}'],
      onSubscribe: [],
    });
    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body>no websocket here</body></html>' });
    try {
      const findings = await probeWsMessages(`http://127.0.0.1:${port}/`, { timeoutMs: 8000, depth: 'quick' });
      assert.ok(!findings.some((x) => x.id.startsWith('ws-topic-')), 'a welcome greeting is not a cross-user leak');
    } finally {
      global.fetch = origFetch;
      await closeAll();
    }
  });

  it('fires HIGH on a post-subscribe frame carrying another user id', async () => {
    const { server, port, closeAll } = await startMockWs({
      onConnect: ['{"message":"Welcome! Connected."}'],
      onSubscribe: ['{"user_id":4821,"order_total":149.99,"email":"other@example.com"}'],
    });
    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body>no websocket here</body></html>' });
    try {
      const findings = await probeWsMessages(`http://127.0.0.1:${port}/`, { timeoutMs: 8000, depth: 'quick' });
      const f = findings.find((x) => x.id.startsWith('ws-topic-'));
      assert.ok(f, `expected ws-topic HIGH finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes('4821'), 'evidence must quote the leaked frame verbatim');
    } finally {
      global.fetch = origFetch;
      await closeAll();
    }
  });
});

// ---- T1: message-field tampering ------------------------------------------------
// Mock WS server that decodes client frames and responds per mode:
// 'reserialise' — echo the frame with keys re-ordered (same JSON, new bytes);
// 'act' — reply with a processed frame carrying the canary (server acted);
// 'role-only' — act only on role:'admin', re-serialise-echo the rest.
function decodeClientFrame(buf) {
  if (buf.length < 2) return null;
  const b1 = buf[1];
  if ((b1 & 0x80) === 0) return null; // client frames are masked
  let len = b1 & 0x7f;
  let off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  if (buf.length < off + 4 + len) return null;
  const mask = buf.subarray(off, off + 4);
  const payload = buf.subarray(off + 4, off + 4 + len);
  const um = Buffer.alloc(len);
  for (let i = 0; i < len; i++) um[i] = payload[i] ^ mask[i % 4];
  return um.toString('utf8');
}

function startMockWsT1(mode) {
  const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const sockets = new Set();
  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('end', () => socket.end());
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/ws') { socket.destroy(); return; }
    const accept = wsAccept(req.headers['sec-websocket-key'] || '');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const text = decodeClientFrame(buf);
      if (text === null) return;
      buf = Buffer.alloc(0);
      let obj;
      try { obj = JSON.parse(text); } catch { return; }
      if (!obj.canary || !String(obj.canary).startsWith('__ws_dm_')) return; // subscribe frames: silent
      const reordered = Object.fromEntries(Object.entries(obj).reverse());
      if (mode === 'reserialise') {
        socket.write(encodeServerFrame(JSON.stringify(reordered)));
      } else if (mode === 'act') {
        socket.write(encodeServerFrame(JSON.stringify({ status: 'applied', canary: obj.canary, amount: obj.amount ?? null })));
      } else if (mode === 'role-only') {
        if (obj.role === 'admin') {
          socket.write(encodeServerFrame(JSON.stringify({ status: 'role-upgraded', canary: obj.canary, role: 'admin' })));
        } else {
          socket.write(encodeServerFrame(JSON.stringify(reordered)));
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      closeAll: () => new Promise((r) => { setTimeout(() => server.close(r), 150); }),
    }));
  });
}

describe('wsMessages T1 tampering', () => {
  async function runT1(port) {
    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body>no websocket here</body></html>' });
    try {
      return await probeWsMessages(`http://127.0.0.1:${port}/`, { timeoutMs: 8000, depth: 'quick' });
    } finally {
      global.fetch = origFetch;
    }
  }

  it('stays silent on a re-serialised echo (semantic echo-control)', async () => {
    const { server, port, closeAll } = await startMockWsT1('reserialise');
    try {
      const findings = await runT1(port);
      assert.ok(!findings.some((x) => x.id.startsWith('ws-tamper-')), `a re-ordered echo is not tampering, got ${JSON.stringify(findings.map((x) => x.id))}`);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('fires HIGH when the server acts on the mutation', async () => {
    const { server, port, closeAll } = await startMockWsT1('act');
    try {
      const findings = await runT1(port);
      const f = findings.find((x) => x.id.startsWith('ws-tamper-'));
      assert.ok(f, `expected ws-tamper HIGH finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes('applied'), 'evidence must quote the acting frame verbatim');
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('sends the privileged-role mutation (dead-mutation fix)', async () => {
    const { server, port, closeAll } = await startMockWsT1('role-only');
    try {
      const findings = await runT1(port);
      const f = findings.find((x) => x.id.startsWith('ws-tamper-'));
      assert.ok(f, `expected ws-tamper finding on role:admin, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.parameter, 'role', 'the 4th mutation (role:admin) must actually be sent');
      assert.ok(f.evidence.response.includes('role-upgraded'), 'evidence must quote the acting frame');
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });
});

// ---- T2 replay lab gate (isLab follow-up, 8 Nov 2026) ----------------------
// T2 is lab-only, but the old local isLab never saw labTargets (no
// call-site pass) and never matched port-bearing entries — replay could
// never run in production. The gate is proven by connection count: the
// replay opens exactly two extra WS connections (c1 + c2) on a lab host
// and none off-lab. No finding is asserted — the stub sends no frames.
describe('wsMessages T2 replay lab gate', () => {
  it('lab mode opens two extra WS connections for replay; non-lab opens none', async () => {
    const { server, port, closeAll } = await startMockWs({ onConnect: [], onSubscribe: [] });
    let upgrades = 0;
    const onUpgrade = (req) => {
      try {
        if (new URL(req.url, 'http://127.0.0.1').pathname === '/ws') upgrades += 1;
      } catch { /* ignore */ }
    };
    server.on('upgrade', onUpgrade);
    try {
      await probeWsMessages(`http://127.0.0.1:${port}/`, {
        labTargets: `127.0.0.1:${port}`,
        timeoutMs: 5000,
        depth: 'standard',
      });
      const labUpgrades = upgrades;
      upgrades = 0;
      await probeWsMessages(`http://127.0.0.1:${port}/`, {
        labTargets: 'lab.local',
        timeoutMs: 5000,
        depth: 'standard',
      });
      const nonLabUpgrades = upgrades;
      assert.equal(
        labUpgrades, nonLabUpgrades + 2,
        `lab mode must open exactly the 2 replay connections (c1+c2); lab=${labUpgrades} non-lab=${nonLabUpgrades}`
      );
    } finally {
      server.off('upgrade', onUpgrade);
      await closeAll();
    }
  }, { timeout: 60000 });
});
