/**
 * waybackCdxIntel.js — Wayback Machine CDX wildcard pull (idea 00203).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds the wildcard CDX API URL for *.target.com and parses CDX output
 * (urlkey, timestamp, original, statuscode, mimetype, digest) into
 * host + URL lists — archived captures routinely contain hosts that no
 * longer resolve in live DNS.
 */

const CDX_BASE = 'https://web.archive.org/cdx/search/cdx';

/**
 * Build a Wayback CDX API URL for a wildcard domain query.
 * @param {string} domain - Target domain, e.g. "example.com".
 * @param {Object} [opts] - Optional: { output='json', matchType='domain', collapse='urlkey', from, to, limit, filter, fl }.
 * @returns {string} Full CDX API URL.
 */
export function buildWaybackCdxUrl(domain, opts = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const params = new URLSearchParams({
    url: `*.${clean}`,
    output: opts.output || 'json',
    matchType: opts.matchType || 'domain',
    collapse: opts.collapse || 'urlkey',
    fl: opts.fl || 'timestamp,original,statuscode,mimetype,digest',
  });
  for (const k of ['from', 'to', 'limit', 'filter']) {
    if (opts[k] !== undefined && opts[k] !== null) params.set(k, String(opts[k]));
  }
  // Dedupe repeated filter params could arrive via opts.filters
  for (const f of opts.filters || []) params.append('filter', f);
  return `${CDX_BASE}?${params.toString()}`;
}

/**
 * Parse Wayback CDX JSON output (array of arrays with a header row).
 * @param {string} raw - Raw CDX response text.
 * @returns {Array<{ timestamp, original, statuscode, mimetype, digest }>}
 */
export function parseWaybackCdx(raw) {
  let arr;
  try { arr = JSON.parse(String(raw || '').trim()); } catch { return []; }
  if (!Array.isArray(arr) || arr.length < 2) return [];
  const header = arr[0].map(h => String(h).toLowerCase());
  return arr.slice(1).map(row => {
    const rec = {};
    header.forEach((h, i) => { rec[h] = row[i] ?? ''; });
    return {
      timestamp: rec.timestamp || '',
      original: rec.original || '',
      statuscode: rec.statuscode || '',
      mimetype: rec.mimetype || '',
      digest: rec.digest || '',
    };
  });
}

/**
 * Extract distinct hosts from CDX records.
 * @param {Array<Object>} records - Parsed CDX records.
 * @returns {Array<{ host, captures: number, firstSeen: string, lastSeen: string, statuses: string[] }>}
 */
export function extractHosts(records) {
  const map = new Map();
  for (const r of records || []) {
    let host = '';
    try { host = new URL(String(r.original)).hostname.toLowerCase(); } catch { continue; }
    if (!host) continue;
    if (!map.has(host)) map.set(host, { captures: 0, firstSeen: r.timestamp, lastSeen: r.timestamp, statuses: new Set() });
    const e = map.get(host);
    e.captures += 1;
    if (r.timestamp && (!e.firstSeen || r.timestamp < e.firstSeen)) e.firstSeen = r.timestamp;
    if (r.timestamp && (!e.lastSeen || r.timestamp > e.lastSeen)) e.lastSeen = r.timestamp;
    if (r.statuscode) e.statuses.add(String(r.statuscode));
  }
  return [...map.entries()]
    .map(([host, v]) => ({ host, captures: v.captures, firstSeen: v.firstSeen, lastSeen: v.lastSeen, statuses: [...v.statuses].sort() }))
    .sort((a, b) => b.captures - a.captures);
}

/**
 * Idea 00203 — full pull: parse raw Wayback CDX text into hosts + URLs.
 * @param {string} raw - Raw CDX JSON text.
 * @param {string} domain - Target domain for provenance.
 * @returns {{ domain, hosts, urls, recordCount, provenance }}
 */
export function pullWaybackCdx(raw, domain) {
  const records = parseWaybackCdx(raw);
  return {
    domain: String(domain).trim().toLowerCase(),
    hosts: extractHosts(records),
    urls: [...new Set(records.map(r => r.original).filter(Boolean))].sort(),
    recordCount: records.length,
    provenance: 'wayback-machine cdx',
  };
}
