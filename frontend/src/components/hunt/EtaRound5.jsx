/**
 * EtaRound5.jsx — wave 45 (ideas 51761–51785): second ETA suite.
 *
 * 25 working components covering every idea, each driving the pure logic in
 * etaRound5Core.js with real local state (sliders/buttons/inputs producing
 * live computed output). Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  etaRecalcLog, timeToFirstFinding, idleTimeAccounting, activeTimeCounter,
  etaExportPayload, multiHuntEtas, etaPrioritization, wrapUpEta, approvalEta,
  testRequestEta, overnightEta, etaTimezone, etaTabTitle, etaMilestones,
  etaDriftAlerts, etaScenarioPlanner, etaLearning, subAgentEtas, etaApi,
  etaDashboard, etaFairness, etaAutoscale, etaFreeze, etaRetrospective,
  countdownVoiceScript, formatDuration,
} from './etaRound5Core.js';

const MIN = 60000;
const NOW = 1728288000000; // fixed fixture epoch (2024-10-07T08:00:00Z)

const RECALCS = [
  { at: '09:00', estimateMs: 170 * MIN, cause: 'hunt started' },
  { at: '09:30', estimateMs: 160 * MIN, cause: 'recon finished early' },
  { at: '10:00', estimateMs: 148 * MIN, cause: 'added subnet api-east' },
  { at: '10:30', estimateMs: 152 * MIN, cause: 'waiting on approval' },
];

const HUNTS = [
  { id: 'H-1', name: 'oct-sweep', remainingMs: 110 * MIN, finishAtMs: NOW + 110 * MIN, pctComplete: 31 },
  { id: 'H-2', name: 'vendor-api', remainingMs: 64 * MIN, finishAtMs: NOW + 64 * MIN, pctComplete: 58 },
  { id: 'H-3', name: 'mobile-app', remainingMs: 205 * MIN, finishAtMs: NOW + 205 * MIN, pctComplete: 12 },
];

/* 51761 — ETA recalculation log */
function RecalcLogCard() {
  const log = useMemo(() => etaRecalcLog(RECALCS), []);
  return (
    <div className="et5-card">
      <h4>51761 · ETA recalculation log</h4>
      {log.map((e, i) => <div key={i} className="et5-tiny">{e.text}</div>)}
    </div>
  );
}

/* 51762 — Time-to-first-finding */
function TimeToFirstFindingCard() {
  const [hist, setHist] = useState(45);
  const t = useMemo(() => timeToFirstFinding({ startedAtMs: NOW - 30 * MIN, firstFindingAtMs: NOW, historyAvgMs: hist * MIN }), [hist]);
  return (
    <div className="et5-card">
      <h4>51762 · Time-to-first-finding</h4>
      <label>Historical avg <input type="range" min="10" max="120" value={hist} onChange={(e) => setHist(+e.target.value)} /> {hist}m</label>
      <div className="et5-big">{formatDuration(t.firstFindingMs)}</div>
      <div className="et5-tiny">{t.text}</div>
    </div>
  );
}

/* 51763 — Idle-time accounting */
function IdleTimeCard() {
  const [pause, setPause] = useState(20);
  const t = useMemo(() => idleTimeAccounting({
    totalWallMs: 180 * MIN,
    segments: [
      { kind: 'active', ms: 140 * MIN },
      { kind: 'paused', ms: pause * MIN },
      { kind: 'awaiting-approval', ms: 14 * MIN },
      { kind: 'awaiting-test', ms: 6 * MIN },
    ],
  }), [pause]);
  return (
    <div className="et5-card">
      <h4>51763 · Idle-time accounting</h4>
      <label>Paused <input type="range" min="0" max="60" value={pause} onChange={(e) => setPause(+e.target.value)} /> {pause}m</label>
      <div className="et5-big">{t.idlePct}%</div>
      <div className="et5-tiny">{t.text}</div>
    </div>
  );
}

/* 51764 — Active-time counter */
function ActiveTimeCard() {
  const a = useMemo(() => activeTimeCounter({ totalWallMs: 180 * MIN, pausedMs: 20 * MIN, approvalWaitMs: 14 * MIN, testWaitMs: 6 * MIN }), []);
  return (
    <div className="et5-card">
      <h4>51764 · Active-time counter</h4>
      <div className="et5-big">{formatDuration(a.activeMs)}</div>
      <div className="et5-tiny">{a.text}</div>
    </div>
  );
}

