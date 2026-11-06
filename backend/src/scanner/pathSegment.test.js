// Dark Matter scanner — path-segment probe-point tests (6 Nov 2026).
//
// The VAmPI OpenAPI lane mirrored each path param as a query param so
// the battery ran, but the segment itself was never probed. This file
// proves the probe-point refactor: the same 28-phase battery now
// mutates path segments with the same payloads and the same
// differential discipline as query values, and query-param behaviour
// is unchanged.
//
// No network, no docker — a local stub HTTP server plays VAmPI (and a
// login-form target for the query control). runScan integration tests
// pass a restricted phases list (no 'nuclei', no 'dom-render') so no
// container ever spawns.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { extractOpenApiTargets } from './openapi.js';
import {
  extractProbePoints,
  mutateUrl,
  setPathSegmentRaw,
  probePointName,
  probePointParameter,
} from './probePoints.js';
import { runScan, PARAM_BATTERY_PHASES, buildPhaseRollup } from './index.js';
import { probeHpp } from './probes/hpp.js';
import { probeNoSqli } from './probes/nosqli.js';
import { probeCsvLog } from './probes/csvLogInjection.js';

// Trimmed VAmPI spec: the only parameterised GETs are the two path-param
// operations; DELETE /users/v1/{username} must never become a target.
const PS_SPEC = {
  openapi: '3.0.1',
  info: { title: 'VAmPI', version: '1.0' },
  paths: {
    '/': { get: { responses: {} } },
    '/books/v1': { get: { responses: {} } },
    '/books/v1/{book_title}': {
      get: {
        parameters: [{ name: 'book_title', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
    '/users/v1': { get: { responses: {} } },
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
  },
};

const VAMPI_ROOT = JSON.stringify({
  message: 'VAmPI the Vulnerable API',
  help: 'VAmPI is a vulnerable on purpose API.',
  vulnerable: 1,
});

// The stub answers the book endpoint with a MySQL error ONLY when the
// decoded PATH segment carries a quote — the mirrored query param is
// ignored, so a finding can only come from a segment mutation.
// mode 'always': the error fires on every book request, benign included
// (the differential control must then reject — PS-4).
function startSegmentStub({ mode = 'segment' } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url });
      const u = new URL(req.url, 'http://127.0.0.1');
      const segs = u.pathname.split('/');
      const json = (obj) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (u.pathname === '/openapi.json') return json(PS_SPEC);
      if (u.pathname === '/swagger.json') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ detail: 'Not Found' }));
      }
      if (u.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(VAMPI_ROOT);
      }
      if (segs[1] === 'books' && segs[2] === 'v1' && segs.length >= 4) {
        let title = '';
        try {
          title = decodeURIComponent(segs[3]);
        } catch {
          title = '';
        }
        const err = mode === 'always' ? true : title.includes("'");
        if (err) {
          return json({ error: "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1" });
        }
        return json({ books: [] });
      }
      if (segs[1] === 'users' && segs[2] === 'v1' && segs.length >= 4) {
        return json({ users: [] });
      }
      return json({ ok: true });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
  });
}
const stopStub = (s) => new Promise((r) => s.server.close(r));

const BATTERY_PHASES = ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', ...PARAM_BATTERY_PHASES, 'headers'];

