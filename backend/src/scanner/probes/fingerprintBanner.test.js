// Tests for the fingerprint/banner probe
// (coverage row #183 [Low], phase 72).
// No network, no lab needed — fetches go through the opts.fetchPage seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeFingerprintBanner,
  buildBannerTriggers,
  extractBannerVersions,
} from './fingerprintBanner.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/login.php';
const BASELINE = '<html><body><h1>Login</h1><form></form></body></html>';
const TRIGGER = 'http://lab.local/dm-nonexistent-9f27a1c4.html';

// fetchPage seam: map URL -> { status, headers, body }. Unknown URLs 404.
function fetchPageFor(bodies) {
  return async (url) => {
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('extractBannerVersions', () => {
  it('extracts Apache/2.4.52 from a Server value', () => {
    assert.deepEqual(extractBannerVersions('Apache/2.4.52 (Ubuntu)', 'server'), [
      { product: 'Apache', version: '2.4.52' },
    ]);
  });

  it('a version-less Server value yields no pairs', () => {
    assert.deepEqual(extractBannerVersions('nginx', 'server'), []);
    assert.deepEqual(extractBannerVersions('cloudflare', 'server'), []);
    assert.deepEqual(extractBannerVersions('Express', 'x-powered-by'), []);
  });

  it('Via: 1.1 is a protocol version, not a server version — only Varnish/7.0 counts', () => {
    assert.deepEqual(extractBannerVersions('1.1 varnish (Varnish/7.0)', 'via'), [
      { product: 'Varnish', version: '7.0' },
    ]);
  });

  it('HTTP/1.1 in Via is excluded as a protocol version', () => {
    assert.deepEqual(extractBannerVersions('HTTP/1.1', 'via'), []);
  });

  it('a bare version value counts only for version-named headers', () => {
    assert.deepEqual(extractBannerVersions('4.0.30319', 'x-aspnet-version'), [
      { product: 'x-aspnet-version', version: '4.0.30319' },
    ]);
    // x-runtime is a duration in seconds, not a version.
    assert.deepEqual(extractBannerVersions('0.123456', 'x-runtime'), []);
  });

  it('extracts every version in a multi-product value', () => {
    assert.deepEqual(extractBannerVersions('Werkzeug/2.3.7 Python/3.11.4', 'server'), [
      { product: 'Werkzeug', version: '2.3.7' },
      { product: 'Python', version: '3.11.4' },
    ]);
  });

  it('a bare integer is not a version', () => {
    assert.deepEqual(extractBannerVersions('Varnish/7', 'via'), []);
    assert.deepEqual(extractBannerVersions('app-1', 'x-backend'), []);
  });
});

describe('buildBannerTriggers', () => {
  it('one trigger per directory under the non-existent leaf', () => {
    const t = buildBannerTriggers([PAGE]);
    assert.equal(t.length, 1);
    assert.equal(t[0].url, TRIGGER);
    assert.equal(t[0].baselineUrl, PAGE);
  });

  it('two targets in one directory share one trigger', () => {
    const t = buildBannerTriggers([PAGE, 'http://lab.local/other.php']);
    assert.equal(t.length, 1);
  });

  it('a nested target nests the leaf under its directory', () => {
    const t = buildBannerTriggers(['http://lab.local/admin/users']);
    assert.equal(t[0].url, 'http://lab.local/admin/dm-nonexistent-9f27a1c4.html');
  });

  it('caps triggers at 5', () => {
    const urls = Array.from({ length: 7 }, (_, i) => `http://lab.local/d${i}/page`);
    assert.equal(buildBannerTriggers(urls).length, 5);
  });

  it('no targets yields no triggers', () => {
    assert.deepEqual(buildBannerTriggers([]), []);
    assert.deepEqual(buildBannerTriggers(null), []);
  });

  it('a malformed URL is skipped, the rest still trigger', () => {
    const t = buildBannerTriggers(['not a url', PAGE]);
    assert.equal(t.length, 1);
    assert.equal(t[0].url, TRIGGER);
  });
});

describe('fingerprintBanner probe — header disclosure', () => {
  it('Server: Apache/2.4.52 on the page is a Low banner_disclosure finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'Apache/2.4.52 (Ubuntu)' }, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'banner_disclosure');
    assert.equal(f.severity, 'low');
    assert.ok(f.title.includes('Apache 2.4.52'));
    assert.ok(f.title.includes("'server'"));
    assert.equal(f.url, PAGE);
    assert.ok(f.evidence.request.includes(PAGE));
    assert.ok(f.evidence.response.includes('Apache/2.4.52'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('X-Powered-By: PHP/8.1.2 is a Low finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: {
          status: 200,
          headers: { 'x-powered-by': 'PHP/8.1.2-1ubuntu2.11' },
          body: BASELINE,
        },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('PHP 8.1.2'));
    assert.ok(findings[0].title.includes("'x-powered-by'"));
  });

  it('a version-less Server header is NOT a finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'nginx' }, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a version disclosed only on the 404 trigger is a Low finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'nginx' }, body: BASELINE },
        [TRIGGER]: { status: 404, headers: { server: 'Apache/2.4.52' }, body: 'Not Found' },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, TRIGGER);
    assert.ok(findings[0].title.includes('Apache 2.4.52'));
  });

  it('the same header + version on page and 404 is ONE finding (dedup)', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'Apache/2.4.52' }, body: BASELINE },
        [TRIGGER]: { status: 404, headers: { server: 'Apache/2.4.52' }, body: 'Not Found' },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, PAGE);
  });

  it('two versions in one Server header are TWO findings', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: {
          status: 200,
          headers: { server: 'Werkzeug/2.3.7 Python/3.11.4' },
          body: BASELINE,
        },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.title.includes('Werkzeug 2.3.7')));
    assert.ok(findings.some((f) => f.title.includes('Python 3.11.4')));
  });

  it('Via discloses Varnish/7.0 only — the 1.1 protocol version is not a finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: {
          status: 200,
          headers: { via: '1.1 varnish (Varnish/7.0)' },
          body: BASELINE,
        },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('Varnish 7.0'));
  });

  it('a bare X-AspNet-Version value is a Low finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { 'x-aspnet-version': '4.0.30319' }, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('4.0.30319'));
  });

  it('a header finding verifies as confirmed through verifyFindings', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'Apache/2.4.52' }, body: BASELINE },
      }),
    });
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('Via: HTTP/1.1 alone is NOT a finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { via: 'HTTP/1.1' }, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('X-Runtime: 0.123456 (a duration) is NOT a finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { 'x-runtime': '0.123456' }, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('clean headers and a clean 404 yield no findings', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: { server: 'nginx', 'content-type': 'text/html' }, body: BASELINE },
        [TRIGGER]: { status: 404, headers: {}, body: 'Not Found' },
      }),
    });
    assert.equal(findings.length, 0);
  });
});

