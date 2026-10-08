/**
 * ConfidenceSuite.jsx — wave 43 (ideas 51681–51700): finding-confidence
 * display & triage suite.
 *
 * 20 working components, each driving the pure logic in confidenceCore.js
 * with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  flagLowConfidence,
  sortByConfidence,
  filterByConfidence,
  confidenceHistory,
  uncertaintyNote,
  crossValidationBadge,
  manualVerificationPrompt,
  matrixPosition,
  prioritizationScore,
  applyDecay,
  boostEvents,
  peerAgreement,
  calibrationView,
  thresholdAlert,
  notificationPayload,
  snapshotConfidenceSection,
  confidenceColor,
  confidenceTooltip,
  appendAuditLog,
  autoTriage,
} from './confidenceCore.js';

const F = [
  {
    id: 'F-101',
    title: 'SQLi in /search?q=',
    severity: 'critical',
    confidence: 88,
    techniques: ['sqlmap', 'manual-review'],
    evidence: [
      { type: 'response', note: 'error-based' },
      { type: 'replay', note: 'confirmed' },
    ],
    history: [
      { at: '10:02', score: 71, trigger: 'first detection' },
      { at: '10:20', score: 88, trigger: 'replay confirmed' },
    ],
  },
  {
    id: 'F-102',
    title: 'Reflected XSS on /feedback',
    severity: 'high',
    confidence: 62,
    techniques: ['scanner'],
    evidence: [{ type: 'response', note: 'payload reflected' }],
    history: [{ at: '10:05', score: 62, trigger: 'first detection' }],
  },
  {
    id: 'F-103',
    title: 'Verbose Server header',
    severity: 'low',
    confidence: 34,
    techniques: ['headers'],
    evidence: [],
    history: [
      { at: '09:50', score: 48, trigger: 'first detection' },
      { at: '10:11', score: 34, trigger: 'decay −14: banner seen on error page too' },
    ],
  },
  {
    id: 'F-104',
    title: 'IDOR on /api/orders/881',
    severity: 'high',
    confidence: 95,
    techniques: ['manual-review', 'replay-harness'],
    evidence: [{ type: 'screenshot' }, { type: 'response' }, { type: 'replay' }],
    history: [
      { at: '09:40', score: 66, trigger: 'first detection' },
      { at: '10:30', score: 95, trigger: 'second technique confirmed' },
    ],
  },
];

const PEERS = {
  sqlmap: { truePositives: 41, total: 52 },
  scanner: { truePositives: 18, total: 40 },
  headers: { truePositives: 3, total: 22 },
  'manual-review': { truePositives: 60, total: 64 },
};
const CALIB = [
  ...Array(20)
    .fill(0)
    .map(() => ({ predicted: 88, outcome: true })),
  ...Array(5)
    .fill(0)
    .map(() => ({ predicted: 88, outcome: false })),
  ...Array(12)
    .fill(0)
    .map(() => ({ predicted: 68, outcome: true })),
  ...Array(8)
    .fill(0)
    .map(() => ({ predicted: 68, outcome: false })),
  ...Array(4)
    .fill(0)
    .map(() => ({ predicted: 45, outcome: true })),
  ...Array(10)
    .fill(0)
    .map(() => ({ predicted: 45, outcome: false })),
];

function Score({ v }) {
  return (
    <span
      className="cf43-score"
      style={{ background: confidenceColor(v) }}
      title={confidenceTooltip(v)}
    >
      {v}
    </span>
  );
}

/* 51681 — Low-confidence flagging */
function LowConfidenceFlags() {
  const [t, setT] = useState(60);
  const flagged = useMemo(() => flagLowConfidence(F, t), [t]);
  return (
    <div className="cf43-card">
      <h4>51681 · Low-confidence flagging</h4>
      <label>
        Threshold{' '}
        <input type="range" min="0" max="100" value={t} onChange={e => setT(+e.target.value)} /> {t}
      </label>
      {flagged
        .filter(f => f.belowThreshold)
        .map(f => (
          <div key={f.id} className="cf43-flag">
            ⚑ {f.title} <Score v={f.confidence} />
          </div>
        ))}
    </div>
  );
}

/* 51682 — Confidence-based sorting */
function ConfidenceSorter() {
  const [dir, setDir] = useState('desc');
  const rows = useMemo(() => sortByConfidence(F, { dir }), [dir]);
  return (
    <div className="cf43-card">
      <h4>51682 · Confidence-based sorting</h4>
      <button className="cf43-btn" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>
        Order: {dir}
      </button>
      {rows.map(f => (
        <div key={f.id} className="cf43-row">
          {f.title} <Score v={f.confidence} />
        </div>
      ))}
    </div>
  );
}

