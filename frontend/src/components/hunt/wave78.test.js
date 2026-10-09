/**
 * wave78.test.js — Infinity AI · Dark-Matter · Wave 78
 * node:test + node:assert/strict. Registry coverage (20/20 for 53081–53100,
 * 20/20 for 53101–53120, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave78.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE78_A_IDEAS } from './wave78ACore.js';
import * as XA from './wave78ACore.js';
import { WAVE78_B_IDEAS } from './wave78BCores.js';
import * as XB from './wave78BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave78ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave78BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave78A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave78B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave78.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 78A ideas, 20/20 wave 78B ideas, zero skips', () => {
  assert.equal(WAVE78_A_IDEAS.length, 20);
  assert.equal(WAVE78_B_IDEAS.length, 20);
  const all = [...WAVE78_A_IDEAS, ...WAVE78_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53081 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE78_A_IDEAS, ...WAVE78_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[53081].includes('orm-layer attribution'));
  assert.ok(byId[53082].includes('template engine mapping'));
  assert.ok(byId[53083].includes('serialization library tracking'));
  assert.ok(byId[53084].includes('authentication stack conditioning'));
  assert.ok(byId[53085].includes('payment stack payload profiles'));
  assert.ok(byId[53086].includes('search engine backend split'));
  assert.ok(byId[53087].includes('message queue influence'));
  assert.ok(byId[53088].includes('cache layer masking detection'));
  assert.ok(byId[53089].includes('ci/cd-exposed surface tracking'));
  assert.ok(byId[53090].includes('mobile backend (baas) profiles'));
  assert.ok(byId[53091].includes('iot firmware stack ledger'));
  assert.ok(byId[53092].includes('e-commerce platform matrix'));
  assert.ok(byId[53093].includes('headless browser rendering effects'));
  assert.ok(byId[53094].includes('http/3 and quic variance'));
  assert.ok(byId[53095].includes('websocket server implementation split'));
  assert.ok(byId[53096].includes('grpc framework conditioning'));
  assert.ok(byId[53097].includes('serverless cold-start timing profiles'));
  assert.ok(byId[53098].includes('stack confidence weighting'));
  assert.ok(byId[53099].includes('deprecated stack sunset alerts'));
  assert.ok(byId[53100].includes('stack migration impact notes'));
  assert.ok(byId[53101].includes('regional hosting variance'));
  assert.ok(byId[53102].includes('reverse proxy behavior ledger'));
  assert.ok(byId[53103].includes('stack-specific evasion ratings'));
  assert.ok(byId[53104].includes('origin-vs-edge response diffs'));
  assert.ok(byId[53105].includes('framework default config baselines'));
  assert.ok(byId[53106].includes('stack-aware payload shortlists'));
  assert.ok(byId[53107].includes('payload-stack mismatch warnings'));
  assert.ok(byId[53108].includes('stack rarity research prompts'));
  assert.ok(byId[53109].includes('quarterly stack effectiveness report'));
  assert.ok(byId[53110].includes('stack fingerprint correction loop'));
  assert.ok(byId[53111].includes('cross-stack transfer scores'));
  assert.ok(byId[53112].includes('stack-specific confirmation playbooks'));
  assert.ok(byId[53113].includes('payload family retirement votes'));
  assert.ok(byId[53114].includes('new stack onboarding checklist'));
  assert.ok(byId[53115].includes('stack drift detection'));
  assert.ok(byId[53116].includes('effectiveness confidence intervals'));
  assert.ok(byId[53117].includes('strategy leaderboard by findings'));
  assert.ok(byId[53118].includes('opening move win rates'));
  assert.ok(byId[53119].includes('strategy-vs-severity matrix'));
  assert.ok(byId[53120].includes('comeback strategy tracking'));
});

/* ---- Wave78 A spot checks (53081–53100) ---- */
test('53081 attributeOrmLayer: best ORM ranked', () => {
  const v = XA.attributeOrmLayer([{ orm: 'sequelize', success: true }, { orm: 'sequelize', success: false }, { orm: 'hibernate', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'hibernate');
});

test('53082 mapTemplateEngine: engine versions grouped', () => {
  const v = XA.mapTemplateEngine([{ family: 'template', templateEngine: 'jinja2', templateVersion: '2.11', success: true }, { family: 'ssti', templateEngine: 'jinja2', templateVersion: '2.11', success: false }, { family: 'template', templateEngine: 'twig', templateVersion: '3', success: true }, { family: 'sqli', success: true }]);
  assert.equal(v.templateAttempts, 3);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'twig 3');
});

test('53083 trackSerializationLibrary: deserialization probes only', () => {
  const v = XA.trackSerializationLibrary([{ family: 'deserialization', serializationLibrary: 'pickle', success: true }, { family: 'serial', serializationLibrary: 'jackson', success: false }, { family: 'xss', success: true }]);
  assert.equal(v.serializationAttempts, 2);
  assert.equal(v.best.key, 'pickle');
});

test('53084 conditionAuthStackScores: identity stack split', () => {
  const v = XA.conditionAuthStackScores([{ family: 'auth', authStack: 'auth0', success: true }, { family: 'auth', authStack: 'auth0', success: false }, { family: 'login', authStack: 'keycloak', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'keycloak');
});

test('53085 buildPaymentStackPayloadProfiles: payment providers profiled', () => {
  const v = XA.buildPaymentStackPayloadProfiles([{ family: 'payment', paymentProvider: 'stripe', success: true }, { family: 'checkout', paymentProvider: 'stripe', success: false }, { family: 'payment', paymentProvider: 'adyen', success: true }]);
  assert.equal(v.paymentAttempts, 3);
  assert.equal(v.best.key, 'adyen');
});

test('53086 splitSearchEngineBackend: search backends ranked', () => {
  const v = XA.splitSearchEngineBackend([{ family: 'search', searchBackend: 'elasticsearch', success: true }, { family: 'search', searchBackend: 'solr', success: false }, { family: 'search', searchBackend: 'algolia', success: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.worst.key, 'solr');
});

test('53087 recordMessageQueueInfluence: async rates by queue', () => {
  const v = XA.recordMessageQueueInfluence([{ queue: 'kafka', attempts: 10, asyncFindings: 4, findings: 6 }, { queue: 'rabbitmq', attempts: 10, asyncFindings: 2, findings: 5 }]);
  assert.equal(v.best.key, 'kafka');
  assert.equal(v.best.asyncRate, 0.4);
});

test('53088 detectCacheLayerMasking: masked effects found', () => {
  const v = XA.detectCacheLayerMasking([{ cache: 'redis', success: false, bypassSuccess: true }, { cache: 'redis', success: true }, { success: false, bypassSuccess: true }]);
  assert.equal(v.cachedAttempts, 2);
  assert.equal(v.maskedCount, 1);
  assert.equal(v.bypassRate, 0.5);
});

test('53089 trackCicdExposedSurface: CI/CD split from main', () => {
  const v = XA.trackCicdExposedSurface([{ surface: 'cicd', success: true }, { surface: 'main', success: true }, { surface: 'main', success: false }]);
  assert.equal(v.cicdRate, 1);
  assert.equal(v.mainRate, 0.5);
  assert.equal(v.delta, 0.5);
});

test('53090 buildMobileBackendProfiles: BaaS providers ranked', () => {
  const v = XA.buildMobileBackendProfiles([{ baas: 'firebase', success: true }, { baas: 'supabase', success: false }, { baas: 'supabase', success: true }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'firebase');
});

test('53091 buildIotFirmwareStackLedger: firmware bases ledgered', () => {
  const v = XA.buildIotFirmwareStackLedger([{ firmwareBase: 'openwrt', success: true }, { firmwareBase: 'yocto', success: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'openwrt');
});

test('53092 buildEcommercePlatformMatrix: platform cells built', () => {
  const v = XA.buildEcommercePlatformMatrix([{ family: 'sqli', ecommercePlatform: 'shopify', success: true }, { family: 'sqli', ecommercePlatform: 'magento', success: false }, { family: 'xss', ecommercePlatform: 'shopify', success: true }]);
  assert.equal(v.platformCount, 2);
  assert.equal(v.cellCount, 3);
});

test('53093 measureHeadlessBrowserRenderingEffects: rendered delta', () => {
  const v = XA.measureHeadlessBrowserRenderingEffects([{ rendered: true, success: true }, { rendered: true, success: false }, { success: true }, { success: true }]);
  assert.equal(v.renderedRate, 0.5);
  assert.equal(v.staticRate, 1);
  assert.equal(v.delta, -0.5);
});

test('53094 trackHttp3QuicVariance: protocol timing compared', () => {
  const v = XA.trackHttp3QuicVariance([{ protocol: 'HTTP/3', timingMs: 320, success: true }, { protocol: 'HTTP/2', timingMs: 200, success: true }, { protocol: 'HTTP/2', timingMs: 200, success: false }]);
  assert.equal(v.http3.avgTimingMs, 320);
  assert.equal(v.timingDeltaMs, 120);
});

test('53095 splitWebSocketServerImplementation: server split', () => {
  const v = XA.splitWebSocketServerImplementation([{ family: 'websocket', wsServer: 'socket.io', success: true }, { family: 'websocket', wsServer: 'ws', success: false }]);
  assert.equal(v.websocketAttempts, 2);
  assert.equal(v.best.key, 'socket.io');
});

test('53096 conditionGrpcFramework: reflection-aware groups', () => {
  const v = XA.conditionGrpcFramework([{ family: 'grpc', grpcFramework: 'grpc-go', reflection: true, success: true }, { family: 'grpc', grpcFramework: 'grpc-java', reflection: false, success: false }]);
  assert.equal(v.count, 2);
  assert.equal(v.best.key, 'grpc-go reflection:on');
});

test('53097 buildServerlessColdStartTimingProfiles: fastest platform first', () => {
  const v = XA.buildServerlessColdStartTimingProfiles([{ platform: 'lambda', coldStartMs: 400 }, { platform: 'lambda', coldStartMs: 600 }, { platform: 'cloud-run', coldStartMs: 200 }]);
  assert.equal(v.fastest.key, 'cloud-run');
  assert.equal(v.rows.find(r => r.key === 'lambda').avgColdStartMs, 500);
  assert.equal(v.rows.find(r => r.key === 'lambda').p95ColdStartMs, 600);
});

test('53098 weightStackConfidence: weighted lessons ranked', () => {
  const v = XA.weightStackConfidence([{ stack: 'a-stack', stackConfidence: 0.5, success: true }, { stack: 'a-stack', stackConfidence: 0.5, success: false }, { stack: 'b-stack', stackConfidence: 1, success: true }]);
  assert.equal(v.best.key, 'b-stack');
  assert.equal(v.totalWeight, 2);
  assert.equal(v.rows.find(r => r.key === 'a-stack').weightedRate, 0.5);
});

test('53099 alertDeprecatedStackSunset: end-of-life alert raised', () => {
  const v = XA.alertDeprecatedStackSunset([{ stack: 'legacy', endOfLife: true, dataAgeDays: 120, dataPoints: 10 }, { stack: 'modern', dataAgeDays: 10, dataPoints: 50 }]);
  assert.equal(v.alertCount, 1);
  assert.equal(v.alerts[0].stack, 'legacy');
});

test('53100 noteStackMigrationImpact: before and after delta', () => {
  const v = XA.noteStackMigrationImpact([{ target: 'shop', fromStack: 'php', toStack: 'node', before: [{ success: true }, { success: false }], after: [{ success: true }, { success: true }] }]);
  assert.equal(v.rows[0].beforeRate, 0.5);
  assert.equal(v.rows[0].afterRate, 1);
  assert.equal(v.rows[0].delta, 0.5);
  assert.equal(v.improvedCount, 1);
});

/* ---- Wave78 B spot checks (53101–53120) ---- */
test('53101 compareRegionalHostingVariance: regional spread measured', () => {
  const v = XB.compareRegionalHostingVariance([{ stack: 'php', region: 'eu', success: true }, { stack: 'php', region: 'us', success: false }, { stack: 'node', region: 'us', success: true }]);
  assert.equal(v.count, 3);
  assert.equal(v.spread, 1);
});

test('53102 buildReverseProxyBehaviorLedger: strictest proxy first', () => {
  const v = XB.buildReverseProxyBehaviorLedger([{ proxy: 'nginx', blocked: true, success: false }, { proxy: 'nginx', success: true }, { proxy: 'haproxy', transformed: true, success: true }]);
  assert.equal(v.strictest.key, 'nginx');
  assert.equal(v.strictest.blockRate, 0.5);
});

test('53103 rateStackSpecificEvasion: WAF-plus-stack groups', () => {
  const v = XB.rateStackSpecificEvasion([{ evasion: 'case-swap', waf: 'cloudflare', stack: 'php', success: true }, { evasion: 'case-swap', waf: 'cloudflare', stack: 'php', success: false }, { evasion: 'comment', waf: 'none', stack: 'node', success: true }]);
  assert.equal(v.evasionAttempts, 3);
  assert.equal(v.best.key, 'comment via none + node');
});

test('53104 diffOriginVsEdgeResponses: differing payload counted', () => {
  const v = XB.diffOriginVsEdgeResponses([{ payloadId: 'p1', originStatus: 200, edgeStatus: 403, originSuccess: true, edgeSuccess: false }, { payloadId: 'p2', originStatus: 200, edgeStatus: 200, originSuccess: true, edgeSuccess: true }]);
  assert.equal(v.diffCount, 1);
  assert.equal(v.diffRate, 0.5);
});

test('53105 baselineFrameworkDefaultConfig: hardened deviations counted', () => {
  const v = XB.baselineFrameworkDefaultConfig([{ framework: 'express', version: '4', defaults: { xPoweredBy: true, trustProxy: false }, hardened: { xPoweredBy: false } }, { framework: 'django', version: '4.2', defaults: { debug: false }, hardened: {} }]);
  assert.equal(v.hardenedCount, 1);
  assert.equal(v.mostHardened.framework, 'express');
});

test('53106 generateStackAwarePayloadShortlist: top payload ranked first', () => {
  const v = XB.generateStackAwarePayloadShortlist([{ stack: 'php', payload: 'union', success: true }, { stack: 'php', payload: 'union', success: false }, { stack: 'php', payload: 'probe', success: true }, { stack: 'node', payload: 'other', success: true }], { stack: 'php', limit: 20 });
  assert.equal(v.count, 2);
  assert.equal(v.top.payload, 'probe');
  assert.equal(v.rows[0].rank, 1);
});

test('53107 warnPayloadStackMismatch: unknown payload warned', () => {
  const v = XB.warnPayloadStackMismatch([{ payload: 'union', stack: 'php' }, { payload: 'legacy', stack: 'node' }], [{ payload: 'union', stack: 'php', success: true }, { payload: 'union', stack: 'php', success: false }]);
  assert.equal(v.warningCount, 1);
  assert.equal(v.warnings[0].payload, 'legacy');
});

test('53108 promptStackRarityResearch: thin stacks prompted', () => {
  const v = XB.promptStackRarityResearch([{ stack: 'rare', dataPoints: 4 }, { stack: 'common', dataPoints: 50 }]);
  assert.equal(v.promptCount, 1);
  assert.equal(v.rarest.stack, 'rare');
});

test('53109 buildQuarterlyStackEffectivenessReport: quarterly gain tracked', () => {
  const v = XB.buildQuarterlyStackEffectivenessReport([{ quarter: '2026-Q1', stack: 'php', family: 'sqli', success: true }, { quarter: '2026-Q1', stack: 'php', family: 'sqli', success: false }, { quarter: '2026-Q2', stack: 'php', family: 'sqli', success: true }, { quarter: '2026-Q2', stack: 'php', family: 'sqli', success: true }]);
  assert.equal(v.quarters.length, 2);
  assert.equal(v.biggestGain.delta, 0.5);
});

test('53110 runStackFingerprintCorrectionLoop: lessons re-attributed', () => {
  const v = XB.runStackFingerprintCorrectionLoop([{ huntId: 'h1', fromStack: 'php', toStack: 'node', lessons: 12 }, { huntId: 'h2', fromStack: 'java', toStack: 'go', lessons: 3 }]);
  assert.equal(v.appliedCount, 2);
  assert.equal(v.reattributedLessons, 15);
});

test('53111 scoreCrossStackTransfer: transfer routes scored', () => {
  const v = XB.scoreCrossStackTransfer([{ payload: 'sqli', sourceStack: 'php', targetStack: 'node', success: true }, { payload: 'sqli', sourceStack: 'php', targetStack: 'node', success: false }, { payload: 'xss', sourceStack: 'node', targetStack: 'django', success: true }]);
  assert.equal(v.transferAttempts, 3);
  assert.equal(v.best.key, 'xss node -> django');
});

test('53112 buildStackSpecificConfirmationPlaybooks: cheapest playbook first', () => {
  const v = XB.buildStackSpecificConfirmationPlaybooks([{ findingType: 'sqli', stack: 'php', requests: 4, sequence: 'replay' }, { findingType: 'sqli', stack: 'php', requests: 6, sequence: 'replay' }, { findingType: 'xss', stack: 'node', requests: 2, sequence: 'proof' }]);
  assert.equal(v.cheapest.key, 'xss @ node');
  assert.equal(v.rows.find(r => r.key === 'sqli @ php').avgRequests, 5);
});

test('53113 votePayloadFamilyRetirement: weak family flagged', () => {
  const v = XB.votePayloadFamilyRetirement([{ family: 'legacy', attempts: 100, successes: 2 }, { family: 'modern', attempts: 100, successes: 40 }]);
  assert.equal(v.retireCount, 1);
  assert.equal(v.retire[0].family, 'legacy');
});

test('53114 buildNewStackOnboardingChecklist: baseline steps generated', () => {
  const v = XB.buildNewStackOnboardingChecklist({ stack: 'fresh-stack' });
  assert.equal(v.stepCount, 5);
  assert.equal(v.checklist[0].family, 'injection');
  assert.ok(v.checklist[0].action.includes('fresh-stack'));
});

test('53115 detectStackDrift: response shift alerted', () => {
  const v = XB.detectStackDrift([{ stack: 'php', at: '2026-07-01T00:00:00Z', hitRate: 0.5 }, { stack: 'php', at: '2026-10-01T00:00:00Z', hitRate: 0.1 }]);
  assert.equal(v.driftCount, 1);
  assert.equal(v.drifts[0].delta, -0.4);
});

test('53116 attachEffectivenessConfidenceIntervals: thin versus backed', () => {
  const v = XB.attachEffectivenessConfidenceIntervals([{ key: 'sqli @ php', attempts: 40, successes: 20 }, { key: 'xss @ node', attempts: 4, successes: 1 }]);
  assert.equal(v.dataBackedCount, 1);
  assert.equal(v.thinCount, 1);
  assert.equal(v.rows[0].hitRate, 0.5);
  assert.equal(v.rows[0].low, 0.35);
  assert.equal(v.rows[0].high, 0.65);
});

test('53117 buildStrategyLeaderboardByFindings: findings per hour ranked', () => {
  const v = XB.buildStrategyLeaderboardByFindings([{ strategy: 'auth-first', validatedFindings: 8, hours: 2 }, { strategy: 'breadth-first', validatedFindings: 4, hours: 2 }]);
  assert.equal(v.leader.key, 'auth-first');
  assert.equal(v.leader.findingsPerHour, 4);
});

test('53118 trackOpeningMoveWinRates: first-hour wins measured', () => {
  const v = XB.trackOpeningMoveWinRates([{ openingStrategy: 'auth-first', firstFindingMinutes: 30 }, { openingStrategy: 'breadth-first', firstFindingMinutes: 90 }, { openingStrategy: 'deep-dive', firstFindingMinutes: 45 }], { windowMinutes: 60 });
  assert.equal(v.best.key, 'auth-first');
  assert.equal(v.best.winRate, 1);
  assert.equal(v.best.avgFirstFindingMinutes, 30);
});

test('53119 buildStrategyVsSeverityMatrix: critical yield ranked', () => {
  const v = XB.buildStrategyVsSeverityMatrix([{ strategy: 'auth-first', severity: 'critical' }, { strategy: 'auth-first', severity: 'high' }, { strategy: 'breadth-first', severity: 'info' }, { strategy: 'breadth-first', severity: 'low' }]);
  assert.equal(v.bestCritical.key, 'auth-first');
  assert.equal(v.bestCritical.criticalRate, 0.5);
});

test('53120 trackComebackStrategy: slow-start recovery ranked', () => {
  const v = XB.trackComebackStrategy([{ strategy: 'auth-first', firstHourFindings: 0, recoveredFindings: 5 }, { strategy: 'breadth-first', firstHourFindings: 0, recoveredFindings: 1 }, { strategy: 'deep-dive', firstHourFindings: 2, recoveredFindings: 0 }]);
  assert.equal(v.slowStartCount, 2);
  assert.equal(v.best.key, 'auth-first');
  assert.equal(v.best.recoveryRate, 1);
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
test('css: only .w78a-/.w78b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w78a-') || cls.startsWith('w78b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave78A.jsx', 'Wave78B.jsx']) {
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
