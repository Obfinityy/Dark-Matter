/**
 * sinkholeBrandFilter.js — sinkhole-feed brand filtering.
 *
 * Sinkholes absorb traffic from domains tied to botnets and phishing kits.
 * When a brand-like domain starts showing up in sinkhole feeds, a phishing
 * campaign is already live. This module filters sinkhole feed entries for
 * brand likeness (substring, typo, IDN homograph), scores campaign activity
 * from query volume and recency, and clusters hits into campaigns so the
 * team can respond while the campaign is still active.
 *
 * Defensive use only: feed entries are supplied by the caller; no network I/O.
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
 * Brand-likeness score for a sinkholed domain (0-100).
 * @param {string} domain
 * @param {string} brand brand label
 * @returns {{score: number, signals: string[]}}
 */
export function brandLikeness(domain, brand) {
  const d = String(domain || '').toLowerCase();
  const b = String(brand || '').toLowerCase();
  const signals = [];
  let score = 0;
  if (!b || !d) return { score, signals };
  const label = d.split('.')[0] || '';

  if (label === b || d.startsWith(`${b}.`)) {
    signals.push(`exact brand match: "${d}"`);
    score = Math.max(score, 100);
  } else if (d.includes(b)) {
    signals.push(`brand "${b}" embedded in "${d}"`);
    score = Math.max(score, 65);
  } else {
    const dist = levenshtein(label, b);
    if (dist > 0 && dist <= 2 && label.length >= 4) {
      signals.push(`typo of brand "${b}" (edit distance ${dist}): "${label}"`);
      score = Math.max(score, 60);
    }
  }
  if (/[^\x00-\x7F]/.test(d) || /(^|\.)xn--/i.test(d)) {
    signals.push(`IDN/punycode form suggests homograph lure: "${d}"`);
    score = Math.max(score, 70);
  }
  const squashed = label.replace(/[^a-z0-9]/g, '');
  if (squashed.includes(b.replace(/[^a-z0-9]/g, '')) && !d.includes(b)) {
    signals.push(`brand "${b}" obfuscated with separators in "${label}"`);
    score = Math.max(score, 68);
  }
  const leetLabel = normalizeLeet(label);
  if (leetLabel !== label && leetLabel.includes(b)) {
    signals.push(`brand "${b}" hidden with leet substitutions in "${label}"`);
    score = Math.max(score, 66);
  }
  return { score: Math.min(100, score), signals };
}

/**
 * Activity score from sinkhole query volume (0-100, log-scaled).
 * @param {number} queryCount
 */
export function queryVolumeScore(queryCount) {
  const q = Number(queryCount) || 0;
  if (q <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(q + 1) * 33));
}

/**
 * Recency score from last-seen timestamp (0-100): fresher = hotter.
 * @param {string|number|Date} lastSeen
 * @param {number} [nowMs=Date.now()]
 */
export function recencyScore(lastSeen, nowMs = Date.now()) {
  const t = new Date(lastSeen).getTime();
  if (Number.isNaN(t)) return 30;
  const hours = (nowMs - t) / 3600000;
  if (hours <= 6) return 100;
  if (hours <= 24) return 80;
  if (hours <= 72) return 55;
  if (hours <= 168) return 30;
  return 10;
}

/**
 * Filter a sinkhole feed for brand-relevant entries.
 * Entry shape: {domain, queryCount?, firstSeen?, lastSeen?, source?}
 * @param {object[]} feed
 * @param {string[]} brands
 * @param {{minScore?: number, nowMs?: number}} [opts]
 */
