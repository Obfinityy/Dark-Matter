/**
 * requestBinLeftoverDetector.js — RequestBin leftover URL detector.
 *
 * RequestBin-style services (requestb.in, requestbin.com, requestbin.net)
 * give developers throwaway endpoints to inspect inbound HTTP during testing.
 * Leftover RequestBin URLs in JavaScript bundles, mobile apps, or docs reveal
 * the testing infrastructure of an organization and sometimes still receive
 * live traffic — a classic hardening finding.
 *
 * Pure text analysis: the caller supplies fetched text (JS bundle, HTML,
 * docs). This module only DETECTS exposure — it never contacts the bins.
 * Defensive use: authorized hardening review on targets the user may test.
 */

/** Host patterns for RequestBin-family disposable endpoints. */
export const REQUESTBIN_PATTERNS = [
  /(^|\.)requestb\.in$/i,
  /(^|\.)requestbin\.com$/i,
  /(^|\.)requestbin\.net$/i,
  /(^|\.)requestbin\.fullcontact\.com$/i,
];

const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;

/**
 * Extract all http(s) URLs from a text blob.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  if (typeof text !== 'string') return [];
  URL_RE.lastIndex = 0;
  const out = [];
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    out.push(m[0].replace(/[.,;!?]+$/, ''));
  }
  return out;
}

/**
 * Check whether a hostname belongs to a RequestBin-family service.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isRequestBinHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return REQUESTBIN_PATTERNS.some(re => re.test(host));
}

/**
 * Guess the bin identifier from a RequestBin URL path.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function extractBinId(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    const first = path.split('/')[0];
    return first && first.length >= 3 ? first : null;
  } catch {
    return null;
  }
}

/**
 * Scan text for leftover RequestBin URLs.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, findings: object[], evidence: string }}
 */
export function detectRequestBinLeftovers({ source = 'unknown', text = '' } = {}) {
  const findings = [];
  const seen = new Set();
  for (const url of extractUrls(text)) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!isRequestBinHost(hostname) || seen.has(url)) continue;
    seen.add(url);
    findings.push({
      url,
      hostname,
      binId: extractBinId(url),
      source,
      severity: /js|bundle|chunk|html/.test(String(source).toLowerCase()) ? 'medium' : 'low',
      remediation:
        'Remove the RequestBin URL from the shipped artefact and confirm no ' +
        'live traffic is still pointed at the disposable bin.',
    });
  }

  return {
    type: 'RequestBin Leftover Detection',
    confidence: findings.length ? 'high' : 'low',
    findings,
    evidence: findings.length
      ? `Found ${findings.length} leftover RequestBin URL(s) in ${source}: ${findings.map(f => f.url).join('; ')}. ` +
        'RequestBin URLs in shipped artefacts reveal testing infrastructure and may still receive live requests.'
      : `No RequestBin URLs found in ${source}.`,
  };
}

export const REQUESTBIN_LEFTOVER_DETECTOR = {
  REQUESTBIN_PATTERNS,
  extractUrls,
  isRequestBinHost,
  extractBinId,
  detectRequestBinLeftovers,
};
export default REQUESTBIN_LEFTOVER_DETECTOR;
