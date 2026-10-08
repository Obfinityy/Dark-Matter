/**
 * sourceMapHunter.js — Source-map chaining and hidden source-map discovery.
 *
 * Published source maps are build metadata that sites put on the web on
 * purpose; for an authorized bug-bounty hunt they are legitimate leads to
 * original file names, unminified routes and developer comments. This engine
 * stays purely in string parsing: the caller does the fetching from the
 * authorized target, so the functions are pure, testable and safe to run
 * anywhere.
 *
 * Ideas covered:
 *  00681 Source-map URL-reference chaining — follow sourceMappingURL chains
 *          across chunks to collect every map the app publishes.
 *  00682 Hidden source-map discovery — probe for .map files even when the
 *          reference comment is stripped, using predictable names.
 */

import { findSourceMapRefs } from './sourceMapRecovery.js';

/**
 * Resolve a sourceMappingURL reference against the chunk URL it was found in.
 *
 * @param {string} ref The raw reference from the sourceMappingURL comment.
 * @param {string} chunkUrl The URL of the chunk the reference was found in.
 * @returns {string|null} Absolute map URL, or null when not resolvable.
 */
export function resolveMapUrl(ref, chunkUrl) {
  if (!ref || !chunkUrl) return null;
  const r = String(ref).trim();
  if (r.startsWith('data:')) return null; // inline maps have no URL
  try {
    if (/^https?:\/\//i.test(r)) return r;
    if (r.startsWith('//')) {
      const proto = new URL(chunkUrl).protocol;
      return proto + r;
    }
    return new URL(r, chunkUrl).href;
  } catch {
    return null;
  }
}

/**
 * Scan one chunk's text for sourceMappingURL references and resolve them.
 *
 * @param {string} chunkUrl URL of the chunk.
 * @param {string} chunkText Bundle text of the chunk.
 * @returns {{chunkUrl: string, refs: Array<{ref: string, mapUrl: string|null, kind: string}>}}
 */
export function collectChunkMapRefs(chunkUrl, chunkText) {
  const refs = [];
  for (const { ref, kind } of findSourceMapRefs(chunkText)) {
    refs.push({ ref, kind, mapUrl: resolveMapUrl(ref, chunkUrl) });
  }
  return { chunkUrl, refs };
}

/**
 * Follow sourceMappingURL chains across every chunk of an app (idea 00681).
 * Each chunk is scanned for its map references; references are resolved to
 * absolute map URLs so the caller can fetch them from the authorized target.
 *
 * @param {Array<{url: string, text: string}>} chunks Chunk URLs with their text.
 * @returns {{maps: Array<{chunkUrl: string, ref: string, mapUrl: string|null, kind: 'inline'|'external'}>, mapUrls: string[], inlineRefs: string[]}}
 */
export function chainSourceMapRefs(chunks) {
  const maps = [];
  const seen = new Set();
  const inlineRefs = [];
  for (const { url, text } of chunks || []) {
    for (const { ref, kind } of findSourceMapRefs(text)) {
      if (seen.has(url + '|' + ref)) continue;
      seen.add(url + '|' + ref);
      if (kind === 'inline') {
        inlineRefs.push(ref);
        maps.push({ chunkUrl: url, ref, mapUrl: null, kind });
      } else {
        maps.push({ chunkUrl: url, ref, mapUrl: resolveMapUrl(ref, url), kind });
      }
    }
  }
  const mapUrls = [...new Set(maps.filter(m => m.mapUrl).map(m => m.mapUrl))];
  return { maps, mapUrls, inlineRefs };
}

/** Strip a content-hash segment (e.g. app.a1b2c3d4.js) from a filename. */
const HASH_SEGMENT_RE = /\.[0-9a-f]{8,32}(?=\.(?:js|mjs|cjs|css|ts)$)/i;

/**
 * Predict hidden .map file names for a chunk whose reference comment was
 * stripped (idea 00682). Generates the predictable candidates used by common
 * bundlers: the same filename with `.map` appended, plus de-hashed and
 * bundler-specific variants.
 *
 * @param {string} chunkUrl URL of the JS/CSS chunk.
 * @returns {string[]} Candidate map URLs, most likely first.
 */
export function predictHiddenMapNames(chunkUrl) {
  if (!chunkUrl) return [];
  const out = [];
  const push = u => {
    if (u && !out.includes(u)) out.push(u);
  };
  push(chunkUrl + '.map');
  try {
    const url = new URL(chunkUrl);
    // De-hashed variant: app.a1b2c3.js -> app.js.map
    const dehashed = url.pathname.replace(HASH_SEGMENT_RE, '');
    if (dehashed !== url.pathname) push(url.origin + dehashed + '.map');
    // Bundler-specific: Next.js .map served beside chunk; webpack
    // sometimes drops the hash entirely for the map lookup.
    const base = url.pathname.replace(/\.(js|mjs|cjs|css)$/i, '');
    push(url.origin + base + '.map');
    // Some pipelines keep the comment-stripped map under a /maps/ dir.
    push(url.origin + '/maps' + url.pathname + '.map');
  } catch {
    // Non-absolute URL: filename-only candidates.
    const noQuery = chunkUrl.split(/[?#]/)[0];
    const dehashed = noQuery.replace(HASH_SEGMENT_RE, '');
    if (dehashed !== noQuery) push(dehashed + '.map');
    push(noQuery.replace(/\.(js|mjs|cjs|css)$/i, '') + '.map');
  }
  return out;
}

/**
 * Score how likely a fetched response is a real published source map rather
 * than an error page, without parsing the whole payload (caller provides the
 * first bytes or the full body).
 *
 * @param {string} body Response body (or head of it).
 * @returns {{looksLikeMap: boolean, confidence: 'high'|'medium'|'low', signals: string[]}}
 */
export function scoreMapLikelihood(body) {
  const text = String(body || '').trimStart();
  const signals = [];
  if (/^[\s]*\{/.test(text)) signals.push('json-object');
  if (/"version"\s*:\s*3/.test(text)) signals.push('sourcemap-version-3');
  if (/"mappings"\s*:/.test(text)) signals.push('mappings-field');
  if (/"sources"\s*:\s*\[/.test(text)) signals.push('sources-array');
  if (/"sourcesContent"\s*:\s*\[/.test(text)) signals.push('sources-content');
  const confidence = signals.length >= 3 ? 'high' : signals.length === 2 ? 'medium' : 'low';
  return { looksLikeMap: signals.length >= 2, confidence, signals };
}

export const SOURCE_MAP_HUNTER = {
  ideas: ['00681', '00682'],
  description: 'Source-map URL-reference chaining and hidden .map discovery.',
};

export default SOURCE_MAP_HUNTER;
