/**
 * netlifySiteEnum.js — Netlify site-name enumeration engine.
 *
 * Covers idea-bank item 00256:
 *  - 00256 Netlify site-name enumeration — discover Netlify-deployed sites
 *    via DNS CNAME patterns and Netlify's naming conventions.
 *
 * Pure functions only: callers perform DNS lookups themselves (respecting
 * resolver rate limits) and pass CNAME targets in. This module generates
 * brand-derived candidate site names using Netlify's naming conventions
 * (`<site>.netlify.app`, deploy previews, branch subdomains) and parses
 * CNAME targets to recognize Netlify-hosted hosts and recover site names.
 * No live DNS or HTTP here.
 */

/** Netlify apex/CNAME targets that prove a host is Netlify-deployed. */
export const NETLIFY_CNAME_TARGETS = [
  'netlify.app',
  'netlify.com',
  'netlify.global',
  'netlify-edge.global',
];

/** Common Netlify deploy-context subdomains / name suffixes. */
export const NETLIFY_CONTEXT_SUFFIXES = [
  'staging',
  'stage',
  'dev',
  'development',
  'test',
  'qa',
  'uat',
  'preview',
  'demo',
  'beta',
  'canary',
  'prod',
  'production',
  'app',
  'web',
  'site',
];

/** Netlify branch-deploy subdomain prefixes (branch.<site>.netlify.app). */
export const NETLIFY_BRANCH_PREFIXES = [
  'staging',
  'develop',
  'dev',
  'main',
  'master',
  'preview',
  'qa',
  'release',
];

/**
 * Normalize a site name or brand to Netlify's slug rules: lowercase,
 * alphanumerics and single hyphens.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Derive brand tokens from a root domain or company name for name guessing:
 * the registrable label, label without common corp suffixes, and any
 * hyphen/word splits.
 *
 * @param {string} brand root domain (example.com) or company name
 * @returns {string[]} unique slug tokens, longest first
 */
export function brandTokens(brand) {
  const label = String(brand || '')
    .toLowerCase()
    .split('.')[0];
  const base = slugify(label);
  const tokens = new Set();
  if (base) tokens.add(base);
  // Strip common corporate suffixes: acme-inc -> acme.
  const stripped = base.replace(/-(inc|llc|ltd|co|corp|hq|io|app)$/, '');
  if (stripped && stripped !== base) tokens.add(stripped);
  // Word splits: acme-corp -> acme, corp.
  for (const part of base.split('-')) {
    if (part.length > 2) tokens.add(part);
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

/**
 * Generate candidate Netlify site names for a brand.
 *
 * Produces `<token>.netlify.app`, context-suffixed variants
 * (`<token>-staging.netlify.app`), branch-deploy subdomains, and deploy
 * preview patterns (`deploy-preview-<n>--<token>.netlify.app` skeleton).
 * These are CANDIDATES for the caller to resolve — no DNS is performed here.
 *
 * @param {string} brand root domain or company name
 * @param {{maxPreviews?: number}} [options]
 * @returns {{site: string, host: string, kind: 'site'|'context'|'branch'|'preview'}[]}
 */
export function generateSiteNames(brand, options = {}) {
  const { maxPreviews = 5 } = options;
  const tokens = brandTokens(brand);
  const out = [];
  const seen = new Set();
  const push = (site, kind) => {
    if (seen.has(site)) return;
    seen.add(site);
    out.push({ site, host: `${site}.netlify.app`, kind });
  };

  for (const token of tokens) {
    push(token, 'site');
    for (const suffix of NETLIFY_CONTEXT_SUFFIXES) {
      push(`${token}-${suffix}`, 'context');
    }
    for (const branch of NETLIFY_BRANCH_PREFIXES) {
      push(`${branch}--${token}`, 'branch');
    }
    for (let n = 1; n <= maxPreviews; n += 1) {
      push(`deploy-preview-${n}--${token}`, 'preview');
    }
  }
  return out;
}

/**
 * Parse a DNS CNAME target and decide whether it points at Netlify.
 *
 * @param {string} cnameTarget CNAME record target (as returned by the caller)
 * @returns {{isNetlify: boolean, target: string, kind: 'apex'|'site'|null}}
 */
export function parseCnameTarget(cnameTarget) {
  const target = String(cnameTarget || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!target) return { isNetlify: false, target: '', kind: null };
  for (const apex of NETLIFY_CNAME_TARGETS) {
    if (target === apex || target.endsWith(`.${apex}`)) {
      return { isNetlify: true, target, kind: target === apex ? 'apex' : 'site' };
    }
  }
  return { isNetlify: false, target, kind: null };
}

/**
 * Recover the Netlify site slug from a `<site>.netlify.app` hostname.
 *
 * @param {string} host
 * @returns {{site: string, context: 'deploy-preview'|'branch-deploy'|'production'|null, branch: string|null}|null}
 */
export function extractSiteNameFromHost(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const m = h.match(/^(.+)\.netlify\.app$/);
  if (!m) return null;
  const slug = m[1];
  let m2 = slug.match(/^deploy-preview-(\d+)--(.+)$/);
  if (m2) return { site: m2[2], context: 'deploy-preview', branch: `pr-${m2[1]}` };
  m2 = slug.match(/^(.+)--(.+)$/);
  if (m2) return { site: m2[2], context: 'branch-deploy', branch: m2[1] };
  return { site: slug, context: 'production', branch: null };
}

/**
 * Correlate a set of caller-resolved `{host, cname}` pairs with a brand:
 * keep Netlify-hosted hosts, recover site names, and flag brand matches.
 *
 * @param {{host: string, cname: string}[]} resolutions
 * @param {string} brand root domain or company name
 * @returns {{host: string, cname: string, site: string|null, context: string|null, brandMatch: boolean}[]}
 */
export function correlateResolutions(resolutions, brand) {
  const tokens = brandTokens(brand);
  const out = [];
  for (const r of resolutions || []) {
    const host = String(r?.host || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const parsed = parseCnameTarget(r?.cname);
    if (!parsed.isNetlify && !/\.netlify\.app$/.test(host)) continue;
    const siteInfo = extractSiteNameFromHost(host);
    const site = siteInfo ? siteInfo.site : parsed.isNetlify ? slugify(host.split('.')[0]) : null;
    const brandMatch = tokens.some(t => (site || '').includes(t) || host.includes(t));
    out.push({
      host,
      cname: parsed.target,
      site,
      context: siteInfo ? siteInfo.context : null,
      brandMatch,
    });
  }
  return out.sort(
    (a, b) => Number(b.brandMatch) - Number(a.brandMatch) || a.host.localeCompare(b.host)
  );
}
