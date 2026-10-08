/**
 * beanstalkUrlMiner.js — AWS Elastic Beanstalk URL mining engine.
 *
 * Idea 00266 — "AWS Elastic Beanstalk URL mining": enumerate
 * elasticbeanstalk.com environments from brand patterns and CT logs.
 *
 * Pure functions only: callers resolve candidate hostnames themselves
 * (respecting DNS rate limits) and pass DNS records or certificate data in.
 * No live HTTP or DNS brute-forcing happens here — this module generates
 * brand-derived environment-name candidates across AWS regions and parses
 * provider infrastructure hints (CNAME targets, certificate SANs) that
 * reveal the Beanstalk environment behind a hostname.
 *
 * Beanstalk environment URLs look like
 * `<env-name>.<region>.elasticbeanstalk.com`, e.g.
 * `acme-prod.us-east-1.elasticbeanstalk.com`.
 */

/** Elastic Beanstalk public domain suffix. */
export const BEANSTALK_DOMAIN = 'elasticbeanstalk.com';
/** Matches a full Beanstalk environment hostname, capturing env + region. */
export const BEANSTALK_HOST_RE =
  /^([a-z0-9][a-z0-9-]{0,60}[a-z0-9])\.([a-z]{2}-[a-z]+-\d)\.elasticbeanstalk\.com$/;

export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1',
  'ca-central-1',
  'af-south-1',
  'me-south-1',
];

export const BEANSTALK_ENV_PREFIXES = ['app', 'web', 'api', 'my'];
export const BEANSTALK_ENV_SUFFIXES = [
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
  'env',
];

/**
 * Slugify a brand name for use as a Beanstalk environment-name fragment.
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
  return slug.slice(0, 30);
}

/**
 * Generate brand-derived Beanstalk environment hostnames across regions.
 *
 * @param {string} brand brand/org name
 * @param {{prefixes?: string[], suffixes?: string[], regions?: string[],
 *   maxNames?: number}} [options]
 * @returns {string[]} unique environment hostnames
 */
export function generateBeanstalkUrls(brand, options = {}) {
  const {
    prefixes = BEANSTALK_ENV_PREFIXES,
    suffixes = BEANSTALK_ENV_SUFFIXES,
    regions = AWS_REGIONS,
    maxNames = 400,
  } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const envNames = new Set([slug]);
  for (const p of prefixes) envNames.add(`${p}-${slug}`);
  for (const s of suffixes) envNames.add(`${slug}-${s}`);
  for (const n of ['1', '2']) envNames.add(`${slug}-${n}`);
  const out = [];
  for (const env of envNames) {
    for (const region of regions) {
      if (out.length >= maxNames) break;
      out.push(`${env}.${region}.${BEANSTALK_DOMAIN}`);
    }
    if (out.length >= maxNames) break;
  }
  return out;
}

/**
 * Decompose a Beanstalk environment hostname into env name + region.
 *
 * @param {string} hostname e.g. "acme-prod.us-east-1.elasticbeanstalk.com"
 * @returns {{hostname: string, envName: string, region: string}|null}
 */
export function parseBeanstalkHostname(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const m = h.match(BEANSTALK_HOST_RE);
  if (!m) return null;
  return { hostname: h, envName: m[1], region: m[2] };
}

/**
 * Check whether a hostname belongs to Elastic Beanstalk infrastructure.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isBeanstalkHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return h === BEANSTALK_DOMAIN || h.endsWith(`.${BEANSTALK_DOMAIN}`);
}

/**
 * Parse DNS records for Elastic Beanstalk infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, envName: string|null,
 *   region: string|null}[]}
 */
export function parseBeanstalkDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target || !isBeanstalkHost(target)) continue;
    const parsed = parseBeanstalkHostname(target);
    hits.push({
      recordName: String(rec?.name || ''),
      target,
      envName: parsed ? parsed.envName : null,
      region: parsed ? parsed.region : null,
    });
  }
  return hits;
}

/**
 * Parse certificate SANs for elasticbeanstalk.com environment leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, envName: string|null, region: string|null}[]}
 */
export function parseBeanstalkCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    if (!san || !isBeanstalkHost(san)) continue;
    const parsed = parseBeanstalkHostname(san);
    hits.push({
      san: String(raw),
      envName: parsed ? parsed.envName : null,
      region: parsed ? parsed.region : null,
    });
  }
  return hits;
}
