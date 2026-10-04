/**
 * statusPageEnum.js — status-page subdomain enumeration and Statuspage mining.
 *
 * Covers idea-bank item 00247:
 *  - 00247 Status-page subdomain enumeration: find the org's status page
 *    (status.*, statuspage.io) and extract component hostnames from its API.
 *
 * Pure functions only: callers probe the candidate names and fetch the
 * Statuspage API data themselves (respecting rate limits) and pass the raw
 * data in. No live HTTP here. Functions generate candidate status-page
 * hostnames, match candidates against probe results, and extract component
 * hostnames from a Statuspage API summary payload.
 */

import { normalizeHostname } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/** Common first labels used for status pages. */
export const STATUS_PAGE_LABELS = [
  'status', 'statuspage', 'statuspage2', 'uptime', 'health', 'systemstatus',
  'service-status', 'ops', 'operations', 'availability', 'monitoring',
  'ping', 'statusboard', 'reliability', 'incident',
];

/**
 * Generate candidate status-page hostnames for a target root domain.
 *
 * @param {string} rootDomain
 * @param {{providers?: string[]}} [options]
 * @returns {string[]} deduped candidate hostnames
 */
export function statusPageCandidates(rootDomain, options = {}) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const providers = options.providers || ['statuspage.io', 'instatus.com', 'cachet'];
  const names = [root.split('.')[0], root.replace(/\./g, '-')];
  const out = new Set();
  for (const label of STATUS_PAGE_LABELS) {
    out.add(`${label}.${root}`);
  }
  for (const name of names) {
    if (providers.includes('statuspage.io')) out.add(`${name}.statuspage.io`);
    if (providers.includes('instatus.com')) out.add(`${name}.instatus.com`);
    if (providers.includes('cachet')) out.add(`status.${root}`);
  }
  return [...out].sort();
}

/**
 * Match probe results (host -> reachable) against the candidate list.
 *
 * @param {string[]} candidates
 * @param {Record<string, boolean>|{host: string, reachable: boolean}[]} probes
 * @returns {{host: string, reachable: boolean}[]}
 */
export function matchStatusPageProbes(candidates = [], probes = []) {
  const lookup = new Map();
  if (Array.isArray(probes)) {
    for (const p of probes) lookup.set(normalizeHostname(p?.host), !!p?.reachable);
  } else {
    for (const [k, v] of Object.entries(probes)) lookup.set(normalizeHostname(k), !!v);
  }
  return candidates.map((c) => ({ host: c, reachable: !!lookup.get(c) }));
}

/**
 * Extract component hostnames from a Statuspage.io API summary payload.
 *
 * @param {object} summary the public Statuspage /api/v2/summary.json payload
 * @param {string} rootDomain
 * @returns {{component: string, group: string, host: string, evidence: string}[]}
 */
export function extractStatuspageComponentHosts(summary = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root || !summary) return [];
  const groups = new Map();
  for (const g of summary?.components_group || []) {
    groups.set(String(g?.id || ''), String(g?.name || ''));
  }
  const results = [];
  for (const comp of summary?.components || []) {
    const name = String(comp?.name || '');
    const group = groups.get(String(comp?.group_id || '')) || '';
    const haystack = `${name} ${group}`;
    for (const m of haystack.matchAll(HOSTNAME_RE)) {
      const h = normalizeHostname(m[0]);
      if (h === root || h.endsWith(`.${root}`) || h.includes(root)) {
        results.push({ component: name, group, host: h, evidence: m[0] });
      }
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host) || a.component.localeCompare(b.component));
}
