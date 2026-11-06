// Dark Matter rule-based scanner — OpenAPI inventory for pure-API targets.
//
// DIAGNOSIS (6 Nov 2026, param-battery skip diagnosis, parent-verified):
// the 28 skipped phases on Juice Shop / bWAPP / VAmPI mean zero
// param-bearing targets on the pasted page. Juice Shop is an SPA —
// the DOM form-discovery pass (domRender.js) covers it. VAmPI is the
// other half: a pure API. Its root returns JSON only, no HTML form can
// ever exist there, so neither static analysis nor DOM rendering can
// find a param. Its param surface lives in its OpenAPI spec
// (/openapi.json — proven live: the nuclei #253 'OpenAPI - Detect'
// template fires on VAmPI /openapi.json, 6 Nov 2026).
//
// MECHANISM: when the pasted page yielded zero param-bearing targets
// (after static + DOM + form synthesis), fetch the target's OpenAPI
// spec (read-only GET, same origin only), parse its GET operations'
// query + path parameters, and synthesise GET targets in the same
// shape the form-derived targets use. A path param is templated with
// a UNIQUE safe filler (never empty, never equal across params — the
// same read-only rule as toFormUrl in index.js) and mirrored as a
// query param carrying the same filler, so the existing param battery
// (which probes query params) runs against a real spec-derived
// endpoint. Path params are NOT fuzzed in the path segment itself —
// the battery only ever mutates query values, so path-segment
// injection stays an honest documented gap (a probe-point refactor,
// out of scope here); the battery now RUNS on real API endpoints and
// covers query-param reflection on them, which is strictly more than
// the 28 skipped phases it replaces.
//
// SCOPE: GET operations only. POST/PUT/DELETE operations never become
// targets (no writes to the target, ever). Header/cookie params are
// not probeable via URL and are skipped. An absent spec (or a spec
// with no probeable GET params) is an honest no-op — the pass records
// ok:true with 0 targets and the battery's own skipped records still
// describe the gap; a missing spec is NOT a failure.
//
// YAML specs (/openapi.yaml, /swagger.yaml) are NOT parsed: the repo
// carries no YAML dependency, and adding one for this pass would pull
// a parser into the probe path. JSON specs (/openapi.json,
// /swagger.json) cover the FastAPI/Swagger-UI conventions and VAmPI
// itself; YAML support is a documented follow-up.
import { randomBytes } from 'node:crypto';
import { fetchPage } from './fingerprint.js';

// JSON spec locations, probed in order. /openapi.json first: it is the
// location the nuclei #253 template already proves on VAmPI.
export const OPENAPI_SPEC_PATHS = ['/openapi.json', '/swagger.json'];
export const OPENAPI_MAX_TARGETS = 20;

/** Unique safe filler per param — same never-empty/never-equal rule as toFormUrl. */
function filler(n) {
  return `dmprobe${n}_${randomBytes(2).toString('hex')}`;
}

/**
 * Resolve a parameter object, following a local $ref to
 * #/components/parameters/<Name> one level. Returns the resolved
 * parameter, the parameter itself when it carries no $ref, or null
 * when the ref cannot be resolved (the param is skipped, never guessed).
 * Pure — exported for unit tests.
 */
export function resolveOpenApiParam(param, spec) {
  if (!param || typeof param !== 'object') return null;
  if (typeof param.$ref === 'string') {
    const m = /^#\/components\/parameters\/([^/]+)$/.exec(param.$ref);
    if (!m) return null;
    const components = spec && spec.components && spec.components.parameters;
    if (!components || typeof components !== 'object') return null;
    let name;
    try {
      name = decodeURIComponent(m[1]);
    } catch {
      return null;
    }
    const resolved = components[name];
    return resolved && typeof resolved === 'object' ? resolved : null;
  }
  return param;
}

/**
 * Extract probeable GET targets from a parsed OpenAPI spec object.
 * Pure — exported for unit tests. Returns { targets, operations, params }:
 * targets are absolute GET URLs (same origin as baseUrl), one per GET
 * operation carrying at least one query/path parameter; operations is
 * the count of such operations; params is the count of probeable
 * parameters across them. A spec without a paths object yields zero
 * targets. Paths with no GET operation, GET operations with no
 * query/path params, and non-GET operations are skipped silently.
 */
