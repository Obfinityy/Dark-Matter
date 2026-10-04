/**
 * arquivoPtIntel.js — Arquivo.pt historical host mining (idea 00206).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds Arquivo.pt textsearch API query URLs and parses its JSON responses
 * for target-domain captures — a second independent web archive that often
 * holds captures the Wayback Machine missed.
 */

const TEXTSEARCH_BASE = 'https://arquivo.pt/textsearch';

/**
 * Build an Arquivo.pt textsearch API URL for a target domain.
 * @param {string} domain - Target domain, e.g. "example.com".
 * @param {Object} [opts] - Optional: { versionHistory='*.example.com', maxItems=50, from, to, type='text/html', fields }.
 * @returns {string} Full textsearch API URL.
 */
export function buildArquivoQueryUrl(domain, opts = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const params = new URLSearchParams({
    versionHistory: opts.versionHistory || `*.${clean}`,
    maxItems: String(opts.maxItems ?? 50),
  });
  for (const k of ['from', 'to', 'type', 'fields']) {
    if (opts[k] !== undefined && opts[k] !== null) params.set(k, String(opts[k]));
  }
  return `${TEXTSEARCH_BASE}?${params.toString()}`;
}

/**
 * Build a version-history URL for one exact archived URL.
 * @param {string} url - The archived page URL.
 * @param {Object} [opts] - Optional: { maxItems=50 }.
 * @returns {string} textsearch API URL listing every version of the URL.
 */
export function buildArquivoVersionUrl(url, opts = {}) {
  const params = new URLSearchParams({
    versionHistory: String(url || '').trim(),
    maxItems: String(opts.maxItems ?? 50),
  });
  return `${TEXTSEARCH_BASE}?${params.toString()}`;
}

/**
 * Parse an Arquivo.pt textsearch JSON response into capture records.
 * Response shape: { response_items: [ { originalURL, linkToOriginalFile, linkToArchive, digest, mimeType, tstamp, ... } ] }.
 * @param {string|Object} raw - Raw JSON text or parsed object.
 * @returns {Array<{ originalUrl, archiveUrl, timestamp, mimeType, digest, statusCode }>}
 */
export function parseArquivoResponse(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(String(raw).trim()) : raw;
  } catch { return []; }
  const items = (obj && obj.response_items) || [];
  return items
    .map(it => ({
      originalUrl: it.originalURL || it.originalUrl || '',
      archiveUrl: it.linkToArchive || it.linkToOriginalFile || '',
      timestamp: it.tstamp || '',
      mimeType: it.mimeType || '',
      digest: it.digest || '',
      statusCode: it.statusCode || '',
    }))
    .filter(r => r.originalUrl);
}

/**
 * Extract distinct hosts from Arquivo.pt captures.
 * @param {Array<Object>} captures - Parsed capture records.
 * @returns {Array<{ host, captures: number, firstSeen: string, lastSeen: string }>}
 */
export function extractArquivoHosts(captures) {
  const map = new Map();
  for (const c of captures || []) {
    let host = '';
    try { host = new URL(String(c.originalUrl)).hostname.toLowerCase(); } catch { continue; }
    if (!host) continue;
    if (!map.has(host)) map.set(host, { captures: 0, firstSeen: c.timestamp, lastSeen: c.timestamp });
    const e = map.get(host);
    e.captures += 1;
    if (c.timestamp && (!e.firstSeen || c.timestamp < e.firstSeen)) e.firstSeen = c.timestamp;
    if (c.timestamp && (!e.lastSeen || c.timestamp > e.lastSeen)) e.lastSeen = c.timestamp;
  }
  return [...map.entries()]
    .map(([host, v]) => ({ host, ...v }))
    .sort((a, b) => b.captures - a.captures);
}

/**
 * Idea 00206 — full mine: parse raw Arquivo.pt JSON for a domain.
 * @param {string|Object} raw - Raw textsearch JSON.
 * @param {string} domain - Target domain for provenance.
 * @returns {{ domain, hosts, captures, captureCount, provenance }}
 */
export function mineArquivoHosts(raw, domain) {
  const captures = parseArquivoResponse(raw);
  return {
    domain: String(domain).trim().toLowerCase(),
    hosts: extractArquivoHosts(captures),
    captures,
    captureCount: captures.length,
    provenance: 'arquivo.pt textsearch',
  };
}
