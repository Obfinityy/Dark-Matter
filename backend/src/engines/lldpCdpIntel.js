/**
 * lldpCdpIntel.js — LLDP/CDP neighbor disclosure analysis (idea 00125).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Link-layer
 * discovery protocols (LLDP, Cisco CDP) make every switch, router, AP, and
 * phone announce its hostname, platform, and management IP to adjacent
 * ports. Where the agent can legitimately read neighbor tables (device CLI
 * output, lldpctl, SNMP llpdRemTable), parsing them learns adjacent device
 * hostnames — one compromised or accessible switch maps its whole rack.
 *
 * All functions are pure: they parse neighbor-table text supplied by the
 * caller and never query devices themselves.
 */

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/;

/**
 * Parse Cisco `show cdp neighbors detail` output.
 *
 * @param {string} text
 * @returns {Array<{ deviceId: string, ip: string | null, platform: string | null, localInterface: string | null, remotePort: string | null, holdtime: string | null, version: string | null, protocol: 'CDP', detail: string }>}
 */
export function parseCdpNeighbors(text) {
  const out = [];
  const blocks = String(text || '').split(/(?=^Device ID:\s*)/gim).filter(b => /^\s*Device ID:/im.test(b));
  for (const block of blocks) {
    const pick = (re) => {
      const mm = block.match(re);
      if (!mm) return null;
      const v = mm[1] !== undefined ? mm[1] : mm[0];
      const t = String(v).trim();
      return t || null;
    };
    const deviceId = pick(/^Device ID:\s*(.+)$/im);
    if (!deviceId) continue;
    const ip = (block.match(/\bIP address:\s*([0-9.]+)/i) || [])[1] || null;
    const platform = pick(/^Platform:\s*([^,]+)/im);
    const iface = pick(/^Interface:\s*([^,]+)/im);
    const remotePort = pick(/^Port ID \(outgoing port\):\s*(.+)$/im);
    const holdtime = pick(/^Holdtime\s*:\s*(.+)$/im);
    const version = pick(/^Version\s*:\s*$/im)
      ? (block.split(/^Version\s*:\s*$/im)[1] || '').split('\n').slice(0, 3).join(' ').trim() || null
      : pick(/^Version\s*:\s*(.+)$/im);
    out.push({
      deviceId,
      ip,
      platform,
      localInterface: iface,
      remotePort,
      holdtime,
      version: version ? version.replace(/\s+/g, ' ').slice(0, 160) : null,
      protocol: 'CDP',
      detail: `CDP neighbor '${deviceId}'${ip ? ` (${ip})` : ''}${platform ? ` — ${platform}` : ''}` +
        `${iface ? ` on local ${iface}` : ''}. Adjacent device hostnames extend the asset graph one hop.`,
    });
  }
  return out;
}

/**
 * Parse `show lldp neighbors` table output (IOS-style) and
 * `show lldp neighbors detail` (System Name / Management Address fields).
 *
 * @param {string} text
 * @returns {Array<{ deviceId: string, ip: string | null, platform: string | null, localInterface: string | null, remotePort: string | null, protocol: 'LLDP', detail: string }>}
 */
