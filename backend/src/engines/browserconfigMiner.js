/**
 * browserconfigMiner.js — browserconfig.xml tile-URL mining.
 *
 * `/browserconfig.xml` configures Windows tile images for a site. The
 * `<tile>` elements carry `src` attributes for square/wide tile logos —
 * these frequently point at CDN hosts, asset buckets or sibling asset
 * subdomains, exposing infrastructure hosts tied to the target.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Well-known locations of the browserconfig.xml file. */
export const CANDIDATE_PATHS = [
  '/browserconfig.xml',
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
 * Resolve a possibly-relative URL against a base origin.
 * @param {string} raw
 * @param {string} base origin
 * @returns {string|null} absolute URL
 */
function resolveUrl(raw, base) {
  try {
    return new URL(String(raw), base).toString();
  } catch {
    return null;
  }
}

/**
 * Parse a browserconfig.xml file and extract tile image URLs.
 * @param {string} content raw XML text
 * @param {{ sourceUrl?: string, baseUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   tiles: Array<{ name: string, src: string, absoluteUrl: string|null, host: string|null }>,
 *   hosts: string[],
 *   tileColor: string|null, rawParse: boolean
 * }}
 */
export function analyzeBrowserconfig(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const base = opts.baseUrl || source || 'https://example.invalid';
  const result = { source, tiles: [], hosts: [], tileColor: null, rawParse: false };
  const text = String(content || '');
  if (!/<msapplication[\s>]/i.test(text) && !/<tile[\s>]/i.test(text)) return result;
  result.rawParse = true;

  const colorMatch = text.match(/<TileColor[^>]*>([^<]*)<\/TileColor>/i);
  if (colorMatch) result.tileColor = colorMatch[1].trim() || null;

  const tileBlock = text.match(/<tile[\s\S]*?<\/tile>/i);
  const scope = tileBlock ? tileBlock[0] : text;
  const seen = new Set();
  for (const m of scope.matchAll(/<([a-zA-Z0-9]+)[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/g)) {
    const name = m[1];
    const src = m[2];
    if (seen.has(src)) continue;
    seen.add(src);
    const absoluteUrl = resolveUrl(src, base);
    let host = null;
    try { host = new URL(absoluteUrl).hostname; } catch { /* ignore */ }
    if (host) result.hosts.push(host.toLowerCase());
    result.tiles.push({ name, src, absoluteUrl, host: host ? host.toLowerCase() : null });
  }
  result.hosts = [...new Set(result.hosts)];
  return result;
}

/**
 * Flag tile hosts that live on a different host than the target — those
 * are the CDN / asset-infrastructure pivots this idea hunts for.
 * @param {ReturnType<typeof analyzeBrowserconfig>} analysis
 * @param {string} targetHost the hunted target's hostname
 * @returns {string[]} external tile hosts
 */
export function externalTileHosts(analysis, targetHost = '') {
  const base = String(targetHost).toLowerCase().replace(/^www\./, '');
  return (analysis.hosts || []).filter((h) => h !== base && !h.endsWith(`.${base}`));
}
