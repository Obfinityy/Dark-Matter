// Gated discovery-phase skip records (7 Nov 2026).
//
// REGRESSION (Juice js-routes proof, hunt h_66b617349efe): the three
// gated discovery phases (dom-render, openapi-targets, js-api-routes)
// were wrapped in `if` guards around the whole step() call, so when
// the gate was false the phase left NO record at all — no phase event,
// no rollup entry. The rollup could not tell "gate false" from "phase
// missing": the parent brief expected 94 with js-api-routes present as
// skipped and the run read 92, baseline-exact.
//
// The fix: the false branch records a skipped phase entry (ok:true,
// skipped, skipReason) via the same skipPhase the param battery uses
// (35/63 fix, 5749d33c). A firing phase emits no skip record, and a
// phases allowlist without a discovery phase emits no record for it.
//
// No network, no docker in these tests — fetch is stubbed throughout
// (a local stub HTTP server for the spec / SPA cases).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runScan, PARAM_BATTERY_PHASES, DEFAULT_PHASES, buildPhaseRollup, buildPhaseSummaryLine, hasOffPageParamTarget } from './index.js';

const realFetch = globalThis.fetch;
const teardown = () => {
  globalThis.fetch = realFetch;
};

// A DVWA-style login page: a single POST form, no GET forms, no links.
const LOGIN_PAGE = `<html><head><title>Login</title></head><body>
<form action="/login.php" method="post">
<input name="username"><input name="password">
<input name="Login" type="submit" value="Login">
</form></body></html>`;

function stubPage(html) {
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers({ server: 'nginx/1.24' }),
    text: async () => html,
  });
}

const byName = (phases) => Object.fromEntries(phases.map((p) => [p.name, p]));

// A bare page with no links, no forms, no parameters.
const BARE_PAGE = `<html><head><title>t</title></head><body><p>hello</p></body></html>`;

// Minimal OpenAPI 3 spec: one query-param GET, one path-param GET.
const MINI_SPEC = {
  openapi: '3.0.0',
  info: { title: 'mini', version: '1.0.0' },
  paths: {
    '/search': {
      get: {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'ok' } },
      },
    },
    '/items/{item_id}': {
      get: {
        parameters: [{ name: 'item_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'ok' } },
      },
    },
  },
};

// Juice-shaped fixtures (trimmed, same shape as domRender.test.js):
// a static shell with no elements, a root render linking to /#/login,
// and a login render with two NAMED standalone inputs, no <form>.
const GS_SHELL = `<html><head><title>Shop</title></head><body><app-root></app-root><script src="main.js"></script></body></html>`;
const GS_ROOT_DOM = `<html><head><title>Shop</title></head><body><app-root>
<nav><a href="#/login">Login</a><a href="#/about">About</a>
<input type="text" id="search" disabled=""></nav>
<router-outlet></router-outlet></app-root></body></html>`;
const GS_LOGIN_DOM = `<html><body><app-root>
<input id="email" name="email" type="text" required="">
<input id="password" name="password" type="password" required="">
</app-root></body></html>`;

