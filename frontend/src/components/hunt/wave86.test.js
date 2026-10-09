/**
 * wave86.test.js — Infinity AI · Wave 86
 * node:test + node:assert/strict. Registry coverage (20/20 for 53401–53420,
 * 20/20 for 53421–53440, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave86.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE86_A_IDEAS } from './wave86ACore.js';
import * as XA from './wave86ACore.js';
import { WAVE86_B_IDEAS } from './wave86BCores.js';
import * as XB from './wave86BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave86ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave86BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave86A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave86B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave86.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 86A ideas, 20/20 wave 86B ideas, zero skips', () => {
  assert.equal(WAVE86_A_IDEAS.length, 20);
  assert.equal(WAVE86_B_IDEAS.length, 20);
  const all = [...WAVE86_A_IDEAS, ...WAVE86_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53401 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE86_A_IDEAS, ...WAVE86_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53401: 'benchmark season windows',
    53402: 'team-vs-team benchmarks',
    53403: 'benchmark privacy controls',
    53404: 'improvement velocity rankings',
    53405: 'benchmark data portability',
    53406: 'blind benchmark mode',
    53407: 'mentor benchmark views',
    53408: 'benchmark calibration hunts',
    53409: 'anti-gaming safeguards (learning)',
    53410: 'benchmark confidence labels',
    53411: 'role-based benchmarks',
    53412: 'benchmark opt-out anytime',
    53413: 'peer learning matches',
    53414: 'benchmark trend alerts',
    53415: 'organization benchmark aggregates',
    53416: 'benchmark fairness audits',
    53417: 'specialization badges (learning)',
    53418: 'benchmark-driven training plans',
    53419: 'cross-org benchmark exchange',
    53420: 'benchmark methodology transparency',
    53421: 'researcher benchmark appeals',
    53422: 'benchmark inclusion criteria',
    53423: 'newcomer benchmark bootstrapping',
    53424: 'benchmark decay weighting',
    53425: 'team composition analytics',
    53426: 'benchmark api for hr',
    53427: 'burnout-signal detection',
    53428: 'benchmark celebration milestones',
    53429: 'peer review benchmarks',
    53430: 'benchmark data retention policy',
    53431: 'language-aware benchmarking',
    53432: 'benchmark sandbox mode',
    53433: 'cross-platform benchmarks',
    53434: 'benchmark export for resumes',
    53435: 'benchmark dispute resolution',
    53436: 'accessibility in benchmarks',
    53437: 'benchmark-driven hiring rubrics',
    53438: 'team health benchmarks',
    53439: 'benchmark anomaly explanations',
    53440: 'regional benchmark chapters'
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave86 A spot checks ---- */
test('53401 buildBenchmarkSeasonWindows: windows sorted by start day', () => {
  const v = XA.buildBenchmarkSeasonWindows([{ id: 's2', startDay: 90, endDay: 180 }, { id: 's1', startDay: 0, endDay: 90 }]);
  assert.equal(v.count, 2);
  assert.equal(v.rows[0].key, 's1');
  assert.equal(v.activeCount, 2);
});
test('53402 buildTeamVsTeamBenchmarks: leader ranked first', () => {
  const v = XA.buildTeamVsTeamBenchmarks([{ team: 'alpha', wins: 3, losses: 1, score: 84 }, { team: 'beta', wins: 1, losses: 2, score: 61 }]);
  assert.equal(v.top.key, 'alpha');
  assert.equal(v.top.rank, 1);
  assert.equal(v.totalGames, 7);
});
test('53403 applyBenchmarkPrivacyControls: private and public tallied', () => {
  const v = XA.applyBenchmarkPrivacyControls([{ researcher: 'a', visibility: 'private', score: 80 }, { researcher: 'b', visibility: 'public', score: 70 }]);
  assert.equal(v.privateCount, 1);
  assert.equal(v.publicCount, 1);
});
test('53404 rankImprovementVelocity: fastest improver first', () => {
  const v = XA.rankImprovementVelocity([{ name: 'a', startScore: 50, endScore: 78 }, { name: 'b', startScore: 60, endScore: 66 }], { weeks: 4 });
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.velocity, 7);
  assert.equal(v.improvingCount, 2);
});
test('53405 exportBenchmarkDataPortability: payload built', () => {
  const v = XA.exportBenchmarkDataPortability([{ id: 'r1', researcher: 'researcher-a', score: 82 }], { format: 'json' });
  assert.equal(v.count, 1);
  assert.equal(v.exportReady, true);
  assert.ok(v.payload.includes('researcher-a'));
});
test('53406 enableBlindBenchmarkMode: identities hidden', () => {
  const v = XA.enableBlindBenchmarkMode([{ score: 64 }, { score: 88 }]);
  assert.equal(v.blinded, true);
  assert.equal(v.top.score, 88);
  assert.equal(v.top.researcher, null);
});
test('53407 buildMentorBenchmarkViews: on-track mentee counted', () => {
  const v = XA.buildMentorBenchmarkViews([{ name: 'm1', score: 60, target: 75 }, { name: 'm2', score: 80, target: 75 }]);
  assert.equal(v.onTrackCount, 1);
  assert.equal(v.top.key, 'm2');
});
test('53408 runBenchmarkCalibrationHunts: calibrated hunt counted', () => {
  const v = XA.runBenchmarkCalibrationHunts([{ id: 'h1', observedScore: 72, expectedScore: 70 }, { id: 'h2', observedScore: 95, expectedScore: 70 }]);
  assert.equal(v.calibratedCount, 1);
  assert.equal(v.top.key, 'h1');
});
test('53409 applyAntiGamingSafeguards: suspicious gain flagged', () => {
  const v = XA.applyAntiGamingSafeguards([{ researcher: 'a', weeklyGain: 12, hunts: 4 }, { researcher: 'b', weeklyGain: 45, hunts: 1 }]);
  assert.equal(v.flaggedCount, 1);
  assert.equal(v.top.key, 'b');
});
test('53410 labelBenchmarkConfidence: high confidence labelled', () => {
  const v = XA.labelBenchmarkConfidence([{ researcher: 'a', score: 81, samples: 12, variance: 8 }, { researcher: 'b', score: 60, samples: 2, variance: 20 }]);
  assert.equal(v.highCount, 1);
  assert.equal(v.lowCount, 1);
  assert.equal(v.top.key, 'a');
});
test('53411 buildRoleBasedBenchmarks: roles aggregated', () => {
  const v = XA.buildRoleBasedBenchmarks([{ role: 'web', score: 82 }, { role: 'web', score: 74 }, { role: 'api', score: 79 }]);
  assert.equal(v.roleCount, 2);
  assert.equal(v.top.key, 'api');
  assert.equal(v.count, 3);
});
test('53412 processBenchmarkOptOut: opt-out tallied', () => {
  const v = XA.processBenchmarkOptOut([{ researcher: 'a', status: 'included' }, { researcher: 'b', status: 'opted-out' }]);
  assert.equal(v.optedOutCount, 1);
  assert.equal(v.includedCount, 1);
});
test('53413 matchPeerLearning: complementary peers matched', () => {
  const v = XA.matchPeerLearning([{ name: 'a', weakAreas: ['auth'], strengths: ['routes'] }, { name: 'b', weakAreas: ['routes'], strengths: ['auth'] }]);
  assert.equal(v.matchedCount, 2);
  assert.equal(v.top.matchScore, 1);
});
test('53414 detectBenchmarkTrendAlerts: sharp rise alerts', () => {
  const v = XA.detectBenchmarkTrendAlerts([{ id: 's1', points: [50, 62, 78] }, { id: 's2', points: [70, 71, 72] }], { threshold: 10 });
  assert.equal(v.alertCount, 1);
  assert.equal(v.top.key, 's1');
  assert.equal(v.top.delta, 28);
});
test('53415 aggregateOrganizationBenchmarks: member scores averaged', () => {
  const v = XA.aggregateOrganizationBenchmarks([{ org: 'org-a', members: [{ score: 80 }, { score: 70 }] }]);
  assert.equal(v.count, 1);
  assert.equal(v.top.avg, 75);
  assert.equal(v.totalMembers, 2);
});
test('53416 auditBenchmarkFairness: biased group flagged', () => {
  const v = XA.auditBenchmarkFairness([{ group: 'cohort-a', score: 73, expected: 70 }, { group: 'cohort-b', score: 52, expected: 70 }]);
  assert.equal(v.fairCount, 1);
  assert.equal(v.flaggedCount, 1);
  assert.equal(v.top.key, 'cohort-b');
});
test('53417 awardSpecializationBadges: badge earned above threshold', () => {
  const v = XA.awardSpecializationBadges([{ name: 'a', area: 'web', score: 88 }, { name: 'b', area: 'api', score: 62 }], { threshold: 80 });
  assert.equal(v.badgeCount, 1);
  assert.equal(v.top.badge, 'web-specialist');
});
test('53418 planBenchmarkDrivenTraining: plan built for gap', () => {
  const v = XA.planBenchmarkDrivenTraining([{ name: 'a', score: 58, target: 85, weakAreas: ['auth'] }]);
  assert.equal(v.planCount, 1);
  assert.equal(v.top.gap, 27);
  assert.equal(v.top.planWeeks, 3);
});
test('53419 exchangeCrossOrgBenchmarks: cross-org link counted', () => {
  const v = XA.exchangeCrossOrgBenchmarks([{ id: 'ex1', fromOrg: 'org-a', toOrg: 'org-b', recordCount: 12, status: 'accepted' }, { id: 'ex2', fromOrg: 'org-a', toOrg: 'org-a', recordCount: 2 }]);
  assert.equal(v.crossOrgCount, 1);
  assert.equal(v.totalRecords, 14);
});
test('53420 explainBenchmarkMethodologyTransparency: factors disclosed', () => {
  const v = XA.explainBenchmarkMethodologyTransparency({ name: 'Infinity AI benchmark', factors: [{ name: 'findings', weight: 50 }, { name: 'coverage', weight: 30 }] });
  assert.equal(v.count, 2);
  assert.equal(v.totalWeight, 80);
  assert.equal(v.disclosed, true);
});

