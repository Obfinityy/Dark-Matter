// Tests for the mass-assignment probe (#38). Lab-gated with revert.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeMassAssignment } from './massAssignment.js';

describe('massAssignment probe', () => {
  it('returns [] on non-lab targets (lab gate)', async () => {
    const forms = [{ action: 'http://example.com/register', inputs: [{ name: 'user', value: 'x' }] }];
    const findings = await probeMassAssignment(forms, 'http://example.com/register', {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('returns [] with no forms', async () => {
    const findings = await probeMassAssignment([], 'http://127.0.0.1:1/', {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.deepEqual(findings, []);
  });
});
