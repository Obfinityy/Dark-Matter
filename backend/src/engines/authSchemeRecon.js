/**
 * authSchemeRecon.js — Authentication-scheme, CORS, and response-surface recon engine.
 *
 * Implements idea-bank ideas 1171–1180 as pure analyzer functions. Every
 * function consumes OBSERVED response data collected by the agent against
 * authorized targets (never active exploitation), and returns structured
 * findings for the hunt diary and report pipeline.
 *
 * Defensive framing: no raw exploit payloads, no weaponized code, no
 * credential-guessing. Probe values and observed values are synthetic in
 * tests; sensitive server details are flagged, never echoed verbatim.
 *
 * Run smoke: cd backend && node --test tests/authSchemeRecon.test.js
 */

export const WAVE1171_COVERAGE = [
  1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178, 1179, 1180,
];

/**
 * Normalizes a header bag (case-insensitive keys, string values).
 * @param {object} headers - Raw header object.
 * @returns {object} Lower-cased key → string value map.
 */
function normHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue;
    out[String(k).toLowerCase()] = String(v);
  }
  return out;
}

/**
 * Parses one or more WWW-Authenticate header values into scheme tokens.
 * Handles comma-joined challenges; only the first token of each challenge
 * is treated as the scheme name (parameters like realm= are skipped).
 * @param {string|string[]} value - Raw header value(s).
 * @returns {string[]} Upper-normalized scheme names in order of appearance.
 */
