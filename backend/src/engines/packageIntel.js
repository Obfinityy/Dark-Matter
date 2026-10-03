/**
 * packageIntel.js — Package-registry intelligence for autonomous bug bounty.
 *
 * Implements Dark-Matter idea-bank items 00072–00073 as real, working
 * defensive asset-discovery capabilities for authorized targets:
 *
 *  00072 Package-registry forgotten-project discovery — search npm/PyPI/
 *      RubyGems for package names matching the target brand whose
 *      repository URLs point at hosts, revealing forgotten project
 *      infrastructure.
 *  00073 npm maintainer-domain pivoting — pivot on npm maintainer emails
 *      to find packages whose homepages reference target subdomains.
 *
 * Analysis works on package metadata objects (from npm/PyPI/Gems APIs) the
 * operator already collected. No network I/O happens here. "Forgotten"
 * infrastructure means public packages whose repository/homepage URLs point
 * at hosts other than the well-known code-hosting platforms — e.g. a
 * decommissioned internal Git server still referenced by a published
 * package, which is a defensive finding for the brand owner.
 */

/** Hostnames considered standard public code hosting — not "forgotten infra". */
export const KNOWN_CODE_HOSTS = new Set([
  'github.com', 'www.github.com', 'gitlab.com', 'bitbucket.org',
  'dev.azure.com', 'sourceforge.net', 'codeberg.org', 'gitee.com',
]);

const URL_PREFIXES = ['git+', 'git:', 'hg+'];

/**
 * Extract the host from a repository/homepage URL.
 * Handles git+https:, ssh git@, scp-like syntax and bare github shorthand.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function hostFromRepoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim();

  // scp-like: git@host:path or user@host:path
  const scp = u.match(/^[a-zA-Z0-9_.-]+@([a-zA-Z0-9_.-]+):/);
  if (scp) return scp[1].toLowerCase();

  // github shorthand: org/repo or github:org/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(u)) return 'github.com';
  if (u.startsWith('github:')) return 'github.com';

  for (const p of URL_PREFIXES) {
    if (u.startsWith(p)) {
      u = u.slice(p.length);
      break;
    }
  }
  if (/^ssh:/i.test(u)) u = 'ssh://' + u.slice(4);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Canonical package metadata shape consumed by this engine.
 * @typedef {object} PackageMeta
 * @property {string} name
 * @property {string} [registry]  'npm' | 'pypi' | 'rubygems' | ...
 * @property {string} [repository]  repository URL
 * @property {string} [homepage]     homepage URL
 * @property {Array<{name?: string, email?: string}>} [maintainers]
 * @property {string} [description]
 * @property {boolean} [deprecated]
 */

/**
 * True when a package name matches the target brand (substring, token
 * or hyphen/underscore-joined token match, case-insensitive).
 *
 * @param {string} name
 * @param {string} brand
 * @returns {boolean}
 */
export function matchesBrand(name, brand) {
  if (!name || !brand) return false;
  const n = name.toLowerCase();
  const b = brand.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!b) return false;
  if (n.includes(b)) return true;
  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((t) => t.includes(b) || b.includes(t));
}

/**
 * Idea 00072 — find brand-matching packages whose repository or homepage
 * points at a host that is NOT a known code host. Those hosts are
 * candidate forgotten project infrastructure.
 *
 * @param {PackageMeta[]} packages
 * @param {string} brand
 * @returns {Array<PackageMeta & {infraHosts: string[], reason: string}>}
 */
export function findForgottenProjectPackages(packages, brand) {
  const hits = [];
  for (const pkg of packages || []) {
    if (!matchesBrand(pkg.name, brand)) continue;
    const hosts = new Set();
    for (const field of ['repository', 'homepage']) {
      const host = hostFromRepoUrl(pkg[field]);
      if (host && !KNOWN_CODE_HOSTS.has(host)) hosts.add(host);
    }
    if (hosts.size > 0) {
      hits.push({
        ...pkg,
        infraHosts: [...hosts].sort(),
        reason: 'brand-matched package references non-standard code host',
      });
    }
  }
  return hits;
}

/**
 * Extract all maintainer email addresses (lower-cased, de-duplicated).
 *
 * @param {PackageMeta[]} packages
 * @returns {Map<string, string[]>} email -> package names
 */
export function indexMaintainers(packages) {
  const index = new Map();
  for (const pkg of packages || []) {
    for (const m of pkg.maintainers || []) {
      const email = (m.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      if (!index.has(email)) index.set(email, []);
      if (!index.get(email).includes(pkg.name)) index.get(email).push(pkg.name);
    }
  }
  return index;
}

/**
 * Idea 00073 — pivot on a maintainer email: among the packages that
 * maintainer touches, find ones whose homepage or repository references
 * the target domain or any of its subdomains.
 *
 * @param {PackageMeta[]} packages
 * @param {string} maintainerEmail
 * @param {string} targetDomain
 * @returns {Array<{name: string, field: string, url: string, host: string}>}
 */
export function pivotMaintainerToTargetHosts(packages, maintainerEmail, targetDomain) {
  const email = (maintainerEmail || '').trim().toLowerCase();
  const target = (targetDomain || '').toLowerCase();
  const hits = [];
  for (const pkg of packages || []) {
    const owns = (pkg.maintainers || []).some(
      (m) => (m.email || '').trim().toLowerCase() === email,
    );
    if (!owns) continue;
    for (const field of ['homepage', 'repository']) {
      const url = pkg[field];
      const host = hostFromRepoUrl(url);
      if (!host || !target) continue;
      if (host === target || host.endsWith('.' + target)) {
        hits.push({ name: pkg.name, field, url, host });
      }
    }
  }
  return hits;
}

/**
 * Combined sweep: run both idea 00072 and 00073 analyses and group the
 * resulting infrastructure hosts.
 *
 * @param {PackageMeta[]} packages
 * @param {{brand: string, targetDomain: string, pivotEmails?: string[]}} opts
 * @returns {{
 *   forgotten: ReturnType<typeof findForgottenProjectPackages>,
 *   pivots: Record<string, ReturnType<typeof pivotMaintainerToTargetHosts>>,
 *   infraHosts: string[],
 * }}
 */
export function analyzePackageFootprint(packages, opts) {
  const forgotten = findForgottenProjectPackages(packages, opts.brand);
  const pivots = {};
  for (const email of opts.pivotEmails || []) {
    pivots[email] = pivotMaintainerToTargetHosts(packages, email, opts.targetDomain);
  }
  const infra = new Set();
  for (const f of forgotten) f.infraHosts.forEach((h) => infra.add(h));
  for (const list of Object.values(pivots)) list.forEach((h) => infra.add(h.host));
  return { forgotten, pivots, infraHosts: [...infra].sort() };
}