export function extractOpenApiTargets(spec, baseUrl) {
  const out = { targets: [], operations: 0, params: 0 };
  if (!spec || typeof spec !== 'object' || !spec.paths || typeof spec.paths !== 'object') {
    return out;
  }
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return out;
  }
  for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
    if (out.targets.length >= OPENAPI_MAX_TARGETS) break;
    if (!pathItem || typeof pathItem !== 'object') continue;
    const get = pathItem.get;
    if (!get || typeof get !== 'object') continue;
    // Path-level parameters apply to every operation on the path.
    const allParams = [...(pathItem.parameters || []), ...(get.parameters || [])]
      .map((p) => resolveOpenApiParam(p, spec))
      .filter((p) => p && typeof p.name === 'string' && p.name);
    const probeable = allParams.filter((p) => p.in === 'query' || p.in === 'path');
    if (probeable.length === 0) continue;
    let n = 0;
    const pathFillers = new Map();
    let templated = rawPath;
    for (const p of probeable) {
      if (p.in !== 'path') continue;
      const value = filler(++n);
      pathFillers.set(p.name, value);
      templated = templated.split(`{${p.name}}`).join(value);
    }
    // Undeclared {template} segments: never probe a literal-brace URL.
    templated = templated.replace(/\{[^/{}]+\}/g, () => filler(++n));
    let u;
    try {
      u = new URL(templated, base);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    for (const p of probeable) {
      if (p.in === 'query') {
        if (!u.searchParams.has(p.name)) u.searchParams.set(p.name, filler(++n));
      } else {
        // Mirror the path param as a query param with the SAME filler
        // the path segment carries — the battery probes query values,
        // so this is what makes the endpoint probeable at all.
        if (!u.searchParams.has(p.name)) u.searchParams.set(p.name, pathFillers.get(p.name));
      }
    }
    const url = u.toString().split('#')[0];
    if (!out.targets.includes(url)) {
      out.targets.push(url);
      out.operations += 1;
      out.params += probeable.length;
    }
  }
  return out;
}

/**
 * Discover OpenAPI GET targets for one pasted URL: probe the JSON spec
 * locations in order and extract targets from the first parseable spec.
 * Never throws: every failure mode (no spec, non-200, invalid JSON, no
 * paths object, fetch error) returns { specFound: false, targets: [] }
 * with the reason recorded in `errors`, so the caller can record an
 * honest no-op instead of a failure.
 * opts.fetchPage is the test seam (defaults to fingerprint.fetchPage);
 * it must return a fetchPage-shaped { url, status, headers, body }.
 */
export async function discoverOpenApiTargets(baseUrl, opts = {}) {
  const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  const errors = [];
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return {
      specFound: false,
      specUrl: null,
      targets: [],
      operations: 0,
      params: 0,
      errors: [`invalid base URL: ${baseUrl}`],
    };
  }
  for (const specPath of OPENAPI_SPEC_PATHS) {
    let specUrl;
    try {
      specUrl = new URL(specPath, base).toString();
    } catch {
      continue;
    }
    let page;
    try {
      page = await fetchFn(specUrl, opts);
    } catch (e) {
      errors.push(`${specPath}: ${e && e.message ? String(e.message) : String(e)}`);
      continue;
    }
    if (!page || page.status !== 200 || !page.body) {
      errors.push(`${specPath}: HTTP ${page ? page.status : 'no response'}`);
      continue;
    }
    let spec;
    try {
      spec = JSON.parse(page.body);
    } catch {
      errors.push(`${specPath}: not valid JSON`);
      continue;
    }
    if (!spec || typeof spec !== 'object' || !spec.paths || typeof spec.paths !== 'object') {
      errors.push(`${specPath}: no OpenAPI paths object`);
      continue;
    }
    const { targets, operations, params } = extractOpenApiTargets(spec, baseUrl);
    return { specFound: true, specUrl, targets, operations, params, errors };
  }
  return { specFound: false, specUrl: null, targets: [], operations: 0, params: 0, errors };
}
