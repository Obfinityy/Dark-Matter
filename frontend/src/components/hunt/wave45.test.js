/**
 * wave45.test.js — wave 45 (ideas 51761–51800): ETA round 5 + resource suite.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave45.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ETA45_IDEAS, ETA45_START, ETA45_END,
  etaRecalcLog, timeToFirstFinding, idleTimeAccounting, activeTimeCounter,
  etaExportPayload, multiHuntEtas, etaPrioritization, wrapUpEta, approvalEta,
  testRequestEta, overnightEta, etaTimezone, etaTabTitle, etaMilestones,
  etaDriftAlerts, etaScenarioPlanner, etaLearning, subAgentEtas, etaApi,
  etaDashboard, etaFairness, etaAutoscale, etaFreeze, etaRetrospective,
  countdownVoiceScript, formatDuration,
} from './etaRound5Core.js';

import {
  RES45_IDEAS, RES45_START, RES45_END,
  requestCounter, requestRateSeries, bandwidthMeter, cpuPanel, memoryPanel,
  gpuDisplay, tokenTracker, costEstimator, budgetAlerts, moduleResourceSplit,
  resourceHistory, resourceCaps, throttleControls, efficiencyScore,
  wasteDetector, formatBytes,
} from './resourceCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const MIN = 60000;
const NOW = 1728288000000;

/* --- registry completeness ------------------------------------------------------- */

test('wave-45 combined registry: 40/40 ideas, ids 51761–51800 contiguous, zero skips', () => {
  assert.equal(ETA45_START, 51761);
  assert.equal(ETA45_END, 51785);
  assert.equal(RES45_START, 51786);
  assert.equal(RES45_END, 51800);
  assert.equal(ETA45_IDEAS.length, 25);
  assert.equal(RES45_IDEAS.length, 15);
  const all = [...ETA45_IDEAS, ...RES45_IDEAS];
  const ids = all.map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, i) => 51761 + i));
  for (const [id, title, desc] of all) {
    assert.ok(title && title.length > 3, `idea ${id} has a title`);
    assert.ok(desc && desc.length > 10, `idea ${id} has a description`);
    assert.ok(!/SKIP|skip|deferred/i.test(title + ' ' + desc), `idea ${id} is not a skip`);
  }
});

/* --- etaRound5Core spot checks (51761–51785) --------------------------------------- */

test('formatDuration renders compact durations', () => {
  assert.equal(formatDuration(45 * MIN), '45m');
  assert.equal(formatDuration(134 * MIN), '2h 14m');
  assert.equal(formatDuration(0), '0m');
});

test('etaRecalcLog records every change with its cause, newest first', () => {
  const log = etaRecalcLog([
    { at: '09:00', estimateMs: 170 * MIN, cause: 'hunt started' },
    { at: '09:30', estimateMs: 160 * MIN, cause: 'recon finished early' },
  ]);
  assert.equal(log.length, 2);
  assert.equal(log[0].deltaMs, -10 * MIN);
  assert.ok(log[0].text.includes('shrunk'));
  assert.ok(log[1].text.includes('initial estimate'));
  assert.equal(log[1].deltaMs, 0);
});

test('timeToFirstFinding compares against history', () => {
  const t = timeToFirstFinding({ startedAtMs: 0, firstFindingAtMs: 30 * MIN, historyAvgMs: 45 * MIN });
  assert.equal(t.firstFindingMs, 30 * MIN);
  assert.equal(t.vsHistory, 'faster');
  assert.ok(t.text.includes('faster'));
  const slow = timeToFirstFinding({ startedAtMs: 0, firstFindingAtMs: 60 * MIN, historyAvgMs: 45 * MIN });
  assert.equal(slow.vsHistory, 'slower');
});

