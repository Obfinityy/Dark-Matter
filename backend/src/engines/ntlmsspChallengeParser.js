/**
 * ntlmsspChallengeParser.js — NTLMSSP CHALLENGE_MESSAGE (Type 2) parser.
 *
 * NTLMSSP Type 2 challenge messages disclose the target name, negotiate
 * flags, and TargetInfo AV pairs (NetBIOS/DNS computer and domain names,
 * timestamps). An authorized agent parses these fields for OS and domain
 * hints — valuable for scoping and for flagging signing-not-required hosts.
 *
 * Defensive framing: analysis of observed challenge banners. The module
 * never performs authentication, relays, or credential extraction.
 */

/** NTLMSSP negotiate-flag bits (MS-NLMP). */
const NEGOTIATE_FLAGS = {
  0x00000001: 'NEGOTIATE_UNICODE',
  0x00000002: 'NEGOTIATE_OEM',
  0x00000004: 'REQUEST_TARGET',
  0x00000010: 'NEGOTIATE_SIGN',
  0x00000020: 'NEGOTIATE_SEAL',
  0x00000040: 'NEGOTIATE_DATAGRAM',
  0x00000080: 'NEGOTIATE_LM_KEY',
  0x00000400: 'NEGOTIATE_NTLM',
  0x00008000: 'NEGOTIATE_ALWAYS_SIGN',
  0x00010000: 'TARGET_TYPE_DOMAIN',
  0x00020000: 'TARGET_TYPE_SERVER',
  0x00040000: 'TARGET_TYPE_SHARE',
  0x00080000: 'NEGOTIATE_EXTENDED_SESSIONSECURITY',
  0x00100000: 'NEGOTIATE_IDENTIFY',
  0x00200000: 'REQUEST_NON_NT_SESSION_KEY',
  0x00400000: 'NEGOTIATE_TARGET_INFO',
  0x00800000: 'NEGOTIATE_VERSION',
  0x02000000: 'NEGOTIATE_128',
  0x04000000: 'NEGOTIATE_KEY_EXCH',
  0x08000000: 'NEGOTIATE_56',
};

/** AV_PAIR ids (MS-NLMP §2.2.2.1). */
const AV_PAIR_NAMES = {
  1: 'NbComputerName',
  2: 'NbDomainName',
  3: 'DnsComputerName',
  4: 'DnsDomainName',
  5: 'DnsTreeName',
  6: 'Flags',
  7: 'Timestamp',
  8: 'Restrictions',
  9: 'TargetName',
  10: 'ChannelBindings',
};

/**
 * Decode NTLMSSP negotiate flags into names.
 * @param {number} flags
 * @returns {string[]}
 */
export function decodeNegotiateFlags(flags = 0) {
  const names = [];
  for (const [bit, name] of Object.entries(NEGOTIATE_FLAGS)) {
    if (flags & Number(bit)) names.push(name);
  }
  return names;
}

/**
 * Parse an observed NTLMSSP CHALLENGE_MESSAGE.
 *
 * @param {Object} input
 * @param {string} [input.server] - Host observed.
 * @param {string} [input.targetName] - Target name string from the challenge.
 * @param {number} [input.negotiateFlags] - Negotiate flags field.
 * @param {Array<{id:number,value:string}>} [input.targetInfo] - Decoded AV_PAIR list.
 * @param {string} [input.osVersion] - OS version string (present when NEGOTIATE_VERSION set).
 * @returns {Object} Parsed hints finding.
 */
export function parseNtlmsspChallenge({
  server = '',
  targetName = '',
  negotiateFlags = 0,
  targetInfo = [],
  osVersion = '',
} = {}) {
  const flags = decodeNegotiateFlags(negotiateFlags);
  const pairs = {};
  for (const av of targetInfo) {
    const name = AV_PAIR_NAMES[av.id] || `AvId-${av.id}`;
    if (av.id !== 0) pairs[name] = av.value;
  }

  const domain = pairs.NbDomainName || pairs.DnsDomainName || targetName || '';
  const hostname = pairs.NbComputerName || pairs.DnsComputerName || '';
  const signingOffered =
    flags.includes('NEGOTIATE_SIGN') || flags.includes('NEGOTIATE_ALWAYS_SIGN');
  const extendedSecurity = flags.includes('NEGOTIATE_EXTENDED_SESSIONSECURITY');

  return {
    type: 'NTLMSSP Challenge Parsing',
    parsed: true,
    confidence: 'high',
    evidence: `NTLMSSP challenge at ${server || 'target'}: target="${targetName || 'n/a'}", domain="${domain || 'n/a'}", host="${hostname || 'n/a'}", ${flags.length} negotiate flag(s)${osVersion ? `, OS="${osVersion}"` : ''}.`,
    domain,
    hostname,
    osVersion: osVersion || undefined,
    negotiateFlags: flags,
    targetInfo: pairs,
    securityPosture: {
      signingOffered,
      extendedSessionSecurity: extendedSecurity,
      note: signingOffered
        ? 'Challenge offers message signing (host-side enforcement still requires SMB-level verification).'
        : 'Challenge does not offer NTLM message signing — host may accept unsigned NTLM.',
    },
  };
}

export const NTLMSSP_CHALLENGE_PARSER = {
  parseNtlmsspChallenge,
  decodeNegotiateFlags,
  NEGOTIATE_FLAGS,
  AV_PAIR_NAMES,
};
export default NTLMSSP_CHALLENGE_PARSER;
