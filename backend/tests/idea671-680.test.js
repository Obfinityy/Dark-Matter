/**
 * idea671-680.test.js — Tests for the JS-bundle attack-surface-mapping wave.
 *
 * Ideas 671-680: framework route-manifest mining (frontendRouteMining.js),
 * bundle graph mining (bundleGraphMining.js) and source-map original-source
 * recovery (sourceMapRecovery.js). All fixtures are synthetic build artifacts
 * shaped like the real framework outputs described in each parser's JSDoc.
 *
 * Run: cd backend && node --test tests/idea671-680.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSvelteKitManifest,
  parseNextPagesManifest,
  mapNuxtRoutes,
  harvestRemixRoutes,
  extractAstroRoutes,
  mineGatsbyPageData,
  sveltePatternToSample,
  mergeRouteLists,
  makeRoute,
} from '../src/engines/frontendRouteMining.js';

import {
  enumerateWebpackChunks,
  parseViteManifest,
  reconstructRollupChunkGraph,
  scoreChunkFeature,
} from '../src/engines/bundleGraphMining.js';

import {
  findSourceMapRefs,
  decodeInlineSourceMap,
  parseSourceMap,
  recoverOriginalSources,
  summarizeSourceMap,
  decodeVlq,
  parseMappingsLine,
  originalPositionFor,
  extractRouteStrings,
} from '../src/engines/sourceMapRecovery.js';

// ---------------------------------------------------------------------------
// Idea 671 — SvelteKit route-manifest parsing
// ---------------------------------------------------------------------------
describe('idea 671 — parseSvelteKitManifest', () => {
  const manifest = `
export const routes = [
  { id: "/", pattern: /^\\/$/, page: { layouts: [0], errors: [1], leaf: 2 } },
  { id: "/about", pattern: /^\\/about\\/?$/, page: { layouts: [0], errors: [1], leaf: 3 } },
  { id: "/blog/[slug]", pattern: /^\\/blog\\/([^/]+?)\\/?$/, page: { layouts: [0], errors: [1], leaf: 4 } }
];
export const dictionary = { "/": [2], "/about": [3], "/blog/[slug]": [4] };
`;

  it('lists every page route from entry objects', () => {
    const routes = parseSvelteKitManifest(manifest);
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes('/'), 'root route present');
    assert.ok(paths.includes('/about'), '/about present');
    assert.ok(paths.includes('/blog/[slug]'), 'dynamic route present');
    assert.ok(routes.every((r) => r.source === 'sveltekit-manifest'));
  });

  it('attaches a readable sample for regex patterns', () => {
    const routes = parseSvelteKitManifest(manifest);
    const blog = routes.find((r) => r.path === '/blog/[slug]');
    assert.ok(blog.detail.sample.startsWith('/blog/:param'), `sample=${blog.detail.sample}`);
  });

  it('handles empty/garbage input without throwing', () => {
    assert.deepEqual(parseSvelteKitManifest(''), []);
    assert.deepEqual(parseSvelteKitManifest('no routes here'), []);
  });
});

describe('sveltePatternToSample', () => {
  it('converts patterns to sample paths', () => {
    assert.equal(sveltePatternToSample('/^\\/$/'), '/');
    assert.equal(sveltePatternToSample('/^\\/about\\/?$/'), '/about/');
    assert.equal(sveltePatternToSample('/^\\/blog\\/([^/]+?)\\/?$/'), '/blog/:param/');
  });
});

// ---------------------------------------------------------------------------
// Idea 672 — Next.js page-manifest enumeration
// ---------------------------------------------------------------------------
describe('idea 672 — parseNextPagesManifest', () => {
  const pagesManifest = JSON.stringify({
    '/': 'static/chunks/pages/index-abc.js',
    '/about': 'static/chunks/pages/about-def.js',
    '/api/hello': 'static/chunks/pages/api/hello-ghi.js',
    '/_app': 'static/chunks/pages/_app-jkl.js',
    '/_document': 'static/chunks/pages/_document-mno.js',
  });

  it('enumerates routes and flags API paths', () => {
    const routes = parseNextPagesManifest(pagesManifest);
    const paths = routes.map((r) => r.path);
    assert.deepEqual(paths.sort(), ['/', '/about', '/api/hello']);
    const api = routes.find((r) => r.path === '/api/hello');
    assert.equal(api.detail.isApi, true);
    assert.equal(api.detail.chunkFile, 'static/chunks/pages/api/hello-ghi.js');
    assert.equal(routes.find((r) => r.path === '/about').detail.isApi, false);
  });

  it('parses app-path-routes manifests', () => {
    const app = JSON.stringify({ '/dashboard/page': '/dashboard', '/blog/[slug]/page': '/blog/[slug]' });
    const routes = parseNextPagesManifest(app, 'app');
    assert.deepEqual(routes.map((r) => r.path).sort(), ['/blog/[slug]', '/dashboard']);
  });

  it('parses middleware manifests with matchers', () => {
    const mw = JSON.stringify({
      middleware: { '/': { matchers: [{ regexp: '^\\/(?!_next).*$' }] } },
    });
    const routes = parseNextPagesManifest(mw, 'middleware');
    assert.equal(routes.length, 1);
    assert.equal(routes[0].detail.isMiddleware, true);
    assert.deepEqual(routes[0].detail.matchers, ['^\\/(?!_next).*$']);
  });

  it('rejects invalid JSON', () => {
    assert.deepEqual(parseNextPagesManifest('not json'), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 673 — Nuxt route auto-generation mapping
// ---------------------------------------------------------------------------
describe('idea 673 — mapNuxtRoutes', () => {
  it('maps chunk names to file-based routes', () => {
    const routes = mapNuxtRoutes([
      '_nuxt/pages/index.CxYz123.js',
      '_nuxt/pages/about.Abc456.js',
      'pages/users/[id].vue',
      'pages/blog/[...slug].vue',
      '_nuxt/entry.QwE789.js', // not a page chunk
    ]);
    const paths = routes.map((r) => r.path);
    assert.deepEqual(paths, ['/', '/about', '/users/:id', '/blog/*slug']);
    assert.ok(routes.every((r) => r.source === 'nuxt-chunk-names'));
  });

  it('dedupes and ignores non-page assets', () => {
    const routes = mapNuxtRoutes(['_nuxt/pages/about.AAA111.js', '_nuxt/pages/about.BBB222.js']);
    assert.equal(routes.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Idea 674 — Remix route-module harvesting
// ---------------------------------------------------------------------------
describe('idea 674 — harvestRemixRoutes', () => {
  const manifest = JSON.stringify({
    routes: {
      root: { id: 'root', parentId: null, path: '' },
      'routes/about': {
        id: 'routes/about', parentId: 'root', path: 'about',
        hasLoader: true, hasAction: false, module: 'build/routes/about-ABC.js',
      },
      'routes/blog': { id: 'routes/blog', parentId: 'root', path: 'blog', hasLoader: false },
      'routes/blog.$slug': {
        id: 'routes/blog.$slug', parentId: 'routes/blog', path: '$slug',
        hasLoader: true, hasAction: true,
      },
    },
  });

  it('rebuilds full paths through the parent chain', () => {
    const routes = harvestRemixRoutes(manifest);
    const byId = Object.fromEntries(routes.map((r) => [r.detail.id, r]));
    assert.equal(byId['routes/about'].path, '/about');
    assert.equal(byId['routes/blog.$slug'].path, '/blog/$slug');
  });

  it('exposes loader/action flags and module refs', () => {
    const routes = harvestRemixRoutes(manifest);
    const about = routes.find((r) => r.detail.id === 'routes/about');
    assert.equal(about.detail.hasLoader, true);
    assert.equal(about.detail.hasAction, false);
    assert.equal(about.detail.module, 'build/routes/about-ABC.js');
    const slug = routes.find((r) => r.detail.id === 'routes/blog.$slug');
    assert.equal(slug.detail.hasAction, true);
  });
});

// ---------------------------------------------------------------------------
// Idea 675 — Astro route-collection extraction
// ---------------------------------------------------------------------------
describe('idea 675 — extractAstroRoutes', () => {
  const build = `
const manifest = { routes: [{ route: "/about", component: "src/pages/about.astro" }] };
var pages = [{route: '/contact', file: 'contact.astro'}, {pathname: "/blog/hello-world"}];
import("/_astro/hoisted.abc123.js");
`;

  it('extracts route keys, literals and pathnames', () => {
    const routes = extractAstroRoutes(build);
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes('/about'));
    assert.ok(paths.includes('/contact'));
    assert.ok(paths.includes('/blog/hello-world'));
  });
});

// ---------------------------------------------------------------------------
// Idea 676 — Gatsby page-data path mining
// ---------------------------------------------------------------------------
describe('idea 676 — mineGatsbyPageData', () => {
  it('mines pages from an index JSON', () => {
    const routes = mineGatsbyPageData(JSON.stringify({
      pages: ['/', '/about', { path: '/blog/post-1' }],
    }));
    assert.deepEqual(routes.map((r) => r.path), ['/', '/about', '/blog/post-1']);
  });

  it('mines page-data.json URL references from HTML/JS text', () => {
    const html = `<script>fetch("/page-data/about/page-data.json")</script>
<link href="/page-data/blog/my-post/page-data.json">`;
    const routes = mineGatsbyPageData(html);
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes('/about'));
    assert.ok(paths.includes('/blog/my-post'));
  });

  it('reads the path field of app-data.json', () => {
    const routes = mineGatsbyPageData(JSON.stringify({ path: '/pricing', webpackCompilationHash: 'x' }));
    assert.ok(routes.some((r) => r.path === '/pricing'));
  });
});

describe('mergeRouteLists / makeRoute', () => {
  it('dedupes by path, first source wins', () => {
    const merged = mergeRouteLists(
      [makeRoute('/a', 's1'), makeRoute('/b', 's1')],
      [makeRoute('/b', 's2'), makeRoute('/c', 's2')]
    );
    assert.deepEqual(merged.map((r) => r.path), ['/a', '/b', '/c']);
    assert.equal(merged[1].source, 's1');
  });
  it('makeRoute rejects blanks', () => {
    assert.equal(makeRoute('', 's'), null);
    assert.equal(makeRoute('   ', 's'), null);
  });
});

// ---------------------------------------------------------------------------
// Idea 677 — Webpack chunk-URL enumeration
// ---------------------------------------------------------------------------
describe('idea 677 — enumerateWebpackChunks', () => {
  const runtime = `
__webpack_require__.p = "/_next/";
__webpack_require__.u = (chunkId) => "static/chunks/" + ({"src_pages_admin":"9f3c2a","src_pages_api_users":"b71d0e",187:"c44f"}[chunkId] || chunkId) + ".js";
var x = "static/chunks/fallback-d41d.js";
`;

  it('extracts public path, chunk map and absolute URLs', () => {
    const { publicPath, chunks } = enumerateWebpackChunks(runtime);
    assert.equal(publicPath, '/_next/');
    const admin = chunks.find((c) => c.id === 'src_pages_admin');
    assert.ok(admin, 'named chunk id found');
    assert.equal(admin.file, 'static/chunks/9f3c2a.js');
    assert.equal(admin.url, '/_next/static/chunks/9f3c2a.js');
  });

  it('also catches standalone chunk file references', () => {
    const { chunks } = enumerateWebpackChunks(runtime);
    assert.ok(chunks.some((c) => c.file === 'static/chunks/fallback-d41d.js'));
  });

  it('handles runtimes without a chunk map', () => {
    const { chunks, publicPath } = enumerateWebpackChunks('__webpack_require__.p="/";');
    assert.deepEqual(chunks, []);
    assert.equal(publicPath, '/');
  });
});

// ---------------------------------------------------------------------------
// Idea 678 — Vite manifest asset mapping
// ---------------------------------------------------------------------------
describe('idea 678 — parseViteManifest', () => {
  const manifest = {
    'src/main.js': {
      file: 'assets/main-abc123.js', src: 'src/main.js', isEntry: true,
      imports: ['_vendor-def456.js'], css: ['assets/main-ghi789.css'],
    },
    '_vendor-def456.js': { file: 'assets/vendor-def456.js' },
    'src/pages/About.vue': {
      file: 'assets/About-xyz000.js', src: 'src/pages/About.vue', isDynamicEntry: true,
    },
    'src/pages/blog/[slug].vue': {
      file: 'assets/slug-111aaa.js', src: 'src/pages/blog/[slug].vue', isDynamicEntry: true,
    },
  };

  it('maps entries, dynamic entries and the import graph', () => {
    const out = parseViteManifest(manifest, 'https://target.example/');
    assert.equal(out.entries.length, 1);
    assert.equal(out.entries[0].file, 'assets/main-abc123.js');
    assert.equal(out.dynamicEntries.length, 2);
    assert.equal(out.assets.length, 4);
    assert.deepEqual(out.importGraph, [
      { from: 'assets/main-abc123.js', to: 'assets/vendor-def456.js' },
    ]);
    assert.ok(out.entries[0].url.startsWith('https://target.example/'));
  });

  it('infers source routes from src/pages', () => {
    const out = parseViteManifest(manifest);
    const paths = out.routes.map((r) => r.path);
    assert.ok(paths.includes('/About'));
    assert.ok(paths.includes('/blog/:slug'));
  });

  it('rejects invalid manifests', () => {
    const out = parseViteManifest('nope');
    assert.deepEqual(out.assets, []);
  });
});

// ---------------------------------------------------------------------------
// Idea 679 — Rollup chunk-graph reconstruction
// ---------------------------------------------------------------------------
describe('idea 679 — reconstructRollupChunkGraph', () => {
  const bundles = [
    {
      name: 'main-abc.js',
      code: `import("./chunk-admin-def.js").then(m=>m.init);
             import { x } from "./chunk-shared-ghi.js";
             <link rel="modulepreload" href="/_nuxt/chunk-vendor-jkl.js">`,
    },
    { name: 'chunk-admin-def.js', code: `import("./chunk-shared-ghi.js");` },
  ];

  it('rebuilds nodes and edges incl. dynamic imports', () => {
    const g = reconstructRollupChunkGraph(bundles);
    assert.ok(g.nodes.includes('chunk-admin-def.js'));
    assert.ok(g.nodes.includes('chunk-shared-ghi.js'));
    assert.ok(g.nodes.includes('chunk-vendor-jkl.js'));
    const dyn = g.edges.find((e) => e.from === 'main-abc.js' && e.to === 'chunk-admin-def.js');
    assert.equal(dyn.kind, 'dynamic');
    const stat = g.edges.find((e) => e.from === 'main-abc.js' && e.to === 'chunk-shared-ghi.js');
    assert.equal(stat.kind, 'static');
    const pre = g.edges.find((e) => e.to === 'chunk-vendor-jkl.js');
    assert.equal(pre.kind, 'preload');
    assert.equal(g.dynamicImports.length, 2);
    assert.ok(g.dynamicImports.some((d) => d.from === 'main-abc.js' && d.spec === './chunk-admin-def.js'));
    assert.ok(g.dynamicImports.some((d) => d.from === 'chunk-admin-def.js' && d.spec === './chunk-shared-ghi.js'));
  });

  it('accepts a single bundle string', () => {
    const g = reconstructRollupChunkGraph(`import("./lazy-1.js")`);
    assert.ok(g.nodes.includes('lazy-1.js'));
  });
});

describe('scoreChunkFeature', () => {
  it('scores admin/api chunks higher', () => {
    assert.ok(scoreChunkFeature('src_pages_admin') > scoreChunkFeature('main'));
    assert.ok(scoreChunkFeature('pages/api/users') >= 40);
    assert.ok(scoreChunkFeature('x') <= 100);
  });
});

// ---------------------------------------------------------------------------
// Idea 680 — Source-map original-source recovery
// ---------------------------------------------------------------------------
describe('idea 680 — findSourceMapRefs', () => {
  it('finds inline and external refs', () => {
    const refs = findSourceMapRefs(`
console.log(1);
//# sourceMappingURL=app.js.map
/*# sourceMappingURL=data:application/json;base64,eyJ9 */
`);
    assert.equal(refs.length, 2);
    assert.equal(refs[0].kind, 'external');
    assert.equal(refs[0].ref, 'app.js.map');
    assert.equal(refs[1].kind, 'inline');
  });
});

describe('idea 680 — decodeInlineSourceMap', () => {
  it('decodes base64 data URIs', () => {
    const json = '{"version":3}';
    const ref = 'data:application/json;base64,' + Buffer.from(json).toString('base64');
    assert.equal(decodeInlineSourceMap(ref), json);
  });
  it('decodes URI-encoded payloads and rejects non-data refs', () => {
    assert.equal(decodeInlineSourceMap('data:application/json,%7B%22a%22%3A1%7D'), '{"a":1}');
    assert.equal(decodeInlineSourceMap('app.js.map'), null);
  });
});

describe('idea 680 — parseSourceMap / recoverOriginalSources / summarizeSourceMap', () => {
  const mapJson = JSON.stringify({
    version: 3,
    file: 'app.min.js',
    sources: ['src/app.js', 'src/routes.js'],
    sourcesContent: ['const app = 1;', null],
    names: ['app'],
    mappings: 'AAAA;AACA',
  });

  it('validates v3 maps and rejects others', () => {
    const map = parseSourceMap(mapJson);
    assert.ok(map);
    assert.deepEqual(map.sources, ['src/app.js', 'src/routes.js']);
    assert.equal(map.hasSourcesContent, true);
    assert.equal(parseSourceMap('{"version":2,"sources":[],"mappings":""}'), null);
    assert.equal(parseSourceMap('garbage'), null);
  });

  it('recovers sources only where sourcesContent exists', () => {
    const recovered = recoverOriginalSources(parseSourceMap(mapJson));
    assert.equal(recovered[0].recovered, true);
    assert.equal(recovered[0].content, 'const app = 1;');
    assert.equal(recovered[1].recovered, false);
    assert.equal(recovered[1].content, null);
  });

  it('summarizes the map', () => {
    const s = summarizeSourceMap(parseSourceMap(mapJson));
    assert.deepEqual(s, { sources: 2, recoverable: 1, names: 1, file: 'app.min.js' });
  });
});

describe('idea 680 — VLQ decoding', () => {
  it('decodes single-char values', () => {
    assert.equal(decodeVlq('A', 0).value, 0);
    assert.equal(decodeVlq('C', 0).value, 1);
    assert.equal(decodeVlq('D', 0).value, -1);
    assert.equal(decodeVlq('E', 0).value, 2);
    assert.equal(decodeVlq('L', 0).value, -5);
  });
  it('decodes multi-char values', () => {
    assert.equal(decodeVlq('gB', 0).value, 16);
  });
  it('parses a mappings line into segments', () => {
    const segs = parseMappingsLine('AACA');
    assert.equal(segs.length, 1);
    assert.deepEqual(
      { genCol: segs[0].genCol, src: segs[0].src, srcLine: segs[0].srcLine, srcCol: segs[0].srcCol },
      { genCol: 0, src: 0, srcLine: 1, srcCol: 0 }
    );
  });
  it('handles named segments', () => {
    const segs = parseMappingsLine('AACAA');
    assert.equal(segs[0].name, 0);
  });
});

describe('idea 680 — originalPositionFor', () => {
  const map = parseSourceMap(JSON.stringify({
    version: 3,
    sources: ['src/app.js', 'src/routes.js'],
    names: [],
    // line1: genCol0 -> src0 line1 col0 ; line2: genCol0 -> src1 line1 col0
    mappings: 'AAAA;ACAA',
  }));

  it('maps generated positions back to original sources', () => {
    const p1 = originalPositionFor(map, 1, 0);
    assert.deepEqual(p1, { source: 'src/app.js', line: 1, column: 0, name: null });
    const p2 = originalPositionFor(map, 2, 10);
    assert.equal(p2.source, 'src/routes.js');
    assert.equal(p2.line, 1);
  });

  it('returns null for out-of-range positions', () => {
    assert.equal(originalPositionFor(map, 99, 0), null);
    assert.equal(originalPositionFor(map, 0, 0), null);
  });
});

describe('idea 680 — extractRouteStrings', () => {
  it('mines quoted route literals and route comments', () => {
    const routes = extractRouteStrings(`
// route: /admin/panel
const API = "/api/v2/users";
fetch('/health');
const img = "/logo.png";
`);
    assert.ok(routes.includes('/api/v2/users'));
    assert.ok(routes.includes('/health'));
    assert.ok(routes.includes('/admin/panel'));
    assert.ok(!routes.includes('/logo.png'), 'asset paths excluded');
  });
});
