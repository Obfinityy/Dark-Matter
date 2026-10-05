/**
 * namingMarkovPredictor.js — AI-style subdomain guessing via Markov n-gram naming model.
 *
 * Organizations name infrastructure with detectable habits (api-v2-eu, svc-billing-01).
 * This module trains a character-level Markov model on the org's known subdomain
 * labels, then (a) scores candidate names by how "on-brand" they are and (b)
 * generates new candidates that follow the same naming distribution — turning
 * naming-pattern intuition into ranked guesses for authorized discovery.
 *
 * Pure functions only: training, scoring, and deterministic generation with a
 * seeded PRNG so runs are reproducible.
 */

/**
 * Train a character-level Markov model on subdomain labels.
 *
 * @param {string[]} labels known subdomain labels (bare, e.g. "api-v2-eu")
 * @param {number} order n-gram order (default 3)
 * @returns {{order: number, transitions: object, starts: object, alphabet: string[]}}
 */
export function trainNamingModel(labels = [], order = 3) {
  const o = Math.max(1, Math.min(6, Math.floor(order) || 3));
  const transitions = {};
  const starts = {};
  const alphabet = new Set();
  const END = '\u0003';

  for (const raw of labels) {
    const label = String(raw || '').toLowerCase().trim();
    if (!label) continue;
    const seq = label + END;
    for (const ch of label) alphabet.add(ch);
    const startKey = label.slice(0, o);
    starts[startKey] = (starts[startKey] || 0) + 1;
    for (let i = 0; i < seq.length; i++) {
      const gram = seq.slice(Math.max(0, i - o), i).padStart(o, '\u0002');
      const next = seq[i];
      alphabet.add(next);
      if (!transitions[gram]) transitions[gram] = {};
      transitions[gram][next] = (transitions[gram][next] || 0) + 1;
    }
  }
  return { order: o, transitions, starts, alphabet: [...alphabet].filter((c) => c !== END) };
}

/**
 * Log-likelihood of a label under the trained model (higher = more on-brand).
 * @param {{order: number, transitions: object}} model
 * @param {string} label
 */
export function scoreLabelLikelihood(model, label) {
  if (!model || !model.transitions) return -Infinity;
  const END = '\u0003';
  const s = String(label || '').toLowerCase().trim();
  if (!s) return -Infinity;
  const seq = s + END;
  const o = model.order;
  let logProb = 0;
  for (let i = 0; i < seq.length; i++) {
    const gram = seq.slice(Math.max(0, i - o), i).padStart(o, '\u0002');
    const next = seq[i];
    const dist = model.transitions[gram];
    if (!dist) return -Infinity;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const p = (dist[next] || 0) / total;
    if (p <= 0) return -Infinity;
    logProb += Math.log(p);
  }
  return logProb / seq.length; // length-normalized
}

/**
 * Rank candidate labels by model likelihood (most on-brand first).
 * @param {{order: number, transitions: object}} model
 * @param {string[]} candidates
 */
export function rankCandidatesByLikelihood(model, candidates = []) {
  return candidates
    .map((c) => ({ label: String(c), score: scoreLabelLikelihood(model, c) }))
    .filter((r) => r.score !== -Infinity)
    .sort((a, b) => b.score - a.score);
}

/**
 * Minimal seeded PRNG (mulberry32) for reproducible generation.
 */
function seededRandom(seed) {
  let t = (seed >>> 0) || 1;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(dist, rand) {
  const entries = Object.entries(dist);
  const total = entries.reduce((a, [, c]) => a + c, 0);
  let r = rand() * total;
  for (const [ch, count] of entries) {
    r -= count;
    if (r <= 0) return ch;
  }
  return entries[entries.length - 1][0];
}

/**
 * Generate candidate subdomain labels sampled from the model.
 *
 * @param {{order: number, transitions: object, starts: object}} model
 * @param {{count?: number, maxLength?: number, seed?: number}} options
 * @returns {string[]} unique generated labels (without trailing END marker)
 */
export function generateNamingCandidates(model, options = {}) {
  if (!model || !model.transitions) return [];
  const count = options.count ?? 50;
  const maxLength = options.maxLength ?? 24;
  const rand = seededRandom(options.seed ?? 42);
  const END = '\u0003';
  const o = model.order;
  const startKeys = Object.keys(model.starts || {});
  const out = new Set();

  let guard = 0;
  while (out.size < count && guard < count * 40) {
    guard++;
    let gram = startKeys.length
      ? startKeys[Math.floor(rand() * startKeys.length)]
      : '';
    gram = gram.padStart(o, '\u0002');
    let label = gram.replace(/\u0002/g, '');
    while (label.length < maxLength) {
      const dist = model.transitions[gram];
      if (!dist) break;
      const next = pickWeighted(dist, rand);
      if (next === END) break;
      label += next;
      gram = (gram + next).slice(-o);
    }
    const clean = label.replace(/[^\w-]/g, '');
    if (clean.length >= 3) out.add(clean);
  }
  return [...out];
}

/**
 * Full prediction pipeline: train on known labels, generate, and rank.
 * @param {string[]} knownLabels
 * @param {string} domain base domain for fqdn output
 * @param {{order?: number, count?: number, seed?: number}} options
 */
export function predictSubdomains(knownLabels = [], domain = '', options = {}) {
  const model = trainNamingModel(knownLabels, options.order ?? 3);
  const labels = generateNamingCandidates(model, {
    count: options.count ?? 50,
    seed: options.seed ?? 42,
  });
  const known = new Set(knownLabels.map((l) => String(l).toLowerCase()));
  const ranked = rankCandidatesByLikelihood(model, labels).filter((r) => !known.has(r.label));
  const base = String(domain || '').toLowerCase().replace(/\.$/, '');
  return ranked.map((r) => ({
    label: r.label,
    likelihood: Number(r.score.toFixed(4)),
    fqdn: base ? `${r.label}.${base}` : r.label,
  }));
}

export const NAMING_MARKOV_PREDICTOR = {
  trainNamingModel,
  scoreLabelLikelihood,
  rankCandidatesByLikelihood,
  generateNamingCandidates,
  predictSubdomains,
};

export default NAMING_MARKOV_PREDICTOR;
