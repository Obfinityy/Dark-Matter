/**
 * wave99.test.js — Infinity AI · Wave 99
 * node:test + node:assert/strict. Registry coverage (29/29 for 53921–53949,
 * 11/11 for 53950–53960, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave99.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE99_A_IDEAS } from './wave99ACore.js';
import * as X99A from './wave99ACore.js';
import { WAVE99_B_IDEAS } from './wave99BCores.js';
import * as X99B from './wave99BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave99ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave99BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave99A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave99B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave99.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 29/29 wave 99A ideas, 11/11 wave 99B ideas, zero skips', () => {
  assert.equal(WAVE99_A_IDEAS.length, 29);
  assert.equal(WAVE99_B_IDEAS.length, 11);
  const all = [...WAVE99_A_IDEAS, ...WAVE99_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53921 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE99_A_IDEAS, ...WAVE99_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53921: 'skill gap alert thresholds',
    53922: 'career path skill mapping',
    53923: 'skill gap interview insights',
    53924: 'just-in-time microlearning',
    53925: 'skill practice sandboxes',
    53926: 'skill gap peer study groups',
    53927: 'certification alignment',
    53928: 'skill gap data minimization',
    53929: 'skill profile portability',
    53930: 'skill gap feedback loops',
    53931: 'team lead skill coaching guides',
    53932: 'skill gap resolution playbooks',
    53933: 'skill assessment fairness audits',
    53934: 'skill growth storytelling',
    53935: 'skill gap early warnings',
    53936: 'cross-functional skill sharing',
    53937: 'skill gap gamification',
    53938: 'skill benchmark calibration',
    53939: 'skill gap retrospective integration',
    53940: 'learning time allocation',
    53941: 'skill gap succession planning',
    53942: 'skill community contributions',
    53943: 'skill gap review cadence',
    53944: 'skill development roi',
    53945: 'skill gap transparency reports',
    53946: 'skill assessment accessibility',
    53947: 'skill gap data retention',
    53948: 'skill-based hunt staffing',
    53949: 'future skill forecasting',
    53950: 'one-page hunt debriefs',
    53951: 'executive debrief summaries',
    53952: 'technical deep-dive debriefs',
    53953: 'debrief narrative generation',
    53954: 'debrief finding timelines',
    53955: 'debrief strategy annotations',
    53956: 'debrief lesson extraction',
    53957: 'debrief comparison views',
    53958: 'debrief distribution lists',
    53959: 'debrief feedback collection',
    53960: 'debrief template customization',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 99A spot checks (one per idea) ---
test('53921 setSkillGapAlertThresholds fires alerts past personal lines', () => {
  const v = X99A.setSkillGapAlertThresholds([
    { researcher: 'r-a', skill: 'api', gapScore: 0.82, warnThreshold: 0.4, alertThreshold: 0.7 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.25, warnThreshold: 0.4, alertThreshold: 0.7 },
    { researcher: 'r-c', skill: 'recon', gapScore: 0.5, warnThreshold: 0.4, alertThreshold: 0.7 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.alertCount, 1);
  assert.equal(v.warnCount, 1);
  assert.equal(v.top.key, 'r-a|api');
  assert.equal(v.top.level, 'alert');
});
test('53922 mapCareerPathSkills measures readiness for target roles', () => {
  const v = X99A.mapCareerPathSkills([
    { researcher: 'r-a', targetRole: 'senior-hunter', requiredSkills: ['recon', 'web', 'api', 'reporting'], heldSkills: ['recon', 'web', 'api', 'reporting'] },
    { researcher: 'r-b', targetRole: 'senior-hunter', requiredSkills: ['recon', 'web', 'api', 'reporting'], heldSkills: ['recon', 'web'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'r-a|senior-hunter');
  assert.equal(v.rows.find(r => r.key === 'r-b|senior-hunter').missingCount, 2);
  assert.equal(v.rows.find(r => r.key === 'r-b|senior-hunter').readiness, 0.5);
});
test('53923 extractSkillGapInterviewInsights flags below-bar signals', () => {
  const v = X99A.extractSkillGapInterviewInsights([
    { candidate: 'c-a', skill: 'api', interviewScore: 0.42, threshold: 0.6 },
    { candidate: 'c-b', skill: 'web', interviewScore: 0.78, threshold: 0.6 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.gapCount, 1);
  assert.equal(v.top.key, 'c-a|api');
  assert.equal(v.top.margin, -0.18);
  assert.deepEqual(v.skillsWithGaps, ['api']);
});
test('53924 deliverJustInTimeMicrolearning serves short lessons for live gaps', () => {
  const v = X99A.deliverJustInTimeMicrolearning([
    { researcher: 'r-a', skill: 'api', gapScore: 0.7, lessonMinutes: 6, maxMinutes: 10 },
    { researcher: 'r-b', skill: 'web', gapScore: 0.1, lessonMinutes: 5, maxMinutes: 10 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.servedCount, 1);
  assert.equal(v.totalMinutes, 6);
  assert.equal(v.top.action, 'serve-now');
});
test('53925 runSkillPracticeSandboxes gates hunts on sandbox passes', () => {
  const v = X99A.runSkillPracticeSandboxes([
    { researcher: 'r-a', skill: 'api', sandboxAttempts: 4, sandboxScore: 0.85, passMark: 0.7 },
    { researcher: 'r-b', skill: 'web', sandboxAttempts: 3, sandboxScore: 0.5, passMark: 0.7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.passedCount, 1);
  assert.equal(v.top.key, 'r-a|api');
  assert.equal(v.top.margin, 0.15);
});
test('53926 formSkillGapPeerStudyGroups forms groups at target size', () => {
  const v = X99A.formSkillGapPeerStudyGroups([
    { skill: 'api', members: ['r-a', 'r-b', 'r-c', 'r-d'], targetSize: 4 },
    { skill: 'mobile', members: ['r-e'], targetSize: 4 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.formedCount, 1);
  assert.equal(v.totalMembers, 5);
  assert.equal(v.top.key, 'api');
});
test('53927 alignCertifications checks level and expiry together', () => {
  const v = X99A.alignCertifications([
    { researcher: 'r-a', certification: 'web-hunting-cert', requiredLevel: 2, currentLevel: 2, expiresDays: 120 },
    { researcher: 'r-b', certification: 'api-cert', requiredLevel: 3, currentLevel: 1, expiresDays: 10 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.alignedCount, 1);
  assert.equal(v.gapCount, 1);
  assert.equal(v.top.key, 'r-a|web-hunting-cert');
});
test('53928 minimizeSkillGapData drops fields coaching does not need', () => {
  const v = X99A.minimizeSkillGapData([
    { researcher: 'r-a', fieldsCollected: ['gap', 'score'], fieldsNeeded: ['gap', 'score'] },
    { researcher: 'r-b', fieldsCollected: ['gap', 'score', 'manager-notes', 'peer-rank'], fieldsNeeded: ['gap', 'score'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.minimizedCount, 1);
  assert.equal(v.totalExcess, 2);
  assert.equal(v.top.key, 'r-b');
  assert.equal(v.top.excessCount, 2);
});
test('53929 exportSkillProfilePortability requires full open exports', () => {
  const v = X99A.exportSkillProfilePortability([
    { researcher: 'r-a', format: 'json', fieldsTotal: 12, fieldsExported: 12 },
    { researcher: 'r-b', format: 'pdf-image', fieldsTotal: 12, fieldsExported: 5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.portableCount, 1);
  assert.equal(v.top.coverage, 1);
  assert.equal(v.top.status, 'portable');
});
test('53930 runSkillGapFeedbackLoops closes acted-on feedback fast', () => {
  const v = X99A.runSkillGapFeedbackLoops([
    { researcher: 'r-a', skill: 'api', feedbackItems: 5, actedItems: 5, daysToClose: 9 },
    { researcher: 'r-b', skill: 'web', feedbackItems: 4, actedItems: 1, daysToClose: 30 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.closedCount, 1);
  assert.equal(v.top.closureRate, 1);
  assert.equal(v.top.status, 'loop-closed');
});
test('53931 buildTeamLeadCoachingGuides requires complete guide sections', () => {
  const v = X99A.buildTeamLeadCoachingGuides([
    { lead: 'lead-a', skill: 'api', guideSections: 4, requiredSections: 4, researcherCount: 6 },
    { lead: 'lead-b', skill: 'web', guideSections: 2, requiredSections: 4, researcherCount: 3 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.completeness, 1);
  assert.equal(v.totalResearchers, 9);
});
test('53932 buildSkillGapResolutionPlaybooks proves playbooks by success', () => {
  const v = X99A.buildSkillGapResolutionPlaybooks([
    { skill: 'api', playbookSteps: 5, completedSteps: 5, successRate: 0.8 },
    { skill: 'web', playbookSteps: 5, completedSteps: 2, successRate: 0.4 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.provenCount, 1);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.status, 'playbook-proven');
});
test('53933 auditSkillAssessmentFairness flags group disparities', () => {
  const v = X99A.auditSkillAssessmentFairness([
    { skill: 'api', groupAScore: 0.7, groupBScore: 0.68, tolerance: 0.1 },
    { skill: 'reporting', groupAScore: 0.75, groupBScore: 0.4, tolerance: 0.1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fairCount, 1);
  assert.equal(v.worstDisparity, 0.35);
  assert.equal(v.top.key, 'reporting');
});
test('53934 buildSkillGrowthStories needs a full milestone arc', () => {
  const v = X99A.buildSkillGrowthStories([
    { researcher: 'r-a', skill: 'api', milestones: ['first-pass', 'sandbox-pass', 'mentor-review', 'live-hunt-win'], valueDelivered: 4200 },
    { researcher: 'r-b', skill: 'web', milestones: ['first-pass'], valueDelivered: 300 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.milestoneCount, 4);
  assert.equal(v.totalValue, 4500);
});
test('53935 detectSkillGapEarlyWarnings catches fast-widening gaps', () => {
  const v = X99A.detectSkillGapEarlyWarnings([
    { researcher: 'r-a', skill: 'api', gapVelocity: 0.3, gapScore: 0.6, warnVelocity: 0.15 },
    { researcher: 'r-b', skill: 'web', gapVelocity: -0.1, gapScore: 0.4, warnVelocity: 0.15 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.warningCount, 1);
  assert.equal(v.top.key, 'r-a|api');
  assert.equal(v.top.urgency, 0.18);
});
test('53936 shareCrossFunctionalSkills spreads scarce skills across teams', () => {
  const v = X99A.shareCrossFunctionalSkills([
    { skill: 'api', homeTeam: 'red', sharedTeams: ['blue', 'green'], sessionsHeld: 3 },
    { skill: 'niche-recon', homeTeam: 'red', sharedTeams: [], sessionsHeld: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.sharedCount, 1);
  assert.equal(v.totalSessions, 3);
  assert.equal(v.top.reach, 3);
});
test('53937 applySkillGapGamification rewards verified closure', () => {
  const v = X99A.applySkillGapGamification([
    { researcher: 'r-a', skill: 'api', pointsEarned: 120, pointsToNextLevel: 30, challengesDone: 5 },
    { researcher: 'r-b', skill: 'web', pointsEarned: 10, pointsToNextLevel: 90, challengesDone: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.engagedCount, 1);
  assert.equal(v.totalPoints, 130);
  assert.equal(v.top.levelProgress, 0.8);
});
test('53938 calibrateSkillBenchmarks aligns internal and external bars', () => {
  const v = X99A.calibrateSkillBenchmarks([
    { skill: 'api', internalBenchmark: 0.72, externalBenchmark: 0.7, sampleSize: 120 },
    { skill: 'mobile', internalBenchmark: 0.9, externalBenchmark: 0.55, sampleSize: 80 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.calibratedCount, 1);
  assert.equal(v.driftedCount, 1);
  assert.equal(v.top.key, 'mobile');
  assert.equal(v.top.drift, 0.35);
});
test('53939 integrateSkillGapRetrospectives lands gaps with owners', () => {
  const v = X99A.integrateSkillGapRetrospectives([
    { huntId: 'hunt-1', skill: 'api', gapNoted: true, retroLogged: true, actionAssigned: true },
    { huntId: 'hunt-2', skill: 'web', gapNoted: true, retroLogged: false, actionAssigned: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.integratedCount, 1);
  assert.equal(v.notedCount, 2);
  assert.equal(v.integrationRate, 0.5);
});
test('53940 allocateLearningTime protects hours sized to gaps', () => {
  const v = X99A.allocateLearningTime([
    { researcher: 'r-a', skill: 'api', weeklyHours: 10, allocatedHours: 4, gapScore: 0.8 },
    { researcher: 'r-b', skill: 'web', weeklyHours: 10, allocatedHours: 1, gapScore: 0.7 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.protectedCount, 1);
  assert.equal(v.totalAllocated, 5);
  assert.equal(v.top.key, 'r-a|api');
});
test('53941 planSkillGapSuccession covers critical skills with backups', () => {
  const v = X99A.planSkillGapSuccession([
    { skill: 'api', primaryHolder: 'r-a', backupHolders: ['r-b', 'r-c'], criticality: 0.9 },
    { skill: 'mobile', primaryHolder: 'r-d', backupHolders: [], criticality: 0.85 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.safeCount, 1);
  assert.equal(v.atRiskCount, 1);
  assert.equal(v.top.key, 'mobile');
  assert.equal(v.top.risk, 0.85);
});
test('53942 trackSkillCommunityContributions values shared knowledge', () => {
  const v = X99A.trackSkillCommunityContributions([
    { researcher: 'r-a', skill: 'api', contributions: 8, reviews: 5, helpfulVotes: 40 },
    { researcher: 'r-b', skill: 'web', contributions: 0, reviews: 0, helpfulVotes: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.activeCount, 1);
  assert.equal(v.totalImpact, 41);
  assert.equal(v.top.impact, 41);
  assert.equal(v.top.status, 'community-leader');
});
test('53943 scheduleSkillGapReviewCadence surfaces overdue reviews', () => {
  const v = X99A.scheduleSkillGapReviewCadence([
    { skill: 'api', lastReviewedDays: 45, reviewDays: 30, openGaps: 5 },
    { skill: 'web', lastReviewedDays: 10, reviewDays: 30, openGaps: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.dueCount, 1);
  assert.equal(v.urgentCount, 1);
  assert.equal(v.top.daysOverdue, 15);
});
test('53944 calculateSkillDevelopmentROI prices training against gains', () => {
  const v = X99A.calculateSkillDevelopmentROI([
    { skill: 'api', trainingCost: 2000, findingsGain: 12, valuePerFinding: 300 },
    { skill: 'web', trainingCost: 3000, findingsGain: 2, valuePerFinding: 300 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.positiveCount, 1);
  assert.equal(v.top.key, 'api');
  assert.equal(v.top.roi, 1.8);
  assert.equal(v.totalGainedValue, 4200);
});
test('53945 publishSkillGapTransparencyReports needs a real audience', () => {
  const v = X99A.publishSkillGapTransparencyReports([
    { team: 'red', skill: 'api', gapScore: 0.7, published: true, audience: ['team', 'leads', 'managers'] },
    { team: 'blue', skill: 'web', gapScore: 0.4, published: false, audience: [] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.transparentCount, 1);
  assert.equal(v.unpublishedCount, 1);
  assert.equal(v.top.status, 'transparent');
});
test('53946 auditSkillAssessmentAccessibility requires every accommodation', () => {
  const v = X99A.auditSkillAssessmentAccessibility([
    { assessmentId: 'assess-api', accommodationsOffered: ['extra-time', 'screen-reader'], accommodationsNeeded: ['extra-time', 'screen-reader'], screenReaderSafe: true },
    { assessmentId: 'assess-web', accommodationsOffered: ['extra-time'], accommodationsNeeded: ['extra-time', 'captions'], screenReaderSafe: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.accessibleCount, 1);
  assert.equal(v.top.key, 'assess-web');
  assert.equal(v.top.missingCount, 1);
});
test('53947 planSkillGapDataRetention archives data past its window', () => {
  const v = X99A.planSkillGapDataRetention([
    { researcher: 'r-a', dataType: 'gap-history', ageDays: 400, retentionDays: 365 },
    { researcher: 'r-b', dataType: 'gap-history', ageDays: 40, retentionDays: 365 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.expiredCount, 1);
  assert.equal(v.top.key, 'r-a|gap-history');
  assert.equal(v.top.action, 'archive');
  assert.equal(v.rows.find(r => r.key === 'r-b|gap-history').daysLeft, 325);
});
test('53948 staffSkillBasedHunts matches proficiency to hunt bars', () => {
  const v = X99A.staffSkillBasedHunts([
    { huntId: 'hunt-1', requiredSkill: 'api', researcher: 'r-a', proficiency: 0.85, requiredProficiency: 0.7 },
    { huntId: 'hunt-2', requiredSkill: 'mobile', researcher: 'r-b', proficiency: 0.3, requiredProficiency: 0.75 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.staffedCount, 1);
  assert.equal(v.top.margin, 0.15);
  assert.equal(v.top.status, 'staffed');
});
test('53949 forecastFutureSkills starts training before demand lands', () => {
  const v = X99A.forecastFutureSkills([
    { skill: 'ai-assisted-hunting', demandGrowth: 0.8, currentCoverage: 0.2, horizonMonths: 12 },
    { skill: 'web-basics', demandGrowth: 0.1, currentCoverage: 0.9, horizonMonths: 12 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.trainNowCount, 1);
  assert.equal(v.top.key, 'ai-assisted-hunting');
  assert.equal(v.top.urgency, 0.64);
  assert.equal(v.top.projectedDemand, 0.36);
});

// --- Wave 99B spot checks (one per idea) ---
test('53950 buildOnePageHuntDebriefs fits hunts inside one page', () => {
  const v = X99B.buildOnePageHuntDebriefs([
    { huntId: 'hunt-alpha', findingsCount: 6, wordCount: 350, maxWords: 400 },
    { huntId: 'hunt-beta', findingsCount: 9, wordCount: 720, maxWords: 400 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fitsCount, 1);
  assert.equal(v.totalFindings, 15);
  assert.equal(v.top.key, 'hunt-beta');
  assert.equal(v.top.wordsOver, 320);
});
test('53951 buildExecutiveDebriefSummaries leads with business impact', () => {
  const v = X99B.buildExecutiveDebriefSummaries([
    { huntId: 'hunt-alpha', riskScore: 0.8, businessImpact: 9000, plainLanguageScore: 0.85 },
    { huntId: 'hunt-beta', riskScore: 0.6, businessImpact: 4000, plainLanguageScore: 0.4 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalImpact, 13000);
  assert.equal(v.top.key, 'hunt-alpha');
  assert.equal(v.top.priority, 7200);
});
test('53952 buildTechnicalDeepDiveDebriefs demands evidence per finding', () => {
  const v = X99B.buildTechnicalDeepDiveDebriefs([
    { huntId: 'hunt-alpha', findingsCount: 4, evidenceItems: 6, reproductionSteps: 5 },
    { huntId: 'hunt-beta', findingsCount: 5, evidenceItems: 2, reproductionSteps: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.top.key, 'hunt-alpha');
  assert.equal(v.top.evidencePerFinding, 1.5);
});
test('53953 generateDebriefNarratives weaves findings into stories', () => {
  const v = X99B.generateDebriefNarratives([
    { huntId: 'hunt-alpha', findingsCount: 5, timelineEvents: 8, toneScore: 0.8 },
    { huntId: 'hunt-beta', findingsCount: 1, timelineEvents: 1, toneScore: 0.5 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.key, 'hunt-alpha');
  assert.equal(v.top.status, 'narrative-ready');
});
test('53954 buildDebriefFindingTimelines orders findings by discovery', () => {
  const v = X99B.buildDebriefFindingTimelines([
    { huntId: 'hunt-alpha', findingId: 'f-1', discoveredHour: 2, verifiedHour: 3 },
    { huntId: 'hunt-alpha', findingId: 'f-2', discoveredHour: 5, verifiedHour: 12 },
    { huntId: 'hunt-beta', findingId: 'f-3', discoveredHour: 1, verifiedHour: 2 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.huntCount, 2);
  assert.equal(v.fastTrackCount, 2);
  assert.equal(v.averageLag, 3);
  assert.equal(v.top.key, 'hunt-beta|f-3');
});
test('53955 annotateDebriefStrategy links decisions to outcomes', () => {
  const v = X99B.annotateDebriefStrategy([
    { huntId: 'hunt-alpha', strategyNote: 'Pivoted to API after recon stalled', decisionCount: 4, outcomesLinked: 4 },
    { huntId: 'hunt-beta', strategyNote: '', decisionCount: 0, outcomesLinked: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fullyCount, 1);
  assert.equal(v.annotatedCount, 1);
  assert.equal(v.top.linkRate, 1);
});
test('53956 extractDebriefLessons banks reusable hunt lessons', () => {
  const v = X99B.extractDebriefLessons([
    { huntId: 'hunt-alpha', rawNotes: 10, lessonsExtracted: 6, reusableLessons: 4 },
    { huntId: 'hunt-beta', rawNotes: 3, lessonsExtracted: 1, reusableLessons: 0 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.bankedCount, 1);
  assert.equal(v.totalLessons, 7);
  assert.equal(v.totalReusable, 4);
  assert.equal(v.top.key, 'hunt-alpha');
});
test('53957 buildDebriefComparisonViews spots improvement over baseline', () => {
  const v = X99B.buildDebriefComparisonViews([
    { huntId: 'hunt-new', baselineHuntId: 'hunt-old', findingsDelta: 3, durationDeltaHours: -2 },
    { huntId: 'hunt-flat', baselineHuntId: 'hunt-old', findingsDelta: -1, durationDeltaHours: 4 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.improvedCount, 1);
  assert.equal(v.fasterCount, 1);
  assert.equal(v.top.huntId, 'hunt-new');
});
test('53958 buildDebriefDistributionLists reaches every required role', () => {
  const v = X99B.buildDebriefDistributionLists([
    { huntId: 'hunt-alpha', recipients: ['team', 'leads', 'security'], requiredRoles: ['team', 'leads', 'security'], sentCount: 3 },
    { huntId: 'hunt-beta', recipients: ['team'], requiredRoles: ['team', 'leads'], sentCount: 1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.fullCount, 1);
  assert.equal(v.top.key, 'hunt-alpha');
  assert.equal(v.rows.find(r => r.key === 'hunt-beta').missingCount, 1);
});
test('53959 collectDebriefFeedback measures whether debriefs help', () => {
  const v = X99B.collectDebriefFeedback([
    { huntId: 'hunt-alpha', responses: 8, readers: 10, averageRating: 4.6 },
    { huntId: 'hunt-beta', responses: 1, readers: 10, averageRating: 3.1 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.wellReceivedCount, 1);
  assert.equal(v.totalResponses, 9);
  assert.equal(v.top.key, 'hunt-alpha');
  assert.equal(v.top.responseRate, 0.8);
});
test('53960 customizeDebriefTemplates tailors formats per team', () => {
  const v = X99B.customizeDebriefTemplates([
    { team: 'red', templateId: 'debrief-v2', sectionsCustomized: 4, sectionsTotal: 6, active: true },
    { team: 'blue', templateId: 'debrief-v1', sectionsCustomized: 0, sectionsTotal: 6, active: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.tailoredCount, 1);
  assert.equal(v.activeCount, 2);
  assert.equal(v.top.customizationRate, 0.67);
  assert.equal(v.top.status, 'tailored');
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X99A', 29], ['B', B_JSX, 'X99B', 11]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w99 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w99a-'));
  assert.ok(CSS_SRC.includes('.w99b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('animation'), 'zero-animation order violated');
  assert.ok(!CSS_SRC.includes('transition'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave99A.jsx', 'Wave99B.jsx']) {
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

test('no-debris audit: no placeholder text in wave 99 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mock'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('demo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenThresholds = Object.freeze([Object.freeze({ researcher: 'r-a', skill: 'api', gapScore: 0.82 }), Object.freeze({ researcher: 'r-b', skill: 'web', gapScore: 0.2 })]);
  const a = X99A.setSkillGapAlertThresholds(frozenThresholds);
  assert.equal(a.count, 2);
  const frozenTimeline = Object.freeze([Object.freeze({ huntId: 'hunt-a', findingId: 'f-1', discoveredHour: 1, verifiedHour: 2 }), Object.freeze({ huntId: 'hunt-a', findingId: 'f-2', discoveredHour: 3, verifiedHour: 9 })]);
  const b = X99B.buildDebriefFindingTimelines(frozenTimeline);
  assert.equal(b.count, 2);
  assert.equal(b.huntCount, 1);
});