/* ---- Wave86 B spot checks ---- */
test('53421 handleResearcherBenchmarkAppeals: adjusted appeal granted', () => {
  const v = XB.handleResearcherBenchmarkAppeals([{ id: 'a1', researcher: 'r-a', originalScore: 64, reviewedScore: 71 }, { id: 'a2', researcher: 'r-b', originalScore: 70, reviewedScore: 70 }]);
  assert.equal(v.grantedCount, 1);
  assert.equal(v.top.delta, 7);
});
test('53422 evaluateBenchmarkInclusionCriteria: qualifying candidate included', () => {
  const v = XB.evaluateBenchmarkInclusionCriteria([{ name: 'a', hunts: 5, score: 72 }, { name: 'b', hunts: 1, score: 55 }]);
  assert.equal(v.includedCount, 1);
  assert.equal(v.top.key, 'a');
});
test('53423 bootstrapNewcomerBenchmarks: newcomer gets baseline', () => {
  const v = XB.bootstrapNewcomerBenchmarks([{ name: 'n1', hunts: 1, score: 40 }, { name: 'n2', hunts: 6, score: 74 }], { baseline: 50 });
  assert.equal(v.provisionalCount, 1);
  assert.equal(v.rows.find(r => r.key === 'n1').score, 50);
});
test('53424 applyBenchmarkDecayWeighting: older score weighs less', () => {
  const v = XB.applyBenchmarkDecayWeighting([{ id: 'r1', score: 80, ageDays: 0 }, { id: 'r2', score: 80, ageDays: 90 }], { halfLifeDays: 90 });
  assert.equal(v.rows[0].key, 'r1');
  assert.equal(v.rows[0].weight, 1);
  assert.equal(v.rows[1].weight, 0.5);
});
test('53425 analyzeTeamComposition: balanced team detected', () => {
  const v = XB.analyzeTeamComposition([{ team: 'alpha', members: [{ role: 'web', score: 80 }, { role: 'api', score: 76 }, { role: 'review', score: 82 }] }]);
  assert.equal(v.balancedCount, 1);
  assert.equal(v.top.roleCount, 3);
});
test('53426 serveBenchmarkApiForHr: role filter applied', () => {
  const v = XB.serveBenchmarkApiForHr([{ name: 'a', role: 'web', score: 86 }, { name: 'b', role: 'api', score: 71 }], { role: 'web' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.hireReadyCount, 1);
  assert.equal(v.top.key, 'a');
});
test('53427 detectBurnoutSignals: at-risk researcher flagged', () => {
  const v = XB.detectBurnoutSignals([{ name: 'a', hoursPerWeek: 58, streakDays: 24, scoreDrop: 18 }, { name: 'b', hoursPerWeek: 38, streakDays: 5, scoreDrop: 2 }]);
  assert.equal(v.atRiskCount, 1);
  assert.equal(v.top.key, 'a');
});
test('53428 planBenchmarkCelebrationMilestones: milestone reached', () => {
  const v = XB.planBenchmarkCelebrationMilestones([{ name: 'a', score: 82 }, { name: 'b', score: 44 }]);
  assert.equal(v.celebrateCount, 1);
  assert.equal(v.top.nextMilestone, 90);
});
test('53429 buildPeerReviewBenchmarks: researcher averages computed', () => {
  const v = XB.buildPeerReviewBenchmarks([{ researcher: 'a', rating: 5 }, { researcher: 'a', rating: 4 }, { researcher: 'b', rating: 3 }]);
  assert.equal(v.researcherCount, 2);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.avgRating, 4.5);
});
test('53430 applyBenchmarkDataRetentionPolicy: old record archived', () => {
  const v = XB.applyBenchmarkDataRetentionPolicy([{ id: 'r1', ageDays: 120, score: 77 }, { id: 'r2', ageDays: 480, score: 69 }], { retentionDays: 365 });
  assert.equal(v.retainedCount, 1);
  assert.equal(v.archiveCount, 1);
});
test('53431 buildLanguageAwareBenchmarking: languages aggregated', () => {
  const v = XB.buildLanguageAwareBenchmarking([{ language: 'en', score: 82 }, { language: 'en', score: 74 }, { language: 'es', score: 79 }]);
  assert.equal(v.languageCount, 2);
  assert.equal(v.top.key, 'es');
  assert.equal(v.count, 3);
});
test('53432 enableBenchmarkSandboxMode: entries isolated', () => {
  const v = XB.enableBenchmarkSandboxMode([{ id: 'sb1', label: 'Trial entry', score: 66 }]);
  assert.equal(v.sandboxed, true);
  assert.equal(v.productionWrites, 0);
  assert.equal(v.count, 1);
});
test('53433 buildCrossPlatformBenchmarks: platforms unified', () => {
  const v = XB.buildCrossPlatformBenchmarks([{ platform: 'web', score: 83 }, { platform: 'api', score: 77 }, { platform: 'web', score: 79 }]);
  assert.equal(v.platformCount, 2);
  assert.equal(v.top.key, 'web');
  assert.equal(v.unifiedScore, 79);
});
test('53434 exportBenchmarkForResumes: strong skill highlighted', () => {
  const v = XB.exportBenchmarkForResumes({ name: 'researcher-a', skills: [{ area: 'web', score: 88, percentile: 92 }, { area: 'api', score: 64, percentile: 58 }] });
  assert.equal(v.highlightCount, 1);
  assert.ok(v.text.includes('web'));
});
test('53435 resolveBenchmarkDisputes: resolved dispute counted', () => {
  const v = XB.resolveBenchmarkDisputes([{ id: 'd1', originalScore: 60, finalScore: 68, status: 'resolved', evidence: ['hunt-log', 'review'] }, { id: 'd2', originalScore: 55, status: 'open' }]);
  assert.equal(v.resolvedCount, 1);
  assert.equal(v.openCount, 1);
});
test('53436 auditBenchmarkAccessibility: all checks pass when enabled', () => {
  const v = XB.auditBenchmarkAccessibility(['screen-reader', 'keyboard-only', 'contrast', 'captions', 'focus-order']);
  assert.equal(v.passedCount, 5);
  assert.equal(v.accessible, true);
});
test('53437 buildBenchmarkDrivenHiringRubrics: weights totalled', () => {
  const v = XB.buildBenchmarkDrivenHiringRubrics([{ name: 'findings quality', weight: 50, minScore: 70 }, { name: 'coverage depth', weight: 30, minScore: 65 }]);
  assert.equal(v.count, 2);
  assert.equal(v.totalWeight, 80);
  assert.equal(v.top.key, 'findings quality');
});
test('53438 measureTeamHealthBenchmarks: healthy team identified', () => {
  const v = XB.measureTeamHealthBenchmarks([{ team: 'alpha', deliveryScore: 82, moraleScore: 78, qualityScore: 85 }, { team: 'beta', deliveryScore: 55, moraleScore: 60, qualityScore: 58 }]);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.top.key, 'alpha');
});
test('53439 explainBenchmarkAnomalies: outlier explained', () => {
  const v = XB.explainBenchmarkAnomalies([{ id: 'r1', score: 95 }, { id: 'r2', score: 62 }, { id: 'r3', score: 58 }], { threshold: 20 });
  assert.equal(v.anomalyCount, 1);
  assert.equal(v.top.key, 'r1');
});
test('53440 organizeRegionalBenchmarkChapters: members totalled', () => {
  const v = XB.organizeRegionalBenchmarkChapters([{ region: 'Delhi', members: [{ name: 'a' }, { name: 'b' }], avgScore: 76 }]);
  assert.equal(v.count, 1);
  assert.equal(v.totalMembers, 2);
  assert.equal(v.activeCount, 1);
});

