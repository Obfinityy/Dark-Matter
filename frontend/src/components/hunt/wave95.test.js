/**
 * wave95.test.js — Infinity AI · Wave 95
 * node:test + node:assert/strict. Registry coverage (20/20 for 53761–53780,
 * 20/20 for 53781–53800, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave95.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE95_A_IDEAS } from './wave95ACore.js';
import * as X95A from './wave95ACore.js';
import { WAVE95_B_IDEAS } from './wave95BCores.js';
import * as X95B from './wave95BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave95ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave95BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave95A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave95B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave95.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 95A ideas, 20/20 wave 95B ideas, zero skips', () => {
  assert.equal(WAVE95_A_IDEAS.length, 20);
  assert.equal(WAVE95_B_IDEAS.length, 20);
  const all = [...WAVE95_A_IDEAS, ...WAVE95_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53761 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE95_A_IDEAS, ...WAVE95_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53761: 'researcher onboarding recommendations',
    53762: 'recommendation a/b testing',
    53763: 'strategy portfolio recommendations',
    53764: 'recommendation audit trails',
    53765: 'emergency strategy fallbacks',
    53766: 'recommendation personalization controls',
    53767: 'strategy recommendation widgets',
    53768: 'recommendation effectiveness reports',
    53769: 'cross-industry recommendation transfer',
    53770: 'recommendation data minimization',
    53771: 'strategy recommendation versioning',
    53772: 'researcher trust scores',
    53773: 'recommendation simulation mode',
    53774: 'strategy recommendation ethics',
    53775: 'recommendation feedback incentives',
    53776: 'strategy recommendation slas',
    53777: 'recommendation model cards',
    53778: 'recommendation sunset reviews',
    53779: 'strategy recommendation mobile access',
    53780: 'recommendation integration with scheduling',
    53781: 'strategy recommendation benchmarks',
    53782: 'recommendation continuous learning',
    53783: 'strategy recommendation transparency reports',
    53784: 'recommendation-driven hunt templates',
    53785: 'payload freshness scoring',
    53786: 'stale knowledge detection',
    53787: 'automatic payload quarantine',
    53788: 'knowledge half-life modeling',
    53789: 'patch-driven invalidation',
    53790: 'version-aware knowledge expiry',
    53791: 'forgetting audit trails',
    53792: 'selective forgetting controls',
    53793: 'forgetting impact assessments',
    53794: 'resurrection protocols',
    53795: 'stale playbook detection',
    53796: 'knowledge confidence decay',
    53797: 'seasonal knowledge cycling',
    53798: 'defense-evolution tracking',
    53799: 'forgetting vs archiving policies',
    53800: 'human forgetting overrides',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 95A spot checks (one per idea) ---
test('53761 buildResearcherOnboardingPlan blends experience and hunts into a path', () => {
  const v = X95A.buildResearcherOnboardingPlan([{ researcher: 'r-a', experienceLevel: 0.2, completedHunts: 2 }, { researcher: 'r-b', experienceLevel: 0.9, completedHunts: 12 }]);
  assert.equal(v.count, 2);
  assert.equal(v.guidedCount, 1);
  assert.equal(v.autonomousCount, 1);
  assert.equal(v.top.key, 'r-b');
  assert.equal(v.top.onboardingScore, 0.95);
  assert.equal(v.top.path, 'autonomous-hunts');
});
test('53762 testRecommendationABVariants measures lift against control', () => {
  const v = X95A.testRecommendationABVariants([{ variant: 'control', control: true, impressions: 200, accepted: 60 }, { variant: 'challenger', impressions: 200, accepted: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.controlRate, 0.3);
  assert.equal(v.winnerCount, 1);
  assert.equal(v.top.key, 'challenger');
  assert.equal(v.top.conversionRate, 0.45);
  assert.equal(v.top.lift, 0.15);
});
test('53763 selectStrategyPortfolio diversifies under a risk cap', () => {
  const v = X95A.selectStrategyPortfolio([{ strategy: 'recon-first', expectedReturn: 0.8, risk: 0.2, correlationGroup: 'recon' }, { strategy: 'deep-recon', expectedReturn: 0.75, risk: 0.3, correlationGroup: 'recon' }, { strategy: 'auth-focus', expectedReturn: 0.6, risk: 0.2, correlationGroup: 'auth' }]);
  assert.equal(v.count, 3);
  assert.equal(v.selectedCount, 2);
  assert.equal(v.totalExpectedReturn, 1.4);
  assert.equal(v.totalRisk, 0.4);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.score, 0.7);
});
test('53764 traceRecommendationAuditTrail groups events per recommendation', () => {
  const v = X95A.traceRecommendationAuditTrail([{ recommendationId: 'rec-1', action: 'issued', actor: 'engine', timestamp: 1 }, { recommendationId: 'rec-1', action: 'accepted', actor: 'researcher-a', timestamp: 2 }, { recommendationId: 'rec-2', action: 'viewed', actor: 'researcher-b', timestamp: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.eventCount, 3);
  assert.equal(v.completeCount, 1);
  assert.equal(v.top.key, 'rec-1');
  assert.equal(v.top.stepCount, 2);
  assert.equal(v.top.complete, true);
});
test('53765 planEmergencyStrategyFallbacks ranks exposure after fallback discount', () => {
  const v = X95A.planEmergencyStrategyFallbacks([{ strategy: 'deep-chain', failureRate: 0.6, fallback: 'recon-first', fallbackSuccessRate: 0.8 }, { strategy: 'stealth-only', failureRate: 0.7 }]);
  assert.equal(v.count, 2);
  assert.equal(v.coveredCount, 1);
  assert.equal(v.uncoveredCount, 1);
  assert.equal(v.top.key, 'stealth-only');
  assert.equal(v.top.exposure, 0.7);
});
test('53766 applyRecommendationPersonalization blends personal and global scores', () => {
  const v = X95A.applyRecommendationPersonalization([{ researcher: 'r-a', personalization: 0.8, globalScore: 0.5, personalScore: 0.9 }, { researcher: 'r-b', personalization: 0, globalScore: 0.6, personalScore: 0.9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.personalizedCount, 1);
  assert.equal(v.averagePersonalization, 0.4);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.effectiveScore, 0.82);
});
test('53767 buildStrategyRecommendationWidget picks top scoring candidates', () => {
  const v = X95A.buildStrategyRecommendationWidget([{ widgetId: 'sidebar', candidates: [{ strategy: 'recon-first', score: 0.9 }, { strategy: 'auth-focus', score: 0.6 }, { strategy: 'deep-chain', score: 0.3 }] }, { widgetId: 'modal', candidates: [{ strategy: 'stealth-only', score: 0.4 }] }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'sidebar');
  assert.equal(v.top.pickCount, 2);
  assert.equal(v.top.topPick, 'recon-first');
});
test('53768 reportRecommendationEffectiveness combines adoption and win rate', () => {
  const v = X95A.reportRecommendationEffectiveness([{ strategy: 'recon-first', recommended: 100, followed: 80, wins: 64 }, { strategy: 'auth-focus', recommended: 100, followed: 20, wins: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.adoptionRate, 0.8);
  assert.equal(v.top.effectiveness, 0.64);
});
test('53769 transferRecommendationsCrossIndustry scores transfer by similarity', () => {
  const v = X95A.transferRecommendationsCrossIndustry([{ sourceIndustry: 'finance', targetIndustry: 'healthcare', strategy: 'auth-focus', similarity: 0.9, successRate: 0.8 }, { sourceIndustry: 'finance', targetIndustry: 'gaming', strategy: 'auth-focus', similarity: 0.3, successRate: 0.8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.transferableCount, 1);
  assert.equal(v.top.key, 'finance->healthcare|auth-focus');
  assert.equal(v.top.transferScore, 0.72);
});
test('53770 minimizeRecommendationData flags excess collected fields', () => {
  const v = X95A.minimizeRecommendationData([{ datasetId: 'hunt-telemetry', collectedFields: ['target', 'stack', 'notes', 'device-id'], requiredFields: ['target', 'stack'] }, { datasetId: 'feedback', collectedFields: ['rating'], requiredFields: ['rating'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.totalExcess, 2);
  assert.equal(v.top.key, 'feedback');
  assert.equal(v.top.excessCount, 0);
});
test('53771 resolveStrategyRecommendationVersions finds latest per strategy', () => {
  const v = X95A.resolveStrategyRecommendationVersions([{ strategy: 'recon-first', version: '2.1.0' }, { strategy: 'recon-first', version: '1.9.0' }, { strategy: 'api-fuzz', version: '1.0.0' }]);
  assert.equal(v.count, 3);
  assert.equal(v.latestCount, 2);
  assert.equal(v.outdatedCount, 1);
  assert.equal(v.rows.find(r => r.key === 'recon-first@2.1.0').isLatest, true);
  assert.equal(v.rows.find(r => r.key === 'recon-first@1.9.0').isLatest, false);
});
test('53772 scoreResearcherTrust blends precision with experience', () => {
  const v = X95A.scoreResearcherTrust([{ researcher: 'r-a', hunts: 50, verifiedFindings: 45, falsePositives: 5 }, { researcher: 'r-b', hunts: 5, verifiedFindings: 2, falsePositives: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.trustedCount, 1);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.precision, 0.9);
  assert.equal(v.top.trustScore, 0.93);
});
test('53773 simulateRecommendationOutcomes gates on win rate and side effects', () => {
  const v = X95A.simulateRecommendationOutcomes([{ strategy: 'recon-first', simulatedRuns: 100, simulatedWins: 72, sideEffects: 0 }, { strategy: 'deep-chain', simulatedRuns: 100, simulatedWins: 40, sideEffects: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.winRate, 0.72);
  assert.equal(v.top.simulated, true);
});
test('53774 reviewStrategyRecommendationEthics blocks unauthorized strategies', () => {
  const v = X95A.reviewStrategyRecommendationEthics([{ strategy: 'recon-first', scopeChecks: 100, violations: 2, requiresAuth: true, authObtained: true }, { strategy: 'auth-focus', scopeChecks: 100, violations: 0, requiresAuth: true, authObtained: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.ethicalCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.ethical, true);
});
test('53775 tallyRecommendationFeedbackIncentives rates feedback coverage', () => {
  const v = X95A.tallyRecommendationFeedbackIncentives([{ researcher: 'r-a', recommendations: 20, feedbackGiven: 16, pointsEarned: 80 }, { researcher: 'r-b', recommendations: 20, feedbackGiven: 4, pointsEarned: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.engagedCount, 1);
  assert.equal(v.totalPoints, 100);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.coverage, 0.8);
});
test('53776 evaluateStrategyRecommendationSLAs checks latency and uptime', () => {
  const v = X95A.evaluateStrategyRecommendationSLAs([{ strategy: 'recon-first', latencyMs: 150, budgetMs: 200, uptimePct: 99.95, targetUptimePct: 99.9 }, { strategy: 'deep-chain', latencyMs: 450, budgetMs: 200, uptimePct: 99.95, targetUptimePct: 99.9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.headroom, 50);
  assert.equal(v.top.compliant, true);
});
test('53777 buildRecommendationModelCards scores disclosure completeness', () => {
  const v = X95A.buildRecommendationModelCards([{ model: 'recommender-v2', version: '2.0.0', trainingHunts: 500, accuracy: 0.81, limitations: ['api-heavy targets'], owner: 'engine-team' }, { model: 'recommender-v1', version: '', trainingHunts: 0, limitations: [], owner: '' }]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.top.key, 'recommender-v2');
  assert.equal(v.top.cardScore, 1);
  assert.equal(v.top.limitationCount, 1);
});
test('53778 reviewRecommendationSunsets flags declining winless strategies', () => {
  const v = X95A.reviewRecommendationSunsets([{ strategy: 'legacy-scan', lastWinDaysAgo: 120, monthlyUsage: [40, 25, 10] }, { strategy: 'recon-first', lastWinDaysAgo: 5, monthlyUsage: [10, 20, 30] }]);
  assert.equal(v.count, 2);
  assert.equal(v.candidateCount, 1);
  assert.equal(v.top.key, 'legacy-scan');
  assert.equal(v.top.usageTrend, -30);
  assert.equal(v.top.sunsetCandidate, true);
});
test('53779 auditStrategyRecommendationMobileAccess rates mobile coverage', () => {
  const v = X95A.auditStrategyRecommendationMobileAccess([{ strategy: 'recon-first', actions: [{ name: 'view', mobileSupported: true }, { name: 'start', mobileSupported: true }, { name: 'report', mobileSupported: false }, { name: 'share', mobileSupported: true }, { name: 'edit', mobileSupported: true }] }, { strategy: 'deep-chain', actions: [{ name: 'view', mobileSupported: false }] }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.mobileCoverage, 0.8);
  assert.equal(v.top.mobileSupportedCount, 4);
});
test('53780 integrateRecommendationsWithScheduling checks window coverage', () => {
  const v = X95A.integrateRecommendationsWithScheduling([{ strategy: 'recon-first', estimatedHours: 6, windows: [{ day: 'mon', hours: 3 }, { day: 'tue', hours: 4 }] }, { strategy: 'deep-chain', estimatedHours: 10, windows: [{ day: 'mon', hours: 2 }] }]);
  assert.equal(v.count, 2);
  assert.equal(v.scheduledCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.totalWindowHours, 7);
  assert.equal(v.top.firstWindowDay, 'mon');
});

// --- Wave 95B spot checks (one per idea) ---
test('53781 benchmarkStrategyRecommendations ranks by benchmark pass rate', () => {
  const v = X95B.benchmarkStrategyRecommendations([{ strategy: 'recon-first', benchmarkCases: 50, passed: 46, latencyMs: 120 }, { strategy: 'auth-focus', benchmarkCases: 50, passed: 30, latencyMs: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.benchmarkedCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.passRate, 0.92);
  assert.equal(v.top.rank, 1);
});
test('53782 learnFromRecommendationFeedback measures win-rate improvement', () => {
  const v = X95B.learnFromRecommendationFeedback([{ strategy: 'recon-first', feedbackEvents: 100, modelUpdates: 12, winRateBefore: 0.5, winRateAfter: 0.65 }, { strategy: 'auth-focus', feedbackEvents: 100, modelUpdates: 0, winRateBefore: 0.5, winRateAfter: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.learningCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.updateRate, 0.12);
  assert.equal(v.top.improvement, 0.15);
});
test('53783 reportStrategyRecommendationTransparency rates disclosure coverage', () => {
  const v = X95B.reportStrategyRecommendationTransparency([{ reportId: 'transparency-q3', factorsDisclosed: 9, factorsTotal: 10, dataSources: ['hunt outcomes', 'feedback', 'benchmarks'] }, { reportId: 'transparency-q2', factorsDisclosed: 3, factorsTotal: 10, dataSources: ['hunt outcomes'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.transparentCount, 1);
  assert.equal(v.top.key, 'transparency-q3');
  assert.equal(v.top.transparency, 0.9);
  assert.equal(v.top.dataSourceCount, 3);
});
test('53784 buildRecommendationHuntTemplates requires steps and sources', () => {
  const v = X95B.buildRecommendationHuntTemplates([{ templateId: 'api-deep-dive', sourceStrategies: ['recon-first', 'auth-focus'], steps: ['enumerate', 'test-auth', 'report'] }, { templateId: 'quick-scan', sourceStrategies: [], steps: ['enumerate'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'api-deep-dive');
  assert.equal(v.top.stepCount, 3);
  assert.equal(v.top.sourceCount, 2);
});
test('53785 scorePayloadFreshness decays freshness by half-life', () => {
  const v = X95B.scorePayloadFreshness([{ payloadId: 'sqli-union', ageDays: 30, halfLifeDays: 90 }, { payloadId: 'legacy-xss', ageDays: 365, halfLifeDays: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.freshCount, 1);
  assert.equal(v.staleCount, 1);
  assert.equal(v.top.key, 'sqli-union');
  assert.equal(v.top.freshness, 0.79);
  assert.equal(v.top.state, 'fresh');
});
test('53786 detectStaleKnowledge combines age and contradictions', () => {
  const v = X95B.detectStaleKnowledge([{ entryId: 'oauth-notes', lastVerifiedDaysAgo: 30, contradictionCount: 0 }, { entryId: 'legacy-auth', lastVerifiedDaysAgo: 400, contradictionCount: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.staleCount, 1);
  assert.equal(v.top.key, 'legacy-auth');
  assert.equal(v.top.staleness, 1);
  assert.equal(v.top.stale, true);
});
test('53787 quarantinePayloadsAutomatically quarantines repeat failures', () => {
  const v = X95B.quarantinePayloadsAutomatically([{ payloadId: 'sqli-blind', attempts: 20, successes: 2 }, { payloadId: 'xss-stored', attempts: 20, successes: 18 }]);
  assert.equal(v.count, 2);
  assert.equal(v.quarantinedCount, 1);
  assert.deepEqual(v.quarantinedIds, ['sqli-blind']);
  assert.equal(v.top.key, 'sqli-blind');
  assert.equal(v.top.failureRate, 0.9);
});
test('53788 modelKnowledgeHalfLife solves half-life from accuracy decay', () => {
  const v = X95B.modelKnowledgeHalfLife([{ topic: 'xss-vectors', initialAccuracy: 0.8, currentAccuracy: 0.4, ageDays: 180 }, { topic: 'cloud-iam', initialAccuracy: 0.9, currentAccuracy: 0.45, ageDays: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.modeledCount, 2);
  assert.equal(v.top.key, 'cloud-iam');
  assert.equal(v.top.halfLifeDays, 90);
  assert.equal(v.rows.find(r => r.key === 'xss-vectors').halfLifeDays, 180);
});
test('53789 invalidateKnowledgeByPatch invalidates patched components', () => {
  const v = X95B.invalidateKnowledgeByPatch([{ entryId: 'oauth-flow-notes', affectedComponent: 'oauth-library', patchComponent: 'oauth-library', relevance: 0.9 }, { entryId: 'logging-notes', affectedComponent: 'audit-logger', patchComponent: 'oauth-library', relevance: 0.9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.invalidatedCount, 1);
  assert.equal(v.top.key, 'oauth-flow-notes');
  assert.equal(v.top.invalidated, true);
  assert.equal(v.top.action, 'invalidate');
});
test('53790 expireKnowledgeByVersion compares current version to valid range', () => {
  const v = X95B.expireKnowledgeByVersion([{ entryId: 'api-v1-notes', validFrom: '1.0.0', validUntil: '2.0.0', currentVersion: '1.5.0' }, { entryId: 'api-v2-notes', validFrom: '1.0.0', validUntil: '2.0.0', currentVersion: '2.5.0' }]);
  assert.equal(v.count, 2);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.activeCount, 1);
  assert.equal(v.rows.find(r => r.key === 'api-v2-notes').status, 'expired');
  assert.equal(v.rows.find(r => r.key === 'api-v1-notes').status, 'active');
});
test('53791 traceForgettingAuditTrail orders events and flags missing reasons', () => {
  const v = X95B.traceForgettingAuditTrail([{ entryId: 'k-legacy', action: 'forget', actor: 'system', reason: 'stale beyond retention window', timestamp: 3 }, { entryId: 'k-draft', action: 'forget', actor: 'system', timestamp: 2 }, { entryId: 'k-core', action: 'archive', actor: 'researcher-a', reason: 'regulatory retention', timestamp: 1 }]);
  assert.equal(v.count, 3);
  assert.equal(v.forgetCount, 2);
  assert.equal(v.unreasonedCount, 1);
  assert.equal(v.top.entryId, 'k-legacy');
  assert.equal(v.top.timestamp, 3);
});
test('53792 applySelectiveForgettingControls protects compliance entries', () => {
  const v = X95B.applySelectiveForgettingControls([{ entryId: 'old-payload-notes', category: 'payload', ageDays: 500, valueScore: 0.1 }, { entryId: 'audit-requirements', category: 'compliance', ageDays: 500, valueScore: 0.1 }, { entryId: 'fresh-playbook', category: 'playbook', ageDays: 40, valueScore: 0.9 }]);
  assert.equal(v.count, 3);
  assert.equal(v.forgetCount, 1);
  assert.equal(v.retainedCount, 1);
  assert.equal(v.protectedCount, 1);
  assert.equal(v.top.key, 'old-payload-notes');
  assert.equal(v.top.decision, 'forget');
});
test('53793 assessForgettingImpact blocks entries with active dependents', () => {
  const v = X95B.assessForgettingImpact([{ entryId: 'retired-cheatsheet', dependents: ['hunt-template-a'], activeDependents: 0 }, { entryId: 'shared-wordlist', dependents: ['template-a', 'template-b', 'template-c'], activeDependents: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.safeCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.top.key, 'retired-cheatsheet');
  assert.equal(v.top.impactScore, 0);
  assert.equal(v.top.safeToForget, true);
});
test('53794 planKnowledgeResurrection scores viability from archive integrity', () => {
  const v = X95B.planKnowledgeResurrection([{ entryId: 'retired-ssrf-notes', forgottenDaysAgo: 30, archiveIntegrity: 0.95 }, { entryId: 'ancient-payloads', forgottenDaysAgo: 3000, archiveIntegrity: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.resurrectableCount, 1);
  assert.equal(v.top.key, 'retired-ssrf-notes');
  assert.equal(v.top.viability, 0.94);
});
test('53795 detectStalePlaybooks blends idle time with failure rate', () => {
  const v = X95B.detectStalePlaybooks([{ playbookId: 'legacy-full-scan', lastRunDaysAgo: 200, failureRate: 0.6 }, { playbookId: 'api-quick-pass', lastRunDaysAgo: 10, failureRate: 0.05 }]);
  assert.equal(v.count, 2);
  assert.equal(v.staleCount, 1);
  assert.equal(v.top.key, 'legacy-full-scan');
  assert.equal(v.top.staleScore, 0.84);
});
test('53796 decayKnowledgeConfidence halves confidence per half-life', () => {
  const v = X95B.decayKnowledgeConfidence([{ entryId: 'jwt-notes', confidence: 0.9, ageDays: 90, halfLifeDays: 90 }, { entryId: 'legacy-cors-notes', confidence: 0.9, ageDays: 360, halfLifeDays: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.belowThresholdCount, 1);
  assert.equal(v.top.key, 'legacy-cors-notes');
  assert.equal(v.top.decayedConfidence, 0.06);
  assert.equal(v.top.confidenceLoss, 0.84);
});
test('53797 cycleSeasonalKnowledge activates entries in season', () => {
  const v = X95B.cycleSeasonalKnowledge([{ entryId: 'holiday-freeze-notes', activeSeason: 'holiday-freeze', currentSeason: 'holiday-freeze' }, { entryId: 'summer-campaign-notes', activeSeason: 'summer-boost', currentSeason: 'holiday-freeze' }, { entryId: 'core-recon-notes', activeSeason: 'all-year', currentSeason: 'holiday-freeze' }]);
  assert.equal(v.count, 3);
  assert.equal(v.activeCount, 2);
  assert.equal(v.dormantCount, 1);
  assert.equal(v.top.key, 'core-recon-notes');
  assert.equal(v.top.inSeason, true);
});
test('53798 trackDefenseEvolution measures counter pressure exposure', () => {
  const v = X95B.trackDefenseEvolution([{ technique: 'header-injection', defensesObserved: 18, hunts: 20, wins: 6 }, { technique: 'path-traversal', defensesObserved: 2, hunts: 20, wins: 16 }]);
  assert.equal(v.count, 2);
  assert.equal(v.outdatedCount, 1);
  assert.equal(v.top.key, 'header-injection');
  assert.equal(v.top.counterPressure, 0.9);
  assert.equal(v.top.exposure, 0.63);
});
test('53799 decideForgettingVsArchiving applies retention policy', () => {
  const v = X95B.decideForgettingVsArchiving([{ entryId: 'unused-wordlist', ageDays: 400, recentAccess: 0, regulatory: false }, { entryId: 'quarterly-review-notes', ageDays: 400, recentAccess: 5, regulatory: false }, { entryId: 'compliance-evidence', ageDays: 400, recentAccess: 0, regulatory: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.forgetCount, 1);
  assert.equal(v.archiveCount, 2);
  assert.equal(v.retainCount, 0);
  assert.equal(v.top.key, 'unused-wordlist');
  assert.equal(v.top.decision, 'forget');
});
test('53800 applyHumanForgettingOverrides honors human decisions', () => {
  const v = X95B.applyHumanForgettingOverrides([{ entryId: 'researcher-notebook', systemDecision: 'forget', humanDecision: 'retain', reason: 'still referenced by active hunt' }, { entryId: 'stale-cheatsheet', systemDecision: 'forget' }]);
  assert.equal(v.count, 2);
  assert.equal(v.overrideCount, 1);
  assert.equal(v.unauditedCount, 0);
  assert.equal(v.top.key, 'researcher-notebook');
  assert.equal(v.top.finalDecision, 'retain');
  assert.equal(v.top.overridden, true);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X95A'], ['B', B_JSX, 'X95B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w95 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w95a-'));
  assert.ok(CSS_SRC.includes('.w95b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave95A.jsx', 'Wave95B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 95 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ researcher: 'r-a', experienceLevel: 0.2, completedHunts: 2 }), Object.freeze({ researcher: 'r-b', experienceLevel: 0.9, completedHunts: 12 })]);
  const v = X95A.buildResearcherOnboardingPlan(frozen);
  assert.equal(v.count, 2);
  const frozenPayloads = Object.freeze([Object.freeze({ payloadId: 'p-a', ageDays: 30, halfLifeDays: 90 })]);
  const w = X95B.scorePayloadFreshness(frozenPayloads);
  assert.equal(w.count, 1);
});
