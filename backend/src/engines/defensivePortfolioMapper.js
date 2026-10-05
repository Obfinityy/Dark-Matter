/**
 * defensivePortfolioMapper.js — defensive-domain portfolio vs attacker-squat
 * classification.
 *
 * Mature brand-protection teams own hundreds of defensive registrations
 * (typos, hyphenated variants, regional TLDs). During triage those must not be
 * confused with live attacker squats. This module maps a candidate domain list
 * against the org's known portfolio and separates:
 *   org-primary  — the org's real production domains
 *   defensive    — org-owned protective registrations (safe, monitor only)
 *   attacker-squat — brand-impersonating domains needing takedown/blocklist
 *   unrelated    — no brand relationship
 *
 * Defensive use only: pure local classification, no network I/O.
 */

/** Keywords attackers prepend/append to brands in phishing domains. */
export const DECEPTIVE_KEYWORDS = [
  'login', 'signin', 'sign-in', 'verify', 'verification', 'secure', 'security',
  'account', 'accounts', 'update', 'support', 'help', 'wallet', 'billing',
  'payment', 'payments', 'password', 'reset', 'confirm', 'auth', 'authenticate',
  'official', 'portal', 'service', 'services', 'online', 'app', 'admin',
];

/**
 * Leet-speak character substitutions attackers use to dodge naive substring
 * matching (examp1e, paypa1, micr0soft).
 */
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
 * Normalise a domain for comparison.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  return String(domain || '').toLowerCase().trim().replace(/\.$/, '').replace(/^www\./, '');
}

/**
 * Levenshtein edit distance (small, dependency-free implementation).
 * @param {string} a
 * @param {string} b
 * @returns {number}
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
 * Detect squat signals between a domain and a brand label.
 * @param {string} domain candidate domain
 * @param {string} brand brand label (no TLD)
 * @returns {{signal: string, evidence: string, weight: number}[]}
 */
export function squatSignals(domain, brand) {
  const d = normalizeDomain(domain);
  const b = String(brand || '').toLowerCase();
  if (!b) return [];
  const signals = [];
  const label = d.split('.')[0] || '';

  if (/[^\x00-\x7F]/.test(d)) {
    signals.push({
      signal: 'homoglyph-chars',
      evidence: `domain contains non-ASCII characters: "${d}"`,
      weight: 45,
    });
  }
  if (d.includes(b)) {
    if (label === b) {
      signals.push({ signal: 'exact-brand-label', evidence: `leftmost label equals brand "${b}"`, weight: 40 });
    } else {
      const keyword = DECEPTIVE_KEYWORDS.find((k) => label.includes(k));
      if (keyword) {
        signals.push({
          signal: 'deceptive-keyword',
          evidence: `brand "${b}" combined with deceptive keyword "${keyword}" in "${label}"`,
          weight: 50,
        });
      }
      if (label.includes(`-${b}`) || label.includes(`${b}-`)) {
        signals.push({
          signal: 'hyphenated-brand',
          evidence: `brand "${b}" hyphen-joined in label "${label}"`,
          weight: 35,
        });
      }
      if (!keyword && label !== b && !label.includes('-')) {
        signals.push({
          signal: 'brand-substring',
          evidence: `brand "${b}" embedded in label "${label}"`,
          weight: 25,
        });
      }
    }
  } else {
    const dist = levenshtein(label, b);
    if (dist > 0 && dist <= 2 && label.length >= 4) {
      signals.push({
        signal: 'brand-typo',
        evidence: `label "${label}" is edit-distance ${dist} from brand "${b}"`,
        weight: 45,
      });
    }
    // Leet-obfuscated brand: normalize digit/symbol substitutions, then retry
    // the substring match (catches examp1e, paypa1, micr0soft).
    const leetLabel = normalizeLeet(label);
    if (leetLabel !== label && leetLabel.includes(b)) {
      const keyword = DECEPTIVE_KEYWORDS.find((k) => leetLabel.includes(k));
      signals.push({
        signal: 'leet-obfuscated-brand',
        evidence: `brand "${b}" hidden with leet substitutions in "${label}"` +
          (keyword ? ` alongside deceptive keyword "${keyword}"` : ''),
        weight: keyword ? 55 : 40,
      });
    }
  }
  if (d !== `${b}.${d.split('.').slice(-1)[0]}` && d.includes(`.${b}.`)) {
    signals.push({
      signal: 'brand-as-subdomain',
      evidence: `brand "${b}" used as a subdomain level in "${d}" (hosted on third-party domain)`,
      weight: 40,
    });
  }
  return signals;
}

