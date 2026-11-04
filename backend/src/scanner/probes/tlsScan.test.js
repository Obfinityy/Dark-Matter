// Tests for the TLS / certificate / crypto-transport probe (#125, #129,
// #133, #134, #447, #448-surface, #450, #451).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import http from 'node:http';
import {
  probeTls,
  analyzeCertificate,
  isSelfSigned,
  hostMatchesCert,
  getChainDepth,
  mapStrictHandshakeError,
  isCbcCipher,
} from './tlsScan.js';

// ---- fabricated cert fixtures (pure analysis, no network) ------------------
function fabCert(over = {}) {
  const c = {
    subject: { CN: 'example.com' },
    issuer: { CN: 'Example CA' },
    valid_from: 'Jan  1 00:00:00 2024 GMT',
    valid_to: 'Jan  1 00:00:00 2030 GMT',
    serialNumber: '01AB',
    fingerprint: 'AA:BB',
    subjectaltname: 'DNS:example.com, DNS:www.example.com',
    raw: Buffer.from('fakecert'),
    ...over,
  };
  // issuerCertificate defaults to a distinct CA cert (depth-2 chain).
  if (!('issuerCertificate' in over)) {
    const ca = {
      subject: { CN: 'Example CA' },
      issuer: { CN: 'Example CA' },
      serialNumber: 'CA00',
      raw: Buffer.from('fakeca'),
    };
    ca.issuerCertificate = ca; // root self-reference
    c.issuerCertificate = ca;
  }
  return c;
}

describe('tlsScan pure analysis helpers', () => {
  it('flags an expired certificate (#125)', () => {
    const v = analyzeCertificate(fabCert({ valid_to: 'Jan  1 00:00:00 2020 GMT' }), 'example.com');
    assert.ok(v.some((x) => x.id === 'tls_cert_expired' && x.severity === 'medium'));
  });

  it('flags a self-signed certificate (#125)', () => {
    const self = fabCert({ issuer: { CN: 'example.com' } });
    self.issuerCertificate = self;
    assert.equal(isSelfSigned(self), true);
    const v = analyzeCertificate(self, 'example.com');
    assert.ok(v.some((x) => x.id === 'tls_cert_selfsigned' && x.severity === 'medium'));
  });

  it('does not flag self-signed on a CA-issued cert', () => {
    assert.equal(isSelfSigned(fabCert()), false);
  });

  it('flags a hostname mismatch (#125)', () => {
    const v = analyzeCertificate(fabCert(), 'evil.example.net');
    assert.ok(v.some((x) => x.id === 'tls_cert_hostname_mismatch'));
  });

  it('accepts wildcard SANs', () => {
    assert.equal(hostMatchesCert('api.example.com', fabCert({ subjectaltname: 'DNS:*.example.com' })), true);
    assert.equal(hostMatchesCert('example.com', fabCert({ subjectaltname: 'DNS:*.example.com' })), false);
    assert.equal(hostMatchesCert('a.b.example.com', fabCert({ subjectaltname: 'DNS:*.example.com' })), false);
  });

  it('accepts IP-literal SANs', () => {
    assert.equal(hostMatchesCert('127.0.0.1', fabCert({ subjectaltname: 'IP Address:127.0.0.1' })), true);
    assert.equal(hostMatchesCert('127.0.0.2', fabCert({ subjectaltname: 'IP Address:127.0.0.1' })), false);
  });

  it('flags an incomplete chain: lone leaf, not self-signed (#451)', () => {
    const leaf = fabCert({ issuerCertificate: undefined });
    delete leaf.issuerCertificate; // chain depth 1
    assert.equal(getChainDepth(leaf), 1);
    const v = analyzeCertificate(leaf, 'example.com');
    assert.ok(v.some((x) => x.id === 'tls_cert_chain_incomplete' && x.severity === 'medium'));
  });

  it('does not flag chain-incomplete for a full chain or a self-signed root', () => {
    assert.equal(getChainDepth(fabCert()), 2);
    const self = fabCert({ issuer: { CN: 'example.com' } });
    self.issuerCertificate = self;
    assert.ok(!analyzeCertificate(self, 'example.com').some((x) => x.id === 'tls_cert_chain_incomplete'));
  });

  it('stays silent on a clean, valid cert', () => {
    assert.deepEqual(analyzeCertificate(fabCert(), 'example.com'), []);
  });

  it('maps strict-handshake errors honestly (#451)', () => {
    assert.equal(mapStrictHandshakeError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), 'untrusted');
    assert.equal(mapStrictHandshakeError('SELF_SIGNED_CERT_IN_CHAIN'), 'untrusted');
    assert.equal(mapStrictHandshakeError('CERT_HAS_EXPIRED'), 'already-covered');
    assert.equal(mapStrictHandshakeError('DEPTH_ZERO_SELF_SIGNED_CERT'), 'already-covered');
    assert.equal(mapStrictHandshakeError('UNABLE_TO_GET_ISSUER_CERT_LOCALLY'), null);
    assert.equal(mapStrictHandshakeError('SOME_UNKNOWN_CODE'), null);
  });

  it('detects CBC-mode cipher names (BEAST precondition)', () => {
    assert.equal(isCbcCipher('ECDHE-RSA-AES128-SHA'), true);
    assert.equal(isCbcCipher('DES-CBC3-SHA'), true);
    assert.equal(isCbcCipher('ECDHE-RSA-AES128-GCM-SHA256'), false);
    assert.equal(isCbcCipher('TLS_AES_256_GCM_SHA384'), false);
    assert.equal(isCbcCipher('ECDHE-RSA-CHACHA20-POLY1305'), false);
  });
});

