/**
 * errorTimeOpsRecon.js — error/time/ops-info reconnaissance engine (ideas 1181-1190).
 *
 * Analyzes OBSERVED HTTP behavior of authorized targets — error bodies, status
 * codes, timestamps, health/metrics/debug endpoints, and experiment-flag
 * surfaces — to surface ops-info disclosure and authorization gaps for the
 * bug-bounty agent to prioritize. Pure analyzer functions: no network calls,
 * no raw exploit payloads, no weaponized code.
 */

// ---------------------------------------------------------------------------
// Idea 1181 — Clock-skew measurement
// ---------------------------------------------------------------------------

const TOKEN_WINDOW_MS = 5 * 60 * 1000; // typical 5-minute JWT grace window

/**
 * Compare a server-supplied timestamp against local time to measure clock skew.
 *
 * @param {string} serverTimeISO - Server time as ISO-8601 string (e.g. from a Date header).
 * @param {string} localTimeISO - Local time as ISO-8601 string.
 * @returns {{serverMs:number, localMs:number, skewMs:number, absSkewMs:number,
 *   serverAhead:boolean, exceedsTokenWindow:boolean, impact:string}}
 *   skewMs is positive when the server clock is AHEAD of local.
 */
export function measureClockSkew(serverTimeISO, localTimeISO) {
  const serverMs = Date.parse(serverTimeISO);
  const localMs = Date.parse(localTimeISO);
  const skewMs = (Number.isNaN(serverMs) || Number.isNaN(localMs))
    ? NaN
    : serverMs - localMs;
  const absSkewMs = Math.abs(skewMs);
  const serverAhead = skewMs > 0;
  const exceedsTokenWindow = absSkewMs > TOKEN_WINDOW_MS;

  let impact;
  if (Number.isNaN(skewMs)) {
    impact = 'unparseable timestamps — no skew assessment possible';
  } else if (exceedsTokenWindow) {
    impact = serverAhead
      ? 'server is ahead of client by more than the 5-minute token grace window: ' +
        'short-lived tokens issued locally may be REJECTED as not-yet-valid, and ' +
        'server-issued tokens may be accepted by clients past their expiry (replay window)'
      : 'server is behind client by more than the 5-minute token grace window: ' +
        'server-issued tokens may be rejected by clients as already expired, and ' +
        'stale tokens may remain accepted server-side longer than intended';
  } else {
    impact = 'skew is within the 5-minute token grace window — no token-window impact expected';
  }

  return { serverMs, localMs, skewMs, absSkewMs, serverAhead, exceedsTokenWindow, impact };
}

// ---------------------------------------------------------------------------
// Idea 1182 — Custom error-code catalog
// ---------------------------------------------------------------------------

const FAILURE_MODE_NOTES = [
  { re: /auth|token|session|unauth/i, note: 'auth/session failure — map to login + token-refresh flows' },
  { re: /rate|throttle|quota|limit/i, note: 'rate-limit signal — useful for tuning request pacing, not a vuln' },
  { re: /valid|schema|param|missing|required|format/i, note: 'input-validation failure — marks strict vs lenient endpoints' },
  { re: /not.?found|no.?such|doesn.?t exist/i, note: 'resource-lookup miss — useful for IDOR/ID enumeration scoping' },
  { re: /permission|forbidden|denied|role/i, note: 'authorization denial — candidate for privilege-escalation probing' },
  { re: /internal|exception|stack|trace/i, note: 'internal error — may leak stack details worth inspecting' },
];

/**
 * Catalog application-specific error codes seen across endpoints.
 *
 * @param {Array<{endpoint:string,status:number,body?:string,extractedCode?:string}>} observations
 * @returns {{codes: Record<string,{endpoints:string[],statuses:number[],failureModes:string[]}>,
 *   codeCount:number, endpointsWithCodes:number}}
 */
export function catalogErrorCodes(observations) {
  const codes = {};
  const endpointsWithCodes = new Set();
  for (const obs of observations || []) {
    const code = (obs.extractedCode || '').trim();
    if (!code) continue;
    endpointsWithCodes.add(obs.endpoint);
    if (!codes[code]) codes[code] = { endpoints: [], statuses: [], failureModes: [] };
    const entry = codes[code];
    if (!entry.endpoints.includes(obs.endpoint)) entry.endpoints.push(obs.endpoint);
    if (!entry.statuses.includes(obs.status)) entry.statuses.push(obs.status);
    const body = String(obs.body || '');
    for (const { re, note } of FAILURE_MODE_NOTES) {
      if (re.test(code) || re.test(body)) {
        if (!entry.failureModes.includes(note)) entry.failureModes.push(note);
      }
    }
  }
  return {
    codes,
    codeCount: Object.keys(codes).length,
    endpointsWithCodes: endpointsWithCodes.size,
  };
}

