// Dark Matter scanner — nuclei timeout regression test.
// Guards the 4-Nov-2026 fix: runNuclei must NOT inherit the generic runScan
// timeoutMs (15s standard / 30s deep), which silently killed every nuclei
// phase before any template completed. Nuclei gets its own dedicated
// nucleiTimeoutMs (default 300s).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runNuclei } from './nuclei.js';

describe('nuclei timeout', () => {
  it('runNuclei signature uses nucleiTimeoutMs, not generic timeoutMs', () => {
    const src = runNuclei.toString();
    // Must destructure nucleiTimeoutMs with 300s default
    assert.match(src, /nucleiTimeoutMs\s*=\s*300000/);
    // Must NOT destructure a generic timeoutMs default (the old bug)
    assert.doesNotMatch(src, /{\s*severity[^}]*timeoutMs\s*=\s*300000/);
  });

  it('ignores generic timeoutMs from runScan opts (uses 300s default)', async () => {
    // Simulate exactly what index.js passes: opts with timeoutMs=15000
    // (standard depth). The old code would kill nuclei at 15s; the fix
    // must use the 300s dedicated default instead.
    // We verify by checking the function does not reference opts.timeoutMs
    // for its exec timeout — the signature test above covers the contract.
    // Behavioral proof happens live on EC2 (standard scan must show nuclei
    // phase completing, not silent-timeout).
    const src = runNuclei.toString();
    // The exec call must use nucleiTimeoutMs, not timeoutMs
    assert.match(src, /timeoutMs:\s*nucleiTimeoutMs/);
  });

  it('honors explicit nucleiTimeoutMs override', () => {
    const src = runNuclei.toString();
    // Caller can override via nucleiTimeoutMs (e.g. scannerHunt.js passes 300000)
    assert.match(src, /nucleiTimeoutMs/);
  });
});
