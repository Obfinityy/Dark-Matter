// Dark Matter scanner — stored XSS URI-scheme leg tests
// (row #272 [Medium] XSS — JavaScript URI / data URI, fix lane
// 14 Nov 2026). Tests written BEFORE the implementation (test-first):
// probeStoredXssUriScheme does not exist yet, so these fail until it lands.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

// Mock server: POST stores submitted values; GET renders stored values —
// URI-scheme values inside an <a href>, everything else as plain text.
function mockFetchFactory() {
  const stored = [];
  return async (url, { method = 'GET', body } = {}) => {
    if (String(method).toUpperCase() === 'POST') {
      const params = new URLSearchParams(String(body || ''));
      for (const v of params.values()) stored.push(v);
      return { text: async () => '<html>saved</html>' };
    }
    const rendered = stored.map((v) =>
      /^(javascript:|data:text\/html,)/i.test(v) ? `<a href="${v}">link</a>` : v).join(' | ');
    return { text: async () => `<html>guestbook: ${rendered}</html>` };
  };
}

const forms = [{
  action: 'http://example.com/guestbook',
  method: 'post',
  inputs: [
    { name: 'name', type: 'text', value: '' },
    { name: 'message', type: 'text', value: '' },
  ],
}];

describe('probeStoredXssUriScheme (row #272, stored leg)', () => {
  it('confirms a stored javascript: URI re-rendered in an href attribute', async () => {
    globalThis.fetch = mockFetchFactory();
    const { probeStoredXssUriScheme } = await import('./storedXss.js');
    const findings = await probeStoredXssUriScheme(forms, 'http://example.com/', { timeoutMs: 5000 });
    const js = findings.filter((f) => f.class === 'xss_uri_scheme_stored' && f.evidence.scheme === 'javascript:');
    assert.equal(js.length, 1);
    assert.equal(js[0].severity, 'medium');
    assert.ok(js[0].evidence.canaryReflected);
  });

  it('confirms a stored data:text/html URI re-rendered in an href attribute', async () => {
    globalThis.fetch = mockFetchFactory();
    const { probeStoredXssUriScheme } = await import('./storedXss.js');
    const findings = await probeStoredXssUriScheme(forms, 'http://example.com/', { timeoutMs: 5000 });
    const data = findings.filter((f) => f.class === 'xss_uri_scheme_stored' && f.evidence.scheme === 'data:text/html,');
    assert.equal(data.length, 1);
    assert.ok(data[0].evidence.canaryReflected);
  });

  it('stays quiet when nothing persists', async () => {
    globalThis.fetch = async () => ({ text: async () => '<html>static page</html>' });
    const { probeStoredXssUriScheme } = await import('./storedXss.js');
    const findings = await probeStoredXssUriScheme(forms, 'http://example.com/', { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });
});

describe('probeStoredXss plain canary (regression)', () => {
  it('still confirms when the plain canary persists and re-renders', async () => {
    globalThis.fetch = mockFetchFactory();
    const { probeStoredXss } = await import('./storedXss.js');
    const findings = await probeStoredXss(forms, 'http://example.com/', { timeoutMs: 5000 });
    const sx = findings.filter((f) => f.class === 'xss_stored');
    assert.equal(sx.length, 2);
    assert.ok(sx[0].evidence.canaryReflected);
  });
});
