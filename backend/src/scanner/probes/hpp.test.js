// Tests for the HPP probe (#37).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeHpp } from './hpp.js';

describe('hpp probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      // Last-wins framework stub: echo the LAST value of p.
      const vals = u.searchParams.getAll('p');
      const eff = vals.length ? vals[vals.length - 1] : '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>effective: ${eff}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects last-wins duplicate resolution', async () => {
    const findings = await probeHpp(`${base()}/search`, ['p'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const oracle = findings.find((f) => f.class === 'hpp');
    assert.ok(oracle, 'expected HPP oracle finding on last-wins stub');
  });

  it('returns [] with no params', async () => {
    const findings = await probeHpp(`${base()}/search`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
