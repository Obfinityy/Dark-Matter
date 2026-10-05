/**
 * trademarkDomainPivot.js — Trademark database domain pivoting.
 *
 * Organisations file trademarks (USPTO, EUIPO, WIPO) to protect brands,
 * and they routinely register defensive domains alongside those marks:
 * brand-protection portfolios, anti-phishing registrations, and
 * product-name domains that never appear on the corporate site.
 *
 * Passive analysis: this module pivots over trademark *records* already
 * retrieved (serial number, mark text, owner, filing date) and derives
 * the domain names an org is likely to hold for that mark. It works on
 * record data only — it performs no WHOIS lookups itself.
 */

/** TLDs commonly used for defensive/brand-protection registrations. */
const DEFENSIVE_TLDS = [
  'com', 'net', 'org', 'io', 'co', 'ai', 'app', 'dev', 'cloud',
  'security', 'tech', 'inc', 'llc', 'shop', 'store', 'online',
];

/**
 * Normalise a trademark's word mark into a domain-safe slug.
 * @param {string} mark e.g. "ACME Shield™"
 * @returns {string} e.g. "acmeshield"
 */
export function markToSlug(mark) {
  return String(mark || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim edge hyphens
    .replace(/-{2,}/g, '-'); // collapse runs
}

/**
 * Generate defensive domain candidates for a trademark record.
 * @param {{mark: string, serial?: string, owner?: string}} record
 * @param {string[]} [tlds] TLD set to sweep (defaults to DEFENSIVE_TLDS)
 * @returns {{domain: string, pattern: string}[]} candidates with their pattern
 */
export function defensiveDomainCandidates(record, tlds = DEFENSIVE_TLDS) {
  const slug = markToSlug(record && record.mark);
  if (!slug) return [];
  const base = slug.replace(/-/g, ''); // concatenated variant
  const hyphenated = slug; // hyphenated variant
  const variants = new Set();
  if (base) variants.add(base);
  if (hyphenated && hyphenated !== base) variants.add(hyphenated);
  // Common brand-protection prefixes/suffixes
  for (const v of [base, hyphenated]) {
    if (!v) continue;
    variants.add(`get${v}`);
    variants.add(`try${v}`);
    variants.add(`${v}hq`);
    variants.add(`${v}app`);
    variants.add(`the${v}`);
  }
  const out = [];
  for (const variant of variants) {
    for (const tld of tlds || []) {
      out.push({ domain: `${variant}.${tld}`, pattern: variant === base ? 'concat' : variant === hyphenated ? 'hyphen' : 'affix' });
    }
  }
  return out;
}

/**
 * Pivot: given a list of trademark records, group by owner and produce
 * per-owner defensive domain candidate sets.
 * @param {object[]} records trademark records {mark, serial, owner, filingDate}
 * @param {string[]} [tlds]
 * @returns {object[]} {owner, marks: string[], domains: {domain, pattern, mark}[]}
 */
export function pivotTrademarkRecords(records, tlds) {
  const byOwner = new Map();
  for (const r of records || []) {
    if (!r || !r.mark) continue;
    const owner = String(r.owner || 'unknown').trim();
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(r);
  }
  const result = [];
  for (const [owner, recs] of byOwner) {
    const domains = [];
    const seen = new Set();
    const marks = [];
    for (const r of recs) {
      marks.push(r.mark);
      for (const c of defensiveDomainCandidates(r, tlds)) {
        if (seen.has(c.domain)) continue;
        seen.add(c.domain);
        domains.push({ domain: c.domain, pattern: c.pattern, mark: r.mark, serial: r.serial || null });
      }
    }
    result.push({ owner, marks, domains });
  }
  return result;
}

/**
 * Rank candidates: exact mark matches and .com/.net outrank long-tail affixes.
 * @param {{domain: string, pattern: string}[]} candidates
 * @returns same list with a `priority` score, sorted high→low
 */
export function rankDefensiveCandidates(candidates = []) {
  return candidates
    .map((c) => {
      let priority = 0;
      const tld = c.domain.split('.').pop();
      if (tld === 'com') priority += 30;
      else if (tld === 'net' || tld === 'org') priority += 20;
      if (c.pattern === 'concat') priority += 25;
      else if (c.pattern === 'hyphen') priority += 15;
      else priority += 5;
      return { ...c, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

export const TRADEMARK_PIVOT = {
  markToSlug,
  defensiveDomainCandidates,
  pivotTrademarkRecords,
  rankDefensiveCandidates,
  DEFENSIVE_TLDS,
};

export default TRADEMARK_PIVOT;
