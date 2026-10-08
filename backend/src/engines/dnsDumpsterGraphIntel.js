/**
 * dnsDumpsterGraphIntel.js — DNSDumpster-style mapping graph expansion engine.
 *
 * Implements idea-bank item 00183 (DNSDumpster graph expansion): treat a
 * DNS mapping result (hosts, MX/TXT records, netblocks) as a seed graph and
 * recursively expand each discovered host. Expansion edges are derived from
 * observed relationships (shared netblock, shared MX/TXT, CNAME chains) that
 * the caller passes in as an adjacency map — the engine stays pure and
 * network-free; fetching and neighbor extraction belong to the caller.
 */

/**
 * @typedef {Object<string, Array<{target: string, relation: string}>>} HostAdjacency
 *   host → neighbors with a relation label such as 'netblock', 'mx', 'cname', 'txt'.
 */

/**
 * Breadth-first expansion from seed hosts across the adjacency graph.
 * @param {string[]} seeds            starting hostnames
 * @param {HostAdjacency} adjacency   known host relationships
 * @param {object} [opts]
 * @param {number} [opts.maxDepth=2]  hop limit from any seed
 * @param {number} [opts.maxNodes=500] hard cap on discovered nodes
 * @returns {{nodes: Array<{host: string, depth: number, via: string|null, relation: string|null}>, edges: Array<{from: string, to: string, relation: string}>}}
 */
export function expandGraph(seeds, adjacency = {}, opts = {}) {
  const maxDepth = opts.maxDepth ?? 2;
  const maxNodes = opts.maxNodes ?? 500;
  const seen = new Set();
  const edges = [];
  const queue = [];

  for (const seed of seeds) {
    const host = String(seed).trim().toLowerCase();
    if (!host || seen.has(host)) continue;
    seen.add(host);
    queue.push({ host, depth: 0, via: null, relation: null });
  }

  const nodes = [];
  while (queue.length && nodes.length < maxNodes) {
    const current = queue.shift();
    nodes.push(current);
    if (current.depth >= maxDepth) continue;
    for (const neighbor of adjacency[current.host] ?? []) {
      const target = String(neighbor.target ?? '')
        .trim()
        .toLowerCase();
      if (!target) continue;
      edges.push({ from: current.host, to: target, relation: neighbor.relation ?? 'unknown' });
      if (!seen.has(target) && nodes.length + queue.length < maxNodes) {
        seen.add(target);
        queue.push({
          host: target,
          depth: current.depth + 1,
          via: current.host,
          relation: neighbor.relation ?? 'unknown',
        });
      }
    }
  }
  return { nodes, edges };
}

/**
 * Rank hosts by how "central" they are to the mapping: degree centrality
 * plus a bonus for infrastructure-type relations (MX/NS/netblock edges).
 * @param {Array<{from: string, to: string, relation: string}>} edges
 * @returns {Array<{host: string, score: number, relations: string[]}>}
 */
export function rankGraphNodes(edges) {
  const score = new Map();
  const INFRA_RELATIONS = new Set(['mx', 'ns', 'netblock', 'ptr']);
  for (const edge of edges) {
    for (const host of [edge.from, edge.to]) {
      const cur = score.get(host) ?? { host, score: 0, relations: new Set() };
      cur.score += 1 + (INFRA_RELATIONS.has(edge.relation) ? 2 : 0);
      cur.relations.add(edge.relation);
      score.set(host, cur);
    }
  }
  return [...score.values()]
    .map(s => ({ host: s.host, score: s.score, relations: [...s.relations].sort() }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Group expanded hosts by their relation to the seed — useful for directing
 * follow-up checks (MX hosts → mail security, netblock hosts → port sweep).
 * @param {{nodes: Array<{host: string, depth: number, via: string|null, relation: string|null}>}} graph
 * @returns {Record<string, string[]>}
 */
export function groupByRelation(graph) {
  const groups = {};
  for (const node of graph.nodes) {
    const rel = node.relation ?? 'seed';
    (groups[rel] ??= []).push(node.host);
  }
  for (const key of Object.keys(groups)) groups[key].sort();
  return groups;
}
