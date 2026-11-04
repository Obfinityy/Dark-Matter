// Tests for the user enumeration probe (#45).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeUserEnum } from './userEnum.js';

describe('userEnum probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/login') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const user = params.get('username') || '';
          res.writeHead(200, { 'Content-Type': 'text/html' });
          // Vulnerable stub: distinct messages for valid vs invalid user.
          if (user === 'canaryuser') res.end('<html>Invalid password for canaryuser</html>');
          else res.end('<html>User not found</html>');
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects login oracle distinguishing valid users', async () => {
    const forms = [{
      action: `${base()}/login`,
      inputs: [{ name: 'username' }, { name: 'password', type: 'password' }],
    }];
    const findings = await probeUserEnum(forms, base(), {
      labCreds: { username: 'canaryuser', password: 'x' },
      timeoutMs: 8000,
    });
    assert.ok(Array.isArray(findings));
    const oracle = findings.find((f) => f.class === 'user_enumeration');
    assert.ok(oracle, 'expected enumeration finding on oracle stub');
    assert.equal(oracle.severity, 'medium');
  }, { timeout: 60000 });

  it('degrades honestly without a valid-user anchor', async () => {
    const forms = [{
      action: `${base()}/login`,
      inputs: [{ name: 'username' }, { name: 'password', type: 'password' }],
    }];
    const findings = await probeUserEnum(forms, base(), { timeoutMs: 5000 });
    assert.deepEqual(findings, [], 'no anchor => no differential');
  });
});
