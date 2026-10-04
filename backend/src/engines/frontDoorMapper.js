/**
 * frontDoorMapper.js — Azure Front Door hostname mapping engine.
 *
 * Covers idea-bank item 00271:
 *  - 00271 Azure Front Door host mapping — discover Azure Front Door
 *    frontends and their backend pools via DNS and headers.
 *
 * Pure functions only: callers fetch DNS records (CNAME/A chains) and HTTP
 * response headers themselves (respecting provider rate limits) and pass the
 * raw data in. No live HTTP here.
 */

const AFD_CNAME_RE = /\.azurefd\.net$/i;
const AZUREEDGE_CNAME_RE = /\.azureedge\.net$/i;
const FD_ORIGIN_RE = /\.azurewebsites\.net$/i;
const FD_BLOB_RE = /\.blob\.core\.windows\.net$/i;
const FD_STORAGE_STATIC_RE = /\.web\.core\.windows\.net$/i;

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
 * Classify an Azure CDN / Front Door CNAME target.
 * @param {string} cname raw CNAME target
 * @returns {{kind: 'frontdoor'|'azureedge'|'appservice'|'blob'|'staticweb'|'other', host: string}}
 */
export function classifyAzureCname(cname) {
  const host = normalizeHostname(cname);
  if (!host) return { kind: 'other', host: '' };
  if (AFD_CNAME_RE.test(host)) return { kind: 'frontdoor', host };
  if (AZUREEDGE_CNAME_RE.test(host)) return { kind: 'azureedge', host };
  if (FD_ORIGIN_RE.test(host)) return { kind: 'appservice', host };
  if (FD_STORAGE_STATIC_RE.test(host)) return { kind: 'staticweb', host };
  if (FD_BLOB_RE.test(host)) return { kind: 'blob', host };
  return { kind: 'other', host };
}

/**
 * Parse a list of response headers (object or array of "Name: value" lines)
 * for Azure Front Door fingerprints.
 *
 * @param {Record<string, string>|string[]} headers
 * @returns {{azureRef: string, frontendId: string, edgePop: string, server: string, viaAfd: boolean}}
 */
export function parseFrontDoorHeaders(headers) {
  const out = { azureRef: '', frontendId: '', edgePop: '', server: '', viaAfd: false };
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
    if (name === 'x-azure-ref') {
      out.azureRef = value;
      out.viaAfd = true;
      // Format: 0AbCdEfGh... <edge-pop> (<datacenter>)
      const m = value.match(/[0-9A-Za-z+/=]{10,}\s+([A-Z]{3,4})/);
      if (m) out.edgePop = m[1];
    } else if (name === 'x-azure-requestid') {
      out.frontendId = value;
      out.viaAfd = true;
    } else if (name === 'server' && /^ECAcc|Microsoft-Azure/.test(value)) {
      out.server = value;
    }
  }
  return out;
}

/**
 * Detect whether a hostname is fronted by Azure Front Door from its DNS
 * CNAME chain and HTTP response headers.
 *
 * @param {string} hostname the origin hostname under test
 * @param {string[]} cnameChain ordered CNAME targets (caller-resolved)
 * @param {Record<string, string>|string[]} headers response headers
 * @returns {{
 *   hostname: string,
 *   fronted: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   frontendHosts: string[],
 *   backendPoolHints: string[],
 *   edgePop: string,
 *   evidence: string[]
 * }}
 */
export function detectFrontDoor(hostname, cnameChain = [], headers = {}) {
  const host = normalizeHostname(hostname);
  const evidence = [];
  const frontendHosts = [];
  const backendPoolHints = [];
  let viaHeader = false;

  for (const target of cnameChain || []) {
    const parsed = classifyAzureCname(target);
    if (parsed.kind === 'frontdoor') {
      frontendHosts.push(parsed.host);
      evidence.push(`CNAME resolves through Azure Front Door frontend ${parsed.host}`);
    } else if (parsed.kind === 'azureedge') {
      frontendHosts.push(parsed.host);
      evidence.push(`CNAME resolves through Azure CDN (classic) edge ${parsed.host}`);
    } else if (parsed.kind !== 'other') {
      backendPoolHints.push(parsed.host);
      evidence.push(`CNAME terminates at Azure origin ${parsed.host} (${parsed.kind})`);
    }
  }

  const headerInfo = parseFrontDoorHeaders(headers);
  if (headerInfo.viaAfd) {
    viaHeader = true;
    evidence.push(`Response carries Azure Front Door headers (x-azure-ref${headerInfo.azureRef ? `=${headerInfo.azureRef.slice(0, 24)}…` : ''})`);
  }

  const hasFdCname = frontendHosts.length > 0;
  const fronted = hasFdCname || viaHeader;
  const confidence = (hasFdCname && viaHeader) ? 'high' : fronted ? 'medium' : 'low';

  return {
    hostname: host,
    fronted,
    confidence,
    frontendHosts: [...new Set(frontendHosts)],
    backendPoolHints: [...new Set(backendPoolHints)],
    edgePop: headerInfo.edgePop,
    evidence,
  };
}

/**
 * Score a Front Door finding for hunt prioritization.
 * @param {ReturnType<typeof detectFrontDoor>} finding
 * @returns {number} 0-100
 */
export function scoreFrontDoorFinding(finding) {
  if (!finding || !finding.fronted) return 0;
  let score = 30;
  if (finding.confidence === 'high') score += 25;
  if (finding.confidence === 'medium') score += 10;
  if (finding.frontendHosts.length > 0) score += 10;
  if (finding.backendPoolHints.length > 0) score += 20; // origin exposure is valuable
  if (finding.edgePop) score += 5;
  return Math.min(100, score);
}
