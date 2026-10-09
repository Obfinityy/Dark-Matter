/**
 * wave83.test.js — Infinity AI · Wave 83
 * node:test + node:assert/strict. Registry coverage (20/20 for 53281–53300,
 * 20/20 for 53301–53320, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave83.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE83_A_IDEAS } from './wave83ACore.js';
import * as XA from './wave83ACore.js';
import { WAVE83_B_IDEAS } from './wave83BCores.js';
import * as XB from './wave83BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave83ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave83BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave83A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave83B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave83.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 83A ideas, 20/20 wave 83B ideas, zero skips', () => {
  assert.equal(WAVE83_A_IDEAS.length, 20);
  assert.equal(WAVE83_B_IDEAS.length, 20);
  const all = [...WAVE83_A_IDEAS, ...WAVE83_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53281 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE83_A_IDEAS, ...WAVE83_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53281: 'coverage benchmark per vertical', 53282: 'coverage gap fix verification', 53283: 'coverage lessons feed', 53284: 'coverage completeness certificates', 53285: 'automated retrospective drafts', 53286: 'researcher voice-note capture', 53287: 'lesson tagging taxonomy', 53288: 'lesson deduplication engine', 53289: 'lesson freshness decay', 53290: 'contradictory lesson resolution', 53291: 'lesson impact scoring', 53292: 'retrospective participation nudges', 53293: 'anonymous lesson submission', 53294: 'near-miss lesson capture', 53295: 'positive deviance studies', 53296: 'lesson-to-playbook promotion', 53297: 'retrospective quality scores', 53298: 'cross-hunt lesson linking', 53299: 'lesson search with context', 53300: 'weekly lessons digest',
    53301: 'lesson application tracking', 53302: 'retrospective templates per outcome', 53303: 'failure celebration rituals', 53304: 'lesson ownership assignment', 53305: 'retrospective time-boxing', 53306: 'lesson confidence labels', 53307: 'external lesson imports', 53308: 'lesson gap analysis', 53309: 'retrospective sentiment tracking', 53310: 'lesson-driven training modules', 53311: 'hunt story archives', 53312: 'lesson versioning', 53313: 'retrospective facilitator rotation', 53314: 'lesson api for agents', 53315: 'pre-hunt lesson briefings', 53316: 'lesson effectiveness a/b tests', 53317: 'retrospective action item tracking', 53318: 'lesson attribution in reports', 53319: 'quiet lessons surfacing', 53320: 'lesson quality peer review',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave83 A spot checks ---- */
