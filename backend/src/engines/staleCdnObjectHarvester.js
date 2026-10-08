/**
 * staleCdnObjectHarvester.js — stale CDN-object harvesting.
 *
 * Idea 00893: request stale CDN objects via cache headers to find removed
 * assets.
 *
 * No network calls: the module analyses operator-supplied response records
 * (URL + response headers) and flags objects that look stale — served past
 * their freshness lifetime, missing validators, or exhibiting cache-hit
 * anomalies. Stale objects often correspond to assets the target thought it
 * had removed, so they extend the mapped surface.
 */

function headerValue(headers = {}, name) {
  const lower = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === lower) return Array.isArray(v) ? v.join(', ') : String(v);
  }
  return null;
}

/**
 * Parse a Cache-Control header into a directive map.
 * @param {string|null} value
 * @returns {Object<string, string|boolean>}
 */
export function parseCacheControl(value) {
  const directives = {};
  if (!value) return directives;
  for (const part of String(value).split(',')) {
    const [k, v] = part.trim().split('=').map(s => s.trim());
    if (!k) continue;
    directives[k.toLowerCase().replace(/-/g, '')] = v === undefined ? true : v.replace(/^"|"$/g, '');
  }
  return directives;
}

const toSeconds = v => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Assess one cached response for staleness signals.
 * @param {{url: string, headers?: object}} entry
 * @returns {{url: string, stale: boolean, signals: string[], freshness: object}}
 */
export function assessStaleness(entry = {}) {
  const { url = '', headers = {} } = entry;
  const cc = parseCacheControl(headerValue(headers, 'cache-control'));
  const age = toSeconds(headerValue(headers, 'age'));
  const maxAge = toSeconds(cc.maxage);
  const sMaxAge = toSeconds(cc.smaxage);
  const lifetime = sMaxAge ?? maxAge;
  const cacheStatus = headerValue(headers, 'x-cache') || headerValue(headers, 'cf-cache-status') ||
    headerValue(headers, 'x-cache-status') || headerValue(headers, 'akamai-cache-status');
  const etag = headerValue(headers, 'etag');
  const lastModified = headerValue(headers, 'last-modified');

  const signals = [];
  let stale = false;

  if (age !== null && lifetime !== null && age > lifetime) {
    stale = true;
    signals.push(`age-exceeds-lifetime:${age}s>${lifetime}s`);
  }
  if (age !== null && lifetime !== null && age > lifetime * 10 && lifetime > 0) {
    signals.push('deeply-stale:age-10x-lifetime');
  }
  if (!etag && !lastModified) signals.push('no-validator:neither-etag-nor-last-modified');
  if (/hit/i.test(cacheStatus || '') && stale) signals.push('stale-hit:cdn-served-stale-object');
  if (cc.nostore) signals.push('no-store:should-not-be-cached');
  else if (cc.nocache && age !== null && age > 0) signals.push('no-cache-with-age');
  if (cc.immutable && /\.(css|js)(\?|$)/i.test(url)) signals.push('immutable-asset:versioned-filename-expected');

  const freshness = {
    age,
    lifetime,
    remaining: age !== null && lifetime !== null ? lifetime - age : null,
    cacheStatus: cacheStatus || null,
  };
  return { url, stale, signals, freshness };
}

/**
 * Harvest stale objects from a batch of cached response records.
 * @param {{url: string, headers?: object}[]} responses
 * @returns {{stale: object[], suspicious: object[], stats: object}}
 */
export function harvestStaleObjects(responses = []) {
  const assessed = responses.map(assessStaleness);
  const stale = assessed.filter(a => a.stale);
  const suspicious = assessed.filter(a => !a.stale && a.signals.length > 0);
  return {
    stale,
    suspicious,
    stats: {
      responses: responses.length,
      stale: stale.length,
      suspicious: suspicious.length,
      withCacheHit: assessed.filter(a => a.freshness.cacheStatus && /hit/i.test(a.freshness.cacheStatus)).length,
      withoutValidators: assessed.filter(a => a.signals.some(s => s.startsWith('no-validator'))).length,
    },
  };
}

/**
 * Build a report finding from the harvest result.
 * @param {ReturnType<typeof harvestStaleObjects>} result
 */
export function staleCdnFinding(result) {
  return {
    title: `Stale CDN-object harvesting — ${result.stats.stale} stale object(s) served`,
    severity: result.stats.stale > 0 ? 'Low' : 'Info',
    confidence: result.stats.responses >= 3 ? 'high' : 'medium',
    stats: result.stats,
    topStale: result.stale.slice(0, 15).map(s => ({
      url: s.url,
      signals: s.signals,
      age: s.freshness.age,
      lifetime: s.freshness.lifetime,
    })),
    evidence:
      `${result.stats.responses} cached response(s) analysed; ` +
      `${result.stats.stale} served past their freshness lifetime.`,
  };
}

export const STALE_CDN_OBJECT_HARVESTER = {
  parseCacheControl,
  assessStaleness,
  harvestStaleObjects,
  staleCdnFinding,
};
export default STALE_CDN_OBJECT_HARVESTER;
