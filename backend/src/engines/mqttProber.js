/**
 * mqttProber.js — MQTT CONNECT handshake probing analyzer.
 *
 * Analyzes MQTT broker responses (CONNACK packets) to MQTT CONNECT attempts
 * made with varied client IDs, protocol levels and flags. Differences in
 * CONNACK return codes and session-present flags across probes fingerprint
 * brokers (Mosquitto, EMQX, HiveMQ, VerneMQ, AWS IoT, Azure IoT Hub).
 *
 * Offline analyzer: callers supply raw CONNACK buffers captured from probes.
 * No network code is included; probing itself is the scanner's job.
 */

export const CONNACK_RETURN_CODES = {
  0x00: 'connection_accepted',
  0x01: 'unacceptable_protocol_version',
  0x02: 'identifier_rejected',
  0x03: 'server_unavailable',
  0x04: 'bad_username_or_password',
  0x05: 'not_authorized',
};

/** Known broker fingerprint quirks keyed on probe-response patterns. */
export const BROKER_QUIRKS = [
  {
    broker: 'Eclipse Mosquitto',
    clue: 'returns 0x02 (identifier_rejected) for >23-char client IDs',
    match: r => r.identifierRejectedOnLongId === true,
    confidence: 'high',
  },
  {
    broker: 'EMQX',
    clue: 'accepts 0-length client IDs and issues server-generated IDs',
    match: r => r.acceptedEmptyClientId === true,
    confidence: 'medium',
  },
  {
    broker: 'HiveMQ',
    clue: 'returns not_authorized (0x05) instead of bad_credentials (0x04)',
    match: r => r.unauthorizedInsteadOfBadCreds === true,
    confidence: 'medium',
  },
  {
    broker: 'VerneMQ',
    clue: 'accepts protocol level 3 only with specific reason codes',
    match: r => r.protocolLevel3Only === true,
    confidence: 'low',
  },
  {
    broker: 'AWS IoT Core',
    clue: 'rejects unauthenticated CONNECT with immediate TCP close (no CONNACK)',
    match: r => r.tcpCloseWithoutConnack === true,
    confidence: 'medium',
  },
];

/**
 * Parse a raw MQTT CONNACK packet buffer.
 *
 * @param {Buffer|Uint8Array} buf - Raw CONNACK bytes.
 * @returns {Object} parsed fields.
 */
export function parseConnack(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 4) return { valid: false, reason: 'CONNACK too short' };
  if ((b[0] & 0xf0) !== 0x20)
    return { valid: false, reason: 'not a CONNACK packet (fixed header mismatch)' };
  return {
    valid: true,
    sessionPresent: (b[2] & 0x01) === 0x01,
    returnCode: b[3],
    returnCodeName: CONNACK_RETURN_CODES[b[3]] ?? `unknown_0x${b[3].toString(16).padStart(2, '0')}`,
    remainingLength: b[1],
  };
}

/**
 * Fingerprint a broker from a set of labeled probe responses.
 *
 * @param {Array<Object>} probes - Each { label, connack (Buffer|Uint8Array|null), tcpClosed?: boolean }.
 *   Suggested labels: 'normal', 'long-client-id', 'empty-client-id',
 *   'bad-credentials', 'protocol-level-3'.
 * @returns {Object} fingerprint result.
 */
export function fingerprintMqttBroker(probes = []) {
  const parsed = {};
  for (const p of probes) {
    if (!p || !p.label) continue;
    parsed[p.label] = p.connack
      ? { ...parseConnack(p.connack), tcpClosed: !!p.tcpClosed }
      : { valid: false, tcpClosed: !!p.tcpClosed, reason: 'no CONNACK received' };
  }

  const longId = parsed['long-client-id'];
  const emptyId = parsed['empty-client-id'];
  const badCreds = parsed['bad-credentials'];
  const lvl3 = parsed['protocol-level-3'];

  const features = {
    identifierRejectedOnLongId: !!(longId && longId.valid && longId.returnCode === 0x02),
    acceptedEmptyClientId: !!(emptyId && emptyId.valid && emptyId.returnCode === 0x00),
    unauthorizedInsteadOfBadCreds: !!(badCreds && badCreds.valid && badCreds.returnCode === 0x05),
    protocolLevel3Only: !!(lvl3 && lvl3.valid && lvl3.returnCode === 0x00),
    tcpCloseWithoutConnack: Object.values(parsed).some(p => p.tcpClosed && !p.valid),
  };

  const matches = [];
  for (const q of BROKER_QUIRKS) {
    let ok = false;
    try {
      ok = q.match(features);
    } catch {
      ok = false;
    }
    if (ok) matches.push({ broker: q.broker, clue: q.clue, confidence: q.confidence });
  }

  const accepted = Object.entries(parsed)
    .filter(([, v]) => v.valid && v.returnCode === 0x00)
    .map(([k]) => k);
  const rejected = Object.entries(parsed)
    .filter(([, v]) => v.valid && v.returnCode !== 0x00)
    .map(([k, v]) => ({ label: k, code: v.returnCodeName }));

  return {
    features,
    acceptedProbes: accepted,
    rejectedProbes: rejected,
    candidates: matches,
    openBroker: accepted.includes('normal'),
    requiresAuth: !!(badCreds && badCreds.valid && [0x04, 0x05].includes(badCreds.returnCode)),
    summary: matches.length
      ? `Behavioral fingerprint suggests: ${matches.map(m => `${m.broker} (${m.confidence})`).join(', ')}.`
      : 'No distinctive broker behavior identified.',
    type: 'MQTT Broker Fingerprint',
    confidence: matches.some(m => m.confidence === 'high')
      ? 'high'
      : matches.length
        ? 'medium'
        : 'low',
  };
}

export const MQTT_PROBER = {
  CONNACK_RETURN_CODES,
  BROKER_QUIRKS,
  parseConnack,
  fingerprintMqttBroker,
};
export default MQTT_PROBER;
