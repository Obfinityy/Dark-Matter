/**
 * structuredDataMiner.test.js — tests for the structured-data mining engine
 * (idea-bank wave 841, ideas 861-870).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapJobPostingHosts,
  mapEventVenues,
  mapProductOffers,
  mineBreadcrumbPaths,
  mineSitelinksSearchActions,
  mapSpeakableSections,
  mapAmpCanonicals,
  extractAmpAnalyticsEndpoints,
  mapInstantArticleUrls,
  mapAppleNewsChannels,
} from '../src/engines/structuredDataMiner.js';

const JOB_LD = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Senior Security Engineer',
  url: 'https://jobs.example.com/postings/123',
  directApply: true,
  hiringOrganization: {
    '@type': 'Organization',
    name: 'Example Corp',
    url: 'https://careers.example.com',
  },
  applicationContact: { '@type': 'ContactPoint', url: 'https://ats.example.com/apply/123' },
};

const EVENT_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'MusicEvent',
      name: 'Nullcon Afterparty',
      url: 'https://events.example.com/nullcon-party',
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: 'Grand Hall', url: 'https://venue.example.org/grand-hall' },
      organizer: { '@type': 'Organization', name: 'Nullcon', url: 'https://nullcon.example.net' },
      offers: { '@type': 'Offer', url: 'https://tickets.example.com/e/42' },
      performer: { '@type': 'MusicGroup', name: 'Synthwave Live' },
    },
  ],
};

const PRODUCT_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Pentest Laptop X1',
  url: 'https://shop.example.com/products/x1',
  offers: [
    {
      '@type': 'Offer',
      url: 'https://shop.example.com/products/x1/checkout',
      price: '1499.00',
      priceCurrency: 'USD',
      seller: { '@type': 'Organization', name: 'Example Store', url: 'https://shop.example.com' },
    },
  ],
  review: { '@type': 'Review', url: 'https://reviews.example.com/x1' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '132' },
});

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://docs.example.com/' },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: { '@id': 'https://docs.example.com/guides', name: 'Guides' } },
    { '@type': 'ListItem', position: 3, name: 'API Reference', item: 'https://docs.example.com/guides/api' },
  ],
};

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://search.example.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://search.example.com/?q={query}',
    'query-input': 'required name=query',
  },
};

const SPEAKABLE_LD = {
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  url: 'https://news.example.com/story/7',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['.article-headline', '#article-body'],
  },
};

describe('idea 861 — JobPosting schema host mapping', () => {
  it('extracts job, org and ATS hosts from a JobPosting blob', () => {
    const [entry] = mapJobPostingHosts([JOB_LD]);
    assert.equal(entry.title, 'Senior Security Engineer');
    assert.equal(entry.jobHost, 'jobs.example.com');
    assert.equal(entry.hiringOrg, 'Example Corp');
    assert.equal(entry.hiringOrgHost, 'careers.example.com');
    assert.equal(entry.directApply, true);
    assert.deepEqual(entry.contactUrls, ['https://ats.example.com/apply/123']);
  });

  it('returns [] for empty/invalid input and tolerates missing fields', () => {
    assert.deepEqual(mapJobPostingHosts(''), []);
    assert.deepEqual(mapJobPostingHosts('not json'), []);
    assert.deepEqual(mapJobPostingHosts(null), []);
    const [entry] = mapJobPostingHosts({ '@type': 'JobPosting', title: 'No URLs' });
    assert.equal(entry.jobHost, null);
    assert.equal(entry.hiringOrgHost, null);
    assert.equal(entry.directApply, null);
  });
});

describe('idea 862 — Event-schema venue mapping', () => {
  it('maps event, venue, organizer and offer URLs from @graph', () => {
    const [entry] = mapEventVenues(EVENT_LD);
    assert.equal(entry.name, 'Nullcon Afterparty');
    assert.equal(entry.eventHost, 'events.example.com');
    assert.equal(entry.eventStatus, 'EventScheduled');
    assert.equal(entry.venues[0].host, 'venue.example.org');
    assert.equal(entry.organizers[0].host, 'nullcon.example.net');
    assert.deepEqual(entry.offerUrls, ['https://tickets.example.com/e/42']);
    assert.deepEqual(entry.performerUrls, []);
  });

  it('ignores non-Event nodes', () => {
    assert.deepEqual(mapEventVenues([{ '@type': 'Person', name: 'Ada' }]), []);
  });
});

describe('idea 863 — Product-schema offer mapping', () => {
  it('extracts offer and review URLs from a JSON string blob', () => {
    const [entry] = mapProductOffers(PRODUCT_LD);
    assert.equal(entry.name, 'Pentest Laptop X1');
    assert.equal(entry.productHost, 'shop.example.com');
    assert.equal(entry.offers.length, 1);
    assert.equal(entry.offers[0].host, 'shop.example.com');
    assert.equal(entry.offers[0].price, '1499.00');
    assert.equal(entry.offers[0].priceCurrency, 'USD');
    assert.equal(entry.offers[0].seller, 'Example Store');
    assert.deepEqual(entry.reviewUrls, ['https://reviews.example.com/x1']);
    assert.deepEqual(entry.aggregateRating, { ratingValue: '4.8', reviewCount: '132' });
  });

  it('handles products without offers', () => {
    const [entry] = mapProductOffers({ '@type': 'Product', name: 'Freebie' });
    assert.deepEqual(entry.offers, []);
    assert.deepEqual(entry.reviewUrls, []);
    assert.equal(entry.aggregateRating, null);
  });
});

describe('idea 864 — Breadcrumb-schema path mining', () => {
  it('mines ordered breadcrumb trails with hierarchy depth', () => {
    const res = mineBreadcrumbPaths(BREADCRUMB_LD);
    assert.equal(res.trails.length, 1);
    const trail = res.trails[0];
    assert.equal(trail.depth, 3);
    assert.deepEqual(trail.items.map((i) => i.position), [1, 2, 3]);
    assert.equal(trail.items[2].path, '/guides/api');
    assert.equal(trail.root, 'docs.example.com');
    assert.equal(res.maxDepth, 3);
    assert.deepEqual(res.uniqueHosts, ['docs.example.com']);
  });

  it('handles string item form and missing lists', () => {
    const res = mineBreadcrumbPaths({
      '@type': 'BreadcrumbList',
      itemListElement: { '@type': 'ListItem', position: 5, item: 'https://x.example/a' },
    });
    assert.equal(res.trails[0].items[0].name, null);
    assert.deepEqual(mineBreadcrumbPaths([]).trails, []);
  });
});

describe('idea 865 — Sitelinks searchbox action mining', () => {
  it('extracts SearchAction target template and query param', () => {
    const [entry] = mineSitelinksSearchActions(WEBSITE_LD);
    assert.equal(entry.siteHost, 'search.example.com');
    assert.equal(entry.target, 'https://search.example.com/?q={query}');
    assert.equal(entry.targetHost, 'search.example.com');
    assert.equal(entry.queryInput, 'required name=query');
    assert.equal(entry.queryParam, 'q');
  });

  it('supports urlTemplate objects and skips non-search actions', () => {
    const res = mineSitelinksSearchActions({
      '@type': 'WebSite',
      url: 'https://shop.example.com',
      potentialAction: [
        { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: 'https://shop.example.com/s/{term}' } },
        { '@type': 'ViewAction', target: 'https://shop.example.com/view' },
      ],
    });
    assert.equal(res.length, 1);
    assert.equal(res[0].queryParam, 'term');
  });
});

describe('idea 866 — Speakable-schema section mapping', () => {
  it('maps speakable CSS selectors to the page URL', () => {
    const res = mapSpeakableSections(SPEAKABLE_LD);
    assert.equal(res.length, 1);
    assert.equal(res[0].pageHost, 'news.example.com');
    assert.deepEqual(res[0].selectors, [
      { type: 'css', value: '.article-headline' },
      { type: 'css', value: '#article-body' },
    ]);
  });

  it('classifies xpath strings and skips nodes without speakable', () => {
    const res = mapSpeakableSections({
      '@type': 'Article',
      speakable: '//*[@id="main"]/h1',
    });
    assert.equal(res[0].selectors[0].type, 'xpath');
    assert.equal(res[0].pageUrl, null);
    assert.deepEqual(mapSpeakableSections({ '@type': 'Article', headline: 'x' }), []);
  });
});

const AMP_HTML = `<!doctype html><html amp lang="en"><head>
<link rel="canonical" href="https://www.example.com/article/9">
<script type="application/ld+json">{"@type":"NewsArticle"}</script>
</head><body>
<amp-analytics type="googleanalytics">
<script type="application/json">
{"vars": {"account": "UA-1"},"requests": {"pageview": "https://www.google-analytics.com/r/collect?v=1&_v=a13&gtm=GTM-1&aip=true&_s=1&dl=SOURCE_URL&ul=UL&de=DE&dt=TITLE&cid=CLIENT_ID&tid=UA-1","event": "https://events.example.com/e?v=1"},"transport": {"beacon": "https://beacon.example.com/ping","xhrpost": "https://beacon.example.com/post"}}
</script>
</amp-analytics>
<amp-analytics config="https://config.example.net/analytics.json"></amp-analytics>
</body></html>`;

const CANONICAL_HTML = `<!doctype html><html lang="en"><head>
<link rel="amphtml" href="https://amp.example.com/article/9">
<link rel="canonical" href="https://www.example.com/article/9">
</head><body>hello</body></html>`;

describe('idea 867 — AMP-page canonical mapping', () => {
  it('maps an AMP page back to its canonical', () => {
    const res = mapAmpCanonicals(AMP_HTML);
    assert.equal(res.isAmpPage, true);
    assert.equal(res.ampUrl, null);
    assert.equal(res.canonicalUrl, 'https://www.example.com/article/9');
    assert.equal(res.canonicalHost, 'www.example.com');
    assert.equal(res.crossHost, false);
  });

  it('maps a canonical page to its AMP variant', () => {
    const res = mapAmpCanonicals(CANONICAL_HTML);
    assert.equal(res.isAmpPage, false);
    assert.equal(res.ampUrl, 'https://amp.example.com/article/9');
    assert.equal(res.ampHost, 'amp.example.com');
    assert.equal(res.crossHost, true);
  });
});

describe('idea 868 — AMP-analytics endpoint extraction', () => {
  it('extracts inline request and transport endpoints plus remote config', () => {
    const res = extractAmpAnalyticsEndpoints(AMP_HTML);
    assert.equal(res.length, 2);
    const [inline, remote] = res;
    assert.equal(inline.type, 'googleanalytics');
    assert.equal(inline.configUrl, null);
    const names = inline.requests.map((r) => r.name);
    assert.ok(names.includes('pageview'));
    assert.ok(names.includes('event'));
    assert.ok(names.includes('transport:beacon'));
    assert.ok(names.includes('transport:xhrpost'));
    const pageview = inline.requests.find((r) => r.name === 'pageview');
    assert.equal(pageview.host, 'www.google-analytics.com');
    const beacon = inline.requests.find((r) => r.name === 'transport:beacon');
    assert.equal(beacon.host, 'beacon.example.com');
    assert.equal(remote.configUrl, 'https://config.example.net/analytics.json');
    assert.equal(remote.configHost, 'config.example.net');
    assert.deepEqual(remote.requests, []);
  });

  it('returns [] when no amp-analytics blocks exist', () => {
    assert.deepEqual(extractAmpAnalyticsEndpoints('<html><body>no amp</body></html>'), []);
  });
});

const IA_HTML = `<!doctype html><html><head>
<meta property="op:markup_version" content="v1.0">
<meta property="ia:markup_url" content="https://cdn.example.com/ia/article-9.html">
<meta property="fb:pages" content="123456789">
<link rel="canonical" href="https://www.example.com/article/9">
<link rel="standout" href="https://www.example.com/article/9/featured">
</head><body></body></html>`;

describe('idea 869 — Instant-Article URL mapping', () => {
  it('detects Instant Article markup and maps markup/canonical hosts', () => {
    const res = mapInstantArticleUrls(IA_HTML);
    assert.equal(res.isInstantArticle, true);
    assert.equal(res.markupUrl, 'https://cdn.example.com/ia/article-9.html');
    assert.equal(res.markupHost, 'cdn.example.com');
    assert.equal(res.markupVersion, 'v1.0');
    assert.equal(res.canonicalUrl, 'https://www.example.com/article/9');
    assert.equal(res.canonicalHost, 'www.example.com');
    assert.deepEqual(res.fbPages, ['123456789']);
    assert.equal(res.standoutUrl, 'https://www.example.com/article/9/featured');
  });

  it('reports non-IA pages cleanly', () => {
    const res = mapInstantArticleUrls('<html><head><title>t</title></head></html>');
    assert.equal(res.isInstantArticle, false);
    assert.equal(res.markupUrl, null);
    assert.deepEqual(res.fbPages, []);
  });
});

const APPLE_HTML = `<!doctype html><html><head>
<meta name="apple-itunes-app" content="app-id=123456789, app-argument=https://apple.news/AxyzChannel123">
<meta name="apple-news:channel" content="https://apple.news/AxyzChannel123">
<link rel="alternate" href="https://apple.news/AxyzChannel123">
</head><body><a href="https://apple.news/AotherChannel456">Read in News</a></body></html>`;

describe('idea 870 — Apple-News URL mapping', () => {
  it('maps Apple News channels, app id and app arguments', () => {
    const res = mapAppleNewsChannels(APPLE_HTML);
    assert.equal(res.appId, '123456789');
    assert.deepEqual(res.appArguments, ['https://apple.news/AxyzChannel123']);
    assert.ok(res.channelUrls.includes('https://apple.news/AxyzChannel123'));
    assert.ok(res.channelUrls.includes('https://apple.news/AotherChannel456'));
    assert.deepEqual(res.channelHosts, ['apple.news']);
    assert.equal(res.appleNewsMeta.length, 1);
    assert.equal(res.appleNewsMeta[0].name, 'apple-news:channel');
  });

  it('returns empty structures when no Apple News markup exists', () => {
    const res = mapAppleNewsChannels('<html><head></head><body></body></html>');
    assert.deepEqual(res.channelUrls, []);
    assert.equal(res.appId, null);
    assert.deepEqual(res.appArguments, []);
  });
});
