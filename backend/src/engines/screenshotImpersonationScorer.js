/**
 * screenshotImpersonationScorer.js — screenshot-based brand-impersonation
 * sweep scoring engine.
 *
 * @idea 0314 — Screenshot-based brand-impersonation sweep: compare suspicious
 *   domains' visual layout to the target's site to confirm impersonation.
 *
 * This engine implements the *comparison and scoring* layer only. It consumes
 * pre-captured feature vectors (perceptual hashes, DOM-tag histograms, color
 * palettes, text n-gram fingerprints) produced by the caller's capture
 * pipeline — it never takes screenshots itself and makes no network calls.
 *
 * Defensive framing: confirms whether a lookalike domain is visually
 * impersonating a brand so an authorized team can act (takedown/abuse report).
 */

/**
 * Hamming distance between two equal-length hex perceptual hashes.
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number} distance in bits (Infinity if incomparable)
 */
export function phashHamming(hexA, hexB) {
  const a = String(hexA || '').replace(/[^0-9a-f]/gi, '');
  const b = String(hexB || '').replace(/[^0-9a-f]/gi, '');
  if (!a || !b || a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i += 2) {
    let xor = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (xor) {
      xor &= xor - 1;
      dist++;
    }
  }
  return dist;
}

/**
 * Cosine similarity between two sparse tag-histogram objects
 * ({tagName: count}).
 * @param {Record<string, number>} histA
 * @param {Record<string, number>} histB
 * @returns {number} 0–1
 */
export function histogramCosine(histA = {}, histB = {}) {
  const keys = new Set([...Object.keys(histA || {}), ...Object.keys(histB || {})]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const va = Number(histA[k]) || 0;
    const vb = Number(histB[k]) || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Palette similarity: average per-color nearest-neighbor RGB distance,
 * mapped to 0–1 (1 = identical).
 * @param {{r: number, g: number, b: number, weight?: number}[]} palA
 * @param {{r: number, g: number, b: number, weight?: number}[]} palB
 * @returns {number} 0–1
 */
export function paletteSimilarity(palA = [], palB = []) {
  if (!palA.length || !palB.length) return 0;
  const dist = (c1, c2) =>
    Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
  const nearest = (c, pal) => Math.min(...pal.map((p) => dist(c, p)));
  const avgA = palA.reduce((s, c) => s + (c.weight || 1) * nearest(c, palB), 0) / palA.length;
  const avgB = palB.reduce((s, c) => s + (c.weight || 1) * nearest(c, palA), 0) / palB.length;
  const maxDist = Math.sqrt(3 * 255 ** 2);
  const avg = (avgA + avgB) / 2;
  return Math.max(0, 1 - avg / maxDist);
}

/**
 * Jaccard similarity between two text n-gram fingerprint sets.
 * @param {string[]} gramsA
 * @param {string[]} gramsB
 * @returns {number} 0–1
 */
export function textFingerprintSimilarity(gramsA = [], gramsB = []) {
  const setA = new Set(gramsA || []);
  const setB = new Set(gramsB || []);
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score one feature dimension (0–100 each).
 * @param {{phash?: string, tagHistogram?: Record<string, number>, palette?: {r:number,g:number,b:number,weight?:number}[], textGrams?: string[]}} targetFeatures
 * @param {{phash?: string, tagHistogram?: Record<string, number>, palette?: {r:number,g:number,b:number,weight?:number}[], textGrams?: string[]}} suspectFeatures
 * @returns {{visual: number, layout: number, color: number, text: number}}
 */
export function scoreFeatureDimensions(targetFeatures = {}, suspectFeatures = {}) {
  const out = { visual: 0, layout: 0, color: 0, text: 0 };
  if (targetFeatures?.phash && suspectFeatures?.phash) {
    const dist = phashHamming(targetFeatures.phash, suspectFeatures.phash);
    const bits = String(targetFeatures.phash).replace(/[^0-9a-f]/gi, '').length * 4;
    out.visual = dist === Infinity || bits === 0 ? 0 : Math.round(Math.max(0, (1 - dist / bits)) * 100);
  }
  if (targetFeatures?.tagHistogram && suspectFeatures?.tagHistogram) {
    out.layout = Math.round(histogramCosine(targetFeatures.tagHistogram, suspectFeatures.tagHistogram) * 100);
  }
  if (targetFeatures?.palette && suspectFeatures?.palette) {
    out.color = Math.round(paletteSimilarity(targetFeatures.palette, suspectFeatures.palette) * 100);
  }
  if (targetFeatures?.textGrams && suspectFeatures?.textGrams) {
    out.text = Math.round(textFingerprintSimilarity(targetFeatures.textGrams, suspectFeatures.textGrams) * 100);
  }
  return out;
}

/**
 * Weighted impersonation verdict from the four dimensions.
 * @param {{visual: number, layout: number, color: number, text: number}} dims
 * @param {object} [opts] per-dimension weights
 * @returns {{score: number, verdict: 'impersonation-likely'|'suspicious'|'inconclusive'|'not-impersonating', dimensions: object}}
 */
export function impersonationScore(dims = {}, opts = {}) {
  const w = { visual: 0.4, layout: 0.3, color: 0.15, text: 0.15, ...(opts || {}) };
  const dimsSafe = { visual: 0, layout: 0, color: 0, text: 0, ...(dims || {}) };
  const totalW = w.visual + w.layout + w.color + w.text || 1;
  const score = Math.round(
    (dimsSafe.visual * w.visual + dimsSafe.layout * w.layout + dimsSafe.color * w.color + dimsSafe.text * w.text) / totalW
  );
  const present = Object.values(dimsSafe).filter((v) => v > 0).length;
  let verdict;
  if (present === 0) verdict = 'inconclusive';
  else if (score >= 75) verdict = 'impersonation-likely';
  else if (score >= 45) verdict = 'suspicious';
  else verdict = 'not-impersonating';
  return { score, verdict, dimensions: dimsSafe };
}

/**
 * Run a full sweep: score every suspect against the target's features.
 * @param {{domain: string, features: object}} target
 * @param {{domain: string, features: object}[]} suspects
 * @param {object} [opts]
 * @returns {{domain: string, score: number, verdict: string, dimensions: object}[]}
 */
export function screenshotImpersonationSweep(target = {}, suspects = [], opts = {}) {
  const results = [];
  for (const s of suspects || []) {
    const dims = scoreFeatureDimensions(target?.features, s?.features);
    const { score, verdict, dimensions } = impersonationScore(dims, opts);
    results.push({ domain: String(s?.domain || ''), score, verdict, dimensions });
  }
  return results.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}
