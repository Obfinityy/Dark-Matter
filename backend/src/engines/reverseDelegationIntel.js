/**
 * reverseDelegationIntel.js — APNIC reverse-DNS delegation mapping.
 *
 * Implements Dark-Matter idea-bank item 00139 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00139 APNIC reverse-DNS delegation mapping — map reverse-DNS
 *      delegations in APNIC space to find delegated sub-zones with
 *      distinct hostnames.
 *
 * The caller supplies reverse-DNS zone data (NS/SOA records per
 * in-addr.arpa / ip6.arpa zone, plus delegation cuts). This engine builds
 * the delegation tree, maps every delegated sub-zone to its nameserver
 * hostnames, and flags delegations whose NS hostnames sit outside the
 * parent zone's naming pattern — distinct hostnames that reveal
 * separately-managed address space and the teams behind it.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * records. No network I/O happens in this module.
 */

/**
 * @typedef {object} ReverseZoneRecord
 * @property {string} zone          e.g. "113.0.203.in-addr.arpa"
 * @property {string[]} [ns]        authoritative nameservers for the zone
 * @property {string[]} [delegations]  child zone names delegated below this zone
 * @property {string} [soaMname]    primary master from the SOA record
 */

/** Normalise a zone name: lowercase, no trailing dot. */
function normaliseZone(z) {
  return String(z || '').trim().toLowerCase().replace(/\.+$/, '');
}

/** Normalise a hostname: lowercase, no trailing dot. */
function normaliseHost(h) {
  return String(h || '').trim().toLowerCase().replace(/\.+$/, '');
}

/**
 * Build the reverse-DNS delegation tree: zone → {ns, delegations}.
 * @param {ReverseZoneRecord[]} records
 * @returns {Map<string, {ns: string[], delegations: string[], soaMname: string|null}>}
 */
export function buildDelegationTree(records) {
  const tree = new Map();
  for (const r of records || []) {
    const zone = normaliseZone(r.zone);
    if (!zone) continue;
    tree.set(zone, {
      ns: [...new Set((r.ns || []).map(normaliseHost).filter(Boolean))].sort(),
      delegations: [...new Set((r.delegations || []).map(normaliseZone).filter(Boolean))].sort(),
      soaMname: r.soaMname ? normaliseHost(r.soaMname) : null,
    });
  }
  return tree;
}

/**
 * Walk the delegation tree from a root zone and enumerate every
 * reachable sub-zone with its depth and nameserver set.
 * @param {ReverseZoneRecord[]} records
 * @param {string} rootZone
 * @returns {Array<{zone: string, depth: number, ns: string[], soaMname: string|null}>}
 */
export function enumerateDelegations(records, rootZone) {
  const tree = buildDelegationTree(records);
  const root = normaliseZone(rootZone);
  const out = [];
  const seen = new Set([root]);
  const stack = [{ zone: root, depth: 0 }];
  while (stack.length > 0) {
    const { zone, depth } = stack.pop();
    const node = tree.get(zone);
    out.push({
      zone,
      depth,
      ns: node ? node.ns : [],
      soaMname: node ? node.soaMname : null,
    });
    for (const child of node ? node.delegations : []) {
      if (!seen.has(child)) {
        seen.add(child);
        stack.push({ zone: child, depth: depth + 1 });
      }
    }
  }
  return out.sort((a, b) => a.depth - b.depth || a.zone.localeCompare(b.zone));
}

/**
 * Find delegated sub-zones whose nameserver hostnames are "distinct" —
 * they do not share the parent zone's NS naming pattern (e.g. delegated
 * to a customer's or partner's nameservers instead of the org's own).
 * Such cuts mark separately-managed address space worth scoping.
 * @param {ReverseZoneRecord[]} records
 * @param {string} rootZone
 * @returns {Array<{zone: string, depth: number, ns: string[], parentNs: string[], reason: string}>}
 */
export function findDistinctDelegations(records, rootZone) {
  const tree = buildDelegationTree(records);
  const root = normaliseZone(rootZone);
  const rootNs = new Set((tree.get(root) || { ns: [] }).ns);
  const suffixes = (names) => names.map((n) => n.split('.').slice(-2).join('.'));
  const rootSuffixes = new Set(suffixes([...rootNs]));
  const out = [];
  for (const entry of enumerateDelegations(records, root)) {
    if (entry.zone === root) continue;
    const parentZone = entry.zone.split('.').slice(1).join('.');
    const parentNs = (tree.get(parentZone) || { ns: [] }).ns;
    if (entry.ns.length === 0) {
      out.push({ zone: entry.zone, depth: entry.depth, ns: [], parentNs, reason: 'delegation-without-NS-data' });
      continue;
    }
    const sharesSuffix = entry.ns.some((ns) => {
      const sfx = ns.split('.').slice(-2).join('.');
      return rootSuffixes.has(sfx) || parentNs.some((p) => p.split('.').slice(-2).join('.') === sfx);
    });
    if (!sharesSuffix) {
      out.push({
        zone: entry.zone,
        depth: entry.depth,
        ns: entry.ns,
        parentNs,
        reason: 'nameservers-outside-parent-naming-pattern',
      });
    }
  }
  return out;
}

/**
 * Collect every distinct nameserver hostname seen across the delegation
 * tree — the full reverse-DNS operator footprint.
 * @param {ReverseZoneRecord[]} records
 * @param {string} rootZone
 * @returns {string[]} unique NS hostnames, sorted
 */
export function delegationNsFootprint(records, rootZone) {
  const set = new Set();
  for (const entry of enumerateDelegations(records, rootZone)) {
    for (const ns of entry.ns) set.add(ns);
    if (entry.soaMname) set.add(entry.soaMname);
  }
  return [...set].sort();
}

export const REVERSE_DELEGATION_INTEL = {
  buildDelegationTree,
  enumerateDelegations,
  findDistinctDelegations,
  delegationNsFootprint,
};
export default REVERSE_DELEGATION_INTEL;
