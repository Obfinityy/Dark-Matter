/**
 * newGtldBrandSweep.js — New-gTLD brand-variant sweep.
 *
 * New generic TLDs (.app, .dev, .xyz, .shop, …) are cheap and lightly
 * policed, which makes them the favourite ground for phishing domains
 * and unauthorised "shadow IT" registrations that borrow a brand.
 *
 * This module *generates* the candidate domain list to sweep: exact
 * brand matches and near-variants (typosquat, omission, hyphenation,
 * affix) across a curated new-gTLD set. It generates candidates only —
 * resolution/registration checks are the caller's job.
 */

/** Curated new-gTLD set weighted toward phishing-prone namespaces. */
export const NEW_GTLDS = [
  'app', 'dev', 'io', 'ai', 'xyz', 'top', 'site', 'online', 'shop',
  'store', 'tech', 'cloud', 'security', 'digital', 'solutions', 'services',
  'support', 'help', 'careers', 'jobs', 'news', 'blog', 'live', 'vip',
  'club', 'link', 'click', 'win', 'bid', 'loan', 'trade', 'money',
  'account', 'login', 'verify', 'secure', 'update', 'alert',
];

/** Keyboard-adjacency map (QWERTY) for typosquat generation. */
const KEYBOARD_ADJACENT = {
  a: ['q', 'w', 's', 'z'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['w', 's', 'd', 'r'],
  f: ['d', 'r', 't', 'g', 'v', 'c'], g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'n', 'm'], k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'], m: ['n', 'j', 'k'], n: ['b', 'h', 'j', 'm'],
  o: ['i', 'k', 'l', 'p'], p: ['o', 'l'], q: ['w', 'a'],
  r: ['e', 'd', 'f', 't'], s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'], u: ['y', 'h', 'j', 'i'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'], x: ['z', 's', 'd', 'c'], y: ['t', 'g', 'h', 'u'],
  z: ['a', 's', 'x'],
};

/**
 * Generate near-variant spellings of a brand slug.
 * @param {string} slug e.g. "acme"
 * @param {number} [cap] safety cap on variant count
 * @returns {{variant: string, kind: string}[]}
 */
export function brandVariants(slug, cap = 500) {
  const base = String(slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = new Map(); // variant → kind (first kind wins)
  const add = (variant, kind) => {
    if (!variant || variant === base || out.has(variant)) return;
    if (out.size >= cap) return;
    out.set(variant, kind);
  };

  // Omission: drop each character once
  for (let i = 0; i < base.length; i++) add(base.slice(0, i) + base.slice(i + 1), 'omission');
  // Transposition: swap each adjacent pair
  for (let i = 0; i < base.length - 1; i++) {
    add(base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2), 'transposition');
  }
  // Keyboard substitution
  for (let i = 0; i < base.length; i++) {
    for (const sub of KEYBOARD_ADJACENT[base[i]] || []) {
      add(base.slice(0, i) + sub + base.slice(i + 1), 'substitution');
    }
  }
  // Duplication: double each character once
  for (let i = 0; i < base.length; i++) add(base.slice(0, i + 1) + base[i] + base.slice(i + 1), 'duplication');
  // Hyphenation
  for (let i = 1; i < base.length; i++) add(`${base.slice(0, i)}-${base.slice(i)}`, 'hyphenation');
  // Common affixes seen in phishing
  for (const affix of ['support', 'help', 'login', 'secure', 'verify', 'account', 'pay', 'app', 'hq']) {
    add(`${base}-${affix}`, 'affix');
    add(`${affix}-${base}`, 'affix');
    add(`${base}${affix}`, 'affix');
  }
  return [...out.entries()].map(([variant, kind]) => ({ variant, kind }));
}

/**
 * Build the full sweep list: exact matches + variants × new gTLDs.
 * @param {string} brand brand name or domain, e.g. "Acme" or "acme.com"
 * @param {object} [opts]
 * @param {string[]} [opts.tlds] override the gTLD set
 * @param {boolean} [opts.includeVariants] default true
 * @param {number} [opts.variantCap]
 * @returns {{domain: string, kind: string, brand: string}[]} sorted, deduplicated
 */
export function sweepCandidates(brand, opts = {}) {
  const rawBrand = String(brand || '').trim();
  const slug = rawBrand.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('.')[0].replace(/[^a-z0-9]/g, '');
  if (!slug) return [];
  const tlds = opts.tlds || NEW_GTLDS;
  const includeVariants = opts.includeVariants !== false;
  const kinds = includeVariants ? [{ variant: slug, kind: 'exact' }, ...brandVariants(slug, opts.variantCap || 500)] : [{ variant: slug, kind: 'exact' }];
  const seen = new Set();
  const out = [];
  for (const { variant, kind } of kinds) {
    for (const tld of tlds) {
      const domain = `${variant}.${tld}`;
      if (seen.has(domain)) continue;
      seen.add(domain);
      out.push({ domain, kind, brand: rawBrand });
    }
  }
  return out;
}

/**
 * Score a candidate for phishing likelihood (higher = check first).
 * @param {{domain: string, kind: string}} candidate
 * @returns {number}
 */
export function phishingPriority(candidate) {
  let score = 0;
  const domain = candidate.domain.toLowerCase();
  const tld = domain.split('.').pop();
  if (['xyz', 'top', 'click', 'link', 'win', 'bid', 'loan'].includes(tld)) score += 40;
  if (['app', 'dev', 'io', 'ai'].includes(tld)) score += 20;
  if (/(login|verify|secure|account|support|update|alert)/.test(domain)) score += 30;
  if (candidate.kind === 'exact') score += 25;
  else if (candidate.kind === 'substitution' || candidate.kind === 'omission') score += 20;
  else if (candidate.kind === 'affix') score += 15;
  return score;
}

export const GTLD_SWEEP = {
  sweepCandidates,
  brandVariants,
  phishingPriority,
  NEW_GTLDS,
};

export default GTLD_SWEEP;
