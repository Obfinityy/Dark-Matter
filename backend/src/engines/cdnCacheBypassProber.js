/**
 * cdnCacheBypassProber.js — CDN cache-bypass probing analyzer.
 *
 * Analyzes captured HTTP responses taken with and without cache-busting
 * variations (query busters, path tweaks, header changes) to determine:
 *   1. Whether a CDN sits in front of the target and which provider it is.
 *   2. Whether cache-busting reaches the origin (cache MISS / DYNAMIC).
 *   3. Which origin headers leak only on uncached responses — these
 *      fingerprint the true backend stack behind the CDN.
 *
 * This module is a pure offline analyzer: it consumes already-captured
 * probe results and returns structured findings. It performs no network I/O.
 */

const CDN_HEADER_SIGNATURES = [
  { provider: 'Cloudflare', match: (h) => h['cf-ray'] || (h['server'] || '').toLowerCase() === 'cloudflare' },
  { provider: 'CloudFront', match: (h) => h['x-amz-cf-id'] || h['x-amz-cf-pop'] || /cloudfront\.net/i.test(h['via'] || '') },
  { provider: 'Fastly', match: (h) => h['x-served-by'] && /cache-/i.test(h['x-served-by']) || h['x-fastly-request-id'] },
  { provider: 'Akamai', match: (h) => h['x-akamai-transformed'] || /akamai/i.test(h['server'] || '') || h['x-akamai-request-id'] },
  { provider: 'Vercel', match: (h) => h['x-vercel-cache'] || h['x-vercel-id'] },
  { provider: 'Netlify', match: (h) => h['x-nf-request-id'] },
  { provider: 'Sucuri', match: (h) => h['x-sucuri-cache'] || h['x-sucuri-id'] },
  { provider: 'Bunny', match: (h) => h['cdn-pullzone'] || h['cdn-uid'] },
];

const CACHE_STATE_HEADERS = ['x-cache', 'cf-cache-status', 'x-vercel-cache', 'x-sucuri-cache', 'x-cache-status'];

const ORIGIN_STACK_HEADERS = [
  'server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version',
  'x-generator', 'x-drupal-cache', 'x-varnish', 'via',
];

const BYPASS_TECHNIQUES = [
  { id: 'query-buster', name: 'Random query parameter', how: 'Append ?<random>=<random> to bust query-keyed caches.' },
  { id: 'path-variant', name: 'Case / encoding path variant', how: 'Alter path casing or percent-encoding where the origin normalizes.' },
  { id: 'header-variant', name: 'Vary request headers', how: 'Change Accept-Encoding / User-Agent / Accept to defeat vary-keyed caches.' },
  { id: 'cookie-variant', name: 'Cookie variation', how: 'Add a benign session-like cookie to force a cache MISS on cookie-keyed caches.' },
  { id: 'method-variant', name: 'Method variation', how: 'Use HEAD or POST-with-safe-body where the cache only keys GET.' },
  { id: 'extension-suffix', name: 'Fake static extension', how: 'Append ;.css or /.css to trick extension-based cache rules (cache-deception style, read-only).' },
];

/**
 * Normalize a raw headers object to lowercase keys.
 * @param {Object} headers
 */
function normalizeHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) out[String(k).toLowerCase()] = String(v);
  return out;
}

/**
 * Identify the CDN provider from response headers.
 * @param {Object} headers Lowercased header map.
 * @returns {string|null} Provider name or null.
 */
export function detectCdnProvider(headers = {}) {
  const h = normalizeHeaders(headers);
  for (const sig of CDN_HEADER_SIGNATURES) {
    if (sig.match(h)) return sig.provider;
  }
  return null;
}

/**
 * Read the cache state (HIT/MISS/DYNAMIC/unknown) from response headers.
 * @param {Object} headers Lowercased header map.
 * @returns {string} 'HIT' | 'MISS' | 'DYNAMIC' | 'BYPASS' | 'UNKNOWN'
 */
export function readCacheState(headers = {}) {
  const h = normalizeHeaders(headers);
  for (const key of CACHE_STATE_HEADERS) {
    const v = (h[key] || '').toUpperCase();
    if (/HIT/.test(v) && !/MISS/.test(v)) return 'HIT';
    if (/MISS|EXPIRED|STALE/.test(v)) return 'MISS';
    if (/DYNAMIC/.test(v)) return 'DYNAMIC';
    if (/BYPASS/.test(v)) return 'BYPASS';
  }
  const age = parseInt(h['age'] || '0', 10);
  if (!Number.isNaN(age) && age > 0) return 'HIT';
  return 'UNKNOWN';
}

/**
 * Recommend cache-bypass techniques ordered for the detected CDN.
 * @param {{provider?: string|null, cacheState?: string}} input
 * @returns {Array<{id, name, how, rationale}>}
 */
