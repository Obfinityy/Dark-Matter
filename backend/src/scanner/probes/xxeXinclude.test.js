// Tests for the XXE — XInclude probe (row #500 [High] XXE —
// XInclude file inclusion, CWE-611; phase 'xxe-xinclude').
//
// The probe never sends a DOCTYPE or an entity — only <xi:include>.
// Stubs: an XInclude-resolving endpoint (inlines a fetched URL or a
// fake /etc/passwd root line), a strict endpoint (ignores XInclude),
// and an OOB-fetching endpoint (fetches the href URL). The canary
// content server serves a known marker the probe must see reflected.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeXxeXinclude,
  xincludePayload,
  xincludeFilePayload,
  xincludeControlPayload,
  assessXincludeReflection,
  assessXincludeFile,
  __xxeXincludeMeta,
} from './xxeXinclude.js';
import { createOobCollaborator } from '../oobCollaborator.js';
import { verifyFindings } from '../verifier.js';

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

const MARKER = 'DMXINC123';
const PASSWD_LINE = 'root:x:0:0:root:/root:/bin/bash';

// Resolving stub: inlines the href target — an http(s) URL is fetched
// and its body inlined; file:///etc/passwd inlines a fake root line.
function resolvingHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200); res.end('stub'); return; }
    const xml = await readBody(req);
    const href = (xml.match(/<xi:include[^>]*href="([^"]+)"/) || [])[1];
    let included = '';
    if (href) {
      if (href === 'file:///etc/passwd') included = `${PASSWD_LINE}\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin`;
      else if (/^https?:\/\//.test(href)) {
        try {
          const r = await fetch(href, { signal: AbortSignal.timeout(2000) });
          included = await r.text();
        } catch { included = ''; }
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`parsed: ${included}`);
  };
}

// Strict stub: never resolves, never fetches.
function strictHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200); res.end('stub'); return; }
    await readBody(req);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('parsed ok');
  };
}

// OOB stub: fetches the href URL (the blind signal), never inlines.
function oobFetchHandler() {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200); res.end('stub'); return; }
    const xml = await readBody(req);
    const href = (xml.match(/<xi:include[^>]*href="([^"]+)"/) || [])[1];
    if (href && /^https?:\/\//.test(href)) {
      try { await fetch(href, { signal: AbortSignal.timeout(2000) }); } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('parsed ok');
  };
}

