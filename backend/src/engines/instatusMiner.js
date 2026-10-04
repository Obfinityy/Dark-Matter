/**
 * instatusMiner.js — Instatus page host extraction.
 *
 * Covers idea-bank item 00249:
 *  - 00249 Instatus page host extraction: parse Instatus pages for
 *    monitored service hostnames.
 *
 * Pure functions only: callers fetch Instatus page data themselves
 * (respecting Instatus rate limits) and pass the raw payloads in.
 * No live HTTP here. Functions parse the Instatus page JSON (services,
 * components, monitors) for monitored service names that contain target
 * hostnames, and score how directly each host is tied to the target brand.
 */

import { normalizeHostname } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/**
 * Score how strongly an Instatus service host is tied to the target.
 *
 * @param {string} host
 * @param {string} rootDomain
 * @returns {number} 0-100 relevance score
 */
export function scoreInstatusHost(host, rootDomain) {
  const h = normalizeHostname(host);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return 0;
  let score = 10;
  if (h === root) score += 50;
  else if (h.endsWith(`.${root}`)) score += 45;
  else if (h.includes(root)) score += 25;
  if (/(^|[.-])(api|web|app|portal|prod|production)([.-]|$)/.test(h)) score += 10;
  if (/(^|[.-])(staging|stage|dev|test|qa|internal|mon|monitor)([.-]|$)/.test(h)) score += 15;
  return Math.min(100, score);
}

/**
 * Parse an Instatus page payload into monitored service hosts.
 *
 * @param {{
 *   name?: string, subdomain?: string,
 *   components?: {name?: string, url?: string, status?: string, group?: string}[],
 *   services?: {name?: string, url?: string, status?: string}[],
 *   monitors?: {name?: string, url?: string, status?: string}[]
 * }} page Instatus page JSON payload
 * @param {string} rootDomain
 * @returns {{page: string, host: string, service: string, kind: 'component'|'service'|'monitor', status: string, relevance: number}[]}
 */
export function parseInstatusPage(page = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const pageName = String(page?.name || page?.subdomain || '').trim();
  const results = [];

  const sections = [
    ['component', page?.components],
    ['service', page?.services],
    ['monitor', page?.monitors],
  ];

  for (const [kind, items] of sections) {
    for (const item of items || []) {
      const name = String(item?.name || '');
      const url = String(item?.url || '');
      const haystack = `${name} ${url}`;
      const seen = new Set();
      for (const m of haystack.matchAll(HOSTNAME_RE)) {
        const h = normalizeHostname(m[0]);
        if (!h || seen.has(h)) continue;
        seen.add(h);
        if (!(h === root || h.endsWith(`.${root}`) || h.includes(root))) continue;
        results.push({
          page: pageName, host: h, service: name, kind,
          status: String(item?.status || ''),
          relevance: scoreInstatusHost(h, root),
        });
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance || a.host.localeCompare(b.host));
}

/**
 * Parse multiple Instatus pages at once.
 *
 * @param {object[]} pages Instatus page payloads
 * @param {string} rootDomain
 * @returns {{page: string, host: string, service: string, kind: string, status: string, relevance: number}[]}
 */
export function mineInstatusPages(pages = [], rootDomain) {
  const out = [];
  for (const page of pages || []) {
    out.push(...parseInstatusPage(page, rootDomain));
  }
  return out.sort((a, b) => b.relevance - a.relevance || a.host.localeCompare(b.host));
}
