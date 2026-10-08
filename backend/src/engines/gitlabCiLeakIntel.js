/**
 * gitlabCiLeakIntel.js — GitLab CI configuration host extraction (idea 00221).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses `.gitlab-ci.yml` content (fetched from a repository, merge request
 * diff, or artifact) to recover infrastructure hostnames that CI pipelines
 * routinely reference: registry images/services, `environment:url` entries,
 * and raw URLs embedded in `script:` blocks. Useful only against targets the
 * operator is authorized to assess.
 */

/**
 * Extract a registrable host from a URL-ish or host:port string.
 * Returns null when the value is not a usable external host.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  const s = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1') return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null; // skip bare IPs here; asset layer handles them
    return h;
  } catch {
    return null;
  }
}

/**
 * Find every http(s) URL embedded in free text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  const out = [];
  const re = /\bhttps?:\/\/[^\s"'<>()[\]{}|\\^`;,]+/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    out.push(m[0].replace(/[.,;:!?)]+$/, ''));
  }
  return [...new Set(out)];
}

/**
 * Idea 00221 — parse `.gitlab-ci.yml` content for environment URLs and
 * registry hosts.
 *
 * Looks at (without a YAML parser, so tolerant of partial fetches):
 *  - `image:` / `services:` entries (container registry hosts)
 *  - `environment: url:` entries (deployed environment hosts)
 *  - `variables:` KEY: values that look like URLs or `host` values
 *  - raw URLs inside `script:` / `before_script:` / `after_script:` blocks
 *
 * @param {string} ymlText - Raw `.gitlab-ci.yml` text.
 * @returns {{ hosts: Array<{host: string, provenance: string, detail?: string}>, urls: string[] }}
 */
export function parseGitlabCiHosts(ymlText) {
  const text = String(ymlText || '');
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  // image: registry.example.com/group/image:tag  /  services: entries
  for (const m of text.matchAll(/^\s*(?:image|services):\s*[-*]?\s*['"]?([^\s'"]+?)['"]?\s*$/gim)) {
    const ref = m[1].trim();
    if (!ref || /^\$/.test(ref)) continue; // variable reference, can't resolve statically
    // A registry host appears when the path's first segment contains '.' or ':'
    // AND the ref has a '/' (org/image path) — bare "redis:7" service refs
    // without a path are image:tag pairs, not registry hosts.
    const first = ref.split('/')[0];
    if (ref.includes('/') && /[.:]/.test(first) && !/^\d+$/.test(first)) {
      const host = toHost(first);
      if (host) add(host, 'image/services', ref);
    }
  }

  // environment: url: <url>
  for (const m of text.matchAll(/^\s*url:\s*['"]?(https?:\/\/[^\s'"]+)['"]?\s*$/gim)) {
    const host = toHost(m[1]);
    if (host) add(host, 'environment.url', m[1]);
  }

  // variables: KEY: <url-ish> — only values that look like URLs or hosts
  const varSection = text.match(/^\s*variables:\s*$(.*?)(?=^\S|\Z)/gims);
  if (varSection) {
    for (const m of varSection[0].matchAll(
      /^\s*[A-Za-z_][A-Za-z0-9_]*:\s*['"]?([^\s'"]+)['"]?\s*$/gm
    )) {
      const v = m[1];
      if (/^https?:\/\//i.test(v) || /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/|$)/i.test(v)) {
        const host = toHost(v);
        if (host) add(host, 'variables', v);
      }
    }
  }

  // Raw URLs in script blocks (deployment endpoints, webhook targets, etc.)
  const urls = extractUrls(text);
  for (const u of urls) {
    const host = toHost(u);
    if (host) add(host, 'script.url', u);
  }

  return { hosts: hits, urls };
}

/**
 * Build candidate URLs where a public `.gitlab-ci.yml` may be readable.
 * No network calls are made here.
 * @param {string} repoWebUrl - e.g. "https://gitlab.com/group/project"
 */
export function gitlabCiFetchTargets(repoWebUrl) {
  const base = String(repoWebUrl || '').replace(/\/$/, '');
  return [
    `${base}/-/raw/main/.gitlab-ci.yml`,
    `${base}/-/raw/master/.gitlab-ci.yml`,
    `${base}/-/raw/HEAD/.gitlab-ci.yml`,
  ];
}
