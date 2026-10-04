/**
 * dbipAsnExpansion.js — DB-IP-style org-to-ASN expansion (idea 00192).
 *
 * DB-IP's org-to-ASN mapping lists every ASN registered to an organization.
 * Seeding a hunt with one known ASN and expanding to the org's full ASN set
 * prevents blind spots: sibling ASNs often host staging, acquisitions, or
 * shadow IT. This module performs that expansion off-line from supplied
 * mapping data, with conflict flags when an ASN appears under multiple orgs.
 * All functions are pure and synchronous — no network calls.
 */

/**
 * Idea 00192 — Build an org → ASN index from raw mapping rows.
 *
 * Accepts rows shaped like DB-IP exports ({ asn, organization, country? }).
 * ASN keys are numbers; org keys are the exact strings (matching against
 * brand variants is handled by maxmindAsnOrgMatch.js).
 *
 * @param {Array<{ asn, organization, country? }>} rows
 * @returns {{ orgToAsns: Map<string, Set<number>>, asnToOrgs: Map<number, Set<string>> }}
 */
export function buildOrgAsnIndex(rows = []) {
  const orgToAsns = new Map();
  const asnToOrgs = new Map();
  for (const r of rows || []) {
    const asn = Number(r && r.asn);
    const org = String((r && r.organization) || '').trim();
    if (!Number.isFinite(asn) || !org) continue;
    if (!orgToAsns.has(org)) orgToAsns.set(org, new Set());
    orgToAsns.get(org).add(asn);
    if (!asnToOrgs.has(asn)) asnToOrgs.set(asn, new Set());
    asnToOrgs.get(asn).add(org);
  }
  return { orgToAsns, asnToOrgs };
}

/**
 * Idea 00192 — Expand a seed ASN list through org-to-ASN mappings.
 *
 * For every seed ASN, finds every org it is registered under, then pulls in
 * every sibling ASN registered to those orgs. Sibling ASNs that appear under
 * MORE than one org are flagged (registration conflict — worth a manual
 * look before assuming ownership).
 *
 * @param {Array<number|string>} seedAsns — known target ASNs
 * @param {{ orgToAsns: Map<string, Set<number>>, asnToOrgs: Map<number, Set<string>> }} index
 * @returns {{ expanded: Array<{ asn, orgs: string[], seed: boolean, conflict: boolean }>, orgs: string[], stats: { seeds, total, added } }}
 */
export function expandAsns(seedAsns = [], index) {
  const seeds = new Set(
    (seedAsns || []).map((a) => Number(a)).filter(Number.isFinite),
  );
  const orgs = new Set();
  const expanded = new Map();
  const idx = index || { orgToAsns: new Map(), asnToOrgs: new Map() };

  for (const seed of seeds) {
    const seedOrgs = idx.asnToOrgs.get(seed) || new Set();
    for (const org of seedOrgs) {
      orgs.add(org);
      for (const sibling of idx.orgToAsns.get(org) || []) {
        if (!expanded.has(sibling)) {
          const siblingOrgs = idx.asnToOrgs.get(sibling) || new Set();
          expanded.set(sibling, {
            asn: sibling,
            orgs: [...siblingOrgs].sort(),
            seed: sibling === seed,
            conflict: siblingOrgs.size > 1,
          });
        }
      }
    }
    // Seed ASN with no mapping at all: keep it, unflagged.
    if (!expanded.has(seed)) {
      expanded.set(seed, { asn: seed, orgs: [], seed: true, conflict: false });
    }
  }

  const list = [...expanded.values()].sort((a, b) => a.asn - b.asn);
  const added = list.filter((e) => !seeds.has(e.asn)).length;
  return {
    expanded: list,
    orgs: [...orgs].sort(),
    stats: { seeds: seeds.size, total: list.length, added },
  };
}

/**
 * Idea 00192 — Diff two expansion runs to find newly appeared ASNs.
 *
 * Useful when the mapping data refreshes between hunts: new ASNs under the
 * target's orgs may indicate acquisitions or new cloud regions.
 *
 * @param {number[]} previous — previously known expanded ASN list
 * @param {number[]} current — newly expanded ASN list
 * @returns {{ newAsns: number[], droppedAsns: number[] }}
 */
export function diffAsnSets(previous = [], current = []) {
  const prev = new Set(previous.map(Number).filter(Number.isFinite));
  const curr = new Set(current.map(Number).filter(Number.isFinite));
  return {
    newAsns: [...curr].filter((a) => !prev.has(a)).sort((a, b) => a - b),
    droppedAsns: [...prev].filter((a) => !curr.has(a)).sort((a, b) => a - b),
  };
}
