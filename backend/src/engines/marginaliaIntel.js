/**
 * marginaliaIntel.js — Marginalia old-web host discovery (idea 00214).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Marginalia (search.marginalia.nu) indexes the text-heavy, non-commercial
 * web — wikis, documentation mirrors, mailing-list archives, personal sites —
 * where legacy, forgotten, or decommissioned-but-still-resolving subdomains
 * are often mentioned. This module builds Marginalia search URLs and parses
 * the plain-text-oriented results for legacy subdomains.
 *
 * No network calls are made here — the caller fetches with its own HTTP
 * client (respecting Marginalia's terms of service) and passes the HTML to
 * the parser.
 */

const MARGINALIA_SEARCH_ENDPOINT = 'https://search.marginalia.nu/search';

/**
 * Build Marginalia search URLs for legacy host discovery.
 *
 * Marginalia supports `site:domain.tld` plus plain keyword search. Queries
 * target documentation-style vocabulary that tends to mention old hosts.
 *
 * @param {string} domain - Base domain to mine, e.g. "example.com".
 * @param {Object} [options]
 * @param {number} [options.pages=3] - Result pages to request.
 * @returns {Array<{ url: string, query: string, page: number }>}
 */
export function buildMarginaliaQueries(domain, options = {}) {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '');
  if (!clean) throw new Error('marginaliaIntel: domain is required');
  const pages = Math.max(1, Math.min(10, Number(options.pages ?? 3)));

  const queries = [`site:${clean}`];
  for (const kw of [
    'legacy',
    'archive',
    'deprecated',
    'old',
    'intranet',
    'wiki documentation',
    'mailing list',
    'changelog mirror',
  ]) {
    queries.push(`"${clean}" ${kw}`);
  }

  const urls = [];
  queries.forEach((q, qi) => {
    for (let page = 0; page < pages; page++) {
      const params = new URLSearchParams({ query: q, page: String(page + 1) });
      urls.push({ url: `${MARGINALIA_SEARCH_ENDPOINT}?${params}`, query: q, page, variant: qi });
    }
  });
  return urls;
}

/**
 * Extract candidate hostnames from a Marginalia result page.
 *
 * Marginalia renders compact result blocks with title anchors and a plain
 * "domain/path" display line; results are text-heavy, so bare-hostname
 * scanning of the whole page body is also applied.
 *
 * @param {string} html - Raw HTML from search.marginalia.nu/search.
 * @param {string} domain - Target base domain, e.g. "example.com".
 * @returns {{ hosts: Array<{ host: string, source: string }>, pageOk: boolean }}
 */
export function parseMarginaliaResults(html, domain) {
  const base = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '');
  if (!base) return { hosts: [], pageOk: false };
  const text = String(html || '');
  const pageOk = /search\.marginalia|class="[^"]*result|name="query"/.test(text);
  const seen = new Map();

  // Title/result anchors.
  const linkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    recordFromHref(m[1], base, seen, 'marginalia-result-link');
  }

  // Bare hostnames anywhere in the text-heavy results (strip tags first,
  // then percent-decode so encoded markup can't mangle hosts).
  const plain = safeDecode(text.replace(/<[^>]+>/g, ' '));
  const bareRe = new RegExp(
    `\\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.${escapeRegex(base)})\\b`,
    'gi'
  );
  while ((m = bareRe.exec(plain)) !== null) {
    const host = m[1].toLowerCase();
    if (!seen.has(host)) seen.set(host, { host, source: 'marginalia-mention' });
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
    const host = new URL(href).hostname.toLowerCase();
    if (host.includes('marginalia')) return;
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
 * De-duplicate hosts parsed from several Marginalia result pages.
 *
 * @param {Array<{ hosts: Array<{ host: string, source: string }> }>} pages
 * @returns {Array<{ host: string, sources: string[], pages: number }>}
 */
export function mergeMarginaliaHosts(pages) {
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

export const MARGINALIA_SEARCH_ENDPOINT_URL = MARGINALIA_SEARCH_ENDPOINT;
