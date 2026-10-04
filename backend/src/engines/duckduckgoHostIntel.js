/**
 * duckduckgoHostIntel.js — DuckDuckGo HTML-endpoint subdomain mining (idea 00211).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * DuckDuckGo's lightweight `https://html.duckduckgo.com/html/` endpoint is
 * one of the few major search frontends still serving plain server-rendered
 * HTML without JavaScript. The module builds site-scoped query URLs for that
 * endpoint and parses the returned result markup to extract target subdomains.
 *
 * No network calls are made here — the caller fetches the URL with its own
 * HTTP client (respecting DDG's terms of service and rate limits) and passes
 * the HTML to the parser.
 */

const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/';

/**
 * Build DDG HTML-endpoint query URLs for subdomain mining.
 *
 * Generates a set of `site:` queries that page through results for a target
 * domain. Each URL is a plain GET so it works with any HTTP client.
 *
 * @param {string} domain - Base domain to mine, e.g. "example.com".
 * @param {Object} [options]
 * @param {number} [options.pages=3] - How many result pages to request.
 * @param {number} [options.perPage=30] - Results per page (DDG clamps ~30).
 * @returns {Array<{ url: string, query: string, page: number }>}
 */
export function buildDdgSiteQueries(domain, options = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^\*\./, '');
  if (!clean) throw new Error('duckduckgoHostIntel: domain is required');
  const pages = Math.max(1, Math.min(20, Number(options.pages ?? 3)));
  const perPage = Math.max(10, Math.min(50, Number(options.perPage ?? 30)));

  const queries = [`site:${clean}`];
  const common = ['www', 'api', 'dev', 'staging', 'mail', 'vpn', 'portal', 'admin', 'app', 'cdn'];
  for (const prefix of common) queries.push(`site:${prefix}.${clean}`);

  const urls = [];
  queries.forEach((q, qi) => {
    for (let page = 0; page < pages; page++) {
      const params = new URLSearchParams({ q, s: String(page * perPage), dc: String(perPage) });
      urls.push({ url: `${DDG_HTML_ENDPOINT}?${params}`, query: q, page, variant: qi });
    }
  });
  return urls;
}

/**
 * Extract candidate hostnames from a DDG HTML result page.
 *
 * Parses the server-rendered markup (both the classic `result__a` anchors
 * and the newer `result-link` anchors) and keeps hosts inside the target
 * domain, excluding DDG's own redirect wrapper host.
 *
 * @param {string} html - Raw HTML from the DDG HTML endpoint.
 * @param {string} domain - Target base domain, e.g. "example.com".
 * @returns {{ hosts: Array<{ host: string, source: string }>, pageOk: boolean }}
 */
export function parseDdgHtmlResults(html, domain) {
  const base = String(domain || '').trim().toLowerCase().replace(/^\*\./, '');
  if (!base) return { hosts: [], pageOk: false };
  const text = String(html || '');
  const pageOk = /class="[^"]*result|id="links"|name="q"/.test(text);
  const seen = new Map();

  // Anchor hrefs (result links) — order-agnostic: the result class may appear
  // before or after the href attribute.
  const hrefRe = /<a(?=[^>]*class="[^"]*(?:result__a|result-link)[^"]*")[^>]*href="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = hrefRe.exec(text)) !== null) {
    recordFromHref(m[1], base, seen, 'ddg-result-link');
  }
  // Fallback: any absolute https? href that lands inside the base domain.
  const anyHrefRe = /href="(https?:\/\/[^"]+)"/gi;
  while ((m = anyHrefRe.exec(text)) !== null) {
    recordFromHref(m[1], base, seen, 'ddg-href');
  }
  // Bare hostnames printed in result snippets (e.g. <span class="result__snippet">).
  // Scan percent-decoded text so URL-encoded markup (%2F%2Fhost) cannot
  // produce mangled hosts like "2fapi.example.com".
  const bareRe = new RegExp(`\\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.${escapeRegex(base)})\\b`, 'gi');
  const decoded = safeDecode(text);
  while ((m = bareRe.exec(decoded)) !== null) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) seen.set(host, { host, source: 'ddg-snippet' });
  }

  return { hosts: [...seen.values()], pageOk };
}

/**
 * Percent-decode text without throwing on stray '%' characters.
 * @param {string} s
 */
function safeDecode(s) {
  try {
    return decodeURIComponent(String(s).replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  } catch {
    return String(s);
  }
}

function recordFromHref(href, base, seen, source) {
  try {
    let target = href;
    // DDG wraps outbound links as https://duckduckgo.com/l/?uddg=<urlencoded>
    const wrap = href.match(/[?&]uddg=([^&]+)/);
    if (wrap) target = decodeURIComponent(wrap[1]);
    if (!/^https?:\/\//i.test(target)) return;
    const host = new URL(target).hostname.toLowerCase();
    if (host === base || host.endsWith(`.${base}`)) {
      if (!seen.has(host)) seen.set(host, { host, source });
    }
  } catch {
    /* ignore malformed hrefs */
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Merge hosts from multiple parsed DDG pages into a de-duplicated list.
 *
 * @param {Array<{ hosts: Array<{ host: string, source: string }> }>} pages
 * @returns {Array<{ host: string, sources: string[], pages: number }>}
 */
export function mergeDdgHosts(pages) {
  const map = new Map();
  for (const page of pages || []) {
    for (const h of page?.hosts || []) {
      if (!map.has(h.host)) map.set(h.host, { host: h.host, sources: [], pages: 0 });
      const entry = map.get(h.host);
      if (!entry.sources.includes(h.source)) entry.sources.push(h.source);
      entry.pages += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.pages - a.pages || a.host.localeCompare(b.host));
}

export const DDG_HTML_ENDPOINT_URL = DDG_HTML_ENDPOINT;
