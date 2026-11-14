// Tests for the TLS / certificate / crypto-transport probe (#125, #129,
// #133, #134, #447, #448-surface, #450, #451).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import net from 'node:net';
import http from 'node:http';
import {
  probeTls,
  analyzeCertificate,
  isSelfSigned,
  hostMatchesCert,
  getChainDepth,
  mapStrictHandshakeError,
  isCbcCipher,
  buildSsl3ClientHello,
  probeSsl3Raw,
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

describe('tlsScan SSLv3 raw-socket leg (#446)', () => {
  // Minimal ServerHello record: handshake type 0x02, body = version(2) +
  // random(32) + session-id length(1)=0. The leg only reads the record type,
  // the handshake type and the ServerHello body version (bytes 0, 5, 9, 10).
  function serverHelloBuf(version) {
    const body = Buffer.alloc(35);
    body.writeUInt16BE(version, 0);
    const hs = Buffer.alloc(4 + body.length);
    hs[0] = 0x02;
    hs.writeUIntBE(body.length, 1, 3);
    body.copy(hs, 4);
    const rec = Buffer.alloc(5 + hs.length);
    rec[0] = 0x16;
    rec.writeUInt16BE(version, 1);
    rec.writeUInt16BE(hs.length, 3);
    hs.copy(rec, 5);
    return rec;
  }

  // Raw TCP server that runs `handler(sock, chunk)` on the first data chunk.
  function startRawServer(handler) {
    return new Promise((resolve) => {
      const server = net.createServer((sock) => {
        sock.on('error', () => {});
        sock.once('data', (chunk) => handler(sock, chunk));
      });
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
  }

  it('builds a well-formed SSLv3 ClientHello (record 0x16, version 0x0300)', () => {
    const hello = buildSsl3ClientHello();
    assert.equal(hello.length, 54);
    assert.equal(hello[0], 0x16, 'record type must be handshake');
    assert.equal(hello.readUInt16BE(1), 0x0300, 'record version must be SSLv3');
    assert.equal(hello.readUInt16BE(3), 49, 'record length must cover the handshake message');
    assert.equal(hello[5], 0x01, 'handshake type must be ClientHello');
    assert.equal(hello.readUIntBE(6, 3), 45, 'handshake length must cover the body');
    assert.equal(hello.readUInt16BE(9), 0x0300, 'client version must be SSLv3');
    assert.equal(hello[43], 0x00, 'session-id length must be 0');
    assert.equal(hello.readUInt16BE(44), 6, 'cipher-suite list length must be 3 suites');
    assert.deepEqual(
      [hello.readUInt16BE(46), hello.readUInt16BE(48), hello.readUInt16BE(50)],
      [0x002f, 0x0005, 0x000a],
      'offered suites must be SSLv3-valid (AES128-SHA, RC4-SHA, 3DES-SHA)'
    );
    assert.equal(hello[52], 0x01, 'compression-methods length must be 1');
    assert.equal(hello[53], 0x00, 'compression must be null');
  });

  it('randomises only the 32-byte client random between ClientHellos', () => {
    const a = buildSsl3ClientHello();
    const b = buildSsl3ClientHello();
    assert.deepEqual(a.subarray(0, 11), b.subarray(0, 11), 'header must be identical');
    assert.deepEqual(a.subarray(43), b.subarray(43), 'tail must be identical');
    assert.notDeepEqual(a.subarray(11, 43), b.subarray(11, 43), 'random must differ');
  });

  it('confirms SSLv3 offered on a 0x0300 ServerHello and sends a well-formed ClientHello', async () => {
    let received = null;
    const { server, port } = await startRawServer((sock, chunk) => {
      received = chunk;
      sock.write(serverHelloBuf(0x0300));
    });
    try {
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 3000 });
      assert.equal(r.offered, true, `expected offered, got ${JSON.stringify(r)}`);
      assert.equal(r.version, 'SSLv3');
      assert.ok(received, 'mock must have received the ClientHello');
      assert.equal(received[0], 0x16);
      assert.equal(received.readUInt16BE(1), 0x0300);
      assert.equal(received[5], 0x01);
      assert.equal(received.readUInt16BE(9), 0x0300);
    } finally {
      server.close();
    }
  });

  it('confirms on a fragmented ServerHello (buffered across chunks)', async () => {
    const { server, port } = await startRawServer((sock) => {
      const full = serverHelloBuf(0x0300);
      sock.write(full.subarray(0, 3));
      setTimeout(() => sock.write(full.subarray(3)), 50);
    });
    try {
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 3000 });
      assert.equal(r.offered, true, `expected offered, got ${JSON.stringify(r)}`);
    } finally {
      server.close();
    }
  });

  it('stays silent on a TLS 1.2 ServerHello (higher version is not SSLv3)', async () => {
    const { server, port } = await startRawServer((sock) => {
      sock.write(serverHelloBuf(0x0303));
    });
    try {
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 3000 });
      assert.equal(r.offered, false, `expected silent, got ${JSON.stringify(r)}`);
    } finally {
      server.close();
    }
  });

  it('stays silent on a TLS alert (protocol_version) then close', async () => {
    const { server, port } = await startRawServer((sock) => {
      sock.write(Buffer.from([0x15, 0x03, 0x00, 0x00, 0x02, 0x02, 0x46])); // fatal alert
      sock.end();
    });
    try {
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 3000 });
      assert.equal(r.offered, false, `expected silent, got ${JSON.stringify(r)}`);
    } finally {
      server.close();
    }
  });

  it('stays silent when the server closes without answering', async () => {
    const { server, port } = await startRawServer((sock) => {
      sock.end();
    });
    try {
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 3000 });
      assert.equal(r.offered, false, `expected silent, got ${JSON.stringify(r)}`);
    } finally {
      server.close();
    }
  });

  it('stays silent on connection refused', async () => {
    const r = await probeSsl3Raw('127.0.0.1', 1, { timeoutMs: 2000 });
    assert.equal(r.offered, false, `expected silent, got ${JSON.stringify(r)}`);
  });

  it('stays silent and resolves on timeout (server accepts, never answers)', async () => {
    const { server, port } = await startRawServer(() => {
      // accept the connection, never reply — the leg must time out, not hang
    });
    try {
      const t0 = Date.now();
      const r = await probeSsl3Raw('127.0.0.1', port, { timeoutMs: 200 });
      assert.equal(r.offered, false, `expected silent, got ${JSON.stringify(r)}`);
      assert.equal(r.error, 'timeout');
      assert.ok(Date.now() - t0 < 2000, 'must resolve near the timeout, not hang');
    } finally {
      server.close();
    }
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

  it('stays silent on SSLv3 against a TLS-1.2-only server (#446)', async () => {
    const f = await probeTls(`https://localhost:${tlsPort}/`);
    const ids = f.map((x) => x.id);
    assert.ok(!ids.includes('tls_sslv3_offered'), `unexpected: ${ids.join(',')}`);
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
