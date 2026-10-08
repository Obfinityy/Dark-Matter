/**
 * faviconId.js — MurmurHash3 favicon hashing for service identification.
 *
 * Services often expose a default favicon even when banners are stripped.
 * Shodan's well-known technique hashes the base64-encoded favicon with
 * MurmurHash3 (x86_32, seed 31) and looks the hash up in a service-ID
 * database. This module implements MurmurHash3 from scratch (pure JS, no
 * dependencies), hashes favicon byte content, and matches against a
 * built-in + user-extensible signature registry.
 * Pure analysis: takes already-fetched favicon bytes as input, no network I/O.
 */

/**
 * MurmurHash3 x86_32, seed 31 — the exact variant Shodan uses for
 * http.favicon.hash over the base64-encoded favicon body.
 *
 * @param {Uint8Array|string} data - bytes (or string, UTF-8 encoded) to hash
 * @param {number} [seed=31] - hash seed
 * @returns {number} signed 32-bit hash
 */
export function murmurHash3(data, seed = 31) {
  let bytes;
  if (typeof data === 'string') {
    bytes = Buffer.from(data, 'utf8');
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (Buffer.isBuffer(data)) {
    bytes = data;
  } else {
    throw new TypeError('murmurHash3 expects a string, Uint8Array or Buffer');
  }

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h1 = seed >>> 0;
  const len = bytes.length;
  const nblocks = Math.floor(len / 4);

  for (let i = 0; i < nblocks; i++) {
    let k1 =
      bytes[i * 4] | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  let k1 = 0;
  const tail = nblocks * 4;
  switch (len & 3) {
    case 3:
      k1 ^= bytes[tail + 2] << 16; // falls through
    case 2:
      k1 ^= bytes[tail + 1] << 8; // falls through
    case 1:
      k1 ^= bytes[tail];
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  return h1 | 0; // signed 32-bit, like Shodan's http.favicon.hash
}

/**
 * Hash favicon bytes the way Shodan does: MurmurHash3 over the
 * base64-encoded body.
 *
 * @param {Uint8Array|Buffer|string} bytes - raw favicon content
 * @returns {number} signed 32-bit hash
 */
export function hashFavicon(bytes) {
  let buf;
  if (typeof bytes === 'string') buf = Buffer.from(bytes, 'utf8');
  else if (bytes instanceof Uint8Array) buf = Buffer.from(bytes);
  else if (Buffer.isBuffer(bytes)) buf = bytes;
  else throw new TypeError('hashFavicon expects bytes');
  return murmurHash3(buf.toString('base64'), 31);
}

/**
 * Starter signature registry: MurmurHash3 → service identity.
 * These are widely documented public examples; extend with
 * registerFaviconSignature() for your own corpus.
 */
const REGISTRY = new Map([
  // Jenkins default favicon — one of the most widely documented Shodan favicon hashes.
  [116323821, { service: 'Jenkins', category: 'CI/CD', confidence: 'high' }],
]);

/**
 * Register (or override) a favicon signature.
 * @param {number} hash - signed 32-bit MurmurHash3
 * @param {Object} info - { service, category, confidence, note }
 */
export function registerFaviconSignature(hash, info) {
  REGISTRY.set(Number(hash), { confidence: 'medium', ...info });
}

/** List all registered signatures. */
export function listSignatures() {
  return [...REGISTRY.entries()].map(([hash, info]) => ({ hash, ...info }));
}

/**
 * Identify a service from favicon bytes via the signature registry.
 *
 * @param {Uint8Array|Buffer|string} bytes - raw favicon content
 * @returns {{hash: number, identified: boolean, service: string|null, category: string|null, confidence: string, note: string}}
 */
export function identifyService(bytes) {
  const hash = hashFavicon(bytes);
  const hit = REGISTRY.get(hash);
  if (hit) {
    return {
      hash,
      identified: true,
      service: hit.service,
      category: hit.category || null,
      confidence: hit.confidence || 'medium',
      note: hit.note || `Favicon hash ${hash} matches known ${hit.service} signature.`,
    };
  }
  return {
    hash,
    identified: false,
    service: null,
    category: null,
    confidence: 'low',
    note: `Favicon hash ${hash} not in registry — candidate for manual review or corpus extension.`,
  };
}

export const FAVICON_ID = {
  murmurHash3,
  hashFavicon,
  identifyService,
  registerFaviconSignature,
  listSignatures,
};
export default FAVICON_ID;
