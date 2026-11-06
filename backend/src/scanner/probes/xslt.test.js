// Tests for the XSLT probe (#47).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeXslt } from './xslt.js';

describe('xslt probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const xsl = u.searchParams.get('xsl') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Vulnerable stub: "executes" arithmetic stylesheets.
      if (xsl.includes('1336*7')) {
        res.end('<html>transformed: 9352</html>');
        return;
      }
      if (xsl.includes('DMXSLT-BASELINE')) {
        res.end('<html>transformed: DMXSLT-BASELINE</html>');
        return;
      }
      res.end('<html>no transform</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('confirms stylesheet execution via arithmetic oracle', async () => {
    const findings = await probeXslt(`${base()}/t`, ['xsl'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const exec = findings.find((f) => f.class === 'xslt_injection');
    assert.ok(exec, 'expected XSLT execution finding');
    assert.equal(exec.severity, 'high');
    assert.ok(exec.evidence.response.includes('9352'), 'D2 evidence must quote the transformed output verbatim');
  });

  it('D7 quotes the processor string verbatim', async () => {
    const smelly = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>Error: libxslt failed to parse stylesheet at line 12</html>');
    });
    await new Promise((r) => smelly.listen(0, '127.0.0.1', r));
    const p = smelly.address().port;
    try {
      const findings = await probeXslt(`http://127.0.0.1:${p}/page`, ['q'], { timeoutMs: 8000 });
      const f = findings.find((x) => x.id.startsWith('xslt-err-'));
      assert.ok(f, `expected D7 error-smell finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'medium');
      assert.ok(f.evidence.response.includes('libxslt'), 'D7 evidence must quote the processor string verbatim');
    } finally {
      await new Promise((r) => smelly.close(r));
    }
  });

  it('D7 stays silent on a plain HTML page with only a stylesheet link', async () => {
    // Regression: DVWA re-validation hunt h_f97a2641dfe6 emitted a D7
    // MEDIUM finding whose evidence was just the login page HTML —
    // the old D7 regex matched "stylesheet" in
    // <link rel="stylesheet" ...>, naming no XSLT processor.
    const login = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>Login :: Damn Vulnerable Web Application (DVWA) v1.10 *Development*</title>\n\n\t\t<link rel="stylesheet" type="text/css" href="dvwa/css/login.css" />\n\n\t</head>\n\n\t<body>\n\n\t<div id="wrapper">\n\n\t<div id="head">\n\n\t</div></body></html>');
    });
    await new Promise((r) => login.listen(0, '127.0.0.1', r));
    const p = login.address().port;
    try {
      const findings = await probeXslt(`http://127.0.0.1:${p}/login.php`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.id.startsWith('xslt-err-')), `stylesheet <link> must not fire D7, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.deepEqual(findings, []);
    } finally {
      await new Promise((r) => login.close(r));
    }
  });

  it('D7 fires on a Saxon processor token, not just libxslt', async () => {
    const saxon = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>Error: net.sf.saxon.Transform failed to compile stylesheet</html>');
    });
    await new Promise((r) => saxon.listen(0, '127.0.0.1', r));
    const p = saxon.address().port;
    try {
      const findings = await probeXslt(`http://127.0.0.1:${p}/page`, ['q'], { timeoutMs: 8000 });
      const f = findings.find((x) => x.id.startsWith('xslt-err-'));
      assert.ok(f, `expected D7 error-smell finding for Saxon, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'medium');
      assert.ok(f.evidence.response.includes('saxon'), 'D7 evidence must quote the processor string verbatim');
    } finally {
      await new Promise((r) => saxon.close(r));
    }
  });

  it('D2 xml-body fires only when the baseline is clean', async () => {
    const xml = http.createServer((req, res) => {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end('<root/>');
        return;
      }
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        if (raw.includes('1336*7')) res.end('<root>9352</root>');
        else res.end('<root>baseline</root>');
      });
    });
    await new Promise((r) => xml.listen(0, '127.0.0.1', r));
    const p = xml.address().port;
    try {
      const findings = await probeXslt(`http://127.0.0.1:${p}/feed.xml`, ['q'], { timeoutMs: 8000 });
      const f = findings.find((x) => x.id.startsWith('xslt-exec-'));
      assert.ok(f, `expected xml-body D2 finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes('9352'), 'xml-body D2 evidence must quote the output verbatim');
    } finally {
      await new Promise((r) => xml.close(r));
    }
  });

  it('D2 xml-body stays silent when the baseline also carries 9352', async () => {
    const noisy = http.createServer((req, res) => {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end('<root/>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end('<root>9352</root>');
    });
    await new Promise((r) => noisy.listen(0, '127.0.0.1', r));
    const p = noisy.address().port;
    try {
      const findings = await probeXslt(`http://127.0.0.1:${p}/feed.xml`, ['q'], { timeoutMs: 8000 });
      assert.ok(!findings.some((x) => x.id.startsWith('xslt-exec-')), 'baseline 9352 must gate xml-body D2');
    } finally {
      await new Promise((r) => noisy.close(r));
    }
  });

  it('exits clean with no XSLT surface', async () => {
    const findings = await probeXslt(`${base()}/t`, ['q'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