test('idleTimeAccounting splits idle out of wall time', () => {
  const t = idleTimeAccounting({
    totalWallMs: 180 * MIN,
    segments: [
      { kind: 'active', ms: 140 * MIN },
      { kind: 'paused', ms: 20 * MIN },
      { kind: 'awaiting-approval', ms: 14 * MIN },
      { kind: 'awaiting-test', ms: 6 * MIN },
    ],
  });
  assert.equal(t.idleMs, 40 * MIN);
  assert.equal(t.idlePct, 22);
  assert.ok(t.text.includes('40m'));
});

test('activeTimeCounter counts pure working time', () => {
  const a = activeTimeCounter({ totalWallMs: 180 * MIN, pausedMs: 20 * MIN, approvalWaitMs: 14 * MIN, testWaitMs: 6 * MIN });
  assert.equal(a.activeMs, 140 * MIN);
  assert.equal(a.activePct, 78);
});

test('etaExportPayload emits JSON and CSV timing exports', () => {
  const p = etaExportPayload({ huntId: 'H-1', exportedAtMs: NOW, etaMs: 110 * MIN, finishAtMs: NOW + 110 * MIN, timezone: 'IST', pctComplete: 31, recalculations: [] });
  assert.equal(p.timing.remainingHuman, '1h 50m');
  assert.ok(p.json.includes('H-1'));
  assert.ok(p.csv.includes('remaining_ms,6600000'));
  assert.equal(p.timing.timezone || p.timezone, 'IST');
});

test('multiHuntEtas sorts soonest first and summarizes the board', () => {
  const b = multiHuntEtas([
    { id: 'H-1', name: 'oct-sweep', remainingMs: 110 * MIN },
    { id: 'H-2', name: 'vendor-api', remainingMs: 64 * MIN },
    { id: 'H-3', name: 'mobile-app', remainingMs: 205 * MIN },
  ]);
  assert.deepEqual(b.rows.map(r => r.id), ['H-2', 'H-1', 'H-3']);
  assert.ok(b.text.includes('3 hunts'));
  assert.equal(multiHuntEtas([]).count, 0);
});

test('etaPrioritization fits high value density into the remaining budget', () => {
  const plan = etaPrioritization([
    { id: 'a', title: 'A', expectedMs: 40 * MIN, valueScore: 90 },
    { id: 'b', title: 'B', expectedMs: 60 * MIN, valueScore: 85 },
    { id: 'c', title: 'C', expectedMs: 20 * MIN, valueScore: 30 },
  ], 100 * MIN);
  assert.deepEqual(plan.fits.map(f => f.id), ['a', 'c']);
  assert.deepEqual(plan.deferred.map(d => d.id), ['b']);
  assert.equal(plan.usedMs, 60 * MIN);
});

test('wrapUpEta totals clean-finish phases', () => {
  const w = wrapUpEta({ remainingWorkMs: 45 * MIN, verifyMs: 20 * MIN, reportMs: 15 * MIN });
  assert.equal(w.totalMs, 80 * MIN);
  assert.equal(w.phases.length, 3);
  assert.ok(w.text.includes('1h 20m'));
});

test('approvalEta flags overdue waits', () => {
  const rows = approvalEta([
    { id: 'ap-1', title: 'X', requestedAtMs: NOW - 42 * MIN, avgDecisionMs: 30 * MIN },
    { id: 'ap-2', title: 'Y', requestedAtMs: NOW - 8 * MIN, avgDecisionMs: 30 * MIN },
  ], NOW);
  assert.equal(rows[0].state, 'overdue');
  assert.equal(rows[0].expectedInMs, 0);
  assert.equal(rows[1].state, 'fresh');
  assert.equal(rows[1].expectedInMs, 22 * MIN);
});

test('testRequestEta estimates starts from queue position', () => {
  const rows = testRequestEta([
    { id: 't-1', name: 'A', requestedAtMs: NOW - 12 * MIN, expectedDurationMs: 18 * MIN, queuePosition: 0 },
    { id: 't-2', name: 'B', requestedAtMs: NOW - 5 * MIN, expectedDurationMs: 9 * MIN, queuePosition: 1 },
  ], NOW);
  assert.equal(rows[0].startsInMs, 0);
  assert.equal(rows[1].startsInMs, 8 * MIN);
  assert.ok(rows[0].text.includes('A'));
});

