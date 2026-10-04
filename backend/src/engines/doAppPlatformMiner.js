/**
 * doAppPlatformMiner.js — DigitalOcean App Platform hostname intelligence engine.
 *
 * Idea 00265 — "DigitalOcean App Platform host mining": find
 * ondigitalocean.app hosts tied to the org via naming and certificate data.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived candidate app slugs and parses provider infrastructure
 * hints (CNAME targets, certificate SANs) that reveal the App Platform
 * deployment behind a hostname.
 *
 * DigitalOcean App Platform default domains look like
 * `<app-slug>-<random-suffix>.ondigitalocean.app`, e.g.
 * `acme-web-9x4kz.ondigitalocean.app`.
 */

/** DigitalOcean App Platform default domain suffix. */
export const DO_APP_DOMAIN = 'ondigitalocean.app';
/** Matches a full App Platform default hostname, capturing app slug + suffix. */
export const DO_APP_HOST_RE = /^([a-z0-9][a-z0-9-]{1,60}[a-z0-9])-([a-z0-9]{5})\.ondigitalocean\.app$/;
/** App slug fragment rules: lowercase alnum + dashes. */
export const DO_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/;

export const DO_SLUG_PREFIXES = ['app', 'web', 'api', 'my'];
export const DO_SLUG_SUFFIXES = [
  'app', 'web', 'api', 'staging', 'stage', 'prod', 'production', 'dev',
  'development', 'test', 'qa', 'uat', 'demo', 'beta', 'v1', 'v2',
  'site', 'portal', 'dashboard', 'backend', 'frontend', 'service',
];

/**
 * Slugify a brand name for use as a DigitalOcean app-slug fragment.
 * @param {string} brand
 * @returns {string}
 */
export function slugifyBrand(brand) {
  const slug = String(brand || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.slice(0, 50);
}

/**
 * Generate brand-derived App Platform app-slug candidates.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid app slugs
 */
export function generateDoAppSlugs(brand, options = {}) {
  const {
    prefixes = DO_SLUG_PREFIXES,
    suffixes = DO_SLUG_SUFFIXES,
    maxNames = 100,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = (name) => {
    if (out.size >= maxNames) return;
    if (DO_SLUG_RE.test(name)) out.add(name);
  };
  add(slug);
  for (const p of prefixes) add(`${p}-${slug}`);
  for (const s of suffixes) add(`${slug}-${s}`);
  for (const n of ['1', '2', '3']) add(`${slug}-${n}`);
  for (const y of ['2024', '2025', '2026']) add(`${slug}-${y}`);
  return [...out];
}

/**
 * Decompose an ondigitalocean.app hostname into app slug + random suffix.
 *
 * @param {string} hostname e.g. "acme-web-9x4kz.ondigitalocean.app"
 * @returns {{hostname: string, appSlug: string, suffix: string}|null}
 */
export function parseDoAppHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  const m = h.match(DO_APP_HOST_RE);
  if (!m) return null;
  return { hostname: h, appSlug: m[1], suffix: m[2] };
}

/**
 * Check whether a hostname belongs to DigitalOcean App Platform.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isDoAppHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return h === DO_APP_DOMAIN || h.endsWith(`.${DO_APP_DOMAIN}`);
}

/**
 * Parse DNS records for DigitalOcean App Platform infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, appSlug: string|null, suffix: string|null}[]}
 */
export function parseDoDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '').toLowerCase().replace(/\.$/, '');
    if (!target || !isDoAppHost(target)) continue;
    const parsed = parseDoAppHostname(target);
    hits.push({
      recordName: String(rec?.name || ''),
      target,
      appSlug: parsed ? parsed.appSlug : null,
      suffix: parsed ? parsed.suffix : null,
    });
  }
  return hits;
}

/**
 * Parse certificate SANs for ondigitalocean.app default-domain leaks and
 * app-slug matches.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @param {string} [brandSlug] optional slug; matches any SAN containing it
 * @returns {{san: string, appSlug: string|null, brandMatch: boolean}[]}
 */
export function parseDoCertHints(sans = [], brandSlug = '') {
  const slug = String(brandSlug || '').toLowerCase();
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '').toLowerCase().replace(/^\*\./, '');
    if (!san || !isDoAppHost(san)) continue;
    const parsed = parseDoAppHostname(san);
    const appSlug = parsed ? parsed.appSlug : null;
    hits.push({
      san: String(raw),
      appSlug,
      brandMatch: !!(slug && san.includes(slug)),
    });
  }
  return hits;
}
