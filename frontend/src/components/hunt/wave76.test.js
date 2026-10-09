/**
 * wave76.test.js — Infinity AI · Dark-Matter · Wave 76
 * node:test + node:assert/strict. Registry coverage (20/20 for 53001–53020,
 * 20/20 for 53021–53040, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave76.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE76_A_IDEAS } from './wave76ACore.js';
import * as XA from './wave76ACore.js';
import { WAVE76_B_IDEAS } from './wave76BCores.js';
import * as XB from './wave76BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave76ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave76BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave76A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave76B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave76.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

const TEMPLATE = {
  id: 'tpl-shop-baseline', templateId: 'tpl-shop-baseline', name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  uses: 7,
};
const HUNT = { huntId: 'hunt-76', id: 'hunt-76', completedAt: '2026-10-09T00:00:00Z', anonymousFindings: 2, authenticatedFindings: 5, scope: { include: ['shop.example.com', 'api.example.com'] }, visitedHosts: ['shop.example.com'] };

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 76A ideas, 20/20 wave 76B ideas, zero skips', () => {
  assert.equal(WAVE76_A_IDEAS.length, 20);
  assert.equal(WAVE76_B_IDEAS.length, 20);
  const all = [...WAVE76_A_IDEAS, ...WAVE76_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 53001 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE76_A_IDEAS, ...WAVE76_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[53001].includes('template sharing via link'));
  assert.ok(byId[53002].includes('template scheduled review (post-hunt)'));
  assert.ok(byId[53003].includes('template retirement archive'));
  assert.ok(byId[53004].includes('template-to-playbook export'));
  assert.ok(byId[53005].includes('per-hunt contribution breakdown'));
  assert.ok(byId[53006].includes('winning payload roll of honor'));
  assert.ok(byId[53007].includes('first-click analysis'));
  assert.ok(byId[53008].includes('strategy attribution ledger'));
  assert.ok(byId[53009].includes('recon payoff audit'));
  assert.ok(byId[53010].includes('technique yield ranking'));
  assert.ok(byId[53011].includes('false-start counter'));
  assert.ok(byId[53012].includes('lucky hit separator'));
  assert.ok(byId[53013].includes('pivoting moment log'));
  assert.ok(byId[53014].includes('hunches-validated register'));
  assert.ok(byId[53015].includes('timeboxing effectiveness score'));
  assert.ok(byId[53016].includes('depth-vs-breadth tradeoff analysis'));
  assert.ok(byId[53017].includes('authentication lift measurement'));
  assert.ok(byId[53018].includes('human-touch delta'));
  assert.ok(byId[53019].includes('re-run reproducibility check'));
  assert.ok(byId[53020].includes('diminishing returns curve'));
  assert.ok(byId[53021].includes('coverage-to-finding correlation'));
  assert.ok(byId[53022].includes('most valuable single probe'));
  assert.ok(byId[53023].includes('quiet-phase audit'));
  assert.ok(byId[53024].includes('assumption buster log'));
  assert.ok(byId[53025].includes('signal density map'));
  assert.ok(byId[53026].includes('escalation path effectiveness'));
  assert.ok(byId[53027].includes('manual-override impact'));
  assert.ok(byId[53028].includes('exploitability conversion rate'));
  assert.ok(byId[53029].includes('triage accuracy review'));
  assert.ok(byId[53030].includes('tool selection scorecard'));
  assert.ok(byId[53031].includes('credential quality effect'));
  assert.ok(byId[53032].includes('scope utilization review'));
  assert.ok(byId[53033].includes('environment parity check'));
  assert.ok(byId[53034].includes('negative space report'));
  assert.ok(byId[53035].includes('best-decision timeline'));
  assert.ok(byId[53036].includes('worst-decision postmortem'));
  assert.ok(byId[53037].includes('parameter choice audit'));
  assert.ok(byId[53038].includes('session length sweet spot'));
  assert.ok(byId[53039].includes('parallelism gain analysis'));
  assert.ok(byId[53040].includes('retry policy effectiveness'));
});

/* ---- Wave76 A spot checks (53001–53020) ---- */
test('53001 createTemplateShareLink: deterministic link with code', () => {
  const v = XA.createTemplateShareLink(TEMPLATE, { expiresDays: 7, permission: 'view' });
  assert.equal(v.templateId, 'tpl-shop-baseline');
  assert.equal(v.expiresDays, 7);
  assert.equal(v.permissionScope, 'view');
  assert.ok(v.shareLink.includes('tpl-shop-baseline'));
  assert.equal(v.code.length, 8);
  const again = XA.createTemplateShareLink(TEMPLATE, { expiresDays: 7, permission: 'view' });
  assert.equal(again.code, v.code);
});

