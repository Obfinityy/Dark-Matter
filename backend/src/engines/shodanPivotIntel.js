/**
 * shodanPivotIntel.js — Shodan API pivoting automation.
 *
 * Idea 00384: automate Shodan queries keyed by target IPs to pull banners,
 * vulns, and hostnames into the asset graph.
 *
 * This module never calls Shodan's network API (no API key is required or
 * used). It *builds* Shodan search queries from engagement-scope inputs and
 * *correlates* Shodan host response objects (as returned by the operator's
 * own Shodan client) into normalized asset-graph nodes: banners, open ports,
 * hostnames, vulnerabilities, and TLS subjects.
 */

/**
 * Build Shodan search queries for a target IP or netblock.
 * @param {{ip?: string, cidr?: string, org?: string, extraFilters?: string[]}} input
 * @returns {{queries: {label: string, query: string}[]}}
 */
export function buildShodanQueries({ ip = '', cidr = '', org = '', extraFilters = [] } = {}) {
  const queries = [];
  const extra = extraFilters.length ? ` ${extraFilters.join(' ')}` : '';
  if (ip) queries.push({ label: 'single-host', query: `ip:${ip}${extra}`.trim() });
  if (cidr) queries.push({ label: 'netblock', query: `net:${cidr}${extra}`.trim() });
  if (org) queries.push({ label: 'org-pivot', query: `org:"${org}"${extra}`.trim() });
  if (ip)
    queries.push({ label: 'ssl-cert-pivot', query: `ssl.cert.subject.cn:"${ip}"${extra}`.trim() });
  return { queries };
}

/**
 * Correlate one Shodan host response object into asset-graph nodes.
 * Accepts the shape returned by Shodan's /shodan/host/{ip} endpoint.
 * @param {object} host
 * @returns {{assets: object[], edges: object[], vulns: object[]}}
 */
export function correlateShodanHost(host = {}) {
  if (!host || typeof host.ip_str !== 'string') {
    throw new Error('correlateShodanHost: host.ip_str is required');
  }
  const ip = host.ip_str;
  const hostNode = {
    kind: 'host',
    id: `host:${ip}`,
    label: ip,
    attrs: {
      org: host.org || null,
      isp: host.isp || null,
      asn: host.asn || null,
      city: host.city || null,
      country: host.country_name || host.country_code || null,
      hostnames: Array.isArray(host.hostnames) ? host.hostnames : [],
      domains: Array.isArray(host.domains) ? host.domains : [],
      tags: Array.isArray(host.tags) ? host.tags : [],
      lastUpdate: host.last_update || null,
    },
  };

  const assets = [hostNode];
  const edges = [];
  const vulns = [];
  const seenPorts = new Set();

  for (const svc of host.data || []) {
    const port = svc.port;
    const proto = svc.transport || 'tcp';
    if (port == null || seenPorts.has(`${proto}/${port}`)) continue;
    seenPorts.add(`${proto}/${port}`);
    const svcNode = {
      kind: 'service',
      id: `service:${ip}:${proto}/${port}`,
      label: `${svc.product || 'unknown'}:${port}`,
      attrs: {
        port,
        transport: proto,
        product: svc.product || null,
        version: svc.version || null,
        banner: typeof svc.data === 'string' ? svc.data.slice(0, 2000) : null,
        httpTitle: svc.http?.title || null,
        httpServer: svc.http?.server || null,
        tlsSubject: svc.ssl?.cert?.subject?.CN || null,
        tlsIssuer: svc.ssl?.cert?.issuer?.CN || null,
      },
    };
    assets.push(svcNode);
    edges.push({ from: hostNode.id, to: svcNode.id, rel: 'exposes' });

    for (const v of svc.vulns || []) {
      vulns.push({
        kind: 'vuln',
        id: `vuln:${ip}:${v}`,
        cve: v,
        host: ip,
        port,
        product: svc.product || null,
        confidence: 'medium',
        evidence: `Shodan banner for ${ip}:${port} (${svc.product || 'unknown'}) lists ${v}.`,
      });
    }
  }

  // Hostname pivots: each hostname becomes a node the graph can expand on.
  for (const hn of hostNode.attrs.hostnames) {
    const hnNode = { kind: 'hostname', id: `hostname:${hn}`, label: hn, attrs: {} };
    assets.push(hnNode);
    edges.push({ from: hostNode.id, to: hnNode.id, rel: 'resolves-to-name' });
  }

  return { assets, edges, vulns };
}

/**
 * Merge correlated results from many hosts; dedupe nodes/edges.
 * @param {Array<ReturnType<typeof correlateShodanHost>>} results
 */
export function mergeShodanGraph(results = []) {
  const assets = new Map();
  const edges = new Map();
  const vulns = new Map();
  for (const r of results) {
    for (const a of r.assets || []) assets.set(a.id, a);
    for (const e of r.edges || []) edges.set(`${e.from}|${e.rel}|${e.to}`, e);
    for (const v of r.vulns || []) vulns.set(v.id, v);
  }
  const vulnList = [...vulns.values()];
  return {
    assets: [...assets.values()],
    edges: [...edges.values()],
    vulns: vulnList,
    stats: {
      hosts: [...assets.values()].filter(a => a.kind === 'host').length,
      services: [...assets.values()].filter(a => a.kind === 'service').length,
      hostnames: [...assets.values()].filter(a => a.kind === 'hostname').length,
      vulnMentions: vulnList.length,
    },
  };
}

/**
 * Build a report finding from a merged Shodan graph.
 * @param {ReturnType<typeof mergeShodanGraph>} graph
 */
export function shodanFinding(graph) {
  const interesting = graph.vulns.slice(0, 25);
  return {
    title: `Shodan pivoting — ${graph.stats.hosts} host(s), ${graph.stats.services} service(s), ${graph.stats.vulnMentions} CVE mention(s)`,
    severity: graph.stats.vulnMentions ? 'Medium' : 'Info',
    confidence: graph.stats.hosts ? 'high' : 'low',
    stats: graph.stats,
    cves: interesting.map(v => ({ cve: v.cve, host: v.host, port: v.port, product: v.product })),
    evidence:
      `${graph.stats.hosts} Shodan host record(s) correlated into the asset graph; ` +
      `${graph.stats.hostnames} hostname pivot(s) available.`,
  };
}

export const SHODAN_PIVOT_INTEL = {
  buildShodanQueries,
  correlateShodanHost,
  mergeShodanGraph,
  shodanFinding,
};
export default SHODAN_PIVOT_INTEL;
