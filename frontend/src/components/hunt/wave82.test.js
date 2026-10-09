/**
 * wave82.test.js — Infinity AI · Wave 82
 * node:test + node:assert/strict. Registry coverage (20/20 for 53241–53260,
 * 20/20 for 53261–53280, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave82.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE82_A_IDEAS } from './wave82ACore.js';
import * as XA from './wave82ACore.js';
import { WAVE82_B_IDEAS } from './wave82BCores.js';
import * as XB from './wave82BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave82ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave82BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave82A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave82B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave82.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 82A ideas, 20/20 wave 82B ideas, zero skips', () => {
  assert.equal(WAVE82_A_IDEAS.length, 20);
  assert.equal(WAVE82_B_IDEAS.length, 20);
  const all = [...WAVE82_A_IDEAS, ...WAVE82_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53241 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE82_A_IDEAS, ...WAVE82_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53241: 'crawl frontier analysis', 53242: 'form coverage inventory', 53243: 'javascript route coverage', 53244: 'websocket channel coverage', 53245: 'scheduled-job surface review', 53246: 'admin panel coverage audit', 53247: 'third-party integration coverage (learning)', 53248: 'file upload path coverage', 53249: 'export/report feature coverage', 53250: 'search feature depth audit', 53251: 'pagination and sorting coverage', 53252: 'error-path coverage', 53253: 'coverage diff across re-hunts', 53254: 'dark-area prioritization queue', 53255: 'coverage debt tracking', 53256: 'minimum coverage gates', 53257: 'coverage-weighted finding estimates', 53258: 'spider-trap avoidance log', 53259: 'auth-wall penetration report', 53260: 'coverage by user role',
    53261: 'state-machine coverage', 53262: 'coverage regression alerts', 53263: 'microservice coverage map', 53264: 'coverage sampling verification', 53265: 'time-boxed coverage targets', 53266: 'coverage gap root-cause tags', 53267: 'gap closure verification', 53268: 'coverage fairness across tenants', 53269: 'legacy endpoint coverage', 53270: 'coverage by content type (learning)', 53271: 'coverage confidence scores', 53272: 'blind-spot pattern mining (learning)', 53273: 'coverage gap bounty multipliers', 53274: 'coverage narrative summaries', 53275: 'coverage vs findings scatter', 53276: 'pre-hunt coverage planning', 53277: 'coverage gap aging report', 53278: 'coverage api for researchers', 53279: 'coverage visualization playground', 53280: 'coverage-driven hunt scheduling',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave82 A spot checks ---- */
