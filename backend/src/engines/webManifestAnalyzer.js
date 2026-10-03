/**
 * webManifestAnalyzer.js — web app manifest start-url analysis.
 *
 * Web app manifests (`/manifest.json`, `/site.webmanifest`, or the path
 * advertised in `<link rel="manifest">`) describe an installable PWA:
 * start_url, scope, id, icons, screenshots, shortcuts and
 * related_applications. These URLs routinely reveal backend hosts,
 * staging origins, CDN asset domains and the mobile-app store identities
 * tied to the web property.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Common manifest file locations. */
export const CANDIDATE_PATHS = [
  '/manifest.json',
  '/site.webmanifest',
  '/manifest.webmanifest',
  '/.well-known/manifest.json',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map((p) => `${origin}${p}`);
}

/**
 * Extract the hostname from a URL string.
 * @param {string} raw
 * @returns {string|null}
 */
function hostnameOf(raw) {
  try {
    return new URL(String(raw)).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a manifest-relative URL against the manifest's own URL.
 * @param {string} raw
 * @param {string} manifestUrl
 * @returns {string|null}
 */
function resolveUrl(raw, manifestUrl) {
  try {
    return new URL(String(raw), manifestUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Parse a web app manifest and enumerate every host it references.
 * @param {string|object} content raw JSON text (or parsed object)
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   name: string|null, shortName: string|null,
 *   startUrl: string|null, scope: string|null, id: string|null,
 *   icons: Array<{ src: string, absoluteUrl: string|null, sizes: string|null, type: string|null }>,
 *   screenshots: string[], shortcuts: string[], relatedApplications: Array<{ platform: string|null, url: string|null, id: string|null }>,
 *   hosts: string[], rawParse: boolean
 * }}
 */
export function analyzeWebManifest(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const empty = {
    source, name: null, shortName: null, startUrl: null, scope: null, id: null,
    icons: [], screenshots: [], shortcuts: [], relatedApplications: [], hosts: [], rawParse: false,
  };
  let doc;
  try {
    doc = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return empty;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return empty;
  const result = { ...empty, rawParse: true };
  const hosts = new Set();
  const base = source || 'https://example.invalid';

  result.name = doc.name ? String(doc.name) : null;
  result.shortName = doc.short_name ? String(doc.short_name) : null;
  if (doc.start_url) {
    result.startUrl = resolveUrl(doc.start_url, base);
    const h = hostnameOf(result.startUrl);
    if (h) hosts.add(h.toLowerCase());
  }
  if (doc.scope) {
    result.scope = resolveUrl(doc.scope, base);
    const h = hostnameOf(result.scope);
    if (h) hosts.add(h.toLowerCase());
  }
  if (doc.id) result.id = resolveUrl(doc.id, base) || String(doc.id);

  for (const icon of Array.isArray(doc.icons) ? doc.icons : []) {
    if (!icon || !icon.src) continue;
    const absoluteUrl = resolveUrl(icon.src, base);
    const host = hostnameOf(absoluteUrl);
    if (host) hosts.add(host.toLowerCase());
    result.icons.push({
      src: String(icon.src),
      absoluteUrl,
      sizes: icon.sizes ? String(icon.sizes) : null,
      type: icon.type ? String(icon.type) : null,
    });
  }
  for (const shot of Array.isArray(doc.screenshots) ? doc.screenshots : []) {
    if (!shot || !shot.src) continue;
    const absoluteUrl = resolveUrl(shot.src, base);
    const host = hostnameOf(absoluteUrl);
    if (host) hosts.add(host.toLowerCase());
    result.screenshots.push(absoluteUrl);
  }
  for (const sc of Array.isArray(doc.shortcuts) ? doc.shortcuts : []) {
    if (!sc || !sc.url) continue;
    const absoluteUrl = resolveUrl(sc.url, base);
    const host = hostnameOf(absoluteUrl);
    if (host) hosts.add(host.toLowerCase());
    result.shortcuts.push(absoluteUrl);
  }
  for (const app of Array.isArray(doc.related_applications) ? doc.related_applications : []) {
    if (!app) continue;
    const url = app.url ? resolveUrl(app.url, base) : null;
    const host = url ? hostnameOf(url) : null;
    if (host) hosts.add(host.toLowerCase());
    result.relatedApplications.push({
      platform: app.platform ? String(app.platform) : null,
      url,
      id: app.id ? String(app.id) : null,
    });
  }
  result.hosts = [...hosts];
  return result;
}

/**
 * Flag manifest hosts outside the target's own domain — backend, staging
 * and CDN pivots worth adding to the hunt's target list.
 * @param {ReturnType<typeof analyzeWebManifest>} analysis
 * @param {string} targetHost the hunted target's hostname
 * @returns {string[]} external hosts
 */
export function externalManifestHosts(analysis, targetHost = '') {
  const base = String(targetHost).toLowerCase().replace(/^www\./, '');
  return (analysis.hosts || []).filter((h) => h !== base && !h.endsWith(`.${base}`));
}
