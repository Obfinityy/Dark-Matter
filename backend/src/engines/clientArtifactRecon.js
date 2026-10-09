/**
 * clientArtifactRecon.js — Client-side artifact reconnaissance engine.
 *
 * Recovers API surface knowledge from client artifacts the hunt agent has
 * already fetched from the target's own publicly served pages: AJV JSON
 * schemas shipped in validation code, generated OpenAPI clients embedded in
 * bundles, and Mock Service Worker (MSW) request handlers.
 *
 * Operates purely on JS/JSON text already in hand (passive/static analysis).
 * No network calls, no execution of target code — fully deterministic.
 *
 * @module clientArtifactRecon
 */

/**
 * Find the index of the closing brace that balances the opening brace at
 * `openIdx`, honouring strings and comments.
 *
 * @param {string} src - Source text.
 * @param {number} openIdx - Index of the opening `{`.
 * @returns {number} Index of the matching `}` or -1 when unbalanced.
 */
function findMatchingBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 1-based line number of `idx` in `src`.
 *
 * @param {string} src - Source text.
 * @param {number} idx - Character index.
 * @returns {number} Line number.
 */
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

/**
 * Extract the top-level keys of an object block (depth-1 keys only), so
 * nested schema keywords such as `type` inside property definitions are
 * not mistaken for property names.
 *
 * @param {string} block - The inner text of the properties object.
 * @returns {string[]} Top-level key names.
 */
