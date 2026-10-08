/**
 * tacacsPlusDetector.js — TACACS+ service detector via header analysis.
 *
 * TACACS+ uses a distinctive 12-byte packet header (major/minor version,
 * packet type, session id, length) followed by an MD5-obfuscated body.
 * An authorized agent can identify TACACS+ endpoints by parsing an
 * observed header — this module analyzes captured header fields and
 * reports service presence, packet type, and protocol version.
 *
 * Defensive framing: analysis of observed banner/protocol data only.
 * Body de-obfuscation requires the shared secret, which this module
 * never derives, requests, or stores.
 */

const TACACS_PACKET_TYPES = {
  0x01: 'AUTHEN',
  0x02: 'AUTHOR',
  0x03: 'ACCT',
};

/**
 * Analyze an observed 12-byte TACACS+ header.
 *
 * @param {Object} input
 * @param {number} input.majorVersion - Header major version (TAC_PLUS_MAJOR_VER = 0xC = 12).
 * @param {number} input.minorVersion - Header minor version (0 = RFC 8907, 1 = drafts).
 * @param {number} input.packetType - Packet type byte (1=AUTHEN, 2=AUTHOR, 3=ACCT).
 * @param {number} input.sessionId - Session identifier (random 32-bit value).
 * @param {number} input.bodyLength - Declared body length.
 * @param {string} [input.server] - Host observed.
 * @returns {Object} Finding describing TACACS+ detection.
 */
export function analyzeTacacsHeader({
  majorVersion = 0,
  minorVersion = 0,
  packetType = 0,
  sessionId = 0,
  bodyLength = 0,
  server = '',
} = {}) {
  const typeName = TACACS_PACKET_TYPES[packetType];

  if (majorVersion !== 0x0c) {
    return {
      type: 'TACACS+ Version Detection',
      detected: false,
      confidence: 'low',
      evidence: `Major version ${majorVersion} does not match TACACS+ major version 12 — not a TACACS+ header.`,
    };
  }

  const minorMeaning =
    minorVersion === 0
      ? 'RFC 8907 compliant'
      : minorVersion === 1
        ? 'legacy draft-11/12'
        : `unknown minor version ${minorVersion}`;

  return {
    type: 'TACACS+ Version Detection',
    detected: true,
    confidence: 'high',
    evidence: `TACACS+ header at ${server || 'target'}: major=12, minor=${minorVersion} (${minorMeaning}), packet=${typeName || `unknown(0x${packetType.toString(16)})`}, session=${sessionId.toString(16)}, bodyLen=${bodyLength}.`,
    protocol: 'TACACS+',
    version: `12.${minorVersion}`,
    packetType: typeName || 'unknown',
    sessionId: `0x${sessionId.toString(16)}`,
    bodyLength,
    exposureNote:
      minorVersion !== 0
        ? 'Non-standard minor version — likely legacy implementation with weaker defaults.'
        : undefined,
  };
}

/**
 * Decide whether observed header bytes plausibly belong to TACACS+.
 * Useful for classifying unknown banner bytes from a port scan.
 *
 * @param {number[]} headerBytes - Up to 12 observed header bytes.
 * @returns {Object} Plausibility verdict.
 */
export function classifyHeaderBytes(headerBytes = []) {
  if (!Array.isArray(headerBytes) || headerBytes.length < 4) {
    return { plausible: false, reason: 'Fewer than 4 header bytes — insufficient to classify.' };
  }
  const [major, minor, , , seqNo] = headerBytes;
  const majorOk = major === 0x0c;
  const typeOk = [0x01, 0x02, 0x03].includes(headerBytes[2]);
  const minorOk = minor === 0 || minor === 1;
  const plausible = majorOk && typeOk && minorOk;
  return {
    plausible,
    confidence: plausible ? 'high' : 'medium',
    reason: plausible
      ? `Bytes match TACACS+ header shape (major=12, type=0x${headerBytes[2].toString(16)}, minor=${minor}, seq=${seqNo}).`
      : `Header bytes do not match TACACS+ shape (major=${major}, type=${headerBytes[2]}).`,
  };
}

export const TACACS_PLUS_DETECTOR = {
  analyzeTacacsHeader,
  classifyHeaderBytes,
  TACACS_PACKET_TYPES,
};
export default TACACS_PLUS_DETECTOR;
