/**
 * servicenowStoreMiner.js — ServiceNow store app host extraction.
 *
 * Covers idea-bank item 00242:
 *  - 00242 ServiceNow store app host extraction: extract support URLs from
 *    ServiceNow store listings.
 *
 * Pure functions only: callers fetch ServiceNow store listing data
 * themselves (respecting ServiceNow rate limits) and pass the raw data in.
 * No live HTTP here. Functions extract support URLs, documentation links,
 * and publisher websites from store listings and classify the discovered
 * hosts by their support/infrastructure role.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/**
 * Classify a host found in a ServiceNow store listing by source field.
 * @param {string} host
 * @param {string} field source field name (lowercase)
 * @returns {'support'|'documentation'|'publisher'|'demo'|'other'}
 */
export function classifyServiceNowStoreHost(host, field = '') {
  const h = normalizeHostname(host);
  const f = String(field || '').toLowerCase();
  if (/support|contact/.test(f)) return 'support';
  if (/doc|guide|release|note|kb/.test(f)) return 'documentation';
  if (/publisher|vendor|developer|website/.test(f)) return 'publisher';
  if (/demo|trial|sandbox/.test(f) || /(^|[.-])(demo|trial|sandbox)([.-]|$)/.test(h)) return 'demo';
  return 'other';
}

/**
 * Fields of a ServiceNow store listing that may carry URLs.
 */
export const SERVICENOW_STORE_URL_FIELDS = [
  'supportUrl',
  'supportEmailUrl',
  'documentationUrl',
  'websiteUrl',
  'publisherUrl',
  'privacyPolicyUrl',
  'termsUrl',
  'demoUrl',
];

/**
 * Parse a single ServiceNow store listing into extracted hosts.
 *
 * @param {{
 *   name?: string, publisher?: string, description?: string,
 *   supportUrl?: string, documentationUrl?: string, websiteUrl?: string,
 *   publisherUrl?: string, demoUrl?: string, [key: string]: unknown
 * }} listing
 * @returns {{app: string, publisher: string, host: string, field: string, kind: string}[]}
 */
export function parseServiceNowStoreListing(listing = {}) {
  const results = [];
  const app = String(listing?.name || '').trim();
  const publisher = String(listing?.publisher || '').trim();

  const note = (host, field) => {
    const h = normalizeHostname(host);
    if (!h) return;
    results.push({ app, publisher, host: h, field, kind: classifyServiceNowStoreHost(h, field) });
  };

  for (const field of SERVICENOW_STORE_URL_FIELDS) {
    const value = listing?.[field];
    if (!value) continue;
    note(hostFromUrl(value), field);
  }

  const desc = String(listing?.description || '');
  for (const m of desc.matchAll(HOSTNAME_RE)) {
    note(m[0], 'description');
  }

  const byHost = new Map();
  for (const r of results) {
    if (!byHost.has(r.host)) byHost.set(r.host, r);
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine a batch of ServiceNow store listings for target-related hosts.
 *
 * @param {object[]} listings raw listing objects
 * @param {string} rootDomain
 * @returns {{app: string, publisher: string, host: string, field: string, kind: string}[]}
 */
export function mineServiceNowStoreListings(listings = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const brand = root.split('.')[0];
  const out = [];
  for (const listing of listings || []) {
    for (const f of parseServiceNowStoreListing(listing)) {
      const related = f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root);
      const publisherHit = String(listing?.publisher || '')
        .toLowerCase()
        .includes(brand);
      if (related || publisherHit) out.push(f);
    }
  }
  return out.sort((a, b) => a.host.localeCompare(b.host) || a.app.localeCompare(b.app));
}
