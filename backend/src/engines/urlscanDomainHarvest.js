/**
 * urlscanDomainHarvest.js — urlscan.io domain-page harvesting engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given urlscan.io scan results the
 * caller fetched legally during an authorized engagement (its own scans of
 * in-scope targets), harvest the captured URLs to find subdomains and
 * endpoints real users actually visited. Covers idea-bank item 00165:
 *
 *  00165 URLScan.io domain-page harvesting — harvest URLs from urlscan.io
 *        scans of the target to find subdomains and endpoints users actually
 *        visited.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched urlscan result JSON; the engine never touches the network and only
 * works on URLs already visible in the supplied scans.
 */

/**
 * Extract host + path from a URL string; tolerant of malformed input.
 *
 * @param {string} url
 * @returns {{host: string|null, path: string|null}}
 */
export function splitUrl(url) {
  if (typeof url !== 'string') return { host: null, path: null };
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return { host: null, path: null };
    return { host: u.hostname.toLowerCase(), path: u.pathname + (u.search || '') };
  } catch {
    return { host: null, path: null };
  }
}

/**
 * Normalize one urlscan.io result into its captured request/transaction URLs.
 * Accepts urlscan search-API rows ({result: {...}}), task objects
 * ({result: {requests: [...]}}), and flattened {requests:[...]} shapes.
 *
 * @param {object} scan
 * @returns {string[]} Captured URLs from the scan.
 */
export function extractScanUrls(scan) {
  if (!scan || typeof scan !== 'object') return [];
  const urls = [];
  const seen = new Set();
  const push = u => {
    if (typeof u === 'string' && u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  };
  const payload = scan.result && typeof scan.result === 'object' ? scan.result : scan;
  if (typeof payload.page === 'object' && payload.page && typeof payload.page.url === 'string')
    push(payload.page.url);
  for (const req of payload.requests || []) {
    const reqObj = typeof req === 'string' ? { request: { url: req } } : req;
    const u =
      reqObj.request && typeof reqObj.request === 'object'
        ? reqObj.request.url
        : typeof reqObj.url === 'string'
          ? reqObj.url
          : null;
    push(u);
  }
  for (const t of payload.transactions || []) {
    if (t && typeof t.requestURL === 'string') push(t.requestURL);
  }
  return urls;
}

/**
 * Harvest subdomains of the target plus visited endpoint paths from a batch
 * of urlscan results (idea 00165).
 *
 * @param {object[]} scans Raw urlscan.io scan objects.
 * @param {string} targetDomain
 * @returns {{subdomains: {host: string, hits: number}[], endpoints: {host: string, paths: string[]}[], scanCount: number, urlCount: number}}
 */
export function harvestDomainPages(scans, targetDomain) {
  const target = String(targetDomain || '')
    .trim()
    .toLowerCase();
  const hostHits = new Map();
  const hostPaths = new Map();
  let urlCount = 0;
  for (const scan of scans || []) {
    for (const url of extractScanUrls(scan)) {
      urlCount++;
      const { host, path } = splitUrl(url);
      if (!host) continue;
      const inScope = !target || host === target || host.endsWith('.' + target);
      if (!inScope) continue;
      hostHits.set(host, (hostHits.get(host) || 0) + 1);
      if (path && path !== '/') {
        if (!hostPaths.has(host)) hostPaths.set(host, new Set());
        hostPaths.get(host).add(path.length > 200 ? path.slice(0, 200) : path);
      }
    }
  }
  const subdomains = [...hostHits.entries()]
    .filter(([h]) => h !== target)
    .map(([host, hits]) => ({ host, hits }))
    .sort((a, b) => b.hits - a.hits || a.host.localeCompare(b.host));
  const endpoints = [...hostPaths.entries()]
    .map(([host, paths]) => ({ host, paths: [...paths].sort() }))
    .sort((a, b) => a.host.localeCompare(b.host));
  return { subdomains, endpoints, scanCount: (scans || []).length, urlCount };
}

/**
 * Pick out endpoints that look worth a deeper look (admin paths, APIs,
 * debug artifacts, file uploads) from harvested paths.
 *
 * @param {{host: string, paths: string[]}[]} endpoints
 * @returns {{host: string, path: string, reason: string}[]}
 */
export function interestingEndpoints(endpoints = []) {
  const patterns = [
    [/admin|dashboard|console|manage/i, 'admin surface'],
    [/api\//i, 'API endpoint'],
    [/debug|trace|profile/i, 'debug artifact'],
    [/upload|import/i, 'file upload'],
    [/backup|\.bak|\.sql|\.zip|\.tar/i, 'backup/archive file'],
    [/graphql/i, 'GraphQL endpoint'],
    [/swagger|openapi|api-docs/i, 'API documentation'],
    [/\.git|\.env|wp-config/i, 'sensitive artifact'],
  ];
  const out = [];
  for (const e of endpoints) {
    for (const p of e.paths || []) {
      for (const [re, reason] of patterns) {
        if (re.test(p)) {
          out.push({ host: e.host, path: p, reason });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Summarize the harvest for hunt output.
 *
 * @param {{subdomains?: object[], endpoints?: object[], scanCount?: number, urlCount?: number}} result
 * @param {{host: string}[]} interesting
 * @returns {{newSubdomains: number, endpointsFound: number, interesting: number, summary: string}}
 */
export function urlscanHarvestReport(result = {}, interesting = []) {
  const newSubdomains = (result.subdomains || []).length;
  const endpointsFound = (result.endpoints || []).reduce((n, e) => n + (e.paths || []).length, 0);
  const interestingCount = interesting.length;
  const summary =
    newSubdomains === 0 && endpointsFound === 0
      ? `Harvested ${result.urlCount || 0} URL(s) from ${result.scanCount || 0} urlscan.io scan(s); no new target subdomains or endpoints found.`
      : `urlscan.io harvesting across ${result.scanCount || 0} scan(s) found ${newSubdomains} new subdomain(s) and ${endpointsFound} endpoint path(s), ${interestingCount} flagged as interesting.`;
  return { newSubdomains, endpointsFound, interesting: interestingCount, summary };
}

export default {
  splitUrl,
  extractScanUrls,
  harvestDomainPages,
  interestingEndpoints,
  urlscanHarvestReport,
};
