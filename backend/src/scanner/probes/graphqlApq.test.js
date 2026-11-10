// GraphQL persisted queries / APQ abuse probe tests (row #508 [Medium]
// GraphQL persisted queries / APQ abuse, CWE-770/400; phase 'graphql-apq').
//
// The probe runs an unknown-hash control first (a fresh random hash must
// be rejected), then two replay legs: a bounded dictionary of canonical
// query hashes, and register-then-replay of one benign query with
// attacker-controlled variables. The local mock server below plays an
// APQ endpoint in four modes: 'vulnerable' (a dictionary hash is
// pre-registered), 'vulnerable-no-preseed' (registration stores the hash,
// nothing pre-seeded), 'secure' (hash-only replays are always rejected)
// and 'promiscuous' (even an unknown hash executes — the oracle is
// broken). Tests run against real HTTP on 127.0.0.1 — no external services.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeGraphqlApq,
  persistedHash,
  replayBody,
  registerBody,
  parseApqResult,
  assessApqOracle,
  __graphqlApqMeta,
} from './graphqlApq.js';
import { verifyFindings } from '../verifier.js';

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

function apqHandler(mode) {
  const store = new Set();
  if (mode === 'vulnerable') store.add(persistedHash('{__typename}'));
  return async (req, res) => {
    const send = (obj, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
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
    const ext = body.extensions && body.extensions.persistedQuery;
    if (q === '{__typename}' && !ext) return send({ data: { __typename: 'Query' } });
    if (ext) {
      const hash = ext.sha256Hash;
      if (q) {
        // Registration: full text plus hash. Secure mode executes the
        // query but never stores the hash.
        if (mode !== 'secure' && persistedHash(q) === hash) store.add(hash);
        return send({ data: { __typename: 'Query' } });
      }
      // Hash-only replay.
      if (mode === 'promiscuous') return send({ data: { __typename: 'Query' } });
      if (store.has(hash)) return send({ data: { __typename: 'Query' } });
      return send({ errors: [{ message: 'PersistedQueryNotFound' }] });
    }
    return send({ data: { __typename: 'Query' } });
  };
}

// ---- pure helpers ------------------------------------------------------------

test('GA-1: persistedHash matches the sha256 test vectors', () => {
  assert.equal(persistedHash(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(persistedHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(persistedHash('{__typename}'), /^[0-9a-f]{64}$/);
});

test('GA-2: replayBody carries only the hash, no query text', () => {
  const body = replayBody('ab'.repeat(32), 'DmApqProbe', { dm: 'x' });
  assert.equal(body.query, undefined);
  assert.equal(body.extensions.persistedQuery.version, 1);
  assert.equal(body.extensions.persistedQuery.sha256Hash, 'ab'.repeat(32));
  assert.equal(body.operationName, 'DmApqProbe');
  assert.deepEqual(body.variables, { dm: 'x' });
});

test('GA-3: registerBody hashes the exact query text', () => {
  const body = registerBody('query DmApqProbe($dm: String) { __typename }', 'DmApqProbe', { dm: 'r' });
  assert.equal(body.extensions.persistedQuery.sha256Hash, persistedHash('query DmApqProbe($dm: String) { __typename }'));
  assert.equal(body.query, 'query DmApqProbe($dm: String) { __typename }');
});

test('GA-4: parseApqResult classifies executed, not-found and neither', () => {
  assert.deepEqual(parseApqResult({ data: { __typename: 'Query' } }), { executed: true, notFound: false });
  assert.deepEqual(parseApqResult({ errors: [{ message: 'PersistedQueryNotFound' }] }), {
    executed: false,
    notFound: true,
  });
  assert.deepEqual(parseApqResult({ errors: [{ message: 'Validation error' }] }), {
    executed: false,
    notFound: false,
  });
  assert.deepEqual(parseApqResult(null), { executed: false, notFound: false });
  assert.deepEqual(parseApqResult({ data: null }), { executed: false, notFound: false });
});

test('GA-5: assessApqOracle confirms control-rejected plus reproduced replay', () => {
  const v = assessApqOracle({
    unknown: { executed: false, notFound: true },
    replay: { executed: true, notFound: false },
    replayRepeat: { executed: true, notFound: false },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('GA-6: assessApqOracle rejects when the unknown hash executes', () => {
  const v = assessApqOracle({
    unknown: { executed: true, notFound: false },
    replay: { executed: true, notFound: false },
    replayRepeat: { executed: true, notFound: false },
  });
  assert.equal(v.verdict, 'rejected');
});

test('GA-7: assessApqOracle rejects when the replay does not execute', () => {
  const v = assessApqOracle({
    unknown: { executed: false, notFound: true },
    replay: { executed: false, notFound: true },
    replayRepeat: { executed: false, notFound: true },
  });
  assert.equal(v.verdict, 'rejected');
});

test('GA-8: assessApqOracle is unconfirmed when the repeat fails', () => {
  const v = assessApqOracle({
    unknown: { executed: false, notFound: true },
    replay: { executed: true, notFound: false },
    replayRepeat: { executed: false, notFound: true },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('GA-9: probe meta names the phase and all depths', () => {
  assert.deepEqual(__graphqlApqMeta.phases, ['graphql-apq']);
  assert.deepEqual(__graphqlApqMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour (local mock servers) ------------------------------------

test('GA-10: pre-seeded dictionary hash confirms (dictionary leg)', async () => {
  const srv = await startServer(apqHandler('vulnerable'));
  try {
    const diag = {};
    const findings = await probeGraphqlApq(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'graphql_apq_abuse');
    assert.equal(f.id, 'graphql-apq-dictionary');
    assert.equal(f.severity, 'medium');
    assert.equal(f.parameter, 'extensions.persistedQuery.sha256Hash');
    assert.equal(f.evidence.signalCorrelated, true);
    assert.match(f.evidence.request, /persistedQuery/);
    assert.equal(diag.variant, 'dictionary');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((x) => x.class === 'graphql_apq_abuse').length, 1);
  } finally {
    await srv.close();
  }
});

test('GA-11: register-then-replay confirms when no dictionary hash hits', async () => {
  const srv = await startServer(apqHandler('vulnerable-no-preseed'));
  try {
    const diag = {};
    const findings = await probeGraphqlApq(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'graphql_apq_abuse');
    assert.equal(f.id, 'graphql-apq-replay');
    assert.equal(f.severity, 'medium');
    assert.equal(diag.variant, 'replay');
    assert.equal(diag.registered, true);
    assert.equal(diag.oracle, 'confirmed');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  } finally {
    await srv.close();
  }
});

test('GA-12: secure APQ server stays quiet (hash-only always rejected)', async () => {
  const srv = await startServer(apqHandler('secure'));
  try {
    const diag = {};
    const findings = await probeGraphqlApq(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.unknownHashRejected, true);
    // Registration itself executes (normal GraphQL) — the hash is what
    // is never stored, so the hash-only replay fails and the oracle
    // rejects.
    assert.equal(diag.registered, true);
    assert.equal(diag.oracle, 'rejected');
  } finally {
    await srv.close();
  }
});

test('GA-13: promiscuous server stays quiet (unknown hash executes — oracle broken)', async () => {
  const srv = await startServer(apqHandler('promiscuous'));
  try {
    const findings = await probeGraphqlApq(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GA-14: non-GraphQL target stays quiet', async () => {
  const srv = await startServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>no graphql here</html>');
  });
  try {
    const findings = await probeGraphqlApq(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GA-15: three-argument (url, params, opts) call also works', async () => {
  const srv = await startServer(apqHandler('vulnerable-no-preseed'));
  try {
    const findings = await probeGraphqlApq(srv.base, [], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'graphql_apq_abuse');
  } finally {
    await srv.close();
  }
});

test('GA-16: diagnostics record endpoint and attempt counts', async () => {
  const srv = await startServer(apqHandler('vulnerable'));
  try {
    const diag = {};
    await probeGraphqlApq(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.ok(String(diag.endpoint).endsWith('/graphql'));
    assert.ok(diag.attempts >= 3);
  } finally {
    await srv.close();
  }
});