/* 51683 — Confidence filters */
function ConfidenceFilter() {
  const [min, setMin] = useState(50);
  const rows = useMemo(() => filterByConfidence(F, min), [min]);
  return (
    <div className="cf43-card">
      <h4>51683 · Confidence filters</h4>
      <label>
        Show ≥{' '}
        <input type="range" min="0" max="100" value={min} onChange={e => setMin(+e.target.value)} />{' '}
        {min}
      </label>
      {rows.map(f => (
        <div key={f.id} className="cf43-row">
          {f.title} <Score v={f.confidence} />
        </div>
      ))}
      {rows.length === 0 && <div className="cf43-empty">Nothing above the floor.</div>}
    </div>
  );
}

/* 51684 — Confidence history graph */
function ConfidenceHistoryGraph() {
  const [id, setId] = useState('F-101');
  const f = F.find(x => x.id === id);
  const pts = confidenceHistory(f);
  const line = pts
    .map((p, i) => `${(i / Math.max(1, pts.length - 1)) * 180},${60 - p.score * 0.55}`)
    .join(' ');
  return (
    <div className="cf43-card">
      <h4>51684 · Confidence history graph</h4>
      <select value={id} onChange={e => setId(e.target.value)}>
        {F.map(x => (
          <option key={x.id} value={x.id}>
            {x.id}
          </option>
        ))}
      </select>
      <svg className="cf43-spark" viewBox="0 0 180 64">
        <polyline points={line} fill="none" stroke="#38bdf8" strokeWidth="2" />
      </svg>
      {pts.map((p, i) => (
        <div key={i} className="cf43-tiny">
          {p.at}: {p.score} — {p.trigger}
        </div>
      ))}
    </div>
  );
}

/* 51685 — Agent uncertainty notes */
function UncertaintyNotes() {
  return (
    <div className="cf43-card">
      <h4>51685 · Agent uncertainty notes</h4>
      {F.map(f => (
        <div key={f.id} className="cf43-note">
          🛈 <b>{f.id}</b> — {uncertaintyNote(f)}
        </div>
      ))}
    </div>
  );
}

/* 51686 — Cross-validation badges */
function CrossValidationBadges() {
  return (
    <div className="cf43-card">
      <h4>51686 · Cross-validation badges</h4>
      {F.map(f => {
        const b = crossValidationBadge(f);
        return (
          <div key={f.id} className="cf43-row">
            <span className={b.crossValidated ? 'cf43-badge-ok' : 'cf43-badge-warn'}>
              {b.label}
            </span>{' '}
            {f.title}
          </div>
        );
      })}
    </div>
  );
}

