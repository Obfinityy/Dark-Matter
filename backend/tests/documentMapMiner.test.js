/**
 * documentMapMiner.test.js — Tests for ideas 731-740: document-map crawl
 * mining (engines/documentMapMiner.js). All fixtures are synthetic snippets
 * shaped like the document formats described in each miner's JSDoc.
 *
 * Run: cd backend && node --test tests/documentMapMiner.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  planIframeCrawl,
  extractCrossOriginIframeMeta,
  parseSitemap,
  expandSitemapIndex,
  harvestRobotsDisallows,
  followRobotsSitemaps,
  parseLlmsTxt,
  discoverHumansTxtLinks,
  parseSecurityTxt,
  expandAdsTxtDomains,
  buildWaybackSeedUrls,
  normalizeCorpusUrls,
  summarizeDocumentMap,
} from '../src/engines/documentMapMiner.js';

/* ------------------------------------------------------------------ */
/* 731 — planIframeCrawl                                               */
/* ------------------------------------------------------------------ */

describe('731 planIframeCrawl', () => {
  const tree = {
    url: 'https://shop.example.com/',
    origin: 'https://shop.example.com',
    children: [
      {
        src: '/embed/checkout',
        children: [
          { src: '/embed/checkout/step2', children: [] },
          { src: 'https://pay.vendor.io/widget', children: [] },
        ],
      },
      { src: 'https://www.youtube.com/embed/abc123', children: [] },
      { src: 'javascript:void(0)', children: [] },
    ],
  };

  it('marks same-origin frames crawlable and cross-origin as opaque', () => {
    const plan = planIframeCrawl(tree, { maxDepth: 3 });
    const bySrc = new Map(plan.frames.map((f) => [f.src, f]));
    const checkout = bySrc.get('https://shop.example.com/embed/checkout');
    assert.ok(checkout, 'same-origin checkout frame present');
    assert.equal(checkout.crawlable, true);
    assert.equal(checkout.sameOrigin, true);
    assert.equal(checkout.depth, 1);

    const step2 = bySrc.get('https://shop.example.com/embed/checkout/step2');
    assert.equal(step2.crawlable, true);
    assert.equal(step2.depth, 2);

    const pay = bySrc.get('https://pay.vendor.io/widget');
    assert.equal(pay.sameOrigin, false);
    assert.equal(pay.crawlable, false);
    assert.match(pay.reason, /cross-origin/i);

    const yt = bySrc.get('https://www.youtube.com/embed/abc123');
    assert.equal(yt.crawlable, false);
    assert.equal(plan.crossOriginCount, 2);
    assert.equal(plan.sameOriginCount, 2);
    assert.equal(plan.unresolvableCount, 1, 'javascript: src counted separately');
    assert.equal(plan.crawlableCount, 2);
  });

  it('defers frames beyond the depth budget', () => {
    const plan = planIframeCrawl(tree, { maxDepth: 1 });
    const step2 = plan.frames.find((f) => f.src.endsWith('/embed/checkout/step2'));
    assert.equal(step2.crawlable, false);
    assert.match(step2.reason, /exceeds maxDepth/);
  });

  it('handles an empty tree without throwing', () => {
    const plan = planIframeCrawl({ url: 'https://a.example/', children: [] });
    assert.deepEqual(plan.frames, []);
    assert.equal(plan.crawlableCount, 0);
  });
});

/* ------------------------------------------------------------------ */
/* 732 — extractCrossOriginIframeMeta                                  */
/* ------------------------------------------------------------------ */

const IFRAME_HTML = `
<html><body>
<iframe src="/embed/player" name="player" title="Video player"></iframe>
<iframe src="https://www.youtube.com/embed/abc123" title="Promo" allow="autoplay; encrypted-media" loading="lazy"></iframe>
<iframe src="https://js.stripe.com/v3/elements" name="stripe" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>
<iframe src="https://www.google.com/recaptcha/api2/anchor" title="reCAPTCHA"></iframe>
</body></html>`;

