/**
 * securityHeaderScoring.js — security-header posture scoring and framework-default fingerprinting.
 *
 * Implements idea-bank item 00432: score the set of security-related
 * response headers observed on a target to derive a maturity score, and use
 * the pattern of missing headers to fingerprint framework defaults.
 *
 * All functions are pure and side-effect free: they operate on header
 * name/value pairs observed during an authorized engagement (supplied by
 * the caller). No network requests are performed here.
 */

/**
 * Catalog of scored security headers: header name, weight, and a check
 * against the observed value.
 */
export const SECURITY_HEADERS = [
  { name: 'strict-transport-security', weight: 20, check: (v) => /max-age\s*=\s*\d+/i.test(v || '') },
  { name: 'content-security-policy', weight: 20, check: (v) => typeof v === 'string' && v.trim().length > 0 },
  { name: 'x-frame-options', weight: 10, check: (v) => /^(deny|sameorigin)/i.test(v || '') },
  { name: 'x-content-type-options', weight: 10, check: (v) => /^nosniff/i.test(v || '') },
  { name: 'referrer-policy', weight: 10, check: (v) => typeof v === 'string' && v.trim().length > 0 },
  { name: 'permissions-policy', weight: 10, check: (v) => typeof v === 'string' && v.trim().length > 0 },
  { name: 'cross-origin-opener-policy', weight: 5, check: (v) => /^(same-origin|same-origin-allow-popups)/i.test(v || '') },
  { name: 'cross-origin-embedder-policy', weight: 5, check: (v) => /^require-corp/i.test(v || '') },
  { name: 'cross-origin-resource-policy', weight: 5, check: (v) => /^(same-origin|same-site|cross-site)/i.test(v || '') },
  { name: 'x-xss-protection', weight: 3, check: (v) => /^0/.test(v || '') || /^1;\s*mode=block/i.test(v || '') },
  { name: 'expect-ct', weight: 2, check: (v) => /max-age\s*=\s*\d+/i.test(v || '') },
];

/**
 * Look up a header value case-insensitively.
 * @param {object} headers Header map (name -> value).
 * @param {string} name Header name to find.
 * @returns {string|null}
 */
export function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return null;
  const want = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) return headers[key];
  }
  return null;
}

/**
 * Score the security-header posture of an observed response.
 * @param {object} headers Header map (name -> value) observed from a response.
 * @returns {{score:number, maxScore:number, present:Array<{name:string, value:string, weight:number}>, missing:Array<{name:string, weight:number}>, grade:string}}
 */
export function scoreSecurityHeaders(headers) {
  const present = [];
  const missing = [];
  let score = 0;
  let maxScore = 0;
  for (const entry of SECURITY_HEADERS) {
    maxScore += entry.weight;
    const value = getHeader(headers, entry.name);
    if (value != null && entry.check(value)) {
      score += entry.weight;
      present.push({ name: entry.name, value: String(value), weight: entry.weight });
    } else {
      missing.push({ name: entry.name, weight: entry.weight });
    }
  }
  const pct = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const grade = pct >= 80 ? 'mature' : pct >= 50 ? 'developing' : pct >= 25 ? 'weak' : 'absent';
  return { score: pct, maxScore: 100, present, missing, grade };
}

/**
 * Known server/stack banners paired with the default header pattern each
 * framework typically ships with. Used only for fingerprinting from
 * observed values — never probed.
 */
export const FRAMEWORK_HEADER_DEFAULTS = [
  {
    framework: 'Express (Node.js)',
    signals: [
      (h) => getHeader(h, 'x-powered-by') === 'Express',
      (h) => getHeader(h, 'x-content-type-options') == null && getHeader(h, 'x-frame-options') == null,
    ],
    note: 'Default Express sets no security headers; X-Powered-By: Express is on unless disabled.',
  },
  {
    framework: 'Django',
    signals: [
      (h) => /Django/i.test(getHeader(h, 'x-frame-options') || '') === false && (getHeader(h, 'x-frame-options') || '').toUpperCase() === 'DENY',
      (h) => getHeader(h, 'content-security-policy') == null,
    ],
    note: 'Django middleware sets X-Frame-Options: DENY by default but no CSP out of the box.',
  },
  {
    framework: 'Ruby on Rails',
    signals: [
      (h) => /SAMEORIGIN/i.test(getHeader(h, 'x-frame-options') || ''),
      (h) => getHeader(h, 'x-xss-protection') != null,
      (h) => getHeader(h, 'x-download-options') != null,
    ],
    note: 'Rails default headers include X-Frame-Options: SAMEORIGIN, X-XSS-Protection and X-Download-Options.',
  },
  {
    framework: 'ASP.NET / IIS',
    signals: [
      (h) => /ASP\.NET|Microsoft-IIS/i.test(getHeader(h, 'server') || '') || getHeader(h, 'x-powered-by') != null && /ASP\.NET/i.test(getHeader(h, 'x-powered-by')),
      (h) => getHeader(h, 'x-frame-options') == null,
    ],
    note: 'ASP.NET/IIS expose Server or X-Powered-By banners and ship without security headers by default.',
  },
  {
    framework: 'Nginx',
    signals: [(h) => /^nginx/i.test(getHeader(h, 'server') || '')],
    note: 'Nginx adds no security headers unless explicitly configured.',
  },
];

/**
 * Fingerprint the likely framework from observed header defaults.
 * @param {object} headers Header map (name -> value) observed from a response.
 * @returns {Array<{framework:string, confidence:string, note:string, matchedSignals:number}>} sorted by confidence.
 */
export function fingerprintFrameworkDefaults(headers) {
  const results = [];
  for (const entry of FRAMEWORK_HEADER_DEFAULTS) {
    const matched = entry.signals.filter((fn) => {
      try {
        return fn(headers) === true;
      } catch {
        return false;
      }
    }).length;
    if (matched === 0) continue;
    const confidence = matched >= entry.signals.length ? 'high' : matched >= 2 ? 'medium' : 'low';
    results.push({ framework: entry.framework, confidence, note: entry.note, matchedSignals: matched });
  }
  const rank = { high: 3, medium: 2, low: 1 };
  return results.sort((a, b) => rank[b.confidence] - rank[a.confidence] || b.matchedSignals - a.matchedSignals);
}

/**
 * Full posture assessment: score plus framework hints and a plain-language summary.
 * @param {object} headers Header map (name -> value) observed from a response.
 * @returns {{score:number, grade:string, present:Array, missing:Array, frameworks:Array, summary:string}}
 */
export function assessSecurityPosture(headers) {
  const { score, present, missing, grade } = scoreSecurityHeaders(headers);
  const frameworks = fingerprintFrameworkDefaults(headers);
  const summary =
    grade === 'mature'
      ? 'Mature security-header posture: the core hardening headers are all present.'
      : grade === 'developing'
        ? `Developing posture: ${missing.length} of ${SECURITY_HEADERS.length} scored headers are missing, mostly ${missing.slice(0, 3).map((m) => m.name).join(', ')}.`
        : grade === 'weak'
          ? `Weak posture: only ${present.length} hardening header(s) observed — likely framework defaults with no hardening pass.`
          : 'No security headers observed at all: the response relies entirely on defaults.';
  return { score, grade, present, missing, frameworks, summary };
}
