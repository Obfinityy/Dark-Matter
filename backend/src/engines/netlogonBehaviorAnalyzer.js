/**
 * netlogonBehaviorAnalyzer.js — Netlogon RPC behavior analyzer.
 *
 * The Netlogon RPC interface (\\.\pipe\netlogon) is used by DCs for secure
 * channel negotiation. Observed negotiation flags, secure-channel types,
 * and RPC endpoint responses let an authorized agent fingerprint domain
 * controllers and flag legacy Netlogon configurations.
 *
 * Defensive framing: analysis of observed RPC negotiation metadata from an
 * authorized assessment. No secure-channel setup or credential material.
 */

/** Netlogon secure-channel types (MS-NRPC). */
const SECURE_CHANNEL_TYPES = {
  2: 'Workstation', 4: 'Server', 6: 'DomainController',
};

/** Notable Netlogon negotiate flags (MS-NRPC §3.1.4.2). */
const NEGOTIATE_FLAGS = {
  0x00000001: 'NETLOGON_NEG_AUTHENTICATED_RPC',
  0x00000020: 'NETLOGON_NEG_128BIT',
  0x00000040: 'NETLOGON_NEG_SEAL',
  0x00000080: 'NETLOGON_NEG_SIGN',
  0x00000100: 'NETLOGON_NEG_STRONGKEY',
  0x00000400: 'NETLOGON_NEG_SCHANNEL',
  0x00020000: 'NETLOGON_NEG_2SKEY',
  0x00400000: 'NETLOGON_NEG_TRANSITIVE_TRUSTS',
  0x04000000: 'NETLOGON_NEG_AES_SHA2',
  0x10000000: 'NETLOGON_NEG_AVOID_NT4EMUL',
};

/**
 * Decode Netlogon negotiate flags.
 * @param {number} flags
 * @returns {string[]}
 */
export function decodeNetlogonFlags(flags = 0) {
  const names = [];
  for (const [bit, name] of Object.entries(NEGOTIATE_FLAGS)) {
    if (flags & Number(bit)) names.push(name);
  }
  return names;
}

/**
 * Analyze observed Netlogon negotiation behavior.
 *
 * @param {Object} input
 * @param {string} [input.server] - Host observed.
 * @param {boolean} [input.pipeReachable] - Whether \\.\pipe\netlogon answered.
 * @param {number} [input.negotiateFlags] - Negotiate flags observed.
 * @param {number} [input.secureChannelType] - Secure-channel type observed.
 * @param {string} [input.domainName] - Domain name echoed in negotiation.
 * @returns {Object} DC fingerprint finding.
 */
export function analyzeNetlogonBehavior({
  server = '',
  pipeReachable = false,
  negotiateFlags = 0,
  secureChannelType = 0,
  domainName = '',
} = {}) {
  if (!pipeReachable) {
    return {
      type: 'Netlogon Behavior Analysis',
      fingerprinted: false,
      confidence: 'medium',
      evidence: `Netlogon pipe on ${server || 'target'} not reachable — no behavior to analyze.`,
    };
  }

  const flags = decodeNetlogonFlags(negotiateFlags);
  const channelType = SECURE_CHANNEL_TYPES[secureChannelType] || `unknown(${secureChannelType})`;
  const modernCrypto = flags.includes('NETLOGON_NEG_AES_SHA2');
  const strongKey = flags.includes('NETLOGON_NEG_STRONGKEY') || flags.includes('NETLOGON_NEG_128BIT');

  const findings = [];
  if (!modernCrypto) {
    findings.push({
      type: 'Netlogon Behavior Analysis',
      severity: 'Medium',
      confidence: 'high',
      cwe: 'CWE-327',
      evidence: `DC at ${server || 'target'} negotiates Netlogon without AES-SHA2 — legacy crypto on the secure channel (Zerologon-era hardening missing).`,
    });
  }
  if (!flags.includes('NETLOGON_NEG_SIGN') && !flags.includes('NETLOGON_NEG_SEAL')) {
    findings.push({
      type: 'Netlogon Behavior Analysis',
      severity: 'Low',
      confidence: 'medium',
      evidence: `DC at ${server || 'target'} does not advertise Netlogon sign/seal flags — channel integrity may be unenforced.`,
    });
  }

  return {
    type: 'Netlogon Behavior Analysis',
    fingerprinted: true,
    confidence: 'high',
    evidence: `Netlogon endpoint on ${server || 'target'} behaves as a domain controller: secure-channel type=${channelType}, ${flags.length} negotiate flag(s)${domainName ? `, domain="${domainName}"` : ''}.`,
    secureChannelType: channelType,
    negotiateFlags: flags,
    domainName: domainName || undefined,
    cryptoPosture: { modernCrypto, strongKey },
    findings,
  };
}

export const NETLOGON_BEHAVIOR_ANALYZER = {
  analyzeNetlogonBehavior,
  decodeNetlogonFlags,
  SECURE_CHANNEL_TYPES,
  NEGOTIATE_FLAGS,
};
export default NETLOGON_BEHAVIOR_ANALYZER;
