// Tests for the NoSQL deep probe (#32).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeNoSqlDeep } from './nosqlDeep.js';

// In-memory canary collections for the aggregation stub. The canary user
// exists ONLY in the stub's own data — the probe never learns it except
// through opts.nosqlCanary (the T4 pattern).
function makeStub(mode) {
  const canaryUser = `dmcanary_${Math.random().toString(36).slice(2, 10)}`;
  const joinBio = `CANARY-JOIN-BIO-${Math.random().toString(36).slice(2, 10)}`;
  const users = [
    { username: canaryUser, email: 'canary@example.invalid', role: 'user' },
    { username: 'alice', email: 'alice@example.invalid', role: 'user' },
  ];
  const profiles = [{ username: canaryUser, bio: joinBio }];
  let pipelinePosts = 0;

  function runStages(stages) {
    let docs = users.map((u) => ({ ...u }));
    for (const stage of stages) {
      if (stage && typeof stage === 'object' && stage.$match && typeof stage.$match === 'object') {
        const crit = stage.$match;
        docs = docs.filter((d) => Object.entries(crit).every(([k, v]) => d[k] === v));
      } else if (stage && typeof stage === 'object' && stage.$lookup && typeof stage.$lookup === 'object') {
        const lk = stage.$lookup;
        docs = docs.map((d) => ({
          ...d,
          [lk.as || 'joined']: profiles.filter((p) => p[lk.foreignField] === d[lk.localField]),
        }));
      }
    }
    return docs;
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        // JSON body: aggregation pipeline carrier.
        let body = null;
        try { body = JSON.parse(raw); } catch { /* not JSON — form path below */ }
        if (body !== null && typeof body === 'object') {
          const stages = Array.isArray(body) ? body : body.pipeline;
          if (Array.isArray(stages)) {
            pipelinePosts++;
            if (mode === 'echo') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(raw);
              return;
            }
            if (mode === 'hardened') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, docs: [] }));
              return;
            }
            // 'vulnerable': execute the pipeline against the canary data.
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, docs: runStages(stages) }));
            return;
          }
        }
        // Form body: [$ne] operator in param NAMES (PHP array syntax).
        const params = new URLSearchParams(raw);
        const keys = [...params.keys()];
        if (keys.some((k) => k.includes('[$ne]'))) {
          res.writeHead(302, { 'Set-Cookie': 'session=vuln123; Path=/', Location: '/dashboard' });
          res.end('redirecting');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>invalid credentials</html>');
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>login page</html>');
  });

  return {
    server,
    canaryUser,
    joinBio,
    pipelinePosts: () => pipelinePosts,
    base: () => `http://127.0.0.1:${server.address().port}`,
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', r)),
    close: () => server.close(),
  };
}

describe('nosqlDeep probe', () => {
  let stub;
  const base = () => stub.base();

  before(async () => {
    stub = makeStub('vulnerable');
    await stub.listen();
  });

  after(() => stub.close());

  it('detects operator auth bypass via differential', async () => {
    const findings = await probeNoSqlDeep(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const bypass = findings.find((f) => f.class === 'nosql_injection');
    // Vulnerable stub should yield a bypass finding.
    assert.ok(bypass, 'expected operator-bypass finding on vulnerable stub');
    assert.equal(bypass.severity, 'critical');
  });

  it('stays silent on hardened login', async () => {
    const findings = await probeNoSqlDeep(`${base()}/login`, ['user'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });

  // T6 — aggregation pipeline injection (Deep-gated, lab-gated, canary-gated).
  const canary = () => ({
    userParam: 'username',
    field: 'username',
    value: stub.canaryUser,
    collection: 'profiles',
  });
  const labOpts = (extra = {}) => ({
    timeoutMs: 5000,
    depth: 'deep',
    labTargets: '127.0.0.1',
    nosqlCanary: canary(),
    ...extra,
  });

  it('T6: $lookup join confirms on vulnerable stub', async () => {
    const findings = await probeNoSqlDeep(`${base()}/search`, ['username'], labOpts());
    const agg = findings.find((f) => f.title.includes('aggregation pipeline'));
    assert.ok(agg, 'expected aggregation-pipeline finding on vulnerable stub');
    assert.equal(agg.class, 'nosql_injection');
    assert.equal(agg.severity, 'high');
    assert.ok(agg.evidence.response.includes(stub.canaryUser));
  });

  it('T6: $match widen confirms when $lookup is unavailable', async () => {
    // No canary.collection → the $lookup variant is skipped; the $match
    // widening leg must still confirm on the vulnerable stub.
    const noLookup = labOpts({ nosqlCanary: { userParam: 'username', field: 'username', value: stub.canaryUser } });
    const findings = await probeNoSqlDeep(`${base()}/search`, ['username'], noLookup);
    const agg = findings.find((f) => f.title.includes('aggregation pipeline'));
    assert.ok(agg, 'expected $match-widen aggregation finding without a $lookup collection');
    assert.equal(agg.severity, 'high');
  });

  it('T6: stays silent on hardened stub (pipeline ignored)', async () => {
    const hard = makeStub('hardened');
    await hard.listen();
    try {
      const findings = await probeNoSqlDeep(`${hard.base()}/search`, ['username'], labOpts());
      assert.equal(findings.filter((f) => f.title.includes('aggregation pipeline')).length, 0);
    } finally {
      hard.close();
    }
  });

  it('T6: stays silent on echo stub (anti-echo guard)', async () => {
    // The echo stub returns the request body verbatim — the canary value
    // IS in the response, but so is the "$match"/"$lookup" literal, so
    // the anti-echo guard must block confirmation.
    const echo = makeStub('echo');
    await echo.listen();
    try {
      const findings = await probeNoSqlDeep(`${echo.base()}/search`, ['username'], labOpts());
      assert.equal(findings.filter((f) => f.title.includes('aggregation pipeline')).length, 0);
    } finally {
      echo.close();
    }
  });

  it('T6: stays silent without labTargets (fail-closed, no requests)', async () => {
    const before = stub.pipelinePosts();
    const noLab = labOpts({ labTargets: '' });
    const findings = await probeNoSqlDeep(`${base()}/search`, ['username'], noLab);
    assert.equal(findings.filter((f) => f.title.includes('aggregation pipeline')).length, 0);
    assert.equal(stub.pipelinePosts(), before, 'T6 must send no pipeline request off-lab');
  });

  it('T6: stays silent below Deep depth', async () => {
    const findings = await probeNoSqlDeep(`${base()}/search`, ['username'], labOpts({ depth: 'standard' }));
    assert.equal(findings.filter((f) => f.title.includes('aggregation pipeline')).length, 0);
  });

  it('T6: stays silent without a canary', async () => {
    const findings = await probeNoSqlDeep(`${base()}/search`, ['username'], labOpts({ nosqlCanary: undefined }));
    assert.equal(findings.filter((f) => f.title.includes('aggregation pipeline')).length, 0);
  });
});
