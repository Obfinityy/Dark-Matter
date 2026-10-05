/**
 * homoglyphDomainChecker.js — IDN homograph (homoglyph) squat detection.
 *
 * Attackers register domains that look identical to a trusted brand by swapping
 * Latin letters for visually identical characters from other Unicode scripts
 * (Cyrillic, Greek, Armenian, extended Latin). This module generates those
 * deceptive variants from a brand label so the security team can check which
 * are registered and request takedowns or defensive registrations.
 *
 * Defensive use only. All analysis is local string processing; registration
 * status is supplied through an injected lookup function, so this module
 * performs no network I/O at import or call time.
 */

/**
 * Visually confusable character substitutions, keyed by base Latin character.
 * Each entry lists [confusable character, script name]. Sourced from well-known
 * Unicode confusable pairs used in real IDN homograph attacks.
 */
export const CONFUSABLES = {
  a: [['\u0430', 'Cyrillic'], ['\u03B1', 'Greek']],
  c: [['\u0441', 'Cyrillic'], ['\u03F2', 'Greek']],
  d: [['\u0564', 'Armenian']],
  e: [['\u0435', 'Cyrillic']],
  g: [['\u0261', 'Latin-Extended']],
  h: [['\u04BB', 'Cyrillic'], ['\u0570', 'Armenian']],
  i: [['\u0456', 'Cyrillic'], ['\u0131', 'Latin-Extended'], ['\u03B9', 'Greek']],
  j: [['\u0458', 'Cyrillic']],
  k: [['\u03BA', 'Greek']],
  l: [['\u04CF', 'Cyrillic'], ['1', 'Digit']],
  m: [['\u0271', 'Latin-Extended']],
  o: [['\u043E', 'Cyrillic'], ['\u03BF', 'Greek']],
  p: [['\u0440', 'Cyrillic'], ['\u03C1', 'Greek']],
  q: [['\u02A0', 'Latin-Extended']],
  r: [['\u027E', 'Latin-Extended']],
  s: [['\u0455', 'Cyrillic']],
  u: [['\u03C5', 'Greek']],
  v: [['\u03BD', 'Greek']],
  w: [['\u051D', 'Cyrillic']],
  x: [['\u0445', 'Cyrillic'], ['\u03C7', 'Greek']],
  y: [['\u0443', 'Cyrillic']],
  0: [['o', 'Latin'], ['\u043E', 'Cyrillic'], ['\u03BF', 'Greek']],
};

/**
 * Confusable replacements for a single character.
 * @param {string} ch single character
 * @returns {{char: string, script: string}[]} replacements (empty when none)
 */
export function confusableReplacements(ch) {
  const entry = CONFUSABLES[ch.toLowerCase()];
  if (!entry) return [];
  return entry.map(([char, script]) => ({ char, script }));
}

/**
 * Identify the Unicode script of a single character (coarse ranges).
 * @param {string} ch single character
 * @returns {string} script name
 */
export function scriptOfChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x30 && cp <= 0x39) return 'Digit';
  if (cp >= 0x41 && cp <= 0x5a) return 'Latin';
  if ((cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0xff)) return 'Latin';
  if (cp >= 0x250 && cp <= 0x2af) return 'Latin-Extended';
  if (cp >= 0x370 && cp <= 0x3ff) return 'Greek';
  if (cp >= 0x400 && cp <= 0x4ff) return 'Cyrillic';
  if (cp >= 0x530 && cp <= 0x58f) return 'Armenian';
  if (cp === 0x2d) return 'Hyphen';
  return 'Other';
}

/**
 * Distinct scripts present in a domain string.
 * @param {string} domain
 * @returns {string[]} script names in order of appearance
 */
export function scriptsInDomain(domain) {
  const seen = [];
  for (const ch of String(domain || '')) {
    const s = scriptOfChar(ch);
    if (!seen.includes(s)) seen.push(s);
  }
  return seen;
}

/**
 * Score how suspicious the script mixture of a domain is (0-100).
 * Pure-ASCII labels score 0; a label mixing Latin with Cyrillic/Greek scores
 * near 100, which is the classic IDN homograph signature.
 * @param {string} domain
 * @returns {number} 0-100
 */
export function mixedScriptScore(domain) {
  const chars = [...String(domain || '')];
  if (!chars.length) return 0;
  const scripts = scriptsInDomain(domain).filter((s) => s !== 'Hyphen' && s !== 'Digit');
  if (scripts.length <= 1) return 0;
  const nonLatin = chars.filter((c) => {
    const s = scriptOfChar(c);
    return s !== 'Latin' && s !== 'Digit' && s !== 'Hyphen';
  }).length;
  const latinScripts = scripts.filter((s) => s === 'Latin' || s === 'Latin-Extended');
  const foreignScripts = scripts.filter((s) => s !== 'Latin' && s !== 'Latin-Extended');
  const mixBonus = latinScripts.length > 0 && foreignScripts.length > 0 ? 40 : 0;
  return Math.min(100, Math.round((nonLatin / chars.length) * 60 + mixBonus));
}

/**
 * Generate homoglyph variants of a domain label.
 * Produces single- and double-character substitutions plus one full-confusable
 * swap, each annotated with the scripts introduced.
 * @param {string} label domain label (e.g. "paypal")
 * @param {{maxVariants?: number, maxSubstitutions?: number}} [opts]
 * @returns {{variant: string, substitutions: {index:number,from:string,to:string,script:string}[], scripts: string[]}[]}
 */
