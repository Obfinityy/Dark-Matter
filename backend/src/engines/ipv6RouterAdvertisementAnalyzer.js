/**
 * ipv6RouterAdvertisementAnalyzer.js — IPv6 Router Advertisement (RA) analysis.
 *
 * Idea 00382: parse router advertisements to map prefixes, DNS servers, and
 * network topology.
 *
 * Takes Router Advertisement messages described as plain field objects
 * (as produced by the platform's capture layer) and reconstructs the
 * announced network topology: on-link prefixes, recursive DNS servers
 * (RDNSS), default-router lifetimes, and rogue-RA indicators.
 * Pure functions — no live network access.
 */

/**
 * @typedef {Object} PrefixInfo
 * @property {string} prefix - e.g. '2001:db8:1::/64'.
 * @property {boolean} onLink - L flag.
 * @property {boolean} autonomous - A flag (SLAAC allowed).
 * @property {number} validLifetime - Seconds.
 * @property {number} preferredLifetime - Seconds.
 */

/**
 * @typedef {Object} RouterAdvertisement
 * @property {string} sourceIp - Router's (usually link-local) source address.
 * @property {string} [sourceMac] - Source-link-layer option MAC.
 * @property {number} hopLimit - Cur hop limit field.
 * @property {boolean} managedFlag - M flag (DHCPv6 stateful).
 * @property {boolean} otherFlag - O flag (DHCPv6 stateless).
 * @property {number} routerLifetime - Seconds the router may be used as default.
 * @property {number} reachableTimeMs
 * @property {number} retransTimerMs
 * @property {PrefixInfo[]} prefixes
 * @property {{address: string, lifetime: number}[]} [rdnss] - Recursive DNS servers (RFC 8106).
 * @property {{domain: string, lifetime: number}[]} [dnssl] - DNS search list.
 * @property {number} [mtu]
 * @property {number} [seenAt]
 */

/**
 * Parse one RA into a normalized topology fragment.
 * @param {RouterAdvertisement} ra
 */
export function parseRouterAdvertisement(ra) {
  if (!ra || typeof ra.sourceIp !== 'string') {
    throw new Error('parseRouterAdvertisement: ra.sourceIp is required');
  }
  const prefixes = (ra.prefixes || []).map(p => ({
    prefix: p.prefix,
    onLink: !!p.onLink,
    autonomous: !!p.autonomous,
    validLifetime: p.validLifetime ?? 0,
    preferredLifetime: p.preferredLifetime ?? 0,
    slaacEnabled: !!p.autonomous && !!p.onLink,
    expiringSoon: (p.preferredLifetime ?? 0) < 300,
  }));
  return {
    router: ra.sourceIp,
    mac: (ra.sourceMac || '').toLowerCase() || null,
    isDefaultRouter: (ra.routerLifetime ?? 0) > 0,
    routerLifetime: ra.routerLifetime ?? 0,
    hopLimit: ra.hopLimit ?? 64,
    dhcpMode: ra.managedFlag ? 'stateful' : ra.otherFlag ? 'stateless' : 'none',
    reachableTimeMs: ra.reachableTimeMs ?? 0,
    retransTimerMs: ra.retransTimerMs ?? 0,
    mtu: ra.mtu ?? null,
    prefixes,
    dnsServers: (ra.rdnss || []).map(r => ({ address: r.address, lifetime: r.lifetime ?? 0 })),
    dnsSearchList: (ra.dnssl || []).map(d => ({ domain: d.domain, lifetime: d.lifetime ?? 0 })),
    seenAt: ra.seenAt ?? Date.now(),
  };
}

/**
 * Merge many parsed RAs into a segment topology map and flag anomalies.
 * @param {RouterAdvertisement[]} advertisements
 * @param {{expectedRouters?: string[]}} [options]
 */
