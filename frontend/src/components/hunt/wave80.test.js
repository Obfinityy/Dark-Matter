/**
 * wave80.test.js — Infinity AI · Dark-Matter · Wave 80
 * node:test + node:assert/strict. Registry coverage (20/20 for 53161–53180,
 * 20/20 for 53181–53200, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave80.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE80_A_IDEAS } from './wave80ACore.js';
import * as XA from './wave80ACore.js';
import { WAVE80_B_IDEAS } from './wave80BCores.js';
import * as XB from './wave80BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave80ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave80BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave80A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave80B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave80.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 80A ideas, 20/20 wave 80B ideas, zero skips', () => {
  assert.equal(WAVE80_A_IDEAS.length, 20);
  assert.equal(WAVE80_B_IDEAS.length, 20);
  const all = [...WAVE80_A_IDEAS, ...WAVE80_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53161 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE80_A_IDEAS, ...WAVE80_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53161: 'strategy remix suggestions', 53162: 'strategy briefing cards', 53163: 'strategy a/b significance dashboard', 53164: 'strategy win attribution notes', 53165: 'strategy risk-adjusted rankings', 53166: 'strategy cold-start guide', 53167: 'strategy telemetry schema', 53168: 'strategy replay diffs', 53169: 'strategy coaching prompts', 53170: 'strategy hall of fame', 53171: 'strategy sunset retrospectives', 53172: 'strategy win-rate alerts', 53173: 'median time-to-first-finding benchmarks', 53174: 'ttf percentile bands', 53175: 'ttf by authentication state', 53176: 'ttf by finding severity', 53177: 'ttf decomposition', 53178: 'ttf prediction at hunt start', 53179: 'ttf slip alerts', 53180: 'ttf improvement leaderboard',
    53181: 'zero-finding hunt ttf analysis', 53182: 'ttf vs total findings correlation', 53183: 'first-finding type profiles', 53184: 'ttf by time of day', 53185: 'ttf by scope size', 53186: 'ttf by researcher experience', 53187: 'ttf warm-start effect', 53188: 'ttf cold-start penalty', 53189: 'inter-finding time distributions', 53190: 'ttf by payload family', 53191: 'ttf regression detection', 53192: 'ttf budget planner', 53193: 'ttf outlier autopsies', 53194: 'ttf by hunt mode', 53195: 'ttf confidence intervals per strategy', 53196: 'ttf vs false-positive tradeoff', 53197: 'first-finding depth analysis', 53198: 'ttf by industry vertical', 53199: 'ttf seasonality', 53200: 'ttf by target maturity',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave80 A spot checks ---- */
