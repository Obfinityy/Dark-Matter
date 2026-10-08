/**
 * ccTldBrandAudit.js — ccTLD brand-protection coverage audit.
 *
 * Attackers register a brand under country-code TLDs the brand owner never
 * claimed (brand-support.de, brand-payments.co, ...). This module audits a
 * brand's presence across major ccTLDs, tiered by market importance, and
 * produces a prioritized defensive-registration plan for the gaps.
 *
 * Defensive use only: registration status is supplied by the caller through a
 * known-registered set (or an injected lookup), so no network I/O happens here.
 */

/**
 * Major country-code TLDs with market tier (1 = highest priority).
 * [tld, region, tier]
 */
export const CC_TLDS = [
  ['de', 'Germany', 1],
  ['uk', 'United Kingdom', 1],
  ['fr', 'France', 1],
  ['jp', 'Japan', 1],
  ['cn', 'China', 1],
  ['in', 'India', 1],
  ['br', 'Brazil', 1],
  ['au', 'Australia', 1],
  ['ca', 'Canada', 1],
  ['it', 'Italy', 1],
  ['es', 'Spain', 1],
  ['nl', 'Netherlands', 1],
  ['ch', 'Switzerland', 2],
  ['se', 'Sweden', 2],
  ['kr', 'South Korea', 2],
  ['mx', 'Mexico', 2],
  ['ae', 'United Arab Emirates', 2],
  ['sg', 'Singapore', 2],
  ['hk', 'Hong Kong', 2],
  ['pl', 'Poland', 2],
  ['ru', 'Russia', 2],
  ['za', 'South Africa', 2],
  ['ng', 'Nigeria', 2],
  ['sa', 'Saudi Arabia', 2],
  ['tr', 'Turkey', 2],
  ['tw', 'Taiwan', 2],
  ['id', 'Indonesia', 2],
  ['my', 'Malaysia', 2],
  ['ph', 'Philippines', 2],
  ['th', 'Thailand', 2],
  ['vn', 'Vietnam', 2],
  ['nz', 'New Zealand', 2],
  ['ie', 'Ireland', 2],
  ['at', 'Austria', 2],
  ['be', 'Belgium', 2],
  ['dk', 'Denmark', 2],
  ['no', 'Norway', 2],
  ['fi', 'Finland', 2],
  ['pt', 'Portugal', 2],
  ['gr', 'Greece', 2],
  ['cz', 'Czechia', 3],
  ['hu', 'Hungary', 3],
  ['ro', 'Romania', 3],
  ['ua', 'Ukraine', 3],
  ['il', 'Israel', 3],
  ['ar', 'Argentina', 3],
  ['cl', 'Chile', 3],
  ['co', 'Colombia', 3],
  ['ee', 'Estonia', 3],
  ['lv', 'Latvia', 3],
  ['lt', 'Lithuania', 3],
  ['is', 'Iceland', 3],
  ['lu', 'Luxembourg', 3],
  ['sk', 'Slovakia', 3],
  ['hr', 'Croatia', 3],
  ['pk', 'Pakistan', 3],
  ['bd', 'Bangladesh', 3],
  ['lk', 'Sri Lanka', 3],
  ['np', 'Nepal', 3],
  ['qa', 'Qatar', 3],
  ['kw', 'Kuwait', 3],
  ['eg', 'Egypt', 3],
  ['ke', 'Kenya', 3],
  ['gh', 'Ghana', 3],
];

/** Exposure weight per tier: an unprotected tier-1 ccTLD is the worst gap. */
const TIER_WEIGHT = { 1: 100, 2: 55, 3: 25 };

/**
 * Build the brand domain under a ccTLD.
 * @param {string} brand brand label, e.g. "example"
 * @param {string} tld ccTLD without dot, e.g. "de"
 * @returns {string} e.g. "example.de"
 */