/* 51765 — ETA export */
function EtaExportCard() {
  const p = useMemo(() => etaExportPayload({ huntId: 'H-1', exportedAtMs: NOW, etaMs: 110 * MIN, finishAtMs: NOW + 110 * MIN, timezone: 'IST', pctComplete: 31, recalculations: RECALCS }), []);
  const [fmt, setFmt] = useState('json');
  return (
    <div className="et5-card">
      <h4>51765 · ETA export</h4>
      <select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="json">JSON</option><option value="csv">CSV</option></select>
      <div className="et5-pre">{fmt === 'json' ? p.json.slice(0, 260) + '…' : p.csv}</div>
    </div>
  );
}

/* 51766 — Multi-hunt ETAs */
function MultiHuntCard() {
  const b = useMemo(() => multiHuntEtas(HUNTS), []);
  return (
    <div className="et5-card">
      <h4>51766 · Multi-hunt ETAs</h4>
      {b.rows.map((h) => <div key={h.id} className="et5-row"><span className="et5-phase">{h.name}</span> <b>{formatDuration(h.remainingMs)}</b> <span className="et5-tiny">{h.pctComplete}%</span></div>)}
      <div className="et5-tiny">{b.text}</div>
    </div>
  );
}

/* 51767 — ETA-based prioritization */
function PrioritizationCard() {
  const [budget, setBudget] = useState(110);
  const plan = useMemo(() => etaPrioritization([
    { id: 'a', title: 'SSRF proof on api-east', expectedMs: 40 * MIN, valueScore: 90 },
    { id: 'b', title: 'Header sweep', expectedMs: 20 * MIN, valueScore: 30 },
    { id: 'c', title: 'IDOR chain check', expectedMs: 60 * MIN, valueScore: 85 },
    { id: 'd', title: 'Subdomain re-scan', expectedMs: 45 * MIN, valueScore: 40 },
  ], budget * MIN), [budget]);
  return (
    <div className="et5-card">
      <h4>51767 · ETA-based prioritization</h4>
      <label>Remaining <input type="range" min="30" max="180" value={budget} onChange={(e) => setBudget(+e.target.value)} /> {budget}m</label>
      {plan.fits.map((f) => <div key={f.id} className="et5-note">✓ {f.title} — {formatDuration(f.expectedMs)}</div>)}
      {plan.deferred.map((d) => <div key={d.id} className="et5-tiny">✕ {d.title} — deferred</div>)}
      <div className="et5-tiny">{plan.text}</div>
    </div>
  );
}

/* 51768 — Wrap-up ETA */
function WrapUpEtaCard() {
  const w = useMemo(() => wrapUpEta({ remainingWorkMs: 45 * MIN, verifyMs: 20 * MIN, reportMs: 15 * MIN }), []);
  return (
    <div className="et5-card">
      <h4>51768 · Wrap-up ETA</h4>
      <div className="et5-big">{formatDuration(w.totalMs)}</div>
      {w.phases.map((p) => <div key={p.name} className="et5-tiny">{p.name}: {formatDuration(p.etaMs)}</div>)}
      <div className="et5-tiny">{w.text}</div>
    </div>
  );
}

/* 51769 — ETA for approvals */
function ApprovalEtaCard() {
  const rows = useMemo(() => approvalEta([
    { id: 'ap-1', title: 'Exploit PoC on staging', requestedAtMs: NOW - 42 * MIN, avgDecisionMs: 30 * MIN },
    { id: 'ap-2', title: 'Scan subnet expansion', requestedAtMs: NOW - 8 * MIN, avgDecisionMs: 30 * MIN },
  ], NOW), []);
  return (
    <div className="et5-card">
      <h4>51769 · ETA for approvals</h4>
      {rows.map((r) => <div key={r.id} className={`et5-note et5-lvl-${r.state}`}>{r.text}</div>)}
    </div>
  );
}

/* 51770 — ETA for requested tests */
function TestRequestEtaCard() {
  const rows = useMemo(() => testRequestEta([
    { id: 't-1', name: 'SSRF PoC test', requestedAtMs: NOW - 12 * MIN, expectedDurationMs: 18 * MIN, queuePosition: 0 },
    { id: 't-2', name: 'XSS payload test', requestedAtMs: NOW - 5 * MIN, expectedDurationMs: 9 * MIN, queuePosition: 1 },
  ], NOW), []);
  return (
    <div className="et5-card">
      <h4>51770 · ETA for requested tests</h4>
      {rows.map((r) => <div key={r.id} className="et5-tiny">{r.text}</div>)}
    </div>
  );
}

