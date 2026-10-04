/**
 * sucuriHostDiscovery.js — Sucuri website-firewall host discovery engine.
 *
 * Covers idea-bank item 00275:
 *  - 00275 Sucuri firewall host discovery — identify Sucuri-fronted hosts
 *    via DNS and firewall headers.
 *
 * Pure functions only: callers resolve DNS records and fetch HTTP response
 * headers themselves (respecting provider rate limits) and pass the raw data
 * in. No live HTTP here.
 */

/**
 * Normalize a hostname: lowercase, strip trailing dot, port, and scheme.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Parse response headers for Sucuri fingerprints:
 *  - `X-Sucuri-ID` / `X-Sucuri-Cache` — definitive WAF/cache markers
 *  - `Server` values mentioning Sucuri
 *
 * @param {Record<string, string>|string[]} headers
 * @returns {{viaSucuri: boolean, sucuriId: string, cacheStatus: string, evidence: string[]}}
 */
export function parseSucuriHeaders(headers) {
  const out = { viaSucuri: false, sucuriId: '', cacheStatus: '', evidence: [] };
  if (!headers) return out;

  const entries = Array.isArray(headers)
    ? headers.map((line) => {
        const idx = String(line).indexOf(':');
        return idx === -1 ? ['', ''] : [String(line).slice(0, idx).trim(), String(line).slice(idx + 1).trim()];
      })
    : Object.entries(headers);

  for (const [rawName, rawValue] of entries) {
    const name = String(rawName).toLowerCase();
    const value = String(rawValue || '');
    if (name === 'x-sucuri-id') {
      out.viaSucuri = true;
      out.sucuriId = value;
      out.evidence.push('X-Sucuri-ID header present (Sucuri WAF request marker)');
    } else if (name === 'x-sucuri-cache') {
      out.viaSucuri = true;
      out.cacheStatus = value;
      out.evidence.push(`X-Sucuri-Cache header present (cache status: ${value})`);
    } else if (name === 'server' && /sucuri/i.test(value)) {
      out.viaSucuri = true;
      out.evidence.push(`Server header mentions Sucuri: ${value}`);
    } else if (name === 'via' && /sucuri/i.test(value)) {
      out.viaSucuri = true;
      out.evidence.push(`Via header mentions Sucuri: ${value}`);
    }
  }
  return out;
}

/**
 * Heuristically score how "Sucuri-like" a DNS resolution looks.
 * Sucuri publishes its anycast egress/proxy ranges; a caller-supplied list of
 * observed Sucuri IPs lets the check stay data-driven instead of hardcoding
 * address space here.
 *
 * @param {string[]} ips A/AAAA answers already fetched by the caller
 * @param {string[]} knownSucuriIps caller-supplied known Sucuri egress/proxy IPs
 * @returns {{matches: string[], count: number}}
 */
export function matchSucuriIps(ips = [], knownSucuriIps = []) {
  const known = new Set((knownSucuriIps || []).map((ip) => String(ip).trim()));
  const matches = (ips || []).map((ip) => String(ip).trim()).filter((ip) => known.has(ip));
  return { matches: [...new Set(matches)], count: matches.length };
}

/**
 * Detect Sucuri WAF fronting from response headers plus optional DNS IP
 * corroboration supplied by the caller.
 *
 * @param {string} hostname the hostname under test
 * @param {Record<string, string>|string[]} headers response headers
 * @param {{ips?: string[], knownSucuriIps?: string[]}} [dnsHint]
 * @returns {{
 *   hostname: string,
 *   fronted: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   sucuriId: string,
 *   cacheStatus: string,
 *   matchedIps: string[],
 *   evidence: string[]
 * }}
 */
export function detectSucuri(hostname, headers = {}, dnsHint = {}) {
  const host = normalizeHostname(hostname);
  const evidence = [];

  const headerInfo = parseSucuriHeaders(headers);
  for (const e of headerInfo.evidence) evidence.push(e);

  const { matches } = matchSucuriIps(dnsHint?.ips || [], dnsHint?.knownSucuriIps || []);
  if (matches.length > 0) {
    evidence.push(`Resolved IP(s) match known Sucuri proxy space: ${matches.join(', ')}`);
  }

  const hasHeader = headerInfo.viaSucuri;
  const hasIp = matches.length > 0;
  const fronted = hasHeader || hasIp;
  const confidence = (hasHeader && hasIp) ? 'high' : fronted ? 'medium' : 'low';

  return {
    hostname: host,
    fronted,
    confidence,
    sucuriId: headerInfo.sucuriId,
    cacheStatus: headerInfo.cacheStatus,
    matchedIps: matches,
    evidence,
  };
}

/**
 * Score a Sucuri finding for hunt prioritization.
 * @param {ReturnType<typeof detectSucuri>} finding
 * @returns {number} 0-100
 */
export function scoreSucuriFinding(finding) {
  if (!finding || !finding.fronted) return 0;
  let score = 30;
  if (finding.confidence === 'high') score += 25;
  if (finding.confidence === 'medium') score += 10;
  if (finding.sucuriId) score += 10;
  if (finding.cacheStatus) score += 5;
  if (finding.matchedIps.length > 0) score += 10;
  return Math.min(100, score);
}