function parseAuthSchemes(value) {
  if (Array.isArray(value)) {
    const merged = [];
    for (const v of value) {
      for (const s of parseAuthSchemes(v)) {
        if (!merged.includes(s)) merged.push(s);
      }
    }
    return merged;
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  const schemes = [];
  for (const challenge of value.split(',')) {
    const token = challenge.trim().split(/\s+/)[0];
    if (!token) continue;
    const normalized = token.toUpperCase();
    if (!schemes.includes(normalized)) schemes.push(normalized);
  }
  return schemes;
}

const WEAK_SCHEMES = new Set(['BASIC', 'DIGEST']);
const STRONG_SCHEMES = new Set(['BEARER', 'NEGOTIATE', 'NTLM', 'OAUTH', 'OIDC', 'MTLS', 'CLIENTCERT']);

/**
 * Idea 1171 — WWW-Authenticate scheme analysis.
 *
 * Catalogs the authentication schemes offered per endpoint from observed
 * 401 WWW-Authenticate responses, and flags risky fallback paths (e.g. a
 * Negotiate-first server that silently accepts Basic).
 *
 * @param {Array<{endpoint: string, wwwAuthenticate: string|string[]}>} observations
 * @returns {Array<{endpoint: string, schemes: string[], schemeCount: number, hasFallbackPath: boolean, fallbackDetail: string|null}>}
 */
export function catalogAuthSchemes(observations = []) {
  return observations.map((obs) => {
    const endpoint = obs?.endpoint ?? '(unknown)';
    const schemes = parseAuthSchemes(obs?.wwwAuthenticate);
    let fallbackDetail = null;
    const hasNegotiate = schemes.includes('NEGOTIATE');
    const hasBasic = schemes.includes('BASIC');
    if (hasNegotiate && hasBasic) {
      fallbackDetail =
        'Endpoint offers Negotiate alongside Basic — clients may downgrade to the weaker Basic scheme.';
    }
    return {
      endpoint,
      schemes,
      schemeCount: schemes.length,
      hasFallbackPath: fallbackDetail !== null,
      fallbackDetail,
    };
  });
}

/**
 * Idea 1172 — Multiple-auth precedence analysis.
 *
 * Determines which credential a server honored when several were sent at
 * once (e.g. both a session cookie and an Authorization header), and flags
 * when a weak credential overrode a stronger one.
 *
 * @param {object} options
 * @param {boolean} [options.cookiePresent] - Session cookie was sent.
 * @param {boolean} [options.headerPresent] - Authorization header was sent.
 * @param {'cookie'|'header'|'none'|'ambiguous'} [options.observedIdentity] - Which credential the server acted on.
 * @returns {{cookiePresent: boolean, headerPresent: boolean, observedIdentity: string, verdict: string, weakOverridesStrong: boolean}}
 */
export function analyzeAuthPrecedence({ cookiePresent = false, headerPresent = false, observedIdentity = 'ambiguous' } = {}) {
  const identity = String(observedIdentity ?? 'ambiguous').toLowerCase();
  let verdict;
  switch (identity) {
    case 'cookie':
      verdict = cookiePresent
        ? 'Server honored the cookie credential over the header credential.'
        : 'Observed cookie identity but no cookie was sent — inconclusive.';
      break;
    case 'header':
      verdict = headerPresent
        ? 'Server honored the header credential over the cookie credential.'
        : 'Observed header identity but no header was sent — inconclusive.';
      break;
    case 'none':
      verdict = 'Server honored neither credential — treated the request as anonymous.';
      break;
    default:
      verdict = 'Could not determine which credential the server honored.';
  }
  // Session cookies are generally the weaker channel relative to an
  // explicitly-scoped Authorization header, so cookie-wins is flagged.
  const weakOverridesStrong = identity === 'cookie' && headerPresent === true;
  return {
    cookiePresent: Boolean(cookiePresent),
    headerPresent: Boolean(headerPresent),
    observedIdentity: identity,
    verdict,
    weakOverridesStrong,
  };
}

/**
 * Idea 1173 — Auth-scheme fallback detection.
 *
 * Interprets observations where the primary (stronger) auth channel was
 * deliberately omitted and the server still accepted the request.
 *
 * @param {object} options
 * @param {boolean} [options.primaryOmitted] - Primary credential was not sent.
 * @param {boolean} [options.secondaryAccepted] - Request still succeeded.
 * @param {boolean} [options.mfaSkipped] - MFA step was bypassed on that path.
 * @returns {{fallbackPresent: boolean, severity: 'none'|'medium'|'high'|'critical', finding: string}}
 */
export function detectAuthFallback({ primaryOmitted = false, secondaryAccepted = false, mfaSkipped = false } = {}) {
  const fallbackPresent = Boolean(primaryOmitted && secondaryAccepted);
  let severity = 'none';
  let finding = 'No auth-scheme fallback detected — omitting the primary credential did not yield access.';
  if (fallbackPresent) {
    severity = mfaSkipped ? 'critical' : 'high';
    finding = mfaSkipped
      ? 'Fallback path accepts a secondary credential AND skips the MFA step — the stronger scheme can be bypassed.'
      : 'Fallback path accepts a secondary credential when the primary is omitted — downgrade path present.';
  } else if (mfaSkipped) {
    severity = 'medium';
    finding = 'MFA was skipped without a primary-omission fallback — verify whether a weaker auth path was used.';
  }
  return { fallbackPresent, severity, finding };
}

/**
 * Idea 1174 — Anonymous access via method change.
 *
 * Maps HTTP methods that return 200 (or 2xx) without authentication on
 * endpoints that otherwise require auth (401/403 for the reference method).
 *
 * @param {Array<{endpoint: string, methodStatuses: object}>} observations
 * @returns {Array<{endpoint: string, protectedBy: string[], anonymousMethods: string[], gapPresent: boolean}>}
 */
export function mapMethodAuthGaps(observations = []) {
  return observations.map((obs) => {
    const endpoint = obs?.endpoint ?? '(unknown)';
    const statuses = obs?.methodStatuses ?? {};
    const methods = Object.keys(statuses);
    const isProtected = (code) => {
      const n = Number(code);
      return n === 401 || n === 403;
    };
    const isSuccess = (code) => {
      const n = Number(code);
      return n >= 200 && n < 300;
    };
    const protectedBy = methods.filter((m) => isProtected(statuses[m]));
    const anonymousMethods = methods.filter((m) => isSuccess(statuses[m]));
    return {
      endpoint,
      protectedBy,
      anonymousMethods,
      gapPresent: protectedBy.length > 0 && anonymousMethods.length > 0,
    };
  });
}

const TRUSTED_ORIGIN_KEYWORDS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Idea 1175 — Preflight CORS mapping per endpoint.
 *
 * Builds a per-route map of trusted origins from observed OPTIONS
 * responses and flags credentialed-wildcard configurations.
 *
 * @param {Array<{endpoint: string, origin: string, allowOrigin: string, allowCredentials: string, vary: string}>} observations
 * @returns {Array<{endpoint: string, origin: string, allowOrigin: string|null, credentialsAllowed: boolean, credentialedWildcard: boolean, reflectsOrigin: boolean, varyPresent: boolean, risk: 'none'|'low'|'medium'|'high'}>}
 */
export function mapPreflightCORS(observations = []) {
  return observations.map((obs) => {
    const endpoint = obs?.endpoint ?? '(unknown)';
    const origin = obs?.origin ?? '';
    const allowOrigin = obs?.allowOrigin ? String(obs.allowOrigin) : null;
    const credentialsAllowed = String(obs?.allowCredentials ?? '').toLowerCase() === 'true';
    const varyPresent = String(obs?.vary ?? '').toLowerCase().includes('origin');
    const credentialedWildcard = allowOrigin === '*' && credentialsAllowed;
    const reflectsOrigin = allowOrigin !== null && allowOrigin !== '*' && origin !== '' && allowOrigin === origin;
    let risk = 'none';
    if (credentialedWildcard) {
      risk = 'high';
    } else if (reflectsOrigin && credentialsAllowed) {
      risk = 'medium';
    } else if (reflectsOrigin || allowOrigin === '*') {
      risk = 'low';
    }
    return {
      endpoint,
      origin,
      allowOrigin,
      credentialsAllowed,
      credentialedWildcard,
      reflectsOrigin,
      varyPresent,
      risk,
    };
  });
}

/**
 * Idea 1176 — Response content-type sniffing check.
 *
 * Verifies that X-Content-Type-Options: nosniff is present on responses;
 * missing the header allows MIME-sniffing driven XSS on APIs.
 *
 * @param {object} headers - Observed response headers.
 * @returns {{nosniffPresent: boolean, headerValue: string|null, sniffingRisk: boolean, finding: string}}
 */
export function checkSniffing(headers = {}) {
  const h = normHeaders(headers);
  const value = h['x-content-type-options'] ?? null;
  const nosniffPresent = value !== null && value.toLowerCase().split(/[\s;,]+/).includes('nosniff');
  return {
    nosniffPresent,
    headerValue: value,
    sniffingRisk: !nosniffPresent,
    finding: nosniffPresent
      ? 'X-Content-Type-Options: nosniff is present — MIME-sniffing mitigated.'
      : 'X-Content-Type-Options: nosniff is missing — browsers may MIME-sniff responses.',
  };
}

const HTML_SIGNATURE = /<\s*(!doctype|html|head|body)\b/i;

function looksLikeHtml(status, contentType, body) {
  if (typeof body !== 'string') return false;
  if (contentType && /text\/html/i.test(String(contentType))) return true;
  return HTML_SIGNATURE.test(body);
}

/**
 * Idea 1177 — API HTML error-page detection.
 *
 * Classifies error bodies; an HTML error page served by a JSON API is a
 * potential reflected-content XSS foothold when attacker-influenced values
 * are echoed into it.
 *
 * @param {Array<{status: number, contentType: string, body: string}>} observations
 * @returns {Array<{status: number, isHtml: boolean, declaresJson: boolean, mismatch: boolean, xssFoothold: boolean, finding: string}>}
 */
export function detectHtmlErrorPages(observations = []) {
  return observations.map((obs) => {
    const status = obs?.status ?? 0;
    const contentType = obs?.contentType ? String(obs.contentType) : '';
    const body = typeof obs?.body === 'string' ? obs.body : '';
    const isHtml = looksLikeHtml(status, contentType, body);
    const declaresJson = /application\/(.+\+)?json/i.test(contentType);
    const mismatch = isHtml && declaresJson;
    const xssFoothold = isHtml && status >= 400;
    let finding;
    if (mismatch) {
      finding = 'HTML body served with a JSON content-type — reflected content would execute in the API origin context.';
    } else if (xssFoothold) {
      finding = 'HTML error page served by an API endpoint — verify whether reflected input is echoed unescaped.';
    } else {
      finding = 'No HTML error-page condition detected.';
    }
    return { status, isHtml, declaresJson, mismatch, xssFoothold, finding };
  });
}

const STACK_TRACE_PATTERNS = [
  { name: 'python-traceback', re: /Traceback \(most recent call last\):/ },
  { name: 'java-exception', re: /(?:^|\n)\s*(?:[a-zA-Z_$][\w$.]*\.)*[A-Z][\w$]*Exception\b/ },
  { name: 'node-error', re: /^\s*at\s+[^(]*\([^)]*:\d+:\d+\)/m },
  { name: 'dotnet-exception', re: /\bSystem\.[A-Za-z]+Exception\b/ },
  { name: 'php-stack', re: /#\d+\s+\/[\w\-./]+\(\d+\)/ },
  { name: 'sql-error', re: /\b(?:SQLSTATE|ORA-|PG::|MySQL server version)\b/i },
];

const REDACTED = '[redacted]';

/**
 * Idea 1178 — Stack-trace disclosure scan.
 *
 * Detects stack traces / internal error details in response bodies. Leaked
 * file paths and library versions are flagged by pattern; actual values are
 * redacted — findings carry the pattern name and a boolean, never the text.
 *
 * @param {Array<{endpoint: string, status: number, body: string}>} observations
 * @returns {Array<{endpoint: string, status: number, traceDetected: boolean, patterns: string[], pathLeak: boolean, versionLeak: boolean, finding: string}>}
 */
export function detectStackTraces(observations = []) {
  return observations.map((obs) => {
    const endpoint = obs?.endpoint ?? '(unknown)';
    const status = obs?.status ?? 0;
    const body = typeof obs?.body === 'string' ? obs.body : '';
    const matched = STACK_TRACE_PATTERNS.filter((p) => p.re.test(body)).map((p) => p.name);
    const pathLeak = /([A-Z]:\\[\w\\.-]+|\/[\w\-./]*\.(?:py|js|java|php|rb|go))/.test(body);
    const versionLeak = /\b(?:v?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\s*\((?:python|node|ruby|java|php|go)\)/i.test(body)
      || /(?:Python|Node\.js|Django|Flask|Rails|Spring)\s+\d+\.\d+/i.test(body);
    const traceDetected = matched.length > 0;
    let finding;
    if (traceDetected) {
      const extras = [];
      if (pathLeak) extras.push('file paths');
      if (versionLeak) extras.push('library versions');
      finding = `Stack trace detected (${REDACTED} patterns: ${matched.join(', ')})`
        + (extras.length ? ` with likely leaked ${extras.join(' and ')} — values ${REDACTED}.` : '.');
    } else {
      finding = 'No stack-trace patterns detected in the response body.';
    }
    return {
      endpoint,
      status,
      traceDetected,
      patterns: matched,
      pathLeak,
      versionLeak,
      finding,
    };
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RANDOM_RE = /^[0-9a-f]{16,}$/i;

/**
 * Idea 1179 — Request-ID format analysis.
 *
 * Studies observed X-Request-ID values to decide whether request IDs are
 * sequential (enumeration-feasible), random, or UUID-shaped.
 *
 * @param {string[]} requestIds - Observed request-ID values.
 * @returns {{count: number, format: 'uuid'|'random'|'sequential'|'short'|'mixed'|'unknown', entropyBitsEstimate: number|null, enumerationFeasible: boolean, finding: string}}
 */
export function analyzeRequestIdFormat(requestIds = []) {
  const ids = (Array.isArray(requestIds) ? requestIds : [])
    .filter((v) => typeof v === 'string' && v.length > 0);
  if (ids.length === 0) {
    return {
      count: 0,
      format: 'unknown',
      entropyBitsEstimate: null,
      enumerationFeasible: false,
      finding: 'No request IDs observed — format unknown.',
    };
  }

  const unique = new Set(ids);
  const allUuid = ids.every((v) => UUID_RE.test(v));
  const allNumeric = ids.every((v) => /^\d+$/.test(v));
  const numericValues = allNumeric ? ids.map(Number) : [];
  const numericSorted = [...numericValues].sort((a, b) => a - b);
  const sequential = allNumeric && numericSorted.every((v, i) => i === 0 || v > numericSorted[i - 1]) && ids.length >= 3;
  const allHexRandom = ids.every((v) => HEX_RANDOM_RE.test(v)) && unique.size === ids.length;
  const minLen = Math.min(...ids.map((v) => v.length));

  let format = 'mixed';
  if (allUuid) format = 'uuid';
  else if (sequential) format = 'sequential';
  else if (allHexRandom) format = 'random';
  else if (minLen < 8) format = 'short';

  // Rough entropy estimate: unique count across observed values mapped to a bit scale.
  let entropyBitsEstimate = null;
  if (allUuid) entropyBitsEstimate = 122;
  else if (format === 'random') entropyBitsEstimate = Math.round(minLen * 4);
  else if (format === 'sequential' || format === 'short') entropyBitsEstimate = Math.max(0, Math.round(Math.log2(unique.size || 1)));

  const enumerationFeasible = format === 'sequential' || format === 'short';
  const finding = enumerationFeasible
    ? `Request IDs appear ${format} — enumeration is feasible; predict future IDs to correlate cross-user activity.`
    : `Request IDs appear ${format} — not practically enumerable.`;
  return { count: ids.length, format, entropyBitsEstimate, enumerationFeasible, finding };
}

const CUSTOM_TIME_HEADER_RE = /^(x-(?:server|request|response|api|app)-(?:time|date|timestamp|timedate))|^(date)$/i;
const DATE_HEADER_RE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * Idea 1180 — Server timestamp leakage.
 *
 * Extracts time information from response headers: the standard Date
 * header plus any custom timestamp headers, normalized to ISO 8601.
 *
 * @param {object} headers - Observed response headers.
 * @returns {{date: string|null, customTimeHeaders: string[], serverTimeISO: string|null, leaked: boolean}}
 */
export function extractServerTime(headers = {}) {
  const h = normHeaders(headers);
  const date = h['date'] ?? null;
  const customTimeHeaders = Object.keys(h).filter(
    (k) => k !== 'date' && CUSTOM_TIME_HEADER_RE.test(k),
  );
  let serverTimeISO = null;
  if (date && DATE_HEADER_RE.test(date)) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) serverTimeISO = parsed.toISOString();
  }
  if (!serverTimeISO) {
    for (const k of customTimeHeaders) {
      const candidate = new Date(h[k]);
      if (!Number.isNaN(candidate.getTime())) {
        serverTimeISO = candidate.toISOString();
        break;
      }
    }
  }
  return {
    date,
    customTimeHeaders,
    serverTimeISO,
    leaked: serverTimeISO !== null,
  };
}

/**
 * Maps each covered idea number to the implementing function name.
 * @returns {object} Idea number → exported function name.
 */
export function ideaFunctions() {
  return {
    1171: 'catalogAuthSchemes',
    1172: 'analyzeAuthPrecedence',
    1173: 'detectAuthFallback',
    1174: 'mapMethodAuthGaps',
    1175: 'mapPreflightCORS',
    1176: 'checkSniffing',
    1177: 'detectHtmlErrorPages',
    1178: 'detectStackTraces',
    1179: 'analyzeRequestIdFormat',
    1180: 'extractServerTime',
  };
}

export const AUTH_SCHEME_RECON = {
  catalogAuthSchemes,
  analyzeAuthPrecedence,
  detectAuthFallback,
  mapMethodAuthGaps,
  mapPreflightCORS,
  checkSniffing,
  detectHtmlErrorPages,
  detectStackTraces,
  analyzeRequestIdFormat,
  extractServerTime,
  ideaFunctions,
  WAVE1171_COVERAGE,
};

export default AUTH_SCHEME_RECON;
