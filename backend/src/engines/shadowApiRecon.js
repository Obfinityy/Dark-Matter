/**
 * shadowApiRecon.js — shadow / sunset / dark-launch API-surface recon probe
 * builder and response analyzer.
 *
 * Idea 01071: Old-version field-exposure diff — diff response schemas across
 * API versions because retired versions frequently return fields later
 * removed for privacy. Classifies removed fields as privacy-sensitive and
 * reports exactly which field names the old version still exposes.
 *
 * Idea 01072: Beta endpoint weak-validation hypothesis — generate beta-path
 * candidates from stable paths and score a weak-validation hypothesis per
 * path, since beta code ships with looser input validation.
 *
 * Idea 01073: Deprecated-but-live endpoint hunt — parse Sunset and
 * Deprecation response headers into structured records and build
 * ready-to-send probe descriptors so the operator can retest supposedly
 * retired routes that often remain routable.
 *
 * Idea 01074: Sunset-header catalog building — aggregate parsed
 * Sunset/Deprecation header records into a chronological catalog (timeline)
 * of supposedly dead endpoints worth retesting, deduplicated by path.
 *
 * Idea 01075: Experimental-header feature unlock — build probe descriptors
 * carrying X-Experimental-Features, X-Feature-Flags, labs and preview
 * headers/cookies, since dark-launched endpoints activate on header
 * presence alone.
 *
 * Idea 01076: Dark-launch detection via headers — diff response-header
 * snapshots captured with and without preview flags; flags new Set-Cookie
 * values and diagnostic headers as dark-launch evidence.
 *
 * Idea 01077: Canary routing header test — build probe descriptors with
 * X-Canary headers and canary cookies, since canary routers can steer a
 * client to unhardened new builds.
 *
 * Idea 01078: Shadow API detection via JS cross-reference — extract
 * fetch/XHR/Axios URL strings from JavaScript bundle text and diff them
 * against documented (OpenAPI/etc.) specs to report undocumented endpoints.
 *
 * Idea 01079: Orphan endpoint harvest from source maps — parse .js.map
 * source-map JSON for API-like string literals that were stripped from the
 * minified code.
 *
 * Idea 01080: TypeScript declaration endpoint mining — scan .d.ts text from
 * public SDKs for method names and path literals so every client-callable
 * method is enumerated for documentation comparison.
 *
 * No network calls: every function operates on operator-supplied strings
 * (response-shape descriptors, header objects, bundle text, source-map
 * JSON, .d.ts text). The agent's network layer performs the actual
 * transport; this module constructs probe descriptors for the operator to
 * send and analyzes the returned text for shadow/dead surface evidence.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

/**
 * Privacy-sensitive word tokens, matched against camelCase/snake-case word
 * parts of a field name (so "authToken" and "auth_token" both hit "auth").
 */
const PRIVACY_TOKENS = new Set([
  'ssn', 'social', 'security', 'password', 'passwd', 'pass', 'token', 'secret',
  'apikey', 'key', 'auth', 'authn', 'authz', 'credential', 'credit', 'card',
  'cvv', 'cvc', 'iban', 'account', 'routing', 'phone', 'email', 'address',
  'dob', 'birth', 'gender', 'race', 'religion', 'salary', 'income', 'balance',
  'biometric', 'fingerprint', 'faceid', 'location', 'gps', 'imei', 'mac',
  'passport', 'license', 'national', 'tax', 'maiden',
]);

/**
 * Split a field name into word tokens on camelCase/snake-case/dash boundaries.
 * @param {string} name
 * @returns {string[]}
 */
function tokenizeFieldName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map(t => t.toLowerCase())
    .filter(Boolean);
}

/** Header names that reveal dark-launch / diagnostic internals. */
const DIAGNOSTIC_HEADER_PATTERN = /^(x-(debug|trace|request|server|powered|framework|version|build|commit|revision|instance|backend|upstream|cache|profile|timing|duration|query|sql)|server|via)$/i;

