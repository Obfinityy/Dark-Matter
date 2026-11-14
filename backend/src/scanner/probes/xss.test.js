// Dark Matter scanner — reflected XSS probe tests, incl. the URI-scheme
// leg (row #272 [Medium] XSS — JavaScript URI / data URI, fix lane
// 14 Nov 2026). Tests written BEFORE the implementation (test-first):
// probeXssUriScheme does not exist yet, so these fail until the leg lands.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

// Mock server: echoes the sent param value back inside the attribute
// named by `mode`, or as plain text, or percent-encoded (neutralised).
function mockFetchFactory(mode) {
  return async (url) => {
    const u = new URL(String(url));
    const value = u.searchParams.get('q') ?? '';
    let body;
    if (mode === 'attr-href') body = `<html><a href="${value}">link</a></html>`;
    else if (mode === 'attr-src') body = `<html><img src="${value}" alt="x"></html>`;
    else if (mode === 'text') body = `<html><p>you said ${value}</p></html>`;
    else if (mode === 'encoded') body = `<html><a href="${value.replace(/:/g, '%3A')}">link</a></html>`;
    else body = '<html>static page</html>';
    return { text: async () => body };
  };
}

describe('probeXssUriScheme (row #272)', () => {
  it('confirms a javascript: URI reflected verbatim in an href attribute', async () => {
    globalThis.fetch = mockFetchFactory('attr-href');
    const { probeXssUriScheme } = await import('./xss.js');
    const findings = await probeXssUriScheme('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    const js = findings.filter((f) => f.class === 'xss_uri_scheme' && f.evidence.scheme === 'javascript:');
    assert.equal(js.length, 1);
    assert.equal(js[0].severity, 'medium');
    assert.ok(js[0].evidence.canaryReflected);
    assert.ok(js[0].title.includes('javascript:'));
  });

  it('confirms a data:text/html URI reflected verbatim in a src attribute', async () => {
    globalThis.fetch = mockFetchFactory('attr-src');
    const { probeXssUriScheme } = await import('./xss.js');
    const findings = await probeXssUriScheme('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    const data = findings.filter((f) => f.class === 'xss_uri_scheme' && f.evidence.scheme === 'data:text/html,');
    assert.equal(data.length, 1);
    assert.equal(data[0].severity, 'medium');
    assert.ok(data[0].evidence.canaryReflected);
  });

  it('stays quiet when the URI value echoes as plain text (no attribute context)', async () => {
    globalThis.fetch = mockFetchFactory('text');
    const { probeXssUriScheme } = await import('./xss.js');
    const findings = await probeXssUriScheme('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });

  it('stays quiet when the scheme is percent-encoded in the reflection (not verbatim)', async () => {
    globalThis.fetch = mockFetchFactory('encoded');
    const { probeXssUriScheme } = await import('./xss.js');
    const findings = await probeXssUriScheme('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });

  it('stays quiet on a benign page with no reflection', async () => {
    globalThis.fetch = mockFetchFactory('static');
    const { probeXssUriScheme } = await import('./xss.js');
    const findings = await probeXssUriScheme('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });
});

describe('probeXssReflected (regression)', () => {
  it('confirms when the break-out canary reflects verbatim', async () => {
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const value = u.searchParams.get('q') ?? '';
      return { text: async () => `<html><p>${value}</p></html>` };
    };
    const { probeXssReflected } = await import('./xss.js');
    const findings = await probeXssReflected('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    const rx = findings.filter((f) => f.class === 'xss_reflected');
    assert.equal(rx.length, 1);
    assert.ok(rx[0].evidence.canaryReflected);
  });

  it('stays quiet when the canary is HTML-encoded on reflection', async () => {
    globalThis.fetch = async (url) => {
      const u = new URL(String(url));
      const value = u.searchParams.get('q') ?? '';
      const enc = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return { text: async () => `<html><p>${enc}</p></html>` };
    };
    const { probeXssReflected } = await import('./xss.js');
    const findings = await probeXssReflected('http://example.com/?q=x', [{ name: 'q' }], { timeoutMs: 5000 });
    assert.equal(findings.length, 0);
  });
});
