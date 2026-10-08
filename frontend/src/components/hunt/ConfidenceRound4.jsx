/**
 * ConfidenceRound4.jsx — wave 44 (ideas 51721–51730): confidence governance
 * round 4 (override audits, retrospectives, retesting, digests, legend,
 * duplicates, presentations, approval gates, SIEM export, maturity model).
 *
 * 12 working components, each driving the pure logic in confidenceRound4Core.js
 * with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  appendOverrideLog, retrospectiveAccuracy, retestQueue, confidenceDigest,
  scoreLegend, mergedFindingConfidence, presentationScores, approvalGate,
  siemExportPayload, maturityScore,
} from './confidenceRound4Core.js';

const F = [
  { id: 'F-201', title: 'SSRF in /fetch?url=', severity: 'critical', confidence: 84, techniques: ['scanner', 'manual-review'], overrideLog: [] },
  { id: 'F-202', title: 'Stored XSS in /notes', severity: 'high', confidence: 58, techniques: ['scanner'], overrideLog: [] },
  { id: 'F-203', title: 'Weak TLS cipher offered', severity: 'medium', confidence: 72, techniques: ['headers', 'manual-review'], overrideLog: [] },
];

const RETRO = [
  { huntId: 'H-041', avgPredicted: 74, actualHitRate: 68 },
  { huntId: 'H-042', avgPredicted: 71, actualHitRate: 70 },
  { huntId: 'H-043', avgPredicted: 78, actualHitRate: 81 },
];

const CHANGES = [
  { findingId: 'F-201', title: 'SSRF in /fetch?url=', from: 71, to: 84, at: '10:20' },
  { findingId: 'F-202', title: 'Stored XSS in /notes', from: 62, to: 58, at: '10:31' },
  { findingId: 'F-203', title: 'Weak TLS cipher offered', from: 70, to: 72, at: '10:40' },
];

/* 51721 — Override audit trail: add a manual override entry */
function OverrideLogForm() {
  const [id, setId] = useState('F-202');
  const [to, setTo] = useState(70);
  const [by, setBy] = useState('a.analyst');
  const [note, setNote] = useState('confirmed manually against staging');
  const [trails, setTrails] = useState({});
  const [err, setErr] = useState('');
  const entries = trails[id] || [];
  return (
    <div className="cr44-card">
      <h4>51721 · Override audit trail</h4>
      <select value={id} onChange={(e) => setId(e.target.value)}>{F.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select>
      <input className="cr44-input" type="number" min="0" max="100" value={to} onChange={(e) => setTo(+e.target.value)} title="new score" />
      <input className="cr44-input" value={by} onChange={(e) => setBy(e.target.value)} title="who" />
      <input className="cr44-input cr44-wide" value={note} onChange={(e) => setNote(e.target.value)} title="why" />
      <button className="cr44-btn" onClick={() => {
        try {
          const f = F.find((x) => x.id === id);
          const next = appendOverrideLog({ ...f, overrideLog: entries }, { from: f.confidence, to, by, note, at: 'now' });
          setTrails({ ...trails, [id]: next.overrideLog });
          setErr('');
        } catch (e) { setErr(e.message); }
      }}>Log override</button>
      {err && <div className="cr44-alert">{err}</div>}
      {entries.map((e, i) => <div key={i} className="cr44-tiny">{e.at} — {e.by}: {e.from} → {e.to} ({e.note})</div>)}
    </div>
  );
}

/* 51721 — Override audit trail: read the trail */
function OverrideAuditTrail() {
  const [log] = useState([
    { at: '09:55', by: 'a.analyst', from: 52, to: 58, note: 'payload fires on login page too' },
    { at: '10:30', by: 's.reviewer', from: 58, to: 62, note: 'replay harness confirms second sink' },
  ]);
  return (
    <div className="cr44-card">
      <h4>51721 · Override audit trail</h4>
      <table className="cr44-matrix"><thead><tr><th>At</th><th>Who</th><th>From → To</th><th>Why</th></tr></thead>
        <tbody>{log.map((e, i) => <tr key={i}><td>{e.at}</td><td>{e.by}</td><td>{e.from} → {e.to}</td><td>{e.note}</td></tr>)}</tbody></table>
    </div>
  );
}

/* 51722 — Confidence in retrospectives */
function RetrospectivePanel() {
  const r = useMemo(() => retrospectiveAccuracy(RETRO), []);
  return (
    <div className="cr44-card">
      <h4>51722 · Confidence in retrospectives</h4>
      <table className="cr44-matrix"><thead><tr><th>Hunt</th><th>Predicted</th><th>Actual</th><th>Δ</th><th>Accuracy</th></tr></thead>
        <tbody>{r.hunts.map((h) => <tr key={h.huntId}><td>{h.huntId}</td><td>{h.predicted}</td><td>{h.actual}</td><td>{h.delta > 0 ? '+' : ''}{h.delta}</td><td>{h.accuracy}%</td></tr>)}</tbody></table>
      <div className="cr44-tiny">Bias: {r.bias} · avg accuracy {r.avgAccuracy}% · trend {r.trend > 0 ? '+' : ''}{r.trend} pts</div>
    </div>
  );
}

/* 51723 — Confidence-driven retesting */
function RetestQueueBoard() {
  const [floor, setFloor] = useState(50);
  const q = useMemo(() => retestQueue(F, { floor, ceiling: 75 }), [floor]);
  return (
    <div className="cr44-card">
      <h4>51723 · Confidence-driven retesting</h4>
      <label>Borderline floor <input type="range" min="30" max="70" value={floor} onChange={(e) => setFloor(+e.target.value)} /> {floor}</label>
      {q.map((f) => <div key={f.id} className="cr44-row"><span className={`cr44-pill cr44-${f.urgency}`}>{f.urgency}</span> {f.title} <span className="cr44-score">{f.confidence}</span></div>)}
      {q.length === 0 && <div className="cr44-empty">No borderline findings — nothing to retest.</div>}
    </div>
  );
}

/* 51724 — Confidence notifications digest */
function ConfidenceDigestCard() {
  const [minDelta, setMinDelta] = useState(5);
  const d = useMemo(() => confidenceDigest(CHANGES, { minDelta }), [minDelta]);
  return (
    <div className="cr44-card">
      <h4>51724 · Confidence notifications digest</h4>
      <label>Min Δ <input type="range" min="1" max="20" value={minDelta} onChange={(e) => setMinDelta(+e.target.value)} /> {minDelta}</label>
      <div className="cr44-note">{d.summary}</div>
      {d.topMovers.map((m) => <div key={m.findingId} className="cr44-tiny">{m.title}: {m.from} → {m.to} ({m.delta > 0 ? '+' : ''}{m.delta})</div>)}
    </div>
  );
}

/* 51725 — Confidence legend */
function ScoreLegendCard() {
  const bands = useMemo(() => scoreLegend(), []);
  return (
    <div className="cr44-card">
      <h4>51725 · Confidence legend</h4>
      <div className="cr44-legend">{bands.map((b) => (
        <span key={b.label} className="cr44-chip" style={{ background: b.color }} title={b.meaning}>{b.label} · {b.lo}–{b.hi}</span>
      ))}</div>
      {bands.map((b) => <div key={b.label} className="cr44-tiny"><b>{b.label}:</b> {b.meaning}</div>)}
    </div>
  );
}

/* 51726 — Confidence for duplicates */
function DuplicateConfidenceCard() {
  const [primaryId, setPrimaryId] = useState('F-201');
  const merged = useMemo(() => {
    const p = F.find((x) => x.id === primaryId);
    const dup = { id: 'F-198', title: 'SSRF in /fetch?url= (dup report)', confidence: 61 };
    return mergedFindingConfidence(p, [dup]);
  }, [primaryId]);
  return (
    <div className="cr44-card">
      <h4>51726 · Confidence for duplicates</h4>
      <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>{F.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select>
      {merged.parts.map((p) => <div key={p.id} className="cr44-tiny">{p.id}: {p.confidence}/100</div>)}
      <div className="cr44-note">Combined: <b>{merged.combined}/100</b> — {merged.note}</div>
    </div>
  );
}

/* 51727 — Confidence in presentations */
function PresentationScoresCard() {
  const rows = useMemo(() => presentationScores(F), []);
  return (
    <div className="cr44-card cr44-slide">
      <h4>51727 · Confidence in presentations</h4>
      {rows.map((r) => <div key={r.id} className="cr44-slide-row"><span className="cr44-dot" style={{ background: r.color }} /> <b>{r.title}</b> <span className="cr44-tiny">{r.display}</span></div>)}
    </div>
  );
}

/* 51728 — Confidence-based approvals */
function ApprovalGateCard() {
  const [kind, setKind] = useState('exploit');
  const d = useMemo(() => approvalGate({ kind, target: 'api/orders' }, F[1], {}), [kind]);
  return (
    <div className="cr44-card">
      <h4>51728 · Confidence-based approvals</h4>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="exploit">exploit</option><option value="destructive-test">destructive-test</option><option value="account-action">account-action</option><option value="passive-scan">passive-scan</option>
      </select>
      <div className="cr44-tiny">Finding F-202 confidence: 58</div>
      <div className={d.approved ? 'cr44-note' : 'cr44-alert'}>{d.approved ? '✓ Approved' : '✕ Held'} — {d.reason}{d.requires ? ` (${d.requires})` : ''}</div>
    </div>
  );
}

/* 51729 — Confidence export to SIEM */
function SiemExportCard() {
  const payload = useMemo(() => siemExportPayload(F), []);
  const [copied, setCopied] = useState(false);
  return (
    <div className="cr44-card">
      <h4>51729 · Confidence export to SIEM</h4>
      <pre className="cr44-pre">{JSON.stringify(payload, null, 1)}</pre>
      <button className="cr44-btn" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(payload)); setCopied(true); }}>{copied ? 'Copied' : 'Copy JSON'}</button>
    </div>
  );
}

