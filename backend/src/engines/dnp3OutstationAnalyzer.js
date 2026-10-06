/**
 * dnp3OutstationAnalyzer.js — DNP3 outstation probing analysis (idea 00499).
 *
 * Analyzes DNP3 outstation responses (TCP :20000 / serial) — READ-ONLY:
 *  - Data link layer frame parsing (start bytes, addresses, CRC awareness).
 *  - Transport + application layer header decoding (FIR/FIN/SEQ, function codes).
 *  - Device Attributes (Group 0) object parsing for device identification.
 *
 * Offline analyzer: callers supply captured response bytes from read-only
 * exchanges. No network code; no control/select-operate logic anywhere in
 * this module. Defensive use: substation asset inventory for authorized
 * industrial targets.
 */

/** DNP3 application-layer function codes relevant to read-only analysis. */
export const DNP3_FUNCTIONS = {
  0x00: 'confirm',
  0x01: 'read',
  0x81: 'response',
  0x82: 'unsolicited_response',
  0x83: 'unsolicited_confirm',
  0x14: 'enable_unsolicited',
  0x15: 'disable_unsolicited',
};

/** Group 0 device-attribute variation numbers of interest. */
export const DNP3_DEVICE_ATTRS = {
  232: 'device_manufacturer_software_version',
  233: 'device_manufacturer_hardware_version',
  234: 'user_assigned_owner_name',
  235: 'user_assigned_location_name',
  236: 'user_assigned_id',
  237: 'user_assigned_description',
  238: 'device_manufacturer_name',
  239: 'device_model_name',
  240: 'user_assigned_device_name',
  241: 'device_serial_number',
  242: 'device_subset_and_conformance',
  243: 'device_manufacturer_hardware_version_2',
  244: 'user_assigned_owner_name_2',
  245: 'device_hardware_version_string',
  246: 'device_software_version_string',
  247: 'device_model_name_string',
  248: 'user_assigned_device_name_string',
  255: 'list_of_common_attributes',
};

/**
 * Parse a DNP3 data-link-layer frame header from captured bytes.
 *
 * @param {Buffer|Uint8Array} buf raw frame (at least 10 bytes)
 * @returns {object} link header or `{ valid: false, reason }`
 */
export function parseDnp3LinkHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 10) return { valid: false, reason: 'frame too short for DNP3 link header (10 bytes)' };
  if (b[0] !== 0x05 || b[1] !== 0x64) return { valid: false, reason: 'missing DNP3 start bytes 0x05 0x64' };
  const length = b[2];
  const control = b[3];
  return {
    valid: true,
    length,
    control,
    direction: (control & 0x80) !== 0 ? 'master_to_outstation' : 'outstation_to_master',
    primary: (control & 0x40) !== 0,
    frameCountBit: (control & 0x20) !== 0,
    functionCode: control & 0x0f,
    destination: b.readUInt16LE(4),
    source: b.readUInt16LE(6),
    payloadOffset: 10,
  };
}

/**
 * Parse a DNP3 application-layer response header.
 *
 * @param {Buffer|Uint8Array} apdu application-layer bytes
 * @returns {object} app header or `{ valid: false, reason }`
 */
export function parseDnp3AppHeader(apdu) {
  const b = Buffer.isBuffer(apdu) ? apdu : Buffer.from(apdu || []);
  if (b.length < 2) return { valid: false, reason: 'APDU too short' };
  const ac = b[0];
  const fn = b[1];
  return {
    valid: true,
    applicationControl: ac,
    fir: (ac & 0x80) !== 0,
    fin: (ac & 0x40) !== 0,
    sequence: ac & 0x3f,
    functionCode: fn,
    functionName: DNP3_FUNCTIONS[fn] || `unknown_0x${fn.toString(16).padStart(2, '0')}`,
    isResponse: fn === 0x81 || fn === 0x82,
    objectHeaderOffset: fn === 0x81 || fn === 0x82 ? 4 : 2,
  };
}

/**
 * Parse Group 0 device-attribute objects from a response object header region.
 * Expects a simplified decoded list of `{ variation, value }` entries — the
 * caller decodes the (group, variation, qualifier, range) framing first.
 *
 * @param {Array<{variation: number, value: string}>} attributes decoded attributes
 * @returns {object} labeled device attributes
 */
export function parseDeviceAttributes(attributes = []) {
  const labeled = {};
  for (const attr of (Array.isArray(attributes) ? attributes : [])) {
    const name = DNP3_DEVICE_ATTRS[attr.variation] || `variation_${attr.variation}`;
    labeled[name] = String(attr.value ?? '');
  }
  return {
    valid: Object.keys(labeled).length > 0,
    attributes: labeled,
    manufacturer: labeled.device_manufacturer_name || null,
    model: labeled.device_model_name || labeled.device_model_name_string || null,
    serialNumber: labeled.device_serial_number || null,
  };
}

/**
 * Assess exposure of a DNP3 outstation from read-only evidence.
 *
 * @param {{linkOk?: boolean, deviceAttributes?: object, portOpen?: boolean}} evidence
 * @returns {object} risk assessment
 */
export function assessDnp3Exposure(evidence = {}) {
  const findings = [];
  if (evidence.portOpen) {
    findings.push({ level: 'high', text: 'DNP3 (:20000) reachable — the protocol has no built-in authentication without Secure Authentication (SAv5/SAv6).' });
  }
  const da = evidence.deviceAttributes;
  if (da && da.valid) {
    findings.push({
      level: 'medium',
      text: `Outstation identifies as ${da.manufacturer || 'unknown vendor'}${da.model ? ` / ${da.model}` : ''} — use for asset inventory and advisory mapping.`,
    });
  }
  const score = findings.some((f) => f.level === 'high') ? 8 : findings.length ? 3 : 0;
  return {
    detected: findings.length > 0,
    score,
    findings,
    recommendations: findings.length
      ? [
          'DNP3 must not be reachable beyond the OT network — firewall and segment substation links.',
          'Deploy DNP3 Secure Authentication (SAv5/SAv6) for any routable DNP3.',
          'Map identified devices to vendor advisories; this engine performs read-only identification only.',
        ]
      : [],
  };
}

export const DNP3_OUTSTATION = {
  idea: '00499',
  defaultPort: 20000,
  functions: DNP3_FUNCTIONS,
  deviceAttrs: DNP3_DEVICE_ATTRS,
  parseLinkHeader: parseDnp3LinkHeader,
  parseAppHeader: parseDnp3AppHeader,
  parseDeviceAttributes,
  assessExposure: assessDnp3Exposure,
};

export default DNP3_OUTSTATION;
