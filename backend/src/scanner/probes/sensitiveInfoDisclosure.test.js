// Sensitive information disclosure (general) (#181) — no network,
// no lab needed. Fetches go through the opts.fetchPage seam, and
// fixtures are plain strings built in-code. Internal IP/hostname
// fixtures are not secret-shaped (no GH013 literals anywhere).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSensitiveInfoDisclosure,
  detectSensitiveInfoDisclosure,
  buildDisclosureTargets,
  isDisclosureSurface,
  isPrivateIPv4,
  isInternalHostname,
} from './sensitiveInfoDisclosure.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://example.com/';
const API_USERS = 'http://example.com/api/users';
const API_CONFIG = 'http://example.com/api/config';
const API_STATUS = 'http://example.com/api/status';
const API_ORDERS = 'http://example.com/api/orders';
const ABOUT = 'http://example.com/about';
const API_DEBUG = 'http://example.com/api/debug';

const BASELINE =
  '<html><head><title>Example</title></head><body>' +
  '<h1>Welcome</h1><form><input name="username"><input name="password" type="password">' +
  '<p>Docs: read the guide.</p></form></body></html>';

const IP_BODY = '{"status":"ok","db_host":"10.1.2.3"}';
const IP172_BODY = '{"status":"ok","cache":"172.20.4.15"}';
const IP192_BODY = '{"status":"ok","gateway":"192.168.1.100"}';
const HOST_BODY = '{"status":"ok","db":"db.internal","cache":"cache01.corp"}';
const BOTH_BODY = '{"status":"ok","db_host":"10.4.5.6","db":"db.internal"}';
const COMMENT_BODY =
  '<html><body><!-- internal db at 10.9.8.7, do not expose --><h1>About</h1></body></html>';
const BENIGN_BODY = '{"status":"ok","users":[{"id":1,"name":"alice"}]}';

