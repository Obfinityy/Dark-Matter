/**
 * ghPagesMapper.js — GitHub Pages subdomain mapping engine.
 *
 * Covers idea-bank item 00259:
 *  - 00259 GitHub Pages subdomain mapping — map github.io user/org sites to
 *    custom domains via CNAME files and DNS.
 *
 * Pure functions only: callers fetch repo CNAME file contents and perform
 * DNS lookups themselves (respecting provider/resolver rate limits) and pass
 * the raw data in. This module parses CNAME file contents, parses
 * `<user>.github.io` / `<org>.github.io/<repo>` host structures, maps custom
 * domains back to their GitHub Pages source (user vs project site), and
 * generates candidate project-site hosts for a brand. No live DNS or HTTP
 * here.
 */

/** GitHub Pages apex hosts. */
export const GITHUB_IO_APEX = 'github.io';

/** Legacy GitHub Pages apex domains that still appear in old CNAME setups. */
export const GITHUB_PAGES_LEGACY = ['github.com'];

/**
 * Normalize to a GitHub username/org slug: lowercase alphanumerics/hyphens.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Parse the contents of a GitHub Pages CNAME file.
 *
 * A CNAME file holds a single custom domain (optionally with scheme, path,
 * port, or trailing dot from sloppy commits). Returns the normalized custom
 * domain, or '' when the file is empty/invalid.
 *
 * @param {string} cnameContent raw CNAME file text
 * @returns {string} normalized custom domain
 */
export function parseCnameFile(cnameContent) {
  const raw = String(cnameContent || '').trim().split(/\s+/)[0] || '';
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Parse a `github.io` hostname into user/org and project structure.
 *
 * Handles:
 *  - `<user>.github.io` (user/org site)
 *  - `<user>.github.io/<repo>` is a path, not a host — for host-only input
 *    this returns the user site; use `project` from the repo name instead.
 *
 * @param {string} host
 * @returns {{user: string, kind: 'user-site'}|null}
 */
export function parseGithubIoHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  const m = h.match(/^([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\.github\.io$/);
  if (!m) return null;
  return { user: m[1], kind: 'user-site' };
}

/**
 * Map a custom domain back to its GitHub Pages source given the caller's
 * data: the repo's CNAME file content, the owning user/org, and the repo
 * name.
 *
 * @param {{customDomain: string, user: string, repo: string, cnameContent?: string}} input
 * @returns {{
 *   customDomain: string, user: string, repo: string,
 *   pagesHost: string, pagesKind: 'user-site'|'project-site',
 *   cnameMatches: boolean
 * }}
 */
export function mapCustomDomain({ customDomain, user, repo, cnameContent = '' }) {
  const domain = parseCnameFile(customDomain);
  const u = slugify(user);
  const r = slugify(repo);
  const isUserSite = r === `${u}.github.io`;
  const pagesHost = isUserSite ? `${u}.github.io` : `${u}.github.io`;
  const fileDomain = parseCnameFile(cnameContent);
  return {
    customDomain: domain,
    user: u,
    repo: r,
    pagesHost,
    pagesKind: isUserSite ? 'user-site' : 'project-site',
    // Project sites live at <user>.github.io/<repo>/; the CNAME file on the
    // publishing branch must name the custom domain for the mapping to hold.
    cnameMatches: fileDomain !== '' && fileDomain === domain,
  };
}

/**
 * Build the candidate GitHub Pages hosts for a brand's likely GitHub
 * user/org names: `<user>.github.io` user sites plus likely project-site
 * path prefixes for docs/blog/status-style repos.
 *
 * @param {string[]} users candidate GitHub usernames/org names
 * @param {{projectRepos?: string[]}} [options]
 * @returns {{host: string, user: string, kind: 'user-site'|'project-site', path: string}[]}
 */
export function generatePagesHosts(users, options = {}) {
  const { projectRepos = ['docs', 'blog', 'status', 'developer', 'developers', 'engineering', 'handbook', 'site', 'www'] } = options;
  const out = [];
  const seen = new Set();
  for (const raw of users || []) {
    const user = slugify(raw);
    if (!user || seen.has(user)) continue;
    seen.add(user);
    out.push({ host: `${user}.github.io`, user, kind: 'user-site', path: '/' });
    for (const repo of projectRepos) {
      out.push({ host: `${user}.github.io`, user, kind: 'project-site', path: `/${slugify(repo)}/` });
    }
  }
  return out;
}

/**
 * Derive candidate GitHub usernames/org names from a brand (root domain or
 * company name) using common naming conventions.
 *
 * @param {string} brand root domain (example.com) or company name
 * @returns {string[]} unique candidate slugs
 */
export function brandUserCandidates(brand) {
  const label = String(brand || '').toLowerCase().split('.')[0];
  const base = slugify(label);
  const out = new Set();
  if (base) {
    out.add(base);
    out.add(base.replace(/-/g, ''));
    const stripped = base.replace(/-(inc|llc|ltd|co|corp|hq|io|app)$/, '');
    if (stripped && stripped !== base) {
      out.add(stripped);
      out.add(stripped.replace(/-/g, ''));
    }
    for (const part of base.split('-')) {
      if (part.length > 2) out.add(part);
    }
  }
  return [...out].filter((s) => s.length <= 39);
}

/**
 * Extract github.io hosts from a block of text (e.g. DNS/CNAME dump or repo
 * list the caller fetched).
 *
 * @param {string} text raw text possibly containing github.io hosts
 * @returns {{host: string, user: string, kind: 'user-site'}[]}
 */
export function extractGithubIoHosts(text) {
  const t = String(text || '');
  if (!t) return [];
  const out = [];
  const seen = new Set();
  for (const m of t.matchAll(/\b([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\.github\.io\b/gi)) {
    const host = m[0].toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    const parsed = parseGithubIoHost(host);
    if (parsed) out.push({ host, ...parsed });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}
