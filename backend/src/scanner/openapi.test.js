// OpenAPI inventory for pure-API targets (6 Nov 2026, VAmPI lane).
//
// DIAGNOSIS (param-battery skip diagnosis, parent-verified): VAmPI is
// a pure API — its root returns JSON only, so static analysis AND the
// DOM render both find zero param-bearing targets and the 28-phase
// battery skips in silence. Its param surface lives in its OpenAPI
// spec (/openapi.json — the nuclei #253 template already proves this
// location live on VAmPI).
//
// The VAmPI_SPEC fixture below is modeled on the REAL spec fetched
// live from the lab 6 Nov 2026 (OpenAPI 3.0.1, 12 paths): GET
// /books/v1/{book_title} and GET /users/v1/{username} are the only
// operations carrying parameters (path params only — VAmPI has zero
// query params); POST /users/v1/login + /register, PUT .../email +
// .../password and DELETE /users/v1/{username} must never become
// targets; param-less GETs (/ , /books/v1, /createdb, /me, /users/v1,
// /users/v1/_debug) add no probe surface.
//
// No network, no docker in these tests — the spec fetch is stubbed
// (opts.fetchPage / opts.openApiFetcher) or served by a local stub
// HTTP server; runScan integration tests pass a restricted phases
// list (no 'nuclei', no 'dom-render') so no container ever spawns.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  discoverOpenApiTargets,
  extractOpenApiTargets,
  resolveOpenApiParam,
  OPENAPI_SPEC_PATHS,
  OPENAPI_MAX_TARGETS,
} from './openapi.js';
import { runScan, PARAM_BATTERY_PHASES, buildPhaseRollup } from './index.js';