export function analyzeRouterAdvertisements(advertisements = [], options = {}) {
  const { expectedRouters = [] } = options;
  const parsed = advertisements.map(parseRouterAdvertisement);

  const routers = new Map();
  for (const p of parsed) {
    if (!routers.has(p.router)) routers.set(p.router, { ...p, count: 0, prefixes: new Map() });
    const r = routers.get(p.router);
    r.count += 1;
    for (const px of p.prefixes) {
      if (!r.prefixes.has(px.prefix)) r.prefixes.set(px.prefix, px);
    }
    r.dnsServers = [
      ...new Map([...(r.dnsServers || []), ...p.dnsServers].map(d => [d.address, d])).values(),
    ];
  }

  const allPrefixes = new Map();
  for (const [, r] of routers) {
    for (const [k, px] of r.prefixes) {
      if (!allPrefixes.has(k)) allPrefixes.set(k, { ...px, announcedBy: [] });
      allPrefixes.get(k).announcedBy.push(r.router);
    }
  }

  // Rogue-RA detection: unexpected router, or hop-limit != 255 tamper, or
  // conflicting prefixes / default-router claims.
  const anomalies = [];
  const expected = new Set(expectedRouters.map(e => e.toLowerCase()));
  for (const [router, r] of routers) {
    if (expected.size && !expected.has(router.toLowerCase())) {
      anomalies.push({
        type: 'unexpected-router',
        severity: 'High',
        confidence: 'medium',
        router,
        evidence: `RA received from ${router}, which is not in the expected router set.`,
      });
    }
    if (r.hopLimit !== 255 && r.count > 0) {
      anomalies.push({
        type: 'hop-limit-tamper',
        severity: 'Medium',
        confidence: 'medium',
        router,
        evidence: `RA hop limit is ${r.hopLimit}; genuine RAs must carry 255 (RFC 4861 §6.1.2).`,
      });
    }
    if (r.routerLifetime === 0 && r.count > 0) {
      anomalies.push({
        type: 'router-deprecation',
        severity: 'Low',
        confidence: 'high',
        router,
        evidence: `RA with router lifetime 0 — ${router} is withdrawing as default router.`,
      });
    }
  }
  for (const [prefix, px] of allPrefixes) {
    if (px.announcedBy.length > 1) {
      anomalies.push({
        type: 'prefix-conflict',
        severity: 'Medium',
        confidence: 'high',
        prefix,
        evidence: `Prefix ${prefix} announced by multiple routers: ${px.announcedBy.join(', ')}.`,
      });
    }
  }

  const dnsServers = [];
  for (const [, r] of routers)
    for (const d of r.dnsServers || []) dnsServers.push({ ...d, announcedBy: r.router });

  return {
    routers: [...routers.values()].map(r => ({
      router: r.router,
      mac: r.mac,
      isDefaultRouter: r.isDefaultRouter,
      routerLifetime: r.routerLifetime,
      dhcpMode: r.dhcpMode,
      mtu: r.mtu,
      observations: r.count,
      prefixes: [...r.prefixes.keys()],
    })),
    prefixes: [...allPrefixes.values()],
    dnsServers,
    anomalies,
    stats: {
      routerCount: routers.size,
      prefixCount: allPrefixes.size,
      dnsServerCount: dnsServers.length,
      slaacPrefixes: [...allPrefixes.values()].filter(p => p.slaacEnabled).length,
    },
  };
}

/**
 * Summarize RA analysis as a report finding.
 * @param {ReturnType<typeof analyzeRouterAdvertisements>} result
 */
export function raFinding(result) {
  const high = result.anomalies.filter(a => a.severity === 'High');
  return {
    title: `IPv6 router-advertisement analysis — ${result.stats.routerCount} router(s), ${result.stats.prefixCount} prefix(es)`,
    severity: high.length ? 'High' : 'Info',
    confidence: result.stats.routerCount ? 'high' : 'low',
    dhcpMode: result.routers.map(r => r.dhcpMode),
    slaacPrefixes: result.prefixes.filter(p => p.slaacEnabled).map(p => p.prefix),
    dnsServers: result.dnsServers.map(d => d.address),
    anomalies: result.anomalies,
    evidence:
      `${result.stats.routerCount} distinct RA source(s); ` +
      `${result.stats.slaacPrefixes} SLAAC-capable prefix(es); ` +
      `${result.anomalies.length} anomalie(s) flagged.`,
  };
}

export const IPV6_RA_ANALYZER = {
  parseRouterAdvertisement,
  analyzeRouterAdvertisements,
  raFinding,
};
export default IPV6_RA_ANALYZER;
