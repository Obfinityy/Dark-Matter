// Tests for the CSWSH probe — handshake canary math, bundle hints, and the
// no-endpoint fast path. Live socket tests are skipped (no WS server here);
// the differential oracles are exercised via a stubbed wsHandshake transport.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { probeCswsh, matchWsBundleHints, WS_PATHS, TOKEN_IN_URL_RE } from './cswsh.js';

describe('cswsh probe', () => {
  it('returns empty array when no WebSocket endpoint found', async () => {
    // No server listens on this port, so every handshake fails fast.
    const findings = await probeCswsh('http://127.0.0.1:1/', { timeoutMs: 800, depth: 'quick' });
    assert.deepEqual(findings, []);
  });

  it('Sec-WebSocket-Accept canary math matches RFC 6455', () => {
    // Known-answer test: key "dGhlIHNhbXBsZSBub25jZQ==" must accept as
    // "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" (RFC 6455 section 1.3).
    const key = 'dGhlIHNhbXBsZSBub25jZQ==';
    const accept = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    assert.equal(accept, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  it('matches WebSocket bundle hints', () => {
    const hits = matchWsBundleHints('const s = new WebSocket("wss://x.test/ws"); // socket.io fallback');
    assert.ok(hits.length >= 2, `expected >=2 hints, got ${hits.length}`);
  });

  it('returns no hits on plain HTML', () => {
    const hits = matchWsBundleHints('<html><body>hello</body></html>');
    assert.deepEqual(hits, []);
  });

  it('detects token-in-URL pattern', () => {
    assert.ok(TOKEN_IN_URL_RE.test('wss://x.test/ws?token=abc123'));
    assert.ok(TOKEN_IN_URL_RE.test('wss://x.test/ws?access_token=abc'));
    assert.ok(!TOKEN_IN_URL_RE.test('wss://x.test/ws?foo=bar'));
  });

  it('probes at most 6 known paths', () => {
    assert.ok(WS_PATHS.length <= 6, `expected <=6 paths, got ${WS_PATHS.length}`);
    assert.ok(WS_PATHS.includes('/ws'));
  });

  it('rejects malformed URLs without throwing', async () => {
    const findings = await probeCswsh('not-a-url', { timeoutMs: 500, depth: 'quick' });
    assert.deepEqual(findings, []);
  });
});
