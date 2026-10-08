/**
 * nfsExportProbeAnalyzer.js — NFS export-list probing analyzer (idea 00526).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Where the
 * mount daemon (rpcbind port 111 / mountd) permits it, an EXPORT (showmount
 * -e) query returns the server's export list: each exported path plus the
 * client hosts/netgroups allowed to mount it. Export entries that grant
 * broad access (`*`, world-readable shares, `no_root_squash`) are
 * misconfigurations the authorized assessment must flag; the path naming
 * and export options also fingerprint the NFS server stack (Linux
 * nfs-utils, NetApp ONTAP, FreeBSD, NAS appliances).
 *
 * Pure analyzer: the caller supplies parsed export-list text (showmount -e
 * output or decoded MOUNT export replies). This module never sends NFS
 * RPC calls itself.
 */

/** Risky export-option markers worth flagging. */
export const RISKY_EXPORT_MARKERS = [
  { pattern: /\*/, issue: 'Wildcard client — export mountable from any host', severity: 'High' },
  {
    pattern: /no_root_squash/i,
    issue: 'no_root_squash — remote root keeps root privileges on the share',
    severity: 'Critical',
  },
  {
    pattern: /insecure/i,
    issue: 'insecure — allows connections from unprivileged ports',
    severity: 'Medium',
  },
  {
    pattern: /\bro\b/i,
    issue: 'read-only export (lower risk, still information disclosure)',
    severity: 'Low',
  },
];

/**
 * Parse `showmount -e` style export-list output.
 * Handles lines like: `/srv/share  192.168.1.0/24, *(ro)` and `/data  *`.
 * @param {string} text
 * @returns {Array<{path: string, clients: string[]}>}
 */
export function parseExportList(text = '') {
  const exports = [];
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^export list/i.test(trimmed)) continue;
    const m = trimmed.match(/^(\S+)\s+(.*)$/);
    if (!m) continue;
    const clients = m[2]
      .split(/[,\s]+/)
      .map(c => c.trim())
      .filter(Boolean);
    exports.push({ path: m[1], clients });
  }
  return exports;
}

/**
 * Analyze an NFS export list for exposure surface and risky options.
 * @param {{exports: Array<{path: string, clients: string[]}>, raw?: string}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', exportCount: number, worldExports: string[], riskyExports: Array<{path: string, issue: string, severity: string}>, shareMap: Array<{path: string, clients: string[]}>, evidence: string}}
 */
export function analyzeNfsExports(input = {}) {
  const exports = Array.isArray(input.exports) ? input.exports : parseExportList(input.raw || '');
  const worldExports = exports
    .filter(e => e.clients.some(c => c === '*' || (/\(/.test(c) && c.startsWith('*'))))
    .map(e => e.path);
  const riskyExports = [];
  for (const exp of exports) {
    const blob = exp.clients.join(' ');
    for (const marker of RISKY_EXPORT_MARKERS) {
      if (marker.pattern.test(blob)) {
        riskyExports.push({ path: exp.path, issue: marker.issue, severity: marker.severity });
      }
    }
    // Bare '*' with no options is still world-mountable.
    if (
      exp.clients.includes('*') &&
      !riskyExports.some(r => r.path === exp.path && /Wildcard/.test(r.issue))
    ) {
      riskyExports.push({
        path: exp.path,
        issue: 'Wildcard client — export mountable from any host',
        severity: 'High',
      });
    }
  }

  const worst = riskyExports.some(r => r.severity === 'Critical')
    ? 'critical'
    : riskyExports.some(r => r.severity === 'High')
      ? 'high'
      : 'low';

  return {
    type: 'NFS Export-List Analysis',
    confidence: exports.length > 0 ? 'high' : 'low',
    exportCount: exports.length,
    worldExports,
    riskyExports,
    shareMap: exports,
    severity: worst,
    evidence:
      exports.length === 0
        ? 'No exports listed (empty list or export query refused).'
        : `${exports.length} export(s) visible: ${exports.map(e => `${e.path} → ${e.clients.join(', ')}`).join('; ')}` +
          (riskyExports.length
            ? `. Risky: ${riskyExports.map(r => `${r.path}: ${r.issue} [${r.severity}]`).join('; ')}`
            : '. No risky export options detected.'),
  };
}

/**
 * Guess the NFS server stack from export-list and version metadata.
 * @param {{exportText?: string, versions?: number[], banner?: string}} input
 * @returns {{serverGuess: string|null, confidence: 'high'|'medium'|'low', evidence: string}}
 */
export function guessNfsServerStack(input = {}) {
  const text = `${input.exportText || ''} ${input.banner || ''}`;
  const versions = Array.isArray(input.versions) ? input.versions : [];
  let serverGuess = null;
  if (/netapp|ontap/i.test(text)) serverGuess = 'NetApp ONTAP';
  else if (/freenas|truenas/i.test(text)) serverGuess = 'TrueNAS / FreeNAS';
  else if (/synology/i.test(text)) serverGuess = 'Synology DSM';
  else if (/qnap/i.test(text)) serverGuess = 'QNAP QTS';
  else if (versions.includes(4)) serverGuess = 'Linux nfs-utils (NFSv4 advertised)';
  else if (versions.includes(3)) serverGuess = 'Linux nfs-utils / generic NFSv3';
  return {
    serverGuess,
    confidence: serverGuess ? 'medium' : 'low',
    evidence: serverGuess
      ? `Stack markers suggest ${serverGuess} (NFS versions: ${versions.join(', ') || 'unknown'}).`
      : 'No distinctive stack markers in export data.',
  };
}
