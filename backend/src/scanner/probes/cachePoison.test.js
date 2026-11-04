// Tests for cache poisoning (# — XFH lane) + cache deception (#169/#434/#435).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCachePoisoning } from './cachePoison.js';

describe('cachePoison probe', () => {
  let server;
  let port;
  let poisonedCanary = null; // one-shot simulated poisoned cache for /app
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const pathname = u.pathname;
      const xfh = req.headers['x-forwarded-host'] || '';

      // XFH-poisonable app endpoint with a simulated warm cache: the
      // poisoned canary is stored and served once to the next clean
      // request (mimics a cache storing the poisoned variant).
      if (pathname === '/app') {
        let served = '';
        if (xfh) {
          poisonedCanary = xfh;
          served = xfh;
        } else if (poisonedCanary) {
          served = poisonedCanary;
          poisonedCanary = null;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>welcome ${served}</html>`);
        return;
      }
      // Deception-warm cache: the /.css variant is served as a cache HIT
      // carrying authenticated content (CSRF token + logout + email).
      if (pathname === '/account/.css') {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'X-Cache': 'HIT',
          'Age': '42',
        });
        res.end('<html><input name="csrf_token" value="tok123">user@example.com<a href="/logout">logout</a></html>');
        return;
      }
      // All other variants: fresh, never cached.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>public page</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects XFH cache poisoning via canary in the clean victim response', async () => {
    const findings = await probeCachePoisoning(`${base()}/app`, { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'cache_poisoning');
    assert.ok(f, 'expected cache_poisoning finding');
    assert.equal(f.severity, 'medium');
  });

  it('fires high cache_deception when the cached /.css variant holds sensitive content (#435)', async () => {
    const findings = await probeCachePoisoning(`${base()}/account?session=1`, { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'cache_deception');
    assert.ok(f, 'expected cache_deception finding on /.css variant');
    assert.equal(f.severity, 'high');
    assert.match(f.id, /dot-css/);
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('returns no deception findings when nothing is cached', async () => {
    // /public has no cache headers on any variant; /app reflects XFH so we
    // only assert on the deception classes here.
    const findings = await probeCachePoisoning(`${base()}/public?x=1`, { timeoutMs: 8000 });
    assert.ok(!findings.some((x) => x.class === 'cache_deception'), 'no cache_deception without HIT');
    assert.ok(!findings.some((x) => x.class === 'cache_deception_surface'), 'no surface without HIT');
  });

  it('skips deception on static-looking URLs with no query', async () => {
    const findings = await probeCachePoisoning(`${base()}/index.html`, { timeoutMs: 8000 });
    assert.ok(!findings.some((x) => x.class.startsWith('cache_deception')));
  });
});
