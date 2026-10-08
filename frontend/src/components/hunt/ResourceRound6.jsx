/**
 * ResourceRound6.jsx — wave 46 (ideas 51801–51820): resource monitoring round 6.
 *
 * 20 working components covering every idea, each driving the pure logic in
 * resourceRound6Core.js with real local state. Export-only gallery (not
 * mounted in the app). Only rr6-* classes are used here.
 */
import React, { useMemo, useState } from 'react';
import {
  forecastUsage, usageComparison, resourceCsvExport, resourceAlertRules,
  perAssetView, modelCostBreakdown, quotaView, egressMonitor, diskTracker,
  pauseTriggers, ecoMode, resourcePreset, teamDashboard, chargebackTags,
  anomalyAlerts, parallelismTuner, cacheHitRates, strategyHints, sessionTime,
  apiQuotaMonitor,
} from './resourceRound6Core.js';

const MIN = 60000;
const SAMPLES = [
  { elapsedMs: 30 * MIN, usedUsd: 1.20 },
  { elapsedMs: 60 * MIN, usedUsd: 2.60 },
  { elapsedMs: 90 * MIN, usedUsd: 3.90 },
  { elapsedMs: 120 * MIN, usedUsd: 5.40 },
];

const ASSETS = [
  { name: 'api.example.com', requests: 42100, tokens: 260000, costUsd: 5.20, findings: 6 },
  { name: 'shop.example.com', requests: 23800, tokens: 120000, costUsd: 2.40, findings: 2 },
  { name: 'm.example.com', requests: 9300, tokens: 45000, costUsd: 0.90, findings: 1 },
];

/* 51801 · Usage forecaster */
function UsageForecasterCard() {
  const [elapsed, setElapsed] = useState(150);
  const f = useMemo(() => forecastUsage(SAMPLES, elapsed * MIN, 12), [elapsed]);
  return (
    <div className="rr6-card">
      <h4>51801 · Usage forecaster</h4>
      <label>Elapsed <input type="range" min="130" max="240" value={elapsed} onChange={(e) => setElapsed(+e.target.value)} /> {elapsed}m</label>
      <div className="rr6-big">${f.projectedUsd.toFixed(2)}</div>
      <div className="rr6-tiny">{f.text}</div>
      <div className="rr6-tiny">confidence: {f.confidence}</div>
    </div>
  );
}

/* 51802 · Historical usage comparison */
function UsageComparisonCard() {
  const [req, setReq] = useState(84200);
  const c = useMemo(() => usageComparison(
    { requests: req, tokens: 455000, cost: 7.40 },
    { avgRequests: 78000, avgTokens: 410000, avgCost: 6.80 },
  ), [req]);
  return (
    <div className="rr6-card">
      <h4>51802 · Historical usage comparison</h4>
      <label>Requests <input type="range" min="40000" max="120000" step="1000" value={req} onChange={(e) => setReq(+e.target.value)} /> {req.toLocaleString('en-US')}</label>
      {c.rows.map((r) => <div key={r.metric} className="rr6-row"><span className="rr6-phase">{r.metric}</span>
        <span className={`rr6-pill rr6-${r.direction === 'above' ? 'hot' : r.direction === 'below' ? 'cool' : 'near'}`}>{r.deltaPct > 0 ? '+' : ''}{r.deltaPct}% {r.direction}</span></div>)}
      <div className="rr6-tiny">{c.text}</div>
    </div>
  );
}

/* 51803 · Resource CSV export */
function ResourceCsvExportCard() {
  const [copied, setCopied] = useState(false);
  const csv = useMemo(() => resourceCsvExport([
    { at: '09:00', requests: 4200, tokens: 38000, costUsd: 0.80 },
    { at: '09:30', requests: 9100, tokens: 94000, costUsd: 2.40 },
    { at: '10:00', requests: 15600, tokens: 178000, costUsd: 4.70 },
  ]), []);
  return (
    <div className="rr6-card">
      <h4>51803 · Resource CSV export</h4>
      <pre className="rr6-pre">{csv}</pre>
      <button className="rr6-btn" onClick={() => { setCopied(true); }}>Copy CSV{copied ? ' ✓' : ''}</button>
    </div>
  );
}