/**
 * Classify field names into privacy-sensitive vs. routine.
 * @param {string[]} fields
 * @returns {{privacySensitive: string[], routine: string[]}}
 */
export function classifyPrivacyFields(fields = []) {
  const privacySensitive = [];
  const routine = [];
  for (const f of fields || []) {
    const name = String(f || '');
    if (!name) continue;
    if (tokenizeFieldName(name).some(t => PRIVACY_TOKENS.has(t))) privacySensitive.push(name);
    else routine.push(name);
  }
  return { privacySensitive, routine };
}

/**
 * Idea 01071 — diff two response-shape descriptors (lists of field names)
 * for the same logical endpoint across API versions. Fields present in the
 * old version but missing from the new one are the exposure delta; they are
 * classified by privacy sensitivity.
 * @param {string[]} oldVersionFields - Field names returned by the retired version.
 * @param {string[]} newVersionFields - Field names returned by the current version.
 * @param {{oldLabel?: string, newLabel?: string}} [options]
 * @returns {{removedFields: string[], addedFields: string[], privacySensitiveRemoved: string[], routineRemoved: string[], findings: object[]}}
 */
export function diffResponseSchemas(oldVersionFields = [], newVersionFields = [], options = {}) {
  const { oldLabel = 'v-old', newLabel = 'v-new' } = options;
  const oldSet = new Set((oldVersionFields || []).map(f => String(f)));
  const newSet = new Set((newVersionFields || []).map(f => String(f)));
  const removedFields = [...oldSet].filter(f => !newSet.has(f)).sort();
  const addedFields = [...newSet].filter(f => !oldSet.has(f)).sort();
  const { privacySensitive, routine } = classifyPrivacyFields(removedFields);
  const findings = [];
  for (const field of privacySensitive) {
    findings.push({
      type: 'privacy-field-exposed-in-old-version',
      confidence: 'high',
      evidence: `Field "${field}" returned by ${oldLabel} is absent from ${newLabel}; retired versions commonly keep exposing fields removed for privacy.`,
      field,
      oldVersion: oldLabel,
      newVersion: newLabel,
    });
  }
  if (removedFields.length && !privacySensitive.length) {
    findings.push({
      type: 'schema-drift-old-version',
      confidence: 'medium',
      evidence: `${removedFields.length} field(s) removed between ${oldLabel} and ${newLabel}: ${routine.slice(0, 8).join(', ')}${routine.length > 8 ? '…' : ''}.`,
      fields: removedFields,
      oldVersion: oldLabel,
      newVersion: newLabel,
    });
  }
  return {
    removedFields,
    addedFields,
    privacySensitiveRemoved: privacySensitive,
    routineRemoved: routine,
    findings,
  };
}

/**
 * Idea 01072 — generate beta-path candidates from stable paths by inserting
 * common beta markers, since beta deployments often live at predictable
 * sibling paths with looser validation.
 * @param {string[]} stablePaths - Documented stable endpoint paths.
 * @param {{markers?: string[]}} [options]
 * @returns {string[]} Beta candidate paths.
 */
export function betaPathCandidates(stablePaths = [], options = {}) {
  const { markers = ['beta', 'preview', 'experimental', 'staging', 'canary', 'v2beta', 'labs'] } = options;
  const out = new Set();
  for (const raw of stablePaths || []) {
    const p = String(raw || '').trim();
    if (!p) continue;
    const base = p.startsWith('/') ? p : `/${p}`;
    for (const m of markers) {
      out.add(`/${m}${base}`); // /beta/api/users
      const segments = base.split('/').filter(Boolean);
      if (segments.length >= 2) out.add(`/${segments[0]}/${m}/${segments.slice(1).join('/')}`); // /api/beta/users
      else out.add(`/${m}`);
    }
  }
  return [...out];
}

