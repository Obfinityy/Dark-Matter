/**
 * enumerationSurfaceRecon.js — autocomplete / typeahead / search-index enumeration mapping.
 *
 * Ideas 01232–01234: harvest `/suggest`-style autocomplete endpoints, sweep
 * typeahead prefixes systematically, and map which fields a search index
 * exposes — because suggest indexes and indexed search fields are enumerable
 * dictionaries of real data (names, emails, titles) on authorized targets.
 *
 * Pure planning and response classification — no network calls are made here;
 * the operator's HTTP layer executes the generated plans and feeds observed
 * responses back into the analyzers and the deterministic aggregator.
 */

const COMMON_SUGGEST_ROUTES = [
  '/api/suggest', '/api/search/suggest', '/api/autocomplete',
  '/suggest', '/search/suggest', '/api/typeahead', '/typeahead',
  '/api/users/suggest', '/api/lookup', '/api/search/autocomplete',
];

const COMMON_QUERY_KEYS = ['q', 'query', 'term', 'keyword', 'search', 'prefix', 'text'];

export const SUGGEST_ROUTES = COMMON_SUGGEST_ROUTES;
export const SUGGEST_QUERY_KEYS = COMMON_QUERY_KEYS;

const PII_PATTERNS = [
  { field: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { field: 'phone', regex: /\+?\d[\d\s().-]{6,}\d/ },
];

/**
 * Build a harvesting plan for autocomplete endpoints on the target.
 * @param {object} [options]
 * @param {string[]} [options.routes] - Candidate suggest routes.
 * @param {string[]} [options.queryKeys] - Candidate query parameter names.
 * @returns {{probes: {method: string, path: string, query: Record<string,string>}[], strategy: string}}
 */
export function harvestAutocompleteEndpoints(options = {}) {
  const routes = options.routes || COMMON_SUGGEST_ROUTES;
  const queryKeys = options.queryKeys || COMMON_QUERY_KEYS;
  const probes = [];
  for (const path of routes) {
    for (const key of queryKeys) {
      probes.push({ method: 'GET', path, query: { [key]: 'a' } });
    }
  }
  return {
    probes,
    strategy:
      'Probe candidate suggest routes with a one-character prefix across ' +
      'common query keys; a 2xx JSON response containing an array of strings ' +
      'or labeled objects marks a live typeahead endpoint.',
  };
}

/**
 * Build a systematic typeahead prefix sweep plan (a-z first, then digraphs).
 * @param {string} path - The live suggest endpoint path.
 * @param {string} [queryKey='q']
 * @param {object} [options]
 * @param {boolean} [options.includeDigraphs=true] - Also emit aa..zz prefixes.
 * @param {number} [options.batchSize=10] - Prefixes per batch for pacing.
 * @returns {{endpoint: string, queryKey: string, prefixes: string[], batches: string[][], strategy: string}}
 */
export function sweepTypeaheadEnumeration(path, queryKey = 'q', options = {}) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const prefixes = [...letters];
  if (options.includeDigraphs !== false) {
    for (const a of letters) for (const b of letters) prefixes.push(a + b);
  }
  const batchSize = options.batchSize || 10;
  const batches = [];
  for (let i = 0; i < prefixes.length; i += batchSize) {
    batches.push(prefixes.slice(i, i + batchSize));
  }
  return {
    endpoint: path,
    queryKey,
    prefixes,
    batches,
    strategy:
      'Walk the prefix space deterministically: all 26 single letters, then ' +
      'all 676 digraphs. Batched pacing keeps the sweep polite; the aggregator ' +
      'deduplicates overlapping suggestions into one dictionary.',
  };
}

/**
 * Extract candidate suggestion terms from a suggest response body.
 * @param {unknown} body
 * @returns {string[]}
 */
export function extractSuggestionTerms(body) {
  let json = body;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch { return []; }
  }
  const terms = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const k of ['label', 'name', 'value', 'title', 'text', 'term']) {
        if (typeof node[k] === 'string') terms.push(node[k]);
      }
      return Object.values(node).forEach(walk);
    }
    if (typeof node === 'string') terms.push(node);
  };
  walk(json);
  return [...new Set(terms.map(t => t.trim()).filter(t => t.length > 0))];
}

