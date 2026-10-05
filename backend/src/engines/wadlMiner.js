/**
 * wadlMiner.js — WADL resource host extractor.
 *
 * Parses Web Application Description Language (WADL) documents and extracts
 * the resource base URLs plus every nested resource path and HTTP method,
 * reconstructing the advertised REST surface of an application.
 * Pure text analysis: the caller supplies the fetched WADL document.
 *
 * Defensive use: authorized asset discovery — enumerating the REST API
 * surface a target publicly documents so reviews can cover it.
 */

const RESOURCES_BASE_RE =
  /<\s*(?:[\w.-]+:)?resources\b[^>]*?\bbase\s*=\s*["']([^"']+)["']/i;
const RESOURCE_PATH_RE =
  /<\s*(?:[\w.-]+:)?resource\b[^>]*?\bpath\s*=\s*["']([^"']+)["'][^>]*>/gi;
const METHOD_RE =
  /<\s*(?:[\w.-]+:)?method\b[^>]*?\bname\s*=\s*["']([A-Za-z]+)["'][^>]*>/gi;
const METHOD_ID_RE =
  /<\s*(?:[\w.-]+:)?method\b[^>]*?\bid\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Extract the base URL declared on the <resources> element.
 *
 * @param {string} wadlText - Raw WADL document text.
 * @returns {string|null}
 */
export function extractBase(wadlText) {
  if (typeof wadlText !== 'string') return null;
  const m = RESOURCES_BASE_RE.exec(wadlText);
  return m ? m[1].trim() : null;
}

/**
 * Extract resource paths in document order.
 *
 * @param {string} wadlText - Raw WADL document text.
 * @returns {string[]}
 */
export function extractPaths(wadlText) {
  if (typeof wadlText !== 'string') return [];
  const out = [];
  let m;
  RESOURCE_PATH_RE.lastIndex = 0;
  while ((m = RESOURCE_PATH_RE.exec(wadlText)) !== null) out.push(m[1]);
  return out;
}

/**
 * Extract declared HTTP methods (name + optional id).
 *
 * @param {string} wadlText - Raw WADL document text.
 * @returns {{ method: string, id: string|null }[]}
 */
export function extractMethods(wadlText) {
  if (typeof wadlText !== 'string') return [];
  const names = [];
  const ids = [];
  let m;
  METHOD_RE.lastIndex = 0;
  while ((m = METHOD_RE.exec(wadlText)) !== null) names.push(m[1].toUpperCase());
  METHOD_ID_RE.lastIndex = 0;
  while ((m = METHOD_ID_RE.exec(wadlText)) !== null) ids.push(m[1]);
  return names.map((method, i) => ({ method, id: ids[i] ?? null }));
}

/**
 * Join a base URL with a relative resource path.
 *
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
export function joinUrl(base, path) {
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const b = base.replace(/\/+$/, '');
  const p = String(path).replace(/^\/+/, '');
  return `${b}/${p}`;
}

/**
 * Full analysis of a fetched WADL document.
 *
 * @param {{ url?: string, wadlText: string }} input
 * @returns {{ type: string, confidence: string, base: string|null, host: string|null, paths: string[], methods: object[], fullUrls: string[], evidence: string }}
 */
export function analyzeWadl({ url = '', wadlText = '' } = {}) {
  const text = typeof wadlText === 'string' ? wadlText : '';
  const base = extractBase(text);
  const paths = extractPaths(text);
  const methods = extractMethods(text);
  const fullUrls = paths.map((p) => joinUrl(base, p));

  let host = null;
  if (base) {
    try {
      host = new URL(base).hostname;
    } catch {
      host = null;
    }
  }

  return {
    type: 'WADL Resource Host Extraction',
    confidence: base || paths.length ? 'high' : 'low',
    base,
    host,
    paths,
    methods,
    fullUrls,
    evidence:
      paths.length > 0
        ? `WADL${url ? ` at ${url}` : ''} declares base '${base ?? '(none)'}' with ${paths.length} resource path(s) and ${methods.length} method(s)${host ? ` on host ${host}` : ''}.`
        : `No WADL resources found${url ? ` at ${url}` : ''}.`,
  };
}

export const WADL_MINER = { extractBase, extractPaths, extractMethods, joinUrl, analyzeWadl };
export default WADL_MINER;
