/**
 * ipinfoAsnIntel.js — IPinfo ASN-hostname correlation engine.
 *
 * Implements idea-bank item 00189 (IPinfo ASN-hostname correlation): correlate
 * ASN and hostname data across a set of IP intelligence records to expand
 * from known IPs to related names. IPs sharing an ASN (or an ASN org) with
 * the target are the most likely to host in-scope sibling assets — this
 * engine groups them, surfaces the org graph, and ranks hostnames for
 * follow-up enumeration.
 *
 * Pure functions: the caller supplies IP intel records (from IPinfo or any
 * IP metadata provider).
 */

/**
 * @typedef {object} IpIntelRecord
 * @property {string} ip
 * @property {string|number} [asn]
 * @property {string} [asnOrg]        e.g. 'Cloudflare, Inc.'
 * @property {string} [hostname]      reverse DNS / provider hostname
 * @property {string} [company]       hosting company if known
 * @property {string} [country]
 */

/**
 * Group IP records by ASN.
 * @param {IpIntelRecord[]} records
 * @returns {Map<string, {asn: string, orgs: string[], ips: string[], hostnames: string[]}>}
 */
export function groupByAsn(records) {
  const groups = new Map();
  for (const raw of records ?? []) {
    const ip = String(raw.ip ?? '').trim();
    if (!ip) continue;
    const asn = String(raw.asn ?? 'unknown').replace(/^AS/i, 'AS');
    let group = groups.get(asn);
    if (!group) {
      group = { asn, orgs: new Set(), ips: new Set(), hostnames: new Set() };
      groups.set(asn, group);
    }
    group.ips.add(ip);
    if (raw.asnOrg) group.orgs.add(String(raw.asnOrg));
    if (raw.company) group.orgs.add(String(raw.company));
    const host = String(raw.hostname ?? '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (host) group.hostnames.add(host);
  }
  return new Map(
    [...groups.entries()].map(([asn, g]) => [
      asn,
      {
        asn,
        orgs: [...g.orgs].sort(),
        ips: [...g.ips].sort(),
        hostnames: [...g.hostnames].sort(),
      },
    ])
  );
}

/**
 * Correlate from a seed IP set to related hostnames through shared ASNs:
 * any hostname living in the same ASN as a seed IP becomes a candidate.
 * @param {IpIntelRecord[]} records
 * @param {string[]} seedIps
 * @param {object} [opts]
 * @param {string[]} [opts.domainSuffixes]  optional in-scope suffix filter
 * @returns {Array<{hostname: string, asn: string, seedIp: string, inScope: boolean}>}
 */
export function correlateAsnHostnames(records, seedIps, opts = {}) {
  const groups = groupByAsn(records);
  const seedAsns = new Set();
  const seedSet = new Set((seedIps ?? []).map(ip => String(ip).trim()));
  for (const rec of records ?? []) {
    if (seedSet.has(String(rec.ip ?? '').trim())) {
      seedAsns.add(String(rec.asn ?? 'unknown').replace(/^AS/i, 'AS'));
    }
  }
  const suffixes = (opts.domainSuffixes ?? []).map(s => s.toLowerCase());
  const out = [];
  const seen = new Set();
  for (const asn of seedAsns) {
    const group = groups.get(asn);
    if (!group) continue;
    const seedIp = (records ?? []).find(
      r =>
        seedSet.has(String(r.ip ?? '').trim()) &&
        String(r.asn ?? 'unknown').replace(/^AS/i, 'AS') === asn
    )?.ip;
    for (const hostname of group.hostnames) {
      if (seen.has(hostname)) continue;
      seen.add(hostname);
      out.push({
        hostname,
        asn,
        seedIp: String(seedIp ?? ''),
        inScope:
          suffixes.length === 0 || suffixes.some(s => hostname === s || hostname.endsWith(`.${s}`)),
      });
    }
  }
  return out.sort(
    (a, b) => Number(b.inScope) - Number(a.inScope) || a.hostname.localeCompare(b.hostname)
  );
}

/**
 * Rank ASN groups by expansion value: many hostnames per ASN with in-scope
 * hits ranks highest — the best next hop for enumeration.
 * @param {Map<string, {asn: string, orgs: string[], ips: string[], hostnames: string[]}>} groups
 * @param {string[]} [domainSuffixes]
 * @returns {Array<{asn: string, orgs: string[], ipCount: number, hostnameCount: number, inScopeHosts: string[], score: number}>}
 */
export function rankAsnGroups(groups, domainSuffixes = []) {
  const suffixes = domainSuffixes.map(s => s.toLowerCase());
  return [...groups.values()]
    .map(g => {
      const inScopeHosts = suffixes.length
        ? g.hostnames.filter(h => suffixes.some(s => h === s || h.endsWith(`.${s}`)))
        : [];
      const score = g.hostnames.length * 2 + inScopeHosts.length * 10 + g.ips.length;
      return {
        asn: g.asn,
        orgs: g.orgs,
        ipCount: g.ips.length,
        hostnameCount: g.hostnames.length,
        inScopeHosts,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}
