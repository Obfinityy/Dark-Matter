/**
 * snmpSysNameIntel.js — SNMP sysName/sysDescr harvesting (idea 00124).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. SNMP agents
 * answer the system MIB group with sysName (the device's configured
 * hostname), sysDescr (make/model/firmware), sysObjectID (vendor enterprise
 * number), sysLocation, and sysContact. One snmpwalk of the system group —
 * which the target's own agents willingly serve — harvests device hostnames
 * and fingerprints the fleet.
 *
 * All functions are pure: they parse snmpwalk-style output supplied by the
 * caller and never send SNMP requests themselves.
 */

/**
 * Well-known IANA enterprise numbers → vendor. A compact, curated subset of
 * the vendors most often seen in enterprise fleets.
 */
export const SNMP_ENTERPRISE_VENDORS = {
  9: 'Cisco', 11: 'HP / HPE', 2636: 'Juniper Networks', 2011: 'Huawei',
  8072: 'Net-SNMP (Linux/Unix host)', 311: 'Microsoft', 14988: 'MikroTik',
  4526: 'Netgear', 171: 'D-Link', 674: 'Dell', 30065: 'Arista Networks',
  25506: 'H3C', 3902: 'Zyxel', 11863: 'TP-Link', 890: 'ZTE',
  259: '3Com', 45: 'SynOptics/Bay Networks', 43: 'Apple',
  1991: 'Foundry Networks', 1795: 'Nortel', 6889: 'Avaya',
  14179: 'Altaro/Altigen', 1916: 'Extreme Networks', 12356: 'Fortinet',
  8741: 'SonicWall', 3224: 'Netscreen', 738: 'Checkpoint',
  27262: 'Palo Alto Networks', 14525: 'WatchGuard', 21150: 'Ruckus Wireless',
  14526: 'Aruba Networks', 14145: 'Meru Networks', 14823: 'Aruba (2nd)',
  3955: 'Linksys', 2272: 'Allied Telesyn', 6027: 'Force10 Networks',
  1872: 'Alteon/Nortel', 6101: 'Extreme (Summit)', 52: 'Cabletron',
  94: 'IBM', 2: 'IBM (legacy)', 18756: 'Brocade (legacy)',
};

/**
 * Decode one snmpwalk value: handles `STRING: "..."`, `Hex-STRING: ...`,
 * `OID: ...`, `INTEGER: ...`, `Timeticks: (...) ...`, and bare values.
 *
 * @param {string} raw The text after `=`.
 * @returns {string}
 */
export function decodeSnmpValue(raw) {
  let v = String(raw || '').trim();
  let m = v.match(/^STRING:\s*"?([\s\S]*?)"?\s*$/);
  if (m) return m[1];
  m = v.match(/^Hex-STRING:\s*([\s\S]+)$/i);
  if (m) {
    const bytes = m[1].trim().split(/\s+/).map(h => parseInt(h, 16)).filter(n => !Number.isNaN(n));
    const ascii = bytes.filter(b => b >= 32 && b < 127).map(b => String.fromCharCode(b)).join('');
    // Only treat as text when it is mostly printable; otherwise keep hex.
    if (ascii.length >= bytes.length * 0.7 && ascii.length) return ascii;
    return m[1].trim();
  }
  m = v.match(/^(?:OID|INTEGER|Gauge32|Counter32|Counter64|Timeticks|IpAddress|Opaque):\s*([\s\S]+)$/i);
  if (m) {
    const inner = m[1].trim();
    const tm = inner.match(/^\(\d+\)\s*(.*)$/);
    return tm ? tm[1] : inner;
  }
  return v.replace(/^"|"$/g, '');
}

/**
 * Extract the enterprise number from a sysObjectID value such as
 * `SNMPv2-SMI::enterprises.9.1.1208` or `1.3.6.1.4.1.9.1.1208`.
 *
 * @param {string} objectId
 * @returns {number | null}
 */