test('53281 benchmarkCoverageByVertical: below-benchmark vertical flagged', () => {
  const v = XA.benchmarkCoverageByVertical([{ vertical: 'fintech', coverage: 0.8 }, { vertical: 'fintech', coverage: 0.9 }, { vertical: 'ecommerce', coverage: 0.5 }]);
  assert.equal(v.belowCount, 1);
  assert.equal(v.weakest.key, 'ecommerce');
  assert.equal(v.weakest.gap, 0.25);
  assert.equal(v.rows.find(r => r.key === 'fintech').pass, true);
});
test('53282 verifyCoverageGapFix: planned coverage verified', () => {
  const v = XA.verifyCoverageGapFix([{ area: 'checkout', coverage: 0.1, plannedCoverage: 0.7 }, { area: 'admin', coverage: 0.2, plannedCoverage: 0.7 }], [{ area: 'checkout', coverage: 0.8 }, { area: 'admin', coverage: 0.3 }]);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.verified[0].key, 'checkout');
  assert.equal(v.unverifiedCount, 1);
});
test('53283 buildCoverageLessonsFeed: notable lessons surfaced', () => {
  const v = XA.buildCoverageLessonsFeed([{ id: 'gap-checkout', title: 'Checkout gap resolved', impact: 5, resolved: true, at: '2026-10-01' }, { id: 'gap-admin', title: 'Admin dark area', impact: 2, resolved: false, at: '2026-10-02' }]);
  assert.equal(v.notableCount, 1);
  assert.equal(v.resolvedCount, 1);
  assert.equal(v.top.key, 'gap-checkout');
});
test('53284 issueCoverageCompletenessCertificates: grades assigned', () => {
  const v = XA.issueCoverageCompletenessCertificates([{ id: 'hunt-1', testedAreas: 9, totalAreas: 10 }, { id: 'hunt-2', testedAreas: 4, totalAreas: 10 }]);
  assert.equal(v.top.key, 'hunt-1');
  assert.equal(v.top.grade, 'A');
  assert.equal(v.top.completeness, 0.9);
  assert.equal(v.certifiedCount, 1);
  assert.equal(v.weakest.grade, 'D');
});
test('53285 draftAutomatedRetrospective: telemetry draft generated', () => {
  const v = XA.draftAutomatedRetrospective({ findings: 6, coverage: 0.8, durationMinutes: 90, darkAreas: ['admin'], topFinding: 'idor-checkout' });
  assert.equal(v.outcome, 'high-yield');
  assert.equal(v.findings, 6);
  assert.equal(v.sectionCount, 5);
  assert.ok(v.draft.includes('Infinity AI retrospective draft'));
});
test('53286 captureResearcherVoiceNotes: 60-second cap enforced', () => {
  const v = XA.captureResearcherVoiceNotes([{ id: 'note-1', durationSec: 45, transcript: 'Auth checks on the admin endpoint need a tool pass' }, { id: 'note-2', durationSec: 75, transcript: 'Process workflow note' }]);
  assert.equal(v.acceptedCount, 1);
  assert.equal(v.overLimitCount, 1);
  assert.equal(v.totalWords, 13);
  assert.deepEqual(v.rows[0].tags, ['technique', 'tooling']);
});
test('53287 validateLessonTaggingTaxonomy: unknown tags flagged', () => {
  const v = XA.validateLessonTaggingTaxonomy([{ id: 'lesson-auth', title: 'Check auth', text: 'Auth endpoint checks', tags: ['technique'] }, { id: 'lesson-scanner', title: 'Scanner pass', text: 'Run the scanner tool', tags: ['unknown-tag'] }]);
  assert.equal(v.compliantCount, 1);
  assert.equal(v.unknownTagCount, 1);
  assert.equal(v.top.key, 'lesson-scanner');
  assert.deepEqual(v.top.suggested, ['tooling']);
});
test('53288 deduplicateLessons: similar lessons clustered', () => {
  const v = XA.deduplicateLessons([{ id: 'a', title: 'Check auth on every endpoint', text: 'Auth endpoint parameter checks' }, { id: 'b', title: 'Check auth on every endpoint', text: 'Auth endpoint parameter checks' }, { id: 'c', title: 'Map routes early', text: 'Route mapping first' }]);
  assert.equal(v.clusterCount, 2);
  assert.equal(v.duplicateCount, 1);
  assert.equal(v.top.size, 2);
});
test('53289 applyLessonFreshnessDecay: stale lesson decayed to zero', () => {
  const v = XA.applyLessonFreshnessDecay([{ id: 'fresh', ageDays: 10, prominence: 1 }, { id: 'stale', ageDays: 500, prominence: 1 }]);
  assert.equal(v.rows[0].key, 'fresh');
  assert.equal(v.rows[0].decayed, 0.97);
  assert.equal(v.staleCount, 1);
});
test('53290 resolveContradictoryLessons: stance clash routed', () => {
  const v = XA.resolveContradictoryLessons([{ id: 'l1', topic: 'auth', stance: 'always-test' }, { id: 'l2', topic: 'auth', stance: 'skip-if-hardened' }, { id: 'l3', topic: 'routes', stance: 'always-test' }]);
  assert.equal(v.contradictionCount, 1);
  assert.equal(v.rows[0].routedTo, 'expert-review');
  assert.deepEqual(v.rows[0].pair, ['l1', 'l2']);
});
test('53291 scoreLessonImpact: outcome-changing lesson ranked first', () => {
  const v = XA.scoreLessonImpact([{ id: 'high', appliedCount: 4, outcomeChangedCount: 3 }, { id: 'low', appliedCount: 2, outcomeChangedCount: 0 }]);
  assert.equal(v.top.key, 'high');
  assert.equal(v.top.impactRate, 0.75);
  assert.equal(v.top.score, 3);
  assert.equal(v.highImpactCount, 1);
});
test('53292 buildRetrospectiveParticipationNudges: missing researcher nudged', () => {
  const v = XA.buildRetrospectiveParticipationNudges([{ name: 'researcher-a' }, { name: 'researcher-b' }], { contributors: ['researcher-a'] });
  assert.equal(v.missingCount, 1);
  assert.equal(v.missing[0].key, 'researcher-b');
  assert.equal(v.participationRate, 0.5);
});
test('53293 submitAnonymousLessons: identifiers redacted, author stripped', () => {
  const v = XA.submitAnonymousLessons([{ text: 'I missed the admin endpoint, contact me at a@example.com' }, { text: 'Near-miss on the billing workflow' }]);
  assert.equal(v.acceptedCount, 2);
  assert.equal(v.totalRedactions, 1);
  assert.equal(v.rows.find(r => r.redactionCount === 1).author, null);
  assert.ok(!v.rows[0].text.includes('@example.com'));
});
test('53294 captureNearMissLessons: near-miss captured as lesson', () => {
  const v = XA.captureNearMissLessons([{ id: 'nm-1', type: 'near-miss', almostFound: true, severity: 4 }, { id: 'ev-1', type: 'finding', severity: 1 }]);
  assert.equal(v.capturedCount, 1);
  assert.equal(v.captureRate, 0.5);
  assert.equal(v.top.key, 'nm-1');
  assert.equal(v.top.category, 'almost-found-bug');
});
test('53295 studyPositiveDeviance: outlier hunt studied', () => {
  const v = XA.studyPositiveDeviance([{ id: 'hunt-a', findings: 2, behaviors: ['deep-auth-checks'] }, { id: 'hunt-b', findings: 3, behaviors: ['deep-auth-checks'] }, { id: 'hunt-c', findings: 12, behaviors: ['deep-auth-checks', 'route-mapping'] }]);
  assert.equal(v.median, 3);
  assert.equal(v.outlierCount, 1);
  assert.equal(v.outliers[0].key, 'hunt-c');
  assert.equal(v.topBehavior.behavior, 'deep-auth-checks');
});
test('53296 promoteLessonsToPlaybook: three confirmations required', () => {
  const v = XA.promoteLessonsToPlaybook([{ id: 'ready', confirmations: 3 }, { id: 'candidate', confirmations: 1 }]);
  assert.equal(v.promotedCount, 1);
  assert.equal(v.promoted[0].key, 'ready');
  assert.equal(v.rows.find(r => r.key === 'candidate').remaining, 2);
});
test('53297 scoreRetrospectiveQuality: specific retrospective wins', () => {
  const v = XA.scoreRetrospectiveQuality([{ id: 'retro-1', text: 'Tested /admin endpoint parameter header flow with 4 follow-ups', actionItems: 2 }, { id: 'retro-2', text: 'Looked around', actionItems: 0 }]);
  assert.equal(v.top.key, 'retro-1');
  assert.equal(v.top.score, 58.6);
  assert.equal(v.weakest.key, 'retro-2');
  assert.equal(v.avgScore, 29.7);
});
test('53298 linkCrossHuntLessons: reference thread edges built', () => {
  const v = XA.linkCrossHuntLessons([{ id: 'lesson-1', references: ['lesson-2'] }, { id: 'lesson-2', references: ['lesson-3'] }, { id: 'lesson-3', references: [] }]);
  assert.equal(v.edgeCount, 2);
  assert.equal(v.linkedCount, 3);
  assert.equal(v.unlinkedCount, 0);
});
test('53299 searchLessonsWithContext: context boosts ranking', () => {
  const v = XA.searchLessonsWithContext([{ id: 'l1', title: 'Auth checks', text: 'Admin auth endpoint', targetClass: 'web', stack: 'node' }, { id: 'l2', title: 'Route mapping', text: 'Map routes first', targetClass: 'api', stack: 'go' }], { targetClass: 'web', stack: 'node', keywords: 'auth' });
  assert.equal(v.resultCount, 1);
  assert.equal(v.top.key, 'l1');
  assert.equal(v.top.score, 7);
});
test('53300 buildWeeklyLessonsDigest: top five fresh lessons only', () => {
  const v = XA.buildWeeklyLessonsDigest([{ id: 'lesson-new', title: 'Fresh high impact', impact: 9, ageDays: 1 }, { id: 'lesson-mid', title: 'Fresh mid impact', impact: 5, ageDays: 3 }, { id: 'lesson-old', title: 'Old lesson', impact: 10, ageDays: 40 }]);
  assert.equal(v.digestCount, 2);
  assert.equal(v.top.key, 'lesson-new');
  assert.ok(v.paragraph.includes('Infinity AI weekly lessons digest'));
});

