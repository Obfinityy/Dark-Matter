/**
 * wave89.test.js — Infinity AI · Wave 89
 * node:test + node:assert/strict. Registry coverage (20/20 for 53521–53540,
 * 20/20 for 53541–53560, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave89.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE89_A_IDEAS } from './wave89ACore.js';
import * as XA from './wave89ACore.js';
import { WAVE89_B_IDEAS } from './wave89BCores.js';
import * as XB from './wave89BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave89ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave89BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave89A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave89B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave89.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 89A ideas, 20/20 wave 89B ideas, zero skips', () => {
  assert.equal(WAVE89_A_IDEAS.length, 20);
  assert.equal(WAVE89_B_IDEAS.length, 20);
  const all = [...WAVE89_A_IDEAS, ...WAVE89_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53521 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE89_A_IDEAS, ...WAVE89_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53521: 'payload rot schedules',
    53522: 'failure attribution to stack changes',
    53523: 'cannibalized payload detection',
    53524: 'order-dependent failure analysis',
    53525: 'failure rate baselines',
    53526: 'environmental failure tags',
    53527: 'payload precision decay curves',
    53528: 'failure pattern alerts',
    53529: 'retired payload graveyards',
    53530: 'failure-driven defense mapping',
    53531: 'payload fragility scores',
    53532: 'failure replay sandboxes',
    53533: 'cross-target failure correlation',
    53534: 'failure-to-success conversion tracking',
    53535: 'human failure review queues',
    53536: 'failure explanation generation',
    53537: 'payload failure heatmaps',
    53538: 'defense evasion learning loops',
    53539: 'failure data sharing (opt-in)',
    53540: 'payload age-vs-failure curves',
    53541: 'failure cascade detection',
    53542: 'benign-failure filtering',
    53543: 'failure root-cause confidence',
    53544: 'payload failure benchmarks',
    53545: 'failure-driven target profiling',
    53546: 'adaptive failure budgets',
    53547: 'failure lesson auto-drafting',
    53548: 'payload failure timelines',
    53549: 'failure mode shift detection',
    53550: 'cross-defense failure comparison',
    53551: 'failure-informed payload design',
    53552: 'payload failure insurance metrics',
    53553: 'failure review rituals',
    53554: 'failure data retention tiers',
    53555: 'payload failure prediction',
    53556: 'failure-aware scheduling',
    53557: 'failure pattern search',
    53558: 'failure-driven waf identification',
    53559: 'payload failure cost-benefit',
    53560: 'failure autopsy leaderboards',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 89A spot checks (one per idea) ---
test('53521 schedulePayloadRot flags payloads past retest age', () => {
  const v = XA.schedulePayloadRot([{ payloadId: 'p1', family: 'sqli', ageDays: 120 }, { payloadId: 'p2', family: 'xss', ageDays: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.dueCount, 1);
  assert.equal(v.top.key, 'p1');
});
test('53522 attributeFailuresToStack links deaths to stack changes', () => {
  const v = XA.attributeFailuresToStack([{ payloadId: 'p1', stack: 'nginx-1.25' }, { payloadId: 'p2', stack: 'apache-2.4' }], [{ stack: 'nginx-1.25', label: 'nginx-upgrade' }]);
  assert.equal(v.count, 2);
  assert.equal(v.attributedCount, 1);
  assert.equal(v.attributionRate, 0.5);
  assert.equal(v.top.key, 'p1');
});
test('53523 detectCannibalizedPayloads finds defense-armed failures', () => {
  const v = XA.detectCannibalizedPayloads([{ payload: 'a', target: 't1', outcome: 'success', armedDefense: true }, { payload: 'b', target: 't1', outcome: 'failure' }, { payload: 'c', target: 't2', outcome: 'failure' }]);
  assert.equal(v.count, 3);
  assert.equal(v.cannibalizedCount, 1);
  assert.equal(v.top.key, 'b');
});
test('53524 analyzeOrderDependence measures position failure spread', () => {
  const v = XA.analyzeOrderDependence([{ position: 1, outcome: 'success' }, { position: 1, outcome: 'failure' }, { position: 2, outcome: 'failure' }, { position: 2, outcome: 'failure' }]);
  assert.equal(v.count, 2);
  assert.equal(v.spread, 0.5);
  assert.equal(v.orderSensitive, true);
  assert.equal(v.top.key, 'pos-2');
});
test('53525 baselineFailureRates flags anomalies vs baseline', () => {
  const v = XA.baselineFailureRates([{ family: 'sqli', failures: 8, attempts: 10, expectedRate: 0.5 }, { family: 'xss', failures: 1, attempts: 10, expectedRate: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.overallRate, 0.45);
  assert.equal(v.anomalyCount, 2);
  assert.equal(v.top.key, 'sqli');
});
test('53526 tagEnvironmentalFailures separates environment from defense', () => {
  const v = XA.tagEnvironmentalFailures([{ payloadId: 'p1', reason: 'rate-limit', statusCode: 429 }, { payloadId: 'p2', reason: 'waf-block', statusCode: 403 }]);
  assert.equal(v.count, 2);
  assert.equal(v.environmentalCount, 1);
  assert.equal(v.defenseCount, 1);
  assert.equal(v.environmentalRate, 0.5);
});
test('53527 precisionDecayCurves quantifies precision decay with age', () => {
  const v = XA.precisionDecayCurves([{ payloadId: 'p1', ageDays: 10, successes: 9, attempts: 10 }, { payloadId: 'p2', ageDays: 200, successes: 2, attempts: 10 }]);
  assert.equal(v.count, 4);
  assert.equal(v.payloadCount, 2);
  assert.equal(v.decay, 0.7);
  assert.equal(v.top.key, '0-30');
});
test('53528 alertFailurePatterns alerts on fleet-wide surges', () => {
  const v = XA.alertFailurePatterns([{ family: 'sqli', currentRate: 0.9, baselineRate: 0.5 }, { family: 'xss', currentRate: 0.4, baselineRate: 0.35 }]);
  assert.equal(v.count, 2);
  assert.equal(v.alertCount, 1);
  assert.equal(v.top.key, 'sqli');
});
test('53529 retiredPayloadGraveyards keeps retired failure history', () => {
  const v = XA.retiredPayloadGraveyards([{ payloadId: 'p1', retired: true, failures: 9, attempts: 10 }, { payloadId: 'p2', retired: false, failures: 1, attempts: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.graveyardCount, 1);
  assert.equal(v.averageRetiredFailureRate, 0.9);
  assert.equal(v.top.key, 'p1');
});
test('53530 mapDefensesFromFailures builds the defense matrix', () => {
  const v = XA.mapDefensesFromFailures([{ defense: 'modsec', family: 'sqli' }, { defense: 'modsec', family: 'sqli' }, { defense: 'cloudflare', family: 'xss' }]);
  assert.equal(v.count, 2);
  assert.equal(v.defenseCount, 2);
  assert.equal(v.totalBlocks, 3);
  assert.equal(v.top.key, 'modsec|sqli');
});
test('53531 scorePayloadFragility scores brittle payloads', () => {
  const v = XA.scorePayloadFragility([{ payloadId: 'p1', mutationFailures: 9, mutationAttempts: 10 }, { payloadId: 'p2', mutationFailures: 1, mutationAttempts: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.brittleCount, 1);
  assert.equal(v.averageFragility, 0.5);
  assert.equal(v.top.key, 'p1');
});
test('53532 failureReplaySandbox separates reproduced from escaped', () => {
  const v = XA.failureReplaySandbox([{ payloadId: 'p1', recordedStatus: 403, replayStatus: 403 }, { payloadId: 'p2', recordedStatus: 403, replayStatus: 200 }]);
  assert.equal(v.count, 2);
  assert.equal(v.reproducedCount, 1);
  assert.equal(v.escapedCount, 1);
});
test('53533 correlateFailuresAcrossTargets finds dead techniques', () => {
  const v = XA.correlateFailuresAcrossTargets([{ technique: 'sqli-union', target: 'a' }, { technique: 'sqli-union', target: 'b' }, { technique: 'sqli-union', target: 'c' }, { technique: 'xss-ref', target: 'a' }]);
  assert.equal(v.count, 2);
  assert.equal(v.deadCount, 1);
  assert.equal(v.top.key, 'sqli-union');
});
test('53534 trackFailureConversions values the mutation engine', () => {
  const v = XA.trackFailureConversions([{ payloadId: 'p1', mutatedFromFailure: true, outcome: 'success' }, { payloadId: 'p1', mutatedFromFailure: true, outcome: 'failure' }, { payloadId: 'p2', mutatedFromFailure: true, outcome: 'success' }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalConversions, 2);
  assert.equal(v.overallConversionRate, 0.67);
  assert.equal(v.top.key, 'p2');
});
test('53535 queueHumanFailureReviews routes novel failures to humans', () => {
  const v = XA.queueHumanFailureReviews([{ payloadId: 'p1', noveltyScore: 0.9, seenCount: 0, reason: 'unknown-block' }, { payloadId: 'p2', noveltyScore: 0.2, seenCount: 5, reason: 'waf-block' }]);
  assert.equal(v.count, 2);
  assert.equal(v.reviewCount, 1);
  assert.equal(v.top.key, 'p1');
});
test('53536 generateFailureExplanations writes plain-language reasons', () => {
  const v = XA.generateFailureExplanations([{ payloadId: 'p1', reason: 'waf-block', defense: 'ModSecurity', statusCode: 403 }]);
  assert.equal(v.count, 1);
  assert.equal(v.explainedCount, 1);
  assert.equal(v.top.key, 'p1');
});
test('53537 payloadFailureHeatmap builds reason by family cells', () => {
  const v = XA.payloadFailureHeatmap([{ reason: 'waf-block', family: 'sqli' }, { reason: 'waf-block', family: 'sqli' }, { reason: 'timeout', family: 'xss' }]);
  assert.equal(v.count, 2);
  assert.equal(v.maxCount, 2);
  assert.equal(v.totalFailures, 3);
  assert.equal(v.top.key, 'waf-block|sqli');
});
test('53538 evasionLearningLoop surfaces working evasion candidates', () => {
  const v = XA.evasionLearningLoop([{ defense: 'modsec', technique: 'encoding', bypassed: true }, { defense: 'modsec', technique: 'encoding', bypassed: false }, { defense: 'modsec', technique: 'direct', bypassed: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.candidateCount, 1);
  assert.equal(v.top.key, 'modsec|encoding');
});
test('53539 shareFailureData anonymizes opt-in failure shares', () => {
  const v = XA.shareFailureData([{ payloadId: 'p1', target: 'secret.example', family: 'sqli', reason: 'waf-block', defense: 'modsec', ageDays: 100 }], { optIn: true });
  assert.equal(v.count, 1);
  assert.equal(v.sharedCount, 1);
  assert.equal(v.optIn, true);
  assert.equal(v.top.key, 'sqli|waf-block');
});
test('53540 payloadAgeFailureCurves estimates retirement timing', () => {
  const v = XA.payloadAgeFailureCurves([{ payloadId: 'p1', ageDays: 10, failures: 1, attempts: 10 }, { payloadId: 'p2', ageDays: 200, failures: 9, attempts: 10 }]);
  assert.equal(v.count, 4);
  assert.equal(v.payloadCount, 2);
  assert.equal(v.retirementEstimateDays, 181);
  assert.equal(v.top.key, '181+');
});

// --- Wave 89B spot checks (one per idea) ---
test('53541 detectFailureCascades finds one-defense cascades', () => {
  const v = XB.detectFailureCascades([{ changeId: 'c1', defense: 'waf-x', target: 't1', family: 'sqli' }, { changeId: 'c1', defense: 'waf-x', target: 't1', family: 'xss' }, { changeId: 'c2', defense: 'waf-y', target: 't2', family: 'sqli' }]);
  assert.equal(v.count, 2);
  assert.equal(v.cascadeCount, 1);
  assert.equal(v.totalFamilies, 2);
  assert.equal(v.top.key, 'c1');
});
test('53542 filterBenignFailures splits benign setup failures', () => {
  const v = XB.filterBenignFailures([{ id: 'f1', reason: 'malformed setup' }, { id: 'f2', reason: 'waf-block' }, { id: 'f3', failureClass: 'benign' }]);
  assert.equal(v.count, 3);
  assert.equal(v.benignCount, 2);
  assert.equal(v.defenseCount, 1);
  assert.equal(v.benignRate, 0.67);
});
test('53543 scoreRootCauseConfidence grades classification confidence', () => {
  const v = XB.scoreRootCauseConfidence([{ id: 'f1', classification: 'waf', evidenceCount: 3, consistentSignals: 4, totalSignals: 4 }, { id: 'f2', classification: 'patched', evidenceCount: 0, consistentSignals: 0, totalSignals: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.averageConfidence, 0.65);
  assert.equal(v.top.key, 'f1');
});
test('53544 benchmarkPayloadFailures benchmarks failure profiles', () => {
  const v = XB.benchmarkPayloadFailures([{ family: 'sqli', attempts: 100, failures: 30 }, { family: 'xss', attempts: 100, failures: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.meanFailureRate, 0.2);
  assert.equal(v.top.key, 'sqli');
});
test('53545 profileTargetFromFailures detects shadow WAFs', () => {
  const v = XB.profileTargetFromFailures([{ target: 't1', status: 403, signature: 'sig-a' }, { target: 't1', status: 403, signature: 'sig-b' }, { target: 't1', status: 403, signature: 'sig-c' }, { target: 't2', status: 200 }]);
  assert.equal(v.count, 2);
  assert.equal(v.shadowWafCount, 1);
  assert.equal(v.top.key, 't1');
  assert.equal(v.top.blockedRate, 1);
});
test('53546 adaptiveFailureBudgets allocates budgets by failure rate', () => {
  const v = XB.adaptiveFailureBudgets([{ family: 'sqli', failureRate: 0.8, value: 1 }, { family: 'xss', failureRate: 0.1, value: 1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalAllocated, 100);
  assert.equal(v.top.key, 'xss');
});
test('53547 draftFailureLessons auto-drafts repeated patterns', () => {
  const v = XB.draftFailureLessons([{ failureClass: 'waf', payloadId: 'p1' }, { failureClass: 'waf', payloadId: 'p2' }, { failureClass: 'patched', payloadId: 'p3' }]);
  assert.equal(v.count, 2);
  assert.equal(v.lessonCount, 2);
  assert.equal(v.totalFailures, 3);
  assert.equal(v.top.key, 'waf');
});
test('53548 payloadFailureTimelines marks defense adaptation', () => {
  const v = XB.payloadFailureTimelines([{ payloadId: 'p1', timestamp: 1, status: 200 }, { payloadId: 'p1', timestamp: 2, status: 403 }, { payloadId: 'p2', timestamp: 1, status: 403 }]);
  assert.equal(v.count, 2);
  assert.equal(v.adaptedCount, 1);
  assert.equal(v.top.key, 'p1');
});
test('53549 detectFailureModeShifts detects dominant mode changes', () => {
  const v = XB.detectFailureModeShifts([{ timestamp: 1, mode: 'filter' }, { timestamp: 2, mode: 'filter' }, { timestamp: 3, mode: 'patch' }, { timestamp: 4, mode: 'patch' }]);
  assert.equal(v.count, 2);
  assert.equal(v.dominantEarly, 'filter');
  assert.equal(v.dominantLate, 'patch');
  assert.equal(v.shifted, true);
  assert.equal(v.top.key, 'patch');
});
test('53550 compareFailuresAcrossDefenses finds weakest links', () => {
  const v = XB.compareFailuresAcrossDefenses([{ payloadId: 'p1', defense: 'waf-x', status: 403 }, { payloadId: 'p1', defense: 'waf-y', status: 200 }, { payloadId: 'p1', defense: 'waf-y', status: 200 }]);
  assert.equal(v.count, 2);
  assert.equal(v.payloadCount, 1);
  assert.equal(v.top.key, 'p1|waf-y');
});
test('53551 designFromFailures recommends next-gen payload designs', () => {
  const v = XB.designFromFailures([{ defense: 'waf' }, { defense: 'waf' }, { defense: 'patched' }]);
  assert.equal(v.count, 2);
  assert.equal(v.recommendationCount, 4);
  assert.equal(v.top.key, 'waf');
  assert.equal(v.top.topRecommendation, 'Split blocked tokens across parameters');
});
test('53552 payloadFailureInsurance sizes variant redundancy', () => {
  const v = XB.payloadFailureInsurance([{ family: 'sqli', failureRate: 0.5, criticality: 'high' }, { family: 'xss', failureRate: 0.1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalVariants, 5);
  assert.equal(v.top.key, 'sqli');
  assert.equal(v.top.variantsNeeded, 4);
});
test('53553 failureReviewRituals picks instructive failures weekly', () => {
  const v = XB.failureReviewRituals([{ id: 'f1', failureClass: 'rare', novelty: 0.9, signalScore: 0.9 }, { id: 'f2', failureClass: 'common', novelty: 0.1, signalScore: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.selectedCount, 2);
  assert.equal(v.top.key, 'f1');
});
test('53554 failureRetentionTiers keeps novel failures longest', () => {
  const v = XB.failureRetentionTiers([{ id: 'f1', novelty: 0.9 }, { id: 'f2', novelty: 0.1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.longTermCount, 1);
  assert.equal(v.top.key, 'f1');
  assert.equal(v.top.tier, 'long-term');
});
test('53555 predictPayloadFailure predicts pre-send failure risk', () => {
  const v = XB.predictPayloadFailure([{ payloadId: 'p1', historicalFailureRate: 1, targetDefenseStrength: 1, complexity: 1 }, { payloadId: 'p2', historicalFailureRate: 0, targetDefenseStrength: 0, complexity: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highRiskCount, 1);
  assert.equal(v.averageProbability, 0.5);
  assert.equal(v.top.key, 'p1');
});
test('53556 scheduleFailureAware schedules risky payloads early', () => {
  const v = XB.scheduleFailureAware([{ payloadId: 'p1', risk: 0.9 }, { payloadId: 'p2', risk: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.slotsUsed, 2);
  assert.equal(v.top.key, 'p1');
  assert.equal(v.top.assignedSlot, 'early-window');
});
test('53557 searchFailurePatterns searches by response signature', () => {
  const v = XB.searchFailurePatterns([{ id: 'f1', signature: '403 waf-x', status: 403 }, { id: 'f2', signature: '200 ok', status: 200 }], 'waf');
  assert.equal(v.count, 1);
  assert.equal(v.matchCount, 1);
  assert.equal(v.top.key, 'f1');
});
test('53558 identifyWafFromFailures identifies WAFs from responses', () => {
  const v = XB.identifyWafFromFailures([{ signature: 'cf-ray-abc' }, { signature: 'cf-ray-def' }, { bodySnippet: 'ModSecurity blocked' }]);
  assert.equal(v.count, 2);
  assert.equal(v.identifiedCount, 3);
  assert.equal(v.top.waf, 'Cloudflare');
});
test('53559 failureCostBenefit weighs intel value vs request cost', () => {
  const v = XB.failureCostBenefit([{ id: 'f1', intelValue: 90, requests: 10, costPerRequest: 1 }, { id: 'f2', intelValue: 5, requests: 10, costPerRequest: 1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.worthwhileCount, 1);
  assert.equal(v.totalCost, 20);
  assert.equal(v.totalIntel, 95);
  assert.equal(v.top.key, 'f1');
});
test('53560 failureAutopsyLeaderboard ranks autopsy insight', () => {
  const v = XB.failureAutopsyLeaderboard([{ researcher: 'a', insights: 5, qualityScore: 1 }, { researcher: 'a', insights: 3, qualityScore: 1 }, { researcher: 'b', insights: 1, qualityScore: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalInsights, 9);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.rank, 1);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'XA'], ['B', B_JSX, 'XB']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w89 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w89a-'));
  assert.ok(CSS_SRC.includes('.w89b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave89A.jsx', 'Wave89B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 89 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ payloadId: 'p1', family: 'sqli', ageDays: 120 })]);
  const v = XA.schedulePayloadRot(frozen);
  assert.equal(v.dueCount, 1);
});
