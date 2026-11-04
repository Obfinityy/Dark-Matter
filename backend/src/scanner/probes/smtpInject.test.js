// Tests for the SMTP injection probe (#43).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSmtpInject } from './smtpInject.js';

describe('smtpInject probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url.startsWith('/contact')) {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const name = params.get('name') || '';
          // Vulnerable stub: reflects the raw name incl. injected header.
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html>thanks ${name}, mail queued</html>`);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>contact form</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects newline passthrough on contact form', async () => {
    const forms = [{
      action: `${base()}/contact`,
      inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
    }];
    const findings = await probeSmtpInject(forms, base(), { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const pt = findings.find((f) => f.class === 'smtp_injection');
    assert.ok(pt, 'expected passthrough finding on reflecting stub');
    assert.equal(pt.severity, 'medium');
  });

  it('stays silent with no email forms', async () => {
    const findings = await probeSmtpInject([], base(), { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