describe('gated discovery phases record a skip on the false branch', () => {
  it('GS-1: dom-render gated off by a static form records a skip, streams through onPhase', async () => {
    stubPage(LOGIN_PAGE);
    try {
      const seen = [];
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'dom-render', 'headers'],
        },
        { timeoutMs: 5000, onPhase: (p) => seen.push(p) }
      );
      const dom = byName(result.phases)['dom-render'];
      assert.ok(dom, 'dom-render must leave a record even when gated off');
      assert.equal(dom.skipped, true);
      assert.equal(dom.skipReason, 'static elements found');
      assert.equal(dom.ok, true);
      assert.equal(dom.error, null);
      assert.equal(dom.findingsCount, 0);
      assert.equal(dom.durationMs, 0);
      // The skip streams through onPhase exactly like an executed step.
      assert.ok(seen.some((p) => p.name === 'dom-render' && p.skipped));
      // No openapi/js-api-routes records: they are not in the allowlist.
      assert.equal(result.phases.some((p) => p.name === 'openapi-targets'), false);
      assert.equal(result.phases.some((p) => p.name === 'js-api-routes'), false);
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 5,
        ok: 4,
        failed: 0,
        skipped: 1,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('GS-2: openapi-targets gated off by a static form records a skip and fetches no spec', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push(String(url));
      return {
        status: 200,
        headers: new Headers({ server: 'nginx/1.24' }),
        text: async () => LOGIN_PAGE,
      };
    };
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      const oa = byName(result.phases)['openapi-targets'];
      assert.ok(oa, 'openapi-targets must leave a record even when gated off');
      assert.equal(oa.skipped, true);
      assert.equal(oa.skipReason, 'param targets already exist');
      assert.equal(oa.ok, true);
      assert.equal(oa.error, null);
      assert.equal(oa.findingsCount, 0);
      // The spec must not even be fetched when static targets exist.
      assert.equal(
        calls.some((u) => u.includes('openapi.json')),
        false,
        `spec must not be fetched, saw: ${calls.slice(0, 5).join(' | ')}`
      );
      // The battery still runs on the static form target.
      const sqli = byName(result.phases)['sqli-error'];
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'battery must run on the static form target');
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 5,
        ok: 4,
        failed: 0,
        skipped: 1,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('GS-3: js-api-routes gated off AFTER openapi-targets fires records a skip, openapi runs', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(MINI_SPEC));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'mini api' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        {
          target,
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'js-api-routes', 'headers'],
        },
        { timeoutMs: 5000, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      // openapi-targets FIRED and unlocked the battery — it must run,
      // never skip, even though js-api-routes skips right after it.
      const oa = byName(result.phases)['openapi-targets'];
      assert.ok(oa && oa.ok && !oa.skipped, 'openapi-targets must run, not skip');
      assert.equal(oa.openApiTargets, 2, 'mini spec must yield exactly 2 targets');
      const js = byName(result.phases)['js-api-routes'];
      assert.ok(js, 'js-api-routes must leave a record even when gated off');
      assert.equal(js.skipped, true);
      assert.equal(js.skipReason, 'param targets already exist');
      assert.equal(js.ok, true);
      assert.equal(js.error, null);
      assert.equal(js.findingsCount, 0);
      // No bundle was mined: the gate re-check saw openapi's targets.
      assert.equal(
        calls.some((c) => c.url.endsWith('.js')),
        false,
        'no JS bundle must be fetched when the gate is false'
      );
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 6,
        ok: 5,
        failed: 0,
        skipped: 1,
        timedOut: 0,
      });
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('GS-4: all three discovery phases FIRE on a bare page — no skip records, 99/58/41 rollup', async () => {
    stubPage(BARE_PAGE);
    try {
      const result = await runScan(
        { target: 'http://example.com/', confirmedAuthorized: true },
        {
          timeoutMs: 5000,
          nucleiRunner: async () => ({ ok: true, timedOut: false, findings: [] }),
          domRenderer: async () => ({ ok: true, html: '<html><body></body></html>' }),
        }
      );
      for (const name of ['dom-render', 'openapi-targets', 'js-api-routes']) {
        const ph = byName(result.phases)[name];
        assert.ok(ph, `${name} must record when it fires`);
        assert.equal(ph.ok, true, `${name} must be ok`);
        assert.equal(ph.skipped, undefined, `${name} must not skip when it fires`);
      }
      // Bare page: all three fire (honest no-ops), battery skips 29,
      // verb-tampering + method-override + secrets-in-js +
      // browser-storage + dom-xss-sinks + dom-xss-location-hash +
      // error-disclosure +
      // validation skip with
      // 'no probe targets' / 'no script targets' (7 Nov 2026), and
      // fingerprint-banner +
      // source-code-disclosure + metadata-leakage +
      // sensitive-data-in-logs + sensitive-info-disclosure +
      // timing-side-channel +
      // untrusted-js-inclusion + api-versioning +
      // session-token-in-url + credential-disclosure + sqli-oob +
      // sensitive-cache + missing-auth RUN (the pasted page is always a surface —
      // 0 findings on the bare stub), and basket-logic RUNS as an
      // honest no-op (no basket routes on a bare page — 8 Nov 2026,
      // 88th phase) instead of skipping, and workflow-skip RUNS as
      // an honest no-op alongside it (no basket/checkout routes on
      // a bare page — 8 Nov 2026, 89th phase) instead of skipping,
      // and twofa-bruteforce RUNS as an honest no-op alongside them
      // (no 2FA verify route on a bare page — 8 Nov 2026, 90th
      // phase) instead of skipping, and dom-xss-location-hash SKIPS
      // with 'no script targets' (a bare page carries no bundles —
      // 9 Nov 2026, 91st phase), and credential-stuffing RUNS as an
      // honest no-op alongside them (no login route on a bare page —
      // 9 Nov 2026, 92nd phase) instead of skipping, and
      // dom-postmessage SKIPS with 'no script targets' alongside
      // dom-xss-location-hash (a bare page carries no bundles —
      // 9 Nov 2026, 93rd phase), and csti SKIPS with 'no script
      // targets' alongside them (a bare page carries no bundles —
      // 9 Nov 2026, 94th phase), and captcha SKIPS with 'no script
      // targets' alongside them (a bare page carries no bundles —
      // 9 Nov 2026, 95th phase), and css-injection RUNS as an
      // honest no-op alongside them (no style contexts on a bare
      // page — 9 Nov 2026, 96th phase), and bfla RUNS as an honest
      // no-op alongside them (no admin routes on a bare page —
      // 9 Nov 2026, 97th phase), and mutation-xss SKIPS with 'no
      // script targets' alongside dom-xss-location-hash (a bare page
      // carries no bundles — 9 Nov 2026, 98th phase), and coupon-abuse
      // RUNS as an honest no-op alongside them (no coupon routes on a
      // bare page — 9 Nov 2026, 99th phase).
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 99,
        ok: 58,
        failed: 0,
        skipped: 41,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 58 ran ok, 41 skipped, 0 failed, 0 timed out.'
      );
    } finally {
      teardown();
    }
  });

  it('GS-5: Juice shape — DOM fires, openapi + js-api-routes FIRE on landing-page-only params (error-disclosure coverage fix), rollup 128/128/0', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(GS_SHELL);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: GS_ROOT_DOM };
        if (url === `${norm(target)}/#/login`) return { ok: true, html: GS_LOGIN_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1' },
        { timeoutMs: 5000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const dom = byName(result.phases)['dom-render'];
      assert.ok(dom && dom.ok && !dom.skipped, 'dom-render must run on the SPA shell, not skip');
      // ERROR-DISCLOSURE COVERAGE FIX (7 Nov 2026): the DOM-discovered
      // params live on the landing page itself (/?email=..., /?password=...)
      // — under the old gate that satisfied "param targets already exist"
      // and skipped both discovery phases, hiding /rest/* from the whole
      // scan. Under hasOffPageParamTarget they do NOT satisfy the gate:
      // both phases must FIRE (honest no-ops on this stub — no spec, no
      // routes in the stub bundle) instead of skipping.
      for (const name of ['openapi-targets', 'js-api-routes']) {
        const ph = byName(result.phases)[name];
        assert.ok(ph, `${name} must leave a record when it fires`);
        assert.equal(ph.ok, true, `${name} must be ok`);
        assert.equal(ph.skipped, undefined, `${name} must not skip on landing-page-only params`);
        assert.equal(ph.findingsCount, 0, `${name} finds nothing on this stub`);
      }
      // The exact shape the Juice proof brief expected, updated for the
      // coverage fix + validation + fingerprint-banner +
      // source-code-disclosure + metadata-leakage +
      // sensitive-data-in-logs + sensitive-info-disclosure +
      // timing-side-channel + xml-injection: the battery ran twice
      // (two DOM targets, 58 records), 57 non-param phases ran ok (36 +
      // verb-tampering + method-override + secrets-in-js +
      // browser-storage + dom-xss-sinks + dom-xss-location-hash +
      // error-disclosure + validation +
      // fingerprint-banner + source-code-disclosure + metadata-leakage +
      // sensitive-data-in-logs + sensitive-info-disclosure +
      // timing-side-channel + untrusted-js-inclusion +
      // api-versioning + session-token-in-url +
      // credential-disclosure + sqli-oob + sensitive-cache + captcha +
      // css-injection,
      // 7 Nov 2026 —
      // all twenty run here because param targets exist and the shell
      // carries a script bundle), and the two discovery phases now RUN
      // instead of skipping — 125 total, 125 ok, 0 skipped
      // (basket-logic, the 88th phase, runs as an honest no-op here:
      // the Juice-shape stub carries no basket routes, and
      // workflow-skip, the 89th phase, runs as an honest no-op
      // alongside it for the same reason, and twofa-bruteforce, the
      // 90th phase, runs as an honest no-op alongside them — the
      // stub carries no 2FA verify route — and dom-xss-location-hash,
      // the 91st phase, runs as an honest no-op alongside them: the
      // stub carries no labCreds, so the lab gate fails before the
      // mine runs — and credential-stuffing, the 92nd phase, runs as
      // an honest no-op alongside them for the same reason: the stub
      // carries no labCreds, so the lab gate fails before the mine
      // runs, exactly as for twofa-bruteforce — and dom-postmessage,
      // the 93rd phase, runs as an honest no-op alongside them for
      // the same reason: the stub carries no labCreds, so the lab
      // gate fails before the mine runs — and csti, the 94th phase,
      // runs as an honest no-op alongside them for the same reason:
      // the stub carries no labCreds, so the lab gate fails before
      // the mine runs — and captcha, the 95th phase,
      // runs as an honest no-op alongside them for the same reason:
      // the stub carries no labCreds, so the lab gate fails before
      // the mine runs — and css-injection, the 96th phase, runs as
      // an honest no-op alongside them for the same reason: the stub
      // carries no labCreds, so the lab gate fails before the mine
      // runs — and bfla, the 97th phase, runs as an honest no-op
      // alongside them for the same reason: the stub carries no
      // labCreds, so the lab gate fails before the mine runs — and
      // mutation-xss, the 98th phase, runs as an honest no-op
      // alongside them for the same reason: the stub carries no
      // labCreds, so the lab gate fails before the mine runs — and
      // coupon-abuse, the 99th phase, runs as an honest no-op
      // alongside them for the same reason: the stub carries no
      // labCreds, so the lab gate fails before the mine runs).
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 128,
        ok: 128,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 128 ran ok, 0 skipped, 0 failed, 0 timed out.'
      );
      // The battery really ran on the DOM-discovered params.
      assert.ok(
        calls.some((c) => /[?&]email=dmprobe_/.test(c.url)),
        'expected a GET probe with the email param'
      );
      assert.ok(
        calls.some((c) => /[?&]password=dmprobe_/.test(c.url)),
        'expected a GET probe with the password param'
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

describe('hasOffPageParamTarget — discovery gate (error-disclosure coverage fix, 7 Nov 2026)', () => {
  it('HG-1: a landing-page-only param target does NOT satisfy the gate', () => {
    assert.equal(
      hasOffPageParamTarget(['http://172.17.0.1:3000/?email=dmprobe_55a3'], 'http://172.17.0.1:3000/'),
      false,
      'the live Juice hunt had exactly this target and discovery still skipped'
    );
    assert.equal(
      hasOffPageParamTarget(
        ['http://172.17.0.1:3000/', 'http://172.17.0.1:3000/?email=dmprobe_55a3'],
        'http://172.17.0.1:3000/'
      ),
      false
    );
  });

  it('HG-2: an off-page param target satisfies the gate', () => {
    assert.equal(
      hasOffPageParamTarget(
        ['http://172.17.0.1:3100/', 'http://172.17.0.1:3100/login.php?username=dmprobe_1&password=dmprobe_2&Login=1'],
        'http://172.17.0.1:3100/'
      ),
      true,
      'DVWA login.php keeps skipping discovery exactly as before'
    );
    assert.equal(
      hasOffPageParamTarget(['http://example.com/search?q=x'], 'http://example.com/'),
      true
    );
  });

  it('HG-3: no param-bearing target does not satisfy the gate', () => {
    assert.equal(hasOffPageParamTarget(['http://example.com/', 'http://example.com/about'], 'http://example.com/'), false);
    assert.equal(hasOffPageParamTarget([], 'http://example.com/'), false);
  });

  it('HG-4: a param on the pasted page itself (non-root paste) does not satisfy the gate', () => {
    assert.equal(
      hasOffPageParamTarget(['http://example.com/app/?q=dmprobe_1'], 'http://example.com/app/'),
      false,
      'trailing-slash difference is the same page'
    );
    assert.equal(
      hasOffPageParamTarget(['http://example.com/app/?q=dmprobe_1'], 'http://example.com/app'),
      false,
      'pasted URL without trailing slash is the same page'
    );
    assert.equal(
      hasOffPageParamTarget(['http://example.com/app/other?q=dmprobe_1'], 'http://example.com/app/'),
      true
    );
  });

  it('HG-5: off-origin and malformed targets never satisfy the gate', () => {
    assert.equal(
      hasOffPageParamTarget(['http://other.example.com/?q=x'], 'http://example.com/'),
      false
    );
    assert.equal(hasOffPageParamTarget(['not a url?x=1'], 'http://example.com/'), false);
    assert.equal(hasOffPageParamTarget(['http://example.com/?q=x'], 'not a url'), false);
    assert.equal(hasOffPageParamTarget(null, 'http://example.com/'), false);
  });
});

describe('GS-7: Juice shape + mined API route — error-disclosure fires in-scan (error-disclosure coverage fix)', () => {
  // Juice-like bundle: the search service calls /rest/products/search
  // with a q param, plus a param-less list endpoint.
  const GS7_BUNDLE = `// app bundle (stub)
var searchService = {
  search: function(e) { return http.get("/rest/products/search?q=" + e); },
  list: function() { return http.get("/api/Products"); }
};`;
  // DOM root with one named standalone input — the live hunt's shape:
  // the only param target is synthesised on the landing page itself.
  const GS7_ROOT_DOM = `<html><body><app-root>
<input id="email" name="email" type="text">
</app-root></body></html>`;

  it('GS-7: js-api-routes mines /rest/products/search and error-disclosure fires the SQLITE_ERROR in-scan', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(GS_SHELL);
          return;
        }
        if (u.pathname === '/main.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(GS7_BUNDLE);
          return;
        }
        if (
          u.pathname === '/openapi.json' ||
          u.pathname === '/swagger.json' ||
          u.pathname === '/openapi.yaml' ||
          u.pathname === '/swagger.yaml'
        ) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
          return;
        }
        if (u.pathname === '/rest/products/search') {
          const q = u.searchParams.get('q') || '';
          // Malformed / injection-shaped q (a quote, or overlong) trips
          // the backend the way the real Juice search does; a clean
          // filler q answers 200 — the differential's baseline.
          if (q.includes("'") || q.length > 50) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Error</h1><pre>SQLITE_ERROR: near "'": syntax error</pre></body></html>`);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', data: [] }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: GS7_ROOT_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1' },
        { timeoutMs: 15000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      // The gate fix: openapi finds no spec (honest no-op) and js-routes
      // mines the search route — neither phase skips on the
      // landing-page-only /?email= target.
      const oa = byName(result.phases)['openapi-targets'];
      assert.ok(oa && oa.ok && !oa.skipped, 'openapi-targets must run, not skip');
      assert.equal(oa.findingsCount, 0, 'no spec on this stub');
      const js = byName(result.phases)['js-api-routes'];
      assert.ok(js && js.ok && !js.skipped, 'js-api-routes must run, not skip');
      assert.ok((js.jsRouteTargets || 0) >= 1, 'js-api-routes must mine at least the search route');
      // The mined route reaches the battery AND error-disclosure: the
      // malformed-q trigger 500s with SQLITE_ERROR against a clean 200
      // baseline, so the phase fires in-scan — the exact miss the live
      // Juice hunt exposed (0 findings, 0 rest/products mentions).
      const ed = byName(result.phases)['error-disclosure'];
      assert.ok(ed && ed.ok && !ed.skipped, 'error-disclosure must run');
      assert.ok((ed.findingsCount || 0) >= 1, 'error-disclosure must fire on the mined search route');
      const leak = (result.findings || []).find(
        (f) => f.class === 'error_info_disclosure' && String(f.url || '').includes('/rest/products/search')
      );
      assert.ok(leak, 'expected an error_info_disclosure finding on /rest/products/search');
      assert.ok(
        String((leak.evidence && leak.evidence.response) || '').includes('SQLITE_ERROR'),
        'evidence must cite the SQLITE_ERROR'
      );
      assert.equal(leak.severity, 'medium');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

  it('GS-6: a phases allowlist without a discovery phase emits no record for it', async () => {
    stubPage(LOGIN_PAGE);
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: [...PARAM_BATTERY_PHASES],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(result.phases.length, 29);
      for (const name of ['dom-render', 'openapi-targets', 'js-api-routes']) {
        assert.equal(
          result.phases.some((p) => p.name === name),
          false,
          `${name} must not leak into a restricted phases list`
        );
      }
      assert.equal(DEFAULT_PHASES.length, 99);
    } finally {
      teardown();
    }
  });
});
