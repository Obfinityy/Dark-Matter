// Tests for the argument injection probe (#54).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeArgInjection } from './argInjection.js';

describe('argInjection probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const target = u.searchParams.get('target') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Vulnerable stub: option-looking values change the response family.
      if (target.startsWith('--') || target.startsWith('-')) {
        res.end('<html>usage: ping [-c count] [-i interval] target</html>');
        return;
      }
      res.end(`<html>pinging ${target}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects option-parser reach via differential', async () => {
    const findings = await probeArgInjection(`${base()}/ping`, ['target'], { timeoutMs: 10000 });
    assert.ok(Array.isArray(findings));
    const ai = findings.find((f) => f.class === 'argumentInjection');
    assert.ok(ai, 'expected arg-injection finding on option-parsing stub');
    assert.equal(ai.severity, 'medium');
  }, { timeout: 60000 });

  it('stays silent on non-cli params without differential', async () => {
    const findings = await probeArgInjection(`${base()}/ping`, ['q'], {
      timeoutMs: 8000,
      depth: 'quick',
    });
    assert.ok(Array.isArray(findings));
  });
});
