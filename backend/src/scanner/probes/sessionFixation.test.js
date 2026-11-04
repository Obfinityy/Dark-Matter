// Tests for the session fixation probe (#44).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeSessionFixation } from './sessionFixation.js';

describe('sessionFixation probe', () => {
  it('gracefully skips without labCreds', async () => {
    const forms = [{
      action: 'http://127.0.0.1:1/login',
      inputs: [{ name: 'user' }, { name: 'pass', type: 'password' }],
    }];
    const findings = await probeSessionFixation(forms, 'http://127.0.0.1:1/login', { timeoutMs: 3000 });
    assert.deepEqual(findings, [], 'no creds => graceful skip');
  });

  it('returns [] with no login forms', async () => {
    const findings = await probeSessionFixation([], 'http://127.0.0.1:1/', {
      labCreds: { username: 'u', password: 'p' },
      timeoutMs: 2000,
    });
    assert.deepEqual(findings, []);
  });
});
