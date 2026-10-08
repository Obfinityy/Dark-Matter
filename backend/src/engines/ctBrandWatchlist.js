/**
 * ctBrandWatchlist.js — Certificate-brand watchlist automation.
 *
 * Brand impersonation starts with a certificate: attackers obtain TLS
 * certs for lookalike domains (paypa1.com, acme-support.net) before the
 * phishing campaign. A Certificate Transparency watchlist that covers
 * every brand variant lets the defensive team catch issuance within
 * minutes instead of discovering the campaign.
 *
 * This module is the *matching and alerting* core: given brand terms and
 * a stream of CT log entries (already collected by the caller), it
 * normalises names, matches them against brand patterns (exact,
 * contains-brand, punycode/homograph), and emits alerts with evidence.
 * It performs no network polling itself.
 */

/** Common confusable substitutions used for quick homograph-ish matching. */
const CONFUSABLES = {
  a: ['а', 'à', 'á', 'â'], // cyrillic а mixed in latin
  e: ['е', 'è', 'é', 'ê'],
  i: ['і', 'ì', 'í', '1', 'l'],
  o: ['о', 'ò', 'ó', '0'],
  u: ['υ', 'ù', 'ú'],
  c: ['с'],
  p: ['р'],
  s: ['5', '$'],
};

/**
 * Build watchlist matchers for a set of brand terms.
 * @param {string[]} brands e.g. ["acme", "acme shield"]
 * @returns {{term: string, slug: string, rxExact: RegExp, rxContains: RegExp}[]}
 */
export function buildWatchlist(brands = []) {
  const matchers = [];
  for (const b of brands) {
    const term = String(b || '')
      .trim()
      .toLowerCase();
    if (!term) continue;
    const slug = term.replace(/[^a-z0-9]+/g, '');
    if (!slug) continue;
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matchers.push({
      term,
      slug,
      rxExact: new RegExp(`^(?:[a-z0-9-]+\\.)*${escaped}\\.[a-z]{2,}$`, 'i'),
      rxContains: new RegExp(`${escaped}`, 'i'),
    });
  }
  return matchers;
}

/**
 * Classify how a certificate name relates to the watchlist.
 * @param {string} certName a SAN / CN from a CT entry, e.g. "*.acme-pay.com"
 * @param {object[]} watchlist from buildWatchlist
 * @returns {{matched: boolean, term: string|null, kind: 'exact-brand'|'contains-brand'|'punycode'|'wildcard-brand'|'none'}}
 */
export function classifyCertName(certName, watchlist = []) {
  const raw = String(certName || '')
    .toLowerCase()
    .replace(/^\*\./, '');
  if (!raw) return { matched: false, term: null, kind: 'none' };
  const isPuny = raw.split('.').some(label => label.startsWith('xn--'));
  for (const w of watchlist) {
    if (w.rxExact.test(raw)) {
      return { matched: true, term: w.term, kind: 'exact-brand' };
    }
    if (isPuny && w.rxContains.test(raw)) {
      return { matched: true, term: w.term, kind: 'punycode' };
    }
    if (w.rxContains.test(raw)) {
      return {
        matched: true,
        term: w.term,
        kind: String(certName).startsWith('*.') ? 'wildcard-brand' : 'contains-brand',
      };
    }
  }
  return { matched: false, term: null, kind: 'none' };
}

/**
 * Process a batch of CT log entries against the watchlist.
 * @param {object[]} entries CT entries: {name, issuer, notBefore, serial?}
 * @param {object[]} watchlist from buildWatchlist
 * @param {Set<string>} [seenSerials] dedupe set (mutated) for real-time alerting
 * @returns {object[]} alerts: {name, term, kind, issuer, notBefore, firstSeen}
 */
export function checkCtEntries(entries = [], watchlist = [], seenSerials = new Set()) {
  const alerts = [];
  const now = new Date().toISOString();
  for (const e of entries || []) {
    if (!e || !e.name) continue;
    const serialKey = e.serial ? `serial:${e.serial}` : `name:${e.name}:${e.issuer || ''}`;
    if (seenSerials.has(serialKey)) continue;
    seenSerials.add(serialKey);
    const cls = classifyCertName(e.name, watchlist);
    if (cls.matched && cls.kind !== 'exact-brand') {
      alerts.push({
        name: e.name,
        term: cls.term,
        kind: cls.kind,
        issuer: e.issuer || null,
        notBefore: e.notBefore || null,
        firstSeen: now,
      });
    }
  }
  return alerts;
}

/**
 * Suggest confusable single-character mutations of a brand slug for
 * expanding the watchlist (defensive monitoring terms, not registrations).
 * @param {string} slug brand slug, e.g. "acme"
 * @param {number} [limit] cap on returned variants
 * @returns {string[]} mutated slugs
 */
export function confusableVariants(slug, limit = 40) {
  const base = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const out = new Set();
  for (let i = 0; i < base.length && out.size < limit; i++) {
    const ch = base[i];
    for (const sub of CONFUSABLES[ch] || []) {
      if (out.size >= limit) break;
      out.add(base.slice(0, i) + sub + base.slice(i + 1));
    }
  }
  return [...out];
}

export const CT_WATCHLIST = {
  buildWatchlist,
  classifyCertName,
  checkCtEntries,
  confusableVariants,
};

export default CT_WATCHLIST;