describe('fingerprintBanner probe — error-page body disclosure', () => {
  it('an Apache footer version in a 404 body, absent from the baseline, is a Low finding', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [TRIGGER]: {
          status: 404,
          headers: {},
          body: '<html><body><h1>Not Found</h1><address>Apache/2.4.52 (Debian) Server at localhost Port 80</address></body></html>',
        },
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'banner_disclosure');
    assert.equal(f.severity, 'low');
    assert.ok(f.title.includes('Apache 2.4.52'));
    assert.ok(f.title.includes('error-page body'));
    assert.equal(f.url, TRIGGER);
    assert.ok(f.evidence.response.includes('Apache/2.4.52'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('an error-body version that also appears in the baseline body is NOT a finding (differential)', async () => {
    const baselineWithVersion =
      '<html><body><h1>Docs</h1><p>Requires Apache/2.4.52 or later.</p></body></html>';
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: baselineWithVersion },
        [TRIGGER]: {
          status: 404,
          headers: {},
          body: '<html><body><h1>Not Found</h1><address>Apache/2.4.52 (Debian) Server at localhost Port 80</address></body></html>',
        },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a version in a soft-200 error page body is NOT scanned (4xx/5xx only)', async () => {
    const findings = await probeFingerprintBanner(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [TRIGGER]: {
          status: 200,
          headers: {},
          body: '<html><body><h1>Not Found</h1><address>Apache/2.4.52 (Debian) Server at localhost Port 80</address></body></html>',
        },
      }),
    });
    assert.equal(findings.length, 0);
  });
});