describe('732 extractCrossOriginIframeMeta', () => {
  it('separates same-origin and cross-origin iframes with metadata', () => {
    const meta = extractCrossOriginIframeMeta(IFRAME_HTML, 'https://shop.example.com/page');
    assert.equal(meta.total, 4);
    assert.equal(meta.sameOrigin.length, 1);
    assert.equal(meta.sameOrigin[0].src, 'https://shop.example.com/embed/player');
    assert.equal(meta.crossOrigin.length, 3);

    const stripe = meta.crossOrigin.find((f) => f.host === 'js.stripe.com');
    assert.ok(stripe);
    assert.equal(stripe.sandbox, 'allow-scripts allow-same-origin');
    assert.equal(stripe.referrerpolicy, 'no-referrer');
    assert.equal(stripe.name, 'stripe');

    const yt = meta.crossOrigin.find((f) => f.host === 'www.youtube.com');
    assert.equal(yt.allow, 'autoplay; encrypted-media');
    assert.equal(yt.loading, 'lazy');
  });

  it('aggregates third-party hosts by frame count', () => {
    const meta = extractCrossOriginIframeMeta(IFRAME_HTML, 'https://shop.example.com/page');
    const hosts = meta.thirdPartyHosts.map((h) => h.host).sort();
    assert.deepEqual(hosts, ['js.stripe.com', 'www.google.com', 'www.youtube.com']);
    assert.ok(meta.thirdPartyHosts.every((h) => h.frames === 1));
  });

  it('returns empty inventories for pages without iframes', () => {
    const meta = extractCrossOriginIframeMeta('<html><body>no frames</body></html>', 'https://a.example/');
    assert.equal(meta.total, 0);
    assert.deepEqual(meta.crossOrigin, []);
  });
});

/* ------------------------------------------------------------------ */
/* 733 — parseSitemap / expandSitemapIndex                              */
/* ------------------------------------------------------------------ */

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://shop.example.com/sitemap-products-1.xml</loc><lastmod>2026-09-01</lastmod></sitemap>
  <sitemap><loc>https://shop.example.com/sitemap-products-2.xml</loc><lastmod>2026-09-15</lastmod></sitemap>
</sitemapindex>`;

const SITEMAP_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://shop.example.com/products/widget</loc><lastmod>2026-09-20</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>/products/gadget</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
</urlset>`;

describe('733 parseSitemap', () => {
  it('parses a sitemap index into child sitemap entries', () => {
    const parsed = parseSitemap(SITEMAP_INDEX, 'https://shop.example.com/');
    assert.equal(parsed.kind, 'index');
    assert.equal(parsed.sitemaps.length, 2);
    assert.equal(parsed.sitemaps[0].loc, 'https://shop.example.com/sitemap-products-1.xml');
    assert.equal(parsed.sitemaps[0].lastmod, '2026-09-01');
    assert.deepEqual(parsed.errors, []);
  });

  it('parses a urlset with priority metadata and resolves relative locs', () => {
    const parsed = parseSitemap(SITEMAP_URLSET, 'https://shop.example.com/sitemap.xml');
    assert.equal(parsed.kind, 'urlset');
    assert.equal(parsed.urls.length, 2);
    assert.equal(parsed.urls[0].priority, '0.9');
    assert.equal(parsed.urls[0].changefreq, 'daily');
    assert.equal(parsed.urls[1].loc, 'https://shop.example.com/products/gadget');
    assert.equal(parsed.urls[1].lastmod, null);
  });

  it('flags documents that are neither index nor urlset', () => {
    const parsed = parseSitemap('<html>not a sitemap</html>');
    assert.equal(parsed.kind, 'unknown');
    assert.ok(parsed.errors.length > 0);
  });
});

