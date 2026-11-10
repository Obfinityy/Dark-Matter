// GraphQL Relay Node interface IDOR probe tests (row #507 [High] GraphQL
// Relay Node interface IDOR, CWE-639; phase 'graphql-relay').
//
// The probe learns its own identity from viewer/me, then judges a
// three-leg oracle: own id resolves, a neighbouring id resolves to a
// DIFFERENT object (repeated), and a nonsense id resolves to nothing.
// The local mock server below plays a Relay schema in five modes:
// 'vulnerable' (foreign ids resolve), 'secure' (only the own id resolves),
// 'echo' (every id returns the caller's own object), 'no-node' (the
// schema has no node field) and 'no-viewer' (no self identity to learn).
// Tests run against real HTTP on 127.0.0.1 — no external services.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeGraphqlRelay,
  encodeNodeId,
  decodeNodeId,
  otherRawId,
  nodeQuery,
  parseNodeResult,
  assessRelayOracle,
  __graphqlRelayMeta,
} from './graphqlRelay.js';
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

function relayHandler(mode) {
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
    if (q === '{__typename}') return send({ data: { __typename: 'Query' } });
    if (q.includes('__schema')) {
      const fields =
        mode === 'no-node'
          ? [{ name: 'viewer' }, { name: '__typename' }]
          : [{ name: 'viewer' }, { name: 'node' }, { name: '__typename' }];
      return send({ data: { __schema: { queryType: { fields } } } });
    }
    if (q.includes('viewer {') || q.includes('me {')) {
      if (mode === 'no-viewer') return send({ data: { viewer: null } });
      return send({ data: { viewer: { __typename: 'User', id: '1' } } });
    }
    if (q.includes('node(id:')) {
      const m = /node\(id:\s*"([^"]+)"\)/.exec(q);
      const dec = decodeNodeId(m ? m[1] : '');
      if (!dec) return send({ data: { node: null } });
      if (mode === 'echo') {
        return send({ data: { node: { __typename: 'User', id: encodeNodeId('User', '1') } } });
      }
      if (mode === 'secure') {
        if (dec.rawId === '1') return send({ data: { node: { __typename: 'User', id: m[1] } } });
        return send({ data: { node: null } });
      }
      if (dec.rawId === '1' || dec.rawId === '2') {
        return send({ data: { node: { __typename: 'User', id: m[1] } } });
      }
      return send({ data: { node: null } });
    }
    return send({ data: {} });
  };
}

// ---- pure helpers ------------------------------------------------------------

test('GR-1: encodeNodeId base64-encodes Type:ID', () => {
  assert.equal(encodeNodeId('User', '1'), 'VXNlcjox');
  assert.equal(encodeNodeId('User', '2'), 'VXNlcjoy');
});

test('GR-2: decodeNodeId round-trips and rejects garbage', () => {
  assert.deepEqual(decodeNodeId('VXNlcjox'), { type: 'User', rawId: '1' });
  assert.equal(decodeNodeId('not-base64!!!'), null);
  assert.equal(decodeNodeId(''), null);
});

test('GR-3: otherRawId steps numeric ids and suffixes opaque ones', () => {
  assert.equal(otherRawId('1'), '2');
  assert.equal(otherRawId('41'), '42');
  assert.equal(otherRawId('abc'), 'abc-other');
});

test('GR-4: nodeQuery embeds the global id', () => {
  const q = nodeQuery('VXNlcjoy');
  assert.ok(q.includes('node(id: "VXNlcjoy")'));
  assert.ok(q.includes('__typename'));
});

test('GR-5: parseNodeResult needs a node with an id', () => {
  assert.deepEqual(parseNodeResult({ data: { node: { __typename: 'User', id: 'VXNlcjox' } } }), {
    resolved: true,
    globalId: 'VXNlcjox',
    typename: 'User',
  });
  assert.equal(parseNodeResult({ data: { node: null } }).resolved, false);
  assert.equal(parseNodeResult({ data: { node: { __typename: 'User' } } }).resolved, false);
  assert.equal(parseNodeResult({ errors: [{ message: 'nope' }] }).resolved, false);
});

test('GR-6: assessRelayOracle confirms the full three-leg matrix', () => {
  const v = assessRelayOracle({
    own: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    other: { resolved: true, globalId: 'VXNlcjoy', typename: 'User' },
    otherRepeat: { resolved: true, globalId: 'VXNlcjoy', typename: 'User' },
    nonsense: { resolved: false, globalId: null, typename: null },
  });
  assert.equal(v.verdict, 'confirmed');
});

