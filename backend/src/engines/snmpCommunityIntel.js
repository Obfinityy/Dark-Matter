/**
 * snmpCommunityIntel.js — SNMP agent exposure classifier.
 *
 * Read-only analysis of observed SNMP agent responses: classifies exposure by
 * how the agent handles different community strings (responds / errors /
 * silent), and by how much system information (sysDescr, sysObjectID) it
 * discloses. Flags default-community ("public"/"private") acceptance as a
 * finding for authorized assessments.
 *
 * This module never sends packets; it classifies already-observed behaviour.
 * No SET operations are modelled or implied.
 */

/** Well-known default community strings worth checking against observations. */
const DEFAULT_COMMUNITIES = ['public', 'private', 'community', 'manager', 'admin', 'snmp'];

/** Vendor hints extractable from sysDescr text. */
const SYSDESCR_VENDORS = [
  { pattern: /cisco/i, vendor: 'Cisco' },
  { pattern: /juniper/i, vendor: 'Juniper' },
  { pattern: /mikrotik/i, vendor: 'MikroTik' },
  { pattern: /ubiquiti|ubnt|unifi/i, vendor: 'Ubiquiti' },
  { pattern: /linux/i, vendor: 'Linux (net-snmp)' },
  { pattern: /windows/i, vendor: 'Microsoft Windows' },
  { pattern: /hp |hewlett|aruba/i, vendor: 'HPE/Aruba' },
  { pattern: /d-link/i, vendor: 'D-Link' },
  { pattern: /netgear/i, vendor: 'Netgear' },
];

/**
 * Classify one observed community-string probe result.
 *
 * @param {{ community: string, outcome: 'responded'|'noSuchName'|'badCommunity'|'timeout', sysDescr?: string, sysObjectID?: string }} probe
 */
function classifyProbe(probe) {
  const { community, outcome, sysDescr = '', sysObjectID = '' } = probe;
  const isDefault = DEFAULT_COMMUNITIES.includes(String(community).toLowerCase());
  if (outcome === 'responded') {
    const vendorHit = SYSDESCR_VENDORS.find(({ pattern }) => pattern.test(sysDescr));
    return {
      community,
      accepted: true,
      isDefault,
      severity: isDefault ? 'Medium' : 'Low',
      confidence: 'high',
      type: isDefault ? 'SNMP Default Community Accepted' : 'SNMP Community String Accepted',
      cwe: 'CWE-798',
      evidence: `Agent responded to community "${community}"${sysDescr ? ` revealing sysDescr: ${sysDescr.slice(0, 120)}` : ''}${sysObjectID ? ` (sysObjectID ${sysObjectID})` : ''}.`,
      vendor: vendorHit ? vendorHit.vendor : null,
    };
  }
  if (outcome === 'badCommunity') {
    return { community, accepted: false, isDefault, confidence: 'high', evidence: `Agent rejected "${community}" with authentication failure — community validation present.` };
  }
  if (outcome === 'noSuchName') {
    return { community, accepted: false, isDefault, confidence: 'medium', evidence: `Agent responded with noSuchName for "${community}" — SNMPv1 error handling observed, agent reachable.` };
  }
  return { community, accepted: false, isDefault, confidence: 'low', evidence: `No response to "${community}" — agent silent or filtered.` };
}

/**
 * Classify SNMP agent exposure from a set of observed probe outcomes.
 *
 * @param {{ target: string, probes: Array, version?: '1'|'2c'|'3' }} input
 * @returns {{ exposed: boolean, type, confidence, evidence, details }}
 */
export function classifySnmpExposure({ target = 'unknown', probes = [], version = '2c' }) {
  const findings = (probes || []).map(classifyProbe);
  const accepted = findings.filter((f) => f.accepted);
  const defaultAccepted = accepted.filter((f) => f.isDefault);

  if (defaultAccepted.length) {
    return {
      exposed: true,
      type: 'SNMP Default Community Accepted',
      confidence: 'high',
      severity: 'Medium',
      cwe: 'CWE-798',
      evidence: `SNMPv${version} agent at ${target} accepts default community string(s): ${defaultAccepted.map((f) => `"${f.community}"`).join(', ')}.`,
      details: { target, version, accepted: defaultAccepted, totalProbes: probes.length },
    };
  }
  if (accepted.length) {
    return {
      exposed: true,
      type: 'SNMP Community String Accepted (non-default)',
      confidence: 'medium',
      severity: 'Low',
      cwe: 'CWE-798',
      evidence: `SNMPv${version} agent at ${target} accepts non-default community "${accepted[0].community}" — verify authorization scope.`,
      details: { target, version, accepted, totalProbes: probes.length },
    };
  }
  return {
    exposed: false,
    type: 'SNMP Community Hardened',
    confidence: 'medium',
    evidence: `SNMPv${version} agent at ${target} rejected or ignored all ${probes.length} observed community probes.`,
    details: { target, version, totalProbes: probes.length },
  };
}

export const SNMP_COMMUNITY_INTEL = { classifySnmpExposure, DEFAULT_COMMUNITIES };
export default SNMP_COMMUNITY_INTEL;
