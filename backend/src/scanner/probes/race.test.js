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
    // A stub that applies the mutation and returns a body that differs
    // from the untouched endpoint: sequential baseline succeeds, the 8x
    // burst succeeds too -> T1 CRITICAL fires. With the old
    // hostname-vs-port isLab the gate never opened and this probe
    // returned [] without a single request.
    // NOTE (proof #37 fix): the stub MUST return different bodies for
    // GET (pre-state) and POST (mutation) — a stub that answers both
    // identically is the static-shell FP pattern and now yields [].
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        if (req.method === 'GET') res.end('<html><body><form>buy</form></body></html>');
        else res.end('ok — purchase completed');
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
      const posts = calls.filter((c) => c.startsWith('POST '));
      assert.ok(posts.length >= 9, `gate must open: expected >=9 POSTs, got ${posts.length}`);
      assert.ok(calls.every((c) => c.startsWith('POST ') || c.startsWith('GET ')), 'race probe only GETs (pre-state read) and POSTs');
      assert.ok(calls.some((c) => c.startsWith('GET ')), 'T1 reads the untouched endpoint before mutating');
      assert.equal(findings.length, 1, `expected exactly the T1 finding; got: ${findings.map((f) => f.title).join(' | ')}`);
      assert.match(findings[0].title, /double-submit/);
      assert.equal(findings[0].severity, 'critical');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('proof #37 FP: fragment-only action is skipped, never probed', async () => {
    // Exact retracted case: the form action is a client-side route
    // `/#/photo-wall`; fetch strips the fragment, so the probe would
    // only ever POST the SPA root and read back the static shell.
    // The probe must skip the action without sending a single request.
    const shell = '<!doctype html><html><body>Juice Shop ok</body></html>';
    const calls = [];
    const server = http.createServer((req, res) => {
      calls.push(`${req.method} ${req.url}`);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(shell);
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const base = `http://127.0.0.1:${stub.port}`;
      const stubForms = [{ action: `${base}/#/photo-wall`, inputs: [{ name: 'comment', value: 'hi' }] }];
      // params [] keeps T4 out of this test: the fragment rule is about
      // form actions (T1/T2/T5), not the query-param surface.
      const findings = await probeRace(stubForms, `${base}/`, [], {
        labTargets: `127.0.0.1:${stub.port}`,
        timeoutMs: 3000,
      });
      assert.deepEqual(findings, [], 'fragment-only action must not produce a finding');
      assert.equal(calls.length, 0, 'fragment-only action must not be probed at all');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('proof #37 FP: POST returning the identical static shell is not a race', async () => {
    // Same shell for GET (pre-state) and POST (mutation): the server
    // applied nothing observable, so the keyword match in the static
    // body must not count as a mutation — no burst, no finding.
    const shell = '<!doctype html><html><body>Juice Shop ok</body></html>';
    const calls = [];
    const server = http.createServer((req, res) => {
      calls.push(`${req.method} ${req.url}`);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(shell);
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const base = `http://127.0.0.1:${stub.port}`;
      const stubForms = [{ action: `${base}/submit`, inputs: [{ name: 'qty', value: '1' }] }];
      const findings = await probeRace(stubForms, `${base}/`, [], {
        labTargets: `127.0.0.1:${stub.port}`,
        timeoutMs: 3000,
      });
      assert.deepEqual(findings, [], 'identical static shell must not produce a finding');
      assert.equal(calls.filter((c) => c.startsWith('GET ')).length, 1, 'one pre-state read');
      assert.equal(calls.filter((c) => c.startsWith('POST ')).length, 1, 'one baseline POST, no burst');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('genuine race still fires when the server really applies the mutation', async () => {
    // Stateful stub: GET returns the untouched form page, each POST
    // increments a counter and returns a confirmation that differs
    // from the pre-state — sequential baseline 1x, burst 8x.
    const calls = [];
    let count = 0;
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        calls.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.method === 'GET') res.end(JSON.stringify({ count, form: 'buy' }));
        else {
          count += 1;
          res.end(JSON.stringify({ ok: true, purchased: true, count }));
        }
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const base = `http://127.0.0.1:${stub.port}`;
      const stubForms = [{ action: `${base}/submit`, inputs: [{ name: 'qty', value: '1' }] }];
      const findings = await probeRace(stubForms, `${base}/`, [], {
        labTargets: `127.0.0.1:${stub.port}`,
        timeoutMs: 3000,
      });
      assert.equal(count, 9, `expected 1 baseline + 8 burst POSTs, got ${count}`);
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
