/**
 * wave79.test.js — Infinity AI · Dark-Matter · Wave 79
 * node:test + node:assert/strict. Registry coverage (20/20 for 53121–53140,
 * 20/20 for 53141–53160, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave79.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE79_A_IDEAS } from './wave79ACore.js';
import * as XA from './wave79ACore.js';
import { WAVE79_B_IDEAS } from './wave79BCores.js';
import * as XB from './wave79BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave79ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave79BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave79A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave79B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave79.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 79A ideas, 20/20 wave 79B ideas, zero skips', () => {
  assert.equal(WAVE79_A_IDEAS.length, 20);
  assert.equal(WAVE79_B_IDEAS.length, 20);
  const all = [...WAVE79_A_IDEAS, ...WAVE79_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53121 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE79_A_IDEAS, ...WAVE79_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53121: 'strategy cost curves', 53122: 'hybrid strategy effectiveness', 53123: 'strategy consistency scores', 53124: 'target-class strategy fit', 53125: 'strategy decay over time', 53126: 'underdog strategy spotlights', 53127: 'strategy switching triggers', 53128: 'first-principles vs playbook comparison', 53129: 'aggressive-vs-stealth win rates', 53130: 'authenticated-first win rates', 53131: 'api-first vs ui-first outcomes', 53132: 'recon-heavy vs recon-light', 53133: 'manual-seed strategy boost', 53134: 'time-boxed sprint strategies', 53135: 'depth-first traversal wins', 53136: 'breadth-first traversal wins', 53137: 'chained-finding strategies', 53138: 'regression-hunt strategies', 53139: 'differential testing strategies', 53140: 'crowd-informed strategies',
    53141: 'adversarial mindset prompts', 53142: 'checklist-driven strategies', 53143: 'risk-ranked targeting', 53144: 'session-based strategy rotation', 53145: 'strategy performance by tenure', 53146: 'multi-agent strategy tournaments', 53147: 'strategy explainability scores', 53148: 'fallback strategy effectiveness', 53149: 'strategy learning velocity', 53150: 'context-length strategy effects', 53151: 'tool-orchestration strategies', 53152: 'human-in-the-loop checkpoints (learning)', 53153: 'strategy fatigue detection', 53154: 'seasonal strategy trends', 53155: 'strategy portfolio balancing', 53156: 'win-rate confidence grading', 53157: 'strategy counterfactual simulator', 53158: 'strategy genealogy tracking', 53159: 'strategy adoption curves', 53160: 'strategy kill criteria',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave79 A spot checks ---- */
