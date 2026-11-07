// Tests for the race-condition probe (#33). Lab-gated: non-lab targets
// must yield zero findings; the safety gate is the primary assertion.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeRace } from './race.js';

describe('race probe', () => {
  const forms = [
    { action: 'http://127.0.0.1:1/submit', inputs: [{ name: 'qty', value: '1' }] },
  ];

  it('returns [] on non-lab targets (lab gate)', async () => {
    const findings = await probeRace(forms, 'http://example.com/submit', ['qty'], {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('returns [] when no forms are inventoried', async () => {
    const findings = await probeRace([], 'http://127.0.0.1:1/x', [], {
      labTargets: '127.0.0.1',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, []);
  });

  it('handles unreachable lab host without throwing', async () => {
    const findings = await probeRace(forms, 'http://127.0.0.1:1/submit', ['qty'], {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.ok(Array.isArray(findings));
  });

  it('lab gate opens with PORT-BEARING labTargets (D2, #474 repair)', async () => {
    // A stub that always applies the mutation: sequential baseline
    // succeeds, the 8x burst succeeds too -> T1 CRITICAL fires. With
    // the old hostname-vs-port isLab the gate never opened and this
    // probe returned [] without a single request.
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok — purchase completed');
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const base = `http://127.0.0.1:${stub.port}`;
      const stubForms = [{ action: `${base}/submit`, inputs: [{ name: 'qty', value: '1' }] }];
      const findings = await probeRace(stubForms, `${base}/`, ['qty'], {
        labTargets: `127.0.0.1:${stub.port}`,
        timeoutMs: 3000,
      });
      assert.ok(calls.length >= 9, `gate must open: expected >=9 POSTs, got ${calls.length}`);
      assert.ok(calls.every((c) => c.startsWith('POST ')), 'race probe only POSTs');
      assert.equal(findings.length, 1, `expected exactly the T1 finding; got: ${findings.map((f) => f.title).join(' | ')}`);
      assert.match(findings[0].title, /double-submit/);
      assert.equal(findings[0].severity, 'critical');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('lab gate stays shut without labTargets (no requests sent)', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok — purchase completed');
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const base = `http://127.0.0.1:${stub.port}`;
      const stubForms = [{ action: `${base}/submit`, inputs: [{ name: 'qty', value: '1' }] }];
      const findings = await probeRace(stubForms, `${base}/`, ['qty'], { timeoutMs: 3000 });
      assert.deepEqual(findings, []);
      assert.equal(calls.length, 0, 'no labTargets => no requests at all');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
