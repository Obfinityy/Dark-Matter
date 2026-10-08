/**
 * slackAppDirMiner.js — Slack app directory host mining.
 *
 * Covers idea-bank item 00243:
 *  - 00243 Slack app directory host mining: mine Slack app listings for
 *    redirect URLs and support hosts.
 *
 * Pure functions only: callers fetch Slack app directory listing data
 * themselves (respecting Slack rate limits) and pass the raw data in.
 * No live HTTP here. Functions extract OAuth redirect URLs, support links,
 * and webhook/endpoint mentions from listings, classifying hosts by their
 * role (redirect, support, webhook, documentation).
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/** Slack platform hosts that are never target infrastructure. */
export const SLACK_PLATFORM_HOSTS = [
  'slack.com',
  'api.slack.com',
  'slackhq.com',
  'slack-files.com',
  'slack-core.com',
  'slack-imgs.com',
  'slack-redir.net',
  'slack-edge.com',
];

/**
 * Classify a host found in a Slack app listing by source context.
 * @param {string} host
 * @param {string} field source field name (lowercase)
 * @returns {'redirect'|'support'|'webhook'|'documentation'|'other'}
 */
export function classifySlackAppHost(host, field = '') {
  const h = normalizeHostname(host);
  const f = String(field || '').toLowerCase();
  if (/redirect|callback|oauth|authorized/.test(f)) return 'redirect';
  if (
    /webhook|event|subscription|request_url|slash/.test(f) ||
    /(^|[.-])(hook|hooks)([.-]|$)/.test(h)
  )
    return 'webhook';
  if (/support|contact/.test(f)) return 'support';
  if (/privacy|policy|terms|doc/.test(f)) return 'documentation';
  return 'other';
}

/**
 * Parse a single Slack app directory listing into extracted hosts.
 *
 * @param {{
 *   name?: string, developer?: string, description?: string,
 *   redirectUrls?: string[], supportUrl?: string, supportEmail?: string,
 *   privacyPolicyUrl?: string, websiteUrl?: string, requestUrls?: string[]
 * }} listing
 * @returns {{app: string, developer: string, host: string, field: string, kind: string}[]}
 */
export function parseSlackAppListing(listing = {}) {
  const results = [];
  const app = String(listing?.name || '').trim();
  const developer = String(listing?.developer || '').trim();

  const note = (host, field) => {
    const h = normalizeHostname(host);
    if (!h) return;
    if (SLACK_PLATFORM_HOSTS.includes(h)) return;
    results.push({ app, developer, host: h, field, kind: classifySlackAppHost(h, field) });
  };

  for (const url of listing?.redirectUrls || []) {
    note(hostFromUrl(url), 'redirectUrls');
  }
  for (const url of listing?.requestUrls || []) {
    note(hostFromUrl(url), 'requestUrls');
  }
  for (const field of ['supportUrl', 'privacyPolicyUrl', 'websiteUrl']) {
    if (listing?.[field]) note(hostFromUrl(listing[field]), field);
  }

  const desc = String(listing?.description || '');
  for (const m of desc.matchAll(HOSTNAME_RE)) {
    note(m[0], 'description');
  }

  const byHost = new Map();
  for (const r of results) {
    const prev = byHost.get(r.host);
    // Redirect/webhook evidence is more valuable than generic description mentions.
    if (!prev || (prev.kind === 'other' && r.kind !== 'other')) byHost.set(r.host, r);
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine a batch of Slack app listings for target-related hosts.
 *
 * @param {object[]} listings raw listing objects
 * @param {string} rootDomain
 * @returns {{app: string, developer: string, host: string, field: string, kind: string}[]}
 */
export function mineSlackAppListings(listings = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const brand = root.split('.')[0];
  const out = [];
  for (const listing of listings || []) {
    for (const f of parseSlackAppListing(listing)) {
      const related = f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root);
      const devHit = String(listing?.developer || '')
        .toLowerCase()
        .includes(brand);
      if (related || devHit) out.push(f);
    }
  }
  return out.sort((a, b) => a.host.localeCompare(b.host) || a.app.localeCompare(b.app));
}
