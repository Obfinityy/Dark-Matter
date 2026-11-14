// Tests for the HTTP/2 tunnelling probe (row #168 [Critical] HTTP/2
// Desync / Downgrading Attacks, H2→H1 downgrade CRLF smuggling,
// CWE-444; phase 'smuggling-h2-tunnel').
//
// The mock is a raw-socket HTTP/2 server (preface + SETTINGS +
// HEADERS with HPACK decode, using the probe's own codec): the
// 'downgrading' mode splits a CRLF-bearing header value and records
// the smuggled request line as the back-end would see it; the
// 'sanitising' mode answers 200 and records nothing; the 'goaway'
// mode refuses the connection. A plain HTTP/1.1 server covers the
// no-H2 skip path. No external service is touched.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {
  probeSmugglingH2Tunnel,
  encodeHpackInteger,
  readHpackInteger,
  encodeHpackLiteral,
  encodeHpackIndexed,
  decodeHpackBlock,
  encodeFrame,
  crlfHeaderValue,
  __smugglingH2TunnelMeta,
} from './smugglingH2Tunnel.js';
import { verifyFindings } from '../verifier.js';

const PREFACE = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';

// Raw H2 mock. `mode`: 'downgrading' | 'sanitising' | 'goaway'.
function startH2Mock(mode) {
  const smuggled = [];
  const waiters = [];
  const mock = {
    smuggled,
    waitForSmuggled(ms) {
      if (smuggled.length > 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), ms);
        waiters.push(() => { clearTimeout(timer); resolve(true); });
      });
    },
  };
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    let prefaceSeen = false;
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!prefaceSeen) {
        if (buf.length < PREFACE.length) return;
        if (buf.slice(0, PREFACE.length).toString('latin1') !== PREFACE) {
          socket.destroy();
          return;
        }
        buf = buf.slice(PREFACE.length);
        prefaceSeen = true;
      }
      for (;;) {
        if (buf.length < 9) return;
        const len = buf.readUIntBE(0, 3);
        if (buf.length < 9 + len) return;
        const type = buf[3];
        const flags = buf[4];
        const streamId = buf.readUInt32BE(5) & 0x7fffffff;
        const payload = buf.slice(9, 9 + len);
        buf = buf.slice(9 + len);
        if (type === 0x4 && (flags & 0x1) === 0) {
          // Peer SETTINGS: ack + send our own (empty) SETTINGS.
          socket.write(encodeFrame(0x4, 0x1, 0, Buffer.alloc(0)));
          socket.write(encodeFrame(0x4, 0, 0, Buffer.alloc(0)));
        } else if (type === 0x1) {
          let fields = [];
          try { fields = decodeHpackBlock(payload); } catch { fields = []; }
          const hasCrlf = fields.some(([, value]) => typeof value === 'string' && value.includes('\r\n'));
          if (mode === 'goaway' && hasCrlf) {
            const body = Buffer.alloc(8);
            socket.write(encodeFrame(0x7, 0, 0, body));
            socket.end();
            return;
          }
          for (const [, value] of fields) {
            if (typeof value === 'string' && value.includes('\r\n') && mode === 'downgrading') {
              const after = value.slice(value.indexOf('\r\n') + 2);
              const firstLine = after.split('\r\n')[0] || '';
              const m = firstLine.match(/^(GET|POST) (\S+) HTTP\/1\.1$/);
              if (m) {
                smuggled.push({ method: m[1], path: m[2] });
                for (const w of waiters.splice(0)) w();
              }
            }
          }
          socket.write(encodeFrame(0x1, 0x4, streamId, encodeHpackIndexed(8))); // :status 200
          socket.write(encodeFrame(0x0, 0x1, streamId, Buffer.from('ok')));
        }
        // Other frames (WINDOW_UPDATE, PING, SETTINGS ack): ignored.
      }
    });
    socket.on('error', () => {});
  });
  mock.server = server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      mock.port = server.address().port;
      resolve(mock);
    });
  });
}

