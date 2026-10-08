/**
 * leakixServiceIntel.js — LeakIX service-index pivoting engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given LeakIX service rows the caller
 * fetched legally during an authorized engagement, normalize them and pivot
 * on the index to find target subdomains running exposed software, then flag
 * services whose versions match caller-supplied exposure rules. Covers
 * idea-bank item 00163:
 *
 *  00163 LeakIX service-index pivoting — pivot on LeakIX's indexed services
 *        to find target subdomains with exposed software.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched LeakIX response data; the engine never touches the network, and
 * exposure checks are defensive flagging (no exploitation).
 */

/**
 * Normalize one LeakIX service row into a canonical record.
 *
 * @param {object} row
 * @returns {{host: string|null, ip: string|null, port: number|null, protocol: string|null, software: string|null, version: string|null, summary: string|null}}
 */
export function normalizeLeakixService(row) {
  if (!row || typeof row !== 'object')
    return {
      host: null,
      ip: null,
      port: null,
      protocol: null,
      software: null,
      version: null,
      summary: null,
    };
  const host =
    typeof row.host === 'string'
      ? row.host.trim().toLowerCase()
      : typeof row.hostname === 'string'
        ? row.hostname.trim().toLowerCase()
        : null;
  const ip = typeof row.ip === 'string' ? row.ip : null;
  const port = row.port != null ? Number(row.port) : null;
  const protocol = typeof row.protocol === 'string' ? row.protocol.toLowerCase() : null;
  const software =
    typeof row.software_name === 'string'
      ? row.software_name
      : typeof row.software === 'string'
        ? row.software
        : null;
  const version = row.software_version != null ? String(row.software_version) : null;
  const summary = typeof row.summary === 'string' ? row.summary : null;
  return {
    host,
    ip,
    port: Number.isFinite(port) ? port : null,
    protocol,
    software: software ? software.trim() : null,
    version,
    summary,
  };
}

/**
 * Compare dotted versions; returns -1/0/1 (a<b, a==b, a>b).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareVersions(a, b) {
  const pa = String(a)
    .split(/[.\-+_]/)
    .map(x => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = String(b)
    .split(/[.\-+_]/)
    .map(x => (/^\d+$/.test(x) ? Number(x) : x));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else if (String(x) !== String(y)) {
      return String(x) < String(y) ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Pivot the LeakIX index onto the target domain: keep services whose host
 * belongs to the target and group by host (idea 00163).
 *
 * @param {object[]} rows Raw LeakIX service rows.
 * @param {string} targetDomain
 * @returns {{byHost: {host: string, services: object[]}[], hostCount: number, serviceCount: number}}
 */
export function pivotTargetServices(rows, targetDomain) {
  const target = String(targetDomain || '')
    .trim()
    .toLowerCase();
  const byHost = new Map();
  let serviceCount = 0;
  for (const raw of rows || []) {
    const s = normalizeLeakixService(raw);
    if (!s.host) continue;
    if (target && !(s.host === target || s.host.endsWith('.' + target))) continue;
    serviceCount++;
    if (!byHost.has(s.host)) byHost.set(s.host, []);
    byHost.get(s.host).push(s);
  }
  const grouped = [...byHost.entries()]
    .map(([host, services]) => ({
      host,
      services: services.sort((a, b) => (a.port || 0) - (b.port || 0)),
    }))
    .sort((a, b) => b.services.length - a.services.length || a.host.localeCompare(b.host));
  return { byHost: grouped, hostCount: grouped.length, serviceCount };
}

/**
 * Flag exposed software: services whose product/version falls below
 * caller-supplied exposure rules (e.g. unauthenticated admin panels,
 * end-of-life products, default-credential candidates). Rules are
 * caller-supplied policy, never hard-coded exploit knowledge.
 *
 * Rule shape: { software: 'regex', below?: 'version', port?: number, reason: 'string' }
 *
 * @param {{host: string, services: object[]}[]} byHost Output of pivotTargetServices.
 * @param {object[]} rules
 * @returns {{flagged: {host: string, service: object, reason: string}[], ruleCount: number}}
 */
export function flagExposedSoftware(byHost, rules = []) {
  const flagged = [];
  for (const group of byHost || []) {
    for (const s of group.services || []) {
      for (const rule of rules || []) {
        if (!rule || !rule.software || !rule.reason) continue;
        const name = s.software || '';
        let matches = false;
        try {
          matches = new RegExp(rule.software, 'i').test(name);
        } catch {
          matches = false;
        }
        if (!matches) continue;
        if (rule.port != null && s.port !== Number(rule.port)) continue;
        if (rule.below && s.version && compareVersions(s.version, rule.below) >= 0) continue;
        flagged.push({ host: group.host, service: s, reason: rule.reason });
      }
    }
  }
  return { flagged, ruleCount: rules.length };
}

/**
 * Summarize the pivot for hunt output.
 *
 * @param {{hostCount?: number, serviceCount?: number}} pivotResult
 * @param {{flagged?: object[]}} flagResult
 * @returns {{hostCount: number, serviceCount: number, flaggedCount: number, summary: string}}
 */
export function leakixPivotReport(pivotResult = {}, flagResult = {}) {
  const hostCount = pivotResult.hostCount || 0;
  const serviceCount = pivotResult.serviceCount || 0;
  const flaggedCount = (flagResult.flagged || []).length;
  const summary =
    hostCount === 0
      ? 'LeakIX service-index pivoting found no indexed services for the target domain.'
      : `LeakIX pivoting mapped ${serviceCount} indexed service(s) across ${hostCount} target host(s); ${flaggedCount} match exposure rules and deserve review.`;
  return { hostCount, serviceCount, flaggedCount, summary };
}

export default {
  normalizeLeakixService,
  compareVersions,
  pivotTargetServices,
  flagExposedSoftware,
  leakixPivotReport,
};
