// Tests for the eval-injection detector (#48).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeEvalInject } from './evalInject.js';

describe('evalInject probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const code = u.searchParams.get('code') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Vulnerable stub: evaluates benign arithmetic.
      if (code === '1336*7') {
        res.end('<html>result: 9352</html>');
        return;
      }
      res.end('<html>result: DMEVAL-BASELINE</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects code evaluation via benign arithmetic oracle', async () => {
    const findings = await probeEvalInject(`${base()}/run`, ['code'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const evalFinding = findings.find((f) => f.class === 'eval_injection');
    assert.ok(evalFinding, 'expected eval finding on evaluating stub');
    assert.equal(evalFinding.severity, 'high');
  });

  it('exits clean with no eval surface', async () => {
    const findings = await probeEvalInject(`${base()}/run`, ['q'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('D4 fires on EL shapes when plain arithmetic does not evaluate', async () => {
    // EL-only stub: ${1336*7} evaluates, plain 1336*7 does not, baseline clean.
    const el = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const code = u.searchParams.get('code') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code === '${1336*7}' || code === '%{1336*7}') res.end('<html>result: 9352</html>');
      else res.end('<html>result: DMEVAL-BASELINE</html>');
    });
    await new Promise((r) => el.listen(0, '127.0.0.1', r));
    const p = el.address().port;
    try {
      const findings = await probeEvalInject(`http://127.0.0.1:${p}/run`, ['code'], { timeoutMs: 15000 });
      const f = findings.find((x) => x.id.startsWith('eval-el-'));
      assert.ok(f, `expected D4 eval-el finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes('9352'), 'D4 evidence must quote the evaluated result verbatim');
    } finally {
      await new Promise((r) => el.close(r));
    }
  });

  it('D4 stays silent when the baseline already carries 9352', async () => {
    // Noisy stub: every response carries 9352 — the baseline gate must silence D4.
    const noisy = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>result: 9352</html>');
    });
    await new Promise((r) => noisy.listen(0, '127.0.0.1', r));
    const p = noisy.address().port;
    try {
      const findings = await probeEvalInject(`http://127.0.0.1:${p}/run`, ['code'], { timeoutMs: 15000 });
      assert.ok(!findings.some((x) => x.id.startsWith('eval-el-')), 'baseline 9352 must gate D4');
    } finally {
      await new Promise((r) => noisy.close(r));
    }
  });

  it('D4 fires exactly once when only %{1336*7} evaluates', async () => {
    const ognl = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const code = u.searchParams.get('code') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code === '%{1336*7}') res.end('<html>result: 9352</html>');
      else res.end('<html>result: DMEVAL-BASELINE</html>');
    });
    await new Promise((r) => ognl.listen(0, '127.0.0.1', r));
    const p = ognl.address().port;
    try {
      const findings = await probeEvalInject(`http://127.0.0.1:${p}/run`, ['code'], { timeoutMs: 15000 });
      const f = findings.filter((x) => x.class === 'eval_injection');
      assert.equal(f.length, 1, `expected exactly 1 finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f[0].severity, 'high');
      assert.ok(f[0].id.startsWith('eval-el-'), 'the finding must be the D4 EL one');
      // Evidence request is the REAL mutated URL now (path-segment lane,
      // 6 Nov 2026) — the shape is percent-encoded in it, so decode
      // before checking it names the evaluating shape.
      assert.ok(decodeURIComponent(f[0].evidence.request).includes('%{1336*7}'), 'request must name the evaluating shape');
    } finally {
      await new Promise((r) => ognl.close(r));
    }
  }, { timeout: 60000 });

  it('stays silent when nothing evaluates', async () => {
    const inert = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>result: DMEVAL-BASELINE</html>');
    });
    await new Promise((r) => inert.listen(0, '127.0.0.1', r));
    const p = inert.address().port;
    try {
      const findings = await probeEvalInject(`http://127.0.0.1:${p}/run`, ['code'], { timeoutMs: 15000 });
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => inert.close(r));
    }
  }, { timeout: 60000 });

  it('one finding per sink when both plain and EL evaluate', async () => {
    const both = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const code = u.searchParams.get('code') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code === '1336*7' || code === '${1336*7}') res.end('<html>result: 9352</html>');
      else res.end('<html>result: DMEVAL-BASELINE</html>');
    });
    await new Promise((r) => both.listen(0, '127.0.0.1', r));
    const p = both.address().port;
    try {
      const findings = await probeEvalInject(`http://127.0.0.1:${p}/run`, ['code'], { timeoutMs: 15000 });
      assert.equal(findings.length, 1, `expected exactly 1 finding total, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.ok(findings[0].id.startsWith('eval-exec-'), 'the D2 finding wins when plain arithmetic evaluates');
    } finally {
      await new Promise((r) => both.close(r));
    }
  });
});