/**
 * Classify one domain against the org's portfolio.
 * @param {string} domain
 * @param {{orgDomains?: string[], defensiveDomains?: string[], brands?: string[]}} portfolio
 * @returns {{domain: string, classification: 'org-primary'|'defensive'|'attacker-squat'|'unrelated', confidence: number, signals: object[]}}
 */
export function classifyDomain(domain, portfolio = {}) {
  const d = normalizeDomain(domain);
  const org = new Set((portfolio.orgDomains || []).map(normalizeDomain));
  const defensive = new Set((portfolio.defensiveDomains || []).map(normalizeDomain));
  const brands = (portfolio.brands || []).map((b) => String(b).toLowerCase());

  if (org.has(d)) {
    return { domain: d, classification: 'org-primary', confidence: 1, signals: [] };
  }
  if (defensive.has(d)) {
    return { domain: d, classification: 'defensive', confidence: 1, signals: [] };
  }
  // Defensive-pattern match: org often owns brand+keyword or brand-typo variants.
  for (const b of brands) {
    if (d.startsWith(`${b}-`) || d.startsWith(`${b}.`) || d === b) {
      // Only counts when the registrable domain is literally brand-led; still
      // flag for review rather than trusting blindly.
      break;
    }
  }
  const signals = [];
  for (const b of brands) signals.push(...squatSignals(d, b));
  if (signals.length) {
    const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
    const confidence = Math.min(0.95, 0.45 + totalWeight / 200);
    return { domain: d, classification: 'attacker-squat', confidence: Math.round(confidence * 100) / 100, signals };
  }
  return { domain: d, classification: 'unrelated', confidence: 0.9, signals: [] };
}

/**
 * Map a whole candidate list against the portfolio, attacker squats first.
 * @param {string[]} domains
 * @param {object} portfolio
 * @returns classified findings sorted by triage priority
 */
export function mapPortfolio(domains, portfolio = {}) {
  const unique = [...new Set((domains || []).map(normalizeDomain))].filter(Boolean);
  const priority = { 'attacker-squat': 0, unrelated: 1, defensive: 2, 'org-primary': 3 };
  return unique
    .map((d) => classifyDomain(d, portfolio))
    .sort((a, b) => priority[a.classification] - priority[b.classification] || b.confidence - a.confidence);
}

/**
 * Triage summary for the security team.
 * @param {ReturnType<typeof mapPortfolio>} findings
 */
export function triageSummary(findings) {
  const byClass = {};
  for (const f of findings || []) {
    byClass[f.classification] = (byClass[f.classification] || 0) + 1;
  }
  const squats = (findings || []).filter((f) => f.classification === 'attacker-squat');
  return {
    total: (findings || []).length,
    byClass,
    topSquats: squats.slice(0, 10).map((s) => ({
      domain: s.domain,
      confidence: s.confidence,
      evidence: s.signals.map((x) => x.evidence).join(' | '),
    })),
    summary: `${squats.length} suspected attacker squat(s) need takedown review; ` +
      `${byClass.defensive || 0} defensive and ${byClass['org-primary'] || 0} org domains confirmed safe.`,
  };
}

export const DEFENSIVE_PORTFOLIO_MAPPER = {
  DECEPTIVE_KEYWORDS,
  normalizeDomain,
  normalizeLeet,
  levenshtein,
  squatSignals,
  classifyDomain,
  mapPortfolio,
  triageSummary,
};

export default DEFENSIVE_PORTFOLIO_MAPPER;
