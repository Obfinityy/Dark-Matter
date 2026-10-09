/**
 * wave84.test.js — Infinity AI · Wave 84
 * node:test + node:assert/strict. Registry coverage (20/20 for 53321–53340,
 * 20/20 for 53341–53360, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave84.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE84_A_IDEAS } from './wave84ACore.js';
import * as XA from './wave84ACore.js';
import { WAVE84_B_IDEAS } from './wave84BCores.js';
import * as XB from './wave84BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave84ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave84BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave84A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave84B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave84.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 84A ideas, 20/20 wave 84B ideas, zero skips', () => {
  assert.equal(WAVE84_A_IDEAS.length, 20);
  assert.equal(WAVE84_B_IDEAS.length, 20);
  const all = [...WAVE84_A_IDEAS, ...WAVE84_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53321 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE84_A_IDEAS, ...WAVE84_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53321: 'retrospective participation metrics', 53322: 'lesson translation layer', 53323: 'hunt debrief podcasts', 53324: 'lesson dependency graphs', 53325: 'retrospective bias checks', 53326: 'lesson retirement ceremonies', 53327: 'team lesson leaderboards', 53328: 'lesson embedding search', 53329: 'retrospective integration with tickets', 53330: 'lesson-driven checklist updates', 53331: 'post-incident learning reviews', 53332: 'lesson sharing with community', 53333: 'retrospective calibration sessions', 53334: 'lesson impact dashboards', 53335: 'micro-lesson capture', 53336: 'lesson context snapshots', 53337: 'retrospective follow-up hunts', 53338: 'lesson inheritance rules', 53339: 'annual lessons anthology', 53340: 'lesson-driven hunt kickoff rituals',
    53341: 'hunt replay theater', 53342: 'decision-point pausing', 53343: 'replay difficulty ratings', 53344: 'annotated replay overlays', 53345: 'branching replay scenarios', 53346: 'replay speed controls', 53347: 'finding-moment highlight reels', 53348: 'replay quiz generation', 53349: 'trainee-vs-agent comparisons', 53350: 'mistake replays', 53351: 'replay leaderboards', 53352: 'collaborative replay rooms', 53353: 'replay scenario library', 53354: 'redacted replay sharing', 53355: 'replay-based certifications', 53356: 'speed-run challenges', 53357: 'replay commentary crowdsourcing', 53358: 'counterfactual replay engine', 53359: 'replay attention heatmaps', 53360: 'mobile replay viewing',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave84 A spot checks ---- */
