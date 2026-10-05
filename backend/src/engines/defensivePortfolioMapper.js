/**
 * defensivePortfolioMapper.js — defensive-domain portfolio mapping engine.
 *
 * Covers idea-bank item 0304:
 *  - 0304 Defensive-domain portfolio mapping — map the org's known defensive
 *    registrations to distinguish them from attacker squats during triage.
 *
 * Pure functions only: the engine builds an indexed portfolio of the org's
 * defensive registrations and classifies observed/candidate domains as
 * defensive-owned, unknown, or likely-squat. Callers supply the portfolio
 * (e.g. from their registrar account) and any lookups. No live lookups here.
 */

/**
 * Normalize a domain: lowercase, strip scheme/userinfo/port/trailing dot.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  if (!domain) return '';
  return String(domain)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+(\/.*)?$/, '')
    .split('/')[0]
    .replace(/\.$/, '');
}

/**
 * Extract the registrable label (SLD + TLD as seen here: last two labels)
 * for portfolio bucketing.
 * @param {string} domain
 * @returns {string}
 */
export function registrableDomain(domain) {
  const labels = normalizeDomain(domain).split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-2).join('.');
}

/**
 * Build an indexed defensive portfolio from the org's known registrations.
 *
 * @param {{domain: string, purpose?: string, registeredAt?: string, expiresAt?: string, registrar?: string}[]} defensiveDomains
 *   The org's known defensive registrations (from registrar exports).
 * @param {string[]} brandTokens Brand tokens the portfolio protects
 * @returns {{
 *   size: number,
 *   byDomain: Map<string, {domain: string, purpose: string}>,
 *   byBrand: {brand: string, domains: string[]}[],
 *   expiringSoon: {domain: string, expiresAt: string, daysLeft: number}[]
 * }}
 */
export function buildDefensivePortfolio(defensiveDomains = [], brandTokens = []) {
  const byDomain = new Map();
  const brandHits = new Map();
  const expiringSoon = [];
  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;

  for (const entry of defensiveDomains || []) {
    const domain = normalizeDomain(entry?.domain);
    if (!domain || byDomain.has(domain)) continue;
    byDomain.set(domain, { domain, purpose: String(entry?.purpose || 'defensive') });

    const label = registrableDomain(domain);
    for (const raw of brandTokens || []) {
      const token = String(raw || '').toLowerCase();
      if (!token) continue;
      if (!brandHits.has(token)) brandHits.set(token, new Set());
      if (label.includes(token)) brandHits.get(token).add(domain);
    }

    if (entry?.expiresAt) {
      const ts = Date.parse(entry.expiresAt);
      if (!Number.isNaN(ts)) {
        const daysLeft = Math.ceil((ts - now) / DAY_MS);
        if (daysLeft >= 0 && daysLeft <= 90) {
          expiringSoon.push({ domain, expiresAt: String(entry.expiresAt), daysLeft });
        }
      }
    }
  }

  return {
    size: byDomain.size,
    byDomain,
    byBrand: [...brandHits.entries()]
      .map(([brand, set]) => ({ brand, domains: [...set].sort() }))
      .sort((a, b) => a.brand.localeCompare(b.brand)),
    expiringSoon: expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft),
  };
}

/**
 * Classify an observed domain against the defensive portfolio.
 *
 * @param {string} domain Observed or candidate domain
 * @param {{byDomain: Map<string, {domain: string}>}} portfolio Output of buildDefensivePortfolio
 * @param {string[]} brandTokens Brand tokens for brand-similarity context
 * @returns {{
 *   domain: string, verdict: 'defensive'|'defensive-subdomain'|'unknown'|'suspicious-squat',
 *   matchedDefensive?: string, reason: string
 * }}
 *   - defensive: exact registrable-domain match with the portfolio.
 *   - defensive-subdomain: subdomain of a portfolio domain.
 *   - suspicious-squat: not in portfolio but looks brand-like (caller still
 *     decides after whois).
 *   - unknown: none of the above.
 */
