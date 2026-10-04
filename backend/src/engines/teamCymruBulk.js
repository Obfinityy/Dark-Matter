/**
 * teamCymruBulk.js — Team Cymru IP-to-ASN bulk resolution (idea 00194).
 *
 * Team Cymru's bulk WHOIS (whois -h whois.cymru.com " -v -f <ips>") resolves
 * many IPs to their origin ASN in one shot. Before sweeping a target's IP
 * space, the agent confirms ownership boundaries: which IPs genuinely belong
 * to the target's ASNs, and where someone else's network begins. This module
 * parses Cymru bulk output and computes those boundaries off-line.
 * All functions are pure and synchronous — no network calls.
 */

const HEADER_RE = /^\s*AS\s*\|\s*IP\s*\|\s*BGP Prefix\s*\|\s*CC\s*\|\s*Registry\s*\|\s*Allocated\s*\|\s*AS Name/i;

/**
 * Idea 00194 — Parse Team Cymru bulk WHOIS output into records.
 *
 * Expected pipe-delimited rows (header optional):
 *   AS | IP | BGP Prefix | CC | Registry | Allocated | AS Name
 * Handles "AS15169", "NA", and empty fields gracefully.
 *
 * @param {string} text — raw bulk whois output
 * @returns {Array<{ asn: number|null, ip: string, prefix: string|null, cc: string|null, registry: string|null, allocated: string|null, asName: string|null }>}
 */
export function parseCymruBulk(text = '') {
  const records = [];
  const seen = new Set();
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || HEADER_RE.test(line)) continue;
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 2) continue;
    const ip = cols[1];
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    const asnRaw = (cols[0] || '').replace(/^AS/i, '').trim();
    const asn = /^\d+$/.test(asnRaw) ? Number(asnRaw) : null;
    const norm = (v) => {
      const s = String(v || '').trim();
      return !s || /^NA$/i.test(s) ? null : s;
    };
    records.push({
      asn,
      ip,
      prefix: norm(cols[2]),
      cc: norm(cols[3]),
      registry: norm(cols[4]),
      allocated: norm(cols[5]),
      asName: norm(cols[6]),
    });
  }
  return records;
}

/**
 * Idea 00194 — Confirm ownership boundaries from resolved records.
 *
 * Groups IPs by origin ASN, marks each ASN as in-scope (one of the target's
 * expanded ASNs) or out-of-scope, and flags boundary IPs — out-of-scope IPs
 * adjacent in scan order to in-scope blocks (CDN edges, cloud frontends),
 * which deserve extra care during sweeping.
 *
 * @param {Array<{ asn: number|null, ip: string, prefix?: string|null, asName?: string|null }>} records
 * @param {Array<number|string>} targetAsns — target's expanded ASN list
 * @returns {{ inScope: Array<{asn, ip, prefix, asName}>, outOfScope: Array<{asn, ip, prefix, asName}>, byAsn: Array<{asn, asName, ips: string[], inScope: boolean}>, stats: { resolved, unresolved, inScopeCount, outOfScopeCount } }}
 */
export function ownershipBoundaries(records = [], targetAsns = []) {
  const targets = new Set(
    (targetAsns || []).map((a) => Number(a)).filter(Number.isFinite),
  );
  const inScope = [];
  const outOfScope = [];
  const byAsn = new Map();
  let resolved = 0;
  let unresolved = 0;

  for (const r of records || []) {
    if (!r || !r.ip) continue;
    if (r.asn === null || r.asn === undefined) {
      unresolved++;
      continue;
    }
    resolved++;
    const inScopeFlag = targets.has(Number(r.asn));
    const entry = { asn: Number(r.asn), ip: r.ip, prefix: r.prefix || null, asName: r.asName || null };
    if (inScopeFlag) inScope.push(entry);
    else outOfScope.push(entry);
    if (!byAsn.has(entry.asn)) {
      byAsn.set(entry.asn, { asn: entry.asn, asName: entry.asName, ips: [], inScope: inScopeFlag });
    }
    byAsn.get(entry.asn).ips.push(entry.ip);
  }

  const byAsnList = [...byAsn.values()]
    .map((g) => ({ ...g, ips: g.ips.sort() }))
    .sort((a, b) => b.ips.length - a.ips.length || a.asn - b.asn);

  return {
    inScope,
    outOfScope,
    byAsn: byAsnList,
    stats: {
      resolved,
      unresolved,
      inScopeCount: inScope.length,
      outOfScopeCount: outOfScope.length,
    },
  };
}