/**
 * Idea 01072 — score a weak-validation hypothesis for a beta endpoint.
 * Scores purely from surface signals: beta marker present, documented
 * parameter count unknown, path-depth divergence from the stable sibling.
 * @param {{path: string, stablePath?: string, documentedParams?: number|null}} endpoint
 * @returns {{path: string, score: number, level: string, rationale: string}}
 */
export function scoreBetaValidationHypothesis(endpoint = {}) {
  const { path = '', stablePath = '', documentedParams = null } = endpoint;
  let score = 0;
  const notes = [];
  if (/(beta|preview|experimental|staging|canary|labs)/i.test(path)) {
    score += 40;
    notes.push('beta marker in path');
  }
  if (documentedParams === null || documentedParams === undefined) {
    score += 30;
    notes.push('parameters undocumented');
  }
  const depth = p => String(p).split('/').filter(Boolean).length;
  if (stablePath && depth(path) !== depth(stablePath)) {
    score += 15;
    notes.push('segment depth differs from stable sibling');
  }
  if (/v\d+/i.test(path) && stablePath && /v\d+/i.test(path) !== /v\d+/i.test(stablePath)) {
    score += 15;
    notes.push('version marker mismatch vs stable sibling');
  }
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return {
    path: String(path),
    score: Math.min(100, score),
    level,
    rationale: notes.length
      ? `Weak-validation hypothesis (${level}, ${Math.min(100, score)}/100): ${notes.join('; ')}. Beta code typically ships with looser input validation — fuzz this path harder than the stable sibling.`
      : 'No beta weak-validation signal.',
  };
}

/**
 * Idea 01073 — parse Sunset and Deprecation response headers (RFC 8594) into
 * a structured record: the raw values, parsed sunset date, and whether the
 * endpoint is still worth retesting (no Date, or a date in the future).
 * @param {Object<string, string|string[]>} headers - Response header snapshot (case-insensitive keys).
 * @param {string} [path] - The endpoint the headers were captured from.
 * @returns {{path: string|null, deprecation: string|null, sunset: string|null, sunsetDate: string|null, stillRetestable: boolean}|null}
 */
export function parseSunsetHeaders(headers = {}, path = null) {
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[String(k).toLowerCase()] = v;
  const pick = name => {
    const v = lower[name];
    if (Array.isArray(v)) return v[0];
    return v == null ? null : String(v).trim();
  };
  const deprecation = pick('deprecation');
  const sunset = pick('sunset');
  if (deprecation === null && sunset === null) return null;
  let sunsetDate = null;
  if (sunset) {
    const d = new Date(sunset);
    if (!Number.isNaN(d.getTime())) sunsetDate = d.toISOString();
  }
  const sunsetEpoch = sunsetDate ? Date.parse(sunsetDate) : null;
  return {
    path: path == null ? null : String(path),
    deprecation,
    sunset,
    sunsetDate,
    stillRetestable: sunsetEpoch === null || sunsetEpoch > Date.now(),
  };
}

/**
 * Idea 01073 — build probe descriptors for supposedly retired endpoints so
 * the operator can retest whether the route is still routable.
 * @param {{path: string, sunsetDate?: string|null, deprecation?: string|null}[]} records - Parsed Sunset records.
 * @param {{method?: string}} [options]
 * @returns {{label: string, path: string, method: string, expectedDead: boolean, detect: string}[]}
 */
export function deprecatedEndpointProbes(records = [], options = {}) {
  const { method = 'GET' } = options;
  return (records || [])
    .filter(r => r && r.path)
    .map(r => ({
      label: `deprecated-but-live:${r.path}`,
      path: String(r.path),
      method,
      expectedDead: r.sunsetDate ? Date.parse(r.sunsetDate) <= Date.now() : false,
      detect: 'endpoint still live if the response is 2xx/3xx (not 404/410/501) and the body matches the documented deprecated contract',
    }));
}

