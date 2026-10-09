import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAsyncScriptDependencies,
  extractModulePreloadGraph,
  analyzePreloadScannerHints,
  mapFetchPriorityHints,
  mapLazyHydrationBoundaries,
  mapIslandArchitectureComponents,
  mapPartialHydrationTriggers,
  mineServerComponentPayloads,
  analyzeRscFlightProtocol,
  mapTurbopackChunks,
} from './ssrHydrationSurface.js';

const SAMPLE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Shop</title>
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/fonts/app.woff2" as="font" type="font/woff2" crossorigin fetchpriority="high">
<link rel="modulepreload" href="/_next/static/chunks/app.js" crossorigin>
<link rel="prefetch" href="/about">
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://api.example.com">
<script async src="https://cdn.example.com/vendor/analytics.js"></script>
<script defer src="/js/app.js" integrity="sha384-abc" crossorigin="anonymous"></script>
<script type="module">import { cart } from "/js/cart.js"; import "/js/checkout.js";</script>
<script>self.__next_f.push([1,"0:I[\\"abc\\",\\"app/page\\",\\"\\"]\\n2:[\\"$\\",\\"div\\",null,{\\"children\\":\\"/dashboard\\"}]"]);</script>
<script>self.__next_f.push([1,"3:\\"/api/products?cat=shoes\\"\\n"]);</script>
<script id="__NEXT_DATA__" type="application/json">{"page":"/shop","query":{}}</script>
</head>
<body>
<div id="__next"><!--$--><main data-server-rendered-check><!--/$--></main></div>
<img src="/img/hero.jpg" fetchpriority="high" alt="hero">
<img src="/img/footer.png" fetchpriority="low" alt="footer">
<astro-island component-url="/_astro/Cart.D123.js" component-export="default" renderer-url="/_astro/client.svelte.js" props="{&quot;api&quot;:&quot;/api/cart&quot;}"></astro-island>
<iframe src="/embed/map" fetchpriority="auto"></iframe>
</body>
</html>`;

test('931 mapAsyncScriptDependencies finds async and defer scripts', () => {
  const res = mapAsyncScriptDependencies(SAMPLE_PAGE);
  assert.equal(res.length, 2);
  assert.equal(res[0].kind, 'async');
  assert.equal(res[0].src, 'https://cdn.example.com/vendor/analytics.js');
  assert.equal(res[1].kind, 'defer');
  assert.equal(res[1].integrity, 'sha384-abc');
  assert.equal(res[1].crossorigin, 'anonymous');
  assert.deepEqual(res.map(r => r.order), [0, 1]);
});

test('931 mapAsyncScriptDependencies ignores sync scripts and non-strings', () => {
  assert.deepEqual(mapAsyncScriptDependencies('<script src="/x.js"></script>'), []);
  assert.deepEqual(mapAsyncScriptDependencies(null), []);
  assert.deepEqual(mapAsyncScriptDependencies(42), []);
});

test('932 extractModulePreloadGraph parses preloads and inline imports', () => {
  const res = extractModulePreloadGraph(SAMPLE_PAGE);
  assert.equal(res.preloads.length, 1);
  assert.equal(res.preloads[0].href, '/_next/static/chunks/app.js');
  assert.equal(res.preloads[0].crossorigin, '');
  assert.equal(res.moduleImports.length, 1);
  assert.deepEqual(res.moduleImports[0].specifiers, ['/js/cart.js', '/js/checkout.js']);
  assert.ok(Array.isArray(res.edges));
});

test('932 extractModulePreloadGraph matches import specifier to preloaded href', () => {
  const html = '<link rel="modulepreload" href="/js/cart.js">' +
    '<script type="module">import "/js/cart.js";</script>';
  const res = extractModulePreloadGraph(html);
  assert.equal(res.edges.length, 1);
  assert.equal(res.edges[0].imported, '/js/cart.js');
});

test('933 analyzePreloadScannerHints categorizes scanner hints', () => {
  const res = analyzePreloadScannerHints(SAMPLE_PAGE);
  assert.equal(res.preloads.length, 2);
  assert.equal(res.preloads[1].fetchpriority, 'high');
  assert.deepEqual(res.prefetches, ['/about']);
  assert.deepEqual(res.preconnects, ['https://cdn.example.com']);
  assert.deepEqual(res.dnsPrefetches, ['https://api.example.com']);
  assert.deepEqual(res.prerenders, []);
  const reasons = res.priorityAssets.map(p => p.href);
  assert.ok(reasons.includes('/fonts/app.woff2'));
  assert.ok(reasons.includes('/css/critical.css'));
});

test('933 analyzePreloadScannerHints returns empty structure for junk input', () => {
  const res = analyzePreloadScannerHints(undefined);
  assert.deepEqual(res, { preloads: [], prefetches: [], preconnects: [], dnsPrefetches: [], prerenders: [], priorityAssets: [] });
});

test('934 mapFetchPriorityHints maps critical vs low endpoints', () => {
  const res = mapFetchPriorityHints(SAMPLE_PAGE);
  // font preload (high) + hero img (high) + footer img (low) + iframe (auto)
  assert.equal(res.hints.length, 4);
  assert.deepEqual(res.criticalEndpoints, ['/fonts/app.woff2', '/img/hero.jpg']);
  assert.deepEqual(res.lowPriority, ['/img/footer.png']);
  const hero = res.hints.find(h => h.resource === '/img/hero.jpg');
  assert.equal(hero.tag, 'img');
  assert.equal(hero.priority, 'high');
});

test('934 mapFetchPriorityHints handles srcset fallback', () => {
  const res = mapFetchPriorityHints('<img srcset="/a.jpg 1x, /b.jpg 2x" fetchpriority="high">');
  assert.equal(res.hints[0].resource, '/a.jpg');
  assert.equal(res.hints[0].attribute, 'srcset');
});

test('935 mapLazyHydrationBoundaries detects Next.js and React markers', () => {
  const res = mapLazyHydrationBoundaries(SAMPLE_PAGE);
  assert.equal(res.framework, 'nextjs');
  const markers = res.boundaries.map(b => b.marker);
  assert.ok(markers.includes('__NEXT_DATA__'));
  assert.ok(markers.includes('id="__next"'));
  assert.ok(markers.includes('<!--$-->/<!--/$-->'));
  const data = res.boundaries.find(b => b.marker === '__NEXT_DATA__');
  assert.ok(data.context.includes('route=/shop'));
});

test('935 mapLazyHydrationBoundaries detects Astro client directives', () => {
  const res = mapLazyHydrationBoundaries('<div client:visible="true">x</div>');
  assert.equal(res.framework, 'astro');
  assert.equal(res.boundaries[0].marker, 'client:visible');
});

test('936 mapIslandArchitectureComponents maps Astro islands and endpoints', () => {
  const res = mapIslandArchitectureComponents(SAMPLE_PAGE);
  const astro = res.find(r => r.framework === 'astro');
  assert.ok(astro);
  assert.equal(astro.component, '/_astro/Cart.D123.js');
  assert.ok(astro.endpoints.includes('/api/cart'));
});

test('936 mapIslandArchitectureComponents detects Fresh and Qwik markers', () => {
  const fresh = mapIslandArchitectureComponents('<script>window.__FRSH_STATE={"a":"/api/island"}</script>');
  assert.equal(fresh[0].framework, 'fresh');
  assert.ok(fresh[0].endpoints.includes('/api/island'));
  const qwik = mapIslandArchitectureComponents('<div q:container q:id="1">x</div>');
  assert.equal(qwik[0].framework, 'qwik');
  const wc = mapIslandArchitectureComponents('<user-card data-endpoint="/api/user/1"></user-card>');
  assert.equal(wc[0].framework, 'web-component');
  assert.deepEqual(wc[0].endpoints, ['/api/user/1']);
});

test('937 mapPartialHydrationTriggers maps directives and JS triggers', () => {
  const js = 'new IntersectionObserver(cb); requestIdleCallback(loadMore); if (matchMedia("(max-width: 600px)").matches) {} import("/js/lazy.js");';
  const res = mapPartialHydrationTriggers(js + '<div client:idle="1">x</div>');
  const kinds = Object.fromEntries(res.map(r => [r.trigger, r.kind]));
  assert.equal(kinds['client:idle'], 'idle');
  assert.equal(kinds['IntersectionObserver'], 'visibility');
  assert.equal(kinds['requestIdleCallback'], 'idle');
  assert.equal(kinds['matchMedia'], 'media');
  assert.equal(kinds['dynamic-import'], 'event');
  assert.ok(res.find(r => r.trigger === 'dynamic-import' && r.target === '/js/lazy.js'));
});

test('938 mineServerComponentPayloads mines Flight chunks for endpoints', () => {
  const res = mineServerComponentPayloads(SAMPLE_PAGE);
  assert.ok(res.length >= 2);
  assert.ok(res.every(r => r.format === 'next-flight'));
  const withApi = res.find(r => r.endpoints.includes('/api/products?cat=shoes'));
  assert.ok(withApi, 'should mine /api/products from Flight payload');
  assert.ok(res[0].payloadPreview.length > 0);
  assert.deepEqual(mineServerComponentPayloads('no payloads here'), []);
});

test('939 analyzeRscFlightProtocol parses rows and routes', () => {
  const res = analyzeRscFlightProtocol(SAMPLE_PAGE);
  assert.equal(res.chunks, 2);
  assert.ok(res.rows.length >= 2);
  const modRef = res.rows.find(r => r.kind === 'module-ref');
  assert.ok(modRef);
  assert.ok(res.moduleRefs.some(m => m.includes('app/page')));
  assert.ok(res.routes.includes('/dashboard'));
  assert.ok(res.routes.includes('/api/products'));
});

test('940 mapTurbopackChunks maps dev-mode chunk references', () => {
  const html = '<script src="/_next/static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts.js"></script>' +
    '<script>__turbopack_context__("[project]/app/dashboard/page [app-client] (ecmascript)");</script>' +
    '<script>var x = "[project]/app/settings/page [app-client] (ecmascript)";</script>';
  const res = mapTurbopackChunks(html);
  assert.ok(res.length >= 3);
  const types = res.map(r => r.type);
  assert.ok(types.includes('turbopack-script'));
  assert.ok(types.includes('turbopack-context'));
  assert.ok(types.includes('dev-chunk'));
  const ctx = res.find(r => r.type === 'turbopack-context');
  assert.equal(ctx.routeHint, '/app/dashboard/page');
});

test('940 mapTurbopackChunks dedupes and tolerates empty input', () => {
  const html = '<script src="/_next/static/chunks/a_[turbopack].js"></script><script src="/_next/static/chunks/a_[turbopack].js"></script>';
  assert.equal(mapTurbopackChunks(html).length, 1);
  assert.deepEqual(mapTurbopackChunks(''), []);
  assert.deepEqual(mapTurbopackChunks(null), []);
});

test('all exports are functions', async () => {
  const mod = await import('./ssrHydrationSurface.js');
  const fns = [
    'mapAsyncScriptDependencies', 'extractModulePreloadGraph', 'analyzePreloadScannerHints',
    'mapFetchPriorityHints', 'mapLazyHydrationBoundaries', 'mapIslandArchitectureComponents',
    'mapPartialHydrationTriggers', 'mineServerComponentPayloads', 'analyzeRscFlightProtocol',
    'mapTurbopackChunks',
  ];
  for (const name of fns) assert.equal(typeof mod[name], 'function', name);
});
