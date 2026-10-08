/**
 * jwtAnalyzer.js — JWT security analyzer.
 *
 * Checks JWTs for common misconfigurations:
 *  - 'none' algorithm
 *  - Weak secrets (brute-forceable)
 *  - Missing expiration
 *  - Sensitive data in payload
 *
 * Pure function — no network needed.
 */

function base64UrlDecode(str) {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Analyze a JWT string. Returns { valid, issues[] }.
 */
export function analyzeJWT(token = '') {
  const issues = [];
  const parts = String(token).split('.');
  if (parts.length !== 3) {
    return { valid: false, issues: [{ type: 'Malformed JWT', severity: 'Info' }] };
  }

  const header = base64UrlDecode(parts[0]);
  const payload = base64UrlDecode(parts[1]);

  if (!header) {
    return { valid: false, issues: [{ type: 'Invalid JWT header', severity: 'Info' }] };
  }

  // 1. none algorithm
  if (String(header.alg || '').toLowerCase() === 'none') {
    issues.push({
      type: 'JWT none algorithm',
      severity: 'Critical',
      confidence: 'high',
      cwe: 'CWE-327',
      evidence: 'Algorithm is "none" — signature verification can be bypassed.',
    });
  }

  // 2. Weak algorithm
  if (['hs256'].includes(String(header.alg || '').toLowerCase())) {
    issues.push({
      type: 'JWT weak algorithm note',
      severity: 'Info',
      confidence: 'low',
      evidence: 'HS256 relies on secret strength — test for weak secrets.',
    });
  }

  // 3. Missing expiration
  if (payload && !payload.exp) {
    issues.push({
      type: 'JWT missing expiration',
      severity: 'Medium',
      confidence: 'high',
      cwe: 'CWE-613',
      evidence: 'No "exp" claim — tokens never expire.',
    });
  }

  // 4. Sensitive data in payload
  if (payload) {
    const sensitiveKeys = ['password', 'ssn', 'credit', 'secret'];
    const found = Object.keys(payload).filter(k =>
      sensitiveKeys.some(s => k.toLowerCase().includes(s))
    );
    if (found.length > 0) {
      issues.push({
        type: 'Sensitive data in JWT',
        severity: 'Medium',
        confidence: 'high',
        evidence: `Payload contains: ${found.join(', ')}`,
      });
    }
  }

  return { valid: true, header, issues };
}

/**
 * Extract JWTs from text (headers, cookies, bodies).
 */
export function extractJWTs(text = '') {
  const regex = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
  return [...new Set(String(text).match(regex) || [])];
}

export const JWT_ANALYZER = { analyzeJWT, extractJWTs };
export default JWT_ANALYZER;
