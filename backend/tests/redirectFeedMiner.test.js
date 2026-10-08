/**
 * redirectFeedMiner.test.js — Tests for ideas 791–800 (feed/redirect/regional endpoint miner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPingbackEndpoint,
  harvestFeedUrls,
  parseAutodiscoveryLinks,
  mapJsonFeedEndpoints,
  parseSitemapImageEntries,
  parseSitemapVideoEntries,
  parseSitemapNewsEntries,
  mapHreflangAlternates,
  detectCanonicalChains,
  mapRedirectChain,
  REDIRECT_FEED_IDEAS,
  registryComplete,
} from '../src/engines/redirectFeedMiner.js';

const FEED_HTML = `<!DOCTYPE html><html><head>
<link rel="pingback" href="/xmlrpc.php" />
<link rel="alternate" type="application/rss+xml" title="Blog RSS" href="/feed/" />
<link rel="alternate" type="application/atom+xml" title="Blog Atom" href="https://feeds.example.com/atom.xml" />
<link rel="alternate" type="application/feed+json" title="JSON Feed" href="/feed.json" />
<link rel="alternate" hreflang="en" href="https://example.com/blog" />
<link rel="alternate" hreflang="de" href="https://example.de/blog" />
<link rel="alternate" hreflang="x-default" href="https://example.com/blog" />
</head><body>
<a href="/rss.xml">RSS</a>
<a href="/about">About</a>
</body></html>`;

/* ------------------------- 791 — pingback ------------------------- */

test('791 — detectPingbackEndpoint finds <link rel="pingback">', () => {
  const res = detectPingbackEndpoint('<link rel="pingback" href="https://blog.example.com/xmlrpc.php" />');
  assert.equal(res.found, true);
  assert.equal(res.endpoint, 'https://blog.example.com/xmlrpc.php');
  assert.equal(res.source, 'link-rel-pingback');
});

test('791 — detectPingbackEndpoint resolves relative href against pageUrl', () => {
  const res = detectPingbackEndpoint(FEED_HTML, '', 'https://example.com/blog/');
  assert.equal(res.found, true);
  assert.equal(res.endpoint, 'https://example.com/xmlrpc.php');
});

test('791 — detectPingbackEndpoint falls back to X-Pingback header hint', () => {
  const res = detectPingbackEndpoint('<html></html>', 'HTTP/1.1 200 OK\r\nX-Pingback: https://example.com/xmlrpc.php\r\n', 'https://example.com/');
  assert.equal(res.found, true);
  assert.equal(res.source, 'x-pingback-header');
  assert.equal(res.endpoint, 'https://example.com/xmlrpc.php');
});

test('791 — detectPingbackEndpoint returns not-found on empty input', () => {
  const res = detectPingbackEndpoint('', '');
  assert.equal(res.found, false);
  assert.equal(res.endpoint, null);
  assert.equal(res.source, null);
});

/* ------------------------- 792 — RSS harvest ------------------------- */

test('792 — harvestFeedUrls collects rss/atom autodiscovery links', () => {
  const feeds = harvestFeedUrls(FEED_HTML, 'https://example.com/');
  const urls = feeds.map((f) => f.url);
  assert.ok(urls.includes('https://example.com/feed/'), 'RSS autodiscovery link missing');
  assert.ok(urls.includes('https://feeds.example.com/atom.xml'), 'Atom autodiscovery link missing');
  const rss = feeds.find((f) => f.url === 'https://example.com/feed/');
  assert.equal(rss.type, 'rss');
  assert.equal(rss.title, 'Blog RSS');
});

test('792 — harvestFeedUrls picks up anchor feed conventions and ignores nav links', () => {
  const feeds = harvestFeedUrls(FEED_HTML, 'https://example.com/');
  const urls = feeds.map((f) => f.url);
  assert.ok(urls.includes('https://example.com/rss.xml'), 'anchor feed link missing');
  assert.ok(!urls.includes('https://example.com/about'), 'nav link must not be harvested');
});

