/**
 * bingCacheIntel.js — Bing cached-page host extraction (idea 00208).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses cached page HTML for absolute URLs and extracts referenced
 * subdomains — cached pages frequently link to hosts that were later
 * removed from live pages (decommissioned services, old APIs).
 */

/**
 * Build a Bing cache URL for an archived view of a page.
 * @param {string} url - The live page URL.
 * @returns {string} Bing cache-view URL.
 */
export function buildBingCacheUrl(url) {
  const u = String(url || '').trim();
  return `https://cc.bingj.com/cache.aspx?q=${encodeURIComponent(u)}&d=${encodeURIComponent(u)}&w=1`;
}

/**
 * Build a Bing `site:` query URL for indexed-host harvesting.
 * @param {string} domain - Target domain.
 * @param {Object} [opts] - Optional: { first=1, extra }.
 * @returns {string} Bing search URL.
 */
export function buildBingSiteUrl(domain, opts = {}) {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const params = new URLSearchParams({
    q: `site:${clean}${opts.extra ? ` ${opts.extra}` : ''}`,
    first: String(opts.first ?? 1),
  });
  return `https://www.bing.com/search?${params.toString()}`;
}

/**
 * Extract absolute HTTP(S) URLs from HTML (href/src/action + bare URLs).
 * @param {string} html - Raw page HTML.
 * @returns {string[]} Deduplicated absolute URLs.
 */
export function extractAbsoluteUrls(html) {
  const urls = new Set();
  const text = String(html || '');
  for (const m of text.matchAll(/(?:href|src|action|data-src|poster)\s*=\s*["']([^"']+)["']/gi)) {
    const v = m[1].trim();
    if (/^https?:\/\//i.test(v)) urls.add(v);
    else if (/^\/\//.test(v)) urls.add(`https:${v}`);
  }
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) urls.add(m[0]);
  return [...urls];
}

/**
 * Extract referenced hosts from HTML and keep those inside the target domain.
 * @param {string} html - Raw page HTML.
 * @param {string} domain - Target apex domain.
 * @returns {{ allHosts: string[], inScopeHosts: string[], externalHosts: string[] }}
 */
export function extractCachedHosts(html, domain) {
  const apex = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const all = new Set();
  for (const u of extractAbsoluteUrls(html)) {
    try {
      all.add(new URL(u).hostname.toLowerCase());
    } catch {
      /* skip */
    }
  }
  const inScope = [];
  const external = [];
  for (const h of [...all].sort()) {
    if (h === apex || h.endsWith(`.${apex}`)) inScope.push(h);
    else external.push(h);
  }
  return { allHosts: [...all].sort(), inScopeHosts: inScope, externalHosts: external };
}

/**
 * Idea 00208 — full cached-page host extraction.
 * @param {string} html - Raw cached page HTML.
 * @param {string} domain - Target apex domain.
 * @returns {{ domain, inScopeHosts, externalHosts, urlCount, provenance }}
 */
export function mineBingCacheHosts(html, domain) {
  const { inScopeHosts, externalHosts } = extractCachedHosts(html, domain);
  return {
    domain: String(domain).trim().toLowerCase(),
    inScopeHosts,
    externalHosts,
    urlCount: extractAbsoluteUrls(html).length,
    provenance: 'bing cached-page',
  };
}
