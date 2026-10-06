/**
 * starttlsStrippingDetector.js — STARTTLS stripping risk detector (idea 00512).
 *
 * Analyzes how a mail server (SMTP port 587/25, IMAP 143, POP3 110) advertises
 * and handles the STARTTLS upgrade command. Detects servers that advertise
 * STARTTLS but mishandle it — a misconfiguration that lets traffic be forced
 * onto plaintext. Pure analyzer over observed capability data; defensive,
 * authorized bug-bounty framing.
 */

const KNOWN_IMPLICIT_TLS_PORTS = [465, 993, 995];

/**
 * Evaluate STARTTLS handling posture from observed session data.
 * @param {{port: number, protocol?: 'smtp'|'imap'|'pop3', advertised: boolean, upgradeResult?: {code?: number, text?: string, tlsEstablished?: boolean}, acceptsPlaintextAuth?: boolean}} session
 * @returns {{risk: 'low'|'medium'|'high'|'critical', findings: string[], starttlsRequired: boolean, summary: string}}
 */
export function evaluateStarttlsHandling(session = {}) {
  const findings = [];
  let score = 0;
  const advertised = session.advertised === true;
  const result = session.upgradeResult || {};
  const tlsOk = result.tlsEstablished === true;

  if (KNOWN_IMPLICIT_TLS_PORTS.includes(Number(session.port))) {
    findings.push('Port uses implicit TLS; STARTTLS negotiation is not expected here.');
  }

  if (!advertised) {
    findings.push('STARTTLS is not advertised; mail likely traverses in plaintext.');
    score += 40;
  } else if (!tlsOk) {
    findings.push('STARTTLS is advertised but the upgrade fails or falls back to plaintext.');
    score += 80;
  } else {
    findings.push('STARTTLS advertised and upgrade establishes TLS.');
  }

  if (session.acceptsPlaintextAuth === true) {
    findings.push('Server accepts plaintext AUTH; credentials can be captured if TLS is stripped.');
    score += 60;
  } else if (session.acceptsPlaintextAuth === false) {
    findings.push('Server refuses plaintext AUTH; authentication requires TLS.');
  }

  const risk = score >= 120 ? 'critical' : score >= 80 ? 'high' : score >= 40 ? 'medium' : 'low';
  return {
    risk,
    findings,
    starttlsRequired: tlsOk && session.acceptsPlaintextAuth === false,
    summary: risk === 'low'
      ? 'STARTTLS is properly advertised and enforced.'
      : `STARTTLS handling weakness detected (risk: ${risk}). ${findings.join(' ')}`,
  };
}

/**
 * Score a banner/capability transcript for downgrade-attack indicators.
 * @param {{capabilities: string[], rawTranscript?: string}} data
 * @returns {{supportsStarttls: boolean, missingSecureIndicators: string[], score: number}}
 */
export function scoreDowngradeIndicators(data = {}) {
  const caps = (data.capabilities || []).map((c) => String(c).toUpperCase());
  const missing = [];
  if (!caps.some((c) => c.includes('STARTTLS'))) missing.push('STARTTLS');
  if (!caps.some((c) => c.includes('SMTPUTF8'))) missing.push('SMTPUTF8');
  const transcript = String(data.rawTranscript || '');
  let score = 100;
  if (missing.length > 0) score -= 40 * missing.length;
  if (/no starttls/i.test(transcript)) score -= 20;
  return {
    supportsStarttls: !missing.includes('STARTTLS'),
    missingSecureIndicators: missing,
    score: Math.max(0, score),
  };
}

export const STARTTLS_STRIPPING_DETECTOR = {
  evaluateStarttlsHandling,
  scoreDowngradeIndicators,
};

export default STARTTLS_STRIPPING_DETECTOR;