/**
 * Idea 01074 — aggregate parsed Sunset/Deprecation records into a
 * chronological catalog (timeline) of supposedly dead endpoints, deduped by
 * path with the earliest sunset date kept.
 * @param {{path: string|null, deprecation: string|null, sunset: string|null, sunsetDate: string|null, stillRetestable: boolean}[]} records
 * @returns {{entries: object[], earliestSunset: string|null, latestSunset: string|null, retestableCount: number, deadCount: number}}
 */
export function buildSunsetCatalog(records = []) {
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const key = String(r.path);
    const existing = byPath.get(key);
    if (!existing || (r.sunsetDate && existing.sunsetDate && r.sunsetDate < existing.sunsetDate)) {
      byPath.set(key, r);
    }
  }
  const entries = [...byPath.values()].sort((a, b) => {
    if (a.sunsetDate && b.sunsetDate) return a.sunsetDate < b.sunsetDate ? -1 : 1;
    if (a.sunsetDate) return -1;
    if (b.sunsetDate) return 1;
    return String(a.path).localeCompare(String(b.path));
  });
  const dates = entries.map(e => e.sunsetDate).filter(Boolean).sort();
  return {
    entries,
    earliestSunset: dates[0] || null,
    latestSunset: dates[dates.length - 1] || null,
    retestableCount: entries.filter(e => e.stillRetestable).length,
    deadCount: entries.filter(e => !e.stillRetestable).length,
  };
}

/** Common dark-launch / experimental unlock header sets. */
const EXPERIMENTAL_HEADER_SETS = [
  { name: 'X-Experimental-Features', values: ['true', '1', 'all'] },
  { name: 'X-Feature-Flags', values: ['*'] },
  { name: 'X-Labs-Enabled', values: ['true', '1'] },
  { name: 'X-Preview', values: ['true', 'beta', 'experimental'] },
  { name: 'X-Early-Access', values: ['true', '1'] },
  { name: 'X-Dark-Launch', values: ['on', 'true', '1'] },
];

/**
 * Idea 01075 — build probe descriptors carrying experimental/labs/preview
 * headers, since dark-launched endpoints can activate on header presence
 * alone.
 * @param {string[]} paths - Paths to probe.
 * @param {{headerSets?: {name: string, values: string[]}[]}} [options]
 * @returns {{label: string, path: string, headers: Object<string,string>, detect: string}[]}
 */
export function experimentalFeatureProbes(paths = [], options = {}) {
  const { headerSets = EXPERIMENTAL_HEADER_SETS } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const set of headerSets) {
      for (const value of set.values || []) {
        probes.push({
          label: `experimental-unlock:${path}:${set.name}`,
          path,
          headers: { [set.name]: value },
          detect: 'dark-launched endpoint unlocked if response body/headers differ from the no-flag baseline (new fields, new Set-Cookie, feature-specific headers)',
        });
      }
    }
  }
  return probes;
}

/**
 * Idea 01076 — diff two response-header snapshots (with vs. without preview
 * flags). New Set-Cookie values and diagnostic headers are dark-launch
 * evidence.
 * @param {Object<string, string>} withFlags - Headers captured with preview flags set.
 * @param {Object<string, string>} withoutFlags - Baseline headers.
 * @returns {{addedHeaders: string[], changedHeaders: string[], newCookies: string[], diagnosticHeaders: string[], findings: object[]}}
 */