// VAmPI's real spec shape (live fetch 6 Nov 2026, trimmed to the
// paths + parameters that decide targeting; schemas elided).
const VAMPI_SPEC = {
  openapi: '3.0.1',
  info: { title: 'VAmPI', version: '1.0' },
  servers: [{ url: '' }],
  paths: {
    '/': { get: { responses: {} } },
    '/books/v1': { get: { responses: {} }, post: { responses: {} } },
    '/books/v1/{book_title}': {
      get: {
        parameters: [{ name: 'book_title', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
    '/createdb': { get: { responses: {} } },
    '/me': { get: { responses: {} } },
    '/users/v1': { get: { responses: {} } },
    '/users/v1/_debug': { get: { responses: {} } },
    '/users/v1/login': { post: { responses: {} } },
    '/users/v1/register': { post: { responses: {} } },
    '/users/v1/{username}': {
      get: {
        parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
      delete: {
        parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
    '/users/v1/{username}/email': {
      put: {
        parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
    '/users/v1/{username}/password': {
      put: {
        parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
  },
};

const VAMPI_ROOT = JSON.stringify({
  message: 'VAmPI the Vulnerable API',
  help: 'VAmPI is a vulnerable on purpose API.',
  vulnerable: 1,
});

function startApiStub({ spec = VAMPI_SPEC, specStatus = 200 } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, body: raw });
      if (req.url === '/openapi.json') {
        if (specStatus === 200) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(spec));
        } else {
          res.writeHead(specStatus, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'Not Found' }));
        }
        return;
      }
      if (req.url === '/swagger.json') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Not Found' }));
        return;
      }
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(VAMPI_ROOT);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
  });
}
const stopStub = (s) => new Promise((r) => s.server.close(r));

describe('extractOpenApiTargets (pure spec → GET targets)', () => {
  test('OA-1: VAmPI spec yields exactly the two path-param GETs, mirrored + distinct fillers', () => {
    const { targets, operations, params } = extractOpenApiTargets(VAMPI_SPEC, 'http://172.17.0.1:3400/');
    assert.equal(targets.length, 2);
    assert.equal(operations, 2);
    assert.equal(params, 2);
    const book = targets.find((t) => t.includes('/books/v1/'));
    const user = targets.find((t) => t.includes('/users/v1/'));
    assert.ok(book, `expected a book target, got: ${targets.join(' | ')}`);
    assert.ok(user, `expected a user target, got: ${targets.join(' | ')}`);
    // Path filler == mirrored query filler on the same URL (self-consistent).
    for (const t of [book, user]) {
      const u = new URL(t);
      const paramName = t.includes('/books/') ? 'book_title' : 'username';
      const seg = u.pathname.split('/').pop();
      assert.equal(u.searchParams.get(paramName), seg, 'mirrored query value must equal the path filler');
      assert.match(seg, /^dmprobe\d+_[0-9a-f]+$/, 'filler must be unique + non-empty');
    }
    // The two fillers differ (never equal — the read-only safety rule).
    assert.notEqual(new URL(book).pathname, new URL(user).pathname);
    // No POST/PUT/DELETE operation and no param-less GET ever becomes a target.
    for (const t of targets) {
      assert.ok(!t.includes('/login') && !t.includes('/register'), 'POST ops must never become targets');
      assert.ok(!t.includes('/email') && !t.includes('/password'), 'PUT ops must never become targets');
      assert.ok(!t.includes('/createdb') && !t.includes('/_debug') && !t.endsWith('/me'), 'param-less GETs add nothing');
    }
  });

  test('OA-2: query params, path-level params, $ref params; header/cookie params ignored', () => {
    const spec = {
      openapi: '3.0.0',
      components: {
        parameters: {
          LimitParam: { name: 'limit', in: 'query', schema: { type: 'integer' } },
        },
      },
      paths: {
        '/items': {
          parameters: [{ name: 'trace', in: 'header', schema: { type: 'string' } }],
          get: {
            parameters: [
              { $ref: '#/components/parameters/LimitParam' },
              { name: 'q', in: 'query', schema: { type: 'string' } },
              { name: 'session', in: 'cookie', schema: { type: 'string' } },
            ],
          },
        },
        '/items/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          },
        },
      },
    };
    const { targets, operations, params } = extractOpenApiTargets(spec, 'http://example.com/api/');
    assert.equal(targets.length, 2);
    assert.equal(operations, 2);
    assert.equal(params, 3, 'limit + q + id; header + cookie params are not probeable');
    const search = targets.find((t) => t.includes('/items?'));
    assert.ok(search && search.includes('limit=dmprobe') && search.includes('q=dmprobe'), `query params must be fillers: ${search}`);
    assert.ok(!search.includes('trace=') && !search.includes('session='), 'header/cookie params must not appear');
    const item = targets.find((t) => /\/items\/dmprobe/.test(t));
    assert.ok(item && item.includes('id=dmprobe'), `path param must be templated + mirrored: ${item}`);
  });

  test('OA-2b: $ref resolution — unresolvable refs are skipped, never guessed', () => {
    const spec = {
      openapi: '3.0.0',
      components: { parameters: {} },
      paths: {
        '/a': { get: { parameters: [{ $ref: '#/components/parameters/Missing' }] } },
        '/b': { get: { parameters: [{ $ref: 'https://evil.example/param.json' }] } },
      },
    };
    assert.deepEqual(extractOpenApiTargets(spec, 'http://example.com/'), {
      targets: [],
      operations: 0,
      params: 0,
    });
    assert.equal(resolveOpenApiParam({ $ref: '#/components/parameters/Missing' }, spec), null);
    assert.equal(
      resolveOpenApiParam({ $ref: '#/components/parameters/LimitParam' }, {
        components: { parameters: { LimitParam: { name: 'limit', in: 'query' } } },
      }).name,
      'limit'
    );
  });

  test('OA-3: undeclared {template} segments are replaced, never probed literally; targets cap at 20', () => {
    const paths = {};
    for (let i = 0; i < 25; i++) {
      paths[`/res${i}/{undeclared}`] = {
        get: { parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }] },
      };
    }
    const { targets } = extractOpenApiTargets({ openapi: '3.0.0', paths }, 'http://example.com/');
    assert.equal(targets.length, OPENAPI_MAX_TARGETS);
    for (const t of targets) {
      assert.ok(!t.includes('{') && !t.includes('}'), `no literal braces may survive: ${t}`);
      assert.match(t, /\/res\d+\/dmprobe\d+_[0-9a-f]+\?q=dmprobe/);
    }
  });

  test('OA-3b: non-spec input and bad base URL yield zero targets, never throw', () => {
    assert.deepEqual(extractOpenApiTargets(null, 'http://example.com/'), { targets: [], operations: 0, params: 0 });
    assert.deepEqual(extractOpenApiTargets({ openapi: '3.0.0' }, 'http://example.com/'), { targets: [], operations: 0, params: 0 });
    assert.deepEqual(extractOpenApiTargets(VAMPI_SPEC, 'not a url'), { targets: [], operations: 0, params: 0 });
    // An absolute path on another origin is never probed (same-origin rule).
    assert.deepEqual(
      extractOpenApiTargets(
        {
          openapi: '3.0.0',
          paths: { 'https://evil.example/x': { get: { parameters: [{ name: 'q', in: 'query' }] } } },
        },
        'http://example.com/'
      ),
      { targets: [], operations: 0, params: 0 }
    );
  });
});