test('792 — harvestFeedUrls returns empty array for empty input', () => {
  assert.deepEqual(harvestFeedUrls('', ''), []);
});

/* ------------------- 793 — autodiscovery + host ------------------- */

test('793 — parseAutodiscoveryLinks attributes feed-generator hosts', () => {
  const parsed = parseAutodiscoveryLinks(FEED_HTML, 'https://example.com/blog');
  const same = parsed.find((p) => p.url === 'https://example.com/feed/');
  assert.ok(same, 'expected same-host feed entry');
  assert.equal(same.feedHost, 'example.com');
  assert.equal(same.sameHostAsPage, true);
  const external = parsed.find((p) => p.url === 'https://feeds.example.com/atom.xml');
  assert.ok(external, 'expected external feed entry');
  assert.equal(external.feedHost, 'feeds.example.com');
  assert.equal(external.sameHostAsPage, false);
});

test('793 — parseAutodiscoveryLinks handles empty input gracefully', () => {
  assert.deepEqual(parseAutodiscoveryLinks(), []);
});

/* ---------------------- 794 — JSON Feed mapping ---------------------- */

test('794 — mapJsonFeedEndpoints finds application/feed+json links', () => {
  const feeds = mapJsonFeedEndpoints(FEED_HTML, 'https://example.com/');
  assert.equal(feeds.length, 1, `expected 1 JSON feed, got ${feeds.length}`);
  assert.equal(feeds[0].url, 'https://example.com/feed.json');
  assert.equal(feeds[0].type, 'jsonfeed');
  assert.equal(feeds[0].host, 'example.com');
  assert.equal(feeds[0].title, 'JSON Feed');
});

test('794 — mapJsonFeedEndpoints returns empty for pages without JSON feeds', () => {
  assert.deepEqual(mapJsonFeedEndpoints('<html><head></head></html>', 'https://example.com/'), []);
});

/* --------------------- 795 — sitemap-image mining --------------------- */

const IMAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>https://example.com/gallery</loc>
  <image:image><image:loc>https://cdn.example.com/img1.jpg</image:loc><image:title>Sunset</image:title><image:caption>A sunset</image:caption></image:image>
  <image:image><image:loc>https://cdn.example.com/img2.jpg</image:loc></image:image>
</url>
<url><loc>https://example.com/plain</loc></url>
</urlset>`;

test('795 — parseSitemapImageEntries returns image loc per page URL', () => {
  const pages = parseSitemapImageEntries(IMAGE_XML);
  const gallery = pages.find((p) => p.pageUrl === 'https://example.com/gallery');
  assert.ok(gallery, 'gallery entry missing');
  assert.equal(gallery.images.length, 2);
  assert.equal(gallery.images[0].loc, 'https://cdn.example.com/img1.jpg');
  assert.equal(gallery.images[0].title, 'Sunset');
  assert.equal(gallery.images[0].caption, 'A sunset');
  assert.equal(gallery.images[1].loc, 'https://cdn.example.com/img2.jpg');
  assert.equal(gallery.images[1].title, '');
  const plain = pages.find((p) => p.pageUrl === 'https://example.com/plain');
  assert.ok(plain, 'plain entry missing');
  assert.deepEqual(plain.images, []);
});

test('795 — parseSitemapImageEntries handles malformed XML gracefully', () => {
  assert.deepEqual(parseSitemapImageEntries('not <xml at all'), []);
  assert.deepEqual(parseSitemapImageEntries(''), []);
});

/* --------------------- 796 — sitemap-video mining --------------------- */

const VIDEO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
<url><loc>https://example.com/watch/intro</loc>
  <video:video>
    <video:title>Intro Tour</video:title>
    <video:thumbnail_loc>https://videos.example.com/t/intro.jpg</video:thumbnail_loc>
    <video:player_loc>https://player.videoplatform.com/embed/123</video:player_loc>
    <video:duration>120</video:duration>
  </video:video>
</url>
</urlset>`;

