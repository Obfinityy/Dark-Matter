/**
 * rdpNlaAnalyzer.js — RDP NLA handshake analyzer.
 *
 * Analyzes RDP connection-negotiation and CredSSP (NLA) handshake artifacts
 * captured from in-scope targets: the negotiated security protocol
 * (SSL/TLS vs CredSSP/NLA vs native RDP), CredSSP version, TLS cipher hints
 * and failure codes are used to fingerprint the Windows version and to
 * detect RDP gateways (RD Gateway) versus direct hosts.
 *
 * Offline analyzer: callers supply decoded negotiation fields. No network code.
 */

/** RDP negotiation response flags (from the server's negotiation response). */
export const NEGOTIATION_FLAGS = {
  0x00000001: 'EXTENDED_CLIENT_DATA_SUPPORTED',
  0x00000002: 'DYNVC_GFX_PROTOCOL_SUPPORTED',
  0x00000004: 'RESTRICTED_ADMIN_MODE_SUPPORTED',
  0x00000008: 'REDIRECTED_AUTHENTICATION_SUPPORTED',
};

/** Protocol requested/selected values. */
export const PROTOCOLS = {
  0x00000000: 'RDP (native, no enhanced security)',
  0x00000001: 'TLS/SSL',
  0x00000002: 'CredSSP (NLA)',
  0x00000003: 'TLS + CredSSP',
  0x00000008: 'EARLY_USER_AUTHORIZATION_RESULT_PDU (RDSTLS)',
};

/** CredSSP failure codes with OS hints. */
export const CREDSSP_FAILURE_HINTS = [
  { regex: /0x8009030[CE]/i, hint: 'SEC_E_* logon failure — host is live, credentials rejected' },
  {
    regex: /0x80004005/i,
    hint: 'E_FAIL during CredSSP — possible patched host rejecting the handshake',
  },
  { regex: /STATUS_LOGON_FAILURE|0xC000006D/i, hint: 'NTLM logon failure from the host' },
];

/** Windows version hints derived from negotiation behavior. */
export const OS_HINTS = [
  {
    match: r => r.restrictedAdminSupported === true,
    os: 'Windows 8.1 / Server 2012 R2 or newer',
    note: 'RESTRICTED_ADMIN_MODE_SUPPORTED flag',
  },
  {
    match: r => r.negotiatedProtocol === 'CredSSP (NLA)',
    os: 'Windows Vista / Server 2008 or newer',
    note: 'NLA offered',
  },
  {
    match: r => r.negotiatedProtocol === 'RDP (native, no enhanced security)',
    os: 'Legacy host (XP/2003 era) or NLA disabled',
    note: 'Native RDP only',
  },
  {
    match: r => r.negotiatedProtocol === 'EARLY_USER_AUTHORIZATION_RESULT_PDU (RDSTLS)',
    os: 'Windows 10 / Server 2016+ via RD Gateway',
    note: 'RDSTLS indicates gateway',
  },
];

/**
 * Decode an RDP negotiation response.
 *
 * @param {Object} resp - { type, flags, length, selectedProtocol, failureCode? }
 *   type: 1=TYPE_RDP_NEG_RSP, 2=TYPE_RDP_NEG_FAILURE
 * @returns {Object} decoded negotiation.
 */
export function decodeNegotiation(resp = {}) {
  const type = Number(resp.type || 0);
  if (type === 2) {
    return {
      success: false,
      failureCode: resp.failureCode ?? null,
      reason: `Negotiation failed (code ${resp.failureCode ?? 'unknown'})`,
    };
  }
  const flags = Number(resp.flags || 0);
  const decodedFlags = [];
  for (const [bit, name] of Object.entries(NEGOTIATION_FLAGS)) {
    if (flags & Number(bit)) decodedFlags.push(name);
  }
  const proto =
    PROTOCOLS[Number(resp.selectedProtocol)] ||
    `unknown_0x${Number(resp.selectedProtocol || 0).toString(16)}`;
  return {
    success: true,
    flags: decodedFlags,
    restrictedAdminSupported: decodedFlags.includes('RESTRICTED_ADMIN_MODE_SUPPORTED'),
    redirectedAuthSupported: decodedFlags.includes('REDIRECTED_AUTHENTICATION_SUPPORTED'),
    negotiatedProtocol: proto,
    negotiatedProtocolRaw: Number(resp.selectedProtocol || 0),
  };
}

/**
 * Analyze a full NLA handshake observation set.
 *
 * @param {Object} obs - { negotiation (see decodeNegotiation),
 *   credsspVersion?: number, tlsCipher?: string, nlaRequired?: boolean,
 *   gatewayDetected?: boolean, failureText?: string }
 * @returns {Object} fingerprint analysis.
 */
export function analyzeNlaHandshake(obs = {}) {
  const neg = decodeNegotiation(obs.negotiation || {});
  const evidence = [];
  const findings = { negotiation: neg };

  if (neg.success) {
    evidence.push(`Negotiated protocol: ${neg.negotiatedProtocol}`);
    if (neg.flags.length) evidence.push(`Negotiation flags: ${neg.flags.join(', ')}`);
  } else {
    evidence.push(neg.reason);
  }
  if (typeof obs.credsspVersion === 'number') {
    evidence.push(`CredSSP version: ${obs.credsspVersion}`);
    findings.credsspVersion = obs.credsspVersion;
  }
  if (obs.tlsCipher) {
    evidence.push(`TLS cipher: ${obs.tlsCipher}`);
    findings.tlsCipher = String(obs.tlsCipher);
  }

  const failureHints = [];
  const failureText = String(obs.failureText || '');
  for (const h of CREDSSP_FAILURE_HINTS) {
    if (h.regex.test(failureText)) failureHints.push(h.hint);
  }
  findings.credsspFailureHints = failureHints;

  const osCandidates = [];
  for (const h of OS_HINTS) {
    let ok = false;
    try {
      ok = h.match(neg);
    } catch {
      ok = false;
    }
    if (ok) osCandidates.push({ os: h.os, note: h.note });
  }

  const isGateway =
    !!obs.gatewayDetected ||
    neg.negotiatedProtocol.includes('RDSTLS') ||
    neg.redirectedAuthSupported;
  findings.isGateway = isGateway;
  findings.osCandidates = osCandidates;
  findings.nlaEnforced = neg.negotiatedProtocol.includes('CredSSP') || obs.nlaRequired === true;
  findings.evidence = evidence;

  findings.summary = neg.success
    ? `RDP negotiation: ${neg.negotiatedProtocol}${isGateway ? ' (RD Gateway suspected)' : ''}; NLA ${findings.nlaEnforced ? 'enforced' : 'not enforced'}.`
    : `RDP negotiation failed: ${neg.reason}.`;
  findings.type = 'RDP NLA Analysis';
  findings.confidence = neg.success ? (osCandidates.length ? 'high' : 'medium') : 'low';
  return findings;
}

export const RDP_NLA_ANALYZER = {
  NEGOTIATION_FLAGS,
  PROTOCOLS,
  CREDSSP_FAILURE_HINTS,
  decodeNegotiation,
  analyzeNlaHandshake,
};
export default RDP_NLA_ANALYZER;
