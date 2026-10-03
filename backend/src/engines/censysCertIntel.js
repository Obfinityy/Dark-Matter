/**
 * censysCertIntel.js — certificate-index hostname pull (idea 00150).
 *
 * Certificate indexes expose every hostname ever seen in certificates for
 * a given IP (reverse cert lookup). Pulling those hostnames for each of the
 * target's IPs reveals forgotten services, staging boxes, and partner
 * infrastructure. This module parses certificate-index style results and
 * correlates them per IP.
 */

/**
 * Extract hostnames from certificate-index entries, skipping bare IPs and
 * wildcard noise optionally.
 * @param {{ ip, certificates: { serial, parsedNames?: string[], issuer?, notBefore?, notAfter? }[] }[]} entries
 * @param {{ includeWildcards?: boolean }} opts
 * @returns {{ ip, hostnames: string[], certCount: number }[]}
 */
export function pullHostnamesPerIp(entries = [], { includeWildcards = false } = {}) {
  return (entries || []).map((entry) => {
    const hosts = new Set();
    let certCount = 0;
    for (const cert of entry.certificates || []) {
      certCount++;
      for (const name of cert.parsedNames || []) {
        const n = String(name).trim().toLowerCase();
        if (!n) continue;
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(n) || n.includes(':')) continue;
        if (!includeWildcards && n.startsWith('*.')) continue;
        hosts.add(n);
      }
    }
    return { ip: entry.ip, hostnames: [...hosts].sort(), certCount };
  });
}

/**
 * Find hostnames shared across multiple IPs (shared hosting / CDN / cert reuse).
 * @param {{ ip, hostnames: string[], certCount: number }[]} perIp
 * @returns {{ hostname, ips: string[], ipCount }[]}
 */
export function sharedHostnameMap(perIp = []) {
  const map = new Map();
  for (const entry of perIp) {
    for (const h of entry.hostnames) {
      if (!map.has(h)) map.set(h, []);
      map.get(h).push(entry.ip);
    }
  }
  return [...map.entries()]
    .filter(([, ips]) => ips.length > 1)
    .map(([hostname, ips]) => ({ hostname, ips, ipCount: ips.length }))
    .sort((a, b) => b.ipCount - a.ipCount);
}

/**
 * Flag interesting hostnames: staging/dev/test subdomains and single-cert
 * outliers that hint at forgotten infrastructure.
 * @param {{ ip, hostnames: string[], certCount: number }[]} perIp
 * @returns {{ ip, hostname, reason }[]}
 */
export function flagInterestingHostnames(perIp = []) {
  const PATTERNS = [
    [/^(staging|stage|stg|dev|development|test|qa|uat|demo|beta|old|legacy|backup|tmp|temp)[.-]/, 'non-production prefix'],
    [/[.-](staging|stage|dev|test|internal|corp|vpn|admin|jenkins|ci|git|jira)[.-]?/, 'internal/tooling keyword'],
  ];
  const out = [];
  for (const entry of perIp) {
    for (const h of entry.hostnames) {
      for (const [re, reason] of PATTERNS) {
        if (re.test(h)) {
          out.push({ ip: entry.ip, hostname: h, reason });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Summarize the pull: totals, top issuers, and per-IP coverage.
 * @param {{ ip, certificates: { parsedNames?: string[], issuer? }[] }[]} entries
 * @returns {{ ips: number, certs: number, uniqueHostnames: number, issuers: { issuer, count }[] }}
 */
export function summarizePull(entries = []) {
  const hostnames = new Set();
  const issuers = new Map();
  let certs = 0;
  for (const entry of entries) {
    for (const cert of entry.certificates || []) {
      certs++;
      if (cert.issuer) issuers.set(cert.issuer, (issuers.get(cert.issuer) || 0) + 1);
      for (const n of cert.parsedNames || []) {
        const h = String(n).trim().toLowerCase();
        if (h && !/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) hostnames.add(h);
      }
    }
  }
  return {
    ips: entries.length,
    certs,
    uniqueHostnames: hostnames.size,
    issuers: [...issuers.entries()]
      .map(([issuer, count]) => ({ issuer, count }))
      .sort((a, b) => b.count - a.count),
  };
}
