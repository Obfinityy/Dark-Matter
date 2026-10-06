/**
 * cdpFrameAnalyzer.js — CDP frame analyzer / Cisco fingerprinting.
 *
 * Analyses observed Cisco Discovery Protocol frames (supplied as parsed TLV
 * lists or raw hex) and fingerprints the device: device ID, platform,
 * software version, native VLAN, duplex and capabilities. Reveals Cisco
 * inventory and IOS/NX-OS versions for authorized assessments.
 *
 * This module only analyses observed frames — it does not transmit CDP.
 */

/** CDP TLV type numbers. */
const CDP_TLV = {
  DEVICE_ID: 0x0001,
  ADDRESSES: 0x0002,
  PORT_ID: 0x0003,
  CAPABILITIES: 0x0004,
  VERSION: 0x0005,
  PLATFORM: 0x0006,
  NATIVE_VLAN: 0x000a,
  DUPLEX: 0x000b,
};

/** CDP capability bit flags. */
const CDP_CAPABILITY_FLAGS = [
  'Level 1 router', 'Level 1 source-route bridge', 'Level 2 source-route bridge',
  'Level 2 switch', 'Level 3 router', 'Level 2 transparent bridge', 'Level 2 source-route switch',
  'Host', 'IGMP capable', 'Repeater',
];

/** Rough Cisco platform → product family hints. */
const PLATFORM_FAMILIES = [
  { pattern: /^cisco (catalyst|ws-c)/i, family: 'Cisco Catalyst switch' },
  { pattern: /^cisco nexus/i, family: 'Cisco Nexus switch' },
  { pattern: /^cisco (isr|asr|c8)/i, family: 'Cisco router' },
  { pattern: /^cisco (air-|c91)/i, family: 'Cisco wireless AP' },
  { pattern: /^cisco (asa|ftd|firepower)/i, family: 'Cisco firewall' },
  { pattern: /^cisco (ucs|hyperflex)/i, family: 'Cisco compute' },
];

/**
 * Parse a CDP frame (hex, starting at the TLV section) into a TLV list.
 * @param {string} hex hex string of CDP TLV section
 * @returns {Array<{ type: number, length: number, valueHex: string }>}
 */
export function parseCdpHex(hex) {
  const buf = Buffer.from(String(hex).replace(/\s+/g, ''), 'hex');
  const tlvs = [];
  let i = 0;
  while (i + 4 <= buf.length) {
    const type = buf.readUInt16BE(i);
    const length = buf.readUInt16BE(i + 2);
    if (length < 4 || i + length > buf.length) break;
    tlvs.push({ type, length, valueHex: buf.subarray(i + 4, i + length).toString('hex') });
    i += length;
  }
  return tlvs;
}

function hexAscii(hex) {
  return hex ? Buffer.from(hex, 'hex').toString('utf8').replace(/[^\x20-\x7e]/g, '') : '';
}

/**
 * Analyse an observed CDP frame.
 *
 * @param {{ tlvs: Array, hex?: string, interface?: string }} frame
 * @returns {{ deviceFound: boolean, type, confidence, evidence, device? }}
 */
export function analyzeCdpFrame({ tlvs = null, hex = null, interface: iface = 'unknown' } = {}) {
  const list = tlvs && tlvs.length ? tlvs : (hex ? parseCdpHex(hex) : []);
  if (!list.length) {
    return { deviceFound: false, type: 'No CDP Data', confidence: 'none', evidence: 'No CDP TLVs supplied.' };
  }

  const byType = (t) => list.find((x) => x.type === t);
  const deviceId = hexAscii(byType(CDP_TLV.DEVICE_ID)?.valueHex);
  const platform = hexAscii(byType(CDP_TLV.PLATFORM)?.valueHex);
  const version = hexAscii(byType(CDP_TLV.VERSION)?.valueHex);
  const portId = hexAscii(byType(CDP_TLV.PORT_ID)?.valueHex);
  const nativeVlanHex = byType(CDP_TLV.NATIVE_VLAN)?.valueHex;
  const duplexHex = byType(CDP_TLV.DUPLEX)?.valueHex;
  const capHex = byType(CDP_TLV.CAPABILITIES)?.valueHex;

  const capabilities = capHex
    ? CDP_CAPABILITY_FLAGS.filter((_, bit) => parseInt(capHex, 16) & (1 << bit))
    : [];

  const familyHit = PLATFORM_FAMILIES.find(({ pattern }) => pattern.test(platform));
  const iosMatch = version.match(/(?:Cisco IOS Software|IOS-XE|NX-OS)[^,]{0,60}/i);

  const device = {
    deviceId,
    platform,
    family: familyHit ? familyHit.family : 'Cisco device',
    softwareVersion: version.slice(0, 200),
    iosFingerprint: iosMatch ? iosMatch[0] : '',
    portId,
    nativeVlan: nativeVlanHex ? parseInt(nativeVlanHex, 16) : null,
    duplex: duplexHex ? (parseInt(duplexHex, 16) === 1 ? 'full' : 'half') : null,
    capabilities,
    observedOn: iface,
  };

  if (!deviceId && !platform) {
    return { deviceFound: false, type: 'CDP Incomplete', confidence: 'low', evidence: 'Frame lacked device ID and platform.' };
  }

  return {
    deviceFound: true,
    type: 'Cisco Device Fingerprinted via CDP',
    confidence: 'high',
    severity: 'Info',
    cwe: 'CWE-200',
    evidence: `CDP device "${deviceId || '?'}" identified as ${device.family}${platform ? ` (${platform})` : ''}${device.iosFingerprint ? ` running ${device.iosFingerprint}` : ''}${device.nativeVlan != null ? `, native VLAN ${device.nativeVlan}` : ''}.`,
    device,
  };
}

export const CDP_FRAME_ANALYZER = { analyzeCdpFrame, parseCdpHex, CDP_TLV };
export default CDP_FRAME_ANALYZER;
