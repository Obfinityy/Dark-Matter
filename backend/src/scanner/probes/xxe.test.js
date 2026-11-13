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
import { probeXxe, buildDocx, ooxmlDocumentXmlMalicious, ooxmlDocumentXmlControl, assessXxeFile, buildZip, crc32 } from './xxe.js';
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

// Stub D — file-resolving XML/SOAP endpoint: resolves a SYSTEM
// file:///etc/passwd entity by inlining fake passwd content, expands
// internal entities, never fetches external URLs. Records requests.
function fileResolveHandler(records = []) {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const xml = await readBody(req);
    records.push({ headers: req.headers, body: xml });
    const sys = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"file:\/\/\/etc\/passwd">/.exec(xml);
    if (sys) {
      const out = xml.replace(new RegExp(`&${sys[1]};`, 'g'), 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`parsed: ${out}`);
      return;
    }
    const defs = {};
    for (const m of xml.matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)">/g)) defs[m[1]] = m[2];
    const out = xml.replace(/&(\w+);/g, (s, n) => (n in defs ? defs[n] : s));
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`parsed: ${out}`);
  };
}

// Stub E — reflecting endpoint: echoes the submitted XML verbatim —
// the entity DECLARATION is reflected, but nothing is ever resolved,
// so no file leg may confirm on it.
function reflectHandler(records = []) {
  return async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>stub</body></html>'); return; }
    const xml = await readBody(req);
    records.push({ headers: req.headers, body: xml });
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`echo: ${xml}`);
  };
}

// Stub F — OOXML upload endpoint: serves an upload form, accepts a
// .docx, and (when resolve=true) "processes" it with an XXE-capable
// parser: a SYSTEM file entity in word/document.xml inlines fake
// passwd content into the extracted text. When direct=true the root
// line is in the upload response; otherwise only at the disclosed
// /files/<name> URL (fetch-back path). When resolve=false the parser
// is strict: uploads are accepted but entities are never resolved.
function ooxmlUploadStub({ resolve = true, direct = true } = {}) {
  const files = new Map();
  const uploads = [];
  const handler = async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><form action="/upload" method="post" enctype="multipart/form-data"><input type="file" name="file"><input type="submit" value="Upload"></form></body></html>');
      return;
    }
    if (req.method === 'GET' && u.pathname.startsWith('/files/')) {
      const text = files.get(u.pathname.slice(7));
      if (text === undefined) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(text);
      return;
    }
    if (req.method === 'POST' && u.pathname === '/upload') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('latin1');
      uploads.push(raw);
      const name = (/filename="([^"]+)"/.exec(raw) || [])[1] || 'upload.docx';
      const hasSystemFile = /<!ENTITY\s+\w+\s+SYSTEM\s+"file:\/\/\/etc\/passwd">/.test(raw);
      const extracted = (resolve && hasSystemFile)
        ? 'extracted text:\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin'
        : 'extracted text:\nhello from the document';
      files.set(name, extracted);
      let resp = `upload ok: ${name}\nfile at /files/${name}\n`;
      if (direct) resp += `${extracted}\n`;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(resp);
      return;
    }
    res.writeHead(404); res.end();
  };
  return { handler, files, uploads };
}