/* 51730 — Confidence maturity model */
function MaturityModelCard() {
  const [accs, setAccs] = useState(RETRO.map((r) => ({ huntId: r.huntId, accuracy: r.accuracy ?? (100 - Math.abs(r.avgPredicted - r.actualHitRate)) })));
  const m = useMemo(() => maturityScore(accs), [accs]);
  return (
    <div className="cr44-card">
      <h4>51730 · Confidence maturity model</h4>
      <div className="cr44-duo"><span>Level <b>{m.level}/5</b></span><span>{m.label}</span><span className="cr44-tiny">avg {m.avgAccuracy}% over {m.hunts} hunts</span></div>
      {accs.map((h, i) => <label key={h.huntId} className="cr44-tiny">{h.huntId} accuracy <input type="range" min="0" max="100" value={h.accuracy} onChange={(e) => { const c = [...accs]; c[i] = { ...c[i], accuracy: +e.target.value }; setAccs(c); }} /> {h.accuracy}</label>)}
    </div>
  );
}

/* 51730 — Maturity trend across hunts */
function MaturityTrendCard() {
  const pts = RETRO.map((r, i) => {
    const acc = 100 - Math.abs(r.avgPredicted - r.actualHitRate);
    return { x: (i / Math.max(1, RETRO.length - 1)) * 180, y: 60 - acc * 0.55, acc, id: r.huntId };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <div className="cr44-card">
      <h4>51730 · Confidence maturity model</h4>
      <svg className="cr44-spark" viewBox="0 0 180 64"><polyline points={line} fill="none" stroke="#22c55e" strokeWidth="2" /></svg>
      {pts.map((p) => <div key={p.id} className="cr44-tiny">{p.id}: {p.acc}% accuracy</div>)}
    </div>
  );
}

export const ConfidenceRound4Gallery = [
  { id: 51721, name: 'OverrideLogForm', render: <OverrideLogForm /> },
  { id: 51721, name: 'OverrideAuditTrail', render: <OverrideAuditTrail /> },
  { id: 51722, name: 'RetrospectivePanel', render: <RetrospectivePanel /> },
  { id: 51723, name: 'RetestQueueBoard', render: <RetestQueueBoard /> },
  { id: 51724, name: 'ConfidenceDigestCard', render: <ConfidenceDigestCard /> },
  { id: 51725, name: 'ScoreLegendCard', render: <ScoreLegendCard /> },
  { id: 51726, name: 'DuplicateConfidenceCard', render: <DuplicateConfidenceCard /> },
  { id: 51727, name: 'PresentationScoresCard', render: <PresentationScoresCard /> },
  { id: 51728, name: 'ApprovalGateCard', render: <ApprovalGateCard /> },
  { id: 51729, name: 'SiemExportCard', render: <SiemExportCard /> },
  { id: 51730, name: 'MaturityModelCard', render: <MaturityModelCard /> },
  { id: 51730, name: 'MaturityTrendCard', render: <MaturityTrendCard /> },
];

export default ConfidenceRound4Gallery;
