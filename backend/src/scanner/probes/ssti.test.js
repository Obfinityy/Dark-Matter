// Tests for the SSTI probe.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSsti } from './ssti.js';

describe('ssti probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      let out;
      if (u.pathname === '/tpl') {
        // Vulnerable stub: evaluates the template oracle.
        if (q === '{{1336*7}}') out = 'result: 9352';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/fortynine') {
        // Old bare-49 FP shape: renders 49, never 9352.
        if (q === '{{1336*7}}') out = 'result: 49';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/noisy') {
        // Every response carries 9352 — control gate must silence it.
        out = 'result: 9352 always';
      } else {
        out = `result: ${q}`; // plain reflector
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>${out}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on evaluated {{1336*7}} with a verbatim window', async () => {
    const findings = await probeSsti(`${base()}/tpl`, ['q'], { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'ssti');
    assert.ok(f, 'expected ssti finding on evaluating stub');
    assert.equal(f.severity, 'critical');
    assert.ok(f.evidence.response.includes('9352'), 'evidence must quote the evaluated result verbatim');
  });

  it('stays silent on a bare-49 render (old FP shape)', async () => {
    const findings = await probeSsti(`${base()}/fortynine`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'a 49 render is not a 9352 evaluation');
  });

  it('stays silent when the control already carries 9352', async () => {
    const findings = await probeSsti(`${base()}/noisy`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'oracle present in control must gate the finding');
  });

  it('never fires on mere literal reflection', async () => {
    const findings = await probeSsti(`${base()}/reflect`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'literal {{1336*7}} reflection must not be a finding');
  });
});
