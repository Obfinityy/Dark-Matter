/**
 * domaintoolsReverseIpIntel.js — DomainTools reverse-IP mining (idea 00174).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Mines aggregated DomainTools-style reverse-IP data for co-hosted names on
 * target IPs, then rolls the results up by netblock/ASN so the agent can
 * prioritize the netblocks that concentrate the most target-adjacent names.
 *
 * Reverse-IP record shape:
 *   { ip, names: [String], asn, netname, org, source }
 * All functions are pure and synchronous.
 */

/**
 * Idea 00174 — Mine co-hosted names for a set of target IPs.
 *
 * @param {Array<Object>} records - reverse-IP records.
 * @param {Array<string>} targetIps
 * @returns {Map<string, { names: Array<string>, asn: *, netname: string|null, org: string|null }>}
 */
export function mineCoHosted(records, targetIps) {
  const wanted = new Set((targetIps || []).map(String));
  const out = new Map();
  for (const r of records || []) {
    if (!r || !wanted.has(String(r.ip))) continue;
    const ip = String(r.ip);
    if (!out.has(ip)) {
      out.set(ip, {
        names: [],
        asn: r.asn ?? null,
        netname: r.netname ?? null,
        org: r.org ?? null,
      });
    }
    const entry = out.get(ip);
    const seen = new Set(entry.names);
    for (const n of r.names || []) {
      const name = String(n).toLowerCase().replace(/\.$/, '');
      if (name && !seen.has(name)) {
        seen.add(name);
        entry.names.push(name);
      }
    }
  }
  for (const entry of out.values()) entry.names.sort();
  return out;
}

/**
 * Idea 00174 — Netblock/ASN rollup.
 *
 * Aggregates mined co-hosted names by netname (falling back to ASN) to show
 * where the target's footprint concentrates.
 *
 * @param {Map<string, Object>} mined - output of mineCoHosted.
 * @returns {Array<{ block: string, asn: *, ips: Array<string>, nameCount: number, names: Array<string> }>}
 */
export function netblockSummary(mined) {
  const groups = new Map();
  for (const [ip, entry] of mined || []) {
    const block = entry.netname || (entry.asn != null ? `AS${entry.asn}` : 'unknown');
    if (!groups.has(block)) groups.set(block, { asn: entry.asn ?? null, ips: [], names: new Set() });
    const g = groups.get(block);
    g.ips.push(ip);
    for (const n of entry.names) g.names.add(n);
  }
  return [...groups.entries()]
    .map(([block, g]) => ({
      block,
      asn: g.asn,
      ips: g.ips.sort(),
      nameCount: g.names.size,
      names: [...g.names].sort(),
    }))
    .sort((a, b) => b.nameCount - a.nameCount || a.block.localeCompare(b.block));
}

/**
 * Idea 00174 — Rank mined names by shared-infrastructure strength.
 *
 * A name seen on several of the target's IPs (or on the same netblock as
 * many of them) is more likely to belong to the target organization.
 *
 * @param {Map<string, Object>} mined - output of mineCoHosted.
 * @returns {Array<{ name: string, ipCount: number, ips: Array<string> }>} sorted desc.
 */
export function rankBySharedInfra(mined) {
  const byName = new Map();
  for (const [ip, entry] of mined || []) {
    for (const name of entry.names) {
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(ip);
    }
  }
  return [...byName.entries()]
    .map(([name, ips]) => ({ name, ipCount: ips.size, ips: [...ips].sort() }))
    .sort((a, b) => b.ipCount - a.ipCount || a.name.localeCompare(b.name));
}
