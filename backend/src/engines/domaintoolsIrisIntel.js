/**
 * domaintoolsIrisIntel.js — DomainTools Iris pivot graph (idea 00175).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated DomainTools Iris-style domain records and pivots on
 * shared IPs, registrant emails, and nameservers to build a pivot graph of
 * related domains — the standard technique for finding an organization's
 * full domain footprint from one known-good seed.
 *
 * Iris record shape:
 *   { domain, ips: [String], emails: [String], nameservers: [String],
 *     registrar, source }
 * All functions are pure and synchronous.
 */

const EDGE_WEIGHTS = { ip: 3, email: 2, nameserver: 1 };

/**
 * @param {string} v
 * @returns {string}
 */
function norm(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

/**
 * Idea 00175 — Build the Iris pivot graph.
 *
 * Nodes are domains; edges exist when two domains share an IP, a registrant
 * email, or a nameserver. Edge weight reflects signal strength (shared IP >
 * shared email > shared nameserver).
 *
 * @param {Array<Object>} records - Iris records.
 * @returns {{ nodes: Array<string>, edges: Array<{ a, b, via, type, weight }> }}
 */
export function buildPivotGraph(records) {
  const byIp = new Map();
  const byEmail = new Map();
  const byNs = new Map();
  const domains = new Set();

  for (const r of records || []) {
    if (!r || !r.domain) continue;
    const domain = norm(r.domain);
    if (!domain) continue;
    domains.add(domain);
    const add = (map, values) => {
      for (const v of values || []) {
        const key = norm(v);
        if (!key) continue;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(domain);
      }
    };
    add(byIp, r.ips);
    add(byEmail, r.emails);
    add(byNs, r.nameservers);
  }

  const edgeMap = new Map();
  const link = (map, type) => {
    for (const [value, set] of map.entries()) {
      const list = [...set];
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i] < list[j] ? list[i] : list[j];
          const b = list[i] < list[j] ? list[j] : list[i];
          const key = `${a}|${b}`;
          if (!edgeMap.has(key)) edgeMap.set(key, { a, b, via: [], weight: 0 });
          const e = edgeMap.get(key);
          e.via.push({ type, value });
          e.weight += EDGE_WEIGHTS[type] || 1;
        }
      }
    }
  };
  link(byIp, 'ip');
  link(byEmail, 'email');
  link(byNs, 'nameserver');

  return {
    nodes: [...domains].sort(),
    edges: [...edgeMap.values()].sort((x, y) => y.weight - x.weight),
  };
}

/**
 * Idea 00175 — Pivot from a seed domain across the graph.
 *
 * BFS up to maxHops; each discovered domain carries the strongest pivot path
 * (the edge with the highest weight seen on its discovery hop).
 *
 * @param {{ nodes: Array, edges: Array }} graph - from buildPivotGraph.
 * @param {string} seedDomain
 * @param {{ maxHops?: number }} [opts]
 * @returns {Array<{ domain: string, hops: number, bestVia: Array<{type, value}>, bestWeight: number }>}
 */
export function pivotFromDomain(graph, seedDomain, opts = {}) {
  const maxHops = opts.maxHops ?? 2;
  const seed = norm(seedDomain);
  const adjacency = new Map();
  for (const e of graph.edges || []) {
    if (!adjacency.has(e.a)) adjacency.set(e.a, []);
    if (!adjacency.has(e.b)) adjacency.set(e.b, []);
    adjacency.get(e.a).push({ peer: e.b, via: e.via, weight: e.weight });
    adjacency.get(e.b).push({ peer: e.a, via: e.via, weight: e.weight });
  }
  const visited = new Map([[seed, { hops: 0, bestVia: [], bestWeight: 0 }]]);
  let frontier = [seed];
  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop += 1) {
    const next = [];
    for (const node of frontier) {
      for (const { peer, via, weight } of adjacency.get(node) || []) {
        if (visited.has(peer)) continue;
        visited.set(peer, { hops: hop, bestVia: via, bestWeight: weight });
        next.push(peer);
      }
    }
    frontier = next;
  }
  return [...visited.entries()]
    .filter(([d]) => d !== seed)
    .map(([domain, v]) => ({ domain, ...v }))
    .sort(
      (a, b) => a.hops - b.hops || b.bestWeight - a.bestWeight || a.domain.localeCompare(b.domain)
    );
}

/**
 * Idea 00175 — Strongest pivots overall.
 *
 * Returns the highest-weight edges in the graph — the domain pairs most
 * confidently tied to the same registrant/infrastructure.
 *
 * @param {{ edges: Array }} graph
 * @param {{ limit?: number }} [opts]
 * @returns {Array<{ a, b, via: Array<string>, weight: number }>}
 */
export function strongestPivots(graph, opts = {}) {
  const limit = opts.limit ?? 25;
  return (graph.edges || []).slice(0, limit).map(e => ({
    a: e.a,
    b: e.b,
    via: e.via.map(v => `${v.type}:${v.value}`),
    weight: e.weight,
  }));
}
