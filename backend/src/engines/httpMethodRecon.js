/**
 * httpMethodRecon.js — HTTP method / route-behavior recon probe builder and
 * response analyzer.
 *
 * Idea 01111: 405-vs-404 route oracle — use 405 Method Not Allowed vs 404
 * to confirm route existence since 405 proves the path is real.
 *
 * Idea 01112: 401-vs-403 differential mapping — compare auth failures across
 * endpoints since 401-vs-403 patterns reveal which routes check auth at all.
 *
 * Idea 01113: Response-timing route oracle — measure timing deltas between
 * existing and non-existing paths because auth/database lookups make real
 * routes slower.
 *
 * Idea 01114: HEAD method information probe — send HEAD to API routes since
 * HEAD responses leak Content-Length and headers without body rate limits.
 *
 * Idea 01115: TRACE method support check — test TRACE because enabled TRACE
 * echoes request data and aids header-injection analysis.
 *
 * Idea 01116: Custom HTTP method probing — try PURGE, DEBUG and
 * framework-specific verbs since custom methods sometimes bypass
 * method-based access rules.
 *
 * Idea 01117: Method case-sensitivity test — send get/post lowercase because
 * case-sensitive routers may treat lowercase methods as unauthenticated
 * fallthroughs.
 *
 * Idea 01118: HTTP method override header test — send X-HTTP-Method-Override
 * and _method params since override headers can turn a GET into a
 * privileged POST.
 *
 * Idea 01119: Content-type negotiation abuse — vary Accept headers (json,
 * xml, html) because negotiation can return debug HTML or stack traces for
 * APIs.
 *
 * Idea 01120: Vendor MIME version probing — request application/vnd.api.v2
 * +json variants since vendor MIME types hide versioned representations.
 *
 * No network calls: every function builds ready-to-send probe descriptors
 * (method + path + headers + what-response-signal-to-look-for) or analyzes
 * operator-supplied response records (status codes, timings, headers, body
 * text). The agent's network layer performs the actual transport; this
 * module contains only the pure probe-building and classification logic.
 * Defensive surface mapping of the engagement's own authorized target only.
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
 * Idea 01111 — build probe descriptors that intentionally use a wrong HTTP
 * method against each path, so the operator can tell route existence apart:
 * 405 Method Not Allowed proves the path is real; 404 keeps the path
 * doubtful.
 * @param {string[]} paths - Paths to oracle.
 * @param {{method?: string}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildMethodNotAllowedProbes(paths = [], options = {}) {
  const { method = 'DELETE' } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    probes.push(normalizeProbe({
      label: `route-oracle:${path}`,
      path,
      method,
      detect: 'route real if status 405 (path exists, method not allowed); route doubtful if 404',
    }));
  }
  return probes;
}

/**
 * Idea 01111 — classify route existence from operator-supplied status
 * records: a 405 on any method proves the route is real; only-404s marks a
 * ghost; anything else is inconclusive.
 * @param {{path: string, method?: string, status?: number}[]} records
 * @returns {{real: string[], ghost: string[], inconclusive: {path: string, statuses: number[]}[], findings: object[]}}
 */
export function classifyRouteExistence(records = []) {
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const path = String(r.path);
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push({ method: r.method == null ? null : String(r.method), status: Number(r.status) });
  }
  const real = [];
  const ghost = [];
  const inconclusive = [];
  const findings = [];
  for (const [path, entries] of byPath) {
    const statuses = entries.map(e => e.status);
    if (statuses.some(s => s === 405)) {
      real.push(path);
      findings.push({
        type: 'route-existence-oracle',
        confidence: 'high',
        evidence: `Path "${path}" returned 405 Method Not Allowed — the router recognized the path, so the route is real.`,
        path,
      });
    } else if (statuses.length && statuses.every(s => s === 404)) {
      ghost.push(path);
    } else {
      inconclusive.push({ path, statuses: [...new Set(statuses)] });
    }
  }
  return { real: real.sort(), ghost: ghost.sort(), inconclusive, findings };
}

/**
 * Idea 01112 — map auth-failure differentials across endpoints. Routes that
 * return 401 vs 403 vs success-without-auth reveal which endpoints check
 * authentication at all and how consistently.
 * @param {{path: string, status?: number, authed?: boolean}[]} records
 * @returns {{authAware: string[], authBlind: string[], inconsistent: string[], findings: object[]}}
 */
