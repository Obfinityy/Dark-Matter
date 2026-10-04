/**
 * netlasSanIntel.js — Netlas certificate SAN pivoting engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given Netlas API certificate/search
 * rows the caller fetched legally during an authorized engagement, extract
 * certificate Subject Alternative Names (SANs) per target IP and find
 * co-hosted domains — other names served from the same infrastructure.
 * Covers idea-bank item 00161:
 *
 *  00161 Netlas certificate SAN pull — pull SAN lists from Netlas for target
 *        IPs to find co-hosted domains.
 *
 * All functions are pure and side-effect free. The engine never queries the
 * network: the caller supplies already-fetched Netlas response data, so the
 * module stays testable and safe to run anywhere.
 */

/**
 * Normalize one Netlas result row into a canonical certificate record.
 * Accepts Netlas API shapes (`data` wrappers) and already-flattened objects.
 *
 * @param {object} entry
 * @returns {{ip: string|null, dnsNames: string[], issuer: string|null, validTo: string|null}}
 */
export function normalizeNetlasEntry(entry) {
  if (!entry || typeof entry !== 'object') return { ip: null, dnsNames: [], issuer: null, validTo: null };
  const data = entry.data && typeof entry.data === 'object' ? entry.data : entry;
  const ip = typeof entry.ip === 'string' ? entry.ip
    : typeof data.ip === 'string' ? data.ip : null;
  const rawNames = data.dns_names ?? data.san ?? data.subject_alt_names ?? [];
  const dnsNames = (Array.isArray(rawNames) ? rawNames : [rawNames])
    .filter((n) => typeof n === 'string')
    .map((n) => n.trim().replace(/^\*\./, '').toLowerCase())
    .filter((n) => n.length > 0 && !n.startsWith('*'));
  const issuer = typeof data.issuer_name === 'string' ? data.issuer_name
    : (data.issuer && typeof data.issuer === 'object' && typeof data.issuer.organization === 'string' ? data.issuer.organization : null);
  const validTo = typeof data.valid_to === 'string' ? data.valid_to : null;
  return { ip, dnsNames: [...new Set(dnsNames)], issuer, validTo };
}

/**
 * Pull SAN lists per IP from a batch of Netlas rows (idea 00161).
 *
 * @param {object[]} rows Raw Netlas rows for the target IPs.
 * @returns {{byIp: {ip: string, dnsNames: string[], certCount: number}[], allNames: string[]}}
 */
export function pullSanLists(rows) {
  const perIp = new Map();
  for (const raw of rows || []) {
    const e = normalizeNetlasEntry(raw);
    if (!e.ip) continue;
    const cur = perIp.get(e.ip) || { ip: e.ip, dnsNames: new Set(), certCount: 0 };
    cur.certCount += 1;
    for (const n of e.dnsNames) cur.dnsNames.add(n);
    perIp.set(e.ip, cur);
  }
  const byIp = [...perIp.values()].map((g) => ({
    ip: g.ip,
    dnsNames: [...g.dnsNames].sort(),
    certCount: g.certCount,
  }));
  const allNames = [...new Set(byIp.flatMap((g) => g.dnsNames))].sort();
  return { byIp, allNames };
}

/**
 * Find co-hosted domains: SANs that are NOT already-known target domains.
 * Wildcard parents and the queried IPs' reverse names are excluded from the
 * "new" set so the signal is limited to genuinely discovered assets.
 *
 * @param {{ip: string, dnsNames: string[]}[]} byIp Output of pullSanLists.
 * @param {string[]} knownDomains Domains the engagement already covers.
 * @returns {{newDomains: {domain: string, ips: string[]}[], knownCount: number}}
 */
export function findCoHostedDomains(byIp, knownDomains = []) {
  const known = new Set((knownDomains || []).map((d) => String(d).trim().replace(/^\*\./, '').toLowerCase()));
  const perDomain = new Map();
  let knownCount = 0;
  for (const g of byIp || []) {
    for (const name of g.dnsNames || []) {
      if (known.has(name) || [...known].some((k) => name.endsWith('.' + k))) { knownCount++; continue; }
      const cur = perDomain.get(name) || { domain: name, ips: [] };
      if (!cur.ips.includes(g.ip)) cur.ips.push(g.ip);
      perDomain.set(name, cur);
    }
  }
  const newDomains = [...perDomain.values()].sort((a, b) => b.ips.length - a.ips.length || a.domain.localeCompare(b.domain));
  return { newDomains, knownCount };
}

/**
 * Build a short human-readable pivot report.
 *
 * @param {{byIp?: object[], allNames?: string[]}} sanResult
 * @param {{newDomains?: object[]}} coHostResult
 * @returns {{ipsScanned: number, uniqueNames: number, newDomains: number, summary: string}}
 */
export function netlasSanReport(sanResult = {}, coHostResult = {}) {
  const ipsScanned = (sanResult.byIp || []).length;
  const uniqueNames = (sanResult.allNames || []).length;
  const newDomains = (coHostResult.newDomains || []).length;
  const summary = newDomains === 0
    ? `Scanned ${ipsScanned} target IP(s) via Netlas certificate data; all ${uniqueNames} discovered SAN name(s) were already in scope.`
    : `Netlas certificate SAN pull surfaced ${newDomains} co-hosted domain(s) not previously in scope across ${ipsScanned} target IP(s).`;
  return { ipsScanned, uniqueNames, newDomains, summary };
}

export default {
  normalizeNetlasEntry,
  pullSanLists,
  findCoHostedDomains,
  netlasSanReport,
};
