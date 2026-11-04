// Tests for the subdomain takeover probe (#40).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeSubdomainTakeover } from './subdomainTakeover.js';

describe('subdomainTakeover probe', () => {
  it('returns [] for IP-literal targets', async () => {
    const findings = await probeSubdomainTakeover('http://127.0.0.1:8080/', {
      timeoutMs: 5000,
      depth: 'quick',
    });
    assert.deepEqual(findings, [], 'IP literal has no registrable domain');
  });

  it('returns array (possibly empty) for a normal host', async () => {
    const findings = await probeSubdomainTakeover('http://example.invalid/', {
      timeoutMs: 8000,
      depth: 'quick',
    });
    assert.ok(Array.isArray(findings));
  }, { timeout: 30000 });
});
