/**
 * incapsulaCnameMiner.js — Imperva Incapsula CNAME mining engine.
 *
 * Covers idea-bank item 00274:
 *  - 00274 Incapsula/Imperva CNAME mining — find Incapsula-protected hosts
 *    via their distinctive CNAME patterns.
 *
 * Pure functions only: callers resolve DNS CNAME records and fetch HTTP
 * response headers themselves (respecting provider rate limits) and pass the
 * raw data in. No live HTTP here.
 */

const INCAP_CNAME_RE = /\.incapdns\.net$/i;
const INCAP_HEADER_RE = /incapsula/i;
const INCAP_XIINFO_RE = /^S?(?:\d+)\.[xX]-[A-Za-z0-9_-]+/;

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
 * Classify a hostname by Incapsula/Imperva CNAME pattern.
 * Incapsula-protected hosts CNAME to <random>.incapdns.net.
 * @param {string} cname raw CNAME target
 * @returns {{protected: boolean, host: string}}
 */
export function classifyIncapsulaCname(cname) {
  const host = normalizeHostname(cname);
  return { protected: INCAP_CNAME_RE.test(host), host };
}

/**
 * Parse response headers for Imperva Incapsula fingerprints:
 *  - `X-CDN: Incapsula`
 *  - `X-Iinfo: <visit-id>.<server>...` (visit id + server id + encoded)
 *  - `Server`/`Via` mentioning Incapsula
 *
 * @param {Record<string, string>|string[]} headers
 * @returns {{viaIncapsula: boolean, xCdn: string, visitId: string, serverId: string, evidence: string[]}}
 */
export function parseIncapsulaHeaders(headers) {
  const out = { viaIncapsula: false, xCdn: '', visitId: '', serverId: '', evidence: [] };
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
    if (name === 'x-cdn' && INCAP_HEADER_RE.test(value)) {
      out.viaIncapsula = true;
      out.xCdn = value;
      out.evidence.push(`X-CDN header marks Incapsula edge: ${value}`);
    } else if (name === 'x-iinfo') {
      out.viaIncapsula = true;
      out.evidence.push('X-Iinfo header present (Incapsula visit fingerprint)');
      // Visit id is usually the leading token; server id may follow.
      const parts = value.split(/[,\s]+/).filter(Boolean);
      if (parts.length > 0) out.visitId = parts[0];
      const m = value.match(/S?(\d{1,3})\.[xX]-/i);
      if (m) out.serverId = m[1];
    } else if ((name === 'server' || name === 'via') && INCAP_HEADER_RE.test(value)) {
      out.viaIncapsula = true;
      out.evidence.push(`${rawName} header mentions Incapsula: ${value}`);
    }
  }
  return out;
}

/**
 * Detect Incapsula/Imperva protection from DNS CNAME targets and response
 * headers, returning the protected hostnames and their edge mappings.
 *
 * @param {string} hostname the hostname under test
 * @param {string[]} cnameChain ordered CNAME targets (caller-resolved)
 * @param {Record<string, string>|string[]} headers response headers
 * @returns {{
 *   hostname: string,
 *   protected: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   edgeHosts: string[],
 *   visitId: string,
 *   serverId: string,
 *   evidence: string[]
 * }}
 */
export function detectIncapsula(hostname, cnameChain = [], headers = {}) {
  const host = normalizeHostname(hostname);
  const evidence = [];
  const edgeHosts = [];

  for (const target of cnameChain || []) {
    const parsed = classifyIncapsulaCname(target);
    if (parsed.protected) {
      edgeHosts.push(parsed.host);
      evidence.push(`CNAME points at Incapsula edge ${parsed.host}`);
    }
  }

  const headerInfo = parseIncapsulaHeaders(headers);
  for (const e of headerInfo.evidence) evidence.push(e);

  const hasCname = edgeHosts.length > 0;
  const hasHeader = headerInfo.viaIncapsula;
  const detected = hasCname || hasHeader;
  const confidence = (hasCname && hasHeader) ? 'high' : detected ? 'medium' : 'low';

  return {
    hostname: host,
    protected: detected,
    confidence,
    edgeHosts: [...new Set(edgeHosts)],
    visitId: headerInfo.visitId,
    serverId: headerInfo.serverId,
    evidence,
  };
}

/**
 * Score an Incapsula finding for hunt prioritization.
 * @param {ReturnType<typeof detectIncapsula>} finding
 * @returns {number} 0-100
 */
export function scoreIncapsulaFinding(finding) {
  if (!finding || !finding.protected) return 0;
  let score = 30;
  if (finding.confidence === 'high') score += 25;
  if (finding.confidence === 'medium') score += 10;
  if (finding.edgeHosts.length > 0) score += 15;
  if (finding.visitId) score += 5;
  return Math.min(100, score);
}
