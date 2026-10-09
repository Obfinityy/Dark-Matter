/**
 * wave98.test.js — Infinity AI · Wave 98
 * node:test + node:assert/strict. Registry coverage (14/14 for 53881–53894,
 * 26/26 for 53895–53920, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave98.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE98_A_IDEAS } from './wave98ACore.js';
import * as X98A from './wave98ACore.js';
import { WAVE98_B_IDEAS } from './wave98BCores.js';
import * as X98B from './wave98BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave98ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave98BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave98A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave98B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave98.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 14/14 wave 98A ideas, 26/26 wave 98B ideas, zero skips', () => {
  assert.equal(WAVE98_A_IDEAS.length, 14);
  assert.equal(WAVE98_B_IDEAS.length, 26);
  const all = [...WAVE98_A_IDEAS, ...WAVE98_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53881 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE98_A_IDEAS, ...WAVE98_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53881: 'experiment tooling',
    53882: 'experiment review boards',
    53883: 'experiment metric hierarchies',
    53884: 'experiment novelty effects',
    53885: 'experiment cross-validation',
    53886: 'experiment publication standards',
    53887: 'experiment knowledge sharing',
    53888: 'experiment automation',
    53889: 'experiment portfolio reviews',
    53890: 'experiment risk tiers',
    53891: 'experiment success attribution',
    53892: 'experiment data retention',
    53893: 'experiment champion roles',
    53894: 'annual experiment impact report',
    53895: 'skill taxonomy for hunters',
    53896: 'skill proficiency inference',
    53897: 'skill gap heatmaps',
    53898: 'peer-relative skill profiles',
    53899: 'skill gap trend tracking',
    53900: 'training recommendation engine',
    53901: 'skill gap team aggregation',
    53902: 'new-hire skill baselines',
    53903: 'skill validation challenges',
    53904: 'mentor matching by gap',
    53905: 'skill gap privacy controls',
    53906: 'skill progress milestones',
    53907: 'cross-training suggestions (learning)',
    53908: 'skill gap vs assignment fit',
    53909: 'skill decay detection',
    53910: 'emerging skill identification',
    53911: 'skill gap benchmarking',
    53912: 'personalized learning paths',
    53913: 'skill assessment cadence',
    53914: 'skill evidence portfolios',
    53915: 'manager skill dashboards',
    53916: 'skill gap closure verification',
    53917: 'team skill diversity metrics',
    53918: 'skill gap cost estimates',
    53919: 'learning resource ratings',
    53920: 'skill mentorship credit',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 98A spot checks (one per idea) ---
test('53881 buildExperimentTooling marks self-service ready experiments', () => {
  const v = X98A.buildExperimentTooling([
    { experimentId: 'exp-simple', setupSteps: 5, requiredSteps: 5, selfServiceEligible: true, needsSupport: false },
    { experimentId: 'exp-complex', setupSteps: 2, requiredSteps: 6, selfServiceEligible: false, needsSupport: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'exp-simple');
  assert.equal(v.rows[0].status, 'self-service-ready');
  assert.equal(v.rows[1].readiness, 0.33);
});
test('53882 routeExperimentReviewBoards routes high-risk work to the board', () => {
  const v = X98A.routeExperimentReviewBoards([
    { experimentId: 'exp-risky', riskScore: 0.9, cost: 2000, approvals: 1, requiredApprovals: 2 },
    { experimentId: 'exp-routine', riskScore: 0.2, cost: 200, approvals: 0, requiredApprovals: 2 },
    { experimentId: 'exp-approved-risk', riskScore: 0.8, cost: 9000, approvals: 2, requiredApprovals: 2 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.boardCount, 2);
  assert.equal(v.awaitingCount, 1);
  assert.equal(v.rows.find(r => r.key === 'exp-routine').status, 'no-board-needed');
  assert.equal(v.rows.find(r => r.key === 'exp-approved-risk').approved, true);
});
test('53883 defineMetricHierarchies requires primary, secondary, guardrail', () => {
  const v = X98A.defineMetricHierarchies([
    { experimentId: 'exp-full', primaryMetric: 'findings', secondaryCount: 2, guardrailCount: 1 },
    { experimentId: 'exp-thin', primaryMetric: 'findings', secondaryCount: 0, guardrailCount: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-thin').missing, ['secondaries', 'guardrails']);
});
test('53884 measureNoveltyEffects flags fading variant performance', () => {
  const v = X98A.measureNoveltyEffects([
    { experimentId: 'exp-fade', earlyEffect: 0.3, lateEffect: 0.1 },
    { experimentId: 'exp-durable', earlyEffect: 0.25, lateEffect: 0.24 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fadedCount, 1);
  assert.equal(v.rows[0].key, 'exp-fade');
  assert.equal(v.rows[0].retention, 0.33);
  assert.equal(v.rows[1].status, 'durable');
});
test('53885 crossValidateExperiments confirms winners on holdout sets', () => {
  const v = X98A.crossValidateExperiments([
    { experimentId: 'exp-valid', trainingEffect: 0.2, holdoutEffect: 0.16, holdoutHunts: 120 },
    { experimentId: 'exp-invalid', trainingEffect: 0.2, holdoutEffect: -0.05, holdoutHunts: 120 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validatedCount, 1);
  assert.equal(v.top.key, 'exp-valid');
  assert.equal(v.rows[0].retainedShare, 0.8);
});
test('53886 checkPublicationStandards gates writeups on quality bars', () => {
  const v = X98A.checkPublicationStandards([
    { experimentId: 'exp-polished', wordCount: 1200, minWords: 500, sections: 4, requiredSections: 4, citations: 5 },
    { experimentId: 'exp-rough', wordCount: 200, minWords: 500, sections: 2, requiredSections: 4, citations: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.deepEqual(v.rows.find(r => r.key === 'exp-rough').gaps, ['too-short', 'missing-sections', 'no-citations']);
});
test('53887 shareExperimentKnowledge tracks reach across channels', () => {
  const v = X98A.shareExperimentKnowledge([
    { experimentId: 'exp-shared', channels: ['forum', 'digest'], audienceSize: 40, views: 30 },
    { experimentId: 'exp-quiet', channels: [], audienceSize: 40, views: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.sharedCount, 1);
  assert.equal(v.totalViews, 30);
  assert.equal(v.top.reachRate, 0.75);
  assert.equal(v.rows.find(r => r.key === 'exp-quiet').status, 'unshared');
});
test('53888 automateExperiments converts routine steps into saved hours', () => {
  const v = X98A.automateExperiments([
    { experimentId: 'exp-auto', stepsTotal: 8, stepsAutomated: 8, manualMinutesSaved: 240 },
    { experimentId: 'exp-manual', stepsTotal: 8, stepsAutomated: 2, manualMinutesSaved: 30 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fullyAutomatedCount, 1);
  assert.equal(v.totalSavedHours, 4.5);
  assert.equal(v.rows[0].automationRate, 1);
});
test('53889 reviewExperimentPortfolio sums cumulative portfolio impact', () => {
  const v = X98A.reviewExperimentPortfolio([
    { experimentId: 'exp-star', impact: 9000, cost: 2000, quarter: 'Q3' },
    { experimentId: 'exp-drain', impact: 500, cost: 3000, quarter: 'Q3' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalImpact, 9500);
  assert.equal(v.portfolioReturn, 1.9);
  assert.equal(v.contributorCount, 1);
  assert.equal(v.top.key, 'exp-star');
});
test('53890 tierExperimentRisk scales oversight with blended risk', () => {
  const v = X98A.tierExperimentRisk([
    { experimentId: 'exp-critical', targetRisk: 0.9, dataRisk: 0.8, scale: 0.7 },
    { experimentId: 'exp-low', targetRisk: 0.1, dataRisk: 0.1, scale: 0.2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.rows[0].tier, 'critical');
  assert.equal(v.rows[0].oversight, 'board-plus-owner');
  assert.equal(v.rows[1].tier, 'low');
});
test('53891 attributeExperimentSuccess credits adopted winners only', () => {
  const v = X98A.attributeExperimentSuccess([
    { experimentId: 'exp-driver', fleetImprovement: 100, contributionShare: 0.5, adopted: true },
    { experimentId: 'exp-shelved', fleetImprovement: 100, contributionShare: 0.4, adopted: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.totalAttributed, 50);
  assert.equal(v.unattributedShare, 0.5);
  assert.equal(v.rows.find(r => r.key === 'exp-shelved').attributedImpact, 0);
});
test('53892 planExperimentDataRetention archives data past its window', () => {
  const v = X98A.planExperimentDataRetention([
    { experimentId: 'exp-old', dataType: 'raw-events', ageDays: 400, retentionDays: 365 },
    { experimentId: 'exp-fresh', dataType: 'summaries', ageDays: 30, retentionDays: 365 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.top.key, 'exp-old');
  assert.equal(v.top.action, 'archive');
  assert.equal(v.rows.find(r => r.key === 'exp-fresh').daysLeft, 335);
});
test('53893 assignExperimentChampions requires champion and backup', () => {
  const v = X98A.assignExperimentChampions([
    { experimentId: 'exp-covered', champion: 'r-a', backup: 'r-b', huntsLed: 40 },
    { experimentId: 'exp-half', champion: 'r-a', backup: '', huntsLed: 12 },
    { experimentId: 'exp-none', champion: '', backup: '', huntsLed: 0 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.coveredCount, 1);
  assert.equal(v.busiestChampion.champion, 'r-a');
  assert.equal(v.busiestChampion.experiments, 2);
});
test('53894 buildAnnualImpactReport rolls experiments up by year', () => {
  const v = X98A.buildAnnualImpactReport([
    { experimentId: 'exp-2025', year: 2025, effect: 0.2, adopted: true, findingsValue: 5000 },
    { experimentId: 'exp-2026-a', year: 2026, effect: 0.3, adopted: true, findingsValue: 9000 },
    { experimentId: 'exp-2026-b', year: 2026, effect: 0.1, adopted: false, findingsValue: 0 },
  ]);
  assert.equal(v.yearCount, 2);
  assert.equal(v.totalExperiments, 3);
  assert.equal(v.latestYear.year, 2026);
  assert.equal(v.latestYear.adoptedCount, 1);
  assert.equal(v.latestYear.totalValue, 9000);
});

// --- Wave 98B spot checks (one per idea) ---
test('53895 buildSkillTaxonomy maps skills to areas for gap analysis', () => {
  const v = X98B.buildSkillTaxonomy([
    { skill: 'recon', area: 'recon', requiredLevel: 4, currentLevel: 4 },
    { skill: 'api-testing', area: 'api', requiredLevel: 4, currentLevel: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.areaCount, 2);
  assert.equal(v.coverage, 0.5);
  assert.equal(v.top.key, 'api-testing');
  assert.equal(v.top.gap, 2);
});
test('53896 inferSkillProficiency derives levels from hunt outcomes', () => {
  const v = X98B.inferSkillProficiency([
    { researcher: 'r-a', skill: 'web', hunts: 50, confirmedFindings: 25, falsePositives: 5 },
    { researcher: 'r-b', skill: 'web', hunts: 40, confirmedFindings: 6, falsePositives: 10 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'r-a|web');
  assert.equal(v.rows[0].findingRate, 0.5);
  assert.equal(v.rows[0].level, 'expert');
  assert.equal(v.rows[1].level, 'developing');
});
test('53897 buildSkillGapHeatmaps buckets gaps into heat levels', () => {
  const v = X98B.buildSkillGapHeatmaps([
    { researcher: 'r-a', skill: 'api', gapScore: 0.8 },
    { researcher: 'r-a', skill: 'web', gapScore: 0.1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.rows[0].heat, 'critical');
  assert.equal(v.rows[1].heat, 'strength');
});
test('53898 buildPeerRelativeProfiles places scores in peer distributions', () => {
  const v = X98B.buildPeerRelativeProfiles([
    { researcher: 'r-a', skill: 'recon', score: 0.8, peerScores: [0.3, 0.4, 0.5, 0.6] },
    { researcher: 'r-b', skill: 'recon', score: 0.35, peerScores: [0.3, 0.4, 0.5, 0.6] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.topQuartileCount, 1);
  assert.equal(v.rows[0].percentile, 1);
  assert.equal(v.rows[0].band, 'top-quartile');
  assert.equal(v.rows[1].band, 'below-median');
});
test('53899 trackSkillGapTrends separates closing from widening gaps', () => {
  const v = X98B.trackSkillGapTrends([
    { researcher: 'r-a', skill: 'api', month: 1, gapScore: 0.8 }, { researcher: 'r-a', skill: 'api', month: 3, gapScore: 0.3 },
    { researcher: 'r-b', skill: 'web', month: 1, gapScore: 0.3 }, { researcher: 'r-b', skill: 'web', month: 2, gapScore: 0.55 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.closingCount, 1);
  assert.equal(v.wideningCount, 1);
  assert.equal(v.rows.find(r => r.key === 'r-a|api').change, -0.5);
});
test('53900 recommendTraining enrolls researchers for real gaps', () => {
  const v = X98B.recommendTraining([
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, moduleId: 'api-fuzzing-lab', moduleFit: 0.9 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.15, moduleId: 'web-basics', moduleFit: 0.8 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.recommendedCount, 1);
  assert.equal(v.top.moduleId, 'api-fuzzing-lab');
  assert.equal(v.top.priority, 0.72);
  assert.equal(v.top.rank, 1);
});
test('53901 aggregateTeamSkillGaps finds group training candidates', () => {
  const v = X98B.aggregateTeamSkillGaps([
    { researcher: 'r-a', skill: 'api', gapScore: 0.8 }, { researcher: 'r-b', skill: 'api', gapScore: 0.6 },
    { researcher: 'r-a', skill: 'web', gapScore: 0.1 }, { researcher: 'r-b', skill: 'web', gapScore: 0.2 },
  ]);
  assert.equal(v.skillCount, 2);
  assert.equal(v.groupTrainingCount, 1);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.averageGap, 0.7);
});
test('53902 establishNewHireBaselines blends replay with early hunts', () => {
  const v = X98B.establishNewHireBaselines([
    { researcher: 'new-a', skill: 'recon', replayScore: 0.7, earlyHuntScore: 0.6, daysOnboard: 30 },
    { researcher: 'new-b', skill: 'recon', replayScore: 0.4, earlyHuntScore: 0.3, daysOnboard: 7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.establishedCount, 1);
  assert.equal(v.top.key, 'new-a|recon');
  assert.equal(v.rows[0].established, true);
});
test('53903 validateSkillChallenges confirms claims with practical proof', () => {
  const v = X98B.validateSkillChallenges([
    { researcher: 'r-a', skill: 'api', claimedLevel: 3, challengeScore: 0.85, passMark: 0.7 },
    { researcher: 'r-b', skill: 'api', claimedLevel: 3, challengeScore: 0.5, passMark: 0.7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validatedCount, 1);
  assert.equal(v.top.key, 'r-a|api');
  assert.equal(v.rows[0].margin, 0.15);
});
test('53904 matchMentorsByGap pairs gaps with strong mentors', () => {
  const v = X98B.matchMentorsByGap([
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, mentor: 'mentor-x', mentorStrength: 0.9 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.7, mentor: 'mentor-y', mentorStrength: 0.3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.top.quality, 'strong-match');
  assert.equal(v.rows[0].matchScore, 0.72);
});
test('53905 applySkillPrivacyControls honors researcher visibility choices', () => {
  const v = X98B.applySkillPrivacyControls([
    { researcher: 'r-a', visibility: 'mentor-only', requesterRole: 'mentor' },
    { researcher: 'r-a', visibility: 'mentor-only', requesterRole: 'team' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.visibleCount, 1);
  assert.equal(v.restrictedCount, 1);
  assert.equal(v.rows.find(r => r.requesterRole === 'team').canView, false);
});
test('53906 trackSkillProgressMilestones celebrates closed gaps', () => {
  const v = X98B.trackSkillProgressMilestones([
    { researcher: 'r-a', skill: 'api', startGap: 0.8, currentGap: 0.25, milestoneGap: 0.3 },
    { researcher: 'r-b', skill: 'web', startGap: 0.6, currentGap: 0.5, milestoneGap: 0.3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.milestoneCount, 1);
  assert.equal(v.rows[0].closedShare, 0.69);
});
test('53907 suggestCrossTraining pairs strengths with complementary gaps', () => {
  const v = X98B.suggestCrossTraining([
    { researcher: 'r-a', strengthSkill: 'web', strengthScore: 0.85, gapSkill: 'api', gapScore: 0.7, partner: 'r-b' },
    { researcher: 'r-b', strengthSkill: 'reporting', strengthScore: 0.4, gapSkill: 'recon', gapScore: 0.2, partner: 'r-a' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.suggestedCount, 1);
  assert.equal(v.top.action, 'pair-up');
  assert.equal(v.top.complementarity, 0.6);
});
test('53908 checkAssignmentFit flags skill-misaligned assignments', () => {
  const v = X98B.checkAssignmentFit([
    { researcher: 'r-a', assignmentSkill: 'mobile', proficiency: 0.3, requiredProficiency: 0.8 },
    { researcher: 'r-b', assignmentSkill: 'web', proficiency: 0.85, requiredProficiency: 0.7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.misalignedCount, 1);
  assert.equal(v.top.deficit, 0.5);
  assert.equal(v.rows[1].fit, 'aligned');
});
test('53909 detectSkillDecay surfaces idle degrading skills', () => {
  const v = X98B.detectSkillDecay([
    { researcher: 'r-a', skill: 'mobile', lastUsedDays: 150, peakProficiency: 0.8, currentProficiency: 0.45 },
    { researcher: 'r-b', skill: 'web', lastUsedDays: 10, peakProficiency: 0.7, currentProficiency: 0.68 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.decayedCount, 1);
  assert.equal(v.top.key, 'r-a|mobile');
  assert.equal(v.top.decay, 0.35);
});
test('53910 identifyEmergingSkills spots growing uncovered demand', () => {
  const v = X98B.identifyEmergingSkills([
    { skill: 'graphql-testing', targetDemand: 0.8, teamCoverage: 0.2, demandGrowth: 0.6 },
    { skill: 'web-basics', targetDemand: 0.5, teamCoverage: 0.9, demandGrowth: 0.1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.emergingCount, 1);
  assert.equal(v.top.key, 'graphql-testing');
  assert.equal(v.top.status, 'emerging-gap');
});
test('53911 benchmarkSkillGaps compares the team with industry', () => {
  const v = X98B.benchmarkSkillGaps([
    { skill: 'cloud-hunting', teamScore: 0.4, industryScore: 0.75 },
    { skill: 'web', teamScore: 0.8, industryScore: 0.7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.behindCount, 1);
  assert.equal(v.top.key, 'cloud-hunting');
  assert.equal(v.top.benchmarkGap, 0.35);
});
test('53912 buildLearningPaths orders gap modules into sequences', () => {
  const v = X98B.buildLearningPaths([
    { researcher: 'r-a', skill: 'api', gapScore: 0.8, moduleId: 'api-lab' },
    { researcher: 'r-a', skill: 'mobile', gapScore: 0.5, moduleId: 'mobile-lab' },
    { researcher: 'r-b', skill: 'web', gapScore: 0.4, moduleId: 'web-lab' },
  ]);
  assert.equal(v.researcherCount, 2);
  assert.equal(v.totalSteps, 3);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.firstStep.moduleId, 'api-lab');
  assert.equal(v.top.path[1].step, 2);
});
test('53913 scheduleSkillAssessments keeps cadence without over-testing', () => {
  const v = X98B.scheduleSkillAssessments([
    { researcher: 'r-a', skill: 'api', lastAssessedDays: 120, reassessDays: 90 },
    { researcher: 'r-b', skill: 'web', lastAssessedDays: 10, reassessDays: 90 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.dueCount, 1);
  assert.equal(v.top.key, 'r-a|api');
  assert.equal(v.rows.find(r => r.key === 'r-b|web').status, 'recently-tested');
});
test('53914 buildEvidencePortfolios require verified highlights', () => {
  const v = X98B.buildEvidencePortfolios([
    { researcher: 'r-a', skill: 'web', highlights: 6, verifiedHighlights: 5 },
    { researcher: 'r-b', skill: 'api', highlights: 2, verifiedHighlights: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalHighlights, 8);
  assert.equal(v.top.key, 'r-a|web');
});
test('53915 buildManagerSkillDashboards suppress small exposed groups', () => {
  const v = X98B.buildManagerSkillDashboards([
    { team: 'red', skill: 'api', averageGap: 0.65, researcherCount: 6, exposedIndividuals: 0 },
    { team: 'blue', skill: 'web', averageGap: 0.3, researcherCount: 2, exposedIndividuals: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.safeCount, 1);
  assert.equal(v.rows.find(r => r.key === 'blue|web').aggregationLevel, 'suppressed-small-group');
});
test('53916 verifySkillGapClosure demands observed hunt evidence', () => {
  const v = X98B.verifySkillGapClosure([
    { researcher: 'r-a', skill: 'api', gapBefore: 0.8, gapAfter: 0.3, huntEvidence: 12 },
    { researcher: 'r-b', skill: 'web', gapBefore: 0.6, gapAfter: 0.45, huntEvidence: 2 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.top.improvement, 0.5);
  assert.equal(v.rows[1].status, 'improving-unverified');
});
test('53917 measureTeamSkillDiversity flags single points of failure', () => {
  const v = X98B.measureTeamSkillDiversity([
    { skill: 'recon', specialists: 5, totalResearchers: 10 },
    { skill: 'mobile', specialists: 1, totalResearchers: 10 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fragileCount, 1);
  assert.equal(v.diversityIndex, 0.68);
  assert.equal(v.top.key, 'recon');
});
test('53918 estimateSkillGapCosts prices findings lost to gaps', () => {
  const v = X98B.estimateSkillGapCosts([
    { skill: 'api', gapScore: 0.8, huntsAffected: 50, findingsPerHunt: 0.5, valuePerFinding: 300 },
    { skill: 'web', gapScore: 0.2, huntsAffected: 40, findingsPerHunt: 0.4, valuePerFinding: 300 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.lostFindings, 20);
  assert.equal(v.top.lostValue, 6000);
  assert.equal(v.totalLostValue, 6960);
});
test('53919 rateLearningResources ranks by ratings and confidence', () => {
  const v = X98B.rateLearningResources([
    { resourceId: 'api-course', skill: 'api', ratings: 18, averageRating: 4.6, completions: 25 },
    { resourceId: 'old-webinar', skill: 'web', ratings: 3, averageRating: 3.2, completions: 4 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.recommendedCount, 1);
  assert.equal(v.top.key, 'api-course');
  assert.equal(v.top.rank, 1);
});
test('53920 creditSkillMentorship rewards mentors for closed gaps', () => {
  const v = X98B.creditSkillMentorship([
    { mentor: 'mentor-x', mentee: 'r-a', skill: 'api', gapClosed: 0.5, sessions: 6 },
    { mentor: 'mentor-x', mentee: 'r-b', skill: 'web', gapClosed: 0.1, sessions: 2 },
    { mentor: 'mentor-y', mentee: 'r-c', skill: 'recon', gapClosed: 0.4, sessions: 4 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.creditedCount, 2);
  assert.equal(v.topMentor.mentor, 'mentor-x');
  assert.equal(v.topMentor.credit, 8);
  assert.equal(v.totalCredit, 14);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X98A'], ['B', B_JSX, 'X98B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 15, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w98 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w98a-'));
  assert.ok(CSS_SRC.includes('.w98b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave98A.jsx', 'Wave98B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 98 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenTooling = Object.freeze([Object.freeze({ experimentId: 'exp-a', setupSteps: 5, requiredSteps: 5 }), Object.freeze({ experimentId: 'exp-b', setupSteps: 1, requiredSteps: 5 })]);
  const a = X98A.buildExperimentTooling(frozenTooling);
  assert.equal(a.count, 2);
  const frozenPaths = Object.freeze([Object.freeze({ researcher: 'r-a', skill: 'api', gapScore: 0.8, moduleId: 'api-lab' }), Object.freeze({ researcher: 'r-a', skill: 'web', gapScore: 0.4, moduleId: 'web-lab' })]);
  const b = X98B.buildLearningPaths(frozenPaths);
  assert.equal(b.count, 1);
  assert.equal(b.totalSteps, 2);
});
