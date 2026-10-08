/**
 * auctionWatchlistMatcher.js — brand domain-auction watchlist.
 *
 * Valuable expired domains hit auction platforms (drop-catch services, expiry
 * auctions) where attackers buy brand-adjacent names for phishing. This module
 * scores auction listings against brand patterns and ranks them by combined
 * brand similarity and expiry urgency, so the brand-protection team can bid
 * defensively or prepare takedowns before attackers grab the names.
 *
 * Defensive use only: listings are supplied by the caller (exported from the
 * auction platform of choice); no network I/O happens here.
 */

/**
 * Levenshtein edit distance (small, dependency-free implementation).
 */
export function levenshtein(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x === y) return 0;
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= y.length; j++) prev[j] = cur[j];
  }
  return prev[y.length];
}

/**
 * Strip separators and lowercase for loose brand matching.
 * @param {string} s
 */
export function squashed(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Leet-speak substitutions used to dodge naive brand matching. */
const LEET_MAP = {
  0: 'o',
  1: 'l',
  3: 'e',
  4: 'a',
  5: 's',
  6: 'g',
  7: 't',
  8: 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '+': 't',
};

/**
 * Normalize leet-speak substitutions back to plain letters.
 * @param {string} s
 * @returns {string}
 */
export function normalizeLeet(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[01345678@$!+]/g, c => LEET_MAP[c] || c);
}

/**
 * Brand-similarity signals for an auction-listed domain (0-100 brand score).
 * @param {string} domain
 * @param {string} brand brand label
 * @returns {{score: number, signals: {signal: string, evidence: string}[]}}
 */
export function brandMatchSignals(domain, brand) {
  const d = String(domain || '').toLowerCase();
  const b = String(brand || '').toLowerCase();
  const signals = [];
  let score = 0;
  if (!b) return { score, signals };

  const label = d.split('.')[0] || '';
  if (label === b) {
    signals.push({
      signal: 'exact-brand-label',
      evidence: `auction domain label exactly matches brand "${b}"`,
    });
    score = Math.max(score, 100);
  }
  if (squashed(label).includes(squashed(b)) && label !== b) {
    signals.push({
      signal: 'separator-embedded-brand',
      evidence: `brand "${b}" embedded with separators in "${label}"`,
    });
    score = Math.max(score, 75);
  }
  const dist = levenshtein(label, b);
  if (dist > 0 && dist <= 2 && label.length >= 4 && b.length >= 4) {
    signals.push({
      signal: 'brand-typo',
      evidence: `label "${label}" is edit-distance ${dist} from brand "${b}"`,
    });
    score = Math.max(score, 65);
  }
  // Token-level typo: a hyphen/word-separated token close to the brand
  // (catches "secure-examplle", "login-exampel"). Skipped when the token is
  // the whole label — that case is already covered above.
  for (const token of label.split(/[^a-z0-9]+/).filter(t => t.length >= 4 && t !== label)) {
    const td = levenshtein(token, b);
    if (td > 0 && td <= 2) {
      signals.push({
        signal: 'brand-typo-token',
        evidence: `token "${token}" in "${label}" is edit-distance ${td} from brand "${b}"`,
      });
      score = Math.max(score, 62);
      break;
    }
  }
  // Leet-obfuscated brand (examp1e, micr0soft).
  const leetLabel = normalizeLeet(label);
  if (leetLabel !== label && leetLabel.includes(b)) {
    signals.push({
      signal: 'leet-obfuscated-brand',
      evidence: `brand "${b}" hidden with leet substitutions in "${label}"`,
    });
    score = Math.max(score, 68);
  }
  const affixes = ['get', 'try', 'my', 'go', 'hq', 'app', 'pay', 'shop', 'login', 'secure'];
  for (const affix of affixes) {
    if (squashed(label) === squashed(affix + b) || squashed(label) === squashed(b + affix)) {
      signals.push({
        signal: 'affixed-brand',
        evidence: `brand "${b}" with affix "${affix}" in "${label}"`,
      });
      score = Math.max(score, 70);
      break;
    }
  }
  if (/[^\x00-\x7F]/.test(d)) {
    signals.push({
      signal: 'non-ascii-label',
      evidence: `non-ASCII characters in "${d}" suggest IDN homograph play`,
    });
    score = Math.max(score, 55);
  }
  return { score: Math.min(100, score), signals };
}

