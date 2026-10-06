/**
 * huntPlanner.js — Hunt Planner orchestrator.
 *
 * Turns a bounty program's scope rules + a target + a budget into a safe,
 * versioned hunt plan: recon → detection → PoC → reporting. Wires together
 * ideas 30005–30014:
 *   scope text --(30005 parse)--> rules --(30009 filter)--> safe modules
 *   target     --(30006 classify)--> type/template (+30014 cold start)
 *   budget     --(30007 convert)--> phase minutes
 *   payouts    --(30008 weights)--> focus
 *   goal       --(30012 encode)--> objectives
 *   candidates --(30011 tournament)--> winning plan
 *   plan       --(30010 dry run)--> coverage estimate
 *   plan       --(30013 ledger)--> versioned plan
 */

import { parseScopeRules } from './scopeRuleParser.js';
import { classifyTarget, selectPlanTemplate } from './targetTypeClassifier.js';
import { convertBudgetToMinutes } from './budgetTimeConverter.js';
import { payoutWeights } from './payoutPriorWeights.js';
import { PLAN_MODULES, filterPlanModules } from './planModuleFilter.js';
import { syntheticTargetGraph, dryRunPlan } from './planDryRun.js';
import { runTournament } from './planTournament.js';
import { encodeIntent } from './intentEncoder.js';
import { createPlanLedger } from './planVersionLedger.js';
import { seedColdStartModules, needsColdStart } from './coldStartPlanner.js';

const sharedLedger = createPlanLedger();

/**
 * Build a versioned, scope-safe hunt plan.
 * @param {object} opts
 * @param {string} opts.scopeText - bounty program rules prose
 * @param {object} opts.target - { domain, tech, paths }
 * @param {object} opts.budget - { hours?, dollars? }
 * @param {string} opts.userGoal - one-line goal, e.g. "find RCE only"
 * @param {object} [opts.history] - { [targetType]: huntCount } for cold-start check
 * @returns {object} versioned plan
 */
export function planHunt({ scopeText = '', target = {}, budget = {}, userGoal = '', history = {} } = {}) {
  // 30005 — parse scope rules
  const rules = parseScopeRules(scopeText);
  // 30006 — classify target → template
  const classification = classifyTarget(target);
  const template = selectPlanTemplate(classification);
  // 30014 — cold start seeding when no history
  const coldStart = needsColdStart(classification.type, history)
    ? seedColdStartModules(classification.type)
    : { modules: [], source: 'history available' };
  // 30009 — enforce scope rules on the FULL catalog (30005 → 30009 wiring:
  // every forbidden action is audited in removedModules, never silently dropped)
  const { kept, removed } = filterPlanModules(PLAN_MODULES, rules);
  // 30014 — cold start orders the surviving modules by writeup-derived preference
  const preferred = coldStart.modules.length ? coldStart.modules : kept.map((m) => m.id);
  const ordered = [...kept].sort((a, b) => {
    const ai = preferred.indexOf(a.id);
    const bi = preferred.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  // 30007 — budget → minutes
  const { totalMinutes, allocations } = convertBudgetToMinutes(budget, template.phases);
  // 30008 — payout focus weights
  const focus = payoutWeights(template.focus);
  // 30012 — user intent
  const intent = encodeIntent(userGoal);
  // 30011 — tournament picks the winning candidate
  const { winner, scored } = runTournament(ordered, allocations, focus);
  // 30010 — dry-run coverage estimate (no traffic)
  const coverage = dryRunPlan(winner, syntheticTargetGraph());
  // 30013 — version the plan
  const plan = {
    targetType: classification.type,
    targetConfidence: classification.confidence,
    template: template.id,
    phases: template.phases,
    allocations,
    totalMinutes,
    focus,
    intent,
    modules: winner.modules,
    strategy: winner.name,
    removedModules: removed.map((r) => ({ id: r.module.id, reason: r.reason })),
    forbidden: rules.forbidden,
    coverage,
    tournamentScores: scored,
    coldStart: coldStart.source,
  };
  const version = sharedLedger.savePlan(plan);
  return { version, plan };
}

/** Access the shared ledger (for recordHunt / A/B tracking). */
export function getPlannerLedger() {
  return sharedLedger;
}

export const HUNT_PLANNER = { planHunt, getPlannerLedger };
export default HUNT_PLANNER;
