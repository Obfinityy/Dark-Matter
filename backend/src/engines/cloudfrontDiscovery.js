/**
 * cloudfrontDiscovery.js — AWS CloudFront distribution discovery engine.
 *
 * Idea 00270 — "CloudFront distribution discovery": find CloudFront
 * distributions via DNS and certificate data, then map their origins.
 *
 * Pure functions only: callers resolve DNS records and fetch certificate
 * data themselves (respecting rate limits) and pass the raw data in. No
 * live HTTP or DNS lookups happen here — this module identifies CloudFront
 * distribution hostnames (d<id>.cloudfront.net), extracts distribution IDs
 * from DNS CNAME chains and certificate SANs, and maps each distribution
 * to customer-domain and origin hints (e.g. S3 website endpoints) found in
 * the same data.
 */

/** CloudFront distribution domain suffix. */
export const CLOUDFRONT_SUFFIX = 'cloudfront.net';
/** CloudFront distribution IDs look like d + 13 base36 chars, e.g. d1abc2def3gh4. */
export const CLOUDFRONT_ID_RE = /^d[a-z0-9]{12,14}$/i;

/**
 * Extract the CloudFront distribution ID from a distribution hostname.
 *
 * @param {string} hostname e.g. "d1abc2def3gh4.cloudfront.net"
 * @returns {string|null} the distribution ID, or null if not a distribution host
 */
export function distributionIdFromHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (h === CLOUDFRONT_SUFFIX || !h.endsWith(`.${CLOUDFRONT_SUFFIX}`)) return null;
  const id = h.slice(0, -(CLOUDFRONT_SUFFIX.length + 1));
  return CLOUDFRONT_ID_RE.test(id) ? id : null;
}

/**
 * Check whether a hostname is a CloudFront distribution hostname.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isCloudFrontHost(hostname) {
  return distributionIdFromHost(hostname) !== null;
}

/** Suffixes that identify likely S3 origins behind a CloudFront distribution. */
const S3_ORIGIN_SUFFIXES = [
  '.s3.amazonaws.com',
  '.s3-website-', '.s3-website.',
  '.s3.',
];
/** Suffixes that identify other common origin infrastructure. */
const KNOWN_ORIGIN_SUFFIXES = [
  '.amazonaws.com', '.elasticbeanstalk.com', '.elb.amazonaws.com',
  '.herokuapp.com', '.onrender.com', '.up.railway.app', '.fly.dev',
  '.ondigitalocean.app', '.azureedge.net', '.blob.core.windows.net',
  '.storage.googleapis.com',
];

/**
 * Classify an origin hint by the infrastructure it points to.
 *
 * @param {string} host
 * @returns {'s3'|'aws'|'heroku'|'render'|'railway'|'fly'|'digitalocean'|'azure'|'gcp'|'other'}
 */
export function classifyOriginHint(host) {
  const h = String(host || '').toLowerCase();
  if (S3_ORIGIN_SUFFIXES.some((s) => h.includes(s))) return 's3';
  if (h.includes('.elasticbeanstalk.com') || h.includes('.elb.amazonaws.com') ||
      h.includes('.amazonaws.com')) return 'aws';
  if (h.includes('.herokuapp.com')) return 'heroku';
  if (h.includes('.onrender.com')) return 'render';
  if (h.includes('.up.railway.app')) return 'railway';
  if (h.includes('.fly.dev')) return 'fly';
  if (h.includes('.ondigitalocean.app')) return 'digitalocean';
  if (h.includes('.blob.core.windows.net') || h.includes('.azureedge.net')) return 'azure';
  if (h.includes('.storage.googleapis.com')) return 'gcp';
  return 'other';
}

/**
 * Parse DNS records for CloudFront distribution hints: customer hostnames
 * whose CNAME chains terminate at a *.cloudfront.net distribution.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved (CNAME records are the interesting ones)
 * @returns {{customerHost: string, distributionHost: string,
 *   distributionId: string|null}[]}
 */
export function parseCloudFrontDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '').toLowerCase().replace(/\.$/, '');
    if (!target) continue;
    const id = distributionIdFromHost(target);
    if (id) {
      hits.push({
        customerHost: String(rec?.name || ''),
        distributionHost: target,
        distributionId: id,
      });
    }
  }
  return hits;
}

/**
 * Parse certificate SANs for CloudFront distribution and customer-domain
 * mappings. A cert served by a distribution lists the distribution host
 * and/or the customer domains (alternate domain names) it fronts.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{distributionIds: string[], customerDomains: string[]}}
 */
export function parseCloudFrontCertHints(sans = []) {
  const distributionIds = new Set();
  const customerDomains = new Set();
  for (const raw of sans || []) {
    const san = String(raw || '').toLowerCase().replace(/^\*\./, '');
    if (!san) continue;
    const id = distributionIdFromHost(san);
    if (id) {
      distributionIds.add(id);
    } else if (!san.endsWith('.amazonaws.com')) {
      customerDomains.add(san);
    }
  }
  return {
    distributionIds: [...distributionIds],
    customerDomains: [...customerDomains].sort(),
  };
}

/**
 * Map a CloudFront distribution to origin hints found in DNS/certificate
 * data and optional HTTP header evidence supplied by the caller.
 *
 * @param {string} distributionHost the *.cloudfront.net hostname
 * @param {{
 *   dnsTargets?: string[],
 *   certSans?: string[],
 *   headerHints?: string[],
 * }} [evidence] raw data the caller already collected
 * @returns {{
 *   distributionHost: string,
 *   distributionId: string|null,
 *   customerDomains: string[],
 *   originHints: {host: string, kind: string}[],
 * }}
 */
export function mapDistributionToOrigins(distributionHost, evidence = {}) {
  const host = String(distributionHost || '').toLowerCase().replace(/\.$/, '');
  const id = distributionIdFromHost(host);
  const customerDomains = new Set();
  const origins = new Map(); // host -> kind

  const noteHost = (raw) => {
    const h = String(raw || '').toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
    if (!h || h === host || isCloudFrontHost(h)) return;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)) return;
    if (KNOWN_ORIGIN_SUFFIXES.some((s) => h.includes(s))) {
      origins.set(h, classifyOriginHint(h));
    } else {
      customerDomains.add(h);
    }
  };

  for (const t of evidence.dnsTargets || []) noteHost(t);
  for (const s of evidence.certSans || []) noteHost(s);
  for (const hint of evidence.headerHints || []) {
    // Header hints may be full header lines; pull hostname-looking tokens.
    for (const m of String(hint).matchAll(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi)) {
      noteHost(m[0]);
    }
  }

  return {
    distributionHost: host,
    distributionId: id,
    customerDomains: [...customerDomains].sort(),
    originHints: [...origins.entries()]
      .map(([h, kind]) => ({ host: h, kind }))
      .sort((a, b) => a.host.localeCompare(b.host)),
  };
}