/* 51771 — Overnight ETA */
function OvernightEtaCard() {
  const [target, setTarget] = useState(200);
  const o = useMemo(() => overnightEta({ finishAtMs: NOW + 170 * MIN, targetMorningMs: NOW + target * MIN }), [target]);
  return (
    <div className="et5-card">
      <h4>51771 · Overnight ETA</h4>
      <label>Morning target in <input type="number" min="60" max="600" value={target} onChange={(e) => setTarget(+e.target.value)} /> minutes</label>
      <div className={o.meetsMorning ? 'et5-note' : 'et5-alert'}>{o.text}</div>
    </div>
  );
}

/* 51772 — ETA timezone handling */
function EtaTimezoneCard() {
  const rows = useMemo(() => etaTimezone(NOW + 110 * MIN, [
    { label: 'IST', offsetMin: 330 },
    { label: 'UTC', offsetMin: 0 },
    { label: 'PST', offsetMin: -480 },
  ]), []);
  return (
    <div className="et5-card">
      <h4>51772 · ETA timezone handling</h4>
      {rows.map((r) => <div key={r.label} className="et5-row"><span className="et5-phase">{r.label}</span> <b>{r.clock}</b> <span className="et5-tiny">{r.weekday}</span></div>)}
    </div>
  );
}

/* 51773 — ETA in tab title (pure string helper) */
function EtaTabTitleCard() {
  const [mins, setMins] = useState(110);
  const title = useMemo(() => etaTabTitle({ remainingMs: mins * MIN, phaseName: 'Scanning' }), [mins]);
  return (
    <div className="et5-card">
      <h4>51773 · ETA in tab title</h4>
      <label>Remaining <input type="range" min="5" max="300" value={mins} onChange={(e) => setMins(+e.target.value)} /> {mins}m</label>
      <div className="et5-pre">document.title = “{title}”</div>
      <div className="et5-tiny">The helper only builds the string — the live component assigns it to the tab.</div>
    </div>
  );
}

/* 51774 — ETA milestones */
function EtaMilestonesCard() {
  const [done, setDone] = useState(52);
  const ms = useMemo(() => etaMilestones((100 - done) * MIN, 100 * MIN, [25, 50, 75, 100]), [done]);
  return (
    <div className="et5-card">
      <h4>51774 · ETA milestones</h4>
      <label>Progress <input type="range" min="0" max="100" value={done} onChange={(e) => setDone(+e.target.value)} /> {done}%</label>
      {ms.map((m) => <div key={m.pct} className={m.reached ? 'et5-note' : 'et5-tiny'}>{m.text}</div>)}
    </div>
  );
}

/* 51775 — ETA drift alerts */
function EtaDriftCard() {
  const [cur, setCur] = useState(175);
  const alerts = useMemo(() => etaDriftAlerts({ baselineMs: 148 * MIN, currentMs: cur * MIN, thresholdMs: 20 * MIN }), [cur]);
  return (
    <div className="et5-card">
      <h4>51775 · ETA drift alerts</h4>
      <label>Current estimate <input type="range" min="110" max="220" value={cur} onChange={(e) => setCur(+e.target.value)} /> {cur}m (baseline 148m, ±20m tolerance)</label>
      {alerts.length === 0 && <div className="et5-tiny">Within tolerance — no alerts.</div>}
      {alerts.map((a, i) => <div key={i} className="et5-alert">{a.text}</div>)}
    </div>
  );
}

/* 51776 — ETA scenario planner */
function EtaScenarioCard() {
  const scenarios = useMemo(() => etaScenarioPlanner({
    remainingMs: 110 * MIN,
    scenarios: [
      { id: 's1', label: 'Add 2 more hours of hunting', addMs: 120 * MIN, removeMs: 0, parallelismBoostPct: 0 },
      { id: 's2', label: 'Cut the mobile-app phase', addMs: 0, removeMs: 45 * MIN, parallelismBoostPct: 0 },
      { id: 's3', label: 'Double parallelism', addMs: 0, removeMs: 0, parallelismBoostPct: 100 },
    ],
  }), []);
  return (
    <div className="et5-card">
      <h4>51776 · ETA scenario planner</h4>
      {scenarios.map((s) => <div key={s.id} className="et5-note">{s.text}</div>)}
    </div>
  );
}