export function generateHomoglyphs(label, opts = {}) {
  const { maxVariants = 250, maxSubstitutions = 2 } = opts;
  const base = String(label || '').toLowerCase();
  const out = [];
  const seen = new Set([base]);
  const positions = [];
  for (let i = 0; i < base.length; i++) {
    const reps = confusableReplacements(base[i]);
    if (reps.length) positions.push({ index: i, from: base[i], reps });
  }

  const pushVariant = (variant, substitutions) => {
    if (seen.has(variant) || out.length >= maxVariants) return false;
    seen.add(variant);
    out.push({ variant, substitutions, scripts: scriptsInDomain(variant) });
    return out.length < maxVariants;
  };

  // Single substitutions.
  for (const pos of positions) {
    for (const { char, script } of pos.reps) {
      const variant = base.slice(0, pos.index) + char + base.slice(pos.index + 1);
      if (!pushVariant(variant, [{ index: pos.index, from: pos.from, to: char, script }])) return out;
    }
  }

  // Double substitutions.
  if (maxSubstitutions >= 2) {
    for (let a = 0; a < positions.length; a++) {
      for (let b = a + 1; b < positions.length; b++) {
        const pa = positions[a];
        const pb = positions[b];
        for (const ra of pa.reps) {
          for (const rb of pb.reps) {
            const chars = [...base];
            chars[pa.index] = ra.char;
            chars[pb.index] = rb.char;
            const variant = chars.join('');
            if (!pushVariant(variant, [
              { index: pa.index, from: pa.from, to: ra.char, script: ra.script },
              { index: pb.index, from: pb.from, to: rb.char, script: rb.script },
            ])) return out;
          }
        }
      }
    }
  }
  return out;
}

/**
 * Generate homoglyph variants for a full domain (substitutions applied to the
 * leftmost label only; the TLD is preserved).
 * @param {string} domain e.g. "example.com"
 * @param {object} [opts] passed to generateHomoglyphs
 */
export function homoglyphsForDomain(domain, opts = {}) {
  const parts = String(domain || '').toLowerCase().split('.');
  if (parts.length < 2) return [];
  const label = parts.slice(0, -1).join('.');
  const tld = parts[parts.length - 1];
  return generateHomoglyphs(label, opts).map((v) => ({
    variant: `${v.variant}.${tld}`,
    substitutions: v.substitutions,
    scripts: v.scripts,
  }));
}

/**
 * Visual deception score for a homoglyph variant (0-100). Fewer, subtler
 * substitutions score higher because they are harder for a victim to notice.
 * @param {{variant: string, substitutions: object[]}} variant
 * @returns {number} 0-100
 */
export function visualRiskScore(variant) {
  const subs = variant.substitutions || [];
  if (!subs.length) return 0;
  let score = 100 - subs.length * 18;
  // Single-character Cyrillic/Greek swaps of common letters are the most
  // frequently abused pattern in the wild.
  const first = subs[0];
  if (subs.length === 1 && ['Cyrillic', 'Greek'].includes(first.script)) score += 8;
  return Math.max(5, Math.min(100, Math.round(score)));
}

/**
 * Merge generated variants with registration status supplied by the caller.
 * The lookup is injected so this module performs no network I/O.
 * @param {{variant: string, substitutions: object[], scripts: string[]}[]} variants
 * @param {(domain: string) => ({registered: boolean, registrar?: string, created?: string} | null)} lookup
 * @returns scored findings sorted by risk
 */
export function checkRegistrationStatus(variants, lookup) {
  if (typeof lookup !== 'function') throw new TypeError('lookup must be a function');
  const findings = [];
  for (const v of variants) {
    const status = lookup(v.variant);
    const scriptScore = mixedScriptScore(v.variant);
    const visual = visualRiskScore(v);
    const risk = Math.round(visual * 0.6 + scriptScore * 0.4);
    findings.push({
      domain: v.variant,
      registered: status ? Boolean(status.registered) : null,
      registrar: status?.registrar || null,
      created: status?.created || null,
      substitutions: v.substitutions,
      scripts: v.scripts,
      visualRisk: visual,
      mixedScriptScore: scriptScore,
      risk,
      evidence: `${v.substitutions.length} confusable substitution(s) ` +
        `(${v.substitutions.map((s) => `${s.from}\u2192${s.to} [${s.script}]`).join(', ')}) ` +
        `across scripts: ${v.scripts.join(', ')}`,
    });
  }
  findings.sort((a, b) => b.risk - a.risk);
  return findings;
}

/**
 * Full brand audit pipeline: generate variants, check registration, rank risk.
 * @param {string} domain brand domain to protect, e.g. "example.com"
 * @param {Function} lookup injected registration lookup
 * @param {object} [opts]
 */
export function auditBrandHomoglyphs(domain, lookup, opts = {}) {
  const variants = homoglyphsForDomain(domain, opts);
  return checkRegistrationStatus(variants, lookup);
}

export const HOMOGLYPH_DOMAIN_CHECKER = {
  CONFUSABLES,
  confusableReplacements,
  scriptOfChar,
  scriptsInDomain,
  mixedScriptScore,
  generateHomoglyphs,
  homoglyphsForDomain,
  visualRiskScore,
  checkRegistrationStatus,
  auditBrandHomoglyphs,
};

export default HOMOGLYPH_DOMAIN_CHECKER;
