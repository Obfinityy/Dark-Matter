/**
 * sanClusterIntel.js — Sibling-domain TLS SAN overlap clustering.
 *
 * Implements idea-bank item 00061: fetch TLS certificates from candidate
 * hosts, extract their Subject Alternative Name (SAN) lists, and cluster
 * certificates by shared SAN entries. Certificates that share multiple SAN
 * hostnames are almost always issued under common management, which lets an
 * analyst discover sibling domains that are managed together with a target
 * (shared CDN edges, shared marketing stacks, reseller certs, etc.).
 *
 * All functions are pure and side-effect free: they parse and analyze
 * SAN lists supplied by the caller. TLS certificate fetching is intentionally
 * left to the caller so the engine stays testable and safe to run anywhere.
 */

/**
 * Normalise a single SAN entry: lowercase, trim, drop trailing dots.
 * @param {string} entry
 * @returns {string}
 */
export function normaliseSan(entry) {
  return String(entry || '')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
}

/**
 * Parse a certificate record into a canonical {host, sans} pair.
 * Accepts common shapes: {host, sans:[...]}, {host, subjectAltNames:[...]},
 * {host, dnsNames:[...]} (e.g. from node tls peers), or {host, san:'a,b'}.
 * @param {{host?: string, sans?: string[]|string, subjectAltNames?: string[], dnsNames?: string[]}} cert
 * @returns {{host: string, sans: string[]}}
 */
export function parseCertificateRecord(cert) {
  const raw = cert.sans ?? cert.subjectAltNames ?? cert.dnsNames ?? [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[\s,;]+/);
  const sans = [...new Set(list.map(normaliseSan).filter(Boolean))];
  return { host: String(cert.host || ''), sans };
}

/**
 * Extract the registrable-domain portion used for sibling scoring.
 * Compares the last two labels; a small public-suffix exception table keeps
 * common multi-label suffixes (co.uk, com.au, …) from over-clustering.
 * @param {string} host
 * @returns {string}
 */
export function rootDomain(host) {
  const parts = normaliseSan(host).split('.').filter(Boolean);
  const two = parts.slice(-2).join('.');
  const exceptions = new Set([
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'co.nz',
    'co.jp',
    'com.br',
  ]);
  if (exceptions.has(two) && parts.length >= 3) return parts.slice(-3).join('.');
  return two;
}

/**
 * Jaccard similarity between two SAN sets (0 = disjoint, 1 = identical).
 * Wildcard entries ('*.example.com') are compared literally.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
export function sanJaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const entry of setA) if (setB.has(entry)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

/**
 * Build a pairwise SAN-overlap graph between certificate records.
 * An edge is created when two certificates share at least `minShared` SAN
 * entries OR their Jaccard similarity reaches `minJaccard`.
 * @param {{host: string, sans: string[]}[]} certs
 * @param {{minShared?: number, minJaccard?: number}} [opts]
 * @returns {{edges: {from: string, to: string, shared: string[], jaccard: number}[], isolated: string[]}}
 */
export function buildSanOverlapGraph(certs, opts = {}) {
  const { minShared = 2, minJaccard = 0.25 } = opts;
  const records = certs.map(parseCertificateRecord);
  const edges = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const setB = new Set(records[j].sans);
      const shared = records[i].sans.filter(s => setB.has(s));
      const jaccard = sanJaccard(records[i].sans, records[j].sans);
      if (shared.length >= minShared || jaccard >= minJaccard) {
        edges.push({
          from: records[i].host,
          to: records[j].host,
          shared,
          jaccard: Math.round(jaccard * 1000) / 1000,
        });
      }
    }
  }
  const linked = new Set(edges.flatMap(e => [e.from, e.to]));
  return { edges, isolated: records.map(r => r.host).filter(h => !linked.has(h)) };
}

/**
 * Cluster certificates into sibling groups using union-find over the
 * SAN-overlap graph. Each cluster is a set of hosts under common management.
 * @param {{host: string, sans: string[]}[]} certs
 * @param {{minShared?: number, minJaccard?: number, minClusterSize?: number}} [opts]
 * @returns {{clusters: {hosts: string[], rootDomains: string[], sharedSans: string[]}[]}}
 */
export function clusterSiblingDomains(certs, opts = {}) {
  const { minClusterSize = 2 } = opts;
  const records = certs.map(parseCertificateRecord);
  const { edges } = buildSanOverlapGraph(records, opts);
  const parent = new Map(records.map(r => [r.host, r.host]));
  const find = x => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  for (const edge of edges) {
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map();
  for (const r of records) {
    const root = find(r.host);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  }
  const clusters = [];
  for (const members of groups.values()) {
    if (members.length < minClusterSize) continue;
    const hosts = members.map(m => m.host);
    const sanCounts = new Map();
    for (const m of members) for (const s of m.sans) sanCounts.set(s, (sanCounts.get(s) || 0) + 1);
    const sharedSans = [...sanCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([san]) => san);
    clusters.push({
      hosts,
      rootDomains: [...new Set(hosts.map(rootDomain))],
      sharedSans,
    });
  }
  return { clusters };
}

/**
 * Score how strongly a candidate host looks like a sibling of a target
 * brand: shared SAN entries + root-domain affinity.
 * @param {string} candidateHost
 * @param {string[]} candidateSans
 * @param {string} targetHost
 * @param {string[]} targetSans
 * @returns {{score: number, shared: string[], sameRoot: boolean}}
 */
export function siblingScore(candidateHost, candidateSans, targetHost, targetSans) {
  const target = new Set(targetSans.map(normaliseSan));
  const shared = candidateSans.map(normaliseSan).filter(s => target.has(s));
  const sameRoot = rootDomain(candidateHost) === rootDomain(targetHost);
  let score = shared.length * 2;
  if (sameRoot) score += 3;
  return { score: Math.min(score, 10), shared, sameRoot };
}

export const SAN_CLUSTER_INTEL = {
  parseCertificateRecord,
  normaliseSan,
  rootDomain,
  sanJaccard,
  buildSanOverlapGraph,
  clusterSiblingDomains,
  siblingScore,
};
export default SAN_CLUSTER_INTEL;
