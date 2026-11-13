// Tests for cache poisoning (# — XFH lane) + cache deception (#169/#434/#435).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCachePoisoning } from './cachePoison.js';

describe('cachePoison probe', () => {
  let server;
  let port;
  let poisonedCanary = null; // one-shot simulated poisoned cache for /app
  let qpPoisoned = null; // one-shot poisoned cache for /qp (query-param leg)
  let cookiePoisoned = null; // one-shot poisoned cache for /cookie (cookie leg)
  let fatPoisoned = null; // one-shot poisoned cache for /fatget (fat-GET leg)
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
      // Query-param poisonable endpoint: reflects the dmcache query
      // value and serves the poisoned variant once to the next clean
      // request (cache ignores the query parameter).
      if (pathname === '/qp' || pathname === '/qp-keyed') {
        const v = u.searchParams.get('dmcache') || '';
        let served = '';
        if (pathname === '/qp') {
          if (v) { qpPoisoned = v; served = v; }
          else if (qpPoisoned) { served = qpPoisoned; qpPoisoned = null; }
        } else if (v) {
          served = v; // correctly keyed: reflected but never served clean
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>welcome ${served}</html>`);
        return;
      }
      // Cookie poisonable endpoint: same shape, canary rides the
      // dmcache cookie.
      if (pathname === '/cookie' || pathname === '/cookie-keyed') {
        const m = /dmcache=([^;]+)/.exec(req.headers.cookie || '');
        const v = m ? m[1] : '';
        let served = '';
        if (pathname === '/cookie') {
          if (v) { cookiePoisoned = v; served = v; }
          else if (cookiePoisoned) { served = cookiePoisoned; cookiePoisoned = null; }
        } else if (v) {
          served = v; // correctly keyed: reflected but never served clean
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>welcome ${served}</html>`);
        return;
      }
      // Fat-GET endpoints need the request body: collect it, then respond.
      if (pathname === '/fatget' || pathname === '/fatget-keyed') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const v = params.get('dmcache') || '';
          let served = '';
          if (pathname === '/fatget') {
            if (v) { fatPoisoned = v; served = v; }
            else if (fatPoisoned) { served = fatPoisoned; fatPoisoned = null; }
          }
          // /fatget-keyed ignores GET bodies entirely (models a server
          // that never reads them) — the poison response never carries
          // the canary, so the leg stays silent.
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html>welcome ${served}</html>`);
        });
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

  // ---- New unkeyed-input legs (#356 / #357 / #358) -------------------------
  // Lab-gated: the new legs run only with allowWrite: true.

  it('detects query-param cache poisoning via canary in the clean victim response (#356)', async () => {
    const findings = await probeCachePoisoning(`${base()}/qp`, { timeoutMs: 8000, allowWrite: true });
    const f = findings.find((x) => x.id === 'cache-poisoning-query-param');
    assert.ok(f, 'expected cache-poisoning-query-param finding');
    assert.equal(f.class, 'cache_poisoning');
    assert.equal(f.severity, 'medium');
  });

  it('stays silent on query-param leg when the cache keys the parameter (#356)', async () => {
    const findings = await probeCachePoisoning(`${base()}/qp-keyed`, { timeoutMs: 8000, allowWrite: true });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-query-param'), 'no query-param finding when keyed');
  });

  it('skips the query-param leg without allowWrite (#356, lab-gated)', async () => {
    const findings = await probeCachePoisoning(`${base()}/qp`, { timeoutMs: 8000 });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-query-param'), 'no query-param finding without allowWrite');
  });

  it('detects fat-GET cache poisoning via body canary in the clean victim response (#357)', async () => {
    const findings = await probeCachePoisoning(`${base()}/fatget`, { timeoutMs: 8000, allowWrite: true });
    const f = findings.find((x) => x.id === 'cache-poisoning-fat-get');
    assert.ok(f, 'expected cache-poisoning-fat-get finding');
    assert.equal(f.class, 'cache_poisoning');
    assert.equal(f.severity, 'medium');
  });

  it('stays silent on fat-GET leg when the server ignores GET bodies (#357)', async () => {
    const findings = await probeCachePoisoning(`${base()}/fatget-keyed`, { timeoutMs: 8000, allowWrite: true });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-fat-get'), 'no fat-GET finding when body ignored');
  });

  it('skips the fat-GET leg without allowWrite (#357, lab-gated)', async () => {
    const findings = await probeCachePoisoning(`${base()}/fatget`, { timeoutMs: 8000 });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-fat-get'), 'no fat-GET finding without allowWrite');
  });

  it('detects cookie cache poisoning via canary in the clean victim response (#358)', async () => {
    const findings = await probeCachePoisoning(`${base()}/cookie`, { timeoutMs: 8000, allowWrite: true });
    const f = findings.find((x) => x.id === 'cache-poisoning-cookie');
    assert.ok(f, 'expected cache-poisoning-cookie finding');
    assert.equal(f.class, 'cache_poisoning');
    assert.equal(f.severity, 'medium');
  });

  it('stays silent on cookie leg when the cache keys the cookie (#358)', async () => {
    const findings = await probeCachePoisoning(`${base()}/cookie-keyed`, { timeoutMs: 8000, allowWrite: true });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-cookie'), 'no cookie finding when keyed');
  });

  it('skips the cookie leg without allowWrite (#358, lab-gated)', async () => {
    const findings = await probeCachePoisoning(`${base()}/cookie`, { timeoutMs: 8000 });
    assert.ok(!findings.some((x) => x.id === 'cache-poisoning-cookie'), 'no cookie finding without allowWrite');
  });
});