export function enterpriseFromObjectId(objectId) {
  const v = String(objectId || '');
  let m = v.match(/enterprises\.(\d+)/i) || v.match(/1\.3\.6\.1\.4\.1\.(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Vendor guess from a sysDescr string (fallback when sysObjectID is absent).
 *
 * @param {string} descr
 * @returns {string | null}
 */
export function vendorFromDescr(descr) {
  const d = String(descr || '').toLowerCase();
  const hints = [
    ['cisco', 'Cisco'], ['juniper', 'Juniper Networks'], ['arista', 'Arista Networks'],
    ['huawei', 'Huawei'], ['hpe', 'HP / HPE'], ['hewlett', 'HP / HPE'], ['procurve', 'HP / HPE'],
    ['dell', 'Dell'], ['mikrotik', 'MikroTik'], ['fortinet', 'Fortinet'], ['fortigate', 'Fortinet'],
    ['palo alto', 'Palo Alto Networks'], ['pan-os', 'Palo Alto Networks'],
    ['sonicwall', 'SonicWall'], ['watchguard', 'WatchGuard'], ['checkpoint', 'Checkpoint'],
    ['aruba', 'Aruba Networks'], ['ruckus', 'Ruckus Wireless'], ['ubiquiti', 'Ubiquiti'],
    ['netgear', 'Netgear'], ['zyxel', 'Zyxel'], ['tp-link', 'TP-Link'], ['d-link', 'D-Link'],
    ['linux', 'Net-SNMP (Linux/Unix host)'], ['windows', 'Microsoft'],
    ['vmware', 'VMware'], ['synology', 'Synology'], ['qnap', 'QNAP'],
  ];
  for (const [needle, vendor] of hints) if (d.includes(needle)) return vendor;
  return null;
}

/**
 * Idea 00124 — SNMP sysName harvesting.
 *
 * Parses snmpwalk output of the system MIB group and harvests device
 * hostnames (sysName), fingerprints (sysDescr), vendor (sysObjectID
 * enterprise), location/contact, and uptime.
 *
 * @param {string} walkText Raw snmpwalk output.
 * @returns {{
 *   sysName: string | null,
 *   sysDescr: string | null,
 *   sysObjectID: string | null,
 *   enterprise: number | null,
 *   vendor: string | null,
 *   sysLocation: string | null,
 *   sysContact: string | null,
 *   sysUpTime: string | null,
 *   hostnames: Array<{ value: string, source: string, detail: string }>,
 *   summary: { hasName: boolean, hasDescr: boolean, vendorKnown: boolean },
 *   findings: string[]
 * }}
 */
export function harvestSnmpSystem(walkText) {
  const text = String(walkText || '');
  const fields = {};
  const lineRe = /^(\S+::)?(sysName|sysDescr|sysObjectID|sysLocation|sysContact|sysUpTime|sysServices)\.0\s*=\s*([^\n]*)$/gim;
  let m;
  while ((m = lineRe.exec(text)) !== null) {
    const key = m[2];
    if (!(key in fields)) fields[key] = decodeSnmpValue(m[3]);
  }

  const sysName = fields.sysName || null;
  const sysDescr = fields.sysDescr || null;
  const sysObjectID = fields.sysObjectID || null;
  const enterprise = sysObjectID ? enterpriseFromObjectId(sysObjectID) : null;
  const vendor = (enterprise && SNMP_ENTERPRISE_VENDORS[enterprise]) || vendorFromDescr(sysDescr) || null;

  const hostnames = [];
  if (sysName) {
    hostnames.push({
      value: sysName,
      source: 'sysName',
      detail: `SNMP sysName '${sysName}' — the device's configured hostname. ` +
        'Naming conventions (site-role-number) decode the fleet topology.',
    });
  }
  // sysDescr sometimes embeds the hostname, e.g. "Linux web01 5.15 ...".
  if (sysDescr) {
    const hm = sysDescr.match(/^\S+\s+([A-Za-z0-9](?:[A-Za-z0-9.-]{0,62}[A-Za-z0-9])?)\s/);
    if (hm && hm[1].toLowerCase() !== 'linux' && !hostnames.some(h => h.value === hm[1])) {
      hostnames.push({
        value: hm[1],
        source: 'sysDescr',
        detail: `Hostname '${hm[1]}' embedded in sysDescr — cross-checks the sysName value.`,
      });
    }
  }

  const summary = {
    hasName: !!sysName,
    hasDescr: !!sysDescr,
    vendorKnown: !!vendor,
  };

  const findings = [];
  if (sysName) findings.push(`Device hostname via SNMP: '${sysName}'.`);
  if (vendor) findings.push(`Vendor identified: ${vendor}${enterprise ? ` (enterprise ${enterprise})` : ''} — ` +
    'drives version-specific follow-up checks.');
  if (fields.sysLocation) findings.push(`sysLocation discloses site info: '${fields.sysLocation}'.`);
  if (fields.sysContact) findings.push(`sysContact discloses an owner/mailbox: '${fields.sysContact}' — ` +
    'a social-engineering-relevant contact, handle per engagement rules.');
  if (fields.sysUpTime) findings.push(`sysUpTime: ${fields.sysUpTime} — uptime reveals reboot cadence/patching windows.`);
  if (sysDescr && /SNMPv2/i.test(sysDescr) === false && sysDescr.length > 8) {
    findings.push(`sysDescr fingerprint: '${sysDescr.slice(0, 120)}${sysDescr.length > 120 ? '…' : ''}'.`);
  }
  if (!sysName && !sysDescr) {
    findings.push('No system MIB fields parsed — confirm the input is snmpwalk system-group output.');
  }

  return {
    sysName,
    sysDescr,
    sysObjectID,
    enterprise,
    vendor,
    sysLocation: fields.sysLocation || null,
    sysContact: fields.sysContact || null,
    sysUpTime: fields.sysUpTime || null,
    hostnames,
    summary,
    findings,
  };
}
