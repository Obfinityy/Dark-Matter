/**
 * wave46.test.js — wave 46 (ideas 51801–51840): resource monitoring rounds 6 + 7.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave46.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE46_R6_IDEAS,
  WAVE46_R6_START,
  WAVE46_R6_END,
  forecastUsage,
  usageComparison,
  resourceCsvExport,
  resourceAlertRules,
  perAssetView,
  modelCostBreakdown,
  quotaView,
  egressMonitor,
  diskTracker,
  pauseTriggers,
  ecoMode,
  resourcePreset,
  teamDashboard,
  chargebackTags,
  anomalyAlerts,
  parallelismTuner,
  cacheHitRates,
  strategyHints,
  sessionTime,
  apiQuotaMonitor,
} from './resourceRound6Core.js';

import {
  WAVE46_R7_IDEAS,
  WAVE46_R7_START,
  WAVE46_R7_END,
  resourceLeaderboard,
  resourceRetrospective,
  costTicker,
  budgetTopUp,
  resourceGuardrails,
  usageHeatmap,
  resourceVoiceQuery,
  mobileResourcePayload,
  multiHuntResourceBoard,
  resourceExportSchedule,
  carbonEstimate,
  resourceSharing,
  idleResourceDisplay,
  resourcePrediction,
  spendByFinding,
  resourceQuotaApi,
  alertRouting,
  historicalTrends,
  awareScheduling,
  oneClickResourceReport,
} from './resourceRound7Core.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const MIN = 60000;
const DAY = 86400000;
const GB = 1024 * 1024 * 1024;

/* --- registry completeness ------------------------------------------------------- */

test('wave-46 combined registry: 40/40 ideas, ids 51801–51840 contiguous, zero skips', () => {
  assert.equal(WAVE46_R6_START, 51801);
  assert.equal(WAVE46_R6_END, 51820);
  assert.equal(WAVE46_R7_START, 51821);
  assert.equal(WAVE46_R7_END, 51840);
  assert.equal(WAVE46_R6_IDEAS.length, 20);
  assert.equal(WAVE46_R7_IDEAS.length, 20);
  const all = [...WAVE46_R6_IDEAS, ...WAVE46_R7_IDEAS];
  const ids = all.map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.deepEqual(
    ids,
    Array.from({ length: 40 }, (_, i) => 51801 + i)
  );
  for (const [id, title, desc] of all) {
    assert.ok(title && title.length > 3, `idea ${id} has a title`);
    assert.ok(desc && desc.length > 10, `idea ${id} has a description`);
    assert.ok(!/SKIP|skip|deferred/i.test(title + ' ' + desc), `idea ${id} is not a skip`);
  }
});

/* --- resourceRound6Core spot checks (51801–51820) ------------------------------------ */

test('forecastUsage projects linear burn to hunt completion', () => {
  const samples = [
    { elapsedMs: 30 * MIN, usedUsd: 1.2 },
    { elapsedMs: 60 * MIN, usedUsd: 2.6 },
    { elapsedMs: 90 * MIN, usedUsd: 3.9 },
    { elapsedMs: 120 * MIN, usedUsd: 5.4 },
  ];
  const f = forecastUsage(samples, 240 * MIN, 12);
  assert.equal(f.projectedUsd, 11.0);
  assert.equal(f.burnPerHour, 2.8);
  assert.equal(f.budgetPct, 92);
  assert.equal(f.confidence, 'medium');
  assert.ok(f.text.includes('$11.00'));
  const thin = forecastUsage([{ elapsedMs: 30 * MIN, usedUsd: 1.2 }], 240 * MIN, 12);
  assert.equal(thin.confidence, 'low');
});