describe('tlsScan integration', () => {
  let tmp;
  let tlsServer;
  let tlsPort;
  let httpServer;
  let httpPort;
  let httpRedirectServer;
  let httpRedirectPort;

  before(async () => {
    // Generate a fresh self-signed cert at runtime — no private keys are
    // ever checked in.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tlsscan-test-'));
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${tmp}/key.pem" -out "${tmp}/cert.pem" ` +
        `-days 2 -nodes -subj "/CN=localhost"`,
      { stdio: 'pipe' }
    );
    const key = fs.readFileSync(`${tmp}/key.pem`);
    const cert = fs.readFileSync(`${tmp}/cert.pem`);

    // TLS server honouring ONLY TLS 1.2 with a self-signed cert.
    tlsServer = tls.createServer(
      { key, cert, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' },
      (sock) => { sock.write('HTTP/1.0 200 OK\r\nContent-Length: 2\r\n\r\nok'); sock.end(); }
    );
    await new Promise((r) => tlsServer.listen(0, '127.0.0.1', r));
    tlsPort = tlsServer.address().port;

    // Plain-HTTP stub serving a login form + session cookie (downgrade bait).
    httpServer = http.createServer((req, res) => {
      if (req.url === '/redir') {
        res.writeHead(302, { Location: 'https://localhost/' });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'sessid=abcdef1234567890; Path=/',
      });
      res.end('<html><form><input type="password" name="pw"></form></html>');
    });
    await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
    httpPort = httpServer.address().port;

    // Plain-HTTP stub that redirects to https (clean downgrade behaviour).
    httpRedirectServer = http.createServer((req, res) => {
      res.writeHead(302, { Location: 'https://localhost/' });
      res.end();
    });
    await new Promise((r) => httpRedirectServer.listen(0, '127.0.0.1', r));
    httpRedirectPort = httpRedirectServer.address().port;
  });

  after(() => {
    tlsServer.close();
    httpServer.close();
    httpRedirectServer.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('fires tls_cert_selfsigned against a self-signed server', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`);
    const ids = f.map((x) => x.id);
    assert.ok(ids.includes('tls_cert_selfsigned'), `expected selfsigned, got: ${ids.join(',')}`);
    const s = f.find((x) => x.id === 'tls_cert_selfsigned');
    assert.equal(s.severity, 'medium');
    assert.equal(s.parameter, 'certificate');
    assert.ok(s.evidence.signalCorrelated);
    // localhost matches CN=localhost → no mismatch finding.
    assert.ok(!ids.includes('tls_cert_hostname_mismatch'));
    // Fresh 2-day cert → not expired.
    assert.ok(!ids.includes('tls_cert_expired'));
    // DEPTH_ZERO_SELF_SIGNED_CERT is already covered by the medium
    // self-signed finding → no double-counted 'untrusted'.
    assert.ok(!ids.includes('tls_cert_untrusted'));
  });

  it('reports no weak-protocol findings against a TLS-1.2-only server', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`);
    const ids = f.map((x) => x.id);
    assert.ok(!ids.includes('tls_weak_protocol_1_0'), `unexpected: ${ids.join(',')}`);
    assert.ok(!ids.includes('tls_weak_protocol_1_1'));
    assert.ok(!ids.includes('tls_beast'));
  });

  it('completes weak-cipher attempts without crashing', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`);
    assert.ok(Array.isArray(f));
    for (const x of f) {
      assert.ok(x.parameter, 'every finding sets parameter');
      assert.ok(x.evidence && x.evidence.signalCorrelated === true);
    }
  });

  it('flags cleartext HTTP (#129) for an http:// target', async () => {
    const f = await probeTls(`http://127.0.0.1:${httpPort}/`);
    const c = f.find((x) => x.id === 'tls_cleartext_http');
    assert.ok(c, 'expected tls_cleartext_http');
    assert.equal(c.severity, 'high');
    assert.equal(c.parameter, 'scheme');
    // http targets skip TLS-only stages.
    assert.ok(!f.some((x) => x.id.startsWith('tls_cert')));
  });

  it('flags the downgrade when cleartext serves secrets without redirect (#129)', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`, {
      plainHttpUrl: `http://127.0.0.1:${httpPort}/`,
    });
    const d = f.find((x) => x.id === 'tls_cleartext_downgrade');
    assert.ok(d, 'expected tls_cleartext_downgrade');
    assert.equal(d.severity, 'high');
    assert.ok(/login form|session cookie/.test(d.evidence.response));
  });

  it('stays silent on downgrade when cleartext redirects to https', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`, {
      plainHttpUrl: `http://127.0.0.1:${httpRedirectPort}/`,
    });
    assert.ok(!f.some((x) => x.id === 'tls_cleartext_downgrade'));
  });

  it('returns [] fast for an unreachable TLS port', async () => {
    const f = await probeTls('https://127.0.0.1:1/');
    assert.deepEqual(f, []);
  });

  it('returns [] for a malformed URL', async () => {
    assert.deepEqual(await probeTls('not a url'), []);
  });
});
