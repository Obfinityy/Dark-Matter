/**
 * zoomMarketplaceMiner.js — Zoom Marketplace app mining.
 *
 * Covers idea-bank item 00245:
 *  - 00245 Zoom Marketplace app mining: extract OAuth redirect and webhook
 *    hosts from Zoom app listings.
 *
 * Pure functions only: callers fetch Zoom Marketplace listing data
 * themselves (respecting Zoom rate limits) and pass the raw data in.
 * No live HTTP here. Functions extract OAuth redirect URLs, event
 * notification (webhook) endpoints, support links, and developer sites from
 * listings, classifying hosts by role.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/** Zoom platform hosts that are never target infrastructure. */
export const ZOOM_PLATFORM_HOSTS = [
  'zoom.us', 'api.zoom.us', 'marketplace.zoom.us', 'developers.zoom.us',
  'zoom.com', 'zoomgov.com',
];

/**
 * Classify a host found in a Zoom app listing by source context.
 * @param {string} host
 * @param {string} field source field name (lowercase)
 * @returns {'oauthRedirect'|'webhook'|'support'|'developer'|'documentation'|'other'}
 */
export function classifyZoomMarketplaceHost(host, field = '') {
  const h = normalizeHostname(host);
  const f = String(field || '').toLowerCase();
  if (/redirect|callback|oauth|authorized/.test(f)) return 'oauthRedirect';
  if (/webhook|notification|event|deauthorization|endpoint/.test(f) || /(^|[.-])hook([.-]|$)/.test(h)) return 'webhook';
  if (/support|contact/.test(f)) return 'support';
  if (/developer|publisher|vendor|company|website/.test(f)) return 'developer';
  if (/doc|guide|privacy|terms/.test(f)) return 'documentation';
  return 'other';
}

/**
 * Parse a single Zoom Marketplace listing into extracted hosts.
 *
 * @param {{
 *   name?: string, developer?: string, description?: string,
 *   redirectUrls?: string[], redirectUrl?: string, webhookUrl?: string,
 *   eventNotificationEndpointUrl?: string, supportUrl?: string,
 *   developerUrl?: string, privacyPolicyUrl?: string
 * }} listing
 * @returns {{app: string, developer: string, host: string, field: string, kind: string}[]}
 */
export function parseZoomMarketplaceListing(listing = {}) {
  const results = [];
  const app = String(listing?.name || '').trim();
  const developer = String(listing?.developer || '').trim();

  const note = (host, field) => {
    const h = normalizeHostname(host);
    if (!h) return;
    if (ZOOM_PLATFORM_HOSTS.includes(h)) return;
    results.push({ app, developer, host: h, field, kind: classifyZoomMarketplaceHost(h, field) });
  };

  const redirectFields = ['redirectUrls', 'redirectUris', 'redirect_uris'];
  for (const field of redirectFields) {
    for (const url of listing?.[field] || []) note(hostFromUrl(url), field);
  }
  if (listing?.redirectUrl) note(hostFromUrl(listing.redirectUrl), 'redirectUrl');
  if (listing?.redirect_uri) note(hostFromUrl(listing.redirect_uri), 'redirect_uri');

  for (const field of ['webhookUrl', 'eventNotificationEndpointUrl', 'deauthorizationEndpointUrl', 'dataComplianceEndpointUrl']) {
    if (listing?.[field]) note(hostFromUrl(listing[field]), field);
  }
  for (const field of ['supportUrl', 'developerUrl', 'privacyPolicyUrl', 'termsUrl']) {
    if (listing?.[field]) note(hostFromUrl(listing[field]), field);
  }

  const desc = String(listing?.description || '');
  for (const m of desc.matchAll(HOSTNAME_RE)) {
    note(m[0], 'description');
  }

  const byHost = new Map();
  for (const r of results) {
    const prev = byHost.get(r.host);
    if (!prev || (prev.kind === 'other' && r.kind !== 'other')) byHost.set(r.host, r);
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine a batch of Zoom Marketplace listings for target-related hosts.
 *
 * @param {object[]} listings raw listing objects
 * @param {string} rootDomain
 * @returns {{app: string, developer: string, host: string, field: string, kind: string}[]}
 */
export function mineZoomMarketplaceListings(listings = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const brand = root.split('.')[0];
  const out = [];
  for (const listing of listings || []) {
    for (const f of parseZoomMarketplaceListing(listing)) {
      const related = f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root);
      const devHit = String(listing?.developer || '').toLowerCase().includes(brand);
      if (related || devHit) out.push(f);
    }
  }
  return out.sort((a, b) => a.host.localeCompare(b.host) || a.app.localeCompare(b.app));
}