test('usageComparison deltas against the historical average', () => {
  const c = usageComparison(
    { requests: 90000, tokens: 400000, cost: 8 },
    { avgRequests: 80000, avgTokens: 410000, avgCost: 8 }
  );
  assert.deepEqual(
    c.rows.map(r => r.metric),
    ['requests', 'tokens', 'cost']
  );
  assert.equal(c.rows[0].deltaPct, 13);
  assert.equal(c.rows[0].direction, 'above');
  assert.equal(c.rows[1].deltaPct, -2);
  assert.equal(c.rows[1].direction, 'near');
  assert.ok(c.text.includes('requests'));
});

test('resourceCsvExport returns an RFC4180-style CSV string', () => {
  const csv = resourceCsvExport([
    { at: '09:00', requests: 4200, tokens: 38000, costUsd: 0.8 },
    { at: 'hunt, "special"', requests: 1, tokens: 2, costUsd: 3.5 },
  ]);
  assert.equal(typeof csv, 'string');
  assert.ok(csv.startsWith('at,requests,tokens,cost_usd\r\n'));
  assert.ok(csv.includes('09:00,4200,38000,0.80'));
  assert.ok(csv.includes('"hunt, ""special""",1,2,3.50'));
});

test('resourceAlertRules build webhook payloads for crossed thresholds', () => {
  const rules = [
    { id: 'w1', name: 'Spend warning', metric: 'spend', threshold: 8, level: 'warning' },
    { id: 'c1', name: 'Spend critical', metric: 'spend', threshold: 10, level: 'critical' },
  ];
  const api = { url: 'https://hooks.infinity-ai.example/resource-alerts' };
  const a = resourceAlertRules(rules, { spend: 9 }, api);
  assert.equal(a.crossed.length, 1);
  assert.equal(a.payloads[0].event, 'resource.threshold.crossed');
  assert.equal(a.payloads[0].target, api);
  assert.ok(a.payloads[0].text.includes('Spend warning'));
  assert.equal(resourceAlertRules(rules, { spend: 11 }, api).crossed.length, 2);
  assert.ok(resourceAlertRules(rules, { spend: 5 }, api).text.includes('No thresholds'));
});

test('perAssetView ranks assets and totals the hunt', () => {
  const v = perAssetView([
    { name: 'api.example.com', requests: 42100, tokens: 260000, costUsd: 5.2, findings: 6 },
    { name: 'shop.example.com', requests: 23800, tokens: 120000, costUsd: 2.4, findings: 2 },
    { name: 'm.example.com', requests: 9300, tokens: 45000, costUsd: 0.9, findings: 1 },
  ]);
  assert.equal(v.rows[0].name, 'api.example.com');
  assert.equal(v.totals.costUsd, 8.5);
  assert.equal(v.totals.findings, 9);
  assert.equal(v.totals.tokens, 425000);
});

test('modelCostBreakdown assigns percent-of-total spend per model', () => {
  const b = modelCostBreakdown([
    { model: 'qwen2.5-7b-q4', costUsd: 4.8 },
    { model: 'qwen2.5-1.5b', costUsd: 1.2 },
    { model: 'vision-7b', costUsd: 2.1 },
  ]);
  assert.equal(b.totalUsd, 8.1);
  assert.equal(b.rows[0].model, 'qwen2.5-7b-q4');
  assert.equal(b.rows[0].pct, 59);
  assert.ok(b.text.includes('59%'));
});

test('quotaView reports remaining session time and percent', () => {
  const q = quotaView({ sessionLimitMs: 360 * MIN, elapsedMs: 210 * MIN });
  assert.equal(q.remainingMs, 150 * MIN);
  assert.equal(q.remainingPct, 42);
  assert.equal(q.state, 'ok');
  assert.equal(quotaView({ sessionLimitMs: 360 * MIN, elapsedMs: 350 * MIN }).state, 'critical');
});

