/**
 * sourceforgeHostIntel.js — SourceForge project host extraction (idea 00223).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses SourceForge project page HTML or the SourceForge API/project
 * metadata for download and homepage hosts: the `downloads.sourceforge.net`
 * mirror URLs, `project.homepage`, short-description links, and any
 * additional URLs developers list on the project page. Useful only against
 * targets the operator is authorized to assess.
 */

/**
 * Normalize a URL or host string to a hostname; null when unusable or
 * when it is SourceForge's own infrastructure.
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
    if (!h || h === 'localhost') return null;
    if (/\.?sourceforge\.(net|com|io)$/.test(h) || h === 'sourceforge.net') return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Find http(s) URLs in free text / HTML.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  const out = [];
  const re = /\bhttps?:\/\/[^\s"'<>()[\]{}|\\^`;,]+/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    out.push(m[0].replace(/[.,;:!?)]+$/, '').replace(/&amp;/g, '&'));
  }
  return [...new Set(out)];
}

/**
 * Idea 00223 — extract download + homepage hosts from SourceForge project
 * page HTML and/or project metadata.
 *
 * @param {string} html - Raw project page HTML (e.g. https://sourceforge.net/projects/<name>/).
 * @param {Object} [meta={}] - Optional project metadata (name, homepage, short description).
 * @returns {{ hosts: Array<{host: string, provenance: string, detail?: string}>, projectName: string|null }}
 */
export function parseSourceforgeProjectHosts(html, meta = {}) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const page = String(html || '');

  // Project name from og:title-ish or the known slug in URLs
  let projectName = meta.name || null;
  const nameMatch = page.match(/sourceforge\.net\/projects\/([a-z0-9][a-z0-9._-]*)/i);
  if (!projectName && nameMatch) projectName = nameMatch[1];

  // Declared homepage field (often the org's own site)
  for (const hp of [meta.homepage, meta.url]) {
    if (hp) {
      const host = toHost(hp);
      if (host) add(host, 'meta.homepage', String(hp));
    }
  }

  // <a ... href> links pointing off SourceForge (support sites, docs, demos)
  const hrefRe = /<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{0,80})/gi;
  let m;
  while ((m = hrefRe.exec(page)) !== null) {
    const host = toHost(m[1]);
    if (host) add(host, 'page.link', `${m[2].trim() || 'link'} → ${m[1]}`);
  }

  // JSON-LD / embedded homepage fields in page scripts
  for (const em of page.matchAll(/"(?:homepage|url|website)"\s*:\s*"(https?:\/\/[^"]+)"/gi)) {
    const host = toHost(em[1]);
    if (host) add(host, 'page.embedded', em[1]);
  }

  // Fallback: any URL on the page that resolves off-SourceForge
  for (const u of extractUrls(page)) {
    const host = toHost(u);
    if (host && !seen.has(`${host}|page.url`)) {
      seen.add(`${host}|page.url`);
      hits.push({ host, provenance: 'page.url', detail: u.slice(0, 120) });
    }
  }

  return { hosts: hits, projectName };
}

/**
 * Build SourceForge project URLs for a given project slug.
 * @param {string} projectSlug
 */
export function sourceforgeProjectTargets(projectSlug) {
  const s = encodeURIComponent(projectSlug);
  return [
    `https://sourceforge.net/projects/${s}/`,
    `https://sourceforge.net/projects/${s}/files/`,
    `https://sourceforge.net/api/project/name/${s}`,
  ];
}
