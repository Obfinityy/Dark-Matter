/**
 * bundleGraphMining.js — JS bundle graph mining for attack-surface mapping.
 *
 * Code-split bundles carry their own map: webpack runtime chunk tables, Vite
 * build manifests and Rollup dynamic-import graphs all reveal features and
 * routes the crawler never linked to. For an authorized bug-bounty hunt this
 * engine turns observed bundle artifacts into enumerable chunk URLs and a
 * reconstructed module graph — legitimate attack-surface expansion, nothing
 * destructive.
 *
 * Ideas covered:
 *  - 677 Webpack chunk-URL enumeration (runtime manifest parsing)
 *  - 678 Vite manifest asset mapping
 *  - 679 Rollup chunk-graph reconstruction
 *
 * All functions are pure: they parse observed build artifacts of the
 * authorized target and return URL lists / graphs. No requests are made.
 */

/** URL-safe join of a public path and a chunk file name. */
function joinUrl(publicPath, file) {
  const base = String(publicPath || '/');
  const b = base.endsWith('/') ? base : base + '/';
  return b + String(file || '').replace(/^\/+/, '');
}

/**
 * Idea 677 — Enumerate webpack chunk URLs from the webpack runtime manifest.
 *
 * The webpack runtime exposes:
 *   __webpack_require__.p = "/_next/";                      // public path
 *   __webpack_require__.u = (chunkId) =>
 *     "static/chunks/" + ({ "src_pages_admin": "9f3c2a" }[chunkId] || chunkId) + ".js";
 * Chunk ids that look like feature/module names reveal code-split features.
 *
 * @param {string} runtimeJs webpack runtime JS text observed on the target
 * @returns {{ publicPath: string, chunks: Array<{id:string,file:string,url:string}>, rawMap: object }}
 */
