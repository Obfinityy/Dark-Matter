/**
 * vncVersionParser.js — VNC/RFB handshake version and security-type parser (idea 00362).
 *
 * Parses a captured VNC handshake: the server's RFB version banner
 * (e.g. "RFB 003.008\n") and, for RFB 3.7+, the security-types message the
 * server sends. The version plus offered security types fingerprint the
 * server family and reveal dangerous configurations such as "None"
 * authentication.
 *
 * Offline analyzer: callers supply bytes/text observed on in-scope targets.
 * This module never opens VNC connections itself.
 */

/** Known RFB version banners and the server families that send them. */
export const RFB_VERSIONS = [
  {
    version: '3.3',
    banner: 'RFB 003.003',
    servers: ['AT&T VNC (original)', 'RealVNC 3.3.x', 'legacy embedded VNC'],
    note: 'RFB 3.3 has no security-types negotiation; single auth handshake follows.',
  },
  {
    version: '3.7',
    banner: 'RFB 003.007',
    servers: ['TightVNC 1.2.x', 'UltraVNC 1.0.x', 'early RFB 3.7 servers'],
    note: 'Introduces the security-types list message.',
  },
  {
    version: '3.8',
    banner: 'RFB 003.008',
    servers: [
      'RealVNC 4/5/6',
      'TightVNC 2.x',
      'TigerVNC',
      'UltraVNC 1.1+',
      'x11vnc',
      'QEMU VNC',
      'Vino (GNOME)',
    ],
    note: 'Most common modern banner; family disambiguation needs security-type hints.',
  },
  {
    version: '3.889',
    banner: 'RFB 003.889',
    servers: ['Apple Remote Desktop / macOS Screen Sharing'],
    note: 'Apple-proprietary banner; expect security type 30 (Apple auth) or Diffie-Hellman.',
  },
  {
    version: '4.0',
    banner: 'RFB 004.000',
    servers: ['Some embedded/IPMI VNC stacks'],
    note: 'Non-standard RFB 4.0 banner seen on BMC/IPMI implementations.',
  },
  {
    version: '4.1',
    banner: 'RFB 004.001',
    servers: ['Some embedded/IPMI VNC stacks'],
    note: 'Non-standard RFB 4.1 banner seen on BMC/IPMI implementations.',
  },
];

/** RFB security types (server → client security-types message). */
export const SECURITY_TYPES = {
  0: { name: 'Invalid', description: 'Server refuses the connection; reason string follows.' },
  1: { name: 'None', description: 'No authentication — session proceeds without credentials.' },
  2: { name: 'VNC Authentication', description: 'DES challenge-response with an 8-char password.' },
  5: { name: 'RA2', description: 'RealVNC RSA-AES (older).' },
  6: { name: 'RA2ne', description: 'RealVNC RSA-AES, no encryption variant.' },
  16: { name: 'Tight', description: 'TightVNC security-type tunneling.' },
  17: { name: 'Ultra', description: 'UltraVNC security-type tunneling.' },
  18: { name: 'TLS', description: 'TLS upgrade before authentication.' },
  19: { name: 'VeNCrypt', description: 'VeNCrypt TLS/plain tunneling (used by TigerVNC/x11vnc).' },
  20: { name: 'GTK-VNC SASL', description: 'SASL authentication (GTK-VNC).' },
  21: { name: 'MD5 hash', description: 'MD5 challenge (Apple pre-ARD).' },
  22: {
    name: 'x509None',
    description: 'VeNCrypt x509 with no auth — encrypted but unauthenticated.',
  },
  23: { name: 'x509Vnc', description: 'VeNCrypt x509 with VNC auth.' },
  24: { name: 'x509Plain', description: 'VeNCrypt x509 with plain auth.' },
  30: {
    name: 'Apple Authentication',
    description: 'Apple Remote Desktop Diffie-Hellman exchange.',
  },
};

/**
 * Parse an RFB version banner.
 * @param {string|Uint8Array|number[]} input e.g. "RFB 003.008\n".
 * @returns {{valid: boolean, version?: string, banner?: string, reason?: string}}
 */
