/**
 * ctLookalikeMonitor.js — Lookalike TLS-certificate monitoring via Certificate Transparency.
 *
 * Phishing infrastructure usually needs a valid TLS certificate. This module
 * matches freshly observed CT-log certificate records against a lookalike
 * domain model of the brand (typosquats, homoglyph-adjacent spellings,
 * prefix/suffix tricks, suspicious TLD swaps) so impersonation domains are
 * caught at issuance time — before they go live.
 *
 * Defensive framing: the operator supplies CT records (from crt.sh-style feeds
 * or their own log feed); this module only performs string matching, no fetching.
 */

/**
 * Levenshtein edit distance between two strings.
 */
export function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
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
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

const KEYBOARD_ADJACENT = {
  a: 'qwsz',
  b: 'vghn',
  c: 'xdfv',
  d: 'serfcx',
  e: 'wsdr',
  f: 'drtgcv',
  g: 'ftyhbv',
  h: 'gyujnb',
  i: 'ujko',
  j: 'huiknm',
  k: 'jiolm',
  l: 'kop',
  m: 'njk',
  n: 'bhjm',
  o: 'iklp',
  p: 'ol',
  q: 'wa',
  r: 'edft',
  s: 'awedxz',
  t: 'rfgy',
  u: 'yhji',
  v: 'cfgb',
  w: 'qase',
  x: 'zsdc',
  y: 'tghu',
  z: 'xsa',
};

/**
 * Generate a lookalike variant set for a brand's base name (registrable label,
 * without TLD). Covers the classic phishing tricks.
 *
 * @param {string} brandLabel e.g. "paystack" or "acmebank"
 * @param {string[]} extraTlds extra suspicious TLDs to pair with variants
 */
export function generateLookalikeLabels(brandLabel, extraTlds = ['com', 'net', 'org', 'io', 'co']) {
  const label = String(brandLabel || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!label) return new Set();
  const variants = new Set();

  // Omission / duplication / transposition / substitution
  for (let i = 0; i < label.length; i++) {
    variants.add(label.slice(0, i) + label.slice(i + 1)); // omission
    variants.add(label.slice(0, i) + label[i] + label.slice(i)); // duplication
    if (i < label.length - 1) {
      variants.add(label.slice(0, i) + label[i + 1] + label[i] + label.slice(i + 2)); // transposition
    }
    const adj = KEYBOARD_ADJACENT[label[i]] || '';
    for (const ch of adj) {
      variants.add(label.slice(0, i) + ch + label.slice(i + 1)); // keyboard-adjacent substitution
    }
  }
  // Prefix/suffix tricks attackers love
  const affixes = [
    'secure',
    'login',
    'verify',
    'account',
    'support',
    'update',
    'auth',
    'app',
    'pay',
  ];
  for (const af of affixes) {
    variants.add(`${af}${label}`);
    variants.add(`${label}${af}`);
    variants.add(`${af}-${label}`);
    variants.add(`${label}-${af}`);
  }
  variants.delete(label);
  return variants;
}

function stripTld(domain) {
  const d = String(domain || '')
    .toLowerCase()
    .replace(/^\*\./, '');
  const parts = d.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : d;
}

/**
 * Match CT certificate records against the brand's lookalike model.
 *
 * @param {string} brandDomain e.g. "acmebank.com"
 * @param {{domain: string, issuer?: string, notBefore?: string}[]} certRecords
 * @param {{maxEditDistance?: number}} options
 * @returns {object[]} matches with the trick identified and evidence
 */
export function matchLookalikeCertificates(brandDomain, certRecords = [], options = {}) {
  const brand = String(brandDomain || '').toLowerCase();
  const brandLabel = stripTld(brand).split('.').pop() || '';
  if (!brandLabel) return [];
  const maxDist = options.maxEditDistance ?? 2;
  const lookalikes = generateLookalikeLabels(brandLabel);
  const findings = [];
  const seen = new Set();

  for (const rec of certRecords) {
    const domain = String(rec?.domain || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    if (!domain || domain === brand || domain.endsWith(`.${brand}`) || seen.has(domain)) continue;
    seen.add(domain);
    const label = stripTld(domain).split('.').pop() || '';
    let trick = null;
    let score = 0;

    if (lookalikes.has(label)) {
      trick = 'typosquat-variant';
      score = 0.95;
    } else {
      const dist = levenshtein(label, brandLabel);
      if (dist <= maxDist && label.length >= 3) {
        trick = `edit-distance-${dist}`;
        score = Math.max(0.4, 0.9 - dist * 0.2);
      } else if (label.includes(brandLabel) && label !== brandLabel) {
        trick = 'brand-substring-embed';
        score = 0.8;
      }
    }
    if (!trick) continue;

    findings.push({
      type: 'lookalike-certificate',
      domain,
      trick,
      similarityScore: Number(score.toFixed(3)),
      severity: score >= 0.9 ? 'high' : 'medium',
      evidence: {
        brandDomain: brand,
        issuer: rec.issuer || null,
        notBefore: rec.notBefore || null,
      },
    });
  }
  return findings.sort((a, b) => b.similarityScore - a.similarityScore);
}

export const CT_LOOKALIKE_MONITOR = {
  levenshtein,
  generateLookalikeLabels,
  matchLookalikeCertificates,
};

export default CT_LOOKALIKE_MONITOR;
