/**
 * bacnetDiscoveryAnalyzer.js — BACnet device discovery analysis (idea 00498).
 *
 * Analyzes BACnet/IP discovery exchanges (UDP :47808):
 *  - Who-Is service requests (unconfirmed, service choice 0x08).
 *  - I-Am responses: device instance, max APDU, segmentation, vendor ID.
 *  - BVLC + NPDU header parsing for captured frames.
 *
 * Offline analyzer: callers supply captured frames (e.g. from Who-Is
 * broadcasts the scanner was authorized to send). No network code.
 * Defensive use: building-automation asset inventory for authorized targets.
 */

/** Known BACnet vendor IDs (subset — most common in the field). */
export const BACNET_VENDORS = {
  0: 'ASHRAE',
  1: 'NIST',
  5: 'Johnson Controls',
  7: 'Siemens',
  8: 'Delta Controls',
  9: 'Trane',
  10: 'Honeywell',
  11: 'Distech Controls',
  15: 'Automated Logic',
  18: 'Alerton',
  24: 'Carrier',
  36: 'KMC Controls',
  40: 'Schneider Electric',
  42: 'Belimo',
};

/**
 * Parse a BVLC + NPDU header from a captured BACnet/IP frame.
 *
 * @param {Buffer|Uint8Array} buf raw frame
 * @returns {object} header fields or `{ valid: false, reason }`
 */
export function parseBacnetHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 6) return { valid: false, reason: 'frame too short for BVLC header' };
  if (b[0] !== 0x81) return { valid: false, reason: 'not a BACnet/IP frame (BVLC type != 0x81)' };
  const bvlcFunction = b[1];
  const npduOffset = 4;
  if (b.length < npduOffset + 2) return { valid: false, reason: 'frame too short for NPDU header' };
  const npci = b[npduOffset];
  return {
    valid: true,
    bvlcFunction,
    bvlcFunctionName:
      bvlcFunction === 0x0a
        ? 'unicast-npdu'
        : bvlcFunction === 0x0b
          ? 'broadcast-npdu'
          : `unknown_0x${bvlcFunction.toString(16)}`,
    npduVersion: npci >> 4,
    apduOffset: npduOffset + 2 + ((npci & 0x20) !== 0 ? 2 : 0) + ((npci & 0x08) !== 0 ? 1 : 0),
  };
}

/**
 * Parse an I-Am APDU (unconfirmed service choice 0x00) from captured bytes.
 *
 * @param {Buffer|Uint8Array} apdu APDU bytes starting at the PDU type octet
 * @returns {object} device details or `{ valid: false, reason }`
 */
export function parseIAm(apdu) {
  const b = Buffer.isBuffer(apdu) ? apdu : Buffer.from(apdu || []);
  if (b.length < 2) return { valid: false, reason: 'APDU too short' };
  if ((b[0] & 0xf0) !== 0x10) return { valid: false, reason: 'not an unconfirmed-request APDU' };
  if (b[1] !== 0x00)
    return { valid: false, reason: `not an I-Am service (choice 0x${b[1].toString(16)})` };
  let off = 2;
  const readObjectId = () => {
    if (off + 4 > b.length) return null;
    const raw = b.readUInt32BE(off);
    off += 4;
    return { objectType: raw >>> 22, instance: raw & 0x3fffff };
  };
  const readUnsigned = () => {
    if (off + 2 > b.length) return null;
    const tag = b[off];
    const len = tag & 0x07;
    off += 1;
    let v = 0;
    for (let i = 0; i < len && off < b.length; i++) {
      v = (v << 8) | b[off];
      off += 1;
    }
    return v;
  };
  // Tag 0xC4 (context 0): device object identifier
  if (b[off] !== 0xc4) return { valid: false, reason: 'I-Am missing device object identifier' };
  off += 1;
  const deviceId = readObjectId();
  if (!deviceId || deviceId.objectType !== 8)
    return { valid: false, reason: 'I-Am device object identifier malformed' };
  if (b[off] !== 0x22) return { valid: false, reason: 'I-Am missing max APDU field' };
  const maxApdu = readUnsigned();
  if (b[off] !== 0x91) return { valid: false, reason: 'I-Am missing segmentation field' };
  off += 1;
  const segmentation = b[off] & 0x0f;
  off += 1;
  if (b[off] !== 0x21) return { valid: false, reason: 'I-Am missing vendor ID field' };
  const vendorId = readUnsigned();
  return {
    valid: true,
    deviceInstance: deviceId.instance,
    maxApdu,
    segmentationSupported: segmentation,
    vendorId,
    vendorName: BACNET_VENDORS[vendorId] || `vendor_${vendorId}`,
  };
}

/**
 * Summarize discovered BACnet devices for an inventory report.
 *
 * @param {Array<object>} devices parsed I-Am results (`parseIAm` outputs)
 * @returns {object} inventory summary
 */
export function summarizeBacnetDevices(devices = []) {
  const list = (Array.isArray(devices) ? devices : []).filter(d => d && d.valid);
  const byVendor = {};
  for (const d of list) byVendor[d.vendorName] = (byVendor[d.vendorName] || 0) + 1;
  return {
    deviceCount: list.length,
    devices: list.map(d => ({
      deviceInstance: d.deviceInstance,
      vendor: d.vendorName,
      maxApdu: d.maxApdu,
    })),
    byVendor,
    recommendations: list.length
      ? [
          'Keep BACnet/IP (:47808/udp) inside the building-automation VLAN; Who-Is broadcasts are unauthenticated.',
          'Inventory devices against vendor advisories for firmware updates.',
        ]
      : [],
  };
}

export const BACNET_DISCOVERY = {
  idea: '00498',
  defaultPort: 47808,
  vendors: BACNET_VENDORS,
  parseHeader: parseBacnetHeader,
  parseIAm,
  summarizeDevices: summarizeBacnetDevices,
};

export default BACNET_DISCOVERY;