describe('733 expandSitemapIndex', () => {
  it('recursively expands nested indexes with cycle protection', () => {
    const nestedIndex = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://shop.example.com/sitemap.xml</loc></sitemap>
      <sitemap><loc>https://shop.example.com/sitemap-blog.xml</loc></sitemap>
    </sitemapindex>`;
    const blogSet = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://shop.example.com/blog/launch</loc></url>
    </urlset>`;
    const docs = {
      'https://shop.example.com/sitemap.xml': SITEMAP_INDEX,
      'https://shop.example.com/sitemap-products-1.xml': SITEMAP_URLSET,
      'https://shop.example.com/sitemap-products-2.xml': nestedIndex,
      'https://shop.example.com/sitemap-blog.xml': blogSet,
    };
    const expanded = expandSitemapIndex(docs, 'https://shop.example.com/sitemap.xml');
    assert.equal(expanded.kind, 'index');
    assert.ok(expanded.visited.includes('https://shop.example.com/sitemap.xml'));
    assert.ok(expanded.urls.some((u) => u.loc === 'https://shop.example.com/products/widget'));
    assert.ok(expanded.urls.some((u) => u.loc === 'https://shop.example.com/blog/launch'));
    assert.ok(expanded.urls.every((u) => u.via));
    assert.deepEqual(expanded.missing, []);
    assert.equal(expanded.truncated, false);
  });

  it('reports missing documents instead of failing', () => {
    const expanded = expandSitemapIndex({}, 'https://shop.example.com/sitemap.xml');
    assert.deepEqual(expanded.missing, ['https://shop.example.com/sitemap.xml']);
    assert.deepEqual(expanded.urls, []);
  });
});

/* ------------------------------------------------------------------ */
/* 734 — harvestRobotsDisallows                                        */
/* ------------------------------------------------------------------ */

const ROBOTS_TXT = `
User-agent: *
Disallow: /admin/
Disallow: /.git/
Disallow: /tmp/
Disallow: /search?
Disallow: /backup-2024.sql
Allow: /admin/login

User-agent: BadBot
Disallow: /

Sitemap: https://shop.example.com/sitemap.xml
`;

describe('734 harvestRobotsDisallows', () => {
  it('harvests disallows grouped by user-agent and ranks sensitive paths first', () => {
    const { groups, ranked } = harvestRobotsDisallows(ROBOTS_TXT);
    assert.equal(groups.length, 2);
    assert.ok(groups[0].agents.includes('*'));
    assert.ok(groups[0].disallows.includes('/admin/'));

    assert.ok(ranked.length >= 5);
    assert.equal(ranked[0].level, 'critical');
    assert.ok(ranked[0].score >= 90);
    const paths = ranked.map((r) => r.path);
    assert.ok(paths.indexOf('/.git/') < paths.indexOf('/tmp/'), 'git outranks tmp');
    assert.ok(paths.indexOf('/admin/') < paths.indexOf('/search?'), 'admin outranks search');

    const git = ranked.find((r) => r.path === '/.git/');
    assert.ok(git.reasons.length > 0);
    assert.ok(git.agents.includes('*'));

    const badBot = ranked.find((r) => r.path === '/' && r.agents.includes('badbot'));
    assert.ok(badBot, 'BadBot group root disallow captured');
  });

  it('returns empty results for an empty file', () => {
    const { groups, ranked } = harvestRobotsDisallows('');
    assert.deepEqual(groups, []);
    assert.deepEqual(ranked, []);
  });
});

/* ------------------------------------------------------------------ */
/* 735 — followRobotsSitemaps                                          */
/* ------------------------------------------------------------------ */

describe('735 followRobotsSitemaps', () => {
  it('extracts Sitemap directives in file order', () => {
    const txt = `User-agent: *
Disallow: /admin/
Sitemap: https://shop.example.com/sitemap.xml
Sitemap: https://shop.example.com/sitemap-news.xml`;
    const directives = followRobotsSitemaps(txt);
    assert.equal(directives.length, 2);
    assert.equal(directives[0].url, 'https://shop.example.com/sitemap.xml');
    assert.equal(directives[1].url, 'https://shop.example.com/sitemap-news.xml');
    assert.ok(directives[0].agents.includes('*'));
  });

  it('returns an empty list when no directives exist', () => {
    assert.deepEqual(followRobotsSitemaps('User-agent: *\nDisallow: /'), []);
  });
});