test('53121 plotStrategyCostCurves: cheapest with findings first', () => {
  const v = XA.plotStrategyCostCurves([{ strategy: 'a', findings: 2, validatedFindings: 2, requests: 100, computeCost: 10, success: true }, { strategy: 'b', findings: 1, validatedFindings: 1, requests: 50, computeCost: 20, success: true }, { strategy: 'barren', findings: 0, requests: 10, computeCost: 5, success: false }]);
  assert.equal(v.cheapest.key, 'a');
  assert.equal(v.cheapest.costPerFinding, 5);
  assert.equal(v.barrenCount, 1);
});
test('53122 measureHybridStrategyEffectiveness: blended delta', () => {
  const v = XA.measureHybridStrategyEffectiveness([{ hybrid: true, success: true }, { hybrid: true, success: false }, { success: true }, { success: false }, { success: false }]);
  assert.equal(v.hybridRate, 0.5);
  assert.equal(v.singleRate, 0.33);
  assert.equal(v.delta, 0.17);
});
test('53123 scoreStrategyConsistency: stable strategy first', () => {
  const v = XA.scoreStrategyConsistency([{ strategy: 'stable', success: true }, { strategy: 'stable', success: true }, { strategy: 'wild', success: true }, { strategy: 'wild', success: false }]);
  assert.equal(v.mostConsistent.key, 'stable');
  assert.equal(v.mostConsistent.consistency, 1);
});
test('53124 mapTargetClassStrategyFit: best per class', () => {
  const v = XA.mapTargetClassStrategyFit([{ strategy: 'a', targetClass: 'saas', success: true }, { strategy: 'b', targetClass: 'saas', success: false }, { strategy: 'a', targetClass: 'fintech', success: false }]);
  assert.equal(v.classCount, 2);
  assert.equal(v.bestByClass.find(c => c.targetClass === 'saas').best.key, 'a @ saas');
});
test('53125 trackStrategyDecayOverTime: declining strategy flagged', () => {
  const v = XA.trackStrategyDecayOverTime([{ strategy: 'old', at: '2026-01-01', winRate: 0.8 }, { strategy: 'old', at: '2026-10-01', winRate: 0.4 }, { strategy: 'new', at: '2026-01-01', winRate: 0.4 }, { strategy: 'new', at: '2026-10-01', winRate: 0.5 }]);
  assert.equal(v.decayingCount, 1);
  assert.equal(v.decaying[0].key, 'old');
  assert.equal(v.decaying[0].delta, -0.4);
});
test('53126 spotlightUnderdogStrategies: low-use high-win surfaced', () => {
  const v = XA.spotlightUnderdogStrategies([{ strategy: 'rare', success: true }, { strategy: 'rare', success: true }, { strategy: 'common', success: true }, { strategy: 'common', success: false }, { strategy: 'common', success: false }, { strategy: 'common', success: false }, { strategy: 'common', success: false }, { strategy: 'common', success: false }]);
  assert.equal(v.underdogCount, 1);
  assert.equal(v.best.key, 'rare');
});
test('53127 learnStrategySwitchingTriggers: trigger ranked', () => {
  const v = XA.learnStrategySwitchingTriggers([{ trigger: 'stall', success: true }, { trigger: 'stall', success: false }, { trigger: 'waf', success: true }]);
  assert.equal(v.best.key, 'waf');
});
test('53128 compareFirstPrinciplesVsPlaybook: delta computed', () => {
  const v = XA.compareFirstPrinciplesVsPlaybook([{ mode: 'first-principles', success: true }, { mode: 'first-principles', success: true }, { mode: 'playbook', success: true }, { mode: 'playbook', success: false }]);
  assert.equal(v.firstPrinciples.winRate, 1);
  assert.equal(v.playbook.winRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53129 compareAggressiveVsStealthWinRates: detection tracked', () => {
  const v = XA.compareAggressiveVsStealthWinRates([{ posture: 'aggressive', success: true, detected: true }, { posture: 'aggressive', success: false, detected: true }, { posture: 'stealth', success: true, detected: false }]);
  assert.equal(v.aggressive.detectionRate, 1);
  assert.equal(v.stealth.winRate, 1);
});
test('53130 measureAuthenticatedFirstWinRates: auth first delta', () => {
  const v = XA.measureAuthenticatedFirstWinRates([{ startMode: 'authenticated', success: true }, { startMode: 'authenticated', success: false }, { startMode: 'unauthenticated', success: false }]);
  assert.equal(v.authenticatedFirst.winRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53131 compareApiFirstVsUiFirstOutcomes: findings delta', () => {
  const v = XA.compareApiFirstVsUiFirstOutcomes([{ prioritySurface: 'api', success: true, findings: 4 }, { prioritySurface: 'ui', success: true, findings: 1 }]);
  assert.equal(v.apiFirst.findingsPerHunt, 4);
  assert.equal(v.delta, 3);
});
test('53132 compareReconHeavyVsReconLight: quality ranked', () => {
  const v = XA.compareReconHeavyVsReconLight([{ reconLevel: 'heavy', success: true, validatedFindings: 3, rawFindings: 4 }, { reconLevel: 'light', success: true, validatedFindings: 1, rawFindings: 4 }]);
  assert.equal(v.heavy.quality, 0.75);
  assert.equal(v.light.quality, 0.25);
});
test('53133 measureManualSeedBoost: lift computed', () => {
  const v = XA.measureManualSeedBoost([{ seeded: true, success: true }, { seeded: true, success: true }, { seeded: false, success: true }, { seeded: false, success: false }]);
  assert.equal(v.seededRate, 1);
  assert.equal(v.lift, 0.5);
});
test('53134 compareTimeBoxedSprintStrategies: sprint delta', () => {
  const v = XA.compareTimeBoxedSprintStrategies([{ flowStyle: 'sprint', success: true }, { flowStyle: 'sprint', success: false }, { flowStyle: 'continuous', success: false }]);
  assert.equal(v.sprint.winRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53135 trackDepthFirstTraversalWins: depth delta', () => {
  const v = XA.trackDepthFirstTraversalWins([{ traversal: 'depth-first', strategy: 'a', success: true }, { traversal: 'depth-first', strategy: 'a', success: false }, { traversal: 'breadth-first', strategy: 'b', success: false }]);
  assert.equal(v.traversalRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53136 trackBreadthFirstTraversalWins: breadth delta', () => {
  const v = XA.trackBreadthFirstTraversalWins([{ traversal: 'breadth-first', strategy: 'b', success: true }, { traversal: 'depth-first', strategy: 'a', success: false }]);
  assert.equal(v.traversalRate, 1);
  assert.equal(v.delta, 1);
});
test('53137 measureChainedFindingStrategies: chain rate', () => {
  const v = XA.measureChainedFindingStrategies([{ strategy: 'chainer', chained: true, chainCount: 2, success: true, findings: 3 }, { strategy: 'plain', chained: false, success: true, findings: 1 }]);
  assert.equal(v.best.key, 'chainer');
  assert.equal(v.best.chainRate, 1);
});
test('53138 evaluateRegressionHuntStrategies: new issue rate', () => {
  const v = XA.evaluateRegressionHuntStrategies([{ huntType: 'regression', strategy: 'a', success: true, findings: 2 }, { huntType: 'regression', strategy: 'a', success: false, findings: 0 }, { huntType: 'standard', strategy: 'b', success: true, findings: 1 }]);
  assert.equal(v.regressionHunts, 2);
  assert.equal(v.newIssueRate, 0.5);
});
test('53139 compareDifferentialTestingStrategies: diff findings', () => {
  const v = XA.compareDifferentialTestingStrategies([{ differential: true, strategy: 'a', success: true, diffFindings: 3 }, { differential: true, strategy: 'b', success: false, diffFindings: 1 }]);
  assert.equal(v.differentialHunts, 2);
  assert.equal(v.diffFindings, 4);
});
test('53140 measureCrowdInformedStrategies: crowd lift', () => {
  const v = XA.measureCrowdInformedStrategies([{ crowdInformed: true, success: true, disclosurePatterns: 3 }, { crowdInformed: true, success: false }, { success: true }, { success: false }, { success: false }]);
  assert.equal(v.informedRate, 0.5);
  assert.equal(v.patterns, 3);
});

/* ---- Wave79 B spot checks ---- */
test('53141 testAdversarialMindsetPrompts: adversarial delta', () => {
  const v = XB.testAdversarialMindsetPrompts([{ promptFraming: 'adversarial', success: true }, { promptFraming: 'adversarial', success: false }, { promptFraming: 'neutral', success: false }]);
  assert.equal(v.adversarial.winRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53142 evaluateChecklistDrivenStrategies: coverage averaged', () => {
  const v = XB.evaluateChecklistDrivenStrategies([{ executionStyle: 'checklist', success: true, coverage: 0.9 }, { executionStyle: 'adaptive', success: false, coverage: 0.5 }]);
  assert.equal(v.checklist.avgCoverage, 0.9);
  assert.equal(v.adaptive.avgCoverage, 0.5);
});
test('53143 measureRiskRankedTargeting: business first delta', () => {
  const v = XB.measureRiskRankedTargeting([{ targeting: 'business-critical', success: true }, { targeting: 'attack-surface', success: false }]);
  assert.equal(v.businessFirst.winRate, 1);
  assert.equal(v.delta, 1);
});
test('53144 trackSessionBasedStrategyRotation: rotation delta', () => {
  const v = XB.trackSessionBasedStrategyRotation([{ rotation: 'session', success: true }, { rotation: 'session', success: false }, { rotation: 'committed', success: false }]);
  assert.equal(v.rotationRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53145 compareStrategyPerformanceByTenure: best tenure', () => {
  const v = XB.compareStrategyPerformanceByTenure([{ modelVersion: 'current', success: true }, { modelVersion: 'older', success: false }]);
  assert.equal(v.best.key, 'current');
});
test('53146 runMultiAgentStrategyTournaments: champion crowned', () => {
  const v = XB.runMultiAgentStrategyTournaments([{ strategyA: 'a', strategyB: 'b', winner: 'a', aFindings: 3, bFindings: 1 }, { strategyA: 'a', strategyB: 'c', winner: 'a', aFindings: 2, bFindings: 0 }]);
  assert.equal(v.champion.key, 'a');
  assert.equal(v.champion.wins, 2);
});
test('53147 scoreStrategyExplainability: average score', () => {
  const v = XB.scoreStrategyExplainability([{ strategy: 'a', explainabilityScore: 0.8, success: true }, { strategy: 'a', explainabilityScore: 1, success: true }, { strategy: 'b', explainabilityScore: 0.4, success: false }]);
  assert.equal(v.best.key, 'a');
  assert.equal(v.best.avgScore, 0.9);
});
test('53148 measureFallbackStrategyEffectiveness: recovery rate', () => {
  const v = XB.measureFallbackStrategyEffectiveness([{ isFallback: true, strategy: 'backup', success: true }, { isFallback: true, strategy: 'backup', success: false }, { strategy: 'primary', success: true }]);
  assert.equal(v.fallbackHunts, 2);
  assert.equal(v.recoveryRate, 0.5);
});
test('53149 trackStrategyLearningVelocity: velocity sorted', () => {
  const v = XB.trackStrategyLearningVelocity([{ strategy: 'fast', trial: 1, winRate: 0.2 }, { strategy: 'fast', trial: 5, winRate: 0.6 }, { strategy: 'fast', trial: 10, winRate: 0.7 }, { strategy: 'slow', trial: 1, winRate: 0.5 }, { strategy: 'slow', trial: 10, winRate: 0.5 }]);
  assert.equal(v.fastest.key, 'fast');
  assert.equal(v.fastest.velocity, 0.5);
});
test('53150 evaluateContextLengthStrategyEffects: summarized delta', () => {
  const v = XB.evaluateContextLengthStrategyEffects([{ contextStyle: 'summarized', success: true }, { contextStyle: 'summarized', success: false }, { contextStyle: 'full', success: false }]);
  assert.equal(v.summarized.winRate, 0.5);
  assert.equal(v.delta, 0.5);
});
test('53151 compareToolOrchestrationStrategies: avg tools', () => {
  const v = XB.compareToolOrchestrationStrategies([{ toolStyle: 'many-tools', success: true, toolCount: 8 }, { toolStyle: 'few-deep', success: false, toolCount: 3 }]);
  assert.equal(v.best.key, 'many-tools');
  assert.equal(v.best.avgTools, 8);
});
test('53152 measureHumanInLoopCheckpoints: checkpoint lift', () => {
  const v = XB.measureHumanInLoopCheckpoints([{ humanCheckpoints: true, checkpoints: 2, success: true }, { humanCheckpoints: true, success: true }, { success: false }, { success: false }]);
  assert.equal(v.withRate, 1);
  assert.equal(v.lift, 1);
});
test('53153 detectStrategyFatigue: dominant strategy flagged', () => {
  const hunts = [...Array(7)].map(() => ({ strategy: 'same', success: true })).concat([...Array(3)].map(() => ({ strategy: 'other', success: false })));
  const v = XB.detectStrategyFatigue(hunts);
  assert.equal(v.fatiguedCount, 1);
  assert.equal(v.fatigued[0].key, 'same');
  assert.equal(v.fatigued[0].share, 0.7);
});
test('53154 analyzeSeasonalStrategyTrends: seasons listed', () => {
  const v = XB.analyzeSeasonalStrategyTrends([{ strategy: 'a', season: 'holiday-freeze', success: true }, { strategy: 'a', season: 'active-dev', success: false }]);
  assert.equal(v.seasonCount, 2);
  assert.equal(v.best.key, 'a @ holiday-freeze');
});
test('53155 recommendStrategyPortfolioBalancing: allocations sum near one', () => {
  const v = XB.recommendStrategyPortfolioBalancing([{ strategy: 'a', winRate: 0.6, findingTypes: ['sqli'] }, { strategy: 'b', winRate: 0.4, findingTypes: ['xss'] }]);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.allocation, 0.6);
  assert.equal(v.diversityCount, 2);
});
test('53156 gradeWinRateConfidence: grades by volume', () => {
  const v = XB.gradeWinRateConfidence([{ strategy: 'robust', hunts: 40, wins: 20 }, { strategy: 'solid', hunts: 12, wins: 6 }, { strategy: 'thin', hunts: 4, wins: 1 }]);
  assert.equal(v.robustCount, 1);
  assert.equal(v.solidCount, 1);
  assert.equal(v.thinCount, 1);
});
test('53157 estimateStrategyCounterfactual: best alternative estimated', () => {
  const v = XB.estimateStrategyCounterfactual({ findings: 2, validatedFindings: 2, hours: 2 }, [{ strategy: 'alt', findingsPerHour: 2 }, { strategy: 'weak', findingsPerHour: 0.5 }]);
  assert.equal(v.actualFindings, 2);
  assert.equal(v.bestAlternative.strategy, 'alt');
  assert.equal(v.bestAlternative.expectedFindings, 4);
});
test('53158 trackStrategyGenealogy: lineage wins', () => {
  const v = XB.trackStrategyGenealogy([{ lineage: 'auth-branch', success: true, mutations: 2 }, { lineage: 'auth-branch', success: false, mutations: 1 }, { lineage: 'xss-branch', success: true }]);
  assert.equal(v.mutations, 3);
  assert.equal(v.count, 2);
});
test('53159 trackStrategyAdoptionCurves: lag cost summed', () => {
  const v = XB.trackStrategyAdoptionCurves([{ strategy: 'a', at: '2026-09-01', adoptionShare: 0.2, missedFindings: 3 }, { strategy: 'a', at: '2026-10-01', adoptionShare: 0.6, missedFindings: 1 }]);
  assert.equal(v.latest.adoptionShare, 0.6);
  assert.equal(v.lagCost, 4);
});
test('53160 defineStrategyKillCriteria: weak strategy retired', () => {
  const v = XB.defineStrategyKillCriteria([{ strategy: 'weak', hunts: 25, wins: 2 }, { strategy: 'strong', hunts: 25, wins: 15 }, { strategy: 'new', hunts: 5, wins: 0 }]);
  assert.equal(v.retireCount, 1);
  assert.equal(v.retire[0].key, 'weak');
});

/* ---- JSX↔core call-shape audit ---- */
function componentNames(jsxSrc) {
  return [...jsxSrc.matchAll(/export function (\w+)/g)].map(m => m[1]).filter(n => !/Gallery$/.test(n));
}
function componentBody(jsxSrc, name) {
  const idx = jsxSrc.indexOf(`export function ${name}`);
  const next = jsxSrc.indexOf('export function', idx + 1);
  return jsxSrc.slice(idx, next === -1 ? undefined : next);
}

test('jsx: 20 components per file, each calls ≥1 core function', () => {
  for (const [label, src, core] of [['A', A_JSX, XA], ['B', B_JSX, XB]]) {
    const names = componentNames(src);
    assert.equal(names.length, 20, `${label}: expected 20 components, got ${names.length}`);
    const fns = Object.keys(core).filter(k => !k.endsWith('_IDEAS'));
    assert.equal(fns.length, 20, `${label}: expected 20 core functions, got ${fns.length}`);
    for (const name of names) {
      const body = componentBody(src, name);
      const called = fns.filter(fn => new RegExp(`\\b${fn}\\b`).test(body));
      assert.ok(called.length >= 1, `${label} component ${name} calls no core function`);
    }
    for (const fn of fns) {
      assert.ok(new RegExp(`\\b${fn}\\b`).test(src), `${label} core function ${fn} never referenced in JSX`);
    }
  }
});

/* ---- CSS scope + zero-animation audits ---- */
test('css: only .w79a-/.w79b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w79a-') || cls.startsWith('w79b-'), `unscoped selector: .${cls}`);
  }
  assert.ok(!/(^|\n)\s*(body|html|\*|:root)\s*\{/.test(noComments), 'global rule found');
});

test('css: zero keyframes, zero animation properties', () => {
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'found @keyframes');
  assert.ok(!/keyframes/i.test(CSS_SRC), 'found keyframes word');
  assert.ok(!/(^|[;{\s])animation(-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?\s*:/i.test(CSS_SRC), 'found animation property');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'found transition property');
});

/* ---- esbuild real JSX parse audit ---- */
test('esbuild: both JSX files parse/transform cleanly', () => {
  for (const f of ['Wave79A.jsx', 'Wave79B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no forbidden brand anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `forbidden brand leaked in ${name}`);
    assert.ok(!src.includes('Dark' + 'Matter'), `forbidden brand leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no TODO/FIXME placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `placeholder mention in ${name}`);
    assert.ok(!/\bsimulate\b/i.test(src), `placeholder mention in ${name}`);
  }
});