export function selectBypassTechnique({ provider = null, cacheState = 'UNKNOWN' } = {}) {
  const ranked = BYPASS_TECHNIQUES.map((t, i) => ({ ...t, rationale: '', priority: i }));
  const boost = (id, reason) => {
    const t = ranked.find((x) => x.id === id);
    if (t) { t.priority -= 10; t.rationale = reason; }
  };
  if (provider === 'Cloudflare') {
    boost('query-buster', 'Cloudflare cache keys include the query string on most plans — a random query parameter is the cheapest first bypass.');
    boost('header-variant', 'Cloudflare varies on Accept-Encoding; header rotation defeats vary-keyed cache entries.');
  } else if (provider === 'Fastly' || provider === 'Akamai') {
    boost('header-variant', 'Enterprise CDNs key heavily on request headers — vary Accept/User-Agent/Cookie first.');
    boost('cookie-variant', 'Cookie-keyed caching is common on these platforms.');
  } else if (provider === 'CloudFront') {
    boost('query-buster', 'CloudFront forwards query strings to the origin when configured — buster params reach the origin.');
    boost('method-variant', 'CloudFront caches GET/HEAD by default; safe method variation can skip the cache.');
  } else {
    boost('query-buster', 'Query-string busting is the universally safest first attempt.');
  }
  if (cacheState === 'DYNAMIC') {
    boost('extension-suffix', 'Edge already treats the path as dynamic — extension suffixes probe cache-rule inconsistencies.');
  }
  return ranked.sort((a, b) => a.priority - b.priority).map(({ priority, ...rest }) => rest);
}

/**
 * Analyze baseline + cache-busted probe responses for CDN and origin signals.
 * @param {{target: string, probes: Array<{label: string, technique?: string, headers?: Object, statusCode?: number, bodyLength?: number, bodyHash?: string, responseTimeMs?: number}>}} input
 *   probes[0] should be the baseline (no busting); the rest are bypass variants.
 */
export function analyzeCacheBypass({ target, probes = [] }) {
  if (!probes.length) {
    return { target, cdnDetected: false, confidence: 'low', error: 'No probe data supplied.' };
  }
  const normalized = probes.map((p) => ({ ...p, headers: normalizeHeaders(p.headers) }));
  const baseline = normalized[0];
  const provider = detectCdnProvider(baseline.headers);
  const baselineState = readCacheState(baseline.headers);
  const cdnDetected = provider !== null || baselineState !== 'UNKNOWN';

  const bypasses = [];
  const originLeakedHeaders = {};
  for (const probe of normalized.slice(1)) {
    const state = readCacheState(probe.headers);
    const bodyChanged = probe.bodyHash && baseline.bodyHash && probe.bodyHash !== baseline.bodyHash;
    const effective = (baselineState === 'HIT' && (state === 'MISS' || state === 'DYNAMIC' || state === 'BYPASS')) || bodyChanged;
    if (effective) {
      for (const key of ORIGIN_STACK_HEADERS) {
        const v = probe.headers[key];
        if (v && !originLeakedHeaders[key] && (!baseline.headers[key] || baseline.headers[key] !== v)) {
          originLeakedHeaders[key] = v;
        }
      }
    }
    bypasses.push({
      technique: probe.technique || probe.label,
      effective,
      baselineState,
      variantState: state,
      bodyChanged: !!bodyChanged,
      statusCode: probe.statusCode,
      responseTimeMs: probe.responseTimeMs,
      evidence: effective
        ? `Baseline ${baselineState} → variant ${state}${bodyChanged ? ' with different body hash' : ''}: bypass reached the origin.`
        : `Variant still ${state}; cache not bypassed by ${probe.technique || probe.label}.`,
    });
  }

  const anyEffective = bypasses.some((b) => b.effective);
  const serverHeader = originLeakedHeaders['server'] || '';
  const poweredBy = originLeakedHeaders['x-powered-by'] || '';
  const originStackHint = [serverHeader, poweredBy].filter(Boolean).join(' / ') || null;

  const confidence = !cdnDetected ? 'low'
    : anyEffective && originStackHint ? 'high'
    : anyEffective ? 'medium'
    : 'low';

  const recommended = selectBypassTechnique({ provider, cacheState: baselineState })[0];

  return {
    target,
    cdnDetected,
    cdnProvider: provider,
    baselineCacheState: baselineState,
    bypasses,
    anyBypassEffective: anyEffective,
    originLeakedHeaders,
    originStackHint,
    recommendedBypass: recommended ? recommended.id : null,
    confidence,
    findings: [
      cdnDetected ? `CDN detected in front of ${target}${provider ? ` (${provider})` : ''}; baseline cache state ${baselineState}.` : `No CDN cache headers observed for ${target}.`,
      anyEffective ? `Cache bypass effective — origin responses reachable; true backend stack fingerprinted: ${originStackHint || 'headers captured, stack not identified'}.` : 'No bypass variant reached the origin; the backend stack remains hidden behind the edge cache.',
    ],
  };
}

export const CDN_CACHE_BYPASS_PROBER = {
  analyzeCacheBypass,
  detectCdnProvider,
  readCacheState,
  selectBypassTechnique,
  BYPASS_TECHNIQUES,
};
export default CDN_CACHE_BYPASS_PROBER;
