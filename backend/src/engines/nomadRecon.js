/**
 * nomadRecon.js — HashiCorp Nomad API exposure checker (idea 00461).
 *
 * Detects exposed Nomad API endpoints from HTTP responses and parses the
 * version / cluster metadata they disclose. Nomad's agent endpoints
 * (/v1/agent/self, /v1/status/leader, /v1/agent/members) are unauthenticated
 * by default unless ACLs are enabled, so a reachable endpoint is a finding
 * worth reporting to the asset owner — detection only, no exploitation.
 */

const NOMAD_VERSION_PATTERNS = [
  // /v1/agent/self returns {"config":{...},"member":{...}} plus "Version"
  /"Version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  // UI / v1/status responses sometimes embed a version string
  /nomad[\s-]v?(\d+\.\d+\.\d+[-\w.]*)/i,
];

const NOMAD_UI_PATTERNS = [/<title>\s*Nomad\s*<\/title>/i, /hashicorp[\s-]*nomad/i];

const NOMAD_ENDPOINT_HINTS = [
  '/v1/agent/self',
  '/v1/status/leader',
  '/v1/agent/members',
  '/v1/agent/host',
];

/**
 * Parse a version string out of a Nomad response body.
 * @param {string} body
 * @returns {string|null}
 */
export function parseNomadVersion(body) {
  if (!body) return null;
  for (const re of NOMAD_VERSION_PATTERNS) {
    const m = re.exec(body);
    if (m) return m[1];
  }
  return null;
}

/**
 * Check a Nomad endpoint response for exposure and disclosed metadata.
 * @param {{url, status, headers, body}} input — one Nomad HTTP response
 * @returns {object} structured finding
 */
export function checkNomad({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const evidence = [];
  let confidence = 'low';
  let version = parseNomadVersion(text);
  let exposedPath = null;

  for (const hint of NOMAD_ENDPOINT_HINTS) {
    if (url.includes(hint)) {
      exposedPath = hint;
      break;
    }
  }

  // /v1/agent/self discloses full agent config (datacenter, bind addr, ACL state)
  let disclosesConfig = false;
  if (/"member"\s*:\s*\{[^}]*"Addr"/i.test(text) || /"config"\s*:\s*\{/i.test(text)) {
    disclosesConfig = true;
    evidence.push(
      'Response contains Nomad agent self metadata (datacenter, bind address, ACL state).'
    );
    confidence = 'high';
  }

  // /v1/status/leader returns a leader address
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(text.trim()) || /"leader"\s*:\s*"/i.test(text)) {
    evidence.push('Status endpoint discloses cluster leader address.');
    confidence = 'high';
  }

  for (const re of NOMAD_UI_PATTERNS) {
    if (re.test(text)) {
      evidence.push('Response matches the Nomad web UI fingerprint.');
      if (confidence === 'low') confidence = 'medium';
      break;
    }
  }

  const headerValues = Object.values(headers || {}).join(' ');
  if (/nomad/i.test(headerValues)) {
    evidence.push('Server headers reference Nomad.');
    if (confidence === 'low') confidence = 'medium';
  }

  const detected = status === 200 && (disclosesConfig || evidence.length > 0);

  if (!detected) {
    return {
      detected: false,
      service: 'HashiCorp Nomad',
      reason: 'No Nomad API exposure fingerprint matched.',
    };
  }

  if (version) evidence.push(`Disclosed version: ${version}.`);

  return {
    detected: true,
    service: 'HashiCorp Nomad',
    endpoint: exposedPath,
    version,
    confidence,
    severity: disclosesConfig ? 'High' : 'Medium',
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

export const NOMAD_RECON = { checkNomad, parseNomadVersion, NOMAD_ENDPOINT_HINTS };
export default NOMAD_RECON;
