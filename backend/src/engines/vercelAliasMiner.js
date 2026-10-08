/**
 * vercelAliasMiner.js — Vercel deployment alias mining engine.
 *
 * Covers idea-bank item 00257:
 *  - 00257 Vercel deployment alias mining — mine Vercel deployment aliases
 *    and _vercel CNAME targets for preview hosts.
 *
 * Pure functions only: callers perform DNS lookups themselves (respecting
 * resolver rate limits) and pass CNAME targets in. This module parses
 * Vercel's `_vercel` CNAME delegation (`cname.vercel-dns.com`), deployment
 * URL patterns (`<project>-<hash>-<team>.vercel.app`, `<project>.vercel.app`,
 * git-branch URLs), and generates brand-derived candidate project names. No
 * live DNS or HTTP here.
 */

/** Vercel DNS delegation targets proving Vercel hosting. */
export const VERCEL_CNAME_TARGETS = [
  'cname.vercel-dns.com',
  'vercel-dns.com',
  'alias.vercel-dns.com',
];

/** Common branch/context suffixes used in Vercel git-branch deployment URLs. */
export const VERCEL_CONTEXT_SUFFIXES = [
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
  'feat',
  'fix',
  'release',
];

/**
 * Normalize to Vercel's project slug rules: lowercase alphanumerics and
 * single hyphens.
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
 * Parse a Vercel deployment/alias hostname.
 *
 * Handles:
 *  - `<project>.vercel.app` (production alias)
 *  - `<project>-<gitsha>-<team>.vercel.app` (unique deployment URL)
 *  - `<project>-git-<branch>-<team>.vercel.app` (git-branch URL)
 *
 * @param {string} host
 * @returns {{project: string, team: string|null, kind: 'alias'|'deployment'|'branch-deploy', branch: string|null, hash: string|null}|null}
 */
export function parseVercelAlias(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const m = h.match(/^(.+)\.vercel\.app$/);
  if (!m) return null;
  const slug = m[1];

  // <project>-git-<branch>-<team>.vercel.app
  let g = slug.match(/^(.+?)-git-(.+?)-([a-z0-9-]+)$/);
  if (g) {
    return { project: g[1], team: g[3], kind: 'branch-deploy', branch: g[2], hash: null };
  }
  // <project>-<12-hex>-<team>.vercel.app (unique deployment URL)
  g = slug.match(/^(.+?)-([0-9a-f]{8,})-([a-z0-9-]+)$/);
  if (g) {
    return { project: g[1], team: g[3], kind: 'deployment', branch: null, hash: g[2] };
  }
  // <project>.vercel.app production alias
  return { project: slug, team: null, kind: 'alias', branch: null, hash: null };
}

/**
 * Parse a DNS CNAME target for Vercel delegation.
 *
 * Recognizes the `_vercel` delegation pattern (`<domain>` CNAME
 * `cname.vercel-dns.com`) and any Vercel DNS target.
 *
 * @param {string} cnameTarget CNAME record target (as returned by the caller)
 * @returns {{isVercel: boolean, target: string, delegation: '_vercel'|null}}
 */
export function parseVercelCname(cnameTarget) {
  const target = String(cnameTarget || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!target) return { isVercel: false, target: '', delegation: null };
  const isVercel = VERCEL_CNAME_TARGETS.some(t => target === t || target.endsWith(`.${t}`));
  return { isVercel, target, delegation: isVercel ? '_vercel' : null };
}

/**
 * Generate candidate Vercel project/alias names for a brand.
 *
 * Produces `<token>.vercel.app` production aliases, git-branch URL skeletons
 * (`<token>-git-<branch>-<team>` with a `<team>` placeholder the caller
 * replaces), and context-suffixed variants. Candidates only — the caller
 * resolves them.
 *
 * @param {string} brand root domain or company name
 * @param {{team?: string}} [options] known Vercel team/org slug to fill in
 * @returns {{host: string, kind: 'alias'|'branch-deploy'|'context', project: string, branch: string|null}[]}
 */
export function generateAliasNames(brand, options = {}) {
  const team = options.team ? slugify(options.team) : '<team>';
  const tokens = brandTokens(brand);
  const out = [];
  const seen = new Set();
  const push = (host, kind, project, branch) => {
    if (seen.has(host)) return;
    seen.add(host);
    out.push({ host, kind, project, branch });
  };

  for (const token of tokens) {
    push(`${token}.vercel.app`, 'alias', token, null);
    for (const suffix of VERCEL_CONTEXT_SUFFIXES) {
      push(`${token}-${suffix}.vercel.app`, 'context', `${token}-${suffix}`, null);
    }
    // Git-branch deployment skeleton: <project>-git-<branch>-<team>.vercel.app
    for (const branch of ['staging', 'develop', 'dev', 'main', 'preview']) {
      push(`${token}-git-${branch}-${team}.vercel.app`, 'branch-deploy', token, branch);
    }
  }
  return out;
}

/**
 * Extract preview/deployment hosts from a block of text (e.g. a Vercel
 * dashboard export, deployment list JSON, or webhook payload the caller
 * fetched). Returns parsed alias records.
 *
 * @param {string} text raw text possibly containing vercel.app hosts
 * @returns {{host: string, project: string, team: string|null, kind: string, branch: string|null}[]}
 */
export function extractPreviewHosts(text) {
  const t = String(text || '');
  if (!t) return [];
  const out = [];
  const seen = new Set();
  for (const m of t.matchAll(/\b([a-z0-9][a-z0-9-]*)\.vercel\.app\b/gi)) {
    const host = m[0].toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    const parsed = parseVercelAlias(host);
    if (parsed) out.push({ host, ...parsed });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Correlate caller-resolved `{host, cname}` pairs with a brand: keep
 * Vercel-hosted or vercel.app hosts, parse their alias structure, and flag
 * brand matches.
 *
 * @param {{host: string, cname: string}[]} resolutions
 * @param {string} brand root domain or company name
 * @returns {{host: string, cname: string, project: string|null, kind: string|null, brandMatch: boolean}[]}
 */
export function correlateResolutions(resolutions, brand) {
  const tokens = brandTokens(brand);
  const out = [];
  for (const r of resolutions || []) {
    const host = String(r?.host || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const parsed = parseVercelCname(r?.cname);
    const alias = parseVercelAlias(host);
    if (!parsed.isVercel && !alias) continue;
    const project = alias ? alias.project : null;
    const brandMatch = tokens.some(t => (project || '').includes(t) || host.includes(t));
    out.push({
      host,
      cname: parsed.target,
      project,
      kind: alias ? alias.kind : 'custom-domain',
      brandMatch,
    });
  }
  return out.sort(
    (a, b) => Number(b.brandMatch) - Number(a.brandMatch) || a.host.localeCompare(b.host)
  );
}