/* ------------------------------------------------------------------ */
/* 736 — parseLlmsTxt                                                  */
/* ------------------------------------------------------------------ */

const LLMS_TXT = `# Shop Example API Docs

Public storefront and checkout API reference.

## Authentication

Authenticate with a bearer token. See [auth guide](/docs/auth) and
https://developers.example.com/oauth for the OAuth flow.

## Endpoints

- \`GET /api/v1/products\` — list products, supports \`?category=\` and \`?page=\`
- \`POST /api/v1/orders\` — create an order; requires the token from Authentication
- Webhooks hit \`POST /api/v1/webhooks/stripe\` on your server

## Rate limits

Documented at [limits page](https://developers.example.com/limits).
`;

describe('736 parseLlmsTxt', () => {
  it('extracts title, sections, links, routes and API mentions', () => {
    const parsed = parseLlmsTxt(LLMS_TXT, 'https://shop.example.com/llms.txt');
    assert.equal(parsed.title, 'Shop Example API Docs');
    assert.equal(parsed.sections.length, 4);
    assert.deepEqual(parsed.sections.map((s) => s.title), ['Shop Example API Docs', 'Authentication', 'Endpoints', 'Rate limits']);

    const urls = parsed.links.map((l) => l.url);
    assert.ok(urls.includes('https://shop.example.com/docs/auth'), 'relative markdown link resolved');
    assert.ok(urls.includes('https://developers.example.com/oauth'), 'bare URL captured');
    assert.ok(urls.includes('https://developers.example.com/limits'));

    const paths = parsed.routes.map((r) => r.path);
    assert.ok(paths.includes('/api/v1/products'));
    assert.ok(paths.includes('/api/v1/orders'));
    assert.ok(paths.includes('/api/v1/webhooks/stripe'));

    assert.ok(parsed.apiMentions.length > 0, 'API documentation lines flagged');
  });
});

/* ------------------------------------------------------------------ */
/* 737 — discoverHumansTxtLinks                                        */
/* ------------------------------------------------------------------ */

const HUMANS_TXT = `/* TEAM */
Name: Ada Lovelace
Site: https://ada.example.dev
Twitter: @ada_builds
Contact: ada@example.com

/* SITE */
Standards: HTML5, CSS3
Tools: https://internal-tools.example.com/deploy, Webpack

/* THANKS */
Name: Grace Hopper
Site: www.gracehopper.example.org
`;

describe('737 discoverHumansTxtLinks', () => {
  it('discovers hosts with context and classifies against seed hosts', () => {
    const found = discoverHumansTxtLinks(HUMANS_TXT, ['shop.example.com']);
    const hosts = found.hosts.map((h) => h.host);
    assert.ok(hosts.includes('ada.example.dev'));
    assert.ok(hosts.includes('internal-tools.example.com'));
    assert.ok(hosts.includes('www.gracehopper.example.org'));

    const ada = found.hosts.find((h) => h.host === 'ada.example.dev');
    assert.ok(ada.contexts.includes('team'), 'section context recorded');

    assert.ok(found.newHosts.length === found.hosts.length, 'no seeds matched, all new');
    assert.equal(found.emails.length, 1);
    assert.equal(found.emails[0].email, 'ada@example.com');
    assert.deepEqual(found.sections.sort(), ['site', 'team', 'thanks']);
  });

  it('excludes seed hosts from newHosts', () => {
    const found = discoverHumansTxtLinks(HUMANS_TXT, ['ada.example.dev']);
    assert.ok(!found.newHosts.some((h) => h.host === 'ada.example.dev'));
    assert.ok(found.hosts.some((h) => h.host === 'ada.example.dev'));
  });
});

/* ------------------------------------------------------------------ */
/* 738 — parseSecurityTxt                                              */
/* ------------------------------------------------------------------ */

