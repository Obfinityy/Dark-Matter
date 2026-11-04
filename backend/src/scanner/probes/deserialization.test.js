// Tests for the deserialization probe (#36).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeDeserialization } from './deserialization.js';

describe('deserialization probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      // Sets a PHP-serialized cookie.
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'session=a:2:{s:4:"user";s:5:"admin";s:4:"role";s:4:"user";}; Path=/',
      });
      res.end('<html>ok</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fingerprints serialized formats passively (INFO)', async () => {
    const findings = await probeDeserialization(base(), { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const fmt = findings.find((f) => f.id.startsWith('ds-fmt-'));
    assert.ok(fmt, 'expected format-fingerprint finding');
    assert.equal(fmt.severity, 'low');
  });

  it('returns array on plain page without serialized data', async () => {
    const findings = await probeDeserialization('http://127.0.0.1:1/', { timeoutMs: 2000 });
    assert.ok(Array.isArray(findings));
  });
});
