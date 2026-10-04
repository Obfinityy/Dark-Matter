/**
 * securitytrailsIntel.js — SecurityTrails reverse-IP expansion (idea 00171).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated SecurityTrails-style reverse-IP records and expands a
 * seed IP into its co-hosted domains, then filters and ranks the expansion
 * by organizational signals (registrant, hosting org, ASN, nameserver
 * overlap) so the agent chases same-org assets instead of unrelated tenants.
 *
 * Reverse-IP record shape:
 *   { ip, domains: [String], org, asn, nameservers: [String], source }
 * All functions are pure and synchronous.
 */

/**
 * Normalize a domain for comparison (lowercase, strip trailing dot).
 * @param {string} d
 * @returns {string}
 */
function normDomain(d) {
  return String(d || '').trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Idea 00171 — Reverse-IP expansion.
 *
 * Given aggregated reverse-IP records, expand a seed IP into every
 * co-hosted domain seen on it (deduped, seed's own domains excluded).
 *
 * @param {Array<Object>} records - reverse-IP records.
 * @param {string} seedIp - the target IP to expand.
 * @param {{ excludeDomains?: Array<string> }} [opts]
 * @returns {Array<{ domain: string, ip: string, org: string|null, asn: string|number|null }>}
 */
export function expandReverseIp(records, seedIp, opts = {}) {
  const exclude = new Set((opts.excludeDomains || []).map(normDomain));
  const out = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || String(r.ip) !== String(seedIp)) continue;
    for (const d of r.domains || []) {
      const domain = normDomain(d);
      if (!domain || exclude.has(domain) || seen.has(domain)) continue;
      seen.add(domain);
      out.push({ domain, ip: String(r.ip), org: r.org ?? null, asn: r.asn ?? null });
    }
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain));
}

/**
 * Idea 00171 — Organization-signal filtering.
 *
 * Score each expanded domain against the seed's organizational signals.
 * A domain earns points when its hosting org, ASN, or nameserver footprint
 * overlaps the seed's — those are the assets most likely owned by the same
 * organization and therefore in scope for the hunt.
 *
 * @param {Array<Object>} expanded - output of expandReverseIp (with
 *   nameservers attached where available).
 * @param {{ org?: string|null, asn?: string|number|null, nameservers?: Array<string> }} seedSignals
 * @param {{ minScore?: number }} [opts]
 * @returns {Array<{ domain: string, score: number, signals: Array<string> }>} sorted desc.
 */
export function filterByOrgSignals(expanded, seedSignals = {}, opts = {}) {
  const minScore = opts.minScore ?? 1;
  const seedNs = new Set((seedSignals.nameservers || []).map(normDomain));
  const scored = [];
  for (const e of expanded || []) {
    let score = 0;
    const signals = [];
    if (seedSignals.org && e.org && String(e.org).toLowerCase() === String(seedSignals.org).toLowerCase()) {
      score += 3; signals.push('same-hosting-org');
    }
    if (seedSignals.asn != null && e.asn != null && String(e.asn) === String(seedSignals.asn)) {
      score += 2; signals.push('same-asn');
    }
    const nsOverlap = (e.nameservers || []).map(normDomain).filter((ns) => seedNs.has(ns));
    if (nsOverlap.length > 0) {
      score += nsOverlap.length >= 2 ? 2 : 1;
      signals.push(`shared-nameserver:${nsOverlap.slice(0, 3).join(',')}`);
    }
    if (score >= minScore) scored.push({ domain: e.domain, score, signals });
  }
  return scored.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}

/**
 * Idea 00171 — End-to-end expansion pipeline: expand, then rank by org signals.
 *
 * @param {Array<Object>} records
 * @param {string} seedIp
 * @param {Object} seedSignals
 * @param {Object} [opts]
 * @returns {{ total: number, ranked: Array, unranked: Array<string> }}
 */
export function expandAndRank(records, seedIp, seedSignals = {}, opts = {}) {
  const expanded = expandReverseIp(records, seedIp, opts);
  const ranked = filterByOrgSignals(expanded, seedSignals, opts);
  const rankedSet = new Set(ranked.map((r) => r.domain));
  return {
    total: expanded.length,
    ranked,
    unranked: expanded.filter((e) => !rankedSet.has(e.domain)).map((e) => e.domain),
  };
}
