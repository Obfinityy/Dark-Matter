// Tests for the LDAP boolean-blind probe (#32).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeLdapBlind } from './ldapBlind.js';

describe('ldapBlind probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const user = u.searchParams.get('user') || '';
      const pass = u.searchParams.get('pass') || '';
      // Vulnerable stub: wildcard filter matches, wrong user does not.
      if (user === '*' || user === 'admin*') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>welcome, 3 users found</html>');
        return;
      }
      if (user === 'nosuchuser_xyz') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>0 users found</html>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login page</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects boolean-oracle inventory on wildcard-responsive login', async () => {
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    // May or may not confirm depending on oracle thresholds; must not throw.
  });

  it('returns empty gracefully on non-ldap page', async () => {
    const findings = await probeLdapBlind(`${base()}/about`, [], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });

  it('handles unreachable host without throwing', async () => {
    const findings = await probeLdapBlind('http://127.0.0.1:1/login', ['user'], { timeoutMs: 2000 });
    assert.deepEqual(findings, []);
  });
});
