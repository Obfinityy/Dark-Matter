/**
 * hackerTargetReverseIntel.js — Reverse-IP sweep aggregation engine.
 *
 * Implements idea-bank item 00184 (HackerTarget reverse-IP sweep): sweep
 * reverse-IP lookups across the target's netblocks and aggregate the results
 * with cross-netblock dedup. Reverse-IP data exposes sibling hosts on shared
 * infrastructure — virtual hosts, parked services, and forgotten apps that
 * share an IP with the target.
 *
 * Pure functions only: the caller performs the API lookups (respecting its
 * rate limits) and hands over {ip, hostnames[]} rows.
 */

/**
 * @typedef {object} ReverseIpRow
 * @property {string} ip
 * @property {string[]} hostnames   PTR / reverse-IP hostnames observed for this IP
 */

/**
 * Aggregate reverse-IP rows across a sweep with full dedup.
 * @param {ReverseIpRow[]} rows
 * @returns {{hostnameToIps: Map<string, string[]>, ipToHostnames: Map<string, string[]>, uniqueHostnames: number, uniqueIps: number}}
 */
export function aggregateReverseLookups(rows) {
  const hostnameToIps = new Map();
  const ipToHostnames = new Map();

  for (const row of rows ?? []) {
    const ip = String(row.ip ?? '').trim();
    if (!ip) continue;
    const names = new Set();
    for (const raw of row.hostnames ?? []) {
      const host = String(raw).trim().toLowerCase().replace(/\.$/, '');
      if (host && host !== 'nxdomain' && host !== 'unknown') names.add(host);
    }
    ipToHostnames.set(ip, [...names].sort());
    for (const host of names) {
      const list = hostnameToIps.get(host) ?? [];
      if (!list.includes(ip)) list.push(ip);
      hostnameToIps.set(host, list);
    }
  }
  return {
    hostnameToIps,
    ipToHostnames,
    uniqueHostnames: hostnameToIps.size,
    uniqueIps: ipToHostnames.size,
  };
}

/**
 * Filter aggregate results to hosts belonging to the target's domain scope.
 * @param {Map<string, string[]>} hostnameToIps
 * @param {string[]} domainSuffixes  e.g. ['example.com']
 * @returns {{inScope: Array<{hostname: string, ips: string[]}>, outOfScope: Array<{hostname: string, ips: string[]}>}}
 */
export function scopeSplit(hostnameToIps, domainSuffixes = []) {
  const suffixes = domainSuffixes.map(s => s.toLowerCase());
  const inScope = [];
  const outOfScope = [];
  for (const [hostname, ips] of hostnameToIps) {
    const hit = suffixes.some(s => hostname === s || hostname.endsWith(`.${s}`));
    (hit ? inScope : outOfScope).push({ hostname, ips: [...ips] });
  }
  const byName = (a, b) => a.hostname.localeCompare(b.hostname);
  return { inScope: inScope.sort(byName), outOfScope: outOfScope.sort(byName) };
}

/**
 * Summarize one sweep: netblock coverage and multi-IP hosts (hosts on several
 * IPs are often load-balanced production assets worth extra attention).
 * @param {ReverseIpRow[]} rows
 * @returns {{totalRows: number, uniqueHostnames: number, multiIpHosts: string[], emptyIps: string[]}}
 */
export function summarizeSweep(rows) {
  const agg = aggregateReverseLookups(rows);
  const multiIpHosts = [...agg.hostnameToIps.entries()]
    .filter(([, ips]) => ips.length > 1)
    .map(([host]) => host)
    .sort();
  const emptyIps = [...agg.ipToHostnames.entries()]
    .filter(([, names]) => names.length === 0)
    .map(([ip]) => ip)
    .sort();
  return {
    totalRows: rows?.length ?? 0,
    uniqueHostnames: agg.uniqueHostnames,
    multiIpHosts,
    emptyIps,
  };
}
