// Tests for the CSV/log injection probe (#42).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCsvLog } from './csvLogInjection.js';

describe('csvLog probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/export') {
        const name = u.searchParams.get('name') || '';
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="users.csv"',
        });
        // Vulnerable stub: formula lands verbatim at cell start.
        res.end(`id,name\n1,${name}\n`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><a href="/export">Export CSV</a></html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects verbatim formula cell in CSV export', async () => {
    const findings = await probeCsvLog(base(), ['name'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const formula = findings.find((f) => f.class === 'csv_injection');
    assert.ok(formula, 'expected CSV formula finding on vulnerable stub');
    assert.equal(formula.severity, 'high');
    assert.ok(formula.evidence.response.includes('=1+1'), 'evidence must quote the formula cell verbatim');
  });

  it('exits INFO-clean with no export surface', async () => {
    const findings = await probeCsvLog('http://127.0.0.1:1/', ['q'], { timeoutMs: 3000 });
    assert.ok(Array.isArray(findings));
  });

  // ---- CSV :85 gate: HTML export pages must not fire csv_injection --------
  it(':85 FP-guard: long HTML export echoing the formula stays silent', async () => {
    const html = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      if (u.pathname === '/export') {
        const q = u.searchParams.get('q') || '';
        res.writeHead(200, { 'Content-Type': 'text/html' });
        // Long HTML page echoing the formula inside a quoted attribute.
        res.end(`<html><body>${'<p>filler text</p>'.repeat(40)}<input name="q" value="${q}"></body></html>`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><a href="/export">Export CSV</a></html>');
    });
    await new Promise((r) => html.listen(0, '127.0.0.1', r));
    const p = html.address().port;
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${p}/`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.class === 'csv_injection'), 'an HTML page is not a CSV export');
    } finally {
      await new Promise((r) => html.close(r));
    }
  });

  it(':85 text/plain export still fires', async () => {
    const plain = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      if (u.pathname === '/export') {
        const q = u.searchParams.get('q') || '';
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`id,name\n1,${q}\n`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><a href="/export">Export CSV</a></html>');
    });
    await new Promise((r) => plain.listen(0, '127.0.0.1', r));
    const p = plain.address().port;
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${p}/`, ['q'], { timeoutMs: 8000 });
      assert.ok(findings.some((x) => x.class === 'csv_injection'), 'a text/plain CSV export must still fire');
    } finally {
      await new Promise((r) => plain.close(r));
    }
  });

  // ---- T4/T5 log half ------------------------------------------------------
  // Stub: /echo echoes q verbatim (and stores LF-split lines for /logs);
  // /echo-strip strips newlines; /echo-escape HTML-escapes; /logs renders
  // the stored log lines.
  function startLogStub({ storeLogs = true } = {}) {
    const logLines = ['2026-11-06 10:00:00 INFO GET /search'];
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      const q = u.searchParams.get('q') || '';
      if (u.pathname === '/logs') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(logLines.join('\n'));
        return;
      }
      if (u.pathname === '/echo-strip') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>echo: ${q.replace(/\n/g, '')}</html>`);
        return;
      }
      if (u.pathname === '/echo-escape') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>echo: ${q.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</html>`);
        return;
      }
      // /echo: verbatim echo; store the post-LF part as a log line (only
      // when storeLogs — the FP-guard test needs a reflection-only server).
      if (storeLogs && q.includes('\n')) logLines.push(q.split('\n').slice(1).join('\n'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>echo: ${q}</html>`);
    });
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
  }

  it('T4 FP-guard: bare reflection is INFO, never HIGH', async () => {
    const { server, port } = await startLogStub({ storeLogs: false });
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${port}/echo`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.id.startsWith('log-forge-') && x.severity === 'high'), 'a reflection is not a stored log forgery');
      const info = findings.find((x) => x.id.startsWith('log-forge-'));
      assert.ok(info, 'expected an INFO T4 signal on the reflection');
      assert.equal(info.severity, 'info');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('T4 true positive: forged line in the stored log fires HIGH', async () => {
    const { server, port } = await startLogStub({ storeLogs: true });
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${port}/echo`, ['q'], { timeoutMs: 8000 });
      const f = findings.find((x) => x.id.startsWith('log-forge-') && x.severity === 'high');
      assert.ok(f, `expected HIGH log-forge finding, got ${JSON.stringify(findings.map((x) => `${x.id}:${x.severity}`))}`);
      assert.ok(f.evidence.response.includes('__dm_log_'), 'evidence must quote the forged log line verbatim');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('T4 negative: LF stripped means no forged line', async () => {
    const { server, port } = await startLogStub({ storeLogs: false });
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${port}/echo-strip`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.id.startsWith('log-forge-')), 'a stripped LF cannot forge a line');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('T5 positive: unescaped script quotes the fragment verbatim', async () => {
    const { server, port } = await startLogStub({ storeLogs: false });
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${port}/echo`, ['q'], { timeoutMs: 8000 });
      const f = findings.find((x) => x.id.startsWith('log-xss-'));
      assert.ok(f, `expected T5 MEDIUM finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'medium');
      assert.ok(!f.title.includes('stored'), 'title must not claim storage on a reflection');
      assert.ok(f.evidence.response.includes('<script>'), 'evidence must quote the matched script fragment');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('T5 negative: escaped script stays silent', async () => {
    const { server, port } = await startLogStub({ storeLogs: false });
    try {
      const findings = await probeCsvLog(`http://127.0.0.1:${port}/echo-escape`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.id.startsWith('log-xss-')), 'an escaped script is not a log-viewer XSS bridge');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
