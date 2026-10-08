/**
 * socketIoHandshakeAnalyzer.js — Socket.IO handshake analysis engine.
 *
 * Analyzes observed Socket.IO handshake artifacts (client library versions
 * referenced in page scripts and recorded polling/upgrade exchanges) to
 * fingerprint the Socket.IO server version. Version knowledge lets a
 * bug-bounty hunter check for known, fixed CVEs in the deployed version —
 * a purely defensive fingerprinting capability.
 */

const SOCKET_IO_VERSION_HINTS = [
  {
    min: 4,
    max: 4,
    markers: [/socket\.io\/4\./i, /socket\.io-client@4/i, /\/socket\.io\.min\.js\?v=4/i],
    label: 'Socket.IO v4.x',
  },
  {
    min: 3,
    max: 3,
    markers: [/socket\.io\/3\./i, /socket\.io-client@3/i],
    label: 'Socket.IO v3.x',
  },
  {
    min: 2,
    max: 2,
    markers: [/socket\.io\/2\./i, /socket\.io-client@2/i, /socket\.io\.js/i],
    label: 'Socket.IO v2.x',
  },
  {
    min: 1,
    max: 1,
    markers: [/socket\.io\/1\./i, /socket\.io-client@1/i],
    label: 'Socket.IO v1.x',
  },
];

// Known-vulnerable Socket.IO ranges (defensive reference — check, don't exploit).
const VULNERABLE_RANGES = [
  { max: '2.5.0', note: 'Socket.IO <= 2.5.0 — known DoS/memory issues; recommend upgrade to v4' },
  { max: '3.1.2', note: 'Socket.IO <= 3.1.2 — known CORS/session issues; recommend upgrade to v4' },
];

/**
 * Extract Socket.IO client version references from page script sources.
 * @param {string} scriptSource observed JavaScript / HTML
 * @returns {string[]} distinct version-ish tokens found
 */
export function extractClientVersions(scriptSource = '') {
  const src = String(scriptSource);
  const found = new Set();
  const re = /socket\.io(?:-client)?[@/](\d+\.\d+(?:\.\d+)?)/gi;
  let m;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  const cdn = /cdn[^"']*socket\.io[^"']*?(\d+\.\d+(?:\.\d+)?)[^"']*\.js/i.exec(src);
  if (cdn) found.add(cdn[1]);
  return [...found];
}

/**
 * Fingerprint the Socket.IO major version from script markers.
 * @param {string} scriptSource observed JavaScript / HTML
 * @returns {{label: string|null, major: number|null, confidence: string}}
 */
export function fingerprintVersion(scriptSource = '') {
  const src = String(scriptSource);
  for (const hint of SOCKET_IO_VERSION_HINTS) {
    if (hint.markers.some(re => re.test(src))) {
      return { label: hint.label, major: hint.min, confidence: 'medium' };
    }
  }
  const versions = extractClientVersions(src);
  if (versions.length) {
    const major = parseInt(versions[0].split('.')[0], 10);
    return { label: `Socket.IO v${major}.x`, major, confidence: 'high' };
  }
  const ioCall = /\bio\s*\(/.test(src) || /io\.connect\s*\(/.test(src);
  return {
    label: ioCall ? 'Socket.IO (version unknown)' : null,
    major: null,
    confidence: ioCall ? 'low' : 'none',
  };
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Analyze a Socket.IO handshake observation end to end.
 * @param {{scriptSource?: string, pollingPath?: string, upgradeObserved?: boolean}} obs
 * @returns {{version: object, transport: string, upgradePath: string|null, hardeningNotes: string[]}}
 */
export function analyzeHandshake({
  scriptSource = '',
  pollingPath = '',
  upgradeObserved = false,
} = {}) {
  const version = fingerprintVersion(scriptSource);
  const notes = [];
  let transport = 'polling';
  let upgradePath = null;
  if (upgradeObserved) {
    transport = 'websocket';
    upgradePath = pollingPath || null;
    notes.push('client upgrades from polling to WebSocket transport');
  } else if (pollingPath) {
    notes.push('long-polling transport observed; check upgrade path');
  }
  const versions = extractClientVersions(scriptSource);
  if (versions.length) {
    const v = versions[0];
    for (const range of VULNERABLE_RANGES) {
      if (compareVersions(v, range.max) <= 0) {
        notes.push(`OUTDATED: client ${v} — ${range.note}`);
        break;
      }
    }
  } else if (version.major !== null && version.major < 4) {
    notes.push(`major version v${version.major} is behind current v4 — recommend upgrade review`);
  }
  return { version, transport, upgradePath, hardeningNotes: notes };
}

export const SOCKET_IO_HANDSHAKE_ANALYZER = {
  extractClientVersions,
  fingerprintVersion,
  analyzeHandshake,
};

export default SOCKET_IO_HANDSHAKE_ANALYZER;
