// Tests for the race-condition probe (#33). Lab-gated: non-lab targets
// must yield zero findings; the safety gate is the primary assertion.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeRace } from './race.js';

describe('race probe', () => {
  const forms = [
    { action: 'http://127.0.0.1:1/submit', inputs: [{ name: 'qty', value: '1' }] },
  ];

  it('returns [] on non-lab targets (lab gate)', async () => {
    const findings = await probeRace(forms, 'http://example.com/submit', ['qty'], {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('returns [] when no forms are inventoried', async () => {
    const findings = await probeRace([], 'http://127.0.0.1:1/x', [], {
      labTargets: '127.0.0.1',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, []);
  });

  it('handles unreachable lab host without throwing', async () => {
    const findings = await probeRace(forms, 'http://127.0.0.1:1/submit', ['qty'], {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.ok(Array.isArray(findings));
  });
});
