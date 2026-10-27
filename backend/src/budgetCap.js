// Dark Matter — per-hunt spend budget cap (owner order 27 Oct 2026).
//
// The user sets a spend budget per hunt (e.g. $10). When the hunt's
// recorded spend (costTracker — every Meta/Bedrock token priced from
// MODEL_PRICING) reaches the budget, the hunt auto-PAUSES — it never
// stops, never restarts from scratch. A checkpoint is written, a
// status event lands, and Resume continues from that checkpoint.
//
//   resume without raising the budget -> the check fires again on
//     the next cycle and re-pauses with the same event. That is
//     correct behaviour, not a bug: the budget still stands.
//   raising the budget above current spend (or clearing it) lifts
//     the budget_reached hold; the next check passes and the hunt
//     continues from its checkpoint.
//
// This module owns the pure parts (parsing, the check) with
// injectable store deps, exactly like brainProvider.js: the loop
// calls checkBudget with no deps (real store), the unit tests pass
// stubs, and the lab runs the real store against a temp DATA_DIR.
// No Meta call happens here — the spend it reads was already
// recorded by brainProvider.callMetaModel (kind 'meta').

import { getHuntCost } from './costTracker.js';
import { readHuntMeta, writeHuntMetaCheckpoint, appendHuntEvent } from './store.js';

/** Sanity ceiling for a user-set budget — catches a $10000 typo. */
export const BUDGET_MAX_USD = 10000;

/**
 * Validate a user-supplied budget.
 *   number > 0 (or a numeric string) -> {ok:true, budgetUsd} (2dp)
 *   null / undefined / '' / 0         -> {ok:true, budgetUsd:null} (clear)
 *   anything else                      -> {ok:false, error:'invalid_budget'}
 */
export function parseBudgetUsd(value) {
  if (value === null || value === undefined || value === '') return { ok: true, budgetUsd: null };
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid_budget' };
  if (n === 0) return { ok: true, budgetUsd: null };
  if (n < 0 || n > BUDGET_MAX_USD) return { ok: false, error: 'invalid_budget' };
  return { ok: true, budgetUsd: Math.round(n * 100) / 100 };
}

/**
 * The budget check, run at the top of every loop cycle (next to the
 * credits gate in huntAgent.js). Returns true when the hunt may
 * proceed, false when it must pause at the budget.
 *
 * Fail-open by design: a store/cost read error never blocks a hunt
 * — the check simply passes and the next cycle tries again.
 */
export function checkBudget(huntId, {
  readMeta = readHuntMeta,
  getCost = getHuntCost,
  writeMeta = writeHuntMetaCheckpoint,
  thinkFn = (h, text) => {
    try {
      appendHuntEvent(h, { type: 'thinking', text: String(text) });
    } catch { /* the pause itself is what matters */ }
  },
  recordFn = appendHuntEvent,
} = {}) {
  let meta = null;
  try {
    meta = readMeta(huntId) || {};
  } catch {
    return true;
  }
  const budget = meta.budgetUsd;
  const hasBudget = typeof budget === 'number' && Number.isFinite(budget) && budget > 0;
  if (!hasBudget) {
    // No budget set — but a stale budget_reached reason must not
    // linger on the hunt and confuse the UI.
    if (meta.pausedReason === 'budget_reached') {
      try {
        writeMeta(huntId, { pausedReason: null });
      } catch { /* best-effort */ }
    }
    return true;
  }
  let spent = 0;
  try {
    spent = (getCost(huntId) || {}).totalUsd || 0;
  } catch {
    return true;
  }
  if (spent < budget) {
    // Under budget — lift a stale budget_reached hold left behind
    // by an earlier pause (e.g. the budget was raised via the route).
    if (meta.pausedReason === 'budget_reached') {
      try {
        writeMeta(huntId, { pausedReason: null });
      } catch { /* best-effort */ }
    }
    return true;
  }
  // At/above budget: PAUSE (not stop) with a checkpoint + an event.
  // The loop breaks right after this; Resume continues from the
  // checkpoint (meta.iteration + 1, findings rebuilt).
  try {
    writeMeta(huntId, { state: 'paused', paused: true, pausedReason: 'budget_reached' });
  } catch { /* best-effort */ }
  try {
    thinkFn(
      huntId,
      `Budget reached — $${spent.toFixed(2)} spent of a $${budget.toFixed(2)} budget. Hunt paused at the checkpoint. Raise the budget or press Resume to continue from here.`
    );
  } catch { /* best-effort */ }
  try {
    recordFn(huntId, {
      type: 'status',
      state: 'paused',
      reason: 'budget_reached',
      budgetUsd: budget,
      spentUsd: spent,
      at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
  return false;
}
