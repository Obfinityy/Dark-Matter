/**
 * garpProbeDetector.js — Gratuitous ARP pattern detector.
 *
 * Detects gratuitous ARP announcements (sender IP == target IP) in observed
 * ARP traffic and flags IP-conflict patterns, MAC flapping, and unsolicited
 * announcements that widen the spoofing surface. Read-only analysis only —
 * this module NEVER sends ARP packets or performs spoofing of any kind.
 */

/**
 * A single observed ARP packet.
 * @typedef {{ senderIp: string, senderMac: string, targetIp: string, targetMac: string, opcode: 1|2, timestamp?: number }} ArpPacket
 */

/** True if the packet is a gratuitous ARP (sender claims its own IP). */
export function isGratuitousArp(pkt) {
  return pkt && pkt.senderIp === pkt.targetIp && (pkt.opcode === 1 || pkt.opcode === 2);
}

/** True if the packet is an ARP probe (sender IP 0.0.0.0) — related but distinct. */
export function isArpProbe(pkt) {
  return pkt && pkt.senderIp === '0.0.0.0' && pkt.opcode === 1;
}

/**
 * Analyse a batch of observed ARP packets for gratuitous-ARP patterns.
 *
 * @param {{ packets: Array<ArpPacket>, conflictThreshold?: number }} input
 * @returns {{ patterns: Array, type, confidence, evidence, summary }}
 */
export function detectGarpPatterns({ packets = [], conflictThreshold = 3 } = {}) {
  const garps = packets.filter(isGratuitousArp);
  const probes = packets.filter(isArpProbe);

  // Group GARP by claimed IP to spot conflicts / flapping MACs.
  const byIp = new Map();
  for (const g of garps) {
    if (!byIp.has(g.senderIp)) byIp.set(g.senderIp, []);
    byIp.get(g.senderIp).push(g);
  }

  const patterns = [];
  for (const [ip, list] of byIp.entries()) {
    const macs = [...new Set(list.map((p) => p.senderMac.toLowerCase()))];
    const times = list.map((p) => p.timestamp).filter((t) => typeof t === 'number').sort((a, b) => a - b);
    let rate = null;
    if (times.length >= 2 && times[times.length - 1] > times[0]) {
      rate = list.length / ((times[times.length - 1] - times[0]) / 1000); // per second
    }

    if (macs.length > 1) {
      patterns.push({
        type: 'IP Conflict / MAC Flap',
        confidence: 'high',
        severity: 'Medium',
        cwe: 'CWE-200',
        evidence: `IP ${ip} announced by ${macs.length} different MACs (${macs.join(', ')}) in ${list.length} gratuitous ARP packets — duplicate-IP conflict or active ARP-spoofing surface.`,
        ip,
        macs,
        count: list.length,
      });
    } else if (list.length >= conflictThreshold) {
      patterns.push({
        type: 'Repeated Gratuitous ARP',
        confidence: 'medium',
        severity: 'Low',
        evidence: `IP ${ip} gratuitously announced ${list.length} times by ${macs[0]}${rate != null ? ` (~${rate.toFixed(2)}/s)` : ''} — failover announcement pattern or possible spoof probe.`,
        ip,
        macs,
        count: list.length,
      });
    }
  }

  const conflict = patterns.some((p) => p.type === 'IP Conflict / MAC Flap');
  return {
    patterns,
    type: conflict ? 'ARP Conflict Detected' : garps.length ? 'Gratuitous ARP Observed' : 'No Gratuitous ARP',
    confidence: conflict ? 'high' : garps.length ? 'medium' : 'none',
    severity: conflict ? 'Medium' : 'Info',
    evidence: conflict
      ? `${patterns.length} suspicious GARP pattern(s) found among ${garps.length} gratuitous ARP packets.`
      : garps.length
        ? `${garps.length} gratuitous ARP packet(s) observed, no conflicts detected.`
        : 'No gratuitous ARP packets in the observed traffic.',
    summary: {
      totalPackets: packets.length,
      gratuitousCount: garps.length,
      probeCount: probes.length,
      conflictedIps: patterns.filter((p) => p.type === 'IP Conflict / MAC Flap').length,
    },
  };
}

export const GARP_PROBE_DETECTOR = { detectGarpPatterns, isGratuitousArp, isArpProbe };
export default GARP_PROBE_DETECTOR;