test('overnightEta is honest about the morning target', () => {
  assert.equal(overnightEta({ finishAtMs: NOW + 170 * MIN, targetMorningMs: NOW + 200 * MIN }).meetsMorning, true);
  const miss = overnightEta({ finishAtMs: NOW + 170 * MIN, targetMorningMs: NOW + 100 * MIN });
  assert.equal(miss.meetsMorning, false);
  assert.ok(miss.text.includes('Misses'));
});

test('etaTimezone renders the finish in every team timezone', () => {
  const rows = etaTimezone(1728288000000, [{ label: 'IST', offsetMin: 330 }, { label: 'UTC', offsetMin: 0 }]);
  assert.equal(rows[0].clock, '1:30 PM');
  assert.equal(rows[0].weekday, 'Mon');
  assert.equal(rows[0].text, '1:30 PM IST (Mon)');
  assert.equal(rows[1].clock, '8:00 AM');
});

test('etaTabTitle builds the pure tab-title string', () => {
  assert.equal(etaTabTitle({ remainingMs: 110 * MIN, phaseName: 'Scanning' }), '⏳ 1h 50m · Scanning — Dark-Matter');
  assert.equal(etaTabTitle({ remainingMs: 45 * MIN }), '⏳ 45m — Dark-Matter');
});

test('etaMilestones marks reached and upcoming milestones', () => {
  const ms = etaMilestones(48 * MIN, 100 * MIN, [25, 50, 75, 100]);
  assert.deepEqual(ms.map(m => m.reached), [true, true, false, false]);
  assert.ok(ms[0].text.includes('25%'));
});

test('etaDriftAlerts only fire beyond tolerance', () => {
  const fire = etaDriftAlerts({ baselineMs: 148 * MIN, currentMs: 175 * MIN, thresholdMs: 20 * MIN });
  assert.equal(fire.length, 1);
  assert.equal(fire[0].direction, 'slipped');
  assert.ok(fire[0].text.includes('27m'));
  assert.equal(etaDriftAlerts({ baselineMs: 148 * MIN, currentMs: 150 * MIN, thresholdMs: 20 * MIN }).length, 0);
  const better = etaDriftAlerts({ baselineMs: 148 * MIN, currentMs: 110 * MIN, thresholdMs: 20 * MIN });
  assert.equal(better[0].direction, 'shrunk');
});

test('etaScenarioPlanner answers what-if plans instantly', () => {
  const rows = etaScenarioPlanner({
    remainingMs: 110 * MIN,
    scenarios: [
      { id: 's1', label: 'Add 2h', addMs: 120 * MIN, removeMs: 0, parallelismBoostPct: 0 },
      { id: 's2', label: 'Double parallelism', addMs: 0, removeMs: 0, parallelismBoostPct: 100 },
    ],
  });
  assert.equal(rows[0].newRemainingMs, 230 * MIN);
  assert.equal(rows[1].newRemainingMs, 55 * MIN);
});

test('etaLearning explains estimate changes in plain words', () => {
  const lines = etaLearning([
    { fromMs: 160 * MIN, toMs: 148 * MIN, cause: 'recon finished early', phaseName: 'Recon' },
    { fromMs: 148 * MIN, toMs: 152 * MIN, cause: 'the new subnet added 12 targets', phaseName: 'Scanning' },
  ]);
  assert.ok(lines[0].text.includes('shrank'));
  assert.ok(lines[0].text.includes('recon finished early'));
  assert.ok(lines[1].text.includes('grew'));
});

test('subAgentEtas lists sub-agents longest-first', () => {
  const s = subAgentEtas([
    { id: 's1', name: 'A', remainingMs: 30 * MIN, taskCount: 2 },
    { id: 's2', name: 'B', remainingMs: 60 * MIN, taskCount: 3 },
  ]);
  assert.deepEqual(s.rows.map(r => r.name), ['B', 'A']);
  assert.equal(s.totalMs, 90 * MIN);
});

