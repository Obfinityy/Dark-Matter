/**
 * wave81.test.js — Infinity AI · Dark-Matter · Wave 81
 * node:test + node:assert/strict. Registry coverage (20/20 for 53201–53220,
 * 20/20 for 53221–53240, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave81.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE81_A_IDEAS } from './wave81ACore.js';
import * as XA from './wave81ACore.js';
import { WAVE81_B_IDEAS } from './wave81BCores.js';
import * as XB from './wave81BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave81ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave81BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave81A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave81B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave81.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 81A ideas, 20/20 wave 81B ideas, zero skips', () => {
  assert.equal(WAVE81_A_IDEAS.length, 20);
  assert.equal(WAVE81_B_IDEAS.length, 20);
  const all = [...WAVE81_A_IDEAS, ...WAVE81_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53201 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE81_A_IDEAS, ...WAVE81_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    53201: 'ttf after re-hunt intervals', 53202: 'ttf by recon tool choice', 53203: 'ttf stall recovery playbook', 53204: 'ttf gamification', 53205: 'ttf-adjusted pricing insights', 53206: 'ttf by prompt template', 53207: 'ttf variance as health metric', 53208: 'ttf for chained findings', 53209: 'ttf by network conditions', 53210: 'ttf cohort analysis', 53211: 'ttf floor analysis', 53212: 'ttf by finding category', 53213: 'ttf early-signal detection', 53214: 'ttf vs coverage at first finding', 53215: 'ttf for zero-day-like finds', 53216: 'ttf by model size tier', 53217: 'ttf human-vs-agent splits', 53218: 'ttf report card per target', 53219: 'ttf anomaly explanations', 53220: 'ttf-driven scope triage',
    53221: 'ttf by authentication method', 53222: 'ttf during incident response', 53223: 'ttf learning curve per researcher', 53224: 'ttf benchmark export api', 53225: 'ttf by data freshness', 53226: 'ttf celebration triggers', 53227: 'ttf postmortem templates', 53228: 'ttf vs hunt satisfaction', 53229: 'automated coverage gap reports', 53230: 'endpoint coverage heatmaps', 53231: 'parameter coverage matrix', 53232: 'http method coverage audit', 53233: 'authentication-state coverage split', 53234: 'feature-area coverage treemap', 53235: 'file-type coverage check', 53236: 'subdomain coverage ledger', 53237: 'mobile-vs-web coverage compare', 53238: 'versioned-api coverage', 53239: 'coverage gap severity weighting', 53240: 'gap-to-finding probability estimates',
  };
  for (const [id, needle] of Object.entries(expected)) {
    assert.ok(byId[id].includes(needle), `${id}: ${byId[id]} missing ${needle}`);
  }
});

/* ---- Wave81 A spot checks ---- */
test('53201 analyzeTTFAfterReHuntIntervals: 30d fastest', () => {
  const v = XA.analyzeTTFAfterReHuntIntervals([{ reHuntIntervalDays: 30, ttfMinutes: 10 }, { reHuntIntervalDays: 30, ttfMinutes: 20 }, { reHuntIntervalDays: 90, ttfMinutes: 30 }, { reHuntIntervalDays: 180, ttfMinutes: 50 }]);
  assert.equal(v.fastest.key, '30d');
  assert.equal(v.fastest.medianTTF, 15);
  assert.equal(v.delta, 35);
});
test('53202 analyzeTTFByReconTool: katana fastest', () => {
  const v = XA.analyzeTTFByReconTool([{ reconTool: 'katana', ttfMinutes: 10 }, { reconTool: 'katana', ttfMinutes: 20 }, { reconTool: 'httpx', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'katana');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53203 buildTTFStallRecoveryPlaybook: best move ranked', () => {
  const v = XA.buildTTFStallRecoveryPlaybook([{ move: 'rotate-recon-tool', recovered: true, recoveryMinutes: 6 }, { move: 'rotate-recon-tool', recovered: true, recoveryMinutes: 8 }, { move: 'switch-auth', recovered: true, recoveryMinutes: 12 }, { move: 'restart-crawl', recovered: false, recoveryMinutes: 20 }]);
  assert.equal(v.top.key, 'rotate-recon-tool');
  assert.equal(v.top.recoveryRate, 1);
  assert.equal(v.top.medianRecoveryMinutes, 7);
});
test('53204 buildTTFGamification: pace ring computed', () => {
  const v = XA.buildTTFGamification([{ ttfMinutes: 10 }, { ttfMinutes: 20 }, { ttfMinutes: 30 }, { ttfMinutes: 40 }, { ttfMinutes: 50 }], { currentMinutes: 12 });
  assert.equal(v.median, 30);
  assert.equal(v.p90, 50);
  assert.equal(v.ring, 0.24);
  assert.equal(v.status, 'on-track');
  assert.equal(v.percentileRank, 0.8);
});
test('53205 estimateTTFAdjustedPricing: cheapest strategy ranked', () => {
  const v = XA.estimateTTFAdjustedPricing([{ strategy: 'a', ttfMinutes: 60, findings: 2 }, { strategy: 'b', ttfMinutes: 120, findings: 1 }]);
  assert.equal(v.cheapest.key, 'a');
  assert.equal(v.cheapest.costPerHunt, 50);
  assert.equal(v.cheapest.costPerFinding, 25);
  assert.equal(v.medianTTF, 90);
  assert.equal(v.costPerHunt, 75);
});
test('53206 compareTTFByPromptTemplate: sprint fastest', () => {
  const v = XA.compareTTFByPromptTemplate([{ promptTemplate: 'sprint', ttfMinutes: 10 }, { promptTemplate: 'sprint', ttfMinutes: 20 }, { promptTemplate: 'deep', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'sprint');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53207 assessTTFVarianceHealth: volatile group flagged', () => {
  const v = XA.assessTTFVarianceHealth([{ strategy: 'calm', ttfMinutes: 10 }, { strategy: 'calm', ttfMinutes: 10 }, { strategy: 'calm', ttfMinutes: 10 }, { strategy: 'wild', ttfMinutes: 10 }, { strategy: 'wild', ttfMinutes: 50 }]);
  assert.equal(v.worst.key, 'wild');
  assert.equal(v.worst.variance, 400);
  assert.equal(v.alertCount, 1);
});
test('53208 analyzeTTFForChainedFindings: chained slower', () => {
  const v = XA.analyzeTTFForChainedFindings([{ chained: true, ttfMinutes: 40 }, { chained: true, ttfMinutes: 60 }, { chained: false, ttfMinutes: 10 }, { chained: false, ttfMinutes: 20 }]);
  assert.equal(v.chainedMedian, 50);
  assert.equal(v.standaloneMedian, 15);
  assert.equal(v.delta, 35);
});
test('53209 analyzeTTFByNetworkConditions: fast network fastest', () => {
  const v = XA.analyzeTTFByNetworkConditions([{ networkCondition: 'fast', ttfMinutes: 10 }, { networkCondition: 'fast', ttfMinutes: 20 }, { networkCondition: 'throttled', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'fast');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53210 analyzeTTFCohorts: improving trend', () => {
  const v = XA.analyzeTTFCohorts([{ cohort: '2026-01', ttfMinutes: 50 }, { cohort: '2026-02', ttfMinutes: 30 }, { cohort: '2026-03', ttfMinutes: 20 }]);
  assert.equal(v.count, 3);
  assert.equal(v.trend, -30);
  assert.equal(v.latest.key, '2026-03');
});
test('53211 analyzeTTFFloor: lowest floor ranked', () => {
  const v = XA.analyzeTTFFloor([{ targetClass: 'web', ttfMinutes: 30 }, { targetClass: 'web', ttfMinutes: 50 }, { targetClass: 'api', ttfMinutes: 10 }, { targetClass: 'api', ttfMinutes: 20 }]);
  assert.equal(v.lowest.key, 'api');
  assert.equal(v.lowest.floor, 10);
});
test('53212 analyzeTTFByFindingCategory: injection fastest', () => {
  const v = XA.analyzeTTFByFindingCategory([{ findingCategory: 'injection-like', ttfMinutes: 10 }, { findingCategory: 'injection-like', ttfMinutes: 20 }, { findingCategory: 'xss-like', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'injection-like');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53213 detectTTFEarlySignals: strongest signal ranked', () => {
  const v = XA.detectTTFEarlySignals([{ signal: '5xx-spike', precededFinding: true, leadMinutes: 4 }, { signal: '5xx-spike', precededFinding: true, leadMinutes: 6 }, { signal: 'slow-endpoint', precededFinding: true, leadMinutes: 15 }]);
  assert.equal(v.strongest.key, '5xx-spike');
  assert.equal(v.strongest.precision, 1);
  assert.equal(v.strongest.medianLeadMinutes, 5);
});
test('53214 analyzeTTFVsCoverageAtFirstFinding: perfect correlation', () => {
  const v = XA.analyzeTTFVsCoverageAtFirstFinding([{ ttfMinutes: 10, coverageAtFirstFinding: 0.2 }, { ttfMinutes: 20, coverageAtFirstFinding: 0.4 }, { ttfMinutes: 30, coverageAtFirstFinding: 0.6 }]);
  assert.equal(v.correlation, 1);
  assert.equal(v.medianCoverage, 0.4);
});
test('53215 analyzeTTFForZeroDayLikeFinds: novel slower', () => {
  const v = XA.analyzeTTFForZeroDayLikeFinds([{ novel: true, ttfMinutes: 50 }, { novel: true, ttfMinutes: 70 }, { novel: false, ttfMinutes: 10 }, { novel: false, ttfMinutes: 30 }]);
  assert.equal(v.novelMedian, 60);
  assert.equal(v.knownMedian, 20);
  assert.equal(v.delta, 40);
});
test('53216 analyzeTTFByModelTier: large tier fastest', () => {
  const v = XA.analyzeTTFByModelTier([{ modelTier: 'large', ttfMinutes: 10 }, { modelTier: 'large', ttfMinutes: 20 }, { modelTier: 'small', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'large');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53217 splitTTFHumanVsAgent: agent share computed', () => {
  const v = XA.splitTTFHumanVsAgent([{ ttfMinutes: 20, humanMinutes: 5, agentMinutes: 15 }, { ttfMinutes: 30, humanMinutes: 5, agentMinutes: 25 }]);
  assert.equal(v.humanMinutes, 10);
  assert.equal(v.agentMinutes, 40);
  assert.equal(v.agentShare, 0.8);
  assert.equal(v.humanShare, 0.2);
});
test('53218 buildTTFReportCardPerTarget: most improved first', () => {
  const v = XA.buildTTFReportCardPerTarget([{ target: 'shop', at: '2026-01-01', ttfMinutes: 60 }, { target: 'shop', at: '2026-02-01', ttfMinutes: 30 }, { target: 'api', at: '2026-01-01', ttfMinutes: 20 }, { target: 'api', at: '2026-02-01', ttfMinutes: 25 }]);
  assert.equal(v.mostImproved.key, 'shop');
  assert.equal(v.mostImproved.delta, -30);
  assert.equal(v.mostImproved.grade, 'improving');
});
test('53219 explainTTFAnomalies: slow outlier explained', () => {
  const v = XA.explainTTFAnomalies([{ ttfMinutes: 20 }, { ttfMinutes: 20 }, { ttfMinutes: 20 }, { ttfMinutes: 100 }]);
  assert.equal(v.baseline, 20);
  assert.equal(v.anomalyCount, 1);
  assert.equal(v.worst.ttfMinutes, 100);
  assert.equal(v.worst.direction, 'slow');
});
test('53220 triageScopeByPredictedTTF: critical fast asset first', () => {
  const v = XA.triageScopeByPredictedTTF([{ asset: 'payments', predictedTTF: 20, criticality: 5 }, { asset: 'blog', predictedTTF: 45, criticality: 1 }, { asset: 'admin', predictedTTF: 30, criticality: 4 }]);
  assert.equal(v.first.key, 'payments');
  assert.equal(v.first.score, 10);
  assert.equal(v.first.recommendation, 'hunt-first');
});

/* ---- Wave81 B spot checks ---- */
test('53221 analyzeTTFByAuthMethod: oauth fastest', () => {
  const v = XB.analyzeTTFByAuthMethod([{ authMethod: 'oauth', ttfMinutes: 15 }, { authMethod: 'oauth', ttfMinutes: 25 }, { authMethod: 'api-key', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'oauth');
  assert.equal(v.fastest.medianTTF, 20);
});
test('53222 analyzeTTFDuringIncidentResponse: incident delta', () => {
  const v = XB.analyzeTTFDuringIncidentResponse([{ incident: true, ttfMinutes: 40 }, { incident: true, ttfMinutes: 60 }, { incident: false, ttfMinutes: 15 }, { incident: false, ttfMinutes: 25 }]);
  assert.equal(v.incidentMedian, 50);
  assert.equal(v.routineMedian, 20);
  assert.equal(v.delta, 30);
});
test('53223 buildTTFLearningCurve: fastest learner ranked', () => {
  const v = XB.buildTTFLearningCurve([{ researcher: 'r1', huntIndex: 1, ttfMinutes: 50 }, { researcher: 'r1', huntIndex: 2, ttfMinutes: 30 }, { researcher: 'r2', huntIndex: 1, ttfMinutes: 40 }, { researcher: 'r2', huntIndex: 2, ttfMinutes: 35 }]);
  assert.equal(v.fastestLearner.key, 'r1');
  assert.equal(v.fastestLearner.improvement, 20);
});
test('53224 buildTTFBenchmarkExport: payload shaped', () => {
  const v = XB.buildTTFBenchmarkExport([{ strategy: 'a', ttfMinutes: 10 }, { strategy: 'a', ttfMinutes: 30 }, { strategy: 'b', ttfMinutes: 50 }]);
  assert.equal(v.count, 2);
  assert.equal(v.median, 30);
  assert.equal(v.p90, 50);
  assert.equal(v.payload.generatedBy, 'Infinity AI');
  assert.equal(v.endpoint, '/api/v1/benchmarks/ttf');
});
test('53225 analyzeTTFByDataFreshness: fresh fastest', () => {
  const v = XB.analyzeTTFByDataFreshness([{ freshness: 'fresh', ttfMinutes: 10 }, { freshness: 'fresh', ttfMinutes: 20 }, { freshness: 'stale', ttfMinutes: 60 }]);
  assert.equal(v.fastest.key, 'fresh');
  assert.equal(v.fastest.medianTTF, 15);
});
test('53226 detectTTFCelebrationTriggers: p10 beater flagged', () => {
  const v = XB.detectTTFCelebrationTriggers([{ targetClass: 'web', ttfMinutes: 10 }, { targetClass: 'web', ttfMinutes: 20 }, { targetClass: 'web', ttfMinutes: 30 }, { targetClass: 'web', ttfMinutes: 40 }]);
  assert.equal(v.triggerCount, 1);
  assert.equal(v.triggers[0].ttfMinutes, 10);
});
test('53227 buildTTFPostmortemTemplates: 2x misses templated', () => {
  const v = XB.buildTTFPostmortemTemplates([{ ttfMinutes: 70 }, { ttfMinutes: 100 }, { ttfMinutes: 20 }], { targetMinutes: 30 });
  assert.equal(v.templateCount, 2);
  assert.equal(v.worst.ttfMinutes, 100);
  assert.equal(v.worst.missRatio, 3.33);
});
test('53228 correlateTTFWithSatisfaction: negative correlation', () => {
  const v = XB.correlateTTFWithSatisfaction([{ ttfMinutes: 10, satisfaction: 5 }, { ttfMinutes: 20, satisfaction: 4 }, { ttfMinutes: 30, satisfaction: 3 }]);
  assert.equal(v.correlation, -1);
  assert.equal(v.direction, 'negative');
});
test('53229 generateCoverageGapReports: low areas flagged', () => {
  const v = XB.generateCoverageGapReports([{ target: 'shop', areas: [{ area: 'checkout', coverage: 0.1 }, { area: 'blog', coverage: 0.9 }, { area: 'admin', coverage: 0 }] }]);
  assert.equal(v.gapCount, 2);
  assert.equal(v.worstGap.area, 'admin');
  assert.equal(v.worstGap.coverage, 0);
});
test('53230 buildEndpointCoverageHeatmaps: hottest ranked', () => {
  const v = XB.buildEndpointCoverageHeatmaps([{ endpoint: '/api/users', hits: 80, payloadDiversity: 12 }, { endpoint: '/api/orders', hits: 20, payloadDiversity: 5 }, { endpoint: '/api/legacy', hits: 0, payloadDiversity: 0 }]);
  assert.equal(v.hottest.key, '/api/users');
  assert.equal(v.hottest.heat, 'hot');
  assert.equal(v.coldCount, 1);
});
test('53231 buildParameterCoverageMatrix: untouched counted', () => {
  const v = XB.buildParameterCoverageMatrix([{ parameter: 'id', tested: true, tests: 12 }, { parameter: 'debug', tested: false, tests: 0 }]);
  assert.equal(v.untouchedCount, 1);
  assert.equal(v.coverageRate, 0.5);
});
test('53232 auditHTTPMethodCoverage: untested methods flagged', () => {
  const v = XB.auditHTTPMethodCoverage([{ endpoint: '/api/users', methods: ['GET', 'POST'], testedMethods: ['GET'] }, { endpoint: '/api/legacy', methods: ['GET'], testedMethods: [] }, { endpoint: '/api/orders', methods: ['GET', 'POST', 'DELETE'], testedMethods: ['GET', 'POST'] }]);
  assert.equal(v.flaggedCount, 3);
  const users = v.rows.find(r => r.key === '/api/users');
  assert.deepEqual(users.missing, ['POST']);
});
test('53233 splitCoverageByAuthState: weakest state ranked', () => {
  const v = XB.splitCoverageByAuthState([{ authState: 'anonymous', coverage: 0.8, requests: 100 }, { authState: 'admin', coverage: 0.2, requests: 5 }]);
  assert.equal(v.weakest.key, 'admin');
  assert.equal(v.strongest.key, 'anonymous');
});
test('53234 buildFeatureAreaCoverageTreemap: weighted coverage', () => {
  const v = XB.buildFeatureAreaCoverageTreemap([{ area: 'checkout', endpoints: 8, coverage: 0.1 }, { area: 'blog', endpoints: 4, coverage: 0.9 }]);
  assert.equal(v.largest.key, 'checkout');
  assert.equal(v.weightedCoverage, 0.37);
});
test('53235 checkFileTypeCoverage: untested type found', () => {
  const v = XB.checkFileTypeCoverage([{ fileType: 'pdf-upload', tested: true, uploads: 4 }, { fileType: 'csv-export', tested: false, uploads: 0 }]);
  assert.equal(v.untestedCount, 1);
  assert.equal(v.untested[0].fileType, 'csv-export');
});
test('53236 buildSubdomainCoverageLedger: missed host exposed', () => {
  const v = XB.buildSubdomainCoverageLedger([{ subdomain: 'api.example', requests: 50, inScope: true }, { subdomain: 'old.example', requests: 0, inScope: true }]);
  assert.equal(v.missedCount, 1);
  assert.equal(v.missed[0].subdomain, 'old.example');
});
test('53237 compareMobileVsWebCoverage: web leads', () => {
  const v = XB.compareMobileVsWebCoverage([{ platform: 'web', coverage: 0.7, requests: 200 }, { platform: 'mobile', coverage: 0.3, requests: 40 }]);
  assert.equal(v.leader.key, 'web');
  assert.equal(v.delta, 0.4);
});
test('53238 auditVersionedAPICoverage: neglected version flagged', () => {
  const v = XB.auditVersionedAPICoverage([{ version: 'v2', requests: 60 }, { version: 'v2', requests: 40 }, { version: 'v1', requests: 0 }]);
  assert.equal(v.neglectedCount, 1);
  assert.equal(v.neglected[0].key, 'v1');
});
test('53239 weightCoverageGapSeverity: critical gap first', () => {
  const v = XB.weightCoverageGapSeverity([{ area: 'checkout', coverage: 0.1, criticality: 5, size: 8 }, { area: 'blog', coverage: 0.9, criticality: 1, size: 4 }]);
  assert.equal(v.mostSevere.key, 'checkout');
  assert.equal(v.mostSevere.severityScore, 36);
  assert.equal(v.mostSevere.severity, 'critical');
});
test('53240 estimateGapToFindingProbability: likeliest gap first', () => {
  const v = XB.estimateGapToFindingProbability([{ area: 'checkout', coverage: 0.1, criticality: 5, historicalFindings: 3, historicalGaps: 10 }, { area: 'blog', coverage: 0.9, criticality: 1, historicalFindings: 0, historicalGaps: 10 }]);
  assert.equal(v.mostLikely.key, 'checkout');
  assert.equal(v.mostLikely.probability, 0.32);
  assert.equal(v.mostLikely.band, 'possible');
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
test('css: only .w81a-/.w81b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w81a-') || cls.startsWith('w81b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave81A.jsx', 'Wave81B.jsx']) {
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
test('no-debris: no TODO/FIXME placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `placeholder mention in ${name}`);
    assert.ok(!/\bsimulate\b/i.test(src), `placeholder mention in ${name}`);
  }
});
