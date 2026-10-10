/**
 * apiPathIntel.js — API-path intelligence probe builder and response analyzer.
 *
 * Idea 01091: Common Crawl API path harvest — parse Common Crawl index
 * rows (operator-supplied) for a target's API paths, because petabyte-scale
 * crawls capture endpoints missed by live spidering.
 *
 * Idea 01092: GitHub code-search API dorking — build code-search dork
 * strings for the target and extract private API endpoints from
 * operator-supplied code/search-result text (leaked client code and
 * Postman dumps contain private endpoints).
 *
 * Idea 01093: Build-ID to API-version mapping — extract frontend build IDs
 * from operator-supplied bundle/HTML text and correlate them with observed
 * API versions across deploys, since build markers reveal which API
 * version each deploy talks to.
 *
 * Idea 01094: JS bundle API-version strings — grep operator-supplied
 * bundle text for /v\d/ literals and API_BASE constants, because compiled
 * frontends hardcode version prefixes.
 *
 * Idea 01095: API error framework fingerprinting — classify error response
 * shapes (Django REST, Rails, FastAPI, Spring, Express) from
 * operator-supplied error bodies, since framework identity unlocks
 * framework-specific default routes.
 *
 * Idea 01096: Verbose validation-error schema leak — parse
 * operator-supplied 422/400 validation error bodies into field names,
 * messages, types and constraints, because detailed validation messages
 * enumerate the request schema.
 *
 * Idea 01097: Field-name oracle via 400s — build ready-to-send probe
 * descriptors that submit candidate fields one at a time, and diff the
 * operator-supplied per-field error responses against a known-unknown
 * baseline to confirm which fields exist.
 *
 * Idea 01098: 422-vs-400 differential mapping — group operator-supplied
 * malformed-input responses by status code and map them onto validation
 * pipeline stages, because status-code differences reveal the pipeline's
 * stages.
 *
 * Idea 01099: Nested-object validation depth probe — build probe
 * descriptors carrying deeply nested JSON payloads, and detect the
 * nesting-depth cutoff from operator-supplied results, since deep-nesting
 * cutoffs expose parser thresholds.
 *
 * Idea 01100: Array-length limit probing — build probe descriptors with
 * geometrically growing array payloads, and estimate the batch ceiling
 * from operator-supplied results, because length limits reveal
 * batch-operation ceilings.
 *
 * No network calls: every function operates on operator-supplied strings
 * and objects (Common Crawl index rows, code-search result text, build
 * IDs, bundle text, error response bodies/status codes). Probe builders
 * return ready-to-send descriptors; analyzers parse returned text. The
 * agent's network layer performs transport. Defensive API surface mapping
 * of the engagement's own authorized target only.
 */

/**
 * Extract the path portion of a URL string without URL-parsing side
 * effects on malformed crawl rows.
 * @param {string} rawUrl
 * @returns {string} Path with query/fragment stripped.
 */
