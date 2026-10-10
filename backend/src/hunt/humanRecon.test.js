/**
 * humanRecon.test.js — page-understanding tests (issue #298).
 *
 * Run: cd backend && node --test src/hunt/humanRecon.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractForms,
  detectFrameworks,
  extractEndpoints,
  extractParams,
  summarizePage,
  buildSiteMap,
  thinkAloudFor,
  understandPage,
} from './humanRecon.js';

const SAMPLE_HTML = `<!doctype html><html><head>
<title>ShopFast — Login</title>
<meta name="description" content="ShopFast demo storefront">
<script src="/static/app.js"></script>
<script>window.__NEXT_DATA__ = {};</script>
</head><body>
<h1>Welcome back</h1>
<form action="/api/v1/login" method="post">
  <input type="text" name="username" />
  <input type="password" name="password" />
  <input type="hidden" name="_csrf" value="abc" />
  <button type="submit">Sign in</button>
</form>
<form action="/search" method="get">
  <input type="text" name="q" />
</form>
<a href="/api/v1/products?category=books">Products</a>
<a href="/about">About</a>
<script>fetch('/api/v1/cart', {method:'POST'});</script>
</body></html>`;

describe('extractForms', () => {
  it('finds forms with actions, methods and named inputs', () => {
    const forms = extractForms(SAMPLE_HTML);
    assert.equal(forms.length, 2);
    assert.equal(forms[0].action, '/api/v1/login');
    assert.equal(forms[0].method, 'post');
    assert.deepEqual(
      forms[0].inputs.map(i => i.name).filter(Boolean),
      ['username', 'password', '_csrf']
    );
    assert.equal(forms[1].method, 'get');
  });
});

describe('detectFrameworks', () => {
  it('spots Next.js from __NEXT_DATA__', () => {
    assert.ok(detectFrameworks(SAMPLE_HTML).includes('Next.js'));
  });
});

describe('extractEndpoints + extractParams', () => {
  it('collects hrefs, form actions and fetch() calls', () => {
    const eps = extractEndpoints(SAMPLE_HTML);
    assert.ok(eps.includes('/api/v1/products?category=books'));
    assert.ok(eps.includes('/api/v1/cart'));
    assert.ok(eps.includes('/api/v1/login'));
  });

  it('pulls query parameter names', () => {
    const params = extractParams(extractEndpoints(SAMPLE_HTML));
    assert.ok(params.includes('category'));
  });
});

describe('summarizePage', () => {
  it('builds the human-style summary shape', () => {
    const s = summarizePage({ url: 'https://example.com/login', html: SAMPLE_HTML });
    assert.equal(s.title, 'ShopFast — Login');
    assert.match(s.purpose, /ShopFast/);
    assert.equal(s.forms.length, 2);
    assert.ok(s.inputs.includes('username'));
    assert.ok(s.inputs.includes('password'));
    assert.ok(s.jsFrameworks.includes('Next.js'));
    assert.ok(s.params.includes('category'));
    assert.ok(s.interestingEndpoints.length > 0);
  });
});

describe('buildSiteMap', () => {
  it('aggregates pages, forms and API endpoints', () => {
    const s1 = summarizePage({ url: 'https://example.com/login', html: SAMPLE_HTML });
    const s2 = summarizePage({ url: 'https://example.com/', html: '<html><head><title>Home</title></head><body><a href="/api/v2/users">u</a></body></html>' });
    const map = buildSiteMap([s1, s2]);
    assert.equal(map.pages.length, 2);
    assert.equal(map.forms.length, 2);
    assert.ok(map.apis.includes('/api/v1/cart'));
    assert.ok(map.apis.includes('/api/v2/users'));
    assert.ok(!map.apis.includes('/about'));
  });
});

describe('thinkAloudFor', () => {
  it('voices the login-form observation a human would make', () => {
    const s = summarizePage({ url: 'https://example.com/login', html: SAMPLE_HTML });
    const lines = thinkAloudFor(s);
    const login = lines.find(l => /login form/i.test(l));
    assert.ok(login, `expected a login-form line, got: ${lines.join(' | ')}`);
    assert.match(login, /username, password/);
    assert.match(login, /human would test/);
  });

  it('notes URL params as injection surface', () => {
    const s = summarizePage({ url: 'https://example.com/', html: SAMPLE_HTML });
    const lines = thinkAloudFor(s);
    assert.ok(lines.some(l => /category/.test(l) && /injection/i.test(l)));
  });
});

describe('understandPage', () => {
  it('fetches (injected) and summarizes with think-aloud', async () => {
    const fetchFn = async () => ({
      ok: true,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => new TextEncoder().encode(SAMPLE_HTML).buffer,
    });
    const { summary, thinkAloud } = await understandPage({ url: 'https://example.com/login', fetchFn });
    assert.equal(summary.title, 'ShopFast — Login');
    assert.ok(thinkAloud.length > 0);
  });

  it('rejects non-http URLs', async () => {
    await assert.rejects(() => understandPage({ url: 'file:///etc/passwd' }), /http\(s\) URLs only/);
  });
});
