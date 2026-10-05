/**
 * nrdFeedFilter.js — newly-registered-domain (NRD) feed filtering.
 *
 * Phishing domains are most dangerous in the first hours after registration,
 * before blocklists catch up. NRD feeds (Certificate Transparency logs, zone
 * file diffs, registrar feeds) list fresh domains daily. This module filters
 * those feeds for brand substrings, confusable characters, and deceptive
 * keywords near the brand, ranking fresh threats so analysts can act within
 * hours of registration.
 *
 * Defensive use only: feed entries are supplied by the caller; no network I/O.
 */

/** Deceptive keywords commonly paired with brands in fresh phishing domains. */
export const PHISHING_KEYWORDS = [
  'login', 'signin', 'verify', 'secure', 'account', 'update', 'support',
  'wallet', 'billing', 'payment', 'password', 'reset', 'confirm', 'auth',
  'official', 'portal', 'service', 'online', 'security', 'alert', 'notice',
];

/** Leet-speak substitutions used to dodge naive brand matching. */
const LEET_MAP = {
  0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b',
  '@': 'a', $: 's', '!': 'i', '+': 't',
};

/**
 * Normalize leet-speak substitutions back to plain letters.
 * @param {string} s
 * @returns {string}
 */
export function normalizeLeet(s) {
  return String(s || '').toLowerCase().replace(/[01345678@$!+]/g, (c) => LEET_MAP[c] || c);
}

/**
 * Brand hit signals for a single domain (0-100 relevance).
 * @param {string} domain
 * @param {string} brand brand label
 * @returns {{score: number, signals: {signal: string, evidence: string}[]}}
 */
export function brandHitSignals(domain, brand) {
  const d = String(domain || '').toLowerCase();
  const b = String(brand || '').toLowerCase();
  const signals = [];
  let score = 0;
  if (!b || !d) return { score, signals };
  const label = d.split('.')[0] || '';

  if (label === b || d.startsWith(`${b}.`)) {
    signals.push({ signal: 'exact-brand', evidence: `domain is exactly the brand: "${d}"` });
    score = Math.max(score, 100);
  } else if (d.includes(b)) {
    const keyword = PHISHING_KEYWORDS.find((k) => label.includes(k));
    if (keyword) {
      signals.push({ signal: 'brand-plus-keyword', evidence: `brand "${b}" with phishing keyword "${keyword}" in "${label}"` });
      score = Math.max(score, 85);
    } else {
      signals.push({ signal: 'brand-substring', evidence: `brand "${b}" embedded in "${d}"` });
      score = Math.max(score, 60);
    }
  }
  if (/[^\x00-\x7F]/.test(d)) {
    signals.push({ signal: 'non-ascii', evidence: `non-ASCII characters in "${d}" suggest IDN homograph` });
    score = Math.max(score, 70);
  }
  const leetLabel = normalizeLeet(label);
  if (leetLabel !== label && leetLabel.includes(b)) {
    signals.push({ signal: 'leet-obfuscated-brand', evidence: `brand "${b}" hidden with leet substitutions in fresh domain "${d}"` });
    score = Math.max(score, 80);
  }
  const squashedLabel = label.replace(/[^a-z0-9]/g, '');
  const squashedBrand = b.replace(/[^a-z0-9]/g, '');
  if (squashedLabel.includes(squashedBrand) && !d.includes(b)) {
    signals.push({ signal: 'separator-obfuscated-brand', evidence: `brand "${b}" hidden behind separators in "${label}"` });
    score = Math.max(score, 75);
  }
  return { score: Math.min(100, score), signals };
}

/**
 * Age of a feed entry in hours.
 * @param {string|number|Date} firstSeen
 * @param {number} [nowMs=Date.now()]
 * @returns {number|null}
 */
export function entryAgeHours(firstSeen, nowMs = Date.now()) {
  const t = new Date(firstSeen).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (nowMs - t) / 3600000);
}

/**
 * Score one NRD entry: brand relevance plus a freshness bonus, because a
 * brand-matching domain registered hours ago is far more likely to be an
 * active phishing setup than an aged one.
 * @param {string} domain
 * @param {string} brand
 * @param {number|null} ageHours
 * @returns {{score: number, signals: object[]}}
 */
export function scoreNrdEntry(domain, brand, ageHours) {
  const { score: relevance, signals } = brandHitSignals(domain, brand);
  let freshness = 0;
  if (ageHours !== null && ageHours !== undefined) {
    if (ageHours <= 24) freshness = 30;
    else if (ageHours <= 72) freshness = 20;
    else if (ageHours <= 168) freshness = 10;
  }
  return { score: Math.min(100, relevance + freshness), signals };
}

/**
 * Filter an NRD feed for brand threats.
 * Entry shape: {domain, firstSeen, source?}
 * @param {object[]} feed
 * @param {string[]} brands
 * @param {{maxAgeHours?: number, minScore?: number, nowMs?: number}} [opts]
 * @returns ranked matches, freshest and most relevant first
 */
export function filterNrdFeed(feed, brands, opts = {}) {
  const { maxAgeHours = 168, minScore = 50, nowMs = Date.now() } = opts;
  const matches = [];
  const seen = new Set();
  for (const entry of feed || []) {
    const domain = String(entry?.domain || '').toLowerCase().trim();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const ageHours = entryAgeHours(entry.firstSeen, nowMs);
    if (ageHours !== null && ageHours > maxAgeHours) continue;
    let best = { score: 0, signals: [], brand: null };
    for (const brand of brands || []) {
      const r = scoreNrdEntry(domain, brand, ageHours);
      if (r.score > best.score) best = { ...r, brand };
    }
    if (best.score < minScore) continue;
    matches.push({
      domain,
      brand: best.brand,
      firstSeen: entry.firstSeen || null,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      source: entry.source || 'unknown',
      score: best.score,
      evidence: best.signals.map((s) => s.evidence).join(' | ') +
        (ageHours !== null ? `; first seen ${Math.round(ageHours)}h ago` : ''),
    });
  }
  matches.sort((a, b) => b.score - a.score || (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9));
  return matches;
}

/**
 * Group matches by brand for the daily digest.
 * @param {ReturnType<typeof filterNrdFeed>} matches
 */
export function groupByBrand(matches) {
  const groups = {};
  for (const m of matches || []) {
    (groups[m.brand] = groups[m.brand] || []).push(m);
  }
  return groups;
}

/**
 * Daily digest summary.
 * @param {ReturnType<typeof filterNrdFeed>} matches
 */
export function summarizeNrdDigest(matches) {
  const critical = (matches || []).filter((m) => m.score >= 85);
  const groups = groupByBrand(matches);
  return {
    total: (matches || []).length,
    critical: critical.length,
    perBrand: Object.fromEntries(Object.entries(groups).map(([b, ms]) => [b, ms.length])),
    topThreats: critical.slice(0, 10).map((m) => ({
      domain: m.domain,
      ageHours: m.ageHours,
      score: m.score,
    })),
    summary: `${critical.length} critical and ${(matches || []).length - critical.length} ` +
      `elevated fresh domain(s) matched brand patterns in this feed window.`,
  };
}

export const NRD_FEED_FILTER = {
  PHISHING_KEYWORDS,
  normalizeLeet,
  brandHitSignals,
  entryAgeHours,
  scoreNrdEntry,
  filterNrdFeed,
  groupByBrand,
  summarizeNrdDigest,
};

export default NRD_FEED_FILTER;
