/**
 * urlscanDomHostIntel.js — urlscan screenshot-DOM host extraction engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given urlscan.io DOM snapshots and
 * network request lists the caller fetched legally during an authorized
 * engagement (its own scans of in-scope targets), extract every host
 * referenced in page DOM (scripts, iframes, forms, links, fetch/XHR targets,
 * comments) and in the request/response lists. Covers idea-bank item 00166:
 *
 *  00166 URLScan screenshot-DOM host extraction — extract host references
 *        from urlscan DOM snapshots and network request lists.
 *
 * All functions are pure and side-effect free. Input is already-fetched
 * urlscan result JSON; the engine never touches the network.
 */

/**
 * Extract hostnames from an arbitrary text blob: absolute URLs, protocol-
 * relative URLs, and bare-looking domains in quoted attributes.
 *
 * @param {string} text
 * @returns {string[]} Unique lowercased hostnames.
 */
export function extractHostsFromText(text) {
  if (typeof text !== 'string' || !text) return [];
  const hosts = new Set();
  const urlRe = /(?:https?:)?\/\/(?:[A-Za-z0-9_-]+\.)+[A-Za-z]{2,}(?::\d{1,5})?(?=[/"'\s<>?#]|$)/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const host = m[0].replace(/^(?:https?:)?\/\//, '').split(/[:/]/)[0].toLowerCase();
    if (host && host.includes('.')) hosts.add(host);
  }
  const quotedRe = /["']((?:[A-Za-z0-9_-]+\.)+[A-Za-z]{2,})["']/g;
  while ((m = quotedRe.exec(text)) !== null) {
    const host = m[1].toLowerCase();
    if (!/^(png|jpg|jpeg|gif|svg|css|js|json|woff2?|ttf|ico)$/.test(host.split('.').pop())) hosts.add(host);
  }
  return [...hosts];
}

/**
 * Extract host references from a urlscan DOM snapshot (HTML text).
 * Looks at script/link/iframe/form/action/src/href attributes, inline
 * fetch/XHR strings, and HTML comments (idea 00166).
 *
 * @param {string} domHtml
 * @returns {{hosts: string[], bySource: {source: string, hosts: string[]}[]}}
 */
export function extractHostsFromDom(domHtml) {
  if (typeof domHtml !== 'string' || !domHtml) return { hosts: [], bySource: [] };
  const bySource = [];
  const record = (source, hosts) => { if (hosts.length) bySource.push({ source, hosts }); };

  const attrRe = /(?:src|href|action|data-src|poster|cite)\s*=\s*["']([^"']+)["']/gi;
  let m;
  const attrVals = [];
  while ((m = attrRe.exec(domHtml)) !== null) attrVals.push(m[1]);
  record('attributes', [...new Set(attrVals.flatMap(extractHostsFromText))]);

  record('scripts', [...new Set(
    [...domHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((x) => extractHostsFromText(x[1]))
  )]);

  const comments = [...domHtml.matchAll(/<!--([\s\S]*?)-->/g)].map((x) => x[1]).join('\n');
  record('comments', extractHostsFromText(comments));

  const hosts = [...new Set(bySource.flatMap((s) => s.hosts))].sort();
  return { hosts, bySource };
}

/**
 * Extract host references from a urlscan network request list.
 * Each entry may be a urlscan request object or a plain URL string.
 *
 * @param {(object|string)[]} requests
 * @returns {{hosts: {host: string, requestCount: number}[], totalRequests: number}}
 */
export function extractHostsFromRequests(requests = []) {
  const counts = new Map();
  let totalRequests = 0;
  for (const r of requests) {
    const url = typeof r === 'string' ? r
      : (r && r.request && typeof r.request.url === 'string' ? r.request.url
        : (r && typeof r.url === 'string' ? r.url : null));
    if (!url) continue;
    totalRequests++;
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host) counts.set(host, (counts.get(host) || 0) + 1);
    } catch { /* skip malformed */ }
  }
  const hosts = [...counts.entries()]
    .map(([host, requestCount]) => ({ host, requestCount }))
    .sort((a, b) => b.requestCount - a.requestCount || a.host.localeCompare(b.host));
  return { hosts, totalRequests };
}

/**
 * Combine DOM hosts and request-list hosts; tag which hosts are new for the
 * target scope and which appear in both sources (higher confidence).
 *
 * @param {{hosts?: string[]}} domResult Output of extractHostsFromDom.
 * @param {{hosts?: {host: string, requestCount: number}[]}} reqResult Output of extractHostsFromRequests.
 * @param {string} targetDomain
 * @returns {{inScope: {host: string, inDom: boolean, inRequests: boolean, requestCount: number}[], newCount: number}}
 */
export function combineHosts(domResult = {}, reqResult = {}, targetDomain = '') {
  const target = String(targetDomain || '').trim().toLowerCase();
  const reqHosts = new Map((reqResult.hosts || []).map((h) => [h.host, h.requestCount]));
  const domHosts = new Set(domResult.hosts || []);
  const all = new Set([...domHosts, ...reqHosts.keys()]);
  const inScope = [];
  for (const host of all) {
    const scoped = !target || host === target || host.endsWith('.' + target);
    if (!scoped) continue;
    inScope.push({
      host,
      inDom: domHosts.has(host),
      inRequests: reqHosts.has(host),
      requestCount: reqHosts.get(host) || 0,
    });
  }
  inScope.sort((a, b) => Number(b.inDom && b.inRequests) - Number(a.inDom && a.inRequests) || b.requestCount - a.requestCount || a.host.localeCompare(b.host));
  const newCount = inScope.filter((h) => h.host !== target).length;
  return { inScope, newCount };
}

export default {
  extractHostsFromText,
  extractHostsFromDom,
  extractHostsFromRequests,
  combineHosts,
};
