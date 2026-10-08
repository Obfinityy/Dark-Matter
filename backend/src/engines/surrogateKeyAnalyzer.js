/**
 * surrogateKeyAnalyzer.js — surrogate-key header analysis.
 *
 * Idea 00897: analyze surrogate keys for cache-group naming.
 *
 * No network calls: the module parses operator-supplied Surrogate-Key /
 * Surrogate-Control response headers and analyses the key naming
 * conventions — prefixes, segments, cardinality — to reveal how the
 * target groups its cacheable content. Useful authorized-recon signal for
 * understanding content taxonomy without touching the live site further.
 */

/**
 * Extract surrogate keys from a response-header object.
 * @param {object} headers
 * @returns {string[]}
 */
export function parseSurrogateKeys(headers = {}) {
  const keys = [];
  for (const [name, value] of Object.entries(headers)) {
    const lower = String(name).toLowerCase();
    if (lower === 'surrogate-key' || lower === 'surrogate-keys' || lower === 'cache-tag') {
      const raw = Array.isArray(value) ? value.join(' ') : String(value);
      for (const part of raw.split(/[\s,]+/)) {
        const k = part.trim();
        if (k) keys.push(k);
      }
    }
  }
  return [...new Set(keys)];
}

/**
 * Parse a Surrogate-Control header into a directive map.
 * @param {string|null} value
 */
export function parseSurrogateControl(value) {
  const directives = {};
  if (!value) return directives;
  for (const part of String(value).split(',')) {
    const [k, v] = part.trim().split('=').map(s => s.trim());
    if (!k) continue;
    directives[k.toLowerCase()] = v === undefined ? true : v.replace(/^"|"$/g, '');
  }
  return directives;
}

/**
 * Analyse naming conventions across a key set.
 * @param {string[]} keys
 */
export function analyzeKeyNaming(keys = []) {
  const separators = ['-', '_', '.', ':', '/'];
  const prefixCounts = {};
  const segmentLengthHist = {};
  const separatorUsage = {};
  let withSeparators = 0;
  for (const key of keys) {
    const sep = separators.find(s => key.includes(s));
    if (sep) {
      withSeparators++;
      separatorUsage[sep] = (separatorUsage[sep] || 0) + 1;
      const prefix = key.split(sep)[0].toLowerCase();
      prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
      const segs = key.split(sep).length;
      segmentLengthHist[segs] = (segmentLengthHist[segs] || 0) + 1;
    } else {
      prefixCounts['(flat)'] = (prefixCounts['(flat)'] || 0) + 1;
    }
  }
  const topPrefixes = Object.entries(prefixCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([prefix, count]) => ({ prefix, count }));
  return {
    topPrefixes,
    separatorUsage,
    segmentLengthHist,
    structuredRatio: keys.length ? withSeparators / keys.length : 0,
  };
}

/**
 * Full analysis across many responses: per-URL keys plus global naming.
 * @param {{url: string, headers: object}[]} responses
 */
export function analyzeSurrogateKeys(responses = []) {
  const perUrl = [];
  const allKeys = new Set();
  const keyToUrls = new Map();
  for (const { url = '', headers = {} } of responses) {
    const keys = parseSurrogateKeys(headers);
    const control = parseSurrogateControl(
      headers['surrogate-control'] || headers['Surrogate-Control'] || null,
    );
    for (const k of keys) {
      allKeys.add(k);
      if (!keyToUrls.has(k)) keyToUrls.set(k, new Set());
      keyToUrls.get(k).add(url);
    }
    perUrl.push({ url, keys, keyCount: keys.length, surrogateControl: control });
  }
  const sharedKeys = [...keyToUrls.entries()]
    .filter(([, urls]) => urls.size > 1)
    .map(([key, urls]) => ({ key, urlCount: urls.size }))
    .sort((a, b) => b.urlCount - a.urlCount)
    .slice(0, 20);
  return {
    perUrl,
    naming: analyzeKeyNaming([...allKeys]),
    sharedKeys,
    stats: {
      responses: responses.length,
      responsesWithKeys: perUrl.filter(p => p.keyCount > 0).length,
      uniqueKeys: allKeys.size,
      sharedKeys: sharedKeys.length,
    },
  };
}

/**
 * Build a report finding from the analysis result.
 * @param {ReturnType<typeof analyzeSurrogateKeys>} result
 */
export function surrogateKeyFinding(result) {
  return {
    title: `Surrogate-key analysis — ${result.stats.uniqueKeys} key(s) reveal cache-group naming`,
    severity: 'Info',
    confidence: result.stats.uniqueKeys >= 5 ? 'high' : 'medium',
    stats: result.stats,
    topPrefixes: result.naming.topPrefixes,
    sharedKeys: result.sharedKeys,
    evidence:
      `${result.stats.responsesWithKeys}/${result.stats.responses} response(s) carry ` +
      `surrogate keys; ${result.stats.sharedKeys} key(s) group multiple URLs.`,
  };
}

export const SURROGATE_KEY_ANALYZER = {
  parseSurrogateKeys,
  parseSurrogateControl,
  analyzeKeyNaming,
  analyzeSurrogateKeys,
  surrogateKeyFinding,
};
export default SURROGATE_KEY_ANALYZER;
