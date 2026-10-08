/**
 * oauthAppDirMiner.js — OAuth app-store redirect URI mining.
 *
 * Covers idea-bank item 00246:
 *  - 00246 OAuth app-store redirect mining: mine public OAuth app
 *    directories for registered redirect URIs that enumerate callback hosts.
 *
 * Pure functions only: callers fetch OAuth app directory data themselves
 * (respecting provider rate limits) and pass the raw data in. No live HTTP
 * here. Functions extract redirect/callback URIs from OAuth client
 * registrations, flag dangerous patterns (wildcards, plain http, localhost),
 * and enumerate the callback hostnames that expand the target's attack
 * surface during an authorized hunt.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

/**
 * Analyze a single redirect URI for risky patterns.
 *
 * @param {string} uri redirect URI
 * @returns {{host: string, scheme: string, isLocalhost: boolean, isPlainHttp: boolean, hasWildcard: boolean, isDeepLink: boolean}}
 */
export function analyzeRedirectUri(uri = '') {
  const raw = String(uri || '').trim();
  const scheme = (raw.match(/^([a-z][a-z0-9+.-]*):/i) || [])[1]?.toLowerCase() || '';
  const hasWildcard = raw.includes('*');
  const isDeepLink = /^[a-z][a-z0-9+.-]*:\/\/\//.test(raw) && !/^(https?|ftp)$/i.test(scheme);
  const host = isDeepLink ? '' : hostFromUrl(raw);
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
  const isPlainHttp = scheme === 'http';
  return { host, scheme, isLocalhost, isPlainHttp, hasWildcard, isDeepLink };
}

/**
 * Score a redirect URI for interest (0-100): rarer callback hosts and risky
 * patterns score higher because they point at less-hardened infrastructure.
 *
 * @param {{host: string, scheme: string, isLocalhost: boolean, isPlainHttp: boolean, hasWildcard: boolean, isDeepLink: boolean}} analysis
 * @returns {number}
 */
export function scoreRedirectUri(analysis) {
  let score = 20;
  if (analysis.hasWildcard) score += 30;
  if (analysis.isPlainHttp) score += 25;
  if (analysis.isDeepLink) score += 10;
  if (analysis.isLocalhost) score -= 10; // local-only, less reachable
  return Math.min(100, Math.max(0, score));
}

/**
 * Parse an OAuth app directory entry's registered redirect URIs.
 *
 * @param {{
 *   clientName?: string, clientId?: string, vendor?: string, provider?: string,
 *   redirectUris?: string[], redirect_uris?: string[], callbackUrls?: string[],
 *   homepageUrl?: string, supportUrl?: string
 * }} entry
 * @returns {{client: string, vendor: string, host: string, uri: string, scheme: string, score: number, flags: string[]}[]}
 */
export function parseOAuthAppEntry(entry = {}) {
  const results = [];
  const client = String(entry?.clientName || entry?.clientId || '').trim();
  const vendor = String(entry?.vendor || entry?.provider || '').trim();

  const uris = [
    ...(entry?.redirectUris || []),
    ...(entry?.redirect_uris || []),
    ...(entry?.callbackUrls || []),
  ];
  for (const field of ['homepageUrl', 'supportUrl']) {
    if (entry?.[field]) uris.push({ uri: entry[field], field });
  }

  const seen = new Set();
  for (const raw of uris) {
    const uri = typeof raw === 'string' ? raw : raw?.uri;
    const field = typeof raw === 'string' ? 'redirectUris' : raw?.field || 'redirectUris';
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    const a = analyzeRedirectUri(uri);
    if (!a.host) continue; // deep links carry no DNS host
    const flags = [];
    if (a.isLocalhost) flags.push('localhost');
    if (a.isPlainHttp) flags.push('plain-http');
    if (a.hasWildcard) flags.push('wildcard');
    if (field === 'homepageUrl') flags.push('homepage');
    if (field === 'supportUrl') flags.push('support');
    results.push({
      client,
      vendor,
      host: a.host,
      uri: String(uri).trim(),
      scheme: a.scheme,
      score: scoreRedirectUri(a),
      flags,
    });
  }
  return results.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}

/**
 * Mine a batch of OAuth app directory entries for target-related callback hosts.
 *
 * @param {object[]} entries raw OAuth client registration objects
 * @param {string} rootDomain
 * @returns {{client: string, vendor: string, host: string, uri: string, scheme: string, score: number, flags: string[]}[]}
 */
export function mineOAuthRedirectHosts(entries = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const brand = root.split('.')[0];
  const out = [];
  for (const entry of entries || []) {
    for (const f of parseOAuthAppEntry(entry)) {
      const related = f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root);
      const vendorHit = String(entry?.vendor || entry?.provider || '')
        .toLowerCase()
        .includes(brand);
      if (related || vendorHit) out.push(f);
    }
  }
  return out.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}