describe('probePoints unit (PS-1)', () => {
  test('extractProbePoints lists path points BEFORE query points', () => {
    const points = extractProbePoints(
      'http://example.com/books/v1/dmprobe1_ab12?book_title=dmprobe1_ab12',
      [{ name: 'book_title', segment: 3 }]
    );
    assert.deepEqual(points, [
      { kind: 'path', name: 'book_title', segment: 3 },
      { kind: 'query', name: 'book_title' },
    ]);
  });

  test('extractProbePoints with no path params returns query points only', () => {
    assert.deepEqual(extractProbePoints('http://example.com/s?a=1&b=2'), [
      { kind: 'query', name: 'a' },
      { kind: 'query', name: 'b' },
    ]);
    assert.deepEqual(extractProbePoints('http://example.com/s?a=1', null), [
      { kind: 'query', name: 'a' },
    ]);
  });

  test('extractProbePoints skips an out-of-range segment descriptor, never throws', () => {
    assert.deepEqual(
      extractProbePoints('http://example.com/s?a=1', [{ name: 'x', segment: 9 }]),
      [{ kind: 'query', name: 'a' }]
    );
  });

  test('mutateUrl on a query point is byte-identical to searchParams.set', () => {
    assert.equal(
      mutateUrl('http://example.com/s?a=1&b=2', 'a', '9'),
      'http://example.com/s?a=9&b=2'
    );
    assert.equal(
      mutateUrl('http://example.com/s?a=1', { kind: 'query', name: 'a' }, "1'"),
      'http://example.com/s?a=1%27'
    );
  });

  test('mutateUrl on a path point encodes the value into its segment, query untouched', () => {
    // A literal ' stays literal in a path segment (the URL parser
    // does not encode it there, unlike in the query string).
    assert.equal(
      mutateUrl('http://example.com/books/v1/filler?book_title=filler', { kind: 'path', name: 'book_title', segment: 3 }, "1'"),
      "http://example.com/books/v1/1'?book_title=filler"
    );
    // A '/' inside a payload becomes %2F (symmetric with query encoding).
    assert.equal(
      mutateUrl('http://example.com/books/v1/filler', { kind: 'path', name: 'book_title', segment: 3 }, '../../etc/passwd'),
      'http://example.com/books/v1/..%2F..%2Fetc%2Fpasswd'
    );
  });

  test('mutateUrl throws on an out-of-range segment', () => {
    assert.throws(
      () => mutateUrl('http://example.com/a', { kind: 'path', name: 'x', segment: 5 }, 'v'),
      /segment out of range/
    );
  });

  test('probePointParameter labels path points with " (path)", query points bare', () => {
    assert.equal(probePointParameter({ kind: 'path', name: 'book_title', segment: 3 }), 'book_title (path)');
    assert.equal(probePointParameter({ kind: 'query', name: 'book_title' }), 'book_title');
    assert.equal(probePointParameter('book_title'), 'book_title');
    assert.equal(probePointName({ kind: 'path', name: 'book_title', segment: 3 }), 'book_title');
  });

  test('setPathSegmentRaw keeps pre-encoded bytes verbatim (crlf T4)', () => {
    // %0d%0a survives verbatim (a literal space is the only thing the
    // URL parser encodes here); mutateUrl would double-encode the %.
    assert.equal(
      setPathSegmentRaw('http://example.com/a/b?p=v', 2, 'v%0d%0aX-DM: yes'),
      'http://example.com/a/v%0d%0aX-DM:%20yes?p=v'
    );
  });
});

describe('openapi pathParams metadata (PS-2)', () => {
  test('extractOpenApiTargets maps each target to its path-param descriptors', () => {
    const { targets, pathParams } = extractOpenApiTargets(PS_SPEC, 'http://example.com/');
    assert.equal(targets.length, 2);
    const book = targets.find((t) => t.includes('/books/v1/'));
    const user = targets.find((t) => t.includes('/users/v1/'));
    assert.ok(book && user);
    // /books/v1/{book_title} splits to ['', 'books', 'v1', '{book_title}'].
    assert.deepEqual(pathParams[book], [{ name: 'book_title', segment: 3 }]);
    assert.deepEqual(pathParams[user], [{ name: 'username', segment: 3 }]);
    // Both targets still carry the mirrored query param.
    assert.ok(book.includes('?book_title=dmprobe'));
    assert.ok(user.includes('?username=dmprobe'));
  });

  test('undeclared {template} segments get fillers but are NOT probe points', () => {
    const spec = {
      openapi: '3.0.0',
      paths: {
        '/res/{undeclared}': { get: { parameters: [{ name: 'q', in: 'query' }] } },
      },
    };
    const { targets, pathParams } = extractOpenApiTargets(spec, 'http://example.com/');
    assert.equal(targets.length, 1);
    assert.ok(!targets[0].includes('{') && !targets[0].includes('}'));
    assert.equal(pathParams[targets[0]], undefined);
  });
});

