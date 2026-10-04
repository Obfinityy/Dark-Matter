/**
 * marketoHostMiner.js — Marketo landing-page host mining engine.
 *
 * Covers idea-bank item 00278:
 *  - 00278 Marketo landing-page host mining — discover Marketo
 *    landing-page hosts via mkto patterns.
 *
 * Pure functions only: callers fetch page source and DNS records themselves
 * (respecting provider rate limits) and pass the raw data in. No live HTTP
 * here.
 */

const MKTO_HOST_RE = /\.mkto([a-z0-9]*)\.com$/i;
const MKTO_HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+mkto[a-z0-9]*\.com\b/gi;
const MUNCHKIN_RE = /Munchkin\.init\(\s*['"](\d{3}-\w{3}-\d{3})['"]/i;
const MARKETO_SCRIPT_RE = /\/\/app-[a-z0-9-]+\.marketo\.com\/js\/Munchkin\.js/i;
const MARKETO_FORM_RE = /\/\/[a-z0-9-]+\.marketo\.com\/js\/forms2\/js\/forms2\.min\.js/i;

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
 * Check whether a hostname matches Marketo mkto patterns
 * (e.g. pages.example.mkto.com, go.example.com CNAME'd to mkto hosts).
 * @param {string} hostname
 * @returns {boolean}
 */
export function isMarketoHost(hostname) {
  return MKTO_HOST_RE.test(normalizeHostname(hostname));
}

/**
 * Extract the Marketo Munchkin account id (format 123-ABC-456) from page
 * source. The id attributes a page to one Marketo subscription.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {string} munchkin id or ''
 */
export function extractMunchkinId(pageSource = '') {
  const m = String(pageSource || '').match(MUNCHKIN_RE);
  return m ? m[1] : '';
}

/**
 * Extract Marketo landing-page hosts from page source and DNS CNAME targets
 * supplied by the caller.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {string[]} cnameTargets CNAME targets already resolved by the caller
 * @returns {{host: string, sources: string[], munchkinId: string}[]}
 */
export function extractMarketoHosts(pageSource = '', cnameTargets = []) {
  const byHost = new Map();
  const note = (raw, source) => {
    const host = normalizeHostname(raw);
    if (!host || !isMarketoHost(host)) return;
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(source);
  };

  for (const m of String(pageSource || '').matchAll(MKTO_HOSTNAME_RE)) {
    note(m[0], 'page-source');
  }
  for (const target of cnameTargets || []) note(target, 'dns-cname');

  const munchkinId = extractMunchkinId(pageSource);

  return [...byHost.entries()]
    .map(([host, sources]) => ({ host, sources: [...sources].sort(), munchkinId }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Detect Marketo presence on a site from page source markers.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @returns {{onMarketo: boolean, munchkinId: string, evidence: string[]}}
 */
export function detectMarketo(pageSource = '') {
  const evidence = [];
  const text = String(pageSource || '');
  if (MARKETO_SCRIPT_RE.test(text)) evidence.push('Marketo Munchkin tracking script present');
  if (MARKETO_FORM_RE.test(text)) evidence.push('Marketo forms2 embed present');
  if (MUNCHKIN_RE.test(text)) evidence.push('Munchkin.init call with account id present');
  return { onMarketo: evidence.length > 0, munchkinId: extractMunchkinId(text), evidence };
}

/**
 * Score Marketo hosts for hunt relevance: brand-matching hosts and
 * munchkin-attributable hosts score highest.
 *
 * @param {ReturnType<typeof extractMarketoHosts>} hosts
 * @param {string} rootDomain e.g. "example.com"
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function scoreMarketoHosts(hosts = [], rootDomain = '') {
  const brand = normalizeHostname(rootDomain).split('.')[0];
  return (hosts || []).map((h) => {
    let score = 25;
    const reasons = ['Marketo landing-page host'];
    if (brand && h.host.includes(brand)) {
      score += 40;
      reasons.push(`hostname references brand "${brand}"`);
    }
    if (h.sources.length > 1) {
      score += 15;
      reasons.push(`confirmed via ${h.sources.join(' + ')}`);
    }
    if (h.munchkinId) {
      score += 10;
      reasons.push('Munchkin id attributable');
    }
    return { host: h.host, score: Math.min(100, score), reasons };
  }).sort((a, b) => b.score - a.score);
}