test('egressMonitor flags spikes at 2.5x the median', () => {
  const e = egressMonitor([
    { at: '09:00', egressBytes: 210 * 1024 * 1024 },
    { at: '09:10', egressBytes: 220 * 1024 * 1024 },
    { at: '09:20', egressBytes: 205 * 1024 * 1024 },
    { at: '09:30', egressBytes: 630 * 1024 * 1024 },
    { at: '09:40', egressBytes: 218 * 1024 * 1024 },
  ]);
  assert.equal(e.flagged.length, 1);
  assert.equal(e.flagged[0].at, '09:30');
  assert.ok(e.flagged[0].multipleOfMedian > 2.5);
  assert.equal(egressMonitor([{ at: 'a', egressBytes: 100 }]).flagged.length, 0);
});

test('diskTracker reports growth rate and projected fill date', () => {
  const d = diskTracker([
    { atMs: 0, usedBytes: 40 * GB, capacityBytes: 200 * GB },
    { atMs: DAY, usedBytes: 43 * GB, capacityBytes: 200 * GB },
  ]);
  assert.equal(d.growthPerDay, 3 * GB);
  assert.equal(d.projectedFullAtMs, Math.round(DAY * (1 + 157 / 3)));
  assert.ok(d.text.includes('/day') && d.text.includes('projected full'));
});

test('pauseTriggers fire rules on breached conditions', () => {
  const rules = [
    { id: 'p1', name: 'Budget exceeded', when: { metric: 'costUsd', op: '>', value: 10 } },
    { id: 'p2', name: 'Error storm', when: { metric: 'errorRatePct', op: '>=', value: 25 } },
  ];
  const p = pauseTriggers({ costUsd: 10.5, errorRatePct: 2 }, rules);
  assert.equal(p.triggered.length, 1);
  assert.equal(p.triggered[0].id, 'p1');
  assert.equal(p.shouldPause, true);
  assert.equal(pauseTriggers({ costUsd: 5, errorRatePct: 2 }, rules).shouldPause, false);
});

test('ecoMode halves token, rate, and compute targets', () => {
  const e = ecoMode({ tokenTarget: 500000, requestsPerMin: 60, computeHours: 6 });
  assert.equal(e.eco.tokenTarget, 250000);
  assert.equal(e.eco.requestsPerMin, 30);
  assert.equal(e.eco.computeHours, 3);
  assert.equal(e.normal.tokenTarget, 500000);
});

test('resourcePreset resolves light/balanced/unlimited and defaults safely', () => {
  assert.equal(resourcePreset('light').name, 'light');
  assert.equal(resourcePreset('light').profile.requestsPerMin, 20);
  assert.equal(resourcePreset('unlimited').profile.maxParallelism, 10);
  assert.equal(resourcePreset('nope').name, 'balanced');
});

test('teamDashboard rolls up org-wide resources and cost per finding', () => {
  const t = teamDashboard([
    { id: 'H-1', name: 'oct-sweep', costUsd: 8.4, requests: 84200, tokens: 455000, findings: 12 },
    { id: 'H-2', name: 'vendor-api', costUsd: 4.1, requests: 31000, tokens: 180000, findings: 7 },
    { id: 'H-3', name: 'mobile-app', costUsd: 1.9, requests: 12800, tokens: 96000, findings: 0 },
  ]);
  assert.equal(t.hunts, 3);
  assert.equal(t.totals.costUsd, 14.4);
  assert.equal(t.totals.findings, 19);
  assert.equal(t.costPerFinding, 0.76);
  assert.equal(t.rows[0].id, 'H-1');
  assert.equal(t.rows[2].costPerFinding, null);
});

test('chargebackTags split spend across cost centers', () => {
  const c = chargebackTags({ id: 'H-1', costUsd: 8.4 }, [
    { name: 'core', costCenter: 'security', sharePct: 70 },
    { name: 'client-a', costCenter: 'client-a', sharePct: 30 },
  ]);
  assert.equal(c.rows[0].amountUsd, 5.88);
  assert.equal(c.rows[1].amountUsd, 2.52);
  assert.equal(c.balanced, true);
});

