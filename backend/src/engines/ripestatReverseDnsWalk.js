/**
 * ripestatReverseDnsWalk.js — RIPEstat reverse-DNS chain walking (idea 00196).
 *
 * Walking reverse DNS from a netblock toward the target often surfaces
 * delegated sub-zones: ISP-style `customer-1234.provider.net` PTRs, or
 * internal naming schemes that leak structure. This module processes
 * reverse-DNS lookup chains off-line and flags delegation patterns and
 * sub-zone candidates worth enumerating.
 * All functions are pure and synchronous — no network calls.
 */

/** PTR suffixes typical of provider-managed / delegated addressing. */
const DELEGATION_HINT_RE =
  /\b(dyn|dhcp|dynamic|pool|dsl|fiber|ftth|cable|cust|client|user|host|node|residential|static|business|corp|vpn|nat|ppp|pppoe|adsl|wifi|wireless)\b/i;
const INTERNAL_HINT_RE =
  /\b(intra|internal|corp|mgmt|admin|ops|dc\d*|prod|stage|dev|test|lab|backup|mon|vpn|bastion|jump)\b/i;

/**
 * Idea 00196 — Classify a single PTR hostname.
 *
 * @param {string} ptr — reverse-DNS hostname
 * @returns {{ ptr, delegation: boolean, internal: boolean, labels: string[] }}
 */
export function classifyPtr(ptr = '') {
  const name = String(ptr || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const labels = name ? name.split('.') : [];
  return {
    ptr: name || null,
    delegation: DELEGATION_HINT_RE.test(name),
    internal: INTERNAL_HINT_RE.test(name),
    labels,
  };
}

/**
 * Idea 00196 — Walk a reverse-DNS chain and find delegated sub-zones.
 *
 * Accepts an ordered chain of PTR observations for one netblock
 * ([{ ip, ptr }]) and groups PTRs by their parent zone (last two labels),
 * surfacing zones where many distinct host patterns live — classic
 * sub-delegation worth expanding.
 *
 * @param {Array<{ ip, ptr }>} chain
 * @param {number} [minHosts] — minimum hosts to flag a sub-zone (default 3)
 * @returns {{ zones: Array<{ zone, hosts: Array<{ip, ptr}>, delegationHits, internalHits, subZoneCandidate: boolean }>, stats: { walked, withPtr, zones } }}
 */
export function walkReverseDnsChain(chain = [], minHosts = 3) {
  const byZone = new Map();
  let withPtr = 0;
  for (const o of chain || []) {
    if (!o || !o.ip) continue;
    const cls = classifyPtr(o.ptr);
    if (!cls.ptr) continue;
    withPtr++;
    const parts = cls.labels;
    const zone = parts.length >= 2 ? parts.slice(-2).join('.') : cls.ptr;
    if (!byZone.has(zone)) {
      byZone.set(zone, { zone, hosts: [], delegationHits: 0, internalHits: 0 });
    }
    const z = byZone.get(zone);
    z.hosts.push({ ip: String(o.ip), ptr: cls.ptr });
    if (cls.delegation) z.delegationHits++;
    if (cls.internal) z.internalHits++;
  }
  const zones = [...byZone.values()].map(z => ({
    ...z,
    subZoneCandidate: z.hosts.length >= minHosts && (z.delegationHits > 0 || z.internalHits > 0),
  }));
  zones.sort((a, b) => b.hosts.length - a.hosts.length);
  return {
    zones,
    stats: { walked: (chain || []).length, withPtr, zones: zones.length },
  };
}

/**
 * Idea 00196 — Extract likely sub-zone roots from PTR sets.
 *
 * Given raw PTR hostnames, derives candidate zone roots by trimming the
 * left-most label when the remaining suffix repeats across hosts — e.g.
 * `web1.eu-frankfurt.target-infra.net` and `db2.eu-frankfurt.target-infra.net`
 * yield candidate `eu-frankfurt.target-infra.net`.
 *
 * @param {string[]} ptrs
 * @param {number} [minShared] — minimum hosts sharing a suffix (default 2)
 * @returns {string[]} candidate zone roots, longest first
 */
export function extractSubZoneRoots(ptrs = [], minShared = 2) {
  const counts = new Map();
  for (const raw of ptrs || []) {
    const name = String(raw || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const labels = name.split('.').filter(Boolean);
    if (labels.length < 3) continue;
    const suffix = labels.slice(1).join('.');
    counts.set(suffix, (counts.get(suffix) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minShared)
    .sort((a, b) => b[0].length - a[0].length || b[1] - a[1])
    .map(([suffix]) => suffix);
}
