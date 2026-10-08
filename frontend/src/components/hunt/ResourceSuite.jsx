/**
 * ResourceSuite.jsx — wave 45 (ideas 51786–51800): resource monitoring suite.
 *
 * 15 working components covering every idea, each driving the pure logic in
 * resourceCore.js with real local state. Export-only gallery (not mounted in
 * the app).
 */
import React, { useMemo, useState } from 'react';
import {
  requestCounter, requestRateSeries, bandwidthMeter, cpuPanel, memoryPanel,
  gpuDisplay, tokenTracker, costEstimator, budgetAlerts, moduleResourceSplit,
  resourceHistory, resourceCaps, throttleControls, efficiencyScore,
  wasteDetector, formatBytes,
} from './resourceCore.js';

const RATE_BUCKETS = [
  { sec: 0, count: 42 }, { sec: 1, count: 55 }, { sec: 2, count: 61 },
  { sec: 3, count: 38 }, { sec: 4, count: 66 }, { sec: 5, count: 49 },
];

const MODULES = [
  { name: 'scanner', requests: 18400, tokens: 120000, cost: 2.40, findings: 6 },
  { name: 'fuzzer', requests: 52000, tokens: 40000, cost: 0.80, findings: 0 },
  { name: 'verifier', requests: 3100, tokens: 260000, cost: 5.20, findings: 4 },
  { name: 'recon', requests: 9800, tokens: 30000, cost: 0.60, findings: 2 },
];

/* 51786 — Live request counter */
function RequestCounterCard() {
  const [tick, setTick] = useState(0);
  const c = useMemo(() => requestCounter({ total: 38400 + tick * 137 }, 137), [tick]);
  return (
    <div className="rs5-card">
      <h4>51786 · Live request counter</h4>
      <div className="rs5-big">{c.total.toLocaleString('en-US')}</div>
      <div className="rs5-tiny">{c.text}</div>
      <button className="rs5-btn" onClick={() => setTick((t) => t + 1)}>Tick +137 requests</button>
    </div>
  );
}

