/**
 * lookingGlassIntel.js — BGP looking-glass output mining for prefix sweeps.
 *
 * Implements Dark-Matter idea-bank item 00133 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00133 BGP looking-glass prefix sweep — query public looking glasses for
 *      the target's prefixes and sweep announced-but-unscanned space.
 *
 * Operators run `show bgp` / `show ip bgp <prefix>` on public looking
 * glasses and paste or fetch the output. This engine parses that output
 * (plus plain prefix lists) into canonical announced-prefix records with
 * origin AS, AS path, next-hops, and covering/announced relationships, then
 * diffs the announced set against the prefixes the team has already
 * scanned — the remainder is "announced-but-unscanned space" to queue.
 *
 * All functions are pure and side-effect free: they parse supplied text
 * and supplied prefix lists. No network I/O happens in this module.
 */

/**
 * Normalise a prefix string ("10.0.0.0/8", "2001:db8::/32") for comparison.
 * Returns null for unparsable input.
 * @param {string} p
 * @returns {string|null}
 */
export function normalisePrefix(p) {
  const m = /^\s*([0-9a-fA-F.:]+)\/(\d{1,3})\s*$/.exec(String(p || ''));
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
}

/**
 * Extract prefix-like tokens from an arbitrary looking-glass output blob.
 * @param {string} text
 * @returns {string[]} unique normalised prefixes in order of appearance
 */
export function extractPrefixes(text) {
  const seen = new Set();
  const out = [];
  const re = /\b([0-9]{1,3}(?:\.[0-9]{1,3}){3})\/(\d{1,2})\b|\b([0-9a-fA-F:]{2,39})\/(\d{1,3})\b/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const prefix = m[1] ? `${m[1]}/${m[2]}` : `${m[3].toLowerCase()}/${m[4]}`;
    const norm = normalisePrefix(prefix);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * Parse per-prefix BGP route detail lines of the common looking-glass
 * form: "PREFIX via NEXT-HOP, as-path [..], origin i". Tolerates partial
 * lines: any single signal still yields a record with defaults.
 * @param {string} text
 * @returns {Array<{prefix: string, nextHops: string[], asPath: number[], originAs: number|null, bestPath: boolean}>}
 */
export function parseBgpRoutes(text) {
  const records = new Map();
  const ensure = prefix => {
    if (!records.has(prefix)) {
      records.set(prefix, {
        prefix,
        nextHops: new Set(),
        asPath: [],
        originAs: null,
        bestPath: false,
      });
    }
    return records.get(prefix);
  };
  for (const line of String(text || '').split(/\r?\n/)) {
    const prefixes = extractPrefixes(line);
    if (prefixes.length === 0) continue;
    for (const prefix of prefixes) {
      const rec = ensure(prefix);
      const nh = /\bvia\s+([0-9a-fA-F.:]+)/i.exec(line);
      if (nh && nh[1]) rec.nextHops.add(nh[1].toLowerCase());
      const path =
        /\bas-?path\s+\[([0-9\s,]+)\]/i.exec(line) || /(?:^|\s)(\d+(?:\s+\d+){1,})\s*$/.exec(line);
      if (path && path[1]) {
        const hops = path[1]
          .split(/[\s,]+/)
          .map(Number)
          .filter(n => Number.isFinite(n));
        if (hops.length > 0) {
          rec.asPath = hops;
          rec.originAs = hops[hops.length - 1];
        }
      }
      const origin = /\borigin\s+(?:as)?(\d+)/i.exec(line);
      if (origin && origin[1]) rec.originAs = Number(origin[1]);
      if (/^\s*[*>]?\s*[a-z]?\s*[0-9a-fA-F.:]+\//.test(line) || /\bbest\b/i.test(line))
        rec.bestPath = true;
    }
  }
  return [...records.values()].map(r => ({ ...r, nextHops: [...r.nextHops] }));
}

/**
 * Check whether `inner` (prefix string) is fully contained inside `outer`.
 * @param {string} inner
 * @param {string} outer
 * @returns {boolean}
 */
export function prefixContains(outer, inner) {
  const [oAddr, oLen] = String(outer).split('/');
  const [iAddr, iLen] = String(inner).split('/');
  const oBits = BigInt(oLen || 0);
  const iBits = BigInt(iLen || 0);
  if (iBits < oBits) return false;
  const toBig = addr => {
    if (addr.includes(':')) {
      const expanded = expandIpv6(addr);
      return expanded.split(':').reduce((acc, h) => (acc << 16n) + BigInt(parseInt(h, 16)), 0n);
    }
    return addr.split('.').reduce((acc, o) => (acc << 8n) + BigInt(Number(o)), 0n);
  };
  const mask = (bits, total) => ((1n << bits) - 1n) << (total - bits);
  const oTotal = oAddr.includes(':') ? 128n : 32n;
  if (oAddr.includes(':') !== iAddr.includes(':')) return false;
  try {
    return (toBig(iAddr) & mask(oBits, oTotal)) === (toBig(oAddr) & mask(oBits, oTotal));
  } catch {
    return false;
  }
}

/** Expand a compressed IPv6 address to eight full hextets. */
function expandIpv6(addr) {
  const [head, tail] = addr.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const missing = 8 - h.length - t.length;
  return [...h, ...Array(missing).fill('0'), ...t].map(x => x.padStart(4, '0')).join(':');
}

/**
 * Diff announced prefixes against the set the team has already scanned.
 * A scanned prefix counts as covering an announced one when the scanned
 * prefix is equal-or-larger. Returns announced-but-unscanned space.
 * @param {string[]} announcedPrefixes
 * @param {string[]} scannedPrefixes
 * @returns {{unscanned: string[], covered: string[], coveragePct: number}}
 */
export function diffAnnouncedVsScanned(announcedPrefixes, scannedPrefixes) {
  const announced = [...new Set((announcedPrefixes || []).map(normalisePrefix).filter(Boolean))];
  const scanned = [...new Set((scannedPrefixes || []).map(normalisePrefix).filter(Boolean))];
  const unscanned = [];
  const covered = [];
  for (const a of announced) {
    if (scanned.some(s => s === a || prefixContains(s, a))) covered.push(a);
    else unscanned.push(a);
  }
  const coveragePct =
    announced.length === 0 ? 100 : Math.round((covered.length / announced.length) * 1000) / 10;
  return { unscanned, covered, coveragePct };
}

/**
 * Aggregate BGP route records into a per-origin-AS prefix inventory —
 * the sweep queue seed for the target's announced space.
 * @param {Array<{prefix: string, originAs: number|null}>} routes
 * @returns {Array<{asn: number|null, prefixes: string[], count: number}>}
 */
export function inventoryByOriginAs(routes) {
  const byAs = new Map();
  for (const r of routes || []) {
    const key = r.originAs ?? 'unknown';
    if (!byAs.has(key)) byAs.set(key, new Set());
    byAs.get(key).add(r.prefix);
  }
  return [...byAs.entries()]
    .map(([asn, set]) => ({
      asn: asn === 'unknown' ? null : asn,
      prefixes: [...set].sort(),
      count: set.size,
    }))
    .sort((a, b) => b.count - a.count);
}

export const LOOKING_GLASS_INTEL = {
  normalisePrefix,
  extractPrefixes,
  parseBgpRoutes,
  prefixContains,
  diffAnnouncedVsScanned,
  inventoryByOriginAs,
};
export default LOOKING_GLASS_INTEL;