test('etaApi describes four live-estimate routes', () => {
  const routes = etaApi({ baseUrl: 'https://api.infinity-ai.example/v1' });
  assert.equal(routes.length, 4);
  assert.ok(routes.every(r => r.method && r.path && r.description && r.sample));
  assert.ok(routes[0].path.startsWith('https://api.infinity-ai.example/v1/hunts/'));
});

test('etaDashboard scores cross-hunt timing accuracy', () => {
  const d = etaDashboard([
    { id: 'H-1', predictedMs: 150 * MIN, actualMs: 162 * MIN, findings: 9 },
    { id: 'H-2', predictedMs: 90 * MIN, actualMs: 84 * MIN, findings: 4 },
  ]);
  assert.equal(d.accuracyPct, 93);
  assert.equal(d.verdict, 'excellent');
  assert.equal(d.totalFindings, 13);
});

test('etaFairness splits remaining time proportionally by weight', () => {
  const f = etaFairness([
    { name: 'a', weight: 5 },
    { name: 'b', weight: 3 },
    { name: 'c', weight: 2 },
  ], 110 * MIN);
  assert.deepEqual(f.rows.map(r => r.fairSharePct), [50, 30, 20]);
  assert.equal(f.rows.reduce((s, r) => s + r.etaMs, 0), 110 * MIN);
});

test('etaAutoscale adds parallelism only when behind', () => {
  const s = etaAutoscale({ remainingMs: 170 * MIN, plannedMs: 148 * MIN, currentParallelism: 2, maxParallelism: 6 });
  assert.equal(s.behind, true);
  assert.equal(s.addSlots, 1);
  assert.equal(s.newParallelism, 3);
  assert.equal(s.newRemainingMs, Math.round(170 * MIN * (2 / 3)));
  const onTime = etaAutoscale({ remainingMs: 120 * MIN, plannedMs: 148 * MIN, currentParallelism: 2, maxParallelism: 6 });
  assert.equal(onTime.behind, false);
  assert.equal(onTime.addSlots, 0);
});

test('etaFreeze locks the estimate on demand', () => {
  const f = etaFreeze({ estimate: { remainingMs: 110 * MIN, finishAtMs: 2000 }, frozen: true, frozenAtMs: 1000 });
  assert.equal(f.frozen, true);
  assert.ok(f.text.includes('frozen'));
  assert.ok(etaFreeze({ estimate: { remainingMs: 110 * MIN }, frozen: false }).text.includes('live'));
});

test('etaRetrospective measures first and final estimate accuracy', () => {
  const r = etaRetrospective({
    estimates: [
      { at: '09:00', estimateMs: 170 * MIN },
      { at: '10:30', estimateMs: 152 * MIN },
    ],
    actualMs: 158 * MIN,
  });
  assert.equal(r.firstErrorPct, 8);
  assert.equal(r.lastErrorPct, 4);
  assert.equal(r.improvedBy, 4);
  assert.equal(r.verdict, 'accurate');
  assert.equal(etaRetrospective({ estimates: [], actualMs: 100 * MIN }).verdict, 'drifted');
});

test('countdownVoiceScript answers "how much longer?" hands-free', () => {
  const s = countdownVoiceScript('how much longer?', 62 * MIN, 'Scanning');
  assert.ok(s.includes('1h 2m'));
  assert.ok(s.includes('Scanning'));
  assert.ok(countdownVoiceScript('when will you be done?', 62 * MIN).includes('done in roughly'));
});

/* --- resourceCore spot checks (51786–51800) ---------------------------------------- */

test('formatBytes renders compact byte sizes', () => {
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(3 * 1024 * 1024 * 1024), '3.0 GB');
});

test('requestCounter ticks totals immutably', () => {
  const c = requestCounter({ total: 100 }, 50);
  assert.equal(c.total, 150);
  assert.equal(c.lastDelta, 50);
  assert.equal(requestCounter({ total: 100 }, -5).total, 100);
});

