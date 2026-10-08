/**
 * iscsiTargetDiscovery.js — iSCSI target discovery analyzer (idea 00527).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. iSCSI
 * discovery (SendTargets, TCP 3260) returns every target the portal is
 * willing to advertise: IQN names plus portal addresses. Analyzing a
 * discovery response maps the storage attack surface — target IQNs often
 * encode vendor/product hints (e.g. `iqn.2001-05.com.equallogic`, NetApp,
 * TrueNAS), and targets with no authentication configured are a finding
 * in the authorized assessment. Target IQN naming also fingerprints the
 * storage array software family.
 *
 * Pure analyzer: the caller supplies parsed SendTargets discovery text
 * (iscsiadm -m discovery output or decoded discovery replies). This
 * module never opens iSCSI sessions itself.
 */

/** Vendor/product hints from IQN naming conventions. */
export const ISCSI_IQN_VENDOR_HINTS = [
  { pattern: /equallogic/i, vendor: 'Dell EqualLogic' },
  { pattern: /compellent/i, vendor: 'Dell Compellent / SC Series' },
  { pattern: /netapp/i, vendor: 'NetApp ONTAP / E-Series' },
  { pattern: /emc|vnx|unity|powermax/i, vendor: 'Dell EMC' },
  { pattern: /truenas|freenas/i, vendor: 'TrueNAS / FreeNAS' },
  { pattern: /synology/i, vendor: 'Synology' },
  { pattern: /qnap/i, vendor: 'QNAP' },
  { pattern: /openfiler/i, vendor: 'Openfiler' },
  { pattern: /tgt/i, vendor: 'Linux tgt (TGT daemon)' },
  { pattern: /lio|targetcli/i, vendor: 'Linux LIO (targetcli)' },
  { pattern: /starwind/i, vendor: 'StarWind Virtual SAN' },
  { pattern: /datacore/i, vendor: 'DataCore SANsymphony' },
  { pattern: /nutanix/i, vendor: 'Nutanix' },
  { pattern: /microsoft/i, vendor: 'Microsoft iSCSI Target' },
];

/**
 * Parse `iscsiadm -m discovery -t sendtargets` style output:
 *   192.168.1.10:3260,1 iqn.2001-05.com.equallogic:0-8a0906-...
 * @param {string} text
 * @returns {Array<{portal: string, portalGroup: string|null, iqn: string}>}
 */
export function parseSendTargets(text = '') {
  const targets = [];
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(\S+?)(?:,(\d+))?\s+(iqn\.\S+|eui\.\S+|naa\.\S+)/i);
    if (m) targets.push({ portal: m[1], portalGroup: m[2] || null, iqn: m[3] });
  }
  return targets;
}

/**
 * Analyze iSCSI discovery results: map targets, flag vendor hints and
 * exposure-relevant observations.
 * @param {{targets?: Array<{portal: string, portalGroup: string|null, iqn: string}>, raw?: string, authObserved?: boolean}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', targetCount: number, targets: Array<{portal: string, iqn: string, vendorHint: string|null}>, vendors: string[], exposureNotes: string[], evidence: string}}
 */
export function analyzeIscsiDiscovery(input = {}) {
  const parsed = Array.isArray(input.targets) ? input.targets : parseSendTargets(input.raw || '');
  const targets = parsed.map(t => {
    const hint = ISCSI_IQN_VENDOR_HINTS.find(v => v.pattern.test(t.iqn));
    return {
      portal: t.portal,
      portalGroup: t.portalGroup,
      iqn: t.iqn,
      vendorHint: hint ? hint.vendor : null,
    };
  });
  const vendors = [...new Set(targets.map(t => t.vendorHint).filter(Boolean))];

  const exposureNotes = [];
  if (targets.length > 0) {
    exposureNotes.push(
      `${targets.length} iSCSI target(s) advertised via SendTargets — storage surface mapped`
    );
    if (input.authObserved === false) {
      exposureNotes.push(
        'No CHAP/authentication challenge observed during discovery — targets may allow unauthenticated login (verify in authorized assessment)'
      );
    }
  }

  return {
    type: 'iSCSI Target Discovery Analysis',
    confidence: targets.length > 0 ? 'high' : 'low',
    targetCount: targets.length,
    targets,
    vendors,
    exposureNotes,
    evidence:
      targets.length === 0
        ? 'No iSCSI targets discovered (empty discovery response or portal refused).'
        : `Discovered ${targets.length} target(s): ${targets.map(t => `${t.iqn} @ ${t.portal}${t.vendorHint ? ` (${t.vendorHint})` : ''}`).join('; ')}` +
          (exposureNotes.length ? `. Notes: ${exposureNotes.join('; ')}` : ''),
  };
}
