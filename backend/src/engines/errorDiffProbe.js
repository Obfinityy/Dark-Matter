/**
 * errorDiffProbe.js — error-message differential fingerprinting.
 *
 * Servers reveal their identity in the exact text and status codes they
 * return for controlled error conditions: unsupported methods, over-long
 * URIs, malformed headers, bad HTTP versions. This module analyzes the
 * recorded error responses and builds a normalized error signature that
 * can be matched against known server behaviors.
 *
 * Pure analysis: the caller supplies the triggered error responses.
 * Only benign, standards-defined error triggers are modeled — the module
 * never generates payloads, only classifies observed behavior.
 *
 * Defensive use: authorized fingerprinting during bug-bounty recon to
 * identify the real stack behind generic banners.
 */

const SCENARIOS = ['bad-method', 'long-uri', 'malformed-header', 'bad-version', 'unknown-host'];

/**
 * Normalize an error body to a comparable signature.
 *
 * @param {string} body
 * @returns {string}
 */
export function normalizeErrorBody(body) {
  return String(body || '')
    .replace(/\d{1,3}(?:\.\d{1,3}){3}/g, '<IP>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<HEX>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * Extract the HTML <title> from an error page, if present.
 *
 * @param {string} body
 * @returns {string|null}
 */
export function extractErrorTitle(body) {
  const m = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(String(body || ''));
  return m ? m[1].trim() : null;
}

/**
 * Classify one error response into a normalized signature record.
 *
 * @param {{ scenario: string, status: number, headers?: object, body?: string }} response
 * @returns {{ scenario: string, status: number, title: string|null, signature: string, serverHeader: string|null }}
 */
export function classifyError({ scenario, status, headers = {}, body = '' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = String(v);
  return {
    scenario: SCENARIOS.includes(scenario) ? scenario : 'unknown',
    status: Number(status) || 0,
    title: extractErrorTitle(body),
    signature: normalizeErrorBody(body),
    serverHeader: h['server'] || null,
  };
}

// Known (status, scenario) behavior markers keyed by server family.
// Values are arrays of [scenario, expectedStatus, markerRegex].
const KNOWN_BEHAVIORS = [
  {
    family: 'nginx',
    checks: [
      ['bad-method', 405, /405 Not Allowed/i],
      ['long-uri', 414, /414/i],
      ['malformed-header', 400, /400 Bad Request/i],
    ],
  },
  {
    family: 'apache',
    checks: [
      ['bad-method', 405, /Method Not Allowed/i],
      ['long-uri', 414, /Request-URI Too (Long|Large)/i],
      ['malformed-header', 400, /Bad Request/i],
    ],
  },
  {
    family: 'iis',
    checks: [
      ['bad-method', 405, /405/i],
      ['long-uri', 404, /404/i],
      ['malformed-header', 400, /Bad Request/i],
    ],
  },
  {
    family: 'cloudflare',
    checks: [
      ['bad-method', 405, /Method Not Allowed/i],
      ['long-uri', 414, /414/i],
      ['malformed-header', 400, /cloudflare/i],
    ],
  },
];

/**
 * Score the observed error signature against known server behaviors.
 *
 * @param {{ scenario: string, status: number, signature: string }[]} classified
 * @returns {{ family: string, score: number }[]} Ranked matches, best first.
 */
export function matchKnownBehaviors(classified) {
  const byScenario = {};
  for (const c of classified) byScenario[c.scenario] = c;
  const results = KNOWN_BEHAVIORS.map(({ family, checks }) => {
    let hits = 0;
    for (const [scenario, status, marker] of checks) {
      const obs = byScenario[scenario];
      if (obs && obs.status === status && marker.test(`${obs.signature} ${obs.title || ''}`))
        hits++;
    }
    return { family, score: hits / checks.length };
  });
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Full differential fingerprint from a set of triggered error responses.
 *
 * @param {{ responses: { scenario: string, status: number, headers?: object, body?: string }[], banner?: string }} input
 * @returns {{ type: string, banner: string, errors: object[], candidates: object[], bestGuess: string|null, confidence: string, evidence: string }}
 */
export function analyzeErrorFingerprint({ responses = [], banner = '' } = {}) {
  const errors = responses.map(classifyError);
  const candidates = matchKnownBehaviors(errors);
  const best = candidates[0];
  const bestGuess = best && best.score >= 0.5 ? best.family : null;
  const confidence = bestGuess ? (best.score >= 0.9 ? 'high' : 'medium') : 'low';

  const sigLine = errors.map(e => `${e.scenario}=${e.status}`).join(', ');
  return {
    type: 'Error-Message Differential Fingerprinting',
    banner: String(banner || ''),
    errors,
    candidates,
    bestGuess,
    confidence,
    evidence:
      errors.length > 0
        ? `Error differential across ${errors.length} scenario(s) (${sigLine})${
            bestGuess
              ? ` best matches '${bestGuess}' (score ${best.score.toFixed(2)})`
              : ' matches no known behavior strongly'
          }.`
        : 'No error responses supplied.',
  };
}

export const ERROR_DIFF_PROBE = {
  SCENARIOS,
  normalizeErrorBody,
  extractErrorTitle,
  classifyError,
  matchKnownBehaviors,
  analyzeErrorFingerprint,
};
export default ERROR_DIFF_PROBE;