test('requestRateSeries plots rates with the cap overlaid', () => {
  const s = requestRateSeries([{ sec: 0, count: 40 }, { sec: 1, count: 70 }], 60);
  assert.equal(s.peak, 70);
  assert.equal(s.avg, 55);
  assert.equal(s.overCapCount, 1);
  assert.ok(s.text.includes('55/s'));
});

test('bandwidthMeter totals traffic and ranks phases', () => {
  const b = bandwidthMeter([
    { phase: 'A', sentBytes: 100, recvBytes: 300 },
    { phase: 'B', sentBytes: 50, recvBytes: 150 },
  ]);
  assert.equal(b.sentBytes, 150);
  assert.equal(b.recvBytes, 450);
  assert.equal(b.rows[0].phase, 'A');
  assert.equal(b.rows[0].sharePct, 67);
});

test('cpuPanel reports status bands', () => {
  const c = cpuPanel([{ at: 'a', pct: 50 }, { at: 'b', pct: 95 }]);
  assert.equal(c.current, 95);
  assert.equal(c.peak, 95);
  assert.equal(c.avg, 72.5);
  assert.equal(c.status, 'critical');
  assert.equal(cpuPanel([{ at: 'a', pct: 10 }]).status, 'idle-ish');
});

test('memoryPanel warns before the limit', () => {
  const m = memoryPanel({ usedBytes: 6.4 * 1024 * 1024 * 1024, limitBytes: 8 * 1024 * 1024 * 1024 });
  assert.equal(m.usedPct, 80);
  assert.equal(m.status, 'warning');
  assert.equal(memoryPanel({ usedBytes: 1024, limitBytes: 8 * 1024 * 1024 * 1024 }).status, 'healthy');
});

test('gpuDisplay reports utilization and VRAM', () => {
  const g = gpuDisplay({ utilPct: 74, vramUsedBytes: 5.2 * 1024 * 1024 * 1024, vramTotalBytes: 8 * 1024 * 1024 * 1024, modelName: 'qwen2.5-7b-q4' });
  assert.equal(g.status, 'working');
  assert.equal(g.vramPct, 65);
  const idle = gpuDisplay({ utilPct: 0, vramUsedBytes: 0, vramTotalBytes: 0 });
  assert.equal(idle.status, 'idle');
  assert.ok(idle.text.includes('GPU idle'));
});

test('tokenTracker totals tokens and ranks phases', () => {
  const t = tokenTracker([{ name: 'A', tokens: 100 }, { name: 'B', tokens: 300 }]);
  assert.equal(t.rows[0].name, 'B');
  assert.equal(t.rows[0].sharePct, 75);
  assert.equal(t.totalTokens, 400);
});

test('costEstimator projects spend across tokens, compute, and APIs', () => {
  const c = costEstimator({ tokens: 1000000, modelRatePerK: 0.002, computeHours: 2, computeRatePerH: 0.5, apiCalls: 1000, apiRatePerCall: 0.001 });
  assert.equal(c.modelCost, 2);
  assert.equal(c.computeCost, 1);
  assert.equal(c.apiCost, 1);
  assert.equal(c.totalCost, 4);
  assert.ok(c.text.includes('$4.0000'));
});

test('budgetAlerts fire at 50/80/100 percent', () => {
  const b = budgetAlerts({ spent: 7.4, budget: 10, thresholds: [50, 80, 100] });
  assert.equal(b.usedPct, 74);
  assert.equal(b.alerts.length, 1);
  assert.equal(b.alerts[0].level, 'info');
  const over = budgetAlerts({ spent: 10.5, budget: 10, thresholds: [50, 80, 100] });
  assert.equal(over.alerts.length, 3);
  assert.equal(over.alerts[2].level, 'critical');
  assert.ok(over.alerts[2].text.includes('⛔'));
});

test('moduleResourceSplit ranks modules by spend', () => {
  const s = moduleResourceSplit([
    { name: 'a', requests: 1, tokens: 1, cost: 2 },
    { name: 'b', requests: 1, tokens: 1, cost: 3 },
  ]);
  assert.equal(s.rows[0].name, 'b');
  assert.equal(s.rows[0].sharePct, 60);
});