export function filterSinkholeFeed(feed, brands, opts = {}) {
  const { minScore = 45, nowMs = Date.now() } = opts;
  const matches = [];
  const seen = new Set();
  for (const entry of feed || []) {
    const domain = String(entry?.domain || '')
      .toLowerCase()
      .trim();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    let best = { score: 0, signals: [], brand: null };
    for (const brand of brands || []) {
      const r = brandLikeness(domain, brand);
      if (r.score > best.score) best = { ...r, brand };
    }
    if (best.score < minScore) continue;
    const volume = queryVolumeScore(entry.queryCount);
    const recency = recencyScore(entry.lastSeen, nowMs);
    const activity = Math.round(volume * 0.6 + recency * 0.4);
    const score = Math.round(best.score * 0.55 + activity * 0.45);
    matches.push({
      domain,
      brand: best.brand,
      queryCount: entry.queryCount ?? 0,
      firstSeen: entry.firstSeen || null,
      lastSeen: entry.lastSeen || null,
      source: entry.source || 'unknown',
      brandScore: best.score,
      activity,
      score,
      evidence:
        best.signals.join(' | ') +
        `; ${entry.queryCount ?? 0} sinkhole queries, last seen ${entry.lastSeen || 'unknown'}`,
    });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Cluster filtered hits into campaigns: same brand with overlapping activity
 * windows (firstSeen/lastSeen within windowHours) is one campaign.
 * @param {ReturnType<typeof filterSinkholeFeed>} matches
 * @param {{windowHours?: number}} [opts]
 */
export function clusterSinkholeCampaigns(matches, opts = {}) {
  const { windowHours = 72 } = opts;
  const byBrand = new Map();
  for (const m of matches || []) {
    if (!byBrand.has(m.brand)) byBrand.set(m.brand, []);
    byBrand.get(m.brand).push(m);
  }
  const campaigns = [];
  for (const [brand, items] of byBrand) {
    const sorted = [...items].sort(
      (a, b) => new Date(a.firstSeen || 0) - new Date(b.firstSeen || 0)
    );
    let current = null;
    for (const item of sorted) {
      const start = new Date(item.firstSeen || item.lastSeen || 0).getTime();
      if (current && !Number.isNaN(start) && start - current.windowEnd <= windowHours * 3600000) {
        current.domains.push(item.domain);
        current.entries.push(item);
        current.windowEnd = Math.max(current.windowEnd, start);
        current.totalQueries += item.queryCount || 0;
        current.peakScore = Math.max(current.peakScore, item.score);
      } else {
        current = {
          brand,
          domains: [item.domain],
          entries: [item],
          windowEnd: Number.isNaN(start) ? 0 : start,
          totalQueries: item.queryCount || 0,
          peakScore: item.score,
        };
        campaigns.push(current);
      }
    }
  }
  campaigns.sort((a, b) => b.peakScore - a.peakScore || b.totalQueries - a.totalQueries);
  return campaigns.map(c => ({
    brand: c.brand,
    domainCount: c.domains.length,
    domains: c.domains,
    totalQueries: c.totalQueries,
    peakScore: c.peakScore,
    verdict:
      c.peakScore >= 70 && c.totalQueries > 100
        ? 'active campaign — prioritize takedown'
        : c.peakScore >= 55
          ? 'emerging activity — monitor and prepare blocklist'
          : 'low activity — keep on watchlist',
  }));
}

/**
 * Campaign summary for the incident-response team.
 * @param {ReturnType<typeof clusterSinkholeCampaigns>} campaigns
 */
export function summarizeSinkholeCampaigns(campaigns) {
  const active = (campaigns || []).filter(c => c.verdict.startsWith('active'));
  return {
    total: (campaigns || []).length,
    active: active.length,
    topCampaigns: active.slice(0, 5).map(c => ({
      brand: c.brand,
      domains: c.domains.slice(0, 10),
      totalQueries: c.totalQueries,
    })),
    summary:
      `${active.length} active phishing campaign(s) detected in sinkhole data ` +
      `across ${(campaigns || []).length} brand cluster(s).`,
  };
}

export const SINKHOLE_BRAND_FILTER = {
  levenshtein,
  normalizeLeet,
  brandLikeness,
  queryVolumeScore,
  recencyScore,
  filterSinkholeFeed,
  clusterSinkholeCampaigns,
  summarizeSinkholeCampaigns,
};

export default SINKHOLE_BRAND_FILTER;
