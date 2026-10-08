/**
 * expvarRecon.js — Go expvar endpoint mining.
 *
 * Implements idea 00446 (Expvar endpoint mining):
 * detects the Go `net/http/pprof`-adjacent `expvar` handler (conventionally
 * exposed at `/debug/vars`) and parses its JSON output for service identity:
 * binary path, build info (Go version, module dependencies), runtime stats,
 * and custom application variables that leak package structure.
 *
 * Read-only response parsing — no payloads, no exploits.
 */

/** Conventional and observed expvar handler paths. */
export const EXPVAR_PATHS = ['/debug/vars', '/api/debug/vars', '/_debug/vars'];

/** expvar keys that are informative about the Go service, and what they mean. */
const INTERESTING_VARS = {
  cmdline: 'binary path / launch arguments (service identity)',
  memstats: 'Go runtime memory stats (runtime fingerprint)',
  buildinfo: 'Go build info: toolchain version + module dependency tree',
  'go-version': 'Go toolchain version (sometimes published by apps)',
  'http:request-count': 'HTTP request counters (exposed usage signal)',
  requests: 'custom request counters',
  uptime: 'process uptime (custom var)',
};

/**
 * Detect an exposed Go expvar handler and identify the response shape.
 * @param {{url, status, headers, body}} input
 */
export function detectExpvarEndpoint({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const isJsonObject = parsed !== null && typeof parsed === 'object';
  const hasExpvarKeys =
    isJsonObject && ('cmdline' in parsed || 'memstats' in parsed || 'buildinfo' in parsed);
  const detected = status >= 200 && status < 400 && isJsonObject && hasExpvarKeys;

  return {
    detected,
    idea: '00446',
    url,
    status,
    isGoExpvar: detected,
    confidence: detected ? 'high' : 'low',
    severity: detected ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: detected
      ? `Go expvar handler exposed at ${url} (JSON with cmdline/memstats/buildinfo keys).`
      : `Not a Go expvar endpoint (HTTP ${status}, JSON object: ${isJsonObject}).`,
  };
}

/**
 * Mine a parsed expvar body for service, version, and dependency details.
 * @param {{url, status, headers, body}} input
 */
export function mineExpvar({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      detected: false,
      idea: '00446',
      url,
      status,
      confidence: 'low',
      severity: 'Info',
      cwe: 'CWE-200',
      evidence: 'Body is not expvar JSON; nothing to mine.',
    };
  }

  const keys = Object.keys(parsed);
  const interesting = keys.filter(k => Object.prototype.hasOwnProperty.call(INTERESTING_VARS, k));
  const customVars = keys.filter(
    k =>
      !['cmdline', 'memstats'].includes(k) &&
      !Object.prototype.hasOwnProperty.call(INTERESTING_VARS, k)
  );

  // Service identity from cmdline[0] (binary path).
  let serviceName = null;
  if (Array.isArray(parsed.cmdline) && parsed.cmdline.length > 0) {
    serviceName = String(parsed.cmdline[0]).split('/').pop() || null;
  }

  // Build info: Go version + module dependency tree (may be a JSON string).
  let goVersion = null;
  const dependencies = [];
  let buildinfo = parsed.buildinfo;
  if (typeof buildinfo === 'string') {
    try {
      buildinfo = JSON.parse(buildinfo);
    } catch {
      buildinfo = null;
    }
  }
  if (buildinfo && typeof buildinfo === 'object') {
    goVersion = buildinfo.GoVersion || buildinfo.goversion || null;
    const deps = buildinfo.Deps || buildinfo.deps || [];
    if (Array.isArray(deps)) {
      for (const d of deps.slice(0, 100)) {
        if (d && d.Path && d.Version) dependencies.push({ module: d.Path, version: d.Version });
      }
    }
    const path = buildinfo.Path || buildinfo.path;
    if (path) serviceName = serviceName || String(path).split('/').pop();
  }

  // Runtime fingerprint from memstats keys present.
  const memstatsKeys =
    parsed.memstats && typeof parsed.memstats === 'object'
      ? Object.keys(parsed.memstats).length
      : 0;

  return {
    detected: true,
    idea: '00446',
    url,
    status,
    serviceName,
    goVersion,
    dependencies: dependencies.slice(0, 50),
    customVars: customVars
      .slice(0, 50)
      .map(k => ({ name: k, meaning: 'application-published expvar' })),
    memstatsFields: memstatsKeys,
    interestingVars: interesting.map(k => ({ name: k, meaning: INTERESTING_VARS[k] })),
    confidence: goVersion || dependencies.length > 0 ? 'high' : 'medium',
    severity: goVersion || dependencies.length > 0 || customVars.length > 0 ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence:
      `expvar exposes ${keys.length} variables` +
      (serviceName ? `; binary identified as "${serviceName}"` : '') +
      (goVersion ? `; Go ${goVersion}` : '') +
      (dependencies.length > 0 ? `; ${dependencies.length} module dependencies listed` : '') +
      '.',
  };
}

export const EXPVAR_RECON = {
  detectExpvarEndpoint,
  mineExpvar,
  EXPVAR_PATHS,
};
export default EXPVAR_RECON;