test('anomalyAlerts flag values beyond the sigma band', () => {
  const series = [
    { at: '09:00', value: 100 },
    { at: '09:05', value: 101 },
    { at: '09:10', value: 99 },
    { at: '09:15', value: 102 },
    { at: '09:20', value: 100 },
    { at: '09:25', value: 98 },
    { at: '09:30', value: 101 },
    { at: '09:35', value: 103 },
    { at: '09:40', value: 280 },
    { at: '09:45', value: 101 },
  ];
  const a = anomalyAlerts(series);
  assert.equal(a.flagged.length, 1);
  assert.equal(a.flagged[0].value, 280);
  assert.ok(a.flagged[0].deviation > 2.5);
  assert.equal(anomalyAlerts([{ at: 'a', value: 1 }]).flagged.length, 0);
});

test('parallelismTuner reports impact rows and the cheapest worker count', () => {
  const t = parallelismTuner(
    { max: 8 },
    { baseCostPerWorker: 0.15, throughputPerWorker: 120, efficiencyDropPct: 10 }
  );
  assert.equal(t.rows.length, 8);
  assert.equal(t.rows[0].workers, 1);
  assert.equal(t.rows[0].throughput, 120);
  assert.equal(t.rows[0].costPerUnit, 0.00125);
  assert.equal(t.bestWorkers, 1);
  assert.ok(t.text.includes('1 worker'));
});

test('cacheHitRates report the hit rate and reuse band', () => {
  const c = cacheHitRates({ hits: 8700, misses: 1300 });
  assert.equal(c.hitRatePct, 87);
  assert.equal(c.band, 'good');
  assert.ok(c.text.includes('87%'));
  assert.equal(cacheHitRates({ hits: 0, misses: 0 }).hitRatePct, 0);
});

test('strategyHints give budget-aware advice', () => {
  const s = strategyHints({ spentUsd: 3.2, findings: 6 }, 10);
  assert.equal(s.spentPct, 32);
  assert.ok(s.hints[0].includes('go deeper'));
  const over = strategyHints({ spentUsd: 11 }, 10);
  assert.equal(over.spentPct, 110);
  assert.ok(over.hints[0].includes('over budget'));
});

test('sessionTime splits wall-clock from active compute', () => {
  const s = sessionTime([
    { id: 'recon', wallMs: 60 * MIN, idleMs: 8 * MIN },
    { id: 'scan', wallMs: 120 * MIN, idleMs: 20 * MIN },
    { id: 'verify', wallMs: 45 * MIN, idleMs: 5 * MIN },
  ]);
  assert.equal(s.wallMs, 225 * MIN);
  assert.equal(s.activeMs, 192 * MIN);
  assert.equal(s.activePct, 85);
  assert.equal(s.rows[1].activePct, 83);
  assert.ok(s.text.includes('85%'));
});

test('apiQuotaMonitor reports remaining quota and throttling flags', () => {
  const q = apiQuotaMonitor({ requests: 1000, tokens: 2000000 }, { requests: 930, tokens: 455000 });
  assert.equal(q.rows[0].remaining, 70);
  assert.equal(q.rows[0].throttled, true);
  assert.equal(q.rows[1].throttled, false);
  assert.equal(q.throttledCount, 1);
  assert.ok(q.text.includes('throttling advised'));
});

/* --- resourceRound7Core spot checks (51821–51840) ------------------------------------ */

const R7_HUNTS = [
  { id: 'H-1', name: 'oct-sweep', costUsd: 8.4, budgetUsd: 10, requests: 84200, findings: 12 },
  { id: 'H-2', name: 'vendor-api', costUsd: 4.1, budgetUsd: 10, requests: 31000, findings: 7 },
  { id: 'H-3', name: 'mobile-app', costUsd: 6.2, budgetUsd: 10, requests: 52900, findings: 3 },
];

test('resourceLeaderboard ranks hunts by findings per USD', () => {
  const l = resourceLeaderboard(R7_HUNTS);
  assert.deepEqual(
    l.rows.map(r => r.id),
    ['H-2', 'H-1', 'H-3']
  );
  assert.equal(l.rows[0].findingsPerUsd, 1.71);
  assert.equal(l.rows[2].findingsPerUsd, 0.48);
  assert.ok(l.text.includes('vendor-api'));
});