test('796 — parseSitemapVideoEntries extracts title, thumbnail and player_loc', () => {
  const pages = parseSitemapVideoEntries(VIDEO_XML);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageUrl, 'https://example.com/watch/intro');
  const video = pages[0].videos[0];
  assert.equal(video.title, 'Intro Tour');
  assert.equal(video.thumbnailLoc, 'https://videos.example.com/t/intro.jpg');
  assert.equal(video.playerLoc, 'https://player.videoplatform.com/embed/123');
  assert.equal(video.duration, '120');
});

test('796 — parseSitemapVideoEntries handles malformed XML gracefully', () => {
  assert.deepEqual(parseSitemapVideoEntries('garbage{{['), []);
});

/* --------------------- 797 — sitemap-news mining --------------------- */

const NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
<url><loc>https://example.com/news/2026/10/launch</loc>
  <news:news>
    <news:publication><news:name>Example Times</news:name><news:language>en</news:language></news:publication>
    <news:title>Product Launch</news:title>
    <news:publication_date>2026-10-07</news:publication_date>
    <news:keywords>launch, product</news:keywords>
  </news:news>
</url>
</urlset>`;

test('797 — parseSitemapNewsEntries extracts title, publication date and name', () => {
  const pages = parseSitemapNewsEntries(NEWS_XML);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageUrl, 'https://example.com/news/2026/10/launch');
  const article = pages[0].articles[0];
  assert.equal(article.title, 'Product Launch');
  assert.equal(article.publicationDate, '2026-10-07');
  assert.equal(article.publicationName, 'Example Times');
  assert.equal(article.keywords, 'launch, product');
});

test('797 — parseSitemapNewsEntries handles malformed XML gracefully', () => {
  assert.deepEqual(parseSitemapNewsEntries('<url><loc>'), []);
});

/* --------------------- 798 — hreflang mapping --------------------- */

test('798 — mapHreflangAlternates maps hreflang → href for regional variants', () => {
  const alternates = mapHreflangAlternates(FEED_HTML, 'https://example.com/blog');
  const byLang = Object.fromEntries(alternates.map((a) => [a.hreflang, a.url]));
  assert.equal(byLang.en, 'https://example.com/blog');
  assert.equal(byLang.de, 'https://example.de/blog');
  assert.equal(byLang['x-default'], 'https://example.com/blog');
  const de = alternates.find((a) => a.hreflang === 'de');
  assert.equal(de.host, 'example.de');
});

test('798 — mapHreflangAlternates deduplicates repeated alternates', () => {
  const dupes = `<link rel="alternate" hreflang="fr" href="https://example.fr/" />
