// Tests for the EL-injection detector (#197).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeElInject } from './elInject.js';

describe('elInject probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      let out;
      if (u.pathname === '/eval') {
        // Vulnerable stub: evaluates benign EL oracles.
        if (q === '${7*7}' || q === '#{7*7}') out = 'result: 49';
        else if (q.includes('dmElTest')) out = 'result: dmElTest';
        else out = 'result: baseline-ok'; // no echo — control never carries the oracle
      } else if (u.pathname === '/stronly') {
        // Evaluates only the string-method shape; math shapes reflect.
        if (q.includes('dmElTest')) out = 'result: dmElTest';
        else out = 'result: baseline-ok';
      } else {
        out = `result: ${q}`; // plain reflector — literal echo only
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>${out}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on evaluated ${7*7} (control shows literal / no oracle)', async () => {
    const findings = await probeElInject(`${base()}/eval`, ['q'], { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'el_injection');
    assert.ok(f, 'expected el_injection finding on evaluating stub');
    assert.equal(f.severity, 'high');
    assert.equal(f.parameter, 'q');
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('fires on the string oracle even when math shapes are inert', async () => {
    const findings = await probeElInject(`${base()}/stronly`, ['q'], { timeoutMs: 8000 });
    assert.ok(findings.some((x) => x.class === 'el_injection'), 'expected finding from string oracle');
  });

  it('never fires on mere literal reflection', async () => {
    const findings = await probeElInject(`${base()}/reflect`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'literal ${7*7} reflection must not be a finding');
  });

  it('quick depth uses a single payload and still fires', async () => {
    const findings = await probeElInject(`${base()}/eval`, ['q'], { timeoutMs: 8000, depth: 'quick' });
    assert.ok(findings.some((x) => x.class === 'el_injection'), 'expected finding in quick depth');
  });

  it('returns [] for unparseable URLs', async () => {
    assert.deepEqual(await probeElInject('not a url', ['q'], { timeoutMs: 1000 }), []);
  });
});
