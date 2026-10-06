/**
 * ethernetIpIdentityParser.js — EtherNet/IP CIP List Identity reply parser.
 *
 * Parses a captured CIP List Identity reply (encapsulation command 0x63,
 * service "ListIdentity") and describes the responding device. Encapsulation
 * header is 24 bytes; the List Identity reply body is:
 *   item count (2 LE), then per item:
 *     type id (2 LE) | length (2 LE) | payload
 *   The identity payload (type 0x000C):
 *     encapsulation protocol version (2) | socket address (16) | vendor id (2)
 *     | device type (2) | product code (2) | revision major (1) | minor (1)
 *     | status (2) | serial number (4) | product name length (1) | name (n)
 *   Socket address: sin_family (2 BE) | port (2 BE) | address (4 BE) | zero (8).
 *
 * Pure parsing — no EtherNet/IP traffic is generated here; input is captured data.
 */

const LIST_IDENTITY_COMMAND = 0x63;
const IDENTITY_ITEM_TYPE = 0x000c;

/** Vendor ID → vendor name (CIP vendor list subset). */
const VENDOR_IDS = {
  1: 'Rockwell Automation / Allen-Bradley',
  3: 'CISCO Systems',
  7: 'WAGO Kontakttechnik',
  27: 'ODVA',
  31: 'Phoenix Contact',
  43: 'SEW-EURODRIVE',
  44: 'Hilscher',
  48: 'Omron',
  57: 'KUKA Roboter',
  62: 'Beckhoff Automation',
  68: 'KEB',
  78: 'ABB',
  79: 'Fanuc',
  81: 'KROHNE',
  83: 'Schneider Electric',
  86: 'Endress+Hauser',
  95: 'SICK',
  103: 'HMS Networks',
  133: 'Siemens',
  154: 'Turck',
  156: 'Festo',
  176: 'Pilz',
  191: 'Banner Engineering',
  218: 'Mitsubishi Electric',
  220: 'Yaskawa Electric',
  243: 'Pepperl+Fuchs',
  268: 'Hirschmann',
  305: 'Keyence',
  314: 'Balluff',
  335: 'Prosoft Technology',
  438: 'Panasonic',
  576: 'ifm electronic',
  592: 'Lenze',
  624: 'Weidmueller',
  647: 'Moeller (Eaton)',
  726: 'Danfoss',
  832: 'Pepperl+Fuchs Comtrol',
  1153: 'B&R Industrial Automation',
  1341: 'Bosch Rexroth',
};

/** CIP device type → description (subset of ODVA device type codes). */
const DEVICE_TYPES = {
  0x00: 'Generic device (vendor-specific)',
  0x02: 'AC drive',
  0x03: 'Motor overload',
  0x04: 'Limit switch',
  0x05: 'Inductive proximity switch',
  0x06: 'Photoelectric sensor',
  0x07: 'General purpose discrete I/O',
  0x09: 'Resolver',
  0x0c: 'Communications adapter',
  0x0e: 'Programmable logic controller',
  0x12: 'Position controller',
  0x13: 'DC drive',
  0x14: 'Contactor',
  0x15: 'Motor starter',
  0x16: 'Soft start',
  0x1d: 'Pneumatic valve(s)',
  0x1e: 'Vacuum pressure gauge',
  0x1f: 'Partial pressure gauge',
  0x21: 'Human-machine interface',
  0x22: 'Weight scale',
  0x23: 'Step/direction position controller',
  0x24: 'DC power generator',
  0x25: 'Welding power supply',
  0x26: 'Text display',
  0x28: 'Residual gas analyzer',
  0x29: 'DC voltage source',
  0x2a: 'DC current source',
  0x2b: 'Frequency input device',
  0x2c: 'Induction heating power supply',
  0x2d: 'CIP motion drive',
  0x2e: 'Safety discrete I/O device',
  0x2f: 'Fluid flow controller',
  0x30: 'CIP motion I/O',
  0x31: 'CIP motion safety drive',
  0x34: 'Motor overload in CIP safety system',
  0x3b: 'CIP safety validator',
  0x3c: 'CIP safety validator client',
};

/** Normalize captured input to a Buffer. */
function toBuffer(hexOrBuffer) {
  if (Buffer.isBuffer(hexOrBuffer)) return hexOrBuffer;
  const s = String(hexOrBuffer || '').replace(/[^0-9a-fA-F]/g, '');
  return Buffer.from(s, 'hex');
}

