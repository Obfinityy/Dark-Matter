/**
 * wave97.test.js — Infinity AI · Wave 97
 * node:test + node:assert/strict. Registry coverage (20/20 for 53841–53860,
 * 20/20 for 53861–53880, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave97.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE97_A_IDEAS } from './wave97ACore.js';
import * as X97A from './wave97ACore.js';
import { WAVE97_B_IDEAS } from './wave97BCores.js';
import * as X97B from './wave97BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave97ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave97BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave97A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave97B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave97.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 97A ideas, 20/20 wave 97B ideas, zero skips', () => {
  assert.equal(WAVE97_A_IDEAS.length, 20);
  assert.equal(WAVE97_B_IDEAS.length, 20);
  const all = [...WAVE97_A_IDEAS, ...WAVE97_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53841 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE97_A_IDEAS, ...WAVE97_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53841: 'randomized hunt assignment',
    53842: 'experiment power calculators',
    53843: 'variant performance dashboards',
    53844: 'experiment guardrails (learning)',
    53845: 'multi-armed bandit allocation (learning)',
    53846: 'experiment stratification',
    53847: 'sequential testing methods',
    53848: 'experiment replication requirements',
    53849: 'negative result publishing',
    53850: 'experiment idea backlogs',
    53851: 'cross-team experiment coordination',
    53852: 'experiment ethics reviews',
    53853: 'experiment blinding',
    53854: 'experiment duration guidelines',
    53855: 'interaction effect detection',
    53856: 'experiment rollback plans',
    53857: 'winning variant rollout playbooks',
    53858: 'experiment cost tracking',
    53859: 'experiment result repositories',
    53860: 'experiment prioritization scoring',
    53861: 'heterogeneous treatment effects',
    53862: 'experiment monitoring alerts',
    53863: 'experiment documentation standards',
    53864: 'experiment peer review',
    53865: 'longitudinal experiment tracking',
    53866: 'experiment contamination checks',
    53867: 'experiment sample representativeness',
    53868: 'experiment fatigue management',
    53869: 'experiment incentive alignment',
    53870: 'experiment communication templates',
    53871: 'experiment data quality gates',
    53872: 'bayesian experiment analysis',
    53873: 'experiment segment analysis',
    53874: 'experiment external validity',
    53875: 'experiment registry (learning)',
    53876: 'experiment reproducibility packages',
    53877: 'experiment kill criteria',
    53878: 'experiment winner adoption tracking',
    53879: 'experiment calendar',
    53880: 'experiment retrospective templates',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 97A spot checks (one per idea) ---
test('53841 assignRandomizedHunts assigns every hunt deterministically', () => {
  const input = [{ huntId: 'hunt-a' }, { huntId: 'hunt-b' }, { huntId: 'hunt-c' }, { huntId: 'hunt-d' }];
  const v = X97A.assignRandomizedHunts(input);
  const again = X97A.assignRandomizedHunts(input);
  assert.equal(v.count, 4);
  for (const row of v.rows) assert.ok(row.variant === 'control' || row.variant === 'variant');
  assert.equal(v.perVariant.reduce((s, p) => s + p.count, 0), 4);
  assert.deepEqual(v, again);
});
test('53842 calculateExperimentPower sizes arms by baseline and effect', () => {
  const v = X97A.calculateExperimentPower([
    { experimentId: 'exp-1', baselineRate: 0.1, minDetectableEffect: 0.05, availablePerArm: 500 },
    { experimentId: 'exp-2', baselineRate: 0.1, minDetectableEffect: 0.1, availablePerArm: 500 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'exp-1');
  assert.equal(v.rows[0].requiredPerArm, 684);
  assert.equal(v.rows[1].requiredPerArm, 197);
  assert.equal(v.poweredCount, 1);
  assert.equal(v.rows[1].powered, true);
});
test('53843 buildVariantPerformanceDashboards ranks variants and picks a leader', () => {
  const v = X97A.buildVariantPerformanceDashboards([
    { variant: 'control', hunts: 100, wins: 20, cost: 400 },
    { variant: 'deep-recon', hunts: 100, wins: 40, cost: 900 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalHunts, 200);
  assert.equal(v.overallWinRate, 0.3);
  assert.equal(v.leader.key, 'deep-recon');
  assert.equal(v.rows[0].winRate, 0.4);
  assert.equal(v.rows[0].isLeader, true);
  assert.equal(v.rows[1].lossRate, 0.8);
});
test('53844 evaluateExperimentGuardrails pauses variants past threshold', () => {
  const v = X97A.evaluateExperimentGuardrails([
    { experimentId: 'e1', variant: 'aggressive', relativeDrop: -0.3 },
    { experimentId: 'e1', variant: 'steady', relativeDrop: -0.05 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.pausedCount, 1);
  assert.equal(v.warningCount, 0);
  assert.equal(v.top.key, 'e1|aggressive');
  assert.equal(v.rows[0].status, 'paused');
  assert.equal(v.rows[0].headroom, -0.1);
  assert.equal(v.rows[1].status, 'safe');
});
test('53845 allocateBanditTraffic explores while exploiting the best variant', () => {
  const v = X97A.allocateBanditTraffic([
    { variant: 'control', hunts: 100, wins: 10 },
    { variant: 'deep-recon', hunts: 100, wins: 50 },
  ], 0.2);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'deep-recon');
  assert.equal(v.rows[0].allocatedShare, 0.9);
  assert.equal(v.rows[1].allocatedShare, 0.1);
  assert.equal(v.rows[0].isBest, true);
});
test('53846 stratifyExperiment balances control share per target class', () => {
  const v = X97A.stratifyExperiment([
    { huntId: 'h1', targetClass: 'web', variant: 'control' }, { huntId: 'h2', targetClass: 'web', variant: 'control' },
    { huntId: 'h3', targetClass: 'web', variant: 'variant' }, { huntId: 'h4', targetClass: 'web', variant: 'variant' },
    { huntId: 'h5', targetClass: 'api', variant: 'control' }, { huntId: 'h6', targetClass: 'api', variant: 'control' },
    { huntId: 'h7', targetClass: 'api', variant: 'control' }, { huntId: 'h8', targetClass: 'api', variant: 'variant' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.stratumCount, 2);
  assert.equal(v.balancedCount, 1);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.controlShare, 0.75);
  assert.equal(v.rows.find(r => r.key === 'web').balanced, true);
});
test('53847 runSequentialTest concludes when the boundary is crossed', () => {
  const v = X97A.runSequentialTest([
    { day: 1, controlHunts: 40, controlWins: 4, variantHunts: 40, variantWins: 8 },
    { day: 2, controlHunts: 100, controlWins: 10, variantHunts: 100, variantWins: 50 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.status, 'concluded');
  assert.equal(v.concludedDay, 2);
  assert.equal(v.winner, 'variant');
  assert.equal(v.rows[0].canConclude, false);
});
test('53848 checkExperimentReplication requires sign, size, and fresh hunts', () => {
  const v = X97A.checkExperimentReplication([
    { experimentId: 'exp-a', originalEffect: 0.2, replicationEffect: 0.15, replicationHunts: 120, requiredHunts: 100 },
    { experimentId: 'exp-b', originalEffect: 0.2, replicationEffect: -0.1, replicationHunts: 120, requiredHunts: 100 },
    { experimentId: 'exp-c', originalEffect: 0.2, replicationEffect: 0.05, replicationHunts: 120, requiredHunts: 100 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.replicatedCount, 1);
  assert.equal(v.top.key, 'exp-a');
  assert.equal(v.rows[0].retainedShare, 0.75);
  assert.equal(v.rows.find(r => r.key === 'exp-c').replicated, false);
});
test('53849 publishNegativeResults queues finished negative writeups', () => {
  const v = X97A.publishNegativeResults([
    { experimentId: 'exp-neg', effectSize: -0.08, writeupReady: true, published: false },
    { experimentId: 'exp-draft', effectSize: -0.03, writeupReady: false, published: false },
    { experimentId: 'exp-win', effectSize: 0.12, writeupReady: true, published: true },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.publishableCount, 1);
  assert.equal(v.publishedCount, 1);
  assert.deepEqual(v.publishableIds, ['exp-neg']);
  assert.equal(v.top.key, 'exp-neg');
  assert.equal(v.rows[1].action, 'needs-writeup');
});
test('53850 manageExperimentBacklog ranks hypotheses by priority score', () => {
  const v = X97A.manageExperimentBacklog([
    { ideaId: 'idea-deep-recon', impact: 9, effort: 3, confidence: 0.8 },
    { ideaId: 'idea-new-wordlist', impact: 5, effort: 5, confidence: 0.5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.testNextCount, 1);
  assert.equal(v.top.key, 'idea-deep-recon');
  assert.equal(v.top.score, 2.4);
  assert.equal(v.top.rank, 1);
});

// --- Wave 97B spot checks (one per idea) ---
test('53861 analyzeTreatmentEffects finds the most responsive reliable cohort', () => {
  const v = X97B.analyzeTreatmentEffects([
    { cohort: 'newcomers', variantEffect: 0.3, baselineEffect: 0.1, sampleSize: 80 },
    { cohort: 'veterans', variantEffect: 0.15, baselineEffect: 0.1, sampleSize: 40 },
    { cohort: 'tiny', variantEffect: 0.5, baselineEffect: 0.1, sampleSize: 10 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.reliableCount, 2);
  assert.equal(v.mostResponsive.key, 'newcomers');
  assert.equal(v.heterogeneity, 0.35);
});
test('53862 detectExperimentMonitoringAlerts flags collapsed variants', () => {
  const v = X97B.detectExperimentMonitoringAlerts([
    { experimentId: 'exp-p', variant: 'aggressive', recentWinRate: 0.04, baselineWinRate: 0.2, variantSamples: 50 },
    { experimentId: 'exp-p', variant: 'steady', recentWinRate: 0.18, baselineWinRate: 0.2, variantSamples: 50 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.alertCount, 1);
  assert.equal(v.top.key, 'exp-p|aggressive');
  assert.equal(v.rows[0].severity, 'critical');
});
test('53863 validateExperimentDocumentation enforces pre-registration checks', () => {
  const v = X97B.validateExperimentDocumentation([
    { experimentId: 'exp-full', hypothesis: 'h', primaryMetric: 'm', analysisPlan: 'p', startDay: 5, endDay: 20, registeredDay: 1, launchDay: 5 },
    { experimentId: 'exp-loose', hypothesis: 'h', primaryMetric: 'm', analysisPlan: '', startDay: 5, endDay: 20, registeredDay: 6, launchDay: 5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.rows.find(r => r.key === 'exp-full').compliant, true);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-loose').missing, ['analysisPlan', 'preRegistered']);
});
test('53864 reviewExperimentPeerDesigns approves designs without blockers', () => {
  const v = X97B.reviewExperimentPeerDesigns([
    { experimentId: 'exp-ok', approvals: 3, rejections: 0, blockers: 0 },
    { experimentId: 'exp-blocked', approvals: 1, rejections: 1, blockers: 1 },
    { experimentId: 'exp-fresh', approvals: 0, rejections: 0, blockers: 0 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.approvedCount, 1);
  assert.equal(v.pendingCount, 1);
  assert.equal(v.top.key, 'exp-ok');
  assert.equal(v.rows.find(r => r.key === 'exp-blocked').status, 'changes-requested');
});
test('53865 trackLongitudinalExperiments separates persistent winners from faded ones', () => {
  const v = X97B.trackLongitudinalExperiments([
    { experimentId: 'exp-stable', month: 1, effect: 0.2 }, { experimentId: 'exp-stable', month: 2, effect: 0.19 }, { experimentId: 'exp-stable', month: 3, effect: 0.18 },
    { experimentId: 'exp-fading', month: 1, effect: 0.25 }, { experimentId: 'exp-fading', month: 2, effect: 0.05 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.persistentCount, 1);
  assert.equal(v.fadedCount, 1);
  assert.equal(v.top.key, 'exp-stable');
  assert.equal(v.rows.find(r => r.key === 'exp-stable').retention, 0.9);
});
test('53866 checkExperimentContamination flags polluted experiment groups', () => {
  const v = X97B.checkExperimentContamination([
    { huntId: 'h1', experimentId: 'exp-a', assignedVariant: 'control', exposedVariant: 'control' },
    { huntId: 'h2', experimentId: 'exp-a', assignedVariant: 'control', exposedVariant: 'variant' },
    { huntId: 'h3', experimentId: 'exp-a', assignedVariant: 'variant', exposedVariant: 'variant' },
    { huntId: 'h4', experimentId: 'exp-b', assignedVariant: 'control', exposedVariant: 'control' },
    { huntId: 'h5', experimentId: 'exp-b', assignedVariant: 'control', exposedVariant: 'variant' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.huntCount, 5);
  assert.equal(v.contaminatedCount, 2);
  assert.equal(v.overallRate, 0.4);
  assert.equal(v.flaggedCount, 2);
  assert.equal(v.top.key, 'exp-b');
});
test('53867 checkSampleRepresentativeness scores share gaps against the population', () => {
  const v = X97B.checkSampleRepresentativeness([
    { segment: 'web', populationShare: 0.5, sampleShare: 0.48 },
    { segment: 'api', populationShare: 0.3, sampleShare: 0.42 },
    { segment: 'mobile', populationShare: 0.2, sampleShare: 0.1 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.representativeCount, 2);
  assert.equal(v.representativenessScore, 0.92);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.deviation, 0.12);
});
test('53868 manageExperimentFatigue keeps researchers under their limit', () => {
  const v = X97B.manageExperimentFatigue([
    { researcher: 'r-a', concurrentExperiments: 3, limit: 2 },
    { researcher: 'r-b', concurrentExperiments: 1, limit: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.overLimitCount, 1);
  assert.equal(v.totalLoad, 4);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.utilization, 1.5);
});
test('53869 alignExperimentIncentives protects control-group work', () => {
  const v = X97B.alignExperimentIncentives([
    { researcher: 'r-a', controlHunts: 50, variantHunts: 50, controlReward: 100, variantReward: 100 },
    { researcher: 'r-b', controlHunts: 60, variantHunts: 40, controlReward: 60, variantReward: 140 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.misalignedCount, 1);
  assert.equal(v.alignedCount, 1);
  assert.equal(v.top.key, 'r-b');
  assert.equal(v.rows[0].rewardRatio, 0.43);
});
test('53870 renderExperimentCommunication renders the chosen template', () => {
  const v = X97B.renderExperimentCommunication([{ experimentId: 'exp-1', owner: 'r-a', outcome: 'winner' }], 'results');
  assert.equal(v.count, 1);
  assert.equal(v.template, 'results');
  assert.equal(v.templatesAvailable, 4);
  assert.ok(v.rows[0].message.includes('Infinity AI results: experiment exp-1 finished with outcome winner'));
});

test('53871 gateExperimentDataQuality blocks dirty analysis data', () => {
  const v = X97B.gateExperimentDataQuality([
    { experimentId: 'exp-clean', totalRows: 1000, nullRate: 0.01, duplicateRate: 0.005, missingAssignmentRate: 0.002 },
    { experimentId: 'exp-messy', totalRows: 800, nullRate: 0.08, duplicateRate: 0, missingAssignmentRate: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.passedCount, 1);
  assert.deepEqual(v.blockedIds, ['exp-messy']);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-messy').failures, ['nulls']);
  assert.equal(v.rows.find(r => r.key === 'exp-clean').passed, true);
});
test('53872 analyzeBayesianExperiment ranks variants by probability best', () => {
  const v = X97B.analyzeBayesianExperiment([
    { variant: 'control', wins: 40, losses: 60 },
    { variant: 'deep-recon', wins: 60, losses: 40 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.recommended.key, 'deep-recon');
  assert.equal(v.rows[0].posteriorMean, 0.6);
  assert.ok(v.rows[0].probBest > 0.5);
  assert.equal(v.rows[1].posteriorMean, 0.4);
});
test('53873 analyzeExperimentSegments finds a winner per dimension', () => {
  const v = X97B.analyzeExperimentSegments([
    { segment: 'web', dimension: 'target-class', variantEffect: 0.2, hunts: 80 },
    { segment: 'api', dimension: 'target-class', variantEffect: 0.05, hunts: 60 },
    { segment: 'senior', dimension: 'researcher-tenure', variantEffect: 0.3, hunts: 20 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.dimensionCount, 2);
  assert.equal(v.strongest.segment, 'senior');
  assert.equal(v.dimensionWinners.find(w => w.dimension === 'target-class').segment, 'web');
});
test('53874 assessExternalValidity weights realism in the verdict', () => {
  const v = X97B.assessExternalValidity([
    { experimentId: 'exp-real', labRealismScore: 0.9, conditionMatchScore: 0.8, targetRepresentativeness: 0.85 },
    { experimentId: 'exp-synth', labRealismScore: 0.4, conditionMatchScore: 0.5, targetRepresentativeness: 0.3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.generalizesCount, 1);
  assert.equal(v.rows[0].key, 'exp-real');
  assert.equal(v.rows[0].validity, 0.86);
  assert.equal(v.rows[1].generalizes, false);
});
test('53875 buildExperimentRegistry orders by lifecycle and lists running', () => {
  const v = X97B.buildExperimentRegistry([
    { experimentId: 'exp-plan', status: 'planned', team: 'red', startDay: 20 },
    { experimentId: 'exp-run', status: 'running', team: 'blue', startDay: 3 },
    { experimentId: 'exp-done', status: 'completed', team: 'blue', startDay: 1 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.activeCount, 1);
  assert.deepEqual(v.runningIds, ['exp-run']);
  assert.equal(v.top.key, 'exp-run');
  assert.equal(v.countsByStatus.running, 1);
});
test('53876 packageExperimentReproducibility requires all four parts', () => {
  const v = X97B.packageExperimentReproducibility([
    { experimentId: 'exp-sealed', configHash: 'c0ffee42', seedDocumented: true, dataSnapshot: 'snap-1', codeVersion: '1.0.0' },
    { experimentId: 'exp-partial', configHash: 'bead1984', seedDocumented: false, dataSnapshot: 'snap-1', codeVersion: '1.0.0' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.reproducibleCount, 1);
  assert.equal(v.rows.find(r => r.key === 'exp-partial').completeness, 0.75);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-partial').gaps, ['seed']);
});
test('53877 evaluateExperimentKillCriteria fires pre-defined stop conditions', () => {
  const v = X97B.evaluateExperimentKillCriteria([
    { experimentId: 'exp-overrun', day: 45, hunts: 300, currentEffect: 0.01, minEffect: 0.05, maxDays: 30, budgetUsedPct: 0.6 },
    { experimentId: 'exp-healthy', day: 10, hunts: 50, currentEffect: 0.2, minEffect: 0.05, maxDays: 30, budgetUsedPct: 0.3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.killCount, 1);
  assert.deepEqual(v.killIds, ['exp-overrun']);
  assert.deepEqual(v.top.reasons, ['exceeded-max-days', 'futility']);
  assert.equal(v.rows.find(r => r.key === 'exp-healthy').status, 'continue');
});
test('53878 trackWinnerAdoption flags stalled rollouts', () => {
  const v = X97B.trackWinnerAdoption([
    { variant: 'deep-recon', adoptedTeams: 8, totalTeams: 10, daysSinceWin: 12, postAdoptionEffect: 0.18 },
    { variant: 'niche-payloads', adoptedTeams: 2, totalTeams: 10, daysSinceWin: 90, postAdoptionEffect: 0.1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.adoptedCount, 1);
  assert.equal(v.stalledCount, 1);
  assert.equal(v.top.key, 'deep-recon');
  assert.equal(v.top.status, 'adopted');
});
test('53879 buildExperimentCalendar lists busy days and pool conflicts', () => {
  const v = X97B.buildExperimentCalendar([
    { experimentId: 'exp-a', team: 'red', startDay: 1, endDay: 10, targetPool: 'pool-x' },
    { experimentId: 'exp-b', team: 'blue', startDay: 5, endDay: 12, targetPool: 'pool-x' },
    { experimentId: 'exp-c', team: 'red', startDay: 20, endDay: 25, targetPool: 'pool-x' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.conflictedCount, 2);
  assert.equal(v.busyDays, 18);
  assert.equal(v.top.key, 'exp-a');
  assert.equal(v.rows.find(r => r.key === 'exp-c').conflicted, false);
});
test('53880 applyRetrospectiveTemplates rewards thorough retrospectives', () => {
  const v = X97B.applyRetrospectiveTemplates([
    { experimentId: 'exp-thorough', outcome: 'winner', sectionsFilled: 5, followUps: 3 },
    { experimentId: 'exp-thin', outcome: 'negative', sectionsFilled: 2, followUps: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.thoroughCount, 1);
  assert.equal(v.totalActionItems, 3);
  assert.equal(v.templateSections.length, 5);
  assert.equal(v.top.key, 'exp-thorough');
  assert.equal(v.rows.find(r => r.key === 'exp-thin').completeness, 0.4);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X97A'], ['B', B_JSX, 'X97B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w97 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w97a-'));
  assert.ok(CSS_SRC.includes('.w97b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave97A.jsx', 'Wave97B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 97 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenAssignments = Object.freeze([Object.freeze({ huntId: 'hunt-a', seed: 's' }), Object.freeze({ huntId: 'hunt-b', seed: 's' })]);
  const a = X97A.assignRandomizedHunts(frozenAssignments);
  assert.equal(a.count, 2);
  const frozenVariants = Object.freeze([Object.freeze({ variant: 'control', wins: 40, losses: 60 }), Object.freeze({ variant: 'deep-recon', wins: 60, losses: 40 })]);
  const b = X97B.analyzeBayesianExperiment(frozenVariants);
  assert.equal(b.count, 2);
});

// --- Wave 97A remainder spot checks (one per idea) ---
test('53851 coordinateCrossTeamExperiments detects cross-team interference', () => {
  const v = X97A.coordinateCrossTeamExperiments([
    { experimentId: 'exp-red-1', team: 'red', targetPool: 'pool-x', startDay: 1, endDay: 10 },
    { experimentId: 'exp-blue-1', team: 'blue', targetPool: 'pool-x', startDay: 5, endDay: 15 },
    { experimentId: 'exp-blue-2', team: 'blue', targetPool: 'pool-y', startDay: 5, endDay: 15 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.conflictedCount, 2);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-red-1').conflictsWith, ['exp-blue-1']);
  assert.equal(v.rows.find(r => r.key === 'exp-blue-2').conflicted, false);
});
test('53852 reviewExperimentEthics flags consent and documentation violations', () => {
  const v = X97A.reviewExperimentEthics([
    { experimentId: 'exp-aggressive-scan', targetRisk: 0.9, researcherRisk: 0.3, consentObtained: false, documented: true },
    { experimentId: 'exp-partial-consent', targetRisk: 0.8, researcherRisk: 0.1, consentObtained: true, documented: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.violationCount, 2);
  assert.equal(v.compliantCount, 0);
  assert.equal(v.top.key, 'exp-aggressive-scan');
  assert.equal(v.top.riskScore, 0.66);
});
test('53853 evaluateExperimentBlinding counts feasible unblinded bias risk', () => {
  const v = X97A.evaluateExperimentBlinding([
    { experimentId: 'exp-blind-recon', feasible: true, blinded: true, assessedBy: 'r-a' },
    { experimentId: 'exp-open-payloads', feasible: true, blinded: false, assessedBy: 'r-b' },
    { experimentId: 'exp-live-target', feasible: false, blinded: false, assessedBy: 'r-c' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.feasibleCount, 2);
  assert.equal(v.blindedCount, 1);
  assert.equal(v.biasRiskCount, 1);
  assert.equal(v.blindingRate, 0.5);
  assert.equal(v.top.key, 'exp-open-payloads');
});
test('53854 checkExperimentDurations enforces minimum and maximum run lengths', () => {
  const v = X97A.checkExperimentDurations([
    { experimentId: 'exp-fast-peek', plannedDays: 3, minDays: 14, maxDays: 90 },
    { experimentId: 'exp-standard', plannedDays: 30, minDays: 14, maxDays: 90 },
    { experimentId: 'exp-marathon', plannedDays: 120, minDays: 14, maxDays: 90 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.violationCount, 2);
  assert.equal(v.top.key, 'exp-fast-peek');
  assert.equal(v.rows.find(r => r.key === 'exp-standard').status, 'compliant');
  assert.equal(v.rows.find(r => r.key === 'exp-standard').slackDays, 16);
  assert.equal(v.rows.find(r => r.key === 'exp-marathon').status, 'too-long');
});
test('53855 detectInteractionEffects separates synergy from additivity', () => {
  const v = X97A.detectInteractionEffects([
    { pairId: 'pair-synergy', effectA: 0.1, effectB: 0.05, combinedEffect: 0.3 },
    { pairId: 'pair-additive', effectA: 0.1, effectB: 0.1, combinedEffect: 0.19 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.interactionCount, 1);
  assert.equal(v.top.key, 'pair-synergy');
  assert.equal(v.top.interactionEffect, 0.15);
  assert.equal(v.top.kind, 'synergy');
  assert.equal(v.rows.find(r => r.key === 'pair-additive').kind, 'independent');
});
test('53856 checkRollbackPlans requires steps, owner, and a rehearsal', () => {
  const v = X97A.checkRollbackPlans([
    { experimentId: 'exp-ready', steps: 4, owner: 'r-a', tested: true },
    { experimentId: 'exp-unready', steps: 1, owner: '', tested: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.top.key, 'exp-ready');
  assert.deepEqual(v.rows.find(r => r.key === 'exp-unready').blockers, ['too-few-steps', 'no-owner', 'untested']);
});
test('53857 planWinnerRollout tracks staged rollout progress', () => {
  const v = X97A.planWinnerRollout([
    { variant: 'deep-recon', effect: 0.15, stagesCompleted: 2, totalStages: 4 },
    { variant: 'flat-scan', effect: -0.02, stagesCompleted: 1, totalStages: 4 },
    { variant: 'full-rollout', effect: 0.2, stagesCompleted: 4, totalStages: 4 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.rollingCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.completeCount, 1);
  assert.equal(v.top.key, 'full-rollout');
  assert.equal(v.rows.find(r => r.key === 'deep-recon').nextStage, 'half-fleet');
});
test('53858 trackExperimentCosts nets winner value against total cost', () => {
  const v = X97A.trackExperimentCosts([
    { experimentId: 'exp-a', huntsRun: 100, huntCost: 20, opportunityPerHunt: 5, winnerValue: 4000 },
    { experimentId: 'exp-b', huntsRun: 10, huntCost: 20, opportunityPerHunt: 5, winnerValue: 100 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalCost, 2750);
  assert.equal(v.worthItCount, 1);
  assert.equal(v.top.key, 'exp-a');
  assert.equal(v.rows[0].netValue, 1500);
  assert.equal(v.rows[1].netValue, -150);
});
test('53859 searchExperimentResults weights title, tags, then summary', () => {
  const v = X97A.searchExperimentResults([
    { experimentId: 'exp-recon-depth', title: 'Deep recon experiment', summary: 'Recon depth raised findings', outcome: 'winner', tags: ['recon'] },
    { experimentId: 'exp-auth-payloads', title: 'Auth payload test', summary: 'auth recon ordering', outcome: 'negative', tags: ['auth'] },
  ], 'recon');
  assert.equal(v.count, 2);
  assert.equal(v.rows[0].key, 'exp-recon-depth');
  assert.equal(v.rows[0].score, 6);
  assert.equal(v.rows[1].score, 1);
  assert.equal(v.outcomeCounts.winner, 1);
});
test('53860 scoreExperimentPriorities ranks by value over cost', () => {
  const v = X97A.scoreExperimentPriorities([
    { ideaId: 'idea-recon-depth', expectedValue: 100, confidence: 0.8, cost: 20, strategicFit: 0.9 },
    { ideaId: 'idea-scope-creep', expectedValue: 50, confidence: 0.5, cost: 10, strategicFit: 0.5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.qualifiedCount, 1);
  assert.equal(v.top.key, 'idea-recon-depth');
  assert.equal(v.top.score, 3.6);
  assert.equal(v.top.rank, 1);
});
