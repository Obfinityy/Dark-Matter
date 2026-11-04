// Regression tests for the 4 Nov 2026 false-positive fix:
// an SPA fallback page (redirect chain OR catch-all 200) must yield ZERO
// findings, while genuinely exposed files must still be confirmed.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSensitiveFiles } from './files.js';

// Mimics a Cloudflare Pages SPA homepage: plenty of '=' characters in the
// JS (which used to trip the old /.env marker) but zero KEY=VALUE lines.
const INDEX_HTML =
  '<!doctype html><html><head><script src="/assets/index-abc123.js"></script></head>' +
  '<body><div id="root"></div><script>window.cfg={a=1,b="x=y",mode:"dark"};</script></body></html>';

const REAL_ENV = 'DB_USER=admin\nDB_PASSWORD=s3cr3t\nAPI_KEY=sk-live-123\nDEBUG=false\n';

describe('sensitive-file probe (files.js)', () => {
  let server;
  let port;
  let mode = 'real';
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const p = u.pathname;

      if (mode === 'spa-redirect') {
        // Cloudflare-Pages behaviour: every unknown path 308s to the www
        // homepage, which fetch used to follow into a 200 text/html body.
        if (p === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(INDEX_HTML);
          return;
        }
        res.writeHead(308, { Location: `${base()}/` });
        res.end();
        return;
      }

      if (mode === 'spa-catchall') {
        // React-style SPA: every path serves the index page with a direct 200.
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(INDEX_HTML);
        return;
      }

      if (mode === 'redirect-to-real-env') {
        // A redirect must NOT count as exposure even if it lands on a real file.
        if (p === '/.env') {
          res.writeHead(302, { Location: `${base()}/real-env` });
          res.end();
          return;
        }
        if (p === '/real-env') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(REAL_ENV);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }

      // mode 'real': genuinely exposed files.
      if (p === '/.env') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(REAL_ENV);
        return;
      }
      if (p === '/.git/HEAD') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ref: refs/heads/main\n');
        return;
      }
      if (p === '/phpinfo.php') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>phpinfo()</title></head><body>PHP Version 8.2 phpinfo() table</body></html>');
        return;
      }
      if (p === '/server-status') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>Apache Status</title></head><body>Apache Status - localhost</body></html>');
        return;
      }
      if (p === '/.DS_Store') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end('Bud1\x00\x00\x10\x00binary-ds-store');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('SPA with 308 redirect chain (the .env incident shape) yields ZERO findings', async () => {
    mode = 'spa-redirect';
    const findings = await probeSensitiveFiles(base(), { timeoutMs: 8000 });
    assert.equal(findings.length, 0, `expected no findings, got ${JSON.stringify(findings.map((f) => f.title))}`);
  });

  it('SPA with catch-all 200 for every path yields ZERO findings', async () => {
    mode = 'spa-catchall';
    const findings = await probeSensitiveFiles(base(), { timeoutMs: 8000 });
    assert.equal(findings.length, 0, `expected no findings, got ${JSON.stringify(findings.map((f) => f.title))}`);
  });

  it('redirect to a real .env is NOT confirmed as exposed (no redirect following)', async () => {
    mode = 'redirect-to-real-env';
    const findings = await probeSensitiveFiles(base(), { timeoutMs: 8000 });
    assert.equal(findings.length, 0, `expected no findings, got ${JSON.stringify(findings.map((f) => f.title))}`);
  });

  it('genuinely exposed files are all still confirmed', async () => {
    mode = 'real';
    const findings = await probeSensitiveFiles(base(), { timeoutMs: 8000 });
    const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
    assert.equal(findings.length, 5, `expected 5 findings, got ${JSON.stringify(findings.map((f) => f.title))}`);
    assert.equal(byId['sensitive-file-env'].severity, 'critical');
    assert.ok(byId['sensitive-file-env'].evidence.response.includes('KEY=VALUE lines'));
    assert.equal(byId['sensitive-file-gitHEAD'].severity, 'high');
    assert.equal(byId['sensitive-file-phpinfophp'].severity, 'medium');
    assert.equal(byId['sensitive-file-serverstatus'].severity, 'medium');
    assert.equal(byId['sensitive-file-DSStore'].severity, 'low');
  });

  it('findings carry non-HTML content-type evidence and direct-200 proof', async () => {
    mode = 'real';
    const findings = await probeSensitiveFiles(base(), { timeoutMs: 8000 });
    const f = findings.find((x) => x.id === 'sensitive-file-env');
    assert.ok(f);
    assert.ok(f.evidence.response.includes('HTTP 200 (direct, no redirect)'));
    assert.ok(f.evidence.response.includes('text/plain'));
    assert.ok(f.evidence.request.startsWith('GET http://127.0.0.1'));
    assert.equal(f.evidence.signalCorrelated, true);
  });
});
