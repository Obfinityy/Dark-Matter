/**
 * apiVersionHeaderDetect.js — API versioning-scheme detection from headers and URL patterns.
 *
 * Implements idea-bank item 00437: detect how an API versions itself
 * (header-based, URL-path-based, query-parameter-based, or media-type-based
 * versioning) from observed requests/responses.
 *
 * All functions are pure and side-effect free: they operate on header maps
 * and URLs supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/** Header names that commonly carry an API version. */
export const VERSION_HEADER_NAMES = [
  'x-api-version',
  'api-version',
  'x-version',
  'accept-version',
  'x-api-revision',
  'x-minor-version',
];

/**
 * Extract a version value from a header map.
 * @param {object} headers Header map (name -> value).
 * @returns {Array<{header:string, value:string}>} one entry per version-bearing header found.
 */
export function extractVersionHeaders(headers) {
  const out = [];
  if (!headers || typeof headers !== 'object') return out;
  for (const key of Object.keys(headers)) {
    if (VERSION_HEADER_NAMES.includes(key.toLowerCase())) {
      out.push({ header: key, value: String(headers[key]).trim() });
    }
  }
  return out;
}

/**
 * Detect a version segment inside a URL path (e.g. /api/v2/users).
 * @param {string} url Observed URL or path.
 * @returns {{version:string|null, style:string|null, segment:string|null}}
 */
export function detectUrlVersion(url) {
  if (!url || typeof url !== 'string') return { version: null, style: null, segment: null };
  let path;
  try {
    path = new URL(url, 'http://localhost').pathname;
  } catch {
    path = url.split(/[?#]/)[0];
  }
  const segments = path.split('/').filter(Boolean);
  for (const seg of segments) {
    let m = seg.match(/^v(\d+(?:\.\d+)*)$/i);
    if (m) return { version: m[1], style: 'path-prefix', segment: seg };
    m = seg.match(/^version[-_]?(\d+(?:\.\d+)*)$/i);
    if (m) return { version: m[1], style: 'path-prefix', segment: seg };
  }
  return { version: null, style: null, segment: null };
}

/**
 * Detect versioning carried in query parameters (e.g. ?version=2 or ?api-version=1.5).
 * @param {string} url Observed URL.
 * @returns {{version:string|null, param:string|null}}
 */
export function detectQueryVersion(url) {
  if (!url || typeof url !== 'string') return { version: null, param: null };
  let search = '';
  try {
    search = new URL(url, 'http://localhost').search;
  } catch {
    search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  }
  const params = new URLSearchParams(search);
  for (const name of ['version', 'api-version', 'api_version', 'v']) {
    const value = params.get(name);
    if (value && /^v?\d+(\.\d+)*$/i.test(value.trim())) {
      return { version: value.trim().replace(/^v/i, ''), param: name };
    }
  }
  return { version: null, param: null };
}

/**
 * Detect vendor media-type versioning in an Accept or Content-Type header
 * (e.g. application/vnd.example.v2+json).
 * @param {string} mediaType Header value.
 * @returns {{version:string|null, vendor:string|null}}
 */
export function detectMediaTypeVersion(mediaType) {
  if (!mediaType || typeof mediaType !== 'string') return { version: null, vendor: null };
  const m = mediaType.match(/application\/vnd\.([a-z0-9_.-]+?)\.v(\d+(?:\.\d+)*)\+json/i)
    || mediaType.match(/application\/vnd\.([a-z0-9_.-]+?)[.-]v?(\d+(?:\.\d+)*)\+json/i);
  if (m) return { version: m[2], vendor: m[1] };
  return { version: null, vendor: null };
}

/**
 * Detect the full API versioning scheme from one observed exchange.
 * @param {object} obs { url?: string, requestHeaders?: object, responseHeaders?: object }
 * @returns {{schemes:Array<{style:string, version:string|null, evidence:string}>, primary:string|null, versions:string[]}}
 */
export function detectVersioningScheme(obs) {
  const o = obs || {};
  const schemes = [];
  for (const v of extractVersionHeaders(o.responseHeaders || {})) {
    schemes.push({ style: 'header', version: v.value || null, evidence: `response header ${v.header}: ${v.value}` });
  }
  for (const v of extractVersionHeaders(o.requestHeaders || {})) {
    schemes.push({ style: 'header', version: v.value || null, evidence: `request header ${v.header}: ${v.value}` });
  }
  const urlVer = detectUrlVersion(o.url || '');
  if (urlVer.version) {
    schemes.push({ style: 'url-path', version: urlVer.version, evidence: `path segment "${urlVer.segment}" in ${o.url || 'url'}` });
  }
  const queryVer = detectQueryVersion(o.url || '');
  if (queryVer.version) {
    schemes.push({ style: 'query-param', version: queryVer.version, evidence: `query parameter "${queryVer.param}" in ${o.url || 'url'}` });
  }
  const accept = Object.entries(o.requestHeaders || {}).find(([k]) => k.toLowerCase() === 'accept');
  const mediaVer = detectMediaTypeVersion(accept ? String(accept[1]) : '');
  if (mediaVer.version) {
    schemes.push({ style: 'media-type', version: mediaVer.version, evidence: `Accept: ${accept[1]} (vendor ${mediaVer.vendor})` });
  }
  const priority = { 'url-path': 4, header: 3, 'media-type': 2, 'query-param': 1 };
  const ranked = [...schemes].sort((a, b) => (priority[b.style] || 0) - (priority[a.style] || 0));
  const versions = [...new Set(schemes.map((s) => s.version).filter(Boolean))].sort();
  return { schemes: ranked, primary: ranked.length > 0 ? ranked[0].style : null, versions };
}

/**
 * Aggregate versioning observations across many endpoints.
 * @param {Array<object>} observations Observed exchanges (same shape as detectVersioningScheme input).
 * @returns {{schemes:object, versions:string[], endpoints:number, consistent:boolean, summary:string}}
 */
export function aggregateVersioning(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const schemeCounts = {};
  const versionSet = new Set();
  for (const o of list) {
    const r = detectVersioningScheme(o);
    if (r.primary) schemeCounts[r.primary] = (schemeCounts[r.primary] || 0) + 1;
    for (const v of r.versions) versionSet.add(v);
  }
  const versions = [...versionSet].sort();
  const top = Object.entries(schemeCounts).sort((a, b) => b[1] - a[1])[0];
  const consistent = top != null && top[1] === list.length && list.length > 0;
  const summary = top
    ? `Primary versioning style "${top[0]}" seen on ${top[1]} of ${list.length} endpoint(s); version(s): ${versions.join(', ') || 'unknown'}.`
    : 'No API versioning scheme detected in the supplied observations.';
  return { schemes: schemeCounts, versions, endpoints: list.length, consistent, summary };
}