describe('discoverOpenApiTargets (spec probing, stubbed fetchPage)', () => {
  test('OA-4: /openapi.json wins first; /swagger.json is the fallback', async () => {
    const fetchPage = async (url) => {
      if (String(url).endsWith('/openapi.json')) {
        return { url, status: 200, headers: {}, body: JSON.stringify(VAMPI_SPEC) };
      }
      return { url, status: 404, headers: {}, body: '' };
    };
    const r = await discoverOpenApiTargets('http://172.17.0.1:3400/', { fetchPage });
    assert.equal(r.specFound, true);
    assert.ok(r.specUrl.endsWith('/openapi.json'));
    assert.equal(r.targets.length, 2);

    const fallbackFetch = async (url) => {
      if (String(url).endsWith('/openapi.json')) return { url, status: 404, headers: {}, body: '' };
      return { url, status: 200, headers: {}, body: JSON.stringify(VAMPI_SPEC) };
    };
    const r2 = await discoverOpenApiTargets('http://example.com/', { fetchPage: fallbackFetch });
    assert.equal(r2.specFound, true);
    assert.ok(r2.specUrl.endsWith('/swagger.json'));
    assert.equal(r2.targets.length, 2);
  });

  test('OA-4b: absent spec, invalid JSON, and no-paths JSON all return specFound:false, never throw', async () => {
    const notFound = async (url) => ({ url, status: 404, headers: {}, body: '' });
    const r = await discoverOpenApiTargets('http://example.com/', { fetchPage: notFound });
    assert.equal(r.specFound, false);
    assert.deepEqual(r.targets, []);
    assert.ok(r.errors.length >= 2, 'each candidate failure must be recorded');

    const badJson = async (url) => ({ url, status: 200, headers: {}, body: '<html>not json</html>' });
    const r2 = await discoverOpenApiTargets('http://example.com/', { fetchPage: badJson });
    assert.equal(r2.specFound, false);
    assert.ok(r2.errors.some((e) => /not valid JSON/.test(e)));

    const noPaths = async (url) => ({ url, status: 200, headers: {}, body: JSON.stringify({ openapi: '3.0.0' }) });
    const r3 = await discoverOpenApiTargets('http://example.com/', { fetchPage: noPaths });
    assert.equal(r3.specFound, false);
    assert.ok(r3.errors.some((e) => /no OpenAPI paths/.test(e)));

    const throwing = async () => { throw new Error('network down'); };
    const r4 = await discoverOpenApiTargets('http://example.com/', { fetchPage: throwing });
    assert.equal(r4.specFound, false);
    assert.deepEqual(r4.targets, []);
  });

  test('OA-4c: spec locations are probed in order', () => {
    assert.deepEqual(OPENAPI_SPEC_PATHS, ['/openapi.json', '/swagger.json']);
  });
});

