/**
 * punycodeVariantEnumerator.js — xn-- punycode IDN squat enumeration.
 *
 * Homoglyph variants only become dangerous once registered, and every
 * non-ASCII domain is registered in its punycode (xn--) ASCII form. This
 * module converts Unicode brand lookalikes into their punycode spellings,
 * scores how visually deceptive each is, and flags the ones most likely to be
 * used as IDN-based phishing infrastructure.
 *
 * Defensive use only: pure local string/encoding work, no network I/O.
 */

import { domainToASCII, domainToUnicode } from 'node:url';
import { CONFUSABLES, generateHomoglyphs, scriptsInDomain } from './homoglyphDomainChecker.js';

/** Reverse index: confusable character -> base Latin character. */
const REVERSE_CONFUSABLES = (() => {
  const map = new Map();
  for (const [base, reps] of Object.entries(CONFUSABLES)) {
    for (const [char] of reps) {
      if (!map.has(char)) map.set(char, base);
    }
  }
  return map;
})();

/**
 * True when the domain is (or contains) a punycode-encoded label.
 * @param {string} domain
 * @returns {boolean}
 */
export function isPunycode(domain) {
  return /(^|\.)xn--/i.test(String(domain || ''));
}

/**
 * Encode a Unicode domain to its ASCII (punycode) registration form.
 * @param {string} domain Unicode domain, e.g. "p\u0430ypal.com"
 * @returns {string|null} ASCII form ("xn--pypal-4ve.com") or null on failure
 */
export function toPunycode(domain) {
  try {
    const ascii = domainToASCII(
      String(domain || '')
        .trim()
        .toLowerCase()
    );
    return ascii || null;
  } catch {
    return null;
  }
}

/**
 * Decode a punycode domain back to its Unicode display form.
 * @param {string} domain ASCII domain possibly containing xn-- labels
 * @returns {string} Unicode display form
 */
export function fromPunycode(domain) {
  try {
    return domainToUnicode(String(domain || ''));
  } catch {
    return String(domain || '');
  }
}

/**
 * Confusable-aware visual similarity between two labels (0-100).
 * Characters that are equal, or that form a known confusable pair, count as
 * matching — so "pаypal" (Cyrillic a) scores ~100 against "paypal" while a
 * random string scores near 0.
 * @param {string} a candidate label
 * @param {string} b brand label
 * @returns {number} 0-100
 */
export function visualDeceptiveness(a, b) {
  const x = [...String(a || '').toLowerCase()];
  const y = [...String(b || '').toLowerCase()];
  const len = Math.max(x.length, y.length);
  if (!len) return 0;
  let credit = 0;
  for (let i = 0; i < len; i++) {
    const ca = x[i] || '';
    const cb = y[i] || '';
    if (ca === cb) {
      credit += 1;
    } else if (REVERSE_CONFUSABLES.get(ca) === cb || REVERSE_CONFUSABLES.get(cb) === ca) {
      credit += 0.9; // known visual confusable: nearly invisible to victims
    } else if (ca && cb && Math.abs(ca.codePointAt(0) - cb.codePointAt(0)) < 8) {
      credit += 0.2; // adjacent codepoints: weak resemblance only
    }
  }
  return Math.round((credit / len) * 100);
}

/**
 * Enumerate punycode squats for a brand domain: generate Unicode homoglyph
 * variants of the brand label and convert each to its xn-- registration form.
 * @param {string} brandDomain e.g. "example.com"
 * @param {{maxVariants?: number}} [opts]
 * @returns {{unicode: string, ascii: string, deceptiveness: number, scripts: string[]}[]}
 *   sorted by deceptiveness, highest first
 */
export function enumeratePunycodeSquats(brandDomain, opts = {}) {
  const parts = String(brandDomain || '')
    .toLowerCase()
    .split('.');
  if (parts.length < 2) return [];
  const brandLabel = parts.slice(0, -1).join('.');
  const tld = parts[parts.length - 1];
  const findings = [];
  for (const v of generateHomoglyphs(brandLabel, opts)) {
    const unicode = `${v.variant}.${tld}`;
    const ascii = toPunycode(unicode);
    if (!ascii || !isPunycode(ascii)) continue;
    findings.push({
      unicode,
      ascii,
      deceptiveness: visualDeceptiveness(v.variant, brandLabel),
      scripts: v.scripts,
      substitutions: v.substitutions.length,
    });
  }
  findings.sort((a, b) => b.deceptiveness - a.deceptiveness || a.substitutions - b.substitutions);
  return findings;
}

/**
 * Score a candidate punycode domain against a brand (0-100 risk).
 * Combines visual deceptiveness with IDN structural signals.
 * @param {string} candidateAscii xn-- domain to evaluate
 * @param {string} brandLabel brand label, e.g. "example"
 * @returns {{ascii: string, unicode: string, deceptiveness: number, scripts: string[], risk: number, evidence: string}}
 */
export function scorePunycodeCandidate(candidateAscii, brandLabel) {
  const ascii = String(candidateAscii || '').toLowerCase();
  const unicode = fromPunycode(ascii);
  const candidateLabel = unicode.split('.')[0] || '';
  const deceptiveness = visualDeceptiveness(candidateLabel, brandLabel);
  const scripts = scriptsInDomain(unicode);
  const foreign = scripts.some(s => ['Cyrillic', 'Greek', 'Armenian'].includes(s));
  const risk = Math.round(deceptiveness * 0.8 + (foreign ? 20 : 0));
  return {
    ascii,
    unicode,
    deceptiveness,
    scripts,
    risk: Math.min(100, risk),
    evidence:
      `punycode form ${ascii} decodes to "${unicode}" ` +
      `(scripts: ${scripts.join(', ')}); visual similarity to brand label ` +
      `"${brandLabel}" is ${deceptiveness}/100`,
  };
}

/**
 * Rank a list of candidate xn-- domains by phishing-infrastructure risk.
 * @param {string[]} candidates ASCII domains (may include xn-- labels)
 * @param {string} brandLabel
 * @returns scored findings, highest risk first
 */
export function rankPunycodeFindings(candidates, brandLabel) {
  const unique = [...new Set((candidates || []).map(d => String(d).toLowerCase()))];
  return unique.map(c => scorePunycodeCandidate(c, brandLabel)).sort((a, b) => b.risk - a.risk);
}

export const PUNYCODE_VARIANT_ENUMERATOR = {
  isPunycode,
  toPunycode,
  fromPunycode,
  visualDeceptiveness,
  enumeratePunycodeSquats,
  scorePunycodeCandidate,
  rankPunycodeFindings,
};

export default PUNYCODE_VARIANT_ENUMERATOR;
