/**
 * viewDnsPipelineIntel.js — Multi-tool DNS/OSINT asset pipeline engine.
 *
 * Implements idea-bank item 00185 (ViewDNS.info tool-chain automation):
 * combine reverse-IP, IP-history, and port-scan outputs into one normalized
 * asset pipeline. Each tool sees a different facet of the same infrastructure;
 * merged together they produce a single prioritized asset inventory with
 * source attribution, so downstream hunts know exactly which asset came
 * from where and why it matters.
 *
 * Pure functions: the caller runs the individual tools and passes their
 * parsed outputs in.
 */

/**
 * @typedef {object} ReverseIpInput   { ip: string, hostnames: string[] }
 * @typedef {object} IpHistoryInput   { ip: string, host: string, firstSeen?: number, lastSeen?: number }
 * @typedef {object} PortScanInput    { ip: string, ports: Array<{port: number, service?: string, state?: string}> }
 */

/**
 * Merge the three tool outputs into a unified asset list.
 * @param {object} inputs
 * @param {ReverseIpInput[]} [inputs.reverseIp]
 * @param {IpHistoryInput[]} [inputs.ipHistory]
 * @param {PortScanInput[]} [inputs.portScan]
 * @returns {Array<{ip: string, hostnames: string[], openPorts: number[], services: string[], sources: string[], firstSeen: number|null, lastSeen: number|null}>}
 */
export function mergeToolOutputs({ reverseIp = [], ipHistory = [], portScan = [] } = {}) {
  const assets = new Map();

  const ensure = ip => {
    let asset = assets.get(ip);
    if (!asset) {
      asset = {
        ip,
        hostnames: new Set(),
        openPorts: new Set(),
        services: new Set(),
        sources: new Set(),
        firstSeen: null,
        lastSeen: null,
      };
      assets.set(ip, asset);
    }
    return asset;
  };

  for (const row of reverseIp) {
    if (!row?.ip) continue;
    const asset = ensure(String(row.ip).trim());
    for (const h of row.hostnames ?? []) {
      const host = String(h).trim().toLowerCase().replace(/\.$/, '');
      if (host) asset.hostnames.add(host);
    }
    asset.sources.add('reverse-ip');
  }

  for (const row of ipHistory) {
    if (!row?.ip) continue;
    const asset = ensure(String(row.ip).trim());
    const host = String(row.host ?? '')
      .trim()
      .toLowerCase();
    if (host) asset.hostnames.add(host);
    if (typeof row.firstSeen === 'number')
      asset.firstSeen =
        asset.firstSeen == null ? row.firstSeen : Math.min(asset.firstSeen, row.firstSeen);
    if (typeof row.lastSeen === 'number')
      asset.lastSeen =
        asset.lastSeen == null ? row.lastSeen : Math.max(asset.lastSeen, row.lastSeen);
    asset.sources.add('ip-history');
  }

  for (const row of portScan) {
    if (!row?.ip) continue;
    const asset = ensure(String(row.ip).trim());
    for (const p of row.ports ?? []) {
      const port = Number(p.port);
      if (!Number.isFinite(port)) continue;
      asset.openPorts.add(port);
      if (p.service) asset.services.add(String(p.service).toLowerCase());
    }
    asset.sources.add('port-scan');
  }

  return [...assets.values()].map(a => ({
    ip: a.ip,
    hostnames: [...a.hostnames].sort(),
    openPorts: [...a.openPorts].sort((x, y) => x - y),
    services: [...a.services].sort(),
    sources: [...a.sources].sort(),
    firstSeen: a.firstSeen,
    lastSeen: a.lastSeen,
  }));
}

/** Ports/services that raise the priority of an asset during a hunt. */
const HIGH_VALUE_PORTS = new Set([
  22, 3389, 5985, 6379, 27017, 9200, 5601, 8080, 8443, 9090, 2375, 2376,
]);

/**
 * Prioritize merged assets for hunt scheduling.
 * Scoring: multiple sources (+10 each beyond the first), open ports (+3 each),
 * high-value ports (+15 each), multiple hostnames (+2 each beyond the first).
 * @param {ReturnType<mergeToolOutputs>} assets
 * @returns {Array<object & {priority: number, reason: string[]}>}
 */
export function prioritizeAssets(assets) {
  return (assets ?? [])
    .map(asset => {
      let priority = 0;
      const reason = [];
      if (asset.sources.length > 1) {
        priority += (asset.sources.length - 1) * 10;
        reason.push(`corroborated by ${asset.sources.length} tools`);
      }
      if (asset.openPorts.length) {
        priority += asset.openPorts.length * 3;
        reason.push(`${asset.openPorts.length} open ports`);
      }
      const hot = asset.openPorts.filter(p => HIGH_VALUE_PORTS.has(p));
      if (hot.length) {
        priority += hot.length * 15;
        reason.push(`high-value ports: ${hot.join(', ')}`);
      }
      if (asset.hostnames.length > 1) {
        priority += (asset.hostnames.length - 1) * 2;
        reason.push(`${asset.hostnames.length} hostnames`);
      }
      return { ...asset, priority, reason };
    })
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Find assets that appear in IP history but not in current reverse-IP —
 * hosts that moved or were retired (possible dangling-IP scenarios).
 * @param {ReverseIpInput[]} reverseIp
 * @param {IpHistoryInput[]} ipHistory
 * @returns {Array<{ip: string, host: string, lastSeen: number|null}>}
 */
export function findRetiredAssets(reverseIp = [], ipHistory = []) {
  const currentNames = new Set();
  for (const row of reverseIp) {
    for (const h of row.hostnames ?? []) currentNames.add(String(h).trim().toLowerCase());
  }
  const retired = [];
  const seenPairs = new Set();
  for (const row of ipHistory) {
    const host = String(row.host ?? '')
      .trim()
      .toLowerCase();
    const key = `${row.ip}|${host}`;
    if (!host || currentNames.has(host) || seenPairs.has(key)) continue;
    seenPairs.add(key);
    retired.push({ ip: String(row.ip).trim(), host, lastSeen: row.lastSeen ?? null });
  }
  return retired;
}
