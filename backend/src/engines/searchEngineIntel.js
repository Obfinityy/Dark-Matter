/**
 * searchEngineIntel.js — Search-engine driven asset discovery engine.
 *
 * Covers idea-bank items 00034-00036:
 *  - 00034 Search-engine dork pipeline at scale: generate batched site:/inurl:
 *    dorks for several engines and merge/dedupe the fetched results to surface
 *    indexed-but-unlinked subdomains.
 *  - 00035 Search-engine cache host extraction: mine cached page copies for
 *    absolute URLs pointing at subdomains no longer linked from the live site.
 *  - 00036 Search-engine image-alt host mining: pull hostname references from
 *    image-search metadata (alt text, titles, URLs) that leak internal CDN and
 *    staging hosts.
 *
 * Pure functions only: callers fetch dork queries/cached pages/image results
 * themselves (respecting each engine's rate limits) and hand the raw data in.
 * No live HTTP is performed here.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const URL_RE = /\bhttps?:\/\/([^/:?\s"'<>]+)(?::\d+)?(?:[/?#][^\s"'<>]*)?/gi;

/**
 * Normalize a hostname: lowercase, strip trailing dot/port, drop scheme.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\d*\./, 'www.');
}

/**
 * Extract hostnames from arbitrary text, keeping only those that belong to
 * (or reference) the target root domain.
 * @param {string} text raw text to mine
 * @param {string} rootDomain e.g. "example.com"
 * @param {{includeRoot?: boolean}} [options]
 * @returns {string[]} unique hostnames, longest match preserved
 */
export function extractHostnames(text, rootDomain, options = {}) {
  const { includeRoot = true } = options;
  const root = normalizeHostname(rootDomain);
  if (!text || !root) return [];
  const found = new Set();
  for (const match of String(text).matchAll(HOSTNAME_RE)) {
    const h = normalizeHostname(match[0]);
    if (!h || h === root) {
      if (h === root && includeRoot) found.add(h);
      continue;
    }
    if (h.endsWith(`.${root}`) || h.includes(root)) found.add(h);
  }
  return [...found];
}

/**
 * Build a batched dork pipeline for a target domain across multiple search
 * engines. Each entry is one query to run; the caller executes them with
 * appropriate pacing per engine's terms of service.
 *
 * @param {string} domain target root domain
 * @param {{engines?: string[], includeInurl?: boolean, extraKeywords?: string[]}} [options]
 * @returns {{engine: string, query: string, technique: string}[]} dork queries
 */
export function buildDorkBatch(domain, options = {}) {
  const d = normalizeHostname(domain);
  if (!d) return [];
  const {
    engines = ['google', 'bing', 'duckduckgo', 'brave', 'yandex'],
    includeInurl = true,
    extraKeywords = [],
  } = options;

  const dorks = [
    { query: `site:${d}`, technique: 'site-indexed' },
    { query: `site:*.${d}`, technique: 'site-wildcard' },
    { query: `site:${d} -www`, technique: 'site-exclude-www' },
  ];
  if (includeInurl) {
    dorks.push(
      { query: `site:${d} inurl:admin`, technique: 'inurl-admin' },
      { query: `site:${d} inurl:login`, technique: 'inurl-login' },
      { query: `site:${d} inurl:api`, technique: 'inurl-api' },
      { query: `site:${d} inurl:dev OR inurl:staging OR inurl:test`, technique: 'inurl-env' },
      { query: `site:${d} inurl:dashboard OR inurl:panel OR inurl:console`, technique: 'inurl-panel' },
      { query: `site:${d} filetype:env OR filetype:log OR filetype:sql`, technique: 'filetype-sensitive' },
    );
  }
  for (const kw of extraKeywords) {
    dorks.push({ query: `site:${d} "${kw}"`, technique: 'keyword' });
  }

  const batch = [];
  for (const engine of engines) {
    for (const dork of dorks) {
      batch.push({ engine, query: dork.query, technique: dork.technique });
    }
  }
  return batch;
}

/**
 * Merge dork result sets from multiple engines, deduplicating by normalized
 * URL and tracking which engines reported each URL.
 *
 * @param {{engine: string, results: {url: string, title?: string, snippet?: string}[]}[]} resultSets
 * @returns {{url: string, title: string, snippet: string, engines: string[], hostname: string}[]}
 */
export function mergeDorkResults(resultSets = []) {
  const byUrl = new Map();
  for (const set of resultSets || []) {
    const engine = set?.engine || 'unknown';
    for (const r of set?.results || []) {
      const url = String(r?.url || '').trim();
      if (!url) continue;
      // Normalize: lowercase scheme+host, strip tracking params and fragments.
      let key = url;
      try {
        const u = new URL(url);
        u.hash = '';
        for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) {
          u.searchParams.delete(p);
        }
        key = u.toString().replace(/\/$/, '');
      } catch { key = url.toLowerCase().replace(/\/$/, ''); }
      if (!byUrl.has(key)) {
        let hostname = '';
        try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* keep empty */ }
        byUrl.set(key, { url, title: '', snippet: '', engines: [], hostname });
      }
      const entry = byUrl.get(key);
      if (!entry.engines.includes(engine)) entry.engines.push(engine);
      if (!entry.title && r?.title) entry.title = String(r.title);
      if (!entry.snippet && r?.snippet) entry.snippet = String(r.snippet);
    }
  }
  return [...byUrl.values()].sort((a, b) => b.engines.length - a.engines.length);
}

