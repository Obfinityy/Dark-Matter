/**
 * profinetDcpParser.js — Profinet DCP Identify Response parser.
 *
 * Parses a captured Profinet DCP (Discovery and Configuration Protocol)
 * Identify Response frame sent to the DCP Identify multicast address.
 * Frame layout after the 14-byte Ethernet header:
 *   frame ID (2 BE, 0xFEFF for Identify Response) | service id (1, 0x05)
 *   | service type (1, 0x01 response) | xid (4) | response delay (2)
 *   | DCP data length (2) | block* — each block:
 *     option (1) | suboption (1) | block length (2) | block info (2) | data (n)
 *
 * Known blocks:
 *   option 1 — IP parameters (suboption 1 IP, 2 subnet, 3 gateway)
 *   option 2 — Device properties (suboption 1 manufacturer, 2 NameOfStation,
 *              3 DeviceID, 4 DeviceRole, 5 DeviceOptions, 6 alias)
 *   option 3 — DHCP (suboption 1 DHCP / 0x43)
 *   option 5 — Control (suboption 4 signal, 1 start, 2 stop)
 *   option 6 — Device initiative (suboption 1 device initiative)
 *
 * Pure parsing — no DCP traffic is generated here; input is captured data.
 */

const DCP_MULTICAST_MAC = '01:0e:cf:00:00:00';
const IDENTIFY_RESPONSE_FRAME_ID = 0xfeff;

/** DCP block option/suboption → name. */
const BLOCK_NAMES = {
  '1/1': 'IP address',
  '1/2': 'Subnet mask',
  '1/3': 'Default gateway',
  '2/1': 'Manufacturer specific',
  '2/2': 'NameOfStation',
  '2/3': 'DeviceID (vendor/device)',
  '2/4': 'DeviceRole',
  '2/5': 'DeviceOptions',
  '2/6': 'Alias name',
  '3/1': 'DHCP',
  '5/1': 'Control: start',
  '5/2': 'Control: stop',
  '5/4': 'Control: signal',
  '6/1': 'Device initiative',
};

/** Known Profinet vendor IDs (DeviceID high word). */
const PROFINET_VENDORS = {
  0x002a: 'Siemens',
  0x0080: 'Beckhoff',
  0x00a0: 'Phoenix Contact',
  0x00b0: 'Hilscher',
  0x00c0: 'Pilz',
  0x00d0: 'WAGO',
  0x0100: 'B&R',
  0x0110: 'Festo',
  0x0120: 'Pepperl+Fuchs',
  0x0130: 'Balluff',
  0x0140: 'Turck',
  0x0150: 'ifm electronic',
  0x0160: 'SICK',
  0x0170: 'Endress+Hauser',
  0x0180: 'KUKA',
  0x0190: 'SEW-EURODRIVE',
  0x01a0: 'ABB',
  0x01b0: 'Schneider Electric',
  0x01c0: 'Rockwell Automation',
  0x01d0: 'Omron',
  0x01e0: 'Mitsubishi Electric',
};

/** Normalize captured input to a Buffer. */
function toBuffer(hexOrBuffer) {
  if (Buffer.isBuffer(hexOrBuffer)) return hexOrBuffer;
  const s = String(hexOrBuffer || '').replace(/[^0-9a-fA-F]/g, '');
  return Buffer.from(s, 'hex');
}

function macToString(buf) {
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join(':');
}

function ipv4From(buf) {
  return `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`;
}