// ---------------------------------------------------------------------------
// Idea 1183 — Error-code to service mapping
// ---------------------------------------------------------------------------

/**
 * Cluster endpoints by their error-body format to expose likely microservice boundaries.
 *
 * @param {Array<{endpoint:string,errorFormat:string}>} observations - errorFormat is a
 *   free-form format label (e.g. 'rfc7807', 'graphql', 'spring', 'plain-text').
 * @returns {{clusters: Array<{format:string,endpoints:string[],boundaryHint:string}>,
 *   clusterCount:number, boundaryCandidates:number}}
 */
export function mapErrorFormats(observations) {
  const groups = {};
  for (const obs of observations || []) {
    const format = (obs.errorFormat || 'unknown').trim().toLowerCase() || 'unknown';
    if (!groups[format]) groups[format] = [];
    if (!groups[format].includes(obs.endpoint)) groups[format].push(obs.endpoint);
  }
  const clusters = Object.entries(groups).map(([format, endpoints]) => ({
    format,
    endpoints,
    boundaryHint:
      endpoints.length > 1
        ? `endpoints share the "${format}" error envelope — likely the same microservice / framework stack`
        : `only one endpoint uses the "${format}" envelope — possible standalone service or outlier`,
  }));
  return {
    clusters,
    clusterCount: clusters.length,
    boundaryCandidates: clusters.filter((c) => c.endpoints.length === 1).length,
  };
}

// ---------------------------------------------------------------------------
// Idea 1184 — Non-standard status-code mapping
// ---------------------------------------------------------------------------

const KNOWN_NON_STANDARD = {
  419: 'Page Expired — commonly used for CSRF/session token expiry (Laravel convention)',
  420: 'Enhance Your Calm — used by some APIs as a rate-limit/wait signal (Twitter legacy)',
  425: 'Too Early — replay-risk hint for early-data requests',
  440: 'Login Timeout — IIS session-expiry convention',
  449: 'Retry With — IIS configuration-state signal',
  451: 'Unavailable For Legal Reasons — censorship / takedown marker',
  509: 'Bandwidth Limit Exceeded — hosting-plan throttle signal',
  520: 'Web Server Returned an Unknown Error — reverse-proxy upstream failure',
  521: 'Web Server Is Down — reverse-proxy upstream unreachable',
  522: 'Connection Timed Out — reverse-proxy upstream timeout',
  523: 'Origin Is Unreachable — reverse-proxy upstream routing failure',
  524: 'A Timeout Occurred — reverse-proxy upstream slow response',
  525: 'SSL Handshake Failed — reverse-proxy TLS failure',
  526: 'Invalid SSL Certificate — reverse-proxy upstream cert problem',
  527: 'Railgun Error — reverse-proxy WAN-optimizer failure',
  530: 'Site Frozen — hosting account suspension marker',
  599: 'Network Connect Timeout — proxy network failure',
};

/**
 * Catalog non-standard (app-specific / unofficial) HTTP status codes.
 *
 * @param {Array<{endpoint:string,status:number}>} observations
 * @returns {{codes: Array<{status:number,endpoints:string[],documented:boolean,stateNote:string}>,
 *   documentedCount:number, undocumentedCount:number}}
 */
export function mapNonStandardCodes(observations) {
  const byCode = {};
  for (const obs of observations || []) {
    const status = Number(obs.status);
    if (!Number.isInteger(status)) continue;
    // Standard codes: 1xx, 2xx, 3xx, plus documented 4xx/5xx — keep only non-standard ones
    const isStandard =
      (status >= 100 && status < 400) ||
      (status >= 400 && status <= 451 && status !== 419 && status !== 420 && status !== 440 && status !== 449);
    if (!isStandard || KNOWN_NON_STANDARD[status]) {
      if (isStandard && !KNOWN_NON_STANDARD[status]) continue;
      if (!byCode[status]) byCode[status] = new Set();
      byCode[status].add(obs.endpoint);
    }
  }
  const codes = Object.entries(byCode).map(([status, endpoints]) => {
    const code = Number(status);
    const documented = Boolean(KNOWN_NON_STANDARD[code]);
    return {
      status: code,
      endpoints: [...endpoints],
      documented,
      stateNote: documented
        ? KNOWN_NON_STANDARD[code]
        : 'undocumented app-specific status — treat as an application state machine signal; ' +
          'map which transitions trigger it and check whether it gates privileged flows',
    };
  });
  return {
    codes,
    documentedCount: codes.filter((c) => c.documented).length,
    undocumentedCount: codes.filter((c) => !c.documented).length,
  };
}