export function mapAuthFailureDifferential(records = []) {
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const path = String(r.path);
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push({ status: Number(r.status), authed: r.authed !== false });
  }
  const authAware = [];
  const authBlind = [];
  const inconsistent = [];
  const findings = [];
  for (const [path, entries] of byPath) {
    const unauthed = entries.filter(e => !e.authed);
    const unauthedStatuses = [...new Set(unauthed.map(e => e.status))];
    const anySuccessUnauthed = unauthedStatuses.some(s => s >= 200 && s < 300);
    const anyAuthFailure = unauthedStatuses.some(s => s === 401 || s === 403);
    if (anySuccessUnauthed && anyAuthFailure) {
      inconsistent.push(path);
      findings.push({
        type: 'auth-differential-inconsistent',
        confidence: 'high',
        evidence: `Path "${path}" both rejects unauthenticated requests (${unauthedStatuses.filter(s => s === 401 || s === 403).join('/')}) and serves 2xx without auth — inconsistent auth enforcement worth probing.`,
        path,
      });
    } else if (anyAuthFailure) {
      authAware.push(path);
    } else if (anySuccessUnauthed) {
      authBlind.push(path);
      findings.push({
        type: 'auth-differential-blind',
        confidence: 'medium',
        evidence: `Path "${path}" returned 2xx without authentication — this route checks no auth at all.`,
        path,
      });
    }
  }
  const counts = { authAware: authAware.length, authBlind: authBlind.length, inconsistent: inconsistent.length };
  if (counts.authBlind && counts.authAware) {
    findings.push({
      type: 'auth-differential-mixed-map',
      confidence: 'medium',
      evidence: `${counts.authBlind} route(s) check no auth while ${counts.authAware} route(s) do — compare the blind routes' data exposure against the auth-aware siblings.`,
    });
  }
  return {
    authAware: authAware.sort(),
    authBlind: authBlind.sort(),
    inconsistent: inconsistent.sort(),
    findings,
  };
}

/**
 * Idea 01113 — build timing probe descriptors: a set of real-route
 * candidates plus definitely-fake control paths, so the operator can compare
 * response timings and classify real routes statistically.
 * @param {string[]} candidatePaths - Paths whose existence is uncertain.
 * @param {{controlsPerCandidate?: number, method?: string}} [options]
 * @returns {{probes: object[], controlPaths: string[]}}
 */
export function buildTimingRouteProbes(candidatePaths = [], options = {}) {
  const { controlsPerCandidate = 2, method = 'GET' } = options;
  const probes = [];
  const controlPaths = [];
  for (const raw of candidatePaths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    probes.push(normalizeProbe({
      label: `timing-route:${path}`,
      path,
      method,
      detect: 'route likely real if median duration exceeds the 404-control median by a wide margin (auth/db lookups make real routes slower)',
    }));
    for (let i = 0; i < Math.max(1, controlsPerCandidate); i++) {
      const control = `${path.replace(/\/+$/, '')}/__ghost_probe_${Date.now().toString(36)}_${i}__`;
      controlPaths.push(control);
      probes.push(normalizeProbe({
        label: `timing-control:${control}`,
        path: control,
        method,
        detect: '404 control baseline sample',
      }));
    }
  }
  return { probes, controlPaths };
}

/**
 * Compute median of a numeric array.
 * @param {number[]} values
 * @returns {number|null}
 */
