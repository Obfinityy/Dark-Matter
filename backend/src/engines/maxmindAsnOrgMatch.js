/**
 * maxmindAsnOrgMatch.js — MaxMind-style ASN organization name matching (idea 00191).
 *
 * When an authorized bug-bounty agent maps a target's network footprint, the
 * target's netblocks are often registered under brand variants ("ACME Corp",
 * "Acme Cloud Ltd", "ACME-INC") instead of the exact legal name. This module
 * normalizes organization names from GeoIP/ASN datasets and matches them
 * against the target brand and its known variants, scoring each match so the
 * hunt can confidently expand scope to the right netblocks.
 * All functions are pure and synchronous — no network calls.
 */

const ORG_SUFFIX_RE =
  /\b(inc|incorporated|corp|corporation|ltd|limited|llc|plc|gmbh|sarl|sas|ab|oy|as|bv|nv|pty|holdings?|group|systems?|technologies?|tech|network(s)?|communications?|internet|hosting|cloud|services?|solutions?|labs?|digital|media|ventures?|partners?|company|co)\b\.?/gi;
const NON_ALNUM_RE = /[^a-z0-9]/g;

/**
 * Idea 00191 — Normalize an organization name for comparison.
 *
 * Lowercases, strips common corporate suffixes ("Inc.", "Ltd"), removes
 * punctuation and whitespace. Two registrations of the same entity collapse
 * to the same normalized key.
 *
 * @param {string} name — raw organization name
 * @returns {string} normalized key (empty string when unusable)
 */
export function normalizeOrgName(name = '') {
  let s = String(name || '').toLowerCase();
  s = s.replace(ORG_SUFFIX_RE, ' ');
  s = s.replace(NON_ALNUM_RE, '');
  return s.trim();
}

/**
 * Idea 00191 — Levenshtein edit distance between two normalized names.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a = '', b = '') {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

/**
 * Idea 00191 — Score one organization name against the target brand.
 *
 * Match tiers (descending confidence):
 *   exact     — normalized names are identical (100)
 *   contains  — one name contains the other (80)
 *   variant   — matches a supplied brand variant (70–90)
 *   fuzzy     — edit distance ≤ threshold of brand length (40–69)
 *   none      — no relationship (0)
 *
 * @param {string} orgName — candidate org name from the dataset
 * @param {string} brand — target brand / legal name
 * @param {string[]} [brandVariants] — known alternate spellings
 * @returns {{ tier, score, matchedVariant }}
 */
export function scoreOrgAgainstBrand(orgName, brand, brandVariants = []) {
  const normOrg = normalizeOrgName(orgName);
  const normBrand = normalizeOrgName(brand);
  if (!normOrg || !normBrand) return { tier: 'none', score: 0, matchedVariant: null };

  if (normOrg === normBrand) return { tier: 'exact', score: 100, matchedVariant: null };
  if (normOrg.includes(normBrand) || normBrand.includes(normOrg)) {
    return { tier: 'contains', score: 80, matchedVariant: null };
  }
  for (const v of brandVariants || []) {
    const normV = normalizeOrgName(v);
    if (!normV) continue;
    if (normOrg === normV) return { tier: 'variant', score: 90, matchedVariant: v };
    if (normOrg.includes(normV) || normV.includes(normOrg)) {
      return { tier: 'variant', score: 70, matchedVariant: v };
    }
  }
  const threshold = Math.max(2, Math.floor(normBrand.length * 0.25));
  const d = editDistance(normOrg, normBrand);
  if (d <= threshold) {
    const score = Math.max(40, 69 - Math.round((d / (threshold + 1)) * 29));
    return { tier: 'fuzzy', score, matchedVariant: null };
  }
  return { tier: 'none', score: 0, matchedVariant: null };
}

/**
 * Idea 00191 — Match a GeoIP/ASN org listing against the target brand.
 *
 * Accepts records shaped like MaxMind ASN database rows
 * ({ network, asn, organization }) and returns every record whose org name
 * matches the brand or a variant, with per-record tier/score and a summary
 * of discovered ASNs and prefixes.
 *
 * @param {Array<{ network, asn, organization }>} records
 * @param {string} brand — target brand / legal name
 * @param {string[]} [brandVariants]
 * @param {number} [minScore] — minimum match score to include (default 40)
 * @returns {{ matches: Array<{ network, asn, organization, tier, score, matchedVariant }>, asns: number[], prefixes: string[], stats: { scanned, matched } }}
 */
export function matchAsnOrgRecords(records = [], brand, brandVariants = [], minScore = 40) {
  const matches = [];
  const asns = new Set();
  const prefixes = new Set();
  let scanned = 0;
  for (const r of records || []) {
    if (!r) continue;
    scanned++;
    const res = scoreOrgAgainstBrand(r.organization, brand, brandVariants);
    if (res.score < minScore) continue;
    const asn = Number(r.asn);
    if (Number.isFinite(asn)) asns.add(asn);
    if (r.network) prefixes.add(String(r.network));
    matches.push({
      network: r.network,
      asn: Number.isFinite(asn) ? asn : null,
      organization: r.organization,
      tier: res.tier,
      score: res.score,
      matchedVariant: res.matchedVariant,
    });
  }
  matches.sort((a, b) => b.score - a.score);
  return {
    matches,
    asns: [...asns].sort((a, b) => a - b),
    prefixes: [...prefixes].sort(),
    stats: { scanned, matched: matches.length },
  };
}
