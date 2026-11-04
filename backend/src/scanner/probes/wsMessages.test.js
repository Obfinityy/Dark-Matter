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
});
