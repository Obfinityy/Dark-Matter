/**
 * staleWhileRevalidateMapper.js — stale-while-revalidate behavior mapping.
 *
 * Idea 00900: map SWR behavior to find background-refresh endpoints.
 *
 * No network calls: the module parses operator-supplied Cache-Control
 * headers for stale-while-revalidate / stale-if-error directives and maps
 * which URLs allow background refresh. Endpoints with long SWR windows are
 * served from cache while the origin revalidates — mapping them is part of
 * understanding the target's cache architecture during authorized recon.
 */

/**
 * Parse a Cache-Control header into typed directives.
 * @param {string|null} value
 */
export function parseCacheDirectives(value) {
  const out = {
    maxAge: null,
    sMaxAge: null,
    staleWhileRevalidate: null,
    staleIfError: null,
    noCache: false,
    noStore: false,
    immutable: false,
    mustRevalidate: false,
    proxyRevalidate: false,
    public: false,
    private: false,
  };
  if (!value) return out;
  const num = v => {
    const n = Number(String(v).replace(/^"|"$/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  for (const part of String(value).split(',')) {
    const [k, v] = part.trim().split('=').map(s => s.trim());
    const key = String(k || '').toLowerCase().replace(/-/g, '');
    switch (key) {
      case 'maxage': out.maxAge = num(v); break;
      case 'smaxage': out.sMaxAge = num(v); break;
      case 'stalewhilerevalidate': out.staleWhileRevalidate = num(v); break;
      case 'staleiferror': out.staleIfError = num(v); break;
      case 'nocache': out.noCache = true; break;
      case 'nostore': out.noStore = true; break;
      case 'immutable': out.immutable = true; break;
      case 'mustrevalidate': out.mustRevalidate = true; break;
      case 'proxyrevalidate': out.proxyRevalidate = true; break;
      case 'public': out.public = true; break;
      case 'private': out.private = true; break;
      default: break;
    }
  }
  return out;
}

function cacheControlOf(headers = {}) {
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === 'cache-control') {
      return Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return null;
}

/**
 * Map SWR behavior across responses.
 * @param {{url: string, headers: object}[]} responses
 */
export function mapSwrBehavior(responses = []) {
  const perUrl = [];
  for (const { url = '', headers = {} } of responses) {
    const d = parseCacheDirectives(cacheControlOf(headers));
    const lifetime = d.sMaxAge ?? d.maxAge;
    const swrWindow = d.staleWhileRevalidate;
    const backgroundRefresh = swrWindow !== null && swrWindow > 0;
    const errorResilience = d.staleIfError !== null && d.staleIfError > 0;
    perUrl.push({
      url,
      directives: d,
      lifetime,
      swrWindow,
      backgroundRefresh,
      errorResilience,
      totalServeWindow: lifetime !== null && swrWindow !== null ? lifetime + swrWindow : null,
      uncacheable: d.noStore,
    });
  }
  const withSwr = perUrl.filter(p => p.backgroundRefresh);
  const avgSwr = withSwr.length
    ? Math.round(withSwr.reduce((s, p) => s + (p.swrWindow || 0), 0) / withSwr.length)
    : 0;
  // Path-prefix clustering: which URL prefixes share SWR behavior.
  const prefixStats = {};
  for (const p of withSwr) {
    let prefix = '(root)';
    try {
      const u = new URL(p.url);
      const segs = u.pathname.split('/').filter(Boolean);
      prefix = segs.length ? '/' + segs[0] : '(root)';
    } catch { /* keep default */ }
    if (!prefixStats[prefix]) prefixStats[prefix] = { count: 0, maxSwr: 0 };
    prefixStats[prefix].count++;
    prefixStats[prefix].maxSwr = Math.max(prefixStats[prefix].maxSwr, p.swrWindow || 0);
  }
  return {
    perUrl,
    backgroundRefreshEndpoints: withSwr,
    prefixStats,
    stats: {
      responses: responses.length,
      withSwr: withSwr.length,
      avgSwrSeconds: avgSwr,
      withStaleIfError: perUrl.filter(p => p.errorResilience).length,
      uncacheable: perUrl.filter(p => p.uncacheable).length,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapSwrBehavior>} result
 */
export function swrFinding(result) {
  return {
    title: `Stale-while-revalidate mapping — ${result.stats.withSwr} background-refresh endpoint(s)`,
    severity: 'Info',
    confidence: result.stats.responses >= 3 ? 'high' : 'medium',
    stats: result.stats,
    endpoints: result.backgroundRefreshEndpoints.slice(0, 15).map(e => ({
      url: e.url,
      swrWindow: e.swrWindow,
      totalServeWindow: e.totalServeWindow,
    })),
    prefixStats: result.prefixStats,
    evidence:
      `${result.stats.withSwr}/${result.stats.responses} response(s) allow ` +
      `background refresh (avg SWR window ${result.stats.avgSwrSeconds}s).`,
  };
}

export const STALE_WHILE_REVALIDATE_MAPPER = {
  parseCacheDirectives,
  mapSwrBehavior,
  swrFinding,
};
export default STALE_WHILE_REVALIDATE_MAPPER;
