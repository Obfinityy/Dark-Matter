/**
 * crossdomainMiner.js — crossdomain.xml policy host mining.
 *
 * Flash-era `/crossdomain.xml` files are still served on many estates and
 * declare which domains may make cross-domain requests via
 * `<allow-access-from domain="...">`. The permitted domain list frequently
 * discloses partner domains, internal hostnames, staging environments and
 * CDN origins that the main site no longer advertises.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 * Defensive framing only: this parses a public policy file on an authorized
 * target; it does not exploit cross-domain trust.
 */

/** Well-known locations of the crossdomain.xml file. */
export const CANDIDATE_PATHS = [
  '/crossdomain.xml',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map((p) => `${origin}${p}`);
}

/**
 * Parse a crossdomain.xml policy document.
 * @param {string} content raw XML text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   allowAccessFrom: Array<{ domain: string, wildcard: boolean, globalWildcard: boolean, secure: boolean|null }>,
 *   allowHttpRequestHeadersFrom: Array<{ domain: string, headers: string[] }>,
 *   siteControlPermitted: string[],
 *   hosts: string[], overlyPermissive: boolean, rawParse: boolean
 * }}
 */
export function analyzeCrossdomain(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const result = {
    source, allowAccessFrom: [], allowHttpRequestHeadersFrom: [],
    siteControlPermitted: [], hosts: [], overlyPermissive: false, rawParse: false,
  };
  const text = String(content || '');
  if (!/<cross-domain-policy[\s>]/i.test(text) && !/<allow-access-from[\s>]/i.test(text)) return result;
  result.rawParse = true;
  const hosts = new Set();

  for (const m of text.matchAll(/<allow-access-from\b[^>]*>/gi)) {
    const tag = m[0];
    const domain = ((tag.match(/\bdomain\s*=\s*["']([^"']+)["']/i) || [])[1] || '').trim();
    const secureAttr = (tag.match(/\bsecure\s*=\s*["']([^"']+)["']/i) || [])[1];
    const globalWildcard = domain === '*';
    const wildcard = globalWildcard || domain.startsWith('*.');
    const normalized = domain.replace(/^\*\./, '').toLowerCase();
    if (globalWildcard) result.overlyPermissive = true;
    if (normalized) hosts.add(normalized);
    result.allowAccessFrom.push({
      domain,
      wildcard,
      globalWildcard,
      secure: secureAttr === undefined ? null : /^(true|1)$/i.test(secureAttr),
    });
  }

  for (const m of text.matchAll(/<allow-http-request-headers-from\b([^>]*)>([^<]*)<\/allow-http-request-headers-from>/gi)) {
    const tag = m[1];
    const domain = ((tag.match(/\bdomain\s*=\s*["']([^"']+)["']/i) || [])[1] || '').trim();
    const headers = (tag.match(/\bheaders\s*=\s*["']([^"']+)["']/i) || [])[1] || m[2] || '';
    const normalized = domain.replace(/^\*\./, '').toLowerCase();
    if (normalized && normalized !== '*') hosts.add(normalized);
    result.allowHttpRequestHeadersFrom.push({
      domain,
      headers: headers.split(',').map((h) => h.trim()).filter(Boolean),
    });
  }

  for (const m of text.matchAll(/<site-control\b[^>]*permitted-cross-domain-policies\s*=\s*["']([^"']+)["']/gi)) {
    result.siteControlPermitted.push(m[1]);
  }

  result.hosts = [...hosts].filter((h) => h !== '*');
  return result;
}

/**
 * Score how interesting the policy is for pivoting.
 * @param {ReturnType<typeof analyzeCrossdomain>} analysis
 * @returns {{ score: number, reasons: string[] }}
 */
export function scorePolicy(analysis) {
  let score = 0;
  const reasons = [];
  if (analysis.overlyPermissive) {
    score += 60;
    reasons.push('Global wildcard allow-access-from exposes the policy as overly permissive');
  }
  const wildcards = (analysis.allowAccessFrom || []).filter((a) => a.wildcard && !a.globalWildcard);
  if (wildcards.length) {
    score += 20 * Math.min(wildcards.length, 3);
    reasons.push(`${wildcards.length} wildcard subdomain entr${wildcards.length === 1 ? 'y' : 'ies'} disclose partner/internal domain space`);
  }
  const internal = (analysis.hosts || []).filter((h) => /internal|intranet|corp|staging|dev|test|local/i.test(h));
  if (internal.length) {
    score += 25;
    reasons.push(`Internal-looking hosts disclosed: ${internal.slice(0, 5).join(', ')}`);
  }
  const insecure = (analysis.allowAccessFrom || []).filter((a) => a.secure === false);
  if (insecure.length) {
    score += 15;
    reasons.push(`${insecure.length} entries allow insecure (non-HTTPS) origins`);
  }
  if (!reasons.length) reasons.push('Restrictive policy, no notable pivot hosts');
  return { score: Math.min(score, 100), reasons };
}