/* ---- JSX-core call-shape audit ---- */
function componentNames(jsxSrc) {
  return [...jsxSrc.matchAll(/export function (\w+)/g)].map(m => m[1]).filter(n => !/Gallery$/.test(n));
}
function componentBody(jsxSrc, name) {
  const idx = jsxSrc.indexOf(`export function ${name}`);
  const next = jsxSrc.indexOf('export function', idx + 1);
  return jsxSrc.slice(idx, next === -1 ? undefined : next);
}

test('jsx: 20 components per file, each calls at least 1 core function', () => {
  for (const [label, src, core] of [['A', A_JSX, XA], ['B', B_JSX, XB]]) {
    const names = componentNames(src);
    assert.equal(names.length, 20, `${label}: expected 20 components, got ${names.length}`);
    const fns = Object.keys(core).filter(k => !k.endsWith('_IDEAS'));
    assert.equal(fns.length, 20, `${label}: expected 20 core functions, got ${fns.length}`);
    for (const name of names) {
      const body = componentBody(src, name);
      const called = fns.filter(fn => new RegExp(`\\b${fn}\\b`).test(body));
      assert.ok(called.length >= 1, `${label} component ${name} calls no core function`);
    }
    for (const fn of fns) {
      assert.ok(new RegExp(`\\b${fn}\\b`).test(src), `${label} core function ${fn} never referenced in JSX`);
    }
  }
});

