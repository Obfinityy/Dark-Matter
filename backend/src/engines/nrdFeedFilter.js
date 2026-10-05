/**
 * nrdFeedFilter.js — newly-registered-domain (NRD) feed filtering engine.
 *
 * Covers idea-bank item 0306:
 *  - 0306 Newly-registered-domain feed filtering — filter NRD feeds for
 *    brand substrings daily to catch fresh phishing domains within hours
 *    of registration.
 *
 * Pure functions only: the engine filters NRD feed entries (fetched by the
 * caller) for brand matches, scores suspiciousness, and groups hits for
 * triage. No network calls here.
 */

/**
 * Normalize a domain for matching: lowercase, strip scheme/port/path.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeNrdDomain(domain) {
  if (!domain) return '';
  return String(domain).trim().toLowerCase().replace(/^\w+:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
}

/**
 * Fuzzy-normalize a label so separators and leetspeak collapse: remove
 * hyphens/underscores/dots, map 0->o, 1->l, 3->e, 5->s, 7->t, @->a, $->s.
 * @param {string} label
 * @returns {string}
 */
export function fuzzyNormalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[._\-\s]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

/**
 * Score how suspicious a brand match inside an NRD entry is. Exact-brand
 * labels are the most concerning; longer random-looking padding around the
 * brand token suggests generated phishing infrastructure.
 *
 * @param {string} domain Normalized domain
 * @param {string} brandToken Normalized brand token
 * @returns {{score: number, signals: string[]}}
 */
export function scoreNrdSuspiciousness(domain, brandToken) {
  const signals = [];
  let score = 0;
  const labels = domain.split('.');
  const regLabel = labels.slice(0, -1).join('') || domain;

  if (regLabel === brandToken) {
    score += 60;
    signals.push('exact brand label on a fresh registration');
  } else if (regLabel.startsWith(brandToken) || regLabel.endsWith(brandToken)) {
    score += 45;
    signals.push('brand token at label boundary');
  } else {
    score += 30;
    signals.push('brand token embedded in label');
  }

  const padding = regLabel.length - brandToken.length;
  if (padding >= 10) {
    score += 20;
    signals.push('long random-looking padding around brand token');
  } else if (padding >= 5) {
    score += 10;
    signals.push('padding around brand token');
  }

  const riskyWords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'support', 'wallet', 'pay', 'billing', 'reset', 'auth', 'confirm'];
  const found = riskyWords.filter((w) => regLabel.includes(w));
  if (found.length) {
    score += Math.min(20, found.length * 7);
    signals.push(`phishing keywords: ${found.join(', ')}`);
  }

  const riskyTlds = new Set(['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'click', 'buzz', 'rest', 'work', 'cam', 'zip']);
  const tld = labels[labels.length - 1] || '';
  if (riskyTlds.has(tld)) {
    score += 10;
    signals.push(`high-abuse TLD .${tld}`);
  }

  if (/(\d{4,})/.test(regLabel)) {
    score += 5;
    signals.push('numeric run typical of generated domains');
  }

  return { score: Math.min(100, score), signals };
}

/**
 * Filter NRD feed entries for brand matches.
 *
 * @param {{domain: string, firstSeen?: string, registrar?: string}[]} entries NRD feed entries (caller-fetched)
 * @param {string[]} brandTokens Brand tokens to watch
 * @param {{minScore?: number, defensiveDomains?: string[], fuzzy?: boolean}} [options]
 * @returns {{hits: {domain: string, brand: string, score: number, signals: string[], firstSeen: string|null}[], scanned: number, skippedDefensive: number}}
 */
export function filterNrdFeed(entries = [], brandTokens = [], options = {}) {
  const tokens = (brandTokens || [])
    .map((t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  const minScore = options.minScore ?? 35;
  const fuzzy = options.fuzzy !== false;
  const defensive = new Set((options.defensiveDomains || []).map(normalizeNrdDomain));

  const hits = [];
  const seen = new Set();
  let scanned = 0;
  let skippedDefensive = 0;

  for (const entry of entries || []) {
    const domain = normalizeNrdDomain(entry?.domain);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    scanned++;
    if (defensive.has(domain)) {
      skippedDefensive++;
      continue;
    }

    const fuzzyLabel = fuzzy ? fuzzyNormalizeLabel(domain.split('.').slice(0, -1).join('')) : '';
    const plainLabel = domain.split('.').slice(0, -1).join('');

    let bestToken = null;
    let bestScore = 0;
    let bestSignals = [];
    for (const token of tokens) {
      const haystacks = fuzzy ? [plainLabel, fuzzyLabel] : [plainLabel];
      if (!haystacks.some((h) => h.includes(token))) continue;
      const { score, signals } = scoreNrdSuspiciousness(domain, token);
      if (score > bestScore) {
        bestScore = score;
        bestToken = token;
        bestSignals = signals;
      }
    }
    if (bestToken && bestScore >= minScore) {
      hits.push({
        domain,
        brand: bestToken,
        score: bestScore,
        signals: bestSignals,
        firstSeen: entry?.firstSeen ? String(entry.firstSeen) : null,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  return { hits, scanned, skippedDefensive };
}

/**
 * Group NRD hits into likely campaigns: hits sharing the same
 * brand + keyword fingerprint are probably one actor's infrastructure.
 *
 * @param {ReturnType<typeof filterNrdFeed>['hits']} hits
 * @returns {{fingerprint: string, brand: string, domains: string[], count: number, topScore: number}[]}
 */
export function groupNrdCampaigns(hits = []) {
  const groups = new Map();
  for (const h of hits || []) {
    const keywords = h.signals
      .filter((s) => s.startsWith('phishing keywords:'))
      .flatMap((s) => s.replace('phishing keywords: ', '').split(', '))
      .sort()
      .join('+');
    const fingerprint = `${h.brand}::${keywords || 'no-keyword'}`;
    if (!groups.has(fingerprint)) {
      groups.set(fingerprint, { fingerprint, brand: h.brand, domains: [], count: 0, topScore: 0 });
    }
    const g = groups.get(fingerprint);
    g.domains.push(h.domain);
    g.count++;
    g.topScore = Math.max(g.topScore, h.score);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, domains: g.domains.sort() }))
    .sort((a, b) => b.count - a.count || b.topScore - a.topScore);
}
