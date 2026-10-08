/**
 * jargonWordlistMutator.js — Wordlist mutation with organization-specific jargon.
 *
 * Generic subdomain wordlists miss infrastructure named after internal products,
 * codenames, and team slang. This module takes a base wordlist plus org jargon
 * terms (mined from job postings, press releases, and public docs) and produces
 * a mutated wordlist: jargon affixes, leetspeak variants, separator play, and
 * portmanteau combinations — the names an org actually uses.
 *
 * Defensive framing: output feeds the operator's authorized DNS discovery;
 * no network I/O here.
 */

const LEET_MAP = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', b: '8', g: '9' };

/**
 * Produce leetspeak variants of a term (full-leet plus single-char swaps).
 */
export function leetVariants(term) {
  const t = String(term || '').toLowerCase();
  if (!t) return [];
  const out = new Set();
  const full = [...t].map(c => LEET_MAP[c] || c).join('');
  if (full !== t) out.add(full);
  for (let i = 0; i < t.length; i++) {
    const swapped = LEET_MAP[t[i]];
    if (swapped) out.add(t.slice(0, i) + swapped + t.slice(i + 1));
  }
  return [...out];
}

/**
 * Common abbreviations: first letters of multi-word jargon, vowel removal.
 */
export function abbreviate(term) {
  const t = String(term || '')
    .toLowerCase()
    .trim();
  if (!t) return [];
  const out = new Set();
  const words = t.split(/[\s_-]+/).filter(Boolean);
  if (words.length > 1) {
    out.add(words.map(w => w[0]).join('')); // initials
    out.add(words.join(''));
  }
  const noVowels = t.replace(/[aeiou]/g, '');
  if (noVowels.length >= 3 && noVowels !== t) out.add(noVowels);
  return [...out];
}

/**
 * Combine a jargon term with a base word across separators and orders.
 */
export function combineJargonBase(jargon, base) {
  const j = String(jargon || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  const b = String(base || '').toLowerCase();
  if (!j || !b || j === b) return [];
  return [`${j}-${b}`, `${b}-${j}`, `${j}${b}`, `${b}${j}`, `${j}_${b}`, `${b}_${j}`, `${j}.${b}`];
}

/**
 * Mutate a generic wordlist with org-specific jargon.
 *
 * @param {string[]} baseWordlist generic entries, e.g. ["api","portal","admin"]
 * @param {string[]} jargon org terms, e.g. ["horizon","bluefin","meridian"]
 * @param {{includeLeet?: boolean, includeAbbreviations?: boolean, maxSize?: number}} options
 * @returns {string[]} deduped mutated wordlist
 */
export function mutateWordlist(baseWordlist = [], jargon = [], options = {}) {
  const base = [...new Set(baseWordlist.map(w => String(w).toLowerCase().trim()).filter(Boolean))];
  const terms = [...new Set(jargon.map(w => String(w).toLowerCase().trim()).filter(Boolean))];
  const maxSize = options.maxSize ?? 5000;
  const out = new Set(base);

  for (const term of terms) {
    if (out.size >= maxSize) break;
    out.add(term);
    out.add(term.replace(/[\s_-]+/g, ''));
    if (options.includeLeet !== false) {
      for (const v of leetVariants(term)) out.add(v);
    }
    if (options.includeAbbreviations !== false) {
      for (const v of abbreviate(term)) out.add(v);
    }
    for (const word of base) {
      for (const c of combineJargonBase(term, word)) {
        out.add(c);
        if (out.size >= maxSize) break;
      }
      if (out.size >= maxSize) break;
    }
    // Year/quarter-style temporal tags orgs attach to projects
    const year = new Date().getFullYear();
    out.add(`${term}${year}`);
    out.add(`${term}-${year}`);
  }
  return [...out].slice(0, maxSize);
}

/**
 * Score how "jargon-like" a wordlist entry is: contains an org term.
 * Useful to prioritize mutated entries during resolution sweeps.
 * @param {string[]} wordlist
 * @param {string[]} jargon
 */
export function prioritizeJargonEntries(wordlist = [], jargon = []) {
  const terms = jargon.map(t => String(t).toLowerCase());
  const scored = wordlist.map(w => {
    const low = String(w).toLowerCase();
    const hits = terms.filter(t => t && low.includes(t)).length;
    return { entry: w, jargonHits: hits };
  });
  return scored.sort((a, b) => b.jargonHits - a.jargonHits);
}

export const JARGON_WORDLIST_MUTATOR = {
  leetVariants,
  abbreviate,
  combineJargonBase,
  mutateWordlist,
  prioritizeJargonEntries,
};

export default JARGON_WORDLIST_MUTATOR;
