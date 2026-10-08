/**
 * ixParticipantIntel.js — PeeringDB IX participant pivoting for partner networks.
 *
 * Implements Dark-Matter idea-bank item 00136 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00136 PeeringDB IX participant pivoting — list co-participants at the
 *      same exchanges to find partner networks worth pivoting into.
 *
 * Networks that peer at the same Internet exchange often share transit
 * providers, customers, and infrastructure. The caller supplies IX records
 * (PeeringDB `ix` objects with their participant lists). This engine finds
 * every exchange the target's ASNs attend, lists the co-participants,
 * scores them by how many exchanges they share with the target, and
 * surfaces the strongest partner-network candidates for analyst pivoting.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * records. No network I/O happens in this module.
 */

/**
 * @typedef {object} IxRecord
 * @property {number} [ix_id]
 * @property {string} [name]
 * @property {string} [city]
 * @property {string} [country]
 * @property {Array<{asn: number, org?: string, name?: string, ipaddr4?: string, ipaddr6?: string, speed?: number}>} [participants]
 */

/**
 * Build the target's exchange attendance map: for each target ASN, the
 * IXes it peers at (with city/country context).
 * @param {IxRecord[]} ixes
 * @param {number[]} targetAsns
 * @returns {Array<{asn: number, exchanges: Array<{ixId: number|null, name: string, city: string|null, country: string|null}>}>}
 */
export function targetExchangeAttendance(ixes, targetAsns) {
  const targets = new Set(targetAsns || []);
  const byAsn = new Map();
  for (const ix of ixes || []) {
    for (const p of ix.participants || []) {
      if (!targets.has(p.asn)) continue;
      if (!byAsn.has(p.asn)) byAsn.set(p.asn, []);
      byAsn.get(p.asn).push({
        ixId: ix.ix_id ?? null,
        name: ix.name || `ix-${ix.ix_id ?? 'unknown'}`,
        city: ix.city || null,
        country: ix.country || null,
      });
    }
  }
  return [...byAsn.entries()].map(([asn, exchanges]) => ({ asn, exchanges }));
}

/**
 * Pivot on shared exchanges: for each target ASN, rank every other
 * participant by how many of the target's exchanges they also attend.
 * A high shared-exchange count marks a strong partner-network candidate.
 * @param {IxRecord[]} ixes
 * @param {number[]} targetAsns
 * @returns {Array<{asn: number, org: string|null, name: string|null, sharedExchanges: number, exchangeNames: string[], totalExchanges: number, affinity: number}>}
 */
export function pivotCoParticipants(ixes, targetAsns) {
  const targets = new Set(targetAsns || []);
  // ixKey -> participants (excluding targets)
  const coParticipants = new Map(); // asn -> {org, name, shared:Set(ixKey), total:Set(ixKey)}
  const targetIxKeys = new Map(); // asn -> Set(ixKey)

  for (const ix of ixes || []) {
    const ixKey = ix.ix_id ?? ix.name ?? 'unknown';
    const ixName = ix.name || `ix-${ix.ix_id ?? 'unknown'}`;
    const parts = ix.participants || [];
    const targetHere = parts.some(p => targets.has(p.asn));
    for (const p of parts) {
      if (targets.has(p.asn)) {
        if (!targetIxKeys.has(p.asn)) targetIxKeys.set(p.asn, new Set());
        targetIxKeys.get(p.asn).add(ixKey);
      } else if (targetHere) {
        if (!coParticipants.has(p.asn)) {
          coParticipants.set(p.asn, {
            asn: p.asn,
            org: p.org || null,
            name: p.name || null,
            shared: new Set(),
            exchangeNames: new Set(),
            total: new Set(),
          });
        }
        const entry = coParticipants.get(p.asn);
        entry.shared.add(ixKey);
        entry.exchangeNames.add(ixName);
      }
    }
  }
  // Count total exchanges per co-participant (across all supplied IX records).
  for (const ix of ixes || []) {
    const ixKey = ix.ix_id ?? ix.name ?? 'unknown';
    for (const p of ix.participants || []) {
      const entry = coParticipants.get(p.asn);
      if (entry) entry.total.add(ixKey);
    }
  }

  const targetIxCount = [...targetIxKeys.values()].reduce((n, s) => n + s.size, 0) || 1;
  return [...coParticipants.values()]
    .map(e => ({
      asn: e.asn,
      org: e.org,
      name: e.name,
      sharedExchanges: e.shared.size,
      exchangeNames: [...e.exchangeNames].sort(),
      totalExchanges: e.total.size,
      affinity: Math.round((e.shared.size / targetIxCount) * 1000) / 1000,
    }))
    .sort((a, b) => b.sharedExchanges - a.sharedExchanges || b.affinity - a.affinity);
}

/**
 * Summarise which exchanges connect the target most densely with partner
 * networks — the highest-leverage peering points for pivot work.
 * @param {IxRecord[]} ixes
 * @param {number[]} targetAsns
 * @returns {Array<{ixId: number|null, name: string, city: string|null, country: string|null, targetAsns: number[], coParticipantCount: number}>}
 */
export function peeringDensityByIx(ixes, targetAsns) {
  const targets = new Set(targetAsns || []);
  const out = [];
  for (const ix of ixes || []) {
    const parts = ix.participants || [];
    const targetHere = parts.filter(p => targets.has(p.asn)).map(p => p.asn);
    if (targetHere.length === 0) continue;
    out.push({
      ixId: ix.ix_id ?? null,
      name: ix.name || `ix-${ix.ix_id ?? 'unknown'}`,
      city: ix.city || null,
      country: ix.country || null,
      targetAsns: [...new Set(targetHere)].sort((a, b) => a - b),
      coParticipantCount: parts.filter(p => !targets.has(p.asn)).length,
    });
  }
  return out.sort((a, b) => b.coParticipantCount - a.coParticipantCount);
}

export const IX_PARTICIPANT_INTEL = {
  targetExchangeAttendance,
  pivotCoParticipants,
  peeringDensityByIx,
};
export default IX_PARTICIPANT_INTEL;
