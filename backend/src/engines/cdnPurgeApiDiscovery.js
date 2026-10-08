/**
 * cdnPurgeApiDiscovery.js — CDN purge API discovery.
 *
 * Idea 00894: find CDN purge endpoints from deployment scripts.
 *
 * No network calls: the module scans operator-supplied deployment script /
 * config text (CI pipelines, shell deploy scripts, IaC) for cache-purge
 * endpoint references and provider API patterns. Any credential-looking
 * values found nearby are redacted in the output — the module maps the
 * endpoint surface, it never exfiltrates secrets.
 */

const PURGE_URL_PATTERNS = [
  // Cloudflare
  { provider: 'cloudflare', re: /https?:\/\/api\.cloudflare\.com\/client\/v4\/zones\/[^"'`\s]*?\/purge_cache/gi },
  // Fastly
  { provider: 'fastly', re: /https?:\/\/(?:api\.)?fastly\.com\/service\/[^"'`\s]*?\/purge[^"'`\s]*/gi },
  // Akamai CCU
  { provider: 'akamai', re: /https?:\/\/[^"'`\s]*akamaiapis?\.net\/ccu\/v3\/[^"'`\s]*/gi },
  { provider: 'akamai', re: /https?:\/\/[^"'`\s]*\/ccu\/v3\/(?:invalidate|delete)\/url[^"'`\s]*/gi },
  // CloudFront invalidation via CLI/SDK calls
  { provider: 'cloudfront', re: /aws\s+cloudfront\s+create-invalidation[^\n]*/gi },
  { provider: 'cloudfront', re: /CreateInvalidation[^\n]{0,120}/g },
  // Generic purge-y URL paths
  { provider: 'generic', re: /https?:\/\/[^\s"'`<>]+\/(?:purge|invalidate|cache\/(?:purge|invalidate|clear|flush))[^\s"'`<>]*/gi },
];

const TOKEN_REDACT_RE = /((?:token|api[_-]?key|secret|password|auth)[-_]?(?:key|token)?["'\s]*[:=]["'\s]*)([^"'\s,;}]+)/gi;
const BEARER_REDACT_RE = /(Bearer\s+)([A-Za-z0-9\-._~+/=]{8,})/g;

/**
 * Redact credential-looking values in a text snippet.
 * @param {string} text
 */
export function redactSecrets(text) {
  return String(text)
    .replace(TOKEN_REDACT_RE, '$1[REDACTED]')
    .replace(BEARER_REDACT_RE, '$1[REDACTED]');
}

/**
 * Guess the CDN provider from a URL.
 * @param {string} url
 */
export function classifyProvider(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('cloudflare')) return 'cloudflare';
  if (u.includes('fastly')) return 'fastly';
  if (u.includes('akamai')) return 'akamai';
  if (u.includes('cloudfront') || u.includes('amazonaws.com')) return 'cloudfront';
  if (u.includes('azureedge') || u.includes('azurefd')) return 'azure-frontdoor';
  if (u.includes('cdn77')) return 'cdn77';
  if (u.includes('bunnycdn') || u.includes('b-cdn')) return 'bunnycdn';
  if (u.includes('stackpath')) return 'stackpath';
  return 'unknown';
}

/** Find the source line containing a match, for context. */
function surroundingLine(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 200);
}

/**
 * Scan deployment text for CDN purge endpoints.
 * @param {string} text - Deployment script / CI config / IaC text.
 * @param {string} [sourceName]
 * @returns {{endpoints: object[], stats: object}}
 */
export function findPurgeEndpoints(text = '', sourceName = '') {
  const src = String(text);
  const endpoints = [];
  const seen = new Set();
  for (const { provider, re } of PURGE_URL_PATTERNS) {
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      const raw = m[0].trim();
      if (seen.has(raw)) continue;
      seen.add(raw);
      endpoints.push({
        provider: provider === 'generic' ? classifyProvider(raw) : provider,
        match: redactSecrets(raw),
        context: redactSecrets(surroundingLine(src, m.index ?? 0)),
        source: sourceName || null,
      });
    }
  }
  // Bare keyword hits that did not match a URL pattern (e.g. env-var indirection).
  const keywordRe = /\b(?:purge(?:_cache)?|invalidate(?:_cache)?|cache[_-]?(?:purge|flush|clear))\b/gi;
  const keywordHits = [];
  for (const m of src.matchAll(keywordRe)) {
    keywordHits.push(redactSecrets(surroundingLine(src, m.index ?? 0)));
  }
  const uniqueKeywordHits = [...new Set(keywordHits)].slice(0, 25);
  const byProvider = {};
  for (const e of endpoints) byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
  return {
    endpoints,
    keywordHits: uniqueKeywordHits,
    stats: {
      endpoints: endpoints.length,
      byProvider,
      keywordHits: uniqueKeywordHits.length,
    },
  };
}

/**
 * Build a report finding from the discovery result.
 * @param {ReturnType<typeof findPurgeEndpoints>} result
 */
export function cdnPurgeFinding(result) {
  return {
    title: `CDN purge API discovery — ${result.stats.endpoints} purge endpoint(s) referenced`,
    severity: result.stats.endpoints > 0 ? 'Low' : 'Info',
    confidence: result.stats.endpoints > 0 ? 'high' : 'medium',
    stats: result.stats,
    endpoints: result.endpoints.slice(0, 15),
    evidence:
      `${result.stats.endpoints} purge endpoint reference(s) and ` +
      `${result.stats.keywordHits} purge keyword hit(s) found in deployment text.`,
  };
}

export const CDN_PURGE_API_DISCOVERY = {
  redactSecrets,
  classifyProvider,
  findPurgeEndpoints,
  cdnPurgeFinding,
};
export default CDN_PURGE_API_DISCOVERY;
