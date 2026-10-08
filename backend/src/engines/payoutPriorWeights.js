/**
 * payoutPriorWeights.js — Idea 30008.
 *
 * Weights hunt-plan focus by historical average payout per vulnerability
 * class, so limited time goes where bounties historically pay most.
 * Pure statistics — no probing logic.
 */

/** Illustrative historical average payouts (USD) per vulnerability class. */
export const HISTORICAL_AVG_PAYOUTS = {
  rce: 5200,
  'auth-bypass': 3100,
  sqli: 2800,
  ssrf: 2400,
  idor: 1500,
  xss: 900,
  csrf: 600,
  'open-redirect': 400,
  'info-leak': 350,
  misconfig: 300,
};

/**
 * Convert historical payouts into normalized focus weights (sum = 1).
 * @param {string[]} classes - vulnerability classes to weight
 * @param {object} payouts - optional override table { class: avgUsd }
 * @returns {Record<string, number>} weights keyed by class
 */
export function payoutWeights(classes = [], payouts = HISTORICAL_AVG_PAYOUTS) {
  const list = classes.length ? classes : Object.keys(payouts);
  const total = list.reduce((s, c) => s + (payouts[c] ?? 0), 0) || 1;
  const weights = {};
  for (const c of list) weights[c] = Math.round(((payouts[c] ?? 0) / total) * 1000) / 1000;
  return weights;
}

/**
 * Rank vulnerability classes by expected payout weight, descending.
 * @param {string[]} classes
 * @param {object} payouts
 * @returns {{ class: string, weight: number }[]}
 */
export function rankByPayout(classes = [], payouts = HISTORICAL_AVG_PAYOUTS) {
  const w = payoutWeights(classes, payouts);
  return Object.entries(w)
    .map(([c, weight]) => ({ class: c, weight }))
    .sort((a, b) => b.weight - a.weight);
}

export const PAYOUT_PRIOR_WEIGHTS = { HISTORICAL_AVG_PAYOUTS, payoutWeights, rankByPayout };
export default PAYOUT_PRIOR_WEIGHTS;
