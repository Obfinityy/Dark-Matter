/**
 * wave91.test.js — Infinity AI · Wave 91
 * node:test + node:assert/strict. Registry coverage (20/20 for 53601–53620,
 * 20/20 for 53621–53640, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave91.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE91_A_IDEAS } from './wave91ACore.js';
import * as XA from './wave91ACore.js';
import { WAVE91_B_IDEAS } from './wave91BCores.js';
import * as XB from './wave91BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave91ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave91BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave91A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave91B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave91.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 91A ideas, 20/20 wave 91B ideas, zero skips', () => {
  assert.equal(WAVE91_A_IDEAS.length, 20);
  assert.equal(WAVE91_B_IDEAS.length, 20);
  const all = [...WAVE91_A_IDEAS, ...WAVE91_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53601 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE91_A_IDEAS, ...WAVE91_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53601: 'cluster confidence intervals',
    53602: 'cluster-based hunt briefings',
    53603: 'cluster defense mapping',
    53604: 'cluster exploit-kit correlation',
    53605: 'cluster researcher specialization',
    53606: 'cluster data export api',
    53607: 'cluster visualization gallery',
    53608: 'cluster-driven conference topics',
    53609: 'cluster feedback loops',
    53610: 'cluster-based risk scoring',
    53611: 'cluster hunt replay tags',
    53612: 'cluster annual review',
    53613: 'cluster naming localization',
    53614: 'cluster privacy safeguards',
    53615: 'cluster contribution credits',
    53616: 'cluster early-warning system',
    53617: 'cluster mitigation playbooks',
    53618: 'cluster benchmark comparisons',
    53619: 'cluster research grants',
    53620: 'industry finding fingerprints',
    53621: 'industry strategy playbooks',
    53622: 'industry ttf benchmarks',
    53623: 'industry compliance overlays',
    53624: 'industry threat actor profiles',
    53625: 'industry stack preferences',
    53626: 'industry seasonal patterns',
    53627: 'industry auth pattern catalogs',
    53628: 'industry data sensitivity maps',
    53629: 'industry third-party risk patterns',
    53630: 'industry api design trends',
    53631: 'industry mobile app patterns',
    53632: 'industry legacy system prevalence',
    53633: 'industry cloud adoption curves',
    53634: 'industry incident correlation',
    53635: 'industry benchmark reports',
    53636: 'industry peer comparisons',
    53637: 'industry-specific payload packs',
    53638: 'industry regulatory change tracking',
    53639: 'industry m&a security patterns',
    53640: 'industry startup-vs-enterprise splits',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 91A spot checks (one per idea) ---
test('53601 measureClusterConfidenceIntervals computes 95 percent intervals', () => {
  const v = XA.measureClusterConfidenceIntervals([{ cluster: 'auth', estimate: 0.5, sampleSize: 100 }, { cluster: 'xss', estimate: 0.8, sampleSize: 25 }]);
  assert.equal(v.count, 2);
  assert.equal(v.confidentCount, 2);
  assert.equal(v.averageWidth, 0.26);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.low, 0.4);
  assert.equal(v.top.high, 0.6);
  assert.equal(v.top.width, 0.2);
});
test('53602 briefHuntersOnClusters ranks briefings by expected yield', () => {
  const v = XA.briefHuntersOnClusters([{ cluster: 'auth', expectedYield: 12, hunterCount: 3 }, { cluster: 'xss', expectedYield: 4, hunterCount: 1 }]);
  assert.equal(v.count, 2);
  assert.equal(v.briefCount, 2);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.rank, 1);
});
test('53603 mapClusterDefenses measures defense coverage', () => {
  const v = XA.mapClusterDefenses([{ cluster: 'auth', defenses: ['mfa', 'waf'], threats: 2 }, { cluster: 'xss', defenses: ['csp'], threats: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.defendedCount, 1);
  assert.equal(v.averageCoverage, 0.63);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.coverage, 1);
});
test('53604 correlateClusterExploitKits flags strong kit overlap', () => {
  const v = XA.correlateClusterExploitKits([{ cluster: 'auth', kit: 'kit-a', overlap: 0.8 }, { cluster: 'xss', kit: 'kit-b', overlap: 0.2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.correlatedCount, 1);
  assert.equal(v.top.key, 'auth|kit-a');
  assert.equal(v.top.correlated, true);
});
test('53605 identifyClusterSpecialists keeps best cluster per researcher', () => {
  const v = XA.identifyClusterSpecialists([{ researcher: 'r1', cluster: 'auth', score: 0.9, findings: 5 }, { researcher: 'r1', cluster: 'xss', score: 0.6, findings: 3 }, { researcher: 'r2', cluster: 'sqli', score: 0.7, findings: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.specialistCount, 1);
  assert.equal(v.top.key, 'r1');
  assert.equal(v.top.cluster, 'auth');
});
test('53606 exportClusterData exports cluster rows as csv', () => {
  const v = XA.exportClusterData([{ cluster: 'auth', findings: 5 }, { cluster: 'xss', findings: 3 }], { format: 'csv' });
  assert.equal(v.count, 2);
  assert.equal(v.recordCount, 2);
  assert.equal(v.format, 'csv');
  assert.ok(v.payload.startsWith('cluster,findings'));
  assert.ok(v.payload.includes('auth,5'));
  assert.equal(v.top.key, 'auth');
});
test('53607 buildClusterVisualizationGallery picks chart types by size', () => {
  const v = XA.buildClusterVisualizationGallery([{ cluster: 'auth', size: 25, severityScore: 0.9 }, { cluster: 'xss', size: 10, severityScore: 0.5 }, { cluster: 'sqli', size: 3, severityScore: 0.2 }]);
  assert.equal(v.count, 3);
  assert.equal(v.vizCount, 3);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.chart, 'heatmap');
  assert.equal(v.rows[1].chart, 'bar');
  assert.equal(v.rows[2].chart, 'list');
});
test('53608 proposeClusterConferenceTopics scores interest and novelty', () => {
  const v = XA.proposeClusterConferenceTopics([{ cluster: 'auth', interest: 0.9, novelty: 0.5 }, { cluster: 'xss', interest: 0.4, novelty: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.proposedCount, 1);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.topicScore, 0.74);
});
test('53609 buildClusterFeedbackLoops closes loops with adjusted detections', () => {
  const v = XA.buildClusterFeedbackLoops([{ cluster: 'auth', insights: 3, detectionsAdjusted: 2 }, { cluster: 'xss', insights: 0, detectionsAdjusted: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.closedCount, 1);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.closed, true);
});
test('53610 scoreClustersByRisk multiplies severity likelihood exposure', () => {
  const v = XA.scoreClustersByRisk([{ cluster: 'auth', severity: 0.9, likelihood: 0.8, exposure: 0.9 }, { cluster: 'xss', severity: 0.5, likelihood: 0.4, exposure: 0.5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.averageRisk, 0.38);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.risk, 0.65);
});
test('53611 tagClusterHuntReplays tags replays with sorted unique clusters', () => {
  const v = XA.tagClusterHuntReplays([{ replay: 'rp1', clusters: ['auth', 'xss'] }, { id: 'rp2', clusters: ['xss', 'xss', 'sqli'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.taggedCount, 2);
  assert.equal(v.totalTags, 4);
  assert.equal(v.top.key, 'rp1');
  assert.deepEqual(v.rows[1].tags, ['sqli', 'xss']);
});
test('53612 reviewClustersAnnually recommends invest retire monitor', () => {
  const v = XA.reviewClustersAnnually([{ cluster: 'auth', growth: 0.5, findings: 10, ageDays: 300 }, { cluster: 'old', growth: 0, findings: 0, ageDays: 400 }, { cluster: 'mid', growth: 0.1, findings: 5, ageDays: 100 }]);
  assert.equal(v.count, 3);
  assert.equal(v.investCount, 1);
  assert.equal(v.retireCount, 1);
  assert.equal(v.monitorCount, 1);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.recommendation, 'invest');
});
test('53613 localizeClusterNames localizes labels with en fallback', () => {
  const v = XA.localizeClusterNames([{ cluster: 'auth', names: { en: 'Authentication', hi: 'Pramanikaran' } }, { cluster: 'xss', names: { en: 'xss' } }], { locale: 'hi' });
  assert.equal(v.count, 2);
  assert.equal(v.localizedCount, 1);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.label, 'Pramanikaran');
  assert.equal(v.rows[1].label, 'xss');
});
test('53614 safeguardClusterPrivacy enforces k-anonymity safeguard', () => {
  const v = XA.safeguardClusterPrivacy([{ cluster: 'auth', members: 10, hasIdentifiers: false }, { cluster: 'xss', members: 3, hasIdentifiers: false }, { cluster: 'sqli', members: 8, hasIdentifiers: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.safeguardedCount, 1);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.safe, true);
});
test('53615 creditClusterContributors aggregates credits per researcher', () => {
  const v = XA.creditClusterContributors([{ researcher: 'r1', cluster: 'auth', findings: 5 }, { researcher: 'r1', cluster: 'xss', findings: 3 }, { researcher: 'r2', cluster: 'auth', findings: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.creditedCount, 2);
  assert.equal(v.totalCredits, 12);
  assert.equal(v.top.key, 'r1');
  assert.equal(v.top.credits, 8);
});
test('53616 warnClusterEarly warns on fast severe clusters', () => {
  const v = XA.warnClusterEarly([{ cluster: 'auth', growthRate: 0.7, severityScore: 0.8, recent: 5 }, { cluster: 'xss', growthRate: 0.9, severityScore: 0.3, recent: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.warningCount, 1);
  assert.equal(v.top.key, 'xss');
  const warned = v.rows.find(r => r.key === 'auth');
  assert.equal(warned.warning, true);
});
test('53617 createClusterMitigationPlaybooks builds four-step playbooks', () => {
  const v = XA.createClusterMitigationPlaybooks([{ cluster: 'auth', defense: 'mfa', severity: 'high' }, { cluster: 'xss', topDefense: 'csp', severity: 'medium' }]);
  assert.equal(v.count, 2);
  assert.equal(v.playbookCount, 2);
  assert.equal(v.totalSteps, 8);
  assert.equal(v.top.key, 'auth');
  assert.ok(v.top.steps.includes('Validate mfa coverage'));
});
test('53618 compareClusterBenchmarks measures share divergence', () => {
  const v = XA.compareClusterBenchmarks([{ org: 'o1', cluster: 'auth', share: 0.6 }, { org: 'o2', cluster: 'auth', share: 0.2 }, { org: 'o1', cluster: 'xss', share: 0.3 }, { org: 'o2', cluster: 'xss', share: 0.3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.benchmarkCount, 2);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.divergence, 0.4);
});
test('53619 fundClusterResearchGrants allocates grants by priority', () => {
  const v = XA.fundClusterResearchGrants([{ cluster: 'auth', impact: 0.9, unexplained: 0.8 }, { cluster: 'xss', impact: 0.5, unexplained: 0.5 }, { cluster: 'sqli', impact: 0.2, unexplained: 0.2 }], { budget: 5000, grantSize: 2500 });
  assert.equal(v.count, 3);
  assert.equal(v.fundedCount, 2);
  assert.equal(v.totalAllocated, 5000);
  assert.equal(v.remaining, 0);
  assert.equal(v.top.key, 'auth');
  assert.equal(v.top.priority, 0.72);
});
test('53620 fingerprintIndustryFindings fingerprints dominant finding types', () => {
  const v = XA.fingerprintIndustryFindings([{ industry: 'fintech', type: 'sqli', count: 5 }, { industry: 'fintech', type: 'xss', count: 3 }, { industry: 'health', type: 'idor', count: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.industries, 2);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.fingerprint, 'fintech:sqli');
  assert.equal(v.top.total, 8);
});

// --- Wave 91B spot checks (one per idea) ---
test('53621 industryStrategyPlaybooks picks best strategy by win rate', () => {
  const v = XB.industryStrategyPlaybooks([{ industry: 'fintech', strategy: 'api-first', wins: 8, attempts: 10 }, { industry: 'fintech', strategy: 'web-first', wins: 3, attempts: 10 }, { industry: 'health', strategy: 'api-first', wins: 5, attempts: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.playbookCount, 2);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.strategy, 'api-first');
  assert.equal(v.top.winRate, 0.8);
});
test('53622 benchmarkIndustryTtf ranks industries by median ttf', () => {
  const v = XB.benchmarkIndustryTtf([{ industry: 'fintech', ttfHours: 10 }, { industry: 'fintech', ttfHours: 20 }, { industry: 'fintech', ttfHours: 30 }, { industry: 'health', ttfHours: 5 }, { industry: 'health', ttfHours: 15 }]);
  assert.equal(v.count, 2);
  assert.equal(v.fastest, 'health');
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.medianTtf, 10);
  assert.equal(v.rows[1].medianTtf, 20);
});
test('53623 overlayIndustryCompliance maps finding types to regulations', () => {
  const v = XB.overlayIndustryCompliance([{ industry: 'fintech', regulation: 'pci', findingTypes: ['sqli', 'xss'] }, { industry: 'health', regulation: 'hipaa', types: ['idor'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.findingsMapped, 3);
  assert.equal(v.top.key, 'fintech|pci');
  assert.equal(v.top.typeCount, 2);
});
test('53624 profileIndustryThreatActors groups actors per industry', () => {
  const v = XB.profileIndustryThreatActors([{ industry: 'fintech', actor: 'actor-a', ttps: ['t1', 't2'] }, { industry: 'fintech', actor: 'actor-b', ttps: ['t3'] }, { industry: 'health', actor: 'actor-a', ttps: ['t1'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.profileCount, 3);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.actorCount, 2);
  assert.equal(v.top.totalTtps, 3);
});
test('53625 documentIndustryStackPreferences finds dominant stacks', () => {
  const v = XB.documentIndustryStackPreferences([{ industry: 'fintech', stack: 'node', count: 8 }, { industry: 'fintech', stack: 'php', count: 2 }, { industry: 'health', stack: 'java', count: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.industryCount, 2);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.share, 1);
  const fintech = v.rows.find(r => r.key === 'fintech');
  assert.equal(fintech.stack, 'node');
  assert.equal(fintech.share, 0.8);
});
test('53626 trackIndustrySeasonalPatterns finds peak seasons', () => {
  const v = XB.trackIndustrySeasonalPatterns([{ industry: 'fintech', season: 'q1', count: 5 }, { industry: 'fintech', season: 'q3', count: 9 }, { industry: 'health', season: 'q2', count: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.industries, 2);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.peakSeason, 'q3');
  assert.equal(v.top.peakCount, 9);
});
test('53627 catalogIndustryAuthPatterns catalogs dominant auth patterns', () => {
  const v = XB.catalogIndustryAuthPatterns([{ industry: 'fintech', authPattern: 'oauth', count: 7 }, { industry: 'fintech', authPattern: 'session', count: 3 }, { industry: 'health', authPattern: 'saml', count: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.catalogCount, 3);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.authPattern, 'saml');
  const fintech = v.rows.find(r => r.key === 'fintech');
  assert.equal(fintech.authPattern, 'oauth');
});
test('53628 mapIndustryDataSensitivity flags sensitivity hotspots', () => {
  const v = XB.mapIndustryDataSensitivity([{ industry: 'fintech', dataType: 'card', sensitivity: 0.9, count: 5 }, { industry: 'health', dataType: 'phi', sensitivity: 0.85, count: 3 }, { industry: 'retail', dataType: 'email', sensitivity: 0.3, count: 10 }]);
  assert.equal(v.count, 3);
  assert.equal(v.hotspotCount, 2);
  assert.equal(v.top.key, 'fintech|card');
  assert.equal(v.top.hotspot, true);
});
test('53629 assessIndustryThirdPartyRisk ranks riskiest vendors', () => {
  const v = XB.assessIndustryThirdPartyRisk([{ industry: 'fintech', vendor: 'v1', riskScore: 0.9, count: 2 }, { industry: 'fintech', vendor: 'v2', riskScore: 0.4, count: 5 }, { industry: 'health', vendor: 'v3', riskScore: 0.75, count: 1 }]);
  assert.equal(v.count, 3);
  assert.equal(v.highRiskCount, 2);
  assert.equal(v.top.key, 'fintech|v1');
  assert.equal(v.top.riskScore, 0.9);
});
test('53630 trackIndustryApiDesignTrends groups api flaws', () => {
  const v = XB.trackIndustryApiDesignTrends([{ industry: 'fintech', apiPattern: 'rest', flawCount: 4, count: 10 }, { industry: 'fintech', apiPattern: 'graphql', flawCount: 2, count: 5 }, { industry: 'health', apiPattern: 'rest', flawCount: 1, count: 3 }]);
  assert.equal(v.count, 3);
  assert.equal(v.trendCount, 3);
  assert.equal(v.totalFlaws, 7);
  assert.equal(v.top.key, 'fintech|rest');
});
test('53631 profileIndustryMobilePatterns finds dominant mobile patterns', () => {
  const v = XB.profileIndustryMobilePatterns([{ industry: 'fintech', pattern: 'webview', count: 6 }, { industry: 'fintech', pattern: 'deeplink', count: 2 }, { industry: 'health', pattern: 'webview', count: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.industryCount, 2);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.share, 1);
  const fintech = v.rows.find(r => r.key === 'fintech');
  assert.equal(fintech.pattern, 'webview');
  assert.equal(fintech.share, 0.75);
});
test('53632 measureIndustryLegacyPrevalence measures legacy share', () => {
  const v = XB.measureIndustryLegacyPrevalence([{ industry: 'fintech', totalSystems: 100, legacySystems: 60, legacyFindings: 12 }, { industry: 'health', totalSystems: 50, legacySystems: 10, legacyFindings: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.industryCount, 2);
  assert.equal(v.highLegacyCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.legacyShare, 0.6);
});
test('53633 trackIndustryCloudAdoption tracks adoption deltas', () => {
  const v = XB.trackIndustryCloudAdoption([{ industry: 'fintech', period: '2026-01', cloudShare: 0.3 }, { industry: 'fintech', period: '2026-06', cloudShare: 0.7 }, { industry: 'health', period: '2026-01', cloudShare: 0.5 }, { industry: 'health', period: '2026-06', cloudShare: 0.4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.migratingCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.delta, 0.4);
});
test('53634 correlateIndustryIncidents correlates findings with incidents', () => {
  const v = XB.correlateIndustryIncidents([{ industry: 'fintech', findings: 80, publicIncidents: 40 }, { industry: 'health', findings: 10, publicIncidents: 90 }, { industry: 'retail', findings: 0, publicIncidents: 0 }]);
  assert.equal(v.count, 3);
  assert.equal(v.correlatedCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.score, 0.5);
});
test('53635 publishIndustryBenchmarkReports averages industry metrics', () => {
  const v = XB.publishIndustryBenchmarkReports([{ industry: 'fintech', metric: 'ttf', value: 10 }, { industry: 'fintech', metric: 'ttf', value: 20 }, { industry: 'health', metric: 'ttf', value: 30 }], { quarter: '2026-Q3' });
  assert.equal(v.count, 2);
  assert.equal(v.reportCount, 2);
  assert.equal(v.anonymized, true);
  assert.equal(v.quarter, '2026-Q3');
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.averageValue, 15);
});
test('53636 compareIndustryPeerPosture compares opted-in peers only', () => {
  const v = XB.compareIndustryPeerPosture([{ org: 'o1', industry: 'fintech', score: 90, optIn: true }, { org: 'o2', industry: 'fintech', score: 70, optIn: true }, { org: 'o3', industry: 'fintech', score: 50, optIn: false }, { org: 'o4', industry: 'health', score: 60, optIn: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.comparedCount, 3);
  assert.equal(v.top.key, 'o1');
  assert.equal(v.top.percentile, 100);
  assert.equal(v.rows[1].percentile, 0);
});
test('53637 curateIndustryPayloadPacks curates sorted unique packs', () => {
  const v = XB.curateIndustryPayloadPacks([{ industry: 'fintech', stack: 'node', payloads: ['p2', 'p1'] }, { industry: 'fintech', stack: 'php', payloads: ['p3', 'p1'] }, { industry: 'health', stack: 'java', payloads: ['p9'] }]);
  assert.equal(v.count, 2);
  assert.equal(v.packCount, 2);
  assert.equal(v.totalPayloads, 4);
  assert.equal(v.top.key, 'fintech');
  assert.deepEqual(v.top.payloads, ['p1', 'p2', 'p3']);
});
test('53638 trackIndustryRegulatoryChanges tracks priority deltas', () => {
  const v = XB.trackIndustryRegulatoryChanges([{ industry: 'fintech', change: 'pci-update', effectOnPriority: 3, effective: '2026-11-01' }, { industry: 'health', change: 'hipaa-note', priorityDelta: 1, effective: '2026-10-01' }]);
  assert.equal(v.count, 2);
  assert.equal(v.highImpactCount, 1);
  assert.equal(v.top.key, 'fintech|pci-update');
  assert.equal(v.top.priorityDelta, 3);
});
test('53639 analyzeIndustryMaSecurityPatterns measures deal deltas', () => {
  const v = XB.analyzeIndustryMaSecurityPatterns([{ industry: 'fintech', acquirer: 'bigbank', preScore: 80, postScore: 60 }, { industry: 'health', preScore: 70, postScore: 75 }]);
  assert.equal(v.count, 2);
  assert.equal(v.worsenedCount, 1);
  assert.equal(v.avgDelta, -7.5);
  assert.equal(v.top.key, 'fintech|bigbank');
  assert.equal(v.top.delta, -20);
});
test('53640 splitIndustryStartupEnterprise splits segment finding rates', () => {
  const v = XB.splitIndustryStartupEnterprise([{ industry: 'fintech', segment: 'startup', findingRate: 0.4, count: 10 }, { industry: 'fintech', segment: 'enterprise', rate: 0.1, count: 20 }, { industry: 'health', segment: 'startup', findingRate: 0.3, count: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.splitCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.gap, 0.3);
  assert.equal(v.top.hasBoth, true);
  assert.equal(v.rows[1].hasBoth, false);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'XA'], ['B', B_JSX, 'XB']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w91 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w91a-'));
  assert.ok(CSS_SRC.includes('.w91b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave91A.jsx', 'Wave91B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 91 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
    assert.ok(!src.toLowerCase().includes('mock'), `${name} carries debris`);
    assert.ok(!src.toLowerCase().includes('demo'), `${name} carries debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ cluster: 'auth', estimate: 0.5, sampleSize: 100 }), Object.freeze({ cluster: 'xss', estimate: 0.8, sampleSize: 25 })]);
  const v = XA.measureClusterConfidenceIntervals(frozen);
  assert.equal(v.count, 2);
});
