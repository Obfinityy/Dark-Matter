/**
 * tlsRptIntel.js — TLS-RPT record intelligence for autonomous bug bounty.
 *
 * Implements Dark-Matter idea-bank item 00071 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00071 TLS-RPT endpoint discovery — read TLS-RPT records for report URIs
 *      that expose monitoring and aggregation endpoints.
 *
 * TLS Report (TLSRPT, RFC 8460) TXT records live at
 * `_smtp._tls.<domain>` and carry `rua=` report URIs (mailto: and https:).
 * The HTTPS aggregation endpoints and mail destinations behind those URIs
 * are part of the target's security-monitoring infrastructure — in-scope
 * asset discovery, not exploitation.
 *
 * All functions are pure parsers/analyzers: they operate on TXT record
 * strings the operator already collected (e.g. from dig) and never perform
 * network I/O.
 */

/** @typedef {object} TlsRptReportUri
 *  @property {'mailto'|'https'} scheme
 *  @property {string} raw           Original URI token as written in the record
 *  @property {string} host          Host the report is sent to (mail host for mailto)
 */

/** @typedef {object} TlsRptRecord
 *  @property {string} domain        Queried domain (without _smtp._tls prefix)
 *  @property {string|null} version  Version tag (e.g. "TLSRPTv1")
 *  @property {TlsRptReportUri[]} rua  Report URIs (rua=)
 *  @property {string[]} ruf          Forensic report URIs (ruf=, raw tokens)
 *  @property {string[]} unknown      Unrecognized tag=value pairs
 *  @property {boolean} valid        True when version is present and rua non-empty
 */

/**
 * Strip surrounding quotes from a TXT rdata chunk.
 * @param {string} text
 * @returns {string}
 */
function unquote(text) {
  const t = text.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

/**
 * Parse one report-URI token (mailto: or https:) from a rua= list.
 * Returns null for unsupported schemes.
 *
 * @param {string} token
 * @returns {TlsRptReportUri|null}
 */
export function parseReportUri(token) {
  const t = token.trim().replace(/[;,]$/, '');
  if (/^mailto:/i.test(t)) {
    const addr = t.slice(7).trim();
    const host = addr.includes('@') ? addr.split('@').pop().toLowerCase() : '';
    return { scheme: 'mailto', raw: t, host };
  }
  if (/^https?:/i.test(t)) {
    try {
      const u = new URL(t);
      return { scheme: 'https', raw: t, host: u.hostname.toLowerCase() };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parse a TLS-RPT TXT record rdata (RFC 8460 §3).
 *
 * Accepts the full text as returned by dig, e.g.
 *   "v=TLSRPTv1; rua=mailto:tls@corp.example,https://reports.example/tls;"
 *
 * @param {string} rdata  Raw TXT rdata for _smtp._tls.<domain>
 * @param {string} domain Domain the record belongs to (for attribution)
 * @returns {TlsRptRecord}
 */
export function parseTlsRptRecord(rdata, domain = '') {
  const rec = {
    domain,
    version: null,
    rua: [],
    ruf: [],
    unknown: [],
    valid: false,
  };
  if (!rdata) return rec;

  const body = unquote(rdata);
  for (const part of body.split(';')) {
    const piece = part.trim();
    if (!piece) continue;
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    const tag = piece.slice(0, eq).trim().toLowerCase();
    const value = piece.slice(eq + 1).trim();
    if (tag === 'v') {
      rec.version = value;
    } else if (tag === 'rua') {
      for (const token of value.split(',')) {
        const uri = parseReportUri(token);
        if (uri) rec.rua.push(uri);
        else if (token.trim()) rec.unknown.push(`rua:${token.trim()}`);
      }
    } else if (tag === 'ruf') {
      rec.ruf.push(
        ...value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
    } else {
      rec.unknown.push(`${tag}=${value}`);
    }
  }
  rec.valid = rec.version !== null && rec.rua.length > 0;
  return rec;
}

/**
 * Collect the distinct monitoring/aggregation hostnames a record sends
 * reports to, tagged by role.
 *
 * @param {TlsRptRecord} record
 * @returns {Array<{host: string, role: 'aggregate'|'report-mail'|'forensic', via: string}>}
 */
export function extractReportEndpoints(record) {
  const endpoints = [];
  const seen = new Set();
  for (const uri of record.rua) {
    if (!uri.host || seen.has(`rua:${uri.host}`)) continue;
    seen.add(`rua:${uri.host}`);
    endpoints.push({
      host: uri.host,
      role: uri.scheme === 'https' ? 'aggregate' : 'report-mail',
      via: uri.raw,
    });
  }
  for (const raw of record.ruf) {
    const uri = parseReportUri(raw);
    if (!uri || !uri.host || seen.has(`ruf:${uri.host}`)) continue;
    seen.add(`ruf:${uri.host}`);
    endpoints.push({ host: uri.host, role: 'forensic', via: raw });
  }
  return endpoints;
}

/**
 * Analyze TLS-RPT coverage across a set of domains.
 *
 * @param {Array<{domain: string, rdata: string|null}>} queries
 * @returns {{
 *   total: number, withRecord: number, valid: number,
 *   missing: string[], invalid: string[],
 *   aggregationHosts: Array<{host: string, serves: string[]}>,
 * }}
 */
export function analyzeTlsRptCoverage(queries) {
  const missing = [];
  const invalid = [];
  const hostMap = new Map();
  let valid = 0;

  for (const q of queries) {
    const rec = parseTlsRptRecord(q.rdata || '', q.domain);
    if (!q.rdata) {
      missing.push(q.domain);
      continue;
    }
    if (!rec.valid) {
      invalid.push(q.domain);
      continue;
    }
    valid += 1;
    for (const ep of extractReportEndpoints(rec)) {
      if (!hostMap.has(ep.host)) hostMap.set(ep.host, new Set());
      hostMap.get(ep.host).add(q.domain);
    }
  }

  const aggregationHosts = [...hostMap.entries()]
    .map(([host, serves]) => ({ host, serves: [...serves].sort() }))
    .sort((a, b) => b.serves.length - a.serves.length);

  return {
    total: queries.length,
    withRecord: valid + invalid.length,
    valid,
    missing,
    invalid,
    aggregationHosts,
  };
}
