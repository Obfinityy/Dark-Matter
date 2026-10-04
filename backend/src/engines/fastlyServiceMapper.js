/**
 * fastlyServiceMapper.js — Fastly edge-hostname and service mapping engine.
 *
 * Covers idea-bank item 00272:
 *  - 00272 Fastly service host discovery — map Fastly services through CNAME
 *    patterns and edge hostnames.
 *
 * Pure functions only: callers resolve DNS CNAME chains and fetch response
 * headers themselves (respecting provider rate limits) and pass the raw data
 * in. No live HTTP here.
 */

const FASTLY_CNAME_RES = [
  { re: /\.fastly\.net$/i, kind: 'service' },
  { re: /\.fastlylb\.net$/i, kind: 'loadbalancer' },
  { re: /^(?:[a-z0-9-]+\.)?sni\.global\.fastly\.net$/i, kind: 'shared-sni' },
  { re: /\.map\.fastly\.net$/i, kind: 'map' },
];

const SERVED_BY_RE = /^cache-([a-z]{2,8}\d{1,4})(?:-[A-Z]{2,4})?$/i;

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
 * Classify a Fastly CNAME target.
 * @param {string} cname raw CNAME target
 * @returns {{kind: 'service'|'loadbalancer'|'shared-sni'|'map'|'other', host: string}}
 */
export function classifyFastlyCname(cname) {
  const host = normalizeHostname(cname);
  if (!host) return { kind: 'other', host: '' };
  for (const { re, kind } of FASTLY_CNAME_RES) {
    if (re.test(host)) return { kind, host };
  }
  return { kind: 'other', host };
}

/**
 * Parse Fastly response headers into structured edge data.
 * Understands `x-served-by: cache-lhr1234-LHR`, `x-cache`, `x-cache-hits`,
 * `via: 1.1 varnish (Varnish/...)` and the `fastly-*` debug headers.
 *
 * @param {Record<string, string>|string[]} headers
 * @returns {{
 *   servedBy: string, popCode: string, popCity: string,
 *   cacheStatus: string, cacheHits: number,
 *   fastlyDebug: Record<string, string>, viaFastly: boolean
 * }}
 */
export function parseFastlyHeaders(headers) {
  const out = {
    servedBy: '', popCode: '', popCity: '', cacheStatus: '',
    cacheHits: 0, fastlyDebug: {}, viaFastly: false,
  };
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
    if (name === 'x-served-by') {
      out.servedBy = value;
      const m = value.match(SERVED_BY_RE);
      if (m) {
        out.popCode = m[1].toUpperCase();
        out.popCity = value.split('-').pop() || '';
        out.viaFastly = true;
      }
    } else if (name === 'x-cache') {
      out.cacheStatus = value.split(',')[0].trim().toUpperCase();
      out.viaFastly = true;
    } else if (name === 'x-cache-hits') {
      out.cacheHits = parseInt(value, 10) || 0;
    } else if (name === 'via' && /fastly/i.test(value)) {
      out.viaFastly = true;
    } else if (name === 'x-fastly-request-id' || name === 'x-timer' || name === 'x-fastly') {
      out.fastlyDebug[name] = value;
      out.viaFastly = true;
    }
  }
  return out;
}

/**
 * Detect whether a hostname sits behind Fastly from its CNAME chain and
 * response headers, and attribute the service/edge hosts.
 *
 * @param {string} hostname the hostname under test
 * @param {string[]} cnameChain ordered CNAME targets (caller-resolved)
 * @param {Record<string, string>|string[]} headers response headers
 * @returns {{
 *   hostname: string,
 *   behindFastly: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   serviceHosts: string[],
 *   edgeHost: string,
 *   popCode: string,
 *   cacheStatus: string,
 *   evidence: string[]
 * }}
 */
export function detectFastly(hostname, cnameChain = [], headers = {}) {
  const host = normalizeHostname(hostname);
  const evidence = [];
  const serviceHosts = [];

  for (const target of cnameChain || []) {
    const parsed = classifyFastlyCname(target);
    if (parsed.kind !== 'other') {
      serviceHosts.push(parsed.host);
      evidence.push(`CNAME maps to Fastly ${parsed.kind} host ${parsed.host}`);
    }
  }

  const headerInfo = parseFastlyHeaders(headers);
  if (headerInfo.viaFastly) {
    evidence.push(
      `Response carries Fastly edge headers${headerInfo.servedBy ? ` (served by ${headerInfo.servedBy})` : ''}`
    );
  }

  const hasFastlyCname = serviceHosts.length > 0;
  const behindFastly = hasFastlyCname || headerInfo.viaFastly;
  const confidence = (hasFastlyCname && headerInfo.viaFastly) ? 'high' : behindFastly ? 'medium' : 'low';

  return {
    hostname: host,
    behindFastly,
    confidence,
    serviceHosts: [...new Set(serviceHosts)],
    edgeHost: headerInfo.servedBy,
    popCode: headerInfo.popCode,
    cacheStatus: headerInfo.cacheStatus,
    evidence,
  };
}

/**
 * Score a Fastly finding for hunt prioritization.
 * @param {ReturnType<typeof detectFastly>} finding
 * @returns {number} 0-100
 */
export function scoreFastlyFinding(finding) {
  if (!finding || !finding.behindFastly) return 0;
  let score = 30;
  if (finding.confidence === 'high') score += 25;
  if (finding.confidence === 'medium') score += 10;
  if (finding.serviceHosts.length > 0) score += 10;
  if (finding.edgeHost) score += 10;
  if (/^MISS|^HIT$/.test(finding.cacheStatus)) score += 5;
  return Math.min(100, score);
}
