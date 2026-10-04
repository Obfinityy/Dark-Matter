/**
 * nugetHostIntel.js — NuGet package host extraction (idea 00228).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses NuGet registration JSON (`projectUrl`, `repository` / `repositoryUrl`,
 * `licenseUrl`, author contact info) to recover the owning organization's
 * hosts: project sites, docs portals, and source repositories. Useful only
 * against targets the operator is authorized to assess.
 */

/**
 * Normalize a URL string to a hostname; null when unusable or when it is
 * NuGet / Microsoft infrastructure itself.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  const s = String(value).trim().replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel):/i.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/\.?nuget\.org$/.test(h) || /\.microsoft\.com$/.test(h) || /\.azureedge\.net$/.test(h)) return null;
    if (/\.github\.com$/.test(h) || /\.gitlab\.com$/.test(h)) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Idea 00228 — mine org hosts from a NuGet registration catalog entry.
 *
 * Consumes items from `https://api.nuget.org/v3/registration5-gz-semver2/
 * <id>/index.json` (catalog leaf `catalogEntry` objects). Reads
 * `projectUrl`, `repository` (commit/branch/type/url), `licenseUrl`, and
 * `authors` contact e-mail domains.
 *
 * @param {Object} catalogEntry - NuGet catalog entry object.
 * @returns {{ package: string|null, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseNugetPackageHosts(catalogEntry) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const e = (catalogEntry && typeof catalogEntry === 'object') ? catalogEntry : {};
  const pkg = e.id || e.packageId || null;

  for (const field of ['projectUrl', 'licenseUrl', 'iconUrl', 'repositoryUrl']) {
    if (typeof e[field] === 'string' && e[field]) {
      const host = toHost(e[field]);
      if (host) add(host, field, e[field]);
    }
  }

  const repo = e.repository;
  if (repo && typeof repo === 'object') {
    if (typeof repo.url === 'string' && repo.url) {
      const host = toHost(repo.url);
      if (host) add(host, 'repository.url', repo.url);
      const gh = repo.url.match(/github\.com[/:]([^/\s"']+)/i);
      if (gh) add('github.com', 'repository.org', `GitHub org: ${gh[1]}`);
    }
  } else if (typeof repo === 'string' && repo) {
    const host = toHost(repo);
    if (host) add(host, 'repository', repo);
  }

  // authors may embed contact e-mails ("Name <dev@company.com>")
  const authors = Array.isArray(e.authors) ? e.authors : (e.authors ? [e.authors] : []);
  for (const a of authors) {
    const m = String(a).match(/@([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/);
    if (m) {
      const domain = m[1].toLowerCase();
      if (!/\.?nuget\.org$/.test(domain) && !seen.has(`${domain}|authors.email`)) {
        seen.add(`${domain}|authors.email`);
        hits.push({ host: domain, provenance: 'authors.email', detail: `contact domain (${a})` });
      }
    }
  }

  return { package: pkg, hosts: hits };
}

/**
 * Build NuGet registration API URLs for a package id.
 * @param {string} packageId
 */
export function nugetApiTargets(packageId) {
  const id = encodeURIComponent(String(packageId).toLowerCase());
  return [`https://api.nuget.org/v3/registration5-gz-semver2/${id}/index.json`];
}