/**
 * Classify a discovered host by naming convention heuristics.
 * @param {string} host
 * @returns {'staging'|'internal'|'cdn'|'api'|'legacy'|'other'}
 */
export function classifyHostType(host) {
  const h = normalizeHostname(host);
  if (/(^|[.-])staging([.-]|$)|(^|[.-])stage([.-]|$)/.test(h)) return 'staging';
  if (/(^|[.-])dev([.-]|$)|(^|[.-])development([.-]|$)|(^|[.-])test([.-]|$)|(^|[.-])qa([.-]|$)|(^|[.-])uat([.-]|$)/.test(h)) return 'staging';
  if (/(^|[.-])internal([.-]|$)|(^|[.-])intranet([.-]|$)|(^|[.-])corp([.-]|$)|(^|[.-])lan([.-]|$)/.test(h)) return 'internal';
  if (/(^|[.-])cdn([.-]|$)|(^|[.-])static([.-]|$)|(^|[.-])assets([.-]|$)|(^|[.-])media([.-]|$)/.test(h)) return 'cdn';
  if (/(^|[.-])api([.-]|$)/.test(h)) return 'api';
  if (/(^|[.-])old([.-]|$)|(^|[.-])legacy([.-]|$)|(^|[.-])backup([.-]|$)|(^|[.-])archive([.-]|$)/.test(h)) return 'legacy';
  return 'other';
}

/**
 * Extract absolute URLs from cached page copies that point at subdomains of
 * the target which are NOT linked from the live site (forgotten pages).
 *
 * @param {{url: string, cachedAt?: string, html: string}[]} cachedPages
 * @param {string} rootDomain
 * @param {string[]} [liveHosts] hostnames known to be linked from the live site
 * @returns {{host: string, type: string, sourcePage: string, cachedAt: string}[]}
 */
export function extractCacheHosts(cachedPages = [], rootDomain, liveHosts = []) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const live = new Set((liveHosts || []).map(normalizeHostname));
  const results = [];
  const seen = new Set();

  for (const page of cachedPages || []) {
    const html = String(page?.html || '');
    if (!html) continue;
    const urls = new Set();
    for (const m of html.matchAll(URL_RE)) urls.add(m[1]);
    for (const m of html.matchAll(/srcset=["'][^"']*https?:\/\/([^/:?\s"'<>]+)/gi)) urls.add(m[1]);

    for (const rawHost of urls) {
      const host = normalizeHostname(rawHost);
      const hostnames = extractHostnames(host, root);
      for (const h of hostnames) {
        if (h === root || live.has(h) || seen.has(h)) continue;
        seen.add(h);
        results.push({
          host: h,
          type: classifyHostType(h),
          sourcePage: String(page?.url || ''),
          cachedAt: String(page?.cachedAt || ''),
        });
      }
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine hostname references from image-search metadata. Alt text, titles and
 * image/page URLs often leak internal CDN, staging, or media hosts.
 *
 * @param {{imageUrl: string, pageUrl?: string, alt?: string, title?: string}[]} imageResults
 * @param {string} rootDomain
 * @returns {{host: string, type: string, source: 'imageUrl'|'pageUrl'|'alt'|'title', evidence: string}[]}
 */
export function extractImageAltHosts(imageResults = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const results = [];
  const seen = new Set();

  for (const img of imageResults || []) {
    const fields = [
      ['imageUrl', String(img?.imageUrl || '')],
      ['pageUrl', String(img?.pageUrl || '')],
      ['alt', String(img?.alt || '')],
      ['title', String(img?.title || '')],
    ];
    for (const [source, value] of fields) {
      if (!value) continue;
      for (const host of extractHostnames(value, root, { includeRoot: false })) {
        const key = `${host}|${source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          host,
          type: classifyHostType(host),
          source,
          evidence: value.length > 200 ? value.slice(0, 200) + '…' : value,
        });
      }
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * From merged dork results, surface indexed-but-unlinked subdomains: hosts
 * found in search results that are not in the known live host set.
 *
 * @param {{hostname: string, url: string, engines: string[]}[]} mergedResults from mergeDorkResults
 * @param {string} rootDomain
 * @param {string[]} [knownHosts]
 * @returns {{host: string, type: string, urls: string[], engines: string[]}[]}
 */
export function surfaceUnlinkedSubdomains(mergedResults = [], rootDomain, knownHosts = []) {
  const root = normalizeHostname(rootDomain);
  const known = new Set((knownHosts || []).map(normalizeHostname));
  known.add(root);
  const byHost = new Map();

  for (const r of mergedResults || []) {
    const host = normalizeHostname(r?.hostname || '');
    if (!host || known.has(host)) continue;
    if (!host.endsWith(`.${root}`)) continue;
    if (!byHost.has(host)) {
      byHost.set(host, { host, type: classifyHostType(host), urls: [], engines: new Set() });
    }
    const entry = byHost.get(host);
    if (r?.url) entry.urls.push(r.url);
    for (const e of r?.engines || []) entry.engines.add(e);
  }

  return [...byHost.values()]
    .map((e) => ({ ...e, engines: [...e.engines] }))
    .sort((a, b) => b.engines.length - a.engines.length || a.host.localeCompare(b.host));
}