export function enumerateWebpackChunks(runtimeJs) {
  const text = String(runtimeJs || '');
  const out = { publicPath: '/', chunks: [], rawMap: {} };

  // __webpack_require__.p = "/_next/";
  const pMatch = text.match(/__webpack_require__\.p\s*=\s*["']([^"']*)["']/);
  if (pMatch) out.publicPath = pMatch[1] || '/';

  // Chunk filename template: "static/chunks/" + (...) + ".js"  (or .css)
  const uMatch = text.match(
    /__webpack_require__\.u\s*=\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*["']([^"']*)["']\s*\+/
  );
  const prefix = uMatch ? uMatch[1] : '';
  const suffixMatch = text.match(
    /__webpack_require__\.u\s*=\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*["'][^"']*["']\s*\+[\s\S]{0,400}?\+\s*["']([^"']*)["']/
  );
  const suffix = suffixMatch ? suffixMatch[1] : '.js';

  // Chunk id -> hash/name map: ({ "src_pages_admin": "9f3c2a", 123: "ab12" }[chunkId])
  const mapMatch = text.match(/\(\s*\{([^{}]*)\}\s*\[\s*[a-zA-Z_$][\w$]*\s*\]/);
  if (mapMatch) {
    const body = mapMatch[1];
    const entryRe = /["']?([\w$./-]+)["']?\s*:\s*["']([^"']+)["']/g;
    let m;
    while ((m = entryRe.exec(body)) !== null) {
      const id = m[1];
      const hash = m[2];
      // Skip pure-numeric pass-through ids (no information)
      out.rawMap[id] = hash;
      const file = prefix + hash + suffix;
      out.chunks.push({ id, file, url: joinUrl(out.publicPath, file) });
    }
  }

  // Also catch standalone chunk file references: "static/chunks/pages-admin-9f3c.js"
  const fileRe = /["'`]([A-Za-z0-9_$@./-]*?chunks?\/[A-Za-z0-9_$.@/-]+\.(?:js|css))["'`]/g;
  let fm;
  const seen = new Set(out.chunks.map(c => c.url));
  while ((fm = fileRe.exec(text)) !== null) {
    const file = fm[1];
    const url = joinUrl(out.publicPath, file);
    if (!seen.has(url)) {
      seen.add(url);
      out.chunks.push({ id: file, file, url });
    }
  }

  return out;
}

/**
 * Idea 678 — Parse a Vite build manifest to map every emitted asset and its
 * source route.
 *
 * Vite emits .vite/manifest.json (or manifest.json):
 *   { "src/main.js": { "file": "assets/main-abc.js", "src": "src/main.js",
 *       "isEntry": true, "imports": ["_vendor-def.js"], "css": [...] },
 *     "src/pages/About.vue": { "file": "assets/About-xyz.js", "isDynamicEntry": true } }
 *
 * @param {string|object} manifest manifest JSON text or parsed object
 * @param {string} [baseUrl] site base URL used to absolutize asset URLs
 * @returns {{ entries: Array, dynamicEntries: Array, assets: Array, importGraph: Array<{from:string,to:string}>, routes: Array }}
 */
export function parseViteManifest(manifest, baseUrl = '') {
  const data = typeof manifest === 'string' ? safeJson(manifest) : manifest;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { entries: [], dynamicEntries: [], assets: [], importGraph: [], routes: [] };
  }

  const entries = [];
  const dynamicEntries = [];
  const assets = [];
  const importGraph = [];
  const routes = [];

  for (const [key, val] of Object.entries(data)) {
    if (!val || typeof val !== 'object') continue;
    const asset = {
      key,
      file: val.file || '',
      src: val.src || key,
      url: val.file ? joinUrl(baseUrl || '/', val.file) : '',
      isEntry: val.isEntry === true,
      isDynamicEntry: val.isDynamicEntry === true,
      imports: Array.isArray(val.imports) ? val.imports : [],
      css: Array.isArray(val.css) ? val.css : [],
      assets: Array.isArray(val.assets) ? val.assets : [],
    };
    assets.push(asset);
    if (asset.isEntry) entries.push(asset);
    if (asset.isDynamicEntry) dynamicEntries.push(asset);
    for (const imp of asset.imports) {
      const target = data[imp];
      importGraph.push({
        from: asset.file,
        to: target && target.file ? target.file : imp,
      });
    }
    // Source route inference: src/pages/** and src/routes/**
    const srcMatch = String(asset.src || '').match(
      /^src\/(?:pages|routes|views)\/(.+?)(?:\.[A-Za-z0-9]+)?$/
    );
    if (srcMatch) {
      let route = srcMatch[1]
        .replace(/\.[A-Za-z0-9_-]{6,}$/, '')
        .replace(/\.(vue|jsx?|tsx?|svelte|astro)$/, '');
      if (/^index$/i.test(route)) route = '';
      route = route.replace(/\[\.\.\.([^\]]+)\]/g, '*$1').replace(/\[([^\]]+)\]/g, ':$1');
      const path = route === '' ? '/' : '/' + route;
      if (!routes.some(r => r.path === path)) {
        routes.push({ path, source: 'vite-manifest', detail: { chunk: asset.file } });
      }
    }
  }

  return { entries, dynamicEntries, assets, importGraph, routes };
}

/**
 * Idea 679 — Reconstruct a Rollup chunk graph to find dynamically imported
 * routes.
 *
 * Given one or more observed bundle texts ({ name, code }), finds:
 *  - dynamic imports: import("./chunk-abc123.js") / import(`./${x}.js`)
 *  - static chunk imports: import ... from "./chunk-xyz.js"
 *  - modulepreload / preload link hints embedded in HTML/JS
 * and rebuilds the dependency graph between emitted chunks.
 *
 * @param {Array<{name:string, code:string}>|string} bundles bundle texts
 * @returns {{ nodes: string[], edges: Array<{from:string,to:string,kind:string}>, dynamicImports: Array<{from:string,spec:string}> }}
 */
export function reconstructRollupChunkGraph(bundles) {
  const list = Array.isArray(bundles)
    ? bundles
    : [{ name: 'bundle.js', code: String(bundles || '') }];

  const nodes = new Set();
  const edges = [];
  const dynamicImports = [];
  const seenEdge = new Set();

  const addEdge = (from, to, kind) => {
    const k = from + '>' + to + ':' + kind;
    if (seenEdge.has(k)) return;
    seenEdge.add(k);
    edges.push({ from, to, kind });
  };

  for (const { name, code } of list) {
    const text = String(code || '');
    nodes.add(name);

    // Dynamic imports: import("./chunk-abc.js"), import('./pages/x-hash.js')
    const dynRe = /import\(\s*["'`]([^"'`]+?)["'`]\s*\)/g;
    let m;
    while ((m = dynRe.exec(text)) !== null) {
      const spec = m[1];
      if (/\$\{|\+/.test(spec)) continue; // template-built, not enumerable
      const chunk = spec.split('/').pop();
      nodes.add(chunk);
      dynamicImports.push({ from: name, spec });
      addEdge(name, chunk, 'dynamic');
    }

    // Static relative imports of chunks
    const staticRe = /import\s+(?:[^'"]*?\s+from\s+)?["'`](\.[^"'`]*?\.js)["'`]/g;
    while ((m = staticRe.exec(text)) !== null) {
      const chunk = m[1].split('/').pop();
      nodes.add(chunk);
      addEdge(name, chunk, 'static');
    }

    // Preload hints: <link rel="modulepreload" href="/_nuxt/chunk-abc.js">
    const preloadRe = /rel=["'](?:modulepreload|preload)["'][^>]*?href=["']([^"']+\.js)["']/gi;
    while ((m = preloadRe.exec(text)) !== null) {
      const chunk = m[1].split('/').pop();
      nodes.add(chunk);
      addEdge(name, chunk, 'preload');
    }

    // webpack-style chunk loading fallback: .e("chunk-id").then(...) -> chunk file map
    const chunkIdRe = /["']([A-Za-z0-9_$-]+\.chunk\.[A-Za-z0-9]+\.js)["']/g;
    while ((m = chunkIdRe.exec(text)) !== null) {
      nodes.add(m[1]);
    }
  }

  return { nodes: [...nodes], edges, dynamicImports };
}

/**
 * Heuristic: score a chunk as "feature-revealing" (likely maps to a route or
 * admin feature) based on its id/file name.
 * @param {string} id chunk id or file name
 * @returns {number} 0-100
 */
export function scoreChunkFeature(id) {
  const s = String(id || '').toLowerCase();
  let score = 0;
  if (/admin|dashboard|panel|console/.test(s)) score += 60;
  if (/api|graphql/.test(s)) score += 40;
  if (/pages?\//.test(s) || /route/.test(s)) score += 40;
  if (/auth|login|oauth|sso/.test(s)) score += 30;
  if (/payment|checkout|billing/.test(s)) score += 30;
  if (/upload|import|export/.test(s)) score += 20;
  if (/src_/.test(s) || /_page/.test(s)) score += 10;
  return Math.min(score, 100);
}

function safeJson(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

export const BUNDLE_GRAPH_MINING = {
  enumerateWebpackChunks,
  parseViteManifest,
  reconstructRollupChunkGraph,
  scoreChunkFeature,
};

export default BUNDLE_GRAPH_MINING;
