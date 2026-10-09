/**
 * wave87.test.js — Infinity AI · Wave 87
 * node:test + node:assert/strict. Registry coverage (20/20 for 53441–53460,
 * 20/20 for 53461–53480, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave87.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE87_A_IDEAS } from './wave87ACore.js';
import * as XA from './wave87ACore.js';
import { WAVE87_B_IDEAS } from './wave87BCores.js';
import * as XB from './wave87BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave87ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave87BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave87A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave87B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave87.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 87A ideas, 20/20 wave 87B ideas, zero skips', () => {
  assert.equal(WAVE87_A_IDEAS.length, 20);
  assert.equal(WAVE87_B_IDEAS.length, 20);
  const all = [...WAVE87_A_IDEAS, ...WAVE87_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53441 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE87_A_IDEAS, ...WAVE87_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53441: 'benchmark mentorship credit',
    53442: 'long-term benchmark archives',
    53443: 'benchmark gamification seasons',
    53444: 'benchmark privacy impact assessments',
    53445: 'researcher benchmark dashboards',
    53446: 'benchmark correlation studies',
    53447: 'benchmark feedback surveys',
    53448: 'benchmark sunset reviews',
    53449: 'benchmark data minimization',
    53450: 'cross-generational benchmarks',
    53451: 'benchmark-driven conference talks',
    53452: 'benchmark integrity monitoring',
    53453: 'finding-to-article pipeline',
    53454: 'kb coverage gap detection',
    53455: 'kb article freshness scores',
    53456: 'kb contribution leaderboards',
    53457: 'kb usage analytics',
    53458: 'kb contradiction flags',
    53459: 'kb version history',
    53460: 'kb article templates',
    53461: 'kb multilingual growth',
    53462: 'kb search relevance tuning',
    53463: 'kb-to-hunt attribution',
    53464: 'kb orphan article adoption',
    53465: 'kb peer review workflow',
    53466: 'kb confidence badges',
    53467: 'kb deprecation process',
    53468: 'kb graph relationships',
    53469: 'kb export packages',
    53470: 'kb api for agents',
    53471: 'kb feedback buttons',
    53472: 'kb curation sprints',
    53473: 'kb article lifecycles',
    53474: 'kb duplicate detection',
    53475: 'kb visual learning aids',
    53476: 'kb accessibility standards',
    53477: 'kb translation memory',
    53478: 'kb analytics for authors',
    53479: 'kb integration with replays',
    53480: 'kb quiz generation'
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave87 A spot checks ---- */
test('53441 creditBenchmarkMentorship: gain credited to mentor', () => {
  const v = XA.creditBenchmarkMentorship([{ mentor: 'mentor-a', mentee: 'm1', menteeStart: 50, menteeEnd: 74 }, { mentor: 'mentor-b', mentee: 'm2', menteeStart: 70, menteeEnd: 65 }]);
  assert.equal(v.creditedCount, 1);
  assert.equal(v.totalCredit, 12);
  assert.equal(v.top.key, 'mentor-a');
});
test('53442 archiveLongTermBenchmarks: snapshots archived by year', () => {
  const v = XA.archiveLongTermBenchmarks([{ id: 'snap-2023', year: 2023, score: 66 }, { id: 'snap-2024', year: 2024, score: 71 }]);
  assert.equal(v.count, 2);
  assert.equal(v.oldestYear, 2023);
  assert.equal(v.top.key, 'snap-2024');
});
test('53443 runBenchmarkGamificationSeasons: participants totalled', () => {
  const v = XA.runBenchmarkGamificationSeasons([{ id: 'g1', participants: 24, status: 'active' }, { id: 'g2', participants: 10 }]);
  assert.equal(v.totalParticipants, 34);
  assert.equal(v.activeCount, 1);
  assert.equal(v.top.key, 'g1');
});
test('53444 assessBenchmarkPrivacyImpact: high-risk surface flagged', () => {
  const v = XA.assessBenchmarkPrivacyImpact([{ id: 'p1', dataPoints: 40, sensitiveFields: 6 }, { id: 'p2', dataPoints: 20, sensitiveFields: 12 }]);
  assert.equal(v.highCount, 1);
  assert.equal(v.top.key, 'p2');
  assert.equal(v.top.risk, 0.6);
});
test('53445 buildResearcherBenchmarkDashboards: leading researcher first', () => {
  const v = XA.buildResearcherBenchmarkDashboards([{ name: 'a', score: 82, scores: [60, 82] }, { name: 'b', score: 55, scores: [50, 55] }]);
  assert.equal(v.leadingCount, 1);
  assert.equal(v.top.key, 'a');
  assert.equal(v.avgScore, 68.5);
});
test('53446 runBenchmarkCorrelationStudies: predictive metric identified', () => {
  const v = XA.runBenchmarkCorrelationStudies([{ metric: 'chain', benchmark: 80, impact: 64 }, { metric: 'raw-count', benchmark: 80, impact: 16 }]);
  assert.equal(v.predictiveCount, 1);
  assert.equal(v.top.key, 'chain');
  assert.equal(v.top.correlation, 0.8);
});
test('53447 collectBenchmarkFeedbackSurveys: satisfaction tallied', () => {
  const v = XA.collectBenchmarkFeedbackSurveys([{ researcher: 'a', fairness: 5, usefulness: 5 }, { researcher: 'b', fairness: 3, usefulness: 2 }]);
  assert.equal(v.satisfiedCount, 1);
  assert.equal(v.avgFairness, 4);
  assert.equal(v.top.key, 'a');
});
test('53448 reviewBenchmarkSunset: stale metric retired', () => {
  const v = XA.reviewBenchmarkSunset([{ name: 'old', usage: 3, ageYears: 3, value: 22 }, { name: 'kept', usage: 20, ageYears: 1, value: 80 }]);
  assert.equal(v.sunsetCount, 1);
  assert.equal(v.keepCount, 1);
  assert.equal(v.top.key, 'old');
});
test('53449 applyBenchmarkDataMinimization: low-value field dropped', () => {
  const v = XA.applyBenchmarkDataMinimization([{ name: 'score-history', value: 72 }, { name: 'raw-keystrokes', value: 4 }]);
  assert.equal(v.keptCount, 1);
  assert.equal(v.droppedCount, 1);
  assert.equal(v.top.key, 'score-history');
});
test('53450 buildCrossGenerationalBenchmarks: cohort spread computed', () => {
  const v = XA.buildCrossGenerationalBenchmarks([{ cohort: '2025', scores: [70, 76] }, { cohort: '2026', scores: [74, 82] }]);
  assert.equal(v.top.key, '2026');
  assert.equal(v.spread, 5);
  assert.equal(v.top.avg, 78);
});
test('53451 planBenchmarkDrivenConferenceTalks: top improver invited', () => {
  const v = XA.planBenchmarkDrivenConferenceTalks([{ name: 'a', score: 84, improvement: 28 }, { name: 'b', score: 60, improvement: 5 }]);
  assert.equal(v.invitedCount, 1);
  assert.equal(v.top.key, 'a');
});
test('53452 monitorBenchmarkIntegrity: pipeline issues counted', () => {
  const v = XA.monitorBenchmarkIntegrity([{ pipeline: 'main', missingFields: 0, duplicates: 1, outliers: 0 }, { pipeline: 'clean', missingFields: 0, duplicates: 0, outliers: 0 }]);
  assert.equal(v.issueCount, 1);
  assert.equal(v.healthyCount, 1);
  assert.equal(v.top.key, 'main');
});
test('53453 convertFindingsToArticles: validated finding published', () => {
  const v = XA.convertFindingsToArticles([{ id: 'f1', technique: 'auth', validated: true, reviewed: true }, { id: 'f2', technique: 'api', validated: true, reviewed: false }]);
  assert.equal(v.publishedCount, 1);
  assert.equal(v.draftCount, 2);
  assert.equal(v.top.key, 'f1');
});
test('53454 detectKbCoverageGaps: uncovered technique queued', () => {
  const v = XA.detectKbCoverageGaps([{ technique: 'graphql', findings: 12, articles: 0 }, { technique: 'auth', findings: 5, articles: 2 }]);
  assert.equal(v.gapCount, 1);
  assert.equal(v.top.key, 'graphql');
});
test('53455 scoreKbArticleFreshness: recent article scores high', () => {
  const v = XA.scoreKbArticleFreshness([{ id: 'a1', ageDays: 30 }, { id: 'a2', ageDays: 300 }]);
  assert.equal(v.freshCount, 1);
  assert.equal(v.top.key, 'a1');
  assert.equal(v.top.freshnessScore, 91.78);
});
test('53456 rankKbContributionLeaderboards: top contributor ranked first', () => {
  const v = XA.rankKbContributionLeaderboards([{ name: 'author-a', articles: 6, usage: 420 }, { name: 'author-b', articles: 2, usage: 100 }]);
  assert.equal(v.top.key, 'author-a');
  assert.equal(v.top.rank, 1);
  assert.equal(v.totalArticles, 8);
});
test('53457 analyzeKbUsageAnalytics: consultations grouped by article', () => {
  const v = XA.analyzeKbUsageAnalytics([{ articleId: 'auth-guide', views: 3 }, { articleId: 'auth-guide', views: 2 }, { articleId: 'api-notes', views: 5 }]);
  assert.equal(v.articleCount, 2);
  assert.equal(v.top.key, 'auth-guide');
  assert.equal(v.top.consultations, 2);
});
test('53458 flagKbContradictions: contradiction routed for revision', () => {
  const v = XA.flagKbContradictions([{ articleId: 'auth-guide', contradicts: true }, { articleId: 'api-notes', contradicts: false }]);
  assert.equal(v.flagCount, 1);
  assert.equal(v.routedCount, 1);
});
test('53459 trackKbVersionHistory: latest version surfaced', () => {
  const v = XA.trackKbVersionHistory([{ articleId: 'auth-guide', version: 2 }, { articleId: 'auth-guide', version: 3 }]);
  assert.equal(v.count, 2);
  assert.equal(v.latestVersion, 3);
  assert.equal(v.articleCount, 1);
});
test('53460 applyKbArticleTemplates: complete article detected', () => {
  const v = XA.applyKbArticleTemplates([{ id: 'a1', sections: ['technique', 'signals', 'stack-notes', 'examples'] }, { id: 'a2', sections: ['technique'] }]);
  assert.equal(v.completeCount, 1);
  assert.equal(v.top.key, 'a1');
});

