/**
 * jsFrameworkRouteMining.js — Client-side route extraction for authorized attack-surface mapping.
 *
 * Modern single-page apps hide most of their attack surface in JavaScript
 * bundles: admin panels, debug screens and forgotten endpoints never appear in
 * HTML but are declared in the router configuration. These extractors parse
 * bundle text the hunter already fetched from the authorized target and
 * enumerate the client-side routes for React Router, Vue Router and Angular.
 *
 *  - React Router route extraction  (idea 668)
 *  - Vue Router path harvesting     (idea 669)
 *  - Angular route-config mining    (idea 670)
 *
 * Pure text analysis only — no bundle is executed, no traffic is sent, and no
 * exploit payloads are involved.
 */

/**
 * Normalize a route path: leading slash, no duplicate/trailing slashes.
 * Keeps framework param syntax (":id", "*", "(.*)").
 * @param {string} p
 * @returns {string}
 */
export function normalizeRoutePath(p) {
  let out = String(p || '').trim();
  if (!out) return '/';
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\/{2,}/g, '/');
  if (out.length > 1) out = out.replace(/\/+$/, '');
  return out;
}

/**
 * Extract dynamic parameter names from a route path.
 * @param {string} path
 * @returns {string[]} e.g. [":id"] -> ["id"]
 */
export function extractRouteParams(path) {
  const params = [];
  const re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(String(path))) !== null) params.push(m[1]);
  if (/\*/.test(String(path))) params.push('*');
  return [...new Set(params)];
}

/**
 * Score how "interesting" a route is for a bug bounty hunter.
 * Admin/debug/internal/api surfaces score higher.
 * @param {string} path
 * @returns {number}
 */
export function scoreRouteInterestingness(path) {
  const p = String(path).toLowerCase();
  let score = 10;
  if (/admin|manage|dashboard|panel|console/.test(p)) score += 60;
  if (/debug|test|staging|dev|mock|playground/.test(p)) score += 50;
  if (/api|graphql|rest|webhook/.test(p)) score += 40;
  if (/backup|old|legacy|v1|internal/.test(p)) score += 30;
  if (/login|auth|oauth|sso|signup|register/.test(p)) score += 25;
  if (/upload|import|export|download/.test(p)) score += 25;
  if (/user|account|profile|billing|payment|order/.test(p)) score += 20;
  if (/:|\(.*\)|\*/.test(p)) score += 10; // dynamic segments are tamperable
  return score;
}

/**
 * Deduplicate routes by normalized path, keeping the highest-scored source.
 * @param {Array<object>} routes
 * @returns {Array<object>}
 */
export function dedupeRoutes(routes) {
  const byPath = new Map();
  for (const r of routes || []) {
    const key = normalizeRoutePath(r.path);
    const existing = byPath.get(key);
    if (!existing || (r.interestingness || 0) > (existing.interestingness || 0)) {
      byPath.set(key, { ...r, path: key });
    }
  }
  return [...byPath.values()];
}

/**
 * Find lazy-loaded chunk specifiers near a match position (webpack/vite code-split imports).
 * @param {string} text
 * @param {number} pos
 * @returns {string|null}
 */
function nearbyLazyChunk(text, pos) {
  const window = text.slice(Math.max(0, pos - 400), pos + 400);
  const m = /import\(\s*["']([^"']+)["']\s*\)/.exec(window);
  return m ? m[1] : null;
}

/**
 * Idea 668 — Parse React Router route definitions from bundle text.
 *
 * Handles data-router object routes (createBrowserRouter / createHashRouter /
 * createMemoryRouter), JSX <Route> declarations, and useRoutes() arrays.
 *
 * @param {string} bundleText
 * @returns {{framework: string, routerType: string|null, routes: Array<{path:string, params:string[], dynamic:boolean, source:string, lazyChunk:string|null, interestingness:number}>, lazyChunks: string[]}}
 */