function topLevelKeys(block) {
  const keys = [];
  let depth = 0;
  let inStr = null;
  let i = 0;
  while (i < block.length) {
    const ch = block[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i += 1; continue; }
    if (ch === '{' || ch === '[') { depth += 1; i += 1; continue; }
    if (ch === '}' || ch === ']') { depth -= 1; i += 1; continue; }
    if (depth === 0) {
      const km = /^['"]?([A-Za-z_$][\w$-]*)['"]?\s*:/.exec(block.slice(i));
      if (km) {
        if (!keys.includes(km[1])) keys.push(km[1]);
        i += km[0].length;
        continue;
      }
    }
    i += 1;
  }
  return keys;
}

/**
 * Idea 00961 — extract AJV JSON schemas from source text.
 *
 * Detects `new Ajv(...)` / `ajv.compile(...)` / `ajv.addSchema(...)` usage and
 * pulls out the schema object literals: name, property names, required fields,
 * $id/endpoint hints, and whether the schema is actually handed to AJV.
 *
 * @param {string} source - Raw JS/JSON source already fetched.
 * @returns {Array<{name: string|null, line: number, properties: string[], required: string[], hints: string[], usedWithAjv: boolean}>}
 */
export function extractAjvSchemas(source = '') {
  const src = String(source);
  const schemas = [];
  const seen = new Set();

  const hasAjvUsage = /\b(?:new\s+Ajv\s*\(|ajv\.(?:compile|addSchema|validate)\s*\()/i.test(src);

  // Variable declarations whose initializer contains a JSON-schema marker.
  const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let m;
  while ((m = declRe.exec(src)) !== null) {
    const name = m[1];
    const openIdx = src.indexOf('{', m.index);
    const closeIdx = findMatchingBrace(src, openIdx);
    if (closeIdx === -1) continue;
    const body = src.slice(openIdx, closeIdx + 1);
    if (!/\b(?:type|properties|\$id|\$schema|required)\b/.test(body)) continue;
    if (!/\bproperties\s*:/.test(body) && !/\btype\s*:\s*['"]object['"]/.test(body)) continue;

    const key = `${name}::${openIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const propBlock = body.match(/properties\s*:\s*\{([\s\S]{0,8000}?)\n?\s*\}(?=\s*,?\s*(?:required|\$id|additionalProperties|type|\}))/);
    const properties = propBlock ? topLevelKeys(propBlock[1]).slice(0, 200) : [];
    const requiredMatch = body.match(/required\s*:\s*\[([\s\S]{0,800}?)\]/);
    const required = requiredMatch
      ? [...requiredMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((r) => r[1])
      : [];
    const hints = [...body.matchAll(/(?:\$id|endpoint|apiPath|url)\s*:\s*['"]([^'"]+)['"]/g)]
      .map((r) => r[1])
      .filter((h) => /[/:]/.test(h));
    const usedWithAjv = new RegExp(`\\b(?:ajv\\.(?:compile|addSchema|validate)\\s*\\(\\s*|validate\\s*\\(\\s*)${name}\\b`).test(src);

    schemas.push({
      name,
      line: lineOf(src, m.index),
      properties,
      required,
      hints,
      usedWithAjv: usedWithAjv || (hasAjvUsage && /ajv\.(?:compile|addSchema)/i.test(src.slice(Math.max(0, m.index - 400), m.index + 400))),
    });
  }

  // Inline schemas passed directly to ajv.compile({...}) / addSchema({...}).
  const inlineRe = /\bajv\.(?:compile|addSchema)\s*\(\s*\{/g;
  while ((m = inlineRe.exec(src)) !== null) {
    const openIdx = src.indexOf('{', m.index);
    const closeIdx = findMatchingBrace(src, openIdx);
    if (closeIdx === -1) continue;
    const body = src.slice(openIdx, closeIdx + 1);
    if (!/\bproperties\s*:/.test(body)) continue;
    const key = `inline::${openIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pRe = /properties\s*:\s*\{([\s\S]{0,8000}?)\n?\s*\}/;
    const pm = body.match(pRe);
    const properties = pm ? topLevelKeys(pm[1]) : [];
    schemas.push({ name: null, line: lineOf(src, m.index), properties, required: [], hints: [], usedWithAjv: true });
  }

  return schemas;
}

/**
 * Idea 00961 — infer API endpoints from AJV schemas plus nearby URL literals.
 *
 * Basis of each inference is recorded so the hunt agent can judge confidence:
 * an explicit `url`/`$id` hint inside the schema, or a fetch/axios literal
 * found within 30 lines of the schema declaration.
 *
 * @param {string} source - Raw JS source already fetched.
 * @returns {Array<{schema: string|null, line: number, endpoints: Array<{endpoint: string, basis: string}>}>}
 */
export function inferEndpointsFromAjv(source = '') {
  const src = String(source);
  const schemas = extractAjvSchemas(src);
  const lines = src.split('\n');
  const urlRe = /(?:fetch|axios\.(?:get|post|put|patch|delete)|http\.(?:get|post|put|patch|delete)|api\.(?:get|post|put|patch|delete))\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const literals = [];
  let m;
  while ((m = urlRe.exec(src)) !== null) {
    literals.push({ url: m[1], line: lineOf(src, m.index) });
  }

  return schemas.map((schema) => {
    const endpoints = [];
    const seen = new Set();
    const push = (endpoint, basis) => {
      const key = endpoint;
      if (seen.has(key) || !/[/]/.test(endpoint)) return;
      seen.add(key);
      endpoints.push({ endpoint, basis });
    };

    for (const hint of schema.hints) push(hint, 'schema hint ($id/endpoint field)');
    for (const lit of literals) {
      if (Math.abs(lit.line - schema.line) <= 30) {
        push(lit.url, `fetch/axios literal within 30 lines of schema '${schema.name || 'inline'}'`);
      }
    }
    // Resource-name heuristic: pluralise a property that reads like a resource id.
    for (const prop of schema.properties) {
      const rm = prop.match(/^([a-z][a-zA-Z0-9]*)Id$/);
      if (rm && !/^(?:user|session|request|client|correlation|trace)$/i.test(rm[1])) {
        push(`/{${prop}}`, 'resource-id property heuristic');
      }
    }
    return { schema: schema.name, line: schema.line, endpoints };
  });
}

/** Markers emitted by the common OpenAPI client generators. */
const CODEGEN_MARKERS = [
  { id: 'openapi-generator', re: /openapi-generator/i },
  { id: 'swagger-codegen', re: /swagger-codegen/i },
  { id: 'openapi-typescript', re: /openapi-typescript/i },
  { id: 'orval', re: /\borval\b/i },
  { id: 'hey-api', re: /hey-api|@hey-api/i },
  { id: 'openapi-fetch', re: /openapi-fetch/i },
  { id: 'ng-openapi-gen', re: /ng-openapi-gen/i },
  { id: 'generated-client-banner', re: /generated by (?:openapi|swagger)|do not (?:edit|modify) manually/i },
];

/**
 * Idea 00962 — detect generated OpenAPI API clients in a bundle.
 *
 * Spots generator banners, typed-client scaffolding (`OpenAPI.BASE`,
 * `createClient({ baseUrl })`) and counts embedded operation paths, so the
 * agent knows a full API spec shape can be recovered from this artifact.
 *
 * @param {string} source - Raw JS/TS bundle text already fetched.
 * @returns {{isGenerated: boolean, generators: string[], baseUrls: string[], operationCount: number, specShapes: Array<{path: string, methods: string[]}>}}
 */
export function detectOpenApiCodegen(source = '') {
  const src = String(source);
  const generators = CODEGEN_MARKERS.filter((g) => g.re.test(src)).map((g) => g.id);

  const baseUrls = [];
  const baseRe = /(?:OpenAPI\.BASE|baseUrl|BASE_URL|baseURL)\s*[:=]\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = baseRe.exec(src)) !== null) {
    if (!baseUrls.includes(m[1])) baseUrls.push(m[1]);
  }
  const serversRe = /["']servers["']\s*:\s*\[([\s\S]{0,600}?)\]/;
  const servers = src.match(serversRe);
  if (servers) {
    for (const u of servers[1].matchAll(/["']url["']\s*:\s*["'`]([^"'`]+)["'`]/g)) {
      if (!baseUrls.includes(u[1])) baseUrls.push(u[1]);
    }
  }

  const specShapes = extractOpenApiSpecShapes(src);

  // Generated clients also stamp operations as `path: '/...'` config objects.
  const pathRe = /\bpath\s*:\s*['"`](\/[A-Za-z0-9_{}$\-./]*)['"`]/g;
  const seenPaths = new Set(specShapes.map((s) => s.path));
  const extraPaths = [];
  while ((m = pathRe.exec(src)) !== null) {
    if (!seenPaths.has(m[1])) {
      seenPaths.add(m[1]);
      extraPaths.push({ path: m[1], methods: [] });
    }
  }

  return {
    isGenerated: generators.length > 0,
    generators,
    baseUrls,
    operationCount: specShapes.length + extraPaths.length,
    specShapes: [...specShapes, ...extraPaths],
  };
}

/**
 * Idea 00962 — extract full path/method shapes from an embedded OpenAPI spec.
 *
 * Handles an embedded JSON spec (`"openapi": "3.0.x", "paths": {...}`) found in
 * a bundle, recovering every path and its HTTP methods without executing code.
 *
 * @param {string} source - Raw text possibly containing an embedded OpenAPI spec.
 * @returns {Array<{path: string, methods: string[]}>}
 */
export function extractOpenApiSpecShapes(source = '') {
  const src = String(source);
  const shapes = [];
  const seen = new Set();
  const openApiIdx = src.search(/["']openapi["']\s*:\s*["']3\./);
  if (openApiIdx === -1) return shapes;

  const pathsMatch = /["']paths["']\s*:\s*\{/.exec(src.slice(openApiIdx, openApiIdx + 200000));
  if (!pathsMatch) return shapes;
  const openIdx = openApiIdx + pathsMatch.index + pathsMatch[0].length - 1;
  const closeIdx = findMatchingBrace(src, openIdx);
  if (closeIdx === -1) return shapes;
  const pathsBlock = src.slice(openIdx, closeIdx + 1);

  const pathRe = /["'](\/[A-Za-z0-9_{}$\-./]*)["']\s*:\s*\{/g;
  let m;
  while ((m = pathRe.exec(pathsBlock)) !== null) {
    const path = m[1];
    const pOpen = pathsBlock.indexOf('{', m.index + m[0].length - 1);
    const pClose = findMatchingBrace(pathsBlock, pOpen);
    const opBlock = pClose === -1 ? '' : pathsBlock.slice(pOpen, pClose + 1);
    const methods = [...opBlock.matchAll(/["'](get|post|put|patch|delete|head|options|trace)["']\s*:/gi)]
      .map((r) => r[1].toLowerCase())
      .filter((v, i, a) => a.indexOf(v) === i);
    if (!seen.has(path)) {
      seen.add(path);
      shapes.push({ path, methods });
    }
  }
  return shapes;
}

/**
 * Idea 00963 — mine Mock Service Worker (MSW) request handlers.
 *
 * MSW v1 (`rest.get('/path', resolver)`) and v2 (`http.get(...)`) handlers,
 * plus GraphQL operation handlers (`graphql.query('Name', ...)`), mirror real
 * backend endpoints — each one is a candidate real route to verify.
 *
 * @param {string} source - Raw JS source already fetched.
 * @returns {Array<{kind: 'rest'|'graphql', method: string|null, path: string|null, operationName: string|null, line: number}>}
 */
export function mineMswHandlers(source = '') {
  const src = String(source);
  const handlers = [];
  const seen = new Set();
  const push = (h) => {
    const key = `${h.kind}::${h.method}::${h.path}::${h.operationName}`;
    if (seen.has(key)) return;
    seen.add(key);
    handlers.push(h);
  };

  const restRe = /\b(?:rest|http)\.(get|post|put|patch|delete|head|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = restRe.exec(src)) !== null) {
    push({ kind: 'rest', method: m[1].toUpperCase(), path: m[2], operationName: null, line: lineOf(src, m.index) });
  }

  const gqlRe = /\bgraphql\.(query|mutation|subscription)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = gqlRe.exec(src)) !== null) {
    push({ kind: 'graphql', method: m[1].toUpperCase(), path: null, operationName: m[2], line: lineOf(src, m.index) });
  }

  const wsRe = /\bws\.link\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = wsRe.exec(src)) !== null) {
    push({ kind: 'rest', method: 'WS', path: m[1], operationName: null, line: lineOf(src, m.index) });
  }

  return handlers;
}
