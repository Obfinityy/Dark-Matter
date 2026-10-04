/**
 * flyioAppDiscovery.js — Fly.io app-name hostname intelligence engine.
 *
 * Idea 00264 — "Fly.io app-name discovery": discover fly.dev apps via
 * brand-derived names and DNS history.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived candidate app names and parses provider infrastructure
 * hints (CNAME targets, certificate SANs) that reveal the Fly.io app
 * behind a hostname.
 */

/** Default Fly.io platform domain for deployed apps. */
export const FLY_APP_DOMAIN = 'fly.dev';
/** Legacy/alternate Fly.io host suffix seen in older deployments. */
export const FLY_LEGACY_SUFFIX = 'flyio.net';
/** Fly app names: lowercase letters, numbers, dashes; 3-30 chars. */
export const FLY_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export const FLY_NAME_PREFIXES = ['app', 'web', 'api', 'my'];
export const FLY_NAME_SUFFIXES = [
  'app', 'web', 'api', 'staging', 'stage', 'prod', 'production', 'dev',
  'development', 'test', 'qa', 'uat', 'demo', 'beta', 'v1', 'v2',
  'site', 'portal', 'dashboard', 'backend', 'frontend', 'service',
];

/**
 * Slugify a brand name for use as a Fly.io app-name fragment.
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
  return slug.slice(0, 24);
}

/**
 * Generate brand-derived Fly.io app-name candidates.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid Fly.io app names
 */
export function generateFlyAppNames(brand, options = {}) {
  const {
    prefixes = FLY_NAME_PREFIXES,
    suffixes = FLY_NAME_SUFFIXES,
    maxNames = 100,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = (name) => {
    if (out.size >= maxNames) return;
    if (FLY_NAME_RE.test(name)) out.add(name);
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
 * Build the default Fly.io app URL for an app name.
 * @param {string} appName
 * @returns {string}
 */
export function flyAppUrl(appName) {
  return `https://${String(appName).toLowerCase()}.${FLY_APP_DOMAIN}`;
}

/**
 * Extract the Fly.io app name from a fly.dev hostname.
 * @param {string} hostname
 * @returns {string|null}
 */
export function appNameFromHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (h === FLY_APP_DOMAIN || !h.endsWith(`.${FLY_APP_DOMAIN}`)) return null;
  const label = h.slice(0, -(FLY_APP_DOMAIN.length + 1));
  return label || null;
}

/**
 * Parse DNS records for Fly.io infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, appName: string|null}[]}
 */
export function parseFlyDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME', 'AAAA', 'A'].includes(type)) continue;
    const target = String(rec?.value || '').toLowerCase().replace(/\.$/, '');
    if (!target) continue;
    const appName = appNameFromHost(target);
    if (appName) {
      hits.push({
        recordName: String(rec?.name || ''),
        target, appName,
      });
    } else if (target.endsWith(`.${FLY_LEGACY_SUFFIX}`)) {
      // Legacy flyio.net target still identifies the deployment.
      hits.push({
        recordName: String(rec?.name || ''),
        target, appName: target.split('.')[0] || null,
      });
    }
  }
  return hits;
}

/**
 * Parse certificate SANs for fly.dev default-domain leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, appName: string}[]}
 */
export function parseFlyCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '').toLowerCase().replace(/^\*\./, '');
    const appName = appNameFromHost(san);
    if (appName) hits.push({ san: String(raw), appName });
  }
  return hits;
}

/**
 * Check whether a hostname belongs to Fly.io platform infrastructure.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isFlyHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return h === FLY_APP_DOMAIN || h.endsWith(`.${FLY_APP_DOMAIN}`) ||
    h === FLY_LEGACY_SUFFIX || h.endsWith(`.${FLY_LEGACY_SUFFIX}`);
}