function median(values = []) {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Idea 01113 — classify routes as likely-real vs likely-ghost from
 * operator-supplied timing samples. The control (404) median is the
 * baseline; routes whose median duration exceeds baseline * thresholdRatio
 * are classified as real, because auth/database lookups make real routes
 * slower than dead-path rejections.
 * @param {{path: string, status?: number, durationMs?: number}[]} samples
 * @param {{thresholdRatio?: number}} [options]
 * @returns {{baselineMedianMs: number|null, likelyReal: string[], likelyGhost: string[], routeMedians: {path: string, medianMs: number, samples: number}[], findings: object[]}}
 */
export function classifyRoutesByTiming(samples = [], options = {}) {
  const { thresholdRatio = 1.8 } = options;
  const perPath = new Map();
  for (const s of samples || []) {
    if (!s || !s.path || !Number.isFinite(Number(s.durationMs))) continue;
    const path = String(s.path);
    if (!perPath.has(path)) perPath.set(path, { durations: [], statuses: new Set() });
    const rec = perPath.get(path);
    rec.durations.push(Number(s.durationMs));
    rec.statuses.add(Number(s.status));
  }
  // Baseline: medians of paths that only ever returned 404 (the dead-path control set).
  const controlMedians = [];
  const routeMedians = [];
  for (const [path, rec] of perPath) {
    const med = median(rec.durations);
    if (med === null) continue;
    routeMedians.push({ path, medianMs: med, samples: rec.durations.length });
    if (rec.statuses.size === 1 && rec.statuses.has(404)) controlMedians.push(med);
  }
  const baselineMedianMs = median(controlMedians);
  const likelyReal = [];
  const likelyGhost = [];
  const findings = [];
  for (const r of routeMedians) {
    const ratio = baselineMedianMs && baselineMedianMs > 0 ? r.medianMs / baselineMedianMs : null;
    if (ratio !== null && ratio >= thresholdRatio) {
      likelyReal.push(r.path);
      findings.push({
        type: 'timing-route-oracle',
        confidence: 'medium',
        evidence: `Path "${r.path}" median ${r.medianMs.toFixed(1)}ms is ${ratio.toFixed(2)}x the 404-control median (${baselineMedianMs.toFixed(1)}ms) — real routes are slower due to auth/db lookups.`,
        path: r.path,
      });
    } else {
      likelyGhost.push(r.path);
    }
  }
  return {
    baselineMedianMs,
    likelyReal: likelyReal.sort(),
    likelyGhost: likelyGhost.sort(),
    routeMedians: routeMedians.sort((a, b) => b.medianMs - a.medianMs),
    findings,
  };
}

/**
 * Idea 01114 — build HEAD probe descriptors for API routes: HEAD responses
 * expose Content-Length, Allow, and diagnostic headers without body rate
 * limits.
 * @param {string[]} paths - API routes to probe.
 * @returns {object[]}
 */
export function buildHeadProbes(paths = []) {
  return (paths || [])
    .map(p => String(p || '').trim())
    .filter(Boolean)
    .map(path => normalizeProbe({
      label: `head-info:${path}`,
      path,
      method: 'HEAD',
      detect: 'header-only response; compare Content-Length, Allow, X-* and Server headers against the GET baseline for leaked metadata',
    }));
}

/**
 * Idea 01114 — parse a HEAD response's headers into a leak report: reported
 * Content-Length, Allow methods, and any diagnostic/internal headers worth
 * comparing against the GET baseline.
 * @param {object} headers - Response headers (case-insensitive keys).
 * @param {string} [path]
 * @returns {{path: string|null, contentLength: string|null, allowedMethods: string[], diagnosticHeaders: object, findings: object[]}}
 */
export function parseHeadHeaderLeaks(headers = {}, path = null) {
  const lower = lowerHeaders(headers);
  const contentLength = lower['content-length'] || null;
  const allowRaw = lower['allow'] || '';
  const allowedMethods = allowRaw.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
  const diagnosticHeaders = {};
  for (const [k, v] of Object.entries(lower)) {
    if (/^(x-(debug|trace|request|server|powered|framework|version|build|commit|revision|instance|backend|upstream|cache|profile|timing|duration|query|sql|request-id|correlation|transaction)|server|via|expect-ct|content-security-policy-report-only)$/.test(k)) {
      diagnosticHeaders[k] = v;
    }
  }
  const findings = [];
  if (Object.keys(diagnosticHeaders).length) {
    findings.push({
      type: 'head-header-leak',
      confidence: 'medium',
      evidence: `HEAD response${path ? ` on "${path}"` : ''} leaks ${Object.keys(diagnosticHeaders).length} diagnostic/internal header(s): ${Object.keys(diagnosticHeaders).join(', ')}.`,
      path: path == null ? null : String(path),
    });
  }
  if (allowedMethods.length) {
    findings.push({
      type: 'head-allow-enumeration',
      confidence: 'high',
      evidence: `HEAD response${path ? ` on "${path}"` : ''} advertises methods via Allow: ${allowedMethods.join(', ')} — confirms route existence and usable verbs.`,
      path: path == null ? null : String(path),
    });
  }
  return {
    path: path == null ? null : String(path),
    contentLength,
    allowedMethods,
    diagnosticHeaders,
    findings,
  };
}

/**
 * Idea 01115 — build a TRACE probe descriptor carrying a harmless unique
 * marker. Enabled TRACE echoes the request line and headers, which aids
 * header-injection and cache analysis on the authorized target.
 * @param {string} path
 * @param {{marker?: string}} [options]
 * @returns {object}
 */
export function buildTraceProbe(path = '/', options = {}) {
  const { marker = `infinity-trace-${Date.now().toString(36)}` } = options;
  const clean = String(path || '/').trim() || '/';
  return normalizeProbe({
    label: `trace-support:${clean}`,
    path: clean,
    method: 'TRACE',
    headers: { 'Max-Forwards': '0', 'X-Trace-Marker': String(marker) },
    detect: `TRACE supported if response is 2xx with content-type message/http and echoes the marker "${marker}" back in the body`,
  });
}

/**
 * Idea 01115 — analyze an operator-supplied TRACE response record for
 * method support and request-echo evidence.
 * @param {{status?: number, headers?: object, body?: string, marker?: string}} record
 * @returns {{traceEnabled: boolean, echoConfirmed: boolean, findings: object[]}}
 */
export function parseTraceEcho(record = {}) {
  const { status = null, headers = {}, body = '', marker = '' } = record;
  const lower = lowerHeaders(headers);
  const contentType = lower['content-type'] || '';
  const isSuccess = Number(status) >= 200 && Number(status) < 300;
  const echoConfirmed = Boolean(marker) && String(body || '').includes(String(marker));
  const traceEnabled = isSuccess && (/message\/http/i.test(contentType) || echoConfirmed);
  const findings = [];
  if (traceEnabled) {
    findings.push({
      type: 'trace-method-enabled',
      confidence: 'high',
      evidence: `TRACE is enabled (status ${status}, echoed request marker "${marker}") — echoed request data aids header-injection analysis on the authorized target.`,
    });
  } else if (Number(status) === 405 || Number(status) === 501) {
    findings.push({
      type: 'trace-method-disabled',
      confidence: 'high',
      evidence: `TRACE correctly rejected with status ${status} — method is not enabled on this route.`,
    });
  }
  return { traceEnabled, echoConfirmed, findings };
}

/**
 * Framework / proxy custom verbs that sometimes bypass method-based access
 * rules or trigger privileged behavior on the authorized target.
 */
const CUSTOM_VERBS = [
  'PURGE',
  'DEBUG',
  'TRACK',
  'MSEARCH',
  'NOTIFY',
  'SUBSCRIBE',
  'MKCOL',
  'PROPFIND',
  'PROPPATCH',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'REPORT',
  'QUERY',
  'BAN',
  'CONNECT',
];

/**
 * Idea 01116 — build probe descriptors for custom HTTP verbs (PURGE, DEBUG,
 * framework-specific verbs), since custom methods sometimes bypass
 * method-based access rules.
 * @param {string[]} paths - Paths to probe.
 * @param {{verbs?: string[]}} [options]
 * @returns {object[]}
 */
export function buildCustomMethodProbes(paths = [], options = {}) {
  const { verbs = CUSTOM_VERBS } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const verb of verbs || []) {
      probes.push(normalizeProbe({
        label: `custom-method:${path}:${verb}`,
        path,
        method: verb,
        detect: `method-based access bypass if status is 2xx/3xx (not 405/501) or the response differs from the GET baseline`,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01116 — analyze operator-supplied custom-method response records for
 * verbs that were accepted instead of rejected.
 * @param {{path: string, method?: string, status?: number}[]} records
 * @returns {{accepted: {path: string, method: string, status: number}[], rejected: string[], findings: object[]}}
 */
export function analyzeCustomMethodResponses(records = []) {
  const accepted = [];
  const rejectedSet = new Set();
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.path || !r.method) continue;
    const method = String(r.method).toUpperCase();
    const status = Number(r.status);
    if (status >= 200 && status < 400) {
      accepted.push({ path: String(r.path), method, status });
      findings.push({
        type: 'custom-method-accepted',
        confidence: 'high',
        evidence: `Custom verb ${method} on "${r.path}" returned ${status} instead of 405/501 — the router honors a non-standard method, which may bypass method-based access rules.`,
        path: String(r.path),
        method,
      });
    } else if (status === 405 || status === 501) {
      rejectedSet.add(method);
    }
  }
  return { accepted, rejected: [...rejectedSet].sort(), findings };
}

/**
 * Idea 01117 — build probe pairs using the same request with canonical-case
 * vs lowercase method, since case-sensitive routers may treat lowercase
 * methods as unauthenticated fallthroughs.
 * @param {string[]} paths - Paths to probe.
 * @param {{methods?: string[]}} [options]
 * @returns {{label: string, path: string, method: string, methodCased: string, headers: object, detect: string}[]}
 */
export function buildCaseSensitivityProbePairs(paths = [], options = {}) {
  const { methods = ['GET', 'POST'] } = options;
  const pairs = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const m of methods || []) {
      const canon = String(m).toUpperCase();
      const lower = String(m).toLowerCase();
      pairs.push({
        label: `method-case:${path}:${canon}`,
        path,
        method: canon,
        methodCased: canon,
        headers: {},
        detect: 'baseline behavior for the canonical-case method',
      });
      pairs.push({
        label: `method-case:${path}:${lower}`,
        path,
        method: lower,
        methodCased: lower,
        headers: {},
        detect: 'fallthrough if this lowercase method gets 2xx/different-auth behavior vs the canonical-case baseline',
      });
    }
  }
  return pairs;
}

/**
 * Idea 01117 — classify method-case fallthrough from operator-supplied
 * response records: a lowercase method that succeeds (2xx) or behaves
 * differently from its canonical-case twin signals a case-sensitive router
 * fallthrough.
 * @param {{path: string, method?: string, status?: number}[]} records
 * @returns {{fallthroughs: {path: string, method: string, lowerStatus: number, canonicalStatus: number}[], findings: object[]}}
 */
export function classifyCaseFallthrough(records = []) {
  const byKey = new Map();
  for (const r of records || []) {
    if (!r || !r.path || !r.method) continue;
    byKey.set(`${String(r.path)}|${String(r.method).toLowerCase()}|${String(r.method) === String(r.method).toLowerCase() ? 'lower' : 'canon'}`, Number(r.status));
  }
  const fallthroughs = [];
  const findings = [];
  const keys = new Set([...byKey.keys()].map(k => k.split('|').slice(0, 2).join('|')));
  for (const base of keys) {
    const lowerStatus = byKey.get(`${base}|lower`);
    const canonStatus = byKey.get(`${base}|canon`);
    if (lowerStatus === undefined || canonStatus === undefined) continue;
    const [path, method] = base.split('|');
    const lowerOk = lowerStatus >= 200 && lowerStatus < 400;
    const diverged = lowerStatus !== canonStatus;
    if (lowerOk && (canonStatus === 401 || canonStatus === 403 || diverged)) {
      fallthroughs.push({ path, method: String(method).toLowerCase(), lowerStatus, canonicalStatus: canonStatus });
      findings.push({
        type: 'method-case-fallthrough',
        confidence: 'high',
        evidence: `Lowercase "${String(method).toLowerCase()}" on "${path}" returned ${lowerStatus} while canonical-case returned ${canonStatus} — the router treats method case differently, a possible unauthenticated fallthrough.`,
        path,
      });
    }
  }
  return { fallthroughs, findings };
}

/**
 * Idea 01118 — build method-override probe descriptors: a plain GET carrying
 * X-HTTP-Method-Override / X-Method-Override headers or a _method
 * query/body parameter, to test whether the server turns the request into a
 * privileged POST.
 * @param {string[]} paths - Paths to probe.
 * @param {{overrideTarget?: string}} [options]
 * @returns {object[]}
 */
export function buildMethodOverrideProbes(paths = [], options = {}) {
  const { overrideTarget = 'POST' } = options;
  const variants = [
    { name: 'X-HTTP-Method-Override', kind: 'header', value: overrideTarget },
    { name: 'X-Method-Override', kind: 'header', value: overrideTarget },
    { name: 'X-HTTP-Method', kind: 'header', value: overrideTarget },
    { name: '_method', kind: 'query', value: overrideTarget },
    { name: '_method', kind: 'body', value: overrideTarget },
  ];
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    // Baseline plain GET for comparison.
    probes.push(normalizeProbe({
      label: `method-override:${path}:baseline-get`,
      path,
      method: 'GET',
      detect: 'baseline behavior of the plain GET the override variants are compared against',
    }));
    for (const v of variants) {
      probes.push(normalizeProbe({
        label: `method-override:${path}:${v.kind}:${v.name}`,
        path,
        method: 'GET',
        headers: v.kind === 'header' ? { [v.name]: v.value } : { 'Content-Type': 'application/x-www-form-urlencoded' },
        detect: `override honored if behavior matches a real ${overrideTarget} (status/body differ from the baseline GET in the same way ${overrideTarget} does)`,
      }));
    }
  }
  return probes;
}

