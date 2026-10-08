/**
 * dnssecRecon.js — DNSSEC zone-walking reconnaissance engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities built on DNSSEC authenticated denial:
 *  00009 NSEC zone-walk automation — walk DNSSEC-signed zones via NSEC chain
 *          traversal to enumerate every signed name without brute force.
 *  00010 NSEC3 hash-crack walking — collect NSEC3 hashes via iterative queries
 *          and crack them with optimized wordlists (opt-out-disabled zones).
 *
 * All traversal functions take an injected `lookup` callback, so the walking
 * algorithm is pure and fully testable: in production the caller wires it to
 * real DNS queries, in tests to a static map. The NSEC3 hash itself is
 * implemented per RFC 5158 using Node's built-in crypto (no dependencies).
 */

import crypto from 'node:crypto';

const BASE32HEX_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

/**
 * Encode a buffer with base32hex (RFC 4648 §7), uppercase, no padding —
 * the presentation format used for NSEC3 owner names.
 * @param {Buffer} buf
 * @returns {string}
 */
export function base32HexEncode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32HEX_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32HEX_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Canonical DNS wire format of a name: lowercase, length-prefixed labels,
 * root-terminated (RFC 4034 §6.1).
 * @param {string} name
 * @returns {Buffer}
 */
export function canonicalWire(name) {
  const labels = String(name).toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  const parts = labels.map(l => {
    const b = Buffer.from(l, 'utf8');
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

/**
 * NSEC3 hash of a domain name per RFC 5155 section 5:
 *   IH(salt, x, 0) = H(x || salt)
 *   IH(salt, x, k) = H(IH(salt, x, k-1) || salt)
 * where H is SHA-1 and x is the canonical wire form of the name.
 * @param {string} name domain name to hash
 * @param {{iterations?: number, salt?: string}} [params] salt as hex string (as in zone files)
 * @returns {string} base32hex hash, uppercase
 */
export function nsec3Hash(name, { iterations = 1, salt = '' } = {}) {
  const saltBuf = salt ? Buffer.from(String(salt), 'hex') : Buffer.alloc(0);
  let digest = crypto
    .createHash('sha1')
    .update(Buffer.concat([canonicalWire(name), saltBuf]))
    .digest();
  for (let i = 0; i < iterations; i++) {
    digest = crypto
      .createHash('sha1')
      .update(Buffer.concat([digest, saltBuf]))
      .digest();
  }
  return base32HexEncode(digest);
}

/**
 * Parse a textual NSEC record line (as printed by dig).
 * e.g. "a.example. 3600 IN NSEC b.example. A RRSIG NSEC"
 * @param {string} line
 * @returns {{owner: string, next: string, types: string[]}|null}
 */
export function parseNsecLine(line) {
  if (!line || typeof line !== 'string') return null;
  const tokens = line.trim().split(/\s+/);
  const nsecIdx = tokens.findIndex(t => t.toUpperCase() === 'NSEC');
  if (nsecIdx < 1) return null;
  const owner = tokens[0].toLowerCase();
  const next = (tokens[nsecIdx + 1] || '').toLowerCase().replace(/\.$/, '') + '.';
  const types = tokens.slice(nsecIdx + 2).map(t => t.toUpperCase());
  if (!next || next === '.') return null;
  return { owner: owner.replace(/\.$/, '') + '.', next, types };
}

/**
 * Parse a textual NSEC3 record line (as printed by dig).
 * e.g. "abc123.example. 3600 IN NSEC3 1 0 12 a1b2c3 def456 A RRSIG"
 * @param {string} line
 * @returns {{ownerHash: string, algorithm: number, flags: number, iterations: number, salt: string, nextHash: string, types: string[]}|null}
 */
export function parseNsec3Line(line) {
  if (!line || typeof line !== 'string') return null;
  const tokens = line.trim().split(/\s+/);
  const idx = tokens.findIndex(t => t.toUpperCase() === 'NSEC3');
  if (idx < 1 || tokens.length < idx + 6) return null;
  const ownerToken = tokens[0].toLowerCase();
  const ownerHash = ownerToken.split('.')[0].toUpperCase();
  return {
    ownerHash,
    algorithm: parseInt(tokens[idx + 1], 10),
    flags: parseInt(tokens[idx + 2], 10),
    iterations: parseInt(tokens[idx + 3], 10),
    salt: tokens[idx + 4] === '-' ? '' : tokens[idx + 4].toLowerCase(),
    nextHash: (tokens[idx + 5] || '').toUpperCase(),
    types: tokens.slice(idx + 6).map(t => t.toUpperCase()),
  };
}

/**
 * Whether an NSEC3 chain has opt-out enabled (opted-out names are invisible
 * to hash-crack walking — flag 1 means some insecure delegations are skipped).
 * @param {{flags: number}} nsec3rec parsed NSEC3 record or NSEC3PARAM fields
 * @returns {boolean}
 */
export function nsec3OptOut(nsec3rec) {
  return Boolean(nsec3rec && (nsec3rec.flags & 1) === 1);
}

/**
 * Build a lookup callback from a static record list (for tests and for
 * offline analysis of captured zone data).
 * @param {{owner: string, next: string, types?: string[]}[]} records NSEC records
 * @returns {(name: string) => ({owner: string, next: string, types: string[]}|null)}
 */
export function createNsecLookup(records) {
  const map = new Map();
  for (const r of records || []) {
    if (r && r.owner) map.set(r.owner.toLowerCase(), r);
  }
  return name => map.get(String(name).toLowerCase()) || null;
}

/**
 * Build a lookup callback over NSEC3 hashes from a static record list.
 * @param {{ownerHash: string, nextHash: string}[]} records
 * @returns {(hash: string) => ({ownerHash: string, nextHash: string}|null)}
 */
export function createNsec3Lookup(records) {
  const map = new Map();
  for (const r of records || []) {
    if (r && r.ownerHash) map.set(String(r.ownerHash).toUpperCase(), r);
  }
  return hash => map.get(String(hash).toUpperCase()) || null;
}

/**
 * Walk an NSEC chain from the zone apex (or any start name) to enumerate
 * every signed name — no brute force needed (idea 00009).
 *
 * The `lookup` callback answers "give me the NSEC record owned by `name`";
 * wire it to live DNS queries in production.
 *
 * @param {{start: string, lookup: (name: string) => ({owner: string, next: string}|null), maxHops?: number}} args
 * @returns {{names: string[], complete: boolean, hops: number, reason: string}}
 */
export function walkNsecZone({ start, lookup, maxHops = 100000 }) {
  const names = [];
  const seen = new Set();
  let current = String(start).toLowerCase();
  let hops = 0;
  if (typeof lookup !== 'function') {
    return { names, complete: false, hops, reason: 'no lookup function provided' };
  }
  const startKey = current;
  for (;;) {
    if (hops >= maxHops) return { names, complete: false, hops, reason: 'maxHops exceeded' };
    const rec = lookup(current);
    if (!rec || !rec.next) {
      return { names, complete: false, hops, reason: `chain broken at ${current}` };
    }
    const ownerKey = String(rec.owner || current).toLowerCase();
    if (seen.has(ownerKey) && ownerKey !== startKey) {
      return { names, complete: false, hops, reason: `loop detected at ${ownerKey}` };
    }
    seen.add(ownerKey);
    names.push(rec.owner || current);
    hops++;
    const nextKey = String(rec.next).toLowerCase();
    if (nextKey === startKey) {
      return { names, complete: true, hops, reason: 'chain closed back to start' };
    }
    if (seen.has(nextKey)) {
      return { names, complete: false, hops, reason: `loop detected at ${nextKey}` };
    }
    current = nextKey;
  }
}

/**
 * Walk an NSEC3 chain over hashed owner names (idea 00010). Returns the
 * hashes in chain order; feed them to crackNsec3Hashes to recover names.
 * @param {{startHash: string, lookup: (hash: string) => ({ownerHash: string, nextHash: string}|null), maxHops?: number}} args
 * @returns {{hashes: string[], complete: boolean, hops: number, reason: string}}
 */
export function walkNsec3Zone({ startHash, lookup, maxHops = 100000 }) {
  const hashes = [];
  const seen = new Set();
  let current = String(startHash).toUpperCase();
  let hops = 0;
  if (typeof lookup !== 'function') {
    return { hashes, complete: false, hops, reason: 'no lookup function provided' };
  }
  const startKey = current;
  for (;;) {
    if (hops >= maxHops) return { hashes, complete: false, hops, reason: 'maxHops exceeded' };
    const rec = lookup(current);
    if (!rec || !rec.nextHash) {
      return { hashes, complete: false, hops, reason: `chain broken at ${current}` };
    }
    const ownerKey = String(rec.ownerHash || current).toUpperCase();
    if (seen.has(ownerKey) && ownerKey !== startKey) {
      return { hashes, complete: false, hops, reason: `loop detected at ${ownerKey}` };
    }
    seen.add(ownerKey);
    hashes.push(rec.ownerHash || current);
    hops++;
    const nextKey = String(rec.nextHash).toUpperCase();
    if (nextKey === startKey) {
      return { hashes, complete: true, hops, reason: 'chain closed back to start' };
    }
    if (seen.has(nextKey)) {
      return { hashes, complete: false, hops, reason: `loop detected at ${nextKey}` };
    }
    current = nextKey;
  }
}

/**
 * Crack collected NSEC3 hashes against a wordlist (idea 00010). Each
 * wordlist entry is tried as-is and qualified with the zone apex.
 * Optimized: every candidate is hashed exactly once.
 * @param {{ownerHash: string, nextHash?: string}[]} records collected NSEC3 records
 * @param {string[]} wordlist candidate labels / names
 * @param {{iterations?: number, salt?: string, zone?: string}} params NSEC3 params + zone apex
 * @returns {{hash: string, name: string, position: 'owner'|'next'}[]} recovered names
 */
export function crackNsec3Hashes(records, wordlist, params = {}) {
  if (!Array.isArray(records) || !Array.isArray(wordlist)) return [];
  const { iterations = 1, salt = '', zone = '' } = params;
  const zoneApex = String(zone).toLowerCase().replace(/\.$/, '');
  // Hash every candidate once.
  const hashToName = new Map();
  for (const raw of wordlist) {
    const w = String(raw).toLowerCase().trim().replace(/\.$/, '');
    if (!w) continue;
    const candidates = w.includes('.') ? [w] : [w, ...(zoneApex ? [`${w}.${zoneApex}`] : [])];
    for (const cand of candidates) {
      const h = nsec3Hash(cand, { iterations, salt });
      if (!hashToName.has(h)) hashToName.set(h, cand);
    }
  }
  const found = [];
  const seenPairs = new Set();
  for (const r of records) {
    if (!r) continue;
    for (const position of ['owner', 'next']) {
      const key = position === 'owner' ? 'ownerHash' : 'nextHash';
      const h = r[key] ? String(r[key]).toUpperCase() : '';
      if (!h || !hashToName.has(h)) continue;
      const pair = `${h}:${position}`;
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      found.push({ hash: h, name: hashToName.get(h), position });
    }
  }
  return found;
}

/**
 * Summary statistics for an enumerated name list.
 * @param {string[]} names
 * @param {string} [zone] zone apex, e.g. "example.com"
 * @returns {{total: number, apexSeen: boolean, byDepth: Record<number, number>}}
 */
export function zoneWalkStats(names, zone = '') {
  const apex = String(zone).toLowerCase().replace(/\.$/, '');
  const byDepth = {};
  let apexSeen = false;
  for (const n of names || []) {
    const name = String(n).toLowerCase().replace(/\.$/, '');
    if (apex && name === apex) apexSeen = true;
    const depth = name.split('.').length;
    byDepth[depth] = (byDepth[depth] || 0) + 1;
  }
  return { total: (names || []).length, apexSeen, byDepth };
}

export const DNSSEC_RECON = {
  base32HexEncode,
  canonicalWire,
  nsec3Hash,
  parseNsecLine,
  parseNsec3Line,
  nsec3OptOut,
  createNsecLookup,
  createNsec3Lookup,
  walkNsecZone,
  walkNsec3Zone,
  crackNsec3Hashes,
  zoneWalkStats,
};

export default DNSSEC_RECON;
