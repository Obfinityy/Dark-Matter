/**
 * clientHintAnalyzer.js — Client-Hints response-header analysis engine.
 *
 * Analyzes Accept-CH, Critical-CH, Accept-CH-Lifetime and related response
 * headers observed on authorized targets to fingerprint the serving stack.
 * Different frameworks/CDNs request characteristic hint sets (e.g. Vercel /
 * Next.js image optimization hints, Cloudflare's UA hints, Shopify's DPR
 * hints), and misuse (deprecated hints, over-broad Critical-CH) is a
 * configuration finding in its own right.
 *
 * Pure header analysis; performs no requests.
 */

/**
 * Framework/CDN fingerprint signatures keyed on requested hint sets.
 */
const HINT_STACK_SIGNATURES = [
  { stack: 'vercel-nextjs', hints: ['sec-ch-viewport-width', 'sec-ch-dpr', 'dpr', 'width', 'viewport-width'], note: 'Next.js Image Optimization requests viewport/DPR hints.' },
  { stack: 'cloudflare', hints: ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'], note: 'Cloudflare edge commonly forwards UA client hints.' },
  { stack: 'shopify', hints: ['sec-ch-dpr', 'dpr', 'width'], note: 'Shopify storefronts request DPR/width for responsive images.' },
  { stack: 'akamai-imaging', hints: ['sec-ch-dpr', 'sec-ch-viewport-width', 'sec-ch-width'], note: 'Akamai Image & Video Manager hint set.' },
  { stack: 'wordpress-jetpack', hints: ['dpr', 'width', 'viewport-width'], note: 'Jetpack Photon/Site Accelerator legacy hint set.' },
  { stack: 'generic-cdn-imaging', hints: ['sec-ch-dpr', 'sec-ch-width'], note: 'Generic image-CDN hint set.' },
];

const DEPRECATED_HINTS = new Set(['dpr', 'width', 'viewport-width', 'device-memory']);
const HIGH_ENTROPY_HINTS = new Set([
  'sec-ch-ua-full-version-list', 'sec-ch-ua-full-version', 'sec-ch-ua-arch',
  'sec-ch-ua-bitness', 'sec-ch-ua-model', 'sec-ch-ua-wow64', 'sec-ch-prefers-color-scheme',
]);

/**
 * Parse an Accept-CH / Critical-CH header value into a normalized hint list.
 * @param {string} headerValue
 * @returns {string[]} lowercase hint tokens
 */
export function parseHintHeader(headerValue) {
  if (typeof headerValue !== 'string' || headerValue.trim() === '') return [];
  return headerValue
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

/**
 * Parse the full client-hints header set from a response.
 * @param {object} headers response headers (any casing)
 * @returns {{acceptCH: string[], criticalCH: string[], lifetimeSec: number|null, permissionsPolicy: string}}
 */
export function parseClientHintHeaders(headers = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = String(v);
  const lifetime = Number.parseInt(h['accept-ch-lifetime'], 10);
  return {
    acceptCH: parseHintHeader(h['accept-ch']),
    criticalCH: parseHintHeader(h['critical-ch']),
    lifetimeSec: Number.isFinite(lifetime) ? lifetime : null,
    permissionsPolicy: h['permissions-policy'] || '',
  };
}

/**
 * Fingerprint the serving stack from requested client hints.
 * @param {string[]} acceptCH normalized Accept-CH hint list
 * @returns {{stack: string, confidence: number, matched: string[], note: string}[]}
 */
export function fingerprintHintStack(acceptCH = []) {
  const hints = new Set((Array.isArray(acceptCH) ? acceptCH : []).map((x) => String(x).toLowerCase()));
  if (hints.size === 0) return [];
  const scored = [];
  for (const sig of HINT_STACK_SIGNATURES) {
    const matched = sig.hints.filter((x) => hints.has(x));
    if (matched.length === 0) continue;
    const confidence = Math.min(95, Math.round((matched.length / sig.hints.length) * 100));
    scored.push({ stack: sig.stack, confidence, matched, note: sig.note });
  }
  return scored.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Assess the privacy/configuration posture of the hint deployment.
 * @param {{acceptCH: string[], criticalCH: string[], lifetimeSec: number|null, permissionsPolicy: string}} parsed
 * @returns {{findings: {code: string, severity: 'info'|'low'|'medium', detail: string}[], privacyScore: number}}
 */
export function assessHintPosture(parsed = {}) {
  const findings = [];
  const acceptCH = Array.isArray(parsed.acceptCH) ? parsed.acceptCH : [];
  const criticalCH = Array.isArray(parsed.criticalCH) ? parsed.criticalCH : [];

  const deprecated = acceptCH.filter((x) => DEPRECATED_HINTS.has(x));
  if (deprecated.length > 0) {
    findings.push({ code: 'deprecated-hints', severity: 'low', detail: `Deprecated hints requested: ${deprecated.join(', ')} — migrate to Sec-CH-* equivalents.` });
  }
  const highEntropy = acceptCH.filter((x) => HIGH_ENTROPY_HINTS.has(x));
  if (highEntropy.length > 0) {
    findings.push({ code: 'high-entropy-hints', severity: 'medium', detail: `High-entropy hints requested (${highEntropy.join(', ')}) — increases fingerprinting surface; ensure a privacy review.` });
  }
  if (criticalCH.length > 3) {
    findings.push({ code: 'critical-ch-broad', severity: 'low', detail: `Critical-CH lists ${criticalCH.length} hints — clients without them get a retry round-trip; keep critical sets minimal.` });
  }
  if (parsed.lifetimeSec !== null && parsed.lifetimeSec > 0 && parsed.lifetimeSec < 86400) {
    findings.push({ code: 'short-hint-lifetime', severity: 'info', detail: `Accept-CH-Lifetime is ${parsed.lifetimeSec}s (<24h) — hints re-negotiate often.` });
  }
  if (/ch-ua/i.test(parsed.permissionsPolicy || '') && !/self/.test(parsed.permissionsPolicy || '')) {
    findings.push({ code: 'permissions-policy-restrictive', severity: 'info', detail: 'Permissions-Policy restricts client-hints delegation.' });
  }
  if (acceptCH.length === 0) {
    findings.push({ code: 'no-client-hints', severity: 'info', detail: 'No Accept-CH advertised — no fingerprinting signal from client hints.' });
  }

  const penalty = findings.reduce((sum, f) => sum + (f.severity === 'medium' ? 20 : f.severity === 'low' ? 10 : 2), 0);
  return { findings, privacyScore: Math.max(0, 100 - penalty) };
}

export const CLIENT_HINT_ANALYZER = {
  parseHintHeader,
  parseClientHintHeaders,
  fingerprintHintStack,
  assessHintPosture,
};
