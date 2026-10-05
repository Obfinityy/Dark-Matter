/**
 * corsPreflightMap.js — CORS preflight behavior mapping and misconfiguration detection.
 *
 * Implements idea-bank item 00433: map CORS handling per endpoint from
 * observed preflight (OPTIONS) responses to fingerprint frameworks and
 * surface misconfigurations.
 *
 * All functions are pure and side-effect free: they operate on preflight
 * observation objects supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/**
 * Classify a single observed preflight response.
 * @param {object} obs { endpoint?: string, method?: string, requestOrigin?: string,
 *   allowOrigin?: string|null, allowMethods?: string|null, allowHeaders?: string|null,
 *   allowCredentials?: string|null, vary?: string|null, status?: number|null }
 * @returns {{endpoint:string, policy:string, misconfigurations:string[], fingerprintHints:string[], details:object}}
 */
export function classifyPreflight(obs) {
  const o = obs || {};
  const endpoint = o.endpoint || 'unknown';
  const allowOrigin = o.allowOrigin != null ? String(o.allowOrigin).trim() : null;
  const requestOrigin = o.requestOrigin != null ? String(o.requestOrigin).trim() : null;
  const allowCredentials = o.allowCredentials != null ? String(o.allowCredentials).trim().toLowerCase() : null;
  const misconfigurations = [];
  const fingerprintHints = [];
  let policy;

  if (allowOrigin == null) {
    policy = 'no-cors';
  } else if (allowOrigin === '*') {
    policy = allowCredentials === 'true' ? 'wildcard-with-credentials' : 'wildcard';
    if (allowCredentials === 'true') {
      misconfigurations.push('Access-Control-Allow-Origin: * combined with Allow-Credentials: true — browsers reject this, and any origin-trusting proxy in front may be abused');
    }
  } else if (requestOrigin && allowOrigin === requestOrigin) {
    policy = allowCredentials === 'true' ? 'reflected-origin-with-credentials' : 'reflected-origin';
    misconfigurations.push('Origin is reflected verbatim — verify the allow-list; arbitrary-origin reflection enables credential theft');
  } else if (allowOrigin.toLowerCase() === 'null') {
    policy = 'null-origin-allowed';
    misconfigurations.push('The literal "null" origin is allowed — sandboxed iframes and redirects can present a null origin');
  } else {
    policy = 'allow-listed-origin';
  }

  const allowMethods = (o.allowMethods || '').toUpperCase();
  if (/\b(TRACE|TRACK|CONNECT)\b/.test(allowMethods)) {
    misconfigurations.push('Dangerous HTTP methods advertised in Access-Control-Allow-Methods: ' + o.allowMethods);
  }
  const vary = (o.vary || '').toLowerCase();
  if ((policy === 'reflected-origin' || policy === 'reflected-origin-with-credentials') && !/\borigin\b/.test(vary)) {
    misconfigurations.push('Reflected Origin without Vary: Origin — caches may poison CORS responses across origins');
  }

  // Framework hints from characteristic header combinations.
  const allowHeaders = (o.allowHeaders || '').toLowerCase();
  if (/x-requested-with/.test(allowHeaders) && /content-type/.test(allowHeaders) && /accept/.test(allowHeaders)) {
    fingerprintHints.push('Express cors-middleware style default Allow-Headers set');
  }
  if (/x-csrf-token|xsrf/.test(allowHeaders)) {
    fingerprintHints.push('CSRF-token aware stack (Rails/Laravel style CORS configuration)');
  }
  if (allowMethods.includes('PATCH') && allowMethods.includes('DELETE') && policy.startsWith('reflected')) {
    fingerprintHints.push('Permissive framework-default CORS (Spring/Django-cors-headers style)');
  }

  return {
    endpoint,
    policy,
    misconfigurations,
    fingerprintHints,
    details: {
      method: o.method || null,
      requestOrigin,
      allowOrigin,
      allowMethods: o.allowMethods || null,
      allowHeaders: o.allowHeaders || null,
      allowCredentials: o.allowCredentials || null,
      status: o.status ?? null,
    },
  };
}

/**
 * Map CORS behavior across many endpoints and aggregate findings.
 * @param {Array<object>} observations Preflight observation objects (same shape as classifyPreflight input).
 * @returns {{endpoints:Array, policyCounts:object, misconfigurations:Array<{endpoint:string, issue:string}>, fingerprintHints:object}}
 */
export function mapCorsBehavior(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const endpoints = list.map(classifyPreflight);
  const policyCounts = {};
  const misconfigurations = [];
  const hintCounts = {};
  for (const e of endpoints) {
    policyCounts[e.policy] = (policyCounts[e.policy] || 0) + 1;
    for (const m of e.misconfigurations) misconfigurations.push({ endpoint: e.endpoint, issue: m });
    for (const h of e.fingerprintHints) hintCounts[h] = (hintCounts[h] || 0) + 1;
  }
  return {
    endpoints,
    policyCounts,
    misconfigurations: misconfigurations.sort((a, b) => a.endpoint.localeCompare(b.endpoint)),
    fingerprintHints: hintCounts,
  };
}

/**
 * Summarize a CORS map into a posture verdict.
 * @param {{policyCounts:object, misconfigurations:Array}} corsMap Output of mapCorsBehavior.
 * @returns {{verdict:string, summary:string, endpointCount:number}}
 */
export function summarizeCorsPosture(corsMap) {
  const counts = corsMap.policyCounts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const risky = (counts['reflected-origin'] || 0) + (counts['reflected-origin-with-credentials'] || 0)
    + (counts['wildcard-with-credentials'] || 0) + (counts['null-origin-allowed'] || 0);
  const verdict = corsMap.misconfigurations.length > 0 ? 'misconfigured' : risky > 0 ? 'permissive' : total === 0 ? 'unknown' : 'restrictive';
  const summary =
    verdict === 'misconfigured'
      ? `${corsMap.misconfigurations.length} CORS misconfiguration(s) across ${total} mapped endpoint(s).`
      : verdict === 'permissive'
        ? `CORS is permissive on ${risky} of ${total} endpoint(s) but without a confirmed misconfiguration.`
        : verdict === 'restrictive'
          ? `CORS is restrictive across ${total} mapped endpoint(s).`
          : 'No preflight observations were supplied.';
  return { verdict, summary, endpointCount: total };
}
