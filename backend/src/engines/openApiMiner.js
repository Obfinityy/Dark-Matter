/**
 * openApiMiner.js — OpenAPI / Swagger spec host extractor.
 *
 * Parses fetched OpenAPI 2.0/3.x documents (JSON) and extracts:
 *  - servers / base URLs (v3) or host + basePath (v2)
 *  - every documented path, keyed to the spec so nothing documented is missed
 *  - security-relevant signals: auth schemes, non-HTTPS servers, debug paths
 *
 * Pure functions: takes a parsed spec object, returns structured intel.
 */

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Normalize the spec whether given as object or raw JSON text. */
export function normalizeSpec(input) {
  if (typeof input === 'string') return safeJson(input);
  if (input && typeof input === 'object') return input;
  return null;
}

/** Extract server/base URLs from an OpenAPI v3 `servers` array. */
export function extractServers(spec) {
  const out = [];
  if (!spec || typeof spec !== 'object') return out;
  if (Array.isArray(spec.servers)) {
    for (const s of spec.servers) {
      if (!s || typeof s.url !== 'string') continue;
      out.push({ url: s.url, description: s.description || '', origin: 'servers[]' });
    }
  }
  // OpenAPI 2.0 fallback: host + basePath + schemes
  if (spec.swagger === '2.0' && spec.host) {
    const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) || 'https';
    out.push({
      url: `${scheme}://${spec.host}${spec.basePath || ''}`,
      description: 'swagger 2.0 host/basePath',
      origin: 'host+basePath',
    });
  }
  return out;
}

/** List every documented path, deduplicated and sorted. */
export function extractPaths(spec) {
  if (!spec || typeof spec !== 'object' || !spec.paths || typeof spec.paths !== 'object') return [];
  return Object.keys(spec.paths)
    .filter(p => p.startsWith('/'))
    .sort();
}

/** Pull operations per path: methods, summary, security, deprecation. */
export function extractOperations(spec) {
  const ops = [];
  if (!spec || typeof spec !== 'object' || !spec.paths) return ops;
  for (const [path, item] of Object.entries(spec.paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method))
        continue;
      ops.push({
        method: method.toUpperCase(),
        path,
        summary: (op && op.summary) || '',
        deprecated: Boolean(op && op.deprecated),
        secured:
          Boolean(op && op.security && op.security.length) ||
          Boolean(spec.security && spec.security.length),
      });
    }
  }
  return ops;
}

/** Flag security-relevant disclosures inside the spec. */
export function detectSensitiveSpecSignals(spec, servers = []) {
  const signals = [];
  for (const s of servers) {
    if (/^http:\/\//i.test(s.url) && !/localhost|127\.0\.0\.1/i.test(s.url)) {
      signals.push({
        kind: 'insecure-scheme',
        detail: `Server uses plain HTTP: ${s.url}`,
        confidence: 'medium',
      });
    }
    if (/\b(internal|staging|dev|test|corp)\b/i.test(s.url)) {
      signals.push({
        kind: 'nonprod-host',
        detail: `Non-production host documented: ${s.url}`,
        confidence: 'medium',
      });
    }
  }
  const paths = extractPaths(spec);
  for (const p of paths) {
    if (/debug|admin|console|internal|actuator/i.test(p)) {
      signals.push({
        kind: 'sensitive-path',
        detail: `Documented path looks sensitive: ${p}`,
        confidence: 'medium',
      });
    }
  }
  return signals;
}

/**
 * Mine a fetched OpenAPI/Swagger spec for host and route intel.
 * @param {object} input
 * @param {string} input.url - where the spec was fetched from (provenance)
 * @param {object|string} input.spec - parsed spec object or raw JSON text
 * @returns structured findings
 */
export function mineOpenApiSpec({ url = '', spec = null } = {}) {
  const doc = normalizeSpec(spec);
  if (!doc) {
    return {
      url,
      type: 'OpenAPI Spec Host Extraction',
      confidence: 'none',
      error: 'Could not parse spec as JSON',
    };
  }
  const servers = extractServers(doc);
  const paths = extractPaths(doc);
  const operations = extractOperations(doc);
  const signals = detectSensitiveSpecSignals(doc, servers);
  const version = doc.openapi || doc.swagger || 'unknown';

  return {
    url,
    type: 'OpenAPI Spec Host Extraction',
    confidence: servers.length || paths.length ? 'high' : 'low',
    evidence: `OpenAPI ${version}: ${servers.length} server(s), ${paths.length} path(s), ${operations.length} operation(s) documented.`,
    version,
    title: (doc.info && doc.info.title) || '',
    servers,
    paths,
    deprecatedCount: operations.filter(o => o.deprecated).length,
    unsecuredCount: operations.filter(o => !o.secured).length,
    signals,
  };
}

export const OPENAPI_MINER = {
  normalizeSpec,
  extractServers,
  extractPaths,
  extractOperations,
  detectSensitiveSpecSignals,
  mineOpenApiSpec,
};
export default OPENAPI_MINER;
