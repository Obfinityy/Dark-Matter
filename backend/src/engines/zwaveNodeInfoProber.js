/**
 * zwaveNodeInfoProber.js — Z-Wave node-info probing (idea 00546).
 *
 * Analyzes Z-Wave protocol frames (ITU-T G.9959) observed on a network:
 *  - Node Information Frames (NIF): node ID, device class, command-class list.
 *  - Command classes reveal capabilities (e.g. 0x25 Binary Switch,
 *    0x62 Door Lock, 0x71 Alarm) — fingerprinting + attack-surface mapping.
 *  - Security flags: Security 2 (S2) vs legacy S0 vs no security on NIF.
 *
 * Offline analyzer: callers supply parsed frames from captures the scanner
 * was authorized to collect. No radio code.
 * Defensive use: Z-Wave home/building network inventory for authorized
 * targets — nodes with no security or with S0 downgrades are the
 * bug-bounty surface.
 */

/** Widely seen Z-Wave command classes (Z-Wave Alliance subset). */
export const ZWAVE_COMMAND_CLASSES = {
  0x20: 'Basic',
  0x25: 'Binary Switch',
  0x26: 'Multilevel Switch',
  0x27: 'All Switch',
  0x2b: 'Scene Activation',
  0x2c: 'Scene Actuator Conf',
  0x31: 'Multilevel Sensor',
  0x32: 'Meter',
  0x60: 'Multi Channel',
  0x62: 'Door Lock',
  0x63: 'User Code',
  0x70: 'Configuration',
  0x71: 'Alarm / Notification',
  0x72: 'Manufacturer Specific',
  0x73: 'Powerlevel',
  0x75: 'Protection',
  0x77: 'Node Naming',
  0x80: 'Battery',
  0x84: 'Wake Up',
  0x85: 'Association',
  0x86: 'Version',
  0x87: 'Indicator',
  0x8e: 'Multi Channel Association',
  0x8f: 'Multi Cmd',
  0x94: 'Simple AV Control',
  0x98: 'Security (S0)',
  0x9b: 'Security 2 (S2)',
  0x9c: 'Sensor Binary',
  0x9e: 'Sensor Multilevel',
  0xa1: 'Application Capability',
};

/** Device classes that are high-value targets if weakly secured. */
export const HIGH_VALUE_CLASSES = new Set([0x62, 0x63, 0x94]);

/**
 * Parse a Node Information Frame (command 0x01 — ApplicationNodeInformation
 * / Z-Wave NIF layout) from a parsed frame record.
 *
 * @param {object} frame { nodeId, cmdClass, payload: (Buffer|Uint8Array) }
 *   payload: [genericDeviceClass][specificDeviceClass][cmdClass...]
 * @returns {object} node info or `{ valid: false, reason }`
 */
export function parseNodeInfoFrame(frame = {}) {
  if (!frame || frame.cmdClass !== 0x01)
    return { valid: false, reason: 'not a node-information frame (cmdClass != 0x01)' };
  const b = Buffer.isBuffer(frame.payload) ? frame.payload : Buffer.from(frame.payload || []);
  if (b.length < 2)
    return { valid: false, reason: 'NIF payload too short for device-class fields' };
  const commandClasses = [...b.slice(2)].map(cc => ({
    id: cc,
    name: ZWAVE_COMMAND_CLASSES[cc] || `unknown_0x${cc.toString(16)}`,
    highValue: HIGH_VALUE_CLASSES.has(cc),
  }));
  const s2 = commandClasses.some(c => c.id === 0x9b);
  const s0 = commandClasses.some(c => c.id === 0x98);
  return {
    valid: true,
    nodeId: frame.nodeId,
    genericDeviceClass: b[0],
    specificDeviceClass: b[1],
    commandClasses,
    security: s2 ? 'S2' : s0 ? 'S0' : 'none',
  };
}

/**
 * Probe-analysis over a set of parsed node-information frames.
 *
 * @param {object[]} frames parsed frames ({ nodeId, cmdClass, payload })
 * @returns {object[]} findings — inventory + security posture per node
 */
export function analyzeNodeInfoFrames(frames = []) {
  const findings = [];
  for (const f of frames) {
    const node = parseNodeInfoFrame(f);
    if (!node.valid) continue;
    const names = node.commandClasses.map(c => c.name).join(', ');
    findings.push({
      type: 'Z-Wave Node Enumerated',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `node ${node.nodeId} advertises device class 0x${node.genericDeviceClass.toString(16)}/0x${node.specificDeviceClass.toString(16)} with command classes: ${names}; security: ${node.security}`,
      extra: {
        nodeId: node.nodeId,
        security: node.security,
        commandClasses: node.commandClasses.map(c => c.id),
      },
    });
    const highValue = node.commandClasses.filter(c => c.highValue);
    if (highValue.length && node.security === 'none') {
      findings.push({
        type: 'High-Value Z-Wave Node Without Security',
        confidence: 'high',
        cwe: 'CWE-319',
        evidence: `node ${node.nodeId} exposes ${highValue.map(c => c.name).join(', ')} with NO security command class — control traffic is unauthenticated/cleartext on this node`,
        extra: { nodeId: node.nodeId, classes: highValue.map(c => c.name) },
      });
    } else if (highValue.length && node.security === 'S0') {
      findings.push({
        type: 'High-Value Z-Wave Node Using Legacy S0',
        confidence: 'medium',
        cwe: 'CWE-327',
        evidence: `node ${node.nodeId} protects ${highValue.map(c => c.name).join(', ')} with legacy S0 only (network key shared across all S0 nodes) — recommend upgrading to S2`,
      });
    }
  }
  if (!findings.length) {
    findings.push({
      type: 'No Z-Wave Node Info Observed',
      confidence: 'low',
      cwe: null,
      evidence:
        'no valid node-information frames in the provided set — network quiet or frames not captured',
    });
  }
  return findings;
}

export const ZWAVE_NODE_INFO_PROBER = {
  parseNodeInfoFrame,
  analyzeNodeInfoFrames,
  ZWAVE_COMMAND_CLASSES,
};
export default ZWAVE_NODE_INFO_PROBER;