function ipv4FromBe(buf, offset) {
  return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

/**
 * Parse a captured CIP List Identity reply.
 *
 * @param {string|Buffer} hexOrBuffer captured reply bytes (may include the
 *   24-byte encapsulation header; the parser detects and skips it)
 * @returns {{ command: number, items: object[] }} parsed identity items
 */
export function parseListIdentityReply(hexOrBuffer) {
  const buf = toBuffer(hexOrBuffer);
  const result = { command: 0, items: [] };
  let offset = 0;
  // Detect encapsulation header: command 0x63 at bytes 0-1, header is 24 bytes.
  if (buf.length >= 24 && buf.readUInt16LE(0) === LIST_IDENTITY_COMMAND) {
    result.command = LIST_IDENTITY_COMMAND;
    offset = 24;
  }
  if (offset + 2 > buf.length) return result;
  const itemCount = buf.readUInt16LE(offset);
  offset += 2;
  for (let i = 0; i < itemCount; i += 1) {
    if (offset + 4 > buf.length) break;
    const typeId = buf.readUInt16LE(offset);
    const length = buf.readUInt16LE(offset + 2);
    offset += 4;
    const payload = buf.slice(offset, offset + length);
    offset += length;
    if (typeId !== IDENTITY_ITEM_TYPE || payload.length < 37) {
      result.items.push({ typeId, length, note: 'non-identity or truncated item' });
      continue;
    }
    const protocolVersion = payload.readUInt16LE(0);
    const sinFamily = payload.readUInt16BE(2);
    const port = payload.readUInt16BE(4);
    const ip = ipv4FromBe(payload, 6);
    const vendorId = payload.readUInt16LE(18);
    const deviceType = payload.readUInt16LE(20);
    const productCode = payload.readUInt16LE(22);
    const revisionMajor = payload[24];
    const revisionMinor = payload[25];
    const status = payload.readUInt16LE(26);
    const serialNumber = payload.readUInt32LE(28);
    const nameLength = payload[32];
    const productName = payload.slice(33, 33 + nameLength).toString('latin1');
    result.items.push({
      typeId, length, protocolVersion, sinFamily, port, ip,
      vendorId, deviceType, productCode,
      revision: `${revisionMajor}.${revisionMinor}`,
      status, serialNumber, productName,
    });
  }
  return result;
}

/**
 * Describe a parsed identity item with vendor/device lookups.
 *
 * @param {object} parsed one identity item from parseListIdentityReply
 * @returns {{ vendor, deviceTypeDescription, productCode, revision, status,
 *   serialNumber, productName, ip, port, confidence, notes }}
 */
export function describeDevice(parsed = {}) {
  const vendor = VENDOR_IDS[parsed.vendorId] || `Unknown (vendor ID ${parsed.vendorId ?? 'n/a'})`;
  const deviceTypeDescription =
    DEVICE_TYPES[parsed.deviceType] ||
    (parsed.deviceType === undefined ? 'unknown' : `Vendor-specific (0x${Number(parsed.deviceType).toString(16).padStart(4, '0')})`);
  const notes = [];
  if (parsed.status !== undefined) {
    if (parsed.status & 0x0001) notes.push('Owned (a connection exists to the device).');
    if (parsed.status & 0x0004) notes.push('Configured.');
    if (parsed.status & 0x0010) notes.push('Minor recoverable fault present.');
    if (parsed.status & 0x0020) notes.push('Minor unrecoverable fault present.');
    if (parsed.status & 0x0040) notes.push('Major recoverable fault present.');
    if (parsed.status & 0x0080) notes.push('Major unrecoverable fault present.');
  }
  const confidence = parsed.vendorId !== undefined && parsed.productCode !== undefined ? 'high' : 'low';
  return {
    vendor,
    deviceTypeDescription,
    productCode: parsed.productCode ?? 'unknown',
    revision: parsed.revision ?? 'unknown',
    status: parsed.status ?? 'unknown',
    serialNumber:
      parsed.serialNumber === undefined ? 'unknown' : `0x${parsed.serialNumber.toString(16).padStart(8, '0')}`,
    productName: parsed.productName || 'unknown',
    ip: parsed.ip || 'unknown',
    port: parsed.port ?? 'unknown',
    confidence,
    notes,
  };
}

export const ETHERNET_IP_IDENTITY_PARSER = {
  parseListIdentityReply,
  describeDevice,
  VENDOR_IDS,
  DEVICE_TYPES,
  LIST_IDENTITY_COMMAND,
};

export default ETHERNET_IP_IDENTITY_PARSER;
