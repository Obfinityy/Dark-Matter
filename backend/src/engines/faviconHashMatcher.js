/**
 * faviconHashMatcher.js — lookalike favicon detection engine.
 *
 * @idea 0312 — Lookalike favicon detection: find phishing sites copying the
 *   target's favicon via hash search to catch live impersonation.
 *
 * Pure functions only: callers fetch favicon bytes themselves (respecting
 * provider rate limits) and pass them in. No live HTTP here.
 *
 * The hash used is murmur3_x86_32 of the base64-encoded favicon — compatible
 * with the favicon hash convention used by public asset-search engines, so
 * a caller can cross-reference their scan results.
 */

const MASK32 = 0xffffffff;

function rotl32(v, r) {
  return ((v << r) | (v >>> (32 - r))) >>> 0;
}

function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Pure-JS murmur3_x86_32 (seed 0) over a byte array.
 * @param {Uint8Array|Buffer|number[]} bytes
 * @returns {number} unsigned 32-bit hash
 */
export function murmur3x86_32(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  const len = buf.length;
  let h1 = 0;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  const nblocks = Math.floor(len / 4);
  for (let i = 0; i < nblocks; i++) {
    let k1 = (buf[i * 4] | (buf[i * 4 + 1] << 8) | (buf[i * 4 + 2] << 16) | (buf[i * 4 + 3] << 24)) >>> 0;
    k1 = Math.imul(k1, c1);
    k1 = rotl32(k1, 15);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = rotl32(h1, 13);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  let k1 = 0;
  const tail = len & 3;
  if (tail >= 3) k1 ^= buf[nblocks * 4 + 2] << 16;
  if (tail >= 2) k1 ^= buf[nblocks * 4 + 1] << 8;
  if (tail >= 1) {
    k1 ^= buf[nblocks * 4];
    k1 = Math.imul(k1, c1);
    k1 = rotl32(k1, 15);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
  }

  h1 ^= len;
  return fmix32(h1);
}

/**
 * Shodan-style favicon hash: murmur3_x86_32 over the UTF-8 bytes of the
 * base64-encoded favicon text, returned as a signed 32-bit integer
 * (their published convention).
 * @param {string} base64 base64-encoded favicon bytes
 * @returns {number} signed 32-bit hash
 */
export function shodanFaviconHash(base64) {
  const bytes = Buffer.from(String(base64 || ''), 'utf8');
  const unsigned = murmur3x86_32(bytes);
  return unsigned >= 0x80000000 ? unsigned - 0x100000000 : unsigned;
}

/**
 * Compute the favicon hash directly from raw bytes.
 * @param {Uint8Array|Buffer} bytes
 * @returns {number} signed 32-bit favicon hash
 */
export function faviconHashFromBytes(bytes) {
  return shodanFaviconHash(Buffer.from(bytes || []).toString('base64'));
}

/**
 * Compare two favicon hashes; returns a similarity score 0–100.
 * Exact match = 100. Distance on the hash ring degrades the score.
 * @param {number} hashA
 * @param {number} hashB
 * @returns {number}
 */
export function faviconHashSimilarity(hashA, hashB) {
  if (hashA === hashB) return 100;
  const xor = ((hashA >>> 0) ^ (hashB >>> 0)) >>> 0;
  let bits = 0;
  let x = xor;
  while (x) {
    x &= x - 1;
    bits++;
  }
  return Math.round(Math.max(0, 100 - bits * 3.2));
}

/**
 * Find candidate sites whose favicon matches the target's favicon.
 * @param {number} targetHash signed favicon hash of the legitimate site
 * @param {{domain: string, hash: number, source?: string}[]} candidates scanned favicon records
 * @param {object} [opts]
 * @param {number} [opts.minSimilarity=95] minimum similarity to report
 * @param {string[]} [opts.knownLegit=[]] domains known to legitimately share the icon (CDN, parent org)
 * @returns {{domain: string, hash: number, source: string, similarity: number, verdict: string}[]}
 */
export function findFaviconLookalikes(targetHash, candidates = [], opts = {}) {
  const { minSimilarity = 95, knownLegit = [] } = opts || {};
  const legit = new Set((knownLegit || []).map((d) => String(d || '').toLowerCase()));
  const results = [];

  for (const c of candidates || []) {
    const domain = String(c?.domain || '').toLowerCase();
    if (!domain) continue;
    const sim = faviconHashSimilarity(targetHash, Number(c?.hash));
    if (sim < minSimilarity) continue;
    const verdict =
      sim === 100
        ? legit.has(domain)
          ? 'identical (known legitimate sharing)'
          : 'IDENTICAL favicon — likely live impersonation'
        : 'near-identical favicon — possible impersonation';
    results.push({ domain, hash: Number(c?.hash), source: String(c?.source || ''), similarity: sim, verdict });
  }
  return results.sort((a, b) => b.similarity - a.similarity || a.domain.localeCompare(b.domain));
}

/**
 * Hash a batch of raw favicon fetch results into comparable records.
 * @param {{domain: string, bytes: Uint8Array|Buffer, source?: string}[]} fetches
 * @returns {{domain: string, hash: number, source: string}[]}
 */
export function hashFaviconBatch(fetches = []) {
  return (fetches || [])
    .map((f) => ({
      domain: String(f?.domain || '').toLowerCase(),
      hash: faviconHashFromBytes(f?.bytes),
      source: String(f?.source || 'direct'),
    }))
    .filter((r) => r.domain && Number.isFinite(r.hash));
}
