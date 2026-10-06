/**
 * arpTableEnricher.js — ARP table enrichment with OUI-based vendor mapping.
 *
 * Takes observed ARP table entries (IP → MAC, as seen on the gateway or via
 * passive observation) and enriches each with the IEEE OUI vendor assignment,
 * flagging randomized/locally-administered MACs and virtualization vendors
 * that hint at hypervisors or containers on the segment.
 *
 * This module only analyses observed table data — it performs no ARP activity.
 */

/** Embedded OUI sample (first 3 bytes of MAC → vendor). Full table can be extended. */
const OUI_MAP = {
  '00:1B:2A': 'Cisco Systems',
  '00:1C:58': 'Cisco Systems',
  '00:23:04': 'Cisco Systems',
  '00:50:56': 'VMware',
  '00:0C:29': 'VMware',
  '00:15:5D': 'Microsoft (Hyper-V)',
  '52:54:00': 'QEMU/KVM',
  '02:42:AC': 'Docker',
  '00:16:3E': 'Xen',
  '00:1A:A0': 'Dell',
  'F8:BC:12': 'Dell',
  '00:25:64': 'Hewlett Packard Enterprise',
  '3C:A8:2A': 'Ubiquiti Networks',
  'F4:92:BF': 'Hewlett Packard Enterprise',
  '00:0D:B9': 'PC Engines',
  'B8:27:EB': 'Raspberry Pi Foundation',
  'DC:A6:32': 'Raspberry Pi Foundation',
  'E4:5F:01': 'Raspberry Pi Foundation',
  'AC:DE:48': 'Private (Apple)',
  'F0:18:98': 'Private (Apple)',
  '3C:22:FB': 'Apple',
  '00:21:6A': 'Intel',
  'A4:BF:01': 'Intel',
  '00:23:DF': 'Samsung',
  '8C:F5:A3': 'Samsung',
  '00:E0:4C': 'Realtek',
  '00:1F:C6': 'ASRock',
  'D8:CB:8A': 'Micro-Star (MSI)',
  '18:C0:4D': 'TP-Link',
  '50:C7:BF': 'TP-Link',
  'C0:4A:00': 'TP-Link',
  'E8:DE:27': 'TP-Link',
  '84:D8:1B': 'D-Link',
  '1C:7E:E5': 'D-Link',
  'C4:6E:1F': 'Netgear',
  '28:C6:8E': 'Netgear',
  '00:14:6C': 'Netgear',
  '00:0C:42': 'RouterBoard (MikroTik)',
  'D4:CA:6D': 'RouterBoard (MikroTik)',
  'E4:8D:8C': 'RouterBoard (MikroTik)',
  'CC:2D:E0': 'RouterBoard (MikroTik)',
  '04:D9:F5': 'Google',
  '3C:5A:B4': 'Google',
  'F8:1A:67': 'Xiaomi',
  '64:09:80': 'Xiaomi',
  '78:11:DC': 'Xiaomi',
  '98:0C:82': 'Sonos',
  'B8:E9:37': 'Sonos',
  '00:17:88': 'Philips (Hue)',
  'EC:B5:FA': 'Philips (Hue)',
  'D0:73:D5': 'LIFX',
  '18:B4:30': 'Nest Labs',
};

/** Multicast/broadcast MACs seen in ARP tables are never device identifiers. */
function isSpecialMac(mac) {
  const m = mac.toLowerCase();
  return m === 'ff:ff:ff:ff:ff:ff' || m.startsWith('01:00:5e') || m.startsWith('33:33:');
}

/** Locally administered bit (second-least-significant bit of first octet). */
function isLocallyAdministered(mac) {
  const first = parseInt(mac.slice(0, 2), 16);
  return Number.isNaN(first) ? false : Boolean(first & 0x02);
}

/** Look up the vendor for a MAC address. */
export function lookupOuiVendor(mac) {
  const oui = String(mac).toUpperCase().slice(0, 8);
  return OUI_MAP[oui] || null;
}

/**
 * Enrich ARP table entries.
 *
 * @param {{ entries: Array<{ ip: string, mac: string, interface?: string }>, flagVirtual?: boolean }} input
 * @returns {{ enriched: Array, type, confidence, evidence, summary }}
 */
export function enrichArpTable({ entries = [], flagVirtual = true } = {}) {
  const enriched = (entries || []).map(({ ip, mac, interface: iface }) => {
    const norm = String(mac).toUpperCase();
    const vendor = isSpecialMac(norm) ? 'Special (multicast/broadcast)' : lookupOuiVendor(norm);
    const localAdmin = isLocallyAdministered(norm);
    const virtualization = /vmware|hyper-v|qemu|xen|docker/i.test(vendor || '');
    return {
      ip,
      mac: norm,
      vendor: vendor || (localAdmin ? 'Unknown (locally administered)' : 'Unknown'),
      locallyAdministered: localAdmin,
      randomizedHint: localAdmin && !vendor,
      virtualization: flagVirtual && virtualization,
      interface: iface || null,
    };
  });

  const virtualHosts = enriched.filter((e) => e.virtualization);
  const randomized = enriched.filter((e) => e.randomizedHint);
  const unknown = enriched.filter((e) => e.vendor === 'Unknown' || e.vendor === 'Unknown (locally administered)');

  const notes = [];
  if (virtualHosts.length) notes.push(`${virtualHosts.length} virtualized endpoint(s): ${virtualHosts.map((e) => `${e.ip} (${e.vendor})`).join(', ')}`);
  if (randomized.length) notes.push(`${randomized.length} locally-administered MAC(s) — possible MAC randomization or spoofing: ${randomized.map((e) => e.ip).join(', ')}`);

  return {
    enriched,
    type: 'ARP Table Enriched',
    confidence: 'high',
    severity: randomized.length ? 'Low' : 'Info',
    evidence: `Enriched ${enriched.length} ARP entries with OUI vendor data: ${enriched.length - unknown.length} identified, ${unknown.length} unknown.${notes.length ? ` ${notes.join(' ')}` : ''}`,
    summary: {
      total: enriched.length,
      identified: enriched.length - unknown.length,
      unknown: unknown.length,
      virtualized: virtualHosts.length,
      locallyAdministered: randomized.length,
    },
  };
}

export const ARP_TABLE_ENRICHER = { enrichArpTable, lookupOuiVendor, isLocallyAdministered };
export default ARP_TABLE_ENRICHER;