/* 51777 — ETA learning */
function EtaLearningCard() {
  const lines = useMemo(() => etaLearning([
    { fromMs: 160 * MIN, toMs: 148 * MIN, cause: 'recon finished 20m early', phaseName: 'Recon' },
    { fromMs: 148 * MIN, toMs: 152 * MIN, cause: 'the new subnet added 12 targets', phaseName: 'Scanning' },
  ]), []);
  return (
    <div className="et5-card">
      <h4>51777 · ETA learning</h4>
      {lines.map((l, i) => <div key={i} className="et5-note">“{l.text}”</div>)}
    </div>
  );
}

/* 51778 — ETA for sub-agents */
function SubAgentEtasCard() {
  const s = useMemo(() => subAgentEtas([
    { id: 'sub-1', name: 'recon-bot', tabName: 'Recon', remainingMs: 22 * MIN, taskCount: 3 },
    { id: 'sub-2', name: 'scan-bot', tabName: 'Scanning', remainingMs: 58 * MIN, taskCount: 7 },
    { id: 'sub-3', name: 'verify-bot', tabName: 'Verification', remainingMs: 31 * MIN, taskCount: 2 },
  ]), []);
  return (
    <div className="et5-card">
      <h4>51778 · ETA for sub-agents</h4>
      {s.rows.map((r) => <div key={r.id} className="et5-row"><span className="et5-phase">{r.tabName}</span> <b>{formatDuration(r.remainingMs)}</b> <span className="et5-tiny">{r.taskCount} tasks</span></div>)}
      <div className="et5-tiny">{s.text}</div>
    </div>
  );
}

/* 51779 — ETA API */
function EtaApiCard() {
  const routes = useMemo(() => etaApi({ baseUrl: 'https://api.infinity-ai.example/v1' }), []);
  return (
    <div className="et5-card">
      <h4>51779 · ETA API</h4>
      {routes.map((r) => <div key={r.path} className="et5-note"><b>{r.method}</b> <span className="et5-pre">{r.path}</span><div className="et5-tiny">{r.description}</div></div>)}
    </div>
  );
}

/* 51780 — ETA dashboard */
function EtaDashboardCard() {
  const d = useMemo(() => etaDashboard([
    { id: 'H-1', predictedMs: 150 * MIN, actualMs: 162 * MIN, findings: 9 },
    { id: 'H-2', predictedMs: 90 * MIN, actualMs: 84 * MIN, findings: 4 },
    { id: 'H-3', predictedMs: 200 * MIN, actualMs: 220 * MIN, findings: 12 },
  ]), []);
  return (
    <div className="et5-card">
      <h4>51780 · ETA dashboard</h4>
      <div className={`et5-pill et5-${d.verdict.replace('-', '')}`}>{d.verdict}</div>
      <div className="et5-tiny">{d.text}</div>
    </div>
  );
}

/* 51781 — ETA fairness */
function EtaFairnessCard() {
  const f = useMemo(() => etaFairness([
    { name: 'api.target.com', weight: 5 },
    { name: 'app.target.com', weight: 3 },
    { name: 'cdn.target.com', weight: 2 },
  ], 110 * MIN), []);
  return (
    <div className="et5-card">
      <h4>51781 · ETA fairness</h4>
      {f.rows.map((r) => <div key={r.name} className="et5-row"><span className="et5-phase">{r.name}</span>
        <span className="et5-bar"><span className="et5-barfill" style={{ width: `${r.fairSharePct}%` }} /></span>
        <span className="et5-tiny">{formatDuration(r.etaMs)} · {r.fairSharePct}%</span></div>)}
      <div className="et5-tiny">{f.text}</div>
    </div>
  );
}

/* 51782 — ETA-based autoscaling */
function EtaAutoscaleCard() {
  const [cur, setCur] = useState(170);
  const s = useMemo(() => etaAutoscale({ remainingMs: cur * MIN, plannedMs: 148 * MIN, currentParallelism: 2, maxParallelism: 6 }), [cur]);
  return (
    <div className="et5-card">
      <h4>51782 · ETA-based autoscaling</h4>
      <label>Remaining <input type="range" min="110" max="220" value={cur} onChange={(e) => setCur(+e.target.value)} /> {cur}m (planned 148m)</label>
      <div className={s.behind ? 'et5-alert' : 'et5-tiny'}>{s.text}</div>
    </div>
  );
}

