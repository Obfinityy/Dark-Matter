/**
 * baiduHostIntel.js — Baidu indexed-subdomain pull (idea 00210).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds Baidu `site:` query URLs and parses result HTML/URLs for
 * subdomains — Baidu's crawl of Chinese-language and APAC infrastructure
 * often surfaces hosts missed by western engines.
 */

const BAIDU_BASE = 'https://www.baidu.com/s';

/**
 * Build Baidu `site:` search URLs (paged).
 * @param {string} domain - Target domain.
 * @param {Object} [opts] - Optional: { pages=3, extra }.
 * @returns {string[]} Search URLs, one per results page.
 */
export function buildBaiduSiteUrls(domain, opts = {}) {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const urls = [];
  const pages = opts.pages ?? 3;
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({
      wd: `site:${clean}${opts.extra ? ` ${opts.extra}` : ''}`,
      pn: String(p * 10),
    });
    urls.push(`${BAIDU_BASE}?${params.toString()}`);
  }
  return urls;
}

/**
 * Extract result URLs from Baidu SERP HTML.
 * Baidu links results through redirect URLs (/link?url=...) — both the
 * redirect target (when decoded) and any plain absolute URLs count.
 * @param {string} html - Raw Baidu SERP HTML.
 * @returns {string[]} Deduplicated result URLs.
 */
export function extractBaiduResultUrls(html) {
  const urls = new Set();
  const text = String(html || '');
  for (const m of text.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/gi)) {
    const href = m[1];
    if (/^https?:\/\//i.test(href) && !/baidu\.com/i.test(href)) {
      urls.add(href);
      continue;
    }
    // Baidu redirect wrapper: try to find the real target in data attrs
    const dm = m[0].match(/data-[^=]*url="([^"]+)"/i);
    if (dm && /^https?:\/\//i.test(dm[1])) urls.add(dm[1]);
  }
  // Bare absolute URLs in snippet markup
  for (const m of text.matchAll(/https?:\/\/(?!www\.baidu\.com)[^\s"'<>\\]+/gi)) {
    urls.add(m[0].replace(/[),.;]+$/, ''));
  }
  return [...urls];
}

/**
 * Extract distinct in-scope subdomains from Baidu result URLs.
 * @param {string} html - Raw Baidu SERP HTML.
 * @param {string} domain - Target apex domain.
 * @returns {Array<{ host, urlCount: number, urls: string[] }>}
 */
export function extractBaiduHosts(html, domain) {
  const apex = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const map = new Map();
  for (const u of extractBaiduResultUrls(html)) {
    let host = '';
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (host !== apex && !host.endsWith(`.${apex}`)) continue;
    if (!map.has(host)) map.set(host, new Set());
    map.get(host).add(u);
  }
  return [...map.entries()]
    .map(([host, urls]) => ({ host, urlCount: urls.size, urls: [...urls].sort() }))
    .sort((a, b) => b.urlCount - a.urlCount);
}

/**
 * Idea 00210 — full pull: Baidu SERP HTML → indexed subdomains.
 * @param {string} html - Raw Baidu SERP HTML.
 * @param {string} domain - Target apex domain.
 * @returns {{ domain, hosts, hostCount, resultUrlCount, provenance }}
 */
export function pullBaiduHosts(html, domain) {
  const hosts = extractBaiduHosts(html, domain);
  return {
    domain: String(domain).trim().toLowerCase(),
    hosts,
    hostCount: hosts.length,
    resultUrlCount: extractBaiduResultUrls(html).length,
    provenance: 'baidu indexed-subdomain search',
  };
}