// fetchPage seam: map URL -> { status, body }. Unknown URLs 404.
function fetchPageFor(bodies, calls) {
  return async (url) => {
    if (Array.isArray(calls)) calls.push(String(url));
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('detectSensitiveInfoDisclosure', () => {
  const check = { baselineBody: BASELINE, catchAllBody: '', url: API_USERS, targetHost: 'example.com' };

  it('a 10.x private IP fires (internal-ip)', () => {
    const leaks = detectSensitiveInfoDisclosure(IP_BODY, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'internal-ip');
    assert.equal(leaks[0].value, '10.1.2.3');
  });

  it('a 172.16-31.x private IP fires', () => {
    const leaks = detectSensitiveInfoDisclosure(IP172_BODY, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'internal-ip');
    assert.equal(leaks[0].value, '172.20.4.15');
  });

  it('a 192.168.x private IP fires', () => {
    const leaks = detectSensitiveInfoDisclosure(IP192_BODY, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'internal-ip');
    assert.equal(leaks[0].value, '192.168.1.100');
  });

  it("the target's own host IP does NOT fire", () => {
    const body = '{"status":"ok","self":"172.17.0.1","port":3100}';
    const leaks = detectSensitiveInfoDisclosure(body, {
      baselineBody: BASELINE,
      catchAllBody: '',
      url: API_USERS,
      targetHost: '172.17.0.1',
    });
    assert.deepEqual(leaks, []);
  });

  it('a public IP does NOT fire', () => {
    const body = '{"status":"ok","dns":"8.8.8.8","cdn":"203.0.113.5"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('localhost / loopback does NOT fire', () => {
    const body = '{"status":"ok","local":"127.0.0.1:3000"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('an out-of-range 172.32.x address does NOT fire', () => {
    const body = '{"status":"ok","peer":"172.32.0.5"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('an invalid octet (10.999.1.2) does NOT fire', () => {
    const body = '{"status":"ok","weird":"10.999.1.2"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('internal hostnames fire (.internal, .corp, .local, .lan, .intranet, .private)', () => {
    const body = 'hosts: db.internal cache01.corp ntp.local fs.lan portal.intranet vault.private';
    const leaks = detectSensitiveInfoDisclosure(body, check);
    assert.equal(leaks.length, 6);
    assert.ok(leaks.every((l) => l.kind === 'internal-hostname'));
  });

  it('a public hostname does NOT fire', () => {
    const body = '{"status":"ok","api":"https://api.example.com/v1","cdn":"cdn.example.net"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('an internal-looking subdomain of a public domain does NOT fire', () => {
    const body = '{"status":"ok","link":"https://foo.internal.example.com/docs"}';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it("the target's own internal hostname does NOT fire", () => {
    const body = '{"status":"ok","self":"app.internal"}';
    const leaks = detectSensitiveInfoDisclosure(body, {
      baselineBody: BASELINE,
      catchAllBody: '',
      url: API_USERS,
      targetHost: 'app.internal',
    });
    assert.deepEqual(leaks, []);
  });

  it('a value already printed on the baseline page does NOT fire', () => {
    const leaks = detectSensitiveInfoDisclosure(IP_BODY, {
      baselineBody: `${BASELINE}<p>db host 10.1.2.3 (public demo)</p>`,
      catchAllBody: '',
      url: API_USERS,
      targetHost: 'example.com',
    });
    assert.deepEqual(leaks, []);
  });

  it('a body identical to the catch-all control never fires', () => {
    const leaks = detectSensitiveInfoDisclosure(IP_BODY, {
      baselineBody: BASELINE,
      catchAllBody: IP_BODY,
      url: API_USERS,
      targetHost: 'example.com',
    });
    assert.deepEqual(leaks, []);
  });

  it('a binary body (NUL bytes) never fires', () => {
    const body = 'PNG\x00\x00\x0010.1.2.3\x00binary';
    assert.deepEqual(detectSensitiveInfoDisclosure(body, check), []);
  });

  it('an empty body returns no leaks', () => {
    assert.deepEqual(detectSensitiveInfoDisclosure('', check), []);
    assert.deepEqual(detectSensitiveInfoDisclosure(null, check), []);
  });

  it('the same IP twice is one leak (dedup)', () => {
    const body = '{"a":"10.1.2.3","b":"10.1.2.3"}';
    const leaks = detectSensitiveInfoDisclosure(body, check);
    assert.equal(leaks.length, 1);
  });

  it('two distinct private IPs are two leaks', () => {
    const body = '{"a":"10.1.2.3","b":"192.168.1.100"}';
    const leaks = detectSensitiveInfoDisclosure(body, check);
    assert.equal(leaks.length, 2);
  });

  it('an internal IP inside an HTML comment fires', () => {
    const leaks = detectSensitiveInfoDisclosure(COMMENT_BODY, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'internal-ip');
    assert.equal(leaks[0].value, '10.9.8.7');
  });

  it('an internal IP inside an absolute internal URL fires', () => {
    const body = '{"status":"ok","internal":"http://10.2.3.4:8080/admin"}';
    const leaks = detectSensitiveInfoDisclosure(body, check);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].value, '10.2.3.4');
  });
});

describe('isPrivateIPv4 / isInternalHostname', () => {
  it('isPrivateIPv4 accepts only RFC1918 with valid octets', () => {
    assert.equal(isPrivateIPv4('10.0.0.1'), true);
    assert.equal(isPrivateIPv4('10.255.255.255'), true);
    assert.equal(isPrivateIPv4('172.16.0.1'), true);
    assert.equal(isPrivateIPv4('172.31.255.255'), true);
    assert.equal(isPrivateIPv4('172.32.0.1'), false);
    assert.equal(isPrivateIPv4('172.15.0.1'), false);
    assert.equal(isPrivateIPv4('192.168.0.1'), true);
    assert.equal(isPrivateIPv4('192.169.0.1'), false);
    assert.equal(isPrivateIPv4('8.8.8.8'), false);
    assert.equal(isPrivateIPv4('10.999.1.2'), false);
    assert.equal(isPrivateIPv4('not-an-ip'), false);
    assert.equal(isPrivateIPv4(''), false);
  });

  it('isInternalHostname accepts only internal-TLD hostnames', () => {
    assert.equal(isInternalHostname('db.internal'), true);
    assert.equal(isInternalHostname('a.b.corp'), true);
    assert.equal(isInternalHostname('cache01.local'), true);
    assert.equal(isInternalHostname('example.com'), false);
    assert.equal(isInternalHostname('internal.example.com'), false);
    assert.equal(isInternalHostname('internal'), false);
    assert.equal(isInternalHostname(''), false);
  });
});

describe('buildDisclosureTargets', () => {
  it('orchestrator URLs are included, the pasted page itself is excluded', () => {
    const targets = buildDisclosureTargets(PAGE, [API_USERS, PAGE, API_CONFIG], '');
    const urls = targets.map((t) => t.url);
    assert.ok(urls.includes(API_USERS));
    assert.ok(urls.includes(API_CONFIG));
    assert.ok(!urls.includes(PAGE));
  });

  it('.js/.ts/.css/.map candidates are never included', () => {
    const targets = buildDisclosureTargets(PAGE, [
      'http://example.com/bundle.js',
      'http://example.com/app.ts',
      'http://example.com/style.css',
      'http://example.com/app.js.map',
    ], '');
    assert.deepEqual(targets, []);
  });

  it('.log/.jsonl candidates are never included', () => {
    const targets = buildDisclosureTargets(PAGE, [
      'http://example.com/app.log',
      'http://example.com/events.jsonl',
    ], '');
    assert.deepEqual(targets, []);
  });

  it('backup/source candidates (.bak, .old, .sql, .env, /.git/config) are never included', () => {
    const targets = buildDisclosureTargets(PAGE, [
      'http://example.com/config.php.bak',
      'http://example.com/data.sql',
      'http://example.com/.env',
      'http://example.com/.git/config',
      'http://example.com/index.php.old',
    ], '');
    assert.deepEqual(targets, []);
  });

  it('image/binary extensions are never included', () => {
    const targets = buildDisclosureTargets(PAGE, [
      'http://example.com/photo.png',
      'http://example.com/doc.pdf',
      'http://example.com/font.woff2',
    ], '');
    assert.deepEqual(targets, []);
  });

  it('cross-origin URLs are excluded', () => {
    const targets = buildDisclosureTargets(PAGE, [
      'https://evil.example.com/api/users',
      API_USERS,
    ], '');
    assert.deepEqual(targets.map((t) => t.url), [API_USERS]);
  });

  it('<a> links to API pages are mined, cross-origin excluded', () => {
    const html =
      '<a href="/api/debug">debug</a><a href="https://evil.example.com/api">evil</a>' +
      '<a href="/bundle.js">js</a>';
    const targets = buildDisclosureTargets(PAGE, [], html);
    assert.ok(targets.some((t) => t.url === API_DEBUG));
    assert.ok(!targets.some((t) => t.url.includes('evil.example.com')));
    assert.ok(!targets.some((t) => t.url.endsWith('/bundle.js')));
  });

  it('targets are deduped and capped at 10', () => {
    const many = Array.from({ length: 20 }, (_, i) => `http://example.com/api/a${i}`);
    const targets = buildDisclosureTargets(PAGE, many, '');
    assert.equal(targets.length, 10);
    assert.equal(new Set(targets.map((t) => t.url)).size, 10);
  });

  it('an unparseable page URL returns no targets', () => {
    assert.deepEqual(buildDisclosureTargets('not a url', [], ''), []);
  });
});

describe('isDisclosureSurface', () => {
  it('accepts plain API/HTML paths, rejects owned or binary surfaces', () => {
    assert.equal(isDisclosureSurface(API_USERS), true);
    assert.equal(isDisclosureSurface('http://example.com/about'), true);
    assert.equal(isDisclosureSurface('http://example.com/bundle.js'), false);
    assert.equal(isDisclosureSurface('http://example.com/app.log'), false);
    assert.equal(isDisclosureSurface('http://example.com/.git/config'), false);
    assert.equal(isDisclosureSurface('http://example.com/photo.jpg'), false);
    assert.equal(isDisclosureSurface('not a url'), false);
  });
});

describe('probeSensitiveInfoDisclosure', () => {
  it('an internal IP in /api/users is one High finding and verifyFindings confirms it', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_USERS]: { status: 200, body: IP_BODY },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sensitive_info_disclosure');
    assert.equal(findings[0].severity, 'high');
    assert.ok(findings[0].title.includes('10.1.2.3'));
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('an internal hostname in /api/config fires', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_CONFIG], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_CONFIG]: { status: 200, body: HOST_BODY },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.class === 'sensitive_info_disclosure'));
    assert.ok(findings.some((f) => f.title.includes('db.internal')));
    assert.ok(findings.some((f) => f.title.includes('cache01.corp')));
  });

  it('an internal IP in an HTML comment on /about fires', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [ABOUT], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [ABOUT]: { status: 200, body: COMMENT_BODY },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title.includes('10.9.8.7'), true);
  });

  it('two kinds on one URL are two findings', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_STATUS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_STATUS]: { status: 200, body: BOTH_BODY },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.title.includes('internal IP')));
    assert.ok(findings.some((f) => f.title.includes('internal hostname')));
  });

  it('internal IPs on two different URLs are two findings', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS, API_ORDERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_USERS]: { status: 200, body: IP_BODY },
        [API_ORDERS]: { status: 200, body: IP192_BODY },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.url === API_USERS));
    assert.ok(findings.some((f) => f.url === API_ORDERS));
  });

  it('the fetch budget is respected (baseline + catch-all + at most 10 candidate fetches)', async () => {
    const calls = [];
    const bodies = { [PAGE]: { status: 200, body: BASELINE } };
    for (let i = 0; i < 12; i += 1) {
      bodies[`http://example.com/api/x${i}`] = { status: 200, body: `{"db":"10.0.0.${i + 1}"}` };
    }
    const urls = Array.from({ length: 12 }, (_, i) => `http://example.com/api/x${i}`);
    const findings = await probeSensitiveInfoDisclosure(PAGE, urls, { fetchPage: fetchPageFor(bodies, calls) });
    assert.equal(calls.length, 12);
    assert.equal(findings.length, 10);
  });

  it('an internal IP on a page-link target fires', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: `${BASELINE}<a href="/api/debug">debug</a>` },
        [API_DEBUG]: { status: 200, body: IP172_BODY },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, API_DEBUG);
  });

  it('a value already on the baseline page fires nothing', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: `${BASELINE}<p>db host 10.1.2.3 (public demo)</p>` },
        [API_USERS]: { status: 200, body: IP_BODY },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a body identical to the catch-all control fires nothing', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        'http://example.com/dm-nonexistent-7b31e9d2.txt': { status: 200, body: IP_BODY },
        [API_USERS]: { status: 200, body: IP_BODY },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a benign API response fires nothing', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_USERS]: { status: 200, body: BENIGN_BODY },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a non-200 candidate fires nothing', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [API_USERS], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: BASELINE },
        [API_USERS]: { status: 404, body: IP_BODY },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a .js URL in the orchestrator list is never fetched', async () => {
    const calls = [];
    const findings = await probeSensitiveInfoDisclosure(PAGE, ['http://example.com/bundle.js', API_USERS], {
      fetchPage: fetchPageFor(
        {
          [PAGE]: { status: 200, body: BASELINE },
          [API_USERS]: { status: 200, body: BENIGN_BODY },
        },
        calls
      ),
    });
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => c.endsWith('/bundle.js')));
  });

  it('a .log URL in the orchestrator list is never fetched', async () => {
    const calls = [];
    const findings = await probeSensitiveInfoDisclosure(PAGE, ['http://example.com/app.log', API_USERS], {
      fetchPage: fetchPageFor(
        {
          [PAGE]: { status: 200, body: BASELINE },
          [API_USERS]: { status: 200, body: BENIGN_BODY },
        },
        calls
      ),
    });
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => c.endsWith('/app.log')));
  });

  it('a throwing fetchPage never throws out of the probe', async () => {
    const findings = await probeSensitiveInfoDisclosure(PAGE, [], {
      fetchPage: async () => {
        throw new Error('network down');
      },
    });
    assert.deepEqual(findings, []);
  });
});