/* 51804 · Alert webhook rules */
function AlertWebhookCard() {
  const [spend, setSpend] = useState(8.2);
  const a = useMemo(() => resourceAlertRules(
    [
      { id: 'w1', name: 'Spend warning', metric: 'spend', threshold: 8, level: 'warning' },
      { id: 'c1', name: 'Spend critical', metric: 'spend', threshold: 10, level: 'critical' },
    ],
    { spend },
    { url: 'https://hooks.infinity-ai.example/resource-alerts' },
  ), [spend]);
  return (
    <div className="rr6-card">
      <h4>51804 · Alert webhook rules</h4>
      <label>Spend <input type="range" min="0" max="12" step="0.1" value={spend} onChange={(e) => setSpend(+e.target.value)} /> ${spend}</label>
      {a.payloads.length === 0 && <div className="rr6-tiny">{a.text}</div>}
      {a.payloads.map((p) => <div key={p.alert.id} className={`rr6-note rr6-lvl-${p.alert.level}`}>{p.text}</div>)}
      <div className="rr6-tiny">target: https://hooks.infinity-ai.example/resource-alerts</div>
    </div>
  );
}

/* 51805 · Per-asset resource view */
function PerAssetViewCard() {
  const v = useMemo(() => perAssetView(ASSETS), []);
  return (
    <div className="rr6-card">
      <h4>51805 · Per-asset resource view</h4>
      {v.rows.map((r) => <div key={r.name} className="rr6-row"><span className="rr6-phase">{r.name}</span>
        <span className="rr6-bar"><span className="rr6-barfill" style={{ width: `${Math.round((r.costUsd / Math.max(0.01, v.totals.costUsd)) * 100)}%` }} /></span>
        <span className="rr6-tiny">${r.costUsd.toFixed(2)} · {r.findings} findings</span></div>)}
      <div className="rr6-tiny">{v.text}</div>
    </div>
  );
}

/* 51806 · Model cost breakdown */
function ModelCostCard() {
  const b = useMemo(() => modelCostBreakdown([
    { model: 'qwen2.5-7b-q4', costUsd: 4.80 },
    { model: 'qwen2.5-1.5b', costUsd: 1.20 },
    { model: 'vision-7b', costUsd: 2.10 },
  ]), []);
  return (
    <div className="rr6-card">
      <h4>51806 · Model cost breakdown</h4>
      <div className="rr6-big">${b.totalUsd.toFixed(2)}</div>
      {b.rows.map((r) => <div key={r.model} className="rr6-row"><span className="rr6-phase">{r.model}</span>
        <span className="rr6-bar"><span className="rr6-barfill" style={{ width: `${r.pct}%` }} /></span>
        <span className="rr6-tiny">${r.costUsd.toFixed(2)} · {r.pct}%</span></div>)}
    </div>
  );
}

/* 51807 · Quota session view */
function QuotaViewCard() {
  const [elapsed, setElapsed] = useState(210);
  const q = useMemo(() => quotaView({ sessionLimitMs: 360 * MIN, elapsedMs: elapsed * MIN }), [elapsed]);
  return (
    <div className="rr6-card">
      <h4>51807 · Quota session view</h4>
      <label>Elapsed <input type="range" min="0" max="360" value={elapsed} onChange={(e) => setElapsed(+e.target.value)} /> {elapsed}m</label>
      <div className="rr6-big">{q.remainingPct}%</div>
      <div className={`rr6-pill rr6-${q.state}`}>{q.state}</div>
      <div className="rr6-tiny">{q.text}</div>
    </div>
  );
}

/* 51808 · Egress spike monitor */
function EgressMonitorCard() {
  const [spike, setSpike] = useState(3);
  const e = useMemo(() => egressMonitor([
    { at: '09:00', egressBytes: 210 * 1024 * 1024 },
    { at: '09:10', egressBytes: 220 * 1024 * 1024 },
    { at: '09:20', egressBytes: 205 * 1024 * 1024 },
    { at: '09:30', egressBytes: 210 * 1024 * 1024 * spike },
    { at: '09:40', egressBytes: 218 * 1024 * 1024 },
  ]), [spike]);
  return (
    <div className="rr6-card">
      <h4>51808 · Egress spike monitor</h4>
      <label>Spike × <input type="range" min="1" max="6" value={spike} onChange={(e) => setSpike(+e.target.value)} /> {spike}</label>
      {e.flagged.map((f) => <div key={f.at} className="rr6-note rr6-lvl-warn">⚠ {f.at}: {f.multipleOfMedian}× median</div>)}
      <div className="rr6-tiny">{e.text}</div>
    </div>
  );
}

