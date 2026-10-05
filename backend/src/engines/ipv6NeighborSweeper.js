/**
 * ipv6NeighborSweeper.js — IPv6 neighbor-discovery sweep analyzer.
 *
 * Idea 00381: use IPv6 neighbor solicitation to enumerate live hosts on
 * local-adjacent segments.
 *
 * This module is the *analyzer* half of the sweep: it takes captured
 * Neighbor Solicitation (NS) / Neighbor Advertisement (NA) observations —
 * as plain field objects produced by the platform's packet capture layer —
 * and builds a live-host inventory for the authorized engagement scope.
 * No raw sockets or live network access happen here; the functions are pure.
 */

/**
 * @typedef {Object} NeighborObservation
 * @property {'NS'|'NA'} type - ICMPv6 message type observed.
 * @property {string} sourceIp - Source IPv6 address (link-local or global).
 * @property {string} targetIp - The solicited/advertised IPv6 address.
 * @property {string} [sourceMac] - Source-link-layer option MAC (NA / NS with SLLAO).
 * @property {string} [targetMac] - Target-link-layer option MAC (NA with TLLAO).
 * @property {boolean} [router] - NA router flag.
 * @property {boolean} [solicited] - NA solicited flag.
 * @property {boolean} [override] - NA override flag.
 * @property {number} [seenAt] - Unix ms timestamp of observation.
 */

/**
 * @typedef {Object} SweepHost
 * @property {string} ip - IPv6 address confirmed live.
 * @property {string|null} mac - Resolved MAC address (null if unanswered).
 * @property {boolean} isRouter - Advertised router flag observed.
 * @property {number} confirmations - How many advertisements corroborate liveness.
 * @property {'live'|'silent'|'flapping'} state - Liveness classification.
 */

/** Normalize an IPv6 address string for map keys (lowercase, expanded form). */
export function normalizeIpv6(addr) {
  if (typeof addr !== 'string') return '';
  const lower = addr.toLowerCase().trim();
  // Expand :: notation so keys are canonical.
  const [head, tail] = lower.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = [
    ...headParts,
    ...Array(Math.max(0, missing)).fill('0'),
    ...tailParts,
  ];
  if (parts.length !== 8) return lower; // not a plain address; return as-is
  return parts.map((p) => p.padStart(4, '0')).join(':');
}

/**
 * Build a live-host inventory from NS/NA observations.
 * @param {NeighborObservation[]} observations
 * @param {{targetPrefix?: string, flapWindowMs?: number}} [options]
 * @returns {{hosts: SweepHost[], routers: string[], dadConflicts: string[], stats: object}}
 */
export function analyzeNeighborSweep(observations = [], options = {}) {
  const { targetPrefix = '', flapWindowMs = 30000 } = options;
  const byIp = new Map();

  const touch = (ip) => {
    const key = normalizeIpv6(ip);
    if (!byIp.has(key)) {
      byIp.set(key, {
        ip,
        macs: new Map(),
        isRouter: false,
        confirmations: 0,
        firstSeen: Infinity,
        lastSeen: -Infinity,
      });
    }
    return byIp.get(key);
  };

  for (const obs of observations) {
    if (!obs || (obs.type !== 'NS' && obs.type !== 'NA')) continue;
    const key = normalizeIpv6(obs.targetIp);
    if (targetPrefix && !key.startsWith(normalizeIpv6(targetPrefix).replace(/:+$/, ''))) continue;
    const entry = touch(obs.targetIp);
    entry.firstSeen = Math.min(entry.firstSeen, obs.seenAt ?? Date.now());
    entry.lastSeen = Math.max(entry.lastSeen, obs.seenAt ?? Date.now());
    const mac = (obs.targetMac || obs.sourceMac || '').toLowerCase();
    if (mac) entry.macs.set(mac, (entry.macs.get(mac) || 0) + 1);
    if (obs.type === 'NA') {
      entry.confirmations += 1;
      if (obs.router) entry.isRouter = true;
    }
  }

  const hosts = [];
  const routers = [];
  const dadConflicts = [];
  const flapCandidates = [];

  for (const [, entry] of byIp) {
    const macList = [...entry.macs.entries()].sort((a, b) => b[1] - a[1]);
    const mac = macList.length ? macList[0][0] : null;
    if (macList.length > 1) dadConflicts.push(entry.ip); // two MACs claim one IP: DAD/anomaly
    const window = entry.lastSeen - entry.firstSeen;
    const flapping = entry.confirmations >= 2 && window < flapWindowMs && macList.length > 1;
    const state = entry.confirmations === 0 ? 'silent' : flapping ? 'flapping' : 'live';
    if (flapping) flapCandidates.push(entry.ip);
    const host = {
      ip: entry.ip,
      mac,
      isRouter: entry.isRouter,
      confirmations: entry.confirmations,
      state,
    };
    hosts.push(host);
    if (entry.isRouter) routers.push(entry.ip);
  }

  hosts.sort((a, b) => b.confirmations - a.confirmations || (a.ip < b.ip ? -1 : 1));

  return {
    hosts,
    routers,
    dadConflicts,
    stats: {
      totalObserved: byIp.size,
      live: hosts.filter((h) => h.state === 'live').length,
      silent: hosts.filter((h) => h.state === 'silent').length,
      flapping: flapCandidates,
    },
  };
}

/**
 * Summarize the sweep into a hunt-report finding.
 * @param {ReturnType<typeof analyzeNeighborSweep>} result
 * @param {string} scopeLabel - Human-readable scope label, e.g. 'fd00::/64'.
 */
export function sweepFinding(result, scopeLabel = 'observed segment') {
  const liveIps = result.hosts.filter((h) => h.state === 'live').map((h) => h.ip);
  const confidence = liveIps.length >= 3 ? 'high' : liveIps.length >= 1 ? 'medium' : 'low';
  return {
    title: `IPv6 neighbor-discovery sweep — ${liveIps.length} live host(s) on ${scopeLabel}`,
    severity: 'Info',
    confidence,
    hosts: liveIps,
    routers: result.routers,
    anomalies: {
      dadConflicts: result.dadConflicts,
      flapping: result.stats.flapping,
    },
    evidence: `${result.stats.live} host(s) answered neighbor solicitations; ` +
      `${result.stats.silent} solicited target(s) stayed silent; ` +
      `${result.routers.length} router(s) advertised.`,
  };
}

export const IPV6_NEIGHBOR_SWEEPER = { normalizeIpv6, analyzeNeighborSweep, sweepFinding };
export default IPV6_NEIGHBOR_SWEEPER;
