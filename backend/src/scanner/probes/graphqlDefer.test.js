// GraphQL @defer / @stream incremental-delivery abuse probe tests
// (row #509 [Medium] GraphQL @defer / @stream incremental-delivery abuse,
// CWE-400; phase 'graphql-defer').
//
// The probe judges three differential legs against a local mock server:
// a gated-data leak (deferred chunks carry keys the plain query
// withholds), unbounded fan-out (chunk count and timing vs a flat
// baseline) and @include/@skip flooding (excluded branches still run).
// The mock plays six modes: 'leak' (deferred chunks add an adminSecret
// key), 'amplify' (one incremental chunk per deferred subtree, with a
// per-subtree delay), 'slow-only' (chunks coalesce but the delay grows
// with subtree count — timing witness only), 'secure' (coalesced chunks,
// no delay, directives honoured), 'no-defer' (@defer rejected) and
// 'directive' (@defer rejected, @skip/@include ignored). Tests run
// against real HTTP on 127.0.0.1 — no external services.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeGraphqlDefer,
  median,
  buildDeferQuery,
  buildPlainQuery,
  buildIncludeSkipQuery,
  buildDirectiveControlQuery,
  parseMultipart,
  parseDeferResponse,
  countDataChunks,
  collectDataKeys,
  assessDeferLeak,
  assessChunkAmplification,
  assessTimingAmplification,
  assessDirectiveOracle,
  __graphqlDeferMeta,
} from './graphqlDefer.js';
import { verifyFindings } from '../verifier.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

function deferHandler(mode) {
  return async (req, res) => {
    const sendJson = (obj, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const sendMultipart = (parts) => {
      const body = parts
        .map((p) => `--dmdefer\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(p)}\r\n`)
        .join('');
      res.writeHead(200, { 'Content-Type': 'multipart/mixed; boundary="dmdefer"' });
      res.end(`${body}--dmdefer--\r\n`);
    };
    if (!req.url.endsWith('/graphql')) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html>not found</html>');
      return;
    }
    let body = {};
    try {
      body = await readJson(req);
    } catch {
      body = {};
    }
    const q = body.query || '';
    if (q === '{__typename}') return sendJson({ data: { __typename: 'Query' } });
    const deferCount = (q.match(/@defer/g) || []).length;
    const aliasIndexes = [...q.matchAll(/a(\d+):/g)].map((m) => Number(m[1]));

    if (deferCount > 0) {
      if (mode === 'no-defer' || mode === 'directive') {
        return sendJson({ errors: [{ message: 'Unknown directive "@defer"' }] });
      }
      if (mode === 'amplify' || mode === 'slow-only') await sleep(40 * deferCount);
      if (mode === 'leak') {
        const incremental = { a0: 'Query', a1: 'Query', adminSecret: 'dm-secret' };
        return sendMultipart([{ data: { __typename: 'Query' } }, { data: incremental }]);
      }
      if (mode === 'slow-only' || mode === 'secure') {
        const data = { __typename: 'Query' };
        for (const i of aliasIndexes) data[`a${i}`] = 'Query';
        return sendMultipart([{ data: { __typename: 'Query' } }, { data }]);
      }
      // amplify: one incremental chunk per deferred subtree.
      const parts = [{ data: { __typename: 'Query' } }];
      for (const i of aliasIndexes) parts.push({ data: { [`a${i}`]: 'Query' } });
      return sendMultipart(parts);
    }

    if (q.includes('@skip') || q.includes('@include')) {
      if (mode === 'directive') return sendJson({ data: { __typename: 'Query', skipped: 'Query', excluded: 'Query' } });
      return sendJson({ data: { __typename: 'Query' } });
    }

    // Plain query (or directive control): echo the requested aliases.
    if (mode === 'slow-only') await sleep(5);
    const data = { __typename: 'Query' };
    for (const i of aliasIndexes) data[`a${i}`] = 'Query';
    if (q.includes('skipped:')) data.skipped = 'Query';
    if (q.includes('excluded:')) data.excluded = 'Query';
    return sendJson({ data });
  };
}

// ---- pure helpers ------------------------------------------------------------

