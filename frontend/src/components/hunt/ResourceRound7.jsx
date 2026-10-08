/**
 * ResourceRound7.jsx — wave 46 (ideas 51821–51840): resource monitoring round 7.
 *
 * 20 working components covering every idea, each driving the pure logic in
 * resourceRound7Core.js with real local state. Export-only gallery (not
 * mounted in the app). Only rr7-* classes are used here.
 */
import React, { useMemo, useState } from 'react';
import {
  resourceLeaderboard, resourceRetrospective, costTicker, budgetTopUp,
  resourceGuardrails, usageHeatmap, resourceVoiceQuery, mobileResourcePayload,
  multiHuntResourceBoard, resourceExportSchedule, carbonEstimate, resourceSharing,
  idleResourceDisplay, resourcePrediction, spendByFinding, resourceQuotaApi,
  alertRouting, historicalTrends, awareScheduling, oneClickResourceReport,
} from './resourceRound7Core.js';

const HUNTS = [
  { id: 'H-1', name: 'oct-sweep', costUsd: 8.40, budgetUsd: 10, requests: 84200, findings: 12 },
  { id: 'H-2', name: 'vendor-api', costUsd: 4.10, budgetUsd: 10, requests: 31000, findings: 7 },
  { id: 'H-3', name: 'mobile-app', costUsd: 6.20, budgetUsd: 10, requests: 52900, findings: 3 },
];

/* 51821 · Resource efficiency leaderboard */
function LeaderboardCard() {
  const l = useMemo(() => resourceLeaderboard(HUNTS), []);
  return (
    <div className="rr7-card">
      <h4>51821 · Resource efficiency leaderboard</h4>
      {l.rows.map((r, i) => <div key={r.id} className="rr7-row"><span className="rr7-phase">#{i + 1} {r.name}</span>
        <span className="rr7-big">{r.findingsPerUsd}</span>
        <span className="rr7-tiny">findings/USD · ${r.costUsd.toFixed(2)}</span></div>)}
      <div className="rr7-tiny">{l.text}</div>
    </div>
  );
}

/* 51822 · Resource retrospective */
function RetrospectiveCard() {
  const r = useMemo(() => resourceRetrospective({ id: 'H-1', costUsd: 8.40, budgetUsd: 10, requests: 84200, tokens: 455000, findings: 12, wallMs: 225 * 60000 }), []);
  return (
    <div className="rr7-card">
      <h4>51822 · Resource retrospective</h4>
      <div className="rr7-tiny">{r.text}</div>
      {r.tips.map((t, i) => <div key={i} className="rr7-note rr7-lvl-info">💡 {t}</div>)}
    </div>
  );
}

/* 51823 · Live cost ticker */
function CostTickerCard() {
  const [events, setEvents] = useState([
    { at: '09:00', amountUsd: 0.80 },
    { at: '09:30', amountUsd: 1.60 },
    { at: '10:00', amountUsd: 2.30 },
  ]);
  const t = useMemo(() => costTicker(events), [events]);
  return (
    <div className="rr7-card">
      <h4>51823 · Live cost ticker</h4>
      <div className="rr7-big">${t.totalUsd.toFixed(2)}</div>
      {t.points.map((p, i) => <div key={`${p.at}-${i}`} className="rr7-tiny">{p.at}: +${p.amountUsd.toFixed(2)} → ${p.cumulativeUsd.toFixed(2)}</div>)}
      <button className="rr7-btn" onClick={() => setEvents((es) => [...es, { at: '10:30', amountUsd: 0.75 }])}>+ $0.75 event</button>
    </div>
  );
}

/* 51824 · Budget top-up */
function BudgetTopUpCard() {
  const [amount, setAmount] = useState(5);
  const b = useMemo(() => budgetTopUp({ currentUsd: 10 }, amount, Date.now()), [amount]);
  return (
    <div className="rr7-card">
      <h4>51824 · Budget top-up</h4>
      <label>Top-up <input type="range" min="0" max="50" step="1" value={amount} onChange={(e) => setAmount(+e.target.value)} /> ${amount}</label>
      <div className="rr7-big">${b.newUsd.toFixed(2)}</div>
      <div className="rr7-tiny">{b.text}</div>
      <div className="rr7-tiny">audit: ${b.previousUsd.toFixed(2)} + ${b.addedUsd.toFixed(2)}</div>
    </div>
  );
}

