/**
 * rateLimitHeaderAnalysis.js — rate-limit header parsing and gateway-product identification.
 *
 * Implements idea-bank item 00438: analyze rate-limit response headers to
 * identify the gateway or rate-limiting product in front of an API
 * (Kong, Apigee, AWS API Gateway, Azure APIM, Cloudflare, and others).
 *
 * All functions are pure and side-effect free: they operate on header maps
 * supplied by the caller (gathered during an authorized engagement). No
 * network requests are performed here.
 */

/**
 * Rate-limit header families: IETF RateLimit draft fields, the classic
 * X-RateLimit-* set, and vendor variants.
 */
export const RATE_LIMIT_HEADER_FAMILIES = [
  { family: 'ietf-draft', names: ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset'] },
  { family: 'x-ratelimit', names: ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'] },
  { family: 'x-rate-limit', names: ['x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset'] },
  { family: 'retry-after', names: ['retry-after'] },
];

/**
 * Gateway products fingerprinted from characteristic rate-limit headers.
 */
export const GATEWAY_RATE_LIMIT_SIGNATURES = [
  {
    product: 'Kong Gateway',
    confidence: 'high',
    markers: ['x-kong-proxy-latency', 'x-kong-upstream-latency', 'x-kong-request-id'],
    note: 'Kong emits X-Kong-* timing headers; its rate-limiting plugin uses X-RateLimit-* fields.',
  },
  {
    product: 'AWS API Gateway',
    confidence: 'high',
    markers: ['x-amzn-requestid', 'x-amz-apigw-id', 'x-amzn-trace-id'],
    note: 'AWS API Gateway stamps x-amzn-RequestId on every response; throttling surfaces as 429 with Retry-After.',
  },
  {
    product: 'Azure API Management',
    confidence: 'medium',
    markers: ['ocp-apim-trace-location', 'ocp-apim-subscription-key'],
    note: 'Azure APIM advertises Ocp-Apim-* headers on traced/errored calls.',
  },
  {
    product: 'Cloudflare',
    confidence: 'medium',
    markers: ['cf-ray', 'cf-cache-status'],
    note: 'Cloudflare rate limiting (429) is accompanied by CF-RAY and cf-* headers.',
  },
  {
    product: 'Envoy',
    confidence: 'medium',
    markers: ['x-envoy-upstream-service-time', 'x-envoy-ratelimited'],
    note: 'Envoy marks rate-limited responses with x-envoy-ratelimited: true.',
  },
  {
    product: 'Nginx (limit_req)',
    confidence: 'low',
    markers: ['x-ratelimit-limit', 'x-ratelimit-remaining'],
    note: 'Nginx itself emits no rate-limit headers; their presence on an nginx Server banner implies a Lua/OpenResty layer.',
  },
  {
    product: 'Apigee',
    confidence: 'low',
    markers: ['x-ratelimit-reset'],
    note: 'Apigee SpikeArrest/Quota policies surface classic X-RateLimit-* headers on a Google-fronted host.',
  },
];

/**
 * Look up a header value case-insensitively.
 * @param {object} headers Header map (name -> value).
 * @param {string} name Header name.
 * @returns {string|null}
 */
export function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return null;
  const want = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) return headers[key];
  }
  return null;
}

/**
 * Parse observed rate-limit headers into a normalized structure.
 * @param {object} headers Header map (name -> value).
 * @returns {{families:object, values:object, hasRateLimitInfo:boolean}}
 */
export function parseRateLimitHeaders(headers) {
  const families = {};
  const values = {};
  for (const fam of RATE_LIMIT_HEADER_FAMILIES) {
    const found = {};
    for (const name of fam.names) {
      const v = getHeader(headers, name);
      if (v != null) {
        found[name] = String(v).trim();
        values[name] = String(v).trim();
      }
    }
    if (Object.keys(found).length > 0) families[fam.family] = found;
  }
  return { families, values, hasRateLimitInfo: Object.keys(values).length > 0 };
}

/**
 * Normalize a rate-limit window into requests-per-second for comparison.
 * @param {number|string} limit Request quota.
 * @param {number|string} windowSeconds Window length in seconds.
 * @returns {number|null}
 */
export function normalizeRateWindow(limit, windowSeconds) {
  const l = Number(limit);
  const w = Number(windowSeconds);
  if (!Number.isFinite(l) || !Number.isFinite(w) || w <= 0) return null;
  return l / w;
}

/**
 * Identify the gateway/rate-limiting product from observed headers.
 * @param {object} headers Header map (name -> value).
 * @returns {Array<{product:string, confidence:string, note:string, matchedMarkers:string[]}>}
 */
export function identifyRateLimitGateway(headers) {
  if (!headers || typeof headers !== 'object') return [];
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v);
  const hits = [];
  for (const sig of GATEWAY_RATE_LIMIT_SIGNATURES) {
    const matched = sig.markers.filter((m) => m in lower);
    if (matched.length > 0) {
      hits.push({ product: sig.product, confidence: sig.confidence, note: sig.note, matchedMarkers: matched });
    }
  }
  const rank = { high: 3, medium: 2, low: 1 };
  return hits.sort((a, b) => rank[b.confidence] - rank[a.confidence] || b.matchedMarkers.length - a.matchedMarkers.length);
}

/**
 * Full rate-limit analysis for one observed response.
 * @param {object} obs { status?: number|null, headers?: object }
 * @returns {{parsed:object, gateways:Array, throttled:boolean, summary:string}}
 */
export function analyzeRateLimit(obs) {
  const o = obs || {};
  const headers = o.headers || {};
  const parsed = parseRateLimitHeaders(headers);
  const gateways = identifyRateLimitGateway(headers);
  const throttled = o.status === 429 || getHeader(headers, 'retry-after') != null;
  const parts = [];
  if (parsed.hasRateLimitInfo) {
    const famNames = Object.keys(parsed.families).join(', ');
    parts.push(`rate-limit headers present (${famNames})`);
  } else {
    parts.push('no rate-limit headers observed');
  }
  if (gateways.length > 0) parts.push(`likely gateway: ${gateways[0].product} (${gateways[0].confidence} confidence)`);
  if (throttled) parts.push('response indicates active throttling (429 or Retry-After)');
  return { parsed, gateways, throttled, summary: parts.join('; ') + '.' };
}
