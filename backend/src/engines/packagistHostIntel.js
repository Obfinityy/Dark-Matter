/**
 * packagistHostIntel.js — Packagist repo host mining (idea 00229).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Packagist package JSON (`repository` URL fields, source/dist
 * references, support links, maintainer contacts) to recover the owning
 * organization's hosts: source repos, docs sites, issue trackers, and
 * support portals. Useful only against targets the operator is authorized
 * to assess.
 */

/**
 * Normalize a URL/host/git-URL string to a hostname; null when unusable or
 * when it is Packagist / VCS hosting infrastructure itself.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  let s = String(value).trim().replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel):/i.test(s)) return null;
  s = s.replace(/^(git\+)?ssh:\/\/(git@)?/i, 'https://').replace(/^git@/i, 'https://');
  const scp = s.match(/^([A-Za-z0-9][A-Za-z0-9.-]*):[\w.~/-]+$/);
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return scp[1].toLowerCase();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/\.?packagist\.org$/.test(h)) return null;
    if (/\.github\.com$/.test(h) || /\.gitlab\.com$/.test(h) || /\.bitbucket\.org$/.test(h)) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Idea 00229 — mine org hosts from a Packagist package metadata document.
 *
 * Consumes `GET https://repo.packagist.org/p2/<vendor>/<name>.json`
 * (`packages.<name>[]` version entries) or the older `p/<name>.json`
 * format. Reads per-version `source.url`, `dist.url`, `homepage`,
 * `support.{source,docs,issues,forum,chat,rss}`, and author e-mail domains.
 *
 * @param {Object} packagistJson - Packagist metadata payload.
 * @returns {{ package: string|null, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parsePackagistPackageHosts(packagistJson) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const doc = (packagistJson && typeof packagistJson === 'object') ? packagistJson : {};
  const packages = doc.packages || {};
  const pkgName = Object.keys(packages)[0] || doc.name || null;
  const versions = (pkgName && Array.isArray(packages[pkgName])) ? packages[pkgName]
    : (Array.isArray(doc.versions) ? doc.versions : []);

  for (const v of versions) {
    if (!v || typeof v !== 'object') continue;
    if (v.source && typeof v.source.url === 'string') {
      const host = toHost(v.source.url);
      if (host) add(host, 'source.url', v.source.url);
      const gh = v.source.url.match(/github\.com[/:]([^/\s"']+)/i);
      if (gh) add('github.com', 'source.org', `GitHub org: ${gh[1]}`);
    }
    if (v.dist && typeof v.dist.url === 'string') {
      const host = toHost(v.dist.url);
      if (host) add(host, 'dist.url', v.dist.url);
    }
    if (typeof v.homepage === 'string' && v.homepage) {
      const host = toHost(v.homepage);
      if (host) add(host, 'homepage', v.homepage);
    }
    const support = v.support || {};
    for (const [k, url] of Object.entries(support)) {
      if (typeof url === 'string' && url) {
        const host = toHost(url);
        if (host) add(host, `support.${k}`, url);
      }
    }
    for (const a of v.authors || []) {
      const email = a && a.email;
      if (typeof email !== 'string') continue;
      const m = email.match(/@([A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/);
      if (m) {
        const domain = m[1].toLowerCase();
        if (!/\.?packagist\.org$/.test(domain) && !seen.has(`${domain}|authors.email`)) {
          seen.add(`${domain}|authors.email`);
          hits.push({ host: domain, provenance: 'authors.email', detail: `contact domain (${email})` });
        }
      }
    }
  }

  return { package: pkgName, hosts: hits };
}

/**
 * Build Packagist metadata URLs for a vendor/package name.
 * @param {string} vendor
 * @param {string} name
 */
export function packagistApiTargets(vendor, name) {
  const v = encodeURIComponent(vendor);
  const n = encodeURIComponent(name);
  return [
    `https://repo.packagist.org/p2/${v}/${n}.json`,
    `https://packagist.org/packages/${v}/${n}.json`,
  ];
}