/* 51825 · Resource guardrails */
function GuardrailsCard() {
  const [spend, setSpend] = useState(9.1);
  const g = useMemo(() => resourceGuardrails(
    [
      { id: 'g1', name: 'Spend cap', metric: 'spend', op: '>=', threshold: 9, level: 'warning' },
      { id: 'g2', name: 'Hard spend stop', metric: 'spend', op: '>=', threshold: 12, level: 'critical' },
      { id: 'g3', name: 'Rate over limit', metric: 'rate', op: '>', threshold: 200, level: 'info' },
    ],
    { spend, rate: 64 },
  ), [spend]);
  return (
    <div className="rr7-card">
      <h4>51825 · Resource guardrails</h4>
      <label>Spend <input type="range" min="0" max="13" step="0.1" value={spend} onChange={(e) => setSpend(+e.target.value)} /> ${spend}</label>
      {g.rows.map((r) => <div key={r.id} className={`rr7-note ${r.state === 'tripped' ? `rr7-lvl-${r.level}` : 'rr7-lvl-ok'}`}>{r.state === 'tripped' ? '🚧' : '✓'} {r.name} — {r.state}</div>)}
      <div className="rr7-tiny">{g.text}</div>
    </div>
  );
}

/* 51826 · Usage heatmap */
function UsageHeatmapCard() {
  const h = useMemo(() => usageHeatmap([
    { row: 'recon', col: 0, value: 4000 }, { row: 'recon', col: 1, value: 8000 },
    { row: 'scan', col: 0, value: 42000 }, { row: 'scan', col: 1, value: 38000 },
    { row: 'verify', col: 0, value: 12000 }, { row: 'verify', col: 1, value: 15000 },
  ]), []);
  return (
    <div className="rr7-card">
      <h4>51826 · Usage heatmap</h4>
      {h.rows.map((r) => <div key={r.row} className="rr7-row"><span className="rr7-phase">{r.row}</span>
        {r.cells.map((c, i) => <span key={i} className="rr7-heat" style={{ background: `rgba(56,189,248,${0.1 + c.intensity * 0.9})` }}>{(c.intensity * 100).toFixed(0)}%</span>)}</div>)}
      <div className="rr7-tiny">{h.text}</div>
    </div>
  );
}

/* 51827 · Resource voice query */
function VoiceQueryCard() {
  const [q, setQ] = useState('how much have we spent?');
  const usage = { spentUsd: 8.40, budgetUsd: 10, requests: 84200, tokens: 455000, findings: 12 };
  const answer = useMemo(() => resourceVoiceQuery(q, usage), [q]);
  return (
    <div className="rr7-card">
      <h4>51827 · Resource voice query</h4>
      <input className="rr7-input" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rr7-note rr7-lvl-info">🗣 "{answer}"</div>
    </div>
  );
}

/* 51828 · Mobile resource payload */
function MobilePayloadCard() {
  const p = useMemo(() => mobileResourcePayload({ spentUsd: 8.40, budgetUsd: 10, requests: 84200, tokens: 455000, findings: 12, quotaPct: 42 }), []);
  const bytes = useMemo(() => JSON.stringify(p).length, [p]);
  return (
    <div className="rr7-card">
      <h4>51828 · Mobile resource payload</h4>
      <pre className="rr7-pre">{JSON.stringify(p)}</pre>
      <div className="rr7-tiny">payload size: {bytes} bytes</div>
    </div>
  );
}

