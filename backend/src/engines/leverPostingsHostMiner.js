/**
 * leverPostingsHostMiner.js — Lever postings API host mining.
 *
 * Lever exposes a public postings API at api.lever.co/v0/postings/<org>
 * returning JSON for every open role. Each posting carries the org's
 * application URLs, logo/media hosts, and location data — a compact map
 * of the careers infrastructure tied to a target.
 *
 * Passive analysis: this module parses Lever API JSON already retrieved
 * in scope and extracts the distinct hosts it references. It does not
 * call the API itself.
 */

export const LEVER_API_BASE = 'https://api.lever.co/v0/postings';

/** Build the public postings URL for an org slug (for the caller's fetcher). */
export function leverPostingsUrl(orgSlug) {
  return `${LEVER_API_BASE}/${encodeURIComponent(String(orgSlug || ''))}`;
}

/**
 * Pull hostnames out of arbitrary JSON-safe values.
 * @param {any} value
 * @param {Set<string>} out
 */
function collectHosts(value, out) {
  if (typeof value === 'string') {
    const rx = /https?:\/\/([^/"'\s<>\]}]+)/gi;
    let m;
    while ((m = rx.exec(value)) !== null) {
      try {
        out.add(new URL(m[0]).hostname.toLowerCase());
      } catch {
        /* ignore */
      }
    }
    // Bare host-like tokens for known Lever-adjacent domains
    const bare = /\b([a-z0-9-]+\.(?:lever\.co|lever\.co\/.*|workable\.com))\b/gi;
    while ((m = bare.exec(value)) !== null) out.add(m[1].toLowerCase().split('/')[0]);
  } else if (Array.isArray(value)) {
    for (const v of value) collectHosts(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectHosts(v, out);
  }
}

/**
 * Mine a Lever postings API response for careers hosts.
 * @param {object|object[]} apiResponse parsed JSON (array of postings or {data:[...]})
 * @param {string} orgSlug org the response was fetched for (for evidence)
 * @returns {{postings: number, hosts: string[], applicationHosts: string[], mediaHosts: string[], locations: string[]}}
 */
export function mineLeverPostings(apiResponse, orgSlug = '') {
  const postings = Array.isArray(apiResponse)
    ? apiResponse
    : (apiResponse && Array.isArray(apiResponse.data) ? apiResponse.data : []);

  const allHosts = new Set();
  const applicationHosts = new Set();
  const mediaHosts = new Set();
  const locations = new Set();

  for (const p of postings) {
    if (!p || typeof p !== 'object') continue;
    collectHosts(p, allHosts);

    for (const key of ['applyUrl', 'hostedUrl', 'url']) {
      if (typeof p[key] === 'string') {
        try { applicationHosts.add(new URL(p[key]).hostname.toLowerCase()); } catch { /* ignore */ }
      }
    }
    for (const key of ['companyLogoUrl', 'logoUrl', 'imageUrl']) {
      if (typeof p[key] === 'string') {
        try { mediaHosts.add(new URL(p[key]).hostname.toLowerCase()); } catch { /* ignore */ }
      }
    }
    const loc = p.categories && p.categories.location;
    if (typeof loc === 'string' && loc.trim()) locations.add(loc.trim());
  }

  return {
    postings: postings.length,
    hosts: [...allHosts].sort(),
    applicationHosts: [...applicationHosts].sort(),
    mediaHosts: [...mediaHosts].sort(),
    locations: [...locations].sort(),
    evidence: orgSlug ? `lever postings API for org "${orgSlug}"` : 'lever postings API response',
  };
}

/**
 * Validate that a response looks like Lever postings JSON (not an error page).
 * @param {any} data
 * @returns {boolean}
 */
export function isLeverPostingsResponse(data) {
  const postings = Array.isArray(data) ? data : (data && data.data);
  if (!Array.isArray(postings) || postings.length === 0) return false;
  const first = postings[0];
  return !!(first && typeof first === 'object' && ('id' in first || 'text' in first || 'hostedUrl' in first));
}

export const LEVER_MINER = {
  leverPostingsUrl,
  mineLeverPostings,
  isLeverPostingsResponse,
  LEVER_API_BASE,
};

export default LEVER_MINER;
