/**
 * binaryedgePivotIntel.js — BinaryEdge sensor-data pivoting for autonomous bug bounty.
 *
 * Implements idea-bank item 00159: pivot on BinaryEdge's IP and domain
 * datasets to correlate target assets.
 *
 * BinaryEdge exposes IP-score/enrichment data and domain datasets
 * (subdomain enumeration, certificate observations, passive DNS-style
 * records). Correlating the two — domains observed pointing at target IPs,
 * and IPs sharing the same domains, open ports, or tags — builds an asset
 * graph without active scanning. This module pivots across supplied
 * BinaryEdge-style IP and domain records to surface related assets.
 *
 * All functions are pure and side-effect free: they operate on BinaryEdge
 * API result objects the caller obtained through a legitimate BinaryEdge
 * account during an authorized engagement. No scanning is performed here.
 */

/**
 * Normalize a BinaryEdge IP record to a flat shape.
 * @param {object} r Raw record with any of: ip, target, address.
 * @returns {{ip:string, ports:number[], tags:string[], domains:string[], asn:string|null, country:string|null}|null}
 */
export function normalizeIpRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const ip = r.ip || r.target || r.address;
  if (typeof ip !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  const ports = new Set();
  for (const p of r.ports || r.open_ports || []) {
    const n = Number(p && p.port !== undefined ? p.port : p);
    if (Number.isInteger(n) && n > 0 && n < 65536) ports.add(n);
  }
  const tags = [...new Set((r.tags || r.labels || []).filter((t) => typeof t === 'string'))];
  const domains = [...new Set((r.domains || r.hostnames || []).filter((d) => typeof d === 'string').map((d) => d.toLowerCase()))];
  return {
    ip,
    ports: [...ports].sort((a, b) => a - b),
    tags,
    domains,
    asn: r.asn != null ? String(r.asn) : null,
    country: r.country || r.country_code || null,
  };
}

/**
 * Build pivot edges between IPs that share domains, tags, or ASN.
 * @param {Array<object>} ipRecords BinaryEdge IP records (normalizeIpRecord input shape).
 * @returns {{edges: Array<{a:string, b:string, via:'shared-domain'|'shared-tag'|'shared-asn', detail:string}>, nodes:Array<string>}}
 */
export function buildIpPivotGraph(ipRecords) {
  const norm = (Array.isArray(ipRecords) ? ipRecords : []).map(normalizeIpRecord).filter(Boolean);
  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (a, b, via, detail) => {
    if (a === b) return;
    const key = [a < b ? a : b, a < b ? b : a, via, detail].join('|');
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ a, b, via, detail });
  };
  const byDomain = new Map();
  const byTag = new Map();
  const byAsn = new Map();
  for (const n of norm) {
    for (const d of n.domains) {
      if (!byDomain.has(d)) byDomain.set(d, []);
      byDomain.get(d).push(n.ip);
    }
    for (const t of n.tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(n.ip);
    }
    if (n.asn) {
      if (!byAsn.has(n.asn)) byAsn.set(n.asn, []);
      byAsn.get(n.asn).push(n.ip);
    }
  }
  const linkAll = (map, via) => {
    for (const [detail, ips] of map) {
      for (let i = 0; i < ips.length; i++) {
        for (let j = i + 1; j < ips.length; j++) addEdge(ips[i], ips[j], via, detail);
      }
    }
  };
  linkAll(byDomain, 'shared-domain');
  linkAll(byTag, 'shared-tag');
  linkAll(byAsn, 'shared-asn');
  return { edges, nodes: norm.map((n) => n.ip) };
}

/**
 * Expand from seed IPs across the pivot graph: BFS to a given depth,
 * returning each discovered IP with the shortest-path distance and the
 * reason chain that connected it.
 * @param {{edges:Array, nodes:Array}} graph Output of buildIpPivotGraph.
 * @param {string[]} seedIps Confirmed target IPs to pivot from.
 * @param {number} [maxDepth=2] BFS depth limit.
 * @returns {Array<{ip:string, depth:number, path:Array<{via:string, detail:string}>}>}
 */
export function expandFromSeeds(graph, seedIps, maxDepth = 2) {
  const adj = new Map();
  for (const e of graph.edges || []) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a).push({ to: e.b, via: e.via, detail: e.detail });
    adj.get(e.b).push({ to: e.a, via: e.via, detail: e.detail });
  }
  const visited = new Map(); // ip -> { depth, path }
  const queue = [];
  for (const seed of seedIps || []) {
    visited.set(seed, { depth: 0, path: [] });
    queue.push(seed);
  }
  while (queue.length > 0) {
    const current = queue.shift();
    const { depth, path } = visited.get(current);
    if (depth >= maxDepth) continue;
    for (const link of adj.get(current) || []) {
      if (visited.has(link.to)) continue;
      visited.set(link.to, { depth: depth + 1, path: [...path, { via: link.via, detail: link.detail }] });
      queue.push(link.to);
    }
  }
  return [...visited.entries()]
    .filter(([ip]) => !(seedIps || []).includes(ip))
    .map(([ip, v]) => ({ ip, depth: v.depth, path: v.path }))
    .sort((a, b) => a.depth - b.depth || a.ip.localeCompare(b.ip));
}

/**
 * Rank pivot candidates: shared-domain pivots score highest (strongest
 * ownership signal), then shared tags, then shared ASN alone.
 * @param {Array<object>} candidates Output of expandFromSeeds.
 * @returns {Array<object>} Same rows with a `score` and sorted descending.
 */
export function rankPivotCandidates(candidates) {
  const weight = { 'shared-domain': 50, 'shared-tag': 25, 'shared-asn': 10 };
  return (candidates || [])
    .map((c) => {
      const score = c.path.reduce((s, step) => s + (weight[step.via] || 5), 0);
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score || a.depth - b.depth);
}
