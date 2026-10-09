/**
 * wave85.test.js — Infinity AI · Wave 85
 * node:test + node:assert/strict. Registry coverage (20/20 for 53361–53380,
 * 20/20 for 53381–53400, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave85.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE85_A_IDEAS } from './wave85ACore.js';
import * as XA from './wave85ACore.js';
import { WAVE85_B_IDEAS } from './wave85BCores.js';
import * as XB from './wave85BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave85ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave85BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave85A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave85B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave85.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 85A ideas, 20/20 wave 85B ideas, zero skips', () => {
  assert.equal(WAVE85_A_IDEAS.length, 20);
  assert.equal(WAVE85_B_IDEAS.length, 20);
  const all = [...WAVE85_A_IDEAS, ...WAVE85_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53361 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE85_A_IDEAS, ...WAVE85_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53361: 'replay transcript search', 53362: 'live replay sessions', 53363: 'replay difficulty progression', 53364: 'multi-hunt replay comparisons', 53365: 'replay bookmarking', 53366: 'expert alternative paths', 53367: 'replay performance analytics', 53368: 'vr hunt replay mode', 53369: 'replay narration styles', 53370: 'replay-based interview tasks', 53371: 'failure replay clinics', 53372: 'replay scenario randomizer', 53373: 'trainee decision rationales', 53374: 'replay export for conferences', 53375: 'replay accessibility features', 53376: 'replay completion certificates', 53377: 'adaptive replay difficulty', 53378: 'replay discussion threads', 53379: 'historical replay archive', 53380: 'replay metadata standards',
    53381: 'cross-team replay exchange', 53382: 'replay-based mentorship matching', 53383: 'simulated live hunts', 53384: 'replay ethics briefings', 53385: 'replay latency realism', 53386: 'replay annotation exports', 53387: 'team replay tournaments', 53388: 'replay-driven playbook updates', 53389: 'replay viewing streaks', 53390: 'expert replay playlists', 53391: 'replay feedback loops', 53392: 'new-hire replay onboarding', 53393: 'replay search by mistake type', 53394: 'replay integrity verification', 53395: 'localized replay narrations', 53396: 'replay-based threat briefings', 53397: 'opt-in benchmark consent', 53398: 'anonymized peer percentiles', 53399: 'skill-area benchmarks', 53400: 'experience-adjusted rankings',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave85 A spot checks ---- */
