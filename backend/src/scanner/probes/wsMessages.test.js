// Tests for the WebSocket message probe (#39).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeWsMessages } from './wsMessages.js';

describe('wsMessages probe', () => {
  it('returns [] when no WS endpoints are live', async () => {
    const findings = await probeWsMessages('http://127.0.0.1:1/', {
      timeoutMs: 3000,
      depth: 'quick',
    });
    assert.deepEqual(findings, [], 'no WS surface => no findings');
  });

  it('handles unreachable host without throwing', async () => {
    const findings = await probeWsMessages('http://127.0.0.1:1/page', { timeoutMs: 2000 });
    assert.ok(Array.isArray(findings));
  });

  it('#270 fires when an HTTPS page references a cleartext ws:// URL', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><head></head><body><script>const sock = new WebSocket("ws://realtime.test.local/socket");</script></body></html>',
    });
    try {
      // depth quick: passive only (no active handshake), d1Inventory handshakes
      // to wss://127.0.0.1:1/* fail fast (connection refused).
      const findings = await probeWsMessages('https://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      const f = findings.find((x) => x.class === 'ws_unencrypted_channel');
      assert.ok(f, 'ws_unencrypted_channel should fire');
      assert.equal(f.severity, 'medium');
      assert.ok(f.parameter.includes('ws://realtime.test.local/socket'));
      assert.ok(f.evidence.signalCorrelated);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#270 stays silent on plain HTTP pages and pages without ws:// refs', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () => '<html><body>no websocket here</body></html>',
    });
    try {
      const httpFindings = await probeWsMessages('http://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      assert.ok(!httpFindings.some((x) => x.class === 'ws_unencrypted_channel'), 'http page must not fire');
      const httpsFindings = await probeWsMessages('https://127.0.0.1:1/app', {
        timeoutMs: 3000,
        depth: 'quick',
      });
      assert.ok(!httpsFindings.some((x) => x.class === 'ws_unencrypted_channel'), 'page without ws:// refs must not fire');
    } finally {
      global.fetch = origFetch;
    }
  });
});
