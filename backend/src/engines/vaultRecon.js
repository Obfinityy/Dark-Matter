/**
 * vaultRecon.js — HashiCorp Vault status probing engine (idea 00462).
 *
 * Detects exposed Vault status endpoints and reports the seal state,
 * initialization state, and version they disclose. The status endpoints
 * (/v1/sys/seal-status, /v1/sys/health, /v1/sys/init, /v1/sys/leader) are
 * intentionally unauthenticated, so a reachable Vault leaking version or an
 * uninitialized/unsealed state is valuable recon for the asset owner —
 * detection and state parsing only, no secret access attempted.
 */

const VAULT_VERSION_PATTERNS = [
  /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  /vault[\s-]*v?(\d+\.\d+\.\d+[-\w.]*)/i,
];

const VAULT_UI_PATTERNS = [/<title>\s*Vault\s*<\/title>/i, /hashicorp[\s-]*vault/i];

const VAULT_ENDPOINT_HINTS = [
  '/v1/sys/seal-status',
  '/v1/sys/health',
  '/v1/sys/init',
  '/v1/sys/leader',
  '/v1/sys/host-info',
];

/**
 * Parse seal/init state and version from a Vault status response body.
 * @param {string} body
 * @returns {{sealed: boolean|null, initialized: boolean|null, version: string|null}}
 */
export function parseVaultStatus(body) {
  const text = String(body || '');
  const result = { sealed: null, initialized: null, version: null };

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.sealed === 'boolean') result.sealed = parsed.sealed;
    if (typeof parsed.initialized === 'boolean') result.initialized = parsed.initialized;
    if (typeof parsed.version === 'string') result.version = parsed.version;
  }

  if (!result.version) {
    for (const re of VAULT_VERSION_PATTERNS) {
      const m = re.exec(text);
      if (m) {
        result.version = m[1];
        break;
      }
    }
  }

  return result;
}

/**
 * Check a Vault endpoint response for exposure and disclosed state.
 * @param {{url, status, headers, body}} input — one Vault HTTP response
 * @returns {object} structured finding
 */
export function checkVault({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const state = parseVaultStatus(text);
  const evidence = [];
  let confidence = 'low';
  let exposedPath = null;

  for (const hint of VAULT_ENDPOINT_HINTS) {
    if (url.includes(hint)) {
      exposedPath = hint;
      break;
    }
  }

  const looksLikeStatus =
    /"sealed"\s*:/i.test(text) ||
    /"initialized"\s*:/i.test(text) ||
    /"ha_enabled"\s*:/i.test(text) ||
    /"cluster_id"\s*:/i.test(text);

  if (looksLikeStatus) {
    confidence = 'high';
    if (state.sealed === true) evidence.push('Vault reports seal state: SEALED.');
    else if (state.sealed === false) evidence.push('Vault reports seal state: UNSEALED.');
    if (state.initialized === false) {
      evidence.push('Vault is UNINITIALIZED — the setup process has not been completed.');
    }
  }

  for (const re of VAULT_UI_PATTERNS) {
    if (re.test(text)) {
      evidence.push('Response matches the Vault web UI fingerprint.');
      if (confidence === 'low') confidence = 'medium';
      break;
    }
  }

  const headerValues = Object.values(headers || {}).join(' ');
  if (/vault/i.test(headerValues) || /x-vault/i.test(Object.keys(headers || {}).join(' '))) {
    evidence.push('Server headers reference Vault.');
    if (confidence === 'low') confidence = 'medium';
  }

  const detected = looksLikeStatus || (status === 200 && evidence.length > 0);

  if (!detected) {
    return {
      detected: false,
      service: 'HashiCorp Vault',
      reason: 'No Vault status endpoint fingerprint matched.',
    };
  }

  if (state.version) evidence.push(`Disclosed version: ${state.version}.`);

  // An uninitialized or unsealed Vault reachable from the internet is the
  // most actionable finding here; sealed instances are a lower-priority note.
  let severity = 'Medium';
  if (state.initialized === false) severity = 'High';
  else if (state.sealed === false) severity = 'High';
  else if (state.sealed === true) severity = 'Low';

  return {
    detected: true,
    service: 'HashiCorp Vault',
    endpoint: exposedPath,
    version: state.version,
    sealed: state.sealed,
    initialized: state.initialized,
    confidence,
    severity,
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

export const VAULT_RECON = { checkVault, parseVaultStatus, VAULT_ENDPOINT_HINTS };
export default VAULT_RECON;
