/**
 * ssrHydrationSurface.js — SSR / hydration / client-asset surface mapping engine.
 *
 * During an authorized hunt the agent receives the target's own publicly served
 * HTML/JS/CSS and extracts client-side delivery structure that influences the
 * attack surface: async script dependencies, modulepreload graphs, preload
 * scanner hints, fetchpriority signals, lazy-hydration boundaries, island
 * architecture components, partial-hydration triggers, React Server Component
 * (RSC) payloads, RSC Flight protocol rows, and Next.js Turbopack chunk
 * references. These reveal which endpoints are critical, which components load
 * on demand, and where serialized route data leaks into the page.
 *
 * Pure and deterministic: operates only on provided page/asset text.
 * No network calls are made. Safe for unit tests.
 */

/**
 * Extract attribute key/value pairs from an HTML tag string.
 * Valueless attributes (async, defer, crossorigin) resolve to '' like the DOM.
 * @param {string} tag raw tag text, e.g. `<script async src="/a.js">`
 * @returns {Object<string, string>} attribute map (lowercased keys)
 */
function parseAttrs(tag) {
  const attrs = {};
  const re = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  // Skip the tag name itself (first match is `<script` etc.).
  let first = true;
  let m;
  while ((m = re.exec(tag)) !== null) {
    if (first) { first = false; continue; }
    const key = m[1].toLowerCase();
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ''));
    attrs[key] = val;
  }
  return attrs;
}

/**
 * Decode the most common HTML entities in serialized prop strings.
 * @param {string} s possibly entity-encoded text
 * @returns {string} decoded text
 */
