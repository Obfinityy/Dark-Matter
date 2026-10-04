/**
 * glPagesDiscovery.js — GitLab Pages host discovery engine.
 *
 * Covers idea-bank item 00260:
 *  - 00260 GitLab Pages host discovery — discover GitLab Pages sites through
 *    gitlab.io naming and custom-domain records.
 *
 * Pure functions only: callers perform DNS lookups and fetch verification
 * records themselves (respecting resolver/provider rate limits) and pass the
 * raw data in. This module parses `<namespace>.gitlab.io` and
 * `<namespace>.gitlab.io/<project>` structures, recognizes GitLab Pages
 * custom-domain verification TXT records (`_gitlab-pages-verification-code`),
 * generates brand-derived candidate namespace/project names, and correlates
 * caller-resolved DNS data. No live DNS or HTTP here.
 */

/** GitLab Pages apex host. */
export const GITLAB_IO_APEX = 'gitlab.io';

/** TXT record name GitLab uses for custom-domain verification. */
export const PAGES_VERIFICATION_TXT = '_gitlab-pages-verification-code';

/** Common project names used for GitLab Pages sites. */
export const PAGES_PROJECT_NAMES = [
  'pages', 'docs', 'blog', 'status', 'developer', 'developers', 'engineering',
  'handbook', 'site', 'www', 'app', 'marketing',
];

/**
 * Normalize to a GitLab namespace/project slug: lowercase alphanumerics,
 * hyphens, underscores, dots.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Parse a `gitlab.io` hostname into namespace/project structure.
 *
 * Handles:
 *  - `<namespace>.gitlab.io` (user/group Pages site)
 *  - `<namespace>.gitlab.io/<project>` is a path — for host-only input the
 *    project comes from the second label when present as
 *    `<project>.<namespace>.gitlab.io`? No: GitLab uses path-based project
 *    sites, so host-only parsing returns the namespace; callers supply the
 *    project path separately.
 *  - Custom nested group paths appear as extra subdomains only in
 *    self-managed instances; `<a>.<b>.gitlab.io` on gitlab.com is treated
 *    as a project site alias of namespace `b` only when explicitly flagged.
 *
 * @param {string} host
 * @param {{nestedAsProject?: boolean}} [options]
 * @returns {{namespace: string, project: string|null, kind: 'namespace-site'|'project-site'}|null}
 */
export function parseGitlabIoHost(host, options = {}) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  const m = h.match(/^(.+)\.gitlab\.io$/);
  if (!m) return null;
  const labels = m[1].split('.');
  if (labels.length === 1) {
    return { namespace: labels[0], project: null, kind: 'namespace-site' };
  }
  if (options.nestedAsProject && labels.length === 2) {
    return { namespace: labels[1], project: labels[0], kind: 'project-site' };
  }
  return { namespace: m[1], project: null, kind: 'namespace-site' };
}

/**
 * Parse a GitLab Pages custom-domain verification TXT record value.
 *
 * GitLab asks domain owners to publish a TXT record at
 * `_gitlab-pages-verification-code.<domain>` with the verification code as
 * the value. Returns the code, or '' when the value does not look like one.
 *
 * @param {string} txtValue raw TXT record value (as returned by the caller)
 * @returns {string} verification code or ''
 */
export function parseVerificationRecord(txtValue) {
  const v = String(txtValue || '').trim().replace(/^"|"$/g, '');
  // Codes are `gitlab-pages-verification-code=<hex/token>` or a bare token.
  const m = v.match(/^(?:gitlab-pages-verification-code=)?([a-z0-9]{16,})$/i);
  return m ? m[1] : '';
}

/**
 * Decide whether a caller-resolved TXT record set proves GitLab Pages
 * ownership of a custom domain.
 *
 * @param {{name: string, value: string}[]} txtRecords records at/near the domain
 * @param {string} domain the custom domain being checked
 * @returns {{verified: boolean, code: string|null, record: string|null}}
 */
