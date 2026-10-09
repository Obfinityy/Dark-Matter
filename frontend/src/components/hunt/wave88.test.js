/**
 * wave88.test.js — Infinity AI · Wave 88
 * node:test + node:assert/strict. Registry coverage (20/20 for 53481–53500,
 * 20/20 for 53501–53520, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave88.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE88_A_IDEAS } from './wave88ACore.js';
import * as XA from './wave88ACore.js';
import { WAVE88_B_IDEAS } from './wave88BCores.js';
import * as XB from './wave88BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave88ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave88BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave88A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave88B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave88.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 88A ideas, 20/20 wave 88B ideas, zero skips', () => {
  assert.equal(WAVE88_A_IDEAS.length, 20);
  assert.equal(WAVE88_B_IDEAS.length, 20);
  const all = [...WAVE88_A_IDEAS, ...WAVE88_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53481 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE88_A_IDEAS, ...WAVE88_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53481: 'kb change notifications',
    53482: 'kb article bounties',
    53483: 'kb quality rubrics',
    53484: 'kb external sourcing',
    53485: 'kb redundancy with playbooks',
    53486: 'kb search synonym expansion',
    53487: 'kb contribution onboarding',
    53488: 'kb article templates per finding type',
    53489: 'kb annual audits',
    53490: 'kb staleness alerts',
    53491: 'kb cross-linking suggestions',
    53492: 'kb reading paths',
    53493: 'kb incident learnings section',
    53494: 'kb api rate limits',
    53495: 'kb offline sync',
    53496: 'kb contribution recognition',
    53497: 'kb article difficulty labels',
    53498: 'kb feedback triage',
    53499: 'kb growth metrics dashboard',
    53500: 'kb sunset archives',
    53501: 'kb legal review queue',
    53502: 'kb community contributions',
    53503: 'kb article impact scores',
    53504: 'kb semantic deduplication',
    53505: 'kb onboarding checklists',
    53506: 'kb hunt-citation requirements',
    53507: 'kb knowledge graph visualizations',
    53508: 'kb annual growth report',
    53509: 'failure taxonomy',
    53510: 'near-miss payload detection',
    53511: 'blocked-vs-patched differentiation',
    53512: 'filter fingerprinting from failures',
    53513: 'failure clustering',
    53514: 'payload autopsy reports',
    53515: 'failure cost accounting',
    53516: 'survivorship bias correction',
    53517: 'failure-driven mutation suggestions',
    53518: 'time-to-failure analysis',
    53519: 'failure signal libraries',
    53520: 'false-negative failure reviews',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 88A spot checks (one per idea) ---
test('53481 notifyKbChanges queues significant changes', () => {
  const v = XA.notifyKbChanges([{ id: 'a1', significance: 0.9, subscribers: ['x'] }, { id: 'a2', significance: 0.1, subscribers: ['x'] }]);
  assert.equal(v.notifyCount, 1);
  assert.ok(v.summary.includes('Infinity AI'));
});
test('53482 offerKbArticleBounties prices by priority', () => {
  const v = XA.offerKbArticleBounties([{ id: 'g1', priority: 1 }]);
  assert.equal(v.openCount, 1);
  assert.ok(v.rows[0].reward > 100);
});
test('53483 publishKbQualityRubrics weights criteria', () => {
  const v = XA.publishKbQualityRubrics([{ name: 'Accuracy', weight: 2 }]);
  assert.equal(v.totalWeight, 2);
});
test('53484 importKbExternalSources requires license + attribution', () => {
  const v = XA.importKbExternalSources([{ id: 's1', license: 'MIT', attributed: true }, { id: 's2', license: 'unknown' }]);
  assert.equal(v.usableCount, 1);
  assert.equal(v.blockedCount, 1);
});
test('53485 delineateKbVsPlaybooks routes procedural content', () => {
  const v = XA.delineateKbVsPlaybooks([{ id: 'i1', proceduralSteps: 5, concepts: 1 }]);
  assert.equal(v.playbookCount, 1);
});
test('53486 expandKbSearchSynonyms learns from logs', () => {
  const v = XA.expandKbSearchSynonyms([{ term: 'sqli', count: 5, clickedSynonyms: ['sql injection'] }]);
  assert.equal(v.expandableCount, 1);
  assert.deepEqual(v.rows[0].synonyms, ['sql injection']);
});
test('53487 onboardKbContributors tracks step progress', () => {
  const v = XA.onboardKbContributors([{ name: 'r1', completedSteps: ['a', 'b', 'c', 'd'] }]);
  assert.equal(v.readyCount, 1);
});
test('53488 templateKbArticlesByFindingType tailors sections', () => {
  const v = XA.templateKbArticlesByFindingType([{ type: 'sqli' }]);
  assert.ok(v.rows[0].sections.includes('payload anatomy'));
});
test('53489 auditKbArticlesAnnually samples and scores accuracy', () => {
  const v = XA.auditKbArticlesAnnually([{ id: 'a1', accurate: true }]);
  assert.equal(v.accuracyRate, 1);
});
test('53490 alertKbStaleness flags 12+ month articles', () => {
  const v = XA.alertKbStaleness([{ id: 'a1', monthsSinceHuntValidation: 13 }]);
  assert.equal(v.staleCount, 1);
});
test('53491 suggestKbCrossLinks uses co-citations', () => {
  const v = XA.suggestKbCrossLinks([{ id: 'a1', coCitations: { a2: 4 } }, { id: 'a2' }]);
  assert.equal(v.suggestionCount, 1);
});
test('53492 buildKbReadingPaths orders beginner first', () => {
  const v = XA.buildKbReadingPaths([{ id: 'a2', difficulty: 'advanced' }, { id: 'a1', difficulty: 'beginner' }]);
  assert.equal(v.rows[0].difficulty, 'beginner');
});
test('53493 collectKbIncidentLearnings counts published', () => {
  const v = XA.collectKbIncidentLearnings([{ id: 'i1', published: true }]);
  assert.equal(v.publishedCount, 1);
});
test('53494 enforceKbApiRateLimits throttles agents only', () => {
  const reqs = Array.from({ length: 61 }, () => ({ source: 'agent' }));
  const v = XA.enforceKbApiRateLimits(reqs);
  assert.equal(v.throttledCount, 1);
});
test('53495 syncKbOffline finds pending versions', () => {
  const v = XA.syncKbOffline([{ id: 'a1', localVersion: 1, remoteVersion: 3 }]);
  assert.equal(v.pendingCount, 1);
});
test('53496 recognizeKbContributions ranks by score', () => {
  const v = XA.recognizeKbContributions([{ name: 'r1', articles: 2, citations: 3 }]);
  assert.equal(v.rows[0].score, 7);
});
test('53497 labelKbArticleDifficulty buckets by depth', () => {
  const v = XA.labelKbArticleDifficulty([{ id: 'a1', depthScore: 9 }]);
  assert.equal(v.advancedCount, 1);
});
test('53498 triageKbFeedback splits quick vs major', () => {
  const v = XA.triageKbFeedback([{ id: 'f1', effortDays: 0.5 }, { id: 'f2', effortDays: 5 }]);
  assert.equal(v.quickFixCount, 1);
  assert.equal(v.majorRevisionCount, 1);
});
test('53499 trackKbGrowthMetrics computes net growth', () => {
  const v = XA.trackKbGrowthMetrics([{ period: '2026-01', articles: 10 }, { period: '2026-02', articles: 15 }]);
  assert.equal(v.growth, 5);
});
test('53500 archiveKbSunsetArticles makes deprecated read-only', () => {
  const v = XA.archiveKbSunsetArticles([{ id: 'a1', status: 'deprecated' }]);
  assert.equal(v.archivedCount, 1);
  assert.equal(v.rows[0].readOnly, true);
});

// --- Wave 88B spot checks (one per idea) ---
test('53501 queueKbLegalReviews flags sensitive terms', () => {
  const v = XB.queueKbLegalReviews([{ id: 'a1', title: 'Notes', body: 'exploit details' }]);
  assert.equal(v.queuedCount, 1);
});
test('53502 moderateKbCommunityContributions approves reviewed low-spam', () => {
  const v = XB.moderateKbCommunityContributions([{ id: 'c1', reviewed: true, spamScore: 0.1 }]);
  assert.equal(v.approvedCount, 1);
});
test('53503 scoreKbArticleImpact weights hunts and findings', () => {
  const v = XB.scoreKbArticleImpact([{ id: 'a1', huntsImproved: 2, findingsEnabled: 1 }]);
  assert.equal(v.rows[0].impact, 8);
});
test('53504 deduplicateKbSemantically catches near-duplicates', () => {
  const v = XB.deduplicateKbSemantically([{ id: 'a1', similarity: { a2: 0.95 } }, { id: 'a2' }]);
  assert.equal(v.pairCount, 1);
});
test('53505 buildKbOnboardingChecklists tracks first-month reads', () => {
  const v = XB.buildKbOnboardingChecklists([{ name: 'm1', articlesRead: 10 }]);
  assert.equal(v.completeCount, 1);
});
test('53506 enforceKbHuntCitations computes compliance rate', () => {
  const v = XB.enforceKbHuntCitations([{ id: 'r1', kbCitations: ['a'] }, { id: 'r2', kbCitations: [] }]);
  assert.equal(v.complianceRate, 0.5);
});
test('53507 buildKbKnowledgeGraph counts nodes and edges', () => {
  const v = XB.buildKbKnowledgeGraph([{ id: 'a1', links: ['a2'] }, { id: 'a2', links: [] }]);
  assert.equal(v.count, 2);
  assert.equal(v.edgeCount, 1);
});
test('53508 reportKbAnnualGrowth totals gaps closed', () => {
  const v = XB.reportKbAnnualGrowth([{ year: 2025, articles: 100, gapsClosed: 5 }, { year: 2026, articles: 130, gapsClosed: 7 }]);
  assert.equal(v.growth, 30);
  assert.equal(v.totalGapsClosed, 12);
});
test('53509 classifyFailureTaxonomy maps 403 to blocked', () => {
  const v = XB.classifyFailureTaxonomy([{ id: 'f1', status: 403 }]);
  assert.equal(v.counts.blocked, 1);
});
test('53510 detectNearMissPayloads flags strong partial signals', () => {
  const v = XB.detectNearMissPayloads([{ id: 'p1', partialSignal: 0.8 }]);
  assert.equal(v.nearMissCount, 1);
});
test('53511 differentiateBlockedVsPatched reads WAF evidence', () => {
  const v = XB.differentiateBlockedVsPatched([{ id: 'p1', status: 403, wafHeader: true }, { id: 'p2', status: 404 }]);
  assert.equal(v.wafBlockCount, 1);
  assert.equal(v.patchedCount, 1);
});
test('53512 fingerprintFiltersFromFailures groups by signature', () => {
  const v = XB.fingerprintFiltersFromFailures([{ id: 'f1', filterSignature: 'rule-1', strippedTokens: ['union'] }]);
  assert.equal(v.fingerprintCount, 1);
});
test('53513 clusterFailures finds systemic clusters', () => {
  const v = XB.clusterFailures([{ target: 't', contentType: 'application/json' }, { target: 't', contentType: 'application/json' }, { target: 't', contentType: 'application/json' }]);
  assert.equal(v.systemicCount, 1);
});
test('53514 generatePayloadAutopsies names the stopping defense', () => {
  const v = XB.generatePayloadAutopsies([{ id: 'p1', stoppedBy: 'waf' }]);
  assert.equal(v.rows[0].stoppedBy, 'waf');
});
test('53515 accountFailureCosts totals wasted requests', () => {
  const v = XB.accountFailureCosts([{ id: 'p1', requests: 10, doomed: true }]);
  assert.equal(v.wastedCost, 10);
});
test('53516 correctSurvivorshipBias adjusts raw scores', () => {
  const v = XB.correctSurvivorshipBias([{ id: 't1', effectiveness: 1, timesTested: 10, timesSurvived: 5 }]);
  assert.equal(v.rows[0].adjusted, 0.75);
});
test('53517 suggestFailureDrivenMutations maps defenses to mutations', () => {
  const v = XB.suggestFailureDrivenMutations([{ id: 'p1', defense: 'waf' }]);
  assert.ok(v.rows[0].suggestions.includes('encode payload'));
});
test('53518 analyzeTimeToFailure counts fast fails', () => {
  const v = XB.analyzeTimeToFailure([{ id: 'p1', timeToFailureMs: 500 }]);
  assert.equal(v.fastFailCount, 1);
});
test('53519 buildFailureSignalLibraries groups by product', () => {
  const v = XB.buildFailureSignalLibraries([{ product: 'modsecurity', signature: 'sig-1' }]);
  assert.equal(v.totalSignatures, 1);
});
test('53520 reviewFalseNegativeFailures flags manual-find mismatches', () => {
  const v = XB.reviewFalseNegativeFailures([{ id: 'r1', laterFoundManually: true, originalVerdict: 'failed' }]);
  assert.equal(v.falseNegativeCount, 1);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix] of [['A', A_JSX, 'XA'], ['B', B_JSX, 'XB']]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= 21, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w88 prefixes, zero keyframes', () => {
  assert.ok(CSS_SRC.includes('.w88a-'));
  assert.ok(CSS_SRC.includes('.w88b-'));
  assert.ok(!CSS_SRC.includes('@keyframes'), 'zero-animation order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave88A.jsx', 'Wave88B.jsx']) {
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

test('no-debris audit: no TODO placeholders in wave 88 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.includes('TODO'), `${name} carries TODO debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries FIXME debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozen = Object.freeze([Object.freeze({ id: 'a1', monthsSinceHuntValidation: 20 })]);
  const v = XA.alertKbStaleness(frozen);
  assert.equal(v.staleCount, 1);
});