export function parseRfbVersion(input) {
  let text = '';
  if (typeof input === 'string') text = input;
  else if (input && typeof input.length === 'number')
    text = String.fromCharCode(...Array.from(input).slice(0, 12));
  const m = /RFB\s+0*(\d+)\.0*(\d+)/.exec(text);
  if (!m) return { valid: false, reason: 'Not an RFB version banner' };
  const version = `${parseInt(m[1], 10)}.${parseInt(m[2], 10)}`;
  const known = RFB_VERSIONS.find(v => v.version === version);
  return { valid: true, version, banner: text.trim(), known: known || null };
}

/**
 * Decode a server security-types message payload (the bytes after the
 * count byte) into named security types.
 * @param {Uint8Array|number[]} bytes Security-type bytes (count byte optional).
 * @returns {Array<{code: number, name: string, description: string, known: boolean}>}
 */
export function parseSecurityTypes(bytes) {
  const arr = Array.from(bytes || []);
  if (arr.length === 0) return [];
  // RFB 3.7+: first byte is the count. Accept both with and without it.
  let list = arr;
  if (arr.length >= 2 && arr[0] === arr.length - 1) list = arr.slice(1);
  return list.map(code => {
    const known = SECURITY_TYPES[code];
    return known
      ? { code, name: known.name, description: known.description, known: true }
      : {
          code,
          name: `Unknown (${code})`,
          description: 'Unrecognized security type code.',
          known: false,
        };
  });
}

/**
 * Fingerprint a VNC server from its captured handshake.
 * @param {{versionBanner: string|Uint8Array|number[], securityTypeBytes?: Uint8Array|number[]}} obs
 * @returns {{version, servers, securityTypes, authRequired, findings, confidence}}
 */
export function fingerprintVncServer(obs = {}) {
  const findings = [];
  const version = parseRfbVersion(obs.versionBanner);
  if (!version.valid) {
    return {
      version,
      servers: [],
      securityTypes: [],
      authRequired: 'unknown',
      findings: ['No valid RFB banner captured.'],
      confidence: 'low',
    };
  }
  const servers = version.known ? version.known.servers : [];
  const securityTypes = parseSecurityTypes(obs.securityTypeBytes || []);
  let authRequired = 'unknown';
  let confidence = 'medium';

  findings.push(`RFB ${version.version} banner (${version.banner}).`);
  if (version.known) {
    findings.push(`Banner matches: ${servers.join(', ')}.`);
    if (version.version === '3.8') confidence = 'medium'; // banner alone is ambiguous across vendors
    if (version.version === '3.889') confidence = 'high';
  } else {
    findings.push(
      `Unrecognized RFB version ${version.version} — possibly a custom/embedded stack.`
    );
  }

  if (securityTypes.length > 0) {
    findings.push(
      `Server offers security types: ${securityTypes.map(s => `${s.code}=${s.name}`).join(', ')}.`
    );
    const noneAuth = securityTypes.some(s => s.code === 1);
    const invalid = securityTypes.some(s => s.code === 0);
    if (noneAuth) {
      authRequired = 'no';
      confidence = 'high';
      findings.push(
        'HIGH: security type "None" (1) is offered — the server permits unauthenticated sessions.'
      );
    } else if (invalid && securityTypes.length === 1) {
      authRequired = 'unknown';
      findings.push(
        'Server sent security type 0 (Invalid) — it refused the handshake; the reason string should be reviewed.'
      );
    } else {
      authRequired = 'yes';
      findings.push('Authentication is required (no "None" type offered).');
    }
    if (securityTypes.some(s => s.code === 2)) {
      findings.push(
        'Classic VNC challenge-response auth offered — 8-character DES password, brute-force sensitive.'
      );
    }
    if (securityTypes.some(s => [18, 19, 22, 23, 24].includes(s.code))) {
      findings.push('TLS-based security type offered — session can be encrypted.');
    }
  } else {
    findings.push(
      'No security-types message captured (expected for RFB 3.3, or handshake incomplete).'
    );
    if (version.version === '3.3') {
      findings.push(
        'RFB 3.3 negotiates a single security type next; capture it to confirm auth posture.'
      );
    }
  }

  return { version, servers, securityTypes, authRequired, findings, confidence };
}

export const VNC_VERSION_PARSER = {
  parseRfbVersion,
  parseSecurityTypes,
  fingerprintVncServer,
  RFB_VERSIONS,
  SECURITY_TYPES,
};
export default VNC_VERSION_PARSER;
