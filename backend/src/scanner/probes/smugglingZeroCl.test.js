// Tests for the request-smuggling 0.CL / CL.0 probe (row #166
// [Critical] HTTP Request Smuggling — 0.CL / CL.0 variant, CWE-444;
// phase 'smuggling-zero-cl'). 0.CL / CL.0 has no dedicated checklist
// row (#351–#354 cover CL.TE / TE.CL / TE.TE / chunked-extension only).
//
// Raw-socket mocks: 'disagree-zero' (one tier honours the 0, so the
// body bytes are parsed as the next request — the desync shape),
// 'consistent-nonzero' (the ambiguity resolves deterministically to
// the body-carrying length — clean pipelining), and 'rejecting'
// (conflicting headers refused with 400 — the safe behaviour).

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  probeSmugglingZeroCl,
  buildZeroClPayload,
  buildZeroClBaselinePayload,
  __smugglingZeroClMeta,
} from './smugglingZeroCl.js';
import { verifyFindings } from '../verifier.js';

function startMock(mode) {
  const server = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      process(false);
    });
    socket.on('error', () => {});
    socket.on('end', () => {
      if (!socket.destroyed) process(true);
      try { socket.end(); } catch { /* ignore */ }
    });
    function safeWrite(s) {
      try {
        if (!socket.destroyed && socket.writable) socket.write(s);
      } catch { /* peer already gone */ }
    }
    function process(final) {
      if (socket.destroyed) return;
      for (;;) {
        const headEnd = buf.indexOf('\r\n\r\n');
        if (headEnd < 0) return;
        const head = buf.slice(0, headEnd);
        const lines = head.split('\r\n');
        const requestLine = lines[0] || '';
        if (!/^(GET|POST|HEAD|PUT|DELETE|OPTIONS) \S+ HTTP\/1\.1$/.test(requestLine)) {
          safeWrite('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
          buf = '';
          try { socket.end(); } catch { /* ignore */ }
          return;
        }
        const cls = lines
          .slice(1)
          .filter((l) => /^content-length:/i.test(l))
          .map((l) => Number(l.split(':')[1].trim()));
        if (cls.length > 1 && new Set(cls).size > 1 && mode === 'rejecting') {
          safeWrite('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
          buf = '';
          try { socket.end(); } catch { /* ignore */ }
          return;
        }
        let bodyLen = 0;
        if (cls.length) {
          if (mode === 'disagree-zero' && cls.includes(0) && cls.some((c) => c > 0)) bodyLen = 0;
          else if (mode === 'consistent-nonzero') bodyLen = cls.find((c) => c > 0) ?? cls[0];
          else bodyLen = cls[0];
        }
        const total = headEnd + 4 + bodyLen;
        if (buf.length < total) {
          if (!final) return;
        }
        buf = buf.slice(Math.min(total, buf.length));
        safeWrite('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nok');
      }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

describe('smuggling-zero-cl probe', () => {
  let mocks = [];
  afterEach(async () => {
    for (const m of mocks) await new Promise((r) => m.server.close(r));
    mocks = [];
  });
  async function mock(mode) {
    const m = await startMock(mode);
    mocks.push(m);
    return `http://127.0.0.1:${m.port}/`;
  }

  it('CONFIRMS desync when a zero length desyncs the connection (0.CL)', async () => {
    const findings = await probeSmugglingZeroCl(await mock('disagree-zero'), { timeoutMs: 1500 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'request_smuggling');
    assert.equal(f.id, 'request-smuggling-zero-cl');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /0\.CL/);
    assert.ok(f.evidence.signalCorrelated);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('stays silent when the ambiguity resolves deterministically', async () => {
    const findings = await probeSmugglingZeroCl(await mock('consistent-nonzero'), { timeoutMs: 1500 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when the server rejects conflicting headers (safe)', async () => {
    const findings = await probeSmugglingZeroCl(await mock('rejecting'), { timeoutMs: 1500 });
    assert.deepEqual(findings, []);
  });

  it('payload builders carry Content-Length: 0 alongside a body length', () => {
    const a = buildZeroClPayload('/', 'example.com', 'zero-cl', '1234567');
    assert.ok(a.includes('Content-Length: 0\r\nContent-Length: 7\r\n'));
    const b = buildZeroClPayload('/', 'example.com', 'cl-zero', '1234567');
    assert.ok(b.includes('Content-Length: 7\r\nContent-Length: 0\r\n'));
    assert.ok(a.includes('1234567GET / HTTP/1.1'));
    const base = buildZeroClBaselinePayload('/', 'example.com');
    assert.equal((base.match(/Content-Length:/g) || []).length, 1);
  });

  it('probe meta names the phase and standard/deep depths', () => {
    assert.deepEqual(__smugglingZeroClMeta.phases, ['smuggling-zero-cl']);
    assert.deepEqual(__smugglingZeroClMeta.depth, ['standard', 'deep']);
  });

  it('https targets are skipped, never probed', async () => {
    const diag = {};
    const findings = await probeSmugglingZeroCl('https://127.0.0.1:1/', { timeoutMs: 800, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.skipped, 'https unsupported (raw socket, no TLS)');
  });
});
