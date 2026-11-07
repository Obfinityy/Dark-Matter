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
import { runScan, PARAM_BATTERY_PHASES, DEFAULT_PHASES, buildPhaseRollup, buildPhaseSummaryLine } from './index.js';

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

  it('GS-4: all three discovery phases FIRE on a bare page — no skip records, 38/28 rollup', async () => {
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
      // Bare page: all three fire (honest no-ops), battery skips 28,
      // verb-tampering + method-override skip with 'no probe targets'
      // (7 Nov 2026).
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 68,
        ok: 38,
        failed: 0,
        skipped: 30,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 38 ran ok, 30 skipped, 0 failed, 0 timed out.'
      );
    } finally {
      teardown();
    }
  });

  it('GS-5: Juice shape — DOM fires, openapi + js-api-routes skip, rollup reads 94 ran ok + 2 skipped = 96', async () => {
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
      for (const name of ['openapi-targets', 'js-api-routes']) {
        const ph = byName(result.phases)[name];
        assert.ok(ph, `${name} must leave a skip record`);
        assert.equal(ph.skipped, true, `${name} must be skipped`);
        assert.equal(ph.skipReason, 'param targets already exist', `${name} reason`);
        assert.equal(ph.ok, true);
      }
      // The exact shape the Juice proof brief expected: the battery
      // ran twice (two DOM targets, 56 records), 38 non-param phases
      // ran ok (36 + verb-tampering + method-override, 7 Nov 2026 —
      // both run here because param targets exist), and the two
      // gated-off discovery phases are visible as skipped instead of
      // vanishing — 96 total, not 95.
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 96,
        ok: 94,
        failed: 0,
        skipped: 2,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 94 ran ok, 2 skipped (param targets already exist), 0 failed, 0 timed out.'
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
      assert.equal(result.phases.length, 28);
      for (const name of ['dom-render', 'openapi-targets', 'js-api-routes']) {
        assert.equal(
          result.phases.some((p) => p.name === name),
          false,
          `${name} must not leak into a restricted phases list`
        );
      }
      assert.equal(DEFAULT_PHASES.length, 68);
    } finally {
      teardown();
    }
  });
});