/**
 * Idea 01118 — classify override divergence from operator-supplied response
 * records: a probe whose status/body-signal differs from the baseline GET
 * (and resembles the privileged-method behavior) indicates the override is
 * honored.
 * @param {{label: string, path: string, status?: number, bodySignal?: string}[]} records
 * @returns {{honored: {path: string, variant: string, status: number}[], findings: object[]}}
 */
export function classifyOverrideDivergence(records = []) {
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path || !r.label) continue;
    const path = String(r.path);
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push({ label: String(r.label), status: Number(r.status), bodySignal: r.bodySignal == null ? null : String(r.bodySignal) });
  }
  const honored = [];
  const findings = [];
  for (const [path, entries] of byPath) {
    const baseline = entries.find(e => e.label.endsWith(':baseline-get'));
    if (!baseline) continue;
    for (const e of entries) {
      if (e === baseline) continue;
      const statusDiverged = e.status !== baseline.status;
      const signalDiverged = e.bodySignal !== null && e.bodySignal !== baseline.bodySignal;
      if (statusDiverged || signalDiverged) {
        const variant = e.label.slice(`method-override:${path}:`.length);
        honored.push({ path, variant, status: e.status });
        findings.push({
          type: 'method-override-honored',
          confidence: 'medium',
          evidence: `Override variant "${variant}" on "${path}" returned status ${e.status}${e.bodySignal ? ` with body signal "${e.bodySignal}"` : ''} vs baseline GET ${baseline.status} — the server honored the method override.`,
          path,
          variant,
        });
      }
    }
  }
  return { honored, findings };
}

