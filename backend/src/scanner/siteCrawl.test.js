// Site-crawl (/* scope) tests (9 Nov 2026, owner order).
//
// The scanner gains a 'site' scanScope: paste a link, follow ALL
// same-origin links recursively, try the battery on every discovered
// route, and report findings grouped by route. 'page' scope keeps the
// original one-page-deep behaviour exactly — the page-mode control
// tests below pin that.
//
// No network, no docker: crawl fetches go through the
// opts.crawlFetcher seam (unit tests) or a URL-routed global fetch
// stub (runScan integration tests).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crawl,
  crawlSite,
  normalizeScanScope,
  siteCrawlCaps,
  siteMaxUrls,
  SITE_CRAWL_CAPS,
  SITE_MAX_URLS,
} from './crawl.js';
import { mergePageAnalyses, analyzePage } from './pageAnalyze.js';
import { routeKeyForUrl, groupFindingsByRoute } from './routeGroup.js';
import { runScan } from './index.js';

// A small four-page site graph, keyed by URL. Root links /a and /b
// (plus a fragment duplicate of /a, a javascript: link, a mailto:
// link and an off-origin link — none of those may be followed).
// /a links deeper to /a/1 and carries a form + an input; /b links
// back to /a (dedupe) and carries an input; /a/1 carries an input.
const SITE = {
  'http://site.test/':
    '<html><body><a href="/a">a</a><a href="/b">b</a>'
    + '<a href="/a#section">a again</a>'
    + '<a href="javascript:void(0)">js</a>'
    + '<a href="mailto:someone@example.com">mail</a>'
    + '<a href="https://other.test/x">off-origin</a></body></html>',
  'http://site.test/a':
    '<html><body><a href="/a/1">deep</a>'
    + '<form action="/search" method="get"><input name="q"></form>'
    + '<input name="user"></body></html>',
  'http://site.test/b':
    '<html><body><a href="/a">back to a</a><input name="email"></body></html>',
  'http://site.test/a/1':
    '<html><body><input name="deep"></body></html>',
};

function siteFetcher(pages) {
  return async (url) => {
    const body = pages[String(url).split('#')[0]];
    if (body === undefined) throw new Error(`no such test page: ${url}`);
    return { url: String(url).split('#')[0], body, headers: {} };
  };
}

describe('normalizeScanScope', () => {
  it("'site' passes through, anything else is 'page'", () => {
    assert.equal(normalizeScanScope('site'), 'site');
    for (const junk of ['page', 'SITE', 'all', '', null, undefined, 0, true]) {
      assert.equal(normalizeScanScope(junk), 'page');
    }
  });
});

describe('site crawl caps', () => {
  it('caps by scan depth: Quick 1/5, Standard 2/10, Deep 3/20', () => {
    assert.deepEqual(SITE_CRAWL_CAPS, {
      quick: { maxDepth: 1, maxPages: 5 },
      standard: { maxDepth: 2, maxPages: 10 },
      deep: { maxDepth: 3, maxPages: 20 },
    });
    assert.deepEqual(siteCrawlCaps('quick'), { maxDepth: 1, maxPages: 5 });
    assert.deepEqual(siteCrawlCaps('standard'), { maxDepth: 2, maxPages: 10 });
    assert.deepEqual(siteCrawlCaps('deep'), { maxDepth: 3, maxPages: 20 });
    // Unknown depth falls back to Standard.
    assert.deepEqual(siteCrawlCaps('turbo'), { maxDepth: 2, maxPages: 10 });
    assert.deepEqual(siteCrawlCaps(undefined), { maxDepth: 2, maxPages: 10 });
  });
  it('site maxUrls by scan depth: Quick 25, Standard 30, Deep 40', () => {
    assert.deepEqual(SITE_MAX_URLS, { quick: 25, standard: 30, deep: 40 });
    assert.equal(siteMaxUrls('quick'), 25);
    assert.equal(siteMaxUrls('standard'), 30);
    assert.equal(siteMaxUrls('deep'), 40);
    assert.equal(siteMaxUrls('turbo'), 30);
  });
});

