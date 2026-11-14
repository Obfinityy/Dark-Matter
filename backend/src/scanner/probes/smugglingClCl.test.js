// Tests for the request-smuggling CL.CL probe (row #166 [Critical]
// HTTP Request Smuggling — CL.CL variant, CWE-444; phase
// 'smuggling-cl-cl'). CL.CL has no dedicated checklist row (#351–#354
// cover CL.TE / TE.CL / TE.TE / chunked-extension only).
//
// Raw-socket mocks simulate the three behaviours a two-tier setup
// can show: 'disagree-last' (the back-end honours the LAST
// Content-Length while the front honours the first — leftover bytes
// desync the connection), 'secure-first' (one length wins
// consistently — clean pipelining), and 'rejecting' (duplicate
// headers refused with 400 — the safe behaviour). All servers are
// local node:net listeners; no external service is touched.

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  probeSmugglingClCl,
  responseStatuses,
  countResponses,
  assessSmugglingDesync,
  buildClClPayload,
  buildBaselinePayload,
  __smugglingClClMeta,
} from './smugglingClCl.js';
import { verifyFindings } from '../verifier.js';

// Minimal HTTP/1.1 request parser over a raw socket. `mode` picks the
// Content-Length rule: 'disagree-last' consumes the body per the LAST
// duplicate CL (the front/back disagreement shape), 'secure-first'
// per the FIRST, 'rejecting' 400s any request with differing
// duplicate CLs. A remainder that does not parse as a request line
// gets a 400 — the desync signal.
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
        const bodyLen = cls.length ? (mode === 'disagree-last' ? cls[cls.length - 1] : cls[0]) : 0;
        const total = headEnd + 4 + bodyLen;
        if (buf.length < total) {
          if (!final) return;
          // Half-closed with a short body: answer what we have.
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

describe('smuggling-cl-cl probe', () => {
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

  it('CONFIRMS desync when front/back disagree on duplicate Content-Length', async () => {
    const findings = await probeSmugglingClCl(await mock('disagree-last'), { timeoutMs: 1500 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'request_smuggling');
    assert.equal(f.id, 'request-smuggling-cl-cl');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /CL\.CL/);
    assert.ok(f.evidence.signalCorrelated);
    assert.ok(f.evidence.response.includes('baseline: 2'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('stays silent when one Content-Length wins consistently', async () => {
    const findings = await probeSmugglingClCl(await mock('secure-first'), { timeoutMs: 1500 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when the server rejects duplicate Content-Length (safe)', async () => {
    const findings = await probeSmugglingClCl(await mock('rejecting'), { timeoutMs: 1500 });
    assert.deepEqual(findings, []);
  });

  it('responseStatuses / countResponses read status lines in order', () => {
    const data = 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 400 Bad Request\r\n\r\n';
    assert.deepEqual(responseStatuses(data), [200, 400]);
    assert.equal(countResponses(data), 2);
    assert.equal(countResponses(''), 0);
  });

  it('assessSmugglingDesync confirms a diverged second status', () => {
    const v = assessSmugglingDesync({
      baseline: { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
      probe: { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 400 Bad Request\r\n\r\n', timedOut: false },
    });
    assert.equal(v.verdict, 'confirmed');
  });

  it('assessSmugglingDesync rejects a 400 on the ambiguous request itself', () => {
    const v = assessSmugglingDesync({
      baseline: { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
      probe: { data: 'HTTP/1.1 400 Bad Request\r\n\r\n', timedOut: false },
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessSmugglingDesync rejects identical status sequences', () => {
    const v = assessSmugglingDesync({
      baseline: { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
      probe: { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessSmugglingDesync is unconfirmed when the baseline never pipelines', () => {
    const v = assessSmugglingDesync({
      baseline: { data: 'HTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
      probe: { data: 'HTTP/1.1 200 OK\r\n\r\nok', timedOut: false },
    });
    assert.equal(v.verdict, 'unconfirmed');
  });

  it('payload builders carry two differing Content-Length headers', () => {
    const p = buildClClPayload('/', 'example.com', 5, 11, '12345');
    assert.ok(p.includes('Content-Length: 5\r\nContent-Length: 11\r\n'));
    assert.ok(p.includes('12345GET / HTTP/1.1'));
    const b = buildBaselinePayload('/', 'example.com');
    assert.equal((b.match(/Content-Length:/g) || []).length, 1);
  });

  it('probe meta names the phase and standard/deep depths', () => {
    assert.deepEqual(__smugglingClClMeta.phases, ['smuggling-cl-cl']);
    assert.deepEqual(__smugglingClClMeta.depth, ['standard', 'deep']);
  });

  it('https targets are skipped, never probed', async () => {
    const diag = {};
    const findings = await probeSmugglingClCl('https://127.0.0.1:1/', { timeoutMs: 800, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.skipped, 'https unsupported (raw socket, no TLS)');
  });
});