test('53241 analyzeCrawlFrontier: dominant stop reason', () => {
  const v = XA.analyzeCrawlFrontier([{ stopReason: 'depth-limit', depth: 5 }, { stopReason: 'depth-limit', depth: 6 }, { stopReason: 'auth-wall', depth: 2 }, { stopReason: 'completed', depth: 4 }]);
  assert.equal(v.dominant.key, 'depth-limit');
  assert.equal(v.dominant.count, 2);
  assert.equal(v.dominant.share, 0.5);
  assert.equal(v.dominant.avgDepth, 5.5);
  assert.equal(v.stoppedCount, 3);
  assert.equal(v.stoppedRate, 0.75);
});
test('53242 inventoryFormCoverage: untested combinations', () => {
  const v = XA.inventoryFormCoverage([{ name: 'checkout', totalCombinations: 10, testedCombinations: 4 }, { name: 'search', totalCombinations: 5, testedCombinations: 5 }]);
  assert.equal(v.untestedCombos, 6);
  assert.equal(v.coverageRate, 0.6);
  assert.equal(v.worst.key, 'checkout');
});
test('53243 auditJSRouteCoverage: dark routes exposed', () => {
  const v = XA.auditJSRouteCoverage([{ route: '/dashboard', exercised: true }, { route: '/admin', exercised: false }, { route: '/settings', requests: 2 }]);
  assert.equal(v.exercisedCount, 2);
  assert.equal(v.darkCount, 1);
  assert.equal(v.coverageRate, 0.67);
  assert.equal(v.dark[0].key, '/admin');
});
test('53244 inventoryWebSocketCoverage: untested channel', () => {
  const v = XA.inventoryWebSocketCoverage([{ name: 'chat', messagesTested: 8, totalMessages: 10 }, { name: 'alerts', messagesTested: 0, totalMessages: 5 }]);
  assert.equal(v.avgCoverage, 0.4);
  assert.equal(v.untestedCount, 1);
  assert.equal(v.weakest.key, 'alerts');
});
test('53245 reviewScheduledJobSurface: never-triggered flagged', () => {
  const v = XA.reviewScheduledJobSurface([{ name: 'nightly-report', triggered: true, runs: 3 }, { name: 'cleanup', triggered: false, runs: 0 }]);
  assert.equal(v.flaggedCount, 1);
  assert.equal(v.flagged[0].key, 'cleanup');
  assert.equal(v.coverageRate, 0.5);
});
test('53246 auditAdminPanelCoverage: under-tested panel', () => {
  const v = XA.auditAdminPanelCoverage([{ name: 'admin-users', coverage: 0.2 }, { name: 'admin-billing', coverage: 0.8 }]);
  assert.equal(v.avgCoverage, 0.5);
  assert.equal(v.underTestedCount, 1);
  assert.equal(v.weakest.key, 'admin-users');
});
test('53247 auditThirdPartyIntegrationCoverage: weakest integration', () => {
  const v = XA.auditThirdPartyIntegrationCoverage([{ name: 'payments', coverage: 0.3, criticality: 5 }, { name: 'chat-alerts', coverage: 0.9, criticality: 2 }]);
  assert.equal(v.avgCoverage, 0.6);
  assert.equal(v.gapCount, 1);
  assert.equal(v.weakest.key, 'payments');
});
test('53248 mapFileUploadPathCoverage: harmful-content gap', () => {
  const v = XA.mapFileUploadPathCoverage([{ path: '/upload/avatar', maliciousTested: true }, { path: '/upload/documents', maliciousTested: false }]);
  assert.equal(v.untestedMaliciousCount, 1);
  assert.equal(v.untestedMalicious[0].key, '/upload/documents');
});
test('53249 auditExportFeatureCoverage: missing format', () => {
  const v = XA.auditExportFeatureCoverage([{ name: 'pdf-export', formats: ['pdf', 'csv'], testedFormats: ['pdf'] }, { name: 'json-export', formats: ['json'], testedFormats: ['json'] }]);
  assert.equal(v.gapCount, 1);
  assert.equal(v.weakest.key, 'pdf-export');
  assert.equal(v.weakest.coverage, 0.5);
  assert.deepEqual(v.weakest.missingFormats, ['csv']);
});
test('53250 auditSearchFeatureDepth: shallow search ranked', () => {
  const v = XA.auditSearchFeatureDepth([{ endpoint: '/search', basicTested: true, operatorTested: true, filterTested: false }, { endpoint: '/lookup', basicTested: true, operatorTested: false, filterTested: false }]);
  assert.equal(v.shallowCount, 2);
  assert.equal(v.weakest.key, '/lookup');
  assert.equal(v.weakest.depth, 0.33);
  assert.equal(v.rows[1].depth, 0.67);
});
test('53251 auditPaginationSortingCoverage: missing checks', () => {
  const v = XA.auditPaginationSortingCoverage([{ endpoint: '/items', paginationTested: true, sortingTested: true, filteringTested: true }, { endpoint: '/orders', paginationTested: true, sortingTested: false, filteringTested: false }]);
  assert.equal(v.incompleteCount, 1);
  assert.equal(v.incomplete[0].key, '/orders');
  assert.deepEqual(v.incomplete[0].missing, ['sorting', 'filtering']);
});
test('53252 inventoryErrorPathCoverage: unprobed errors', () => {
  const v = XA.inventoryErrorPathCoverage([{ status: 500, probed: true }, { status: 404, probed: false }]);
  assert.equal(v.unprobedCount, 1);
  assert.equal(v.unprobed[0].status, 404);
});
test('53253 diffCoverageAcrossReHunts: newly covered and still dark', () => {
  const v = XA.diffCoverageAcrossReHunts([{ area: 'checkout', coverage: 0 }, { area: 'blog', coverage: 0.8 }, { area: 'admin', coverage: 0 }], [{ area: 'checkout', coverage: 0.6 }, { area: 'blog', coverage: 0.8 }, { area: 'admin', coverage: 0 }]);
  assert.equal(v.newlyCoveredCount, 1);
  assert.equal(v.stillDarkCount, 1);
  assert.equal(v.rows.find(r => r.key === 'checkout').delta, 0.6);
});
test('53254 buildDarkAreaPrioritizationQueue: urgent first', () => {
  const v = XA.buildDarkAreaPrioritizationQueue([{ area: 'checkout', coverage: 0.1, criticality: 5, ageDays: 30 }, { area: 'blog', coverage: 0.9, criticality: 1, ageDays: 0 }]);
  assert.equal(v.top.key, 'checkout');
  assert.equal(v.top.score, 48);
  assert.equal(v.top.priority, 'urgent');
});
test('53255 trackCoverageDebt: interest applied', () => {
  const v = XA.trackCoverageDebt([{ area: 'checkout', coverage: 0, size: 10, ageDays: 30 }, { area: 'blog', coverage: 0.5, size: 4, ageDays: 0 }]);
  assert.equal(v.top.key, 'checkout');
  assert.equal(v.top.debt, 13);
  assert.equal(v.top.escalated, true);
  assert.equal(v.totalDebt, 15);
});
test('53256 evaluateMinimumCoverageGates: failing class', () => {
  const v = XA.evaluateMinimumCoverageGates([{ targetClass: 'web', coverage: 0.8 }, { targetClass: 'web', coverage: 0.6 }, { targetClass: 'api', coverage: 0.5 }]);
  assert.equal(v.failingCount, 1);
  assert.equal(v.failing[0].key, 'api');
  assert.equal(v.failing[0].gap, 0.3);
  assert.equal(v.rows.find(r => r.key === 'web').pass, true);
});
test('53257 estimateCoverageWeightedFindings: weighted estimate', () => {
  const v = XA.estimateCoverageWeightedFindings([{ area: 'checkout', coverage: 0.1, size: 10 }, { area: 'blog', coverage: 0.9, size: 4 }], { rate: 0.5 });
  assert.equal(v.top.key, 'checkout');
  assert.equal(v.top.estimate, 4.5);
  assert.equal(v.totalEstimate, 4.7);
});
test('53258 buildSpiderTrapAvoidanceLog: wasted time grouped', () => {
  const v = XA.buildSpiderTrapAvoidanceLog([{ trapType: 'calendar', timeWastedMinutes: 10 }, { trapType: 'calendar', timeWastedMinutes: 5 }, { trapType: 'infinite-pagination', timeWastedMinutes: 7 }]);
  assert.equal(v.top.key, 'calendar');
  assert.equal(v.top.wastedMinutes, 15);
  assert.equal(v.top.encounters, 2);
  assert.equal(v.top.skipRule, 'skip:calendar');
  assert.equal(v.totalWastedMinutes, 22);
});
test('53259 buildAuthWallPenetrationReport: unpenetrated area', () => {
  const v = XA.buildAuthWallPenetrationReport([{ area: 'admin', coverage: 0.1, visible: true }, { area: 'billing', coverage: 0.7, visible: true }, { area: 'hidden', coverage: 0, visible: false }]);
  assert.equal(v.unpenetratedCount, 1);
  assert.equal(v.unpenetrated[0].key, 'admin');
  assert.equal(v.effectiveCount, 1);
});
test('53260 splitCoverageByUserRole: weakest role', () => {
  const v = XA.splitCoverageByUserRole([{ role: 'guest', coverage: 0.8 }, { role: 'user', coverage: 0.5 }, { role: 'admin', coverage: 0.2 }]);
  assert.equal(v.weakest.key, 'admin');
  assert.equal(v.strongest.key, 'guest');
  assert.equal(v.spread, 0.6);
});

