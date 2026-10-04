/**
 * akamaiEdgeMiner.js — Akamai edge-hostname mining engine.
 *
 * Covers idea-bank item 00273:
 *  - 00273 Akamai edge-hostname mining — extract Akamai edge hostnames
 *    (edgesuite, edgekey) from DNS to map CDN-backed properties.
 *
 * Pure functions only: callers resolve DNS records themselves (respecting
 * provider rate limits) and pass the raw records in. No live HTTP here.
 */

const AKAMAI_PATTERNS = [
  { re: /\.edgesuite\.net$/i, kind: 'edgesuite', note: 'classic Akamai edge property (static content)' },
  { re: /\.edgekey\.net$/i, kind: 'edgekey', note: 'Akamai edge property with TLS (HTTPS)' },
  { re: /\.akamaized\.net$/i, kind: 'akamaized', note: 'Akamai media/delivery property' },
  { re: /\.akamaiedge\.net$/i, kind: 'akamaiedge', note: 'Akamai edge property' },
  { re: /\.akamaihd\.net$/i, kind: 'akamaihd', note: 'legacy Akamai HD media property' },
  { re: /\.akamaitechnologies\.com$/i, kind: 'akamaitech', note: 'Akamai technologies host' },
];

/**
 * Normalize a hostname: lowercase, strip trailing dot, port, and scheme.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify an Akamai edge hostname.
 * @param {string} hostname
 * @returns {{isAkamai: boolean, kind: string, note: string, host: string}}
 */
export function classifyAkamaiEdgeHost(hostname) {
  const host = normalizeHostname(hostname);
  for (const { re, kind, note } of AKAMAI_PATTERNS) {
    if (re.test(host)) return { isAkamai: true, kind, note, host };
  }
  return { isAkamai: false, kind: 'other', note: '', host };
}

/**
 * Mine DNS records for Akamai edge hostnames and map them back to the
 * original hostname(s) they front.
 *
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME, A, AAAA, TXT)
 * @returns {{
 *   query: string, edgeHost: string, kind: string, note: string,
 *   recordType: string, rawValue: string
 * }[]}
 */
export function extractAkamaiEdgeHosts(records = []) {
  const results = [];
  const seen = new Set();

  for (const rec of records || []) {
    const value = normalizeHostname(rec?.value || '');
    if (!value) continue;
    const cls = classifyAkamaiEdgeHost(value);
    if (!cls.isAkamai) continue;
    const key = `${String(rec?.query || '').toLowerCase()}|${cls.host}|${String(rec?.type || '').toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      query: normalizeHostname(rec?.query || ''),
      edgeHost: cls.host,
      kind: cls.kind,
      note: cls.note,
      recordType: String(rec?.type || '').toUpperCase(),
      rawValue: String(rec?.value || ''),
    });
  }

  return results.sort((a, b) => a.query.localeCompare(b.query) || a.edgeHost.localeCompare(b.edgeHost));
}

/**
 * Group mined edge hostnames by the property they belong to, so the caller
 * can see which target hosts share one Akamai property.
 *
 * @param {ReturnType<typeof extractAkamaiEdgeHosts>} mined
 * @returns {{edgeHost: string, kind: string, fronts: string[], recordTypes: string[]}[]}
 */
export function groupByEdgeProperty(mined = []) {
  const byEdge = new Map();
  for (const m of mined || []) {
    if (!byEdge.has(m.edgeHost)) {
      byEdge.set(m.edgeHost, { edgeHost: m.edgeHost, kind: m.kind, fronts: new Set(), recordTypes: new Set() });
    }
    const entry = byEdge.get(m.edgeHost);
    if (m.query) entry.fronts.add(m.query);
    if (m.recordType) entry.recordTypes.add(m.recordType);
  }
  return [...byEdge.values()]
    .map((e) => ({ edgeHost: e.edgeHost, kind: e.kind, fronts: [...e.fronts].sort(), recordTypes: [...e.recordTypes].sort() }))
    .sort((a, b) => b.fronts.length - a.fronts.length || a.edgeHost.localeCompare(b.edgeHost));
}

/**
 * Score the relevance of mined Akamai edges to the target brand/domain.
 * TLS-capable edgekey properties score higher (they expose the HTTPS
 * certificate surface).
 *
 * @param {ReturnType<typeof groupByEdgeProperty>} groups
 * @returns {{edgeHost: string, score: number}[]}
 */
export function scoreAkamaiProperties(groups = []) {
  const scored = (groups || []).map((g) => {
    let score = 20;
    if (g.kind === 'edgekey') score += 30;
    if (g.kind === 'edgesuite') score += 20;
    if (g.fronts.length > 1) score += 15; // shared property = broader surface
    if (g.fronts.length > 5) score += 10;
    return { edgeHost: g.edgeHost, score: Math.min(100, score) };
  });
  return scored.sort((a, b) => b.score - a.score);
}
