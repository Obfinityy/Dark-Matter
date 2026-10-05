/**
 * domainAuctionWatchlist.js — brand domain-auction watchlist engine.
 *
 * Covers idea-bank item 0305:
 *  - 0305 Brand domain-auction watchlist — monitor auction platforms for
 *    expiring domains matching brand patterns before attackers grab them.
 *
 * Pure functions only: the engine evaluates auction/expired-domain listings
 * (fetched by the caller from auction platforms or drop lists) against
 * brand patterns and scores how urgently each listing deserves attention.
 * No network calls here.
 */

/**
 * Build the set of match patterns for a brand: the exact token plus common
 * phishing-style constructions around it.
 *
 * @param {string} brand Brand token
 * @returns {{pattern: string, kind: string, baseWeight: number}[]}
 */
export function buildBrandAuctionPatterns(brand) {
  const b = String(brand || '')
    .trim()
    .toLowerCase()
    .split('/')[0]
    .split('.')[0]
    .replace(/[^a-z0-9-]/g, '');
  if (!b) return [];
  return [
    { pattern: b, kind: 'exact-brand', baseWeight: 100 },
    { pattern: `${b}-official`, kind: 'official-variant', baseWeight: 80 },
    { pattern: `${b}-login`, kind: 'credential-phish', baseWeight: 85 },
    { pattern: `${b}-secure`, kind: 'security-phish', baseWeight: 85 },
    { pattern: `${b}-verify`, kind: 'verify-phish', baseWeight: 85 },
    { pattern: `${b}-support`, kind: 'support-phish', baseWeight: 75 },
    { pattern: `${b}-app`, kind: 'app-variant', baseWeight: 60 },
    { pattern: `my${b}`, kind: 'possessive-variant', baseWeight: 60 },
    { pattern: `get${b}`, kind: 'call-to-action-variant', baseWeight: 60 },
    { pattern: `${b}pay`, kind: 'payments-phish', baseWeight: 70 },
    { pattern: `${b}wallet`, kind: 'wallet-phish', baseWeight: 70 },
  ];
}

/**
 * Normalize an auction listing domain.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeListingDomain(domain) {
  if (!domain) return '';
  return String(domain).trim().toLowerCase().replace(/^\w+:\/\//, '').split('/')[0].replace(/\.$/, '');
}

/**
 * Score a single auction listing against brand patterns.
 *
 * @param {{domain: string, price?: number|string, endsAt?: string, bids?: number, backorders?: number, source?: string}} listing
 * @param {{pattern: string, kind: string, baseWeight: number}[]} patterns Output of buildBrandAuctionPatterns
 * @param {string[]} defensiveDomains Known org-owned domains to exclude
 * @returns {{
 *   domain: string, matched: boolean, kind: string|null, score: number,
 *   reasons: string[], urgency: 'critical'|'high'|'medium'|'low'|'none'
 * }}
 */
export function scoreAuctionListing(listing, patterns = [], defensiveDomains = []) {
  const domain = normalizeListingDomain(listing?.domain);
  const result = { domain, matched: false, kind: null, score: 0, reasons: [], urgency: 'none' };
  if (!domain) return result;

  const defensive = new Set((defensiveDomains || []).map((d) => normalizeListingDomain(d)));
  if (defensive.has(domain)) {
    result.reasons.push('org-owned defensive domain — ignored');
    return result;
  }

  const label = domain.split('.').slice(0, -1).join('.') || domain;
  const tld = domain.includes('.') ? domain.split('.').pop() : '';

  let best = null;
  for (const p of patterns || []) {
    const needle = p.pattern.toLowerCase();
    if (label === needle) {
      best = p;
      break; // exact label match wins immediately
    }
    if (label.includes(needle)) {
      if (!best || p.baseWeight > best.baseWeight) best = p;
    }
  }
  if (!best) return result;

  result.matched = true;
  result.kind = best.kind;
  let score = best.baseWeight;
  const reasons = [`matches brand pattern "${best.pattern}" (${best.kind})`];

  // Short, clean, high-value TLDs are the most attractive to squatters.
  const premiumTlds = new Set(['com', 'net', 'org', 'io', 'co']);
  if (premiumTlds.has(tld)) {
    score += 10;
    reasons.push(`premium TLD .${tld}`);
  }

  // Competition signals: bids/backorders mean someone else already wants it.
  const bids = Number(listing?.bids) || 0;
  const backorders = Number(listing?.backorders) || 0;
  if (bids > 0) {
    score += Math.min(15, bids * 3);
    reasons.push(`${bids} bid(s) placed`);
  }
  if (backorders > 0) {
    score += Math.min(10, backorders * 5);
    reasons.push(`${backorders} backorder(s)`);
  }

  // Auction ending soon = decision pressure.
  if (listing?.endsAt) {
    const ms = Date.parse(listing.endsAt) - Date.now();
    if (!Number.isNaN(ms) && ms > 0 && ms < 48 * 3600 * 1000) {
      score += 10;
      reasons.push('auction ends within 48h');
    }
  }

  result.score = Math.min(100, Math.round(score));
  result.reasons = reasons;
  result.urgency =
    result.score >= 85 ? 'critical'
    : result.score >= 70 ? 'high'
    : result.score >= 50 ? 'medium'
    : 'low';
  return result;
}

/**
 * Run the watchlist over a batch of auction listings.
 *
 * @param {{domain: string, price?: number|string, endsAt?: string, bids?: number, backorders?: number, source?: string}[]} listings
 * @param {string} brand Brand token
 * @param {{minScore?: number, defensiveDomains?: string[]}} [options]
 * @returns {{hits: ReturnType<typeof scoreAuctionListing>[], ignored: number, byUrgency: Record<string, number>}}
 */
export function runAuctionWatchlist(listings = [], brand, options = {}) {
  const patterns = buildBrandAuctionPatterns(brand);
  const minScore = options.minScore ?? 40;
  const defensiveDomains = options.defensiveDomains || [];

  const hits = [];
  let ignored = 0;
  for (const listing of listings || []) {
    const scored = scoreAuctionListing(listing, patterns, defensiveDomains);
    if (!scored.domain || !scored.matched || scored.score < minScore) {
      ignored++;
      continue;
    }
    hits.push(scored);
  }

  hits.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const byUrgency = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const h of hits) byUrgency[h.urgency] = (byUrgency[h.urgency] || 0) + 1;

  return { hits, ignored, byUrgency };
}

/**
 * Render watchlist hits into a human-readable daily digest (one line per
 * hit), suitable for inclusion in a brand-protection report.
 *
 * @param {ReturnType<typeof runAuctionWatchlist>['hits']} hits
 * @returns {string[]}
 */
export function auctionWatchlistDigest(hits = []) {
  return (hits || []).map(
    (h) =>
      `[${h.urgency.toUpperCase()}] ${h.domain} (score ${h.score}, ${h.kind}) — ${h.reasons.join('; ')}`
  );
}
