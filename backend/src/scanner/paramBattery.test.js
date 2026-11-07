// Dark Matter scanner — param-battery visibility tests (5 Nov 2026).
//
// REGRESSION (35/63 gap): on a bare-root paste with zero param-bearing
// targets, the 28-phase injection battery was skipped in total silence —
// step() was never invoked, so no record, no error, and the rollup read a
// clean 35/35 ok on a 35/63 run. DVWA's flagship injection classes (SQLi,
// XSS, CMDI, traversal, SSTI, SSRF) never ran on the bare-root paste.
//
// The fix: (a) runScan emits a skipped record per param-battery phase when
// no target carries a parameter, and buildPhaseRollup counts skipped
// distinctly; (b) POST forms yield synthesized GET probe targets (same
// unique-filler read-only rule as GET forms) so the battery actually runs
// against a POST-login page; (c) fetchPage returns the post-redirect URL.
//
// No network, no docker in these tests — fetch is stubbed throughout.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runScan, PARAM_BATTERY_PHASES, DEFAULT_PHASES, buildPhaseRollup, buildPhaseSummaryLine } from './index.js';
import { fetchPage } from './fingerprint.js';

const realFetch = globalThis.fetch;
const teardown = () => {
  globalThis.fetch = realFetch;
};

// A page with no links, no forms, no parameters — the bare-root paste case.
const BARE_PAGE = `<html><head><title>t</title></head><body><p>hello</p></body></html>`;

// A DVWA-style login page: a single POST form, no GET forms, no links.
const LOGIN_PAGE = `<html><head><title>Login</title></head><body>
<form action="/login.php" method="post">
<input name="username"><input name="password">
<input name="Login" type="submit" value="Login">
</form></body></html>`;

function stubPage(html) {
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers({ server: 'nginx/1.24' }),
    text: async () => html,
  });
}

