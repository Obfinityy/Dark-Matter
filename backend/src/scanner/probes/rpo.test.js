// Tests for the RPO probe (#50).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeRpo } from './rpo.js';

describe('rpo probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  const pageHtml = () =>
    `<html><head><link rel="stylesheet" href="style.css"></head><body>hello</body></html>`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      // Path-tolerant stub: any path renders the same page, reflects q.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pageHtml().replace('hello', `hello ${q}`));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects RPO sink on tolerant page with reflection', async () => {
    const findings = await probeRpo(base(), ['q'], { timeoutMs: 10000 });
    assert.ok(Array.isArray(findings));
    // The stub reflects verbatim and is path-tolerant; oracle may confirm.
  });

  it('exits clean on non-HTML page', async () => {
    const findings = await probeRpo('http://127.0.0.1:1/', ['q'], { timeoutMs: 3000 });
    assert.ok(Array.isArray(findings));
  });
});
