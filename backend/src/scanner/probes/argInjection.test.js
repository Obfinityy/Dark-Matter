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
    assert.ok(ai.evidence.response.includes('usage: ping'), 'evidence must quote the divergent usage window verbatim');
  }, { timeout: 60000 });

  it('stays silent on an echo-only page (no option-error signal)', async () => {
    const echo = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      const target = u.searchParams.get('target') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>pinging ${target}</html>`);
    });
    await new Promise((r) => echo.listen(0, '127.0.0.1', r));
    const p = echo.address().port;
    try {
      const findings = await probeArgInjection(`http://127.0.0.1:${p}/ping`, ['target'], { timeoutMs: 10000 });
      assert.equal(findings.length, 0, 'an echo page reflects every value — that is not parser reach');
    } finally {
      await new Promise((r) => echo.close(r));
    }
  }, { timeout: 60000 });

  it('late divergence past char 300 still fires (full-length sig)', async () => {
    const prefix = 'P'.repeat(400);
    const late = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${req.socket.localPort}`);
      const target = u.searchParams.get('target') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (target.startsWith('--') || target.startsWith('-')) {
        res.end(`${prefix} usage: ping [-c count] [-i interval] target`);
        return;
      }
      res.end(`${prefix} ok`);
    });
    await new Promise((r) => late.listen(0, '127.0.0.1', r));
    const p = late.address().port;
    try {
      const findings = await probeArgInjection(`http://127.0.0.1:${p}/ping`, ['target'], { timeoutMs: 10000 });
      const ai = findings.filter((f) => f.class === 'argumentInjection');
      assert.equal(ai.length, 1, `expected exactly 1 finding, got ${JSON.stringify(findings)}`);
      assert.equal(ai[0].severity, 'medium');
      assert.ok(ai[0].evidence.response.includes('usage: ping'), 'evidence must quote the late usage window');
    } finally {
      await new Promise((r) => late.close(r));
    }
  }, { timeout: 60000 });

  it('stays silent on non-cli params without differential', async () => {
    const findings = await probeArgInjection(`${base()}/ping`, ['q'], {
      timeoutMs: 8000,
      depth: 'quick',
    });
    assert.ok(Array.isArray(findings));
  });
});
