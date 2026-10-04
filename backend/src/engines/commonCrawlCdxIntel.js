/**
 * commonCrawlCdxIntel.js — Common Crawl CDX subdomain mining (idea 00201).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds Common Crawl CDX index query URLs for a target domain and parses
 * CDX JSON lines into unique subdomains — historical web crawl data often
 * reveals subdomains long removed from live DNS.
 */

const CDX_BASE = 'https://index.commoncrawl.org';

/**
 * Build a CDX API query URL for a target domain.
 * @param {string} domain - Target domain, e.g. "example.com".
 * @param {Object} [opts] - Optional: { index = 'CC-MAIN-2026-30', output = 'json', filter, limit, collapse = 'urlkey', matchType = 'domain' }.
 * @returns {string} Full CDX query URL.
 */
export function buildCdxQueryUrl(domain, opts = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const params = new URLSearchParams({
    url: `*.${clean}`,
    output: opts.output || 'json',
    matchType: opts.matchType || 'domain',
    collapse: opts.collapse || 'urlkey',
    index: opts.index || 'CC-MAIN-2026-30',
  });
  if (opts.filter) params.set('filter', opts.filter);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.from) params.set('from', String(opts.from));
  if (opts.to) params.set('to', String(opts.to));
  return `${CDX_BASE}/${encodeURIComponent(params.get('index'))}-index?${params.toString()}`;
}

/**
 * Build query URLs for several Common Crawl index snapshots (dedupe of params included).
 * @param {string} domain - Target domain.
 * @param {string[]} indexes - Index IDs, e.g. ['CC-MAIN-2026-30', 'CC-MAIN-2026-22'].
 * @returns {string[]} Query URLs.
 */
export function buildCdxQueryUrls(domain, indexes = []) {
  const seen = new Set();
  const urls = [];
  for (const idx of indexes) {
    const u = buildCdxQueryUrl(domain, { index: idx });
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

/**
 * Parse raw CDX JSON-lines output (one JSON object per line) into records.
 * @param {string} raw - Raw CDX response text.
 * @returns {Array<{ urlkey, timestamp, original, mime, status, digest, length, offset, filename }>}
 */
export function parseCdxLines(raw) {
  const records = [];
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      if (o && o.url) {
        records.push({
          urlkey: o.urlkey || '',
          timestamp: o.timestamp || '',
          original: o.url,
          mime: o.mime || '',
          status: o.status || '',
          digest: o.digest || '',
          length: o.length || '',
          offset: o.offset || '',
          filename: o.filename || '',
        });
      }
    } catch { /* skip malformed lines */ }
  }
  return records;
}

/**
 * Extract unique subdomains of the target from CDX records.
 * @param {Array<Object>} records - Parsed CDX records.
 * @param {string} domain - Target apex domain.
 * @returns {{ subdomains: string[], hosts: Array<{ host, firstSeen, lastSeen, urls: number }> }}
 */
export function extractSubdomains(records, domain) {
  const apex = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const map = new Map();
  for (const r of records || []) {
    let host = '';
    try { host = new URL(String(r.original)).hostname.toLowerCase(); } catch { continue; }
    if (!host.endsWith(`.${apex}`) || host === apex) continue;
    if (!map.has(host)) map.set(host, { firstSeen: r.timestamp, lastSeen: r.timestamp, urls: 0 });
    const e = map.get(host);
    e.urls += 1;
    if (r.timestamp && (!e.firstSeen || r.timestamp < e.firstSeen)) e.firstSeen = r.timestamp;
    if (r.timestamp && (!e.lastSeen || r.timestamp > e.lastSeen)) e.lastSeen = r.timestamp;
  }
  const hosts = [...map.entries()].map(([host, v]) => ({ host, ...v }));
  return {
    subdomains: hosts.map(h => h.host).sort(),
    hosts,
  };
}

/**
 * Idea 00201 — full mine: parse raw CDX text for a domain into a provenance-tagged result.
 * @param {string} raw - Raw CDX JSON-lines text.
 * @param {string} domain - Target apex domain.
 * @param {string} [indexId] - Index ID for provenance.
 * @returns {{ domain, indexId, subdomains, hosts, recordCount, provenance }}
 */
export function mineCdxSubdomains(raw, domain, indexId = 'CC-MAIN-2026-30') {
  const records = parseCdxLines(raw);
  const { subdomains, hosts } = extractSubdomains(records, domain);
  return {
    domain: String(domain).trim().toLowerCase(),
    indexId,
    subdomains,
    hosts,
    recordCount: records.length,
    provenance: `common-crawl cdx (${indexId})`,
  };
}