test('53161 suggestStrategyRemixes: best pair ranked first', () => {
  const v = XA.suggestStrategyRemixes([{ strategy: 'a', winRate: 0.8, findingTypes: ['sqli'] }, { strategy: 'b', winRate: 0.6, findingTypes: ['xss'] }, { strategy: 'c', winRate: 0.2, findingTypes: ['idor'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'a+b');
  assert.equal(v.best.winRate, 0.7);
  assert.equal(v.best.diversity, 2);
});
test('53162 buildStrategyBriefingCards: top card ranked', () => {
  const v = XA.buildStrategyBriefingCards([{ strategy: 'a', success: true, findings: 2 }, { strategy: 'a', success: true, findings: 1 }, { strategy: 'b', success: false, findings: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.findingsPerHunt, 1.5);
});
test('53163 evaluateStrategyABSignificance: z-score computed', () => {
  const v = XA.evaluateStrategyABSignificance([{ variant: 'A', trials: 100, wins: 40 }, { variant: 'B', trials: 100, wins: 60 }]);
  assert.equal(v.control.winRate, 0.4);
  assert.equal(v.treatment.winRate, 0.6);
  assert.equal(v.delta, 0.2);
  assert.equal(v.zScore, 2.83);
  assert.equal(v.significant, true);
});
test('53164 writeStrategyWinAttributionNotes: share attributed', () => {
  const v = XA.writeStrategyWinAttributionNotes([{ strategy: 'a', success: true, findings: 1 }, { strategy: 'a', success: true, findings: 1 }, { strategy: 'b', success: true, findings: 1 }, { strategy: 'b', success: false, findings: 0 }]);
  assert.equal(v.totalWins, 3);
  assert.equal(v.topContributor.key, 'a');
  assert.equal(v.topContributor.share, 0.67);
});
test('53165 rankStrategiesRiskAdjusted: stable strategy first', () => {
  const v = XA.rankStrategiesRiskAdjusted([{ strategy: 'stable', success: true }, { strategy: 'stable', success: true }, { strategy: 'wild', success: true }, { strategy: 'wild', success: false }]);
  assert.equal(v.best.key, 'stable');
  assert.equal(v.best.score, 1);
  assert.equal(v.best.riskAdjustedScore, 1);
});
test('53166 buildStrategyColdStartGuide: phases assigned', () => {
  const v = XA.buildStrategyColdStartGuide([{ strategy: 'a', hunts: 2, winRate: 0.5 }, { strategy: 'b', hunts: 20, winRate: 0.6 }, { strategy: 'c', hunts: 8, winRate: 0.4 }]);
  assert.equal(v.coldCount, 1);
  assert.equal(v.warmingCount, 1);
  assert.equal(v.provenCount, 1);
  assert.equal(v.coldest.key, 'a');
  assert.equal(v.coldest.phase, 'cold');
});
test('53167 defineStrategyTelemetrySchema: required fields derived', () => {
  const v = XA.defineStrategyTelemetrySchema([{ strategy: 'a', ttfMinutes: 10, authState: 'authenticated' }, { strategy: 'b', ttfMinutes: 20 }]);
  assert.equal(v.fieldCount, 3);
  assert.ok(v.requiredFields.includes('strategy'));
  assert.ok(v.requiredFields.includes('ttfMinutes'));
});
test('53168 diffStrategyReplays: replay delta computed', () => {
  const v = XA.diffStrategyReplays([{ strategy: 'a', at: '2026-01-01', winRate: 0.4, findings: 1 }, { strategy: 'a', at: '2026-02-01', winRate: 0.7, findings: 3 }, { strategy: 'b', at: '2026-01-01', winRate: 0.5, findings: 1 }]);
  assert.equal(v.count, 1);
  assert.equal(v.largestShift.deltaWinRate, 0.3);
  assert.equal(v.largestShift.deltaFindings, 2);
});
test('53169 generateStrategyCoachingPrompts: weakest first', () => {
  const v = XA.generateStrategyCoachingPrompts([{ strategy: 'weak', success: false }, { strategy: 'weak', success: false }, { strategy: 'strong', success: true }, { strategy: 'strong', success: true }]);
  assert.equal(v.weakest.key, 'weak');
  assert.equal(v.strongest.key, 'strong');
  assert.equal(v.weakest.focus, 'Improve recon coverage');
});
test('53170 buildStrategyHallOfFame: sustained performer inducted', () => {
  const v = XA.buildStrategyHallOfFame([{ strategy: 'elite', hunts: 40, winRate: 0.75 }, { strategy: 'weak', hunts: 25, winRate: 0.1 }, { strategy: 'thin', hunts: 4, winRate: 1 }]);
  assert.equal(v.count, 1);
  assert.equal(v.champion.key, 'elite');
});
test('53171 writeStrategySunsetRetrospectives: weak strategy sunset', () => {
  const v = XA.writeStrategySunsetRetrospectives([{ strategy: 'weak', hunts: 25, winRate: 0.08 }, { strategy: 'strong', hunts: 25, winRate: 0.6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.sunsetCount, 1);
  assert.equal(v.retrospectives[0].key, 'weak');
});
test('53172 detectStrategyWinRateAlerts: drop flagged', () => {
  const v = XA.detectStrategyWinRateAlerts([{ strategy: 'old', at: '2026-01-01', winRate: 0.8 }, { strategy: 'old', at: '2026-10-01', winRate: 0.4 }, { strategy: 'new', at: '2026-01-01', winRate: 0.4 }, { strategy: 'new', at: '2026-10-01', winRate: 0.5 }]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.alerts[0].key, 'old');
  assert.equal(v.alerts[0].delta, -0.4);
});
test('53173 benchmarkMedianTTF: median benchmarked', () => {
  const v = XA.benchmarkMedianTTF([{ strategy: 'a', ttfMinutes: 10 }, { strategy: 'b', ttfMinutes: 20 }, { strategy: 'a', ttfMinutes: 30 }]);
  assert.equal(v.median, 20);
  assert.equal(v.mean, 20);
  assert.equal(v.sampleSize, 3);
});
test('53174 buildTTFPercentileBands: bands computed', () => {
  const v = XA.buildTTFPercentileBands([{ ttfMinutes: 10 }, { ttfMinutes: 20 }, { ttfMinutes: 30 }, { ttfMinutes: 40 }, { ttfMinutes: 50 }]);
  assert.equal(v.median, 30);
  assert.equal(v.p90, 50);
  assert.equal(v.bands.length, 6);
  assert.equal(v.count, 5);
});
test('53175 compareTTFByAuthState: authenticated fastest', () => {
  const v = XA.compareTTFByAuthState([{ authState: 'authenticated', ttfMinutes: 10 }, { authState: 'authenticated', ttfMinutes: 20 }, { authState: 'unauthenticated', ttfMinutes: 40 }]);
  assert.equal(v.fastest.key, 'authenticated');
  assert.equal(v.fastest.medianTTF, 15);
  assert.equal(v.delta, 25);
});
test('53176 compareTTFByFindingSeverity: severity compared', () => {
  const v = XA.compareTTFByFindingSeverity([{ severity: 'critical', ttfMinutes: 10 }, { severity: 'low', ttfMinutes: 50 }]);
  assert.equal(v.fastest.key, 'critical');
  assert.equal(v.delta, 40);
});
test('53177 decomposeTTF: dominant phase found', () => {
  const v = XA.decomposeTTF([{ phaseTimes: { recon: 5, probing: 30, confirmation: 5 } }]);
  assert.equal(v.dominant.phase, 'probing');
  assert.equal(v.dominant.avgMinutes, 30);
  assert.equal(v.dominant.share, 0.75);
});
test('53178 predictTTFAtHuntStart: strategy median predicted', () => {
  const v = XA.predictTTFAtHuntStart({ strategy: 'a' }, [{ strategy: 'a', ttfMinutes: 10 }, { strategy: 'a', ttfMinutes: 20 }, { strategy: 'a', ttfMinutes: 30 }, { strategy: 'b', ttfMinutes: 100 }]);
  assert.equal(v.predictedMinutes, 20);
  assert.equal(v.basis, 'strategy');
  assert.equal(v.sampleSize, 3);
  assert.equal(v.confidence, 'medium');
});
test('53179 detectTTFSlipAlerts: upward slip flagged', () => {
  const v = XA.detectTTFSlipAlerts([{ strategy: 'a', at: '2026-01-01', medianTTF: 20 }, { strategy: 'a', at: '2026-02-01', medianTTF: 50 }, { strategy: 'b', at: '2026-01-01', medianTTF: 30 }, { strategy: 'b', at: '2026-02-01', medianTTF: 32 }]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.alerts[0].slipMinutes, 30);
});
test('53180 buildTTFImprovementLeaderboard: most improved ranked', () => {
  const v = XA.buildTTFImprovementLeaderboard([{ strategy: 'fast', at: '2026-01-01', medianTTF: 60 }, { strategy: 'fast', at: '2026-02-01', medianTTF: 30 }, { strategy: 'slow', at: '2026-01-01', medianTTF: 40 }, { strategy: 'slow', at: '2026-02-01', medianTTF: 35 }]);
  assert.equal(v.mostImproved.key, 'fast');
  assert.equal(v.mostImproved.improvement, 30);
});

/* ---- Wave80 B spot checks ---- */
test('53181 analyzeZeroFindingHuntTTF: wasted time summed', () => {
  const v = XB.analyzeZeroFindingHuntTTF([{ findings: 0, totalMinutes: 60 }, { findings: 0, totalMinutes: 40 }, { findings: 2, validatedFindings: 2, totalMinutes: 50, ttfMinutes: 20 }]);
  assert.equal(v.zeroHunts, 2);
  assert.equal(v.successfulHunts, 1);
  assert.equal(v.zeroRate, 0.67);
  assert.equal(v.avgZeroMinutes, 50);
  assert.equal(v.wastedMinutes, 100);
});
test('53182 correlateTTFWithTotalFindings: perfect correlation', () => {
  const v = XB.correlateTTFWithTotalFindings([{ ttfMinutes: 10, findings: 1 }, { ttfMinutes: 20, findings: 2 }, { ttfMinutes: 30, findings: 3 }]);
  assert.equal(v.correlation, 1);
  assert.equal(v.count, 3);
  assert.equal(v.direction, 'positive');
});
test('53183 profileFirstFindingTypes: dominant type profiled', () => {
  const v = XB.profileFirstFindingTypes([{ firstFindingType: 'sqli', ttfMinutes: 10 }, { firstFindingType: 'sqli', ttfMinutes: 30 }, { firstFindingType: 'xss', ttfMinutes: 20 }]);
  assert.equal(v.dominant.key, 'sqli');
  assert.equal(v.dominant.hunts, 2);
  assert.equal(v.dominant.medianTTF, 20);
  assert.equal(v.dominant.share, 0.67);
});
test('53184 analyzeTTFByTimeOfDay: morning fastest', () => {
  const v = XB.analyzeTTFByTimeOfDay([{ hour: 9, ttfMinutes: 10 }, { hour: 10, ttfMinutes: 20 }, { hour: 2, ttfMinutes: 50 }]);
  assert.equal(v.fastest.key, 'morning');
  assert.equal(v.fastest.medianTTF, 15);
  assert.equal(v.count, 2);
});
test('53185 analyzeTTFByScopeSize: small scope fastest', () => {
  const v = XB.analyzeTTFByScopeSize([{ scopeSize: 5, ttfMinutes: 10 }, { scopeSize: 8, ttfMinutes: 20 }, { scopeSize: 80, ttfMinutes: 80 }]);
  assert.equal(v.fastest.key, 'small');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53186 analyzeTTFByExperience: senior fastest', () => {
  const v = XB.analyzeTTFByExperience([{ researcherExperience: 'senior', ttfMinutes: 10 }, { researcherExperience: 'senior', ttfMinutes: 20 }, { researcherExperience: 'junior', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'senior');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53187 measureTTFWarmStartEffect: benefit measured', () => {
  const v = XB.measureTTFWarmStartEffect([{ warmStart: true, ttfMinutes: 10 }, { warmStart: true, ttfMinutes: 20 }, { warmStart: false, ttfMinutes: 40 }, { warmStart: false, ttfMinutes: 60 }]);
  assert.equal(v.warmMedian, 15);
  assert.equal(v.coldMedian, 50);
  assert.equal(v.benefit, 35);
  assert.equal(v.benefitPct, 0.7);
});
test('53188 measureTTFColdStartPenalty: penalty measured', () => {
  const v = XB.measureTTFColdStartPenalty([{ isFirstHunt: true, ttfMinutes: 50 }, { isFirstHunt: true, ttfMinutes: 70 }, { isFirstHunt: false, ttfMinutes: 20 }, { isFirstHunt: false, ttfMinutes: 30 }]);
  assert.equal(v.firstMedian, 60);
  assert.equal(v.repeatMedian, 25);
  assert.equal(v.penalty, 35);
});
test('53189 analyzeInterFindingTimeDistributions: gaps described', () => {
  const v = XB.analyzeInterFindingTimeDistributions([{ strategy: 'a', interFindingMinutes: [5, 15] }, { strategy: 'a', interFindingMinutes: [10] }]);
  assert.equal(v.gapCount, 3);
  assert.equal(v.median, 10);
  assert.equal(v.mean, 10);
  assert.equal(v.p90, 15);
});
test('53190 analyzeTTFByPayloadFamily: fastest family ranked', () => {
  const v = XB.analyzeTTFByPayloadFamily([{ payloadFamily: 'sqli', ttfMinutes: 10 }, { payloadFamily: 'sqli', ttfMinutes: 20 }, { payloadFamily: 'xss', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'sqli');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53191 detectTTFRegression: regression flagged', () => {
  const v = XB.detectTTFRegression([{ strategy: 'a', at: '2026-01-01', medianTTF: 20 }, { strategy: 'a', at: '2026-02-01', medianTTF: 50 }, { strategy: 'b', at: '2026-01-01', medianTTF: 30 }, { strategy: 'b', at: '2026-02-01', medianTTF: 28 }]);
  assert.equal(v.regressionCount, 1);
  assert.equal(v.regressions[0].key, 'a');
  assert.equal(v.regressions[0].delta, 30);
});
test('53192 planTTFBudget: budget from percentiles', () => {
  const v = XB.planTTFBudget([{ ttfMinutes: 10 }, { ttfMinutes: 20 }, { ttfMinutes: 30 }, { ttfMinutes: 40 }]);
  assert.equal(v.median, 25);
  assert.equal(v.p75, 30);
  assert.equal(v.recommendedMinutes, 30);
});
test('53193 autopsyTTFOutliers: outlier isolated', () => {
  const v = XB.autopsyTTFOutliers([{ ttfMinutes: 10 }, { ttfMinutes: 10 }, { ttfMinutes: 10 }, { ttfMinutes: 10 }, { ttfMinutes: 10 }, { ttfMinutes: 100 }]);
  assert.equal(v.threshold, 10);
  assert.equal(v.outlierCount, 1);
  assert.equal(v.outliers[0].ttfMinutes, 100);
});
test('53194 compareTTFByHuntMode: fastest mode ranked', () => {
  const v = XB.compareTTFByHuntMode([{ huntMode: 'api-first', ttfMinutes: 10 }, { huntMode: 'api-first', ttfMinutes: 20 }, { huntMode: 'ui-first', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'api-first');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53195 buildTTFConfidenceIntervals: tightest interval first', () => {
  const v = XB.buildTTFConfidenceIntervals([{ strategy: 'a', ttfMinutes: 20 }, { strategy: 'a', ttfMinutes: 20 }, { strategy: 'a', ttfMinutes: 20 }, { strategy: 'b', ttfMinutes: 10 }, { strategy: 'b', ttfMinutes: 30 }]);
  assert.equal(v.tightest.key, 'a');
  assert.equal(v.tightest.lower, 20);
  assert.equal(v.tightest.upper, 20);
});
test('53196 analyzeTTFVsFalsePositiveTradeoff: fast hunts cleaner', () => {
  const v = XB.analyzeTTFVsFalsePositiveTradeoff([{ ttfMinutes: 10, falsePositives: 0 }, { ttfMinutes: 20, falsePositives: 0 }, { ttfMinutes: 40, falsePositives: 4 }, { ttfMinutes: 50, falsePositives: 6 }]);
  assert.equal(v.medianTTF, 30);
  assert.equal(v.fastAvgFP, 0);
  assert.equal(v.slowAvgFP, 5);
});
test('53197 analyzeFirstFindingDepth: shallow fastest', () => {
  const v = XB.analyzeFirstFindingDepth([{ depth: 2, ttfMinutes: 10 }, { depth: 10, ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'shallow');
  assert.equal(v.shallow.medianTTF, 10);
  assert.equal(v.deep.medianTTF, 60);
});
test('53198 analyzeTTFByVertical: fastest vertical ranked', () => {
  const v = XB.analyzeTTFByVertical([{ vertical: 'fintech', ttfMinutes: 10 }, { vertical: 'fintech', ttfMinutes: 20 }, { vertical: 'retail', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'fintech');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53199 analyzeTTFSeasonality: fastest season ranked', () => {
  const v = XB.analyzeTTFSeasonality([{ season: 'summer', ttfMinutes: 10 }, { season: 'summer', ttfMinutes: 20 }, { season: 'winter', ttfMinutes: 50 }]);
  assert.equal(v.fastest.key, 'summer');
  assert.equal(v.bestSeason.key, 'summer');
  assert.equal(v.seasonCount, 2);
});
test('53200 analyzeTTFByTargetMaturity: mature fastest', () => {
  const v = XB.analyzeTTFByTargetMaturity([{ maturity: 'mature', ttfMinutes: 10 }, { maturity: 'mature', ttfMinutes: 20 }, { maturity: 'new', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'mature');
  assert.equal(v.fastest.medianTTF, 15);
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
test('css: only .w80a-/.w80b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w80a-') || cls.startsWith('w80b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave80A.jsx', 'Wave80B.jsx']) {
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
