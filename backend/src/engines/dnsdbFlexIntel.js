/**
 * dnsdbFlexIntel.js — Farsight DNSDB flex-search analysis (idea 00177).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated DNSDB-style passive-DNS records and applies flexible
 * pattern searches (e.g. "*.staging" under the target domain) to surface
 * hidden hostnames — staging, dev, and internal names that never appear in
 * forward DNS but were observed resolving at some point.
 *
 * DNSDB record shape:
 *   { rrname, rrtype, rdata, firstSeen, lastSeen, count, source }
 * All functions are pure and synchronous.
 */

const HIDDEN_HINTS = [
  /staging/i, /stage/i, /\bdev\b/i, /development/i, /test/i, /\bqa\b/i,
  /uat/i, /sandbox/i, /internal/i, /intranet/i, /corp/i, /vpn/i,
  /admin/i, /ops/i, /backup/i, /legacy/i, /old/i, /beta/i, /preview/i,
];

/**
 * Idea 00177 — Flexible pattern search over passive-DNS names.
 *
 * String patterns are glob-style: `*` matches any run of characters and `?`
 * matches one character (e.g. "*.staging.example.com"). Pass a RegExp for
 * full regex control.
 *
 * @param {Array<Object>} records - DNSDB records.
 * @param {string|RegExp} pattern - glob pattern or regex matched against rrname.
 * @returns {Array<Object>} matching records, sorted by name.
 */
export function searchPattern(records, pattern) {
  let re;
  if (pattern instanceof RegExp) {
    re = pattern;
  } else {
    const glob = String(pattern)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    re = new RegExp(`^${glob}$`, 'i');
  }
  return (records || [])
    .filter((r) => r && r.rrname && re.test(String(r.rrname).replace(/\.$/, '')))
    .sort((a, b) => String(a.rrname).localeCompare(String(b.rrname)));
}

/**
 * Idea 00177 — Find hidden staging/dev names under a domain.
 *
 * Returns names under `domain` that carry staging/dev/internal hints —
 * these are the hosts most likely to be weakly hardened yet reachable.
 *
 * @param {Array<Object>} records
 * @param {string} domain - e.g. "example.com".
 * @param {{ hints?: Array<RegExp> }} [opts]
 * @returns {Array<{ name, rrtype, rdata, hints: Array<string>, firstSeen, lastSeen }>}
 */
export function findHiddenStaging(records, domain, opts = {}) {
  const hints = opts.hints || HIDDEN_HINTS;
  const apex = String(domain).toLowerCase().replace(/\.$/, '');
  const out = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.rrname) continue;
    const name = String(r.rrname).toLowerCase().replace(/\.$/, '');
    if (name !== apex && !name.endsWith(`.${apex}`)) continue;
    const matched = hints.filter((h) => h.test(name)).map((h) => String(h));
    if (matched.length === 0) continue;
    const key = `${name}|${r.rrtype || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      rrtype: r.rrtype ?? null,
      rdata: r.rdata ?? null,
      hints: matched,
      firstSeen: r.firstSeen ?? null,
      lastSeen: r.lastSeen ?? null,
    });
  }
  return out.sort((a, b) => b.hints.length - a.hints.length || a.name.localeCompare(b.name));
}

/**
 * Idea 00177 — Label-depth analysis.
 *
 * Deeply nested labels (e.g. "a.b.c.example.com") often mark internal or
 * auto-generated infrastructure. Returns names grouped by label depth.
 *
 * @param {Array<Object>} records
 * @param {string} domain
 * @param {{ minDepth?: number }} [opts]
 * @returns {Array<{ depth: number, names: Array<string> }>} sorted desc by depth.
 */
export function labelDepthAnalysis(records, domain, opts = {}) {
  const minDepth = opts.minDepth ?? 4;
  const apex = String(domain).toLowerCase().replace(/\.$/, '');
  const byDepth = new Map();
  for (const r of records || []) {
    if (!r || !r.rrname) continue;
    const name = String(r.rrname).toLowerCase().replace(/\.$/, '');
    if (name !== apex && !name.endsWith(`.${apex}`)) continue;
    const depth = name.split('.').length;
    if (depth < minDepth) continue;
    if (!byDepth.has(depth)) byDepth.set(depth, new Set());
    byDepth.get(depth).add(name);
  }
  return [...byDepth.entries()]
    .map(([depth, names]) => ({ depth, names: [...names].sort() }))
    .sort((a, b) => b.depth - a.depth);
}