const SECURITY_TXT = `# Security policy for shop.example.com
Contact: mailto:security@example.com
Contact: https://shop.example.com/.well-known/security-contact
Contact: tel:+1-555-0100
Expires: 2027-01-01T00:00:00.000Z
Canonical: https://shop.example.com/.well-known/security.txt
Policy: https://shop.example.com/security-policy
Hiring: https://shop.example.com/careers#security
Preferred-Languages: en, fr
`;

describe('738 parseSecurityTxt', () => {
  it('confirms canonical contact endpoints with classification', () => {
    const parsed = parseSecurityTxt(SECURITY_TXT, 'https://shop.example.com/');
    assert.equal(parsed.contacts.length, 3);
    const kinds = parsed.contacts.map((c) => c.kind).sort();
    assert.deepEqual(kinds, ['email', 'phone', 'url']);

    const email = parsed.contacts.find((c) => c.kind === 'email');
    assert.equal(email.host, 'example.com');

    assert.deepEqual(parsed.canonical, ['https://shop.example.com/.well-known/security.txt']);
    assert.equal(parsed.expires, '2027-01-01T00:00:00.000Z');
    assert.deepEqual(parsed.policy, ['https://shop.example.com/security-policy']);
    assert.deepEqual(parsed.hiring, ['https://shop.example.com/careers#security']);
    assert.deepEqual(parsed.preferredLanguages, ['en', 'fr']);

    const types = parsed.endpoints.map((e) => e.type).sort();
    assert.deepEqual(types, ['canonical', 'contact', 'contact', 'contact']);
    const canonicalEp = parsed.endpoints.find((e) => e.type === 'canonical');
    assert.equal(canonicalEp.https, true);
  });

  it('ignores comments and blank lines', () => {
    const parsed = parseSecurityTxt('# only a comment\n\n', 'https://a.example/');
    assert.deepEqual(parsed.contacts, []);
    assert.equal(parsed.expires, null);
  });
});

/* ------------------------------------------------------------------ */
/* 739 — expandAdsTxtDomains                                           */
/* ------------------------------------------------------------------ */

const ADS_TXT = `# ads.txt for shop.example.com
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
rubiconproject.com, 17344, RESELLER
# SUBDOMAIN=ads.shop.example.com
# OWNERDOMAIN=shop-example.com
# MANAGERDOMAIN=adops.partner-example.net
# CONTACT=adops@example.com
sovrn.com, 12345, DIRECT
`;

describe('739 expandAdsTxtDomains', () => {
  it('expands seeds with seller and declaration domains', () => {
    const { seeds, added, sellerDomains, declarationDomains } = expandAdsTxtDomains(ADS_TXT, ['shop.example.com']);
    assert.ok(sellerDomains.includes('google.com'));
    assert.ok(sellerDomains.includes('rubiconproject.com'));
    assert.ok(sellerDomains.includes('sovrn.com'));

    const addedDomains = added.map((a) => a.domain);
    assert.ok(addedDomains.includes('google.com'), 'seller domain added');
    assert.ok(addedDomains.includes('ads.shop.example.com'), 'SUBDOMAIN declaration added');
    assert.ok(addedDomains.includes('shop-example.com'), 'OWNERDOMAIN declaration added');
    assert.ok(addedDomains.includes('adops.partner-example.net'), 'MANAGERDOMAIN declaration added');
    assert.ok(!addedDomains.includes('shop.example.com'), 'existing seed not re-added');

    assert.ok(declarationDomains.includes('ads.shop.example.com'));
    assert.ok(seeds.includes('shop.example.com'));
    assert.ok(seeds.includes('google.com'));
    assert.ok(added.every((a) => a.via), 'every addition cites its source');
  });
});

/* ------------------------------------------------------------------ */
/* 740 — buildWaybackSeedUrls / normalizeCorpusUrls                    */
/* ------------------------------------------------------------------ */

