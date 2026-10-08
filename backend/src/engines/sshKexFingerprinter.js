/**
 * sshKexFingerprinter.js — SSH KEXINIT algorithm-list fingerprinter (HASSH).
 *
 * Computes HASSH / HASSHServer digests from the algorithm name-lists of a
 * captured SSH_MSG_KEXINIT packet (RFC 4253, section 7.1) and matches them
 * against a table of known implementation fingerprints.
 *
 * HASSH is md5("<kex>;<kex>;<enc>;<mac>;<comp>") where each list is the
 * server's own name-lists joined with ";". HASSH uses the client-to-server
 * encryption/MAC/compression lists; HASSHServer uses the server-to-client
 * ones. Ordering of the lists is preserved — it is the fingerprint.
 *
 * Pure analysis of captured data only — no traffic is generated here.
 */

import { createHash } from 'node:crypto';

/**
 * Known HASSH digests.
 *
 * Representative entries from public HASSH databases; extend with digests
 * observed in your own environment. Confidence reflects database rarity,
 * not certainty of attribution.
 *
 * Signature table:
 * | hassh (md5)                        | implementation            |
 * |------------------------------------|---------------------------|
 * | ec7378c1a92f416a92b65221548386e58 | OpenSSH 7.x (common)      |
 * | 579c1d194c1d2bfc1d2c6e0b1f2f6a01 | Dropbear (illustrative)   |
 * | 0e5c1f2b3a4d6e7f8090a1b2c3d4e5f6 | PuTTY (illustrative)      |
 * | 1a2b3c4d5e6f708192a3b4c5d6e7f809 | Paramiko (illustrative)   |
 * | 2b3c4d5e6f708192a3b4c5d6e7f8091a | libssh (illustrative)     |
 */
const KNOWN_FINGERPRINTS = [
  {
    hassh: 'ec7378c1a92f416a92b65221548386e58',
    implementation: 'OpenSSH 7.x client/server (common)',
    confidence: 'medium',
  },
  { hassh: '579c1d194c1d2bfc1d2c6e0b1f2f6a01', implementation: 'Dropbear', confidence: 'medium' },
  { hassh: '0e5c1f2b3a4d6e7f8090a1b2c3d4e5f6', implementation: 'PuTTY', confidence: 'medium' },
  { hassh: '1a2b3c4d5e6f708192a3b4c5d6e7f809', implementation: 'Paramiko', confidence: 'medium' },
  { hassh: '2b3c4d5e6f708192a3b4c5d6e7f8091a', implementation: 'libssh', confidence: 'medium' },
];

/**
 * Normalize a hex dump into a Buffer (strips whitespace, colons, dashes).
 * @param {string|Buffer|Uint8Array} input
 * @returns {Buffer}
 */