/* 51829 · Multi-hunt resource board */
function MultiHuntBoardCard() {
  const b = useMemo(() => multiHuntResourceBoard(HUNTS), []);
  return (
    <div className="rr7-card">
      <h4>51829 · Multi-hunt resource board</h4>
      {b.rows.map((r) => <div key={r.id} className="rr7-row"><span className="rr7-phase">{r.name}</span>
        <span className="rr7-bar"><span className="rr7-barfill" style={{ width: `${r.budgetPct}%` }} /></span>
        <span className="rr7-tiny">${r.spentUsd.toFixed(2)} · {r.budgetPct}% · {r.findings} findings{r.costPerFinding != null ? ` · $${r.costPerFinding.toFixed(2)}/finding` : ''}</span></div>)}
      <div className="rr7-tiny">{b.text}</div>
    </div>
  );
}

/* 51830 · Resource export schedule */
function ExportScheduleCard() {
  const [cadence, setCadence] = useState('daily');
  const s = useMemo(() => resourceExportSchedule({ id: 'H-1' }, { cadence, hourUtc: 9, recipients: ['owner@infinity-ai.example'], format: 'pdf' }), [cadence]);
  return (
    <div className="rr7-card">
      <h4>51830 · Resource export schedule</h4>
      <select value={cadence} onChange={(e) => setCadence(e.target.value)}><option value="daily">daily</option><option value="weekly">weekly</option></select>
      <div className="rr7-tiny">{s.text}</div>
      <div className="rr7-tiny">recipients: {s.recipients.join(', ')} · {s.enabled ? 'enabled' : 'disabled'}</div>
    </div>
  );
}

/* 51831 · Carbon footprint estimate */
function CarbonCard() {
  const [kwh, setKwh] = useState(12);
  const c = useMemo(() => carbonEstimate(kwh), [kwh]);
  return (
    <div className="rr7-card">
      <h4>51831 · Carbon footprint estimate</h4>
      <label>Energy <input type="range" min="0" max="60" value={kwh} onChange={(e) => setKwh(+e.target.value)} /> {kwh} kWh</label>
      <div className="rr7-big">{c.kgCO2e.toFixed(2)} kg</div>
      <div className={`rr7-pill rr7-${c.rating}`}>{c.rating} CO₂e</div>
      <div className="rr7-tiny">{c.text}</div>
    </div>
  );
}

/* 51832 · Shared resource pools */
function SharingCard() {
  const s = useMemo(() => resourceSharing([
    { id: 'pool-a', name: 'Core hunts', budgetUsd: 30, assignedHunts: ['H-1', 'H-2', 'H-3'] },
    { id: 'pool-b', name: 'Client pilots', budgetUsd: 12, assignedHunts: ['H-4'] },
  ]), []);
  return (
    <div className="rr7-card">
      <h4>51832 · Shared resource pools</h4>
      {s.rows.map((r) => <div key={r.id} className="rr7-row"><span className="rr7-phase">{r.name}</span>
        <span className="rr7-tiny">${r.budgetUsd.toFixed(2)} across {r.hunts} hunts → ${r.perHuntUsd.toFixed(2)}/hunt</span></div>)}
      <div className="rr7-tiny">{s.text}</div>
    </div>
  );
}

/* 51833 · Idle resource display */
function IdleResourceCard() {
  const i = useMemo(() => idleResourceDisplay([
    { id: 'H-9', name: 'paused-api', pausedAtMs: Date.now() - 3 * 86400000, idleCostPerDayUsd: 0.40, nowMs: Date.now() },
    { id: 'H-10', name: 'paused-web', pausedAtMs: Date.now() - 0.5 * 86400000, idleCostPerDayUsd: 0.25, nowMs: Date.now() },
  ]), []);
  return (
    <div className="rr7-card">
      <h4>51833 · Idle resource display</h4>
      {i.rows.map((r) => <div key={r.id} className="rr7-row"><span className="rr7-phase">{r.name}</span>
        <span className="rr7-tiny">${r.idleCostUsd.toFixed(2)} over {r.pausedDays} days paused</span></div>)}
      <div className="rr7-tiny">{i.text}</div>
    </div>
  );
}

