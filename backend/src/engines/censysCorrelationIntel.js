/**
 * censysCorrelationIntel.js — Censys search-API correlation.
 *
 * Idea 00385: correlate Censys host and certificate records to expand from
 * one IP to sibling services.
 *
 * No network calls and no API keys: the module builds Censys v2 search
 * queries (hosts + certificates indexes) from engagement inputs, and
 * correlates operator-supplied Censys response objects into sibling-service
 * candidates — via shared certificate SANs, shared autonomous systems,
 * and co-observed services.
 */

/**
 * Build Censys search queries for hosts and certificates indexes.
 * @param {{ip?: string, cidr?: string, domain?: string, org?: string}} input
 * @returns {{hosts: string[], certificates: string[]}}
 */
export function buildCensysQueries({ ip = '', cidr = '', domain = '', org = '' } = {}) {
  const hosts = [];
  const certificates = [];
  if (ip) {
    hosts.push(`ip: ${ip}`);
    certificates.push(`names: ${ip}`);
  }
  if (cidr) {
    hosts.push(`ip: ${cidr}`);
    certificates.push(`parsed.names: ${cidr}`);
  }
  if (domain) {
    hosts.push(`dns.names: ${domain}`);
    certificates.push(`names: ${domain}`);
  }
  if (org) hosts.push(`autonomous_system.organization: "${org}"`);
  return { hosts, certificates };
}

function sansOf(cert) {
  const names = new Set();
  const add = v => {
    if (typeof v === 'string' && v && !v.startsWith('*.')) names.add(v.toLowerCase());
  };
  add(cert?.parsed?.subject?.common_name);
  for (const n of cert?.parsed?.extensions?.subject_alt_name?.dns_names || []) add(n);
  for (const n of cert?.names || []) add(n);
  return [...names];
}

/**
 * Correlate Censys host records into sibling candidates.
 * Each host follows the Censys v2 /hosts search hit shape.
 * @param {object[]} hostRecords
 * @param {object[]} [certRecords] - Optional Censys certificate hits for SAN bridging.
 * @returns {{siblings: object[], certBridges: object[], stats: object}}
 */
export function correlateCensysHosts(hostRecords = [], certRecords = []) {
  const certBySha = new Map();
  for (const c of certRecords || []) {
    const fp = c?.fingerprint_sha256 || c?.parsed?.fingerprint_sha256;
    if (fp) certBySha.set(fp, c);
  }

  const hosts = [];
  for (const h of hostRecords) {
    const ip = h?.ip;
    if (!ip) continue;
    const services = [];
    for (const svc of h?.services || []) {
      const fp =
        svc?.tls?.certificates?.leaf_data?.fingerprint_sha256 ||
        svc?.tls?.certificates?.leaf?.fingerprint_sha256;
      const cert = fp ? certBySha.get(fp) : null;
      services.push({
        port: svc.port,
        transport: svc.transport_protocol || 'TCP',
        serviceName: svc.service_name || svc.extended_service_name || 'unknown',
        software: (svc.software || []).map(s => ({
          vendor: s.vendor,
          product: s.product,
          version: s.version,
        })),
        httpTitle: svc.http?.response?.html_title || null,
        tlsFingerprint: fp || null,
        tlsSans: cert ? sansOf(cert) : [],
      });
    }
    hosts.push({
      ip,
      asn: h?.autonomous_system?.asn ?? null,
      asnOrg: h?.autonomous_system?.organization || null,
      country: h?.location?.country || h?.location?.country_code || null,
      dnsNames: h?.dns?.names || [],
      services,
    });
  }

  // Sibling expansion: group by (ASN + cert SAN overlap).
  const siblings = [];
  const seenPairs = new Set();
  for (let i = 0; i < hosts.length; i++) {
    for (let j = i + 1; j < hosts.length; j++) {
      const a = hosts[i];
      const b = hosts[j];
      const key = `${a.ip}<->${b.ip}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const reasons = [];
      if (a.asn && a.asn === b.asn)
        reasons.push(`shared ASN ${a.asn} (${a.asnOrg || 'unknown org'})`);
      const aSans = new Set(a.services.flatMap(s => s.tlsSans));
      const bSans = new Set(b.services.flatMap(s => s.tlsSans));
      const sharedSans = [...aSans].filter(n => bSans.has(n));
      if (sharedSans.length)
        reasons.push(`shared certificate SAN(s): ${sharedSans.slice(0, 5).join(', ')}`);
      const aNames = new Set(a.dnsNames.map(n => n.toLowerCase()));
      const bNames = new Set(b.dnsNames.map(n => n.toLowerCase()));
      const sharedDns = [...aNames].filter(n => bNames.has(n));
      if (sharedDns.length) reasons.push(`shared DNS name(s): ${sharedDns.slice(0, 5).join(', ')}`);
      if (reasons.length) {
        siblings.push({
          pair: [a.ip, b.ip],
          reasons,
          confidence: reasons.length >= 2 ? 'high' : 'medium',
        });
      }
    }
  }

  // Certificate bridges: certs whose SANs name hosts outside the input set.
  const inputIps = new Set(hosts.map(h => h.ip));
  const certBridges = [];
  for (const [, c] of certBySha) {
    const names = sansOf(c);
    const externalNames = names.filter(n => !inputIps.has(n));
    if (externalNames.length) {
      certBridges.push({
        fingerprint: c.fingerprint_sha256 || c?.parsed?.fingerprint_sha256,
        externalNames: externalNames.slice(0, 20),
        confidence: 'medium',
        rationale:
          'Certificate SANs reference names/IPs beyond the scanned set — candidate sibling assets.',
      });
    }
  }

  return {
    hosts,
    siblings,
    certBridges,
    stats: {
      hostCount: hosts.length,
      siblingPairs: siblings.length,
      certBridges: certBridges.length,
      highConfidencePairs: siblings.filter(s => s.confidence === 'high').length,
    },
  };
}

/**
 * Build a report finding from the correlation result.
 * @param {ReturnType<typeof correlateCensysHosts>} result
 */
export function censysFinding(result) {
  return {
    title: `Censys correlation — ${result.stats.siblingPairs} sibling pair(s) across ${result.stats.hostCount} host(s)`,
    severity: result.stats.siblingPairs ? 'Low' : 'Info',
    confidence: result.stats.hostCount >= 2 ? 'high' : 'low',
    siblings: result.siblings.slice(0, 25),
    certBridges: result.certBridges.slice(0, 10),
    evidence:
      `${result.stats.hostCount} Censys host record(s) correlated; ` +
      `${result.stats.highConfidencePairs} high-confidence sibling pair(s); ` +
      `${result.stats.certBridges} certificate bridge(s) to external names.`,
  };
}

export const CENSYS_CORRELATION_INTEL = { buildCensysQueries, correlateCensysHosts, censysFinding };
export default CENSYS_CORRELATION_INTEL;