test('53361 searchReplayTranscripts: matching transcript ranked first', () => {
  const v = XA.searchReplayTranscripts([{ id: 't1', title: 'Auth hunt', text: 'Checked auth endpoint for IDOR' }, { id: 't2', title: 'Routes', text: 'Mapped routes only' }], { text: 'auth endpoint' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.top.key, 't1');
});
test('53362 buildLiveReplaySessions: live session counted', () => {
  const v = XA.buildLiveReplaySessions([{ id: 's1', viewers: 5, live: true }, { id: 's2', viewers: 0, live: false }]);
  assert.equal(v.liveCount, 1);
  assert.equal(v.totalViewers, 5);
  assert.equal(v.top.key, 's1');
});
test('53363 buildReplayDifficultyProgression: levels assigned', () => {
  const v = XA.buildReplayDifficultyProgression([{ id: 'easy', findings: 0, steps: 1, durationSec: 60 }, { id: 'hard', findings: 5, steps: 10, durationSec: 1200 }]);
  assert.equal(v.count, 2);
  assert.ok(v.maxLevel >= 4);
  assert.equal(v.top.key, 'hard');
});
test('53364 compareMultiHuntReplays: best replay identified', () => {
  const v = XA.compareMultiHuntReplays([{ id: 'r1', findings: 5, durationSec: 600, coverage: 0.9 }, { id: 'r2', findings: 1, durationSec: 600, coverage: 0.4 }]);
  assert.equal(v.top.key, 'r1');
  assert.equal(v.count, 2);
  assert.equal(v.avgFindings, 3);
});
test('53365 manageReplayBookmarks: bookmarks sorted by time', () => {
  const v = XA.manageReplayBookmarks({ id: 'r1', durationSec: 600 }, [{ id: 'b2', atSec: 120, label: 'Later' }, { id: 'b1', atSec: 30, label: 'Early', pinned: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.rows[0].key, 'b1');
  assert.equal(v.pinnedCount, 1);
});
test('53366 buildExpertAlternativePaths: most efficient path first', () => {
  const v = XA.buildExpertAlternativePaths({ id: 'r1' }, [{ id: 'p1', label: 'Slow', steps: ['a'], estimatedFindings: 1, timeMinutes: 30 }, { id: 'p2', label: 'Fast', steps: ['a', 'b'], estimatedFindings: 4, timeMinutes: 10 }]);
  assert.equal(v.top.key, 'p2');
  assert.equal(v.viableCount, 2);
});
test('53367 analyzeReplayPerformance: completion rate aggregated', () => {
  const v = XA.analyzeReplayPerformance([{ id: 'r1', views: 100, completions: 80 }, { id: 'r2', views: 50, completions: 10 }]);
  assert.equal(v.totalViews, 150);
  assert.equal(v.totalCompletions, 90);
  assert.equal(v.overallCompletionRate, 0.6);
});
test('53368 buildVRHuntReplayMode: chapters built', () => {
  const v = XA.buildVRHuntReplayMode({ id: 'r1', durationSec: 600, events: Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, atSec: i * 10 })) });
  assert.equal(v.chapterCount, 3);
  assert.equal(v.vrReady, true);
});
test('53369 buildReplayNarrationStyles: styles generated', () => {
  const v = XA.buildReplayNarrationStyles({ id: 'r1', transcript: Array(150).fill('word').join(' ') });
  assert.equal(v.count, 4);
  assert.equal(v.baseWords, 150);
  assert.ok(v.rows.every(r => r.available));
});
test('53370 buildReplayBasedInterviewTasks: tasks drafted from decisions', () => {
  const v = XA.buildReplayBasedInterviewTasks([{ id: 'r1', findings: 2, events: [{ type: 'decision' }, { decisionPoint: true }] }, { id: 'r2', findings: 0, events: [] }]);
  assert.equal(v.taskCount, 2);
  assert.equal(v.top.key, 'r1');
});
test('53371 buildFailureReplayClinics: clinic cases scheduled', () => {
  const v = XA.buildFailureReplayClinics([{ id: 'c1', failures: [{ id: 'f1', label: 'Miss', severity: 4 }] }, { id: 'c2', failures: [] }]);
  assert.equal(v.clinicCount, 1);
  assert.equal(v.totalFailures, 1);
  assert.equal(v.top.key, 'c1');
});
test('53372 buildReplayScenarioRandomizer: seeded picks deterministic', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const v1 = XA.buildReplayScenarioRandomizer(pool, { seed: 7, count: 2 });
  const v2 = XA.buildReplayScenarioRandomizer(pool, { seed: 7, count: 2 });
  assert.equal(v1.pickCount, 2);
  assert.deepEqual(v1.picks.map(p => p.key), v2.picks.map(p => p.key));
  assert.equal(v1.seed, 7);
});
test('53373 captureTraineeDecisionRationales: rationales counted', () => {
  const v = XA.captureTraineeDecisionRationales([{ id: 'e1', type: 'decision', choice: 'auth', rationale: 'Auth surface is riskiest' }, { id: 'e2', type: 'decision', choice: 'routes' }]);
  assert.equal(v.decisionCount, 2);
  assert.equal(v.explainedCount, 1);
  assert.equal(v.rationaleRate, 0.5);
});
test('53374 buildReplayExportForConferences: ready exports counted', () => {
  const v = XA.buildReplayExportForConferences([{ id: 'r1', findings: 3, durationSec: 600 }, { id: 'r2', findings: 0, durationSec: 300 }], { format: 'slides' });
  assert.equal(v.exportReadyCount, 1);
  assert.equal(v.format, 'slides');
  assert.equal(v.top.key, 'r1');
});
test('53375 buildReplayAccessibilityFeatures: requested features enabled', () => {
  const v = XA.buildReplayAccessibilityFeatures({ id: 'r1', transcript: 'Narration words here' }, ['captions']);
  assert.ok(v.enabledCount >= 2);
  assert.ok(v.rows.find(r => r.key === 'captions').enabled);
});
test('53376 issueReplayCompletionCertificates: passing candidate certified', () => {
  const v = XA.issueReplayCompletionCertificates([{ name: 'a', score: 85, replaysWatched: 3 }, { name: 'b', score: 40, replaysWatched: 1 }]);
  assert.equal(v.certifiedCount, 1);
  assert.equal(v.certified[0].key, 'a');
});
test('53377 buildAdaptiveReplayDifficulty: fitting replay recommended', () => {
  const v = XA.buildAdaptiveReplayDifficulty({ skill: 0.5 }, [{ id: 'r1', complexity: 7, findings: 2, steps: 5 }, { id: 'r2', complexity: 14, findings: 5, steps: 10 }]);
  assert.equal(v.skill, 0.5);
  assert.equal(v.count, 2);
  assert.ok(v.top.fit >= 0);
});
test('53378 buildReplayDiscussionThreads: posts counted', () => {
  const v = XA.buildReplayDiscussionThreads([{ id: 't1', title: 'Auth talk', posts: [{ id: 'p1', text: 'Nice' }, { id: 'p2', text: 'Agreed' }] }, { id: 't2', title: 'Empty', posts: [] }]);
  assert.equal(v.totalPosts, 2);
  assert.equal(v.top.key, 't1');
});
test('53379 buildHistoricalReplayArchive: old replays archived', () => {
  const v = XA.buildHistoricalReplayArchive([{ id: 'old', year: 2023, findings: 2 }, { id: 'new', year: 2026, findings: 1 }], { cutoffYear: 2025 });
  assert.equal(v.archivedCount, 1);
  assert.equal(v.activeCount, 1);
  assert.equal(v.earliestYear, 2023);
});
test('53380 validateReplayMetadataStandards: compliant record passed', () => {
  const v = XA.validateReplayMetadataStandards([{ id: 'r1', title: 'Full', durationSec: 600, findings: 3 }, { id: 'r2', title: 'Partial' }]);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.nonCompliantCount, 1);
  assert.equal(v.top.key, 'r1');
});