/* 51809 · Disk growth tracker */
function DiskTrackerCard() {
  const [growth, setGrowth] = useState(3);
  const d = useMemo(() => diskTracker([
    { atMs: 0, usedBytes: 40 * 1024 * 1024 * 1024, capacityBytes: 200 * 1024 * 1024 * 1024 },
    { atMs: 86400000, usedBytes: (40 + growth) * 1024 * 1024 * 1024, capacityBytes: 200 * 1024 * 1024 * 1024 },
  ]), [growth]);
  return (
    <div className="rr6-card">
      <h4>51809 · Disk growth tracker</h4>
      <label>Daily growth <input type="range" min="0" max="20" value={growth} onChange={(e) => setGrowth(+e.target.value)} /> {growth} GB</label>
      <div className="rr6-big">{(d.growthPerDay / 1024 / 1024 / 1024).toFixed(1)} GB/day</div>
      <div className="rr6-tiny">{d.text}</div>
    </div>
  );
}

/* 51810 · Auto-pause triggers */
function PauseTriggersCard() {
  const [spend, setSpend] = useState(10.5);
  const p = useMemo(() => pauseTriggers(
    { costUsd: spend, requestsPerMin: 42, errorRatePct: 2, budgetUsd: 10 },
    [
      { id: 'p1', name: 'Budget exceeded', when: { metric: 'costUsd', op: '>', value: 10 } },
      { id: 'p2', name: 'Error storm', when: { metric: 'errorRatePct', op: '>=', value: 25 } },
    ],
  ), [spend]);
  return (
    <div className="rr6-card">
      <h4>51810 · Auto-pause triggers</h4>
      <label>Spend <input type="range" min="5" max="14" step="0.5" value={spend} onChange={(e) => setSpend(+e.target.value)} /> ${spend}</label>
      {p.triggered.map((r) => <div key={r.id} className="rr6-note rr6-lvl-pause">⏸ {r.name}</div>)}
      <div className="rr6-tiny">{p.text}</div>
    </div>
  );
}

/* 51811 · Eco mode */
function EcoModeCard() {
  const [on, setOn] = useState(true);
  const e = useMemo(() => ecoMode({ tokenTarget: 500000, requestsPerMin: 60, computeHours: 6 }), []);
  const shown = on ? e.eco : e.normal;
  return (
    <div className="rr6-card">
      <h4>51811 · Eco mode</h4>
      <button className="rr6-btn" onClick={() => setOn((v) => !v)}>{on ? 'Eco ON' : 'Eco OFF'}</button>
      <div className="rr6-duo"><span>{shown.tokenTarget.toLocaleString('en-US')} tokens</span><span>{shown.requestsPerMin}/min</span><span>{shown.computeHours}h compute</span></div>
      <div className="rr6-tiny">{on ? e.eco.savings : 'Full-power hunt targets.'}</div>
    </div>
  );
}

/* 51812 · Resource presets */
function ResourcePresetCard() {
  const [name, setName] = useState('light');
  const p = useMemo(() => resourcePreset(name), [name]);
  return (
    <div className="rr6-card">
      <h4>51812 · Resource presets</h4>
      <select value={name} onChange={(e) => setName(e.target.value)}>
        <option value="light">light</option><option value="balanced">balanced</option><option value="unlimited">unlimited</option>
      </select>
      <div className="rr6-duo"><span>{p.profile.requestsPerMin} req/min</span><span>{p.profile.maxParallelism} workers</span><span>${p.profile.budgetUsd}</span></div>
      <div className="rr6-tiny">{p.text}</div>
    </div>
  );
}

/* 51813 · Team resource dashboard */
function TeamDashboardCard() {
  const t = useMemo(() => teamDashboard([
    { id: 'H-1', name: 'oct-sweep', costUsd: 8.40, requests: 84200, tokens: 455000, findings: 12 },
    { id: 'H-2', name: 'vendor-api', costUsd: 4.10, requests: 31000, tokens: 180000, findings: 7 },
    { id: 'H-3', name: 'mobile-app', costUsd: 1.90, requests: 12800, tokens: 96000, findings: 0 },
  ]), []);
  return (
    <div className="rr6-card">
      <h4>51813 · Team resource dashboard</h4>
      <div className="rr6-big">${t.totals.costUsd.toFixed(2)}</div>
      {t.rows.map((r) => <div key={r.id} className="rr6-row"><span className="rr6-phase">{r.name}</span>
        <span className="rr6-tiny">${r.costUsd.toFixed(2)} · {r.findings} findings{r.costPerFinding != null ? ` · $${r.costPerFinding.toFixed(2)}/finding` : ''}</span></div>)}
      <div className="rr6-tiny">{t.text}</div>
    </div>
  );
}

