/**
 * amqpProber.js — AMQP handshake version-detection analyzer.
 *
 * Analyzes AMQP protocol-header exchanges: the client proposes an AMQP
 * version (protocol header "AMQP\0<major><minor><revision>") and the server
 * either accepts it or answers with its own highest supported header. The
 * offered versions plus any error/tune behavior fingerprint RabbitMQ,
 * Qpid, ActiveMQ, EMQX and Azure Service Bus AMQP gateways.
 *
 * Offline analyzer: callers supply the server-sent protocol header bytes and
 * any immediate connection error text observed on in-scope targets.
 */

/** Well-known AMQP protocol headers sent by brokers on version mismatch. */
export const KNOWN_HEADERS = [
  { broker: 'RabbitMQ', header: [0x41, 0x4d, 0x51, 0x50, 0x00, 0x00, 0x09, 0x01], note: 'RabbitMQ speaks AMQP 0-9-1' },
  { broker: 'RabbitMQ (AMQP 1.0 plugin)', header: [0x41, 0x4d, 0x51, 0x50, 0x00, 0x01, 0x00, 0x00], note: 'AMQP 1.0 plugin enabled' },
  { broker: 'Apache Qpid', header: [0x41, 0x4d, 0x51, 0x50, 0x00, 0x00, 0x09, 0x01], note: 'Qpid also answers 0-9-1' },
  { broker: 'ActiveMQ', header: [0x41, 0x4d, 0x51, 0x50, 0x00, 0x01, 0x00, 0x00], note: 'ActiveMQ prefers AMQP 1.0' },
  { broker: 'EMQX', header: [0x41, 0x4d, 0x51, 0x50, 0x00, 0x01, 0x00, 0x00], note: 'EMQX AMQP gateway (1.0)' },
];

/** SASL mechanism strings that hint at broker family after version agree. */
export const SASL_MECHANISM_HINTS = [
  { regex: /AMQPLAIN/i, hint: 'RabbitMQ-style broker (AMQPLAIN is RabbitMQ-specific)' },
  { regex: /PLAIN/i, hint: 'Generic SASL PLAIN support' },
  { regex: /EXTERNAL/i, hint: 'Certificate-based SASL EXTERNAL' },
];

/**
 * Compare two protocol headers byte-wise.
 * @param {Array<number>} a
 * @param {Array<number>} b
 */
export function headersEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Decode an AMQP protocol header into major/minor/revision.
 * @param {Buffer|Uint8Array|Array<number>} bytes
 */
export function decodeProtocolHeader(bytes) {
  const b = Array.isArray(bytes) ? bytes : Array.from(bytes || []);
  if (b.length < 8 || b[0] !== 0x41 || b[1] !== 0x4d || b[2] !== 0x51 || b[3] !== 0x50) {
    return { valid: false, reason: 'not an AMQP protocol header' };
  }
  return {
    valid: true,
    major: b[5], minor: b[6], revision: b[7],
    version: `${b[5]}-${b[6]}-${b[7]}`,
    magic: String.fromCharCode(...b.slice(0, 4)),
  };
}

/**
 * Fingerprint an AMQP broker from handshake observations.
 *
 * @param {Object} obs - { proposedVersion?: string, serverHeader (bytes),
 *   saslMechanisms?: string[], errorText?: string }
 * @returns {Object} fingerprint result.
 */
export function fingerprintAmqpBroker(obs = {}) {
  const decoded = decodeProtocolHeader(obs.serverHeader);
  const candidates = [];
  const evidence = [];

  if (decoded.valid) {
    evidence.push(`server protocol header offers AMQP ${decoded.version}`);
    for (const kh of KNOWN_HEADERS) {
      const bytes = Array.isArray(obs.serverHeader) ? obs.serverHeader : Array.from(obs.serverHeader || []);
      if (headersEqual(bytes, kh.header)) {
        candidates.push({ broker: kh.broker, note: kh.note, confidence: decoded.version === '0-0-9-1' ? 'medium' : 'high' });
      }
    }
  } else {
    evidence.push(`server header invalid: ${decoded.reason}`);
  }

  const saslHints = [];
  for (const mech of (obs.saslMechanisms || [])) {
    for (const h of SASL_MECHANISM_HINTS) {
      if (h.regex.test(mech)) saslHints.push({ mechanism: mech, hint: h.hint });
    }
  }
  if (saslHints.length) evidence.push(`SASL mechanisms observed: ${saslHints.map(s => s.mechanism).join(', ')}`);

  const err = String(obs.errorText || '');
  if (/PRECONDITION_FAILED|NOT_IMPLEMENTED|ACCESS_REFUSED/i.test(err)) {
    evidence.push(`AMQP error text: ${err.slice(0, 160)}`);
  }

  // 0-9-1 + AMQPLAIN is a strong RabbitMQ indicator.
  const rabbit = candidates.some(c => c.broker === 'RabbitMQ') &&
    (obs.saslMechanisms || []).some(m => /AMQPLAIN/i.test(m));
  if (rabbit) {
    candidates.unshift({ broker: 'RabbitMQ', note: '0-9-1 header plus AMQPLAIN mechanism', confidence: 'high' });
  }

  return {
    proposedVersion: obs.proposedVersion || 'unknown',
    serverVersion: decoded.valid ? decoded.version : null,
    headerValid: decoded.valid,
    saslHints,
    candidates,
    evidence,
    summary: candidates.length
      ? `AMQP handshake indicates: ${candidates.map(c => `${c.broker} (${c.confidence})`).join(', ')}.`
      : 'AMQP handshake did not match a known broker profile.',
    type: 'AMQP Handshake Fingerprint',
    confidence: candidates.some(c => c.confidence === 'high') ? 'high' : candidates.length ? 'medium' : 'low',
  };
}

export const AMQP_PROBER = {
  KNOWN_HEADERS,
  SASL_MECHANISM_HINTS,
  headersEqual,
  decodeProtocolHeader,
  fingerprintAmqpBroker,
};
export default AMQP_PROBER;
