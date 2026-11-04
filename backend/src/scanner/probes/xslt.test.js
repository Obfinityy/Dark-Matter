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
  });

  it('exits clean with no XSLT surface', async () => {
    const findings = await probeXslt(`${base()}/t`, ['q'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
