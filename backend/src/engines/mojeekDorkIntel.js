/**
 * mojeekDorkIntel.js — Mojeek independent-index dorking (idea 00213).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Mojeek runs its own crawler and index (it does not syndicate Google/Bing
 * results), so `site:` dorks against Mojeek can surface subdomains the major
 * engines never indexed. This module builds Mojeek search URLs and parses the
 * returned result markup for target subdomains.
 *
 * No network calls are made here — the caller fetches with its own HTTP
 * client (respecting Mojeek's terms of service) and passes the HTML to the
 * parser.
 */

const MOJEEK_SEARCH_ENDPOINT = 'https://www.mojeek.com/search';

/**
 * Build Mojeek search URLs for subdomain dorking.
 *
 * Mojeek supports `site:domain.tld` operators. Queries are diversified with
 * wildcard-ish keyword prefixes to coax more of the independent index out.
 *
 * @param {string} domain - Base domain to dork, e.g. "example.com".
 * @param {Object} [options]
 * @param {number} [options.pages=3] - Result pages to request (Mojeek `s=` offset).
 * @returns {Array<{ url: string, query: string, page: number }>}
 */
export function buildMojeekSiteQueries(domain, options = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^\*\./, '');
  if (!clean) throw new Error('mojeekDorkIntel: domain is required');
  const pages = Math.max(1, Math.min(20, Number(options.pages ?? 3)));

  const queries = [`site:${clean}`];
  for (const kw of ['login', 'dashboard', 'portal', 'console', 'panel', 'api-docs', 'status', 'docs', 'support', 'partners']) {
    queries.push(`site:${clean} ${kw}`);
  }

  const urls = [];
  queries.forEach((q, qi) => {
    for (let page = 0; page < pages; page++) {
      const params = new URLSearchParams({ q, s: String(page * 10 + 1) });
      urls.push({ url: `${MOJEEK_SEARCH_ENDPOINT}?${params}`, query: q, page, variant: qi });
    }
  });
  return urls;
}

/**
 * Extract candidate hostnames from a Mojeek result page.
 *
 * Mojeek renders each result in a `<ul class="results-standard">` list with
 * title anchors (`<h2><a href="...">`) pointing directly at the destination.
 *
 * @param {string} html - Raw HTML from www.mojeek.com/search.
 * @param {string} domain - Target base domain, e.g. "example.com".
 * @returns {{ hosts: Array<{ host: string, source: string }>, pageOk: boolean }}
 */
export function parseMojeekResults(html, domain) {
  const base = String(domain || '').trim().toLowerCase().replace(/^\*\./, '');
  if (!base) return { hosts: [], pageOk: false };
  const text = String(html || '');
  const pageOk = /class="[^"]*results-standard|id="results"|name="q"/.test(text);
  const seen = new Map();

  const linkRe = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    recordFromHref(m[1], base, seen, 'mojeek-title-link');
  }
  // Display-URL lines rendered under some results.
  const dispRe = /<span[^>]*class="[^"]*(?:url|obscure)[^"]*"[^>]*>([^<]+)<\/span>/gi;
  while ((m = dispRe.exec(text)) !== null) {
    const host = m[1].trim().toLowerCase().replace(/\/.*$/, '');
    if (host === base || host.endsWith(`.${base}`)) {
      if (!seen.has(host)) seen.set(host, { host, source: 'mojeek-display-url' });
    }
  }
  // Bare hostnames in snippets (decoded so %2F sequences can't mangle hosts).
  const bareRe = new RegExp(`\\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.${escapeRegex(base)})\\b`, 'gi');
  const decoded = safeDecode(text);
  while ((m = bareRe.exec(decoded)) !== null) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) seen.set(host, { host, source: 'mojeek-snippet' });
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
    if (!/^https?:\/\//i.test(href)) return;
    const host = new URL(href).hostname.toLowerCase();
    if (host === 'www.mojeek.com') return;
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
 * De-duplicate hosts parsed from several Mojeek result pages.
 *
 * @param {Array<{ hosts: Array<{ host: string, source: string }> }>} pages
 * @returns {Array<{ host: string, sources: string[], pages: number }>}
 */
export function mergeMojeekHosts(pages) {
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

export const MOJEEK_SEARCH_ENDPOINT_URL = MOJEEK_SEARCH_ENDPOINT;
