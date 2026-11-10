// Tests for the hash length extension probe (row #506 [High] hash
// length extension, CWE-327 / CWE-347; phase 'hash-length-extension').
//
// The pure compressors are checked against node:crypto test vectors
// and against a real secret‖message MAC for every secret length in
// 1..16. The probe tests run against a local /verify server whose
// secret ('s3cret!', 7 bytes) the test knows: 'mac' mode verifies
// H(secret ‖ message), 'hmac' mode verifies HMAC (immune), and
// 'accept-all' mode accepts any MAC (the random-MAC control must
// veto the finding there). No external service is touched.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  probeHashLengthExtension,
  forgeMac,
  gluePadding,
  continueHash,
  computeHash,
  normalizeAlgorithm,
  isImmuneAlgorithm,
  isSupportedAlgorithm,
  SUPPORTED_ALGORITHMS,
  __hashLengthExtensionMeta,
} from './hashLengthExtension.js';
import { verifyFindings } from '../verifier.js';

const SECRET = 's3cret!';
const MESSAGE = 'user=alice&role=user';
const APPEND = '&role=admin';

function macOf(algorithm, messageBuf) {
  return crypto.createHash(algorithm).update(Buffer.concat([Buffer.from(SECRET, 'latin1'), messageBuf])).digest('hex');
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

describe('hash-length-extension probe', () => {
  let server;
  let port;
  let mode = 'mac';
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer(async (req, res) => {
      const raw = await readBody(req);
      let body = {};
      try { body = JSON.parse(raw); } catch { /* ignore */ }
      const msgBuf = Buffer.from(String(body.message || ''), 'latin1');
      let valid = false;
      if (mode === 'accept-all') valid = true;
      else if (mode === 'hmac') {
        const expect = crypto.createHmac(body.algorithm || 'sha256', SECRET).update(msgBuf).digest('hex');
        valid = String(body.mac || '') === expect;
      } else {
        valid = String(body.mac || '') === macOf(body.algorithm || 'sha256', msgBuf);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  const verifyMac = async (message, mac, algorithm) => {
    const res = await fetch(`${base()}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mac, algorithm }),
      signal: AbortSignal.timeout(3000),
    });
    const parsed = await res.json();
    return parsed.valid === true;
  };

  it('pure compressors match node:crypto test vectors', () => {
    assert.equal(computeHash('md5', ''), 'd41d8cd98f00b204e9800998ecf8427e');
    assert.equal(computeHash('md5', 'abc'), '900150983cd24fb0d6963f7d28e17f72');
    assert.equal(computeHash('sha1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
    assert.equal(computeHash('sha1', ''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
    assert.equal(computeHash('sha256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(computeHash('sha256', ''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('gluePadding completes the block and encodes the bit length', () => {
    for (const total of [0, 1, 7, 55, 56, 63, 64, 119, 120]) {
      const glue = gluePadding(total);
      assert.equal((total + glue.length) % 64, 0, `total ${total}`);
      assert.equal(glue[0], 0x80);
      assert.equal(glue.readBigUInt64BE(glue.length - 8), BigInt(total) * 8n);
    }
    // MD5's length field is little-endian; SHA-1/SHA-256 big-endian.
    const md5Glue = gluePadding(3, 'md5');
    assert.equal(md5Glue.readBigUInt64LE(md5Glue.length - 8), 24n);
    assert.equal(gluePadding(3, 'sha256').readBigUInt64BE(gluePadding(3, 'sha256').length - 8), 24n);
  });

  it('forgeMac matches a real secret‖message MAC for md5/sha1/sha256, secret lengths 1..16', () => {
    for (const algorithm of ['md5', 'sha1', 'sha256']) {
      for (let n = 1; n <= 16; n += 1) {
        const secret = 'k'.repeat(n);
        const msgBuf = Buffer.from(MESSAGE, 'latin1');
        const original = crypto.createHash(algorithm)
          .update(Buffer.concat([Buffer.from(secret, 'latin1'), msgBuf])).digest('hex');
        const forged = forgeMac({
          algorithm,
          originalMac: original,
          messageLength: msgBuf.length,
          append: APPEND,
          secretLength: n,
        });
        const forgedMsg = Buffer.concat([msgBuf, forged.extension]);
        const expected = crypto.createHash(algorithm)
          .update(Buffer.concat([Buffer.from(secret, 'latin1'), forgedMsg])).digest('hex');
        assert.equal(forged.forgedMac, expected, `${algorithm} secret length ${n}`);
      }
    }
  });

  it('CONFIRMS when the forged MAC is accepted (sha256, secret length 7)', async () => {
    mode = 'mac';
    const diag = {};
    const original = macOf('sha256', Buffer.from(MESSAGE, 'latin1'));
    const findings = await probeHashLengthExtension(`${base()}/verify`, {
      timeoutMs: 5000,
      verifyMac,
      diagnostics: diag,
      hashLengthExtension: { message: MESSAGE, mac: original, algorithm: 'sha256', append: APPEND },
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'hash_length_extension');
    assert.equal(f.id, 'hash-length-extension-sha256');
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.signalCorrelated);
    assert.equal(diag.secretLength, 7);
    assert.equal(diag.forgedAccepted, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('CONFIRMS for md5 as well', async () => {
    mode = 'mac';
    const original = macOf('md5', Buffer.from(MESSAGE, 'latin1'));
    const findings = await probeHashLengthExtension(`${base()}/verify`, {
      timeoutMs: 5000,
      verifyMac,
      hashLengthExtension: { message: MESSAGE, mac: original, algorithm: 'md5', append: APPEND },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'hash-length-extension-md5');
  });

  it('stays silent on an HMAC verifier (immune construction)', async () => {
    mode = 'hmac';
    const original = crypto.createHmac('sha256', SECRET).update(Buffer.from(MESSAGE, 'latin1')).digest('hex');
    const findings = await probeHashLengthExtension(`${base()}/verify`, {
      timeoutMs: 5000,
      verifyMac,
      hashLengthExtension: { message: MESSAGE, mac: original, algorithm: 'sha256', append: APPEND },
    });
    assert.deepEqual(findings, []);
  });

  it('stays silent when the verifier accepts any MAC (random control vetoes)', async () => {
    mode = 'accept-all';
    const original = macOf('sha256', Buffer.from(MESSAGE, 'latin1'));
    const findings = await probeHashLengthExtension(`${base()}/verify`, {
      timeoutMs: 5000,
      verifyMac,
      hashLengthExtension: { message: MESSAGE, mac: original, algorithm: 'sha256', append: APPEND },
    });
    assert.deepEqual(findings, []);
  });

  it('skips immune algorithms (sha3) and unsupported ones (sha512)', async () => {
    const diagImmune = {};
    const f1 = await probeHashLengthExtension(`${base()}/verify`, {
      diagnostics: diagImmune,
      hashLengthExtension: { message: MESSAGE, mac: '00'.repeat(32), algorithm: 'sha3-256' },
    });
    assert.deepEqual(f1, []);
    assert.match(diagImmune.skipped, /immune/);
    const diagUnsupported = {};
    const f2 = await probeHashLengthExtension(`${base()}/verify`, {
      diagnostics: diagUnsupported,
      hashLengthExtension: { message: MESSAGE, mac: '00'.repeat(64), algorithm: 'sha512' },
    });
    assert.deepEqual(f2, []);
    assert.match(diagUnsupported.skipped, /unsupported/);
  });

  it('skips gracefully with no MAC triple supplied', async () => {
    const diag = {};
    const findings = await probeHashLengthExtension(`${base()}/verify`, { diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.match(diag.skipped, /no MAC triple/);
  });

  it('algorithm helpers classify correctly', () => {
    assert.equal(normalizeAlgorithm('SHA-1'), 'sha1');
    assert.equal(normalizeAlgorithm('SHA256'), 'sha256');
    assert.equal(isImmuneAlgorithm('hmac-sha256'), true);
    assert.equal(isImmuneAlgorithm('sha3-256'), true);
    assert.equal(isImmuneAlgorithm('sha256'), false);
    assert.equal(isSupportedAlgorithm('md5'), true);
    assert.equal(isSupportedAlgorithm('sha512'), false);
    assert.deepEqual(SUPPORTED_ALGORITHMS, ['md5', 'sha1', 'sha256']);
  });

  it('continueHash throws on an unsupported algorithm', () => {
    assert.throws(() => continueHash('sha512', [], Buffer.alloc(0), 0), /unsupported/);
  });

  it('probe meta names the phase and standard/deep depths', () => {
    assert.deepEqual(__hashLengthExtensionMeta.phases, ['hash-length-extension']);
    assert.deepEqual(__hashLengthExtensionMeta.depth, ['standard', 'deep']);
  });
});