describe('xxe pure helpers (file legs)', () => {
  it('crc32 matches the known vector', () => {
    assert.equal(crc32(Buffer.from('123456789', 'ascii')), 0xCBF43926);
  });

  it('buildZip writes a deterministic stored zip', () => {
    const z1 = buildZip([{ name: 'a.txt', data: 'hello' }]);
    const z2 = buildZip([{ name: 'a.txt', data: 'hello' }]);
    assert.deepEqual(z1, z2, 'same input must give byte-identical output');
    assert.equal(z1.subarray(0, 4).toString('latin1'), 'PK\x03\x04');
    assert.ok(z1.includes('a.txt'));
    assert.ok(z1.includes('hello'));
    assert.ok(z1.includes('PK\x05\x06'), 'end-of-central-directory record present');
  });

  it('buildDocx carries the malicious document.xml; the control has no DOCTYPE', () => {
    const evil = buildDocx(ooxmlDocumentXmlMalicious());
    const ctrl = buildDocx(ooxmlDocumentXmlControl());
    assert.ok(evil.includes('<!ENTITY dmxxefile SYSTEM "file:///etc/passwd">'));
    assert.ok(evil.includes('[Content_Types].xml'));
    assert.ok(evil.includes('word/document.xml'));
    assert.ok(!ctrl.includes('<!ENTITY'));
    assert.ok(!ctrl.includes('<!DOCTYPE'));
    assert.ok(ctrl.includes('dm-control'));
  });

  it('assessXxeFile: confirmed only on root line, absent from control, repeat-stable', () => {
    const probe = 'parsed: root:x:0:0:root:/root:/bin/bash';
    assert.equal(assessXxeFile({ control: 'parsed ok', probe, repeat: probe }).verdict, 'confirmed');
    assert.equal(assessXxeFile({ control: probe, probe, repeat: probe }).verdict, 'rejected');
    assert.equal(assessXxeFile({ control: 'parsed ok', probe: 'parsed ok', repeat: probe }).verdict, 'rejected');
    assert.equal(assessXxeFile({ control: 'parsed ok', probe, repeat: 'parsed ok' }).verdict, 'unconfirmed');
    assert.equal(assessXxeFile({ control: '', probe, repeat: probe }).verdict, 'unconfirmed');
    const judged = assessXxeFile({ control: 'parsed ok', probe, repeat: probe });
    assert.equal(judged.match, 'root:x:0:0:root:/root:/bin/bash');
  });
});

