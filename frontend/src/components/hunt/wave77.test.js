/**
 * wave77.test.js — Infinity AI · Dark-Matter · Wave 77
 * node:test + node:assert/strict. Registry coverage (20/20 for 53041–53060,
 * 20/20 for 53061–53080, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave77.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE77_A_IDEAS } from './wave77ACore.js';
import * as XA from './wave77ACore.js';
import { WAVE77_B_IDEAS } from './wave77BCores.js';
import * as XB from './wave77BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave77ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave77BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave77A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave77B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave77.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 77A ideas, 20/20 wave 77B ideas, zero skips', () => {
  assert.equal(WAVE77_A_IDEAS.length, 20);
  assert.equal(WAVE77_B_IDEAS.length, 20);
  const all = [...WAVE77_A_IDEAS, ...WAVE77_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53041 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE77_A_IDEAS, ...WAVE77_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[53041].includes('baseline deviation alert'));
  assert.ok(byId[53042].includes('discovery funnel visualization'));
  assert.ok(byId[53043].includes('inter-finding lag analysis'));
  assert.ok(byId[53044].includes('hypothesis hit rate'));
  assert.ok(byId[53045].includes('confirmation cost tracking'));
  assert.ok(byId[53046].includes('cross-target pattern match'));
  assert.ok(byId[53047].includes('report-readiness score'));
  assert.ok(byId[53048].includes('missed-obvious audit'));
  assert.ok(byId[53049].includes('technique novelty bonus'));
  assert.ok(byId[53050].includes('context-switch cost'));
  assert.ok(byId[53051].includes('evidence chain completeness'));
  assert.ok(byId[53052].includes('stealth efficiency rating'));
  assert.ok(byId[53053].includes('resource burn rate'));
  assert.ok(byId[53054].includes('pre-hunt intel utilization'));
  assert.ok(byId[53055].includes('adaptive threshold tuning log'));
  assert.ok(byId[53056].includes('dead-end recovery time'));
  assert.ok(byId[53057].includes('confirmation bias check'));
  assert.ok(byId[53058].includes('finding freshness score'));
  assert.ok(byId[53059].includes('hunt signature fingerprint'));
  assert.ok(byId[53060].includes('what-worked digest email'));
  assert.ok(byId[53061].includes('stack-specific hit-rate matrix'));
  assert.ok(byId[53062].includes('framework version sensitivity tracking'));
  assert.ok(byId[53063].includes('cms plugin payload ledger'));
  assert.ok(byId[53064].includes('waf-fingerprint-conditioned scores'));
  assert.ok(byId[53065].includes('language-runtime effectiveness split'));
  assert.ok(byId[53066].includes('database-backend correlation'));
  assert.ok(byId[53067].includes('cloud-provider payload variance'));
  assert.ok(byId[53068].includes('cdn layer impact analysis'));
  assert.ok(byId[53069].includes('server header evolution tracking'));
  assert.ok(byId[53070].includes('middleware stack fingerprint scoring'));
  assert.ok(byId[53071].includes('headless-vs-traditional cms split'));
  assert.ok(byId[53072].includes('spa framework payload profiles'));
  assert.ok(byId[53073].includes('api gateway conditioning'));
  assert.ok(byId[53074].includes('container orchestration signals'));
  assert.ok(byId[53075].includes('legacy stack decay curves'));
  assert.ok(byId[53076].includes('stack combo rarity index'));
  assert.ok(byId[53077].includes('patch-level granularity tracking'));
  assert.ok(byId[53078].includes('multi-tenant saas normalization'));
  assert.ok(byId[53079].includes('edge compute payload behavior'));
  assert.ok(byId[53080].includes('graphql engine specificity'));
});

/* ---- Wave77 A spot checks (53041–53060) ---- */
test('53041 alertBaselineDeviation: over and under flagged', () => {
  const v = XA.alertBaselineDeviation({ huntId: 'h1', findings: 10, verified: 5, requests: 100 }, { findings: 5, verified: 5, requests: 200 }, { thresholdPct: 50 });
  assert.equal(v.flaggedCount, 2);
  assert.equal(v.worst.metric, 'findings');
  assert.equal(v.rows[2].direction, 'under');
});

