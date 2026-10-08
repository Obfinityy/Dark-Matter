/**
 * wpComMapper.js — WordPress.com / WP Engine subdomain mapping engine.
 *
 * Covers idea-bank item 00276:
 *  - 00276 WordPress.com subdomain mapping — map wordpress.com and
 *    wpengine subdomains used for the org's blogs and marketing.
 *
 * Pure functions only: callers fetch page source, DNS records, and headers
 * themselves (respecting provider rate limits) and pass the raw data in.
 * No live HTTP here.
 */

const WP_HOST_RES = [
  { re: /\.wordpress\.com$/i, kind: 'wordpress-com', note: 'WordPress.com hosted site' },
  { re: /\.wpengine\.com$/i, kind: 'wpengine', note: 'WP Engine hosted site' },
  { re: /\.wpenginepowered\.com$/i, kind: 'wpengine', note: 'WP Engine (powered) host' },
  { re: /\.wpcomstaging\.com$/i, kind: 'wpengine-staging', note: 'WP Engine staging host' },
];

const HOSTNAME_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:wordpress\.com|wpengine\.com|wpenginepowered\.com|wpcomstaging\.com)\b/gi;
const GENERATOR_RE = /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress[^"']*["']/i;
const WP_JSON_RE = /\/wp-json\/?(?:wp\/v2)?/i;

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
 * Classify a WordPress-hosted hostname.
 * @param {string} hostname
 * @returns {{isWpHosted: boolean, kind: string, note: string, host: string}}
 */
export function classifyWpHost(hostname) {
  const host = normalizeHostname(hostname);
  for (const { re, kind, note } of WP_HOST_RES) {
    if (re.test(host)) return { isWpHosted: true, kind, note, host };
  }
  return { isWpHosted: false, kind: 'other', note: '', host };
}

/**
 * Extract wordpress.com / wpengine subdomains from page source and DNS
 * CNAME targets, attributing each host to the source where it was seen.
 *
 * @param {string} pageSource HTML/text already fetched by the caller
 * @param {string[]} cnameTargets CNAME targets already resolved by the caller
 * @returns {{host: string, kind: string, note: string, sources: string[]}[]}
 */
export function extractWpHosts(pageSource = '', cnameTargets = []) {
  const byHost = new Map();
  const note = (raw, source) => {
    const cls = classifyWpHost(raw);
    if (!cls.isWpHosted) return;
    if (!byHost.has(cls.host)) {
      byHost.set(cls.host, { host: cls.host, kind: cls.kind, note: cls.note, sources: new Set() });
    }
    byHost.get(cls.host).sources.add(source);
  };

  for (const m of String(pageSource || '').matchAll(HOSTNAME_RE)) {
    note(m[0], 'page-source');
  }
  for (const target of cnameTargets || []) {
    note(target, 'dns-cname');
  }

  return [...byHost.values()]
    .map(e => ({ host: e.host, kind: e.kind, note: e.note, sources: [...e.sources].sort() }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Detect WordPress fingerprints on a site from page source and headers:
 * generator meta tag, /wp-json/ paths, wp-content references.
 *
 * @param {string} pageSource HTML already fetched by the caller
 * @param {Record<string, string>} headers response headers
 * @returns {{isWordPress: boolean, evidence: string[]}}
 */
export function detectWordPress(pageSource = '', headers = {}) {
  const evidence = [];
  const text = String(pageSource || '');
  if (GENERATOR_RE.test(text)) evidence.push('Generator meta tag identifies WordPress');
  if (WP_JSON_RE.test(text)) evidence.push('wp-json REST API path referenced');
  if (/wp-content\//i.test(text)) evidence.push('wp-content asset paths present');
  const hdrs = headers || {};
  const entries = Object.entries(hdrs);
  for (const [name, value] of entries) {
    if (/^x-powered-by$/i.test(String(name)) && /wordpress/i.test(String(value))) {
      evidence.push('X-Powered-By header identifies WordPress');
    }
  }
  return { isWordPress: evidence.length > 0, evidence };
}

/**
 * Score relevance of WordPress-hosted hosts to the target root domain:
 * hosts that reference the brand name score highest.
 *
 * @param {ReturnType<typeof extractWpHosts>} hosts
 * @param {string} rootDomain e.g. "example.com"
 * @returns {{host: string, score: number, reasons: string[]}[]}
 */
export function scoreWpHosts(hosts = [], rootDomain = '') {
  const brand = normalizeHostname(rootDomain).split('.')[0];
  return (hosts || [])
    .map(h => {
      let score = 25;
      const reasons = ['WordPress-hosted property'];
      if (brand && h.host.includes(brand)) {
        score += 45;
        reasons.push(`hostname references brand "${brand}"`);
      }
      if (h.sources.includes('dns-cname')) {
        score += 10;
        reasons.push('confirmed via DNS CNAME');
      }
      if (h.kind === 'wpengine-staging') {
        score += 10;
        reasons.push('staging environment');
      }
      return { host: h.host, score: Math.min(100, score), reasons };
    })
    .sort((a, b) => b.score - a.score);
}