test('resourceRetrospective reviews the hunt with optimization tips', () => {
  const r = resourceRetrospective({
    id: 'H-1',
    costUsd: 8.4,
    budgetUsd: 10,
    requests: 84200,
    tokens: 455000,
    findings: 12,
    wallMs: 225 * MIN,
  });
  assert.equal(r.spentPct, 84);
  assert.equal(r.costPerFinding, 0.7);
  assert.equal(r.tips.length, 2);
  assert.ok(r.text.includes('84%'));
});

test('costTicker accumulates spend events into a live total', () => {
  const t = costTicker([
    { at: '09:00', amountUsd: 0.8 },
    { at: '09:30', amountUsd: 1.6 },
    { at: '10:00', amountUsd: 2.3 },
  ]);
  assert.equal(t.events, 3);
  assert.equal(t.totalUsd, 4.7);
  assert.deepEqual(
    t.points.map(p => p.cumulativeUsd),
    [0.8, 2.4, 4.7]
  );
});

test('budgetTopUp adds funds with an audit record', () => {
  const b = budgetTopUp({ currentUsd: 10 }, 5, 1000);
  assert.equal(b.previousUsd, 10);
  assert.equal(b.addedUsd, 5);
  assert.equal(b.newUsd, 15);
  assert.ok(b.text.includes('$15.00'));
});

test('resourceGuardrails evaluate every rule state', () => {
  const g = resourceGuardrails(
    [
      { id: 'g1', name: 'Spend cap', metric: 'spend', op: '>=', threshold: 9, level: 'warning' },
      {
        id: 'g2',
        name: 'Hard spend stop',
        metric: 'spend',
        op: '>=',
        threshold: 12,
        level: 'critical',
      },
      { id: 'g3', name: 'Rate over limit', metric: 'rate', op: '>', threshold: 200, level: 'info' },
    ],
    { spend: 9.1, rate: 64 }
  );
  assert.equal(g.rows[0].state, 'tripped');
  assert.equal(g.rows[1].state, 'holding');
  assert.equal(g.rows[2].state, 'holding');
  assert.equal(g.trippedCount, 1);
  assert.equal(g.healthy, false);
});

test('usageHeatmap normalizes cells into a 0–1 intensity grid', () => {
  const h = usageHeatmap([
    { row: 'recon', col: 0, value: 4000 },
    { row: 'recon', col: 1, value: 8000 },
    { row: 'scan', col: 0, value: 42000 },
    { row: 'scan', col: 1, value: 38000 },
  ]);
  assert.equal(h.max, 42000);
  assert.equal(h.rows.length, 2);
  assert.equal(h.rows[0].cells[0].intensity, 0.1);
  assert.equal(h.rows[1].cells[0].intensity, 1);
});

test('resourceVoiceQuery answers spend, budget, request, and finding questions', () => {
  const usage = { spentUsd: 8.4, budgetUsd: 10, requests: 84200, tokens: 455000, findings: 12 };
  assert.ok(resourceVoiceQuery('how much have we spent?', usage).includes('$8.40'));
  assert.ok(resourceVoiceQuery('what budget is left?', usage).includes('$1.60'));
  assert.ok(resourceVoiceQuery('how many requests so far?', usage).includes('84,200'));
  assert.ok(resourceVoiceQuery('any findings yet?', usage).includes('12 findings'));
});

test('mobileResourcePayload emits a compact usage record', () => {
  const p = mobileResourcePayload({
    spentUsd: 8.4,
    budgetUsd: 10,
    requests: 84200,
    tokens: 455000,
    findings: 12,
    quotaPct: 42,
  });
  assert.equal(p.v, 1);
  assert.equal(p.pct, 84);
  assert.equal(p.f, 12);
  assert.equal(p.q, 42);
});

