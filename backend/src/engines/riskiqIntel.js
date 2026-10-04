/**
 * riskiqIntel.js — RiskIQ passive-DNS pivoting (idea 00172).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated RiskIQ/Microsoft-style passive-DNS resolution records
 * and pivots from a seed domain across shared resolutions to expand the
 * target's asset graph, then surfaces shared-infrastructure clusters where
 * several seed-related names resolve to the same IPs.
 *
 * Resolution record shape:
 *   { name, ip, firstSeen, lastSeen, type, source }
 * All functions are pure and synchronous.
 */

/**
 * Idea 00172 — Build a bidirectional resolution graph.
 *
 * @param {Array<Object>} records - passive-DNS resolutions.
 * @returns {{ nameToIps: Map<string, Set<string>>, ipToNames: Map<string, Set<string>> }}
 */
export function buildResolutionGraph(records) {
  const nameToIps = new Map();
  const ipToNames = new Map();
  for (const r of records || []) {
    if (!r || !r.name || !r.ip) continue;
    const name = String(r.name).toLowerCase().replace(/\.$/, '');
    const ip = String(r.ip);
    if (!nameToIps.has(name)) nameToIps.set(name, new Set());
    if (!ipToNames.has(ip)) ipToNames.set(ip, new Set());
    nameToIps.get(name).add(ip);
    ipToNames.get(ip).add(name);
  }
  return { nameToIps, ipToNames };
}

/**
 * Idea 00172 — Pivot outward from a seed domain across shared resolutions.
 *
 * BFS over name <-> IP edges: from the seed's IPs to every name resolving
 * to them, then to those names' other IPs, up to maxDepth name-hops.
 *
 * @param {{ nameToIps: Map, ipToNames: Map }} graph - from buildResolutionGraph.
 * @param {string} seedDomain
 * @param {{ maxDepth?: number }} [opts]
 * @returns {{ names: Array<{ name: string, depth: number, viaIps: Array<string> }>,
 *            ips: Array<{ ip: string, names: Array<string> }> }}
 */
export function pivotFromSeed(graph, seedDomain, opts = {}) {
  const maxDepth = opts.maxDepth ?? 2;
  const seed = String(seedDomain).toLowerCase().replace(/\.$/, '');
  const { nameToIps, ipToNames } = graph;
  const visitedNames = new Map([[seed, { depth: 0, viaIps: [] }]]);
  const frontier = [seed];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const next = [];
    for (const name of frontier) {
      const ips = [...(nameToIps.get(name) || [])];
      for (const ip of ips) {
        for (const peer of ipToNames.get(ip) || []) {
          if (visitedNames.has(peer)) continue;
          visitedNames.set(peer, { depth: depth + 1, viaIps: [ip] });
          next.push(peer);
        }
      }
    }
    frontier.length = 0;
    frontier.push(...next);
    depth += 1;
  }

  const names = [...visitedNames.entries()]
    .filter(([n]) => n !== seed)
    .map(([name, v]) => ({ name, depth: v.depth, viaIps: v.viaIps }))
    .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  const ipSet = new Set();
  for (const n of visitedNames.keys()) {
    for (const ip of nameToIps.get(n) || []) ipSet.add(ip);
  }
  const ips = [...ipSet].map((ip) => ({
    ip,
    names: [...(ipToNames.get(ip) || [])].filter((n) => visitedNames.has(n)),
  }));
  return { names, ips };
}

/**
 * Idea 00172 — Find shared-infrastructure clusters.
 *
 * Groups IPs that host multiple distinct apex-relevant names; clusters with
 * several names on one IP are the strongest pivot anchors for the agent.
 *
 * @param {{ nameToIps: Map, ipToNames: Map }} graph
 * @param {{ minNames?: number }} [opts]
 * @returns {Array<{ ip: string, names: Array<string>, size: number }>} sorted desc.
 */
export function findInfrastructureClusters(graph, opts = {}) {
  const minNames = opts.minNames ?? 2;
  const { ipToNames } = graph;
  const clusters = [];
  for (const [ip, names] of ipToNames.entries()) {
    if (names.size >= minNames) {
      clusters.push({ ip, names: [...names].sort(), size: names.size });
    }
  }
  return clusters.sort((a, b) => b.size - a.size || a.ip.localeCompare(b.ip));
}