/* 51834 · Early-data prediction */
function EarlyPredictionCard() {
  const p = useMemo(() => resourcePrediction(
    [
      { atMs: 0, usedUsd: 0.20 },
      { atMs: 300000, usedUsd: 0.55 },
      { atMs: 600000, usedUsd: 0.90 },
    ],
    240 * 60000,
  ), []);
  return (
    <div className="rr7-card">
      <h4>51834 · Early-data prediction</h4>
      <div className="rr7-big">${p.projectedUsd.toFixed(2)}</div>
      <div className="rr7-tiny">confidence: {p.confidence} · method: {p.method}</div>
      <div className="rr7-tiny">{p.text}</div>
    </div>
  );
}

/* 51835 · Spend per finding */
function SpendByFindingCard() {
  const [findings, setFindings] = useState(12);
  const s = useMemo(() => spendByFinding(8.40, findings), [findings]);
  return (
    <div className="rr7-card">
      <h4>51835 · Spend per finding</h4>
      <label>Findings <input type="range" min="0" max="40" value={findings} onChange={(e) => setFindings(+e.target.value)} /> {findings}</label>
      <div className="rr7-big">{s.perFindingUsd != null ? `$${s.perFindingUsd.toFixed(2)}` : '—'}</div>
      <div className="rr7-tiny">{s.text}</div>
    </div>
  );
}

/* 51836 · Resource quota API */
function QuotaApiCard() {
  const [spent, setSpent] = useState(8.40);
  const q = useMemo(() => resourceQuotaApi({ spentUsd: spent, limitUsd: 10 }), [spent]);
  return (
    <div className="rr7-card">
      <h4>51836 · Resource quota API</h4>
      <label>Spent <input type="range" min="0" max="12" step="0.1" value={spent} onChange={(e) => setSpent(+e.target.value)} /> ${spend}</label>
      <pre className="rr7-pre">{JSON.stringify({ ok: q.ok, remainingUsd: q.remainingUsd, usedPct: q.usedPct }, null, 2)}</pre>
      <div className="rr7-tiny">{q.text}</div>
    </div>
  );
}

/* 51837 · Alert routing */
function AlertRoutingCard() {
  const [level, setLevel] = useState('critical');
  const r = useMemo(() => alertRouting(
    { id: 'al-1', level },
    [
      { level: 'critical', recipients: ['oncall@infinity-ai.example'] },
      { level: 'warning', recipients: ['team@infinity-ai.example'] },
      { level: 'default', recipients: ['ops@infinity-ai.example'] },
    ],
  ), [level]);
  return (
    <div className="rr7-card">
      <h4>51837 · Alert routing</h4>
      <select value={level} onChange={(e) => setLevel(e.target.value)}>
        <option value="critical">critical</option><option value="warning">warning</option><option value="info">info</option>
      </select>
      <div className="rr7-tiny">{r.text}</div>
      <div className="rr7-tiny">routed: {r.routed ? 'yes' : 'no'} → {(r.recipients || []).join(', ') || '—'}</div>
    </div>
  );
}

/* 51838 · Historical efficiency trends */
function HistoricalTrendsCard() {
  const t = useMemo(() => historicalTrends([
    { label: 'Aug', costUsd: 40, findings: 22 },
    { label: 'Sep', costUsd: 38, findings: 30 },
    { label: 'Oct', costUsd: 36, findings: 34 },
  ]), []);
  const maxEff = Math.max(1, ...t.rows.map((x) => x.findingsPerUsd));
  const line = t.rows.map((r, i) => `${(i / Math.max(1, t.rows.length - 1)) * 180},${58 - (r.findingsPerUsd / maxEff) * 50}`).join(' ');
  return (
    <div className="rr7-card">
      <h4>51838 · Historical efficiency trends</h4>
      <svg className="rr7-spark" viewBox="0 0 180 64"><polyline points={line} fill="none" stroke="#38bdf8" strokeWidth="2" /></svg>
      {t.rows.map((r) => <div key={r.label} className="rr7-tiny">{r.label}: {r.findingsPerUsd} findings/USD</div>)}
      <div className="rr7-tiny">{t.text}</div>
    </div>
  );
}

