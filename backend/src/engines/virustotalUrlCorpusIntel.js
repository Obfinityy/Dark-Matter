/**
 * virustotalUrlCorpusIntel.js — VirusTotal URL corpus mining engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given VirusTotal URL-object
 * collections the caller fetched legally during an authorized engagement
 * (URLs submitted by analysts for the target domain), mine them for
 * target-domain URLs, reconstruct parameter surfaces, and flag interesting
 * endpoints worth a closer look. Covers idea-bank item 00168:
 *
 *  00168 VirusTotal URL corpus mining — mine VirusTotal's URL corpus for
 *        target-domain URLs submitted by analysts.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched VirusTotal response data; the engine never touches the network and
 * performs defensive analysis only (no request replay, no payloads).
 */

/**
 * Normalize one VirusTotal URL object (API v3 `data` item).
 *
 * @param {object} item
 * @returns {{url: string|null, host: string|null, path: string|null, params: string[], lastAnalysis: object|null, timesSubmitted: number|null}}
 */
export function normalizeVtUrl(item) {
  if (!item || typeof item !== 'object') return { url: null, host: null, path: null, params: [], lastAnalysis: null, timesSubmitted: null };
  const url = typeof item.id === 'string' ? item.id : (typeof item.url === 'string' ? item.url : null);
  const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
  let host = null;
  let path = null;
  let params = [];
  if (typeof url === 'string') {
    try {
      const u = new URL(url);
      host = u.hostname.toLowerCase();
      path = u.pathname;
      params = [...new Set([...u.searchParams.keys()])];
    } catch { /* malformed URL */ }
  }
  const lastAnalysis = attrs.last_analysis_stats && typeof attrs.last_analysis_stats === 'object'
    ? { ...attrs.last_analysis_stats } : null;
  const timesSubmitted = attrs.times_submitted != null ? Number(attrs.times_submitted) : null;
  return { url, host, path, params, lastAnalysis, timesSubmitted: Number.isFinite(timesSubmitted) ? timesSubmitted : null };
}

/**
 * Mine a VirusTotal URL collection for target-domain URLs (idea 00168).
 *
 * @param {object[]|object} payload VT response: array of URL objects or {data:[...]}.
 * @param {string} targetDomain
 * @returns {{urls: object[], hostCount: number, paramSurface: {param: string, hosts: number, urls: number}[]}}
 */
export function mineTargetUrls(payload, targetDomain) {
  const raw = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
  const target = String(targetDomain || '').trim().toLowerCase();
  const seen = new Set();
  const urls = [];
  const paramHosts = new Map();
  for (const item of raw) {
    const u = normalizeVtUrl(item);
    if (!u.url || seen.has(u.url)) continue;
    seen.add(u.url);
    if (!u.host) continue;
    if (target && !(u.host === target || u.host.endsWith('.' + target))) continue;
    urls.push(u);
    for (const p of u.params) {
      if (!paramHosts.has(p)) paramHosts.set(p, { hosts: new Set(), urls: 0 });
      const g = paramHosts.get(p);
      g.hosts.add(u.host);
      g.urls++;
    }
  }
  const paramSurface = [...paramHosts.entries()]
    .map(([param, g]) => ({ param, hosts: g.hosts.size, urls: g.urls }))
    .sort((a, b) => b.urls - a.urls || a.param.localeCompare(b.param));
  const hostCount = new Set(urls.map((u) => u.host)).size;
  return { urls, hostCount, paramSurface };
}

/**
 * Flag mined URLs that look worth a closer look: debug/admin artifacts,
 * API endpoints, file types that leak data, and URLs carrying auth-ish
 * parameter names (defensive flagging, no payload generation).
 *
 * @param {object[]} urls Output of mineTargetUrls.
 * @returns {{url: string, host: string, reason: string}[]}
 */
export function flagInterestingUrls(urls = []) {
  const patterns = [
    [/admin|dashboard|console|manage/i, 'admin surface'],
    [/api\/v?\d*|graphql/i, 'API endpoint'],
    [/debug|trace|stacktrace/i, 'debug artifact'],
    [/\.(bak|sql|zip|tar|gz|log|env|old|swp)$/i, 'data-leak file type'],
    [/swagger|openapi|api-docs|redoc/i, 'API documentation'],
    [/\.git|\.svn/i, 'version-control artifact'],
  ];
  const authParams = ['token', 'key', 'secret', 'session', 'auth', 'password', 'apikey', 'api_key', 'access_token'];
  const out = [];
  for (const u of urls) {
    if (!u.url) continue;
    let reason = null;
    for (const [re, r] of patterns) {
      if (re.test(u.url)) { reason = r; break; }
    }
    if (!reason && u.params.some((p) => authParams.some((a) => p.toLowerCase().includes(a)))) reason = 'credential-like parameter';
    if (reason) out.push({ url: u.url, host: u.host, reason });
  }
  return out;
}

/**
 * Summarize the mining for hunt output.
 *
 * @param {{urls?: object[], hostCount?: number, paramSurface?: object[]}} result
 * @param {object[]} flagged
 * @returns {{urlCount: number, hostCount: number, paramCount: number, flaggedCount: number, summary: string}}
 */
export function vtUrlCorpusReport(result = {}, flagged = []) {
  const urlCount = (result.urls || []).length;
  const hostCount = result.hostCount || 0;
  const paramCount = (result.paramSurface || []).length;
  const flaggedCount = flagged.length;
  const summary = urlCount === 0
    ? 'VirusTotal URL corpus mining found no target-domain URLs submitted by analysts.'
    : `VirusTotal URL corpus mining surfaced ${urlCount} analyst-submitted URL(s) across ${hostCount} target host(s) with ${paramCount} distinct parameter name(s); ${flaggedCount} flagged as interesting.`;
  return { urlCount, hostCount, paramCount, flaggedCount, summary };
}

export default {
  normalizeVtUrl,
  mineTargetUrls,
  flagInterestingUrls,
  vtUrlCorpusReport,
};
