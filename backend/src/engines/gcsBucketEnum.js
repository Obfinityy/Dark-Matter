/**
 * gcsBucketEnum.js — Google Cloud Storage bucket enumeration engine.
 *
 * Idea 00269 — "GCP storage bucket enumeration": probe
 * storage.googleapis.com bucket names derived from the brand.
 *
 * Pure functions only: callers probe candidate bucket names themselves
 * (respecting Google request rate limits) and pass DNS records or
 * certificate data in for hint parsing. No live HTTP requests happen here —
 * this module generates brand-derived, rule-valid bucket-name candidates
 * plus the URLs a caller would check, and parses CNAME targets that reveal
 * the bucket behind a hostname.
 */

/** GCS bucket rules: 3-63 chars, lowercase letters, numbers, dashes, underscores, dots. */
export const GCS_BUCKET_RE = /^(?!.*\.\.)(?!.*\.-)(?!.*-\.)[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;
export const IP_LIKE_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export const GCS_BUCKET_SUFFIX = 'storage.googleapis.com';
export const GCS_LEGACY_SUFFIX = 'commondatastorage.googleapis.com';

export const GCS_BUCKET_PREFIXES = ['app', 'web', 'assets'];
export const GCS_BUCKET_SUFFIXES = [
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
  'gcs',
  'storage',
];

/**
 * Slugify a brand name into a valid GCS bucket-name fragment.
 * @param {string} brand
 * @returns {string}
 */
export function slugifyBrand(brand) {
  const slug = String(brand || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/-{2,}|\.{2,}|_{2,}/g, '-');
  return slug.slice(0, 40);
}

/**
 * Validate a candidate against GCS bucket naming rules.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidGcsBucketName(name) {
  const n = String(name || '');
  if (!GCS_BUCKET_RE.test(n)) return false;
  if (IP_LIKE_RE.test(n)) return false;
  if (/^goog/.test(n) || /google/.test(n)) return false; // reserved by Google
  return true;
}

/**
 * Generate brand-derived GCS bucket-name candidates (optionally seeded with
 * the org's subdomains, whose labels often mirror bucket names).
 *
 * @param {string} brand brand/org name
 * @param {string[]} [subdomains] e.g. ["api.example.com"]
 * @param {{prefixes?: string[], suffixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid bucket names
 */
export function generateGcsBucketNames(brand, subdomains = [], options = {}) {
  const {
    prefixes = GCS_BUCKET_PREFIXES,
    suffixes = GCS_BUCKET_SUFFIXES,
    maxNames = 200,
  } = options;
  const slug = slugifyBrand(brand);
  const seeds = new Set();
  if (slug && isValidGcsBucketName(slug)) seeds.add(slug);
  for (const sub of subdomains || []) {
    const host = String(sub || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!host) continue;
    const labels = host.split('.').slice(0, -2);
    for (const label of labels) {
      const s = slugifyBrand(label);
      if (s && isValidGcsBucketName(s)) seeds.add(s);
    }
  }
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (isValidGcsBucketName(name)) out.add(name);
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
export function gcsBucketUrl(bucket) {
  return `https://${String(bucket).toLowerCase()}.${GCS_BUCKET_SUFFIX}`;
}

/**
 * Build the path-style URL for a bucket.
 * @param {string} bucket
 * @returns {string}
 */
export function gcsPathStyleUrl(bucket) {
  return `https://${GCS_BUCKET_SUFFIX}/${String(bucket).toLowerCase()}`;
}

/**
 * Extract the GCS bucket name from a GCS-backed hostname.
 * @param {string} hostname
 * @returns {string|null}
 */
export function bucketNameFromGcsHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  for (const suffix of [GCS_BUCKET_SUFFIX, GCS_LEGACY_SUFFIX]) {
    if (h.endsWith(`.${suffix}`)) {
      const bucket = h.slice(0, -(suffix.length + 1));
      if (bucket && isValidGcsBucketName(bucket)) return bucket;
      return null;
    }
  }
  return null;
}

/**
 * Check whether a hostname belongs to Google Cloud Storage endpoints.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isGcsHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return (
    h === GCS_BUCKET_SUFFIX ||
    h.endsWith(`.${GCS_BUCKET_SUFFIX}`) ||
    h === GCS_LEGACY_SUFFIX ||
    h.endsWith(`.${GCS_LEGACY_SUFFIX}`)
  );
}

/**
 * Parse DNS records for GCS-backed infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, bucket: string|null}[]}
 */
export function parseGcsDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target || !isGcsHost(target)) continue;
    hits.push({
      recordName: String(rec?.name || ''),
      target,
      bucket: bucketNameFromGcsHost(target),
    });
  }
  return hits;
}

/**
 * Parse certificate SANs for GCS bucket-name leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, bucket: string|null}[]}
 */
export function parseGcsCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    if (!san || !isGcsHost(san)) continue;
    hits.push({ san: String(raw), bucket: bucketNameFromGcsHost(san) });
  }
  return hits;
}