/**
 * Days until a listing expires (negative when already expired).
 * @param {string|number|Date} expiresAt
 * @param {number} [nowMs=Date.now()]
 * @returns {number|null}
 */
export function daysUntilExpiry(expiresAt, nowMs = Date.now()) {
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - nowMs) / 86400000);
}

/**
 * Urgency score from expiry proximity (0-100): sooner = more urgent.
 * @param {number|null} days
 */
export function urgencyScore(days) {
  if (days === null || days === undefined) return 20;
  if (days < 0) return 90; // already expired: may already be re-registered
  if (days <= 7) return 100;
  if (days <= 30) return 70;
  if (days <= 90) return 40;
  return 15;
}

/**
 * Score auction listings against brands.
 * Listing shape: {domain, platform, expiresAt, currentBid?, currency?}
 * @param {object[]} listings
 * @param {string[]} brands
 * @param {{minScore?: number}} [opts]
 * @returns ranked matches
 */
export function matchAuctionListings(listings, brands, opts = {}) {
  const { minScore = 40 } = opts;
  const matches = [];
  for (const listing of listings || []) {
    const domain = String(listing?.domain || '').toLowerCase();
    if (!domain) continue;
    let best = { score: 0, signals: [], brand: null };
    for (const brand of brands || []) {
      const r = brandMatchSignals(domain, brand);
      if (r.score > best.score) best = { ...r, brand };
    }
    if (best.score < minScore) continue;
    const days = daysUntilExpiry(listing.expiresAt);
    const urgency = urgencyScore(days);
    const combined = Math.round(best.score * 0.6 + urgency * 0.4);
    matches.push({
      domain,
      brand: best.brand,
      platform: listing.platform || 'unknown',
      expiresAt: listing.expiresAt || null,
      daysUntilExpiry: days,
      currentBid: listing.currentBid ?? null,
      currency: listing.currency || null,
      brandScore: best.score,
      urgency,
      risk: combined,
      evidence:
        best.signals.map(s => s.evidence).join(' | ') +
        (days !== null ? `; expires in ${days} day(s)` : '; expiry date unknown'),
    });
  }
  matches.sort(
    (a, b) => b.risk - a.risk || (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999)
  );
  return matches;
}

/**
 * Watchlist digest for the brand-protection team.
 * @param {ReturnType<typeof matchAuctionListings>} matches
 */
export function summarizeWatchlist(matches) {
  const urgent = (matches || []).filter(m => m.risk >= 70);
  const perBrand = {};
  for (const m of matches || []) perBrand[m.brand] = (perBrand[m.brand] || 0) + 1;
  return {
    total: (matches || []).length,
    urgent: urgent.length,
    perBrand,
    topTargets: urgent.slice(0, 10).map(m => ({
      domain: m.domain,
      platform: m.platform,
      daysUntilExpiry: m.daysUntilExpiry,
      risk: m.risk,
    })),
    summary:
      `${urgent.length} urgent auction target(s) of ${(matches || []).length} brand-matching listings ` +
      `need a defensive-bid or takedown decision before expiry.`,
  };
}

export const AUCTION_WATCHLIST_MATCHER = {
  levenshtein,
  squashed,
  normalizeLeet,
  brandMatchSignals,
  daysUntilExpiry,
  urgencyScore,
  matchAuctionListings,
  summarizeWatchlist,
};

export default AUCTION_WATCHLIST_MATCHER;
