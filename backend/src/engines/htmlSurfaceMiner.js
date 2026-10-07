/**
 * htmlSurfaceMiner.js — Mining the visible HTML surface of an authorized target.
 *
 * Content-analysis utilities for the Dark-Matter recon engine. Every function
 * analyzes ALREADY-FETCHED content (HTML strings, plain text) handed to it by
 * the hunt pipeline — nothing here performs live network requests.
 *
 * Implemented ideas (bank range 741-750):
 *  741 buildCommonCrawlSeedPlan / filterCommonCrawlResults — deep URL seeding
 *      from the public Common Crawl columnar index (the caller issues the
 *      HTTP request itself; this module only plans and filters).
 *  742 mineHtmlComments — TODOs, disabled features and internal URLs in
 *      HTML comments.
 *  743 mineConditionalComments — IE conditional comments and the legacy
 *      asset hosts they reference.
 *  744 mineSsiDirectives — server-side-include directives and include paths.
 *  745 mineJsonLd — JSON-LD blocks: organization URLs and sameAs links.
 *  746 extractNextData — Next.js __NEXT_DATA__ page props and API routes.
 *  747 extractNuxtPayload — Nuxt __NUXT__ state, route payloads, endpoints.
 *  748 mineBootstrappedState — bootstrapped Redux/Vuex/Apollo initial state:
 *      API hosts and user routes, with secrets redacted.
 *  749 extractConfigObjects — window.config-style objects listing
 *      environment-specific endpoints.
 *  750 harvestMetaTags — og:url / canonical / alternate tags → canonical
 *      host mapping.
 *
 * All output is defensive recon data (URLs, hosts, asset paths, structure)
 * used to guide an authorized bug-bounty assessment. No exploit payloads,
 * no weaponized code.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Extract absolute http(s) URLs from a string. */
function findUrls(text) {
  const out = [];
  const re = /https?:\/\/[^\s"'<>),]+/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    out.push(m[0].replace(/[.,;]+$/, ''));
  }
  return [...new Set(out)];
}

/** Hostname of a URL, or null when unparsable. */
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Keys whose values look like secrets and must be redacted in reports. */
const SECRET_KEY_RE = /api[-_]?key|secret|token|passwd|password|private[-_]?key|client[-_]?secret|auth[-_]?token|session[-_]?id/i;

/**
 * Deep-clone a value, replacing any value stored under a secret-looking key
 * with '[REDACTED]'. Arrays and plain objects are traversed; other values
 * are returned as-is.
 */
export function redactSecrets(value, depth = 0) {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED]' : redactSecrets(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Safely parse JSON, returning null on failure instead of throwing.
 * @param {string} text
 * @returns {any|null}
 */
export function safeJsonParse(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

/**
 * Recursively walk a JSON value and collect strings matching a predicate.
 * @param {any} value
 * @param {(s: string, path: string) => boolean} predicate
 * @param {string} [path]
 * @returns {{ value: string, path: string }[]}
 */
export function collectMatchingStrings(value, predicate, path = '$') {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (predicate(v, p)) hits.push({ value: v, path: p });
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
    } else if (v && typeof v === 'object') {
      for (const [k, item] of Object.entries(v)) walk(item, `${p}.${k}`);
    }
  };
  walk(value, path);
  return hits;
}

// ---------------------------------------------------------------------------
// 741 — Common Crawl URL seeding
// ---------------------------------------------------------------------------

/**
 * Build a Common Crawl index query plan for seeding deep historical URLs.
 * The caller performs the HTTP request against index.commoncrawl.org;
 * this function only describes the query and how to filter results.
 *
 * @param {string} domain Target domain, e.g. 'example.com'
 * @param {object} [opts]
 * @param {string} [opts.matchType='domain'] 'domain' | 'host' | 'exact'
 * @param {string[]} [opts.indexes] CC index aliases to consult, e.g. ['CC-MAIN-2026-39', 'CC-MAIN-2026-30']
 * @param {number} [opts.limit=5000]
 * @returns {{ indexApiUrl: string, query: object, filters: object, usage: string }}
 */