test('resourceHistory normalizes usage curves', () => {
  const h = resourceHistory([
    { at: 'a', requests: 100, tokens: 200, costPct: 10 },
    { at: 'b', requests: 400, tokens: 100, costPct: 20 },
  ]);
  assert.equal(h.points[1].requestsNorm, 100);
  assert.equal(h.points[0].requestsNorm, 25);
  assert.equal(h.points[0].tokensNorm, 100);
});

test('resourceCaps decides warn/throttle/pause at the caps', () => {
  const c = resourceCaps({
    usage: { requests: 95000, tokens: 100, cost: 1 },
    caps: { requests: 100000, tokens: 2000000, cost: 10 },
  });
  assert.equal(c.decision, 'throttle');
  const paused = resourceCaps({ usage: { requests: 100000 }, caps: { requests: 100000 } });
  assert.equal(paused.decision, 'pause');
  const ok = resourceCaps({ usage: { requests: 100 }, caps: { requests: 100000 } });
  assert.equal(ok.decision, 'ok');
});

test('throttleControls clamp dials and compute the effective rate', () => {
  const t = throttleControls({ ratePerSec: 40, maxRatePerSec: 80, parallelism: 3, maxParallelism: 8, modelTier: 'lite' });
  assert.equal(t.effectiveRate, 48);
  const clamped = throttleControls({ ratePerSec: 200, maxRatePerSec: 80, parallelism: 2, maxParallelism: 8, modelTier: 'full' });
  assert.equal(clamped.ratePerSec, 80);
  assert.equal(clamped.effectiveRate, 160);
});

test('efficiencyScore measures findings per thousand requests', () => {
  const e = efficiencyScore({ findings: 12, requests: 84200 });
  assert.equal(e.per1000, 0.14);
  assert.equal(e.band, 'poor');
  assert.equal(efficiencyScore({ findings: 800, requests: 84200 }).band, 'excellent');
});

test('wasteDetector flags resource burn with zero results', () => {
  const w = wasteDetector([
    { name: 'a', requests: 5000, tokens: 1000, findings: 0 },
    { name: 'b', requests: 50000, tokens: 1000, findings: 0 },
    { name: 'c', requests: 5000, tokens: 1000, findings: 2 },
  ]);
  assert.equal(w.count, 2);
  assert.equal(w.flagged[0].severity, 'medium');
  assert.equal(w.flagged[1].severity, 'high');
  assert.ok(w.text.includes('flagged'));
  assert.equal(wasteDetector([{ name: 'c', requests: 5000, tokens: 1000, findings: 2 }]).count, 0);
});

/* --- zero-keyframe CSS audit --------------------------------------------------------- */

test('Wave45.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave45.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.et5-') && css.includes('.rs5-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-45 sources carry no unfinished-work or fake-content markers', () => {
  const markers = [
    ['T', 'O', 'D', 'O'], ['F', 'I', 'X', 'M', 'E'], ['X', 'X', 'X'], ['H', 'A', 'C', 'K'],
    ['M', 'O', 'C', 'K'], ['D', 'E', 'M', 'O'], ['S', 'i', 'm', 'u', 'l', 'a', 't', 'e'],
    ['p', 'l', 'a', 'c', 'e', 'h', 'o', 'l', 'd', 'e', 'r'],
  ].map((parts) => new RegExp('\\b' + parts.join('') + '\\b', 'i'));
  const files = ['etaRound5Core.js', 'resourceCore.js', 'EtaRound5.jsx', 'ResourceSuite.jsx', 'Wave45.css', 'wave45.test.js'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const re of markers) {
      assert.ok(!re.test(src), `debris marker ${re} in ${f}`);
    }
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('EtaRound5.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'EtaRound5.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('EtaRound5Gallery'), 'esbuild parsed the round-5 gallery export');
});

test('ResourceSuite.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ResourceSuite.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('ResourceSuiteGallery'), 'esbuild parsed the resource suite gallery export');
});