test('multiHuntResourceBoard compares hunts side by side', () => {
  const b = multiHuntResourceBoard(R7_HUNTS);
  assert.deepEqual(
    b.rows.map(r => r.id),
    ['H-1', 'H-3', 'H-2']
  );
  assert.equal(b.rows[2].costPerFinding, 0.59);
  assert.ok(b.text.includes('oct-sweep'));
});

test('resourceExportSchedule creates the scheduled report record', () => {
  const s = resourceExportSchedule(
    { id: 'H-1' },
    { cadence: 'daily', hourUtc: 9, recipients: ['owner@infinity-ai.example'], format: 'pdf' }
  );
  assert.equal(s.huntId, 'H-1');
  assert.equal(s.cadence, 'daily');
  assert.equal(s.hourUtc, 9);
  assert.equal(s.enabled, true);
  assert.ok(s.text.includes('09:00 UTC'));
});

test('carbonEstimate converts energy into kg CO2e', () => {
  const c = carbonEstimate(12);
  assert.equal(c.kgCO2e, 4.8);
  assert.equal(c.rating, 'moderate');
  assert.equal(carbonEstimate(0.5).rating, 'low');
  assert.equal(carbonEstimate(0.5).kgCO2e, 0.2);
});

test('resourceSharing pools budgets across hunts', () => {
  const s = resourceSharing([
    { id: 'pool-a', name: 'Core hunts', budgetUsd: 30, assignedHunts: ['H-1', 'H-2', 'H-3'] },
    { id: 'pool-b', name: 'Client pilots', budgetUsd: 12, assignedHunts: ['H-4'] },
  ]);
  assert.equal(s.totalUsd, 42);
  assert.equal(s.rows[0].perHuntUsd, 10);
  assert.equal(s.rows[1].hunts, 1);
});

test('idleResourceDisplay totals what paused hunts still cost', () => {
  const i = idleResourceDisplay([
    { id: 'H-9', name: 'paused-api', pausedAtMs: 0, idleCostPerDayUsd: 0.4, nowMs: 3 * DAY },
    { id: 'H-10', name: 'paused-web', pausedAtMs: 0, idleCostPerDayUsd: 0.25, nowMs: 0.5 * DAY },
  ]);
  assert.equal(i.rows[0].idleCostUsd, 1.2);
  assert.equal(i.rows[1].idleCostUsd, 0.13);
  assert.equal(i.totalIdleCostUsd, 1.33);
});

test('resourcePrediction forecasts from the first ten minutes', () => {
  const p = resourcePrediction(
    [
      { atMs: 0, usedUsd: 0.2 },
      { atMs: 300000, usedUsd: 0.55 },
      { atMs: 600000, usedUsd: 0.9 },
    ],
    240 * MIN
  );
  assert.equal(p.projectedUsd, 17);
  assert.equal(p.confidence, 'low');
  assert.equal(p.method, 'early-extrapolation');
  assert.ok(p.text.includes('$17.00'));
});

test('spendByFinding divides total cost by confirmed findings', () => {
  const s = spendByFinding(8.4, 12);
  assert.equal(s.perFindingUsd, 0.7);
  assert.ok(s.text.includes('$0.70'));
  assert.equal(spendByFinding(5, 0).perFindingUsd, null);
});

test('resourceQuotaApi returns the quota-check response shape', () => {
  const q = resourceQuotaApi({ spentUsd: 8.4, limitUsd: 10 });
  assert.equal(q.ok, true);
  assert.equal(q.usedPct, 84);
  assert.equal(q.remainingUsd, 1.6);
  assert.equal(q.retryAfterSec, null);
  const dead = resourceQuotaApi({ spentUsd: 12, limitUsd: 10 });
  assert.equal(dead.ok, false);
  assert.equal(dead.retryAfterSec, 3600);
});