/* 51787 — Request-rate graph */
function RequestRateCard() {
  const [cap, setCap] = useState(60);
  const s = useMemo(() => requestRateSeries(RATE_BUCKETS, cap), [cap]);
  const max = Math.max(s.peak, s.capPerSec, 1);
  const line = s.points.map((p, i) => `${(i / Math.max(1, s.points.length - 1)) * 180},${58 - (p.count / max) * 50}`).join(' ');
  const capY = 58 - (s.capPerSec / max) * 50;
  return (
    <div className="rs5-card">
      <h4>51787 · Request-rate graph</h4>
      <label>Cap <input type="range" min="30" max="100" value={cap} onChange={(e) => setCap(+e.target.value)} /> {cap}/s</label>
      <svg className="rs5-spark" viewBox="0 0 180 64">
        <line x1="0" y1={capY} x2="180" y2={capY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />
        <polyline points={line} fill="none" stroke="#38bdf8" strokeWidth="2" />
      </svg>
      <div className="rs5-tiny">{s.text}</div>
    </div>
  );
}

/* 51788 — Bandwidth meter */
function BandwidthCard() {
  const b = useMemo(() => bandwidthMeter([
    { phase: 'Recon', sentBytes: 12 * 1024 * 1024, recvBytes: 210 * 1024 * 1024 },
    { phase: 'Scanning', sentBytes: 85 * 1024 * 1024, recvBytes: 640 * 1024 * 1024 },
    { phase: 'Verification', sentBytes: 4 * 1024 * 1024, recvBytes: 38 * 1024 * 1024 },
  ]), []);
  return (
    <div className="rs5-card">
      <h4>51788 · Bandwidth meter</h4>
      <div className="rs5-duo"><span>↑ {formatBytes(b.sentBytes)}</span><span>↓ {formatBytes(b.recvBytes)}</span></div>
      {b.rows.map((r) => <div key={r.phase} className="rs5-row"><span className="rs5-phase">{r.phase}</span>
        <span className="rs5-bar"><span className="rs5-barfill" style={{ width: `${r.sharePct}%` }} /></span>
        <span className="rs5-tiny">{r.sharePct}% · ↑{formatBytes(r.sentBytes)} ↓{formatBytes(r.recvBytes)}</span></div>)}
      <div className="rs5-tiny">{b.text}</div>
    </div>
  );
}

/* 51789 — CPU usage panel */
function CpuPanelCard() {
  const [load, setLoad] = useState(62);
  const c = useMemo(() => cpuPanel([{ at: 't-2', pct: 48 }, { at: 't-1', pct: 55 }, { at: 'now', pct: load }]), [load]);
  return (
    <div className="rs5-card">
      <h4>51789 · CPU usage panel</h4>
      <label>Current load <input type="range" min="5" max="99" value={load} onChange={(e) => setLoad(+e.target.value)} /> {load}%</label>
      <div className="rs5-big">{c.current}%</div>
      <div className={`rs5-pill rs5-${c.status.replace('-', '')}`}>{c.status}</div>
      <div className="rs5-tiny">{c.text}</div>
    </div>
  );
}

/* 51790 — Memory usage panel */
function MemoryPanelCard() {
  const [used, setUsed] = useState(6.4);
  const m = useMemo(() => memoryPanel({ usedBytes: used * 1024 * 1024 * 1024, limitBytes: 8 * 1024 * 1024 * 1024 }), [used]);
  return (
    <div className="rs5-card">
      <h4>51790 · Memory usage panel</h4>
      <label>Used <input type="range" min="1" max="8" step="0.1" value={used} onChange={(e) => setUsed(+e.target.value)} /> {used} GB</label>
      <div className="rs5-bar"><span className="rs5-barfill" style={{ width: `${m.usedPct}%`, background: m.status === 'healthy' ? '#34d399' : '#ef4444' }} /></div>
      <div className="rs5-tiny">{m.text}</div>
    </div>
  );
}

/* 51791 — GPU usage display */
function GpuDisplayCard() {
  const [util, setUtil] = useState(74);
  const g = useMemo(() => gpuDisplay({ utilPct: util, vramUsedBytes: 5.2 * 1024 * 1024 * 1024, vramTotalBytes: 8 * 1024 * 1024 * 1024, modelName: 'qwen2.5-7b-q4' }), [util]);
  return (
    <div className="rs5-card">
      <h4>51791 · GPU usage display</h4>
      <label>Utilization <input type="range" min="0" max="100" value={util} onChange={(e) => setUtil(+e.target.value)} /> {util}%</label>
      <div className="rs5-big">{g.utilPct}%</div>
      <div className="rs5-tiny">{g.text}</div>
    </div>
  );
}

/* 51792 — Token usage tracker */
function TokenTrackerCard() {
  const t = useMemo(() => tokenTracker([
    { name: 'Verification', tokens: 260000 },
    { name: 'Scanning', tokens: 120000 },
    { name: 'Reporting', tokens: 45000 },
    { name: 'Recon', tokens: 30000 },
  ]), []);
  return (
    <div className="rs5-card">
      <h4>51792 · Token usage tracker</h4>
      <div className="rs5-big">{t.totalTokens.toLocaleString('en-US')}</div>
      {t.rows.map((r) => <div key={r.name} className="rs5-row"><span className="rs5-phase">{r.name}</span>
        <span className="rs5-bar"><span className="rs5-barfill" style={{ width: `${r.sharePct}%` }} /></span>
        <span className="rs5-tiny">{r.tokens.toLocaleString('en-US')} · {r.sharePct}%</span></div>)}
    </div>
  );
}

/* 51793 — Cost estimator */
function CostEstimatorCard() {
  const [tokens, setTokens] = useState(455);
  const c = useMemo(() => costEstimator({ tokens: tokens * 1000, modelRatePerK: 0.002, computeHours: 3.2, computeRatePerH: 0.45, apiCalls: 1840, apiRatePerCall: 0.0002 }), [tokens]);
  return (
    <div className="rs5-card">
      <h4>51793 · Cost estimator</h4>
      <label>Tokens <input type="range" min="50" max="2000" value={tokens} onChange={(e) => setTokens(+e.target.value)} /> {(tokens * 1000).toLocaleString('en-US')}k</label>
      <div className="rs5-big">${c.totalCost.toFixed(2)}</div>
      {c.rows.map((r) => <div key={r.kind} className="rs5-tiny">{r.kind}: ${r.cost.toFixed(4)}</div>)}
    </div>
  );
}

/* 51794 — Budget alerts (mid-hunt) */
function BudgetAlertsCard() {
  const [spent, setSpent] = useState(7.4);
  const b = useMemo(() => budgetAlerts({ spent, budget: 10, thresholds: [50, 80, 100] }), [spent]);
  return (
    <div className="rs5-card">
      <h4>51794 · Budget alerts (mid-hunt)</h4>
      <label>Spent <input type="range" min="0" max="11" step="0.1" value={spent} onChange={(e) => setSpent(+e.target.value)} /> ${spent}</label>
      <div className="rs5-big">{b.usedPct}%</div>
      {b.alerts.length === 0 && <div className="rs5-tiny">Within budget — no alerts.</div>}
      {b.alerts.map((a) => <div key={a.threshold} className={`rs5-note rs5-lvl-${a.level}`}>{a.text}</div>)}
    </div>
  );
}

/* 51795 — Per-module resource split */
function ModuleSplitCard() {
  const s = useMemo(() => moduleResourceSplit(MODULES), []);
  return (
    <div className="rs5-card">
      <h4>51795 · Per-module resource split</h4>
      {s.rows.map((r) => <div key={r.name} className="rs5-row"><span className="rs5-phase">{r.name}</span>
        <span className="rs5-bar"><span className="rs5-barfill" style={{ width: `${r.sharePct}%` }} /></span>
        <span className="rs5-tiny">{r.sharePct}% · ${r.cost.toFixed(2)}</span></div>)}
      <div className="rs5-tiny">{s.text}</div>
    </div>
  );
}

/* 51796 — Resource history */
function ResourceHistoryCard() {
  const h = useMemo(() => resourceHistory([
    { at: '09:00', requests: 4200, tokens: 38000, costPct: 8 },
    { at: '09:30', requests: 9100, tokens: 94000, costPct: 24 },
    { at: '10:00', requests: 15600, tokens: 178000, costPct: 47 },
    { at: '10:30', requests: 12800, tokens: 152000, costPct: 63 },
  ]), []);
  const line = h.points.map((p, i) => `${(i / Math.max(1, h.points.length - 1)) * 180},${58 - (p.tokensNorm / 100) * 50}`).join(' ');
  return (
    <div className="rs5-card">
      <h4>51796 · Resource history</h4>
      <svg className="rs5-spark" viewBox="0 0 180 64"><polyline points={line} fill="none" stroke="#a78bfa" strokeWidth="2" /></svg>
      {h.points.map((p) => <div key={p.at} className="rs5-tiny">{p.at}: {p.requests.toLocaleString('en-US')} req · {(p.tokens / 1000).toFixed(0)}k tokens · {p.costPct}% of budget</div>)}
    </div>
  );
}

/* 51797 — Resource caps */
function ResourceCapsCard() {
  const [cap, setCap] = useState(100000);
  const c = useMemo(() => resourceCaps({
    usage: { requests: 84200, tokens: 455000, cost: 7.4 },
    caps: { requests: cap, tokens: 2000000, cost: 10 },
  }), [cap]);
  return (
    <div className="rs5-card">
      <h4>51797 · Resource caps</h4>
      <label>Request cap <input type="range" min="40000" max="150000" step="1000" value={cap} onChange={(e) => setCap(+e.target.value)} /> {cap.toLocaleString('en-US')}</label>
      {c.rows.map((r) => <div key={r.kind} className={`rs5-note rs5-lvl-${r.action}`}>{r.kind}: {r.used.toLocaleString('en-US')} of {r.limit.toLocaleString('en-US')} ({r.usedPct}%) — {r.action}</div>)}
      <div className="rs5-tiny">{c.text}</div>
    </div>
  );
}

/* 51798 — Throttle controls */
function ThrottleCard() {
  const [rate, setRate] = useState(40);
  const [par, setPar] = useState(3);
  const [tier, setTier] = useState('full');
  const t = useMemo(() => throttleControls({ ratePerSec: rate, maxRatePerSec: 80, parallelism: par, maxParallelism: 8, modelTier: tier }), [rate, par, tier]);
  return (
    <div className="rs5-card">
      <h4>51798 · Throttle controls</h4>
      <label>Rate <input type="range" min="5" max="80" value={rate} onChange={(e) => setRate(+e.target.value)} /> {rate}/s</label>
      <label>Parallelism <input type="range" min="1" max="8" value={par} onChange={(e) => setPar(+e.target.value)} /> {par}</label>
      <select value={tier} onChange={(e) => setTier(e.target.value)}><option value="full">Full model</option><option value="lite">Lite model</option></select>
      <div className="rs5-big">{t.effectiveRate}/s</div>
      <div className="rs5-tiny">{t.text}</div>
    </div>
  );
}

/* 51799 — Resource efficiency score */
function EfficiencyCard() {
  const [findings, setFindings] = useState(12);
  const e = useMemo(() => efficiencyScore({ findings, requests: 84200 }), [findings]);
  return (
    <div className="rs5-card">
      <h4>51799 · Resource efficiency score</h4>
      <label>Findings <input type="range" min="0" max="60" value={findings} onChange={(e) => setFindings(+e.target.value)} /> {findings}</label>
      <div className="rs5-big">{e.per1000}/1k</div>
      <div className={`rs5-pill rs5-${e.band}`}>{e.band}</div>
      <div className="rs5-tiny">{e.text}</div>
    </div>
  );
}

/* 51800 — Waste detector */
function WasteDetectorCard() {
  const w = useMemo(() => wasteDetector(MODULES), []);
  return (
    <div className="rs5-card">
      <h4>51800 · Waste detector</h4>
      {w.flagged.length === 0 && <div className="rs5-tiny">No waste detected.</div>}
      {w.flagged.map((m) => <div key={m.name} className={`rs5-note rs5-lvl-${m.severity}`}>⚠ {m.text}</div>)}
      <div className="rs5-tiny">{w.text}</div>
    </div>
  );
}

export const ResourceSuiteGallery = [
  { id: 51786, name: 'RequestCounterCard', render: <RequestCounterCard /> },
  { id: 51787, name: 'RequestRateCard', render: <RequestRateCard /> },
  { id: 51788, name: 'BandwidthCard', render: <BandwidthCard /> },
  { id: 51789, name: 'CpuPanelCard', render: <CpuPanelCard /> },
  { id: 51790, name: 'MemoryPanelCard', render: <MemoryPanelCard /> },
  { id: 51791, name: 'GpuDisplayCard', render: <GpuDisplayCard /> },
  { id: 51792, name: 'TokenTrackerCard', render: <TokenTrackerCard /> },
  { id: 51793, name: 'CostEstimatorCard', render: <CostEstimatorCard /> },
  { id: 51794, name: 'BudgetAlertsCard', render: <BudgetAlertsCard /> },
  { id: 51795, name: 'ModuleSplitCard', render: <ModuleSplitCard /> },
  { id: 51796, name: 'ResourceHistoryCard', render: <ResourceHistoryCard /> },
  { id: 51797, name: 'ResourceCapsCard', render: <ResourceCapsCard /> },
  { id: 51798, name: 'ThrottleCard', render: <ThrottleCard /> },
  { id: 51799, name: 'EfficiencyCard', render: <EfficiencyCard /> },
  { id: 51800, name: 'WasteDetectorCard', render: <WasteDetectorCard /> },
];

export default ResourceSuiteGallery;
