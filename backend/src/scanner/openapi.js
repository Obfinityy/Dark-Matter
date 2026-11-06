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
// query param carrying the same filler. Since the path-segment lane
// (6 Nov 2026) the battery ALSO mutates the segment itself: each
// target carries its path-param descriptors ({ name, segment }) and
// the probe-point refactor (probePoints.js) treats a segment as a
// probeable parameter alongside the query params, so path-segment
// injection is probed with the same payloads and the same
// differential discipline as query injection. The query mirror is
// kept: it is what lets query-only probes (hpp, nosqli, ldap-blind)
// still run against the endpoint, and it is the control that proves
// a segment finding came from the segment, not the mirror.
//
// SCOPE: GET operations only. POST/PUT/DELETE operations never become
// targets (no writes to the target, ever). Header/cookie params are
// not probeable via URL and are skipped. An absent spec (or a spec
// with no probeable GET params) is an honest no-op — the pass records
// ok:true with 0 targets and the battery's own skipped records still
// describe the gap; a missing spec is NOT a failure.
//
// YAML specs (/openapi.yaml, /swagger.yaml) are probed AFTER the JSON
// locations (JSON stays preferred when both exist) and parsed with
// js-yaml's safe loader (no custom tags, no code execution — a
// hostile spec can at worst fail the parse and record an honest
// no-op). YAML is needed because the same spec is often published
// only as YAML (VAmPI serves /openapi.yaml alongside /openapi.json;
// its 19,743-byte YAML uses folded scalars, quoted keys and nested
// sequences — far past what a hand-rolled subset parser could safely
// cover). The parse is bounded: fetchPage already caps bodies at
// 500KB, and parseYamlSpec refuses bodies over 1MB outright.
import { randomBytes } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import { fetchPage } from './fingerprint.js';

// Spec locations, probed in order. /openapi.json first: it is the
// location the nuclei #253 template already proves on VAmPI. YAML
// locations come after the JSON ones — JSON stays preferred when a
// target publishes both.
export const OPENAPI_SPEC_PATHS = ['/openapi.json', '/swagger.json', '/openapi.yaml', '/swagger.yaml'];
export const OPENAPI_MAX_TARGETS = 20;

// Parse cap for a spec body (fetchPage already caps at 500KB; this
// bounds direct callers and hostile alias-expansion games).
export const OPENAPI_MAX_SPEC_BYTES = 1000000;

/**
 * Parse a YAML OpenAPI spec body into a spec object. Pure — exported
 * for unit tests. Throws on anything unparseable (empty body, oversize
 * body, invalid YAML, multi-document stream, non-object result) — the
 * caller records the failure and moves to the next candidate, never a
 * crash and never a guessed spec. js-yaml `load` is the safe loader:
 * custom tags (e.g. !!js/function) are rejected; `{ json: true }`
 * further restricts to JSON-compatible structures (duplicate keys are
 * an error, timestamps stay strings). Anchors/aliases still resolve,
 * as real specs use them.
 */
export function parseYamlSpec(body) {
  if (typeof body !== 'string' || body.length === 0) throw new Error('empty YAML spec');
  if (body.length > OPENAPI_MAX_SPEC_BYTES) throw new Error('YAML spec too large');
  const spec = loadYaml(body, { json: true });
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('YAML spec is not an object');
  return spec;
}

/** Unique safe filler per param — same never-empty/never-equal rule as toFormUrl. */
function filler(n) {
  return `dmprobe${n}_${randomBytes(2).toString('hex')}`;
}

/**
 * Resolve a parameter object, following a local $ref one level:
 * OpenAPI 3 `#/components/parameters/<Name>` or Swagger 2.0
 * `#/parameters/<Name>`. Returns the resolved parameter, the
 * parameter itself when it carries no $ref, or null when the ref
 * cannot be resolved (the param is skipped, never guessed).
 * Pure — exported for unit tests.
 */
export function resolveOpenApiParam(param, spec) {
  if (!param || typeof param !== 'object') return null;
  if (typeof param.$ref === 'string') {
    const m = /^#\/(components\/parameters|parameters)\/([^/]+)$/.exec(param.$ref);
    if (!m) return null;
    const table =
      m[1] === 'components/parameters'
        ? spec && spec.components && spec.components.parameters
        : spec && spec.parameters;
    if (!table || typeof table !== 'object') return null;
    let name;
    try {
      name = decodeURIComponent(m[2]);
    } catch {
      return null;
    }
    const resolved = table[name];
    return resolved && typeof resolved === 'object' ? resolved : null;
  }
  return param;
}

/**
 * Extract probeable GET targets from a parsed OpenAPI spec object.
 * Pure — exported for unit tests. Returns
 * { targets, operations, params, pathParams }: targets are absolute
 * GET URLs (same origin as baseUrl), one per GET operation carrying
 * at least one query/path parameter; operations is the count of such
 * operations; params is the count of probeable parameters across
 * them; pathParams maps each target URL to its path-param descriptors
 * [{ name, segment }] (segment = index in rawPath.split('/'); an
 * undeclared {template} segment gets a filler but is NOT a probe
 * point — it has no name). A spec without a paths object yields zero
 * targets. Paths with no GET operation, GET operations with no
 * query/path params, and non-GET operations are skipped silently.
 */
export function extractOpenApiTargets(spec, baseUrl) {
  const out = { targets: [], operations: 0, params: 0, pathParams: {} };
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
    const pathDescriptors = [];
    let templated = rawPath;
    for (const p of probeable) {
      if (p.in !== 'path') continue;
      const value = filler(++n);
      pathFillers.set(p.name, value);
      // Segment index in the CURRENT templated path (earlier
      // replacements preserve positions — split/join never adds or
      // removes a segment). A repeated {name} probes only its first
      // occurrence; both carry the same filler.
      const segment = templated.split('/').indexOf(`{${p.name}}`);
      if (segment >= 0) pathDescriptors.push({ name: p.name, segment });
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
      if (pathDescriptors.length > 0) out.pathParams[url] = pathDescriptors;
    }
  }
  return out;
}

/**
 * Discover OpenAPI GET targets for one pasted URL: probe the spec
 * locations in order (JSON first, then YAML) and extract targets from
 * the first parseable spec. Never throws: every failure mode (no spec,
 * non-200, invalid JSON/YAML, no paths object, fetch error) returns
 * { specFound: false, targets: [], pathParams: {} } with the reason
 * recorded in `errors`, so the caller can record an honest no-op
 * instead of a failure.
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
      pathParams: {},
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
    const isYaml = /\.ya?ml$/i.test(specPath);
    try {
      spec = isYaml ? parseYamlSpec(page.body) : JSON.parse(page.body);
    } catch {
      errors.push(`${specPath}: not valid ${isYaml ? 'YAML' : 'JSON'}`);
      continue;
    }
    if (!spec || typeof spec !== 'object' || !spec.paths || typeof spec.paths !== 'object') {
      errors.push(`${specPath}: no OpenAPI paths object`);
      continue;
    }
    const { targets, operations, params, pathParams } = extractOpenApiTargets(spec, baseUrl);
    return { specFound: true, specUrl, targets, operations, params, pathParams, errors };
  }
  return { specFound: false, specUrl: null, targets: [], operations: 0, params: 0, pathParams: {}, errors };
}
