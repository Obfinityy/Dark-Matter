// Tests for the blind-XSS probe (coverage row #113 [High]) —
// the OOB leg the re-proof batch 2 found missing (14 Nov 2026).
// The executing-renderer stub mimics the context the scanner never
// visits (e.g. an admin panel): when a submitted value carries a
// fetch() to a collaborator URL, the stub fetches it — the fetch
// landing on the collaborator is the blind-XSS signal. The probe
// confirms it in-scan (xss_blind_oob, high) only when the waiter
// sees the hit. A bare reflection of the payload proves nothing —
// no fetch happens — so the reflect-only stub must stay silent.
// No live backend touched; all canary URLs are per-run tokens.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeBlindXss } from './blindXss.js';
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

// The fetch URL the payload carries, if any — the value as submitted,
// URL-decoded via URLSearchParams (the probe POSTs urlencoded bodies).
function fetchUrlFromBody(raw) {
  const params = new URLSearchParams(raw);
  for (const value of params.values()) {
    const m = String(value).match(/fetch\(\s*['"]([^'"]+)['"]\s*\)/);
    if (m) return m[1];
  }
  return null;
}

function formsFor(port) {
  return [{
    action: `http://127.0.0.1:${port}/submit`,
    method: 'post',
    inputs: ['comment', 'name'],
  }];
}

// Stub A — executing renderer: any submitted fetch() URL gets fetched
// (the blind-XSS signal), then answers 200. Never reflects the payload,
// so a bare-reflection credit is impossible on it.
function executingHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const raw = await readBody(req);
    const url = fetchUrlFromBody(raw);
    if (url) {
      // The fetch IS the signal; its success/failure changes nothing.
      try { await fetch(url, { signal: AbortSignal.timeout(2000) }); } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('stored ok');
  };
}

// Stub B — strict endpoint: stores nothing, executes nothing.
function strictHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    await readBody(req);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('stored ok');
  };
}

// Stub C — reflect-only endpoint: echoes the submitted values verbatim
// in the POST response, but never fetches anything. Reflection alone
// must NOT confirm blind XSS.
function reflectHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const raw = await readBody(req);
    const params = new URLSearchParams(raw);
    const echoed = [...params.values()].join(' | ');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body>received: ${echoed}</body></html>`);
  };
}

describe('blind XSS OOB collaborator', () => {
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

  it('CONFIRMS xss_blind_oob (high) when the payload executes out-of-band', async () => {
    const stub = await startStub(); stub.setHandler(executingHandler());
    try {
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, oobOpts());
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xss_blind_oob'), `expected xss_blind_oob, got ${classes}`);
      assert.ok(!classes.includes('xss_blind_oob_sent'), 'waiter path must not emit the unconfirmed sent record');
      // One finding per probed input (comment + name), each with its own token.
      assert.equal(findings.filter((f) => f.class === 'xss_blind_oob').length, 2);
      const f = findings.find((x) => x.class === 'xss_blind_oob');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.oobHit, true);
      assert.ok(f.evidence.signalCorrelated === true);
      assert.ok(f.evidence.response.includes('bxss-'), 'evidence must name the callback token');
      assert.ok(f.evidence.response.includes('collaborator received'), 'evidence must show the callback receipt');
      assert.ok(f.evidence.request.includes('fetch('), 'evidence must show the executing payload');
      // The differential verifier judges xss_blind_oob under the SSRF/OOB
      // protocol (oobHit) — confirmed, never unconfirmed.
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xss_blind_oob'), 'xss_blind_oob must verify confirmed');
      assert.ok(!unconfirmed.some((x) => x.class === 'xss_blind_oob'), 'must not also sit in unconfirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: no xss_blind_oob when the payload never executes', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, oobOpts({ oobWaitTimeoutMs: 500 }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xss_blind_oob'), `unexpected xss_blind_oob in ${classes}`);
      assert.ok(!classes.includes('xss_blind_oob_sent'), 'waiter path must stay silent on a miss');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('REFLECTION control: verbatim reflection without execution stays silent', async () => {
    const stub = await startStub(); stub.setHandler(reflectHandler());
    try {
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, oobOpts({ oobWaitTimeoutMs: 500 }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xss_blind_oob'), `reflection must never confirm blind XSS, got ${classes}`);
      assert.ok(!classes.includes('xss_blind_oob_sent'), 'waiter path must stay silent on reflection alone');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no OOB finding at all when the host is not lab-gated', async () => {
    const stub = await startStub(); stub.setHandler(executingHandler());
    try {
      const hitsBefore = collab.hits.length;
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, oobOpts({ labTargets: '' }));
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xss_blind_oob'), `unexpected xss_blind_oob in ${classes}`);
      assert.ok(!classes.includes('xss_blind_oob_sent'), `unexpected xss_blind_oob_sent in ${classes}`);
      assert.equal(collab.hits.length, hitsBefore, 'gate closed: the probe must not send any OOB URL');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('backward compat: string-only oobCallback (no waiter) still emits xss_blind_oob_sent', async () => {
    const stub = await startStub(); stub.setHandler(executingHandler());
    try {
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000, labTargets: '127.0.0.1', oobCallback: baseUrl,
      });
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xss_blind_oob_sent'), `expected xss_blind_oob_sent, got ${classes}`);
      assert.ok(!classes.includes('xss_blind_oob'), 'no waiter means no confirmation');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('differential guard: xss_blind_oob is judged on oobHit, xss_blind_oob_sent is not', async () => {
    // The _oob class takes the SSRF/OOB protocol: hit → confirmed,
    // explicit miss → rejected.
    assert.equal(assessConfirmation({ class: 'xss_blind_oob', evidence: { oobHit: true } }).verdict, 'confirmed');
    assert.equal(assessConfirmation({ class: 'xss_blind_oob', evidence: { oobHit: false } }).verdict, 'rejected');
    // The _sent dispatch record must NOT take that path: with oobHit
    // false and no signal it stays unconfirmed (default protocol), which
    // is exactly the endsWith('oob') guard in differential.js.
    assert.equal(assessConfirmation({ class: 'xss_blind_oob_sent', evidence: { oobHit: false } }).verdict, 'unconfirmed');
  });

  it('unreachable target: OOB variant skipped without ever waiting', async () => {
    let waiterCalls = 0;
    const findings = await probeBlindXss(
      [{ action: 'http://127.0.0.1:1/submit', method: 'post', inputs: ['comment'] }],
      'http://127.0.0.1:1/',
      {
        timeoutMs: 800,
        labTargets: '127.0.0.1',
        oobCallback: baseUrl,
        oobWaitFor: () => { waiterCalls++; return Promise.resolve(null); },
        oobWaitTimeoutMs: 500,
      },
    );
    assert.deepEqual(findings, []);
    assert.equal(waiterCalls, 0, 'target down: the probe must not wait for a hit that cannot come');
  });

  it('emits nothing without a callback, even on an executing renderer', async () => {
    const stub = await startStub(); stub.setHandler(executingHandler());
    try {
      const findings = await probeBlindXss(formsFor(stub.port), `http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '127.0.0.1' });
      assert.deepEqual(findings, [], 'no oobCallback means no OOB variant at all');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('emits nothing when there are no forms', async () => {
    const stub = await startStub(); stub.setHandler(executingHandler());
    try {
      const findings = await probeBlindXss([], `http://127.0.0.1:${stub.port}/`, oobOpts());
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});
