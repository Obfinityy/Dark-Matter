/**
 * faviconHarvest.js — multi-path favicon harvesting plan builder.
 *
 * Applications hide their favicons in different locations (/favicon.ico,
 * /assets/, /static/, theme directories, apple-touch icons...). This module
 * takes a base URL and optional page HTML and produces an ordered,
 * de-duplicated list of favicon candidate URLs to fetch, plus a parser that
 * extracts <link rel="icon"> declarations from HTML so declared icons are
 * tried before blind path guessing.
 * Pure planning: it builds URL lists and parses HTML; fetching is left to
 * the caller (no network I/O here).
 */

/** Common favicon locations, ordered by likelihood. */
export const COMMON_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/assets/favicon.ico',
  '/assets/favicon.png',
  '/assets/images/favicon.ico',
  '/static/favicon.ico',
  '/static/favicon.png',
  '/static/images/favicon.ico',
  '/images/favicon.ico',
  '/img/favicon.ico',
  '/images/icons/favicon.ico',
  '/public/favicon.ico',
  '/dist/favicon.ico',
  '/build/favicon.ico',
  '/themes/favicon.ico',
  '/wp-content/themes/favicon.ico',
  '/sites/default/files/favicon.ico',
  '/media/favicon.ico',
  '/resources/favicon.ico',
  '/icon.ico',
  '/icon.png',
  '/manifest.json',
];

/** <link> rel values that declare icons, in preference order. */
const ICON_RELS = [
  'icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed',
  'mask-icon', 'fluid-icon',
];

/**
 * Extract declared icon URLs from HTML <link rel="..."> tags.
 *
 * @param {string} html - page HTML
 * @param {string} baseUrl - base URL to resolve relative hrefs
 * @returns {Array<{url: string, rel: string, sizes: string|null, source: 'declared'}>}
 */
export function extractFaviconLinks(html, baseUrl) {
  const out = [];
  if (!html || !baseUrl) return out;
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    const rel = relMatch[1].trim().toLowerCase();
    if (!ICON_RELS.includes(rel)) continue;
    const sizesMatch = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i);
    try {
      const url = new URL(hrefMatch[1], baseUrl).toString();
      out.push({ url, rel, sizes: sizesMatch ? sizesMatch[1] : null, source: 'declared' });
    } catch {
      // ignore unresolvable hrefs
    }
  }
  // Prefer larger / standard icons first.
  const relRank = (r) => ICON_RELS.indexOf(r);
  out.sort((a, b) => relRank(a.rel) - relRank(b.rel));
  return out;
}

/**
 * Build an ordered, de-duplicated harvest plan for a host's favicons.
 *
 * @param {Object} args
 * @param {string} args.baseUrl - e.g. "https://target.example.com/"
 * @param {string} [args.html] - optional fetched page HTML for declared icons
 * @param {Array<string>} [args.extraPaths] - additional custom paths to try
 * @param {number} [args.maxCandidates=40] - cap on candidates returned
 * @returns {{base: string, candidates: Array, plan: Object}}
 */
export function planHarvest({ baseUrl, html = null, extraPaths = [], maxCandidates = 40 } = {}) {
  if (!baseUrl) throw new TypeError('planHarvest requires baseUrl');
  const base = new URL(baseUrl);
  base.hash = '';
  base.search = '';

  const declared = html ? extractFaviconLinks(html, base.toString()) : [];
  const candidates = [];
  const seen = new Set();

  const push = (url, source, priority) => {
    let normalized;
    try { normalized = new URL(url).toString(); } catch { return; }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ url: normalized, source, priority });
  };

  // Declared icons first (highest confidence).
  for (const d of declared) push(d.url, 'declared', 1);
  // Then the common blind paths.
  for (const p of COMMON_PATHS) push(new URL(p, base).toString(), 'common-path', 2);
  // Then caller-supplied custom paths.
  for (const p of extraPaths || []) push(new URL(p, base).toString(), 'custom', 3);

  candidates.sort((a, b) => a.priority - b.priority);
  const trimmed = candidates.slice(0, maxCandidates);

  return {
    base: base.origin,
    candidates: trimmed,
    plan: {
      declaredCount: declared.length,
      commonPathCount: COMMON_PATHS.length,
      totalCandidates: trimmed.length,
      truncated: candidates.length > trimmed.length,
    },
  };
}

/**
 * Deduplicate harvest results by content hash so identical icons fetched
 * from multiple paths are only analyzed once.
 *
 * @param {Array<{url: string, hash: number|null, bytes: number|null, status: number}>} results
 * @returns {{unique: Array, duplicates: Array}}
 */
export function dedupeHarvest(results = []) {
  const byHash = new Map();
  const unique = [];
  const duplicates = [];
  for (const r of results) {
    if (r.hash === null || r.hash === undefined) { unique.push(r); continue; }
    if (byHash.has(r.hash)) {
      duplicates.push({ ...r, duplicateOf: byHash.get(r.hash).url });
    } else {
      byHash.set(r.hash, r);
      unique.push(r);
    }
  }
  return { unique, duplicates };
}

export const FAVICON_HARVEST = { planHarvest, extractFaviconLinks, dedupeHarvest, COMMON_PATHS };
export default FAVICON_HARVEST;