function decodeEntities(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Return all tags of a given name from an HTML string.
 * @param {string} html page HTML
 * @param {string} name tag name, e.g. 'script'
 * @returns {string[]} raw tag strings (open tags only; scripts handled specially)
 */
function tagList(html, name) {
  if (typeof html !== 'string') return [];
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

/**
 * Heuristic: does a string look like a data/API endpoint path?
 * @param {string} s candidate string
 * @returns {boolean} true when it resembles a fetchable endpoint
 */
function looksLikeEndpoint(s) {
  if (typeof s !== 'string' || s.length < 2 || s.length > 400) return false;
  if (!/^(\/|\.\/|\.\.\/|https?:\/\/)/.test(s)) return false;
  if (/^https?:\/\/[^/]*$/.test(s)) return false; // bare origin, no path
  return /\/[a-zA-Z0-9_.-]+/.test(s) || /\.(json|graphql|api)(\?|$)/i.test(s) || /^\/api\//i.test(s);
}

/* ------------------------------------------------------------------ */
/* Idea 931 — Async-script dependency mapping                          */
/* ------------------------------------------------------------------ */

/**
 * Map async (and defer) script dependencies from page HTML.
 *
 * Async scripts execute as soon as they load (order not guaranteed); defer
 * scripts execute in document order after parsing. Both reveal third-party
 * and first-party dependencies the page trusts at load time.
 *
 * @param {string} html page HTML
 * @returns {Array<{src: string, kind: 'async'|'defer'|'sync-module', order: number, integrity: string|null, crossorigin: string|null, referrerpolicy: string|null}>}
 *   scripts in document order
 */
export function mapAsyncScriptDependencies(html) {
  if (typeof html !== 'string') return [];
  const out = [];
  let order = 0;
  const re = /<script\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[0]);
    const src = attrs.src;
    if (typeof src !== 'string' || src.length === 0) continue;
    const isAsync = attrs.async !== undefined;
    const isDefer = attrs.defer !== undefined;
    const isModule = attrs.type === 'module';
    if (!isAsync && !isDefer && !isModule) continue;
    out.push({
      src,
      kind: isModule ? 'sync-module' : (isAsync ? 'async' : 'defer'),
      order: order++,
      integrity: typeof attrs.integrity === 'string' ? attrs.integrity : null,
      crossorigin: typeof attrs.crossorigin === 'string' ? attrs.crossorigin : null,
      referrerpolicy: typeof attrs.referrerpolicy === 'string' ? attrs.referrerpolicy : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Idea 932 — Module-preload graph extraction                          */
/* ------------------------------------------------------------------ */

/**
 * Extract the modulepreload dependency graph from page HTML.
 *
 * `<link rel="modulepreload">` declares ES modules the page will need, forming
 * a dependency graph. Inline `<script type="module">` import statements are
 * also parsed so preloads can be matched to their importing modules.
 *
 * @param {string} html page HTML
 * @returns {{preloads: Array<{href: string, as: string|null, crossorigin: string|null}>, moduleImports: Array<{from: string, specifiers: string[]}>, edges: Array<{importer: string, imported: string}>}}
 */
export function extractModulePreloadGraph(html) {
  const empty = { preloads: [], moduleImports: [], edges: [] };
  if (typeof html !== 'string') return empty;

  const preloads = [];
  for (const tag of tagList(html, 'link')) {
    const attrs = parseAttrs(tag);
    const rel = String(attrs.rel || '').toLowerCase();
    if (rel !== 'modulepreload') continue;
    const href = attrs.href;
    if (typeof href !== 'string' || !href) continue;
    preloads.push({
      href,
      as: typeof attrs.as === 'string' ? attrs.as : null,
      crossorigin: typeof attrs.crossorigin === 'string' ? attrs.crossorigin : null,
    });
  }

  const moduleImports = [];
  const inlineRe = /<script\b[^>]*\btype\s*=\s*["']?module["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let im;
  let idx = 0;
  while ((im = inlineRe.exec(html)) !== null) {
    const body = im[1] || '';
    const imports = [];
    const importRe = /\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
    let q;
    while ((q = importRe.exec(body)) !== null) imports.push(q[1]);
    if (imports.length > 0) {
      moduleImports.push({ from: `inline-module-${idx++}`, specifiers: imports });
    }
  }

  // Edges: an inline module importer that references a preloaded href.
  const edges = [];
  const preloadSet = new Set(preloads.map(p => p.href));
  for (const mod of moduleImports) {
    for (const spec of mod.specifiers) {
      for (const href of preloadSet) {
        const base = href.split('/').pop();
        if (spec === href || spec.endsWith('/' + base) || (base && spec.endsWith(base) && spec.length > base.length)) {
          edges.push({ importer: mod.from, imported: href });
          break;
        }
      }
    }
  }

  return { preloads, moduleImports, edges };
}

/* ------------------------------------------------------------------ */
/* Idea 933 — Preload-scanner behavior analysis                        */
/* ------------------------------------------------------------------ */

const SCANNER_RELS = ['preload', 'prefetch', 'preconnect', 'dns-prefetch', 'prerender', 'modulepreload'];

/**
 * Analyze preload-scanner resource hints from page HTML.
 *
 * The browser preload scanner acts on `<link rel="preload|prefetch|preconnect|
 * dns-prefetch|prerender">` in the head. These hints mark the assets and
 * origins the site treats as load-critical — prime recon targets.
 *
 * @param {string} html page HTML
 * @returns {{preloads: Array<{href: string, as: string|null, fetchpriority: string|null, media: string|null}>, prefetches: string[], preconnects: string[], dnsPrefetches: string[], prerenders: string[], priorityAssets: Array<{href: string, reason: string}>}}
 */
export function analyzePreloadScannerHints(html) {
  const empty = { preloads: [], prefetches: [], preconnects: [], dnsPrefetches: [], prerenders: [], priorityAssets: [] };
  if (typeof html !== 'string') return empty;
  const res = { preloads: [], prefetches: [], preconnects: [], dnsPrefetches: [], prerenders: [], priorityAssets: [] };

  for (const tag of tagList(html, 'link')) {
    const attrs = parseAttrs(tag);
    const rel = String(attrs.rel || '').toLowerCase().trim();
    if (!SCANNER_RELS.includes(rel)) continue;
    const href = typeof attrs.href === 'string' ? attrs.href : '';
    if (!href) continue;
    switch (rel) {
      case 'preload':
        res.preloads.push({
          href,
          as: typeof attrs.as === 'string' ? attrs.as : null,
          fetchpriority: typeof attrs.fetchpriority === 'string' ? attrs.fetchpriority.toLowerCase() : null,
          media: typeof attrs.media === 'string' ? attrs.media : null,
        });
        break;
      case 'prefetch': res.prefetches.push(href); break;
      case 'preconnect': res.preconnects.push(href); break;
      case 'dns-prefetch': res.dnsPrefetches.push(href); break;
      case 'prerender': res.prerenders.push(href); break;
      default: break; // modulepreload covered by extractModulePreloadGraph
    }
  }

  // Priority assets: high fetchpriority preloads, then script/style preloads.
  for (const p of res.preloads) {
    if (p.fetchpriority === 'high') res.priorityAssets.push({ href: p.href, reason: 'fetchpriority=high' });
    else if (p.as === 'script' || p.as === 'style') res.priorityAssets.push({ href: p.href, reason: `preload as=${p.as}` });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Idea 934 — Fetch-priority hint mapping                              */
/* ------------------------------------------------------------------ */

/**
 * Map fetchpriority hints to the critical endpoints they mark.
 *
 * `fetchpriority="high|low|auto"` on img/link/script/iframe tells the browser
 * which resources are load-critical. High-priority targets are the ones the
 * site depends on most — the endpoints an agent should inventory first.
 *
 * @param {string} html page HTML
 * @returns {{hints: Array<{tag: string, resource: string, attribute: string, priority: 'high'|'low'|'auto'}>, criticalEndpoints: string[], lowPriority: string[]}}
 */
export function mapFetchPriorityHints(html) {
  const empty = { hints: [], criticalEndpoints: [], lowPriority: [] };
  if (typeof html !== 'string') return empty;
  const res = { hints: [], criticalEndpoints: [], lowPriority: [] };

  const re = /<(img|link|script|iframe)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[0]);
    const prioRaw = attrs.fetchpriority;
    if (typeof prioRaw !== 'string') continue;
    const priority = prioRaw.toLowerCase();
    if (!['high', 'low', 'auto'].includes(priority)) continue;
    const tag = m[1].toLowerCase();
    let attribute = 'src';
    let resource = attrs.src;
    if (tag === 'link') { attribute = 'href'; resource = attrs.href; }
    if (tag === 'img' && typeof attrs.srcset === 'string' && !resource) { attribute = 'srcset'; resource = attrs.srcset.split(',')[0].trim().split(' ')[0]; }
    if (typeof resource !== 'string' || !resource) continue;
    res.hints.push({ tag, resource, attribute, priority });
    if (priority === 'high') res.criticalEndpoints.push(resource);
    else if (priority === 'low') res.lowPriority.push(resource);
  }
  res.criticalEndpoints = [...new Set(res.criticalEndpoints)];
  res.lowPriority = [...new Set(res.lowPriority)];
  return res;
}

/* ------------------------------------------------------------------ */
/* Idea 935 — Lazy-hydration boundary mapping                          */
/* ------------------------------------------------------------------ */

/**
 * Map SSR hydration boundaries to component routes.
 *
 * SSR frameworks stamp hydration markers into the HTML (React root comments,
 * `__NEXT_DATA__`, Vue `data-server-rendered`, Nuxt `__NUXT__`, SvelteKit
 * data attributes). Boundaries show where client components take over —
 * each one maps to a route or component subtree worth probing.
 *
 * @param {string} html page HTML
 * @returns {{framework: string|null, boundaries: Array<{marker: string, kind: string, context: string}>}}
 */
export function mapLazyHydrationBoundaries(html) {
  const empty = { framework: null, boundaries: [] };
  if (typeof html !== 'string') return empty;
  const boundaries = [];
  let framework = null;

  const push = (marker, kind, context) => boundaries.push({ marker, kind, context: String(context).slice(0, 160) });

  // Next.js data blob carries page/route/query info.
  const nextData = html.match(/<script[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    framework = framework || 'nextjs';
    let route = 'unknown';
    try {
      const parsed = JSON.parse(nextData[1]);
      route = parsed.page || parsed.route || 'unknown';
    } catch { /* non-JSON blob; keep unknown */ }
    push('__NEXT_DATA__', 'ssr-data', `route=${route}`);
  }
  if (/\bid\s*=\s*["']__next["']/i.test(html)) {
    framework = framework || 'nextjs';
    push('id="__next"', 'react-root', 'Next.js React root container');
  }
  // Vue SSR marker.
  for (const m of html.matchAll(/<[^>]+\bdata-server-rendered\s*=\s*["']true["'][^>]*>/gi)) {
    framework = framework || 'vue';
    push('data-server-rendered', 'ssr-boundary', m[0].slice(0, 120));
  }
  // Nuxt payload.
  if (/\b__NUXT__\b/.test(html)) {
    framework = framework || 'nuxt';
    push('__NUXT__', 'ssr-data', 'Nuxt serialized app state');
  }
  // SvelteKit.
  for (const m of html.matchAll(/<[^>]+\bdata-sveltekit-[\w-]+(?:\s*=\s*["'][^"']*["'])?[^>]*>/gi)) {
    framework = framework || 'sveltekit';
    push('data-sveltekit-*', 'ssr-boundary', m[0].slice(0, 120));
  }
  // React 18+ hydration boundary comments: `<!--$-->` / `<!--/$-->`.
  const reactComments = html.match(/<!--\$?-->|<!--\/\$?-->/g);
  if (reactComments && reactComments.length > 0) {
    framework = framework || 'react';
    push('<!--$-->/<!--/$-->', 'hydration-boundary', `${reactComments.length} React Suspense/hydration boundary comments`);
  }
  // Astro/partial-hydration directives rendered as attributes.
  for (const m of html.matchAll(/\bclient:(load|idle|visible|media|only)=["'][^"']*["']/gi)) {
    framework = framework || 'astro';
    push(`client:${m[1]}`, 'hydration-directive', m[0]);
  }

  return { framework, boundaries };
}

/* ------------------------------------------------------------------ */
/* Idea 936 — Island-architecture component mapping                   */
/* ------------------------------------------------------------------ */

/**
 * Map island-architecture components to their data endpoints.
 *
 * Astro, Fresh, and Qwik render pages as mostly-static HTML with isolated
 * interactive "islands". Each island tag carries the component URL and,
 * often, serialized props that reveal its data endpoints.
 *
 * @param {string} htmlOrJs page HTML or bundled JS
 * @returns {Array<{framework: string, component: string, propsPreview: string|null, endpoints: string[]}>}
 */
export function mapIslandArchitectureComponents(htmlOrJs) {
  if (typeof htmlOrJs !== 'string') return [];
  const out = [];

  const endpointStrings = (text) => {
    const found = new Set();
    const re = /["'`](\/[A-Za-z0-9_\-./?=&%{}]+|\.\/[A-Za-z0-9_\-./?=&%{}]+|https?:\/\/[^\s"'`<>\\]+)["'`]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (looksLikeEndpoint(m[1])) found.add(m[1]);
    }
    return [...found].slice(0, 25);
  };

  // Astro islands: <astro-island component-url="..." props="...">
  for (const m of htmlOrJs.matchAll(/<astro-island\b[^>]*>/gi)) {
    const attrs = parseAttrs(m[0]);
    const component = typeof attrs['component-url'] === 'string' ? attrs['component-url']
      : (typeof attrs.component === 'string' ? attrs.component : 'unknown');
    const props = typeof attrs.props === 'string' ? decodeEntities(attrs.props) : null;
    out.push({
      framework: 'astro',
      component,
      propsPreview: props ? props.slice(0, 200) : null,
      endpoints: props ? endpointStrings(props) : [],
    });
  }
  // Fresh islands state: __FRSH_STATE / data-fresh markers with serialized props.
  for (const m of htmlOrJs.matchAll(/<script[^>]*>([^<]*__FRSH_STATE[^<]*)<\/script>/gi)) {
    out.push({
      framework: 'fresh',
      component: 'fresh-island-state',
      propsPreview: m[1].slice(0, 200),
      endpoints: endpointStrings(m[1]),
    });
  }
  // Qwik containers: q:container / q:id markers.
  for (const m of htmlOrJs.matchAll(/<[^>]+\bq:container\b[^>]*>/gi)) {
    out.push({
      framework: 'qwik',
      component: 'qwik-container',
      propsPreview: m[0].slice(0, 200),
      endpoints: endpointStrings(m[0]),
    });
  }
  // Generic web-component islands with data-endpoint attributes.
  for (const m of htmlOrJs.matchAll(/<[\w-]+\b[^>]*\bdata-endpoint\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    out.push({
      framework: 'web-component',
      component: m[0].slice(1, m[0].indexOf(' ')),
      propsPreview: null,
      endpoints: looksLikeEndpoint(m[1]) ? [m[1]] : [],
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Idea 937 — Partial-hydration trigger mapping                        */
/* ------------------------------------------------------------------ */

/**
 * Map the triggers that hydrate components on demand.
 *
 * Partial hydration fires on visibility (IntersectionObserver), idleness
 * (requestIdleCallback), media queries, or explicit events. Knowing the
 * trigger tells the agent how to reach a component's client-side code path.
 *
 * @param {string} htmlOrJs page HTML or bundled JS
 * @returns {Array<{trigger: string, kind: 'visibility'|'idle'|'media'|'event'|'eager', target: string}>}
 */
export function mapPartialHydrationTriggers(htmlOrJs) {
  if (typeof htmlOrJs !== 'string') return [];
  const out = [];
  const seen = new Set();
  const add = (trigger, kind, target) => {
    const key = `${trigger}|${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ trigger, kind, target });
  };

  // Astro-style client directives in HTML.
  for (const m of htmlOrJs.matchAll(/\bclient:(load|idle|visible|media|only)\s*=\s*["']([^"']*)["']/gi)) {
    const directive = m[1].toLowerCase();
    const kind = directive === 'visible' ? 'visibility'
      : directive === 'idle' ? 'idle'
      : directive === 'media' ? 'media' : 'eager';
    add(`client:${directive}`, kind, m[2] || 'island');
  }

  // IntersectionObserver-based lazy hydration in JS.
  for (const m of htmlOrJs.matchAll(/new\s+IntersectionObserver\s*\(\s*(?:async\s*)?\(?([^)]{0,80})\)?/g)) {
    add('IntersectionObserver', 'visibility', m[1].trim() || 'callback');
  }
  if (/IntersectionObserver/.test(htmlOrJs) && out.every(o => o.trigger !== 'IntersectionObserver')) {
    add('IntersectionObserver', 'visibility', 'observer');
  }

  // requestIdleCallback-based idle hydration.
  for (const m of htmlOrJs.matchAll(/requestIdleCallback\s*\(\s*([^)]{0,80})\)/g)) {
    add('requestIdleCallback', 'idle', m[1].trim() || 'callback');
  }

  // matchMedia-gated hydration.
  for (const m of htmlOrJs.matchAll(/matchMedia\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    add('matchMedia', 'media', m[1]);
  }

  // Dynamic import() — code-split on-demand loading.
  for (const m of htmlOrJs.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    add('dynamic-import', 'event', m[1]);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Idea 938 — Server-component payload mining                          */
/* ------------------------------------------------------------------ */

/**
 * Mine React Server Component payloads for data endpoints.
 *
 * RSC payloads stream into the page inside `self.__next_f.push([...])`
 * chunks (Next.js App Router) or as serialized Flight data. Embedded URL
 * strings reveal the API routes server components actually call.
 *
 * @param {string} html page HTML
 * @returns {Array<{chunk: number, format: 'next-flight'|'rsc-serialized', endpoints: string[], payloadPreview: string}>}
 */
export function mineServerComponentPayloads(html) {
  if (typeof html !== 'string') return [];
  const out = [];
  const seenPayloads = new Set();

  const harvest = (payload, chunk, format) => {
    const endpoints = new Set();
    const re = /["'`](\/[A-Za-z0-9_\-./?=&%{}]+|https?:\/\/[^\s"'`<>\\]+)["'`]/g;
    let m;
    while ((m = re.exec(payload)) !== null) {
      if (looksLikeEndpoint(m[1])) endpoints.add(m[1]);
    }
    const key = payload.slice(0, 400);
    if (seenPayloads.has(key)) return;
    seenPayloads.add(key);
    out.push({
      chunk,
      format,
      endpoints: [...endpoints].slice(0, 25),
      payloadPreview: payload.slice(0, 300),
    });
  };

  // Next.js Flight chunks: self.__next_f.push([1,"..."])
  const flightRe = /self\.__next_f\.push\(\s*\[(\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\s*\)/g;
  let m;
  let idx = 0;
  while ((m = flightRe.exec(html)) !== null) {
    let payload = m[2];
    try { payload = JSON.parse(`"${m[2]}"`); } catch { /* keep raw */ }
    harvest(payload, idx++, 'next-flight');
  }

  // Generic serialized RSC blobs: "reactServerComponent" markers or $RC markers.
  const genericRe = /<script[^>]*>([\s\S]{0,20000}?(?:\$RC|reactServerComponent|ReactFlight)[\s\S]{0,20000}?)<\/script>/gi;
  while ((m = genericRe.exec(html)) !== null) {
    harvest(m[1], idx++, 'rsc-serialized');
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Idea 939 — RSC Flight-protocol analysis                             */
/* ------------------------------------------------------------------ */

/**
 * Analyze RSC Flight protocol data for serialized route information.
 *
 * The Flight wire format streams rows: `I[...]` (module references),
 * `E` (errors), `T` (text), `S` (segment), and plain strings holding route
 * paths and search params. Parsing them reconstructs the route tree the
 * server serialized for the client.
 *
 * @param {string} html page HTML
 * @returns {{chunks: number, rows: Array<{chunk: number, rowId: string, kind: string}>, routes: string[], moduleRefs: string[]}}
 */
export function analyzeRscFlightProtocol(html) {
  const empty = { chunks: 0, rows: [], routes: [], moduleRefs: [] };
  if (typeof html !== 'string') return empty;

  const rows = [];
  const routes = new Set();
  const moduleRefs = new Set();
  let chunks = 0;

  const flightRe = /self\.__next_f\.push\(\s*\[(\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\s*\)/g;
  let m;
  while ((m = flightRe.exec(html)) !== null) {
    chunks++;
    let payload = m[2];
    try { payload = JSON.parse(`"${m[2]}"`); } catch { /* keep raw */ }

    // Row pattern: <hexId>:<kind><rest> e.g. `0:I["...","..."]`, `2:["$","div",...]`
    const rowRe = /^([0-9A-Za-z_-]+):([A-Za-z$\[])/gm;
    let r;
    while ((r = rowRe.exec(payload)) !== null) {
      const rowId = r[1];
      const marker = r[2];
      const kind = marker === 'I' ? 'module-ref'
        : marker === 'E' ? 'error'
        : marker === 'T' ? 'text'
        : marker === 'S' ? 'segment'
        : 'element';
      rows.push({ chunk: chunks - 1, rowId, kind });
      if (kind === 'module-ref') {
        const refRe = new RegExp(rowId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':I\\[([^\\]]{0,400})\\]');
        const ref = refRe.exec(payload);
        if (ref) {
          for (const part of ref[1].split(',')) {
            const mod = part.replace(/["']/g, '').trim();
            if (mod) moduleRefs.add(mod);
          }
        }
      }
    }

    // Route-like strings inside the Flight payload.
    const routeRe = /["'`](\/(?:[A-Za-z0-9_\-.]+(?:\/[A-Za-z0-9_\-.]+)*)\/?)(?:\?[^"'`]*)?["'`]/g;
    let q;
    while ((q = routeRe.exec(payload)) !== null) {
      const route = q[1];
      if (/^\/(_next|static|favicon)/.test(route)) continue;
      routes.add(route);
    }
  }

  return { chunks, rows, routes: [...routes].slice(0, 50), moduleRefs: [...moduleRefs].slice(0, 50) };
}

/* ------------------------------------------------------------------ */
/* Idea 940 — Turbopack chunk mapping                                  */
/* ------------------------------------------------------------------ */

/**
 * Map Turbopack chunks referenced in Next.js dev-mode leaks.
 *
 * Next.js dev servers (Turbopack) emit chunk script tags and runtime calls
 * referencing `[turbopack]` chunk paths with human-readable route segments
 * like `[project]/app/dashboard/page [app-client] (ecmascript)`. When a dev
 * server is accidentally exposed, these map the route tree directly.
 *
 * @param {string} htmlOrJs page HTML or bundled JS
 * @returns {Array<{chunk: string, type: 'turbopack-script'|'turbopack-context'|'dev-chunk', routeHint: string|null}>}
 */
export function mapTurbopackChunks(htmlOrJs) {
  if (typeof htmlOrJs !== 'string') return [];
  const out = [];
  const seen = new Set();
  const add = (chunk, type, routeHint) => {
    const key = `${type}|${chunk}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ chunk, type, routeHint });
  };

  const routeHintFrom = (s) => {
    const m = s.match(/\[(?:project|app)\]([^\]]*?)(?:\s*\[|\s*\(|$)/);
    if (m) {
      const hint = m[1].replace(/\\/g, '/').trim();
      return hint || null;
    }
    return null;
  };

  // <script src="...[turbopack]..."> chunk tags.
  for (const tag of tagList(htmlOrJs, 'script')) {
    const attrs = parseAttrs(tag);
    const src = attrs.src;
    if (typeof src !== 'string' || !/turbopack/i.test(src)) continue;
    add(src, 'turbopack-script', routeHintFrom(src));
  }

  // __turbopack_context__ / __turbopack_require__ runtime calls with chunk ids.
  for (const m of htmlOrJs.matchAll(/__turbopack_(?:context|require)__\s*\(\s*["'`]([^"'`]{1,300})["'`]\s*\)/g)) {
    add(m[1], 'turbopack-context', routeHintFrom(m[1]));
  }

  // Quoted chunk descriptors: "[project]/app/page [app-client] (ecmascript)".
  for (const m of htmlOrJs.matchAll(/["'`](\[(?:project|app)\][^"'`]{1,200})["'`]/g)) {
    if (!/turbopack|app-client|app-ssr|ecmascript/i.test(m[1])) continue;
    add(m[1], 'dev-chunk', routeHintFrom(m[1]));
  }

  return out;
}

/* ------------------------------------------------------------------ */

export const SSR_HYDRATION_SURFACE = {
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
};

export default SSR_HYDRATION_SURFACE;
