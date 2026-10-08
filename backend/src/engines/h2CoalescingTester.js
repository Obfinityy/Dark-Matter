/**
 * h2CoalescingTester.js — HTTP/2 connection-coalescing analysis engine.
 *
 * Determines whether separate origins can share one HTTP/2 connection
 * (RFC 7540 §9.1.1): same IP, same port, and a certificate valid for both
 * names. On authorized targets this maps which hosts share certificates and
 * IPs — useful for understanding edge topology and for spotting origins that
 * are unintentionally reachable through a coalesced connection.
 *
 * Pure analysis of observed data (resolved IPs, certificate SAN lists); it
 * performs no network probing itself.
 */

/**
 * Decide whether two origins may be coalesced onto one connection.
 * @param {{host: string, ip: string, port?: number, sans: string[]}} originA
 * @param {{host: string, ip: string, port?: number, sans: string[]}} originB
 * @returns {{coalescible: boolean, reasons: string[], blockers: string[]}}
 */
export function canCoalesce(originA = {}, originB = {}) {
  const reasons = [];
  const blockers = [];
  const a = normalizeOrigin(originA);
  const b = normalizeOrigin(originB);
  if (!a.host || !b.host) {
    blockers.push('missing host information');
    return { coalescible: false, reasons, blockers };
  }
  if (a.ip && b.ip && a.ip === b.ip) reasons.push(`shared IP ${a.ip}`);
  else blockers.push(`different IPs (${a.ip || 'unknown'} vs ${b.ip || 'unknown'})`);
  if (a.port === b.port) reasons.push(`same port ${a.port}`);
  else blockers.push(`different ports (${a.port} vs ${b.port})`);
  const sansA = new Set(a.sans);
  const sansB = new Set(b.sans);
  const shared = [...sansA].filter(s => sansB.has(s));
  const crossCovered = sansCovered(a.host, b.sans) && sansCovered(b.host, a.sans);
  if (shared.length > 0 || crossCovered) {
    reasons.push(
      crossCovered
        ? 'certificate presented by one origin is valid for the other host'
        : `shared SAN entries: ${shared.slice(0, 5).join(', ')}${shared.length > 5 ? '…' : ''}`
    );
  } else {
    blockers.push('no certificate SAN overlap between the two origins');
  }
  return { coalescible: blockers.length === 0, reasons, blockers };
}

/**
 * Group a set of origins into coalescible clusters.
 * @param {{host: string, ip: string, port?: number, sans: string[]}[]} origins
 * @returns {{clusters: string[][], singletonCount: number, coalescingRatePct: number}}
 */
export function mapCoalescibleGroups(origins = []) {
  const list = (Array.isArray(origins) ? origins : []).filter(o => o && o.host);
  const parent = new Map(list.map(o => [o.host, o.host]));
  const find = x => (parent.get(x) === x ? x : parent.set(x, find(parent.get(x))).get(x));
  const union = (x, y) => {
    parent.set(find(x), find(y));
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (canCoalesce(list[i], list[j]).coalescible) union(list[i].host, list[j].host);
    }
  }
  const clusters = new Map();
  for (const o of list) {
    const root = find(o.host);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(o.host);
  }
  const all = [...clusters.values()].map(c => [...new Set(c)].sort());
  const inGroups = all.filter(c => c.length > 1);
  return {
    clusters: inGroups.sort((a, b) => b.length - a.length),
    singletonCount: all.length - inGroups.length,
    coalescingRatePct:
      list.length === 0 ? 0 : Math.round((inGroups.flat().length / list.length) * 10000) / 100,
  };
}

/**
 * Estimate connection-count savings if clients coalesce aggressively.
 * @param {{clusters: string[][], singletonCount: number}} groupMap output of mapCoalescibleGroups
 * @returns {{origins: number, connectionsWithoutCoalescing: number, connectionsWithCoalescing: number, savedPct: number}}
 */
export function predictConnectionReuse(groupMap = {}) {
  const clusters = Array.isArray(groupMap.clusters) ? groupMap.clusters : [];
  const singletons = Number.isFinite(groupMap.singletonCount) ? groupMap.singletonCount : 0;
  const clustered = clusters.flat().length;
  const origins = clustered + singletons;
  const withCoalescing = clusters.length + singletons;
  return {
    origins,
    connectionsWithoutCoalescing: origins,
    connectionsWithCoalescing: withCoalescing,
    savedPct: origins === 0 ? 0 : Math.round(((origins - withCoalescing) / origins) * 10000) / 100,
  };
}

/**
 * Security assessment of a coalescing map: origins that share a certificate
 * and IP may be reachable through each other's connections, which matters
 * for scope boundaries on authorized tests.
 * @param {{clusters: string[][]}} groupMap
 * @returns {{cluster: string[], hosts: number, note: string, riskScore: number}[]}
 */
export function assessCoalescingRisk(groupMap = {}) {
  const clusters = Array.isArray(groupMap.clusters) ? groupMap.clusters : [];
  return clusters.map(cluster => {
    const internal = cluster.filter(h => /(^|\.)(internal|intranet|staging|dev|test)\b/i.test(h));
    const riskScore = internal.length > 0 ? 70 : 25;
    return {
      cluster,
      hosts: cluster.length,
      riskScore,
      note:
        internal.length > 0
          ? `Coalesced cluster exposes non-production hosts (${internal.join(', ')}); a connection opened for a public origin may carry requests to these. Verify scope.`
          : 'Coalesced cluster of production hosts sharing certificate and IP — expected CDN/edge behavior; keep scope notes updated.',
    };
  });
}

function normalizeOrigin(o) {
  return {
    host: String(o.host || '').toLowerCase(),
    ip: String(o.ip || ''),
    port: Number.isFinite(o.port) ? o.port : 443,
    sans: (Array.isArray(o.sans) ? o.sans : []).map(s => String(s).toLowerCase()),
  };
}

function sansCovered(host, sansList) {
  const h = String(host).toLowerCase();
  for (const san of sansList) {
    const s = String(san).toLowerCase();
    if (s === h) return true;
    if (s.startsWith('*.') && h.endsWith(s.slice(1)) && h.split('.').length === s.split('.').length)
      return true;
  }
  return false;
}

export const H2_COALESCING = {
  canCoalesce,
  mapCoalescibleGroups,
  predictConnectionReuse,
  assessCoalescingRisk,
};
