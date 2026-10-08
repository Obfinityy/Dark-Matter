/**
 * pypiHostIntel.js — PyPI project-URL host mining (idea 00224).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses the PyPI JSON API (`info.project_urls`, `info.home_page`,
 * `info.author_email`-adjacent contact fields) for documentation, demo,
 * changelog, issue-tracker, and source hosts belonging to the package's
 * owning organization. Useful only against targets the operator is
 * authorized to assess.
 */

/**
 * Normalize a URL or host string to a hostname; null when unusable or when
 * it is PyPI / warehouse infrastructure itself.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  const s = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel):/i.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/\.?pypi\.org$/.test(h) || /\.?python\.org$/.test(h) || /\.?pythonhosted\.org$/.test(h))
      return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Idea 00224 — mine org hosts from a PyPI JSON API payload.
 *
 * Consumes `GET https://pypi.org/pypi/<name>/json` responses. Reads
 * `info.project_urls` (Documentation, Source, Tracker, Homepage…),
 * `info.home_page`, `info.docs_url`, and contact e-mail domains
 * (`author_email` / `maintainer_email`) which often reveal the owning org's
 * domain.
 *
 * @param {Object} pypiJson - PyPI JSON API payload.
 * @returns {{ package: string|null, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parsePypiProjectHosts(pypiJson) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const info = (pypiJson && pypiJson.info) || {};
  const pkg = info.name || null;

  const urls = info.project_urls || {};
  for (const [label, url] of Object.entries(urls)) {
    if (typeof url !== 'string' || !url) continue;
    const host = toHost(url);
    if (host) add(host, `project_urls.${label}`, url);
  }
  for (const field of ['home_page', 'docs_url', 'download_url', 'package_url']) {
    const v = info[field];
    if (typeof v === 'string' && v) {
      const host = toHost(v);
      if (host) add(host, `info.${field}`, v);
    }
  }

  // Contact e-mail domains (org-owned domains, e.g. dev@company.com)
  for (const field of ['author_email', 'maintainer_email']) {
    const v = String(info[field] || '');
    const m = v.match(/@([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/);
    if (m) {
      const domain = m[1].toLowerCase();
      if (!/\.?pypi\.org$/.test(domain) && !seen.has(`${domain}|${field}`)) {
        seen.add(`${domain}|${field}`);
        hits.push({ host: domain, provenance: field, detail: `contact domain from ${field}` });
      }
    }
  }

  return { package: pkg, hosts: hits };
}

/**
 * Build the PyPI JSON API URL for a package name.
 * @param {string} packageName
 */
export function pypiApiTargets(packageName) {
  const n = encodeURIComponent(packageName);
  return [`https://pypi.org/pypi/${n}/json`];
}
