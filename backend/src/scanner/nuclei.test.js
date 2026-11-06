// Dark Matter scanner — nuclei timeout regression test.
// Guards the 4-Nov-2026 fix: runNuclei must NOT inherit the generic runScan
// timeoutMs (15s standard / 30s deep), which silently killed every nuclei
// phase before any template completed. Nuclei gets its own dedicated
// nucleiTimeoutMs (default 600s since 6 Nov 2026 — the old 300s cap timed
// out VAmPI's main pass in lab re-validation, phases measured 304–319s).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runNuclei, nucleiPhaseFields, mergeNucleiFindings, NUCLEI_TARGETED_TEMPLATES, NUCLEI_TARGETED_SEVERITY, NUCLEI_TIMEOUT_MS } from './nuclei.js';

describe('nuclei targeted pass (NUCLEI-25, 6 Nov 2026)', () => {
  const mainJsonl = JSON.stringify({
    'template-id': 'dvwa-default-login',
    'matched-at': 'http://172.17.0.1:3100/index.php',
    info: { name: 'DVWA Default Login', severity: 'critical' },
  });
  const targetedJsonl = JSON.stringify({
    'template-id': 'php-eol',
    'matched-at': 'http://172.17.0.1:3300',
    info: { name: 'PHP End-of-Life - Detect', severity: 'info' },
  });
  const fakeRunner = (calls) => async (file, args) => {
    calls.push(args);
    const targeted = args.length > 3;
    return {
      ok: true,
      timedOut: false,
      stdout: targeted ? targetedJsonl + '\n' : mainJsonl + '\n',
      stderr: '',
    };
  };

  it('runs a second targeted pass with the curated template list', async () => {
    const calls = [];
    const res = await runNuclei('http://172.17.0.1:3300', { cmdRunner: fakeRunner(calls) });
    assert.equal(calls.length, 2);
    // Main pass: full sweep, critical/high/medium only
    assert.equal(calls[0][1], 'http://172.17.0.1:3300');
    assert.equal(calls[0][2], 'critical,high,medium');
    assert.equal(calls[0].length, 3);
    // Targeted pass: full severity range + curated list as 4th arg
    assert.equal(calls[1][2], NUCLEI_TARGETED_SEVERITY);
    assert.equal(calls[1][3], NUCLEI_TARGETED_TEMPLATES.join(','));
    assert.equal(res.findings.length, 2);
    assert.deepEqual(
      res.findings.map((f) => f.id).sort(),
      ['dvwa-default-login', 'php-eol']
    );
    assert.equal(res.ok, true);
    assert.equal(res.timedOut, false);
  });

  it('passes nucleiTimeoutMs (not generic timeoutMs) to BOTH passes', async () => {
    const calls = [];
    const timeouts = [];
    const runner = async (file, args, opts) => {
      calls.push(args);
      timeouts.push(opts.timeoutMs);
      return { ok: true, timedOut: false, stdout: '', stderr: '' };
    };
    await runNuclei('http://x.test', { timeoutMs: 15000, nucleiTimeoutMs: 300000, cmdRunner: runner });
    assert.equal(calls.length, 2);
    assert.deepEqual(timeouts, [300000, 300000]);
  });

  it('merges ok/timedOut across passes and concatenates stderr', async () => {
    const runner = async (file, args) => {
      const targeted = args.length > 3;
      return targeted
        ? { ok: false, timedOut: true, stdout: '', stderr: 'targeted boom' }
        : { ok: true, timedOut: false, stdout: '', stderr: 'main warn' };
    };
    const res = await runNuclei('http://x.test', { cmdRunner: runner });
    assert.equal(res.ok, false);
    assert.equal(res.timedOut, true);
    assert.match(res.stderr, /main warn/);
    assert.match(res.stderr, /targeted boom/);
  });

  it('curated list holds the proven templates and excludes options-method', () => {
    // Proven 6 Nov 2026 vs the authorised labs (see nuclei.js header):
    // php-eol (bWAPP PHP/5.5.9), missing-sri (Juice Shop), swagger-api
    // (Juice Shop), openapi (VAmPI).
    for (const id of ['php-eol', 'missing-sri', 'swagger-api', 'openapi']) {
      assert.ok(
        NUCLEI_TARGETED_TEMPLATES.some((t) => t.endsWith(`/${id}.yaml`)),
        `missing proven template ${id}`
      );
    }
    // options-method fires on OPTIONS-allowed but does NOT prove
    // PUT/DELETE/TRACE (VAmPI: Allow: GET, HEAD, OPTIONS; PUT/DELETE/TRACE
    // all 405). Including it would surface a non-vuln as verified.
    assert.ok(!NUCLEI_TARGETED_TEMPLATES.some((t) => t.includes('options-method')));
    // Every entry is a genuine misconfig check (info/low by construction);
    // the list stays narrow so the pass cannot flood scans with tech-detect.
    assert.equal(NUCLEI_TARGETED_TEMPLATES.length, 13);
    assert.ok(NUCLEI_TARGETED_TEMPLATES.every((t) => t.endsWith('.yaml')));
    assert.equal(NUCLEI_TARGETED_SEVERITY, 'info,low,medium,high,critical');
  });
});

