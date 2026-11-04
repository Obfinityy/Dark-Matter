// Tests for the tabnabbing probe (#51). Pure static analysis.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeTabnabbing } from './tabnabbing.js';

describe('tabnabbing probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (u.pathname === '/vuln') {
        res.end('<html><a href="https://external.example/" target="_blank">out</a></html>');
      } else if (u.pathname === '/safe') {
        res.end('<html><a href="https://external.example/" target="_blank" rel="noopener">out</a></html>');
      } else if (u.pathname === '/nofollow') {
        // nofollow does NOT harden — must still flag.
        res.end('<html><a href="https://external.example/" target="_blank" rel="nofollow">out</a></html>');
      } else {
        res.end('<html><p>no links</p></html>');
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('flags external target=_blank without noopener (MEDIUM)', async () => {
    const findings = await probeTabnabbing(`${base()}/vuln`, { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'tabnabbing');
    assert.equal(findings[0].severity, 'medium');
  });

  it('stays silent when rel=noopener is present', async () => {
    const findings = await probeTabnabbing(`${base()}/safe`, { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('still flags rel=nofollow (trap: nofollow != noopener)', async () => {
    const findings = await probeTabnabbing(`${base()}/nofollow`, { timeoutMs: 5000 });
    assert.equal(findings.length, 1, 'nofollow must not count as hardened');
  });

  it('exits clean with no opener sinks', async () => {
    const findings = await probeTabnabbing(`${base()}/plain`, { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
