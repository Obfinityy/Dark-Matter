/**
 * ccTldBrandAudit.js — ccTLD brand-protection audit engine.
 *
 * Covers idea-bank item 0303:
 *  - 0303 ccTLD brand-protection audit — check brand presence across major
 *    ccTLDs to find unprotected variants attackers could register.
 *
 * Pure functions only: the engine generates the audit checklist (brand ×
 * major ccTLDs plus common squat patterns per ccTLD) and evaluates
 * caller-supplied registration/ownership data into a gap report. Callers
 * perform DNS/whois lookups themselves. No live lookups here.
 */

/**
 * Major country-code TLDs worth covering in a brand-protection audit,
 * ordered by registration volume / phishing-abuse prevalence rather than
 * alphabet. `note` explains why the ccTLD matters to brand teams.
 * @type {{tld: string, region: string, note: string}[]}
 */
export const MAJOR_CCTLDS = [
  { tld: 'co', region: 'Colombia', note: 'global startup/tech usage, heavy typo/phish abuse' },
  { tld: 'io', region: 'British Indian Ocean Territory', note: 'tech/SaaS default, frequent phishing abuse' },
  { tld: 'ai', region: 'Anguilla', note: 'AI-branding boom, rising squat target' },
  { tld: 'uk', region: 'United Kingdom', note: 'large English-speaking market' },
  { tld: 'de', region: 'Germany', note: 'largest European ccTLD by volume' },
  { tld: 'in', region: 'India', note: 'large market, growing abuse' },
  { tld: 'br', region: 'Brazil', note: 'large LATAM market' },
  { tld: 'fr', region: 'France', note: 'large European market' },
  { tld: 'jp', region: 'Japan', note: 'large Asian market' },
  { tld: 'au', region: 'Australia', note: 'direct .au registrations enabled' },
  { tld: 'ca', region: 'Canada', note: 'large English/French market' },
  { tld: 'us', region: 'United States', note: 'nexus requirement; defensive relevance' },
  { tld: 'eu', region: 'European Union', note: 'EU-wide brand coverage' },
  { tld: 'me', region: 'Montenegro', note: 'personal-brand style usage, typo target' },
  { tld: 'tv', region: 'Tuvalu', note: 'media-brand usage, redirect abuse' },
  { tld: 'cc', region: 'Cocos Islands', note: 'cheap, common in phishing kits' },
  { tld: 'tk', region: 'Tokelau', note: 'free registration tier, historically high abuse' },
  { tld: 'ml', region: 'Mali', note: 'free registration tier, high abuse' },
  { tld: 'ga', region: 'Gabon', note: 'free registration tier, high abuse' },
  { tld: 'cf', region: 'Central African Republic', note: 'free registration tier, high abuse' },
  { tld: 'gq', region: 'Equatorial Guinea', note: 'free registration tier, high abuse' },
  { tld: 'cn', region: 'China', note: 'large market, local-presence rules' },
  { tld: 'ru', region: 'Russia', note: 'CIS coverage' },
  { tld: 'mx', region: 'Mexico', note: 'large LATAM market' },
  { tld: 'es', region: 'Spain', note: 'European market' },
  { tld: 'it', region: 'Italy', note: 'European market' },
  { tld: 'nl', region: 'Netherlands', note: 'large per-capita registration base' },
  { tld: 'se', region: 'Sweden', note: 'Nordic coverage' },
  { tld: 'ch', region: 'Switzerland', note: 'finance/pharma brand relevance' },
  { tld: 'sg', region: 'Singapore', note: 'APAC hub' },
  { tld: 'za', region: 'South Africa', note: 'African market' },
  { tld: 'ae', region: 'UAE', note: 'Gulf market' },
];

/**
 * Normalize a brand token for audit use.
 * @param {string} brand
 * @returns {string}
 */
