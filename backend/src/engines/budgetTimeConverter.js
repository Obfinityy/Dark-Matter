/**
 * budgetTimeConverter.js — Idea 30007.
 *
 * Converts a dollar/hour budget into per-phase minute allocations using
 * historical cost-per-phase data. Planning arithmetic only.
 */

/** Historical average share of hunt effort per phase (sums to 1). */
export const PHASE_COST_SHARES = {
  recon: 0.25,
  'auth-mapping': 0.08,
  'api-mapping': 0.1,
  'cart-flow': 0.08,
  'payment-flow': 0.07,
  'mobile-specific': 0.08,
  testing: 0.4,
  chaining: 0.12,
  reporting: 0.1,
};

/** Fallback shares for the canonical 4-phase plan (sums to 1). */
export const CANONICAL_PHASE_SHARES = { recon: 0.25, testing: 0.45, chaining: 0.15, reporting: 0.15 };

/** Default analyst cost assumption when only dollars are given. */
export const DOLLARS_PER_HOUR = 75;

/**
 * Convert a budget into per-phase minute allocations.
 * @param {object} budget - { hours?: number, dollars?: number }
 * @param {string[]} phases - ordered phase names from the plan template
 * @returns {{ totalMinutes: number, allocations: Record<string, number> }}
 */
export function convertBudgetToMinutes(budget = {}, phases = ['recon', 'testing', 'chaining', 'reporting']) {
  const hours = budget.hours ?? (budget.dollars != null ? budget.dollars / DOLLARS_PER_HOUR : 4);
  const totalMinutes = Math.max(30, Math.round(hours * 60));
  const weights = {};
  let weightSum = 0;
  for (const p of phases) {
    const w = PHASE_COST_SHARES[p] ?? CANONICAL_PHASE_SHARES[p] ?? 1 / phases.length;
    weights[p] = w;
    weightSum += w;
  }
  const allocations = {};
  let assigned = 0;
  phases.forEach((p, i) => {
    const mins = i === phases.length - 1
      ? totalMinutes - assigned
      : Math.floor((weights[p] / weightSum) * totalMinutes);
    allocations[p] = mins;
    assigned += mins;
  });
  return { totalMinutes, allocations };
}

export const BUDGET_TIME_CONVERTER = { PHASE_COST_SHARES, CANONICAL_PHASE_SHARES, DOLLARS_PER_HOUR, convertBudgetToMinutes };
export default BUDGET_TIME_CONVERTER;