export function classifyAgainstPortfolio(domain, portfolio, brandTokens = []) {
  const clean = normalizeDomain(domain);
  const verdict = { domain: clean, verdict: 'unknown', reason: '' };

  if (!clean || !portfolio?.byDomain) {
    verdict.reason = 'empty domain or portfolio';
    return verdict;
  }
  const reg = registrableDomain(clean);
  if (portfolio.byDomain.has(reg)) {
    if (reg === clean) {
      verdict.verdict = 'defensive';
      verdict.matchedDefensive = reg;
      verdict.reason = 'exact defensive registration';
    } else {
      verdict.verdict = 'defensive-subdomain';
      verdict.matchedDefensive = reg;
      verdict.reason = 'subdomain of a defensive registration';
    }
    return verdict;
  }

  const tokens = (brandTokens || []).map((t) => String(t || '').toLowerCase()).filter(Boolean);
  const labels = clean.split('.');
  const looksBrandLike = tokens.some((t) => t && labels.some((l) => l.includes(t)));
  if (looksBrandLike) {
    verdict.verdict = 'suspicious-squat';
    verdict.reason = 'brand-like but not in defensive portfolio';
  } else {
    verdict.reason = 'no portfolio match, not brand-like';
  }
  return verdict;
}

/**
 * Triage a batch of observed domains (e.g. from certificate transparency,
 * NRD feeds, or passive DNS) against the defensive portfolio, splitting
 * org-owned assets from domains that need investigation.
 *
 * @param {string[]} observedDomains
 * @param {{byDomain: Map<string, {domain: string}>}} portfolio Output of buildDefensivePortfolio
 * @param {string[]} brandTokens
 * @returns {{
 *   defensive: string[], defensiveSubdomains: string[],
 *   needsInvestigation: {domain: string, reason: string}[],
 *   unrelated: string[]
 * }}
 */
export function triageObservedDomains(observedDomains = [], portfolio, brandTokens = []) {
  const defensive = new Set();
  const defensiveSubdomains = new Set();
  const needsInvestigation = new Map();
  const unrelated = new Set();

  for (const raw of observedDomains || []) {
    const clean = normalizeDomain(raw);
    if (!clean) continue;
    const c = classifyAgainstPortfolio(clean, portfolio, brandTokens);
    switch (c.verdict) {
      case 'defensive':
        defensive.add(clean);
        break;
      case 'defensive-subdomain':
        defensiveSubdomains.add(clean);
        break;
      case 'suspicious-squat':
        needsInvestigation.set(clean, c.reason);
        break;
      default:
        unrelated.add(clean);
    }
  }

  const sortAll = (arr) => arr.sort((a, b) => a.localeCompare(b));
  return {
    defensive: sortAll([...defensive]),
    defensiveSubdomains: sortAll([...defensiveSubdomains]),
    needsInvestigation: sortAll([...needsInvestigation.entries()])
      .map(([domain, reason]) => ({ domain, reason })),
    unrelated: sortAll([...unrelated]),
  };
}

/**
 * Compute portfolio coverage: for each brand token × key TLD, report whether
 * the exact brand domain is held defensively.
 *
 * @param {{byBrand: {brand: string, domains: string[]}[], byDomain: Map<string, {domain: string}>}} portfolio
 * @param {string[]} brandTokens
 * @param {string[]} keyTlds
 * @returns {{brand: string, tld: string, domain: string, held: boolean}[]}
 */
export function portfolioCoverageGaps(portfolio, brandTokens = [], keyTlds = ['com', 'net', 'org', 'io']) {
  const held = new Set([...(portfolio?.byDomain?.keys() || [])]);
  const gaps = [];
  for (const rawBrand of brandTokens || []) {
    const brand = String(rawBrand || '').toLowerCase();
    if (!brand) continue;
    for (const rawTld of keyTlds || []) {
      const tld = String(rawTld).replace(/^\./, '').toLowerCase();
      if (!tld) continue;
      const domain = `${brand}.${tld}`;
      gaps.push({ brand, tld, domain, held: held.has(domain) });
    }
  }
  return gaps.sort((a, b) => Number(a.held) - Number(b.held) || a.domain.localeCompare(b.domain));
}