function decodeAscii(buf) {
  const t = buf
    .toString('latin1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  return t.length > 0 ? t : 'unknown';
}

/**
 * Parse a captured DCP Identify Response frame.
 *
 * @param {string|Buffer} hexOrBuffer captured Ethernet frame (hex or Buffer)
 * @returns {{ srcMac, dstMac, frameId, serviceId, serviceType, xid,
 *   blocks: object[], blockData: object }}
 */
export function parseDcpIdentifyResponse(hexOrBuffer) {
  const buf = toBuffer(hexOrBuffer);
  const parsed = {
    srcMac: 'unknown',
    dstMac: 'unknown',
    frameId: 0,
    serviceId: 0,
    serviceType: 0,
    xid: 0,
    blocks: [],
    blockData: {},
  };
  if (buf.length < 24) return parsed;
  parsed.dstMac = macToString(buf.slice(0, 6));
  parsed.srcMac = macToString(buf.slice(6, 12));
  parsed.frameId = buf.readUInt16BE(14);
  parsed.serviceId = buf[16];
  parsed.serviceType = buf[17];
  parsed.xid = buf.readUInt32BE(18);
  const dcpDataLength = buf.readUInt16BE(22);
  let offset = 24;
  const end = Math.min(offset + dcpDataLength, buf.length);
  while (offset + 6 <= end) {
    const option = buf[offset];
    const suboption = buf[offset + 1];
    const blockLength = buf.readUInt16BE(offset + 2);
    const blockInfo = buf.readUInt16BE(offset + 4);
    const data = buf.slice(offset + 6, Math.min(offset + 6 + blockLength, end));
    const key = `${option}/${suboption}`;
    const block = {
      option,
      suboption,
      blockLength,
      blockInfo,
      name: BLOCK_NAMES[key] || `Option ${option} / Suboption ${suboption}`,
      dataHex: data.toString('hex'),
    };
    parsed.blocks.push(block);
    // Keep first occurrence per semantic key for summary lookups.
    if (key === '1/1' && data.length >= 4) parsed.blockData.ip = ipv4From(data);
    else if (key === '1/2' && data.length >= 4) parsed.blockData.subnet = ipv4From(data);
    else if (key === '1/3' && data.length >= 4) parsed.blockData.gateway = ipv4From(data);
    else if (key === '2/2') parsed.blockData.stationName = decodeAscii(data);
    else if (key === '2/3' && data.length >= 4) {
      parsed.blockData.vendorId = data.readUInt16BE(0);
      parsed.blockData.deviceId = data.readUInt16BE(2);
    } else if (key === '2/4' && data.length >= 1) {
      const role = data[0];
      parsed.blockData.deviceRoleRaw = role;
      const roles = [];
      if (role & 0x01) roles.push('PNIO supervisor');
      if (role & 0x02) roles.push('PNIO device');
      parsed.blockData.deviceRole = roles.join(' + ') || 'unknown';
    } else if (key === '2/5') {
      // DeviceOptions: sequence of option/suboption pairs the device supports.
      const options = [];
      for (let i = 0; i + 1 < data.length; i += 2) options.push(`${data[i]}/${data[i + 1]}`);
      parsed.blockData.deviceOptions = options;
    } else if (key === '2/6') {
      parsed.blockData.aliasName = decodeAscii(data);
    } else if (key === '6/1' && data.length >= 2) {
      parsed.blockData.deviceInitiative = data.readUInt16BE(0) === 1;
    }
    // Block padding: odd-length blocks are padded to even boundary.
    offset += 6 + blockLength + (blockLength % 2);
  }
  return parsed;
}

/**
 * Summarize the identified DCP device.
 *
 * @param {object} parsed result of parseDcpIdentifyResponse
 * @returns {{ stationName, ip, mac, vendor, deviceId, deviceRole,
 *   mrpCapable, subnet, gateway, confidence }}
 */
export function summarizeDcpDevice(parsed = {}) {
  const bd = parsed.blockData || {};
  const vendor =
    bd.vendorId !== undefined
      ? PROFINET_VENDORS[bd.vendorId] ||
        `Unknown (vendor ID 0x${bd.vendorId.toString(16).padStart(4, '0')})`
      : 'unknown';
  const options = bd.deviceOptions || [];
  // MRP (Media Redundancy Protocol) shows up as device option 3/0x40-class;
  // presence of any option 4 suboption is a practical MRP-capability hint.
  const mrpCapable = options.some(o => o.split('/')[0] === '4');
  const confidence =
    bd.stationName && bd.stationName !== 'unknown' && bd.ip
      ? 'high'
      : bd.stationName || bd.ip
        ? 'medium'
        : 'low';
  return {
    stationName: bd.stationName || 'unknown',
    ip: bd.ip || 'unknown',
    mac: parsed.srcMac || 'unknown',
    vendor,
    deviceId:
      bd.deviceId === undefined ? 'unknown' : `0x${bd.deviceId.toString(16).padStart(4, '0')}`,
    deviceRole: bd.deviceRole || 'unknown',
    mrpCapable,
    subnet: bd.subnet || 'unknown',
    gateway: bd.gateway || 'unknown',
    confidence,
  };
}

export const PROFINET_DCP_PARSER = {
  parseDcpIdentifyResponse,
  summarizeDcpDevice,
  BLOCK_NAMES,
  PROFINET_VENDORS,
  DCP_MULTICAST_MAC,
  IDENTIFY_RESPONSE_FRAME_ID,
};

export default PROFINET_DCP_PARSER;