// ---------------------------------------------------------------------------
// Idea 1185 — Health-check info disclosure
// ---------------------------------------------------------------------------

const HEALTH_SENSITIVE = [
  { re: /"version"\s*:\s*"[^"]+"/i, label: 'version string' },
  { re: /\b\d+\.\d+\.\d+[-+a-z0-9.]*\b/i, label: 'version-like token' },
  { re: /redis|postgres|mysql|mongo|elastic|kafka|rabbitmq/i, label: 'dependency state detail' },
  { re: /hostname|instance.?id|pod.?name|container.?id/i, label: 'instance/hostname identity' },
  { re: /uptime|started.?at|build.?time|commit/i, label: 'build/runtime metadata' },
  { re: /db.?password|secret|api.?key|token/i, label: 'possible credential leak' },
  { re: /stack|trace|exception/i, label: 'stack trace detail' },
];

function severityFor(findings) {
  if (findings.includes('possible credential leak')) return 'high';
  if (findings.some((f) => f === 'version string' || f === 'instance/hostname identity' || f === 'stack trace detail')) return 'medium';
  if (findings.length > 0) return 'low';
  return 'none';
}

/**
 * Assess a /health-type endpoint body for verbose info disclosure.
 *
 * @param {{path:string,body:string,contentType?:string}} probe
 * @returns {{path:string,contentType:string,verbose:boolean,findings:string[],severity:string,note:string}}
 */
export function assessHealthDisclosure({ path, body, contentType = '' }) {
  const text = String(body || '');
  const findings = [];
  for (const { re, label } of HEALTH_SENSITIVE) {
    if (re.test(text) && !findings.includes(label)) findings.push(label);
  }
  const verbose = findings.length > 0;
  const severity = severityFor(findings);
  return {
    path,
    contentType: contentType || 'unknown',
    verbose,
    findings,
    severity,
    note: verbose
      ? `health endpoint discloses: ${findings.join(', ')} (severity ${severity}) — ` +
        'version/instance detail aids targeted attack planning; restrict verbose output or gate the endpoint'
      : 'health endpoint returns a minimal status payload — no actionable disclosure detected',
  };
}

// ---------------------------------------------------------------------------
// Idea 1186 — Metrics endpoint discovery
// ---------------------------------------------------------------------------

const PROMETHEUS_LINE = /^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?\s+[0-9.eE+-]+(\s+\d+)?$/;

/**
 * Classify a /metrics-style body and flag leaked labels/instances.
 *
 * @param {{path:string,body:string}} probe
 * @returns {{path:string,kind:'prometheus'|'generic'|'not-metrics',
 *   prometheusSeries:number, leakedLabels:string[], instanceLeak:boolean, note:string}}
 */
export function classifyMetricsExposure({ path, body }) {
  const text = String(body || '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const promLines = lines.filter((l) => !l.startsWith('#') && PROMETHEUS_LINE.test(l));
  const hasHelpOrType = lines.some((l) => l.startsWith('# HELP') || l.startsWith('# TYPE'));
  const kind = promLines.length > 0 ? 'prometheus' : hasHelpOrType ? 'prometheus' : 'not-metrics';

  const leakedLabels = new Set();
  const labelRe = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]{1,120})"/g;
  let m;
  for (const line of promLines) {
    let inner;
    while ((inner = labelRe.exec(line)) !== null) {
      const [, name, value] = inner;
      if (/instance|pod|node|host|ip|address|namespace|container/i.test(name) && value) {
        leakedLabels.add(`${name}=${value}`);
      }
    }
  }
  const instanceLeak = [...leakedLabels].some((l) => /^instance=/.test(l));
  const leaked = [...leakedLabels];
  return {
    path,
    kind,
    prometheusSeries: promLines.length,
    leakedLabels: leaked,
    instanceLeak,
    note:
      kind === 'prometheus'
        ? instanceLeak
          ? `Prometheus exposition format exposed (${promLines.length} series) WITH instance/host labels — ` +
            'internal topology detail an attacker can map; gate or strip instance labels'
          : `Prometheus exposition format exposed (${promLines.length} series) — ` +
            'confirms telemetry endpoint is reachable; verify authz before treating as a finding'
        : 'body does not look like a metrics exposition — no Prometheus-style disclosure detected',
  };
}

// ---------------------------------------------------------------------------
// Idea 1187 — Debug endpoint sweep
// ---------------------------------------------------------------------------

