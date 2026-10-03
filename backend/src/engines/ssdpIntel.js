/**
 * ssdpIntel.js — SSDP M-SEARCH response mining for host discovery.
 *
 * Implements Dark-Matter idea-bank item 00131 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00131 SSDP M-SEARCH host discovery — send SSDP discovery multicasts to
 *      enumerate responding devices and their description URLs.
 *
 * This engine is the parse side of that idea: the caller performs the
 * multicast (its own network code, under its own authorization scope) and
 * hands the engine the raw response payloads. The engine parses SSDP
 * HTTP-like response headers (LOCATION, USN, ST/NT, SERVER, CACHE-CONTROL),
 * extracts every responding device's description URL and the hostname it
 * resolves from, dedupes by USN, groups devices by host, and classifies
 * device/service types — turning raw discovery chatter into structured
 * host intelligence.
 *
 * All functions are pure and side-effect free: they parse supplied
 * response strings. No network I/O happens in this module.
 */

/**
 * Parse one raw SSDP response (or NOTIFY advertisement) into a header map.
 * Accepts either the full text ("HTTP/1.1 200 OK\r\n...") or just the
 * header block. Header names are case-insensitive.
 * @param {string} raw
 * @returns {Record<string, string>} lower-cased header names → values
 */
export function parseSsdpHeaders(raw) {
  const headers = {};
  const lines = String(raw || '').split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (name && value) headers[name] = value;
  }
  return headers;
}

/**
 * Extract the hostname (or literal IP) from a URL-like LOCATION value.
 * @param {string} location
 * @returns {string|null}
 */
export function locationHost(location) {
  if (!location) return null;
  try {
    return new URL(String(location).trim()).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Convert a single parsed SSDP response into a canonical device record.
 * Returns null when the response carries no usable identity (no USN/ST/NT).
 * @param {Record<string, string>} headers
 * @returns {{usn: string, deviceType: string, location: string|null, host: string|null, server: string|null, maxAge: number|null, notificationType: string|null}|null}
 */
export function toDeviceRecord(headers) {
  const usn = headers['usn'];
  const st = headers['st'] || headers['nt'] || null;
  if (!usn && !st) return null;
  const location = headers['location'] || null;
  const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(headers['cache-control'] || '');
  return {
    usn: (usn || 'unknown').trim(),
    deviceType: (st || 'unknown').trim(),
    location,
    host: locationHost(location),
    server: headers['server'] ? headers['server'].trim() : null,
    maxAge: maxAgeMatch ? Number(maxAgeMatch[1]) : null,
    notificationType: headers['nt'] ? headers['nt'].trim() : null,
  };
}

/**
 * Mine a batch of raw SSDP responses: dedupe by USN (keeping the record
 * with the richest detail), group responding devices by host, and count
 * device types. This is the "enumeration result" of an M-SEARCH sweep.
 * @param {string[]} responses raw response payloads from the caller
 * @returns {{
 *   devices: Array<{usn: string, deviceType: string, location: string|null, host: string|null, server: string|null, maxAge: number|null, notificationType: string|null}>,
 *   hosts: Array<{host: string, deviceCount: number, usns: string[]}>,
 *   deviceTypes: Array<{type: string, count: number}>,
 *   rawCount: number,
 *   uniqueCount: number
 * }}
 */
export function mineSsdpResponses(responses) {
  const byUsn = new Map();
  for (const raw of responses || []) {
    const record = toDeviceRecord(parseSsdpHeaders(raw));
    if (!record) continue;
    const existing = byUsn.get(record.usn);
    // Prefer the record that carries a LOCATION URL when duplicates arrive.
    if (!existing || (!existing.location && record.location)) {
      byUsn.set(record.usn, record);
    }
  }
  const devices = [...byUsn.values()];
  const byHost = new Map();
  const typeCounts = new Map();
  for (const d of devices) {
    const key = d.host || '(unknown host)';
    if (!byHost.has(key)) byHost.set(key, { host: key, deviceCount: 0, usns: [] });
    const h = byHost.get(key);
    h.deviceCount += 1;
    h.usns.push(d.usn);
    typeCounts.set(d.deviceType, (typeCounts.get(d.deviceType) || 0) + 1);
  }
  return {
    devices,
    hosts: [...byHost.values()].sort((a, b) => b.deviceCount - a.deviceCount),
    deviceTypes: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    rawCount: (responses || []).length,
    uniqueCount: devices.length,
  };
}

/**
 * Extract candidate presentation/host references from device description
 * URL path fragments the caller may supply (e.g. friendlyName hints).
 * @param {string[]} urls description URLs observed on the network
 * @returns {string[]} unique hostnames referenced, lower-cased
 */
export function hostsFromDescriptionUrls(urls) {
  const hosts = new Set();
  for (const url of urls || []) {
    const host = locationHost(url);
    if (host) hosts.add(host);
  }
  return [...hosts].sort();
}

export const SSDP_INTEL = {
  parseSsdpHeaders,
  locationHost,
  toDeviceRecord,
  mineSsdpResponses,
  hostsFromDescriptionUrls,
};
export default SSDP_INTEL;