test('53002 scheduleTemplateReview: due date derived from cadence', () => {
  const v = XA.scheduleTemplateReview(TEMPLATE, HUNT, { cadenceDays: 30 });
  assert.equal(v.templateId, 'tpl-shop-baseline');
  assert.equal(v.cadenceDays, 30);
  assert.ok(v.dueAt.includes('2026-11-08'));
  assert.equal(v.overdue, false);
});

test('53003 archiveRetiredTemplate: frozen archive record created', () => {
  const v = XA.archiveRetiredTemplate(TEMPLATE, { uses: 7 }, { reason: 'manual retirement' });
  assert.equal(v.templateId, 'tpl-shop-baseline');
  assert.equal(v.frozen.uses, 7);
  assert.equal(v.frozen.archived, true);
  assert.ok(v.archiveId.startsWith('arc-'));
});

test('53004 exportTemplateToPlaybook: findings become steps', () => {
  const v = XA.exportTemplateToPlaybook(TEMPLATE, [{ id: 'f1', title: 'SQLi in checkout', target: 'shop.example.com/checkout' }], {});
  assert.equal(v.stepCount, 1);
  assert.equal(v.playbook.steps[0].findingId, 'f1');
  assert.equal(v.playbook.format, 'infinity-playbook-v1');
});

