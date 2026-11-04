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
});