export function parseLldpNeighbors(text) {
  const raw = String(text || '');
  const out = [];
  const seen = new Set();

  const push = (n) => {
    const key = `${n.deviceId}|${n.localInterface || ''}`;
    if (!n.deviceId || seen.has(key)) return;
    seen.add(key);
    out.push({
      deviceId: n.deviceId,
      ip: n.ip || null,
      platform: n.platform || null,
      localInterface: n.localInterface || null,
      remotePort: n.remotePort || null,
      protocol: 'LLDP',
      detail: `LLDP neighbor '${n.deviceId}'${n.ip ? ` (${n.ip})` : ''}${n.platform ? ` — ${n.platform}` : ''}` +
        `${n.localInterface ? ` on local ${n.localInterface}` : ''}.`,
    });
  };

  // Detail blocks: "System Name: ..." / "Local Intf: ..." / "Management Address: ..."
  const detailBlocks = raw.split(/(?=^(?:Local Intf|System Name):\s*)/gim)
    .filter(b => /System Name\s*:/i.test(b));
  for (const block of detailBlocks) {
    const pick = (re) => {
      const mm = block.match(re);
      if (!mm) return null;
      const v = mm[1] !== undefined ? mm[1] : mm[0];
      const t = String(v).trim();
      return t || null;
    };
    const name = pick(/System Name\s*:\s*(.+)$/im)
      || (block.match(/ChassisId\s*:\s*mac\s*([0-9a-f:]+)/i) || [])[1]
      || pick(/Device ID\s*:\s*(.+)$/im);
    const ipM = block.match(/Management Address(?:\(\w+\))?\s*:\s*([0-9.]+)/i) || block.match(IPV4_RE);
    const ip = ipM ? (ipM[1] || ipM[0]) : null;
    const localInterface = pick(/Local (?:Intf|Interface)\s*:\s*(\S+)/i);
    const remotePort = pick(/Port (?:id|ID|Descr)\s*:\s*(.+)$/im);
    const platform = pick(/System Description\s*:\s*(.+)$/im);
    if (name) {
      push({
        deviceId: name.replace(/\s+/g, ' '),
        ip,
        platform: platform ? platform.replace(/\s+/g, ' ').slice(0, 120) : null,
        localInterface,
        remotePort: remotePort ? remotePort.replace(/\s+/g, ' ').slice(0, 80) : null,
      });
    }
    void 0;
  }

  // IOS table: "Device ID   Local Intf   Hold-time  Capability   Port ID"
  const lines = raw.split('\n');
  let inTable = false;
  for (const line of lines) {
    if (/Device ID\s+Local Intf/i.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.trim() || /^Total entries/i.test(line)) break;
    const parts = line.trim().split(/\s{2,}|\t/);
    if (parts.length >= 2 && !/System Name/i.test(line)) {
      push({
        deviceId: parts[0].trim(),
        localInterface: (parts[1] || '').trim() || null,
        remotePort: (parts[parts.length - 1] || '').trim() || null,
        platform: null,
        ip: null,
      });
    }
  }

  return out;
}

/**
 * Idea 00125 — LLDP/CDP neighbor disclosure.
 *
 * Parses link-layer neighbor tables (CDP detail, LLDP table/detail) and
 * returns adjacent device hostnames, management IPs, platforms, and
 * interface topology.
 *
 * @param {string} text Raw neighbor-table output (CDP and/or LLDP).
 * @returns {{
 *   neighbors: Array<{ deviceId: string, ip: string | null, platform: string | null, localInterface: string | null, remotePort: string | null, protocol: string, detail: string }>,
 *   managementIps: string[],
 *   hostnames: string[],
 *   summary: { total: number, cdp: number, lldp: number, withMgmtIp: number },
 *   findings: string[]
 * }}
 */
export function parseLinkLayerNeighbors(text) {
  const raw = String(text || '');
  const neighbors = [...parseCdpNeighbors(raw), ...parseLldpNeighbors(raw)];

  const managementIps = [...new Set(neighbors.map(n => n.ip).filter(Boolean))];
  const hostnames = [...new Set(neighbors.map(n => n.deviceId))];

  const summary = {
    total: neighbors.length,
    cdp: neighbors.filter(n => n.protocol === 'CDP').length,
    lldp: neighbors.filter(n => n.protocol === 'LLDP').length,
    withMgmtIp: managementIps.length,
  };

  const findings = [];
  if (hostnames.length) {
    findings.push(`${hostnames.length} adjacent device hostname(s): ${hostnames.slice(0, 12).join(', ')}` +
      `${hostnames.length > 12 ? ` (+${hostnames.length - 12} more)` : ''} — ` +
      'each is a one-hop asset to inventory and fingerprint.');
  }
  if (managementIps.length) {
    findings.push(`Management IP(s) disclosed: ${managementIps.join(', ')} — ` +
      'management-plane addresses are high-value follow-up targets.');
  }
  const platforms = [...new Set(neighbors.map(n => n.platform).filter(Boolean))];
  if (platforms.length) {
    findings.push(`Platform(s): ${platforms.slice(0, 4).join(' | ')}${platforms.length > 4 ? '…' : ''} — ` +
      'drives version-specific checks on the adjacent fleet.');
  }
  if (!neighbors.length) {
    findings.push('No LLDP/CDP neighbors parsed — confirm the input is `show cdp neighbors detail`, ' +
      '`show lldp neighbors`, or `show lldp neighbors detail` output.');
  }

  return { neighbors, managementIps, hostnames, summary, findings };
}
