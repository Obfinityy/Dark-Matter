/**
 * opensearchMiner.js — OpenSearch description host extraction.
 *
 * Sites advertise browser search plugins through OpenSearch description
 * documents (`opensearch.xml`, often linked via
 * `<link rel="search" type="application/opensearchdescription+xml">`).
 * The `<Url template="...">` elements point at the site's search service —
 * a dedicated search host, API gateway or legacy search appliance that
 * frequently differs from the main web host.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Common OpenSearch description locations. */
export const CANDIDATE_PATHS = [
  '/opensearch.xml',
  '/search/opensearch.xml',
  '/open-search.xml',
  '/.well-known/opensearch.xml',
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
 * Extract the hostname from a template URL, ignoring {placeholders}.
 * @param {string} raw
 * @returns {string|null}
 */
function hostnameOf(raw) {
  try {
    const cleaned = String(raw).replace(/\{[^}]*\}/g, 'x');
    return new URL(cleaned).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Parse an OpenSearch description document.
 * @param {string} content raw XML text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   shortName: string|null, description: string|null,
 *   searchUrls: Array<{ type: string|null, template: string, host: string|null, parameters: string[] }>,
 *   images: string[], contact: string|null, tags: string[],
 *   hosts: string[], rawParse: boolean
 * }}
 */
export function analyzeOpenSearch(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const result = {
    source, shortName: null, description: null, searchUrls: [],
    images: [], contact: null, tags: [], hosts: [], rawParse: false,
  };
  const text = String(content || '');
  if (!/<OpenSearchDescription[\s>]/i.test(text) && !/<Url[\s>]/i.test(text)) return result;
  result.rawParse = true;
  const hosts = new Set();

  const pick = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  result.shortName = pick(/<ShortName[^>]*>([^<]*)<\/ShortName>/i);
  result.description = pick(/<Description[^>]*>([^<]*)<\/Description>/i);
  result.contact = pick(/<Contact[^>]*>([^<]*)<\/Contact>/i);
  const tags = pick(/<Tags[^>]*>([^<]*)<\/Tags>/i);
  if (tags) result.tags = tags.split(/\s+/).filter(Boolean);

  for (const m of text.matchAll(/<Url\b[^>]*>/gi)) {
    const tag = m[0];
    const type = (tag.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
    const template = (tag.match(/\btemplate\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
    if (!template) continue;
    const host = hostnameOf(template);
    if (host) hosts.add(host.toLowerCase());
    const parameters = [...template.matchAll(/\{([^}=]+)(?:=[^}]*)?\}/g)].map((p) => p[1]);
    result.searchUrls.push({ type, template, host: host ? host.toLowerCase() : null, parameters });
  }
  for (const m of text.matchAll(/<Image\b[^>]*>([^<]*)<\/Image>/gi)) {
    const img = m[1].trim();
    if (!img) continue;
    result.images.push(img);
    const host = hostnameOf(img);
    if (host) hosts.add(host.toLowerCase());
  }
  result.hosts = [...hosts];
  return result;
}

/**
 * Flag search hosts outside the target's own domain — dedicated search
 * infrastructure worth scoping into the hunt.
 * @param {ReturnType<typeof analyzeOpenSearch>} analysis
 * @param {string} targetHost the hunted target's hostname
 * @returns {string[]} external search hosts
 */
export function externalSearchHosts(analysis, targetHost = '') {
  const base = String(targetHost).toLowerCase().replace(/^www\./, '');
  return (analysis.hosts || []).filter((h) => h !== base && !h.endsWith(`.${base}`));
}