test('GR-7: assessRelayOracle rejects when the other id is not foreign', () => {
  const v = assessRelayOracle({
    own: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    other: { resolved: false, globalId: null, typename: null },
    otherRepeat: { resolved: false, globalId: null, typename: null },
    nonsense: { resolved: false, globalId: null, typename: null },
  });
  assert.equal(v.verdict, 'rejected');
});

test('GR-8: assessRelayOracle rejects an echo server', () => {
  const v = assessRelayOracle({
    own: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    other: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    otherRepeat: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    nonsense: { resolved: false, globalId: null, typename: null },
  });
  assert.equal(v.verdict, 'rejected');
});

test('GR-9: assessRelayOracle rejects when nonsense resolves', () => {
  const v = assessRelayOracle({
    own: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    other: { resolved: true, globalId: 'VXNlcjoy', typename: 'User' },
    otherRepeat: { resolved: true, globalId: 'VXNlcjoy', typename: 'User' },
    nonsense: { resolved: true, globalId: 'VXNlcjo5', typename: 'User' },
  });
  assert.equal(v.verdict, 'rejected');
});

test('GR-10: assessRelayOracle is unconfirmed when the repeat disagrees', () => {
  const v = assessRelayOracle({
    own: { resolved: true, globalId: 'VXNlcjox', typename: 'User' },
    other: { resolved: true, globalId: 'VXNlcjoy', typename: 'User' },
    otherRepeat: { resolved: false, globalId: null, typename: null },
    nonsense: { resolved: false, globalId: null, typename: null },
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('GR-11: probe meta names the phase and all depths', () => {
  assert.deepEqual(__graphqlRelayMeta.phases, ['graphql-relay']);
  assert.deepEqual(__graphqlRelayMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour (local mock servers) ------------------------------------

test('GR-12: vulnerable Relay schema confirms the IDOR', async () => {
  const srv = await startServer(relayHandler('vulnerable'));
  try {
    const diag = {};
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'graphql_relay_idor');
    assert.equal(f.severity, 'high');
    assert.equal(f.parameter, 'node(id:)');
    assert.equal(f.evidence.crossUserRead, true);
    assert.equal(f.evidence.signalCorrelated, true);
    assert.match(f.evidence.response, /VXNlcjoy/);
    assert.equal(diag.oracle, 'confirmed');
    assert.equal(diag.nodeField, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((x) => x.class === 'graphql_relay_idor').length, 1);
  } finally {
    await srv.close();
  }
});

test('GR-13: secure Relay schema stays quiet (foreign id resolves to null)', async () => {
  const srv = await startServer(relayHandler('secure'));
  try {
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GR-14: echo server stays quiet (other id returns the own object)', async () => {
  const srv = await startServer(relayHandler('echo'));
  try {
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GR-15: schema without a node field stays quiet', async () => {
  const srv = await startServer(relayHandler('no-node'));
  try {
    const diag = {};
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.nodeField, false);
  } finally {
    await srv.close();
  }
});

test('GR-16: no self identity stays quiet (cannot tell public from foreign)', async () => {
  const srv = await startServer(relayHandler('no-viewer'));
  try {
    const diag = {};
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.equal(findings.length, 0);
    assert.equal(diag.noOwnIdentity, true);
  } finally {
    await srv.close();
  }
});

test('GR-17: non-GraphQL target stays quiet', async () => {
  const srv = await startServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>no graphql here</html>');
  });
  try {
    const findings = await probeGraphqlRelay(srv.base, { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  } finally {
    await srv.close();
  }
});

test('GR-18: three-argument (url, params, opts) call also works', async () => {
  const srv = await startServer(relayHandler('vulnerable'));
  try {
    const findings = await probeGraphqlRelay(srv.base, [], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'graphql_relay_idor');
  } finally {
    await srv.close();
  }
});

test('GR-19: diagnostics record endpoint, attempts and oracle legs', async () => {
  const srv = await startServer(relayHandler('vulnerable'));
  try {
    const diag = {};
    await probeGraphqlRelay(srv.base, { timeoutMs: 5000, diagnostics: diag });
    assert.ok(String(diag.endpoint).endsWith('/graphql'));
    assert.ok(diag.attempts >= 7);
    assert.equal(diag.ownResolved, true);
    assert.equal(diag.otherResolved, true);
    assert.equal(diag.nonsenseResolved, false);
  } finally {
    await srv.close();
  }
});
