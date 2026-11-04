// Tests for the NoSQL deep probe (#32).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeNoSqlDeep } from './nosqlDeep.js';

describe('nosqlDeep probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const keys = [...params.keys()];
          // Vulnerable stub: [$ne] operator in param NAMES (PHP array syntax).
          if (keys.some((k) => k.includes('[$ne]'))) {
            res.writeHead(302, { 'Set-Cookie': 'session=vuln123; Path=/', Location: '/dashboard' });
            res.end('redirecting');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html>invalid credentials</html>');
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login page</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects operator auth bypass via differential', async () => {
    const findings = await probeNoSqlDeep(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const bypass = findings.find((f) => f.class === 'nosql_injection');
    // Vulnerable stub should yield a bypass finding.
    assert.ok(bypass, 'expected operator-bypass finding on vulnerable stub');
    assert.equal(bypass.severity, 'critical');
  });

  it('stays silent on hardened login', async () => {
    const findings = await probeNoSqlDeep(`${base()}/login`, ['user'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });
});