test('53042 buildDiscoveryFunnel: stage totals and rates', () => {
  const v = XA.buildDiscoveryFunnel([{ phase: 'recon', probed: 100, anomalies: 20, validated: 5 }, { phase: 'exploit', probed: 50, anomalies: 10, validated: 5 }]);
  assert.equal(v.totals.probed, 150);
  assert.equal(v.totals.validated, 10);
  assert.equal(v.rows[0].anomalyRate, 0.2);
  assert.equal(v.rows[0].validationRate, 0.25);
  assert.equal(v.overallValidationRate, 0.07);
});

test('53043 analyzeInterFindingLag: gaps and stuck windows', () => {
  const v = XA.analyzeInterFindingLag([{ at: '2026-10-09T00:00:00Z' }, { at: '2026-10-09T00:10:00Z' }, { at: '2026-10-09T00:40:00Z' }], { stuckMinutes: 20 });
  assert.deepEqual(v.gapsMinutes, [10, 30]);
  assert.equal(v.maxGapMinutes, 30);
  assert.equal(v.avgGapMinutes, 20);
  assert.equal(v.stuckCount, 1);
});

test('53044 scoreHypothesisHitRate: decided hypotheses only', () => {
  const v = XA.scoreHypothesisHitRate([{ id: 'h1', confirmed: true }, { id: 'h2', confirmed: true }, { id: 'h3', refuted: true }, { id: 'h4' }]);
  assert.equal(v.decidedCount, 3);
  assert.equal(v.confirmedCount, 2);
  assert.equal(v.hitRate, 0.67);
});

test('53045 trackConfirmationCost: totals and costliest', () => {
  const v = XA.trackConfirmationCost([{ id: 'f1', confirmRequests: 30 }, { id: 'f2', confirmRequests: 10 }], { expensiveRequests: 25 });
  assert.equal(v.totalRequests, 40);
  assert.equal(v.avgRequests, 20);
  assert.equal(v.expensiveCount, 1);
  assert.equal(v.costliest.findingId, 'f1');
});

test('53046 matchCrossTargetPatterns: prior hunt matched', () => {
  const v = XA.matchCrossTargetPatterns([{ id: 'f1', signature: 'sqli-login' }, { id: 'f2', signature: 'xss-search' }], [{ signature: 'sqli-login', huntId: 'h0', target: 'a.example.com' }]);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.matchRate, 0.5);
  assert.equal(v.rows[0].priorHuntId, 'h0');
});

test('53047 scoreReportReadiness: ready count and average', () => {
  const v = XA.scoreReportReadiness([{ id: 'f1', request: 'r', response: 's', impact: 'i', reproSteps: 'x' }, { id: 'f2', request: 'r' }]);
  assert.equal(v.readyCount, 1);
  assert.equal(v.avgScore, 63);
  assert.equal(v.leastReady.findingId, 'f2');
});

test('53048 auditMissedObvious: low-coverage ranked by likelihood', () => {
  const v = XA.auditMissedObvious([{ id: 'a1', name: 'Admin', coveragePct: 10, expertLikelihood: 9 }, { id: 'a2', name: 'Home', coveragePct: 90, expertLikelihood: 1 }, { id: 'a3', name: 'API', coveragePct: 20, expertLikelihood: 7 }], { maxCoveragePct: 25 });
  assert.equal(v.count, 2);
  assert.equal(v.topMiss.areaId, 'a1');
});

test('53049 scoreTechniqueNovelty: bonus sums novel and adapted', () => {
  const v = XA.scoreTechniqueNovelty([{ id: 't1', novel: true, findings: 2 }, { id: 't2', adapted: true }, { id: 't3' }]);
  assert.equal(v.totalBonus, 15);
  assert.equal(v.novelCount, 1);
  assert.equal(v.adaptedCount, 1);
});

test('53050 measureContextSwitchCost: blocks and switches', () => {
  const v = XA.measureContextSwitchCost([{ at: '2026-10-09T00:01:00Z', area: 'web' }, { at: '2026-10-09T00:02:00Z', area: 'web', type: 'finding' }, { at: '2026-10-09T00:03:00Z', area: 'api' }, { at: '2026-10-09T00:04:00Z', area: 'web' }]);
  assert.equal(v.blockCount, 3);
  assert.equal(v.switchCount, 2);
  assert.equal(v.totalFindings, 1);
  assert.equal(v.findingsPerBlock, 0.33);
});

