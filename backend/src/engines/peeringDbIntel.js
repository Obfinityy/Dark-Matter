/**
 * peeringDbIntel.js — PeeringDB network record mining for exchange/facility intel.
 *
 * Implements Dark-Matter idea-bank item 00135 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00135 PeeringDB network record mining — extract PeeringDB net entries
 *      for the org's ASNs to find exchange points and facility hints.
 *
 * The caller supplies PeeringDB `net` API records (or simplified objects)
 * for the target's ASNs. This engine normalises them into exchange-point
 * and facility inventories: which Internet exchanges the org peers at,
 * which facilities host their gear (city/country hints), announced
 * prefixes, and inferred peering policy signals — infrastructure intel
 * for scoping the rest of the hunt.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * records. No network I/O happens in this module.
 */

/**
 * @typedef {object} PeeringDbNet
 * @property {number} asn
 * @property {string} [name]
 * @property {string} [aka]
 * @property {string} [website]
 * @property {string} [policy_general]
 * @property {string} [info_prefixes4]
 * @property {string} [info_prefixes6]
 * @property {Array<{ix_id?: number, ix_name?: string, city?: string, country?: string, speed?: number, ipaddr4?: string, ipaddr6?: string}>} [netixlan_set]
 * @property {Array<{fac_id?: number, fac_name?: string, city?: string, country?: string, address1?: string}>} [netfac_set]
 */

/**
 * Normalise one PeeringDB net record into a canonical profile.
 * @param {PeeringDbNet} net
 * @returns {{asn: number|null, name: string|null, aka: string|null, website: string|null, policy: string|null, prefixes: string[], exchanges: Array<{ixId: number|null, name: string, city: string|null, country: string|null, speedMbps: number|null, ip4: string|null, ip6: string|null}>, facilities: Array<{facId: number|null, name: string, city: string|null, country: string|null, address: string|null}>}}
 */
export function normaliseNetRecord(net) {
  const exchanges = (net.netixlan_set || []).map(x => ({
    ixId: x.ix_id ?? null,
    name: x.ix_name || `ix-${x.ix_id ?? 'unknown'}`,
    city: x.city || null,
    country: x.country || null,
    speedMbps: x.speed ?? null,
    ip4: x.ipaddr4 || null,
    ip6: x.ipaddr6 || null,
  }));
  const facilities = (net.netfac_set || []).map(f => ({
    facId: f.fac_id ?? null,
    name: f.fac_name || `fac-${f.fac_id ?? 'unknown'}`,
    city: f.city || null,
    country: f.country || null,
    address: f.address1 || null,
  }));
  const prefixes = String(net.info_prefixes4 || net.info_prefixes6 || '')
    .split(/[\s,;]+/)
    .map(p => p.trim())
    .filter(p => /^([0-9a-fA-F.:]+\/\d{1,3})$/.test(p));
  return {
    asn: net.asn ?? null,
    name: net.name || null,
    aka: net.aka || null,
    website: net.website || null,
    policy: net.policy_general || null,
    prefixes,
    exchanges,
    facilities,
  };
}

/**
 * Build the org's exchange-point footprint across its ASNs: every IX the
 * org peers at, which ASNs are present there, and city/country hints.
 * @param {PeeringDbNet[]} nets
 * @returns {Array<{ixId: number|null, name: string, city: string|null, country: string|null, asns: number[], peerIp4: string[], peerIp6: string[]}>}
 */
export function exchangePointFootprint(nets) {
  const byIx = new Map();
  for (const net of nets || []) {
    const n = normaliseNetRecord(net);
    for (const x of n.exchanges) {
      const key = x.ixId ?? x.name;
      if (!byIx.has(key)) {
        byIx.set(key, {
          ixId: x.ixId,
          name: x.name,
          city: x.city,
          country: x.country,
          asns: new Set(),
          peerIp4: new Set(),
          peerIp6: new Set(),
        });
      }
      const entry = byIx.get(key);
      if (n.asn != null) entry.asns.add(n.asn);
      if (x.ip4) entry.peerIp4.add(x.ip4);
      if (x.ip6) entry.peerIp6.add(x.ip6);
    }
  }
  return [...byIx.values()]
    .map(e => ({
      ...e,
      asns: [...e.asns].sort((a, b) => a - b),
      peerIp4: [...e.peerIp4].sort(),
      peerIp6: [...e.peerIp6].sort(),
    }))
    .sort((a, b) => b.asns.length - a.asns.length || a.name.localeCompare(b.name));
}

/**
 * Build the facility footprint: datacenters/PoPs where the org's gear
 * sits, with city/country/address hints for physical correlation.
 * @param {PeeringDbNet[]} nets
 * @returns {Array<{facId: number|null, name: string, city: string|null, country: string|null, address: string|null, asns: number[]}>}
 */
export function facilityFootprint(nets) {
  const byFac = new Map();
  for (const net of nets || []) {
    const n = normaliseNetRecord(net);
    for (const f of n.facilities) {
      const key = f.facId ?? f.name;
      if (!byFac.has(key)) {
        byFac.set(key, {
          facId: f.facId,
          name: f.name,
          city: f.city,
          country: f.country,
          address: f.address,
          asns: new Set(),
        });
      }
      if (n.asn != null) byFac.get(key).asns.add(n.asn);
    }
  }
  return [...byFac.values()]
    .map(e => ({ ...e, asns: [...e.asns].sort((a, b) => a - b) }))
    .sort(
      (a, b) =>
        (a.country || '').localeCompare(b.country || '') ||
        (a.city || '').localeCompare(b.city || '')
    );
}

/**
 * Extract the union of prefixes the org declares across its PeeringDB
 * net records — a seed list for prefix-level sweeping.
 * @param {PeeringDbNet[]} nets
 * @returns {string[]} unique declared prefixes, sorted
 */
export function declaredPrefixes(nets) {
  const set = new Set();
  for (const net of nets || []) {
    for (const p of normaliseNetRecord(net).prefixes) set.add(p);
  }
  return [...set].sort();
}

export const PEERINGDB_INTEL = {
  normaliseNetRecord,
  exchangePointFootprint,
  facilityFootprint,
  declaredPrefixes,
};
export default PEERINGDB_INTEL;
