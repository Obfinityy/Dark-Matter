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

  // isLab follow-up (8 Nov 2026): T2/T3 are lab-only, but the old local
  // isLab never saw labTargets (no call-site pass) and never matched
  // port-bearing entries — T2 could never run in production.
  function startWafStub() {
    const requests = [];
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      requests.push(req.url);
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ echoed: null }));
        });
        return;
      }
      const vals = u.searchParams.getAll('p');
      if (vals.length === 1 && vals[0].includes('__hpp_probe__')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('forbidden');
        return;
      }
      const eff = vals.length ? vals[vals.length - 1] : '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>effective: ${eff}</html>`);
    });
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({
        server, port: server.address().port, requests,
        close: () => new Promise((r) => server.close(r)),
      }));
    });
  }

  it('T2 fires HIGH in lab mode with PORT-BEARING labTargets', async () => {
    const stub = await startWafStub();
    try {
      const findings = await probeHpp(`http://127.0.0.1:${stub.port}/search`, ['p'], {
        labTargets: `127.0.0.1:${stub.port}`,
        timeoutMs: 5000,
      });
      const waf = findings.find((f) => f.id.startsWith('hpp-waf-'));
      assert.ok(waf, `expected T2 WAF-bypass HIGH, got ${JSON.stringify(findings.map((f) => f.id))}`);
      assert.equal(waf.severity, 'high');
    } finally {
      await stub.close();
    }
  });

  it('T2 stays silent off-lab (no __hpp_probe__ requests)', async () => {
    const stub = await startWafStub();
    try {
      const findings = await probeHpp(`http://127.0.0.1:${stub.port}/search`, ['p'], {
        labTargets: 'lab.local',
        timeoutMs: 5000,
      });
      assert.ok(!findings.some((f) => f.id.startsWith('hpp-waf-')), 'T2 must not run off-lab');
      assert.ok(!stub.requests.some((u) => u.includes('__hpp_probe__')), 'no WAF-bypass probe may be sent off-lab');
    } finally {
      await stub.close();
    }
  });

  it('returns [] with no params', async () => {
    const findings = await probeHpp(`${base()}/search`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