export function diffResponseHeaders(withFlags = {}, withoutFlags = {}) {
  const lower = obj => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) out[String(k).toLowerCase()] = Array.isArray(v) ? v.join('; ') : String(v);
    return out;
  };
  const a = lower(withFlags);
  const b = lower(withoutFlags);
  const addedHeaders = Object.keys(a).filter(k => !(k in b)).sort();
  const changedHeaders = Object.keys(a).filter(k => k in b && a[k] !== b[k]).sort();

  const cookiesOf = obj => {
    const raw = obj['set-cookie'] || '';
    const names = new Set();
    for (const part of String(raw).split(/,(?=[^;,]+=)/)) {
      const m = part.match(/^\s*([^=;,\s]+)=/);
      if (m) names.add(m[1]);
    }
    return names;
  };
  const newCookies = [...cookiesOf(a)].filter(c => !cookiesOf(b).has(c)).sort();
  const diagnosticHeaders = [...addedHeaders, ...changedHeaders].filter(h => DIAGNOSTIC_HEADER_PATTERN.test(h)).sort();

  const findings = [];
  if (newCookies.length) {
    findings.push({
      type: 'dark-launch-cookie-leak',
      confidence: 'high',
      evidence: `Preview flag introduced ${newCookies.length} new cookie(s): ${newCookies.join(', ')}. Dark features often leak via Set-Cookie.`,
    });
  }
  for (const h of diagnosticHeaders) {
    findings.push({
      type: 'dark-launch-diagnostic-header',
      confidence: 'medium',
      evidence: `Diagnostic header "${h}" appeared or changed when preview flags were set (values differ between baselines).`,
    });
  }
  if (addedHeaders.length && !findings.length) {
    findings.push({
      type: 'header-diff-no-diagnostic',
      confidence: 'low',
      evidence: `${addedHeaders.length} header(s) added with preview flags but none matched diagnostic patterns: ${addedHeaders.slice(0, 5).join(', ')}.`,
    });
  }
  return { addedHeaders, changedHeaders, newCookies, diagnosticHeaders, findings };
}

/**
 * Idea 01077 — build canary-routing probe descriptors (X-Canary header and
 * canary cookies) so the operator can test whether a canary router steers
 * them to an unhardened new build.
 * @param {string[]} paths - Paths to probe.
 * @param {{canaryHeaderValue?: string, canaryCookieNames?: string[]}} [options]
 * @returns {{label: string, path: string, headers: Object<string,string>, cookies: Object<string,string>, detect: string}[]}
 */
export function canaryRoutingProbes(paths = [], options = {}) {
  const { canaryHeaderValue = '1', canaryCookieNames = ['canary', 'x-canary', 'route-canary', 'abtest'] } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    probes.push({
      label: `canary-route:${path}:header`,
      path,
      headers: { 'X-Canary': canaryHeaderValue },
      cookies: {},
      detect: 'canary steering detected if the response build/version/diagnostic headers differ from the non-canary baseline',
    });
    for (const name of canaryCookieNames) {
      probes.push({
        label: `canary-route:${path}:cookie:${name}`,
        path,
        headers: {},
        cookies: { [name]: canaryHeaderValue },
        detect: 'canary steering detected if the response build/version/diagnostic headers differ from the non-canary baseline',
      });
    }
  }
  return probes;
}

/**
 * Idea 01078 — extract URL-like strings from JavaScript bundle text:
 * fetch()/axios()/XHR calls, URL constructors, and template literals that
 * look like paths or absolute URLs.
 * @param {string} bundleText - Raw JavaScript source/bundle text.
 * @param {{maxUrls?: number}} [options]
 * @returns {string[]} Normalized path/URL candidates (sorted, deduped).
 */
