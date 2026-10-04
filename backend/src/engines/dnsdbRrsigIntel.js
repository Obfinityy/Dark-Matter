/**
 * dnsdbRrsigIntel.js — DNSDB RRSIG-coverage analysis (idea 00178).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated DNSDB-style records including RRSIG (DNSSEC signature)
 * rows and finds signed names that were never observed in forward DNS —
 * zone content (often internal or forgotten hosts) that exists in the signed
 * zone but is invisible to normal enumeration.
 *
 * Record shape:
 *   { owner, type, typeCovered, signer, firstSeen, lastSeen, source }
 * where type is e.g. "RRSIG", "A", "AAAA", "CNAME" and typeCovered is the
 * type the RRSIG signs (for RRSIG rows).
 * All functions are pure and synchronous.
 */

/**
 * Idea 00178 — Collect every name that has DNSSEC signature coverage.
 *
 * @param {Array<Object>} records
 * @returns {Map<string, { signers: Set<string>, coveredTypes: Set<string> }>}
 */
export function signedNames(records) {
  const out = new Map();
  for (const r of records || []) {
    if (!r || !r.owner || String(r.type).toUpperCase() !== 'RRSIG') continue;
    const owner = String(r.owner).toLowerCase().replace(/\.$/, '');
    if (!out.has(owner)) out.set(owner, { signers: new Set(), coveredTypes: new Set() });
    const e = out.get(owner);
    if (r.signer) e.signers.add(String(r.signer).toLowerCase().replace(/\.$/, ''));
    if (r.typeCovered) e.coveredTypes.add(String(r.typeCovered).toUpperCase());
  }
  return out;
}

/**
 * Idea 00178 — Find signed names never seen in forward DNS.
 *
 * The high-value output: names the zone signs (so they exist) but that no
 * forward lookup (A/AAAA/CNAME/...) record was ever observed for — classic
 * hidden-asset candidates.
 *
 * @param {Array<Object>} records
 * @returns {Array<{ name, signers: Array<string>, coveredTypes: Array<string> }>}
 */
export function findOrphanSigned(records) {
  const signed = signedNames(records);
  const forwardSeen = new Set();
  for (const r of records || []) {
    if (!r || !r.owner) continue;
    const t = String(r.type).toUpperCase();
    if (t === 'RRSIG' || t === 'NSEC' || t === 'NSEC3' || t === 'DNSKEY') continue;
    forwardSeen.add(String(r.owner).toLowerCase().replace(/\.$/, ''));
  }
  const orphans = [];
  for (const [name, e] of signed.entries()) {
    if (forwardSeen.has(name)) continue;
    orphans.push({
      name,
      signers: [...e.signers].sort(),
      coveredTypes: [...e.coveredTypes].sort(),
    });
  }
  return orphans.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Idea 00178 — Coverage-gap summary.
 *
 * Quantifies how much of the observed namespace is signed versus orphaned,
 * so the agent can judge whether the zone's hidden surface is worth
 * deeper investigation.
 *
 * @param {Array<Object>} records
 * @returns {{ signedCount: number, forwardCount: number, orphanCount: number,
 *            orphanRatio: number }}
 */
export function coverageGaps(records) {
  const signed = signedNames(records);
  const forwardSeen = new Set();
  for (const r of records || []) {
    if (!r || !r.owner) continue;
    const t = String(r.type).toUpperCase();
    if (t === 'RRSIG' || t === 'NSEC' || t === 'NSEC3' || t === 'DNSKEY') continue;
    forwardSeen.add(String(r.owner).toLowerCase().replace(/\.$/, ''));
  }
  let orphans = 0;
  for (const name of signed.keys()) {
    if (!forwardSeen.has(name)) orphans += 1;
  }
  const signedCount = signed.size;
  return {
    signedCount,
    forwardCount: forwardSeen.size,
    orphanCount: orphans,
    orphanRatio: signedCount ? Math.round((orphans / signedCount) * 1000) / 1000 : 0,
  };
}
