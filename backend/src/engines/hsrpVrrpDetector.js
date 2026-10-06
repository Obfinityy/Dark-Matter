/**
 * hsrpVrrpDetector.js — HSRP / VRRP first-hop-redundancy state detector.
 *
 * Analyses observed first-hop redundancy protocol packets (supplied as parsed
 * fields, e.g. from a passive capture) and detects HSRP (UDP 1985, multicast
 * 224.0.0.2) and VRRP (IP proto 112, multicast 224.0.0.18) groups: group/VRID,
 * state (master/active/backup/standby), priority and virtual IP. Exposed
 * router identities and preempt-enabled high-priority standbys are worth
 * noting in authorized assessments.
 *
 * This module only analyses observed packets — it never joins groups or
 * transmits hello/advertisement packets.
 */

/** VRRP state codes (RFC 5798). */
const VRRP_STATES = { 0: 'Initialize', 1: 'Backup', 2: 'Master' };
/** HSRP state codes. */
const HSRP_STATES = {
  0: 'Initial', 1: 'Learn', 2: 'Listen', 3: 'Speak', 4: 'Standby', 5: 'Active',
};

/**
 * Detect and classify an observed FHRP packet.
 *
 * @param {{ protocol: 'hsrp'|'vrrp', group?: number, vrid?: number, stateCode?: number, priority?: number, virtualIp?: string, sourceIp?: string, preempt?: boolean, authType?: string }} packet
 * @returns {{ detected: boolean, type, confidence, evidence, group? }}
 */
export function detectFhrpState(packet = {}) {
  const { protocol } = packet;
  if (protocol !== 'hsrp' && protocol !== 'vrrp') {
    return { detected: false, type: 'Unknown Protocol', confidence: 'none', evidence: 'Packet is neither HSRP nor VRRP.' };
  }

  const isHsrp = protocol === 'hsrp';
  const groupId = isHsrp ? (packet.group ?? null) : (packet.vrid ?? null);
  const stateName = isHsrp
    ? (HSRP_STATES[packet.stateCode] ?? 'Unknown')
    : (VRRP_STATES[packet.stateCode] ?? 'Unknown');
  const priority = packet.priority ?? null;

  const label = isHsrp ? `HSRP group ${groupId ?? '?'}` : `VRRP VRID ${groupId ?? '?'}`;
  const findings = [];

  if (priority === 255 && isHsrp) {
    findings.push('HSRP priority 255 — owner-style device, preemption battles unlikely but identity confirmed.');
  }
  if (packet.preempt && priority != null && priority > 100) {
    findings.push('Preempt enabled with high priority — standby can seize master role on link flap.');
  }
  if (packet.authType && !/^(none|md5)$/i.test(packet.authType)) {
    findings.push(`Weak HSRP authentication in use: ${packet.authType}.`);
  }
  if (packet.authType && /^none$/i.test(packet.authType)) {
    findings.push('No HSRP authentication — any local host could inject hellos in an on-path position (monitor-only; no injection performed).');
  }

  return {
    detected: true,
    type: isHsrp ? 'HSRP Group Detected' : 'VRRP Group Detected',
    confidence: groupId != null ? 'high' : 'medium',
    severity: findings.length ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: `${label} observed in state "${stateName}"${priority != null ? `, priority ${priority}` : ''}${packet.virtualIp ? `, virtual IP ${packet.virtualIp}` : ''}${packet.sourceIp ? ` from ${packet.sourceIp}` : ''}.${findings.length ? ` Notes: ${findings.join(' ')}` : ''}`,
    group: {
      protocol,
      groupId,
      state: stateName,
      priority,
      virtualIp: packet.virtualIp || null,
      sourceIp: packet.sourceIp || null,
      preempt: Boolean(packet.preempt),
      authType: packet.authType || null,
      notes: findings,
    },
  };
}

/**
 * Summarize a batch of observed FHRP packets into a group table.
 * @param {Array} packets parsed packet objects
 */
export function summarizeFhrpGroups(packets = []) {
  const groups = new Map();
  for (const p of packets) {
    const key = `${p.protocol}:${p.protocol === 'hsrp' ? p.group : p.vrid}`;
    if (!groups.has(key)) groups.set(key, { packets: 0, masters: new Set(), virtualIps: new Set() });
    const g = groups.get(key);
    g.packets += 1;
    const stateName = p.protocol === 'hsrp' ? HSRP_STATES[p.stateCode] : VRRP_STATES[p.stateCode];
    if (stateName === 'Master' || stateName === 'Active') g.masters.add(p.sourceIp || '?');
    if (p.virtualIp) g.virtualIps.add(p.virtualIp);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    packets: g.packets,
    masterIps: [...g.masters],
    virtualIps: [...g.virtualIps],
    dualMaster: g.masters.size > 1,
    evidence: g.masters.size > 1
      ? `SPLIT-BRAIN: ${key} shows multiple masters: ${[...g.masters].join(', ')} — possible misconfiguration or rogue device.`
      : `${key}: ${g.packets} packets, master ${[...g.masters].join(', ') || 'unknown'}.`,
  }));
}

export const HSRP_VRRP_DETECTOR = { detectFhrpState, summarizeFhrpGroups, VRRP_STATES, HSRP_STATES };
export default HSRP_VRRP_DETECTOR;
