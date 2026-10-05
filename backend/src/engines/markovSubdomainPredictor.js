/**
 * markovSubdomainPredictor.js — AI-style subdomain guessing engine.
 *
 * @idea 0316 — AI-generated subdomain guessing: train a Markov/transformer
 *   model on the org's naming patterns to predict likely undiscovered
 *   subdomains.
 *
 * Implements a self-contained character-level Markov chain predictor in
 * pure JavaScript — no ML dependencies, no training framework, no network.
 * Callers feed it the org's known subdomain labels; it learns the character
 * transition patterns and generates plausible undiscovered candidates.
 *
 * Defensive framing: predicts subdomains of a target the owner authorized
 * the agent to hunt on, mirroring how a human hunter extrapolates naming
 * conventions.
 */

const START = '^';
const END = '$';

/**
 * Simple seeded PRNG (mulberry32) for reproducible generation.
 * @param {number} seed
 * @returns {() => number} function returning [0,1)
 */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Train a character-level Markov chain on subdomain labels.
 * @param {string[]} labels subdomain labels (single left-most labels or full sub-chains)
 * @param {object} [opts]
 * @param {number} [opts.order=2] Markov order (context length)
 * @returns {{order: number, transitions: Record<string, Record<string, number>>, trainedOn: number}}
 */
export function trainMarkovChain(labels = [], opts = {}) {
  const { order = 2 } = opts || {};
  const transitions = {};
  let trainedOn = 0;

  for (const raw of labels || []) {
    const label = String(raw || '').toLowerCase().trim();
    if (!label || !/^[a-z0-9][a-z0-9._-]*$/.test(label)) continue;
    trainedOn++;
    const seq = START.repeat(order) + label + END;
    for (let i = 0; i + order < seq.length; i++) {
      const ctx = seq.slice(i, i + order);
      const next = seq[i + order];
      if (!transitions[ctx]) transitions[ctx] = {};
      transitions[ctx][next] = (transitions[ctx][next] || 0) + 1;
    }
  }
  return { order, transitions, trainedOn };
}

/**
 * Log-probability of a label under the trained chain.
 * @param {{order: number, transitions: Record<string, Record<string, number>>}} model
 * @param {string} label
 * @returns {number} log probability (higher = more pattern-consistent)
 */
export function labelLogProbability(model, label) {
  const order = model?.order || 2;
  const transitions = model?.transitions || {};
  const seq = START.repeat(order) + String(label || '').toLowerCase() + END;
  let logp = 0;
  for (let i = 0; i + order < seq.length; i++) {
    const ctx = seq.slice(i, i + order);
    const next = seq[i + order];
    const dist = transitions[ctx];
    if (!dist) {
      logp += Math.log(1e-6);
      continue;
    }
    const total = Object.values(dist).reduce((s, c) => s + c, 0);
    const p = (dist[next] || 1e-9) / total;
    logp += Math.log(p);
  }
  return logp;
}

/**
 * Sample one label from the chain using the supplied PRNG.
 * @param {{order: number, transitions: Record<string, Record<string, number>>}} model
 * @param {() => number} rand
 * @param {object} [opts]
 * @param {number} [opts.maxLength=24] max characters
 * @returns {string|null}
 */
export function sampleLabel(model, rand, opts = {}) {
  const { maxLength = 24 } = opts || {};
  const order = model?.order || 2;
  const transitions = model?.transitions || {};
  let ctx = START.repeat(order);
  let out = '';
  for (let n = 0; n < maxLength; n++) {
    const dist = transitions[ctx];
    if (!dist) return null;
    const entries = Object.entries(dist);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    let r = rand() * total;
    let next = null;
    for (const [ch, count] of entries) {
      r -= count;
      if (r <= 0) {
        next = ch;
        break;
      }
    }
    if (!next) next = entries[entries.length - 1][0];
    if (next === END) break;
    out += next;
    ctx = (ctx + next).slice(-order);
  }
  if (!out || !/^[a-z0-9][a-z0-9._-]*$/.test(out)) return null;
  return out;
}

/**
 * Generate candidate subdomain labels from the trained model.
 * @param {{order: number, transitions: Record<string, Record<string, number>>}} model
 * @param {object} [opts]
 * @param {number} [opts.count=200] candidates to attempt
 * @param {number} [opts.seed=42] PRNG seed (reproducible)
 * @param {number} [opts.maxLength=24]
 * @param {string[]} [opts.exclude=[]] labels to skip (already known)
 * @returns {{label: string, logProbability: number}[]}
 */
export function generateCandidates(model, opts = {}) {
  const { count = 200, seed = 42, maxLength = 24, exclude = [] } = opts || {};
  const excluded = new Set((exclude || []).map((l) => String(l || '').toLowerCase()));
  const rand = seededRandom(seed);
  const seen = new Set();
  const results = [];

  for (let i = 0; i < count * 3 && results.length < count; i++) {
    const label = sampleLabel(model, rand, { maxLength });
    if (!label || seen.has(label) || excluded.has(label)) continue;
    seen.add(label);
    results.push({ label, logProbability: labelLogProbability(model, label) });
  }
  return results.sort((a, b) => b.logProbability - a.logProbability);
}

/**
 * Rank an arbitrary list of labels by how well they fit the learned pattern.
 * @param {{order: number, transitions: Record<string, Record<string, number>>}} model
 * @param {string[]} labels
 * @returns {{label: string, logProbability: number}[]}
 */
export function rankLabels(model, labels = []) {
  return (labels || [])
    .map((l) => ({ label: String(l || ''), logProbability: labelLogProbability(model, String(l || '')) }))
    .filter((r) => r.label)
    .sort((a, b) => b.logProbability - a.logProbability);
}