describe('runScan path-segment integration (PS-3/PS-4)', () => {
  test('PS-3: segment-only SQL error is a CONFIRMED sqli_error on the segment, not the mirror', async () => {
    const stub = await startSegmentStub({ mode: 'segment' });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        { target, confirmedAuthorized: true, phases: BATTERY_PHASES },
        { timeoutMs: 5000, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const openApiPhase = result.phases.find((p) => p.name === 'openapi-targets');
      assert.ok(openApiPhase && openApiPhase.ok, 'openapi-targets phase must record ok');
      assert.equal(openApiPhase.openApiTargets, 2);
      assert.equal(result.phases.filter((p) => p.skipped).length, 0);
      assert.deepEqual(buildPhaseRollup(result.phases).skipped, 0);
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'sqli-error must run, not skip');
      assert.ok(sqli.findingsCount >= 1, 'sqli-error phase must record the finding');
      // The battery actually mutated the segment: a request with the
      // quote in the segment (and the filler still in the query) exists.
      // (A literal ' stays literal in a path segment — the URL parser
      // only encodes it in the query string — so the segment reads 1',
      // not 1%27.)
      assert.ok(
        stub.calls.some((c) => /\/books\/v1\/1'\?book_title=dmprobe/.test(c.url)),
        `expected a segment-mutated probe, got: ${stub.calls.map((c) => c.url).slice(0, 8).join(' | ')}`
      );
      // The CONFIRMED finding is attributed to the segment, with the
      // segment-mutated URL as evidence — the query mirror produced
      // nothing (the stub ignores the query).
      const confirmed = result.findings.filter((f) => f.class === 'sqli_error');
      assert.equal(confirmed.length, 1, `expected exactly one confirmed sqli_error, got ${JSON.stringify(confirmed.map((f) => f.param))}`);
      assert.equal(confirmed[0].param, 'book_title (path)');
      assert.match(confirmed[0].evidence.request, /\/books\/v1\/1'\?book_title=dmprobe/);
      assert.equal(confirmed[0].evidence.errorCorrelated, true);
      assert.ok(!result.findings.some((f) => f.param === 'book_title'), 'no bare query-twin finding');
      // The spec itself is fetched read-only: every /openapi.json call is a GET.
      assert.ok(
        stub.calls.filter((c) => c.url === '/openapi.json').every((c) => c.method === 'GET'),
        'spec fetch must be GET-only'
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('PS-4: error on the benign value too is REJECTED — same rule as query mutations', async () => {
    const stub = await startSegmentStub({ mode: 'always' });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        { target, confirmedAuthorized: true, phases: BATTERY_PHASES },
        { timeoutMs: 5000, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'sqli-error must run, not skip');
      assert.equal(sqli.findingsCount, 0, 'uncorrelated error must not be recorded');
      assert.equal(result.findings.filter((f) => f.class === 'sqli_error').length, 0);
    } finally {
      await stopStub(stub);
    }
  });
});

describe('query-param behaviour unchanged (PS-5)', () => {
  test('a login-form target still yields a bare-name query finding', async () => {
    const LOGIN_PAGE = `<html><head><title>Login</title></head><body>
<form action="/login.php" method="post">
<input name="username"><input name="password">
<input name="Login" type="submit" value="Login">
</form></body></html>`;
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname === '/login.php' && (u.searchParams.get('username') || '').includes("'")) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end("You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1");
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(LOGIN_PAGE);
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
          phases: ['fingerprint', 'crawl', 'page-analyze', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'sqli-error must run on the form target');
      const confirmed = result.findings.filter((f) => f.class === 'sqli_error');
      assert.equal(confirmed.length, 1);
      // Bare name, no ' (path)' suffix — the query path is byte-identical.
      assert.equal(confirmed[0].param, 'username');
      assert.match(confirmed[0].evidence.request, /login\.php\?username=1%27/);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});

describe('query-only probes never mutate segments (PS-6)', () => {
  // A recording stub: fixed JSON everywhere, no reflection, no errors.
  function startRecordingStub() {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url });
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end('<html><body><a href="/export.csv">export</a></body></html>');
        }
        if (req.url.startsWith('/export.csv')) {
          res.writeHead(200, { 'Content-Type': 'text/csv' });
          return res.end('a,b\n1,2\n');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      });
    });
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
    });
  }

  const mixedPoints = () => [
    { kind: 'path', name: 'book_title', segment: 3 },
    { kind: 'query', name: 'book_title' },
  ];

  test('hpp duplicates query params only — the segment filler never moves', async () => {
    const stub = await startRecordingStub();
    try {
      const base = `http://127.0.0.1:${stub.port}/books/v1/dmprobe1_ab12?book_title=dmprobe1_ab12`;
      const findings = await probeHpp(base, mixedPoints(), { timeoutMs: 5000 });
      assert.deepEqual(findings, []);
      assert.ok(stub.calls.length > 0, 'hpp must actually issue requests');
      for (const c of stub.calls) {
        const u = new URL(c.url, 'http://127.0.0.1');
        assert.equal(u.pathname, '/books/v1/dmprobe1_ab12', `segment mutated in ${c.url}`);
      }
      assert.ok(
        stub.calls.some((c) => c.url.includes('book_title=__hpp_dm_')),
        'hpp must probe the query point'
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('nosqli operator variants live in the query string only', async () => {
    const stub = await startRecordingStub();
    try {
      const base = `http://127.0.0.1:${stub.port}/books/v1/dmprobe1_ab12?book_title=dmprobe1_ab12`;
      const findings = await probeNoSqli(base, mixedPoints(), { timeoutMs: 5000 });
      assert.deepEqual(findings, []);
      assert.ok(stub.calls.length > 0, 'nosqli must actually issue requests');
      for (const c of stub.calls) {
        const u = new URL(c.url, 'http://127.0.0.1');
        assert.equal(u.pathname, '/books/v1/dmprobe1_ab12', `segment mutated in ${c.url}`);
      }
      assert.ok(
        stub.calls.some((c) => decodeURIComponent(c.url).includes('book_title[$ne]=')),
        'nosqli must probe the $ne operator variant as a query param'
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('csvLogInjection with mixed points never throws and never mutates a segment', async () => {
    const stub = await startRecordingStub();
    try {
      const base = `http://127.0.0.1:${stub.port}/books/v1/dmprobe1_ab12?book_title=dmprobe1_ab12`;
      const findings = await probeCsvLog(base, mixedPoints(), { timeoutMs: 5000 });
      assert.ok(Array.isArray(findings));
      // The only /books/v1/* paths ever requested are the untouched
      // target, and logHalf's two LEGITIMATE segment mutations (the LF
      // canary and the script canary — logHalf runs against both point
      // kinds by design). Nothing else may move the segment.
      const allowed = [
        /^\/$/,
        /^\/export\.csv$/,
        /^\/books\/v1\/dmprobe1_ab12$/,
        /^\/books\/v1\/aaa%0A__dm_log_[0-9a-z]+_bbb$/,
        /^\/books\/v1\/%0A%3Cscript%3E__dm_log_[0-9a-z]+x%3C%2Fscript%3E$/,
      ];
      for (const c of stub.calls) {
        const u = new URL(c.url, 'http://127.0.0.1');
        assert.ok(
          allowed.some((re) => re.test(u.pathname)),
          `unexpected mutated path in ${c.url}`
        );
      }
    } finally {
      await stopStub(stub);
    }
  });
});
