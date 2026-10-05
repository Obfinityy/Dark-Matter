/**
 * brandLayoutComparator.js — Screenshot-free brand-impersonation layout comparison.
 *
 * Confirms suspected phishing pages by comparing their structural layout
 * features against the genuine brand site. Instead of pixel screenshots (which
 * need a browser), the operator supplies structured page features harvested
 * from their own authorized crawls: DOM shape, palette, typography, text
 * blocks, and form fingerprints. This module scores the resemblance.
 *
 * Defensive framing: inputs describe pages observed during authorized
 * brand-protection scans; outputs support takedown evidence.
 */

/**
 * Build a normalized numeric feature vector from structured page features.
 * Missing fields default to neutral zeros.
 *
 * @param {object} features
 * @returns {number[]}
 */
export function featureVector(features = {}) {
  const f = features || {};
  const palette = Array.isArray(f.colorPalette) ? f.colorPalette : [];
  const fonts = Array.isArray(f.fontFamilies) ? f.fontFamilies : [];
  const counts = f.elementCounts || {};
  const text = String(f.visibleTextSample || '');
  const vec = [
    Number(f.domDepth || 0) / 20,
    Number(counts.forms || 0) / 5,
    Number(counts.inputs || 0) / 15,
    Number(counts.buttons || 0) / 15,
    Number(counts.images || 0) / 40,
    Number(counts.iframes || 0) / 5,
    Number(counts.links || 0) / 100,
    palette.length / 8,
    fonts.length / 6,
    Number(f.hasPasswordField ? 1 : 0),
    Number(f.hasLoginKeyword ? 1 : 0),
    Number(f.logoPresent ? 1 : 0),
    Math.min(text.length, 5000) / 5000,
  ];
  return vec;
}

/**
 * Cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Compare two color palettes as sets of normalized hex colors.
 * @returns {number} Jaccard-style overlap in [0,1]
 */
export function paletteOverlap(a = [], b = []) {
  const norm = (c) => String(c || '').trim().toLowerCase().replace(/^#/, '');
  const setA = new Set(a.map(norm).filter(Boolean));
  const setB = new Set(b.map(norm).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 0.5;
  const inter = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Compare font family lists (case-insensitive, generic families ignored).
 */
export function fontOverlap(a = [], b = []) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const generic = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  const setA = new Set(a.map(norm).filter((x) => x && !generic.has(x)));
  const setB = new Set(b.map(norm).filter((x) => x && !generic.has(x)));
  if (setA.size === 0 && setB.size === 0) return 0.5;
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Compare a suspect page's layout against the genuine brand page.
 *
 * @param {object} target Structured features of the genuine brand page
 * @param {object} suspect Structured features of the suspicious page
 * @returns {{score: number, verdict: string, severity: string, evidence: object[]}}
 */
export function compareLayouts(target = {}, suspect = {}) {
  const structural = cosineSimilarity(featureVector(target), featureVector(suspect));
  const palette = paletteOverlap(target.colorPalette, suspect.colorPalette);
  const fonts = fontOverlap(target.fontFamilies, suspect.fontFamilies);
  // Structural DOM shape matters most; palette/fonts corroborate.
  const score = structural * 0.55 + palette * 0.3 + fonts * 0.15;

  let verdict = 'dissimilar';
  let severity = 'low';
  if (score >= 0.85) { verdict = 'likely-impersonation'; severity = 'high'; }
  else if (score >= 0.65) { verdict = 'suspicious-resemblance'; severity = 'medium'; }
  else if (score >= 0.45) { verdict = 'weak-resemblance'; severity = 'low'; }

  const evidence = [
    { signal: 'structural-similarity', value: Number(structural.toFixed(4)) },
    { signal: 'palette-overlap', value: Number(palette.toFixed(4)) },
    { signal: 'font-overlap', value: Number(fonts.toFixed(4)) },
  ];
  if (suspect.hasPasswordField && target.hasPasswordField) {
    evidence.push({ signal: 'both-pages-collect-credentials', value: 1 });
  }
  return {
    score: Number(score.toFixed(4)),
    verdict,
    severity,
    evidence,
  };
}

/**
 * Sweep a batch of suspect pages against the brand baseline.
 * @param {object} target genuine page features
 * @param {{host: string, features: object}[]} suspects
 */
export function sweepSuspects(target = {}, suspects = []) {
  return suspects
    .filter((s) => s && s.features)
    .map((s) => ({ host: s.host, ...compareLayouts(target, s.features) }))
    .filter((r) => r.verdict !== 'dissimilar')
    .sort((a, b) => b.score - a.score);
}

export const BRAND_LAYOUT_COMPARATOR = {
  featureVector,
  cosineSimilarity,
  paletteOverlap,
  fontOverlap,
  compareLayouts,
  sweepSuspects,
};

export default BRAND_LAYOUT_COMPARATOR;
