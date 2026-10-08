/**
 * securitytrailsDnsHistory.js — SecurityTrails historical-DNS mining engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given SecurityTrails DNS-history
 * responses the caller fetched legally during an authorized engagement
 * (current + historical records per queried hostname), mine them for
 * subdomains that existed in the past, then compare against the engagement's
 * currently-resolving inventory to surface "resurrection candidates" —
 * names that may still resolve but fell out of active records. Covers
 * idea-bank item 00170:
 *
 *  00170 SecurityTrails DNS-history mining — mine SecurityTrails historical
 *        DNS to find subdomains that existed in the past and may still
 *        resolve.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched SecurityTrails response data; the engine never touches the network
 * and performs no DNS resolution itself.
 */

/**
 * Normalize one SecurityTrails history record entry.
 *
 * @param {object} rec
 * @returns {{host: string|null, type: string|null, values: string[], firstSeen: string|null, lastSeen: string|null}}
 */
export function normalizeStRecord(rec) {
  if (!rec || typeof rec !== 'object')
    return { host: null, type: null, values: [], firstSeen: null, lastSeen: null };
  const host =
    typeof rec.hostname === 'string'
      ? rec.hostname.trim().toLowerCase()
      : typeof rec.host === 'string'
        ? rec.host.trim().toLowerCase()
        : null;
  const type = typeof rec.type === 'string' ? rec.type.toUpperCase() : null;
  const values = (Array.isArray(rec.values) ? rec.values : [])
    .map(v => (v && typeof v === 'object' ? v.ip || v.value || v.target : v))
    .filter(v => typeof v === 'string');
  const firstSeen =
    typeof rec.first_seen === 'string'
      ? rec.first_seen
      : typeof rec.firstSeen === 'string'
        ? rec.firstSeen
        : null;
  const lastSeen =
    typeof rec.last_seen === 'string'
      ? rec.last_seen
      : typeof rec.lastSeen === 'string'
        ? rec.lastSeen
        : null;
  return { host, type, values: [...new Set(values)], firstSeen, lastSeen };
}

/**
 * Mine SecurityTrails current+history payloads for every hostname ever seen
 * (idea 00170). Accepts the SecurityTrails `{current, history}` envelope or
 * a flat array of records.
 *
 * @param {object|object[]} payload SecurityTrails response.
 * @returns {{hosts: {host: string, types: string[], firstSeen: string|null, lastSeen: string|null, seenIn: string[]}[], total: number}}
 */
export function mineDnsHistory(payload) {
  const perHost = new Map();
  const add = (rec, seenIn) => {
    const r = normalizeStRecord(rec);
    if (!r.host) return;
    const cur = perHost.get(r.host) || {
      host: r.host,
      types: new Set(),
      firstSeen: null,
      lastSeen: null,
      seenIn: [],
    };
    if (r.type) cur.types.add(r.type);
    if (r.firstSeen && (!cur.firstSeen || r.firstSeen < cur.firstSeen)) cur.firstSeen = r.firstSeen;
    if (r.lastSeen && (!cur.lastSeen || r.lastSeen > cur.lastSeen)) cur.lastSeen = r.lastSeen;
    if (!cur.seenIn.includes(seenIn)) cur.seenIn.push(seenIn);
    perHost.set(r.host, cur);
  };
  if (Array.isArray(payload)) {
    payload.forEach(r => add(r, 'records'));
  } else if (payload && typeof payload === 'object') {
    for (const r of payload.current || []) add(r, 'current');
    for (const r of payload.history || []) add(r, 'history');
    for (const r of payload.records || []) add(r, 'records');
  }
  const hosts = [...perHost.values()]
    .map(h => ({ ...h, types: [...h.types].sort() }))
    .sort(
      (a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '') || a.host.localeCompare(b.host)
    );
  return { hosts, total: hosts.length };
}

/**
 * Find resurrection candidates: hostnames seen only in history (not in
 * current records) and NOT in the engagement's currently-resolving
 * inventory. These are the names worth re-probing because they may still
 * resolve to forgotten infrastructure.
 *
 * @param {{hosts?: object[]}} historyResult Output of mineDnsHistory.
 * @param {string[]} currentlyResolving Hostnames known to resolve today.
 * @param {string} [targetDomain] Optional scope filter.
 * @returns {{candidates: {host: string, lastSeen: string|null, types: string[]}[], dropped: number}}
 */
export function resurrectionCandidates(
  historyResult = {},
  currentlyResolving = [],
  targetDomain = ''
) {
  const resolving = new Set((currentlyResolving || []).map(h => String(h).trim().toLowerCase()));
  const target = String(targetDomain || '')
    .trim()
    .toLowerCase();
  const candidates = [];
  let dropped = 0;
  for (const h of historyResult.hosts || []) {
    if (target && !(h.host === target || h.host.endsWith('.' + target))) continue;
    if (resolving.has(h.host)) continue;
    if (h.seenIn.includes('current')) {
      dropped++;
      continue;
    }
    candidates.push({ host: h.host, lastSeen: h.lastSeen, types: h.types });
  }
  candidates.sort(
    (a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '') || a.host.localeCompare(b.host)
  );
  return { candidates, dropped };
}

/**
 * Summarize the DNS-history mining for hunt output.
 *
 * @param {{total?: number}} historyResult
 * @param {{candidates?: object[], dropped?: number}} candidateResult
 * @returns {{totalHosts: number, candidates: number, dropped: number, topCandidates: string[], summary: string}}
 */
export function securitytrailsHistoryReport(historyResult = {}, candidateResult = {}) {
  const totalHosts = historyResult.total || 0;
  const candidates = (candidateResult.candidates || []).length;
  const dropped = candidateResult.dropped || 0;
  const topCandidates = (candidateResult.candidates || []).slice(0, 10).map(c => c.host);
  const summary =
    totalHosts === 0
      ? 'SecurityTrails DNS-history mining returned no historical records.'
      : `SecurityTrails DNS-history mining saw ${totalHosts} historical hostname(s); ${candidates} resurrection candidate(s) are absent from current records and the resolving inventory and deserve re-probing.`;
  return { totalHosts, candidates, dropped, topCandidates, summary };
}

export default {
  normalizeStRecord,
  mineDnsHistory,
  resurrectionCandidates,
  securitytrailsHistoryReport,
};
