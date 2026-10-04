/**
 * bgpPrefixTreeIntel.js — BGP prefix-tree expansion engine.
 *
 * Implements idea-bank item 00188 (BGP.he.net prefix-tree expansion): take
 * the target's announced BGP prefixes, build a prefix tree, and expand into
 * child prefixes (more-specifics and sibling allocations within the same
 * parent) so sweep coverage never stops at a single announced block. Attack
 * surface frequently hides in adjacent prefixes the organization owns but
 * never advertises prominently.
 *
 * Pure functions: the caller supplies prefix/ASN facts (e.g. parsed from
 * BGP.he.net or any BGP looking glass). CIDR math is implemented inline —
 * no dependencies.
 */

/**
 * @typedef {object} BgpPrefix
 * @property {string} prefix   CIDR, e.g. '203.0.113.0/24'
 * @property {string|number} asn
 * @property {string} [origin] optional origin/AS name
 */

/**
 * Convert an IPv4 dotted quad to a 32-bit integer.
 * @param {string} ip
 * @returns {number|null}
 */
export function ipToInt(ip) {
  const parts = String(ip).trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = n * 256 + b;
  }
  return n >>> 0;
}

/**
 * Parse a CIDR string into {network, mask} ints.
 * @param {string} cidr
 * @returns {{network: number, mask: number}|null}
 */
export function parseCidr(cidr) {
  const [ip, maskStr] = String(cidr).trim().split('/');
  const mask = Number(maskStr);
  const base = ipToInt(ip);
  if (base === null || !Number.isInteger(mask) || mask < 0 || mask > 32) return null;
  const maskInt = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1)) >>> 0;
  return { network: (base & maskInt) >>> 0, mask };
}

/**
 * Check whether `inner` CIDR is contained within `outer` CIDR.
 * @param {string} inner
 * @param {string} outer
 * @returns {boolean}
 */
export function cidrContains(inner, outer) {
  const i = parseCidr(inner);
  const o = parseCidr(outer);
  if (!i || !o || o.mask > i.mask) return false;
  const shift = 32 - o.mask;
  return (i.network >>> shift) === (o.network >>> shift);
}

/**
 * Build a prefix tree (parent → children) from announced prefixes.
 * @param {BgpPrefix[]} prefixes
 * @returns {{roots: Array<{prefix: string, asn: string|number, children: string[]}>, orphans: BgpPrefix[]}}
 */
export function buildPrefixTree(prefixes) {
  const parsed = (prefixes ?? [])
    .map((p) => ({ ...p, cidr: parseCidr(p.prefix) }))
    .filter((p) => p.cidr);
  const parents = new Map();
  const orphans = [];

  for (const p of parsed) {
    let best = null;
    for (const other of parsed) {
      if (other === p) continue;
      if (other.cidr.mask < p.cidr.mask && cidrContains(p.prefix, other.prefix)) {
        if (!best || other.cidr.mask > best.cidr.mask) best = other;
      }
    }
    if (best) {
      const list = parents.get(best.prefix) ?? [];
      list.push(p.prefix);
      parents.set(best.prefix, list);
    } else {
      orphans.push(p);
    }
  }

  const roots = orphans.map((o) => ({
    prefix: o.prefix,
    asn: o.asn,
    children: (parents.get(o.prefix) ?? []).sort(),
  }));
  return { roots, orphans: orphans.map(({ prefix, asn }) => ({ prefix, asn })) };
}

/**
 * Expand each announced prefix into child sweep targets: split it down to
 * `childMask` blocks so adjacent more-specific space gets covered. Returns
 * child CIDRs grouped under their parent.
 * @param {BgpPrefix[]} prefixes
 * @param {object} [opts]
 * @param {number} [opts.childMask=24]   split parents down to this mask
 * @param {number} [opts.maxChildren=256] hard cap per parent
 * @returns {Array<{parent: string, asn: string|number, children: string[]}>}
 */
export function expandPrefixTree(prefixes, opts = {}) {
  const childMask = opts.childMask ?? 24;
  const maxChildren = opts.maxChildren ?? 256;
  const out = [];

  for (const p of prefixes ?? []) {
    const parsed = parseCidr(p.prefix);
    if (!parsed || parsed.mask >= childMask) continue;
    const count = Math.min(2 ** (childMask - parsed.mask), maxChildren);
    const step = 2 ** (32 - childMask);
    const children = [];
    for (let i = 0; i < count; i += 1) {
      const net = (parsed.network + i * step) >>> 0;
      const dotted = [3, 2, 1, 0].map((s) => (net >>> (s * 8)) & 255).join('.');
      children.push(`${dotted}/${childMask}`);
    }
    out.push({ parent: p.prefix, asn: p.asn, children });
  }
  return out;
}

/**
 * Summarize ASN diversity across the prefix set — multiple ASNs hint at
 * acquisitions or reseller space that merit separate treatment.
 * @param {BgpPrefix[]} prefixes
 * @returns {Array<{asn: string, prefixes: string[], count: number}>}
 */
export function summarizeAsnDiversity(prefixes) {
  const byAsn = new Map();
  for (const p of prefixes ?? []) {
    const asn = String(p.asn ?? 'unknown');
    const list = byAsn.get(asn) ?? [];
    if (!list.includes(p.prefix)) list.push(p.prefix);
    byAsn.set(asn, list);
  }
  return [...byAsn.entries()]
    .map(([asn, list]) => ({ asn, prefixes: list.sort(), count: list.length }))
    .sort((a, b) => b.count - a.count);
}