/* 51783 — ETA freeze option */
function EtaFreezeCard() {
  const [frozen, setFrozen] = useState(false);
  const f = useMemo(() => etaFreeze({ estimate: { remainingMs: 110 * MIN, finishAtMs: NOW + 110 * MIN }, frozen, frozenAtMs: NOW }), [frozen]);
  return (
    <div className="et5-card">
      <h4>51783 · ETA freeze option</h4>
      <label><input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} /> Freeze the plan during reviews</label>
      <div className={f.frozen ? 'et5-note' : 'et5-tiny'}>{f.text}</div>
    </div>
  );
}

/* 51784 — ETA retrospective */
function EtaRetroCard() {
  const r = useMemo(() => etaRetrospective({
    estimates: [
      { at: '09:00', estimateMs: 170 * MIN },
      { at: '09:30', estimateMs: 160 * MIN },
      { at: '10:00', estimateMs: 148 * MIN },
      { at: '10:30', estimateMs: 152 * MIN },
    ],
    actualMs: 158 * MIN,
  }), []);
  return (
    <div className="et5-card">
      <h4>51784 · ETA retrospective</h4>
      <div className={`et5-pill et5-${r.verdict}`}>{r.verdict}</div>
      <div className="et5-tiny">{r.text}</div>
      {r.estimates.map((e) => <div key={e.at} className="et5-tiny">{e.at}: {formatDuration(e.estimateMs)} — {e.accuracyPct}% accurate</div>)}
    </div>
  );
}

/* 51785 — Countdown voice control */
function CountdownVoiceCard() {
  const [q, setQ] = useState('how much longer?');
  const script = useMemo(() => countdownVoiceScript(q, 62 * MIN, 'Scanning'), [q]);
  return (
    <div className="et5-card">
      <h4>51785 · Countdown voice control</h4>
      <div className="et5-chat">you: <input className="et5-input" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="et5-chat">avatar: 🔊 “{script}”</div>
    </div>
  );
}

export const EtaRound5Gallery = [
  { id: 51761, name: 'RecalcLogCard', render: <RecalcLogCard /> },
  { id: 51762, name: 'TimeToFirstFindingCard', render: <TimeToFirstFindingCard /> },
  { id: 51763, name: 'IdleTimeCard', render: <IdleTimeCard /> },
  { id: 51764, name: 'ActiveTimeCard', render: <ActiveTimeCard /> },
  { id: 51765, name: 'EtaExportCard', render: <EtaExportCard /> },
  { id: 51766, name: 'MultiHuntCard', render: <MultiHuntCard /> },
  { id: 51767, name: 'PrioritizationCard', render: <PrioritizationCard /> },
  { id: 51768, name: 'WrapUpEtaCard', render: <WrapUpEtaCard /> },
  { id: 51769, name: 'ApprovalEtaCard', render: <ApprovalEtaCard /> },
  { id: 51770, name: 'TestRequestEtaCard', render: <TestRequestEtaCard /> },
  { id: 51771, name: 'OvernightEtaCard', render: <OvernightEtaCard /> },
  { id: 51772, name: 'EtaTimezoneCard', render: <EtaTimezoneCard /> },
  { id: 51773, name: 'EtaTabTitleCard', render: <EtaTabTitleCard /> },
  { id: 51774, name: 'EtaMilestonesCard', render: <EtaMilestonesCard /> },
  { id: 51775, name: 'EtaDriftCard', render: <EtaDriftCard /> },
  { id: 51776, name: 'EtaScenarioCard', render: <EtaScenarioCard /> },
  { id: 51777, name: 'EtaLearningCard', render: <EtaLearningCard /> },
  { id: 51778, name: 'SubAgentEtasCard', render: <SubAgentEtasCard /> },
  { id: 51779, name: 'EtaApiCard', render: <EtaApiCard /> },
  { id: 51780, name: 'EtaDashboardCard', render: <EtaDashboardCard /> },
  { id: 51781, name: 'EtaFairnessCard', render: <EtaFairnessCard /> },
  { id: 51782, name: 'EtaAutoscaleCard', render: <EtaAutoscaleCard /> },
  { id: 51783, name: 'EtaFreezeCard', render: <EtaFreezeCard /> },
  { id: 51784, name: 'EtaRetroCard', render: <EtaRetroCard /> },
  { id: 51785, name: 'CountdownVoiceCard', render: <CountdownVoiceCard /> },
];

export default EtaRound5Gallery;
