/**
 * httpMethodEnumerator.js — HTTP method enumeration analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00403: map the allowed HTTP methods (GET, POST,
 * PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE) per endpoint from observed
 * probe results, so dangerous verbs (PUT, DELETE, TRACE) surface as findings.
 *
 * During an authorized engagement the caller sends one benign request per
 * method to each endpoint and records the status code. This module is pure
 * analysis of those recorded observations: it normalizes per-method results,
 * decides which verbs the endpoint accepts, and rates the exposure. No
 * requests are sent by this module.
 */

/** Canonical list of HTTP methods considered during enumeration. */
export const ENUMERATED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'TRACE',
];

/**
 * Risk rating for a method being accepted by an endpoint.
 * @param {string} method HTTP method name.
 * @returns {'critical'|'high'|'medium'|'low'|'info'}
 */
export function methodRisk(method) {
  const m = String(method || '').toUpperCase();
  if (m === 'TRACE') return 'critical';
  if (m === 'PUT' || m === 'DELETE') return 'high';
  if (m === 'PATCH') return 'medium';
  if (m === 'OPTIONS') return 'low';
  return 'info';
}

/**
 * Normalize a single recorded method probe into a canonical observation.
 * @param {object} probe { method?: string, path?: string, status?: number, allowHeader?: string }.
 * @returns {{method:string, path:string, status:number|null, allowHeader:string|null}}
 */
export function normalizeProbe(probe) {
  const p = probe && typeof probe === 'object' ? probe : {};
  return {
    method: String(p.method || '').toUpperCase(),
    path: typeof p.path === 'string' ? p.path : '/',
    status: typeof p.status === 'number' ? p.status : null,
    allowHeader: typeof p.allowHeader === 'string' ? p.allowHeader : null,
  };
}

/**
 * Decide whether a recorded status code means the method was accepted.
 * 2xx and 3xx accept; 401/403 accept-but-protected; 404/405 reject.
 * @param {number|null} status Recorded status code.
 * @returns {'accepted'|'protected'|'rejected'|'unknown'}
 */
export function classifyMethodStatus(status) {
  if (status == null) return 'unknown';
  if (status >= 200 && status < 400) return 'accepted';
  if (status === 401 || status === 403) return 'protected';
  if (status === 404 || status === 405 || status === 501) return 'rejected';
  return 'unknown';
}

/**
 * Build the per-endpoint method map from normalized probe observations.
 * @param {Array<object>} probes Raw probe records (see normalizeProbe).
 * @returns {Array<{path:string, methods:Record<string,{status:number|null,verdict:string,risk:string}>, allowed:string[], findings:Array<{method:string, risk:string, detail:string}>}>}
 */
export function enumerateMethods(probes) {
  const list = Array.isArray(probes) ? probes : [];
  const byPath = new Map();
  for (const raw of list) {
    const p = normalizeProbe(raw);
    if (!p.method || !ENUMERATED_METHODS.includes(p.method)) continue;
    if (!byPath.has(p.path)) byPath.set(p.path, new Map());
    byPath.get(p.path).set(p.method, p);
  }
  const out = [];
  for (const [path, methods] of byPath) {
    const methodMap = {};
    const allowed = [];
    const findings = [];
    for (const method of ENUMERATED_METHODS) {
      const obs = methods.get(method);
      const status = obs ? obs.status : null;
      const verdict = classifyMethodStatus(status);
      const risk = methodRisk(method);
      methodMap[method] = { status, verdict, risk };
      if (verdict === 'accepted' || verdict === 'protected') {
        allowed.push(method);
        if (risk === 'critical' || risk === 'high') {
          findings.push({
            method,
            risk,
            detail: `${method} ${verdict === 'protected' ? 'is accepted but access-controlled' : 'is accepted'} on ${path} (HTTP ${status})`,
          });
        }
      }
    }
    out.push({ path, methods: methodMap, allowed, findings });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Compare method maps across endpoints to spot inconsistent verb handling,
 * which often indicates per-route middleware gaps.
 * @param {Array<{path:string, allowed:string[]}>} endpointMaps Output of enumerateMethods.
 * @returns {Array<{method:string, paths:string[], note:string}>}
 */
export function compareMethodsAcrossPaths(endpointMaps) {
  const list = Array.isArray(endpointMaps) ? endpointMaps : [];
  const byMethod = new Map();
  for (const ep of list) {
    for (const m of ep.allowed || []) {
      if (!byMethod.has(m)) byMethod.set(m, []);
      byMethod.get(m).push(ep.path);
    }
  }
  const notes = [];
  for (const [method, paths] of byMethod) {
    if (paths.length > 0 && paths.length < list.length) {
      notes.push({
        method,
        paths,
        note: `${method} is accepted on ${paths.length} of ${list.length} endpoints — inconsistent verb handling across routes`,
      });
    }
  }
  return notes;
}