export function extractReactRouterRoutes(bundleText = '') {
  const text = String(bundleText);
  const routes = [];
  const lazyChunks = new Set();

  let routerType = null;
  if (/createBrowserRouter\s*\(/.test(text)) routerType = 'browser';
  else if (/createHashRouter\s*\(/.test(text)) routerType = 'hash';
  else if (/createMemoryRouter\s*\(/.test(text)) routerType = 'memory';

  // Object routes: { path: "/dashboard", ... }
  const objRe = /\{\s*path\s*:\s*["']([^"']*)["']/g;
  let m;
  while ((m = objRe.exec(text)) !== null) {
    const path = normalizeRoutePath(m[1]);
    const lazyChunk = nearbyLazyChunk(text, m.index);
    if (lazyChunk) lazyChunks.add(lazyChunk);
    routes.push({
      path,
      params: extractRouteParams(path),
      dynamic: /:|\*/.test(path),
      source: 'object-route',
      lazyChunk,
      interestingness: scoreRouteInterestingness(path),
    });
  }

  // JSX routes: <Route path="/legacy" element={...} />
  const jsxRe = /<Route\s+[^>]*?\bpath\s*=\s*["']([^"']+)["']/g;
  while ((m = jsxRe.exec(text)) !== null) {
    const path = normalizeRoutePath(m[1]);
    const lazyChunk = nearbyLazyChunk(text, m.index);
    if (lazyChunk) lazyChunks.add(lazyChunk);
    routes.push({
      path,
      params: extractRouteParams(path),
      dynamic: /:|\*/.test(path),
      source: 'jsx-route',
      lazyChunk,
      interestingness: scoreRouteInterestingness(path),
    });
  }

  return {
    framework: 'react-router',
    routerType,
    routes: dedupeRoutes(routes),
    lazyChunks: [...lazyChunks],
  };
}

/**
 * Idea 669 — Harvest Vue Router path maps from compiled bundles.
 *
 * Handles createRouter({ routes: [...] }) declarations, router.addRoute()
 * calls, named routes and redirect entries.
 *
 * @param {string} bundleText
 * @returns {{framework: string, routes: Array<{path:string, name:string|null, params:string[], dynamic:boolean, source:string, interestingness:number}>, redirects: Array<{from:string, to:string}>}}
 */
export function extractVueRouterPaths(bundleText = '') {
  const text = String(bundleText);
  const routes = [];
  const redirects = [];

  // Route records: { path: "/admin", name: "Admin", ... }
  const recRe = /\{\s*path\s*:\s*["']([^"']*)["']([^}]*?)\}/g;
  let m;
  while ((m = recRe.exec(text)) !== null) {
    const path = normalizeRoutePath(m[1]);
    const nameMatch = /\bname\s*:\s*["']([^"']+)["']/.exec(m[2]);
    const redirectMatch = /\bredirect\s*:\s*["']([^"']+)["']/.exec(m[2]);
    routes.push({
      path,
      name: nameMatch ? nameMatch[1] : null,
      params: extractRouteParams(path),
      dynamic: /:|\*/.test(path),
      source: 'route-record',
      interestingness: scoreRouteInterestingness(path),
    });
    if (redirectMatch) redirects.push({ from: path, to: normalizeRoutePath(redirectMatch[1]) });
  }

  // Dynamic additions: router.addRoute({ path: "/x", ... })
  const addRe = /\.addRoute\(\s*\{\s*path\s*:\s*["']([^"']*)["']/g;
  while ((m = addRe.exec(text)) !== null) {
    const path = normalizeRoutePath(m[1]);
    routes.push({
      path,
      name: null,
      params: extractRouteParams(path),
      dynamic: /:|\*/.test(path),
      source: 'add-route',
      interestingness: scoreRouteInterestingness(path),
    });
  }

  return {
    framework: 'vue-router',
    routes: dedupeRoutes(routes),
    redirects,
  };
}

/**
 * Idea 670 — Mine Angular route configurations for paths and lazy-loaded modules.
 *
 * Handles Routes arrays: path (including "" and "**"), loadChildren /
 * loadComponent code-split imports, redirectTo entries and children blocks.
 * Angular child paths are relative by design, so the declared path is kept
 * verbatim alongside a normalized absolute guess.
 *
 * @param {string} bundleText
 * @returns {{framework: string, routes: Array<{path:string, fullPath:string, relative:boolean, params:string[], wildcard:boolean, redirectTo:string|null, hasChildren:boolean, lazyModule:string|null, interestingness:number}>, lazyModules: string[], redirects: Array<{from:string, to:string}>}}
 */
export function extractAngularRoutes(bundleText = '') {
  const text = String(bundleText);
  const routes = [];
  const lazyModules = new Set();
  const redirects = [];

  // Route entries: { path: "settings", ... } — path may be "" or "**".
  const entryRe = /\{\s*path\s*:\s*["']([^"']*)["']([\s\S]*?)(?=\{\s*path\s*:|$)/g;
  let m;
  while ((m = entryRe.exec(text)) !== null) {
    const declared = m[1];
    const body = m[2].slice(0, 600); // bound the lookahead so neighbors don't bleed in
    const relative = !declared.startsWith('/');
    const fullPath = normalizeRoutePath(declared);
    const wildcard = declared === '**';

    const lc = /loadChildren\s*:\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/.exec(body);
    const lcomp = /loadComponent\s*:\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/.exec(body);
    const lazyModule = lc ? lc[1] : lcomp ? lcomp[1] : null;
    if (lazyModule) lazyModules.add(lazyModule);

    const redir = /\bredirectTo\s*:\s*["']([^"']+)["']/.exec(body);
    const redirectTo = redir ? redir[1] : null;
    const hasChildren = /\bchildren\s*:\s*\[/.test(body);

    routes.push({
      path: declared,
      fullPath,
      relative,
      params: extractRouteParams(fullPath),
      wildcard,
      redirectTo,
      hasChildren,
      lazyModule,
      interestingness: scoreRouteInterestingness(fullPath),
    });
    if (redirectTo) redirects.push({ from: fullPath, to: normalizeRoutePath(redirectTo) });

    // Avoid runaway on huge bundles: the tempered lookahead already bounds each entry.
    if (routes.length > 5000) break;
  }

  return {
    framework: 'angular-router',
    routes: dedupeRoutes(routes.map(r => ({ ...r, path: r.fullPath }))),
    lazyModules: [...lazyModules],
    redirects,
  };
}

/**
 * Auto-detect the SPA framework in a bundle and run the matching extractor(s).
 *
 * @param {string} bundleText
 * @returns {{detected: string[], results: object, allRoutes: Array<object>}}
 */
export function mineRoutes(bundleText = '') {
  const text = String(bundleText);
  const detected = [];
  const results = {};

  if (/createBrowserRouter|createHashRouter|createMemoryRouter|react-router/i.test(text)) {
    detected.push('react-router');
    results['react-router'] = extractReactRouterRoutes(text);
  }
  if (/createRouter\s*\(\s*\{|vue-router/i.test(text)) {
    detected.push('vue-router');
    results['vue-router'] = extractVueRouterPaths(text);
  }
  if (/loadChildren|@angular\/router|ng-version/i.test(text)) {
    detected.push('angular-router');
    results['angular-router'] = extractAngularRoutes(text);
  }

  const allRoutes = dedupeRoutes(Object.values(results).flatMap(r => r.routes || [])).sort(
    (a, b) => (b.interestingness || 0) - (a.interestingness || 0)
  );

  return { detected, results, allRoutes };
}

export const JS_FRAMEWORK_ROUTE_MINING = {
  normalizeRoutePath,
  extractRouteParams,
  scoreRouteInterestingness,
  dedupeRoutes,
  extractReactRouterRoutes,
  extractVueRouterPaths,
  extractAngularRoutes,
  mineRoutes,
};

export default JS_FRAMEWORK_ROUTE_MINING;
