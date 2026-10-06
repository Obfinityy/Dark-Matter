/**
 * lldpNeighborMapper.js — LLDP neighbor topology mapper.
 *
 * Builds a neighbor map from observed LLDP frames. Callers supply frames as
 * parsed TLV lists (type/value objects) or raw hex; the module decodes the
 * standard TLVs (Chassis ID, Port ID, TTL, Port Description, System Name,
 * System Description, Capabilities, Management Address) and returns a
 * structured neighbor table plus topology insight.
 *
 * This module only analyses observed frames — it does not transmit LLDPDUs.
 */

/** LLDP TLV type numbers (IEEE 802.1AB). */
const LLDP_TLV = {
  END: 0,
  CHASSIS_ID: 1,
  PORT_ID: 2,
  TTL: 3,
  PORT_DESCRIPTION: 4,
  SYSTEM_NAME: 5,
  SYSTEM_DESCRIPTION: 6,
  SYSTEM_CAPABILITIES: 7,
  MANAGEMENT_ADDRESS: 8,
};

/** System capability bit flags. */
const CAPABILITY_FLAGS = [
  'Other', 'Repeater', 'Bridge', 'WLAN access point', 'Router',
  'Telephone', 'DOCSIS cable device', 'Station only', 'C-VLAN component',
  'S-VLAN component', 'Two-port MAC relay',
];

/**
 * Parse an LLDPDU given as a hex string into a TLV list.
 * @param {string} hex even-length hex string of the LLDP frame
 * @returns {Array<{ type: number, length: number, valueHex: string }>}
 */
export function parseLldpHex(hex) {
  const buf = Buffer.from(String(hex).replace(/\s+/g, ''), 'hex');
  const tlvs = [];
  let i = 0;
  while (i + 2 <= buf.length) {
    const header = buf.readUInt16BE(i);
    const type = header >> 9;
    const length = header & 0x1ff;
    if (type === LLDP_TLV.END) break;
    const valueHex = buf.subarray(i + 2, i + 2 + length).toString('hex');
    tlvs.push({ type, length, valueHex });
    i += 2 + length;
  }
  return tlvs;
}

/** Decode the capability bitmap into names. */
export function decodeCapabilities(bitmap) {
  const names = [];
  for (let bit = 0; bit < CAPABILITY_FLAGS.length; bit += 1) {
    if (bitmap & (1 << bit)) names.push(CAPABILITY_FLAGS[bit]);
  }
  return names;
}

function tlvValue(tlvs, type) {
  const t = tlvs.find((x) => x.type === type);
  return t ? t.valueHex : null;
}

function hexToAscii(hex) {
  return hex ? Buffer.from(hex, 'hex').toString('utf8').replace(/[^\x20-\x7e]/g, '') : '';
}

/**
 * Map one observed LLDP frame to a neighbor record.
 *
 * @param {{ tlvs: Array, hex?: string, interface?: string }} frame
 * @returns {{ neighborFound: boolean, type, confidence, evidence, neighbor? }}
 */
export function mapLldpNeighbor({ tlvs = null, hex = null, interface: iface = 'unknown' } = {}) {
  const list = tlvs && tlvs.length ? tlvs : (hex ? parseLldpHex(hex) : []);
  if (!list.length) {
    return { neighborFound: false, type: 'No LLDP Data', confidence: 'none', evidence: 'No LLDP TLVs supplied.' };
  }

  const chassisHex = tlvValue(list, LLDP_TLV.CHASSIS_ID);
  const portHex = tlvValue(list, LLDP_TLV.PORT_ID);
  const ttlHex = tlvValue(list, LLDP_TLV.TTL);
  const mgmtHex = tlvValue(list, LLDP_TLV.MANAGEMENT_ADDRESS);
  const capHex = tlvValue(list, LLDP_TLV.SYSTEM_CAPABILITIES);

  const chassisId = chassisHex ? Buffer.from(chassisHex.slice(2), 'hex').toString('hex').replace(/(.{2})/g, '$1:').replace(/:$/, '') : '';
  const neighbor = {
    chassisId: chassisId || hexToAscii(chassisHex),
    portId: hexToAscii(portHex),
    ttlSeconds: ttlHex ? parseInt(ttlHex, 16) : null,
    portDescription: hexToAscii(tlvValue(list, LLDP_TLV.PORT_DESCRIPTION)),
    systemName: hexToAscii(tlvValue(list, LLDP_TLV.SYSTEM_NAME)),
    systemDescription: hexToAscii(tlvValue(list, LLDP_TLV.SYSTEM_DESCRIPTION)),
    capabilities: capHex ? decodeCapabilities(parseInt(capHex.slice(0, 4), 16)) : [],
    managementAddress: mgmtHex ? mgmtHex : null,
    observedOn: iface,
  };

  if (!neighbor.chassisId && !neighbor.systemName) {
    return { neighborFound: false, type: 'LLDP Incomplete', confidence: 'low', evidence: 'Frame lacked chassis ID and system name.' };
  }

  const label = neighbor.systemName || neighbor.chassisId;
  return {
    neighborFound: true,
    type: 'LLDP Neighbor Mapped',
    confidence: 'high',
    severity: 'Info',
    evidence: `LLDP neighbor "${label}" via port ${neighbor.portId || '?'} (chassis ${neighbor.chassisId || '?'}), TTL ${neighbor.ttlSeconds ?? '?'}s${neighbor.systemDescription ? ` — ${neighbor.systemDescription.slice(0, 120)}` : ''}.`,
    neighbor,
  };
}

export const LLDP_NEIGHBOR_MAPPER = { mapLldpNeighbor, parseLldpHex, decodeCapabilities, LLDP_TLV };
export default LLDP_NEIGHBOR_MAPPER;
