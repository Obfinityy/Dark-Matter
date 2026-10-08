/**
 * bitbucketHostIntel.js — Bitbucket repository host mining (idea 00222).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Bitbucket API 2.0 repository payloads (or raw repo file text such as
 * README / config samples) to recover target hostnames: website/documentation
 * links, clone URLs, project keys mapped to web properties, and hostnames
 * embedded in docs. Useful only against targets the operator is authorized
 * to assess.
 */

/**
 * Normalize a URL or host string to a hostname; null when unusable.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  const s = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel|ftp):/i.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost' || /bitbucket\.org$/.test(h) || /atlassian\.(com|net)$/.test(h))
      return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Find http(s) URLs in free text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  const out = [];
  const re = /\bhttps?:\/\/[^\s"'<>()[\]{}|\\^`;,]+/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[0].replace(/[.,;:!?)]+$/, ''));
  return [...new Set(out)];
}

/**
 * Idea 00222 — mine hostnames from a Bitbucket API 2.0 repository JSON payload.
 *
 * Consumes `GET /2.0/repositories/{workspace}/{repo_slug}` style responses:
 *  - `website` link
 *  - `links.html.href` / `links.avatar.href`
 *  - `links.clone[]` (https + ssh endpoints → clone host)
 *  - `project` website-ish fields when present
 *
 * @param {Object} repoJson - Bitbucket repository API payload.
 * @returns {{ hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseBitbucketRepoHosts(repoJson) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };
  const r = repoJson || {};
  if (typeof r !== 'object') return { hosts: hits };

  if (r.website) {
    const host = toHost(r.website);
    if (host) add(host, 'repo.website', r.website);
  }
  const links = r.links || {};
  for (const [k, v] of Object.entries(links)) {
    if (v && typeof v === 'object' && v.href && !/avatar/i.test(k)) {
      const host = toHost(v.href);
      if (host) add(host, `repo.links.${k}`, v.href);
    }
  }
  for (const c of links.clone || []) {
    const href = c && c.href;
    if (!href) continue;
    const host = toHost(href);
    if (host) add(host, `repo.clone.${c.name || 'endpoint'}`, href);
  }
  if (r.project && typeof r.project === 'object') {
    for (const key of ['website', 'links']) {
      const v = r.project[key];
      if (typeof v === 'string') {
        const host = toHost(v);
        if (host) add(host, `project.${key}`, v);
      }
    }
  }
  return { hosts: hits };
}

/**
 * Mine hostnames from raw repository file text (README, docs, configs).
 * @param {string} text - Raw file content.
 * @param {string} [sourceName='file'] - Provenance label.
 * @returns {{ hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseBitbucketFileTextHosts(text, sourceName = 'file') {
  const hits = [];
  const seen = new Set();
  for (const u of extractUrls(text)) {
    const host = toHost(u);
    if (host && !seen.has(host)) {
      seen.add(host);
      hits.push({ host, provenance: sourceName, detail: u });
    }
  }
  return { hosts: hits };
}

/**
 * Build Bitbucket API 2.0 URLs for a repository.
 * @param {string} workspace
 * @param {string} repoSlug
 */
export function bitbucketApiTargets(workspace, repoSlug) {
  const w = encodeURIComponent(workspace);
  const s = encodeURIComponent(repoSlug);
  const base = `https://api.bitbucket.org/2.0/repositories/${w}/${s}`;
  return [
    `${base}`,
    `https://bitbucket.org/${w}/${s}/raw/HEAD/README.md`,
    `https://bitbucket.org/${w}/${s}/src/HEAD/`,
  ];
}