function urlPathOf(rawUrl) {
  const u = String(rawUrl || '');
  const noScheme = u.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*/, '');
  const noCreds = noScheme.replace(/^[^@/]*@/, '');
  return (noCreds.split(/[?#]/)[0] || '/');
}

/** File extensions that are never API paths. */
const STATIC_EXT_RE = /\.(js|mjs|cjs|css|scss|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|otf|map|mp4|webm|mp3|wav|pdf|zip|gz|tar|xml|txt|csv)$/i;

/** Path shapes that mark an API route. */
const API_PATH_RE = /(\/api(\/|$)|\/v\d+(\/|$)|\/graphql(\/|$)|\/rest(\/|$)|\/_?next\/data\/|\/wp-json(\/|$))/i;

/** Default Common Crawl index aliases to query (operator fetches them). */
const COMMON_CRAWL_INDEXES = ['CC-MAIN-2026-30', 'CC-MAIN-2026-22', 'CC-MAIN-2026-13'];

/**
 * Idea 01091 — build Common Crawl index API query URL strings for the
 * target domain. The operator fetches these; this module only parses the
 * returned rows (see parseCommonCrawlRows). No network call is made here.
 * @param {string} domain - Target domain, e.g. "api.example.com".
 * @param {{indexes?: string[], urlFilter?: string}} [options]
 * @returns {string[]} Ready-to-fetch index query URLs.
 */
export function buildCommonCrawlQueries(domain, options = {}) {
  const { indexes = COMMON_CRAWL_INDEXES, urlFilter = '.*(api|v[0-9]|graphql|rest).*' } = options;
  const d = String(domain || '').trim();
  if (!d) return [];
  return (indexes || []).map(idx =>
    `https://index.commoncrawl.org/${encodeURIComponent(idx)}-index?url=${encodeURIComponent(`${d}/*`)}&output=json&filter=url:${encodeURIComponent(urlFilter)}`);
}

/**
 * Idea 01091 — harvest API paths from operator-supplied Common Crawl
 * index rows. Rows may be parsed JSON objects ({url, mime, timestamp,
 * digest}) or raw JSONL strings. Filters to JSON-ish API responses,
 * dedupes by normalized path, and returns first/last seen timestamps.
 * @param {(object|string)[]} rows - Common Crawl index rows.
 * @param {{mimeAllow?: string[], includeNonJson?: boolean, maxPaths?: number}} [options]
 * @returns {{paths: object[], totalRows: number, matchedRows: number, skippedRows: number}}
 */
export function parseCommonCrawlRows(rows = [], options = {}) {
  const {
    mimeAllow = ['application/json', 'application/problem+json', 'application/vnd.api+json', 'application/hal+json'],
    includeNonJson = false,
    maxPaths = 1000,
  } = options;
  const byPath = new Map();
  let matchedRows = 0;
  let skippedRows = 0;
  for (const raw of rows || []) {
    let row = raw;
    if (typeof raw === 'string') {
      try {
        row = JSON.parse(raw);
      } catch {
        skippedRows += 1;
        continue;
      }
    }
    if (!row || typeof row !== 'object') {
      skippedRows += 1;
      continue;
    }
    const url = String(row.url || '');
    const path = urlPathOf(url);
    const mime = String(row.mime || '').split(';')[0].trim().toLowerCase();
    if (!url || !API_PATH_RE.test(path) || STATIC_EXT_RE.test(path)) {
      skippedRows += 1;
      continue;
    }
    if (!includeNonJson && mime && !mimeAllow.includes(mime)) {
      skippedRows += 1;
      continue;
    }
    matchedRows += 1;
    const norm = path.replace(/\/+$/, '') || '/';
    const existing = byPath.get(norm);
    const ts = String(row.timestamp || '');
    const entry = {
      path: norm,
      url,
      count: (existing ? existing.count : 0) + 1,
      mimes: [...new Set([...(existing ? existing.mimes : []), mime || 'unknown'])],
      firstSeen: existing ? (ts && ts < existing.firstSeen ? ts : existing.firstSeen) : ts,
      lastSeen: existing ? (ts && ts > existing.lastSeen ? ts : existing.lastSeen) : ts,
    };
    byPath.set(norm, entry);
  }
  const paths = [...byPath.values()]
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, maxPaths);
  return { paths, totalRows: (rows || []).length, matchedRows, skippedRows };
}

/**
 * Idea 01092 — build GitHub code-search dork strings targeting the
 * engagement's own API base URLs: leaked client code, Postman dumps and
 * environment files frequently contain private endpoints.
 * @param {{domain?: string, apiBases?: string[]}} target
 * @returns {string[]} Dork query strings for the operator to run.
 */
export function buildCodeSearchDorks(target = {}) {
  const domain = String(target.domain || '').trim();
  const apiBases = (target.apiBases || []).map(b => String(b).trim()).filter(Boolean);
  const dorks = new Set();
  for (const base of apiBases) {
    const host = base.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').split('/')[0];
    dorks.add(`"${base}" filename:postman_collection`);
    dorks.add(`"${base}" extension:json path:postman`);
    dorks.add(`"${base}" extension:json "base_url"`);
    dorks.add(`"${base}" extension:js "baseURL"`);
    if (host) dorks.add(`"${host}" extension:env`);
  }
  if (domain) {
    dorks.add(`"${domain}" "baseURL" extension:js`);
    dorks.add(`"${domain}" "api/v" extension:json`);
    dorks.add(`"${domain}" filename:.env`);
    dorks.add(`"${domain}" path:postman`);
  }
  return [...dorks];
}

/**
 * Idea 01092 — extract private API endpoints from operator-supplied
 * code-search result text: Postman collection JSON, templated
 * {{base_url}} URLs, and API-looking URL literals.
 * @param {string} codeText - Code-search results / file text.
 * @param {{domainHint?: string, maxEndpoints?: number}} [options]
 * @returns {{endpoints: object[], postmanCollections: number}}
 */
export function extractPrivateEndpoints(codeText = '', options = {}) {
  const { domainHint = '', maxEndpoints = 500 } = options;
  const text = String(codeText || '');
  const endpoints = new Map();
  const add = (endpoint, source, evidence) => {
    if (endpoints.size >= maxEndpoints) return;
    const key = `${source}:${endpoint}`;
    if (!endpoints.has(key)) endpoints.set(key, { endpoint, source, evidence });
  };

/**
 * Scan text for balanced {...} objects (string-aware), so Postman
 * collection dumps embedded inside larger code-search result text are
 * still found.
 * @param {string} text
 * @returns {string[]} Candidate JSON object substrings.
 */
function extractBalancedObjects(text) {
  const objs = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let strCh = '';
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strCh = ch;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objs.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return objs;
}

/**
 * Collect Postman collection documents from text: either the whole text
 * is a collection JSON document, or one or more balanced {...} blobs
 * inside it are.
 * @param {string} text
 * @returns {object[]} Parsed Postman collection documents.
 */
function findPostmanDocs(text) {
  const docs = [];
  const candidates = [text.trim()];
  for (const blob of extractBalancedObjects(text)) {
    if (blob.length < text.trim().length) candidates.push(blob);
  }
  for (const candidate of candidates) {
    if (!candidate.includes('_postman_id')) continue;
    let parsed = null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const doc of list) {
      if (doc && typeof doc === 'object' && doc.info && Array.isArray(doc.item) && !docs.includes(doc)) docs.push(doc);
    }
  }
  return docs;
}
  // Postman collection JSON: harvest request URLs (whole document or
  // collection blobs embedded in larger result text).
  const postmanDocs = findPostmanDocs(text);
  for (const doc of postmanDocs) {
    const walk = items => {
      for (const item of items || []) {
        if (item.item) {
          walk(item.item);
          continue;
        }
        const req = item && item.request;
        const u = req && (typeof req === 'string' ? req : req.url);
        const raw = u && (typeof u === 'string' ? u : u.raw);
        if (raw && /api|\/v\d+\/|graphql/i.test(String(raw))) {
          add(String(raw), 'postman-collection', `Request "${item.name || 'unnamed'}" inside a Postman collection dump.`);
        }
      }
    };
    walk(doc.item);
  }

  // Templated {{base_url}} / {{host}} style URLs from env dumps.
  const tplRe = /["'`](https?:\/\/\{\{[^"'`}]+\}\}\/[^"'`]*|\{\{[^"'`}]+\}\}\/[A-Za-z0-9_\-./{}]+)["'`]/g;
  let m;
  while ((m = tplRe.exec(text)) !== null && endpoints.size < maxEndpoints) {
    add(m[1], 'env-template', 'Templated URL literal (e.g. leaked .env / Postman environment).');
  }

  // Plain URL literals that look like API endpoints.
  const urlRe = /["'`](https?:\/\/[A-Za-z0-9_.-]+(?::\d+)?\/[A-Za-z0-9_\-./{}:?&=+%#]*)["'`]/g;
  while ((m = urlRe.exec(text)) !== null && endpoints.size < maxEndpoints) {
    const u = m[1];
    if (STATIC_EXT_RE.test(u)) continue;
    const looksApi = /(\/api\b|\/v\d+\b|graphql|\/rest\b)/i.test(u);
    const matchesHint = domainHint ? u.includes(domainHint) : true;
    if (looksApi && matchesHint) {
      add(u, 'url-literal', 'API-looking absolute URL literal in leaked client code.');
    }
  }

  const list = [...endpoints.values()].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  return { endpoints: list, postmanCollections: postmanDocs.length };
}

/** Build-ID marker patterns keyed by source framework. */
const BUILD_ID_PATTERNS = [
  { kind: 'nextjs-build-id', re: /"buildId"\s*:\s*"([A-Za-z0-9_-]{6,64})"/g },
  { kind: 'data-build-id', re: /data-build-id=["']([^"']{4,64})["']/gi },
  { kind: 'meta-build-id', re: /<meta[^>]+name=["']build-id["'][^>]+content=["']([^"']{4,64})["']/gi },
  { kind: 'js-build-id-global', re: /__(?:BUILD_ID|APP_BUILD|REVISION|COMMIT_HASH)__\s*=\s*["']([^"']{4,64})["']/g },
  { kind: 'webpack-chunkhash', re: /\/([a-f0-9]{20})\.(?:js|css)(?:[?"']|$)/gi },
  { kind: 'nextjs-static-prefix', re: /\/_next\/static\/([A-Za-z0-9_-]{8,32})\//g },
  { kind: 'vite-asset-hash', re: /\/assets\/[A-Za-z0-9_.-]*?-([A-Za-z0-9_-]{8})\.(?:js|css)/g },
  { kind: 'api-version-meta', re: /<meta[^>]+name=["']api-version["'][^>]+content=["']([^"']{1,32})["']/gi },
];

/**
 * Idea 01093 — extract frontend build IDs (and declared API-version
 * meta tags) from operator-supplied HTML/bundle text.
 * @param {string} pageText - HTML page text and/or bundle text.
 * @param {{maxIds?: number}} [options]
 * @returns {{buildIds: object[]}} Deduped build markers with kind labels.
 */
export function extractBuildIds(pageText = '', options = {}) {
  const { maxIds = 100 } = options;
  const text = String(pageText || '');
  const found = new Map();
  for (const { kind, re } of BUILD_ID_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null && found.size < maxIds) {
      const value = String(m[1]);
      const key = `${kind}:${value}`;
      if (!found.has(key)) found.set(key, { value, kind });
    }
  }
  return { buildIds: [...found.values()] };
}

/**
 * Idea 01093 — correlate build IDs with observed API versions across
 * deploys. Records are operator-supplied observations of the form
 * {buildId, apiVersion, observedAt}. Flags builds whose API version
 * changed mid-deploy and version skew across concurrent builds.
 * @param {{buildId: string, apiVersion?: string|null, observedAt?: string|null}[]} observations
 * @returns {{mapping: object[], versionSkew: object[], findings: object[]}}
 */
export function correlateBuildApiVersions(observations = []) {
  const byBuild = new Map();
  for (const o of observations || []) {
    if (!o || !o.buildId) continue;
    const id = String(o.buildId);
    if (!byBuild.has(id)) byBuild.set(id, { buildId: id, apiVersions: new Set(), observations: [] });
    const rec = byBuild.get(id);
    if (o.apiVersion != null && o.apiVersion !== '') rec.apiVersions.add(String(o.apiVersion));
    rec.observations.push({ apiVersion: o.apiVersion == null ? null : String(o.apiVersion), observedAt: o.observedAt || null });
  }
  const mapping = [];
  const findings = [];
  for (const rec of byBuild.values()) {
    const versions = [...rec.apiVersions].sort();
    const entry = { buildId: rec.buildId, apiVersions: versions, observationCount: rec.observations.length, stable: versions.length <= 1 };
    mapping.push(entry);
    if (versions.length > 1) {
      findings.push({
        type: 'build-api-version-drift',
        confidence: 'high',
        evidence: `Build "${rec.buildId}" was observed talking to ${versions.length} API versions (${versions.join(', ')}); a single deploy should pin one version — drift implies mid-deploy backend swaps or version-flexible routing.`,
        buildId: rec.buildId,
        apiVersions: versions,
      });
    }
  }
  mapping.sort((a, b) => a.buildId.localeCompare(b.buildId));
  const distinct = new Set();
  for (const rec of mapping) for (const v of rec.apiVersions) distinct.add(v);
  const versionSkew = distinct.size > 1
    ? [{ type: 'concurrent-version-skew', confidence: 'medium', evidence: `Concurrent builds expose ${distinct.size} distinct API versions: ${[...distinct].sort().join(', ')}. Version markers reveal which backend each deploy talks to — probe every version prefix.` }]
    : [];
  return { mapping, versionSkew, findings: [...findings, ...versionSkew] };
}

/**
 * Idea 01094 — grep operator-supplied JS bundle text for hardcoded API
 * version strings: /v\d/ path literals and API_BASE / baseURL constants.
 * @param {string} bundleText - Raw JavaScript bundle text.
 * @param {{maxSamples?: number}} [options]
 * @returns {{versions: object[], baseConstants: object[]}}
 */
export function grepBundleApiVersions(bundleText = '', options = {}) {
  const { maxSamples = 10 } = options;
  const text = String(bundleText || '');
  const byVersion = new Map();
  const record = (version, sample) => {
    const key = String(version);
    if (!byVersion.has(key)) byVersion.set(key, { version: key, hits: 0, samples: [] });
    const rec = byVersion.get(key);
    rec.hits += 1;
    if (rec.samples.length < maxSamples && !rec.samples.includes(sample)) rec.samples.push(sample);
  };
  // /v2/, /api/v1/, "/v3" path literals.
  const vRe = /["'`](?:[^"'`]*?)(\/v\d+(?:\.\d+)?)(?:\/|["'`]|$)/g;
  let m;
  while ((m = vRe.exec(text)) !== null) record(m[1], m[1]);
  // Bare "v2" in API-ish constant names: API_V2, apiVersion:"v3".
  const namedRe = /(?:api[_-]?version|API_VERSION|apiVersion)\s*[:=]\s*["']?(v\d+(?:\.\d+)?)["']?/gi;
  while ((m = namedRe.exec(text)) !== null) record(`/${m[1]}`, `${m[0].slice(0, 60)}`);

  // API_BASE / baseURL constants and their values.
  const baseConstants = [];
  const seen = new Set();
  const constRe = /((?:API_BASE(?:_URL)?|apiBaseUrl|baseURL|BASE_API_URL|API_URL))\s*[:=]\s*["'`]([^"'`]{1,160})["'`]/g;
  while ((m = constRe.exec(text)) !== null) {
    const key = `${m[1]}=${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const vMatch = m[2].match(/\/v\d+(?:\.\d+)?/);
    baseConstants.push({ name: m[1], value: m[2], impliedVersion: vMatch ? vMatch[0] : null });
  }

  const versions = [...byVersion.values()].sort((a, b) => b.hits - a.hits);
  return { versions, baseConstants };
}

/** Framework signatures matched against error response bodies. */
const FRAMEWORK_SIGNATURES = [
  {
    framework: 'Django REST Framework',
    confidence: 'high',
    tests: [
      { label: 'drf-detail-key', re: /"detail"\s*:\s*"(Not authenticated|Authentication credentials|CSRF Failed|Method .* not allowed|Not found)/ },
      { label: 'drf-field-errors', re: /"\w+"\s*:\s*\[\s*"This field (is required|may not be blank)/ },
      { label: 'drf-non-field-errors', re: /"non_field_errors"/ },
    ],
  },
  {
    framework: 'FastAPI',
    confidence: 'high',
    tests: [
      { label: 'fastapi-loc-msg-type', re: /"loc"\s*:\s*\[[^\]]*\]\s*,\s*"msg"\s*:\s*"[^"]*"\s*,\s*"type"\s*:\s*"/ },
      { label: 'fastapi-validation-detail', re: /"detail"\s*:\s*\[\s*\{\s*"loc"/ },
      { label: 'fastapi-pydantic', re: /pydantic/i },
    ],
  },
  {
    framework: 'Ruby on Rails',
    confidence: 'high',
    tests: [
      { label: 'rails-routing-error', re: /ActionController::RoutingError|No route matches/i },
      { label: 'rails-app-trace', re: /Application Trace|Full Trace/i },
      { label: 'rails-params', re: /"controller"\s*:\s*"[^"]*"\s*,\s*"action"\s*:/ },
    ],
  },
  {
    framework: 'Spring Boot',
    confidence: 'high',
    tests: [
      { label: 'spring-error-envelope', re: /"timestamp"\s*:\s*"[^"]*"\s*,\s*"status"\s*:\s*\d+\s*,\s*"error"\s*:\s*"/ },
      { label: 'spring-whitelabel', re: /Whitelabel Error Page/i },
      { label: 'spring-path-key', re: /"error"\s*:\s*"(Bad Request|Not Found|Internal Server Error)"\s*,\s*"message"\s*:/ },
    ],
  },
  {
    framework: 'Express',
    confidence: 'high',
    tests: [
      { label: 'express-cannot-get', re: /Cannot (GET|POST|PUT|PATCH|DELETE) \// },
      { label: 'express-stack-html', re: /<pre>Error:[\s\S]{0,200}?at (Layer|Router)\.handle/ },
      { label: 'express-powered-by', re: /X-Powered-By:\s*Express/i },
    ],
  },
];

/**
 * Idea 01095 — classify the framework behind an API error response from
 * the operator-supplied error body (and optional status). Framework
 * identity unlocks framework-specific default routes (e.g. /actuator,
 * /api-docs, /rails/info) for the operator's authorized retest.
 * @param {string} errorBody - Raw error response body text.
 * @param {{status?: number|null, headers?: Object<string,string>}} [options]
 * @returns {{framework: string|null, confidence: string, matchedSignatures: string[], candidates: object[]}}
 */
export function fingerprintErrorFramework(errorBody = '', options = {}) {
  const body = String(errorBody || '');
  const headerText = Object.entries(options.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  const haystack = `${body}\n${headerText}`;
  const candidates = [];
  for (const sig of FRAMEWORK_SIGNATURES) {
    const matched = sig.tests.filter(t => t.re.test(haystack)).map(t => t.label);
    if (matched.length) {
      candidates.push({ framework: sig.framework, confidence: sig.confidence, matchedSignatures: matched, score: matched.length });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] || null;
  return {
    framework: best ? best.framework : null,
    confidence: best ? best.confidence : 'none',
    matchedSignatures: best ? best.matchedSignatures : [],
    candidates: candidates.map(({ score, ...rest }) => rest),
  };
}

/**
 * Idea 01096 — parse an operator-supplied verbose validation error body
 * into an enumerated request schema: field names, messages, inferred
 * types and constraints (min/max, patterns, choices). Works on
 * DRF-style {"field": ["msg"]}, FastAPI {"detail":[{loc,msg,type}]},
 * and Spring {"errors":[{field,message}]} shapes.
 * @param {string} errorBody - Raw 4xx validation error body.
 * @returns {{fields: object[], unparsed: boolean, shape: string|null}}
 */
export function extractValidationSchema(errorBody = '') {
  const fields = [];
  let shape = null;
  const text = String(errorBody || '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { fields, unparsed: true, shape: null };
  }

  const constraintFrom = msg => {
    const constraints = [];
    const s = String(msg);
    let m;
    if ((m = s.match(/at least (\d+)/i))) constraints.push(`min:${m[1]}`);
    if ((m = s.match(/at most (\d+)|no more than (\d+)/i))) constraints.push(`max:${m[1] || m[2]}`);
    if ((m = s.match(/between (\d+) and (\d+)/i))) constraints.push(`min:${m[1]}`, `max:${m[2]}`);
    if (/match(?:es|ing)? (the )?pattern/i.test(s) || /invalid format/i.test(s)) constraints.push('pattern');
    // "must match "^[a-z]+$"" — match + regex metacharacters implies a pattern constraint.
    if (!constraints.includes('pattern') && /\bmatch(?:es|ing)?\b/i.test(s) && /[\^$\[\]\\]/.test(s)) constraints.push('pattern');
    if ((m = s.match(/one of ([^.]+)/i))) constraints.push(`choices:${m[1].trim()}`);
    if (/valid email/i.test(s)) constraints.push('format:email');
    if (/valid (url|uri)/i.test(s)) constraints.push('format:url');
    if (/uuid/i.test(s)) constraints.push('format:uuid');
    if (/integer/i.test(s)) constraints.push('type:integer');
    if (/number/i.test(s)) constraints.push('type:number');
    if (/boolean/i.test(s)) constraints.push('type:boolean');
    if (/array|list/i.test(s)) constraints.push('type:array');
    return constraints;
  };
  const pushField = (name, messages, inferredType = null) => {
    const msgs = (Array.isArray(messages) ? messages : [messages]).map(String);
    const constraints = [];
    for (const msg of msgs) for (const c of constraintFrom(msg)) if (!constraints.includes(c)) constraints.push(c);
    const required = msgs.some(m => /required|may not be (blank|null)|missing/i.test(m));
    fields.push({ name: String(name), messages: msgs, constraints, required, inferredType });
  };

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.detail) && parsed.detail.every(d => d && typeof d === 'object' && 'loc' in d)) {
      // FastAPI / pydantic shape.
      shape = 'fastapi';
      for (const d of parsed.detail) {
        const loc = Array.isArray(d.loc) ? d.loc.filter(p => p !== 'body').join('.') : String(d.loc || '');
        pushField(loc || '(root)', d.msg || '', /int/i.test(d.type || '') ? 'integer' : null);
      }
    } else if (Array.isArray(parsed.errors) && parsed.errors.every(e => e && typeof e === 'object' && ('field' in e || 'message' in e))) {
      // Spring-style shape.
      shape = 'spring';
      for (const e of parsed.errors) pushField(e.field || e.objectName || '(unknown)', e.message || e.defaultMessage || '');
    } else if (!Array.isArray(parsed)) {
      // DRF-style {"field": ["msg"]} shape.
      const keys = Object.keys(parsed).filter(k => k !== 'detail' && k !== 'message');
      if (keys.length && keys.every(k => Array.isArray(parsed[k]) || typeof parsed[k] === 'string')) {
        shape = 'drf';
        for (const k of keys) pushField(k, parsed[k]);
      } else if (typeof parsed.detail === 'string' || typeof parsed.message === 'string') {
        shape = 'simple';
        pushField('(root)', parsed.detail || parsed.message);
      }
    }
  }
  return { fields, unparsed: false, shape };
}

/**
 * Idea 01097 — build ready-to-send field-oracle probe descriptors: submit
 * each candidate field name one at a time alongside a known-valid control
 * field, so the operator's network layer can diff the returned 400s.
 * @param {string} path - Target endpoint path.
 * @param {string[]} candidateFields - Field names to test for existence.
 * @param {{method?: string, controlField?: string, controlValue?: string, sentinel?: string}} [options]
 * @returns {{label: string, method: string, path: string, contentType: string, body: object, detect: string}[]}
 */
export function buildFieldOracleProbes(path, candidateFields = [], options = {}) {
  const { method = 'POST', controlField = 'ping', controlValue = '1', sentinel = '__oracle__' } = options;
  const p = String(path || '');
  return (candidateFields || [])
    .map(f => String(f || '').trim())
    .filter(Boolean)
    .map(field => ({
      label: `field-oracle:${field}`,
      method,
      path: p,
      contentType: 'application/json',
      body: { [controlField]: controlValue, [field]: sentinel },
      detect: `field exists if the 400 names "${field}" with a value/shape complaint instead of an unknown-field rejection matching the baseline`,
    }));
}

/**
 * Idea 01097 — diff per-field oracle responses against a known-unknown
 * baseline response. A field is confirmed when its error names the field
 * and differs from the baseline's unknown-field rejection; it is rejected
 * when the response matches the baseline pattern.
 * @param {{status: number, body: string}} baseline - Response for a definitely-nonexistent field.
 * @param {{field: string, status: number, body: string}[]} results - Per-candidate responses.
 * @returns {{confirmed: string[], rejected: string[], ambiguous: object[]}}
 */
export function fieldOracleDiff(baseline, results = []) {
  const confirmed = [];
  const rejected = [];
  const ambiguous = [];
  const base = baseline || { status: 0, body: '' };
  const baseBody = String(base.body || '');
  const unknownMarkers = ['unknown field', 'unexpected field', 'not allowed', 'not recognized', 'invalid field', 'additional properties'];
  const baseSaysUnknown = unknownMarkers.some(m => baseBody.toLowerCase().includes(m));
  for (const r of results || []) {
    const field = String((r && r.field) || '');
    const body = String((r && r.body) || '');
    const status = r ? r.status : 0;
    const lower = body.toLowerCase();
    const namesField = lower.includes(field.toLowerCase());
    const saysUnknown = unknownMarkers.some(m => lower.includes(m));
    if (namesField && !saysUnknown && (status !== base.status || body !== baseBody)) {
      confirmed.push(field);
    } else if (saysUnknown && status === base.status && (baseSaysUnknown || body === baseBody)) {
      rejected.push(field);
    } else if (!namesField && status === base.status && body === baseBody) {
      rejected.push(field);
    } else {
      ambiguous.push({ field, status, reason: 'response neither confirms the field nor matches the unknown-field baseline' });
    }
  }
  return { confirmed, rejected, ambiguous };
}

/** Human-readable stage names inferred from HTTP status codes. */
const STATUS_STAGE_HINTS = [
  { test: s => s === 404 || s === 405, stage: 'routing', signal: 'route/method resolution' },
  { test: s => s === 400, stage: 'syntax', signal: 'request parsing / unknown-field rejection' },
  { test: s => s === 413 || s === 414, stage: 'limits', signal: 'payload/URI size limits' },
  { test: s => s === 415, stage: 'content-type', signal: 'media-type negotiation' },
  { test: s => s === 422, stage: 'semantic', signal: 'schema/semantic validation' },
  { test: s => s === 401 || s === 403, stage: 'auth', signal: 'authentication/authorization' },
  { test: s => s === 429, stage: 'throttle', signal: 'rate limiting' },
  { test: s => s >= 500, stage: 'crash', signal: 'unhandled exception — possible verbose leak' },
];

/**
 * Idea 01098 — map operator-supplied malformed-input responses onto
 * validation pipeline stages by status-code differential: identical
 * inputs that surface at different stages reveal the pipeline order,
 * and inputs that skip stages reveal bypassable checks.
 * @param {{inputLabel: string, status: number, body?: string}[]} responses
 * @returns {{stages: object[], anomalies: object[], findings: object[]}}
 */
export function mapValidationStages(responses = []) {
  const byStage = new Map();
  for (const r of responses || []) {
    const status = Number(r && r.status);
    const hint = STATUS_STAGE_HINTS.find(h => h.test(status)) || { stage: `http-${status}`, signal: 'unclassified status' };
    if (!byStage.has(hint.stage)) byStage.set(hint.stage, { stage: hint.stage, signal: hint.signal, inputs: [], statuses: new Set() });
    const rec = byStage.get(hint.stage);
    rec.inputs.push(String((r && r.inputLabel) || `status-${status}`));
    rec.statuses.add(status);
  }
  const stageOrder = ['routing', 'auth', 'throttle', 'content-type', 'syntax', 'limits', 'semantic', 'crash'];
  const stages = [...byStage.values()]
    .map(s => ({ stage: s.stage, signal: s.signal, inputs: s.inputs, statuses: [...s.statuses].sort((a, b) => a - b) }))
    .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));

  const anomalies = [];
  const findings = [];
  const has = name => stages.some(s => s.stage === name);
  if (has('semantic') && !has('syntax')) {
    anomalies.push({ type: 'missing-syntax-stage', evidence: '422s observed with no 400s: the target may skip syntactic checks and go straight to semantic validation.' });
  }
  if (has('crash')) {
    const crash = stages.find(s => s.stage === 'crash');
    anomalies.push({ type: 'validation-crash', evidence: `Malformed input reached an unhandled exception (${crash.statuses.join(', ')}): ${crash.inputs.join(', ')}.` });
    findings.push({
      type: 'validation-pipeline-crash',
      confidence: 'high',
      evidence: `Input(s) ${crash.inputs.slice(0, 5).join(', ')} crashed validation (HTTP ${crash.statuses.join('/')}). Crashes often leak stack traces — capture the body.`,
    });
  }
  const bothBad = stages.filter(s => s.stage === 'syntax' || s.stage === 'semantic');
  if (bothBad.length === 2) {
    findings.push({
      type: 'two-stage-validation',
      confidence: 'high',
      evidence: `Target runs a two-stage pipeline: syntax/parsing (400: ${bothBad.find(s => s.stage === 'syntax').inputs.length} input(s)) then semantic validation (422: ${bothBad.find(s => s.stage === 'semantic').inputs.length} input(s)). Inputs rejected at 400 never reach business logic; craft payloads that survive stage one to probe stage two.`,
    });
  }
  return { stages, anomalies, findings };
}

/**
 * Idea 01099 — build ready-to-send nested-object depth probes: payloads
 * with geometrically increasing nesting depth to find the parser's
 * recursion cutoff.
 * @param {string} path - Target endpoint path.
 * @param {{method?: string, field?: string, depths?: number[]}} [options]
 * @returns {{label: string, method: string, path: string, contentType: string, body: object, depth: number, detect: string}[]}
 */
export function buildNestedDepthProbes(path, options = {}) {
  const { method = 'POST', field = 'nested', depths = [4, 8, 16, 32, 64, 128] } = options;
  const p = String(path || '');
  return (depths || []).map(depth => {
    let inner = 'leaf';
    for (let i = 0; i < depth; i++) inner = { level: inner };
    return {
      label: `nested-depth:${depth}`,
      method,
      path: p,
      contentType: 'application/json',
      body: { [field]: inner },
      depth,
      detect: `cutoff depth is where the response flips from 2xx/4xx-validation to a parser rejection (400/413/500 or recursion error) — it exposes the parser threshold`,
    };
  });
}

/**
 * Idea 01099 — detect the nesting-depth cutoff from operator-supplied
 * probe results: the shallowest depth whose response signals parser
 * rejection rather than normal validation.
 * @param {{depth: number, status: number, body?: string}[]} results
 * @returns {{cutoffDepth: number|null, lastAcceptedDepth: number|null, parserError: boolean, evidence: string}}
 */
export function detectNestingCutoff(results = []) {
  const rows = (results || [])
    .filter(r => r && Number.isFinite(Number(r.depth)))
    .map(r => ({ depth: Number(r.depth), status: Number(r.status), body: String(r.body || '') }))
    .sort((a, b) => a.depth - b.depth);
  if (!rows.length) {
    return { cutoffDepth: null, lastAcceptedDepth: null, parserError: false, evidence: 'No probe results supplied.' };
  }
  const parserErrorRe = /recursion|maximum (call )?stack|too deep|nesting|depth (exceeded|limit)|json.*depth/i;
  let cutoffDepth = null;
  let lastAcceptedDepth = null;
  let parserError = false;
  for (const r of rows) {
    const mentionsParser = parserErrorRe.test(r.body);
    const rejected = r.status === 413 || r.status >= 500 || mentionsParser || (r.status === 400 && mentionsParser);
    if (rejected && cutoffDepth === null) {
      cutoffDepth = r.depth;
      parserError = mentionsParser || r.status >= 500;
    }
    if (!rejected && cutoffDepth === null) lastAcceptedDepth = r.depth;
  }
  const evidence = cutoffDepth === null
    ? `No parser rejection up to depth ${rows[rows.length - 1].depth}; the parser tolerates at least that depth.`
    : `Parser rejected nesting at depth ${cutoffDepth}${lastAcceptedDepth !== null ? ` (deepest accepted: ${lastAcceptedDepth})` : ''}${parserError ? ' with an explicit parser/recursion error' : ''}.`;
  return { cutoffDepth, lastAcceptedDepth, parserError, evidence };
}

/**
 * Idea 01100 — build ready-to-send array-length probes: geometrically
 * growing array payloads to find the batch-operation ceiling.
 * @param {string} path - Target endpoint path.
 * @param {{method?: string, field?: string, sizes?: number[], item?: unknown}} [options]
 * @returns {{label: string, method: string, path: string, contentType: string, body: object, size: number, detect: string}[]}
 */
export function buildArrayLengthProbes(path, options = {}) {
  const { method = 'POST', field = 'items', sizes = [10, 50, 100, 250, 500, 1000, 2500, 5000], item = 1 } = options;
  const p = String(path || '');
  return (sizes || []).map(size => ({
    label: `array-length:${size}`,
    method,
    path: p,
    contentType: 'application/json',
    body: { [field]: Array.from({ length: size }, () => item) },
    size,
    detect: `first rejected size bounds the batch ceiling; a rejection message naming a maximum pins it exactly`,
  }));
}

/**
 * Idea 01100 — estimate the batch array-length ceiling from
 * operator-supplied probe results: the largest accepted size, the
 * smallest rejected size, and any explicit limit named in a rejection
 * message.
 * @param {{size: number, status: number, body?: string}[]} results
 * @returns {{acceptedMax: number|null, rejectedMin: number|null, statedLimit: number|null, ceilingRange: string, evidence: string}}
 */
export function estimateArrayCeiling(results = []) {
  const rows = (results || [])
    .filter(r => r && Number.isFinite(Number(r.size)))
    .map(r => ({ size: Number(r.size), status: Number(r.status), body: String(r.body || '') }))
    .sort((a, b) => a.size - b.size);
  let acceptedMax = null;
  let rejectedMin = null;
  let statedLimit = null;
  for (const r of rows) {
    if (r.status >= 200 && r.status < 300) {
      if (acceptedMax === null || r.size > acceptedMax) acceptedMax = r.size;
    } else if (r.status === 400 || r.status === 413 || r.status === 422) {
      if (rejectedMin === null || r.size < rejectedMin) rejectedMin = r.size;
      if (statedLimit === null) {
        const m = r.body.match(/(?:maximum|max|at most|no more than|limit(?:ed to)?)\s*(?:of\s*)?(\d+)\s*(?:items|elements|entries|objects|records)?/i);
        if (m) statedLimit = Number(m[1]);
      }
    }
  }
  const ceilingRange = statedLimit !== null
    ? `${statedLimit} (stated in rejection message)`
    : acceptedMax !== null && rejectedMin !== null
      ? `${acceptedMax + 1}–${rejectedMin}`
      : acceptedMax !== null
        ? `>${acceptedMax} (no rejection observed)`
        : rejectedMin !== null
          ? `≤${rejectedMin} (no acceptance observed)`
          : 'unknown (no usable results)';
  const evidence = `Array ceiling estimate: ${ceilingRange}. Accepted max ${acceptedMax === null ? 'n/a' : acceptedMax}; rejected min ${rejectedMin === null ? 'n/a' : rejectedMin}.`;
  return { acceptedMax, rejectedMin, statedLimit, ceilingRange, evidence };
}

/**
 * Build a uniform report finding from an API-path-intel result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function apiPathIntelFinding(result = {}) {
  const { title = 'API path intel finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `API path intel — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Fold the harvested paths, version prefixes, framework identity and validation-stage map into the authorized engagement plan: ' +
      'retest every discovered version prefix, cover framework default routes, and drive validation probes stage by stage. ' +
      'Keep crawl-derived and code-search-derived data scoped to the authorized target only.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const API_PATH_INTEL = {
  buildCommonCrawlQueries,
  parseCommonCrawlRows,
  buildCodeSearchDorks,
  extractPrivateEndpoints,
  extractBuildIds,
  correlateBuildApiVersions,
  grepBundleApiVersions,
  fingerprintErrorFramework,
  extractValidationSchema,
  buildFieldOracleProbes,
  fieldOracleDiff,
  mapValidationStages,
  buildNestedDepthProbes,
  detectNestingCutoff,
  buildArrayLengthProbes,
  estimateArrayCeiling,
  apiPathIntelFinding,
};

export default API_PATH_INTEL;
