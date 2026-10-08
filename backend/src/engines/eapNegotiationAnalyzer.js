/**
 * eapNegotiationAnalyzer.js — EAP method-negotiation analysis (idea 00550).
 *
 * Analyzes EAP (RFC 3748) negotiation exchanges, typically inside EAPOL
 * (802.1X) or RADIUS (EAP-Message attributes), to fingerprint RADIUS
 * servers and audit authentication posture:
 *  - EAP method type progression: Identity (1) → method proposals
 *    (EAP-Request type lists) → NAK (type 3) fallback.
 *  - Server-supported method set reconstructed from offered NAK
 *    negotiations and which methods the server accepts vs rejects.
 *  - Downgrade signals: server accepts EAP-MD5 (4) or LEAP (17), or the
 *    client/server settles below the strongest mutually supported method.
 *
 * Offline analyzer: callers supply parsed EAP packet summaries from
 * captures the scanner was authorized to collect. No network code.
 * Defensive use: enterprise Wi-Fi / 802.1X authentication audit for
 * authorized targets — weak EAP methods are a credential-theft surface.
 */

/** Assigned EAP types (IANA). */
export const EAP_TYPES = {
  1: 'Identity',
  2: 'Notification',
  3: 'NAK',
  4: 'MD5-Challenge',
  5: 'OTP',
  6: 'Generic Token Card',
  13: 'EAP-TLS',
  17: 'LEAP',
  18: 'EAP-SIM',
  21: 'EAP-TTLS',
  23: 'EAP-AKA',
  25: 'PEAP',
  29: 'EAP-MSCHAPv2',
  43: 'EAP-FAST',
  50: 'EAP-PWD',
  52: 'EAP-EKE',
  55: 'TEAP',
};

/** EAP methods considered weak for enterprise authentication. */
export const WEAK_EAP_METHODS = new Map([
  [4, 'MD5-Challenge — challenge-response is offline-crackable'],
  [5, 'OTP — one-time-password without channel binding'],
  [17, 'LEAP — proprietary, offline dictionary attacks (asleap)'],
]);

/** Methods that provide mutual auth + channel binding (strong). */
export const STRONG_EAP_METHODS = new Set([13, 21, 25, 43, 50, 55]);

/**
 * Parse a single EAP packet header.
 *
 * @param {Buffer|Uint8Array} buf raw EAP packet
 * @returns {object} { code, identifier, type?, typeName?, valid } — code: 1=Request 2=Response 3=Success 4=Failure
 */
export function parseEapHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 4) return { valid: false, reason: 'packet shorter than EAP header' };
  const code = b[0];
  const identifier = b[1];
  const length = b.readUInt16BE(2);
  const names = { 1: 'Request', 2: 'Response', 3: 'Success', 4: 'Failure' };
  let type = null;
  if ((code === 1 || code === 2) && b.length >= 5) type = b[4];
  return {
    valid: true,
    code,
    codeName: names[code] || `unknown_${code}`,
    identifier,
    length,
    type,
    typeName: type != null ? EAP_TYPES[type] || `type_${type}` : null,
  };
}

/**
 * Analyze an EAP negotiation transcript.
 *
 * @param {object[]} packets parsed EAP packets: [{ code, type?, direction?: 'server'|'client' }]
 * @returns {object[]} findings — method fingerprint + downgrade audit
 */
export function analyzeEapNegotiation(packets = []) {
  const findings = [];
  const offeredByServer = []; // ordered list of server-proposed types
  let settledType = null;
  let outcome = null;

  for (const p of packets) {
    if (p.code === 3) {
      outcome = 'success';
      break;
    }
    if (p.code === 4) {
      outcome = 'failure';
      break;
    }
    if (p.code === 1 && p.type != null && p.direction !== 'client') {
      offeredByServer.push(p.type);
      if (p.type !== 1 && p.type !== 3) settledType = p.type; // last non-identity non-NAK proposal
    }
  }

  const offeredNames = [...new Set(offeredByServer)].map(t => EAP_TYPES[t] || `type_${t}`);

  if (offeredNames.length) {
    findings.push({
      type: 'EAP Method Fingerprint',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `RADIUS/server side offered EAP methods in order: ${offeredNames.join(' → ')}${settledType != null ? `; negotiation settled on ${EAP_TYPES[settledType] || `type_${settledType}`}` : ''}${outcome ? `; outcome: ${outcome}` : ''}`,
      extra: { offeredTypes: [...new Set(offeredByServer)], settledType, outcome },
    });
  }

  // Weak-method findings.
  for (const t of new Set(offeredByServer)) {
    if (WEAK_EAP_METHODS.has(t)) {
      findings.push({
        type: 'Weak EAP Method Accepted',
        confidence: 'high',
        cwe: 'CWE-327',
        evidence: `server offers/accepts ${EAP_TYPES[t]} (type ${t}) — ${WEAK_EAP_METHODS.get(t)}. Disable it; require EAP-TLS or a tunneled method (PEAP/TTLS/EAP-FAST/TEAP).`,
        extra: { eapType: t },
      });
    }
  }

  // Downgrade signal: NAK dance settled below a strong method the server also offered.
  const nakSeen = offeredByServer.includes(3);
  const strongOffered = offeredByServer.filter(t => STRONG_EAP_METHODS.has(t));
  if (
    nakSeen &&
    settledType != null &&
    strongOffered.length &&
    !STRONG_EAP_METHODS.has(settledType)
  ) {
    findings.push({
      type: 'EAP Method Downgrade',
      confidence: 'medium',
      cwe: 'CWE-757',
      evidence: `after NAK negotiation the session settled on ${EAP_TYPES[settledType] || `type_${settledType}`} even though the server also offers strong methods (${strongOffered.map(t => EAP_TYPES[t]).join(', ')}) — verify the server enforces the strongest mutually supported method`,
    });
  }

  if (!findings.length) {
    findings.push({
      type: 'No EAP Negotiation Observed',
      confidence: 'low',
      cwe: null,
      evidence:
        'transcript contained no EAP Request/Response method exchange — check capture completeness',
    });
  }
  return findings;
}

export const EAP_NEGOTIATION_ANALYZER = {
  parseEapHeader,
  analyzeEapNegotiation,
  EAP_TYPES,
  WEAK_EAP_METHODS,
  STRONG_EAP_METHODS,
};
export default EAP_NEGOTIATION_ANALYZER;
