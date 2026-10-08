/**
 * metaAssetMiner.test.js — Tests for ideas 781–790 (meta/link-rel asset crawl miner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUrlsFromText,
  mineStylesheetComments,
  extractSourceMappingUrls,
  harvestFaviconLinks,
  mapAppleTouchIcons,
  harvestMaskIcons,
  analyzeThemeColors,
  clusterHostsByThemeColor,
  mapOpenGraphImageHosts,
  extractTwitterCardUrls,
  discoverOEmbedProviders,
  mineWebmentionEndpoints,
  META_ASSET_IDEAS,
  registryComplete,
} from '../src/engines/metaAssetMiner.js';

const SAMPLE_CSS = `
/* Header styles */
.header { color: #111; }
/* TODO: remove the legacy banner — see /api/v1/legacy/banner */
/* Disabled endpoint: https://old-api.example.com/v1/users */
.footer { margin: 0; }
/*# sourceMappingURL=main.css.map */
/* Another comment with no links */
`;

const SAMPLE_HTML = `
<head>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="shortcut icon" href="https://cdn.example.com/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="120x120" href="https://cdn.example.com/icons/apple-120.png" />
  <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
  <meta property="og:image" content="https://media.example.com/og/hero.jpg" />
  <meta property="og:image" content="https://media.example.com/og/hero.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:video" content="https://media.example.com/og/intro.mp4" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://media.example.com/tw/card.jpg" />
  <meta name="twitter:player" content="https://media.example.com/tw/player.html" />
  <link rel="alternate" type="application/json+oembed" href="https://publish.example.com/oembed.json?url=x" title="oEmbed" />
  <link rel="alternate" type="application/xml+oembed" href="https://publish.example.com/oembed.xml" title="oEmbed XML" />
  <link rel="webmention" href="https://social.example.com/webmention" />
  <!-- Link: <https://social.example.com/webmention-alt>; rel="webmention" -->
</head>`;

test('781 — mineStylesheetComments mines comments, flags TODOs/disabled endpoints', () => {
  const comments = mineStylesheetComments(SAMPLE_CSS);
  assert.ok(comments.length >= 5, `expected >= 5 comments, got ${comments.length}`);
  const todo = comments.find((c) => c.comment.includes('TODO'));
  assert.ok(todo, 'TODO comment missing');
  assert.ok(todo.flags.includes('todo'), 'todo flag missing');
  assert.ok(todo.urls.includes('/api/v1/legacy/banner'), 'comment URL missing');
  const disabled = comments.find((c) => c.comment.includes('Disabled endpoint'));
  assert.ok(disabled.flags.includes('disabled-hint'), 'disabled flag missing');
  assert.ok(disabled.urls.includes('https://old-api.example.com/v1/users'), 'endpoint URL missing');
  const plain = comments.find((c) => c.comment === 'Header styles');
  assert.deepEqual(plain.urls, [], 'plain comment should have no URLs');
  assert.deepEqual(plain.flags, [], 'plain comment should have no flags');
});

test('781 edge — empty CSS and comment-less CSS give empty results', () => {
  assert.deepEqual(mineStylesheetComments(''), []);
  assert.deepEqual(mineStylesheetComments('.a{color:red}'), []);
  assert.deepEqual(mineStylesheetComments(undefined), []);
});

test('782 — extractSourceMappingUrls follows sourceMappingURL comments', () => {
  const maps = extractSourceMappingUrls(SAMPLE_CSS);
  assert.equal(maps.length, 1, `expected 1 sourcemap, got ${maps.length}`);
  assert.equal(maps[0].url, 'main.css.map');
  assert.equal(maps[0].host, '(relative)');
  const absolute = extractSourceMappingUrls('/*# sourceMappingURL=https://cdn.example.com/app.js.map */');
  assert.equal(absolute[0].host, 'cdn.example.com');
});

test('782 edge — no sourcemap comment and data-URL maps are skipped', () => {
  assert.deepEqual(extractSourceMappingUrls('/* no maps here */'), []);
  assert.deepEqual(extractSourceMappingUrls('/*# sourceMappingURL=data:application/json;base64,AAA */'), []);
  assert.deepEqual(extractSourceMappingUrls(''), []);
});

test('783 — harvestFaviconLinks harvests icon/manifest relations with hosts', () => {
  const icons = harvestFaviconLinks(SAMPLE_HTML);
  assert.ok(icons.length >= 4, `expected >= 4 icons, got ${icons.length}`);
  const png32 = icons.find((i) => i.href === '/favicon-32x32.png');
  assert.ok(png32, '32x32 icon missing');
  assert.equal(png32.rel, 'icon');
  assert.equal(png32.sizes, '32x32');
  assert.equal(png32.host, '(relative)');
  const cdn = icons.find((i) => i.href.includes('cdn.example.com/favicon.ico'));
  assert.equal(cdn.host, 'cdn.example.com', 'CDN host not mapped');
  const manifest = icons.find((i) => i.rel === 'manifest');
  assert.ok(manifest, 'manifest relation missing');
  // mask-icon is an icon-family relation too — harvested here as well.
  assert.ok(icons.some((i) => i.rel === 'mask-icon'), 'mask-icon relation missing');
});

test('783 edge — no icon links gives empty results', () => {
  assert.deepEqual(harvestFaviconLinks('<head><title>x</title></head>'), []);
  assert.deepEqual(harvestFaviconLinks(''), []);
});

test('784 — mapAppleTouchIcons maps paths across sizes, smallest first', () => {
  const icons = mapAppleTouchIcons(SAMPLE_HTML);
  assert.equal(icons.length, 3, `expected 3 apple-touch-icons, got ${icons.length}`);
  assert.equal(icons[0].sizes, '120x120', 'smallest size should come first');
  assert.equal(icons[0].host, 'cdn.example.com');
  assert.equal(icons[icons.length - 1].sizes, 'default', 'sizes-less icon should sort last as default');
  assert.ok(icons.every((i) => i.href && i.host), 'every entry needs href + host');
});

test('784 edge — no apple-touch-icon tags gives empty results', () => {
  assert.deepEqual(mapAppleTouchIcons('<link rel="icon" href="/f.png">'), []);
  assert.deepEqual(mapAppleTouchIcons(''), []);
});

test('785 — harvestMaskIcons extracts href + color', () => {
  const masks = harvestMaskIcons(SAMPLE_HTML);
  assert.equal(masks.length, 1, `expected 1 mask-icon, got ${masks.length}`);
  assert.equal(masks[0].href, '/safari-pinned-tab.svg');
  assert.equal(masks[0].color, '#5bbad5');
  assert.equal(masks[0].host, '(relative)');
});

test('785 edge — missing mask-icon returns empty', () => {
  assert.deepEqual(harvestMaskIcons('<link rel="icon" href="/f.png">'), []);
  assert.deepEqual(harvestMaskIcons(), []);
});

test('786 — analyzeThemeColors maps host → theme colors with media variants', () => {
  const analyzed = analyzeThemeColors([
    { host: 'shop.example.com', html: SAMPLE_HTML },
    { host: 'blog.example.com', html: '<meta name="theme-color" content="#0a0a0a">' },
    { host: 'plain.example.com', html: '<title>no meta</title>' },
  ]);
  assert.equal(analyzed.length, 3);
  const shop = analyzed.find((a) => a.host === 'shop.example.com');
  assert.equal(shop.colors.length, 2, 'should capture both plain and media-qualified colors');
  assert.ok(shop.colors.some((c) => c.color === '#0a0a0a' && c.media === ''));
  assert.ok(shop.colors.some((c) => c.media === '(prefers-color-scheme: light)'));
  const plain = analyzed.find((a) => a.host === 'plain.example.com');
  assert.deepEqual(plain.colors, [], 'host without theme-color gets empty colors');

  // Brand clustering: hosts sharing a color group together.
  const clusters = clusterHostsByThemeColor(analyzed);
  const dark = clusters.find((c) => c.color === '#0a0a0a');
  assert.deepEqual(dark.hosts.sort(), ['blog.example.com', 'shop.example.com']);
});

test('786 edge — empty snapshots and missing html are graceful', () => {
  assert.deepEqual(analyzeThemeColors([]), []);
  assert.deepEqual(analyzeThemeColors([null, { host: '' }]), []);
  const single = analyzeThemeColors([{ host: 'x.example.com' }]);
  assert.deepEqual(single[0].colors, []);
});

test('787 — mapOpenGraphImageHosts dedupes host + path rows', () => {
  const rows = mapOpenGraphImageHosts(SAMPLE_HTML);
  // og:image twice (deduped), og:image:width (no URL content → its value is '1200', kept), og:video
  const images = rows.filter((r) => r.property === 'og:image');
  assert.equal(images.length, 1, `duplicate og:image should dedupe, got ${images.length}`);
  assert.equal(images[0].host, 'media.example.com');
  assert.equal(images[0].path, '/og/hero.jpg');
  assert.ok(rows.some((r) => r.property === 'og:video'), 'og:video missing');
});

test('787 edge — no og tags and empty input', () => {
  assert.deepEqual(mapOpenGraphImageHosts('<meta name="description" content="x">'), []);
  assert.deepEqual(mapOpenGraphImageHosts(''), []);
});

test('788 — extractTwitterCardUrls extracts twitter media URLs', () => {
  const urls = extractTwitterCardUrls(SAMPLE_HTML);
  assert.equal(urls.length, 2, `expected 2 twitter media URLs, got ${urls.length}`);
  const image = urls.find((u) => u.name === 'twitter:image');
  assert.equal(image.host, 'media.example.com');
  const player = urls.find((u) => u.name === 'twitter:player');
  assert.ok(player.url.endsWith('player.html'));
  // twitter:card (non-URL value) must not be included.
  assert.ok(!urls.some((u) => u.name === 'twitter:card'), 'twitter:card value is not a URL');
});

test('788 edge — no twitter meta gives empty results', () => {
  assert.deepEqual(extractTwitterCardUrls('<meta property="og:image" content="https://x/y.jpg">'), []);
  assert.deepEqual(extractTwitterCardUrls(''), []);
});

test('789 — discoverOEmbedProviders finds json+xml oEmbed link tags', () => {
  const providers = discoverOEmbedProviders(SAMPLE_HTML);
  assert.equal(providers.length, 2, `expected 2 oEmbed providers, got ${providers.length}`);
  assert.ok(providers.some((p) => p.type === 'application/json+oembed'), 'json oembed missing');
  assert.ok(providers.some((p) => p.type === 'application/xml+oembed'), 'xml oembed missing');
  const json = providers.find((p) => p.type === 'application/json+oembed');
  assert.equal(json.host, 'publish.example.com');
  assert.equal(json.title, 'oEmbed');
  // Plain alternate links must not leak in.
  assert.ok(!providers.some((p) => !p.type.includes('oembed')));
});

test('789 edge — non-oembed links are ignored', () => {
  assert.deepEqual(
    discoverOEmbedProviders('<link rel="alternate" type="application/rss+xml" href="/feed">'),
    [],
  );
  assert.deepEqual(discoverOEmbedProviders(''), []);
});

test('790 — mineWebmentionEndpoints finds link tags and http-link hints', () => {
  const endpoints = mineWebmentionEndpoints(SAMPLE_HTML);
  assert.equal(endpoints.length, 2, `expected 2 webmention endpoints, got ${endpoints.length}`);
  const tag = endpoints.find((e) => e.source === 'link-tag');
  assert.equal(tag.href, 'https://social.example.com/webmention');
  assert.equal(tag.host, 'social.example.com');
  const hint = endpoints.find((e) => e.source === 'http-link-hint');
  assert.ok(hint.href.includes('webmention-alt'), 'http-link-hint endpoint missing');
});

test('790 edge — no webmention references gives empty results', () => {
  assert.deepEqual(mineWebmentionEndpoints('<link rel="pingback" href="/pb">'), []);
  assert.deepEqual(mineWebmentionEndpoints(''), []);
});

test('helpers — extractUrlsFromText finds full URLs and relative paths', () => {
  const urls = extractUrlsFromText('see https://a.example.com/x and /internal/path?q=1 now');
  assert.ok(urls.includes('https://a.example.com/x'));
  assert.ok(urls.includes('/internal/path?q=1'));
  assert.deepEqual(extractUrlsFromText('nothing here'), []);
  assert.deepEqual(extractUrlsFromText(''), []);
});

test('registry — all ideas 781–790 implemented with zero skips', () => {
  const ids = Object.keys(META_ASSET_IDEAS).map(Number).sort((a, b) => a - b);
  assert.deepEqual(ids, [781, 782, 783, 784, 785, 786, 787, 788, 789, 790]);
  const { covered, total } = registryComplete();
  assert.equal(total, 10);
  assert.equal(covered, 10, `expected 10/10 covered, got ${covered}/10`);
});
