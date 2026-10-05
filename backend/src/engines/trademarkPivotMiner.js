/**
 * trademarkPivotMiner.js — Trademark-database domain pivoting engine.
 *
 * @idea 00298
 * Covers idea-bank item 00298:
 *  - 00298 Trademark database domain pivoting — pivot on trademark filings
 *    to find defensive and brand-protection domains the org owns.
 *
 * Pure functions only: the caller queries trademark offices (USPTO, EUIPO,
 * UKIPO, WIPO) and passes the filing records in. No live HTTP here.
 */

/**
 * Normalize a domain: lowercase, strip scheme/path/trailing dot.
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Extract candidate domains from a trademark filing record.
 * Looks at mark text, owner name/address fields, and goods-services text.
 *
 * @param {object} filing filing record {mark, owner, applicant, address, goodsServices, serial, office}
 * @returns {string[]} candidate domains (deduplicated)
 */
export function extractCandidateDomainsFromFiling(filing = {}) {
  const candidates = new Set();
  const pushDomain = (value) => {
    const d = normalizeDomain(value);
    if (/^[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}$/.test(d) && !d.includes(' ')) candidates.add(d);
  };

  const mark = String(filing?.mark || '');
  const compact = mark.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact.length >= 3 && compact.length <= 63) {
    pushDomain(`${compact}.com`);
    pushDomain(`${compact}.net`);
    pushDomain(`${compact}.org`);
  }

  const blob = [filing?.owner, filing?.applicant, filing?.address, filing?.goodsServices]
    .filter(Boolean)
    .map(String)
    .join(' ');
  const urlRe = /(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9.\-]*\.[a-z]{2,})/gi;
  for (const m of blob.matchAll(urlRe)) pushDomain(m[1]);

  return [...candidates];
}

/**
 * Pivot filing records into a brand-protection domain map: which marks the
 * owner holds, which domains are defensively plausible, and which filings
 * mention domains outright.
 *
 * @param {object[]} filings trademark filing records
 * @returns {{
 *   owner: string, mark: string, office: string, serial: string,
 *   mentionedDomains: string[], plausibleDefensive: string[], score: number
 * }[]}
 */
export function pivotTrademarkFilings(filings = []) {
  const results = [];

  for (const f of filings || []) {
    const owner = String(f?.owner || f?.applicant || '').trim();
    const mark = String(f?.mark || '').trim();
    if (!mark) continue;
    const domains = extractCandidateDomainsFromFiling(f);
    const mentioned = domains.filter((d) => {
      const blob = [f?.owner, f?.applicant, f?.address, f?.goodsServices].filter(Boolean).map(String).join(' ').toLowerCase();
      return blob.includes(d);
    });
    const plausible = domains.filter((d) => !mentioned.includes(d));

    results.push({
      owner,
      mark,
      office: String(f?.office || '').toUpperCase(),
      serial: String(f?.serial || ''),
      mentionedDomains: mentioned,
      plausibleDefensive: plausible,
      score: mentioned.length > 0 ? 80 : plausible.length > 0 ? 55 : 25,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.mark.localeCompare(b.mark));
}

/**
 * Compare pivoted domains against an owned-domain inventory to flag
 * defensive gaps: plausible brand domains NOT yet owned.
 *
 * @param {ReturnType<typeof pivotTrademarkFilings>} pivoted
 * @param {string[]} ownedDomains domains the org already owns
 * @returns {{mark: string, unowned: string[], mentionedUnowned: string[]}[]}
 */
export function findDefensiveGaps(pivoted = [], ownedDomains = []) {
  const owned = new Set((ownedDomains || []).map(normalizeDomain));
  return (pivoted || []).map((p) => ({
    mark: p.mark,
    unowned: p.plausibleDefensive.filter((d) => !owned.has(d)),
    mentionedUnowned: p.mentionedDomains.filter((d) => !owned.has(d)),
  })).filter((g) => g.unowned.length > 0 || g.mentionedUnowned.length > 0)
    .sort((a, b) => (b.mentionedUnowned.length - a.mentionedUnowned.length) || (b.unowned.length - a.unowned.length));
}
