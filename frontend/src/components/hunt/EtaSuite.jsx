/**
 * EtaSuite.jsx — wave 44 (ideas 51731–51760): live ETA suite for the hunt.
 *
 * 28 working components covering all 30 ideas, each driving the pure logic
 * in etaCore.js with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  liveEta,
  phaseEtas,
  etaInterval,
  etaTrend,
  currentStepEta,
  etaBreakdown,
  etaHistorySeries,
  finishTimeClock,
  etaShiftAlerts,
  deadlinePlan,
  deadlineFeasibility,
  budgetTracker,
  overtimeWarnings,
  etaByStrategy,
  steeringTimeImpact,
  pauseAdjustedEta,
  etaPerAsset,
  etaPerFinding,
  slowdownDetection,
  speedupOptions,
  etaCalibration,
  etaChatAnswer,
  etaVoiceScript,
  etaWidgetPayload,
  etaShareLink,
  snapshotEtaStamp,
  etaVariance,
  phasePredictions,
  etaConfidenceMeter,
  etaBounds,
  formatDuration,
} from './etaCore.js';

const MIN = 60000;
const NOW = 1728288000000; // fixed fixture epoch (2024-10-07T08:00:00Z)

const PHASES = [
  { name: 'Recon', status: 'done', estimatedMs: 30 * MIN, elapsedMs: 28 * MIN },
  { name: 'Scanning', status: 'active', estimatedMs: 60 * MIN, elapsedMs: 22 * MIN },
  { name: 'Verification', status: 'pending', estimatedMs: 45 * MIN },
  { name: 'Reporting', status: 'pending', estimatedMs: 25 * MIN },
];

const HISTORY = [
  { at: '09:00', estimateMs: 170 * MIN },
  { at: '09:30', estimateMs: 160 * MIN },
  { at: '10:00', estimateMs: 148 * MIN },
  { at: '10:30', estimateMs: 152 * MIN },
];

function EtaBig({ ms }) {
  return <div className="et44-big">{formatDuration(ms)}</div>;
}

/* 51731 — Live ETA display */
function LiveEtaDisplay() {
  const [elapsed, setElapsed] = useState(50);
  const eta = useMemo(
    () => liveEta({ now: NOW, elapsedActiveMs: elapsed * MIN, totalExpectedActiveMs: 160 * MIN }),
    [elapsed]
  );
  return (
    <div className="et44-card">
      <h4>51731 · Live ETA display</h4>
      <EtaBig ms={eta.remainingMs} />
      <label>
        Elapsed{' '}
        <input
          type="range"
          min="0"
          max="160"
          value={elapsed}
          onChange={e => setElapsed(+e.target.value)}
        />{' '}
        {elapsed}m
      </label>
      <div className="et44-tiny">
        {eta.pctComplete}% complete · finishes {finishTimeClock(eta.finishAtMs).text}
      </div>
    </div>
  );
}

/* 51732 — Per-phase ETAs */
function PhaseEtaCards() {
  const rows = useMemo(() => phaseEtas(PHASES), []);
  return (
    <div className="et44-card">
      <h4>51732 · Per-phase ETAs</h4>
      {rows.map(r => (
        <div key={r.name} className="et44-row">
          <span className="et44-phase">{r.name}</span> <span className="et44-tiny">{r.status}</span>{' '}
          <b>{formatDuration(r.etaMs)}</b>
        </div>
      ))}
    </div>
  );
}

/* 51733 — ETA confidence interval */
function EtaIntervalCard() {
  const [conf, setConf] = useState(70);
  const iv = useMemo(() => etaInterval(148 * MIN, conf), [conf]);
  return (
    <div className="et44-card">
      <h4>51733 · ETA confidence interval</h4>
      <label>
        Confidence{' '}
        <input
          type="range"
          min="10"
          max="99"
          value={conf}
          onChange={e => setConf(+e.target.value)}
        />{' '}
        {conf}%
      </label>
      <EtaBig ms={iv.estimateMs} />
      <div className="et44-tiny">
        Likely range: {iv.label} — the less certain, the wider the band.
      </div>
    </div>
  );
}

