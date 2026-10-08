/**
 * appSiteAssociationMiner.js — Apple app-site-association host mining.
 *
 * Many organisations serve a `.well-known/apple-app-site-association` file
 * that declares which native iOS apps are linked to the web host
 * (Universal Links / Shared Web Credentials / App Clips). The file reveals
 * bundle identifiers, team IDs and the URL patterns the apps handle —
 * intelligence that maps the mobile surface back to web hosts.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 * Defensive use only: parse files served by an authorized target.
 */

/** Well-known locations of the association file. */
export const CANDIDATE_PATHS = [
  '/.well-known/apple-app-site-association',
  '/apple-app-site-association',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map(p => `${origin}${p}`);
}

/**
 * Extract the hostname from a URL string, tolerant of placeholders.
 * @param {string} raw
 * @returns {string|null}
 */
function hostnameOf(raw) {
  try {
    const cleaned = String(raw)
      .replace(/\{[^}]*\}/g, 'x')
      .trim();
    const u = new URL(cleaned);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Parse an apple-app-site-association file.
 * @param {string|object} content raw file text (or already-parsed object)
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   apps: Array<{ appId: string, teamId: string|null, bundleId: string|null, kinds: string[] }>,
 *   pathPatterns: string[],
 *   embeddedUrls: string[],
 *   linkedHosts: string[],
 *   rawParse: boolean
 * }}
 */
export function analyzeAppSiteAssociation(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const empty = {
    source,
    apps: [],
    pathPatterns: [],
    embeddedUrls: [],
    linkedHosts: [],
    rawParse: false,
  };
  const text = typeof content === 'string' ? content : JSON.stringify(content || {});
  let doc;
  try {
    doc = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return { ...empty, rawParse: false };
  }
  if (!doc || typeof doc !== 'object') return empty;
  const result = { ...empty, rawParse: true };

  // 1. appIDs / applinks.details — Universal Links declarations
  const applinks = doc.applinks || doc['applinks:'] || {};
  const details = applinks.details || doc.details || [];
  for (const entry of details) {
    if (!entry || typeof entry !== 'object') continue;
    const appId = entry.appID || entry.appId || entry.appid || '';
    const [teamId, ...rest] = String(appId).split('.');
    result.apps.push({
      appId: String(appId),
      teamId: teamId || null,
      bundleId: rest.length ? rest.join('.') : null,
      kinds: ['universal-links'],
    });
    const paths =
      entry.paths || (entry.components && entry.components.map(c => c['/'] || c['%'])) || [];
    for (const p of paths) if (p) result.pathPatterns.push(String(p));
  }
  // 2. Flat appIDs list (some publishers ship a top-level "appIDs" array)
  const flat = Array.isArray(doc.appIDs) ? doc.appIDs : Array.isArray(doc.appIds) ? doc.appIds : [];
  for (const appId of flat) {
    if (result.apps.some(a => a.appId === String(appId))) continue;
    const [teamId, ...rest] = String(appId).split('.');
    result.apps.push({
      appId: String(appId),
      teamId: teamId || null,
      bundleId: rest.join('.') || null,
      kinds: ['declared'],
    });
  }
  // 3. webcredentials apps
  const wc = doc.webcredentials || {};
  for (const appId of wc.apps || []) {
    if (result.apps.some(a => a.appId === String(appId))) continue;
    const [teamId, ...rest] = String(appId).split('.');
    result.apps.push({
      appId: String(appId),
      teamId: teamId || null,
      bundleId: rest.join('.') || null,
      kinds: ['webcredentials'],
    });
  }
  // 4. Any absolute URLs embedded in the document (comments/configs leak hosts)
  const urlRe = /https?:\/\/[^\s"'<>,}]+/g;
  const seen = new Set();
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const host = hostnameOf(m[0]);
    if (host && !seen.has(host)) {
      seen.add(host);
      result.embeddedUrls.push(m[0]);
      result.linkedHosts.push(host);
    }
  }
  return result;
}

/**
 * Summarize an analysis for reporting.
 * @param {ReturnType<typeof analyzeAppSiteAssociation>} analysis
 * @returns {{ totalApps: number, totalHosts: number, hosts: string[], apps: string[] }}
 */
export function summarizeAnalysis(analysis) {
  const hosts = [...new Set((analysis.linkedHosts || []).map(h => h.toLowerCase()))];
  return {
    totalApps: (analysis.apps || []).length,
    totalHosts: hosts.length,
    hosts,
    apps: (analysis.apps || []).map(a => a.appId),
  };
}
