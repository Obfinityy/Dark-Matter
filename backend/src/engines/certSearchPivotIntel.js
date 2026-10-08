/**
 * certSearchPivotIntel.js — certificate-search UI pivoting (idea 00149).
 *
 * Certificate search interfaces (transparency-report style UIs) let an
 * analyst pivot on issuer, subject alt names, and validity windows. This
 * module builds structured search queries from a brand/seed and parses
 * search-result rows into pivotable intelligence: brand variants,
 * issuer pivots, and validity-window anomalies.
 */

const LOOKALIKE_REPLACEMENTS = [
  ['rn', 'm'],
  ['vv', 'w'],
  ['0', 'o'],
  ['1', 'l'],
  ['5', 's'],
  ['-', ''],
  ['cl', 'd'],
  ['ii', 'u'],
];

/**
 * Generate brand-variant pivots for certificate search (typosquats,
 * TLD swaps, sub-service prefixes).
 * @param {string} brand — e.g. "example"
 * @param {string[]} tlds
 * @returns {{ query, kind }[]}
 */
export function brandVariantQueries(brand = '', tlds = ['com', 'net', 'org', 'io', 'co']) {
  const b = brand.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!b) return [];
  const queries = [];
  for (const tld of tlds) {
    queries.push({ query: `${b}.${tld}`, kind: 'apex' });
  }
  for (const [from, to] of LOOKALIKE_REPLACEMENTS) {
    const variant = b.replace(from, to);
    if (variant !== b) queries.push({ query: variant, kind: `lookalike:${from}→${to}` });
  }
  for (const prefix of ['www', 'api', 'app', 'login', 'secure', 'admin', 'dev']) {
    queries.push({ query: `${prefix}.${b}`, kind: 'service-prefix' });
  }
  return queries;
}

/**
 * Build a structured pivot query over issuer / SAN / validity windows.
 * @param {{ brand?: string, issuer?: string, sanContains?: string, validAfter?: string, validBefore?: string, limit?: number }} opts
 * @returns {Record<string, unknown>} query object for a cert-search API
 */
export function buildPivotQuery({
  brand = '',
  issuer = null,
  sanContains = null,
  validAfter = null,
  validBefore = null,
  limit = 100,
} = {}) {
  const query = {};
  if (brand) query.identity = brand;
  if (issuer) query.issuer = issuer;
  if (sanContains) query.sanContains = sanContains;
  if (validAfter) query.notBeforeGte = validAfter;
  if (validBefore) query.notBeforeLte = validBefore;
  query.limit = Math.min(Math.max(limit, 1), 1000);
  return query;
}

/**
 * Parse certificate search rows into pivots: issuers, SAN hosts, and
 * validity anomalies (very short or very long validity).
 * @param {{ serial, issuer, hostnames?: string[], san?: string[], notBefore, notAfter }[]} rows
 * @returns {{ issuers: { issuer, count }[], hosts: { hostname, count }[], anomalies: { serial, kind, detail }[], total: number }}
 */
export function parseSearchResults(rows = []) {
  const issuerCounts = new Map();
  const hostCounts = new Map();
  const anomalies = [];
  for (const row of rows) {
    if (row.issuer) issuerCounts.set(row.issuer, (issuerCounts.get(row.issuer) || 0) + 1);
    const hosts = row.hostnames || row.san || [];
    for (const h of hosts) hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
    const nb = new Date(row.notBefore).getTime();
    const na = new Date(row.notAfter).getTime();
    if (Number.isFinite(nb) && Number.isFinite(na)) {
      const days = (na - nb) / 86400000;
      if (days < 7)
        anomalies.push({
          serial: row.serial,
          kind: 'short-validity',
          detail: `${Math.round(days)} day(s) validity`,
        });
      else if (days > 825)
        anomalies.push({
          serial: row.serial,
          kind: 'long-validity',
          detail: `${Math.round(days)} day(s) validity exceeds 825-day norm`,
        });
    }
  }
  const top = map =>
    [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  return {
    issuers: top(issuerCounts).map(e => ({ issuer: e.key, count: e.count })),
    hosts: top(hostCounts).map(e => ({ hostname: e.key, count: e.count })),
    anomalies,
    total: rows.length,
  };
}
