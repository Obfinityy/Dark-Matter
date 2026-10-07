/**
 * interactiveCrawlMiner.test.js — Tests for ideas 721–730 (interactive UI crawl-surface miner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  harvestModalLinks,
  planDropdownExpansion,
  planAccordionExpansion,
  mineCarouselUrls,
  harvestSrcsets,
  planIntersectionTriggers,
  planVirtualListScroll,
  recoverCanvasLinks,
  traverseShadowRoots,
  mapWebComponentRoutes,
} from '../src/engines/interactiveCrawlMiner.js';

const MODAL_HTML = `
<div id="app">
  <a href="/home">Home</a>
  <dialog id="login-dialog">
    <form action="/api/auth/login" method="post">
      <a href="/forgot-password">Forgot password?</a>
      <a href="/sso/callback">SSO login</a>
    </form>
  </dialog>
  <div class="modal-backdrop" id="terms-modal">
    <a href="/terms">Terms</a>
    <a href="/privacy">Privacy</a>
    <img src="/assets/modal-banner.png" />
  </div>
</div>`;

test('721 — harvestModalLinks finds links hidden inside modals/dialogs', () => {
  const modals = harvestModalLinks(MODAL_HTML);
  assert.ok(modals.length >= 2, `expected >= 2 modals, got ${modals.length}`);
  const all = modals.flatMap((m) => m.urls);
  assert.ok(all.includes('/forgot-password'), 'dialog link missing');
  assert.ok(all.includes('/sso/callback'), 'dialog link missing');
  assert.ok(all.includes('/api/auth/login'), 'form action missing');
  assert.ok(all.includes('/terms'), 'class-modal link missing');
  assert.ok(all.includes('/assets/modal-banner.png'), 'modal image src missing');
  // Links outside modals must not leak in.
  assert.ok(!all.includes('/home'), 'leaked a non-modal link');
});

test('722 — planDropdownExpansion plans clicks for collapsed menus', () => {
  const plan = planDropdownExpansion([
    { id: 'nav-products', selector: '#nav-products', expanded: false, depth: 1, itemCount: 5 },
    { id: 'lang', selector: '#lang-picker', expanded: true, itemCount: 12 },
    { id: 'broken', expanded: false },
  ]);
  const clicks = plan.filter((p) => p.action === 'click');
  assert.equal(clicks.length, 1, 'one collapsed dropdown should get a click');
  assert.equal(clicks[0].target, '#nav-products');
  assert.ok(clicks[0].reason.length > 10, 'reason should be explanatory');
  const reads = plan.filter((p) => p.action === 'read_items');
  assert.equal(reads.length, 1, 'expanded dropdown should be read directly');
  const harvests = plan.filter((p) => p.action === 'harvest_links');
  assert.ok(harvests.length >= 1, 'plan should harvest revealed links');
});

test('723 — planAccordionExpansion returns ordered expansion steps', () => {
  const html = `
  <div class="accordion">
    <details id="faq-1"><summary>General questions</summary><p>See <a href="/help">help</a></p></details>
    <details id="faq-2"><summary>API reference</summary><p>Endpoints: <a href="/api/docs">docs</a></p></details>
    <div class="accordion-item" id="acc-3"><button>Billing</button><div><a href="/billing/portal">portal</a></div></div>
  </div>`;
  const plan = planAccordionExpansion(html);
  assert.equal(plan.length, 3, `expected 3 sections, got ${plan.length}`);
  assert.ok(plan.every((p) => p.action === 'expand' && p.reason.length > 10));
  // API-heavy section should be prioritized first.
  assert.equal(plan[0].target, '#faq-2', 'endpoint-rich section should come first');
});

test('724 — mineCarouselUrls extracts URLs from every slide', () => {
  const html = `
  <div class="carousel" id="hero">
    <div class="carousel-item"><a href="/promo/spring"><img src="/img/s1.jpg"/></a></div>
    <div class="carousel-item"><a href="/promo/summer"><img src="/img/s2.jpg"/></a></div>
    <div class="carousel-item"><a href="/promo/autumn"><img src="/img/s3.jpg"/></a></div>
  </div>`;
  const slides = mineCarouselUrls(html);
  assert.equal(slides.length, 3, `expected 3 slides, got ${slides.length}`);
  assert.deepEqual(slides.map((s) => s.slide), [1, 2, 3]);
  const all = slides.flatMap((s) => s.urls);
  assert.ok(all.includes('/promo/summer'), 'slide-2 link missing');
  assert.ok(all.includes('/img/s3.jpg'), 'slide-3 image missing');
});

test('725 — harvestSrcsets collects all candidate URLs with descriptors', () => {
  const html = `
  <picture>
    <source srcset="https://cdn-a.example.com/hero-480.webp 480w, https://cdn-a.example.com/hero-960.webp 960w" />
    <img loading="lazy" data-srcset="/img/hero-1x.jpg 1x, /img/hero-2x.jpg 2x" src="/img/hero-fallback.jpg" />
  </picture>`;
  const found = harvestSrcsets(html);
  assert.equal(found.length, 4, `expected 4 srcset candidates, got ${found.length}`);
  const webp = found.find((f) => f.url.includes('hero-480'));
  assert.equal(webp.descriptor, '480w');
  assert.equal(webp.host, 'cdn-a.example.com');
  const lazy = found.find((f) => f.url.includes('hero-2x'));
  assert.ok(lazy.element.includes('(lazy)'), 'lazy marker missing');
  assert.equal(lazy.host, '(relative)');
});

test('726 — planIntersectionTriggers emits scroll + harvest steps', () => {
  const plan = planIntersectionTriggers([
    { selector: '#feed', kind: 'list', observed: true },
    { selector: '#below-fold', kind: 'section' },
  ]);
  const scrolls = plan.filter((p) => p.action === 'scroll_into_view');
  assert.equal(scrolls.length, 2);
  const waits = plan.filter((p) => p.action === 'wait_for_network_idle');
  assert.equal(waits.length, 2, 'lists/sections need network-idle waits');
  const harvests = plan.filter((p) => p.action === 'harvest_links');
  assert.equal(harvests.length, 2);
});

test('727 — planVirtualListScroll computes sweep passes', () => {
  const plan = planVirtualListScroll({
    selector: '#user-table',
    total: 5000,
    rendered: 20,
    rowHeight: 48,
    viewportHeight: 600,
  });
  assert.equal(plan.length, 3);
  assert.equal(plan[0].action, 'scroll_to_top');
  const sweep = plan[1];
  assert.equal(sweep.action, 'scroll_sweep');
  assert.ok(sweep.passes > 20, `expected many passes, got ${sweep.passes}`);
  assert.ok(sweep.reason.includes('5000'));

  // Unknown geometry falls back to row-count estimate.
  const fallback = planVirtualListScroll({ selector: '#rows', total: 120, rendered: 15 });
  assert.ok(fallback[1].passes > 0, 'fallback must produce passes');

  // Invalid input yields no plan.
  assert.deepEqual(planVirtualListScroll({ selector: '#x', total: 0 }), []);
  assert.deepEqual(planVirtualListScroll({ total: 10 }), []);
});

test('728 — recoverCanvasLinks recovers URLs and hint-attributed paths', () => {
  const ocr = 'Dashboard v2.4 Visit https://status.example.com for uptime. Go to /reports/monthly for exports. www.docs.example.com has guides.';
  const links = recoverCanvasLinks(ocr, [
    { label: 'export-widget', baseUrl: 'https://app.example.com' },
  ]);
  const urls = links.map((l) => l.url);
  assert.ok(urls.includes('https://status.example.com'), 'bare https URL missing');
  assert.ok(urls.includes('https://www.docs.example.com'), 'www URL not normalized');
  assert.ok(
    urls.includes('https://app.example.com/reports/monthly'),
    'hint-attributed path missing',
  );
  const hinted = links.find((l) => l.url.endsWith('/reports/monthly'));
  assert.equal(hinted.source, 'hint:export-widget');
});

test('729 — traverseShadowRoots pierces nested shadow boundaries', () => {
  const tree = {
    tag: 'body',
    id: 'app',
    links: ['/home'],
    children: [
      {
        tag: 'user-card',
        id: 'uc1',
        links: [],
        shadow: [
          { tag: 'div', links: ['/profile/settings', '/api/user/prefs'] },
          {
            tag: 'inner-panel',
            id: 'ip',
            links: [],
            shadow: [{ tag: 'a', links: ['/deep/nested'] }],
          },
        ],
      },
    ],
  };
  const links = traverseShadowRoots(tree);
  const byUrl = Object.fromEntries(links.map((l) => [l.url, l.shadowPath]));
  assert.ok(byUrl['/home'], 'light-DOM link missing');
  assert.ok(byUrl['/profile/settings'], 'first-level shadow link missing');
  assert.ok(byUrl['/deep/nested'], 'nested shadow link missing');
  assert.ok(
    byUrl['/deep/nested'].includes('#shadow-root'),
    'nested path must show shadow boundary',
  );
  assert.equal(byUrl['/deep/nested'].split('#shadow-root').length - 1, 2, 'two boundaries expected');
  // javascript: URLs are excluded.
  const evil = traverseShadowRoots({ tag: 'x', links: ['javascript:alert(1)', '/ok'] });
  assert.deepEqual(evil.map((l) => l.url), ['/ok']);
});

test('730 — mapWebComponentRoutes builds per-component route tables', () => {
  const tables = mapWebComponentRoutes([
    { name: 'app-shell', router: true, routes: [
      { path: '/', component: 'home-page' },
      { path: '/search', component: 'search-page' },
      '/legacy',
    ] },
    { name: 'fancy-button' }, // not a router, no routes → skipped
    { name: 'admin-panel', routes: [{ path: '/admin' }] },
  ]);
  assert.equal(tables.length, 2);
  const shell = tables.find((t) => t.component === 'app-shell');
  assert.equal(shell.routes.length, 3);
  assert.deepEqual(shell.routes[0], { path: '/', component: 'home-page' });
  assert.deepEqual(shell.routes[2], { path: '/legacy' });
  assert.ok(!tables.some((t) => t.component === 'fancy-button'));
});