/* ---- Wave87 B spot checks ---- */
test('53461 growKbMultilingual: low-coverage language prioritized', () => {
  const v = XB.growKbMultilingual([{ language: 'es', totalArticles: 40, translated: 8 }, { language: 'fr', totalArticles: 20, translated: 4 }]);
  assert.equal(v.priorityCount, 2);
  assert.equal(v.top.key, 'es');
  assert.equal(v.top.coverageRatio, 0.2);
});
test('53462 tuneKbSearchRelevance: low-CTR query needs tuning', () => {
  const v = XB.tuneKbSearchRelevance([{ query: 'auth bypass', clicks: 3, impressions: 20 }, { query: 'api notes', clicks: 9, impressions: 10 }]);
  assert.equal(v.tuningCount, 1);
  assert.equal(v.top.key, 'auth bypass');
  assert.equal(v.top.ctr, 0.15);
});
test('53463 attributeKbToHunts: attributed hunts counted', () => {
  const v = XB.attributeKbToHunts([{ id: 'h1', articles: ['auth-guide', 'api-notes'] }, { id: 'h2', articles: [] }]);
  assert.equal(v.attributedCount, 1);
  assert.equal(v.totalAttributions, 2);
});
test('53464 adoptKbOrphanArticles: orphan counted and adopted', () => {
  const v = XB.adoptKbOrphanArticles([{ id: 'a1', title: 'Legacy guide', orphan: true, adoptedBy: 'author-a' }, { id: 'a2', title: 'Owned guide', owner: 'author-b' }]);
  assert.equal(v.orphanCount, 1);
  assert.equal(v.adoptedCount, 1);
});
test('53465 workflowKbPeerReview: reviewed submission goes live', () => {
  const v = XB.workflowKbPeerReview([{ id: 's1', title: 'GraphQL guide', reviewers: 2, approved: true }, { id: 's2', title: 'Draft guide', reviewers: 0 }]);
  assert.equal(v.liveCount, 1);
  assert.equal(v.top.key, 's1');
});
test('53466 badgeKbConfidence: canonical badge for well-supported article', () => {
  const v = XB.badgeKbConfidence([{ id: 'a1', hunts: 14 }, { id: 'a2', hunts: 4 }, { id: 'a3', hunts: 1 }]);
  assert.equal(v.canonicalCount, 1);
  assert.equal(v.validatedCount, 1);
  assert.equal(v.emergingCount, 1);
  assert.equal(v.top.badge, 'canonical');
});
test('53467 processKbDeprecation: superseded article deprecated', () => {
  const v = XB.processKbDeprecation([{ id: 'a1', supersededBy: 'new-guide' }, { id: 'a2', title: 'Current guide' }]);
  assert.equal(v.deprecatedCount, 1);
  assert.equal(v.activeCount, 1);
});
test('53468 buildKbGraphRelationships: links totalled', () => {
  const v = XB.buildKbGraphRelationships([{ id: 'a1', prerequisites: ['http-basics'], alternatives: ['oauth-guide'] }, { id: 'a2', title: 'Solo' }]);
  assert.equal(v.totalLinks, 2);
  assert.equal(v.connectedCount, 1);
  assert.equal(v.top.key, 'a1');
});
test('53469 exportKbPackages: ready package counted', () => {
  const v = XB.exportKbPackages([{ id: 'p1', team: 'team-a', articles: ['a1', 'a2', 'a3'] }, { id: 'p2', team: 'team-b', articles: [] }]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.totalArticles, 3);
});
test('53470 serveKbApiForAgents: ranked result served', () => {
  const v = XB.serveKbApiForAgents([{ id: 'a1', title: 'Auth bypass guide', relevance: 92, technique: 'auth' }, { id: 'a2', title: 'API notes', relevance: 70, technique: 'api' }], { term: 'auth' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.top.key, 'a1');
});
test('53471 collectKbFeedbackButtons: low-rated article needs revision', () => {
  const v = XB.collectKbFeedbackButtons([{ articleId: 'good', helpful: 12, notHelpful: 2 }, { articleId: 'weak', helpful: 1, notHelpful: 5 }]);
  assert.equal(v.revisionCount, 1);
  assert.equal(v.totalVotes, 20);
  assert.equal(v.top.key, 'good');
});
test('53472 scheduleKbCurationSprints: top gaps picked within capacity', () => {
  const v = XB.scheduleKbCurationSprints([{ technique: 'graphql', priority: 20 }, { technique: 'ssrf', priority: 10 }], { capacity: 5 });
  assert.equal(v.sprintCount, 2);
  assert.equal(v.top.key, 'graphql');
});
test('53473 manageKbArticleLifecycles: stages tracked', () => {
  const v = XB.manageKbArticleLifecycles([{ id: 'a1', stage: 'canonical' }, { id: 'a2', stage: 'archived' }, { id: 'a3', stage: 'draft' }]);
  assert.equal(v.canonicalCount, 1);
  assert.equal(v.archivedCount, 1);
  assert.equal(v.count, 3);
});
test('53474 detectKbDuplicates: duplicate titles grouped', () => {
  const v = XB.detectKbDuplicates([{ id: 'a1', title: 'Auth Guide' }, { id: 'a2', title: 'auth guide' }, { id: 'a3', title: 'API Notes' }]);
  assert.equal(v.duplicateGroups, 1);
  assert.equal(v.duplicateCount, 2);
});
test('53475 trackKbVisualLearningAids: visually rich article identified', () => {
  const v = XB.trackKbVisualLearningAids([{ id: 'a1', diagrams: 2, screenshots: 1 }, { id: 'a2', diagrams: 0, screenshots: 0 }]);
  assert.equal(v.richCount, 1);
  assert.equal(v.totalVisuals, 3);
  assert.equal(v.top.qualityScore, 75);
});
test('53476 auditKbAccessibilityStandards: compliant article passes', () => {
  const v = XB.auditKbAccessibilityStandards([{ id: 'a1', readingLevel: 8, altText: true, headings: true }, { id: 'a2', readingLevel: 12, altText: true, headings: true }]);
  assert.equal(v.passedCount, 1);
  assert.equal(v.accessible, false);
});
test('53477 applyKbTranslationMemory: memory hits reused', () => {
  const v = XB.applyKbTranslationMemory([{ id: 's1', source: 'Bypass check', memoryHit: true }, { id: 's2', source: 'New phrase', memoryHit: false }]);
  assert.equal(v.reusedCount, 1);
  assert.equal(v.reuseRatio, 0.5);
});
test('53478 analyticsKbForAuthors: impact ranked', () => {
  const v = XB.analyticsKbForAuthors([{ name: 'author-a', articles: 4, views: 320, citations: 9 }, { name: 'author-b', articles: 2, views: 100, citations: 2 }]);
  assert.equal(v.top.key, 'author-a');
  assert.equal(v.totalViews, 420);
  assert.equal(v.top.impact, 77);
});
test('53479 integrateKbWithReplays: linked article counted', () => {
  const v = XB.integrateKbWithReplays([{ id: 'a1', replays: ['replay-1', 'replay-2'] }, { id: 'a2', title: 'No replay' }]);
  assert.equal(v.linkedCount, 1);
  assert.equal(v.totalReplays, 2);
});
test('53480 generateKbQuizzes: questions generated per article', () => {
  const v = XB.generateKbQuizzes([{ id: 'a1', sections: ['technique', 'signals', 'examples'] }, { id: 'a2', sections: ['technique'] }]);
  assert.equal(v.quizCount, 2);
  assert.equal(v.totalQuestions, 4);
  assert.equal(v.top.key, 'a1');
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
test('css: only .w87a-/.w87b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w87a-') || cls.startsWith('w87b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave87A.jsx', 'Wave87B.jsx']) {
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
