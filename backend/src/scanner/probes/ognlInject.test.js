// Tests for the OGNL-injection detector (#425, Struts2).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeOgnlInject } from './ognlInject.js';

describe('ognlInject probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      if (u.pathname === '/search.action') {
        // Vulnerable stub: evaluates benign OGNL math oracles.
        let out;
        if (q === '%{7*7}' || q === '${7*7}') out = 'hits: 49';
        else out = 'hits: baseline-ok';
        res.writeHead(200, { 'Content-Type': 'text/html', 'X-Powered-By': 'Struts2' });
        res.end(`<html>${out}</html>`);
        return;
      }
      // Plain non-Struts page: literal echo, no markers.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>echo: ${q}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on evaluated %{7*7} at a .action endpoint', async () => {
    const findings = await probeOgnlInject(`${base()}/search.action`, ['q'], { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'ognl_injection' && x.severity === 'critical');
    assert.ok(f, 'expected critical ognl_injection finding');
    assert.equal(f.parameter, 'q');
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('emits a low struts_fingerprint finding on version disclosure', async () => {
    const findings = await probeOgnlInject(`${base()}/search.action`, ['q'], { timeoutMs: 8000 });
    const f = findings.find((x) => x.id.startsWith('struts-fingerprint-'));
    assert.ok(f, 'expected struts_fingerprint info finding');
    assert.equal(f.severity, 'low');
  });

  it('runs nothing on a plain non-Struts page (no targeting)', async () => {
    const findings = await probeOgnlInject(`${base()}/page`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'no OGNL traffic at non-Struts targets');
  });

  it('quick depth uses a single payload and still fires', async () => {
    const findings = await probeOgnlInject(`${base()}/search.action`, ['q'], { timeoutMs: 8000, depth: 'quick' });
    assert.ok(findings.some((x) => x.class === 'ognl_injection' && x.severity === 'critical'));
  });
});