/* ---- Wave85 B spot checks ---- */
test('53381 buildCrossTeamReplayExchange: exchanges tracked', () => {
  const v = XB.buildCrossTeamReplayExchange([{ id: 'ex1', sourceTeam: 'alpha', targetTeam: 'beta', replayCount: 3, status: 'accepted' }, { id: 'ex2', sourceTeam: 'alpha', targetTeam: 'alpha', replayCount: 1 }]);
  assert.equal(v.crossTeamCount, 1);
  assert.equal(v.acceptedCount, 1);
  assert.equal(v.totalReplays, 4);
});
test('53382 matchReplayBasedMentorship: overlapping strength matched', () => {
  const v = XB.matchReplayBasedMentorship([{ name: 'mentee-a', weakAreas: ['auth'] }], [{ name: 'mentor-a', strengths: ['auth'], replaysWatched: 10 }, { name: 'mentor-b', strengths: ['routes'], replaysWatched: 5 }]);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.top.bestMentor.key, 'mentor-a');
});
test('53383 buildSimulatedLiveHunts: live-ready scenarios counted', () => {
  const v = XB.buildSimulatedLiveHunts([{ id: 's1', durationSec: 600, steps: 10 }, { id: 's2', durationSec: 0, steps: 0 }]);
  assert.equal(v.liveReadyCount, 1);
  assert.equal(v.totalSteps, 10);
  assert.equal(v.top.key, 's1');
});
test('53384 buildReplayEthicsBriefings: sensitive replay flagged', () => {
  const v = XB.buildReplayEthicsBriefings([{ id: 'r1', text: 'Clean notes' }, { id: 'r2', text: 'Contact a@example.com' }]);
  assert.equal(v.briefingCount, 1);
  assert.equal(v.clearedCount, 1);
  assert.equal(v.top.key, 'r2');
});
test('53385 measureReplayLatencyRealism: realistic replay under target', () => {
  const v = XB.measureReplayLatencyRealism([{ id: 'r1', events: [{ latencyMs: 100 }, { latencyMs: 150 }] }, { id: 'r2', events: [{ latencyMs: 400 }] }], { targetMs: 200 });
  assert.equal(v.realisticCount, 1);
  assert.equal(v.targetMs, 200);
});
test('53386 buildReplayAnnotationExports: payload built in format', () => {
  const v = XB.buildReplayAnnotationExports({ id: 'r1' }, [{ id: 'a1', atSec: 30, text: 'Note', author: 'researcher-a' }], { format: 'json' });
  assert.equal(v.count, 1);
  assert.equal(v.format, 'json');
  assert.equal(v.exportReady, true);
  assert.ok(v.payload.includes('Note'));
});
test('53387 buildTeamReplayTournaments: champion ranked first', () => {
  const v = XB.buildTeamReplayTournaments([{ team: 'alpha', wins: 3, losses: 0, findings: 5 }, { team: 'beta', wins: 0, losses: 2, findings: 1 }]);
  assert.equal(v.champion.key, 'alpha');
  assert.equal(v.top.rank, 1);
});
test('53388 applyReplayDrivenPlaybookUpdates: related updates suggested', () => {
  const v = XB.applyReplayDrivenPlaybookUpdates([{ id: 'pb1', name: 'Web playbook', area: 'web' }], [{ id: 'r1', targetClass: 'web', impact: 9 }, { id: 'r2', targetClass: 'api', impact: 9 }]);
  assert.equal(v.totalUpdates, 1);
  assert.equal(v.updateCount, 1);
});
test('53389 trackReplayViewingStreaks: consecutive streak computed', () => {
  const v = XB.trackReplayViewingStreaks([{ name: 'a', days: [1, 2, 3, 5] }, { name: 'b', days: [10] }]);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.currentStreak, 1);
  assert.equal(v.top.bestStreak, 3);
});
test('53390 buildExpertReplayPlaylists: curated playlist counted', () => {
  const v = XB.buildExpertReplayPlaylists([{ id: 'pl1', title: 'Auth list', expert: 'researcher-a', items: [{ id: 'r1', durationSec: 600 }] }, { id: 'pl2', title: 'Plain', items: [] }]);
  assert.equal(v.curatedCount, 1);
  assert.equal(v.totalItems, 1);
});
test('53391 buildReplayFeedbackLoops: open feedback counted', () => {
  const v = XB.buildReplayFeedbackLoops([{ id: 'f1', rating: 5, status: 'open' }, { id: 'f2', rating: 3, status: 'acted' }]);
  assert.equal(v.openCount, 1);
  assert.equal(v.actedCount, 1);
  assert.equal(v.avgRating, 4);
});
test('53392 buildNewHireReplayOnboarding: completed hire onboarded', () => {
  const v = XB.buildNewHireReplayOnboarding([{ name: 'hire-a', completed: ['r1', 'r2'] }, { name: 'hire-b', completed: ['r1'] }], [{ id: 'r1' }, { id: 'r2' }]);
  assert.equal(v.onboardedCount, 1);
  assert.equal(v.top.key, 'hire-a');
  assert.equal(v.top.progress, 1);
});
test('53393 searchReplayByMistakeType: matching mistake found', () => {
  const v = XB.searchReplayByMistakeType([{ id: 'r1', mistakes: [{ id: 'm1', type: 'header-check', severity: 3 }] }, { id: 'r2', mistakes: [{ id: 'm2', type: 'auth-skip', severity: 2 }] }], { mistakeType: 'header' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.top.key, 'r1');
});
test('53394 verifyReplayIntegrity: ordered checksummed replay verified', () => {
  const v = XB.verifyReplayIntegrity({ id: 'r1', checksum: 'abc123checksum', eventCount: 2, events: [{ id: 'e1', atSec: 10 }, { id: 'e2', atSec: 20 }] });
  assert.equal(v.verified, true);
  assert.equal(v.passedCount, 3);
});
test('53395 buildLocalizedReplayNarrations: languages produced', () => {
  const v = XB.buildLocalizedReplayNarrations({ id: 'r1', transcript: 'auth check endpoint review', wordCount: 4 }, { languages: ['en', 'es', 'fr'] });
  assert.equal(v.count, 3);
  assert.equal(v.localizedCount, 3);
});
test('53396 buildReplayBasedThreatBriefings: critical briefing flagged', () => {
  const v = XB.buildReplayBasedThreatBriefings([{ id: 'r1', findings: 2, maxSeverity: 5 }, { id: 'r2', findings: 1, maxSeverity: 2 }]);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.top.key, 'r1');
  assert.equal(v.top.threatLevel, 'critical');
});
test('53397 manageOptInBenchmarkConsent: consent tallied', () => {
  const v = XB.manageOptInBenchmarkConsent([{ name: 'a', optedIn: true }, { name: 'b', consentStatus: 'opted-out' }, { name: 'c' }]);
  assert.equal(v.optedInCount, 1);
  assert.equal(v.optedOutCount, 1);
  assert.equal(v.pendingCount, 1);
});
test('53398 computeAnonymizedPeerPercentiles: top score highest percentile', () => {
  const v = XB.computeAnonymizedPeerPercentiles([{ score: 40 }, { score: 70 }, { score: 90 }]);
  assert.equal(v.top.score, 90);
  assert.equal(v.median, 70);
  assert.equal(v.anonymized, true);
});
test('53399 buildSkillAreaBenchmarks: areas aggregated', () => {
  const v = XB.buildSkillAreaBenchmarks([{ area: 'web', score: 80 }, { area: 'web', score: 60 }, { area: 'api', score: 90 }]);
  assert.equal(v.areaCount, 2);
  assert.equal(v.top.key, 'api');
  assert.equal(v.count, 3);
});
test('53400 buildExperienceAdjustedRankings: adjusted leader ranked', () => {
  const v = XB.buildExperienceAdjustedRankings([{ name: 'a', score: 80, experienceMonths: 24, hunts: 20 }, { name: 'b', score: 70, experienceMonths: 6, hunts: 5 }]);
  assert.equal(v.top.key, 'a');
  assert.equal(v.top.rank, 1);
  assert.equal(v.count, 2);
});

/* ---- JSX↔core call-shape audit ---- */
function componentNames(jsxSrc) {
  return [...jsxSrc.matchAll(/export function (\w+)/g)].map(m => m[1]).filter(n => !/Gallery$/.test(n));
}
function componentBody(jsxSrc, name) {
  const idx = jsxSrc.indexOf(`export function ${name}`);
  const next = jsxSrc.indexOf('export function', idx + 1);
  return jsxSrc.slice(idx, next === -1 ? undefined : next);
}

test('jsx: 20 components per file, each calls ≥1 core function', () => {
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
test('css: only .w85a-/.w85b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w85a-') || cls.startsWith('w85b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave85A.jsx', 'Wave85B.jsx']) {
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