describe('xxe classic file disclosure (leg c, row #301)', () => {
  const labOpts = { timeoutMs: 3000, labTargets: '127.0.0.1' };

  it('CONFIRMS xxe_file (high) when the parser resolves the SYSTEM file entity', async () => {
    const stub = await startStub(); stub.setHandler(fileResolveHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_file'), `expected xxe_file, got ${classes}`);
      const f = findings.find((x) => x.class === 'xxe_file');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.signalCorrelated, true);
      assert.ok(f.evidence.response.includes('root:x:0:0'), 'evidence must quote the matched root-line fragment');
      assert.ok(!f.evidence.response.includes('daemon:x:1:1'), 'evidence must quote ONLY the matched fragment, never a file dump');
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe_file'), 'xxe_file must verify confirmed');
      assert.equal(assessConfirmation(f).verdict, 'confirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: reflection of the entity declaration does NOT confirm', async () => {
    const stub = await startStub(); stub.setHandler(reflectHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xxe_file'), `reflection must not confirm xxe_file, got ${classes}`);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: strict parser stays silent', async () => {
    const stub = await startStub(); stub.setHandler(strictHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no SYSTEM file payload leaves toward a non-lab host', async () => {
    const records = [];
    const stub = await startStub(); stub.setHandler(fileResolveHandler(records));
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '' });
      assert.ok(!findings.some((f) => f.class === 'xxe_file'), 'gate closed: no xxe_file');
      assert.ok(!records.some((r) => r.body.includes('SYSTEM "file:')), 'gate closed: the SYSTEM file payload must never be sent');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});

describe('xxe SOAP envelope file disclosure (leg d, row #304)', () => {
  const labOpts = { timeoutMs: 3000, labTargets: '127.0.0.1' };

  it('CONFIRMS xxe_soap (high) when the SOAP parser resolves the SYSTEM file entity', async () => {
    const records = [];
    const stub = await startStub(); stub.setHandler(fileResolveHandler(records));
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_soap'), `expected xxe_soap, got ${classes}`);
      const f = findings.find((x) => x.class === 'xxe_soap');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.signalCorrelated, true);
      const soapReq = records.find((r) => r.body.includes('soap:Envelope'));
      assert.ok(soapReq, 'the probe must send a SOAP envelope');
      assert.ok(String(soapReq.headers['content-type'] || '').includes('text/xml'), 'SOAP body must be text/xml');
      assert.ok(soapReq.headers.soapaction, 'SOAP body must carry a SOAPAction header');
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe_soap'), 'xxe_soap must verify confirmed');
      assert.equal(assessConfirmation(f).verdict, 'confirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: reflection of the SOAP envelope does NOT confirm', async () => {
    const stub = await startStub(); stub.setHandler(reflectHandler());
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      const classes = findings.map((f) => f.class);
      assert.ok(!classes.includes('xxe_soap'), `reflection must not confirm xxe_soap, got ${classes}`);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: no SOAP file payload leaves toward a non-lab host', async () => {
    const records = [];
    const stub = await startStub(); stub.setHandler(fileResolveHandler(records));
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '' });
      assert.ok(!findings.some((f) => f.class === 'xxe_soap'), 'gate closed: no xxe_soap');
      assert.ok(!records.some((r) => r.body.includes('soap:Envelope') && r.body.includes('SYSTEM "file:')), 'gate closed: the SOAP file payload must never be sent');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});

describe('xxe OOXML file disclosure (leg e, row #304)', () => {
  const labOpts = { timeoutMs: 3000, labTargets: '127.0.0.1', allowWrite: true };

  it('CONFIRMS xxe_ooxml (high) when the document parser resolves the SYSTEM file entity (direct path)', async () => {
    const up = ooxmlUploadStub({ resolve: true, direct: true });
    const stub = await startStub(); stub.setHandler(up.handler);
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      const classes = findings.map((f) => f.class);
      assert.ok(classes.includes('xxe_ooxml'), `expected xxe_ooxml, got ${classes}`);
      const f = findings.find((x) => x.class === 'xxe_ooxml');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.signalCorrelated, true);
      assert.ok(f.evidence.response.includes('root:x:0:0'), 'evidence must quote the matched root-line fragment');
      const { confirmed } = verifyFindings(findings);
      assert.ok(confirmed.some((x) => x.class === 'xxe_ooxml'), 'xxe_ooxml must verify confirmed');
      assert.equal(assessConfirmation(f).verdict, 'confirmed');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('CONFIRMS xxe_ooxml via the fetch-back path when the upload response only discloses the file URL', async () => {
    const up = ooxmlUploadStub({ resolve: true, direct: false });
    const stub = await startStub(); stub.setHandler(up.handler);
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      assert.ok(findings.some((f) => f.class === 'xxe_ooxml'), `expected xxe_ooxml via fetch-back, got ${findings.map((f) => f.class)}`);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: strict document parser stays silent', async () => {
    const up = ooxmlUploadStub({ resolve: false, direct: true });
    const stub = await startStub(); stub.setHandler(up.handler);
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      assert.ok(!findings.some((f) => f.class === 'xxe_ooxml'), `strict parser must not confirm, got ${findings.map((f) => f.class)}`);
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('NEGATIVE: no upload form on the page means no OOXML leg at all', async () => {
    const up = ooxmlUploadStub({ resolve: true, direct: true });
    const stub = await startStub();
    stub.setHandler(async (req, res) => {
      if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>no forms here</body></html>'); return; }
      res.writeHead(404); res.end();
    });
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, labOpts);
      assert.ok(!findings.some((f) => f.class === 'xxe_ooxml'), 'no form means no OOXML leg');
      assert.equal(up.uploads.length, 0, 'no form means no upload was attempted');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: allowWrite false means no upload is attempted', async () => {
    const up = ooxmlUploadStub({ resolve: true, direct: true });
    const stub = await startStub(); stub.setHandler(up.handler);
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '127.0.0.1', allowWrite: false });
      assert.ok(!findings.some((f) => f.class === 'xxe_ooxml'), 'gate closed: no xxe_ooxml');
      assert.equal(up.uploads.length, 0, 'gate closed: no file was uploaded');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });

  it('lab gate: non-lab host means no upload is attempted even with allowWrite', async () => {
    const up = ooxmlUploadStub({ resolve: true, direct: true });
    const stub = await startStub(); stub.setHandler(up.handler);
    try {
      const findings = await probeXxe(`http://127.0.0.1:${stub.port}/`, { timeoutMs: 3000, labTargets: '', allowWrite: true });
      assert.ok(!findings.some((f) => f.class === 'xxe_ooxml'), 'gate closed: no xxe_ooxml');
      assert.equal(up.uploads.length, 0, 'gate closed: no file was uploaded');
    } finally {
      await new Promise((r) => stub.server.close(r));
    }
  });
});
