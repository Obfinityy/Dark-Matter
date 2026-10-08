/**
 * mediaAssetMiner.test.js — Tests for ideas 771–780 (media/CSS asset crawl miner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mineCalendarDateUrls,
  harvestMapTileUrls,
  extractVideoSources,
  extractAudioSources,
  harvestTrackUrls,
  extractPictureSources,
  parseCssUrlReferences,
  followCssImportChains,
  extractFontFaceUrls,
  findCssCustomPropertyUrls,
  MEDIA_ASSET_IDEAS,
  registryComplete,
} from '../src/engines/mediaAssetMiner.js';

test('771 — mineCalendarDateUrls normalizes date-parameterized calendar links', () => {
  const html = `
  <div class="calendar-widget">
    <a href="/events?date=2026-10-08">Today</a>
    <a href="/events/2026/10/09">Oct 9</a>
    <a href="/calendar?year=2026&month=10&day=10">Oct 10</a>
    <a href="/events?start=2026-10-01&end=2026-10-31">Range</a>
    <a href="/about">About</a>
  </div>`;
  const found = mineCalendarDateUrls(html);
  assert.ok(found.length >= 4, `expected >= 4 date patterns, got ${found.length}`);
  const byUrl = Object.fromEntries(found.map((f) => [f.url, f]));
  assert.equal(byUrl['/events?date=2026-10-08'].pattern, '/events?date={date}');
  assert.equal(byUrl['/events/2026/10/09'].pattern, '/events/{year}/{month}/{day}');
  assert.equal(byUrl['/calendar?year=2026&month=10&day=10'].pattern, '/calendar?year={year}&month={month}&day={day}');
  assert.ok(byUrl['/events?start=2026-10-01&end=2026-10-31'].pattern.includes('{date}'), 'start/end pattern missing');
  // Non-date link must not be picked up.
  assert.ok(!found.some((f) => f.url === '/about'), 'leaked a non-date link');
});

test('771 — edge cases: empty input, no date links, non-date query values', () => {
  assert.deepEqual(mineCalendarDateUrls(''), []);
  assert.deepEqual(mineCalendarDateUrls('<a href="/home">x</a>'), []);
  // Query value that is not date-like must not be normalized.
  assert.deepEqual(mineCalendarDateUrls('<a href="/search?q=hello&page=2">x</a>'), []);
});

test('772 — harvestMapTileUrls identifies tile providers and hosts', () => {
  const html = `
  <script>
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    var g = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    var rel = "/tiles/{z}/{x}/{y}.png";
  </script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />`;
  const found = harvestMapTileUrls(html);
  const byUrl = Object.fromEntries(found.map((f) => [f.url, f]));
  assert.equal(byUrl['https://tile.openstreetmap.org/{z}/{x}/{y}.png'].provider, 'OpenStreetMap');
  assert.equal(byUrl['https://tile.openstreetmap.org/{z}/{x}/{y}.png'].host, 'tile.openstreetmap.org');
  assert.equal(byUrl['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'].provider, 'Google Maps');
  const rel = byUrl['/tiles/{z}/{x}/{y}.png'];
  assert.ok(rel, 'relative tile template missing');
  assert.equal(rel.provider, 'Generic tile template');
  assert.equal(rel.host, '(relative)');
  // Non-tile stylesheet must not leak in.
  assert.ok(!found.some((f) => f.url.includes('leaflet.css')), 'leaked a non-tile URL');
});

test('772 — edge cases: empty input, no tile markers', () => {
  assert.deepEqual(harvestMapTileUrls(''), []);
  assert.deepEqual(harvestMapTileUrls('<img src="/img/logo.png" />'), []);
});

test('773 — extractVideoSources collects src, poster and <source> children', () => {
  const html = `
  <video id="promo" poster="/img/promo-poster.jpg" controls>
    <source src="/media/promo-720.mp4" type="video/mp4" />
    <source src="/media/promo-720.webm" type="video/webm" />
  </video>
  <video src="/media/intro.mp4"></video>`;
  const found = extractVideoSources(html);
  assert.equal(found.length, 4, `expected 4 sources, got ${found.length}`);
  const kinds = found.map((f) => f.kind).sort();
  assert.deepEqual(kinds, ['poster', 'source', 'source', 'src']);
  const mp4 = found.find((f) => f.url === '/media/promo-720.mp4');
  assert.equal(mp4.type, 'video/mp4');
  assert.equal(mp4.container, 'video#promo');
  assert.ok(found.some((f) => f.url === '/img/promo-poster.jpg' && f.kind === 'poster'));
});

test('773 — edge cases: empty input, video without sources', () => {
  assert.deepEqual(extractVideoSources(''), []);
  assert.deepEqual(extractVideoSources('<video controls></video>'), []);
});

test('774 — extractAudioSources collects src and <source> children', () => {
  const html = `
  <audio id="pod" controls>
    <source src="/audio/ep1.mp3" type="audio/mpeg" />
    <source src="/audio/ep1.ogg" type="audio/ogg" />
  </audio>
  <audio src="/audio/jingle.wav"></audio>`;
  const found = extractAudioSources(html);
  assert.equal(found.length, 3, `expected 3 sources, got ${found.length}`);
  assert.ok(found.some((f) => f.url === '/audio/ep1.mp3' && f.type === 'audio/mpeg' && f.container === 'audio#pod'));
  assert.ok(found.some((f) => f.url === '/audio/jingle.wav' && f.kind === 'src'));
  assert.deepEqual(extractAudioSources(''), []);
});

test('775 — harvestTrackUrls collects caption tracks with language metadata', () => {
  const html = `
  <video controls>
    <source src="/media/talk.mp4" type="video/mp4" />
    <track src="/captions/talk-en.vtt" kind="captions" srclang="en" label="English" />
    <track src="/captions/talk-es.vtt" kind="subtitles" srclang="es" label="Spanish" />
  </video>`;
  const found = harvestTrackUrls(html);
  assert.equal(found.length, 2, `expected 2 tracks, got ${found.length}`);
  const en = found.find((f) => f.srclang === 'en');
  assert.equal(en.url, '/captions/talk-en.vtt');
  assert.equal(en.kind, 'captions');
  assert.equal(en.label, 'English');
  assert.deepEqual(harvestTrackUrls(''), []);
});

test('776 — extractPictureSources harvests responsive sources with media/type metadata', () => {
  const html = `
  <picture id="hero">
    <source media="(min-width: 1024px)" type="image/webp" srcset="/img/hero-lg.webp 1x, /img/hero-lg-2x.webp 2x" />
    <source media="(max-width: 640px)" srcset="/img/hero-sm.jpg 640w" />
    <img src="/img/hero.jpg" alt="hero" />
  </picture>`;
  const found = extractPictureSources(html);
  assert.equal(found.length, 4, `expected 4 candidates, got ${found.length}`);
  const lg = found.find((f) => f.url === '/img/hero-lg.webp');
  assert.equal(lg.descriptor, '1x');
  assert.equal(lg.media, '(min-width: 1024px)');
  assert.equal(lg.type, 'image/webp');
  assert.ok(lg.element.includes('picture#hero'), 'picture container label missing');
  const sm = found.find((f) => f.url === '/img/hero-sm.jpg');
  assert.equal(sm.descriptor, '640w');
  assert.ok(found.some((f) => f.url === '/img/hero.jpg' && f.element.endsWith('>img')));
  assert.deepEqual(extractPictureSources(''), []);
});

test('777 — parseCssUrlReferences classifies font/image/import kinds', () => {
  const css = `
  @import url("theme/base.css");
  body { background: url("/img/bg.png"); }
  @font-face { font-family: "Brand"; src: url("/fonts/brand.woff2") format("woff2"); }
  .icon { mask-image: url('icons/sprite.svg#home'); }`;
  const found = parseCssUrlReferences(css);
  const byUrl = Object.fromEntries(found.map((f) => [f.url, f]));
  assert.equal(byUrl['theme/base.css'].kind, 'import');
  assert.equal(byUrl['/img/bg.png'].kind, 'image');
  assert.equal(byUrl['/img/bg.png'].context, 'background');
  assert.equal(byUrl['/fonts/brand.woff2'].kind, 'font');
  assert.equal(byUrl['icons/sprite.svg#home'].kind, 'image');
});

test('777 — edge cases: malformed CSS and data URIs handled gracefully', () => {
  assert.deepEqual(parseCssUrlReferences(''), []);
  // Unclosed url( must not throw and yields nothing.
  assert.deepEqual(parseCssUrlReferences('body { background: url('), []);
  assert.deepEqual(parseCssUrlReferences('(((;not css at all'), []);
  // Embedded data URIs are not crawl surface — excluded.
  const data = parseCssUrlReferences('a { background: url("data:image/png;base64,iVBOR"); }');
  assert.deepEqual(data, [], 'data: URI should be excluded');
});

test('778 — followCssImportChains orders imports and detects cycles', () => {
  const sheets = {
    'main.css': '@import "a.css"; body { color: red; }',
    'a.css': '@import url("b.css") screen; h1 { margin: 0; }',
    'b.css': 'h1 { color: blue; }',
    'x.css': '@import "y.css";',
    'y.css': '@import "x.css";',
  };
  const chain = followCssImportChains(sheets, 'main.css');
  assert.deepEqual(chain.order, ['main.css', 'a.css', 'b.css']);
  assert.deepEqual(chain.cycles, []);
  assert.equal(chain.entry, 'main.css');

  const cyc = followCssImportChains(sheets, 'x.css');
  assert.equal(cyc.cycles.length, 1, `expected 1 cycle, got ${JSON.stringify(cyc.cycles)}`);
  assert.deepEqual(cyc.cycles[0], ['x.css', 'y.css', 'x.css']);
});

test('778 — edge cases: single string input, missing entry, diamond imports', () => {
  const single = followCssImportChains('@import "one.css";', 'solo.css');
  assert.deepEqual(single.order, ['solo.css', 'one.css']);
  assert.deepEqual(single.cycles, []);

  const missing = followCssImportChains({}, 'ghost.css');
  assert.deepEqual(missing.order, ['ghost.css']);

  const diamond = {
    'main.css': '@import "a.css"; @import "b.css";',
    'a.css': '@import "c.css";',
    'b.css': '@import "c.css";',
    'c.css': '',
  };
  const d = followCssImportChains(diamond, 'main.css');
  assert.deepEqual(d.order, ['main.css', 'a.css', 'c.css', 'b.css']);
  assert.deepEqual(d.cycles, []);
});

test('779 — extractFontFaceUrls collects font files with format hints', () => {
  const css = `
  @font-face {
    font-family: "Brand";
    font-weight: 700;
    font-style: normal;
    src: url("/fonts/brand-bold.woff2") format("woff2"),
         url("/fonts/brand-bold.woff") format("woff");
  }
  @font-face {
    font-family: "Mono";
    src: url(/fonts/mono.ttf);
  }`;
  const found = extractFontFaceUrls(css);
  assert.equal(found.length, 3, `expected 3 font files, got ${found.length}`);
  const woff2 = found.find((f) => f.url === '/fonts/brand-bold.woff2');
  assert.equal(woff2.format, 'woff2');
  assert.equal(woff2.family, 'Brand');
  assert.equal(woff2.weight, '700');
  assert.equal(woff2.style, 'normal');
  const ttf = found.find((f) => f.url === '/fonts/mono.ttf');
  assert.equal(ttf.format, '');
  assert.equal(ttf.family, 'Mono');
  assert.deepEqual(extractFontFaceUrls(''), []);
});

test('780 — findCssCustomPropertyUrls finds URLs in CSS variables', () => {
  const css = `
  :root {
    --hero-image: url("/img/hero.jpg");
    --icon-arrow: url('icons/arrow.svg');
    --brand-color: #b98a1e;
  }
  .card { --card-bg: url(https://cdn.example.com/card.png); }`;
  const found = findCssCustomPropertyUrls(css);
  assert.equal(found.length, 3, `expected 3 variable URLs, got ${found.length}`);
  const byName = Object.fromEntries(found.map((f) => [f.name, f.url]));
  assert.equal(byName['--hero-image'], '/img/hero.jpg');
  assert.equal(byName['--icon-arrow'], 'icons/arrow.svg');
  assert.equal(byName['--card-bg'], 'https://cdn.example.com/card.png');
  assert.deepEqual(findCssCustomPropertyUrls(''), []);
});

test('registry — all 10 ideas 771–780 covered with zero skips', () => {
  const keys = Object.keys(MEDIA_ASSET_IDEAS).map(Number).sort((a, b) => a - b);
  assert.deepEqual(keys, [771, 772, 773, 774, 775, 776, 777, 778, 779, 780], 'idea keys must be exactly 771–780');
  assert.equal(new Set(Object.values(MEDIA_ASSET_IDEAS)).size, 10, 'each idea must map to a distinct function');
  assert.deepEqual(registryComplete(), { covered: 10, total: 10 });
});
