/**
 * cfPagesDiscovery.js — Cloudflare Pages project discovery engine.
 *
 * Covers idea-bank item 00258:
 *  - 00258 Cloudflare Pages project discovery — find Cloudflare Pages
 *    projects via pages.dev naming and custom-domain mappings.
 *
 * Pure functions only: callers perform DNS lookups themselves (respecting
 * resolver rate limits) and pass CNAME targets in. This module parses
 * `<project>.pages.dev` hostnames (including branch/preview variants like
 * `<branch>.<project>.pages.dev` and `<hash>.<project>.pages.dev`),
 * recognizes Cloudflare Pages CNAME delegation, maps custom domains to
 * projects, and generates brand-derived candidate project names. No live DNS
 * or HTTP here.
 */

/** Cloudflare Pages apex hosts. */
export const PAGES_DEV_APEX = 'pages.dev';

/** Common branch prefixes used in Cloudflare Pages preview deployments. */
export const PAGES_BRANCH_PREFIXES = [
  'staging',
  'develop',
  'dev',
  'main',
  'master',
  'preview',
  'qa',
  'release',
  'canary',
];

/** Common context suffixes for project-name guessing. */
export const PAGES_CONTEXT_SUFFIXES = [
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
  'app',
  'web',
  'site',
  'docs',
  'blog',
];

/**
 * Normalize to Cloudflare Pages project slug rules: lowercase alphanumerics
 * and single hyphens.
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
 * Derive brand tokens from a root domain or company name.
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
  const stripped = base.replace(/-(inc|llc|ltd|co|corp|hq|io|app)$/, '');
  if (stripped && stripped !== base) tokens.add(stripped);
  for (const part of base.split('-')) {
    if (part.length > 2) tokens.add(part);
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

/**
 * Parse a `<...>.pages.dev` hostname into project/branch structure.
 *
 * Handles:
 *  - `<project>.pages.dev` (production)
 *  - `<branch>.<project>.pages.dev` (branch preview)
 *  - `<hash>.<project>.pages.dev` (unique preview; 32-hex)
 *
 * @param {string} host
 * @returns {{project: string, branch: string|null, kind: 'production'|'branch-preview'|'unique-preview'}|null}
 */
export function parsePagesDevHost(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const m = h.match(/^(.+)\.pages\.dev$/);
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length === 1) {
    return { project: parts[0], branch: null, kind: 'production' };
  }
  if (parts.length === 2) {
    const [first, project] = parts;
    if (/^[0-9a-f]{32}$/.test(first)) {
      return { project, branch: null, kind: 'unique-preview' };
    }
    return { project, branch: first, kind: 'branch-preview' };
  }
  // Deeper nesting: treat everything after the first label as the project.
  const [first, ...rest] = parts;
  return { project: rest.join('.'), branch: first, kind: 'branch-preview' };
}

/**
 * Classify a hostname's relationship to Cloudflare Pages.
 *
 * @param {string} host
 * @param {string} [cnameTarget] optional CNAME target from the caller's DNS lookup
 * @returns {'pages-dev'|'pages-custom-domain'|'unrelated'}
 */
export function classifyPagesHost(host, cnameTarget = '') {
  const h = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (parsePagesDevHost(h)) return 'pages-dev';
  const target = String(cnameTarget || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (target && (target === PAGES_DEV_APEX || target.endsWith(`.${PAGES_DEV_APEX}`))) {
    return 'pages-custom-domain';
  }
  return 'unrelated';
}

/**
 * Generate candidate Cloudflare Pages project names for a brand.
 *
 * Produces `<token>.pages.dev`, context-suffixed variants, and branch
 * preview skeletons (`<branch>.<token>.pages.dev`). Candidates only — the
 * caller resolves them.
 *
 * @param {string} brand root domain or company name
 * @returns {{host: string, kind: 'production'|'branch-preview'|'context', project: string, branch: string|null}[]}
 */
export function generatePagesNames(brand) {
  const tokens = brandTokens(brand);
  const out = [];
  const seen = new Set();
  const push = (host, kind, project, branch) => {
    if (seen.has(host)) return;
    seen.add(host);
    out.push({ host, kind, project, branch });
  };

  for (const token of tokens) {
    push(`${token}.pages.dev`, 'production', token, null);
    for (const suffix of PAGES_CONTEXT_SUFFIXES) {
      push(`${token}-${suffix}.pages.dev`, 'context', `${token}-${suffix}`, null);
    }
    for (const branch of PAGES_BRANCH_PREFIXES) {
      push(`${branch}.${token}.pages.dev`, 'branch-preview', token, branch);
    }
  }
  return out;
}

/**
 * Map custom domains to Cloudflare Pages projects from caller-resolved
 * `{host, cname}` pairs. A custom domain whose CNAME points at
 * `<project>.pages.dev` maps to that project.
 *
 * @param {{host: string, cname: string}[]} resolutions
 * @returns {{host: string, cname: string, project: string, kind: 'pages-dev'|'pages-custom-domain'}[]}
 */
export function mapCustomDomains(resolutions) {
  const out = [];
  for (const r of resolutions || []) {
    const host = String(r?.host || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const cname = String(r?.cname || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const direct = parsePagesDevHost(host);
    if (direct) {
      out.push({ host, cname, project: direct.project, kind: 'pages-dev' });
      continue;
    }
    const viaCname = parsePagesDevHost(cname);
    if (viaCname) {
      out.push({ host, cname, project: viaCname.project, kind: 'pages-custom-domain' });
    }
  }
  return out.sort((a, b) => a.project.localeCompare(b.project) || a.host.localeCompare(b.host));
}

/**
 * Extract pages.dev hosts from a block of text (e.g. a deployment list or
 * certificate-transparency style dump the caller fetched).
 *
 * @param {string} text raw text possibly containing pages.dev hosts
 * @returns {{host: string, project: string, branch: string|null, kind: string}[]}
 */
export function extractPagesHosts(text) {
  const t = String(text || '');
  if (!t) return [];
  const out = [];
  const seen = new Set();
  for (const m of t.matchAll(/\b([a-z0-9][a-z0-9.-]*)\.pages\.dev\b/gi)) {
    const host = m[0].toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    const parsed = parsePagesDevHost(host);
    if (parsed) out.push({ host, ...parsed });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}