test('53051 checkEvidenceChainCompleteness: missing links listed', () => {
  const v = XA.checkEvidenceChainCompleteness([{ id: 'f1', request: 'r', response: 's', impact: 'i' }, { id: 'f2', request: 'r' }]);
  assert.equal(v.completeCount, 1);
  assert.equal(v.completenessRate, 0.5);
  assert.deepEqual(v.incomplete[0].missingLinks, ['response', 'impact']);
});

test('53052 rateStealthEfficiency: low risk with findings is efficient', () => {
  const v = XA.rateStealthEfficiency({ huntId: 'h1', detectionRisk: 20 }, [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }, { id: 'f4' }]);
  assert.equal(v.findingCount, 4);
  assert.equal(v.efficiency, 0.2);
  assert.equal(v.verdict, 'efficient');
});

test('53053 computeResourceBurnRate: most efficient first', () => {
  const v = XA.computeResourceBurnRate([{ huntId: 'h1', findings: 2, requests: 100, computeMinutes: 60 }, { huntId: 'h2', findings: 5, requests: 100, computeMinutes: 50 }]);
  assert.equal(v.mostEfficient.huntId, 'h2');
  assert.equal(v.mostEfficient.requestsPerFinding, 20);
  assert.equal(v.mostEfficient.minutesPerFinding, 10);
});

test('53054 measureIntelUtilization: used intel and payoff', () => {
  const v = XA.measureIntelUtilization([{ id: 'i1', paidOff: true }, { id: 'i2' }, { id: 'i3' }], [{ intelIds: ['i1', 'i3'] }]);
  assert.equal(v.usedCount, 2);
  assert.equal(v.utilizationRate, 0.67);
  assert.equal(v.payoffCount, 1);
});

test('53055 logAdaptiveThresholdTuning: precision improvement tracked', () => {
  const v = XA.logAdaptiveThresholdTuning([{ at: '2026-10-09T00:01:00Z', detector: 'sqli', from: 0.5, to: 0.7, precisionBefore: 0.6, precisionAfter: 0.8 }, { at: '2026-10-09T00:00:00Z', detector: 'xss', from: 0.4, to: 0.3, precisionBefore: 0.7, precisionAfter: 0.65 }]);
  assert.equal(v.improvedCount, 1);
  assert.equal(v.best.detector, 'sqli');
  assert.equal(v.best.precisionDelta, 0.2);
});

test('53056 measureDeadEndRecoveryTime: average abandon time', () => {
  const v = XA.measureDeadEndRecoveryTime([{ id: 'd1', minutesSpent: 30 }, { id: 'd2', minutesSpent: 10 }]);
  assert.equal(v.avgMinutes, 20);
  assert.equal(v.slowest.lineId, 'd1');
});

test('53057 checkConfirmationBias: dominant theory flagged', () => {
  const v = XA.checkConfirmationBias([{ id: 'h1', tests: 60 }, { id: 'h2', tests: 40 }], [{ contradicts: true }, { contradicts: true, addressed: true }, { contradicts: false }]);
  assert.equal(v.topSharePct, 60);
  assert.equal(v.biased, true);
  assert.equal(v.contradictoryCount, 2);
  assert.equal(v.ignoredCount, 1);
});

test('53058 scoreFindingFreshness: known variants separated', () => {
  const v = XA.scoreFindingFreshness([{ id: 'f1', signature: 'new-1' }, { id: 'f2', signature: 'old-1' }], [{ signature: 'old-1' }]);
  assert.equal(v.freshCount, 1);
  assert.equal(v.freshnessRate, 0.5);
  assert.equal(v.rows[1].classification, 'variant');
});

test('53059 fingerprintHuntSignature: dominant family and fingerprint', () => {
  const v = XA.fingerprintHuntSignature({ huntId: 'h1' }, [{ family: 'recon', uses: 3 }, { family: 'exploit', uses: 1 }]);
  assert.ok(v.fingerprint.startsWith('sig-'));
  assert.equal(v.dominantFamily.family, 'recon');
  assert.equal(v.dominantFamily.sharePct, 75);
});