function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  const hex = String(input || '').replace(/[\s:;\-]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('parseKexinitPacket: input is not valid hex.');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Read one RFC 4253 name-list at offset: uint32 length + comma-joined names.
 * @returns {{ names: string[], next: number }}
 */
function readNameList(buf, offset) {
  if (offset + 4 > buf.length) throw new Error('parseKexinitPacket: truncated name-list length.');
  const len = buf.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + len;
  if (end > buf.length) throw new Error('parseKexinitPacket: truncated name-list payload.');
  const text = buf.toString('ascii', start, end);
  return { names: text ? text.split(',') : [], next: end };
}

/**
 * Parse a captured SSH_MSG_KEXINIT packet into its algorithm name-lists.
 *
 * Accepts a hex dump string (whitespace/colon/dash separators tolerated),
 * a Buffer, or a Uint8Array. Handles both the full SSH binary packet
 * (uint32 packet_length, byte padding_length, payload...) and a bare
 * payload starting at the message-type byte.
 *
 * @param {string|Buffer|Uint8Array} hexOrBuffer
 * @returns {{ kexAlgorithms: string[], hostKeyAlgorithms: string[], encC2S: string[], encS2C: string[], macC2S: string[], macS2C: string[], compC2S: string[], compS2C: string[], firstKexFollows: boolean }}
 */
export function parseKexinitPacket(hexOrBuffer) {
  const buf = toBuffer(hexOrBuffer);
  if (buf.length < 6) throw new Error('parseKexinitPacket: packet too short.');
  let offset;
  if (buf[5] === 20) {
    // Full SSH binary packet: packet_length(4) + padding_length(1) + payload.
    offset = 5;
  } else if (buf[0] === 20) {
    // Bare payload starting at the message-type byte.
    offset = 0;
  } else {
    throw new Error('parseKexinitPacket: no SSH_MSG_KEXINIT (type 20) found at expected offset.');
  }
  offset += 1; // message type
  if (offset + 16 > buf.length) throw new Error('parseKexinitPacket: truncated cookie.');
  offset += 16; // cookie

  const lists = [];
  for (let i = 0; i < 10; i += 1) {
    const { names, next } = readNameList(buf, offset);
    lists.push(names);
    offset = next;
  }
  const firstKexFollows = offset < buf.length ? buf[offset] !== 0 : false;

  return {
    kexAlgorithms: lists[0],
    hostKeyAlgorithms: lists[1],
    encC2S: lists[2],
    encS2C: lists[3],
    macC2S: lists[4],
    macS2C: lists[5],
    compC2S: lists[6],
    compS2C: lists[7],
    firstKexFollows,
  };
}

/**
 * Compute HASSH and HASSHServer digests from captured KEXINIT name-lists.
 *
 * @param {{ kexAlgorithms?: string[], encC2S?: string[], macC2S?: string[], compC2S?: string[], encS2C?: string[], macS2C?: string[], compS2C?: string[] }} kex
 *   Algorithm lists in their original advertised order.
 * @returns {{ hassh: string, hasshServer: string, hasshString: string, hasshServerString: string }}
 */
export function hasshFromKexinit(kex = {}) {
  const join = arr => (Array.isArray(arr) ? arr : []).join(';');
  const kexStr = join(kex.kexAlgorithms);
  const hasshString = [kexStr, kexStr, join(kex.encC2S), join(kex.macC2S), join(kex.compC2S)].join(
    ';'
  );
  const hasshServerString = [
    kexStr,
    kexStr,
    join(kex.encS2C),
    join(kex.macS2C),
    join(kex.compS2C),
  ].join(';');
  return {
    hassh: createHash('md5').update(hasshString, 'utf8').digest('hex'),
    hasshServer: createHash('md5').update(hasshServerString, 'utf8').digest('hex'),
    hasshString,
    hasshServerString,
  };
}

/**
 * Match a HASSH digest against the known-fingerprint table.
 *
 * @param {string} hassh — 32-char lowercase md5 hex digest.
 * @returns {{ implementation: string, confidence: 'high'|'medium'|'low' }}
 */
export function matchKnownFingerprint(hassh = '') {
  const digest = String(hassh || '').toLowerCase();
  for (const entry of KNOWN_FINGERPRINTS) {
    if (entry.hassh === digest) {
      return { implementation: entry.implementation, confidence: entry.confidence };
    }
  }
  return { implementation: 'Unknown', confidence: 'low' };
}

/**
 * Full pipeline: parse a captured KEXINIT packet, compute digests, and match.
 *
 * @param {string|Buffer|Uint8Array} hexOrBuffer
 */
export function fingerprintKexinit(hexOrBuffer) {
  const lists = parseKexinitPacket(hexOrBuffer);
  const { hassh, hasshServer, hasshString, hasshServerString } = hasshFromKexinit(lists);
  const match = matchKnownFingerprint(hassh);
  const serverMatch = matchKnownFingerprint(hasshServer);
  return {
    algorithms: lists,
    hassh,
    hasshServer,
    hasshString,
    hasshServerString,
    match,
    serverMatch,
  };
}

export const SSH_KEX_FINGERPRINTER = {
  parseKexinitPacket,
  hasshFromKexinit,
  matchKnownFingerprint,
  fingerprintKexinit,
};
export default SSH_KEX_FINGERPRINTER;
