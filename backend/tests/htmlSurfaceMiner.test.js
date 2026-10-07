/**
 * htmlSurfaceMiner.test.js — tests for backend/src/engines/htmlSurfaceMiner.js
 * (ideas 741-750). Pure content-analysis: fixtures are static HTML strings,
 * no network access anywhere.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommonCrawlSeedPlan,
  filterCommonCrawlResults,
  mineHtmlComments,
  mineConditionalComments,
  mineSsiDirectives,
  mineJsonLd,
  extractNextData,
  extractNuxtPayload,
  mineBootstrappedState,
  extractConfigObjects,
  harvestMetaTags,
  redactSecrets,
} from '../src/engines/htmlSurfaceMiner.js';

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:url" content="https://www.acme-shop.example/product/42">
  <link rel="canonical" href="https://www.acme-shop.example/product/42">
  <link rel="alternate" hreflang="de" href="https://de.acme-shop.example/product/42">
  <link rel="alternate" hreflang="fr" href="https://fr.acme-shop.example/product/42">
  <title>Acme Shop</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Acme Shop",
    "url": "https://www.acme-shop.example",
    "sameAs": ["https://twitter.com/acmeshop", "https://www.linkedin.com/company/acme-shop"]
  }
  </script>
  <script type="application/ld+json">
  {"@type":"WebSite","url":"https://www.acme-shop.example","name":"Acme Shop"}
  </script>
  <!-- TODO: remove the debug banner before launch -->
  <!--
    Disabled legacy checkout flow — do not re-enable without sign-off.
    <form action="/old-checkout">...</form>
  -->
  <!-- internal admin panel: https://admin.acme-shop.example/panel (staging creds in vault) -->
  <!--[if lte IE 9]>
    <script src="https://legacy-cdn.acme-shop.example/js/ie9-shim.js"></script>
    <link rel="stylesheet" href="/css/ie9.css">
  <![endif]-->
  <!--#include virtual="/includes/header.shtml" -->
  <!--#echo var="DATE_LOCAL" -->
</head>
<body>
  <script id="__NEXT_DATA__" type="application/json">
  {"props":{"pageProps":{"apiBase":"https://api.acme-shop.example/v2","token":"s3cr3t-should-be-redacted","items":[{"apiUrl":"/api/items"}]}},"page":"/product/[id]","buildId":"bUiLd-123"}
  </script>
  <script>window.__NUXT__={"state":{"user":null,"apiHost":"https://api.acme-shop.example"},"data":{"/products":{"endpoint":"/api/products"}}}; </script>
  <script>window.__INITIAL_STATE__={"config":{"apiHost":"https://api.acme-shop.example","apiKey":"AKIA-REDACT-ME"},"user":{"name":"ada","route":"/account/profile"}};</script>
  <script>window.config={"env":"staging","apiUrl":"https://api-staging.acme-shop.example/v1","internalApi":"https://internal.acme-shop.example/v1"};</script>
</body>
</html>`;

describe('idea 741 — buildCommonCrawlSeedPlan / filterCommonCrawlResults', () => {
  it('builds an index query plan for the target domain', () => {
    const plan = buildCommonCrawlSeedPlan('acme-shop.example');
    assert.ok(plan.indexApiUrl.includes('index.commoncrawl.org'));
    assert.equal(plan.query.url, 'acme-shop.example/*');
    assert.equal(plan.query.matchType, 'domain');
    assert.ok(plan.usage.length > 0);
  });

  it('filters raw index rows to recon-relevant URLs', () => {
    const plan = buildCommonCrawlSeedPlan('acme-shop.example');
    const rows = [
      { url: 'https://www.acme-shop.example/login', mime: 'text/html', status: '200' },
      { url: 'https://www.acme-shop.example/logo.png', mime: 'image/png', status: '200' },
      { url: 'https://www.acme-shop.example/app.css', mime: 'text/css', status: '200' },
      { url: 'https://www.acme-shop.example/old', mime: 'text/html', status: '404' },
      { url: 'https://www.acme-shop.example/login', mime: 'text/html', status: '200' },
    ];
    const out = filterCommonCrawlResults(rows, plan.filters);
    assert.deepEqual(out.urls, ['https://www.acme-shop.example/login']);
    assert.ok(out.dropped >= 3);
    assert.equal(out.byMime['text/html'], 1);
  });
});

describe('idea 742 — mineHtmlComments', () => {
  it('classifies TODO, disabled-feature and internal-url comments', () => {
    const comments = mineHtmlComments(FIXTURE_HTML);
    const find = (needle) => comments.find((c) => c.body.includes(needle));
    assert.equal(find('debug banner').classification, 'todo');
    assert.equal(find('legacy checkout').classification, 'disabled-feature');
    const admin = find('admin panel');
    assert.equal(admin.classification, 'internal-url');
    assert.ok(admin.urls.includes('https://admin.acme-shop.example/panel'));
  });

  it('returns an empty array when there are no comments', () => {
    assert.deepEqual(mineHtmlComments('<p>no comments</p>'), []);
  });
});

describe('idea 743 — mineConditionalComments', () => {
  it('parses IE conditional comments and legacy asset hosts', () => {
    const found = mineConditionalComments(FIXTURE_HTML);
    assert.equal(found.length, 1);
    assert.ok(found[0].condition.includes('lte IE 9'));
    assert.ok(found[0].assetUrls.includes('https://legacy-cdn.acme-shop.example/js/ie9-shim.js'));
    assert.ok(found[0].legacyHosts.includes('legacy-cdn.acme-shop.example'));
  });
});

describe('idea 744 — mineSsiDirectives', () => {
  it('finds include and echo directives with include paths', () => {
    const directives = mineSsiDirectives(FIXTURE_HTML);
    const include = directives.find((d) => d.command === 'include');
    assert.ok(include);
    assert.equal(include.attributes.virtual, '/includes/header.shtml');
    assert.deepEqual(include.includePaths, ['/includes/header.shtml']);
    assert.ok(directives.some((d) => d.command === 'echo'));
  });
});

describe('idea 745 — mineJsonLd', () => {
  it('extracts organization URLs and sameAs links', () => {
    const blocks = mineJsonLd(FIXTURE_HTML);
    assert.equal(blocks.length, 2);
    const org = blocks.find((b) => b.type === 'Organization');
    assert.ok(org);
    assert.ok(org.urls.includes('https://www.acme-shop.example'));
    assert.ok(org.sameAs.includes('https://twitter.com/acmeshop'));
    assert.ok(org.sameAs.includes('https://www.linkedin.com/company/acme-shop'));
  });

  it('skips malformed JSON-LD blocks', () => {
    const blocks = mineJsonLd('<script type="application/ld+json">{not json</script>');
    assert.deepEqual(blocks, []);
  });
});

describe('idea 746 — extractNextData', () => {
  it('extracts page props, API routes and redacts secrets', () => {
    const data = extractNextData(FIXTURE_HTML);
    assert.ok(data);
    assert.equal(data.buildId, 'bUiLd-123');
    assert.equal(data.page, '/product/[id]');
    assert.ok(data.urls.includes('https://api.acme-shop.example/v2'));
    assert.ok(data.apiRoutes.includes('/api/items'));
    assert.equal(data.pageProps.token, '[REDACTED]');
  });

  it('returns null when __NEXT_DATA__ is absent', () => {
    assert.equal(extractNextData('<html></html>'), null);
  });
});

describe('idea 747 — extractNuxtPayload', () => {
  it('parses __NUXT__ state and endpoints', () => {
    const nuxt = extractNuxtPayload(FIXTURE_HTML);
    assert.ok(nuxt);
    assert.ok(nuxt.urls.includes('https://api.acme-shop.example'));
    assert.ok(nuxt.endpoints.includes('/api/products'));
    assert.deepEqual(nuxt.payloads['/products'], { endpoint: '/api/products' });
  });

  it('returns null when __NUXT__ is absent', () => {
    assert.equal(extractNuxtPayload('<html></html>'), null);
  });
});

describe('idea 748 — mineBootstrappedState', () => {
  it('finds API hosts and user routes with secrets redacted', () => {
    const states = mineBootstrappedState(FIXTURE_HTML);
    assert.equal(states.length, 1);
    const s = states[0];
    assert.equal(s.varName, '__INITIAL_STATE__');
    assert.ok(s.apiHosts.includes('api.acme-shop.example'));
    assert.ok(s.userRoutes.includes('/account/profile'));
    assert.equal(s.state.config.apiKey, '[REDACTED]');
  });
});

describe('idea 749 — extractConfigObjects', () => {
  it('extracts window.config environment endpoints', () => {
    const configs = extractConfigObjects(FIXTURE_HTML);
    assert.equal(configs.length, 1);
    assert.equal(configs[0].varName, 'window.config');
    assert.ok(configs[0].endpoints.includes('https://api-staging.acme-shop.example/v1'));
    assert.equal(configs[0].env.env, 'staging');
  });
});

describe('idea 750 — harvestMetaTags', () => {
  it('harvests canonical, og:url and alternates into a host map', () => {
    const meta = harvestMetaTags(FIXTURE_HTML);
    assert.equal(meta.canonical, 'https://www.acme-shop.example/product/42');
    assert.equal(meta.ogUrl, 'https://www.acme-shop.example/product/42');
    assert.equal(meta.alternates.length, 2);
    assert.equal(meta.alternates[0].hreflang, 'de');
    assert.ok(meta.hosts.includes('www.acme-shop.example'));
    assert.ok(meta.hosts.includes('de.acme-shop.example'));
    assert.equal(meta.canonicalHost, 'www.acme-shop.example');
  });
});

describe('redactSecrets', () => {
  it('redacts secret-looking keys at any depth', () => {
    const out = redactSecrets({ a: 1, apiKey: 'x', nested: { password: 'y', ok: 'z' }, list: [{ token: 't' }] });
    assert.equal(out.apiKey, '[REDACTED]');
    assert.equal(out.nested.password, '[REDACTED]');
    assert.equal(out.nested.ok, 'z');
    assert.equal(out.list[0].token, '[REDACTED]');
    assert.equal(out.a, 1);
  });
});