test('GD-1: buildDeferQuery aliases one subtree per @defer, capped at 8', () => {
  const q = buildDeferQuery(2);
  assert.equal((q.match(/@defer/g) || []).length, 2);
  assert.ok(q.includes('a0: __typename') && q.includes('a1: __typename'));
  assert.equal((buildDeferQuery(99).match(/@defer/g) || []).length, 8);
  assert.ok(!buildPlainQuery(2).includes('@defer'));
  assert.ok(buildPlainQuery(2).includes('a0: __typename'));
});

test('GD-2: directive queries put the aliases under @skip/@include', () => {
  assert.ok(buildIncludeSkipQuery().includes('@skip(if: true)'));
  assert.ok(buildIncludeSkipQuery().includes('@include(if: false)'));
  assert.ok(buildIncludeSkipQuery().includes('skipped: __typename'));
  assert.ok(!buildDirectiveControlQuery().includes('@skip'));
  assert.ok(buildDirectiveControlQuery().includes('skipped: __typename'));
});

test('GD-3: median handles odd, even and empty input', () => {
  assert.equal(median([5, 6, 5]), 5);
  assert.equal(median([1, 4]), 2.5);
  assert.equal(median([]), 0);
});

test('GD-4: parseMultipart splits parts on the boundary', () => {
  const text =
    '--dmdefer\r\nContent-Type: application/json\r\n\r\n{"data":{"__typename":"Query"}}\r\n' +
    '--dmdefer\r\nContent-Type: application/json\r\n\r\n{"data":{"a0":"Query"}}\r\n--dmdefer--\r\n';
  const parts = parseMultipart(text, 'multipart/mixed; boundary="dmdefer"');
  assert.equal(parts.length, 2);
  assert.equal(parts[1].data.a0, 'Query');
  assert.deepEqual(parseMultipart('{"data":{}}', 'application/json'), []);
});

test('GD-5: parseDeferResponse handles multipart, incremental and single bodies', () => {
  const mp = parseDeferResponse({
    text: '--b\r\n\r\n{"data":{"x":1}}\r\n--b--\r\n',
    contentType: 'multipart/mixed; boundary=b',
    json: null,
  });
  assert.equal(mp.format, 'multipart');
  assert.equal(mp.chunks.length, 1);
  const inc = parseDeferResponse({
    text: '',
    contentType: 'application/json',
    json: { data: { __typename: 'Query' }, incremental: [{ data: { a0: 'Query' } }] },
  });
  assert.equal(inc.format, 'incremental');
  assert.equal(inc.chunks.length, 2);
  const single = parseDeferResponse({ text: '', contentType: 'application/json', json: { data: { a: 1 } } });
  assert.equal(single.format, 'single');
  assert.equal(single.chunks.length, 1);
});

test('GD-6: countDataChunks ignores error payloads', () => {
  assert.equal(countDataChunks([{ data: { a: 1 } }, { errors: [{ message: 'x' }] }, { data: null }]), 1);
});

test('GD-7: collectDataKeys gathers dotted paths under data', () => {
  const keys = collectDataKeys([{ data: { __typename: 'Query', user: { id: '1' } } }]);
  assert.ok(keys.has('__typename'));
  assert.ok(keys.has('user'));
  assert.ok(keys.has('user.id'));
});

test('GD-8: assessDeferLeak confirms extra keys, rejects identical sets', () => {
  const confirmed = assessDeferLeak({
    plainKeys: new Set(['__typename', 'a0']),
    deferredKeys: new Set(['__typename', 'a0', 'adminSecret']),
  });
  assert.equal(confirmed.verdict, 'confirmed');
  assert.deepEqual(confirmed.extra, ['adminSecret']);
  const rejected = assessDeferLeak({
    plainKeys: new Set(['__typename', 'a0']),
    deferredKeys: new Set(['__typename', 'a0']),
  });
  assert.equal(rejected.verdict, 'rejected');
});

test('GD-9: assessChunkAmplification needs 4 chunks and a 4x ratio', () => {
  assert.equal(assessChunkAmplification({ one: 2, many: 9 }).verdict, 'confirmed');
  assert.equal(assessChunkAmplification({ one: 2, many: 2 }).verdict, 'rejected');
  assert.equal(assessChunkAmplification({ one: 1, many: 3 }).verdict, 'rejected');
  assert.equal(assessChunkAmplification({}).verdict, 'unconfirmed');
});

