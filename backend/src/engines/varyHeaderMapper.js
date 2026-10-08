/**
 * varyHeaderMapper.js — Vary-header behavior mapping.
 *
 * Idea 00898: map Vary headers to understand cache variants.
 *
 * No network calls: the module parses operator-supplied Vary response
 * headers across the target's URLs and maps which request dimensions
 * (Accept-Encoding, Cookie, Accept-Language, User-Agent, …) create distinct
 * cache variants. This tells the operator how the target's cache is keyed —
 * a prerequisite for efficient authorized cache-behavior testing.
 */

/**
 * Parse a Vary header value into a normalized token list.
 * @param {string|null} value
 * @returns {string[]}
 */
export function parseVary(value) {
  if (!value) return [];
  const tokens = String(value)
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tokens)];
}

const VARY_NOTES = {
  'accept-encoding': 'Compression variants (gzip/br). Harmless, expected on most CDNs.',
  cookie: 'User-specific variants: cache keys differ per cookie — may multiply cache entries.',
  'accept-language': 'Locale variants: distinct cached copy per language.',
  'user-agent': 'Device/UA variants: risky — unbounded UA strings fragment the cache.',
  origin: 'CORS variants: cached per Origin header (preflight safety).',
  authorization: 'Auth variants: separate cache per credential — verify no cross-user leakage.',
  host: 'Host variants: same path cached per Host header value.',
  'x-forwarded-proto': 'Scheme variants: http vs https cached separately.',
  '*': 'Wildcard: response is effectively uncacheable per RFC — every request is a variant.',
};

/**
 * Map Vary behavior across a set of responses.
 * @param {{url: string, headers: object}[]} responses
 */
export function mapVaryBehavior(responses = []) {
  const perUrl = [];
  const dimensionCounts = {};
  const comboCounts = {};
  for (const { url = '', headers = {} } of responses) {
    let raw = null;
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).toLowerCase() === 'vary') {
        raw = Array.isArray(v) ? v.join(', ') : String(v);
        break;
      }
    }
    const dimensions = parseVary(raw);
    for (const d of dimensions) dimensionCounts[d] = (dimensionCounts[d] || 0) + 1;
    const combo = dimensions.length ? [...dimensions].sort().join(' + ') : '(none)';
    comboCounts[combo] = (comboCounts[combo] || 0) + 1;
    perUrl.push({
      url,
      dimensions,
      variantKey: combo,
      notes: dimensions.map(d => VARY_NOTES[d] || 'Custom variant dimension.'),
    });
  }
  const topDimensions = Object.entries(dimensionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dimension, count]) => ({
      dimension,
      count,
      note: VARY_NOTES[dimension] || 'Custom variant dimension.',
    }));
  const topCombos = Object.entries(comboCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([combo, count]) => ({ combo, count }));
  const risky = perUrl.filter(p =>
    p.dimensions.includes('*') ||
    p.dimensions.includes('user-agent') ||
    p.dimensions.includes('cookie'),
  );
  return {
    perUrl,
    topDimensions,
    topCombos,
    risky,
    stats: {
      responses: responses.length,
      withVary: perUrl.filter(p => p.dimensions.length > 0).length,
      distinctDimensions: Object.keys(dimensionCounts).length,
      distinctCombos: Object.keys(comboCounts).length,
      riskyVariants: risky.length,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapVaryBehavior>} result
 */
export function varyFinding(result) {
  return {
    title: `Vary-header mapping — ${result.stats.distinctDimensions} cache-variant dimension(s) across ${result.stats.withVary} response(s)`,
    severity: result.stats.riskyVariants > 0 ? 'Low' : 'Info',
    confidence: result.stats.responses >= 3 ? 'high' : 'medium',
    stats: result.stats,
    topDimensions: result.topDimensions,
    topCombos: result.topCombos.slice(0, 10),
    riskyUrls: result.risky.slice(0, 10).map(r => ({ url: r.url, dimensions: r.dimensions })),
    evidence:
      `${result.stats.withVary}/${result.stats.responses} response(s) send Vary; ` +
      `${result.stats.riskyVariants} use high-fragmentation or sensitive dimensions.`,
  };
}

export const VARY_HEADER_MAPPER = {
  parseVary,
  mapVaryBehavior,
  varyFinding,
};
export default VARY_HEADER_MAPPER;
