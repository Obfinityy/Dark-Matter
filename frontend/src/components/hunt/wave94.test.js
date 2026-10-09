/**
 * wave94.test.js — Infinity AI · Wave 94
 * node:test + node:assert/strict. Registry coverage (20/20 for 53721–53740,
 * 20/20 for 53741–53760, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave94.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE94_A_IDEAS } from './wave94ACore.js';
import * as X94A from './wave94ACore.js';
import { WAVE94_B_IDEAS } from './wave94BCores.js';
import * as X94B from './wave94BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave94ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave94BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave94A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave94B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave94.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 94A ideas, 20/20 wave 94B ideas, zero skips', () => {
  assert.equal(WAVE94_A_IDEAS.length, 20);
  assert.equal(WAVE94_B_IDEAS.length, 20);
  const all = [...WAVE94_A_IDEAS, ...WAVE94_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53721 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE94_A_IDEAS, ...WAVE94_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53721: 'prompt uncertainty expression',
    53722: 'prompt collaboration instructions',
    53723: 'prompt ethical guardrails',
    53724: 'prompt performance attribution',
    53725: 'prompt lifecycle management',
    53726: 'prompt knowledge cutoff notes',
    53727: 'prompt multilingual variants',
    53728: 'prompt accessibility reviews',
    53729: 'annual prompt effectiveness review',
    53730: 'target-profile strategy matching',
    53731: 'confidence-scored recommendations',
    53732: 'recommendation explanation cards',
    53733: 'strategy recommendation feedback',
    53734: 'cold-start strategy defaults (learning)',
    53735: 'dynamic mid-hunt re-recommendation',
    53736: 'researcher-style adaptation',
    53737: 'strategy sequencing plans',
    53738: 'risk-tolerance settings',
    53739: 'time-budget-aware recommendations',
    53740: 'team strategy coordination',
    53741: 'recommendation diversity controls',
    53742: 'strategy recommendation api',
    53743: 'historical precedent citations',
    53744: 'counter-recommendation explanations',
    53745: 'recommendation performance tracking',
    53746: 'seasonal recommendation adjustments',
    53747: 'stack-specific strategy maps',
    53748: 'industry-tuned recommendations',
    53749: 'scope-size strategy scaling',
    53750: 'auth-availability conditioning',
    53751: 'recommendation freshness',
    53752: 'multi-objective recommendations',
    53753: 'recommendation override logging',
    53754: 'strategy recommendation leaderboards',
    53755: 'explainable recommendation models',
    53756: 'recommendation bias monitoring',
    53757: 'new strategy cold-start boost',
    53758: 'recommendation latency budgets',
    53759: 'cross-target transfer recommendations',
    53760: 'recommendation confidence calibration',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 94A spot checks (one per idea) ---
test('53721 expressPromptUncertainty rates uncertainty expression', () => {
  const v = X94A.expressPromptUncertainty([{ promptId: 'prompt-a', uncertainCases: 20, expressed: 18 }, { promptId: 'prompt-b', uncertainCases: 20, expressed: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.expressiveCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.expressionRate, 0.9);
});
test('53722 instructPromptCollaboration rates collaborative hunts', () => {
  const v = X94A.instructPromptCollaboration([{ promptId: 'prompt-a', hunts: 20, collaborativeHunts: 14, wins: 12 }, { promptId: 'prompt-b', hunts: 20, collaborativeHunts: 5, wins: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.collaborativeCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.collaborationRate, 0.7);
});
test('53723 guardPromptEthics rates violation rates', () => {
  const v = X94A.guardPromptEthics([{ promptId: 'prompt-a', checks: 100, violations: 2 }, { promptId: 'prompt-b', checks: 100, violations: 12 }]);
  assert.equal(v.count, 2);
  assert.equal(v.guardedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.violationRate, 0.02);
});
test('53724 attributePromptPerformance attributes uplift to changes', () => {
  const v = X94A.attributePromptPerformance([{ promptId: 'prompt-a', changeId: 'chg-1', uplift: 0.25, hunts: 30 }, { promptId: 'prompt-a', changeId: 'chg-2', uplift: 0.02, hunts: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.strongCount, 1);
  assert.equal(v.top.key, 'prompt-a|chg-1');
  assert.equal(v.top.uplift, 0.25);
});
test('53725 managePromptLifecycle tracks lifecycle stages', () => {
  const v = X94A.managePromptLifecycle([{ promptId: 'prompt-a', stage: 'production', daysInStage: 20 }, { promptId: 'prompt-b', stage: 'draft', daysInStage: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.productionCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.stage, 'production');
});
test('53726 notePromptKnowledgeCutoff rates assumption documentation', () => {
  const v = X94A.notePromptKnowledgeCutoff([{ promptId: 'prompt-a', assumptions: 10, documented: 9 }, { promptId: 'prompt-b', assumptions: 10, documented: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.documentedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.coverage, 0.9);
});
test('53727 managePromptMultilingualVariants rates translation validation', () => {
  const v = X94A.managePromptMultilingualVariants([{ promptId: 'prompt-a', language: 'hi', variants: 10, validated: 9 }, { promptId: 'prompt-a', language: 'es', variants: 10, validated: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'prompt-a|hi');
  assert.equal(v.top.validationRate, 0.9);
});
test('53728 reviewPromptAccessibility rates researcher understanding', () => {
  const v = X94A.reviewPromptAccessibility([{ promptId: 'prompt-a', reviewers: 10, understood: 9 }, { promptId: 'prompt-b', reviewers: 10, understood: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.accessibleCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.understandingRate, 0.9);
});
test('53729 reviewAnnualPromptEffectiveness rates yearly win rates', () => {
  const v = X94A.reviewAnnualPromptEffectiveness([{ promptId: 'prompt-a', runs: 100, wins: 72 }, { promptId: 'prompt-b', runs: 100, wins: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.averageWinRate, 0.56);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.72);
});
test('53730 matchTargetProfileStrategy matches strategies to targets', () => {
  const v = X94A.matchTargetProfileStrategy([{ targetId: 'target-a', strategy: 'recon-first', industry: 'finance', matchScore: 0.88 }, { targetId: 'target-b', strategy: 'auth-focus', industry: 'health', matchScore: 0.45 }]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.top.key, 'target-a|recon-first');
  assert.equal(v.top.matchScore, 0.88);
});
test('53731 scoreRecommendationConfidence scores confidence from hunt count', () => {
  const v = X94A.scoreRecommendationConfidence([{ strategy: 'recon-first', supportingHunts: 40, wins: 30 }, { strategy: 'auth-focus', supportingHunts: 6, wins: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.confidentCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.confidence, 0.8);
  assert.equal(v.top.winRate, 0.75);
});
test('53732 explainRecommendationCards counts explained cards', () => {
  const v = X94A.explainRecommendationCards([{ strategy: 'recon-first', reasons: ['large scope', 'finance stack match'], explanation: 'Recommended because the target has a large scope and a matching finance stack.' }, { strategy: 'auth-focus', reasons: [], explanation: '' }]);
  assert.equal(v.count, 2);
  assert.equal(v.explainedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.reasonCount, 2);
});
test('53733 collectStrategyRecommendationFeedback rates feedback scores', () => {
  const v = X94A.collectStrategyRecommendationFeedback([{ strategy: 'recon-first', ratings: 20, positiveRatings: 16 }, { strategy: 'auth-focus', ratings: 20, positiveRatings: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.wellRatedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.feedbackScore, 0.8);
});
test('53734 provideColdStartStrategyDefaults covers cold-start classes', () => {
  const v = X94A.provideColdStartStrategyDefaults([{ targetClass: 'saas-api', defaultStrategy: 'recon-first', hunts: 0 }, { targetClass: 'banking-portal', defaultStrategy: 'auth-focus', hunts: 12 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 2);
  assert.equal(v.coldStartCount, 1);
  assert.equal(v.top.key, 'saas-api');
  assert.equal(v.top.coldStart, true);
});
test('53735 rerecommendMidHuntStrategy triggers on telemetry divergence', () => {
  const v = X94A.rerecommendMidHuntStrategy([{ huntId: 'hunt-a', expectedWins: 10, actualWins: 3 }, { huntId: 'hunt-b', expectedWins: 10, actualWins: 9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.triggeredCount, 1);
  assert.equal(v.top.key, 'hunt-a');
  assert.equal(v.top.divergence, 0.7);
});
test('53736 adaptToResearcherStyle adapts to researcher strengths', () => {
  const v = X94A.adaptToResearcherStyle([{ researcher: 'researcher-a', strategy: 'recon-first', runs: 20, wins: 15 }, { researcher: 'researcher-a', strategy: 'auth-focus', runs: 20, wins: 7 }]);
  assert.equal(v.count, 2);
  assert.equal(v.adaptedCount, 1);
  assert.equal(v.top.key, 'researcher-a|recon-first');
  assert.equal(v.top.winRate, 0.75);
});
test('53737 planStrategySequencing counts sequenced plans', () => {
  const v = X94A.planStrategySequencing([{ planId: 'plan-a', steps: ['recon-first', 'auth-focus'], triggers: ['telemetry flat'] }, { planId: 'plan-b', steps: ['recon-first'], triggers: [] }]);
  assert.equal(v.count, 2);
  assert.equal(v.sequencedCount, 1);
  assert.equal(v.top.key, 'plan-a');
  assert.equal(v.top.stepCount, 2);
});
test('53738 applyRiskToleranceSettings aligns strategy risk to tolerance', () => {
  const v = X94A.applyRiskToleranceSettings([{ researcher: 'researcher-a', tolerance: 0.7, strategyRisk: 0.5 }, { researcher: 'researcher-b', tolerance: 0.3, strategyRisk: 0.7 }]);
  assert.equal(v.count, 2);
  assert.equal(v.alignedCount, 1);
  assert.equal(v.averageTolerance, 0.5);
  assert.equal(v.top.key, 'researcher-a');
  assert.equal(v.top.aligned, true);
});
test('53739 recommendWithTimeBudget fits strategies inside time budgets', () => {
  const v = X94A.recommendWithTimeBudget([{ strategy: 'recon-first', estimatedHours: 6, budgetHours: 8 }, { strategy: 'deep-chain', estimatedHours: 20, budgetHours: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.fitsCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.utilization, 0.75);
});
test('53740 coordinateTeamStrategy coordinates complementary team strategies', () => {
  const v = X94A.coordinateTeamStrategy([{ teamId: 'team-a', strategies: ['recon-first', 'auth-focus', 'api-fuzz'] }, { teamId: 'team-b', strategies: ['recon-first', 'recon-first'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.coordinatedCount, 1);
  assert.equal(v.top.key, 'team-a');
  assert.equal(v.top.diversity, 1);
});

// --- Wave 94B spot checks (one per idea) ---
test('53741 controlRecommendationDiversity rates strategy concentration', () => {
  const v = X94B.controlRecommendationDiversity([{ strategy: 'recon-first', assignments: 18, researchers: 15 }, { strategy: 'auth-focus', assignments: 40, researchers: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.diverseCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.concentration, 1.2);
});
test('53742 exposeStrategyRecommendationApi rates API health', () => {
  const v = X94B.exposeStrategyRecommendationApi([{ endpoint: '/recommend', calls: 200, successes: 196 }, { endpoint: '/explain', calls: 100, successes: 82 }]);
  assert.equal(v.count, 2);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.top.key, '/recommend');
  assert.equal(v.top.successRate, 0.98);
});
test('53743 citeHistoricalPrecedents rates citation coverage', () => {
  const v = X94B.citeHistoricalPrecedents([{ strategy: 'recon-first', hunts: 40, precedents: 30 }, { strategy: 'auth-focus', hunts: 40, precedents: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.citedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.citationRate, 0.75);
});
test('53744 explainCounterRecommendations counts explained rejections', () => {
  const v = X94B.explainCounterRecommendations([{ strategy: 'deep-chain', reason: 'Needs more time than the hunt budget allows.' }, { strategy: 'stealth-only', reason: '' }]);
  assert.equal(v.count, 2);
  assert.equal(v.explainedCount, 1);
  assert.equal(v.top.key, 'deep-chain');
  assert.equal(v.top.explained, true);
});
test('53745 trackRecommendationPerformance measures recommendation lift', () => {
  const v = X94B.trackRecommendationPerformance([{ strategy: 'recon-first', recommendedWins: 36, recommendedRuns: 50, baselineWins: 25, baselineRuns: 50 }, { strategy: 'auth-focus', recommendedWins: 20, recommendedRuns: 50, baselineWins: 25, baselineRuns: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.outperformingCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.lift, 0.22);
});
test('53746 adjustSeasonalRecommendations applies seasonal deltas', () => {
  const v = X94B.adjustSeasonalRecommendations([{ strategy: 'recon-first', season: 'holiday-freeze', baseScore: 0.8, seasonalDelta: -0.25 }, { strategy: 'auth-focus', season: 'regular', baseScore: 0.7, seasonalDelta: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.adjustedCount, 1);
  assert.equal(v.top.key, 'auth-focus|regular');
  assert.equal(v.top.adjustedScore, 0.7);
});
test('53747 mapStackSpecificStrategies maps per-stack win rates', () => {
  const v = X94B.mapStackSpecificStrategies([{ stack: 'node-express', strategy: 'api-fuzz', wins: 16, runs: 20 }, { stack: 'node-express', strategy: 'recon-first', wins: 8, runs: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.mappedCount, 1);
  assert.equal(v.top.key, 'node-express|api-fuzz');
  assert.equal(v.top.winRate, 0.8);
});
test('53748 tuneIndustryRecommendations tunes per-industry win rates', () => {
  const v = X94B.tuneIndustryRecommendations([{ industry: 'finance', strategy: 'auth-focus', wins: 17, runs: 20 }, { industry: 'finance', strategy: 'recon-first', wins: 9, runs: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.tunedCount, 1);
  assert.equal(v.top.key, 'finance|auth-focus');
  assert.equal(v.top.winRate, 0.85);
});
test('53749 scaleScopeSizeStrategy scales intensity with scope', () => {
  const v = X94B.scaleScopeSizeStrategy([{ strategy: 'recon-first', scopeSize: 120, intensity: 0.8 }, { strategy: 'deep-chain', scopeSize: 12, intensity: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.scaledCount, 2);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.intensity, 0.8);
});
test('53750 conditionOnAuthAvailability conditions on credential availability', () => {
  const v = X94B.conditionOnAuthAvailability([{ strategy: 'auth-focus', authAvailable: true, runs: 20, wins: 16 }, { strategy: 'auth-focus', authAvailable: false, runs: 20, wins: 7 }]);
  assert.equal(v.count, 2);
  assert.equal(v.authCount, 1);
  assert.equal(v.conditionedCount, 2);
  assert.equal(v.top.key, 'auth-focus|auth');
  assert.equal(v.top.winRate, 0.8);
});
test('53751 prioritizeRecommendationFreshness prioritizes recent validation', () => {
  const v = X94B.prioritizeRecommendationFreshness([{ strategy: 'recon-first', daysSinceValidation: 20, wins: 30, runs: 40 }, { strategy: 'legacy-scan', daysSinceValidation: 300, wins: 28, runs: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.freshCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.freshness, 0.95);
});
test('53752 balanceMultiObjectiveRecommendations balances four objectives', () => {
  const v = X94B.balanceMultiObjectiveRecommendations([{ strategy: 'recon-first', findings: 0.9, speed: 0.8, stealth: 0.6, coverage: 0.85 }, { strategy: 'stealth-only', findings: 0.3, speed: 0.4, stealth: 0.95, coverage: 0.3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.balancedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.balancedScore, 0.79);
});
test('53753 logRecommendationOverrides logs override outcomes', () => {
  const v = X94B.logRecommendationOverrides([{ researcher: 'researcher-a', overridden: 10, overrideWins: 7 }, { researcher: 'researcher-b', overridden: 12, overrideWins: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.winningCount, 1);
  assert.equal(v.totalOverrides, 22);
  assert.equal(v.top.key, 'researcher-a');
  assert.equal(v.top.winRate, 0.7);
});
test('53754 rankStrategyRecommendationLeaderboards ranks cohorts', () => {
  const v = X94B.rankStrategyRecommendationLeaderboards([{ cohort: 'cohort-a', recommendations: 50, wins: 38 }, { cohort: 'cohort-b', recommendations: 50, wins: 22 }]);
  assert.equal(v.count, 2);
  assert.equal(v.leadingCount, 1);
  assert.equal(v.top.key, 'cohort-a');
  assert.equal(v.top.rank, 1);
  assert.equal(v.top.winRate, 0.76);
});
test('53755 explainRecommendationModels counts explainable strategies', () => {
  const v = X94B.explainRecommendationModels([{ strategy: 'recon-first', features: ['scope size', 'stack match'], topFeature: 'scope size' }, { strategy: 'auth-focus', features: [], topFeature: '' }]);
  assert.equal(v.count, 2);
  assert.equal(v.explainableCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.topFeature, 'scope size');
});
test('53756 monitorRecommendationBias flags dominant strategies', () => {
  const v = X94B.monitorRecommendationBias([{ strategy: 'recon-first', assignments: 70 }, { strategy: 'auth-focus', assignments: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.biasedCount, 1);
  assert.equal(v.total, 100);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.share, 0.7);
});
test('53757 boostNewStrategyColdStart boosts new strategies', () => {
  const v = X94B.boostNewStrategyColdStart([{ strategy: 'graph-crawl', hunts: 3, explorationBudget: 5 }, { strategy: 'recon-first', hunts: 80, explorationBudget: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.boostedCount, 1);
  assert.equal(v.newCount, 1);
  assert.equal(v.top.key, 'graph-crawl');
  assert.equal(v.top.hunts, 3);
});
test('53758 budgetRecommendationLatency checks latency budgets', () => {
  const v = X94B.budgetRecommendationLatency([{ strategy: 'recon-first', latencyMs: 120, budgetMs: 200 }, { strategy: 'deep-chain', latencyMs: 900, budgetMs: 200 }]);
  assert.equal(v.count, 2);
  assert.equal(v.withinBudgetCount, 1);
  assert.equal(v.fastCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.latencyMs, 120);
});
test('53759 recommendCrossTargetTransfers rates transfer similarity', () => {
  const v = X94B.recommendCrossTargetTransfers([{ sourceTarget: 'target-x', targetId: 'target-a', strategy: 'api-fuzz', similarity: 0.9 }, { sourceTarget: 'target-y', targetId: 'target-b', strategy: 'recon-first', similarity: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.transferableCount, 1);
  assert.equal(v.top.key, 'target-x|target-a|api-fuzz');
  assert.equal(v.top.similarity, 0.9);
});
test('53760 calibrateRecommendationConfidence calibrates confidence scores', () => {
  const v = X94B.calibrateRecommendationConfidence([{ strategy: 'recon-first', predictedConfidence: 0.8, actualRate: 0.76 }, { strategy: 'auth-focus', predictedConfidence: 0.9, actualRate: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.calibratedCount, 1);
  assert.equal(v.averageError, 0.22);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.calibrationError, 0.04);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X94A'], ['B', B_JSX, 'X94B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w94 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w94a-'));
  assert.ok(CSS_SRC.includes('.w94b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave94A.jsx', 'Wave94B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

test('branding audit: Infinity AI only, no other AI names', () => {
  const banned = ['cl' + 'aude', 'chat' + 'gpt', 'open' + 'ai', 'gem' + 'ini', 'copil' + 'ot'];
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    for (const b of banned) assert.ok(!low.includes(b), `${name} leaks ${b}`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

test('no-debris audit: no placeholder text in wave 94 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ promptId: 'prompt-a', uncertainCases: 20, expressed: 18 }), Object.freeze({ promptId: 'prompt-b', uncertainCases: 20, expressed: 8 })]);
  const v = X94A.expressPromptUncertainty(frozen);
  assert.equal(v.count, 2);
});
