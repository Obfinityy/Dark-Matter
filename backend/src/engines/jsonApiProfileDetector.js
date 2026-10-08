/**
 * jsonApiProfileDetector.js — JSON:API profile detection engine.
 *
 * Idea 00630 — JSON:API profile detection.
 *
 * Detects JSON:API (application/vnd.api+json) usage and profiles on
 * authorized targets by analyzing Content-Type profile parameters, the
 * top-level jsonapi member (version/meta), and document structure
 * (data/relationships/included). Used to fingerprint frameworks and to
 * flag verbose error objects as hardening notes.
 */

const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json';

/**
 * Parse a Content-Type header for JSON:API media type and profile params.
 * @param {string} contentType
 * @returns {{ isJsonApi: boolean, profiles: string[], ext: string[] }}
 */
export function analyzeJsonApiContentType(contentType = '') {
  const result = { isJsonApi: false, profiles: [], ext: [] };
  const [mediaType, ...params] = String(contentType)
    .split(';')
    .map(s => s.trim());
  if (mediaType.toLowerCase() !== JSONAPI_MEDIA_TYPE) return result;
  result.isJsonApi = true;
  for (const param of params) {
    const [k, ...rest] = param.split('=');
    const value = rest.join('=').replace(/^"|"$/g, '');
    const key = k.trim().toLowerCase();
    if (key === 'profile') result.profiles.push(...value.split(/\s+/).filter(Boolean));
    if (key === 'ext') result.ext.push(...value.split(/\s+/).filter(Boolean));
  }
  return result;
}

/**
 * Analyze a JSON:API document for version, profiles, and structure signals.
 * @param {unknown} doc parsed JSON document (or raw string)
 * @returns {{ detected: boolean, version: string|null, profiles: string[], hasData: boolean, hasRelationships: boolean, hasIncluded: boolean, hasErrors: boolean, verboseErrors: boolean }}
 */
export function analyzeJsonApiDocument(doc) {
  const result = {
    detected: false,
    version: null,
    profiles: [],
    hasData: false,
    hasRelationships: false,
    hasIncluded: false,
    hasErrors: false,
    verboseErrors: false,
  };
  let data = doc;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return result;
    }
  }
  if (!data || typeof data !== 'object') return result;
  const jsonapi = data.jsonapi;
  const looksJsonApi = Boolean(jsonapi) || 'data' in data || 'errors' in data || 'meta' in data;
  if (!looksJsonApi) return result;
  result.detected = true;
  if (jsonapi && typeof jsonapi === 'object') {
    result.version = jsonapi.version || null;
    const profiles = jsonapi.profile;
    if (Array.isArray(profiles)) result.profiles = profiles.filter(p => typeof p === 'string');
    else if (typeof profiles === 'string') result.profiles = [profiles];
  }
  result.hasData = 'data' in data;
  result.hasIncluded = Array.isArray(data.included) && data.included.length > 0;
  const resources = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
  result.hasRelationships = resources.some(r => r && typeof r === 'object' && r.relationships);
  result.hasErrors = Array.isArray(data.errors) && data.errors.length > 0;
  if (result.hasErrors) {
    result.verboseErrors = data.errors.some(
      e => e && (e.meta || e.source || (typeof e.detail === 'string' && e.detail.length > 120))
    );
  }
  return result;
}

/**
 * Fingerprint likely framework from JSON:API signals.
 * @param {object} analysis output of analyzeJsonApiDocument
 * @returns {string|null} framework hint
 */
export function fingerprintFramework(analysis = {}) {
  if (!analysis.detected) return null;
  if (analysis.profiles.some(p => /atomic/i.test(p)))
    return 'JSON:API Atomic Operations profile in use';
  if (analysis.version === '1.1') return 'JSON:API v1.1 server (modern implementation)';
  if (analysis.version === '1.0') return 'JSON:API v1.0 server';
  return 'JSON:API server (version not advertised)';
}

/**
 * Probe an endpoint for JSON:API behavior.
 * @param {string} url
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} { url, contentType, document, frameworkHint, error }
 */
export async function probeJsonApi(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, contentType: null, document: null, frameworkHint: null, error: null };
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/vnd.api+json' },
    });
    const headers = {};
    res.headers?.forEach?.((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    outcome.contentType = analyzeJsonApiContentType(headers['content-type']);
    const text = await res.text();
    outcome.document = analyzeJsonApiDocument(text);
    outcome.frameworkHint = fingerprintFramework(outcome.document);
    outcome.status = res.status;
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize JSON:API detection as a hardening note.
 * @param {object[]} probes
 * @returns {string|null}
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter(p => p.document?.detected || p.contentType?.isJsonApi);
  if (exposed.length === 0) return null;
  const lines = exposed.map(p => {
    const d = p.document || {};
    const bits = [];
    if (d.version) bits.push(`v${d.version}`);
    if (d.profiles?.length) bits.push(`profiles: ${d.profiles.join(', ')}`);
    if (p.frameworkHint) bits.push(p.frameworkHint);
    if (d.verboseErrors) bits.push('verbose error objects');
    return `- ${p.url}: JSON:API detected (${bits.join('; ') || 'no version advertised'})`;
  });
  return `JSON:API surface fingerprinted:\n${lines.join('\n')}\nRecommendation: keep error objects minimal (no stack traces or internal meta) and authorize relationship/included expansion.`;
}
