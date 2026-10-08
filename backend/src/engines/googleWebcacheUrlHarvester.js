/**
 * googleWebcacheUrlHarvester.js — Google webcache URL harvesting.
 *
 * Idea 00890: harvest Google webcache URLs for historical page versions of a
 * target — the operator passes in cached-page references (from their own
 * research notes, search-result dumps, or sitemap archaeology) and the module
 * normalizes them into a version timeline.
 *
 * This module never contacts Google. It parses webcache URL shapes
 * (webcache.googleusercontent.com/search?q=cache:<id>:<url>), extracts the
 * original URL plus cache metadata, dedupes snapshots, and orders them so the
 * operator can diff historical versions. Defensive, read-only analysis.
 */

/** Matches Google webcache URLs in both historic and current shapes. */
export const WEBCACHE_URL_RE =
  /https?:\/\/webcache\.googleusercontent\.com\/search\?[^"'\s<>]*/gi;

/**
 * Parse a single Google webcache URL into its cache components.
 * @param {string} url
 * @returns {{cacheId: string|null, originalUrl: string|null, stripped: boolean, raw: string}|null}
 */
export function parseWebcacheUrl(url = '') {
  if (!WEBCACHE_URL_RE.test(String(url))) return null;
  WEBCACHE_URL_RE.lastIndex = 0;
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return null;
  }
  const q = u.searchParams.get('q') || '';
  const cacheMatch = /^cache:([^:]+):(.+)$/s.exec(q);
  return {
    cacheId: cacheMatch ? cacheMatch[1] : null,
    originalUrl: cacheMatch ? cacheMatch[2] : null,
    stripped: u.searchParams.get('strip') === '1' || u.searchParams.has('strip'),
    raw: String(url),
  };
}

/**
 * Harvest webcache references from text (search-result dumps, notes, HTML).
 * @param {string} text
 * @returns {object[]}
 */
export function harvestWebcacheUrls(text = '') {
  WEBCACHE_URL_RE.lastIndex = 0;
  const raw = String(text).match(WEBCACHE_URL_RE) || [];
  const out = [];
  const seen = new Set();
  for (const r of raw) {
    if (seen.has(r)) continue;
    seen.add(r);
    const parsed = parseWebcacheUrl(r);
    if (parsed) {
      out.push({
        kind: 'webcache-url',
        ...parsed,
      });
    }
  }
  return out;
}

/**
 * Group harvested webcache URLs by their original URL into version entries.
 * @param {object[]} harvested - Output of harvestWebcacheUrls().
 * @returns {object[]}
 */
export function groupByOriginalUrl(harvested = []) {
  const groups = new Map();
  for (const h of harvested) {
    const key = h.originalUrl || '(unparseable)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  return [...groups.entries()].map(([originalUrl, snapshots]) => ({
    originalUrl,
    snapshots: snapshots.length,
    cacheIds: [...new Set(snapshots.map(s => s.cacheId).filter(Boolean))],
    strippedVersions: snapshots.filter(s => s.stripped).length,
    fullVersions: snapshots.filter(s => !s.stripped).length,
    urls: snapshots.map(s => s.raw),
  }));
}

/**
 * Score how valuable a snapshot is for historical recon: full (non-stripped)
 * versions with a cache id rank highest.
 * @param {object} entry - Output of parseWebcacheUrl().
 * @returns {number}
 */
export function scoreSnapshot(entry = {}) {
  let score = 0;
  if (entry.cacheId) score += 2;
  if (!entry.stripped) score += 2;
  if (entry.originalUrl) score += 1;
  return score;
}

/**
 * Build a harvest report: dedupe, group, and rank webcache references.
 * @param {string} text - Raw text containing webcache URLs.
 * @returns {{entries: object[], groups: object[], stats: object}}
 */
export function harvestWebcacheReport(text = '') {
  const entries = harvestWebcacheUrls(text);
  const ranked = entries
    .map(e => ({ ...e, score: scoreSnapshot(e) }))
    .sort((a, b) => b.score - a.score);
  const groups = groupByOriginalUrl(entries);
  groups.sort((a, b) => b.snapshots - a.snapshots);
  return {
    entries: ranked,
    groups,
    stats: {
      references: entries.length,
      distinctPages: groups.filter(g => g.originalUrl !== '(unparseable)').length,
      fullVersions: entries.filter(e => !e.stripped).length,
      strippedVersions: entries.filter(e => e.stripped).length,
      withCacheId: entries.filter(e => e.cacheId).length,
    },
  };
}

/**
 * Build a report finding from a webcache harvest.
 * @param {ReturnType<typeof harvestWebcacheReport>} result
 */
export function webcacheFinding(result) {
  return {
    title: `Webcache URL harvest — ${result.stats.references} reference(s) across ${result.stats.distinctPages} page(s)`,
    severity: 'Info',
    confidence: result.stats.references > 0 ? 'high' : 'medium',
    groups: result.groups.slice(0, 20),
    stats: result.stats,
    evidence:
      `${result.stats.references} webcache reference(s) harvested; ` +
      `${result.stats.distinctPages} distinct historical page(s), ` +
      `${result.stats.fullVersions} full-version snapshot(s).`,
  };
}

export const GOOGLE_WEBCACHE_URL_HARVESTER = {
  parseWebcacheUrl,
  harvestWebcacheUrls,
  groupByOriginalUrl,
  scoreSnapshot,
  harvestWebcacheReport,
  webcacheFinding,
};
export default GOOGLE_WEBCACHE_URL_HARVESTER;
