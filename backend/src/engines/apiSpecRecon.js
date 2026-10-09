/**
 * apiSpecRecon.js — API specification discovery and exposure analysis.
 *
 * Idea 01001: build a Swagger/OpenAPI hidden-path sweep list covering
 *   /v3/api-docs, /swagger.json, /openapi.yaml and 40+ vendor-specific
 *   documentation variants, and detect spec shapes in operator-supplied
 *   response text.
 * Idea 01002: check FastAPI default documentation exposure via /docs,
 *   /redoc and /openapi.json candidate paths, and recognise FastAPI's
 *   default Swagger-UI/Redoc page markers in response text.
 * Idea 01003: enumerate Spring Boot actuator endpoints (/actuator,
 *   /actuator/env, /actuator/heapdump and mapped sub-paths) and parse
 *   actuator JSON safely — extracting beans/env/config keys while
 *   REDACTING sensitive values (passwords, tokens, secrets).
 * Idea 01004: build a Postman public-API workspace query for the target
 *   brand so the operator can harvest published collections that may
 *   reference live endpoints of the authorized target.
 * Idea 01005: hunt AsyncAPI specifications (asyncapi.json/yaml) and
 *   EventCatalog portals used by event-driven APIs.
 * Idea 01006: discover WSDL endpoints via /service?wsdl, /soap and
 *   .asmx variants, and parse WSDL XML supplied by the operator for
 *   service/port/operation listings.
 * Idea 01007: probe WADL files (application.wadl, /wadl paths) and parse
 *   JAX-RS resource listings from operator-supplied XML.
 * Idea 01008: extract OData metadata from operator-supplied $metadata
 *   XML — entity sets, entity types, function imports and navigation
 *   properties.
 * Idea 01009: describe an OData $batch probe (multipart batch support
 *   test) as a transport-agnostic request descriptor the agent's
 *   network layer can execute against authorized targets.
 * Idea 01010: build the canonical GraphQL __schema introspection query
 *   (plus a compact variant) so the agent can test whether
 *   introspection is enabled on a /graphql endpoint.
 *
 * DEFENSIVE surface-mapping only. No network calls are made here: this
 * module generates candidate probe paths, parses response text supplied
 * by the operator or the agent's network layer, and builds findings for
 * the report writer. Only authorized targets may be probed.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

// ---------------------------------------------------------------------------
// Idea 01001 — Swagger/OpenAPI hidden path sweep
// ---------------------------------------------------------------------------

/**
 * Canonical plus vendor-specific OpenAPI/Swagger documentation paths.
 * Each entry carries the path, the doc format it usually serves, and the
 * framework/vendor that made it famous — so findings can name the stack.
 */
export const SWAGGER_DOC_PATHS = [
  { path: '/v3/api-docs', format: 'openapi-json', vendor: 'springdoc' },
  { path: '/v3/api-docs.yaml', format: 'openapi-yaml', vendor: 'springdoc' },
  { path: '/v2/api-docs', format: 'swagger-json', vendor: 'springfox' },
  { path: '/swagger.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/swagger.yaml', format: 'swagger-yaml', vendor: 'generic' },
  { path: '/swagger.yml', format: 'swagger-yaml', vendor: 'generic' },
  { path: '/openapi.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/openapi.yaml', format: 'openapi-yaml', vendor: 'generic' },
  { path: '/openapi.yml', format: 'openapi-yaml', vendor: 'generic' },
  { path: '/api-docs', format: 'swagger-json', vendor: 'generic' },
  { path: '/api-docs.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/api-docs.yaml', format: 'swagger-yaml', vendor: 'generic' },
  { path: '/api/swagger.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/api/swagger.yaml', format: 'swagger-yaml', vendor: 'generic' },
  { path: '/api/openapi.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/api/openapi.yaml', format: 'openapi-yaml', vendor: 'generic' },
  { path: '/docs/swagger.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/docs/openapi.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/swagger-ui/swagger.json', format: 'swagger-json', vendor: 'swagger-ui' },
  { path: '/swagger-ui/openapi.json', format: 'openapi-json', vendor: 'swagger-ui' },
  { path: '/swagger-resources', format: 'swagger-json', vendor: 'springfox' },
  { path: '/swagger-resources/configuration/ui', format: 'swagger-json', vendor: 'springfox' },
  { path: '/swagger-resources/configuration/security', format: 'swagger-json', vendor: 'springfox' },
  { path: '/api-docs/swagger.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/api-docs/openapi.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/rest-api-docs', format: 'swagger-json', vendor: 'generic' },
  { path: '/json/swagger.json', format: 'swagger-json', vendor: 'slate' },
  { path: '/documentation/json', format: 'swagger-json', vendor: 'hapi-swagger' },
  { path: '/documentation/swagger.json', format: 'swagger-json', vendor: 'hapi-swagger' },
  { path: '/explorer/swagger.json', format: 'swagger-json', vendor: 'loopback' },
  { path: '/api/explorer/swagger.json', format: 'swagger-json', vendor: 'loopback' },
  { path: '/swagger/v1/swagger.json', format: 'swagger-json', vendor: 'swashbuckle' },
  { path: '/api/swagger/v1/swagger.json', format: 'swagger-json', vendor: 'swashbuckle' },
  { path: '/api-docs/v1/swagger.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/openapi/v1.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/spec.json', format: 'swagger-json', vendor: 'generic' },
  { path: '/spec.yaml', format: 'swagger-yaml', vendor: 'generic' },
  { path: '/schema.json', format: 'openapi-json', vendor: 'generic' },
  { path: '/schema.yaml', format: 'openapi-yaml', vendor: 'generic' },
  { path: '/api/schema.json', format: 'openapi-json', vendor: 'django' },
  { path: '/api/schema/swagger.json', format: 'swagger-json', vendor: 'drf-spectacular' },
  { path: '/api/schema/swagger-ui/', format: 'html', vendor: 'drf-spectacular' },
  { path: '/api/spec.json', format: 'openapi-json', vendor: 'nestjs' },
  { path: '/api-json', format: 'openapi-json', vendor: 'nestjs' },
  { path: '/api-yaml', format: 'openapi-yaml', vendor: 'nestjs' },
  { path: '/q/openapi', format: 'openapi-json', vendor: 'quarkus' },
  { path: '/openapi', format: 'openapi-json', vendor: 'quarkus' },
  { path: '/api/openapi.json', format: 'openapi-json', vendor: 'micronaut' },
  { path: '/apidoc.json', format: 'swagger-json', vendor: 'apidoc' },
];

