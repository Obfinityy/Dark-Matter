// Tests for the sensitive-data-in-browser-storage probe
// (coverage row #97 [Medium], phase 85).
// No network, no lab needed — the probe fetches bundles through the
// opts.fetchPage seam, stubbed here; inline scripts are scanned
// directly from the page body.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeBrowserStorage,
  SENSITIVE_STORAGE_KEYS,
} from './browserStorage.js';
import { verifyFindings } from '../verifier.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://lab.local/';
const BUNDLE_URL = 'http://lab.local/main.js';

// Stub fetchPage: maps bundle URLs to bodies.
function fetchBodies(bodies) {
  return async (url) => ({ status: 200, body: bodies[url] || '' });
}

async function probeInline(body, pageUrl = PAGE_URL) {
  return probeBrowserStorage(pageUrl, { bundles: [], inline: [body] }, {});
}

describe('SENSITIVE_STORAGE_KEYS', () => {
  it('is the documented allowlist', () => {
    assert.deepEqual(
      [...SENSITIVE_STORAGE_KEYS].sort(),
      [
        'access_token',
        'accessToken',
        'api_key',
        'apiKey',
        'apikey',
        'auth',
        'auth_token',
        'authtoken',
        'bearer',
        'credential',
        'credentials',
        'id_token',
        'idToken',
        'jwt',
        'passwd',
        'password',
        'refresh_token',
        'refreshToken',
        'secret',
        'session',
        'session_id',
        'session_token',
        'sessionid',
        'token',
      ].sort()
    );
  });
  it('email is deliberately excluded from v1', () => {
    assert.equal(SENSITIVE_STORAGE_KEYS.has('email'), false);
  });
});