/**
 * Classify one typeahead probe response and note enumerable data exposure.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @param {string} prefix - The prefix that was probed.
 * @returns {{verdict: string, terms: string[], piiFields: string[], evidence: string}}
 */
export function analyzeTypeaheadResponse(response = {}, prefix = '') {
  const { status = 0, body = null } = response;
  if (status < 200 || status >= 300) {
    return { verdict: 'no-suggestions', terms: [], piiFields: [], evidence: `HTTP ${status} for prefix "${prefix}"` };
  }
  const terms = extractSuggestionTerms(body);
  if (!terms.length) {
    return { verdict: 'empty-dictionary', terms, piiFields: [], evidence: `HTTP ${status} for prefix "${prefix}"; no extractable terms` };
  }
  const joined = terms.join('\n');
  const piiFields = PII_PATTERNS.filter(p => p.regex.test(joined)).map(p => p.field);
  return {
    verdict: piiFields.length ? 'enumerable-pii' : 'enumerable',
    terms,
    piiFields,
    evidence: `HTTP ${status} for prefix "${prefix}"; ${terms.length} term(s) enumerated${piiFields.length ? `; PII-shaped fields: ${piiFields.join(', ')}` : ''}`,
  };
}

/**
 * Deterministically merge per-prefix analyses into one enumerated dictionary.
 * Merging is order-independent: identical response sets always yield the same
 * dictionary, regardless of the order responses arrive in.
 * @param {{prefix: string, terms: string[]}[]} analyses
 * @returns {{dictionary: string[], prefixHits: Record<string, number>, totalPrefixes: number}}
 */
export function aggregateTypeaheadDictionary(analyses = []) {
  const dict = new Map();
  const prefixHits = {};
  for (const { prefix = '', terms = [] } of analyses) {
    const unique = [...new Set(terms.map(t => String(t).trim()).filter(t => t.length > 0))];
    prefixHits[prefix] = unique.length;
    for (const term of unique) {
      dict.set(term, (dict.get(term) || 0) + 1);
    }
  }
  const dictionary = [...dict.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([term]) => term);
  return { dictionary, prefixHits, totalPrefixes: analyses.length };
}

/**
 * Build a search-index mapping plan: probe each candidate field name as a
 * search parameter to learn which fields are actually indexed.
 * @param {string} searchPath - e.g. '/api/search'.
 * @param {string[]} candidateFields - Field names to test as query keys.
 * @param {object} [options]
 * @param {string} [options.value='test'] - Probe value for each field.
 * @returns {{probes: {method: string, path: string, query: Record<string,string>, field: string}[], strategy: string}}
 */
export function mapSearchIndex(searchPath, candidateFields = [], options = {}) {
  const value = options.value || 'test';
  const probes = candidateFields.map(field => ({
    method: 'GET',
    path: searchPath,
    query: { [field]: value },
    field,
  }));
  return {
    probes,
    strategy:
      'Probe each candidate field as a search key; a 2xx response whose body ' +
      'echoes the field or returns filtered results marks the field indexed. ' +
      'Indexed fields are the enumerable subset of the record schema.',
  };
}

/**
 * Classify whether a field appears indexed based on one probe response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @param {string} field - The field that was probed.
 * @returns {{verdict: string, indexed: boolean, evidence: string}}
 */
export function classifySearchIndex(response = {}, field = '') {
  const { status = 0, body = null } = response;
  if (status < 200 || status >= 300) {
    return { verdict: 'not-indexed', indexed: false, evidence: `HTTP ${status} for field "${field}"` };
  }
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const mentionsField = text.toLowerCase().includes(field.toLowerCase());
  const looksFiltered = /"total"\s*:\s*[1-9]|"results"\s*:\s*\[(?!\s*\])/.test(text);
  if (mentionsField || looksFiltered) {
    return {
      verdict: 'indexed',
      indexed: true,
      evidence: `HTTP ${status} for field "${field}"; response ${mentionsField ? 'echoes the field' : 'carries filtered results'}`,
    };
  }
  return { verdict: 'not-indexed', indexed: false, evidence: `HTTP ${status} for field "${field}"; no indexed-field signal` };
}