/* 51734 — ETA trend */
function EtaTrendCard() {
  const t = useMemo(() => etaTrend(HISTORY), []);
  return (
    <div className="et44-card">
      <h4>51734 · ETA trend</h4>
      <div className={`et44-pill et44-${t.trend}`}>{t.trend}</div>
      <div className="et44-tiny">
        Δ {formatDuration(Math.abs(t.deltaMs))} {t.deltaMs > 0 ? 'slipped' : 'shrunk'} across{' '}
        {t.samples} samples.
      </div>
    </div>
  );
}

/* 51735 — Current-step ETA */
function CurrentStepEtaCard() {
  const step = useMemo(
    () =>
      currentStepEta({
        name: 'Exploit verification',
        startedAt: NOW - 14 * MIN,
        now: NOW,
        typicalMs: 12 * MIN,
      }),
    []
  );
  return (
    <div className="et44-card">
      <h4>51735 · Current-step ETA</h4>
      <div className="et44-row">
        <b>{step.name}</b>{' '}
        <span className="et44-tiny">elapsed {formatDuration(step.elapsedMs)}</span>
      </div>
      <EtaBig ms={step.remainingMs} />
      {step.runningOver && (
        <div className="et44-alert">
          Running over the typical {formatDuration(step.typicalMs)} — watch this step.
        </div>
      )}
    </div>
  );
}

