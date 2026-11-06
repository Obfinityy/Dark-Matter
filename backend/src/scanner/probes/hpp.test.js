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
      // JSON POST: parse (last-wins on duplicate keys) and echo the parsed value.
      if (req.method === 'POST' && (req.headers['content-type'] || '').includes('application/json')) {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(raw); } catch { /* ignore */ }
          const vals = Object.values(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ echoed: vals.length ? vals[vals.length - 1] : null }));
        });
        return;
      }
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

  it('detects duplicate JSON keys parsed last-wins (T5)', async () => {
    const findings = await probeHpp(`${base()}/search`, ['p'], { timeoutMs: 5000 });
    const json = findings.find((f) => f.id.startsWith('hpp-json-'));
    assert.ok(json, `expected T5 JSON dup-keys finding, got ${JSON.stringify(findings.map((f) => f.id))}`);
    assert.equal(json.severity, 'low');
    assert.ok(json.evidence.response.includes('_B'), 'JSON evidence must quote the winning value verbatim');
  });

  it('returns [] with no params', async () => {
    const findings = await probeHpp(`${base()}/search`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
