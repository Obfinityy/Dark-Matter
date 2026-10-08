/**
 * planTournament.js — Idea 30011.
 *
 * Generates candidate hunt plans (breadth / depth / balanced variants),
 * scores each on predicted findings-per-hour, and picks the winner.
 * Tournament logic only — no probing.
 */

/**
 * Generate candidate plan variants from a base module set.
 * @param {object[]} modules - filtered plan modules
 * @param {object} allocations - per-phase minute allocations
 * @returns {object[]} 3 candidate plans
 */
export function generateCandidates(modules = [], allocations = {}) {
  const total = Object.values(allocations).reduce((s, v) => s + v, 0) || 240;
  const mk = (name, moduleIds, reconShare) => ({
    name,
    modules: modules.filter(m => moduleIds.includes(m.id)),
    timeSplit: {
      recon: Math.round(total * reconShare),
      testing: Math.round(total * (1 - reconShare) * 0.7),
      reporting: Math.round(total * (1 - reconShare) * 0.3),
    },
  });
  const ids = modules.map(m => m.id);
  const breadth = ids.filter((_, i) => i % 2 === 0);
  const depth = ids.slice(0, Math.max(1, Math.ceil(ids.length / 2)));
  return [
    mk('breadth-first', breadth.length ? breadth : ids, 0.45),
    mk('depth-first', depth.length ? depth : ids, 0.15),
    mk('balanced', ids, 0.28),
  ];
}

/**
 * Score a candidate on predicted findings-per-hour.
 * Model: coverage proxy (module count × payout-weighted focus) / hours.
 * @param {object} candidate
 * @param {object} payoutW - payout weights keyed by vuln class
 * @returns {number} predicted findings per hour
 */
export function scoreCandidate(candidate, payoutW = {}) {
  const modCount = candidate.modules.length || 1;
  const focusSum = Object.values(payoutW).reduce((s, v) => s + v, 0) || 1;
  const hours = Object.values(candidate.timeSplit || {}).reduce((s, v) => s + v, 0) / 60 || 1;
  const reconPenalty = (candidate.timeSplit?.recon || 0) / 60 / hours;
  return (
    Math.round(
      ((modCount * 0.6 * (1 + focusSum * 0.25)) / hours) * (1 - reconPenalty * 0.3) * 100
    ) / 100
  );
}

/**
 * Run the tournament: generate, score, pick the winner.
 * @param {object[]} modules
 * @param {object} allocations
 * @param {object} payoutW
 * @returns {{ winner: object, scored: { name: string, score: number }[] }}
 */
export function runTournament(modules = [], allocations = {}, payoutW = {}) {
  const candidates = generateCandidates(modules, allocations);
  const scored = candidates.map(c => ({
    name: c.name,
    score: scoreCandidate(c, payoutW),
    plan: c,
  }));
  scored.sort((a, b) => b.score - a.score);
  return { winner: scored[0].plan, scored: scored.map(({ name, score }) => ({ name, score })) };
}

export const PLAN_TOURNAMENT = { generateCandidates, scoreCandidate, runTournament };
export default PLAN_TOURNAMENT;