export function extractBundleUrls(bundleText = '', options = {}) {
  const { maxUrls = 500 } = options;
  const text = String(bundleText || '');
  const urls = new Set();
  const capture = raw => {
    const u = String(raw || '').trim();
    if (!u || u.length > 512) return;
    if (/^(https?:\/\/[^"'\s]+$|(?!.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map)\b)[/"'][A-Za-z0-9_\-./{}:?&=+%#]+)$/.test(u)) {
      urls.add(u);
    }
  };
  const patterns = [
    /fetch\(\s*["'`]([^"'`]+)["'`]/gi,
    /axios\.(?:get|post|put|patch|delete|head|options)\(\s*["'`]([^"'`]+)["'`]/gi,
    /\.open\(\s*["'][A-Z]+["']\s*,\s*["'`]([^"'`]+)["'`]/gi,
    /new\s+URL\(\s*["'`]([^"'`]+)["'`]/gi,
    /["'`](\/[A-Za-z0-9_\-./{}:?&=+%]+)["'`]/g,
    /["'`](https?:\/\/[A-Za-z0-9_\-./{}:?&=+%#]+)["'`]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      capture(m[1]);
      if (urls.size >= maxUrls) break;
    }
    if (urls.size >= maxUrls) break;
  }
  return [...urls].sort().slice(0, maxUrls);
}

/**
 * Normalize an endpoint path for spec comparison: strip query strings,
 * trailing slashes, and template placeholders.
 * @param {string} url
 * @returns {string}
 */
export function normalizeEndpointPath(url) {
  return String(url || '')
    .replace(/[?#].*$/, '')
    .replace(/\{[^}]*\}/g, '{}')
    .replace(/:\w+/g, '{}')
    .replace(/\/+$/, '') || '/';
}

/**
 * Idea 01078 — diff extracted bundle URLs against documented spec paths and
 * report undocumented (shadow) endpoints.
 * @param {string[]} extractedUrls - Output of extractBundleUrls.
 * @param {string[]} documentedPaths - Paths from the documented API spec.
 * @returns {{shadowEndpoints: string[], documentedHit: string[], findings: object[]}}
 */
export function diffAgainstDocumentedSpec(extractedUrls = [], documentedPaths = []) {
  const docSet = new Set((documentedPaths || []).map(p => normalizeEndpointPath(p)));
  const shadowEndpoints = [];
  const documentedHit = [];
  const findings = [];
  const seen = new Set();
  for (const u of extractedUrls || []) {
    const norm = normalizeEndpointPath(u);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    if (docSet.has(norm)) documentedHit.push(norm);
    else {
      shadowEndpoints.push(norm);
      findings.push({
        type: 'shadow-api-endpoint',
        confidence: 'medium',
        evidence: `Endpoint "${norm}" is called from frontend code but is absent from the documented spec — an undocumented/shadow API route.`,
      });
    }
  }
  return { shadowEndpoints: shadowEndpoints.sort(), documentedHit: documentedHit.sort(), findings };
}

/**
 * Idea 01079 — parse a .js.map source-map JSON document and harvest
 * API-like string literals from the sourcesContent, plus any API-ish path
 * fragments embedded in the map metadata itself.
 * @param {string|object} sourceMap - Source-map JSON text or parsed object.
 * @param {{scanSourcesContent?: boolean, maxStrings?: number}} [options]
 * @returns {{apiStrings: string[], findings: object[]}}
 */
export function mineSourceMapEndpoints(sourceMap, options = {}) {
  const { scanSourcesContent = true, maxStrings = 500 } = options;
  const apiStrings = new Set();
  let map = sourceMap;
  if (typeof map === 'string') {
    try {
      map = JSON.parse(map);
    } catch {
      return { apiStrings: [], findings: [{ type: 'sourcemap-parse-error', confidence: 'low', evidence: 'Source-map JSON could not be parsed.' }] };
    }
  }
  const blob = scanSourcesContent && Array.isArray(map && map.sourcesContent)
    ? map.sourcesContent.filter(s => typeof s === 'string').join('\n')
    : '';
  const text = `${blob}\n${JSON.stringify({ sources: (map && map.sources) || [], names: ((map && map.names) || []).slice(0, 200) })}`;
  const patterns = [
    /["'`](\/[A-Za-z0-9_\-./{}:?&=+%]+)["'`]/g,
    /["'`](https?:\/\/[A-Za-z0-9_\-./{}:?&=+%#]+)["'`]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null && apiStrings.size < maxStrings) {
      const u = m[1].trim();
      if (u.length <= 512 && /\/api|graphql|\/v\d+|rest|ajax|endpoint|action=|_next\/data/i.test(u)) {
        apiStrings.add(u);
      }
    }
  }
  const list = [...apiStrings].sort();
  const findings = list.map(s => ({
    type: 'sourcemap-orphan-endpoint',
    confidence: 'medium',
    evidence: `API-like string "${s}" found in source map; endpoint literals stripped from minified code often remain here.`,
  }));
  return { apiStrings: list, findings };
}

/**
 * Idea 01080 — scan .d.ts declaration text for method signatures and path
 * literals: `methodName(path: '/x')`, route tables, and string-literal
 * unions, so every client-callable SDK method is enumerated.
 * @param {string} dtsText - Raw .d.ts file text.
 * @param {{maxMethods?: number}} [options]
 * @returns {{methods: {name: string, path: string|null, line: number}[], paths: string[], findings: object[]}}
 */
export function mineDeclarationEndpoints(dtsText = '', options = {}) {
  const { maxMethods = 500 } = options;
  const text = String(dtsText || '');
  const methods = [];
  const pathSet = new Set();
  const lines = text.split('\n');
  const pathArgRe = /["'`](\/[A-Za-z0-9_\-./{}:?&=+%]+)["'`]/;
  lines.forEach((line, idx) => {
    if (methods.length >= maxMethods) return;
    // Function/method declarations: `getUser(id: string):`, `declare function login(...)`, `post: (...) =>`
    const m = line.match(/^\s*(?:export\s+|declare\s+|abstract\s+|public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:function\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*(?=[(<:])/);
    if (!m) return;
    const name = m[1];
    if (/^(interface|type|declare|namespace|export|import|class|const|let|var|enum|function|extends|implements|readonly)$/.test(name)) return;
    if (name.startsWith('_')) return;
    const pathMatch = line.match(pathArgRe);
    const path = pathMatch ? pathMatch[1] : null;
    if (path) pathSet.add(path);
    methods.push({ name, path, line: idx + 1 });
  });
  // String-literal union path enumerations: `type Route = '/a' | '/b'`
  const unionRe = /["'`](\/[A-Za-z0-9_\-./{}]+)["'`]/g;
  let um;
  while ((um = unionRe.exec(text)) !== null && pathSet.size < maxMethods) {
    pathSet.add(um[1]);
  }
  const paths = [...pathSet].sort();
  const findings = paths.map(p => ({
    type: 'sdk-declaration-endpoint',
    confidence: 'high',
    evidence: `Path literal "${p}" enumerated in the public .d.ts SDK declarations — a client-callable method/route to check against the documented spec.`,
  }));
  if (methods.length && !paths.length) {
    findings.push({
      type: 'sdk-declaration-methods-only',
      confidence: 'low',
      evidence: `${methods.length} SDK method(s) mined from .d.ts but no path literals were found; methods may compose paths at runtime.`,
    });
  }
  return { methods, paths, findings };
}

/**
 * Build a uniform report finding from a shadow-API recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function shadowApiReconFinding(result = {}) {
  const { title = 'Shadow API recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `Shadow API recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged shadow/sunset/dark-launch surface on the authorized target: retire dead endpoints for real (return 410, remove routes), ' +
      'enforce one privacy-reviewed schema per version, keep experimental/canary gates behind authenticated feature flags, ' +
      'strip diagnostic headers and verbose Set-Cookie values from production, and keep frontend bundles and source maps out of public builds.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const SHADOW_API_RECON = {
  classifyPrivacyFields,
  diffResponseSchemas,
  betaPathCandidates,
  scoreBetaValidationHypothesis,
  parseSunsetHeaders,
  deprecatedEndpointProbes,
  buildSunsetCatalog,
  experimentalFeatureProbes,
  diffResponseHeaders,
  canaryRoutingProbes,
  extractBundleUrls,
  normalizeEndpointPath,
  diffAgainstDocumentedSpec,
  mineSourceMapEndpoints,
  mineDeclarationEndpoints,
  shadowApiReconFinding,
};

export default SHADOW_API_RECON;