describe('probeBrowserStorage', () => {
  it("(a) localStorage.setItem('token', jwtVar) fires", async () => {
    const findings = await probeInline("localStorage.setItem('token', jwtVar);");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'browser_storage');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].id, 'browser-storage-localStorage-token');
    assert.ok(findings[0].title.includes('localStorage'));
    assert.ok(findings[0].title.includes("'token'"));
    assert.equal(findings[0].url, PAGE_URL);
    assert.equal(findings[0].parameter, 'token');
  });
  it("(b) sessionStorage.setItem('session_token', x) fires", async () => {
    const findings = await probeInline("sessionStorage.setItem('session_token', x);");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'browser-storage-sessionStorage-session_token');
    assert.ok(findings[0].title.includes('sessionStorage'));
    assert.ok(findings[0].title.includes('tab-scoped'));
  });
  it("(c) localStorage.setItem('theme', 'dark') does not fire", async () => {
    const findings = await probeInline("localStorage.setItem('theme', 'dark');");
    assert.deepEqual(findings, []);
  });
  it("(d) localStorage.getItem('token') is a read and does not fire", async () => {
    const findings = await probeInline("const t = localStorage.getItem('token');");
    assert.deepEqual(findings, []);
  });
  it('(e) a variable key does not fire', async () => {
    const findings = await probeInline('localStorage.setItem(variableKey, x);');
    assert.deepEqual(findings, []);
  });
  it("(f) a placeholder literal value does not fire", async () => {
    // Fixture value built by concatenation (GH013): the probe sees
    // the literal 'test-token-123', which the placeholder gate kills.
    const body = `localStorage.setItem('token', '${'test-' + 'token-123'}');`;
    const findings = await probeInline(body);
    assert.deepEqual(findings, []);
  });
  it('(g) direct assignment localStorage.token = x fires', async () => {
    const findings = await probeInline('localStorage.token = x;');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'browser-storage-localStorage-token');
  });
  it("(h) window.sessionStorage.setItem('password', x) fires", async () => {
    const findings = await probeInline("window.sessionStorage.setItem('password', x);");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'browser-storage-sessionStorage-password');
  });
  it('(i) a non-sensitive key with a sensitive-looking value does not fire', async () => {
    const findings = await probeInline(
      "localStorage.setItem('theme', 'token-secret-value');"
    );
    assert.deepEqual(findings, []);
  });
  it('Juice shape — double-quoted setItem("token", a.token) fires', async () => {
    const findings = await probeBrowserStorage(
      PAGE_URL,
      { bundles: [BUNDLE_URL], inline: [] },
      { fetchPage: fetchBodies({ [BUNDLE_URL]: 'localStorage.setItem("token",a.token)' }) }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, BUNDLE_URL);
    assert.ok(findings[0].evidence.response.includes('line 1'));
  });
  it("an 'email' write does not fire (excluded from v1)", async () => {
    const findings = await probeInline(
      "localStorage.setItem('email', this.user.email);"
    );
    assert.deepEqual(findings, []);
  });
  it("a 'totp_tmp_token' write does not fire (not an exact allowlist name)", async () => {
    const findings = await probeInline(
      "localStorage.setItem('totp_tmp_token', o.data.tmpToken);"
    );
    assert.deepEqual(findings, []);
  });
  it("bracket assignment localStorage['api_key'] = x fires", async () => {
    const findings = await probeInline("localStorage['api_key'] = x;");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'browser-storage-localStorage-api_key');
  });
  it("a comparison read (localStorage.token == 'x') does not fire as a write", async () => {
    const findings = await probeInline("if (localStorage.token == 'x') { doThing(); }");
    assert.deepEqual(findings, []);
  });
  it('a bare read (var t = localStorage.token) does not fire', async () => {
    const findings = await probeInline('var t = localStorage.token;');
    assert.deepEqual(findings, []);
  });
  it("'token' in localStorage does not fire", async () => {
    const findings = await probeInline("if ('token' in localStorage) { doThing(); }");
    assert.deepEqual(findings, []);
  });
  it('the same store+key in two bundles is one finding', async () => {
    const body = "localStorage.setItem('token', a.token);";
    const findings = await probeBrowserStorage(
      PAGE_URL,
      { bundles: ['http://lab.local/a.js', 'http://lab.local/b.js'], inline: [] },
      {
        fetchPage: fetchBodies({
          'http://lab.local/a.js': body,
          'http://lab.local/b.js': body,
        }),
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, 'http://lab.local/a.js');
  });
  it('cap: six distinct writes yield at most five findings', async () => {
    const body =
      "localStorage.setItem('token', a);\n" +
      "localStorage.setItem('password', b);\n" +
      "localStorage.setItem('secret', c);\n" +
      "sessionStorage.setItem('session_token', d);\n" +
      "localStorage.setItem('api_key', e);\n" +
      "sessionStorage.setItem('jwt', f);";
    const findings = await probeInline(body);
    assert.equal(findings.length, 5);
    assert.equal(
      findings.some((f) => f.id === 'browser-storage-sessionStorage-jwt'),
      false
    );
  });
  it('a literal value is redacted in the snippet', async () => {
    // Long literal built by concatenation (GH013); the probe sees
    // 'long-literal-value-9876543210' and must redact it to first 4 +
    // '…' + last 4. The literal carries no placeholder marker.
    const val = 'long-' + 'literal-' + 'value-' + '9876543210';
    const findings = await probeInline(`localStorage.setItem('token', '${val}');`);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].evidence.response.includes('long…3210'));
    assert.equal(findings[0].evidence.response.includes(val), false);
  });
  it('the finding names the store and its persistence (localStorage)', async () => {
    const findings = await probeInline("localStorage.setItem('token', x);");
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('survives browser restart'));
    assert.ok(findings[0].evidence.response.includes('persists across browser restarts'));
  });
  it('the finding names the store and its persistence (sessionStorage)', async () => {
    const findings = await probeInline("sessionStorage.setItem('token', x);");
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('tab-scoped'));
    assert.ok(findings[0].evidence.response.includes('tab-scoped'));
    assert.equal(findings[0].evidence.response.includes('survives browser restart'), false);
  });
  it('the finding survives verifyFindings as confirmed', async () => {
    const findings = await probeInline("localStorage.setItem('token', jwtVar);");
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('differential routing: default protocol confirms on signalCorrelated', async () => {
    const findings = await probeInline("localStorage.setItem('token', jwtVar);");
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });
  it('empty targets return []', async () => {
    assert.deepEqual(await probeBrowserStorage(PAGE_URL, { bundles: [], inline: [] }, {}), []);
    assert.deepEqual(await probeBrowserStorage(PAGE_URL, undefined, {}), []);
    assert.deepEqual(await probeBrowserStorage(PAGE_URL, null, {}), []);
  });
  it('a non-200 bundle is skipped', async () => {
    const findings = await probeBrowserStorage(
      PAGE_URL,
      { bundles: [BUNDLE_URL], inline: [] },
      { fetchPage: async () => ({ status: 404, body: "localStorage.setItem('token', x);" }) }
    );
    assert.deepEqual(findings, []);
  });
  it('a bundle fetch failure does not break the scan — inline still fires', async () => {
    const findings = await probeBrowserStorage(
      PAGE_URL,
      { bundles: [BUNDLE_URL], inline: ["localStorage.setItem('token', x);"] },
      {
        fetchPage: async (url) => {
          if (url === BUNDLE_URL) throw new Error('boom');
          return { status: 200, body: '' };
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, PAGE_URL);
  });
});