/**
 * Common Accept variants for content-negotiation probing.
 */
const ACCEPT_VARIANTS = [
  'application/json',
  'application/xml',
  'text/xml',
  'text/html',
  'text/plain',
  'application/*+json',
];

/**
 * Stack-trace / debug-HTML signal patterns that reveal verbose error
 * handling behind an API route.
 */
const DEBUG_SIGNAL_PATTERNS = [
  /stack\s*trace/i,
  /traceback\s*\(most recent call/i,
  /at\s+[\w$.]+\s*\([^)]*:\d+:\d+\)/,           // JS/Java stack frames
  /exception\s+in\s+thread/i,
  /\bNullPointerException\b/,
  /debug\s+mode/i,
  /werkzeug/i,
  /django/i,
  /laravel/i,
  /ASP\.NET/i,
  /Server Error in '\/'/i,                        // ASP.NET yellow screen
  /<pre[^>]*>[\s\S]{0,50}?(Error|Exception)/i,
  /\.php\s+on\s+line\s+\d+/i,
  /fatal\s+error/i,
  /syntax\s+error/i,
];

/**
 * Idea 01119 — build Accept-negotiation probe descriptors: the same path
 * requested with different Accept headers, since negotiation can return
 * debug HTML or stack traces for APIs.
 * @param {string[]} paths - Paths to probe.
 * @param {{accepts?: string[]}} [options]
 * @returns {object[]}
 */
