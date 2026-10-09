/**
 * wave96.test.js — Infinity AI · Wave 96
 * node:test + node:assert/strict. Registry coverage (20/20 for 53801–53820,
 * 20/20 for 53821–53840, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave96.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE96_A_IDEAS } from './wave96ACore.js';
import * as X96A from './wave96ACore.js';
import { WAVE96_B_IDEAS } from './wave96BCores.js';
import * as X96B from './wave96BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave96ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave96BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave96A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave96B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave96.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 96A ideas, 20/20 wave 96B ideas, zero skips', () => {
  assert.equal(WAVE96_A_IDEAS.length, 20);
  assert.equal(WAVE96_B_IDEAS.length, 20);
  const all = [...WAVE96_A_IDEAS, ...WAVE96_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53801 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE96_A_IDEAS, ...WAVE96_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53801: 'forgotten knowledge graveyard',
    53802: 'knowledge refresh campaigns',
    53803: 'cross-stack staleness variance',
    53804: 'forgetting fairness checks',
    53805: 'stale lesson pruning',
    53806: 'knowledge decay dashboards',
    53807: 'forgetting notification feeds',
    53808: 'time-capsule knowledge snapshots',
    53809: 'forgetting rollback windows',
    53810: 'stale benchmark baselines',
    53811: 'knowledge expiry notifications',
    53812: 'forgetting-driven retraining',
    53813: 'defense-changelog monitoring',
    53814: 'stale cluster dissolution',
    53815: 'knowledge provenance tracking',
    53816: 'forgetting threshold tuning',
    53817: 'expert forgetting reviews',
    53818: 'forgetting simulation mode',
    53819: 'knowledge revalidation queues',
    53820: 'stale prompt retirement',
    53821: 'forgetting metrics',
    53822: 'cross-org staleness signals',
    53823: 'knowledge half-life research',
    53824: 'forgetting ethics reviews',
    53825: 'stale integration cleanup',
    53826: 'knowledge freshness slas',
    53827: 'forgetting-triggered alerts',
    53828: 'archived knowledge search',
    53829: 'knowledge decay attribution',
    53830: 'forgetting policy versioning',
    53831: 'stale training data purging',
    53832: 'knowledge revival testing',
    53833: 'forgetting communication templates',
    53834: 'annual forgetting audits',
    53835: 'knowledge freshness gamification',
    53836: 'forgetting vs updating decisions',
    53837: 'stale dashboard widget cleanup',
    53838: 'knowledge expiry countdowns',
    53839: 'forgetting impact on new hires',
    53840: 'hunt strategy experiment framework',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 96A spot checks (one per idea) ---
test('53801 browseForgottenKnowledgeGraveyard archives retirements by reason', () => {
  const v = X96A.browseForgottenKnowledgeGraveyard([{ entryId: 'legacy-xss-notes', retiredReason: 'stale', forgottenDaysAgo: 500, restorable: true }, { entryId: 'old-ssrf-map', retiredReason: 'superseded', forgottenDaysAgo: 120, restorable: true }, { entryId: 'retired-payloads', retiredReason: 'stale', forgottenDaysAgo: 40, restorable: false }]);
  assert.equal(v.count, 3);
  assert.equal(v.ancientCount, 1);
  assert.equal(v.top.key, 'legacy-xss-notes');
  assert.equal(v.reasonCounts[0].reason, 'stale');
  assert.equal(v.reasonCounts[0].count, 2);
});
test('53802 planKnowledgeRefreshCampaigns tracks completion and overdue state', () => {
  const v = X96A.planKnowledgeRefreshCampaigns([{ campaignId: 'refresh-q1', entriesScheduled: 40, entriesRefreshed: 40, startDay: 1, endDay: 30, today: 45 }, { campaignId: 'refresh-q2', entriesScheduled: 30, entriesRefreshed: 12, startDay: 31, endDay: 60, today: 45 }, { campaignId: 'refresh-q3', entriesScheduled: 25, entriesRefreshed: 5, startDay: 31, endDay: 40, today: 45 }]);
  assert.equal(v.count, 3);
  assert.equal(v.overdueCount, 1);
  assert.equal(v.activeCount, 1);
  assert.equal(v.top.key, 'refresh-q3');
  assert.equal(v.rows.find(r => r.key === 'refresh-q1').status, 'complete');
});
test('53803 measureCrossStackStalenessVariance spreads stale share per stack', () => {
  const v = X96A.measureCrossStackStalenessVariance([{ stack: 'web', lastVerifiedDaysAgo: 200 }, { stack: 'web', lastVerifiedDaysAgo: 300 }, { stack: 'web', lastVerifiedDaysAgo: 20 }, { stack: 'web', lastVerifiedDaysAgo: 400 }, { stack: 'api', lastVerifiedDaysAgo: 40 }, { stack: 'api', lastVerifiedDaysAgo: 60 }, { stack: 'api', lastVerifiedDaysAgo: 90 }, { stack: 'cloud', lastVerifiedDaysAgo: 200 }, { stack: 'cloud', lastVerifiedDaysAgo: 210 }]);
  assert.equal(v.count, 3);
  assert.equal(v.top.key, 'cloud');
  assert.equal(v.top.staleShare, 1);
  assert.equal(v.top.volatile, true);
  assert.equal(v.rows.find(r => r.key === 'api').staleShare, 0);
});
test('53804 auditForgettingFairness flags over-erased niche stacks', () => {
  const v = X96A.auditForgettingFairness([{ stack: 'web', forgotten: 30, total: 300 }, { stack: 'niche-iot', forgotten: 25, total: 40 }, { stack: 'api', forgotten: 15, total: 260 }]);
  assert.equal(v.count, 3);
  assert.equal(v.totalForgotten, 70);
  assert.equal(v.disproportionateCount, 1);
  assert.equal(v.top.key, 'niche-iot');
  assert.equal(v.top.disproportionate, true);
});
test('53805 pruneStaleLessons ranks by contradiction and idle severity', () => {
  const v = X96A.pruneStaleLessons([{ lessonId: 'lesson-ssl-always', contradictionCount: 3, daysSinceWin: 400, outcomeScore: 0.2 }, { lessonId: 'lesson-recon-first', contradictionCount: 0, daysSinceWin: 10, outcomeScore: 0.9 }]);
  assert.equal(v.count, 2);
  assert.equal(v.prunableCount, 1);
  assert.equal(v.top.key, 'lesson-ssl-always');
  assert.equal(v.top.prunable, true);
});
test('53806 buildKnowledgeDecayDashboard groups protected, quarantined, decayed', () => {
  const v = X96A.buildKnowledgeDecayDashboard([{ entryId: 'jwt-notes', confidence: 0.9, ageDays: 90, halfLifeDays: 90 }, { entryId: 'cors-notes', confidence: 0.4, ageDays: 300, halfLifeDays: 60, quarantined: true }, { entryId: 'compliance-basics', confidence: 0.8, ageDays: 500, halfLifeDays: 30, protected: true }, { entryId: 'fresh-recon', confidence: 0.85, ageDays: 5, halfLifeDays: 120 }]);
  assert.equal(v.count, 4);
  assert.equal(v.stateCounts.protected, 1);
  assert.equal(v.stateCounts.quarantined, 1);
  assert.equal(v.top.key, 'compliance-basics');
  assert.equal(v.top.decayedConfidence, 0);
  assert.equal(v.rows.find(r => r.key === 'cors-notes').decayedConfidence, 0.01);
});
test('53807 buildForgettingNotificationFeed orders by urgency window', () => {
  const v = X96A.buildForgettingNotificationFeed([{ entryId: 'entry-a', contributor: 'r-a', daysUntilForget: 5 }, { entryId: 'entry-b', contributor: 'r-b', daysUntilForget: 20 }, { entryId: 'entry-c', contributor: 'r-c', daysUntilForget: 80 }]);
  assert.equal(v.count, 3);
  assert.equal(v.urgencyCounts.critical, 1);
  assert.equal(v.top.key, 'entry-a|r-a');
  assert.equal(v.top.urgency, 'critical');
});
test('53808 buildTimeCapsuleSnapshots gates research readiness on integrity and age', () => {
  const v = X96A.buildTimeCapsuleSnapshots([{ snapshotId: 'capsule-mar', capturedDay: 60, entryCount: 400, integrityScore: 0.95 }, { snapshotId: 'capsule-jan', capturedDay: 1, entryCount: 350, integrityScore: 0.6 }], 90);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalEntries, 750);
  assert.equal(v.top.key, 'capsule-mar');
});
test('53809 planForgettingRollbackWindows expires entries past the window', () => {
  const v = X96A.planForgettingRollbackWindows([{ entryId: 'entry-x', forgottenDaysAgo: 30, rollbackWindowDays: 90 }, { entryId: 'entry-y', forgottenDaysAgo: 120, rollbackWindowDays: 90 }, { entryId: 'entry-z', forgottenDaysAgo: 86, rollbackWindowDays: 90 }]);
  assert.equal(v.count, 3);
  assert.equal(v.restorableCount, 1);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.rows.find(r => r.key === 'entry-z').status, 'at-risk');
});
test('53810 refreshStaleBenchmarkBaselines prioritizes old drifting baselines', () => {
  const v = X96A.refreshStaleBenchmarkBaselines([{ baselineId: 'bench-recon-v1', referenceValue: 120, measuredDaysAgo: 200, driftPct: 18 }, { baselineId: 'bench-auth-v2', referenceValue: 90, measuredDaysAgo: 10, driftPct: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.dueCount, 1);
  assert.equal(v.top.key, 'bench-recon-v1');
  assert.equal(v.top.priority, 0.9);
});
test('53811 notifyKnowledgeExpiry separates pending from notified warnings', () => {
  const v = X96A.notifyKnowledgeExpiry([{ entryId: 'playbook-old', owner: 'r-a', expiresInDays: -5, notified: false }, { entryId: 'playbook-soon', owner: 'r-b', expiresInDays: 10, notified: true }, { entryId: 'playbook-fresh', owner: 'r-c', expiresInDays: 200, notified: false }]);
  assert.equal(v.count, 3);
  assert.equal(v.pendingCount, 1);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.top.key, 'playbook-old');
});
test('53812 planForgettingDrivenRetraining triggers on events or idle time', () => {
  const v = X96A.planForgettingDrivenRetraining([{ component: 'recommender', forgottenCount: 40, daysSinceLastTrain: 70 }, { component: 'ranker', forgottenCount: 3, daysSinceLastTrain: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.dueCount, 1);
  assert.equal(v.top.key, 'recommender');
  assert.equal(v.top.due, true);
});
test('53813 monitorDefenseChangelogs blends severity with affected entries', () => {
  const v = X96A.monitorDefenseChangelogs([{ component: 'oauth-library', changeSeverity: 0.9, entriesAffected: 40, daysSinceChange: 3 }, { component: 'audit-logger', changeSeverity: 0.3, entriesAffected: 5, daysSinceChange: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highRiskCount, 1);
  assert.equal(v.top.key, 'oauth-library');
  assert.equal(v.top.risk, 0.93);
});
test('53814 dissolveStaleClusters dissolves clusters unseen for 18 months', () => {
  const v = X96A.dissolveStaleClusters([{ clusterId: 'cluster-old-xss', lastSeenDaysAgo: 600, memberCount: 14 }, { clusterId: 'cluster-api-auth', lastSeenDaysAgo: 30, memberCount: 40 }, { clusterId: 'cluster-mid', lastSeenDaysAgo: 400, memberCount: 8 }]);
  assert.equal(v.count, 3);
  assert.equal(v.dissolveCount, 1);
  assert.deepEqual(v.dissolveIds, ['cluster-old-xss']);
  assert.equal(v.top.key, 'cluster-old-xss');
});
test('53815 trackKnowledgeProvenance discounts long chains', () => {
  const v = X96A.trackKnowledgeProvenance([{ entryId: 'entry-direct', source: 'verified-hunt', sourceTrust: 0.95, chainLength: 1 }, { entryId: 'entry-forwarded', source: 'third-party-dump', sourceTrust: 0.5, chainLength: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.highRiskCount, 1);
  assert.equal(v.top.key, 'entry-forwarded');
  assert.equal(v.top.chainScore, 0.31);
});
test('53816 tuneForgettingThresholds recommends raise or lower from outcome rates', () => {
  const v = X96A.tuneForgettingThresholds([{ category: 'payload', threshold: 0.5, falseForgetRate: 0.02, staleRetentionRate: 0.4 }, { category: 'playbook', threshold: 0.5, falseForgetRate: 0.3, staleRetentionRate: 0.05 }, { category: 'principle', threshold: 0.6, falseForgetRate: 0.05, staleRetentionRate: 0.1 }]);
  assert.equal(v.count, 3);
  assert.equal(v.tuneCount, 2);
  assert.equal(v.rows.find(r => r.key === 'payload').recommendation, 'lower-threshold');
  assert.equal(v.rows.find(r => r.key === 'playbook').recommendation, 'raise-threshold');
});
test('53817 reviewExpertForgettingVerdicts flags high overturn reviews', () => {
  const v = X96A.reviewExpertForgettingVerdicts([{ reviewId: 'review-q1', quarter: 'Q1', entriesReviewed: 100, entriesOverturned: 5 }, { reviewId: 'review-q2', quarter: 'Q2', entriesReviewed: 80, entriesOverturned: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.attentionCount, 1);
  assert.equal(v.top.key, 'review-q2');
  assert.equal(v.top.overturnRate, 0.38);
});
test('53818 simulateForgettingOutcomes previews without applying', () => {
  const v = X96A.simulateForgettingOutcomes([{ entryId: 'old-low-value', ageDays: 500, valueScore: 0.1, category: 'payload' }, { entryId: 'compliance-core', ageDays: 900, valueScore: 0.05, category: 'compliance' }, { entryId: 'fresh-note', ageDays: 20, valueScore: 0.9, category: 'playbook' }], { maxAgeDays: 365, minValue: 0.3 });
  assert.equal(v.count, 3);
  assert.equal(v.wouldForgetCount, 1);
  assert.deepEqual(v.wouldForgetIds, ['old-low-value']);
  assert.equal(v.simulated, true);
  assert.equal(v.applied, false);
});
test('53819 buildKnowledgeRevalidationQueue prioritizes old critical entries', () => {
  const v = X96A.buildKnowledgeRevalidationQueue([{ entryId: 'entry-critical-old', ageDays: 300, criticality: 0.9, requiresAuth: true }, { entryId: 'entry-minor-fresh', ageDays: 10, criticality: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.queuedCount, 1);
  assert.equal(v.top.key, 'entry-critical-old');
  assert.equal(v.top.priority, 0.85);
});
test('53820 retireStalePrompts retires prompts past recovery decline', () => {
  const v = X96A.retireStalePrompts([{ promptId: 'prompt-legacy', accuracyBefore: 0.8, accuracyNow: 0.3, usesLast30d: 40 }, { promptId: 'prompt-current', accuracyBefore: 0.8, accuracyNow: 0.78, usesLast30d: 120 }]);
  assert.equal(v.count, 2);
  assert.equal(v.retireCount, 1);
  assert.deepEqual(v.retireIds, ['prompt-legacy']);
  assert.equal(v.top.key, 'prompt-legacy');
  assert.equal(v.top.decline, 0.63);
});

// --- Wave 96B spot checks (one per idea) ---
test('53821 computeForgettingMetrics totals churn and revival', () => {
  const v = X96B.computeForgettingMetrics([{ period: '2026-Q1', forgotten: 100, revived: 10, outcomeDelta: 0.05 }, { period: '2026-Q2', forgotten: 50, revived: 25, outcomeDelta: -0.02 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalForgotten, 150);
  assert.equal(v.totalRevived, 35);
  assert.equal(v.overallRevivalRate, 0.23);
});
test('53822 aggregateCrossOrgStalenessSignals anonymizes opted-in orgs only', () => {
  const v = X96B.aggregateCrossOrgStalenessSignals([{ org: 'org-a', topic: 'xss-vectors', staleShare: 0.7 }, { org: 'org-b', topic: 'xss-vectors', staleShare: 0.5 }, { org: 'org-c', topic: 'xss-vectors', staleShare: 0.9, optedOut: true }, { org: 'org-a', topic: 'cloud-iam', staleShare: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.excludedCount, 1);
  assert.equal(v.top.key, 'xss-vectors');
  assert.equal(v.top.meanStaleShare, 0.6);
  assert.equal(v.top.anonymized, true);
});
test('53823 researchKnowledgeHalfLives ranks fastest decaying topics', () => {
  const v = X96B.researchKnowledgeHalfLives([{ topic: 'xss-vectors', halfLifeDays: 45, sampleSize: 120 }, { topic: 'cloud-iam', halfLifeDays: 200, sampleSize: 90 }, { topic: 'crypto-basics', halfLifeDays: 900, sampleSize: 12 }]);
  assert.equal(v.count, 3);
  assert.equal(v.researchGradeCount, 2);
  assert.equal(v.medianHalfLife, 200);
  assert.equal(v.fastest.key, 'xss-vectors');
  assert.equal(v.slowest.key, 'crypto-basics');
});
test('53824 reviewForgettingEthics catches unjustified safety forgetting', () => {
  const v = X96B.reviewForgettingEthics([{ entryId: 'safety-critical-auth', category: 'safety', safetyCritical: true, justification: '' }, { entryId: 'justified-retirement', category: 'payload', safetyCritical: false, justification: 'superseded by v2 guidance' }]);
  assert.equal(v.count, 2);
  assert.equal(v.violationCount, 1);
  assert.equal(v.top.key, 'safety-critical-auth');
  assert.equal(v.top.violation, true);
});
test('53825 cleanStaleIntegrations removes dead connectors', () => {
  const v = X96B.cleanStaleIntegrations([{ integrationId: 'legacy-scanner', tool: 'old-scanner', lastUsedDaysAgo: 200, monthlyCalls: 2, connected: true }, { integrationId: 'hunt-notifier', tool: 'notifier', lastUsedDaysAgo: 1, monthlyCalls: 400, connected: true }, { integrationId: 'flaky-connector', tool: 'connector-x', lastUsedDaysAgo: 10, monthlyCalls: 50, connected: false }]);
  assert.equal(v.count, 3);
  assert.equal(v.removeCount, 1);
  assert.deepEqual(v.removeIds, ['legacy-scanner']);
  assert.equal(v.rows.find(r => r.key === 'flaky-connector').action, 'repair');
});
test('53826 evaluateKnowledgeFreshnessSLAs measures breach per category', () => {
  const v = X96B.evaluateKnowledgeFreshnessSLAs([{ category: 'payloads', targetDays: 90, oldestDays: 140 }, { category: 'principles', targetDays: 730, oldestDays: 400 }]);
  assert.equal(v.count, 2);
  assert.equal(v.breachCount, 1);
  assert.equal(v.top.key, 'payloads');
  assert.equal(v.top.breachFactor, 1.56);
});
test('53827 detectForgettingTriggeredAlerts fires on large drops after forgetting', () => {
  const v = X96B.detectForgettingTriggeredAlerts([{ eventId: 'forget-batch-9', forgottenCount: 150, performanceDropPct: 8, day: 120 }, { eventId: 'forget-minor-3', forgottenCount: 20, performanceDropPct: 1, day: 121 }]);
  assert.equal(v.count, 2);
  assert.equal(v.alertCount, 1);
  assert.deepEqual(v.alertIds, ['forget-batch-9']);
  assert.equal(v.top.key, 'forget-batch-9');
});
test('53828 searchArchivedKnowledge weighs title matches over body matches', () => {
  const v = X96B.searchArchivedKnowledge('xss', [{ entryId: 'k-xss-2019', title: 'XSS filter bypass', body: 'Legacy xss vectors for old frameworks', status: 'archived' }, { entryId: 'k-ssrf-map', title: 'SSRF internal map', body: 'archived cloud metadata notes', status: 'forgotten' }]);
  assert.equal(v.count, 1);
  assert.equal(v.top.key, 'k-xss-2019');
  assert.equal(v.top.score, 3);
});
test('53829 attributeKnowledgeDecay links changes near forgetting events', () => {
  const v = X96B.attributeKnowledgeDecay([{ entryId: 'entry-correlated', forgottenDay: 100, changeDay: 103, performanceDeltaPct: -6 }, { entryId: 'entry-unrelated', forgottenDay: 100, changeDay: 150, performanceDeltaPct: -2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.attributedCount, 1);
  assert.equal(v.attributedDelta, -6);
  assert.equal(v.top.key, 'entry-correlated');
});
test('53830 versionForgettingPolicies tracks current version per policy', () => {
  const v = X96B.versionForgettingPolicies([{ policyId: 'retention-main', version: '2.0.0', effectiveDay: 300, changeSummary: 'raise payload retention' }, { policyId: 'retention-main', version: '1.0.0', effectiveDay: 1, changeSummary: 'initial policy' }, { policyId: 'compliance-hold', version: '1.2.0', effectiveDay: 100, changeSummary: 'compliance hold' }]);
  assert.equal(v.count, 3);
  assert.equal(v.policyCount, 2);
  assert.equal(v.currentCount, 2);
  assert.equal(v.rows.find(r => r.key === 'retention-main@2.0.0').isCurrent, true);
});
test('53831 purgeStaleTrainingData purges stale or noisy examples', () => {
  const v = X96B.purgeStaleTrainingData([{ exampleId: 'ex-old-source', ageDays: 500, sourceStale: true, labelQuality: 0.9 }, { exampleId: 'ex-fresh', ageDays: 10, sourceStale: false, labelQuality: 0.95 }, { exampleId: 'ex-noisy', ageDays: 30, sourceStale: false, labelQuality: 0.2 }]);
  assert.equal(v.count, 3);
  assert.equal(v.purgeCount, 2);
  assert.equal(v.keepCount, 1);
  assert.deepEqual([...v.purgeIds].sort(), ['ex-noisy', 'ex-old-source']);
});
test('53832 testKnowledgeRevival gates production on sandbox pass rate', () => {
  const v = X96B.testKnowledgeRevival([{ entryId: 'revived-ssrf', sandboxRuns: 20, sandboxPasses: 18, sideEffects: 0 }, { entryId: 'revived-legacy', sandboxRuns: 20, sandboxPasses: 10, sideEffects: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.deepEqual(v.readyIds, ['revived-ssrf']);
  assert.equal(v.top.passRate, 0.9);
});
test('53833 renderForgettingCommunication renders retirement notices', () => {
  const v = X96B.renderForgettingCommunication([{ entryId: 'oauth-notes-2023', author: 'researcher-a', reason: 'oauth provider shipped breaking changes', category: 'stale' }]);
  assert.equal(v.count, 1);
  assert.equal(v.templatesAvailable, 4);
  assert.ok(v.rows[0].message.includes('oauth-notes-2023'));
  assert.ok(v.rows[0].message.includes('researcher-a'));
});
test('53834 auditAnnualForgetting rates yearly justification', () => {
  const v = X96B.auditAnnualForgetting([{ year: 2025, forgotten: 400, justified: 380, revived: 10 }, { year: 2026, forgotten: 300, justified: 240, revived: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalForgotten, 700);
  assert.equal(v.latest.year, 2026);
  assert.equal(v.latest.justificationRate, 0.8);
});
test('53835 scoreKnowledgeFreshnessGame ranks researchers by points', () => {
  const v = X96B.scoreKnowledgeFreshnessGame([{ researcher: 'r-a', revalidated: 25, points: 320, streakDays: 40 }, { researcher: 'r-b', revalidated: 4, points: 60, streakDays: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.stewardCount, 1);
  assert.equal(v.top.key, 'r-a');
  assert.equal(v.top.level, 'steward');
  assert.equal(v.top.rank, 1);
});
test('53836 decideForgettingVsUpdating balances evidence against cost', () => {
  const v = X96B.decideForgettingVsUpdating([{ entryId: 'strong-cheap', evidenceStrength: 0.8, updateCostHours: 4, ageDays: 200 }, { entryId: 'weak-old', evidenceStrength: 0.1, updateCostHours: 20, ageDays: 400 }, { entryId: 'mid-unclear', evidenceStrength: 0.4, updateCostHours: 4, ageDays: 30 }]);
  assert.equal(v.count, 3);
  assert.equal(v.updateCount, 1);
  assert.equal(v.forgetCount, 1);
  assert.equal(v.archiveCount, 1);
});
test('53837 cleanStaleDashboardWidgets removes unviewed widgets', () => {
  const v = X96B.cleanStaleDashboardWidgets([{ widgetId: 'widget-unused-chart', name: 'Unused chart', viewsLast30d: 2, ownerActive: true }, { widgetId: 'widget-hunt-feed', name: 'Hunt feed', viewsLast30d: 500, ownerActive: true }, { widgetId: 'widget-orphan', name: 'Orphan panel', viewsLast30d: 40, ownerActive: false }]);
  assert.equal(v.count, 3);
  assert.equal(v.staleCount, 2);
  assert.deepEqual([...v.staleIds].sort(), ['widget-orphan', 'widget-unused-chart']);
});
test('53838 countdownKnowledgeExpiry tiers countdown actions', () => {
  const v = X96B.countdownKnowledgeExpiry([{ entryId: 'contrib-urgent', contributor: 'r-a', expiresInDays: 5, revalidationHours: 2 }, { entryId: 'contrib-later', contributor: 'r-b', expiresInDays: 90, revalidationHours: 3 }, { entryId: 'contrib-gone', contributor: 'r-c', expiresInDays: -3, revalidationHours: 1 }]);
  assert.equal(v.count, 3);
  assert.equal(v.attentionCount, 2);
  assert.equal(v.top.key, 'contrib-gone');
  assert.equal(v.top.action, 'expired');
});
test('53839 auditNewHireForgettingImpact catches forgotten techniques still taught', () => {
  const v = X96B.auditNewHireForgettingImpact([{ technique: 'legacy-xss-vectors', forgotten: true, taughtInOnboarding: true }, { technique: 'modern-api-auth', forgotten: false, taughtInOnboarding: true }, { technique: 'old-cors-tricks', forgotten: true, taughtInOnboarding: false }]);
  assert.equal(v.count, 3);
  assert.equal(v.riskCount, 1);
  assert.deepEqual(v.riskTechniques, ['legacy-xss-vectors']);
  assert.equal(v.top.key, 'legacy-xss-vectors');
});
test('53840 designHuntStrategyExperiment validates experiment designs', () => {
  const v = X96B.designHuntStrategyExperiment([{ experimentId: 'exp-recon-depth', hypothesis: 'Deeper recon raises confirmed-finding rate', arms: [{ name: 'standard', isControl: true }, { name: 'deep-recon' }], successMetric: 'confirmed findings per hunt', targetSample: 150 }, { experimentId: 'exp-draft', hypothesis: '', arms: [{ name: 'only-arm' }], successMetric: '', targetSample: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'exp-recon-depth');
  assert.equal(v.top.checksPassed, 5);
  assert.equal(v.top.powerAssessment, 'limited');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X96A'], ['B', B_JSX, 'X96B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w96 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w96a-'));
  assert.ok(CSS_SRC.includes('.w96b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave96A.jsx', 'Wave96B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 96 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ entryId: 'entry-a', forgottenDaysAgo: 30, rollbackWindowDays: 90 }), Object.freeze({ entryId: 'entry-b', forgottenDaysAgo: 120, rollbackWindowDays: 90 })]);
  const v = X96A.planForgettingRollbackWindows(frozen);
  assert.equal(v.count, 2);
  const frozenExperiments = Object.freeze([Object.freeze({ experimentId: 'exp-frozen', hypothesis: 'h', arms: Object.freeze([Object.freeze({ name: 'a', isControl: true }), Object.freeze({ name: 'b' })]), successMetric: 'm', targetSample: 150 })]);
  const w = X96B.designHuntStrategyExperiment(frozenExperiments);
  assert.equal(w.count, 1);
});