export function normalizeBrandToken(brand) {
  if (!brand) return '';
  return String(brand)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .split('/')[0]
    .split('.')[0]
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Common squat patterns generated per ccTLD (typosquatting-style variants of
 * the bare brand label).
 * @param {string} brand Normalized brand token
 * @returns {string[]}
 */
export function generateCcTldSquatPatterns(brand) {
  const b = normalizeBrandToken(brand);
  if (!b) return [];
  const set = new Set([b]);
  // Hyphenation and boundary variants.
  set.add(`${b}-official`);
  set.add(`official-${b}`);
  set.add(`${b}-app`);
  set.add(`my${b}`);
  set.add(`get${b}`);
  set.add(`${b}app`);
  set.add(`${b}hq`);
  set.add(`${b}-login`);
  set.add(`${b}-secure`);
  set.add(`${b}support`);
  set.add(`${b}-verify`);
  // Single-character omission and transposition (top typo patterns).
  for (let i = 0; i < b.length; i++) {
    set.add(b.slice(0, i) + b.slice(i + 1));
  }
  for (let i = 0; i < b.length - 1; i++) {
    set.add(b.slice(0, i) + b[i + 1] + b[i] + b.slice(i + 2));
  }
  return [...set].filter(Boolean);
}

/**
 * Build the ccTLD audit checklist: every pattern × every major ccTLD.
 *
 * @param {string} brand Brand token
 * @param {{tlds?: string[], includeSquatPatterns?: boolean, squatLimit?: number}} [options]
 * @returns {{domain: string, pattern: string, tld: string, isExactBrand: boolean}[]}
 */
export function buildCcTldAuditList(brand, options = {}) {
  const b = normalizeBrandToken(brand);
  if (!b) return [];
  const tlds = options.tlds?.length
    ? options.tlds
    : MAJOR_CCTLDS.map((c) => c.tld);
  const patterns = options.includeSquatPatterns === false
    ? [b]
    : generateCcTldSquatPatterns(b).slice(0, options.squatLimit ?? 25);

  const list = [];
  for (const pattern of patterns) {
    for (const raw of tlds) {
      const tld = String(raw).replace(/^\./, '').toLowerCase();
      if (!tld) continue;
      list.push({
        domain: `${pattern}.${tld}`,
        pattern,
        tld,
        isExactBrand: pattern === b,
      });
    }
  }
  return list;
}

/**
 * Evaluate the audit: map caller-supplied registration results onto the
 * checklist and compute coverage gaps.
 *
 * @param {{domain: string, pattern: string, tld: string, isExactBrand: boolean}[]} checklist Output of buildCcTldAuditList
 * @param {{domain: string, registered: boolean, ownerMatchesOrg?: boolean}[]} registrationResults Caller-provided lookup results
 * @returns {{
 *   coverage: {protected: number, unprotected: number, unknown: number},
 *   exactBrandGaps: {domain: string, tld: string, registered: boolean}[],
 *   suspiciousRegistrations: {domain: string, pattern: string, tld: string}[],
 *   tldCoverage: {tld: string, checked: number, protected: number}[],
 *   score: number
 * }}
 *   `score` is 0–100: share of exact-brand domains that are org-controlled.
 */
export function evaluateCcTldAudit(checklist = [], registrationResults = []) {
  const results = new Map(
    (registrationResults || []).map((r) => [
      String(r.domain).toLowerCase(),
      { registered: !!r.registered, ownerMatchesOrg: !!r.ownerMatchesOrg },
    ])
  );

  let protected_ = 0;
  let unprotected = 0;
  let unknown = 0;
  const exactBrandGaps = [];
  const suspiciousRegistrations = [];
  const tldStats = new Map();

  for (const item of checklist || []) {
    const key = String(item.domain).toLowerCase();
    const tld = String(item.tld).toLowerCase();
    if (!tldStats.has(tld)) tldStats.set(tld, { tld, checked: 0, protected: 0 });
    const stat = tldStats.get(tld);
    stat.checked++;

    const res = results.get(key);
    if (!res) {
      unknown++;
      if (item.isExactBrand) exactBrandGaps.push({ domain: item.domain, tld, registered: false });
      continue;
    }
    if (res.registered && res.ownerMatchesOrg) {
      protected_++;
      stat.protected++;
    } else if (res.registered && !res.ownerMatchesOrg) {
      unprotected++;
      if (item.isExactBrand) {
        exactBrandGaps.push({ domain: item.domain, tld, registered: true });
      } else {
        suspiciousRegistrations.push({ domain: item.domain, pattern: item.pattern, tld });
      }
    } else {
      unprotected++;
      if (item.isExactBrand) exactBrandGaps.push({ domain: item.domain, tld, registered: false });
    }
  }

  const exactTotal = checklist.filter((c) => c.isExactBrand).length;
  // exactBrandGaps holds every exact-brand domain not controlled by the org.
  const score = exactTotal === 0 ? 0 : Math.round(((exactTotal - exactBrandGaps.length) / exactTotal) * 100);

  return {
    coverage: { protected: protected_, unprotected, unknown },
    exactBrandGaps: exactBrandGaps.sort((a, b) => a.domain.localeCompare(b.domain)),
    suspiciousRegistrations: suspiciousRegistrations.sort((a, b) => a.domain.localeCompare(b.domain)),
    tldCoverage: [...tldStats.values()].sort((a, b) => a.protected - b.protected || a.tld.localeCompare(b.tld)),
    score,
  };
}
