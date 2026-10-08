/**
 * API/Swagger fuzzing — discover the OpenAPI/Swagger document, enumerate
 * paths + parameters, then fuzz parameters with safe probes and turn
 * anomalous responses into normalized findings.
 *
 * Probes are DETECTION-ONLY: error-based SQLi markers, reflected XSS canaries,
 * and type-confusion values. No destructive payloads, no auth bypass attempts
 * beyond reading the doc the server itself publishes.
 */

import { isLoopbackUrl } from './netGuard.js';

const DOC_PATHS = [
  '/openapi.json',
  '/swagger.json',
  '/api/openapi.json',
  '/api/swagger.json',
  '/v3/api-docs',
  '/api-docs',
  '/swagger/v1/swagger.json',
];

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Discover a Swagger/OpenAPI document on the target. */
export async function discoverSwagger(
  baseUrl,
  { timeoutMs = 10_000, enforceLoopback = true } = {}
) {
  if (enforceLoopback && !isLoopbackUrl(baseUrl)) {
    throw new Error(`discoverSwagger refused: ${baseUrl} is not loopback (safety)`);
  }
  const base = baseUrl.replace(/\/+$/, '');
  for (const p of DOC_PATHS) {
    const doc = await fetchJson(`${base}${p}`, timeoutMs);
    if (doc && (doc.openapi || doc.swagger || doc.paths)) {
      return { found: true, docUrl: `${base}${p}`, doc };
    }
  }
  return { found: false, docUrl: null, doc: null };
}

/** Enumerate {method, path, params[]} from an OpenAPI/Swagger document. */
export function enumerateApiPaths(doc) {
  const out = [];
  const paths = doc?.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) continue;
      const params = [];
      const pushParam = p => {
        if (!p || typeof p !== 'object') return;
        params.push({
          name: p.name,
          in: p.in || p.paramType || 'query',
          required: !!p.required,
          type: p.type || p.schema?.type || 'string',
        });
      };
      (op.parameters || []).forEach(pushParam);
      (methods.parameters || []).forEach(pushParam);
      out.push({ method: method.toUpperCase(), path, params, operationId: op.operationId || null });
    }
  }
  return out;
}

/** Fill path templates: /users/{id} → /users/1 */
export function concretizePath(path, params) {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const p = params.find(x => x.name === name);
    return p ? '1' : '1';
  });
}

const PROBES = [
  {
    name: 'sqli-error',
    value: `'`,
    detect: /sql syntax|mysql|pg_query|ORA-|sqlite|unclosed quotation|odbc.*driver/i,
    type: 'sql-injection',
    severity: 'high',
    confidence: 0.7,
  },
  {
    name: 'xss-canary',
    value: `<dmxss>alert(1)</dmxss>`,
    detect: /<dmxss>alert\(1\)<\/dmxss>/,
    type: 'reflected-xss',
    severity: 'medium',
    confidence: 0.8,
  },
  {
    name: 'type-confusion',
    value: `{"$ne":null}`,
    detect: /error|exception|stack trace/i,
    type: 'type-confusion',
    severity: 'low',
    confidence: 0.4,
  },
];

/**
 * Fuzz enumerated API params. For each (method, path, query param): send the
 * probe values and flag reflections / SQL error markers in the response.
 * Returns normalized findings.
 */
export async function fuzzApiParams(
  baseUrl,
  apiPaths,
  { timeoutMs = 10_000, enforceLoopback = true, maxParams = 40, authToken = null } = {}
) {
  if (enforceLoopback && !isLoopbackUrl(baseUrl)) {
    throw new Error(`fuzzApiParams refused: ${baseUrl} is not loopback (safety)`);
  }
  const base = baseUrl.replace(/\/+$/, '');
  const findings = [];
  const tested = [];
  let paramBudget = maxParams;

  const send = async (method, url, query) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers = {};
      if (authToken) headers.authorization = `Bearer ${authToken}`;
      const res = await fetch(url, { method, headers, signal: ctrl.signal });
      return { status: res.status, body: await res.text() };
    } catch (e) {
      return { status: 0, body: '', error: e.message };
    } finally {
      clearTimeout(t);
    }
  };

  for (const api of apiPaths) {
    const queryParams = api.params.filter(p => p.in === 'query' || p.in === 'querystring');
    for (const param of queryParams) {
      if (paramBudget-- <= 0) break;
      for (const probe of PROBES) {
        const url = `${base}${concretizePath(api.path, api.params)}?${encodeURIComponent(param.name)}=${encodeURIComponent(probe.value)}`;
        const { status, body } = await send(api.method, url);
        tested.push({ url, probe: probe.name, status });
        if (status > 0 && probe.detect.test(body)) {
          findings.push({
            type: probe.type,
            title: `${probe.type === 'sql-injection' ? 'Possible SQL injection' : probe.type === 'reflected-xss' ? 'Reflected XSS' : 'Anomalous API response'}: ${api.method} ${api.path} param '${param.name}' (${probe.name})`,
            severity: probe.severity,
            url,
            evidence: {
              method: api.method,
              path: api.path,
              param: param.name,
              probe: probe.name,
              probeValue: probe.value,
              responseStatus: status,
              responseExcerpt: body.slice(0, 1500),
            },
            confidence: probe.confidence,
            source: 'api-fuzzer',
          });
          break; // one finding per param — don't stack probes
        }
      }
    }
    if (paramBudget <= 0) break;
  }
  return { findings, tested: tested.length };
}

/** One-call: discover → enumerate → fuzz. */
export async function swaggerFuzzLoop(baseUrl, opts = {}) {
  const discovered = await discoverSwagger(baseUrl, opts);
  if (!discovered.found) return { found: false, findings: [], tested: 0 };
  const apiPaths = enumerateApiPaths(discovered.doc);
  const { findings, tested } = await fuzzApiParams(baseUrl, apiPaths, opts);
  return { found: true, docUrl: discovered.docUrl, apiPaths: apiPaths.length, findings, tested };
}
