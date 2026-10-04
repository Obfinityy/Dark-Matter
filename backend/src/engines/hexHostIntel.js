/**
 * hexHostIntel.js — Hex.pm package host extraction (idea 00230).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses the Hex API package JSON (`links`, `repository`, maintainer
 * contacts) to recover the owning organization's hosts: documentation
 * sites, source repositories, and project homepages. Useful only against
 * targets the operator is authorized to assess.
 */

/**
 * Normalize a URL string to a hostname; null when unusable or when it is
 * Hex / common VCS hosting infrastructure itself.
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
    if (/\.?hex\.pm$/.test(h) || /\.hexdocs\.pm$/.test(h)) return null;
    if (/\.github\.com$/.test(h) || /\.gitlab\.com$/.test(h) || /\.bitbucket\.org$/.test(h)) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Idea 00230 — mine org hosts from a Hex API package document.
 *
 * Consumes `GET https://hex.pm/api/packages/<name>` responses. Reads the
 * `links` map (docs, GitHub, homepage…), the top-level `repository` URL,
 * `docs` task URLs, and maintainer e-mail domains.
 *
 * @param {Object} hexJson - Hex API package payload.
 * @returns {{ package: string|null, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseHexPackageHosts(hexJson) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const p = (hexJson && typeof hexJson === 'object') ? hexJson : {};
  const pkg = p.name || null;

  const links = p.links || {};
  for (const [label, url] of Object.entries(links)) {
    if (typeof url !== 'string' || !url) continue;
    const host = toHost(url);
    if (host) add(host, `links.${label}`, url);
  }

  if (typeof p.repository === 'string' && p.repository) {
    const host = toHost(p.repository);
    if (host) add(host, 'repository', p.repository);
    const gh = p.repository.match(/github\.com[/:]([^/\s"']+)/i);
    if (gh) add('github.com', 'repository.org', `GitHub org: ${gh[1]}`);
  }
  if (typeof p.html_url === 'string' && p.html_url) {
    const host = toHost(p.html_url);
    if (host) add(host, 'html_url', p.html_url);
  }
  if (typeof p.docs_html_url === 'string' && p.docs_html_url) {
    const host = toHost(p.docs_html_url);
    if (host) add(host, 'docs_html_url', p.docs_html_url);
  }

  for (const m of p.maintainers || []) {
    const email = m && m.email;
    if (typeof email !== 'string') continue;
    const em = email.match(/@([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/);
    if (em) {
      const domain = em[1].toLowerCase();
      if (!/\.?hex\.pm$/.test(domain) && !seen.has(`${domain}|maintainers.email`)) {
        seen.add(`${domain}|maintainers.email`);
        hits.push({ host: domain, provenance: 'maintainers.email', detail: `contact domain (${email})` });
      }
    }
  }

  return { package: pkg, hosts: hits };
}

/**
 * Build the Hex API URL for a package name.
 * @param {string} packageName
 */
export function hexApiTargets(packageName) {
  const n = encodeURIComponent(packageName);
  return [`https://hex.pm/api/packages/${n}`];
}
