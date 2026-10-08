/**
 * sourceMapRecovery.js — Source-map original-source recovery for attack-surface mapping.
 *
 * Sites sometimes publish source maps next to minified bundles. For an
 * authorized bug-bounty hunt, a published map is legitimate build metadata:
 * it reveals original file names, unminified route strings and developer
 * comments — exactly the leads needed to enumerate hidden routes.
 *
 * Idea covered:
 *  - 680 Source-map original-source recovery
 *
 * All functions are pure: they operate on an already-observed source map
 * (fetched from the authorized target) or on bundle text. No requests are
 * made here. Implements the Source Map v3 spec (base64 VLQ mappings).
 */

const VLQ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VLQ_TABLE = {};
for (let i = 0; i < VLQ_CHARS.length; i++) VLQ_TABLE[VLQ_CHARS[i]] = i;

/**
 * Find sourceMappingURL references in bundle text.
 * @param {string} jsText bundle JS text observed on the target
 * @returns {Array<{ref:string, kind:'inline'|'external'}>}
 */
export function findSourceMapRefs(jsText) {
  const text = String(jsText || '');
  const out = [];
  const re = /(?:\/\/[#@]\s*|\/\*[#@]\s*)sourceMappingURL=([^\s*]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const ref = m[1].trim();
    out.push({
      ref,
      kind: ref.startsWith('data:') ? 'inline' : 'external',
    });
  }
  return out;
}

/**
 * Decode an inline (data: URI) source map reference to JSON text.
 * @param {string} ref data:application/json[;charset=utf-8][;base64],... reference
 * @returns {string|null} JSON text or null when not decodable
 */
export function decodeInlineSourceMap(ref) {
  const r = String(ref || '');
  if (!r.startsWith('data:')) return null;
  const comma = r.indexOf(',');
  if (comma < 0) return null;
  const meta = r.slice(5, comma);
  const payload = r.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      return Buffer.from(payload, 'base64').toString('utf8');
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/**
 * Parse and validate a Source Map v3 document.
 * @param {string|object} mapJson map JSON text or parsed object
 * @returns {{file:string|null, sources:string[], sourcesContent:(string|null)[], names:string[], mappings:string, hasSourcesContent:boolean}|null}
 */
export function parseSourceMap(mapJson) {
  const data = typeof mapJson === 'string' ? safeJson(mapJson) : mapJson;
  if (!data || typeof data !== 'object') return null;
  if (data.version !== 3) return null;
  if (!Array.isArray(data.sources) || typeof data.mappings !== 'string') return null;
  const sourcesContent = Array.isArray(data.sourcesContent) ? data.sourcesContent : [];
  return {
    file: typeof data.file === 'string' ? data.file : null,
    sources: data.sources.map(String),
    sourcesContent: data.sources.map((_, i) =>
      typeof sourcesContent[i] === 'string' ? sourcesContent[i] : null
    ),
    names: Array.isArray(data.names) ? data.names.map(String) : [],
    mappings: data.mappings,
    hasSourcesContent: sourcesContent.some(s => typeof s === 'string'),
  };
}

/**
 * Recover original sources from a parsed map (requires sourcesContent).
 * @param {object} map parsed map from parseSourceMap
 * @returns {Array<{source:string, content:string|null, recovered:boolean}>}
 */
export function recoverOriginalSources(map) {
  if (!map) return [];
  return map.sources.map((source, i) => ({
    source,
    content: map.sourcesContent[i] ?? null,
    recovered: map.sourcesContent[i] != null,
  }));
}

/**
 * Summarize a parsed map: counts of sources, recoverable sources, names.
 * @param {object} map parsed map
 * @returns {{sources:number, recoverable:number, names:number, file:string|null}|null}
 */
export function summarizeSourceMap(map) {
  if (!map) return null;
  return {
    sources: map.sources.length,
    recoverable: map.sourcesContent.filter(s => s != null).length,
    names: map.names.length,
    file: map.file,
  };
}

/**
 * Decode one base64-VLQ value starting at `start`.
 * @param {string} str
 * @param {number} start
 * @returns {{value:number, next:number}}
 */
export function decodeVlq(str, start) {
  let result = 0;
  let shift = 0;
  let i = start;
  for (;;) {
    if (i >= str.length) throw new Error('Truncated VLQ value');
    const digit = VLQ_TABLE[str[i++]];
    if (digit === undefined) throw new Error(`Invalid VLQ character: ${str[i - 1]}`);
    const continuation = digit & 32;
    result |= (digit & 31) << shift;
    shift += 5;
    if (!continuation) break;
  }
  const negative = result & 1;
  result >>= 1;
  return { value: negative ? -result : result, next: i };
}

/**
 * Parse one mappings line into segments.
 * Each segment: { genCol, src, srcLine, srcCol, name? } (0-based).
 * @param {string} line one ';'-separated mappings line
 * @returns {Array}
 */
export function parseMappingsLine(line) {
  const segments = [];
  if (!line) return segments;
  let src = 0;
  let srcLine = 0;
  let srcCol = 0;
  let name = 0;
  for (const seg of line.split(',')) {
    if (!seg) continue;
    let i = 0;
    const genColD = decodeVlq(seg, i);
    const genCol = genColD.value;
    i = genColD.next;
    const segment = { genCol };
    if (i < seg.length) {
      const d1 = decodeVlq(seg, i);
      src += d1.value;
      i = d1.next;
      const d2 = decodeVlq(seg, i);
      srcLine += d2.value;
      i = d2.next;
      const d3 = decodeVlq(seg, i);
      srcCol += d3.value;
      i = d3.next;
      segment.src = src;
      segment.srcLine = srcLine;
      segment.srcCol = srcCol;
      if (i < seg.length) {
        const d4 = decodeVlq(seg, i);
        name += d4.value;
        segment.name = name;
      }
    }
    segments.push(segment);
  }
  return segments;
}

/**
 * Map a generated (minified) position back to the original source position.
 * @param {object} map parsed map
 * @param {number} genLine 1-based generated line
 * @param {number} genCol 0-based generated column
 * @returns {{source:string, line:number, column:number, name:string|null}|null}
 */
export function originalPositionFor(map, genLine, genCol) {
  if (!map || !Number.isInteger(genLine) || genLine < 1) return null;
  const lines = map.mappings.split(';');
  if (genLine > lines.length) return null;
  const segments = parseMappingsLine(lines[genLine - 1]);
  let best = null;
  for (const seg of segments) {
    if (seg.src === undefined) continue; // unmapped segment
    if (seg.genCol <= genCol) best = seg;
    else break;
  }
  if (!best) return null;
  return {
    source: map.sources[best.src] ?? null,
    line: best.srcLine + 1,
    column: best.srcCol,
    name: best.name !== undefined ? (map.names[best.name] ?? null) : null,
  };
}

/**
 * Mine route-like strings from recovered source text: quoted path literals
 * ("/api/users", '/admin/panel') and route-ish comments.
 * @param {string} text original source content
 * @returns {string[]} unique candidate route paths
 */
export function extractRouteStrings(text) {
  const s = String(text || '');
  const found = new Set();
  // Quoted absolute paths: "/api/users", '/admin', `/v1/things`
  const pathRe = /["'`](\/[\/A-Za-z0-9_.$~!*();:@&=+,\-?%#[\]{}|^]*?)["'`]/g;
  let m;
  while ((m = pathRe.exec(s)) !== null) {
    const p = m[1];
    // Keep plausible routes: at least one letter segment, not a file asset or URL
    if (/^\/[a-zA-Z]/.test(p) && !/\.(js|css|png|jpg|svg|woff2?|map|ico|json)(\?|#|$)/i.test(p)) {
      found.add(p.split(/[?#]/)[0]);
    }
  }
  // Comments mentioning routes: // route: /x   /* path /y */
  const commentRe = /(?:route|path|endpoint)\s*[:=]\s*(\/[A-Za-z0-9_./-]+)/gi;
  while ((m = commentRe.exec(s)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

function safeJson(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

export const SOURCE_MAP_RECOVERY = {
  findSourceMapRefs,
  decodeInlineSourceMap,
  parseSourceMap,
  recoverOriginalSources,
  summarizeSourceMap,
  decodeVlq,
  parseMappingsLine,
  originalPositionFor,
  extractRouteStrings,
};

export default SOURCE_MAP_RECOVERY;
