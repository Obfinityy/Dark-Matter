/**
 * jsonRpcEnumerator.js — JSON-RPC method enumerator.
 *
 * Parses fetched JSON-RPC discovery responses (the endpoint itself returns
 * these: system.listMethods, rpc.discover, or batch error leaks) for:
 *  - disclosed method names that reveal backend service names
 *  - namespace/service prefixes grouped for scoping
 *  - sensitivity flags on admin/debug/internal-sounding methods
 *
 * Pure functions: takes parsed discovery JSON, returns structured intel.
 */

const SENSITIVE_METHOD_RE = /\b(admin|debug|internal|private|exec|eval|shell|system|config|backup|restore|shutdown|restart|deploy|migrate|secret|key|token|user|auth|password|billing|payment)\b/i;
const NAMESPACE_SPLIT_RE = /[._:]/;

/** Normalize discovery input: array, {result:[]}, or {methods:[]} shapes. */
export function normalizeDiscovery(input) {
  if (Array.isArray(input)) return input.filter(m => typeof m === 'string');
  if (input && typeof input === 'object') {
    if (Array.isArray(input.result)) return normalizeDiscovery(input.result);
    if (Array.isArray(input.methods)) return normalizeDiscovery(input.methods);
    if (input.result && typeof input.result === 'object') return normalizeDiscovery(input.result);
  }
  return [];
}

/** Group method names by their namespace prefix (before first . _ or :). */
export function groupByNamespace(methods = []) {
  const groups = new Map();
  for (const m of methods) {
    const parts = m.split(NAMESPACE_SPLIT_RE);
    const ns = parts.length > 1 ? parts[0] : '(none)';
    if (!groups.has(ns)) groups.set(ns, []);
    groups.get(ns).push(m);
  }
  return [...groups.entries()]
    .map(([namespace, names]) => ({ namespace, count: names.length, methods: names.sort() }))
    .sort((a, b) => b.count - a.count);
}

/** Flag methods whose names suggest admin/debug/backend functionality. */
export function flagSensitiveMethods(methods = []) {
  return methods
    .filter(m => SENSITIVE_METHOD_RE.test(m))
    .map(m => ({
      method: m,
      confidence: 'medium',
      note: 'Method name suggests privileged or backend functionality — worth manual review during authorized testing.',
    }));
}

/** Infer backend service candidates from namespace prefixes. */
export function inferBackendServices(groups = []) {
  return groups
    .filter(g => g.namespace !== '(none)')
    .map(g => ({
      service: g.namespace,
      methodCount: g.count,
      confidence: g.count >= 3 ? 'medium' : 'low',
      note: 'Namespace prefix from disclosed JSON-RPC methods; may correspond to a backend service.',
    }));
}

/** Parse batch-error responses that leak method names in error messages. */
export function extractMethodsFromErrors(responses = []) {
  const found = new Set();
  const list = Array.isArray(responses) ? responses : [responses];
  for (const r of list) {
    const err = r && r.error;
    if (!err) continue;
    const text = `${err.message || ''} ${err.data || ''}`;
    const m = text.match(/method\s+['"]?([A-Za-z][\w.:_-]*)['"]?/i)
      || text.match(/unknown\s+method\s+['"]?([A-Za-z][\w.:_-]*)['"]?/i)
      || text.match(/['"]([A-Za-z][\w]*[.:_][\w.:_-]*)['"]\s+(?:is\s+)?not\s+(?:a\s+)?(?:valid|known|registered)/i);
    if (m) found.add(m[1]);
  }
  return [...found];
}

/**
 * Enumerate a fetched JSON-RPC discovery result for backend service intel.
 * @param {object} input
 * @param {string} input.url - endpoint the discovery was fetched from
 * @param {object|Array} input.discovery - parsed discovery response (system.listMethods / rpc.discover)
 * @param {Array} [input.errorResponses] - batch error responses to mine for leaked names
 * @returns structured findings
 */
export function enumerateJsonRpc({ url = '', discovery = null, errorResponses = [] } = {}) {
  const methods = [...new Set([...normalizeDiscovery(discovery), ...extractMethodsFromErrors(errorResponses)])].sort();
  if (!methods.length) {
    return { url, type: 'JSON-RPC Method Enumeration', confidence: 'none', error: 'No methods disclosed in discovery response' };
  }
  const groups = groupByNamespace(methods);
  const sensitive = flagSensitiveMethods(methods);
  const services = inferBackendServices(groups);

  return {
    url,
    type: 'JSON-RPC Method Enumeration',
    confidence: sensitive.length || services.length ? 'medium' : 'low',
    evidence: `${methods.length} method(s) disclosed, grouped into ${groups.length} namespace(s), ${sensitive.length} flagged as sensitive-sounding.`,
    methodCount: methods.length,
    methods,
    namespaces: groups,
    sensitiveMethods: sensitive,
    backendServiceCandidates: services,
  };
}

export const JSON_RPC_ENUMERATOR = {
  normalizeDiscovery, groupByNamespace, flagSensitiveMethods, inferBackendServices,
  extractMethodsFromErrors, enumerateJsonRpc,
};
export default JSON_RPC_ENUMERATOR;
