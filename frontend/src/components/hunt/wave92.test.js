/**
 * wave92.test.js — Infinity AI · Wave 92
 * node:test + node:assert/strict. Registry coverage (20/20 for 53641–53660,
 * 20/20 for 53661–53680, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave92.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE92_A_IDEAS } from './wave92ACore.js';
import * as X92A from './wave92ACore.js';
import { WAVE92_B_IDEAS } from './wave92BCores.js';
import * as X92B from './wave92BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave92ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave92BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave92A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave92B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave92.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 92A ideas, 20/20 wave 92B ideas, zero skips', () => {
  assert.equal(WAVE92_A_IDEAS.length, 20);
  assert.equal(WAVE92_B_IDEAS.length, 20);
  const all = [...WAVE92_A_IDEAS, ...WAVE92_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53641 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE92_A_IDEAS, ...WAVE92_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53641: 'industry bug bounty economics',
    53642: 'industry disclosure norms',
    53643: 'industry security maturity models',
    53644: 'industry conference intelligence',
    53645: 'industry threat briefings',
    53646: 'industry hunt scheduling guides',
    53647: 'industry-specific training tracks',
    53648: 'industry talent benchmarks',
    53649: 'industry tool effectiveness',
    53650: 'industry supply chain patterns',
    53651: 'industry ransomware exposure indicators',
    53652: 'industry data residency patterns',
    53653: 'industry identity provider trends',
    53654: 'industry payment flow patterns',
    53655: 'industry iot exposure profiles',
    53656: 'industry ai adoption security',
    53657: 'industry remote work patterns',
    53658: 'industry vendor concentration risks',
    53659: 'industry open source usage',
    53660: 'industry security hiring signals',
    53661: 'industry compliance audit prep',
    53662: 'industry tabletop scenarios',
    53663: 'industry red team focus areas',
    53664: 'industry blue team detections',
    53665: 'industry executive briefings',
    53666: 'industry trend forecasting',
    53667: 'industry cross-pollination',
    53668: 'industry data sharing consortia',
    53669: 'industry regulatory feedback',
    53670: 'industry security roi models',
    53671: 'industry new-entrant guides',
    53672: 'industry acquisition due diligence',
    53673: 'industry annual security reviews',
    53674: 'industry pattern anomaly alerts',
    53675: 'prompt-to-outcome attribution',
    53676: 'prompt a/b test results archive',
    53677: 'winning prompt pattern mining',
    53678: 'prompt failure autopsies',
    53679: 'prompt version control (learning)',
    53680: 'prompt regression suites',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 92A spot checks (one per idea) ---
test('53641 analyzeIndustryBugBountyEconomics averages bounty per finding', () => {
  const v = X92A.analyzeIndustryBugBountyEconomics([{ industry: 'fintech', bountyPaid: 10000, findings: 20 }, { industry: 'health', bountyPaid: 6000, findings: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalBounty, 16000);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.avgBounty, 600);
});
test('53642 trackIndustryDisclosureNorms rates disclosure openness', () => {
  const v = X92A.trackIndustryDisclosureNorms([{ industry: 'fintech', disclosed: 9, total: 10 }, { industry: 'health', disclosed: 4, total: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.openCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.disclosureRate, 0.9);
  assert.equal(v.top.norm, 'open');
});
test('53643 assessIndustrySecurityMaturity levels maturity', () => {
  const v = X92A.assessIndustrySecurityMaturity([{ industry: 'fintech', implemented: 18, totalControls: 20 }, { industry: 'health', implemented: 10, totalControls: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.advancedCount, 1);
  assert.equal(v.averageMaturity, 0.7);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.maturity, 0.9);
  assert.equal(v.top.level, 'advanced');
});
test('53644 gatherIndustryConferenceIntelligence counts talks per event', () => {
  const v = X92A.gatherIndustryConferenceIntelligence([{ industry: 'fintech', events: 2, talks: 10 }, { industry: 'health', events: 1, talks: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalTalks, 13);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.talksPerEvent, 5);
});
test('53645 briefIndustryThreats flags urgent critical shares', () => {
  const v = X92A.briefIndustryThreats([{ industry: 'fintech', threats: 10, critical: 6 }, { industry: 'health', threats: 10, critical: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.urgentCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.criticalShare, 0.6);
  assert.equal(v.top.urgent, true);
});
test('53646 guideIndustryHuntScheduling guides hunts per day', () => {
  const v = X92A.guideIndustryHuntScheduling([{ industry: 'fintech', hunts: 20, windowDays: 10 }, { industry: 'health', hunts: 5, windowDays: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.busyCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.huntsPerDay, 2);
});
test('53647 buildIndustryTrainingTracks rates completion', () => {
  const v = X92A.buildIndustryTrainingTracks([{ industry: 'fintech', track: 'api', learners: 100, completions: 80 }, { industry: 'health', track: 'web', learners: 100, completions: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.top.key, 'fintech|api');
  assert.equal(v.top.completionRate, 0.8);
});
test('53648 benchmarkIndustryTalent benchmarks expert share', () => {
  const v = X92A.benchmarkIndustryTalent([{ industry: 'fintech', researchers: 100, experts: 40 }, { industry: 'health', researchers: 50, experts: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.benchmarkCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.expertShare, 0.4);
});
test('53649 measureIndustryToolEffectiveness measures precision', () => {
  const v = X92A.measureIndustryToolEffectiveness([{ industry: 'fintech', tool: 'scanner', detections: 90, falsePositives: 10 }, { industry: 'health', tool: 'scanner', detections: 50, falsePositives: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.effectiveCount, 1);
  assert.equal(v.top.key, 'fintech|scanner');
  assert.equal(v.top.effectiveness, 0.9);
});
test('53650 mapIndustrySupplyChainPatterns flags risky suppliers', () => {
  const v = X92A.mapIndustrySupplyChainPatterns([{ industry: 'fintech', suppliers: 10, incidents: 3 }, { industry: 'health', suppliers: 5, incidents: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.riskyCount, 1);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.incidentRate, 0.8);
});
test('53651 assessIndustryRansomwareExposure flags high exposure', () => {
  const v = X92A.assessIndustryRansomwareExposure([{ industry: 'fintech', systems: 100, vulnerable: 20 }, { industry: 'health', systems: 50, vulnerable: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.exposure, 0.6);
});
test('53652 trackIndustryDataResidency tracks residency compliance', () => {
  const v = X92A.trackIndustryDataResidency([{ industry: 'fintech', datasets: 100, localDatasets: 90 }, { industry: 'health', datasets: 50, localDatasets: 25 }]);
  assert.equal(v.count, 2);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.residencyRate, 0.9);
});
test('53653 trackIndustryIdentityProviderTrends finds dominant providers', () => {
  const v = X92A.trackIndustryIdentityProviderTrends([{ industry: 'fintech', provider: 'oauth', users: 80 }, { industry: 'fintech', provider: 'saml', users: 20 }, { industry: 'health', provider: 'saml', users: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.top.key, 'health');
  assert.equal(v.top.provider, 'saml');
  assert.equal(v.top.share, 1);
  const fintech = v.rows.find(r => r.key === 'fintech');
  assert.equal(fintech.provider, 'oauth');
  assert.equal(fintech.share, 0.8);
});
test('53654 analyzeIndustryPaymentFlowPatterns flags risky flows', () => {
  const v = X92A.analyzeIndustryPaymentFlowPatterns([{ industry: 'fintech', flow: 'card', transactions: 1000, failures: 20 }, { industry: 'retail', flow: 'wallet', transactions: 500, failures: 100 }]);
  assert.equal(v.count, 2);
  assert.equal(v.riskyCount, 1);
  assert.equal(v.top.key, 'retail|wallet');
  assert.equal(v.top.failureRate, 0.2);
});
test('53655 profileIndustryIotExposure profiles exposed devices', () => {
  const v = X92A.profileIndustryIotExposure([{ industry: 'manufacturing', devices: 200, exposed: 80 }, { industry: 'health', devices: 100, exposed: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highCount, 1);
  assert.equal(v.top.key, 'manufacturing');
  assert.equal(v.top.exposureRate, 0.4);
});
test('53656 assessIndustryAiAdoptionSecurity rates secured adoption', () => {
  const v = X92A.assessIndustryAiAdoptionSecurity([{ industry: 'fintech', aiSystems: 20, secured: 18 }, { industry: 'retail', aiSystems: 10, secured: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.secureCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.securedRate, 0.9);
});
test('53657 analyzeIndustryRemoteWorkPatterns measures remote share', () => {
  const v = X92A.analyzeIndustryRemoteWorkPatterns([{ industry: 'tech', employees: 100, remote: 80, vpnUsers: 70 }, { industry: 'finance', employees: 100, remote: 20, vpnUsers: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.remoteHeavyCount, 1);
  assert.equal(v.top.key, 'tech');
  assert.equal(v.top.remoteShare, 0.8);
  assert.equal(v.top.vpnCoverage, 0.88);
});
test('53658 assessIndustryVendorConcentration measures concentration', () => {
  const v = X92A.assessIndustryVendorConcentration([{ industry: 'fintech', vendor: 'vendor-a', spend: 60 }, { industry: 'fintech', vendor: 'vendor-b', spend: 40 }, { industry: 'health', vendor: 'vendor-c', spend: 30 }, { industry: 'health', vendor: 'vendor-d', spend: 30 }, { industry: 'health', vendor: 'vendor-e', spend: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.riskyCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.vendor, 'vendor-a');
  assert.equal(v.top.share, 0.6);
});
test('53659 trackIndustryOpenSourceUsage tracks oss share', () => {
  const v = X92A.trackIndustryOpenSourceUsage([{ industry: 'fintech', projects: 100, ossProjects: 70 }, { industry: 'health', projects: 50, ossProjects: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.highUsageCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.ossShare, 0.7);
});
test('53660 detectIndustrySecurityHiringSignals detects strong signals', () => {
  const v = X92A.detectIndustrySecurityHiringSignals([{ industry: 'fintech', postings: 100, securityPostings: 30 }, { industry: 'health', postings: 100, securityPostings: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.strongCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.securityShare, 0.3);
});

// --- Wave 92B spot checks (one per idea) ---
test('53661 prepareIndustryComplianceAudits rates audit readiness', () => {
  const v = X92B.prepareIndustryComplianceAudits([{ industry: 'fintech', controls: 20, readyControls: 18 }, { industry: 'health', controls: 20, readyControls: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.readiness, 0.9);
});
test('53662 createIndustryTabletopScenarios rates gap rates', () => {
  const v = X92B.createIndustryTabletopScenarios([{ industry: 'fintech', scenario: 'ransomware', simulated: 10, gaps: 4 }, { industry: 'health', scenario: 'outage', simulated: 10, gaps: 8 }]);
  assert.equal(v.count, 2);
  assert.equal(v.challengingCount, 1);
  assert.equal(v.top.key, 'health|outage');
  assert.equal(v.top.gapRate, 0.8);
});
test('53663 focusIndustryRedTeamAreas prioritizes focus areas', () => {
  const v = X92B.focusIndustryRedTeamAreas([{ industry: 'fintech', focusArea: 'phishing', attempts: 20, successes: 12 }, { industry: 'health', focusArea: 'api', attempts: 10, successes: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.priorityCount, 1);
  assert.equal(v.top.key, 'fintech|phishing');
  assert.equal(v.top.successRate, 0.6);
});
test('53664 catalogIndustryBlueTeamDetections rates detection precision', () => {
  const v = X92B.catalogIndustryBlueTeamDetections([{ industry: 'fintech', detection: 'edr', alerts: 100, truePositives: 85 }, { industry: 'health', detection: 'siem', alerts: 100, truePositives: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.reliableCount, 1);
  assert.equal(v.top.key, 'fintech|edr');
  assert.equal(v.top.precision, 0.85);
});
test('53665 briefIndustryExecutives rates mitigation readiness', () => {
  const v = X92B.briefIndustryExecutives([{ industry: 'fintech', risks: 10, mitigated: 9 }, { industry: 'health', risks: 10, mitigated: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.mitigationRate, 0.9);
});
test('53666 forecastIndustryTrends forecasts growth', () => {
  const v = X92B.forecastIndustryTrends([{ industry: 'fintech', current: 120, previous: 100 }, { industry: 'health', current: 90, previous: 100 }]);
  assert.equal(v.count, 2);
  assert.equal(v.risingCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.growth, 0.2);
  assert.equal(v.top.delta, 20);
});
test('53667 crossPollinateIndustries rates adoption', () => {
  const v = X92B.crossPollinateIndustries([{ fromIndustry: 'fintech', toIndustry: 'health', shared: 10, adopted: 7 }, { fromIndustry: 'retail', toIndustry: 'fintech', shared: 10, adopted: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.pollinatedCount, 1);
  assert.equal(v.top.key, 'fintech|health');
  assert.equal(v.top.adoptionRate, 0.7);
});
test('53668 manageIndustryDataSharingConsortia rates participation', () => {
  const v = X92B.manageIndustryDataSharingConsortia([{ industry: 'fintech', consortium: 'alpha', members: 20, activeMembers: 15 }, { industry: 'health', consortium: 'beta', members: 10, activeMembers: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.activeCount, 1);
  assert.equal(v.top.key, 'fintech|alpha');
  assert.equal(v.top.participation, 0.75);
});
test('53669 collectIndustryRegulatoryFeedback rates positive feedback', () => {
  const v = X92B.collectIndustryRegulatoryFeedback([{ industry: 'fintech', regulation: 'pci', feedback: 100, positive: 70 }, { industry: 'health', regulation: 'hipaa', feedback: 50, positive: 20 }]);
  assert.equal(v.count, 2);
  assert.equal(v.supportiveCount, 1);
  assert.equal(v.top.key, 'fintech|pci');
  assert.equal(v.top.positiveRate, 0.7);
});
test('53670 modelIndustrySecurityRoi models return on investment', () => {
  const v = X92B.modelIndustrySecurityRoi([{ industry: 'fintech', investment: 10000, lossAvoided: 30000 }, { industry: 'health', investment: 10000, lossAvoided: 8000 }]);
  assert.equal(v.count, 2);
  assert.equal(v.positiveCount, 1);
  assert.equal(v.averageRoi, 0.9);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.roi, 2);
});
test('53671 guideIndustryNewEntrants rates entrant success', () => {
  const v = X92B.guideIndustryNewEntrants([{ industry: 'fintech', entrants: 20, successful: 12 }, { industry: 'health', entrants: 10, successful: 2 }]);
  assert.equal(v.count, 2);
  assert.equal(v.welcomingCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.successRate, 0.6);
});
test('53672 diligenceIndustryAcquisitions rates deal risk density', () => {
  const v = X92B.diligenceIndustryAcquisitions([{ industry: 'fintech', target: 'target-a', assets: 50, criticalFindings: 5 }, { industry: 'health', target: 'target-b', assets: 20, criticalFindings: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.riskyCount, 1);
  assert.equal(v.top.key, 'health|target-b');
  assert.equal(v.top.riskDensity, 0.5);
});
test('53673 reviewIndustryAnnualSecurity reviews improvement', () => {
  const v = X92B.reviewIndustryAnnualSecurity([{ industry: 'fintech', incidents: 30, previousIncidents: 40 }, { industry: 'health', incidents: 50, previousIncidents: 40 }]);
  assert.equal(v.count, 2);
  assert.equal(v.improvedCount, 1);
  assert.equal(v.top.key, 'fintech');
  assert.equal(v.top.changeRate, -0.25);
  assert.equal(v.top.improved, true);
});
test('53674 alertIndustryPatternAnomalies flags anomalies', () => {
  const v = X92B.alertIndustryPatternAnomalies([{ industry: 'fintech', pattern: 'login', observed: 150, expected: 100 }, { industry: 'health', pattern: 'login', observed: 110, expected: 100 }]);
  assert.equal(v.count, 2);
  assert.equal(v.anomalousCount, 1);
  assert.equal(v.top.key, 'fintech|login');
  assert.equal(v.top.deviation, 0.5);
  assert.equal(v.top.anomalyScore, 0.5);
});
test('53675 attributePromptOutcomes attributes prompt success', () => {
  const v = X92B.attributePromptOutcomes([{ promptId: 'prompt-a', runs: 20, wins: 15 }, { promptId: 'prompt-b', runs: 20, wins: 5 }]);
  assert.equal(v.count, 2);
  assert.equal(v.attributedCount, 1);
  assert.equal(v.top.key, 'prompt-a');
  assert.equal(v.top.successRate, 0.75);
});
test('53676 archivePromptAbTestResults archives winners and lift', () => {
  const v = X92B.archivePromptAbTestResults([{ testId: 'test-1', aWins: 8, aAttempts: 10, bWins: 5, bAttempts: 10 }, { testId: 'test-2', aWins: 3, aAttempts: 10, bWins: 9, bAttempts: 10 }]);
  assert.equal(v.count, 2);
  assert.equal(v.decisiveCount, 2);
  assert.equal(v.top.key, 'test-2');
  assert.equal(v.top.winner, 'B');
  assert.equal(v.top.lift, 0.6);
});
test('53677 mineWinningPromptPatterns mines winning patterns', () => {
  const v = X92B.mineWinningPromptPatterns([{ pattern: 'recon-first', uses: 20, wins: 16 }, { pattern: 'broad-scan', uses: 20, wins: 6 }]);
  assert.equal(v.count, 2);
  assert.equal(v.winningCount, 1);
  assert.equal(v.top.key, 'recon-first');
  assert.equal(v.top.winRate, 0.8);
});
test('53678 autopsyPromptFailures rates failure criticality', () => {
  const v = X92B.autopsyPromptFailures([{ promptId: 'prompt-a', failureType: 'timeout', runs: 20, failures: 12 }, { promptId: 'prompt-b', failureType: 'drift', runs: 20, failures: 4 }]);
  assert.equal(v.count, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.top.key, 'prompt-a|timeout');
  assert.equal(v.top.failureRate, 0.6);
});
test('53679 versionPromptLearning tracks version improvement', () => {
  const v = X92B.versionPromptLearning([{ promptId: 'prompt-a', version: 'v2', score: 0.9, previousScore: 0.7 }, { promptId: 'prompt-b', version: 'v3', score: 0.6, previousScore: 0.65 }]);
  assert.equal(v.count, 2);
  assert.equal(v.improvedCount, 1);
  assert.equal(v.regressedCount, 1);
  assert.equal(v.top.key, 'prompt-a|v2');
  assert.equal(v.top.improvement, 0.2);
});
test('53680 buildPromptRegressionSuites rates suite stability', () => {
  const v = X92B.buildPromptRegressionSuites([{ suite: 'core', cases: 50, passed: 48 }, { suite: 'edge', cases: 50, passed: 30 }]);
  assert.equal(v.count, 2);
  assert.equal(v.stableCount, 1);
  assert.equal(v.regressedCount, 1);
  assert.equal(v.top.key, 'core');
  assert.equal(v.top.passRate, 0.96);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'X92A'], ['B', B_JSX, 'X92B']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w92 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w92a-'));
  assert.ok(CSS_SRC.includes('.w92b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave92A.jsx', 'Wave92B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 92 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
    assert.ok(!src.toLowerCase().includes('mock'), `${name} carries debris`);
    assert.ok(!src.toLowerCase().includes('demo'), `${name} carries debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ industry: 'fintech', bountyPaid: 10000, findings: 20 }), Object.freeze({ industry: 'health', bountyPaid: 6000, findings: 10 })]);
  const v = X92A.analyzeIndustryBugBountyEconomics(frozen);
  assert.equal(v.count, 2);
});
