/**
 * herokuAppEnum.js — Heroku app-name hostname intelligence engine.
 *
 * Idea 00261 — "Heroku app-name brute forcing": probe herokuapp.com names
 * derived from the brand to find forgotten Heroku apps with dangling DNS.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived candidate app names and parses provider infrastructure
 * hints (CNAME targets, certificate SANs) that reveal the Heroku app
 * behind a hostname.
 */

/** Default Heroku platform domain for app URLs. */
export const HEROKU_APP_DOMAIN = 'herokuapp.com';
/** Heroku's managed DNS suffix used for custom-domain routing. */
export const HEROKU_DNS_SUFFIX = 'herokudns.com';
/** Heroku app names: lowercase letters, numbers, dashes; 3-30 chars. */
export const HEROKU_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export const HEROKU_NAME_PREFIXES = ['app', 'web', 'api', 'my'];
export const HEROKU_NAME_SUFFIXES = [
  'app',
  'web',
  'api',
  'staging',
  'stage',
  'prod',
  'production',
  'dev',
  'development',
  'test',
  'qa',
  'uat',
  'demo',
  'beta',
  'v1',
  'v2',
  'site',
  'portal',
  'dashboard',
  'backend',
  'frontend',
  'service',
];

/**
 * Slugify a brand name for use as a Heroku app-name fragment.
 * @param {string} brand e.g. "Acme Corp"
 * @returns {string} e.g. "acme-corp"
 */
export function slugifyBrand(brand) {
  const slug = String(brand || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.slice(0, 24);
}

/**
 * Generate brand-derived Heroku app-name candidates.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid Heroku app names
 */
export function generateHerokuAppNames(brand, options = {}) {
  const {
    prefixes = HEROKU_NAME_PREFIXES,
    suffixes = HEROKU_NAME_SUFFIXES,
    maxNames = 100,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (HEROKU_NAME_RE.test(name)) out.add(name);
  };
  add(slug);
  for (const p of prefixes) add(`${p}-${slug}`);
  for (const s of suffixes) add(`${slug}-${s}`);
  for (const s of suffixes) add(`${slug}${s}`);
  for (const n of ['1', '2', '3']) add(`${slug}-${n}`);
  for (const y of ['2024', '2025', '2026']) add(`${slug}-${y}`);
  return [...out];
}

/**
 * Build the default Heroku app URL for an app name.
 * @param {string} appName
 * @returns {string}
 */
export function herokuAppUrl(appName) {
  return `https://${String(appName).toLowerCase()}.${HEROKU_APP_DOMAIN}`;
}

/**
 * Build the Heroku managed-DNS target a custom domain would CNAME to.
 * @param {string} appName
 * @returns {string}
 */
export function herokuDnsTarget(appName) {
  return `${String(appName).toLowerCase()}.${HEROKU_DNS_SUFFIX}`;
}

/**
 * Parse DNS records for Heroku infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   (CNAME/ALIAS/ANAME) the caller already resolved
 * @returns {{recordName: string, target: string, appName: string|null,
 *   kind: 'app-default-domain'|'custom-domain-pointer'}[]}
 */
export function parseHerokuDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target) continue;
    if (target === HEROKU_APP_DOMAIN || target.endsWith(`.${HEROKU_APP_DOMAIN}`)) {
      const appName = target.split('.')[0] || null;
      hits.push({
        recordName: String(rec?.name || ''),
        target,
        appName,
        kind: 'app-default-domain',
      });
    } else if (target.endsWith(`.${HEROKU_DNS_SUFFIX}`)) {
      hits.push({
        recordName: String(rec?.name || ''),
        target,
        appName: null,
        kind: 'custom-domain-pointer',
      });
    }
  }
  return hits;
}

/**
 * Parse certificate SANs for Heroku default-domain leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, appName: string}[]}
 */
export function parseHerokuCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    if (san === HEROKU_APP_DOMAIN || san.endsWith(`.${HEROKU_APP_DOMAIN}`)) {
      hits.push({ san: String(raw), appName: san.split('.')[0] });
    }
  }
  return hits;
}

/**
 * Check whether a hostname belongs to Heroku platform infrastructure.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isHerokuHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return (
    h === HEROKU_APP_DOMAIN ||
    h.endsWith(`.${HEROKU_APP_DOMAIN}`) ||
    h === HEROKU_DNS_SUFFIX ||
    h.endsWith(`.${HEROKU_DNS_SUFFIX}`)
  );
}
