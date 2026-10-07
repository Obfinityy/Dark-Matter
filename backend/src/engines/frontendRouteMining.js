/**
 * frontendRouteMining.js — Framework route-manifest mining for attack-surface mapping.
 *
 * Modern frontends ship their entire route map inside build output: route
 * manifests, page-data indexes and chunk file names. For an authorized
 * bug-bounty hunt, parsing those artifacts is the fastest legitimate way to
 * enumerate every page route and API path on the target — far more complete
 * than brute-forcing paths.
 *
 * Ideas covered:
 *  - 671 SvelteKit route-manifest parsing
 *  - 672 Next.js page-manifest enumeration
 *  - 673 Nuxt.js route auto-generation mapping
 *  - 674 Remix route-module harvesting
 *  - 675 Astro route-collection extraction
 *  - 676 Gatsby page-data path mining
 *
 * All functions are pure: they operate on observed build artifacts (HTTP
 * response bodies, fetched manifest JSON) of the authorized target and
 * return normalized route records: { path, source, detail }.
 */

/** Route kinds recognized across frameworks. */
export const ROUTE_SOURCES = {
  SVELTEKIT: 'sveltekit-manifest',
  NEXT_PAGES: 'next-pages-manifest',
  NEXT_APP: 'next-app-routes-manifest',
  NEXT_MIDDLEWARE: 'next-middleware-manifest',
  NUXT: 'nuxt-chunk-names',
  REMIX: 'remix-routes-manifest',
  ASTRO: 'astro-route-collection',
  GATSBY: 'gatsby-page-data',
};

/**
 * Normalize a raw route string into a path record.
 * @param {string} path raw path
 * @param {string} source ROUTE_SOURCES value
 * @param {object} [detail] extra metadata
 * @returns {{path:string, source:string, detail:object}|null}
 */
export function makeRoute(path, source, detail = {}) {
  if (typeof path !== 'string' || !path.trim()) return null;
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  return { path: p, source, detail };
}

/**
 * Merge several route lists, deduplicating by path (first source wins).
 * @param {...Array} lists route arrays
 * @returns {Array} deduped routes
 */
export function mergeRouteLists(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const r of list || []) {
      if (r && r.path && !seen.has(r.path)) seen.set(r.path, r);
    }
  }
  return [...seen.values()];
}

/**
 * Convert a SvelteKit route `pattern:` regex literal into a readable sample
 * path, e.g. /^\/blog\/([^/]+?)\/?$/ -> "/blog/:param".
 * @param {string} patternText regex literal text including slashes
 * @returns {string} sample path
 */
export function sveltePatternToSample(patternText) {
  let s = String(patternText || '').trim();
  // Strip regex literal delimiters and flags: /.../gi -> ...
  if (s.startsWith('/')) {
    const last = s.lastIndexOf('/');
    if (last > 0) s = s.slice(1, last);
  }
  s = s.replace(/^\^/, '').replace(/\$$/, '');
  s = s.replace(/\\\//g, '/');
  // Optional trailing slash
  s = s.replace(/\/\?$/, '/');
  // Named/rest params written as capture groups -> placeholders
  s = s.replace(/\(\?:\[\^\/\]\+\?\)/g, ':param');
  s = s.replace(/\(\[\^\/\]\+\?\)/g, ':param');
  s = s.replace(/\(\?:\.\+\)/g, '*rest');
  s = s.replace(/\(\.\+\)/g, '*rest');
  s = s.replace(/\([^)]*\)/g, ':param');
  if (!s.startsWith('/')) s = '/' + s;
  return s || '/';
}

/**
 * Idea 671 — Parse a SvelteKit route manifest (client `_app/immutable/manifest.js`
 * or server manifest text) to list every page route.
 *
 * Recognizes:
 *  - route entry objects: { id: "/about", pattern: /^\/about\/?$/, page: {...}, endpoint: ... }
 *  - dictionary maps: { "/about": [...], "/blog/[slug]": [...] }
 *
 * @param {string} manifestText manifest JS/JSON text observed on the target
 * @returns {Array} route records
 */
