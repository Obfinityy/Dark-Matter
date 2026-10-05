/**
 * homoglyphDomainChecker.js — IDN homograph (homoglyph) squat detection engine.
 *
 * Covers idea-bank item 0301:
 *  - 0301 Homoglyph domain registration check — render brand variants in
 *    confusable Unicode scripts and check registration to catch IDN
 *    homograph squats.
 *
 * Pure functions only: this engine GENERATES confusable variants and scores
 * them; callers perform DNS/whois lookups themselves (respecting provider
 * rate limits) and pass the registration results back in. No live lookups
 * here.
 */

/**
 * Confusable glyphs per Latin letter. Entries are Unicode lookalikes from
 * Cyrillic, Greek, and other scripts that render nearly identically to the
 * ASCII letter in most UI fonts. Kept deliberately short: only the most
 * convincing confusables, so generated variants stay high-signal.
 * @type {Record<string, {ch: string, script: string}[]>}
 */
const CONFUSABLES = {
  a: [
    { ch: 'а', script: 'Cyrillic' },
    { ch: 'ɑ', script: 'IPA/Latin-alpha' },
  ],
  b: [{ ch: 'ь', script: 'Cyrillic' }],
  c: [{ ch: 'с', script: 'Cyrillic' }],
  d: [{ ch: 'ԁ', script: 'Cyrillic-Komi' }],
  e: [
    { ch: 'е', script: 'Cyrillic' },
    { ch: 'ё', script: 'Cyrillic-e-diaeresis' },
  ],
  g: [{ ch: 'ԍ', script: 'Cyrillic-Komi' }],
  h: [{ ch: 'һ', script: 'Cyrillic-shha' }],
  i: [
    { ch: 'і', script: 'Cyrillic/Ukrainian' },
    { ch: 'ι', script: 'Greek' },
  ],
  j: [{ ch: 'ј', script: 'Cyrillic' }],
  k: [{ ch: 'κ', script: 'Greek' }],
  l: [{ ch: 'ӏ', script: 'Cyrillic-palochka' }],
  m: [{ ch: 'м', script: 'Cyrillic' }],
  n: [{ ch: 'п', script: 'Cyrillic' }],
  o: [
    { ch: 'о', script: 'Cyrillic' },
    { ch: 'ο', script: 'Greek' },
  ],
  p: [
    { ch: 'р', script: 'Cyrillic' },
    { ch: 'ρ', script: 'Greek' },
  ],
  q: [{ ch: 'ԛ', script: 'Cyrillic-Komi' }],
  r: [{ ch: 'г', script: 'Cyrillic' }],
  s: [{ ch: 'ѕ', script: 'Cyrillic-dze' }],
  t: [{ ch: 'τ', script: 'Greek' }],
  u: [{ ch: 'υ', script: 'Greek' }],
  v: [{ ch: 'ν', script: 'Greek' }],
  w: [{ ch: 'ω', script: 'Greek' }],
  x: [
    { ch: 'х', script: 'Cyrillic' },
    { ch: 'χ', script: 'Greek' },
  ],
  y: [
    { ch: 'у', script: 'Cyrillic' },
    { ch: 'γ', script: 'Greek' },
  ],
  z: [{ ch: 'ζ', script: 'Greek' }],
};

const DEFAULT_MAX_SUBSTITUTIONS = 2;
const DEFAULT_MAX_VARIANTS = 500;

/**
 * Normalize a brand token: lowercase, trim, strip TLD and any scheme.
 * @param {string} brand
 * @returns {string}
 */
