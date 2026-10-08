/**
 * iec104EndpointAnalyzer.js — IEC-60870-5-104 endpoint probing analysis (idea 00500).
 *
 * Analyzes IEC-60870-5-104 exchanges (TCP :2404) — READ-ONLY:
 *  - APCI frame parsing: I-format, S-format, U-format (STARTDT/STOPDT/TESTFR).
 *  - ASDU decoding: TypeID, VSQ, Cause of Transmission (COT), common address.
 *  - Identification of interrogation (GI) responses and spontaneous data.
 *
 * Offline analyzer: callers supply captured bytes from read-only exchanges.
 * No network code; no command (C_SC/C_DC/C_SE) construction anywhere in this
 * module. Defensive use: substation/utility asset inventory for authorized
 * industrial targets.
 */

/** Common IEC-104 ASDU TypeIDs. */
export const IEC104_TYPE_IDS = {
  1: 'M_SP_NA_1 (single-point information)',
  3: 'M_DP_NA_1 (double-point information)',
  5: 'M_ST_NA_1 (step position information)',
  7: 'M_BO_NA_1 (bitstring of 32 bit)',
  9: 'M_ME_NA_1 (measured value, normalized)',
  11: 'M_ME_NB_1 (measured value, scaled)',
  13: 'M_ME_NC_1 (measured value, short float)',
  15: 'M_IT_NA_1 (integrated totals)',
  30: 'M_SP_TB_1 (single-point with CP56Time2a)',
  36: 'M_ME_TF_1 (measured value float with CP56Time2a)',
  70: 'M_EI_NA_1 (end of initialization)',
  100: 'C_IC_NA_1 (interrogation command)',
  101: 'C_CI_NA_1 (counter interrogation command)',
  102: 'C_RD_NA_1 (read command)',
  103: 'C_CS_NA_1 (clock synchronization command)',
  104: 'C_TS_NA_1 (test command)',
  105: 'C_RP_NA_1 (reset process command)',
};

/** IEC-104 Cause of Transmission values. */
export const IEC104_COT = {
  1: 'periodic_cyclic',
  2: 'background_scan',
  3: 'spontaneous',
  4: 'initialized',
  5: 'request',
  6: 'activation',
  7: 'activation_confirmation',
  8: 'deactivation',
  9: 'deactivation_confirmation',
  10: 'activation_termination',
  11: 'return_information_remote',
  12: 'return_information_local',
  20: 'interrogated_by_station',
  44: 'unknown_type_identification',
  45: 'unknown_cause_of_transmission',
  46: 'unknown_common_address',
  47: 'unknown_information_object_address',
};

/**
 * Parse an IEC-104 APCI frame from captured bytes.
 *
 * @param {Buffer|Uint8Array} buf raw frame (starts with 0x68)
 * @returns {object} parsed APCI or `{ valid: false, reason }`
 */
export function parseIec104Apci(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 6) return { valid: false, reason: 'frame too short for APCI (6 bytes)' };
  if (b[0] !== 0x68) return { valid: false, reason: 'missing APCI start byte 0x68' };
  const apduLen = b[1];
  const c1 = b[2];
  if ((c1 & 0x01) === 0) {
    return {
      valid: true,
      format: 'I',
      apduLen,
      sendSeq: ((b[3] << 8) | c1) >> 1,
      recvSeq: ((b[5] << 8) | b[4]) >> 1,
      asduOffset: 6,
    };
  }
  if ((c1 & 0x03) === 0x01) {
    return { valid: true, format: 'S', apduLen, recvSeq: ((b[5] << 8) | b[4]) >> 1, asduOffset: 6 };
  }
  if ((c1 & 0x03) === 0x03) {
    const uFn = c1 & 0xfc;
    const names = {
      0x04: 'TESTFR_act',
      0x08: 'TESTFR_con',
      0x10: 'STOPDT_act',
      0x20: 'STOPDT_con',
      0x40: 'STARTDT_act',
      0x80: 'STARTDT_con',
    };
    return {
      valid: true,
      format: 'U',
      apduLen,
      uFunction: names[uFn] || `unknown_0x${uFn.toString(16)}`,
      asduOffset: 6,
    };
  }
  return { valid: false, reason: 'unrecognized APCI control field' };
}

/**
 * Parse an IEC-104 ASDU header from captured bytes.
 *
 * @param {Buffer|Uint8Array} asdu ASDU bytes (after the APCI)
 * @returns {object} parsed ASDU header or `{ valid: false, reason }`
 */
export function parseIec104Asdu(asdu) {
  const b = Buffer.isBuffer(asdu) ? asdu : Buffer.from(asdu || []);
  if (b.length < 6) return { valid: false, reason: 'ASDU too short for header (6 bytes)' };
  const typeId = b[0];
  const vsq = b[1];
  const cot = b[2] & 0x3f;
  const cotNegative = (b[2] & 0x40) !== 0;
  const commonAddress = b.readUInt16LE(4);
  return {
    valid: true,
    typeId,
    typeName: IEC104_TYPE_IDS[typeId] || `unknown_type_${typeId}`,
    objectCount: vsq & 0x7f,
    sequential: (vsq & 0x80) !== 0,
    cot,
    cotName: IEC104_COT[cot] || `unknown_cot_${cot}`,
    cotNegative,
    commonAddress,
  };
}

/**
 * Assess exposure of an IEC-104 endpoint from read-only evidence.
 *
 * @param {{apciOk?: boolean, asdu?: object, portOpen?: boolean}} evidence
 * @returns {object} risk assessment
 */
export function assessIec104Exposure(evidence = {}) {
  const findings = [];
  if (evidence.portOpen) {
    findings.push({
      level: 'high',
      text: 'IEC-60870-5-104 (:2404) reachable — no authentication in the base protocol; commands are accepted from any peer.',
    });
  }
  const asdu = evidence.asdu;
  if (asdu && asdu.valid) {
    findings.push({
      level: 'medium',
      text: `ASDU observed: ${asdu.typeName}, COT=${asdu.cotName}, common address ${asdu.commonAddress} — useful for asset inventory.`,
    });
  }
  const score = findings.some(f => f.level === 'high') ? 9 : findings.length ? 3 : 0;
  return {
    detected: findings.length > 0,
    score,
    findings,
    recommendations: findings.length
      ? [
          'IEC-104 must not be reachable beyond the OT network — firewall, VPN or IEC 62351 TLS.',
          'Prefer IEC 62351-secured links where the vendor supports them.',
          'This engine performs read-only analysis; it never constructs command ASDUs.',
        ]
      : [],
  };
}

export const IEC104_ENDPOINT = {
  idea: '00500',
  defaultPort: 2404,
  typeIds: IEC104_TYPE_IDS,
  cot: IEC104_COT,
  parseApci: parseIec104Apci,
  parseAsdu: parseIec104Asdu,
  assessExposure: assessIec104Exposure,
};

export default IEC104_ENDPOINT;