/* ---- Wave83 B spot checks ---- */
test('53301 trackLessonApplications: application and success tracked', () => {
  const v = XB.trackLessonApplications([{ id: 'lesson-1', applied: true, huntId: 'hunt-9', outcome: 'finding' }, { id: 'lesson-2', applied: false, outcome: 'not-applied' }]);
  assert.equal(v.appliedCount, 1);
  assert.equal(v.applicationRate, 0.5);
  assert.equal(v.successRate, 1);
});
test('53302 assignRetrospectiveTemplates: template follows outcome', () => {
  const v = XB.assignRetrospectiveTemplates([{ id: 'hunt-high', findings: 8 }, { id: 'hunt-dry', findings: 0 }, { id: 'hunt-incident', findings: 1, incidentAdjacent: true }]);
  assert.equal(v.rows.find(r => r.key === 'hunt-high').template, 'deep-dive-template');
  assert.equal(v.rows.find(r => r.key === 'hunt-dry').template, 'dry-run-template');
  assert.equal(v.rows.find(r => r.key === 'hunt-incident').template, 'incident-template');
});
test('53303 selectFailureCelebrations: instructive dry hunt celebrated', () => {
  const v = XB.selectFailureCelebrations([{ id: 'hunt-dry', findings: 0, instructiveness: 5 }, { id: 'hunt-ok', findings: 3, instructiveness: 1 }]);
  assert.equal(v.celebratedCount, 1);
  assert.equal(v.top.key, 'hunt-dry');
  assert.equal(v.top.score, 55);
});
test('53304 assignLessonOwnership: least-loaded researcher assigned', () => {
  const v = XB.assignLessonOwnership([{ id: 'lesson-1' }, { id: 'lesson-2' }], [{ name: 'researcher-a', ownedCount: 2 }, { name: 'researcher-b', ownedCount: 0 }]);
  assert.equal(v.assignedCount, 2);
  assert.equal(v.rows[0].owner, 'researcher-b');
});
test('53305 auditRetrospectiveTimeBoxing: 15-minute cap enforced', () => {
  const v = XB.auditRetrospectiveTimeBoxing([{ id: 'retro-1', researcherMinutes: 10, automatedMinutes: 20 }, { id: 'retro-2', researcherMinutes: 25, automatedMinutes: 5 }]);
  assert.equal(v.withinCount, 1);
  assert.equal(v.overCount, 1);
  assert.equal(v.top.key, 'retro-2');
  assert.equal(v.top.overBy, 10);
  assert.equal(v.avgResearcherMinutes, 17.5);
});
test('53306 labelLessonConfidence: supporting hunts decide label', () => {
  const v = XB.labelLessonConfidence([{ id: 'proven', supportingHunts: 6 }, { id: 'corroborated', supportingHunts: 3 }, { id: 'anecdotal', supportingHunts: 1 }]);
  assert.equal(v.counts.proven, 1);
  assert.equal(v.counts.corroborated, 1);
  assert.equal(v.counts.anecdotal, 1);
  assert.equal(v.top.key, 'proven');
});
test('53307 importExternalLessons: mapped and sanitized imports only', () => {
  const v = XB.importExternalLessons([{ id: 'ext-1', title: 'Auth bypass write-up', tags: ['auth'], sanitized: true }, { id: 'ext-2', title: 'Random notes', tags: ['random'], sanitized: true }]);
  assert.equal(v.importedCount, 1);
  assert.equal(v.imported[0].key, 'ext-1');
  assert.deepEqual(v.imported[0].tags, ['technique']);
  assert.equal(v.rejectedCount, 1);
});
test('53308 analyzeLessonGaps: under-reflected classes flagged', () => {
  const v = XB.analyzeLessonGaps([{ targetClass: 'web' }, { targetClass: 'web' }, { targetClass: 'api' }]);
  assert.equal(v.gapCount, 2);
  assert.equal(v.weakest.key, 'api');
  assert.equal(v.weakest.deficit, 2);
});
test('53309 trackRetrospectiveSentiment: negative sentiment flags risk', () => {
  const v = XB.trackRetrospectiveSentiment([{ id: 'r1', text: 'Great progress, learned a clear workflow' }, { id: 'r2', text: 'Frustrated and stuck, blocked all hunt' }]);
  assert.equal(v.avgSentiment, 0);
  assert.equal(v.negativeCount, 1);
  assert.equal(v.burnoutRiskCount, 1);
  assert.equal(v.weakest.key, 'r2');
});
test('53310 buildLessonTrainingModules: short lessons fit the module', () => {
  const v = XB.buildLessonTrainingModules([{ id: 'short', title: 'Short lesson', text: 'Check auth first' }, { id: 'long', title: 'Long lesson', text: Array(900).fill('word').join(' ') }]);
  assert.equal(v.moduleCount, 1);
  assert.equal(v.top.key, 'short');
  assert.equal(v.top.minutes, 0.02);
});
test('53311 archiveHuntStories: narrative archived with word count', () => {
  const v = XB.archiveHuntStories([{ id: 'hunt-1', target: 'shop', narrative: Array(60).fill('story').join(' ') }, { id: 'hunt-2', target: 'blog', narrative: 'short' }]);
  assert.equal(v.archivedCount, 1);
  assert.equal(v.top.key, 'hunt-1');
  assert.equal(v.top.words, 60);
});
test('53312 trackLessonVersions: revision history counted', () => {
  const v = XB.trackLessonVersions([{ id: 'lesson-1', version: 3, history: [{ reason: 'initial' }, { reason: 'refined' }, { reason: 'corrected' }] }, { id: 'lesson-2', version: 1, history: [{ reason: 'initial' }] }]);
  assert.equal(v.revisedCount, 1);
  assert.equal(v.top.key, 'lesson-1');
  assert.equal(v.top.changeCount, 2);
  assert.equal(v.totalVersions, 4);
});
test('53313 rotateRetrospectiveFacilitators: least-recent facilitator next', () => {
  const v = XB.rotateRetrospectiveFacilitators([{ facilitator: 'researcher-a', at: '2026-09-01' }, { facilitator: 'researcher-a', at: '2026-09-15' }], [{ name: 'researcher-a' }, { name: 'researcher-b' }]);
  assert.equal(v.nextFacilitator, 'researcher-b');
  assert.equal(v.spread, 2);
  assert.equal(v.fair, false);
});
test('53314 buildLessonAPIForAgents: filtered agent payload shaped', () => {
  const v = XB.buildLessonAPIForAgents([{ id: 'l1', title: 'Auth', targetClass: 'web', stack: 'node' }, { id: 'l2', title: 'Routes', targetClass: 'api', stack: 'go' }], { targetClass: 'web' });
  assert.equal(v.payload.generatedBy, 'Infinity AI');
  assert.equal(v.endpoint, '/api/v1/lessons');
  assert.equal(v.resultCount, 1);
  assert.equal(v.rows[0].key, 'l1');
});
test('53315 buildPreHuntLessonBriefings: three most relevant attached', () => {
  const v = XB.buildPreHuntLessonBriefings({ targetClass: 'web', stack: 'node', focus: 'auth' }, [{ id: 'l1', title: 'Auth checks', text: 'Admin auth endpoint', targetClass: 'web', stack: 'node' }, { id: 'l2', title: 'Route mapping', text: 'Map routes first', targetClass: 'web', stack: 'node' }]);
  assert.equal(v.briefingCount, 2);
  assert.equal(v.top.key, 'l1');
  assert.equal(v.top.score, 8);
});
test('53316 testLessonEffectivenessAB: briefed hunts uplift measured', () => {
  const v = XB.testLessonEffectivenessAB([{ findings: 4 }, { findings: 5 }], [{ findings: 1 }, { findings: 2 }]);
  assert.equal(v.briefedAvg, 4.5);
  assert.equal(v.controlAvg, 1.5);
  assert.equal(v.uplift, 3);
  assert.equal(v.effective, true);
  assert.equal(v.winRate, 1);
});
test('53317 trackRetrospectiveActionItems: overdue items surfaced', () => {
  const v = XB.trackRetrospectiveActionItems([{ id: 'item-1', owner: 'researcher-a', deadline: '2026-10-01', status: 'open' }, { id: 'item-2', owner: 'researcher-b', deadline: '2026-12-01', status: 'done' }]);
  assert.equal(v.doneCount, 1);
  assert.equal(v.overdueCount, 1);
  assert.equal(v.overdue[0].key, 'item-1');
  assert.equal(v.completionRate, 0.5);
});
test('53318 attributeLessonsInReports: citations appended', () => {
  const v = XB.attributeLessonsInReports({ hunt: 'hunt-9', influencedBy: ['lesson-1', 'lesson-2'] });
  assert.equal(v.attributedCount, 2);
  assert.equal(v.citations[0].lesson, 'lesson-1');
  assert.ok(v.appendix.includes('Infinity AI lesson lesson-1'));
});
test('53319 surfaceQuietLessons: old rarely-viewed lesson resurfaced', () => {
  const v = XB.surfaceQuietLessons([{ id: 'lesson-1', views: 1, ageDays: 200, targetClass: 'web', stack: 'node' }, { id: 'lesson-2', views: 40, ageDays: 10, targetClass: 'web', stack: 'node' }], { targetClass: 'web', stack: 'node' });
  assert.equal(v.resurfacedCount, 1);
  assert.equal(v.top.key, 'lesson-1');
  assert.equal(v.top.score, 19);
});
test('53320 reviewLessonQualityPeer: trusted and flagged lessons split', () => {
  const v = XB.reviewLessonQualityPeer([{ id: 'lesson-1', upvotes: 6, challenges: 1 }, { id: 'lesson-2', upvotes: 1, challenges: 4 }]);
  assert.equal(v.trustedCount, 1);
  assert.equal(v.flaggedCount, 1);
  assert.equal(v.top.key, 'lesson-1');
  assert.equal(v.top.score, 0.71);
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
test('css: only .w83a-/.w83b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w83a-') || cls.startsWith('w83b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave83A.jsx', 'Wave83B.jsx']) {
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
