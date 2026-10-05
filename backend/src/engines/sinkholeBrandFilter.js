/**
 * sinkholeBrandFilter.js — sinkhole-data brand filtering engine.
 *
 * Covers idea-bank item 0310:
 *  - 0310 Sinkhole-data brand filtering — filter sinkhole feeds for
 *    brand-like domains to catch active phishing campaigns early.
 *
 * Pure functions only: the engine filters sinkhole feed entries
 * (supplied by the caller — e.g. sinkhole operator exports) for
 * brand-like domains, scores campaign likelihood, and groups hits into
 * likely campaigns. No network calls here.
 */

/**
 * Normalize a sinkhole entry domain.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeSinkholeDomain(domain) {
  if (!domain) return '';
  return String(domain).trim().toLowerCase().replace(/^\w+:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
}

/**
 * Check a domain against brand tokens across several impersonation styles:
 * substring, separator-joined, leetspeak-normalized, and punycode-encoded.
 *
 * @param {string} domain Normalized domain
 * @param {string[]} brandTokens
 * @returns {{matches: boolean, token: string|null, styles: string[]}}
 */
export function matchBrandStyles(domain, brandTokens = []) {
  const styles = [];
  let token = null;
  const labels = domain.split('.');
  const regLabel = labels.slice(0, -1).join('') || domain;
  const tld = labels[labels.length - 1] || '';

  const leet = (s) =>
    s
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/3/g, 'e')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's');

  for (const raw of brandTokens || []) {
    const t = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!t) continue;
    if (regLabel.includes(t)) {
      styles.push('substring');
      token = token || t;
    }
    if (leet(regLabel).includes(t) && !styles.includes('leet-normalized')) {
      styles.push('leet-normalized');
      token = token || t;
    }
    if (labels.some((l) => l.replace(/[-_]/g, '') === t)) {
      if (!styles.includes('separator-joined')) styles.push('separator-joined');
      token = token || t;
    }
  }

  // Punycode labels decode to brand-like Unicode — flag for IDN review.
  if (labels.some((l) => l.startsWith('xn--')) && !styles.includes('punycode')) {
    styles.push('punycode');
  }

  return { matches: styles.length > 0, token, styles };
}

/**
 * Score campaign likelihood for a brand-matched sinkhole hit: sinkhole
 * entries with recent first-seen dates, multiple querying sources, and
 * phishing TLDs are the most campaign-like.
 *
 * @param {{domain: string, firstSeen?: string, lastSeen?: string, queryCount?: number, sources?: number}} entry
 * @param {string[]} styles Match styles from matchBrandStyles
 * @returns {{score: number, signals: string[]}}
 */
export function scoreSinkholeCampaignLikelihood(entry, styles = []) {
  const signals = [];
  let score = 30; // brand match already established

  if (styles.includes('punycode')) {
    score += 20;
    signals.push('IDN (punycode) label — likely homograph campaign');
  }
  if (styles.includes('leet-normalized')) {
    score += 15;
    signals.push('leetspeak brand impersonation');
  }
  if (styles.includes('substring')) {
    score += 10;
    signals.push('brand substring in registered label');
  }

  const queries = Number(entry?.queryCount) || 0;
  const sources = Number(entry?.sources) || 0;
  if (queries >= 1000) {
    score += 15;
    signals.push(`${queries} sinkhole queries — active victim traffic`);
  } else if (queries >= 100) {
    score += 10;
    signals.push(`${queries} sinkhole queries`);
  }
  if (sources >= 5) {
    score += 10;
    signals.push(`${sources} distinct querying sources — distributed victims`);
  } else if (sources >= 2) {
    score += 5;
    signals.push(`${sources} querying sources`);
  }

  if (entry?.firstSeen && entry?.lastSeen) {
    const first = Date.parse(entry.firstSeen);
    const last = Date.parse(entry.lastSeen);
    if (!Number.isNaN(first) && !Number.isNaN(last)) {
      const ageDays = (Date.now() - first) / (24 * 3600 * 1000);
      const spanDays = (last - first) / (24 * 3600 * 1000);
      if (ageDays <= 7) {
        score += 10;
        signals.push('first seen within the last 7 days — fresh campaign');
      }
      if (spanDays >= 3) {
        score += 5;
        signals.push(`sustained activity over ${Math.round(spanDays)} days`);
      }
    }
  }

  return { score: Math.min(100, Math.round(score)), signals };
}