describe('xxe-xinclude probe', () => {
  let canary;
  let canaryPort;
  let collab;
  let collabBase;

  before(async () => {
    canary = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`canary file contents: ${MARKER}`);
    });
    await new Promise((r) => canary.listen(0, '127.0.0.1', r));
    canaryPort = canary.address().port;
    collab = createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
    collabBase = await collab.start();
  });

  after(async () => {
    await collab.stop();
    await new Promise((r) => canary.close(r));
  });

  const canaryUrl = () => `http://127.0.0.1:${canaryPort}/canary.txt`;

  it('CONFIRMS via canary content inclusion (marker reflected, control clean)', async () => {
    const stub = await startStub(); stub.setHandler(resolvingHandler());
    try {
      const findings = await probeXxeXinclude(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000,
        xincludeCanaryUrl: canaryUrl(),
        xincludeCanaryMarker: MARKER,
      });
      assert.equal(findings.length, 1);
      const f = findings[0];
      assert.equal(f.class, 'xxe_xinclude');
      assert.equal(f.id, 'xxe-xinclude-canary');
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes(MARKER));
      assert.ok(!f.evidence.request.includes('DOCTYPE'), 'XInclude probe must never send a DOCTYPE');
      assert.ok(!f.evidence.request.includes('ENTITY'), 'XInclude probe must never send an entity');
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('CONFIRMS via file inclusion (passwd root line reflected)', async () => {
    const stub = await startStub(); stub.setHandler(resolvingHandler());
    try {
      const findings = await probeXxeXinclude(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000 });
      assert.equal(findings.length, 1);
      const f = findings[0];
      assert.equal(f.class, 'xxe_xinclude');
      assert.equal(f.id, 'xxe-xinclude-file');
      assert.ok(f.evidence.response.includes('root:x:0:0:'));
      const { confirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('CONFIRMS blind XInclude when the parser fetches the collaborator URL', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const findings = await probeXxeXinclude(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000,
        labTargets: '127.0.0.1',
        oobCallback: collabBase,
        oobWaitFor: (token, ms) => collab.waitFor(token, ms),
        oobWaitTimeoutMs: 3000,
      });
      const f = findings.find((x) => x.class === 'xxe_xinclude');
      assert.ok(f, `expected xxe_xinclude, got ${JSON.stringify(findings.map((x) => x.class))}`);
      assert.equal(f.evidence.oobHit, true);
      assert.ok(!findings.some((x) => x.class === 'xxe_xinclude_sent'));
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe_xinclude'));
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('stays silent on a strict parser (all legs)', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeXxeXinclude(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000,
        labTargets: '127.0.0.1',
        xincludeCanaryUrl: canaryUrl(),
        xincludeCanaryMarker: MARKER,
        oobCallback: collabBase,
        oobWaitFor: (token, ms) => collab.waitFor(token, ms),
        oobWaitTimeoutMs: 500,
      });
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no OOB dispatch when the host is not lab-gated', async () => {
    const stub = await startStub(); stub.setHandler(oobFetchHandler());
    try {
      const hitsBefore = collab.hits.length;
      const findings = await probeXxeXinclude(`http://127.0.0.1:${stub.port}/`, {
        timeoutMs: 3000,
        labTargets: '',
        oobCallback: collabBase,
        oobWaitFor: (token, ms) => collab.waitFor(token, ms),
        oobWaitTimeoutMs: 500,
      });
      // The file leg still runs (no OOB involved) but this stub never
      // inlines a file, so nothing may fire — and no OOB hit may land.
      assert.ok(!findings.some((x) => x.class === 'xxe_xinclude' && x.evidence.oobHit));
      assert.equal(collab.hits.length, hitsBefore, 'gate closed: no OOB URL may be sent');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('payload builders carry no DOCTYPE and no entity', () => {
    assert.ok(!xincludePayload('file:///etc/passwd').includes('DOCTYPE'));
    assert.ok(!xincludePayload('http://example.com/x').includes('ENTITY'));
    assert.ok(xincludePayload('file:///etc/passwd').includes('xi:include'));
    assert.ok(xincludePayload('file:///etc/passwd').includes('http://www.w3.org/2001/XInclude'));
    assert.equal(xincludeFilePayload(), xincludePayload('file:///etc/passwd'));
    assert.equal(xincludeControlPayload(), '<r>dm-control</r>');
  });

  it('assessXincludeReflection confirms a full stable leg', () => {
    const v = assessXincludeReflection({
      control: 'parsed ok',
      probe: `parsed: ${MARKER}`,
      repeat: `parsed: ${MARKER}`,
      marker: MARKER,
    });
    assert.equal(v.verdict, 'confirmed');
  });

  it('assessXincludeReflection rejects a marker already in the control', () => {
    const v = assessXincludeReflection({
      control: `parsed: ${MARKER}`,
      probe: `parsed: ${MARKER}`,
      repeat: `parsed: ${MARKER}`,
      marker: MARKER,
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessXincludeFile confirms a stable root-line leg', () => {
    const v = assessXincludeFile({
      control: 'parsed ok',
      probe: `parsed: ${PASSWD_LINE}`,
      repeat: `parsed: ${PASSWD_LINE}`,
    });
    assert.equal(v.verdict, 'confirmed');
    assert.ok(v.match.startsWith('root:x:0:0:'));
  });

  it('assessXincludeFile rejects when the root line is absent', () => {
    const v = assessXincludeFile({ control: 'parsed ok', probe: 'parsed ok', repeat: 'parsed ok' });
    assert.equal(v.verdict, 'rejected');
    assert.equal(v.match, null);
  });

  it('probe meta names the phase and standard/deep depths', () => {
    assert.deepEqual(__xxeXincludeMeta.phases, ['xxe-xinclude']);
    assert.deepEqual(__xxeXincludeMeta.depth, ['standard', 'deep']);
  });

  it('unreachable target returns no findings', async () => {
    const findings = await probeXxeXinclude('http://127.0.0.1:1/', { timeoutMs: 800 });
    assert.deepEqual(findings, []);
  });
});
