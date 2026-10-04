/**
 * hubspotCosMiner.js — HubSpot COS (Content Optimization System) host
 * discovery engine.
 *
 * Covers idea-bank item 00277:
 *  - 00277 HubSpot COS host discovery — find HubSpot-hosted marketing pages
 *    via hs-sites.com patterns and CT logs.
 *
 * Pure functions only: callers fetch page source, DNS records, and
 * certificate-transparency entries themselves (respecting provider rate
 * limits) and pass the raw data in. No live HTTP here.
 */

const HS_SITE_RE = /\.hs-sites\.com$/i;
const HS_SITE_HOST_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+hs-sites\.com\b/gi;
const HS_PORTAL_RE = /\/\/js\.hs-scripts\.com\/(\d+)\.js/i;
const HSFORMS_RE = /\/\/js\.hsforms\.net\/forms\/(?:shell|embed)\.js/i;
const HUBSPOT_MARKER_RE = /hubspot|x-hubspot|hs-analytics/i;

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
 * Check whether a hostname is a HubSpot COS (hs-sites.com) host.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isHubspotHost(hostname) {
  return HS_SITE_RE.test(normalizeHostname(hostname));
}

/**
 * Extract the HubSpot portal ID from page source (//js.hs-scripts.com/<id>.js).
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {string} portal id or ''
 */
export function extractPortalId(pageSource = '') {
  const m = String(pageSource || '').match(HS_PORTAL_RE);
  return m ? m[1] : '';
}

/**
 * Extract HubSpot-hosted page hosts from page source, DNS CNAME targets, and
 * certificate-transparency names supplied by the caller.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {string[]} cnameTargets CNAME targets already resolved by the caller
 * @param {string[]} ctNames certificate-transparency names already fetched
 * @returns {{host: string, sources: string[], portalId: string}[]}
 */
export function extractHubspotHosts(pageSource = '', cnameTargets = [], ctNames = []) {
  const byHost = new Map();
  const note = (raw, source) => {
    const host = normalizeHostname(raw);
    if (!host || !isHubspotHost(host)) return;
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(source);
  };

  for (const m of String(pageSource || '').matchAll(HS_SITE_HOST_RE)) {
    note(m[0], 'page-source');
  }
  for (const target of cnameTargets || []) note(target, 'dns-cname');
  for (const name of ctNames || []) note(name, 'ct-log');

  const portalId = extractPortalId(pageSource);

  return [...byHost.entries()]
    .map(([host, sources]) => ({ host, sources: [...sources].sort(), portalId }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Detect HubSpot markers on a site from page source and headers.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {Record<string, string>} headers response headers
 * @returns {{onHubspot: boolean, portalId: string, evidence: string[]}}
 */
export function detectHubspot(pageSource = '', headers = {}) {
  const evidence = [];
  const text = String(pageSource || '');
  if (HSFORMS_RE.test(text)) evidence.push('HubSpot forms embed script present');
  if (HS_PORTAL_RE.test(text)) evidence.push('HubSpot tracking script (hs-scripts) present');
  if (HUBSPOT_MARKER_RE.test(text)) evidence.push('HubSpot markers in page source or headers');
  for (const [name, value] of Object.entries(headers || {})) {
    if (/^x-hubspot/i.test(String(name))) evidence.push(`HubSpot response header: ${name}`);
    if (/hubspot/i.test(String(value)) && /^x-powered-by$/i.test(String(name))) {
      evidence.push('X-Powered-By header mentions HubSpot');
    }
  }
  return { onHubspot: evidence.length > 0, portalId: extractPortalId(text), evidence };
}

/**
 * Score HubSpot hosts for hunt relevance: brand-matching hosts and hosts
 * confirmed via multiple independent sources score highest.
 *
 * @param {ReturnType<typeof extractHubspotHosts>} hosts
 * @param {string} rootDomain e.g. "example.com"
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function scoreHubspotHosts(hosts = [], rootDomain = '') {
  const brand = normalizeHostname(rootDomain).split('.')[0];
  return (hosts || []).map((h) => {
    let score = 25;
    const reasons = ['HubSpot-hosted marketing page'];
    if (brand && h.host.includes(brand)) {
      score += 40;
      reasons.push(`hostname references brand "${brand}"`);
    }
    if (h.sources.length > 1) {
      score += 15;
      reasons.push(`confirmed via ${h.sources.join(' + ')}`);
    }
    if (h.portalId) {
      score += 10;
      reasons.push('portal id attributable');
    }
    return { host: h.host, score: Math.min(100, score), reasons };
  }).sort((a, b) => b.score - a.score);
}
