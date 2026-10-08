/**
 * stpBpduAnalyzer.js — STP BPDU field analyzer / switch fingerprinting.
 *
 * Analyses observed Spanning Tree BPDUs (supplied as parsed fields or raw
 * hex) and fingerprints the originating switch: root bridge ID, bridge ID,
 * port identifiers, timers, flags and the vendor derived from the bridge-ID
 * OUI. Useful for topology mapping in authorized assessments.
 *
 * This module only analyses observed BPDUs — it never injects BPDUs.
 */

/** BPDU flag bits. */
const BPDU_FLAGS = {
  0x80: 'Topology Change',
  0x40: 'Topology Change Acknowledgement',
};

/** Bridge-ID OUI (first 3 bytes) → vendor hints. */
const BRIDGE_OUI_VENDORS = [
  { oui: '00:1b:2a', vendor: 'Cisco' },
  { oui: '00:1c:58', vendor: 'Cisco' },
  { oui: '00:23:04', vendor: 'Cisco' },
  { oui: '00:50:56', vendor: 'VMware' },
  { oui: '00:0c:29', vendor: 'VMware' },
  { oui: '00:15:5d', vendor: 'Microsoft Hyper-V' },
  { oui: '52:54:00', vendor: 'QEMU/KVM' },
  { oui: '00:1a:a0', vendor: 'Dell' },
  { oui: 'f8:bc:12', vendor: 'Dell' },
  { oui: '00:25:64', vendor: 'HPE' },
  { oui: '3c:a8:2a', vendor: 'Ubiquiti' },
  { oui: '00:e0:4c', vendor: 'Realtek' },
];

/**
 * Parse a Configuration/RSTP BPDU from hex.
 * @param {string} hex hex of the BPDU (starting at Protocol Identifier)
 * @returns {Object|null} parsed fields
 */
export function parseBpduHex(hex) {
  const buf = Buffer.from(String(hex).replace(/\s+/g, ''), 'hex');
  if (buf.length < 35) return null;
  const bridgeId = off =>
    buf
      .subarray(off, off + 8)
      .toString('hex')
      .replace(/(.{2})/g, '$1:')
      .replace(/:$/, '');
  return {
    protocolId: buf.readUInt16BE(0),
    version: buf[2],
    bpduType: buf[3],
    flags: buf[4],
    rootBridgeId: bridgeId(5),
    rootPathCost: buf.readUInt32BE(13),
    bridgeId: bridgeId(17),
    portId: buf.readUInt16BE(25),
    messageAge: buf.readUInt16BE(27),
    maxAge: buf.readUInt16BE(29),
    helloTime: buf.readUInt16BE(31),
    forwardDelay: buf.readUInt16BE(33),
  };
}

/** Bridge priority is the top 12 bits of the 16-bit priority field inside the bridge ID. */
export function bridgePriority(bridgeIdHex) {
  const bytes = bridgeIdHex.replace(/:/g, '');
  if (bytes.length < 16) return null;
  return parseInt(bytes.slice(0, 4), 16) & 0xf000;
}

function vendorFromBridgeId(bridgeId) {
  const oui = String(bridgeId).slice(0, 8).toLowerCase();
  const hit = BRIDGE_OUI_VENDORS.find(({ oui: o }) => o === oui);
  return hit ? hit.vendor : 'Unknown';
}

/**
 * Analyse an observed BPDU.
 *
 * @param {{ hex?: string, fields?: Object }} input — parsed fields or raw hex
 * @returns {{ analyzed: boolean, type, confidence, evidence, switch? }}
 */
export function analyzeBpdu({ hex = null, fields = null } = {}) {
  const f = fields || (hex ? parseBpduHex(hex) : null);
  if (!f) {
    return {
      analyzed: false,
      type: 'No BPDU Data',
      confidence: 'none',
      evidence: 'No parseable BPDU supplied.',
    };
  }

  const kind =
    f.bpduType === 0x00
      ? 'Configuration BPDU (STP)'
      : f.bpduType === 0x02
        ? 'RSTP BPDU'
        : `BPDU type 0x${Number(f.bpduType).toString(16)}`;
  const isRoot = f.rootBridgeId.toLowerCase() === f.bridgeId.toLowerCase();
  const vendor = vendorFromBridgeId(f.bridgeId);
  const flags = Object.entries(BPDU_FLAGS)
    .filter(([bit]) => f.flags & Number(bit))
    .map(([, name]) => name);
  const prio = bridgePriority(f.bridgeId);

  const notes = [];
  if (flags.includes('Topology Change'))
    notes.push('Topology Change flag set — recent STP topology change observed.');
  if (prio === 0 && !isRoot)
    notes.push('Bridge priority 0 while not root — unusual, verify topology.');
  if (f.messageAge === 0) notes.push('MessageAge 0 — BPDU originates from the root bridge itself.');

  return {
    analyzed: true,
    type: isRoot ? 'STP Root Bridge Identified' : 'STP Switch Fingerprinted',
    confidence: 'high',
    severity: 'Info',
    evidence: `${kind} from bridge ${f.bridgeId} (${vendor})${isRoot ? ' — this device IS the STP root' : `, root is ${f.rootBridgeId}`}, port 0x${Number(f.portId).toString(16)}, timers hello/maxAge/fwdDelay ${f.helloTime}/${f.maxAge}/${f.forwardDelay}.${flags.length ? ` Flags: ${flags.join(', ')}.` : ''}${notes.length ? ` Notes: ${notes.join(' ')}` : ''}`,
    switch: {
      kind,
      bridgeId: f.bridgeId,
      rootBridgeId: f.rootBridgeId,
      isRoot,
      bridgePriority: prio,
      portId: f.portId,
      vendor,
      timers: {
        helloTime: f.helloTime,
        maxAge: f.maxAge,
        forwardDelay: f.forwardDelay,
        messageAge: f.messageAge,
      },
      flags,
      notes,
    },
  };
}

export const STP_BPDU_ANALYZER = { analyzeBpdu, parseBpduHex, bridgePriority };
export default STP_BPDU_ANALYZER;
