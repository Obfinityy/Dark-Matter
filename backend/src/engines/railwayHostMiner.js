/**
 * railwayHostMiner.js — Railway deployment hostname intelligence engine.
 *
 * Idea 00263 — "Railway deployment host mining": mine up.railway.app
 * deployments for brand-derived service names.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived candidate service names and parses provider infrastructure
 * hints (CNAME targets, certificate SANs) that reveal the Railway
 * deployment behind a hostname.
 */

/** Default Railway platform domain for deployed services. */
export const RAILWAY_APP_DOMAIN = 'up.railway.app';
/** Railway service names: lowercase letters, numbers, dashes; 2-32 chars. */
export const RAILWAY_NAME_RE = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

export const RAILWAY_NAME_PREFIXES = ['app', 'web', 'api', 'my'];
export const RAILWAY_NAME_SUFFIXES = [
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
 * Slugify a brand name for use as a Railway service-name fragment.
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
  return slug.slice(0, 28);
}

/**
 * Generate brand-derived Railway service-name candidates.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid Railway service names
 */
export function generateRailwayServiceNames(brand, options = {}) {
  const {
    prefixes = RAILWAY_NAME_PREFIXES,
    suffixes = RAILWAY_NAME_SUFFIXES,
    maxNames = 100,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (RAILWAY_NAME_RE.test(name)) out.add(name);
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
 * Build the default Railway deployment URL for a service name.
 * @param {string} serviceName
 * @returns {string}
 */
export function railwayDeploymentUrl(serviceName) {
  return `https://${String(serviceName).toLowerCase()}.${RAILWAY_APP_DOMAIN}`;
}

/**
 * Extract the Railway service name from an up.railway.app hostname.
 * @param {string} hostname
 * @returns {string|null}
 */
export function serviceNameFromHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (h === RAILWAY_APP_DOMAIN || !h.endsWith(`.${RAILWAY_APP_DOMAIN}`)) return null;
  const label = h.slice(0, -(RAILWAY_APP_DOMAIN.length + 1));
  return label || null;
}

/**
 * Parse DNS records for Railway infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, serviceName: string|null}[]}
 */
export function parseRailwayDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target) continue;
    const serviceName = serviceNameFromHost(target);
    if (serviceName) {
      hits.push({
        recordName: String(rec?.name || ''),
        target,
        serviceName,
      });
    }
  }
  return hits;
}

/**
 * Parse certificate SANs for up.railway.app default-domain leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, serviceName: string}[]}
 */
export function parseRailwayCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    const serviceName = serviceNameFromHost(san);
    if (serviceName) hits.push({ san: String(raw), serviceName });
  }
  return hits;
}

/**
 * Check whether a hostname belongs to Railway platform infrastructure.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isRailwayHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return (
    h === RAILWAY_APP_DOMAIN ||
    h.endsWith(`.${RAILWAY_APP_DOMAIN}`) ||
    h === 'railway.app' ||
    h.endsWith('.railway.app')
  );
}
