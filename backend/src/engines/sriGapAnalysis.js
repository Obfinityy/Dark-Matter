/**
 * sriGapAnalysis.js — Subresource Integrity (SRI) gap analysis engine.
 *
 * Checks SRI usage on third-party scripts and stylesheets to flag hijackable
 * dependencies. A third-party script served without an integrity hash can be
 * silently replaced if the upstream CDN or account is compromised — a
 * defensive finding surfaced here as a hardening recommendation.
 */

const TRUSTED_FIRST_PARTY = new Set();

/**
 * Parse the integrity attribute of a single HTML tag.
 * @param {string} tag raw HTML tag
 * @returns {{present: boolean, algorithm: string|null, hash: string|null}}
 */
export function parseIntegrity(tag = '') {
  const m = /\bintegrity\s*=\s*["']([^"']+)["']/i.exec(tag);
  if (!m) return { present: false, algorithm: null, hash: null };
  const value = m[1].trim();
  const parts = value.split('-');
  return {
    present: true,
    algorithm: parts.length > 1 ? parts[0].toLowerCase() : null,
    hash: parts.length > 1 ? parts.slice(1).join('-') : value,
  };
}

/**
 * Analyze SRI coverage for external resources in HTML.
 * @param {string} pageUrl the page the HTML was observed on
 * @param {string} html page HTML
 * @returns {Array<{url: string, kind: 'script'|'stylesheet', host: string, sri: object, severity: string}>}
 */
export function analyzeSriGaps(pageUrl, html = '') {
  let pageHost = '';
  try { pageHost = new URL(pageUrl).hostname.toLowerCase(); } catch { /* ignore */ }
  const findings = [];
  const tagRe = /<(script|link)\b[^>]*>/gi;
  const srcRe = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const isScript = m[1].toLowerCase() === 'script';
    if (!isScript) {
      if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    }
    const srcMatch = srcRe.exec(tag);
    if (!srcMatch) continue; // inline script — not SRI-relevant
    let url = srcMatch[1].trim();
    try { url = new URL(url, pageUrl).href; } catch { /* keep raw */ }
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
    if (!host || host === pageHost || TRUSTED_FIRST_PARTY.has(host)) continue;
    const sri = parseIntegrity(tag);
    const weakAlgo = sri.present && (sri.algorithm === 'sha1' || sri.algorithm === 'md5');
    findings.push({
      url,
      kind: isScript ? 'script' : 'stylesheet',
      host,
      sri,
      severity: !sri.present ? 'high' : weakAlgo ? 'medium' : 'info',
    });
  }
  return findings;
}

/**
 * Summarize an SRI gap analysis into counts and a hardening verdict.
 * @param {Array} findings output of analyzeSriGaps
 * @returns {{total: number, missing: number, weak: number, covered: number, verdict: string}}
 */
export function summarizeSri(findings = []) {
  const missing = findings.filter((f) => !f.sri.present).length;
  const weak = findings.filter((f) => f.sri.present && (f.sri.algorithm === 'sha1' || f.sri.algorithm === 'md5')).length;
  const covered = findings.length - missing - weak;
  let verdict = 'good';
  if (missing > 0) verdict = 'poor';
  else if (weak > 0) verdict = 'fair';
  return { total: findings.length, missing, weak, covered, verdict };
}

export const SRI_GAP_ANALYSIS = {
  parseIntegrity,
  analyzeSriGaps,
  summarizeSri,
};

export default SRI_GAP_ANALYSIS;
