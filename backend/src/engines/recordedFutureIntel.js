/**
 * recordedFutureIntel.js — Recorded Future domain-risk pivoting (idea 00173).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated domain-intel records (risk scores, registration dates,
 * registrar/nameserver footprints) and pivots on domain-risk signals to find
 * lookalike domains registered around the same campaigns as a seed domain —
 * the classic footprint of phishing kits and campaign infrastructure that an
 * authorized defender wants mapped.
 *
 * Domain-intel record shape:
 *   { domain, riskScore, registeredAt, registrar, nameservers: [String],
 *     campaign, source }
 * registeredAt is an ISO-8601 date string (or epoch ms).
 * All functions are pure and synchronous.
 */

/**
 * Simple normalized string similarity (0-1) for domain labels.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function labelSimilarity(a, b) {
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  if (x === y) return 1;
  const tokens = s => new Set(s.split(/[^a-z0-9]+/).filter(Boolean));
  const tx = tokens(x);
  const ty = tokens(y);
  if (tx.size === 0 || ty.size === 0) return 0;
  let inter = 0;
  for (const t of tx) if (ty.has(t)) inter += 1;
  return inter / Math.max(tx.size, ty.size);
}

/**
 * @param {string|number} ts
 * @returns {number} epoch ms or 0.
 */
function toMs(ts) {
  if (typeof ts === 'number') return ts;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Idea 00173 — Lookalike-domain pivoting.
 *
 * Finds domains whose names resemble the seed's and that were registered
 * within ±windowDays of the seed's registration — a strong signal that the
 * same campaign registered them together. Risk scores weight the ranking.
 *
 * @param {Array<Object>} records - domain-intel records.
 * @param {string} seedDomain
 * @param {{ windowDays?: number, minSimilarity?: number }} [opts]
 * @returns {Array<{ domain, registeredAt, riskScore, similarity, daysApart, campaign }>}
 */
export function findLookalikes(records, seedDomain, opts = {}) {
  const windowMs = (opts.windowDays ?? 14) * 24 * 3600 * 1000;
  const minSimilarity = opts.minSimilarity ?? 0.4;
  const seed = String(seedDomain).toLowerCase().replace(/\.$/, '');
  const seedRec = (records || []).find(
    r => r && String(r.domain).toLowerCase().replace(/\.$/, '') === seed
  );
  const seedMs = seedRec ? toMs(seedRec.registeredAt) : 0;
  const out = [];
  for (const r of records || []) {
    if (!r || !r.domain) continue;
    const domain = String(r.domain).toLowerCase().replace(/\.$/, '');
    if (domain === seed) continue;
    const similarity = labelSimilarity(domain, seed);
    if (similarity < minSimilarity) continue;
    const ms = toMs(r.registeredAt);
    const daysApart = seedMs && ms ? Math.abs(ms - seedMs) / (24 * 3600 * 1000) : null;
    if (seedMs && ms && Math.abs(ms - seedMs) > windowMs) continue;
    out.push({
      domain,
      registeredAt: r.registeredAt ?? null,
      riskScore: r.riskScore ?? null,
      similarity: Math.round(similarity * 100) / 100,
      daysApart: daysApart == null ? null : Math.round(daysApart * 10) / 10,
      campaign: r.campaign ?? null,
    });
  }
  return out.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0) || b.similarity - a.similarity);
}

/**
 * Idea 00173 — Campaign clustering.
 *
 * Groups records by campaign tag (falling back to registrar + nameserver
 * footprint when no campaign tag exists) so the agent can see the full
 * campaign footprint at a glance.
 *
 * @param {Array<Object>} records
 * @returns {Array<{ key: string, domains: Array<string>, avgRisk: number|null, size: number }>}
 */
export function campaignClusters(records) {
  const groups = new Map();
  for (const r of records || []) {
    if (!r || !r.domain) continue;
    const key = r.campaign
      ? `campaign:${r.campaign}`
      : `infra:${(r.registrar || 'unknown').toLowerCase()}|${
          (r.nameservers || [])
            .map(n => String(n).toLowerCase())
            .sort()
            .join(',') || 'no-ns'
        }`;
    if (!groups.has(key)) groups.set(key, { domains: [], risks: [] });
    const g = groups.get(key);
    g.domains.push(String(r.domain).toLowerCase());
    if (typeof r.riskScore === 'number') g.risks.push(r.riskScore);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      domains: [...new Set(g.domains)].sort(),
      avgRisk: g.risks.length
        ? Math.round((g.risks.reduce((a, b) => a + b, 0) / g.risks.length) * 10) / 10
        : null,
      size: new Set(g.domains).size,
    }))
    .sort((a, b) => b.size - a.size || (b.avgRisk ?? 0) - (a.avgRisk ?? 0));
}