/* 51687 — Manual-verification prompts */
function ManualVerificationPrompts() {
  return (
    <div className="cf43-card">
      <h4>51687 · Manual-verification prompts</h4>
      {F.map(f => {
        const p = manualVerificationPrompt(f);
        return (
          p.needed && (
            <div key={f.id} className="cf43-note">
              <b>{f.id}</b> <Score v={f.confidence} />
              <ul>
                {p.checks.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )
        );
      })}
    </div>
  );
}

/* 51688 — Confidence vs severity matrix */
function ConfidenceSeverityMatrix() {
  const cells = {};
  F.forEach(f => {
    const m = matrixPosition(f);
    cells[`${m.row}-${m.col}`] = [...(cells[`${m.row}-${m.col}`] || []), f];
  });
  const cols = ['Certain (80+)', 'Likely (60–79)', 'Unproven (40–59)', 'Shaky (<40)'];
  const rows = ['critical', 'high', 'medium', 'low', 'info'];
  return (
    <div className="cf43-card">
      <h4>51688 · Confidence vs severity matrix</h4>
      <table className="cf43-matrix">
        <thead>
          <tr>
            <th></th>
            {cols.map(c => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th>{r}</th>
              {cols.map((_, ci) => (
                <td key={ci}>
                  {(cells[`${ri}-${ci}`] || []).map(f => (
                    <span
                      key={f.id}
                      className="cf43-dot"
                      style={{ background: confidenceColor(f.confidence) }}
                      title={`${f.id}: ${f.confidence}`}
                    />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 51689 — Confidence-weighted prioritization */
function PrioritizationList() {
  const rows = useMemo(
    () => [...F].sort((a, b) => prioritizationScore(b) - prioritizationScore(a)),
    []
  );
  return (
    <div className="cf43-card">
      <h4>51689 · Confidence-weighted prioritization</h4>
      {rows.map((f, i) => (
        <div key={f.id} className="cf43-row">
          #{i + 1} {f.title} <span className="cf43-tiny">score {prioritizationScore(f)}</span>{' '}
          <Score v={f.confidence} />
        </div>
      ))}
    </div>
  );
}

/* 51690 — Confidence decay */
function ConfidenceDecayDemo() {
  const [finding, setFinding] = useState(F[1]);
  return (
    <div className="cf43-card">
      <h4>51690 · Confidence decay</h4>
      <div className="cf43-row">
        {finding.title} <Score v={finding.confidence} />
      </div>
      <button
        className="cf43-btn"
        onClick={() =>
          setFinding(p =>
            applyDecay(p, {
              contradictedEvidence: 1,
              reason: 'response indicator also fires on error pages',
            })
          )
        }
      >
        Contradict one evidence
      </button>
      <div className="cf43-tiny">History entries: {finding.history.length}</div>
    </div>
  );
}

/* 51691 — Confidence boost events */
function BoostEvents() {
  return (
    <div className="cf43-card">
      <h4>51691 · Confidence boost events</h4>
      {F.map(f =>
        boostEvents(f).map((e, i) => (
          <div key={f.id + i} className="cf43-note">
            ▲ <b>{f.id}</b> {e.from} → {e.to} at {e.at} — {e.trigger}
          </div>
        ))
      )}
    </div>
  );
}

/* 51692 — Peer-agreement indicator */
function PeerAgreementCard() {
  return (
    <div className="cf43-card">
      <h4>51692 · Peer-agreement indicator</h4>
      {F.map(f => {
        const p = peerAgreement(f, PEERS);
        return (
          <div key={f.id} className="cf43-row">
            {f.title} <span className="cf43-tiny">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* 51693 — Confidence calibration view */
function CalibrationView() {
  const rows = useMemo(() => calibrationView(CALIB), []);
  return (
    <div className="cf43-card">
      <h4>51693 · Confidence calibration view</h4>
      <table className="cf43-matrix">
        <thead>
          <tr>
            <th>Bucket</th>
            <th>n</th>
            <th>Predicted</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.n}</td>
              <td>{r.expectedRate}%</td>
              <td>{r.actualRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 51694 — Threshold alerts */
function ThresholdAlerts() {
  const [t, setT] = useState(80);
  const moved = {
    ...F[0],
    history: [...F[0].history, { at: '10:35', score: 79, trigger: 'replay inconclusive' }],
  };
  const a = thresholdAlert(moved, t);
  return (
    <div className="cf43-card">
      <h4>51694 · Threshold alerts</h4>
      <label>
        Threshold{' '}
        <input type="number" min="0" max="100" value={t} onChange={e => setT(+e.target.value)} />
      </label>
      <div className={a.crossed ? 'cf43-alert' : 'cf43-tiny'}>
        {a.crossed
          ? `⚠ F-101 crossed ${t} going ${a.direction}`
          : 'No threshold crossings right now.'}
      </div>
    </div>
  );
}

/* 51695 — Confidence in notifications */
function NotificationPreview() {
  const [ch, setCh] = useState('slack');
  const p = notificationPayload(F[1], ch);
  return (
    <div className="cf43-card">
      <h4>51695 · Confidence in notifications</h4>
      <select value={ch} onChange={e => setCh(e.target.value)}>
        <option>slack</option>
        <option>email</option>
        <option>in-app</option>
      </select>
      <div className="cf43-note" style={{ borderLeftColor: p.color }}>
        {p.text}
      </div>
    </div>
  );
}

/* 51696 — Confidence in snapshots */
function SnapshotConfidenceBlock() {
  const sec = useMemo(() => snapshotConfidenceSection(F), []);
  return (
    <div className="cf43-card">
      <h4>51696 · Confidence in snapshots</h4>
      <div className="cf43-tiny">
        {sec.solid} solid · {sec.needsWork} need work
      </div>
      {sec.rows.map(r => (
        <div key={r.id} className="cf43-row">
          {r.title} <span className="cf43-tiny">{r.meaning}</span>
        </div>
      ))}
    </div>
  );
}

/* 51697 — Confidence color coding */
function ColorLegend() {
  const bands = [
    [95, 'Confirmed'],
    [72, 'Likely'],
    [50, 'Unproven'],
    [22, 'Shaky'],
  ];
  return (
    <div className="cf43-card">
      <h4>51697 · Confidence color coding</h4>
      <div className="cf43-legend">
        {bands.map(([v, l]) => (
          <span key={l} className="cf43-chip" style={{ background: confidenceColor(v) }}>
            {l} · {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 51698 — Confidence tooltips */
function ConfidenceTooltips() {
  return (
    <div className="cf43-card">
      <h4>51698 · Confidence tooltips</h4>
      <div className="cf43-tiny">Hover any score for a plain explanation:</div>
      {[95, 78, 62, 41, 18].map(v => (
        <span key={v} className="cf43-chip-space">
          <Score v={v} />
        </span>
      ))}
    </div>
  );
}

/* 51699 — Confidence audit log */
function AuditLogViewer() {
  const [log, setLog] = useState(F[1].history);
  const [trig, setTrig] = useState('analyst confirmed indicator');
  return (
    <div className="cf43-card">
      <h4>51699 · Confidence audit log</h4>
      {log.map((h, i) => (
        <div key={i} className="cf43-tiny">
          {h.at} — {h.score} ({h.trigger})
        </div>
      ))}
      <div className="cf43-tiny">
        Append:
        <input className="cf43-input" value={trig} onChange={e => setTrig(e.target.value)} />
        <button
          className="cf43-btn"
          onClick={() => {
            const f = appendAuditLog(
              { ...F[1], history: log },
              { from: log[log.length - 1].score, to: log[log.length - 1].score + 5, trigger: trig }
            );
            setLog(f.history);
          }}
        >
          +5
        </button>
      </div>
    </div>
  );
}

/* 51700 — Confidence-based auto-triage */
function AutoTriageBoard() {
  const [rules] = useState({ escalateAt: 80, watchAt: 60 });
  return (
    <div className="cf43-card">
      <h4>51700 · Confidence-based auto-triage</h4>
      {F.map(f => {
        const d = autoTriage(f, rules);
        return (
          <div key={f.id} className="cf43-row">
            <span className={`cf43-pill cf43-${d.action}`}>{d.action}</span> {f.title}{' '}
            <span className="cf43-tiny">{d.reason}</span>
          </div>
        );
      })}
    </div>
  );
}

export const ConfidenceSuiteGallery = [
  { id: 51681, name: 'LowConfidenceFlags', render: <LowConfidenceFlags /> },
  { id: 51682, name: 'ConfidenceSorter', render: <ConfidenceSorter /> },
  { id: 51683, name: 'ConfidenceFilter', render: <ConfidenceFilter /> },
  { id: 51684, name: 'ConfidenceHistoryGraph', render: <ConfidenceHistoryGraph /> },
  { id: 51685, name: 'UncertaintyNotes', render: <UncertaintyNotes /> },
  { id: 51686, name: 'CrossValidationBadges', render: <CrossValidationBadges /> },
  { id: 51687, name: 'ManualVerificationPrompts', render: <ManualVerificationPrompts /> },
  { id: 51688, name: 'ConfidenceSeverityMatrix', render: <ConfidenceSeverityMatrix /> },
  { id: 51689, name: 'PrioritizationList', render: <PrioritizationList /> },
  { id: 51690, name: 'ConfidenceDecayDemo', render: <ConfidenceDecayDemo /> },
  { id: 51691, name: 'BoostEvents', render: <BoostEvents /> },
  { id: 51692, name: 'PeerAgreementCard', render: <PeerAgreementCard /> },
  { id: 51693, name: 'CalibrationView', render: <CalibrationView /> },
  { id: 51694, name: 'ThresholdAlerts', render: <ThresholdAlerts /> },
  { id: 51695, name: 'NotificationPreview', render: <NotificationPreview /> },
  { id: 51696, name: 'SnapshotConfidenceBlock', render: <SnapshotConfidenceBlock /> },
  { id: 51697, name: 'ColorLegend', render: <ColorLegend /> },
  { id: 51698, name: 'ConfidenceTooltips', render: <ConfidenceTooltips /> },
  { id: 51699, name: 'AuditLogViewer', render: <AuditLogViewer /> },
  { id: 51700, name: 'AutoTriageBoard', render: <AutoTriageBoard /> },
];

export default ConfidenceSuiteGallery;
