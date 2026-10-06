/**
 * kerberosPreAuthAnalyzer.js — Kerberos KDC pre-authentication analyzer.
 *
 * When a client requests a TGT without required pre-authentication, the KDC
 * answers KDC-ERR-PREAUTH-REQUIRED (error 25) carrying an etype list and
 * optionally principal information. An authorized agent can fingerprint
 * the KDC implementation (MIT krb5, Heimdal, Active Directory) and learn
 * which pre-auth mechanisms and encryption types are enforced.
 *
 * Defensive framing: analysis of error/negotiation data observed during an
 * authorized assessment. The module never derives or tests credentials.
 */

/** Encryption-type table (RFC 6807 / Microsoft extensions). */
const ENCTYPE_NAMES = {
  1: 'des-cbc-crc', 2: 'des-cbc-md4', 3: 'des-cbc-md5',
  16: 'des3-cbc-sha1', 17: 'aes128-cts-hmac-sha1-96', 18: 'aes256-cts-hmac-sha1-96',
  23: 'rc4-hmac', 24: 'camellia128-cts-cmac', 25: 'camellia256-cts-cmac',
  26: 'aes128-cts-hmac-sha256-128', 27: 'aes256-cts-hmac-sha384-192',
};

/** Pre-authentication type table. */
const PATYPE_NAMES = {
  2: 'PA-ENC-TIMESTAMP', 11: 'PA-ETYPE-INFO', 15: 'PA-PW-SALT',
  16: 'PA-ENC-TIMESTAMP', 19: 'PA-ETYPE-INFO2', 133: 'PA-SAM-CHALLENGE',
  134: 'PA-SAM-RESPONSE', 138: 'PA-PK-AS-REQ', 149: 'PA-PK-AS-REP',
  165: 'PA-FX-COOKIE', 167: 'PA-FX-FAST', 196: 'PA-SPAKE',
};

/**
 * Analyze an observed KDC pre-auth-required error.
 *
 * @param {Object} input
 * @param {number} input.errorCode - Kerberos error code (25 = KDC-ERR-PREAUTH-REQUIRED).
 * @param {string} [input.server] - KDC host observed.
 * @param {number[]} [input.etypes] - Encryption types advertised by the KDC.
 * @param {number[]} [input.paTypes] - Pre-auth types required/advertised.
 * @param {string} [input.serverPrincipal] - Server principal echoed by the KDC (e.g. krbtgt/REALM).
 * @returns {Object} Fingerprint finding.
 */
export function analyzePreAuthError({
  errorCode = 0,
  server = '',
  etypes = [],
  paTypes = [],
  serverPrincipal = '',
} = {}) {
  if (errorCode !== 25) {
    return {
      type: 'Kerberos Pre-Auth Analysis',
      fingerprinted: false,
      confidence: 'low',
      evidence: `Observed error code ${errorCode} is not KDC-ERR-PREAUTH-REQUIRED — no pre-auth fingerprint obtainable.`,
    };
  }

  const etypeDetails = etypes.map((e) => ({ code: e, name: ENCTYPE_NAMES[e] || 'unknown' }));
  const paDetails = paTypes.map((p) => ({ code: p, name: PATYPE_NAMES[p] || 'unknown' }));

  // Fingerprinting heuristics from observed negotiation data.
  const fingerprints = [];
  if (etypeDetails.some((e) => e.name === 'rc4-hmac') && etypeDetails.some((e) => /aes/i.test(e.name))) {
    fingerprints.push({ implementation: 'Active Directory', confidence: 'medium', evidence: 'rc4-hmac alongside AES etypes is characteristic of AD KDCs.' });
  }
  if (paDetails.some((p) => p.name === 'PA-SPAKE')) {
    fingerprints.push({ implementation: 'Heimdal', confidence: 'medium', evidence: 'PA-SPAKE advertisement is characteristic of Heimdal KDCs.' });
  }
  if (paDetails.some((p) => p.name === 'PA-FX-FAST')) {
    fingerprints.push({ implementation: 'MIT krb5 (FAST capable)', confidence: 'medium', evidence: 'PA-FX-FAST advertisement is characteristic of MIT krb5.' });
  }

  const weakEtypes = etypeDetails.filter((e) => ['des-cbc-crc', 'des-cbc-md4', 'des-cbc-md5', 'rc4-hmac'].includes(e.name));
  const findings = [];
  if (weakEtypes.length) {
    findings.push({
      type: 'Kerberos Pre-Auth Analysis',
      fingerprinted: true,
      confidence: 'high',
      severity: 'Medium',
      cwe: 'CWE-327',
      evidence: `KDC at ${server || 'target'} advertises weak encryption types: ${weakEtypes.map((e) => e.name).join(', ')} — offline-crackable hashes if user secrets use these etypes.`,
      weakEtypes: weakEtypes.map((e) => e.name),
    });
  }
  if (!paTypes.length && etypes.length) {
    findings.push({
      type: 'Kerberos Pre-Auth Analysis',
      fingerprinted: true,
      confidence: 'medium',
      severity: 'Low',
      evidence: `KDC at ${server || 'target'} did not require pre-authentication (no pa-types advertised) — pre-auth-not-required accounts would be AS-REP roastable.`,
    });
  }

  return {
    type: 'Kerberos Pre-Auth Analysis',
    fingerprinted: true,
    confidence: 'high',
    evidence: `KDC at ${server || 'target'} returned KDC-ERR-PREAUTH-REQUIRED with ${etypeDetails.length} etype(s), ${paDetails.length} pre-auth type(s)${serverPrincipal ? ` for ${serverPrincipal}` : ''}.`,
    etypes: etypeDetails,
    paTypes: paDetails,
    fingerprints,
    findings,
  };
}

/**
 * Summarize an observed realm's KDC exposure from multiple hosts.
 * @param {Array<Object>} observations - Per-host analyzePreAuthError inputs.
 * @returns {Object} Aggregate exposure map.
 */
export function mapKdcExposure(observations = []) {
  const hosts = observations.map((o) => ({
    server: o.server || 'unknown',
    etypeCount: (o.etypes || []).length,
    requiresPreAuth: (o.paTypes || []).length > 0,
  }));
  return {
    type: 'Kerberos KDC Exposure Map',
    confidence: 'medium',
    kdcCount: hosts.length,
    hosts,
    evidence: `${hosts.length} KDC(s) mapped via pre-auth behavior; ${hosts.filter((h) => !h.requiresPreAuth).length} do not advertise pre-auth requirements.`,
  };
}

export const KERBEROS_PRE_AUTH_ANALYZER = {
  analyzePreAuthError,
  mapKdcExposure,
  ENCTYPE_NAMES,
  PATYPE_NAMES,
};
export default KERBEROS_PRE_AUTH_ANALYZER;