/* 51736 — ETA breakdown */
function EtaBreakdownCard() {
  const rows = useMemo(() => etaBreakdown(PHASES), []);
  return (
    <div className="et44-card">
      <h4>51736 · ETA breakdown</h4>
      {rows.map(r => (
        <div key={r.name} className="et44-row">
          <span className="et44-phase">{r.name}</span>
          <span className="et44-bar">
            <span className="et44-barfill" style={{ width: `${r.sharePct}%` }} />
          </span>
          <span className="et44-tiny">
            {r.sharePct}% · {formatDuration(r.etaMs)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* 51737 — ETA history graph */
function EtaHistoryGraph() {
  const pts = useMemo(() => etaHistorySeries(HISTORY), []);
  const max = Math.max(...pts.map(p => p.estimateMin), 1);
  const line = pts
    .map((p, i) => `${(i / Math.max(1, pts.length - 1)) * 180},${58 - (p.estimateMin / max) * 50}`)
    .join(' ');
  return (
    <div className="et44-card">
      <h4>51737 · ETA history graph</h4>
      <svg className="et44-spark" viewBox="0 0 180 64">
        <polyline points={line} fill="none" stroke="#f59e0b" strokeWidth="2" />
      </svg>
      {pts.map(p => (
        <div key={p.at} className="et44-tiny">
          {p.at}: ~{p.estimateMin}m
        </div>
      ))}
    </div>
  );
}

/* 51738 — Finish-time clock */
function FinishTimeClockCard() {
  const [tz, setTz] = useState(330);
  const eta = useMemo(
    () => liveEta({ now: NOW, elapsedActiveMs: 50 * MIN, totalExpectedActiveMs: 160 * MIN }),
    []
  );
  const c = finishTimeClock(eta.finishAtMs, { tzOffsetMin: tz, label: tz === 330 ? 'IST' : 'UTC' });
  return (
    <div className="et44-card">
      <h4>51738 · Finish-time clock</h4>
      <select value={tz} onChange={e => setTz(+e.target.value)}>
        <option value={330}>IST (UTC+5:30)</option>
        <option value={0}>UTC</option>
      </select>
      <div className="et44-clock">{c.clock}</div>
      <div className="et44-tiny">
        {c.weekday} · {c.text}
      </div>
    </div>
  );
}

/* 51739 — ETA notifications */
function EtaShiftAlertsCard() {
  const a = useMemo(() => etaShiftAlerts(148 * MIN, 162 * MIN), []);
  return (
    <div className="et44-card">
      <h4>51739 · ETA notifications</h4>
      <div className={a.significant ? 'et44-alert' : 'et44-tiny'}>
        {a.significant ? '⚠ ' : ''}
        {a.text}
      </div>
      <div className="et44-tiny">
        Shifts beyond 15m trigger a notification; smaller drift stays silent.
      </div>
    </div>
  );
}

/* 51740 — Deadline mode */
function DeadlinePlannerCard() {
  const [avail, setAvail] = useState(120);
  const plan = useMemo(
    () =>
      deadlinePlan(
        PHASES.filter(p => p.status !== 'done').map(p => ({
          name: p.name,
          estimatedMs: p.status === 'active' ? p.estimatedMs - p.elapsedMs : p.estimatedMs,
        })),
        avail * MIN
      ),
    [avail]
  );
  return (
    <div className="et44-card">
      <h4>51740 · Deadline mode</h4>
      <label>
        Hard deadline in{' '}
        <input
          type="number"
          min="10"
          max="400"
          value={avail}
          onChange={e => setAvail(+e.target.value)}
        />{' '}
        minutes
      </label>
      <div className={plan.fits ? 'et44-note' : 'et44-alert'}>
        {plan.fits
          ? '✓ Plan fits the deadline.'
          : `✕ Plan needs ${plan.totalMs / MIN}m — compressing phases ×${plan.compressionFactor}.`}
      </div>
      {plan.phases.map(p => (
        <div key={p.name} className="et44-tiny">
          {p.name}: {formatDuration(p.plannedMs)} (full {formatDuration(p.fullMs)})
        </div>
      ))}
    </div>
  );
}

/* 51741 — Deadline feasibility */
function DeadlineFeasibilityCard() {
  const [avail, setAvail] = useState(150);
  const f = useMemo(() => deadlineFeasibility(148 * MIN, avail * MIN), [avail]);
  return (
    <div className="et44-card">
      <h4>51741 · Deadline feasibility</h4>
      <label>
        Available{' '}
        <input
          type="number"
          min="30"
          max="400"
          value={avail}
          onChange={e => setAvail(+e.target.value)}
        />{' '}
        minutes
      </label>
      <div className={`et44-pill et44-${f.verdict}`}>{f.verdict}</div>
      <div className="et44-tiny">
        {f.note} Margin: {formatDuration(Math.abs(f.marginMs))} {f.marginMs < 0 ? 'short' : 'spare'}
        .
      </div>
    </div>
  );
}

/* 51742 — Time-budget tracker */
function BudgetTrackerCard() {
  const [used, setUsed] = useState(95);
  const b = useMemo(() => budgetTracker(180 * MIN, used * MIN), [used]);
  return (
    <div className="et44-card">
      <h4>51742 · Time-budget tracker</h4>
      <div className="et44-bar">
        <span
          className="et44-barfill"
          style={{ width: `${b.usedPct}%`, background: b.overBudget ? '#ef4444' : '#38bdf8' }}
        />
      </div>
      <label>
        Used{' '}
        <input
          type="range"
          min="0"
          max="220"
          value={used}
          onChange={e => setUsed(+e.target.value)}
        />{' '}
        {used}m of 180m
      </label>
      <div className="et44-tiny">
        {b.usedPct}% used · {formatDuration(b.remainingMs)} left
        {b.overBudget ? ' · OVER BUDGET' : ''}
      </div>
    </div>
  );
}

/* 51743 — Overtime warnings */
function OvertimeWarningsCard() {
  const [used, setUsed] = useState(150);
  const w = useMemo(() => overtimeWarnings(180 * MIN, used * MIN, 195 * MIN), [used]);
  return (
    <div className="et44-card">
      <h4>51743 · Overtime warnings</h4>
      <label>
        Used{' '}
        <input
          type="range"
          min="0"
          max="220"
          value={used}
          onChange={e => setUsed(+e.target.value)}
        />{' '}
        {used}m
      </label>
      {w.map((x, i) => (
        <div key={i} className={`et44-note et44-lvl-${x.level}`}>
          {x.text}
        </div>
      ))}
      {w.length === 0 && <div className="et44-tiny">Budget healthy — no warnings.</div>}
    </div>
  );
}

/* 51744 — ETA by strategy */
function EtaByStrategyCard() {
  const rows = useMemo(
    () =>
      etaByStrategy([
        { name: 'Depth-first', scaleFactor: 1.25, baseRemainingMs: 110 * MIN },
        { name: 'Breadth-first', scaleFactor: 1.0, baseRemainingMs: 110 * MIN },
        { name: 'Targeted', scaleFactor: 0.7, baseRemainingMs: 110 * MIN },
      ]),
    []
  );
  return (
    <div className="et44-card">
      <h4>51744 · ETA by strategy</h4>
      {rows.map(r => (
        <div key={r.name} className="et44-row">
          <span className="et44-phase">{r.name}</span> <b>{formatDuration(r.remainingMs)}</b>{' '}
          <span className="et44-tiny">×{r.scaleFactor}</span>
        </div>
      ))}
    </div>
  );
}

/* 51745 — Steering impact on ETA */
function SteeringImpactCard() {
  const [mode, setMode] = useState('redirect');
  const d = useMemo(
    () =>
      steeringTimeImpact(
        110 * MIN,
        mode === 'redirect'
          ? { description: 'Redirect scan to new subnet', addsMs: 25 * MIN, removesMs: 10 * MIN }
          : { description: 'Drop low-yield asset', addsMs: 0, removesMs: 18 * MIN }
      ),
    [mode]
  );
  return (
    <div className="et44-card">
      <h4>51745 · Steering impact on ETA</h4>
      <select value={mode} onChange={e => setMode(e.target.value)}>
        <option value="redirect">Redirect scan to new subnet</option>
        <option value="drop">Drop low-yield asset</option>
      </select>
      <div className="et44-note">
        {d.description}: {d.deltaMs > 0 ? '+' : ''}
        {formatDuration(Math.abs(d.deltaMs))}{' '}
        {d.deltaMs > 0 ? 'added' : d.deltaMs < 0 ? 'saved' : ''}. New ETA:{' '}
        {formatDuration(d.newRemainingMs)}.
      </div>
      <div className="et44-tiny">{d.recommendation}</div>
    </div>
  );
}

/* 51746 — Pause-adjusted ETA */
function PauseAdjustedEtaCard() {
  const [paused, setPaused] = useState(0);
  const base = useMemo(
    () => liveEta({ now: NOW, elapsedActiveMs: 50 * MIN, totalExpectedActiveMs: 160 * MIN }),
    []
  );
  const a = useMemo(
    () =>
      pauseAdjustedEta(
        { remainingMs: base.remainingMs, finishAtMs: base.finishAtMs },
        { extraPausedMs: paused * MIN }
      ),
    [paused, base]
  );
  return (
    <div className="et44-card">
      <h4>51746 · Pause-adjusted ETA</h4>
      <label>
        Paused{' '}
        <input
          type="range"
          min="0"
          max="90"
          value={paused}
          onChange={e => setPaused(+e.target.value)}
        />{' '}
        {paused}m
      </label>
      <div className="et44-tiny">
        Finish moves to {finishTimeClock(a.finishAtMs).text}. {a.note}
      </div>
    </div>
  );
}

/* 51747 — ETA per asset */
function EtaPerAssetCard() {
  const rows = useMemo(
    () =>
      etaPerAsset(
        [
          { name: 'api.target.com', weight: 5 },
          { name: 'app.target.com', weight: 3 },
          { name: 'cdn.target.com', weight: 2 },
        ],
        110 * MIN
      ),
    []
  );
  return (
    <div className="et44-card">
      <h4>51747 · ETA per asset</h4>
      {rows.map(r => (
        <div key={r.name} className="et44-row">
          <span className="et44-phase">{r.name}</span> <b>{formatDuration(r.etaMs)}</b>
        </div>
      ))}
    </div>
  );
}

/* 51748 — ETA per finding */
function EtaPerFindingCard() {
  const p = useMemo(() => etaPerFinding(7, 84 * MIN), []);
  return (
    <div className="et44-card">
      <h4>51748 · ETA per finding</h4>
      <div className="et44-tiny">
        7 findings in 84m · {p.findingsPerHour}/h · avg {p.avgMinutesPerFinding}m per finding
      </div>
      <EtaBig ms={p.nextFindingInMs} />
      <div className="et44-tiny">{p.note}</div>
    </div>
  );
}

/* 51749 — Slowdown detection */
function SlowdownDetectionCard() {
  const [pace, setPace] = useState(3);
  const d = useMemo(
    () => slowdownDetection([{ at: 'last-hour', items: pace, windowMs: 60 * MIN }], 8),
    [pace]
  );
  return (
    <div className="et44-card">
      <h4>51749 · Slowdown detection</h4>
      <label>
        Items last hour{' '}
        <input
          type="range"
          min="0"
          max="12"
          value={pace}
          onChange={e => setPace(+e.target.value)}
        />{' '}
        {pace}
      </label>
      <div className={d.flagged ? 'et44-alert' : 'et44-tiny'}>{d.reason}</div>
    </div>
  );
}

/* 51750 — Speed-up options */
function SpeedupOptionsCard() {
  const opts = useMemo(
    () =>
      speedupOptions({ remainingMs: 110 * MIN, parallelizableMs: 40 * MIN, lowYieldMs: 15 * MIN }),
    []
  );
  return (
    <div className="et44-card">
      <h4>51750 · Speed-up options</h4>
      {opts.map(o => (
        <div key={o.id} className="et44-note">
          <b>{o.label}</b> — saves {formatDuration(o.savesMs)}.
          <div className="et44-tiny">Tradeoff: {o.tradeoff}</div>
        </div>
      ))}
    </div>
  );
}

/* 51751 — ETA calibration */
function EtaCalibrationCard() {
  const cal = useMemo(
    () =>
      etaCalibration([
        { predictedMs: 120 * MIN, actualMs: 150 * MIN },
        { predictedMs: 90 * MIN, actualMs: 100 * MIN },
        { predictedMs: 180 * MIN, actualMs: 210 * MIN },
      ]),
    []
  );
  return (
    <div className="et44-card">
      <h4>51751 · ETA calibration</h4>
      <div className="et44-tiny">
        Learned factor ×{cal.factor} from {cal.samples} past hunts ({cal.direction}). {cal.note}
      </div>
      <div className="et44-note">
        Raw estimate 110m → calibrated <b>{formatDuration(cal.calibrate(110 * MIN))}</b>.
      </div>
    </div>
  );
}

/* 51752 — ETA in chat */
function EtaChatCard() {
  const [q, setQ] = useState('how much longer?');
  const eta = useMemo(
    () => ({ etaMs: 110 * MIN, loMs: 95 * MIN, hiMs: 130 * MIN, finishAtMs: NOW + 110 * MIN }),
    []
  );
  return (
    <div className="et44-card">
      <h4>51752 · ETA in chat</h4>
      <div className="et44-chat">
        you: <input className="et44-input" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="et44-chat">infinity: {etaChatAnswer(q, eta)}</div>
    </div>
  );
}

/* 51753 — ETA voice announcements */
function EtaVoiceAnnounceCard() {
  const [milestone, setMilestone] = useState('Scanning phase complete');
  const script = useMemo(() => etaVoiceScript(milestone, 62 * MIN), [milestone]);
  return (
    <div className="et44-card">
      <h4>51753 · ETA voice announcements</h4>
      <input
        className="et44-input et44-wide"
        value={milestone}
        onChange={e => setMilestone(e.target.value)}
      />
      <div className="et44-note">🔊 “{script}”</div>
    </div>
  );
}

/* 51754 — ETA mobile widget */
function EtaMobileWidgetCard() {
  const w = useMemo(
    () => etaWidgetPayload({ etaMs: 110 * MIN, finishAtMs: NOW + 110 * MIN, pctComplete: 31 }),
    []
  );
  return (
    <div className="et44-card">
      <h4>51754 · ETA mobile widget</h4>
      <div className="et44-phone">
        <div className="et44-mcard">
          <b>Dark-Matter hunt</b>
          <div className="et44-big">{formatDuration(w.etaMin * MIN)}</div>
          <div className="et44-tiny">
            {w.clock} · {w.pctComplete}%
          </div>
        </div>
      </div>
      <div className="et44-tiny">Widget payload: {w.compact}</div>
    </div>
  );
}

/* 51755 + 51756 — ETA sharing & snapshot stamps */
function EtaShareAndSnapshotCard() {
  const link = useMemo(
    () =>
      etaShareLink('https://hunt.infinity-ai.example', {
        etaMs: 110 * MIN,
        finishAtMs: NOW + 110 * MIN,
        huntName: 'oct-sweep',
      }),
    []
  );
  const stamp = useMemo(
    () =>
      snapshotEtaStamp(
        { remainingMs: 110 * MIN, finishAtMs: NOW + 110 * MIN, confidence: 70 },
        { snapshotId: 'snap-014' }
      ),
    []
  );
  return (
    <div className="et44-card">
      <h4>51755 · ETA sharing · 51756 · ETA in snapshots</h4>
      <div className="et44-tiny">Read-only link:</div>
      <div className="et44-pre">{link.url}</div>
      <div className="et44-tiny">{link.note}</div>
      <div className="et44-tiny">
        Snapshot stamp: {stamp.snapshotId} · {formatDuration(stamp.remainingMs)} remaining ·
        confidence {stamp.confidence}%
      </div>
    </div>
  );
}

/* 51757 — ETA vs plan variance */
function EtaVarianceCard() {
  const v = useMemo(() => etaVariance(140 * MIN, 162 * MIN), []);
  return (
    <div className="et44-card">
      <h4>51757 · ETA vs plan variance</h4>
      <div className={`et44-pill et44-${v.status}`}>{v.status}</div>
      <div className="et44-duo">
        <span>Planned {formatDuration(v.plannedMs)}</span>
        <span>Actual {formatDuration(v.actualMs)}</span>
      </div>
      <div className="et44-tiny">{v.text}</div>
    </div>
  );
}

/* 51758 — Phase-duration predictions */
function PhasePredictionsCard() {
  const rows = useMemo(
    () =>
      phasePredictions(
        ['Verification', 'Reporting', 'Exploit-PoC'],
        [
          { name: 'Verification', actualMs: 52 * MIN },
          { name: 'Verification', actualMs: 44 * MIN },
          { name: 'Reporting', actualMs: 28 * MIN },
          { name: 'Reporting', actualMs: 31 * MIN },
        ]
      ),
    []
  );
  return (
    <div className="et44-card">
      <h4>51758 · Phase-duration predictions</h4>
      {rows.map(r => (
        <div key={r.name} className="et44-row">
          <span className="et44-phase">{r.name}</span>{' '}
          <b>{r.predictedMs != null ? formatDuration(r.predictedMs) : 'no data'}</b>{' '}
          <span className="et44-tiny">{r.source}</span>
        </div>
      ))}
    </div>
  );
}

/* 51759 + 51760 — ETA confidence meter & best/worst-case ETAs */
function EtaConfidenceAndBoundsCard() {
  const [points, setPoints] = useState(6);
  const m = useMemo(
    () => etaConfidenceMeter({ dataPoints: points, calibrationAgeDays: 3, progressPct: 31 }),
    [points]
  );
  const b = useMemo(() => etaBounds(110 * MIN, m.meter), [m]);
  return (
    <div className="et44-card">
      <h4>51759 · ETA confidence meter · 51760 · Best/worst-case ETAs</h4>
      <label>
        Data points{' '}
        <input
          type="range"
          min="0"
          max="12"
          value={points}
          onChange={e => setPoints(+e.target.value)}
        />{' '}
        {points}
      </label>
      <div className="et44-tiny">
        Trust: <b>{m.meter}/100</b> ({m.trust})
      </div>
      <div className="et44-note">{b.label}</div>
    </div>
  );
}

export const EtaSuiteGallery = [
  { id: 51731, name: 'LiveEtaDisplay', render: <LiveEtaDisplay /> },
  { id: 51732, name: 'PhaseEtaCards', render: <PhaseEtaCards /> },
  { id: 51733, name: 'EtaIntervalCard', render: <EtaIntervalCard /> },
  { id: 51734, name: 'EtaTrendCard', render: <EtaTrendCard /> },
  { id: 51735, name: 'CurrentStepEtaCard', render: <CurrentStepEtaCard /> },
  { id: 51736, name: 'EtaBreakdownCard', render: <EtaBreakdownCard /> },
  { id: 51737, name: 'EtaHistoryGraph', render: <EtaHistoryGraph /> },
  { id: 51738, name: 'FinishTimeClockCard', render: <FinishTimeClockCard /> },
  { id: 51739, name: 'EtaShiftAlertsCard', render: <EtaShiftAlertsCard /> },
  { id: 51740, name: 'DeadlinePlannerCard', render: <DeadlinePlannerCard /> },
  { id: 51741, name: 'DeadlineFeasibilityCard', render: <DeadlineFeasibilityCard /> },
  { id: 51742, name: 'BudgetTrackerCard', render: <BudgetTrackerCard /> },
  { id: 51743, name: 'OvertimeWarningsCard', render: <OvertimeWarningsCard /> },
  { id: 51744, name: 'EtaByStrategyCard', render: <EtaByStrategyCard /> },
  { id: 51745, name: 'SteeringImpactCard', render: <SteeringImpactCard /> },
  { id: 51746, name: 'PauseAdjustedEtaCard', render: <PauseAdjustedEtaCard /> },
  { id: 51747, name: 'EtaPerAssetCard', render: <EtaPerAssetCard /> },
  { id: 51748, name: 'EtaPerFindingCard', render: <EtaPerFindingCard /> },
  { id: 51749, name: 'SlowdownDetectionCard', render: <SlowdownDetectionCard /> },
  { id: 51750, name: 'SpeedupOptionsCard', render: <SpeedupOptionsCard /> },
  { id: 51751, name: 'EtaCalibrationCard', render: <EtaCalibrationCard /> },
  { id: 51752, name: 'EtaChatCard', render: <EtaChatCard /> },
  { id: 51753, name: 'EtaVoiceAnnounceCard', render: <EtaVoiceAnnounceCard /> },
  { id: 51754, name: 'EtaMobileWidgetCard', render: <EtaMobileWidgetCard /> },
  { id: 51755, name: 'EtaShareAndSnapshotCard', render: <EtaShareAndSnapshotCard /> },
  { id: 51757, name: 'EtaVarianceCard', render: <EtaVarianceCard /> },
  { id: 51758, name: 'PhasePredictionsCard', render: <PhasePredictionsCard /> },
  { id: 51759, name: 'EtaConfidenceAndBoundsCard', render: <EtaConfidenceAndBoundsCard /> },
];

export default EtaSuiteGallery;