describe('runScan OpenAPI integration (VAmPI-shaped stub server)', () => {
  const BATTERY_PHASES = ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', ...PARAM_BATTERY_PHASES, 'headers'];

  test('OA-5: pure-API root unlocks the battery — 0 skipped, both spec targets probed, GET spec fetch only', async () => {
    const stub = await startApiStub();
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        { target, confirmedAuthorized: true, phases: BATTERY_PHASES },
        { timeoutMs: 5000, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const openApiPhase = result.phases.find((p) => p.name === 'openapi-targets');
      assert.ok(openApiPhase && openApiPhase.ok, 'openapi-targets phase must record ok');
      assert.equal(openApiPhase.openApiTargets, 2, 'VAmPI spec must yield exactly 2 targets');
      assert.equal(openApiPhase.findingsCount, 2);
      assert.ok(String(openApiPhase.openApiSpec || '').endsWith('/openapi.json'));
      // The battery RAN: zero skipped records (before this lane the
      // same paste read 36 ok / 28 skipped on the 64-phase battery).
      assert.equal(result.phases.filter((p) => p.skipped).length, 0);
      const rollup = buildPhaseRollup(result.phases);
      assert.equal(rollup.skipped, 0);
      assert.equal(rollup.failed, 0);
      for (const name of ['sqli-error', 'xss', 'cmdi', 'traversal', 'ssrf']) {
        const ph = result.phases.find((p) => p.name === name);
        assert.ok(ph && ph.ok && !ph.skipped, `${name} must run, not skip`);
      }
      // Both synthesised targets were actually probed with their
      // mirrored param fillers.
      assert.ok(
        stub.calls.some((c) => /\/books\/v1\/dmprobe\d+_[0-9a-f]+\?book_title=dmprobe/.test(c.url)),
        `expected a GET probe of the book target, got: ${stub.calls.map((c) => c.url).slice(0, 8).join(' | ')}`
      );
      assert.ok(
        stub.calls.some((c) => /\/users\/v1\/dmprobe\d+_[0-9a-f]+\?username=dmprobe/.test(c.url)),
        'expected a GET probe of the user target'
      );
      // The spec itself is fetched read-only: every /openapi.json call is a GET.
      assert.ok(
        stub.calls.filter((c) => c.url === '/openapi.json').every((c) => c.method === 'GET'),
        'spec fetch must be GET-only'
      );
      assert.ok(stub.calls.filter((c) => c.url === '/openapi.json').length >= 1, 'spec must actually be fetched');
    } finally {
      await stopStub(stub);
    }
  });

  test('OA-6: static-form target never pays the spec fetch — behaviour unchanged', async () => {
    const calls = [];
    const loginPage = `<html><body><form action="/login.php" method="post"><input name="username"><input name="password" type="password"></form></body></html>`;
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(VAMPI_SPEC));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(loginPage);
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const result = await runScan(
        {
          target: `http://127.0.0.1:${stub.port}/`,
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(
        result.phases.some((p) => p.name === 'openapi-targets'),
        false,
        'no openapi-targets record on static targets'
      );
      assert.equal(
        calls.some((c) => c.url === '/openapi.json'),
        false,
        'the spec must not even be fetched when static targets exist'
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'battery must run on the static form target');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  test('OA-7: absent spec records an honest no-op and the battery still skips with its reason', async () => {
    const stub = await startApiStub({ specStatus: 404 });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        {
          target,
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      const openApiPhase = result.phases.find((p) => p.name === 'openapi-targets');
      assert.ok(openApiPhase && openApiPhase.ok, 'absent spec is not a failure');
      assert.equal(openApiPhase.findingsCount, 0);
      assert.equal(openApiPhase.openApiTargets, 0);
      assert.equal(openApiPhase.openApiSpec, null);
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.equal(sqli.skipped, true);
      assert.equal(sqli.skipReason, 'no param targets');
    } finally {
      await stopStub(stub);
    }
  });
});