const DEBUG_SIGNALS = [
  { re: /\/debug\/pprof/i, label: 'pprof', verdict: 'Go pprof profiling endpoint EXPOSED — stack/goroutine/allocation detail aids exploitation planning' },
  { re: /debug\/vars/i, label: 'debug-vars', verdict: 'expvar debug-vars endpoint EXPOSED — runtime variables and build info visible' },
  { re: /console\.?log|\bdebugger\b/i, label: 'client-debug', verdict: 'client-side debug hooks present — check for verbose logging of tokens/keys' },
  { re: /stacktrace|stackTrace/i, label: 'stacktrace-flag', verdict: 'stack-trace rendering flag present — may expose internals on errors' },
  { re: /\bX-Debug\b|\bdebug\s*=\s*true/i, label: 'debug-header', verdict: 'debug mode indicator present — verify whether debug responses are gated' },
  { re: /heapdump|heap.?snapshot|jmap/i, label: 'heapdump', verdict: 'heap-dump facility referenced — heap snapshots can contain secrets in memory' },
  { re: /\/phpinfo/i, label: 'phpinfo', verdict: 'phpinfo page exposed — full PHP/environment configuration disclosed' },
];

/**
 * Assess a suspected debug endpoint path + body for debug exposure.
 *
 * @param {{path:string,body:string}} probe
 * @returns {{path:string,exposed:boolean,signals:string[],verdicts:string[],risk:string}}
 */
export function assessDebugExposure({ path, body }) {
  const haystack = `${path || ''}\n${body || ''}`;
  const signals = [];
  const verdicts = [];
  for (const { re, label, verdict } of DEBUG_SIGNALS) {
    if (re.test(haystack)) {
      signals.push(label);
      verdicts.push(verdict);
    }
  }
  const exposed = signals.length > 0;
  return {
    path,
    exposed,
    signals,
    verdicts,
    risk: exposed
      ? signals.includes('pprof') || signals.includes('phpinfo') || signals.includes('heapdump')
        ? 'high'
        : 'medium'
      : 'none',
  };
}

// ---------------------------------------------------------------------------
// Idea 1188 — Feature-flag evaluation probe
// ---------------------------------------------------------------------------

/**
 * Map feature-flag evaluation results across varied request contexts to
 * reveal targeting rules and flag-gated capabilities.
 *
 * @param {Array<{context:string,flagsReturned:Record<string,boolean|string>}>} observations
 * @returns {{flags: Record<string,{contexts:string[],values:any[],targeted:boolean,disclosure:string}>,
 *   targetedCount:number, flagCount:number}}
 */
export function mapFlagEvaluation(observations) {
  const perFlag = {};
  for (const obs of observations || []) {
    const flags = obs.flagsReturned || {};
    for (const [flag, value] of Object.entries(flags)) {
      if (!perFlag[flag]) perFlag[flag] = { contexts: [], values: [] };
      const entry = perFlag[flag];
      if (!entry.contexts.includes(obs.context)) entry.contexts.push(obs.context);
      if (!entry.values.some((v) => v === value)) entry.values.push(value);
    }
  }
  const flags = {};
  for (const [flag, { contexts, values }] of Object.entries(perFlag)) {
    const targeted = values.length > 1;
    flags[flag] = {
      contexts,
      values,
      targeted,
      disclosure: targeted
        ? `flag "${flag}" varies across contexts (${contexts.join(' vs ')}) — ` +
          `targeting rule disclosed; check whether the gated capability is enforced server-side, not just hidden in UI`
        : `flag "${flag}" is constant across ${contexts.length} context(s) — no targeting rule disclosed`,
    };
  }
  return {
    flags,
    flagCount: Object.keys(flags).length,
    targetedCount: Object.values(flags).filter((f) => f.targeted).length,
  };
}

// ---------------------------------------------------------------------------
// Idea 1189 — A/B bucketing endpoint map
// ---------------------------------------------------------------------------

/**
 * Map A/B experiment assignments from bucketing-endpoint responses.
 *
 * @param {Array<{endpoint:string,responseBody:string}>} observations
 * @returns {{experiments: Array<{name:string,variants:string[],trafficSplit:Record<string,number>,
 *   endpoints:string[],disclosure:string}>, experimentCount:number}}
 */
