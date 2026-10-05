/**
 * snmpCommunityProber.js — SNMPv2c community-string result analyzer.
 *
 * Analyzes the RESULT set of a community-string identification pass: for
 * each candidate community string, whether the device answered read-only
 * SNMP queries and what system data the response carried. The module takes
 * already-captured probe results as input — it never sends SNMP traffic
 * itself, which keeps the analyzer safe to run offline against stored data.
 */

/** Enterprise numbers → vendor names (subset of the most common). */
const ENTERPRISE_VENDORS = {
  9: 'Cisco',
  11: 'HP / HPE',
  43: '3Com',
  45: 'SynOptics / Nortel',
  8072: 'Net-SNMP (Linux/Unix host)',
  3181: 'Monterey Networks',
  2636: 'Juniper Networks',
  2011: 'Huawei',
  14988: 'MikroTik',
  4526: 'Netgear',
  674: 'Dell',
  311: 'Microsoft',
  2: 'IBM',
  171: 'D-Link',
  1916: 'Extreme Networks',
  1: 'generic enterprise (mib-2)',
};

/** Communities that should never authenticate a device. */
const DEFAULT_COMMUNITIES = ['public', 'private', 'community', 'manager', 'admin', 'default', 'snmp', 'cisco', 'password', 'publics'];

/**
 * Identify a vendor from an SNMP sysObjectID such as
 * "1.3.6.1.4.1.9.1.1208".
 * @param {string} sysObjectID
 */
export function vendorFromSysObjectId(sysObjectID = '') {
  const match = /^1\.3\.6\.1\.4\.1\.(\d+)/.exec(sysObjectID.trim());
  if (!match) return { vendor: 'Unknown', enterprise: null };
  const enterprise = Number(match[1]);
  return {
    vendor: ENTERPRISE_VENDORS[enterprise] || `Unknown enterprise ${enterprise}`,
    enterprise,
  };
}

/**
 * Analyze community-string probe results captured during an authorized hunt.
 *
 * @param {{
 *   target?: string,
 *   results: Array<{ community: string, success: boolean, sysDescr?: string, sysObjectID?: string, error?: string }>,
 *   baseline?: string[]   // communities known-good at a previous check (rotation tracking)
 * }} input
 */
export function analyzeCommunityProbes({ target = '', results = [], baseline = [] } = {}) {
  const working = results.filter((r) => r.success);
  const findings = [];

  const identified = working
    .map((r) => {
      const { vendor, enterprise } = vendorFromSysObjectId(r.sysObjectID || '');
      return {
        community: r.community,
        sysDescr: r.sysDescr || '',
        sysObjectID: r.sysObjectID || '',
        vendor,
        enterprise,
      };
    });

  for (const w of working) {
    if (DEFAULT_COMMUNITIES.includes(w.community.toLowerCase())) {
      findings.push({
        type: 'Default SNMP community string accepted',
        severity: 'Medium',
        confidence: 'high',
        cwe: 'CWE-798',
        evidence: `Community "${w.community}" returned sysDescr "${w.sysDescr.slice(0, 120)}".`,
        recommendation: 'Replace default communities with long, unique, per-device strings; consider migrating to SNMPv3 with authentication.',
      });
    }
  }

  if (working.length > 1) {
    findings.push({
      type: 'Multiple valid community strings',
      severity: 'Info',
      confidence: 'high',
      evidence: `${working.length} communities authenticated: ${working.map((w) => `"${w.community}"`).join(', ')}.`,
      recommendation: 'Consolidate to the minimum set of read-only communities; retire unused ones.',
    });
  }

  if (baseline.length > 0) {
    const baselineSet = new Set(baseline.map((c) => c.toLowerCase()));
    const currentSet = new Set(working.map((w) => w.community.toLowerCase()));
    const rotatedOut = [...baselineSet].filter((c) => !currentSet.has(c));
    const newlyAdded = [...currentSet].filter((c) => !baselineSet.has(c));
    if (rotatedOut.length > 0 || newlyAdded.length > 0) {
      findings.push({
        type: 'Community string rotation detected',
        severity: 'Info',
        confidence: 'high',
        evidence: `Removed: ${rotatedOut.join(', ') || 'none'}; added: ${newlyAdded.join(', ') || 'none'}.`,
        recommendation: 'Keep the stored baseline in sync with the rotation policy.',
      });
    }
  }

  const writable = working.filter((w) => /private|manager|rw/i.test(w.community));
  if (writable.length > 0) {
    findings.push({
      type: 'Potentially write-capable community accepted',
      severity: 'High',
      confidence: 'medium',
      cwe: 'CWE-798',
      evidence: `Community "${writable[0].community}" succeeded; verify whether it grants read-write access.`,
      recommendation: 'Audit whether this community has write access and restrict it to read-only.',
    });
  }

  return {
    target,
    totalTested: results.length,
    workingCount: working.length,
    identified,
    working,
    findings,
    anyAccess: working.length > 0,
  };
}

export const SNMP_COMMUNITY_PROBER = { analyzeCommunityProbes, vendorFromSysObjectId };
export default SNMP_COMMUNITY_PROBER;