export function buildAcceptNegotiationProbes(paths = [], options = {}) {
  const { accepts = ACCEPT_VARIANTS } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const accept of accepts || []) {
      probes.push(normalizeProbe({
        label: `negotiation:${path}:${accept}`,
        path,
        method: 'GET',
        headers: { Accept: accept },
        detect: 'debug leak if the response body contains stack traces, debug HTML, or a representation that differs materially from the default',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01119 — scan an operator-supplied response body for stack-trace and
 * debug-HTML markers indicating verbose error handling.
 * @param {{path?: string|null, accept?: string|null, status?: number, contentType?: string|null, body?: string}} record
 * @returns {{debugLeak: boolean, matchedPatterns: string[], findings: object[]}}
 */
export function detectDebugSignals(record = {}) {
  const { path = null, accept = null, status = null, contentType = null, body = '' } = record;
  const text = String(body || '');
  const matchedPatterns = [];
  for (const re of DEBUG_SIGNAL_PATTERNS) {
    if (re.test(text)) matchedPatterns.push(re.source);
  }
  const debugLeak = matchedPatterns.length > 0;
  const findings = [];
  if (debugLeak) {
    findings.push({
      type: 'negotiation-debug-leak',
      confidence: 'high',
      evidence: `Response${path ? ` on "${path}"` : ''}${accept ? ` with Accept "${accept}"` : ''} contains ${matchedPatterns.length} stack-trace/debug marker(s) — verbose error handling is leaking internals.`,
      path: path == null ? null : String(path),
    });
  } else if (contentType && /text\/html/i.test(contentType) && accept && !/html/i.test(accept)) {
    findings.push({
      type: 'negotiation-html-representation',
      confidence: 'medium',
      evidence: `Response${path ? ` on "${path}"` : ''} returned HTML (${status}) despite Accept "${accept}" — negotiation produced an HTML representation worth inspecting for debug content.`,
      path: path == null ? null : String(path),
    });
  }
  return { debugLeak, matchedPatterns, findings };
}

/**
 * Idea 01120 — build vendor-MIME probe descriptors requesting versioned
 * representations (e.g. application/vnd.api.v2+json), since vendor MIME
 * types can hide versioned representations.
 * @param {string[]} paths - Paths to probe.
 * @param {{vendor?: string, versions?: number[], suffixes?: string[]}} [options]
 * @returns {object[]}
 */
export function buildVendorMimeProbes(paths = [], options = {}) {
  const { vendor = 'vnd.api', versions = [1, 2, 3], suffixes = ['json', 'xml'] } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const v of versions || []) {
      for (const suffix of suffixes || []) {
        const mime = `application/${vendor}.v${v}+${suffix}`;
        probes.push(normalizeProbe({
          label: `vendor-mime:${path}:${mime}`,
          path,
          method: 'GET',
          headers: { Accept: mime },
          detect: 'versioned representation exists if status is 2xx (not 406/415) and the body schema differs from the default version',
        }));
      }
    }
  }
  return probes;
}

/**
 * Idea 01120 — classify vendor-MIME response records: versions that return
 * 2xx expose (possibly hidden) versioned representations; 406/415 mean the
 * MIME is unsupported.
 * @param {{path: string, mime?: string, status?: number}[]} records
 * @returns {{supported: {path: string, mime: string, status: number}[], unsupported: {path: string, mime: string}[], findings: object[]}}
 */
export function classifyVersionRepresentation(records = []) {
  const supported = [];
  const unsupported = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.path || !r.mime) continue;
    const path = String(r.path);
    const mime = String(r.mime);
    const status = Number(r.status);
    if (status >= 200 && status < 300) {
      supported.push({ path, mime, status });
      findings.push({
        type: 'vendor-mime-version-exposed',
        confidence: 'medium',
        evidence: `Versioned representation "${mime}" on "${path}" returned ${status} — a versioned API representation is reachable via vendor MIME negotiation.`,
        path,
        mime,
      });
    } else if (status === 406 || status === 415) {
      unsupported.push({ path, mime });
    }
  }
  return { supported, unsupported, findings };
}