<link rel="alternate" hreflang="FR" href="https://example.fr/" />`;
  assert.equal(mapHreflangAlternates(dupes).length, 1);
});

test('798 — mapHreflangAlternates returns empty for empty input', () => {
  assert.deepEqual(mapHreflangAlternates(''), []);
});

/* ------------------ 799 — canonical chain/loop detection ------------------ */

test('799 — detectCanonicalChains follows simple chains', () => {
  const { chains, loops } = detectCanonicalChains([
    { url: 'https://a.example.com/page', canonical: 'https://example.com/page' },
    { url: 'https://example.com/page', canonical: 'https://example.com/page' },
  ]);
  assert.equal(loops.length, 0, 'no loop expected');
  const chain = chains.find((c) => c[0] === 'https://a.example.com/page');
  assert.deepEqual(chain, ['https://a.example.com/page', 'https://example.com/page']);
});

test('799 — detectCanonicalChains detects a real canonical loop', () => {
  const { loops } = detectCanonicalChains([
    { url: 'https://example.com/a', canonical: 'https://example.com/b' },
    { url: 'https://example.com/b', canonical: 'https://example.com/c' },
    { url: 'https://example.com/c', canonical: 'https://example.com/a' },
  ]);
  assert.equal(loops.length, 1, `expected 1 loop, got ${loops.length}`);
  const loop = loops[0];
  assert.ok(loop.includes('https://example.com/a'));
  assert.ok(loop.includes('https://example.com/b'));
  assert.ok(loop.includes('https://example.com/c'));
  // A→B→C→A closes the cycle with a repeated endpoint.
  assert.equal(loop[0], loop[loop.length - 1], 'loop must close on its start node');
});

test('799 — detectCanonicalChains handles self-canonical and missing canonicals', () => {
  const { chains, loops } = detectCanonicalChains([
    { url: 'https://example.com/x' },
    { url: 'https://example.com/y', canonical: 'https://example.com/y' },
  ]);
  assert.equal(loops.length, 0);
  assert.equal(chains.length, 2);
  assert.deepEqual(chains.find((c) => c[0] === 'https://example.com/x'), ['https://example.com/x']);
});

test('799 — detectCanonicalChains handles empty input', () => {
  const res = detectCanonicalChains([]);
  assert.deepEqual(res.chains, []);
  assert.deepEqual(res.loops, []);
});

/* ------------------- 800 — redirect-chain mapping ------------------- */

const CHAIN = [
  { url: 'http://example.com/', status: 301, location: 'https://example.com/' },
  { url: 'https://example.com/', status: 302, location: 'https://www.example.com/' },
  { url: 'https://www.example.com/', status: 200 },
];

test('800 — mapRedirectChain summarizes final and intermediate hosts', () => {
  const res = mapRedirectChain(CHAIN);
  assert.equal(res.hops, 3);
  assert.equal(res.finalUrl, 'https://www.example.com/');
  assert.equal(res.finalHost, 'www.example.com');
  assert.deepEqual(res.intermediateHosts, [
    { host: 'example.com', hops: 2 },
    { host: 'www.example.com', hops: 1 },
  ]);
  assert.equal(res.crossHost, true);
  assert.equal(res.loop, false);
});

test('800 — mapRedirectChain detects a revisit loop', () => {
  const res = mapRedirectChain([
    { url: 'https://example.com/a', status: 302, location: 'https://example.com/b' },
    { url: 'https://example.com/b', status: 302, location: 'https://example.com/a' },
    { url: 'https://example.com/a', status: 302, location: 'https://example.com/b' },
  ]);
  assert.equal(res.loop, true);
  assert.equal(res.finalUrl, 'https://example.com/a');
});

test('800 — mapRedirectChain flags cross-host redirects', () => {
  const res = mapRedirectChain([
    { url: 'http://short.example/', status: 301, location: 'https://shop.example.com/' },
    { url: 'https://shop.example.com/', status: 200 },
  ]);
  assert.equal(res.crossHost, true);
  assert.equal(res.intermediateHosts.length, 2);
});

test('800 — mapRedirectChain handles empty chain', () => {
  const res = mapRedirectChain([]);
  assert.equal(res.hops, 0);
  assert.equal(res.finalUrl, '');
  assert.equal(res.finalHost, '');
  assert.deepEqual(res.intermediateHosts, []);
  assert.equal(res.crossHost, false);
  assert.equal(res.loop, false);
});

/* ------------------------- registry ------------------------- */

test('registry — REDIRECT_FEED_IDEAS covers all 10 ideas with zero skips', () => {
  const ids = Object.keys(REDIRECT_FEED_IDEAS).map(Number).sort((a, b) => a - b);
  assert.deepEqual(ids, [791, 792, 793, 794, 795, 796, 797, 798, 799, 800], 'registry must list exactly 791–800');
  for (const id of ids) {
    const fnName = REDIRECT_FEED_IDEAS[id];
    assert.ok(fnName && typeof fnName === 'string', `idea ${id} has no function name`);
  }
});

test('registry — registryComplete() reports 10/10 covered', () => {
  const { covered, total } = registryComplete();
  assert.equal(total, 10);
  assert.equal(covered, 10, 'every idea must map to a real exported function');
});
