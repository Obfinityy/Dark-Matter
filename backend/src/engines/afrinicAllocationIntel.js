/**
 * afrinicAllocationIntel.js — AFRINIC allocation-list sweeper (idea 00141).
 *
 * AFRINIC publishes delegation statistics (extended format, one line per
 * allocation). Newer African PoP netblocks appear as recent ipv4/ipv6
 * allocations. This module parses those lines and surfaces the newest
 * netblocks for a given country or organization.
 */

const LINE_RE = /^afrinic\|([A-Z]{2})\|(ipv4|ipv6|asn)\|([^|]+)\|(\d+)\|(\d{8})\|([^|]*)\|?(.*)$/;

function cidrOf(type, start, count) {
  if (type === 'ipv6') {
    return `${start}/${count}`;
  }
  const hosts = Number(count);
  if (!Number.isFinite(hosts) || hosts <= 0) return null;
  const bits = 32 - Math.round(Math.log2(hosts));
  return `${start}/${bits}`;
}

function dateOf(raw) {
  if (!/^\d{8}$/.test(raw)) return null;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${m}-${d}`;
}

/**
 * Parse AFRINIC delegated-stats lines into structured allocations.
 * @param {string} text — raw delegated-stats content
 * @returns {{ total: number, allocations: { country, type, prefix, date, status, orgId }[] }}
 */
export function parseAfrinicAllocations(text = '') {
  const allocations = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const [, country, type, start, count, date, status, orgId] = m;
    const prefix = cidrOf(type, start, count);
    if (!prefix) continue;
    allocations.push({
      country,
      type,
      prefix,
      date: dateOf(date),
      status: status || 'unknown',
      orgId: orgId || null,
    });
  }
  return { total: allocations.length, allocations };
}

/**
 * Surface the newest netblocks matching a country or org filter.
 * @param {string} text — raw delegated-stats content
 * @param {{ country?: string, orgId?: string, limit?: number, since?: string }} opts
 * @returns {{ country, type, prefix, date, status, orgId }[]}
 */
export function newestNetblocks(
  text = '',
  { country = null, orgId = null, limit = 25, since = null } = {}
) {
  const { allocations } = parseAfrinicAllocations(text);
  const filtered = allocations.filter(a => {
    if (country && a.country !== country.toUpperCase()) return false;
    if (orgId && a.orgId !== orgId) return false;
    if (since && a.date && a.date < since) return false;
    return true;
  });
  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return filtered.slice(0, limit);
}

/**
 * Summarize allocation activity by country and type.
 * @param {string} text — raw delegated-stats content
 * @returns {{ byCountry: Record<string, number>, byType: Record<string, number>, total: number }}
 */
export function summarizeAllocations(text = '') {
  const { allocations, total } = parseAfrinicAllocations(text);
  const byCountry = {};
  const byType = {};
  for (const a of allocations) {
    byCountry[a.country] = (byCountry[a.country] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
  }
  return { byCountry, byType, total };
}