/* ---- CSS scope + zero-animation audits ---- */
test('css: only .w86a-/.w86b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w86a-') || cls.startsWith('w86b-'), `unscoped selector: .${cls}`);
  }
  assert.ok(!/(^|\n)\s*(body|html|\*|:root)\s*\{/.test(noComments), 'global rule found');
});

test('css: zero keyframes, zero animation properties', () => {
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'found @keyframes');
  assert.ok(!/keyframes/i.test(CSS_SRC), 'found keyframes word');
  assert.ok(!/(^|[;{\s])animation(-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?\s*:/i.test(CSS_SRC), 'found animation property');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'found transition property');
});

/* ---- esbuild real JSX parse audit ---- */
test('esbuild: both JSX files parse/transform cleanly', () => {
  for (const f of ['Wave86A.jsx', 'Wave86B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no forbidden brand anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `forbidden brand leaked in ${name}`);
    assert.ok(!src.includes('Dark' + 'Matter'), `forbidden brand leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no placeholder wording in logic', () => {
  const forbiddenExact = new RegExp('\\b' + 'mo' + 'ck' + '\\b', 'i');
  const verbExact = new RegExp('\\b' + 'simu' + 'late' + '\\b', 'i');
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!forbiddenExact.test(src), `placeholder mention in ${name}`);
    assert.ok(!verbExact.test(src), `placeholder mention in ${name}`);
  }
});
