/**
 * wsDiscoveryIntel.js — WS-Discovery probe-match mining for host discovery.
 *
 * Implements Dark-Matter idea-bank item 00132 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00132 WS-Discovery probe mining — use WS-Discovery probes to find
 *      announcing endpoints and their XAddrs hostnames.
 *
 * WS-Discovery devices answer multicast probes with ProbeMatch SOAP
 * envelopes. Each match carries XAddrs (transport URLs — the actual
 * hostnames/IPs), Types (device capabilities), Scopes (classification) and
 * a MetadataVersion. This engine parses those envelopes (or pre-extracted
 * match objects supplied by the caller), extracts every XAddrs hostname,
 * normalises duplicate announcements, and ranks endpoints by metadata
 * freshness — converting discovery traffic into structured host intel.
 *
 * All functions are pure and side-effect free: they parse supplied data.
 * No network I/O happens in this module.
 */

/** XML entity decoder for the small set used in WS-Discovery payloads. */
function unescapeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extract the text content of the first <...:TagName>…</...:TagName>
 * occurrence (namespace-prefix agnostic), or null when absent.
 * @param {string} xml
 * @param {string} tag
 * @returns {string|null}
 */
function firstTag(xml, tag) {
  const re = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)</[^>]*:?${tag}\\s*>`, 'i');
  const m = re.exec(xml);
  return m ? unescapeXml(m[1]).trim() : null;
}

/**
 * Extract ALL text contents of <...:TagName>…</...:TagName> occurrences.
 * @param {string} xml
 * @param {string} tag
 * @returns {string[]}
 */
function allTags(xml, tag) {
  const re = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)</[^>]*:?${tag}\\s*>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(unescapeXml(m[1]).trim());
  return out.filter(Boolean);
}

/**
 * Pull the hostname out of a URL string, or null when unparsable.
 * @param {string} url
 * @returns {string|null}
 */
export function xaddrHost(url) {
  if (!url) return null;
  try {
    return new URL(String(url).trim()).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Parse one WS-Discovery ProbeMatch block (a SOAP envelope fragment or a
 * plain object already shaped by the caller) into a canonical endpoint
 * record. Accepts both raw XML strings and objects shaped
 * {xAddrs:[], types:[], scopes:[], metadataVersion, endpointReference}.
 * @param {string|object} match
 * @returns {{xAddrs: string[], hosts: string[], types: string[], scopes: string[], metadataVersion: number|null, endpointReference: string|null}|null}
 */
export function parseProbeMatch(match) {
  let xAddrs = [];
  let types = [];
  let scopes = [];
  let metadataVersion = null;
  let endpointReference = null;

  if (typeof match === 'string') {
    const xaddrRaw = firstTag(match, 'XAddrs');
    xAddrs = (xaddrRaw || '').split(/\s+/).filter(Boolean);
    types = (firstTag(match, 'Types') || '').split(/\s+/).filter(Boolean);
    scopes = (firstTag(match, 'Scopes') || '').split(/\s+/).filter(Boolean);
    const mdv = firstTag(match, 'MetadataVersion');
    metadataVersion = mdv !== null && mdv !== '' && !Number.isNaN(Number(mdv)) ? Number(mdv) : null;
    endpointReference = firstTag(match, 'Address');
  } else if (match && typeof match === 'object') {
    xAddrs = (Array.isArray(match.xAddrs) ? match.xAddrs : [match.xAddrs]).filter(Boolean).map(String);
    types = (Array.isArray(match.types) ? match.types : [match.types]).filter(Boolean).map(String);
    scopes = (Array.isArray(match.scopes) ? match.scopes : [match.scopes]).filter(Boolean).map(String);
    metadataVersion = match.metadataVersion != null ? Number(match.metadataVersion) : null;
    endpointReference = match.endpointReference || match.epr || null;
  } else {
    return null;
  }

  if (xAddrs.length === 0) return null;
  const hosts = [...new Set(xAddrs.map(xaddrHost).filter(Boolean))];
  return { xAddrs, hosts, types, scopes, metadataVersion, endpointReference };
}

/**
 * Mine a batch of ProbeMatch payloads into structured discovery
 * intelligence: unique announcing endpoints (deduped by endpoint
 * reference, keeping the freshest MetadataVersion), the full XAddrs
 * hostname set, and type/scope tallies.
 * @param {Array<string|object>} matches
 * @returns {{
 *   endpoints: Array<{endpointReference: string|null, xAddrs: string[], hosts: string[], types: string[], scopes: string[], metadataVersion: number|null}>,
 *   hosts: string[],
 *   deviceTypes: Array<{type: string, count: number}>,
 *   scopes: Array<{scope: string, count: number}>,
 *   matchCount: number,
 *   endpointCount: number
 * }}
 */
export function mineProbeMatches(matches) {
  const byEpr = new Map();
  const hostSet = new Set();
  const typeCounts = new Map();
  const scopeCounts = new Map();

  for (const raw of matches || []) {
    const rec = parseProbeMatch(raw);
    if (!rec) continue;
    const key = rec.endpointReference || rec.xAddrs.slice().sort().join('|');
    const existing = byEpr.get(key);
    const isFresher = !existing
      || (rec.metadataVersion != null && (existing.metadataVersion == null || rec.metadataVersion > existing.metadataVersion));
    if (isFresher) byEpr.set(key, rec);
  }

  for (const rec of byEpr.values()) {
    for (const h of rec.hosts) hostSet.add(h);
    for (const t of rec.types) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    for (const s of rec.scopes) scopeCounts.set(s, (scopeCounts.get(s) || 0) + 1);
  }

  const tally = (map, label) => [...map.entries()]
    .map(([name, count]) => ({ [label]: name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    endpoints: [...byEpr.values()],
    hosts: [...hostSet].sort(),
    deviceTypes: tally(typeCounts, 'type'),
    scopes: tally(scopeCounts, 'scope'),
    matchCount: (matches || []).length,
    endpointCount: byEpr.size,
  };
}

/**
 * Flag endpoints whose XAddrs expose internal/private hostnames or
 * non-standard ports — useful triage hints on the announcing surface.
 * @param {Array<{xAddrs: string[], hosts: string[]}>} endpoints
 * @returns {Array<{host: string, xAddrs: string[], flags: string[]}>}
 */
export function flagInterestingEndpoints(endpoints) {
  const out = [];
  for (const ep of endpoints || []) {
    for (const url of ep.xAddrs || []) {
      let parsed = null;
      try { parsed = new URL(url); } catch { continue; }
      const flags = [];
      const host = parsed.hostname.toLowerCase();
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|fd[0-9a-f]{0,2}:|\.local$)/i.test(host)
        || host.endsWith('.local') || host === 'localhost') {
        flags.push('private-or-linklocal-hostname');
      }
      if (parsed.port && !['80', '443'].includes(parsed.port)) flags.push(`non-standard-port:${parsed.port}`);
      if (/admin|mgmt|config|debug|test/i.test(url)) flags.push('suspicious-path-keyword');
      if (flags.length > 0) out.push({ host, xAddrs: [url], flags });
    }
  }
  return out;
}

export const WS_DISCOVERY_INTEL = {
  xaddrHost,
  parseProbeMatch,
  mineProbeMatches,
  flagInterestingEndpoints,
};
export default WS_DISCOVERY_INTEL;
