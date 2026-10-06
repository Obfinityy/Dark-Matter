/**
 * dockerApiProber.js — Exposed Docker daemon socket detector (idea 00463).
 *
 * Detects publicly reachable Docker Remote API endpoints by fingerprinting
 * their version/info responses over HTTP. An exposed daemon implies
 * unauthenticated container control, so a positive hit is always a
 * critical-severity finding for the asset owner. Detection only: this
 * module never sends mutating requests and never issues container commands.
 */

const DOCKER_VERSION_PATTERNS = [
  // GET /version -> {"Version":"24.0.7","ApiVersion":"1.43",...}
  /"Version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
];

const DOCKER_API_VERSION_PATTERN = /"ApiVersion"\s*:\s*"(\d+\.\d+)"/i;

const DOCKER_ENDPOINT_HINTS = ['/version', '/info', '/_ping', '/containers/json'];

const DOCKER_MANDATORY_FIELDS = [
  '"Platform"',
  '"ApiVersion"',
  '"Components"',
  '"Os"',
  '"Arch"',
];

/**
 * Parse Docker version metadata out of an API response body.
 * @param {string} body
 * @returns {{version: string|null, apiVersion: string|null, os: string|null, arch: string|null}}
 */
export function parseDockerApiResponse(body) {
  const text = String(body || '');
  const result = { version: null, apiVersion: null, os: null, arch: null };

  const v = DOCKER_VERSION_PATTERNS[0].exec(text);
  if (v) result.version = v[1];

  const a = DOCKER_API_VERSION_PATTERN.exec(text);
  if (a) result.apiVersion = a[1];

  const os = /"Os"\s*:\s*"([^"]+)"/i.exec(text);
  if (os) result.os = os[1];

  const arch = /"Arch"\s*:\s*"([^"]+)"/i.exec(text);
  if (arch) result.arch = arch[1];

  return result;
}

/**
 * Score how strongly a body looks like a Docker Remote API response.
 * @param {string} body
 * @returns {{score: number, fields: string[]}}
 */
export function scoreDockerFingerprint(body) {
  const text = String(body || '');
  const fields = DOCKER_MANDATORY_FIELDS.filter((f) => text.includes(f));
  let score = fields.length;

  if (/docker/i.test(text)) score += 1;
  if (/Buildkit|buildkit/i.test(text)) score += 1;
  if (/"Experimental"\s*:\s*(true|false)/i.test(text)) score += 1;

  return { score, fields };
}

/**
 * Check a Docker API endpoint response for exposure.
 * @param {{url, status, headers, body}} input — one Docker API HTTP response
 * @returns {object} structured finding
 */
export function checkDockerApi({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const { score, fields } = scoreDockerFingerprint(text);
  const parsed = parseDockerApiResponse(text);
  const evidence = [];
  let confidence = 'low';
  let exposedPath = null;

  for (const hint of DOCKER_ENDPOINT_HINTS) {
    if (url.includes(hint)) {
      exposedPath = hint;
      break;
    }
  }

  // /_ping on a Docker daemon answers "OK" with API-Version header
  const pingHeader = headers && (headers['API-Version'] || headers['api-version']);
  if (exposedPath === '/_ping' && /^ok$/i.test(text.trim()) && pingHeader) {
    confidence = 'high';
    evidence.push(`/_ping answered OK with API-Version ${pingHeader}.`);
  }

  // /info discloses kernel, containers, and storage driver details
  if (exposedPath === '/info' && status === 200 && /"Containers"\s*:\s*\d+/i.test(text)) {
    confidence = 'high';
    evidence.push('The /info endpoint discloses live daemon state (containers, storage driver, kernel).');
  }

  if (score >= 4) {
    confidence = 'high';
    evidence.push(`Response contains ${fields.length} Docker Remote API signature fields (${fields.join(', ')}).`);
  } else if (score >= 2) {
    confidence = 'medium';
    evidence.push(`Response contains Docker API signature fields: ${fields.join(', ') || 'version markers'}.`);
  }

  if (parsed.version) evidence.push(`Disclosed Engine version: ${parsed.version} (API ${parsed.apiVersion || 'unknown'}).`);
  if (parsed.os || parsed.arch) evidence.push(`Disclosed host platform: ${[parsed.os, parsed.arch].filter(Boolean).join('/')}.`);

  const detected = confidence === 'high' || (status === 200 && score >= 3);

  if (!detected) {
    return {
      detected: false,
      service: 'Docker Engine Remote API',
      reason: 'No Docker daemon API fingerprint matched.',
    };
  }

  return {
    detected: true,
    service: 'Docker Engine Remote API',
    endpoint: exposedPath,
    version: parsed.version,
    apiVersion: parsed.apiVersion,
    confidence,
    severity: 'Critical',
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

export const DOCKER_API_PROBER = { checkDockerApi, parseDockerApiResponse, scoreDockerFingerprint, DOCKER_ENDPOINT_HINTS };
export default DOCKER_API_PROBER;
