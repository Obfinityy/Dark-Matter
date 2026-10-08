/**
 * npmPivotIntel.js — npm package homepage pivoting (idea 00225).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses npm registry package metadata (`homepage`, `repository.url`,
 * `bugs.url`, `funding` links, maintainer e-mail domains) to map an
 * organization's web properties beyond the single package: corporate site,
 * docs portals, status pages, and org-owned GitHub orgs. Useful only against
 * targets the operator is authorized to assess.
 */

/**
 * Normalize a URL/host/git-URL string to a hostname; null when unusable or
 * when it is registry / hosting infrastructure itself.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  let s = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel):/i.test(s)) return null;
  s = s
    .replace(/^(git\+)?ssh:\/\/(git@)?/i, 'https://')
    .replace(/^git@/i, 'https://')
    .replace(/^git\+https?:\/\//i, 'https://');
  // scp-like: git@host:org/repo → host
  const scp = s.match(/^([A-Za-z0-9][A-Za-z0-9.-]*):[\w.~/-]+$/);
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return scp[1].toLowerCase();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/\.?npmjs\.com$/.test(h) || /\.github\.com$/.test(h) || /\.gitlab\.com$/.test(h))
      return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Idea 00225 — pivot from an npm registry package document to org hosts.
 *
 * Consumes `GET https://registry.npmjs.org/<name>` (packument) responses.
 * Reads `homepage`, `repository.url`, `bugs.url`, `funding` (url fields),
 * and maintainer/contributor e-mail domains.
 *
 * @param {Object} packument - npm registry package metadata.
 * @returns {{ package: string|null, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseNpmPackageHosts(packument) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const p = packument && typeof packument === 'object' ? packument : {};
  const pkg = p.name || null;

  if (typeof p.homepage === 'string' && p.homepage) {
    const host = toHost(p.homepage);
    if (host) add(host, 'homepage', p.homepage);
  }
  const repo = p.repository;
  const repoUrl = typeof repo === 'string' ? repo : repo && repo.url;
  if (typeof repoUrl === 'string' && repoUrl) {
    const host = toHost(repoUrl);
    if (host) add(host, 'repository.url', repoUrl);
    // github.com/org hosts are org web properties; keep the org name as provenance detail
    const gh = String(repoUrl).match(/github\.com[/:]([^/\s"']+)/i);
    if (gh) add('github.com', 'repository.org', `GitHub org: ${gh[1]}`);
  }
  const bugs = p.bugs;
  const bugsUrl = typeof bugs === 'string' ? bugs : bugs && bugs.url;
  if (typeof bugsUrl === 'string' && bugsUrl) {
    const host = toHost(bugsUrl);
    if (host) add(host, 'bugs.url', bugsUrl);
  }

  const funding = Array.isArray(p.funding) ? p.funding : p.funding ? [p.funding] : [];
  for (const f of funding) {
    if (f && typeof f.url === 'string' && f.url) {
      const host = toHost(f.url);
      if (host) add(host, 'funding.url', f.url);
    }
  }

  for (const role of ['maintainers', 'contributors']) {
    for (const person of p[role] || []) {
      const email = person && person.email;
      if (typeof email !== 'string') continue;
      const m = email.match(/@([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/);
      if (m) {
        const domain = m[1].toLowerCase();
        if (!/\.?npmjs\.com$/.test(domain) && !seen.has(`${domain}|${role}.email`)) {
          seen.add(`${domain}|${role}.email`);
          hits.push({
            host: domain,
            provenance: `${role}.email`,
            detail: `contact domain (${email})`,
          });
        }
      }
    }
  }

  return { package: pkg, hosts: hits };
}

/**
 * Build the npm registry URL for a package name.
 * @param {string} packageName
 */
export function npmRegistryTargets(packageName) {
  const n = encodeURIComponent(packageName);
  return [`https://registry.npmjs.org/${n}`];
}