test('53060 composeWhatWorkedDigest: top three lines', () => {
  const v = XA.composeWhatWorkedDigest({ huntId: 'h9' }, [{ name: 'A', findings: 3, minutes: 30 }, { name: 'B', findings: 1, minutes: 10 }, { name: 'C', findings: 2, minutes: 20 }, { name: 'D', findings: 0, minutes: 5 }]);
  assert.equal(v.lineCount, 3);
  assert.ok(v.subject.includes('h9'));
  assert.ok(v.lines[0].startsWith('1. A'));
});

/* ---- Wave77 B spot checks (53061–53080) ---- */
test('53061 buildStackHitRateMatrix: cells and best', () => {
  const v = XB.buildStackHitRateMatrix([{ family: 'sqli', stack: 'php', success: true }, { family: 'sqli', stack: 'php', success: false }, { family: 'xss', stack: 'node', success: true }]);
  assert.equal(v.cellCount, 2);
  assert.equal(v.bestCell.key, 'xss @ node');
});

test('53062 trackFrameworkVersionSensitivity: version-dead detected', () => {
  const v = XB.trackFrameworkVersionSensitivity([{ framework: 'Django', version: '4.2', success: true }, { framework: 'Django', version: '4.2', success: false }, { framework: 'Django', version: '3.2', success: false }, { framework: 'Django', version: '3.2', success: false }, { framework: 'Django', version: '3.2', success: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.deadCount, 1);
  assert.equal(v.best.key, 'Django 4.2');
});

test('53063 buildCmsPluginPayloadLedger: proven combinations', () => {
  const v = XB.buildCmsPluginPayloadLedger([{ plugin: 'WooCommerce', pluginVersion: '8.0', success: true }, { plugin: 'WooCommerce', pluginVersion: '7.0', success: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.provenCount, 1);
  assert.equal(v.best.key, 'WooCommerce 8.0');
});

test('53064 scoreWafConditionedPayloads: bypass split by WAF', () => {
  const v = XB.scoreWafConditionedPayloads([{ family: 'sqli', waf: 'cloudflare', success: true }, { family: 'sqli', waf: 'cloudflare', success: false }, { family: 'sqli', waf: 'none', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'sqli via none');
});

test('53065 splitLanguageRuntimeEffectiveness: best and worst runtimes', () => {
  const v = XB.splitLanguageRuntimeEffectiveness([{ runtime: 'php', success: true }, { runtime: 'php', success: false }, { runtime: 'node', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'node');
  assert.equal(v.worst.key, 'php');
});

test('53066 correlateDatabaseBackend: injection only', () => {
  const v = XB.correlateDatabaseBackend([{ family: 'sqli', database: 'postgres', success: true }, { family: 'xss', database: 'postgres', success: true }, { family: 'sqli', database: 'mysql', success: false }]);
  assert.equal(v.injectionAttempts, 2);
  assert.equal(v.best.key, 'postgres');
});

test('53067 compareCloudProviderVariance: spread across providers', () => {
  const v = XB.compareCloudProviderVariance([{ cloud: 'aws', success: true }, { cloud: 'aws', success: false }, { cloud: 'gcp', success: true }, { cloud: 'azure', success: false }]);
  assert.equal(v.spread, 1);
  assert.equal(v.best.key, 'gcp');
});

test('53068 analyzeCdnLayerImpact: direct beats CDN', () => {
  const v = XB.analyzeCdnLayerImpact([{ cdn: true, success: true }, { cdn: true, success: false }, { success: true }, { success: true }]);
  assert.equal(v.cdnRate, 0.5);
  assert.equal(v.directRate, 1);
  assert.equal(v.delta, 0.5);
});

test('53069 trackServerHeaderEvolution: header change detected', () => {
  const v = XB.trackServerHeaderEvolution([{ at: '2026-10-08T00:00:00Z', headers: { server: 'nginx' } }, { at: '2026-10-09T00:00:00Z', headers: { server: 'apache' } }]);
  assert.equal(v.changeCount, 1);
  assert.equal(v.changes[0].header, 'server');
  assert.equal(v.changes[0].from, 'nginx');
});

test('53070 scoreMiddlewareStackFingerprint: full stack groups', () => {
  const v = XB.scoreMiddlewareStackFingerprint([{ proxy: 'nginx', appServer: 'node', framework: 'express', success: true }, { proxy: 'nginx', appServer: 'node', framework: 'express', success: false }, { proxy: 'caddy', appServer: 'php', framework: 'laravel', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'caddy + php + laravel');
});

test('53071 splitHeadlessVsTraditionalCms: mode delta', () => {
  const v = XB.splitHeadlessVsTraditionalCms([{ cmsMode: 'headless', success: true }, { cmsMode: 'headless', success: false }, { success: true }]);
  assert.equal(v.headlessRate, 0.5);
  assert.equal(v.traditionalRate, 1);
  assert.equal(v.delta, -0.5);
});

test('53072 buildSpaFrameworkPayloadProfiles: client payloads only', () => {
  const v = XB.buildSpaFrameworkPayloadProfiles([{ family: 'xss', spa: 'react', success: true }, { family: 'dom', spa: 'vue', success: false }, { family: 'recon', success: true }]);
  assert.equal(v.clientAttempts, 2);
  assert.equal(v.best.key, 'react');
});

test('53073 conditionApiGatewayScores: strictest gateway last', () => {
  const v = XB.conditionApiGatewayScores([{ gateway: 'kong', success: true }, { gateway: 'kong', success: false }, { gateway: 'apigee', success: true }]);
  assert.equal(v.best.key, 'apigee');
  assert.equal(v.strictest.key, 'kong');
});

test('53074 recordContainerOrchestrationSignals: orchestration groups', () => {
  const v = XB.recordContainerOrchestrationSignals([{ orchestration: 'kubernetes', success: true }, { orchestration: 'serverless', success: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'kubernetes');
});

test('53075 curveLegacyStackDecay: age buckets rated', () => {
  const v = XB.curveLegacyStackDecay([{ stackAgeMonths: 3, success: true }, { stackAgeMonths: 8, success: false }, { stackAgeMonths: 30, success: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.rows[0].bucket, '0-5mo');
});

test('53076 indexStackComboRarity: rare combo weighted highest', () => {
  const v = XB.indexStackComboRarity([{ combo: 'a' }, { combo: 'a' }, { combo: 'b' }]);
  assert.equal(v.rarest.combo, 'b');
  assert.equal(v.rarest.rarityWeight, 0.67);
});

test('53077 trackPatchLevelGranularity: payload death attributed', () => {
  const v = XB.trackPatchLevelGranularity([{ component: 'openssl', patchLevel: '1.1.1', success: true }, { component: 'openssl', patchLevel: '1.1.1', success: true }, { component: 'openssl', patchLevel: '3.0', success: false }, { component: 'openssl', patchLevel: '3.0', success: false }]);
  assert.equal(v.killedCount, 1);
  assert.equal(v.best.key, 'openssl 1.1.1');
});

test('53078 normalizeMultiTenantSaaS: per-tenant deltas', () => {
  const v = XB.normalizeMultiTenantSaaS([{ tenant: 't1', success: true }, { tenant: 't1', success: false }, { tenant: 't2', success: true }, { tenant: 't2', success: true }]);
  assert.equal(v.globalRate, 0.75);
  assert.equal(v.rows.find(r => r.key === 't2').deltaVsGlobal, 0.25);
});

test('53079 trackEdgeComputePayloadBehavior: edge versus origin', () => {
  const v = XB.trackEdgeComputePayloadBehavior([{ edge: true, success: true }, { runtime: 'edge', success: false }, { success: true }]);
  assert.equal(v.edgeAttempts, 2);
  assert.equal(v.edgeRate, 0.5);
  assert.equal(v.originRate, 1);
  assert.equal(v.delta, -0.5);
});

test('53080 splitGraphqlEngineSpecificity: engine split', () => {
  const v = XB.splitGraphqlEngineSpecificity([{ graphqlEngine: 'apollo', family: 'graphql', success: true }, { graphqlEngine: 'hasura', success: false }, { family: 'rest', success: true }]);
  assert.equal(v.graphqlAttempts, 2);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'apollo');
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
test('css: only .w77a-/.w77b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w77a-') || cls.startsWith('w77b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave77A.jsx', 'Wave77B.jsx']) {
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
test('no-debris: no TODO/FIXME/mock placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `mock mention in ${name}`);
    assert.ok(!/\bsimulate\b/i.test(src), `simulate mention in ${name}`);
  }
});