describe('mergeNucleiFindings', () => {
  it('dedupes on template-id + matched-at across passes', () => {
    const a = { id: 'x', url: 'http://t/a', title: 'X' };
    const b = { id: 'x', url: 'http://t/a', title: 'X' };
    const c = { id: 'x', url: 'http://t/b', title: 'X' };
    const d = { id: 'y', url: 'http://t/a', title: 'Y' };
    assert.deepEqual(mergeNucleiFindings([a, c], [b, d]), [a, c, d]);
  });

  it('is safe on empty/missing lists', () => {
    assert.deepEqual(mergeNucleiFindings([], []), []);
    assert.deepEqual(mergeNucleiFindings(null, undefined), []);
  });
});

describe('nuclei timeout', () => {
  it('runNuclei signature uses nucleiTimeoutMs, not generic timeoutMs', () => {
    const src = runNuclei.toString();
    // Default is the NUCLEI_TIMEOUT_MS constant (600s since 6 Nov 2026 —
    // the old 300s cap timed out VAmPI's main pass in lab re-validation).
    assert.match(src, /nucleiTimeoutMs\s*=\s*NUCLEI_TIMEOUT_MS/);
    assert.equal(NUCLEI_TIMEOUT_MS, 600000);
    // Must NOT destructure a generic timeoutMs default (the old bug)
    assert.doesNotMatch(src, /{\s*severity[^}]*timeoutMs\s*=\s*300000/);
  });

  it('passes the 600s default to BOTH passes when no override is given', async () => {
    // Regression for the 6 Nov 2026 lab re-validation finding: the old
    // 300s cap timed out VAmPI's main pass (phases measured 304–319s).
    // A run with no explicit nucleiTimeoutMs must hand the 600s default
    // to both passes, so a ~320s main pass completes instead of timing
    // out. The stub records what each pass would have been killed at.
    const timeouts = [];
    const runner = async (file, args, opts) => {
      timeouts.push(opts.timeoutMs);
      return { ok: true, timedOut: false, stdout: '', stderr: '' };
    };
    await runNuclei('http://x.test', { cmdRunner: runner });
    assert.equal(timeouts.length, 2);
    assert.deepEqual(timeouts, [NUCLEI_TIMEOUT_MS, NUCLEI_TIMEOUT_MS]);
    assert.equal(NUCLEI_TIMEOUT_MS, 600000);
  });

  it('ignores generic timeoutMs from runScan opts (uses 600s default)', async () => {
    // Simulate exactly what index.js passes: opts with timeoutMs=15000
    // (standard depth). The old code would kill nuclei at 15s; the fix
    // must use the 600s dedicated default instead.
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
    // Caller can override via nucleiTimeoutMs (e.g. scannerHunt.js passes NUCLEI_TIMEOUT_MS)
    assert.match(src, /nucleiTimeoutMs/);
  });
});

describe('nucleiPhaseFields (phase-visibility fix, 5 Nov 2026)', () => {
  it('carries ok/timedOut and caps stderr to its last 500 chars', () => {
    const fields = nucleiPhaseFields({
      ok: false,
      timedOut: true,
      findings: [],
      stderr: 'x'.repeat(1200),
    });
    assert.equal(fields.ok, false);
    assert.equal(fields.timedOut, true);
    assert.equal(fields.stderrTail, 'x'.repeat(500));
  });

  it('returns an empty stderrTail on a clean run', () => {
    const fields = nucleiPhaseFields({ ok: true, timedOut: false, findings: [], stderr: '' });
    assert.equal(fields.ok, true);
    assert.equal(fields.timedOut, false);
    assert.equal(fields.stderrTail, '');
  });

  it('keeps a short stderr whole instead of truncating it', () => {
    const fields = nucleiPhaseFields({
      ok: false,
      timedOut: false,
      findings: [],
      stderr: 'docker: command not found',
    });
    assert.equal(fields.stderrTail, 'docker: command not found');
  });

  it('is safe on a missing/empty result', () => {
    assert.deepEqual(nucleiPhaseFields(null), { ok: false, timedOut: false, stderrTail: '' });
    assert.deepEqual(nucleiPhaseFields(undefined), { ok: false, timedOut: false, stderrTail: '' });
    assert.deepEqual(nucleiPhaseFields({}), { ok: false, timedOut: false, stderrTail: '' });
  });
});