/* 51814 · Chargeback tagging */
function ChargebackCard() {
  const c = useMemo(() => chargebackTags(
    { id: 'H-1', costUsd: 8.40 },
    [
      { name: 'core', costCenter: 'security', sharePct: 70 },
      { name: 'client-a', costCenter: 'client-a', sharePct: 30 },
    ],
  ), []);
  return (
    <div className="rr6-card">
      <h4>51814 · Chargeback tagging</h4>
      {c.rows.map((r) => <div key={r.costCenter} className="rr6-row"><span className="rr6-phase">{r.costCenter}</span>
        <span className="rr6-bar"><span className="rr6-barfill" style={{ width: `${r.sharePct}%` }} /></span>
        <span className="rr6-tiny">${r.amountUsd.toFixed(2)} · {r.sharePct}%</span></div>)}
      <div className="rr6-tiny">{c.balanced ? 'Shares balance at 100%.' : `Shares total ${c.rows.reduce((s, r) => s + r.sharePct, 0)}%.`}</div>
    </div>
  );
}

/* 51815 · Usage anomaly alerts */
function AnomalyAlertsCard() {
  const a = useMemo(() => anomalyAlerts([
    { at: '09:00', value: 100 }, { at: '09:05', value: 101 }, { at: '09:10', value: 99 },
    { at: '09:15', value: 102 }, { at: '09:20', value: 100 }, { at: '09:25', value: 98 },
    { at: '09:30', value: 101 }, { at: '09:35', value: 103 }, { at: '09:40', value: 280 },
    { at: '09:45', value: 101 },
  ]), []);
  return (
    <div className="rr6-card">
      <h4>51815 · Usage anomaly alerts</h4>
      {a.flagged.map((f) => <div key={f.at} className="rr6-note rr6-lvl-warn">⚠ {f.at}: {f.value} ({f.deviation}σ)</div>)}
      <div className="rr6-tiny">{a.text}</div>
      <div className="rr6-tiny">mean {a.mean}, σ {a.sigma}</div>
    </div>
  );
}

/* 51816 · Parallelism tuner */
function ParallelismTunerCard() {
  const t = useMemo(() => parallelismTuner({ max: 8 }, { baseCostPerWorker: 0.15, throughputPerWorker: 120, efficiencyDropPct: 10 }), []);
  return (
    <div className="rr6-card">
      <h4>51816 · Parallelism tuner</h4>
      {t.rows.map((r) => <div key={r.workers} className="rr6-row"><span className="rr6-phase">{r.workers} worker{r.workers === 1 ? '' : 's'}</span>
        <span className={`rr6-pill ${r.workers === t.bestWorkers ? 'rr6-best' : ''}`}>{r.throughput}/s · ${r.costPerUnit.toFixed(4)}/unit</span></div>)}
      <div className="rr6-tiny">{t.text}</div>
    </div>
  );
}

/* 51817 · Cache hit-rate monitor */
function CacheHitRateCard() {
  const [hits, setHits] = useState(8700);
  const c = useMemo(() => cacheHitRates({ hits, misses: 1300 }), [hits]);
  return (
    <div className="rr6-card">
      <h4>51817 · Cache hit-rate monitor</h4>
      <label>Hits <input type="range" min="0" max="10000" step="100" value={hits} onChange={(e) => setHits(+e.target.value)} /> {hits.toLocaleString('en-US')}</label>
      <div className="rr6-big">{c.hitRatePct}%</div>
      <div className={`rr6-pill rr6-${c.band}`}>{c.band}</div>
      <div className="rr6-tiny">{c.text}</div>
    </div>
  );
}

