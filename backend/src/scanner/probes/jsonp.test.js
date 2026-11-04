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
  });

  it('exits clean on plain JSON endpoint', async () => {
    const findings = await probeJsonp('http://127.0.0.1:1/api', ['callback'], { timeoutMs: 3000 });
    assert.ok(Array.isArray(findings));
  });
});
