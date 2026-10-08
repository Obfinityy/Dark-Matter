/**
 * virustotalSubdomainIntel.js — VirusTotal subdomain enumeration engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given VirusTotal API subdomain-list
 * responses the caller fetched legally during an authorized engagement,
 * normalize the list, dedupe it, and filter it against the engagement's
 * already-known inventory to surface genuinely new assets. Covers idea-bank
 * item 00167:
 *
 *  00167 VirusTotal subdomain enumeration — pull VirusTotal's subdomain list
 *        for the target domain as a passive enumeration source.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched VirusTotal response data; the engine never touches the network.
 */

/**
 * Normalize one VirusTotal domain object (API v3 `data` item) into a plain
 * hostname record.
 *
 * @param {object} item
 * @returns {{host: string|null, lastAnalysis: object|null, categories: string[], reputation: number|null}}
 */
export function normalizeVtSubdomain(item) {
  if (!item || typeof item !== 'object')
    return { host: null, lastAnalysis: null, categories: [], reputation: null };
  const host =
    typeof item.id === 'string'
      ? item.id.trim().toLowerCase()
      : typeof item.host === 'string'
        ? item.host.trim().toLowerCase()
        : null;
  const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
  const lastAnalysis =
    attrs.last_analysis_stats && typeof attrs.last_analysis_stats === 'object'
      ? { ...attrs.last_analysis_stats }
      : null;
  const categories =
    attrs.categories && typeof attrs.categories === 'object'
      ? Object.values(attrs.categories).filter(c => typeof c === 'string')
      : [];
  const reputation = attrs.reputation != null ? Number(attrs.reputation) : null;
  return {
    host,
    lastAnalysis,
    categories: [...new Set(categories)],
    reputation: Number.isFinite(reputation) ? reputation : null,
  };
}

/**
 * Count how many engines flagged the hostname as malicious/suspicious.
 *
 * @param {object|null} lastAnalysis last_analysis_stats object.
 * @returns {number}
 */
export function vtFlagCount(lastAnalysis) {
  if (!lastAnalysis || typeof lastAnalysis !== 'object') return 0;
  return (Number(lastAnalysis.malicious) || 0) + (Number(lastAnalysis.suspicious) || 0);
}

/**
 * Enumerate subdomains from a VirusTotal response payload: dedupe, drop the
 * apex and malformed names, and diff against known inventory (idea 00167).
 *
 * @param {object[]|object} payload VT response: array of items or {data:[...]}.
 * @param {{knownHosts?: string[], targetDomain?: string}} [opts]
 * @returns {{subdomains: object[], newCount: number, flaggedCount: number, total: number}}
 */
export function enumerateSubdomains(payload, opts = {}) {
  const raw = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.data)
      ? payload.data
      : [];
  const known = new Set((opts.knownHosts || []).map(h => String(h).trim().toLowerCase()));
  const target = String(opts.targetDomain || '')
    .trim()
    .toLowerCase();
  const seen = new Set();
  const subdomains = [];
  for (const item of raw) {
    const s = normalizeVtSubdomain(item);
    if (!s.host || seen.has(s.host)) continue;
    seen.add(s.host);
    if (target && !(s.host === target || s.host.endsWith('.' + target))) continue;
    const flags = vtFlagCount(s.lastAnalysis);
    subdomains.push({ ...s, flagCount: flags, isNew: !known.has(s.host) });
  }
  subdomains.sort(
    (a, b) =>
      Number(b.isNew) - Number(a.isNew) || b.flagCount - a.flagCount || a.host.localeCompare(b.host)
  );
  const newCount = subdomains.filter(s => s.isNew).length;
  const flaggedCount = subdomains.filter(s => s.flagCount > 0).length;
  return { subdomains, newCount, flaggedCount, total: subdomains.length };
}

/**
 * Summarize the enumeration for hunt output.
 *
 * @param {{subdomains?: object[], newCount?: number, flaggedCount?: number, total?: number}} result
 * @returns {{total: number, newCount: number, flaggedCount: number, topNew: string[], summary: string}}
 */
export function vtSubdomainReport(result = {}) {
  const total = result.total || 0;
  const newCount = result.newCount || 0;
  const flaggedCount = result.flaggedCount || 0;
  const topNew = (result.subdomains || [])
    .filter(s => s.isNew)
    .slice(0, 10)
    .map(s => s.host);
  const summary =
    total === 0
      ? 'VirusTotal subdomain enumeration returned no subdomains for the target domain.'
      : `VirusTotal passive enumeration found ${total} subdomain(s); ${newCount} new vs. current inventory${flaggedCount ? `, ${flaggedCount} flagged by AV engines` : ''}.`;
  return { total, newCount, flaggedCount, topNew, summary };
}

export default {
  normalizeVtSubdomain,
  vtFlagCount,
  enumerateSubdomains,
  vtSubdomainReport,
};