/* ---- Wave82 B spot checks ---- */
test('53261 auditStateMachineCoverage: incomplete workflow', () => {
  const v = XB.auditStateMachineCoverage([{ name: 'checkout', totalTransitions: 6, testedTransitions: 4 }, { name: 'onboarding', totalTransitions: 3, testedTransitions: 3 }]);
  assert.equal(v.weakest.key, 'checkout');
  assert.equal(v.weakest.coverage, 0.67);
  assert.equal(v.weakest.untested, 2);
  assert.equal(v.incompleteCount, 1);
});
test('53262 detectCoverageRegressionAlerts: drop alerted', () => {
  const v = XB.detectCoverageRegressionAlerts([{ target: 'shop.example', coverage: 0.8, at: '2026-09-01' }, { target: 'shop.example', coverage: 0.6, at: '2026-10-01' }, { target: 'api.example', coverage: 0.5, at: '2026-09-01' }, { target: 'api.example', coverage: 0.55, at: '2026-10-01' }]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.worst.target, 'shop.example');
  assert.equal(v.worst.delta, -0.2);
});
test('53263 mapMicroserviceCoverage: weakest service', () => {
  const v = XB.mapMicroserviceCoverage([{ name: 'auth', coverage: 0.9 }, { name: 'billing', coverage: 0.3 }, { name: 'search', coverage: 0.6 }]);
  assert.equal(v.avgCoverage, 0.6);
  assert.equal(v.weakest.key, 'billing');
  assert.equal(v.gapCount, 1);
});
test('53264 verifyCoverageBySampling: overclaim detected', () => {
  const v = XB.verifyCoverageBySampling([{ area: 'checkout', coverage: 0.9, sampledCoverage: 0.6 }, { area: 'blog', coverage: 0.5, sampledCoverage: 0.55 }]);
  assert.equal(v.overclaimedCount, 1);
  assert.equal(v.overclaimed[0].key, 'checkout');
  assert.equal(v.overclaimed[0].diff, -0.3);
  assert.equal(v.honestCount, 1);
});
test('53265 buildTimeBoxedCoverageTargets: proportional target', () => {
  const v = XB.buildTimeBoxedCoverageTargets([{ area: 'checkout', coverage: 0.5 }, { area: 'admin', coverage: 0.95 }], { durationMinutes: 120, coveragePerHour: 0.1 });
  assert.equal(v.top.key, 'checkout');
  assert.equal(v.top.target, 0.7);
  assert.equal(v.rows.find(r => r.key === 'admin').additional, 0.05);
  assert.equal(v.totalAdditional, 0.25);
});
test('53266 tagCoverageGapRootCauses: inferred tags', () => {
  const v = XB.tagCoverageGapRootCauses([{ area: 'admin', authRequired: true, hasAuth: false }, { area: 'spa', jsHeavy: true }, { area: 'reports', timeboxExceeded: true }]);
  assert.equal(v.rows.find(r => r.key === 'admin').tag, 'auth-missing');
  assert.equal(v.rows.find(r => r.key === 'spa').tag, 'js-wall');
  assert.equal(v.rows.find(r => r.key === 'reports').tag, 'time-ran-out');
});
test('53267 verifyGapClosure: closed gap confirmed', () => {
  const v = XB.verifyGapClosure([{ area: 'checkout', coverage: 0.1 }, { area: 'admin', coverage: 0.2 }], [{ area: 'checkout', coverage: 0.8, requests: 90 }, { area: 'admin', coverage: 0.1, requests: 2 }]);
  assert.equal(v.closedCount, 1);
  assert.equal(v.closed[0].key, 'checkout');
  assert.equal(v.stillOpenCount, 1);
});
test('53268 assessCoverageFairnessAcrossTenants: unfair spread', () => {
  const v = XB.assessCoverageFairnessAcrossTenants([{ tenant: 'tenant-a', coverage: 0.8 }, { tenant: 'tenant-b', coverage: 0.75 }, { tenant: 'tenant-c', coverage: 0.2 }]);
  assert.equal(v.weakest.key, 'tenant-c');
  assert.equal(v.spread, 0.6);
  assert.equal(v.fair, false);
});
test('53269 inventoryLegacyEndpointCoverage: missed legacy endpoint', () => {
  const v = XB.inventoryLegacyEndpointCoverage([{ endpoint: '/v1/users', deprecated: true, requests: 0 }, { endpoint: '/v2/users', deprecated: false, requests: 10 }, { endpoint: '/v1/orders', deprecated: true, coverage: 0.4, requests: 5 }]);
  assert.equal(v.legacyCount, 2);
  assert.equal(v.missedCount, 1);
  assert.equal(v.missed[0].key, '/v1/users');
});
test('53270 splitCoverageByContentType: blind spots', () => {
  const v = XB.splitCoverageByContentType([{ contentType: 'json', coverage: 0.8 }, { contentType: 'xml', coverage: 0.3 }, { contentType: 'graphql', coverage: 0.6 }, { contentType: 'multipart', coverage: 0.1 }]);
  assert.equal(v.weakest.key, 'multipart');
  assert.equal(v.strongest.key, 'json');
  assert.equal(v.blindSpotCount, 2);
});
test('53271 scoreCoverageConfidence: method reliability', () => {
  const v = XB.scoreCoverageConfidence([{ area: 'checkout', discoveryMethod: 'crawler' }, { area: 'admin', discoveryMethod: 'guessed' }, { area: 'blog', discoveryMethod: 'manual' }]);
  assert.equal(v.weakest.key, 'admin');
  assert.equal(v.weakest.confidence, 0.4);
  assert.equal(v.strongest.key, 'blog');
  assert.equal(v.lowConfidenceCount, 1);
});
test('53272 mineBlindSpotPatterns: systematic type', () => {
  const v = XB.mineBlindSpotPatterns([{ areaType: 'file-upload', coverage: 0.2 }, { areaType: 'file-upload', coverage: 0.3 }, { areaType: 'search', coverage: 0.9 }]);
  assert.equal(v.patternCount, 1);
  assert.equal(v.patterns[0].key, 'file-upload');
  assert.equal(v.patterns[0].avgCoverage, 0.25);
});
test('53273 suggestCoverageGapBountyMultipliers: capped multiplier', () => {
  const v = XB.suggestCoverageGapBountyMultipliers([{ area: 'checkout', coverage: 0, ageDays: 90, criticality: 5 }, { area: 'blog', coverage: 0.9, ageDays: 0, criticality: 1 }], { baseBounty: 100 });
  assert.equal(v.top.key, 'checkout');
  assert.equal(v.top.multiplier, 3);
  assert.equal(v.top.suggestedBounty, 300);
  assert.equal(v.rows[1].multiplier, 1.2);
});
test('53274 buildCoverageNarrativeSummary: paragraph generated', () => {
  const v = XB.buildCoverageNarrativeSummary([{ area: 'checkout', coverage: 0.8 }, { area: 'blog', coverage: 0 }, { area: 'admin', coverage: 0.1 }]);
  assert.equal(v.testedCount, 2);
  assert.equal(v.darkCount, 1);
  assert.equal(v.avgCoverage, 0.3);
  assert.equal(v.weakest.key, 'blog');
  assert.ok(v.paragraph.includes('Infinity AI tested 2 of 3'));
});
test('53275 buildCoverageVsFindingsScatter: perfect correlation', () => {
  const v = XB.buildCoverageVsFindingsScatter([{ target: 'a.example', coverage: 0.2, findings: 1 }, { target: 'b.example', coverage: 0.5, findings: 2 }, { target: 'c.example', coverage: 0.8, findings: 3 }]);
  assert.equal(v.correlation, 1);
  assert.equal(v.count, 3);
  assert.equal(v.strongest.key, 'c.example');
});
test('53276 buildPreHuntCoveragePlan: ordered plan', () => {
  const v = XB.buildPreHuntCoveragePlan([{ area: 'checkout', coverage: 0.1, criticality: 5 }, { area: 'blog', coverage: 0.9, criticality: 1 }], { minutesPerArea: 30 });
  assert.equal(v.first.key, 'checkout');
  assert.equal(v.first.order, 1);
  assert.equal(v.first.etaMinutes, 30);
  assert.equal(v.totalMinutes, 60);
});
test('53277 buildCoverageGapAgingReport: oldest gap', () => {
  const v = XB.buildCoverageGapAgingReport([{ area: 'checkout', ageDays: 100 }, { area: 'blog', ageDays: 5 }, { area: 'admin', ageDays: 45 }]);
  assert.equal(v.oldest.key, 'checkout');
  assert.equal(v.oldest.bucket, 'ancient');
  assert.equal(v.staleCount, 2);
});
test('53278 buildCoverageAPIForResearchers: payload shaped', () => {
  const v = XB.buildCoverageAPIForResearchers([{ area: 'checkout', coverage: 0.8 }, { area: 'admin', coverage: 0 }]);
  assert.equal(v.payload.generatedBy, 'Infinity AI');
  assert.equal(v.endpoint, '/api/v1/coverage');
  assert.equal(v.darkCount, 1);
  assert.equal(v.query, 'GET /api/v1/coverage?coverage=dark');
});
test('53279 buildCoverageVisualizationPlayground: cells banded', () => {
  const v = XB.buildCoverageVisualizationPlayground([{ area: 'checkout', coverage: 0 }, { area: 'admin', coverage: 0.5 }, { area: 'blog', coverage: 1 }]);
  assert.deepEqual(v.cells.map(c => c.band), ['dark', 'partial', 'covered']);
  assert.equal(v.weakest.key, 'checkout');
  assert.equal(v.annotationCount, 1);
});
test('53280 scheduleCoverageDrivenFollowUps: critical low coverage scheduled', () => {
  const v = XB.scheduleCoverageDrivenFollowUps([{ area: 'checkout', coverage: 0.1, criticality: 5 }, { area: 'blog', coverage: 0.9, criticality: 5 }, { area: 'admin', coverage: 0.2, criticality: 1 }], { threshold: 0.5 });
  assert.equal(v.scheduledCount, 1);
  assert.equal(v.next.key, 'checkout');
  assert.equal(v.next.scheduleInDays, 3);
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
test('css: only .w82a-/.w82b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w82a-') || cls.startsWith('w82b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave82A.jsx', 'Wave82B.jsx']) {
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