/* 51839 · Off-peak scheduling */
function AwareSchedulingCard() {
  const s = useMemo(() => awareScheduling(
    [
      { id: 'H-1', name: 'oct-sweep', heavyWork: 'high' },
      { id: 'H-2', name: 'vendor-api', heavyWork: 'low' },
    ],
    [
      { label: '02:00–06:00 UTC', offPeak: true, discountPct: 30 },
      { label: '12:00–18:00 UTC', offPeak: false, discountPct: 0 },
    ],
  ), []);
  return (
    <div className="rr7-card">
      <h4>51839 · Off-peak scheduling</h4>
      {s.suggestions.map((x) => <div key={x.huntId} className="rr7-note rr7-lvl-info">⏱ {x.huntName}: {x.windows.map((w) => `${w.label} (−${w.discountPct}%)`).join(', ')}</div>)}
      <div className="rr7-tiny">{s.text}</div>
    </div>
  );
}

/* 51840 · One-click resource report */
function OneClickReportCard() {
  const [attached, setAttached] = useState(false);
  const r = useMemo(() => oneClickResourceReport({ id: 'H-1', name: 'oct-sweep', costUsd: 8.40, findings: 12, durationMs: 225 * 60000 }), []);
  return (
    <div className="rr7-card">
      <h4>51840 · One-click resource report</h4>
      {r.sections.map((sec) => <div key={sec.name} className="rr7-row"><span className="rr7-phase">{sec.name}</span><span className="rr7-tiny">{sec.detail}</span></div>)}
      <button className="rr7-btn" onClick={() => setAttached(true)}>Attach to final report{attached ? ' ✓' : ''}</button>
      {attached && <div className="rr7-tiny">{r.attachment.filename} attached.</div>}
      <div className="rr7-tiny">{r.text}</div>
    </div>
  );
}

export const ResourceRound7Gallery = [
  { id: 51821, name: 'LeaderboardCard', render: <LeaderboardCard /> },
  { id: 51822, name: 'RetrospectiveCard', render: <RetrospectiveCard /> },
  { id: 51823, name: 'CostTickerCard', render: <CostTickerCard /> },
  { id: 51824, name: 'BudgetTopUpCard', render: <BudgetTopUpCard /> },
  { id: 51825, name: 'GuardrailsCard', render: <GuardrailsCard /> },
  { id: 51826, name: 'UsageHeatmapCard', render: <UsageHeatmapCard /> },
  { id: 51827, name: 'VoiceQueryCard', render: <VoiceQueryCard /> },
  { id: 51828, name: 'MobilePayloadCard', render: <MobilePayloadCard /> },
  { id: 51829, name: 'MultiHuntBoardCard', render: <MultiHuntBoardCard /> },
  { id: 51830, name: 'ExportScheduleCard', render: <ExportScheduleCard /> },
  { id: 51831, name: 'CarbonCard', render: <CarbonCard /> },
  { id: 51832, name: 'SharingCard', render: <SharingCard /> },
  { id: 51833, name: 'IdleResourceCard', render: <IdleResourceCard /> },
  { id: 51834, name: 'EarlyPredictionCard', render: <EarlyPredictionCard /> },
  { id: 51835, name: 'SpendByFindingCard', render: <SpendByFindingCard /> },
  { id: 51836, name: 'QuotaApiCard', render: <QuotaApiCard /> },
  { id: 51837, name: 'AlertRoutingCard', render: <AlertRoutingCard /> },
  { id: 51838, name: 'HistoricalTrendsCard', render: <HistoricalTrendsCard /> },
  { id: 51839, name: 'AwareSchedulingCard', render: <AwareSchedulingCard /> },
  { id: 51840, name: 'OneClickReportCard', render: <OneClickReportCard /> },
];

export default ResourceRound7Gallery;