test('alertRouting sends alerts to the matching policy recipients', () => {
  const policies = [
    { level: 'critical', recipients: ['oncall@infinity-ai.example'] },
    { level: 'warning', recipients: ['team@infinity-ai.example'] },
    { level: 'default', recipients: ['ops@infinity-ai.example'] },
  ];
  const r = alertRouting({ id: 'al-1', level: 'critical' }, policies);
  assert.deepEqual(r.recipients, ['oncall@infinity-ai.example']);
  assert.equal(r.routed, true);
  const fallback = alertRouting({ id: 'al-2', level: 'info' }, policies);
  assert.deepEqual(fallback.recipients, ['ops@infinity-ai.example']);
});

test('historicalTrends build the month-by-month efficiency series', () => {
  const t = historicalTrends([
    { label: 'Aug', costUsd: 40, findings: 22 },
    { label: 'Sep', costUsd: 38, findings: 30 },
    { label: 'Oct', costUsd: 36, findings: 34 },
  ]);
  assert.equal(t.rows[0].findingsPerUsd, 0.55);
  assert.equal(t.rows[2].findingsPerUsd, 0.94);
  assert.equal(t.trendDelta, 0.39);
  assert.equal(t.direction, 'improving');
});

test('awareScheduling suggests off-peak windows for heavy hunts', () => {
  const s = awareScheduling(
    [
      { id: 'H-1', name: 'oct-sweep', heavyWork: 'high' },
      { id: 'H-2', name: 'vendor-api', heavyWork: 'low' },
    ],
    [
      { label: '02:00–06:00 UTC', offPeak: true, discountPct: 30 },
      { label: '12:00–18:00 UTC', offPeak: false, discountPct: 0 },
    ]
  );
  assert.equal(s.count, 1);
  assert.equal(s.suggestions[0].huntId, 'H-1');
  assert.equal(s.suggestions[0].windows[0].discountPct, 30);
  assert.ok(s.text.includes('02:00–06:00 UTC'));
});

test('oneClickResourceReport builds the report descriptor', () => {
  const r = oneClickResourceReport({
    id: 'H-1',
    name: 'oct-sweep',
    costUsd: 8.4,
    findings: 12,
    durationMs: 225 * MIN,
  });
  assert.equal(r.sections.length, 4);
  assert.equal(r.attachment.filename, 'resource-report-H-1.md');
  assert.ok(r.title.includes('oct-sweep'));
  assert.equal(r.sections[3].detail, '$0.70');
});

/* --- zero-keyframe CSS audit --------------------------------------------------------- */

test('Wave46.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave46.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.rr6-') && css.includes('.rr7-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-46 sources carry no unfinished-work or fake-content markers', () => {
  // Markers built char-by-char so the test source itself never matches them.
  const markers = [
    ['T', 'O', 'D', 'O'],
    ['F', 'I', 'X', 'M', 'E'],
    ['X', 'X', 'X'],
    ['H', 'A', 'C', 'K'],
    ['M', 'O', 'C', 'K'],
    ['D', 'E', 'M', 'O'],
    ['S', 'i', 'm', 'u', 'l', 'a', 't', 'e'],
    ['p', 'l', 'a', 'c', 'e', 'h', 'o', 'l', 'd', 'e', 'r'],
    ['l', 'o', 'r', 'e', 'm'],
  ].map(parts => new RegExp('\\b' + parts.join('') + '\\b', 'i'));
  const files = [
    'resourceRound6Core.js',
    'resourceRound7Core.js',
    'ResourceRound6.jsx',
    'ResourceRound7.jsx',
    'Wave46.css',
    'wave46.test.js',
  ];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const re of markers) {
      assert.ok(!re.test(src), `debris marker ${re} in ${f}`);
    }
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('ResourceRound6.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ResourceRound6.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('ResourceRound6Gallery'), 'esbuild parsed the round-6 gallery export');
});

test('ResourceRound7.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'ResourceRound7.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('ResourceRound7Gallery'), 'esbuild parsed the round-7 gallery export');
});