/**
 * Build a uniform report finding from an HTTP-method recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function httpMethodReconFinding(result = {}) {
  const { title = 'HTTP method recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `HTTP method recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged routes on the authorized target: return 405 only where the route is real, enforce auth consistently (401 for missing auth, 403 for denied), ' +
      'disable TRACE in production, reject non-standard methods with 501, normalize method case before routing, ignore method-override headers on safe routes, ' +
      'serve a single negotiated representation in production, and never leak stack traces or debug HTML.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const HTTP_METHOD_RECON = {
  buildMethodNotAllowedProbes,
  classifyRouteExistence,
  mapAuthFailureDifferential,
  buildTimingRouteProbes,
  classifyRoutesByTiming,
  buildHeadProbes,
  parseHeadHeaderLeaks,
  buildTraceProbe,
  parseTraceEcho,
  buildCustomMethodProbes,
  analyzeCustomMethodResponses,
  buildCaseSensitivityProbePairs,
  classifyCaseFallthrough,
  buildMethodOverrideProbes,
  classifyOverrideDivergence,
  buildAcceptNegotiationProbes,
  detectDebugSignals,
  buildVendorMimeProbes,
  classifyVersionRepresentation,
  httpMethodReconFinding,
};

export default HTTP_METHOD_RECON;