describe('crawlSite recursion', () => {
  it('walks the whole site BFS: every page visited once, links unioned', async () => {
    const res = await crawlSite('http://site.test/', {
      scanDepth: 'standard',
      crawlFetcher: siteFetcher(SITE),
    });
    assert.equal(res.scanScope, 'site');
    assert.equal(res.pagesScanned, 4);
    assert.deepEqual(
      res.pages.map((p) => p.url),
      ['http://site.test/', 'http://site.test/a', 'http://site.test/b', 'http://site.test/a/1']
    );
    // Root fields keep the single-page shape: pasted page body, union
    // of all links (fragment stripped, off-origin/javascript/mailto
    // excluded), union of all forms.
    assert.equal(res.url, 'http://site.test/');
    assert.deepEqual(res.links, ['http://site.test/a', 'http://site.test/b', 'http://site.test/a/1']);
    assert.equal(res.forms.length, 1);
    assert.equal(res.forms[0].action, 'http://site.test/search');
  });

  it('depth cap: Quick (depth 1) never visits /a/1', async () => {
    const res = await crawlSite('http://site.test/', {
      scanDepth: 'quick',
      crawlFetcher: siteFetcher(SITE),
    });
    assert.equal(res.pagesScanned, 3);
    assert.deepEqual(
      res.pages.map((p) => p.url),
      ['http://site.test/', 'http://site.test/a', 'http://site.test/b']
    );
  });

  it('page cap: a site bigger than maxPages stops at the cap', async () => {
    const big = { 'http://site.test/': '<html><body>' + Array.from({ length: 12 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('') + '</body></html>' };
    for (let i = 0; i < 12; i++) big[`http://site.test/p${i}`] = '<html><body>leaf</body></html>';
    const res = await crawlSite('http://site.test/', {
      scanDepth: 'deep',
      crawlFetcher: siteFetcher(big),
    });
    assert.equal(res.pagesScanned, 13);
    assert.equal(res.pages.length, 13);
  });

  it('page cap binds: Quick stops at 5 pages even with more links', async () => {
    const big = { 'http://site.test/': '<html><body>' + Array.from({ length: 8 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('') + '</body></html>' };
    for (let i = 0; i < 8; i++) big[`http://site.test/p${i}`] = '<html><body>leaf</body></html>';
    const res = await crawlSite('http://site.test/', {
      scanDepth: 'quick',
      crawlFetcher: siteFetcher(big),
    });
    assert.equal(res.pagesScanned, 5);
  });

  it('a page that fails to fetch is skipped, not fatal', async () => {
    const fetcher = async (url) => {
      if (String(url) === 'http://site.test/b') throw new Error('mock 500');
      return siteFetcher(SITE)(url);
    };
    const res = await crawlSite('http://site.test/', {
      scanDepth: 'standard',
      crawlFetcher: fetcher,
    });
    assert.equal(res.pagesScanned, 3);
    assert.ok(!res.pages.some((p) => p.url === 'http://site.test/b'));
  });

  it('crawl() dispatches to the site walk only when scanScope is site', async () => {
    const fetcher = siteFetcher(SITE);
    const site = await crawl('http://site.test/', { scanScope: 'site', scanDepth: 'standard', crawlFetcher: fetcher });
    assert.equal(site.scanScope, 'site');
    assert.equal(site.pagesScanned, 4);
    const page = await crawl('http://site.test/', { crawlFetcher: fetcher });
    assert.equal(page.scanScope, 'page');
    assert.equal(page.pagesScanned, 1);
    assert.deepEqual(page.pages.map((p) => p.url), ['http://site.test/']);
    assert.deepEqual(page.links, ['http://site.test/a', 'http://site.test/b']);
  });
});

describe('mergePageAnalyses', () => {
  it('merges per-page inventories with per-page provenance', () => {
    const a = analyzePage(SITE['http://site.test/a'], 'http://site.test/a');
    const b = analyzePage(SITE['http://site.test/b'], 'http://site.test/b');
    const merged = mergePageAnalyses([
      { url: 'http://site.test/a', analysis: a },
      { url: 'http://site.test/b', analysis: b },
    ]);
    // /a: 1 form input (q) + 1 standalone (user); /b: 1 standalone (email).
    assert.equal(merged.inputs.length, 3);
    assert.deepEqual(
      merged.inputs.map((i) => `${i.page}|${i.name}`),
      ['http://site.test/a|q', 'http://site.test/a|user', 'http://site.test/b|email']
    );
    assert.equal(merged.forms.length, 1);
    assert.equal(merged.forms[0].page, 'http://site.test/a');
    assert.deepEqual(merged.pages, [
      { url: 'http://site.test/a', inputs: 2, forms: 1, textareas: 0, selects: 0, buttons: 0, params: 0 },
      { url: 'http://site.test/b', inputs: 1, forms: 0, textareas: 0, selects: 0, buttons: 0, params: 0 },
    ]);
    // Params union, not per-page duplicates.
    assert.deepEqual(merged.params, []);
  });

  it('same input name on two routes stays two probe points', () => {
    const a = analyzePage('<input name="q">', 'http://site.test/a');
    const b = analyzePage('<input name="q">', 'http://site.test/b');
    const merged = mergePageAnalyses([
      { url: 'http://site.test/a', analysis: a },
      { url: 'http://site.test/b', analysis: b },
    ]);
    assert.equal(merged.inputs.length, 2);
    assert.deepEqual(merged.inputs.map((i) => i.page), ['http://site.test/a', 'http://site.test/b']);
  });
});

describe('routeKeyForUrl / groupFindingsByRoute', () => {
  it('route key is origin + pathname: query and fragment stripped', () => {
    assert.equal(routeKeyForUrl('http://site.test/search?q=a#top'), 'http://site.test/search');
    assert.equal(routeKeyForUrl('http://site.test/api/Users'), 'http://site.test/api/Users');
    assert.equal(routeKeyForUrl(null, 'http://site.test/'), 'http://site.test/');
    assert.equal(routeKeyForUrl('not a url', null), 'not a url');
  });

  it('groups finding titles by route, deduped per route', () => {
    const grouped = groupFindingsByRoute(
      [
        { title: 'SQLi in q', url: 'http://site.test/search?q=1' },
        { title: 'XSS in q', url: 'http://site.test/search?q=2' },
        { title: 'SQLi in q', url: 'http://site.test/search?q=3' },
        { title: 'BFLA on Users', url: 'http://site.test/api/Users' },
        { title: 'Missing HSTS', url: null },
      ],
      'http://site.test/'
    );
    assert.deepEqual(grouped, {
      'http://site.test/search': ['SQLi in q', 'XSS in q'],
      'http://site.test/api/Users': ['BFLA on Users'],
      'http://site.test/': ['Missing HSTS'],
    });
  });
});

describe('runScan site scope (integration)', () => {
  const realFetch = globalThis.fetch;

  function stubFetch() {
    globalThis.fetch = async (input) => {
      // authorizeTarget strips the root trailing slash ('http://site.test/'
      // -> 'http://site.test'); a real fetch returns the normalized URL
      // (res.url), so the stub normalizes the same way before lookup
      // and answers with the normalized URL.
      const u = new URL(String(input).split('#')[0]).href;
      const body = SITE[u];
      if (body === undefined) throw new Error(`unexpected fetch: ${u}`);
      return {
        url: u,
        status: 200,
        headers: new Headers({ server: 'nginx/1.24' }),
        text: async () => body,
      };
    };
  }

  it('site mode: every page inventoried, routes scanned, rollup present', async () => {
    stubFetch();
    try {
      const result = await runScan(
        {
          target: 'http://site.test/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze'],
        },
        { timeoutMs: 5000, scanScope: 'site', scanDepth: 'standard' }
      );
      assert.equal(result.scanScope, 'site');
      assert.equal(result.routesScanned, 4);
      assert.deepEqual(result.scannedPages, [
        'http://site.test/',
        'http://site.test/a',
        'http://site.test/b',
        'http://site.test/a/1',
      ]);
      assert.deepEqual(result.findingsByRoute, {});
      // Page analysis merged across pages: 4 named inputs with
      // per-page provenance (q + user on /a, email on /b, deep on /a/1).
      assert.equal(result.pageAnalysis.inputs, 4);
      assert.equal(result.pageAnalysis.forms, 1);
      // Crawl phase record carries the footprint.
      const crawlPhase = result.phases.find((p) => p.name === 'crawl');
      assert.equal(crawlPhase.pagesScanned, 4);
      assert.equal(crawlPhase.scanScope, 'site');
      // pagesCrawled keeps its old meaning: union of crawled links.
      assert.equal(result.pagesCrawled, 3);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('page mode (control): pasted page only — unchanged behaviour', async () => {
    stubFetch();
    try {
      const result = await runScan(
        {
          target: 'http://site.test/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze'],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(result.scanScope, 'page');
      assert.equal(result.routesScanned, 1);
      assert.deepEqual(result.scannedPages, ['http://site.test/']);
      assert.deepEqual(result.findingsByRoute, {});
      assert.equal(result.pageAnalysis.inputs, 0);
      assert.equal(result.pageAnalysis.forms, 0);
      const crawlPhase = result.phases.find((p) => p.name === 'crawl');
      assert.equal(crawlPhase.pagesScanned, 1);
      assert.equal(crawlPhase.scanScope, 'page');
      assert.equal(result.pagesCrawled, 2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
