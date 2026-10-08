/**
 * s3BucketPermuter.js — AWS S3 bucket-name permutation engine.
 *
 * Idea 00267 — "AWS S3 bucket-name permutation": test S3 bucket names
 * derived from the brand and subdomains, since bucket names often mirror
 * hosts.
 *
 * Pure functions only: callers probe candidate bucket names themselves
 * (respecting AWS request rate limits) and pass DNS records in for hint
 * parsing. No live HTTP requests happen here — this module generates
 * brand-derived, rule-valid bucket-name candidates plus the virtual-hosted
 * and website-endpoint URLs a caller would check, and parses CNAME targets
 * that reveal the bucket behind a hostname.
 */

/** S3 bucket naming rules: lowercase letters, numbers, hyphens, dots; 3-63 chars. */
export const S3_BUCKET_RE = /^(?!.*\.\.)(?!.*\.-)(?!.*-\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
export const IP_LIKE_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export const S3_BUCKET_PREFIXES = ['app', 'web', 'assets'];
export const S3_BUCKET_SUFFIXES = [
  'app',
  'web',
  'assets',
  'static',
  'media',
  'files',
  'uploads',
  'images',
  'docs',
  'backup',
  'backups',
  'data',
  'logs',
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
  'cdn',
  'www',
  'site',
  'portal',
  'bucket',
  's3',
  'storage',
];

export const S3_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'sa-east-1',
];

/**
 * Slugify a brand name into a valid S3 bucket-name fragment.
 * @param {string} brand
 * @returns {string}
 */
export function slugifyBrand(brand) {
  const slug = String(brand || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}|\.{2,}/g, '-');
  return slug.slice(0, 40);
}

/**
 * Validate a candidate against S3 bucket naming rules.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidS3BucketName(name) {
  const n = String(name || '');
  if (!S3_BUCKET_RE.test(n)) return false;
  if (IP_LIKE_RE.test(n)) return false;
  if (/^xn--/.test(n)) return false;
  return true;
}

/**
 * Generate brand-derived S3 bucket-name candidates (optionally seeded with
 * the org's subdomains, whose labels often mirror bucket names).
 *
 * @param {string} brand brand/org name
 * @param {string[]} [subdomains] e.g. ["api.example.com"]
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid bucket names
 */
export function generateS3BucketNames(brand, subdomains = [], options = {}) {
  const { prefixes = S3_BUCKET_PREFIXES, suffixes = S3_BUCKET_SUFFIXES, maxNames = 200 } = options;
  const slug = slugifyBrand(brand);
  const seeds = new Set();
  if (slug) seeds.add(slug);
  for (const sub of subdomains || []) {
    const host = String(sub || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!host) continue;
    const labels = host.split('.').slice(0, -2);
    for (const label of labels) {
      const s = slugifyBrand(label);
      if (s && isValidS3BucketName(s)) seeds.add(s);
    }
  }
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (isValidS3BucketName(name)) out.add(name);
  };
  for (const seed of seeds) {
    add(seed);
    for (const p of prefixes) add(`${p}-${seed}`);
    for (const s of suffixes) add(`${seed}-${s}`);
    for (const s of suffixes) add(`${seed}${s}`);
    for (const n of ['1', '2', '3']) add(`${seed}-${n}`);
    for (const y of ['2024', '2025', '2026']) add(`${seed}-${y}`);
  }
  return [...out];
}

/**
 * Build the virtual-hosted-style URL a caller would probe for a bucket.
 * @param {string} bucket
 * @returns {string}
 */
export function s3BucketUrl(bucket) {
  return `https://${String(bucket).toLowerCase()}.s3.amazonaws.com`;
}

/**
 * Build static-website endpoint URLs across regions for a bucket.
 * @param {string} bucket
 * @param {string[]} [regions]
 * @returns {string[]}
 */
export function s3WebsiteUrls(bucket, regions = S3_REGIONS) {
  const b = String(bucket).toLowerCase();
  const urls = [];
  for (const r of regions) {
    urls.push(`http://${b}.s3-website-${r}.amazonaws.com`);
    urls.push(`http://${b}.s3-website.${r}.amazonaws.com`);
  }
  return urls;
}

/** Suffixes identifying S3-backed DNS targets. */
const S3_TARGET_RES = [
  /^([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3\.amazonaws\.com$/,
  /^([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$/,
  /^([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3-website-([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$/,
  /^([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3-website\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$/,
];

/**
 * Extract the S3 bucket name from an S3-backed hostname.
 * @param {string} hostname
 * @returns {{bucket: string, style: 'virtual-hosted'|'website', region: string|null}|null}
 */
export function bucketNameFromS3Host(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  for (const re of S3_TARGET_RES) {
    const m = h.match(re);
    if (m) {
      return {
        bucket: m[1],
        style: re.source.includes('website') ? 'website' : 'virtual-hosted',
        region: m[2] || null,
      };
    }
  }
  return null;
}

/**
 * Parse DNS records for S3-backed infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, bucket: string,
 *   style: string, region: string|null}[]}
 */
export function parseS3DnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target) continue;
    const parsed = bucketNameFromS3Host(target);
    if (parsed) {
      hits.push({
        recordName: String(rec?.name || ''),
        target,
        bucket: parsed.bucket,
        style: parsed.style,
        region: parsed.region,
      });
    }
  }
  return hits;
}
