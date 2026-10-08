/**
 * modbusTcpProber.js — Modbus TCP device identification analysis (idea 00497).
 *
 * Analyzes Modbus TCP responses (default :502) — READ-ONLY operations only:
 *  - Read Device Identification (function 0x2B / MEI 0x0E) object parsing.
 *  - Exception response decoding (function code | 0x80).
 *  - MBAP header validation for captured frames.
 *
 * Offline analyzer: callers supply captured response bytes from read-only
 * identification exchanges. No network code and no write/coil/register
 * mutation logic — identification data only. Defensive use: asset inventory
 * and exposure reporting for authorized industrial targets.
 */

/** Standard Modbus Device Identification object IDs. */
export const MODBUS_ID_OBJECTS = {
  0x00: 'vendorName',
  0x01: 'productCode',
  0x02: 'majorMinorRevision',
  0x03: 'vendorUrl',
  0x04: 'productName',
  0x05: 'modelName',
  0x06: 'userApplicationName',
};

/** Modbus exception codes. */
export const MODBUS_EXCEPTIONS = {
  0x01: 'illegal_function',
  0x02: 'illegal_data_address',
  0x03: 'illegal_data_value',
  0x04: 'server_device_failure',
  0x05: 'acknowledge',
  0x06: 'server_device_busy',
  0x07: 'negative_acknowledge',
  0x08: 'memory_parity_error',
  0x0a: 'gateway_path_unavailable',
  0x0b: 'gateway_target_no_response',
};

/**
 * Parse an MBAP header + PDU from captured bytes.
 *
 * @param {Buffer|Uint8Array} buf raw Modbus TCP frame
 * @returns {object} parsed header fields or `{ valid: false, reason }`
 */
export function parseMbap(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 7) return { valid: false, reason: 'frame shorter than MBAP header (7 bytes)' };
  return {
    valid: true,
    transactionId: b.readUInt16BE(0),
    protocolId: b.readUInt16BE(2),
    length: b.readUInt16BE(4),
    unitId: b[6],
    pdu: b.subarray(7),
    protocolOk: b.readUInt16BE(2) === 0,
  };
}

/**
 * Parse a Read Device Identification response PDU (0x2B/0x0E).
 *
 * @param {Buffer|Uint8Array} pdu PDU bytes starting at the function code
 * @returns {object} decoded identification objects or `{ valid: false, reason }`
 */
export function parseDeviceIdentification(pdu) {
  const b = Buffer.isBuffer(pdu) ? pdu : Buffer.from(pdu || []);
  if (b.length < 6)
    return { valid: false, reason: 'PDU too short for device identification response' };
  if (b[0] === (0x2b | 0x80)) {
    const code = b[1];
    return {
      valid: true,
      exception: true,
      exceptionCode: code,
      exceptionName: MODBUS_EXCEPTIONS[code] || `unknown_0x${code.toString(16)}`,
    };
  }
  if (b[0] !== 0x2b || b[1] !== 0x0e) {
    return {
      valid: false,
      reason: 'not a Read Device Identification response (expected 0x2B/0x0E)',
    };
  }
  const objects = {};
  const count = b[5];
  let off = 6;
  for (let i = 0; i < count && off + 2 <= b.length; i++) {
    const id = b[off];
    const len = b[off + 1];
    const value = b.toString('ascii', off + 2, off + 2 + len);
    objects[MODBUS_ID_OBJECTS[id] || `object_0x${id.toString(16).padStart(2, '0')}`] = value;
    off += 2 + len;
  }
  return {
    valid: true,
    exception: false,
    conformityLevel: b[2],
    moreFollows: b[3] !== 0,
    nextObjectId: b[4],
    objects,
  };
}

/**
 * Assess exposure of a Modbus TCP endpoint from identification evidence.
 * Read-only findings only — no control-plane assessment.
 *
 * @param {{identification?: object, portOpen?: boolean}} evidence
 * @returns {object} risk assessment
 */
export function assessModbusExposure(evidence = {}) {
  const findings = [];
  if (evidence.portOpen) {
    findings.push({
      level: 'high',
      text: 'Modbus TCP (:502) reachable — unauthenticated protocol; any reachable function is exposed.',
    });
  }
  const id = evidence.identification;
  if (id && id.valid && !id.exception) {
    findings.push({
      level: 'medium',
      text: `Device identifies as ${id.objects.vendorName || 'unknown vendor'} / ${id.objects.productName || id.objects.modelName || 'unknown product'} — useful for asset inventory and patch mapping.`,
      identification: id.objects,
    });
  }
  const score = findings.some(f => f.level === 'high') ? 8 : findings.length ? 3 : 0;
  return {
    detected: findings.length > 0,
    score,
    findings,
    recommendations: findings.length
      ? [
          'Modbus TCP must not be exposed beyond the OT network — place behind a firewall / data diode.',
          'Map the identified device to vendor security advisories; apply firmware updates.',
          'Monitor for unexpected function codes; this engine only uses read-only identification.',
        ]
      : [],
  };
}

export const MODBUS_TCP = {
  idea: '00497',
  defaultPort: 502,
  idObjects: MODBUS_ID_OBJECTS,
  exceptions: MODBUS_EXCEPTIONS,
  parseMbap,
  parseDeviceIdentification,
  assessExposure: assessModbusExposure,
};

export default MODBUS_TCP;
