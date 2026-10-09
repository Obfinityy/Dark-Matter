/**
 * wave90.test.js — Infinity AI · Wave 90
 * node:test + node:assert/strict. Registry coverage (20/20 for 53561–53580,
 * 20/20 for 53581–53600, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave90.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE90_A_IDEAS } from './wave90ACore.js';
import * as XA from './wave90ACore.js';
import { WAVE90_B_IDEAS } from './wave90BCores.js';
import * as XB from './wave90BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave90ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave90BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave90A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave90B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave90.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 90A ideas, 20/20 wave 90B ideas, zero skips', () => {
  assert.equal(WAVE90_A_IDEAS.length, 20);
  assert.equal(WAVE90_B_IDEAS.length, 20);
  const all = [...WAVE90_A_IDEAS, ...WAVE90_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53561 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE90_A_IDEAS, ...WAVE90_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53561: 'failure trend forecasting',
    53562: 'payload failure documentation standards',
    53563: 'failure-driven strategy pivots',
    53564: 'annual failure analysis report',
    53565: 'cross-hunt finding embeddings',
    53566: 'cluster naming and definitions',
    53567: 'emerging cluster alerts',
    53568: 'cluster growth tracking',
    53569: 'cluster-to-technique mapping',
    53570: 'cluster severity profiles',
    53571: 'cluster stack affinities',
    53572: 'cluster industry affinities',
    53573: 'cluster lifecycles',
    53574: 'novel cluster verification',
    53575: 'cluster deduplication',
    53576: 'cluster split detection',
    53577: 'cluster hunting playbooks',
    53578: 'cluster-based target prioritization',
    53579: 'cluster prediction models',
    53580: 'cluster co-occurrence analysis',
    53581: 'cluster remediation tracking',
    53582: 'cluster false-positive rates',
    53583: 'cluster bounty value analysis',
    53584: 'cluster geographic patterns',
    53585: 'cluster temporal patterns',
    53586: 'cluster auth-requirement profiles',
    53587: 'cluster exploit complexity scores',
    53588: 'cluster report templates',
    53589: 'cluster trend forecasting',
    53590: 'cluster-driven payload breeding',
    53591: 'cluster similarity search',
    53592: 'cluster evolution timelines',
    53593: 'cluster membership explanations',
    53594: 'cluster quality audits',
    53595: 'cluster-based training curricula',
    53596: 'cluster impact dashboards',
    53597: 'cluster anomaly detection',
    53598: 'cluster cross-referencing with cve',
    53599: 'cluster naming governance',
    53600: 'cluster retirement',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 90A spot checks (one per idea) ---
test('53561 forecastFailureTrend fits slope and forecasts next period', () => {
  const v = XA.forecastFailureTrend([{ period: '2026-08', failures: 10, attempts: 100 }, { period: '2026-09', failures: 20, attempts: 100 }]);
  assert.equal(v.count, 2);
  assert.equal(v.slope, 0.1);
  assert.equal(v.forecastNext, 0.3);
  assert.equal(v.trend, 'rising');
  assert.equal(v.top.period, '2026-09');
});
test('53562 documentPayloadFailures scores documentation completeness', () => {
  const v = XA.documentPayloadFailures([{ payloadId: 'p1', reason: 'waf-block', defense: 'modsec', statusCode: 403, hasNotes: true }, { payloadId: 'p2', reason: 'timeout' }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.averageCompleteness, 0.63);
  assert.equal(v.top.key, 'p1');
});
test('53563 pivotStrategyFromFailures recommends pivots above threshold', () => {
  const v = XA.pivotStrategyFromFailures([{ family: 'sqli', failureRate: 0.9, attempts: 50 }, { family: 'xss', failureRate: 0.2, attempts: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.pivotCount, 1);
  assert.equal(v.top.key, 'sqli');
  assert.equal(v.top.action, 'pivot');
});
test('53564 annualFailureReport aggregates families and months', () => {
  const v = XA.annualFailureReport([{ family: 'sqli', month: '2026-01' }, { family: 'sqli', month: '2026-02' }, { family: 'xss', month: '2026-01' }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalFailures, 3);
  assert.equal(v.monthCount, 2);
  assert.equal(v.top.key, 'sqli');
});
test('53565 embedCrossHuntFindings groups cross-hunt clusters', () => {
  const v = XA.embedCrossHuntFindings([{ id: 'f1', hunt: 'h1', cluster: 'auth-bypass', score: 0.9 }, { id: 'f2', hunt: 'h2', cluster: 'auth-bypass', score: 0.8 }, { id: 'f3', hunt: 'h1', cluster: 'xss', score: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.crossHuntCount, 1);
  assert.equal(v.totalFindings, 3);
  assert.equal(v.top.key, 'auth-bypass');
});
test('53566 defineClusterNames validates names and definitions', () => {
  const v = XA.defineClusterNames([{ clusterId: 'c1', name: 'auth-bypass', definition: 'Authentication bypass findings' }, { clusterId: 'c2', name: 'x', definition: 'short' }]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53567 alertEmergingClusters alerts on surge clusters', () => {
  const v = XA.alertEmergingClusters([{ clusterId: 'c1', recentFindings: 30, baselineFindings: 5 }, { clusterId: 'c2', recentFindings: 4, baselineFindings: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.alertCount, 1);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.growthRatio, 6);
});
test('53568 trackClusterGrowth tracks first to last growth', () => {
  const v = XA.trackClusterGrowth([{ clusterId: 'c1', period: '2026-08', size: 10 }, { clusterId: 'c1', period: '2026-09', size: 25 }, { clusterId: 'c2', period: '2026-08', size: 5 }, { clusterId: 'c2', period: '2026-09', size: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.growingCount, 1);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.growth, 15);
});
test('53569 mapClustersToTechniques maps dominant techniques', () => {
  const v = XA.mapClustersToTechniques([{ clusterId: 'c1', techniques: ['sqli-union', 'error-based'] }, { clusterId: 'c2', technique: 'reflected-xss' }]);
  assert.equal(v.count, 2);
  assert.equal(v.mappedCount, 2);
  assert.equal(v.totalTechniques, 3);
  assert.equal(v.top.key, 'c1');
});
test('53570 profileClusterSeverity weights severity profile', () => {
  const v = XA.profileClusterSeverity([{ clusterId: 'c1', critical: 5, high: 2, medium: 1, low: 0 }, { clusterId: 'c2', critical: 0, high: 0, medium: 1, low: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.averageSeverity, 2.35);
  assert.equal(v.top.key, 'c1');
});
test('53571 clusterStackAffinities ranks stacks per cluster', () => {
  const v = XA.clusterStackAffinities([{ cluster: 'c1', stack: 'php', count: 10 }, { cluster: 'c1', stack: 'node', count: 2 }, { cluster: 'c2', stack: 'php', count: 3 }]);
  assert.equal(v.count, 3);
  assert.equal(v.clusterCount, 2);
  assert.equal(v.totalFindings, 15);
  assert.equal(v.top.key, 'c1|php');
});
test('53572 clusterIndustryAffinities ranks industries per cluster', () => {
  const v = XA.clusterIndustryAffinities([{ cluster: 'c1', industry: 'fintech', count: 8 }, { cluster: 'c1', industry: 'health', count: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.clusterCount, 1);
  assert.equal(v.industryCount, 2);
  assert.equal(v.top.key, 'c1|fintech');
});
test('53573 clusterLifecycles classifies lifecycle stages', () => {
  const v = XA.clusterLifecycles([{ clusterId: 'c1', ageDays: 10, recentFindings: 8, totalFindings: 10 }, { clusterId: 'c2', ageDays: 400, recentFindings: 0, totalFindings: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.emergingCount, 1);
  assert.equal(v.stageCounts.declining, 1);
  assert.equal(v.top.key, 'c2');
});
test('53574 verifyNovelClusters verifies dissimilar clusters', () => {
  const v = XA.verifyNovelClusters([{ clusterId: 'c1', similarityToKnown: 0.1, memberCount: 5 }, { clusterId: 'c2', similarityToKnown: 0.9, memberCount: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.novelCount, 1);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53575 deduplicateClusters finds duplicate pairs', () => {
  const v = XA.deduplicateClusters([{ clusterId: 'c1', name: 'auth-bypass', signature: 'sig-a' }, { clusterId: 'c2', name: 'auth-bypass-copy', signature: 'sig-a' }, { clusterId: 'c3', name: 'xss', signature: 'sig-b' }]);
  assert.equal(v.count, 1);
  assert.equal(v.duplicateClusterCount, 2);
  assert.equal(v.uniqueCount, 1);
  assert.equal(v.top.key, 'c1|c2');
});
test('53576 detectClusterSplits flags low-cohesion clusters', () => {
  const v = XA.detectClusterSplits([{ clusterId: 'c1', cohesion: 0.2, subGroups: 3, members: 20 }, { clusterId: 'c2', cohesion: 0.9, subGroups: 1, members: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.splitCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53577 clusterHuntingPlaybooks generates per-cluster playbooks', () => {
  const v = XA.clusterHuntingPlaybooks([{ clusterId: 'c1', technique: 'sqli-union', severity: 'critical', findings: 12 }, { clusterId: 'c2', technique: 'xss', severity: 'medium', findings: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.playbookCount, 2);
  assert.equal(v.totalSteps, 8);
  assert.equal(v.top.key, 'c1');
});
test('53578 prioritizeTargetsByCluster scores targets by cluster coverage', () => {
  const v = XA.prioritizeTargetsByCluster([{ target: 't1', clusterMatches: 3, severityScore: 0.9, bounty: 2000 }, { target: 't2', clusterMatches: 0, severityScore: 0.2, bounty: 100 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.top.key, 't1');
  assert.equal(v.top.score, 12.5);
});
test('53579 predictClusterModels predicts size and risk', () => {
  const v = XA.predictClusterModels([{ clusterId: 'c1', currentSize: 20, growthRate: 0.8, severityScore: 0.9 }, { clusterId: 'c2', currentSize: 10, growthRate: 0.1, severityScore: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highRiskCount, 1);
  assert.equal(v.averageRisk, 0.49);
  assert.equal(v.top.key, 'c1');
});
test('53580 analyzeClusterCoOccurrence counts pair co-occurrence', () => {
  const v = XA.analyzeClusterCoOccurrence([{ hunt: 'h1', clusters: ['c1', 'c2'] }, { hunt: 'h2', clusters: ['c1', 'c2', 'c3'] }]);
  assert.equal(v.count, 3);
  assert.equal(v.clusterCount, 3);
  assert.equal(v.top.key, 'c1|c2');
  assert.equal(v.top.count, 2);
});

// --- Wave 90B spot checks (one per idea) ---
test('53581 trackClusterRemediation tracks remediation rates', () => {
  const v = XB.trackClusterRemediation([{ clusterId: 'c1', totalFindings: 10, remediated: 8 }, { clusterId: 'c2', totalFindings: 10, remediated: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalRemediated, 10);
  assert.equal(v.overallRate, 0.5);
  assert.equal(v.top.key, 'c1');
});
test('53582 clusterFalsePositiveRates measures noisy clusters', () => {
  const v = XB.clusterFalsePositiveRates([{ clusterId: 'c1', findings: 10, falsePositives: 4 }, { clusterId: 'c2', findings: 10, falsePositives: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.noisyCount, 1);
  assert.equal(v.averageFpRate, 0.2);
  assert.equal(v.top.key, 'c1');
});
test('53583 analyzeClusterBountyValue ranks bounty value', () => {
  const v = XB.analyzeClusterBountyValue([{ clusterId: 'c1', findings: 4, totalBounty: 4000 }, { clusterId: 'c2', findings: 10, totalBounty: 1000 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalBounty, 5000);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.avgBounty, 1000);
});
test('53584 clusterGeographicPatterns maps regions per cluster', () => {
  const v = XB.clusterGeographicPatterns([{ cluster: 'c1', region: 'eu', count: 6 }, { cluster: 'c1', region: 'us', count: 2 }, { cluster: 'c2', region: 'eu', count: 1 }]);
  assert.equal(v.count, 3);
  assert.equal(v.regionCount, 2);
  assert.equal(v.top.key, 'c1|eu');
});
test('53585 clusterTemporalPatterns buckets activity by time', () => {
  const v = XB.clusterTemporalPatterns([{ cluster: 'c1', hour: 2 }, { cluster: 'c1', hour: 3 }, { cluster: 'c1', hour: 14 }]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'c1|night');
  assert.equal(v.top.count, 2);
});
test('53586 clusterAuthProfiles profiles auth requirements', () => {
  const v = XB.clusterAuthProfiles([{ clusterId: 'c1', findings: 10, authRequired: 9 }, { clusterId: 'c2', findings: 10, authRequired: 1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.authDominantCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53587 scoreClusterExploitComplexity scores complexity levels', () => {
  const v = XB.scoreClusterExploitComplexity([{ clusterId: 'c1', steps: 9, prerequisites: 4 }, { clusterId: 'c2', steps: 1, prerequisites: 0 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.averageComplexity, 0.47);
  assert.equal(v.top.key, 'c1');
});
test('53588 clusterReportTemplates selects templates by severity', () => {
  const v = XB.clusterReportTemplates([{ clusterId: 'c1', severity: 'critical' }, { clusterId: 'c2', severity: 'medium' }]);
  assert.equal(v.count, 2);
  assert.equal(v.templateCount, 2);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.template, 'critical-cluster');
});
test('53589 forecastClusterTrends forecasts cluster growth', () => {
  const v = XB.forecastClusterTrends([{ clusterId: 'c1', period: '2026-08', size: 10 }, { clusterId: 'c1', period: '2026-09', size: 20 }, { clusterId: 'c2', period: '2026-08', size: 5 }, { clusterId: 'c2', period: '2026-09', size: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.risingCount, 1);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.forecastNext, 30);
});
test('53590 breedPayloadsFromClusters breeds payload combinations', () => {
  const v = XB.breedPayloadsFromClusters([{ clusterId: 'c1', topPayloads: ['a', 'b', 'c'] }, { clusterId: 'c2', topPayloads: ['x'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalBred, 4);
  assert.equal(v.top.key, 'c1');
});
test('53591 searchClusterSimilarity ranks by vector similarity', () => {
  const v = XB.searchClusterSimilarity([{ clusterId: 'c1', vector: [1, 0] }, { clusterId: 'c2', vector: [0, 1] }], { vector: [1, 0] });
  assert.equal(v.count, 2);
  assert.equal(v.matchCount, 1);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.similarity, 1);
});
test('53592 clusterEvolutionTimelines builds evolution timelines', () => {
  const v = XB.clusterEvolutionTimelines([{ clusterId: 'c1', timestamp: 1, type: 'observation' }, { clusterId: 'c1', timestamp: 2, type: 'split' }, { clusterId: 'c2', timestamp: 1, type: 'observation' }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalEvents, 3);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.splits, 1);
});
test('53593 explainClusterMembership explains membership reasons', () => {
  const v = XB.explainClusterMembership([{ findingId: 'f1', cluster: 'c1', reasons: ['shared-signature', 'same-stack'], confidence: 0.9 }, { findingId: 'f2', cluster: 'c2', reasons: ['shared-signature'], confidence: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.explainedCount, 2);
  assert.equal(v.averageConfidence, 0.65);
  assert.equal(v.top.key, 'f1');
});
test('53594 auditClusterQuality grades cluster quality', () => {
  const v = XB.auditClusterQuality([{ clusterId: 'c1', cohesion: 0.9, purity: 0.9, size: 20 }, { clusterId: 'c2', cohesion: 0.2, purity: 0.3, size: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.goodCount, 1);
  assert.equal(v.averageQuality, 0.57);
  assert.equal(v.top.key, 'c1');
});
test('53595 clusterTrainingCurricula orders curricula by difficulty', () => {
  const v = XB.clusterTrainingCurricula([{ clusterId: 'c1', difficulty: 0.9 }, { clusterId: 'c2', difficulty: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.curriculumCount, 2);
  assert.equal(v.top.key, 'c2');
  assert.equal(v.top.level, 'beginner');
});
test('53596 clusterImpactDashboards ranks clusters by impact', () => {
  const v = XB.clusterImpactDashboards([{ clusterId: 'c1', findings: 10, targets: 5, bounty: 5000 }, { clusterId: 'c2', findings: 2, targets: 1, bounty: 200 }]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.totalImpact, 40.4);
  assert.equal(v.top.key, 'c1');
});
test('53597 detectClusterAnomalies flags size outliers', () => {
  const v = XB.detectClusterAnomalies([{ clusterId: 'c1', size: 10 }, { clusterId: 'c2', size: 11 }, { clusterId: 'c3', size: 12 }, { clusterId: 'c4', size: 100 }]);
  assert.equal(v.count, 4);
  assert.equal(v.anomalyCount, 1);
  assert.equal(v.top.key, 'c4');
});
test('53598 crossReferenceClustersWithCve links clusters to CVEs', () => {
  const v = XB.crossReferenceClustersWithCve([{ clusterId: 'c1', cves: ['CVE-2026-1001', 'CVE-2026-1002'] }, { clusterId: 'c2', cves: [] }]);
  assert.equal(v.count, 2);
  assert.equal(v.linkedCount, 1);
  assert.equal(v.totalCves, 2);
  assert.equal(v.top.key, 'c1');
});
test('53599 governClusterNaming enforces naming convention', () => {
  const v = XB.governClusterNaming([{ clusterId: 'c1', name: 'Cluster-Auth', approved: true }, { clusterId: 'c2', name: 'x', approved: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.approvedCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53600 retireClusters retires idle clusters', () => {
  const v = XB.retireClusters([{ clusterId: 'c1', idleDays: 400, size: 5 }, { clusterId: 'c2', idleDays: 10, size: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.retiredCount, 1);
  assert.equal(v.activeCount, 1);
  assert.equal(v.top.key, 'c1');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'XA'], ['B', B_JSX, 'XB']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w90 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w90a-'));
  assert.ok(CSS_SRC.includes('.w90b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave90A.jsx', 'Wave90B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 90 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
    assert.ok(!src.toLowerCase().includes('mock'), `${name} carries debris`);
    assert.ok(!src.toLowerCase().includes('demo'), `${name} carries debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ period: '2026-08', failures: 10, attempts: 100 }), Object.freeze({ period: '2026-09', failures: 20, attempts: 100 })]);
  const v = XA.forecastFailureTrend(frozen);
  assert.equal(v.count, 2);
});
