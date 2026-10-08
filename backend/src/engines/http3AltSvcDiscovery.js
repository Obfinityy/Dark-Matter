/**
 * http3AltSvcDiscovery.js — HTTP/3 discovery via Alt-Svc for autonomous bug bounty.
 *
 * Implements idea-bank item 00429: parse Alt-Svc response headers to map
 * HTTP/3 (and other alternate-service) endpoints advertised by a server.
 *
 * Servers advertise HTTP/3 availability in the Alt-Svc header (RFC 7838):
 * entries like `h3=":443"; ma=86400` name the protocol id, the alternate
 * port, and the max-age. The protocol id also reveals the QUIC draft
 * version the server last tracked (h3-29, h3-27, ...), fingerprinting its
 * deployment age. Parsing the header maps the QUIC surface for an
 * authorized engagement to inventory.
 *
 * All functions are pure and side-effect free: they parse Alt-Svc header
 * strings the caller observed during an authorized engagement. No QUIC or
 * HTTP probes are sent here.
 */

/**
 * Known Alt-Svc protocol ids -> human description.
 * @type {Record<string, string>}
 */
const PROTOCOL_LABELS = {
  h3: 'HTTP/3 (RFC 9114, QUIC v1)',
  'h3-29': 'HTTP/3 draft-29 (QUIC draft-29)',
  'h3-27': 'HTTP/3 draft-27 (QUIC draft-27)',
  'h3-25': 'HTTP/3 draft-25 (QUIC draft-25)',
  'h3-24': 'HTTP/3 draft-24 (QUIC draft-24)',
  'h3-23': 'HTTP/3 draft-23 (QUIC draft-23)',
  h2: 'HTTP/2 (alternate service)',
  h2c: 'HTTP/2 cleartext (alternate service)',
  http1: 'HTTP/1.1 (alternate service)',
  hq: 'HTTP/3 draft interop (hq)',
  quic: 'Google QUIC (gQUIC)',
};

/**
 * Split an Alt-Svc header value on top-level commas (commas inside
 * quoted strings are part of the value).
 * @param {string} value
 * @returns {string[]}
 */
function splitTopLevel(value) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of value) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

/**
 * Parse one Alt-Svc entry: `<protocol-id>="<host>:<port>"; ma=<n>; persist=1`.
 * @param {string} entry
 * @returns {{protocolId: string, authority: string|null, host: string|null, port: number|null, maxAge: number|null, persist: boolean}|null}
 */
export function parseAltSvcEntry(entry) {
  if (!entry || typeof entry !== 'string') return null;
  const trimmed = entry.trim();
  const m = /^([A-Za-z0-9_.-]+)\s*=\s*(?:"([^"]*)"|([^\s;]+))\s*(;.*)?$/.exec(trimmed);
  if (!m) return null;
  const protocolId = m[1];
  const authority = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : null;
  const paramStr = m[4] || '';

  let host = null;
  let port = null;
  if (authority) {
    const hm = /^(?:\[([^\]]+)\]|([^:]*))(?::(\d+))?$/.exec(authority);
    if (hm) {
      host = (hm[1] || hm[2] || '').toLowerCase() || null;
      if (host === '') host = null;
      port = hm[3] ? parseInt(hm[3], 10) : null;
    }
  }
  let maxAge = null;
  let persist = false;
  for (const param of paramStr
    .split(';')
    .map(p => p.trim())
    .filter(Boolean)) {
    const mm = /^ma\s*=\s*"?(\d+)"?$/i.exec(param);
    if (mm) {
      maxAge = parseInt(mm[1], 10);
      continue;
    }
    if (/^persist\s*=\s*"?1"?$/i.test(param)) persist = true;
  }
  return { protocolId, authority, host, port, maxAge, persist };
}

/**
 * Parse a full Alt-Svc header value (or array of values) into entries.
 * @param {string|string[]} value
 * @returns {Array<{protocolId: string, authority: string|null, host: string|null, port: number|null, maxAge: number|null, persist: boolean}>}
 */
export function parseAltSvcHeader(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const entries = [];
  for (const v of values) {
    for (const part of splitTopLevel(v)) {
      const entry = parseAltSvcEntry(part);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

/**
 * Describe a protocol id in human terms.
 * @param {string} protocolId
 * @returns {string}
 */
export function describeProtocol(protocolId) {
  if (PROTOCOL_LABELS[protocolId]) return PROTOCOL_LABELS[protocolId];
  if (/^h3-T\d+$/i.test(protocolId)) return 'HTTP/3 draft (QUIC interop draft)';
  if (/^h3-/i.test(protocolId)) return 'HTTP/3 draft version (QUIC pre-RFC)';
  return 'unknown alternate-service protocol';
}

/**
 * Discover HTTP/3 availability from observed Alt-Svc header values.
 * @param {string|string[]} value Alt-Svc header value(s).
 * @returns {{
 *   http3Available: boolean, http3Entries: Array, allEntries: Array,
 *   protocols: Array<{protocolId: string, description: string, ports: number[], maxAge: number|null}>,
 *   summary: string
 * }}
 */
export function discoverHttp3(value) {
  const allEntries = parseAltSvcHeader(value);
  const http3Entries = allEntries.filter(e => e.protocolId === 'h3' || /^h3-/i.test(e.protocolId));
  const byProto = new Map();
  for (const e of allEntries) {
    if (!byProto.has(e.protocolId))
      byProto.set(e.protocolId, {
        protocolId: e.protocolId,
        description: describeProtocol(e.protocolId),
        ports: new Set(),
        maxAge: null,
      });
    const p = byProto.get(e.protocolId);
    if (e.port !== null) p.ports.add(e.port);
    if (e.maxAge !== null && (p.maxAge === null || e.maxAge < p.maxAge)) p.maxAge = e.maxAge;
  }
  const protocols = [...byProto.values()].map(p => ({
    ...p,
    ports: [...p.ports].sort((a, b) => a - b),
  }));
  const summary =
    http3Entries.length > 0
      ? `HTTP/3 advertised via ${http3Entries.length} Alt-Svc ${http3Entries.length === 1 ? 'entry' : 'entries'} (${[...new Set(http3Entries.map(e => e.protocolId))].join(', ')})`
      : 'no HTTP/3 Alt-Svc advertisement observed';
  return {
    http3Available: http3Entries.length > 0,
    http3Entries,
    allEntries,
    protocols,
    summary,
  };
}
