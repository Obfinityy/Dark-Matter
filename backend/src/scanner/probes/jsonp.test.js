// Tests for the JSONP probe (#49).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeJsonp } from './jsonp.js';

describe('jsonp probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const cb = u.searchParams.get('callback') || 'cb';
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      // Vulnerable stub: verbatim callback reflection.
      res.end(`${cb}({"user":"alice"});`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects verbatim callback reflection', async () => {
    const findings = await probeJsonp(`${base()}/api`, ['callback'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const jsonp = findings.find((f) => f.class === 'jsonpinjection');
    assert.ok(jsonp, 'expected JSONP finding on reflecting stub');
    assert.equal(jsonp.severity, 'high');
    assert.ok(jsonp.evidence.response.includes('dmCb'), 'evidence must quote the reflected callback sample verbatim');
  });

  it('exits clean on plain JSON endpoint', async () => {
    const findings = await probeJsonp('http://127.0.0.1:1/api', ['callback'], { timeoutMs: 3000 });
    assert.deepEqual(findings, []);
  });

  it('records D4 INFO when a shaped endpoint validates the callback', async () => {
    // Strict stub: fixed callback name, never reflects the probe value.
    const strict = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('cb({"user":"alice"});');
    });
    await new Promise((r) => strict.listen(0, '127.0.0.1', r));
    const p = strict.address().port;
    try {
      const findings = await probeJsonp(`http://127.0.0.1:${p}/api`, ['callback'], { timeoutMs: 8000 });
      const info = findings.find((f) => f.id.startsWith('jsonp-valid-'));
      assert.ok(info, `expected D4 INFO finding, got ${JSON.stringify(findings.map((f) => f.id))}`);
      assert.equal(info.severity, 'info');
      assert.ok(!findings.some((f) => f.severity === 'high'), 'no HIGH on a validating endpoint');
    } finally {
      await new Promise((r) => strict.close(r));
    }
  });

  it('records D5 INFO when a malformed callback discloses internals', async () => {
    // Error stub: fixed callback for clean values, stack-trace error for parens.
    const erry = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      const cb = u.searchParams.get('callback') || '';
      if (cb.includes('(')) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Fatal error: Uncaught Exception in /var/www/app.php on line 42 — stack trace follows');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('cb({"user":"alice"});');
    });
    await new Promise((r) => erry.listen(0, '127.0.0.1', r));
    const p = erry.address().port;
    try {
      const findings = await probeJsonp(`http://127.0.0.1:${p}/api`, ['callback'], { timeoutMs: 8000 });
      const smell = findings.find((f) => f.id.startsWith('jsonp-err-'));
      assert.ok(smell, `expected D5 INFO finding, got ${JSON.stringify(findings.map((f) => f.id))}`);
      assert.equal(smell.severity, 'info');
      assert.ok(smell.evidence.response.includes('Fatal error'), 'D5 evidence must quote the error verbatim');
    } finally {
      await new Promise((r) => erry.close(r));
    }
  });
});