test('53005 breakdownHuntContributions: share computed per contributor', () => {
  const v = XA.breakdownHuntContributions(HUNT, [{ contributor: 'agent-a', findings: 3, probes: 10, verified: 2 }, { contributor: 'agent-b', findings: 1, probes: 5, verified: 1 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.totalFindings, 4);
  assert.equal(v.top.contributor, 'agent-a');
  assert.equal(v.top.sharePct, 75);
});

test('53006 buildWinningPayloadHonorRoll: winners sorted by score', () => {
  const v = XA.buildWinningPayloadHonorRoll(HUNT, [{ id: 'p1', name: 'SQLi probe', score: 15, success: true }, { id: 'p2', name: 'XSS probe', score: 5, success: false }, { id: 'p3', name: 'SSRF probe', score: 12, success: true }], {});
  assert.equal(v.winnerCount, 2);
  assert.equal(v.top.payloadId, 'p1');
  assert.equal(v.top.score, 15);
});

test('53007 analyzeFirstClick: first click and delay found', () => {
  const v = XA.analyzeFirstClick([{ at: '2026-10-09T00:00:00Z', type: 'start', label: 'start' }, { at: '2026-10-09T00:00:12Z', type: 'click', label: 'login', target: 'login' }], {});
  assert.equal(v.firstAction, 'login');
  assert.equal(v.delaySeconds, 12);
  assert.equal(v.eventCount, 2);
});

test('53008 buildStrategyAttributionLedger: net yield attributed', () => {
  const v = XA.buildStrategyAttributionLedger(HUNT, [{ id: 's1', name: 'Recon heavy', findings: 4, falsePositives: 1 }, { id: 's2', name: 'Quick scan', findings: 2, falsePositives: 0 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.totalNetYield, 5);
  assert.equal(v.best.strategyId, 's1');
});

test('53009 auditReconPayoff: payoff ratio and totals', () => {
  const v = XA.auditReconPayoff(HUNT, [{ id: 'r1', name: 'Subdomain sweep', costMinutes: 20, findings: 3 }, { id: 'r2', name: 'Port scan', costMinutes: 10, findings: 0 }], {});
  assert.equal(v.stepCount, 2);
  assert.equal(v.totalCostMinutes, 30);
  assert.equal(v.totalFindings, 3);
  assert.equal(v.payoffRatio, 0.5);
});

test('53010 rankTechniqueYield: best technique ranked first', () => {
  const v = XA.rankTechniqueYield([{ id: 't1', name: 'SQLi', attempts: 4 }, { id: 't2', name: 'XSS', attempts: 10 }], [{ id: 'f1', techniqueId: 't1' }, { id: 'f2', techniqueId: 't1' }, { id: 'f3', techniqueId: 't2' }], {});
  assert.equal(v.count, 2);
  assert.equal(v.best.techniqueId, 't1');
  assert.equal(v.best.yieldRate, 0.5);
});

test('53011 countFalseStarts: abandoned probes counted', () => {
  const v = XA.countFalseStarts([{ id: 'pr1', findings: 0, status: 'stopped' }, { id: 'pr2', findings: 2, status: 'done' }], {});
  assert.equal(v.totalProbes, 2);
  assert.equal(v.falseStartCount, 1);
  assert.equal(v.falseStartRatio, 0.5);
});

test('53012 separateLuckyHits: lucky separated from systematic', () => {
  const v = XA.separateLuckyHits([{ id: 'f1', techniqueId: 't1' }, { id: 'f2', techniqueId: 't1' }, { id: 'f3', techniqueId: 't2' }], { minHitsForPattern: 2 });
  assert.equal(v.luckyCount, 1);
  assert.equal(v.systematicCount, 2);
});

test('53013 logPivotingMoments: pivots filtered and ordered', () => {
  const v = XA.logPivotingMoments([{ at: '2026-10-09T00:10:00Z', label: 'pivot to api', pivot: true }, { at: '2026-10-09T00:05:00Z', label: 'normal scan' }], {});
  assert.equal(v.pivotCount, 1);
  assert.equal(v.pivots[0].label, 'pivot to api');
});

test('53014 registerValidatedHunches: accuracy computed', () => {
  const v = XA.registerValidatedHunches([{ id: 'h1', guess: 'admin panel exposed', validated: true }, { id: 'h2', guess: 'debug endpoint', validated: false }], [], {});
  assert.equal(v.count, 2);
  assert.equal(v.validatedCount, 1);
  assert.equal(v.accuracy, 0.5);
});

test('53015 scoreTimeboxingEffectiveness: perfect adherence scores one', () => {
  const v = XA.scoreTimeboxingEffectiveness([{ id: 'ph1', name: 'Recon', plannedMinutes: 30, actualMinutes: 30, findings: 2 }], {});
  assert.equal(v.count, 1);
  assert.equal(v.score, 1);
  assert.equal(v.averageAdherence, 1);
});

test('53016 analyzeDepthVsBreadth: winner selected by findings', () => {
  const v = XA.analyzeDepthVsBreadth([{ id: 'a', mode: 'deep', findings: 3 }, { id: 'b', mode: 'broad', findings: 1 }, { id: 'c', mode: 'deep', findings: 2 }], {});
  assert.equal(v.deep.findings, 5);
  assert.equal(v.broad.findings, 1);
  assert.equal(v.winner, 'deep');
});

test('53017 measureAuthLift: lift percentage computed', () => {
  const v = XA.measureAuthLift(HUNT, {});
  assert.equal(v.anonymousFindings, 2);
  assert.equal(v.authenticatedFindings, 5);
  assert.equal(v.lift, 1.5);
  assert.equal(v.liftPct, 150);
});

test('53018 measureHumanTouchDelta: human advantage measured', () => {
  const v = XA.measureHumanTouchDelta([{ huntId: 'h1', humanAssisted: true, findings: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { huntId: 'h2', humanAssisted: false, findings: [{ id: 'd' }] }], {});
  assert.equal(v.humanAvg, 3);
  assert.equal(v.autoAvg, 1);
  assert.equal(v.delta, 2);
});

test('53019 checkRerunReproducibility: stable runs detected', () => {
  const v = XA.checkRerunReproducibility([{ findings: [{ id: 'f1' }, { id: 'f2' }] }, { findings: [{ id: 'f1' }, { id: 'f2' }] }], {});
  assert.equal(v.stable, true);
  assert.equal(v.overlapRatio, 1);
  const drift = XA.checkRerunReproducibility([{ findings: [{ id: 'f1' }] }, { findings: [{ id: 'f2' }] }], {});
  assert.equal(drift.stable, false);
});

test('53020 computeDiminishingReturnsCurve: cumulative and knee', () => {
  const v = XA.computeDiminishingReturnsCurve([{ name: 'p1', order: 1, minutes: 10, findings: 5 }, { name: 'p2', order: 2, minutes: 10, findings: 1 }], {});
  assert.equal(v.totalFindings, 6);
  assert.equal(v.curve.length, 2);
  assert.equal(v.kneeIndex, 1);
});

/* ---- Wave76 B spot checks (53021–53040) ---- */
test('53021 correlateCoverageToFindings: perfect correlation detected', () => {
  const v = XB.correlateCoverageToFindings([{ id: 'a1', coveragePct: 100, findings: 10 }, { id: 'a2', coveragePct: 50, findings: 5 }, { id: 'a3', coveragePct: 0, findings: 0 }], {});
  assert.equal(v.count, 3);
  assert.equal(v.correlation, 1);
});

test('53022 findMostValuableSingleProbe: highest score wins', () => {
  const v = XB.findMostValuableSingleProbe([{ id: 'pr1', name: 'Param probe' }, { id: 'pr2', name: 'Header probe' }], [{ id: 'f1', probeId: 'pr1', score: 8 }, { id: 'f2', probeId: 'pr1', score: 7 }, { id: 'f3', probeId: 'pr2', score: 5 }], {});
  assert.equal(v.best.probeId, 'pr1');
  assert.equal(v.best.score, 15);
  assert.equal(v.best.hits, 2);
});

test('53023 auditQuietPhase: quiet phases listed', () => {
  const v = XB.auditQuietPhase([{ id: 'ph1', name: 'Idle wait', findings: 0, minutes: 25 }, { id: 'ph2', name: 'Recon', findings: 2, minutes: 20 }], { minMinutes: 15 });
  assert.equal(v.count, 1);
  assert.equal(v.totalQuietMinutes, 25);
});

test('53024 logAssumptionBusters: busted assumptions logged', () => {
  const v = XB.logAssumptionBusters([{ type: 'assumption-buster', at: '2026-10-09T00:00:00Z' }], [{ id: 'as1', text: 'API is rate limited', holds: false }, { id: 'as2', text: 'Auth required', holds: true }], {});
  assert.equal(v.count, 1);
  assert.equal(v.busted[0].assumptionId, 'as1');
});

test('53025 buildSignalDensityMap: hottest segment identified', () => {
  const v = XB.buildSignalDensityMap([{ id: 'seg1', label: 'auth', signals: 8, probes: 4 }, { id: 'seg2', label: 'search', signals: 2, probes: 4 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.hottest.segmentId, 'seg1');
  assert.equal(v.hottest.density, 2);
});

test('53026 evaluateEscalationPathEffectiveness: success rate', () => {
  const v = XB.evaluateEscalationPathEffectiveness([{ id: 'esc1', from: 'low', to: 'high', findings: 2, minutes: 10, success: true }, { id: 'esc2', from: 'high', to: 'critical', findings: 0, minutes: 5, success: false }], {});
  assert.equal(v.count, 2);
  assert.equal(v.successRate, 0.5);
});

test('53027 measureManualOverrideImpact: totals computed', () => {
  const v = XB.measureManualOverrideImpact([{ id: 'ov1', action: 'force queue', findings: 2, savedMinutes: 15 }, { id: 'ov2', action: 'skip wait', findings: 1, savedMinutes: 5 }], [{ id: 'f1', afterOverride: true }], {});
  assert.equal(v.count, 2);
  assert.equal(v.totalFindings, 3);
  assert.equal(v.totalSavedMinutes, 20);
});

test('53028 computeExploitabilityConversionRate: conversion computed', () => {
  const v = XB.computeExploitabilityConversionRate([{ id: 'f1', exploitable: true }, { id: 'f2', exploitable: false }, { id: 'f3', status: 'exploitable' }], {});
  assert.equal(v.total, 3);
  assert.equal(v.exploitable, 2);
  assert.equal(v.rate, 0.67);
});

test('53029 reviewTriageAccuracy: accuracy and error counts', () => {
  const v = XB.reviewTriageAccuracy([{ predicted: 'real', actual: 'real' }, { predicted: 'real', actual: 'false-positive' }], {});
  assert.equal(v.total, 2);
  assert.equal(v.accuracy, 0.5);
  assert.equal(v.falsePositiveCalls, 1);
});

test('53030 scoreToolSelection: best tool by yield', () => {
  const v = XB.scoreToolSelection([{ id: 'tool1', name: 'Scanner', used: true, findings: 4, minutes: 20 }, { id: 'tool2', name: 'Fuzzer', used: true, findings: 1, minutes: 10 }], HUNT, {});
  assert.equal(v.count, 2);
  assert.equal(v.best.toolId, 'tool1');
  assert.equal(v.best.yieldPerMinute, 0.2);
});

test('53031 evaluateCredentialQualityEffect: high beats low', () => {
  const v = XB.evaluateCredentialQualityEffect([{ id: 'c1', quality: 'high', findings: 3, success: true }, { id: 'c2', quality: 'low', findings: 1, success: false }, { id: 'c3', quality: 'high', findings: 5, success: true }], {});
  assert.equal(v.highAvg, 4);
  assert.equal(v.lowAvg, 1);
  assert.equal(v.delta, 3);
});

test('53032 reviewScopeUtilization: utilization rate', () => {
  const v = XB.reviewScopeUtilization({ include: ['shop.example.com', 'api.example.com'] }, HUNT, {});
  assert.equal(v.includeCount, 2);
  assert.equal(v.utilizationRate, 0.5);
  assert.deepEqual(v.unused, ['api.example.com']);
});

test('53033 checkEnvironmentParity: differences listed', () => {
  const v = XB.checkEnvironmentParity({ runtime: 'node20', region: 'us' }, { runtime: 'node20', region: 'eu' }, {});
  assert.equal(v.parity, false);
  assert.equal(v.diffCount, 1);
  assert.equal(v.diffs[0].key, 'region');
  const same = XB.checkEnvironmentParity({ runtime: 'node20', region: 'us' }, { runtime: 'node20', region: 'us' }, {});
  assert.equal(same.parity, true);
});

test('53034 buildNegativeSpaceReport: untouched areas reported', () => {
  const v = XB.buildNegativeSpaceReport([{ id: 'a1', name: 'Checkout', coveragePct: 80 }, { id: 'a2', name: 'Admin', coveragePct: 0 }], {});
  assert.equal(v.untouchedCount, 1);
  assert.equal(v.touchedCount, 1);
});

test('53035 buildBestDecisionTimeline: positive decisions kept', () => {
  const v = XB.buildBestDecisionTimeline([{ id: 'd1', at: '2026-10-09T00:00:00Z', text: 'focus checkout', impact: 9 }, { id: 'd2', at: '2026-10-09T00:01:00Z', text: 'skip auth', impact: -2 }, { id: 'd3', at: '2026-10-09T00:02:00Z', text: 'deep dive', impact: 5 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.top.decisionId, 'd1');
});

test('53036 buildWorstDecisionPostmortem: worst decision selected', () => {
  const v = XB.buildWorstDecisionPostmortem([{ id: 'd1', at: '2026-10-09T00:00:00Z', text: 'skip auth', impact: -5, lesson: 'Check auth early' }, { id: 'd2', at: '2026-10-09T00:01:00Z', text: 'focus checkout', impact: 9 }], {});
  assert.equal(v.worst.decisionId, 'd1');
  assert.equal(v.worst.impact, -5);
});

test('53037 auditParameterChoices: risky probes flagged', () => {
  const v = XB.auditParameterChoices([{ id: 'pr1', params: ['a', 'b'], findings: 2 }, { id: 'pr2', params: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], findings: 0 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.riskyCount, 1);
});

test('53038 findSessionLengthSweetSpot: sweet spot bucket found', () => {
  const v = XB.findSessionLengthSweetSpot([{ minutes: 45, findings: 3 }, { minutes: 50, findings: 4 }, { minutes: 20, findings: 1 }], {});
  assert.equal(v.count, 2);
  assert.equal(v.sweetSpot.bucket, '30-59');
  assert.equal(v.sweetSpot.yieldPerSession, 3.5);
});

test('53039 analyzeParallelismGain: gain percentage computed', () => {
  const v = XB.analyzeParallelismGain([{ minutes: 30, parallel: false }, { minutes: 40, parallel: true }], {});
  assert.equal(v.serialMinutes, 30);
  assert.equal(v.parallelMinutes, 40);
  assert.equal(v.wallClockMinutes, 40);
  assert.equal(v.gainPct, 43);
});

test('53040 evaluateRetryPolicyEffectiveness: recovery rate computed', () => {
  const v = XB.evaluateRetryPolicyEffectiveness([{ retries: 2, success: true, extraMinutes: 5 }, { retries: 1, success: false, extraMinutes: 3 }], {});
  assert.equal(v.retriedCount, 2);
  assert.equal(v.recoveredCount, 1);
  assert.equal(v.recoveryRate, 0.5);
  assert.equal(v.extraMinutes, 8);
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
test('css: only .w76a-/.w76b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w76a-') || cls.startsWith('w76b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave76A.jsx', 'Wave76B.jsx']) {
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
