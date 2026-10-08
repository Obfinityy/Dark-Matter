/**
 * smbSigningMapper.js — SMB signing-requirement mapper.
 *
 * SMB signing (required vs enabled) is advertised in the negotiate response
 * (SMB1 security mode bits; SMB2/3 SECURITY_MODE flags) and in the NTLMSSP
 * negotiate flags. Hosts that do not require signing are relay-vulnerable.
 * An authorized agent maps signing posture across observed hosts.
 *
 * Defensive framing: analysis of protocol banners observed during an
 * authorized assessment. The module performs no relaying or exploitation.
 */

/** SMB2+ SECURITY_MODE bits (MS-SMB2 §2.2.4). */
const SMB2_SECURITY_MODES = {
  0x01: 'SMB2_NEGOTIATE_SIGNING_ENABLED',
  0x02: 'SMB2_NEGOTIATE_SIGNING_REQUIRED',
};

/**
 * Decode an SMB2/3 negotiate SECURITY_MODE field.
 * @param {number} securityMode
 * @returns {{enabled:boolean,required:boolean,flags:string[]}}
 */
export function decodeSmb2SecurityMode(securityMode = 0) {
  const flags = [];
  for (const [bit, name] of Object.entries(SMB2_SECURITY_MODES)) {
    if (securityMode & Number(bit)) flags.push(name);
  }
  return {
    enabled: !!(securityMode & 0x01),
    required: !!(securityMode & 0x02),
    flags,
  };
}

/**
 * Decode SMB1 security-mode byte (MS-CIFS).
 * @param {number} securityMode - SMB1 negotiate SecurityMode byte.
 * @returns {{signaturesEnabled:boolean,signaturesRequired:boolean}}
 */
export function decodeSmb1SecurityMode(securityMode = 0) {
  return {
    signaturesEnabled: !!(securityMode & 0x04),
    signaturesRequired: !!(securityMode & 0x08),
  };
}

/**
 * Classify one host's SMB signing posture from observed negotiate data.
 *
 * @param {Object} input
 * @param {string} [input.server] - Host observed.
 * @param {string} [input.dialect] - Negotiated dialect ('SMB1', 'SMB2', 'SMB3', ...).
 * @param {number} [input.securityMode] - Raw security-mode field value.
 * @param {boolean} [input.guestAllowed] - Whether guest sessions were offered.
 * @returns {Object} Per-host signing classification.
 */
export function classifySmbSigning({
  server = '',
  dialect = '',
  securityMode = 0,
  guestAllowed = false,
} = {}) {
  const isSmb1 = /^smb1?$/i.test(dialect.replace(/[\s.]/g, ''));
  const decoded = isSmb1
    ? decodeSmb1SecurityMode(securityMode)
    : decodeSmb2SecurityMode(securityMode);
  const enabled = decoded.signaturesEnabled ?? decoded.enabled;
  const required = decoded.signaturesRequired ?? decoded.required;

  let posture = 'unknown';
  let severity;
  let cwe;
  if (required) {
    posture = 'signing-required';
  } else if (enabled) {
    posture = 'signing-enabled-not-required';
    severity = 'Medium';
    cwe = 'CWE-319';
  } else {
    posture = 'signing-disabled';
    severity = 'Medium';
    cwe = 'CWE-319';
  }

  return {
    type: 'SMB Signing Requirement Mapping',
    server: server || 'unknown',
    dialect: dialect || 'unknown',
    signingEnabled: enabled,
    signingRequired: required,
    posture,
    confidence: 'high',
    severity,
    cwe,
    evidence: `${server || 'target'} (${dialect || 'unknown dialect'}): signing ${required ? 'REQUIRED' : enabled ? 'enabled but NOT required' : 'DISABLED'}${guestAllowed ? '; guest sessions offered' : ''}.`,
    relayRisk: !required,
    guestAllowed,
  };
}

/**
 * Map signing posture across many hosts.
 * @param {Array<Object>} observations - Per-host classifySmbSigning inputs.
 * @returns {Object} Aggregate signing map with relay-risk list.
 */
export function mapSmbSigning(observations = []) {
  const hosts = observations.map(o => classifySmbSigning(o));
  const atRisk = hosts.filter(h => h.relayRisk).map(h => h.server);
  return {
    type: 'SMB Signing Requirement Map',
    confidence: 'high',
    hostCount: hosts.length,
    required: hosts.filter(h => h.signingRequired).length,
    notRequired: atRisk.length,
    relayRiskHosts: atRisk,
    hosts,
    evidence: `${atRisk.length}/${hosts.length} host(s) do not require SMB signing and are exposed to relay-style attacks: ${atRisk.join(', ') || 'none'}.`,
  };
}

export const SMB_SIGNING_MAPPER = {
  classifySmbSigning,
  mapSmbSigning,
  decodeSmb2SecurityMode,
  decodeSmb1SecurityMode,
};
export default SMB_SIGNING_MAPPER;
