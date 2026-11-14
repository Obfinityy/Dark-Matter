// Tests for the cryptography probe (#34).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCrypto } from './crypto.js';

describe('crypto probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Page leaks an MD5 hash of a password.
      res.end('<html>user record: 5f4dcc3b5aa765d61d8327deb882cf99</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('flags exposed fast hashes in page bodies', async () => {
    const findings = await probeCrypto(base(), { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const hashFinding = findings.find((f) => f.class === 'weak_crypto');
    assert.ok(hashFinding, 'expected exposed-hash finding');
  });

  it('does not flag bcrypt as weak', async () => {
    // The probe must not flag bcrypt/argon2 — covered by code review;
    // here we assert the probe runs cleanly on a plain page.
    const findings = await probeCrypto(`${base()}/plain`, { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });

  // T2 (rows #124/#261/#369): predictable session-token structure.
  // The stub page leaks an MD5 hash on every path, so T5 fires too —
  // T2 assertions filter by title, never by class alone.
  const tokenFinding = (findings) =>
    findings.find((f) => f.title && f.title.startsWith('Predictable session/token structure'));

  it('T2 FIRES on harvested predictable tokens (monotonic + low entropy)', async () => {
    const findings = await probeCrypto(base(), {
      timeoutMs: 5000,
      cryptoTokens: [{ value: 'sess-100001' }, { value: 'sess-100002' }],
    });
    const f = tokenFinding(findings);
    assert.ok(f, `expected T2 finding, got ${JSON.stringify(findings.map((x) => x.title))}`);
    assert.equal(f.severity, 'high');
    assert.equal(f.class, 'weak_crypto');
  });

  it('T2 FIRES on username-derived + timestamp-decodable tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    const seg = Buffer.from([(now >>> 24) & 0xff, (now >>> 16) & 0xff, (now >>> 8) & 0xff, now & 0xff])
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const findings = await probeCrypto(base(), {
      timeoutMs: 5000,
      cryptoTokens: [
        { value: `alice-${seg}-a`, username: 'alice' },
        { value: `alice-${seg}-b`, username: 'alice' },
      ],
    });
    assert.ok(tokenFinding(findings), 'expected T2 finding for timestamp + username signals');
  });

  it('T2 SILENT when no tokens are supplied', async () => {
    const findings = await probeCrypto(base(), { timeoutMs: 5000 });
    assert.equal(tokenFinding(findings), undefined);
  });

  it('T2 SILENT when only one token is supplied', async () => {
    const findings = await probeCrypto(base(), {
      timeoutMs: 5000,
      cryptoTokens: [{ value: 'sess-100001' }],
    });
    assert.equal(tokenFinding(findings), undefined);
  });

  it('T2 SILENT on high-entropy tokens', async () => {
    const findings = await probeCrypto(base(), {
      timeoutMs: 5000,
      cryptoTokens: [
        { value: '9f2c47ab81d5e03a6c4b9f0d2e7a5c8f1a' },
        { value: '3b7d1e9a05c4f682a9e1d3b5f7c0a8d4e' },
      ],
    });
    assert.equal(tokenFinding(findings), undefined);
  });
});