/**
 * Filter sinkhole feed entries for brand-like domains.
 *
 * @param {{domain: string, firstSeen?: string, lastSeen?: string, queryCount?: number, sources?: number}[]} entries
 * @param {string[]} brandTokens
 * @param {{minScore?: number, defensiveDomains?: string[]}} [options]
 * @returns {{hits: {domain: string, token: string|null, styles: string[], score: number, signals: string[], firstSeen: string|null, queryCount: number}[], scanned: number, skippedDefensive: number}}
 */
export function filterSinkholeFeed(entries = [], brandTokens = [], options = {}) {
  const minScore = options.minScore ?? 40;
  const defensive = new Set((options.defensiveDomains || []).map(normalizeSinkholeDomain));

  const hits = [];
  const seen = new Set();
  let scanned = 0;
  let skippedDefensive = 0;

  for (const entry of entries || []) {
    const domain = normalizeSinkholeDomain(entry?.domain);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    scanned++;
    if (defensive.has(domain)) {
      skippedDefensive++;
      continue;
    }

    const { matches, token, styles } = matchBrandStyles(domain, brandTokens);
    if (!matches) continue;
    const { score, signals } = scoreSinkholeCampaignLikelihood(entry, styles);
    if (score < minScore) continue;

    hits.push({
      domain,
      token,
      styles,
      score,
      signals,
      firstSeen: entry?.firstSeen ? String(entry.firstSeen) : null,
      queryCount: Number(entry?.queryCount) || 0,
    });
  }

  hits.sort((a, b) => b.score - a.score || b.queryCount - a.queryCount || a.domain.localeCompare(b.domain));
  return { hits, scanned, skippedDefensive };
}

/**
 * Group sinkhole hits into likely phishing campaigns: same brand token +
 * same TLD + first-seen within a 14-day window.
 *
 * @param {ReturnType<typeof filterSinkholeFeed>['hits']} hits
 * @returns {{campaignId: string, token: string|null, tld: string, domains: string[], count: number, totalQueries: number, windowStart: string|null}[]}
 */
export function groupSinkholeCampaigns(hits = []) {
  const WINDOW_MS = 14 * 24 * 3600 * 1000;
  const groups = [];

  const sorted = [...(hits || [])].sort((a, b) => {
    const at = a.firstSeen ? Date.parse(a.firstSeen) : 0;
    const bt = b.firstSeen ? Date.parse(b.firstSeen) : 0;
    return at - bt;
  });

  for (const h of sorted) {
    const tld = h.domain.split('.').pop() || '';
    const seen = h.firstSeen ? Date.parse(h.firstSeen) : NaN;
    let placed = null;
    for (const g of groups) {
      if (g.token !== h.token || g.tld !== tld) continue;
      if (Number.isNaN(seen) || Number.isNaN(g.anchor)) {
        placed = g;
        break;
      }
      if (Math.abs(seen - g.anchor) <= WINDOW_MS) {
        placed = g;
        break;
      }
    }
    if (!placed) {
      placed = {
        campaignId: `campaign-${groups.length + 1}`,
        token: h.token,
        tld,
        domains: [],
        count: 0,
        totalQueries: 0,
        windowStart: h.firstSeen,
        anchor: seen,
      };
      groups.push(placed);
    }
    placed.domains.push(h.domain);
    placed.count++;
    placed.totalQueries += h.queryCount || 0;
  }

  return groups
    .map(({ anchor, ...g }) => ({ ...g, domains: g.domains.sort() }))
    .sort((a, b) => b.totalQueries - a.totalQueries || b.count - a.count);
}
