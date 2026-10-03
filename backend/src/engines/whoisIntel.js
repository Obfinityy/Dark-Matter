/**
 * whoisIntel.js — WHOIS pivoting intelligence (idea 00030).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Pivots on registrant name, email, and org fields via reverse-WHOIS-style
 * data to find sibling domains registered by the same entity.
 * All functions are pure and synchronous — no network calls.
 */

/** WHOIS privacy/redaction markers that must NOT be treated as real identities. */
const PRIVACY_MARKERS = [
  /privacy/i, /redact/i, /whoisguard/i, /withheld/i, /data protected/i,
  /contact privacy/i, /domain privacy/i, /registrant (not )?identified/i,
  /gdpr masked/i, /^n\/a$/i, /^none$/i, /proxy/i, /domains by proxy/i,
];

/**
 * @param {string} v
 * @returns {boolean} true if the value is a real, non-redacted identity.
 */
export function isRealIdentity(v) {
  if (!v || typeof v !== 'string') return false;
  const t = v.trim();
  return t.length > 0 && !PRIVACY_MARKERS.some(rx => rx.test(t));
}

/**
 * Normalize a registrant identity for comparison (case/whitespace folding,
 * punctuation stripping, common suffix collapse).
 * @param {string} v
 */
export function normalizeIdentity(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/["'.,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(inc|llc|ltd|limited|corp|corporation|co|gmbh|pty|sarl|bv|ab|oy)\s*$/i, '')
    .trim();
}

/**
 * Idea 00030 — Reverse-WHOIS registrant pivoting.
 *
 * Given the target's WHOIS record and a candidate corpus of WHOIS records
 * (e.g. from a reverse-WHOIS feed keyed on a matching field), find sibling
 * domains registered by the same entity. Matches are scored by field:
 * registrant email (strongest) > registrant org > registrant name.
 * Redacted/privacy values are never treated as pivots.
 *
 * @param {{domain, registrantName?, registrantOrg?, registrantEmail?}} target
 * @param {Array<Object>} corpus - candidate records with the same shape.
 * @param {{minScore?: number}} [opts]
 * @returns {{ pivots: Array<{field, value}>, siblings: Array<{domain, matchedFields, score, pivotedOn}>, skippedPrivacy: boolean }}
 */
export function pivotReverseWhois(target, corpus, opts = {}) {
  const minScore = opts.minScore ?? 1;
  const fields = [
    { field: 'registrantEmail', key: 'registrantEmail', weight: 3 },
    { field: 'registrantOrg', key: 'registrantOrg', weight: 2 },
    { field: 'registrantName', key: 'registrantName', weight: 1 },
  ];

  const pivots = [];
  for (const { field, key } of fields) {
    const raw = target?.[key];
    if (isRealIdentity(raw)) {
      pivots.push({ field, value: normalizeIdentity(raw) });
    }
  }
  const skippedPrivacy = pivots.length === 0;

  const siblings = [];
  const targetDomain = String(target?.domain || '').toLowerCase();
  for (const rec of corpus || []) {
    if (!rec || !rec.domain) continue;
    const domain = String(rec.domain).toLowerCase();
    if (domain === targetDomain) continue;

    let score = 0;
    const matchedFields = [];
    for (const { field, key, weight } of fields) {
      const pivot = pivots.find(p => p.field === field);
      if (!pivot) continue;
      const recVal = rec[key];
      if (isRealIdentity(recVal) && normalizeIdentity(recVal) === pivot.value) {
        score += weight;
        matchedFields.push(field);
      }
    }
    if (score >= minScore) {
      siblings.push({
        domain,
        matchedFields,
        score,
        pivotedOn: matchedFields.map(f => pivots.find(p => p.field === f).value),
      });
    }
  }
  siblings.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));

  return { pivots, siblings, skippedPrivacy };
}

/**
 * Helper: group a WHOIS corpus by normalized registrant identity so an agent
 * can see every entity and its full domain portfolio at a glance.
 *
 * @param {Array<Object>} corpus
 * @returns {Array<{identity, field, domains: string[], count: number}>}
 *   Sorted by count descending.
 */
export function groupByRegistrant(corpus) {
  const groups = new Map();
  for (const rec of corpus || []) {
    if (!rec || !rec.domain) continue;
    for (const field of ['registrantEmail', 'registrantOrg', 'registrantName']) {
      const raw = rec[field];
      if (!isRealIdentity(raw)) continue;
      const norm = normalizeIdentity(raw);
      if (!norm) continue;
      const gkey = `${field}:${norm}`;
      let g = groups.get(gkey);
      if (!g) { g = { identity: norm, field, domains: new Set() }; groups.set(gkey, g); }
      g.domains.add(String(rec.domain).toLowerCase());
    }
  }
  return [...groups.values()]
    .map(g => ({ identity: g.identity, field: g.field, domains: [...g.domains].sort(), count: g.domains.size }))
    .sort((a, b) => b.count - a.count || a.identity.localeCompare(b.identity));
}
