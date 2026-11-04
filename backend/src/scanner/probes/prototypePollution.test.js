// Tests for the prototype pollution probe (#35). Lab-gated.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probePrototypePollution } from './prototypePollution.js';

describe('prototypePollution probe', () => {
  it('returns [] on non-lab targets (lab gate)', async () => {
    const findings = await probePrototypePollution('http://example.com/', {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('handles unreachable lab host without throwing', async () => {
    const findings = await probePrototypePollution('http://127.0.0.1:1/', {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.ok(Array.isArray(findings));
  });
});