test('GD-10: assessTimingAmplification needs stable baselines and 3x + 50 ms', () => {
  assert.equal(assessTimingAmplification({ baselines: [5, 6, 5], deferred: [320, 330] }).verdict, 'confirmed');
  assert.equal(assessTimingAmplification({ baselines: [5, 6, 5], deferred: [10, 12] }).verdict, 'rejected');
  assert.equal(assessTimingAmplification({ baselines: [2, 120, 3], deferred: [320, 330] }).verdict, 'unconfirmed');
  assert.equal(assessTimingAmplification({ baselines: [], deferred: [320] }).verdict, 'unconfirmed');
});

test('GD-11: assessDirectiveOracle needs control keys and a reproduced leak', () => {
  const keys = new Set(['__typename', 'skipped', 'excluded']);
  assert.equal(
    assessDirectiveOracle({ controlKeys: keys, legKeys: keys, legRepeatKeys: keys }).verdict,
    'confirmed',
  );
  assert.equal(
    assessDirectiveOracle({ controlKeys: keys, legKeys: new Set(['__typename']), legRepeatKeys: keys }).verdict,
    'rejected',
  );
  assert.equal(
    assessDirectiveOracle({ controlKeys: new Set(['__typename']), legKeys: keys, legRepeatKeys: keys }).verdict,
    'unconfirmed',
  );
  assert.equal(
    assessDirectiveOracle({ controlKeys: keys, legKeys: keys, legRepeatKeys: new Set(['__typename']) }).verdict,
    'unconfirmed',
  );
});

test('GD-12: probe meta names the phase and all depths', () => {
  assert.deepEqual(__graphqlDeferMeta.phases, ['graphql-defer']);
  assert.deepEqual(__graphqlDeferMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour (local mock servers) ------------------------------------

test('GD-13: deferred chunks leaking a gated key confirm the leak leg', async () => {
  const srv = await startServer(deferHandler('leak'));
  try {
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'graphql_defer_abuse');
    assert.equal(f.id, 'graphql-defer-leak');
    assert.equal(f.severity, 'medium');
    assert.match(f.evidence.response, /adminSecret/);
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((x) => x.class === 'graphql_defer_abuse').length, 1);
  } finally {
    await srv.close();
  }
});

test('GD-14: one chunk per deferred subtree confirms amplification', async () => {
  const srv = await startServer(deferHandler('amplify'));
  try {
    const diag = {};
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'graphql-defer-amplification');
    assert.equal(diag.chunkAmplified, true);
    assert.equal(diag.chunksOne, 2);
    assert.equal(diag.chunksMany, 9);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  } finally {
    await srv.close();
  }
});

test('GD-15: coalesced chunks with growing hold time confirm via timing', async () => {
  const srv = await startServer(deferHandler('slow-only'));
  try {
    const diag = {};
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 8000, diagnostics: diag });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'graphql-defer-amplification');
    assert.equal(diag.chunkAmplified, false);
    assert.equal(diag.timingAmplified, true);
    assert.ok(diag.deferredMedianMs >= 3 * diag.baselineMedianMs);
  } finally {
    await srv.close();
  }
});

test('GD-16: secure server stays quiet (coalesced, fast, directives honoured)', async () => {
  const srv = await startServer(deferHandler('secure'));
  try {
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GD-17: @defer rejection stays quiet on the defer legs', async () => {
  const srv = await startServer(deferHandler('no-defer'));
  try {
    const diag = {};
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.deferSupported, false);
  } finally {
    await srv.close();
  }
});

test('GD-18: ignored @skip/@include confirms the directive leg', async () => {
  const srv = await startServer(deferHandler('directive'));
  try {
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'graphql-directive-flood');
    assert.equal(findings[0].parameter, '@skip/@include');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  } finally {
    await srv.close();
  }
});

test('GD-19: non-GraphQL target stays quiet', async () => {
  const srv = await startServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>no graphql here</html>');
  });
  try {
    const findings = await probeGraphqlDefer(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GD-20: three-argument (url, params, opts) call also works', async () => {
  const srv = await startServer(deferHandler('leak'));
  try {
    const findings = await probeGraphqlDefer(srv.base, [], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'graphql_defer_abuse');
  } finally {
    await srv.close();
  }
});