/**
 * Build absolute probe URLs for the Swagger/OpenAPI doc sweep.
 * @param {string} baseUrl - Target origin, e.g. 'https://api.example.com'.
 * @returns {{url: string, format: string, vendor: string}[]}
 */
export function buildSwaggerProbePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return SWAGGER_DOC_PATHS.map(d => ({
    url: `${base}${d.path}`,
    format: d.format,
    vendor: d.vendor,
  }));
}

const SPEC_SHAPE_MARKERS = [
  { shape: 'openapi-3', test: /"openapi"\s*:\s*"3\./, framework: 'OpenAPI 3.x' },
  { shape: 'swagger-2', test: /"swagger"\s*:\s*"2\.0"/, framework: 'Swagger 2.0' },
  { shape: 'openapi-yaml', test: /^openapi:\s*['"]?3\./m, framework: 'OpenAPI 3.x (YAML)' },
  { shape: 'swagger-yaml', test: /^swagger:\s*['"]?2\.0['"]?/m, framework: 'Swagger 2.0 (YAML)' },
  { shape: 'swagger-ui-html', test: /swagger-ui-bundle|SwaggerUIBundle/i, framework: 'Swagger UI (HTML)' },
  { shape: 'redoc-html', test: /redoc.standalone|ReDoc/i, framework: 'ReDoc (HTML)' },
  { shape: 'rapidoc-html', test: /rapidoc/i, framework: 'RapiDoc (HTML)' },
  { shape: 'stoplight-html', test: /stoplight-elements/i, framework: 'Stoplight Elements (HTML)' },
];

/**
 * Detect an API specification document in operator-supplied response text.
 * @param {string} text - Raw response body from a probe path.
 * @returns {{found: boolean, shape: string|null, framework: string|null, paths: string[], title: string|null, version: string|null}}
 */
export function parseSwaggerResponse(text = '') {
  const body = String(text);
  const result = { found: false, shape: null, framework: null, paths: [], title: null, version: null };
  for (const m of SPEC_SHAPE_MARKERS) {
    if (m.test.test(body)) {
      result.found = true;
      result.shape = m.shape;
      result.framework = m.framework;
      break;
    }
  }
  if (!result.found) return result;
  try {
    const doc = JSON.parse(body);
    if (doc.info && typeof doc.info === 'object') {
      result.title = doc.info.title || null;
      result.version = doc.info.version || null;
    }
    if (doc.paths && typeof doc.paths === 'object') {
      result.paths = Object.keys(doc.paths).slice(0, 500);
    }
  } catch {
    // YAML or HTML marker-only responses carry no machine-readable path list.
  }
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01002 — FastAPI docs exposure check
// ---------------------------------------------------------------------------

export const FASTAPI_DOC_PATHS = [
  { path: '/docs', kind: 'swagger-ui' },
  { path: '/redoc', kind: 'redoc' },
  { path: '/openapi.json', kind: 'spec' },
  { path: '/docs/oauth2-redirect', kind: 'swagger-ui-asset' },
  { path: '/openapi.json?docs', kind: 'spec-variant' },
];

const FASTAPI_PAGE_MARKERS = [
  { kind: 'swagger-ui', test: /FastAPI|swagger-ui-bundle/i, label: 'FastAPI Swagger UI (/docs)' },
  { kind: 'redoc', test: /redoc/i, label: 'FastAPI ReDoc (/redoc)' },
];

/**
 * Build absolute probe URLs for the FastAPI default-documentation check.
 * @param {string} baseUrl
 * @returns {{url: string, kind: string}[]}
 */
export function buildFastApiProbePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return FASTAPI_DOC_PATHS.map(d => ({ url: `${base}${d.path}`, kind: d.kind }));
}

/**
 * Detect FastAPI's default interactive docs pages in response text.
 * @param {string} text
 * @returns {{exposed: boolean, kind: string|null, label: string|null}}
 */
export function detectFastApiDocs(text = '') {
  const body = String(text);
  for (const m of FASTAPI_PAGE_MARKERS) {
    if (m.test.test(body)) return { exposed: true, kind: m.kind, label: m.label };
  }
  const spec = parseSwaggerResponse(body);
  if (spec.found) return { exposed: true, kind: 'spec', label: `Machine-readable spec (${spec.framework})` };
  return { exposed: false, kind: null, label: null };
}

// ---------------------------------------------------------------------------
// Idea 01003 — Spring Boot actuator enumeration
// ---------------------------------------------------------------------------

export const ACTUATOR_BASE_PATHS = ['', '/actuator', '/manage', '/management', '/admin'];

export const ACTUATOR_ENDPOINTS = [
  'health', 'info', 'env', 'configprops', 'beans', 'mappings', 'heapdump',
  'threaddump', 'metrics', 'loggers', 'conditions', 'caches', 'scheduledtasks',
  'httptrace', 'httpexchanges', 'sessions', 'flyway', 'liquibase', 'startup',
  'integrationgraph', 'quartz', 'service-registry', 'gateway', 'refresh',
];

/** Actuator endpoints that commonly return sensitive data. */
export const ACTUATOR_SENSITIVE_ENDPOINTS = new Set(['env', 'configprops', 'heapdump', 'threaddump', 'loggers']);

const SENSITIVE_KEY_PATTERN = /password|passwd|pwd|secret|token|apikey|api[_-]?key|credential|private[_-]?key|auth|session|cookie/i;

/**
 * Redact values whose keys look sensitive before storing evidence.
 * @param {string} key
 * @param {*} value
 */
export function redactSensitiveValue(key, value) {
  if (SENSITIVE_KEY_PATTERN.test(String(key))) return '***REDACTED***';
  return value;
}

/**
 * Build the actuator probe path list across common base paths.
 * @returns {{path: string, base: string, endpoint: string, sensitive: boolean}[]}
 */
export function actuatorPathList() {
  const out = [];
  for (const base of ACTUATOR_BASE_PATHS) {
    if (base === '') {
      out.push({ path: '/actuator', base, endpoint: '(index)', sensitive: false });
    }
    for (const ep of ACTUATOR_ENDPOINTS) {
      const p = `${base}/actuator`.replace('//', '/');
      out.push({
        path: `${p}/${ep}`,
        base: base || '/',
        endpoint: ep,
        sensitive: ACTUATOR_SENSITIVE_ENDPOINTS.has(ep),
      });
    }
  }
  return out;
}

/**
 * Parse an actuator JSON response defensively.
 * - `/actuator` index: list available endpoints from `_links`.
 * - `/env`: extract property-source names and redact values.
 * - `/beans`: count beans, list context names.
 * - `/configprops`: list prefixes, redact values.
 * - `/mappings`: count handler mappings.
 * Never stores raw secret values in the returned structure.
 * @param {string} path - The actuator path that was probed.
 * @param {string} text - Raw response body.
 * @returns {{endpoint: string, ok: boolean, summary: string, detail: object}}
 */
export function parseActuatorResponse(path = '', text = '') {
  const endpoint = String(path).split('/').pop() || '(index)';
  const result = { endpoint, ok: false, summary: '', detail: {} };
  let doc;
  try {
    doc = JSON.parse(String(text));
  } catch {
    result.summary = 'Response is not JSON — likely an error page or protected endpoint.';
    return result;
  }
  result.ok = true;
  if (endpoint === '(index)' || endpoint === 'actuator') {
    const links = (doc._links && typeof doc._links === 'object') ? Object.keys(doc._links) : [];
    result.summary = `${links.length} actuator endpoint(s) exposed via index.`;
    result.detail = { endpoints: links };
    return result;
  }
  if (endpoint === 'env') {
    const sources = Array.isArray(doc.propertySources) ? doc.propertySources : [];
    const redacted = {};
    for (const src of sources) {
      if (!src || !src.properties) continue;
      redacted[src.name || 'unknown'] = Object.fromEntries(
        Object.entries(src.properties).slice(0, 200).map(([k, v]) => [
          k,
          redactSensitiveValue(k, v && typeof v === 'object' && 'value' in v ? v.value : v),
        ]),
      );
    }
    result.summary = `${sources.length} property source(s) exposed; sensitive values redacted.`;
    result.detail = { propertySources: Object.keys(redacted), redactedProperties: redacted };
    return result;
  }
  if (endpoint === 'beans') {
    const contexts = doc.contexts && typeof doc.contexts === 'object' ? doc.contexts : {};
    let beanCount = 0;
    for (const ctx of Object.values(contexts)) {
      if (ctx && ctx.beans && typeof ctx.beans === 'object') beanCount += Object.keys(ctx.beans).length;
    }
    result.summary = `${beanCount} bean(s) across ${Object.keys(contexts).length} context(s).`;
    result.detail = { contexts: Object.keys(contexts), beanCount };
    return result;
  }
  if (endpoint === 'configprops') {
    const contexts = doc.contexts && typeof doc.contexts === 'object' ? doc.contexts : {};
    const prefixes = [];
    for (const ctx of Object.values(contexts)) {
      if (ctx && ctx.beans && typeof ctx.beans === 'object') {
        for (const bean of Object.values(ctx.beans)) {
          if (bean && bean.prefix) prefixes.push(bean.prefix);
        }
      }
    }
    result.summary = `${prefixes.length} configuration prefix(es) exposed.`;
    result.detail = { prefixes: prefixes.slice(0, 100) };
    return result;
  }
  if (endpoint === 'mappings') {
    const contexts = doc.contexts && typeof doc.contexts === 'object' ? doc.contexts : {};
    let mappingCount = 0;
    for (const ctx of Object.values(contexts)) {
      if (ctx && ctx.mappings && ctx.mappings.dispatcherServlets) {
        for (const ds of Object.values(ctx.mappings.dispatcherServlets)) {
          if (Array.isArray(ds)) mappingCount += ds.length;
        }
      }
    }
    result.summary = `${mappingCount} dispatcher mapping(s) exposed.`;
    result.detail = { mappingCount };
    return result;
  }
  if (endpoint === 'heapdump') {
    result.ok = false;
    result.summary = 'Heap dump endpoint responded — treat as high-severity exposure (memory contents).';
    result.detail = { sensitive: true };
    return result;
  }
  result.summary = `Actuator endpoint '${endpoint}' returned JSON.`;
  result.detail = { keys: Object.keys(doc).slice(0, 50) };
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01004 — Postman public workspace harvesting
// ---------------------------------------------------------------------------

/**
 * Build a Postman public-API search query for collections mentioning the
 * target brand. Postman's public API supports a full-text `q` search over
 * public workspaces and collections.
 * @param {string} brand - Target brand / company / product name.
 * @param {{limit?: number}} [options]
 * @returns {{searchUrl: string, query: string, note: string}}
 */
export function postmanQueryBuilder(brand = '', options = {}) {
  const { limit = 50 } = options;
  const query = String(brand).trim();
  const searchUrl =
    'https://api.getpostman.com/search?' +
    new URLSearchParams({ q: query, limit: String(Math.min(Math.max(limit, 1), 100)) }).toString();
  return {
    searchUrl,
    query,
    note:
      'Query Postman\'s public search API for collections mentioning the brand; ' +
      'review any returned collection for endpoint URLs that belong to the authorized target ' +
      'before using them. Never use leaked tokens found in public collections.',
  };
}

/**
 * Extract candidate endpoint URLs from a Postman collection JSON supplied
 * by the operator, scoped to the target host.
 * @param {object|string} collectionJson - Parsed collection or raw JSON text.
 * @param {string} targetHost - e.g. 'api.example.com' — only URLs under this host are kept.
 * @returns {{requests: {name: string, method: string, url: string}[], stats: object}}
 */
export function extractPostmanEndpoints(collectionJson, targetHost = '') {
  const coll = typeof collectionJson === 'string' ? JSON.parse(collectionJson) : collectionJson;
  const host = String(targetHost).toLowerCase();
  const requests = [];
  const walk = (items) => {
    for (const item of items || []) {
      if (item.item) walk(item.item);
      if (item.request) {
        const req = item.request;
        const rawUrl = typeof req.url === 'string' ? req.url : (req.url && req.url.raw) || '';
        let urlHost = '';
        try { urlHost = new URL(rawUrl).hostname.toLowerCase(); } catch { /* relative or template URL */ }
        if (!host || urlHost === host || urlHost.endsWith(`.${host}`)) {
          requests.push({ name: item.name || '(unnamed)', method: String(req.method || 'GET').toUpperCase(), url: rawUrl });
        }
      }
    }
  };
  walk(coll && coll.item);
  return {
    requests: requests.slice(0, 500),
    stats: { total: requests.length, methods: [...new Set(requests.map(r => r.method))] },
  };
}

// ---------------------------------------------------------------------------
// Idea 01005 — AsyncAPI spec discovery
// ---------------------------------------------------------------------------

export const ASYNCAPI_PATHS = [
  { path: '/asyncapi.json', format: 'asyncapi-json' },
  { path: '/asyncapi.yaml', format: 'asyncapi-yaml' },
  { path: '/asyncapi.yml', format: 'asyncapi-yaml' },
  { path: '/api/asyncapi.json', format: 'asyncapi-json' },
  { path: '/api/asyncapi.yaml', format: 'asyncapi-yaml' },
  { path: '/docs/asyncapi.json', format: 'asyncapi-json' },
  { path: '/eventcatalog/asyncapi.json', format: 'asyncapi-json' },
  { path: '/eventcatalog', format: 'eventcatalog-portal' },
  { path: '/events', format: 'eventcatalog-portal' },
  { path: '/event-catalog', format: 'eventcatalog-portal' },
];

const ASYNCAPI_MARKERS = [
  { shape: 'asyncapi-json', test: /"asyncapi"\s*:\s*"2\./, label: 'AsyncAPI 2.x (JSON)' },
  { shape: 'asyncapi-json-3', test: /"asyncapi"\s*:\s*"3\./, label: 'AsyncAPI 3.x (JSON)' },
  { shape: 'asyncapi-yaml', test: /^asyncapi:\s*['"]?[23]\./m, label: 'AsyncAPI (YAML)' },
  { shape: 'eventcatalog', test: /eventcatalog|EventCatalog/i, label: 'EventCatalog portal (HTML)' },
];

/**
 * Build absolute probe URLs for AsyncAPI spec / EventCatalog discovery.
 * @param {string} baseUrl
 * @returns {{url: string, format: string}[]}
 */
export function asyncapiCandidatePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return ASYNCAPI_PATHS.map(d => ({ url: `${base}${d.path}`, format: d.format }));
}

/**
 * Detect an AsyncAPI document or EventCatalog portal in response text and
 * extract channel names from JSON specs.
 * @param {string} text
 * @returns {{found: boolean, shape: string|null, label: string|null, channels: string[]}}
 */
export function parseAsyncApiResponse(text = '') {
  const body = String(text);
  const result = { found: false, shape: null, label: null, channels: [] };
  for (const m of ASYNCAPI_MARKERS) {
    if (m.test.test(body)) {
      result.found = true;
      result.shape = m.shape;
      result.label = m.label;
      break;
    }
  }
  if (!result.found) return result;
  try {
    const doc = JSON.parse(body);
    if (doc.channels && typeof doc.channels === 'object') {
      result.channels = Object.keys(doc.channels).slice(0, 200);
    }
  } catch {
    // YAML or HTML only — no channel list extracted.
  }
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01006 — WSDL endpoint discovery
// ---------------------------------------------------------------------------

export const WSDL_PATHS = [
  { path: '/?wsdl', kind: 'query' },
  { path: '/service?wsdl', kind: 'query' },
  { path: '/services?wsdl', kind: 'query' },
  { path: '/soap?wsdl', kind: 'query' },
  { path: '/api/soap?wsdl', kind: 'query' },
  { path: '/ws?wsdl', kind: 'query' },
  { path: '/webservice?wsdl', kind: 'query' },
  { path: '/Service.asmx', kind: 'asmx' },
  { path: '/WebService.asmx', kind: 'asmx' },
  { path: '/api/Service.asmx', kind: 'asmx' },
  { path: '/services/Service.asmx', kind: 'asmx' },
  { path: '/soap/Service.asmx', kind: 'asmx' },
  { path: '/service.wsdl', kind: 'static' },
  { path: '/services.wsdl', kind: 'static' },
  { path: '/wsdl/service.wsdl', kind: 'static' },
  { path: '/api/service.wsdl', kind: 'static' },
];

/**
 * Build absolute WSDL probe URLs.
 * @param {string} baseUrl
 * @returns {{url: string, kind: string}[]}
 */
export function wsdlCandidatePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return WSDL_PATHS.map(d => ({ url: `${base}${d.path}`, kind: d.kind }));
}

/**
 * Parse WSDL XML supplied by the operator: service names, ports, bindings
 * and operations. Namespace-agnostic via local-name matching.
 * @param {string} xmlText
 * @returns {{found: boolean, services: string[], ports: {name: string, binding: string}[], operations: string[]}}
 */
export function parseWsdlResponse(xmlText = '') {
  const xml = String(xmlText);
  const result = { found: false, services: [], ports: [], operations: [] };
  if (!/<(?:\w+:)?definitions[\s>]/.test(xml)) return result;
  result.found = true;
  const local = (tag) => new RegExp(`<\\w*:${tag}\\b([^>]*)>`, 'g');
  const serviceRe = local('service');
  const portRe = local('port');
  const operationRe = local('operation');
  let m;
  while ((m = serviceRe.exec(xml)) !== null) {
    const name = /name\s*=\s*"([^"]+)"/.exec(m[1]);
    if (name) result.services.push(name[1]);
  }
  while ((m = portRe.exec(xml)) !== null) {
    const name = /name\s*=\s*"([^"]+)"/.exec(m[1]);
    const binding = /binding\s*=\s*"([^"]+)"/.exec(m[1]);
    if (name) result.ports.push({ name: name[1], binding: binding ? binding[1] : null });
  }
  while ((m = operationRe.exec(xml)) !== null) {
    const name = /name\s*=\s*"([^"]+)"/.exec(m[1]);
    if (name && !result.operations.includes(name[1])) result.operations.push(name[1]);
  }
  result.services = result.services.slice(0, 50);
  result.ports = result.ports.slice(0, 50);
  result.operations = result.operations.slice(0, 200);
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01007 — WADL file probing
// ---------------------------------------------------------------------------

export const WADL_PATHS = [
  { path: '/application.wadl', kind: 'root' },
  { path: '/wadl', kind: 'root' },
  { path: '/api/application.wadl', kind: 'api' },
  { path: '/api/wadl', kind: 'api' },
  { path: '/rest/application.wadl', kind: 'rest' },
  { path: '/rest/wadl', kind: 'rest' },
  { path: '/services/application.wadl', kind: 'services' },
  { path: '/v1/application.wadl', kind: 'versioned' },
  { path: '/v2/application.wadl', kind: 'versioned' },
];

/**
 * Build absolute WADL probe URLs.
 * @param {string} baseUrl
 * @returns {{url: string, kind: string}[]}
 */
export function wadlCandidatePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return WADL_PATHS.map(d => ({ url: `${base}${d.path}`, kind: d.kind }));
}

/**
 * Parse WADL XML supplied by the operator: base URL and resource paths
 * with their HTTP methods.
 * @param {string} xmlText
 * @returns {{found: boolean, base: string|null, resources: {path: string, methods: string[]}[]}}
 */
export function parseWadlResponse(xmlText = '') {
  const xml = String(xmlText);
  const result = { found: false, base: null, resources: [] };
  if (!/<(?:\w+:)?application[\s>]/.test(xml) || !/wadl/i.test(xml)) return result;
  result.found = true;
  const resourcesMatch = /<(?:\w+:)?resources\b[^>]*base\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?resources>/.exec(xml);
  const body = resourcesMatch ? resourcesMatch[2] : xml;
  if (resourcesMatch) result.base = resourcesMatch[1] || null;
  const resourceRe = /<(?:\w+:)?resource\b[^>]*path\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?resource>/g;
  let m;
  while ((m = resourceRe.exec(body)) !== null) {
    const methods = [...m[2].matchAll(/<(?:\w+:)?method\b[^>]*name\s*=\s*"([A-Z]+)"/g)].map(x => x[1]);
    result.resources.push({ path: m[1], methods: [...new Set(methods)] });
    if (result.resources.length >= 200) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01008 — OData metadata extraction
// ---------------------------------------------------------------------------

/**
 * Parse an OData $metadata document supplied by the operator.
 * Extracts entity sets, entity types (with keys + properties), function
 * imports and navigation properties — the full queryable surface.
 * Namespace-agnostic via local-name matching.
 * @param {string} xmlText
 * @returns {{found: boolean, version: string|null, entitySets: {name: string, entityType: string}[], entityTypes: {name: string, keys: string[], properties: string[]}[], functionImports: string[], navProperties: {entity: string, name: string}[]}}
 */
export function odataMetadataParser(xmlText = '') {
  const xml = String(xmlText);
  const result = {
    found: false, version: null, entitySets: [], entityTypes: [], functionImports: [], navProperties: [],
  };
  if (!/<(?:\w+:)?Edmx[\s>]/.test(xml) && !/<(?:\w+:)?Schema[\s>]/.test(xml)) return result;
  result.found = true;
  const versionMatch = /Version\s*=\s*"([^"]+)"/.exec(xml);
  result.version = versionMatch ? versionMatch[1] : null;
  const attr = (s, name) => {
    const x = new RegExp(`${name}\\s*=\\s*"([^"]+)"`).exec(s || '');
    return x ? x[1] : null;
  };
  let m;
  const entitySetRe = /<(?:\w+:)?EntitySet\b([^>]*)\/?>/g;
  while ((m = entitySetRe.exec(xml)) !== null) {
    result.entitySets.push({ name: attr(m[1], 'Name'), entityType: attr(m[1], 'EntityType') });
  }
  const entityTypeRe = /<(?:\w+:)?EntityType\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?EntityType>/g;
  while ((m = entityTypeRe.exec(xml)) !== null) {
    const name = attr(m[1], 'Name');
    const body = m[2];
    const keys = [...body.matchAll(/<(?:\w+:)?PropertyRef\b[^>]*Name\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    const properties = [...body.matchAll(/<(?:\w+:)?Property\b[^>]*Name\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    const navs = [...body.matchAll(/<(?:\w+:)?NavigationProperty\b[^>]*Name\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    result.entityTypes.push({ name, keys, properties });
    for (const n of navs) result.navProperties.push({ entity: name, name: n });
    if (result.entityTypes.length >= 100) break;
  }
  const funcRe = /<(?:\w+:)?FunctionImport\b([^>]*)\/?>/g;
  while ((m = funcRe.exec(xml)) !== null) {
    const name = attr(m[1], 'Name');
    if (name && !result.functionImports.includes(name)) result.functionImports.push(name);
  }
  result.functionImports = result.functionImports.slice(0, 100);
  result.navProperties = result.navProperties.slice(0, 200);
  return result;
}

// ---------------------------------------------------------------------------
// Idea 01009 — OData batch endpoint probe descriptor
// ---------------------------------------------------------------------------

/**
 * Describe an OData $batch multipart request the agent's network layer can
 * execute against an authorized target. No request is sent here — the
 * descriptor is transport-agnostic so the agent can adapt it to its HTTP
 * client.
 * @param {string} baseUrl - Service root, e.g. 'https://api.example.com/odata'.
 * @param {{entitySet?: string}} [options]
 * @returns {{method: string, url: string, headers: object, bodyTemplate: string, assertions: object, note: string}}
 */
export function odataBatchProbeDescriptor(baseUrl = '', options = {}) {
  const base = String(baseUrl).replace(/\/+$/, '');
  const { entitySet = 'Products' } = options;
  const boundary = 'batch_probe_8d2f';
  const bodyTemplate =
    `--${boundary}\r\n` +
    `Content-Type: application/http\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n` +
    `GET ${entitySet} HTTP/1.1\r\n` +
    `Accept: application/json\r\n\r\n` +
    `--${boundary}--`;
  return {
    method: 'POST',
    url: `${base}/$batch`,
    headers: {
      ...JSON_HEADERS,
      'Content-Type': `multipart/mixed;boundary=${boundary}`,
      'OData-Version': '4.0',
    },
    bodyTemplate,
    assertions: {
      batchSupported: 'HTTP 202 with multipart/mixed response containing the inner GET result',
      batchRejected: 'HTTP 4xx/501 — batching not enabled on this service',
    },
    note:
      'Read-only GET batch only — never bundle state-changing operations in a probe. ' +
      'A 202 response confirms $batch is enabled, which changes per-request rate-limit math.',
  };
}

// ---------------------------------------------------------------------------
// Idea 01010 — GraphQL introspection enablement check
// ---------------------------------------------------------------------------

/** Canonical full introspection query (compact, single-line safe). */
export const GRAPHQL_INTROSPECTION_QUERY = `query IntrospectionQuery { __schema { queryType { name } mutationType { name } subscriptionType { name } types { kind name description fields(includeDeprecated: true) { name description args { name description type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } isDeprecated deprecationReason } inputFields { name description type { kind name ofType { kind name ofType { kind name } } } defaultValue } interfaces { name } enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason } possibleTypes { name } } directives { name description locations args { name description type { kind name ofType { kind name ofType { kind name } } } defaultValue } } } }`;

/** Minimal probe: tiny query that only succeeds when introspection is on. */
export const GRAPHQL_MIN_PROBE_QUERY = `query { __schema { queryType { name } } }`;

/**
 * Build the introspection request body for a /graphql endpoint probe.
 * @param {'full'|'minimal'} [variant]
 * @returns {{query: string, operationName: string, variables: object}}
 */
export function graphqlIntrospectionQuery(variant = 'full') {
  const query = variant === 'minimal' ? GRAPHQL_MIN_PROBE_QUERY : GRAPHQL_INTROSPECTION_QUERY;
  return { query, operationName: 'IntrospectionQuery', variables: {} };
}

/**
 * Interpret a GraphQL response to the introspection probe.
 * @param {object|string} responseBody - Parsed JSON or raw text.
 * @returns {{introspectionEnabled: boolean, queryType: string|null, typeCount: number, types: string[]}}
 */
export function parseGraphqlIntrospectionResponse(responseBody) {
  const result = { introspectionEnabled: false, queryType: null, typeCount: 0, types: [] };
  let doc = responseBody;
  if (typeof doc === 'string') {
    try { doc = JSON.parse(doc); } catch { return result; }
  }
  const schema = doc && doc.data && doc.data.__schema;
  if (!schema || typeof schema !== 'object') return result;
  result.introspectionEnabled = true;
  result.queryType = schema.queryType ? schema.queryType.name : null;
  const types = Array.isArray(schema.types) ? schema.types : [];
  result.typeCount = types.length;
  result.types = types.map(t => t.name).filter(Boolean).slice(0, 300);
  return result;
}

/** Candidate GraphQL endpoint paths beyond the conventional /graphql. */
export const GRAPHQL_PATHS = [
  '/graphql', '/graphql/', '/api/graphql', '/v1/graphql', '/v2/graphql',
  '/graphiql', '/api/graphiql', '/playground', '/api/playground',
  '/gql', '/api/gql', '/query', '/api/query',
];

/**
 * Build absolute GraphQL endpoint probe URLs.
 * @param {string} baseUrl
 * @returns {string[]}
 */
export function graphqlCandidatePaths(baseUrl = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  return GRAPHQL_PATHS.map(p => `${base}${p}`);
}

// ---------------------------------------------------------------------------
// Finding builder
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ApiSpecProbeSummary
 * @property {string} category - Spec category (swagger, fastapi, actuator, postman, asyncapi, wsdl, wadl, odata, graphql).
 * @property {boolean} exposed - Whether the spec/doc surface was found exposed.
 * @property {string} detail - Human-readable summary.
 * @property {number} [routeCount] - Number of routes/endpoints enumerated.
 * @property {boolean} [sensitive] - Whether sensitive data was observed.
 */

/**
 * Build a standardized report finding from API-spec recon results.
 * @param {ApiSpecProbeSummary} summary
 * @returns {{title: string, severity: string, confidence: string, category: string, detail: string, routeCount: number, recommendation: string}}
 */
export function apiSpecFinding(summary = {}) {
  const {
    category = 'unknown',
    exposed = false,
    detail = '',
    routeCount = 0,
    sensitive = false,
  } = summary;
  const severity = !exposed ? 'Info' : sensitive ? 'High' : routeCount > 0 ? 'Medium' : 'Low';
  return {
    title: exposed
      ? `${category} specification surface exposed (${routeCount} route(s) enumerated)`
      : `${category} specification surface not exposed`,
    severity,
    confidence: exposed ? 'high' : 'medium',
    category,
    detail,
    routeCount,
    recommendation: exposed
      ? 'Restrict API documentation and metadata endpoints to authenticated/internal access on the authorized target; disable introspection and actuator exposure in production profiles.'
      : 'No exposed specification surface detected at the probed paths.',
  };
}

/**
 * Named-function registry plus constants, mirroring the engine convention.
 */
export const API_SPEC_RECON = {
  // 01001
  buildSwaggerProbePaths,
  parseSwaggerResponse,
  SWAGGER_DOC_PATHS,
  // 01002
  buildFastApiProbePaths,
  detectFastApiDocs,
  FASTAPI_DOC_PATHS,
  // 01003
  actuatorPathList,
  parseActuatorResponse,
  redactSensitiveValue,
  ACTUATOR_ENDPOINTS,
  ACTUATOR_BASE_PATHS,
  ACTUATOR_SENSITIVE_ENDPOINTS,
  // 01004
  postmanQueryBuilder,
  extractPostmanEndpoints,
  // 01005
  asyncapiCandidatePaths,
  parseAsyncApiResponse,
  ASYNCAPI_PATHS,
  // 01006
  wsdlCandidatePaths,
  parseWsdlResponse,
  WSDL_PATHS,
  // 01007
  wadlCandidatePaths,
  parseWadlResponse,
  WADL_PATHS,
  // 01008
  odataMetadataParser,
  // 01009
  odataBatchProbeDescriptor,
  // 01010
  graphqlIntrospectionQuery,
  parseGraphqlIntrospectionResponse,
  graphqlCandidatePaths,
  GRAPHQL_INTROSPECTION_QUERY,
  GRAPHQL_MIN_PROBE_QUERY,
  GRAPHQL_PATHS,
  // finding
  apiSpecFinding,
};

export default API_SPEC_RECON;
