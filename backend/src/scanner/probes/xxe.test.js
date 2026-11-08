// Tests for the XXE probe — v1 internal entity expansion (regression)
// and the v2 blind out-of-band variant (6 Nov 2026). The OOB stub mimics
// a vulnerable XML parser: when the DOCTYPE carries an external parameter
// entity it fetches the SYSTEM URL, then answers 200. The fetch landing
// on the collaborator is the blind-XXE signal — the probe confirms it
// in-scan (xxe_oob, high) only when the waiter sees the hit. No live
// backend touched; all canary URLs are per-run tokens.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeXxe } from './xxe.js';
import { createOobCollaborator } from '../oobCollaborator.js';
import { verifyFindings } from '../verifier.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

async function startStub() {
  let handler = (req, res) => { res.writeHead(404); res.end(); };
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, port, setHandler: (h) => { handler = h; } };
}

// Stub A — OOB-fetching XML endpoint: fetches any SYSTEM url in the
// DOCTYPE (the blind-XXE signal), then answers 200. Never expands the
// internal entity, so the v1 finding must NOT fire on it.
function oobFetchHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const xml = await readBody(req);
    const sysUrl = (xml.match(/<!ENTITY\s+%\s+\w+\s+SYSTEM\s+"([^"]+)"/) || [])[1];
    if (sysUrl) {
      // The fetch IS the signal; its success/failure changes nothing.
      try { await fetch(sysUrl, { signal: AbortSignal.timeout(2000) }); } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('parsed ok');
  };
}

// Stub B — strict XML endpoint: never fetches, never expands.
function strictHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    await readBody(req);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('parsed ok');
  };
}

// Stub C — entity-expanding endpoint (v1): resolves the internal entity
// and echoes the expanded value, but never fetches an external URL.
function expandHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const xml = await readBody(req);
    const defs = {};
    for (const m of xml.matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)">/g)) defs[m[1]] = m[2];
    let body = (xml.match(/<r>([^<]*)<\/r>/) || [])[1] || '';
    body = body.replace(/&(\w+);/g, (s, n) => (n in defs ? defs[n] : s));
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`parsed: ${body}`);
  };
}

