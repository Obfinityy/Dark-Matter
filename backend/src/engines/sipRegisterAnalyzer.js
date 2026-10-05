/**
 * sipRegisterAnalyzer.js — SIP REGISTER challenge-response analyzer.
 *
 * Analyzes captured 401/407 authentication challenges returned to SIP
 * REGISTER attempts (WWW-Authenticate / Proxy-Authenticate) to fingerprint
 * the registrar implementation and flag weak digest-authentication
 * configurations. Pure parsing of captured data — no SIP traffic generated.
 */

/**
 * Parse a Digest auth header into a parameter map.
 * @param {string} header e.g. 'Digest realm="x", nonce="y", algorithm=MD5, qop="auth"'
 */
export function parseDigestChallenge(header = '') {
  const params = {};
  const body = header.replace(/^\s*Digest\s+/i, '');
  const re = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]+))/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    params[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  }
  return params;
}

/**
 * Estimate the entropy (bits) of a hex/base64 nonce string.
 * @param {string} nonce
 */
export function estimateNonceEntropy(nonce = '') {
  if (!nonce) return 0;
  const hex = /^[0-9a-fA-F]+$/.test(nonce);
  const b64 = /^[0-9a-zA-Z+/=]+$/.test(nonce);
  const charset = hex ? 16 : b64 ? 64 : 94;
  return Math.round(nonce.length * Math.log2(charset));
}

/**
 * Analyze a captured SIP REGISTER authentication challenge.
 *
 * @param {{ challengeHeader: string, statusCode?: number, headerName?: string, priorNonces?: string[] }} input
 *   challengeHeader — the raw WWW-Authenticate/Proxy-Authenticate value.
 *   priorNonces — nonces seen in earlier challenges (detects nonce reuse).
 */
export function analyzeRegisterChallenge({ challengeHeader = '', statusCode = 401, headerName = 'WWW-Authenticate', priorNonces = [] } = {}) {
  const params = parseDigestChallenge(challengeHeader);
  const findings = [];

  const algorithm = (params.algorithm || 'MD5').toUpperCase();
  const qop = (params.qop || '').toLowerCase();
  const realm = params.realm || '';
  const nonce = params.nonce || '';
  const opaque = params.opaque;
  const stale = /^true$/i.test(params.stale || '');

  if (!/MD5-SESS|SHA-256|SHA-512/.test(algorithm)) {
    findings.push({
      type: 'Weak digest algorithm advertised',
      severity: 'Medium',
      confidence: 'high',
      cwe: 'CWE-327',
      evidence: `Registrar challenges with algorithm=${algorithm}; qop=${qop || 'absent'}.`,
      recommendation: 'Prefer SHA-256 digest with qop=auth; MD5 without qop is vulnerable to offline cracking and replay.',
    });
  } else {
    findings.push({
      type: 'Strong digest algorithm advertised',
      severity: 'Info',
      confidence: 'high',
      evidence: `algorithm=${algorithm}; qop=${qop || 'absent'}.`,
      recommendation: 'No algorithm weakness; continue with credential-strength and lockout-policy checks.',
    });
  }

  if (!qop) {
    findings.push({
      type: 'Missing qop in digest challenge',
      severity: 'Low',
      confidence: 'high',
      cwe: 'CWE-287',
      evidence: 'Challenge carries no qop parameter; responses cannot include cnonce/nc, weakening replay protection.',
      recommendation: 'Enable qop=auth on the registrar.',
    });
  }

  const entropy = estimateNonceEntropy(nonce);
  if (nonce && entropy < 64) {
    findings.push({
      type: 'Low-entropy nonce',
      severity: 'Medium',
      confidence: 'medium',
      cwe: 'CWE-330',
      evidence: `Nonce "${nonce.slice(0, 24)}…" estimated at ~${entropy} bits of entropy.`,
      recommendation: 'Use cryptographically random nonces of at least 128 bits.',
    });
  }

  if (nonce && priorNonces.includes(nonce)) {
    findings.push({
      type: 'Nonce reused across challenges',
      severity: 'Medium',
      confidence: 'high',
      cwe: 'CWE-330',
      evidence: 'Identical nonce observed in a previous challenge — replay window is open.',
      recommendation: 'Generate a fresh nonce per challenge.',
    });
  }

  // Implementation fingerprinting from challenge quirks.
  let implementation = 'Unknown';
  if (opaque && /asterisk/i.test(realm) === false && stale === false && qop.includes('auth')) {
    implementation = 'Asterisk-like (opaque + qop=auth)';
  }
  if (/^["']?[0-9a-f]{8,}$/i.test(nonce) && !opaque && algorithm === 'MD5') {
    implementation = 'Kamailio/OpenSIPS-like (bare MD5 nonce)';
  }

  if (realm) {
    findings.push({
      type: 'Realm disclosed in challenge',
      severity: 'Info',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `realm="${realm}".`,
      recommendation: 'Realms often mirror internal domains; confirm no sensitive naming is exposed.',
    });
  }

  return {
    statusCode,
    headerName,
    algorithm,
    qop: qop || null,
    realm,
    nonceEntropyBits: entropy,
    opaque: Boolean(opaque),
    stale,
    implementation,
    params,
    findings,
  };
}

export const SIP_REGISTER_ANALYZER = { analyzeRegisterChallenge, parseDigestChallenge, estimateNonceEntropy };
export default SIP_REGISTER_ANALYZER;
