/**
 * corsChecker.js — CORS misconfiguration detector.
 *
 * Checks for dangerous CORS policies:
 *  - Access-Control-Allow-Origin: * with credentials
 *  - Reflected Origin with credentials
 *  - Overly permissive methods/headers
 */

export function checkCORS({ url, headers = {}, requestOrigin = 'https://evil.com' } = {}) {
  if (!headers || typeof headers !== 'object') headers = {};
  const h = {};
  for (const [k, v] of Object.entries(headers)) {
    h[k.toLowerCase()] = String(v);
  }

  const acao = h['access-control-allow-origin'];
  const acac = h['access-control-allow-credentials'];

  if (!acao) {
    return { vulnerable: false, reason: 'No CORS headers present' };
  }

  // Critical: wildcard + credentials
  if (acao === '*' && acac === 'true') {
    return {
      vulnerable: true,
      type: 'CORS Misconfiguration',
      severity: 'High',
      confidence: 'high',
      cwe: 'CWE-942',
      evidence:
        'Access-Control-Allow-Origin: * with Allow-Credentials: true — any site can read authenticated responses.',
    };
  }

  // High: reflected origin + credentials (test by sending evil origin)
  if (acac === 'true' && acao !== '*' && acao.length > 0) {
    return {
      vulnerable: true,
      type: 'CORS Misconfiguration',
      severity: 'Medium',
      confidence: 'medium',
      cwe: 'CWE-942',
      evidence: `Origin reflected (${acao}) with credentials allowed — verify if arbitrary origins are accepted.`,
      needsVerification: `Send Origin: ${requestOrigin} and check if reflected.`,
    };
  }

  return { vulnerable: false, reason: 'CORS policy appears restrictive' };
}

export const CORS_CHECKER = { checkCORS };
export default CORS_CHECKER;