test('53321 computeRetrospectiveParticipationMetrics: silent participant flagged', () => {
  const v = XA.computeRetrospectiveParticipationMetrics([{ name: 'researcher-a' }, { name: 'researcher-b' }], [{ researcher: 'researcher-a', comments: 3, lessons: 1 }]);
  assert.equal(v.participationRate, 0.5);
  assert.equal(v.silentCount, 1);
  assert.equal(v.top.key, 'researcher-a');
});
test('53322 translateLessonContent: target languages produced', () => {
  const v = XA.translateLessonContent([{ id: 'l1', title: 'Auth checks', text: 'Auth endpoint check' }], { targetLanguages: ['es', 'en'] });
  assert.equal(v.count, 1);
  assert.ok(v.rows[0].translations.es);
  assert.ok(v.rows[0].translations.en);
  assert.equal(v.targetLanguages.length, 2);
});
test('53323 buildHuntDebriefPodcast: episode fitted from debrief', () => {
  const v = XA.buildHuntDebriefPodcast([{ id: 'hunt-1', findings: 3, debrief: Array(200).fill('auth').join(' ') }]);
  assert.equal(v.count, 1);
  assert.equal(v.episodeCount, 1);
  assert.equal(v.top.hunt, 'hunt-1');
});
test('53324 buildLessonDependencyGraph: edges and roots tracked', () => {
  const v = XA.buildLessonDependencyGraph([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: [] }]);
  assert.equal(v.edgeCount, 1);
  assert.equal(v.nodeCount, 2);
  assert.deepEqual(v.roots, ['b']);
});
test('53325 auditRetrospectiveBias: recency and outcome bias scored', () => {
  const v = XA.auditRetrospectiveBias([{ id: 'r1', text: 'Recent success win found shipped' }, { id: 'r2', text: 'Neutral process notes' }]);
  assert.equal(v.count, 2);
  assert.equal(v.rows[0].key, 'r1');
  assert.ok(v.rows[0].biasScore > v.rows[1].biasScore);
});
test('53326 planLessonRetirementCeremony: stale lesson retired', () => {
  const v = XA.planLessonRetirementCeremony([{ id: 'old', ageDays: 400 }, { id: 'fresh', ageDays: 10 }]);
  assert.equal(v.retirementCount, 1);
  assert.equal(v.retiring[0].key, 'old');
  assert.equal(v.activeCount, 1);
});
test('53327 buildTeamLessonLeaderboard: highest scorer ranked first', () => {
  const v = XA.buildTeamLessonLeaderboard([{ name: 'researcher-a', lessons: 4, applied: 3, upvotes: 5 }, { name: 'researcher-b', lessons: 1, applied: 0, upvotes: 1 }]);
  assert.equal(v.top.key, 'researcher-a');
  assert.equal(v.top.rank, 1);
  assert.equal(v.totalLessons, 5);
});
test('53328 searchLessonsByEmbedding: similar lesson found', () => {
  const v = XA.searchLessonsByEmbedding([{ id: 'l1', title: 'Auth checks', text: 'Admin auth endpoint' }, { id: 'l2', title: 'Route mapping', text: 'Map routes first' }], { text: 'auth endpoint' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.top.key, 'l1');
});
test('53329 buildTicketIntegrationPlan: synced retrospectives counted', () => {
  const v = XA.buildTicketIntegrationPlan([{ id: 'r1', ticketIds: ['T-1'] }, { id: 'r2' }], [{ id: 'T-1', status: 'open' }]);
  assert.equal(v.syncedCount, 1);
  assert.equal(v.retroOnlyCount, 1);
  assert.equal(v.ticketCount, 1);
});
test('53330 applyLessonDrivenChecklistUpdates: additions suggested', () => {
  const v = XA.applyLessonDrivenChecklistUpdates([{ id: 'c1', name: 'Web checklist', items: [] }], [{ id: 'l1', title: 'Auth lesson', targetClass: 'web', impact: 9 }]);
  assert.equal(v.totalAdditions, 1);
  assert.equal(v.updateCount, 1);
});
test('53331 reviewPostIncidentLearning: reviewed incident counted', () => {
  const v = XA.reviewPostIncidentLearning([{ id: 'inc-1', severity: 5, lessons: ['l1'], daysToReview: 3 }, { id: 'inc-2', severity: 2, lessons: [], daysToReview: 0 }]);
  assert.equal(v.reviewedCount, 1);
  assert.equal(v.top.key, 'inc-1');
});
test('53332 shareLessonsWithCommunity: clean lesson shareable', () => {
  const v = XA.shareLessonsWithCommunity([{ id: 'l1', title: 'Auth lesson', text: 'Check auth endpoints', impact: 8 }, { id: 'l2', title: 'Secret note', text: 'token=abc123', impact: 9 }]);
  assert.equal(v.sharedCount, 1);
  assert.equal(v.shared[0].key, 'l1');
});
test('53333 calibrateRetrospectiveSession: spread computed', () => {
  const v = XA.calibrateRetrospectiveSession([{ id: 'r1', score: 9 }, { id: 'r2', score: 5 }, { id: 'r3', score: 7 }]);
  assert.equal(v.spread, 4);
  assert.equal(v.mean, 7);
  assert.equal(v.count, 3);
});
test('53334 buildLessonImpactDashboard: impact rate aggregated', () => {
  const v = XA.buildLessonImpactDashboard([{ id: 'l1', appliedCount: 4, outcomeChangedCount: 3 }, { id: 'l2', appliedCount: 2, outcomeChangedCount: 0 }]);
  assert.equal(v.totalApplied, 6);
  assert.equal(v.totalChanged, 3);
  assert.equal(v.overallImpactRate, 0.5);
});
test('53335 captureMicroLesson: short entry within limit', () => {
  const v = XA.captureMicroLesson([{ id: 'm1', text: 'Check auth first' }, { id: 'm2', text: Array(60).fill('word').join(' ') }]);
  assert.equal(v.microCount, 1);
  assert.equal(v.oversizedCount, 1);
});
test('53336 snapshotLessonContext: linked hunt snapshot present', () => {
  const v = XA.snapshotLessonContext([{ id: 'l1', huntId: 'hunt-1' }, { id: 'l2', huntId: 'missing' }], [{ id: 'hunt-1', coverage: 0.8, stack: 'node' }]);
  assert.equal(v.snapshotCount, 1);
  assert.equal(v.orphanCount, 1);
});
test('53337 planRetrospectiveFollowUpHunts: dark areas queued', () => {
  const v = XA.planRetrospectiveFollowUpHunts([{ id: 'r1', darkAreas: ['admin', 'billing'], coverage: 0.4, findings: 1 }, { id: 'r2', darkAreas: [], coverage: 0.9, findings: 2 }]);
  assert.equal(v.followUpCount, 1);
  assert.equal(v.plannedHunts, 2);
});
test('53338 applyLessonInheritanceRules: scoped rule applied', () => {
  const v = XA.applyLessonInheritanceRules([{ id: 'l1', targetClass: 'web' }, { id: 'l2', targetClass: 'api' }], [{ name: 'web-rule', scope: 'web' }]);
  assert.equal(v.inheritedCount, 1);
  assert.equal(v.top.key, 'l1');
});
test('53339 compileAnnualLessonsAnthology: yearly top lessons compiled', () => {
  const v = XA.compileAnnualLessonsAnthology([{ id: 'l1', title: 'Top', impact: 9, appliedCount: 4, year: 2026 }, { id: 'l2', title: 'Old', impact: 10, year: 2025 }], { year: 2026 });
  assert.equal(v.anthologyCount, 1);
  assert.equal(v.top.key, 'l1');
  assert.equal(v.year, 2026);
});
test('53340 planLessonDrivenHuntKickoff: relevant lessons selected', () => {
  const v = XA.planLessonDrivenHuntKickoff({ targetClass: 'web', stack: 'node', id: 'hunt-new' }, [{ id: 'l1', title: 'Auth', targetClass: 'web', stack: 'node', impact: 5 }, { id: 'l2', title: 'Routes', targetClass: 'api', stack: 'go', impact: 1 }]);
  assert.equal(v.kickoffLessons.length, 2);
  assert.equal(v.top.key, 'l1');
  assert.equal(v.stepCount, 4);
});

/* ---- Wave84 B spot checks ---- */
test('53341 buildHuntReplayTheater: watchable replay staged', () => {
  const v = XB.buildHuntReplayTheater([{ id: 'r1', durationSec: 600, events: 20, findings: 3 }, { id: 'r2', durationSec: 0, events: 0, findings: 0 }]);
  assert.equal(v.watchableCount, 1);
  assert.equal(v.totalEvents, 20);
  assert.equal(v.top.key, 'r1');
});
test('53342 planDecisionPointPauses: decision pauses placed', () => {
  const v = XB.planDecisionPointPauses({ events: [{ id: 'e1', type: 'decision' }, { id: 'e2', type: 'action' }, { id: 'e3', decisionPoint: true }] });
  assert.equal(v.pauseCount, 2);
  assert.equal(v.pauseRate, 0.67);
});
test('53343 rateReplayDifficulty: expert tier assigned', () => {
  const v = XB.rateReplayDifficulty([{ id: 'hard', findings: 5, durationSec: 1200, steps: 10 }, { id: 'easy', findings: 0, durationSec: 60, steps: 1 }]);
  assert.equal(v.top.key, 'hard');
  assert.equal(v.top.tier, 'expert');
});
test('53344 buildAnnotatedReplayOverlays: overlays ordered by time', () => {
  const v = XB.buildAnnotatedReplayOverlays({ id: 'r1', durationSec: 600 }, [{ id: 'a2', atSec: 120, text: 'Later' }, { id: 'a1', atSec: 30, text: 'Early' }]);
  assert.equal(v.count, 2);
  assert.equal(v.rows[0].key, 'a1');
  assert.equal(v.density, 0.2);
});
test('53345 buildBranchingReplayScenarios: branch points counted', () => {
  const v = XB.buildBranchingReplayScenarios({ nodes: [{ id: 'n1', branches: [{ label: 'a' }, { label: 'b' }] }, { id: 'n2', branches: [{ label: 'a' }] }] });
  assert.equal(v.branchPointCount, 1);
  assert.equal(v.totalBranches, 3);
});
test('53346 buildReplaySpeedControls: speed tiers built', () => {
  const v = XB.buildReplaySpeedControls({ durationSec: 600 });
  assert.equal(v.count, 5);
  assert.equal(v.rows.find(r => r.speed === 2).effectiveSeconds, 300);
});
test('53347 buildFindingMomentHighlightReels: highlights extracted', () => {
  const v = XB.buildFindingMomentHighlightReels([{ id: 'r1', findingMoments: [{ id: 'm1', atSec: 100, severity: 5 }, { id: 'm2', atSec: 200, severity: 2 }] }]);
  assert.equal(v.totalHighlights, 2);
  assert.equal(v.top.topMoment.key, 'm1');
});
test('53348 generateReplayQuiz: quiz questions from decisions', () => {
  const v = XB.generateReplayQuiz({ events: [{ id: 'e1', type: 'decision', atSec: 30 }, { id: 'e2', type: 'action', atSec: 60 }] });
  assert.equal(v.count, 1);
  assert.equal(v.questions[0].key, 'e1');
});
test('53349 compareTraineeVsAgent: delta and winner computed', () => {
  const v = XB.compareTraineeVsAgent({ findings: 5, durationMinutes: 50 }, { findings: 3, durationMinutes: 45 });
  assert.equal(v.deltaFindings, 2);
  assert.equal(v.winner, 'trainee');
  assert.equal(v.traineeAhead, true);
});
test('53350 buildMistakeReplays: mistakes compiled', () => {
  const v = XB.buildMistakeReplays([{ id: 'r1', mistakes: [{ id: 'ms1', severity: 3 }] }, { id: 'r2', mistakes: [] }]);
  assert.equal(v.totalMistakes, 1);
  assert.equal(v.mistakeReplayCount, 1);
});
test('53351 buildReplayLeaderboard: top replay ranked first', () => {
  const v = XB.buildReplayLeaderboard([{ id: 'r1', views: 100, completions: 80, rating: 5 }, { id: 'r2', views: 10, completions: 2, rating: 2 }]);
  assert.equal(v.top.key, 'r1');
  assert.equal(v.top.rank, 1);
  assert.equal(v.totalViews, 110);
});
test('53352 buildCollaborativeReplayRoom: active participants counted', () => {
  const v = XB.buildCollaborativeReplayRoom({ name: 'room-1' }, [{ name: 'a', role: 'host' }, { name: 'b', joined: false }]);
  assert.equal(v.activeCount, 1);
  assert.equal(v.capacity, 8);
});
test('53353 buildReplayScenarioLibrary: curated scenarios flagged', () => {
  const v = XB.buildReplayScenarioLibrary([{ id: 's1', title: 'A', tags: ['auth', 'idor'] }, { id: 's2', title: 'B', tags: [] }]);
  assert.equal(v.curatedCount, 1);
  assert.equal(v.count, 2);
});
test('53354 buildRedactedReplayShare: identifiers redacted', () => {
  const v = XB.buildRedactedReplayShare({ id: 'r1', events: [{ id: 'e1', text: 'Contact a@example.com token=secret123', atSec: 10 }] });
  assert.equal(v.totalRedactions, 2);
  assert.ok(!v.rows[0].text.includes('@example.com'));
});
test('53355 issueReplayBasedCertifications: passing candidate certified', () => {
  const v = XB.issueReplayBasedCertifications([{ name: 'a', quizScore: 85, replaysWatched: 3 }, { name: 'b', quizScore: 40, replaysWatched: 1 }]);
  assert.equal(v.certifiedCount, 1);
  assert.equal(v.certified[0].key, 'a');
});
test('53356 buildSpeedRunChallenges: beaten challenge detected', () => {
  const v = XB.buildSpeedRunChallenges([{ id: 'c1', targetSeconds: 300, bestSeconds: 240, attempts: 3 }, { id: 'c2', targetSeconds: 200, bestSeconds: 250, attempts: 1 }]);
  assert.equal(v.beatenCount, 1);
  assert.equal(v.top.key, 'c1');
  assert.equal(v.top.marginSeconds, 60);
});
test('53357 crowdsourceReplayCommentary: helpful comments surfaced', () => {
  const v = XB.crowdsourceReplayCommentary([{ id: 'c1', text: 'Useful note', atSec: 30, upvotes: 5 }, { id: 'c2', text: 'Minor', atSec: 60, upvotes: 0 }]);
  assert.equal(v.helpfulCount, 1);
  assert.equal(v.top.key, 'c1');
});
test('53358 runCounterfactualReplayEngine: projected delta computed', () => {
  const v = XB.runCounterfactualReplayEngine({ findings: 3, events: [{ id: 'e1' }, { id: 'e2' }] }, { atIndex: 0, label: 'alt-path' });
  assert.equal(v.projectedFindings, 4);
  assert.equal(v.baselineFindings, 3);
  assert.equal(v.alternateLabel, 'alt-path');
});
test('53359 buildReplayAttentionHeatmap: peak bucket identified', () => {
  const v = XB.buildReplayAttentionHeatmap([{ atSec: 12, pauses: 2 }, { atSec: 15, pauses: 1 }, { atSec: 45, pauses: 0 }]);
  assert.equal(v.bucketCount, 2);
  assert.equal(v.peak.bucket, 10);
});
test('53360 buildMobileReplayView: chapters built for mobile', () => {
  const v = XB.buildMobileReplayView({ durationSec: 600, events: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, atSec: i * 10 })) });
  assert.equal(v.chapterCount, 3);
  assert.equal(v.mobileReady, true);
  assert.equal(v.count, 12);
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
test('css: only .w84a-/.w84b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w84a-') || cls.startsWith('w84b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave84A.jsx', 'Wave84B.jsx']) {
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
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `placeholder mention in ${name}`);
    assert.ok(!/\bsimulate\b/i.test(src), `placeholder mention in ${name}`);
  }
});
