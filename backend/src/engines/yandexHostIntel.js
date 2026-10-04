/**
 * yandexHostIntel.js — Yandex indexed-host harvesting (idea 00209).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds Yandex `site:` search URL patterns and parses result snippets/URLs
 * for target hosts — Yandex indexes a different slice of the web than
 * Google/Bing and often surfaces hosts the others miss.
 */

/**
 * Build Yandex `site:` search URLs (paged).
 * @param {string} domain - Target domain.
 * @param {Object} [opts] - Optional: { pages=3, extra, lr }.
 * @returns {string[]} Search URLs, one per results page.
 */
export function buildYandexSiteUrls(domain, opts = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const urls = [];
  const pages = opts.pages ?? 3;
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({
      text: `site:${clean}${opts.extra ? ` ${opts.extra}` : ''}`,
      p: String(p),
    });
    if (opts.lr) params.set('lr', String(opts.lr));
    urls.push(`https://yandex.com/search/?${params.toString()}`);
  }
  return urls;
}

/**
 * Extract result URLs from a Yandex SERP HTML snippet.
 * @param {string} html - Raw search results HTML.
 * @returns {string[]} Deduplicated result URLs.
 */
export function extractYandexResultUrls(html) {
  const urls = new Set();
  const text = String(html || '');
  // Yandex wraps result links in <a class="... OrganicTitle-Link ..."> or Link_theme_outer
  for (const m of text.matchAll(/<a[^>]*class="[^"]*(?:OrganicTitle-Link|Link_theme_outer|Typo_text-l)[^"]*"[^>]*href="([^"]+)"/gi)) {
    const href = m[1];
    if (/^https?:\/\//i.test(href)) urls.add(href);
  }
  // Fallback: bare http(s) URLs in snippet text / data attributes
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
    const u = m[0].replace(/[),.;]+$/, '');
    if (!/yandex\./i.test(u)) urls.add(u);
  }
  return [...urls];
}

/**
 * Extract in-scope hosts from Yandex result URLs + snippet hostnames.
 * @param {string} html - Raw SERP HTML.
 * @param {string} domain - Target apex domain.
 * @returns {Array<{ host, urlCount: number, urls: string[] }>}
 */
export function extractYandexHosts(html, domain) {
  const apex = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const map = new Map();
  for (const u of extractYandexResultUrls(html)) {
    let host = '';
    try { host = new URL(u).hostname.toLowerCase(); } catch { continue; }
    if (host !== apex && !host.endsWith(`.${apex}`)) continue;
    if (!map.has(host)) map.set(host, new Set());
    map.get(host).add(u);
  }
  return [...map.entries()]
    .map(([host, urls]) => ({ host, urlCount: urls.size, urls: [...urls].sort() }))
    .sort((a, b) => b.urlCount - a.urlCount);
}

/**
 * Idea 00209 — full harvest: SERP HTML → target hosts.
 * @param {string} html - Raw Yandex SERP HTML.
 * @param {string} domain - Target apex domain.
 * @returns {{ domain, hosts, hostCount, resultUrlCount, provenance }}
 */
export function harvestYandexHosts(html, domain) {
  const hosts = extractYandexHosts(html, domain);
  return {
    domain: String(domain).trim().toLowerCase(),
    hosts,
    hostCount: hosts.length,
    resultUrlCount: extractYandexResultUrls(html).length,
    provenance: 'yandex indexed-host search',
  };
}