export function checkPagesVerification(txtRecords, domain) {
  const d = String(domain || '').toLowerCase().replace(/\.$/, '');
  for (const rec of txtRecords || []) {
    const name = String(rec?.name || '').toLowerCase().replace(/\.$/, '');
    if (name === `${PAGES_VERIFICATION_TXT}.${d}` || name === PAGES_VERIFICATION_TXT) {
      const code = parseVerificationRecord(rec?.value);
      if (code) return { verified: true, code, record: name };
    }
  }
  return { verified: false, code: null, record: null };
}

/**
 * Derive candidate GitLab namespace slugs from a brand (root domain or
 * company name).
 *
 * @param {string} brand root domain (example.com) or company name
 * @returns {string[]} unique candidate slugs
 */
export function brandNamespaceCandidates(brand) {
  const label = String(brand || '').toLowerCase().split('.')[0];
  const base = slugify(label);
  const out = new Set();
  if (base) {
    out.add(base);
    out.add(base.replace(/-/g, ''));
    out.add(base.replace(/-/g, '_'));
    const stripped = base.replace(/-(inc|llc|ltd|co|corp|hq|io|app)$/, '');
    if (stripped && stripped !== base) {
      out.add(stripped);
      out.add(stripped.replace(/-/g, ''));
    }
    for (const part of base.split('-')) {
      if (part.length > 2) out.add(part);
    }
  }
  return [...out];
}

/**
 * Generate candidate GitLab Pages hosts for a brand: `<namespace>.gitlab.io`
 * namespace sites plus likely project-site path prefixes.
 *
 * @param {string} brand root domain or company name
 * @param {{projectNames?: string[]}} [options]
 * @returns {{host: string, namespace: string, kind: 'namespace-site'|'project-site', path: string}[]}
 */
export function generateGitlabPagesNames(brand, options = {}) {
  const { projectNames = PAGES_PROJECT_NAMES } = options;
  const namespaces = brandNamespaceCandidates(brand);
  const out = [];
  const seen = new Set();
  for (const namespace of namespaces) {
    if (!namespace || seen.has(namespace)) continue;
    seen.add(namespace);
    out.push({ host: `${namespace}.gitlab.io`, namespace, kind: 'namespace-site', path: '/' });
    for (const project of projectNames) {
      out.push({
        host: `${namespace}.gitlab.io`,
        namespace,
        kind: 'project-site',
        path: `/${slugify(project)}/`,
      });
    }
  }
  return out;
}

/**
 * Extract gitlab.io hosts from a block of text (e.g. DNS dump or namespace
 * list the caller fetched).
 *
 * @param {string} text raw text possibly containing gitlab.io hosts
 * @returns {{host: string, namespace: string, project: string|null, kind: string}[]}
 */
export function extractGitlabIoHosts(text) {
  const t = String(text || '');
  if (!t) return [];
  const out = [];
  const seen = new Set();
  for (const m of t.matchAll(/\b([a-z0-9][a-z0-9._-]*)\.gitlab\.io\b/gi)) {
    const host = m[0].toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    const parsed = parseGitlabIoHost(host);
    if (parsed) out.push({ host, ...parsed });
  }
  return out.sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Correlate caller-resolved `{host, cname, txt}` data with a brand: keep
 * gitlab.io hosts and custom domains carrying GitLab Pages verification
 * records, and flag brand matches.
 *
 * @param {{host: string, cname?: string, txt?: {name: string, value: string}[]}[]} resolutions
 * @param {string} brand root domain or company name
 * @returns {{host: string, kind: string, namespace: string|null, verified: boolean, brandMatch: boolean}[]}
 */
export function correlateResolutions(resolutions, brand) {
  const namespaces = brandNamespaceCandidates(brand);
  const out = [];
  for (const r of resolutions || []) {
    const host = String(r?.host || '').toLowerCase().replace(/\.$/, '');
    const parsed = parseGitlabIoHost(host);
    const verification = checkPagesVerification(r?.txt || [], host);
    if (!parsed && !verification.verified) continue;
    const namespace = parsed ? parsed.namespace : null;
    const brandMatch = namespaces.some((n) => (namespace || '').includes(n) || host.includes(n));
    out.push({
      host,
      kind: parsed ? parsed.kind : 'custom-domain',
      namespace,
      verified: verification.verified,
      brandMatch,
    });
  }
  return out.sort((a, b) => Number(b.brandMatch) - Number(a.brandMatch) || a.host.localeCompare(b.host));
}