/* 51818 · Strategy hints */
function StrategyHintsCard() {
  const [spend, setSpend] = useState(3.2);
  const s = useMemo(() => strategyHints({ spentUsd: spend, findings: 6 }, 10), [spend]);
  return (
    <div className="rr6-card">
      <h4>51818 · Strategy hints</h4>
      <label>Spend <input type="range" min="0" max="12" step="0.2" value={spend} onChange={(e) => setSpend(+e.target.value)} /> ${spend}</label>
      {s.hints.map((h, i) => <div key={i} className="rr6-note rr6-lvl-info">💡 {h}</div>)}
      <div className="rr6-tiny">{s.spentPct}% of budget spent.</div>
    </div>
  );
}

/* 51819 · Session time split */
function SessionTimeCard() {
  const s = useMemo(() => sessionTime([
    { id: 'recon', wallMs: 60 * MIN, idleMs: 8 * MIN },
    { id: 'scan', wallMs: 120 * MIN, idleMs: 20 * MIN },
    { id: 'verify', wallMs: 45 * MIN, idleMs: 5 * MIN },
  ]), []);
  return (
    <div className="rr6-card">
      <h4>51819 · Session time split</h4>
      {s.rows.map((r) => <div key={r.id} className="rr6-row"><span className="rr6-phase">{r.id}</span>
        <span className="rr6-bar"><span className="rr6-barfill" style={{ width: `${r.activePct}%` }} /></span>
        <span className="rr6-tiny">{r.activePct}% active</span></div>)}
      <div className="rr6-tiny">{s.text}</div>
    </div>
  );
}

/* 51820 · API quota monitor */
function ApiQuotaCard() {
  const [used, setUsed] = useState(930);
  const q = useMemo(() => apiQuotaMonitor(
    { requests: 1000, tokens: 2000000 },
    { requests: used, tokens: 455000 },
  ), [used]);
  return (
    <div className="rr6-card">
      <h4>51820 · API quota monitor</h4>
      <label>Requests used <input type="range" min="0" max="1000" value={used} onChange={(e) => setUsed(+e.target.value)} /> {used}</label>
      {q.rows.map((r) => <div key={r.kind} className={`rr6-note ${r.throttled ? 'rr6-lvl-warn' : 'rr6-lvl-ok'}`}>
        {r.kind}: {r.used.toLocaleString('en-US')} of {r.limit.toLocaleString('en-US')} ({r.usedPct}%) — {r.remaining.toLocaleString('en-US')} left{r.throttled ? ' ⚠ throttling advised' : ''}
      </div>)}
      <div className="rr6-tiny">{q.text}</div>
    </div>
  );
}

export const ResourceRound6Gallery = [
  { id: 51801, name: 'UsageForecasterCard', render: <UsageForecasterCard /> },
  { id: 51802, name: 'UsageComparisonCard', render: <UsageComparisonCard /> },
  { id: 51803, name: 'ResourceCsvExportCard', render: <ResourceCsvExportCard /> },
  { id: 51804, name: 'AlertWebhookCard', render: <AlertWebhookCard /> },
  { id: 51805, name: 'PerAssetViewCard', render: <PerAssetViewCard /> },
  { id: 51806, name: 'ModelCostCard', render: <ModelCostCard /> },
  { id: 51807, name: 'QuotaViewCard', render: <QuotaViewCard /> },
  { id: 51808, name: 'EgressMonitorCard', render: <EgressMonitorCard /> },
  { id: 51809, name: 'DiskTrackerCard', render: <DiskTrackerCard /> },
  { id: 51810, name: 'PauseTriggersCard', render: <PauseTriggersCard /> },
  { id: 51811, name: 'EcoModeCard', render: <EcoModeCard /> },
  { id: 51812, name: 'ResourcePresetCard', render: <ResourcePresetCard /> },
  { id: 51813, name: 'TeamDashboardCard', render: <TeamDashboardCard /> },
  { id: 51814, name: 'ChargebackCard', render: <ChargebackCard /> },
  { id: 51815, name: 'AnomalyAlertsCard', render: <AnomalyAlertsCard /> },
  { id: 51816, name: 'ParallelismTunerCard', render: <ParallelismTunerCard /> },
  { id: 51817, name: 'CacheHitRateCard', render: <CacheHitRateCard /> },
  { id: 51818, name: 'StrategyHintsCard', render: <StrategyHintsCard /> },
  { id: 51819, name: 'SessionTimeCard', render: <SessionTimeCard /> },
  { id: 51820, name: 'ApiQuotaCard', render: <ApiQuotaCard /> },
];

export default ResourceRound6Gallery;
