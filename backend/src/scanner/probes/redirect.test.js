// Tests for the open-redirect probe (#94 base leg, #401/#403/#470 variant legs).
// The mock server simulates a target whose URL parser normalises a variant
// value to the attacker host (Location: https://evil.example/) — the bypass
// the variant legs exist to catch. `behavior` selects which value classes
// the mock redirects, so each test proves one leg independently:
// a server that blocks the plain value but falls to a variant must still
// produce exactly one finding, with the variant named in the evidence.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeOpenRedirect } from './redirect.js';

const BASE = 'https://evil.example/';
// Variant classes, mirroring redirect.js VARIANT_GROUPS.
const PROTOCOL = ['//evil.example', '/\\evil.example', 'https://evil.example\\'];
const USERINFO = ['https://trusted.com@evil.example', 'https://evil.example%40trusted.com'];
const UNICODE = [
  'https://evil。example/',
  'https://ｅｖｉｌ.example/',
  'https://xn--vil-qdd.example/',
  'https:%C0%AF%2Fevil.example',
];

describe('redirect probe', () => {
  let server;
  let port;
  let requests;
  // Which value classes the mock redirects to the attacker host.
  let behavior = { base: true, protocol: true, userinfo: true, unicode: true };
  const base = () => `http://127.0.0.1:${port}`;

  // Classify a decoded `next` value the way a lenient server parser would.
  function redirectTargetFor(value) {
    if (value === BASE) return behavior.base ? BASE : null;
    if (PROTOCOL.includes(value)) return behavior.protocol ? BASE : null;
    if (USERINFO.includes(value)) return behavior.userinfo ? BASE : null;
    if (UNICODE.includes(value)) return behavior.unicode ? BASE : null;
    return null;
  }

  before(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.url);
      const u = new URL(req.url, base());
      // Special paths answer regardless of the value (they test the
      // oracle itself: 200 + evil in body, or 200 + Location header).
      if (u.pathname === '/body-echo') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>see ${BASE} here</html>`);
        return;
      }
      if (u.pathname === '/location-200') {
        res.writeHead(200, { Location: BASE });
        res.end();
        return;
      }
      // Value under test: the query param carrying a probe value (base or
      // variant), or path segment 2 for path points. The mock does not
      // know which param the probe mutated, so it looks for a value in
      // the known probe-value set.
      const ALL_VALUES = [BASE, ...PROTOCOL, ...USERINFO, ...UNICODE];
      let value = null;
      for (const v of u.searchParams.values()) {
        if (ALL_VALUES.includes(v)) { value = v; break; }
      }
      value ??= decodeURIComponent(u.pathname.split('/')[2] || '');
      const target = redirectTargetFor(value || '');
      if (target) {
        res.writeHead(302, { Location: target });
        res.end();
        return;
      }
      res.writeHead(302, { Location: '/home' });
      res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('base leg: vulnerable page fires one medium finding per param', async () => {
    behavior = { base: true, protocol: true, userinfo: true, unicode: true };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'open_redirect');
    assert.equal(findings[0].id, 'open-redirect-next');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].param, 'next');
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.match(findings[0].evidence.request, /evil\.example/);
  });

  it('base leg: safe page (redirect elsewhere) stays silent', async () => {
    behavior = { base: false, protocol: false, userinfo: false, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('base leg: 200 with evil.example in the body is NOT a redirect finding', async () => {
    behavior = { base: true, protocol: true, userinfo: true, unicode: true };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/body-echo?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('base leg: 200 carrying a Location header is NOT a redirect finding', async () => {
    behavior = { base: true, protocol: true, userinfo: true, unicode: true };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/location-200?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('#401: server blocking the plain value but falling to //evil.example is caught', async () => {
    behavior = { base: false, protocol: true, userinfo: false, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'open_redirect');
    assert.equal(findings[0].id, 'open-redirect-protocol-relative-next');
    assert.equal(findings[0].evidence.variant, '//evil.example');
    assert.equal(findings[0].evidence.coverageRow, 401);
    assert.match(findings[0].title, /protocol-relative/);
  });

  it('#401: backslash variant /\\evil.example is sent and caught', async () => {
    // The mock redirects only the backslash variant: prove the probe tries
    // past the first protocol-relative value instead of stopping at it.
    // (The mock's protocol class redirects on any protocol value, so this
    // test asserts the value is SENT on a server that redirects none of
    // them, and the firing case is covered by the //evil.example test.)
    behavior = { base: false, protocol: false, userinfo: false, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
    const sent = requests.map((u) => new URL(u, base()).searchParams.get('next'));
    assert.ok(sent.includes('/\\evil.example'), `backslash variant never sent; sent: ${sent.join(' | ')}`);
    assert.ok(sent.includes('https://evil.example\\'), 'trailing-backslash variant never sent');
  });

  it('#403: server falling to the @ trick is caught with the userinfo variant named', async () => {
    behavior = { base: false, protocol: false, userinfo: true, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'open-redirect-userinfo-next');
    assert.equal(findings[0].evidence.variant, 'https://trusted.com@evil.example');
    assert.equal(findings[0].evidence.coverageRow, 403);
  });

  it('#403: encoded-@ variant https://evil.example%40trusted.com is sent', async () => {
    behavior = { base: false, protocol: false, userinfo: false, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
    const sent = requests.map((u) => new URL(u, base()).searchParams.get('next'));
    assert.ok(sent.includes('https://evil.example%40trusted.com'), 'encoded-@ variant never sent');
  });

  it('#470: server falling to a unicode/IDN variant is caught', async () => {
    behavior = { base: false, protocol: false, userinfo: false, unicode: true };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'open-redirect-unicode-idn-next');
    assert.equal(findings[0].evidence.coverageRow, 470);
    assert.equal(findings[0].evidence.variant, 'https://evil。example/');
  });

  it('#470: all four unicode variants are sent (ideographic dot, full-width, punycode, overlong UTF-8)', async () => {
    behavior = { base: false, protocol: false, userinfo: false, unicode: false };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x`, ['next'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
    const sent = requests.map((u) => new URL(u, base()).searchParams.get('next'));
    for (const v of UNICODE) {
      assert.ok(sent.includes(v), `unicode variant never sent: ${v}`);
    }
  });

  it('one finding per param: base fires first, variants are not retried for that param', async () => {
    behavior = { base: true, protocol: true, userinfo: true, unicode: true };
    requests = [];
    const findings = await probeOpenRedirect(`${base()}/r?next=x&to=y`, ['next', 'to'], { timeoutMs: 5000 });
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((f) => f.id), ['open-redirect-next', 'open-redirect-to']);
    // Exactly one request per param: the base value fired, no variant tried.
    assert.equal(requests.length, 2);
  });

  it('path point: variant value in a path segment is caught the same way', async () => {
    behavior = { base: false, protocol: true, userinfo: false, unicode: false };
    requests = [];
    const points = [{ kind: 'path', name: 'id', segment: 2 }];
    const findings = await probeOpenRedirect(`${base()}/items/123`, points, { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'open-redirect-protocol-relative-id');
    assert.equal(findings[0].param, 'id (path)');
  });

  it('param cap: only the first 10 params are attempted', async () => {
    behavior = { base: false, protocol: false, userinfo: false, unicode: false };
    requests = [];
    const params = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const qs = params.map((p) => `${p}=x`).join('&');
    const findings = await probeOpenRedirect(`${base()}/r?${qs}`, params, { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
    // The request URL carries all 12 params; the attempted one is the
    // param whose value is no longer the placeholder 'x'.
    const attempted = new Set(requests.map((u) => {
      for (const [k, v] of new URL(u, base()).searchParams) if (v !== 'x') return k;
      return null;
    }));
    assert.equal(attempted.size, 10);
    assert.ok(!attempted.has('p11') && !attempted.has('p12'), 'params past the cap were attempted');
    // Worst-case budget: 10 params x (1 base + 9 variants) requests.
    assert.equal(requests.length, 100);
  });

  it('returns [] with no params', async () => {
    const findings = await probeOpenRedirect(`${base()}/r`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