export function domainForTld(brand, tld) {
  return `${String(brand || '').toLowerCase()}.${String(tld || '').toLowerCase()}`;
}

/**
 * Audit brand coverage across major ccTLDs.
 * @param {string} brand brand label
 * @param {Set<string>|string[]} knownRegistered domains the org already owns/controls
 * @returns {{tld: string, region: string, tier: number, domain: string, status: 'protected'|'unprotected', exposure: number}[]}
 */
export function auditBrandAcrossCcTlds(brand, knownRegistered = []) {
  const owned = new Set([...knownRegistered].map(d => String(d).toLowerCase()));
  return CC_TLDS.map(([tld, region, tier]) => {
    const domain = domainForTld(brand, tld);
    const status = owned.has(domain) ? 'protected' : 'unprotected';
    return {
      tld,
      region,
      tier,
      domain,
      status,
      exposure: status === 'protected' ? 0 : TIER_WEIGHT[tier],
    };
  });
}

/**
 * Unprotected ccTLDs sorted by exposure (most urgent first).
 * @param {ReturnType<typeof auditBrandAcrossCcTlds>} audit
 * @returns filtered + sorted audit rows
 */
export function unprotectedHighValue(audit) {
  return (audit || [])
    .filter(row => row.status === 'unprotected')
    .sort((a, b) => b.exposure - a.exposure || a.tier - b.tier);
}

/**
 * Protection coverage as a percentage of weighted exposure already owned.
 * @param {ReturnType<typeof auditBrandAcrossCcTlds>} audit
 * @returns {number} 0-100
 */
export function coverageScore(audit) {
  const rows = audit || [];
  if (!rows.length) return 0;
  const total = rows.reduce((s, r) => s + TIER_WEIGHT[r.tier], 0);
  const covered = rows
    .filter(r => r.status === 'protected')
    .reduce((s, r) => s + TIER_WEIGHT[r.tier], 0);
  return Math.round((covered / total) * 100);
}

/**
 * Prioritized defensive-registration plan: the N most exposed unprotected
 * ccTLDs, with rationale the brand-protection team can act on.
 * @param {ReturnType<typeof auditBrandAcrossCcTlds>} audit
 * @param {number} [limit=10]
 * @returns {{domain: string, tld: string, region: string, tier: number, exposure: number, rationale: string}[]}
 */
export function defensiveRegistrationPlan(audit, limit = 10) {
  return unprotectedHighValue(audit)
    .slice(0, limit)
    .map(row => ({
      domain: row.domain,
      tld: row.tld,
      region: row.region,
      tier: row.tier,
      exposure: row.exposure,
      rationale:
        `${row.domain} is unclaimed in ${row.region} (tier-${row.tier} market); ` +
        `an attacker could register it for localized phishing or brand impersonation.`,
    }));
}

/**
 * One-line executive summary of the audit.
 * @param {ReturnType<typeof auditBrandAcrossCcTlds>} audit
 */
export function summarizeCcTldAudit(audit) {
  const gaps = unprotectedHighValue(audit);
  const tier1Gaps = gaps.filter(g => g.tier === 1).map(g => g.domain);
  return {
    coverage: coverageScore(audit),
    totalAudited: (audit || []).length,
    unprotectedCount: gaps.length,
    tier1Gaps,
    summary:
      `Brand coverage is ${coverageScore(audit)}% across ${audit.length} major ccTLDs; ` +
      `${gaps.length} unprotected, including ${tier1Gaps.length} tier-1 market(s)` +
      (tier1Gaps.length ? `: ${tier1Gaps.join(', ')}` : '') +
      '.',
  };
}

export const CC_TLD_BRAND_AUDIT = {
  CC_TLDS,
  domainForTld,
  auditBrandAcrossCcTlds,
  unprotectedHighValue,
  coverageScore,
  defensiveRegistrationPlan,
  summarizeCcTldAudit,
};

export default CC_TLD_BRAND_AUDIT;
