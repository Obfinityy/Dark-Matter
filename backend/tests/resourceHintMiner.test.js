/**
 * resourceHintMiner.test.js — ideas 751-760 (resource-hint crawl miner).
 * Fixture-driven unit tests; no network access.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLinkHeaderRelations,
  harvestDnsPrefetchHints,
  analyzePreconnectHints,
  extractPrerenderUrls,
  mapResourceHintPriority,
  mineInlineSvg,
  mineMathmlHrefs,
  extractTemplateContent,
  harvestNoscriptLinks,
  mineDataAttributeUrls,
  mineAllResourceHints,
} from '../src/engines/resourceHintMiner.js';

// ---------- Idea 751: Link-header relation mapping ----------

test('751: parses multiple Link-header relations with params', () => {
  const header = '</app.js>; rel=preload; as=script, <https://cdn.example.com>; rel=preconnect; crossorigin, </page/2>; rel="alternate next"';
  const links = mapLinkHeaderRelations(header);
  assert.equal(links.length, 3);
  assert.equal(links[0].url, '/app.js');
  assert.deepEqual(links[0].rels, ['preload']);
  assert.equal(links[0].params.as, 'script');
  assert.deepEqual(links[1].rels, ['preconnect']);
  assert.equal(links[1].params.crossorigin, true);
  assert.deepEqual(links[2].rels, ['alternate', 'next']);
});

test('751: empty or malformed header returns empty array', () => {
  assert.deepEqual(mapLinkHeaderRelations(''), []);
  assert.deepEqual(mapLinkHeaderRelations('not a link header'), []);
  // commas inside quoted params are not split
  const links = mapLinkHeaderRelations('<x>; title="a,b", <y>; rel=dns-prefetch');
  assert.equal(links.length, 2);
});

// ---------- Idea 752: DNS-prefetch hint harvesting ----------

test('752: harvests unique dns-prefetch hostnames', () => {
  const html = `
    <head>
      <link rel="dns-prefetch" href="https://cdn.example.com">
      <link rel="dns-prefetch" href="//analytics.example.net/track">
      <link rel="dns-prefetch" href="https://cdn.example.com/other">
    </head>`;
  const hosts = harvestDnsPrefetchHints(html);
  assert.deepEqual(hosts, ['cdn.example.com', 'analytics.example.net']);
});

test('752: ignores non-dns-prefetch link tags', () => {
  const html = '<link rel="stylesheet" href="https://cdn.example.com/style.css">';
  assert.deepEqual(harvestDnsPrefetchHints(html), []);
});

// ---------- Idea 753: Preconnect hint analysis ----------

test('753: flags crossorigin preconnect origins as critical', () => {
  const html = `
    <link rel="preconnect" href="https://cdn.example.com" crossorigin>
    <link rel="preconnect" href="https://api.example.org">`;
  const { origins, critical } = analyzePreconnectHints(html);
  assert.equal(origins.length, 2);
  assert.equal(origins[0].crossorigin, true);
  assert.equal(origins[1].crossorigin, false);
  assert.deepEqual(critical, ['cdn.example.com']);
});

// ---------- Idea 754: Prerender hint URL extraction ----------

test('754: extracts prerender URLs as high-priority routes', () => {
  const html = `
    <link rel="prerender" href="/checkout">
    <link rel="prerender" href="https://app.example.com/dashboard">
    <link rel="prerender" href="/checkout">`;
  const urls = extractPrerenderUrls(html);
  assert.deepEqual(urls, ['/checkout', 'https://app.example.com/dashboard']);
});

// ---------- Idea 755: Resource-hint priority mapping ----------

test('755: orders hints by priority and maps critical hosts', () => {
  const html = `
    <link rel="dns-prefetch" href="https://analytics.example.net">
    <link rel="prerender" href="https://app.example.com/home">
    <link rel="preconnect" href="https://cdn.example.com">
    <link rel="preload" href="/main.js" as="script">`;
  const { byPriority, hosts, criticalHosts } = mapResourceHintPriority(html);
  const priorities = byPriority.map((h) => h.priority);
  assert.deepEqual(priorities, ['prerender', 'preconnect', 'preload', 'dns-prefetch']);
  assert.deepEqual(hosts, ['app.example.com', 'cdn.example.com', 'analytics.example.net']);
  assert.deepEqual(criticalHosts, ['app.example.com', 'cdn.example.com']);
});

// ---------- Idea 756: Inline SVG script mining ----------

test('756: finds embedded scripts and xlink:href URLs inside inline SVG', () => {
  const html = `
    <svg viewBox="0 0 10 10">
      <script>document.title = "marked";</script>
      <image xlink:href="https://assets.example.com/logo.png" href="#skip"/>
      <use xlink:href="/sprites.svg#icon"/>
    </svg>`;
  const { svgs, scripts, hrefs } = mineInlineSvg(html);
  assert.equal(svgs, 1);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].index, 0);
  assert.match(scripts[0].code, /document\.title/);
  // '#skip' fragment reference is skipped; real URLs kept
  assert.deepEqual(hrefs, ['https://assets.example.com/logo.png', '/sprites.svg#icon']);
});

test('756: no svg markup returns empty inventory', () => {
  assert.deepEqual(mineInlineSvg('<p>hello</p>'), { svgs: 0, scripts: [], hrefs: [] });
});

// ---------- Idea 757: MathML endpoint references ----------

test('757: collects hrefs and hosts from MathML blocks', () => {
  const html = `
    <math><mi href="https://math.example.com/assets/style.css">x</mi></math>
    <math><mtext href="/local/frac">y</mtext></math>`;
  const { blocks, hrefs, hosts } = mineMathmlHrefs(html);
  assert.equal(blocks, 2);
  assert.deepEqual(hrefs, ['https://math.example.com/assets/style.css', '/local/frac']);
  assert.deepEqual(hosts, ['math.example.com']);
});

// ---------- Idea 758: Template-tag content extraction ----------

test('758: extracts unrendered routes from <template> contents', () => {
  const html = `
    <template id="user-card">
      <a href="/users/123">profile</a>
      <form action="https://api.example.com/users"></form>
    </template>
    <template id="empty"></template>`;
  const { templates, contents, urls } = extractTemplateContent(html);
  assert.equal(templates, 1);
  assert.equal(contents.length, 1);
  assert.match(contents[0], /user-card|users\/123/);
  assert.ok(urls.includes('/users/123'));
  assert.ok(urls.includes('https://api.example.com/users'));
});

// ---------- Idea 759: Noscript-fallback link harvesting ----------

test('759: harvests links and meta-refresh URLs from noscript', () => {
  const html = `
    <noscript>
      <a href="/legacy/dashboard">legacy dashboard</a>
      <meta http-equiv="refresh" content="0;url=/legacy/entry">
      <form action="/legacy/login"></form>
    </noscript>`;
  const urls = harvestNoscriptLinks(html);
  assert.ok(urls.includes('/legacy/dashboard'));
  assert.ok(urls.includes('/legacy/entry'));
  assert.ok(urls.includes('/legacy/login'));
});

test('759: markup outside noscript is ignored', () => {
  const html = '<a href="/visible">x</a><noscript><a href="/hidden">y</a></noscript>';
  assert.deepEqual(harvestNoscriptLinks(html), ['/hidden']);
});

// ---------- Idea 760: Data-attribute URL mining ----------

test('760: mines URLs from data-* attributes used by JS routers', () => {
  const html = `
    <div data-href="/app/settings" data-api-endpoint="https://api.example.com/v2/users" data-count="3"></div>
    <button data-url="//cdn.example.com/modal.html" data-label="open">x</button>`;
  const { attributes, urls } = mineDataAttributeUrls(html);
  assert.equal(attributes.length, 5);
  assert.ok(attributes.some((a) => a.name === 'data-api-endpoint'));
  assert.deepEqual(urls, ['/app/settings', 'https://api.example.com/v2/users', '//cdn.example.com/modal.html']);
});

test('760: non-URL data values are reported as attributes but not URLs', () => {
  const { urls } = mineDataAttributeUrls('<div data-role="admin" data-toggle="true"></div>');
  assert.deepEqual(urls, []);
});

// ---------- Aggregator ----------

test('aggregator: mineAllResourceHints runs every miner over shared input', () => {
  const html = `
    <link rel="dns-prefetch" href="https://cdn.example.com">
    <link rel="prerender" href="/start">
    <svg><script>alert(1)</script></svg>
    <template><a href="/tpl">t</a></template>
    <noscript><a href="/nojs">n</a></noscript>
    <div data-href="/data-route"></div>`;
  const all = mineAllResourceHints({
    html,
    linkHeader: '</x.css>; rel=preload; as=style',
  });
  assert.deepEqual(all.dnsPrefetchHosts, ['cdn.example.com']);
  assert.deepEqual(all.prerenderUrls, ['/start']);
  assert.equal(all.inlineSvg.scripts.length, 1);
  assert.ok(all.templates.urls.includes('/tpl'));
  assert.deepEqual(all.noscriptLinks, ['/nojs']);
  assert.ok(all.dataAttributes.urls.includes('/data-route'));
  assert.equal(all.linkHeader.length, 1);
  assert.deepEqual(all.linkHeader[0].rels, ['preload']);
});
