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

// ---- T2: frame replay verdict (row #480, CWE-1385) ---------------------------
// Mock WS server that answers ONLY the probe's purchase frame, per mode.
// T1 mutations and T3 subscribes are ignored, so the verdict tests observe
// T2 alone. Replies key on the purchase count, not the connection count:
// D1, T1 and T3 each open a /ws connection before T2's c1/c2, so the
// connection index is not a stable way to tell the first send from the
// replay — the first purchase frame is the first send, the second is the
// replay, whatever opened before them.
function startMockWsT2(mode, greetingsForConn) {
  const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const sockets = new Set();
  let wsConns = 0;
  let purchases = 0;
  const greet = typeof greetingsForConn === 'function'
    ? greetingsForConn
    : () => ['{"message":"Welcome to the socket"}'];
  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('end', () => socket.end());
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/ws') { socket.destroy(); return; }
    const accept = wsAccept(req.headers['sec-websocket-key'] || '');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    wsConns += 1;
    for (const f of greet(wsConns)) socket.write(encodeServerFrame(f));
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const text = decodeClientFrame(buf);
      if (text === null) return;
      buf = Buffer.alloc(0);
      let obj;
      try { obj = JSON.parse(text); } catch { return; }
      if (obj.type !== 'purchase' || typeof obj.item !== 'string' || !obj.item.startsWith('dmws_')) return;
      purchases += 1;
      if (mode === 'echo') {
        socket.write(encodeServerFrame(text));
      } else if (mode === 'double-effect') {
        socket.write(encodeServerFrame(JSON.stringify({ status: 'applied', item: obj.item })));
        if (purchases === 2) {
          socket.write(encodeServerFrame(JSON.stringify({ status: 'applied-again', item: obj.item, duplicate: true })));
        }
      }
      // 'silent': no reply to the frame.
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      wsConnCount: () => wsConns,
      closeAll: () => new Promise((r) => { setTimeout(() => server.close(r), 150); }),
    }));
  });
}

describe('wsMessages T2 replay verdict', () => {
  async function runT2(port, diag, extraOpts = {}) {
    return probeWsMessages(`http://127.0.0.1:${port}/`, {
      labTargets: '127.0.0.1',
      timeoutMs: 8000,
      depth: 'standard',
      diagnostics: diag,
      ...extraOpts,
    });
  }

  it('T2-1 fires MEDIUM on a double-effect replay (row #480)', async () => {
    const { server, port, closeAll } = await startMockWsT2('double-effect');
    const diag = {};
    try {
      const findings = await runT2(port, diag);
      const f = findings.find((x) => x.id.startsWith('ws-replay-'));
      assert.ok(f, `expected ws-replay MEDIUM finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.class, 'websocket_tampering');
      assert.equal(f.title, 'WebSocket — frame replay executes action twice (MEDIUM)');
      assert.equal(f.severity, 'medium');
      assert.equal(f.parameter, 'frame-replay');
      assert.ok(f.evidence.response.includes('2 post-send server frames vs 1'), 'evidence must quote the post-send counts');
      assert.equal(diag.wsEndpoints, 1);
      assert.equal(diag.replayEndpoints, 1);
      assert.equal(diag.replayAttempts, 1);
      assert.equal(diag.replayFramesBefore, 1);
      assert.equal(diag.replayFramesAfter, 2);
      assert.equal(diag.replayConfirmed, true);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('T2-2 stays silent when the server only echoes the replayed frame', async () => {
    const { server, port, closeAll } = await startMockWsT2('echo');
    const diag = {};
    try {
      const findings = await runT2(port, diag);
      assert.ok(!findings.some((x) => x.id.startsWith('ws-replay-')), 'a symmetric echo is not a double effect');
      assert.equal(diag.replayAttempts, 1);
      assert.equal(diag.replayFramesBefore, 1);
      assert.equal(diag.replayFramesAfter, 1);
      assert.equal(diag.replayConfirmed, false);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('T2-3 stays silent on an asymmetric greeting burst (snapshot fix)', async () => {
    // Greeting plan: D1, T1, T3 and c1 get 1 greeting each; c2 gets 2.
    // The greetings ride with the 101 response, so wsConnect decodes
    // them from `head` — under whole-connection counting that alone
    // fires the old oracle (after 2 > before 1); under post-send
    // snapshots both counts are 0. The /ws connection count pins the
    // premise: D1 + T1 + T3 + c1 + c2.
    const { server, port, wsConnCount, closeAll } = await startMockWsT2(
      'silent',
      (i) => (i === 5
        ? ['{"message":"Welcome to the socket"}', '{"message":"Connected — enjoy your stay"}']
        : ['{"message":"Welcome to the socket"}'])
    );
    const diag = {};
    try {
      const findings = await runT2(port, diag);
      assert.equal(wsConnCount(), 5, 'premise: exactly 5 /ws connections (D1, T1, T3, c1, c2)');
      assert.ok(!findings.some((x) => x.id.startsWith('ws-replay-')), 'greeting frames must not count toward the replay comparison');
      assert.equal(diag.replayAttempts, 1);
      assert.equal(diag.replayFramesBefore, 0);
      assert.equal(diag.replayFramesAfter, 0);
      assert.equal(diag.replayConfirmed, false);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('T2-4 stays silent when the server never acts on the frame', async () => {
    const { server, port, closeAll } = await startMockWsT2('silent', () => [
      '{"message":"Welcome to the socket"}',
      '{"message":"Connected — enjoy your stay"}',
    ]);
    const diag = {};
    try {
      const findings = await runT2(port, diag);
      assert.ok(!findings.some((x) => x.id.startsWith('ws-replay-')), 'greetings alone are not a double effect');
      assert.equal(diag.replayAttempts, 1);
      assert.equal(diag.replayFramesBefore, 0);
      assert.equal(diag.replayFramesAfter, 0);
      assert.equal(diag.replayConfirmed, false);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('T2-5 replay leg never runs on a non-lab host', async () => {
    const { server, port, closeAll } = await startMockWsT2('double-effect');
    const diag = {};
    try {
      const findings = await runT2(port, diag, { labTargets: 'lab.local' });
      assert.ok(!findings.some((x) => x.id.startsWith('ws-replay-')), 'non-lab hosts must not run the replay leg');
      assert.equal(diag.wsEndpoints, 1);
      assert.equal(diag.replayEndpoints, 0);
      assert.equal(diag.replayAttempts, 0);
      assert.equal(diag.replayFramesBefore, null);
      assert.equal(diag.replayFramesAfter, null);
      assert.equal(diag.replayConfirmed, false);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });

  it('T2-6 replay leg never runs at quick depth', async () => {
    const { server, port, closeAll } = await startMockWsT2('double-effect');
    const diag = {};
    try {
      const findings = await runT2(port, diag, { depth: 'quick' });
      assert.ok(!findings.some((x) => x.id.startsWith('ws-replay-')), 'quick depth must not run the replay leg');
      assert.equal(diag.wsEndpoints, 1);
      assert.equal(diag.replayEndpoints, 0);
      assert.equal(diag.replayAttempts, 0);
      assert.equal(diag.replayFramesBefore, null);
      assert.equal(diag.replayFramesAfter, null);
      assert.equal(diag.replayConfirmed, false);
    } finally {
      await closeAll();
    }
  }, { timeout: 60000 });
});
