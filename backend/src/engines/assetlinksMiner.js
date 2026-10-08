/**
 * assetlinksMiner.js — assetlinks.json host extraction.
 *
 * Android apps declare their linkage to web domains through
 * `.well-known/assetlinks.json` (Digital Asset Links). Each statement carries
 * a relation, a target namespace, and either an android_app target (package
 * name + cert fingerprints) or a web target (site URL). Parsing the file
 * reveals the target's mobile inventory and associated web domains —
 * all publicly served data on an authorized target.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Well-known locations of the assetlinks file. */
export const CANDIDATE_PATHS = ['/.well-known/assetlinks.json'];

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
 * Parse an assetlinks.json file.
 * @param {string|Array} content raw file text (or already-parsed array)
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   statements: Array<{
 *     relation: string[], namespace: string|null,
 *     packageName: string|null, sha256Fingerprints: string[],
 *     site: string|null, siteHost: string|null
 *   }>,
 *   androidApps: string[],
 *   webSites: string[],
 *   webHosts: string[],
 *   rawParse: boolean
 * }}
 */
export function analyzeAssetlinks(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const empty = {
    source,
    statements: [],
    androidApps: [],
    webSites: [],
    webHosts: [],
    rawParse: false,
  };
  let doc;
  try {
    doc = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return empty;
  }
  if (!Array.isArray(doc)) return empty;
  const result = { ...empty, rawParse: true };
  const apps = new Set();
  const sites = new Set();
  const hosts = new Set();

  for (const stmt of doc) {
    if (!stmt || typeof stmt !== 'object') continue;
    const relation = Array.isArray(stmt.relation) ? stmt.relation.map(String) : [];
    const target = stmt.target || {};
    const namespace = target.namespace ? String(target.namespace) : null;
    const packageName = target.package_name ? String(target.package_name) : null;
    const fingerprints = Array.isArray(target.sha256_cert_fingerprints)
      ? target.sha256_cert_fingerprints.map(String)
      : [];
    const site = target.site ? String(target.site) : null;
    const siteHost = site ? hostnameOf(site) : null;
    result.statements.push({
      relation,
      namespace,
      packageName,
      sha256Fingerprints: fingerprints,
      site,
      siteHost,
    });
    if (namespace === 'android_app' && packageName) apps.add(packageName);
    if (namespace === 'web' && site) {
      sites.add(site);
      if (siteHost) hosts.add(siteHost.toLowerCase());
    }
  }
  result.androidApps = [...apps];
  result.webSites = [...sites];
  result.webHosts = [...hosts];
  return result;
}

/**
 * Check whether the app list leaks development / test packages.
 * @param {ReturnType<typeof analyzeAssetlinks>} analysis
 * @returns {string[]} package names that look like debug/staging builds
 */
export function findDevPackages(analysis) {
  return (analysis.androidApps || []).filter(p =>
    /\.debug$|\.dev$|\.staging$|\.qa$|\.test$|debug|staging|internal/i.test(p)
  );
}

/**
 * Summarize an analysis for reporting.
 * @param {ReturnType<typeof analyzeAssetlinks>} analysis
 * @returns {{ totalStatements: number, androidApps: number, webHosts: string[] }}
 */
export function summarizeAnalysis(analysis) {
  return {
    totalStatements: (analysis.statements || []).length,
    androidApps: (analysis.androidApps || []).length,
    webHosts: analysis.webHosts || [],
  };
}
