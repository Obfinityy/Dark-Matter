/**
 * afpServerInfoProber.js — AFP server-info probing analyzer (idea 00528).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. The Apple
 * Filing Protocol server-info reply (DSI GetStatus / FPGetSrvrInfo) is
 * verbose: server name, machine type, AFP protocol versions supported,
 * User Authentication Modules (UAMs) offered, server signature, supported
 * volumes list, and the network addresses it listens on. Parsing a
 * captured server-info reply fingerprints the implementation (macOS
 * Server / legacy AppleShare, Netatalk versions, NAS appliances) and the
 * UAM list reveals weak authentication options — `No User Authent` or
 * `Cleartxt Passwrd` offered by the server is a finding in the authorized
 * assessment.
 *
 * Pure analyzer: the caller supplies the parsed server-info structure
 * (from afp-tools, Wireshark field exports, or pcap summaries). This
 * module never opens AFP sessions itself.
 */

/** Known AFP UAMs and their security posture. */
export const AFP_UAMS = {
  'No User Authent': { description: 'Guest access without credentials', risk: 'High — unauthenticated access possible' },
  'Cleartxt Passwrd': { description: 'Cleartext password', risk: 'High — credentials sent in cleartext' },
  'Randnum Exchange': { description: 'Two-way random-number exchange', risk: 'Medium — weak legacy crypto' },
  '2-Way Randnum Exchange': { description: 'Two-way random-number exchange', risk: 'Medium — weak legacy crypto' },
  'DHCAST128': { description: 'Diffie-Hellman + CAST-128', risk: 'Low — reasonable for legacy protocol' },
  'DHX2': { description: 'Diffie-Hellman key exchange v2', risk: 'Low — strongest legacy AFP UAM' },
  'GSS': { description: 'Kerberos GSSAPI', risk: 'Low — Kerberos authentication' },
};

/** Implementation hints from machine-type / version strings. */
export const AFP_IMPLEMENTATION_HINTS = [
  { pattern: /netatalk\s*([\d.]+)/i, name: 'Netatalk', versionGroup: 1 },
  { pattern: /mac\s*os\s*x|macos/i, name: 'macOS Server (Apple AFP)', versionGroup: null },
  { pattern: /appleshare/i, name: 'AppleShare (classic Mac OS)', versionGroup: null },
  { pattern: /synology/i, name: 'Synology DSM (Netatalk-based)', versionGroup: null },
  { pattern: /qnap/i, name: 'QNAP (Netatalk-based)', versionGroup: null },
];

/**
 * Analyze a parsed AFP server-info reply.
 * @param {{serverName?: string, machineType?: string, afpVersions?: string[], uams?: string[], serverSignature?: string, volumes?: string[], networkAddresses?: string[]}} info
 * @returns {{type: string, confidence: 'high'|'medium'|'low', implementation: string|null, version: string|null, weakUams: Array<{uam: string, risk: string}>, volumeCount: number, evidence: string}}
 */
export function analyzeAfpServerInfo(info = {}) {
  const uams = Array.isArray(info.uams) ? info.uams : [];
  const versions = Array.isArray(info.afpVersions) ? info.afpVersions : [];
  const volumes = Array.isArray(info.volumes) ? info.volumes : [];

  // Implementation fingerprint from machine-type / server-name strings.
  const blob = `${info.machineType || ''} ${info.serverName || ''}`;
  let implementation = null;
  let version = null;
  for (const hint of AFP_IMPLEMENTATION_HINTS) {
    const m = blob.match(hint.pattern);
    if (m) {
      implementation = hint.name;
      if (hint.versionGroup && m[hint.versionGroup]) version = m[hint.versionGroup];
      break;
    }
  }

  // Weak authentication modules are the key security signal.
  const weakUams = [];
  for (const uam of uams) {
    const known = AFP_UAMS[uam];
    if (known && /High|Medium/.test(known.risk)) weakUams.push({ uam, risk: known.risk });
  }

  const parts = [
    info.serverName ? `server "${info.serverName}"` : 'unnamed server',
    info.machineType ? `machine type "${info.machineType}"` : null,
    versions.length ? `AFP versions: ${versions.join(', ')}` : 'no AFP version list',
    uams.length ? `UAMs: ${uams.join(', ')}` : 'no UAM list',
    volumes.length ? `${volumes.length} volume(s): ${volumes.join(', ')}` : 'no volume list',
    info.serverSignature ? `signature ${info.serverSignature.slice(0, 32)}…` : null,
  ].filter(Boolean);

  if (weakUams.length) {
    parts.push(`WEAK AUTH: ${weakUams.map((w) => `${w.uam} (${w.risk})`).join(', ')}`);
  }

  return {
    type: 'AFP Server-Info Analysis',
    confidence: uams.length || versions.length ? 'high' : 'low',
    implementation,
    version,
    weakUams,
    volumeCount: volumes.length,
    evidence: parts.join('; ') + '.',
  };
}