export function buildCommonCrawlSeedPlan(domain, opts = {}) {
  const clean = String(domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  const indexes = Array.isArray(opts.indexes) && opts.indexes.length > 0
    ? opts.indexes
    : ['CC-MAIN-2026-39', 'CC-MAIN-2026-30', 'CC-MAIN-2026-22'];
  const query = {
    url: `${clean}/*`,
    output: 'json',
    matchType: opts.matchType || 'domain',
    collapse: 'urlkey',
    limit: opts.limit || 5000,
    filter: 'status:200',
  };
  return {
    indexApiUrl: 'https://index.commoncrawl.org/collinfo.json',
    query,
    filters: {
      // Applied by filterCommonCrawlResults()
      dropExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.css', '.woff', '.woff2', '.ttf', '.mp4', '.mp3'],
      keepMime: ['text/html', 'application/json', 'text/plain', 'application/xml'],
      dropPaths: ['/static/', '/assets/', '/fonts/', '/images/'],
    },
    usage: `Query https://index.commoncrawl.org/${indexes[0]}-index with the query params, ` +
      `then pass each result row through filterCommonCrawlResults(). Rotate through indexes: ${indexes.join(', ')}.`,
  };
}

/**
 * Filter raw Common Crawl index rows down to recon-relevant URLs.
 * Row shape: { url, mime, status, digest } as returned by the index API.
 *
 * @param {object[]} rows
 * @param {object} [filters] Same shape as plan.filters
 * @returns {{ urls: string[], dropped: number, byMime: Record<string, number> }}
 */
export function filterCommonCrawlResults(rows = [], filters = {}) {
  const dropExt = filters.dropExtensions || [];
  const keepMime = filters.keepMime || null;
  const dropPaths = filters.dropPaths || [];
  const seen = new Set();
  const urls = [];
  const byMime = {};
  let dropped = 0;
  for (const row of rows) {
    if (!row || typeof row.url !== 'string') { dropped++; continue; }
    const lower = row.url.toLowerCase();
    if (dropExt.some((ext) => lower.split('?')[0].endsWith(ext))) { dropped++; continue; }
    if (dropPaths.some((p) => lower.includes(p))) { dropped++; continue; }
    if (keepMime && row.mime && !keepMime.some((m) => row.mime.startsWith(m))) { dropped++; continue; }
    if (String(row.status) !== '200') { dropped++; continue; }
    if (seen.has(row.url)) { dropped++; continue; }
    seen.add(row.url);
    urls.push(row.url);
    byMime[row.mime || 'unknown'] = (byMime[row.mime || 'unknown'] || 0) + 1;
  }
  return { urls, dropped, byMime };
}

// ---------------------------------------------------------------------------
// 742 — HTML comment mining
// ---------------------------------------------------------------------------

const COMMENT_CLASSIFIERS = [
  { label: 'todo', re: /\b(todo|fixme|hack|xxx|note to self|tbd)\b/i },
  { label: 'disabled-feature', re: /\b(disabled|commented out|deprecated|do not use|hidden|temporarily removed|wip|under construction)\b/i },
  { label: 'internal-url', re: /https?:\/\/|localhost|127\.0\.0\.1|10\.\d|192\.168\.|internal|staging|dev\.|qa\./i },
];

/**
 * Extract HTML comments and classify them.
 *
 * @param {string} html
 * @returns {{ body: string, classification: 'todo'|'disabled-feature'|'internal-url'|'note', urls: string[] }[]}
 */
export function mineHtmlComments(html) {
  const out = [];
  const re = /<!--([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const body = m[1].trim();
    if (!body) continue;
    const urls = findUrls(body);
    let classification = 'note';
    for (const c of COMMENT_CLASSIFIERS) {
      if (c.re.test(body)) { classification = c.label; break; }
    }
    if (urls.length > 0 && classification === 'note') classification = 'internal-url';
    out.push({ body, classification, urls });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 743 — Conditional-comment legacy mining
// ---------------------------------------------------------------------------

/**
 * Parse IE conditional comments (e.g. <!--[if lte IE 9]>…<![endif]-->).
 *
 * @param {string} html
 * @returns {{ condition: string, body: string, assetUrls: string[], legacyHosts: string[] }[]}
 */
export function mineConditionalComments(html) {
  const out = [];
  const re = /<!--\s*\[if\s+([^\]]+)\]>([\s\S]*?)<!\[endif\]\s*-->/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const condition = m[1].trim();
    const body = m[2].trim();
    // Asset URLs: absolute URLs plus src/href attribute values
    const absolute = findUrls(body);
    const attrs = [];
    const attrRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    let a;
    while ((a = attrRe.exec(body)) !== null) attrs.push(a[1]);
    const assetUrls = [...new Set([...absolute, ...attrs])];
    const legacyHosts = [...new Set(assetUrls.map(hostOf).filter(Boolean))];
    out.push({ condition, body, assetUrls, legacyHosts });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 744 — SSI directive mining
// ---------------------------------------------------------------------------

/**
 * Find server-side-include directives (<!--#include virtual="…" -->) and
 * similar SSI commands, which reveal server-side include paths.
 *
 * @param {string} html
 * @returns {{ directive: string, command: string, attributes: Record<string,string>, includePaths: string[] }[]}
 */
export function mineSsiDirectives(html) {
  const out = [];
  const re = /<!--\s*#(include|exec|echo|config|flastmod|fsize|printenv|set)\b([^>]*?)-->/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const command = m[1].toLowerCase();
    const attrText = m[2];
    const attributes = {};
    const attrRe = /(\w+)\s*=\s*["']([^"']*)["']/g;
    let a;
    while ((a = attrRe.exec(attrText)) !== null) attributes[a[1].toLowerCase()] = a[2];
    const includePaths = ['virtual', 'file'].map((k) => attributes[k]).filter(Boolean);
    out.push({ directive: m[0], command, attributes, includePaths });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 745 — Inline JSON-LD mining
// ---------------------------------------------------------------------------

/**
 * Parse <script type="application/ld+json"> blocks.
 *
 * @param {string} html
 * @returns {{ type: string|null, data: any, urls: string[], sameAs: string[] }[]}
 */
export function mineJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const data = safeJsonParse(m[1].trim());
    if (data === null) continue;
    const blocks = Array.isArray(data) ? data : [data];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const type = block['@type'] || null;
      const urls = collectMatchingStrings(block, (s) => /^https?:\/\//i.test(s)).map((h) => h.value);
      const sameAsRaw = block.sameAs;
      const sameAs = Array.isArray(sameAsRaw) ? sameAsRaw.filter((s) => typeof s === 'string') : [];
      out.push({ type, data: block, urls: [...new Set(urls)], sameAs: [...new Set(sameAs)] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 746 — Next.js __NEXT_DATA__ extraction
// ---------------------------------------------------------------------------

/**
 * Extract the Next.js __NEXT_DATA__ payload from server-rendered HTML.
 *
 * @param {string} html
 * @returns {{ buildId: string|null, page: string|null, pageProps: object, apiRoutes: string[], urls: string[] } | null}
 */
export function extractNextData(html) {
  const re = /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const m = re.exec(String(html || ''));
  if (!m) return null;
  const data = safeJsonParse(m[1].trim());
  if (!data || typeof data !== 'object') return null;
  const pageProps = data.props && typeof data.props.pageProps === 'object' && data.props.pageProps !== null
    ? data.props.pageProps
    : {};
  const hits = collectMatchingStrings(
    pageProps,
    (s) => /^https?:\/\//i.test(s) || /^\/api[\w\-/]*/i.test(s),
  );
  const urls = [];
  const apiRoutes = [];
  for (const h of hits) {
    if (/^https?:\/\//i.test(h.value)) urls.push(h.value);
    else apiRoutes.push(h.value);
  }
  return {
    buildId: data.buildId || null,
    page: data.page || null,
    pageProps: redactSecrets(pageProps),
    apiRoutes: [...new Set(apiRoutes)],
    urls: [...new Set(urls)],
  };
}

// ---------------------------------------------------------------------------
// 747 — Nuxt __NUXT__ payload extraction
// ---------------------------------------------------------------------------

/**
 * Parse the Nuxt window.__NUXT__ state object embedded in SSR HTML.
 *
 * @param {string} html
 * @returns {{ state: object, payloads: object, endpoints: string[], urls: string[] } | null}
 */
export function extractNuxtPayload(html) {
  const re = /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i;
  const m = re.exec(String(html || ''));
  if (!m) return null;
  const data = safeJsonParse(m[1]);
  if (!data || typeof data !== 'object') return null;
  const redacted = redactSecrets(data);
  const hits = collectMatchingStrings(
    data,
    (s) => /^https?:\/\//i.test(s) || /^\/api[\w\-/]*/i.test(s),
  );
  const endpoints = [];
  const urls = [];
  for (const h of hits) {
    if (/^https?:\/\//i.test(h.value)) urls.push(h.value);
    else endpoints.push(h.value);
  }
  return {
    state: redacted.state || {},
    payloads: redacted.data && typeof redacted.data === 'object' ? redacted.data : {},
    endpoints: [...new Set(endpoints)],
    urls: [...new Set(urls)],
  };
}

// ---------------------------------------------------------------------------
// 748 — Bootstrapped initial-state object mining
// ---------------------------------------------------------------------------

/** Variable names commonly used to bootstrap client-side state. */
const STATE_VAR_NAMES = [
  '__INITIAL_STATE__',
  '__PRELOADED_STATE__',
  '__APOLLO_STATE__',
  '__REDUX_STATE__',
  '__VUEX_STATE__',
  'initialState',
  'preloadedState',
];

/**
 * Mine bootstrapped state objects (Redux/Vuex/Apollo initial state) for
 * API hosts and user-facing routes. Secret values are redacted.
 *
 * @param {string} html
 * @returns {{ varName: string, apiHosts: string[], userRoutes: string[], urls: string[], state: object }[]}
 */
export function mineBootstrappedState(html) {
  const out = [];
  const text = String(html || '');
  for (const name of STATE_VAR_NAMES) {
    const re = new RegExp(`(?:window\\.)?${name}\\s*=\\s*(\\{[\\s\\S]*?\\});?\\s*<\\/script>`, 'i');
    const m = re.exec(text);
    if (!m) continue;
    const data = safeJsonParse(m[1]);
    if (!data || typeof data !== 'object') continue;
    const hits = collectMatchingStrings(
      data,
      (s) => /^https?:\/\//i.test(s) || /^\/(api|users?|account|profile|dashboard|settings|admin)[\w\-/]*/i.test(s),
    );
    const urls = [];
    const userRoutes = [];
    for (const h of hits) {
      if (/^https?:\/\//i.test(h.value)) urls.push(h.value);
      else userRoutes.push(h.value);
    }
    const apiHosts = [...new Set(urls.map(hostOf).filter(Boolean))];
    out.push({ varName: name, apiHosts, userRoutes: [...new Set(userRoutes)], urls: [...new Set(urls)], state: redactSecrets(data) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 749 — Embedded config-object extraction
// ---------------------------------------------------------------------------

/** Variable names commonly used for embedded runtime config. */
const CONFIG_VAR_NAMES = [
  'window\\.config',
  'window\\.APP_CONFIG',
  'window\\.appConfig',
  'window\\.ENV',
  'window\\.__CONFIG__',
  'window\\.runtimeConfig',
];

/**
 * Extract window.config-style objects that list environment-specific
 * endpoints. Secret values are redacted.
 *
 * @param {string} html
 * @returns {{ varName: string, endpoints: string[], env: object }[]}
 */
export function extractConfigObjects(html) {
  const out = [];
  const text = String(html || '');
  for (const pattern of CONFIG_VAR_NAMES) {
    const display = pattern.replace(/\\/g, '');
    const re = new RegExp(`${pattern}\\s*=\\s*(\\{[\\s\\S]*?\\});?\\s*(?:<\\/script>|\\n)`, 'i');
    const m = re.exec(text);
    if (!m) continue;
    const data = safeJsonParse(m[1]);
    if (!data || typeof data !== 'object') continue;
    const endpoints = collectMatchingStrings(
      data,
      (s) => /^https?:\/\//i.test(s) || /^\/[\w\-./]*api[\w\-./]*/i.test(s),
    ).map((h) => h.value);
    out.push({ varName: display, endpoints: [...new Set(endpoints)], env: redactSecrets(data) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 750 — Meta-tag URL harvesting
// ---------------------------------------------------------------------------

/**
 * Harvest og:url, canonical and alternate link tags and build a
 * canonical-host mapping.
 *
 * @param {string} html
 * @returns {{ canonical: string|null, ogUrl: string|null, alternates: { hreflang: string|null, href: string }[], hosts: string[], canonicalHost: string|null }}
 */
export function harvestMetaTags(html) {
  const text = String(html || '');
  const attr = (tag, name) => {
    const r = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
    const mm = r.exec(tag);
    return mm ? mm[1] : null;
  };
  let canonical = null;
  let ogUrl = null;
  const alternates = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const tag = m[0];
    const rel = (attr(tag, 'rel') || '').toLowerCase();
    if (rel === 'canonical') {
      canonical = attr(tag, 'href');
    } else if (rel === 'alternate') {
      const href = attr(tag, 'href');
      if (href) alternates.push({ hreflang: attr(tag, 'hreflang'), href });
    }
  }
  const metaRe = /<meta\b[^>]*>/gi;
  while ((m = metaRe.exec(text)) !== null) {
    const tag = m[0];
    const prop = ((attr(tag, 'property') || attr(tag, 'name')) || '').toLowerCase();
    if (prop === 'og:url') ogUrl = attr(tag, 'content');
  }
  const hosts = [...new Set([canonical, ogUrl, ...alternates.map((a) => a.href)].map(hostOf).filter(Boolean))];
  return {
    canonical,
    ogUrl,
    alternates,
    hosts,
    canonicalHost: canonical ? hostOf(canonical) : (ogUrl ? hostOf(ogUrl) : null),
  };
}

export const HTML_SURFACE_MINER = {
  buildCommonCrawlSeedPlan,
  filterCommonCrawlResults,
  mineHtmlComments,
  mineConditionalComments,
  mineSsiDirectives,
  mineJsonLd,
  extractNextData,
  extractNuxtPayload,
  mineBootstrappedState,
  extractConfigObjects,
  harvestMetaTags,
  redactSecrets,
  safeJsonParse,
  collectMatchingStrings,
};

export default HTML_SURFACE_MINER;
