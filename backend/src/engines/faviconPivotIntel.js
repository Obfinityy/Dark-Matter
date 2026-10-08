/**
 * faviconPivotIntel.js — Favicon-hash pivoting engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities that pivot on favicon hashes
 * (Shodan-style `http.favicon.hash` semantics) to find cloned or related
 * services inside a target's netblocks and across its ASN. Covers idea-bank
 * items 00049–00050:
 *
 *  00049 Favicon-hash netblock pivoting
 *  00050 Favicon-hash ASN-wide search
 *
 * All functions are pure and side-effect free: they hash favicon bytes and
 * match caller-supplied index entries (e.g. Shodan search results the caller
 * fetched legally during an authorized engagement). Network scanning and
 * index queries are intentionally left to the caller so the engine stays
 * testable and safe to run anywhere.
 */

/**
 * MurmurHash3 (x86, 32-bit) — the same algorithm Shodan uses for
 * `http.favicon.hash`. Operates on a UTF-8 string or byte array.
 *
 * @param {string|Uint8Array|number[]} data
 * @param {number} [seed]
 * @returns {number} Signed 32-bit hash, matching Shodan's convention.
 */
export function murmur3x86_32(data, seed = 0) {
  let bytes;
  if (typeof data === 'string') bytes = new TextEncoder().encode(data);
  else if (data instanceof Uint8Array) bytes = data;
  else bytes = Uint8Array.from(data);

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h1 = seed >>> 0;
  const len = bytes.length;
  const nblocks = Math.floor(len / 4);

  for (let i = 0; i < nblocks; i++) {
    let k1 =
      (bytes[i * 4] |
        (bytes[i * 4 + 1] << 8) |
        (bytes[i * 4 + 2] << 16) |
        (bytes[i * 4 + 3] << 24)) >>>
      0;
    k1 = Math.imul(k1, c1);
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0;
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  let k1 = 0;
  const tail = len & 3;
  if (tail === 3) k1 ^= bytes[nblocks * 4 + 2] << 16;
  if (tail >= 2) k1 ^= bytes[nblocks * 4 + 1] << 8;
  if (tail >= 1) {
    k1 ^= bytes[nblocks * 4];
    k1 = Math.imul(k1, c1);
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  return h1 | 0;
}

/**
 * Compute the Shodan-compatible favicon hash of raw favicon bytes
 * (idea 00049).
 *
 * @param {string|Uint8Array|number[]} faviconBytes Raw bytes of the .ico/.png.
 * @returns {number} Signed 32-bit hash usable in `http.favicon.hash:<n>` queries.
 */
export function faviconHash(faviconBytes) {
  return murmur3x86_32(faviconBytes, 0);
}

/**
 * Normalize a favicon-hash index entry from common shapes
 * (Shodan API rows, CSV rows, plain objects).
 *
 * @param {object} entry
 * @returns {{ip: string|null, hash: number|null, asn: string|null, hostnames: string[], port: number|null, org: string|null}}
 */
export function normalizeIndexEntry(entry) {
  if (!entry || typeof entry !== 'object')
    return { ip: null, hash: null, asn: null, hostnames: [], port: null, org: null };
  const hashRaw = entry.hash ?? entry.favicon_hash ?? entry['http.favicon.hash'];
  const hash = hashRaw === null || hashRaw === undefined || hashRaw === '' ? null : Number(hashRaw);
  const hostnames = Array.isArray(entry.hostnames)
    ? entry.hostnames.filter(h => typeof h === 'string')
    : typeof entry.hostname === 'string'
      ? [entry.hostname]
      : [];
  return {
    ip:
      typeof entry.ip === 'string'
        ? entry.ip
        : typeof entry.ip_str === 'string'
          ? entry.ip_str
          : null,
    hash: Number.isFinite(hash) ? hash : null,
    asn: entry.asn != null ? String(entry.asn) : null,
    hostnames,
    port: entry.port != null ? Number(entry.port) : null,
    org: typeof entry.org === 'string' ? entry.org : null,
  };
}

/**
 * Search a favicon-hash index for entries matching the target's hash
 * (idea 00049/00050 core matcher).
 *
 * @param {number} targetHash
 * @param {object[]} indexEntries Raw index rows (normalized internally).
 * @param {{excludeIps?: string[]}} [opts]
 * @returns {ReturnType<normalizeIndexEntry>[]} Matching entries, target IPs excluded.
 */
export function matchFaviconHash(targetHash, indexEntries, opts = {}) {
  const exclude = new Set(opts.excludeIps || []);
  const out = [];
  for (const raw of indexEntries || []) {
    const e = normalizeIndexEntry(raw);
    if (e.hash === null || e.hash !== targetHash) continue;
    if (e.ip && exclude.has(e.ip)) continue;
    out.push(e);
  }
  return out.sort((a, b) => (a.ip || '').localeCompare(b.ip || '', undefined, { numeric: true }));
}

/**
 * Pivot inside the target's own netblocks (idea 00049): given the target's
 * favicon hash, scan-result entries and the target's CIDRs, find cloned or
 * related services.
 *
 * @param {number} targetHash
 * @param {object[]} indexEntries Raw index rows for hosts inside the netblocks.
 * @param {string[]} netblocks CIDRs belonging to the target.
 * @param {{excludeIps?: string[]}} [opts]
 * @returns {{matches: ReturnType<normalizeIndexEntry>[], byNetblock: {netblock: string, count: number, ips: string[]}[]}}
 */
export function pivotNetblock(targetHash, indexEntries, netblocks, opts = {}) {
  const matches = matchFaviconHash(targetHash, indexEntries, opts);
  const inBlock = matches.filter(
    e =>
      e.ip &&
      (netblocks || []).some(cidr => {
        const m = cidr.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
        if (!m) return false;
        const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0) >>> 0;
        const bits = Number(m[2]);
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        const n = toInt(e.ip);
        const net = (toInt(m[1]) & mask) >>> 0;
        return n >= net && n <= (net | (~mask >>> 0)) >>> 0;
      })
  );
  const byNetblock = (netblocks || [])
    .map(netblock => {
      const ips = inBlock
        .filter(e => {
          const m = netblock.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
          if (!m) return false;
          const toInt = ip => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0) >>> 0;
          const bits = Number(m[2]);
          const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
          const n = toInt(e.ip);
          const net = (toInt(m[1]) & mask) >>> 0;
          return n >= net && n <= (net | (~mask >>> 0)) >>> 0;
        })
        .map(e => e.ip);
      return { netblock, count: ips.length, ips };
    })
    .filter(g => g.count > 0);
  return { matches: inBlock, byNetblock };
}

