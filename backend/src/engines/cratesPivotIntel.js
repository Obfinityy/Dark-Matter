/**
 * cratesPivotIntel.js — Crates.io repo URL pivoting (idea 00231).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses crates.io API crate JSON (repository, homepage, documentation) to
 * pivot from a crate to the owning organization's hosts: GitHub/GitLab
 * hosts and their Pages sites (github.io / gitlab.io).
 */

/**
 * Build the crates.io API URL for a crate.
 * @param {string} name - Crate name.
 */
export function cratesApiUrl(name) {
  return `https://crates.io/api/v1/crates/${encodeURIComponent(String(name || ''))}`;
}

/**
 * Build the crates.io web page URL for a crate.
 * @param {string} name - Crate name.
 */
export function cratePageUrl(name) {
  return `https://crates.io/crates/${encodeURIComponent(String(name || ''))}`;
}

/**
 * Build a crates.io API search URL for crates mentioning an organization keyword.
 * @param {string} keyword
 */
export function cratesSearchUrl(keyword) {
  return `https://crates.io/api/v1/crates?q=${encodeURIComponent(String(keyword || ''))}&per_page=100`;
}

const GH_PAGES_RE = /([a-z0-9-]+)\.github\.io/i;
const GL_PAGES_RE = /([a-z0-9-]+)\.gitlab\.io/i;

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse a crates.io API crate JSON document (`crate` object, optionally with
 * `versions`/`keywords` siblings) into structured host findings.
 * @param {Object} crateJson - Parsed JSON from /api/v1/crates/:name.
 * @returns {{ name, urls: Object, hosts: Array<{host, kind, provenance}>, pagesSites: Array<{host, org, platform, provenance}> }}
 */
export function parseCrateJson(crateJson) {
  const crate = (crateJson && crateJson.crate) || crateJson || {};
  const urls = {
    repository: crate.repository || null,
    homepage: crate.homepage || null,
    documentation: crate.documentation || null,
  };
  const hosts = [];
  const seen = new Set();

  const pushHost = (url, kind, provenance) => {
    const host = hostFromUrl(url);
    if (host && !seen.has(host)) {
      seen.add(host);
      hosts.push({ host, kind, provenance });
    }
  };

  if (urls.repository) {
    const host = hostFromUrl(urls.repository);
    if (host) {
      const kind = host.includes('github.com') ? 'github-repo-host'
        : host.includes('gitlab.com') ? 'gitlab-repo-host'
        : host.includes('bitbucket.org') ? 'bitbucket-repo-host'
        : 'repo-host';
      pushHost(urls.repository, kind, 'crate.repository');
    }
  }
  pushHost(urls.homepage, 'project-homepage', 'crate.homepage');
  pushHost(urls.documentation, 'documentation-site', 'crate.documentation');

  const pagesSites = [];
  for (const h of hosts) {
    let m = GH_PAGES_RE.exec(h.host);
    if (m) pagesSites.push({ host: h.host, org: m[1], platform: 'github-pages', provenance: h.provenance });
    m = GL_PAGES_RE.exec(h.host);
    if (m) pagesSites.push({ host: h.host, org: m[1], platform: 'gitlab-pages', provenance: h.provenance });
  }

  return {
    name: crate.name || crate.id || null,
    urls,
    hosts,
    pagesSites,
  };
}

/**
 * Pivot from a parsed crate JSON to the owning org's crates.io search scope:
 * derives candidate org keywords from the repository path (e.g. org/repo).
 * @param {Object} parsedCrate - Output of parseCrateJson.
 * @returns {Array<{org, searchUrl}>}
 */
export function pivotOrgFromRepo(parsedCrate) {
  const repo = (parsedCrate && parsedCrate.urls && parsedCrate.urls.repository) || '';
  let path = '';
  try { path = new URL(repo).pathname.replace(/\.git$/, ''); } catch { return []; }
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return [];
  const org = parts[parts.length - 2];
  return [{ org, searchUrl: cratesSearchUrl(org) }];
}

/**
 * Parse a crates.io search response (parsed JSON) into crate summaries with hosts.
 * @param {Object} searchJson - Parsed JSON from /api/v1/crates?q=...
 * @returns {Array<{name, urls, hosts: Array<{host, kind, provenance}>}>}
 */
export function parseCrateSearchResults(searchJson) {
  const crates = (searchJson && searchJson.crates) || [];
  return crates.map(c => {
    const parsed = parseCrateJson({ crate: c });
    return { name: parsed.name, urls: parsed.urls, hosts: parsed.hosts };
  });
}
