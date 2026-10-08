/**
 * renderServiceEnum.js — Render service-name hostname intelligence engine.
 *
 * Idea 00262 — "Render service-name enumeration": enumerate onrender.com
 * service names matching brand patterns.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived candidate service names and parses provider infrastructure
 * hints (CNAME targets, certificate SANs) that reveal the Render service
 * behind a hostname.
 */

/** Default Render platform domain for hosted services. */
export const RENDER_SERVICE_DOMAIN = 'onrender.com';
/** Render service names: lowercase letters, numbers, dashes; 3-40 chars. */
export const RENDER_NAME_RE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

export const RENDER_NAME_PREFIXES = ['app', 'web', 'api', 'my'];
export const RENDER_NAME_SUFFIXES = [
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
 * Slugify a brand name for use as a Render service-name fragment.
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
  return slug.slice(0, 32);
}

/**
 * Generate brand-derived Render service-name candidates.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid Render service names
 */
export function generateRenderServiceNames(brand, options = {}) {
  const {
    prefixes = RENDER_NAME_PREFIXES,
    suffixes = RENDER_NAME_SUFFIXES,
    maxNames = 100,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (RENDER_NAME_RE.test(name)) out.add(name);
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
 * Build the default Render service URL for a service name.
 * @param {string} serviceName
 * @returns {string}
 */
export function renderServiceUrl(serviceName) {
  return `https://${String(serviceName).toLowerCase()}.${RENDER_SERVICE_DOMAIN}`;
}

/**
 * Extract the Render service name from an onrender.com hostname.
 * @param {string} hostname
 * @returns {string|null}
 */
export function serviceNameFromHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (h === RENDER_SERVICE_DOMAIN || !h.endsWith(`.${RENDER_SERVICE_DOMAIN}`)) return null;
  const label = h.slice(0, -(RENDER_SERVICE_DOMAIN.length + 1));
  return label || null;
}

/**
 * Parse DNS records for Render infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, serviceName: string|null}[]}
 */
export function parseRenderDnsHints(records = []) {
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
 * Parse certificate SANs for onrender.com default-domain leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, serviceName: string}[]}
 */
export function parseRenderCertHints(sans = []) {
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
 * Check whether a hostname belongs to Render platform infrastructure.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isRenderHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return h === RENDER_SERVICE_DOMAIN || h.endsWith(`.${RENDER_SERVICE_DOMAIN}`);
}
