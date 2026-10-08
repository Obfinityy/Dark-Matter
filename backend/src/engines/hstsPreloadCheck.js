/**
 * hstsPreloadCheck.js — HSTS header parsing and preload-list readiness analysis.
 *
 * Implements idea-bank item 00431: check Strict-Transport-Security headers
 * and preload-list eligibility to infer the security posture of a target.
 *
 * All functions are pure and side-effect free: they operate on header
 * name/value pairs observed during an authorized engagement (supplied by the
 * caller). No network requests are performed here.
 */

/**
 * Parse a Strict-Transport-Security header value into its directives.
 * @param {string} headerValue Raw Strict-Transport-Security header value.
 * @returns {{maxAge:number|null, includeSubDomains:boolean, preload:boolean, raw:string, valid:boolean}|null}
 */
export function parseHsts(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const result = {
    maxAge: null,
    includeSubDomains: false,
    preload: false,
    raw: headerValue,
    valid: false,
  };
  for (const part of headerValue.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    const name = (eq === -1 ? trimmed : trimmed.slice(0, eq))
      .trim()
      .toLowerCase()
      .replace(/-/g, '');
    const value = eq === -1 ? '' : trimmed.slice(eq + 1).trim();
    if (name === 'maxage') {
      const age = parseInt(value, 10);
      if (Number.isFinite(age) && age >= 0) result.maxAge = age;
    } else if (name === 'includesubdomains') {
      result.includeSubDomains = true;
    } else if (name === 'preload') {
      result.preload = true;
    }
  }
  result.valid = result.maxAge !== null;
  return result;
}

/**
 * Chromium HSTS preload-list submission requirements.
 * @param {{maxAge:number|null, includeSubDomains:boolean, preload:boolean, valid:boolean}|null} parsed Parsed HSTS value from parseHsts.
 * @returns {{eligible:boolean, score:number, missing:string[], notes:string[]}}
 */
export function preloadReadiness(parsed) {
  const missing = [];
  const notes = [];
  if (!parsed || !parsed.valid) {
    return {
      eligible: false,
      score: 0,
      missing: ['no valid Strict-Transport-Security header'],
      notes,
    };
  }
  if (parsed.maxAge < 31536000) missing.push('max-age below 31536000 (one year)');
  if (!parsed.includeSubDomains) missing.push('includeSubDomains directive absent');
  if (!parsed.preload) missing.push('preload directive absent');
  if (parsed.maxAge >= 63072000)
    notes.push('long max-age (two years or more) indicates deliberate hardening');
  if (parsed.maxAge < 86400) notes.push('very short max-age suggests a trial rollout of HSTS');
  const score = Math.max(0, 100 - missing.length * 30);
  return { eligible: missing.length === 0, score, missing, notes };
}

/**
 * Find the Strict-Transport-Security header in an observed header set,
 * case-insensitively.
 * @param {object} headers Header map (name -> value) observed from a response.
 * @returns {string|null} Raw header value, or null when absent.
 */
export function findHstsHeader(headers) {
  if (!headers || typeof headers !== 'object') return null;
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'strict-transport-security') return headers[name];
  }
  return null;
}

/**
 * Assess the overall HSTS posture from observed response headers.
 * @param {object} headers Header map (name -> value) observed from a response.
 * @param {object} [opts] { https?: boolean } whether the observation was taken over HTTPS.
 * @returns {{present:boolean, parsed:object|null, readiness:object, grade:string, posture:string}}
 */
export function assessHstsPosture(headers, opts = {}) {
  const raw = findHstsHeader(headers);
  const parsed = raw != null ? parseHsts(raw) : null;
  const readiness = preloadReadiness(parsed);
  const https = opts.https !== false;
  let grade;
  if (!https) {
    grade = 'none';
  } else if (!parsed) {
    grade = 'none';
  } else if (readiness.eligible) {
    grade = 'strong';
  } else if (parsed.maxAge >= 31536000 && parsed.includeSubDomains) {
    grade = 'moderate';
  } else {
    grade = 'weak';
  }
  const posture =
    grade === 'strong'
      ? 'Preload-eligible HSTS: mature HTTPS posture with includeSubDomains and the preload flag.'
      : grade === 'moderate'
        ? 'Solid HSTS deployment with long max-age and subdomain coverage, but not preload-eligible.'
        : grade === 'weak'
          ? 'HSTS is present but weakly configured; upgrade path visible before preload submission.'
          : https
            ? 'No HSTS observed: HTTPS downgrade attacks are not mitigated at the browser level.'
            : 'Observed over plain HTTP; HSTS cannot apply here — check the HTTPS variant of this endpoint.';
  return { present: parsed !== null, parsed, readiness, grade, posture };
}