describe('xxe OOB collaborator', () => {
  let collab;
  let baseUrl;

  before(async () => {
    collab = createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
    baseUrl = await collab.start();
  });

  after(async () => { await collab.stop(); });

  const oobOpts = (extra = {}) => ({
    timeoutMs: 3000,
    labTargets: '127.0.0.1',
    oobCallback: baseUrl,
    oobWaitFor: (token, ms) => collab.waitFor(token, ms),
    oobWaitTimeoutMs: 3000,
    ...extra,
  });

  it('CONFIRMS xxe_oob (high) when the parser fetches the canary URL', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, oobOpts());
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_oob'), `expected xxe_oob, got ${classes}`);
      assert.ok(!classes.includes('xxe_oob_sent'), 'waiter path must not emit the unconfirmed sent record');
      assert.ok(!classes.includes('xxe'), 'stub never expands the internal entity — v1 must stay silent');
      const f = findings.find((x) => x.class === 'xxe_oob');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.oobHit, true);
      assert.ok(f.evidence.signalCorrelated === true);
      assert.ok(f.evidence.response.includes('xxe-oob-'), 'evidence must name the callback token');
      assert.ok(f.evidence.response.includes('collaborator received'), 'evidence must show the callback receipt');
      // The differential verifier judges xxe_oob under the SSRF/OOB
      // protocol (oobHit) — confirmed, never unconfirmed.
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe_oob'), 'xxe_oob must verify confirmed');
      assert.ok(!unconfirmed.some((x) => x.class === 'xxe_oob'), 'must not also sit in unconfirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: no xxe_oob when the parser never fetches the canary URL', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, oobOpts({ oobWaitTimeoutMs: 500 }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xxe_oob'), `unexpected xxe_oob in ${classes}`);
      assert.ok(!classes.includes('xxe_oob_sent'), 'waiter path must stay silent on a miss');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no OOB finding at all when the host is not lab-gated', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const hitsBefore = collab.hits.length;
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, oobOpts({ labTargets: '' }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xxe_oob'), `unexpected xxe_oob in ${classes}`);
      assert.ok(!classes.includes('xxe_oob_sent'), `unexpected xxe_oob_sent in ${classes}`);
      assert.equal(collab.hits.length, hitsBefore, 'gate closed: the probe must not send any OOB URL');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('backward compat: string-only oobCallback (no waiter) still emits xxe_oob_sent', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000, labTargets: '127.0.0.1', oobCallback: baseUrl,
      });
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_oob_sent'), `expected xxe_oob_sent, got ${classes}`);
      assert.ok(!classes.includes('xxe_oob'), 'no waiter means no confirmation');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('differential guard: xxe_oob is judged on oobHit, xxe_oob_sent is not', async () => {
    // The _oob class takes the SSRF/OOB protocol: hit → confirmed,
    // explicit miss → rejected.
    assert.equal(assessConfirmation({ class: 'xxe_oob', evidence: { oobHit: true } }).verdict, 'confirmed');
    assert.equal(assessConfirmation({ class: 'xxe_oob', evidence: { oobHit: false } }).verdict, 'rejected');
    // The _sent dispatch record must NOT take that path: with oobHit
    // false and no signal it stays unconfirmed (default protocol), which
    // is exactly the endsWith('oob') guard in differential.js.
    assert.equal(assessConfirmation({ class: 'xxe_oob_sent', evidence: { oobHit: false } }).verdict, 'unconfirmed');
  });

  it('unreachable target: OOB variant skipped without ever waiting', async () => {
    let waiterCalls = 0;
    const findings = await probeXxe('http://127.0.0.1:1/', {
      timeoutMs: 800,
      labTargets: '127.0.0.1',
      oobCallback: baseUrl,
      oobWaitFor: () => { waiterCalls++; return Promise.resolve(null); },
      oobWaitTimeoutMs: 500,
    });
    assert.deepEqual(findings, []);
    assert.equal(waiterCalls, 0, 'target down: the probe must not wait for a hit that cannot come');
  });
  // isLab follow-up (8 Nov 2026): the old substring gate matched a lab
  // entry that is a PREFIX of the target host (172.17.0.1 vs
  // 172.17.0.10:8080) — fail-open. The canonical helper compares exact
  // canonical hostnames, port-insensitive.
  it('CONFIRMS xxe_oob with PORT-BEARING labTargets (the production shape)', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, oobOpts({ labTargets: `127.0.0.1:${stub.port}` }));
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_oob'), `expected xxe_oob, got ${classes}`);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('near-miss host: no OOB dispatch when the lab entry is a prefix of the target host', async () => {
    const posts = [];
    const origFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      if ((init.method || 'GET') === 'POST') posts.push(String(init.body || ''));
      return { ok: true, status: 200, text: async () => '' };
    };
    try {
      const findings = await probeXxe('http://172.17.0.10:9999/', {
        timeoutMs: 3000,
        labTargets: '172.17.0.1',
        oobCallback: baseUrl,
        oobWaitFor: (token, ms) => collab.waitFor(token, ms),
        oobWaitTimeoutMs: 500,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('<!ENTITY %')), 'a near-miss host must never receive the OOB payload');
    } finally {
      global.fetch = origFetch;
    }
  });

});

describe('xxe internal entity expansion (v1 regression)', () => {
  it('still reports xxe on an expanding parser, with no OOB opts', async () => {
    const stub = await startStub(); stub.setHandler(expandHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000 });
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe'), `expected xxe, got ${classes}`);
      const f = findings.find((x) => x.class === 'xxe');
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.signalCorrelated === true);
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe'), 'v1 xxe must still verify confirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('emits nothing on a strict parser with no OOB opts', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000 });
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('emits no OOB finding without a callback, even on a fetching parser', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '127.0.0.1' });
      assert.deepEqual(findings, [], 'no oobCallback means no OOB variant at all');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});