describe('param battery skipped records (35/63 fix)', () => {
  it('PARAM_BATTERY_PHASES is exactly the 29 loop phases, all in DEFAULT_PHASES', () => {
    assert.equal(PARAM_BATTERY_PHASES.length, 29);
    assert.equal(new Set(PARAM_BATTERY_PHASES).size, 29);
    for (const name of PARAM_BATTERY_PHASES) {
      assert.ok(DEFAULT_PHASES.includes(name), `${name} missing from DEFAULT_PHASES`);
    }
    // 79 since 7 Nov 2026 (untrusted JS inclusion): 'untrusted-js-inclusion'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 78 since 7 Nov 2026 (XML injection): 'xml-injection'
    // joins the battery as a loop phase (one record per param
    // target — structure breakout + parser-error vectors).
    // 77 since 7 Nov 2026 (timing side-channel): 'timing-side-channel'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 76 since 7 Nov 2026 (sensitive information disclosure): 'sensitive-info-disclosure'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is the baseline, so it never skips).
    // 75 since 7 Nov 2026 (sensitive data in logs): 'sensitive-data-in-logs'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 74 since 7 Nov 2026 (metadata leakage): 'metadata-leakage'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 73 since 7 Nov 2026 (source code disclosure): 'source-code-disclosure'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 72 since 7 Nov 2026 (fingerprint / banner disclosure): 'fingerprint-banner'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 71 since 7 Nov 2026 (input validation): 'validation'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point and no form exists).
    // (70 since 7 Nov 2026 (error disclosure): 'error-disclosure'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point).
    // (69 since 7 Nov 2026 (secrets in JS): 'secrets-in-js'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script).
    // (68 since 7 Nov 2026 (method override): 'method-override'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point and no POST form exists).
    // (67 since 7 Nov 2026 (verb tampering): 'verb-tampering' joins
    // as a standalone gated phase (one record per scan, skipped with
    // 'no probe targets' when no scan target carries a probe point).
    // (66 since 7 Nov 2026 (JS-bundle API routes): 'js-api-routes'
    // joins the battery so spec-less SPA APIs get a bundle-mined
    // inventory pass. (65 since 6 Nov 2026: 'openapi-targets'.)
    assert.equal(DEFAULT_PHASES.length, 79);
  });

  it('zero param targets: all 29 param phases emit skipped records, rollup reports them', async () => {
    stubPage(BARE_PAGE);
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: [...PARAM_BATTERY_PHASES],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(result.phases.length, 29);
      assert.deepEqual(
        result.phases.map((p) => p.name),
        PARAM_BATTERY_PHASES
      );
      for (const p of result.phases) {
        assert.equal(p.skipped, true);
        assert.equal(p.skipReason, 'no param targets');
        assert.equal(p.ok, true);
        assert.equal(p.error, null);
        assert.equal(p.findingsCount, 0);
        assert.equal(p.durationMs, 0);
      }
      // The rollup must NOT read this as a pass: 0 ok, 29 skipped.
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 29,
        ok: 0,
        failed: 0,
        skipped: 29,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('zero param targets with a mixed phase list: executed phases stay ok, param phases skipped', async () => {
    stubPage(BARE_PAGE);
    try {
      const seen = [];
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss'],
        },
        { timeoutMs: 5000, onPhase: (p) => seen.push(p) }
      );
      assert.equal(result.phases.length, 6);
      const byName = Object.fromEntries(result.phases.map((p) => [p.name, p]));
      for (const name of ['fingerprint', 'crawl', 'page-analyze', 'headers']) {
        assert.equal(byName[name].ok, true);
        assert.equal(byName[name].skipped, undefined);
      }
      assert.equal(byName['sqli-error'].skipped, true);
      assert.equal(byName['xss'].skipped, true);
      // Skipped records stream through onPhase exactly like executed ones.
      assert.equal(seen.length, 6);
      assert.equal(seen.filter((p) => p.skipped).length, 2);
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 6,
        ok: 4,
        failed: 0,
        skipped: 2,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('a POST login form yields synthesized GET targets and the battery runs (never submits the POST)', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), method: String(init.method || 'GET').toUpperCase() });
      return {
        status: 200,
        headers: new Headers({ server: 'nginx/1.24' }),
        text: async () => LOGIN_PAGE,
      };
    };
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss', 'cmdi', 'traversal', 'csrf'],
        },
        { timeoutMs: 5000 }
      );
      const byName = Object.fromEntries(result.phases.map((p) => [p.name, p]));
      // The battery ran against the synthesized target — no skipped records.
      for (const name of ['sqli-error', 'xss', 'cmdi', 'traversal']) {
        assert.equal(byName[name].skipped, undefined, `${name} must not be skipped`);
        assert.equal(byName[name].ok, true);
      }
      // The synthesized GET target was actually probed (login.php with
      // unique fillers for username/password), and the POST form was never
      // submitted — the battery only GETs.
      assert.ok(
        calls.some((c) => /login\.php\?username=dmprobe/.test(c.url)),
        `expected a GET probe of the synthesized login target, got: ${calls.map((c) => c.url).slice(0, 5).join(' | ')}`
      );
      assert.ok(
        calls.every((c) => c.method === 'GET'),
        `battery must never POST; saw: ${calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`).join(', ')}`
      );
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 9,
        ok: 9,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('a GET form still yields param targets (existing behaviour unchanged)', async () => {
    stubPage(
      `<html><body><form action="/s" method="get"><input name="q"></form></body></html>`
    );
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.equal(sqli.skipped, undefined);
      assert.equal(sqli.ok, true);
    } finally {
      teardown();
    }
  });
});

describe('fetchPage post-redirect URL (35/63 fix)', () => {
  it('returns res.url — the landing URL after redirects', async () => {
    globalThis.fetch = async () => ({
      url: 'http://example.com/login.php',
      status: 200,
      headers: new Headers({ server: 'nginx/1.24' }),
      text: async () => LOGIN_PAGE,
    });
    try {
      const page = await fetchPage('http://example.com/', { timeoutMs: 5000 });
      assert.equal(page.url, 'http://example.com/login.php');
      assert.equal(page.status, 200);
    } finally {
      teardown();
    }
  });

  it('falls back to the requested URL when res.url is absent (stubbed fetch)', async () => {
    globalThis.fetch = async () => ({
      status: 200,
      headers: new Headers({ server: 'nginx/1.24' }),
      text: async () => BARE_PAGE,
    });
    try {
      const page = await fetchPage('http://example.com/', { timeoutMs: 5000 });
      assert.equal(page.url, 'http://example.com/');
    } finally {
      teardown();
    }
  });
});

describe('buildPhaseRollup', () => {
  it('counts ok/failed/skipped/timedOut distinctly', () => {
    assert.deepEqual(
      buildPhaseRollup([
        { name: 'a', ok: true },
        { name: 'b', ok: true, skipped: true },
        { name: 'c', ok: false },
        { name: 'd', ok: false, timedOut: true },
      ]),
      { total: 4, ok: 1, failed: 2, skipped: 1, timedOut: 1 }
    );
  });

  it('returns zeros for empty / non-array input', () => {
    assert.deepEqual(buildPhaseRollup([]), {
      total: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
    });
    assert.deepEqual(buildPhaseRollup(null), {
      total: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
    });
  });
});

describe('buildPhaseSummaryLine (phase-split message)', () => {
  // Fabricate the exact bWAPP / VAmPI / Juice Shop rollup shape from the
  // 6 Nov 2026 nuclei-600 re-validation: 35 ran ok, 28 skipped, 0 failed.
  const skippedBattery = () => [
    ...Array.from({ length: 35 }, (_, i) => ({ name: `ok-${i}`, ok: true })),
    ...PARAM_BATTERY_PHASES.map((name) => ({
      name,
      ok: true,
      skipped: true,
      skipReason: 'no param targets',
    })),
  ];

  it('35/29 case renders the split with the shared skip reason — never 64/64 ok', () => {
    const phases = skippedBattery();
    // Skipped records still carry ok:true by design (see skipPhase) — the
    // line must read the rollup's skipped count, never ok:true.
    assert.ok(phases.filter((p) => p.skipped).every((p) => p.ok === true));
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 35 ran ok, 29 skipped (no param targets), 0 failed, 0 timed out.'
    );
  });

  // 45/34 since 7 Nov 2026 (XML injection + untrusted JS inclusion): the battery
  // gained 'js-api-routes', so a bare page runs 45 non-param phases — and
  // 'verb-tampering' + 'method-override' add a 29th and 30th skipped
  // record ('no probe targets': no scan target carries a probe point
  // on a bare page, and no POST form exists), 'secrets-in-js' adds
  // a 31st ('no script targets': the bare page carries no script),
  // 'error-disclosure' adds a 32nd ('no probe targets'), and
  // 'validation' adds a 33rd ('no probe targets': no probe point
  // and no form), while 'xml-injection' adds a 34th (the battery
  // gained a 29th loop phase — see PARAM_BATTERY_PHASES above),
  // while 'fingerprint-banner' adds a 39th RUNNING
  // record, 'source-code-disclosure' a 40th, 'metadata-leakage'
  // a 41st, 'sensitive-data-in-logs' a 42nd,
  // 'sensitive-info-disclosure' a 43rd, 'timing-side-channel'
  // a 44th and 'untrusted-js-inclusion' a 45th (the pasted page
  // is always a surface — 0 findings on
  // the bare stub), so the two skip reasons mix and the summary
  // renders a bare count. The spec fetch is stubbed to the bare page
  // (HTML, not JSON), so the pass records an honest no-op with 0
  // targets — the same seam discipline as domRenderer above.
  // (37/28 before js-api-routes; 43/33 before timing-side-channel;
  // 44/33 before xml-injection and untrusted-js-inclusion.)
  it('real runScan on a bare page renders the 45/34 line end to end', async () => {
    stubPage(BARE_PAGE);
    try {
      const result = await runScan(
        { target: 'http://example.com/', confirmedAuthorized: true },
        {
          timeoutMs: 5000,
          nucleiRunner: async () => ({ ok: true, timedOut: false, findings: [] }),
          domRenderer: async () => ({ ok: true, html: '<html><body></body></html>' }),
        }
      );
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 79,
        ok: 45,
        failed: 0,
        skipped: 34,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 45 ran ok, 34 skipped, 0 failed, 0 timed out.'
      );
    } finally {
      teardown();
    }
  });

  it('clean 63/63 run renders zero skipped', () => {
    const phases = Array.from({ length: 63 }, (_, i) => ({ name: `p-${i}`, ok: true }));
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 63 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
  });

  it('failed and timed-out phases render distinctly', () => {
    const phases = [
      ...Array.from({ length: 60 }, (_, i) => ({ name: `p-${i}`, ok: true })),
      { name: 'x', ok: false },
      { name: 'nuclei', ok: false, timedOut: true },
    ];
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 60 ran ok, 0 skipped, 2 failed, 1 timed out.'
    );
  });

  it('mixed skip reasons render as a bare count, no parenthetical', () => {
    const phases = [
      { name: 'a', ok: true },
      { name: 'b', ok: true, skipped: true, skipReason: 'no param targets' },
      { name: 'c', ok: true, skipped: true, skipReason: 'other reason' },
    ];
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 1 ran ok, 2 skipped, 0 failed, 0 timed out.'
    );
  });

  it('returns zeros for empty / non-array input', () => {
    assert.equal(
      buildPhaseSummaryLine([]),
      'Phases: 0 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
    assert.equal(
      buildPhaseSummaryLine(null),
      'Phases: 0 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
  });
});