export function mapBucketing(observations) {
  const byName = {};
  const nameRes = [/experiment(?:_name)?\s*["':=]+\s*["']?([\w.-]+)/i, /"test"\s*:\s*"([\w.-]+)"/i];
  const variantRes = [/variant\s*["':=]+\s*["']?([\w.-]+)/i, /"group"\s*:\s*"([\w.-]+)"/i, /bucket\s*["':=]+\s*["']?([\w.-]+)/i];
  const splitRe = /"?(\w[\w.-]*)"?\s*:\s*(\d+(?:\.\d+)?)\s*%/g;

  for (const obs of observations || []) {
    const body = String(obs.responseBody || '');
    let name = 'unknown-experiment';
    for (const re of nameRes) {
      const m = body.match(re);
      if (m) { name = m[1]; break; }
    }
    if (!byName[name]) byName[name] = { variants: new Set(), trafficSplit: {}, endpoints: new Set() };
    const entry = byName[name];
    entry.endpoints.add(obs.endpoint);
    for (const re of variantRes) {
      const m = body.match(re);
      if (m) entry.variants.add(m[1]);
    }
    let s;
    splitRe.lastIndex = 0;
    while ((s = splitRe.exec(body)) !== null) {
      entry.trafficSplit[s[1]] = Number(s[2]);
    }
  }

  const experiments = Object.entries(byName).map(([name, e]) => {
    const variants = [...e.variants];
    const hasSplit = Object.keys(e.trafficSplit).length > 0;
    return {
      name,
      variants,
      trafficSplit: e.trafficSplit,
      endpoints: [...e.endpoints],
      disclosure:
        name === 'unknown-experiment'
          ? 'no experiment identifier found in response — bucketing surface unclear'
          : `experiment "${name}" exposes variants [${variants.join(', ') || 'none parsed'}]` +
            (hasSplit ? ` with traffic split ${JSON.stringify(e.trafficSplit)}` : ' (no explicit traffic split parsed)') +
            ' — client-side bucketing logic can be overridden; verify experiment-gated features server-side',
    };
  });
  return { experiments, experimentCount: experiments.length };
}

// ---------------------------------------------------------------------------
// Idea 1190 — Kill-switch endpoint detection
// ---------------------------------------------------------------------------

const KILL_SWITCH_RES = [
  /kill.?switch/i,
  /feature.?off|disable.?feature/i,
  /emergency.?stop|panic/i,
  /maintenance.?mode/i,
  /shutdown|power.?off/i,
  /circuit.?breaker/i,
  /degrad/i,
];

const RISKY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Detect kill-switch / feature-off route candidates from route observations.
 *
 * @param {Array<{path:string,method?:string,auth?:'none'|'required'|'unknown'}>} routes
 * @returns {{candidates: Array<{path:string,method:string,auth:string,matched:string[],
 *   risk:'high'|'medium'|'low',reason:string}>, highRiskCount:number}}
 */
export function detectKillSwitches(routes) {
  const candidates = [];
  for (const route of routes || []) {
    const path = String(route.path || '');
    const matched = KILL_SWITCH_RES.filter((re) => re.test(path)).map((re) => re.source);
    if (matched.length === 0) continue;
    const method = (route.method || 'GET').toUpperCase();
    const auth = route.auth || 'unknown';
    const mutating = RISKY_METHODS.has(method);
    const unauth = auth === 'none';
    const risk = unauth && mutating ? 'high' : unauth || mutating ? 'medium' : 'low';
    candidates.push({
      path,
      method,
      auth,
      matched,
      risk,
      reason: unauth && mutating
        ? 'UNAUTHENTICATED mutating kill-switch candidate — highest priority: verify authz before any interaction'
        : unauth
          ? 'unauthenticated read access to a kill-switch surface — confirm whether state can be changed'
          : mutating
            ? 'mutating kill-switch route — verify authorization is enforced server-side'
            : 'read-only kill-switch route — informational; confirm no state change is possible',
    });
  }
  candidates.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]));
  return { candidates, highRiskCount: candidates.filter((c) => c.risk === 'high').length };
}

// ---------------------------------------------------------------------------
// Coverage registry
// ---------------------------------------------------------------------------

/** Idea numbers implemented by this module. */
export const WAVE1181_COVERAGE = [1181, 1182, 1183, 1184, 1185, 1186, 1187, 1188, 1189, 1190];

/**
 * Map of idea number → implementing function name, for progress bookkeeping.
 * @returns {Record<number,string>}
 */
export function ideaFunctions() {
  return {
    1181: 'measureClockSkew',
    1182: 'catalogErrorCodes',
    1183: 'mapErrorFormats',
    1184: 'mapNonStandardCodes',
    1185: 'assessHealthDisclosure',
    1186: 'classifyMetricsExposure',
    1187: 'assessDebugExposure',
    1188: 'mapFlagEvaluation',
    1189: 'mapBucketing',
    1190: 'detectKillSwitches',
  };
}