export function parseSvelteKitManifest(manifestText) {
  const text = String(manifestText || '');
  const out = [];
  const push = (path, detail) => {
    const r = makeRoute(path, ROUTE_SOURCES.SVELTEKIT, detail);
    if (r) out.push(r);
  };

  // { id: "/about", pattern: /^/about/?$/, page: {...} } entries.
  // The pattern literal is scanned (not regex-matched) so character classes
  // like [^/] can never break the match.
  const idRe = /\{\s*id\s*:\s*(["'])((?:\\.|(?!\1)[^\\])+)\1\s*,\s*pattern\s*:\s*\//g;
  let m;
  while ((m = idRe.exec(text)) !== null) {
    const id = m[2].replace(/\\\//g, '/');
    const scan = scanRegexLiteral(text, m.index + m[0].length - 1);
    if (!scan) continue;
    push(id, { kind: 'entry', sample: sveltePatternToSample(scan.literal) });
    idRe.lastIndex = scan.end;
  }

  // dictionary: { "/about": [..], ... }
  const dictRe = /["'](\/(?:[^"'\\]|\\.)*)["']\s*:\s*\[/g;
  while ((m = dictRe.exec(text)) !== null) {
    push(m[1].replace(/\\\//g, '/'), { kind: 'dictionary' });
  }

  // Bare route-ish string literals in manifest-like JSON: "route": "/x"
  const routeKeyRe = /["']route["']\s*:\s*["']([^"']+)["']/g;
  while ((m = routeKeyRe.exec(text)) !== null) {
    push(m[1], { kind: 'route-key' });
  }

  return mergeRouteLists(out);
}

/**
 * Idea 672 — Enumerate Next.js pages manifests to list routes and API paths.
 *
 * Handles:
 *  - pages-manifest.json: { "/": "static/chunks/...", "/api/hello": "...", "/_app": ... }
 *  - app-path-routes-manifest.json: { "/about/page": "/about", ... }
 *  - middleware-manifest.json: { middleware: { "/": { matchers: [{ regexp }] } } }
 *
 * @param {string|object} manifest JSON text or parsed object
 * @param {'pages'|'app'|'middleware'} [kind] manifest kind (auto-detected)
 * @returns {Array} route records
 */
export function parseNextPagesManifest(manifest, kind = 'pages') {
  const data = typeof manifest === 'string' ? safeJson(manifest) : manifest;
  if (!data || typeof data !== 'object') return [];
  const out = [];

  if (kind === 'app') {
    // { "/about/page": "/about" }
    for (const route of Object.values(data)) {
      if (typeof route !== 'string' || !route.startsWith('/')) continue;
      const r = makeRoute(route, ROUTE_SOURCES.NEXT_APP, { isApi: false });
      if (r) out.push(r);
    }
    return mergeRouteLists(out);
  }

  if (kind === 'middleware') {
    // { middleware: { "/": { matchers: [{ regexp: "^\\/" }] } } }
    const mw = data.middleware || {};
    for (const [page, entry] of Object.entries(mw)) {
      const matchers = (entry && entry.matchers) || [];
      const r = makeRoute(page, ROUTE_SOURCES.NEXT_MIDDLEWARE, {
        isMiddleware: true,
        matchers: matchers.map((x) => x.regexp).filter(Boolean),
      });
      if (r) out.push(r);
    }
    return mergeRouteLists(out);
  }

  // pages-manifest.json
  for (const [page, chunkFile] of Object.entries(data)) {
    if (typeof page !== 'string' || !page.startsWith('/')) continue;
    if (['/_app', '/_document', '/_error'].includes(page)) continue;
    const r = makeRoute(page, ROUTE_SOURCES.NEXT_PAGES, {
      isApi: page === '/api' || page.startsWith('/api/'),
      chunkFile: typeof chunkFile === 'string' ? chunkFile : undefined,
    });
    if (r) out.push(r);
  }
  return mergeRouteLists(out);
}

/**
 * Idea 673 — Map Nuxt file-based routing from bundle chunk/asset names.
 *
 * Nuxt (Vite/webpack) emits chunks named after the page file:
 *   _nuxt/pages/about.CxYz123.js  |  pages/users/[id].vue.js  |  pages/index.vue
 * Convention: pages/X.vue -> /X ; pages/index.vue -> / ; [id] -> :id ;
 * [...slug] -> *slug ; (groups) like (auth)/login.vue are flattened.
 *
 * @param {string[]} assetPaths emitted asset/chunk paths observed on the target
 * @returns {Array} route records
 */
export function mapNuxtRoutes(assetPaths) {
  const out = [];
  for (const raw of assetPaths || []) {
    const p = String(raw || '');
    const m = p.match(/(?:^|\/)pages\/(.+?)(?:\.vue)?(?:\.[A-Za-z0-9_-]{4,})?(?:\.js)?$/);
    if (!m) continue;
    let route = m[1]
      .replace(/\.[A-Za-z0-9_-]{6,}$/, '') // strip hash suffix
      .replace(/\.vue$/, '');
    if (route === 'index') route = '';
    // Route groups (auth) are invisible in URLs
    route = route.replace(/\([^)]*\)\//g, '');
    // Dynamic segments
    route = route
      .replace(/\[\.\.\.([^\]]+)\]/g, '*$1')
      .replace(/\[([^\]]+)\]/g, ':$1');
    const r = makeRoute(route === '' ? '/' : route, ROUTE_SOURCES.NUXT, { chunk: p });
    if (r && !out.some((x) => x.path === r.path)) out.push(r);
  }
  return out;
}

/**
 * Idea 674 — Harvest Remix route modules and their loader/action paths.
 *
 * Remix client manifest / build/routes.json:
 *   { routes: { "root": {...}, "routes/about": { id, path: "about",
 *     parentId: "root", hasLoader: true, hasAction: false, module: "..." } } }
 * Full paths are rebuilt by walking the parentId chain.
 *
 * @param {string|object} manifest JSON text or parsed object
 * @returns {Array} route records
 */
export function harvestRemixRoutes(manifest) {
  const data = typeof manifest === 'string' ? safeJson(manifest) : manifest;
  const routes = (data && data.routes) || {};
  if (!routes || typeof routes !== 'object') return [];
  const out = [];

  const fullPath = (id, seen = new Set()) => {
    if (seen.has(id)) return '';
    seen.add(id);
    const r = routes[id];
    if (!r) return '';
    const own = typeof r.path === 'string' ? r.path : '';
    if (!r.parentId || r.parentId === 'root') return '/' + own.replace(/^\/+/, '');
    const parent = fullPath(r.parentId, seen).replace(/\/+$/, '');
    if (r.index) return parent + '/';
    return (parent + '/' + own).replace(/\/+/g, '/');
  };

  for (const [id, r] of Object.entries(routes)) {
    if (id === 'root' || !r || typeof r !== 'object') continue;
    const path = fullPath(id) || '/';
    const rec = makeRoute(path, ROUTE_SOURCES.REMIX, {
      id,
      hasLoader: r.hasLoader === true,
      hasAction: r.hasAction === true,
      module: typeof r.module === 'string' ? r.module : undefined,
    });
    if (rec) out.push(rec);
  }
  return mergeRouteLists(out);
}

/**
 * Idea 675 — Extract Astro's collected routes from build output.
 *
 * Astro ships route data inside build output in several shapes:
 *  - JSON pairs: {"route": "/blog/[...slug]", ...}
 *  - SSR route manifests: { route: "/about", component: "...", ... }
 *  - _astro/ chunk scripts referencing collected paths
 *
 * @param {string} buildText build output / bundle JS text observed on the target
 * @returns {Array} route records
 */
export function extractAstroRoutes(buildText) {
  const text = String(buildText || '');
  const out = [];
  const push = (path, detail) => {
    const r = makeRoute(path, ROUTE_SOURCES.ASTRO, detail);
    if (r && !out.some((x) => x.path === r.path)) out.push(r);
  };

  // JSON: "route": "/about"
  let m;
  const jsonRouteRe = /["']route["']\s*:\s*["']([^"']+)["']/g;
  while ((m = jsonRouteRe.exec(text)) !== null) push(m[1], { kind: 'route-key' });

  // JS object literal: route: "/about"
  const jsRouteRe = /[{,]\s*route\s*:\s*["']([^"']+)["']/g;
  while ((m = jsRouteRe.exec(text)) !== null) push(m[1], { kind: 'route-literal' });

  // Astro content-collection / page map entries: { pathname: "/blog/post" }
  const pathnameRe = /["']?pathname["']?\s*:\s*["']([^"']+)["']/g;
  while ((m = pathnameRe.exec(text)) !== null) push(m[1], { kind: 'pathname' });

  // _astro/ asset references that embed a source route: _astro/About.AbC123.js
  // -> candidate source route /About (kept as a lead, flagged as inferred)
  const astroAssetRe = /_astro\/([A-Za-z0-9_$-]+?)(?:\.[A-Za-z0-9_-]{6,})?\.js/g;
  while ((m = astroAssetRe.exec(text)) !== null) {
    const name = m[1];
    if (/^(hoisted|client|chunk)/i.test(name)) continue;
    push('/' + name.toLowerCase(), { kind: 'inferred-asset', asset: m[0] });
  }

  return mergeRouteLists(out);
}

/**
 * Idea 676 — Mine Gatsby page-data JSON paths to enumerate all pages.
 *
 * Signals:
 *  - a page-data index JSON with a `pages` array (strings or { path })
 *  - app-data.json / page-data.json carrying a `path` field
 *  - HTML/JS references: /page-data/about/page-data.json -> /about
 *
 * @param {string|object} input page-data JSON text/object or HTML/JS text
 * @returns {Array} route records
 */
export function mineGatsbyPageData(input) {
  const out = [];
  const push = (path, detail) => {
    const r = makeRoute(path, ROUTE_SOURCES.GATSBY, detail);
    if (r && !out.some((x) => x.path === r.path)) out.push(r);
  };

  const data = typeof input === 'string' ? safeJson(input) : input;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.pages)) {
      for (const p of data.pages) {
        if (typeof p === 'string') push(p, { kind: 'index' });
        else if (p && typeof p.path === 'string') push(p.path, { kind: 'index' });
      }
    }
    if (typeof data.path === 'string') push(data.path, { kind: 'app-data' });
    const result = data.result;
    if (result && typeof result.pageContext === 'object' && result.pageContext) {
      const pc = result.pageContext;
      if (typeof pc.__pathname === 'string') push(pc.__pathname, { kind: 'page-context' });
    }
  }

  // Scan raw text for /page-data/<path>/page-data.json references
  const text = typeof input === 'string' ? input : JSON.stringify(data || {});
  const refRe = /["'`](?:\/)?page-data\/((?:[^"'`\s]+\/)?)page-data\.json["'`]/g;
  let m;
  while ((m = refRe.exec(text)) !== null) {
    const inner = (m[1] || '').replace(/\/+$/, '');
    push(inner === '' ? '/' : '/' + inner, { kind: 'page-data-ref' });
  }

  return mergeRouteLists(out);
}

/**
 * Safe JSON parse returning null on failure.
 * @param {string} text
 * @returns {any}
 */
/**
 * Scan a JS regex literal starting at the opening '/' at index `start`.
 * Respects backslash escapes and [...] character classes.
 * @param {string} text
 * @param {number} start index of the opening '/'
 * @returns {{literal:string, end:number}|null} literal incl. flags; end = index after flags
 */
function scanRegexLiteral(text, start) {
  if (text[start] !== '/') return null;
  let i = start + 1;
  let inClass = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      let j = i + 1;
      while (j < text.length && /[gimsuy]/.test(text[j])) j++;
      return { literal: text.slice(start, j), end: j };
    } else if (c === '\n') return null;
    i++;
  }
  return null;
}
function safeJson(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

export const FRONTEND_ROUTE_MINING = {
  parseSvelteKitManifest,
  parseNextPagesManifest,
  mapNuxtRoutes,
  harvestRemixRoutes,
  extractAstroRoutes,
  mineGatsbyPageData,
  sveltePatternToSample,
  mergeRouteLists,
  makeRoute,
  ROUTE_SOURCES,
};

export default FRONTEND_ROUTE_MINING;
