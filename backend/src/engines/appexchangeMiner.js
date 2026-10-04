/**
 * appexchangeMiner.js — Salesforce AppExchange listing hostname intelligence.
 *
 * Covers idea-bank item 00241:
 *  - 00241 Salesforce AppExchange listing mining: mine AppExchange listings
 *    for the org's support and demo hosts.
 *
 * Pure functions only: callers fetch AppExchange listing pages/API data
 * themselves (respecting Salesforce rate limits) and pass the raw data in.
 * No live HTTP here. Functions parse listing fields (support URLs, demo
 * links, publisher sites) and extract hostnames that can reveal staging,
 * demo, and support infrastructure related to the target organization.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/**
 * Classify a host found in an AppExchange listing by the listing field
 * context it came from.
 * @param {string} host
 * @param {string} field source field name (lowercase)
 * @returns {'support'|'demo'|'publisher'|'documentation'|'other'}
 */
export function classifyAppexchangeHost(host, field = '') {
  const h = normalizeHostname(host);
  const f = String(field || '').toLowerCase();
  if (/support/.test(f)) return 'support';
  if (/demo|trial|playground|sandbox/.test(f) || /(^|[.-])(demo|trial|sandbox)([.-]|$)/.test(h)) return 'demo';
  if (/publisher|vendor|website|company/.test(f)) return 'publisher';
  if (/doc|guide|help|knowledge/.test(f)) return 'documentation';
  return 'other';
}

/**
 * Fields of an AppExchange listing that may carry URLs.
 */
export const APPEXCHANGE_URL_FIELDS = [
  'supportUrl', 'demoUrl', 'websiteUrl', 'documentationUrl',
  'supportEmailUrl', 'privacyPolicyUrl', 'termsUrl', 'videoUrl',
];

/**
 * Parse a single AppExchange listing into extracted hosts.
 *
 * @param {{
 *   name?: string, publisher?: string, description?: string,
 *   supportUrl?: string, demoUrl?: string, websiteUrl?: string,
 *   documentationUrl?: string, supportEmail?: string, categories?: string[]
 * }} listing
 * @returns {{app: string, publisher: string, host: string, field: string, kind: string}[]}
 */
export function parseAppexchangeListing(listing = {}) {
  const results = [];
  const app = String(listing?.name || '').trim();
  const publisher = String(listing?.publisher || '').trim();

  const note = (host, field) => {
    const h = normalizeHostname(host);
    if (!h) return;
    results.push({ app, publisher, host: h, field, kind: classifyAppexchangeHost(h, field) });
  };

  for (const field of APPEXCHANGE_URL_FIELDS) {
    const value = listing?.[field];
    if (!value) continue;
    note(hostFromUrl(value), field);
  }

  // Hostnames mentioned in the free-text description (e.g. "connects to api.example.com").
  const desc = String(listing?.description || '');
  for (const m of desc.matchAll(HOSTNAME_RE)) {
    note(m[0], 'description');
  }

  // Dedupe by host, preferring the most specific field classification.
  const byHost = new Map();
  for (const r of results) {
    if (!byHost.has(r.host)) byHost.set(r.host, r);
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine a batch of AppExchange listings for hosts related to the target.
 *
 * @param {object[]} listings raw listing objects
 * @param {string} rootDomain
 * @returns {{app: string, publisher: string, host: string, field: string, kind: string}[]}
 */
export function mineAppexchangeListings(listings = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const out = [];
  for (const listing of listings || []) {
    const found = parseAppexchangeListing(listing);
    for (const f of found) {
      const related = f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root);
      const publisherHit = String(listing?.publisher || '').toLowerCase().includes(root.split('.')[0]);
      if (related || publisherHit) out.push(f);
    }
  }
  return out.sort((a, b) => a.host.localeCompare(b.host) || a.app.localeCompare(b.app));
}