describe('smuggling-h2-tunnel probe', () => {
  let mocks = [];
  let plainServer = null;
  afterEach(async () => {
    for (const m of mocks) await new Promise((r) => m.server.close(r));
    mocks = [];
    if (plainServer) {
      await new Promise((r) => plainServer.close(r));
      plainServer = null;
    }
  });
  async function mock(mode) {
    const m = await startH2Mock(mode);
    mocks.push(m);
    return m;
  }

  it('CONFIRMS when the smuggled request reaches the back-end', async () => {
    const m = await mock('downgrading');
    const findings = await probeSmugglingH2Tunnel(`http://127.0.0.1:${m.port}/`, {
      timeoutMs: 3000,
      smuggledObserver: (ms) => m.waitForSmuggled(ms),
      oobWaitTimeoutMs: 1000,
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'request_smuggling');
    assert.equal(f.id, 'request-smuggling-h2-tunnel');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /H2→H1/);
    assert.ok(f.evidence.response.includes('/dm-smuggled'));
    assert.deepEqual(m.smuggled, [{ method: 'GET', path: '/dm-smuggled' }]);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('stays silent when the front-end sanitises the CRLF (no smuggled request)', async () => {
    const m = await mock('sanitising');
    const findings = await probeSmugglingH2Tunnel(`http://127.0.0.1:${m.port}/`, {
      timeoutMs: 3000,
      smuggledObserver: (ms) => m.waitForSmuggled(ms),
      oobWaitTimeoutMs: 500,
    });
    assert.deepEqual(findings, []);
    assert.deepEqual(m.smuggled, []);
  });

  it('stays silent when the front-end GOAWAYs the attack (refused)', async () => {
    const m = await mock('goaway');
    const diag = {};
    const findings = await probeSmugglingH2Tunnel(`http://127.0.0.1:${m.port}/`, {
      timeoutMs: 3000,
      diagnostics: diag,
      smuggledObserver: (ms) => m.waitForSmuggled(ms),
      oobWaitTimeoutMs: 500,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.attackRejected, true);
  });

  it('skips gracefully when the target has no HTTP/2 surface', async () => {
    plainServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>plain http/1.1 only</html>');
    });
    await new Promise((r) => plainServer.listen(0, '127.0.0.1', r));
    const port = plainServer.address().port;
    const diag = {};
    const findings = await probeSmugglingH2Tunnel(`http://127.0.0.1:${port}/`, {
      timeoutMs: 2000,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.h2Available, false);
    assert.ok(diag.skipped);
  });

  it('HPACK literal round-trips through the codec', () => {
    const block = Buffer.concat([
      encodeHpackIndexed(2),
      encodeHpackLiteral(':path', '/x'),
      encodeHpackLiteral('x-dm-tunnel', 'a\r\nb'),
    ]);
    const fields = decodeHpackBlock(block);
    assert.deepEqual(fields, [
      [':method', 'GET'],
      [':path', '/x'],
      ['x-dm-tunnel', 'a\r\nb'],
    ]);
  });

  it('HPACK integer round-trips, including multi-byte values', () => {
    for (const v of [0, 10, 30, 31, 1337, 65535]) {
      for (const prefix of [4, 5, 7]) {
        const enc = encodeHpackInteger(v, prefix);
        const { value, next } = readHpackInteger(enc, 0, prefix);
        assert.equal(value, v);
        assert.equal(next, enc.length);
      }
    }
  });

  it('crlfHeaderValue embeds a complete smuggled request', () => {
    const v = crlfHeaderValue('example.com');
    assert.ok(v.startsWith('dmprobe\r\nGET /dm-smuggled HTTP/1.1\r\nHost: example.com\r\n'));
    assert.ok(v.endsWith('\r\n\r\n'));
  });

  it('probe meta names the phase and standard/deep depths', () => {
    assert.deepEqual(__smugglingH2TunnelMeta.phases, ['smuggling-h2-tunnel']);
    assert.deepEqual(__smugglingH2TunnelMeta.depth, ['standard', 'deep']);
  });

  it('https targets are skipped, never probed', async () => {
    const diag = {};
    const findings = await probeSmugglingH2Tunnel('https://127.0.0.1:1/', { timeoutMs: 800, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.skipped, 'https unsupported (h2c cleartext only, no TLS/ALPN)');
  });
});
