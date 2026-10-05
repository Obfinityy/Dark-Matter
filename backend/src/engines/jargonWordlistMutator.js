/**
 * jargonWordlistMutator.js — wordlist mutation with org jargon engine.
 *
 * @idea 0317 — Wordlist mutation with org jargon: mutate generic wordlists
 *   with org-specific terms mined from job postings and press releases.
 *
 * Pure functions: callers supply a base wordlist and org-specific terms
 * (mined by jobPostingHostMiner / employeeStackMiner / press scraping).
 * No live HTTP here.
 *
 * Defensive framing: produces sharper brute-force wordlists for a target
 * the owner authorized, so a hunter guesses subdomains/paths the way an
 * insider would name them.
 */

const SEPARATORS = ['-', '_', '.', ''];

/**
 * Build an abbreviation map for multi-word org terms.
 * "Customer Identity Platform" → ["cip"]; "Acme Cloud Gateway" → ["acg"].
 * @param {string[]} terms
 * @returns {Record<string, string>}
 */
export function abbreviateTerms(terms = []) {
  const out = {};
  for (const raw of terms || []) {
    const term = String(raw || '').trim();
    const words = term.split(/[\s\-_]+/).filter(Boolean);
    if (words.length > 1) {
      const abbr = words.map((w) => w[0].toLowerCase()).join('');
      if (abbr.length >= 2) out[term] = abbr;
    }
  }
  return out;
}

/**
 * Normalize a term into a DNS-label-safe token.
 * @param {string} term
 * @returns {string}
 */
export function toLabelToken(term) {
  return String(term || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Mutate a generic wordlist with org-specific jargon terms.
 * Produces combinations: term-word, word-term, with separators -, _, ., none;
 * plus abbreviations, plurals, and numeric suffixes.
 * @param {string[]} baseWords generic wordlist entries
 * @param {string[]} orgTerms org-specific terms (job postings, press releases)
 * @param {object} [opts]
 * @param {boolean} [opts.abbreviations=true] include term abbreviations
 * @param {boolean} [opts.plurals=true] include plural forms
 * @param {boolean} [opts.numericSuffixes=true] include 1/2/v2-style suffixes
 * @param {number} [opts.maxWords=20000] cap on output size
 * @returns {string[]} mutated wordlist (deduplicated, sorted)
 */
export function mutateWordlist(baseWords = [], orgTerms = [], opts = {}) {
  const { abbreviations = true, plurals = true, numericSuffixes = true, maxWords = 20000 } = opts || {};
  const words = (baseWords || []).map(toLabelToken).filter(Boolean);
  const terms = (orgTerms || []).map(toLabelToken).filter(Boolean);
  const abbrs = abbreviations ? Object.values(abbreviateTerms(orgTerms)).map(toLabelToken).filter(Boolean) : [];
  const allTerms = [...new Set([...terms, ...abbrs])];
  const out = new Set();

  const add = (w) => {
    if (out.size >= maxWords) return;
    if (w && /^[a-z0-9][a-z0-9.-]*$/.test(w) && w.length <= 63) out.add(w);
  };

  // Org terms stand alone
  for (const t of allTerms) {
    add(t);
    if (out.size >= maxWords) break;
  }

  // Combine each term with each base word across separators
  for (const t of allTerms) {
    for (const w of words) {
      if (out.size >= maxWords) break;
      for (const sep of SEPARATORS) {
        add(`${t}${sep}${w}`);
        if (out.size >= maxWords) break;
        add(`${w}${sep}${t}`);
        if (out.size >= maxWords) break;
      }
    }
    if (out.size >= maxWords) break;
  }

  // Plural forms of terms
  if (plurals) {
    for (const t of allTerms) {
      if (out.size >= maxWords) break;
      if (!t.endsWith('s')) add(`${t}s`);
    }
  }

  // Numeric/environment suffixes on terms
  if (numericSuffixes) {
    const suffixes = ['1', '2', '01', 'v1', 'v2', 'prod', 'dev', 'test', 'stage'];
    for (const t of allTerms) {
      for (const s of suffixes) {
        if (out.size >= maxWords) break;
        add(`${t}-${s}`);
      }
      if (out.size >= maxWords) break;
    }
  }

  return [...out].sort();
}

/**
 * Merge several mutated wordlists, deduplicating.
 * @param {string[][]} lists
 * @returns {string[]}
 */
export function mergeWordlists(lists = []) {
  const out = new Set();
  for (const list of lists || []) {
    for (const w of list || []) {
      const token = toLabelToken(w);
      if (token) out.add(token);
    }
  }
  return [...out].sort();
}

/**
 * Rank mutated words by jargon specificity: entries containing an org term
 * rank above generic leftovers.
 * @param {string[]} mutated
 * @param {string[]} orgTerms
 * @returns {string[]}
 */
export function rankByJargonSpecificity(mutated = [], orgTerms = []) {
  const tokens = (orgTerms || []).map(toLabelToken).filter(Boolean);
  return [...(mutated || [])].sort((a, b) => {
    const aHits = tokens.filter((t) => a.includes(t)).length;
    const bHits = tokens.filter((t) => b.includes(t)).length;
    return bHits - aHits || a.localeCompare(b);
  });
}
