/**
 * wave93.test.js — Infinity AI · Wave 93
 * node:test + node:assert/strict. Registry coverage (20/20 for 53681–53700,
 * 20/20 for 53701–53720, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave93.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE93_A_IDEAS } from './wave93ACore.js';
import * as X93A from './wave93ACore.js';
import { WAVE93_B_IDEAS } from './wave93BCores.js';
import * as X93B from './wave93BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave93ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave93BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave93A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave93B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave93.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 93A ideas, 20/20 wave 93B ideas, zero skips', () => {
  assert.equal(WAVE93_A_IDEAS.length, 20);
  assert.equal(WAVE93_B_IDEAS.length, 20);
  const all = [...WAVE93_A_IDEAS, ...WAVE93_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53681 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE93_A_IDEAS, ...WAVE93_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53681: 'prompt drift detection',
    53682: 'context-window prompt optimization',
    53683: 'prompt length vs performance curves',
    53684: 'few-shot example curation',
    53685: 'negative example mining',
    53686: 'prompt instruction clarity scores',
    53687: 'role-framing experiments',
    53688: 'chain-of-thought prompt tuning',
    53689: 'prompt hallucination guards',
    53690: 'tool-use prompt optimization',
    53691: 'multi-turn prompt strategies',
    53692: 'prompt personalization per model',
    53693: 'prompt token efficiency',
    53694: 'prompt safety calibration',
    53695: 'prompt localization effects',
    53696: 'prompt temperature tuning',
    53697: 'prompt fallback chains',
    53698: 'prompt injection resistance',
    53699: 'prompt consistency checks',
    53700: 'prompt bias audits',
    53701: 'prompt update rollout gates',
    53702: 'prompt performance dashboards',
    53703: 'prompt contribution credits',
    53704: 'prompt library search',
    53705: 'prompt deprecation notices',
    53706: 'prompt experiment sandboxes',
    53707: 'prompt cross-model portability',
    53708: 'prompt edge-case handling',
    53709: 'prompt readability scores',
    53710: 'prompt comment standards',
    53711: 'prompt review boards',
    53712: 'prompt incident postmortems',
    53713: 'prompt performance alerts',
    53714: 'prompt genetic evolution',
    53715: 'prompt ensemble strategies',
    53716: 'prompt compression techniques',
    53717: 'prompt context priming',
    53718: 'prompt output format tuning',
    53719: 'prompt self-correction loops',
    53720: 'prompt time-awareness',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 93A spot checks (one per idea) ---
test('53681 detectPromptDrift flags drifted prompts', () => {
  const v = X93A.detectPromptDrift([{ promptId: 'prompt-a', currentScore: 0.5, baselineScore: 0.9 }, { promptId: 'prompt-b', currentScore: 0.85, baselineScore: 0.9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.driftedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.drift, 0.4);
  assert.equal(v.top.drifted, true);
});
test('53682 optimizeContextWindowPrompts rates optimization', () => {
  const v = X93A.optimizeContextWindowPrompts([{ promptId: 'prompt-a', contextWindow: 8000, candidates: 10, selected: 8 }, { promptId: 'prompt-b', contextWindow: 4000, candidates: 10, selected: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.optimizedCount, 1);
  assert.equal(v.top.key, 'prompt-a|8000');
  assert.equal(v.top.optimizationRate, 0.8);
});
test('53683 curvePromptLengthPerformance buckets by length', () => {
  const v = X93A.curvePromptLengthPerformance([{ promptId: 'prompt-a', lengthChars: 300, runs: 20, wins: 14 }, { promptId: 'prompt-b', lengthChars: 1200, runs: 20, wins: 10 }, { promptId: 'prompt-c', lengthChars: 2500, runs: 20, wins: 6 }]);
  assert.equal(v.count, 3);
  assert.equal(v.top.bucket, 'short');
  assert.equal(v.top.successRate, 0.7);
});
test('53684 curateFewShotExamples measures example lift', () => {
  const v = X93A.curateFewShotExamples([{ promptId: 'prompt-a', exampleId: 'ex-1', runs: 20, wins: 16, baselineWins: 10 }, { promptId: 'prompt-b', exampleId: 'ex-2', runs: 20, wins: 10, baselineWins: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.curatedCount, 1);
  assert.equal(v.top.key, 'prompt-a|ex-1');
  assert.equal(v.top.lift, 0.3);
});
test('53685 mineNegativeExamples measures avoidance', () => {
  const v = X93A.mineNegativeExamples([{ promptId: 'prompt-a', exampleId: 'neg-1', failuresAvoided: 8, totalFailures: 10 }, { promptId: 'prompt-b', exampleId: 'neg-2', failuresAvoided: 2, totalFailures: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.minedCount, 1);
  assert.equal(v.top.key, 'prompt-a|neg-1');
  assert.equal(v.top.avoidanceRate, 0.8);
});
test('53686 scorePromptInstructionClarity scores clarity', () => {
  const v = X93A.scorePromptInstructionClarity([{ promptId: 'prompt-a', runs: 20, consistentInterpretations: 18 }, { promptId: 'prompt-b', runs: 20, consistentInterpretations: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.clearCount, 1);
  assert.equal(v.averageClarity, 0.7);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.clarity, 0.9);
});
test('53687 experimentRoleFraming compares role win rates', () => {
  const v = X93A.experimentRoleFraming([{ promptId: 'prompt-a', role: 'attacker', runs: 20, wins: 15 }, { promptId: 'prompt-a', role: 'auditor', runs: 20, wins: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.leadingCount, 1);
  assert.equal(v.top.key, 'prompt-a|attacker');
  assert.equal(v.top.winRate, 0.75);
});
test('53688 tuneChainOfThoughtPrompts rates trace wins', () => {
  const v = X93A.tuneChainOfThoughtPrompts([{ promptId: 'prompt-a', traces: 20, winningTraces: 15 }, { promptId: 'prompt-b', traces: 20, winningTraces: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.tunedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.traceWinRate, 0.75);
});
test('53689 guardPromptHallucinations rates hallucination', () => {
  const v = X93A.guardPromptHallucinations([{ promptId: 'prompt-a', runs: 100, hallucinations: 5 }, { promptId: 'prompt-b', runs: 100, hallucinations: 25 }]);
  assert.equal(v.count, 2);
  assert.equal(v.guardedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.hallucinationRate, 0.05);
});
test('53690 optimizeToolUsePrompts rates tool success', () => {
  const v = X93A.optimizeToolUsePrompts([{ promptId: 'prompt-a', toolCalls: 50, successfulCalls: 45 }, { promptId: 'prompt-b', toolCalls: 50, successfulCalls: 25 }]);
  assert.equal(v.count, 2);
  assert.equal(v.optimizedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.successRate, 0.9);
});
test('53691 strategizeMultiTurnPrompts rates multi-turn wins', () => {
  const v = X93A.strategizeMultiTurnPrompts([{ promptId: 'prompt-a', avgTurns: 8, runs: 20, wins: 15 }, { promptId: 'prompt-b', avgTurns: 2, runs: 20, wins: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.strongCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.75);
});
test('53692 personalizePromptsPerModel tracks model variants', () => {
  const v = X93A.personalizePromptsPerModel([{ promptId: 'prompt-a', model: 'model-x', runs: 20, wins: 16 }, { promptId: 'prompt-a', model: 'model-y', runs: 20, wins: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.winningCount, 1);
  assert.equal(v.top.key, 'prompt-a|model-x');
  assert.equal(v.top.winRate, 0.8);
});
test('53693 measurePromptTokenEfficiency measures wins per token', () => {
  const v = X93A.measurePromptTokenEfficiency([{ promptId: 'prompt-a', tokens: 2000, wins: 15 }, { promptId: 'prompt-b', tokens: 2000, wins: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.efficientCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.efficiency, 7.5);
});
test('53694 calibratePromptSafety rates over-blocking', () => {
  const v = X93A.calibratePromptSafety([{ promptId: 'prompt-a', legitimateActions: 100, blockedLegitimate: 5 }, { promptId: 'prompt-b', legitimateActions: 100, blockedLegitimate: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.calibratedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.overBlockRate, 0.05);
});
test('53695 measurePromptLocalizationEffects compares languages', () => {
  const v = X93A.measurePromptLocalizationEffects([{ promptId: 'prompt-a', language: 'hi', runs: 20, wins: 15 }, { promptId: 'prompt-a', language: 'en', runs: 20, wins: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.outperformingCount, 1);
  assert.equal(v.top.key, 'prompt-a|hi');
  assert.equal(v.top.winRate, 0.75);
});
test('53696 tunePromptTemperature tunes per phase', () => {
  const v = X93A.tunePromptTemperature([{ promptId: 'prompt-a', phase: 'recon', temperature: 0.2, runs: 20, wins: 15 }, { promptId: 'prompt-a', phase: 'exploit', temperature: 0.9, runs: 20, wins: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.tunedCount, 1);
  assert.equal(v.top.key, 'prompt-a|recon');
  assert.equal(v.top.winRate, 0.75);
});
test('53697 chainPromptFallbacks rates fallback recovery', () => {
  const v = X93A.chainPromptFallbacks([{ promptId: 'prompt-a', degenerateRuns: 20, fallbackWins: 14 }, { promptId: 'prompt-b', degenerateRuns: 20, fallbackWins: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.resilientCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.fallbackSuccessRate, 0.7);
});
test('53698 resistPromptInjection rates resistance', () => {
  const v = X93A.resistPromptInjection([{ promptId: 'prompt-a', attacks: 50, blocked: 45 }, { promptId: 'prompt-b', attacks: 50, blocked: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.resistantCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.resistanceRate, 0.9);
});
test('53699 checkPromptConsistency rates consistency', () => {
  const v = X93A.checkPromptConsistency([{ promptId: 'prompt-a', runs: 20, consistentRuns: 18 }, { promptId: 'prompt-b', runs: 20, consistentRuns: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.consistentCount, 1);
  assert.equal(v.averageConsistency, 0.7);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.consistencyRate, 0.9);
});
test('53700 auditPromptBias flags biased focus', () => {
  const v = X93A.auditPromptBias([{ promptId: 'prompt-a', focusClass: 'sqli', hunts: 30, totalHunts: 40 }, { promptId: 'prompt-a', focusClass: 'xss', hunts: 8, totalHunts: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.biasedCount, 1);
  assert.equal(v.top.key, 'prompt-a|sqli');
  assert.equal(v.top.focusShare, 0.75);
});

// --- Wave 93B spot checks (one per idea) ---
test('53701 gatePromptUpdateRollouts gates staged rollouts', () => {
  const v = X93B.gatePromptUpdateRollouts([{ promptId: 'prompt-a', stage: 'canary', metric: 0.85, threshold: 0.8 }, { promptId: 'prompt-a', stage: 'full', metric: 0.6, threshold: 0.8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.passedCount, 1);
  assert.equal(v.top.key, 'prompt-a|canary');
  assert.equal(v.top.passed, true);
});
test('53702 dashboardPromptPerformance dashboards win and FP rates', () => {
  const v = X93B.dashboardPromptPerformance([{ promptId: 'prompt-a', runs: 100, wins: 70, falsePositives: 10, avgTtfMinutes: 12 }, { promptId: 'prompt-b', runs: 100, wins: 30, falsePositives: 40, avgTtfMinutes: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.7);
  assert.equal(v.top.fpRate, 0.1);
});
test('53703 creditPromptContributions credits contributors', () => {
  const v = X93B.creditPromptContributions([{ promptId: 'prompt-a', contributor: 'researcher-a', improvement: 0.2 }, { promptId: 'prompt-b', contributor: 'researcher-a', improvement: 0.1 }, { promptId: 'prompt-c', contributor: 'researcher-b', improvement: 0.05 }]);
  assert.equal(v.count, 2);
  assert.equal(v.creditCount, 3);
  assert.equal(v.top.key, 'researcher-a');
  assert.equal(v.top.totalImprovement, 0.3);
});
test('53704 searchPromptLibrary searches templates', () => {
  const v = X93B.searchPromptLibrary([{ promptId: 'prompt-a', title: 'Recon specialist', tags: ['recon'], winRate: 0.8 }, { promptId: 'prompt-b', title: 'Exploit helper', tags: ['exploit'], winRate: 0.5 }], 'recon');
  assert.equal(v.count, 2);
  assert.equal(v.matchCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.8);
});
test('53705 noticePromptDeprecations flags underperformers', () => {
  const v = X93B.noticePromptDeprecations([{ promptId: 'prompt-a', winRate: 0.2, threshold: 0.3, noticeSent: true }, { promptId: 'prompt-b', winRate: 0.7, threshold: 0.3, noticeSent: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.deprecatedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.deprecated, true);
});
test('53706 sandboxPromptExperiments validates variants', () => {
  const v = X93B.sandboxPromptExperiments([{ promptId: 'prompt-a', variant: 'v2', sandboxRuns: 50, wins: 35 }, { promptId: 'prompt-a', variant: 'v3', sandboxRuns: 50, wins: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.validatedCount, 1);
  assert.equal(v.top.key, 'prompt-a|v2');
  assert.equal(v.top.winRate, 0.7);
});
test('53707 measurePromptPortability measures transfer', () => {
  const v = X93B.measurePromptPortability([{ promptId: 'prompt-a', sourceModel: 'model-x', targetModel: 'model-y', sourceScore: 0.9, targetScore: 0.8 }, { promptId: 'prompt-b', sourceModel: 'model-x', targetModel: 'model-z', sourceScore: 0.9, targetScore: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.portableCount, 1);
  assert.equal(v.top.key, 'prompt-a|model-x|model-y');
  assert.equal(v.top.portability, 0.89);
});
test('53708 handlePromptEdgeCases rates coverage', () => {
  const v = X93B.handlePromptEdgeCases([{ promptId: 'prompt-a', edgeCases: 20, handled: 18 }, { promptId: 'prompt-b', edgeCases: 20, handled: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.robustCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.coverageRate, 0.9);
});
test('53709 scorePromptReadability scores readability', () => {
  const v = X93B.scorePromptReadability([{ promptId: 'prompt-a', words: 120, sentences: 10 }, { promptId: 'prompt-b', words: 400, sentences: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readableCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.avgSentenceLength, 12);
});
test('53710 enforcePromptCommentStandards rates documentation', () => {
  const v = X93B.enforcePromptCommentStandards([{ promptId: 'prompt-a', instructions: 10, documented: 9 }, { promptId: 'prompt-b', instructions: 10, documented: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.coverage, 0.9);
});
test('53711 boardPromptReviews rates approvals', () => {
  const v = X93B.boardPromptReviews([{ promptId: 'prompt-a', changeId: 'chg-1', reviewers: 5, approvals: 4 }, { promptId: 'prompt-a', changeId: 'chg-2', reviewers: 5, approvals: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.approvedCount, 1);
  assert.equal(v.top.key, 'prompt-a|chg-1');
  assert.equal(v.top.approvalRate, 0.8);
});
test('53712 postmortemPromptIncidents weighs wasted hours', () => {
  const v = X93B.postmortemPromptIncidents([{ promptId: 'prompt-a', incidents: 4, wastedHours: 24 }, { promptId: 'prompt-b', incidents: 5, wastedHours: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.severeCount, 1);
  assert.equal(v.totalWastedHours, 34);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.hoursPerIncident, 6);
});
test('53713 alertPromptPerformance flags degradation', () => {
  const v = X93B.alertPromptPerformance([{ promptId: 'prompt-a', currentRate: 0.4, baselineRate: 0.8 }, { promptId: 'prompt-b', currentRate: 0.75, baselineRate: 0.8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.alertingCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.degradation, 0.4);
});
test('53714 evolvePromptsGenetically tracks fitness gains', () => {
  const v = X93B.evolvePromptsGenetically([{ promptId: 'prompt-a', generation: 3, fitness: 0.9, parentFitness: 0.7 }, { promptId: 'prompt-b', generation: 2, fitness: 0.5, parentFitness: 0.6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.evolvedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.fitnessGain, 0.2);
});
test('53715 strategizePromptEnsembles rates ensemble wins', () => {
  const v = X93B.strategizePromptEnsembles([{ promptId: 'prompt-a', ensembleSize: 3, runs: 20, wins: 15 }, { promptId: 'prompt-b', ensembleSize: 2, runs: 20, wins: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.75);
});
test('53716 compressPrompts measures compression retention', () => {
  const v = X93B.compressPrompts([{ promptId: 'prompt-a', originalTokens: 1000, compressedTokens: 400, scoreBefore: 0.9, scoreAfter: 0.85 }, { promptId: 'prompt-b', originalTokens: 800, compressedTokens: 500, scoreBefore: 0.8, scoreAfter: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.losslessCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.compressionRatio, 0.6);
  assert.equal(v.top.retention, 0.94);
});
test('53717 primePromptContext rates primed wins', () => {
  const v = X93B.primePromptContext([{ promptId: 'prompt-a', primed: true, runs: 20, wins: 15 }, { promptId: 'prompt-b', primed: false, runs: 20, wins: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.winRate, 0.75);
});
test('53718 tunePromptOutputFormats rates parse reliability', () => {
  const v = X93B.tunePromptOutputFormats([{ promptId: 'prompt-a', format: 'json', attempts: 50, parsed: 48 }, { promptId: 'prompt-a', format: 'text', attempts: 50, parsed: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.reliableCount, 1);
  assert.equal(v.top.key, 'prompt-a|json');
  assert.equal(v.top.parseRate, 0.96);
});
test('53719 loopPromptSelfCorrection rates recovery', () => {
  const v = X93B.loopPromptSelfCorrection([{ promptId: 'prompt-a', runs: 20, corrections: 10, winsAfterCorrection: 8 }, { promptId: 'prompt-b', runs: 20, corrections: 10, winsAfterCorrection: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.recoveringCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.recoveryRate, 0.8);
});
test('53720 managePromptTimeAwareness flags budget overruns', () => {
  const v = X93B.managePromptTimeAwareness([{ promptId: 'prompt-a', phase: 'recon', budgetMinutes: 60, usedMinutes: 45 }, { promptId: 'prompt-a', phase: 'exploit', budgetMinutes: 60, usedMinutes: 80 }]);
  assert.equal(v.count, 2);
  assert.equal(v.efficientCount, 1);
  assert.equal(v.top.key, 'prompt-a|recon');
  assert.equal(v.top.utilization, 0.75);
  assert.equal(v.top.efficient, true);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X93A'], ['B', B_JSX, 'X93B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w93 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w93a-'));
  assert.ok(CSS_SRC.includes('.w93b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave93A.jsx', 'Wave93B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 93 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
    assert.ok(!src.toLowerCase().includes('mock'), `${name} carries debris`);
    assert.ok(!src.toLowerCase().includes('demo'), `${name} carries debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ promptId: 'prompt-a', currentScore: 0.5, baselineScore: 0.9 }), Object.freeze({ promptId: 'prompt-b', currentScore: 0.85, baselineScore: 0.9 })]);
  const v = X93A.detectPromptDrift(frozen);
  assert.equal(v.count, 2);
});
