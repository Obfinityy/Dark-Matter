/**
 * ipApiReverseIntel.js — Bulk reverse-pointer pull engine.
 *
 * Implements idea-bank item 00190 (IP-API reverse-pointer bulk pull): ingest
 * bulk reverse-pointer (PTR) data pulled for the target's netblocks and turn
 * it into a hostname inventory with cross-netblock dedup, provider-pattern
 * detection, and gap analysis (IPs with no PTR at all are often
 * interestingly dark infrastructure).
 *
 * Pure functions: the caller pulls the PTR records via its geolocation/IP
 * API of choice and passes them in.
 */

/**
 * @typedef {object} ReversePointerRow
 * @property {string} ip
 * @property {string|null} ptr       PTR hostname or null when none
 * @property {string} [netblock]    source netblock label, e.g. '203.0.113.0/24'
 */

/**
 * Build the PTR map with dedup and statistics.
 * @param {ReversePointerRow[]} rows
 * @returns {{ptrMap: Map<string, string>, uniqueHostnames: string[], noPtrIps: string[], coverage: number}}
 */
export function bulkPullReverse(rows) {
  const ptrMap = new Map();
  const hostnames = new Set();
  const noPtrIps = [];
  for (const row of rows ?? []) {
    const ip = String(row.ip ?? '').trim();
    if (!ip) continue;
    const ptr = row.ptr ? String(row.ptr).trim().toLowerCase().replace(/\.$/, '') : '';
    if (ptr) {
      ptrMap.set(ip, ptr);
      hostnames.add(ptr);
    } else {
      noPtrIps.push(ip);
    }
  }
  const total = (rows ?? []).filter((r) => String(r.ip ?? '').trim()).length;
  return {
    ptrMap,
    uniqueHostnames: [...hostnames].sort(),
    noPtrIps: noPtrIps.sort(),
    coverage: total ? Math.round((ptrMap.size / total) * 100) : 0,
  };
}

/**
 * Correlate PTR hostnames against target scope and detect hosting-provider
 * patterns (cloud provider default PTR names reveal infra even when the
 * hostname itself looks generic).
 * @param {Map<string, string>} ptrMap
 * @param {object} [opts]
 * @param {string[]} [opts.domainSuffixes]
 * @returns {{inScope: Array<{ip: string, ptr: string}>, providerPatterns: Array<{pattern: string, ips: string[]}>, other: Array<{ip: string, ptr: string}>}}
 */
export function correlatePointers(ptrMap, opts = {}) {
  const suffixes = (opts.domainSuffixes ?? []).map((s) => s.toLowerCase());
  const PROVIDER_PATTERNS = [
    /ec2-\d+-\d+-\d+-\d+.*\.amazonaws\.com$/, /.*\.compute\.amazonaws\.com$/,
    /.*\.cloudapp\.azure\.com$/, /.*\.googleusercontent\.com$/,
    /.*\.cloudflare\.com$/, /.*\.hostinger\./, /.*\.digitalocean\.com$/,
    /static-\d+-\d+-\d+-\d+/,
  ];
  const inScope = [];
  const providerPatterns = new Map();
  const other = [];

  for (const [ip, ptr] of ptrMap) {
    if (suffixes.length && suffixes.some((s) => ptr === s || ptr.endsWith(`.${s}`))) {
      inScope.push({ ip, ptr });
      continue;
    }
    const hit = PROVIDER_PATTERNS.find((re) => re.test(ptr));
    if (hit) {
      const list = providerPatterns.get(hit.source) ?? [];
      list.push(ip);
      providerPatterns.set(hit.source, list);
    } else {
      other.push({ ip, ptr });
    }
  }
  const byIp = (a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true });
  return {
    inScope: inScope.sort(byIp),
    providerPatterns: [...providerPatterns.entries()]
      .map(([pattern, ips]) => ({ pattern, ips: ips.sort() }))
      .sort((a, b) => b.ips.length - a.ips.length),
    other: other.sort(byIp),
  };
}

/**
 * Group PTR hostnames by their netblock source to find blocks that are
 * "hostnameless" (no PTRs) — a signal of dark or reserved space inside an
 * otherwise named allocation.
 * @param {ReversePointerRow[]} rows
 * @returns {Array<{netblock: string, total: number, withPtr: number, ptrRatio: number}>}
 */
export function analyzeNetblockGaps(rows) {
  const byBlock = new Map();
  for (const row of rows ?? []) {
    const block = String(row.netblock ?? 'unknown').trim();
    let entry = byBlock.get(block);
    if (!entry) {
      entry = { netblock: block, total: 0, withPtr: 0 };
      byBlock.set(block, entry);
    }
    entry.total += 1;
    if (row.ptr) entry.withPtr += 1;
  }
  return [...byBlock.values()]
    .map((e) => ({ ...e, ptrRatio: e.total ? Math.round((e.withPtr / e.total) * 100) / 100 : 0 }))
    .sort((a, b) => a.ptrRatio - b.ptrRatio);
}
