/**
 * webSearch.test.js — web intelligence tools (mocked HTTP).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { webSearch, webFetch } from '../src/tools/builtin/webSearch.js';
import { ToolRegistry } from '../src/tools/registry.js';

describe('ToolRegistry', () => {
  it('registers web_search and web_fetch', () => {
    const s = ToolRegistry.get('web_search');
    const f = ToolRegistry.get('web_fetch');
    assert.ok(s, 'web_search registered');
    assert.ok(f, 'web_fetch registered');
    assert.equal(s.requiresAuthorization, false);
    assert.equal(s.requiresKali, false);
    assert.equal(f.category, 'web_intelligence');
  });
});

describe('webSearch (mocked)', () => {
  it('parses DDG html results', async () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fcve&amp;rut=abc">CVE-2024-1234 writeup</a>
        <a class="result__snippet" href="#">A critical RCE in ExampleApp 1.2.</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://other.example/docs">Other docs</a>
        <a class="result__snippet" href="#">Some docs.</a>
      </div>`;
    const orig = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, text: async () => html });
    try {
      const r = await webSearch('CVE-2024-1234', 5);
      assert.equal(r.length, 2);
      assert.equal(r[0].url, 'https://example.com/cve');
      assert.equal(r[0].title, 'CVE-2024-1234 writeup');
      assert.match(r[0].snippet, /critical RCE/);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('requires a query', async () => {
    await assert.rejects(() => webSearch(''), /requires a query/);
  });

  it('throws on search HTTP error', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    try {
      await assert.rejects(() => webSearch('xss'), /HTTP 429/);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe('webFetch (mocked)', () => {
  it('extracts title and text', async () => {
    const html = '<html><head><title>CVE page</title></head><body><script>var x=1;</script><p>Details about the bug.</p></body></html>';
    const orig = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
    });
    try {
      const r = await webFetch('https://example.com/cve');
      assert.equal(r.title, 'CVE page');
      assert.match(r.text, /Details about the bug/);
      assert.doesNotMatch(r.text, /var x=1/);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('rejects non-http URLs', async () => {
    await assert.rejects(() => webFetch('file:///etc/passwd'), /http\(s\) URL/);
  });
});