export function normalizeBrand(brand) {
  if (!brand) return '';
  let s = String(brand).trim().toLowerCase();
  s = s.replace(/^\w+:\/\//, '').replace(/^[^@\s]+@/, '');
  s = s.split('/')[0];
  const parts = s.split('.');
  // Keep only the registrable label (strip common TLDs).
  if (parts.length > 1) s = parts[0];
  return s.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * Generate homoglyph variants of a brand label by substituting confusable
 * Unicode glyphs for ASCII letters.
 *
 * @param {string} brand Brand token (label only, no TLD)
 * @param {{maxSubstitutions?: number, maxVariants?: number, includeSingleSubstitutionOnly?: boolean}} [options]
 * @returns {{variant: string, substitutions: {index: number, from: string, to: string, script: string}[], visualDistance: number}[]}
 *   Sorted by visual distance (fewest substitutions first). `visualDistance`
 *   is the number of substituted characters — lower means the variant is a
 *   more convincing visual copy.
 */
export function generateHomoglyphVariants(brand, options = {}) {
  const label = normalizeBrand(brand);
  if (!label) return [];
  const maxSubstitutions = Math.max(1, options.maxSubstitutions ?? DEFAULT_MAX_SUBSTITUTIONS);
  const maxVariants = Math.max(1, options.maxVariants ?? DEFAULT_MAX_VARIANTS);

  const chars = [...label];
  const substitutionsAt = chars.map((c) => CONFUSABLES[c] || []);
  const results = [];
  const seen = new Set();

  const push = (variantChars, subs) => {
    const variant = variantChars.join('');
    if (seen.has(variant) || variant === label) return;
    seen.add(variant);
    results.push({
      variant,
      substitutions: subs.map((s) => ({ ...s })),
      visualDistance: subs.length,
    });
  };

  // Single-substitution variants (highest risk, always generated).
  for (let i = 0; i < chars.length; i++) {
    for (const { ch, script } of substitutionsAt[i]) {
      const next = [...chars];
      next[i] = ch;
      push(next, [{ index: i, from: chars[i], to: ch, script }]);
      if (results.length >= maxVariants) break;
    }
    if (results.length >= maxVariants) break;
  }

  // Multi-substitution variants when requested.
  if (!options.includeSingleSubstitutionOnly && maxSubstitutions > 1) {
    outer: for (let a = 0; a < chars.length; a++) {
      for (const ga of substitutionsAt[a]) {
        for (let b = a + 1; b < chars.length; b++) {
          for (const gb of substitutionsAt[b]) {
            const next = [...chars];
            next[a] = ga.ch;
            next[b] = gb.ch;
            push(next, [
              { index: a, from: chars[a], to: ga.ch, script: ga.script },
              { index: b, from: chars[b], to: gb.ch, script: gb.script },
            ]);
            if (results.length >= maxVariants) break outer;
          }
        }
      }
    }
  }

  return results
    .slice(0, maxVariants)
    .sort((x, y) => x.visualDistance - y.visualDistance || x.variant.localeCompare(y.variant));
}

/**
 * Check whether a domain is a homoglyph (visual) variant of the brand:
 * renders a confusable-Unicode variant that could be confused with the
 * brand by a human reader.
 *
 * @param {string} domain Domain to inspect
 * @param {string} brand Brand token
 * @returns {{isHomoglyph: boolean, label: string, asciiRendering: string, substitutions: {index: number, from: string, to: string}[], risk: 'high'|'medium'|'low'|'none'}}
 *   `asciiRendering` maps confusables back to ASCII so analysts see what
 *   the domain "looks like". Risk is high when exactly one glyph was
 *   swapped (most convincing squat).
 */
export function detectHomoglyphDomain(domain, brand) {
  const result = { isHomoglyph: false, label: '', asciiRendering: '', substitutions: [], risk: 'none' };
  const needle = normalizeBrand(brand);
  if (!needle || !domain) return result;
  const host = String(domain).trim().toLowerCase().replace(/\.$/, '').split('/')[0];
  const label = host.split('.').find((p) => p) || '';
  result.label = label;

  // Build reverse map: confusable char -> ASCII letter.
  const reverse = new Map();
  for (const [ascii, list] of Object.entries(CONFUSABLES)) {
    for (const { ch } of list) reverse.set(ch, ascii);
  }

  const chars = [...label];
  const rendered = chars.map((c) => reverse.get(c) || c);
  const asciiRendering = rendered.join('');
  result.asciiRendering = asciiRendering;

  const subs = [];
  for (let i = 0; i < chars.length; i++) {
    if (reverse.has(chars[i])) {
      subs.push({ index: i, from: reverse.get(chars[i]), to: chars[i] });
    }
  }
  if (!subs.length) return result;

  const matches = asciiRendering === needle;
  result.substitutions = subs;
  result.isHomoglyph = matches;
  if (matches) {
    result.risk = subs.length === 1 ? 'high' : subs.length === 2 ? 'medium' : 'low';
  }
  return result;
}

/**
 * Build a registration-check worklist: every variant under each TLD the
 * caller cares about. The caller resolves registration state (registered /
 * available / parked) itself.
 *
 * @param {string} brand Brand token
 * @param {string[]} tlds TLDs to check (without leading dot)
 * @param {{maxSubstitutions?: number, maxVariants?: number}} [options]
 * @returns {{domain: string, variant: string, tld: string, visualDistance: number, scripts: string[]}[]}
 */
export function buildHomoglyphChecklist(brand, tlds = ['com', 'net', 'org'], options = {}) {
  const variants = generateHomoglyphVariants(brand, options);
  const list = [];
  for (const v of variants) {
    for (const tld of tlds || []) {
      const clean = String(tld).replace(/^\./, '').toLowerCase();
      if (!clean) continue;
      list.push({
        domain: `${v.variant}.${clean}`,
        variant: v.variant,
        tld: clean,
        visualDistance: v.visualDistance,
        scripts: [...new Set(v.substitutions.map((s) => s.script))],
      });
    }
  }
  return list;
}

/**
 * Triage registration results: separate registered variants (squats to
 * investigate) from available ones (registrations to consider defending).
 * Defensive registrations supplied by the caller are excluded from the
 * suspect list.
 *
 * @param {{domain: string, visualDistance: number}[]} checklist Output of buildHomoglyphChecklist
 * @param {{domain: string, registered: boolean}[]} registrationResults Caller-provided lookup results
 * @param {string[]} [defensiveDomains] Known org-owned defensive registrations
 * @returns {{suspect: {domain: string, visualDistance: number}[], available: {domain: string, visualDistance: number}[], defensive: {domain: string}[]}}
 */
export function triageHomoglyphRegistrations(checklist = [], registrationResults = [], defensiveDomains = []) {
  const defensive = new Set((defensiveDomains || []).map((d) => String(d).toLowerCase()));
  const regMap = new Map((registrationResults || []).map((r) => [String(r.domain).toLowerCase(), !!r.registered]));
  const suspect = [];
  const available = [];
  const defensiveHits = [];

  for (const item of checklist || []) {
    const key = String(item.domain).toLowerCase();
    if (defensive.has(key)) {
      defensiveHits.push({ domain: item.domain });
      continue;
    }
    if (regMap.get(key) === true) suspect.push({ domain: item.domain, visualDistance: item.visualDistance });
    else if (regMap.get(key) === false) available.push({ domain: item.domain, visualDistance: item.visualDistance });
  }

  const byDistance = (a, b) => a.visualDistance - b.visualDistance;
  return {
    suspect: suspect.sort(byDistance),
    available: available.sort(byDistance),
    defensive: defensiveHits,
  };
}