/**
 * Search across the target's whole ASN for same-branded infrastructure
 * outside known domains (idea 00050).
 *
 * @param {number} targetHash
 * @param {object[]} indexEntries Raw index rows across the ASN.
 * @param {string|string[]} targetAsns The target's ASN(s), e.g. "AS15169".
 * @param {{knownHostnames?: string[], excludeIps?: string[]}} [opts]
 * @returns {{inAsn: ReturnType<normalizeIndexEntry>[], newInfrastructure: ReturnType<normalizeIndexEntry>[], asnSummary: {asn: string, count: number}[]}}
 */
export function searchAsnWide(targetHash, indexEntries, targetAsns, opts = {}) {
  const asns = new Set(
    (Array.isArray(targetAsns) ? targetAsns : [targetAsns]).map(a =>
      String(a).replace(/^as/i, '').toLowerCase()
    )
  );
  const known = new Set((opts.knownHostnames || []).map(h => h.toLowerCase()));
  const matches = matchFaviconHash(targetHash, indexEntries, opts);
  const inAsn = matches.filter(e => e.asn && asns.has(e.asn.replace(/^as/i, '').toLowerCase()));
  const newInfrastructure = inAsn.filter(e => !e.hostnames.some(h => known.has(h.toLowerCase())));
  const byAsn = new Map();
  for (const e of inAsn) {
    const cur = byAsn.get(e.asn) || { asn: e.asn, count: 0 };
    cur.count++;
    byAsn.set(e.asn, cur);
  }
  return {
    inAsn,
    newInfrastructure,
    asnSummary: [...byAsn.values()].sort((a, b) => b.count - a.count),
  };
}

/**
 * Build a human-readable pivot report from netblock + ASN findings.
 *
 * @param {{matches?: object[], byNetblock?: object[]}} netblockResult
 * @param {{newInfrastructure?: object[], asnSummary?: object[]}} asnResult
 * @returns {{totalRelatedHosts: number, netblockHits: number, asnHits: number, newInfrastructureCount: number, summary: string}}
 */
export function faviconPivotReport(netblockResult = {}, asnResult = {}) {
  const netblockHits = (netblockResult.matches || []).length;
  const asnHits = (asnResult.newInfrastructure || []).length;
  const total = netblockHits + asnHits;
  const summary =
    total === 0
      ? 'No related infrastructure found via favicon-hash pivoting.'
      : `Favicon-hash pivoting found ${total} related host(s): ${netblockHits} inside target netblocks, ${asnHits} new same-branded host(s) elsewhere in the target ASN.`;
  return {
    totalRelatedHosts: total,
    netblockHits,
    asnHits,
    newInfrastructureCount: asnHits,
    summary,
  };
}

export default {
  murmur3x86_32,
  faviconHash,
  normalizeIndexEntry,
  matchFaviconHash,
  pivotNetblock,
  searchAsnWide,
  faviconPivotReport,
};
