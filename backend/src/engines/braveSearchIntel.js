/**
 * braveSearchIntel.js — Brave Search query-URL building and host mining (idea 00212).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Brave Search maintains an independent index (not a Google/Bing syndication),
 * so it can surface subdomains that major engines miss. This module builds
 * `site:` query URLs for Brave's public search endpoint and parses the
 * returned result HTML for target subdomains.
 *
 * No network calls are made here — the caller fetches with its own HTTP
 * client (respecting Brave's terms of service and robots.txt) and passes the
 * HTML to the parser.
 */

const BRAVE_SEARCH_ENDPOINT = 'https://search.brave.com/search';

/**
 * Build Brave Search query URLs for subdomain mining.
 *
 * @param {string} domain - Base domain to mine, e.g. "example.com".
 * @param {Object} [options]
 * @param {number} [options.pages=3] - Result pages to request.
 * @param {string} [options.lang='en'] - Interface language.
 * @returns {Array<{ url: string, query: string, page: number }>}
 */
export function buildBraveSiteQueries(domain, options = {}) {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '');
  if (!clean) throw new Error('braveSearchIntel: domain is required');
  const pages = Math.max(1, Math.min(20, Number(options.pages ?? 3)));
  const lang = String(options.lang ?? 'en');

  const queries = [`site:${clean}`];
  for (const tldPrefix of [
    'dev',
    'test',
    'staging',
    'beta',
    'internal',
    'corp',
    'ops',
    'monitoring',
    'jenkins',
    'grafana',
  ]) {
    queries.push(`site:${tldPrefix}.${clean}`);
  }

  const urls = [];
  queries.forEach((q, qi) => {
    for (let page = 0; page < pages; page++) {
      const params = new URLSearchParams({ q, offset: String(page), lang });
      urls.push({ url: `${BRAVE_SEARCH_ENDPOINT}?${params}`, query: q, page, variant: qi });
    }
  });
  return urls;
}

/**
 * Extract candidate hostnames from a Brave Search result page.
 *
 * Brave renders results with `.snippet` cards whose title links point at the
 * destination directly (or through a `/click` redirect). Both are handled.
 *
 * @param {string} html - Raw HTML from search.brave.com/search.
 * @param {string} domain - Target base domain, e.g. "example.com".
 * @returns {{ hosts: Array<{ host: string, source: string }>, pageOk: boolean }}
 */
export function parseBraveSearchResults(html, domain) {
  const base = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '');
  if (!base) return { hosts: [], pageOk: false };
  const text = String(html || '');
  const pageOk = /class="[^"]*snippet|id="results"|data-testid="result/.test(text);
  const seen = new Map();

  // Title links inside result snippets.
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    recordFromHref(m[1], base, seen, 'brave-result-link');
  }

  // Bare hostnames rendered in result titles/snippets.
  const bareRe = new RegExp(
    `\\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.${escapeRegex(base)})\\b`,
    'gi'
  );
  const decoded = safeDecode(text);
  while ((m = bareRe.exec(decoded)) !== null) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) seen.set(host, { host, source: 'brave-snippet' });
  }

  return { hosts: [...seen.values()], pageOk };
}

/**
 * Percent-decode text without throwing on stray '%' characters, so
 * URL-encoded markup cannot produce mangled hosts (e.g. "2fapi.example.com").
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
    // Brave wraps some clicks as /click?u=<urlencoded>
    const wrap = href.match(/[?&]u=([^&]+)/);
    if (wrap && /^\/click/i.test(href)) target = decodeURIComponent(wrap[1]);
    if (!/^https?:\/\//i.test(target)) return;
    const host = new URL(target).hostname.toLowerCase();
    if (host === 'search.brave.com') return;
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
 * De-duplicate hosts parsed from several Brave result pages.
 *
 * @param {Array<{ hosts: Array<{ host: string, source: string }> }>} pages
 * @returns {Array<{ host: string, sources: string[], pages: number }>}
 */
export function mergeBraveHosts(pages) {
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

export const BRAVE_SEARCH_ENDPOINT_URL = BRAVE_SEARCH_ENDPOINT;