describe('740 buildWaybackSeedUrls', () => {
  it('builds a multi-query CDX plan for a domain', () => {
    const { domain, queries, plan } = buildWaybackSeedUrls('Example.COM', { limit: 5000 });
    assert.equal(domain, 'example.com');
    assert.equal(queries.length, 3);
    assert.ok(queries[0].url.includes('web.archive.org/cdx/search/cdx'));
    assert.ok(queries[0].url.includes('matchType=domain'));
    assert.ok(queries[0].url.includes('filter=statuscode%3A200') || queries[0].url.includes('filter=statuscode:200'));
    assert.ok(queries[0].url.includes('limit=5000'));
    assert.equal(queries[1].scope, 'example.com');
    assert.equal(queries[2].scope, 'www.example.com');
    assert.equal(plan.collapse, 'urlkey');
    assert.ok(plan.note.length > 0);
  });

  it('handles an empty domain gracefully', () => {
    const result = buildWaybackSeedUrls('');
    assert.deepEqual(result.queries, []);
  });
});

describe('740 normalizeCorpusUrls', () => {
  const records = [
    { timestamp: '20260101', original: 'https://shop.example.com/products/widget?utm=x', statuscode: '200', mimetype: 'text/html' },
    { timestamp: '20260102', original: 'https://shop.example.com/products/widget', statuscode: '200', mimetype: 'text/html' },
    { timestamp: '20260103', original: 'https://shop.example.com/logo.png', statuscode: '200', mimetype: 'image/png' },
    { timestamp: '20260104', original: 'https://shop.example.com/old', statuscode: '404', mimetype: 'text/html' },
    { timestamp: '20260105', original: 'https://other.example.net/page', statuscode: '200', mimetype: 'text/html' },
    { timestamp: '20260106', original: 'not a url', statuscode: '200', mimetype: 'text/html' },
  ];

  it('keeps 200 HTML captures and drops assets, errors and out-of-scope hosts', () => {
    const { seeds, stats } = normalizeCorpusUrls(records, { domain: 'shop.example.com' });
    assert.deepEqual(seeds, [
      'https://shop.example.com/products/widget?utm=x',
      'https://shop.example.com/products/widget',
    ]);
    assert.equal(stats.kept, 2);
    assert.equal(stats.total, 6);
    assert.equal(stats.dropped['mimetype image/png'], 1);
    assert.equal(stats.dropped['status 404'], 1);
    assert.equal(stats.dropped['out-of-scope host'], 1);
    assert.equal(stats.dropped['unparseable url'], 1);
  });

  it('strips query strings when asked, collapsing parameter families', () => {
    const { seeds } = normalizeCorpusUrls(records.slice(0, 2), { domain: 'shop.example.com', stripQuery: true });
    assert.deepEqual(seeds, ['https://shop.example.com/products/widget']);
  });

  it('respects the max seed cap', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      timestamp: '20260101', original: `https://shop.example.com/p${i}`, statuscode: '200', mimetype: 'text/html',
    }));
    const { seeds } = normalizeCorpusUrls(many, { max: 3 });
    assert.equal(seeds.length, 3);
  });
});

/* ------------------------------------------------------------------ */
/* summarizeDocumentMap                                                */
/* ------------------------------------------------------------------ */

describe('summarizeDocumentMap', () => {
  it('combines miner outputs into a report-ready summary', () => {
    const summary = summarizeDocumentMap({
      robots: harvestRobotsDisallows(ROBOTS_TXT),
      security: parseSecurityTxt(SECURITY_TXT, 'https://shop.example.com/'),
      ads: expandAdsTxtDomains(ADS_TXT, ['shop.example.com']),
    });
    assert.ok(summary.targets > 0);
    assert.ok(summary.notes.some((n) => /robots\.txt/.test(n)));
    assert.ok(summary.notes.some((n) => /security\.txt/.test(n)));
    assert.ok(summary.notes.some((n) => /ads\.txt/.test(n)));
  });

  it('handles an empty input without throwing', () => {
    const summary = summarizeDocumentMap({});
    assert.deepEqual(summary, { targets: 0, notes: [] });
  });
});
