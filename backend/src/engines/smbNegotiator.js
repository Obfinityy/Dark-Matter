/**
 * smbNegotiator.js — SMB protocol-negotiation fingerprinting analyzer.
 *
 * Analyzes SMB dialect negotiation artifacts from in-scope targets: the
 * offered dialect list in an SMB2 NEGOTIATE request, the server's chosen
 * dialect in the NEGOTIATE response, and capability flags. The chosen
 * dialect plus capability bits distinguish Samba from Windows and give a
 * version-range estimate (e.g. SMB 3.1.1 + encryption required → modern
 * Windows Server; dialect 2.1 only → Windows 7 / Server 2008 R2).
 *
 * Offline analyzer: callers supply decoded negotiation fields.
 */

/** SMB2/SMB3 dialect codes. */
export const SMB_DIALECTS = {
  0x0202: 'SMB 2.0.2',
  0x0210: 'SMB 2.1',
  0x0300: 'SMB 3.0',
  0x0302: 'SMB 3.0.2',
  0x0311: 'SMB 3.1.1',
};

/** SMB2 NEGOTIATE response capability flags. */
export const SMB_CAPABILITIES = {
  0x00000001: 'DFS',
  0x00000002: 'LEASING',
  0x00000004: 'LARGE_MTU',
  0x00000008: 'MULTI_CHANNEL',
  0x00000010: 'PERSISTENT_HANDLES',
  0x00000020: 'DIRECTORY_LEASING',
  0x00000040: 'ENCRYPTION',
};

/** Security mode flags in the NEGOTIATE response. */
export const SMB_SECURITY_MODES = {
  0x01: 'SIGNING_ENABLED',
  0x02: 'SIGNING_REQUIRED',
};

/**
 * Decode the dialect revision into a human name.
 * @param {number} dialect
 */
export function dialectName(dialect) {
  return (
    SMB_DIALECTS[Number(dialect)] ||
    `unknown_0x${Number(dialect || 0)
      .toString(16)
      .padStart(4, '0')}`
  );
}

/**
 * Decode a capability bitmask.
 * @param {number} caps
 */
export function decodeCapabilities(caps) {
  const out = [];
  for (const [bit, name] of Object.entries(SMB_CAPABILITIES)) {
    if (Number(caps || 0) & Number(bit)) out.push(name);
  }
  return out;
}

/**
 * Fingerprint the SMB server from a negotiation response.
 *
 * @param {Object} resp - { dialect (number), capabilities (number),
 *   securityMode (number), serverGuid?, offeredDialects?: number[],
 *   maxTransactSize?, nativeOs?, nativeLanman? }
 * @returns {Object} fingerprint.
 */
export function fingerprintSmbNegotiation(resp = {}) {
  const dialect = Number(resp.dialect || 0);
  const capabilities = decodeCapabilities(resp.capabilities);
  const dialectLabel = dialectName(dialect);
  const offered = (resp.offeredDialects || []).map(dialectName);
  const securityMode = Number(resp.securityMode || 0);
  const securityFlags = [];
  for (const [bit, name] of Object.entries(SMB_SECURITY_MODES)) {
    if (securityMode & Number(bit)) securityFlags.push(name);
  }

  const evidence = [
    `Server chose dialect ${dialectLabel} (0x${dialect.toString(16).padStart(4, '0')})`,
  ];
  if (offered.length) evidence.push(`Client offered: ${offered.join(', ')}`);
  if (capabilities.length) evidence.push(`Capabilities: ${capabilities.join(', ')}`);
  evidence.push(`Security mode: ${securityFlags.join(' | ') || 'none'}`);

  const candidates = [];

  // Dialect-based OS hints.
  if (dialect === 0x0311) {
    candidates.push({
      os: 'Windows 10 / Server 2016+ or Samba 4.x (4.5+)',
      note: 'SMB 3.1.1 requires a modern stack',
      confidence: 'medium',
    });
  } else if (dialect === 0x0300 || dialect === 0x0302) {
    candidates.push({
      os: 'Windows 8 / Server 2012(+R2) or Samba 4.x',
      note: 'SMB 3.0/3.0.2 era',
      confidence: 'medium',
    });
  } else if (dialect === 0x0210) {
    candidates.push({
      os: 'Windows 7 / Server 2008 R2',
      note: 'SMB 2.1 maximum suggests legacy Windows',
      confidence: 'medium',
    });
  } else if (dialect === 0x0202) {
    candidates.push({
      os: 'Windows Vista / Server 2008 or very old Samba',
      note: 'SMB 2.0.2 only',
      confidence: 'medium',
    });
  }

  // Capability-based family hints.
  if (capabilities.includes('MULTI_CHANNEL') && capabilities.includes('ENCRYPTION')) {
    candidates.push({
      os: 'Windows (Server 2012+)',
      note: 'MULTI_CHANNEL + ENCRYPTION is a Windows-typical combo',
      confidence: 'low',
    });
  }
  const nativeOs = String(resp.nativeOs || '');
  const nativeLanman = String(resp.nativeLanman || '');
  if (/samba/i.test(nativeOs) || /samba/i.test(nativeLanman)) {
    const ver = (nativeOs + ' ' + nativeLanman).match(/samba\s+([\d.]+)/i);
    candidates.unshift({
      os: `Samba${ver ? ' ' + ver[1] : ''}`,
      note: `Native OS string: ${nativeOs || nativeLanman}`,
      confidence: 'high',
    });
  } else if (/windows/i.test(nativeOs) || /windows/i.test(nativeLanman)) {
    candidates.unshift({
      os: `Windows (${nativeOs || nativeLanman})`,
      note: 'Native OS string',
      confidence: 'high',
    });
  }

  const signingRequired = securityFlags.includes('SIGNING_REQUIRED');
  const encryptionCapable = capabilities.includes('ENCRYPTION');

  return {
    dialect: dialectLabel,
    dialectHex: `0x${dialect.toString(16).padStart(4, '0')}`,
    offeredDialects: offered,
    capabilities,
    securityFlags,
    signingRequired,
    encryptionCapable,
    candidates,
    evidence,
    summary: candidates.length
      ? `SMB negotiation indicates: ${candidates.map(c => `${c.os} (${c.confidence})`).join('; ')}.`
      : `SMB dialect ${dialectLabel} negotiated; no firm OS identification.`,
    type: 'SMB Negotiation Fingerprint',
    confidence: candidates.some(c => c.confidence === 'high')
      ? 'high'
      : candidates.length
        ? 'medium'
        : 'low',
  };
}

export const SMB_NEGOTIATOR = {
  SMB_DIALECTS,
  SMB_CAPABILITIES,
  SMB_SECURITY_MODES,
  dialectName,
  decodeCapabilities,
  fingerprintSmbNegotiation,
};
export default SMB_NEGOTIATOR;
