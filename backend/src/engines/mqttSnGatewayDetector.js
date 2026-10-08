/**
 * mqttSnGatewayDetector.js — MQTT-SN gateway detection (idea 00543).
 *
 * Analyzes MQTT-SN (OASIS MQTT-SN v1.2/v2.0) discovery exchanges:
 *  - SEARCHGW multicasts: gateways answer with GWINFO (gateway id, address).
 *  - GWINFO messages: gateway identifier, announcement interval hints.
 *  - ADVERTISE messages: which gateways broadcast, how often.
 *
 * Offline analyzer: callers supply parsed MQTT-SN message summaries or raw
 * bytes from captures the scanner was authorized to collect. No network code.
 * Defensive use: IoT broker/gateway inventory for authorized targets — an
 * exposed MQTT-SN gateway is a direct entry point to publish/subscribe
 * traffic; gateways without authentication are a bug-bounty finding.
 */

/** MQTT-SN message types (v1.2 §5.4 / v2.0 equivalent). */
export const MQTTSN_MESSAGE_TYPES = {
  0x00: 'ADVERTISE',
  0x01: 'SEARCHGW',
  0x02: 'GWINFO',
  0x04: 'CONNECT',
  0x05: 'CONNACK',
  0x06: 'WILLTOPICREQ',
  0x07: 'WILLTOPIC',
  0x08: 'WILLMSGREQ',
  0x09: 'WILLMSG',
  0x0c: 'REGISTER',
  0x0d: 'REGACK',
  0x0e: 'PUBLISH',
  0x0f: 'PUBACK',
  0x10: 'PUBCOMP',
  0x11: 'PUBREC',
  0x12: 'PUBREL',
  0x13: 'DISCONNECT',
  0x14: 'SUBSCRIBE',
  0x15: 'SUBACK',
  0x16: 'UNSUBSCRIBE',
  0x17: 'UNSUBACK',
  0x18: 'PINGREQ',
  0x19: 'PINGRESP',
};

/**
 * Parse an MQTT-SN message header from raw bytes.
 *
 * @param {Buffer|Uint8Array} buf raw datagram
 * @returns {object} { length, msgType, msgName } or `{ valid: false, reason }`
 */
export function parseMqttSnHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 2) return { valid: false, reason: 'datagram too short for MQTT-SN header' };
  let length = b[0];
  let typeOffset = 1;
  if (length === 0x01) {
    // extended length encoding
    if (b.length < 4) return { valid: false, reason: 'truncated extended-length header' };
    length = b.readUInt16BE(1);
    typeOffset = 3;
  }
  const msgType = b[typeOffset];
  const msgName = MQTTSN_MESSAGE_TYPES[msgType];
  if (!msgName)
    return { valid: false, reason: `unknown MQTT-SN message type 0x${msgType.toString(16)}` };
  return { valid: true, length, msgType, msgName };
}

/**
 * Parse a GWINFO message body (gateway id + address fields).
 *
 * @param {Buffer|Uint8Array} body bytes after the message-type octet
 * @returns {object} { gatewayId, addressHex } or `{ valid: false, reason }`
 */
export function parseGwInfo(body) {
  const b = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (b.length < 2) return { valid: false, reason: 'GWINFO body too short' };
  const gatewayId = b[0];
  const addressHex = b.slice(1).toString('hex');
  return { valid: true, gatewayId, addressHex };
}

/**
 * Detect MQTT-SN gateways from a SEARCHGW/GWINFO/ADVERTISE exchange log.
 *
 * @param {object[]} events [{ msgType or msgName, gatewayId?, fromAddress?, payload? }]
 * @returns {object[]} findings — discovered gateways + exposure flags
 */
export function detectGateways(events = []) {
  const gateways = new Map();
  let searchGwSeen = false;

  for (const ev of events) {
    const type = ev.msgName || MQTTSN_MESSAGE_TYPES[ev.msgType];
    if (!type) continue;
    if (type === 'SEARCHGW') {
      searchGwSeen = true;
      continue;
    }
    if (type === 'GWINFO' || type === 'ADVERTISE') {
      const id = ev.gatewayId;
      const key = `${id ?? 'unknown'}@${ev.fromAddress || 'unknown'}`;
      if (!gateways.has(key)) {
        gateways.set(key, {
          gatewayId: id ?? null,
          fromAddress: ev.fromAddress || null,
          firstSeenVia: type,
          announcements: 0,
        });
      }
      gateways.get(key).announcements += 1;
    }
  }

  const findings = [];
  if (!gateways.size) {
    if (searchGwSeen) {
      findings.push({
        type: 'No MQTT-SN Gateway Response',
        confidence: 'medium',
        cwe: null,
        evidence:
          'SEARCHGW was answered by no GWINFO — no MQTT-SN gateway reachable from the observation point',
      });
    }
    return findings;
  }

  for (const gw of gateways.values()) {
    findings.push({
      type: 'MQTT-SN Gateway Detected',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `MQTT-SN gateway id ${gw.gatewayId ?? '?'} discovered via ${gw.firstSeenVia} from ${gw.fromAddress ?? 'unknown address'} (${gw.announcements} announcement(s)). Verify the gateway requires client authentication — open MQTT-SN gateways let anyone publish/subscribe.`,
      extra: { gatewayId: gw.gatewayId, address: gw.fromAddress, announcements: gw.announcements },
    });
  }
  return findings;
}

export const MQTTSN_GATEWAY_DETECTOR = {
  parseMqttSnHeader,
  parseGwInfo,
  detectGateways,
  MQTTSN_MESSAGE_TYPES,
};
export default MQTTSN_GATEWAY_DETECTOR;
