/**
 * whoisxmlIntel.js — WhoisXML bulk expansion (idea 00176).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated WhoisXML-style WHOIS/reverse-IP records and performs
 * bulk expansion across large netblocks: given a CIDR, enumerate every
 * domain whose current IP falls inside it, and given a registrant identity,
 * reverse-WHOIS to every domain ever tied to it.
 *
 * Record shape:
 *   { domain, ip, registrantOrg, registrantEmail, createdDate, netname,
 *     asn, source }
 * createdDate is ISO-8601 (or epoch ms). All functions are pure and synchronous.
 */

/**
 * Convert an IPv4 address to a 32-bit integer. Returns null for non-IPv4.
 * @param {string} ip
 * @returns {number|null}
 */
function ipToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

/**
 * Parse "a.b.c.d/n" into { network, mask } integers. Returns null if invalid.
 * @param {string} cidr
 * @returns {{ network: number, mask: number }|null}
 */
function parseCidr(cidr) {
  const m = String(cidr).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) return null;
  const base = ipToInt(m[1]);
  const bits = Number(m[2]);
  if (base == null || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { network: (base & mask) >>> 0, mask };
}

/**
 * Idea 00176 — Bulk reverse-IP expansion over a netblock.
 *
 * @param {Array<Object>} records - WHOIS/reverse-IP records.
 * @param {string} cidr - e.g. "203.0.113.0/24".
 * @returns {{ cidr: string, matched: number,
 *            domains: Array<{ domain, ip, registrantOrg, registrantEmail }> }}
 */
export function expandNetblock(records, cidr) {
  const parsed = parseCidr(cidr);
  if (!parsed) throw new Error(`Invalid CIDR: ${cidr}`);
  const seen = new Set();
  const domains = [];
  for (const r of records || []) {
    if (!r || !r.domain || !r.ip) continue;
    const n = ipToInt(String(r.ip));
    if (n == null || ((n & parsed.mask) >>> 0) !== parsed.network) continue;
    const domain = String(r.domain).toLowerCase().replace(/\.$/, '');
    const key = `${domain}|${r.ip}`;
    if (seen.has(key)) continue;
    seen.add(key);
    domains.push({
      domain,
      ip: String(r.ip),
      registrantOrg: r.registrantOrg ?? null,
      registrantEmail: r.registrantEmail ?? null,
    });
  }
  domains.sort((a, b) => a.domain.localeCompare(b.domain));
  return { cidr, matched: domains.length, domains };
}

/**
 * Idea 00176 — Reverse-WHOIS expansion by registrant identity.
 *
 * Finds every domain tied to the same registrant organization or email —
 * the classic way to map a target's full domain portfolio from one seed.
 *
 * @param {Array<Object>} records
 * @param {{ org?: string|null, email?: string|null }} identity
 * @returns {Array<{ domain, ip, matchedOn: Array<string>, createdDate }> } sorted.
 */
export function reverseWhois(records, identity = {}) {
  const org = identity.org ? String(identity.org).toLowerCase() : null;
  const email = identity.email ? String(identity.email).toLowerCase() : null;
  const out = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.domain) continue;
    const matchedOn = [];
    if (org && r.registrantOrg && String(r.registrantOrg).toLowerCase() === org) {
      matchedOn.push('org');
    }
    if (email && r.registrantEmail && String(r.registrantEmail).toLowerCase() === email) {
      matchedOn.push('email');
    }
    if (matchedOn.length === 0) continue;
    const domain = String(r.domain).toLowerCase().replace(/\.$/, '');
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({
      domain,
      ip: r.ip ? String(r.ip) : null,
      matchedOn,
      createdDate: r.createdDate ?? null,
    });
  }
  return out.sort((a, b) => b.matchedOn.length - a.matchedOn.length || a.domain.localeCompare(b.domain));
}

/**
 * Idea 00176 — Coverage summary for a bulk expansion.
 *
 * @param {Array<Object>} records
 * @returns {{ totalDomains: number, distinctIps: number, distinctOrgs: number, distinctAsns: number }}
 */
export function summarizeCoverage(records) {
  const domains = new Set();
  const ips = new Set();
  const orgs = new Set();
  const asns = new Set();
  for (const r of records || []) {
    if (!r) continue;
    if (r.domain) domains.add(String(r.domain).toLowerCase());
    if (r.ip) ips.add(String(r.ip));
    if (r.registrantOrg) orgs.add(String(r.registrantOrg).toLowerCase());
    if (r.asn != null) asns.add(String(r.asn));
  }
  return {
    totalDomains: domains.size,
    distinctIps: ips.size,
    distinctOrgs: orgs.size,
    distinctAsns: asns.size,
  };
}
